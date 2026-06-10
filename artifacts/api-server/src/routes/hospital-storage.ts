import { Router } from "express";
import { db, usersTable, hospitalStorageTable, systemSettingsTable, userStorageTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
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
const LEGACY_ATTENDANCE_KEYS = [
  "attendanceData",
  "ng_attendanceData",
  "nd_attendanceData",
  "centersAttendanceData_v2",
  "healthCentersAttendanceData",
  "adminOfficesAttendanceData_v1"
];

function normalizeKey(key: unknown): string {
  return String(key || "").replace(/^(_u\d+_)+/, "");
}

function parseMaybeJSON(value: unknown): any {
  if (value == null) return null;
  if (typeof value === "object") return value;
  try { return JSON.parse(String(value)); } catch { return value; }
}

function countContent(value: unknown): number {
  const v = parseMaybeJSON(value);
  if (v == null) return 0;
  if (typeof v === "string") return v.trim() ? 1 : 0;
  if (typeof v === "number") return Number.isFinite(v) && v !== 0 ? 1 : 0;
  if (Array.isArray(v)) return v.reduce((sum, item) => sum + countContent(item), v.length ? 1 : 0);
  if (typeof v === "object") {
    const keys = Object.keys(v);
    if (!keys.length) return 0;
    return keys.reduce((sum, key) => sum + countContent((v as any)[key]), keys.length ? 1 : 0);
  }
  return 0;
}

function getStoredHospitalFromRows(rows: any[]): string {
  const direct = rows.find(r => normalizeKey((r as any).storageKey) === "hospitalName");
  if (direct?.storageValue) {
    return String(direct.storageValue).trim();
  }

  const persistent = rows.find(r => normalizeKey((r as any).storageKey) === "persistentContractData");
  if (persistent?.storageValue) {
    try {
      const parsed = JSON.parse(String(persistent.storageValue));
      if (parsed?.hospitalName) return String(parsed.hospitalName).trim();
    } catch {}
  }

  const contract = rows.find(r => normalizeKey((r as any).storageKey) === "contractData");
  if (contract?.storageValue) {
    try {
      const parsed = JSON.parse(String(contract.storageValue));
      if (parsed?.hospitalName) return String(parsed.hospitalName).trim();
    } catch {}
  }

  return "";
}

async function backfillLegacyAttendanceFromUserStorage(hospitalName: string, result: Record<string, string>) {
  const missingKeys = LEGACY_ATTENDANCE_KEYS.filter(key => countContent(result[key]) <= 0);
  if (!missingKeys.length) return 0;

  const users = await db.select().from(usersTable).where(eq(usersTable.status, "approved"));
const eligibleUsers = users.filter(user => {
  const primaryHospital = String((user as any).hospital || "").trim();
  return primaryHospital === hospitalName;
});

  if (!eligibleUsers.length) return 0;

  const userIds = eligibleUsers
    .map(user => (user as any).id)
    .filter(id => Number.isFinite(Number(id)));

  if (!userIds.length) return 0;

  const rows = await db
    .select()
    .from(userStorageTable)
    .where(inArray(userStorageTable.userId, userIds));

 const rowsByUser = new Map<number, any[]>();

for (const row of rows) {
  const userId = Number((row as any).userId);
  if (!Number.isFinite(userId)) continue;
  if (!rowsByUser.has(userId)) rowsByUser.set(userId, []);
  rowsByUser.get(userId)!.push(row);
}

const bestByKey: Record<string, { value: string; score: number; userId: number }> = {};

for (const [userId, userRows] of rowsByUser.entries()) {
  const storedHospital = getStoredHospitalFromRows(userRows);

  if (storedHospital && storedHospital !== hospitalName) {
    continue;
  }

  for (const row of userRows) {
    const normalized = normalizeKey((row as any).storageKey);
    if (!missingKeys.includes(normalized)) continue;

    const value = String((row as any).storageValue ?? "");
    const score = countContent(value);
    if (score <= 0) continue;

    if (!bestByKey[normalized] || score > bestByKey[normalized].score) {
      bestByKey[normalized] = { value, score, userId };
    }
  }
}

  let migrated = 0;

  for (const [key, candidate] of Object.entries(bestByKey)) {
    if (countContent(result[key]) > 0) continue;

    await db.insert(hospitalStorageTable)
      .values({
        hospitalName,
        storageKey: key,
        storageValue: candidate.value,
        updatedAt: new Date(),
        updatedByUserId: candidate.userId,
      })
      .onConflictDoUpdate({
        target: [hospitalStorageTable.hospitalName, hospitalStorageTable.storageKey],
        set: {
          storageValue: candidate.value,
          updatedAt: new Date(),
          updatedByUserId: candidate.userId,
        },
      });

    result[key] = candidate.value;
    migrated++;
  }

  return migrated;
}
function requestedKeys(req: any): string[] | null {
  const scope = String(req.query?.scope || "").trim();
  if (scope === "settings") return SETTINGS_STORAGE_KEYS;
  return null;
}

function safeArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map(v => String(v || "").trim()).filter(Boolean)));
}

function reviewKeyForUser(userId: number) {
  return `review_permissions_user_${userId}`;
}

async function getReviewHospitals(userId: number): Promise<string[]> {
  const [row] = await db
    .select()
    .from(systemSettingsTable)
    .where(eq(systemSettingsTable.key, reviewKeyForUser(userId)))
    .limit(1);

  if (!row?.value) return [];

  try {
    const parsed = JSON.parse(row.value);
    return safeArray(parsed?.reviewHospitals);
  } catch {
    return [];
  }
}

function requestedHospital(req: any): string {
  return String(req.query?.hospital || "").trim();
}

async function resolveReadHospital(req: any, dbUser: any): Promise<{ hospital: string | null; reviewOnly: boolean; error?: string }> {
  const requested = requestedHospital(req);
  const ownHospital = String(dbUser.hospital || "").trim();

  if (!requested) {
    return { hospital: ownHospital || null, reviewOnly: false };
  }

  if (requested === ownHospital) {
    return { hospital: ownHospital || null, reviewOnly: false };
  }

  const reviewHospitals = await getReviewHospitals(dbUser.id);

  if (reviewHospitals.includes(requested)) {
    return { hospital: requested, reviewOnly: true };
  }

  return { hospital: null, reviewOnly: false, error: "Hospital not allowed" };
}

// GET /api/hospital-storage
// عادي: يرجع dbUser.hospital
// مراجعة: /api/hospital-storage?hospital=اسم_المستشفى ويرجعها فقط لو ضمن reviewHospitals
router.get("/", requireAuth, async (req: any, res) => {
  try {
    const dbUser = await getDbUser(req.clerkUserId);
    if (!dbUser || dbUser.status !== "approved") return res.status(403).json({ error: "Forbidden" });

    const resolved = await resolveReadHospital(req, dbUser);

    if (resolved.error) {
      return res.status(403).json({ error: resolved.error });
    }

    if (!resolved.hospital) {
      return res.json({ data: {}, count: 0, hospital: null, reviewOnly: false });
    }

    const keys = requestedKeys(req);
    const whereClause = keys
      ? and(eq(hospitalStorageTable.hospitalName, resolved.hospital), inArray(hospitalStorageTable.storageKey, keys))
      : eq(hospitalStorageTable.hospitalName, resolved.hospital);

    const rows = await db.select().from(hospitalStorageTable).where(whereClause);

    const result: Record<string, string> = {};
for (const row of rows) {
  result[row.storageKey] = row.storageValue;
}

const migratedLegacyAttendance = keys
  ? 0
  : await backfillLegacyAttendanceFromUserStorage(resolved.hospital, result);

return res.json({
  data: result,
  count: Object.keys(result).length,
  originalCount: rows.length,
  migratedLegacyAttendance,
  hospital: resolved.hospital,
  reviewOnly: resolved.reviewOnly,
  scope: keys ? "settings" : "all",
});
  } catch (err) {
    req.log.error({ err }, "Failed to get hospital storage");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/hospital-storage
// الرفع لا يسمح بالـ hospital query. يرفع فقط على dbUser.hospital.
router.put("/", requireAuth, async (req: any, res) => {
  try {
    const dbUser = await getDbUser(req.clerkUserId);
    if (!dbUser || dbUser.status !== "approved") return res.status(403).json({ error: "Forbidden" });

    if (requestedHospital(req)) {
      return res.status(403).json({ error: "Cannot write to requested review hospital" });
    }

    if (!dbUser.hospital?.trim()) {
      return res.json({ saved: 0, hospital: null });
    }

    const { data } = req.body as { data: Record<string, string> };
    if (!data || typeof data !== "object") return res.status(400).json({ error: "Invalid data" });

    const entries = Object.entries(data);
    if (entries.length === 0) return res.json({ saved: 0, hospital: dbUser.hospital });

    for (const [key, value] of entries) {
      await db.insert(hospitalStorageTable)
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

// GET /api/hospital-storage/info
router.get("/info", requireAuth, async (req: any, res) => {
  try {
    const dbUser = await getDbUser(req.clerkUserId);
    if (!dbUser || dbUser.status !== "approved") return res.status(403).json({ error: "Forbidden" });

    const resolved = await resolveReadHospital(req, dbUser);

    if (resolved.error) {
      return res.status(403).json({ error: resolved.error });
    }

    if (!resolved.hospital) {
      return res.json({ hospital: null, count: 0, reviewOnly: false });
    }

    const rows = await db
      .select({ id: hospitalStorageTable.id })
      .from(hospitalStorageTable)
      .where(eq(hospitalStorageTable.hospitalName, resolved.hospital));

    return res.json({
      hospital: resolved.hospital,
      count: rows.length,
      reviewOnly: resolved.reviewOnly,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get hospital storage info");
    return res.status(500).json({ error: "Internal server error" });
  }
});
// TEMP ADMIN CLEANUP — remove wrong attendance keys for a hospital
router.delete("/cleanup-attendance", requireAuth, async (req: any, res) => {
  try {
    const dbUser = await getDbUser(req.clerkUserId);
    if (!dbUser || dbUser.status !== "approved") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const role = String(dbUser.role || "").toLowerCase();
    if (!["admin", "super_admin", "administrator"].includes(role)) {
      return res.status(403).json({ error: "Admin only" });
    }

    const hospital = String(req.query?.hospital || "").trim();
    if (!hospital) {
      return res.status(400).json({ error: "Missing hospital" });
    }

    await db.delete(hospitalStorageTable).where(
      and(
        eq(hospitalStorageTable.hospitalName, hospital),
        inArray(hospitalStorageTable.storageKey, LEGACY_ATTENDANCE_KEYS)
      )
    );

    return res.json({
      ok: true,
      hospital,
      deletedKeys: LEGACY_ATTENDANCE_KEYS,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to cleanup attendance keys");
    return res.status(500).json({ error: "Internal server error" });
  }
});
export default router;
