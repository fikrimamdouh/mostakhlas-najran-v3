import { Router } from "express";
import { db, usersTable, hospitalStorageTable, systemSettingsTable } from "@workspace/db";
import { eq, and, inArray, or, like } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

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
    keys: ["attendanceData", "ng_attendanceData", "nd_attendanceData", "centersAttendanceData_v2", "healthCentersAttendanceData", "adminOfficesAttendanceData_v1", "ng_departmentNames", "ng_distributionSettings", "ng_finalLaborCost", "ng_performanceTotalDeduction", "nd_departmentNames", "nd_distributionSettings", "nd_finalLaborCost", "nd_performanceTotalDeduction", "nd_dentalAchievementTotals", "centerNames_v3", "departmentNames", "distributionSettings", "najran_labor_attendance_done", "najran_labor_performance_done", "najran_health_attendance_done", "najran_admin_offices_attendance_done"],
    prefixes: ["dept_", "deptCalculatedCost_", "najran_labor_", "najran_health_", "najran_admin_", "sb_sigs_", "sb_prefs_"]
  },
  "performance.html": {
    keys: ["performanceData", "performanceData_v4", "performanceDeductions", "performanceTotalDeduction", "ng_performanceTotalDeduction", "nd_performanceTotalDeduction", "performanceSignatures", "performanceSignatures_v2", "performanceTableNames"],
    prefixes: ["performance_", "dept_", "deptCalculatedCost_", "sb_sigs_", "sb_prefs_"]
  },
  "achievement.html": {
    keys: ["achievementData", "achievementTitles_v1", "achievementItemNames", "nd_dentalAchievementTotals"],
    prefixes: ["achievement_"]
  },
  "consumables.html": {
    keys: ["consumablesTableData", "healthCentersConsumables", "mainHospitalConsumables", "admin_offices_consumables_v1.0", "consumablesTitle", "consumablesPeriodFrom", "consumablesPeriodTo", "finalConsumablesCost", "penaltyValue", "subcontractors_data_consumables_v27", "performance_data_consumables_v27", "water_supply_data_consumables_v27", "sewage_disposal_data_consumables_v27", "summary_data_consumables_v27"],
    prefixes: ["consumables_", "water_", "sewage_", "subcontractors_", "tableData_"]
  },
  "spare_parts.html": { keys: ["spare_partsData", "sparePartsTotalAmount"], prefixes: ["spare_"] },
  "health_centers_attendance.html": { keys: ["centerNames_v3", "centersAttendanceData_v2", "healthCentersAttendanceData", "najran_health_attendance_done"], prefixes: ["najran_health_", "dept_", "deptCalculatedCost_"] },
  "health_centers_consumables.html": { keys: ["healthCentersConsumables", "finalConsumablesCost"], prefixes: ["consumables_", "water_", "sewage_", "subcontractors_", "tableData_"] },
  "admin_offices_attendance.html": { keys: ["adminOfficeNames_v1", "adminOfficeAffiliations_v1", "adminOfficesAttendanceData_v1", "najran_admin_offices_attendance_done"], prefixes: ["najran_admin_", "dept_", "deptCalculatedCost_"] },
  "admin_offices_consumables.html": { keys: ["admin_offices_consumables_v1.0", "finalConsumablesCost"], prefixes: ["consumables_", "water_", "sewage_", "subcontractors_", "tableData_"] }
};

function parseCsv(value: unknown, maxItems: number): string[] {
  const raw = String(value || "").trim();
  if (!raw) return [];
  return Array.from(new Set(raw.split(",").map(v => v.trim()).filter(Boolean))).slice(0, maxItems);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map(v => String(v || "").trim()).filter(Boolean)));
}

function pageFromReferrer(req: any): string {
  const ref = String(req.headers?.referer || req.headers?.referrer || "");
  if (!ref) return "";
  try { return new URL(ref).pathname.split("/").pop() || ""; }
  catch { return ref.split("?")[0].split("/").pop() || ""; }
}

function filtersFromRequest(req: any): { keys: string[]; prefixes: string[]; scope: string } | null {
  const keys = parseCsv(req.query?.keys, 250);
  const prefixes = parseCsv(req.query?.prefixes, 80);
  if (keys.length || prefixes.length) return { keys, prefixes, scope: "filtered" };

  const page = pageFromReferrer(req);
  const pageFilter = PAGE_FILTERS[page];
  if (!pageFilter) return null;

  return {
    keys: unique(COMMON_PAGE_KEYS.concat(pageFilter.keys || [])),
    prefixes: unique(pageFilter.prefixes || []),
    scope: `page:${page}`
  };
}

function keyPredicate(column: any, filters: { keys: string[]; prefixes: string[] }) {
  const clauses: any[] = [];
  if (filters.keys.length) clauses.push(inArray(column, filters.keys));
  for (const prefix of filters.prefixes) clauses.push(like(column, `${prefix}%`));
  return clauses.length === 1 ? clauses[0] : or(...clauses);
}

function safeArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map(v => String(v || "").trim()).filter(Boolean)));
}

async function reviewHospitalsForUser(userId: number): Promise<string[]> {
  const [row] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, `review_permissions_user_${userId}`)).limit(1);
  if (!row?.value) return [];
  try { return safeArray(JSON.parse(row.value)?.reviewHospitals); } catch { return []; }
}

async function resolveHospital(req: any, dbUser: any) {
  const requested = String(req.query?.hospital || "").trim();
  const ownHospital = String(dbUser.hospital || "").trim();
  if (!requested || requested === ownHospital) return { hospital: ownHospital || null, reviewOnly: false };
  const reviewHospitals = await reviewHospitalsForUser(dbUser.id);
  if (reviewHospitals.includes(requested)) return { hospital: requested, reviewOnly: true };
  return { hospital: null, reviewOnly: false, error: "Hospital not allowed" };
}

router.get("/", requireAuth, async (req: any, res, next) => {
  try {
    const filters = filtersFromRequest(req);
    if (!filters) return next();

    const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.clerkUserId)).limit(1);
    if (!dbUser || dbUser.status !== "approved") return res.status(403).json({ error: "Forbidden" });

    const resolved = await resolveHospital(req, dbUser);
    if (resolved.error) return res.status(403).json({ error: resolved.error });
    if (!resolved.hospital) return res.json({ data: {}, count: 0, hospital: null, reviewOnly: false, scope: filters.scope });

    const rows = await db.select().from(hospitalStorageTable).where(and(
      eq(hospitalStorageTable.hospitalName, resolved.hospital),
      keyPredicate(hospitalStorageTable.storageKey, filters)
    ));

    const data: Record<string, string> = {};
    for (const row of rows) data[row.storageKey] = row.storageValue;

    return res.json({
      data,
      count: Object.keys(data).length,
      originalCount: rows.length,
      migratedLegacyAttendance: 0,
      hospital: resolved.hospital,
      reviewOnly: resolved.reviewOnly,
      scope: filters.scope
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get filtered hospital storage");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
