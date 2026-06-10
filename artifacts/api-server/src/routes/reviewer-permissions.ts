import { Router } from "express";
import { db, usersTable, systemSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { logAudit } from "./audit";

const router = Router();

type ReviewPermissionPayload = {
  permissions: string[];
  reviewHospitals: string[];
};

const DEFAULT_PAYLOAD: ReviewPermissionPayload = {
  permissions: [],
  reviewHospitals: [],
};

function keyForUser(userId: number) {
  return `review_permissions_user_${userId}`;
}

function safeArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map(v => String(v || "").trim()).filter(Boolean)));
}

function parsePayload(value?: string | null): ReviewPermissionPayload {
  if (!value) return { ...DEFAULT_PAYLOAD };
  try {
    const parsed = JSON.parse(value);
    return {
      permissions: safeArray(parsed?.permissions),
      reviewHospitals: safeArray(parsed?.reviewHospitals),
    };
  } catch {
    return { ...DEFAULT_PAYLOAD };
  }
}

async function readPayload(userId: number): Promise<ReviewPermissionPayload> {
  const [row] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, keyForUser(userId))).limit(1);
  return parsePayload(row?.value);
}

async function writePayload(userId: number, payload: ReviewPermissionPayload, updatedBy?: string | null) {
  const key = keyForUser(userId);
  const value = JSON.stringify({
    permissions: safeArray(payload.permissions),
    reviewHospitals: safeArray(payload.reviewHospitals),
  });
  const [existing] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, key)).limit(1);
  if (existing) {
    await db.update(systemSettingsTable).set({ value, updatedAt: new Date(), updatedBy: updatedBy || null }).where(eq(systemSettingsTable.key, key));
  } else {
    await db.insert(systemSettingsTable).values({ key, value, updatedBy: updatedBy || null });
  }
  return parsePayload(value);
}

async function getCurrentUser(req: any) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.clerkUserId)).limit(1);
  return user;
}

async function requireAdmin(req: any, res: any, next: any) {
  try {
    const user = await getCurrentUser(req);
    if (!user || user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    req.currentUser = user;
    next();
  } catch (err) {
    req.log?.error?.({ err }, "reviewer-permissions requireAdmin failed");
    return res.status(500).json({ error: "Internal server error" });
  }
}

function parseUserHospitals(user: any): string[] {
  const fromHospital = user?.hospital ? [String(user.hospital).trim()] : [];
  try {
    const parsed = user?.hospitals ? JSON.parse(user.hospitals) : [];
    return safeArray([...fromHospital, ...(Array.isArray(parsed) ? parsed : [])]);
  } catch {
    return safeArray(fromHospital);
  }
}

function isAdminLike(role: string) {
  const r = String(role || "").toLowerCase();
  return r === "admin" || r === "viewer";
}

function buildEffective(user: any, payload: ReviewPermissionPayload) {
  const hospital = String(user?.hospital || "").trim();
  const editHospitals = parseUserHospitals(user);
  const reviewHospitals = safeArray(payload.reviewHospitals);
  const permissions = safeArray(payload.permissions);
  const canReviewCurrentHospital = permissions.includes("review_extract") && !!hospital && reviewHospitals.includes(hospital);
  const canEditCurrentHospital = !isAdminLike(user?.role) && !!hospital && editHospitals.includes(hospital);
  return {
    permissions,
    reviewHospitals,
    canReviewCurrentHospital,
    canEditCurrentHospital,
    reviewOnly: canReviewCurrentHospital && !canEditCurrentHospital,
  };
}

router.get("/me", requireAuth, async (req: any, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user || user.status !== "approved") return res.status(403).json({ error: "Forbidden" });
    const payload = await readPayload(user.id);
    return res.json({ userId: user.id, ...buildEffective(user, payload) });
  } catch (err) {
    req.log?.error?.({ err }, "Failed to get reviewer permissions for me");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:userId", requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId)) return res.status(400).json({ error: "Invalid userId" });
    const [target] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!target) return res.status(404).json({ error: "User not found" });
    const payload = await readPayload(userId);
    return res.json({ userId, ...payload });
  } catch (err) {
    req.log?.error?.({ err }, "Failed to get reviewer permissions");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:userId", requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId)) return res.status(400).json({ error: "Invalid userId" });
    const [target] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!target) return res.status(404).json({ error: "User not found" });
    const payload = await writePayload(userId, {
      permissions: safeArray(req.body?.permissions),
      reviewHospitals: safeArray(req.body?.reviewHospitals),
    }, req.currentUser?.email || null);
    const ip = req.headers["x-forwarded-for"]?.toString() || req.socket?.remoteAddress;
    logAudit(req.currentUser.id, req.currentUser.email, req.currentUser.name, "تعديل صلاحيات المراجعة", `صلاحيات ${target.name}: ${payload.permissions.join(",") || "بدون"} | مستشفيات مراجعة: ${payload.reviewHospitals.join(" / ") || "لا يوجد"}`, ip);
    return res.json({ userId, ...payload });
  } catch (err) {
    req.log?.error?.({ err }, "Failed to save reviewer permissions");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
