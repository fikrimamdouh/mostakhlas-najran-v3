// ===================================================================
// Admin Offices Raise Letters UI + Signatures Fix
// Scope: admin_offices_attendance.html only
// يحول صفحة خطابات الرفع إلى واجهة احترافية منظمة + تواقيع من SignatureBlock
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;

  const SIGNATURE_KEY = 'admin_offices_raise_letters_signatures';
  const SIG_PREFIX = 'sb_sigs_';
  const PREF_PREFIX = 'sb_prefs_';

  function readJson(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }

  function esc(v) {
    return String(v || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function injectCss() {
    let css = document.getElementById('admin-offices-raise-letters-ui-fix-css');
    if (!css) {
      css = document.createElement('style');
      css.id = 'admin-offices-raise-letters-ui-fix-css';
      document.head.appendChild(css);
    }

    css.textContent = `
      :root{
        --rl-primary:#003087;
        --rl-primary-2:#0056b3;
        --rl-ink:#0f172a;
        --rl-muted:#64748b;
        --rl-line:#dbe4ef;
        --rl-soft:#f6f9fe;
        --rl-soft-2:#eef5ff;
        --rl-gold:#d4af37;
        --rl-green:#15803d;
        --rl-red:#b91c1c;
      }
      #raise-letters-overlay.settings-overlay{
        position:fixed!important;inset:0!important;background:rgba(15,23,42,.68)!important;
        z-index:999999!important;display:flex!important;align-items:center!important;justify-content:center!important;
        padding:18px!important;direction:rtl!important;font-family:Tajawal,Arial,sans-serif!important;
      }
      #raise-letters-overlay .settings-dialog{
        width:min(1320px,97vw)!important;max-height:94vh!important;overflow:auto!important;background:#fff!important;
        border-radius:26px!important;padding:0!important;box-shadow:0 35px 90px rgba(2,6,23,.38)!important;
        color:var(--rl-ink)!important;text-align:right!important;border:1px solid rgba(255,255,255,.55)!important;
      }
      #raise-letters-overlay .settings-dialog::-webkit-scrollbar{width:10px!important;height:10px!important}
      #raise-letters-overlay .settings-dialog::-webkit-scrollbar-thumb{background:#b7c7dc!important;border-radius:20px!important}
      #raise-letters-overlay .settings-dialog h2{
        margin:0!important;padding:22px 28px!important;color:#fff!important;text-align:right!important;font-size:25px!important;font-weight:900!important;
        background:linear-gradient(135deg,var(--rl-primary),#0f3c88 58%,#102a56)!important;border-radius:26px 26px 0 0!important;
        display:flex!important;align-items:center!important;gap:12px!important;letter-spacing:-.2px!important;
      }
      #raise-letters-overlay .settings-dialog h2::before{content:'📄';font-family:Arial,sans-serif;font-size:26px;line-height:1}
      #raise-letters-overlay .settings-dialog h2::after{
        content:'لوحة مستقلة للطباعة والتوطين والخطابات';margin-right:auto;font-size:13px;font-weight:700;color:#dbeafe;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:7px 12px;
      }
      #raise-letters-overlay .btn-row:first-of-type{
        position:sticky!important;top:0!important;z-index:4!important;display:grid!important;grid-template-columns:repeat(auto-fit,minmax(155px,1fr))!important;
        gap:10px!important;margin:0!important;padding:14px 18px!important;background:rgba(255,255,255,.96)!important;
        border-bottom:1px solid var(--rl-line)!important;backdrop-filter:blur(12px)!important;
      }
      #raise-letters-overlay .btn{
        border:0!important;border-radius:14px!important;padding:11px 14px!important;font-weight:900!important;cursor:pointer!important;
        font-family:Tajawal,Arial,sans-serif!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:8px!important;
        box-shadow:0 8px 18px rgba(15,23,42,.08)!important;transition:.18s ease!important;min-height:44px!important;white-space:nowrap!important;
      }
      #raise-letters-overlay .btn:hover{transform:translateY(-2px)!important;box-shadow:0 12px 24px rgba(15,23,42,.13)!important}
      #raise-letters-overlay .btn-primary{background:linear-gradient(135deg,var(--rl-primary),var(--rl-primary-2))!important;color:#fff!important;}
      #raise-letters-overlay .btn-green{background:linear-gradient(135deg,#0f8a42,#16a34a)!important;color:#fff!important;}
      #raise-letters-overlay .btn-gold{background:linear-gradient(135deg,var(--rl-gold),#f3dc83)!important;color:#111827!important;}
      #raise-letters-overlay .btn-light{background:#eef2f7!important;color:#111827!important;border:1px solid #dbe4ef!important;}
      #raise-letters-overlay .btn-red{background:linear-gradient(135deg,var(--rl-red),#dc2626)!important;color:#fff!important;}
      #raise-letters-overlay .section-box{
        border:1px solid var(--rl-line)!important;border-radius:22px!important;padding:16px!important;margin:16px 18px!important;
        background:linear-gradient(180deg,#fff,var(--rl-soft))!important;box-shadow:0 10px 28px rgba(15,23,42,.06)!important;position:relative!important;overflow:hidden!important;
      }
      #raise-letters-overlay .section-box::before{
        content:'';position:absolute;right:0;top:0;bottom:0;width:5px;background:linear-gradient(180deg,var(--rl-primary),var(--rl-gold));
      }
      #raise-letters-overlay .section-box h3{
        margin:0 0 14px!important;color:var(--rl-primary)!important;font-size:18px!important;font-weight:900!important;
        display:flex!important;align-items:center!important;gap:8px!important;padding-right:8px!important;
      }
      #raise-letters-overlay .section-box h3::before{content:'';width:10px;height:10px;border-radius:999px;background:var(--rl-gold);display:inline-block;box-shadow:0 0 0 4px rgba(212,175,55,.18)}
      #raise-letters-overlay .settings-grid{
        display:grid!important;grid-template-columns:repeat(auto-fit,minmax(235px,1fr))!important;gap:12px!important;align-items:end!important;
      }
      #raise-letters-overlay .field{
        background:#fff!important;border:1px solid #e2e8f0!important;border-radius:15px!important;padding:9px 10px!important;
        box-shadow:0 4px 12px rgba(15,23,42,.035)!important;min-height:74px!important;
      }
      #raise-letters-overlay .field label{display:block!important;font-size:12px!important;font-weight:900!important;color:#334155!important;margin:0 0 6px!important;}
      #raise-letters-overlay .field input,#raise-letters-overlay .field select{
        width:100%!important;padding:9px 10px!important;border:1px solid #cbd5e1!important;border-radius:10px!important;
        font-family:Tajawal,Arial,sans-serif!important;font-size:13px!important;background:#fff!important;color:#111827!important;outline:none!important;
      }
      #raise-letters-overlay .field input:focus,#raise-letters-overlay .field select:focus{border-color:var(--rl-primary-2)!important;box-shadow:0 0 0 3px rgba(0,86,179,.13)!important;}
      #raise-letters-overlay .mini-table{width:100%!important;border-collapse:separate!important;border-spacing:0!important;font-size:12px!important;background:#fff!important;border:1px solid var(--rl-line)!important;border-radius:14px!important;overflow:hidden!important;}
      #raise-letters-overlay .mini-table th,#raise-letters-overlay .mini-table td{border-bottom:1px solid #e2e8f0!important;border-left:1px solid #e2e8f0!important;padding:7px!important;text-align:center!important;vertical-align:middle!important;}
      #raise-letters-overlay .mini-table tr:last-child td{border-bottom:0!important}
      #raise-letters-overlay .mini-table th{background:linear-gradient(135deg,#eff6ff,#dbeafe)!important;color:#0f2f66!important;font-weight:900!important;}
      #raise-letters-overlay .mini-table input{width:100%!important;border:1px solid transparent!important;border-radius:8px!important;padding:8px!important;font-family:Tajawal,Arial,sans-serif!important;background:#f8fafc!important;}
      #raise-letters-overlay .mini-table input:focus{background:#fff!important;border-color:var(--rl-primary-2)!important;outline:none!important;}
      #raise-letters-overlay .section-box .btn-row{display:flex!important;gap:10px!important;flex-wrap:wrap!important;margin:6px 0 12px!important;align-items:center!important;justify-content:flex-start!important;}
      #raise-letters-overlay .section-box .btn-row b{margin-right:auto!important;background:#ecfdf5!important;color:#166534!important;border:1px solid #bbf7d0!important;padding:9px 12px!important;border-radius:999px!important;font-size:13px!important;}
      #raise-letters-overlay [data-rl-setting="managerName"],#raise-letters-overlay [data-rl-setting="unitManagerName"]{display:none!important;}
      #raise-letters-overlay .field:has([data-rl-setting="managerName"]),#raise-letters-overlay .field:has([data-rl-setting="unitManagerName"]){display:none!important;}
      #raise-letters-overlay .rl-kpi-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:16px 18px 0!important;}
      #raise-letters-overlay .rl-kpi{background:linear-gradient(135deg,#0f3c88,#003087);color:#fff;border-radius:18px;padding:14px 16px;box-shadow:0 14px 30px rgba(0,48,135,.16);}
      #raise-letters-overlay .rl-kpi:nth-child(2){background:linear-gradient(135deg,#0f766e,#0d9488)}
      #raise-letters-overlay .rl-kpi:nth-child(3){background:linear-gradient(135deg,#92400e,#d4af37);color:#111827}
      #raise-letters-overlay .rl-kpi span{display:block;font-size:12px;font-weight:800;opacity:.9;margin-bottom:5px}.rl-kpi strong{font-size:18px;font-weight:900}
      #raise-letters-overlay .rl-help{margin:12px 18px 0;padding:11px 14px;border-radius:15px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:13px;font-weight:800;}
      body.raise-letters-standalone-page #raise-letters-overlay.settings-overlay{background:#eef3f9!important;padding:18px!important;align-items:flex-start!important;}
      body.raise-letters-standalone-page #raise-letters-overlay .settings-dialog{max-height:none!important;overflow:visible!important;box-shadow:0 20px 55px rgba(15,23,42,.14)!important;}
      @media(max-width:760px){#raise-letters-overlay .settings-dialog h2{font-size:19px!important;padding:18px!important}#raise-letters-overlay .settings-dialog h2::after{display:none}#raise-letters-overlay .btn-row:first-of-type{grid-template-columns:1fr 1fr!important}.settings-grid{grid-template-columns:1fr!important}}
      @media print{#raise-letters-overlay{display:none!important}}
    `;
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

  function addKpis(dialog) {
    if (!dialog || dialog.querySelector('.rl-kpi-strip')) return;
    const settings = readJson('adminOfficesRaiseLettersSettings_v1', {});
    const saud = readJson('adminOfficesSaudization_v1', {});
    const p2Rows = (saud.period2 && saud.period2.rows) || [];
    const saudTotal = p2Rows.reduce((sum, r) => sum + (Number(String(r.compensation || '').replace(/,/g, '')) || 0), 0);
    const period = `${settings.period2Start || 'غير محدد'} → ${settings.period2End || 'غير محدد'}`;
    const kpis = document.createElement('div');
    kpis.className = 'rl-kpi-strip';
    kpis.innerHTML = `
      <div class="rl-kpi"><span>رقم الدفعة</span><strong>${esc(settings.paymentNo || 'غير محدد')}</strong></div>
      <div class="rl-kpi"><span>فترة المستخلص الحالية</span><strong>${esc(period)}</strong></div>
      <div class="rl-kpi"><span>إجمالي توطين الفترة الحالية</span><strong>${esc(saudTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}</strong></div>
    `;
    const firstRow = dialog.querySelector('.btn-row');
    if (firstRow) firstRow.insertAdjacentElement('afterend', kpis);
  }

  function addHelp(dialog) {
    if (!dialog || dialog.querySelector('.rl-help')) return;
    const help = document.createElement('div');
    help.className = 'rl-help';
    help.textContent = 'هذه الصفحة تقرأ اسم الشركة ورقم الدفعة والفترة من إعدادات المستخلص المفتوح. التوطين مستقل ويُجمع تلقائيًا من جدول التوطين.';
    const kpis = dialog.querySelector('.rl-kpi-strip');
    if (kpis) kpis.insertAdjacentElement('afterend', help);
  }

  function enhanceDialog() {
    const overlay = document.getElementById('raise-letters-overlay');
    if (!overlay) return;
    injectCss();
    const dialog = overlay.querySelector('.settings-dialog');
    if (!dialog) return;

    addKpis(dialog);
    addHelp(dialog);

    if (!document.getElementById('raise-letter-signatures-inline-btn')) {
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
        setTimeout(enhanceDialog, 900);
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
  console.info('[Admin Offices Raise Letters] professional UI installed');
})();
