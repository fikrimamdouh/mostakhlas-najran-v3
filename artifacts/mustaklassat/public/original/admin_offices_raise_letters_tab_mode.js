(function(){
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;
  const PARAM='raiseLettersOnly';
  const isStandalone=new URLSearchParams(location.search).get(PARAM)==='1';
  let opened=false;
  function loadOnce(id,src){if(document.getElementById(id))return;const s=document.createElement('script');s.id=id;s.src=src;s.defer=true;s.onload=function(){console.info('[Admin Offices Raise Letters] loaded:',id)};s.onerror=function(){console.warn('[Admin Offices Raise Letters] failed:',id)};document.head.appendChild(s)}
  function loadLettersHelpers(){
    loadOnce('submitted-extract-archive-bundle-guard','/original/submitted_extract_archive_bundle_guard.js?v=20260623_archive_bundle_v1');
    loadOnce('admin-offices-raise-letters-period-fix','/original/admin_offices_raise_letters_period_fix.js?v=20260624_period_fix_v1');
    loadOnce('admin-offices-final-raise-dynamic-subject','/original/admin_offices_final_raise_letter_dynamic_subject.js?v=20260624_final_subject_iban_v2');
    loadOnce('admin-offices-raise-letter-button-groups','/original/admin_offices_raise_letters_button_groups.js?v=20260624_button_groups_clean_v2');
    loadOnce('admin-offices-raise-letter-signature-labels','/original/admin_offices_raise_letters_signature_labels.js?v=20260624_sig_doc_settings_v3');
    loadOnce('admin-offices-raise-letters-tafqeet-rows','/original/admin_offices_raise_letters_tafqeet_rows.js?v=20260624_tafqeet_rows_v1');
    loadOnce('admin-offices-bulk-status-grid-print-fix','/original/admin_offices_bulk_status_grid_print_fix.js?v=20260624_bulk_clean_v4');
    loadOnce('admin-offices-full-excel-visibility-guard','/original/admin_offices_full_excel_visibility_guard.js?v=20260623_full_excel_visibility_v1');
  }
  function openStandaloneTab(){const url=new URL(location.href);url.searchParams.set(PARAM,'1');url.hash='raise-letters';window.open(url.toString(),'_blank')}
  function patchMainButton(){if(isStandalone)return;const api=window.AdminOfficesRaiseLetters;if(api&&typeof api.openDialog==='function'&&!api.__raiseLettersTabPatched){api.openDialog=openStandaloneTab;api.__raiseLettersTabPatched=true}const btn=document.getElementById('raise-letters-btn');if(btn&&!btn.__raiseLettersTabPatched){btn.onclick=openStandaloneTab;btn.__raiseLettersTabPatched=true;btn.title='فتح خطابات الرفع في تبويب مستقل'}}
  function addStandaloneCss(){if(document.getElementById('raise-letters-standalone-css'))return;const style=document.createElement('style');style.id='raise-letters-standalone-css';style.textContent='body.raise-letters-standalone-page{background:#eef3f9!important;overflow:auto!important}body.raise-letters-standalone-page>#raise-letters-standalone-topbar{display:flex!important}body.raise-letters-standalone-page>#raise-letters-overlay{position:static!important;display:block!important;background:transparent!important;padding:22px!important;min-height:100vh!important}body.raise-letters-standalone-page #raise-letters-overlay .settings-dialog{width:min(1280px,96vw)!important;max-height:none!important;overflow:visible!important;margin:0 auto!important;border-radius:22px!important}.standalone-topbar{justify-content:space-between;align-items:center;gap:10px;margin:0 auto 12px;width:min(1280px,96vw);background:#0f172a;color:#fff;border-radius:16px;padding:12px 16px;font-family:Tajawal,Arial,sans-serif}.standalone-topbar button{border:0;border-radius:10px;padding:9px 14px;font-weight:900;background:#d4af37;color:#111827}';document.head.appendChild(style)}
  function topbar(){if(document.getElementById('raise-letters-standalone-topbar'))return;const bar=document.createElement('div');bar.id='raise-letters-standalone-topbar';bar.className='standalone-topbar';bar.innerHTML='<strong>خطابات الرفع — المكاتب الإدارية والمرافق الصحية</strong><div><button type="button" onclick="window.close()">إغلاق التبويب</button></div>';document.body.insertBefore(bar,document.body.firstChild)}
  function openStandalone(){document.body.classList.add('raise-letters-standalone-page');addStandaloneCss();topbar();if(opened||document.getElementById('raise-letters-overlay'))return;const api=window.AdminOfficesRaiseLetters;if(api&&typeof api.openDialog==='function'){opened=true;try{api.openDialog()}catch(_){opened=false}}}
  function boot(n){loadLettersHelpers();patchMainButton();try{if(window.AdminOfficesRaiseLettersPeriodFix)window.AdminOfficesRaiseLettersPeriodFix.fixNow()}catch(_){}if(isStandalone)openStandalone();if(n<40)setTimeout(function(){boot(n+1)},250)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){boot(0)});else boot(0);
  document.addEventListener('click',function(){setTimeout(function(){loadLettersHelpers();patchMainButton()},120)},true);
  console.info('[Admin Offices Raise Letters] standalone tab mode installed v5 letters helper loader');
})();