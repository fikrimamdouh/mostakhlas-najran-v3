import { Router } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { sendAdminActionEmail, sendApprovalEmail, sendRejectionEmail } from "../lib/email";
import { logAudit } from "./audit";

const router = Router();


const PRIMARY_ADMIN_EMAIL = (process.env.PRIMARY_ADMIN_EMAIL || "rorofikri@gmail.com").trim().toLowerCase();
const PRIMARY_ADMIN_CLERK_ID = (process.env.PRIMARY_ADMIN_CLERK_ID || "user_3DIFbR0YQyLX8xxPdBCeLl2CcTX").trim();

const notifyPrimaryAdmin = (payload: { action: string; actorName: string; actorEmail: string; targetName: string; targetEmail: string; details?: string | null; }) => {
  sendAdminActionEmail(PRIMARY_ADMIN_EMAIL, payload).catch(() => {});
};


async function syncCurrentUser(req: any) {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) return null;

  let email = String((auth as any)?.sessionClaims?.email || "").trim().toLowerCase();
  if (!email) {
    try {
      const clerkUser = await clerkClient.users.getUser(clerkUserId);
      email = String(clerkUser.emailAddresses?.[0]?.emailAddress || "").trim().toLowerCase();
    } catch {
      // ignore clerk lookup errors, keep fallback values
    }
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkUserId)).limit(1);
  const isPrimaryAdmin = email === PRIMARY_ADMIN_EMAIL || (PRIMARY_ADMIN_CLERK_ID && clerkUserId === PRIMARY_ADMIN_CLERK_ID);
  const targetRole = isPrimaryAdmin ? "admin" : "company";
  const targetStatus = isPrimaryAdmin ? "approved" : "pending";

  if (!existing) {
    const [created] = await db.insert(usersTable).values({
      clerkId: clerkUserId,
      email: email || "",
      name: "مستخدم جديد",
      role: targetRole as any,
      status: targetStatus as any,
    }).returning();
    return created;
  }

  const updates: Record<string, any> = {};
  if (email && email !== String(existing.email || "").trim().toLowerCase()) updates.email = email;
  if (existing.role !== targetRole) updates.role = targetRole;
  if (existing.status !== targetStatus) updates.status = targetStatus;

  if (Object.keys(updates).length > 0) {
    const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, existing.id)).returning();
    return updated;
  }

  return existing;
}

const requireAuth = (req: any, res: any, next: any) => {
  const auth = getAuth(req);
  if (!auth?.userId) return res.status(401).json({ error: "Unauthorized" });
  req.clerkUserId = auth.userId;
  next();
};

const requireAdmin = async (req: any, res: any, next: any) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.clerkUserId)).limit(1);
    const isPrimaryAdmin = !!user && (String(user.email || "").trim().toLowerCase() === PRIMARY_ADMIN_EMAIL || (PRIMARY_ADMIN_CLERK_ID && user.clerkId === PRIMARY_ADMIN_CLERK_ID));
    if (!user) return res.status(403).json({ error: "Forbidden" });
    if (isPrimaryAdmin && (user.role !== "admin" || user.status !== "approved")) {
      const [upgraded] = await db.update(usersTable).set({ role: "admin", status: "approved" }).where(eq(usersTable.id, user.id)).returning();
      req.currentUser = upgraded;
      return next();
    }
    if (user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    req.currentUser = user;
    next();
  } catch (err) {
    req.log.error({ err }, "requireAdmin failed");
    res.status(500).json({ error: "Internal server error" });
  }
};

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

// GET /api/users/me
router.get("/me", requireAuth, async (req: any, res) => {
  try {
    const user = await syncCurrentUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    return res.json(user);
  } catch (err) {
    req.log.error({ err }, "Failed to get user");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/sync", requireAuth, async (req: any, res) => {
  try {
    const user = await syncCurrentUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    return res.json(user);
  } catch (err) {
    req.log.error({ err }, "Failed to sync user");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/users/me — update own profile
router.patch("/me", requireAuth, async (req: any, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.clerkUserId)).limit(1);
    if (!user) return res.status(404).json({ error: "User not found" });
    const { name, phone, company } = req.body;
    const updates: Record<string, any> = {};
    if (name) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (company !== undefined) updates.company = company;
    const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, user.id)).returning();
    const ip = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress;
    logAudit(user.id, user.email, user.name, "تحديث الملف الشخصي", JSON.stringify(updates), ip);
    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update profile");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/users/me/login
router.patch("/me/login", requireAuth, async (req: any, res) => {
  try {
    const [user] = await db.update(usersTable)
      .set({ lastLoginAt: new Date() })
      .where(eq(usersTable.clerkId, req.clerkUserId))
      .returning();
    if (!user) return res.status(404).json({ error: "User not found" });

    // Log login in audit
    const ip = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress;
    logAudit(user.id, user.email, user.name, "تسجيل دخول", undefined, ip);

    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to update last login");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/users - admin + supervisor (read-only for supervisor)
router.get("/", requireAuth, requireAdminOrSupervisor, async (req: any, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    let query = db.select().from(usersTable) as any;
    if (status && ["pending", "approved", "rejected"].includes(String(status))) query = query.where(eq(usersTable.status, status as "pending" | "approved" | "rejected"));
    const users = await query.limit(Number(limit)).offset(offset);
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(usersTable);
    return res.json({ users, total: Number(count), page: Number(page), limit: Number(limit) });
  } catch (err) {
    req.log.error({ err }, "Failed to list users");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/users/:userId/approve - admin only
router.post("/:userId/approve", requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const { userId } = req.params;
    const [user] = await db.update(usersTable).set({ status: "approved" }).where(eq(usersTable.id, Number(userId))).returning();
    if (!user) return res.status(404).json({ error: "User not found" });
    sendApprovalEmail(user.email, user.name).catch(() => {});
    const ip = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress;
    logAudit(req.currentUser.id, req.currentUser.email, req.currentUser.name, "موافقة على مستخدم", `تمت الموافقة على ${user.name} (${user.email})`, ip);
    notifyPrimaryAdmin({ action: "موافقة على مستخدم", actorName: req.currentUser.name, actorEmail: req.currentUser.email, targetName: user.name, targetEmail: user.email, details: "تمت الموافقة على الحساب" });
    return res.json(user);
  } catch (err) {
    req.log.error({ err }, "Failed to approve user");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/users/:userId/reject - admin only
router.post("/:userId/reject", requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const { userId } = req.params;
    const [user] = await db.update(usersTable).set({ status: "rejected" }).where(eq(usersTable.id, Number(userId))).returning();
    if (!user) return res.status(404).json({ error: "User not found" });
    sendRejectionEmail(user.email, user.name).catch(() => {});
    const ip = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress;
    logAudit(req.currentUser.id, req.currentUser.email, req.currentUser.name, "رفض مستخدم", `تم رفض ${user.name} (${user.email})`, ip);
    notifyPrimaryAdmin({ action: "رفض مستخدم", actorName: req.currentUser.name, actorEmail: req.currentUser.email, targetName: user.name, targetEmail: user.email, details: "تم رفض الحساب" });
    return res.json(user);
  } catch (err) {
    req.log.error({ err }, "Failed to reject user");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/users/:userId/role - admin only
router.patch("/:userId/role", requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    if (!["admin", "supervisor", "user", "company"].includes(role)) return res.status(400).json({ error: "Invalid role" });
    const [user] = await db.update(usersTable).set({ role }).where(eq(usersTable.id, Number(userId))).returning();
    if (!user) return res.status(404).json({ error: "User not found" });
    const ip = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress;
    const roleAr = role === "admin" ? "مدير النظام" : role === "supervisor" ? "مدير مستخلصات" : "مستخدم عادي";
    logAudit(req.currentUser.id, req.currentUser.email, req.currentUser.name, "تغيير صلاحية", `تغيير دور ${user.name} إلى ${roleAr}`, ip);
    notifyPrimaryAdmin({ action: "تغيير صلاحيات المستخدم", actorName: req.currentUser.name, actorEmail: req.currentUser.email, targetName: user.name, targetEmail: user.email, details: `الدور الجديد: ${roleAr}` });
    return res.json(user);
  } catch (err) {
    req.log.error({ err }, "Failed to change role");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/users/:userId/deactivate - admin only
router.post("/:userId/deactivate", requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const { userId } = req.params;
    const [user] = await db.update(usersTable).set({ status: "rejected" }).where(eq(usersTable.id, Number(userId))).returning();
    if (!user) return res.status(404).json({ error: "User not found" });
    const ip = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress;
    logAudit(req.currentUser.id, req.currentUser.email, req.currentUser.name, "تعطيل حساب", `تم تعطيل حساب ${user.name} (${user.email})`, ip);
    notifyPrimaryAdmin({ action: "تعطيل حساب", actorName: req.currentUser.name, actorEmail: req.currentUser.email, targetName: user.name, targetEmail: user.email, details: "تم تعطيل الحساب" });
    return res.json(user);
  } catch (err) {
    req.log.error({ err }, "Failed to deactivate user");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/users/:userId/activate - admin only
router.post("/:userId/activate", requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const { userId } = req.params;
    const [user] = await db.update(usersTable).set({ status: "approved" }).where(eq(usersTable.id, Number(userId))).returning();
    if (!user) return res.status(404).json({ error: "User not found" });
    const ip = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress;
    logAudit(req.currentUser.id, req.currentUser.email, req.currentUser.name, "تفعيل حساب", `تم تفعيل حساب ${user.name} (${user.email})`, ip);
    notifyPrimaryAdmin({ action: "تفعيل حساب", actorName: req.currentUser.name, actorEmail: req.currentUser.email, targetName: user.name, targetEmail: user.email, details: "تم تفعيل الحساب" });
    return res.json(user);
  } catch (err) {
    req.log.error({ err }, "Failed to activate user");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
