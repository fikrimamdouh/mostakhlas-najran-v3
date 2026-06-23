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
      'adminOfficesAttendanceData_v1', 'adminOfficesAttendanceData_v1_localBackup', 'adminOfficesAttendanceData_v1_lastGood',
      'adminOfficesLaborDataSafe_v2', 'adminOfficesAttendanceData', 'adminOfficeNames_v1', 'adminOfficeAffiliations_v1',
      'adminOfficesRaiseLettersSettings_v1', 'adminOfficesLetterScopedSettings_v1', 'adminOfficesAbsenceVacationNotes_v1',
      'adminOfficePerformanceDeductions_v1', 'performanceDeductions', 'performanceData_v4', 'achievementData',
      'achievementTitles_v1', 'achievementItemNames', 'najran_admin_offices_attendance_done'
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
        'performance', 'achievement', 'najran_admin_offices_'
      ]);
    }
    if (moduleName === 'admin_offices_consumables') return ['adminOffice', 'adminOffices', 'admin_offices_', 'consumables_', 'subcontractors_', 'najran_admin_offices_'];
    if (moduleName.indexOf('health_centers') === 0) return ['healthCenters', 'health_centers', 'healthCenters_Signatures_', 'najran_health_', 'consumables_'];
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
      adminOfficesPerformanceKeys: countObjectKeys(src.adminOfficePerformanceDeductions_v1 || src.performanceDeductions),
      adminOfficesLettersSettings: !!src.adminOfficesRaiseLettersSettings_v1,
      adminOfficesScopedLettersSettings: !!src.adminOfficesLetterScopedSettings_v1,
      healthCentersEmployees: countRows(healthData),
      normalLaborEmployees: countRows(laborData),
      hasAchievement: hasAny(src, ['achievementData', 'achievementTitles_v1']),
      hasConsumables: hasAny(src, ['admin_offices_consumables_v1.0', 'healthCentersConsumables', 'consumablesTableData', 'mainHospitalConsumables']),
      trackedKeysCount: Object.keys(keyCopies).length
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

    snapshot.__najranSourceModule = moduleName;
    snapshot.__najranReviewPage = reviewPage;
    snapshot.sourceModule = snapshot.sourceModule || moduleName;
    snapshot.reviewPage = snapshot.reviewPage || reviewPage;

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
    collectTrackedKeyCopies: collectTrackedKeyCopies
  };

  console.info('[SubmittedExtractArchiveBundle] installed v1');
})();