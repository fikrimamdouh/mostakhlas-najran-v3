import { Router } from "express";
import { db, usersTable, auditLogTable, systemSettingsTable } from "@workspace/db";
import { eq, desc, sql, lt, inArray, and } from "drizzle-orm";
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

async function getSupervisorWatchedUserIds(supervisorId: number): Promise<number[]> {
  try {
    const [setting] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, `audit_watch_users_${supervisorId}`)).limit(1);
    if (!setting?.value) return [];
    const arr = JSON.parse(setting.value);
    return Array.isArray(arr) ? arr.map(Number).filter(Boolean) : [];
  } catch (_) {
    return [];
  }
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

// GET /api/audit — list audit logs (admin + supervisor)
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
      } else {
        whereClause = inArray(auditLogTable.userId, allowedIds);
      }
    } else if (userId) {
      whereClause = eq(auditLogTable.userId, Number(userId));
    }

    const query = whereClause
      ? db.select().from(auditLogTable).where(whereClause).orderBy(desc(auditLogTable.createdAt))
      : db.select().from(auditLogTable).orderBy(desc(auditLogTable.createdAt));

    const countQuery = whereClause
      ? db.select({ count: sql<number>`count(*)` }).from(auditLogTable).where(whereClause)
      : db.select({ count: sql<number>`count(*)` }).from(auditLogTable);

    const logs = await (query as any).limit(Number(limit)).offset(offset);
    const [{ count }] = await countQuery as any;

    return res.json({ logs, total: Number(count), page: Number(page), limit: Number(limit) });
  } catch (err) {
    req.log.error({ err }, "Failed to list audit logs");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/audit — log an action
router.post("/", requireAuth, async (req: any, res) => {
  try {
    const [dbUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkId, req.clerkUserId))
      .limit(1);

    if (!dbUser) return res.status(404).json({ error: "User not found" });

    const {
      action,
      details,
      entityType,
      entityId,
      before,
      after,
      page,
    } = req.body;

    if (!action) {
      return res.status(400).json({ error: "action is required" });
    }

    const ip =
      req.headers["x-forwarded-for"]?.toString() ||
      req.socket.remoteAddress ||
      null;

    const auditDetails = JSON.stringify({
      details: details || null,
      entityType: entityType || null,
      entityId: entityId || null,
      page: page || null,
      before: before || null,
      after: after || null,
    });

    await db.insert(auditLogTable).values({
      userId: dbUser.id,
      userEmail: dbUser.email,
      userName: dbUser.name,
      action,
      details: auditDetails,
      ipAddress: ip,
    });

    return res.json({ logged: true });
  } catch (err) {
    req.log.error({ err }, "Failed to log audit action");
    return res.status(500).json({ error: "Internal server error" });
  }
});

const MAX_AUDIT_ROWS = 5000;

export async function logAudit(userId: number | null, userEmail: string | null, userName: string | null, action: string, details?: string, ip?: string) {
  try {
    await db.insert(auditLogTable).values({
      userId, userEmail, userName, action,
      details: details || null,
      ipAddress: ip || null,
    });

    // تنظيف تلقائي: احتفظ بآخر MAX_AUDIT_ROWS سطر فقط
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(auditLogTable);
    if (Number(count) > MAX_AUDIT_ROWS) {
      const oldest = await db.select({ id: auditLogTable.id })
        .from(auditLogTable)
        .orderBy(desc(auditLogTable.createdAt))
        .limit(1)
        .offset(MAX_AUDIT_ROWS - 1);
      if (oldest[0]) {
        await db.delete(auditLogTable).where(lt(auditLogTable.id, oldest[0].id));
      }
    }
  } catch (_) {}
}

export default router;