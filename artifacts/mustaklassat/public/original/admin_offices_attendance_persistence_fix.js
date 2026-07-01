// ===================================================================
// Admin Offices Attendance Persistence Fix — V3
// Scope: admin_offices_attendance.html / original-viewer?page=admin_offices_attendance.html
// يحمي حفظ عمالة المكاتب + بيانات المستخلص بعد الريفريش أو تنظيف السياق.
// القاعدة: أي بيانات صالحة يتم نسخها في مفاتيح آمنة لا تحتوي attendance ولا يمسحها تبديل السياق.
// بدون MutationObserver وبدون تعديل جداول أثناء التحميل.
// ===================================================================
(function () {
  'use strict';

  if (!/admin_offices_attendance\.html|original-viewer\?page=admin_offices_attendance\.html/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_ATTENDANCE_PERSISTENCE_FIX_V3__) return;
  window.__ADMIN_OFFICES_ATTENDANCE_PERSISTENCE_FIX_V3__ = true;

  var MAIN_KEY = 'adminOfficesAttendanceData_v1';
  var BACKUP_KEY = 'adminOfficesAttendanceData_v1_localBackup';
  var BACKUP_TS_KEY = 'adminOfficesAttendanceData_v1_localBackup_ts';
  var LAST_GOOD_KEY = 'adminOfficesAttendanceData_v1_lastGood';
  var LAST_GOOD_TS_KEY = 'adminOfficesAttendanceData_v1_lastGood_ts';
  var LEGACY_KEY = 'adminOfficesAttendanceData';

  var SAFE_DATA_KEY = 'adminOfficesLaborDataSafe_v2';
  var SAFE_DATA_TS_KEY = 'adminOfficesLaborDataSafe_v2_ts';
  var SAFE_NAMES_KEY = 'adminOfficesLaborNamesSafe_v2';
  var SAFE_AFF_KEY = 'adminOfficesLaborAffiliationsSafe_v2';
var FULL_BUNDLE_KEY = 'adminOfficesFullAttendanceBundle_v1';
var FULL_BUNDLE_TS_KEY = 'adminOfficesFullAttendanceBundle_v1_ts';
var OFFICE_KEY_PREFIX = 'adminOfficeAttendance_';
var OFFICE_KEY_SUFFIX = '_v1';
  var EXTRACT_KEY = 'persistentExtractData';
  var SAFE_EXTRACT_KEY = 'najranExtractDataSafe_v1';
  var SAFE_EXTRACT_TS_KEY = 'najranExtractDataSafe_v1_ts';

  var NAMES_KEY = 'adminOfficeNames_v1';
  var AFF_KEY = 'adminOfficeAffiliations_v1';

  function readJson(key, fallback) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }
  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value || {})); } catch (_) {}
  }
  function clean(v) {
    return String(v || '').replace(/[\u200f\u200e]/g, '').replace(/\s+/g, ' ').trim();
  }
  function countRows(data) {
    var total = 0;
    data = data || {};
    Object.keys(data).forEach(function (k) { if (Array.isArray(data[k])) total += data[k].length; });
    return total;
  }
  function countNamed(data) {
    var total = 0;
    data = data || {};
    Object.keys(data).forEach(function (k) {
      if (!Array.isArray(data[k])) return;
      data[k].forEach(function (emp) { if (clean(emp && (emp.name || emp.employeeName || emp.workerName || emp.empName))) total++; });
    });
    return total;
  }
 function countOffices(data) {
  var total = 0;
  data = data || {};
  Object.keys(data).forEach(function (k) {
    if (Array.isArray(data[k]) && data[k].length) total++;
  });
  return total;
}

function score(data) {
  return {
    offices: countOffices(data),
    rows: countRows(data),
    named: countNamed(data)
  };
}

function isBetterData(next, current) {
  var ns = score(next);
  var cs = score(current);

  if (ns.offices !== cs.offices) return ns.offices > cs.offices;
  if (ns.named !== cs.named) return ns.named > cs.named;
  if (ns.rows !== cs.rows) return ns.rows > cs.rows;

  return false;
}


  function extractScore(d) {
    d = d || {};
    var n = 0;
    ['paymentNumber','extractNumber','extractMonth','extractYear','extractStart','extractEnd'].forEach(function(k){ if (clean(d[k])) n++; });
    return n;
  }
  function normalizeExtract(d) {
    d = Object.assign({}, d || {});
    d.paymentNumber = clean(d.paymentNumber || d.extractNumber || localStorage.getItem('paymentNumber') || localStorage.getItem('extractNumber'));
    d.extractNumber = clean(d.extractNumber || d.paymentNumber || localStorage.getItem('extractNumber') || localStorage.getItem('paymentNumber'));
    d.extractStart = clean(d.extractStart || d.startDate || localStorage.getItem('extractStart'));
    d.extractEnd = clean(d.extractEnd || d.endDate || localStorage.getItem('extractEnd'));
    d.extractMonth = clean(d.extractMonth || localStorage.getItem('extractMonth'));
    d.extractYear = clean(d.extractYear || localStorage.getItem('extractYear'));
    d.extractCalendar = clean(d.extractCalendar || 'ميلادي');
    d.extractDuration = clean(d.extractDuration || 'شهر واحد');
    return d;
  }
  function mirrorExtract(reason) {
    var data = normalizeExtract(readJson(EXTRACT_KEY, {}));
    if (extractScore(data) <= 0) return false;
    writeJson(EXTRACT_KEY, data);
    writeJson(SAFE_EXTRACT_KEY, data);
    try {
      localStorage.setItem(SAFE_EXTRACT_TS_KEY, String(Date.now()));
      if (data.extractMonth) localStorage.setItem('extractMonth', data.extractMonth);
      if (data.extractYear) localStorage.setItem('extractYear', data.extractYear);
      if (data.paymentNumber) { localStorage.setItem('paymentNumber', data.paymentNumber); localStorage.setItem('extractNumber', data.extractNumber || data.paymentNumber); }
      if (data.extractStart) localStorage.setItem('extractStart', data.extractStart);
      if (data.extractEnd) localStorage.setItem('extractEnd', data.extractEnd);
    } catch (_) {}
    if (reason) console.info('[Admin Offices Persistence] mirrored extract:', reason, data);
    return true;
  }
  function restoreExtractIfNeeded(reason) {
    var main = normalizeExtract(readJson(EXTRACT_KEY, {}));
    var safe = normalizeExtract(readJson(SAFE_EXTRACT_KEY, {}));
    if (extractScore(safe) > extractScore(main)) {
      writeJson(EXTRACT_KEY, safe);
      try {
        if (safe.extractMonth) localStorage.setItem('extractMonth', safe.extractMonth);
        if (safe.extractYear) localStorage.setItem('extractYear', safe.extractYear);
        if (safe.paymentNumber) { localStorage.setItem('paymentNumber', safe.paymentNumber); localStorage.setItem('extractNumber', safe.extractNumber || safe.paymentNumber); }
        if (safe.extractStart) localStorage.setItem('extractStart', safe.extractStart);
        if (safe.extractEnd) localStorage.setItem('extractEnd', safe.extractEnd);
      } catch (_) {}
      console.warn('[Admin Offices Persistence] restored extract:', reason || 'restore', safe);
      return true;
    }
    if (extractScore(main) > 0) mirrorExtract(reason || 'keep-extract');
    return false;
  }
function makeFullBundle(data) {
  return {
    schema: 1,
    updatedAt: new Date().toISOString(),
    names: readJson(NAMES_KEY, {}),
    affiliations: readJson(AFF_KEY, {}),
    attendanceByOffice: data || {},
    extractData: normalizeExtract(readJson(EXTRACT_KEY, {}))
  };
}

function readBundleData() {
  var b = readJson(FULL_BUNDLE_KEY, {});
  return b && b.attendanceByOffice && typeof b.attendanceByOffice === 'object'
    ? b.attendanceByOffice
    : {};
}

function writeFullBundle(data) {
  try {
    var bundle = makeFullBundle(data || {});
    localStorage.setItem(FULL_BUNDLE_KEY, JSON.stringify(bundle));
    localStorage.setItem(FULL_BUNDLE_TS_KEY, String(Date.now()));
  } catch (_) {}
}

function writeOfficeKeys(data) {
  try {
    data = data || {};
    Object.keys(data).forEach(function (officeKey) {
      if (!Array.isArray(data[officeKey])) return;
      localStorage.setItem(OFFICE_KEY_PREFIX + officeKey + OFFICE_KEY_SUFFIX, JSON.stringify(data[officeKey]));
    });
  } catch (_) {}
}

function readOfficeKeysData() {
  var out = {};
  try {
    Object.keys(localStorage).forEach(function (k) {
      if (k.indexOf(OFFICE_KEY_PREFIX) !== 0 || k.slice(-OFFICE_KEY_SUFFIX.length) !== OFFICE_KEY_SUFFIX) return;
      var officeKey = k.slice(OFFICE_KEY_PREFIX.length, -OFFICE_KEY_SUFFIX.length);
      var rows = readJson(k, []);
      if (Array.isArray(rows) && rows.length) out[officeKey] = rows;
    });
  } catch (_) {}
  return out;
}
 function bestData() {
  var candidates = [
    readJson(MAIN_KEY, {}),
    readJson(BACKUP_KEY, {}),
    readJson(LAST_GOOD_KEY, {}),
    readJson(LEGACY_KEY, {}),
    readJson(SAFE_DATA_KEY, {}),
    readBundleData(),
    readOfficeKeysData()
  ];

  return candidates.reduce(function (best, item) {
    return isBetterData(item, best) ? item : best;
  }, {});
}
  function mirrorData(data, reason) {
    if (!data || typeof data !== 'object') return false;
    var s = score(data);
    if (s.rows <= 0) return false;
    var currentBest = bestData();
var currentScore = score(currentBest);

// حماية المحلي: ممنوع نسخة مكتب واحد تكتب فوق نسخة فيها أكثر من مكتب
if (
  currentScore.offices > 1 &&
  s.offices <= 1 &&
  s.rows <= currentScore.rows
) {
  console.warn('[Admin Offices Persistence] blocked incomplete one-office mirror:', reason, s, 'best=', currentScore);
  return false;
}
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
      writeFullBundle(data);
writeOfficeKeys(data);
      if (reason) console.info('[Admin Offices Persistence] mirrored data:', reason, s);
      return true;
    } catch (err) {
      console.warn('[Admin Offices Persistence] mirror failed:', err);
      return false;
    }
  }
  function mirrorNames(reason) {
    var names = readJson(NAMES_KEY, {}), aff = readJson(AFF_KEY, {});
    if (names && Object.keys(names).length) writeJson(SAFE_NAMES_KEY, names);
    if (aff && Object.keys(aff).length) writeJson(SAFE_AFF_KEY, aff);
    if (reason && names && Object.keys(names).length) console.info('[Admin Offices Persistence] mirrored names:', reason, Object.keys(names).length);
  }
  function restoreNamesIfNeeded(reason) {
    var names = readJson(NAMES_KEY, {}), safeNames = readJson(SAFE_NAMES_KEY, {}), restored = false;
    if ((!names || !Object.keys(names).length) && safeNames && Object.keys(safeNames).length) { writeJson(NAMES_KEY, safeNames); restored = true; }
    var aff = readJson(AFF_KEY, {}), safeAff = readJson(SAFE_AFF_KEY, {});
    if ((!aff || !Object.keys(aff).length) && safeAff && Object.keys(safeAff).length) { writeJson(AFF_KEY, safeAff); restored = true; }
    if (restored) console.warn('[Admin Offices Persistence] restored names/affiliations:', reason || 'restore');
    return restored;
  }
  function restoreDataIfNeeded(reason) {
    var current = readJson(MAIN_KEY, {}), best = bestData();
    var cs = score(current), bs = score(best);
if (
  bs.rows > 0 &&
  (
    cs.rows === 0 ||
    bs.offices > cs.offices ||
    bs.named > cs.named ||
    bs.rows > cs.rows
  )
) {      mirrorData(best, reason || 'restore');
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

  function patchSetItem() {
    if (window.__ADMIN_OFFICES_PERSISTENCE_SETITEM_V3__) return;
    window.__ADMIN_OFFICES_PERSISTENCE_SETITEM_V3__ = true;
    var old = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      var result = old.apply(this, arguments);
      try {
        if (this === localStorage) {
          if (String(key) === MAIN_KEY) {
            var data = JSON.parse(String(value || '{}'));
            mirrorData(data, 'setItem:' + MAIN_KEY);
          } else if (String(key) === NAMES_KEY) {
            var names = JSON.parse(String(value || '{}'));
            if (names && Object.keys(names).length) old.call(localStorage, SAFE_NAMES_KEY, JSON.stringify(names));
          } else if (String(key) === AFF_KEY) {
            var aff = JSON.parse(String(value || '{}'));
            if (aff && Object.keys(aff).length) old.call(localStorage, SAFE_AFF_KEY, JSON.stringify(aff));
          } else if (String(key) === EXTRACT_KEY) {
            var ex = normalizeExtract(JSON.parse(String(value || '{}')));
            if (extractScore(ex) > 0) { old.call(localStorage, SAFE_EXTRACT_KEY, JSON.stringify(ex)); old.call(localStorage, SAFE_EXTRACT_TS_KEY, String(Date.now())); }
          }
        }
      } catch (_) {}
      return result;
    };
  }

function saveCurrentSnapshot(reason) {
  try {
    var live = null;
    if (typeof window.getAttendanceData === 'function') live = window.getAttendanceData();

    var best = bestData();
    var data = isBetterData(live || {}, best || {}) ? live : best;

    if (!data || !countRows(data)) data = live || best || {};

    mirrorData(data, reason || 'snapshot');
    mirrorNames(reason || 'snapshot');
    mirrorExtract(reason || 'snapshot');
  } catch (_) {
    mirrorData(bestData(), reason || 'snapshot-fallback');
    mirrorNames(reason || 'snapshot-fallback');
    mirrorExtract(reason || 'snapshot-fallback');
  }
}
  function wrapFunction(name, after) {
    var fn = window[name];
    if (typeof fn !== 'function' || fn.__adminOfficesPersistV3Wrapped) return false;
    window[name] = function () {
      var result = fn.apply(this, arguments);
      Promise.resolve(result).finally(function () {
        setTimeout(function () { after(name); }, 80);
        setTimeout(function () { after(name + ':late'); }, 700);
      });
      return result;
    };
    window[name].__adminOfficesPersistV3Wrapped = true;
    return true;
  }
  function patchCoreFunctions() {
    if (typeof window.saveAttendanceData === 'function' && !window.saveAttendanceData.__adminOfficesPersistV3Wrapped) {
      var originalSave = window.saveAttendanceData;
      window.saveAttendanceData = function (data) {
        var result = originalSave.apply(this, arguments);
        mirrorData(data || {}, 'saveAttendanceData');
        mirrorNames('saveAttendanceData');
        mirrorExtract('saveAttendanceData');
        return result;
      };
      window.saveAttendanceData.__adminOfficesPersistV3Wrapped = true;
    }
    if (typeof window.getAttendanceData === 'function' && !window.getAttendanceData.__adminOfficesPersistV3Wrapped) {
      var originalGet = window.getAttendanceData;
      window.getAttendanceData = function () {
        restoreExtractIfNeeded('before-getAttendanceData');
        restoreNamesIfNeeded('before-getAttendanceData');
        restoreDataIfNeeded('before-getAttendanceData');
        var data = originalGet.apply(this, arguments) || {};
        var best = bestData();
        var ds = score(data), bs = score(best);
        if (bs.rows > 0 && isBetterData(best, data)) return best;
        return data;
      };
      window.getAttendanceData.__adminOfficesPersistV3Wrapped = true;
    }
  }
  function patchLoadAndImportFunctions() {
    var after = function (reason) { saveCurrentSnapshot(reason); restoreNamesIfNeeded(reason); restoreDataIfNeeded(reason); restoreExtractIfNeeded(reason); };
    ['confirmLoadAdminOfficePositions','confirmLoadAllAdminOfficePositions','confirmAdminOfficeImportReplace','confirmAdminOfficeImportUpdate','handleSingleFileImport','runAdminOfficeNormalImport'].forEach(function (name) { wrapFunction(name, after); });
  }
  function safeSheetName(v) { return clean(v).replace(/[\\/:*?"<>|]/g, '-').substring(0, 31) || 'مكتب'; }
  function downloadAllTemplatesWithNames() {
    if (!window.XLSX) return alert('مكتبة Excel غير محملة.');
    restoreDataIfNeeded('download-all-template');
    var names = readJson(NAMES_KEY, {}), data = bestData();
    var keys = Object.keys(names || {}).sort(function (a, b) {
      if (/^center_\d+$/.test(a) && /^center_\d+$/.test(b)) return parseInt(a.split('_')[1], 10) - parseInt(b.split('_')[1], 10);
      if (/^center_\d+$/.test(a)) return -1;
      if (/^center_\d+$/.test(b)) return 1;
      return String(a).localeCompare(String(b), 'ar');
    });
    if (!keys.length) keys = Object.keys(data || {});
    var wb = XLSX.utils.book_new(), has = false;
    keys.forEach(function (key) {
      var rows = Array.isArray(data[key]) ? data[key] : [];
      var aoa = [['اسم الموظف', 'رقم الهوية / الإقامة', 'مسمى الوظيفة', 'التكلفة الشهرية', 'الفئة', 'الجنسية', 'غرامة جنسية']];
      rows.forEach(function (r) { aoa.push([r.name || '', r.iqamaId || r.idNumber || r.identity || r.nationalId || '', r.jobTitle || r.title || '', Number(r.salary || 0), r.category || '1', r.nationality || '', Number(r.nationalityFine || 0)]); });
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
    if (typeof window.loadAdminOfficePositionsFromTemplate !== 'function' || window.loadAdminOfficePositionsFromTemplate.__adminOfficesPersistV3Wrapped) return;
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
    window.loadAdminOfficePositionsFromTemplate.__adminOfficesPersistV3Wrapped = true;
  }
  function boot(reason) {
    patchSetItem();
    restoreExtractIfNeeded(reason || 'boot');
    restoreNamesIfNeeded(reason || 'boot');
    restoreDataIfNeeded(reason || 'boot');
    patchCoreFunctions();
    patchLoadAndImportFunctions();
    patchPositionsDialogButton();
    saveCurrentSnapshot(reason || 'boot-snapshot');
  }

  boot('initial');
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { boot('dom-ready'); });
  setTimeout(function () { boot('t500'); }, 500);
  setTimeout(function () { boot('t1200'); }, 1200);
  setTimeout(function () { boot('t2500'); }, 2500);
  setTimeout(function () { boot('t4500'); }, 4500);
  window.addEventListener('najranCloudPulled', function () { setTimeout(function () { boot('after-cloud-pull'); }, 100); });

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
    restore: function () { restoreExtractIfNeeded('manual'); restoreNamesIfNeeded('manual'); return restoreDataIfNeeded('manual'); },
    snapshot: function () { return saveCurrentSnapshot('manual'); },
    score: function () { return { current: score(readJson(MAIN_KEY, {})), best: score(bestData()), extract: { main: extractScore(readJson(EXTRACT_KEY, {})), safe: extractScore(readJson(SAFE_EXTRACT_KEY, {})) }, names: Object.keys(readJson(NAMES_KEY, {})).length, safeNames: Object.keys(readJson(SAFE_NAMES_KEY, {})).length }; }
  };

  console.info('[Admin Offices Attendance Persistence] installed v3 labor + extract save protection');
})();
