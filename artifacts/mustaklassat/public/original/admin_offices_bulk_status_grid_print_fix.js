// ===================================================================
// Admin Offices Bulk Attendance + Print Compact Fix — V2
// Scope: admin_offices_attendance.html
// تعديل داخل الملف الموجود فقط، بدون حارس جديد:
// 1) التعديل الجماعي أصبح بنفس فكرة المستشفيات: شاشة واسعة، اختيار موقع/كل المواقع، بحث موظفين، من/إلى يوم، حالة واحدة، حفظ مباشر.
// 2) كل الحالات متاحة في القائمة.
// 3) ضغط طباعة الحضور الأساسية حتى يبدأ الجدول في الصفحة الأولى ولا يترك صفحة للشعار/الهيدر.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html|original-viewer\?page=admin_offices_attendance\.html/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_BULK_ATTENDANCE_STANDARD_V2__) return;
  window.__ADMIN_OFFICES_BULK_ATTENDANCE_STANDARD_V2__ = true;

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
    return { startDate: safeStart, endDate: safeEnd, daysInExtract: Math.max(1, Math.ceil((safeEnd - safeStart) / 86400000) + 1 || 30), totalDaysInMonth: new Date(safeStart.getFullYear(), safeStart.getMonth() + 1, 0).getDate() || 30 };
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
  function activeCenterKey() {
    try { if (typeof window.getActiveAdminOfficeCenterKey === 'function') return window.getActiveAdminOfficeCenterKey(); } catch (_) {}
    return document.querySelector('.tab-link.active[data-center-key], .center-tab.active[data-center-key], [data-center-key].active')?.dataset?.centerKey || '';
  }
  function statusEntries() {
    const fallback = { 'ح': { name: 'حضور' }, 'غ': { name: 'غياب' }, 'ج': { name: 'إجازة' }, 'ش': { name: 'شاغر' }, 'ت': { name: 'تأخير' }, 'ب': { name: 'بديل' }, 'ن': { name: 'نقل' }, 'غ•': { name: 'غياب بدون حسم' } };
    const src = window.STATUS_CODES || fallback;
    return Object.keys(src).filter(k => k !== 'default').map(code => ({ code, name: (src[code] && src[code].name) || code }));
  }
  function statusOptions(selected) { return statusEntries().map(s => `<option value="${esc(s.code)}" ${s.code === selected ? 'selected' : ''}>${esc(s.code)} — ${esc(s.name)}</option>`).join(''); }
  function dayOptions(selected) {
    const p = getPeriod();
    return Array.from({ length: p.daysInExtract }, (_, i) => {
      const d = new Date(p.startDate); d.setDate(p.startDate.getDate() + i);
      return `<option value="${i}" ${i === selected ? 'selected' : ''}>اليوم ${i + 1} — ${d.toLocaleDateString('en-CA')}</option>`;
    }).join('');
  }

  function injectCss() {
    if (document.getElementById('admin-offices-bulk-grid-print-fix-css')) return;
    const st = document.createElement('style');
    st.id = 'admin-offices-bulk-grid-print-fix-css';
    st.textContent = `
      .admin-bulk-standard-dialog{align-items:center!important;justify-content:center!important;padding:8px!important;overflow:hidden!important}
      .admin-bulk-standard-dialog .dialog-content,.admin-bulk-standard-dialog .dialog-box,.admin-bulk-standard-dialog .dialog-panel,.admin-bulk-standard-dialog .dialog{width:min(1500px,99vw)!important;max-width:99vw!important;height:94vh!important;max-height:94vh!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;border-radius:18px!important;background:#fff!important}
      .admin-bulk-standard-dialog .dialog-header{flex:0 0 auto!important;padding:12px 16px!important;border-bottom:1px solid #e2e8f0!important;background:#f8fafc!important}.admin-bulk-standard-dialog .dialog-header h3{margin:0!important;font-size:20px!important;color:#003087!important;font-weight:900!important}
      .admin-bulk-standard-dialog .dialog-body{flex:1 1 auto!important;overflow:hidden!important;padding:12px!important;display:grid!important;grid-template-rows:auto 1fr!important;gap:10px!important;min-height:0!important}
      .admin-bulk-standard-dialog .dialog-footer{flex:0 0 auto!important;padding:10px 16px!important;border-top:1px solid #e2e8f0!important;background:#f8fafc!important;display:flex!important;justify-content:space-between!important;gap:10px!important;align-items:center!important}
      .admin-bulk-standard-top{display:grid;grid-template-columns:1.4fr 1fr .8fr .8fr .9fr auto;gap:8px;background:#eef6ff;border:1px solid #bfdbfe;border-radius:14px;padding:10px;align-items:end}.admin-bulk-standard-top label{display:block;font-size:12px;font-weight:900;color:#0f172a;margin-bottom:4px}.admin-bulk-standard-top select,.admin-bulk-standard-top input{width:100%;height:36px;border:1px solid #cbd5e1;border-radius:9px;padding:6px 8px;font-family:Tajawal,Arial,sans-serif;font-weight:800;background:#fff}
      .admin-bulk-standard-layout{display:grid;grid-template-columns:320px 1fr;gap:10px;min-height:0}.admin-bulk-side{border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc;padding:10px;overflow:auto}.admin-bulk-side h4{margin:0 0 8px;color:#003087;font-size:15px}.admin-bulk-center-option{display:flex;gap:8px;align-items:center;border:1px solid #e2e8f0;background:#fff;border-radius:10px;padding:7px;margin:6px 0;font-weight:800;cursor:pointer}.admin-bulk-center-option.active{border-color:#003087;background:#eaf2ff;color:#003087}.admin-bulk-center-option small{margin-inline-start:auto;color:#64748b}
      .admin-bulk-main{min-height:0;display:flex;flex-direction:column;border:1px solid #e2e8f0;border-radius:14px;background:#fff;overflow:hidden}.admin-bulk-main-head{flex:0 0 auto;display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px;border-bottom:1px solid #e2e8f0;background:#fff}.admin-bulk-main-head strong{color:#003087}.admin-bulk-actions{display:flex;gap:6px;flex-wrap:wrap}.admin-bulk-actions button,.admin-bulk-standard-top button,.admin-bulk-standard-dialog .dialog-footer button{border:0;border-radius:9px;padding:8px 12px;font-family:Tajawal,Arial,sans-serif;font-weight:900;cursor:pointer}.admin-bulk-actions .light,.admin-bulk-standard-top .light{background:#e2e8f0;color:#0f172a}.admin-bulk-standard-dialog .save{background:#0f766e;color:#fff}.admin-bulk-standard-dialog .cancel{background:#64748b;color:#fff}
      .admin-bulk-table-wrap{flex:1 1 auto;overflow:auto;min-height:0}.admin-bulk-employee-table{width:100%;border-collapse:collapse;font-size:13px}.admin-bulk-employee-table th{position:sticky;top:0;background:#003087;color:#fff;z-index:2}.admin-bulk-employee-table th,.admin-bulk-employee-table td{border:1px solid #e2e8f0;padding:7px;text-align:center}.admin-bulk-employee-table td.name{text-align:right;font-weight:900}.admin-bulk-employee-table td.job{text-align:right;color:#475569}.admin-bulk-empty{padding:22px;text-align:center;color:#64748b;font-weight:900;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;margin:10px}.admin-bulk-note{font-size:12px;color:#475569;font-weight:800}.admin-print-compact-notice{font-size:12px;color:#475569;text-align:center;margin-top:6px}
      @media(max-width:1000px){.admin-bulk-standard-top{grid-template-columns:1fr 1fr}.admin-bulk-standard-layout{grid-template-columns:1fr}.admin-bulk-side{max-height:190px}}
    `;
    document.head.appendChild(st);
  }
  function applyDialogClass() { const dlg = document.getElementById('management-dialog'); if (dlg) { dlg.classList.remove('admin-bulk-grid-dialog'); dlg.classList.add('admin-bulk-standard-dialog'); } }

  function selectedScope() { return document.getElementById('admin-bulk-center-select')?.value || activeCenterKey() || orderedKeys()[0] || ''; }
  function scopeKeys() { const scope = selectedScope(); return scope === '__all__' ? orderedKeys() : [scope].filter(Boolean); }
  function searchText() { return clean(document.getElementById('admin-bulk-search')?.value || '').toLowerCase(); }
  function setScope(key) { const sel = document.getElementById('admin-bulk-center-select'); if (sel) sel.value = key; renderCenters(); renderEmployeeTable(); }
  function renderCenters() {
    const box = document.getElementById('admin-bulk-centers-list');
    if (!box) return;
    const names = getNames(), data = getData(), current = selectedScope();
    const allCount = orderedKeys().reduce((s, k) => s + ((data[k] || []).length), 0);
    box.innerHTML = `<div class="admin-bulk-center-option ${current === '__all__' ? 'active' : ''}" onclick="AdminOfficesBulkAttendance.setScope('__all__')"><span>كل المكاتب والمرافق</span><small>${allCount}</small></div>` + orderedKeys().map(k => `<div class="admin-bulk-center-option ${current === k ? 'active' : ''}" onclick="AdminOfficesBulkAttendance.setScope('${esc(k)}')"><span>${esc(names[k] || k)}</span><small>${(data[k] || []).length}</small></div>`).join('');
  }
  function employeeTokens() {
    const data = getData(), names = getNames(), q = searchText();
    const out = [];
    scopeKeys().forEach(centerKey => {
      (data[centerKey] || []).forEach((emp, idx) => {
        const hay = [names[centerKey], emp.name, emp.jobTitle, emp.iqamaId, emp.nationality, emp.category].map(clean).join(' ').toLowerCase();
        if (!q || hay.includes(q)) out.push({ centerKey, idx, emp, centerName: names[centerKey] || centerKey });
      });
    });
    return out;
  }
  function renderEmployeeTable() {
    renderCenters();
    const box = document.getElementById('admin-bulk-employee-table-wrap');
    if (!box) return;
    const rows = employeeTokens();
    const title = document.getElementById('admin-bulk-selected-title');
    if (title) title.textContent = 'الموظفون المعروضون: ' + rows.length;
    if (!rows.length) { box.innerHTML = '<div class="admin-bulk-empty">لا توجد أسماء موظفين مطابقة للاختيار الحالي.</div>'; return; }
    box.innerHTML = `<table class="admin-bulk-employee-table"><thead><tr><th style="width:38px"><input type="checkbox" checked onchange="AdminOfficesBulkAttendance.selectVisible(this.checked)"></th><th>الموقع</th><th>الموظف</th><th>الوظيفة</th><th>الفئة</th><th>الجنسية</th><th>رقم الهوية/الإقامة</th></tr></thead><tbody>${rows.map(r => `<tr><td><input type="checkbox" class="admin-bulk-emp-check" data-center="${esc(r.centerKey)}" data-index="${r.idx}" checked></td><td>${esc(r.centerName)}</td><td class="name">${esc(r.emp.name || 'بدون اسم')}</td><td class="job">${esc(r.emp.jobTitle || '')}</td><td>${esc(r.emp.category || '')}</td><td>${esc(r.emp.nationality || '')}</td><td>${esc(r.emp.iqamaId || '')}</td></tr>`).join('')}</tbody></table>`;
  }
  function selectVisible(checked) { document.querySelectorAll('.admin-bulk-emp-check').forEach(cb => cb.checked = !!checked); }

  function openBulkDialog() {
    injectCss();
    const names = getNames(), keys = orderedKeys(), active = activeCenterKey(), defaultKey = active || keys[0] || '';
    const centerOptions = `<option value="__all__">كل المكاتب والمرافق</option>` + keys.map(k => `<option value="${esc(k)}" ${k === defaultKey ? 'selected' : ''}>${esc(names[k] || k)}</option>`).join('');
    const p = getPeriod();
    const content = `
      <div class="dialog-header"><h3><i class="fas fa-calendar-check"></i> تعديل جماعي للحضور والانصراف</h3><span class="close" onclick="closeDialog('management-dialog')">×</span></div>
      <div class="dialog-body">
        <div class="admin-bulk-standard-top">
          <div><label>المكتب / المرفق</label><select id="admin-bulk-center-select" onchange="AdminOfficesBulkAttendance.renderEmployeeTable()">${centerOptions}</select></div>
          <div><label>بحث بالاسم / الوظيفة / الهوية</label><input id="admin-bulk-search" type="search" placeholder="بحث سريع" oninput="AdminOfficesBulkAttendance.renderEmployeeTable()"></div>
          <div><label>من يوم</label><select id="admin-bulk-start-day">${dayOptions(0)}</select></div>
          <div><label>إلى يوم</label><select id="admin-bulk-end-day">${dayOptions(Math.max(0, p.daysInExtract - 1))}</select></div>
          <div><label>الحالة الجديدة</label><select id="admin-bulk-status">${statusOptions('ح')}</select></div>
          <div><button type="button" class="light" onclick="AdminOfficesBulkAttendance.selectVisible(true)">تحديد الكل</button></div>
        </div>
        <div class="admin-bulk-standard-layout">
          <aside class="admin-bulk-side"><h4>المكاتب والمرافق</h4><div id="admin-bulk-centers-list"></div></aside>
          <main class="admin-bulk-main"><div class="admin-bulk-main-head"><strong id="admin-bulk-selected-title">الموظفون المعروضون</strong><div class="admin-bulk-actions"><button type="button" class="light" onclick="AdminOfficesBulkAttendance.selectVisible(true)">تحديد المعروض</button><button type="button" class="light" onclick="AdminOfficesBulkAttendance.selectVisible(false)">إلغاء المعروض</button></div></div><div id="admin-bulk-employee-table-wrap" class="admin-bulk-table-wrap"></div></main>
        </div>
      </div>
      <div class="dialog-footer"><span class="admin-bulk-note">سيتم تطبيق الحالة المختارة على الأيام المحددة للموظفين المحددين فقط.</span><div><button class="cancel" onclick="closeDialog('management-dialog')"><i class="fas fa-times"></i> إلغاء</button><button class="save" onclick="AdminOfficesBulkAttendance.apply()"><i class="fas fa-save"></i> حفظ التعديل الجماعي</button></div></div>`;
    if (typeof window.openDialog === 'function') window.openDialog(content, 'management-dialog', true);
    else {
      let dlg = document.getElementById('management-dialog');
      if (!dlg) { dlg = document.createElement('div'); dlg.id = 'management-dialog'; dlg.className = 'dialog'; document.body.appendChild(dlg); }
      dlg.innerHTML = '<div class="dialog-content">' + content + '</div>'; dlg.style.display = 'flex';
    }
    setTimeout(() => { applyDialogClass(); renderCenters(); renderEmployeeTable(); }, 80);
  }

  function applyBulk() {
    const checks = Array.from(document.querySelectorAll('.admin-bulk-emp-check:checked'));
    if (!checks.length) return alert('اختر موظفًا واحدًا على الأقل.');
    const start = parseInt(document.getElementById('admin-bulk-start-day')?.value || '0', 10);
    const end = parseInt(document.getElementById('admin-bulk-end-day')?.value || '0', 10);
    if (start > end) return alert('مدى الأيام غير صحيح.');
    const status = document.getElementById('admin-bulk-status')?.value || 'ح';
    const data = getData(), p = getPeriod();
    let changed = 0, employees = 0;
    checks.forEach(cb => {
      const centerKey = cb.dataset.center;
      const idx = parseInt(cb.dataset.index, 10);
      const emp = data[centerKey] && data[centerKey][idx];
      if (!emp) return;
      employees++;
      const days = Array.isArray(emp.days) ? emp.days.slice(0, p.daysInExtract) : [];
      while (days.length < p.daysInExtract) days.push('ح');
      for (let d = start; d <= end && d < p.daysInExtract; d++) {
        if (days[d] !== status) changed++;
        days[d] = status;
      }
      emp.days = days;
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
    alert('تم حفظ التعديل الجماعي.\nعدد الموظفين: ' + employees + '\nعدد الخلايا التي تغيرت: ' + changed);
  }

  function printFixCss() {
    return `
      <style id="admin-offices-main-print-compact-fix">
        @page landscape-orientation{size:A4 landscape!important;margin:2.8mm!important}
        @page portrait-orientation-perf{size:A4 portrait!important;margin:4mm!important}
        @page portrait-orientation-ach{size:A4 portrait!important;margin:7mm!important}
        body{margin:0!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
        .page-container{page-break-after:always!important;break-after:page!important;margin:0!important;padding:0!important;overflow:visible!important;break-before:auto!important;page-break-before:auto!important}
        .page-container:first-of-type{break-before:auto!important;page-break-before:auto!important}
        .landscape-page{page:landscape-orientation!important;break-before:auto!important;page-break-before:auto!important}
        .attendance-report{margin:0!important;padding:0!important;break-before:auto!important;page-break-before:auto!important;break-inside:auto!important;page-break-inside:auto!important;transform-origin:top right!important}
        .attendance-report .printable-header{margin:0 0 1px!important;padding:0 0 1px!important;min-height:0!important;border-bottom:1px solid #bbb!important;align-items:center!important}
        .attendance-report .printable-header .logo{width:24px!important;max-width:24px!important;max-height:24px!important;object-fit:contain!important}
        .attendance-report .printable-header .header-text h1,.attendance-report .printable-header .header-text h2,.attendance-report .printable-header .header-text h3{font-size:6.4pt!important;line-height:1!important;margin:0!important}
        .attendance-report .page-contract-info-v2{font-size:5.8pt!important;line-height:1.05!important;margin:0 0 1px!important;padding:1px 3px!important;border-radius:3px!important}
        .attendance-report .extract-details-v2{font-size:6.1pt!important;line-height:1.05!important;margin:0!important;padding:2px 4px!important;border-radius:2px 2px 0 0!important;min-height:0!important}
        .attendance-report .table-summary-v2{font-size:5.8pt!important;line-height:1.05!important;padding:1px 3px!important;margin:0!important;gap:5px!important}
        .attendance-report table{width:100%!important;border-collapse:collapse!important;table-layout:fixed!important;margin:0!important;break-before:auto!important;page-break-before:auto!important;break-inside:auto!important;page-break-inside:auto!important}
        .attendance-report thead{display:table-header-group!important}.attendance-report tfoot{display:table-footer-group!important}.attendance-report tr{break-inside:avoid!important;page-break-inside:avoid!important}
        .attendance-report th,.attendance-report td{font-size:4.9pt!important;line-height:1.02!important;padding:.6px!important;white-space:nowrap!important;vertical-align:middle!important}
        .attendance-report th.job-title,.attendance-report td.job-title,.attendance-report th.employee-name,.attendance-report td.employee-name{font-size:5.2pt!important;max-width:30mm!important;white-space:normal!important;overflow-wrap:anywhere!important}
        .attendance-report .signatures-grid{margin-top:2px!important;padding-top:2px!important;gap:4px!important}.attendance-report .signature-item{font-size:5.8pt!important}.attendance-report .signature-item .line{min-height:8px!important;margin-top:6px!important}
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
    if (window.printSelected.__adminOfficesCompactPrintWrappedV2) return true;
    const original = window.printSelected;
    window.printSelected = function () {
      let captured = null;
      const oldOpen = window.open;
      window.open = function () { captured = oldOpen.apply(window, arguments); return captured; };
      try { return original.apply(this, arguments); }
      finally { window.open = oldOpen; if (captured) injectPrintFixInto(captured); }
    };
    window.printSelected.__adminOfficesCompactPrintWrappedV2 = true;
    return true;
  }

  window.AdminOfficesBulkAttendance = { open: openBulkDialog, renderCenters, renderEmployeeTable, setScope, selectVisible, apply: applyBulk };
  window.AdminOfficesBulkStatusGrid = window.AdminOfficesBulkAttendance;

  function patchBulkDialog() {
    injectCss();
    window.openAdminOfficesBulkAttendanceDialog = openBulkDialog;
    if (window.AdminOfficesTools) {
      window.AdminOfficesTools.openAdminOfficesBulkAttendanceDialog = openBulkDialog;
      window.AdminOfficesTools.applyBulkAttendance = applyBulk;
      window.AdminOfficesTools.renderBulkEmployeeList = renderEmployeeTable;
      window.AdminOfficesTools.selectAllBulkEmployees = selectVisible;
    }
  }
  function boot() { patchBulkDialog(); patchPrintSelected(); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  let tries = 0;
  const timer = setInterval(function () { tries++; boot(); if (tries >= 40) clearInterval(timer); }, 250);
  document.addEventListener('click', function () { setTimeout(boot, 80); setTimeout(boot, 350); }, true);
  console.info('[Admin Offices Bulk Attendance + Print Fix] installed v2 standard editor');
})();