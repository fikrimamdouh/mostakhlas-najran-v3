// ===================================================================
// Admin Offices Raise Letters UI + Signatures Fix
// Scope: admin_offices_attendance.html only
// - ينسق شاشة خطابات الرفع داخل الصفحة
// - يخفي أسماء التواقيع الثابتة من الإعدادات
// - يجعل تواقيع الخطابات من SignatureBlock مثل باقي البرنامج
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;

  const SIGNATURE_KEY = 'admin_offices_raise_letters_signatures';
  const SIG_PREFIX = 'sb_sigs_';
  const PREF_PREFIX = 'sb_prefs_';

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function esc(v) {
    return String(v || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function injectCss() {
    if (document.getElementById('admin-offices-raise-letters-ui-fix-css')) return;
    const css = document.createElement('style');
    css.id = 'admin-offices-raise-letters-ui-fix-css';
    css.textContent = `
      #raise-letters-overlay.settings-overlay{
        position:fixed!important;inset:0!important;background:rgba(15,23,42,.60)!important;
        z-index:999999!important;display:flex!important;align-items:center!important;justify-content:center!important;
        padding:16px!important;direction:rtl!important;font-family:Tajawal,Arial,sans-serif!important;
      }
      #raise-letters-overlay .settings-dialog{
        width:min(1180px,96vw)!important;max-height:92vh!important;overflow:auto!important;background:#fff!important;
        border-radius:20px!important;padding:18px!important;box-shadow:0 30px 80px rgba(0,0,0,.35)!important;
        color:#0f172a!important;text-align:right!important;
      }
      #raise-letters-overlay .settings-dialog h2{margin:0 0 14px!important;color:#003087!important;text-align:center!important;font-size:24px!important;font-weight:900!important;}
      #raise-letters-overlay .section-box{border:1px solid #dbe4ef!important;border-radius:16px!important;padding:14px!important;margin-top:14px!important;background:#f8fafc!important;}
      #raise-letters-overlay .section-box h3{margin:0 0 10px!important;color:#1e3c72!important;font-size:17px!important;font-weight:900!important;}
      #raise-letters-overlay .settings-grid{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))!important;gap:10px!important;align-items:end!important;}
      #raise-letters-overlay .field label{display:block!important;font-size:12px!important;font-weight:900!important;color:#334155!important;margin:0 0 4px!important;}
      #raise-letters-overlay .field input,#raise-letters-overlay .field select{
        width:100%!important;padding:8px 10px!important;border:1px solid #cbd5e1!important;border-radius:10px!important;
        font-family:Tajawal,Arial,sans-serif!important;font-size:13px!important;background:#fff!important;color:#111827!important;
      }
      #raise-letters-overlay .btn-row{display:flex!important;gap:8px!important;flex-wrap:wrap!important;margin:12px 0!important;justify-content:flex-start!important;}
      #raise-letters-overlay .btn{border:0!important;border-radius:11px!important;padding:9px 14px!important;font-weight:900!important;cursor:pointer!important;font-family:Tajawal,Arial,sans-serif!important;}
      #raise-letters-overlay .btn-primary{background:#003087!important;color:#fff!important;}
      #raise-letters-overlay .btn-green{background:#16a34a!important;color:#fff!important;}
      #raise-letters-overlay .btn-gold{background:#d4af37!important;color:#111827!important;}
      #raise-letters-overlay .btn-light{background:#e2e8f0!important;color:#111827!important;}
      #raise-letters-overlay .btn-red{background:#dc2626!important;color:#fff!important;}
      #raise-letters-overlay .mini-table{width:100%!important;border-collapse:collapse!important;font-size:12px!important;background:#fff!important;}
      #raise-letters-overlay .mini-table th,#raise-letters-overlay .mini-table td{border:1px solid #cbd5e1!important;padding:5px!important;text-align:center!important;}
      #raise-letters-overlay .mini-table th{background:#e5e7eb!important;color:#111827!important;font-weight:900!important;}
      #raise-letters-overlay .mini-table input{width:100%!important;border:0!important;padding:7px!important;font-family:Tajawal,Arial,sans-serif!important;background:#fff!important;}
      #raise-letters-overlay [data-rl-setting="managerName"],
      #raise-letters-overlay [data-rl-setting="unitManagerName"]{display:none!important;}
      #raise-letters-overlay .field:has([data-rl-setting="managerName"]),
      #raise-letters-overlay .field:has([data-rl-setting="unitManagerName"]){display:none!important;}
      @media print{#raise-letters-overlay{display:none!important}}
    `;
    document.head.appendChild(css);
  }

  function ensureSignatureDefaults() {
    const key = SIG_PREFIX + SIGNATURE_KEY;
    const existing = readJson(key, null);
    if (!Array.isArray(existing)) {
      localStorage.setItem(key, JSON.stringify([
        { title: 'مدير إدارة الإمداد والصيانة', name: '' }
      ]));
    }
  }

  function openLetterSignatures() {
    ensureSignatureDefaults();
    if (window.SignatureBlock && typeof window.SignatureBlock.open === 'function') {
      window.SignatureBlock.open(SIGNATURE_KEY);
      return;
    }
    alert('نظام التواقيع لم يكتمل تحميله بعد. أعد تحميل الصفحة.');
  }

  function buildSignaturesHTML() {
    ensureSignatureDefaults();
    const prefs = readJson(PREF_PREFIX + SIGNATURE_KEY, {});
    if (prefs.includeSigs === false) return '';
    const sigs = readJson(SIG_PREFIX + SIGNATURE_KEY, []);
    const rows = Array.isArray(sigs) && sigs.length ? sigs : [{ title: 'مدير إدارة الإمداد والصيانة', name: '' }];
    const count = rows.length;
    const items = rows.map(s => `
      <div>
        <div class="sig-title">${esc(s.title)}</div>
        <div class="line"></div>
        <div class="sig-name">${esc(s.name || '')}</div>
      </div>
    `).join('');
    return `<div class="signatures raise-letter-dynamic-signatures" style="display:grid;grid-template-columns:repeat(${Math.min(Math.max(count,1),3)},1fr);gap:20px;margin-top:35px;text-align:center">${items}</div>`;
  }

  function replacePrintSignatures(win) {
    try {
      if (!win || win.closed || !win.document) return;
      const doc = win.document;
      const page = doc.querySelector && doc.querySelector('.page');
      if (!page) return;
      const title = doc.title || '';
      if (!/(خطاب رفع|تقرير التوطين|إقرار عدم أسبقية الصرف)/.test(title)) return;
      page.querySelectorAll('.signatures').forEach(el => el.remove());
      const holder = doc.createElement('div');
      holder.innerHTML = buildSignaturesHTML();
      const footer = page.querySelector('.footer');
      if (holder.firstElementChild) {
        if (footer) page.insertBefore(holder.firstElementChild, footer);
        else page.appendChild(holder.firstElementChild);
      }
      if (!doc.getElementById('raise-letter-dynamic-signatures-style')) {
        const st = doc.createElement('style');
        st.id = 'raise-letter-dynamic-signatures-style';
        st.textContent = `.raise-letter-dynamic-signatures .sig-title{font-weight:900}.raise-letter-dynamic-signatures .sig-name{font-weight:800;margin-top:10px}.raise-letter-dynamic-signatures .line{height:42px;border-bottom:1px solid #111;margin:8px 30px}`;
        doc.head.appendChild(st);
      }
    } catch (_) {}
  }

  function patchWindowOpen() {
    if (window.open.__adminRaiseLettersSignaturePatched) return;
    const originalOpen = window.open;
    window.open = function patchedWindowOpen() {
      const win = originalOpen.apply(window, arguments);
      setTimeout(() => replacePrintSignatures(win), 250);
      setTimeout(() => replacePrintSignatures(win), 700);
      setTimeout(() => replacePrintSignatures(win), 1500);
      return win;
    };
    window.open.__adminRaiseLettersSignaturePatched = true;
  }

  function enhanceDialog() {
    const overlay = document.getElementById('raise-letters-overlay');
    if (!overlay) return;
    injectCss();
    const dialog = overlay.querySelector('.settings-dialog');
    if (!dialog || document.getElementById('raise-letter-signatures-inline-btn')) return;
    const row = dialog.querySelector('.btn-row');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'raise-letter-signatures-inline-btn';
    btn.className = 'btn btn-primary';
    btn.innerHTML = '<i class="fas fa-signature"></i> تعديل تواقيع الخطابات';
    btn.onclick = openLetterSignatures;
    if (row) row.insertBefore(btn, row.firstChild);
    else dialog.insertBefore(btn, dialog.firstChild);
  }

  function patchApi() {
    const api = window.AdminOfficesRaiseLetters;
    if (!api || api.__uiSignatureFixPatched) return false;
    if (typeof api.openDialog === 'function') {
      const oldOpen = api.openDialog;
      api.openDialog = function patchedOpenDialog() {
        const result = oldOpen.apply(this, arguments);
        setTimeout(enhanceDialog, 30);
        setTimeout(enhanceDialog, 300);
        return result;
      };
    }
    api.openLetterSignatures = openLetterSignatures;
    api.__uiSignatureFixPatched = true;
    return true;
  }

  function boot(attempt) {
    injectCss();
    patchWindowOpen();
    patchApi();
    enhanceDialog();
    if (attempt < 30) setTimeout(() => boot(attempt + 1), 300);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot(0));
  else boot(0);
  console.info('[Admin Offices Raise Letters] UI and signatures fix installed');
})();
