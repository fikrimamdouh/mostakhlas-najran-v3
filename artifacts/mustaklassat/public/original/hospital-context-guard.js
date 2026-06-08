/**
 * hospital-context-guard.js
 * يمنع انتقال بقايا بيانات مستشفى إلى مستشفى أخرى عند تبديل الموقع لنفس المستخدم.
 * لا يمس الجلسة، ولا Clerk، ولا النسخ الاحتياطي.
 */
(function () {
  'use strict';

  const CONTEXT_KEY = 'najran_active_context_v1';

  const OPERATIONAL_KEYS = [
    'persistentContractData', 'persistentExtractData',
    'contractData', 'contractDetails', 'contractNumber', 'contractType',
    'contractStartDate', 'contractEndDate', 'contractSignatureData',
    'extractMonth', 'extractYear', 'extractNumber', 'extractStart', 'extractEnd',
    'extractFromDate', 'extractToDate',

    'attendanceData', 'ng_attendanceData', 'nd_attendanceData',
    'centersAttendanceData_v2', 'healthCentersAttendanceData',
    'adminOfficesAttendanceData_v1',

    'performanceData', 'performanceData_v4',
    'performanceDeductions', 'performanceTotalDeduction',
    'ng_performanceTotalDeduction', 'nd_performanceTotalDeduction',

    'achievementData', 'achievementTitles_v1',
    'achievementItemNames', 'nd_dentalAchievementTotals',

    'consumablesTableData', 'mainHospitalConsumables',
    'healthCentersConsumables', 'admin_offices_consumables_v1.0',
    'finalConsumablesCost',

    'subcontractors_data_consumables_v27',
    'performance_data_consumables_v27',
    'water_supply_data_consumables_v27',
    'sewage_disposal_data_consumables_v27',
    'summary_data_consumables_v27',

    'spare_partsData', 'sparePartsTotalAmount',

    'centerNames_v3', 'departmentNames', 'distributionSettings',
    'admin_staff', 'adminOfficeNames_v1',
    'adminOfficeAffiliations_v1',

    'hospitalName', 'companyName', 'directPurchaseRatio',
    'hospitalActivityStatus',

    'dynamicSignatures', 'contractorSignature',
    'performanceSignatures', 'performanceSignatures_v2',
    'performanceTableNames',

    'contract_foundation_data',

    'finalLaborCost',
    'grand-net-total',
    'grand-net-total-centers',
    'grand-net-total-admin',

    'najran_labor_attendance_done',
    'najran_labor_performance_done',
    'najran_health_attendance_done',
    'najran_admin_offices_attendance_done'
  ];

  const PREFIX_PATTERNS = [
    /^dept_/,
    /^deptCalculatedCost_/,
    /^tableData_/,
    /^sb_sigs_/,
    /^monthSnapshot_/,
    /^achievement_/,
    /^consumables_/,
    /^spare_/,
    /^water_/,
    /^sewage_/,
    /^subcontractors_/,
    /^performance_/
  ];

  function getSession() {
    try {
      return JSON.parse(localStorage.getItem('najran_session') || '{}') || {};
    } catch (_) {
      return {};
    }
  }

  function cleanText(v) {
    return String(v || '').trim();
  }

  function getCurrentContext() {
    const s = getSession();
    return {
      userId: cleanText(s.userId || s.id),
      email: cleanText(s.email).toLowerCase(),
      hospital: cleanText(s.hospital),
      company: cleanText(s.company || s.companyName)
    };
  }

  function sameUser(a, b) {
    if (!a || !b) return false;
    if (a.userId && b.userId && a.userId === b.userId) return true;
    if (a.email && b.email && a.email === b.email) return true;
    return false;
  }

  function shouldClearKey(key) {
    if (!key) return false;
    if (OPERATIONAL_KEYS.includes(key)) return true;
    return PREFIX_PATTERNS.some(re => re.test(key));
  }

  function saveEmergencySnapshot(prevContext) {
    try {
      const snap = {};
      Object.keys(localStorage).forEach(key => {
        if (shouldClearKey(key)) {
          snap[key] = localStorage.getItem(key);
        }
      });

      if (Object.keys(snap).length === 0) return;

      const safeHospital = cleanText(prevContext.hospital || 'unknown').replace(/\s+/g, '_');
      const key = 'contextSwitchBackup_' + safeHospital + '_' + new Date().toISOString();

      localStorage.setItem(key, JSON.stringify({
        previousContext: prevContext,
        savedAt: new Date().toISOString(),
        data: snap
      }));
    } catch (_) {}
  }

  function clearOperationalKeys() {
    try {
      const keys = [];
      Object.keys(localStorage).forEach(key => {
        if (shouldClearKey(key)) keys.push(key);
      });
      keys.forEach(key => localStorage.removeItem(key));
    } catch (_) {}
  }

  function runGuard() {
    const current = getCurrentContext();

    if (!current.userId && !current.email) return;
    if (!current.hospital) return;

    let previous = null;
    try {
      previous = JSON.parse(localStorage.getItem(CONTEXT_KEY) || 'null');
    } catch (_) {
      previous = null;
    }

    if (
      previous &&
      sameUser(previous, current) &&
      cleanText(previous.hospital) &&
      cleanText(previous.hospital) !== current.hospital
    ) {
      saveEmergencySnapshot(previous);
      clearOperationalKeys();

      console.warn(
        '[HospitalContextGuard] تم تغيير المستشفى لنفس المستخدم — تم مسح البيانات المحلية التشغيلية لمنع الخلط:',
        previous.hospital,
        '→',
        current.hospital
      );
    }

    localStorage.setItem(CONTEXT_KEY, JSON.stringify(current));
  }

  runGuard();
})();
