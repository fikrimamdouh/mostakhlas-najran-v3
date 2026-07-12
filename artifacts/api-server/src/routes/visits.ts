import { Router } from "express";
import {
  db,
  usersTable,
  visitRequestsTable,
  systemSettingsTable,
  visitSystemsTable,
  visitContractorsTable,
  visitSiteApprovalsTable,
  visitRepresentativesTable,
  visitRequestMetadataTable,
} from "@workspace/db";
import { requireAuth } from "../middleware/requireAuth";
import { and, desc, eq } from "drizzle-orm";
import { sendVisitNewRequestEmail, sendVisitApprovedEmail, sendVisitRejectedEmail } from "../lib/email";
import multer from "multer";

const ADMIN_EMAIL = "rorofikri@gmail.com";
const VISIT_MANAGER_EMAIL = "rorofikri@gmail.com";
const router = Router();

const requireApproved = async (req: any, res: any, next: any) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.clerkUserId)).limit(1);
  if (!user) return res.status(401).json({ error: "User not registered" });
  if (user.status !== "approved" && user.role !== "admin") return res.status(403).json({ error: "Account pending approval" });
  req.currentUser = user;
  next();
};

const requireVisitManager = (req: any, res: any, next: any) => {
  const user = req.currentUser;
  if (!user || String(user.email || "").trim().toLowerCase() !== VISIT_MANAGER_EMAIL) {
    return res.status(403).json({ error: "هذه العملية مخصصة لمدير إدارة التجمع" });
  }
  next();
};

function parseId(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function dateIsActive(validFrom: string | null, validTo: string | null) {
  const today = todayIso();
  return (!validFrom || validFrom <= today) && (!validTo || validTo >= today);
}

async function getSetting(key: string): Promise<string | null> {
  const [row] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, key)).limit(1);
  return row?.value ?? null;
}

async function setSetting(key: string, value: string, updatedBy: string) {
  const existing = await getSetting(key);
  if (existing !== null) {
    await db.update(systemSettingsTable).set({ value, updatedAt: new Date(), updatedBy }).where(eq(systemSettingsTable.key, key));
  } else {
    await db.insert(systemSettingsTable).values({ key, value, updatedBy });
  }
}

router.get("/settings", requireAuth, requireApproved, async (_req: any, res) => {
  const [stamp, signature, managerName] = await Promise.all([
    getSetting("visit_stamp"),
    getSetting("visit_signature"),
    getSetting("visit_manager_name"),
  ]);
  return res.json({ stamp, signature, managerName: managerName || "م. محمد عباس المكرمي" });
});

router.post("/settings", requireAuth, requireApproved, requireVisitManager, async (req: any, res) => {
  const user = req.currentUser;
  const { stamp, signature, managerName } = req.body;
  const ops: Promise<void>[] = [];
  if (stamp !== undefined) ops.push(setSetting("visit_stamp", stamp, user.email));
  if (signature !== undefined) ops.push(setSetting("visit_signature", signature, user.email));
  if (managerName !== undefined) ops.push(setSetting("visit_manager_name", managerName || "م. محمد عباس المكرمي", user.email));
  await Promise.all(ops);
  return res.json({ success: true });
});

router.post("/", requireAuth, requireApproved, async (req: any, res) => {
  const user = req.currentUser;
  let { repName, siteLocation, repId, visitDate, repMobile, systemName, mainContractor, subContractor, repIdPhoto } = req.body;
  const systemId = parseId(req.body?.systemId);
  const contractorId = parseId(req.body?.contractorId);
  let representativeId = parseId(req.body?.representativeId);
  const requestedSite = String(siteLocation || "").trim();
  const isManager = String(user.email || "").toLowerCase() === VISIT_MANAGER_EMAIL;
  const userSite = String(user.hospital || "").trim();
  siteLocation = isManager ? requestedSite : userSite || requestedSite;

  if (!repName || !siteLocation || !repId || !visitDate || !repMobile || !systemName || !mainContractor || !subContractor) {
    return res.status(400).json({ error: "جميع الحقول المطلوبة يجب تعبئتها" });
  }
  if (!/^\d{10}$/.test(String(repId).replace(/\s+/g, ""))) return res.status(400).json({ error: "رقم الهوية/الإقامة يجب أن يكون 10 أرقام" });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(visitDate))) return res.status(400).json({ error: "تاريخ الزيارة غير صحيح" });

  const configuredApprovals = await db.select().from(visitSiteApprovalsTable).where(eq(visitSiteApprovalsTable.hospitalName, siteLocation));
  let siteApprovalId: number | null = null;
  let approvalSnapshot: string | null = null;

  if (configuredApprovals.length) {
    if (!systemId || !contractorId) return res.status(400).json({ error: "يجب اختيار النظام والشركة من القوائم المعتمدة" });
    const [approval] = await db.select().from(visitSiteApprovalsTable).where(and(
      eq(visitSiteApprovalsTable.hospitalName, siteLocation),
      eq(visitSiteApprovalsTable.systemId, systemId),
      eq(visitSiteApprovalsTable.contractorId, contractorId),
    )).limit(1);
    if (!approval || approval.status !== "approved" || !dateIsActive(approval.validFrom, approval.validTo)) {
      return res.status(400).json({ error: "الشركة غير معتمدة لهذا النظام في الموقع أو انتهت صلاحية الاعتماد" });
    }
    const [[system], [contractor]] = await Promise.all([
      db.select().from(visitSystemsTable).where(eq(visitSystemsTable.id, systemId)).limit(1),
      db.select().from(visitContractorsTable).where(eq(visitContractorsTable.id, contractorId)).limit(1),
    ]);
    if (!system || !system.isActive) return res.status(400).json({ error: "النظام غير فعال" });
    if (!contractor || contractor.status !== "active") return res.status(400).json({ error: "الشركة غير فعالة" });
    systemName = system.name;
    subContractor = contractor.name;
    mainContractor = approval.mainContractor || mainContractor;
    siteApprovalId = approval.id;

    if (representativeId) {
      const [representative] = await db.select().from(visitRepresentativesTable).where(eq(visitRepresentativesTable.id, representativeId)).limit(1);
      if (!representative || representative.contractorId !== contractorId || representative.status !== "active") {
        return res.status(400).json({ error: "المندوب غير فعال أو لا يتبع الشركة المختارة" });
      }
      if (representative.idExpiry && representative.idExpiry < todayIso()) return res.status(400).json({ error: "هوية/إقامة المندوب منتهية" });
      repName = representative.fullName;
      repId = representative.nationalId;
      repMobile = representative.mobile || repMobile;
    } else {
      const cleanId = String(repId).replace(/\s+/g, "");
      const [existingRep] = await db.select().from(visitRepresentativesTable).where(eq(visitRepresentativesTable.nationalId, cleanId)).limit(1);
      if (existingRep) {
        if (existingRep.contractorId !== contractorId) return res.status(400).json({ error: "رقم الهوية مسجل لمندوب تابع لشركة أخرى" });
        representativeId = existingRep.id;
      } else {
        const [createdRep] = await db.insert(visitRepresentativesTable).values({
          contractorId,
          fullName: String(repName).trim(),
          nationalId: cleanId,
          mobile: String(repMobile).trim(),
          status: "pending",
          source: "site_request",
          notes: "أضيف تلقائياً من طلب موقع ويحتاج استكمال الإقامة وتفعيل الإدارة",
        }).returning();
        representativeId = createdRep.id;
      }
    }

    approvalSnapshot = JSON.stringify({
      siteApprovalId: approval.id,
      hospitalName: approval.hospitalName,
      system: { id: system.id, name: system.name },
      contractor: { id: contractor.id, name: contractor.name },
      approval: { status: approval.status, validFrom: approval.validFrom, validTo: approval.validTo, documentStatus: approval.documentStatus },
      requestedAt: new Date().toISOString(),
    });
  }

  const [inserted] = await db.insert(visitRequestsTable).values({
    userId: user.id,
    repName: String(repName).trim(),
    siteLocation: String(siteLocation).trim(),
    repId: String(repId).replace(/\s+/g, ""),
    visitDate,
    repMobile: String(repMobile).trim(),
    systemName: String(systemName).trim(),
    mainContractor: String(mainContractor).trim(),
    subContractor: String(subContractor).trim(),
    repIdPhoto: repIdPhoto || null,
    status: "pending",
    submittedByName: user.name,
    submittedByHospital: user.hospital || null,
    submittedByContract: user.contractNumber || null,
  }).returning();

  await db.insert(visitRequestMetadataTable).values({
    visitRequestId: inserted.id,
    source: "site_request",
    systemId,
    contractorId,
    representativeId,
    siteApprovalId,
    approvalSnapshot,
  });

  sendVisitNewRequestEmail(ADMIN_EMAIL, {
    repName: inserted.repName,
    siteLocation: inserted.siteLocation,
    systemName: inserted.systemName,
    mainContractor: inserted.mainContractor,
    subContractor: inserted.subContractor,
    visitDate: inserted.visitDate,
    submittedByName: user.name,
    submittedByHospital: user.hospital || null,
  }).catch((err) => { req.log.error({ err }, "Failed to send visit request email"); });

  return res.status(201).json({ visit: inserted });
});

router.get("/", requireAuth, requireApproved, async (req: any, res) => {
  const user = req.currentUser;
  let rows;
  if (String(user.email || "").toLowerCase() === VISIT_MANAGER_EMAIL) {
    rows = await db.select().from(visitRequestsTable).orderBy(desc(visitRequestsTable.createdAt));
  } else {
    rows = await db.select().from(visitRequestsTable).where(eq(visitRequestsTable.userId, user.id)).orderBy(desc(visitRequestsTable.createdAt));
  }
  return res.json({ visits: rows });
});

router.patch("/:id/status", requireAuth, requireApproved, requireVisitManager, async (req: any, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const { status, adminNotes } = req.body;
  if (!["approved", "rejected", "pending"].includes(status)) return res.status(400).json({ error: "Invalid status" });

  let serialNumber: string | null = null;
  let approvedAt: Date | null = null;
  const [visit] = await db.select().from(visitRequestsTable).where(eq(visitRequestsTable.id, id)).limit(1);
  if (!visit) return res.status(404).json({ error: "Visit request not found" });

  if (status === "approved") {
    approvedAt = new Date();
    if (!visit.serialNumber) {
      const year = new Date().getFullYear();
      const hospital = (visit.submittedByHospital || visit.siteLocation || "unknown").replace(/\s+/g, "_");
      const contract = (visit.submittedByContract || "unknown").replace(/\s+/g, "_");
      const counterKey = `visit_serial_${year}_${hospital}_${contract}`;
      const currentVal = await getSetting(counterKey);
      const nextNum = parseInt(currentVal || "0", 10) + 1;
      await setSetting(counterKey, String(nextNum), req.currentUser.email);
      serialNumber = String(nextNum).padStart(4, "0");
    }
  }

  const updateData: any = { status, adminNotes: adminNotes || null, updatedAt: new Date() };
  if (approvedAt) updateData.approvedAt = approvedAt;
  if (serialNumber) updateData.serialNumber = serialNumber;
  const [updated] = await db.update(visitRequestsTable).set(updateData).where(eq(visitRequestsTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Visit request not found" });

  const [submitter] = await db.select().from(usersTable).where(eq(usersTable.id, visit.userId)).limit(1);
  if (submitter?.email) {
    if (status === "approved") {
      const sn = serialNumber || updated.serialNumber || "—";
      const approvedDate = approvedAt ? approvedAt.toLocaleDateString("ar-SA") : "—";
      sendVisitApprovedEmail(submitter.email, submitter.name, {
        repName: visit.repName,
        siteLocation: visit.siteLocation,
        visitDate: visit.visitDate,
        serialNumber: sn,
        approvedAt: approvedDate,
      }).catch(() => {});
    } else if (status === "rejected") {
      sendVisitRejectedEmail(submitter.email, submitter.name, {
        repName: visit.repName,
        siteLocation: visit.siteLocation,
        adminNotes: adminNotes || null,
      }).catch(() => {});
    }
  }
  return res.json({ visit: updated });
});

const uploadMemory = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
router.patch("/:id/signed-permit", requireAuth, requireApproved, requireVisitManager, uploadMemory.single("file"), async (req: any, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  let signedPermitFile: string | undefined;
  if (req.file) {
    const mime = req.file.mimetype || "application/octet-stream";
    signedPermitFile = `data:${mime};base64,${req.file.buffer.toString("base64")}`;
  } else if (req.body?.signedPermitFile) {
    signedPermitFile = req.body.signedPermitFile;
  }
  if (!signedPermitFile) return res.status(400).json({ error: "No file provided" });
  const [updated] = await db.update(visitRequestsTable).set({ signedPermitFile, updatedAt: new Date() }).where(eq(visitRequestsTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Visit request not found" });
  req.log.info({ id }, "Signed permit uploaded");
  return res.json({ visit: updated });
});

router.delete("/:id", requireAuth, requireApproved, requireVisitManager, async (req: any, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const [existing] = await db.select({ id: visitRequestsTable.id, repName: visitRequestsTable.repName, status: visitRequestsTable.status })
    .from(visitRequestsTable).where(eq(visitRequestsTable.id, id)).limit(1);
  if (!existing) return res.status(404).json({ error: "Visit request not found" });
  await db.delete(visitRequestsTable).where(eq(visitRequestsTable.id, id));
  req.log.info({ id, deletedBy: req.currentUser?.id }, "Visit request deleted");
  return res.json({ ok: true, deleted: existing });
});

export default router;
