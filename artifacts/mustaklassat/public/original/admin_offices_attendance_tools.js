// ===================================================================
// Admin Offices Attendance Tools
// Scope: admin_offices_attendance.html only
// - رقم الدفعة في معلومات الصفحة
// - تامبلت Excel لكل المواقع
// - تعديل جماعي للحضور مع اختيار الموظفين
// - خيار خطابات الموقع داخل نافذة الطباعة
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;

  const SETTINGS_KEY = 'adminOfficesRaiseLettersSettings_v1';

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function esc(v) {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function num(v) {
    const n = Number(String(v ?? '').replace(/,/g, '').replace(/[ ريال﷼()]/g, '').trim());
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

  function getNames() {
    try { if (typeof window.getCenterNames === 'function') return window.getCenterNames() || {}; } catch (_) {}
    return readJson('adminOfficeNames_v1', {});
  }

  function getData() {
    try { if (typeof window.getAttendanceData === 'function') return window.getAttendanceData() || {}; } catch (_) {}
    return readJson('adminOfficesAttendanceData_v1', {});
  }

  function saveData(data) {
    try { if (typeof window.saveAttendanceData === 'function') return window.saveAttendanceData(data || {}); } catch (_) {}
    localStorage.setItem('adminOfficesAttendanceData_v1', JSON.stringify(data || {}));
  }

  function getContract() {
    return readJson('persistentContractData', {});
  }

  function getExtract() {
    return readJson('persistentExtractData', {});
  }

  function paymentNo() {
    const e = getExtract();
    const raw = firstValue(
      e.paymentNumber,
      e.extractNumber,
      e.paymentNo,
      e.extractNo,
      e.batchNumber,
      localStorage.getItem('paymentNumber'),
      localStorage.getItem('extractNumber'),
      localStorage.getItem('paymentNo'),
      localStorage.getItem('extractNo'),
      localStorage.getItem('batchNumber')
    ) || '—';
    return /^\d+$/.test(raw) ? raw.padStart(2, '0') : raw;
  }

  function fmtDate(v) {
    if (!v) return 'غير محدد';
    try {
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-CA');
    } catch (_) {
      return 'غير محدد';
    }
  }

  function extractPhrase() {
    const e = getExtract();
    return `دفعة رقم (${esc(paymentNo())}) عن الفترة من ${esc(fmtDate(e.extractStart || localStorage.getItem('extractStart')))} م إلى ${esc(fmtDate(e.extractEnd || localStorage.getItem('extractEnd')))} م`;
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

  function getPeriod() {
    try { if (typeof window.getExtractPeriodDetails === 'function') return window.getExtractPeriodDetails(); } catch (_) {}
    const e = getExtract();
    const start = new Date(e.extractStart || Date.now());
    const end = new Date(e.extractEnd || e.extractStart || Date.now());
    const safeStart = Number.isNaN(start.getTime()) ? new Date() : start;
    const safeEnd = Number.isNaN(end.getTime()) ? safeStart : end;
    return {
      startDate: safeStart,
      daysInExtract: Math.max(1, Math.ceil((safeEnd - safeStart) / 86400000) + 1 || 30),
      totalDaysInMonth: new Date(safeStart.getFullYear(), safeStart.getMonth() + 1, 0).getDate() || 30
    };
  }

  function installPaymentNumberDisplay() {
    const box = document.querySelector('.page-contract-info-v2 p');
    if (!box) return;

    if (!box.querySelector('.paymentNumber')) {
      const separator = document.createElement('span');
      separator.className = 'separator payment-number-separator';
      separator.textContent = '|';

      const wrapper = document.createElement('span');
      wrapper.className = 'payment-number-wrapper';
      wrapper.innerHTML = '<strong>رقم الدفعة:</strong> <span class="paymentNumber">—</span>';

      const duration = box.querySelector('#extract-start-date')?.closest('span');
      if (duration) {
        box.insertBefore(separator, duration);
        box.insertBefore(wrapper, duration);
      } else {
        box.appendChild(separator);
        box.appendChild(wrapper);
      }
    }

    document.querySelectorAll('.paymentNumber').forEach(el => { el.textContent = paymentNo(); });
  }

  function patchContractDisplay() {
    const old = window.updateContractDisplayData;
    if (old && !old.__paymentNumberPatched) {
      window.updateContractDisplayData = function patchedUpdateContractDisplayData() {
        const out = old.apply(this, arguments);
        installPaymentNumberDisplay();
        return out;
      };
      window.updateContractDisplayData.__paymentNumberPatched = true;
    }
    installPaymentNumberDisplay();
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
    const costForPeriod = daily * p.daysInExtract;
    const absenceDays = days.filter(d => d === 'غ').length;
    const deduction = absenceDays * daily;
    const netSalary = costForPeriod - deduction;
    return { days, costForPeriod, attendanceDays: days.length - absenceDays, absenceDays, deduction, absenceFine: 0, nationalityFine: num(emp.nationalityFine), netSalary };
  }

  function safeSheetName(name, used) {
    let base = String(name || 'Sheet').replace(/[\\/?*\[\]:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Sheet';
    let out = base;
    let i = 2;
    while (used.has(out)) {
      const suffix = ` ${i++}`;
      out = base.slice(0, 31 - suffix.length) + suffix;
    }
    used.add(out);
    return out;
  }

  function downloadAdminOfficesAllSitesTemplate() {
    if (!window.XLSX) {
      alert('مكتبة Excel غير محملة. أعد تحميل الصفحة ثم جرّب مرة أخرى.');
      return;
    }

    const names = getNames();
    const data = getData();
    const p = getPeriod();
    const dayHeaders = Array.from({ length: p.daysInExtract }, (_, i) => i + 1);
    const headers = ['م', 'مسمى الوظيفة', 'الفئة', 'اسم شاغل الوظيفة', ...dayHeaders, 'التكلفة الشهرية', 'حضور', 'غياب', 'الحسم', 'غرامة الغياب', 'صافي الاستحقاق', 'الجنسية', 'غرامة جنسية', 'رقم الإقامة/الهوية'];
    const wb = XLSX.utils.book_new();
    const used = new Set();

    orderedKeys().forEach(key => {
      const rows = Array.isArray(data[key]) ? data[key] : [];
      const aoa = [[names[key] || key], ['ملاحظة: عدّل بيانات الموظفين وحالات الأيام ثم ارفع الملف من زر Excel > استيراد كل الشيتات حسب أسماء المكاتب'], headers];

      if (rows.length) {
        rows.forEach((emp, idx) => {
          const calc = calcEmployee(emp);
          const days = calc.days || Array(p.daysInExtract).fill('ح');
          aoa.push([
            idx + 1,
            emp.jobTitle || '',
            emp.category || '',
            emp.name || '',
            ...days,
            num(emp.salary),
            calc.attendanceDays || 0,
            calc.absenceDays || 0,
            money(calc.deduction || 0),
            money(calc.absenceFine || 0),
            money(calc.netSalary || 0),
            emp.nationality || '',
            num(emp.nationalityFine),
            emp.iqamaId || ''
          ]);
        });
      } else {
        aoa.push(['', '', '', '', ...Array(p.daysInExtract).fill('ح'), '', '', '', '', '', '', '', '', '']);
      }

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = headers.map((h, i) => ({ wch: i >= 4 && i < 4 + p.daysInExtract ? 4 : 16 }));
      XLSX.utils.book_append_sheet(wb, ws, safeSheetName(names[key] || key, used));
    });

    XLSX.writeFile(wb, `تامبلت_كل_مواقع_المكاتب_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function installTemplateButton() {
    const bar = document.getElementById('main-action-buttons');
    if (!bar || document.getElementById('download-admin-offices-all-template-btn')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'download-admin-offices-all-template-btn';
    btn.className = 'ab ab-excel no-print';
    btn.innerHTML = '<i class="fas fa-file-download"></i> تامبلت كل المواقع';
    btn.onclick = downloadAdminOfficesAllSitesTemplate;

    const exportBtn = Array.from(bar.querySelectorAll('button')).find(b => (b.textContent || '').includes('تصدير Excel'));
    if (exportBtn && exportBtn.nextSibling) bar.insertBefore(btn, exportBtn.nextSibling);
    else bar.appendChild(btn);
  }

  function statusOptionsHtml() {
    return Object.keys(window.STATUS_CODES || { ح: { name: 'حاضر' }, غ: { name: 'غائب' } })
      .filter(code => code !== 'default')
      .map(code => `<option value="${esc(code)}">${esc(code)} — ${esc((window.STATUS_CODES[code] || {}).name || code)}</option>`)
      .join('');
  }

  function dayOptionsHtml() {
    const p = getPeriod();
    return Array.from({ length: p.daysInExtract }, (_, i) => {
      const d = new Date(p.startDate);
      d.setDate(p.startDate.getDate() + i);
      return `<option value="${i}">اليوم ${i + 1} — ${d.getDate()}</option>`;
    }).join('');
  }

  function activeCenterKey() {
    try { if (typeof window.getActiveAdminOfficeCenterKey === 'function') return window.getActiveAdminOfficeCenterKey(); } catch (_) {}
    const active = document.querySelector('.tab-link.active[data-center-key]');
    return active?.dataset?.centerKey || '';
  }

  function renderBulkEmployeeList() {
    const container = document.getElementById('admin-bulk-employees-list');
    if (!container) return;
    const names = getNames();
    const data = getData();
    const selectedCenters = Array.from(document.querySelectorAll('.admin-office-bulk-center:checked')).map(cb => cb.value);

    if (!selectedCenters.length) {
      container.innerHTML = '<div class="readonly-box">اختر مكتبًا أو مرفقًا لعرض أسماء الموظفين.</div>';
      return;
    }

    const html = selectedCenters.map(centerKey => {
      const rows = Array.isArray(data[centerKey]) ? data[centerKey] : [];
      const empHtml = rows.length ? rows.map((emp, idx) => {
        const id = `bulk-emp-${centerKey}-${idx}`;
        return `<label class="admin-bulk-emp-row"><input type="checkbox" class="admin-office-bulk-employee" value="${esc(centerKey)}::${idx}" data-center="${esc(centerKey)}" checked><span>${esc(emp.name || 'بدون اسم')}</span><small>${esc(emp.jobTitle || '')} — ${esc(emp.iqamaId || '')}</small></label>`;
      }).join('') : '<div class="admin-bulk-empty">لا توجد أسماء موظفين في هذا الموقع.</div>';

      return `<div class="admin-bulk-emp-group"><div class="admin-bulk-emp-head"><strong>${esc(names[centerKey] || centerKey)}</strong><button type="button" class="btn btn-light" onclick="AdminOfficesTools.toggleEmployeesForCenter('${esc(centerKey)}', true)">تحديد موظفي الموقع</button><button type="button" class="btn btn-light" onclick="AdminOfficesTools.toggleEmployeesForCenter('${esc(centerKey)}', false)">إلغاء موظفي الموقع</button></div>${empHtml}</div>`;
    }).join('');

    container.innerHTML = html;
  }

  function toggleEmployeesForCenter(centerKey, checked) {
    document.querySelectorAll(`.admin-office-bulk-employee[data-center="${centerKey}"]`).forEach(cb => { cb.checked = !!checked; });
  }

  function selectAllBulkEmployees(checked) {
    document.querySelectorAll('.admin-office-bulk-employee').forEach(cb => { cb.checked = !!checked; });
  }

  function openAdminOfficesBulkAttendanceDialog() {
    const names = getNames();
    const keys = orderedKeys();
    const active = activeCenterKey();
    const defaultKey = active || keys[0] || '';
    const dayOptions = dayOptionsHtml();
    const statusOptions = statusOptionsHtml();

    const centerChecks = keys.map(key => `
      <label class="admin-bulk-center-row">
        <input type="checkbox" class="admin-office-bulk-center" value="${esc(key)}" ${key === defaultKey ? 'checked' : ''} onchange="AdminOfficesTools.renderBulkEmployeeList()">
        <span>${esc(names[key] || key)}</span>
      </label>
    `).join('');

    const content = `
      <div class="dialog-header">
        <h3><i class="fas fa-calendar-alt"></i> تعديل جماعي للحضور والانصراف</h3>
        <span class="close" onclick="closeDialog('management-dialog')">×</span>
      </div>
      <div class="dialog-body">
        <p class="info-text">اختر المكاتب ثم اختر الموظفين المطلوب تعديل حضورهم. يمكن تحديد الكل أو موظفين محددين فقط.</p>
        <div class="form-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
          <div class="form-group"><label>من يوم:</label><select id="admin-bulk-start-day">${dayOptions}</select></div>
          <div class="form-group"><label>إلى يوم:</label><select id="admin-bulk-end-day">${dayOptions}</select></div>
          <div class="form-group"><label>الحالة الجديدة:</label><select id="admin-bulk-status">${statusOptions}</select></div>
        </div>
        <hr style="margin:14px 0;">
        <fieldset>
          <legend>1. اختيار المكاتب والمرافق</legend>
          <div class="form-group-checkbox all-selector"><input type="checkbox" id="admin-bulk-select-all" onchange="document.querySelectorAll('.admin-office-bulk-center').forEach(cb => cb.checked = this.checked); AdminOfficesTools.renderBulkEmployeeList();"><label for="admin-bulk-select-all"><strong>تحديد كل المكاتب / إلغاء الكل</strong></label></div>
          <div class="admin-bulk-centers-grid">${centerChecks}</div>
        </fieldset>
        <fieldset style="margin-top:14px;">
          <legend>2. اختيار الموظفين</legend>
          <div class="btn-row" style="justify-content:flex-start;"><button type="button" class="btn btn-light" onclick="AdminOfficesTools.selectAllBulkEmployees(true)">تحديد كل الموظفين المعروضين</button><button type="button" class="btn btn-light" onclick="AdminOfficesTools.selectAllBulkEmployees(false)">إلغاء كل الموظفين المعروضين</button></div>
          <div id="admin-bulk-employees-list" class="admin-bulk-employees-list"></div>
        </fieldset>
      </div>
      <div class="dialog-footer">
        <button class="btn btn-secondary" onclick="closeDialog('management-dialog')"><i class="fas fa-times"></i> إلغاء</button>
        <button class="btn btn-success" onclick="AdminOfficesTools.applyBulkAttendance()"><i class="fas fa-check"></i> تطبيق التعديل</button>
      </div>
    `;

    if (typeof window.openDialog === 'function') window.openDialog(content, 'management-dialog', true);
    setTimeout(renderBulkEmployeeList, 50);
  }

  function applyBulkAttendance() {
    const startIndex = parseInt(document.getElementById('admin-bulk-start-day')?.value || '0', 10);
    const endIndex = parseInt(document.getElementById('admin-bulk-end-day')?.value || '0', 10);
    const newStatus = document.getElementById('admin-bulk-status')?.value || 'ح';
    const selectedCenters = Array.from(document.querySelectorAll('.admin-office-bulk-center:checked')).map(cb => cb.value);
    const selectedEmployees = Array.from(document.querySelectorAll('.admin-office-bulk-employee:checked')).map(cb => cb.value);

    if (!selectedCenters.length) return alert('اختر مكتبًا أو مرفقًا واحدًا على الأقل.');
    if (!selectedEmployees.length) return alert('اختر موظفًا واحدًا على الأقل.');
    if (startIndex > endIndex) return alert('مدى الأيام غير صحيح. يوم البداية أكبر من يوم النهاية.');
    if (!window.STATUS_CODES || !window.STATUS_CODES[newStatus]) return alert('حالة الحضور المختارة غير صحيحة.');

    if (!confirm(`سيتم تطبيق الحالة "${newStatus}" على ${selectedEmployees.length} موظف خلال الفترة المحددة.\n\nهل تريد الاستمرار؟`)) return;

    const p = getPeriod();
    const data = getData();
    let affectedEmployees = 0;

    selectedEmployees.forEach(token => {
      const parts = token.split('::');
      const centerKey = parts[0];
      const idx = parseInt(parts[1], 10);
      const emp = data[centerKey] && data[centerKey][idx];
      if (!emp) return;
      const days = Array.isArray(emp.days) ? emp.days.slice(0, p.daysInExtract) : [];
      while (days.length < p.daysInExtract) days.push('ح');
      for (let i = startIndex; i <= endIndex && i < p.daysInExtract; i++) days[i] = newStatus;
      emp.days = days;
      affectedEmployees++;
    });

    saveData(data);
    try { if (typeof window.renderCenterIcons === 'function') window.renderCenterIcons(); } catch (_) {}
    try { if (typeof window.calculateAndDisplayGrandTotal === 'function') window.calculateAndDisplayGrandTotal(); } catch (_) {}

    const active = activeCenterKey();
    if (active && selectedCenters.includes(active)) {
      try { if (typeof window.renderAttendanceTable === 'function') window.renderAttendanceTable(active); } catch (_) {
        try { if (typeof window.populateAttendanceTableBody === 'function') window.populateAttendanceTableBody(active); } catch (_) {}
      }
    }

    try { if (typeof window.closeDialog === 'function') window.closeDialog('management-dialog'); } catch (_) {}
    alert(`تم تطبيق التعديل الجماعي بنجاح.\n\nعدد المكاتب/المرافق: ${selectedCenters.length}\nعدد الموظفين المتأثرين: ${affectedEmployees}`);
  }

  function settings() {
    return Object.assign({
      recipient: 'سعادة / ................................',
      recipientSuffix: 'المحترم',
      entityTitle: 'المديرية العامة للشئون الصحية بمنطقة نجران',
      departmentTitle: 'إدارة الشئون الهندسية',
      scopeName: 'المكاتب الإدارية والمرافق الصحية وصيانة وإصلاح السيارات والعيادات المتنقلة',
      phoneFaxAr: 'نجران – تليفون 0175225872    فاكس 017523312',
      phoneFaxEn: 'Najran – Tel.: 0175225872       Fax: 017523312',
      managerTitle: '................................',
      managerName: '................................'
    }, readJson(SETTINGS_KEY, {}));
  }

  function siteAmount(centerKey) {
    if (window.AdminOfficesRaiseLetters && typeof window.AdminOfficesRaiseLetters.calcSite === 'function') {
      return num(window.AdminOfficesRaiseLetters.calcSite(centerKey).finalNet);
    }
    const rows = getData()[centerKey] || [];
    return rows.reduce((sum, emp) => sum + num(calcEmployee(emp).netSalary), 0);
  }

  function tafqeet(amount) {
    if (window.AdminOfficesRaiseLetters && typeof window.AdminOfficesRaiseLetters.tafqeetSAR === 'function') return window.AdminOfficesRaiseLetters.tafqeetSAR(amount);
    return `فقط وقدره ${money(amount)} ريال سعودي لا غير`;
  }

  function siteLetterCss() {
    return `<style id="admin-office-site-letter-print-css">
      @page admin-office-site-letter-page{size:A4 portrait;margin:12mm}
      .admin-office-site-letter-page{page:admin-office-site-letter-page!important;direction:rtl;font-family:Tajawal,Arial,sans-serif;color:#111827;background:#fff;min-height:270mm;padding:8mm 10mm;position:relative;page-break-after:always}.admin-office-site-letter-page .head{display:grid;grid-template-columns:78px 1fr 78px;align-items:center;border-bottom:2px solid #003087;padding-bottom:8px;margin-bottom:20px}.admin-office-site-letter-page .head img{width:68px}.admin-office-site-letter-page .head div{text-align:center}.admin-office-site-letter-page .head h1{font-size:17px;margin:0 0 4px;color:#003087}.admin-office-site-letter-page .head h2{font-size:15px;margin:0}.admin-office-site-letter-page .to{font-size:15.5px;font-weight:900;margin:18px 0 14px}.admin-office-site-letter-page .recipient-suffix{margin-right:36px}.admin-office-site-letter-page .salam{text-align:center;font-size:15.5px;font-weight:900;margin:20px 0 14px}.admin-office-site-letter-page .body-text{font-size:15px;line-height:2.15;text-align:justify}.admin-office-site-letter-page .closing{font-size:15px;line-height:2;margin-top:22px}.admin-office-site-letter-page .signatures.one{display:block;margin-top:48px}.admin-office-site-letter-page .signatures.one>div{width:78mm;margin-right:auto;margin-left:0;text-align:center}.admin-office-site-letter-page .sig-title{font-weight:900;margin-bottom:18px}.admin-office-site-letter-page .line{height:34px;border-bottom:1px solid #111;margin:0 18px 10px}.admin-office-site-letter-page .sig-name{font-weight:900;margin-top:8px}.admin-office-site-letter-page .footer{position:absolute;bottom:4mm;left:10mm;right:10mm;border-top:1px solid #cbd5e1;padding-top:5px;font-size:11px;display:flex;justify-content:space-between;direction:ltr}
    </style>`;
  }

  function siteLetterPage(centerKey) {
    const s = settings();
    const names = getNames();
    const company = getCompanyName();
    const site = names[centerKey] || centerKey;
    const amount = siteAmount(centerKey);
    return `<div class="page-container admin-office-site-letter-page"><section class="head"><img src="moh_logo.png"><div><h1>${esc(s.entityTitle)}</h1><h2>${esc(s.departmentTitle)}</h2></div><img src="moh_logo.png"></section><div class="to"><span>${esc(s.recipient)}</span><span class="recipient-suffix">${esc(s.recipientSuffix)}</span></div><div class="salam">السلام عليكم ورحمة الله وبركاته، وبعد:</div><div class="body-text">إشارة إلى عقد الصيانة والنظافة والتشغيل غير الطبي لمواقع ${esc(s.scopeName)}، مقاولة ${esc(company)}، نرفق لسعادتكم المستخلص الشهري الخاص بموقع ${esc(site)} ببند العمالة، ${extractPhrase()}، بمبلغ وقدره (${moneySAR(amount)}) ${esc(tafqeet(amount))}.</div><div class="closing">نأمل بعد الاطلاع إحالته إلى جهة الاختصاص لتدقيقه واستكمال إجراءات صرف مستحقات المقاول / ${esc(company)} حسب ما جاء أعلاه.<br>وتقبلوا خالص تحياتنا ،،،</div><div class="signatures one"><div><div class="sig-title">${esc(s.managerTitle)}</div><div class="line"></div><div class="sig-name">${esc(s.managerName)}</div></div></div><div class="footer"><span>${esc(s.phoneFaxEn)}</span><span dir="rtl">${esc(s.phoneFaxAr)}</span></div></div>`;
  }

  function selectedPrintKeys() {
    return Array.from(document.querySelectorAll('#print-centers-checkboxes input:checked')).map(cb => cb.value).filter(Boolean);
  }

  function installPrintSiteLetterOption() {
    const body = document.querySelector('#management-dialog .dialog-body');
    if (!body) return;

    ['print-opt-raise-consumables', 'print-opt-raise-saudization'].forEach(id => {
      const el = document.getElementById(id);
      const row = el?.closest('.form-group-checkbox');
      if (row) row.remove();
    });

    if (document.getElementById('print-opt-site-letter')) return;

    let fieldset = Array.from(body.querySelectorAll('fieldset')).find(fs => (fs.querySelector('legend')?.textContent || '').includes('خطابات'));
    if (!fieldset) {
      fieldset = document.createElement('fieldset');
      fieldset.innerHTML = '<legend>3. خطابات الموقع</legend><div class="checkbox-grid"></div>';
      body.appendChild(fieldset);
    }
    const grid = fieldset.querySelector('.checkbox-grid') || fieldset;
    grid.insertAdjacentHTML('beforeend', `<div class="form-group-checkbox"><input type="checkbox" id="print-opt-site-letter"><label for="print-opt-site-letter">خطاب رفع الموقع لكل موقع مختار</label></div>`);
  }

  function patchPrintDialogAndSelected() {
    if (window.__adminOfficesToolsPrintPatched) return;
    window.__adminOfficesToolsPrintPatched = true;

    const oldOpen = window.openPrintDialog;
    if (typeof oldOpen === 'function') {
      window.openPrintDialog = function patchedOpenPrintDialog() {
        const out = oldOpen.apply(this, arguments);
        setTimeout(installPrintSiteLetterOption, 260);
        setTimeout(installPrintSiteLetterOption, 700);
        return out;
      };
    }

    const oldPrint = window.printSelected;
    if (typeof oldPrint === 'function') {
      window.printSelected = function patchedPrintSelected() {
        const includeSiteLetters = !!document.getElementById('print-opt-site-letter')?.checked;
        const keys = selectedPrintKeys();
        let capturedWin = null;
        const realOpen = window.open;
        window.open = function () { capturedWin = realOpen.apply(window, arguments); return capturedWin; };
        const result = oldPrint.apply(this, arguments);
        window.open = realOpen;

        if (includeSiteLetters && capturedWin && capturedWin.document) {
          setTimeout(() => {
            const previousOnload = capturedWin.onload;
            capturedWin.onload = function () {
              try {
                if (!capturedWin.document.getElementById('admin-office-site-letter-print-css')) {
                  capturedWin.document.head.insertAdjacentHTML('beforeend', siteLetterCss());
                }
                capturedWin.document.body.insertAdjacentHTML('beforeend', keys.map(siteLetterPage).join(''));
              } catch (e) {
                console.error('[AdminOfficesTools] تعذر إضافة خطابات الموقع للطباعة:', e);
              }
              if (typeof previousOnload === 'function') return previousOnload.call(capturedWin);
              capturedWin.focus(); capturedWin.print(); capturedWin.close();
            };
          }, 0);
        }
        return result;
      };
    }
  }

  function injectCss() {
    if (document.getElementById('admin-offices-tools-css')) return;
    const style = document.createElement('style');
    style.id = 'admin-offices-tools-css';
    style.textContent = `
      .admin-bulk-centers-grid{max-height:220px;overflow:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px}.admin-bulk-center-row,.admin-bulk-emp-row{display:flex;gap:8px;align-items:center;border:1px solid #e2e8f0;background:#fff;border-radius:10px;padding:8px;font-weight:800}.admin-bulk-emp-row{align-items:flex-start;flex-direction:column}.admin-bulk-emp-row input{align-self:flex-start}.admin-bulk-emp-row span{font-weight:900}.admin-bulk-emp-row small{color:#64748b}.admin-bulk-employees-list{max-height:330px;overflow:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px}.admin-bulk-emp-group{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px}.admin-bulk-emp-head{display:flex;gap:6px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:8px}.admin-bulk-empty{padding:10px;color:#64748b;background:#fff;border-radius:8px;border:1px dashed #cbd5e1}.payment-number-wrapper{white-space:nowrap}.paymentNumber{font-weight:900;color:#003087}
    `;
    document.head.appendChild(style);
  }

  function boot(attempt) {
    injectCss();
    patchContractDisplay();
    installTemplateButton();
    window.openAdminOfficesBulkAttendanceDialog = openAdminOfficesBulkAttendanceDialog;
    patchPrintDialogAndSelected();
    if (attempt < 40 && (!document.getElementById('main-action-buttons') || typeof window.printSelected !== 'function')) {
      setTimeout(() => boot(attempt + 1), 250);
    }
  }

  window.AdminOfficesTools = {
    installPaymentNumberDisplay,
    downloadAdminOfficesAllSitesTemplate,
    openAdminOfficesBulkAttendanceDialog,
    renderBulkEmployeeList,
    toggleEmployeesForCenter,
    selectAllBulkEmployees,
    applyBulkAttendance,
    installPrintSiteLetterOption
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot(0));
  else boot(0);
  setTimeout(() => boot(0), 1200);
  setTimeout(() => boot(0), 2800);

  console.info('[Admin Offices Tools] payment/template/bulk-employees/site-letter-print installed');
})();