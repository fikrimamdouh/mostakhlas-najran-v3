/**
 * month-context.js — نظام عزل البيانات بين الشهور
 * يحفظ snapshot كامل لكل شهر ويتيح التبديل بينها دون فقدان أي بيانات
 */
(function () {
  'use strict';

  const MONTH_DATA_KEYS = [
    'attendanceData',
    'performanceData', 'performanceSignatures', 'performanceTableNames', 'performanceTotalDeduction',
    'achievementItemNames', 'dentalLaborCheckboxState', 'dentalLaborData',
    'accreditationLetterData', 'adminJobsPrintState',
    'consumablesPeriodFrom', 'consumablesPeriodTo', 'consumablesTitle', 'consumablesTableData',
    'sparePartsTotalAmount',
    'centersAttendanceData_v2', 'performanceData_v4', 'performanceDeductions',
    'healthCentersConsumables', 'mainHospitalConsumables',
    'najran_labor_attendance_done', 'najran_labor_performance_done',
    'najran_health_attendance_done',
    'grand-net-total', 'finalLaborCost',
    'distributionSettings', 'dynamicSignatures',
  ];

  const DYNAMIC_PREFIXES = ['deptCalculatedCost_', 'dept_'];

  function getCurrentMonthKey() {
    try {
      const ed = JSON.parse(localStorage.getItem('persistentExtractData') || '{}');
      const month = (ed.extractMonth || '').trim();
      const year = (ed.extractYear || new Date().getFullYear());
      if (!month) return null;
      return `${year}_${month}`;
    } catch { return null; }
  }

  function getDynamicKeys() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && DYNAMIC_PREFIXES.some(p => k.startsWith(p))) keys.push(k);
    }
    return keys;
  }

  function getAllMonthDataKeys() {
    return [...MONTH_DATA_KEYS, ...getDynamicKeys()];
  }

  window.saveMonthSnapshot = function (monthKey) {
    if (!monthKey) return;
    const snapshot = {};
    for (const key of getAllMonthDataKeys()) {
      const val = localStorage.getItem(key);
      if (val !== null) snapshot[key] = val;
    }
    localStorage.setItem('monthSnapshot_' + monthKey, JSON.stringify(snapshot));
    console.log('[MonthCtx] snapshot saved:', monthKey);
  };

  window.loadMonthSnapshot = function (monthKey) {
    for (const key of getAllMonthDataKeys()) {
      localStorage.removeItem(key);
    }
    const raw = localStorage.getItem('monthSnapshot_' + monthKey);
    if (raw) {
      try {
        const snap = JSON.parse(raw);
        for (const [k, v] of Object.entries(snap)) localStorage.setItem(k, v);
        console.log('[MonthCtx] snapshot loaded:', monthKey);
        return true;
      } catch { return false; }
    }
    console.log('[MonthCtx] no snapshot for', monthKey, '— starting fresh');
    return false;
  };

  window.getSavedMonths = function () {
    const months = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('monthSnapshot_')) months.push(k.replace('monthSnapshot_', ''));
    }
    return months.sort((a, b) => b.localeCompare(a));
  };

  window.switchToMonth = function (targetMonthKey) {
    const currentKey = getCurrentMonthKey();
    if (currentKey) window.saveMonthSnapshot(currentKey);
    return window.loadMonthSnapshot(targetMonthKey);
  };

  window.getCurrentMonthKey = getCurrentMonthKey;
  window.MONTH_DATA_KEYS_LIST = MONTH_DATA_KEYS;

  document.addEventListener('DOMContentLoaded', function () {
    const currentKey = getCurrentMonthKey();
    if (!currentKey) return;
    const hasLocalData = !!localStorage.getItem('attendanceData');
    const hasSnapshot = !!localStorage.getItem('monthSnapshot_' + currentKey);
    if (!hasLocalData && hasSnapshot) {
      window.loadMonthSnapshot(currentKey);
      console.log('[MonthCtx] auto-restored snapshot for', currentKey);
    }
  });

})();
