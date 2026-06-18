// Restores a locally saved draft after editing/re-uploading an older submitted extract.
(function () {
  'use strict';

  var BACKUP_KEY = 'najran_revision_previous_local_backup';
  var REVISION_KEY = 'najran_revision_extract_id';

  function parse(raw, fallback) {
    try { return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
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
    var prefixes = ['deptCalculatedCost_','dept_','tableData_','achievement_','consumables_','spare_','water_','sewage_','subcontractors_','najran_labor_','najran_health_','najran_admin_','monthSnapshot_'];
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

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show);
  else show();
  setTimeout(show, 800);
  setTimeout(show, 2500);
})();
