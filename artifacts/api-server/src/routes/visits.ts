import { Router } from "express";
import { db, usersTable, visitRequestsTable } from "@workspace/db";
import { requireAuth } from "../middleware/requireAuth";
import { eq, desc, and } from "drizzle-orm";

const router = Router();

const requireApproved = async (req: any, res: any, next: any) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.clerkUserId)).limit(1);
  if (!user) return res.status(401).json({ error: "User not registered" });
  if (user.status !== "approved" && user.role !== "admin") {
    return res.status(403).json({ error: "Account pending approval" });
  }
  (req as any).currentUser = user;
  next();
};

const requireAdmin = async (req: any, res: any, next: any) => {
  if ((req as any).currentUser?.role !== "admin") {
    return res.status(403).json({ error: "Admin required" });
  }
  next();
};

// POST /api/visits — submit a new visit request
router.post("/", requireAuth, requireApproved, async (req: any, res) => {
  const user = req.currentUser;
  const { repName, siteLocation, repId, visitDate, repMobile, systemName, mainContractor, subContractor, repIdPhoto } = req.body;
  if (!repName || !siteLocation || !repId || !visitDate || !repMobile || !systemName || !mainContractor || !subContractor) {
    return res.status(400).json({ error: "جميع الحقول المطلوبة يجب تعبئتها" });
  }
  const [inserted] = await db.insert(visitRequestsTable).values({
    userId: user.id,
    repName,
    siteLocation,
    repId,
    visitDate,
    repMobile,
    systemName,
    mainContractor,
    subContractor,
    repIdPhoto: repIdPhoto || null,
    status: "pending",
    submittedByName: user.name,
    submittedByHospital: user.hospital || null,
  }).returning();
  return res.status(201).json({ visit: inserted });
});

// GET /api/visits — list visit requests (own for user, all for admin)
router.get("/", requireAuth, requireApproved, async (req: any, res) => {
  const user = req.currentUser;
  let rows;
  if (user.role === "admin" || user.role === "supervisor") {
    rows = await db.select().from(visitRequestsTable).orderBy(desc(visitRequestsTable.createdAt));
  } else {
    rows = await db.select().from(visitRequestsTable)
      .where(eq(visitRequestsTable.userId, user.id))
      .orderBy(desc(visitRequestsTable.createdAt));
  }
  return res.json({ visits: rows });
});

// PATCH /api/visits/:id/status — admin approve/reject
router.patch("/:id/status", requireAuth, requireApproved, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const { status, adminNotes } = req.body;
  if (!["approved", "rejected", "pending"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  const [updated] = await db.update(visitRequestsTable)
    .set({ status, adminNotes: adminNotes || null, updatedAt: new Date() })
    .where(eq(visitRequestsTable.id, id))
    .returning();
  if (!updated) return res.status(404).json({ error: "Visit request not found" });
  return res.json({ visit: updated });
});

export default router;
