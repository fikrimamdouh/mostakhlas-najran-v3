export type StoragePageFilter = { keys: string[]; prefixes: string[] };

export const SETTINGS_STORAGE_KEYS = [
  "persistentContractData", "persistentExtractData",
  "contractData", "contractDetails", "contractNumber", "contractType",
  "contractStartDate", "contractEndDate", "contractSignatureData",
  "extractMonth", "extractYear", "extractNumber", "extractStart", "extractEnd",
  "extractFromDate", "extractToDate", "paymentNumber",
  "hospitalName", "companyName", "directPurchaseRatio",
  "settings_main", "settings_advanced",
  "dynamicSignatures", "contractorSignature", "appTitles_v1",
  "admin_staff", "contract_foundation_data",
];

export const SETTINGS_STORAGE_SET = new Set(SETTINGS_STORAGE_KEYS);

export const COMMON_PAGE_KEYS = [
  "persistentContractData", "persistentExtractData",
  "contractData", "contractDetails", "contractNumber", "contractType",
  "contractStartDate", "contractEndDate", "contractSignatureData",
  "extractMonth", "extractYear", "extractNumber", "extractStart", "extractEnd",
  "extractFromDate", "extractToDate", "paymentNumber",
  "hospitalName", "companyName", "directPurchaseRatio",
  "dynamicSignatures", "contractorSignature", "appTitles_v1",
  "hospitalActivityStatus", "hospitalActivityStatus_v2",
];

export const PAGE_FILTERS: Record<string, StoragePageFilter> = {
  "attendance.html": {
    keys: [
      "attendanceData", "ng_attendanceData", "nd_attendanceData",
      "centersAttendanceData_v2", "healthCentersAttendanceData", "adminOfficesAttendanceData_v1",
      "ng_departmentNames", "ng_distributionSettings", "ng_finalLaborCost", "ng_performanceTotalDeduction",
      "nd_departmentNames", "nd_distributionSettings", "nd_finalLaborCost", "nd_performanceTotalDeduction", "nd_dentalAchievementTotals",
      "centerNames_v3", "departmentNames", "distributionSettings",
      "najran_labor_attendance_done", "najran_labor_performance_done", "najran_health_attendance_done", "najran_admin_offices_attendance_done",
    ],
    prefixes: ["dept_", "deptCalculatedCost_", "najran_labor_", "najran_health_", "najran_admin_", "sb_sigs_", "sb_prefs_", "sb_style_prefs_"],
  },
  "performance.html": {
    keys: [
      "performanceData", "performanceData_v4", "performanceDeductions", "performanceTotalDeduction",
      "ng_performanceTotalDeduction", "nd_performanceTotalDeduction",
      "performanceSignatures", "performanceSignatures_v2", "performanceTableNames",
    ],
    prefixes: ["performance_", "dept_", "deptCalculatedCost_", "sb_sigs_", "sb_prefs_", "sb_style_prefs_"],
  },
  "achievement.html": {
    keys: ["achievementData", "achievementTitles_v1", "achievementItemNames", "nd_dentalAchievementTotals"],
    prefixes: ["achievement_", "sb_style_prefs_"],
  },
  "consumables.html": {
    keys: [
      "consumablesTableData", "healthCentersConsumables", "mainHospitalConsumables", "admin_offices_consumables_v1.0",
      "consumablesTitle", "consumablesPeriodFrom", "consumablesPeriodTo", "finalConsumablesCost", "penaltyValue",
      "subcontractors_data_consumables_v27", "performance_data_consumables_v27",
      "water_supply_data_consumables_v27", "sewage_disposal_data_consumables_v27",
      "summary_data_consumables_v27", "najranSignatureStyleSettings_v1",
    ],
    prefixes: ["consumables_", "water_", "sewage_", "subcontractors_", "tableData_", "sb_style_prefs_"],
  },
  "spare_parts.html": {
    keys: ["spare_partsData", "sparePartsTotalAmount"],
    prefixes: ["spare_"],
  },
  "health_centers_attendance.html": {
    keys: ["centerNames_v3", "centersAttendanceData_v2", "healthCentersAttendanceData", "najran_health_attendance_done"],
    prefixes: ["najran_health_", "dept_", "deptCalculatedCost_"],
  },
  "health_centers_consumables.html": {
    keys: ["healthCentersConsumables", "finalConsumablesCost"],
    prefixes: ["consumables_", "water_", "sewage_", "subcontractors_", "tableData_"],
  },
  "admin_offices_attendance.html": {
    keys: ["adminOfficeNames_v1", "adminOfficeAffiliations_v1", "adminOfficesAttendanceData_v1", "najran_admin_offices_attendance_done", "najranSignatureStyleSettings_v1"],
    prefixes: ["najran_admin_", "dept_", "deptCalculatedCost_"],
  },
  "admin_offices_consumables.html": {
    keys: ["admin_offices_consumables_v1.0", "finalConsumablesCost", "najranSignatureStyleSettings_v1"],
    prefixes: ["consumables_", "water_", "sewage_", "subcontractors_", "tableData_"],
  },
};

export function uniqueStorageList(values: string[]): string[] {
  return Array.from(new Set(values.map(value => String(value || "").trim()).filter(Boolean)));
}
