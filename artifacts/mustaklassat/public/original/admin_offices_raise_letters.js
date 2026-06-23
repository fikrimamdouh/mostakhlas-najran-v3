// ===================================================================
// Admin Offices Raise Letters
// Scope: admin_offices_attendance.html only
// خطابات الرفع + التوطين + الإقرار للمكاتب الإدارية والمرافق الصحية
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;

  const SETTINGS_KEY = 'adminOfficesRaiseLettersSettings_v1';
  const SAUDIZATION_KEY = 'adminOfficesSaudization_v1';
  const VAT_DEFAULT = 15;
  const ABSENCE_FINES = {
    1: { saudi: 500, non_saudi: 500 },
    2: { saudi: 500, non_saudi: 500 },
    3: { saudi: 250, non_saudi: 100 },
    4: { saudi: 180, non_saudi: 80 },
    5: { saudi: 150, non_saudi: 80 },
    6: { saudi: 20, non_saudi: 20 },
    7: { saudi: 10, non_saudi: 10 },
    default: { saudi: 0, non_saudi: 0 }
  };

  function readJson(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }
  function writeJson(key, value) { localStorage.setItem(key, JSON.stringify(value || {})); }
  function esc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function num(v) { const n = Number(String(v ?? '').replace(/,/g, '')); return isNaN(n) ? 0 : n; }
  function money(v) { return num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function moneyPlain(v) { const n = num(v); return Number.isInteger(n) ? String(n) : money(n); }
  function fmtDate(v) { if (!v) return 'غير محدد'; try { return new Date(v).toLocaleDateString('en-CA'); } catch (_) { return 'غير محدد'; } }
  function today() { return new Date().toLocaleDateString('en-CA'); }
  function monthNameAr(dateLike) {
    try { return new Date(dateLike || Date.now()).toLocaleDateString('ar-SA', { month: 'long' }); } catch (_) { return 'الشهر'; }
  }

  function getContract() { return readJson('persistentContractData', {}); }
  function getExtract() { return readJson('persistentExtractData', {}); }
  function getSession() { return readJson('najran_session', {}); }
  function getCompanyName() {
    const c = getContract();
    const s = getSession();
    const dom = document.querySelector('.companyName')?.textContent;
    return c.companyName || s.companyName || (dom && dom !== 'غير محدد' ? dom : '') || 'غير محدد';
  }
  function getNames() { try { if (typeof getCenterNames === 'function') return getCenterNames() || {}; } catch (_) {} return readJson('adminOfficeNames_v1', {}); }
  function getAttendance() { try { if (typeof getAttendanceData === 'function') return getAttendanceData() || {}; } catch (_) {} return readJson('adminOfficesAttendanceData_v1', {}); }
  function getPeriod() {
    try { if (typeof getExtractPeriodDetails === 'function') return getExtractPeriodDetails(); } catch (_) {}
    const e = getExtract();
    const start = new Date(e.extractStart || new Date());
    const end = new Date(e.extractEnd || e.extractStart || new Date());
    return {
      startDate: start,
      endDate: end,
      daysInExtract: Math.max(1, Math.ceil((end - start) / 86400000) + 1 || 30),
      totalDaysInMonth: new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate() || 30
    };
  }
  function isSaudi(n) { return String(n || '').replace(/\s+/g, '').includes('سعودي'); }
  function fineConfig(cat) { return ABSENCE_FINES[cat] || ABSENCE_FINES[String(cat)] || ABSENCE_FINES.default; }
  function performanceDeductions() {
    return Object.assign({}, readJson('performanceDeductions', {}), readJson('adminOfficePerformanceDeductions_v1', {}));
  }

  function defaultSettings() {
    const e = getExtract();
    const end = e.extractEnd || today();
    return {
      recipient: 'سعادة / مساعد المدير العام للدعم المساند',
      recipientSuffix: 'المحترم',
      entityTitle: 'المديرية العامة للشئون الصحية بمنطقة نجران',
      departmentTitle: 'إدارة الشئون الهندسية',
      scopeName: 'المكاتب الإدارية والمرافق الصحية وصيانة وإصلاح السيارات بمنطقة نجران',
      purchasePeriodLabel: '',
      paymentNo: '01',
      vatRate: VAT_DEFAULT,
      phoneFaxAr: 'نجران – تليفون 0175225872    فاكس 017523312',
      phoneFaxEn: 'Najran – Tel.: 0175225872       Fax: 017523312',
      managerTitle: 'مدير إدارة الإمداد والصيانة',
      managerName: 'م / عبدالله حسين ال منصور',
      unitManagerTitle: 'مدير وحدة الشئون الهندسية والصيانة',
      unitManagerName: 'م / فواز سالم ال جحيف',
      period1Start: '',
      period1End: '',
      period1LaborNet: 0,
      period2Start: e.extractStart || '',
      period2End: e.extractEnd || '',
      consumablesPeriod1Net: 0,
      consumablesPeriod2Net: 0,
      declarationDate: today(),
      declarationAmountMode: 'laborGrandTotal',
      declarationManualAmount: 0,
      siteLetterDefaultCenter: '',
      projectName: 'الصيانة والنظافة والتشغيل غير الطبي للمكاتب الإدارية والمرافق الصحية وصيانة وإصلاح السيارات',
      projectValue: '',
      governmentEntity: 'المديرية العامة للشئون الصحية',
      projectDuration: '',
      projectStart: '',
      projectEnd: '',
      saudizationOpportunities: ''
    };
  }
function getSettings() {
  const settings = Object.assign(defaultSettings(), readJson(SETTINGS_KEY, {}));

  const e = getExtract();
  const paymentNo =
    e.paymentNumber
    || e.extractNumber
    || localStorage.getItem('paymentNumber')
    || localStorage.getItem('extractNumber')
    || '—';

  settings.paymentNo = String(paymentNo).match(/^\d+$/)
    ? String(paymentNo).padStart(2, '0')
    : String(paymentNo);

  if (/شراء\s*مباشر/.test(String(settings.purchasePeriodLabel || ''))) {
    settings.purchasePeriodLabel = '';
  }

  return settings;
}  function saveSettings(s) { writeJson(SETTINGS_KEY, Object.assign(getSettings(), s || {})); }
function getActiveExtractMeta() {
  const e = getExtract();

  const paymentNo =
    e.paymentNumber
    || e.extractNumber
    || localStorage.getItem('paymentNumber')
    || localStorage.getItem('extractNumber')
    || '—';

  const start =
    e.extractStart
    || localStorage.getItem('extractStart')
    || '';

  const end =
    e.extractEnd
    || localStorage.getItem('extractEnd')
    || '';

  return {
    paymentNo: String(paymentNo).match(/^\d+$/)
      ? String(paymentNo).padStart(2, '0')
      : String(paymentNo),
    start,
    end
  };
}

function extractPhrase() {
  const m = getActiveExtractMeta();
  return `دفعة رقم (${esc(m.paymentNo)}) عن الفترة من ${esc(fmtDate(m.start))} م إلى ${esc(fmtDate(m.end))} م`;
}
  function defaultSaudization() {
    const s = getSettings();
    return {
      period1: { start: s.period1Start || '', end: s.period1End || '', rows: [] },
      period2: { start: s.period2Start || '', end: s.period2End || '', rows: [] }
    };
  }
  function getSaudization() { return Object.assign(defaultSaudization(), readJson(SAUDIZATION_KEY, {})); }
  function saveSaudization(data) { writeJson(SAUDIZATION_KEY, data || defaultSaudization()); }
  function saudizationTotal(periodKey) {
    const data = getSaudization();
    return ((data[periodKey] && data[periodKey].rows) || []).reduce((sum, r) => sum + num(r.compensation), 0);
  }

  function calcSite(centerKey) {
    const rows = getAttendance()[centerKey] || [];
    const p = getPeriod();
    const c = getContract();
    const ratio = num(c.directPurchaseRatio);
    const out = { count: rows.length, cost: 0, absenceDeduction: 0, absenceFine: 0, nationalityFine: 0, fines: 0, netBeforePerformance: 0, performanceDeduction: 0, finalNet: 0 };
    rows.forEach(emp => {
      const salary = num(emp.salary);
      const daily = p.totalDaysInMonth > 0 ? salary / p.totalDaysInMonth : 0;
      const days = Array.isArray(emp.days) ? emp.days.slice(0, p.daysInExtract) : [];
      while (days.length < p.daysInExtract) days.push('ح');
      let cost = daily * p.daysInExtract;
      if (c.contractType === 'شراء مباشر' && ratio > 0) cost += cost * ratio / 100;
      const absenceDays = days.filter(d => d === 'غ').length;
      const absenceDeduction = absenceDays * daily;
      const cfg = fineConfig(emp.category || 1);
      const absenceFine = absenceDays * (isSaudi(emp.nationality) ? cfg.saudi : cfg.non_saudi);
      const natFine = num(emp.nationalityFine);
      const net = cost - absenceDeduction - absenceFine - natFine;
      out.cost += cost;
      out.absenceDeduction += absenceDeduction;
      out.absenceFine += absenceFine;
      out.nationalityFine += natFine;
      out.fines += absenceFine + natFine;
      out.netBeforePerformance += net;
    });
    out.performanceDeduction = num(performanceDeductions()[centerKey]);
    out.finalNet = out.netBeforePerformance - out.performanceDeduction;
    return out;
  }
  function calcGrandLabor() {
    const names = getNames();
    const data = getAttendance();
    const keys = Array.from(new Set([...Object.keys(names || {}), ...Object.keys(data || {})]))
      .filter(k => k === 'admin_staff' || /^center_\d+$/.test(k) || Array.isArray(data[k]));
    return keys.reduce((total, key) => {
      const c = calcSite(key);
      Object.keys(c).forEach(k => total[k] = num(total[k]) + num(c[k]));
      return total;
    }, { count: 0, cost: 0, absenceDeduction: 0, absenceFine: 0, nationalityFine: 0, fines: 0, netBeforePerformance: 0, performanceDeduction: 0, finalNet: 0 });
  }

  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
  const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
  function underThousand(n) {
    n = Math.floor(n);
    const parts = [];
    const h = Math.floor(n / 100), r = n % 100;
    if (h) parts.push(hundreds[h]);
    if (r) {
      if (r < 10) parts.push(ones[r]);
      else if (r < 20) parts.push(teens[r - 10]);
      else {
        const o = r % 10, t = Math.floor(r / 10);
        parts.push(o ? `${ones[o]} و${tens[t]}` : tens[t]);
      }
    }
    return parts.join(' و');
  }
  function scaleName(value, singular, dual, plural) {
    if (value === 1) return singular;
    if (value === 2) return dual;
    if (value >= 3 && value <= 10) return plural;
    return singular;
  }
  function intToArabicWords(n) {
    n = Math.floor(num(n));
    if (n === 0) return 'صفر';
    const scales = [
      { value: 1000000000, singular: 'مليار', dual: 'ملياران', plural: 'مليارات' },
      { value: 1000000, singular: 'مليون', dual: 'مليونان', plural: 'ملايين' },
      { value: 1000, singular: 'ألف', dual: 'ألفان', plural: 'آلاف' }
    ];
    const parts = [];
    for (const s of scales) {
      const v = Math.floor(n / s.value);
      if (v) {
        if (v === 1) parts.push(s.singular);
        else if (v === 2) parts.push(s.dual);
        else parts.push(`${underThousand(v)} ${scaleName(v, s.singular, s.dual, s.plural)}`);
        n %= s.value;
      }
    }
    if (n) parts.push(underThousand(n));
    return parts.join(' و');
  }
  function tafqeetSAR(amount) {
    const total = Math.round(num(amount) * 100) / 100;
    const riyal = Math.floor(total);
    const halala = Math.round((total - riyal) * 100);
    let txt = `فقط ${intToArabicWords(riyal)} ريال`;
    if (halala > 0) txt += ` و${intToArabicWords(halala)} هللة`;
    return txt + ' لا غير';
  }

  function logoSrc() {
    return document.querySelector('.logo-right')?.getAttribute('src') || 'najran_health_cluster_logo.png';
  }
  function docCss() {
    return `<style>
      @page{size:A4 portrait;margin:12mm}
      *{box-sizing:border-box}body{direction:rtl;margin:0;background:#e9eef5;color:#111827;font-family:Tajawal,Arial,sans-serif}.toolbar{position:sticky;top:0;display:flex;justify-content:center;gap:10px;background:#111827;padding:10px;z-index:5}.toolbar button{border:0;border-radius:10px;padding:10px 18px;font-weight:800;cursor:pointer;background:#d4af37;color:#111}.page{width:210mm;min-height:297mm;margin:12px auto;background:#fff;padding:14mm 15mm;box-shadow:0 10px 30px rgba(15,23,42,.16);position:relative}.head{display:grid;grid-template-columns:80px 1fr 80px;align-items:center;border-bottom:2px solid #003087;padding-bottom:8px;margin-bottom:18px}.head img{width:70px}.head .t{text-align:center}.head h1{font-size:17px;margin:0 0 3px;color:#003087}.head h2{font-size:15px;margin:0;color:#111827}.to{font-size:15px;font-weight:800;margin:18px 0 8px}.body-text{font-size:15px;line-height:2.05;text-align:justify}.amount-table{width:100%;border-collapse:collapse;margin:14px 0;font-size:14px}.amount-table td,.amount-table th{border:1px solid #333;padding:8px}.amount-table td:first-child{text-align:right;font-weight:700;width:72%}.amount-table td:last-child{text-align:center;font-weight:800;direction:ltr}.amount-table .total td{background:#f1f5f9;font-weight:900}.amount-table .grand td{background:#fff7d6;font-weight:900}.tafqeet{border:1px solid #94a3b8;background:#f8fafc;border-radius:8px;padding:8px 12px;margin-top:8px;font-weight:800;line-height:1.8}.closing{font-size:15px;line-height:2;margin-top:12px}.signatures{display:grid;grid-template-columns:repeat(2,1fr);gap:20px;margin-top:35px;text-align:center}.signatures.one{grid-template-columns:1fr;justify-items:end}.sig-title{font-weight:900}.sig-name{font-weight:800;margin-top:12px}.line{height:42px;border-bottom:1px solid #111;margin:8px 30px}.footer{position:absolute;bottom:10mm;left:15mm;right:15mm;border-top:1px solid #cbd5e1;padding-top:5px;font-size:11px;display:flex;justify-content:space-between;direction:ltr}.report-title{text-align:center;font-size:18px;font-weight:900;margin:14px 0}.meta-table,.data-table{width:100%;border-collapse:collapse;font-size:12.5px;margin:10px 0}.meta-table td,.data-table td,.data-table th{border:1px solid #333;padding:6px}.data-table th{background:#e5e7eb;font-weight:900}.data-table td{text-align:center}.settings-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;display:flex;align-items:center;justify-content:center}.settings-dialog{width:min(1180px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:18px;padding:18px;box-shadow:0 25px 70px rgba(0,0,0,.3);direction:rtl}.settings-dialog h2{margin:0 0 14px;color:#003087}.settings-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px}.field label{display:block;font-size:12px;font-weight:900;color:#334155;margin-bottom:3px}.field input,.field select{width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:8px;font-family:inherit}.btn-row{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.btn{border:0;border-radius:10px;padding:9px 14px;font-weight:800;cursor:pointer}.btn-primary{background:#003087;color:#fff}.btn-green{background:#16a34a;color:#fff}.btn-gold{background:#d4af37;color:#111}.btn-light{background:#f1f5f9;color:#111}.btn-red{background:#dc2626;color:#fff}.mini-table{width:100%;border-collapse:collapse;font-size:12px}.mini-table th,.mini-table td{border:1px solid #cbd5e1;padding:4px}.mini-table input{width:100%;border:0;padding:6px;font-family:inherit}.section-box{border:1px solid #e2e8f0;border-radius:14px;padding:12px;margin-top:12px;background:#f8fafc}@media print{body{background:#fff}.toolbar{display:none}.page{margin:0;box-shadow:none;width:auto;min-height:calc(297mm - 24mm);padding:0}.settings-overlay{display:none}.footer{bottom:0}.page{page-break-after:always}.page:last-child{page-break-after:auto}}
    </style>`;
  }
  function headerHtml(settings) {
    return `<div class="head"><img src="${esc(logoSrc())}"><div class="t"><h1>${esc(settings.entityTitle)}</h1><h2>${esc(settings.departmentTitle)}</h2></div><img src="${esc(logoSrc())}"></div>`;
  }
  function footerHtml(settings) {
    return `<div class="footer"><span>${esc(settings.phoneFaxEn)}</span><span dir="rtl">${esc(settings.phoneFaxAr)}</span></div>`;
  }
  function signatureHtml(settings, mode) {
    if (mode === 'two') return `<div class="signatures"><div><div class="sig-title">${esc(settings.unitManagerTitle)}</div><div class="line"></div><div class="sig-name">${esc(settings.unitManagerName)}</div></div><div><div class="sig-title">${esc(settings.managerTitle)}</div><div class="line"></div><div class="sig-name">${esc(settings.managerName)}</div></div></div>`;
    return `<div class="signatures one"><div><div class="sig-title">${esc(settings.managerTitle)}</div><div class="line"></div><div class="sig-name">${esc(settings.managerName)}</div></div></div>`;
  }
  function openPrintDoc(title, bodyHtml) {
    const win = window.open('', '', 'width=1000,height=900');
    if (!win) return alert('المتصفح منع نافذة الطباعة. اسمح بالنوافذ المنبثقة.');
    win.document.open();
    win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>${esc(title)}</title><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">${docCss()}</head><body><div class="toolbar"><button onclick="window.print()">طباعة</button><button onclick="window.close()">إغلاق</button></div>${bodyHtml}</body></html>`);
    win.document.close();
  }

  function laborValues() {
    const s = getSettings();
    const g = calcGrandLabor();
    const p1 = num(s.period1LaborNet);
    const p2 = g.finalNet;
    const net = p1 + p2;
    const vat = net * num(s.vatRate) / 100;
    const saud1 = saudizationTotal('period1');
    const saud2 = saudizationTotal('period2');
    const saud = saud1 + saud2;
    return { p1, p2, net, vat, saud1, saud2, saud, grand: net + vat + saud, currentGrand: g };
  }
 function generateLaborRaiseLetter() {
  const s = getSettings();
  const v = laborValues();
  const company = getCompanyName();

  const body = `<section class="page">${headerHtml(s)}
<div class="to">${esc(s.recipient)} &nbsp;&nbsp;&nbsp; ${esc(s.recipientSuffix)}</div>

<div class="body-text">
السلام عليكم ورحمة الله وبركاته، وبعد:<br>
نرفق لسعادتكم المستخلص الشهري لشركة ${esc(company)} والخاص ببند العمالة لمواقع ${esc(s.scopeName)}، ${extractPhrase()}.
</div>

<table class="amount-table"><tbody>
<tr><td>صافي مستحقات العمالة عن فترة المستخلص</td><td>${moneyPlain(v.net)}</td></tr>
<tr><td>ضريبة القيمة المضافة ${moneyPlain(s.vatRate)}%</td><td>${money(v.vat)}</td></tr>
<tr><td>تعويض توطين الوظائف عن فترة المستخلص</td><td>${moneyPlain(v.saud)}</td></tr>
<tr class="grand"><td>الإجمالي</td><td>${money(v.grand)}</td></tr>
</tbody></table>

<div class="tafqeet">${esc(tafqeetSAR(v.grand))}</div>

<div class="closing">
لذا نأمل بعد الاطلاع إحالته إلى جهة الاختصاص لتدقيقه واستكمال إجراءات صرف مستحقات المقاول / ${esc(company)}.
<br>وتقبلوا تحياتنا ،،،
</div>

${signatureHtml(s, 'one')}${footerHtml(s)}</section>`;

  openPrintDoc('خطاب رفع العمالة', body);
}

function generateConsumablesRaiseLetter() {
  const s = getSettings();
  const company = getCompanyName();

  const net = num(s.consumablesPeriod2Net);
  const vat = net * num(s.vatRate) / 100;
  const grand = net + vat;

  const body = `<section class="page">${headerHtml(s)}
<div class="to">${esc(s.recipient)} &nbsp;&nbsp;&nbsp; ${esc(s.recipientSuffix)}</div>

<div class="body-text">
السلام عليكم ورحمة الله وبركاته، وبعد:<br>
نرفق لسعادتكم المستخلص الشهري لشركة ${esc(company)} والخاص ببند المستهلكات ومقاولي الباطن لمواقع ${esc(s.scopeName)}، ${extractPhrase()}.
</div>

<table class="amount-table"><tbody>
<tr><td>صافي مستحقات المستهلكات ومقاولي الباطن عن فترة المستخلص</td><td>${moneyPlain(net)}</td></tr>
<tr><td>ضريبة القيمة المضافة ${moneyPlain(s.vatRate)}%</td><td>${money(vat)}</td></tr>
<tr class="grand"><td>الإجمالي</td><td>${money(grand)}</td></tr>
</tbody></table>

<div class="tafqeet">${esc(tafqeetSAR(grand))}</div>

<div class="closing">
لذا نأمل بعد الاطلاع إحالته إلى جهة الاختصاص لتدقيقه واستكمال إجراءات صرف مستحقات المقاول / ${esc(company)}.
<br>وتقبلوا تحياتنا ،،،
</div>

${signatureHtml(s, 'one')}${footerHtml(s)}</section>`;

  openPrintDoc('خطاب رفع المستهلكات', body);
}

function generateSiteRaiseLetter(centerKey) {
  const s = getSettings();
  const names = getNames();
  const key = centerKey || s.siteLetterDefaultCenter || Object.keys(names)[0] || 'center_1';
  const site = names[key] || key;
  const amount = calcSite(key).finalNet;
  const company = getCompanyName();

  const body = `<section class="page">${headerHtml(s)}
<div class="to">${esc(s.recipient)} &nbsp;&nbsp;&nbsp; ${esc(s.recipientSuffix)}</div>

<div class="body-text">
السلام عليكم ورحمة الله وبركاته، وبعد:<br>
إشارة إلى عقد الصيانة والنظافة والتشغيل غير الطبي لمواقع المكاتب الإدارية والمرافق الصحية بصحة نجران مقاولة ${esc(company)}، نرفق لسعادتكم المستخلص الشهري الخاص بموقع ${esc(site)} ببند العمالة، ${extractPhrase()}، بمبلغ وقدره (${moneyPlain(amount)} ريال) ${esc(tafqeetSAR(amount))}.
</div>

<div class="closing">
نأمل بعد الاطلاع إحالته إلى جهة الاختصاص لتدقيقه واستكمال إجراءات صرف مستحقات المقاول ${esc(company)} حسب ما جاء أعلاه.
<br>وتقبلوا خالص تحياتنا ،،،
</div>

${signatureHtml(s, 'one')}${footerHtml(s)}</section>`;

  openPrintDoc('خطاب رفع موقع', body);
}

function generateDeclaration() {
  const s = getSettings();
  const company = getCompanyName();
  const v = laborValues();
  const amount = s.declarationAmountMode === 'manual' ? num(s.declarationManualAmount) : v.grand;

  const body = `<section class="page">${headerHtml(s)}
<div style="text-align:left;font-size:14px;font-weight:800">التاريخ : ${esc(fmtDate(s.declarationDate))} م</div>

<div class="report-title">إقرار بعدم أسبقية الصرف</div>

<div class="body-text">
تقر إدارة الصيانة بالشئون الهندسية بصحة نجران بأن مستخلص العمالة لشركة ${esc(company)}، لمواقع ${esc(s.scopeName)}، ${extractPhrase()}، بمبلغ وقدره (${money(amount)}) ${esc(tafqeetSAR(amount))}.
<br>ولم يسبق صرفه من قبلنا.
</div>

${signatureHtml(s, 'two')}${footerHtml(s)}</section>`;

  openPrintDoc('إقرار عدم أسبقية الصرف', body);
}

function generateSaudizationReport() {
  const s = getSettings();
  const company = getCompanyName();
  const data = getSaudization();
  const period = data.period2 || { rows: [] };

  const rows = (period.rows || []).map((r, i) => `
<tr>
<td>${i + 1}</td>
<td>${esc(r.jobTitle)}</td>
<td>${esc(r.name)}</td>
<td>${esc(r.idNo)}</td>
<td>${moneyPlain(r.salary)}</td>
<td>${moneyPlain(r.compensation)}</td>
</tr>`).join('');

  const total = saudizationTotal('period2');

  const body = `<section class="page">${headerHtml(s)}
<div class="report-title">نموذج التقرير السنوي للعقود المعتمدة ضمن لجنة تعويضات فروق الراتب</div>

<table class="meta-table"><tbody>
<tr><td>اسم المشروع</td><td>${esc(s.projectName)}</td></tr>
<tr><td>قيمة المشروع</td><td>${esc(s.projectValue)}</td></tr>
<tr><td>الجهة الحكومية / القطاع الفرعي</td><td>${esc(s.governmentEntity)}</td></tr>
<tr><td>اسم المقاول</td><td>${esc(company)}</td></tr>
<tr><td>مدة المشروع (شهر)</td><td>${esc(s.projectDuration)}</td></tr>
<tr><td>تاريخ بداية المشروع</td><td>${esc(fmtDate(s.projectStart))}</td></tr>
<tr><td>تاريخ نهاية المشروع</td><td>${esc(fmtDate(s.projectEnd))}</td></tr>
<tr><td>عدد الفرص الإضافية المعتمدة بالتوطين (تعويض)</td><td>${esc(s.saudizationOpportunities)}</td></tr>
</tbody></table>

<div class="report-title" style="font-size:15px">
تفاصيل مصروفات التعويض خلال ${extractPhrase()}
</div>

<table class="data-table">
<thead>
<tr>
<th>م</th>
<th>المسمى الوظيفي</th>
<th>اسم الموظف</th>
<th>رقم الهوية الوطنية</th>
<th>الراتب</th>
<th>مبلغ التعويض</th>
</tr>
</thead>
<tbody>
${rows || '<tr><td colspan="6">لا توجد بيانات توطين.</td></tr>'}
<tr><th colspan="5">الإجمالي</th><th>${moneyPlain(total)}</th></tr>
</tbody>
</table>

${signatureHtml(s, 'two')}
<div style="text-align:center;margin-top:18px;font-weight:900">الختم</div>
${footerHtml(s)}</section>`;

  openPrintDoc('تقرير التوطين', body);
}
  function settingsField(k, label, type) {
    const s = getSettings();
    return `<div class="field"><label>${esc(label)}</label><input type="${type || 'text'}" data-rl-setting="${esc(k)}" value="${esc(s[k])}"></div>`;
  }
  function renderSaudizationRows(periodKey) {
    const data = getSaudization();
    const rows = ((data[periodKey] && data[periodKey].rows) || []);
    return rows.map((r, i) => `<tr><td>${i + 1}</td><td><input data-saud-period="${periodKey}" data-saud-row="${i}" data-saud-field="jobTitle" value="${esc(r.jobTitle)}"></td><td><input data-saud-period="${periodKey}" data-saud-row="${i}" data-saud-field="name" value="${esc(r.name)}"></td><td><input data-saud-period="${periodKey}" data-saud-row="${i}" data-saud-field="idNo" value="${esc(r.idNo)}"></td><td><input type="number" data-saud-period="${periodKey}" data-saud-row="${i}" data-saud-field="salary" value="${esc(r.salary)}"></td><td><input type="number" data-saud-period="${periodKey}" data-saud-row="${i}" data-saud-field="compensation" value="${esc(r.compensation)}"></td><td><button class="btn btn-red" onclick="AdminOfficesRaiseLetters.deleteSaudizationRow('${periodKey}',${i})">حذف</button></td></tr>`).join('');
  }
  function renderDialog() {
    const s = getSettings();
    const names = getNames();
    const options = Object.entries(names).map(([k, v]) => `<option value="${esc(k)}" ${s.siteLetterDefaultCenter === k ? 'selected' : ''}>${esc(v)}</option>`).join('');
    const html = `<div class="settings-overlay" id="raise-letters-overlay"><div class="settings-dialog"><h2>خطابات الرفع — المكاتب الإدارية والمرافق الصحية</h2><div class="btn-row"><button class="btn btn-primary" onclick="AdminOfficesRaiseLetters.saveDialog()">حفظ الإعدادات</button><button class="btn btn-gold" onclick="AdminOfficesRaiseLetters.generateLaborRaiseLetter()">خطاب رفع العمالة</button><button class="btn btn-gold" onclick="AdminOfficesRaiseLetters.generateConsumablesRaiseLetter()">خطاب رفع المستهلكات</button><button class="btn btn-gold" onclick="AdminOfficesRaiseLetters.generateSaudizationReport()">تقرير التوطين</button><button class="btn btn-gold" onclick="AdminOfficesRaiseLetters.generateDeclaration()">إقرار عدم أسبقية الصرف</button><button class="btn btn-gold" onclick="AdminOfficesRaiseLetters.generateSiteRaiseLetter()">خطاب رفع موقع</button><button class="btn btn-light" onclick="AdminOfficesRaiseLetters.closeDialog()">إغلاق</button></div><div class="section-box"><h3>إعدادات الخطابات</h3><div class="settings-grid">${settingsField('recipient','المخاطب')}${settingsField('recipientSuffix','صفة المخاطب')}${settingsField('entityTitle','العنوان الرئيسي')}${settingsField('departmentTitle','الإدارة')}${settingsField('scopeName','نطاق المشروع')}${settingsField('purchasePeriodLabel','فترة الشراء المباشر')}${settingsField('paymentNo','رقم الدفعة')}${settingsField('vatRate','نسبة الضريبة','number')}${settingsField('period1Start','بداية الفترة الأولى','date')}${settingsField('period1End','نهاية الفترة الأولى','date')}${settingsField('period1LaborNet','صافي العمالة للفترة الأولى','number')}${settingsField('period2Start','بداية الفترة الثانية','date')}${settingsField('period2End','نهاية الفترة الثانية','date')}${settingsField('consumablesPeriod1Net','صافي المستهلكات للفترة الأولى','number')}${settingsField('consumablesPeriod2Net','صافي المستهلكات للفترة الثانية','number')}${settingsField('declarationDate','تاريخ الإقرار','date')}${settingsField('declarationManualAmount','مبلغ الإقرار اليدوي','number')}<div class="field"><label>موقع خطاب الرفع</label><select data-rl-setting="siteLetterDefaultCenter"><option value="">اختر الموقع</option>${options}</select></div></div></div><div class="section-box"><h3>بيانات مشروع التوطين</h3><div class="settings-grid">${settingsField('projectName','اسم المشروع')}${settingsField('projectValue','قيمة المشروع')}${settingsField('governmentEntity','الجهة الحكومية / القطاع الفرعي')}${settingsField('projectDuration','مدة المشروع')}${settingsField('projectStart','تاريخ بداية المشروع','date')}${settingsField('projectEnd','تاريخ نهاية المشروع','date')}${settingsField('saudizationOpportunities','عدد الفرص المعتمدة','number')}${settingsField('unitManagerTitle','توقيع 1 - الصفة')}${settingsField('unitManagerName','توقيع 1 - الاسم')}${settingsField('managerTitle','توقيع 2 - الصفة')}${settingsField('managerName','توقيع 2 - الاسم')}</div></div><div class="section-box"><h3>توطين الفترة الأولى</h3><div class="btn-row"><button class="btn btn-green" onclick="AdminOfficesRaiseLetters.addSaudizationRow('period1')">إضافة صف</button><b>الإجمالي: <span id="saud-total-period1">${moneyPlain(saudizationTotal('period1'))}</span></b></div><table class="mini-table"><thead><tr><th>م</th><th>المسمى الوظيفي</th><th>اسم الموظف</th><th>رقم الهوية</th><th>الراتب</th><th>مبلغ التعويض</th><th></th></tr></thead><tbody>${renderSaudizationRows('period1')}</tbody></table></div><div class="section-box"><h3>توطين الفترة الثانية</h3><div class="btn-row"><button class="btn btn-green" onclick="AdminOfficesRaiseLetters.addSaudizationRow('period2')">إضافة صف</button><b>الإجمالي: <span id="saud-total-period2">${moneyPlain(saudizationTotal('period2'))}</span></b></div><table class="mini-table"><thead><tr><th>م</th><th>المسمى الوظيفي</th><th>اسم الموظف</th><th>رقم الهوية</th><th>الراتب</th><th>مبلغ التعويض</th><th></th></tr></thead><tbody>${renderSaudizationRows('period2')}</tbody></table></div></div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  }
  function saveDialog() {
    const patch = {};
    document.querySelectorAll('[data-rl-setting]').forEach(el => patch[el.dataset.rlSetting] = el.value);
    saveSettings(patch);
    const data = getSaudization();
    document.querySelectorAll('[data-saud-period]').forEach(el => {
      const p = el.dataset.saudPeriod, i = parseInt(el.dataset.saudRow, 10), f = el.dataset.saudField;
      data[p] = data[p] || { rows: [] };
      data[p].rows = data[p].rows || [];
      data[p].rows[i] = data[p].rows[i] || {};
      data[p].rows[i][f] = el.value;
    });
    data.period1.start = patch.period1Start || data.period1.start;
    data.period1.end = patch.period1End || data.period1.end;
    data.period2.start = patch.period2Start || data.period2.start;
    data.period2.end = patch.period2End || data.period2.end;
    saveSaudization(data);
    alert('تم حفظ إعدادات خطابات الرفع والتوطين.');
    closeDialog();
  }
  function openDialog() { if (!document.getElementById('raise-letters-overlay')) renderDialog(); }
  function closeDialog() { document.getElementById('raise-letters-overlay')?.remove(); }
  function addSaudizationRow(periodKey) {
    const data = getSaudization();
    data[periodKey] = data[periodKey] || { rows: [] };
    data[periodKey].rows = data[periodKey].rows || [];
    data[periodKey].rows.push({ jobTitle: '', name: '', idNo: '', salary: '', compensation: '' });
    saveSaudization(data);
    closeDialog(); openDialog();
  }
  function deleteSaudizationRow(periodKey, idx) {
    const data = getSaudization();
    if (data[periodKey] && Array.isArray(data[periodKey].rows)) data[periodKey].rows.splice(idx, 1);
    saveSaudization(data);
    closeDialog(); openDialog();
  }
  function installButton() {
    const bar = document.getElementById('main-action-buttons');
    if (!bar || document.getElementById('raise-letters-btn')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'raise-letters-btn';
    btn.className = 'ab ab-update';
    btn.innerHTML = '<i class="fas fa-envelope-open-text"></i> خطابات الرفع';
    btn.onclick = openDialog;
    const grandBtn = Array.from(bar.querySelectorAll('button')).find(b => (b.textContent || '').includes('الشهادة الإجمالية'));
    if (grandBtn && grandBtn.nextSibling) bar.insertBefore(btn, grandBtn.nextSibling);
    else bar.appendChild(btn);
  }

  window.AdminOfficesRaiseLetters = { openDialog, closeDialog, saveDialog, addSaudizationRow, deleteSaudizationRow, generateLaborRaiseLetter, generateConsumablesRaiseLetter, generateSaudizationReport, generateDeclaration, generateSiteRaiseLetter, tafqeetSAR, calcGrandLabor, laborValues };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installButton);
  else installButton();
  setTimeout(installButton, 700);
  setTimeout(installButton, 1800);
  setTimeout(installButton, 3500);
  console.info('[Admin Offices Raise Letters] installed');
})();
