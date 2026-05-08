import { Router } from "express";
import { db, usersTable, submittedExtractsTable, userStorageTable, auditLogTable, extractsTable, projectsTable } from "@workspace/db";
import { eq, ne, and, isNotNull } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { runInactivityCheck } from "../lib/inactivity";

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

router.post("/reset-system", requireAuth, requireAdmin, async (req: any, res: any) => {
  const { confirmation } = req.body ?? {};
  if (confirmation !== "تأكيد التهيئة الكاملة") {
    return res.status(400).json({ error: "يجب إرسال جملة التأكيد الصحيحة" });
  }

  try {
    // Delete all submitted extracts
    await db.delete(submittedExtractsTable);

    // Delete all user storage (cloud localStorage)
    await db.delete(userStorageTable);

    // Delete all audit logs
    await db.delete(auditLogTable);

    // Delete all old extracts & projects
    await db.delete(extractsTable);
    await db.delete(projectsTable);

    // Delete all users EXCEPT the current admin
    await db.delete(usersTable).where(ne(usersTable.id, req.currentUser.id));

    req.log.info({ adminId: req.currentUser.id }, "System reset performed");
    return res.json({ ok: true, message: "تمت تهيئة النظام بنجاح" });
  } catch (err: any) {
    req.log.error(err, "System reset failed");
    return res.status(500).json({ error: "فشل في تهيئة النظام" });
  }
});

export default router;
