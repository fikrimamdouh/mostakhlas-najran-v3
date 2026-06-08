import { Router } from "express";
import { db, usersTable, submittedExtractsTable, userStorageTable, auditLogTable, extractsTable, projectsTable, hospitalStorageTable, visitRequestsTable } from "@workspace/db";
import { eq, ne, and, isNotNull, inArray } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { runInactivityCheck } from "../lib/inactivity";
import { sendAdminNewUserEmail } from "../lib/email";

const router = Router();

const requireAdmin = async (req: any, res: any, next: any) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.clerkUserId)).limit(1);
  if (!user || user.role !== "admin") return res.status(403).json({ error: "Admin only" });
  req.currentUser = user;
  next();
};

/**
 * POST /api/admin/reset-system
 * Clears all data except the calling admin's account.
 * Requires: role=admin + confirmation phrase in body.
 */
// GET /api/admin/inactivity-check — get inactive hospitals without sending email
router.get("/inactivity-check", requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    const result = await runInactivityCheck();
    return res.json({ ...result, emailSent: false });
  } catch (err) {
    req.log.error({ err }, "Inactivity check failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/inactivity-check — run check and send email alert
router.post("/inactivity-check", requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    const result = await runInactivityCheck();
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "Inactivity check failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/admin/users/:id/supervised-hospital — set hospital supervisor assignment
router.patch("/users/:id/supervised-hospital", requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    const userId = Number(req.params.id);
    const { supervisedHospital } = req.body as { supervisedHospital: string | null };

    const [updated] = await db
      .update(usersTable)
      .set({ supervisedHospital: supervisedHospital || null })
      .where(eq(usersTable.id, userId))
      .returning({ id: usersTable.id, supervisedHospital: usersTable.supervisedHospital });

    if (!updated) return res.status(404).json({ error: "User not found" });
    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to set supervised hospital");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/admin/purge-deleted-users
 * Permanently removes users already marked deleted + their personal storage and submitted extract rows.
 * Keeps active users and hospital shared storage untouched.
 */
router.post("/purge-deleted-users", requireAuth, requireAdmin, async (req: any, res: any) => {
  const { confirmation } = req.body ?? {};
  if (confirmation !== "حذف المستخدمين المحذوفين") {
    return res.status(400).json({ error: "جملة التأكيد غير صحيحة" });
  }

  try {
    const deletedUsers = await db.select({ id: usersTable.id, email: usersTable.email, name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.status, "deleted" as any));
    const ids = deletedUsers.map(u => Number(u.id)).filter(Boolean);
    if (ids.length === 0) return res.json({ ok: true, deletedUsers: 0, deletedUserStorage: 0, deletedExtracts: 0 });

    const storageRows = await db.select({ id: userStorageTable.id })
      .from(userStorageTable)
      .where(inArray(userStorageTable.userId, ids));
    const extractRows = await db.select({ id: submittedExtractsTable.id })
      .from(submittedExtractsTable)
      .where(inArray(submittedExtractsTable.userId, ids));
    const extractIds = extractRows.map(r => Number(r.id)).filter(Boolean);

    if (extractIds.length) {
      await db.delete(extractRevisionsTable as any).where(inArray((extractRevisionsTable as any).extractId, extractIds));
    }
    await db.delete(submittedExtractsTable).where(inArray(submittedExtractsTable.userId, ids));
    await db.delete(userStorageTable).where(inArray(userStorageTable.userId, ids));
    await db.delete(usersTable).where(inArray(usersTable.id, ids));

    req.log.info({ adminId: req.currentUser.id, deletedUsers: ids.length }, "Deleted users purged permanently");
    return res.json({
      ok: true,
      deletedUsers: ids.length,
      deletedUserStorage: storageRows.length,
      deletedExtracts: extractRows.length,
      users: deletedUsers,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to purge deleted users");
    return res.status(500).json({ error: "فشل حذف المستخدمين المحذوفين نهائياً" });
  }
});

/**
 * POST /api/admin/reset-extracts
 * Deletes extracts + projects only — keeps users, storage, templates.
 */
router.post("/reset-extracts", requireAuth, requireAdmin, async (req: any, res: any) => {
  const { confirmation } = req.body ?? {};
  if (confirmation !== "حذف المستخلصات") {
    return res.status(400).json({ error: "جملة التأكيد غير صحيحة" });
  }

  const errors: string[] = [];
  const tryDelete = async (label: string, fn: () => Promise<any>) => {
    try { await fn(); } catch (e: any) { errors.push(`${label}: ${e.message}`); req.log.warn(e, `reset-extracts: skipped ${label}`); }
  };

  await tryDelete("extract_revisions", () => db.execute(`DELETE FROM extract_revisions`));
  await tryDelete("submitted_extracts", () => db.delete(submittedExtractsTable));
  await tryDelete("extracts",           () => db.delete(extractsTable));
  await tryDelete("projects",           () => db.delete(projectsTable));
  await tryDelete("visit_requests",     () => db.delete(visitRequestsTable));

  req.log.info({ adminId: req.currentUser.id, skipped: errors }, "Extracts + visits reset performed");
  return res.json({ ok: true, message: "تم مسح المستخلصات والمشاريع وطلبات الزيارة بنجاح", skipped: errors });
});

router.post("/reset-system", requireAuth, requireAdmin, async (req: any, res: any) => {
  const { confirmation } = req.body ?? {};
  if (confirmation !== "تأكيد التهيئة الكاملة") {
    return res.status(400).json({ error: "يجب إرسال جملة التأكيد الصحيحة" });
  }

  const errors: string[] = [];
  const tryDelete = async (label: string, fn: () => Promise<any>) => {
    try { await fn(); } catch (e: any) { errors.push(`${label}: ${e.message}`); req.log.warn(e, `reset-system: skipped ${label}`); }
  };

  await tryDelete("extract_revisions", () => db.execute(`DELETE FROM extract_revisions`));
  await tryDelete("submitted_extracts", () => db.delete(submittedExtractsTable));
  await tryDelete("user_storage", () => db.delete(userStorageTable));
  await tryDelete("hospital_storage", () => db.delete(hospitalStorageTable));
  await tryDelete("audit_log", () => db.delete(auditLogTable));
  await tryDelete("extracts", () => db.delete(extractsTable));
  await tryDelete("projects", () => db.delete(projectsTable));
  await tryDelete("scheduled_backups", () => db.execute(`DELETE FROM scheduled_backups`));
  await tryDelete("visit_requests", () => db.execute(`DELETE FROM visit_requests`));

  try {
    await db.delete(usersTable).where(ne(usersTable.id, req.currentUser.id));
  } catch (err: any) {
    req.log.error(err, "System reset: failed to delete users");
    return res.status(500).json({ error: "فشل في حذف المستخدمين" });
  }

  req.log.info({ adminId: req.currentUser.id, skipped: errors }, "System reset performed");
  return res.json({ ok: true, message: "تمت تهيئة النظام بنجاح", skipped: errors });
});

// POST /api/admin/test-email — send a test admin notification email to verify delivery
router.post("/test-email", requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    const adminEmail = req.currentUser.email as string;
    await sendAdminNewUserEmail(adminEmail, {
      name: "مستخدم تجريبي",
      email: "test@example.com",
      phone: "0500000000",
      hospital: "مستشفى نجران العام",
      jobTitle: "مهندس صيانة",
      contractNumber: "TEST-001",
    });
    req.log.info({ adminEmail }, "Test email sent");
    return res.json({ ok: true, sentTo: adminEmail, message: `تم إرسال إيميل تجريبي إلى ${adminEmail}` });
  } catch (err) {
    req.log.error({ err }, "Test email failed");
    return res.status(500).json({ error: "فشل إرسال الإيميل التجريبي" });
  }
});

export default router;