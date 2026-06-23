// ===================================================================
// Admin Offices Attendance Persistence Fix — V2
// Scope: admin_offices_attendance.html / original-viewer?page=admin_offices_attendance.html
// حل مباشر لمشكلة: تحميل العمالة ثم Refresh يرجع الصفحة بدون بيانات.
// القاعدة: أي بيانات عمالة صالحة يتم حفظها في مفاتيح عادية + نسخة آمنة لا تحتوي كلمة attendance حتى لا تمسحها حراسة السياق.
// بدون MutationObserver وبدون تعديل جداول أثناء التحميل.
// ===================================================================
(function () {
  'use strict';

  if (!/admin_offices_attendance\.html|original-viewer\?page=admin_offices_attendance\.html/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_ATTENDANCE_PERSISTENCE_FIX_V2__) return;
  window.__ADMIN_OFFICES_ATTENDANCE_PERSISTENCE_FIX_V2__ = true;

  var MAIN_KEY = 'adminOfficesAttendanceData_v1';
  var BACKUP_KEY = 'adminOfficesAttendanceData_v1_localBackup';
  var BACKUP_TS_KEY = 'adminOfficesAttendanceData_v1_localBackup_ts';
  var LAST_GOOD_KEY = 'adminOfficesAttendanceData_v1_lastGood';
  var LAST_GOOD_TS_KEY = 'adminOfficesAttendanceData_v1_lastGood_ts';
  var LEGACY_KEY = 'adminOfficesAttendanceData';

  // لا تحتوي attendance حتى لا يمسحها forceReview/تنظيف السياق العام.
  var SAFE_DATA_KEY = 'adminOfficesLaborDataSafe_v2';
  var SAFE_DATA_TS_KEY = 'adminOfficesLaborDataSafe_v2_ts';
  var SAFE_NAMES_KEY = 'adminOfficesLaborNamesSafe_v2';
  var SAFE_AFF_KEY = 'adminOfficesLaborAffiliationsSafe_v2';

  var NAMES_KEY = 'adminOfficeNames_v1';
  var AFF_KEY = 'adminOfficeAffiliations_v1';

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value || {})); } catch (_) {}
  }

  function clean(v) {
    return String(v || '').replace(/[\u200f\u200e]/g, '').replace(/\s+/g, ' ').trim();
  }

  function sessionIsReviewOnly() {
    try {
      var s = JSON.parse(localStorage.getItem('najran_session') || '{}');
      return s && s.reviewOnly === true;
    } catch (_) {
      return false;
    }
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

  function bestData() {
    var candidates = [
      readJson(MAIN_KEY, {}),
      readJson(BACKUP_KEY, {}),
      readJson(LAST_GOOD_KEY, {}),
      readJson(LEGACY_KEY, {}),
      readJson(SAFE_DATA_KEY, {})
    ];
    return candidates.reduce(function (best, item) {
      var b = score(best);
      var s = score(item);
      if (s.named > b.named) return item;
      if (s.named === b.named && s.rows > b.rows) return item;
      return best;
    }, {});
  }

  function mirrorData(data, reason) {
    if (!data || typeof data !== 'object') return false;
    var s = score(data);
    if (s.rows <= 0) return false;
    var raw = JSON.stringify(data);
    try {
      localStorage.setItem(MAIN_KEY, raw);
      localStorage.setItem(BACKUP_KEY, raw);
      localStorage.setItem(LEGACY_KEY, raw);
      localStorage.setItem(LAST_GOOD_KEY, raw);
      localStorage.setItem(SAFE_DATA_KEY, raw);
      localStorage.setItem(BACKUP_TS_KEY, String(Date.now()));
      localStorage.setItem(LAST_GOOD_TS_KEY, String(Date.now()));
      localStorage.setItem(SAFE_DATA_TS_KEY, String(Date.now()));
      localStorage.setItem('najran_admin_offices_attendance_done', 'true');
      if (reason) console.info('[Admin Offices Persistence] mirrored data:', reason, s);
      return true;
    } catch (err) {
      console.warn('[Admin Offices Persistence] mirror failed:', err);
      return false;
    }
  }

  function mirrorNames(reason) {
    var names = readJson(NAMES_KEY, {});
    var aff = readJson(AFF_KEY, {});
    if (names && Object.keys(names).length) writeJson(SAFE_NAMES_KEY, names);
    if (aff && Object.keys(aff).length) writeJson(SAFE_AFF_KEY, aff);
    if (reason && names && Object.keys(names).length) console.info('[Admin Offices Persistence] mirrored names:', reason, Object.keys(names).length);
  }

  function restoreNamesIfNeeded(reason) {
    if (sessionIsReviewOnly()) return false;
    var names = readJson(NAMES_KEY, {});
    var safeNames = readJson(SAFE_NAMES_KEY, {});
    var restored = false;
    if ((!names || !Object.keys(names).length) && safeNames && Object.keys(safeNames).length) {
      writeJson(NAMES_KEY, safeNames);
      restored = true;
    }
    var aff = readJson(AFF_KEY, {});
    var safeAff = readJson(SAFE_AFF_KEY, {});
    if ((!aff || !Object.keys(aff).length) && safeAff && Object.keys(safeAff).length) {
      writeJson(AFF_KEY, safeAff);
      restored = true;
    }
    if (restored) console.warn('[Admin Offices Persistence] restored names/affiliations:', reason || 'restore');
    return restored;
  }

  function restoreDataIfNeeded(reason) {
    if (sessionIsReviewOnly()) return false;
    var current = readJson(MAIN_KEY, {});
    var best = bestData();
    var cs = score(current);
    var bs = score(best);
    if (bs.rows > 0 && (cs.rows === 0 || bs.named > cs.named || bs.rows > cs.rows)) {
      mirrorData(best, reason || 'restore');
      try { if (typeof window.renderCenterIcons === 'function') window.renderCenterIcons(); } catch (_) {}
      try { if (typeof window.renderMainGrid === 'function') window.renderMainGrid(); } catch (_) {}
      try { if (typeof window.calculateAndDisplayGrandTotal === 'function') window.calculateAndDisplayGrandTotal(); } catch (_) {}
      try {
        var active = document.querySelector('.tab-link.active[data-center-key]')?.dataset?.centerKey || window.activeCenterKeyForManagement || '';
        if (active && typeof window.showCenterDetails === 'function' && document.getElementById('center-details-view')?.style.display !== 'none') window.showCenterDetails(active);
      } catch (_) {}
      console.warn('[Admin Offices Persistence] restored labor data:', reason || 'restore', bs);
      return true;
    }
    if (cs.rows > 0) mirrorData(current, reason || 'keep-current');
    return false;
  }

  function saveCurrentSnapshot(reason) {
    try {
      var data = null;
      if (typeof window.getAttendanceData === 'function') data = window.getAttendanceData();
      if (!data || !countRows(data)) data = bestData();
      mirrorData(data, reason || 'snapshot');
      mirrorNames(reason || 'snapshot');
    } catch (_) {
      var fallback = bestData();
      mirrorData(fallback, reason || 'snapshot-fallback');
      mirrorNames(reason || 'snapshot-fallback');
    }
  }

  function wrapFunction(name, after) {
    var fn = window[name];
    if (typeof fn !== 'function' || fn.__adminOfficesPersistV2Wrapped) return false;
    window[name] = function () {
      var result = fn.apply(this, arguments);
      Promise.resolve(result).finally(function () {
        setTimeout(function () { after(name); }, 80);
        setTimeout(function () { after(name + ':late'); }, 700);
      });
      return result;
    };
    window[name].__adminOfficesPersistV2Wrapped = true;
    return true;
  }

  function patchCoreFunctions() {
    if (typeof window.saveAttendanceData === 'function' && !window.saveAttendanceData.__adminOfficesPersistV2Wrapped) {
      var originalSave = window.saveAttendanceData;
      window.saveAttendanceData = function (data) {
        var result = originalSave.apply(this, arguments);
        mirrorData(data || {}, 'saveAttendanceData');
        mirrorNames('saveAttendanceData');
        return result;
      };
      window.saveAttendanceData.__adminOfficesPersistV2Wrapped = true;
    }

    if (typeof window.getAttendanceData === 'function' && !window.getAttendanceData.__adminOfficesPersistV2Wrapped) {
      var originalGet = window.getAttendanceData;
      window.getAttendanceData = function () {
        restoreNamesIfNeeded('before-getAttendanceData');
        restoreDataIfNeeded('before-getAttendanceData');
        var data = originalGet.apply(this, arguments) || {};
        var best = bestData();
        var ds = score(data);
        var bs = score(best);
        if (bs.rows > 0 && (ds.rows === 0 || bs.named > ds.named || bs.rows > ds.rows)) return best;
        return data;
      };
      window.getAttendanceData.__adminOfficesPersistV2Wrapped = true;
    }
  }

  function patchLoadAndImportFunctions() {
    var after = function (reason) { saveCurrentSnapshot(reason); restoreNamesIfNeeded(reason); restoreDataIfNeeded(reason); };
    [
      'confirmLoadAdminOfficePositions',
      'confirmLoadAllAdminOfficePositions',
      'confirmAdminOfficeImportReplace',
      'confirmAdminOfficeImportUpdate',
      'handleSingleFileImport',
      'runAdminOfficeNormalImport'
    ].forEach(function (name) { wrapFunction(name, after); });
  }

  function safeSheetName(v) {
    return clean(v).replace(/[\\/:*?"<>|]/g, '-').substring(0, 31) || 'مكتب';
  }

  function downloadAllTemplatesWithNames() {
    if (!window.XLSX) return alert('مكتبة Excel غير محملة.');
    restoreDataIfNeeded('download-all-template');
    var names = readJson(NAMES_KEY, {});
    var data = bestData();
    var keys = Object.keys(names || {}).sort(function (a, b) {
      if (/^center_\d+$/.test(a) && /^center_\d+$/.test(b)) return parseInt(a.split('_')[1], 10) - parseInt(b.split('_')[1], 10);
      if (/^center_\d+$/.test(a)) return -1;
      if (/^center_\d+$/.test(b)) return 1;
      return String(a).localeCompare(String(b), 'ar');
    });
    if (!keys.length) keys = Object.keys(data || {});
    var wb = XLSX.utils.book_new();
    var has = false;
    keys.forEach(function (key) {
      var rows = Array.isArray(data[key]) ? data[key] : [];
      var aoa = [['اسم الموظف', 'رقم الهوية / الإقامة', 'مسمى الوظيفة', 'التكلفة الشهرية', 'الفئة', 'الجنسية', 'غرامة جنسية']];
      rows.forEach(function (r) {
        aoa.push([r.name || '', r.iqamaId || r.idNumber || r.identity || r.nationalId || '', r.jobTitle || r.title || '', Number(r.salary || 0), r.category || '1', r.nationality || '', Number(r.nationalityFine || 0)]);
      });
      var ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [{ wch: 30 }, { wch: 22 }, { wch: 34 }, { wch: 18 }, { wch: 8 }, { wch: 16 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, ws, safeSheetName(names[key] || key));
      has = true;
    });
    if (!has) return alert('لا توجد مكاتب للتنزيل.');
    XLSX.writeFile(wb, 'تامبلت-المكاتب-كامل-بالأسماء.xlsx');
  }

  function patchPositionsDialogButton() {
    window.downloadAdminOfficesAllTemplateWithNames = downloadAllTemplatesWithNames;
    if (typeof window.loadAdminOfficePositionsFromTemplate !== 'function' || window.loadAdminOfficePositionsFromTemplate.__adminOfficesPersistV2Wrapped) return;
    var original = window.loadAdminOfficePositionsFromTemplate;
    window.loadAdminOfficePositionsFromTemplate = function () {
      var result = original.apply(this, arguments);
      setTimeout(function () {
        var body = document.querySelector('#management-dialog .dialog-body') || document.querySelector('.dialog-body');
        if (!body || document.getElementById('download-admin-all-template-names-btn')) return;
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:10px 0 16px;';
        row.innerHTML = '<button id="download-admin-all-template-names-btn" class="btn btn-secondary" type="button"><i class="fas fa-file-excel"></i> تنزيل تامبلت كامل بالأسماء</button>';
        body.insertBefore(row, body.firstChild && body.firstChild.nextSibling ? body.firstChild.nextSibling : body.firstChild);
        var btn = document.getElementById('download-admin-all-template-names-btn');
        if (btn) btn.onclick = downloadAllTemplatesWithNames;
      }, 100);
      return result;
    };
    window.loadAdminOfficePositionsFromTemplate.__adminOfficesPersistV2Wrapped = true;
  }

  function boot(reason) {
    restoreNamesIfNeeded(reason || 'boot');
    restoreDataIfNeeded(reason || 'boot');
    patchCoreFunctions();
    patchLoadAndImportFunctions();
    patchPositionsDialogButton();
    saveCurrentSnapshot(reason || 'boot-snapshot');
  }

  // تشغيل مبكر ثم retries لأن بعض دوال الصفحة تُعرّف بعد سكربتات أخرى.
  boot('initial');
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { boot('dom-ready'); });
  setTimeout(function () { boot('t500'); }, 500);
  setTimeout(function () { boot('t1200'); }, 1200);
  setTimeout(function () { boot('t2500'); }, 2500);
  setTimeout(function () { boot('t4500'); }, 4500);

  // بعد السحب السحابي أو تنظيف السياق، أعد النسخة الآمنة لو كانت الصفحة في وضع تحرير.
  window.addEventListener('najranCloudPulled', function () { setTimeout(function () { boot('after-cloud-pull'); }, 100); });

  // حفظ احتياطي دوري خفيف. لا يغير الجداول ولا يعيد الحساب.
  var ticks = 0;
  var timer = setInterval(function () {
    ticks++;
    saveCurrentSnapshot('interval-' + ticks);
    patchCoreFunctions();
    patchLoadAndImportFunctions();
    patchPositionsDialogButton();
    if (ticks >= 20) clearInterval(timer);
  }, 1500);

  window.addEventListener('beforeunload', function () { saveCurrentSnapshot('beforeunload'); });

  window.AdminOfficesAttendancePersistence = {
    restore: function () { restoreNamesIfNeeded('manual'); return restoreDataIfNeeded('manual'); },
    snapshot: function () { return saveCurrentSnapshot('manual'); },
    score: function () { return { current: score(readJson(MAIN_KEY, {})), best: score(bestData()), names: Object.keys(readJson(NAMES_KEY, {})).length, safeNames: Object.keys(readJson(SAFE_NAMES_KEY, {})).length, reviewOnly: sessionIsReviewOnly() }; }
  };

  console.info('[Admin Offices Attendance Persistence] installed v2 refresh survival');
})();