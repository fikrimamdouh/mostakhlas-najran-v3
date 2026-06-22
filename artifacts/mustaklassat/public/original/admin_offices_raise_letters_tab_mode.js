// ===================================================================
// Admin Offices Raise Letters Standalone Tab Mode
// Scope: admin_offices_attendance.html only
// يجعل زر خطابات الرفع يفتح في تبويب مستقل، ويحول شاشة الخطابات إلى صفحة كاملة
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;

  const PARAM = 'raiseLettersOnly';
  const isStandalone = new URLSearchParams(location.search).get(PARAM) === '1';

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
    if (api && typeof api.openDialog === 'function') {
      try { api.openDialog(); } catch (_) {}
    }

    const closeBtn = document.querySelector('#raise-letters-overlay .btn-light');
    if (closeBtn && !closeBtn.__standaloneClosePatched) {
      closeBtn.textContent = 'إغلاق التبويب';
      closeBtn.onclick = function () { window.close(); };
      closeBtn.__standaloneClosePatched = true;
    }
  }

  function boot(attempt) {
    patchMainButton();
    if (isStandalone) openAsStandalonePage();
    if (attempt < 40) setTimeout(() => boot(attempt + 1), 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot(0));
  else boot(0);

  console.info('[Admin Offices Raise Letters] standalone tab mode installed');
})();
