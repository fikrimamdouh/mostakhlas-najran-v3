// ===================================================================
// Admin Offices Raise Letters UI + Signatures Fix
// Scope: admin_offices_attendance.html only
// يعيد بناء واجهة خطابات الرفع كتطبيق مصغر احترافي منظم بتبويبات
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
    return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function num(v) {
    const n = Number(String(v || '').replace(/,/g, ''));
    return isNaN(n) ? 0 : n;
  }
  function money(v) {
    return num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function getSettings() { return readJson('adminOfficesRaiseLettersSettings_v1', {}); }
  function getSaudization() { return readJson('adminOfficesSaudization_v1', {}); }
  function getCompanyName() {
    const c = readJson('persistentContractData', {});
    const s = readJson('najran_session', {});
    return c.companyName || s.companyName || document.querySelector('.companyName')?.textContent || 'غير محدد';
  }

  function injectCss() {
    let css = document.getElementById('admin-offices-raise-letters-ui-fix-css');
    if (!css) {
      css = document.createElement('style');
      css.id = 'admin-offices-raise-letters-ui-fix-css';
      document.head.appendChild(css);
    }
    css.textContent = `
      :root{--rl-blue:#003087;--rl-blue2:#0b5eb8;--rl-ink:#0f172a;--rl-muted:#64748b;--rl-line:#dbe4ef;--rl-soft:#f6f9fe;--rl-gold:#d4af37;--rl-green:#15803d;--rl-red:#b91c1c}
      #raise-letters-overlay.settings-overlay{position:fixed!important;inset:0!important;background:rgba(15,23,42,.72)!important;z-index:999999!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:18px!important;direction:rtl!important;font-family:Tajawal,Arial,sans-serif!important}
      #raise-letters-overlay .settings-dialog{width:min(1360px,97vw)!important;max-height:94vh!important;overflow:auto!important;background:#fff!important;border-radius:28px!important;padding:0!important;box-shadow:0 35px 90px rgba(2,6,23,.4)!important;color:var(--rl-ink)!important;text-align:right!important;border:1px solid rgba(255,255,255,.6)!important}
      #raise-letters-overlay .settings-dialog::-webkit-scrollbar{width:10px;height:10px}#raise-letters-overlay .settings-dialog::-webkit-scrollbar-thumb{background:#b7c7dc;border-radius:20px}
      .rl-shell{background:#fff;border-radius:28px;overflow:hidden}
      .rl-hero{background:linear-gradient(135deg,var(--rl-blue),#0e3f8f 60%,#102a56);color:#fff;padding:22px 26px;display:grid;grid-template-columns:1fr auto;gap:18px;align-items:center}
      .rl-hero h2{margin:0!important;padding:0!important;background:transparent!important;color:#fff!important;font-size:27px!important;font-weight:900!important;text-align:right!important;display:flex!important;align-items:center!important;gap:10px!important}
      .rl-hero h2:before{content:'📄';font-family:Arial,sans-serif}.rl-hero p{margin:7px 0 0;color:#dbeafe;font-size:13px;font-weight:800}.rl-hero-actions{display:flex;gap:9px;flex-wrap:wrap;justify-content:flex-end}
      #raise-letters-overlay .btn{border:0!important;border-radius:14px!important;padding:10px 14px!important;font-weight:900!important;cursor:pointer!important;font-family:Tajawal,Arial,sans-serif!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:7px!important;box-shadow:0 8px 18px rgba(15,23,42,.09)!important;transition:.18s ease!important;min-height:42px!important;white-space:nowrap!important}
      #raise-letters-overlay .btn:hover{transform:translateY(-2px)!important}.btn-primary{background:linear-gradient(135deg,var(--rl-blue),var(--rl-blue2))!important;color:#fff!important}.btn-green{background:linear-gradient(135deg,#0f8a42,#16a34a)!important;color:#fff!important}.btn-gold{background:linear-gradient(135deg,var(--rl-gold),#f3dc83)!important;color:#111827!important}.btn-light{background:#eef2f7!important;color:#111827!important;border:1px solid #dbe4ef!important}.btn-red{background:linear-gradient(135deg,var(--rl-red),#dc2626)!important;color:#fff!important}
      .rl-content{padding:18px}.rl-kpi-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin-bottom:14px}.rl-kpi{background:linear-gradient(135deg,#0f3c88,#003087);color:#fff;border-radius:20px;padding:15px 16px;box-shadow:0 14px 30px rgba(0,48,135,.14)}.rl-kpi:nth-child(2){background:linear-gradient(135deg,#0f766e,#0d9488)}.rl-kpi:nth-child(3){background:linear-gradient(135deg,#92400e,#d4af37);color:#111827}.rl-kpi:nth-child(4){background:linear-gradient(135deg,#4338ca,#6366f1)}.rl-kpi span{display:block;font-size:12px;font-weight:800;opacity:.92;margin-bottom:5px}.rl-kpi strong{font-size:18px;font-weight:900}
      .rl-action-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:12px;margin:14px 0}.rl-action-card{border:1px solid var(--rl-line);background:linear-gradient(180deg,#fff,var(--rl-soft));border-radius:20px;padding:16px;cursor:pointer;box-shadow:0 10px 26px rgba(15,23,42,.055);transition:.18s ease;min-height:118px}.rl-action-card:hover{transform:translateY(-3px);box-shadow:0 18px 36px rgba(15,23,42,.1);border-color:#93c5fd}.rl-action-card b{display:block;color:var(--rl-blue);font-size:16px;margin-bottom:6px}.rl-action-card span{display:block;color:var(--rl-muted);font-size:12px;font-weight:800;line-height:1.7}.rl-action-card .ico{width:38px;height:38px;display:grid;place-items:center;border-radius:14px;background:#eff6ff;color:var(--rl-blue);font-size:20px;margin-bottom:10px}
      .rl-tabs{display:flex;gap:8px;flex-wrap:wrap;border-bottom:1px solid var(--rl-line);margin-top:14px}.rl-tab-btn{border:0;background:#f1f5f9;color:#334155;border-radius:13px 13px 0 0;padding:11px 16px;font-weight:900;cursor:pointer;font-family:Tajawal,Arial,sans-serif}.rl-tab-btn.active{background:var(--rl-blue);color:#fff}.rl-tab-panel{display:none;padding-top:15px}.rl-tab-panel.active{display:block}.rl-panel-grid{display:grid;grid-template-columns:1fr;gap:14px}
      #raise-letters-overlay .section-box{border:1px solid var(--rl-line)!important;border-radius:22px!important;padding:16px!important;margin:0!important;background:linear-gradient(180deg,#fff,var(--rl-soft))!important;box-shadow:0 10px 28px rgba(15,23,42,.055)!important;position:relative!important;overflow:hidden!important}#raise-letters-overlay .section-box:before{content:'';position:absolute;right:0;top:0;bottom:0;width:5px;background:linear-gradient(180deg,var(--rl-blue),var(--rl-gold))}#raise-letters-overlay .section-box h3{margin:0 0 14px!important;color:var(--rl-blue)!important;font-size:18px!important;font-weight:900!important;padding-right:8px!important}
      #raise-letters-overlay .settings-grid{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(235px,1fr))!important;gap:12px!important;align-items:end!important}.field{background:#fff!important;border:1px solid #e2e8f0!important;border-radius:15px!important;padding:9px 10px!important;box-shadow:0 4px 12px rgba(15,23,42,.035)!important;min-height:74px!important}.field label{display:block!important;font-size:12px!important;font-weight:900!important;color:#334155!important;margin:0 0 6px!important}.field input,.field select{width:100%!important;padding:9px 10px!important;border:1px solid #cbd5e1!important;border-radius:10px!important;font-family:Tajawal,Arial,sans-serif!important;font-size:13px!important;background:#fff!important;color:#111827!important;outline:none!important}.field input:focus,.field select:focus{border-color:var(--rl-blue2)!important;box-shadow:0 0 0 3px rgba(0,86,179,.13)!important}
      .mini-table{width:100%!important;border-collapse:separate!important;border-spacing:0!important;font-size:12px!important;background:#fff!important;border:1px solid var(--rl-line)!important;border-radius:14px!important;overflow:hidden!important}.mini-table th,.mini-table td{border-bottom:1px solid #e2e8f0!important;border-left:1px solid #e2e8f0!important;padding:7px!important;text-align:center!important;vertical-align:middle!important}.mini-table tr:last-child td{border-bottom:0!important}.mini-table th{background:linear-gradient(135deg,#eff6ff,#dbeafe)!important;color:#0f2f66!important;font-weight:900!important}.mini-table input{width:100%!important;border:1px solid transparent!important;border-radius:8px!important;padding:8px!important;font-family:Tajawal,Arial,sans-serif!important;background:#f8fafc!important}.mini-table input:focus{background:#fff!important;border-color:var(--rl-blue2)!important;outline:none!important}.section-box .btn-row{display:flex!important;gap:10px!important;flex-wrap:wrap!important;margin:6px 0 12px!important;align-items:center!important}.section-box .btn-row b{margin-right:auto!important;background:#ecfdf5!important;color:#166534!important;border:1px solid #bbf7d0!important;padding:9px 12px!important;border-radius:999px!important;font-size:13px!important}
     .rl-note{padding:12px 14px;border-radius:16px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:13px;font-weight:900;margin-top:12px}
      body.raise-letters-standalone-page #raise-letters-overlay.settings-overlay{background:#eef3f9!important;padding:18px!important;align-items:flex-start!important}body.raise-letters-standalone-page #raise-letters-overlay .settings-dialog{max-height:none!important;overflow:visible!important;box-shadow:0 20px 55px rgba(15,23,42,.14)!important}
      @media(max-width:760px){.rl-hero{grid-template-columns:1fr}.rl-hero-actions{justify-content:flex-start}.rl-action-grid{grid-template-columns:1fr}.rl-tab-btn{flex:1}.settings-grid{grid-template-columns:1fr!important}}
      @media print{#raise-letters-overlay{display:none!important}}
    `;
  }

  function ensureSignatureDefaults() {
    const key = SIG_PREFIX + SIGNATURE_KEY;
    const existing = readJson(key, null);
    if (!Array.isArray(existing)) localStorage.setItem(key, JSON.stringify([{ title: 'مدير إدارة الإمداد والصيانة', name: '' }]));
  }
  function openLetterSignatures() {
    ensureSignatureDefaults();
    if (window.SignatureBlock && typeof window.SignatureBlock.open === 'function') return window.SignatureBlock.open(SIGNATURE_KEY);
    alert('نظام التواقيع لم يكتمل تحميله بعد. أعد تحميل الصفحة.');
  }
  function buildSignaturesHTML() {
    ensureSignatureDefaults();
    const prefs = readJson(PREF_PREFIX + SIGNATURE_KEY, {});
    if (prefs.includeSigs === false) return '';
    const sigs = readJson(SIG_PREFIX + SIGNATURE_KEY, []);
    const rows = Array.isArray(sigs) && sigs.length ? sigs : [{ title: 'مدير إدارة الإمداد والصيانة', name: '' }];
    return `<div class="signatures raise-letter-dynamic-signatures" style="display:grid;grid-template-columns:repeat(${Math.min(Math.max(rows.length,1),3)},1fr);gap:20px;margin-top:35px;text-align:center">${rows.map(s => `<div><div class="sig-title">${esc(s.title)}</div><div class="line"></div><div class="sig-name">${esc(s.name || '')}</div></div>`).join('')}</div>`;
  }
  function replacePrintSignatures(win) {
    try {
      if (!win || win.closed || !win.document) return;
      const doc = win.document;
      const page = doc.querySelector && doc.querySelector('.page');
      if (!page) return;
      if (!/(خطاب رفع|تقرير التوطين|إقرار عدم أسبقية الصرف)/.test(doc.title || '')) return;
      page.querySelectorAll('.signatures').forEach(el => el.remove());
      const holder = doc.createElement('div');
      holder.innerHTML = buildSignaturesHTML();
      const footer = page.querySelector('.footer');
      if (holder.firstElementChild) footer ? page.insertBefore(holder.firstElementChild, footer) : page.appendChild(holder.firstElementChild);
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

  function buildKpis() {
  const s = getSettings();

  return `
    <div class="rl-kpi"><span>الشركة</span><strong>${esc(getCompanyName())}</strong></div>
    <div class="rl-kpi"><span>رقم الدفعة</span><strong>${esc(s.paymentNo || 'من المستخلص')}</strong></div>
    <div class="rl-kpi"><span>مدة المستخلص</span><strong>${esc((s.extractStart || 'غير محدد') + ' → ' + (s.extractEnd || 'غير محدد'))}</strong></div>
  `;
}
function focusSignaturesTab() {
  const shell = document.querySelector('#raise-letters-overlay .rl-shell');
  if (!shell) return;

  shell.querySelectorAll('.rl-tab-btn').forEach(b => b.classList.remove('active'));
  shell.querySelectorAll('.rl-tab-panel').forEach(p => p.classList.remove('active'));

  shell.querySelector('[data-tab="signatures"]')?.classList.add('active');
  shell.querySelector('[data-panel="signatures"]')?.classList.add('active');

  shell.querySelector('[data-panel="signatures"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
  function restructureDialog() {
    const overlay = document.getElementById('raise-letters-overlay');
    if (!overlay || overlay.__professionalRebuilt) return;
    const dialog = overlay.querySelector('.settings-dialog');
    if (!dialog) return;

    injectCss();
    const title = dialog.querySelector('h2') || document.createElement('h2');
    const topRow = dialog.querySelector('.btn-row');
    const sections = Array.from(dialog.querySelectorAll('.section-box'));
if (!topRow || sections.length < 2) return;
    const actions = Array.from(topRow.querySelectorAll('button'));
    const saveBtn = actions.find(b => (b.textContent || '').includes('حفظ'));
    const closeBtn = actions.find(b => (b.textContent || '').includes('إغلاق'));
    const laborBtn = actions.find(b => (b.textContent || '').includes('العمالة'));
    const consBtn = actions.find(b => (b.textContent || '').includes('المستهلكات'));
    const declBtn = actions.find(b => (b.textContent || '').includes('إقرار'));
    const siteBtn = actions.find(b => (b.textContent || '').includes('موقع'));

    const shell = document.createElement('div');
    shell.className = 'rl-shell';
    shell.innerHTML = `
      <section class="rl-hero">
        <div><h2>خطابات الرفع — المكاتب الإدارية والمرافق الصحية</h2><p>لوحة مستقلة لإدارة بيانات الخطابات والطباعة من المستخلص المفتوح.</p></div>
        <div class="rl-hero-actions"></div>
      </section>
      <section class="rl-content">
        <div class="rl-kpi-strip">${buildKpis()}</div>
        <div class="rl-action-grid">
          <div class="rl-action-card" data-act="labor"><div class="ico">👷</div><b>خطاب رفع العمالة</b><span>يقرأ صافي الشهادة الإجمالية والتوطين والضريبة.</span></div>
          <div class="rl-action-card" data-act="cons"><div class="ico">📦</div><b>خطاب رفع المستهلكات</b><span>يستخدم صافي المستهلكات والضريبة والتفقيط.</span></div>
          <div class="rl-action-card" data-act="decl"><div class="ico">✅</div><b>إقرار عدم أسبقية الصرف</b><span>إقرار رسمي بالمبلغ والتفقيط.</span></div>
          <div class="rl-action-card" data-act="site"><div class="ico">🏢</div><b>خطاب رفع موقع</b><span>خطاب خاص بمكتب أو موقع محدد.</span></div>
        </div>
        <div class="rl-tabs">
          <button type="button" class="rl-tab-btn active" data-tab="letters">بيانات الخطابات</button>
          <button type="button" class="rl-tab-btn" data-tab="money">المبالغ والفترات</button>
          <button type="button" class="rl-tab-btn" data-tab="signatures">التواقيع والطباعة</button>
        </div>
        <div class="rl-tab-panel active" data-panel="letters"><div class="rl-panel-grid"></div></div>
        <div class="rl-tab-panel" data-panel="money"><div class="rl-panel-grid"></div></div>
        <div class="rl-tab-panel" data-panel="signatures"><div class="rl-panel-grid"></div><div class="rl-note">التواقيع تُدخل من نظام التواقيع مثل باقي البرنامج، ولا تعتمد على أسماء ثابتة داخل القالب.</div></div>
      </section>`;

    dialog.innerHTML = '';
    dialog.appendChild(shell);
    const heroActions = shell.querySelector('.rl-hero-actions');
    if (saveBtn) heroActions.appendChild(saveBtn);
    const sigBtn = document.createElement('button');
sigBtn.type = 'button';
sigBtn.className = 'btn btn-primary';
sigBtn.innerHTML = '<i class="fas fa-signature"></i> تعديل تواقيع الخطابات';
sigBtn.onclick = focusSignaturesTab;    heroActions.appendChild(sigBtn);
    if (closeBtn) heroActions.appendChild(closeBtn);

    const cards = shell.querySelectorAll('.rl-action-card');
    cards.forEach(card => {
      card.onclick = function () {
        const a = card.dataset.act;
        if (a === 'labor' && laborBtn) laborBtn.click();
        if (a === 'cons' && consBtn) consBtn.click();
        if (a === 'decl' && declBtn) declBtn.click();
        if (a === 'site' && siteBtn) siteBtn.click();
      };
    });

    const lettersPanel = shell.querySelector('[data-panel="letters"] .rl-panel-grid');
    const moneyPanel = shell.querySelector('[data-panel="money"] .rl-panel-grid');
    const sigPanel = shell.querySelector('[data-panel="signatures"] .rl-panel-grid');

    sections.forEach((sec, idx) => {
  const text = sec.textContent || '';

  if (text.includes('توطين')) {
    sec.remove();
    return;
  }

  if (text.includes('بيانات المستخلص')) {
    lettersPanel.appendChild(sec);
  } else if (text.includes('التواقيع')) {
    sigPanel.appendChild(sec);
  } else {
    moneyPanel.appendChild(sec);
  }
});

    const extra = document.createElement('div');
    extra.className = 'section-box';
    extra.innerHTML = '<h3>التواقيع</h3><div class="settings-grid"><div class="field"><label>تواقيع الخطابات</label><button type="button" class="btn btn-primary" style="width:100%" id="raise-letter-signatures-inline-btn"><i class="fas fa-signature"></i> تعديل تواقيع الخطابات</button></div><div class="field"><label>تنبيه</label><div style="font-weight:900;color:#475569;line-height:1.8">أي اسم ثابت قديم لا يظهر في الطباعة. التوقيع يأتي من SignatureBlock فقط.</div></div></div>';
    sigPanel.appendChild(extra);
    extra.querySelector('#raise-letter-signatures-inline-btn').onclick = openLetterSignatures;

    shell.querySelectorAll('.rl-tab-btn').forEach(btn => {
      btn.onclick = function () {
        shell.querySelectorAll('.rl-tab-btn').forEach(b => b.classList.remove('active'));
        shell.querySelectorAll('.rl-tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        shell.querySelector(`[data-panel="${btn.dataset.tab}"]`)?.classList.add('active');
      };
    });

    overlay.__professionalRebuilt = true;
  }

  function patchApi() {
    const api = window.AdminOfficesRaiseLetters;
    if (!api || api.__uiSignatureFixPatched) return false;
    if (typeof api.openDialog === 'function') {
      const oldOpen = api.openDialog;
      api.openDialog = function patchedOpenDialog() {
        const result = oldOpen.apply(this, arguments);
        setTimeout(restructureDialog, 40);
        setTimeout(restructureDialog, 250);
        setTimeout(restructureDialog, 800);
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
    restructureDialog();
    if (attempt < 30) setTimeout(() => boot(attempt + 1), 300);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot(0));
  else boot(0);
  console.info('[Admin Offices Raise Letters] rebuilt professional UI installed');
})();
