/**
 * extract-snapshot.js
 * Local extract snapshots with quota-safe archive writes.
 * V4:
 * - Keeps one latest snapshot for the same draft key.
 * - Prunes old local copies before archive writes.
 * - Falls back to compact operational snapshots when localStorage is near quota.
 * - Never blocks the user just because old local archive data is too large.
 */
(function () {
  'use strict';
  if (window.__NAJRAN_EXTRACT_SNAPSHOT_V4__) return;
  window.__NAJRAN_EXTRACT_SNAPSHOT_V4__ = true;

  var ARCHIVE_KEY = 'extractArchive';
  var LAST_LIGHT_KEY = 'najran_last_local_snapshot_light_v1';
  var MAX_SNAPSHOTS = 12;
  var MAX_SNAPSHOTS_AFTER_QUOTA = 4;
  var MAX_VALUE_CHARS = 260 * 1024;

  var MONTH_NAMES = [
    'يناير','فبراير','مارس','أبريل','مايو','يونيو',
    'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'
  ];

  var TYPE_PAGE = {
    labor: '/original/attendance.html',
    consumables: '/original/consumables.html',
    spare_parts: '/original/spare_parts.html',
    health_centers: '/original/health_centers_attendance.html',
    admin_offices: '/original/admin_offices_attendance.html'
  };

  var OPERATIONAL_EXACT_KEYS = [
    'attendanceData', 'ng_attendanceData', 'nd_attendanceData',
    'centersAttendanceData_v2', 'healthCentersAttendanceData', 'adminOfficesAttendanceData_v1',
    'adminOfficesAttendanceData_v1_localBackup', 'adminOfficesAttendanceData_v1_lastGood',
    'adminOfficesLaborDataSafe_v2', 'adminOfficeNames_v1', 'adminOfficeAffiliations_v1',
    'persistentExtractData', 'persistentContractData', 'extractMonth', 'extractYear', 'extractStart', 'extractEnd',
    'extractFromDate', 'extractToDate', 'paymentNumber', 'extractNumber', 'periodMonth',
    'performanceData', 'performanceData_v4', 'performanceDeductions', 'performanceTotalDeduction', 'performanceTotalDue',
    'adminOfficePerformanceDeductions_v1', 'achievementData', 'achievementTitles_v1', 'achievementItemNames',
    'consumablesTableData', 'healthCentersConsumables', 'mainHospitalConsumables', 'admin_offices_consumables_v1.0',
    'spare_partsData', 'sparePartsTotalAmount', 'approvalData', 'displayApprovalData',
    'finalLaborCost', 'finalConsumablesCost', 'grand-net-total', 'grand-net-total-centers', 'grand-net-total-admin',
    'companyName', 'contractNumber', 'contractDetails', 'hospitalName',
    'najran_labor_attendance_done', 'najran_labor_performance_done', 'najran_health_attendance_done', 'najran_admin_offices_attendance_done',
    'najran_local_draft_resume_id', 'najran_local_draft_resumed_at'
  ];

  var OPERATIONAL_PREFIXES = [
    'deptCalculatedCost_', 'dept_', 'tableData_', 'achievement_', 'consumables_', 'spare_',
    'water_', 'sewage_', 'subcontractors_', 'najran_labor_', 'najran_health_', 'najran_admin_',
    'adminOffice', 'adminOffices', 'admin_offices_',
    'adminOfficePerformanceItems_', 'adminOfficesPerformanceData_', 'adminOfficesPerformanceDeductions_',
    'adminOfficeAttendance_'
  ];

  var SIGNATURE_EXACT_KEYS = ['signatures_data_consumables_v27'];
  var SIGNATURE_PREFIXES = ['sb_sigs_', 'sb_prefs_', 'healthCenters_Signatures_'];

  var SNAPSHOT_SKIP_PREFIXES = [
    'najran_session', '__clerk', 'clerk_', 'loglevel', 'amplitude', 'chakra', 'persist:', '_u'
  ];

  var SNAPSHOT_SKIP_KEYS = {
    extractArchive: true,
    najranSignedPdfs: true,
    najran_revision_previous_local_backup: true,
    najran_revision_mode: true,
    najran_revision_extract_id: true,
    najran_revision_extract_type: true,
    najran_revision_started_at: true,
    najran_revision_boot_lock: true,
    najran_revision_source: true,
    najran_revision_snapshot: true,
    najran_revision_previous_total_amount: true,
    adminOfficesManualCleared_v1: true,
    najran_local_resume_transaction_id: true,
    najran_local_resume_signature_policy: true,
    najran_local_resume_signature_keys_count: true,
    najran_local_resume_written_keys_count: true,
    najran_local_resume_failed_keys_count: true,
    najran_local_resume_cleared_keys_count: true,
    najran_last_local_snapshot_light_v1: true
  };

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) { return fallback; }
  }

  function parseStorageValue(raw) {
    if (raw == null) return raw;
    try { return JSON.parse(raw); } catch (_) { return raw; }
  }

  function stringify(value) {
    return typeof value === 'string' ? value : JSON.stringify(value);
  }

  function clean(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function startsWithAny(key, prefixes) {
    key = String(key || '');
    return prefixes.some(function (prefix) { return key.indexOf(prefix) === 0; });
  }

  function isOperationalSignatureKey(key) {
    key = String(key || '');
    return SIGNATURE_EXACT_KEYS.indexOf(key) > -1 || startsWithAny(key, SIGNATURE_PREFIXES);
  }

  function isOperationalKey(key) {
    key = String(key || '');
    return OPERATIONAL_EXACT_KEYS.indexOf(key) > -1 || startsWithAny(key, OPERATIONAL_PREFIXES) || isOperationalSignatureKey(key);
  }

  function isHeavyValue(raw) {
    var s = String(raw == null ? '' : raw);
    if (!s) return false;
    if (s.length > MAX_VALUE_CHARS && s.indexOf('adminOfficesAttendanceData') === -1) return true;
    if (s.indexOf('data:image') > -1) return true;
    if (s.indexOf(';base64,') > -1) return true;
    if (s.indexOf('base64') > -1 && s.length > 20000) return true;
    return false;
  }

  function countMatchingKeys(obj, predicate) {
    var total = 0;
    try {
      Object.keys(obj || {}).forEach(function (key) { if (predicate(key)) total++; });
    } catch (_) {}
    return total;
  }

  function safeSet(key, value) {
    try {
      localStorage.setItem(key, stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function getStorageUsage() {
    var total = 0;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        var val = key ? localStorage.getItem(key) : '';
        total += String(key || '').length + String(val || '').length;
      }
    } catch (_) {}
    return total;
  }

  function pruneKeysByPattern(pattern, keep) {
    var removed = 0;
    var list = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && pattern.test(key)) {
          var raw = '';
          try { raw = localStorage.getItem(key) || ''; } catch (_) {}
          list.push({ key: key, size: raw.length });
        }
      }
      list.sort(function (a, b) { return a.key.localeCompare(b.key); });
      while (list.length > keep) {
        localStorage.removeItem(list.shift().key);
        removed++;
      }
    } catch (_) {}
    return removed;
  }

  function compactArchive(archive, limit) {
    archive = Array.isArray(archive) ? archive.filter(Boolean) : [];
    archive.sort(function (a, b) { return String(b.savedAt || '').localeCompare(String(a.savedAt || '')); });
    var byKey = {};
    var out = [];
    archive.forEach(function (snap) {
      var dk = snap.draftKey || 'unknown';
      byKey[dk] = (byKey[dk] || 0) + 1;
      if (byKey[dk] <= 1) out.push(snap);
    });
    return out.slice(0, limit || MAX_SNAPSHOTS);
  }

  function pruneOldLocalCopiesForSpace() {
    var removed = 0;
    try {
      removed += pruneKeysByPattern(/^monthSafetySnapshot_\d+$/, 1);
      removed += pruneKeysByPattern(/^monthSnapshot_/, 2);
      removed += pruneKeysByPattern(/^najran_last_local_snapshot/, 1);
      ['hrl_snapshot_v1', 'adminOfficesPreWipeSnapshot_v1', 'najran_revision_previous_local_backup'].forEach(function (key) {
        try { if (localStorage.getItem(key) != null) { localStorage.removeItem(key); removed++; } } catch (_) {}
      });
      var archive = window.getExtractArchive ? window.getExtractArchive() : [];
      if (Array.isArray(archive) && archive.length) {
        var compact = compactArchive(archive, MAX_SNAPSHOTS_AFTER_QUOTA);
        if (compact.length < archive.length) {
          try { localStorage.setItem(ARCHIVE_KEY, JSON.stringify(compact)); removed += archive.length - compact.length; } catch (_) {}
        }
      }
    } catch (_) {}
    return removed;
  }

  function shouldCaptureKey(key, compactMode) {
    key = String(key || '');
    if (!key) return false;
    if (SNAPSHOT_SKIP_KEYS[key]) return false;
    if (SNAPSHOT_SKIP_PREFIXES.some(function (p) { return key.indexOf(p) === 0; })) return false;
    if (compactMode) return isOperationalKey(key);
    return true;
  }

  function captureSnapshot(compactMode) {
    var snapshot = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!shouldCaptureKey(key, compactMode)) continue;
        var raw = localStorage.getItem(key);
        if (raw == null) continue;
        if (isHeavyValue(raw) && !isOperationalKey(key)) continue;
        snapshot[key] = parseStorageValue(raw);
      }
    } catch (e) {
      console.warn('extract-snapshot: capture error', e);
    }
    return snapshot;
  }

  function clearOperationalKeysBeforeLocalResume() {
    var removed = 0;
    try {
      OPERATIONAL_EXACT_KEYS.forEach(function (key) {
        if (localStorage.getItem(key) !== null) removed++;
        localStorage.removeItem(key);
      });
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var key = localStorage.key(i);
        if (!key) continue;
        if (isOperationalKey(key)) {
          localStorage.removeItem(key);
          removed++;
        }
      }
      localStorage.removeItem('adminOfficesManualCleared_v1');
    } catch (e) {
      console.warn('extract-snapshot: clear operational keys error', e);
    }
    return removed;
  }

  function writeSnapshotToLocalStorage(snapshot) {
    var report = { written: 0, failed: 0, failedKeys: [], prunedKeys: 0 };
    Object.keys(snapshot || {}).forEach(function (key) {
      if (safeSet(key, snapshot[key])) report.written++;
      else { report.failed++; report.failedKeys.push(key); }
    });
    if (report.failed > 0) {
      report.prunedKeys = pruneOldLocalCopiesForSpace();
      var retry = report.failedKeys.slice();
      report.failed = 0;
      report.failedKeys = [];
      retry.forEach(function (key) {
        if (safeSet(key, snapshot[key])) report.written++;
        else { report.failed++; report.failedKeys.push(key); }
      });
    }
    return report;
  }

  function markResumeTransaction(snap, clearCount, writeReport) {
    try {
      localStorage.setItem('najran_local_resume_transaction_id', String(snap.id));
      localStorage.setItem('najran_local_resume_signature_policy', 'clear-operational-signatures-then-restore-snapshot');
      localStorage.setItem('najran_local_resume_signature_keys_count', String(countMatchingKeys(snap.extractData, isOperationalSignatureKey)));
      localStorage.setItem('najran_local_resume_written_keys_count', String(writeReport.written || 0));
      localStorage.setItem('najran_local_resume_failed_keys_count', String(writeReport.failed || 0));
      localStorage.setItem('najran_local_resume_cleared_keys_count', String(clearCount || 0));
    } catch (_) {}
  }

  function normalizeDraftPart(value) {
    return clean(value).toLowerCase();
  }

  function makeDraftKey(parts) {
    return [
      normalizeDraftPart(parts.extractType),
      normalizeDraftPart(parts.hospitalName),
      normalizeDraftPart(parts.companyName),
      normalizeDraftPart(parts.contractDetails),
      normalizeDraftPart(parts.paymentNumber),
      normalizeDraftPart(parts.extractMonth),
      normalizeDraftPart(parts.extractYear)
    ].join('|');
  }

  function inferExtractType() {
    var path = (window.location.pathname || '').toLowerCase();
    if (path.indexOf('health_centers') > -1) return 'health_centers';
    if (path.indexOf('admin_offices') > -1) return 'admin_offices';
    if (path.indexOf('spare_parts') > -1) return 'spare_parts';
    if (path.indexOf('consumables') > -1) return 'consumables';
    if (readJson('healthCentersAttendanceData', null) || readJson('healthCentersConsumables', null)) return 'health_centers';
    if (readJson('adminOfficesAttendanceData_v1', null) || readJson('admin_offices_consumables_v1.0', null)) return 'admin_offices';
    if (readJson('spare_partsData', null) || localStorage.getItem('sparePartsTotalAmount')) return 'spare_parts';
    if (readJson('consumablesTableData', null) || readJson('mainHospitalConsumables', null)) return 'consumables';
    return 'labor';
  }

  function pageForType(type, currentPage) {
    if (currentPage && currentPage.indexOf('/original/') === 0) return currentPage;
    return TYPE_PAGE[type] || '/original/attendance.html';
  }

  function hasMeaningfulLocalWork() {
    var keys = [
      'attendanceData', 'ng_attendanceData', 'nd_attendanceData',
      'healthCentersAttendanceData', 'centersAttendanceData_v2', 'adminOfficesAttendanceData_v1',
      'achievementData', 'consumablesTableData', 'healthCentersConsumables', 'mainHospitalConsumables',
      'admin_offices_consumables_v1.0', 'spare_partsData', 'sparePartsTotalAmount'
    ];
    try {
      for (var i = 0; i < keys.length; i++) {
        var raw = localStorage.getItem(keys[i]);
        if (raw && raw !== '{}' && raw !== '[]' && raw !== '0') return true;
      }
      for (var j = 0; j < localStorage.length; j++) {
        var key = localStorage.key(j);
        if (!key || !isOperationalSignatureKey(key)) continue;
        var val = localStorage.getItem(key);
        if (val && val !== '{}' && val !== '[]' && val !== '""') return true;
      }
      return ['najran_labor_attendance_done', 'najran_labor_performance_done', 'najran_health_attendance_done', 'najran_admin_offices_attendance_done']
        .some(function (key) { return localStorage.getItem(key) === '1'; });
    } catch (_) { return false; }
  }

  function getCurrentLocalWorkLabel() {
    try {
      var extractData = readJson('persistentExtractData', {});
      var contractData = readJson('persistentContractData', {});
      var payment = extractData.paymentNumber || localStorage.getItem('paymentNumber') || localStorage.getItem('extractNumber') || '';
      var month = extractData.extractMonth || localStorage.getItem('extractMonth') || '';
      var year = extractData.extractYear || localStorage.getItem('extractYear') || '';
      var hospital = contractData.hospitalName || localStorage.getItem('hospitalName') || '';
      var company = contractData.companyName || localStorage.getItem('companyName') || '';
      var parts = [];
      if (payment) parts.push('رقم الدفعة: ' + payment);
      if (month || year) parts.push('الفترة: ' + [month, year].filter(Boolean).join(' '));
      if (hospital) parts.push('الموقع: ' + hospital);
      if (company) parts.push('الشركة: ' + company);
      return parts.join(' — ') || 'مستخلص محلي مفتوح حاليًا';
    } catch (_) { return 'مستخلص محلي مفتوح حاليًا'; }
  }

  function showLocalProtectionModal(options) {
    options = options || {};
    return new Promise(function (resolve) {
      var old = document.getElementById('najran-local-protection-modal');
      if (old) old.remove();
      var overlay = document.createElement('div');
      overlay.id = 'najran-local-protection-modal';
      overlay.className = 'no-print';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:10000000;background:rgba(15,23,42,.62);display:flex;align-items:center;justify-content:center;direction:rtl;font-family:Tajawal,Arial,sans-serif;';
      overlay.innerHTML =
        '<div style="width:min(620px,94vw);background:#fff;border-radius:22px;padding:24px;box-shadow:0 28px 80px rgba(0,0,0,.32);border-top:7px solid #b45309;text-align:right;">' +
        '<div style="display:flex;gap:14px;align-items:flex-start;margin-bottom:14px;"><div style="width:52px;height:52px;border-radius:17px;background:#fff7ed;color:#b45309;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;">!</div>' +
        '<div style="flex:1;"><h2 style="margin:0;color:#92400e;font-size:22px;font-weight:900;">' + (options.title || 'يوجد مستخلص محلي غير محفوظ') + '</h2>' +
        '<p style="margin:8px 0 0;color:#475569;font-size:14px;line-height:1.9;">' + (options.message || 'قبل الانتقال، احفظ المستخلص الحالي محليًا حتى لا يتم استبدال البيانات الموجودة على هذا الجهاز.') + '</p></div></div>' +
        '<div style="background:#fffbeb;border:1px solid #fde68a;color:#78350f;border-radius:14px;padding:12px 14px;font-size:13px;line-height:1.9;margin:14px 0;"><b>البيانات الحالية:</b><br>' + getCurrentLocalWorkLabel() + '</div>' +
        '<div style="display:flex;gap:10px;justify-content:flex-start;flex-wrap:wrap;margin-top:16px;">' +
        '<button id="najran-local-protection-primary" style="background:linear-gradient(135deg,#15803d,#16a34a)!important;color:white;border:0;border-radius:12px;padding:12px 18px;font-weight:900;cursor:pointer;font-family:Tajawal,Arial,sans-serif;">' + (options.primaryText || 'حفظ محليًا ثم المتابعة') + '</button>' +
        '<button id="najran-local-protection-secondary" style="background:#1e3a8a;color:white;border:0;border-radius:12px;padding:12px 18px;font-weight:900;cursor:pointer;font-family:Tajawal,Arial,sans-serif;">' + (options.secondaryText || 'استكمال المستخلص الحالي') + '</button>' +
        '<button id="najran-local-protection-cancel" style="background:#475569;color:white;border:0;border-radius:12px;padding:12px 18px;font-weight:900;cursor:pointer;font-family:Tajawal,Arial,sans-serif;">' + (options.cancelText || 'إلغاء') + '</button>' +
        '</div></div>';
      document.body.appendChild(overlay);
      function close(result) { overlay.remove(); resolve(result); }
      document.getElementById('najran-local-protection-primary').onclick = function () { close('primary'); };
      document.getElementById('najran-local-protection-secondary').onclick = function () { close('secondary'); };
      document.getElementById('najran-local-protection-cancel').onclick = function () { close('cancel'); };
    });
  }

  window.getExtractArchive = function () {
    try {
      var parsed = JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) { return []; }
  };

  window.setExtractArchive = function (archive) {
    archive = compactArchive(archive || [], MAX_SNAPSHOTS);
    if (safeSet(ARCHIVE_KEY, archive)) return true;
    var removed = pruneOldLocalCopiesForSpace();
    archive = compactArchive(archive, MAX_SNAPSHOTS_AFTER_QUOTA);
    if (safeSet(ARCHIVE_KEY, archive)) {
      console.warn('extract-snapshot: archive saved after quota prune', { removed: removed, kept: archive.length });
      return true;
    }
    return false;
  };

  function buildSnapshot(source, compactMode) {
    var extractData = readJson('persistentExtractData', {});
    var contractData = readJson('persistentContractData', {});
    var fullSnapshot = captureSnapshot(!!compactMode);
    var extractType = inferExtractType();
    var currentPage = window.location.pathname || pageForType(extractType);
    var paymentNumber = extractData.paymentNumber || localStorage.getItem('paymentNumber') || '';
    var extractMonth = extractData.extractMonth || localStorage.getItem('extractMonth') || '';
    var extractYear = String(extractData.extractYear || localStorage.getItem('extractYear') || '');
    var extractStart = extractData.extractStart || localStorage.getItem('extractStart') || '';
    var extractEnd = extractData.extractEnd || localStorage.getItem('extractEnd') || '';
    var hospitalName = contractData.hospitalName || localStorage.getItem('hospitalName') || '';
    var companyName = contractData.companyName || localStorage.getItem('companyName') || '';
    var contractDetails = contractData.contractDetails || contractData.contractNumber || localStorage.getItem('contractDetails') || '';

    var totalEmployees = 0;
    var totalNetAmount = 0;
    var departments = {};
    try {
      var ATT_KEY_BY_TYPE = { labor: 'attendanceData', admin_offices: 'adminOfficesAttendanceData_v1', health_centers: 'centersAttendanceData_v2' };
      var att = readJson(ATT_KEY_BY_TYPE[extractType] || 'attendanceData', {});
      function empNet(emp) {
        var direct = parseFloat(emp.netSalary != null ? emp.netSalary : emp.finalSalary);
        if (isFinite(direct) && direct !== 0) return Math.max(0, direct);
        var sal = parseFloat(emp.salary || emp.monthlySalary) || 0;
        var ded = parseFloat(emp.totalDeduction != null ? emp.totalDeduction : (emp.deduction != null ? emp.deduction : emp.absenceDeduction)) || 0;
        var fine = (parseFloat(emp.totalFine) || 0) + (parseFloat(emp.nationalityFine) || 0);
        return Math.max(0, sal - ded - fine);
      }
      Object.keys(att || {}).forEach(function (dept) {
        var emps = Array.isArray(att[dept]) ? att[dept] : [];
        var deptNet = emps.reduce(function (s, emp) { return s + empNet(emp || {}); }, 0);
        departments[dept] = { count: emps.length, total: deptNet };
        totalEmployees += emps.length;
        totalNetAmount += deptNet;
      });
      if (extractType === 'consumables' && !totalNetAmount) totalNetAmount = parseFloat(localStorage.getItem('finalConsumablesCost')) || 0;
      if (extractType === 'spare_parts' && !totalNetAmount) totalNetAmount = parseFloat(localStorage.getItem('sparePartsTotalAmount')) || 0;
      if (extractType === 'admin_offices' && !totalNetAmount) totalNetAmount = parseFloat(localStorage.getItem('grand-net-total-admin')) || parseFloat(localStorage.getItem('finalLaborCost')) || 0;
    } catch (_) {}

    var draftKey = makeDraftKey({ extractType: extractType, hospitalName: hospitalName, companyName: companyName, contractDetails: contractDetails, paymentNumber: paymentNumber, extractMonth: extractMonth, extractYear: extractYear });

    return {
      id: String(Date.now()),
      draftKey: draftKey,
      savedAt: new Date().toISOString(),
      source: source || 'manual',
      canResume: true,
      compact: !!compactMode,
      extractType: extractType,
      currentPage: currentPage,
      extractData: fullSnapshot,
      paymentNumber: paymentNumber,
      extractMonth: extractMonth,
      extractYear: extractYear,
      extractStart: extractStart,
      extractEnd: extractEnd,
      hospitalName: hospitalName,
      companyName: companyName,
      contractDetails: contractDetails,
      engineeringManager: contractData.engineeringManager || '',
      generalServicesManager: contractData.generalServicesManager || '',
      hospitalManager: contractData.hospitalManager || '',
      followUpManager: contractData.followUpManager || '',
      totalEmployees: totalEmployees,
      totalNetAmount: totalNetAmount,
      departments: departments,
      signatureKeysCount: countMatchingKeys(fullSnapshot, isOperationalSignatureKey),
      operationalKeysCount: countMatchingKeys(fullSnapshot, isOperationalKey),
      storageUsageAtSave: getStorageUsage()
    };
  }

  function replaceSameDraft(archive, snap) {
    archive = Array.isArray(archive) ? archive.filter(Boolean) : [];
    archive = archive.filter(function (oldSnap) {
      if (!oldSnap) return false;
      if (oldSnap.draftKey && oldSnap.draftKey === snap.draftKey) return false;
      if (!oldSnap.draftKey) {
        var oldKey = makeDraftKey({
          extractType: oldSnap.extractType || 'labor',
          hospitalName: oldSnap.hospitalName,
          companyName: oldSnap.companyName,
          contractDetails: oldSnap.contractDetails,
          paymentNumber: oldSnap.paymentNumber,
          extractMonth: oldSnap.extractMonth,
          extractYear: oldSnap.extractYear
        });
        if (oldKey === snap.draftKey) return false;
      }
      return true;
    });
    archive.unshift(snap);
    return compactArchive(archive, MAX_SNAPSHOTS);
  }

  window.saveExtractSnapshot = function (source) {
    source = source || 'manual';
    var snap = null;
    try {
      var archive = window.getExtractArchive();
      snap = buildSnapshot(source, false);
      var existing = archive.find(function (s) { return s && s.draftKey === snap.draftKey && s.id; });
      if (existing && existing.id) snap.id = String(existing.id);

      if (window.setExtractArchive(replaceSameDraft(archive, snap))) {
        try {
          localStorage.setItem('najran_last_local_snapshot_key', snap.draftKey);
          localStorage.setItem('najran_last_local_snapshot_replaced', '1');
        } catch (_) {}
        return snap;
      }

      console.warn('extract-snapshot: full archive write failed; retry compact snapshot');
      pruneOldLocalCopiesForSpace();
      snap = buildSnapshot(source, true);
      if (existing && existing.id) snap.id = String(existing.id);
      if (window.setExtractArchive(replaceSameDraft([], snap))) {
        try { localStorage.setItem(LAST_LIGHT_KEY, JSON.stringify(snap)); } catch (_) {}
        return snap;
      }

      try { localStorage.setItem(LAST_LIGHT_KEY, JSON.stringify({ id: snap.id, draftKey: snap.draftKey, savedAt: snap.savedAt, source: source, extractType: snap.extractType, currentPage: snap.currentPage, paymentNumber: snap.paymentNumber, extractMonth: snap.extractMonth, extractYear: snap.extractYear, hospitalName: snap.hospitalName, companyName: snap.companyName, totalEmployees: snap.totalEmployees, totalNetAmount: snap.totalNetAmount, compactFailed: true })); } catch (_) {}
      console.warn('extract-snapshot: local archive quota still full; metadata fallback saved only');
      return snap;
    } catch (e) {
      console.warn('extract-snapshot: save error', e);
      return snap;
    }
  };

  window.resumeExtractSnapshot = function (id, options) {
    options = options || {};
    try {
      var snap = window.getExtractArchive().find(function (s) { return String(s.id) === String(id); });
      if (!snap) { alert('لم يتم العثور على اللقطة المحلية.'); return false; }
      if (!snap.extractData || typeof snap.extractData !== 'object') {
        alert('هذه اللقطة لا تحتوي بيانات تشغيلية كافية للاستكمال.');
        return false;
      }

      if (hasMeaningfulLocalWork() && !options.skipProtection) {
        showLocalProtectionModal({
          title: 'يوجد مستخلص مفتوح على هذا الجهاز',
          message: 'استكمال لقطة محلية أخرى سيستبدل البيانات الحالية. سيتم حفظ نسخة محلية أولًا على هذا الجهاز فقط، بدون رفع للسحابة.',
          primaryText: 'حفظ محلي ثم استكمال اللقطة',
          secondaryText: 'استكمال المستخلص الحالي',
          cancelText: 'إلغاء'
        }).then(function (action) {
          if (action === 'primary') {
            var saved = window.saveExtractSnapshot('before-resume-local-snapshot');
            if (!saved) { alert('تعذر حفظ المستخلص الحالي محليًا. لم يتم استكمال اللقطة الأخرى.'); return; }
            window.resumeExtractSnapshot(id, { skipProtection: true });
          }
        });
        return false;
      }

      var clearCount = clearOperationalKeysBeforeLocalResume();
      var writeReport = writeSnapshotToLocalStorage(snap.extractData);
      markResumeTransaction(snap, clearCount, writeReport);
      if (writeReport.failed > 0) {
        console.warn('extract-snapshot: resume partial write failure', writeReport);
        alert('تم استكمال اللقطة جزئيًا، لكن بعض المفاتيح الثانوية لم تُحفظ بسبب مساحة المتصفح. البيانات الأساسية محفوظة.');
        return false;
      }

      ['najran_revision_extract_id','najran_revision_mode','najran_revision_extract_type','najran_revision_started_at','najran_revision_boot_lock','najran_revision_source','najran_revision_snapshot','najran_revision_previous_total_amount','adminOfficesManualCleared_v1'].forEach(function (key) {
        try { localStorage.removeItem(key); } catch (_) {}
      });

      try {
        localStorage.setItem('najran_local_draft_resume_id', String(snap.id));
        localStorage.setItem('najran_local_draft_resumed_at', new Date().toISOString());
      } catch (_) {}

      console.info('extract-snapshot: local resume transaction', { id: snap.id, type: snap.extractType, cleared: clearCount, written: writeReport.written, signatureKeys: countMatchingKeys(snap.extractData, isOperationalSignatureKey) });
      window.location.href = pageForType(snap.extractType || inferExtractType(), snap.currentPage);
      return true;
    } catch (e) {
      console.warn('extract-snapshot: resume error', e);
      alert('تعذر استكمال اللقطة المحلية.');
      return false;
    }
  };

  window.deleteExtractSnapshot = function (id) {
    try {
      var arc = window.getExtractArchive().filter(function (s) { return String(s.id) !== String(id); });
      return window.setExtractArchive(arc);
    } catch (_) { return false; }
  };

  window.checkDuplicateExtract = function (paymentNumber, month, year) {
    var pn = String(paymentNumber || '').trim();
    if (!pn) return null;
    return window.getExtractArchive().find(function (s) {
      return String(s.paymentNumber || '') === pn && String(s.extractMonth || '') === String(month || '') && String(s.extractYear || '') === String(year || '');
    }) || null;
  };

  function toLocalDateStr(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function parseLocalDate(str) {
    var parts = (str || '').split('-');
    if (parts.length < 3) return new Date(str);
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }

  window.autoIncrementExtractPeriod = function () {
    try {
      var data = readJson('persistentExtractData', {});
      if (!data.extractStart) return null;
      var start = parseLocalDate(data.extractStart);
      start.setDate(1);
      start.setMonth(start.getMonth() + 1);
      var end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      var pn = String(data.paymentNumber || '1').trim();
      var num = parseInt(pn, 10);
      var newPn = isNaN(num) ? pn : String(num + 1).padStart(pn.length, '0');
      var newData = Object.assign({}, data, { extractMonth: MONTH_NAMES[start.getMonth()], extractYear: start.getFullYear(), paymentNumber: newPn, extractStart: toLocalDateStr(start), extractEnd: toLocalDateStr(end) });
      localStorage.setItem('persistentExtractData', JSON.stringify(newData));
      return newData;
    } catch (e) {
      console.warn('extract-snapshot: autoIncrement error', e);
      return null;
    }
  };

  function enhanceArchiveResumeButtons() {
    try {
      var archive = window.getExtractArchive();
      archive.forEach(function (snap) {
        if (!snap || !snap.canResume || !snap.extractData) return;
        var card = document.getElementById('card-' + snap.id);
        if (!card || card.querySelector('.arc-btn-resume')) return;
        var actions = card.querySelector('.arc-actions');
        if (!actions) return;
        var btn = document.createElement('button');
        btn.className = 'arc-btn arc-btn-resume';
        btn.style.background = 'linear-gradient(135deg,#15803d,#16a34a)';
        btn.style.color = '#fff';
        btn.innerHTML = '<i class="fas fa-play"></i> استكمال';
        btn.onclick = function () { window.resumeExtractSnapshot(snap.id); };
        actions.insertBefore(btn, actions.firstChild);
      });
    } catch (_) {}
  }

  function installArchiveRenderPatch() {
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      if (typeof window.renderArchive === 'function' && !window.__NAJRAN_ARCHIVE_RESUME_PATCH__) {
        window.__NAJRAN_ARCHIVE_RESUME_PATCH__ = true;
        var originalRenderArchive = window.renderArchive;
        window.renderArchive = function () {
          var out = originalRenderArchive.apply(this, arguments);
          setTimeout(enhanceArchiveResumeButtons, 0);
          return out;
        };
        setTimeout(enhanceArchiveResumeButtons, 0);
        clearInterval(timer);
      }
      if (tries > 40) clearInterval(timer);
    }, 100);
  }

  function installLocalSaveOnHomeExit() {
    var file = (window.location.pathname || '').split('/').pop() || '';
    var workPages = {
      'attendance.html': true,
      'performance.html': true,
      'achievement.html': true,
      'consumables.html': true,
      'spare_parts.html': true,
      'health_centers_attendance.html': true,
      'health_centers_consumables.html': true,
      'admin_offices_attendance.html': true,
      'admin_offices_consumables.html': true,
      'najran_general_attendance.html': true,
      'najran_general_performance.html': true,
      'najran_general_achievement.html': true,
      'najran_dental_attendance.html': true,
      'najran_dental_performance.html': true
    };
    if (!workPages[file]) return;

    document.addEventListener('click', function (e) {
      var el = e.target && e.target.closest ? e.target.closest('a,button') : null;
      if (!el) return;
      var href = el.getAttribute('href') || '';
      var text = (el.textContent || '').trim();
      var goesHome = href === '/dashboard' || href.indexOf('/dashboard') === 0 || text.indexOf('الرئيسية') > -1;
      if (!goesHome) return;
      if (!hasMeaningfulLocalWork()) return;
      e.preventDefault();
      e.stopPropagation();
      showLocalProtectionModal({
        title: 'يوجد مستخلص مفتوح على هذا الجهاز',
        message: 'قبل الرجوع للرئيسية، سيتم حفظ نسخة محلية من المستخلص الحالي على هذا الجهاز فقط. لن يتم رفع أي بيانات للسحابة.',
        primaryText: 'حفظ محلي ثم الرجوع للرئيسية',
        secondaryText: 'استكمال المستخلص الحالي',
        cancelText: 'إلغاء'
      }).then(function (action) {
        if (action === 'primary') {
          var snap = window.saveExtractSnapshot('home-exit-save');
          if (!snap) { alert('تعذر حفظ المستخلص الحالي محليًا. لم يتم الخروج من الصفحة.'); return; }
          alert('تم حفظ آخر نسخة من هذا المستخلص محليًا. يمكنك استكمالها لاحقًا من أرشيف المستخلصات > لقطات العمل المحلية.');
          window.location.href = href || '/dashboard';
        }
      });
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      installArchiveRenderPatch();
      installLocalSaveOnHomeExit();
    });
  } else {
    installArchiveRenderPatch();
    installLocalSaveOnHomeExit();
  }

  console.info('[Najran Extract Snapshot] installed v4 quota-safe local resume');
})();