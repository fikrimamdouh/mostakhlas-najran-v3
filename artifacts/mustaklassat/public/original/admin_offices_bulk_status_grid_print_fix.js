// ===================================================================
// Admin Offices Bulk Attendance Clean Editor + Print Compact Fix
// Scope: admin_offices_attendance.html
// - Keeps existing button/function: openAdminOfficesBulkAttendanceDialog()
// - Removes legacy giant grid overlay behavior.
// - Uses the page's normal dialog system only.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html|original-viewer\?page=admin_offices_attendance\.html/.test(location.pathname + location.search)) return;

  const MAIN_KEY = 'adminOfficesAttendanceData_v1';
  const BACKUP_KEY = 'adminOfficesAttendanceData_v1_localBackup';
  const LAST_GOOD_KEY = 'adminOfficesAttendanceData_v1_lastGood';
  const LEGACY_KEY = 'adminOfficesAttendanceData';
  const SAFE_KEY = 'adminOfficesLaborDataSafe_v2';

  function readJson(key, fallback) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; } }
  function esc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function clean(v) { return String(v ?? '').replace(/[\u200e\u200f]/g, '').replace(/\s+/g, ' ').trim(); }
  function norm(v) { return clean(v).toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه'); }
  function countRows(data) { return Object.values(data || {}).reduce((s, rows) => s + (Array.isArray(rows) ? rows.length : 0), 0); }
  function score(data) { let named = 0; Object.values(data || {}).forEach(rows => Array.isArray(rows) && rows.forEach(e => { if (clean(e && e.name)) named++; })); return { rows: countRows(data), named }; }

  function getNames() {
    try { if (typeof window.getCenterNames === 'function') return window.getCenterNames() || {}; } catch (_) {}
    return readJson('adminOfficeNames_v1', {});
  }

  function getData() {
    const list = [];
    try { if (typeof window.getAttendanceData === 'function') list.push(window.getAttendanceData() || {}); } catch (_) {}
    list.push(readJson(MAIN_KEY, {}), readJson(BACKUP_KEY, {}), readJson(LAST_GOOD_KEY, {}), readJson(SAFE_KEY, {}), readJson(LEGACY_KEY, {}));
    return list.reduce((best, item) => {
      const b = score(best), s = score(item);
      if (s.named > b.named) return item;
      if (s.named === b.named && s.rows > b.rows) return item;
      return best;
    }, {});
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
    return { startDate: safeStart, endDate: safeEnd, daysInExtract: Math.max(1, Math.ceil((safeEnd - safeStart) / 86400000) + 1 || base.daysInExtract || 30) };
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
    const fallback = { 'ح': { name: 'حضور' }, 'غ': { name: 'غياب' }, 'غ•': { name: 'غياب بدون حسم' }, 'ج': { name: 'إجازة' }, 'ش': { name: 'شاغر' }, 'ت': { name: 'تحت الإجراء' }, 'ب': { name: 'بداية العقد' }, 'ن': { name: 'نهاية العقد' } };
    const src = Object.assign({}, fallback, window.STATUS_CODES || {});
    return Object.keys(src).filter(k => k !== 'default').map(code => ({ code, name: (src[code] && src[code].name) || code }));
  }

  function statusOptions(selected) { return statusEntries().map(s => `<option value="${esc(s.code)}" ${s.code === selected ? 'selected' : ''}>${esc(s.code)} — ${esc(s.name)}</option>`).join(''); }
  function dayOptions(selected) {
    const p = getPeriod();
    return Array.from({ length: p.daysInExtract }, (_, i) => `<option value="${i}" ${i === selected ? 'selected' : ''}>اليوم ${i + 1}</option>`).join('');
  }

  function ensureDays(emp) {
    const p = getPeriod();
    if (!Array.isArray(emp.days)) emp.days = [];
    while (emp.days.length < p.daysInExtract) emp.days.push('ح');
    if (emp.days.length > p.daysInExtract) emp.days = emp.days.slice(0, p.daysInExtract);
    return emp.days;
  }

  function selectedCenters() {
    return Array.from(document.querySelectorAll('.aob-center-check:checked')).map(cb => cb.value);
  }

  function employeeRows() {
    const data = getData(), names = getNames(), q = norm(document.getElementById('aob-search')?.value || ''), centers = selectedCenters(), out = [];
    centers.forEach(centerKey => {
      (data[centerKey] || []).forEach((emp, idx) => {
        const hay = norm([names[centerKey], emp.name, emp.jobTitle, emp.iqamaId, emp.nationality, emp.category].map(clean).join(' '));
        if (!q || hay.includes(q)) out.push({ centerKey, idx, emp, centerName: names[centerKey] || centerKey, days: ensureDays(emp) });
      });
    });
    return out;
  }

  function dayChips(days, start, end, rangeOnly) {
    const from = rangeOnly ? Math.min(start, end) : 0;
    const to = rangeOnly ? Math.max(start, end) : days.length - 1;
    return days.slice(from, to + 1).map((d, offset) => `<span class="aob-day-chip" title="اليوم ${from + offset + 1}"><b>${from + offset + 1}</b>${esc(d || 'ح')}</span>`).join('');
  }

  function injectCss() {
    let st = document.getElementById('admin-offices-bulk-grid-print-fix-css');
    if (!st) { st = document.createElement('style'); st.id = 'admin-offices-bulk-grid-print-fix-css'; document.head.appendChild(st); }
    st.textContent = `
      #management-dialog.admin-bulk-clean-dialog .dialog-body{max-height:72vh!important;overflow-y:auto!important;padding:14px!important;display:block!important}
      #management-dialog.admin-bulk-clean-dialog .aob-toolbar{display:grid;grid-template-columns:2fr 1fr 1fr 1.1fr;gap:10px;align-items:end;margin-bottom:10px;background:#eef6ff;border:1px solid #bfdbfe;border-radius:14px;padding:10px}
      #management-dialog.admin-bulk-clean-dialog .aob-toolbar label{display:block;font-size:12px;font-weight:900;color:#0f172a;margin-bottom:4px}
      #management-dialog.admin-bulk-clean-dialog .aob-toolbar input,#management-dialog.admin-bulk-clean-dialog .aob-toolbar select{width:100%;height:36px;border:1px solid #cbd5e1;border-radius:9px;padding:6px 8px;font-family:Tajawal,Arial,sans-serif;font-weight:800;background:#fff}
      .aob-range-row{display:flex;gap:8px;align-items:center;font-weight:900;color:#334155;margin:8px 0 12px}.aob-centers{max-height:160px;overflow:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px}.aob-center-row{display:flex;gap:8px;align-items:center;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px;font-weight:800}.aob-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-start;margin-bottom:10px}.aob-results{max-height:360px;overflow:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:10px}.aob-employee-row{display:flex;flex-direction:column;gap:6px;background:#fff;border:1px solid #dbeafe;border-radius:12px;padding:10px}.aob-employee-head{display:flex;gap:8px;align-items:center}.aob-employee-row small{color:#64748b}.aob-days{display:flex;flex-wrap:wrap;gap:4px;direction:ltr;justify-content:flex-end}.aob-day-chip{min-width:32px;border:1px solid #cbd5e1;border-radius:7px;background:#f8fafc;padding:3px 5px;text-align:center;font-size:11px;color:#111827}.aob-day-chip b{display:block;font-size:10px;color:#64748b}.aob-empty{padding:14px;border:1px dashed #cbd5e1;background:#fff;border-radius:10px;color:#64748b}.aob-btn{border:0;border-radius:9px;padding:8px 12px;font-family:Tajawal,Arial,sans-serif;font-weight:900;cursor:pointer}.aob-btn.light{background:#e2e8f0;color:#0f172a}.aob-btn.save{background:#0f766e;color:#fff}.aob-btn.cancel{background:#64748b;color:#fff}
      @media(max-width:900px){#management-dialog.admin-bulk-clean-dialog .aob-toolbar{grid-template-columns:1fr}.aob-results{grid-template-columns:1fr}}
    `;
  }

  function renderEmployees() {
    const box = document.getElementById('aob-employee-results'); if (!box) return;
    const rows = employeeRows();
    const start = parseInt(document.getElementById('aob-start-day')?.value || '0', 10);
    const end = parseInt(document.getElementById('aob-end-day')?.value || '0', 10);
    const rangeOnly = !!document.getElementById('aob-range-only')?.checked;
    if (!selectedCenters().length) { box.innerHTML = '<div class="aob-empty">اختر مكتبًا أو مرفقًا أولاً.</div>'; return; }
    if (!rows.length) { box.innerHTML = '<div class="aob-empty">لا توجد نتائج مطابقة.</div>'; return; }
    box.innerHTML = rows.map(r => `<label class="aob-employee-row"><div class="aob-employee-head"><input type="checkbox" class="aob-employee-check" value="${esc(r.centerKey)}::${r.idx}"><strong>${esc(r.emp.name || 'بدون اسم')}</strong></div><small>${esc(r.centerName)} — ${esc(r.emp.jobTitle || '')} — ${esc(r.emp.iqamaId || '')}</small><div class="aob-days">${dayChips(r.days, start, end, rangeOnly)}</div></label>`).join('');
  }

  function selectVisible(checked) { document.querySelectorAll('#aob-employee-results .aob-employee-check').forEach(cb => { cb.checked = !!checked; }); }

  function saveRange() {
    const start = parseInt(document.getElementById('aob-start-day')?.value || '0', 10);
    const end = parseInt(document.getElementById('aob-end-day')?.value || '0', 10);
    const status = document.getElementById('aob-status')?.value || 'ح';
    const selected = Array.from(document.querySelectorAll('.aob-employee-check:checked')).map(cb => cb.value);
    if (!selected.length) return alert('اختر موظفًا واحدًا على الأقل.');
    if (start > end) return alert('مدى الأيام غير صحيح.');
    if (!statusEntries().some(s => s.code === status)) return alert('حالة الحضور غير صحيحة.');
    const data = getData(), p = getPeriod(), touched = new Set();
    let affected = 0;
    selected.forEach(token => {
      const [centerKey, rawIdx] = token.split('::');
      const idx = parseInt(rawIdx, 10);
      const emp = data[centerKey]?.[idx];
      if (!emp) return;
      const days = ensureDays(emp);
      for (let i = start; i <= end && i < p.daysInExtract; i++) days[i] = status;
      emp.days = days;
      touched.add(centerKey);
      affected++;
    });
    saveData(data);
    try { if (typeof window.renderCenterIcons === 'function') window.renderCenterIcons(); } catch (_) {}
    try { if (typeof window.calculateAndDisplayGrandTotal === 'function') window.calculateAndDisplayGrandTotal(); } catch (_) {}
    try { const active = activeCenterKey(); if (active && touched.has(active) && typeof window.showCenterDetails === 'function') window.showCenterDetails(active); } catch (_) {}
    try { if (typeof window.closeDialog === 'function') window.closeDialog('management-dialog'); } catch (_) {}
    alert(`تم تطبيق التعديل الجماعي بنجاح.\n\nعدد الموظفين المتأثرين: ${affected}\nعدد المكاتب المتأثرة: ${touched.size}`);
  }

  function openBulkDialog() {
    injectCss();
    const names = getNames(), keys = orderedKeys(), active = activeCenterKey() || keys[0] || '';
    const centersHtml = keys.map(k => `<label class="aob-center-row"><input type="checkbox" class="aob-center-check" value="${esc(k)}" ${k === active ? 'checked' : ''} onchange="AdminOfficesBulkAttendance.render()"><span>${esc(names[k] || k)}</span></label>`).join('');
    const content = `<div class="dialog-header"><h3><i class="fas fa-calendar-check"></i> تعديل جماعي للحضور والانصراف</h3><span class="close" onclick="closeDialog('management-dialog')">×</span></div><div class="dialog-body"><p class="info-text">بحث واختيار دقيق. الاسم المكرر يظهر كأكثر من صف حسب المكتب/المرفق، ولا يتم تحديد أي موظف تلقائيًا.</p><div class="aob-toolbar"><div><label>بحث</label><input id="aob-search" type="search" placeholder="اسم / وظيفة / هوية / موقع" oninput="AdminOfficesBulkAttendance.render()"></div><div><label>من يوم</label><select id="aob-start-day" onchange="AdminOfficesBulkAttendance.render()">${dayOptions(0)}</select></div><div><label>إلى يوم</label><select id="aob-end-day" onchange="AdminOfficesBulkAttendance.render()">${dayOptions(0)}</select></div><div><label>الحالة الجديدة</label><select id="aob-status">${statusOptions('ح')}</select></div></div><label class="aob-range-row"><input type="checkbox" id="aob-range-only" onchange="AdminOfficesBulkAttendance.render()"> عرض أيام النطاق المختار فقط</label><fieldset><legend>1. اختيار المكاتب والمرافق</legend><div class="aob-actions"><button type="button" class="aob-btn light" onclick="document.querySelectorAll('.aob-center-check').forEach(cb=>cb.checked=true);AdminOfficesBulkAttendance.render()">تحديد كل المكاتب</button><button type="button" class="aob-btn light" onclick="document.querySelectorAll('.aob-center-check').forEach(cb=>cb.checked=false);AdminOfficesBulkAttendance.render()">إلغاء المكاتب</button></div><div class="aob-centers">${centersHtml}</div></fieldset><fieldset style="margin-top:14px"><legend>2. نتائج الموظفين والحالات الحالية</legend><div class="aob-actions"><button type="button" class="aob-btn light" onclick="AdminOfficesBulkAttendance.selectVisible(true)">تحديد النتائج المعروضة</button><button type="button" class="aob-btn light" onclick="AdminOfficesBulkAttendance.selectVisible(false)">إلغاء النتائج المعروضة</button></div><div id="aob-employee-results" class="aob-results"></div></fieldset></div><div class="dialog-footer"><button class="aob-btn cancel" onclick="closeDialog('management-dialog')">إلغاء</button><button class="aob-btn save" onclick="AdminOfficesBulkAttendance.save()">تطبيق التعديل</button></div>`;
    if (typeof window.openDialog === 'function') window.openDialog(content, 'management-dialog', true);
    setTimeout(() => { const dlg = document.getElementById('management-dialog'); if (dlg) dlg.classList.add('admin-bulk-clean-dialog'); renderEmployees(); }, 60);
  }

  function printFixCss() { return `<style id="admin-offices-main-print-compact-fix">@page landscape-orientation{size:A4 landscape!important;margin:2.8mm!important}body{margin:0!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}.page-container{page-break-after:always!important;break-after:page!important;margin:0!important;padding:0!important;overflow:visible!important;break-before:auto!important;page-break-before:auto!important}.landscape-page{page:landscape-orientation!important;break-before:auto!important;page-break-before:auto!important}.attendance-report{margin:0!important;padding:0!important;break-before:auto!important;page-break-before:auto!important;break-inside:auto!important;page-break-inside:auto!important;transform-origin:top right!important}.attendance-report .printable-header{margin:0 0 1px!important;padding:0 0 1px!important;min-height:0!important}.attendance-report .printable-header .logo{width:24px!important;max-width:24px!important;max-height:24px!important}.attendance-report table{width:100%!important;border-collapse:collapse!important;table-layout:fixed!important;margin:0!important;break-before:auto!important;page-break-before:auto!important}.attendance-report thead{display:table-header-group!important}.attendance-report tr{break-inside:avoid!important;page-break-inside:avoid!important}.attendance-report th,.attendance-report td{font-size:4.9pt!important;line-height:1.02!important;padding:.6px!important;white-space:nowrap!important}.attendance-report th.employee-name,.attendance-report td.employee-name,.attendance-report th.job-title,.attendance-report td.job-title{white-space:normal!important;overflow-wrap:anywhere!important}@media print{.toolbar,.no-print{display:none!important}}</style>`; }
  function injectPrintFixInto(win) { if (!win || !win.document) return; const f=()=>{try{if(!win.document.getElementById('admin-offices-main-print-compact-fix')) win.document.head.insertAdjacentHTML('beforeend', printFixCss());}catch(_){}}; f(); setTimeout(f,80); setTimeout(f,300); setTimeout(f,900); }
  function patchPrintSelected() { if (typeof window.printSelected !== 'function') return false; if (window.printSelected.__adminOfficesCompactPrintWrappedV3) return true; const old=window.printSelected; window.printSelected=function(){ let w=null; const oo=window.open; window.open=function(){w=oo.apply(window,arguments);return w;}; try{return old.apply(this,arguments);} finally{window.open=oo;if(w)injectPrintFixInto(w);} }; window.printSelected.__adminOfficesCompactPrintWrappedV3=true; return true; }

  window.AdminOfficesBulkAttendance = { open: openBulkDialog, render: renderEmployees, selectVisible, save: saveRange };
  window.AdminOfficesBulkStatusGrid = window.AdminOfficesBulkAttendance;
  function patchBulkDialog() { injectCss(); window.openAdminOfficesBulkAttendanceDialog = openBulkDialog; if (window.AdminOfficesTools) { window.AdminOfficesTools.openAdminOfficesBulkAttendanceDialog = openBulkDialog; window.AdminOfficesTools.applyBulkAttendance = saveRange; } }
  function boot() { patchBulkDialog(); patchPrintSelected(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  let tries=0; const timer=setInterval(()=>{tries++; boot(); if(tries>=40) clearInterval(timer);},250);
  document.addEventListener('click',()=>{setTimeout(boot,80); setTimeout(boot,350);},true);
  console.info('[Admin Offices Bulk Attendance Clean Editor] installed v4 clean dialog');
})();
