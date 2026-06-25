// ===================================================================
// Admin Offices Excel Import Clean V1
// Clean dialog only. Does not change import logic, storage keys, parser, or save functions.
// It only replaces the Excel button action with a clean dialog that calls existing APIs.
// ===================================================================
(function () {
  'use strict';

  if (!/admin_offices_attendance\.html(?:$|[?#])|original-viewer\?page=admin_offices_attendance\.html/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_EXCEL_IMPORT_CLEAN_V1__) return;
  window.__ADMIN_OFFICES_EXCEL_IMPORT_CLEAN_V1__ = true;

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function ensureCss() {
    if (document.getElementById('admin-offices-excel-import-clean-css')) return;
    var st = document.createElement('style');
    st.id = 'admin-offices-excel-import-clean-css';
    st.textContent = '' +
      '#management-dialog.admin-excel-clean-dialog{max-width:980px;width:min(980px,94vw);max-height:90vh;overflow:auto;border-radius:18px}' +
      '.excel-clean-wrap{direction:rtl;font-family:Tajawal,Arial,sans-serif;color:#0f172a}' +
      '.excel-clean-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;border-bottom:1px solid #e2e8f0;padding:16px 18px;background:#f8fafc;border-radius:18px 18px 0 0}' +
      '.excel-clean-head h3{margin:0;color:#003087;font-size:20px;font-weight:950}' +
      '.excel-clean-head p{margin:6px 0 0;color:#64748b;font-weight:800;line-height:1.7}' +
      '.excel-clean-body{padding:18px}' +
      '.excel-clean-card{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:16px;padding:16px;margin-bottom:14px}' +
      '.excel-clean-card h4{margin:0 0 8px;color:#166534;font-size:17px;font-weight:950}' +
      '.excel-clean-note{background:#fffbeb;border:1px solid #fde68a;border-radius:12px;color:#92400e;font-weight:850;line-height:1.8;padding:10px;margin:10px 0}' +
      '.excel-clean-file{width:100%;padding:11px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;margin:10px 0;font-family:inherit;font-weight:800}' +
      '.excel-clean-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:12px}' +
      '.excel-clean-btn{border:1px solid #cbd5e1;border-radius:10px;padding:10px 14px;font-family:inherit;font-weight:950;cursor:pointer;background:#f1f5f9;color:#0f172a}' +
      '.excel-clean-btn.success{background:#166534;color:white;border-color:#166534}' +
      '.excel-clean-btn.secondary{background:#003087;color:white;border-color:#003087}' +
      '.excel-clean-btn.danger{background:#fee2e2;color:#991b1b;border-color:#fecaca}' +
      '#admin-offices-full-import-status{margin-top:12px;font-size:.9rem;line-height:1.8;text-align:center}';
    document.head.appendChild(st);
  }

  function closeDialog() {
    var overlay = document.getElementById('dialog-overlay');
    var dlg = document.getElementById('management-dialog');
    if (overlay) overlay.style.display = 'none';
    if (dlg) {
      dlg.style.display = 'none';
      dlg.classList.remove('admin-excel-clean-dialog');
      dlg.innerHTML = '';
    }
  }

  function runImport(mode) {
    var api = window.AdminOfficesFullExcelImport;
    if (!api || typeof api.import !== 'function') {
      alert('دالة الاستيراد الشامل غير محملة بعد. أعد فتح الصفحة ثم جرّب مرة أخرى.');
      return;
    }
    return api.import(mode);
  }

  function renderDialog() {
    ensureCss();
    var overlay = document.getElementById('dialog-overlay');
    var dlg = document.getElementById('management-dialog');
    if (!dlg) return alert('تعذر فتح نافذة Excel: عنصر management-dialog غير موجود.');

    if (overlay) overlay.style.display = 'block';
    dlg.className = 'dialog admin-excel-clean-dialog';
    dlg.style.display = 'block';
    dlg.innerHTML = '' +
      '<div class="excel-clean-wrap">' +
        '<div class="excel-clean-head">' +
          '<div>' +
            '<h3><i class="fas fa-file-excel"></i> استيراد Excel للمكاتب الإدارية</h3>' +
            '<p>دايلوج نظيف للتحميل فقط. يستخدم نفس دوال الاستيراد الحالية بدون تغيير المفاتيح أو طريقة القراءة أو الحفظ.</p>' +
          '</div>' +
          '<button type="button" class="excel-clean-btn danger" id="excel-clean-close">إغلاق</button>' +
        '</div>' +
        '<div class="excel-clean-body">' +
          '<div class="excel-clean-card">' +
            '<h4><i class="fas fa-layer-group"></i> استيراد ملف شامل لكل الأقسام</h4>' +
            '<div class="excel-clean-note">كل Sheet يتم ربطه تلقائياً بالمكتب/القسم المطابق لاسمه. نفس محرك الاستيراد القديم يعمل هنا كما هو.</div>' +
            '<input type="file" id="admin-offices-full-excel-input" class="excel-clean-file" accept=".xlsx,.xls">' +
            '<div class="excel-clean-actions">' +
              '<button type="button" class="excel-clean-btn success" id="excel-clean-replace"><i class="fas fa-trash-alt"></i> استبدال شامل لكل الأقسام</button>' +
              '<button type="button" class="excel-clean-btn secondary" id="excel-clean-update"><i class="fas fa-sync-alt"></i> تحديث شامل لكل الأقسام</button>' +
            '</div>' +
            '<div id="admin-offices-full-import-status"></div>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.getElementById('excel-clean-close').onclick = closeDialog;
    document.getElementById('excel-clean-replace').onclick = function () { runImport('replace'); };
    document.getElementById('excel-clean-update').onclick = function () { runImport('update'); };
  }

  function patchExcelButton() {
    var buttons = Array.prototype.slice.call(document.querySelectorAll('#main-action-buttons button'));
    var btn = buttons.find(function (b) { return /Excel|إكسل|اكسل/.test((b.textContent || '').trim()); });
    if (!btn || btn.__adminExcelCleanPatched) return false;
    btn.onclick = function (e) {
      if (e && e.preventDefault) e.preventDefault();
      renderDialog();
      return false;
    };
    btn.__adminExcelCleanPatched = true;
    return true;
  }

  function boot() {
    patchExcelButton();
  }

  window.openAdminOfficesExcelImportCleanDialog = renderDialog;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  setTimeout(boot, 300);
  setTimeout(boot, 900);
  setTimeout(boot, 1800);

  console.info('[Admin Offices Excel Import Clean] installed v1');
})();