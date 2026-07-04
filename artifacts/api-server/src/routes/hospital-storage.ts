import { Router } from "express";
import { db, usersTable, hospitalStorageTable, systemSettingsTable, userStorageTable } from "@workspace/db";
import { eq, and, inArray, or, like, notLike, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

const SETTINGS_STORAGE_KEYS = [
  "persistentContractData", "persistentExtractData",
  "contractData", "contractDetails", "contractNumber", "contractType",
  "contractStartDate", "contractEndDate", "contractSignatureData",
  "extractMonth", "extractYear", "extractNumber", "extractStart", "extractEnd",
  "extractFromDate", "extractToDate", "paymentNumber",
  "hospitalName", "companyName", "directPurchaseRatio",
  "settings_main", "settings_advanced",
  "dynamicSignatures", "contractorSignature", "appTitles_v1",
  "admin_staff", "contract_foundation_data"
];

const SETTINGS_STORAGE_SET = new Set(SETTINGS_STORAGE_KEYS);

const COMMON_PAGE_KEYS = [
  "persistentContractData", "persistentExtractData",
  "contractData", "contractDetails", "contractNumber", "contractType",
  "contractStartDate", "contractEndDate", "contractSignatureData",
  "extractMonth", "extractYear", "extractNumber", "extractStart", "extractEnd",
  "extractFromDate", "extractToDate", "paymentNumber",
  "hospitalName", "companyName", "directPurchaseRatio",
  "dynamicSignatures", "contractorSignature", "appTitles_v1",
  "hospitalActivityStatus", "hospitalActivityStatus_v2"
];

const PAGE_FILTERS: Record<string, { keys: string[]; prefixes: string[] }> = {
  "attendance.html": {
    keys: [
      "attendanceData", "ng_attendanceData", "nd_attendanceData",
      "centersAttendanceData_v2", "healthCentersAttendanceData", "adminOfficesAttendanceData_v1",
      "ng_departmentNames", "ng_distributionSettings", "ng_finalLaborCost", "ng_performanceTotalDeduction",
      "nd_departmentNames", "nd_distributionSettings", "nd_finalLaborCost", "nd_performanceTotalDeduction", "nd_dentalAchievementTotals",
      "centerNames_v3", "departmentNames", "distributionSettings",
      "najran_labor_attendance_done", "najran_labor_performance_done", "najran_health_attendance_done", "najran_admin_offices_attendance_done"
    ],
    prefixes: ["dept_", "deptCalculatedCost_", "najran_labor_", "najran_health_", "najran_admin_", "sb_sigs_", "sb_prefs_"]
  },

  "performance.html": {
    keys: [
      "performanceData", "performanceData_v4", "performanceDeductions", "performanceTotalDeduction",
      "ng_performanceTotalDeduction", "nd_performanceTotalDeduction",
      "performanceSignatures", "performanceSignatures_v2", "performanceTableNames"
    ],
    prefixes: ["performance_", "dept_", "deptCalculatedCost_", "sb_sigs_", "sb_prefs_"]
  },

  "achievement.html": {
    keys: ["achievementData", "achievementTitles_v1", "achievementItemNames", "nd_dentalAchievementTotals"],
    prefixes: ["achievement_"]
  },

  "consumables.html": {
    keys: [
      "consumablesTableData", "healthCentersConsumables", "mainHospitalConsumables", "admin_offices_consumables_v1.0",
      "consumablesTitle", "consumablesPeriodFrom", "consumablesPeriodTo", "finalConsumablesCost", "penaltyValue",
      "subcontractors_data_consumables_v27", "performance_data_consumables_v27",
      "water_supply_data_consumables_v27", "sewage_disposal_data_consumables_v27",
      "summary_data_consumables_v27"
    ],
    prefixes: ["consumables_", "water_", "sewage_", "subcontractors_", "tableData_"]
  },

  "spare_parts.html": {
    keys: ["spare_partsData", "sparePartsTotalAmount"],
    prefixes: ["spare_"]
  },

  "health_centers_attendance.html": {
    keys: ["centerNames_v3", "centersAttendanceData_v2", "healthCentersAttendanceData", "najran_health_attendance_done"],
    prefixes: ["najran_health_", "dept_", "deptCalculatedCost_"]
  },

  "health_centers_consumables.html": {
    keys: ["healthCentersConsumables", "finalConsumablesCost"],
    prefixes: ["consumables_", "water_", "sewage_", "subcontractors_", "tableData_"]
  },

  "admin_offices_attendance.html": {
    keys: ["adminOfficeNames_v1", "adminOfficeAffiliations_v1", "adminOfficesAttendanceData_v1", "najran_admin_offices_attendance_done"],
    prefixes: ["najran_admin_", "dept_", "deptCalculatedCost_"]
  },

  "admin_offices_consumables.html": {
    keys: ["admin_offices_consumables_v1.0", "finalConsumablesCost"],
    prefixes: ["consumables_", "water_", "sewage_", "subcontractors_", "tableData_"]
  }
};

function uniqueList(values: string[]): string[] {
  return Array.from(new Set(values.map(v => String(v || "").trim()).filter(Boolean)));
}

const EXTRACT_CTX_PREFIX = "__extractCtx::";

function sanitizeExtractContextKey(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw
    .replace(/\s+/g, "_")
    .replace(/[^\p{L}\p{N}_\-.]/gu, "_")
    .slice(0, 140);
}

function requestedExtractContext(req: any): string {
  return sanitizeExtractContextKey(req.query?.extractContextKey || req.query?.extractKey || req.body?.extractContextKey || req.body?.extractKey || "");
}

function isContextScopedKey(key: unknown): boolean {
  return String(key || "").startsWith(EXTRACT_CTX_PREFIX);
}

function scopedStorageKey(contextKey: string, key: string): string {
  const normalized = normalizeKey(key);
  if (!contextKey || SETTINGS_STORAGE_SET.has(normalized)) return normalized;
  if (isContextScopedKey(normalized)) return normalized;
  return `${EXTRACT_CTX_PREFIX}${contextKey}::${normalized}`;
}

function unscopedFromContextKey(storageKey: string, contextKey: string): { key: string; matchesContext: boolean; isScoped: boolean } {
  const key = String(storageKey || "");
  if (!isContextScopedKey(key)) return { key, matchesContext: false, isScoped: false };
  const prefix = `${EXTRACT_CTX_PREFIX}${contextKey}::`;
  if (contextKey && key.startsWith(prefix)) return { key: key.slice(prefix.length), matchesContext: true, isScoped: true };
  return { key, matchesContext: false, isScoped: true };
}

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

  if (storedHospital !== hospitalName) {
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

// (مدمج من hospital-storage-filtered.ts — أصبح هذا الملف المسؤول الوحيد عن كل الفلترة)
function pageFromReferrer(req: any): string {
  const ref = String(req.headers?.referer || req.headers?.referrer || "");
  if (!ref) return "";
  try { return new URL(ref).pathname.split("/").pop() || ""; }
  catch { return ref.split("?")[0].split("/").pop() || ""; }
}

function requestedFilters(req: any): { keys: string[]; prefixes: string[]; scope: string } | null {
  const keys = parseCsvParam(req.query?.keys, 250);
  const prefixes = parseCsvParam(req.query?.prefixes, 80);
  if (keys.length || prefixes.length) return { keys, prefixes, scope: "filtered" };

  const scope = String(req.query?.scope || "").trim();
  if (scope === "settings") {
    return { keys: SETTINGS_STORAGE_KEYS, prefixes: [], scope: "settings" };
  }

  // query.page صراحةً أولًا، ثم referrer كما كان في الراوتر المصفّى سابقًا.
  const page = (String(req.query?.page || "").trim().split("/").pop() || "") || pageFromReferrer(req);
  const pageFilter = PAGE_FILTERS[page];

  if (pageFilter) {
    return {
      keys: uniqueList(COMMON_PAGE_KEYS.concat(pageFilter.keys || [])),
      prefixes: uniqueList(pageFilter.prefixes || []),
      scope: `page:${page}`
    };
  }

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

    const filters = requestedFilters(req);
    const contextKey = requestedExtractContext(req);
    let keyPredicate: any = null;
    if (contextKey) {
      // تصفية السياق في قاعدة البيانات: صفوف هذا السياق + الصفوف غير المسيّجة فقط.
      // صفوف السياقات الأخرى (الغالبية عند تراكم المستخلصات) لا تُجلب أصلًا.
      keyPredicate = or(
        like(hospitalStorageTable.storageKey, `${EXTRACT_CTX_PREFIX}${contextKey}::%`),
        notLike(hospitalStorageTable.storageKey, `${EXTRACT_CTX_PREFIX}%`)
      );
    } else {
      keyPredicate = buildStorageKeyPredicate(hospitalStorageTable.storageKey, filters);
    }
    const whereClause = keyPredicate
      ? and(eq(hospitalStorageTable.hospitalName, resolved.hospital), keyPredicate)
      : eq(hospitalStorageTable.hospitalName, resolved.hospital);

    const rows = await db.select().from(hospitalStorageTable).where(whereClause);

    const result: Record<string, string> = {};
    // metadata النسخ لكل مفتاح (باسمه المُرجَع للواجهة) — أساس كشف تعارض الكتابة.
    const meta: Record<string, { version: number; updatedAt: string | null }> = {};
    const putMeta = (name: string, row: any) => {
      meta[name] = { version: Number(row.version ?? 1), updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null };
    };
for (const row of rows) {
  const rawKey = String(row.storageKey || "");
  const ctx = unscopedFromContextKey(rawKey, contextKey);
  if (ctx.isScoped && !ctx.matchesContext) continue;
  if (!ctx.isScoped) {
    const normalized = normalizeKey(ctx.key);
    if (contextKey && SETTINGS_STORAGE_SET.has(normalized)) { result[normalized] = row.storageValue; putMeta(normalized, row); }
    else if (!contextKey) { result[normalized] = row.storageValue; putMeta(normalized, row); }
    else if (result[normalized] == null) { result[normalized] = row.storageValue; putMeta(normalized, row); }
    continue;
  }
  const scopedName = normalizeKey(ctx.key);
  result[scopedName] = row.storageValue;
  putMeta(scopedName, row);
}

const migratedLegacyAttendance = 0;

return res.json({
  data: result,
  meta,
  count: Object.keys(result).length,
  originalCount: rows.length,
  migratedLegacyAttendance,
  hospital: resolved.hospital,
  reviewOnly: resolved.reviewOnly,
  extractContextKey: contextKey || null,
  scope: filters ? filters.scope : "all",
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

    const contextKey = requestedExtractContext(req);
    const entries = Object.entries(data);
    if (entries.length === 0) return res.json({ saved: 0, hospital: dbUser.hospital, extractContextKey: contextKey || null });

    // البند السادس: كشف تعارض «آخر كاتب يكسب».
    // العميل يرسل versions اختياريًا: { [keyName]: expectedVersion }
    // أو expectedUpdatedAt: { [keyName]: ISO timestamp }.
    // أي مفتاح مُرسَل بنسخة متوقعة لا تطابق النسخة الحالية في القاعدة → 409 بلا أي كتابة
    // (الدفعة كلها تُرفض ذريًا حتى لا يختلط قديم بجديد)، ولا تُستبدل بيانات الجهاز الآخر.
    // المفاتيح بدون نسخة متوقعة (عملاء قدامى) تُكتب كما كان — لا كسر للعقد الحالي.
    const expectedVersions: Record<string, number> = {};
    const rawVersions = (req.body && (req.body.versions || req.body.expectedVersions)) || {};
    if (rawVersions && typeof rawVersions === "object") {
      for (const [k, v] of Object.entries(rawVersions)) {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) expectedVersions[String(k)] = n;
      }
    }
    const expectedUpdatedAt: Record<string, number> = {};
    const rawUpdatedAt = (req.body && req.body.expectedUpdatedAt) || {};
    if (rawUpdatedAt && typeof rawUpdatedAt === "object") {
      for (const [k, v] of Object.entries(rawUpdatedAt)) {
        const t = Date.parse(String(v));
        if (Number.isFinite(t)) expectedUpdatedAt[String(k)] = t;
      }
    }

    const storageKeysToWrite = entries.map(([key]) => scopedStorageKey(contextKey, key));
    const checkedNames = entries
      .map(([key], i) => ({ name: key, storageKey: storageKeysToWrite[i] }))
      .filter(e => expectedVersions[e.name] != null || expectedUpdatedAt[e.name] != null);

    if (checkedNames.length) {
      const currentRows = await db
        .select({ storageKey: hospitalStorageTable.storageKey, version: hospitalStorageTable.version, updatedAt: hospitalStorageTable.updatedAt, updatedByUserId: hospitalStorageTable.updatedByUserId })
        .from(hospitalStorageTable)
        .where(and(
          eq(hospitalStorageTable.hospitalName, dbUser.hospital),
          inArray(hospitalStorageTable.storageKey, checkedNames.map(e => e.storageKey))
        ));
      const currentByKey = new Map(currentRows.map(r => [String(r.storageKey), r]));
      const conflicts: Array<{ key: string; currentVersion: number; currentUpdatedAt: string | null; expectedVersion?: number }> = [];
      for (const e of checkedNames) {
        const current = currentByKey.get(e.storageKey);
        if (!current) continue; // المفتاح غير موجود بعد — الكتابة الأولى آمنة.
        const curVersion = Number(current.version ?? 1);
        const curUpdated = current.updatedAt ? new Date(current.updatedAt).getTime() : 0;
        const expV = expectedVersions[e.name];
        const expT = expectedUpdatedAt[e.name];
        const versionMismatch = expV != null && expV !== curVersion;
        const timeMismatch = expT != null && Math.abs(curUpdated - expT) > 1500;
        if (versionMismatch || (expV == null && timeMismatch)) {
          conflicts.push({ key: e.name, currentVersion: curVersion, currentUpdatedAt: current.updatedAt ? new Date(current.updatedAt).toISOString() : null, expectedVersion: expV });
        }
      }
      if (conflicts.length) {
        req.log.warn({ hospital: dbUser.hospital, conflicts: conflicts.map(c => c.key) }, "hospital-storage write conflict (409)");
        return res.status(409).json({
          error: "تم تعديل هذه البيانات من جهاز آخر بعد آخر تحميل لديك. لم يتم استبدال أي بيانات. حدّث الصفحة لسحب أحدث نسخة ثم أعد الحفظ.",
          conflict: true,
          conflicts,
          hospital: dbUser.hospital,
        });
      }
    }

    for (let i = 0; i < entries.length; i++) {
      const [, value] = entries[i];
      const storageKey = storageKeysToWrite[i];
      await db.insert(hospitalStorageTable)
        .values({
          hospitalName: dbUser.hospital,
          storageKey,
          storageValue: String(value),
          version: 1,
          updatedAt: new Date(),
          updatedByUserId: dbUser.id,
        })
        .onConflictDoUpdate({
          target: [hospitalStorageTable.hospitalName, hospitalStorageTable.storageKey],
          set: {
            storageValue: String(value),
            version: sql`${hospitalStorageTable.version} + 1`,
            updatedAt: new Date(),
            updatedByUserId: dbUser.id,
          },
        });
    }

    // إرجاع النسخ الجديدة (باسم المفتاح كما أرسله العميل) حتى يحدّث خريطته ولا يقع في 409 كاذب لاحقًا.
    const writtenRows = await db
      .select({ storageKey: hospitalStorageTable.storageKey, version: hospitalStorageTable.version })
      .from(hospitalStorageTable)
      .where(and(eq(hospitalStorageTable.hospitalName, dbUser.hospital), inArray(hospitalStorageTable.storageKey, storageKeysToWrite)));
    const versionByStorageKey = new Map(writtenRows.map(r => [String(r.storageKey), Number(r.version ?? 1)]));
    const newVersions: Record<string, number> = {};
    for (let i = 0; i < entries.length; i++) {
      const v = versionByStorageKey.get(storageKeysToWrite[i]);
      if (v != null) newVersions[entries[i][0]] = v;
    }

    return res.json({ saved: entries.length, versions: newVersions, hospital: dbUser.hospital, extractContextKey: contextKey || null });
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
    if (resolved.error) return res.status(403).json({ error: resolved.error });
    if (!resolved.hospital) return res.json({ hospital: null, count: 0, reviewOnly: false });

    const rows = await db.select().from(hospitalStorageTable).where(eq(hospitalStorageTable.hospitalName, resolved.hospital));

    return res.json({
      hospital: resolved.hospital,
      count: rows.length,
      reviewOnly: resolved.reviewOnly,
      updatedAt: rows.reduce((latest, row: any) => {
        const t = row.updatedAt ? new Date(row.updatedAt).getTime() : 0;
        return t > latest ? t : latest;
      }, 0)
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get hospital storage info");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
