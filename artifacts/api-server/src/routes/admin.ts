import { Router } from "express";
import { db, usersTable, submittedExtractsTable, userStorageTable, auditLogTable, extractsTable, projectsTable } from "@workspace/db";
import { eq, ne } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";

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
