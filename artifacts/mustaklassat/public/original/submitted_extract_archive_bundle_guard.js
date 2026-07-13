// ===================================================================
// Submitted Extract Archive Bundle Guard — V5 complete labor bundle
// Scope: original work pages before POST/PUT /api/submitted-extracts
// - keeps every scoped labor table and textual setting in one all-or-nothing bundle
// - persists a final display-only labor review snapshot and its signatures
// - blocks partial upload when attendance, performance, achievement, or metadata is missing
// ===================================================================
(function () {
  'use strict';
  if (window.__NAJRAN_SUBMITTED_EXTRACT_ARCHIVE_BUNDLE_GUARD_V5__) return;
  window.__NAJRAN_SUBMITTED_EXTRACT_ARCHIVE_BUNDLE_GUARD_V5__ = true;

  // Vercel Functions تقبل 4.5MB للطلب؛ نترك هامشًا للـheaders وبيانات السجل.
  var MAX_BUNDLE_BYTES = 4 * 1024 * 1024;
  var WARN_PAYLOAD_CHARS = 850 * 1024;
  var FINAL_LABOR_REVIEW_SCHEMA = 'labor_final_review_snapshot_v1';
  var FINAL_SNAPSHOT_STORAGE_KEY = 'najran_labor_final_review_snapshot_v1';
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

  function readStorageJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function valueSize(value) {
    try {
      if (typeof value === 'string') return value.length;
      return JSON.stringify(value).length;
    } catch (_) {
      return String(value == null ? '' : value).length;
    }
  }

  function valueUtf8Size(value) {
    var serialized = '';
    try { serialized = typeof value === 'string' ? value : JSON.stringify(value); }
    catch (_) { serialized = String(value == null ? '' : value); }
    try {
      if (typeof TextEncoder === 'function') return new TextEncoder().encode(serialized).length;
    } catch (_) {}
    try { return unescape(encodeURIComponent(serialized)).length; }
    catch (_) { return serialized.length * 3; }
  }

  function isHeavyKey(key) {
    key = String(key || '');
    if (!key) return true;
    if (key.indexOf('_u') === 0) return true;
    if (key.indexOf('extractArchive') > -1) return true;
    if (key.indexOf('ExtractArchive') > -1) return true;
    if (key.indexOf('archive') > -1 || key.indexOf('Archive') > -1) return true;
    if (key.indexOf('backup') > -1 || key.indexOf('Backup') > -1) return true;
    if (key.indexOf('PreWipeSnapshot') > -1) return true;
    if (key.indexOf('adminOfficesPreWipeSnapshot') > -1) return true;
    if (key.indexOf('monthSnapshot_') === 0) return true;
    if (key.indexOf('monthSafetySnapshot_') === 0) return true;
    if (key.indexOf('last_local_snapshot') > -1) return true;
    if (key.indexOf('najran_last_local_snapshot') === 0) return true;
    return false;
  }

  function isHeavyValue(value) {
    var s = '';
    try { s = typeof value === 'string' ? value : JSON.stringify(value); }
    catch (_) { s = String(value == null ? '' : value); }
    if (!s) return false;
    if (s.indexOf('data:image') > -1) return true;
    if (s.indexOf(';base64,') > -1) return true;
    if (s.indexOf('base64') > -1 && s.length > 20000) return true;
    return false;
  }

  // تنظيف عميق: يزيل سلاسل base64/data-URL من داخل JSON ويُبقي كل النصوص
  // (إعدادات الخطابات، أسماء ومناصب التواقيع، عناوين ونصوص الجداول) — بدل
  // إسقاط المفتاح كاملًا وضياع تفاصيل المراجعة. الصور لا تُرفع (حماية P0 حجم/base64).
  function isBase64ishString(s) {
    if (typeof s !== 'string') return false;
    if (s.indexOf('data:') === 0 && s.indexOf(';base64,') > -1) return true;
    if (s.indexOf(';base64,') > -1) return true;
    if (s.length > 20000 && /^[A-Za-z0-9+/=\s]+$/.test(s.slice(0, 2000))) return true;
    return false;
  }
  function stripBase64Deep(v) {
    if (typeof v === 'string') return isBase64ishString(v) ? '' : v;
    if (Array.isArray(v)) return v.map(stripBase64Deep);
    if (v && typeof v === 'object') {
      var out = {};
      Object.keys(v).forEach(function (k) { out[k] = stripBase64Deep(v[k]); });
      return out;
    }
    return v;
  }
  function sanitizeHeavyValue(value) {
    var parsed = value;
    var wasString = typeof value === 'string';
    if (wasString) {
      try { parsed = JSON.parse(value); }
      catch (_) {
        // ليست JSON: إن كانت صورة/أصل base64 خام → لا شيء نصي يُحفظ، وإلا فهي نص ضخم فقط.
        return null;
      }
    }
    if (parsed == null || typeof parsed !== 'object') return null;
    var cleaned = stripBase64Deep(parsed);
    var out = wasString ? JSON.stringify(cleaned) : cleaned;
    var s = wasString ? out : JSON.stringify(out);
    if (!s) return null;
    if (s.indexOf(';base64,') > -1 || s.indexOf('data:image') > -1) return null;
    return out;
  }

  function allowSubmitKey(key, value) {
    if (isHeavyKey(key)) return false;
    if (isHeavyValue(value)) return false;
    return true;
  }

  function sanitizeSnapshot(snapshot) {
    var cleanSnap = {};
    snapshot = snapshot || {};
    Object.keys(snapshot).forEach(function (key) {
      var value = snapshot[key];
      if (isHeavyKey(key)) return;
      if (isHeavyValue(value)) {
        // بدل الإسقاط: احتفظ بالمحتوى النصي بعد إزالة base64 إن أمكن.
        var salvaged = sanitizeHeavyValue(value);
        if (salvaged != null) cleanSnap[key] = salvaged;
        return;
      }
      cleanSnap[key] = value;
    });
    return cleanSnap;
  }

  function isForeignToNormalLabor(key) {
    var k = String(key || '').toLowerCase();
    return k.indexOf('consumable') > -1 || k.indexOf('consumables') > -1 ||
      k.indexOf('spare_parts') > -1 || k.indexOf('spare_') === 0 ||
      k.indexOf('subcontractors_') === 0 || k.indexOf('water_') === 0 || k.indexOf('sewage_') === 0 ||
      k.indexOf('adminoffice') === 0 || k.indexOf('admin_offices_') === 0 ||
      k.indexOf('healthcenters') === 0 || k.indexOf('health_centers_') === 0 ||
      k === 'centersattendancedata_v2';
  }

  function scopeSnapshotForModule(snapshot, moduleName) {
    var scoped = {};
    var removed = [];
    var exact = exactKeysFor(moduleName);
    var prefixes = prefixListFor(moduleName);
    Object.keys(snapshot || {}).forEach(function (key) {
      var allowed = exact.indexOf(key) > -1 || prefixes.some(function (prefix) { return key.indexOf(prefix) === 0; });
      if (allowed && !(moduleName === 'labor_attendance' && isForeignToNormalLabor(key))) scoped[key] = snapshot[key];
      else removed.push(key);
    });
    return { snapshot: scoped, removed: removed };
  }

  function hasKey(snapshot, key) {
    return snapshot && Object.prototype.hasOwnProperty.call(snapshot, key) && isMeaningful(snapshot[key]);
  }

  function hasAny(snapshot, keys) {
    return keys.some(function (key) { return hasKey(snapshot, key); });
  }

  function isFinalReviewSnapshot(snapshot) {
    return !!(
      snapshot &&
      snapshot.reviewSnapshotSchema === FINAL_LABOR_REVIEW_SCHEMA &&
      snapshot.finalReviewSnapshot &&
      typeof snapshot.finalReviewSnapshot === 'object'
    );
  }

  function stripRawReviewKeys(snapshot) {
    snapshot = snapshot || {};
    // كان يحذف attendanceData/performanceData/achievementData والبادئات dept_/performance_/achievement_
    // عند وجود finalReviewSnapshot، فيفقد المراجع تفاصيل الحضور والأقسام والأداء.
    // الآن تبقى التفاصيل الخام النصية كاملة، مع حد واحد للحزمة كلها — وإعادة الحساب
    // تبقى ممنوعة عبر displayOnly/noRecalculate داخل finalReviewSnapshot نفسه.
    return snapshot;
  }

  function shouldSkipTrackedCopy(key, snapshot) {
    // التفاصيل الخام مطلوبة الآن في المراجعة — لا تخطٍّ (انظر stripRawReviewKeys).
    return false;
  }

  function detectSourceModule(payload, snapshot) {
    payload = payload || {};
    snapshot = snapshot || {};

    var explicit = clean(payload.sourceModule || payload.reviewSourceModule || snapshot.__najranSourceModule || snapshot.sourceModule);
    if (explicit) return explicit;

    if (payload.adminOfficeLabor === true || payload.adminOfficeLabor === 'true') return 'admin_offices_attendance';
    if (payload.adminOfficeConsumables === true || payload.adminOfficeConsumables === 'true') return 'admin_offices_consumables';

    try {
      var pg = String((typeof location !== 'undefined' && location.pathname) || '');
      var pageMatch = pg.match(/(?:^|\/)([^/]+)\.html$/);
      var pageModule = pageMatch && {
        consumables: 'consumables',
        spare_parts: 'spare_parts',
        health_centers_attendance: 'health_centers_attendance',
        health_centers_consumables: 'health_centers_consumables',
        admin_offices_attendance: 'admin_offices_attendance',
        admin_offices_consumables: 'admin_offices_consumables'
      }[pageMatch[1]];
      if (pageModule) return pageModule;
      var onLaborFlowPage = /(?:^|\/)(achievement|attendance|performance|approval)\.html$/.test(pg);
      if (onLaborFlowPage && String(payload.extractType || '') === 'labor') return 'labor_attendance';
    } catch (_) {}

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
      'extractMonth', 'extractYear', 'extractStart', 'extractEnd', 'paymentNumber', 'extractNumber', 'periodMonth'
    ];

    var adminLabor = [
      'adminOfficesAttendanceData_v1', 'adminOfficesAttendanceData_v1_localBackup', 'adminOfficesAttendanceData_v1_lastGood',
      'adminOfficesLaborDataSafe_v2', 'adminOfficesAttendanceData', 'adminOfficeNames_v1', 'adminOfficeAffiliations_v1',
      'adminOfficesRaiseLettersSettings_v1', 'adminOfficesLetterScopedSettings_v1', 'adminOfficesAbsenceVacationNotes_v1',
      'adminOfficePerformanceDeductions_v1', 'performanceDeductions', 'performanceData_v4', 'achievementData',
      'achievementTitles_v1', 'achievementItemNames', 'finalLaborCost', 'najran_admin_offices_attendance_done'
    ];

    var adminConsumables = [
      'admin_offices_consumables_v1.0', 'adminOfficesConsumablesRaiseLetterSettings_v1', 'finalConsumablesCost',
      'admin_offices_consumables_subcontractors_v1', 'adminOfficesConsumablesVisitLogic_v1', 'signatures_data_consumables_v27'
    ];

    var healthAttendance = ['healthCentersAttendanceData', 'centersAttendanceData_v2', 'grand-net-total-centers', 'finalLaborCost', 'najran_health_attendance_done'];
    var healthConsumables = ['healthCentersConsumables', 'healthCentersConsumablesSummary', 'grand-net-total-centers', 'finalConsumablesCost'];
    var normal = [
      'attendanceData', 'ng_attendanceData', 'nd_attendanceData', 'departmentNames', 'distributionSettings',
      'performanceData', 'performanceData_v4', 'performanceDeductions', 'performanceTotalDeduction', 'performanceTotalDue', 'performanceTableNames',
      'achievementData', 'achievementTitles_v1', 'achievementItemNames', 'accreditationLetterData', 'taxInvoiceData',
      'dentalLaborCheckboxState', 'dentalLaborData', 'finalLaborCost',
      'dynamicSignatures', 'performanceSignatures', 'performanceSignatures_v2', 'achievementSignatures_v3',
      'sb_style_prefs_attendance_v1', 'najranSignatureStyleSettings_v1', 'najranSignatureStyleSettings_v1__attendance',
      'najranSignatureStyleSettings_v1__performance', 'najranSignatureStyleSettings_v1__achievement',
      'najran_labor_attendance_done', 'najran_labor_performance_done', 'grand-net-total', FINAL_SNAPSHOT_STORAGE_KEY
    ];
    var consumables = [
      'consumablesTableData', 'mainHospitalConsumables', 'summary_data_consumables_v27',
      'subcontractors_data_consumables_v27', 'performance_data_consumables_v27',
      'water_supply_data_consumables_v27', 'sewage_disposal_data_consumables_v27',
      'signatures_data_consumables_v27', 'hospitalConsumablesRaiseLettersSettings_v1',
      'projectManagerSignature', 'operationsAssistantSignature', 'maintenanceHeadSignature',
      'finalConsumablesCost', 'grand-net-total'
    ];
    var spare = ['spare_partsData', 'sparePartsTotalAmount', 'grand-net-total'];

    if (moduleName === 'admin_offices_attendance') return common.concat(adminLabor);
    if (moduleName === 'admin_offices_consumables') return common.concat(adminConsumables);
    if (moduleName === 'health_centers_attendance') return common.concat(healthAttendance);
    if (moduleName === 'health_centers_consumables') return common.concat(healthConsumables);
    if (moduleName === 'consumables') return common.concat(consumables);
    if (moduleName === 'spare_parts') return common.concat(spare);
    return common.concat(normal);
  }

  function prefixListFor(moduleName) {
    var laborSignatures = ['sb_sigs_', 'sb_prefs_'];
    var common = laborSignatures.concat(['dept_', 'deptCalculatedCost_', 'tableData_', 'achievement_']);
    if (moduleName === 'admin_offices_attendance') {
      return ['healthCenters_Signatures_attendance', 'healthCenters_Signatures_performance', 'healthCenters_Signatures_achievement'].concat([
        'adminOfficesAttendance', 'adminOfficesLabor', 'adminOfficeNames_', 'adminOfficeAffiliations_',
        'healthCenters_Signatures_performance', 'healthCenters_Signatures_achievement',
        'performance', 'achievement', 'najran_admin_offices_'
      ]);
    }
    if (moduleName === 'admin_offices_consumables') return ['admin_offices_consumables_', 'adminOfficesConsumables', 'consumables_', 'subcontractors_', 'najran_admin_offices_consumables_'];
    if (moduleName === 'health_centers_attendance') return ['healthCenters_Signatures_attendance', 'healthCenters_Signatures_performance', 'healthCenters_Signatures_achievement', 'centersAttendance', 'najran_health_attendance_'];
    if (moduleName === 'health_centers_consumables') return ['healthCentersConsumables', 'healthCenters_Signatures_consumables', 'consumables_', 'najran_health_consumables_'];
    if (moduleName === 'consumables') return ['consumables_', 'subcontractors_', 'water_', 'sewage_'];
    if (moduleName === 'spare_parts') return ['spare_'];
    return common.concat(['najran_labor_', 'ng_', 'nd_']);
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
        if (!allowSubmitKey(key, raw)) return;
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
    var signatureKeys = Object.keys(src).filter(function (key) {
      return /^sb_(sigs|prefs)_/.test(key) || /^healthCenters_Signatures_/.test(key) ||
        ['dynamicSignatures', 'performanceSignatures', 'performanceSignatures_v2', 'achievementSignatures_v3', 'signatures_data_consumables_v27'].indexOf(key) > -1;
    });
    var final = isFinalReviewSnapshot(snapshot);

    return {
      module: moduleName,
      finalReviewSnapshot: final,
      reviewSnapshotSchema: final ? FINAL_LABOR_REVIEW_SCHEMA : '',
      adminOfficesSites: countObjectKeys(src.adminOfficeNames_v1),
      adminOfficesEmployees: countRows(adminData),
      adminOfficesPerformanceKeys: countObjectKeys(src.adminOfficePerformanceDeductions_v1 || src.performanceDeductions),
      adminOfficesLettersSettings: !!src.adminOfficesRaiseLettersSettings_v1,
      adminOfficesScopedLettersSettings: !!src.adminOfficesLetterScopedSettings_v1,
      healthCentersEmployees: countRows(healthData),
      normalLaborEmployees: countRows(laborData),
      hasAchievement: final || hasAny(src, ['achievementData', 'achievementTitles_v1']),
      hasConsumables: hasAny(src, ['admin_offices_consumables_v1.0', 'healthCentersConsumables', 'consumablesTableData', 'mainHospitalConsumables']),
      signatureKeysCount: signatureKeys.length,
      trackedKeysCount: Object.keys(keyCopies).length
    };
  }

  function text(selector) {
    try {
      var el = document.querySelector(selector);
      return clean(el ? el.textContent : '');
    } catch (_) { return ''; }
  }

  function optionalNumberFromText(value) {
    if (value == null || clean(value) === '') return null;
    var raw = String(value)
      .replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); })
      .replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); })
      .replace(/,/g, '')
      .replace(/[^0-9.\-]/g, '');
    var n = parseFloat(raw);
    return isFinite(n) ? n : null;
  }

  function moneyText(value) {
    var n = Number(value == null ? 0 : value);
    return isFinite(n) ? n.toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' }) : '—';
  }

  function safeRun(name) {
    try {
      if (typeof window[name] === 'function') window[name]();
    } catch (e) {
      console.warn('[SubmittedExtractArchiveBundle] finalizer step failed:', name, e);
    }
  }

  function captureAchievementRows() {
    var table = null;
    try { table = document.getElementById('achievementTable') || document.querySelector('table.achievement-table'); } catch (_) {}
    if (!table) return { headers: [], rows: [] };

    var headers = [];
    try {
      headers = Array.prototype.slice.call(table.querySelectorAll('thead th')).map(function (th, i) {
        return clean(th.textContent) || ('عمود ' + (i + 1));
      });
    } catch (_) { headers = []; }

    var rows = [];
    try {
      Array.prototype.slice.call(table.querySelectorAll('tbody tr')).forEach(function (tr) {
        var cells = Array.prototype.slice.call(tr.children || []).map(function (td) { return clean(td.textContent); });
        if (!cells.some(Boolean)) return;
        var obj = { rowType: tr.classList.contains('total-row') ? 'total' : tr.classList.contains('tafqeet-row') ? 'tafqeet' : 'line', cells: cells };
        headers.forEach(function (h, idx) { obj[h] = cells[idx] || ''; });
        rows.push(obj);
      });
    } catch (_) {}

    return { headers: headers, rows: rows };
  }

  function readSignatureArray(keys) {
    for (var i = 0; i < keys.length; i++) {
      var value = readStorageJson(keys[i], null);
      if (Array.isArray(value)) return value;
    }
    return [];
  }

  function collectLaborSignaturesSnapshot() {
    return {
      attendance: readSignatureArray(['sb_sigs_attendance', 'dynamicSignatures']),
      performance: readSignatureArray(['sb_sigs_performance', 'performanceSignatures_v2', 'performanceSignatures']),
      achievement: readSignatureArray(['sb_sigs_achievement', 'achievementSignatures_v3']),
      preferences: {
        attendance: readStorageJson('sb_prefs_attendance', {}),
        performance: readStorageJson('sb_prefs_performance', {}),
        achievement: readStorageJson('sb_prefs_achievement', {})
      },
      styles: {
        attendance: readStorageJson('sb_style_prefs_attendance_v1', readStorageJson('najranSignatureStyleSettings_v1__attendance', {})),
        performance: readStorageJson('najranSignatureStyleSettings_v1__performance', {}),
        achievement: readStorageJson('najranSignatureStyleSettings_v1__achievement', {})
      }
    };
  }

  function laborBundleIntegrity(payload, snapshot) {
    snapshot = snapshot || {};
    var finalSnapshot = parseMaybeJson(snapshot.finalReviewSnapshot, {});
    var attendanceRows = countRows(snapshot.attendanceData) + countRows(snapshot.ng_attendanceData) + countRows(snapshot.nd_attendanceData);
    var performanceKeys = Object.keys(snapshot).filter(function (key) {
      return key.indexOf('tableData_') === 0 && isMeaningful(snapshot[key]);
    });
    var hasPerformance = performanceKeys.length > 0 || hasAny(snapshot, ['performanceData', 'performanceData_v4', 'performanceDeductions']);
    var achievementRows = Array.isArray(finalSnapshot.displayRows)
      ? finalSnapshot.displayRows.length
      : finalSnapshot.table && Array.isArray(finalSnapshot.table.rows)
        ? finalSnapshot.table.rows.length
        : 0;
    var signatures = parseMaybeJson(finalSnapshot.signatures, {});
    var missing = [];
    if (!attendanceRows) missing.push('جداول الحضور والانصراف وصفوف العمال');
    if (!hasPerformance) missing.push('جداول الأداء المحفوظة');
    if (!achievementRows) missing.push('شهادة الإنجاز النهائية');
    if (!clean(payload && payload.hospitalName)) missing.push('اسم المستشفى');
    if (!clean(payload && payload.companyName)) missing.push('اسم الشركة');
    if (!clean(payload && payload.extractMonth) || !clean(payload && payload.extractYear)) missing.push('الشهر والسنة');
    if (!clean(payload && (payload.paymentNumber || payload.extractNumber))) missing.push('رقم الدفعة');
    return {
      schema: 'labor_complete_bundle_v1',
      complete: missing.length === 0,
      missing: missing,
      attendanceRows: attendanceRows,
      performanceTableKeys: performanceKeys,
      achievementRows: achievementRows,
      signatures: {
        attendance: Array.isArray(signatures.attendance) ? signatures.attendance.length : 0,
        performance: Array.isArray(signatures.performance) ? signatures.performance.length : 0,
        achievement: Array.isArray(signatures.achievement) ? signatures.achievement.length : 0
      }
    };
  }

  function sectionBundleIntegrity(moduleName, snapshot) {
    var required = {
      consumables: ['consumablesTableData', 'mainHospitalConsumables', 'summary_data_consumables_v27'],
      spare_parts: ['spare_partsData'],
      health_centers_attendance: ['healthCentersAttendanceData', 'centersAttendanceData_v2'],
      health_centers_consumables: ['healthCentersConsumables'],
      admin_offices_attendance: ['adminOfficesAttendanceData_v1', 'adminOfficesAttendanceData_v1_localBackup', 'adminOfficesLaborDataSafe_v2'],
      admin_offices_consumables: ['admin_offices_consumables_v1.0']
    }[moduleName] || [];
    return { complete: required.length === 0 || hasAny(snapshot || {}, required), required: required };
  }

  function createLaborFinalReviewSnapshot() {
    try {
      safeRun('renderTables');
      safeRun('updateCertificateFromPerformance');
      safeRun('loadAndProcessAchievementData');

      var storedExtract = readStorageJson('persistentExtractData', {});
      var storedContract = readStorageJson('persistentContractData', {});
      var totals = window.__achievementTotalsForTaxInvoice || {};
      var table = captureAchievementRows();
      var totalRow = table.rows.filter(function (r) { return r.rowType === 'total'; }).pop() || null;
      var totalCell = totalRow && totalRow.cells ? totalRow.cells[totalRow.cells.length - 1] : '';
      var hasNetMonthly = Object.prototype.hasOwnProperty.call(totals, 'netMonthly') && isFinite(Number(totals.netMonthly));
      var storedLaborTotal = optionalNumberFromText(localStorage.getItem('finalLaborCost'));
      var displayedTotal = optionalNumberFromText(totalCell);
      var finalAmount = hasNetMonthly ? Number(totals.netMonthly) : storedLaborTotal !== null ? storedLaborTotal : displayedTotal !== null ? displayedTotal : 0;

      var meta = {
        paymentNumber: text('#extract-payment-number') || storedExtract.paymentNumber || localStorage.getItem('paymentNumber') || '',
        extractMonth: text('.extract-month-display') || storedExtract.extractMonth || localStorage.getItem('extractMonth') || '',
        extractYear: text('.extract-year-display') || storedExtract.extractYear || localStorage.getItem('extractYear') || '',
        extractStart: text('#extract-start-date') || storedExtract.extractStart || localStorage.getItem('extractStart') || '',
        extractEnd: text('#extract-end-date') || storedExtract.extractEnd || localStorage.getItem('extractEnd') || '',
        companyName: text('.companyName') || localStorage.getItem('companyName') || storedContract.companyName || '',
        hospitalName: text('.hospitalName') || localStorage.getItem('hospitalName') || storedContract.hospitalName || '',
        contractNumber: text('.contractDetails') || localStorage.getItem('contractDetails') || storedContract.contractNumber || ''
      };
      meta.period = clean([meta.extractMonth, meta.extractYear].filter(Boolean).join(' '));

      var snapshot = {
        schema: FINAL_LABOR_REVIEW_SCHEMA,
        createdAt: new Date().toISOString(),
        sourcePage: window.location.pathname + window.location.search,
        extractType: 'labor',
        reviewMode: 'final_display_only',
        displayOnly: true,
        noRecalculate: true,
        meta: meta,
        finalAmount: {
          value: Math.round((Number(finalAmount == null ? 0 : finalAmount) + Number.EPSILON) * 100) / 100,
          text: moneyText(finalAmount),
          source: hasNetMonthly ? 'achievement_totals' : 'display_table_or_finalLaborCost'
        },
        achievementTotals: {
          monthlyValue: Number(totals.monthlyValue == null ? 0 : totals.monthlyValue),
          absenceDeduction: Number(totals.absenceDeduction == null ? 0 : totals.absenceDeduction),
          absencePenalty: Number(totals.absencePenalty == null ? 0 : totals.absencePenalty),
          performancePenalty: Number(totals.performancePenalty == null ? 0 : totals.performancePenalty),
          nationalityPenalty: Number(totals.nationalityPenalty == null ? 0 : totals.nationalityPenalty),
          netMonthly: Number(finalAmount == null ? 0 : finalAmount)
        },
        table: table,
        displayRows: table.rows,
        signatures: collectLaborSignaturesSnapshot(),
        blockedReviewSources: [
          'attendanceData', 'ng_attendanceData', 'nd_attendanceData',
          'performanceData', 'performanceData_v4', 'performanceDeductions',
          'employee rows', 'localStorage recalculation', 'achievement recalculation'
        ]
      };

      window.__najranLaborFinalReviewSnapshot = snapshot;
      try { localStorage.setItem(FINAL_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot)); } catch (_) {}
      console.warn('[SubmittedExtractArchiveBundle] labor final review snapshot captured', {
        schema: snapshot.schema,
        finalAmount: snapshot.finalAmount.value,
        rows: snapshot.displayRows.length
      });
      return snapshot;
    } catch (e) {
      console.warn('[SubmittedExtractArchiveBundle] labor final review snapshot failed', e);
      return null;
    }
  }

  window.finalizeLaborExtractBeforeSubmit = window.finalizeLaborExtractBeforeSubmit || createLaborFinalReviewSnapshot;

  function shouldCreateFinalLaborSnapshot(payload, moduleName) {
    if (!payload || String(payload.extractType || '') !== 'labor') return false;
    if (payload.adminOfficeLabor === true || payload.adminOfficeLabor === 'true') return false;
    if (String(moduleName || '') !== 'labor_attendance') return false;
    return true;
  }

  function enrichPayload(payload) {
    if (!payload || typeof payload !== 'object') return payload;
    var originalSize = valueSize(payload);
    var snapshot = parseMaybeJson(payload.extractData, {});
    if (!snapshot || typeof snapshot !== 'object') snapshot = {};
    snapshot = sanitizeSnapshot(snapshot);

    var moduleName = detectSourceModule(payload, snapshot);
    var scoped = scopeSnapshotForModule(snapshot, moduleName);
    snapshot = scoped.snapshot;
    var finalSnapshot = null;

    if (shouldCreateFinalLaborSnapshot(payload, moduleName)) {
      finalSnapshot = parseMaybeJson(snapshot.finalReviewSnapshot, null);
      if (!finalSnapshot || finalSnapshot.schema !== FINAL_LABOR_REVIEW_SCHEMA) {
        finalSnapshot = (typeof window.finalizeLaborExtractBeforeSubmit === 'function')
          ? window.finalizeLaborExtractBeforeSubmit()
          : createLaborFinalReviewSnapshot();
      }
      if (finalSnapshot && typeof finalSnapshot.then === 'function') finalSnapshot = null;
      if (!finalSnapshot) finalSnapshot = parseMaybeJson(localStorage.getItem(FINAL_SNAPSHOT_STORAGE_KEY), null);
      if (finalSnapshot && finalSnapshot.schema === FINAL_LABOR_REVIEW_SCHEMA) {
        snapshot.finalReviewSnapshot = finalSnapshot;
        snapshot.reviewSnapshotSchema = FINAL_LABOR_REVIEW_SCHEMA;
        snapshot.__reviewRendererMode = 'final_snapshot_only';
        snapshot.achievementData = finalSnapshot.displayRows || [];
        snapshot.achievementDataSource = 'finalReviewSnapshot';
        snapshot = stripRawReviewKeys(snapshot);
        snapshot.finalReviewSnapshot = finalSnapshot;
        snapshot.reviewSnapshotSchema = FINAL_LABOR_REVIEW_SCHEMA;
        snapshot.achievementData = finalSnapshot.displayRows || [];
        var amount = Number(finalSnapshot.finalAmount && finalSnapshot.finalAmount.value);
        if (isFinite(amount)) payload.totalAmount = amount;
      }
    }

    var reviewPage = pageForModule(moduleName, payload.extractType);
    var keyCopies = collectTrackedKeyCopies(moduleName);

    Object.keys(keyCopies).forEach(function (key) {
      if (shouldSkipTrackedCopy(key, snapshot)) return;
      if (snapshot[key] === undefined && allowSubmitKey(key, keyCopies[key])) snapshot[key] = keyCopies[key];
    });

    if (isFinalReviewSnapshot(snapshot)) {
      var keepFinal = snapshot.finalReviewSnapshot;
      snapshot = stripRawReviewKeys(snapshot);
      snapshot.finalReviewSnapshot = keepFinal;
      snapshot.reviewSnapshotSchema = FINAL_LABOR_REVIEW_SCHEMA;
      snapshot.__reviewRendererMode = 'final_snapshot_only';
      snapshot.achievementData = keepFinal.displayRows || [];
      snapshot.achievementDataSource = 'finalReviewSnapshot';
    }

    snapshot = sanitizeSnapshot(snapshot);

    if (moduleName === 'labor_attendance') {
      var completeness = laborBundleIntegrity(payload, snapshot);
      completeness.excludedForeignKeys = scoped.removed;
      snapshot.__laborCompleteBundle_v1 = completeness;
      if (!completeness.complete) {
        throw new Error('تم إيقاف رفع مستخلص العمالة لأن الحزمة غير مكتملة: ' + completeness.missing.join('، ') + '. لم تُحذف الخطوات ولم يُقفل الشهر.');
      }
    } else {
      var sectionCompleteness = sectionBundleIntegrity(moduleName, snapshot);
      if (!sectionCompleteness.complete) {
        throw new Error('تم إيقاف رفع المستخلص لأن بيانات القسم الأساسية غير موجودة. لم تُرسل حزمة ناقصة ولم يُقفل الشهر.');
      }
    }

    snapshot.__najranSourceModule = moduleName;
    snapshot.__najranReviewPage = reviewPage;
    snapshot.sourceModule = snapshot.sourceModule || moduleName;
    snapshot.reviewPage = snapshot.reviewPage || reviewPage;

    var integrity = makeIntegrity(moduleName, snapshot, keyCopies);
    snapshot.__submittedExtractArchiveBundle_v1 = {
      version: 5,
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
      trackedKeysCount: Object.keys(keyCopies).length
    };

    payload.extractData = snapshot;
    payload.sourceModule = payload.sourceModule || moduleName;
    payload.reviewPage = payload.reviewPage || reviewPage;

    var finalSize = valueSize(payload);
    var finalBytes = valueUtf8Size(payload);
    console.log('[SubmittedExtractArchiveBundle] payload size', { before: originalSize, after: finalSize, bytes: finalBytes, module: moduleName, finalReviewSnapshot: isFinalReviewSnapshot(snapshot) });
    if (finalSize > WARN_PAYLOAD_CHARS) console.warn('[SubmittedExtractArchiveBundle] payload still large after cleanup:', finalSize);
    if (finalBytes > MAX_BUNDLE_BYTES) {
      throw new Error('تم إيقاف الرفع لأن حجم حزمة المستخلص الكامل أكبر من حد النقل الآمن 4MB. لم يتم حذف أي جدول ولم تُرسل نسخة ناقصة.');
    }
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

  function hasStorageHeadroom() {
    try {
      var probe = '__najran_storage_probe__';
      localStorage.setItem(probe, new Array(4096).join('x'));
      localStorage.removeItem(probe);
      return true;
    } catch (_) { return false; }
  }

  function shouldSkipLocalSnapshotBeforeSubmit() {
    try {
      if (!hasStorageHeadroom()) return true;
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key) continue;
        if (key.indexOf('extractArchive') > -1) {
          var raw = localStorage.getItem(key) || '';
          if (raw.length > 1024 * 1024) return true;
        }
      }
    } catch (_) {}
    return false;
  }

  function saveLocalSnapshotBeforeSubmit() {
    try {
      if (shouldSkipLocalSnapshotBeforeSubmit()) {
        console.warn('[SubmittedExtractArchiveBundle] local snapshot skipped: storage near quota or archive too large');
        return;
      }
      if (typeof window.saveExtractSnapshot === 'function') window.saveExtractSnapshot('submit-to-approval');
    } catch (e) {
      console.warn('[SubmittedExtractArchiveBundle] local snapshot before submit failed', e);
    }
  }

  function submitLockKeyFromPayload(payload) {
    payload = payload || {};
    var contractData = payload || {};
    return 'najran_submit_lock_' + [
      'submitted_extract',
      payload.extractType || '',
      contractData.companyName || '',
      contractData.hospitalName || localStorage.getItem('hospitalName') || '',
      contractData.extractYear || '',
      contractData.extractMonth || '',
      contractData.paymentNumber || contractData.extractNumber || ''
    ].join('__');
  }

  function clearSubmitLock(payload, reason) {
    try {
      var key = submitLockKeyFromPayload(payload);
      if (key) sessionStorage.removeItem(key);
      console.warn('[SubmittedExtractArchiveBundle] submit lock cleared:', reason || 'done');
    } catch (_) {}
  }

  function patchFetch() {
    if (window.fetch.__najranSubmittedArchiveBundleWrappedV5) return;
    var originalFetch = window.fetch;
    window.fetch = function (input, init) {
      var parsedPayload = null;
      try {
        if (shouldPatchFetch(input, init || {})) {
          var nextInit = Object.assign({}, init || {});
          var body = nextInit.body;
          if (!body && input && typeof input !== 'string' && input instanceof Request) {
            // لا نعيد بناء Request body غير المقروء. أغلب الرفع عندنا يستخدم fetch(url,{body}).
          } else if (typeof body === 'string' && body.trim().charAt(0) === '{') {
            var payload = JSON.parse(body);
            parsedPayload = payload;
            saveLocalSnapshotBeforeSubmit();
            payload = enrichPayload(payload);
            nextInit.body = JSON.stringify(payload);
            return originalFetch.call(this, input, nextInit)
              .then(function (res) {
                if (!res || !res.ok) clearSubmitLock(payload, 'network-failed');
                else clearSubmitLock(payload, 'network-ok');
                return res;
              })
              .catch(function (err) {
                clearSubmitLock(payload, 'network-error');
                throw err;
              });
          }
        }
      } catch (e) {
        clearSubmitLock(parsedPayload || {}, 'bundle-validation-error');
        console.error('[SubmittedExtractArchiveBundle] enrich failed; submit blocked to prevent partial upload', e);
        return Promise.reject(e);
      }
      return originalFetch.apply(this, arguments);
    };
    window.fetch.__najranSubmittedArchiveBundleWrappedV5 = true;
  }

  patchFetch();
  window.NajranSubmittedExtractArchiveGuard = {
    enrichPayload: enrichPayload,
    detectSourceModule: detectSourceModule,
    pageForModule: pageForModule,
    collectTrackedKeyCopies: collectTrackedKeyCopies,
    sanitizeSnapshot: sanitizeSnapshot,
    createLaborFinalReviewSnapshot: createLaborFinalReviewSnapshot
  };

  console.info('[SubmittedExtractArchiveBundle] installed v5 complete labor bundle');
})();
