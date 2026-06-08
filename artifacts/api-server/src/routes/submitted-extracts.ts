import { Router } from "express";
import { db, usersTable, submittedExtractsTable, userStorageTable, extractRevisionsTable } from "@workspace/db";
import { requireAuth } from "../middleware/requireAuth";
import { eq, desc, and } from "drizzle-orm";
import { sendNewExtractEmail } from "../lib/email";

const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

function advanceMonthInExtractData(jsonStr: string): string {
  try {
    const data = JSON.parse(jsonStr);
    const curIdx = MONTHS_AR.indexOf(data.extractMonth || '');
    if (curIdx < 0) return jsonStr;
    const nextIdx = (curIdx + 1) % 12;
    const curYear = parseInt(data.extractYear || String(new Date().getFullYear()), 10);
    const nextYear = curIdx === 11 ? curYear + 1 : curYear;
    const nextMonth1 = nextIdx + 1; // 1-based month number

    // Each month is independent: start = 1st, end = last day of that month
    const pad = (n: number) => String(n).padStart(2, '0');
    const lastDay = new Date(nextYear, nextMonth1, 0).getDate();
    const nextStart = `${nextYear}-${pad(nextMonth1)}-01`;
    const nextEnd   = `${nextYear}-${pad(nextMonth1)}-${pad(lastDay)}`;

    // Increment paymentNumber (default to 1 if missing/invalid)
    const curPayment = parseInt(data.paymentNumber || data.extractNumber || '0', 10);
    const nextPayment = isNaN(curPayment) ? 1 : curPayment + 1;

    return JSON.stringify({
      ...data,
      extractMonth: MONTHS_AR[nextIdx],
      extractYear: String(nextYear),
      extractStart: nextStart,
      extractEnd:   nextEnd,
      paymentNumber: String(nextPayment),
      extractNumber: String(nextPayment),
    });
  } catch {
    return jsonStr;
  }
}

const router = Router();

const requireApproved = async (req: any, res: any, next: any) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.clerkUserId)).limit(1);
  if (!user) return res.status(401).json({ error: "User not registered" });
  if (user.status !== "approved" && user.role !== "admin") {
    return res.status(403).json({ error: "Account pending approval" });
  }
  req.currentUser = user;
  next();
};

const requireAdmin = async (req: any, res: any, next: any) => {
  if (req.currentUser?.role !== "admin" && req.currentUser?.role !== "supervisor") {
    return res.status(403).json({ error: "Admin or supervisor required" });
  }
  next();
};

const requireStrictAdmin = async (req: any, res: any, next: any) => {
  if (req.currentUser?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
};

// Map contractCompany key → Arabic label (same as frontend COMPANY_SITES)
const COMPANY_SITES: Record<string, { sites: string[] }> = {
  "بيت_العرب": {
    sites: [
      "مستشفى يدمة العام",
      "مستشفى حبونا العام",
      "مستشفى بدر الجنوب العام",
      "مستشفى الولادة والأطفال",
      "مستشفى نجران العام القديم وسكن الممرضات الخارجي",
      "المكاتب الإدارية والمرافق الصحية",
      "صيانة وإصلاح السيارات والعيادات المتنقلة",
    ],
  },
  "سراكو": {
    sites: [
      "مستشفى نجران العام الجديد",
      "مركز طب الأسنان التخصصي",
      "مجمع الأمل للصحة النفسية",
      "مستشفى ثار العام",
      "مستشفى خباش العام",
      "المراكز الصحية",
      "مستشفى الملك خالد",
      "مركز الأمير سلطان",
      "مستشفى شروره العام",
    ],
  },
};

// GET /api/submitted-extracts — list all (admin/supervisor) or company-filtered (contract_supervisor) or own (user)
router.get("/", requireAuth, requireApproved, async (req: any, res) => {
  try {
    const role = req.currentUser.role;
    const isAdminOrSup = role === "admin" || role === "supervisor" || role === "viewer";
    const isContractSup = role === "contract_supervisor";

    let whereClause: any = undefined;
    if (isContractSup) {
      // contract_supervisor sees all extracts from their company's hospitals
      const companyKey = req.currentUser.contractCompany;
      const companySites = companyKey ? (COMPANY_SITES[companyKey]?.sites ?? []) : [];
      if (companySites.length === 0) {
        return res.json({ extracts: [], total: 0 });
      }
      const { inArray } = await import("drizzle-orm");
      whereClause = inArray(usersTable.hospital, companySites);
    } else if (!isAdminOrSup) {
      whereClause = eq(submittedExtractsTable.userId, req.currentUser.id);
    }

    const rows = await db
      .select({
        id: submittedExtractsTable.id,
        extractType: submittedExtractsTable.extractType,
        companyName: submittedExtractsTable.companyName,
        contractNumber: submittedExtractsTable.contractNumber,
        hospitalName: submittedExtractsTable.hospitalName,
        periodMonth: submittedExtractsTable.periodMonth,
        totalAmount: submittedExtractsTable.totalAmount,
        status: submittedExtractsTable.status,
        revisionCount: submittedExtractsTable.revisionCount,
        revisedAt: submittedExtractsTable.revisedAt,
        notes: submittedExtractsTable.notes,
        adminNotes: submittedExtractsTable.adminNotes,
        approvedBy: submittedExtractsTable.approvedBy,
        approvedAt: submittedExtractsTable.approvedAt,
        extractData: submittedExtractsTable.extractData,
        createdAt: submittedExtractsTable.createdAt,
        updatedAt: submittedExtractsTable.updatedAt,
        submittedByName: usersTable.name,
        submittedByEmail: usersTable.email,
        submittedByHospital: usersTable.hospital,
        userId: submittedExtractsTable.userId,
      })
      .from(submittedExtractsTable)
      .leftJoin(usersTable, eq(submittedExtractsTable.userId, usersTable.id))
      .where(whereClause)
      .orderBy(desc(submittedExtractsTable.createdAt));

    return res.json({ extracts: rows, total: rows.length });
  } catch (err) {
    req.log.error({ err }, "Failed to list submitted extracts");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/submitted-extracts/:id — admin deletes one test/submitted extract only
router.delete("/:id", requireAuth, requireApproved, requireStrictAdmin, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid ID" });

    const [existing] = await db.select({ id: submittedExtractsTable.id, hospitalName: submittedExtractsTable.hospitalName, extractType: submittedExtractsTable.extractType, periodMonth: submittedExtractsTable.periodMonth })
      .from(submittedExtractsTable)
      .where(eq(submittedExtractsTable.id, id))
      .limit(1);
    if (!existing) return res.status(404).json({ error: "Not found" });

    await db.delete(extractRevisionsTable).where(eq(extractRevisionsTable.extractId, id)).catch(() => {});
    await db.delete(submittedExtractsTable).where(eq(submittedExtractsTable.id, id));

    req.log.info({ adminId: req.currentUser.id, extractId: id }, "Submitted extract deleted by admin");
    return res.json({ ok: true, deleted: existing });
  } catch (err) {
    req.log.error({ err }, "Failed to delete submitted extract");
    return res.status(500).json({ error: "فشل حذف المستخلص" });
  }
});

// POST /api/submitted-extracts — submit a new extract from HTML page
router.post("/", requireAuth, requireApproved, async (req: any, res) => {
  try {
    const { extractType, periodMonth, totalAmount, notes, contractNumber, extractData } = req.body;

    if (!extractType) {
      return res.status(400).json({ error: "extractType is required" });
    }

    // Auto-fill company and hospital from the user's profile — cannot be overridden by the client
    const user = req.currentUser;
    const COMPANY_LABELS: Record<string, string> = {
      "بيت_العرب": "شركة مجموعة بيت العرب الحديثة المحدودة",
      "سراكو": "شركة سراكو",
    };
    const companyName = user.company ? (COMPANY_LABELS[user.company] || user.company) : (req.body.companyName || null);
    const hospitalName = user.hospital || req.body.hospitalName || null;
    const resolvedContractNumber = contractNumber || user.contractNumber || null;
    const extractDataJson = extractData ? JSON.stringify(extractData) : null;

    const [row] = await db.insert(submittedExtractsTable).values({
      userId: user.id,
      extractType,
      companyName,
      contractNumber: resolvedContractNumber,
      hospitalName,
      periodMonth: periodMonth || null,
      totalAmount: totalAmount != null ? String(totalAmount) : null,
      notes: notes || null,
      status: "submitted",
      extractData: extractDataJson,
    }).returning();

    // Log revision entry
    await db.insert(extractRevisionsTable).values({
      extractId: row.id,
      changedBy: user.name,
      changedByRole: user.role,
      previousStatus: null,
      newStatus: "submitted",
      notes: "تقديم مستخلص جديد",
    });

    // إشعار فوري للمدير ومشرفي الموقع — fire-and-forget
    void (async () => {
      try {
        const admins = await db
          .select({ email: usersTable.email })
          .from(usersTable)
          .where(and(eq(usersTable.role, "admin"), eq(usersTable.status, "approved")));

        const hospitalSupervisors = hospitalName
          ? await db
              .select({ email: usersTable.email })
              .from(usersTable)
              .where(
                and(
                  eq(usersTable.role, "supervisor"),
                  eq(usersTable.supervisedHospital, hospitalName),
                  eq(usersTable.status, "approved"),
                )
              )
          : [];

        const recipients = [
          ...admins.map(a => a.email),
          ...hospitalSupervisors.map(s => s.email),
        ].filter((e): e is string => !!e);

        if (recipients.length > 0) {
          await sendNewExtractEmail(recipients, {
            submitterName:  user.name,
            submitterEmail: user.email,
            hospitalName:   hospitalName || "—",
            extractType,
            periodMonth,
            totalAmount:    totalAmount != null ? String(totalAmount) : null,
            extractId:      row.id,
          });
        }
      } catch (_) {}
    })();

    return res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to submit extract");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/submitted-extracts/:id — resubmit after revision
router.put("/:id", requireAuth, requireApproved, async (req: any, res) => {
  try {
    const [existing] = await db.select().from(submittedExtractsTable)
      .where(eq(submittedExtractsTable.id, Number(req.params.id))).limit(1);

    if (!existing) return res.status(404).json({ error: "Not found" });
    if (existing.userId !== req.currentUser.id) return res.status(403).json({ error: "Forbidden" });
    if (existing.status !== "needs_revision" && existing.status !== "rejected") {
      return res.status(400).json({ error: "Can only revise extracts that need revision or were rejected" });
    }

    const { companyName, contractNumber, hospitalName, periodMonth, totalAmount, notes, extractData } = req.body;
    const extractDataJson = extractData ? JSON.stringify(extractData) : existing.extractData;

    const [row] = await db.update(submittedExtractsTable).set({
      companyName: companyName ?? existing.companyName,
      contractNumber: contractNumber ?? existing.contractNumber,
      hospitalName: hospitalName ?? existing.hospitalName,
      periodMonth: periodMonth ?? existing.periodMonth,
      totalAmount: totalAmount != null ? String(totalAmount) : existing.totalAmount,
      extractData: extractDataJson,
      notes: notes ?? existing.notes,
      status: "submitted",
      revisionCount: (existing.revisionCount ?? 0) + 1,
      revisedAt: new Date(),
      adminNotes: null,
      updatedAt: new Date(),
    }).where(eq(submittedExtractsTable.id, Number(req.params.id))).returning();

    // Log revision entry
    await db.insert(extractRevisionsTable).values({
      extractId: row.id,
      changedBy: req.currentUser.name,
      changedByRole: req.currentUser.role,
      previousStatus: existing.status,
      newStatus: "submitted",
      notes: `تعديل رقم ${row.revisionCount}`,
    });

    return res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to resubmit extract");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/submitted-extracts/:id
router.get("/:id", requireAuth, requireApproved, async (req: any, res) => {
  try {
    const [row] = await db
      .select()
      .from(submittedExtractsTable)
      .leftJoin(usersTable, eq(submittedExtractsTable.userId, usersTable.id))
      .where(eq(submittedExtractsTable.id, Number(req.params.id)))
      .limit(1);

    if (!row) return res.status(404).json({ error: "Not found" });

    const isOwner = row.submitted_extracts.userId === req.currentUser.id;
    const isAdminOrSup = req.currentUser.role === "admin" || req.currentUser.role === "supervisor";
    if (!isOwner && !isAdminOrSup) return res.status(403).json({ error: "Forbidden" });

    return res.json({ ...row.submitted_extracts, submittedByName: row.users?.name, submittedByEmail: row.users?.email });
  } catch (err) {
    req.log.error({ err }, "Failed to get submitted extract");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/submitted-extracts/:id/status — admin updates status
router.patch("/:id/status", requireAuth, requireApproved, requireAdmin, async (req: any, res) => {
  try {
    const { status, adminNotes } = req.body;
    const validStatuses = ["submitted", "under_review", "approved", "rejected", "needs_revision"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const updates: any = {
      status,
      updatedAt: new Date(),
    };
    if (adminNotes !== undefined) updates.adminNotes = adminNotes;
    if (status === "approved") {
      updates.approvedBy = req.currentUser.name;
      updates.approvedAt = new Date();
    }

    const [existing] = await db.select().from(submittedExtractsTable)
      .where(eq(submittedExtractsTable.id, Number(req.params.id))).limit(1);

    const [row] = await db.update(submittedExtractsTable)
      .set(updates)
      .where(eq(submittedExtractsTable.id, Number(req.params.id)))
      .returning();

    if (!row) return res.status(404).json({ error: "Not found" });

    // Log status change
    await db.insert(extractRevisionsTable).values({
      extractId: row.id,
      changedBy: req.currentUser.name,
      changedByRole: req.currentUser.role,
      previousStatus: existing?.status ?? null,
      newStatus: status,
      notes: adminNotes || null,
    }).catch(() => {});

    if (status === "approved" && row.userId) {
      try {
        const [storageRow] = await db.select().from(userStorageTable)
          .where(and(eq(userStorageTable.userId, row.userId), eq(userStorageTable.storageKey, 'persistentExtractData')))
          .limit(1);
        if (storageRow?.storageValue) {
          const advanced = advanceMonthInExtractData(storageRow.storageValue);
          await db.update(userStorageTable)
            .set({ storageValue: advanced, updatedAt: new Date() })
            .where(and(eq(userStorageTable.userId, row.userId), eq(userStorageTable.storageKey, 'persistentExtractData')));
        }
      } catch (advErr) {
        req.log.warn({ advErr }, "Month advance failed (non-fatal)");
      }
    }

    return res.json({ ...row, monthAdvanced: status === "approved" });
  } catch (err) {
    req.log.error({ err }, "Failed to update extract status");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/submitted-extracts/:id/revisions — get revision history
router.get(":id/revisions", requireAuth, requireApproved, async (req: any, res) => {
  try {
    const extractId = Number(req.params.id);
    const [extract] = await db.select({ userId: submittedExtractsTable.userId })
      .from(submittedExtractsTable).where(eq(submittedExtractsTable.id, extractId)).limit(1);
    if (!extract) return res.status(404).json({ error: "Not found" });

    const isOwner = extract.userId === req.currentUser.id;
    const isAdminOrSup = ["admin", "supervisor", "contract_supervisor"].includes(req.currentUser.role);
    if (!isOwner && !isAdminOrSup) return res.status(403).json({ error: "Forbidden" });

    const rows = await db
      .select()
      .from(extractRevisionsTable)
      .where(eq(extractRevisionsTable.extractId, extractId))
      .orderBy(desc(extractRevisionsTable.createdAt));

    return res.json({ revisions: rows });
  } catch (err) {
    req.log.error({ err }, "Failed to get revisions");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
