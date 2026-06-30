// Admin Offices Print Letters Builders Only — V6
// لا يضيف أي اختيارات داخل زر الطباعة. المصدر الوحيد للاختيارات هو admin_offices_print_all_complete_patch.js.
// يثبت بيانات الاتصال في أسفل صفحة الخطاب فقط.
// يصلح التفقيط في خطابات المواقع مع تقريب الهلالات الصغيرة.
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

  function normalizeMoneyForTafqeet(v) {
    let cents = Math.round(num(v) * 100);
    let halalas = ((cents % 100) + 100) % 100;
    // تقريب التفقيط فقط: تجاهل الكسور الصغيرة جداً، وارفع إذا كانت قريبة من الريال التالي.
    if (halalas > 0 && halalas <= 5) cents -= halalas;
    else if (halalas >= 95) cents += (100 - halalas);
    return { riyals: Math.floor(cents / 100), halalas: cents % 100 };
  }

  function underHundred(n) {
    const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
    const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
    const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    const o = n % 10, t = Math.floor(n / 10);
    return o ? ones[o] + ' و' + tens[t] : tens[t];
  }

  function underThousand(n) {
    const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
    const h = Math.floor(n / 100), r = n % 100;
    if (!h) return underHundred(r);
    return r ? hundreds[h] + ' و' + underHundred(r) : hundreds[h];
  }

  function scaleWord(value, one, two, plural, singular) {
    if (!value) return '';
    if (value === 1) return one;
    if (value === 2) return two;
    if (value >= 3 && value <= 10) return underThousand(value) + ' ' + plural;
    return underThousand(value) + ' ' + singular;
  }

  function numberToArabicWords(n) {
    n = Math.floor(Math.abs(Number(n) || 0));
    if (n === 0) return 'صفر';
    const billions = Math.floor(n / 1000000000); n %= 1000000000;
    const millions = Math.floor(n / 1000000); n %= 1000000;
    const thousands = Math.floor(n / 1000); n %= 1000;
    const parts = [];
    if (billions) parts.push(scaleWord(billions, 'مليار', 'ملياران', 'مليارات', 'مليار'));
    if (millions) parts.push(scaleWord(millions, 'مليون', 'مليونان', 'ملايين', 'مليون'));
    if (thousands) parts.push(scaleWord(thousands, 'ألف', 'ألفان', 'آلاف', 'ألف'));
    if (n) parts.push(underThousand(n));
    return parts.join(' و');
  }

  function riyalUnit(n) {
    if (n === 1) return 'ريال سعودي واحد';
    if (n === 2) return 'ريالان سعوديان';
    if (n >= 3 && n <= 10) return 'ريالات سعودية';
    return 'ريال سعودي';
  }

  function halalaUnit(n) {
    if (n === 1) return 'هللة واحدة';
    if (n === 2) return 'هللتان';
    if (n >= 3 && n <= 10) return 'هللات';
    return 'هللة';
  }

  function tafqeet(v) {
    const rounded = normalizeMoneyForTafqeet(v);
    const r = rounded.riyals;
    const h = rounded.halalas;
    let text = '';
    if (r > 0) text = numberToArabicWords(r) + ' ' + riyalUnit(r);
    else text = 'صفر ريال سعودي';
    if (h > 0) text += ' و' + numberToArabicWords(h) + ' ' + halalaUnit(h);
    return 'فقط وقدره ' + text + ' لا غير';
  }

  function headerHtml(s) {
    return `<div class="raise-head"><img src="moh_logo.png"><div><h1>${esc(s.entityTitle)}</h1><h2>${esc(s.departmentTitle)}</h2></div><img src="moh_logo.png"></div>`;
  }
  function footerHtml(s) {
    return `<footer class="raise-contact-footer"><span class="raise-footer-en">${esc(s.phoneFaxEn)}</span><span class="raise-footer-ar" dir="rtl">${esc(s.phoneFaxAr)}</span></footer>`;
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
    return `<div class="page-container raise-letter-page">${headerHtml(s)}<main class="raise-letter-content">${date}<div class="raise-to">${esc(s.recipient)} &nbsp;&nbsp; ${esc(s.recipientSuffix)}</div>${title ? `<div class="raise-title">${esc(title)}</div>` : ''}<div class="raise-body">${body}</div>${amountTable(rows, total)}<div class="raise-body">لذا نأمل بعد الاطلاع إحالته إلى جهة الاختصاص لتدقيقه واستكمال إجراءات صرف مستحقات المقاول / ${esc(getCompanyName())}<br>وتقبلوا تحياتنا ،،،</div>${signaturesHtml()}</main>${footerHtml(s)}</div>`;
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
    return `<style id="raise-letters-print-all-css">
      @page raise-letter-page{size:A4 portrait;margin:12mm}
      .raise-letter-page{page:raise-letter-page!important;direction:rtl;font-family:Tajawal,Arial,sans-serif;color:#111827;background:#fff;height:273mm;min-height:273mm;padding:8mm 10mm 18mm;position:relative;box-sizing:border-box;page-break-after:always;overflow:hidden}
      .raise-letter-content{position:relative;z-index:1;padding-bottom:8mm}
      .raise-head{display:grid;grid-template-columns:78px 1fr 78px;align-items:center;border-bottom:2px solid #003087;padding-bottom:8px;margin-bottom:18px}
      .raise-head img{width:68px}.raise-head div{text-align:center}.raise-head h1{font-size:17px;margin:0 0 4px;color:#003087}.raise-head h2{font-size:15px;margin:0}
      .raise-to{font-size:15px;font-weight:900;margin:18px 0 12px}.raise-body{font-size:15px;line-height:2.05;text-align:justify}.raise-title{text-align:center;font-size:19px;font-weight:900;color:#003087;margin:20px 0}
      .raise-amount-table{width:100%;border-collapse:collapse;margin:16px 0;font-size:14px}.raise-amount-table td{border:1px solid #333;padding:8px}.raise-amount-table td:first-child{text-align:right;font-weight:800;width:72%}.raise-amount-table td:last-child{text-align:center;font-weight:900;direction:ltr}.raise-amount-table .grand td{background:#fff7d6;font-weight:900}.raise-amount-table .tafqeet-row td{background:#f8fafc!important;text-align:center!important;direction:rtl!important;font-weight:900!important;line-height:1.8!important;font-size:14px!important}
      .raise-signatures{display:grid;gap:20px;margin-top:28px;text-align:center;break-inside:avoid;page-break-inside:avoid}.raise-signatures .sig-title{font-weight:900}.raise-signatures .sig-name{font-weight:800;margin-top:8px}.raise-signatures .line{height:34px;border-bottom:1px solid #111;margin:7px 30px}
      .raise-contact-footer{position:absolute!important;bottom:5mm!important;left:10mm!important;right:10mm!important;height:7mm!important;border-top:1px solid #cbd5e1;padding-top:3px;font-size:10.5px;line-height:1.4;display:flex;justify-content:space-between;align-items:center;direction:ltr;background:#fff;color:#475569;z-index:2;box-sizing:border-box}
      .raise-footer-ar{text-align:right}.raise-footer-en{text-align:left}
      @media print{.raise-contact-footer{position:absolute!important;bottom:5mm!important}.raise-letter-page{overflow:hidden!important}}
    </style>`;
  }

  window.AdminOfficePrintLetters = {
    lettersCss,
    buildSiteRaiseLetterForSite,
    tafqeetSAR: tafqeet,
    buildSelectedLetters: function(){ return ''; },
    hasSelection: function(){ return false; },
    hasAnyPrintSelection: function(){ return false; },
    openLettersOnly: function(){ return false; }
  };

  console.info('[Admin Offices Print All Letters] builder only v6 tafqeet fixed');
})();