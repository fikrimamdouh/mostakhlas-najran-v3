import { Router } from "express";
import { db, usersTable, submittedExtractsTable } from "@workspace/db";
import { requireAuth } from "../middleware/requireAuth";
import { eq, sql, desc } from "drizzle-orm";

const router = Router();

const requireApproved = async (req: any, res: any, next: any) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.clerkUserId)).limit(1);
  if (!user) return res.status(401).json({ error: "User not registered" });
  if (user.status !== "approved" && user.role !== "admin") return res.status(403).json({ error: "Account pending" });
  req.currentUser = user;
  next();
};

// GET /api/analytics/summary — aggregate stats for submitted extracts
router.get("/summary", requireAuth, requireApproved, async (req: any, res) => {
  try {
    const role = req.currentUser.role;
    const isAdminOrSup = role === "admin" || role === "supervisor";

    // Total + by status
    const byStatus = await db.select({
      status: submittedExtractsTable.status,
      count: sql<number>`count(*)`,
      totalAmount: sql<number>`coalesce(sum(case when total_amount ~ '^[0-9.]+$' then total_amount::numeric else 0 end), 0)`,
    })
      .from(submittedExtractsTable)
      .groupBy(submittedExtractsTable.status);

    // By extract type
    const byType = await db.select({
      extractType: submittedExtractsTable.extractType,
      count: sql<number>`count(*)`,
      approved: sql<number>`count(*) filter (where status = 'approved')`,
      pending: sql<number>`count(*) filter (where status = 'submitted')`,
      totalAmount: sql<number>`coalesce(sum(case when status = 'approved' and total_amount ~ '^[0-9.]+$' then total_amount::numeric else 0 end), 0)`,
    })
      .from(submittedExtractsTable)
      .groupBy(submittedExtractsTable.extractType)
      .orderBy(sql`count(*) desc`);

    // By hospital (top 10)
    const byHospital = await db.select({
      hospitalName: submittedExtractsTable.hospitalName,
      count: sql<number>`count(*)`,
      approved: sql<number>`count(*) filter (where status = 'approved')`,
      totalAmount: sql<number>`coalesce(sum(case when status = 'approved' and total_amount ~ '^[0-9.]+$' then total_amount::numeric else 0 end), 0)`,
    })
      .from(submittedExtractsTable)
      .groupBy(submittedExtractsTable.hospitalName)
      .orderBy(sql`count(*) desc`)
      .limit(10);

    // By period (last 12 months of data)
    const byPeriod = await db.select({
      periodMonth: submittedExtractsTable.periodMonth,
      count: sql<number>`count(*)`,
      approved: sql<number>`count(*) filter (where status = 'approved')`,
      totalAmount: sql<number>`coalesce(sum(case when status = 'approved' and total_amount ~ '^[0-9.]+$' then total_amount::numeric else 0 end), 0)`,
    })
      .from(submittedExtractsTable)
      .groupBy(submittedExtractsTable.periodMonth)
      .orderBy(desc(submittedExtractsTable.periodMonth))
      .limit(12);

    // Approval rate
    const totalCount = byStatus.reduce((s, r) => s + Number(r.count), 0);
    const approvedCount = byStatus.find(r => r.status === "approved")?.count ?? 0;
    const approvalRate = totalCount > 0 ? Math.round((Number(approvedCount) / totalCount) * 100) : 0;

    // Average days to approval (approximation using updatedAt - createdAt for approved)
    const [avgDays] = await db.select({
      avgDays: sql<number>`coalesce(avg(extract(epoch from (updated_at - created_at)) / 86400.0) filter (where status = 'approved'), 0)`,
    }).from(submittedExtractsTable);

    return res.json({
      totals: {
        total: totalCount,
        approved: Number(approvedCount),
        approvalRate,
        avgDaysToApproval: Math.round(Number(avgDays.avgDays) * 10) / 10,
        totalApprovedAmount: byStatus.find(r => r.status === "approved") ? Number(byStatus.find(r => r.status === "approved")!.totalAmount) : 0,
      },
      byStatus: byStatus.map(r => ({ status: r.status, count: Number(r.count), totalAmount: Number(r.totalAmount) })),
      byType: byType.map(r => ({ extractType: r.extractType, count: Number(r.count), approved: Number(r.approved), pending: Number(r.pending), totalAmount: Number(r.totalAmount) })),
      byHospital: byHospital.map(r => ({ hospitalName: r.hospitalName, count: Number(r.count), approved: Number(r.approved), totalAmount: Number(r.totalAmount) })),
      byPeriod: byPeriod.map(r => ({ periodMonth: r.periodMonth, count: Number(r.count), approved: Number(r.approved), totalAmount: Number(r.totalAmount) })),
    });
  } catch (err) {
    req.log.error({ err }, "Analytics summary failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
