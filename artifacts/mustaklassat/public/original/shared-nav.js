/**
 * shared-nav.js
 * تصحيحات آمنة لصفحة المكاتب الإدارية فقط:
 * 1) فصل تواقيع كل مكتب/مرفق.
 * 2) ضبط أزرار جدول الحضور بدون تكرار.
 * 3) التكبير/التصغير على جدول العمالة فقط.
 * 4) فتح جدول الحضور في نافذة مستقلة.
 * 5) مقارنة Excel قبل الحفظ: استبدال / تحديث / إلغاء.
 *
 * لا تنشئ صفحات جديدة.
 * لا تعدل admin_offices_attendance_patch.js.
 */
(function () {
  'use strict';

  function isAdminPage() {
    return /admin_offices_attendance\.html(?:$|[?#])/.test(location.href);
  }

  if (!isAdminPage()) return;

  function readJson(k, fb) {
    try {
      const r = localStorage.getItem(k);
      return r ? JSON.parse(r) : fb;
    } catch (_) {
      return fb;
    }
  }

  function getData() {
    try {
      return getAttendanceData();
    } catch (_) {
      return readJson('adminOfficesAttendanceData_v1', {});
    }
  }

  function saveData(d) {
    try {
      return saveAttendanceData(d);
    } catch (_) {
      localStorage.setItem('adminOfficesAttendanceData_v1', JSON.stringify(d));
    }
  }

  function getNames() {
    try {
      if (typeof getCenterNames === 'function') return getCenterNames() || {};
    } catch (_) {}
    return readJson('adminOfficeNames_v1', {});
  }

  function getOfficeName(k) {
    return getNames()[k] || k || 'غير محدد';
  }

  function periodDays() {
    try {
      const p = getExtractPeriodDetails();
      return p.daysInExtract || p.daysInMonth || 30;
    } catch (_) {
      return 30;
    }
  }

  function daysArr() {
    return Array(periodDays()).fill('ح');
  }

  function norm(v) {
    return String(v || '')
      .replace(/\u200f|\u200e/g, '')
      .replace(/[إأآا]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function esc(v) {
    return String(v || '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  function cleanContextKey(contextKey) {
    if (!contextKey) return '';

    return String(contextKey)
      .replace(/^attendance-signatures-/, '')
      .replace(/^perf-signatures-/, '')
      .replace(/^performance-signatures-/, '')
      .replace(/^ach-signatures-/, '')
      .replace(/^achievement-signatures-/, '')
      .replace(/^table-div-/, '')
      .replace(/^table-/, '')
      .trim();
  }

  function renderAfterChange(centerKey) {
    try {
      if (typeof closeDialog === 'function') closeDialog('management-dialog');
    } catch (_) {}

    try {
      if (
        typeof showCenterDetails === 'function' &&
        document.getElementById('center-details-view')?.style.display !== 'none'
      ) {
        showCenterDetails(centerKey);
      }
    } catch (_) {}

    try {
      if (typeof renderCenterIcons === 'function') renderCenterIcons();
    } catch (_) {}

    try {
      if (typeof calculateAndDisplayGrandTotal === 'function') calculateAndDisplayGrandTotal();
    } catch (_) {}
  }

  function forceSignatureIsolation() {
    window.getSignatureKeyForContext = function(type, contextKey) {
      const key = cleanContextKey(contextKey);

      if (key === 'grand_certificate') return type + '_grand_certificate';

      if (/^center_\d+$/.test(key) || key === 'admin_staff') {
        return type + '_' + key;
      }

      if (key) return type + '_' + key;

      return type + '_general_admin_offices_only';
    };

    window.getSignatureDialogTitle = function(type, contextKey) {
      const key = cleanContextKey(contextKey);

      if (key === 'grand_certificate') return 'تواقيع الشهادة الإجمالية';
      if (key) return 'تواقيع: ' + getOfficeName(key);

      return 'تواقيع عامة للمكاتب';
    };

    window.__ADMIN_OFFICES_SIGNATURES_ISOLATED__ = true;
  }

  function injectCss() {
    if (document.getElementById('admin-office-final-fixes-css')) return;

    const st = document.createElement('style');
    st.id = 'admin-office-final-fixes-css';
    st.textContent = `
      .admin-office-enhanced .table-responsive-wrapper,
      .admin-office-enhanced .dept-table-scroll {
        overflow-x:auto!important;
        width:100%!important;
        -webkit-overflow-scrolling:touch!important;
      }

      .admin-office-enhanced table {
        min-width:1150px!important;
        transition:zoom .15s ease;
        transform-origin:top right!important;
      }

      .admin-office-table-btn {
        display:inline-flex!important;
        align-items:center!important;
        gap:6px!important;
        padding:7px 13px!important;
        border-radius:8px!important;
        border:1px solid #dbe4f0!important;
        background:#fff!important;
        color:#334155!important;
        font-family:Tajawal,Arial,sans-serif!important;
        font-size:12px!important;
        font-weight:700!important;
        cursor:pointer!important;
        margin:2px!important;
        box-shadow:0 1px 3px rgba(15,23,42,.08)!important;
      }

      .admin-office-table-btn:hover {
        background:#f8fafc!important;
        border-color:#94a3b8!important;
      }

      .admin-import-compare {
        background:#fff;
        border:1.5px solid #dbeafe;
        border-radius:12px;
        padding:14px;
        margin-top:14px;
        text-align:right;
        box-shadow:0 2px 10px rgba(15,23,42,.06);
      }

      .admin-import-compare h4 {
        margin:0 0 10px;
        color:#1e3c72;
        font-size:15px;
      }

      .admin-import-compare table {
        width:100%;
        border-collapse:collapse;
        margin:10px 0;
        font-size:13px;
      }

      .admin-import-compare th,
      .admin-import-compare td {
        border:1px solid #e5e7eb;
        padding:8px;
        text-align:center;
      }

      .admin-import-actions {
        display:flex;
        gap:10px;
        justify-content:center;
        flex-wrap:wrap;
        margin-top:12px;
      }

      .admin-import-actions button {
        border:none;
        border-radius:9px;
        padding:10px 18px;
        font-weight:800;
        cursor:pointer;
      }

      .admin-replace { background:#dc2626;color:#fff; }
      .admin-update { background:#16a34a;color:#fff; }
      .admin-cancel { background:#64748b;color:#fff; }

      @media print {
        .admin-office-table-btn {
          display:none!important;
        }
      }
    `;

    document.head.appendChild(st);
  }

  function zoomKey(id) {
    return 'adminOfficeTableZoom_' + String(id || '').replace(/^table-/, '');
  }

  function setTableZoom(id, z) {
    const t = document.getElementById(id);
    if (!t) return;

    const next = Math.max(0.6, Math.min(1.8, Number(z) || 1));
    t.style.zoom = String(next);
    localStorage.setItem(zoomKey(id), String(next));
  }

  window.adminOfficeZoomIn = function(id) {
    const t = document.getElementById(id);
    if (!t) return;

    const current = parseFloat(t.style.zoom || localStorage.getItem(zoomKey(id)) || '1');
    setTableZoom(id, +(current + 0.1).toFixed(2));
  };

  window.adminOfficeZoomOut = function(id) {
    const t = document.getElementById(id);
    if (!t) return;

    const current = parseFloat(t.style.zoom || localStorage.getItem(zoomKey(id)) || '1');
    setTableZoom(id, +(current - 0.1).toFixed(2));
  };

  window.adminOfficeZoomReset = function(id) {
    setTableZoom(id, 1);
  };

  function cleanWindowClone(root) {
    root.querySelectorAll('.tab-action-buttons, .no-print').forEach(el => el.remove());

    root.querySelectorAll('select, input').forEach(el => {
      const span = document.createElement('span');
      span.className = el.className || '';
      span.style.cssText = el.style.cssText || '';
      span.textContent = el.tagName.toLowerCase() === 'select'
        ? (el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : el.value)
        : el.value;
      el.replaceWith(span);
    });
  }

  window.adminOfficeOpenAttendanceWindow = function(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return alert('لم يتم العثور على جدول الحضور.');

    const section = table.closest('[id^="table-div-"], .department-table') || table.parentElement;
    if (!section) return alert('لم يتم العثور على محتوى الجدول.');

    const clone = section.cloneNode(true);
    cleanWindowClone(clone);

    const contractInfo = document.querySelector('.page-contract-info-v2')?.outerHTML || '';
    const title = document.getElementById('center-main-title')?.outerHTML || '';

    const w = window.open('', '_blank', 'width=1400,height=900,scrollbars=yes,resizable=yes');
    if (!w) return alert('المتصفح منع فتح النافذة. اسمح بالـ popups لهذا الموقع.');

    w.document.open();
    w.document.write(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>الحضور والانصراف</title>
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
        <style>
          body { font-family:Tajawal,Arial,sans-serif; direction:rtl; padding:12px; background:#fff; }
          h1,h2,h3 { text-align:center; margin:6px 0; }
          .page-contract-info-v2 { font-size:9pt; border:1px solid #ddd; border-radius:8px; padding:6px; text-align:center; margin-bottom:8px; }
          table { width:100%; border-collapse:collapse; table-layout:auto; }
          th,td { border:1px solid #555; padding:4px; text-align:center; font-size:8pt; white-space:nowrap; }
          th { background:#003087; color:#fff; }
          .extract-details-v2 { background:#003087; color:#fff; padding:8px; border-radius:8px 8px 0 0; }
          .table-summary-v2 { display:flex; flex-wrap:wrap; gap:12px; justify-content:center; border:1px solid #ddd; padding:6px; font-weight:bold; }
          .signatures-grid,.signatures-display-section { display:flex; justify-content:space-around; border-top:1px solid #ccc; margin-top:18px; padding-top:12px; }
          .signature-block-display,.signature-item { min-width:150px; text-align:center; }
          .line { border-bottom:1px solid #000; min-height:24px; margin-top:24px; }
          .no-print,.tab-action-buttons { display:none!important; }
        </style>
      </head>
      <body>
        ${contractInfo}
        ${title}
        ${clone.outerHTML}
      </body>
      </html>
    `);
    w.document.close();
    w.focus();
  };

  function removeDuplicateControls(bar) {
    if (!bar) return;

    const seen = new Set();

    Array.from(bar.querySelectorAll('button')).forEach(btn => {
      const text = norm(btn.textContent);
      let key = '';

      if (text.includes('تكبير')) key = 'zoom-in';
      else if (text.includes('تصغير')) key = 'zoom-out';
      else if (text.includes('اعاده الحجم') || text.includes('إعاده الحجم') || text.includes('إعادة الحجم')) key = 'reset';
      else if (text.includes('عرض كامل') || text.includes('فتح في نافذه') || text.includes('فتح في نافذة') || text.includes('فتح الحضور')) key = 'open-window';
      else if (text.includes('تعديل التواقيع') || text.includes('تواقيع')) key = 'sig';
      else if (text.includes('طباعه الجدول') || text.includes('طباعة الجدول')) key = 'print';

      if (!key) return;

      if (seen.has(key)) btn.remove();
      else seen.add(key);
    });
  }

  function hasButton(bar, phrase) {
    return Array.from(bar.querySelectorAll('button')).some(btn => norm(btn.textContent).includes(norm(phrase)));
  }

  function enhanceOne(section) {
    if (!section) return;

    const table = section.querySelector('table[id^="table-"]');
    if (!table?.id) return;

    section.classList.add('admin-office-enhanced');

    const wrap = table.closest('.table-responsive-wrapper') || table.parentElement;
    if (wrap) wrap.classList.add('dept-table-scroll');

    const savedZoom = localStorage.getItem(zoomKey(table.id));
    if (savedZoom) table.style.zoom = savedZoom;

    let bar = section.querySelector('.tab-action-buttons');

    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'tab-action-buttons no-print';
      section.insertBefore(bar, section.firstChild);
    }

    removeDuplicateControls(bar);

    if (!hasButton(bar, 'تكبير')) {
      bar.insertAdjacentHTML('beforeend', `
        <button type="button" class="admin-office-table-btn" data-admin-office-control="zoom-in" onclick="adminOfficeZoomIn('${table.id}')">
          <i class="fas fa-search-plus"></i> تكبير
        </button>
      `);
    }

    if (!hasButton(bar, 'تصغير')) {
      bar.insertAdjacentHTML('beforeend', `
        <button type="button" class="admin-office-table-btn" data-admin-office-control="zoom-out" onclick="adminOfficeZoomOut('${table.id}')">
          <i class="fas fa-search-minus"></i> تصغير
        </button>
      `);
    }

    if (!hasButton(bar, 'إعادة الحجم') && !hasButton(bar, 'اعادة الحجم')) {
      bar.insertAdjacentHTML('beforeend', `
        <button type="button" class="admin-office-table-btn" data-admin-office-control="zoom-reset" onclick="adminOfficeZoomReset('${table.id}')">
          <i class="fas fa-compress-arrows-alt"></i> إعادة الحجم
        </button>
      `);
    }

    if (!hasButton(bar, 'فتح في نافذة') && !hasButton(bar, 'فتح الحضور')) {
      bar.insertAdjacentHTML('beforeend', `
        <button type="button" class="admin-office-table-btn" data-admin-office-control="open-window" onclick="adminOfficeOpenAttendanceWindow('${table.id}')">
          <i class="fas fa-external-link-alt"></i> فتح في نافذة
        </button>
      `);
    }

    removeDuplicateControls(bar);
  }

  function enhanceTables() {
    injectCss();
    document.querySelectorAll('[id^="table-div-"], .department-table').forEach(enhanceOne);
  }

  function findHeaderRow(rows) {
    for (let i = 0; i < Math.min(15, rows.length); i++) {
      const r = rows[i].map(norm);
      const hasName = r.some(h => h.includes('اسم الموظف') || h.includes('اسم شاغل الوظيفه'));
      const hasJob = r.some(h => h.includes('مسمي الوظيفه') || h === 'الوظيفه' || h.includes('job'));

      if (hasName && hasJob) return i;
    }

    return -1;
  }

  function idx(headers, tests) {
    for (let i = 0; i < headers.length; i++) {
      const h = norm(headers[i]);
      if (tests.some(fn => fn(h))) return i;
    }

    return -1;
  }

  function num(v) {
    if (typeof v === 'number') return v || 0;

    return parseFloat(
      String(v || '')
        .replace(/,/g, '')
        .replace(/[ ريال﷼]/g, '')
        .trim()
    ) || 0;
  }

  function parseExcel(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = e => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'binary' });
          const employees = [];
          let skipped = 0;

          wb.SheetNames.forEach(sheet => {
            const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: '' });
            if (rows.length < 2) return;

            const hRow = findHeaderRow(rows);
            if (hRow < 0) return;

            const h = rows[hRow];

            const iName = idx(h, [
              x => x.includes('اسم الموظف'),
              x => x.includes('اسم شاغل الوظيفه')
            ]);

            const iId = idx(h, [
              x => x.includes('الهويه'),
              x => x.includes('الاقامه'),
              x => x.includes('id'),
              x => x.includes('iqama')
            ]);

            const iJob = idx(h, [
              x => x.includes('مسمي الوظيفه'),
              x => x === 'الوظيفه',
              x => x.includes('job')
            ]);

            const iSalary = idx(h, [
              x => x.includes('التكلفه'),
              x => x.includes('راتب'),
              x => x.includes('salary')
            ]);

            const iCat = idx(h, [
              x => x.includes('الفئه'),
              x => x.includes('فئه'),
              x => x.includes('cat')
            ]);

            const iNat = idx(h, [
              x => x.includes('الجنسيه'),
              x => x.includes('جنسيه'),
              x => x.includes('nat')
            ]);

            const iFine = idx(h, [
              x => x.includes('غرامه جنسيه')
            ]);

            if (iName < 0 || iJob < 0) return;

            for (let r = hRow + 1; r < rows.length; r++) {
              const row = rows[r];

              const name = String(row[iName] || '').trim();
              const jobTitle = String(row[iJob] || '').trim();
              const iqamaId = iId >= 0 ? String(row[iId] || '').trim() : '';
              const salary = iSalary >= 0 ? num(row[iSalary]) : 0;

              if (!name && !jobTitle && !iqamaId && !salary) {
                skipped++;
                continue;
              }

              if (['اسم الموظف','اسم شاغل الوظيفة','مندوب المقاول','مدير المركز'].includes(name)) {
                skipped++;
                continue;
              }

              employees.push({
                name,
                iqamaId,
                jobTitle: jobTitle || 'غير محدد',
                salary,
                category: iCat >= 0 ? String(row[iCat] || '1').trim() : '1',
                nationality: iNat >= 0 ? String(row[iNat] || '').trim() : '',
                nationalityFine: iFine >= 0 ? num(row[iFine]) : 0,
                days: daysArr()
              });
            }
          });

          employees._skipped = skipped;
          resolve(employees);
        } catch (err) {
          reject(new Error('فشل تحليل ملف Excel. تأكد من أن الملف غير تالف.'));
        }
      };

      reader.onerror = () => reject(new Error('فشلت قراءة الملف.'));
      reader.readAsBinaryString(file);
    });
  }

  function compareRows(current, incoming) {
    let duplicates = 0;
    let newRows = 0;

    incoming.forEach(n => {
      const id = (n.iqamaId || '').trim();
      const name = norm(n.name);

      const exists = current.some(c =>
        (id && String(c.iqamaId || '').trim() === id) ||
        (name && norm(c.name) === name)
      );

      if (exists) duplicates++;
      else newRows++;
    });

    return { duplicates, newRows };
  }

  function showComparison(centerKey, incoming) {
    const current = getData()[centerKey] || [];
    const cmp = compareRows(current, incoming);

    window.__adminOfficePendingImport = {
      centerKey,
      employees: incoming,
      compare: cmp,
      skipped: incoming._skipped || 0
    };

    const status = document.getElementById('import-status-area');

    if (!status) {
      return alert('تمت قراءة الملف. لم يتم العثور على منطقة عرض المقارنة.');
    }

    status.innerHTML = `
      <div class="admin-import-compare">
        <h4><i class="fas fa-balance-scale"></i> مقارنة قبل الاستيراد</h4>
        <div>المكتب/المرفق: <strong>${esc(getOfficeName(centerKey))}</strong></div>

        <table>
          <thead>
            <tr>
              <th>الموجود حاليًا</th>
              <th>الموجود في الملف</th>
              <th>جديد</th>
              <th>مكرر</th>
              <th>صفوف فارغة/متجاهلة</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${current.length}</td>
              <td>${incoming.length}</td>
              <td style="color:#16a34a;font-weight:800">${cmp.newRows}</td>
              <td style="color:#d97706;font-weight:800">${cmp.duplicates}</td>
              <td>${incoming._skipped || 0}</td>
            </tr>
          </tbody>
        </table>

        <div class="admin-import-actions">
          <button class="admin-replace" onclick="adminOfficeImportReplace()">
            <i class="fas fa-trash-alt"></i> امسح القديم وانزل الجديد
          </button>
          <button class="admin-update" onclick="adminOfficeImportUpdate()">
            <i class="fas fa-sync-alt"></i> تحديث فقط
          </button>
          <button class="admin-cancel" onclick="adminOfficeImportCancel()">
            <i class="fas fa-times"></i> إلغاء
          </button>
        </div>
      </div>
    `;
  }

  window.handleSingleFileImport = async function() {
    const centerKey = document.getElementById('center-select-import')?.value;
    const file = document.getElementById('excel-file-input')?.files?.[0];
    const status = document.getElementById('import-status-area');

    if (!centerKey) return alert('اختر المكتب/المرفق أولاً.');
    if (!file) return alert('اختر ملف Excel أولاً.');

    if (status) {
      status.innerHTML = '<div class="admin-import-compare"><h4><i class="fas fa-spinner fa-spin"></i> جاري قراءة الملف...</h4></div>';
    }

    try {
      const employees = await parseExcel(file);

      if (!employees.length) {
        throw new Error('لم يتم العثور على صفوف موظفين صالحة. تأكد من الأعمدة: اسم الموظف، مسمى الوظيفة، التكلفة، الفئة، الجنسية.');
      }

      showComparison(centerKey, employees);
    } catch (err) {
      if (status) {
        status.innerHTML = `
          <div class="admin-import-compare" style="border-color:#fca5a5;background:#fef2f2">
            <h4 style="color:#dc2626">فشل الاستيراد</h4>
            <div>${esc(err.message)}</div>
          </div>
        `;
      } else {
        alert(err.message);
      }
    }
  };

  window.adminOfficeImportReplace = function() {
    const p = window.__adminOfficePendingImport;

    if (!p) return alert('لا توجد عملية استيراد معلقة.');

    const all = getData();
    all[p.centerKey] = p.employees;

    saveData(all);

    window.__adminOfficePendingImport = null;
    renderAfterChange(p.centerKey);

    alert('تم الاستبدال: تم تحميل ' + p.employees.length + ' صف.');
  };

  window.adminOfficeImportUpdate = function() {
    const p = window.__adminOfficePendingImport;

    if (!p) return alert('لا توجد عملية استيراد معلقة.');

    const all = getData();

    if (!Array.isArray(all[p.centerKey])) all[p.centerKey] = [];

    let added = 0;
    let dup = 0;

    p.employees.forEach(n => {
      const id = (n.iqamaId || '').trim();
      const name = norm(n.name);

      const exists = all[p.centerKey].some(c =>
        (id && String(c.iqamaId || '').trim() === id) ||
        (name && norm(c.name) === name)
      );

      if (exists) dup++;
      else {
        all[p.centerKey].push(n);
        added++;
      }
    });

    saveData(all);

    window.__adminOfficePendingImport = null;
    renderAfterChange(p.centerKey);

    alert('تم التحديث: أُضيف ' + added + ' صف، وتجاهل ' + dup + ' مكرر.');
  };

  window.adminOfficeImportCancel = function() {
    window.__adminOfficePendingImport = null;

    const status = document.getElementById('import-status-area');
    if (status) {
      status.innerHTML = '<div class="admin-import-compare">تم إلغاء الاستيراد. لم يتم تغيير البيانات.</div>';
    }
  };

  window.runAdminOfficeNormalImport = function() {
    const src = document.getElementById('excel-file-input-normal');
    const dst = document.getElementById('excel-file-input');

    if (!src || !src.files.length) {
      return alert('اختر ملف Excel أولاً.');
    }

    try {
      const dt = new DataTransfer();
      dt.items.add(src.files[0]);
      dst.files = dt.files;
    } catch (_) {
      return alert('ارفع الملف في خانة التامبليت بالأعلى.');
    }

    window.handleSingleFileImport();
  };

  function runAll() {
    forceSignatureIsolation();
    enhanceTables();
  }

  const oldShow = window.showCenterDetails;

  if (typeof oldShow === 'function') {
    window.showCenterDetails = function() {
      const res = oldShow.apply(this, arguments);
      setTimeout(runAll, 80);
      setTimeout(runAll, 300);
      return res;
    };
  }

  const oldOpenTab = window.openTab;

  if (typeof oldOpenTab === 'function') {
    window.openTab = function() {
      const res = oldOpenTab.apply(this, arguments);
      setTimeout(runAll, 80);
      return res;
    };
  }

  const oldSig = window.openSignatureDialog;

  if (typeof oldSig === 'function') {
    window.openSignatureDialog = function(type, contextKey) {
      forceSignatureIsolation();
      return oldSig.call(this, type, cleanContextKey(contextKey));
    };
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.dialog').forEach(d => {
        if (d.style.display !== 'none' && typeof closeDialog === 'function') {
          try { closeDialog(d.id); } catch (_) {}
        }
      });
    }
  });

  runAll();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runAll);
  } else {
    setTimeout(runAll, 100);
  }

  let tries = 0;
  const timer = setInterval(() => {
    runAll();
    tries++;
    if (tries >= 8) clearInterval(timer);
  }, 250);
})();
