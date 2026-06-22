// revision-session-guard.js
// Guards switching from editing an old submitted extract to starting a new extract.
(function () {
  'use strict';

  function parse(raw, fallback) {
    try { return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }

  function isRevisionMode() {
    try {
      return localStorage.getItem('najran_revision_mode') === 'true' &&
        !!localStorage.getItem('najran_revision_extract_id') &&
        !!localStorage.getItem('najran_revision_snapshot');
    } catch (_) {
      return false;
    }
  }

  function clearRevisionMode() {
    [
      'najran_revision_extract_id',
      'najran_revision_mode',
      'najran_revision_extract_type',
      'najran_revision_started_at',
      'najran_revision_boot_lock',
      'najran_revision_source',
      'najran_revision_snapshot',
      'najran_revision_previous_total_amount'
    ].forEach(function (key) {
      try { localStorage.removeItem(key); } catch (_) {}
      try { sessionStorage.removeItem(key); } catch (_) {}
    });

    try { sessionStorage.removeItem('najran_revision_reloaded'); } catch (_) {}
  }

  function getRevisionLabel() {
    var extractId = localStorage.getItem('najran_revision_extract_id') || '—';
    var snapshot = parse(localStorage.getItem('najran_revision_snapshot'), {});
    var p = snapshot && snapshot.persistentExtractData;

    if (typeof p === 'string') p = parse(p, {});
    if (!p || typeof p !== 'object') p = {};

    var month = p.extractMonth || localStorage.getItem('extractMonth') || '';
    var year = p.extractYear || localStorage.getItem('extractYear') || '';
    var payment = p.paymentNumber || p.extractNumber || localStorage.getItem('paymentNumber') || '';

    return {
      extractId: extractId,
      month: month,
      year: year,
      payment: payment
    };
  }

  function revisionTargetPage() {
    var type = localStorage.getItem('najran_revision_extract_type') || 'labor';

    var pages = {
      labor: '/original/attendance.html',
      consumables: '/original/consumables.html',
      spare_parts: '/original/spare_parts.html',
      health_centers: '/original/health_centers_attendance.html',
      admin_offices: '/original/admin_offices_attendance.html'
    };

    return pages[type] || '/original/attendance.html';
  }

  function clearOperationalForRestore() {
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

    exact.forEach(function (key) { try { localStorage.removeItem(key); } catch (_) {} });
    for (var i = localStorage.length - 1; i >= 0; i--) {
      var key = localStorage.key(i);
      if (key && prefixes.some(function (p) { return key.indexOf(p) === 0; })) {
        try { localStorage.removeItem(key); } catch (_) {}
      }
    }
  }

  function restorePreviousLocalBackup() {
    var backup = parse(localStorage.getItem('najran_revision_previous_local_backup'), null);

    if (!backup || !backup.data || typeof backup.data !== 'object') {
      alert('لا توجد نسخة محلية محفوظة للرجوع إليها.');
      return;
    }

    var currentSession = localStorage.getItem('najran_session');
    clearRevisionMode();
    clearOperationalForRestore();

    Object.keys(backup.data).forEach(function (key) {
      try {
        if (backup.data[key] != null) localStorage.setItem(key, String(backup.data[key]));
      } catch (_) {}
    });

    if (currentSession) localStorage.setItem('najran_session', currentSession);
    localStorage.removeItem('najran_revision_previous_local_backup');

    window.location.href = '/original/settings_main.html?restoredLocalDraft=1&v=' + Date.now();
  }

  function showSwitchModal() {
    if (document.getElementById('najran-revision-switch-modal')) return;

    var label = getRevisionLabel();

    var modal = document.createElement('div');
    modal.id = 'najran-revision-switch-modal';
    modal.className = 'no-print';
    modal.style.cssText =
      'position:fixed;inset:0;z-index:10000000;background:rgba(15,23,42,.65);' +
      'display:flex;align-items:center;justify-content:center;direction:rtl;' +
      'font-family:Tajawal,Arial,sans-serif;';

    modal.innerHTML =
      '<div style="width:min(680px,94vw);background:#fff;border-radius:22px;padding:24px;' +
      'box-shadow:0 30px 90px rgba(0,0,0,.35);border-top:8px solid #ea580c;">' +
      '<h2 style="margin:0 0 10px;color:#c2410c;font-size:22px;font-weight:900;">' +
      'أنت داخل وضع تعديل مستخلص مرفوع' +
      '</h2>' +
      '<div style="background:#fff7ed;border:1px solid #fed7aa;color:#7c2d12;' +
      'border-radius:14px;padding:13px 15px;line-height:1.9;font-size:14px;margin-bottom:16px;">' +
      'المستخلص الحالي رقم: <b>' + label.extractId + '</b><br>' +
      'الفترة: <b>' + (label.month || '—') + ' ' + (label.year || '') + '</b><br>' +
      'رقم الدفعة: <b>' + (label.payment || '—') + '</b><br>' +
      '<span style="font-size:12px;color:#9a3412;">اختر الإجراء قبل بدء مستخلص جديد حتى لا يتم الخلط بين التعديل والمستخلص الجديد.</span>' +
      '</div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +
      '<button id="najran-continue-revision" style="background:#ea580c;color:#fff;border:0;' +
      'border-radius:12px;padding:12px 16px;font-weight:900;cursor:pointer;font-family:Tajawal,Arial,sans-serif;">' +
      'استكمال تعديل المستخلص' +
      '</button>' +
      '<button id="najran-start-new-extract" style="background:#16a34a;color:#fff;border:0;' +
      'border-radius:12px;padding:12px 16px;font-weight:900;cursor:pointer;font-family:Tajawal,Arial,sans-serif;">' +
      'الخروج وبدء مستخلص جديد' +
      '</button>' +
      '<button id="najran-restore-local-backup" style="background:#1d4ed8;color:#fff;border:0;' +
      'border-radius:12px;padding:12px 16px;font-weight:900;cursor:pointer;font-family:Tajawal,Arial,sans-serif;">' +
      'الرجوع لآخر نسخة محلية' +
      '</button>' +
      '</div>' +
      '</div>';

    document.body.appendChild(modal);

    document.getElementById('najran-continue-revision').onclick = function () {
      window.location.href = revisionTargetPage() + '?continueRevision=1&v=' + Date.now();
    };

    document.getElementById('najran-start-new-extract').onclick = function () {
      if (!confirm('سيتم الخروج من وضع تعديل المستخلص الحالي. أي رفع بعد ذلك سيُنشئ مستخلصًا جديدًا. هل تريد المتابعة؟')) return;
      clearRevisionMode();
      window.location.href = '/original/settings_main.html?newExtract=1&v=' + Date.now();
    };

    document.getElementById('najran-restore-local-backup').onclick = function () {
      restorePreviousLocalBackup();
    };
  }

  function shouldBlockNewExtractPage() {
    var sig = (window.location.pathname || '') + (window.location.search || '');
    var search = window.location.search || '';

    return /\/original\/settings_main\.html(?:$|[?#])/.test(sig) &&
      (
        search.indexOf('newExtract=1') !== -1 ||
        search.indexOf('new=1') !== -1 ||
        search.indexOf('startNew=1') !== -1
      );
  }

  function init() {
    if (!isRevisionMode()) return;
    if (shouldBlockNewExtractPage()) showSwitchModal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
