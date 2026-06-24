// ===================================================================
// Admin Offices Raise Letters Tafqeet Rows
// Scope: admin_offices_attendance.html only
// Forces tafqeet row directly under total rows in printed raise letters.
// Prevents older print-all patch from appending duplicate raise letters.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_RAISE_LETTERS_TAFQEET_ROWS__) return;
  window.__ADMIN_OFFICES_RAISE_LETTERS_TAFQEET_ROWS__ = true;

  const SETTINGS_KEY = 'adminOfficesRaiseLettersSettings_v1';
  const SIG_PREFIX = 'sb_sigs_';
  const RAISE_SIG_KEY = 'admin_offices_raise_letters_signatures';

  function readJson(key, fallback) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; } }
  function esc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function num(v) { const n = Number(String(v ?? '').replace(/,/g, '').replace(/[ ريال﷼()]/g, '').trim()); return Number.isFinite(n) ? n : 0; }
  function money(v) { return num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function moneyPlain(v) { const n = num(v); return Number.isInteger(n) ? String(n) : money(n); }
  function fmtDate(v) { if (!v) return 'غير محدد'; try { const d = new Date(v); return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-CA'); } catch (_) { return 'غير محدد'; } }

  function getContract() { return readJson('persistentContractData', {}); }
  function getExtract() { return readJson('persistentExtractData', {}); }
  function getSession() { return readJson('najran_session', {}); }

  function getMeta() {
    try { if (window.AdminOfficesRaiseLettersPeriodFix) return window.AdminOfficesRaiseLettersPeriodFix.getMeta(); } catch (_) {}
    const e = getExtract();
    const paymentNo = e.paymentNumber || e.extractNumber || localStorage.getItem('paymentNumber') || localStorage.getItem('extractNumber') || '—';
    return {
      paymentNo: /^\d+$/.test(String(paymentNo)) ? String(paymentNo).padStart(2, '0') : String(paymentNo),
      start: e.extractStart || localStorage.getItem('extractStart') || '',
      end: e.extractEnd || localStorage.getItem('extractEnd') || ''
    };
  }
  function extractPhrase() {
    const m = getMeta();
    return `دفعة رقم (${esc(m.paymentNo)}) عن الفترة من ${esc(fmtDate(m.start))} م إلى ${esc(fmtDate(m.end))} م`;
  }
  function settings() {
    const e = getExtract();
    return Object.assign({
      recipient: 'سعادة / مساعد المدير العام للدعم المساند',
      recipientSuffix: 'المحترم',
      entityTitle: 'المديرية العامة للشئون الصحية بمنطقة نجران',
      departmentTitle: 'إدارة الشئون الهندسية',
      scopeName: 'المكاتب الإدارية والمرافق الصحية وصيانة وإصلاح السيارات بمنطقة نجران',
      paymentNo: e.paymentNumber || e.extractNumber || localStorage.getItem('paymentNumber') || localStorage.getItem('extractNumber') || '01',
      vatRate: 15,
      phoneFaxAr: 'نجران – تليفون 0175225872    فاكس 017523312',
      phoneFaxEn: 'Najran – Tel.: 0175225872       Fax: 017523312',
      declarationDate: new Date().toLocaleDateString('en-CA')
    }, readJson(SETTINGS_KEY, {}));
  }
  function getCompanyName() {
    const c = getContract();
    const s = getSession();
    const dom = document.querySelector('.companyName')?.textContent;
    return c.companyName || c.contractorName || c.company || c.contractor || s.companyName || (dom && dom !== 'غير محدد' ? dom : '') || 'غير محدد';
  }
  function tafqeet(amount) {
    if (window.AdminOfficesRaiseLetters && typeof window.AdminOfficesRaiseLetters.tafqeetSAR === 'function') return window.AdminOfficesRaiseLetters.tafqeetSAR(amount);
    return `فقط وقدره ${money(amount)} ريال سعودي لا غير`;
  }
  function laborNet() {
    const dom = document.getElementById('grand-net-total')?.textContent || document.getElementById('grand-net-total-admin')?.textContent;
    return num(localStorage.getItem('grand-net-total-admin') || dom || 0);
  }
  function consumablesNet() {
    const s = settings();
    return num(localStorage.getItem('admin_offices_consumables_current_net')) || num(localStorage.getItem('adminOfficesConsumablesNet')) || num(localStorage.getItem('finalConsumablesCost')) || num(s.consumablesNet) || 0;
  }
  function headerHtml(s) { return `<div class="raise-head"><img src="moh_logo.png"><div><h1>${esc(s.entityTitle)}</h1><h2>${esc(s.departmentTitle)}</h2></div><img src="moh_logo.png"></div>`; }
  function footerHtml(s) { return `<div class="raise-footer"><span>${esc(s.phoneFaxEn)}</span><span dir="rtl">${esc(s.phoneFaxAr)}</span></div>`; }
  function signaturesHtml() {
    const sigs = readJson(SIG_PREFIX + RAISE_SIG_KEY, [{ title: 'مدير إدارة الإمداد والصيانة', name: '' }]);
    const rows = Array.isArray(sigs) && sigs.length ? sigs : [{ title: 'مدير إدارة الإمداد والصيانة', name: '' }];
    return `<div class="raise-signatures" style="grid-template-columns:repeat(${Math.min(Math.max(rows.length, 1), 3)},1fr)">${rows.map(sig => `<div><div class="sig-title">${esc(sig.title || '')}</div><div class="line"></div><div class="sig-name">${esc(sig.name || '')}</div></div>`).join('')}</div>`;
  }
  function amountTable(rows, total) {
    return `<table class="raise-amount-table"><tbody>${rows.map(r => `<tr class="${r.cls || ''}"><td>${r.label}</td><td>${r.value}</td></tr>`).join('')}<tr class="tafqeet-row"><td colspan="2">${esc(tafqeet(total))}</td></tr></tbody></table>`;
  }
  function laborLetterPage() {
    const s = settings(), company = getCompanyName();
    const net = laborNet(), vat = net * num(s.vatRate) / 100, grand = net + vat;
    return `<div class="page-container raise-letter-page">${headerHtml(s)}<div class="raise-to">${esc(s.recipient)} &nbsp;&nbsp; ${esc(s.recipientSuffix)}</div><div class="raise-body">السلام عليكم ورحمة الله وبركاته، وبعد:<br>نرفق لسعادتكم المستخلص الشهري لشركة ${esc(company)} والخاص ببند العمالة لمواقع ${esc(s.scopeName)}، ${extractPhrase()}.</div>${amountTable([{label:'صافي مستحقات العمالة عن فترة المستخلص',value:moneyPlain(net)},{label:`ضريبة القيمة المضافة ${moneyPlain(s.vatRate)}%`,value:money(vat)},{label:'الإجمالي',value:money(grand),cls:'grand'}], grand)}<div class="raise-body">لذا نأمل بعد الاطلاع إحالته إلى جهة الاختصاص لتدقيقه واستكمال إجراءات صرف مستحقات المقاول / ${esc(company)}<br>وتقبلوا تحياتنا ،،،</div>${signaturesHtml()}${footerHtml(s)}</div>`;
  }
  function consumablesLetterPage() {
    const s = settings(), company = getCompanyName();
    const net = consumablesNet(), vat = net * num(s.vatRate) / 100, grand = net + vat;
    return `<div class="page-container raise-letter-page">${headerHtml(s)}<div class="raise-to">${esc(s.recipient)} &nbsp;&nbsp; ${esc(s.recipientSuffix)}</div><div class="raise-body">السلام عليكم ورحمة الله وبركاته، وبعد:<br>نرفق لسعادتكم المستخلص الشهري لشركة ${esc(company)} والخاص ببند المستهلكات ومقاولي الباطن لمواقع ${esc(s.scopeName)}، ${extractPhrase()}.</div>${amountTable([{label:'صافي مستحقات المستهلكات ومقاولي الباطن عن فترة المستخلص',value:moneyPlain(net)},{label:`ضريبة القيمة المضافة ${moneyPlain(s.vatRate)}%`,value:money(vat)},{label:'الإجمالي',value:money(grand),cls:'grand'}], grand)}<div class="raise-body">لذا نأمل بعد الاطلاع إحالته إلى جهة الاختصاص لتدقيقه واستكمال إجراءات صرف مستحقات المقاول / ${esc(company)}<br>وتقبلوا تحياتنا ،،،</div>${signaturesHtml()}${footerHtml(s)}</div>`;
  }
  function declarationPage() {
    const s = settings(), company = getCompanyName();
    const amount = laborNet();
    return `<div class="page-container raise-letter-page">${headerHtml(s)}<div style="text-align:left;font-size:14px;font-weight:800">التاريخ : ${esc(fmtDate(s.declarationDate))} م</div><div class="raise-title">إقرار بعدم أسبقية الصرف</div><div class="raise-body">تقر إدارة الصيانة بالشئون الهندسية بصحة نجران بأن مستخلص العمالة لشركة ${esc(company)}، لمواقع ${esc(s.scopeName)}، ${extractPhrase()}، بمبلغ وقدره (${money(amount)}) ${esc(tafqeet(amount))}.<br>ولم يسبق صرفه من قبلنا.</div>${signaturesHtml()}${footerHtml(s)}</div>`;
  }
  function lettersCss() {
    return `<style id="raise-letters-tafqeet-rows-css">@page raise-letter-page{size:A4 portrait;margin:12mm}.raise-letter-page{page:raise-letter-page!important;direction:rtl;font-family:Tajawal,Arial,sans-serif;color:#111827;background:#fff;min-height:270mm;padding:8mm 10mm;position:relative;page-break-after:always}.raise-head{display:grid;grid-template-columns:78px 1fr 78px;align-items:center;border-bottom:2px solid #003087;padding-bottom:8px;margin-bottom:18px}.raise-head img{width:68px}.raise-head div{text-align:center}.raise-head h1{font-size:17px;margin:0 0 4px;color:#003087}.raise-head h2{font-size:15px;margin:0}.raise-to{font-size:15px;font-weight:900;margin:18px 0 12px}.raise-body{font-size:15px;line-height:2.05;text-align:justify}.raise-title{text-align:center;font-size:19px;font-weight:900;color:#003087;margin:20px 0}.raise-amount-table{width:100%;border-collapse:collapse;margin:16px 0;font-size:14px}.raise-amount-table td{border:1px solid #333;padding:8px}.raise-amount-table td:first-child{text-align:right;font-weight:800;width:72%}.raise-amount-table td:last-child{text-align:center;font-weight:900;direction:ltr}.raise-amount-table .grand td{background:#fff7d6;font-weight:900}.raise-amount-table .tafqeet-row td{background:#f8fafc!important;text-align:center!important;direction:rtl!important;font-weight:900!important;line-height:1.8!important;font-size:14px!important}.raise-signatures{display:grid;gap:20px;margin-top:35px;text-align:center}.raise-signatures .sig-title{font-weight:900}.raise-signatures .sig-name{font-weight:800;margin-top:10px}.raise-signatures .line{height:42px;border-bottom:1px solid #111;margin:8px 30px}.raise-footer{position:absolute;bottom:4mm;left:10mm;right:10mm;border-top:1px solid #cbd5e1;padding-top:5px;font-size:11px;display:flex;justify-content:space-between;direction:ltr}</style>`;
  }
  function selectedLetters() {
    const pages = [];
    if (document.getElementById('print-opt-raise-labor')?.checked) pages.push(laborLetterPage());
    if (document.getElementById('print-opt-raise-consumables')?.checked) pages.push(consumablesLetterPage());
    if (document.getElementById('print-opt-raise-declaration')?.checked) pages.push(declarationPage());
    return pages.join('');
  }
  function suppressOldLettersWhile(fn) {
    const ids = ['print-opt-raise-labor', 'print-opt-raise-consumables', 'print-opt-raise-declaration'];
    const states = ids.map(id => ({ id, el: document.getElementById(id), checked: !!document.getElementById(id)?.checked }));
    states.forEach(s => { if (s.el) s.el.checked = false; });
    try { return fn(); } finally { states.forEach(s => { if (s.el) s.el.checked = s.checked; }); }
  }
  function patchPrintSelected() {
    if (typeof window.printSelected !== 'function' || window.printSelected.__adminOfficesTafqeetRowsV1) return false;
    const old = window.printSelected;
    window.printSelected = function printSelectedWithTafqeetRows() {
      const html = selectedLetters();
      let win = null;
      const realOpen = window.open;
      window.open = function () { win = realOpen.apply(window, arguments); return win; };
      let result;
      try { result = suppressOldLettersWhile(() => old.apply(this, arguments)); }
      finally { window.open = realOpen; }
      if (win && win.document && html) {
        setTimeout(() => {
          try {
            const oldOnload = win.onload;
            win.onload = function () {
              try {
                if (!win.document.getElementById('raise-letters-tafqeet-rows-css')) win.document.head.insertAdjacentHTML('beforeend', lettersCss());
                win.document.body.insertAdjacentHTML('beforeend', html);
              } catch (e) { console.error('[RaiseLettersTafqeetRows] append failed', e); }
              if (typeof oldOnload === 'function') return oldOnload.call(win);
              win.focus(); win.print(); win.close();
            };
          } catch (e) { console.error('[RaiseLettersTafqeetRows] onload patch failed', e); }
        }, 0);
      }
      return result;
    };
    window.printSelected.__adminOfficesTafqeetRowsV1 = true;
    console.info('[Admin Offices Raise Letters Tafqeet Rows] printSelected patched');
    return true;
  }
  function boot(attempt) {
    patchPrintSelected();
    if (attempt < 60 && !window.printSelected?.__adminOfficesTafqeetRowsV1) setTimeout(() => boot(attempt + 1), 250);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot(0)); else boot(0);
  setTimeout(() => boot(0), 1200);
  setTimeout(() => boot(0), 3000);
  document.addEventListener('click', () => { setTimeout(() => boot(0), 80); setTimeout(() => boot(0), 350); }, true);
  console.info('[Admin Offices Raise Letters Tafqeet Rows] installed v1');
})();
