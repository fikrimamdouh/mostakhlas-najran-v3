import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, extractsTable, projectsTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

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

// GET /api/extracts
router.get("/", requireAuth, async (req: any, res) => {
  try {
    const { status, projectId, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const conditions: any[] = [];
    if (status) conditions.push(eq(extractsTable.status, status as "completed" | "current" | "previous"));
    if (projectId) conditions.push(eq(extractsTable.projectId, Number(projectId)));

    const baseQuery = db
      .select({
        id: extractsTable.id,
        extractNumber: extractsTable.extractNumber,
        projectId: extractsTable.projectId,
        projectName: projectsTable.name,
        status: extractsTable.status,
        amount: extractsTable.amount,
        description: extractsTable.description,
        submittedBy: extractsTable.submittedBy,
        submittedAt: extractsTable.submittedAt,
        approvedBy: extractsTable.approvedBy,
        approvedAt: extractsTable.approvedAt,
        notes: extractsTable.notes,
        createdAt: extractsTable.createdAt,
      })
      .from(extractsTable)
      .leftJoin(projectsTable, eq(extractsTable.projectId, projectsTable.id));

    let query = conditions.length > 0 ? (baseQuery.where as any)(...conditions) : baseQuery;
    const extracts = await query.limit(Number(limit)).offset(offset).orderBy(extractsTable.createdAt);

    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(extractsTable);

    return res.json({ extracts, total: Number(count), page: Number(page), limit: Number(limit) });
  } catch (err) {
    req.log.error({ err }, "Failed to list extracts");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/extracts
router.post("/", requireAuth, async (req: any, res) => {
  try {
    const { extractNumber, projectId, status, amount, description, notes, submittedAt } = req.body;

    if (!extractNumber || !projectId || !status || amount === undefined) {
      return res.status(400).json({ error: "extractNumber, projectId, status, amount are required" });
    }

    const [extract] = await db.insert(extractsTable).values({
      extractNumber,
      projectId: Number(projectId),
      status,
      amount: String(amount),
      description: description || null,
      notes: notes || null,
      submittedBy: req.currentUser.name,
      submittedAt: submittedAt ? new Date(submittedAt) : new Date(),
    }).returning();

    return res.status(201).json(extract);
  } catch (err) {
    req.log.error({ err }, "Failed to create extract");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/extracts/:extractId
router.get("/:extractId", requireAuth, async (req: any, res) => {
  try {
    const [extract] = await db
      .select({
        id: extractsTable.id,
        extractNumber: extractsTable.extractNumber,
        projectId: extractsTable.projectId,
        projectName: projectsTable.name,
        status: extractsTable.status,
        amount: extractsTable.amount,
        description: extractsTable.description,
        submittedBy: extractsTable.submittedBy,
        submittedAt: extractsTable.submittedAt,
        approvedBy: extractsTable.approvedBy,
        approvedAt: extractsTable.approvedAt,
        notes: extractsTable.notes,
        createdAt: extractsTable.createdAt,
      })
      .from(extractsTable)
      .leftJoin(projectsTable, eq(extractsTable.projectId, projectsTable.id))
      .where(eq(extractsTable.id, Number(req.params.extractId)))
      .limit(1);

    if (!extract) return res.status(404).json({ error: "Extract not found" });
    return res.json(extract);
  } catch (err) {
    req.log.error({ err }, "Failed to get extract");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/extracts/:extractId
router.put("/:extractId", requireAuth, async (req: any, res) => {
  try {
    const { status, amount, description, notes, approvedAt } = req.body;
    const updates: any = {};

    if (status !== undefined) updates.status = status;
    if (amount !== undefined) updates.amount = String(amount);
    if (description !== undefined) updates.description = description;
    if (notes !== undefined) updates.notes = notes;
    if (approvedAt !== undefined) {
      updates.approvedAt = new Date(approvedAt);
      updates.approvedBy = req.currentUser.name;
    }

    const [extract] = await db.update(extractsTable)
      .set(updates)
      .where(eq(extractsTable.id, Number(req.params.extractId)))
      .returning();

    if (!extract) return res.status(404).json({ error: "Extract not found" });
    return res.json(extract);
  } catch (err) {
    req.log.error({ err }, "Failed to update extract");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/extracts/:extractId
router.delete("/:extractId", requireAuth, async (req: any, res) => {
  try {
    await db.delete(extractsTable).where(eq(extractsTable.id, Number(req.params.extractId)));
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete extract");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
