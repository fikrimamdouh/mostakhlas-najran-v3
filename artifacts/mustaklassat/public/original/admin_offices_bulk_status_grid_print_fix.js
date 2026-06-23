// ===================================================================
// Admin Offices Bulk Status Grid + Main Print Fix — V1
// Scope: admin_offices_attendance.html
// 1) تعديل جماعي يعرض كل الأيام وكل الحالات في خلايا قابلة للتعديل.
// 2) ضغط طباعة الحضور الأساسية حتى يبدأ الجدول في الصفحة الأولى ولا يترك صفحة للشعار/الهيدر.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html|original-viewer\?page=admin_offices_attendance\.html/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_BULK_STATUS_GRID_PRINT_FIX_V1__) return;
  window.__ADMIN_OFFICES_BULK_STATUS_GRID_PRINT_FIX_V1__ = true;

  const MAIN_KEY = 'adminOfficesAttendanceData_v1';
  const BACKUP_KEY = 'adminOfficesAttendanceData_v1_localBackup';
  const LAST_GOOD_KEY = 'adminOfficesAttendanceData_v1_lastGood';
  const LEGACY_KEY = 'adminOfficesAttendanceData';
  const SAFE_KEY = 'adminOfficesLaborDataSafe_v2';

  function readJson(key, fallback) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; } }
  function esc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function clean(v) { return String(v ?? '').replace(/\s+/g, ' ').trim(); }
  function countRows(data) { return Object.values(data || {}).reduce((s, rows) => s + (Array.isArray(rows) ? rows.length : 0), 0); }
  function score(data) { let named = 0; Object.values(data || {}).forEach(rows => Array.isArray(rows) && rows.forEach(e => { if (clean(e && e.name)) named++; })); return { rows: countRows(data), named }; }
  function getNames() { try { if (typeof window.getCenterNames === 'function') return window.getCenterNames() || {}; } catch (_) {} return readJson('adminOfficeNames_v1', {}); }
  function getData() {
    const list = [];
    try { if (typeof window.getAttendanceData === 'function') list.push(window.getAttendanceData() || {}); } catch (_) {}
    list.push(readJson(MAIN_KEY, {}), readJson(BACKUP_KEY, {}), readJson(LAST_GOOD_KEY, {}), readJson(SAFE_KEY, {}), readJson(LEGACY_KEY, {}));
    return list.reduce((best, item) => { const b = score(best), s = score(item); if (s.named > b.named) return item; if (s.named === b.named && s.rows > b.rows) return item; return best; }, {});
  }
  function saveData(data) {
    data = data || {};
    const raw = JSON.stringify(data);
    try {
      localStorage.setItem(MAIN_KEY, raw);
      localStorage.setItem(BACKUP_KEY, raw);
      localStorage.setItem(LAST_GOOD_KEY, raw);
      localStorage.setItem(SAFE_KEY, raw);
      localStorage.setItem(LEGACY_KEY, raw);
      localStorage.setItem('adminOfficesAttendanceData_v1_localBackup_ts', String(Date.now()));
      localStorage.setItem('adminOfficesAttendanceData_v1_lastGood_ts', String(Date.now()));
      localStorage.setItem('adminOfficesLaborDataSafe_v2_ts', String(Date.now()));
      localStorage.setItem('najran_admin_offices_attendance_done', 'true');
    } catch (_) {}
    try { if (typeof window.saveAttendanceData === 'function') window.saveAttendanceData(data); } catch (_) {}
    try { if (window.AdminOfficesAttendancePersistence && typeof window.AdminOfficesAttendancePersistence.snapshot === 'function') window.AdminOfficesAttendancePersistence.snapshot(); } catch (_) {}
  }
  function getPeriod() {
    try { if (typeof window.getExtractPeriodDetails === 'function') return window.getExtractPeriodDetails(); } catch (_) {}
    const e = readJson('persistentExtractData', {});
    const start = new Date(e.extractStart || localStorage.getItem('extractStart') || Date.now());
    const end = new Date(e.extractEnd || localStorage.getItem('extractEnd') || e.extractStart || Date.now());
    const safeStart = Number.isNaN(start.getTime()) ? new Date() : start;
    const safeEnd = Number.isNaN(end.getTime()) ? safeStart : end;
    return { startDate: safeStart, daysInExtract: Math.max(1, Math.ceil((safeEnd - safeStart) / 86400000) + 1 || 30), totalDaysInMonth: new Date(safeStart.getFullYear(), safeStart.getMonth() + 1, 0).getDate() || 30 };
  }
  function orderedKeys() {
    const names = getNames(), data = getData();
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
  function activeCenterKey() { try { if (typeof window.getActiveAdminOfficeCenterKey === 'function') return window.getActiveAdminOfficeCenterKey(); } catch (_) {} return document.querySelector('.tab-link.active[data-center-key]')?.dataset?.centerKey || ''; }
  function statusEntries() {
    const fallback = { 'ح': { name: 'حضور' }, 'غ': { name: 'غياب' }, 'ج': { name: 'إجازة' }, 'ش': { name: 'شاغر' }, 'ت': { name: 'تأخير' }, 'ب': { name: 'بديل' }, 'ن': { name: 'نقل' }, 'غ•': { name: 'غياب بدون حسم' } };
    const src = window.STATUS_CODES || fallback;
    return Object.keys(src).filter(k => k !== 'default').map(code => ({ code, name: (src[code] && src[code].name) || code }));
  }
  function statusOptions(selected) { return statusEntries().map(s => `<option value="${esc(s.code)}" ${s.code === selected ? 'selected' : ''}>${esc(s.code)} — ${esc(s.name)}</option>`).join(''); }
  function dayOptions() {
    const p = getPeriod();
    return Array.from({ length: p.daysInExtract }, (_, i) => { const d = new Date(p.startDate); d.setDate(p.startDate.getDate() + i); return `<option value="${i}">اليوم ${i + 1} — ${d.toLocaleDateString('en-CA')}</option>`; }).join('');
  }
  function selectedCenters() { return Array.from(document.querySelectorAll('.admin-office-bulk-center:checked')).map(cb => cb.value); }
  function selectedEmployees() { return Array.from(document.querySelectorAll('.admin-office-bulk-employee:checked')).map(cb => cb.value); }

  function injectCss() {
    if (document.getElementById('admin-offices-bulk-grid-print-fix-css')) return;
    const st = document.createElement('style');
    st.id = 'admin-offices-bulk-grid-print-fix-css';
    st.textContent = `
      .admin-bulk-grid-dialog .dialog-content,.admin-bulk-grid-dialog .dialog-box,.admin-bulk-grid-dialog .dialog-panel,.admin-bulk-grid-dialog .dialog{width:min(1280px,98vw)!important;max-height:94vh!important;display:flex!important;flex-direction:column!important;overflow:hidden!important}
      .admin-bulk-grid-dialog .dialog-body{overflow:auto!important;max-height:calc(94vh - 118px)!important;padding:12px!important}
      .admin-bulk-grid-dialog fieldset{border:1px solid #cbd5e1;border-radius:12px;margin:10px 0;padding:10px;background:#f8fafc}.admin-bulk-grid-dialog legend{font-weight:900;color:#003087;padding:0 8px}
      .admin-bulk-controls{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;background:#eef6ff;border:1px solid #bfdbfe;border-radius:12px;padding:10px;margin-bottom:10px}.admin-bulk-controls label{display:block;font-size:12px;font-weight:900;margin-bottom:4px}.admin-bulk-controls select{width:100%;min-height:34px;border:1px solid #cbd5e1;border-radius:8px;padding:6px;font-family:inherit;font-weight:800;background:#fff}
      .admin-bulk-centers-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:7px;max-height:175px;overflow:auto}.admin-bulk-center-row{display:flex;gap:7px;align-items:center;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:7px;font-weight:800}
      .admin-bulk-employees-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:8px;max-height:220px;overflow:auto}.admin-bulk-emp-group{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:8px}.admin-bulk-emp-head{display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px}.admin-bulk-emp-row{display:grid;grid-template-columns:22px 1fr;gap:2px 6px;border:1px solid #e2e8f0;border-radius:9px;padding:6px;margin:5px 0;background:#fff}.admin-bulk-emp-row input{grid-row:1 / span 2}.admin-bulk-emp-row span{font-weight:900}.admin-bulk-emp-row small{color:#64748b}.admin-bulk-empty{padding:10px;border:1px dashed #cbd5e1;border-radius:10px;background:#fff;color:#64748b}
      .admin-bulk-status-wrap{max-height:430px;overflow:auto;border:1px solid #cbd5e1;border-radius:12px;background:#fff}.admin-bulk-status-table{width:max-content;min-width:100%;border-collapse:collapse;font-size:12px}.admin-bulk-status-table th{position:sticky;top:0;background:#003087;color:#fff;z-index:2}.admin-bulk-status-table th,.admin-bulk-status-table td{border:1px solid #cbd5e1;padding:4px;text-align:center;white-space:nowrap}.admin-bulk-status-table td.emp-cell{text-align:right;min-width:210px;font-weight:900}.admin-bulk-status-table td.site-cell{text-align:right;min-width:180px}.admin-bulk-status-table select{min-width:86px;border:1px solid #cbd5e1;border-radius:7px;padding:4px;font-family:inherit;font-weight:800;background:#fff}
      .admin-print-compact-notice{font-size:12px;color:#475569;text-align:center;margin-top:6px}
    `;
    document.head.appendChild(st);
  }

  function applyDialogClass() { const dlg = document.getElementById('management-dialog'); if (dlg) dlg.classList.add('admin-bulk-grid-dialog'); }

  function renderEmployees() {
    const box = document.getElementById('admin-bulk-employees-list');
    if (!box) return;
    const names = getNames(), data = getData(), centers = selectedCenters();
    if (!centers.length) { box.innerHTML = '<div class="admin-bulk-empty">اختر مكتبًا أو مرفقًا لعرض الموظفين.</div>'; renderStatusGrid(); return; }
    box.innerHTML = centers.map(centerKey => {
      const rows = Array.isArray(data[centerKey]) ? data[centerKey] : [];
      const empRows = rows.length ? rows.map((emp, idx) => `<label class="admin-bulk-emp-row"><input type="checkbox" class="admin-office-bulk-employee" value="${esc(centerKey)}::${idx}" data-center="${esc(centerKey)}" checked onchange="AdminOfficesBulkStatusGrid.renderStatusGrid()"><span>${esc(emp.name || 'بدون اسم')}</span><small>${esc(emp.jobTitle || '')}${emp.iqamaId ? ' — ' + esc(emp.iqamaId) : ''}</small></label>`).join('') : '<div class="admin-bulk-empty">لا توجد أسماء موظفين في هذا الموقع.</div>';
      return `<div class="admin-bulk-emp-group"><div class="admin-bulk-emp-head"><strong>${esc(names[centerKey] || centerKey)}</strong><span><button type="button" class="btn btn-light" onclick="AdminOfficesBulkStatusGrid.toggleCenterEmployees('${esc(centerKey)}',true)">تحديد</button> <button type="button" class="btn btn-light" onclick="AdminOfficesBulkStatusGrid.toggleCenterEmployees('${esc(centerKey)}',false)">إلغاء</button></span></div>${empRows}</div>`;
    }).join('');
    renderStatusGrid();
  }

  function renderStatusGrid() {
    const box = document.getElementById('admin-bulk-status-grid');
    if (!box) return;
    const start = parseInt(document.getElementById('admin-bulk-start-day')?.value || '0', 10);
    const end = parseInt(document.getElementById('admin-bulk-end-day')?.value || '0', 10);
    if (start > end) { box.innerHTML = '<div class="admin-bulk-empty">مدى الأيام غير صحيح.</div>'; return; }
    const data = getData(), names = getNames(), p = getPeriod();
    const tokens = selectedEmployees();
    if (!tokens.length) { box.innerHTML = '<div class="admin-bulk-empty">اختر الموظفين لعرض جدول الحالات.</div>'; return; }
    const dayHeaders = [];
    for (let d = start; d <= end && d < p.daysInExtract; d++) dayHeaders.push(d);
    if (!dayHeaders.length) { box.innerHTML = '<div class="admin-bulk-empty">لا توجد أيام في هذا المدى.</div>'; return; }
    const head = `<tr><th>الموقع</th><th>الموظف</th><th>الوظيفة</th>${dayHeaders.map(d => `<th>يوم ${d + 1}</th>`).join('')}</tr>`;
    const body = tokens.map(token => {
      const [centerKey, rawIdx] = token.split('::');
      const idx = parseInt(rawIdx, 10);
      const emp = data[centerKey] && data[centerKey][idx];
      if (!emp) return '';
      const days = Array.isArray(emp.days) ? emp.days.slice(0, p.daysInExtract) : [];
      while (days.length < p.daysInExtract) days.push('ح');
      return `<tr><td class="site-cell">${esc(names[centerKey] || centerKey)}</td><td class="emp-cell">${esc(emp.name || 'بدون اسم')}</td><td>${esc(emp.jobTitle || '')}</td>${dayHeaders.map(day => `<td><select class="admin-bulk-cell-status" data-center="${esc(centerKey)}" data-index="${idx}" data-day="${day}">${statusOptions(days[day] || 'ح')}</select></td>`).join('')}</tr>`;
    }).join('');
    box.innerHTML = `<div class="admin-bulk-status-wrap"><table class="admin-bulk-status-table"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
  }

  function fillAllCells() {
    const value = document.getElementById('admin-bulk-fill-status')?.value || 'ح';
    document.querySelectorAll('.admin-bulk-cell-status').forEach(sel => { sel.value = value; });
  }
  function toggleCenterEmployees(centerKey, checked) { document.querySelectorAll(`.admin-office-bulk-employee[data-center="${centerKey}"]`).forEach(cb => { cb.checked = !!checked; }); renderStatusGrid(); }
  function selectAllEmployees(checked) { document.querySelectorAll('.admin-office-bulk-employee').forEach(cb => { cb.checked = !!checked; }); renderStatusGrid(); }
  function selectAllCenters(checked) { document.querySelectorAll('.admin-office-bulk-center').forEach(cb => { cb.checked = !!checked; }); renderEmployees(); }

  function openBulkDialog() {
    injectCss();
    const names = getNames(), keys = orderedKeys(), active = activeCenterKey(), defaultKey = active || keys[0] || '';
    const centers = keys.map(key => `<label class="admin-bulk-center-row"><input type="checkbox" class="admin-office-bulk-center" value="${esc(key)}" ${key === defaultKey ? 'checked' : ''} onchange="AdminOfficesBulkStatusGrid.renderEmployees()"><span>${esc(names[key] || key)}</span></label>`).join('');
    const status = statusOptions('ح');
    const content = `
      <div class="dialog-header"><h3><i class="fas fa-calendar-alt"></i> تعديل جماعي للحضور والانصراف — كل الحالات</h3><span class="close" onclick="closeDialog('management-dialog')">×</span></div>
      <div class="dialog-body">
        <p class="info-text">اختر المكاتب والموظفين، ثم عدّل حالة كل يوم من الجدول. كل خلية فيها كل حالات الحضور المتاحة.</p>
        <div class="admin-bulk-controls">
          <div><label>من يوم</label><select id="admin-bulk-start-day" onchange="AdminOfficesBulkStatusGrid.renderStatusGrid()">${dayOptions()}</select></div>
          <div><label>إلى يوم</label><select id="admin-bulk-end-day" onchange="AdminOfficesBulkStatusGrid.renderStatusGrid()">${dayOptions()}</select></div>
          <div><label>تعبئة سريعة لكل الخلايا المعروضة</label><select id="admin-bulk-fill-status">${status}</select></div>
          <div style="display:flex;align-items:end"><button type="button" class="btn btn-light" onclick="AdminOfficesBulkStatusGrid.fillAllCells()">تعبئة كل الخلايا</button></div>
        </div>
        <fieldset><legend>1. اختيار المكاتب والمرافق</legend><div class="btn-row" style="justify-content:flex-start"><button type="button" class="btn btn-light" onclick="AdminOfficesBulkStatusGrid.selectAllCenters(true)">تحديد كل المكاتب</button><button type="button" class="btn btn-light" onclick="AdminOfficesBulkStatusGrid.selectAllCenters(false)">إلغاء كل المكاتب</button></div><div class="admin-bulk-centers-grid">${centers}</div></fieldset>
        <fieldset><legend>2. اختيار الموظفين</legend><div class="btn-row" style="justify-content:flex-start"><button type="button" class="btn btn-light" onclick="AdminOfficesBulkStatusGrid.selectAllEmployees(true)">تحديد كل الموظفين</button><button type="button" class="btn btn-light" onclick="AdminOfficesBulkStatusGrid.selectAllEmployees(false)">إلغاء كل الموظفين</button></div><div id="admin-bulk-employees-list" class="admin-bulk-employees-list"></div></fieldset>
        <fieldset><legend>3. تعديل الحالات لكل يوم</legend><div id="admin-bulk-status-grid"></div></fieldset>
      </div>
      <div class="dialog-footer"><button class="btn btn-secondary" onclick="closeDialog('management-dialog')"><i class="fas fa-times"></i> إلغاء</button><button class="btn btn-success" onclick="AdminOfficesBulkStatusGrid.apply()"><i class="fas fa-save"></i> حفظ الحالات المعروضة</button></div>`;
    if (typeof window.openDialog === 'function') window.openDialog(content, 'management-dialog', true);
    setTimeout(() => { applyDialogClass(); renderEmployees(); renderStatusGrid(); }, 80);
  }

  function applyBulkGrid() {
    const cells = Array.from(document.querySelectorAll('.admin-bulk-cell-status'));
    if (!cells.length) return alert('لا توجد خلايا حالات لحفظها.');
    const data = getData(), p = getPeriod();
    let changed = 0;
    cells.forEach(sel => {
      const centerKey = sel.dataset.center;
      const idx = parseInt(sel.dataset.index, 10);
      const day = parseInt(sel.dataset.day, 10);
      const emp = data[centerKey] && data[centerKey][idx];
      if (!emp || Number.isNaN(day)) return;
      const days = Array.isArray(emp.days) ? emp.days.slice(0, p.daysInExtract) : [];
      while (days.length < p.daysInExtract) days.push('ح');
      if (days[day] !== sel.value) changed++;
      days[day] = sel.value || 'ح';
      emp.days = days;
    });
    saveData(data);
    try { if (typeof window.renderCenterIcons === 'function') window.renderCenterIcons(); } catch (_) {}
    try { if (typeof window.calculateAndDisplayGrandTotal === 'function') window.calculateAndDisplayGrandTotal(); } catch (_) {}
    try { const active = activeCenterKey(); if (active && typeof window.renderAttendanceTable === 'function') window.renderAttendanceTable(active); else if (active && typeof window.populateAttendanceTableBody === 'function') window.populateAttendanceTableBody(active); } catch (_) {}
    try { if (typeof window.closeDialog === 'function') window.closeDialog('management-dialog'); } catch (_) {}
    alert('تم حفظ التعديل الجماعي.\nعدد الخلايا التي تغيرت: ' + changed);
  }

  function printFixCss() {
    return `
      <style id="admin-offices-main-print-compact-fix">
        @page landscape-orientation{size:A4 landscape!important;margin:3.5mm!important}
        @page portrait-orientation-perf{size:A4 portrait!important;margin:6mm!important}
        @page portrait-orientation-ach{size:A4 portrait!important;margin:7mm!important}
        body{margin:0!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
        .page-container{page-break-after:always!important;break-after:page!important;margin:0!important;padding:0!important;overflow:visible!important;break-before:auto!important;page-break-before:auto!important}
        .page-container:first-of-type{break-before:auto!important;page-break-before:auto!important}
        .landscape-page{page:landscape-orientation!important}
        .attendance-report{margin:0!important;padding:0!important;break-before:auto!important;page-break-before:auto!important;break-inside:auto!important;page-break-inside:auto!important;transform-origin:top right!important}
        .attendance-report .printable-header{margin:0 0 2px!important;padding:0 0 2px!important;min-height:0!important;border-bottom:1px solid #bbb!important;align-items:center!important}
        .attendance-report .printable-header .logo{width:32px!important;max-width:32px!important;max-height:32px!important;object-fit:contain!important}
        .attendance-report .printable-header .header-text h1,.attendance-report .printable-header .header-text h2,.attendance-report .printable-header .header-text h3{font-size:7.2pt!important;line-height:1.05!important;margin:0!important}
        .attendance-report .page-contract-info-v2{font-size:6.5pt!important;line-height:1.15!important;margin:0 0 2px!important;padding:2px 4px!important;border-radius:4px!important}
        .attendance-report .extract-details-v2{font-size:6.8pt!important;line-height:1.15!important;margin:0!important;padding:3px 5px!important;border-radius:3px 3px 0 0!important;min-height:0!important}
        .attendance-report .table-summary-v2{font-size:6.6pt!important;line-height:1.1!important;padding:2px 4px!important;margin:0!important;gap:6px!important}
        .attendance-report table{width:100%!important;border-collapse:collapse!important;table-layout:auto!important;margin:0!important;break-before:auto!important;page-break-before:auto!important;break-inside:auto!important;page-break-inside:auto!important}
        .attendance-report thead{display:table-header-group!important}.attendance-report tfoot{display:table-footer-group!important}.attendance-report tr{break-inside:avoid!important;page-break-inside:avoid!important}
        .attendance-report th,.attendance-report td{font-size:5.7pt!important;line-height:1.05!important;padding:1px!important;white-space:nowrap!important;vertical-align:middle!important}
        .attendance-report th.job-title,.attendance-report td.job-title,.attendance-report th.employee-name,.attendance-report td.employee-name{font-size:6.1pt!important;max-width:34mm!important;white-space:normal!important;overflow-wrap:anywhere!important}
        .attendance-report .signatures-grid{margin-top:4px!important;padding-top:3px!important;gap:4px!important}.attendance-report .signature-item{font-size:6.5pt!important}.attendance-report .signature-item .line{min-height:10px!important;margin-top:8px!important}
        @media print{.toolbar,.no-print{display:none!important}}
      </style>`;
  }
  function injectPrintFixInto(win) {
    if (!win || !win.document) return;
    const tryInject = () => { try { if (!win.document.getElementById('admin-offices-main-print-compact-fix')) win.document.head.insertAdjacentHTML('beforeend', printFixCss()); } catch (_) {} };
    tryInject(); setTimeout(tryInject, 80); setTimeout(tryInject, 300); setTimeout(tryInject, 900);
  }
  function patchPrintSelected() {
    if (typeof window.printSelected !== 'function') return false;
    if (window.printSelected.__adminOfficesCompactPrintWrapped) return true;
    const original = window.printSelected;
    window.printSelected = function () {
      let captured = null;
      const oldOpen = window.open;
      window.open = function () { captured = oldOpen.apply(window, arguments); return captured; };
      try { return original.apply(this, arguments); }
      finally { window.open = oldOpen; if (captured) injectPrintFixInto(captured); }
    };
    window.printSelected.__adminOfficesCompactPrintWrapped = true;
    return true;
  }

  window.AdminOfficesBulkStatusGrid = { open: openBulkDialog, renderEmployees, renderStatusGrid, toggleCenterEmployees, selectAllEmployees, selectAllCenters, fillAllCells, apply: applyBulkGrid };

  function patchBulkDialog() {
    injectCss();
    window.openAdminOfficesBulkAttendanceDialog = openBulkDialog;
    if (window.AdminOfficesTools) {
      window.AdminOfficesTools.openAdminOfficesBulkAttendanceDialog = openBulkDialog;
      window.AdminOfficesTools.applyBulkAttendance = applyBulkGrid;
      window.AdminOfficesTools.renderBulkEmployeeList = renderEmployees;
      window.AdminOfficesTools.selectAllBulkEmployees = selectAllEmployees;
    }
  }
  function boot() { patchBulkDialog(); patchPrintSelected(); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  let tries = 0;
  const timer = setInterval(function () { tries++; boot(); if (tries >= 40) clearInterval(timer); }, 250);
  document.addEventListener('click', function () { setTimeout(boot, 80); setTimeout(boot, 350); }, true);

  console.info('[Admin Offices Bulk Status Grid + Print Fix] installed v1');
})();