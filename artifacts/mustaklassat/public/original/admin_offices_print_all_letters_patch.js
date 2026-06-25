// Admin Offices Print Letters Builders Only — V4
// لا يضيف أي اختيارات داخل زر الطباعة. المصدر الوحيد للاختيارات هو admin_offices_print_all_complete_patch.js.
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;

  const SETTINGS_KEY = 'adminOfficesRaiseLettersSettings_v1';
  const SIG_KEY = 'sb_sigs_admin_offices_raise_letters_signatures';
  const VAT_DEFAULT = 15;

  function readJson(key, fallback) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; } }
  function esc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function num(v) { const n = Number(String(v ?? '').replace(/,/g, '').replace(/[()]/g, '').replace(/[ ريال﷼]/g, '')); return isNaN(n) ? 0 : n; }
  function money(v) { return num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function moneyPlain(v) { const n = num(v); return Number.isInteger(n) ? String(n) : money(n); }
  function fmtDate(v) { if (!v) return 'غير محدد'; try { return new Date(v).toLocaleDateString('en-CA'); } catch (_) { return 'غير محدد'; } }

  function getContract() { return readJson('persistentContractData', {}); }
  function getExtract() { return readJson('persistentExtractData', {}); }
  function getSession() { return readJson('najran_session', {}); }
  function getCompanyName() {
    const c = getContract();
    const s = getSession();
    const dom = document.querySelector('.companyName')?.textContent;
    return c.companyName || s.companyName || (dom && dom !== 'غير محدد' ? dom : '') || 'غير محدد';
  }
  function getActiveExtractMeta() {
    const e = getExtract();
    const paymentNo = e.paymentNumber || e.extractNumber || localStorage.getItem('paymentNumber') || localStorage.getItem('extractNumber') || '—';
    const start = e.extractStart || localStorage.getItem('extractStart') || '';
    const end = e.extractEnd || localStorage.getItem('extractEnd') || '';
    return { paymentNo: String(paymentNo).match(/^\d+$/) ? String(paymentNo).padStart(2, '0') : String(paymentNo), start, end };
  }
  function extractPhrase() {
    const m = getActiveExtractMeta();
    return `دفعة رقم (${esc(m.paymentNo)}) عن الفترة من ${esc(fmtDate(m.start))} م إلى ${esc(fmtDate(m.end))} م`;
  }
  function defaultSettings() {
    const e = getExtract();
    return {
      recipient: 'سعادة / مساعد المدير العام للدعم المساند',
      recipientSuffix: 'المحترم',
      entityTitle: 'المديرية العامة للشئون الصحية بمنطقة نجران',
      departmentTitle: 'إدارة الشئون الهندسية',
      scopeName: 'المكاتب الإدارية والمرافق الصحية وصيانة وإصلاح السيارات بمنطقة نجران',
      paymentNo: e.paymentNumber || e.extractNumber || localStorage.getItem('paymentNumber') || localStorage.getItem('extractNumber') || '01',
      vatRate: VAT_DEFAULT,
      phoneFaxAr: 'نجران – تليفون 0175225872    فاكس 017523312',
      phoneFaxEn: 'Najran – Tel.: 0175225872       Fax: 017523312',
      declarationDate: new Date().toLocaleDateString('en-CA')
    };
  }
  function getSettings() {
    const s = Object.assign(defaultSettings(), readJson(SETTINGS_KEY, {}));
    const meta = getActiveExtractMeta();
    s.paymentNo = meta.paymentNo;
    if (/شراء\s*مباشر/.test(String(s.purchasePeriodLabel || ''))) s.purchasePeriodLabel = '';
    return s;
  }
  function tafqeet(v) {
    if (window.AdminOfficesRaiseLetters && typeof window.AdminOfficesRaiseLetters.tafqeetSAR === 'function') return window.AdminOfficesRaiseLetters.tafqeetSAR(v);
    return `فقط وقدره ${money(v)} ريال سعودي لا غير`;
  }
  function headerHtml(s) {
    return `<div class="raise-head"><img src="moh_logo.png"><div><h1>${esc(s.entityTitle)}</h1><h2>${esc(s.departmentTitle)}</h2></div><img src="moh_logo.png"></div>`;
  }
  function footerHtml(s) {
    return `<div class="raise-footer"><span>${esc(s.phoneFaxEn)}</span><span dir="rtl">${esc(s.phoneFaxAr)}</span></div>`;
  }
  function signaturesHtml() {
    const rows = readJson(SIG_KEY, [{ title: 'مدير إدارة الإمداد والصيانة', name: '' }]);
    const sigs = Array.isArray(rows) && rows.length ? rows : [{ title: 'مدير إدارة الإمداد والصيانة', name: '' }];
    return `<div class="raise-signatures" style="grid-template-columns:repeat(${Math.min(Math.max(sigs.length, 1), 3)},1fr)">${sigs.map(sig => `<div><div class="sig-title">${esc(sig.title)}</div><div class="line"></div><div class="sig-name">${esc(sig.name || '')}</div></div>`).join('')}</div>`;
  }
  function amountTable(rows, tafqeetAmount) {
    return `<table class="raise-amount-table"><tbody>${rows.map(r => `<tr class="${r.cls || ''}"><td>${r.label}</td><td>${r.value}</td></tr>`).join('')}<tr class="tafqeet-row"><td colspan="2">${esc(tafqeet(tafqeetAmount))}</td></tr></tbody></table>`;
  }
  function letterPage(title, body, rows, total, declarationDate) {
    const s = getSettings();
    const date = declarationDate ? `<div style="text-align:left;font-size:14px;font-weight:800">التاريخ : ${esc(fmtDate(s.declarationDate))} م</div>` : '';
    return `<div class="page-container raise-letter-page">${headerHtml(s)}${date}<div class="raise-to">${esc(s.recipient)} &nbsp;&nbsp; ${esc(s.recipientSuffix)}</div>${title ? `<div class="raise-title">${esc(title)}</div>` : ''}<div class="raise-body">${body}</div>${amountTable(rows, total)}<div class="raise-body">لذا نأمل بعد الاطلاع إحالته إلى جهة الاختصاص لتدقيقه واستكمال إجراءات صرف مستحقات المقاول / ${esc(getCompanyName())}<br>وتقبلوا تحياتنا ،،،</div>${signaturesHtml()}${footerHtml(s)}</div>`;
  }

  function buildSiteRaiseLetterForSite(arg) {
    const s = getSettings();
    const company = getCompanyName();
    const siteName = typeof arg === 'string' ? arg : (arg && (arg.siteName || arg.name)) || s.scopeName;
    const net = num(arg && (arg.netAmount ?? arg.net ?? arg.amount));
    const vat = net * num(s.vatRate) / 100;
    const total = net + vat;
    const body = `السلام عليكم ورحمة الله وبركاته، وبعد:<br>نرفق لسعادتكم المستخلص الشهري لشركة ${esc(company)} والخاص بموقع ${esc(siteName)}، ${extractPhrase()}.`;
    return letterPage('', body, [
      { label: 'صافي مستحقات الموقع عن فترة المستخلص', value: moneyPlain(net) },
      { label: `ضريبة القيمة المضافة ${moneyPlain(s.vatRate)}%`, value: money(vat) },
      { label: 'الإجمالي', value: money(total), cls: 'grand' }
    ], total, false);
  }

  function lettersCss() {
    return `<style id="raise-letters-print-all-css">@page raise-letter-page{size:A4 portrait;margin:12mm}.raise-letter-page{page:raise-letter-page!important;direction:rtl;font-family:Tajawal,Arial,sans-serif;color:#111827;background:#fff;min-height:270mm;padding:8mm 10mm;position:relative;page-break-after:always}.raise-head{display:grid;grid-template-columns:78px 1fr 78px;align-items:center;border-bottom:2px solid #003087;padding-bottom:8px;margin-bottom:18px}.raise-head img{width:68px}.raise-head div{text-align:center}.raise-head h1{font-size:17px;margin:0 0 4px;color:#003087}.raise-head h2{font-size:15px;margin:0}.raise-to{font-size:15px;font-weight:900;margin:18px 0 12px}.raise-body{font-size:15px;line-height:2.05;text-align:justify}.raise-title{text-align:center;font-size:19px;font-weight:900;color:#003087;margin:20px 0}.raise-amount-table{width:100%;border-collapse:collapse;margin:16px 0;font-size:14px}.raise-amount-table td{border:1px solid #333;padding:8px}.raise-amount-table td:first-child{text-align:right;font-weight:800;width:72%}.raise-amount-table td:last-child{text-align:center;font-weight:900;direction:ltr}.raise-amount-table .grand td{background:#fff7d6;font-weight:900}.raise-amount-table .tafqeet-row td{background:#f8fafc!important;text-align:center!important;direction:rtl!important;font-weight:900!important;line-height:1.8!important;font-size:14px!important}.raise-signatures{display:grid;gap:20px;margin-top:35px;text-align:center}.raise-signatures .sig-title{font-weight:900}.raise-signatures .sig-name{font-weight:800;margin-top:10px}.raise-signatures .line{height:42px;border-bottom:1px solid #111;margin:8px 30px}.raise-footer{position:absolute;bottom:4mm;left:10mm;right:10mm;border-top:1px solid #cbd5e1;padding-top:5px;font-size:11px;display:flex;justify-content:space-between;direction:ltr}</style>`;
  }

  window.AdminOfficePrintLetters = {
    lettersCss,
    buildSiteRaiseLetterForSite,
    buildSelectedLetters: function(){ return ''; },
    hasSelection: function(){ return false; },
    hasAnyPrintSelection: function(){ return false; },
    openLettersOnly: function(){ return false; }
  };

  console.info('[Admin Offices Print All Letters] builder only v4 no legacy UI');
})();