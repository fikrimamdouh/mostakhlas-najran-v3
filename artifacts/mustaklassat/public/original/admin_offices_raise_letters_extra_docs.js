// ===================================================================
// Admin Offices Raise Letters Extra Documents
// Scope: admin_offices_attendance.html only
// داخل نفس صفحة خطابات الرفع — بدون ملفات جديدة
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html|original-viewer\?page=admin_offices_attendance\.html/.test(location.pathname + location.search)) return;

  const SETTINGS_KEY = 'adminOfficesRaiseLettersSettings_v1';
  const NOTES_KEY = 'adminOfficesAbsenceVacationNotes_v1';
  const PERF_KEY = 'adminOfficePerformanceDeductions_v1';

  function readJson(key, fallback) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; } }
  function writeJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value || {})); } catch (_) {} }
  function esc(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function clean(value) { return String(value ?? '').replace(/\s+/g, ' ').trim(); }
  function firstValue() { for (const value of arguments) { const v = clean(value); if (v && !['غير محدد', 'undefined', 'null', '—'].includes(v)) return v; } return ''; }
  function number(value) {
    const ar = '٠١٢٣٤٥٦٧٨٩', fa = '۰۱۲۳۴۵۶۷۸۹';
    const s = String(value ?? '').replace(/[٠-٩]/g, d => ar.indexOf(d)).replace(/[۰-۹]/g, d => fa.indexOf(d)).replace(/,/g, '').replace(/[ ريال﷼()]/g, '').trim();
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }
  function money(value) { return number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function sar(value) { return money(value) + ' ريال'; }

  function defaultSettings() {
    return {
      recipient: 'سعادة / مساعد المدير العام للدعم المساند',
      recipientSuffix: 'المحترم',
      entityTitle: 'المديرية العامة للشئون الصحية بمنطقة نجران',
      departmentTitle: 'إدارة الشئون الهندسية',
      scopeName: 'المكاتب الإدارية والمرافق الصحية وصيانة وإصلاح السيارات والعيادات المتنقلة',
      phoneFaxAr: 'نجران – تليفون 0175225872    فاكس 017523312',
      phoneFaxEn: 'Najran – Tel.: 0175225872       Fax: 017523312',
      managerTitle: '................................',
      managerName: '................................',
      unitManagerTitle: '................................',
      unitManagerName: '................................',
      finalLetterHeaderLine1: 'وزارة الصحة',
      finalLetterHeaderLine2: 'فرع وزارة الصحة بمنطقة نجران',
      finalLetterHeaderLine3: 'الإدارة المساعدة للدعم المساند',
      finalLetterSubject: '',
      finalLetterTo: 'المكرم / مدير الإدارة المالية',
      finalLetterToSuffix: 'المحترم',
      finalLetterGreeting: 'السلام عليكم ورحمة الله وبركاته',
      finalLetterOpening: 'نرفق طيه المستخلص النهائي لأعمال الصيانة والنظافة والتشغيل غير الطبي لـ {scopeName} حسب البيانات التالية:',
      finalLetterClosing: 'نأمل التكرم بالاطلاع وتوجيه الجهة المختصة نحو صرف استحقاق المقاول حسب النظام.',
      finalLetterRegards: 'مع أطيب تحياتي وتقديري،،',
      finalLetterSignatureTitle: 'مساعد المدير العام للدعم المساند',
      finalLetterSignatureName: ''
    };
  }
  function settings() { return Object.assign(defaultSettings(), readJson(SETTINGS_KEY, {})); }
  function saveSettingsPatch(patch) { writeJson(SETTINGS_KEY, Object.assign(defaultSettings(), readJson(SETTINGS_KEY, {}), patch || {})); }

  function contractData() { return readJson('persistentContractData', {}); }
  function extractData() { return readJson('persistentExtractData', {}); }
  function names() { try { if (typeof window.getCenterNames === 'function') return window.getCenterNames() || {}; } catch (_) {} return readJson('adminOfficeNames_v1', {}); }
  function attendanceData() {
    const sources = [];
    try { if (typeof window.getAttendanceData === 'function') sources.push(window.getAttendanceData() || {}); } catch (_) {}
    sources.push(readJson('adminOfficesAttendanceData_v1', {}));
    sources.push(readJson('adminOfficesAttendanceData_v1_localBackup', {}));
    sources.push(readJson('adminOfficesAttendanceData', {}));
    const count = obj => Object.values(obj || {}).reduce((sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0), 0);
    return sources.reduce((best, obj) => count(obj) > count(best) ? obj : best, {});
  }
  function companyName() { const c = contractData(); return firstValue(c.contractorName, c.contractorCompany, c.companyName, c.company, c.contractor, c.supplierName, c.vendorName, localStorage.getItem('companyName'), document.querySelector('.companyName')?.textContent) || 'غير محدد'; }
  function contractName() { const c = contractData(); return firstValue(c.contractName, c.projectName, c.contractTitle, c.name, c.scopeName, settings().scopeName) || settings().scopeName; }
  function contractNumber() { const c = contractData(); return firstValue(c.contractNumber, c.contractNo, c.number, localStorage.getItem('contractNumber')) || '—'; }
  function dateText(value) { if (!value) return 'غير محدد'; try { const d = new Date(value); return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('en-CA'); } catch (_) { return 'غير محدد'; } }
  function paymentNo() { const e = extractData(); const raw = firstValue(e.paymentNumber, e.extractNumber, e.paymentNo, e.extractNo, localStorage.getItem('paymentNumber'), localStorage.getItem('extractNumber'), localStorage.getItem('paymentNo')) || '—'; return /^\d+$/.test(raw) ? raw.padStart(3, '0') : raw; }
  function period() {
    try { if (typeof window.getExtractPeriodDetails === 'function') return window.getExtractPeriodDetails(); } catch (_) {}
    const e = extractData();
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
  function extractPhrase() { const p = period(); return `دفعة رقم (${esc(paymentNo())}) عن الفترة من ${esc(dateText(p.startDate))} م إلى ${esc(dateText(p.endDate))} م`; }
  function monthLabel() { return period().startDate.toLocaleDateString('ar-SA', { month: 'long' }); }
  function yearLabel() { return String(period().startDate.getFullYear()); }

  function centerKeys() {
    const n = names(), d = attendanceData();
    return Array.from(new Set([...Object.keys(n || {}), ...Object.keys(d || {})]))
      .filter(k => k === 'admin_staff' || /^center_\d+$/.test(k) || Array.isArray(d[k]))
      .sort((a, b) => {
        if (/^center_\d+$/.test(a) && /^center_\d+$/.test(b)) return parseInt(a.split('_')[1], 10) - parseInt(b.split('_')[1], 10);
        if (/^center_\d+$/.test(a)) return -1;
        if (/^center_\d+$/.test(b)) return 1;
        if (a === 'admin_staff') return 1;
        if (b === 'admin_staff') return -1;
        return String(a).localeCompare(String(b), 'ar');
      });
  }
  function isWorkshop(key) { const name = names()[key] || key; return key === 'admin_staff' || /ورش|صيانة|إصلاح|اصلاح|سيارات/.test(String(name)); }
  function statusInfo(code) { return (window.STATUS_CODES && window.STATUS_CODES[code]) || {}; }
  function isAbsence(code) { return !!statusInfo(code).isAbsence || code === 'غ'; }
  function isVacation(code) { const label = `${code} ${statusInfo(code).name || ''}`; return !isAbsence(code) && /(إجاز|اجاز|ج|ش)/.test(label) && code !== 'ح'; }
  function isSaudi(value) { const v = String(value || '').replace(/\s+/g, ''); return v.includes('سعودي') && !v.includes('غيرسعودي'); }

  function calcEmployee(emp) {
    const p = period(), c = contractData();
    if (typeof window.calculateAdminOfficeEmployeeFinancials === 'function') {
      try { return window.calculateAdminOfficeEmployeeFinancials(emp, { totalDaysInMonth: p.totalDaysInMonth, daysInExtract: p.daysInExtract, contractType: c.contractType || 'عقد أساسي', directPurchaseRatio: number(c.directPurchaseRatio) }); } catch (_) {}
    }
    const days = Array.isArray(emp.days) ? emp.days.slice(0, p.daysInExtract) : [];
    while (days.length < p.daysInExtract) days.push('ح');
    const monthly = number(emp.salary);
    const daily = p.totalDaysInMonth > 0 ? monthly / p.totalDaysInMonth : 0;
    const costForPeriod = daily * p.daysInExtract;
    const absenceDays = days.filter(isAbsence).length;
    const vacationDays = days.filter(isVacation).length;
    const deduction = absenceDays * daily;
    const nationalityFine = number(emp.nationalityFine);
    const absenceFine = number(emp.absenceFine);
    return { days, costForPeriod, deduction, absenceFine, nationalityFine, totalFine: absenceFine + nationalityFine, netSalary: costForPeriod - deduction - absenceFine - nationalityFine, attendanceDays: days.length - absenceDays - vacationDays, absenceDays, vacationDays };
  }
  function calcSite(key) {
    if (window.AdminOfficesRaiseLetters && typeof window.AdminOfficesRaiseLetters.calcSite === 'function') {
      try {
        const c = window.AdminOfficesRaiseLetters.calcSite(key) || {};
        return { cost: number(c.cost), absenceDeduction: number(c.absenceDeduction), absenceFine: number(c.absenceFine), nationalityFine: number(c.nationalityFine), performanceDeduction: number(c.performanceDeduction), totalDeduction: number(c.absenceDeduction) + number(c.absenceFine) + number(c.nationalityFine) + number(c.performanceDeduction), finalNet: number(c.finalNet) };
      } catch (_) {}
    }
    return (attendanceData()[key] || []).reduce((out, emp) => {
      const c = calcEmployee(emp);
      out.cost += number(c.costForPeriod);
      out.absenceDeduction += number(c.deduction);
      out.absenceFine += number(c.absenceFine);
      out.nationalityFine += number(c.nationalityFine);
      out.totalDeduction += number(c.deduction) + number(c.absenceFine) + number(c.nationalityFine);
      out.finalNet += number(c.netSalary);
      return out;
    }, { cost: 0, absenceDeduction: 0, absenceFine: 0, nationalityFine: 0, performanceDeduction: 0, totalDeduction: 0, finalNet: 0 });
  }
  function grandTotals() { const t = { cost: 0, absenceDeduction: 0, absenceFine: 0, nationalityFine: 0, performanceDeduction: 0, totalDeduction: 0, finalNet: 0 }; centerKeys().forEach(k => { const c = calcSite(k); Object.keys(t).forEach(x => { t[x] += number(c[x]); }); }); return t; }
  function groupedTotals() {
    const out = { offices: { label: 'المكاتب الإدارية والمرافق الصحية', cost: 0, absenceDeduction: 0, absenceFine: 0, nationalityFine: 0, totalDeduction: 0, finalNet: 0 }, workshops: { label: 'صيانة وإصلاح السيارات', cost: 0, absenceDeduction: 0, absenceFine: 0, nationalityFine: 0, totalDeduction: 0, finalNet: 0 } };
    centerKeys().forEach(k => { const target = isWorkshop(k) ? out.workshops : out.offices; const c = calcSite(k); Object.keys(target).filter(x => x !== 'label').forEach(x => { target[x] += number(c[x]); }); });
    return out;
  }
  function performanceDeduction(key) { try { if (typeof window.calculateAdminOfficePerformanceSummary === 'function') window.calculateAdminOfficePerformanceSummary(key); } catch (_) {} const a = readJson(PERF_KEY, {}), b = readJson('performanceDeductions', {}); return number(a[key] !== undefined ? a[key] : b[key]); }
  function replaceTokens(text) { const p = period(); return String(text || '').replaceAll('{scopeName}', settings().scopeName).replaceAll('{companyName}', companyName()).replaceAll('{contractName}', contractName()).replaceAll('{paymentNo}', paymentNo()).replaceAll('{startDate}', dateText(p.startDate)).replaceAll('{endDate}', dateText(p.endDate)); }

  function css() { return `<style>
    @page{size:A4 portrait;margin:12mm}@page landscape{size:A4 landscape;margin:7mm}*{box-sizing:border-box}body{margin:0;background:#e9eef5;direction:rtl;font-family:Tajawal,Arial,sans-serif;color:#111827}.toolbar{position:sticky;top:0;background:#111827;padding:10px;text-align:center;z-index:5}.toolbar button{background:#d4af37;border:0;border-radius:10px;padding:10px 18px;font-weight:900;cursor:pointer}.page{width:210mm;min-height:297mm;margin:12px auto;background:#fff;padding:14mm 15mm 18mm;box-shadow:0 10px 30px rgba(15,23,42,.16);position:relative;page-break-after:always}.page.landscape{width:297mm;min-height:210mm;page:landscape;padding:10mm}.page:last-child{page-break-after:auto}.head{display:grid;grid-template-columns:78px 1fr 78px;align-items:center;border-bottom:2px solid #003087;padding-bottom:9px;margin-bottom:18px}.head img{width:68px}.head div{text-align:center}.head h1{font-size:17px;margin:0 0 4px;color:#003087}.head h2{font-size:15px;margin:0}.final-head{display:grid;grid-template-columns:150px 1fr;align-items:start;min-height:92px;margin-bottom:14px}.final-logo img{width:118px;opacity:.72}.final-ministry{text-align:right;padding-top:8px}.final-ministry h1,.final-ministry h2,.final-ministry h3{margin:0 0 6px;font-size:14.5px;font-weight:900}.cert-title{text-align:center;font-size:21px;font-weight:900;margin:18px 0 12px}.sub-title{text-align:center;font-size:16px;font-weight:800;margin:8px 0 15px;line-height:1.8}.final-subject{text-align:center;font-size:13px;font-weight:900;text-decoration:underline;margin:18px 0 42px}.final-to{display:flex;justify-content:space-between;font-size:16px;font-weight:900;margin:0 0 10px}.body-text{font-size:16px;line-height:2.2;text-align:justify;margin-top:22px}.amount-table{width:100%;border-collapse:collapse;margin:14px 0;font-size:13px;table-layout:fixed}.amount-table th{background:#003087;color:#fff}.amount-table th,.amount-table td{border:1px solid #333;padding:7px;text-align:center;vertical-align:middle;white-space:normal;word-break:normal;overflow-wrap:anywhere}.amount-table td:first-child{text-align:right}.final-table{width:72%;margin:14px auto 10px;font-size:14px}.total-row td{background:#fff7d6;font-weight:900}.iban{text-align:center;margin:10px 0;font-weight:800}.signatures{display:grid;grid-template-columns:repeat(2,1fr);gap:20px;margin-top:42px;text-align:center}.signatures.one{display:block}.signatures.one>div{width:78mm;margin-right:auto;margin-left:0;text-align:center}.sig-title{font-weight:900;margin-bottom:18px}.line{height:34px;border-bottom:1px solid #111;margin:0 18px 10px}.sig-name{font-weight:900}.footer{position:absolute;bottom:8mm;left:15mm;right:15mm;border-top:1px solid #cbd5e1;padding-top:5px;font-size:11px;display:flex;justify-content:space-between;direction:ltr}.settings-overlay{position:fixed;inset:0;background:rgba(15,23,42,.72);z-index:999999;display:flex;align-items:center;justify-content:center;padding:18px}.settings-dialog{width:min(1200px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:18px;padding:18px}.btn-row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin:12px 0}.btn{border:0;border-radius:10px;padding:9px 14px;font-weight:900;cursor:pointer}.btn-primary{background:#003087;color:#fff}.btn-gold{background:#d4af37;color:#111}.btn-light{background:#f1f5f9;color:#111;border:1px solid #cbd5e1}.section-box{border:1px solid #e2e8f0;border-radius:14px;padding:12px;margin-top:12px;background:#f8fafc}.section-box h3{margin:0 0 12px;color:#003087}.settings-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:10px}.field{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:10px}.field label{display:block;font-size:12px;font-weight:900;margin-bottom:6px}.field input,.field textarea{width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px;font-family:inherit;font-weight:700}.field textarea{min-height:70px}@media print{body{background:#fff}.toolbar,.settings-overlay{display:none!important}.page{margin:0;box-shadow:none}}
  </style>`; }
  function openPrintDoc(title, pagesHtml) { const win = window.open('', '', 'width=1200,height=900'); if (!win) return alert('المتصفح منع نافذة الطباعة. اسمح بالنوافذ المنبثقة.'); win.document.open(); win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>${esc(title)}</title><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">${css()}</head><body><div class="toolbar"><button onclick="window.print()">طباعة</button><button onclick="window.close()" style="margin-right:8px">إغلاق</button></div>${pagesHtml}</body></html>`); win.document.close(); }
  function commonHead() { const s = settings(); return `<div class="head"><img src="moh_logo.png"><div><h1>${esc(s.entityTitle)}</h1><h2>${esc(s.departmentTitle)}</h2></div><img src="moh_logo.png"></div>`; }
  function finalHead() { const s = settings(); return `<div class="final-head"><div class="final-logo"><img src="moh_logo.png"></div><div class="final-ministry"><h1>${esc(s.finalLetterHeaderLine1)}</h1><h2>${esc(s.finalLetterHeaderLine2)}</h2><h3>${esc(s.finalLetterHeaderLine3)}</h3></div></div>`; }
  function footer() { const s = settings(); return `<div class="footer"><span>${esc(s.phoneFaxEn)}</span><span dir="rtl">${esc(s.phoneFaxAr)}</span></div>`; }
  function signature(two = true) { const s = settings(); return two ? `<div class="signatures"><div><div class="sig-title">${esc(s.unitManagerTitle)}</div><div class="line"></div><div class="sig-name">${esc(s.unitManagerName)}</div></div><div><div class="sig-title">${esc(s.managerTitle)}</div><div class="line"></div><div class="sig-name">${esc(s.managerName)}</div></div></div>` : `<div class="signatures one"><div><div class="sig-title">${esc(s.managerTitle)}</div><div class="line"></div><div class="sig-name">${esc(s.managerName)}</div></div></div>`; }

  function pageFinalRaiseLetter() { const s = settings(), p = period(), g = grandTotals(), c = contractData(); const net = g.finalNet, vat = net * 0.15, other = number(localStorage.getItem('finalLetterOtherAmount')), total = net + vat + other; const iban = firstValue(c.iban, c.bankIban, c.accountIban, c.bankAccount, localStorage.getItem('contractorIban')) || 'SA................................'; const subject = firstValue(s.finalLetterSubject, `مستخلص ${contractName()}`); const title = firstValue(s.finalLetterSignatureTitle, s.managerTitle, 'مساعد المدير العام للدعم المساند'); const name = firstValue(s.finalLetterSignatureName, s.managerName, '................................'); return `<section class="page">${finalHead()}<div class="final-subject">${esc(subject)}</div><div class="final-to"><span>${esc(s.finalLetterTo)}</span><span>${esc(s.finalLetterToSuffix)}</span></div><div class="cert-title" style="font-size:16px">${esc(s.finalLetterGreeting)}</div><div class="body-text">${esc(replaceTokens(s.finalLetterOpening))}</div><ol style="line-height:1.9"><li>اسم العقد: ${esc(contractName())}</li><li>اسم المقاول / الشركة: ${esc(companyName())}</li><li>الموقع: ${esc(s.scopeName)}</li><li>الفترة الزمنية: من ${esc(dateText(p.startDate))} م حتى ${esc(dateText(p.endDate))} م</li><li>رقم الدفعة / المستخلص: ${esc(paymentNo())}</li><li>رقم العقد: ${esc(contractNumber())}</li></ol><table class="amount-table final-table"><tr><td>صافي المستحق للمقاول</td><td>${sar(net)}</td></tr><tr><td>ضريبة القيمة المضافة 15%</td><td>${sar(vat)}</td></tr><tr><td>مبالغ أخرى / تعويضات / حسميات</td><td>${sar(other)}</td></tr><tr class="total-row"><td>الإجمالي</td><td>${sar(total)}</td></tr></table><div class="iban">رقم الحساب البنكي الآيبان: ${esc(iban)}</div><div class="body-text" style="text-align:center;font-weight:800">${esc(replaceTokens(s.finalLetterClosing))}</div><div class="body-text" style="text-align:center;font-weight:900">${esc(s.finalLetterRegards)}</div><div class="signatures one"><div><div class="sig-title">${esc(title)}</div><div class="line"></div><div class="sig-name">${esc(name)}</div></div></div></section>`; }
  function pageNoPreviousPayment() { const g = grandTotals(); const total = g.finalNet + g.finalNet * 0.15; return `<section class="page">${commonHead()}<div class="cert-title">إقرار بعدم أسبقية صرف</div><div class="body-text">تقر إدارة الصيانة بالشئون الهندسية بصحة نجران بأن مستخلص العمالة لشركة <strong>${esc(companyName())}</strong> لمواقع ${esc(settings().scopeName)}، ${extractPhrase()}، بمبلغ وقدره (${sar(total)}).<br>لم يسبق صرفه من قبلنا.</div>${signature(true)}${footer()}</section>`; }
  function pageRaiseSummary() { const s = settings(), g = grandTotals(), net = g.finalNet, vat = net * 0.15; return `<section class="page">${commonHead()}<div class="final-to"><span>${esc(s.recipient)}</span><span>${esc(s.recipientSuffix)}</span></div><div class="cert-title" style="font-size:16px">السلام عليكم ورحمة الله وبركاته، وبعد:</div><div class="body-text">نرفق لسعادتكم المستخلص الشهري لشركة ${esc(companyName())} والخاص ببند العمالة لمواقع ${esc(s.scopeName)}، ${extractPhrase()}.</div><table class="amount-table final-table"><tr><td>صافي مستحقات العمالة عن مدة المستخلص</td><td>${sar(net)}</td></tr><tr><td>ضريبة القيمة المضافة 15%</td><td>${sar(vat)}</td></tr><tr class="total-row"><td>الإجمالي</td><td>${sar(net + vat)}</td></tr></table>${signature(false)}${footer()}</section>`; }
  function pageGroupedCertificate() { const g = groupedTotals(), total = {}; ['cost','absenceDeduction','absenceFine','nationalityFine','totalDeduction','finalNet'].forEach(k => total[k] = g.offices[k] + g.workshops[k]); const rows = [g.offices, g.workshops].map(r => `<tr><td>${esc(r.label)}</td><td>${sar(r.cost)}</td><td>${sar(r.absenceDeduction)}</td><td>${sar(r.absenceFine)}</td><td>${sar(r.nationalityFine)}</td><td>${sar(r.totalDeduction)}</td><td>${sar(r.finalNet)}</td></tr>`).join(''); return `<section class="page">${commonHead()}<div class="cert-title">شهادة الاستحقاق الشهري للعماله لأعمال النظافة والصيانة والتشغيل غير الطبي لمشروع ${esc(settings().scopeName)}</div><div class="sub-title">لشركة / ${esc(companyName())}<br>${extractPhrase()}</div><table class="amount-table"><thead><tr><th>البند</th><th>تكاليف العمالة</th><th>حسم الغياب</th><th>غرامة الغياب</th><th>غرامة الجنسية</th><th>إجمالي الحسم</th><th>الصافي المستحق</th></tr></thead><tbody>${rows}<tr class="total-row"><td>الإجمالي</td><td>${sar(total.cost)}</td><td>${sar(total.absenceDeduction)}</td><td>${sar(total.absenceFine)}</td><td>${sar(total.nationalityFine)}</td><td>${sar(total.totalDeduction)}</td><td>${sar(total.finalNet)}</td></tr></tbody></table>${signature(true)}${footer()}</section>`; }
  function pageEntitlementStatement() { const rows = centerKeys().map(k => { const c = calcSite(k); return `<tr><td>${esc(names()[k] || k)}</td><td>${esc(monthLabel())}</td><td>${sar(c.cost)}</td><td>${sar(c.absenceDeduction)}</td><td>${sar(c.absenceFine)}</td><td>${sar(c.nationalityFine)}</td><td>${sar(c.totalDeduction)}</td><td>${sar(c.finalNet)}</td></tr>`; }).join(''); return `<section class="page landscape">${commonHead()}<div class="cert-title">بيان استحقاق</div><div class="sub-title">اسم الشركة: ${esc(companyName())} | عقد: ${esc(contractName())}<br>لشهر ${esc(monthLabel())} سنة ${esc(yearLabel())} — ${extractPhrase()}</div><table class="amount-table"><thead><tr><th>اسم المشروع / الموقع</th><th>شهر الاستحقاق</th><th>تكاليف العمالة</th><th>حسم الغياب</th><th>غرامة الغياب</th><th>غرامة الجنسية</th><th>إجمالي الحسم</th><th>الصافي المستحق</th></tr></thead><tbody>${rows}</tbody></table>${signature(true)}${footer()}</section>`; }
  function pageSalaryCertificate() { return `<section class="page">${commonHead()}<div class="cert-title" style="font-size:34px;margin-top:42px">شهادة</div><div class="body-text" style="font-size:18px;text-align:center;margin-top:35px">تشهد إدارة الصيانة بصحة نجران بأن شركة <strong>${esc(companyName())}</strong> قامت بتسليم جميع رواتب لكل منسوبيها داخل الموقع عن شهر <strong>${esc(monthLabel())}</strong> والفترة <strong>${extractPhrase()}</strong>.</div><div class="body-text" style="text-align:center;font-weight:900">هذا مشهد منا بذلك.</div>${signature(true)}${footer()}</section>`; }
  function pageSaudiEmployees() { let i = 1; const rows = centerKeys().flatMap(k => (attendanceData()[k] || []).filter(emp => isSaudi(emp.nationality)).map(emp => `<tr><td>${i++}</td><td>${esc(names()[k] || k)}</td><td>${esc(emp.name || '')}</td><td>${esc(emp.jobTitle || '')}</td><td>${esc(emp.nationality || 'سعودي')}</td><td>${esc(emp.iqamaId || emp.idNumber || '')}</td></tr>`)).join('') || '<tr><td colspan="6">لا توجد وظائف مشغولة بسعوديين.</td></tr>'; return `<section class="page landscape">${commonHead()}<div class="cert-title">بيان بأسماء الوظائف المشغولة بالسعوديين</div><div class="sub-title">لشهر ${esc(monthLabel())} — ${extractPhrase()}</div><table class="amount-table"><thead><tr><th>مسلسل</th><th>الموقع</th><th>اسم الموظف</th><th>الوظيفة</th><th>الجنسية</th><th>رقم الهوية</th></tr></thead><tbody>${rows}</tbody></table>${signature(true)}${footer()}</section>`; }
  function dateByIndex(i) { const p = period(), d = new Date(p.startDate); d.setDate(p.startDate.getDate() + i); return dateText(d); }
  function segments(type) { const match = type === 'absence' ? isAbsence : isVacation, out = []; centerKeys().forEach(k => (attendanceData()[k] || []).forEach(emp => { const days = calcEmployee(emp).days || []; let start = -1; for (let i = 0; i <= days.length; i++) { const ok = i < days.length && match(days[i]); if (ok && start < 0) start = i; if ((!ok || i === days.length) && start >= 0) { out.push({ key: `${type}|${k}|${emp.iqamaId || emp.name || ''}|${start}|${i - 1}`, site: names()[k] || k, jobTitle: emp.jobTitle || '', from: dateByIndex(start), to: dateByIndex(i - 1), note: '' }); start = -1; } } })); const notes = readJson(NOTES_KEY, {}); out.forEach(r => r.note = notes[r.key] || ''); return out; }
  function pageStatement(type) { const title = type === 'absence' ? 'بيان ملخص الغيابات' : 'بيان ملخص الإجازات'; const rows = segments(type); const body = rows.length ? rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.jobTitle)}</td><td>${esc(r.from)}</td><td>${esc(r.to)}</td><td>${esc(r.site)}</td><td>${esc(r.note)}</td></tr>`).join('') : '<tr><td colspan="6">لا توجد بيانات.</td></tr>'; return `<section class="page landscape">${commonHead()}<div class="cert-title">${esc(title)}</div><div class="sub-title">${extractPhrase()} — شهر ${esc(monthLabel())}</div><table class="amount-table"><thead><tr><th>مسلسل</th><th>اسم الوظيفة</th><th>الفترة من</th><th>إلى</th><th>الموقع</th><th>ملاحظات</th></tr></thead><tbody>${body}</tbody></table>${signature(true)}${footer()}</section>`; }
  function pageSiteRaise(k) { const c = calcSite(k), s = settings(); return `<section class="page">${commonHead()}<div class="final-to"><span>${esc(s.recipient)}</span><span>${esc(s.recipientSuffix)}</span></div><div class="cert-title" style="font-size:16px">السلام عليكم ورحمة الله وبركاته، وبعد:</div><div class="body-text">نرفق لسعادتكم المستخلص الشهري الخاص بموقع ${esc(names()[k] || k)} ببند العمالة، ${extractPhrase()}، بمبلغ وقدره (${sar(c.finalNet)}).</div>${signature(false)}${footer()}</section>`; }
  function pageAttendance(k) { const rows = (attendanceData()[k] || []).map((emp, i) => { const c = calcEmployee(emp); return `<tr><td>${i + 1}</td><td>${esc(emp.name || '')}</td><td>${esc(emp.jobTitle || '')}</td><td>${esc(emp.nationality || '')}</td><td>${number(c.attendanceDays)}</td><td>${number(c.absenceDays)}</td><td>${number(c.vacationDays)}</td><td>${sar(c.deduction || 0)}</td><td>${sar(c.netSalary || 0)}</td></tr>`; }).join('') || '<tr><td colspan="9">لا توجد بيانات حضور.</td></tr>'; return `<section class="page landscape">${commonHead()}<div class="cert-title">بيان الحضور والانصراف</div><div class="sub-title">موقع: ${esc(names()[k] || k)}<br>${extractPhrase()}</div><table class="amount-table"><thead><tr><th>م</th><th>اسم الموظف</th><th>الوظيفة</th><th>الجنسية</th><th>حضور</th><th>غياب</th><th>إجازات</th><th>حسم الغياب</th><th>الصافي</th></tr></thead><tbody>${rows}</tbody></table>${signature(true)}${footer()}</section>`; }
  function pagePerformance(k) { return `<section class="page">${commonHead()}<div class="cert-title">بيان الأداء</div><div class="sub-title">موقع: ${esc(names()[k] || k)}<br>${extractPhrase()}</div><table class="amount-table"><thead><tr><th>القسم</th><th>مبلغ الحسم</th></tr></thead><tbody><tr><td>أداء الصيانة</td><td>${sar(performanceDeduction(k))}</td></tr></tbody></table>${signature(true)}${footer()}</section>`; }
  function pagePerformanceCertificate(k) { const p = period(); return `<section class="page">${commonHead()}<div class="cert-title">شهادة الأداء الشهري لأعمال النظافة والصيانة والتشغيل غير الطبي</div><div class="sub-title">لموقع : ${esc(names()[k] || k)}<br>عن دفعة رقم (${esc(paymentNo())}) من ${esc(dateText(p.startDate))} م إلى ${esc(dateText(p.endDate))} م</div><table class="amount-table"><thead><tr><th>القسم</th><th>إجمالي مبلغ الحسميات</th></tr></thead><tbody><tr><td>أداء الصيانة</td><td>${sar(performanceDeduction(k))}</td></tr></tbody></table>${signature(true)}${footer()}</section>`; }
  function pageAchievement(k) { const c = calcSite(k); return `<section class="page">${commonHead()}<div class="cert-title">شهادة إنجاز الموقع</div><div class="sub-title">موقع: ${esc(names()[k] || k)}<br>${extractPhrase()}</div><div class="body-text" style="text-align:center">تشهد إدارة الصيانة بصحة نجران بأن شركة <strong>${esc(companyName())}</strong> قامت بتنفيذ أعمال النظافة والصيانة والتشغيل غير الطبي للموقع الموضح أعلاه خلال مدة المستخلص.</div><table class="amount-table final-table"><tr><td>إجمالي تكلفة العمالة</td><td>${sar(c.cost)}</td></tr><tr><td>إجمالي الحسميات والغرامات</td><td>${sar(c.totalDeduction)}</td></tr><tr class="total-row"><td>صافي استحقاق الموقع</td><td>${sar(c.finalNet)}</td></tr></table>${signature(true)}${footer()}</section>`; }

  function saveNote(key, value) { const notes = readJson(NOTES_KEY, {}); notes[key] = value || ''; writeJson(NOTES_KEY, notes); }
  function openEditableStatement(type) { const title = type === 'absence' ? 'بيان ملخص الغيابات' : 'بيان ملخص الإجازات'; const rows = segments(type); const body = rows.length ? rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.jobTitle)}</td><td>${esc(r.from)}</td><td>${esc(r.to)}</td><td>${esc(r.site)}</td><td><input data-note-key="${esc(r.key)}" value="${esc(r.note)}" oninput="AdminOfficesExtraDocs.saveNote(this.dataset.noteKey,this.value)"></td></tr>`).join('') : '<tr><td colspan="6">لا توجد بيانات.</td></tr>'; document.getElementById('extra-docs-edit-overlay')?.remove(); document.body.insertAdjacentHTML('beforeend', `<div class="settings-overlay" id="extra-docs-edit-overlay"><div class="settings-dialog"><h2>${esc(title)}</h2><div class="btn-row"><button class="btn btn-gold" onclick="AdminOfficesExtraDocs.printEditableStatement('${type}')">طباعة</button><button class="btn btn-light" onclick="document.getElementById('extra-docs-edit-overlay')?.remove()">إغلاق</button></div><table class="amount-table"><thead><tr><th>مسلسل</th><th>اسم الوظيفة</th><th>الفترة من</th><th>إلى</th><th>الموقع</th><th>ملاحظات</th></tr></thead><tbody>${body}</tbody></table></div></div>`); }
  function printEditableStatement(type) { openPrintDoc(type === 'absence' ? 'بيان ملخص الغيابات' : 'بيان ملخص الإجازات', pageStatement(type)); }
  function generateFullExtractPrint() { const ks = centerKeys(); if (!ks.length) return alert('لا توجد مواقع/مكاتب لطباعة المستخلص الكامل.'); let html = pageFinalRaiseLetter() + pageNoPreviousPayment() + pageRaiseSummary() + pageGroupedCertificate() + pageEntitlementStatement() + pageSalaryCertificate() + pageSaudiEmployees() + pageStatement('absence') + pageStatement('vacation'); ks.forEach(k => { html += pageSiteRaise(k) + pageAttendance(k) + pagePerformance(k) + pagePerformanceCertificate(k) + pageAchievement(k); }); openPrintDoc('طباعة المستخلص كامل', html); }

  function settingField(key, label) { const s = settings(); return `<div class="field"><label>${esc(label)}</label><input type="text" data-rl-setting="${esc(key)}" value="${esc(s[key])}"></div>`; }
  function settingArea(key, label) { const s = settings(); return `<div class="field"><label>${esc(label)}</label><textarea data-rl-setting="${esc(key)}">${esc(s[key])}</textarea></div>`; }
  function saveFinalSettingsFromSection() { const patch = {}; document.querySelectorAll('#final-raise-letter-settings [data-rl-setting]').forEach(el => { patch[el.dataset.rlSetting] = el.value; }); saveSettingsPatch(patch); if (window.AdminOfficesRaiseLetters && typeof window.AdminOfficesRaiseLetters.saveDialog === 'function') { try { window.AdminOfficesRaiseLetters.saveDialog(); } catch (_) {} } alert('تم حفظ إعدادات خطاب الرفع النهائي.'); }
  function installButtons() { const overlay = document.getElementById('raise-letters-overlay'); if (!overlay || overlay.querySelector('#admin-extra-docs-section')) return; const dialog = overlay.querySelector('.settings-dialog'); if (!dialog) return; const section = document.createElement('div'); section.id = 'admin-extra-docs-section'; section.className = 'section-box'; section.style.cssText = 'border:2px solid #d4af37;background:#fffbeb;'; section.innerHTML = `<h3>خطابات وبيانات إضافية</h3><div class="btn-row"><button class="btn btn-primary" onclick="AdminOfficesExtraDocs.generateFullExtractPrint()">طباعة المستخلص كامل</button><button class="btn btn-gold" onclick="AdminOfficesExtraDocs.generateFinalFinancialRaiseLetter()">خطاب الرفع النهائي</button><button class="btn btn-gold" onclick="AdminOfficesExtraDocs.generateGroupedMonthlyEntitlementCertificate()">شهادة الاستحقاق الشهري المجمعة</button><button class="btn btn-gold" onclick="AdminOfficesExtraDocs.generateEntitlementStatement()">بيان استحقاق</button><button class="btn btn-gold" onclick="AdminOfficesExtraDocs.generateSalaryDeliveryCertificate()">شهادة تسليم الرواتب</button><button class="btn btn-gold" onclick="AdminOfficesExtraDocs.generateSaudiOccupiedJobsStatement()">بيان الوظائف المشغولة بالسعوديين</button><button class="btn btn-gold" onclick="AdminOfficesExtraDocs.generateMonthlyPerformanceCertificates()">شهادة الأداء الشهري</button><button class="btn btn-gold" onclick="AdminOfficesExtraDocs.openEditableStatement('absence')">بيان الغيابات</button><button class="btn btn-gold" onclick="AdminOfficesExtraDocs.openEditableStatement('vacation')">بيان الإجازات</button></div><div id="final-raise-letter-settings" class="section-box" style="background:#fff;border-style:dashed"><h3>إعدادات خطاب الرفع النهائي</h3><div class="settings-grid">${settingField('finalLetterHeaderLine1','سطر الترويسة 1')}${settingField('finalLetterHeaderLine2','سطر الترويسة 2')}${settingField('finalLetterHeaderLine3','سطر الترويسة 3')}${settingField('finalLetterSubject','الموضوع')}${settingField('finalLetterTo','الموجه إليه')}${settingField('finalLetterToSuffix','الصفة / المحترم')}${settingField('finalLetterGreeting','التحية')}${settingArea('finalLetterOpening','نص افتتاح الخطاب')}${settingArea('finalLetterClosing','العبارة الختامية')}${settingField('finalLetterRegards','تحية الختام')}${settingField('finalLetterSignatureTitle','صفة التوقيع')}${settingField('finalLetterSignatureName','اسم المسؤول')}</div><div class="btn-row"><button type="button" class="btn btn-primary" onclick="AdminOfficesExtraDocs.saveFinalSettingsFromSection()">حفظ إعدادات خطاب الرفع النهائي</button></div></div>`; const firstDataBox = Array.from(dialog.querySelectorAll('.section-box')).find(box => !box.id && ((box.querySelector('h3') || {}).textContent || '').includes('بيانات المستخلص')); if (firstDataBox) dialog.insertBefore(section, firstDataBox); else dialog.appendChild(section); }

  window.AdminOfficesExtraDocs = {
    generateFullExtractPrint,
    generateFinalFinancialRaiseLetter: () => openPrintDoc('خطاب الرفع النهائي للإدارة المالية', pageFinalRaiseLetter()),
    generateGroupedMonthlyEntitlementCertificate: () => openPrintDoc('شهادة الاستحقاق الشهري المجمعة', pageGroupedCertificate()),
    generateEntitlementStatement: () => openPrintDoc('بيان استحقاق العمالة', pageEntitlementStatement()),
    generateSalaryDeliveryCertificate: () => openPrintDoc('شهادة تسليم الرواتب', pageSalaryCertificate()),
    generateSaudiOccupiedJobsStatement: () => openPrintDoc('بيان الوظائف المشغولة بالسعوديين', pageSaudiEmployees()),
    generateMonthlyPerformanceCertificates: () => { const ks = centerKeys(); if (!ks.length) return alert('لا توجد مواقع متاحة لإصدار شهادة الأداء الشهري.'); openPrintDoc('شهادة الأداء الشهري لكل موقع', ks.map(pagePerformanceCertificate).join('')); },
    openEditableStatement,
    printEditableStatement,
    saveNote,
    saveFinalSettingsFromSection
  };

  if (!window.__adminExtraDocsObserver) { window.__adminExtraDocsObserver = new MutationObserver(installButtons); window.__adminExtraDocsObserver.observe(document.body, { childList: true, subtree: true }); }
  installButtons();
  setTimeout(installButtons, 700);
  setTimeout(installButtons, 1800);
  setTimeout(installButtons, 3200);
  console.info('[Admin Offices Extra Docs] installed v7 full extract print restored + Saudi statement');
})();