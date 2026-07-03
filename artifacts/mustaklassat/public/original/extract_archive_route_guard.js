// ===================================================================
// Extract Archive Route Guard — V3
// Scope: extract-archive.html
// - يمنع زر الحضور في الأرشيف من فتح attendance.html العادي عندما يكون السياق مكاتب أو مراكز صحية.
// - يضبط زر اللقطة المحلية: فتح هذا المستخلص، مع حماية المستخلص المفتوح قبل الاستبدال.
// - لا يضيف ملفات جديدة ولا يرفع أي بيانات للسحابة.
// ===================================================================
(function () {
  'use strict';
  if (!/extract-archive\.html|original-viewer\?page=extract-archive\.html/.test(location.pathname + location.search)) return;
  if (window.__NAJRAN_EXTRACT_ARCHIVE_ROUTE_GUARD_V3__) return;
  window.__NAJRAN_EXTRACT_ARCHIVE_ROUTE_GUARD_V3__ = true;

  function readJson(key, fallback) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }
  function clean(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); }
  function hasMeaningful(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return false;
      if (raw === '{}' || raw === '[]' || raw === '0' || raw === '""') return false;
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.length > 0;
      if (parsed && typeof parsed === 'object') return Object.keys(parsed).length > 0;
      return !!clean(raw);
    } catch (_) {
      return !!clean(localStorage.getItem(key));
    }
  }
  function isMeaningfulRaw(raw) {
    if (!raw) return false;
    var s = String(raw).trim();
    return !!s && s !== '{}' && s !== '[]' && s !== '0' && s !== '""';
  }
  function allowedModules() {
    var s = readJson('najran_session', {});
    if (Array.isArray(s.allowedModules)) return s.allowedModules.map(String);
    try { return JSON.parse(String(s.allowedModules || '[]')).map(String); } catch (_) { return []; }
  }
  function sessionText() {
    var s = readJson('najran_session', {});
    var p = readJson('persistentContractData', {});
    return [s.hospital, s.name, s.role, p.hospitalName, p.contractDetails, localStorage.getItem('hospitalName')].map(clean).join(' | ');
  }
  function includesAny(text, words) {
    text = clean(text);
    return words.some(function (w) { return text.indexOf(w) > -1; });
  }
  function resolveAttendancePage() {
    var mods = allowedModules();
    var txt = sessionText();

    if (
      hasMeaningful('adminOfficesAttendanceData_v1') ||
      hasMeaningful('adminOfficesAttendanceData_v1_localBackup') ||
      hasMeaningful('adminOfficesLaborDataSafe_v2') ||
      hasMeaningful('adminOfficeNames_v1') ||
      mods.indexOf('admin_offices_attendance') > -1 ||
      includesAny(txt, ['المكاتب الإدارية', 'المكاتب الادارية', 'إصلاح السيارات', 'اصلاح السيارات', 'العيادات المتنقلة'])
    ) return '/original/admin_offices_attendance.html';

    if (
      hasMeaningful('healthCentersAttendanceData') ||
      hasMeaningful('centersAttendanceData_v2') ||
      mods.indexOf('health_centers_attendance') > -1 ||
      includesAny(txt, ['المراكز الصحية', 'مراكز صحية'])
    ) return '/original/health_centers_attendance.html';

    return '/original/attendance.html';
  }
  function patchHeaderAttendanceButton() {
    var href = resolveAttendancePage();
    Array.prototype.slice.call(document.querySelectorAll('a.btn-hdr, header a')).forEach(function (a) {
      var text = clean(a.textContent);
      if (text.indexOf('الحضور') === -1) return;
      var oldHref = a.getAttribute('href') || '';
      if (oldHref.indexOf('attendance.html') === -1) return;
      a.setAttribute('href', href);
      a.setAttribute('data-najran-route-guard', '1');
      a.title = 'يفتح صفحة الحضور المناسبة لسياق هذا المستخلص: ' + href;
    });
  }

  function hasMeaningfulLocalWork() {
    var exact = [
      'attendanceData', 'ng_attendanceData', 'nd_attendanceData',
      'healthCentersAttendanceData', 'centersAttendanceData_v2', 'adminOfficesAttendanceData_v1',
      'achievementData', 'consumablesTableData', 'healthCentersConsumables', 'mainHospitalConsumables',
      'admin_offices_consumables_v1.0', 'spare_partsData', 'sparePartsTotalAmount',
      'persistentExtractData', 'performanceData', 'performanceData_v4', 'performanceDeductions',
      'finalLaborCost', 'finalConsumablesCost', 'grand-net-total', 'grand-net-total-admin', 'grand-net-total-centers'
    ];
    try {
      for (var i = 0; i < exact.length; i++) if (isMeaningfulRaw(localStorage.getItem(exact[i]))) return true;
      for (var j = 0; j < localStorage.length; j++) {
        var key = localStorage.key(j) || '';
        if (/^(sb_sigs_|sb_prefs_|healthCenters_Signatures_|tableData_|deptCalculatedCost_|achievement_|adminOffice|adminOffices|najran_labor_|najran_health_|najran_admin_)/.test(key)) {
          if (isMeaningfulRaw(localStorage.getItem(key))) return true;
        }
      }
      return false;
    } catch (_) { return false; }
  }

  function currentSummaryHtml() {
    var ed = readJson('persistentExtractData', {});
    var cd = readJson('persistentContractData', {});
    var hospital = cd.hospitalName || localStorage.getItem('hospitalName') || '—';
    var month = ed.extractMonth || localStorage.getItem('extractMonth') || '—';
    var year = ed.extractYear || localStorage.getItem('extractYear') || '';
    var payment = ed.paymentNumber || localStorage.getItem('paymentNumber') || localStorage.getItem('extractNumber') || '—';
    return '<b>المستخلص المفتوح حاليًا</b>' +
      '<span>الموقع: ' + esc(hospital) + '</span>' +
      '<span>الفترة: ' + esc([month, year].filter(Boolean).join(' ')) + '</span>' +
      '<span>الدفعة: ' + esc(payment) + '</span>';
  }
  function selectedSummaryHtml(snap) {
    snap = snap || {};
    var savedAt = snap.savedAt ? new Date(snap.savedAt).toLocaleString('ar-SA') : '—';
    return '<b>المستخلص المختار من الأرشيف</b>' +
      '<span>الموقع: ' + esc(snap.hospitalName || '—') + '</span>' +
      '<span>الفترة: ' + esc([snap.extractMonth || '', snap.extractYear || ''].filter(Boolean).join(' ') || '—') + '</span>' +
      '<span>الدفعة: ' + esc(snap.paymentNumber || '—') + '</span>' +
      '<span>تاريخ الحفظ: ' + esc(savedAt) + '</span>';
  }
  function getArchive() {
    try {
      if (typeof window.getExtractArchive === 'function') return window.getExtractArchive() || [];
      return JSON.parse(localStorage.getItem('extractArchive') || '[]');
    } catch (_) { return []; }
  }
  function findSnap(id) {
    return getArchive().find(function (s) { return String(s && s.id) === String(id); }) || null;
  }

  function showOpenSelectedModal(snap) {
    return new Promise(function (resolve) {
      var old = document.getElementById('najran-open-selected-snapshot-modal');
      if (old) old.remove();
      var overlay = document.createElement('div');
      overlay.id = 'najran-open-selected-snapshot-modal';
      overlay.className = 'no-print';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:10000000;background:rgba(15,23,42,.65);display:flex;align-items:center;justify-content:center;direction:rtl;font-family:Tajawal,Arial,sans-serif;';
      overlay.innerHTML =
        '<div style="width:min(720px,94vw);background:#fff;border-radius:24px;padding:24px;box-shadow:0 28px 80px rgba(0,0,0,.32);border-top:7px solid #1e3a8a;text-align:right;">' +
          '<h2 style="margin:0;color:#1e3a8a;font-size:23px;font-weight:900;">يوجد مستخلص مفتوح حاليًا</h2>' +
          '<p style="margin:10px 0 0;color:#475569;font-size:14px;line-height:1.9;">أنت تحاول فتح مستخلص محفوظ من الأرشيف. فتح هذا المستخلص سيستبدل البيانات المفتوحة حاليًا على هذا الجهاز. يمكنك حفظ المستخلص الحالي أولًا أو فتح المختار بدون حفظ. لن يتم رفع أي بيانات للسحابة.</p>' +
          '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:16px 0;">' +
            '<div style="background:#fffbeb;border:1px solid #fde68a;color:#78350f;border-radius:15px;padding:13px;display:flex;flex-direction:column;gap:6px;font-size:13px;line-height:1.7;">' + currentSummaryHtml() + '</div>' +
            '<div style="background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a;border-radius:15px;padding:13px;display:flex;flex-direction:column;gap:6px;font-size:13px;line-height:1.7;">' + selectedSummaryHtml(snap) + '</div>' +
          '</div>' +
          '<div style="display:flex;gap:10px;justify-content:flex-start;flex-wrap:wrap;margin-top:16px;">' +
            '<button id="najran-open-selected-save" style="background:linear-gradient(135deg,#166534,#16a34a);color:#fff;border:0;border-radius:12px;padding:13px 22px;font-weight:950;font-size:15px;cursor:pointer;font-family:Tajawal,Arial,sans-serif;box-shadow:0 6px 18px rgba(22,163,74,.35);"><i class="fas fa-save"></i> حفظ الحالي وفتح المختار (مُوصى به)</button>' +
            '<button id="najran-open-selected-force" style="background:#fff;color:#b91c1c;border:2px solid #fca5a5;border-radius:12px;padding:11px 18px;font-weight:900;cursor:pointer;font-family:Tajawal,Arial,sans-serif;">فتح المختار بدون حفظ الحالي</button>' +
            '<button id="najran-open-selected-cancel" style="background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;border-radius:12px;padding:11px 18px;font-weight:800;cursor:pointer;font-family:Tajawal,Arial,sans-serif;">إلغاء</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(overlay);
      function close(result) { overlay.remove(); resolve(result); }
      document.getElementById('najran-open-selected-save').onclick = function () { close('save'); };
      document.getElementById('najran-open-selected-force').onclick = function () { close('force'); };
      document.getElementById('najran-open-selected-cancel').onclick = function () { close('cancel'); };
    });
  }

  function patchResume() {
    if (typeof window.resumeExtractSnapshot !== 'function') return false;
    if (window.resumeExtractSnapshot.__openSelectedWrappedV3) return true;
    var original = window.resumeExtractSnapshot;
    window.resumeExtractSnapshot = function (id, options) {
      options = options || {};
      if (options.skipProtection || options.__openSelectedInternal) return original.call(this, id, options);
      var snap = findSnap(id);
      if (!snap) return original.apply(this, arguments);
      if (String(localStorage.getItem('najran_local_draft_resume_id') || '') === String(id)) {
        alert('هذا المستخلص مفتوح بالفعل.');
        return true;
      }
      if (!hasMeaningfulLocalWork()) return original.call(this, id, { skipProtection: true, __openSelectedInternal: true });
      showOpenSelectedModal(snap).then(function (action) {
        if (action === 'save') {
          var saved = typeof window.saveExtractSnapshot === 'function' ? window.saveExtractSnapshot('before-open-selected-local-snapshot') : null;
          if (!saved) {
            alert('تعذر حفظ المستخلص الحالي محليًا. لم يتم فتح المستخلص المختار، ولم يتم مسح أي بيانات.');
            return;
          }
          original.call(window, id, { skipProtection: true, __openSelectedInternal: true });
          return;
        }
        if (action === 'force') {
          if (!confirm('سيتم استبدال المستخلص المفتوح حاليًا بدون حفظ نسخة منه. هل أنت متأكد؟')) return;
          original.call(window, id, { skipProtection: true, __openSelectedInternal: true });
        }
      });
      return false;
    };
    window.resumeExtractSnapshot.__openSelectedWrappedV3 = true;
    return true;
  }

  function patchArchiveResumeButtons() {
    try {
      document.querySelectorAll('.arc-btn-resume').forEach(function (btn) {
        if (!btn.__openSelectedTextPatchedV3) {
          btn.__openSelectedTextPatchedV3 = true;
          btn.innerHTML = '<i class="fas fa-folder-open"></i> فتح هذا المستخلص';
          btn.title = 'فتح هذا المستخلص من الأرشيف المحلي';
        }
      });
    } catch (_) {}
  }

  window.NajranArchiveRouteGuard = {
    resolveAttendancePage: resolveAttendancePage,
    patch: patchHeaderAttendanceButton,
    patchLocalOpenSelected: function () { patchResume(); patchArchiveResumeButtons(); }
  };

  function runPatches() { patchHeaderAttendanceButton(); patchResume(); patchArchiveResumeButtons(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', runPatches); else runPatches();
  setTimeout(runPatches, 400);
  setTimeout(runPatches, 1200);
  setTimeout(runPatches, 2500);
  document.addEventListener('click', function () { setTimeout(runPatches, 40); }, true);
  console.info('[ExtractArchiveRouteGuard] installed v3 inline open-selected · attendance route:', resolveAttendancePage());
})();