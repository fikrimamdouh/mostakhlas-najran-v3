import { Router } from "express";
import { db, usersTable, systemSettingsTable } from "@workspace/db";
import { eq, sql, ne } from "drizzle-orm";
import { sendApprovalEmail, sendRejectionEmail } from "../lib/email";
import { logAudit } from "./audit";
import { requireAuth, clerk } from "../middleware/requireAuth";

const router = Router();
function getClerkDisplayName(clerkUser: any, email: string) {
  const metadataName =
    (clerkUser.publicMetadata?.name as string | undefined) ||
    (clerkUser.unsafeMetadata?.name as string | undefined) ||
    (clerkUser.publicMetadata?.fullName as string | undefined) ||
    (clerkUser.unsafeMetadata?.fullName as string | undefined);

  return (
    metadataName?.trim() ||
    clerkUser.fullName?.trim() ||
    `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() ||
    email.split("@")[0] ||
    "مستخدم جديد"
  );
}
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

function auditWatchKey(supervisorId: number) { return `audit_watch_users_${supervisorId}`; }
async function readAuditWatchedUsers(supervisorId: number): Promise<number[]> {
  const [row] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, auditWatchKey(supervisorId))).limit(1);
  if (!row?.value) return [];
  try { const parsed = JSON.parse(row.value); return Array.isArray(parsed) ? parsed.map(Number).filter(Boolean) : []; } catch { return []; }
}

// GET /api/users/:userId/audit-watch - admin only
router.get("/:userId/audit-watch", requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const supervisorId = Number(req.params.userId);
    const watchedUserIds = await readAuditWatchedUsers(supervisorId);
    return res.json({ supervisorId, watchedUserIds });
  } catch (err) {
    req.log.error({ err }, "Failed to get audit watch users");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/users/:userId/audit-watch - admin only
router.patch("/:userId/audit-watch", requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const supervisorId = Number(req.params.userId);
    const ids = Array.isArray(req.body.watchedUserIds) ? req.body.watchedUserIds.map(Number).filter(Boolean).filter((id: number) => id !== supervisorId) : [];
    const uniqueIds = [...new Set(ids)];
    const key = auditWatchKey(supervisorId);
    const value = JSON.stringify(uniqueIds);
    const [existing] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, key)).limit(1);
    if (existing) await db.update(systemSettingsTable).set({ value, updatedAt: new Date(), updatedBy: req.currentUser.email }).where(eq(systemSettingsTable.key, key));
    else await db.insert(systemSettingsTable).values({ key, value, updatedBy: req.currentUser.email });
    const ip = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress;
    logAudit(req.currentUser.id, req.currentUser.email, req.currentUser.name, "تحديد مستخدمي المراقبة", `تم ربط مشرف رقم ${supervisorId} بمراقبة ${uniqueIds.length} مستخدم`, ip);
    return res.json({ supervisorId, watchedUserIds: uniqueIds });
  } catch (err) {
    req.log.error({ err }, "Failed to save audit watch users");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/users/me
router.get("/me", requireAuth, async (req: any, res) => {
  try {
    const clerkUserId = req.clerkUserId;

    let [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkId, clerkUserId))
      .limit(1);

    if (user?.status === "deleted") {
      return res.status(403).json({
        error: "ACCOUNT_DELETED",
        message: "هذا الحساب محذوف أو غير مفعل. يرجى التواصل مع الإدارة.",
      });
    }

    if (user) {
      return res.json(user);
    }

    // clerk_id not found — fetch email from Clerk and try matching by email
    const clerkUser = await clerk.users.getUser(clerkUserId);
    const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
    const name = getClerkDisplayName(clerkUser, email);

    const [byEmail] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (byEmail?.status === "deleted") {
      return res.status(403).json({
        error: "ACCOUNT_DELETED",
        message: "هذا الحساب محذوف أو غير مفعل. يرجى التواصل مع الإدارة.",
      });
    }

    if (byEmail) {
      req.log.info(
        { oldClerkId: byEmail.clerkId, newClerkId: clerkUserId, email },
        "Migrating clerk_id for existing user"
      );

      const [updated] = await db
        .update(usersTable)
        .set({
          clerkId: clerkUserId,
          name:
            !byEmail.name || byEmail.name === "مستخدم جديد"
              ? name
              : byEmail.name,
        })
        .where(eq(usersTable.id, byEmail.id))
        .returning();

      return res.json(updated);
    }

    // Brand-new user: let /api/users/sync create it using pre-registration data
    return res.status(404).json({ error: "User not found" });
  } catch (err) {
    req.log.error({ err }, "Failed to get user");
    return res.status(500).json({ error: "Internal server error" });
  }
});
// POST /api/users/sync — create or update user from pre-registration data
router.post("/sync", requireAuth, async (req: any, res) => {
  try {
    const clerkUserId = req.clerkUserId;

    const {
      email,
      name,
      phone,
      company,
      hospital,
      jobTitle,
      contractNumber,
    } = req.body;

    const clerkUser = await clerk.users.getUser(clerkUserId);
    const clerkEmail = clerkUser.emailAddresses[0]?.emailAddress ?? "";
    const finalEmail = email || clerkEmail;
    const finalName =
      (name || "").trim() ||
      getClerkDisplayName(clerkUser, finalEmail);

    let [existing] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkId, clerkUserId))
      .limit(1);

    if (!existing && finalEmail) {
      [existing] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, finalEmail))
        .limit(1);
    }

    if (existing?.status === "deleted") {
      return res.status(403).json({
        error: "ACCOUNT_DELETED",
        message: "هذا الحساب محذوف أو غير مفعل. يرجى التواصل مع الإدارة.",
      });
    }

    if (existing) {
      const [updated] = await db
        .update(usersTable)
        .set({
          clerkId: clerkUserId,
          email: finalEmail || existing.email,
          name: finalName || existing.name,
          phone: phone || existing.phone,
          company: company || existing.company,
          hospital: hospital || existing.hospital,
          jobTitle: jobTitle || existing.jobTitle,
          contractNumber: contractNumber || existing.contractNumber,
        })
        .where(eq(usersTable.id, existing.id))
        .returning();

      return res.json(updated);
    }

    const [created] = await db
      .insert(usersTable)
      .values({
        clerkId: clerkUserId,
        email: finalEmail,
        name: finalName,
        phone: phone || null,
        company: company || null,
        hospital: hospital || null,
        jobTitle: jobTitle || null,
        contractNumber: contractNumber || null,
        role: "user",
        status: "pending",
      })
      .returning();

    return res.json(created);
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
    const { name, phone, jobTitle } = req.body;
    const updates: Record<string, any> = {};
    if (name) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (jobTitle !== undefined) updates.jobTitle = jobTitle;
    const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, user.id)).returning();
    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update profile");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/users/me/activity — update current page; optionally log special events to audit
// Also accepts POST as a fallback (some proxies block PATCH)
async function handleActivity(req: any, res: any) {
  try {
    const { page, event, details } = req.body;
    if (!page) return res.status(400).json({ error: "page required" });

    // Ensure user exists before updating activity
    let [existing] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.clerkUserId)).limit(1);
    if (!existing) {
      const clerkUser = await clerk.users.getUser(req.clerkUserId);
      const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
const name = getClerkDisplayName(clerkUser, email);

[existing] = await db.insert(usersTable).values({
  clerkId: req.clerkUserId,
        email,
        name,
        role: "user",
        status: "pending",
      }).returning();
    }

    const [user] = await db.update(usersTable)
      .set({ lastPage: page, lastPageAt: new Date() })
      .where(eq(usersTable.clerkId, req.clerkUserId))
      .returning();

    if (event && user) {
      const ip = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress;
      logAudit(user.id, user.email, user.name ?? "", event, details || page, ip);
    }

    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to update activity");
    return res.status(500).json({ error: "Internal server error" });
  }
}

router.patch("/me/activity", requireAuth, handleActivity);
router.post("/me/activity", requireAuth, handleActivity);

// PATCH /api/users/me/login
router.patch("/me/login", requireAuth, async (req: any, res) => {
  try {
    const [existingUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkId, req.clerkUserId))
      .limit(1);

    if (!existingUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const now = new Date();
    const lastLoginAt = existingUser.lastLoginAt
      ? new Date(existingUser.lastLoginAt)
      : null;

    const shouldLogLogin =
      !lastLoginAt ||
      now.getTime() - lastLoginAt.getTime() > 30 * 60 * 1000;

    const [user] = await db
      .update(usersTable)
      .set({ lastLoginAt: now })
      .where(eq(usersTable.id, existingUser.id))
      .returning();

    if (shouldLogLogin) {
      const ip =
        req.headers["x-forwarded-for"]?.toString() ||
        req.socket.remoteAddress;

      logAudit(user.id, user.email, user.name, "تسجيل دخول", undefined, ip);
    }

    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to update last login");
    return res.status(500).json({ error: "Internal server error" });
  }
});