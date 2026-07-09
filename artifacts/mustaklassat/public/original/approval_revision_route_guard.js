// ===================================================================
// Approval Revision Route Guard — V4
// Scope: approval.html
// يفتح صفحة التعديل الصحيحة من snapshot/sourceModule، ويكتب مفاتيح وضع التعديل كاملة
// قبل التحويل حتى تظهر شارة سياق العمل كـ "تعديل مستخلص" لا "مستخلص جديد".
// ===================================================================
(function () {
  'use strict';
  if (!/approval\.html|review_extract\.html|original-viewer\?page=approval\.html/.test(location.pathname + location.search)) return;
  if (window.__NAJRAN_APPROVAL_REVISION_ROUTE_GUARD_V4__) return;
  window.__NAJRAN_APPROVAL_REVISION_ROUTE_GUARD_V4__ = true;

  function readJson(key, fallback) { try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; } }
  function parseValue(v) { if (!v) return {}; if (typeof v === 'string') { try { return JSON.parse(v); } catch (_) { return {}; } } if (typeof v === 'object') return v; return {}; }
  function clean(v) { return String(v || '').replace(/\s+/g, ' ').trim(); }
  function has(obj, key) { return obj && Object.prototype.hasOwnProperty.call(obj, key) && obj[key] != null && clean(typeof obj[key] === 'string' ? obj[key] : JSON.stringify(obj[key])) !== '{}' && clean(typeof obj[key] === 'string' ? obj[key] : JSON.stringify(obj[key])) !== '[]'; }

  function mergeTrackedCopies(snapshot) {
    snapshot = snapshot && typeof snapshot === 'object' ? snapshot : {};
    var bundle = parseValue(snapshot.__submittedExtractArchiveBundle_v1);
    var tracked = parseValue(bundle.trackedKeyCopies);
    Object.keys(tracked || {}).forEach(function (key) {
      if (snapshot[key] === undefined) snapshot[key] = tracked[key];
    });
    return snapshot;
  }

  function normalizeSnapshot(raw) {
    raw = parseValue(raw);
    var candidates = [raw.localStorageSnapshot, raw.storageSnapshot, raw.snapshot, raw.submittedData, raw.extractData, raw];
    var knownKeys = [
      'persistentExtractData','attendanceData','ng_attendanceData','nd_attendanceData',
      'healthCentersAttendanceData','centersAttendanceData_v2','adminOfficesAttendanceData_v1',
      'adminOfficesAttendanceData_v1_localBackup','adminOfficesLaborDataSafe_v2','adminOfficeNames_v1',
      'performanceData','performanceData_v4','performanceDeductions','adminOfficePerformanceDeductions_v1',
      'achievementData','achievementTitles_v1','achievementItemNames',
      'consumablesTableData','healthCentersConsumables','mainHospitalConsumables',
      'admin_offices_consumables_v1.0','spare_partsData','sparePartsTotalAmount',
      '__submittedExtractArchiveBundle_v1','__najranReviewPage','reviewPage','__najranSourceModule','sourceModule',
      'sb_sigs_admin_offices_grand_certificate','signatures_data_consumables_v27'
    ];
    for (var i = 0; i < candidates.length; i++) {
      var p = parseValue(candidates[i]);
      p = mergeTrackedCopies(p);
      if (p && typeof p === 'object' && Object.keys(p).some(function (k) { return knownKeys.indexOf(k) > -1 || /^sb_(sigs|prefs)_/.test(k); })) return p;
    }
    return {};
  }

  function reviewPageFromSnapshot(snapshot, extractType) {
    snapshot = snapshot || {};
    var bundle = parseValue(snapshot.__submittedExtractArchiveBundle_v1);
    var explicit = clean(snapshot.__najranReviewPage || snapshot.reviewPage || bundle.reviewPage);
    if (explicit) return explicit;
    var source = clean(snapshot.__najranSourceModule || snapshot.sourceModule || bundle.sourceModule);
    var sourceMap = {
      admin_offices_attendance: '/original/admin_offices_attendance.html',
      admin_offices_consumables: '/original/admin_offices_consumables.html',
      health_centers_attendance: '/original/health_centers_attendance.html',
      health_centers_consumables: '/original/health_centers_consumables.html',
      consumables: '/original/consumables.html',
      spare_parts: '/original/spare_parts.html',
      labor_attendance: '/original/attendance.html'
    };
    if (sourceMap[source]) return sourceMap[source];
    if (has(snapshot, 'adminOfficesAttendanceData_v1') || has(snapshot, 'adminOfficeNames_v1') || has(snapshot, 'adminOfficesLaborDataSafe_v2')) return '/original/admin_offices_attendance.html';
    if (has(snapshot, 'admin_offices_consumables_v1.0')) return '/original/admin_offices_consumables.html';
    if (has(snapshot, 'healthCentersAttendanceData') || has(snapshot, 'centersAttendanceData_v2')) return '/original/health_centers_attendance.html';
    if (has(snapshot, 'healthCentersConsumables')) return '/original/health_centers_consumables.html';
    if (extractType === 'admin_offices') return '/original/admin_offices_attendance.html';
    if (extractType === 'health_centers') return '/original/health_centers_attendance.html';
    if (extractType === 'consumables') return '/original/consumables.html';
    if (extractType === 'spare_parts') return '/original/spare_parts.html';
    return '/original/attendance.html';
  }

  var HEAVY_KEY_PATTERNS = [/^_u/, /extractArchive/i, /^monthSnapshot_/, /^monthSafetySnapshot_/, /backup/i, /Archive/, /PreWipeSnapshot/i, /^najran_revision_/, /^najran_submit_(lock|done)_/];
  function isHeavyBackupKey(k) { return HEAVY_KEY_PATTERNS.some(function (rx) { return rx.test(k); }); }
  function isHeavyBackupValue(v) {
    if (v == null) return true;
    var s = String(v);
    if (s.length > 300 * 1024) return true;
    if (s.indexOf('data:image') > -1) return true;
    if (s.indexOf(';base64,') > -1) return true;
    return false;
  }
  function backupCurrent(id) {
    try {
      var backup = {}, skipped = 0;
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i); if (!k) continue;
        if (isHeavyBackupKey(k)) { skipped++; continue; }
        var v = localStorage.getItem(k);
        if (isHeavyBackupValue(v)) { skipped++; continue; }
        backup[k] = v;
      }
      var raw = JSON.stringify({ extractId: id, createdAt: new Date().toISOString(), data: backup });
      localStorage.setItem('najran_revision_previous_local_backup', raw);
      console.info('[ApprovalRevisionRouteGuard] light backup saved:', Object.keys(backup).length, 'keys, skipped', skipped, ',', Math.round(raw.length / 1024) + 'KB');
      return true;
    } catch (e) {
      console.warn('[ApprovalRevisionRouteGuard] light backup skipped (quota?) — revision continues:', e && e.name);
      try { localStorage.removeItem('najran_revision_previous_local_backup'); } catch (_) {}
      return false;
    }
  }

  function clearOperational() {
    var keys = [
      'attendanceData','ng_attendanceData','nd_attendanceData','centersAttendanceData_v2','healthCentersAttendanceData',
      'adminOfficesAttendanceData_v1','adminOfficesAttendanceData_v1_localBackup','adminOfficesLaborDataSafe_v2',
      'persistentExtractData','extractMonth','extractYear','extractStart','extractEnd','extractFromDate','extractToDate','paymentNumber','extractNumber','periodMonth',
      'performanceData','performanceData_v4','performanceDeductions','adminOfficePerformanceDeductions_v1','performanceTotalDeduction','performanceTotalDue',
      'achievementData','achievementTitles_v1','achievementItemNames',
      'consumablesTableData','healthCentersConsumables','mainHospitalConsumables','admin_offices_consumables_v1.0','spare_partsData','sparePartsTotalAmount',
      'approvalData','displayApprovalData','finalLaborCost','finalConsumablesCost','grand-net-total','grand-net-total-centers','grand-net-total-admin',
      'najran_labor_attendance_done','najran_labor_performance_done','najran_health_attendance_done','najran_admin_offices_attendance_done',
      'najran_revision_mode','najran_revision_extract_id','najran_revision_snapshot','najran_revision_snapshot_summary','najran_revision_boot_lock','najran_revision_extract_type','najran_revision_started_at','najran_revision_source','najran_revision_previous_total_amount',
      'najran_editing_submitted_extract_id','najran_editing_submitted_extract_mode','najran_editing_submitted_extract_started_at',
      'signatures_data_consumables_v27','adminOfficesManualCleared_v1'
    ];
    var prefixes = [
      'deptCalculatedCost_', 'dept_', 'tableData_', 'achievement_', 'consumables_', 'spare_',
      'water_', 'sewage_', 'subcontractors_', 'najran_labor_', 'najran_health_', 'najran_admin_',
      'adminOffice', 'adminOffices', 'admin_offices_', 'healthCenters_Signatures_', 'sb_sigs_', 'sb_prefs_'
    ];
    keys.forEach(function (k) { try { localStorage.removeItem(k); } catch (_) {} });
    try {
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var key = localStorage.key(i);
        if (!key) continue;
        if (prefixes.some(function (p) { return key.indexOf(p) === 0; })) localStorage.removeItem(key);
      }
    } catch (_) {}
  }

  function writeValue(key, value) {
    if (value == null) return;
    if (String(key).indexOf('najran_submit_lock_') === 0 || String(key).indexOf('najran_submit_done_') === 0) return;
    if (String(key).indexOf('najran_revision_') === 0) return;
    try { localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)); } catch (_) {}
  }

  async function guardedStartRevision(id, type) {
    var session = readJson('najran_session', {});
    var token = session.clerkToken || '';
    if (!token) return alert('الجلسة منتهية. سجل دخول مرة أخرى.');
    try {
      var res = await fetch('/api/submitted-extracts/' + id, { headers: { Authorization: 'Bearer ' + token }, credentials: 'include' });
      if (!res.ok) return alert('تعذر تحميل بيانات المستخلص للتعديل');
      var full = await res.json();
      var snapshot = normalizeSnapshot(full.extractData);
      if (!snapshot || Object.keys(snapshot).length === 0) return alert('لا توجد بيانات محفوظة داخل هذا المستخلص للتعديل');
      var extractType = String(full.extractType || type || 'labor');
      var target = reviewPageFromSnapshot(snapshot, extractType);

      backupCurrent(id);
      clearOperational();
      Object.keys(snapshot).forEach(function (k) { writeValue(k, snapshot[k]); });

      var VERIFY_DATA_KEY = extractType === 'admin_offices' ? 'adminOfficesAttendanceData_v1'
        : extractType === 'health_centers' ? 'centersAttendanceData_v2'
        : extractType === 'consumables' ? 'consumablesTableData'
        : extractType === 'spare_parts' ? 'spare_partsData'
        : 'attendanceData';
      if (snapshot.persistentExtractData != null && localStorage.getItem('persistentExtractData') == null) {
        return alert('فشل التحقق بعد الاسترجاع (persistentExtractData). لم يتم فتح التعديل.');
      }
      if (snapshot[VERIFY_DATA_KEY] != null && localStorage.getItem(VERIFY_DATA_KEY) == null) {
        return alert('فشل التحقق بعد الاسترجاع (' + VERIFY_DATA_KEY + '). لم يتم فتح التعديل.');
      }

      if (full.companyName) localStorage.setItem('companyName', String(full.companyName));
      if (full.contractNumber) localStorage.setItem('contractNumber', String(full.contractNumber));
      if (full.hospitalName) localStorage.setItem('hospitalName', String(full.hospitalName));
      if (full.periodMonth) localStorage.setItem('periodMonth', String(full.periodMonth));

      localStorage.setItem('najran_editing_submitted_extract_id', String(id));
      localStorage.setItem('najran_editing_submitted_extract_mode', 'true');
      localStorage.setItem('najran_editing_submitted_extract_started_at', new Date().toISOString());

      try {
        var lightSummary = JSON.stringify({
          schema: 'revision_summary_v4',
          extractId: String(id),
          extractType: extractType,
          keys: Object.keys(snapshot).length,
          persistentExtractData: snapshot.persistentExtractData || null,
          companyName: full.companyName || null,
          hospitalName: full.hospitalName || null,
          totalAmount: full.totalAmount != null ? full.totalAmount : null,
          createdAt: new Date().toISOString()
        });
        localStorage.setItem('najran_revision_snapshot', lightSummary);
        localStorage.setItem('najran_revision_snapshot_summary', lightSummary);
      } catch (metaErr) {
        console.warn('[ApprovalRevisionRouteGuard] optional metadata skipped:', metaErr && metaErr.name);
      }

      localStorage.setItem('najran_revision_mode', 'true');
      localStorage.setItem('najran_revision_extract_id', String(id));
      localStorage.setItem('najran_revision_extract_type', extractType);
      localStorage.setItem('najran_revision_started_at', new Date().toISOString());
      localStorage.setItem('najran_revision_source', 'approval_revision_route_guard_v4');

      console.warn('[ApprovalRevisionRouteGuard] redirect', {
        id: id,
        extractType: extractType,
        revisionMode: localStorage.getItem('najran_revision_mode'),
        target: target,
        keys: Object.keys(snapshot).length,
        sourceModule: snapshot.__najranSourceModule || snapshot.sourceModule,
        signatureKeys: Object.keys(snapshot).filter(function (k) { return /^sb_(sigs|prefs)_/.test(k) || /^healthCenters_Signatures_/.test(k); }).length
      });
      window.location.href = target;
    } catch (err) {
      console.error('[ApprovalRevisionRouteGuard] failed', err);
      alert('حدث خطأ أثناء تجهيز المستخلص للتعديل');
    }
  }

  function install() {
    window.startRevision = guardedStartRevision;
  }
  install();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  setTimeout(install, 300);
  setTimeout(install, 1000);
  setTimeout(install, 2500);
  console.info('[ApprovalRevisionRouteGuard] installed v4 quota-safe revision restore + active mode marker');
})();
