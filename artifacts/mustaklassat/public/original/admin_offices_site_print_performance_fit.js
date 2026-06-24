// ===================================================================
// Admin Offices Single Site Print + Performance Fit — V3
// Scope: admin_offices_attendance.html
// تعديل داخل الملف الموجود فقط، بدون حارس جديد:
// - زر طباعة الموقع يطبع حزمة الموقع فقط: الحضور والانصراف + جدول تقييم الأداء + شهادة الإنجاز.
// - لا يستدعي printSelected ولا يطبع الشهادة الإجمالية.
// - الحضور يبدأ من أول صفحة بدون صفحة شعار فارغة.
// - جدول الأداء يضغط داخل A4 واحدة: عنوان + جدول كامل + ملخص + تواقيع.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html|original-viewer\?page=admin_offices_attendance\.html/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_SITE_PRINT_PERFORMANCE_FIT_V3__) return;
  window.__ADMIN_OFFICES_SITE_PRINT_PERFORMANCE_FIT_V3__ = true;

  const DATA_KEYS = [
    'adminOfficesAttendanceData_v1',
    'adminOfficesAttendanceData_v1_localBackup',
    'adminOfficesAttendanceData_v1_lastGood',
    'adminOfficesLaborDataSafe_v2',
    'adminOfficesAttendanceData'
  ];

  function readJson(key, fallback) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; } }
  function esc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function clean(v) { return String(v ?? '').replace(/\s+/g, ' ').trim(); }
  function number(v) { const n = Number(String(v ?? '').replace(/,/g, '').replace(/[ ريال﷼]/g, '').trim()); return Number.isFinite(n) ? n : 0; }
  function money(v) { return number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function sar(v) { return money(v) + ' ريال'; }
  function countRows(data) { return Object.values(data || {}).reduce((s, rows) => s + (Array.isArray(rows) ? rows.length : 0), 0); }

  function getNames() {
    try { if (typeof window.getCenterNames === 'function') return window.getCenterNames() || {}; } catch (_) {}
    return readJson('adminOfficeNames_v1', {});
  }
  function getData() {
    const list = [];
    try { if (typeof window.getAttendanceData === 'function') list.push(window.getAttendanceData() || {}); } catch (_) {}
    DATA_KEYS.forEach(k => list.push(readJson(k, {})));
    return list.reduce((best, item) => countRows(item) > countRows(best) ? item : best, {});
  }
  function getPeriod() {
    try { if (typeof window.getExtractPeriodDetails === 'function') return window.getExtractPeriodDetails(); } catch (_) {}
    const e = readJson('persistentExtractData', {});
    const start = new Date(e.extractStart || localStorage.getItem('extractStart') || Date.now());
    const end = new Date(e.extractEnd || localStorage.getItem('extractEnd') || e.extractStart || Date.now());
    const safeStart = Number.isNaN(start.getTime()) ? new Date() : start;
    const safeEnd = Number.isNaN(end.getTime()) ? safeStart : end;
    return {
      startDate: safeStart,
      endDate: safeEnd,
      daysInExtract: Math.max(1, Math.ceil((safeEnd - safeStart) / 86400000) + 1 || 30),
      totalDaysInMonth: new Date(safeStart.getFullYear(), safeStart.getMonth() + 1, 0).getDate() || 30
    };
  }
  function dateText(v) { try { const d = v instanceof Date ? v : new Date(v); return Number.isNaN(d.getTime()) ? 'غير محدد' : d.toLocaleDateString('en-CA'); } catch (_) { return 'غير محدد'; } }
  function monthName() { const p = getPeriod(); try { return p.startDate.toLocaleString('ar-SA-u-nu-latn-ca-gregory', { month: 'long', year: 'numeric' }); } catch (_) { return dateText(p.startDate); } }
  function paymentNo() { const e = readJson('persistentExtractData', {}); const raw = clean(e.paymentNumber || e.extractNumber || localStorage.getItem('paymentNumber') || localStorage.getItem('extractNumber') || '—'); return /^\d+$/.test(raw) ? raw.padStart(3, '0') : raw; }

  function currentCenterKey() {
    try { if (typeof window.getActiveAdminOfficeCenterKey === 'function') return window.getActiveAdminOfficeCenterKey(); } catch (_) {}
    const tab = document.querySelector('.tab-link.active[data-center-key], .center-tab.active[data-center-key], [data-center-key].active');
    if (tab && tab.dataset.centerKey) return tab.dataset.centerKey;
    const visibleTable = Array.from(document.querySelectorAll('[id^="table-div-"]')).find(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    if (visibleTable && visibleTable.id) return visibleTable.id.replace('table-div-', '');
    const title = document.getElementById('center-main-title')?.textContent || document.querySelector('.center-title,.active-center-title')?.textContent || '';
    const names = getNames();
    const match = Object.entries(names).find(([, name]) => title.includes(String(name || '')));
    if (match) return match[0];
    const keys = Object.keys(getData()).filter(k => Array.isArray(getData()[k]));
    return keys.length === 1 ? keys[0] : '';
  }

  function headerFor(centerKey) {
    try { if (typeof window.getHeaderForCenter === 'function') return window.getHeaderForCenter(centerKey); } catch (_) {}
    return { logoSrc: 'moh_logo.png', h1: 'فرع وزارة الصحة بمنطقة نجران', h3: 'المكاتب الإدارية والمرافق الصحية' };
  }
  function signatures(type) {
    try { if (typeof window.getSignatures === 'function') return window.getSignatures(type) || []; } catch (_) {}
    return [];
  }
  function signatureBlock(type, className) {
    let sigs = signatures(type);
    if (!sigs.length) sigs = [{ title: 'إعداد', name: '........................' }, { title: 'مراجعة', name: '........................' }, { title: 'اعتماد', name: '........................' }];
    return `<div class="${className || 'signatures'}">${sigs.map(sig => `<div class="sign-item"><div class="sig-title">${esc(sig.title || '')}</div><div class="sig-line"></div><div class="sig-name">${esc(sig.name || '........................')}</div></div>`).join('')}</div>`;
  }
  function contractLine(centerName) {
    const c = readJson('persistentContractData', {}), e = readJson('persistentExtractData', {});
    const company = c.contractorName || c.companyName || c.company || localStorage.getItem('companyName') || 'غير محدد';
    return `المكتب/المرفق: ${esc(centerName)} | اسم الشركة: ${esc(company)} | مدة المستخلص: من ${esc(dateText(e.extractStart || getPeriod().startDate))} إلى ${esc(dateText(e.extractEnd || getPeriod().endDate))} | رقم الدفعة: ${esc(paymentNo())}`;
  }
  function isAbsence(code) { try { return !!(window.STATUS_CODES && window.STATUS_CODES[code] && window.STATUS_CODES[code].isAbsence); } catch (_) { return code === 'غ'; } }
  function fineConfig(category) { try { return (window.ABSENCE_FINES_BY_CATEGORY && (window.ABSENCE_FINES_BY_CATEGORY[category] || window.ABSENCE_FINES_BY_CATEGORY.default)) || { saudi: 0, non_saudi: 0 }; } catch (_) { return { saudi: 0, non_saudi: 0 }; } }
  function isSaudi(nat) { nat = String(nat || ''); return nat.includes('سعودي') && !nat.includes('غير'); }

  function employeeCalc(emp) {
    const p = getPeriod();
    try {
      if (typeof window.calculateAdminOfficeEmployeeFinancials === 'function') {
        const c = window.calculateAdminOfficeEmployeeFinancials(emp, { totalDaysInMonth: p.totalDaysInMonth, daysInExtract: p.daysInExtract });
        return {
          days: Array.isArray(c.days) ? c.days : normalizeDays(emp.days),
          cost: number(c.costForPeriod), attendance: number(c.attendanceDays), absence: number(c.absenceDays),
          deduction: number(c.deduction), absenceFine: number(c.absenceFine), net: number(c.netSalary), nationalityFine: number(c.nationalityFine)
        };
      }
    } catch (_) {}
    const days = normalizeDays(emp.days);
    const salary = number(emp.salary);
    const daily = p.totalDaysInMonth > 0 ? salary / p.totalDaysInMonth : 0;
    const cost = daily * p.daysInExtract;
    const absence = days.filter(isAbsence).length;
    const attendance = p.daysInExtract - absence;
    const deduction = absence * daily;
    const fines = fineConfig(emp.category);
    const absenceFine = absence * (isSaudi(emp.nationality) ? number(fines.saudi) : number(fines.non_saudi));
    const nationalityFine = number(emp.nationalityFine);
    return { days, cost, attendance, absence, deduction, absenceFine, nationalityFine, net: cost - deduction - absenceFine - nationalityFine };
  }
  function normalizeDays(days) {
    const p = getPeriod();
    const arr = Array.isArray(days) ? days.slice(0, p.daysInExtract) : [];
    while (arr.length < p.daysInExtract) arr.push('ح');
    return arr;
  }

  function buildAttendancePage(centerKey) {
    const data = getData();
    const rows = Array.isArray(data[centerKey]) ? data[centerKey] : [];
    const names = getNames();
    const centerName = names[centerKey] || centerKey;
    const p = getPeriod();
    const ch = headerFor(centerKey);
    let totalCost = 0, totalDed = 0, totalFine = 0, totalNet = 0;
    const dayHeads = Array.from({ length: p.daysInExtract }, (_, i) => `<th class="day-col">${i + 1}</th>`).join('');
    const body = rows.map((emp, idx) => {
      const c = employeeCalc(emp);
      totalCost += c.cost; totalDed += c.deduction; totalFine += c.absenceFine + c.nationalityFine; totalNet += c.net;
      return `<tr><td class="seq">${idx + 1}</td><td class="job">${esc(emp.jobTitle || '')}</td><td class="cat">${esc(emp.category || '')}</td><td class="emp">${esc(emp.name || '')}</td>${c.days.map(d => `<td class="day">${esc(d)}</td>`).join('')}<td>${money(c.cost)}</td><td>${c.attendance}</td><td>${c.absence}</td><td>${money(c.deduction)}</td><td>${money(c.absenceFine)}</td><td>${money(c.net)}</td><td>${esc(emp.nationality || '')}</td><td>${money(c.nationalityFine)}</td><td>${esc(emp.iqamaId || '')}</td></tr>`;
    }).join('');
    return `<section class="site-page site-attendance-page"><div class="site-attendance report-box"><div class="mini-header"><img src="${esc(ch.logoSrc || 'moh_logo.png')}"><div><h1>${esc(ch.h1 || '')}</h1><h2>بيان الحضور والانصراف - ${esc(centerName)}</h2><p>${contractLine(centerName)}</p></div><img src="${esc(ch.logoSrc || 'moh_logo.png')}"></div><div class="att-summary"><b>عدد الموظفين:</b> ${rows.length} <b>التكلفة:</b> ${money(totalCost)} <b>الحسم:</b> ${money(totalDed)} <b>الغرامات:</b> ${money(totalFine)} <b>الصافي:</b> ${money(totalNet)}</div><table class="attendance-table"><thead><tr><th rowspan="2">م</th><th rowspan="2" class="job">مسمى الوظيفة</th><th rowspan="2">الفئة</th><th rowspan="2" class="emp">اسم شاغل الوظيفة</th><th colspan="${p.daysInExtract}">الأيام</th><th rowspan="2">التكلفة</th><th colspan="2">عدد الأيام</th><th colspan="2">حسم وغرامة الغياب</th><th rowspan="2">صافي الاستحقاق</th><th rowspan="2">الجنسية</th><th rowspan="2">غرامة جنسية</th><th rowspan="2">رقم الإقامة/الهوية</th></tr><tr>${dayHeads}<th>حضور</th><th>غياب</th><th>الحسم</th><th>الغرامة</th></tr></thead><tbody>${body}</tbody></table>${signatureBlock('attendance', 'attendance-signatures')}</div></section>`;
  }

  function performanceItems() {
    try { if (typeof window.getDynamicPerformanceItems === 'function') return window.getDynamicPerformanceItems() || []; } catch (_) {}
    return readJson('adminOfficePerformanceItems_v1', []);
  }
  function performanceScores(centerKey) {
    try { if (typeof window.getPerformanceData === 'function') return (window.getPerformanceData() || {})[centerKey] || {}; } catch (_) {}
    return (readJson('performanceData_v4', {})[centerKey] || readJson('performanceData', {})[centerKey] || {});
  }
  function centerCost(centerKey) {
    try { if (typeof window.calculateCenterTotalCost === 'function') return number(window.calculateCenterTotalCost(centerKey)); } catch (_) {}
    const rows = getData()[centerKey] || [];
    return rows.reduce((s, emp) => s + employeeCalc(emp).cost, 0);
  }
  function buildPerformancePage(centerKey) {
    const names = getNames();
    const centerName = names[centerKey] || centerKey;
    const items = performanceItems();
    const scores = performanceScores(centerKey);
    let maxTotal = 0, scoreTotal = 0;
    const body = items.map((item, i) => {
      const max = number(item.max || item.maxScore || item.degree || 0);
      const score = scores[i] !== undefined ? number(scores[i]) : max;
      maxTotal += max; scoreTotal += score;
      return `<tr><td>${i + 1}</td><td class="item-text">${esc(item.text || item.name || item.title || '')}</td><td>${max}</td><td>${score}</td></tr>`;
    }).join('') + `<tr class="perf-total"><td colspan="2">المجموع</td><td>${maxTotal}</td><td>${scoreTotal}</td></tr>`;
    const pct = maxTotal > 0 ? scoreTotal / maxTotal * 100 : 100;
    let deductionPct = 0;
    if (pct < 60) deductionPct = 15; else if (pct < 65) deductionPct = 10; else if (pct < 70) deductionPct = 8; else if (pct < 75) deductionPct = 6; else if (pct < 80) deductionPct = 4; else if (pct < 85) deductionPct = 2;
    const cost = centerCost(centerKey);
    const deduction = cost * deductionPct / 100;
    return `<section class="site-page site-performance-page"><div class="site-performance report-box"><div class="perf-title">جدول تقييم مستوى الأداء والإنجاز</div><div class="perf-subtitle">لموقع: ${esc(centerName)} - عن شهر ${esc(monthName())}</div><div class="perf-cost">إجمالي المبلغ لأنشطة القسم (تكلفة العمالة): <b>${money(cost)}</b> ريال</div><table class="performance-table"><thead><tr><th>م</th><th>أنشطة القسم</th><th>الدرجة القصوى</th><th>التقدير</th></tr></thead><tbody>${body}</tbody></table><div class="perf-summary">إجمالي المبلغ لأنشطة القسم = <b>${money(cost)}</b> ريال &nbsp; | &nbsp; التقدير الذي حصل عليه المقاول: <b>${pct.toFixed(2)}%</b> &nbsp; | &nbsp; نسبة الحسم: <b>${deductionPct}%</b> ويساوي <b>${money(deduction)}</b> ريال</div>${signatureBlock('performance', 'performance-signatures')}</div></section>`;
  }

  function tafqitSafe(v) { try { if (typeof window.tafqit === 'function') return window.tafqit(v); } catch (_) {} return sar(v); }
  function achievementTitles() { try { if (typeof window.getAchievementTitles === 'function') return window.getAchievementTitles() || {}; } catch (_) {} return { mainTitle: 'شهادة الإنجاز', subTitle: 'أعمال النظافة والصيانة والتشغيل غير الطبي' }; }
  function calcAchievement(centerKey) {
    const rows = getData()[centerKey] || [];
    let monthly = 0, absenceDeduct = 0, absencePenalty = 0, nationPenalty = 0;
    rows.forEach(emp => {
      const c = employeeCalc(emp);
      monthly += c.cost;
      absenceDeduct += c.deduction;
      absencePenalty += c.absenceFine;
      nationPenalty += c.nationalityFine;
    });
    const perf = number((readJson('adminOfficePerformanceDeductions_v1', {})[centerKey] !== undefined ? readJson('adminOfficePerformanceDeductions_v1', {})[centerKey] : readJson('performanceDeductions', {})[centerKey]));
    return { monthly, absenceDeduct, absencePenalty, perf, nationPenalty, net: monthly - absenceDeduct - absencePenalty - perf - nationPenalty };
  }
  function buildAchievementPage(centerKey) {
    const names = getNames();
    const centerName = names[centerKey] || centerKey;
    const titles = achievementTitles();
    const a = calcAchievement(centerKey);
    return `<section class="site-page site-achievement-page"><div class="site-achievement report-box"><h1>${esc(titles.mainTitle || 'شهادة الإنجاز')}</h1><h2>${esc(titles.subTitle || 'أعمال النظافة والصيانة والتشغيل غير الطبي')}</h2><h3>لموقع: ${esc(centerName)} - عن شهر ${esc(monthName())}</h3><table class="achievement-table"><thead><tr><th>البند</th><th>القيمة الشهرية</th><th>حسم الغياب</th><th>غرامة الغياب</th><th>غرامة الأداء</th><th>غرامة الجنسية</th><th>الصافي الشهري</th></tr></thead><tbody><tr><td>العمالة</td><td>${sar(a.monthly)}</td><td>${sar(a.absenceDeduct)}</td><td>${sar(a.absencePenalty)}</td><td>${sar(a.perf)}</td><td>${sar(a.nationPenalty)}</td><td><b>${sar(a.net)}</b></td></tr><tr class="total-row"><td colspan="6">إجمالي المستحق للمقاول</td><td><b>${sar(a.net)}</b></td></tr><tr class="tafqit-row"><td colspan="7">فقط وقدره: ${esc(tafqitSafe(a.net))}</td></tr></tbody></table>${signatureBlock('achievement', 'achievement-signatures')}</div></section>`;
  }

  function printCss() {
    return `<style>
      @page site-landscape{size:A4 landscape;margin:2.8mm}
      @page site-portrait{size:A4 portrait;margin:4mm}
      *{box-sizing:border-box} body{margin:0;background:#fff;direction:rtl;font-family:Tajawal,Arial,sans-serif;color:#111;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
      .toolbar{position:sticky;top:0;background:#0f172a;color:#fff;text-align:center;padding:8px;z-index:5}.toolbar button{border:0;border-radius:9px;padding:8px 16px;margin:0 4px;background:#d4af37;font-weight:900;cursor:pointer}
      .site-page{break-after:page;page-break-after:always;margin:0;padding:0;background:#fff}.report-box{width:100%;margin:0;padding:0;overflow:visible}
      .site-attendance-page{page:site-landscape}.site-attendance{padding:0}.mini-header{display:flex;align-items:center;justify-content:space-between;gap:6px;border-bottom:1px solid #9ca3af;margin:0 0 2px;padding:0 0 2px}.mini-header img{width:28px;height:28px;object-fit:contain}.mini-header div{flex:1;text-align:center}.mini-header h1{font-size:7pt;margin:0;line-height:1}.mini-header h2{font-size:8pt;margin:0;line-height:1.05;color:#003087}.mini-header p{font-size:5.8pt;margin:1px 0 0;line-height:1.1;color:#334155}.att-summary{font-size:6pt;background:#eef2f7;border:1px solid #cbd5e1;border-radius:3px;padding:1px 3px;margin:0 0 1px;text-align:center;line-height:1.15}.attendance-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:4.55pt;margin:0;break-before:auto;page-break-before:auto}.attendance-table thead{display:table-header-group}.attendance-table tr{break-inside:avoid;page-break-inside:avoid}.attendance-table th,.attendance-table td{border:1px solid #222;padding:.45px .7px;text-align:center;vertical-align:middle;line-height:1.02;white-space:nowrap}.attendance-table th{background:#003087;color:#fff;font-weight:900}.attendance-table .seq{width:5mm}.attendance-table .job{width:17mm;white-space:normal;overflow-wrap:anywhere}.attendance-table .cat{width:5mm}.attendance-table .emp{width:19mm;white-space:normal;overflow-wrap:anywhere}.attendance-table .day-col,.attendance-table .day{width:4.1mm;color:#0056b3;font-weight:800}.attendance-signatures{display:flex;justify-content:space-around;gap:6mm;margin-top:2mm;border-top:1px solid #222;padding-top:1.5mm}.attendance-signatures .sign-item{text-align:center;width:30%;font-size:6pt}.attendance-signatures .sig-line{height:7mm;border-bottom:1px solid #111;margin:1mm 6mm}
      .site-performance-page{page:site-portrait}.site-performance{height:289mm;max-height:289mm;padding:0;display:flex;flex-direction:column;overflow:hidden}.perf-title{text-align:center;font-size:11pt;font-weight:900;color:#111;margin:0 0 .7mm;line-height:1.05}.perf-subtitle{text-align:center;font-size:7.5pt;font-weight:800;margin:0 0 .7mm;line-height:1.05}.perf-cost{font-size:7pt;background:#eef2f7;border:1px solid #cbd5e1;border-radius:4px;text-align:center;padding:1.2mm;margin:0 0 .8mm;line-height:1}.performance-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:5.1pt;margin:0;flex:1 1 auto}.performance-table th,.performance-table td{border:1px solid #222;padding:.55px 1px;text-align:center;vertical-align:middle;line-height:.98}.performance-table th{background:#e5e7eb;font-weight:900}.performance-table th:nth-child(1),.performance-table td:nth-child(1){width:6%}.performance-table th:nth-child(2),.performance-table td:nth-child(2){width:66%;text-align:right;white-space:normal;overflow-wrap:anywhere}.performance-table th:nth-child(3),.performance-table td:nth-child(3),.performance-table th:nth-child(4),.performance-table td:nth-child(4){width:14%}.performance-table .perf-total td{background:#f3f4f6;font-weight:900}.perf-summary{font-size:6.7pt;line-height:1.15;text-align:center;background:#f8fafc;border:1px solid #e5e7eb;border-radius:4px;padding:1.4mm;margin:.8mm 0 .6mm;flex:0 0 auto}.performance-signatures{display:flex;justify-content:space-around;gap:4mm;border-top:1px solid #111;padding-top:1.5mm;margin-top:auto;flex:0 0 auto}.performance-signatures .sign-item{width:30%;text-align:center;font-size:7pt;font-weight:800}.performance-signatures .sig-line{height:8mm;border-bottom:1px solid #111;margin:1mm 5mm}
      .site-achievement-page{page:site-portrait}.site-achievement{min-height:288mm;padding:10mm 8mm;display:flex;flex-direction:column;justify-content:center}.site-achievement h1{text-align:center;color:#003087;font-size:18pt;margin:0 0 5mm}.site-achievement h2,.site-achievement h3{text-align:center;font-size:11pt;margin:1.5mm 0}.achievement-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:9pt;margin:10mm 0}.achievement-table th,.achievement-table td{border:1px solid #222;padding:6px;text-align:center}.achievement-table th{background:#e5e7eb}.achievement-table .total-row td,.achievement-table .tafqit-row td{background:#f3f4f6;font-weight:900}.achievement-signatures{display:flex;justify-content:space-around;gap:8mm;margin-top:18mm}.achievement-signatures .sign-item{width:30%;text-align:center;font-size:10pt}.achievement-signatures .sig-line{height:18mm;border-bottom:1px solid #111;margin:3mm 6mm}
      @media print{.toolbar{display:none!important}.site-page:last-child{break-after:auto;page-break-after:auto}}
    </style>`;
  }

  function printCurrentSiteBundle(centerKey) {
    centerKey = centerKey || currentCenterKey();
    if (!centerKey) return alert('لم يتم تحديد الموقع الحالي للطباعة. افتح الموقع من القائمة ثم اطبع.');
    const names = getNames(), centerName = names[centerKey] || centerKey;
    const html = buildAttendancePage(centerKey) + buildPerformancePage(centerKey) + buildAchievementPage(centerKey);
    const win = window.open('', '_blank', 'width=1200,height=900');
    if (!win) return alert('المتصفح منع نافذة الطباعة. اسمح بالنوافذ المنبثقة.');
    win.document.open();
    win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>طباعة موقع - ${esc(centerName)}</title><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">${printCss()}</head><body><div class="toolbar"><button onclick="window.print()">طباعة</button><button onclick="window.close()">إغلاق</button></div>${html}</body></html>`);
    win.document.close();
    setTimeout(function () { try { win.focus(); win.print(); } catch (_) {} }, 550);
  }

  function installSitePrintButton() {
    const view = document.getElementById('center-details-view');
    if (!view || view.style.display === 'none') return;
    const header = view.querySelector('.center-header-container') || view.querySelector('.center-header') || view.querySelector('.section-header');
    if (!header) return;
    let btn = document.getElementById('admin-single-site-main-print-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'admin-single-site-main-print-btn';
      btn.className = 'back-button';
      btn.style.cssText = 'background:#0f766e;margin-inline-start:8px;';
      header.appendChild(btn);
    }
    btn.innerHTML = '<i class="fas fa-print"></i> طباعة الموقع: حضور + أداء + إنجاز';
    btn.title = 'يطبع للموقع الحالي فقط: الحضور والانصراف، جدول تقييم الأداء، شهادة الإنجاز. لا يطبع الشهادة الإجمالية.';
    btn.onclick = function () { printCurrentSiteBundle(currentCenterKey()); };
  }

  function patchPerSitePrintNames() {
    const fn = function () { return printCurrentSiteBundle(currentCenterKey()); };
    window.printCurrentAdminOfficeAttendanceLikeMain = fn;
    window.preparePrint = fn;
    window.printCurrentAttendanceTable = fn;
    window.printCurrentAdminOfficeAttendance = fn;
    window.printCurrentSiteAttendance = fn;
    window.printAdminOfficeCurrentSiteBundle = fn;
  }

  function boot() {
    patchPerSitePrintNames();
    installSitePrintButton();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  let tries = 0;
  const timer = setInterval(function () { tries++; boot(); if (tries >= 60) clearInterval(timer); }, 250);
  document.addEventListener('click', function () { setTimeout(boot, 80); setTimeout(boot, 350); setTimeout(boot, 900); }, true);

  window.AdminOfficesSitePrintPerformanceFit = {
    printCurrentSiteBundle: function () { return printCurrentSiteBundle(currentCenterKey()); },
    printCurrentAttendance: function () { return printCurrentSiteBundle(currentCenterKey()); },
    printOneCenterLikeMain: printCurrentSiteBundle
  };
  console.info('[Admin Offices Site Print + Performance Fit] installed v3 — direct site bundle only');
})();