import { Router } from "express";
import { db, usersTable, auditLogTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

// admin OR supervisor can view audit logs
const requireAdminOrSupervisor = async (req: any, res: any, next: any) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.clerkUserId)).limit(1);
    if (!user || !["admin", "supervisor"].includes(user.role)) return res.status(403).json({ error: "Forbidden" });
    req.currentUser = user;
    next();
  } catch (err) {
    req.log.error({ err }, "requireAdminOrSupervisor failed");
    res.status(500).json({ error: "Internal server error" });
  }
};

// GET /api/audit — list audit logs (admin + supervisor)
router.get("/", requireAuth, requireAdminOrSupervisor, async (req: any, res) => {
  try {
    const { page = 1, limit = 50, userId } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = db.select().from(auditLogTable).orderBy(desc(auditLogTable.createdAt)) as any;
    if (userId) {
      query = db.select().from(auditLogTable)
        .where(eq(auditLogTable.userId, Number(userId)))
        .orderBy(desc(auditLogTable.createdAt)) as any;
    }

    const logs = await query.limit(Number(limit)).offset(offset);
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(auditLogTable);

    return res.json({ logs, total: Number(count), page: Number(page), limit: Number(limit) });
  } catch (err) {
    req.log.error({ err }, "Failed to list audit logs");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/audit — log an action
router.post("/", requireAuth, async (req: any, res) => {
  try {
    const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.clerkUserId)).limit(1);
    if (!dbUser) return res.status(404).json({ error: "User not found" });

    const { action, details } = req.body;
    if (!action) return res.status(400).json({ error: "action is required" });

    const ip = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress || null;
    await db.insert(auditLogTable).values({
      userId: dbUser.id,
      userEmail: dbUser.email,
      userName: dbUser.name,
      action,
      details: details || null,
      ipAddress: ip,
    });
    return res.json({ logged: true });
  } catch (err) {
    req.log.error({ err }, "Failed to log audit action");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export async function logAudit(userId: number | null, userEmail: string | null, userName: string | null, action: string, details?: string, ip?: string) {
  try {
    await db.insert(auditLogTable).values({
      userId, userEmail, userName, action,
      details: details || null,
      ipAddress: ip || null,
    });
  } catch (_) {}
}

export default router;
