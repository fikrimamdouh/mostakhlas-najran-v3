// ===================================================================
// Admin Offices Bulk Attendance Tools
// Scope: admin_offices_attendance.html only
// تعديل جماعي للحضور والانصراف مع اختيار المكاتب ثم الموظفين
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;

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

  function getNames() {
    try { if (typeof window.getCenterNames === 'function') return window.getCenterNames() || {}; } catch (_) {}
    return readJson('adminOfficeNames_v1', {});
  }

  function getData() {
    const list = [];
    try { if (typeof window.getAttendanceData === 'function') list.push(window.getAttendanceData() || {}); } catch (_) {}
    list.push(readJson('adminOfficesAttendanceData_v1', {}));
    list.push(readJson('adminOfficesAttendanceData_v1_localBackup', {}));
    list.push(readJson('adminOfficesAttendanceData', {}));

    const count = obj => Object.values(obj || {}).reduce((s, rows) => s + (Array.isArray(rows) ? rows.length : 0), 0);
    return list.reduce((best, item) => count(item) > count(best) ? item : best, {});
  }

  function saveData(data) {
    try {
      if (typeof window.saveAttendanceData === 'function') {
        window.saveAttendanceData(data || {});
      }
    } catch (_) {}
    writeJson('adminOfficesAttendanceData_v1', data || {});
    writeJson('adminOfficesAttendanceData_v1_localBackup', data || {});
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
      daysInExtract: Math.max(1, Math.ceil((safeEnd - safeStart) / 86400000) + 1 || 30)
    };
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

  function activeCenterKey() {
    try { if (typeof window.getActiveAdminOfficeCenterKey === 'function') return window.getActiveAdminOfficeCenterKey(); } catch (_) {}
    return document.querySelector('.tab-link.active[data-center-key]')?.dataset?.centerKey || '';
  }

  function statusOptionsHtml() {
    const source = window.STATUS_CODES || { 'ح': { name: 'حضور' }, 'غ': { name: 'غياب' }, 'ج': { name: 'إجازة' }, 'ش': { name: 'شاغر' }, 'ت': { name: 'تأخير' }, 'ب': { name: 'بديل' }, 'ن': { name: 'نقل' }, 'غ•': { name: 'غياب بدون حسم' } };
    return Object.keys(source)
      .filter(code => code && code !== 'default')
      .map(code => `<option value="${esc(code)}">${esc(code)} — ${esc(source[code].name || code)}</option>`)
      .join('');
  }

  function dayOptionsHtml() {
    const p = getPeriod();
    return Array.from({ length: p.daysInExtract }, (_, i) => {
      const d = new Date(p.startDate);
      d.setDate(p.startDate.getDate() + i);
      return `<option value="${i}">اليوم ${i + 1} — ${d.toLocaleDateString('en-CA')}</option>`;
    }).join('');
  }

  function renderEmployeeList() {
    const box = document.getElementById('admin-bulk-employees-list');
    if (!box) return;

    const names = getNames();
    const data = getData();
    const selectedCenters = Array.from(document.querySelectorAll('.admin-office-bulk-center:checked')).map(cb => cb.value);

    if (!selectedCenters.length) {
      box.innerHTML = '<div class="admin-bulk-empty">اختر مكتبًا أو مرفقًا لعرض أسماء الموظفين.</div>';
      return;
    }

    box.innerHTML = selectedCenters.map(centerKey => {
      const rows = Array.isArray(data[centerKey]) ? data[centerKey] : [];
      const employees = rows.length ? rows.map((emp, idx) => `
        <label class="admin-bulk-emp-row">
          <input type="checkbox" class="admin-office-bulk-employee" value="${esc(centerKey)}::${idx}" data-center="${esc(centerKey)}" checked>
          <span class="emp-name">${esc(emp.name || 'بدون اسم')}</span>
          <small>${esc(emp.jobTitle || '')}${emp.iqamaId ? ' — ' + esc(emp.iqamaId) : ''}</small>
        </label>
      `).join('') : '<div class="admin-bulk-empty">لا توجد أسماء موظفين في هذا الموقع.</div>';

      return `
        <div class="admin-bulk-emp-group">
          <div class="admin-bulk-emp-head">
            <strong>${esc(names[centerKey] || centerKey)}</strong>
            <button type="button" class="btn btn-light" onclick="AdminOfficesBulkAttendanceTools.toggleCenterEmployees('${esc(centerKey)}', true)">تحديد موظفي الموقع</button>
            <button type="button" class="btn btn-light" onclick="AdminOfficesBulkAttendanceTools.toggleCenterEmployees('${esc(centerKey)}', false)">إلغاء موظفي الموقع</button>
          </div>
          ${employees}
        </div>
      `;
    }).join('');
  }

  function toggleCenterEmployees(centerKey, checked) {
    document.querySelectorAll(`.admin-office-bulk-employee[data-center="${centerKey}"]`).forEach(cb => { cb.checked = !!checked; });
  }

  function selectAllEmployees(checked) {
    document.querySelectorAll('.admin-office-bulk-employee').forEach(cb => { cb.checked = !!checked; });
  }

  function selectAllCenters(checked) {
    document.querySelectorAll('.admin-office-bulk-center').forEach(cb => { cb.checked = !!checked; });
    renderEmployeeList();
  }

  function openBulkAttendanceDialog() {
    const names = getNames();
    const keys = orderedKeys();
    const active = activeCenterKey();
    const defaultKey = active || keys[0] || '';

    const centerChecks = keys.map(key => `
      <label class="admin-bulk-center-row">
        <input type="checkbox" class="admin-office-bulk-center" value="${esc(key)}" ${key === defaultKey ? 'checked' : ''} onchange="AdminOfficesBulkAttendanceTools.renderEmployeeList()">
        <span>${esc(names[key] || key)}</span>
      </label>
    `).join('');

    const content = `
      <div class="dialog-header">
        <h3><i class="fas fa-calendar-alt"></i> تعديل جماعي للحضور والانصراف</h3>
        <span class="close" onclick="closeDialog('management-dialog')">×</span>
      </div>
      <div class="dialog-body">
        <p class="info-text">اختر المكاتب، ثم اختر أسماء الموظفين المطلوب تعديل حضورهم فقط.</p>
        <div class="form-grid admin-bulk-top-grid">
          <div class="form-group"><label>من يوم:</label><select id="admin-bulk-start-day">${dayOptionsHtml()}</select></div>
          <div class="form-group"><label>إلى يوم:</label><select id="admin-bulk-end-day">${dayOptionsHtml()}</select></div>
          <div class="form-group"><label>الحالة الجديدة:</label><select id="admin-bulk-status">${statusOptionsHtml()}</select></div>
        </div>
        <fieldset>
          <legend>1. اختيار المكاتب والمرافق</legend>
          <div class="btn-row admin-bulk-row-actions">
            <button type="button" class="btn btn-light" onclick="AdminOfficesBulkAttendanceTools.selectAllCenters(true)">تحديد كل المكاتب</button>
            <button type="button" class="btn btn-light" onclick="AdminOfficesBulkAttendanceTools.selectAllCenters(false)">إلغاء كل المكاتب</button>
          </div>
          <div class="admin-bulk-centers-grid">${centerChecks}</div>
        </fieldset>
        <fieldset>
          <legend>2. اختيار الموظفين</legend>
          <div class="btn-row admin-bulk-row-actions">
            <button type="button" class="btn btn-light" onclick="AdminOfficesBulkAttendanceTools.selectAllEmployees(true)">تحديد كل الموظفين المعروضين</button>
            <button type="button" class="btn btn-light" onclick="AdminOfficesBulkAttendanceTools.selectAllEmployees(false)">إلغاء كل الموظفين المعروضين</button>
          </div>
          <div id="admin-bulk-employees-list" class="admin-bulk-employees-list"></div>
        </fieldset>
      </div>
      <div class="dialog-footer">
        <button class="btn btn-secondary" onclick="closeDialog('management-dialog')"><i class="fas fa-times"></i> إلغاء</button>
        <button class="btn btn-success" onclick="AdminOfficesBulkAttendanceTools.applyBulkAttendance()"><i class="fas fa-check"></i> تطبيق التعديل</button>
      </div>
    `;

    if (typeof window.openDialog === 'function') {
      window.openDialog(content, 'management-dialog', true);
    } else {
      document.body.insertAdjacentHTML('beforeend', `<div id="management-dialog" class="modal active"><div class="modal-content">${content}</div></div>`);
    }
    setTimeout(renderEmployeeList, 60);
  }

  function applyBulkAttendance() {
    const startIndex = parseInt(document.getElementById('admin-bulk-start-day')?.value || '0', 10);
    const endIndex = parseInt(document.getElementById('admin-bulk-end-day')?.value || '0', 10);
    const newStatus = document.getElementById('admin-bulk-status')?.value || 'ح';
    const selectedEmployees = Array.from(document.querySelectorAll('.admin-office-bulk-employee:checked')).map(cb => cb.value);

    if (startIndex > endIndex) return alert('مدى الأيام غير صحيح. يوم البداية أكبر من يوم النهاية.');
    if (!selectedEmployees.length) return alert('اختر موظفًا واحدًا على الأقل.');

    const data = getData();
    const p = getPeriod();
    let affected = 0;

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
      affected++;
    });

    saveData(data);
    try { if (typeof window.renderCenterIcons === 'function') window.renderCenterIcons(); } catch (_) {}
    try { if (typeof window.calculateAndDisplayGrandTotal === 'function') window.calculateAndDisplayGrandTotal(); } catch (_) {}
    try {
      const active = activeCenterKey();
      if (active && typeof window.renderAttendanceTable === 'function') window.renderAttendanceTable(active);
      else if (active && typeof window.populateAttendanceTableBody === 'function') window.populateAttendanceTableBody(active);
    } catch (_) {}
    try { if (typeof window.closeDialog === 'function') window.closeDialog('management-dialog'); } catch (_) {}
    alert(`تم تطبيق التعديل الجماعي بنجاح.\nعدد الموظفين المتأثرين: ${affected}`);
  }

  function injectCss() {
    if (document.getElementById('admin-bulk-attendance-tools-css')) return;
    const style = document.createElement('style');
    style.id = 'admin-bulk-attendance-tools-css';
    style.textContent = `
      .admin-bulk-top-grid{display:grid!important;grid-template-columns:repeat(3,minmax(180px,1fr));gap:12px;margin-bottom:14px}
      .admin-bulk-row-actions{justify-content:flex-start!important;margin:8px 0!important}
      .admin-bulk-centers-grid{max-height:220px;overflow:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px}
      .admin-bulk-center-row{display:flex;gap:8px;align-items:center;border:1px solid #e2e8f0;background:#fff;border-radius:10px;padding:8px;font-weight:800}
      .admin-bulk-employees-list{max-height:360px;overflow:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px}
      .admin-bulk-emp-group{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px}
      .admin-bulk-emp-head{display:flex;gap:6px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:8px}
      .admin-bulk-emp-row{display:grid;grid-template-columns:24px 1fr;gap:4px 8px;border:1px solid #e2e8f0;background:#fff;border-radius:10px;padding:8px;margin:6px 0}
      .admin-bulk-emp-row input{grid-row:1 / span 2;margin-top:4px}.admin-bulk-emp-row .emp-name{font-weight:900}.admin-bulk-emp-row small{color:#64748b}.admin-bulk-empty{padding:10px;color:#64748b;background:#fff;border-radius:8px;border:1px dashed #cbd5e1}
    `;
    document.head.appendChild(style);
  }

  function boot() {
    injectCss();
    window.openAdminOfficesBulkAttendanceDialog = openBulkAttendanceDialog;
  }

  window.AdminOfficesBulkAttendanceTools = {
    openBulkAttendanceDialog,
    renderEmployeeList,
    toggleCenterEmployees,
    selectAllCenters,
    selectAllEmployees,
    applyBulkAttendance
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 1000);
  setTimeout(boot, 2500);

  console.info('[Admin Offices Bulk Attendance Tools] installed employee selector v1');
})();