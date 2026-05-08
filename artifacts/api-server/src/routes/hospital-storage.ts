import { Router } from "express";
import { db, usersTable, hospitalStorageTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

const getDbUser = async (clerkId: string) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1);
  return user;
};

// GET /api/hospital-storage — get all shared keys for this user's hospital
router.get("/", requireAuth, async (req: any, res) => {
  try {
    const dbUser = await getDbUser(req.clerkUserId);
    if (!dbUser || dbUser.status !== "approved") return res.status(403).json({ error: "Forbidden" });

    // Users without a hospital name cannot use hospital-level storage
    if (!dbUser.hospital?.trim()) {
      return res.json({ data: {}, count: 0, hospital: null });
    }

    const rows = await db
      .select()
      .from(hospitalStorageTable)
      .where(eq(hospitalStorageTable.hospitalName, dbUser.hospital));

    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.storageKey] = row.storageValue;
    }

    return res.json({ data: result, count: rows.length, hospital: dbUser.hospital });
  } catch (err) {
    req.log.error({ err }, "Failed to get hospital storage");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/hospital-storage — batch upsert shared keys for this user's hospital
router.put("/", requireAuth, async (req: any, res) => {
  try {
    const dbUser = await getDbUser(req.clerkUserId);
    if (!dbUser || dbUser.status !== "approved") return res.status(403).json({ error: "Forbidden" });

    if (!dbUser.hospital?.trim()) {
      return res.json({ saved: 0, hospital: null });
    }

    const { data } = req.body as { data: Record<string, string> };
    if (!data || typeof data !== "object") return res.status(400).json({ error: "Invalid data" });

    const entries = Object.entries(data);
    if (entries.length === 0) return res.json({ saved: 0, hospital: dbUser.hospital });

    for (const [key, value] of entries) {
      await db
        .insert(hospitalStorageTable)
        .values({
          hospitalName: dbUser.hospital,
          storageKey: key,
          storageValue: String(value),
          updatedAt: new Date(),
          updatedByUserId: dbUser.id,
        })
        .onConflictDoUpdate({
          target: [hospitalStorageTable.hospitalName, hospitalStorageTable.storageKey],
          set: {
            storageValue: String(value),
            updatedAt: new Date(),
            updatedByUserId: dbUser.id,
          },
        });
    }

    return res.json({ saved: entries.length, hospital: dbUser.hospital });
  } catch (err) {
    req.log.error({ err }, "Failed to save hospital storage");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/hospital-storage/info — quick info about hospital storage count (for admin/debug)
router.get("/info", requireAuth, async (req: any, res) => {
  try {
    const dbUser = await getDbUser(req.clerkUserId);
    if (!dbUser || dbUser.status !== "approved") return res.status(403).json({ error: "Forbidden" });
    if (!dbUser.hospital?.trim()) return res.json({ hospital: null, count: 0 });

    const rows = await db
      .select({ id: hospitalStorageTable.id })
      .from(hospitalStorageTable)
      .where(eq(hospitalStorageTable.hospitalName, dbUser.hospital));

    return res.json({ hospital: dbUser.hospital, count: rows.length });
  } catch (err) {
    req.log.error({ err }, "Failed to get hospital storage info");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
