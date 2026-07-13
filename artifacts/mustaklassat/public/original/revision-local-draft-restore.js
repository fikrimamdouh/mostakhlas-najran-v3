// Restores a locally saved draft after editing/re-uploading an older submitted extract.
(function () {
  'use strict';

  var BACKUP_KEY = 'najran_revision_previous_local_backup';
  var REVISION_KEY = 'najran_revision_extract_id';

  function parse(raw, fallback) {
    try { return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function showNajranSystemDialog(options) {
    options = options || {};
    return new Promise(function (resolve) {
      var old = document.getElementById('najran-system-dialog');
      if (old && typeof old.__najranResolve === 'function') old.__najranResolve(false);
      else if (old) old.remove();

      var kind = options.kind || 'info';
      var palette = {
        info: { accent: '#166534', soft: '#f0fdf4', border: '#bbf7d0', icon: 'i', label: 'معلومة من النظام' },
        success: { accent: '#15803d', soft: '#f0fdf4', border: '#86efac', icon: '✓', label: 'تم بنجاح' },
        warning: { accent: '#b45309', soft: '#fffbeb', border: '#fde68a', icon: '!', label: 'تنبيه' },
        danger: { accent: '#b91c1c', soft: '#fef2f2', border: '#fecaca', icon: '!', label: 'تأكيد مطلوب' }
      }[kind] || null;
      if (!palette) palette = { accent: '#166534', soft: '#f0fdf4', border: '#bbf7d0', icon: 'i', label: 'معلومة من النظام' };

      var details = Array.isArray(options.details) ? options.details.filter(function (item) {
        return item && item.value != null && String(item.value).trim() !== '';
      }) : [];
      var detailsHtml = details.length ? '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px;margin:16px 0;">' +
        details.map(function (item) {
          return '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:13px;padding:11px 13px;">' +
            '<span style="display:block;color:#64748b;font-size:11px;font-weight:800;margin-bottom:4px;">' + escapeHtml(item.label || '') + '</span>' +
            '<b style="display:block;color:#0f172a;font-size:14px;overflow-wrap:anywhere;">' + escapeHtml(item.value) + '</b></div>';
        }).join('') + '</div>' : '';

      var overlay = document.createElement('div');
      overlay.id = 'najran-system-dialog';
      overlay.className = 'no-print';
      overlay.setAttribute('dir', 'rtl');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:rgba(15,23,42,.66);' +
        'display:flex;align-items:center;justify-content:center;padding:18px;font-family:Tajawal,Arial,sans-serif;' +
        'backdrop-filter:blur(4px);animation:najranSystemFade .16s ease-out;';
      overlay.innerHTML =
        '<style>@keyframes najranSystemFade{from{opacity:0}to{opacity:1}}' +
        '@keyframes najranSystemPop{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}' +
        '@media print{#najran-system-dialog{display:none!important}}</style>' +
        '<div role="dialog" aria-modal="true" aria-labelledby="najran-system-dialog-title" style="width:min(560px,95vw);' +
          'background:#fff;border-radius:22px;box-shadow:0 28px 90px rgba(0,0,0,.35);overflow:hidden;' +
          'border:1px solid ' + palette.border + ';animation:najranSystemPop .2s ease-out;">' +
          '<div style="height:6px;background:' + palette.accent + ';"></div>' +
          '<div style="padding:24px;">' +
            '<div style="display:flex;align-items:flex-start;gap:14px;">' +
              '<div aria-hidden="true" style="width:44px;height:44px;flex:0 0 44px;border-radius:14px;background:' + palette.soft + ';' +
                'border:1px solid ' + palette.border + ';color:' + palette.accent + ';display:flex;align-items:center;justify-content:center;' +
                'font-size:22px;font-weight:1000;">' + palette.icon + '</div>' +
              '<div style="min-width:0;flex:1;">' +
                '<span style="display:block;color:' + palette.accent + ';font-size:11px;font-weight:900;margin-bottom:5px;">' + escapeHtml(options.eyebrow || palette.label) + '</span>' +
                '<h2 id="najran-system-dialog-title" style="margin:0;color:#0f172a;font-size:21px;line-height:1.45;font-weight:900;">' + escapeHtml(options.title || 'رسالة من النظام') + '</h2>' +
              '</div>' +
            '</div>' +
            (options.message ? '<div style="white-space:pre-line;color:#475569;font-size:14px;line-height:1.9;margin-top:15px;">' + escapeHtml(options.message) + '</div>' : '') +
            detailsHtml +
            (options.note ? '<div style="background:' + palette.soft + ';border:1px solid ' + palette.border + ';border-radius:13px;' +
              'padding:11px 13px;color:' + palette.accent + ';font-size:12px;font-weight:800;line-height:1.8;margin-top:14px;">' + escapeHtml(options.note) + '</div>' : '') +
            '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:20px;">' +
              '<button id="najran-system-dialog-confirm" type="button" style="background:' + palette.accent + ';color:#fff;border:0;border-radius:12px;' +
                'padding:11px 19px;font-family:inherit;font-size:13px;font-weight:900;cursor:pointer;box-shadow:0 7px 18px ' + palette.accent + '33;">' + escapeHtml(options.confirmText || 'حسنًا') + '</button>' +
              (options.hideCancel ? '' : '<button id="najran-system-dialog-cancel" type="button" style="background:#f8fafc;color:#475569;border:1px solid #cbd5e1;' +
                'border-radius:12px;padding:11px 17px;font-family:inherit;font-size:13px;font-weight:900;cursor:pointer;">' + escapeHtml(options.cancelText || 'إلغاء') + '</button>') +
            '</div>' +
          '</div>' +
        '</div>';

      var finished = false;
      function finish(answer) {
        if (finished) return;
        finished = true;
        document.removeEventListener('keydown', onKeyDown, true);
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        resolve(answer);
      }
      function onKeyDown(event) {
        if (event.key === 'Escape') finish(false);
      }
      overlay.__najranResolve = finish;
      document.body.appendChild(overlay);
      document.addEventListener('keydown', onKeyDown, true);
      document.getElementById('najran-system-dialog-confirm').onclick = function () { finish(true); };
      var cancel = document.getElementById('najran-system-dialog-cancel');
      if (cancel) cancel.onclick = function () { finish(false); };
      overlay.addEventListener('click', function (event) {
        if (event.target === overlay && options.dismissOnBackdrop !== false) finish(false);
      });
      document.getElementById('najran-system-dialog-confirm').focus();
    });
  }

  window.NajranSystemDialog = showNajranSystemDialog;

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
  function applyRevisionBootSnapshot() {
    try {
      var isRevision =
        localStorage.getItem('najran_revision_mode') === 'true' &&
        localStorage.getItem('najran_revision_extract_id') &&
        localStorage.getItem('najran_revision_snapshot');

      if (!isRevision) return false;

      var rawSnapshot = localStorage.getItem('najran_revision_snapshot');
      if (!rawSnapshot) return false;

      var snapshot = parse(rawSnapshot, null);
      if (!snapshot || typeof snapshot !== 'object') return false;

      // ═══ حارس التطبيق مرة واحدة لكل جلسة تعديل (Apply-Once Guard) ═══
      // إعادة تطبيق snapshot الرفع القديم في كل تحميل كانت تمسح كل تعديلات
      // المستخدم (قيم وتواقيع) عند أي reload أو تنقل، وحتى بعد استعادة نسخة احتياطية.
      var _appliedExtractId = localStorage.getItem('najran_revision_extract_id') || '';
      var _appliedMarker = 'najran_revision_applied_once_' + _appliedExtractId;
      try {
        if (sessionStorage.getItem(_appliedMarker)) {
          console.warn('[RevisionBootGuard] snapshot already applied this session — preserving user edits');
          return true; // true = لا تُظهر صندوق المسودة ولا تمس بيانات المستخدم
        }
      } catch (_) {}

snapshot = normalizeRevisionSnapshotSettings(snapshot);
      console.warn('[RevisionBootGuard] applying submitted extract snapshot after page load');

      clearOperational();

      Object.keys(snapshot).forEach(function (key) {
        writeValue(key, snapshot[key]);
      });
hydrateRevisionExtractSettings(snapshot);
refreshSettingsPageAfterRevisionHydrate();
      localStorage.setItem('najran_revision_mode', 'true');
      localStorage.setItem('najran_revision_boot_lock', 'true');
      // تسجيل التطبيق الناجح فورًا — أي استدعاء لاحق في نفس الجلسة لن يمس بيانات المستخدم
      try { sessionStorage.setItem(_appliedMarker, String(Date.now())); } catch (_) {}

  setTimeout(function () {
        Object.keys(snapshot).forEach(function (key) {
          // حماية تعديلات المستخدم: لو غيّر المستخدم قيمة المفتاح بعد التمريرة الأولى، لا تلمسه
          try {
            var _cur = localStorage.getItem(key);
            var _snap = snapshot[key] == null ? null : (typeof snapshot[key] === 'string' ? snapshot[key] : JSON.stringify(snapshot[key]));
            if (_cur !== null && _snap !== null && _cur !== _snap) return;
          } catch (_) {}
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
      '<div style="font-size:13px;margin-bottom:10px;">' + escapeHtml(labelOf(backup)) + '</div>' +
      '<div style="font-size:12px;color:#9a3412;margin-bottom:12px;">تم حفظها قبل فتح مستخلص آخر للتعديل. يمكن استعادتها الآن أو تركها محفوظة.</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        '<button id="najran-restore-local-draft" style="background:#16a34a;color:#fff;border:0;border-radius:10px;padding:9px 13px;font-weight:900;cursor:pointer;">استعادة المسودة</button>' +
        '<button id="najran-hide-local-draft" style="background:#475569;color:#fff;border:0;border-radius:10px;padding:9px 13px;font-weight:900;cursor:pointer;">إخفاء الآن</button>' +
        '<button id="najran-discard-local-draft" style="background:#dc2626;color:#fff;border:0;border-radius:10px;padding:9px 13px;font-weight:900;cursor:pointer;">حذف المسودة</button>' +
      '</div>';
    document.body.appendChild(box);
    document.getElementById('najran-restore-local-draft').onclick = restore;
    document.getElementById('najran-hide-local-draft').onclick = function () { box.remove(); };
    document.getElementById('najran-discard-local-draft').onclick = async function () {
      var accepted = await showNajranSystemDialog({
        kind: 'danger',
        title: 'حذف المسودة المحلية؟',
        message: 'سيتم حذف المسودة المحفوظة من هذا الجهاز فقط، ولن يمكن استعادتها بعد ذلك.',
        confirmText: 'حذف المسودة',
        cancelText: 'الاحتفاظ بها',
        dismissOnBackdrop: false
      });
      if (accepted) discard();
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

    // تنظيف بقايا تجارب سابقة لو كانت موجودة على جهاز أي مستخدم
    'najran_revision_working_snapshot',
    'najran_revision_attendance_changed'
  ].forEach(function (key) {
    try { localStorage.removeItem(key); } catch (_) {}
    try { sessionStorage.removeItem(key); } catch (_) {}
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

    // ═══ استكمال جوهري: مفاتيح المستهلكات (كل الإصدارات) والتواقيع وأنماطها ═══
    // القائمة الثابتة أعلاه كانت تفتقدها كلها — فكان "حفظ نسخة محلية" من تعديل
    // مستهلكات لا يحفظ بيانات المستهلكات ولا التواقيع.
    var draftPrefixes = [
      'summary_data_', 'performance_data_', 'subcontractors_data_',
      'water_supply_data_', 'sewage_disposal_data_', 'laundry_supply_data_',
      'signatures_data_', 'print_titles_data_', 'notes_data_',
      'sb_sigs_', 'sb_style_prefs_', 'najranSignatureStyle',
      'hospitalConsumablesRaiseLettersSettings', 'dynamicSignatures', 'contractorSignature'
    ];
    try {
      for (var _i = 0; _i < localStorage.length; _i++) {
        var _k = localStorage.key(_i);
        if (!_k) continue;
        if (draftPrefixes.some(function (p) { return _k.indexOf(p) === 0; })) {
          try {
            var _v = localStorage.getItem(_k);
            if (_v != null) data[_k] = _v;
          } catch (_) {}
        }
      }
    } catch (_) {}

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
          escapeHtml(label) +
        '</div>' +

        '<p style="margin:0 0 14px;color:#475569;font-size:14px;line-height:1.9;">' +
          'اختيار الخروج سينهي وضع التعديل الحالي ويرجعك إلى صفحة المستخلصات المحفوظة. لن يتم رفع أي شيء للسحابة من هذا الاختيار.' +
        '</p>' +

        '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-start;">' +
          '<button id="najran-revision-save-exit" style="background:#166534;color:#fff;border:0;border-radius:10px;padding:11px 15px;font-weight:900;cursor:pointer;font-family:Tajawal,Arial,sans-serif;">حفظ نسخة محلية والخروج</button>' +
          '<button id="najran-revision-exit-no-save" style="background:#991b1b;color:#fff;border:0;border-radius:10px;padding:11px 15px;font-weight:900;cursor:pointer;font-family:Tajawal,Arial,sans-serif;">الخروج بدون حفظ</button>' +
          '<button id="najran-revision-exit-new" style="background:#1d4ed8;color:#fff;border:0;border-radius:10px;padding:11px 15px;font-weight:900;cursor:pointer;font-family:Tajawal,Arial,sans-serif;">مسح التعديل والبدء بمستخلص جديد</button>' +
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
  try { localStorage.removeItem('najran_revision_previous_local_backup'); } catch (_) {}
  try { sessionStorage.removeItem('najran_revision_previous_local_backup'); } catch (_) {}
  window.top.location.href = '/extracts/track?revisionExited=1&noSave=1&v=' + Date.now();
};

    document.getElementById('najran-revision-exit-new').onclick = async function () {
      var accepted = await showNajranSystemDialog({
        kind: 'warning',
        title: 'بدء مستخلص جديد؟',
        message: 'سيتم إنهاء وضع التعديل الحالي والانتقال لإعداد مستخلص جديد. تعديلات هذه الجلسة لن تُرفع إلى السحابة.',
        note: 'لن يتم حذف المستخلص المحفوظ الأصلي.',
        confirmText: 'إنهاء التعديل والبدء بجديد',
        cancelText: 'العودة للتعديل',
        dismissOnBackdrop: false
      });
      if (!accepted) return;
      clearRevisionOnly();
      window.top.location.href = '/original/settings_main.html?startNewExtract=1&v=' + Date.now();
    };

    document.getElementById('najran-revision-stay').onclick = function () {
      modal.remove();
    };

  } catch (e) {
    console.warn('[RevisionExit] failed to show modal', e);
  }
}

// ═══ شارة سياق العمل المعممة (Work Context Badge) ═══
// تُظهر للمستخدم على كل الصفحات هل هو داخل "تعديل مستخلص محفوظ" (برتقالي — بضغطة
// تفتح خيارات الحفظ/الخروج/البدء بجديد) أم يعمل على "مستخلص جديد/جاري" (أخضر — معلوماتي).
function installRevisionModeBadge() {
  try {
    if (document.getElementById('najran-revision-mode-badge')) return;
    if (!document.body) return;

    var isRev = isActiveRevisionMode();

    var typeMap = {
      labor: 'عمالة المستشفى', consumables: 'مستهلكات المستشفى', spare_parts: 'قطع الغيار',
      health_centers: 'المراكز الصحية', admin_offices: 'المكاتب الإدارية'
    };
    var t = localStorage.getItem('najran_revision_extract_type') || '';
    var typeLabel = typeMap[t] || t || 'مستخلص';
    var payment = localStorage.getItem('paymentNumber') || localStorage.getItem('extractNumber') || '';
    var month = localStorage.getItem('extractMonth') || '';
    var year = localStorage.getItem('extractYear') || '';
    var period = [month, year].filter(Boolean).join(' ');

    // في الوضع العادي: لا تُعرض الشارة إلا لو فيه سياق مستخلص فعلي قيد العمل
    if (!isRev && !payment && !period) return;

    var badge = document.createElement('div');
    badge.id = 'najran-revision-mode-badge';
    badge.setAttribute('dir', 'rtl');
    badge.style.cssText = 'position:fixed;bottom:18px;right:18px;z-index:2147483000;color:#fff;' +
      'padding:10px 14px;border-radius:12px;box-shadow:0 4px 14px rgba(0,0,0,.35);font-family:inherit;font-size:13px;' +
      'line-height:1.5;cursor:pointer;max-width:280px;user-select:none;background:' + (isRev ? '#b45309' : '#166534') + ';';

    var title = isRev ? 'وضع تعديل مستخلص' : 'مستخلص جديد / جاري';
    var details = (isRev ? typeLabel : '') +
      (payment ? (isRev ? ' — ' : '') + 'دفعة ' + payment : '') +
      (period ? ' — ' + period : '');
    var hint = isRev ? 'اضغط للحفظ أو الخروج أو البدء بمستخلص جديد' : 'أنت تعمل على مستخلص جديد — لست في وضع تعديل';

    badge.innerHTML =
      '<div style="font-weight:bold;display:flex;align-items:center;gap:6px;">' +
        '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:' + (isRev ? '#fde047' : '#86efac') + ';animation:najranRevPulse 1.6s infinite;"></span>' +
        escapeHtml(title) + '</div>' +
      (details ? '<div style="opacity:.95;margin-top:2px;">' + escapeHtml(details) + '</div>' : '') +
      '<div style="font-size:11px;opacity:.85;margin-top:4px;">' + escapeHtml(hint) + '</div>';

    var style = document.createElement('style');
    style.textContent = '@keyframes najranRevPulse{0%,100%{opacity:1}50%{opacity:.35}}' +
      '@media print{#najran-revision-mode-badge{display:none !important}}';
    badge.appendChild(style);

    badge.addEventListener('click', function () {
      if (isActiveRevisionMode()) {
        try { showRevisionExitModal(); } catch (e) { console.warn('[RevisionBadge] exit modal failed', e); }
      } else {
        showNajranSystemDialog({
          kind: 'info',
          eyebrow: 'حالة العمل الحالية',
          title: 'أنت تعمل على مستخلص جديد / جاري',
          message: 'هذا المستخلص غير مرتبط بسجل محفوظ في وضع التعديل.',
          details: [
            { label: 'رقم الدفعة', value: payment || 'غير محدد' },
            { label: 'الفترة', value: period || 'غير محددة' }
          ],
          note: 'الحفظ المحلي التلقائي نشط — تعديلاتك تُحفظ أولًا بأول على هذا الجهاز.',
          confirmText: 'متابعة العمل',
          hideCancel: true
        });
      }
    });

    document.body.appendChild(badge);
    console.warn('[RevisionBadge] work context badge installed:', isRev ? 'revision' : 'new', typeLabel, payment, period);
  } catch (e) {
    console.warn('[RevisionBadge] failed to install badge', e);
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

      showRevisionExitModal();
    }, true);

    // اعتراض التنقل للرئيسية عبر قوائم select (نمط: onchange="window.location.href=this.value")
    // موجود في 14+ صفحة: <option value="index.html">الصفحة الرئيسية</option>
    // stopPropagation في مرحلة الالتقاط يمنع وصول الحدث لمعالج onchange المضمّن فلا يحدث تنقل.
    document.addEventListener('change', function (e) {
      if (!isActiveRevisionMode()) return;
      var sel = e.target;
      if (!sel || String(sel.tagName || '').toUpperCase() !== 'SELECT') return;
      var v = String(sel.value || '');
      var isHome = v.indexOf('index.html') >= 0 || v.indexOf('dashboard') >= 0 || v === '/' || v === '/original/';
      if (!isHome) return;
      e.stopPropagation();
      e.preventDefault();
      try { sel.value = ''; } catch (_) {}
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
    installRevisionModeBadge();
  });
} else {
  if (!applyRevisionBootSnapshot()) show();
  installHomeAsRevisionExit();
  installRevisionModeBadge();
}

setTimeout(function () {
  if (!applyRevisionBootSnapshot()) show();
  installHomeAsRevisionExit();
  installRevisionModeBadge();
}, 1200);
})();
