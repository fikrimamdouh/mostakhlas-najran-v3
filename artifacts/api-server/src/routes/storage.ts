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

function uniqueList(values: string[]): string[] {
  return Array.from(new Set(values.map(v => String(v || "").trim()).filter(Boolean)));
}

function pageFileFromReferrer(req: any): string {
  const ref = String(req.headers?.referer || req.headers?.referrer || "");
  if (!ref) return "";
  try {
    const url = new URL(ref);
    return url.pathname.split("/").pop() || "";
  } catch {
    return ref.split("?")[0].split("/").pop() || "";
  }
}

function inferredPageFilters(req: any): { keys: string[]; prefixes: string[]; scope: string } | null {
  const page = pageFileFromReferrer(req);
  if (page === "settings_main.html") return { keys: SETTINGS_STORAGE_KEYS, prefixes: [], scope: "settings-referrer" };
  const filter = PAGE_FILTERS[page];
  if (!filter) return null;
  return {
    keys: uniqueList(COMMON_PAGE_KEYS.concat(filter.keys || [])),
    prefixes: uniqueList(filter.prefixes || []),
    scope: `page:${page}`
  };
}

function requestedFilters(req: any): { keys: string[]; prefixes: string[]; scope: string } | null {
  const keys = parseCsvParam(req.query?.keys, 250);
  const prefixes = parseCsvParam(req.query?.prefixes, 80);
  if (keys.length || prefixes.length) return { keys, prefixes, scope: "filtered" };

  const scope = String(req.query?.scope || "").trim();
  if (scope === "settings") return { keys: SETTINGS_STORAGE_KEYS, prefixes: [], scope: "settings" };

  return inferredPageFilters(req);
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