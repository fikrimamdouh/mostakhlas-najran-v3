// ===================================================================
// Admin Offices Raise Letters Print Fallbacks — V1
// Scope: admin_offices_attendance.html?raiseLettersClean=1
// يعرّف دوال الطباعة الناقصة لمركز خطابات الرفع حتى تعمل كل الأزرار.
// لا يغير مفاتيح الحفظ أو الحسابات الأصلية. يستخدم البيانات الحالية من localStorage.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_RAISE_LETTERS_PRINT_FALLBACKS_V1__) return;
  window.__ADMIN_OFFICES_RAISE_LETTERS_PRINT_FALLBACKS_V1__ = true;

  const SETTINGS_KEY = 'adminOfficesRaiseLettersSettings_v1';

  function readJson(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }
  function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function clean(v) { return String(v == null ? '' : v).replace(/[\u200e\u200f]/g, '').replace(/\s+/g, ' ').trim(); }
  function num(v) { const n = Number(String(v ?? '').replace(/,/g, '').replace(/[ ريال﷼]/g, '').trim()); return Number.isFinite(n) ? n : 0; }
  function money(v) { return num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function today() { return new Date().toLocaleDateString('en-CA'); }

  function settings() {
    return Object.assign({
      recipient: 'سعادة / مساعد المدير العام للدعم المساند',
      recipientSuffix: 'المحترم',
      entityTitle: 'المديرية العامة للشئون الصحية بمنطقة نجران',
      departmentTitle: 'إدارة الشئون الهندسية',
      scopeName: 'المكاتب الإدارية والمرافق الصحية وصيانة وإصلاح السيارات والعيادات المتنقلة',
      finalLetterTo: 'المكرم / مدير الإدارة المالية',
      finalLetterToSuffix: 'المحترم',
      finalLetterGreeting: 'السلام عليكم ورحمة الله وبركاته',
      finalLetterRegards: 'مع أطيب تحياتي وتقديري،،',
      finalLetterSignatureTitle: 'مساعد المدير العام للدعم المساند',
      finalLetterSignatureName: '',
      managerTitle: 'مدير إدارة الإمداد والصيانة',
      managerName: '',
      unitManagerTitle: '',
      unitManagerName: '',
      vatRate: 15
    }, readJson(SETTINGS_KEY, {}));
  }

  function contract() { return readJson('persistentContractData', {}); }
  function extract() { return readJson('persistentExtractData', {}); }
  function names() { try { if (typeof window.getCenterNames === 'function') return window.getCenterNames() || {}; } catch (_) {} return readJson('adminOfficeNames_v1', {}); }
function countRows(obj) {
  return Object.values(obj || {}).reduce((sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0), 0);
}

function countNamedRows(obj) {
  return Object.values(obj || {}).reduce((sum, rows) => {
    if (!Array.isArray(rows)) return sum;
    return sum + rows.filter(emp => clean(emp && (emp.name || emp.employeeName || emp.workerName))).length;
  }, 0);
}

function data() {
  const sources = [];

  try {
    if (typeof window.getAttendanceData === 'function') {
      sources.push(window.getAttendanceData() || {});
    }
  } catch (_) {}

  [
    'adminOfficesAttendanceData_v1',
    'adminOfficesAttendanceData_v1_localBackup',
    'adminOfficesAttendanceData_v1_lastGood',
    'adminOfficesLaborDataSafe_v2',
    'adminOfficesAttendanceData',
    'admin_offices_attendance_data'
  ].forEach(key => sources.push(readJson(key, {})));

  const best = sources.reduce((bestObj, obj) => {
    const bestNamed = countNamedRows(bestObj);
    const objNamed = countNamedRows(obj);

    if (objNamed > bestNamed) return obj;
    if (objNamed === bestNamed && countRows(obj) > countRows(bestObj)) return obj;

    return bestObj;
  }, {});

  if (countRows(best) > 0) {
    try {
      localStorage.setItem('adminOfficesAttendanceData_v1', JSON.stringify(best));
      localStorage.setItem('adminOfficesAttendanceData_v1_localBackup', JSON.stringify(best));
      localStorage.setItem('adminOfficesAttendanceData_v1_lastGood', JSON.stringify(best));
      localStorage.setItem('adminOfficesAttendanceData_v1_localBackup_ts', String(Date.now()));
    } catch (_) {}
  }

  return best;
}
  function companyName() {
    const c = contract();
    const s = readJson('najran_session', {});
    return clean(c.contractorName || c.companyName || c.contractorCompany || s.companyName || document.querySelector('.companyName')?.textContent) || 'غير محدد';
  }
  function meta() {
    const e = extract();
    return {
      paymentNo: clean(e.paymentNumber || e.extractNumber || localStorage.getItem('paymentNumber') || localStorage.getItem('extractNumber') || '—').replace(/^0+(\d)$/,'$1'),
      start: clean(e.extractStart || e.periodStart || localStorage.getItem('extractStart') || localStorage.getItem('periodStart') || ''),
      end: clean(e.extractEnd || e.periodEnd || localStorage.getItem('extractEnd') || localStorage.getItem('periodEnd') || '')
    };
  }
  function periodText() { const m = meta(); return `دفعة رقم (${esc(m.paymentNo || '—')}) عن الفترة من ${esc(m.start || 'غير محدد')} م إلى ${esc(m.end || 'غير محدد')} م`; }
  function keys() {
    const ns = names(), d = data();
    return Array.from(new Set(Object.keys(ns || {}).concat(Object.keys(d || {})))).filter(k => Array.isArray(d[k]) || ns[k]).sort((a,b) => {
      const ac=/^center_\d+$/.test(a), bc=/^center_\d+$/.test(b);
      if (ac && bc) return parseInt(a.split('_')[1],10)-parseInt(b.split('_')[1],10);
      if (ac) return -1; if (bc) return 1; return String(a).localeCompare(String(b),'ar');
    });
  }
  function officeRows(k) { return Array.isArray(data()[k]) ? data()[k] : []; }
  function allRows() { return keys().flatMap(k => officeRows(k).map(emp => Object.assign({ __siteKey: k, __siteName: names()[k] || k }, emp || {}))); }
function periodInfo() {
  try {
    if (typeof window.getExtractPeriodDetails === 'function') {
      const p = window.getExtractPeriodDetails() || {};
      return {
        daysInExtract: Number(p.daysInExtract || p.daysInMonth || p.duration || 30),
        totalDaysInMonth: Number(p.totalDaysInMonth || p.daysInMonth || 30)
      };
    }
  } catch (_) {}

  const e = extract();
  const startRaw = e.extractStart || e.periodStart || localStorage.getItem('extractStart') || localStorage.getItem('periodStart') || '';
  const endRaw = e.extractEnd || e.periodEnd || localStorage.getItem('extractEnd') || localStorage.getItem('periodEnd') || '';

  const start = new Date(startRaw);
  const end = new Date(endRaw || startRaw);

  if (!Number.isNaN(start.getTime())) {
    const totalDaysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate() || 30;
    let daysInExtract = 30;

    if (!Number.isNaN(end.getTime())) {
      daysInExtract = Math.max(1, Math.ceil((end - start) / 86400000) + 1);
    }

    return { daysInExtract, totalDaysInMonth };
  }

  return { daysInExtract: 30, totalDaysInMonth: 30 };
}

function contractInfo() {
  const c = contract();
  return {
    contractType: c.contractType || 'عقد أساسي',
    directPurchaseRatio: num(c.directPurchaseRatio || 0)
  };
}

function normalizeDays(days, daysInExtract) {
  const out = Array.isArray(days) ? days.slice(0, daysInExtract) : [];
  while (out.length < daysInExtract) out.push('ح');
  return out;
}

function fineConfig(category) {
  const map = {
    1: { saudi: 500, non_saudi: 500 },
    2: { saudi: 500, non_saudi: 500 },
    3: { saudi: 250, non_saudi: 100 },
    4: { saudi: 180, non_saudi: 80 },
    5: { saudi: 150, non_saudi: 80 },
    6: { saudi: 20, non_saudi: 20 },
    7: { saudi: 10, non_saudi: 10 },
    default: { saudi: 0, non_saudi: 0 }
  };

  return map[category] || map[String(category)] || map.default;
}

function isSaudiNationality(value) {
  const v = String(value || '').replace(/\s+/g, '');
  return v.includes('سعودي') && !v.includes('غيرسعودي');
}

function calcEmpFallback(emp) {
  const p = periodInfo();
  const c = contractInfo();

  const salary = num(emp.salary || emp.monthlySalary || emp.cost || emp.monthlyCost);
  const dailyRate = p.totalDaysInMonth > 0 ? salary / p.totalDaysInMonth : 0;

  let costForPeriod = dailyRate * p.daysInExtract;

  if (String(c.contractType || '').includes('شراء مباشر') && c.directPurchaseRatio > 0) {
    costForPeriod += costForPeriod * (c.directPurchaseRatio / 100);
  }

  const days = normalizeDays(emp.days, p.daysInExtract);

  let absenceDays = 0;
  let deductionOnlyDays = 0;

  days.forEach(day => {
    const d = clean(day);

    if (!d || d === 'ح' || d === 'ت' || d === 'غ•') return;

    if (d === 'غ') {
      absenceDays++;
      return;
    }

    deductionOnlyDays++;
  });

  const deduction = (absenceDays + deductionOnlyDays) * dailyRate;
  const cfg = fineConfig(emp.category || 1);
  const absenceFine = absenceDays * (isSaudiNationality(emp.nationality) ? cfg.saudi : cfg.non_saudi);
  const nationalityFine = num(emp.nationalityFine);
  const totalFine = absenceFine + nationalityFine;
  const netSalary = costForPeriod - deduction - totalFine;

  return {
    costForPeriod,
    deduction,
    absenceFine,
    nationalityFine,
    totalFine,
    netSalary
  };
}

function calcEmpNet(emp) {
  const p = periodInfo();
  const c = contractInfo();

  if (typeof window.calculateAdminOfficeEmployeeFinancials === 'function') {
    try {
      const r = window.calculateAdminOfficeEmployeeFinancials(emp, {
        totalDaysInMonth: p.totalDaysInMonth,
        daysInExtract: p.daysInExtract,
        contractType: c.contractType,
        directPurchaseRatio: c.directPurchaseRatio
      });

      const net = num(r && r.netSalary);
      if (net || num(r && r.costForPeriod)) return net;
    } catch (_) {}
  }

  return calcEmpFallback(emp).netSalary;
}

function siteTotal(k) {
  return officeRows(k).reduce((sum, emp) => sum + calcEmpNet(emp), 0);
}

function grandLaborTotal() {
  return keys().reduce((sum, k) => sum + siteTotal(k), 0);
}
  function css() {
    const letterCss = window.AdminOfficePrintLetters && typeof window.AdminOfficePrintLetters.lettersCss === 'function' ? window.AdminOfficePrintLetters.lettersCss() : '';
    return `<style>
      @page{size:A4 portrait;margin:12mm} body{font-family:Tajawal,Arial,sans-serif;direction:rtl;color:#111827;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact} .rl-page{min-height:270mm;page-break-after:always;padding:8mm 10mm;box-sizing:border-box;position:relative}.rl-head{display:grid;grid-template-columns:70px 1fr 70px;align-items:center;border-bottom:2px solid #003087;padding-bottom:8px;margin-bottom:18px}.rl-head img{width:60px}.rl-head div{text-align:center}.rl-head h1{margin:0 0 4px;color:#003087;font-size:17px}.rl-head h2{margin:0;font-size:14px}.rl-to{font-weight:900;margin:18px 0 12px}.rl-title{text-align:center;font-size:19px;font-weight:950;color:#003087;margin:14px 0}.rl-body{font-size:15px;line-height:2.05;text-align:justify}.rl-table{width:100%;border-collapse:collapse;margin:14px 0;font-size:13px}.rl-table th,.rl-table td{border:1px solid #333;padding:7px;text-align:center}.rl-table th{background:#eef2ff;color:#0f172a}.rl-table .right{text-align:right}.rl-total td{background:#fff7d6;font-weight:950}.rl-sign{display:grid;grid-template-columns:repeat(2,1fr);gap:30px;margin-top:35px;text-align:center}.rl-sign .line{height:38px;border-bottom:1px solid #111;margin:10px 35px}.rl-footer{position:absolute;bottom:5mm;left:10mm;right:10mm;border-top:1px solid #cbd5e1;padding-top:5px;font-size:11px;text-align:center;color:#64748b}.rtl{direction:rtl}.ltr{direction:ltr}.no-print{display:none!important}@media print{.no-print{display:none!important}}
    </style>${letterCss}`;
  }
  function head(title) { const s = settings(); return `<div class="rl-head"><img src="moh_logo.png"><div><h1>${esc(s.entityTitle)}</h1><h2>${esc(s.departmentTitle)}</h2></div><img src="moh_logo.png"></div>${title ? `<div class="rl-title">${esc(title)}</div>` : ''}`; }
  function sign() { const s = settings(); return `<div class="rl-sign"><div><b>${esc(s.managerTitle || 'مدير إدارة الإمداد والصيانة')}</b><div class="line"></div><b>${esc(s.managerName || '')}</b></div><div><b>${esc(s.unitManagerTitle || '')}</b><div class="line"></div><b>${esc(s.unitManagerName || '')}</b></div></div>`; }
  function page(title, body, table) { return `<section class="rl-page">${head(title)}<div class="rl-body">${body}</div>${table || ''}${sign()}<div class="rl-footer">${esc(periodText())}</div></section>`; }
  function table(headers, rows) { return `<table class="rl-table"><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`; }
  function printHtml(title, bodyHtml) {
    const w = window.open('', '_blank', 'width=1200,height=900');
    if (!w) return alert('المتصفح منع فتح نافذة الطباعة.');
    w.document.open();
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap" rel="stylesheet">${css()}</head><body>${bodyHtml}<script>setTimeout(function(){window.focus();window.print();},700)<\/script></body></html>`);
    w.document.close();
  }

  function finalRaisePage() {
    const total = grandLaborTotal(), vat = total * num(settings().vatRate) / 100, grand = total + vat;
    return page('خطاب الرفع النهائي', `${esc(settings().finalLetterTo)} ${esc(settings().finalLetterToSuffix)}<br>${esc(settings().finalLetterGreeting)}<br><br>نرفق لسعادتكم مستخلص عمالة ${esc(settings().scopeName)} لشركة ${esc(companyName())}، ${esc(periodText())}.`, table(['البيان','القيمة'], [`<tr><td class="right">صافي مستحقات العمالة</td><td class="ltr">${money(total)}</td></tr>`, `<tr><td class="right">ضريبة القيمة المضافة ${money(settings().vatRate)}%</td><td class="ltr">${money(vat)}</td></tr>`, `<tr class="rl-total"><td class="right">الإجمالي</td><td class="ltr">${money(grand)}</td></tr>`]));
  }
  function declarationPage() { return page('إقرار عدم أسبقية الصرف', `نقر بأنه لم يسبق صرف مستحقات شركة ${esc(companyName())} عن ${esc(settings().scopeName)}، ${esc(periodText())}.`, table(['البيان','القيمة'], [`<tr><td class="right">صافي مستحقات العمالة</td><td class="ltr">${money(grandLaborTotal())}</td></tr>`])); }
  function laborRaisePage() { return page('خطاب الرفع للمستخلص', `نرفق لسعادتكم مستخلص عمالة ${esc(settings().scopeName)} الخاص بشركة ${esc(companyName())}، ${esc(periodText())}.`, table(['البيان','القيمة'], [`<tr><td class="right">إجمالي مستحقات العمالة</td><td class="ltr">${money(grandLaborTotal())}</td></tr>`, `<tr><td class="right">عدد المواقع</td><td>${keys().length}</td></tr>`, `<tr><td class="right">عدد الموظفين</td><td>${allRows().length}</td></tr>`])); }
  function groupedCertificatePage() { const rows = keys().map(k => `<tr><td class="right">${esc(names()[k] || k)}</td><td>${officeRows(k).length}</td><td class="ltr">${money(siteTotal(k))}</td></tr>`); rows.push(`<tr class="rl-total"><td class="right">الإجمالي</td><td>${allRows().length}</td><td class="ltr">${money(grandLaborTotal())}</td></tr>`); return page('شهادة الاستحقاق الشهري المجمعة', `بيان إجمالي استحقاق مواقع المكاتب الإدارية والمرافق الصحية، ${esc(periodText())}.`, table(['الموقع','عدد الموظفين','القيمة'], rows)); }
  function entitlementPage() { return page('بيان استحقاق', `بيان استحقاق شركة ${esc(companyName())} عن ${esc(settings().scopeName)}، ${esc(periodText())}.`, table(['البند','القيمة'], [`<tr><td class="right">إجمالي المستحق</td><td class="ltr">${money(grandLaborTotal())}</td></tr>`])); }
  function salaryPage() { return page('شهادة تسليم الرواتب', `نشهد بأنه تم استلام ما يفيد تسليم رواتب العاملين لشركة ${esc(companyName())} عن فترة المستخلص الموضحة.`, table(['البيان','القيمة'], [`<tr><td class="right">عدد العاملين</td><td>${allRows().length}</td></tr>`, `<tr><td class="right">الفترة</td><td>${esc(periodText())}</td></tr>`])); }
  function saudiJobsPage() { const rows = allRows().filter(e => /سعود/i.test(clean(e.nationality))).map((e,i) => `<tr><td>${i+1}</td><td class="right">${esc(e.__siteName)}</td><td class="right">${esc(e.name || '')}</td><td class="right">${esc(e.jobTitle || '')}</td><td>${esc(e.iqamaId || '')}</td></tr>`); return page('بيان الوظائف المشغولة بالسعوديين', `بيان الموظفين السعوديين ضمن عمالة المكاتب الإدارية.`, table(['م','الموقع','الاسم','الوظيفة','الهوية'], rows.length ? rows : ['<tr><td colspan="5">لا توجد بيانات سعوديين محفوظة.</td></tr>'])); }
  function statusCount(emp, codes) { return Array.isArray(emp.days) ? emp.days.filter(d => codes.indexOf(clean(d)) > -1).length : 0; }
  function absencePage() { const rows = allRows().map((e,i) => ({ e, c: statusCount(e, ['غ','غ•']) })).filter(x => x.c).map((x,i) => `<tr><td>${i+1}</td><td class="right">${esc(x.e.__siteName)}</td><td class="right">${esc(x.e.name || '')}</td><td class="right">${esc(x.e.jobTitle || '')}</td><td>${x.c}</td></tr>`); return page('بيان الغيابات', `بيان الغيابات المسجلة خلال فترة المستخلص.`, table(['م','الموقع','الاسم','الوظيفة','أيام الغياب'], rows.length ? rows : ['<tr><td colspan="5">لا توجد غيابات مسجلة.</td></tr>'])); }
  function vacationPage() { const rows = allRows().map((e,i) => ({ e, c: statusCount(e, ['ج','إ','ش']) })).filter(x => x.c).map((x,i) => `<tr><td>${i+1}</td><td class="right">${esc(x.e.__siteName)}</td><td class="right">${esc(x.e.name || '')}</td><td class="right">${esc(x.e.jobTitle || '')}</td><td>${x.c}</td></tr>`); return page('بيان الإجازات', `بيان الإجازات المسجلة خلال فترة المستخلص.`, table(['م','الموقع','الاسم','الوظيفة','أيام الإجازات'], rows.length ? rows : ['<tr><td colspan="5">لا توجد إجازات مسجلة.</td></tr>'])); }
  function performancePage() { return page('شهادة الأداء الشهري', `شهادة أداء شهرية لمواقع المكاتب الإدارية والمرافق الصحية، ${esc(periodText())}.`, table(['البيان','القيمة'], [`<tr><td class="right">عدد المواقع</td><td>${keys().length}</td></tr>`, `<tr><td class="right">عدد الموظفين</td><td>${allRows().length}</td></tr>`])); }
  function siteLettersPages(selectedKeys) {
    const ns = names();
    return (selectedKeys && selectedKeys.length ? selectedKeys : keys()).map(k => {
      const siteName = ns[k] || k;
      if (window.AdminOfficePrintLetters && typeof window.AdminOfficePrintLetters.buildSiteRaiseLetterForSite === 'function') return window.AdminOfficePrintLetters.buildSiteRaiseLetterForSite({ key: k, siteName, netAmount: siteTotal(k) });
      return page('خطاب رفع الموقع', `نرفق لسعادتكم مستخلص موقع ${esc(siteName)}، ${esc(periodText())}.`, table(['البيان','القيمة'], [`<tr><td class="right">صافي مستحقات الموقع</td><td class="ltr">${money(siteTotal(k))}</td></tr>`]));
    }).join('');
  }
  function selectedCleanSiteKeys() { return Array.from(document.querySelectorAll('#admin-raise-clean .rl-site-check:checked')).map(x => x.value).filter(Boolean); }
  function selectedOneSiteKey() { return document.getElementById('rl-site-select')?.value || readJson(SETTINGS_KEY, {}).siteLetterDefaultCenter || keys()[0]; }

  function printDoc(title, html) { printHtml(title, html); }

  window.AdminOfficesRaiseLetters = window.AdminOfficesRaiseLetters || {};
  const r = window.AdminOfficesRaiseLetters;
  if (typeof r.generateDeclaration !== 'function') r.generateDeclaration = () => printDoc('إقرار عدم أسبقية الصرف', declarationPage());
  if (typeof r.generateLaborRaiseLetter !== 'function') r.generateLaborRaiseLetter = () => printDoc('خطاب الرفع للمستخلص', laborRaisePage());
  if (typeof r.generateSelectedSiteLetters !== 'function') r.generateSelectedSiteLetters = () => printDoc('خطابات المواقع المحددة', siteLettersPages(selectedCleanSiteKeys()));
  if (typeof r.generateSiteRaiseLetter !== 'function') r.generateSiteRaiseLetter = () => printDoc('خطاب الموقع المحدد', siteLettersPages([selectedOneSiteKey()]));

  window.AdminOfficesExtraDocs = window.AdminOfficesExtraDocs || {};
  const e = window.AdminOfficesExtraDocs;
  e.generateFinalFinancialRaiseLetter = e.generateFinalFinancialRaiseLetter || (() => printDoc('خطاب الرفع النهائي', finalRaisePage()));
  e.generateGroupedMonthlyEntitlementCertificate = e.generateGroupedMonthlyEntitlementCertificate || (() => printDoc('شهادة الاستحقاق الشهري المجمعة', groupedCertificatePage()));
  e.generateEntitlementStatement = e.generateEntitlementStatement || (() => printDoc('بيان استحقاق', entitlementPage()));
  e.generateSalaryDeliveryCertificate = e.generateSalaryDeliveryCertificate || (() => printDoc('شهادة تسليم الرواتب', salaryPage()));
  e.generateSaudiOccupiedJobsStatement = e.generateSaudiOccupiedJobsStatement || (() => printDoc('بيان الوظائف المشغولة بالسعوديين', saudiJobsPage()));
  e.generateMonthlyPerformanceCertificates = e.generateMonthlyPerformanceCertificates || (() => printDoc('شهادة الأداء الشهري', performancePage()));
  e.printEditableStatement = e.printEditableStatement || ((type) => printDoc(type === 'vacation' ? 'بيان الإجازات' : 'بيان الغيابات', type === 'vacation' ? vacationPage() : absencePage()));
  e.openEditableStatement = e.openEditableStatement || e.printEditableStatement;
  e.generateFullExtractPrint = e.generateFullExtractPrint || (() => {
    const s = settings();
    const custom = s.includeCustomLetterInFull === 'yes' ? '' : '';
    printDoc('طباعة المستخلص كامل', [finalRaisePage(), declarationPage(), laborRaisePage(), groupedCertificatePage(), entitlementPage(), salaryPage(), saudiJobsPage(), absencePage(), vacationPage(), performancePage(), siteLettersPages(keys()), custom].join(''));
  });

  console.info('[Admin Offices Raise Letters Print Fallbacks] installed v1');
})();
