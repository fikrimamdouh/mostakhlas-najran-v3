import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, sql, ne } from "drizzle-orm";
import { sendApprovalEmail, sendRejectionEmail } from "../lib/email";
import { logAudit } from "./audit";
import { requireAuth, clerk } from "../middleware/requireAuth";

const router = Router();

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

// GET /api/users/me
router.get("/me", requireAuth, async (req: any, res) => {
  try {
    const clerkUserId = req.clerkUserId;
    let [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkUserId)).limit(1);
if (user?.status === "deleted") {
  return res.status(403).json({
    error: "ACCOUNT_DELETED",
    message: "هذا الحساب محذوف أو غير مفعل. يرجى التواصل مع الإدارة.",
  });
}
    if (!user) {
      // clerk_id not found — fetch email from Clerk and try matching by email
      // (handles test→live Clerk migration where clerk_id changes for same email)
      const clerkUser = await clerk.users.getUser(clerkUserId);
      const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
      const name = `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() || "مستخدم جديد";

      // Try to find existing record by email
      const [byEmail] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
if (byEmail?.status === "deleted") {
  return res.status(403).json({
    error: "ACCOUNT_DELETED",
    message: "هذا الحساب محذوف أو غير مفعل. يرجى التواصل مع الإدارة.",
  });
}
      if (byEmail) {
        // Migrate: update stored clerk_id to the new live one
        req.log.info({ oldClerkId: byEmail.clerkId, newClerkId: clerkUserId, email }, "Migrating clerk_id for existing user");
        [user] = await db.update(usersTable)
          .set({ clerkId: clerkUserId })
          .where(eq(usersTable.id, byEmail.id))
          .returning();
      } else {
        // Genuinely new user
        [user] = await db.insert(usersTable).values({
          clerkId: clerkUserId,
          email,
          name,
          role: "user",
          status: "pending",
        }).returning();
      }
    }

    return res.json(user);
  } catch (err) {
    req.log.error({ err }, "Failed to get user");
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
      const name = `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() || "مستخدم جديد";
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

// GET /api/users - admin + supervisor (read-only for supervisor)
router.get("/", requireAuth, requireAdminOrSupervisor, async (req: any, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = db.select().from(usersTable) as any;
    let countQuery = db.select({ count: sql<number>`count(*)` }).from(usersTable) as any;

    if (status) {
      query = query.where(eq(usersTable.status, status as any));
      countQuery = countQuery.where(eq(usersTable.status, status as any));
    } else {
      query = query.where(ne(usersTable.status, "deleted" as any));
      countQuery = countQuery.where(ne(usersTable.status, "deleted" as any));
    }

    const users = await query.limit(Number(limit)).offset(offset);
    const [{ count }] = await countQuery;

    return res.json({
      users,
      total: Number(count),
      page: Number(page),
      limit: Number(limit),
    });
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
    const { role, contractCompany } = req.body;
    if (!["admin", "supervisor", "contract_supervisor", "viewer", "user"].includes(role)) return res.status(400).json({ error: "Invalid role" });
    const updates: Record<string, any> = { role };
    if (role === "contract_supervisor") {
      if (!contractCompany) return res.status(400).json({ error: "contractCompany required for contract_supervisor" });
      updates.contractCompany = contractCompany;
    } else {
      updates.contractCompany = null;
    }
    const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, Number(userId))).returning();
    if (!user) return res.status(404).json({ error: "User not found" });
    const ip = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress;
    const roleAr = role === "admin" ? "مدير النظام" : role === "supervisor" ? "مشرف" : role === "contract_supervisor" ? `مشرف عقد (${contractCompany})` : "مستخدم عادي";
    logAudit(req.currentUser.id, req.currentUser.email, req.currentUser.name, "تغيير صلاحية", `تغيير دور ${user.name} إلى ${roleAr}`, ip);
    return res.json(user);
  } catch (err) {
    req.log.error({ err }, "Failed to change role");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/users/company/:company — contract_supervisor: list users of their company
router.get("/company/:company", requireAuth, async (req: any, res) => {
  try {
    const role = req.currentUser.role;
    const { company } = req.params;
    // admin can query any; contract_supervisor only their own company
    if (role !== "admin" && role !== "supervisor") {
      if (role !== "contract_supervisor" || req.currentUser.contractCompany !== company) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }
    const { and, inArray } = await import("drizzle-orm");
    const COMPANY_SITES: Record<string, string[]> = {
      "بيت_العرب": [
        "مستشفى يدمة العام", "مستشفى حبونا العام", "مستشفى بدر الجنوب العام",
        "مستشفى الولادة والأطفال", "مستشفى نجران العام القديم وسكن الممرضات الخارجي",
        "المكاتب الإدارية والمرافق الصحية", "صيانة وإصلاح السيارات والعيادات المتنقلة",
      ],
      "سراكو": [
        "مستشفى نجران العام الجديد", "مركز طب الأسنان التخصصي", "مجمع الأمل للصحة النفسية",
        "مستشفى ثار العام", "مستشفى خباش العام", "المراكز الصحية",
        "مستشفى الملك خالد", "مركز الأمير سلطان", "مستشفى شروره العام",
      ],
    };
    const sites = COMPANY_SITES[company];
    if (!sites) return res.status(400).json({ error: "Unknown company" });
  const users = await db.select().from(usersTable)
  .where(and(
    inArray(usersTable.hospital, sites),
    ne(usersTable.status, "deleted" as any)
  ));
    return res.json({ users, total: users.length });
  } catch (err) {
    req.log.error({ err }, "Failed to list company users");
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
    return res.json(user);
  } catch (err) {
    req.log.error({ err }, "Failed to deactivate user");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/users/:userId/modules - admin only
router.patch("/:userId/modules", requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const { userId } = req.params;
    const { modules } = req.body; // string[] | null
    const allowedModules = modules === null ? null : JSON.stringify(modules);
    const [user] = await db.update(usersTable).set({ allowedModules }).where(eq(usersTable.id, Number(userId))).returning();
    if (!user) return res.status(404).json({ error: "User not found" });
    const ip = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress;
    logAudit(req.currentUser.id, req.currentUser.email, req.currentUser.name, "تعديل وحدات المستخدم", `وحدات ${user.name}: ${allowedModules || "الكل"}`, ip);
    return res.json(user);
  } catch (err) {
    req.log.error({ err }, "Failed to update modules");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/users/me/hospital — يجب أن يكون قبل /:userId/hospital حتى لا يُطابقه Express
router.patch("/me/hospital", requireAuth, async (req: any, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.clerkUserId)).limit(1);
    if (!user) return res.status(404).json({ error: "User not found" });
    const { hospital } = req.body;
    if (!hospital) return res.status(400).json({ error: "hospital required" });
    const allowed: string[] = user.hospitals ? JSON.parse(user.hospitals) : (user.hospital ? [user.hospital] : []);
    if (!allowed.includes(hospital) && user.role !== "admin") {
      return res.status(403).json({ error: "Not allowed for this hospital" });
    }
    const [updated] = await db.update(usersTable).set({ hospital }).where(eq(usersTable.id, user.id)).returning();
    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to switch hospital");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/users/:userId/hospital - admin only
router.patch("/:userId/hospital", requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const { userId } = req.params;
    const { hospital } = req.body;
    const [user] = await db.update(usersTable)
      .set({ hospital: hospital || null })
      .where(eq(usersTable.id, Number(userId)))
      .returning();
    if (!user) return res.status(404).json({ error: "User not found" });
    const ip = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress;
    logAudit(req.currentUser.id, req.currentUser.email, req.currentUser.name, "تغيير مستشفى", `تغيير مستشفى ${user.name} إلى: ${hospital || "بدون مستشفى"}`, ip);
    return res.json(user);
  } catch (err) {
    req.log.error({ err }, "Failed to update hospital");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/users/:userId/hospitals — admin assigns multiple hospitals to a user
router.patch("/:userId/hospitals", requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const { userId } = req.params;
    const { hospitals } = req.body as { hospitals: string[] };
    if (!Array.isArray(hospitals)) return res.status(400).json({ error: "hospitals must be array" });
    const hospitalsJson = hospitals.length > 0 ? JSON.stringify(hospitals) : null;
    const primary = hospitals[0] || null;
    const [user] = await db.update(usersTable)
      .set({ hospitals: hospitalsJson, hospital: primary })
      .where(eq(usersTable.id, Number(userId)))
      .returning();
    if (!user) return res.status(404).json({ error: "User not found" });
    const ip = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress;
    logAudit(req.currentUser.id, req.currentUser.email, req.currentUser.name, "تعيين مواقع متعددة", `مواقع ${user.name}: ${hospitals.join(" / ")}`, ip);
    return res.json(user);
  } catch (err) {
    req.log.error({ err }, "Failed to update hospitals");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/users/:userId - admin only — soft delete locally + delete from Clerk
router.delete("/:userId", requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const { userId } = req.params;
    const numericId = Number(userId);

    if (isNaN(numericId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, numericId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.clerkId === req.clerkUserId) {
      return res.status(403).json({ error: "لا يمكنك حذف حسابك أنت" });
    }

    // حذف/تعطيل المستخدم من Clerk إن كان موجودًا
    if (user.clerkId) {
      try {
        await clerk.users.deleteUser(user.clerkId);
      } catch (clerkErr: any) {
        req.log.warn(
          { clerkErr: clerkErr?.message, userId, clerkId: user.clerkId },
          "Clerk delete failed — continuing with local soft delete"
        );
      }
    }

    // Soft delete: لا نحذف الصف من DB حتى لا نكسر العلاقات
    const [updated] = await db
      .update(usersTable)
      .set({
        status: "deleted" as any,
      })
      .where(eq(usersTable.id, numericId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "User already deleted" });
    }

    const ip = req.headers["x-forwarded-for"]?.toString() || req.socket?.remoteAddress;

    logAudit(
      req.currentUser.id,
      req.currentUser.email,
      req.currentUser.name,
      "حذف مستخدم",
      `تم حذف ${user.name} (${user.email}) من شاشة المستخدمين وتعطيله من تسجيل الدخول`,
      ip
    );

    return res.json({ ok: true, deleted: user.name });
  } catch (err: any) {
    req.log.error({ err: err?.message, stack: err?.stack }, "Failed to delete user");
    return res.status(500).json({ error: "فشل حذف المستخدم", detail: err?.message });
  }
});

// POST /api/users/:userId/activate - admin only
router.post("/:userId/activate", requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const { userId } = req.params;
    const numericId = Number(userId);

    const [existing] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, numericId))
      .limit(1);

    if (!existing) return res.status(404).json({ error: "User not found" });

    if (existing.status === "deleted") {
      return res.status(400).json({ error: "لا يمكن تفعيل مستخدم محذوف" });
    }

    const [user] = await db
      .update(usersTable)
      .set({ status: "approved" })
      .where(eq(usersTable.id, numericId))
      .returning();

    const ip = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress;
    logAudit(
      req.currentUser.id,
      req.currentUser.email,
      req.currentUser.name,
      "تفعيل حساب",
      `تم تفعيل حساب ${user.name} (${user.email})`,
      ip
    );

    return res.json(user);
  } catch (err) {
    req.log.error({ err }, "Failed to activate user");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
