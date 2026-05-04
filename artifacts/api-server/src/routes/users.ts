import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { sendApprovalEmail, sendRejectionEmail } from "../lib/email";

const router = Router();

// Middleware: require authenticated user
const requireAuth = (req: any, res: any, next: any) => {
  const auth = getAuth(req);
  if (!auth?.userId) return res.status(401).json({ error: "Unauthorized" });
  req.clerkUserId = auth.userId;
  next();
};

// Middleware: require admin role
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

// GET /api/users/me
router.get("/me", requireAuth, async (req: any, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.clerkUserId)).limit(1);
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(user);
  } catch (err) {
    req.log.error({ err }, "Failed to get user");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/users - admin only
router.get("/", requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = db.select().from(usersTable);
    if (status) {
      query = query.where(eq(usersTable.status, status as string)) as any;
    }

    const users = await (query as any).limit(Number(limit)).offset(offset);
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
    const [user] = await db.update(usersTable)
      .set({ status: "approved" })
      .where(eq(usersTable.id, Number(userId)))
      .returning();

    if (!user) return res.status(404).json({ error: "User not found" });

    sendApprovalEmail(user.email, user.name).catch(() => {});

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
    const [user] = await db.update(usersTable)
      .set({ status: "rejected" })
      .where(eq(usersTable.id, Number(userId)))
      .returning();

    if (!user) return res.status(404).json({ error: "User not found" });

    sendRejectionEmail(user.email, user.name).catch(() => {});

    return res.json(user);
  } catch (err) {
    req.log.error({ err }, "Failed to reject user");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
