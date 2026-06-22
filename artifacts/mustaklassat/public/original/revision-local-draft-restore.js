// Restores a locally saved draft after editing/re-uploading an older submitted extract.
(function () {
  'use strict';

  var BACKUP_KEY = 'najran_revision_previous_local_backup';
  var REVISION_KEY = 'najran_revision_extract_id';
var WORKING_KEY = 'najran_revision_working_snapshot';
  function parse(raw, fallback) {
    try { return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }
  function writeValue(key, value) {
    if (value == null) return;
    try {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    } catch (_) {
      try { localStorage.setItem(key, String(value)); } catch (__) {}
    }
  }
function hydrateRevisionExtractSettings(snapshot) {
  try {
    snapshot = snapshot || {};

    function parseObj(v) {
      if (!v) return {};
      if (typeof v === 'object') return v;
      try { return JSON.parse(v); } catch (_) { return {}; }
    }

    var extract = parseObj(snapshot.persistentExtractData);
    var currentExtract = parseObj(localStorage.getItem('persistentExtractData'));

    var finalExtract = Object.assign({}, currentExtract, extract);

    var month =
      finalExtract.extractMonth ||
      snapshot.extractMonth ||
      localStorage.getItem('extractMonth') ||
      '';

    var year =
      finalExtract.extractYear ||
      snapshot.extractYear ||
      localStorage.getItem('extractYear') ||
      '';

    var start =
      finalExtract.extractStart ||
      finalExtract.extractFromDate ||
      snapshot.extractStart ||
      snapshot.extractFromDate ||
      localStorage.getItem('extractStart') ||
      localStorage.getItem('extractFromDate') ||
      '';

    var end =
      finalExtract.extractEnd ||
      finalExtract.extractToDate ||
      snapshot.extractEnd ||
      snapshot.extractToDate ||
      localStorage.getItem('extractEnd') ||
      localStorage.getItem('extractToDate') ||
      '';

    var payment =
      finalExtract.paymentNumber ||
      finalExtract.extractNumber ||
      snapshot.paymentNumber ||
      snapshot.extractNumber ||
      localStorage.getItem('paymentNumber') ||
      localStorage.getItem('extractNumber') ||
      '';

    if (month) {
      finalExtract.extractMonth = String(month);
      localStorage.setItem('extractMonth', String(month));
    }

    if (year) {
      finalExtract.extractYear = String(year);
      localStorage.setItem('extractYear', String(year));
    }

    if (start) {
      finalExtract.extractStart = String(start);
      finalExtract.extractFromDate = String(start);
      localStorage.setItem('extractStart', String(start));
      localStorage.setItem('extractFromDate', String(start));
    }

    if (end) {
      finalExtract.extractEnd = String(end);
      finalExtract.extractToDate = String(end);
      localStorage.setItem('extractEnd', String(end));
      localStorage.setItem('extractToDate', String(end));
    }

    if (payment) {
      finalExtract.paymentNumber = String(payment);
      finalExtract.extractNumber = String(payment);
      localStorage.setItem('paymentNumber', String(payment));
      localStorage.setItem('extractNumber', String(payment));
    }

    if (!finalExtract.extractCalendar) finalExtract.extractCalendar = 'ميلادي';
    if (!finalExtract.extractDuration) finalExtract.extractDuration = 'شهر واحد';

    localStorage.setItem('persistentExtractData', JSON.stringify(finalExtract));

    console.warn('[RevisionBootGuard] extract settings hydrated without key changes', {
      month: month,
      year: year,
      start: start,
      end: end,
      payment: payment
    });
  } catch (e) {
    console.warn('[RevisionBootGuard] failed to hydrate extract settings', e);
  }
}
  function normalizeRevisionSnapshotSettings(snapshot) {
  snapshot = snapshot || {};

var extract =
  snapshot.persistentExtractData && typeof snapshot.persistentExtractData === 'object'
    ? snapshot.persistentExtractData
    : parse(snapshot.persistentExtractData, {});
    if (!extract || typeof extract !== 'object') extract = {};

  var month =
    extract.extractMonth ||
    snapshot.extractMonth ||
    extract.month ||
    snapshot.month ||
    '';

  var year =
    extract.extractYear ||
    snapshot.extractYear ||
    extract.year ||
    snapshot.year ||
    '';

  var start =
    extract.extractStart ||
    snapshot.extractStart ||
    extract.start ||
    snapshot.start ||
    extract.extractFromDate ||
    snapshot.extractFromDate ||
    '';

  var end =
    extract.extractEnd ||
    snapshot.extractEnd ||
    extract.end ||
    snapshot.end ||
    extract.extractToDate ||
    snapshot.extractToDate ||
    '';

  var payment =
    extract.paymentNumber ||
    snapshot.paymentNumber ||
    extract.extractNumber ||
    snapshot.extractNumber ||
    extract.payment ||
    snapshot.payment ||
    '';

  if (month) extract.extractMonth = month;
  if (year) extract.extractYear = String(year);
  if (start) extract.extractStart = start;
  if (end) extract.extractEnd = end;
  if (payment) {
    extract.paymentNumber = String(payment);
    extract.extractNumber = String(payment);
  }

  if (!extract.extractCalendar) extract.extractCalendar = snapshot.extractCalendar || 'ميلادي';
  if (!extract.extractDuration) extract.extractDuration = snapshot.extractDuration || 'شهر واحد';

  snapshot.persistentExtractData = JSON.stringify(extract);

  if (month) snapshot.extractMonth = month;
  if (year) snapshot.extractYear = String(year);
  if (start) {
    snapshot.extractStart = start;
    snapshot.extractFromDate = start;
  }
  if (end) {
    snapshot.extractEnd = end;
    snapshot.extractToDate = end;
  }
  if (payment) {
    snapshot.paymentNumber = String(payment);
    snapshot.extractNumber = String(payment);
  }

  console.warn('[RevisionBootGuard] normalized saved extract settings without changing keys', {
    month: month,
    year: year,
    start: start,
    end: end,
    payment: payment
  });

  return snapshot;
}
  function isRevisionActiveNow() {
  try {
    return localStorage.getItem('najran_revision_mode') === 'true' &&
      !!localStorage.getItem('najran_revision_extract_id') &&
      !!localStorage.getItem('najran_revision_snapshot');
  } catch (_) {
    return false;
  }
}

function collectRevisionOperationalData() {
  var data = {};

  var keys = [
    'attendanceData','ng_attendanceData','nd_attendanceData',
    'centersAttendanceData_v2','healthCentersAttendanceData','adminOfficesAttendanceData_v1',

    'persistentContractData','persistentExtractData',
    'extractMonth','extractYear','extractNumber',
    'extractStart','extractEnd','extractFromDate','extractToDate',
    'paymentNumber','periodMonth',

    'performanceData','performanceData_v4',
    'performanceDeductions','performanceTotalDeduction','performanceTotalDue',

    'achievementData','achievementTitles_v1','achievementItemNames',

    'consumablesTableData','healthCentersConsumables',
    'mainHospitalConsumables','admin_offices_consumables_v1.0',

    'spare_partsData','sparePartsTotalAmount',

    'approvalData','displayApprovalData',
    'finalLaborCost','finalConsumablesCost',
    'grand-net-total','grand-net-total-centers','grand-net-total-admin',

    'najran_labor_attendance_done',
    'najran_labor_performance_done',
    'najran_health_attendance_done',
    'najran_admin_offices_attendance_done'
  ];

  var prefixes = [
    'deptCalculatedCost_',
    'dept_',
    'tableData_',
    'achievement_',
    'consumables_',
    'spare_',
    'water_',
    'sewage_',
    'subcontractors_',
    'najran_labor_',
    'najran_health_',
    'najran_admin_'
  ];

  keys.forEach(function (key) {
    try {
      var val = localStorage.getItem(key);
      if (val != null) data[key] = val;
    } catch (_) {}
  });

  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (!k) continue;

      var matched = prefixes.some(function (p) {
        return k.indexOf(p) === 0;
      });

      if (!matched) continue;

      var v = localStorage.getItem(k);
      if (v != null) data[k] = v;
    }
  } catch (_) {}

  return data;
}

function saveRevisionWorkingSnapshot(reason) {
  try {
    if (!isRevisionActiveNow()) return false;

    var revisionId = localStorage.getItem('najran_revision_extract_id') || '';
    if (!revisionId) return false;

 var collectedData = collectRevisionOperationalData();

try {
  var attendanceChanged =
    localStorage.getItem('najran_revision_attendance_changed') === '1';

  if (attendanceChanged) {
    [
      'performanceData',
      'performanceData_v4',
      'performanceDeductions',
      'performanceTotalDeduction',
      'performanceTotalDue',
      'achievementData',
      'achievementTitles_v1',
      'achievementItemNames',
      'approvalData',
      'displayApprovalData',
      'finalLaborCost',
      'finalConsumablesCost',
      'grand-net-total',
      'grand-net-total-centers',
      'grand-net-total-admin'
    ].forEach(function (key) {
      delete collectedData[key];
    });

    Object.keys(collectedData).forEach(function (key) {
      if (
        key.indexOf('deptCalculatedCost_') === 0 ||
        key.indexOf('dept_') === 0 ||
        key.indexOf('tableData_') === 0 ||
        key.indexOf('achievement_') === 0
      ) {
        delete collectedData[key];
      }
    });

    console.warn('[RevisionWorking] attendance changed — cleared derived performance/achievement data from working snapshot');
  }
} catch (_) {}

var working = {
  savedAt: new Date().toISOString(),
  reason: reason || 'revision-working-autosave',
  revisionExtractId: revisionId,
  data: collectedData
};

    localStorage.setItem(WORKING_KEY, JSON.stringify(working));

    console.warn('[RevisionWorking] saved working snapshot', {
      revisionExtractId: revisionId,
      reason: reason || '',
      keys: Object.keys(working.data || {}).length
    });

    return true;
  } catch (e) {
    console.warn('[RevisionWorking] failed to save working snapshot', e);
    return false;
  }
}

function getRevisionBootSnapshot(rawSnapshot) {
  var original = parse(rawSnapshot, null);
  if (!original || typeof original !== 'object') return null;

  try {
    var revisionId = localStorage.getItem('najran_revision_extract_id') || '';
    var working = parse(localStorage.getItem(WORKING_KEY), null);

    if (
      working &&
      String(working.revisionExtractId || '') === String(revisionId || '') &&
      working.data &&
      typeof working.data === 'object'
    ) {
      console.warn('[RevisionWorking] applying working snapshot instead of original submitted snapshot', {
        revisionExtractId: revisionId,
        savedAt: working.savedAt,
        reason: working.reason
      });

      return working.data;
    }
  } catch (_) {}

  return original;
}

function installRevisionWorkingAutosave() {
  try {
    if (!isRevisionActiveNow()) return;
    if (window.__NAJRAN_REVISION_WORKING_AUTOSAVE__) return;
    window.__NAJRAN_REVISION_WORKING_AUTOSAVE__ = true;

    var timer = null;

    var watchedKeys = {
      attendanceData: true,
      ng_attendanceData: true,
      nd_attendanceData: true,
      centersAttendanceData_v2: true,
      healthCentersAttendanceData: true,
      adminOfficesAttendanceData_v1: true,

      persistentContractData: true,
      persistentExtractData: true,
      extractMonth: true,
      extractYear: true,
      extractNumber: true,
      extractStart: true,
      extractEnd: true,
      extractFromDate: true,
      extractToDate: true,
      paymentNumber: true,
      periodMonth: true,

      performanceData: true,
      performanceData_v4: true,
      performanceDeductions: true,
      performanceTotalDeduction: true,
      performanceTotalDue: true,

      achievementData: true,
      achievementTitles_v1: true,
      achievementItemNames: true,

      consumablesTableData: true,
      healthCentersConsumables: true,
      mainHospitalConsumables: true,
      'admin_offices_consumables_v1.0': true,

      spare_partsData: true,
      sparePartsTotalAmount: true,

      approvalData: true,
      displayApprovalData: true,
      finalLaborCost: true,
      finalConsumablesCost: true,
      'grand-net-total': true,
      'grand-net-total-centers': true,
      'grand-net-total-admin': true,

      najran_labor_attendance_done: true,
      najran_labor_performance_done: true,
      najran_health_attendance_done: true,
      najran_admin_offices_attendance_done: true
    };
var watchedPrefixes = [
  'deptCalculatedCost_',
  'dept_',
  'tableData_',
  'achievement_',
  'consumables_',
  'spare_',
  'water_',
  'sewage_',
  'subcontractors_',
  'najran_labor_',
  'najran_health_',
  'najran_admin_'
];

function isWatchedRevisionKey(key) {
  if (watchedKeys[key]) return true;

  for (var i = 0; i < watchedPrefixes.length; i++) {
    if (String(key || '').indexOf(watchedPrefixes[i]) === 0) {
      return true;
    }
  }

  return false;
}
    function schedule(reason) {
      if (!isRevisionActiveNow()) return;
      clearTimeout(timer);
      timer = setTimeout(function () {
        saveRevisionWorkingSnapshot(reason);
      }, 250);
    }

    try {
      if (!window.__NAJRAN_REVISION_ORIGINAL_SETITEM__) {
        window.__NAJRAN_REVISION_ORIGINAL_SETITEM__ = localStorage.setItem.bind(localStorage);
      }

      var originalSetItem = window.__NAJRAN_REVISION_ORIGINAL_SETITEM__;

      localStorage.setItem = function (key, value) {
        originalSetItem(key, value);

        try {
                 if (
  isRevisionActiveNow() &&
  key !== WORKING_KEY &&
  key !== 'najran_revision_snapshot' &&
  isWatchedRevisionKey(key)
) {
  if (
    key === 'attendanceData' ||
    key === 'ng_attendanceData' ||
    key === 'nd_attendanceData' ||
    key === 'centersAttendanceData_v2' ||
    key === 'healthCentersAttendanceData' ||
    key === 'adminOfficesAttendanceData_v1'
  ) {
    try {
      window.__NAJRAN_REVISION_ORIGINAL_SETITEM__(
        'najran_revision_attendance_changed',
        '1'
      );
    } catch (_) {}
  }

  schedule('localStorage:' + key);
}
        } catch (_) {}
      };
    } catch (e) {
      console.warn('[RevisionWorking] localStorage.setItem hook failed', e);
    }

    document.addEventListener('input', function () {
      schedule('input');
    }, true);

    document.addEventListener('change', function () {
      schedule('change');
    }, true);

    document.addEventListener('click', function () {
      setTimeout(function () {
        saveRevisionWorkingSnapshot('click-action');
      }, 120);
    }, true);

    window.addEventListener('pagehide', function () {
      saveRevisionWorkingSnapshot('pagehide');
    });

    window.addEventListener('beforeunload', function () {
      saveRevisionWorkingSnapshot('beforeunload');
    });

    setTimeout(function () {
      saveRevisionWorkingSnapshot('initial-seed');
    }, 1400);

    console.warn('[RevisionWorking] autosave installed with localStorage hook');
  } catch (e) {
    console.warn('[RevisionWorking] failed to install autosave', e);
  }
}
  function applyRevisionBootSnapshot() {
  try {
    var isRevision =
      localStorage.getItem('najran_revision_mode') === 'true' &&
      localStorage.getItem('najran_revision_extract_id') &&
      localStorage.getItem('najran_revision_snapshot');

    if (!isRevision) return false;

    var rawSnapshot = localStorage.getItem('najran_revision_snapshot');
    if (!rawSnapshot) return false;

    var snapshot = getRevisionBootSnapshot(rawSnapshot);
    if (!snapshot || typeof snapshot !== 'object') return false;

    snapshot = normalizeRevisionSnapshotSettings(snapshot);

    console.warn('[RevisionBootGuard] applying revision snapshot after page load');

    clearOperational();

    Object.keys(snapshot).forEach(function (key) {
      writeValue(key, snapshot[key]);
    });

    hydrateRevisionExtractSettings(snapshot);
    refreshSettingsPageAfterRevisionHydrate();

    localStorage.setItem('najran_revision_mode', 'true');
    localStorage.setItem('najran_revision_boot_lock', 'true');

    setTimeout(function () {
      Object.keys(snapshot).forEach(function (key) {
        writeValue(key, snapshot[key]);
      });

      hydrateRevisionExtractSettings(snapshot);
      refreshSettingsPageAfterRevisionHydrate();

      localStorage.setItem('najran_revision_mode', 'true');
      localStorage.removeItem('najran_revision_boot_lock');

      console.warn('[RevisionBootGuard] snapshot applied — rendering tables without reload');

      try { if (typeof window.updateContractDisplayData === 'function') window.updateContractDisplayData(); } catch (_) {}
      try { if (typeof window.updateContractDataForPrint === 'function') window.updateContractDataForPrint(); } catch (_) {}
      try { if (typeof window.renderTables === 'function') window.renderTables(); } catch (_) {}

      setTimeout(function () {
        try { if (typeof window.updateContractDisplayData === 'function') window.updateContractDisplayData(); } catch (_) {}
        try { if (typeof window.renderTables === 'function') window.renderTables(); } catch (_) {}
        console.warn('[RevisionBootGuard] second renderTables done');
      }, 800);

    }, 900);

    return true;
  } catch (e) {
    console.warn('[RevisionBootGuard] failed to apply revision snapshot', e);
    return false;
  }
}
  function refreshSettingsPageAfterRevisionHydrate() {
  try {
    var isSettingsPage =
      /settings_main\.html(?:$|[?#])/.test(location.href) ||
      /[?&]page=settings_main\.html(?:$|&)/.test(location.search || '');

    if (!isSettingsPage) return;

    console.warn('[RevisionBootGuard] settings page detected — refreshing settings UI from hydrated storage');

    setTimeout(function () {
      try { if (typeof window.loadFromLocalStorage === 'function') window.loadFromLocalStorage(); } catch (_) {}
      try { if (typeof window.loadSavedData === 'function') window.loadSavedData(); } catch (_) {}
      try { if (typeof window.loadData === 'function') window.loadData(); } catch (_) {}
      try { if (typeof window.loadSettings === 'function') window.loadSettings(); } catch (_) {}
      try { if (typeof window.forceLoadFromLocalStorage === 'function') window.forceLoadFromLocalStorage(); } catch (_) {}
      try { if (typeof window.autoFillContractData === 'function') window.autoFillContractData(); } catch (_) {}
      try { if (typeof window.updateContractDisplayData === 'function') window.updateContractDisplayData(); } catch (_) {}

      try {
        window.dispatchEvent(new CustomEvent('najranRevisionSettingsHydrated', {
          detail: {
            extractMonth: localStorage.getItem('extractMonth'),
            extractYear: localStorage.getItem('extractYear'),
            extractStart: localStorage.getItem('extractStart'),
            extractEnd: localStorage.getItem('extractEnd'),
            paymentNumber: localStorage.getItem('paymentNumber')
          }
        }));
      } catch (_) {}

      console.warn('[RevisionBootGuard] settings UI refresh attempted');
    }, 150);
  } catch (e) {
    console.warn('[RevisionBootGuard] settings UI refresh failed', e);
  }
}
  function getBackup() {
    if (localStorage.getItem(REVISION_KEY)) return null;
    var backup = parse(localStorage.getItem(BACKUP_KEY), null);
    if (!backup || !backup.data || typeof backup.data !== 'object') return null;
    return backup;
  }

  function parseValue(value) {
    if (typeof value !== 'string') return value && typeof value === 'object' ? value : {};
    return parse(value, {});
  }

  function labelOf(backup) {
    var data = backup.data || {};
    var extract = parseValue(data.persistentExtractData);
    var payment = extract.paymentNumber || extract.extractNumber || data.paymentNumber || data.extractNumber || '';
    var month = extract.extractMonth || data.extractMonth || '';
    var year = extract.extractYear || data.extractYear || '';
    var parts = [];
    if (payment) parts.push('رقم الدفعة: ' + payment);
    if (month || year) parts.push('الفترة: ' + [month, year].filter(Boolean).join(' '));
    return parts.join(' — ') || 'مسودة محلية غير مرفوعة';
  }

  function clearOperational() {
    var exact = [
      'attendanceData','ng_attendanceData','nd_attendanceData','centersAttendanceData_v2','healthCentersAttendanceData','adminOfficesAttendanceData_v1',
      'persistentContractData','persistentExtractData','contractData','contractDetails','contractType','contractStartDate','contractEndDate','contractSignatureData',
      'extractMonth','extractYear','extractNumber','extractStart','extractEnd','extractFromDate','extractToDate','paymentNumber','periodMonth',
      'performanceData','performanceData_v4','performanceDeductions','performanceTotalDeduction','performanceTotalDue','achievementData','achievementTitles_v1','achievementItemNames',
      'consumablesTableData','healthCentersConsumables','mainHospitalConsumables','admin_offices_consumables_v1.0','spare_partsData','sparePartsTotalAmount',
      'approvalData','displayApprovalData','finalLaborCost','finalConsumablesCost','grand-net-total','grand-net-total-centers','grand-net-total-admin',
      'najran_labor_attendance_done','najran_labor_performance_done','najran_health_attendance_done','najran_admin_offices_attendance_done'
    ];
    var prefixes = ['deptCalculatedCost_','dept_','tableData_','achievement_','consumables_','spare_','water_','sewage_','subcontractors_','najran_labor_','najran_health_','najran_admin_'];
    exact.forEach(function (key) { localStorage.removeItem(key); });
    for (var i = localStorage.length - 1; i >= 0; i--) {
      var k = localStorage.key(i);
      if (k && prefixes.some(function (p) { return k.indexOf(p) === 0; })) localStorage.removeItem(k);
    }
  }

  function targetOf(data) {
    if (data.adminOfficesAttendanceData_v1) return '/original/admin_offices_attendance.html';
    if (data.healthCentersAttendanceData || data.centersAttendanceData_v2) return '/original/health_centers_attendance.html';
    if (data.spare_partsData || data.sparePartsTotalAmount) return '/original/spare_parts.html';
    if (data.consumablesTableData || data.mainHospitalConsumables) return '/original/consumables.html';
    return '/original/attendance.html';
  }

  function restore() {
    var backup = getBackup();
    if (!backup) return;
    var currentSession = localStorage.getItem('najran_session');
    var data = backup.data || {};
    var target = targetOf(data);

    clearOperational();
    Object.keys(data).forEach(function (key) {
      try {
        if (data[key] != null) localStorage.setItem(key, String(data[key]));
      } catch (_) {}
    });
    if (currentSession) localStorage.setItem('najran_session', currentSession);
    localStorage.removeItem(REVISION_KEY);
    localStorage.removeItem('najran_revision_mode');
    localStorage.removeItem('najran_revision_extract_type');
    localStorage.removeItem('najran_revision_started_at');
    localStorage.removeItem('najran_revision_boot_lock');
    localStorage.removeItem('najran_revision_source');
    localStorage.removeItem('najran_revision_snapshot');
    localStorage.removeItem('najran_revision_previous_total_amount');
    sessionStorage.removeItem('najran_revision_reloaded');
    localStorage.removeItem(BACKUP_KEY);
    window.location.href = target + '?restoredLocalDraft=1&v=' + Date.now();
  }

  function discard() {
    localStorage.removeItem(BACKUP_KEY);
    var box = document.getElementById('najran-local-draft-restore-box');
    if (box) box.remove();
  }

  function show() {
    var backup = getBackup();
    if (!backup) return;
    if (document.getElementById('najran-local-draft-restore-box')) return;

    var box = document.createElement('div');
    box.id = 'najran-local-draft-restore-box';
    box.className = 'no-print';
    box.style.cssText = 'position:fixed;top:18px;left:18px;z-index:1000000;max-width:520px;background:#fff7ed;border:1px solid #fed7aa;border-right:6px solid #ea580c;border-radius:16px;box-shadow:0 18px 45px rgba(15,23,42,.22);padding:15px 16px;direction:rtl;font-family:Tajawal,Arial,sans-serif;color:#7c2d12;line-height:1.8;';
    box.innerHTML =
      '<div style="font-weight:900;color:#9a3412;font-size:15px;margin-bottom:4px;">توجد مسودة محلية محفوظة</div>' +
      '<div style="font-size:13px;margin-bottom:10px;">' + labelOf(backup) + '</div>' +
      '<div style="font-size:12px;color:#9a3412;margin-bottom:12px;">تم حفظها قبل فتح مستخلص آخر للتعديل. يمكن استعادتها الآن أو تركها محفوظة.</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        '<button id="najran-restore-local-draft" style="background:#16a34a;color:#fff;border:0;border-radius:10px;padding:9px 13px;font-weight:900;cursor:pointer;">استعادة المسودة</button>' +
        '<button id="najran-hide-local-draft" style="background:#475569;color:#fff;border:0;border-radius:10px;padding:9px 13px;font-weight:900;cursor:pointer;">إخفاء الآن</button>' +
        '<button id="najran-discard-local-draft" style="background:#dc2626;color:#fff;border:0;border-radius:10px;padding:9px 13px;font-weight:900;cursor:pointer;">حذف المسودة</button>' +
      '</div>';
    document.body.appendChild(box);
    document.getElementById('najran-restore-local-draft').onclick = restore;
    document.getElementById('najran-hide-local-draft').onclick = function () { box.remove(); };
    document.getElementById('najran-discard-local-draft').onclick = function () {
      if (confirm('سيتم حذف المسودة المحلية المحفوظة من هذا الجهاز. هل تريد المتابعة؟')) discard();
    };
  }
function isActiveRevisionMode() {
  try {
    return localStorage.getItem('najran_revision_mode') === 'true' &&
      !!localStorage.getItem('najran_revision_extract_id') &&
      !!localStorage.getItem('najran_revision_snapshot');
  } catch (_) {
    return false;
  }
}

function parseRevisionObj(v) {
  if (!v) return {};
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch (_) { return {}; }
}

function getRevisionInfoLabel() {
  try {
    var snap = parseRevisionObj(localStorage.getItem('najran_revision_snapshot'));
    var extract = parseRevisionObj(snap.persistentExtractData);
    var contract = parseRevisionObj(localStorage.getItem('persistentContractData'));

    var id = localStorage.getItem('najran_revision_extract_id') || '';
    var payment =
      extract.paymentNumber ||
      extract.extractNumber ||
      snap.paymentNumber ||
      snap.extractNumber ||
      localStorage.getItem('paymentNumber') ||
      localStorage.getItem('extractNumber') ||
      '';

    var month =
      extract.extractMonth ||
      snap.extractMonth ||
      snap.month ||
      localStorage.getItem('extractMonth') ||
      '';

    var year =
      extract.extractYear ||
      snap.extractYear ||
      snap.year ||
      localStorage.getItem('extractYear') ||
      '';

    var start =
      extract.extractStart ||
      extract.extractFromDate ||
      snap.extractStart ||
      snap.extractFromDate ||
      localStorage.getItem('extractStart') ||
      '';

    var end =
      extract.extractEnd ||
      extract.extractToDate ||
      snap.extractEnd ||
      snap.extractToDate ||
      localStorage.getItem('extractEnd') ||
      '';

    var hospital =
      contract.hospitalName ||
      snap.hospitalName ||
      snap.hospital ||
      '';

    var company =
      contract.companyName ||
      snap.companyName ||
      snap.company ||
      '';

    return [
      id ? 'رقم المستخلص: ' + id : '',
      payment ? 'رقم الدفعة: ' + payment : '',
      (month || year) ? 'الفترة: ' + [month, year].filter(Boolean).join(' ') : '',
      (start || end) ? 'من ' + start + ' إلى ' + end : '',
      hospital ? 'الموقع: ' + hospital : '',
      company ? 'الشركة: ' + company : ''
    ].filter(Boolean).join(' — ');
  } catch (_) {
    return '';
  }
}

function clearRevisionOnly() {
  [
    'najran_revision_mode',
    'najran_revision_extract_id',
    'najran_revision_extract_type',
    'najran_revision_started_at',
    'najran_revision_boot_lock',
    'najran_revision_source',
    'najran_revision_snapshot',
    'najran_revision_previous_total_amount',
    'najran_revision_working_snapshot'
    'najran_revision_attendance_changed'
  ].forEach(function (key) {
    try { localStorage.removeItem(key); } catch (_) {}
  });

  try { sessionStorage.removeItem('najran_revision_reloaded'); } catch (_) {}
}

function saveCurrentRevisionLocalDraftBeforeExit() {
  try {
    var data = {};
    var keys = [
      'attendanceData','ng_attendanceData','nd_attendanceData',
      'centersAttendanceData_v2','healthCentersAttendanceData','adminOfficesAttendanceData_v1',

      'persistentContractData','persistentExtractData',
      'extractMonth','extractYear','extractNumber',
      'extractStart','extractEnd','extractFromDate','extractToDate',
      'paymentNumber','periodMonth',

      'performanceData','performanceData_v4',
      'performanceDeductions','performanceTotalDeduction','performanceTotalDue',

      'achievementData','achievementTitles_v1','achievementItemNames',

      'consumablesTableData','healthCentersConsumables',
      'mainHospitalConsumables','admin_offices_consumables_v1.0',

      'spare_partsData','sparePartsTotalAmount',

      'approvalData','displayApprovalData',
      'finalLaborCost','finalConsumablesCost',
      'grand-net-total','grand-net-total-centers','grand-net-total-admin',

      'najran_labor_attendance_done',
      'najran_labor_performance_done',
      'najran_health_attendance_done',
      'najran_admin_offices_attendance_done'
    ];

    keys.forEach(function (key) {
      try {
        var val = localStorage.getItem(key);
        if (val != null) data[key] = val;
      } catch (_) {}
    });

    var backup = {
      savedAt: new Date().toISOString(),
      reason: 'revision-exit-local-draft',
      revisionExtractId: localStorage.getItem('najran_revision_extract_id') || '',
      label: getRevisionInfoLabel(),
      data: data
    };

    localStorage.setItem('najran_revision_previous_local_backup', JSON.stringify(backup));

    console.warn('[RevisionExit] local draft saved before leaving revision', backup.label);

    return true;
  } catch (e) {
    console.warn('[RevisionExit] failed to save local draft before exit', e);
    return false;
  }
}

function showRevisionExitModal() {
  try {
    if (!isActiveRevisionMode()) return;

    var old = document.getElementById('najran-revision-exit-modal');
    if (old) old.remove();

    var label = getRevisionInfoLabel() || 'مستخلص محفوظ قيد التعديل';

    var modal = document.createElement('div');
    modal.id = 'najran-revision-exit-modal';
    modal.className = 'no-print';
    modal.style.cssText =
      'position:fixed;inset:0;background:rgba(15,23,42,.58);z-index:1000000;' +
      'display:flex;align-items:center;justify-content:center;direction:rtl;' +
      'font-family:Tajawal,Arial,sans-serif;';

    modal.innerHTML =
      '<div style="width:min(640px,94vw);background:#fff;border-radius:18px;padding:22px;' +
        'box-shadow:0 24px 70px rgba(0,0,0,.32);border-top:6px solid #991b1b;text-align:right;">' +

        '<h2 style="margin:0 0 12px;color:#991b1b;font-size:22px;font-weight:900;">أنت الآن تقوم بتعديل مستخلص محفوظ</h2>' +

        '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;' +
          'color:#334155;font-size:14px;line-height:1.9;margin-bottom:14px;">' +
          label +
        '</div>' +

        '<p style="margin:0 0 14px;color:#475569;font-size:14px;line-height:1.9;">' +
          'اختيار الخروج سينهي وضع التعديل الحالي ويرجعك إلى صفحة المستخلصات المحفوظة. لن يتم رفع أي شيء للسحابة من هذا الاختيار.' +
        '</p>' +

        '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-start;">' +
          '<button id="najran-revision-save-exit" style="background:#166534;color:#fff;border:0;border-radius:10px;padding:11px 15px;font-weight:900;cursor:pointer;font-family:Tajawal,Arial,sans-serif;">حفظ نسخة محلية والخروج</button>' +
          '<button id="najran-revision-exit-no-save" style="background:#991b1b;color:#fff;border:0;border-radius:10px;padding:11px 15px;font-weight:900;cursor:pointer;font-family:Tajawal,Arial,sans-serif;">الخروج بدون حفظ</button>' +
          '<button id="najran-revision-stay" style="background:#475569;color:#fff;border:0;border-radius:10px;padding:11px 15px;font-weight:900;cursor:pointer;font-family:Tajawal,Arial,sans-serif;">البقاء داخل التعديل</button>' +
        '</div>' +

      '</div>';

    document.body.appendChild(modal);

    document.getElementById('najran-revision-save-exit').onclick = function () {
      saveCurrentRevisionLocalDraftBeforeExit();
      clearRevisionOnly();
      window.top.location.href = '/extracts/track?revisionExited=1&savedLocalDraft=1&v=' + Date.now();
    };

    document.getElementById('najran-revision-exit-no-save').onclick = function () {
      clearRevisionOnly();
      window.top.location.href = '/extracts/track?revisionExited=1&noSave=1&v=' + Date.now();
    };

    document.getElementById('najran-revision-stay').onclick = function () {
      modal.remove();
    };

  } catch (e) {
    console.warn('[RevisionExit] failed to show modal', e);
  }
}

function installHomeAsRevisionExit() {
  try {
    if (!isActiveRevisionMode()) return;
    if (window.__NAJRAN_HOME_REVISION_EXIT_INSTALLED__) return;
    window.__NAJRAN_HOME_REVISION_EXIT_INSTALLED__ = true;

    function isHomeElement(el) {
      if (!el) return false;

      var raw = '';
      try {
        raw = [
          el.getAttribute && el.getAttribute('href') || '',
          el.getAttribute && el.getAttribute('onclick') || '',
          el.textContent || '',
          el.title || '',
          el.getAttribute && el.getAttribute('aria-label') || ''
        ].join(' ');
      } catch (_) {}

      raw = String(raw || '').trim();

      return (
        raw.indexOf('الرئيسية') >= 0 ||
        raw.indexOf('home') >= 0 ||
        raw.indexOf('index.html') >= 0 ||
        raw.indexOf('dashboard') >= 0
      );
    }

    document.addEventListener('click', function (e) {
      if (!isActiveRevisionMode()) return;

      var el = e.target && e.target.closest
        ? e.target.closest('a,button,[onclick],[role="button"]')
        : null;

      if (!isHomeElement(el)) return;

      e.preventDefault();
      e.stopPropagation();
if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      showRevisionExitModal();
    }, true);

    try {
      document.querySelectorAll('a,button,[onclick],[role="button"]').forEach(function (el) {
        if (!isHomeElement(el)) return;
        if (el.dataset.najranRevisionHomeMarked === '1') return;

        el.dataset.najranRevisionHomeMarked = '1';

        var txt = String(el.textContent || '').trim();
        if (txt && txt.indexOf('الخروج من التعديل') < 0) {
          el.textContent = txt + ' / الخروج من التعديل';
        }

        el.title = 'الخروج من تعديل المستخلص والرجوع للمستخلصات المحفوظة';
      });
    } catch (_) {}

    console.warn('[RevisionExit] home button acts as revision exit');
  } catch (e) {
    console.warn('[RevisionExit] failed to install home revision exit', e);
  }
}
 if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () {
    if (!applyRevisionBootSnapshot()) show();
    installHomeAsRevisionExit();
    installRevisionWorkingAutosave();
  });
} else {
  if (!applyRevisionBootSnapshot()) show();
  installHomeAsRevisionExit();
  installRevisionWorkingAutosave();
}

setTimeout(function () {
  if (!applyRevisionBootSnapshot()) show();
  installHomeAsRevisionExit();
  installRevisionWorkingAutosave();
}, 1200);

})();
