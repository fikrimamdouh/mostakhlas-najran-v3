// Final admin offices page patch
// Scope: admin_offices_attendance.html only
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html/.test(location.href)) return;

  const ABSENCE_FINES = {
    1: { saudi: 300, non_saudi: 300 },
    2: { saudi: 250, non_saudi: 250 },
    3: { saudi: 100, non_saudi: 100 },
    4: { saudi: 80, non_saudi: 50 },
    5: { saudi: 80, non_saudi: 50 },
    6: { saudi: 50, non_saudi: 20 },
    7: { saudi: 10, non_saudi: 10 },
    default: { saudi: 0, non_saudi: 0 }
  };

  const STATUS = {
    'ح': { name: 'حاضر', isAbsence: false },
    'غ': { name: 'غائب', isAbsence: true },
    'ج': { name: 'إجازة', isAbsence: false },
    'ش': { name: 'شاغرة', isAbsence: false },
    'ت': { name: 'تحت الإجراء', isAbsence: false },
    'ب': { name: 'قبل بدء العقد', isAbsence: false },
    'ن': { name: 'بعد نهاية العقد', isAbsence: false }
  };

  function readJson(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch (_) { return fallback; }
  }

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function money(value) {
    return (Number(value) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function getNames() {
    try { if (typeof getCenterNames === 'function') return getCenterNames() || {}; } catch (_) {}
    return readJson('adminOfficeNames_v1', {});
  }

  function getData() {
    try { if (typeof getAttendanceData === 'function') return getAttendanceData() || {}; } catch (_) {}
    return readJson('adminOfficesAttendanceData_v1', {});
  }

  function saveData(data) {
    try { if (typeof saveAttendanceData === 'function') return saveAttendanceData(data); } catch (_) {}
    localStorage.setItem('adminOfficesAttendanceData_v1', JSON.stringify(data || {}));
  }

  function getPeriod() {
    try { if (typeof getExtractPeriodDetails === 'function') return getExtractPeriodDetails(); } catch (_) {}
    const extract = readJson('persistentExtractData', {});
    const start = new Date(extract.extractStart || new Date());
    const end = new Date(extract.extractEnd || new Date());
    const days = Math.max(1, Math.ceil((end - start) / 86400000) + 1 || 30);
    return { startDate: start, daysInExtract: days, totalDaysInMonth: new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate() || 30 };
  }

  function getContract() {
    return readJson('persistentContractData', {});
  }

  function getExtract() {
    return readJson('persistentExtractData', {});
  }

  function isSaudi(nationality) {
    return String(nationality || '').replace(/\s+/g, '').includes('سعودي');
  }

  function statusMeta(code) {
    return STATUS[code] || { name: code || '', isAbsence: false };
  }

  function fineConfig(category) {
    return ABSENCE_FINES[category] || ABSENCE_FINES[String(category)] || ABSENCE_FINES.default;
  }

  function employeeCalc(emp, daysCount, totalDaysInMonth, contract) {
    const days = Array.isArray(emp.days) ? emp.days.slice(0, daysCount) : [];
    while (days.length < daysCount) days.push('ح');
    const salary = Number(emp.salary) || 0;
    const daily = totalDaysInMonth > 0 ? salary / totalDaysInMonth : 0;
    let cost = daily * daysCount;
    const ratio = Number(contract.directPurchaseRatio) || 0;
    if (contract.contractType === 'شراء مباشر' && ratio > 0) cost += cost * ratio / 100;

    let attendance = 0;
    let absence = 0;
    days.forEach(code => statusMeta(code).isAbsence ? absence++ : attendance++);

    const absenceDeduction = absence * daily;
    const cfg = fineConfig(emp.category);
    const absenceFine = absence * (isSaudi(emp.nationality) ? cfg.saudi : cfg.non_saudi);
    const nationalityFine = Number(emp.nationalityFine) || 0;
    const fines = absenceFine + nationalityFine;
    const net = cost - absenceDeduction - fines;

    return { days, cost, attendance, absence, absenceDeduction, absenceFine, nationalityFine, fines, net };
  }

  function officeCalc(centerKey) {
    const data = getData();
    const rows = Array.isArray(data[centerKey]) ? data[centerKey] : [];
    const period = getPeriod();
    const contract = getContract();
    const out = { count: rows.length, cost: 0, absenceDeduction: 0, absenceFine: 0, nationalityFine: 0, fines: 0, net: 0 };
    rows.forEach(emp => {
      const c = employeeCalc(emp, period.daysInExtract || 30, period.totalDaysInMonth || 30, contract);
      out.cost += c.cost;
      out.absenceDeduction += c.absenceDeduction;
      out.absenceFine += c.absenceFine;
      out.nationalityFine += c.nationalityFine;
      out.fines += c.fines;
      out.net += c.net;
    });
    return out;
  }

  function formatDate(value) {
    try { return value ? new Date(value).toLocaleDateString('en-CA') : 'غير محدد'; }
    catch (_) { return 'غير محدد'; }
  }

  function orderedKeys() {
    const names = getNames();
    return Object.keys(names).sort((a, b) => {
      if (a.startsWith('center_') && b.startsWith('center_')) return parseInt(a.split('_')[1], 10) - parseInt(b.split('_')[1], 10);
      if (a.startsWith('center_')) return -1;
      if (b.startsWith('center_')) return 1;
      return a.localeCompare(b);
    });
  }

  function getHeader(centerKey) {
    try { if (typeof getHeaderForCenter === 'function') return getHeaderForCenter(centerKey); } catch (_) {}
    return { logoSrc: 'najran_health_cluster_logo.png', h1: 'فرع وزارة الصحة بمنطقة نجران', h3: 'المكاتب الإدارية' };
  }

  // 1) Fix page grand totals: fines must include absence fines + nationality fines.
  window.calculateAndDisplayGrandTotal = function calculateAndDisplayGrandTotalFinal() {
    const keys = Object.keys(getData());
    const total = { count: 0, cost: 0, absenceDeduction: 0, fines: 0, net: 0 };
    keys.forEach(key => {
      const c = officeCalc(key);
      total.count += c.count;
      total.cost += c.cost;
      total.absenceDeduction += c.absenceDeduction;
      total.fines += c.fines;
      total.net += c.net;
    });

    const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    set('grand-total-count', String(total.count));
    set('grand-total-cost', money(total.cost));
    set('grand-total-deduction', money(total.absenceDeduction));
    set('grand-total-fines', money(total.fines));
    set('grand-net-total', money(total.net));
    localStorage.setItem('grand-net-total-admin', money(total.net));
  };
  window.updateGrandTotal = window.calculateAndDisplayGrandTotal;

  // 2) Bulk attendance for all office employees from management panel.
  function installBulkAttendanceButton() {
    const footer = document.getElementById('management-footer-v3');
    if (!footer || footer.querySelector('#admin-bulk-attendance-all-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'admin-bulk-attendance-all-btn';
    btn.className = 'btn btn-primary';
    btn.style.marginInlineStart = '8px';
    btn.innerHTML = '<i class="fas fa-calendar-check"></i> تعديل جماعي للحضور';
    btn.onclick = function () {
      const key = window.activeCenterKeyForManagement;
      if (!key) return alert('اختر الموقع أولاً من القائمة.');
      if (typeof window.openBulkAttendanceForm === 'function') return window.openBulkAttendanceForm(key, null);
      openBulkAttendanceFallback(key, null);
    };
    footer.prepend(btn);
  }

  function openBulkAttendanceFallback(centerKey, empIndex) {
    const period = getPeriod();
    const rows = getData()[centerKey] || [];
    const emp = empIndex !== null && empIndex !== undefined ? rows[empIndex] : null;
    const target = emp ? `للموظف: ${emp.name}` : `لجميع موظفي الموقع`;
    const statusOptions = Object.keys(STATUS).map(code => `<option value="${code}">${STATUS[code].name} (${code})</option>`).join('');
    const html = `<div class="dialog-header"><h3><i class="fas fa-calendar-alt"></i> تعديل الحضور لفترة محددة</h3><span class="close" onclick="closeDialog('form-dialog')">×</span></div><div class="dialog-body"><p class="info-text">اختر الحالة ونطاق الأيام لتطبيقها <strong>${target}</strong>.</p><div class="form-group"><label>الحالة الجديدة:</label><select id="bulk-status-select">${statusOptions}</select></div><fieldset><legend>تحديد نطاق الأيام</legend><div class="form-group-inline"><div class="form-group"><label>من يوم:</label><input type="number" id="bulk-day-start" value="1" min="1" max="${period.daysInExtract}"></div><div class="form-group"><label>إلى يوم:</label><input type="number" id="bulk-day-end" value="${period.daysInExtract}" min="1" max="${period.daysInExtract}"></div></div></fieldset></div><div class="dialog-footer"><button class="btn btn-secondary" onclick="closeDialog('form-dialog')">إلغاء</button><button class="btn btn-success" onclick="applyBulkAttendance('${centerKey}', ${empIndex === null || empIndex === undefined ? 'null' : empIndex})"><i class="fas fa-check"></i> تطبيق التغييرات</button></div>`;
    if (typeof openDialog === 'function') openDialog(html, 'form-dialog', false);
  }

  window.openBulkAttendanceForm = window.openBulkAttendanceForm || openBulkAttendanceFallback;

  const oldApplyBulk = window.applyBulkAttendance;
  window.applyBulkAttendance = function applyBulkAttendanceFinal(centerKey, empIndex) {
    const newStatus = document.getElementById('bulk-status-select')?.value || 'ح';
    const startDay = parseInt(document.getElementById('bulk-day-start')?.value, 10);
    const endDay = parseInt(document.getElementById('bulk-day-end')?.value, 10);
    if (isNaN(startDay) || isNaN(endDay) || startDay > endDay || startDay < 1) return alert('الرجاء إدخال نطاق أيام صحيح.');

    const data = getData();
    if (!Array.isArray(data[centerKey])) data[centerKey] = [];
    const rows = empIndex !== null && empIndex !== undefined ? [data[centerKey][empIndex]].filter(Boolean) : data[centerKey];
    if (!rows.length) return alert('لا توجد عمالة لتعديل حضورها.');
    const site = getNames()[centerKey] || centerKey;
    const desc = empIndex !== null && empIndex !== undefined ? `الموظف "${rows[0].name}"` : `جميع موظفي موقع "${site}"`;
    if (!confirm(`هل تريد تغيير حالة ${desc} إلى "${STATUS[newStatus]?.name || newStatus}" من يوم ${startDay} إلى يوم ${endDay}؟`)) return;

    rows.forEach(emp => {
      if (!Array.isArray(emp.days)) emp.days = [];
      for (let i = startDay - 1; i <= endDay - 1; i++) emp.days[i] = newStatus;
    });
    saveData(data);
    try { if (typeof showSuccessMessage === 'function') showSuccessMessage('تم تطبيق التعديل الجماعي للحضور.'); } catch (_) {}
    try { if (typeof closeDialog === 'function') closeDialog('form-dialog'); } catch (_) {}
    try { if (typeof displayEmployeesForCenter === 'function' && window.activeCenterKeyForManagement) displayEmployeesForCenter(window.activeCenterKeyForManagement); } catch (_) {}
    try { if (typeof showCenterDetails === 'function') showCenterDetails(centerKey); } catch (_) {}
    window.calculateAndDisplayGrandTotal();
  };

  // 3) Clean professional table print for current office and grouped print.
  function buildAttendancePage(centerKey) {
    const names = getNames();
    const rows = getData()[centerKey] || [];
    const site = names[centerKey] || centerKey;
    const period = getPeriod();
    const extract = getExtract();
    const contract = getContract();
    const header = getHeader(centerKey);
    const start = period.startDate ? new Date(period.startDate) : new Date(extract.extractStart || new Date());
    const daysCount = period.daysInExtract || 30;
    const company = contract.companyName || document.querySelector('.companyName')?.textContent || 'الشركة';

    let daysHead = '';
    for (let i = 0; i < daysCount; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      daysHead += `<th class="day-cell">${d.getDate()}</th>`;
    }

    let totals = { cost: 0, absDed: 0, absFine: 0, natFine: 0, net: 0 };
    const body = rows.length ? rows.map((emp, idx) => {
      const c = employeeCalc(emp, daysCount, period.totalDaysInMonth || 30, contract);
      totals.cost += c.cost; totals.absDed += c.absenceDeduction; totals.absFine += c.absenceFine; totals.natFine += c.nationalityFine; totals.net += c.net;
      return `<tr><td>${idx + 1}</td><td class="job-title">${esc(emp.jobTitle)}</td><td>${esc(emp.category)}</td><td class="employee-name">${esc(emp.name)}</td>${c.days.map(x => `<td class="day-cell ${x === 'غ' ? 'absent' : 'present'}">${esc(x)}</td>`).join('')}<td>${money(c.cost)}</td><td>${c.attendance}</td><td>${c.absence}</td><td>${money(c.absenceDeduction)}</td><td>${money(c.absenceFine)}</td><td>${money(c.net)}</td><td>${esc(emp.nationality)}</td><td>${money(c.nationalityFine)}</td><td>${esc(emp.iqamaId)}</td></tr>`;
    }).join('') : `<tr><td colspan="${14 + daysCount}">لا توجد عمالة في هذا الموقع.</td></tr>`;

    return `<section class="print-page"><div class="print-header"><img src="${esc(header.logoSrc)}" class="logo logo-r"><img src="${esc(header.logoSrc)}" class="logo logo-l"><h1>${esc(header.h1)}</h1><h2>مستخلص العمالة للمكاتب الإدارية والمرافق الصحية</h2><h3>${esc(header.h3 || 'المكاتب الإدارية')}</h3><div class="subtitle">بيان بالحضور والغياب لمنسوبي ${esc(company)} بموقع (${esc(site)})</div><div class="period">الفترة من ${esc(formatDate(extract.extractStart))} إلى ${esc(formatDate(extract.extractEnd))}</div></div><div class="summary-line"><span>عدد العمالة: ${rows.length}</span><span>التكلفة: ${money(totals.cost)}</span><span>حسم الغياب: ${money(totals.absDed)}</span><span>غرامة الغياب: ${money(totals.absFine)}</span><span>غرامة الجنسية: ${money(totals.natFine)}</span><span>الصافي: ${money(totals.net)}</span></div><table><thead><tr><th rowspan="2">م</th><th rowspan="2">مسمى الوظيفة</th><th rowspan="2">الفئة</th><th rowspan="2">اسم شاغل الوظيفة</th><th colspan="${daysCount}">الأيام</th><th rowspan="2">التكلفة للفترة</th><th colspan="2">عدد الأيام</th><th colspan="2">حسم وغرامة الغياب</th><th rowspan="2">صافي الاستحقاق</th><th rowspan="2">الجنسية</th><th rowspan="2">غرامة جنسية</th><th rowspan="2">رقم الإقامة/الهوية</th></tr><tr>${daysHead}<th>حضور</th><th>غياب</th><th>الحسم</th><th>غرامة الغياب</th></tr></thead><tbody>${body}</tbody></table></section>`;
  }

  function printCss() {
    return `<style>@page{size:A4 landscape;margin:6mm}*{box-sizing:border-box}body{font-family:Tajawal,Arial,sans-serif;direction:rtl;margin:0;color:#111;background:#fff}.print-page{page-break-after:always}.print-page:last-child{page-break-after:auto}.print-header{text-align:center;position:relative;margin-bottom:12px;border-bottom:3px solid #003087;padding:8px 90px 10px}.logo{position:absolute;top:6px;width:70px;height:auto}.logo-r{right:10px}.logo-l{left:10px}.print-header h1{margin:0;color:#003087;font-size:21px;font-weight:800}.print-header h2{margin:4px 0;color:#111;font-size:17px}.print-header h3{margin:0;color:#475569;font-size:14px}.subtitle{margin-top:8px;color:#0f172a;font-size:18px;font-weight:800}.period{font-size:13px;color:#475569;margin-top:3px}.summary-line{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;background:#eef6ff;border:1px solid #bfdbfe;border-radius:10px;padding:8px;margin:8px 0 10px}.summary-line span{font-weight:800;color:#003087;background:#fff;border:1px solid #dbeafe;border-radius:8px;padding:5px 10px}table{width:100%;border-collapse:collapse;font-size:12px;table-layout:auto}th,td{border:1px solid #333;padding:4px 5px;text-align:center;white-space:nowrap}th{background:#003087!important;color:#fff!important}.day-cell{min-width:18px}.job-title,.employee-name{max-width:120px;overflow:hidden;text-overflow:ellipsis}.present{color:#0369a1;font-weight:800}.absent{color:#dc2626;font-weight:800}@media print{body{zoom:50%}tr,td,th{page-break-inside:avoid}}</style>`;
  }

  function printPages(pages, title) {
    const win = window.open('', '', 'width=1280,height=900');
    if (!win) return alert('المتصفح منع نافذة الطباعة. اسمح بالنوافذ المنبثقة.');
    win.document.open();
    win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>${esc(title || 'طباعة')}</title><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">${printCss()}</head><body>${pages.join('')}</body></html>`);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 500);
  }

  window.printAdminOfficeTableClean = function printAdminOfficeTableClean(centerKey) {
    if (!centerKey) centerKey = detectCurrentCenterKey();
    if (!centerKey) return alert('لم يتم تحديد الموقع للطباعة.');
    printPages([buildAttendancePage(centerKey)], 'طباعة جدول الموقع');
  };

  const oldPrintSelected = window.printSelected;
  window.printSelected = function printSelectedFinal() {
    const selected = Array.from(document.querySelectorAll('#print-centers-checkboxes input:checked')).map(x => x.value);
    const keys = selected.length ? selected : orderedKeys();
    printPages(keys.map(buildAttendancePage), 'طباعة المكاتب والمرافق');
  };

  function detectCurrentCenterKey() {
    if (window.activeCenterKeyForManagement) return window.activeCenterKeyForManagement;
    const visible = Array.from(document.querySelectorAll('[id^="table-div-"]')).find(el => {
      const st = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return st.display !== 'none' && r.width > 0 && r.height > 0;
    });
    if (visible) return visible.id.replace('table-div-', '');
    const activeTab = document.querySelector('.tab-link.active');
    if (activeTab?.dataset?.centerKey) return activeTab.dataset.centerKey;
    return null;
  }

  window.preparePrint = function preparePrintFinal() {
    return window.printAdminOfficeTableClean(detectCurrentCenterKey());
  };

  document.addEventListener('click', function (e) {
    const btn = e.target.closest('button, a');
    if (!btn) return;
    const text = (btn.textContent || '').trim();
    const onclick = String(btn.getAttribute('onclick') || '');
    if (text.includes('طباعة الجدول') || onclick.includes('preparePrint')) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      window.printAdminOfficeTableClean(detectCurrentCenterKey());
    }
    if (text.includes('الشهادة الإجمالية') || onclick.includes('showGrand') || onclick.includes('GrandCertificate')) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      window.showAdminOfficesGrandCertificate();
    }
  }, true);

  // 4) Aggregate certificate for admin offices; separate from achievement certificate.
  function certificateCss() {
    return `<style>@page{size:A4 portrait;margin:10mm}body{font-family:Tajawal,Arial,sans-serif;direction:rtl;margin:0;background:#f8fafc;color:#0f172a}.cert{background:#fff;border:1px solid #dbeafe;border-radius:18px;padding:22px;box-shadow:0 16px 40px rgba(15,23,42,.10)}.cert-header{text-align:center;border-bottom:4px solid #003087;padding-bottom:12px;position:relative}.cert-header img{position:absolute;top:0;width:72px}.cert-header .r{right:0}.cert-header .l{left:0}.cert-header h1{margin:0;color:#003087;font-size:24px}.cert-header h2{margin:8px 0 2px;color:#111827;font-size:21px}.cert-header h3{margin:0;color:#475569;font-size:15px}.cert-info{margin:16px 0;background:linear-gradient(135deg,#eef6ff,#fff);border:1px solid #bfdbfe;border-radius:14px;padding:12px 16px;display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.cert-info div{font-weight:700}.cert-info b{color:#003087}.totals{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}.box{background:#003087;color:#fff;border-radius:14px;padding:12px;text-align:center}.box.gold{background:#d4af37;color:#111827}.box span{display:block;font-size:12px;opacity:.9}.box strong{display:block;font-size:18px;margin-top:5px}table{width:100%;border-collapse:collapse;background:#fff;margin-top:12px;font-size:12px}th{background:#003087;color:#fff;padding:8px;border:1px solid #1e3a8a}td{padding:7px;border:1px solid #cbd5e1;text-align:center}tbody tr:nth-child(even) td{background:#f8fafc}.sign{margin-top:28px;display:grid;grid-template-columns:repeat(3,1fr);gap:18px;text-align:center}.line{height:45px;border-bottom:1px solid #111;margin:8px 10px}@media print{body{background:#fff}.cert{box-shadow:none;border:none}}</style>`;
  }

  window.showAdminOfficesGrandCertificate = function showAdminOfficesGrandCertificate() {
    const names = getNames();
    const contract = getContract();
    const extract = getExtract();
    const header = getHeader(orderedKeys()[0]);
    const performance = readJson('adminOfficesPerformanceDeductions_v1', readJson('performanceDeductions', {}));

    let total = { count: 0, cost: 0, absDed: 0, absFine: 0, natFine: 0, fines: 0, laborNet: 0, perf: 0, finalNet: 0 };
    const rows = orderedKeys().map((key, i) => {
      const c = officeCalc(key);
      const perf = Number(performance[key]) || 0;
      const finalNet = c.net - perf;
      total.count += c.count; total.cost += c.cost; total.absDed += c.absenceDeduction; total.absFine += c.absenceFine; total.natFine += c.nationalityFine; total.fines += c.fines; total.laborNet += c.net; total.perf += perf; total.finalNet += finalNet;
      return `<tr><td>${i + 1}</td><td style="text-align:right">${esc(names[key] || key)}</td><td>${c.count}</td><td>${money(c.cost)}</td><td>${money(c.absenceDeduction)}</td><td>${money(c.absenceFine)}</td><td>${money(c.nationalityFine)}</td><td>${money(c.net)}</td><td>${money(perf)}</td><td>${money(finalNet)}</td></tr>`;
    }).join('');

    const html = `<div class="cert"><div class="cert-header"><img class="r" src="${esc(header.logoSrc)}"><img class="l" src="${esc(header.logoSrc)}"><h1>${esc(header.h1)}</h1><h2>الشهادة الإجمالية المجمعة للمكاتب الإدارية والمرافق الصحية</h2><h3>${esc(header.h3 || 'المكاتب الإدارية')}</h3></div><div class="cert-info"><div><b>الشركة:</b> ${esc(contract.companyName || 'غير محدد')}</div><div><b>نوع العقد:</b> ${esc(contract.contractType || 'غير محدد')}</div><div><b>الفترة:</b> من ${esc(formatDate(extract.extractStart))} إلى ${esc(formatDate(extract.extractEnd))}</div><div><b>عدد المواقع:</b> ${orderedKeys().length}</div></div><div class="totals"><div class="box"><span>إجمالي العمالة</span><strong>${total.count}</strong></div><div class="box"><span>إجمالي التكلفة</span><strong>${money(total.cost)}</strong></div><div class="box"><span>إجمالي الغرامات</span><strong>${money(total.fines)}</strong></div><div class="box gold"><span>الصافي بعد خصم الأداء</span><strong>${money(total.finalNet)}</strong></div></div><table><thead><tr><th>م</th><th>الموقع</th><th>العمالة</th><th>التكلفة</th><th>حسم الغياب</th><th>غرامة الغياب</th><th>غرامة الجنسية</th><th>صافي العمالة</th><th>خصم الأداء</th><th>الصافي النهائي</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th colspan="2">الإجمالي</th><th>${total.count}</th><th>${money(total.cost)}</th><th>${money(total.absDed)}</th><th>${money(total.absFine)}</th><th>${money(total.natFine)}</th><th>${money(total.laborNet)}</th><th>${money(total.perf)}</th><th>${money(total.finalNet)}</th></tr></tfoot></table><div class="sign"><div>إعداد<div class="line"></div></div><div>مراجعة<div class="line"></div></div><div>اعتماد<div class="line"></div></div></div></div>`;
    printPagesWithCss(html, certificateCss(), 'الشهادة الإجمالية للمكاتب الإدارية');
  };

  function printPagesWithCss(html, css, title) {
    const win = window.open('', '', 'width=1000,height=900');
    if (!win) return alert('المتصفح منع نافذة الطباعة.');
    win.document.open();
    win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>${esc(title)}</title><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">${css}</head><body>${html}</body></html>`);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 500);
  }

  function ensureGrandCertificateButton() {
    const bar = document.getElementById('main-action-buttons') || document.querySelector('.main-action-buttons,.action-buttons');
    if (!bar || bar.querySelector('#admin-grand-office-cert-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'admin-grand-office-cert-btn';
    btn.className = 'btn btn-primary';
    btn.innerHTML = '<i class="fas fa-certificate"></i> الشهادة الإجمالية للمكاتب الإدارية';
    btn.onclick = window.showAdminOfficesGrandCertificate;
    bar.appendChild(btn);
  }

  // 5) Remove health-center wording from admin office page text.
  function cleanAdminOfficeText(root) {
    const walker = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const p = node.parentElement;
        if (!p || ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION'].includes(p.tagName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n => {
      n.nodeValue = n.nodeValue
        .replace(/الشهادة الإجمالية المجمعة للمراكز الصحية/g, 'الشهادة الإجمالية المجمعة للمكاتب الإدارية والمرافق الصحية')
        .replace(/مركز صحي/g, 'موقع')
        .replace(/المراكز الصحية/g, 'المواقع')
        .replace(/مراكز صحية/g, 'مواقع')
        .replace(/إدارة المراكز/g, 'إدارة المواقع')
        .replace(/موظفو مركز/g, 'موظفو موقع')
        .replace(/اختر مركزاً/g, 'اختر موقعاً')
        .replace(/اختر المركز/g, 'اختر الموقع')
        .replace(/المركز المحدد/g, 'الموقع المحدد')
        .replace(/للمركز/g, 'للموقع')
        .replace(/المركز/g, 'الموقع');
    });
  }

  const mo = new MutationObserver(() => {
    installBulkAttendanceButton();
    ensureGrandCertificateButton();
    cleanAdminOfficeText(document.body);
    try { window.calculateAndDisplayGrandTotal(); } catch (_) {}
  });

  function boot() {
    installBulkAttendanceButton();
    ensureGrandCertificateButton();
    cleanAdminOfficeText(document.body);
    window.calculateAndDisplayGrandTotal();
    mo.observe(document.body, { childList: true, subtree: true });
    console.info('[Admin Offices Final Patch] loaded');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
