// ===================================================================
// Admin Offices Full Submit Snapshot Guard — V1
// Scope: admin_offices_attendance.html + admin_offices_consumables.html
// يلتقط نسخة تشغيل كاملة قبل الرفع مباشرة حتى تكون متاحة عند تعديل المستخلص لاحقًا.
// لا يغير API ولا حسابات ولا مفاتيح الحفظ الأصلية.
// ===================================================================
(function () {
  'use strict';

  var page = (location.pathname || '').split('/').pop() || '';
  if (!/admin_offices_(attendance|consumables)\.html/.test(page)) return;
  if (window.__ADMIN_OFFICES_FULL_SUBMIT_SNAPSHOT_GUARD_V1__) return;
  window.__ADMIN_OFFICES_FULL_SUBMIT_SNAPSHOT_GUARD_V1__ = true;

  var SNAPSHOT_KEY = 'najran_admin_offices_complete_submit_snapshot_v1';
  var LABOR_KEY = 'najran_admin_offices_labor_submit_snapshot_v1';
  var CONSUMABLES_KEY = 'najran_admin_offices_consumables_submit_snapshot_v1';

  function safeJsonParse(raw, fallback) {
    try { return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }

  function readLocal(key) {
    var raw = null;
    try { raw = localStorage.getItem(key); } catch (_) {}
    if (raw == null) return null;
    return safeJsonParse(raw, raw);
  }

  function writeLocal(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.warn('[Admin Offices Full Submit Snapshot] failed to write', key, e); }
  }

  function isOwnSnapshotKey(key) {
    return key === SNAPSHOT_KEY || key === LABOR_KEY || key === CONSUMABLES_KEY;
  }

  function shouldCaptureKey(key) {
    if (!key || isOwnSnapshotKey(key)) return false;
    if (/^(najran_session|__clerk|clerk_|loglevel|amplitude|chakra|persist:)/.test(key)) return false;

    return (
      /adminOffice/i.test(key) ||
      /adminOffices/i.test(key) ||
      /admin_offices/i.test(key) ||
      /raise.*letter/i.test(key) ||
      /letter/i.test(key) ||
      /signature/i.test(key) ||
      /grand/i.test(key) ||
      /title/i.test(key) ||
      /performance/i.test(key) ||
      /subcontractors_data_/i.test(key) ||
      /water_supply_data_/i.test(key) ||
      /laundry_supply_data_/i.test(key) ||
      /sewage_disposal_data_/i.test(key) ||
      /summary_data_/i.test(key) ||
      /signatures_data_/i.test(key) ||
      /print_titles_data_/i.test(key) ||
      /notes_data_/i.test(key) ||
      key === 'persistentContractData' ||
      key === 'persistentExtractData' ||
      key === 'finalLaborCost' ||
      key === 'finalConsumablesCost' ||
      key === 'grand-net-total-admin' ||
      key === 'companyName' ||
      key === 'hospitalName' ||
      key === 'contractDetails' ||
      key === 'extractMonth' ||
      key === 'extractYear' ||
      key === 'paymentNumber' ||
      key === 'extractStart' ||
      key === 'extractEnd'
    );
  }

  function forceSaveCurrentScreen() {
    try { if (typeof window.captureUIData === 'function') window.captureUIData(); } catch (_) {}
    try { if (typeof window.saveAllData === 'function') window.saveAllData(); } catch (_) {}
    try { if (typeof window.calculateAndDisplayGrandTotal === 'function') window.calculateAndDisplayGrandTotal(); } catch (_) {}
    try {
      if (typeof window.getAttendanceData === 'function' && typeof window.saveAttendanceData === 'function') {
        window.saveAttendanceData(window.getAttendanceData());
      }
    } catch (_) {}
  }

  function countRows(value) {
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === 'object') {
      return Object.values(value).reduce(function (sum, rows) {
        return sum + (Array.isArray(rows) ? rows.length : 0);
      }, 0);
    }
    return 0;
  }

  function tableCountForPrefix(prefix) {
    var out = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key || key.indexOf(prefix) !== 0) continue;
        out[key] = countRows(readLocal(key));
      }
    } catch (_) {}
    return out;
  }

  function collectRelevantLocalStorage() {
    var out = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!shouldCaptureKey(key)) continue;
        out[key] = readLocal(key);
      }
    } catch (_) {}
    return out;
  }

  function buildLaborSnapshot() {
    var data = readLocal('adminOfficesAttendanceData_v1') || {};
    var names = readLocal('adminOfficeNames_v1') || {};
    var affiliations = readLocal('adminOfficeAffiliations_v1') || {};
    var officeKeys = Object.keys(names || {});
    var officeRows = {};
    officeKeys.forEach(function (key) { officeRows[key] = Array.isArray(data[key]) ? data[key].length : 0; });

    return {
      type: 'admin_offices_labor',
      capturedAt: new Date().toISOString(),
      page: page,
      officeCount: officeKeys.length,
      employeeRows: countRows(data),
      officeRows: officeRows,
      names: names,
      affiliations: affiliations,
      attendanceData: data,
      positionsSetup: readLocal('adminOfficesPositionsSetup_v1'),
      signatures: collectByPattern(/signature|adminOffice.*sign|grand/i),
      letters: collectByPattern(/raise.*letter|letter/i),
      titles: collectByPattern(/title/i),
      totals: {
        finalLaborCost: readLocal('finalLaborCost'),
        grandNetTotalAdmin: readLocal('grand-net-total-admin')
      }
    };
  }

  function collectByPattern(pattern) {
    var out = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key || isOwnSnapshotKey(key)) continue;
        if (pattern.test(key)) out[key] = readLocal(key);
      }
    } catch (_) {}
    return out;
  }

  function buildConsumablesSnapshot() {
    return {
      type: 'admin_offices_consumables',
      capturedAt: new Date().toISOString(),
      page: page,
      tables: {
        subcontractors: collectByPattern(/^subcontractors_data_/i),
        performance: collectByPattern(/^performance_data_/i),
        water: collectByPattern(/^water_supply_data_/i),
        laundry: collectByPattern(/^laundry_supply_data_/i),
        sewage: collectByPattern(/^sewage_disposal_data_/i),
        summary: collectByPattern(/^summary_data_/i),
        notes: collectByPattern(/^notes_data_/i),
        signatures: collectByPattern(/^signatures_data_/i),
        titles: collectByPattern(/^print_titles_data_/i)
      },
      rowCounts: {
        subcontractors: tableCountForPrefix('subcontractors_data_'),
        performance: tableCountForPrefix('performance_data_'),
        water: tableCountForPrefix('water_supply_data_'),
        laundry: tableCountForPrefix('laundry_supply_data_'),
        sewage: tableCountForPrefix('sewage_disposal_data_'),
        summary: tableCountForPrefix('summary_data_')
      },
      totals: {
        finalConsumablesCost: readLocal('finalConsumablesCost')
      }
    };
  }

  function buildCompleteSnapshot(trigger) {
    forceSaveCurrentScreen();

    var labor = buildLaborSnapshot();
    var consumables = buildConsumablesSnapshot();
    var relevantLocalStorage = collectRelevantLocalStorage();

    var complete = {
      schema: 'admin_offices_complete_submit_snapshot_v1',
      capturedAt: new Date().toISOString(),
      trigger: trigger || 'manual',
      page: page,
      contract: readLocal('persistentContractData'),
      extract: readLocal('persistentExtractData'),
      labor: labor,
      consumables: consumables,
      localStorageSubset: relevantLocalStorage,
      keyManifest: Object.keys(relevantLocalStorage).sort()
    };

    writeLocal(LABOR_KEY, labor);
    writeLocal(CONSUMABLES_KEY, consumables);
    writeLocal(SNAPSHOT_KEY, complete);

    console.info('[Admin Offices Full Submit Snapshot] captured', {
      trigger: trigger,
      offices: labor.officeCount,
      employees: labor.employeeRows,
      keys: complete.keyManifest.length
    });

    return complete;
  }

  function isSubmitButton(target) {
    var btn = target && target.closest && target.closest('#_najran_approve_btn_inner, #_najran_approve_btn button');
    if (!btn) return false;
    var text = String(btn.textContent || '');
    return /رفع مستخلص/.test(text) || /جاري رفع/.test(text);
  }

  document.addEventListener('click', function (e) {
    if (!isSubmitButton(e.target)) return;
    buildCompleteSnapshot('before-submit-click');
  }, true);

  window.AdminOfficesFullSubmitSnapshot = {
    capture: buildCompleteSnapshot,
    keys: { complete: SNAPSHOT_KEY, labor: LABOR_KEY, consumables: CONSUMABLES_KEY }
  };

  setTimeout(function () { buildCompleteSnapshot('page-ready'); }, 1200);

  console.info('[Admin Offices Full Submit Snapshot Guard] installed v1');
})();
