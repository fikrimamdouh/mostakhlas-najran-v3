import { Router } from "express";
import { db, usersTable, hospitalStorageTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

const FOUNDATION_KEY = "contract_foundation_data";

const requireAdmin = async (req: any, res: any, next: any) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.clerkUserId)).limit(1);
  if (!user || user.role !== "admin") return res.status(403).json({ error: "Admin only" });
  req.currentUser = user;
  next();
};

// POST /api/admin/foundation — admin saves foundation data for a named hospital
// Body: { hospitalName, subcontractors: [...], consumables: [...] }
router.post("/", requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    const { hospitalName, subcontractors, consumables } = req.body as {
      hospitalName?: string;
      subcontractors?: unknown[];
      consumables?: unknown[];
    };

    if (!hospitalName?.trim()) {
      return res.status(400).json({ error: "hospitalName مطلوب" });
    }

    const rec = {
      hospitalName: hospitalName.trim(),
      subcontractors: subcontractors || [],
      consumables: consumables || [],
      savedAt: new Date().toISOString(),
      savedByAdmin: req.currentUser.email,
    };

    await db
      .insert(hospitalStorageTable)
      .values({
        hospitalName: hospitalName.trim(),
        storageKey: FOUNDATION_KEY,
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

    req.log.info(
      { hospitalName: hospitalName.trim(), sc: rec.subcontractors.length, co: rec.consumables.length, admin: req.currentUser.email },
      "Foundation data saved"
    );

    return res.json({
      ok: true,
      hospitalName: hospitalName.trim(),
      count: { subcontractors: rec.subcontractors.length, consumables: rec.consumables.length },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to save foundation data");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/foundation?hospital=<name> — get foundation data for a hospital (admin reads any, users read own)
router.get("/", requireAuth, async (req: any, res: any) => {
  try {
    const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.clerkUserId)).limit(1);
    if (!dbUser || dbUser.status !== "approved") return res.status(403).json({ error: "Forbidden" });

    // Admin can query any hospital; regular users are restricted to their own hospital
    let hospitalName: string;
    if (dbUser.role === "admin") {
      hospitalName = ((req.query["hospital"] as string) || "").trim();
      if (!hospitalName) return res.status(400).json({ error: "hospital query param required for admin" });
    } else {
      if (!dbUser.hospital?.trim()) return res.json({ hospitalName: null, subcontractors: [], consumables: [] });
      hospitalName = dbUser.hospital.trim();
    }

    const [row] = await db
      .select()
      .from(hospitalStorageTable)
      .where(eq(hospitalStorageTable.hospitalName, hospitalName))
      .limit(1);

    if (!row) return res.json({ hospitalName, subcontractors: [], consumables: [], savedAt: null });

    try {
      const parsed = JSON.parse(row.storageValue);
      return res.json(parsed);
    } catch {
      return res.json({ hospitalName, subcontractors: [], consumables: [], savedAt: null });
    }
  } catch (err) {
    req.log.error({ err }, "Failed to get foundation data");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/foundation/list — admin lists all hospitals that have foundation data
router.get("/list", requireAuth, async (req: any, res: any) => {
  try {
    const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.clerkUserId)).limit(1);
    if (!dbUser || dbUser.role !== "admin") return res.status(403).json({ error: "Admin only" });

    const rows = await db
      .select()
      .from(hospitalStorageTable)
      .where(eq(hospitalStorageTable.storageKey, FOUNDATION_KEY));

    const list = rows.map(r => {
      try {
        const parsed = JSON.parse(r.storageValue);
        return {
          hospitalName: r.hospitalName,
          subcontractorsCount: parsed.subcontractors?.length || 0,
          consumablesCount: parsed.consumables?.length || 0,
          savedAt: parsed.savedAt || null,
          savedByAdmin: parsed.savedByAdmin || null,
        };
      } catch {
        return { hospitalName: r.hospitalName, subcontractorsCount: 0, consumablesCount: 0, savedAt: null };
      }
    });

    return res.json({ list, total: list.length });
  } catch (err) {
    req.log.error({ err }, "Failed to list foundation data");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
