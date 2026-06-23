// ===================================================================
// Approval Revision Route Guard — V1
// Scope: approval.html
// يعيد تعريف startRevision بحيث يفتح صفحة المراجعة الصحيحة من snapshot/sourceModule،
// بدلاً من تحويل مستخلص المكاتب إلى attendance.html العادي.
// ===================================================================
(function () {
  'use strict';
  if (!/approval\.html|review_extract\.html|original-viewer\?page=approval\.html/.test(location.pathname + location.search)) return;
  if (window.__NAJRAN_APPROVAL_REVISION_ROUTE_GUARD_V1__) return;
  window.__NAJRAN_APPROVAL_REVISION_ROUTE_GUARD_V1__ = true;

  function readJson(key, fallback) { try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; } }
  function parseValue(v) { if (!v) return {}; if (typeof v === 'string') { try { return JSON.parse(v); } catch (_) { return {}; } } if (typeof v === 'object') return v; return {}; }
  function clean(v) { return String(v || '').replace(/\s+/g, ' ').trim(); }
  function has(obj, key) { return obj && Object.prototype.hasOwnProperty.call(obj, key) && obj[key] != null && clean(typeof obj[key] === 'string' ? obj[key] : JSON.stringify(obj[key])) !== '{}' && clean(typeof obj[key] === 'string' ? obj[key] : JSON.stringify(obj[key])) !== '[]'; }

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
      '__submittedExtractArchiveBundle_v1','__najranReviewPage','reviewPage','__najranSourceModule','sourceModule'
    ];
    for (var i = 0; i < candidates.length; i++) {
      var p = parseValue(candidates[i]);
      if (p && typeof p === 'object' && Object.keys(p).some(function (k) { return knownKeys.indexOf(k) > -1; })) return p;
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

  function backupCurrent(id) {
    try {
      var backup = {};
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i); if (!k) continue;
        var v = localStorage.getItem(k); if (v != null) backup[k] = v;
      }
      localStorage.setItem('najran_revision_previous_local_backup', JSON.stringify({ extractId: id, createdAt: new Date().toISOString(), data: backup }));
    } catch (_) {}
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
      'najran_revision_mode','najran_revision_extract_id','najran_revision_snapshot','najran_revision_boot_lock','najran_revision_extract_type','najran_revision_started_at','najran_revision_source','najran_revision_previous_total_amount',
      'najran_editing_submitted_extract_id','najran_editing_submitted_extract_mode','najran_editing_submitted_extract_started_at'
    ];
    keys.forEach(function (k) { try { localStorage.removeItem(k); } catch (_) {} });
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

      if (full.companyName) localStorage.setItem('companyName', String(full.companyName));
      if (full.contractNumber) localStorage.setItem('contractNumber', String(full.contractNumber));
      if (full.hospitalName) localStorage.setItem('hospitalName', String(full.hospitalName));
      if (full.periodMonth) localStorage.setItem('periodMonth', String(full.periodMonth));

      localStorage.setItem('najran_editing_submitted_extract_id', String(id));
      localStorage.setItem('najran_editing_submitted_extract_mode', 'true');
      localStorage.setItem('najran_editing_submitted_extract_started_at', new Date().toISOString());
      localStorage.setItem('najran_revision_snapshot', JSON.stringify(snapshot));
      localStorage.setItem('najran_revision_extract_id', String(id));
      localStorage.setItem('najran_revision_extract_type', extractType);
      localStorage.setItem('najran_revision_source', 'approval_revision_route_guard');

      console.warn('[ApprovalRevisionRouteGuard] redirect', { id: id, extractType: extractType, target: target, sourceModule: snapshot.__najranSourceModule || snapshot.sourceModule });
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
  console.info('[ApprovalRevisionRouteGuard] installed v1');
})();