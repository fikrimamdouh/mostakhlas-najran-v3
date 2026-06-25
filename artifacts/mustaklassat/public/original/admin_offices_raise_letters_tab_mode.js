(function(){
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;

  const PARAM = 'raiseLettersOnly';
  const isStandalone = new URLSearchParams(location.search).get(PARAM) === '1';
  let opened = false;
  let tabOpenLockAt = 0;

  function loadOnce(id, src) {
    if (document.getElementById(id)) return;
    const s = document.createElement('script');
    s.id = id;
    s.src = src;
    s.defer = true;
    s.onload = function(){ console.info('[Admin Offices Raise Letters] loaded:', id); };
    s.onerror = function(){ console.warn('[Admin Offices Raise Letters] failed:', id); };
    document.head.appendChild(s);
  }

  function loadLettersHelpers() {
    loadOnce('submitted-extract-archive-bundle-guard', '/original/submitted_extract_archive_bundle_guard.js?v=20260623_archive_bundle_v1');
    loadOnce('admin-offices-raise-letters-period-fix', '/original/admin_offices_raise_letters_period_fix.js?v=20260625_period_no_pad_v1');
    loadOnce('admin-offices-final-raise-dynamic-subject', '/original/admin_offices_final_raise_letter_dynamic_subject.js?v=20260624_final_subject_iban_v2');

    // ترتيب التحميل مهم: ملف professional layout ينشئ #rl-professional-toolbar، ثم button_groups ينقل الأزرار داخله.
    loadOnce('admin-offices-raise-letter-signature-labels', '/original/admin_offices_raise_letters_signature_labels.js?v=20260624_sig_doc_settings_v3');
    loadOnce('admin-offices-raise-letter-button-groups', '/original/admin_offices_raise_letters_button_groups.js?v=20260624_button_groups_clean_v2');

    loadOnce('admin-offices-raise-letters-tafqeet-rows', '/original/admin_offices_raise_letters_tafqeet_rows.js?v=20260624_tafqeet_rows_v1');
    loadOnce('admin-offices-bulk-status-grid-print-fix', '/original/admin_offices_bulk_status_grid_print_fix.js?v=20260624_bulk_clean_v4');
    loadOnce('admin-offices-full-excel-visibility-guard', '/original/admin_offices_full_excel_visibility_guard.js?v=20260623_full_excel_visibility_v1');
  }

  function openStandaloneTab() {
    const now = Date.now();
    if (now - tabOpenLockAt < 1500) return;
    tabOpenLockAt = now;

    const url = new URL(location.href);
    url.searchParams.set(PARAM, '1');
    url.hash = 'raise-letters';
    window.open(url.toString(), '_blank');
  }

  function patchMainButton() {
    if (isStandalone) return;

    // لا تستبدل AdminOfficesRaiseLetters.openDialog هنا.
    // السبب: ملفات autofill/period_fix تلف نفس الدالة، ولو حوّلناها إلى window.open
    // أي استدعاء غير مباشر لها قد يفتح تبويبًا ثانيًا.
    const btn = document.getElementById('raise-letters-btn');
    if (btn && !btn.__raiseLettersTabPatched) {
      btn.onclick = function(e){
        if (e) { e.preventDefault(); e.stopPropagation(); }
        openStandaloneTab();
        return false;
      };
      btn.__raiseLettersTabPatched = true;
      btn.title = 'فتح خطابات الرفع في تبويب مستقل';
    }
  }

  function standaloneCss() {
    if (document.getElementById('raise-letters-standalone-css')) return;
    const style = document.createElement('style');
    style.id = 'raise-letters-standalone-css';
    style.textContent = `
      html, body.raise-letters-standalone-page {
        margin:0!important;
        min-height:100vh!important;
        background:#eef3f9!important;
        overflow:hidden!important;
      }
      body.raise-letters-standalone-page > *:not(#raise-letters-overlay):not(script):not(style):not(link):not(.modal):not(#unified-modal) {
        display:none!important;
      }
      body.raise-letters-standalone-page #raise-letters-overlay,
      body.raise-letters-standalone-page #raise-letters-overlay.settings-overlay {
        position:fixed!important;
        inset:0!important;
        z-index:2147483000!important;
        display:flex!important;
        align-items:flex-start!important;
        justify-content:center!important;
        background:#eef3f9!important;
        padding:18px!important;
        min-height:100vh!important;
        overflow:auto!important;
        direction:rtl!important;
      }
      body.raise-letters-standalone-page #raise-letters-overlay .settings-dialog {
        width:min(1280px,96vw)!important;
        max-height:none!important;
        overflow:visible!important;
        margin:0 auto!important;
        border-radius:22px!important;
        background:#fff!important;
        box-shadow:0 18px 55px rgba(15,23,42,.18)!important;
      }
      body.raise-letters-standalone-page #raise-letters-standalone-topbar {
        display:none!important;
      }
      @media print {
        body.raise-letters-standalone-page {
          overflow:visible!important;
          background:#fff!important;
        }
        body.raise-letters-standalone-page #raise-letters-overlay,
        body.raise-letters-standalone-page #raise-letters-overlay.settings-overlay {
          position:static!important;
          display:block!important;
          background:#fff!important;
          padding:0!important;
          overflow:visible!important;
        }
        body.raise-letters-standalone-page #raise-letters-overlay .settings-dialog {
          width:100%!important;
          max-height:none!important;
          overflow:visible!important;
          box-shadow:none!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function cleanDuplicateStandaloneShell() {
    document.querySelectorAll('#raise-letters-standalone-topbar').forEach(el => el.remove());
    const overlays = Array.from(document.querySelectorAll('#raise-letters-overlay'));
    overlays.slice(1).forEach(el => el.remove());
  }

  function closeStandaloneTab() {
    try { window.close(); } catch (_) {}
    setTimeout(function(){
      if (!window.closed) {
        document.body.innerHTML = '<div style="direction:rtl;font-family:Tajawal,Arial,sans-serif;text-align:center;padding:40px;font-weight:900;color:#0f172a">تم إغلاق شاشة خطابات الرفع. يمكنك إغلاق هذا التبويب من المتصفح.</div>';
      }
    }, 120);
  }

  function patchStandaloneClose() {
    if (!isStandalone) return;
    const api = window.AdminOfficesRaiseLetters;
    if (api && typeof api.closeDialog === 'function' && !api.__standaloneClosePatched) {
      api.closeDialog = closeStandaloneTab;
      api.__standaloneClosePatched = true;
    }
    const overlay = document.getElementById('raise-letters-overlay');
    if (!overlay) return;
    Array.from(overlay.querySelectorAll('button')).forEach(function(btn){
      const txt = String(btn.textContent || '').replace(/\s+/g, ' ').trim();
      if ((txt === 'إغلاق' || txt === 'إغلاق التبويب') && !btn.__standaloneClosePatched) {
        btn.onclick = function(e){
          if (e) { e.preventDefault(); e.stopPropagation(); }
          closeStandaloneTab();
          return false;
        };
        btn.__standaloneClosePatched = true;
      }
    });
  }

  function openStandalone() {
    document.body.classList.add('raise-letters-standalone-page');
    standaloneCss();
    cleanDuplicateStandaloneShell();
    if (opened && document.getElementById('raise-letters-overlay')) {
      patchStandaloneClose();
      return;
    }
    const api = window.AdminOfficesRaiseLetters;
    if (api && typeof api.openDialog === 'function') {
      opened = true;
      try {
        api.openDialog();
        setTimeout(cleanDuplicateStandaloneShell, 80);
        setTimeout(cleanDuplicateStandaloneShell, 400);
        setTimeout(patchStandaloneClose, 80);
        setTimeout(patchStandaloneClose, 400);
        setTimeout(patchStandaloneClose, 1200);
      } catch (_) {
        opened = false;
      }
    }
  }

  function boot(n) {
    loadLettersHelpers();
    patchMainButton();
    try { if (window.AdminOfficesRaiseLettersPeriodFix) window.AdminOfficesRaiseLettersPeriodFix.fixNow(); } catch (_) {}
    if (isStandalone) {
      openStandalone();
      patchStandaloneClose();
    }
    if (n < 40) setTimeout(function(){ boot(n + 1); }, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ boot(0); });
  else boot(0);

  document.addEventListener('click', function(){
    setTimeout(function(){
      loadLettersHelpers();
      patchMainButton();
      if (isStandalone) {
        cleanDuplicateStandaloneShell();
        patchStandaloneClose();
      }
    }, 120);
  }, true);

  console.info('[Admin Offices Raise Letters] standalone tab mode installed v7 overlay only single tab close fixed');
})();