import { Router } from "express";
import { db, usersTable, userStorageTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

const getDbUser = async (clerkId: string) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1);
  return user;
};

// GET /api/storage — get all key-value pairs for current user
router.get("/", requireAuth, async (req: any, res) => {
  try {
    const dbUser = await getDbUser(req.clerkUserId);
    if (!dbUser || dbUser.status !== "approved") return res.status(403).json({ error: "Forbidden" });

    const rows = await db.select().from(userStorageTable).where(eq(userStorageTable.userId, dbUser.id));
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.storageKey] = row.storageValue;
    }
    return res.json({ data: result, count: rows.length });
  } catch (err) {
    req.log.error({ err }, "Failed to get user storage");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/storage — batch upsert key-value pairs
router.put("/", requireAuth, async (req: any, res) => {
  try {
    const dbUser = await getDbUser(req.clerkUserId);
    if (!dbUser || dbUser.status !== "approved") return res.status(403).json({ error: "Forbidden" });

    const { data } = req.body as { data: Record<string, string> };
    if (!data || typeof data !== "object") return res.status(400).json({ error: "Invalid data" });

    const entries = Object.entries(data);
    if (entries.length === 0) return res.json({ saved: 0 });

    // Upsert each key
    for (const [key, value] of entries) {
      await db.insert(userStorageTable)
        .values({ userId: dbUser.id, storageKey: key, storageValue: String(value), updatedAt: new Date() })
        .onConflictDoUpdate({
          target: [userStorageTable.userId, userStorageTable.storageKey],
          set: { storageValue: String(value), updatedAt: new Date() },
        });
    }

    return res.json({ saved: entries.length });
  } catch (err) {
    req.log.error({ err }, "Failed to save user storage");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/storage/:key — delete a single key
router.delete("/:key", requireAuth, async (req: any, res) => {
  try {
    const dbUser = await getDbUser(req.clerkUserId);
    if (!dbUser || dbUser.status !== "approved") return res.status(403).json({ error: "Forbidden" });

    await db.delete(userStorageTable).where(
      and(eq(userStorageTable.userId, dbUser.id), eq(userStorageTable.storageKey, req.params.key))
    );
    return res.json({ deleted: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete storage key");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
