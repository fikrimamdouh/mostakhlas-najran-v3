// ===================================================================
// Clean Admin Offices Bulk Attendance Editor
// Scope: admin_offices_attendance.html only
// Keeps existing button: openAdminOfficesBulkAttendanceDialog()
// ===================================================================
(function () {
  'use strict';

  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;

  const DATA_KEY = 'adminOfficesAttendanceData_v1';

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

  function clean(v) {
    return String(v ?? '').replace(/\s+/g, ' ').trim();
  }

  function norm(v) {
    return clean(v)
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/[\u200e\u200f]/g, '');
  }

  function getNames() {
    try { if (typeof window.getCenterNames === 'function') return window.getCenterNames() || {}; } catch (_) {}
    return readJson('adminOfficeNames_v1', {});
  }

  function getData() {
    try { if (typeof window.getAttendanceData === 'function') return window.getAttendanceData() || {}; } catch (_) {}
    return readJson(DATA_KEY, {});
  }

  function saveData(data) {
    try { if (typeof window.saveAttendanceData === 'function') return window.saveAttendanceData(data || {}); } catch (_) {}
    localStorage.setItem(DATA_KEY, JSON.stringify(data || {}));
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
    try {
      if (typeof window.getExtractPeriodDetails === 'function') {
        const p = window.getExtractPeriodDetails();
        const days = p.daysInExtract || p.daysInMonth || 30;
        return { daysInExtract: days };
      }
    } catch (_) {}
    return { daysInExtract: 30 };
  }

  function statusCodes() {
    const fallback = {
      ح: { name: 'حاضر' },
      غ: { name: 'غائب' },
      ج: { name: 'إجازة' },
      ش: { name: 'شاغر' },
      ت: { name: 'تحت الإجراء' },
      ب: { name: 'بداية العقد' },
      ن: { name: 'نهاية العقد' }
    };
    return Object.assign({}, fallback, window.STATUS_CODES || {});
  }

  function statusOptionsHtml(selected) {
    const codes = statusCodes();
    return Object.keys(codes)
      .filter(code => code !== 'default')
      .map(code => `<option value="${esc(code)}" ${code === selected ? 'selected' : ''}>${esc(code)} — ${esc((codes[code] || {}).name || code)}</option>`)
      .join('');
  }

  function dayOptionsHtml(selected) {
    const count = getPeriod().daysInExtract;
    return Array.from({ length: count }, (_, i) => `<option value="${i}" ${i === selected ? 'selected' : ''}>اليوم ${i + 1}</option>`).join('');
  }

  function getActiveCenterKey() {
    try { if (typeof window.getActiveAdminOfficeCenterKey === 'function') return window.getActiveAdminOfficeCenterKey(); } catch (_) {}
    const active = document.querySelector('.tab-link.active[data-center-key]');
    return active?.dataset?.centerKey || '';
  }

  function ensureDays(emp) {
    const count = getPeriod().daysInExtract;
    const days = Array.isArray(emp.days) ? emp.days.slice(0, count) : [];
    while (days.length < count) days.push('ح');
    return days;
  }

  function allEmployees() {
    const data = getData();
    const names = getNames();
    const keys = orderedKeys();
    const out = [];
    keys.forEach(centerKey => {
      const rows = Array.isArray(data[centerKey]) ? data[centerKey] : [];
      rows.forEach((emp, idx) => {
        out.push({ centerKey, centerName: names[centerKey] || centerKey, idx, emp, days: ensureDays(emp) });
      });
    });
    return out;
  }

  function dayChips(days, start, end, rangeOnly) {
    const from = rangeOnly ? Math.min(start, end) : 0;
    const to = rangeOnly ? Math.max(start, end) : days.length - 1;
    return days.slice(from, to + 1).map((d, offset) => {
      const dayNo = from + offset + 1;
      return `<span class="aob-day-chip" title="اليوم ${dayNo}"><b>${dayNo}</b>${esc(d || 'ح')}</span>`;
    }).join('');
  }

  function renderBulkEmployees() {
    const box = document.getElementById('aob-employee-results');
    if (!box) return;

    const q = norm(document.getElementById('aob-search')?.value || '');
    const selectedCenters = Array.from(document.querySelectorAll('.aob-center-check:checked')).map(cb => cb.value);
    const start = parseInt(document.getElementById('aob-start-day')?.value || '0', 10);
    const end = parseInt(document.getElementById('aob-end-day')?.value || '0', 10);
    const rangeOnly = !!document.getElementById('aob-range-only')?.checked;

    if (!selectedCenters.length) {
      box.innerHTML = '<div class="aob-empty">اختر مكتبًا أو مرفقًا أولاً.</div>';
      return;
    }

    let rows = allEmployees().filter(r => selectedCenters.includes(r.centerKey));
    if (q) {
      rows = rows.filter(r => norm(`${r.emp.name || ''} ${r.emp.jobTitle || ''} ${r.emp.iqamaId || ''} ${r.centerName}`).includes(q));
    }

    if (!rows.length) {
      box.innerHTML = '<div class="aob-empty">لا توجد نتائج مطابقة.</div>';
      return;
    }

    box.innerHTML = rows.map(r => {
      const token = `${r.centerKey}::${r.idx}`;
      return `<label class="aob-employee-row">
        <div class="aob-employee-head">
          <input type="checkbox" class="aob-employee-check" value="${esc(token)}">
          <strong>${esc(r.emp.name || 'بدون اسم')}</strong>
        </div>
        <small>${esc(r.centerName)} — ${esc(r.emp.jobTitle || '')} — ${esc(r.emp.iqamaId || '')}</small>
        <div class="aob-days">${dayChips(r.days, start, end, rangeOnly)}</div>
      </label>`;
    }).join('');
  }

  function selectVisibleEmployees(checked) {
    document.querySelectorAll('#aob-employee-results .aob-employee-check').forEach(cb => { cb.checked = !!checked; });
  }

  function applyBulkAttendanceClean() {
    const start = parseInt(document.getElementById('aob-start-day')?.value || '0', 10);
    const end = parseInt(document.getElementById('aob-end-day')?.value || '0', 10);
    const newStatus = document.getElementById('aob-status')?.value || 'ح';
    const selected = Array.from(document.querySelectorAll('.aob-employee-check:checked')).map(cb => cb.value);

    if (!selected.length) return alert('اختر موظفًا واحدًا على الأقل.');
    if (start > end) return alert('مدى الأيام غير صحيح. يوم البداية أكبر من يوم النهاية.');
    if (!statusCodes()[newStatus]) return alert('حالة الحضور غير صحيحة.');

    const previewNames = selected.map(token => {
      const [centerKey, rawIdx] = token.split('::');
      const emp = getData()[centerKey]?.[parseInt(rawIdx, 10)];
      return emp ? `- ${emp.name || 'بدون اسم'}` : '';
    }).filter(Boolean).slice(0, 10).join('\n');

    if (!confirm(`سيتم تطبيق الحالة "${newStatus}" على ${selected.length} اختيار خلال الأيام ${start + 1} إلى ${end + 1}.\n\n${previewNames}${selected.length > 10 ? '\n...' : ''}\n\nهل تريد الاستمرار؟`)) return;

    const data = getData();
    const count = getPeriod().daysInExtract;
    const touchedCenters = new Set();
    let affected = 0;

    selected.forEach(token => {
      const [centerKey, rawIdx] = token.split('::');
      const idx = parseInt(rawIdx, 10);
      const emp = data[centerKey]?.[idx];
      if (!emp) return;
      const days = Array.isArray(emp.days) ? emp.days.slice(0, count) : [];
      while (days.length < count) days.push('ح');
      for (let i = start; i <= end && i < count; i++) days[i] = newStatus;
      emp.days = days;
      touchedCenters.add(centerKey);
      affected++;
    });

    saveData(data);

    try { if (typeof window.renderCenterIcons === 'function') window.renderCenterIcons(); } catch (_) {}
    try { if (typeof window.calculateAndDisplayGrandTotal === 'function') window.calculateAndDisplayGrandTotal(); } catch (_) {}

    const active = getActiveCenterKey();
    if (active && touchedCenters.has(active)) {
      try { if (typeof window.renderAttendanceTable === 'function') window.renderAttendanceTable(active); } catch (_) {}
      try { if (typeof window.populateAttendanceTableBody === 'function') window.populateAttendanceTableBody(active); } catch (_) {}
      try { if (typeof window.showCenterDetails === 'function') window.showCenterDetails(active); } catch (_) {}
    }

    if (typeof window.closeDialog === 'function') window.closeDialog('management-dialog');
    alert(`تم تطبيق التعديل الجماعي بنجاح.\n\nعدد الموظفين المتأثرين: ${affected}\nعدد المكاتب المتأثرة: ${touchedCenters.size}`);
  }

  function injectCss() {
    if (document.getElementById('aob-clean-css')) return;
    const style = document.createElement('style');
    style.id = 'aob-clean-css';
    style.textContent = `
      .aob-dialog-body{max-height:74vh;overflow:auto;padding-inline-end:4px}.aob-grid{display:grid;grid-template-columns:2fr 1fr 1fr 1.1fr;gap:12px;align-items:end;margin-bottom:10px}.aob-grid input,.aob-grid select{width:100%;padding:9px 10px;border:1px solid #cbd5e1;border-radius:9px}.aob-range-row{display:flex;gap:8px;align-items:center;font-weight:800;color:#334155;margin:8px 0 14px}.aob-centers{max-height:170px;overflow:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px}.aob-center-row{display:flex;gap:8px;align-items:center;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px;font-weight:800}.aob-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-start;margin-bottom:10px}.aob-results{max-height:410px;overflow:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:10px}.aob-employee-row{display:flex;flex-direction:column;gap:6px;background:#fff;border:1px solid #dbeafe;border-radius:12px;padding:10px}.aob-employee-head{display:flex;gap:8px;align-items:center}.aob-employee-row small{color:#64748b}.aob-days{display:flex;flex-wrap:wrap;gap:4px;direction:ltr;justify-content:flex-end}.aob-day-chip{min-width:32px;border:1px solid #cbd5e1;border-radius:7px;background:#f8fafc;padding:3px 5px;text-align:center;font-size:11px;color:#111827}.aob-day-chip b{display:block;font-size:10px;color:#64748b}.aob-empty{padding:14px;border:1px dashed #cbd5e1;background:#fff;border-radius:10px;color:#64748b}@media(max-width:900px){.aob-grid{grid-template-columns:1fr}.aob-results{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function openCleanBulkAttendanceDialog() {
    injectCss();
    const names = getNames();
    const keys = orderedKeys();
    const active = getActiveCenterKey();
    const defaultKey = active || keys[0] || '';

    const centersHtml = keys.map(key => `<label class="aob-center-row"><input type="checkbox" class="aob-center-check" value="${esc(key)}" ${key === defaultKey ? 'checked' : ''} onchange="AdminOfficesBulkClean.render()"><span>${esc(names[key] || key)}</span></label>`).join('');

    const html = `
      <div class="dialog-header">
        <h3><i class="fas fa-calendar-alt"></i> تعديل جماعي للحضور والانصراف</h3>
        <span class="close" onclick="closeDialog('management-dialog')">×</span>
      </div>
      <div class="dialog-body aob-dialog-body">
        <p class="info-text">بحث واختيار دقيق. الاسم المكرر يظهر كأكثر من صف حسب المكتب/المرفق، ولا يتم تحديد أي موظف تلقائيًا.</p>
        <div class="aob-grid">
          <div class="form-group"><label>بحث:</label><input id="aob-search" type="text" placeholder="اسم / هوية / وظيفة / موقع" oninput="AdminOfficesBulkClean.render()"></div>
          <div class="form-group"><label>من يوم:</label><select id="aob-start-day" onchange="AdminOfficesBulkClean.render()">${dayOptionsHtml(0)}</select></div>
          <div class="form-group"><label>إلى يوم:</label><select id="aob-end-day" onchange="AdminOfficesBulkClean.render()">${dayOptionsHtml(0)}</select></div>
          <div class="form-group"><label>الحالة الجديدة:</label><select id="aob-status">${statusOptionsHtml('ح')}</select></div>
        </div>
        <label class="aob-range-row"><input type="checkbox" id="aob-range-only" onchange="AdminOfficesBulkClean.render()"> عرض أيام النطاق المختار فقط</label>
        <fieldset>
          <legend>1. اختيار المكاتب والمرافق</legend>
          <div class="aob-actions"><button type="button" class="btn btn-light" onclick="document.querySelectorAll('.aob-center-check').forEach(cb=>cb.checked=true);AdminOfficesBulkClean.render()">تحديد كل المكاتب</button><button type="button" class="btn btn-light" onclick="document.querySelectorAll('.aob-center-check').forEach(cb=>cb.checked=false);AdminOfficesBulkClean.render()">إلغاء المكاتب</button></div>
          <div class="aob-centers">${centersHtml}</div>
        </fieldset>
        <fieldset style="margin-top:14px">
          <legend>2. نتائج الموظفين والحالات الحالية</legend>
          <div class="aob-actions"><button type="button" class="btn btn-light" onclick="AdminOfficesBulkClean.selectVisible(true)">تحديد النتائج المعروضة</button><button type="button" class="btn btn-light" onclick="AdminOfficesBulkClean.selectVisible(false)">إلغاء النتائج المعروضة</button></div>
          <div id="aob-employee-results" class="aob-results"></div>
        </fieldset>
      </div>
      <div class="dialog-footer">
        <button class="btn btn-secondary" onclick="closeDialog('management-dialog')"><i class="fas fa-times"></i> إلغاء</button>
        <button class="btn btn-success" onclick="AdminOfficesBulkClean.apply()"><i class="fas fa-check"></i> تطبيق التعديل</button>
      </div>
    `;

    if (typeof window.openDialog === 'function') window.openDialog(html, 'management-dialog', true);
    setTimeout(renderBulkEmployees, 60);
  }

  window.AdminOfficesBulkClean = {
    open: openCleanBulkAttendanceDialog,
    render: renderBulkEmployees,
    selectVisible: selectVisibleEmployees,
    apply: applyBulkAttendanceClean
  };

  window.openAdminOfficesBulkAttendanceDialog = openCleanBulkAttendanceDialog;
  if (window.AdminOfficesTools) {
    window.AdminOfficesTools.openAdminOfficesBulkAttendanceDialog = openCleanBulkAttendanceDialog;
    window.AdminOfficesTools.renderBulkEmployeeList = renderBulkEmployees;
    window.AdminOfficesTools.applyBulkAttendance = applyBulkAttendanceClean;
    window.AdminOfficesTools.selectAllBulkEmployees = selectVisibleEmployees;
  }

  console.info('[Admin Offices Bulk Clean] installed clean editor');
})();
