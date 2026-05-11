/**
 * admin-job-positions.ts — حفظ وجلب مناصب الوظائف من السيرفر
 * POST /api/admin/job-positions           — حفظ مناصب مستشفى
 * GET  /api/admin/job-positions?hospital= — جلب مناصب مستشفى
 * GET  /api/admin/job-positions/list      — قائمة جميع المستشفيات
 * DELETE /api/admin/job-positions?hospital= — حذف مستشفى
 */
import { Router } from "express";
import { db, usersTable, hospitalStorageTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();
const JOB_KEY = "job_positions_data";

const requireAdmin = async (req: any, res: any, next: any) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.clerkUserId)).limit(1);
  if (!user || user.role !== "admin") return res.status(403).json({ error: "Admin only" });
  req.currentUser = user;
  next();
};

// POST /api/admin/job-positions — حفظ/تحديث مناصب مستشفى
router.post("/", requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    const { hospitalName, rows } = req.body as { hospitalName?: string; rows?: unknown[] };
    if (!hospitalName?.trim()) return res.status(400).json({ error: "hospitalName مطلوب" });
    if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: "rows مطلوب" });

    const rec = {
      hospitalName: hospitalName.trim(),
      rows,
      savedAt: new Date().toISOString(),
      savedByAdmin: req.currentUser.email,
    };

    await db.insert(hospitalStorageTable)
      .values({
        hospitalName: hospitalName.trim(),
        storageKey: JOB_KEY,
        storageValue: JSON.stringify(rec),
        updatedAt: new Date(),
        updatedByUserId: req.currentUser.id,
      })
      .onConflictDoUpdate({
        target: [hospitalStorageTable.hospitalName, hospitalStorageTable.storageKey],
        set: {
          storageValue: JSON.stringify(rec),
          updatedAt: new Date(),
          updatedByUserId: req.currentUser.id,
        },
      });

    req.log.info({ hospital: hospitalName.trim(), count: rows.length, admin: req.currentUser.email }, "Job positions saved");
    return res.json({ ok: true, hospitalName: hospitalName.trim(), count: rows.length });
  } catch (err) {
    req.log.error({ err }, "Failed to save job positions");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/job-positions?hospital=<name>
router.get("/", requireAuth, async (req: any, res: any) => {
  try {
    const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.clerkUserId)).limit(1);
    if (!dbUser || dbUser.status !== "approved") return res.status(403).json({ error: "Forbidden" });

    let hospitalName: string;
    if (dbUser.role === "admin") {
      hospitalName = ((req.query["hospital"] as string) || "").trim();
      if (!hospitalName) return res.status(400).json({ error: "hospital query param required" });
    } else {
      if (!dbUser.hospital?.trim()) return res.json({ hospitalName: null, rows: [] });
      hospitalName = dbUser.hospital.trim();
    }

    const [row] = await db.select().from(hospitalStorageTable)
      .where(and(eq(hospitalStorageTable.hospitalName, hospitalName), eq(hospitalStorageTable.storageKey, JOB_KEY)))
      .limit(1);

    if (!row) return res.json({ hospitalName, rows: [], savedAt: null });
    try {
      return res.json(JSON.parse(row.storageValue));
    } catch {
      return res.json({ hospitalName, rows: [], savedAt: null });
    }
  } catch (err) {
    req.log.error({ err }, "Failed to get job positions");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/job-positions/list
router.get("/list", requireAuth, async (req: any, res: any) => {
  try {
    const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.clerkUserId)).limit(1);
    if (!dbUser || dbUser.role !== "admin") return res.status(403).json({ error: "Admin only" });

    const rows = await db.select().from(hospitalStorageTable)
      .where(eq(hospitalStorageTable.storageKey, JOB_KEY));

    const list = rows.map(r => {
      try {
        const parsed = JSON.parse(r.storageValue);
        const totalCost = (parsed.rows || []).reduce((s: number, x: any) => s + (x.salary || 0), 0);
        return {
          hospitalName: r.hospitalName,
          count: parsed.rows?.length || 0,
          totalCost,
          savedAt: parsed.savedAt || null,
          savedByAdmin: parsed.savedByAdmin || null,
        };
      } catch {
        return { hospitalName: r.hospitalName, count: 0, totalCost: 0, savedAt: null };
      }
    });

    return res.json({ list, total: list.length });
  } catch (err) {
    req.log.error({ err }, "Failed to list job positions");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/admin/job-positions?hospital=<name>
router.delete("/", requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    const hospitalName = ((req.query["hospital"] as string) || "").trim();
    if (!hospitalName) return res.status(400).json({ error: "hospital query param required" });

    await db.delete(hospitalStorageTable)
      .where(and(eq(hospitalStorageTable.hospitalName, hospitalName), eq(hospitalStorageTable.storageKey, JOB_KEY)));

    req.log.info({ hospital: hospitalName, admin: req.currentUser.email }, "Job positions deleted");
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete job positions");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
