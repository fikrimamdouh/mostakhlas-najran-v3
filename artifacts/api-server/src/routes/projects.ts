import { Router } from "express";
import { db, projectsTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

const requireApproved = async (req: any, res: any, next: any) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.clerkUserId)).limit(1);
  if (!user) return res.status(401).json({ error: "User not registered" });
  if (user.status !== "approved" && user.role !== "admin") {
    return res.status(403).json({ error: "Account pending approval" });
  }
  req.currentUser = user;
  next();
};

// GET /api/projects
router.get("/", requireAuth, requireApproved, async (req: any, res) => {
  try {
    const projects = await db.select().from(projectsTable).orderBy(projectsTable.createdAt);
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(projectsTable);
    return res.json({ projects, total: Number(count) });
  } catch (err) {
    req.log.error({ err }, "Failed to list projects");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/projects
router.post("/", requireAuth, requireApproved, async (req: any, res) => {
  try {
    const { name, description, location, contractValue, startDate, endDate } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });

    const [project] = await db.insert(projectsTable).values({
      name,
      description: description || null,
      location: location || null,
      contractValue: contractValue ? String(contractValue) : null,
      startDate: startDate || null,
      endDate: endDate || null,
      status: "active",
    }).returning();

    return res.status(201).json(project);
  } catch (err) {
    req.log.error({ err }, "Failed to create project");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/projects/:projectId
router.get("/:projectId", requireAuth, requireApproved, async (req: any, res) => {
  try {
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, Number(req.params.projectId))).limit(1);
    if (!project) return res.status(404).json({ error: "Project not found" });
    return res.json(project);
  } catch (err) {
    req.log.error({ err }, "Failed to get project");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
