// ===================================================================
// Admin Offices Raise Letters Standalone Tab Mode
// Scope: admin_offices_attendance.html only
// يجعل زر خطابات الرفع يفتح في تبويب مستقل، ويحول شاشة الخطابات إلى صفحة كاملة
// + يضبط شاشة استيراد Excel لتكون أصغر وبها Scroll داخلي
// + يحمل إصلاح موضوع خطاب الرفع النهائي الديناميكي
// + يحمل تعديل جماعي شبكي لكل الحالات وإصلاح طباعة الحضور الأساسية
// + يحمل طباعة الموقع الحالي بنفس دالة الطباعة الرئيسية وضبط أداء A4 صفحة واحدة
// + يحمل حارس أرشفة الرفع للاعتماد حتى تُحفظ نسخة مراجعة كاملة للمكاتب
// + يوضح تواقيع خطابات الرفع والإقرار داخل نافذة الخطابات
// + يقسم أزرار المستخلص والشهادات وخطابات المواقع بوضوح
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;

  const PARAM = 'raiseLettersOnly';
  const isStandalone = new URLSearchParams(location.search).get(PARAM) === '1';

  function loadScriptOnce(id, src) {
    if (document.getElementById(id)) return;
    const s = document.createElement('script');
    s.id = id;
    s.src = src;
    s.defer = true;
    s.onload = function () { console.info('[Admin Offices Raise Letters] loaded:', id); };
    s.onerror = function () { console.warn('[Admin Offices Raise Letters] failed:', id); };
    document.head.appendChild(s);
  }

  function loadDynamicFinalSubjectPatch() {
    loadScriptOnce('admin-offices-final-raise-dynamic-subject', '/original/admin_offices_final_raise_letter_dynamic_subject.js?v=20260623_final_subject_v1');
  }

  function loadBulkStatusGridPrintFix() {
    loadScriptOnce('admin-offices-bulk-status-grid-print-fix', '/original/admin_offices_bulk_status_grid_print_fix.js?v=20260623_bulk_grid_print_v1');
  }

  function loadSitePrintPerformanceFit() {
    loadScriptOnce('admin-offices-site-print-performance-fit', '/original/admin_offices_site_print_performance_fit.js?v=20260623_site_print_perf_v1');
  }

  function loadSubmittedArchiveBundleGuard() {
    loadScriptOnce('submitted-extract-archive-bundle-guard', '/original/submitted_extract_archive_bundle_guard.js?v=20260623_archive_bundle_v1');
  }

  function loadSignatureLabelsPatch() {
    loadScriptOnce('admin-offices-raise-letter-signature-labels', '/original/admin_offices_raise_letters_signature_labels.js?v=20260623_sig_labels_v1');
  }

  function loadButtonGroupsPatch() {
    loadScriptOnce('admin-offices-raise-letter-button-groups', '/original/admin_offices_raise_letters_button_groups.js?v=20260623_button_groups_v1');
  }

  function openStandaloneTab() {
    const url = new URL(location.href);
    url.searchParams.set(PARAM, '1');
    url.hash = 'raise-letters';
    window.open(url.toString(), '_blank');
  }

  function patchMainButton() {
    if (isStandalone) return;
    const api = window.AdminOfficesRaiseLetters;
    if (api && typeof api.openDialog === 'function' && !api.__raiseLettersTabPatched) {
      api.openDialog = openStandaloneTab;
      api.__raiseLettersTabPatched = true;
    }

    const btn = document.getElementById('raise-letters-btn');
    if (btn && !btn.__raiseLettersTabPatched) {
      btn.onclick = openStandaloneTab;
      btn.__raiseLettersTabPatched = true;
      btn.title = 'فتح خطابات الرفع في تبويب مستقل';
    }
  }

  function addStandaloneCss() {
    if (document.getElementById('raise-letters-standalone-css')) return;
    const style = document.createElement('style');
    style.id = 'raise-letters-standalone-css';
    style.textContent = `
      body.raise-letters-standalone-page{background:#eef3f9!important;overflow:auto!important;}
      body.raise-letters-standalone-page > *:not(#raise-letters-overlay):not(script):not(style):not(link):not(.modal):not(#unified-modal){display:none!important;}
      body.raise-letters-standalone-page #raise-letters-overlay.settings-overlay{
        position:static!important;inset:auto!important;display:block!important;background:transparent!important;
        padding:22px!important;min-height:100vh!important;z-index:auto!important;
      }
      body.raise-letters-standalone-page #raise-letters-overlay .settings-dialog{
        width:min(1280px,96vw)!important;max-height:none!important;overflow:visible!important;margin:0 auto!important;
        border-radius:22px!important;box-shadow:0 18px 55px rgba(15,23,42,.16)!important;
      }
      body.raise-letters-standalone-page #raise-letters-overlay .settings-dialog h2::before{
        content:'📄 ';font-family:Arial,sans-serif;
      }
      body.raise-letters-standalone-page #raise-letters-overlay .settings-dialog h2{
        position:sticky;top:0;background:#fff;z-index:3;padding:10px 0 14px;border-bottom:1px solid #e2e8f0;
      }
      body.raise-letters-standalone-page .standalone-topbar{
        display:flex!important;justify-content:space-between;align-items:center;gap:10px;margin:0 auto 12px;
        width:min(1280px,96vw);background:#0f172a;color:#fff;border-radius:16px;padding:12px 16px;font-family:Tajawal,Arial,sans-serif;
      }
      body.raise-letters-standalone-page .standalone-topbar button{
        border:0;border-radius:10px;padding:9px 14px;font-weight:900;cursor:pointer;background:#d4af37;color:#111827;font-family:Tajawal,Arial,sans-serif;
      }
      @media print{body.raise-letters-standalone-page .standalone-topbar{display:none!important}}
    `;
    document.head.appendChild(style);
  }

  function addExcelImportDialogCss() {
    if (document.getElementById('admin-offices-excel-import-scroll-css')) return;
    const style = document.createElement('style');
    style.id = 'admin-offices-excel-import-scroll-css';
    style.textContent = `
      #management-dialog.admin-offices-excel-import-dialog{align-items:center!important;justify-content:center!important;padding:10px!important;overflow:hidden!important;}
      #management-dialog.admin-offices-excel-import-dialog .dialog-content,
      #management-dialog.admin-offices-excel-import-dialog .dialog-box,
      #management-dialog.admin-offices-excel-import-dialog .dialog-panel,
      #management-dialog.admin-offices-excel-import-dialog .dialog{width:min(860px,96vw)!important;max-width:96vw!important;max-height:92vh!important;height:auto!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;border-radius:16px!important;}
      #management-dialog.admin-offices-excel-import-dialog .dialog-header{flex:0 0 auto!important;padding:10px 16px!important;}
      #management-dialog.admin-offices-excel-import-dialog .dialog-header h3{font-size:18px!important;margin:0!important;}
      #management-dialog.admin-offices-excel-import-dialog .dialog-body{flex:1 1 auto!important;overflow-y:auto!important;max-height:calc(92vh - 120px)!important;padding:12px 16px!important;overscroll-behavior:contain!important;}
      #management-dialog.admin-offices-excel-import-dialog .dialog-footer{flex:0 0 auto!important;padding:10px 16px!important;}
      #management-dialog.admin-offices-excel-import-dialog h4{font-size:15px!important;margin:0 0 8px!important;}
      #management-dialog.admin-offices-excel-import-dialog p{margin:0 0 8px!important;line-height:1.55!important;}
      #management-dialog.admin-offices-excel-import-dialog fieldset{margin:8px 0!important;padding:10px!important;}
      #management-dialog.admin-offices-excel-import-dialog .form-group{margin-bottom:8px!important;}
      #management-dialog.admin-offices-excel-import-dialog input[type=file]{padding:7px!important;margin:6px 0!important;}
      #management-dialog.admin-offices-excel-import-dialog .btn,
      #management-dialog.admin-offices-excel-import-dialog button{padding:7px 11px!important;font-size:13px!important;line-height:1.35!important;}
      #admin-offices-full-excel-section{padding:10px!important;margin:0 0 10px!important;}
      @media(max-height:720px){
        #management-dialog.admin-offices-excel-import-dialog .dialog-content,
        #management-dialog.admin-offices-excel-import-dialog .dialog-box,
        #management-dialog.admin-offices-excel-import-dialog .dialog-panel,
        #management-dialog.admin-offices-excel-import-dialog .dialog{max-height:96vh!important;}
        #management-dialog.admin-offices-excel-import-dialog .dialog-body{max-height:calc(96vh - 96px)!important;padding:8px 12px!important;}
        #management-dialog.admin-offices-excel-import-dialog .dialog-header,
        #management-dialog.admin-offices-excel-import-dialog .dialog-footer{padding:8px 12px!important;}
      }
    `;
    document.head.appendChild(style);
  }

  function applyExcelImportDialogLayout() {
    addExcelImportDialogCss();
    const dlg = document.getElementById('management-dialog');
    if (!dlg) return;
    const text = (dlg.textContent || '').trim();
    const isExcelImport = text.includes('استيراد بيانات من Excel') || text.includes('تامبليت الوظائف') || text.includes('استيراد ملف شامل لكل الأقسام');
    if (!isExcelImport) return;
    dlg.classList.add('admin-offices-excel-import-dialog');
    const body = dlg.querySelector('.dialog-body');
    if (body) {
      body.style.overflowY = 'auto';
      body.style.maxHeight = 'calc(92vh - 120px)';
      body.style.paddingInlineEnd = '14px';
    }
  }

  function topbar() {
    if (document.getElementById('raise-letters-standalone-topbar')) return;
    const bar = document.createElement('div');
    bar.id = 'raise-letters-standalone-topbar';
    bar.className = 'standalone-topbar';
    bar.innerHTML = '<strong>خطابات الرفع — المكاتب الإدارية والمرافق الصحية</strong><div><button type="button" onclick="window.close()">إغلاق التبويب</button></div>';
    document.body.insertBefore(bar, document.body.firstChild);
  }

  function openAsStandalonePage() {
    document.body.classList.add('raise-letters-standalone-page');
    addStandaloneCss();
    topbar();
    const api = window.AdminOfficesRaiseLetters;
    if (api && typeof api.openDialog === 'function') { try { api.openDialog(); } catch (_) {} }
    const closeBtn = document.querySelector('#raise-letters-overlay .btn-light');
    if (closeBtn && !closeBtn.__standaloneClosePatched) {
      closeBtn.textContent = 'إغلاق التبويب';
      closeBtn.onclick = function () { window.close(); };
      closeBtn.__standaloneClosePatched = true;
    }
  }

  function boot(attempt) {
    loadSubmittedArchiveBundleGuard();
    loadSignatureLabelsPatch();
    loadButtonGroupsPatch();
    loadDynamicFinalSubjectPatch();
    loadBulkStatusGridPrintFix();
    loadSitePrintPerformanceFit();
    patchMainButton();
    applyExcelImportDialogLayout();
    if (isStandalone) openAsStandalonePage();
    if (attempt < 40) setTimeout(() => boot(attempt + 1), 250);
  }

  document.addEventListener('click', function () {
    setTimeout(applyExcelImportDialogLayout, 80);
    setTimeout(applyExcelImportDialogLayout, 350);
    setTimeout(loadSubmittedArchiveBundleGuard, 120);
    setTimeout(loadSignatureLabelsPatch, 120);
    setTimeout(loadButtonGroupsPatch, 120);
    setTimeout(loadDynamicFinalSubjectPatch, 120);
    setTimeout(loadBulkStatusGridPrintFix, 120);
    setTimeout(loadSitePrintPerformanceFit, 120);
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot(0));
  else boot(0);

  console.info('[Admin Offices Raise Letters] standalone tab mode installed + Excel import scroll fix + final subject + bulk/print + site/performance fit + archive bundle + signature labels + button groups loader');
})();