import { Router } from "express";
import { db, usersTable, auditLogTable, systemSettingsTable } from "@workspace/db";
import { eq, desc, sql, lt, inArray, and } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

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

const requireAdmin = async (req: any, res: any, next: any) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.clerkUserId)).limit(1);
    if (!user || user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    req.currentUser = user;
    next();
  } catch (err) {
    req.log.error({ err }, "requireAdmin failed");
    res.status(500).json({ error: "Internal server error" });
  }
};

async function getSupervisorWatchedUserIds(supervisorId: number): Promise<number[]> {
  try {
    const [setting] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, `audit_watch_users_${supervisorId}`)).limit(1);
    if (!setting?.value) return [];
    const arr = JSON.parse(setting.value);
    return Array.isArray(arr) ? arr.map(Number).filter(Boolean) : [];
  } catch (_) { return []; }
}

async function getSupervisorAllowedUserIds(user: any): Promise<number[]> {
  const explicit = await getSupervisorWatchedUserIds(user.id);
  if (explicit.length) return explicit;
  if (!user.supervisedHospital) return [];
  const users = await db.select({ id: usersTable.id }).from(usersTable).where(and(
    eq(usersTable.hospital, user.supervisedHospital),
    sql`${usersTable.status} <> 'deleted'`
  ));
  return users.map(u => u.id);
}

router.get("/", requireAuth, requireAdminOrSupervisor, async (req: any, res) => {
  try {
    const { page = 1, limit = 50, userId } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const currentUser = req.currentUser;
    let whereClause: any = undefined;

    if (currentUser.role === "supervisor") {
      const allowedIds = await getSupervisorAllowedUserIds(currentUser);
      if (!allowedIds.length) return res.json({ logs: [], total: 0, page: Number(page), limit: Number(limit) });
      const requestedUserId = userId ? Number(userId) : null;
      if (requestedUserId) {
        if (!allowedIds.includes(requestedUserId)) return res.status(403).json({ error: "Not allowed to view this user's audit" });
        whereClause = eq(auditLogTable.userId, requestedUserId);
      } else whereClause = inArray(auditLogTable.userId, allowedIds);
    } else if (userId) whereClause = eq(auditLogTable.userId, Number(userId));

    const query = whereClause ? db.select().from(auditLogTable).where(whereClause).orderBy(desc(auditLogTable.createdAt)) : db.select().from(auditLogTable).orderBy(desc(auditLogTable.createdAt));
    const countQuery = whereClause ? db.select({ count: sql<number>`count(*)` }).from(auditLogTable).where(whereClause) : db.select({ count: sql<number>`count(*)` }).from(auditLogTable);
    const logs = await (query as any).limit(Number(limit)).offset(offset);
    const [{ count }] = await countQuery as any;
    return res.json({ logs, total: Number(count), page: Number(page), limit: Number(limit) });
  } catch (err) {
    req.log.error({ err }, "Failed to list audit logs");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/cleanup-user", requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const userEmail = typeof req.body?.userEmail === "string" ? req.body.userEmail.trim() : "";
    const userIdRaw = req.body?.userId;
    const userId = userIdRaw !== undefined && userIdRaw !== null && userIdRaw !== "" ? Number(userIdRaw) : null;

    if (!userEmail && (!userId || Number.isNaN(userId))) {
      return res.status(400).json({ error: "userEmail or userId is required" });
    }

    const whereClause = userEmail ? eq(auditLogTable.userEmail, userEmail) : eq(auditLogTable.userId, userId as number);
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(auditLogTable).where(whereClause);
    await db.delete(auditLogTable).where(whereClause);

    const ip = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress || null;
    await db.insert(auditLogTable).values({
      userId: req.currentUser.id,
      userEmail: req.currentUser.email,
      userName: req.currentUser.name,
      action: "حذف سجل مراقبة مستخدم",
      details: JSON.stringify({ details: `تم حذف ${Number(count)} سجل مراقبة لمستخدم محدد`, targetUserEmail: userEmail || null, targetUserId: userId || null, deletedCount: Number(count) }),
      ipAddress: ip,
    });

    return res.json({ deleted: Number(count), userEmail: userEmail || null, userId: userId || null });
  } catch (err) {
    req.log.error({ err }, "Failed to cleanup audit logs by user");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/cleanup", requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const { before } = req.body as { before?: string };
    if (!before) return res.status(400).json({ error: "before date required" });
    const beforeDate = new Date(before);
    if (Number.isNaN(beforeDate.getTime())) return res.status(400).json({ error: "invalid before date" });

    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(auditLogTable).where(lt(auditLogTable.createdAt, beforeDate));
    await db.delete(auditLogTable).where(lt(auditLogTable.createdAt, beforeDate));

    const ip = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress || null;
    await db.insert(auditLogTable).values({
      userId: req.currentUser.id,
      userEmail: req.currentUser.email,
      userName: req.currentUser.name,
      action: "تنظيف سجل المراقبة",
      details: JSON.stringify({ details: `تم حذف ${Number(count)} سجل قبل ${beforeDate.toISOString()}`, before: beforeDate.toISOString(), deletedCount: Number(count) }),
      ipAddress: ip,
    });

    return res.json({ deleted: Number(count), before: beforeDate.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to cleanup audit logs");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAuth, async (req: any, res) => {
  try {
    const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.clerkUserId)).limit(1);
    if (!dbUser) return res.status(404).json({ error: "User not found" });
    const { action, details, entityType, entityId, before, after, page } = req.body;
    if (!action) return res.status(400).json({ error: "action is required" });
    const ip = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress || null;
    const auditDetails = JSON.stringify({ details: details || null, entityType: entityType || null, entityId: entityId || null, page: page || null, before: before || null, after: after || null });
    await db.insert(auditLogTable).values({ userId: dbUser.id, userEmail: dbUser.email, userName: dbUser.name, action, details: auditDetails, ipAddress: ip });
    return res.json({ logged: true });
  } catch (err) {
    req.log.error({ err }, "Failed to log audit action");
    return res.status(500).json({ error: "Internal server error" });
  }
});

const MAX_AUDIT_ROWS = 5000;

export async function logAudit(userId: number | null, userEmail: string | null, userName: string | null, action: string, details?: string, ip?: string) {
  try {
    await db.insert(auditLogTable).values({ userId, userEmail, userName, action, details: details || null, ipAddress: ip || null });
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(auditLogTable);
    if (Number(count) > MAX_AUDIT_ROWS) {
      const oldest = await db.select({ id: auditLogTable.id }).from(auditLogTable).orderBy(desc(auditLogTable.createdAt)).limit(1).offset(MAX_AUDIT_ROWS - 1);
      if (oldest[0]) await db.delete(auditLogTable).where(lt(auditLogTable.id, oldest[0].id));
    }
  } catch (_) {}
}

export default router;
