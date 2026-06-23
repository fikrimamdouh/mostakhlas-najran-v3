// ===================================================================
// Admin Offices Raise Letters UI Styling + loaders
// Scope: admin_offices_attendance.html only
// - تنسيق شاشة خطابات الرفع
// - مسافة المحترم
// - زر حفظ إعدادات الخطابات
// - تحميل أدوات العمالة والبيانات الإضافية داخل نفس صفحة خطابات الرفع
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;

  function injectCss() {
    if (document.getElementById('admin-offices-raise-letters-screen-css')) return;
    const style = document.createElement('style');
    style.id = 'admin-offices-raise-letters-screen-css';
    style.textContent = `
      #raise-letters-overlay.settings-overlay{position:fixed;inset:0;background:rgba(15,23,42,.72);z-index:999999;display:flex;align-items:center;justify-content:center;padding:18px;direction:rtl;font-family:Tajawal,Arial,sans-serif}
      body.raise-letters-standalone-page #raise-letters-overlay.settings-overlay{position:static!important;inset:auto!important;display:block!important;background:transparent!important;padding:22px!important;min-height:100vh!important;z-index:auto!important}
      #raise-letters-overlay .settings-dialog{width:min(1220px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:22px;padding:20px;box-shadow:0 25px 70px rgba(0,0,0,.30);color:#0f172a}
      body.raise-letters-standalone-page #raise-letters-overlay .settings-dialog{width:min(1280px,96vw)!important;max-height:none!important;overflow:visible!important;margin:0 auto!important;box-shadow:0 18px 55px rgba(15,23,42,.16)!important}
      #raise-letters-overlay .settings-dialog h2{margin:0 0 16px;padding-bottom:12px;border-bottom:1px solid #e2e8f0;color:#003087;font-weight:900;text-align:center;font-size:24px}
      #raise-letters-overlay .btn-row{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;margin:12px 0 16px}
      #raise-letters-overlay .btn{border:0;border-radius:10px;padding:9px 14px;font-weight:900;cursor:pointer;font-family:inherit;box-shadow:0 4px 10px rgba(15,23,42,.08)}
      #raise-letters-overlay .btn-primary{background:#003087;color:#fff}
      #raise-letters-overlay .btn-gold{background:#d4af37;color:#111827}
      #raise-letters-overlay .btn-light{background:#f1f5f9;color:#111827;border:1px solid #cbd5e1}
      #raise-letters-overlay .section-box{border:1px solid #e2e8f0;border-radius:16px;padding:14px;margin-top:14px;background:#f8fafc}
      #raise-letters-overlay .section-box h3{margin:0 0 12px;color:#003087;font-weight:900;font-size:18px;text-align:center}
      #raise-letters-overlay .settings-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px}
      #raise-letters-overlay .field{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:10px}
      #raise-letters-overlay .field label{display:block;font-size:12px;font-weight:900;color:#334155;margin-bottom:6px}
      #raise-letters-overlay .field input,#raise-letters-overlay .field select{width:100%;min-height:36px;padding:8px 9px;border:1px solid #cbd5e1;border-radius:8px;font-family:inherit;font-weight:700;background:#fff}
      #raise-letters-overlay .readonly-box{min-height:38px;padding:9px 10px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;font-weight:900;line-height:1.8}
      #raise-letters-overlay .site-checks{max-height:270px;overflow:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px;margin-top:10px}
      #raise-letters-overlay .site-check{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px;font-weight:800;line-height:1.4}
      #raise-letters-overlay .site-check input{width:auto!important;min-height:auto!important}
      #raise-letters-overlay .recipient-suffix{margin-right:36px!important;padding-right:0!important;display:inline!important}
      #raise-letters-overlay .rl-section-save-row{display:flex;justify-content:center;margin:14px 0 2px}
      #raise-letters-overlay .rl-section-save-row .btn{min-width:190px}
      #admin-extra-docs-section{border:2px solid #d4af37!important;background:#fffbeb!important}
      @media print{#raise-letters-overlay.settings-overlay{display:none!important}}
    `;
    document.head.appendChild(style);
  }

  function patchPrintWindowSpacing() {
    if (window.__raiseLettersRecipientSpacingPatched) return;
    window.__raiseLettersRecipientSpacingPatched = true;
    const originalOpen = window.open;
    window.open = function patchedRaiseLettersOpen() {
      const win = originalOpen.apply(window, arguments);
      try {
        setTimeout(() => {
          if (!win || win.closed || !win.document) return;
          const title = String(win.document.title || '');
          const html = win.document.documentElement ? win.document.documentElement.innerHTML : '';
          if (!/خطاب|إقرار|المستهلكات|العمالة|شهادة|بيان/.test(title + html)) return;
          if (win.document.getElementById('raise-letter-recipient-spacing-fix')) return;
          const style = win.document.createElement('style');
          style.id = 'raise-letter-recipient-spacing-fix';
          style.textContent = '.recipient-suffix{margin-right:36px!important;padding-right:0!important;display:inline!important}.recipient-name{display:inline!important}';
          win.document.head.appendChild(style);
        }, 80);
      } catch (_) {}
      return win;
    };
  }

  function installSavedSettingsSaveButton() {
    const overlay = document.getElementById('raise-letters-overlay');
    if (!overlay) return;
    const boxes = Array.from(overlay.querySelectorAll('.section-box'));
    const target = boxes.find(box => ((box.querySelector('h3')?.textContent || '').includes('إعدادات الخطابات المحفوظة')));
    if (!target || target.querySelector('#raise-letters-save-settings-section-btn')) return;
    const row = document.createElement('div');
    row.className = 'rl-section-save-row';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'raise-letters-save-settings-section-btn';
    btn.className = 'btn btn-primary';
    btn.innerHTML = '<i class="fas fa-save"></i> حفظ إعدادات الخطابات';
    btn.onclick = function () {
      if (window.AdminOfficesRaiseLetters && typeof window.AdminOfficesRaiseLetters.saveDialog === 'function') window.AdminOfficesRaiseLetters.saveDialog();
    };
    row.appendChild(btn);
    target.appendChild(row);
  }

  function moveExtraDocsToTop() {
    const overlay = document.getElementById('raise-letters-overlay');
    const section = document.getElementById('admin-extra-docs-section');
    const dialog = overlay && overlay.querySelector('.settings-dialog');
    if (!dialog || !section) return;
    const firstDataBox = Array.from(dialog.querySelectorAll('.section-box')).find(box => !box.id && (box.querySelector('h3')?.textContent || '').includes('بيانات المستخلص'));
    if (firstDataBox && section.nextElementSibling !== firstDataBox) dialog.insertBefore(section, firstDataBox);
  }

  function observeDialogs() {
    if (window.__raiseLettersSettingsSaveObserver) return;
    window.__raiseLettersSettingsSaveObserver = new MutationObserver(() => { installSavedSettingsSaveButton(); moveExtraDocsToTop(); });
    window.__raiseLettersSettingsSaveObserver.observe(document.body, { childList: true, subtree: true });
  }

  function loadScriptOnce(id, src, label) {
    if (document.getElementById(id)) return;
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.onload = function () { console.info(label + ' loaded'); };
    script.onerror = function () { console.warn(label + ' failed to load'); };
    document.body.appendChild(script);
  }

  function loadModules() {
    loadScriptOnce('admin-offices-attendance-tools-script', '/original/admin_offices_attendance_tools.js?v=20260623_tools_v2', '[Admin Offices Tools]');
    loadScriptOnce('admin-offices-extra-docs-script', '/original/admin_offices_raise_letters_extra_docs.js?v=20260623_extra_docs_v2', '[Admin Offices Extra Docs]');
    setTimeout(moveExtraDocsToTop, 600);
  }

  injectCss();
  patchPrintWindowSpacing();
  observeDialogs();
  installSavedSettingsSaveButton();
  moveExtraDocsToTop();
  loadModules();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      injectCss(); patchPrintWindowSpacing(); observeDialogs(); installSavedSettingsSaveButton(); moveExtraDocsToTop(); setTimeout(loadModules, 900);
    });
  }

  setTimeout(injectCss, 700);
  setTimeout(installSavedSettingsSaveButton, 700);
  setTimeout(moveExtraDocsToTop, 700);
  setTimeout(loadModules, 1100);
  setTimeout(moveExtraDocsToTop, 1800);
  setTimeout(loadModules, 2600);

  console.info('[Admin Offices Raise Letters UI Styling] installed with top extra docs + tools v2');
})();