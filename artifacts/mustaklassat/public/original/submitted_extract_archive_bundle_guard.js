// ===================================================================
// Submitted Extract Archive Bundle Guard — V1
// Scope: original work pages before POST/PUT /api/submitted-extracts
// يحفظ نسخة مراجعة/أرشفة صريحة داخل extractData عند الرفع:
// - يثبت مصدر المستخلص الحقيقي حتى لو extractType = labor.
// - ينسخ مفاتيح المكاتب/المراكز/المستهلكات/الأداء/الإنجاز/الخطابات المهمة.
// - يحفظ لقطة محلية عند الرفع قبل أي تنظيف لاحق.
// ===================================================================
(function () {
  'use strict';
  if (window.__NAJRAN_SUBMITTED_EXTRACT_ARCHIVE_BUNDLE_GUARD_V1__) return;
  window.__NAJRAN_SUBMITTED_EXTRACT_ARCHIVE_BUNDLE_GUARD_V1__ = true;

  function readJson(key, fallback) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }

  function parseMaybeJson(value, fallback) {
    if (value == null) return fallback;
    if (typeof value === 'object') return value;
    try { return JSON.parse(String(value)); } catch (_) { return fallback; }
  }

  function clean(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function countRows(obj) {
    var total = 0;
    obj = obj || {};
    Object.keys(obj).forEach(function (k) {
      if (Array.isArray(obj[k])) total += obj[k].length;
    });
    return total;
  }

  function countObjectKeys(obj) {
    return obj && typeof obj === 'object' ? Object.keys(obj).length : 0;
  }

  function isMeaningful(value) {
    if (value == null) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    var s = clean(value);
    return !!s && s !== '{}' && s !== '[]' && s !== '0';
  }

  function parseStorageValue(raw) {
    if (raw == null) return raw;
    try { return JSON.parse(raw); } catch (_) { return raw; }
  }

  function hasKey(snapshot, key) {
    return snapshot && Object.prototype.hasOwnProperty.call(snapshot, key) && isMeaningful(snapshot[key]);
  }

  function hasAny(snapshot, keys) {
    return keys.some(function (key) { return hasKey(snapshot, key); });
  }

  function detectSourceModule(payload, snapshot) {
    payload = payload || {};
    snapshot = snapshot || {};

    var explicit = clean(payload.sourceModule || payload.reviewSourceModule || snapshot.__najranSourceModule || snapshot.sourceModule);
    if (explicit) return explicit;

    if (payload.adminOfficeLabor === true || payload.adminOfficeLabor === 'true') return 'admin_offices_attendance';
    if (payload.adminOfficeConsumables === true || payload.adminOfficeConsumables === 'true') return 'admin_offices_consumables';

    if (hasAny(snapshot, [
      'adminOfficesAttendanceData_v1', 'adminOfficesAttendanceData_v1_localBackup', 'adminOfficesAttendanceData_v1_lastGood',
      'adminOfficesLaborDataSafe_v2', 'adminOfficeNames_v1', 'adminOfficeAffiliations_v1'
    ])) return 'admin_offices_attendance';

    if (hasAny(snapshot, ['admin_offices_consumables_v1.0', 'adminOfficesConsumablesRaiseLetterSettings_v1'])) return 'admin_offices_consumables';

    if (hasAny(snapshot, ['healthCentersAttendanceData', 'centersAttendanceData_v2'])) return 'health_centers_attendance';
    if (hasAny(snapshot, ['healthCentersConsumables'])) return 'health_centers_consumables';
    if (hasAny(snapshot, ['spare_partsData', 'sparePartsTotalAmount'])) return 'spare_parts';
    if (hasAny(snapshot, ['consumablesTableData', 'mainHospitalConsumables'])) return 'consumables';

    if (String(payload.extractType || '') === 'consumables') return 'consumables';
    if (String(payload.extractType || '') === 'spare_parts') return 'spare_parts';
    if (String(payload.extractType || '') === 'health_centers') return 'health_centers_attendance';
    if (String(payload.extractType || '') === 'admin_offices') return 'admin_offices_attendance';
    return 'labor_attendance';
  }

  function pageForModule(moduleName, fallbackType) {
    var map = {
      admin_offices_attendance: '/original/admin_offices_attendance.html',
      admin_offices_consumables: '/original/admin_offices_consumables.html',
      health_centers_attendance: '/original/health_centers_attendance.html',
      health_centers_consumables: '/original/health_centers_consumables.html',
      spare_parts: '/original/spare_parts.html',
      consumables: '/original/consumables.html',
      labor_attendance: '/original/attendance.html',
      labor_performance: '/original/performance.html',
      labor_achievement: '/original/achievement.html'
    };
    if (map[moduleName]) return map[moduleName];
    if (fallbackType === 'admin_offices') return map.admin_offices_attendance;
    if (fallbackType === 'health_centers') return map.health_centers_attendance;
    if (fallbackType === 'consumables') return map.consumables;
    if (fallbackType === 'spare_parts') return map.spare_parts;
    return map.labor_attendance;
  }

  function exactKeysFor(moduleName) {
    var common = [
      'persistentExtractData', 'persistentContractData', 'companyName', 'contractNumber', 'hospitalName',
      'extractMonth', 'extractYear', 'extractStart', 'extractEnd', 'paymentNumber', 'extractNumber', 'periodMonth',
      'finalLaborCost', 'finalConsumablesCost', 'grand-net-total', 'grand-net-total-centers', 'grand-net-total-admin'
    ];

    var adminLabor = [
      'adminOfficesAttendanceData_v1', 'adminOfficesAttendanceData_v1_localBackup', 'adminOfficesAttendanceData_v1_localBackup_ts',
      'adminOfficesAttendanceData_v1_lastGood', 'adminOfficesAttendanceData_v1_lastGood_ts', 'adminOfficesLaborDataSafe_v2',
      'adminOfficesLaborDataSafe_v2_ts', 'adminOfficesAttendanceData', 'adminOfficeNames_v1', 'adminOfficeAffiliations_v1',
      'adminOfficesLaborNamesSafe_v2', 'adminOfficesLaborAffiliationsSafe_v2', 'adminOfficesRaiseLettersSettings_v1',
      'adminOfficesRaiseLettersSettings_v1_backup', 'adminOfficesRaiseLettersSettings_v1_backup_ts', 'adminOfficesLetterScopedSettings_v1',
      'adminOfficesAbsenceVacationNotes_v1', 'adminOfficePerformanceScores_v1', 'adminOfficePerformanceDeductions_v1',
      'performanceDeductions', 'performanceData', 'performanceData_v4', 'performanceTotalDeduction', 'performanceTotalDue',
      'achievementData', 'achievementTitles_v1', 'achievementItemNames', 'najran_admin_offices_attendance_done'
    ];

    var adminConsumables = [
      'admin_offices_consumables_v1.0', 'adminOfficesConsumablesRaiseLetterSettings_v1', 'finalConsumablesCost',
      'admin_offices_consumables_subcontractors_v1', 'adminOfficesConsumablesVisitLogic_v1'
    ];

    var health = ['healthCentersAttendanceData', 'centersAttendanceData_v2', 'healthCentersConsumables', 'grand-net-total-centers', 'najran_health_attendance_done'];
    var normal = ['attendanceData', 'ng_attendanceData', 'nd_attendanceData', 'performanceData', 'performanceData_v4', 'performanceDeductions', 'achievementData', 'achievementTitles_v1', 'achievementItemNames', 'najran_labor_attendance_done', 'najran_labor_performance_done'];
    var consumables = ['consumablesTableData', 'mainHospitalConsumables', 'finalConsumablesCost'];
    var spare = ['spare_partsData', 'sparePartsTotalAmount'];

    if (moduleName === 'admin_offices_attendance') return common.concat(adminLabor);
    if (moduleName === 'admin_offices_consumables') return common.concat(adminConsumables);
    if (moduleName.indexOf('health_centers') === 0) return common.concat(health);
    if (moduleName === 'consumables') return common.concat(consumables);
    if (moduleName === 'spare_parts') return common.concat(spare);
    return common.concat(normal);
  }

  function prefixListFor(moduleName) {
    var common = ['healthCenters_Signatures_', 'dept_', 'deptCalculatedCost_', 'tableData_', 'achievement_'];
    if (moduleName === 'admin_offices_attendance') {
      return common.concat([
        'adminOffice', 'adminOffices', 'admin_offices_', 'healthCenters_Signatures_attendance',
        'healthCenters_Signatures_performance', 'healthCenters_Signatures_achievement',
        'performance', 'achievement', 'najran_admin_offices_', 'sb_sigs_admin_offices_', 'sb_prefs_admin_offices_',
        'sb_sigs_', 'sb_prefs_'
      ]);
    }
    if (moduleName === 'admin_offices_consumables') return ['adminOffice', 'adminOffices', 'admin_offices_', 'consumables_', 'subcontractors_', 'najran_admin_offices_', 'sb_sigs_', 'sb_prefs_'];
    if (moduleName.indexOf('health_centers') === 0) return ['healthCenters', 'health_centers', 'healthCenters_Signatures_', 'najran_health_', 'consumables_', 'sb_sigs_', 'sb_prefs_'];
    return common.concat(['consumables_', 'spare_', 'najran_labor_']);
  }

  function collectTrackedKeyCopies(moduleName) {
    var exact = exactKeysFor(moduleName);
    var prefixes = prefixListFor(moduleName);
    var out = {};
    var seen = {};

    function addKey(key) {
      if (!key || seen[key]) return;
      seen[key] = true;
      try {
        var raw = localStorage.getItem(key);
        if (raw == null) return;
        out[key] = parseStorageValue(raw);
      } catch (_) {}
    }

    exact.forEach(addKey);
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key) continue;
        if (prefixes.some(function (p) { return key.indexOf(p) === 0; })) addKey(key);
      }
    } catch (_) {}

    return out;
  }

  function makeIntegrity(moduleName, snapshot, keyCopies) {
    snapshot = snapshot || {};
    keyCopies = keyCopies || {};
    var src = Object.assign({}, snapshot, keyCopies);
    var adminData = src.adminOfficesAttendanceData_v1 || src.adminOfficesAttendanceData_v1_localBackup || src.adminOfficesLaborDataSafe_v2 || {};
    var healthData = src.healthCentersAttendanceData || src.centersAttendanceData_v2 || {};
    var laborData = src.attendanceData || src.ng_attendanceData || src.nd_attendanceData || {};

    return {
      module: moduleName,
      adminOfficesSites: countObjectKeys(src.adminOfficeNames_v1),
      adminOfficesEmployees: countRows(adminData),
      adminOfficesPerformanceScores: countObjectKeys(src.adminOfficePerformanceScores_v1),
      adminOfficesPerformanceKeys: countObjectKeys(src.adminOfficePerformanceDeductions_v1 || src.performanceDeductions),
      adminOfficesLettersSettings: !!src.adminOfficesRaiseLettersSettings_v1,
      adminOfficesScopedLettersSettings: !!src.adminOfficesLetterScopedSettings_v1,
      adminOfficesSignatureKeys: Object.keys(src).filter(function (key) { return key.indexOf('sb_sigs_admin_offices_') === 0; }).length,
      healthCentersEmployees: countRows(healthData),
      normalLaborEmployees: countRows(laborData),
      hasAchievement: hasAny(src, ['achievementData', 'achievementTitles_v1']),
      hasConsumables: hasAny(src, ['admin_offices_consumables_v1.0', 'healthCentersConsumables', 'consumablesTableData', 'mainHospitalConsumables']),
      trackedKeysCount: Object.keys(keyCopies).length
    };
  }

  function pickKeysByPrefix(src, prefixes) {
    var out = {};
    src = src || {};
    Object.keys(src).forEach(function (key) {
      if (prefixes.some(function (p) { return key.indexOf(p) === 0; })) out[key] = src[key];
    });
    return out;
  }

  function buildAdminOfficesUploadSnapshot(moduleName, snapshot, keyCopies, integrity) {
    if (moduleName !== 'admin_offices_attendance' && moduleName !== 'admin_offices_consumables') return null;
    var src = Object.assign({}, snapshot || {}, keyCopies || {});
    var attendance = src.adminOfficesAttendanceData_v1 || src.adminOfficesAttendanceData_v1_localBackup || src.adminOfficesLaborDataSafe_v2 || src.adminOfficesAttendanceData || {};
    var names = src.adminOfficeNames_v1 || src.adminOfficesLaborNamesSafe_v2 || {};
    var affiliations = src.adminOfficeAffiliations_v1 || src.adminOfficesLaborAffiliationsSafe_v2 || {};
    var signatures = pickKeysByPrefix(src, ['sb_sigs_admin_offices_', 'sb_prefs_admin_offices_', 'healthCenters_Signatures_attendance', 'healthCenters_Signatures_performance', 'healthCenters_Signatures_achievement']);
    var performanceItems = pickKeysByPrefix(src, ['adminOfficePerformanceItems_']);
    var deptCosts = pickKeysByPrefix(src, ['deptCalculatedCost_', 'dept_']);
    var achievementKeys = pickKeysByPrefix(src, ['achievement_']);
    var adminPrefixes = pickKeysByPrefix(src, ['najran_admin_offices_']);

    return {
      version: 1,
      createdAt: new Date().toISOString(),
      sourceModule: moduleName,
      reviewPage: pageForModule(moduleName),
      sitesCount: countObjectKeys(names),
      employeesCount: countRows(attendance),
      contract: src.persistentContractData || {},
      period: src.persistentExtractData || {},
      identity: {
        companyName: src.companyName || (src.persistentContractData && src.persistentContractData.companyName) || '',
        contractNumber: src.contractNumber || (src.persistentContractData && src.persistentContractData.contractNumber) || '',
        hospitalName: src.hospitalName || (src.persistentContractData && src.persistentContractData.hospitalName) || '',
        paymentNumber: src.paymentNumber || src.extractNumber || (src.persistentExtractData && (src.persistentExtractData.paymentNumber || src.persistentExtractData.extractNumber)) || '',
        extractStart: src.extractStart || (src.persistentExtractData && src.persistentExtractData.extractStart) || '',
        extractEnd: src.extractEnd || (src.persistentExtractData && src.persistentExtractData.extractEnd) || ''
      },
      sites: names,
      affiliations: affiliations,
      attendance: attendance,
      attendanceBackups: {
        localBackup: src.adminOfficesAttendanceData_v1_localBackup || {},
        lastGood: src.adminOfficesAttendanceData_v1_lastGood || {},
        legacy: src.adminOfficesAttendanceData || {},
        safe: src.adminOfficesLaborDataSafe_v2 || {}
      },
      performance: {
        scores: src.adminOfficePerformanceScores_v1 || {},
        deductions: src.adminOfficePerformanceDeductions_v1 || {},
        legacyDeductions: src.performanceDeductions || {},
        performanceData: src.performanceData || {},
        performanceDataV4: src.performanceData_v4 || {},
        items: performanceItems,
        totalDeduction: src.performanceTotalDeduction || '',
        totalDue: src.performanceTotalDue || ''
      },
      achievement: {
        data: src.achievementData || {},
        titles: src.achievementTitles_v1 || {},
        itemNames: src.achievementItemNames || {},
        dynamicKeys: achievementKeys
      },
      letters: {
        settings: src.adminOfficesRaiseLettersSettings_v1 || {},
        settingsBackup: src.adminOfficesRaiseLettersSettings_v1_backup || {},
        settingsBackupTs: src.adminOfficesRaiseLettersSettings_v1_backup_ts || '',
        scopedSettings: src.adminOfficesLetterScopedSettings_v1 || {},
        absenceVacationNotes: src.adminOfficesAbsenceVacationNotes_v1 || {}
      },
      signatures: signatures,
      totals: {
        grandNetTotalAdmin: src['grand-net-total-admin'] || '',
        finalLaborCost: src.finalLaborCost || '',
        deptCosts: deptCosts
      },
      adminFlags: adminPrefixes,
      integrity: integrity || makeIntegrity(moduleName, snapshot, keyCopies)
    };
  }

  function enrichPayload(payload) {
    if (!payload || typeof payload !== 'object') return payload;
    var snapshot = parseMaybeJson(payload.extractData, {});
    if (!snapshot || typeof snapshot !== 'object') snapshot = {};

    var moduleName = detectSourceModule(payload, snapshot);
    var reviewPage = pageForModule(moduleName, payload.extractType);
    var keyCopies = collectTrackedKeyCopies(moduleName);
    var integrity = makeIntegrity(moduleName, snapshot, keyCopies);
    var adminOfficesUploadSnapshot = buildAdminOfficesUploadSnapshot(moduleName, snapshot, keyCopies, integrity);

    snapshot.__najranSourceModule = moduleName;
    snapshot.__najranReviewPage = reviewPage;
    snapshot.sourceModule = snapshot.sourceModule || moduleName;
    snapshot.reviewPage = snapshot.reviewPage || reviewPage;
    if (adminOfficesUploadSnapshot) snapshot.__adminOfficesUploadSnapshot_v1 = adminOfficesUploadSnapshot;

    snapshot.__submittedExtractArchiveBundle_v1 = {
      version: 1,
      createdAt: new Date().toISOString(),
      extractType: String(payload.extractType || ''),
      sourceModule: moduleName,
      reviewPage: reviewPage,
      currentPage: window.location.pathname + window.location.search,
      sectionPages: {
        attendance: moduleName === 'admin_offices_attendance' ? '/original/admin_offices_attendance.html' : moduleName === 'health_centers_attendance' ? '/original/health_centers_attendance.html' : '/original/attendance.html',
        consumables: moduleName === 'admin_offices_consumables' ? '/original/admin_offices_consumables.html' : moduleName.indexOf('health_centers') === 0 ? '/original/health_centers_consumables.html' : '/original/consumables.html',
        settings: '/original/settings_main.html',
        approval: '/original/approval.html',
        archive: '/original/extract-archive.html'
      },
      integrity: integrity,
      trackedKeyCopies: keyCopies
    };

    payload.extractData = snapshot;
    payload.sourceModule = payload.sourceModule || moduleName;
    payload.reviewPage = payload.reviewPage || reviewPage;
    return payload;
  }

  function shouldPatchFetch(input, init) {
    var url = '';
    try { url = typeof input === 'string' ? input : (input && input.url) || ''; } catch (_) {}
    if (url.indexOf('/api/submitted-extracts') === -1) return false;
    if (url.indexOf('/status') > -1) return false;
    var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    return method === 'POST' || method === 'PUT';
  }

  function saveLocalSnapshotBeforeSubmit() {
    try {
      if (typeof window.saveExtractSnapshot === 'function') {
        window.saveExtractSnapshot('submit-to-approval');
      }
    } catch (e) {
      console.warn('[SubmittedExtractArchiveBundle] local snapshot before submit failed', e);
    }
  }

  function patchFetch() {
    if (window.fetch.__najranSubmittedArchiveBundleWrapped) return;
    var originalFetch = window.fetch;
    window.fetch = function (input, init) {
      try {
        if (shouldPatchFetch(input, init || {})) {
          var nextInit = Object.assign({}, init || {});
          var body = nextInit.body;

          if (!body && input && typeof input !== 'string' && input instanceof Request) {
            // لا نعيد بناء Request body غير المقروء. أغلب الرفع عندنا يستخدم fetch(url,{body}).
          } else if (typeof body === 'string' && body.trim().charAt(0) === '{') {
            var payload = JSON.parse(body);
            saveLocalSnapshotBeforeSubmit();
            payload = enrichPayload(payload);
            nextInit.body = JSON.stringify(payload);
            return originalFetch.call(this, input, nextInit);
          }
        }
      } catch (e) {
        console.warn('[SubmittedExtractArchiveBundle] enrich failed; submit continues', e);
      }
      return originalFetch.apply(this, arguments);
    };
    window.fetch.__najranSubmittedArchiveBundleWrapped = true;
  }

  patchFetch();
  window.NajranSubmittedExtractArchiveGuard = {
    enrichPayload: enrichPayload,
    detectSourceModule: detectSourceModule,
    pageForModule: pageForModule,
    collectTrackedKeyCopies: collectTrackedKeyCopies,
    buildAdminOfficesUploadSnapshot: buildAdminOfficesUploadSnapshot
  };

  console.info('[SubmittedExtractArchiveBundle] installed v1');
})();
