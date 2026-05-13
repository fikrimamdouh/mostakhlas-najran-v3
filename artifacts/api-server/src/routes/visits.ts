import { Router } from "express";
import { db, usersTable, visitRequestsTable, systemSettingsTable } from "@workspace/db";
import { requireAuth } from "../middleware/requireAuth";
import { eq, desc } from "drizzle-orm";
import { sendVisitNewRequestEmail, sendVisitApprovedEmail, sendVisitRejectedEmail } from "../lib/email";

const ADMIN_EMAIL = "rorofikri@gmail.com";

const router = Router();

const requireApproved = async (req: any, res: any, next: any) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.clerkUserId)).limit(1);
  if (!user) return res.status(401).json({ error: "User not registered" });
  if (user.status !== "approved" && user.role !== "admin") {
    return res.status(403).json({ error: "Account pending approval" });
  }
  (req as any).currentUser = user;
  next();
};

const requireAdmin = async (req: any, res: any, next: any) => {
  if ((req as any).currentUser?.role !== "admin") {
    return res.status(403).json({ error: "Admin required" });
  }
  next();
};

async function getSetting(key: string): Promise<string | null> {
  const [row] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, key)).limit(1);
  return row?.value ?? null;
}

async function setSetting(key: string, value: string, updatedBy: string) {
  const existing = await getSetting(key);
  if (existing !== null) {
    await db.update(systemSettingsTable)
      .set({ value, updatedAt: new Date(), updatedBy })
      .where(eq(systemSettingsTable.key, key));
  } else {
    await db.insert(systemSettingsTable).values({ key, value, updatedBy });
  }
}

// GET /api/visits/settings
router.get("/settings", requireAuth, requireApproved, async (req: any, res) => {
  const [stamp, signature, managerName] = await Promise.all([
    getSetting("visit_stamp"),
    getSetting("visit_signature"),
    getSetting("visit_manager_name"),
  ]);
  return res.json({ stamp, signature, managerName: managerName || "م. محمد عباس المكرمي" });
});

// POST /api/visits/settings — admin only
router.post("/settings", requireAuth, requireApproved, requireAdmin, async (req: any, res) => {
  const user = req.currentUser;
  const { stamp, signature, managerName } = req.body;
  const ops: Promise<void>[] = [];
  if (stamp !== undefined) ops.push(setSetting("visit_stamp", stamp, user.email));
  if (signature !== undefined) ops.push(setSetting("visit_signature", signature, user.email));
  if (managerName !== undefined) ops.push(setSetting("visit_manager_name", managerName || "م. محمد عباس المكرمي", user.email));
  await Promise.all(ops);
  return res.json({ success: true });
});

// POST /api/visits — submit a new visit request
router.post("/", requireAuth, requireApproved, async (req: any, res) => {
  const user = req.currentUser;
  const { repName, siteLocation, repId, visitDate, repMobile, systemName, mainContractor, subContractor, repIdPhoto } = req.body;
  if (!repName || !siteLocation || !repId || !visitDate || !repMobile || !systemName || !mainContractor || !subContractor) {
    return res.status(400).json({ error: "جميع الحقول المطلوبة يجب تعبئتها" });
  }
  const [inserted] = await db.insert(visitRequestsTable).values({
    userId: user.id,
    repName,
    siteLocation,
    repId,
    visitDate,
    repMobile,
    systemName,
    mainContractor,
    subContractor,
    repIdPhoto: repIdPhoto || null,
    status: "pending",
    submittedByName: user.name,
    submittedByHospital: user.hospital || null,
    submittedByContract: user.contractNumber || null,
  }).returning();

  // Notify admin
  sendVisitNewRequestEmail(ADMIN_EMAIL, {
    repName,
    siteLocation,
    systemName,
    mainContractor,
    subContractor,
    visitDate,
    submittedByName: user.name,
    submittedByHospital: user.hospital || null,
  }).catch(() => {});

  return res.status(201).json({ visit: inserted });
});

// GET /api/visits — list visit requests
router.get("/", requireAuth, requireApproved, async (req: any, res) => {
  const user = req.currentUser;
  let rows;
  if (user.role === "admin" || user.role === "supervisor") {
    rows = await db.select().from(visitRequestsTable).orderBy(desc(visitRequestsTable.createdAt));
  } else {
    rows = await db.select().from(visitRequestsTable)
      .where(eq(visitRequestsTable.userId, user.id))
      .orderBy(desc(visitRequestsTable.createdAt));
  }
  return res.json({ visits: rows });
});

// PATCH /api/visits/:id/status — admin approve/reject
router.patch("/:id/status", requireAuth, requireApproved, requireAdmin, async (req: any, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const { status, adminNotes } = req.body;
  if (!["approved", "rejected", "pending"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  let serialNumber: string | null = null;
  let approvedAt: Date | null = null;

  const [visit] = await db.select().from(visitRequestsTable).where(eq(visitRequestsTable.id, id)).limit(1);
  if (!visit) return res.status(404).json({ error: "Visit request not found" });

  if (status === "approved") {
    approvedAt = new Date();
    if (!visit.serialNumber) {
      const year = new Date().getFullYear();
      const hospital = (visit.submittedByHospital || "unknown").replace(/\s+/g, "_");
      const contract = (visit.submittedByContract || "unknown").replace(/\s+/g, "_");
      const counterKey = `visit_serial_${year}_${hospital}_${contract}`;
      const currentVal = await getSetting(counterKey);
      const nextNum = parseInt(currentVal || "0", 10) + 1;
      await setSetting(counterKey, String(nextNum), "system");
      serialNumber = String(nextNum).padStart(4, "0");
    }
  }

  const updateData: any = { status, adminNotes: adminNotes || null, updatedAt: new Date() };
  if (approvedAt) updateData.approvedAt = approvedAt;
  if (serialNumber) updateData.serialNumber = serialNumber;

  const [updated] = await db.update(visitRequestsTable)
    .set(updateData)
    .where(eq(visitRequestsTable.id, id))
    .returning();

  if (!updated) return res.status(404).json({ error: "Visit request not found" });

  // Send email notification to user
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

// PATCH /api/visits/:id/signed-permit — admin upload scanned signed copy
router.patch("/:id/signed-permit", requireAuth, requireApproved, requireAdmin, async (req: any, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const { signedPermitFile } = req.body;
  if (!signedPermitFile) return res.status(400).json({ error: "No file provided" });
  const [updated] = await db.update(visitRequestsTable)
    .set({ signedPermitFile, updatedAt: new Date() })
    .where(eq(visitRequestsTable.id, id))
    .returning();
  if (!updated) return res.status(404).json({ error: "Visit request not found" });
  req.log.info({ id }, "Signed permit uploaded");
  return res.json({ visit: updated });
});

export default router;
