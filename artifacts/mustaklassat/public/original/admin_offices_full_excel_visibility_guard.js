// ===================================================================
// Admin Offices Full Excel Visibility Guard — V3
// Scope: admin_offices_attendance.html
// يمنع ظهور "استيراد ملف شامل لكل الأقسام" خارج نافذة Excel النظيفة فقط.
// لا يغير منطق الاستيراد. ينظف الظهور الخاطئ ويمنع الحقن التلقائي القديم.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])|original-viewer\?page=admin_offices_attendance\.html/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_FULL_EXCEL_VISIBILITY_GUARD_V3__) return;
  window.__ADMIN_OFFICES_FULL_EXCEL_VISIBILITY_GUARD_V3__ = true;

  function clean(v) {
    return String(v || '').replace(/\s+/g, ' ').trim();
  }

  function removeNode(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function closestLeakedBlock(el) {
    if (!el) return null;
    return el.closest(
      '#admin-offices-full-excel-section,' +
      '.admin-offices-full-excel-section,' +
      '[data-admin-offices-full-excel],' +
      '.excel-clean-card,' +
      'fieldset,' +
      '.section-box,' +
      '.form-section,' +
      '.card'
    ) || el;
  }

  function managementDialog() {
    return document.getElementById('management-dialog');
  }

  function isVisible(el) {
    if (!el) return false;
    var style = window.getComputedStyle ? getComputedStyle(el) : null;
    return !!(!style || (style.display !== 'none' && style.visibility !== 'hidden'));
  }

  function isCleanExcelDialog() {
    var dlg = managementDialog();
    if (!dlg || !isVisible(dlg)) return false;
    return dlg.classList.contains('admin-excel-clean-dialog') || !!dlg.querySelector('.excel-clean-wrap');
  }

  function removeLeakedBlocks() {
    document.querySelectorAll('#admin-offices-full-excel-section, .admin-offices-full-excel-section, [data-admin-offices-full-excel]').forEach(removeNode);

    if (!isCleanExcelDialog()) {
      document.querySelectorAll('#admin-offices-full-excel-input').forEach(function (input) {
        removeNode(closestLeakedBlock(input));
      });
    }

    Array.prototype.slice.call(document.querySelectorAll('body div, body section, body fieldset')).forEach(function (el) {
      if (el.id === 'management-dialog' || el.classList.contains('excel-clean-wrap')) return;
      var text = clean(el.textContent);
      if (text.indexOf('استيراد ملف شامل لكل الأقسام') > -1 && !isCleanExcelDialog()) {
        removeNode(closestLeakedBlock(el));
      }
    });
  }

  function wrapPublicApi() {
    var api = window.AdminOfficesFullExcelImport;
    if (!api || api.__excelGuardNoAutoInjectV3) return false;
    if (typeof api.inject === 'function') {
      api.inject = function excelAutoInjectDisabled() {
        removeLeakedBlocks();
        return false;
      };
    }
    api.__excelGuardNoAutoInjectV3 = true;
    return true;
  }

  function guard() {
    wrapPublicApi();
    removeLeakedBlocks();
  }

  function scheduleGuard() {
    setTimeout(guard, 0);
    setTimeout(guard, 30);
    setTimeout(guard, 90);
    setTimeout(guard, 170);
    setTimeout(guard, 360);
    setTimeout(guard, 800);
    setTimeout(guard, 1400);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', guard);
  else guard();

  document.addEventListener('click', scheduleGuard, true);
  document.addEventListener('input', scheduleGuard, true);
  document.addEventListener('change', scheduleGuard, true);

  var mo = new MutationObserver(function () { scheduleGuard(); });
  try { mo.observe(document.documentElement, { childList: true, subtree: true }); } catch (_) {}

  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    guard();
    if (tries > 160) clearInterval(timer);
  }, 120);

  window.AdminOfficesFullExcelVisibilityGuard = { clean: guard, isCleanExcelDialog: isCleanExcelDialog };
  console.info('[Admin Offices Full Excel Visibility Guard] installed v3 force cleanup');
})();

// ===================================================================
// Admin Offices Positions Update Guard — V1
// Scope: admin_offices_attendance.html
// يجعل تحميل المناصب ينزل الاسم والهوية والجنسية والراتب وكل الحقول المتاحة.
// عند التحميل مرة ثانية يعرض رسالة واضحة ويسمح بتحديث كل الأقسام بدون تكرار.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])|original-viewer\?page=admin_offices_attendance\.html/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_POSITIONS_UPDATE_GUARD_V1__) return;
  window.__ADMIN_OFFICES_POSITIONS_UPDATE_GUARD_V1__ = true;

  var SETUP_KEY = 'adminOfficesPositionsSetup_v1';
  var DB_NAME = 'najranJobPositions';
  var DB_VER = 1;
  var STORE = 'positions';
  var WORKSHOP_LABEL = 'الورش (صيانة وإصلاح السيارات)';
  var DEFAULT_WORKSHOP_POSITIONS = [
    { jobTitle: 'مشرف موقع', category: '5', salary: 0, nationality: 'سعودي' },
    { jobTitle: 'فني ميكانيكا بنزين', category: '4', salary: 0, nationality: 'غير سعودي' },
    { jobTitle: 'فني ميكانيكا ديزل', category: '4', salary: 0, nationality: 'غير سعودي' },
    { jobTitle: 'فني تبريد وتكييف سيارات', category: '4', salary: 0, nationality: 'غير سعودي' },
    { jobTitle: 'فني كهربائي سيارات', category: '4', salary: 0, nationality: 'غير سعودي' },
    { jobTitle: 'فني سمكرة سيارات', category: '4', salary: 0, nationality: 'غير سعودي' },
    { jobTitle: 'دهان سيارات', category: '5', salary: 0, nationality: 'غير سعودي' },
    { jobTitle: 'فني ميزان سيارات', category: '4', salary: 0, nationality: 'غير سعودي' },
    { jobTitle: 'عامل زيت وبنشر', category: '6', salary: 0, nationality: 'غير سعودي' },
    { jobTitle: 'عامل غسيل وتشحيم', category: '6', salary: 0, nationality: 'غير سعودي' }
  ];

  function readJson(key, fallback) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function clean(v) {
    return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  }

  function first() {
    for (var i = 0; i < arguments.length; i++) {
      var v = clean(arguments[i]);
      if (v && v !== 'undefined' && v !== 'null' && v !== 'غير محدد' && v !== '-') return v;
    }
    return '';
  }

  function num(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    return parseFloat(String(v || '').replace(/,/g, '').replace(/[ ريال﷼]/g, '').trim()) || 0;
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
    try { if (typeof window.saveAttendanceData === 'function') return window.saveAttendanceData(data); } catch (_) {}
    writeJson('adminOfficesAttendanceData_v1', data || {});
  }

  function daysCount() {
    try {
      if (typeof window.getExtractPeriodDetails === 'function') {
        var p = window.getExtractPeriodDetails() || {};
        return p.daysInExtract || p.daysInMonth || 30;
      }
    } catch (_) {}
    return 30;
  }

  function orderedKeys() {
    var names = getNames();
    return Object.keys(names || {}).sort(function (a, b) {
      if (a.indexOf('center_') === 0 && b.indexOf('center_') === 0) return (parseInt(a.split('_')[1], 10) || 0) - (parseInt(b.split('_')[1], 10) || 0);
      if (a.indexOf('center_') === 0) return -1;
      if (b.indexOf('center_') === 0) return 1;
      return String(names[a] || a).localeCompare(String(names[b] || b), 'ar');
    });
  }

  function status() {
    return readJson(SETUP_KEY, { done: false, loadedAt: '', loadedBy: '', officesCount: 0, employeesCount: 0 });
  }

  function saveStatus(payload) {
    var session = readJson('najran_session', {});
    writeJson(SETUP_KEY, Object.assign({
      done: true,
      mode: 'all',
      loadedAt: new Date().toISOString(),
      loadedBy: session.name || session.email || '',
      hospital: session.hospital || '',
      officesCount: 0,
      employeesCount: 0
    }, payload || {}));
  }

  function headers() {
    var session = readJson('najran_session', {});
    var h = { 'Content-Type': 'application/json' };
    if (session.clerkToken) h.Authorization = 'Bearer ' + session.clerkToken;
    return h;
  }

  function openDb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'hospitalName' });
      };
      req.onsuccess = function (e) { resolve(e.target.result); };
      req.onerror = function (e) { reject(e.target.error); };
    });
  }

  async function idbGet(hospitalName) {
    try {
      var db = await openDb();
      return await new Promise(function (resolve, reject) {
        var req = db.transaction(STORE, 'readonly').objectStore(STORE).get(hospitalName);
        req.onsuccess = function (e) { resolve(e.target.result || null); };
        req.onerror = function (e) { reject(e.target.error); };
      });
    } catch (_) {
      return null;
    }
  }

  async function loadSaved(hospitalName) {
    try {
      var resp = await fetch('/api/admin/job-positions?hospital=' + encodeURIComponent(hospitalName), { headers: headers(), credentials: 'include' });
      if (resp.ok) {
        var data = await resp.json();
        if (data && Array.isArray(data.rows) && data.rows.length) return data;
      }
    } catch (_) {}
    return await idbGet(hospitalName);
  }

  function rowsFor(centerKey, officeName, rec) {
    if (rec && Array.isArray(rec.rows) && rec.rows.length) return rec.rows;
    if (centerKey === 'admin_staff' || String(officeName || '').indexOf('الورش') > -1) return DEFAULT_WORKSHOP_POSITIONS;
    return [];
  }

  function employeeFrom(row, oldEmp) {
    row = row || {};
    oldEmp = oldEmp || {};
    var days = Array.isArray(oldEmp.days) ? oldEmp.days : (Array.isArray(row.days) ? row.days : Array(daysCount()).fill('ح'));
    return {
      name: first(row.name, row.employeeName, row.empName, row.workerName, row.fullName, row.personName, row['اسم الموظف'], row['اسم شاغل الوظيفة'], row['اسم شاغل الوظيفه'], oldEmp.name),
      jobTitle: first(row.jobTitle, row.title, row.position, row.job, row.jobName, row['مسمى الوظيفة'], row['مسمي الوظيفة'], row['الوظيفة'], oldEmp.jobTitle),
      category: first(row.category, row.cat, row.level, row['الفئة'], row['فئه'], oldEmp.category, '1'),
      salary: num(first(row.salary, row.monthlySalary, row.cost, row.monthlyCost, row.totalCost, row['الراتب'], row['التكلفة'], row['التكلفه'], oldEmp.salary, 0)),
      nationality: first(row.nationality, row.nationalityName, row['الجنسية'], row['جنسيه'], oldEmp.nationality, 'غير سعودي'),
      iqamaId: first(row.iqamaId, row.iqama, row.nationalId, row.idNumber, row.identity, row.id, row['رقم الهوية'], row['رقم الهويه'], row['الإقامة'], row['الاقامة'], row['الهوية'], row['الهويه'], oldEmp.iqamaId),
      nationalityFine: num(first(row.nationalityFine, row.fine, row.nationalityPenalty, row['غرامة جنسية'], row['غرامه جنسيه'], oldEmp.nationalityFine, 0)),
      days: days
    };
  }

  function keyOf(emp) {
    var id = clean(emp && emp.iqamaId);
    if (id) return 'id:' + id;
    return 'nj:' + clean(emp && emp.name) + '|' + clean(emp && emp.jobTitle);
  }

  function mergeEmployees(oldRows, newRows) {
    oldRows = Array.isArray(oldRows) ? oldRows : [];
    var oldMap = {};
    oldRows.forEach(function (emp) { oldMap[keyOf(emp)] = emp; });
    var used = {};
    var out = newRows.map(function (row) {
      var temp = employeeFrom(row, {});
      var old = oldMap[keyOf(temp)] || null;
      if (old) used[keyOf(old)] = true;
      return employeeFrom(row, old || {});
    });
    oldRows.forEach(function (emp) {
      if (!used[keyOf(emp)]) out.push(emp);
    });
    return out;
  }

  function rerender(centerKey) {
    try { if (typeof window.renderCenterIcons === 'function') window.renderCenterIcons(); } catch (_) {}
    try { if (typeof window.renderMainGrid === 'function') window.renderMainGrid(); } catch (_) {}
    try { if (typeof window.calculateAndDisplayGrandTotal === 'function') window.calculateAndDisplayGrandTotal(); } catch (_) {}
    try { if (typeof window.displayEmployeesForCenter === 'function' && centerKey && window.activeCenterKeyForManagement === centerKey) window.displayEmployeesForCenter(centerKey); } catch (_) {}
  }

  async function loadOne(centerKey, mode) {
    var names = getNames();
    var officeName = names[centerKey] || centerKey;
    var rec = await loadSaved(officeName);
    var rows = rowsFor(centerKey, officeName, rec);
    if (!rows.length) return alert('لا توجد مناصب محفوظة لـ "' + officeName + '".');

    var all = getData();
    var oldRows = Array.isArray(all[centerKey]) ? all[centerKey] : [];
    var msg = 'وُجدت ' + rows.length + ' سجل منصب/موظف لـ "' + officeName + '".';
    if (oldRows.length) msg += '\n\nتوجد بيانات حالية بعدد ' + oldRows.length + '.\nموافق = تحديث/استبدال المكتب المحدد مع الحفاظ على أيام الحضور للموظفين المطابقين.';
    else msg += '\n\nهل تريد تحميلها؟';
    if (!confirm(msg)) return;

    all[centerKey] = mode === 'update' || oldRows.length ? mergeEmployees(oldRows, rows) : rows.map(function (r) { return employeeFrom(r, {}); });
    saveData(all);
    rerender(centerKey);
    alert('✅ تم تحميل/تحديث ' + all[centerKey].length + ' سجل في "' + officeName + '".');
    try { if (typeof window.closeDialog === 'function') window.closeDialog('management-dialog'); } catch (_) {}
  }

  async function loadAll(mode) {
    var st = status();
    var names = getNames();
    var keys = orderedKeys();
    var all = getData();
    var currentCount = Object.values(all || {}).reduce(function (sum, rows) { return sum + (Array.isArray(rows) ? rows.length : 0); }, 0);

    var msg;
    if (st.done) {
      var loadedAt = st.loadedAt ? new Date(st.loadedAt).toLocaleString('ar-SA') : 'غير محدد';
      msg = 'تم تحميل المناصب سابقًا.' +
        '\n\nتاريخ التحميل: ' + loadedAt +
        (st.loadedBy ? '\nبواسطة: ' + st.loadedBy : '') +
        '\nعدد الأقسام السابق: ' + (st.officesCount || 0) +
        '\nعدد السجلات السابق: ' + (st.employeesCount || 0) +
        '\n\nموافق = تحديث كل الأقسام من ملف المناصب المحفوظ، بدون تكرار، مع الحفاظ على أيام الحضور للموظفين المطابقين.' +
        '\nإلغاء = عدم تنفيذ أي شيء.';
      if (!confirm(msg)) return;
      mode = 'update';
    } else {
      msg = 'سيتم تحميل المناصب لكل المكاتب والمرافق دفعة واحدة.' +
        '\n\nعدد المكاتب/المرافق: ' + keys.length +
        (currentCount ? '\n\nتحذير: توجد بيانات حالية بعدد ' + currentCount + '. سيتم تحديثها بدون تكرار وحفظ أيام الحضور للموظفين المطابقين.' : '') +
        '\n\nهل تريد المتابعة؟';
      if (!confirm(msg)) return;
      mode = currentCount ? 'update' : 'replace';
    }

    var loadedOffices = 0;
    var loadedEmployees = 0;
    var emptyOffices = 0;
    var failed = [];

    for (var i = 0; i < keys.length; i++) {
      var centerKey = keys[i];
      var officeName = names[centerKey] || centerKey;
      try {
        var rec = await loadSaved(officeName);
        var rows = rowsFor(centerKey, officeName, rec);
        if (!rows.length) {
          emptyOffices++;
          failed.push(officeName);
          continue;
        }
        var oldRows = Array.isArray(all[centerKey]) ? all[centerKey] : [];
        all[centerKey] = mode === 'update' ? mergeEmployees(oldRows, rows) : rows.map(function (r) { return employeeFrom(r, {}); });
        loadedOffices++;
        loadedEmployees += all[centerKey].length;
      } catch (err) {
        failed.push(officeName);
      }
    }

    if (!loadedOffices) return alert('لم يتم تحميل أي مناصب. لا توجد مناصب محفوظة للمكاتب/المرافق.');

    saveData(all);
    saveStatus({ mode: mode, officesCount: loadedOffices, employeesCount: loadedEmployees, emptyOffices: emptyOffices, failedOffices: failed });
    rerender();
    try { if (typeof window.closeDialog === 'function') window.closeDialog('management-dialog'); } catch (_) {}
    alert('✅ تم ' + (mode === 'update' ? 'تحديث' : 'تحميل') + ' المناصب لكل الأقسام.' +
      '\n\nعدد الأقسام: ' + loadedOffices +
      '\nعدد السجلات الحالية بعد العملية: ' + loadedEmployees +
      (emptyOffices ? '\nأقسام بلا مناصب محفوظة: ' + emptyOffices : '') +
      '\n\nتم حفظ حالة التحميل. عند الضغط مرة أخرى ستظهر رسالة التحديث أولًا.');
  }

  function currentCenter() {
    try {
      var active = document.querySelector('.tab-link.active[data-center-key]');
      if (active && active.dataset.centerKey) return active.dataset.centerKey;
      var title = document.getElementById('center-main-title') && document.getElementById('center-main-title').textContent || '';
      var names = getNames();
      var found = Object.entries(names).find(function (x) { return title.indexOf(x[1]) > -1; });
      if (found) return found[0];
    } catch (_) {}
    return orderedKeys()[0] || '';
  }

  function renderPositionsDialog() {
    var names = getNames();
    var keys = orderedKeys();
    var st = status();
    var current = currentCenter();
    var loadedAt = st.loadedAt ? new Date(st.loadedAt).toLocaleString('ar-SA') : '';
    var statusHtml = st.done
      ? '<div style="background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:10px;padding:10px;margin-bottom:12px;font-size:.9rem;font-weight:800;line-height:1.8">تم تحميل المناصب سابقًا.' + (loadedAt ? '<br>تاريخ التحميل: ' + loadedAt : '') + '<br>عند الضغط على تحديث كل الأقسام سيتم التحديث بدون تكرار مع الحفاظ على أيام الحضور للموظفين المطابقين.</div>'
      : '<div style="background:#ecfdf5;border:1px solid #bbf7d0;color:#166534;border-radius:10px;padding:10px;margin-bottom:12px;font-size:.9rem;font-weight:800">سيتم تحميل الاسم والهوية والجنسية والراتب والفئة وكل البيانات المتاحة من سجل المناصب.</div>';

    var content = '<div class="dialog-header"><h3><i class="fas fa-clipboard-list"></i> تحميل / تحديث المناصب</h3><span class="close" onclick="closeDialog(\'management-dialog\')">×</span></div>' +
      '<div class="dialog-body">' + statusHtml +
      '<p class="info-text">التحميل الكامل يستخدم مصدر المناصب المحفوظ لكل مكتب. التحديث لا يكرر الموظفين ويحافظ على أيام الحضور عند وجود نفس الهوية أو نفس الاسم والوظيفة.</p>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">' +
      '<button class="btn btn-success" onclick="window.confirmLoadAllAdminOfficePositions()"><i class="fas fa-layer-group"></i> ' + (st.done ? 'تحديث كل الأقسام' : 'تحميل المناصب لكل الأقسام') + '</button>' +
      '</div><hr style="margin:14px 0">' +
      '<div class="form-group"><label for="admin-office-load-center">تحميل / تحديث مكتب محدد:</label><select id="admin-office-load-center">' + keys.map(function (k) { return '<option value="' + k + '" ' + (k === current ? 'selected' : '') + '>' + (names[k] || k) + '</option>'; }).join('') + '</select></div>' +
      '</div><div class="dialog-footer"><button class="btn btn-secondary" onclick="closeDialog(\'management-dialog\')">إلغاء</button><button class="btn btn-success" onclick="window.confirmLoadAdminOfficePositions()"><i class="fas fa-check"></i> تحميل / تحديث المكتب المحدد</button></div>';

    if (typeof window.openDialog === 'function') window.openDialog(content, 'management-dialog', false);
    else alert('نظام النوافذ غير جاهز. أعد تحميل الصفحة.');
  }

  function install() {
    window.loadAdminOfficePositionsFromTemplate = renderPositionsDialog;
    window.confirmLoadAllAdminOfficePositions = function () { loadAll('replace'); };
    window.confirmLoadAdminOfficePositions = function () {
      var centerKey = document.getElementById('admin-office-load-center') && document.getElementById('admin-office-load-center').value;
      if (!centerKey) return alert('اختر المكتب/المرفق أولاً.');
      return loadOne(centerKey, 'update');
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  setTimeout(install, 300);
  setTimeout(install, 900);
  setTimeout(install, 1800);

  console.info('[Admin Offices Positions Update Guard] installed v1 full employee fields + safe reload');
})();