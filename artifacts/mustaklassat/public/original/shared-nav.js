/**
 * shared-nav.js
 * الشريط العلوي القديم معطل.
 * تصحيحات آمنة لصفحة المكاتب الإدارية فقط:
 * 1) عزل تواقيع كل مكتب/مرفق.
 * 2) إضافة أزرار جدول الحضور.
 * 3) فرض مقارنة Excel قبل الحفظ: استبدال / تحديث / إلغاء.
 */
(function () {
  'use strict';

  function isAdminPage() { return /admin_offices_attendance\.html(?:$|[?#])/.test(location.href); }
  if (!isAdminPage()) return;

  function readJson(k, fb) { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : fb; } catch (_) { return fb; } }
  function getData() { try { return getAttendanceData(); } catch (_) { return readJson('adminOfficesAttendanceData_v1', {}); } }
  function saveData(d) { try { return saveAttendanceData(d); } catch (_) { localStorage.setItem('adminOfficesAttendanceData_v1', JSON.stringify(d)); } }
  function getNames() { try { if (typeof getCenterNames === 'function') return getCenterNames() || {}; } catch (_) {} return readJson('adminOfficeNames_v1', {}); }
  function getOfficeName(k) { return getNames()[k] || k || 'غير محدد'; }
  function periodDays() { try { const p = getExtractPeriodDetails(); return p.daysInExtract || p.daysInMonth || 30; } catch (_) { return 30; } }
  function daysArr() { return Array(periodDays()).fill('ح'); }
  function norm(v) { return String(v || '').replace(/\u200f|\u200e/g, '').replace(/[إأآا]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim().toLowerCase(); }
  function esc(v) { return String(v || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function renderAfterChange(centerKey) {
    try { if (typeof closeDialog === 'function') closeDialog('management-dialog'); } catch (_) {}
    try { if (typeof showCenterDetails === 'function' && document.getElementById('center-details-view')?.style.display !== 'none') showCenterDetails(centerKey); } catch (_) {}
    try { if (typeof renderCenterIcons === 'function') renderCenterIcons(); } catch (_) {}
    try { if (typeof calculateAndDisplayGrandTotal === 'function') calculateAndDisplayGrandTotal(); } catch (_) {}
  }

  /* توقيعات منفصلة لكل مكتب */
  function forceSignatureIsolation() {
    window.getSignatureKeyForContext = function(type, contextKey) {
      if (contextKey === 'grand_certificate') return type + '_grand_certificate';
      if (contextKey) return type + '_' + contextKey;
      return type + '_general_admin_offices_only';
    };
    window.getSignatureDialogTitle = function(type, contextKey) {
      if (contextKey === 'grand_certificate') return 'تواقيع الشهادة الإجمالية';
      if (contextKey) return 'تواقيع: ' + getOfficeName(contextKey);
      return 'تواقيع عامة للمكاتب';
    };
    window.__ADMIN_OFFICES_SIGNATURES_ISOLATED__ = true;
  }

  /* أزرار الجدول */
  function injectCss() {
    if (document.getElementById('admin-office-final-fixes-css')) return;
    const st = document.createElement('style');
    st.id = 'admin-office-final-fixes-css';
    st.textContent = `
      .admin-office-enhanced .table-responsive-wrapper,.admin-office-enhanced .dept-table-scroll{overflow-x:auto!important;width:100%!important;-webkit-overflow-scrolling:touch!important}
      .admin-office-enhanced table{min-width:1150px!important;transition:zoom .15s ease}
      .admin-office-table-btn{display:inline-flex!important;align-items:center!important;gap:6px!important;padding:7px 13px!important;border-radius:8px!important;border:1px solid #dbe4f0!important;background:#fff!important;color:#334155!important;font-family:Tajawal,Arial,sans-serif!important;font-size:12px!important;font-weight:700!important;cursor:pointer!important;margin:2px!important;box-shadow:0 1px 3px rgba(15,23,42,.08)!important}
      .admin-office-table-btn:hover{background:#f8fafc!important;border-color:#94a3b8!important}
      .admin-office-fullscreen-backdrop{position:fixed!important;inset:0!important;background:rgba(15,23,42,.55)!important;z-index:9996!important}
      .department-table.admin-office-fullscreen{position:fixed!important;inset:0!important;z-index:9997!important;background:#f8fafc!important;overflow:auto!important;margin:0!important;padding:0!important;width:100vw!important;height:100vh!important;border-radius:0!important;box-shadow:none!important}
      .department-table.admin-office-fullscreen .extract-details-v2,.department-table.admin-office-fullscreen .tab-action-buttons{position:sticky!important;top:0!important;z-index:10!important;background:#fff!important}
      .department-table.admin-office-fullscreen .table-responsive-wrapper,.department-table.admin-office-fullscreen .dept-table-scroll{padding:10px 14px 24px!important;overflow-x:auto!important}
      .department-table.admin-office-fullscreen table{zoom:1!important;min-width:1400px!important}
      .admin-import-compare{background:#fff;border:1.5px solid #dbeafe;border-radius:12px;padding:14px;margin-top:14px;text-align:right;box-shadow:0 2px 10px rgba(15,23,42,.06)}
      .admin-import-compare h4{margin:0 0 10px;color:#1e3c72;font-size:15px}.admin-import-compare table{width:100%;border-collapse:collapse;margin:10px 0;font-size:13px}.admin-import-compare th,.admin-import-compare td{border:1px solid #e5e7eb;padding:8px;text-align:center}.admin-import-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:12px}.admin-import-actions button{border:none;border-radius:9px;padding:10px 18px;font-weight:800;cursor:pointer}.admin-replace{background:#dc2626;color:#fff}.admin-update{background:#16a34a;color:#fff}.admin-cancel{background:#64748b;color:#fff}
      @media print{.admin-office-table-btn,.admin-office-fullscreen-backdrop{display:none!important}}
    `;
    document.head.appendChild(st);
  }
  function zoomKey(id) { return 'adminOfficeTableZoom_' + String(id || '').replace(/^table-/, ''); }
  window.adminOfficeZoomIn = function(id) { const t = document.getElementById(id); if (!t) return; let z = parseFloat(t.style.zoom || localStorage.getItem(zoomKey(id)) || '1'); z = Math.min(1.8, +(z + .1).toFixed(2)); t.style.zoom = z; localStorage.setItem(zoomKey(id), z); };
  window.adminOfficeZoomOut = function(id) { const t = document.getElementById(id); if (!t) return; let z = parseFloat(t.style.zoom || localStorage.getItem(zoomKey(id)) || '1'); z = Math.max(.6, +(z - .1).toFixed(2)); t.style.zoom = z; localStorage.setItem(zoomKey(id), z); };
  window.adminOfficeZoomReset = function(id) { const t = document.getElementById(id); if (!t) return; t.style.zoom = '1'; localStorage.setItem(zoomKey(id), '1'); };
  window.adminOfficeToggleFullscreen = function(id, btn) {
    const t = document.getElementById(id), sec = t?.closest('.department-table'); if (!sec) return;
    const active = !sec.classList.contains('admin-office-fullscreen');
    document.querySelectorAll('.department-table.admin-office-fullscreen').forEach(x => x.classList.remove('admin-office-fullscreen'));
    document.getElementById('admin-office-fullscreen-backdrop')?.remove();
    if (active) { const bg = document.createElement('div'); bg.id = 'admin-office-fullscreen-backdrop'; bg.className = 'admin-office-fullscreen-backdrop'; bg.onclick = () => window.adminOfficeToggleFullscreen(id, btn); document.body.appendChild(bg); sec.classList.add('admin-office-fullscreen'); document.body.style.overflow = 'hidden'; if (btn) btn.innerHTML = '<i class="fas fa-compress"></i> خروج'; }
    else { sec.classList.remove('admin-office-fullscreen'); document.body.style.overflow = ''; if (btn) btn.innerHTML = '<i class="fas fa-expand"></i> عرض كامل'; }
  };
  function enhanceOne(section) {
    if (!section || section.dataset.adminOfficeEnhanced === '1') return;
    const table = section.querySelector('table[id^="table-"]'); if (!table?.id) return;
    section.dataset.adminOfficeEnhanced = '1'; section.classList.add('admin-office-enhanced');
    const wrap = table.closest('.table-responsive-wrapper') || table.parentElement; if (wrap) wrap.classList.add('dept-table-scroll');
    const z = localStorage.getItem(zoomKey(table.id)); if (z) table.style.zoom = z;
    let bar = section.querySelector('.tab-action-buttons');
    if (!bar) { bar = document.createElement('div'); bar.className = 'tab-action-buttons no-print'; section.insertBefore(bar, section.firstChild); }
    if (!bar.querySelector('[data-admin-office-control="zoom-in"]')) {
      bar.insertAdjacentHTML('beforeend', `<button type="button" class="admin-office-table-btn" data-admin-office-control="zoom-in" onclick="adminOfficeZoomIn('${table.id}')"><i class="fas fa-search-plus"></i> تكبير</button><button type="button" class="admin-office-table-btn" onclick="adminOfficeZoomOut('${table.id}')"><i class="fas fa-search-minus"></i> تصغير</button><button type="button" class="admin-office-table-btn" onclick="adminOfficeZoomReset('${table.id}')"><i class="fas fa-compress-arrows-alt"></i> إعادة الحجم</button><button type="button" class="admin-office-table-btn" onclick="adminOfficeToggleFullscreen('${table.id}',this)"><i class="fas fa-expand"></i> عرض كامل</button>`);
    }
  }
  function enhanceTables() { injectCss(); document.querySelectorAll('[id^="table-div-"]').forEach(enhanceOne); }

  /* قراءة Excel ومقارنة إلزامية */
  function findHeaderRow(rows) {
    for (let i = 0; i < Math.min(15, rows.length); i++) {
      const r = rows[i].map(norm);
      const hasName = r.some(h => h.includes('اسم الموظف') || h.includes('اسم شاغل الوظيفه'));
      const hasJob = r.some(h => h.includes('مسمي الوظيفه') || h === 'الوظيفه' || h.includes('job'));
      if (hasName && hasJob) return i;
    }
    return -1;
  }
  function idx(headers, tests) { for (let i = 0; i < headers.length; i++) { const h = norm(headers[i]); if (tests.some(fn => fn(h))) return i; } return -1; }
  function num(v) { if (typeof v === 'number') return v || 0; return parseFloat(String(v || '').replace(/,/g, '').replace(/[ ريال﷼]/g, '').trim()) || 0; }
  function parseExcel(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'binary' });
          const employees = []; let skipped = 0;
          wb.SheetNames.forEach(sheet => {
            const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: '' });
            if (rows.length < 2) return;
            const hRow = findHeaderRow(rows); if (hRow < 0) return;
            const h = rows[hRow];
            const iName = idx(h, [x => x.includes('اسم الموظف'), x => x.includes('اسم شاغل الوظيفه')]);
            const iId = idx(h, [x => x.includes('الهويه'), x => x.includes('الاقامه'), x => x.includes('id'), x => x.includes('iqama')]);
            const iJob = idx(h, [x => x.includes('مسمي الوظيفه'), x => x === 'الوظيفه', x => x.includes('job')]);
            const iSalary = idx(h, [x => x.includes('التكلفه'), x => x.includes('راتب'), x => x.includes('salary')]);
            const iCat = idx(h, [x => x.includes('الفئه'), x => x.includes('فئه'), x => x.includes('cat')]);
            const iNat = idx(h, [x => x.includes('الجنسيه'), x => x.includes('جنسيه'), x => x.includes('nat')]);
            const iFine = idx(h, [x => x.includes('غرامه جنسيه')]);
            if (iName < 0 || iJob < 0) return;
            for (let r = hRow + 1; r < rows.length; r++) {
              const row = rows[r];
              const name = String(row[iName] || '').trim();
              const jobTitle = String(row[iJob] || '').trim();
              const iqamaId = iId >= 0 ? String(row[iId] || '').trim() : '';
              const salary = iSalary >= 0 ? num(row[iSalary]) : 0;
              if (!name && !jobTitle && !iqamaId && !salary) { skipped++; continue; }
              if (['اسم الموظف','اسم شاغل الوظيفة','مندوب المقاول','مدير المركز'].includes(name)) { skipped++; continue; }
              employees.push({ name, iqamaId, jobTitle: jobTitle || 'غير محدد', salary, category: iCat >= 0 ? String(row[iCat] || '1').trim() : '1', nationality: iNat >= 0 ? String(row[iNat] || '').trim() : '', nationalityFine: iFine >= 0 ? num(row[iFine]) : 0, days: daysArr() });
            }
          });
          employees._skipped = skipped;
          resolve(employees);
        } catch (err) { reject(new Error('فشل تحليل ملف Excel. تأكد من أن الملف غير تالف.')); }
      };
      reader.onerror = () => reject(new Error('فشلت قراءة الملف.'));
      reader.readAsBinaryString(file);
    });
  }
  function compareRows(current, incoming) {
    let duplicates = 0, newRows = 0;
    incoming.forEach(n => {
      const id = (n.iqamaId || '').trim(); const name = norm(n.name);
      const exists = current.some(c => (id && String(c.iqamaId || '').trim() === id) || (name && norm(c.name) === name));
      if (exists) duplicates++; else newRows++;
    });
    return { duplicates, newRows };
  }
  function showComparison(centerKey, incoming) {
    const current = getData()[centerKey] || [];
    const cmp = compareRows(current, incoming);
    window.__adminOfficePendingImport = { centerKey, employees: incoming, compare: cmp, skipped: incoming._skipped || 0 };
    const status = document.getElementById('import-status-area'); if (!status) return alert('تمت قراءة الملف. لم يتم العثور على منطقة عرض المقارنة.');
    status.innerHTML = `<div class="admin-import-compare"><h4><i class="fas fa-balance-scale"></i> مقارنة قبل الاستيراد</h4><div>المكتب/المرفق: <strong>${esc(getOfficeName(centerKey))}</strong></div><table><thead><tr><th>الموجود حاليًا</th><th>الموجود في الملف</th><th>جديد</th><th>مكرر</th><th>صفوف فارغة/متجاهلة</th></tr></thead><tbody><tr><td>${current.length}</td><td>${incoming.length}</td><td style="color:#16a34a;font-weight:800">${cmp.newRows}</td><td style="color:#d97706;font-weight:800">${cmp.duplicates}</td><td>${incoming._skipped || 0}</td></tr></tbody></table><div class="admin-import-actions"><button class="admin-replace" onclick="adminOfficeImportReplace()"><i class="fas fa-trash-alt"></i> امسح القديم وانزل الجديد</button><button class="admin-update" onclick="adminOfficeImportUpdate()"><i class="fas fa-sync-alt"></i> تحديث فقط</button><button class="admin-cancel" onclick="adminOfficeImportCancel()"><i class="fas fa-times"></i> إلغاء</button></div></div>`;
  }
  window.handleSingleFileImport = async function() {
    const centerKey = document.getElementById('center-select-import')?.value;
    const file = document.getElementById('excel-file-input')?.files?.[0];
    const status = document.getElementById('import-status-area');
    if (!centerKey) return alert('اختر المكتب/المرفق أولاً.');
    if (!file) return alert('اختر ملف Excel أولاً.');
    if (status) status.innerHTML = '<div class="admin-import-compare"><h4><i class="fas fa-spinner fa-spin"></i> جاري قراءة الملف...</h4></div>';
    try {
      const employees = await parseExcel(file);
      if (!employees.length) throw new Error('لم يتم العثور على صفوف موظفين صالحة. تأكد من الأعمدة: اسم الموظف، مسمى الوظيفة، التكلفة، الفئة، الجنسية.');
      showComparison(centerKey, employees);
    } catch (err) { if (status) status.innerHTML = `<div class="admin-import-compare" style="border-color:#fca5a5;background:#fef2f2"><h4 style="color:#dc2626">فشل الاستيراد</h4><div>${esc(err.message)}</div></div>`; else alert(err.message); }
  };
  window.adminOfficeImportReplace = function() {
    const p = window.__adminOfficePendingImport; if (!p) return alert('لا توجد عملية استيراد معلقة.');
    const all = getData(); all[p.centerKey] = p.employees; saveData(all); window.__adminOfficePendingImport = null; renderAfterChange(p.centerKey); alert('تم الاستبدال: تم تحميل ' + p.employees.length + ' صف.');
  };
  window.adminOfficeImportUpdate = function() {
    const p = window.__adminOfficePendingImport; if (!p) return alert('لا توجد عملية استيراد معلقة.');
    const all = getData(); if (!Array.isArray(all[p.centerKey])) all[p.centerKey] = [];
    let added = 0, dup = 0;
    p.employees.forEach(n => {
      const id = (n.iqamaId || '').trim(); const name = norm(n.name);
      const exists = all[p.centerKey].some(c => (id && String(c.iqamaId || '').trim() === id) || (name && norm(c.name) === name));
      if (exists) dup++; else { all[p.centerKey].push(n); added++; }
    });
    saveData(all); window.__adminOfficePendingImport = null; renderAfterChange(p.centerKey); alert('تم التحديث: أُضيف ' + added + ' صف، وتجاهل ' + dup + ' مكرر.');
  };
  window.adminOfficeImportCancel = function() {
    window.__adminOfficePendingImport = null;
    const status = document.getElementById('import-status-area'); if (status) status.innerHTML = '<div class="admin-import-compare">تم إلغاء الاستيراد. لم يتم تغيير البيانات.</div>';
  };
  window.runAdminOfficeNormalImport = function() {
    const src = document.getElementById('excel-file-input-normal'); const dst = document.getElementById('excel-file-input');
    if (!src || !src.files.length) return alert('اختر ملف Excel أولاً.');
    try { const dt = new DataTransfer(); dt.items.add(src.files[0]); dst.files = dt.files; } catch (_) { return alert('ارفع الملف في خانة التامبليت بالأعلى.'); }
    window.handleSingleFileImport();
  };

  function runAll() { forceSignatureIsolation(); enhanceTables(); }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { const sec = document.querySelector('.department-table.admin-office-fullscreen'); const t = sec?.querySelector('table[id^="table-"]'); if (t) window.adminOfficeToggleFullscreen(t.id); } });
  const oldShow = window.showCenterDetails;
  if (typeof oldShow === 'function') window.showCenterDetails = function() { const res = oldShow.apply(this, arguments); setTimeout(runAll, 50); setTimeout(runAll, 300); return res; };
  const oldSig = window.openSignatureDialog;
  if (typeof oldSig === 'function') window.openSignatureDialog = function(type, contextKey) { forceSignatureIsolation(); return oldSig.call(this, type, contextKey); };
  runAll();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', runAll); else setTimeout(runAll, 50);
  let tries = 0; const timer = setInterval(() => { runAll(); if (++tries >= 40) clearInterval(timer); }, 250);
  const mo = new MutationObserver(runAll); if (document.body) mo.observe(document.body, { childList: true, subtree: true });
})();
