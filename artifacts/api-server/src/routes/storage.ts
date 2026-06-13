import { Router } from "express";
import { db, usersTable, userStorageTable } from "@workspace/db";
import { eq, and, inArray, or, like } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

const SETTINGS_STORAGE_KEYS = [
  "persistentContractData", "persistentExtractData",
  "contractData", "contractDetails", "contractNumber", "contractType",
  "contractStartDate", "contractEndDate", "contractSignatureData",
  "extractMonth", "extractYear", "extractNumber", "extractStart", "extractEnd",
  "extractFromDate", "extractToDate",
  "hospitalName", "companyName", "directPurchaseRatio",
  "settings_main", "settings_advanced",
  "dynamicSignatures", "contractorSignature", "appTitles_v1",
  "admin_staff", "contract_foundation_data"
];

const getDbUser = async (clerkId: string) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1);
  return user;
};

function parseCsvParam(value: unknown, maxItems: number): string[] {
  const raw = String(value || "").trim();
  if (!raw) return [];
  return Array.from(new Set(
    raw
      .split(",")
      .map(v => String(v || "").trim())
      .filter(Boolean)
  )).slice(0, maxItems);
}

function requestedFilters(req: any): { keys: string[]; prefixes: string[]; scope: string } | null {
  const keys = parseCsvParam(req.query?.keys, 250);
  const prefixes = parseCsvParam(req.query?.prefixes, 80);
  if (keys.length || prefixes.length) return { keys, prefixes, scope: "filtered" };

  const scope = String(req.query?.scope || "").trim();
  if (scope === "settings") return { keys: SETTINGS_STORAGE_KEYS, prefixes: [], scope: "settings" };

  return null;
}

function buildStorageKeyPredicate(column: any, filters: { keys: string[]; prefixes: string[] } | null) {
  if (!filters) return null;
  const clauses: any[] = [];
  if (filters.keys.length) clauses.push(inArray(column, filters.keys));
  for (const prefix of filters.prefixes) clauses.push(like(column, `${prefix}%`));
  if (!clauses.length) return null;
  return clauses.length === 1 ? clauses[0] : or(...clauses);
}

// GET /api/storage — get key-value pairs for current user
router.get("/", requireAuth, async (req: any, res) => {
  try {
    const dbUser = await getDbUser(req.clerkUserId);
    if (!dbUser || dbUser.status !== "approved") return res.status(403).json({ error: "Forbidden" });

    const filters = requestedFilters(req);
    const keyPredicate = buildStorageKeyPredicate(userStorageTable.storageKey, filters);
    const whereClause = keyPredicate
      ? and(eq(userStorageTable.userId, dbUser.id), keyPredicate)
      : eq(userStorageTable.userId, dbUser.id);

    const rows = await db.select().from(userStorageTable).where(whereClause);
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.storageKey] = row.storageValue;
    }
    return res.json({ data: result, count: rows.length, scope: filters ? filters.scope : "all" });
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