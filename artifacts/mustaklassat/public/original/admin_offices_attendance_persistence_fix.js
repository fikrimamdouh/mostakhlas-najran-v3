// ===================================================================
// Admin Offices Attendance Persistence Fix — V1
// Scope: admin_offices_attendance.html / original-viewer?page=admin_offices_attendance.html
// - يمنع ضياع بيانات المكاتب بعد الريفريش بسبب overwrite فاضي/بلا أسماء.
// - يحفظ نسخة lastGood محلية من الحضور.
// - يجعل تحميل المناصب الكامل يحافظ على الأسماء والهويات إذا كانت موجودة في المصدر.
// - يضيف تنزيل تامبلت كامل لكل المكاتب بالأسماء الحالية.
// بدون MutationObserver وبدون تعديل DOM عام أثناء تحميل الصفحة.
// ===================================================================
(function () {
  'use strict';

  if (!/admin_offices_attendance\.html|original-viewer\?page=admin_offices_attendance\.html/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_ATTENDANCE_PERSISTENCE_FIX_V1__) return;
  window.__ADMIN_OFFICES_ATTENDANCE_PERSISTENCE_FIX_V1__ = true;

  var MAIN_KEY = 'adminOfficesAttendanceData_v1';
  var BACKUP_KEY = 'adminOfficesAttendanceData_v1_localBackup';
  var BACKUP_TS_KEY = 'adminOfficesAttendanceData_v1_localBackup_ts';
  var LAST_GOOD_KEY = 'adminOfficesAttendanceData_v1_lastGood';
  var LAST_GOOD_TS_KEY = 'adminOfficesAttendanceData_v1_lastGood_ts';
  var LEGACY_KEY = 'adminOfficesAttendanceData';
  var JOB_POS_DB_NAME = 'najranJobPositions';
  var JOB_POS_DB_VER = 1;
  var JOB_POS_STORE = 'positions';

  var DEFAULT_WORKSHOP_POSITIONS = [
    { jobTitle: 'مشرف موقع', salary: 0, category: '5', nationality: 'سعودي' },
    { jobTitle: 'فني ميكانيكا بنزين', salary: 0, category: '4', nationality: 'غير سعودي' },
    { jobTitle: 'فني ميكانيكا ديزل', salary: 0, category: '4', nationality: 'غير سعودي' },
    { jobTitle: 'فني تبريد وتكييف سيارات', salary: 0, category: '4', nationality: 'غير سعودي' },
    { jobTitle: 'فني كهربائي سيارات', salary: 0, category: '4', nationality: 'غير سعودي' },
    { jobTitle: 'فني سمكرة سيارات', salary: 0, category: '4', nationality: 'غير سعودي' },
    { jobTitle: 'دهان سيارات', salary: 0, category: '5', nationality: 'غير سعودي' },
    { jobTitle: 'فني ميزان سيارات', salary: 0, category: '4', nationality: 'غير سعودي' },
    { jobTitle: 'عامل زيت وبنشر', salary: 0, category: '6', nationality: 'غير سعودي' },
    { jobTitle: 'عامل غسيل وتشحيم', salary: 0, category: '6', nationality: 'غير سعودي' }
  ];

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }
  function setRaw(key, value) {
    try { Storage.prototype.setItem.call(localStorage, key, value); } catch (_) { try { localStorage.setItem(key, value); } catch (__) {} }
  }
  function setJson(key, value) {
    setRaw(key, JSON.stringify(value || {}));
  }
  function clean(v) {
    return String(v || '').replace(/[\u200f\u200e]/g, '').replace(/\s+/g, ' ').trim();
  }
  function esc(v) {
    return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function safeSheetName(v) {
    return clean(v).replace(/[\\/:*?"<>|]/g, '-').substring(0, 31) || 'مكتب';
  }
  function getNamesSafe() {
    try { if (typeof window.getCenterNames === 'function') return window.getCenterNames() || {}; } catch (_) {}
    return readJson('adminOfficeNames_v1', {});
  }
  function orderedOfficeKeys() {
    var names = getNamesSafe();
    return Object.keys(names).sort(function (a, b) {
      if (/^center_\d+$/.test(a) && /^center_\d+$/.test(b)) return parseInt(a.split('_')[1], 10) - parseInt(b.split('_')[1], 10);
      if (/^center_\d+$/.test(a)) return -1;
      if (/^center_\d+$/.test(b)) return 1;
      return String(a).localeCompare(String(b), 'ar');
    });
  }
  function countRows(data) {
    var total = 0;
    data = data || {};
    Object.keys(data).forEach(function (k) {
      if (Array.isArray(data[k])) total += data[k].length;
    });
    return total;
  }
  function countNamed(data) {
    var total = 0;
    data = data || {};
    Object.keys(data).forEach(function (k) {
      if (!Array.isArray(data[k])) return;
      data[k].forEach(function (emp) {
        if (clean(emp && (emp.name || emp.employeeName || emp.workerName || emp.empName))) total++;
      });
    });
    return total;
  }
  function score(data) {
    return { rows: countRows(data), named: countNamed(data) };
  }
  function parseAttendanceRaw(raw) {
    try { return raw ? JSON.parse(raw) : {}; } catch (_) { return {}; }
  }
  function getBestLocalData() {
    var candidates = [
      readJson(MAIN_KEY, {}),
      readJson(BACKUP_KEY, {}),
      readJson(LAST_GOOD_KEY, {}),
      readJson(LEGACY_KEY, {})
    ];
    return candidates.reduce(function (best, item) {
      var b = score(best), s = score(item);
      if (s.named > b.named) return item;
      if (s.named === b.named && s.rows > b.rows) return item;
      return best;
    }, {});
  }
  function mirrorAttendanceData(data, reason) {
    data = data || {};
    var raw = JSON.stringify(data);
    var s = score(data);
    setRaw(MAIN_KEY, raw);
    setRaw(BACKUP_KEY, raw);
    setRaw(LEGACY_KEY, raw);
    setRaw(BACKUP_TS_KEY, String(Date.now()));
    if (s.rows > 0) {
      setRaw(LAST_GOOD_KEY, raw);
      setRaw(LAST_GOOD_TS_KEY, String(Date.now()));
    }
    try { localStorage.setItem('najran_admin_offices_attendance_done', 'true'); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('adminOfficesAttendancePersisted', { detail: { reason: reason || '', rows: s.rows, named: s.named } })); } catch (_) {}
  }
  function restoreIfNeeded(reason) {
    var main = readJson(MAIN_KEY, {});
    var backup = readJson(BACKUP_KEY, {});
    var good = readJson(LAST_GOOD_KEY, {});
    var mainScore = score(main);
    var backupScore = score(backup);
    var goodScore = score(good);

    var candidate = null;
    if (mainScore.rows === 0 && goodScore.rows > 0) candidate = good;
    else if (mainScore.rows === 0 && backupScore.rows > 0) candidate = backup;
    else if (goodScore.named > 0 && mainScore.named === 0 && mainScore.rows > 0) candidate = good;

    if (candidate) {
      mirrorAttendanceData(candidate, reason || 'restore');
      try { if (typeof window.renderCenterIcons === 'function') window.renderCenterIcons(); } catch (_) {}
      try { if (typeof window.calculateAndDisplayGrandTotal === 'function') window.calculateAndDisplayGrandTotal(); } catch (_) {}
      console.warn('[Admin Offices Persistence] restored attendance data:', reason || 'restore', score(candidate));
      return true;
    }
    if (mainScore.rows > 0) mirrorAttendanceData(main, 'keep-current');
    return false;
  }

  function installSetItemProtection() {
    if (window.__ADMIN_OFFICES_ATTENDANCE_SETITEM_PROTECT__) return;
    window.__ADMIN_OFFICES_ATTENDANCE_SETITEM_PROTECT__ = true;
    var original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      try {
        if (this === localStorage && String(key) === MAIN_KEY) {
          var incoming = parseAttendanceRaw(value);
          var current = readJson(MAIN_KEY, {});
          var good = readJson(LAST_GOOD_KEY, {});
          var inScore = score(incoming);
          var curScore = score(current);
          var goodScore = score(good);

          if (goodScore.rows > 0 && inScore.rows === 0) {
            console.warn('[Admin Offices Persistence] blocked empty overwrite for attendance data');
            value = JSON.stringify(good);
          } else if (goodScore.named > 0 && inScore.rows > 0 && inScore.named === 0 && curScore.named > 0) {
            console.warn('[Admin Offices Persistence] blocked nameless overwrite for attendance data');
            value = JSON.stringify(good);
          } else if (inScore.rows > 0) {
            original.call(localStorage, BACKUP_KEY, JSON.stringify(incoming));
            original.call(localStorage, LEGACY_KEY, JSON.stringify(incoming));
            original.call(localStorage, BACKUP_TS_KEY, String(Date.now()));
            original.call(localStorage, LAST_GOOD_KEY, JSON.stringify(incoming));
            original.call(localStorage, LAST_GOOD_TS_KEY, String(Date.now()));
          }
        }
      } catch (_) {}
      return original.call(this, key, value);
    };
  }

  function patchSaveAttendanceData() {
    if (typeof window.saveAttendanceData !== 'function') return false;
    if (window.saveAttendanceData.__adminOfficesPersistenceWrapped) return true;
    var original = window.saveAttendanceData;
    window.saveAttendanceData = function (data) {
      var result = original.apply(this, arguments);
      try { mirrorAttendanceData(data || {}, 'saveAttendanceData'); } catch (_) {}
      return result;
    };
    window.saveAttendanceData.__adminOfficesPersistenceWrapped = true;
    return true;
  }
  function patchGetAttendanceData() {
    if (typeof window.getAttendanceData !== 'function') return false;
    if (window.getAttendanceData.__adminOfficesPersistenceWrapped) return true;
    var original = window.getAttendanceData;
    window.getAttendanceData = function () {
      restoreIfNeeded('before-getAttendanceData');
      var data = original.apply(this, arguments) || {};
      var best = getBestLocalData();
      var ds = score(data), bs = score(best);
      if (bs.named > ds.named || (bs.named === ds.named && bs.rows > ds.rows)) return best;
      return data;
    };
    window.getAttendanceData.__adminOfficesPersistenceWrapped = true;
    return true;
  }

  function jobPositionAuthHeaders() {
    var tok = null;
    try { tok = JSON.parse(localStorage.getItem('najran_session') || '{}').clerkToken || null; } catch (_) {}
    var h = { 'Content-Type': 'application/json' };
    if (tok) h.Authorization = 'Bearer ' + tok;
    return h;
  }
  function openJobPositionIDB() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(JOB_POS_DB_NAME, JOB_POS_DB_VER);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(JOB_POS_STORE)) db.createObjectStore(JOB_POS_STORE, { keyPath: 'hospitalName' });
      };
      req.onsuccess = function (e) { resolve(e.target.result); };
      req.onerror = function (e) { reject(e.target.error); };
    });
  }
  async function idbGetJobPositions(hospitalName) {
    try {
      var db = await openJobPositionIDB();
      return await new Promise(function (resolve, reject) {
        var req = db.transaction(JOB_POS_STORE, 'readonly').objectStore(JOB_POS_STORE).get(hospitalName);
        req.onsuccess = function (e) { resolve(e.target.result || null); };
        req.onerror = function (e) { reject(e.target.error); };
      });
    } catch (_) { return null; }
  }
  async function loadSavedJobPositions(officeName) {
    try {
      var resp = await fetch('/api/admin/job-positions?hospital=' + encodeURIComponent(officeName), { headers: jobPositionAuthHeaders(), credentials: 'include' });
      if (resp.ok) {
        var data = await resp.json();
        if (data && Array.isArray(data.rows) && data.rows.length) return data;
      }
    } catch (_) {}
    return await idbGetJobPositions(officeName);
  }
  function positionRowsForOffice(centerKey, officeName, rec) {
    if (rec && Array.isArray(rec.rows) && rec.rows.length) return rec.rows;
    if (centerKey === 'admin_staff' || String(officeName || '').includes('الورش')) return DEFAULT_WORKSHOP_POSITIONS;
    return [];
  }
  function daysCountSafe() {
    try {
      var p = typeof window.getExtractPeriodDetails === 'function' ? window.getExtractPeriodDetails() : {};
      return p.daysInExtract || p.daysInMonth || 30;
    } catch (_) { return 30; }
  }
  function employeeFromPosition(row) {
    row = row || {};
    return {
      name: clean(row.name || row.employeeName || row.workerName || row.empName || row.staffName || row['اسم الموظف'] || row['اسم شاغل الوظيفة']),
      jobTitle: clean(row.jobTitle || row.title || row.position || row['مسمى الوظيفة'] || row['الوظيفة']) || 'غير محدد',
      category: String(row.category || row.cat || row['الفئة'] || '1'),
      salary: parseFloat(row.salary || row.monthlyCost || row.cost || row['التكلفة الشهرية'] || row['الراتب'] || 0) || 0,
      nationality: clean(row.nationality || row['الجنسية']) || 'غير سعودي',
      iqamaId: clean(row.iqamaId || row.idNumber || row.identity || row.nationalId || row['رقم الهوية / الإقامة'] || row['الإقامة'] || row['الهوية']),
      nationalityFine: parseFloat(row.nationalityFine || row['غرامة جنسية'] || 0) || 0,
      days: Array(daysCountSafe()).fill('ح')
    };
  }

  async function loadPositionsIntoAllOfficesSafe() {
    var names = getNamesSafe();
    var keys = orderedOfficeKeys();
    var allData = getBestLocalData();
    var currentScore = score(allData);
    var ok = confirm(
      'سيتم تحميل المناصب لكل المكاتب والمرافق مع الحفاظ على الأسماء والهويات إن كانت محفوظة في مصدر المناصب.' +
      '\n\nعدد المكاتب/المرافق: ' + keys.length +
      (currentScore.rows ? '\nالبيانات الحالية: ' + currentScore.rows + ' صف / أسماء: ' + currentScore.named : '') +
      '\n\nموافق = تحميل واستبدال المناصب لكل المكاتب.\nإلغاء = عدم التغيير.'
    );
    if (!ok) return;

    var loadedOffices = 0;
    var loadedEmployees = 0;
    var namedEmployees = 0;
    var emptyOffices = 0;
    var failed = [];

    for (var i = 0; i < keys.length; i++) {
      var centerKey = keys[i];
      var officeName = names[centerKey] || centerKey;
      try {
        var rec = await loadSavedJobPositions(officeName);
        var rows = positionRowsForOffice(centerKey, officeName, rec);
        if (!rows.length) { emptyOffices++; failed.push(officeName); continue; }
        allData[centerKey] = rows.map(employeeFromPosition);
        loadedOffices++;
        loadedEmployees += allData[centerKey].length;
        namedEmployees += allData[centerKey].filter(function (x) { return clean(x.name); }).length;
      } catch (_) {
        failed.push(officeName);
      }
    }

    if (!loadedOffices) return alert('لم يتم تحميل أي مناصب. لا توجد مناصب محفوظة للمكاتب/المرافق.');

    mirrorAttendanceData(allData, 'load-all-positions-safe');
    try { if (typeof window.renderCenterIcons === 'function') window.renderCenterIcons(); } catch (_) {}
    try { if (typeof window.calculateAndDisplayGrandTotal === 'function') window.calculateAndDisplayGrandTotal(); } catch (_) {}
    try { if (typeof window.closeDialog === 'function') window.closeDialog('management-dialog'); } catch (_) {}

    alert(
      '✅ تم تحميل المناصب لكل المكاتب.' +
      '\nعدد المكاتب المحملة: ' + loadedOffices +
      '\nعدد الوظائف المحملة: ' + loadedEmployees +
      '\nعدد الأسماء المحفوظة: ' + namedEmployees +
      (emptyOffices ? '\nمكاتب بلا مناصب محفوظة: ' + emptyOffices : '')
    );
  }

  function downloadAllTemplatesWithNames() {
    if (!window.XLSX) return alert('مكتبة Excel غير محملة.');
    var names = getNamesSafe();
    var data = getBestLocalData();
    var keys = orderedOfficeKeys();
    var wb = XLSX.utils.book_new();
    var hasSheet = false;
    keys.forEach(function (key) {
      var officeName = names[key] || key;
      var rows = Array.isArray(data[key]) ? data[key] : [];
      var aoa = [
        ['اسم الموظف', 'رقم الهوية / الإقامة', 'مسمى الوظيفة', 'التكلفة الشهرية', 'الفئة', 'الجنسية', 'غرامة جنسية']
      ];
      rows.forEach(function (r) {
        aoa.push([
          r.name || '',
          r.iqamaId || r.idNumber || r.identity || r.nationalId || '',
          r.jobTitle || r.title || '',
          Number(r.salary || 0),
          r.category || '1',
          r.nationality || '',
          Number(r.nationalityFine || 0)
        ]);
      });
      var ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [{ wch: 30 }, { wch: 22 }, { wch: 34 }, { wch: 18 }, { wch: 8 }, { wch: 16 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, ws, safeSheetName(officeName));
      hasSheet = true;
    });
    if (!hasSheet) return alert('لا توجد مكاتب للتنزيل.');
    XLSX.writeFile(wb, 'تامبلت-المكاتب-كامل-بالأسماء.xlsx');
  }

  function patchPositionsDialog() {
    if (typeof window.confirmLoadAllAdminOfficePositions === 'function' && !window.confirmLoadAllAdminOfficePositions.__safeNamesFixed) {
      window.confirmLoadAllAdminOfficePositions = loadPositionsIntoAllOfficesSafe;
      window.confirmLoadAllAdminOfficePositions.__safeNamesFixed = true;
    }
    window.downloadAdminOfficesAllTemplateWithNames = downloadAllTemplatesWithNames;

    var originalOpen = window.loadAdminOfficePositionsFromTemplate;
    if (typeof originalOpen === 'function' && !originalOpen.__safeNamesFixed) {
      window.loadAdminOfficePositionsFromTemplate = function () {
        var result = originalOpen.apply(this, arguments);
        setTimeout(function () {
          var body = document.querySelector('#management-dialog .dialog-body') || document.querySelector('.dialog-body');
          if (!body || document.getElementById('download-admin-all-template-names-btn')) return;
          var row = document.createElement('div');
          row.style.cssText = 'display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:10px 0 16px;';
          row.innerHTML = '<button id="download-admin-all-template-names-btn" class="btn btn-secondary" type="button"><i class="fas fa-file-excel"></i> تنزيل تامبلت كامل بالأسماء</button>';
          body.insertBefore(row, body.firstChild && body.firstChild.nextSibling ? body.firstChild.nextSibling : body.firstChild);
          var btn = document.getElementById('download-admin-all-template-names-btn');
          if (btn) btn.onclick = downloadAllTemplatesWithNames;
        }, 80);
        return result;
      };
      window.loadAdminOfficePositionsFromTemplate.__safeNamesFixed = true;
    }
  }

  function mirrorLetterSettings() {
    var settings = localStorage.getItem('adminOfficesRaiseLettersSettings_v1');
    if (settings) {
      setRaw('adminOfficesRaiseLettersSettings_v1_backup', settings);
      setRaw('adminOfficesRaiseLettersSettings_v1_backup_ts', String(Date.now()));
    }
  }
  function patchLetterSave() {
    if (window.AdminOfficesRaiseLetters && typeof window.AdminOfficesRaiseLetters.saveDialog === 'function' && !window.AdminOfficesRaiseLetters.saveDialog.__settingsMirrorWrapped) {
      var original = window.AdminOfficesRaiseLetters.saveDialog;
      window.AdminOfficesRaiseLetters.saveDialog = function () {
        var result = original.apply(this, arguments);
        mirrorLetterSettings();
        return result;
      };
      window.AdminOfficesRaiseLetters.saveDialog.__settingsMirrorWrapped = true;
    }
  }

  function boot() {
    installSetItemProtection();
    restoreIfNeeded('boot');
    patchSaveAttendanceData();
    patchGetAttendanceData();
    patchPositionsDialog();
    patchLetterSave();
    mirrorLetterSettings();
  }

  boot();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  setTimeout(boot, 500);
  setTimeout(boot, 1200);
  setTimeout(boot, 2500);
  setTimeout(function () { restoreIfNeeded('late-check'); patchPositionsDialog(); patchLetterSave(); }, 4500);

  console.info('[Admin Offices Attendance Persistence] installed v1 names + refresh protection');
})();