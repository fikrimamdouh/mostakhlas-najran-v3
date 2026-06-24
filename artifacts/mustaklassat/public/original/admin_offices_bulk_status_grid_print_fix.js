// ===================================================================
// Admin Offices Bulk Attendance Grid Editor — V3
// Scope: admin_offices_attendance.html
// تعديل داخل الملف الموجود فقط:
// - شاشة واحدة فقط للتعديل الجماعي، بدون طبقات متداخلة.
// - تعديل كل حالات الحضور والانصراف مباشرة داخل جدول الأيام لكل موظف.
// - أدوات مساعدة لتطبيق حالة على مدة محددة عند الحاجة، بدون تثبيت الشاشة على حالة واحدة.
// - Scroll داخلي أفقي ورأسي ثابت.
// - ضغط طباعة الحضور الأساسية حتى لا يترك صفحة أولى فارغة.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html|original-viewer\?page=admin_offices_attendance\.html/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_BULK_ATTENDANCE_GRID_V3__) return;
  window.__ADMIN_OFFICES_BULK_ATTENDANCE_GRID_V3__ = true;

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
    const stored = readJson('persistentExtractData', {});
    let base = {};
    try { if (typeof window.getExtractPeriodDetails === 'function') base = window.getExtractPeriodDetails() || {}; } catch (_) {}
    const startRaw = base.startDate || stored.extractStart || stored.periodStart || localStorage.getItem('extractStart') || Date.now();
    const endRaw = base.endDate || stored.extractEnd || stored.periodEnd || localStorage.getItem('extractEnd') || stored.extractStart || startRaw;
    const start = new Date(startRaw), end = new Date(endRaw);
    const safeStart = Number.isNaN(start.getTime()) ? new Date() : start;
    const safeEnd = Number.isNaN(end.getTime()) ? safeStart : end;
    return { startDate: safeStart, endDate: safeEnd, daysInExtract: Math.max(1, Math.ceil((safeEnd - safeStart) / 86400000) + 1 || base.daysInExtract || 30), totalDaysInMonth: base.totalDaysInMonth || new Date(safeStart.getFullYear(), safeStart.getMonth() + 1, 0).getDate() || 30 };
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
    return document.querySelector('.tab-link.active[data-center-key], .center-tab.active[data-center-key], [data-center-key].active')?.dataset?.centerKey || orderedKeys()[0] || '';
  }
  function statusEntries() {
    const fallback = { 'ح': { name: 'حضور' }, 'غ': { name: 'غياب' }, 'غ•': { name: 'غياب بدون حسم' }, 'ج': { name: 'إجازة' }, 'ش': { name: 'شاغر' }, 'ت': { name: 'تأخير' }, 'ب': { name: 'بديل' }, 'ن': { name: 'نقل' } };
    const src = Object.assign({}, fallback, window.STATUS_CODES || {});
    return Object.keys(src).filter(k => k !== 'default').map(code => ({ code, name: (src[code] && src[code].name) || code }));
  }
  function statusOptions(selected) { return statusEntries().map(s => `<option value="${esc(s.code)}" ${s.code === selected ? 'selected' : ''}>${esc(s.code)} — ${esc(s.name)}</option>`).join(''); }
  function compactOptions(selected) { return statusEntries().map(s => `<option value="${esc(s.code)}" ${s.code === selected ? 'selected' : ''}>${esc(s.code)}</option>`).join(''); }
  function dayOptions(selected) {
    const p = getPeriod();
    return Array.from({ length: p.daysInExtract }, (_, i) => {
      const d = new Date(p.startDate); d.setDate(p.startDate.getDate() + i);
      return `<option value="${i}" ${i === selected ? 'selected' : ''}>${i + 1} — ${d.toLocaleDateString('en-CA')}</option>`;
    }).join('');
  }
  function ensureDays(emp) { const p = getPeriod(); if (!Array.isArray(emp.days)) emp.days = []; while (emp.days.length < p.daysInExtract) emp.days.push('ح'); if (emp.days.length > p.daysInExtract) emp.days = emp.days.slice(0, p.daysInExtract); return emp.days; }
  function selectedScope() { return document.getElementById('admin-bulk-center-select')?.value || activeCenterKey(); }
  function scopeKeys() { const s = selectedScope(); return s === '__all__' ? orderedKeys() : [s].filter(Boolean); }
  function searchText() { return clean(document.getElementById('admin-bulk-search')?.value || '').toLowerCase(); }
  function employeeTokens() {
    const data = getData(), names = getNames(), q = searchText(), out = [];
    scopeKeys().forEach(centerKey => {
      (data[centerKey] || []).forEach((emp, idx) => {
        const hay = [names[centerKey], emp.name, emp.jobTitle, emp.iqamaId, emp.nationality, emp.category].map(clean).join(' ').toLowerCase();
        if (!q || hay.includes(q)) out.push({ centerKey, idx, emp, centerName: names[centerKey] || centerKey });
      });
    });
    return out;
  }

  function injectCss() {
    let st = document.getElementById('admin-offices-bulk-grid-print-fix-css');
    if (!st) { st = document.createElement('style'); st.id = 'admin-offices-bulk-grid-print-fix-css'; document.head.appendChild(st); }
    st.textContent = `
      #management-dialog.admin-bulk-edit-dialog{position:fixed!important;inset:0!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:8px!important;background:rgba(15,23,42,.45)!important;z-index:99999!important;overflow:hidden!important}
      #management-dialog.admin-bulk-edit-dialog>.dialog-content,#management-dialog.admin-bulk-edit-dialog>.dialog-box,#management-dialog.admin-bulk-edit-dialog>.dialog-panel,#management-dialog.admin-bulk-edit-dialog>.dialog{width:min(1720px,99vw)!important;height:95vh!important;max-width:99vw!important;max-height:95vh!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;background:#fff!important;border-radius:18px!important;box-shadow:0 24px 80px rgba(15,23,42,.28)!important}
      #management-dialog.admin-bulk-edit-dialog .dialog-header{flex:0 0 auto!important;padding:10px 14px!important;border-bottom:1px solid #e2e8f0!important;background:#f8fafc!important;display:flex!important;justify-content:space-between!important;align-items:center!important}
      #management-dialog.admin-bulk-edit-dialog .dialog-header h3{margin:0!important;font-size:18px!important;color:#003087!important;font-weight:900!important}
      #management-dialog.admin-bulk-edit-dialog .dialog-body{flex:1 1 auto!important;min-height:0!important;overflow:hidden!important;padding:10px!important;display:flex!important;flex-direction:column!important;gap:8px!important}
      #management-dialog.admin-bulk-edit-dialog .dialog-footer{flex:0 0 auto!important;padding:9px 14px!important;border-top:1px solid #e2e8f0!important;background:#f8fafc!important;display:flex!important;justify-content:space-between!important;align-items:center!important;gap:10px!important}
      .admin-bulk-toolbar{display:grid;grid-template-columns:1.3fr 1fr .7fr .7fr .85fr auto auto;gap:8px;background:#eef6ff;border:1px solid #bfdbfe;border-radius:14px;padding:9px;align-items:end;flex:0 0 auto}.admin-bulk-toolbar label{display:block;font-size:11px;font-weight:900;color:#0f172a;margin-bottom:3px}.admin-bulk-toolbar select,.admin-bulk-toolbar input{width:100%;height:34px;border:1px solid #cbd5e1;border-radius:8px;padding:5px 7px;font-family:Tajawal,Arial,sans-serif;font-weight:800;background:#fff}.admin-bulk-toolbar button,.admin-bulk-btn{border:0;border-radius:9px;padding:8px 12px;font-family:Tajawal,Arial,sans-serif;font-weight:900;cursor:pointer}.admin-bulk-toolbar .light,.admin-bulk-btn.light{background:#e2e8f0;color:#0f172a}.admin-bulk-btn.save{background:#0f766e;color:#fff}.admin-bulk-btn.cancel{background:#64748b;color:#fff}.admin-bulk-btn.danger{background:#dc2626;color:#fff}
      .admin-bulk-workspace{flex:1 1 auto;min-height:0;display:grid;grid-template-columns:280px 1fr;gap:8px}.admin-bulk-side{min-height:0;overflow:auto;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc;padding:8px}.admin-bulk-side h4{margin:0 0 8px;color:#003087;font-size:14px}.admin-bulk-center-option{display:flex;gap:8px;align-items:center;border:1px solid #e2e8f0;background:#fff;border-radius:10px;padding:7px;margin:5px 0;font-weight:800;cursor:pointer}.admin-bulk-center-option.active{border-color:#003087;background:#eaf2ff;color:#003087}.admin-bulk-center-option small{margin-inline-start:auto;color:#64748b}
      .admin-bulk-grid-card{min-height:0;display:flex;flex-direction:column;border:1px solid #e2e8f0;border-radius:14px;background:#fff;overflow:hidden}.admin-bulk-grid-head{flex:0 0 auto;display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid #e2e8f0;background:#fff}.admin-bulk-grid-head strong{color:#003087}.admin-bulk-grid-scroll{flex:1 1 auto;min-height:0;overflow:auto;position:relative}.admin-bulk-table{width:max-content;min-width:100%;border-collapse:collapse;font-size:12px}.admin-bulk-table th{position:sticky;top:0;background:#003087;color:#fff;z-index:3}.admin-bulk-table th.sticky-1,.admin-bulk-table td.sticky-1{position:sticky;right:0;z-index:4;background:#fff}.admin-bulk-table th.sticky-2,.admin-bulk-table td.sticky-2{position:sticky;right:42px;z-index:4;background:#fff}.admin-bulk-table th.sticky-1,.admin-bulk-table th.sticky-2{background:#003087;color:#fff}.admin-bulk-table th,.admin-bulk-table td{border:1px solid #e2e8f0;padding:5px;text-align:center;white-space:nowrap}.admin-bulk-table td.name{text-align:right;font-weight:900;min-width:190px}.admin-bulk-table td.meta{text-align:right;color:#475569;min-width:170px}.admin-bulk-status-cell{width:54px;min-width:54px;padding:2px!important}.admin-bulk-status-cell select{width:48px;height:28px;border:1px solid #cbd5e1;border-radius:7px;text-align:center;font-weight:900;font-family:Tahoma,Arial,sans-serif;background:#fff}.admin-bulk-empty{padding:22px;text-align:center;color:#64748b;font-weight:900;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;margin:10px}.admin-bulk-note{font-size:12px;color:#475569;font-weight:800}.admin-print-compact-notice{font-size:12px;color:#475569;text-align:center;margin-top:6px}
      @media(max-width:1100px){.admin-bulk-toolbar{grid-template-columns:1fr 1fr}.admin-bulk-workspace{grid-template-columns:1fr}.admin-bulk-side{max-height:180px}}
    `;
  }
  function applyDialogClass() {
    const dlg = document.getElementById('management-dialog');
    if (!dlg) return;
    dlg.className = 'dialog admin-bulk-edit-dialog';
    const children = Array.from(dlg.children);
    children.forEach((child, idx) => { if (idx > 0) child.remove(); });
  }

  function setScope(key) { const sel = document.getElementById('admin-bulk-center-select'); if (sel) sel.value = key; renderCenters(); renderEmployeeTable(); }
  function renderCenters() {
    const box = document.getElementById('admin-bulk-centers-list'); if (!box) return;
    const names = getNames(), data = getData(), current = selectedScope();
    const allCount = orderedKeys().reduce((s,k)=>s+((data[k]||[]).length),0);
    box.innerHTML = `<div class="admin-bulk-center-option ${current === '__all__' ? 'active' : ''}" onclick="AdminOfficesBulkAttendance.setScope('__all__')"><span>كل المكاتب والمرافق</span><small>${allCount}</small></div>` + orderedKeys().map(k=>`<div class="admin-bulk-center-option ${current === k ? 'active' : ''}" onclick="AdminOfficesBulkAttendance.setScope('${esc(k)}')"><span>${esc(names[k]||k)}</span><small>${(data[k]||[]).length}</small></div>`).join('');
  }
  function renderEmployeeTable() {
    renderCenters();
    const box = document.getElementById('admin-bulk-employee-table-wrap'); if (!box) return;
    const rows = employeeTokens(), p = getPeriod();
    const title = document.getElementById('admin-bulk-selected-title'); if (title) title.textContent = 'الموظفون المعروضون: ' + rows.length;
    if (!rows.length) { box.innerHTML = '<div class="admin-bulk-empty">لا توجد أسماء موظفين مطابقة.</div>'; return; }
    const dayHeads = Array.from({length:p.daysInExtract},(_,i)=>`<th class="admin-bulk-status-cell">${i+1}</th>`).join('');
    box.innerHTML = `<table class="admin-bulk-table"><thead><tr><th class="sticky-1" style="width:42px">✓</th><th class="sticky-2">الموظف</th><th>الموقع</th><th>الوظيفة</th><th>الجنسية</th>${dayHeads}</tr></thead><tbody>${rows.map(r=>{ const days=ensureDays(r.emp); return `<tr><td class="sticky-1"><input type="checkbox" class="admin-bulk-emp-check" data-center="${esc(r.centerKey)}" data-index="${r.idx}" checked></td><td class="sticky-2 name">${esc(r.emp.name||'بدون اسم')}<br><small>${esc(r.emp.iqamaId||'')}</small></td><td>${esc(r.centerName)}</td><td class="meta">${esc(r.emp.jobTitle||'')}</td><td>${esc(r.emp.nationality||'')}</td>${days.map((d,i)=>`<td class="admin-bulk-status-cell"><select data-center="${esc(r.centerKey)}" data-index="${r.idx}" data-day="${i}" onchange="AdminOfficesBulkAttendance.markDirty()">${compactOptions(d)}</select></td>`).join('')}</tr>`; }).join('')}</tbody></table>`;
  }
  function selectVisible(checked) { document.querySelectorAll('.admin-bulk-emp-check').forEach(cb => cb.checked = !!checked); }
  function markDirty(){ const t=document.getElementById('admin-bulk-dirty-note'); if(t) t.textContent='توجد تعديلات غير محفوظة'; }
  function applyRange() {
    const status = document.getElementById('admin-bulk-quick-status')?.value || 'ح';
    const start = parseInt(document.getElementById('admin-bulk-start-day')?.value || '0',10);
    const end = parseInt(document.getElementById('admin-bulk-end-day')?.value || '0',10);
    if (start > end) return alert('مدى الأيام غير صحيح.');
    const selected = new Set(Array.from(document.querySelectorAll('.admin-bulk-emp-check:checked')).map(cb => cb.dataset.center + '::' + cb.dataset.index));
    document.querySelectorAll('.admin-bulk-status-cell select[data-center]').forEach(sel=>{
      const key = sel.dataset.center + '::' + sel.dataset.index;
      const day = parseInt(sel.dataset.day,10);
      if (selected.has(key) && day >= start && day <= end) sel.value = status;
    });
    markDirty();
  }
  function saveGrid() {
    const data = getData();
    let cells = 0;
    document.querySelectorAll('.admin-bulk-status-cell select[data-center]').forEach(sel=>{
      const center = sel.dataset.center, idx = parseInt(sel.dataset.index,10), day = parseInt(sel.dataset.day,10);
      const emp = data[center] && data[center][idx]; if (!emp) return;
      ensureDays(emp); emp.days[day] = sel.value || 'ح'; cells++;
    });
    saveData(data);
    try { if (typeof window.renderCenterIcons === 'function') window.renderCenterIcons(); } catch (_) {}
    try { if (typeof window.calculateAndDisplayGrandTotal === 'function') window.calculateAndDisplayGrandTotal(); } catch (_) {}
    try { const active = activeCenterKey(); if (active && typeof window.showCenterDetails === 'function') window.showCenterDetails(active); } catch (_) {}
    try { if (typeof window.closeDialog === 'function') window.closeDialog('management-dialog'); else document.getElementById('management-dialog')?.remove(); } catch (_) {}
    alert('تم حفظ حالات الحضور والانصراف. عدد الخلايا المحفوظة: ' + cells);
  }

  function openBulkDialog() {
    injectCss();
    const names = getNames(), keys = orderedKeys(), active = activeCenterKey() || keys[0] || '';
    const centerOptions = `<option value="__all__">كل المكاتب والمرافق</option>` + keys.map(k=>`<option value="${esc(k)}" ${k===active?'selected':''}>${esc(names[k]||k)}</option>`).join('');
    const p = getPeriod();
    const content = `
      <div class="dialog-header"><h3><i class="fas fa-calendar-check"></i> تعديل جماعي للحضور والانصراف — كل الحالات</h3><span class="close" onclick="closeDialog('management-dialog')">×</span></div>
      <div class="dialog-body">
        <div class="admin-bulk-toolbar">
          <div><label>المكتب / المرفق</label><select id="admin-bulk-center-select" onchange="AdminOfficesBulkAttendance.renderEmployeeTable()">${centerOptions}</select></div>
          <div><label>بحث</label><input id="admin-bulk-search" type="search" placeholder="اسم / وظيفة / هوية" oninput="AdminOfficesBulkAttendance.renderEmployeeTable()"></div>
          <div><label>من يوم</label><select id="admin-bulk-start-day">${dayOptions(0)}</select></div>
          <div><label>إلى يوم</label><select id="admin-bulk-end-day">${dayOptions(Math.max(0,p.daysInExtract-1))}</select></div>
          <div><label>تطبيق سريع</label><select id="admin-bulk-quick-status">${statusOptions('ح')}</select></div>
          <div><button type="button" class="light" onclick="AdminOfficesBulkAttendance.applyRange()">طبّق على المحددين</button></div>
          <div><button type="button" class="light" onclick="AdminOfficesBulkAttendance.selectVisible(true)">تحديد الكل</button></div>
        </div>
        <div class="admin-bulk-workspace">
          <aside class="admin-bulk-side"><h4>المكاتب والمرافق</h4><div id="admin-bulk-centers-list"></div></aside>
          <main class="admin-bulk-grid-card"><div class="admin-bulk-grid-head"><strong id="admin-bulk-selected-title">الموظفون المعروضون</strong><div><button type="button" class="admin-bulk-btn light" onclick="AdminOfficesBulkAttendance.selectVisible(true)">تحديد المعروض</button> <button type="button" class="admin-bulk-btn light" onclick="AdminOfficesBulkAttendance.selectVisible(false)">إلغاء التحديد</button></div></div><div id="admin-bulk-employee-table-wrap" class="admin-bulk-grid-scroll"></div></main>
        </div>
      </div>
      <div class="dialog-footer"><span class="admin-bulk-note" id="admin-bulk-dirty-note">عدّل أي خلية مباشرة، أو استخدم التطبيق السريع على مدى أيام.</span><div><button class="admin-bulk-btn cancel" onclick="closeDialog('management-dialog')">إلغاء</button><button class="admin-bulk-btn save" onclick="AdminOfficesBulkAttendance.save()">حفظ كل الحالات</button></div></div>`;
    let dlg = document.getElementById('management-dialog');
    if (!dlg) { dlg = document.createElement('div'); dlg.id = 'management-dialog'; document.body.appendChild(dlg); }
    dlg.innerHTML = '<div class="dialog-content">' + content + '</div>';
    dlg.style.display = 'flex';
    applyDialogClass();
    renderCenters(); renderEmployeeTable();
  }

  function printFixCss() { return `<style id="admin-offices-main-print-compact-fix">@page landscape-orientation{size:A4 landscape!important;margin:2.8mm!important}body{margin:0!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}.page-container{page-break-after:always!important;break-after:page!important;margin:0!important;padding:0!important;overflow:visible!important;break-before:auto!important;page-break-before:auto!important}.landscape-page{page:landscape-orientation!important;break-before:auto!important;page-break-before:auto!important}.attendance-report{margin:0!important;padding:0!important;break-before:auto!important;page-break-before:auto!important;break-inside:auto!important;page-break-inside:auto!important;transform-origin:top right!important}.attendance-report .printable-header{margin:0 0 1px!important;padding:0 0 1px!important;min-height:0!important}.attendance-report .printable-header .logo{width:24px!important;max-width:24px!important;max-height:24px!important}.attendance-report table{width:100%!important;border-collapse:collapse!important;table-layout:fixed!important;margin:0!important;break-before:auto!important;page-break-before:auto!important}.attendance-report thead{display:table-header-group!important}.attendance-report tr{break-inside:avoid!important;page-break-inside:avoid!important}.attendance-report th,.attendance-report td{font-size:4.9pt!important;line-height:1.02!important;padding:.6px!important;white-space:nowrap!important}.attendance-report th.employee-name,.attendance-report td.employee-name,.attendance-report th.job-title,.attendance-report td.job-title{white-space:normal!important;overflow-wrap:anywhere!important}@media print{.toolbar,.no-print{display:none!important}}</style>`; }
  function injectPrintFixInto(win) { if (!win || !win.document) return; const f=()=>{try{if(!win.document.getElementById('admin-offices-main-print-compact-fix')) win.document.head.insertAdjacentHTML('beforeend', printFixCss());}catch(_){}}; f(); setTimeout(f,80); setTimeout(f,300); setTimeout(f,900); }
  function patchPrintSelected() { if (typeof window.printSelected !== 'function') return false; if (window.printSelected.__adminOfficesCompactPrintWrappedV3) return true; const old=window.printSelected; window.printSelected=function(){ let w=null; const oo=window.open; window.open=function(){w=oo.apply(window,arguments);return w;}; try{return old.apply(this,arguments);} finally{window.open=oo;if(w)injectPrintFixInto(w);} }; window.printSelected.__adminOfficesCompactPrintWrappedV3=true; return true; }

  window.AdminOfficesBulkAttendance = { open: openBulkDialog, renderCenters, renderEmployeeTable, setScope, selectVisible, applyRange, save: saveGrid, markDirty };
  window.AdminOfficesBulkStatusGrid = window.AdminOfficesBulkAttendance;
  function patchBulkDialog() { injectCss(); window.openAdminOfficesBulkAttendanceDialog = openBulkDialog; if (window.AdminOfficesTools) { window.AdminOfficesTools.openAdminOfficesBulkAttendanceDialog = openBulkDialog; window.AdminOfficesTools.applyBulkAttendance = saveGrid; } }
  function boot() { patchBulkDialog(); patchPrintSelected(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  let tries=0; const timer=setInterval(()=>{tries++; boot(); if(tries>=40) clearInterval(timer);},250);
  document.addEventListener('click',()=>{setTimeout(boot,80); setTimeout(boot,350);},true);
  console.info('[Admin Offices Bulk Attendance Grid Editor] installed v3 all-status editable grid');
})();