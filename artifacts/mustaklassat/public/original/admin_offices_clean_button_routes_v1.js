// ===================================================================
// Admin Offices Clean Button Routes V2
// Purpose: route only damaged buttons to clean dialogs without changing business logic.
// Affected buttons: Excel, Bulk Attendance, Print.
// Does not change parser, storage keys, calculations, print builders, or save functions.
// ===================================================================
(function () {
  'use strict';

  if (!/admin_offices_attendance\.html(?:$|[?#])|original-viewer\?page=admin_offices_attendance\.html/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_CLEAN_BUTTON_ROUTES_V2__) return;
  window.__ADMIN_OFFICES_CLEAN_BUTTON_ROUTES_V2__ = true;

  function txt(el) { return String((el && el.textContent) || '').replace(/\s+/g, ' ').trim(); }
  function buttons() { return Array.prototype.slice.call(document.querySelectorAll('#main-action-buttons button')); }
  function findButton(pattern) { return buttons().find(function (b) { return pattern.test(txt(b)); }); }

  function closeDialog() {
    try {
      if (typeof window.closeDialog === 'function') {
        window.closeDialog('management-dialog');
      }
    } catch (_) {}
    var overlay = document.getElementById('dialog-overlay');
    var dlg = document.getElementById('management-dialog');
    if (overlay) {
      overlay.style.display = 'none';
      overlay.classList.remove('show');
    }
    if (dlg) {
      dlg.style.display = 'none';
      dlg.classList.remove('admin-print-clean-dialog');
    }
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }

  function ensurePrintCss() {
    if (document.getElementById('admin-offices-print-clean-dialog-css')) return;
    var st = document.createElement('style');
    st.id = 'admin-offices-print-clean-dialog-css';
    st.textContent = '' +
      '#management-dialog.admin-print-clean-dialog{max-width:980px;width:min(980px,94vw);border-radius:18px;overflow:hidden}' +
      '#management-dialog.admin-print-clean-dialog .dialog-body{max-height:68vh;overflow:auto;padding:16px}' +
      '.print-clean-note{background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a;border-radius:12px;padding:10px;margin-bottom:12px;font-weight:850;line-height:1.8}' +
      '.print-clean-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px}' +
      '.print-clean-row{display:flex;gap:8px;align-items:center;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px;font-weight:850}' +
      '.print-clean-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;padding:12px;border-top:1px solid #e2e8f0;background:#f8fafc}' +
      '.print-clean-btn{border:0;border-radius:10px;padding:10px 14px;font-family:Tajawal,Arial,sans-serif;font-weight:950;cursor:pointer}' +
      '.print-clean-btn.primary{background:#166534;color:white}' +
      '.print-clean-btn.light{background:#e2e8f0;color:#0f172a}' +
      '@media print{#management-dialog,#dialog-overlay,.print-clean-note,.print-clean-actions{display:none!important}}';
    document.head.appendChild(st);
  }

  function getNames() {
    try { if (typeof window.getCenterNames === 'function') return window.getCenterNames() || {}; } catch (_) {}
    try { return JSON.parse(localStorage.getItem('adminOfficeNames_v1') || '{}') || {}; } catch (_) { return {}; }
  }

  function toggleAll(containerId, checked) {
    document.querySelectorAll('#' + containerId + ' input[type="checkbox"]').forEach(function (cb) { cb.checked = !!checked; });
  }

  function runPrintSelected() {
    try {
      if (typeof window.printSelected !== 'function') {
        alert('دالة الطباعة غير محملة بعد. أعد فتح الصفحة ثم جرّب مرة أخرى.');
        return;
      }
      window.printSelected();
    } finally {
      setTimeout(closeDialog, 300);
      setTimeout(closeDialog, 1200);
      setTimeout(closeDialog, 2600);
    }
  }

  function openPrintCleanDialog() {
    ensurePrintCss();
    var names = getNames();
    var keys = Object.keys(names || {});
    var centersHTML = keys.map(function (key) {
      return '<label class="print-clean-row"><input type="checkbox" class="center-checkbox" value="' + key + '" checked><span>' + names[key] + '</span></label>';
    }).join('') || '<div class="print-clean-note">لا توجد مواقع محفوظة للطباعة.</div>';

    var content = '' +
      '<div class="dialog-header"><h3><i class="fas fa-print"></i> طباعة التقارير المجمعة</h3><span class="close" onclick="AdminOfficesCleanButtonRoutes.close()">×</span></div>' +
      '<div class="dialog-body">' +
        '<fieldset><legend>1. اختر المكاتب والمرافق</legend>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">' +
            '<button type="button" class="print-clean-btn light" onclick="AdminOfficesCleanButtonRoutes.toggleAll(\'print-centers-checkboxes\', true)">تحديد الكل</button>' +
            '<button type="button" class="print-clean-btn light" onclick="AdminOfficesCleanButtonRoutes.toggleAll(\'print-centers-checkboxes\', false)">إلغاء الكل</button>' +
          '</div>' +
          '<div id="print-centers-checkboxes" class="print-clean-grid">' + centersHTML + '</div>' +
        '</fieldset>' +
        '<fieldset style="margin-top:14px"><legend>2. اختر التقارير للطباعة</legend>' +
          '<div class="print-clean-grid">' +
            '<label class="print-clean-row"><input type="checkbox" id="print-opt-attendance" checked><span>تقرير الحضور والانصراف</span></label>' +
            '<label class="print-clean-row"><input type="checkbox" id="print-opt-performance" checked><span>شهادة تقييم الأداء</span></label>' +
            '<label class="print-clean-row"><input type="checkbox" id="print-opt-achievement" checked><span>شهادة الإنجاز</span></label>' +
          '</div>' +
        '</fieldset>' +
      '</div>' +
      '<div class="print-clean-actions">' +
        '<button type="button" class="print-clean-btn light" onclick="AdminOfficesCleanButtonRoutes.close()">إلغاء</button>' +
        '<button type="button" class="print-clean-btn primary" onclick="AdminOfficesCleanButtonRoutes.runPrint()"><i class="fas fa-print"></i> بدء الطباعة</button>' +
      '</div>';

    if (typeof window.openDialog === 'function') {
      window.openDialog(content, 'management-dialog', true);
      setTimeout(function () {
        var dlg = document.getElementById('management-dialog');
        if (dlg) dlg.classList.add('admin-print-clean-dialog');
      }, 50);
      return;
    }

    var dlg = document.getElementById('management-dialog');
    var overlay = document.getElementById('dialog-overlay');
    if (!dlg) return alert('تعذر فتح نافذة الطباعة: عنصر management-dialog غير موجود.');
    if (overlay) overlay.style.display = 'block';
    dlg.className = 'dialog admin-print-clean-dialog';
    dlg.innerHTML = content;
    dlg.style.display = 'block';
  }

  function openBulkCleanDialog() {
    if (window.AdminOfficesBulkAttendance && typeof window.AdminOfficesBulkAttendance.open === 'function') {
      return window.AdminOfficesBulkAttendance.open();
    }
    if (typeof window.openAdminOfficesBulkAttendanceDialog === 'function') {
      return window.openAdminOfficesBulkAttendanceDialog();
    }
    alert('دالة التعديل الجماعي غير محملة بعد. أعد فتح الصفحة ثم جرّب مرة أخرى.');
  }

  function openExcelCleanDialog() {
    if (typeof window.openAdminOfficesExcelImportCleanDialog === 'function') {
      return window.openAdminOfficesExcelImportCleanDialog();
    }
    if (typeof window.openImportDialog === 'function') {
      return window.openImportDialog();
    }
    alert('دالة Excel غير محملة بعد.');
  }

  function patchButton(btn, fn, flag) {
    if (!btn || btn[flag]) return false;
    btn.onclick = function (e) {
      if (e && e.preventDefault) e.preventDefault();
      fn();
      return false;
    };
    btn[flag] = true;
    return true;
  }

  function boot() {
    patchButton(findButton(/Excel|إكسل|اكسل/), openExcelCleanDialog, '__cleanExcelRouteV2');
    patchButton(findButton(/تعديل\s*جماعي/), openBulkCleanDialog, '__cleanBulkRouteV2');
    patchButton(findButton(/^\s*طباعة\s*$/), openPrintCleanDialog, '__cleanPrintRouteV2');
  }

  window.AdminOfficesCleanButtonRoutes = {
    boot: boot,
    openPrint: openPrintCleanDialog,
    openBulk: openBulkCleanDialog,
    openExcel: openExcelCleanDialog,
    runPrint: runPrintSelected,
    toggleAll: toggleAll,
    close: closeDialog
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 300);
  setTimeout(boot, 900);
  setTimeout(boot, 1800);
  setTimeout(boot, 3500);

  console.info('[Admin Offices Clean Button Routes] installed v2');
})();