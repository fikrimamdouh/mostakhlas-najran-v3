import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { findCurrentUser } from "../lib/current-user";

const router = Router();

const DISABLED_REVIEW_PERMISSIONS = {
  permissions: [] as string[],
  reviewHospitals: [] as string[],
  canReviewCurrentHospital: false,
  reviewOnly: false,
};

function canEditCurrentHospital(user: any) {
  return String(user?.role || "user").toLowerCase() !== "viewer";
}

async function requireAdmin(req: any, res: any, next: any) {
  try {
    const user = await findCurrentUser(req);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    req.currentUser = user;
    next();
  } catch (err) {
    req.log?.error?.({ err }, "reviewer-permissions requireAdmin failed");
    return res.status(500).json({ error: "Internal server error" });
  }
}

router.get("/me", requireAuth, async (req: any, res) => {
  try {
    const user = await findCurrentUser(req);
    if (!user || user.status !== "approved") {
      return res.status(403).json({ error: "Forbidden" });
    }

    return res.json({
      userId: user.id,
      ...DISABLED_REVIEW_PERMISSIONS,
      canEditCurrentHospital: canEditCurrentHospital(user),
    });
  } catch (err) {
    req.log?.error?.({ err }, "Failed to get disabled reviewer permissions for me");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:userId", requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId)) {
      return res.status(400).json({ error: "Invalid userId" });
    }

    const [target] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!target) return res.status(404).json({ error: "User not found" });

    return res.json({
      userId,
      permissions: [],
      reviewHospitals: [],
    });
  } catch (err) {
    req.log?.error?.({ err }, "Failed to get disabled reviewer permissions");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:userId", requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId)) {
      return res.status(400).json({ error: "Invalid userId" });
    }

    const [target] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!target) return res.status(404).json({ error: "User not found" });

    return res.json({
      userId,
      permissions: [],
      reviewHospitals: [],
      disabled: true,
    });
  } catch (err) {
    req.log?.error?.({ err }, "Failed to confirm disabled reviewer permissions");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
