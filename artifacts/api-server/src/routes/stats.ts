import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, extractsTable, projectsTable, usersTable } from "@workspace/db";
import { eq, sql, sum } from "drizzle-orm";

const router = Router();

const requireAuth = async (req: any, res: any, next: any) => {
  const auth = getAuth(req);
  if (!auth?.userId) return res.status(401).json({ error: "Unauthorized" });
  req.clerkUserId = auth.userId;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, auth.userId)).limit(1);
  if (!user) return res.status(401).json({ error: "User not registered" });
  if (user.status !== "approved" && user.role !== "admin") {
    return res.status(403).json({ error: "Account pending approval" });
  }
  req.currentUser = user;
  next();
};

// GET /api/stats/dashboard
router.get("/dashboard", requireAuth, async (req: any, res) => {
  try {
    const [counts] = await db.select({
      totalExtracts: sql<number>`count(*)`,
      currentExtracts: sql<number>`count(*) filter (where status = 'current')`,
      completedExtracts: sql<number>`count(*) filter (where status = 'completed')`,
      previousExtracts: sql<number>`count(*) filter (where status = 'previous')`,
      totalAmount: sql<number>`coalesce(sum(amount::numeric), 0)`,
      currentAmount: sql<number>`coalesce(sum(amount::numeric) filter (where status = 'current'), 0)`,
    }).from(extractsTable);

    const [projectCounts] = await db.select({
      totalProjects: sql<number>`count(*)`,
      activeProjects: sql<number>`count(*) filter (where status = 'active')`,
    }).from(projectsTable);

    const [userCounts] = await db.select({
      pendingUsers: sql<number>`count(*) filter (where status = 'pending')`,
    }).from(usersTable);

    return res.json({
      totalExtracts: Number(counts.totalExtracts),
      currentExtracts: Number(counts.currentExtracts),
      completedExtracts: Number(counts.completedExtracts),
      previousExtracts: Number(counts.previousExtracts),
      totalAmount: Number(counts.totalAmount),
      currentAmount: Number(counts.currentAmount),
      totalProjects: Number(projectCounts.totalProjects),
      activeProjects: Number(projectCounts.activeProjects),
      pendingUsers: Number(userCounts.pendingUsers),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get dashboard stats");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/stats/extracts-by-status
router.get("/extracts-by-status", requireAuth, async (req: any, res) => {
  try {
    const data = await db.select({
      status: extractsTable.status,
      count: sql<number>`count(*)`,
      amount: sql<number>`coalesce(sum(amount::numeric), 0)`,
    })
      .from(extractsTable)
      .groupBy(extractsTable.status);

    return res.json(data.map(row => ({
      status: row.status,
      count: Number(row.count),
      amount: Number(row.amount),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get extracts by status");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/stats/recent-activity
router.get("/recent-activity", requireAuth, async (req: any, res) => {
  try {
    const extracts = await db
      .select({
        id: extractsTable.id,
        extractNumber: extractsTable.extractNumber,
        projectName: projectsTable.name,
        status: extractsTable.status,
        amount: extractsTable.amount,
        createdAt: extractsTable.createdAt,
      })
      .from(extractsTable)
      .leftJoin(projectsTable, eq(extractsTable.projectId, projectsTable.id))
      .orderBy(sql`${extractsTable.createdAt} desc`)
      .limit(10);

    return res.json(extracts.map(e => ({
      id: e.id,
      extractNumber: e.extractNumber,
      projectName: e.projectName,
      status: e.status,
      amount: Number(e.amount),
      action: "تم إنشاء مستخلص",
      timestamp: e.createdAt,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get recent activity");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
