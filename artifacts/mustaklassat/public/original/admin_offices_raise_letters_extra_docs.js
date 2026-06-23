// ===================================================================
// Admin Offices Raise Letters Extra Documents
// Scope: admin_offices_attendance.html only
// كل الخطابات والبيانات الإضافية تظهر داخل صفحة خطابات الرفع
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;

  const SETTINGS_KEY = 'adminOfficesRaiseLettersSettings_v1';
  const NOTES_KEY = 'adminOfficesAbsenceVacationNotes_v1';

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value || {})); } catch (_) {}
  }

  function esc(v) {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function num(v) {
    const ar = '٠١٢٣٤٥٦٧٨٩';
    const fa = '۰۱۲۳۴۵۶۷۸۹';
    const s = String(v ?? '')
      .replace(/[٠-٩]/g, d => ar.indexOf(d))
      .replace(/[۰-۹]/g, d => fa.indexOf(d))
      .replace(/,/g, '')
      .replace(/[ ريال﷼()]/g, '')
      .trim();
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  function money(v) {
    return num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function moneySAR(v) {
    return `${money(v)} ريال`;
  }

  function clean(v) {
    return String(v ?? '').replace(/\s+/g, ' ').trim();
  }

  function firstValue() {
    for (const v of arguments) {
      const s = clean(v);
      if (s && s !== 'غير محدد' && s !== 'undefined' && s !== 'null' && s !== '—') return s;
    }
    return '';
  }

  function getSettings() {
    return Object.assign({
      recipient: 'سعادة / ................................',
      recipientSuffix: 'المحترم',
      entityTitle: 'المديرية العامة للشئون الصحية بمنطقة نجران',
      departmentTitle: 'إدارة الشئون الهندسية',
      scopeName: 'المكاتب الإدارية والمرافق الصحية وصيانة وإصلاح السيارات والعيادات المتنقلة',
      phoneFaxAr: 'نجران – تليفون 0175225872    فاكس 017523312',
      phoneFaxEn: 'Najran – Tel.: 0175225872       Fax: 017523312',
      managerTitle: '................................',
      managerName: '................................',
      unitManagerTitle: '................................',
      unitManagerName: '................................'
    }, readJson(SETTINGS_KEY, {}));
  }

  function getContract() { return readJson('persistentContractData', {}); }
  function getExtract() { return readJson('persistentExtractData', {}); }

  function getNames() {
    try { if (typeof window.getCenterNames === 'function') return window.getCenterNames() || {}; } catch (_) {}
    return readJson('adminOfficeNames_v1', {});
  }

  function getData() {
    const candidates = [];
    try { if (typeof window.getAttendanceData === 'function') candidates.push(window.getAttendanceData() || {}); } catch (_) {}
    candidates.push(readJson('adminOfficesAttendanceData_v1', {}));
    candidates.push(readJson('adminOfficesAttendanceData_v1_localBackup', {}));
    let best = {};
    const count = o => Object.values(o || {}).reduce((s, r) => s + (Array.isArray(r) ? r.length : 0), 0);
    candidates.forEach(c => { if (count(c) > count(best)) best = c; });
    return best;
  }

  function getCompanyName() {
    const c = getContract();
    return firstValue(
      c.contractorName,
      c.contractorCompany,
      c.companyName,
      c.company,
      c.contractor,
      c.supplierName,
      c.vendorName,
      localStorage.getItem('companyName'),
      document.querySelector('.companyName')?.textContent
    ) || 'غير محدد';
  }

  function contractName() {
    const c = getContract();
    return firstValue(c.contractName, c.projectName, c.contractTitle, c.name, c.scopeName, getSettings().scopeName) || getSettings().scopeName;
  }

  function formatDate(v) {
    if (!v) return 'غير محدد';
    try {
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-CA');
    } catch (_) {
      return 'غير محدد';
    }
  }

  function paymentNo() {
    const e = getExtract();
    const raw = firstValue(
      e.paymentNumber,
      e.extractNumber,
      e.paymentNo,
      e.extractNo,
      localStorage.getItem('paymentNumber'),
      localStorage.getItem('extractNumber'),
      localStorage.getItem('paymentNo')
    ) || '—';
    return /^\d+$/.test(raw) ? raw.padStart(2, '0') : raw;
  }

  function getPeriod() {
    try { if (typeof window.getExtractPeriodDetails === 'function') return window.getExtractPeriodDetails(); } catch (_) {}
    const e = getExtract();
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

  function extractPhrase() {
    const p = getPeriod();
    return `دفعة رقم (${esc(paymentNo())}) عن الفترة من ${esc(formatDate(p.startDate))} م إلى ${esc(formatDate(p.endDate))} م`;
  }

  function monthLabel() {
    const p = getPeriod();
    return p.startDate.toLocaleDateString('ar-SA', { month: 'long' });
  }

  function yearLabel() {
    return String(getPeriod().startDate.getFullYear());
  }

  function orderedKeys() {
    const names = getNames();
    const data = getData();
    return Array.from(new Set([...Object.keys(names || {}), ...Object.keys(data || {})]))
      .filter(k => k === 'admin_staff' || /^center_\d+$/.test(k) || Array.isArray(data[k]))
      .sort((a, b) => {
        if (/^center_\d+$/.test(a) && /^center_\d+$/.test(b)) return parseInt(a.split('_')[1], 10) - parseInt(b.split('_')[1], 10);
        if (/^center_\d+$/.test(a)) return -1;
        if (/^center_\d+$/.test(b)) return 1;
        if (a === 'admin_staff') return 1;
        if (b === 'admin_staff') return -1;
        return String(a).localeCompare(String(b), 'ar');
      });
  }

  function isWorkshopKey(key) {
    const name = getNames()[key] || key;
    return key === 'admin_staff' || /ورش|صيانة|إصلاح|اصلاح|سيارات/.test(String(name));
  }

  function statusMeta(code) {
    return (window.STATUS_CODES && window.STATUS_CODES[code]) || {};
  }

  function isAbsenceCode(code) {
    const st = statusMeta(code);
    return !!st.isAbsence || code === 'غ';
  }

  function isVacationCode(code) {
    const st = statusMeta(code);
    const name = `${code} ${st.name || ''}`;
    return !isAbsenceCode(code) && /(إجاز|اجاز|ج|ش)/.test(name) && code !== 'ح';
  }

  function calcEmployee(emp) {
    const p = getPeriod();
    const c = getContract();
    if (typeof window.calculateAdminOfficeEmployeeFinancials === 'function') {
      return window.calculateAdminOfficeEmployeeFinancials(emp, {
        totalDaysInMonth: p.totalDaysInMonth,
        daysInExtract: p.daysInExtract,
        contractType: c.contractType || 'عقد أساسي',
        directPurchaseRatio: num(c.directPurchaseRatio)
      });
    }
    const days = Array.isArray(emp.days) ? emp.days.slice(0, p.daysInExtract) : [];
    while (days.length < p.daysInExtract) days.push('ح');
    const salary = num(emp.salary);
    const daily = p.totalDaysInMonth > 0 ? salary / p.totalDaysInMonth : 0;
    let costForPeriod = daily * p.daysInExtract;
    const absenceDays = days.filter(isAbsenceCode).length;
    const deduction = absenceDays * daily;
    const nationalityFine = num(emp.nationalityFine);
    const absenceFine = 0;
    return { days, costForPeriod, deduction, absenceFine, nationalityFine, totalFine: absenceFine + nationalityFine, netSalary: costForPeriod - deduction - absenceFine - nationalityFine };
  }

  function calcSite(key) {
    if (window.AdminOfficesRaiseLetters && typeof window.AdminOfficesRaiseLetters.calcSite === 'function') {
      const c = window.AdminOfficesRaiseLetters.calcSite(key) || {};
      return {
        cost: num(c.cost),
        absenceDeduction: num(c.absenceDeduction),
        absenceFine: num(c.absenceFine),
        nationalityFine: num(c.nationalityFine),
        totalDeduction: num(c.absenceDeduction) + num(c.absenceFine) + num(c.nationalityFine) + num(c.performanceDeduction),
        finalNet: num(c.finalNet)
      };
    }

    const rows = getData()[key] || [];
    return rows.reduce((out, emp) => {
      const c = calcEmployee(emp);
      out.cost += num(c.costForPeriod);
      out.absenceDeduction += num(c.deduction);
      out.absenceFine += num(c.absenceFine);
      out.nationalityFine += num(c.nationalityFine);
      out.totalDeduction += num(c.deduction) + num(c.absenceFine) + num(c.nationalityFine);
      out.finalNet += num(c.netSalary);
      return out;
    }, { cost: 0, absenceDeduction: 0, absenceFine: 0, nationalityFine: 0, totalDeduction: 0, finalNet: 0 });
  }

  function groupTotals() {
    const out = {
      offices: { label: 'المكاتب الإدارية والمرافق الصحية', cost: 0, absenceDeduction: 0, absenceFine: 0, nationalityFine: 0, totalDeduction: 0, finalNet: 0 },
      workshops: { label: 'صيانة وإصلاح السيارات', cost: 0, absenceDeduction: 0, absenceFine: 0, nationalityFine: 0, totalDeduction: 0, finalNet: 0 }
    };
    orderedKeys().forEach(key => {
      const target = isWorkshopKey(key) ? out.workshops : out.offices;
      const c = calcSite(key);
      ['cost', 'absenceDeduction', 'absenceFine', 'nationalityFine', 'totalDeduction', 'finalNet'].forEach(k => { target[k] += num(c[k]); });
    });
    return out;
  }

  function signatureHtml(two) {
    const s = getSettings();
    if (two) {
      return `<div class="signatures"><div><div class="sig-title">${esc(s.unitManagerTitle)}</div><div class="line"></div><div class="sig-name">${esc(s.unitManagerName)}</div></div><div><div class="sig-title">${esc(s.managerTitle)}</div><div class="line"></div><div class="sig-name">${esc(s.managerName)}</div></div></div>`;
    }
    return `<div class="signatures one"><div><div class="sig-title">${esc(s.managerTitle)}</div><div class="line"></div><div class="sig-name">${esc(s.managerName)}</div></div></div>`;
  }

  function headerHtml() {
    const s = getSettings();
    return `<div class="head"><img src="moh_logo.png"><div><h1>${esc(s.entityTitle)}</h1><h2>${esc(s.departmentTitle)}</h2></div><img src="moh_logo.png"></div>`;
  }

  function footerHtml() {
    const s = getSettings();
    return `<div class="footer"><span>${esc(s.phoneFaxEn)}</span><span dir="rtl">${esc(s.phoneFaxAr)}</span></div>`;
  }

  function docCss() {
    return `<style>
      @page{size:A4 portrait;margin:12mm} @page landscape{size:A4 landscape;margin:7mm}
      *{box-sizing:border-box}body{margin:0;background:#e9eef5;direction:rtl;font-family:Tajawal,Arial,sans-serif;color:#111827}.toolbar{position:sticky;top:0;background:#111827;padding:10px;text-align:center;z-index:5}.toolbar button{background:#d4af37;border:0;border-radius:10px;padding:10px 18px;font-weight:900;cursor:pointer}.page{width:210mm;min-height:297mm;margin:12px auto;background:#fff;padding:14mm 15mm 18mm;box-shadow:0 10px 30px rgba(15,23,42,.16);position:relative}.page.landscape{width:297mm;min-height:210mm;page:landscape;padding:10mm}.head{display:grid;grid-template-columns:78px 1fr 78px;align-items:center;border-bottom:2px solid #003087;padding-bottom:9px;margin-bottom:18px}.head img{width:68px}.head div{text-align:center}.head h1{font-size:17px;margin:0 0 4px;color:#003087}.head h2{font-size:15px;margin:0}.cert-title{text-align:center;font-size:21px;font-weight:900;margin:18px 0 12px}.sub-title{text-align:center;font-size:16px;font-weight:800;margin:8px 0 15px;line-height:1.8}.body-text{font-size:16px;line-height:2.2;text-align:justify;margin-top:22px}.amount-table{width:100%;border-collapse:collapse;margin:14px 0;font-size:13px}.amount-table th{background:#003087;color:#fff}.amount-table th,.amount-table td{border:1px solid #333;padding:7px;text-align:center}.amount-table td:first-child{text-align:right}.total-row td{background:#fff7d6;font-weight:900}.signatures{display:grid;grid-template-columns:repeat(2,1fr);gap:20px;margin-top:42px;text-align:center}.signatures.one{display:block}.signatures.one>div{width:78mm;margin-right:auto;margin-left:0;text-align:center}.sig-title{font-weight:900;margin-bottom:18px}.line{height:34px;border-bottom:1px solid #111;margin:0 18px 10px}.sig-name{font-weight:900}.footer{position:absolute;bottom:8mm;left:15mm;right:15mm;border-top:1px solid #cbd5e1;padding-top:5px;font-size:11px;display:flex;justify-content:space-between;direction:ltr}.editable-notes-table input{width:100%;border:1px solid #cbd5e1;border-radius:6px;padding:5px;font-family:inherit}.settings-overlay{position:fixed;inset:0;background:rgba(15,23,42,.72);z-index:999999;display:flex;align-items:center;justify-content:center;padding:18px}.settings-dialog{width:min(1200px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:18px;padding:18px}.btn-row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin:12px 0}.btn{border:0;border-radius:10px;padding:9px 14px;font-weight:900;cursor:pointer}.btn-primary{background:#003087;color:#fff}.btn-gold{background:#d4af37;color:#111}.btn-light{background:#f1f5f9;color:#111;border:1px solid #cbd5e1}@media print{body{background:#fff}.toolbar,.settings-overlay{display:none!important}.page{margin:0;box-shadow:none;page-break-after:always}.page:last-child{page-break-after:auto}}
    </style>`;
  }

  function openPrintDoc(title, html) {
    const win = window.open('', '', 'width=1100,height=900');
    if (!win) return alert('المتصفح منع نافذة الطباعة. اسمح بالنوافذ المنبثقة.');
    win.document.open();
    win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>${esc(title)}</title><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">${docCss()}</head><body><div class="toolbar"><button onclick="window.print()">طباعة</button><button onclick="window.close()" style="margin-right:8px">إغلاق</button></div>${html}</body></html>`);
    win.document.close();
  }

  function generateGroupedMonthlyEntitlementCertificate() {
    const g = groupTotals();
    const total = ['cost', 'absenceDeduction', 'absenceFine', 'nationalityFine', 'totalDeduction', 'finalNet'].reduce((o, k) => { o[k] = g.offices[k] + g.workshops[k]; return o; }, {});
    const rows = [g.offices, g.workshops].map(r => `<tr><td>${esc(r.label)}</td><td>${moneySAR(r.cost)}</td><td>${moneySAR(r.absenceDeduction)}</td><td>${moneySAR(r.absenceFine)}</td><td>${moneySAR(r.nationalityFine)}</td><td>${moneySAR(r.totalDeduction)}</td><td>${moneySAR(r.finalNet)}</td></tr>`).join('');
    const title = `شهادة الاستحقاق الشهري للعماله لأعمال النظافة والصيانة والتشغيل غير الطبي لمشروع ${getSettings().scopeName}`;
    const html = `<section class="page">${headerHtml()}<div class="cert-title">${esc(title)}</div><div class="sub-title">لشركة / ${esc(getCompanyName())}<br>${extractPhrase()}</div><table class="amount-table"><thead><tr><th>البند</th><th>تكاليف العمالة</th><th>حسم الغياب</th><th>غرامة الغياب</th><th>غرامة الجنسية</th><th>إجمالي الحسم</th><th>الصافي المستحق</th></tr></thead><tbody>${rows}<tr class="total-row"><td>الإجمالي</td><td>${moneySAR(total.cost)}</td><td>${moneySAR(total.absenceDeduction)}</td><td>${moneySAR(total.absenceFine)}</td><td>${moneySAR(total.nationalityFine)}</td><td>${moneySAR(total.totalDeduction)}</td><td>${moneySAR(total.finalNet)}</td></tr></tbody></table>${signatureHtml(true)}${footerHtml()}</section>`;
    openPrintDoc('شهادة الاستحقاق الشهري المجمعة', html);
  }

  function generateEntitlementStatement() {
    const rows = orderedKeys().map(key => {
      const c = calcSite(key);
      const name = getNames()[key] || key;
      return `<tr><td>${esc(name)}</td><td>${esc(monthLabel())}</td><td>${moneySAR(c.cost)}</td><td>${moneySAR(c.absenceDeduction)}</td><td>${moneySAR(c.absenceFine)}</td><td>${moneySAR(c.nationalityFine)}</td><td>${moneySAR(c.totalDeduction)}</td><td>${moneySAR(c.finalNet)}</td></tr>`;
    }).join('');
    const html = `<section class="page landscape">${headerHtml()}<div class="cert-title">بيان استحقاق</div><div class="sub-title">اسم الشركة: ${esc(getCompanyName())} &nbsp; | &nbsp; عقد: ${esc(contractName())}<br>لشهر ${esc(monthLabel())} سنة ${esc(yearLabel())} — ${extractPhrase()}</div><table class="amount-table"><thead><tr><th>اسم المشروع / الموقع</th><th>شهر الاستحقاق</th><th>تكاليف العمالة</th><th>حسم الغياب</th><th>غرامة الغياب</th><th>غرامة الجنسية</th><th>إجمالي الحسم</th><th>الصافي المستحق</th></tr></thead><tbody>${rows}</tbody></table>${signatureHtml(true)}${footerHtml()}</section>`;
    openPrintDoc('بيان استحقاق العمالة', html);
  }

  function generateSalaryDeliveryCertificate() {
    const html = `<section class="page">${headerHtml()}<div class="cert-title" style="font-size:34px;margin-top:42px">شهادة</div><div class="body-text" style="font-size:18px;text-align:center;margin-top:35px">تشهد إدارة الصيانة بصحة نجران بأن شركة <strong>${esc(getCompanyName())}</strong> قامت بتسليم جميع رواتب لكل منسوبيها داخل الموقع عن شهر <strong>${esc(monthLabel())}</strong> والفترة <strong>${esc(extractPhrase())}</strong>.</div><div class="body-text" style="text-align:center;font-weight:900;margin-top:30px">هذا مشهد منا بذلك.</div>${signatureHtml(true)}${footerHtml()}</section>`;
    openPrintDoc('شهادة تسليم الرواتب', html);
  }

  function dateForIndex(index) {
    const p = getPeriod();
    const d = new Date(p.startDate);
    d.setDate(p.startDate.getDate() + index);
    return formatDate(d);
  }

  function buildSegments(type) {
    const names = getNames();
    const data = getData();
    const matcher = type === 'absence' ? isAbsenceCode : isVacationCode;
    const out = [];
    orderedKeys().forEach(centerKey => {
      (data[centerKey] || []).forEach(emp => {
        const calc = calcEmployee(emp);
        const days = calc.days || [];
        let start = -1;
        for (let i = 0; i <= days.length; i++) {
          const matched = i < days.length && matcher(days[i]);
          if (matched && start < 0) start = i;
          if ((!matched || i === days.length) && start >= 0) {
            out.push({
              key: `${type}|${centerKey}|${emp.iqamaId || emp.name || ''}|${start}|${i - 1}`,
              site: names[centerKey] || centerKey,
              jobTitle: emp.jobTitle || '',
              from: dateForIndex(start),
              to: dateForIndex(i - 1),
              note: ''
            });
            start = -1;
          }
        }
      });
    });
    const notes = readJson(NOTES_KEY, {});
    out.forEach(r => { r.note = notes[r.key] || ''; });
    return out;
  }

  function saveNote(key, value) {
    const notes = readJson(NOTES_KEY, {});
    notes[key] = value || '';
    writeJson(NOTES_KEY, notes);
  }

  function openEditableStatement(type) {
    const title = type === 'absence' ? 'بيان ملخص الغيابات' : 'بيان ملخص الإجازات';
    const rows = buildSegments(type);
    const tbody = rows.length ? rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.jobTitle)}</td><td>${esc(r.from)}</td><td>${esc(r.to)}</td><td>${esc(r.site)}</td><td><input data-note-key="${esc(r.key)}" value="${esc(r.note)}" oninput="AdminOfficesExtraDocs.saveNote(this.dataset.noteKey,this.value)"></td></tr>`).join('') : `<tr><td colspan="6">لا توجد بيانات ${type === 'absence' ? 'غيابات' : 'إجازات'} في المستخلص الحالي.</td></tr>`;
    const overlay = `<div class="settings-overlay" id="extra-docs-edit-overlay"><div class="settings-dialog"><h2>${esc(title)}</h2><div class="btn-row"><button class="btn btn-gold" onclick="AdminOfficesExtraDocs.printEditableStatement('${type}')">طباعة</button><button class="btn btn-light" onclick="document.getElementById('extra-docs-edit-overlay')?.remove()">إغلاق</button></div><p style="font-weight:900;color:#334155;text-align:center">الملاحظات تحفظ تلقائيًا أثناء الكتابة.</p><table class="amount-table editable-notes-table"><thead><tr><th>مسلسل</th><th>اسم الوظيفة</th><th>الفترة من</th><th>إلى</th><th>الموقع</th><th>ملاحظات</th></tr></thead><tbody>${tbody}</tbody></table></div></div>`;
    document.getElementById('extra-docs-edit-overlay')?.remove();
    document.body.insertAdjacentHTML('beforeend', overlay);
  }

  function printEditableStatement(type) {
    const title = type === 'absence' ? 'بيان ملخص الغيابات' : 'بيان ملخص الإجازات';
    const rows = buildSegments(type);
    const tbody = rows.length ? rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.jobTitle)}</td><td>${esc(r.from)}</td><td>${esc(r.to)}</td><td>${esc(r.site)}</td><td>${esc(r.note)}</td></tr>`).join('') : `<tr><td colspan="6">لا توجد بيانات.</td></tr>`;
    const html = `<section class="page landscape">${headerHtml()}<div class="cert-title">${esc(title)}</div><div class="sub-title">${extractPhrase()} — شهر ${esc(monthLabel())}</div><table class="amount-table"><thead><tr><th>مسلسل</th><th>اسم الوظيفة</th><th>الفترة من</th><th>إلى</th><th>الموقع</th><th>ملاحظات</th></tr></thead><tbody>${tbody}</tbody></table>${signatureHtml(true)}${footerHtml()}</section>`;
    openPrintDoc(title, html);
  }

  function installButtons() {
    const overlay = document.getElementById('raise-letters-overlay');
    if (!overlay || overlay.querySelector('#admin-extra-docs-section')) return;
    const dialog = overlay.querySelector('.settings-dialog');
    if (!dialog) return;
    const section = document.createElement('div');
    section.id = 'admin-extra-docs-section';
    section.className = 'section-box';
    section.innerHTML = `<h3>خطابات وبيانات إضافية</h3><div class="btn-row"><button class="btn btn-gold" onclick="AdminOfficesExtraDocs.generateGroupedMonthlyEntitlementCertificate()">شهادة الاستحقاق الشهري المجمعة</button><button class="btn btn-gold" onclick="AdminOfficesExtraDocs.generateEntitlementStatement()">بيان استحقاق</button><button class="btn btn-gold" onclick="AdminOfficesExtraDocs.generateSalaryDeliveryCertificate()">شهادة تسليم الرواتب</button><button class="btn btn-gold" onclick="AdminOfficesExtraDocs.openEditableStatement('absence')">بيان الغيابات</button><button class="btn btn-gold" onclick="AdminOfficesExtraDocs.openEditableStatement('vacation')">بيان الإجازات</button></div>`;
    const signaturesBox = Array.from(dialog.querySelectorAll('.section-box')).find(box => (box.querySelector('h3')?.textContent || '').includes('التواقيع'));
    if (signaturesBox) dialog.insertBefore(section, signaturesBox);
    else dialog.appendChild(section);
  }

  function observe() {
    if (window.__adminExtraDocsObserver) return;
    window.__adminExtraDocsObserver = new MutationObserver(installButtons);
    window.__adminExtraDocsObserver.observe(document.body, { childList: true, subtree: true });
  }

  window.AdminOfficesExtraDocs = {
    generateGroupedMonthlyEntitlementCertificate,
    generateEntitlementStatement,
    generateSalaryDeliveryCertificate,
    openEditableStatement,
    printEditableStatement,
    saveNote
  };

  observe();
  installButtons();
  setTimeout(installButtons, 700);
  setTimeout(installButtons, 1800);
  setTimeout(installButtons, 3200);
  console.info('[Admin Offices Extra Docs] installed inside raise letters page');
})();