/**
 * extract-snapshot.js
 * Scoped local extract snapshots.
 * V5:
 * - Saves only the keys that belong to the current extract type.
 * - Determines extract type from the current page first, not from stale localStorage keys.
 * - Prevents labor local snapshots from carrying admin offices data.
 * - Keeps the existing public API: getExtractArchive / setExtractArchive / saveExtractSnapshot / resumeExtractSnapshot / deleteExtractSnapshot / checkDuplicateExtract.
 */
(function () {
  'use strict';
  if (window.__NAJRAN_EXTRACT_SNAPSHOT_V5__) return;
  window.__NAJRAN_EXTRACT_SNAPSHOT_V5__ = true;

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

  var COMMON_EXACT_KEYS = [
    'persistentExtractData', 'persistentContractData',
    'extractMonth', 'extractYear', 'extractStart', 'extractEnd',
    'extractFromDate', 'extractToDate', 'paymentNumber', 'extractNumber', 'periodMonth',
    'companyName', 'contractNumber', 'contractDetails', 'hospitalName',
    'approvalData', 'displayApprovalData',
    'najran_local_draft_resume_id', 'najran_local_draft_resumed_at',
    'najran_work_context_v1', 'najran_last_submitted_summary_v1', 'najran_last_submitted_extract_id', 'najran_current_extract_submitted'
  ];

  var TYPE_RULES = {
    labor: {
      exact: [
        'attendanceData', 'ng_attendanceData', 'nd_attendanceData',
        'performanceData', 'performanceData_v4', 'performanceDeductions', 'performanceTotalDeduction', 'performanceTotalDue',
        'achievementData', 'achievementTitles_v1', 'achievementItemNames',
        'finalLaborCost', 'grand-net-total',
        'najran_labor_attendance_done', 'najran_labor_performance_done'
      ],
      prefixes: ['deptCalculatedCost_', 'dept_', 'tableData_', 'achievement_', 'sb_sigs_', 'sb_prefs_'],
      blockPrefixes: ['adminOffice', 'adminOffices', 'admin_offices_', 'adminOfficePerformanceItems_', 'adminOfficesPerformanceData_', 'adminOfficesPerformanceDeductions_', 'adminOfficeAttendance_', 'najran_admin_', 'healthCenters_', 'healthCenters', 'centersAttendance', 'najran_health_'],
      blockExact: ['adminOfficesAttendanceData_v1', 'adminOfficesAttendanceData_v1_localBackup', 'adminOfficesAttendanceData_v1_lastGood', 'adminOfficesLaborDataSafe_v2', 'adminOfficeNames_v1', 'adminOfficeAffiliations_v1', 'admin_offices_consumables_v1.0', 'adminOfficePerformanceDeductions_v1', 'grand-net-total-admin', 'healthCentersAttendanceData', 'centersAttendanceData_v2', 'healthCentersConsumables', 'healthCentersConsumablesSummary', 'grand-net-total-centers']
    },
    consumables: {
      exact: [
        'consumablesTableData', 'mainHospitalConsumables', 'summary_data_consumables_v27', 'signatures_data_consumables_v27',
        'finalConsumablesCost', 'grand-net-total',
        'subcontractors_data_consumables_v27', 'performance_data_consumables_v27', 'water_supply_data_consumables_v27', 'sewage_disposal_data_consumables_v27'
      ],
      prefixes: ['consumables_', 'water_', 'sewage_', 'subcontractors_', 'sb_sigs_', 'sb_prefs_'],
      blockPrefixes: ['adminOffice', 'adminOffices', 'admin_offices_', 'najran_admin_', 'healthCenters_', 'healthCenters', 'centersAttendance', 'najran_health_'],
      blockExact: ['adminOfficesAttendanceData_v1', 'admin_offices_consumables_v1.0', 'healthCentersAttendanceData', 'centersAttendanceData_v2', 'healthCentersConsumables', 'healthCentersConsumablesSummary']
    },
    spare_parts: {
      exact: ['spare_partsData', 'sparePartsTotalAmount', 'grand-net-total'],
      prefixes: ['spare_', 'sb_sigs_', 'sb_prefs_'],
      blockPrefixes: ['adminOffice', 'adminOffices', 'admin_offices_', 'najran_admin_', 'healthCenters_', 'healthCenters', 'centersAttendance', 'najran_health_'],
      blockExact: ['adminOfficesAttendanceData_v1', 'admin_offices_consumables_v1.0', 'healthCentersAttendanceData', 'centersAttendanceData_v2', 'healthCentersConsumables']
    },
    health_centers: {
      exact: [
        'healthCentersAttendanceData', 'centersAttendanceData_v2', 'healthCentersConsumables', 'healthCentersConsumablesSummary',
        'grand-net-total-centers', 'finalLaborCost', 'finalConsumablesCost',
        'najran_health_attendance_done'
      ],
      prefixes: ['healthCenters_', 'healthCenters', 'centersAttendance', 'najran_health_', 'sb_sigs_', 'sb_prefs_'],
      blockPrefixes: ['adminOffice', 'adminOffices', 'admin_offices_', 'najran_admin_'],
      blockExact: ['adminOfficesAttendanceData_v1', 'adminOfficesAttendanceData_v1_localBackup', 'adminOfficesAttendanceData_v1_lastGood', 'adminOfficeNames_v1', 'adminOfficeAffiliations_v1', 'admin_offices_consumables_v1.0', 'grand-net-total-admin']
    },
    admin_offices: {
      exact: [
        'adminOfficesAttendanceData_v1', 'adminOfficesAttendanceData_v1_localBackup', 'adminOfficesAttendanceData_v1_lastGood',
        'adminOfficesLaborDataSafe_v2', 'adminOfficeNames_v1', 'adminOfficeAffiliations_v1',
        'adminOfficePerformanceDeductions_v1', 'admin_offices_consumables_v1.0',
        'grand-net-total-admin', 'finalLaborCost', 'finalConsumablesCost',
        'najran_admin_offices_attendance_done'
      ],
      prefixes: ['adminOffice', 'adminOffices', 'admin_offices_', 'adminOfficePerformanceItems_', 'adminOfficesPerformanceData_', 'adminOfficesPerformanceDeductions_', 'adminOfficeAttendance_', 'najran_admin_', 'sb_sigs_', 'sb_prefs_'],
      blockPrefixes: ['healthCenters_', 'healthCenters', 'centersAttendance', 'najran_health_'],
      blockExact: ['attendanceData', 'ng_attendanceData', 'nd_attendanceData', 'healthCentersAttendanceData', 'centersAttendanceData_v2', 'healthCentersConsumables', 'grand-net-total-centers']
    }
  };

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
    return (prefixes || []).some(function (prefix) { return key.indexOf(prefix) === 0; });
  }

  function isHeavyValue(raw) {
    var s = String(raw == null ? '' : raw);
    if (!s) return false;
    if (s.length > MAX_VALUE_CHARS) return true;
    if (s.indexOf('data:image') > -1) return true;
    if (s.indexOf(';base64,') > -1) return true;
    if (s.indexOf('base64') > -1 && s.length > 20000) return true;
    return false;
  }

  function safeSet(key, value) {
    try { localStorage.setItem(key, stringify(value)); return true; } catch (_) { return false; }
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

  function inferExtractType() {
    var file = ((window.location.pathname || '').split('/').pop() || '').toLowerCase();
    if (file === 'attendance.html' || file === 'performance.html' || file === 'achievement.html') return 'labor';
    if (file.indexOf('admin_offices') > -1) return 'admin_offices';
    if (file.indexOf('health_centers') > -1) return 'health_centers';
    if (file.indexOf('spare_parts') > -1) return 'spare_parts';
    if (file.indexOf('consumables') > -1) return 'consumables';
    if (file.indexOf('najran_general_attendance') > -1 || file.indexOf('najran_general_performance') > -1 || file.indexOf('najran_general_achievement') > -1) return 'labor';
    if (file.indexOf('najran_dental_attendance') > -1 || file.indexOf('najran_dental_performance') > -1) return 'labor';

    // Fallback only when page cannot identify the module. Never let stale admin keys override labor pages.
    if (readJson('spare_partsData', null) || localStorage.getItem('sparePartsTotalAmount')) return 'spare_parts';
    if (readJson('consumablesTableData', null) || readJson('mainHospitalConsumables', null)) return 'consumables';
    if (readJson('healthCentersAttendanceData', null) || readJson('healthCentersConsumables', null)) return 'health_centers';
    if (readJson('adminOfficesAttendanceData_v1', null) || readJson('admin_offices_consumables_v1.0', null)) return 'admin_offices';
    return 'labor';
  }

  function isAllowedForType(key, type) {
    key = String(key || '');
    if (!key || SNAPSHOT_SKIP_KEYS[key]) return false;
    if (SNAPSHOT_SKIP_PREFIXES.some(function (p) { return key.indexOf(p) === 0; })) return false;

    var rule = TYPE_RULES[type] || TYPE_RULES.labor;
    if ((rule.blockExact || []).indexOf(key) > -1) return false;
    if (startsWithAny(key, rule.blockPrefixes || [])) return false;

    if (COMMON_EXACT_KEYS.indexOf(key) > -1) return true;
    if ((rule.exact || []).indexOf(key) > -1) return true;
    if (startsWithAny(key, rule.prefixes || [])) return true;
    return false;
  }

  function isOperationalSignatureKey(key) {
    key = String(key || '');
    return key === 'signatures_data_consumables_v27' || startsWithAny(key, ['sb_sigs_', 'sb_prefs_', 'healthCenters_Signatures_']);
  }

  function countMatchingKeys(obj, predicate) {
    var total = 0;
    try { Object.keys(obj || {}).forEach(function (key) { if (predicate(key)) total++; }); } catch (_) {}
    return total;
  }

  function captureSnapshot(compactMode, extractType) {
    var snapshot = {};
    var type = extractType || inferExtractType();
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!isAllowedForType(key, type)) continue;
        var raw = localStorage.getItem(key);
        if (raw == null) continue;
        if (isHeavyValue(raw)) continue;
        snapshot[key] = parseStorageValue(raw);
      }
    } catch (e) {
      console.warn('extract-snapshot: scoped capture error', e);
    }
    return snapshot;
  }

  function scopedOperationalKeys(type) {
    var keys = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (isAllowedForType(key, type)) keys.push(key);
      }
    } catch (_) {}
    return keys;
  }

  function allKnownOperationalKey(key) {
    key = String(key || '');
    if (!key) return false;
    if (COMMON_EXACT_KEYS.indexOf(key) > -1) return true;
    return Object.keys(TYPE_RULES).some(function (type) {
      var rule = TYPE_RULES[type] || {};
      return (rule.exact || []).indexOf(key) > -1 || startsWithAny(key, rule.prefixes || []);
    });
  }

  function clearOperationalKeysBeforeLocalResume() {
    var removed = 0;
    try {
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var key = localStorage.key(i);
        if (!key) continue;
        if (allKnownOperationalKey(key)) {
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
    return report;
  }

  function normalizeDraftPart(value) { return clean(value).toLowerCase(); }
  function makeDraftKey(parts) {
    return [
      normalizeDraftPart(parts.extractType), normalizeDraftPart(parts.hospitalName), normalizeDraftPart(parts.companyName),
      normalizeDraftPart(parts.contractDetails), normalizeDraftPart(parts.paymentNumber), normalizeDraftPart(parts.extractMonth), normalizeDraftPart(parts.extractYear)
    ].join('|');
  }

  function pageForType(type, currentPage) {
    if (currentPage && currentPage.indexOf('/original/') === 0) return currentPage;
    return TYPE_PAGE[type] || '/original/attendance.html';
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

  function hasMeaningfulLocalWork() {
    var type = inferExtractType();
    try {
      return scopedOperationalKeys(type).some(function (key) {
        var raw = localStorage.getItem(key);
        return raw && raw !== '{}' && raw !== '[]' && raw !== '0' && raw !== '""';
      });
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
      var type = inferExtractType();
      var typeName = ({ labor: 'عمالة', consumables: 'مستهلكات', spare_parts: 'قطع غيار', health_centers: 'مراكز صحية', admin_offices: 'مكاتب إدارية' })[type] || type;
      var parts = ['النوع: ' + typeName];
      if (payment) parts.push('رقم الدفعة: ' + payment);
      if (month || year) parts.push('الفترة: ' + [month, year].filter(Boolean).join(' '));
      if (hospital) parts.push('الموقع: ' + hospital);
      if (company) parts.push('الشركة: ' + company);
      return parts.join(' — ');
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
        '<h2 style="margin:0;color:#92400e;font-size:22px;font-weight:900;">' + (options.title || 'يوجد مستخلص محلي غير محفوظ') + '</h2>' +
        '<p style="margin:8px 0 0;color:#475569;font-size:14px;line-height:1.9;">' + (options.message || 'قبل الانتقال، احفظ المستخلص الحالي محليًا حتى لا يتم استبدال البيانات الموجودة على هذا الجهاز.') + '</p>' +
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
    pruneOldLocalCopiesForSpace();
    archive = compactArchive(archive, MAX_SNAPSHOTS_AFTER_QUOTA);
    return safeSet(ARCHIVE_KEY, archive);
  };

  function buildSnapshot(source, compactMode) {
    var extractType = inferExtractType();
    var extractData = readJson('persistentExtractData', {});
    var contractData = readJson('persistentContractData', {});
    var fullSnapshot = captureSnapshot(!!compactMode, extractType);
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
      scoped: true,
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
      operationalKeysCount: Object.keys(fullSnapshot || {}).length,
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
          localStorage.setItem('najran_last_local_snapshot_type', snap.extractType);
        } catch (_) {}
        console.info('extract-snapshot: scoped snapshot saved', { id: snap.id, type: snap.extractType, keys: Object.keys(snap.extractData || {}).length });
        return snap;
      }
      console.warn('extract-snapshot: full scoped archive write failed; retry compact snapshot');
      pruneOldLocalCopiesForSpace();
      snap = buildSnapshot(source, true);
      if (existing && existing.id) snap.id = String(existing.id);
      if (window.setExtractArchive(replaceSameDraft([], snap))) {
        try { localStorage.setItem(LAST_LIGHT_KEY, JSON.stringify(snap)); } catch (_) {}
        return snap;
      }
      try { localStorage.setItem(LAST_LIGHT_KEY, JSON.stringify({ id: snap.id, draftKey: snap.draftKey, savedAt: snap.savedAt, source: source, extractType: snap.extractType, currentPage: snap.currentPage, paymentNumber: snap.paymentNumber, extractMonth: snap.extractMonth, extractYear: snap.extractYear, hospitalName: snap.hospitalName, companyName: snap.companyName, totalEmployees: snap.totalEmployees, totalNetAmount: snap.totalNetAmount, compactFailed: true })); } catch (_) {}
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
      try {
        localStorage.setItem('najran_local_resume_transaction_id', String(snap.id));
        localStorage.setItem('najran_local_resume_signature_policy', 'scoped-clear-then-restore-snapshot');
        localStorage.setItem('najran_local_resume_signature_keys_count', String(countMatchingKeys(snap.extractData, isOperationalSignatureKey)));
        localStorage.setItem('najran_local_resume_written_keys_count', String(writeReport.written || 0));
        localStorage.setItem('najran_local_resume_failed_keys_count', String(writeReport.failed || 0));
        localStorage.setItem('najran_local_resume_cleared_keys_count', String(clearCount || 0));
      } catch (_) {}
      if (writeReport.failed > 0) {
        console.warn('extract-snapshot: resume partial write failure', writeReport);
        alert('تم استكمال اللقطة جزئيًا، لكن بعض المفاتيح الثانوية لم تُحفظ بسبب مساحة المتصفح. البيانات الأساسية محفوظة.');
        return false;
      }

      [
        'najran_revision_extract_id','najran_revision_mode','najran_revision_extract_type','najran_revision_started_at','najran_revision_boot_lock','najran_revision_source','najran_revision_snapshot','najran_revision_previous_total_amount','adminOfficesManualCleared_v1'
      ].forEach(function (key) { try { localStorage.removeItem(key); } catch (_) {} });

      try {
        localStorage.setItem('najran_local_draft_resume_id', String(snap.id));
        localStorage.setItem('najran_local_draft_resumed_at', new Date().toISOString());
      } catch (_) {}

      console.info('extract-snapshot: scoped local resume transaction', { id: snap.id, type: snap.extractType, cleared: clearCount, written: writeReport.written, keys: Object.keys(snap.extractData || {}).length });
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

  function installPeriodicAutoSave() {
    var file = (window.location.pathname || '').split('/').pop() || '';
    var autoSavePages = {
      'consumables.html': ['consumablesTableData', 'summary_data_consumables_v27', 'finalConsumablesCost', 'subcontractors_data_consumables_v27', 'performance_data_consumables_v27', 'water_supply_data_consumables_v27', 'sewage_disposal_data_consumables_v27'],
      'spare_parts.html': ['spare_partsData', 'sparePartsTotalAmount'],
      'health_centers_consumables.html': ['healthCentersConsumables', 'healthCentersConsumablesSummary']
    };
    var keys = autoSavePages[file];
    if (!keys) return;
    var lastHash = '';
    function computeHash() {
      var parts = [];
      keys.forEach(function (k) { var v = localStorage.getItem(k); if (v) parts.push(k + ':' + v.length); });
      return parts.join('|');
    }
    function autoSave() {
      try {
        var h = computeHash();
        if (h === lastHash || h === '') return;
        lastHash = h;
        if (typeof window.saveExtractSnapshot === 'function') window.saveExtractSnapshot('auto-save');
      } catch (_) {}
    }
    lastHash = computeHash();
    setInterval(autoSave, 30000);
    window.addEventListener('beforeunload', autoSave);
    console.info('[Najran Extract Snapshot] periodic auto-save installed for', file);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      installArchiveRenderPatch();
      installLocalSaveOnHomeExit();
      installPeriodicAutoSave();
    });
  } else {
    installArchiveRenderPatch();
    installLocalSaveOnHomeExit();
    installPeriodicAutoSave();
  }

  window.najranInferLocalSnapshotType = inferExtractType;
  window.najranCaptureScopedSnapshot = function () { return captureSnapshot(false, inferExtractType()); };

  console.info('[Najran Extract Snapshot] installed v5 scoped local resume');
})();
