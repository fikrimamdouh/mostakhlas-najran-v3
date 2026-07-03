// ===================================================================
// Admin Offices Attendance Persistence Fix — V4
// Scope: admin_offices_attendance.html / original-viewer?page=admin_offices_attendance.html
// يحمي بيانات المكاتب بدون استدعاء render داخل getAttendanceData حتى لا يحدث loop عند تصفير البيانات.
// ===================================================================
(function () {
  'use strict';

  if (!/admin_offices_attendance\.html|original-viewer\?page=admin_offices_attendance\.html/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_ATTENDANCE_PERSISTENCE_FIX_V4__) return;
  window.__ADMIN_OFFICES_ATTENDANCE_PERSISTENCE_FIX_V4__ = true;

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

  var lastMirroredDataRaw = null;
  var lastMirroredExtractRaw = null;
  var lastMirroredNamesRaw = null;
  var inGetAttendanceData = false;
  var restoringData = false;

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
    Object.keys(data).forEach(function (k) { if (Array.isArray(data[k]) && data[k].length) total++; });
    return total;
  }
  function score(data) {
    return { offices: countOffices(data), rows: countRows(data), named: countNamed(data) };
  }
  function isBetterData(next, current) {
    var ns = score(next), cs = score(current);
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
    if (window.__ADMIN_OFFICES_CLEARING__) return false;
    var data = normalizeExtract(readJson(EXTRACT_KEY, {}));
    if (extractScore(data) <= 0) return false;
    var raw = JSON.stringify(data);
    if (raw === lastMirroredExtractRaw) return true;
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
    lastMirroredExtractRaw = raw;
    if (reason) console.info('[Admin Offices Persistence] mirrored extract:', reason, data);
    return true;
  }
  function restoreExtractIfNeeded(reason) {
    if (window.__ADMIN_OFFICES_CLEARING__) return false;
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
    return { schema: 1, updatedAt: new Date().toISOString(), names: readJson(NAMES_KEY, {}), affiliations: readJson(AFF_KEY, {}), attendanceByOffice: data || {}, extractData: normalizeExtract(readJson(EXTRACT_KEY, {})) };
  }
  function readBundleData() {
    var b = readJson(FULL_BUNDLE_KEY, {});
    return b && b.attendanceByOffice && typeof b.attendanceByOffice === 'object' ? b.attendanceByOffice : {};
  }
  function writeFullBundle(data) {
    try { localStorage.setItem(FULL_BUNDLE_KEY, JSON.stringify(makeFullBundle(data || {}))); localStorage.setItem(FULL_BUNDLE_TS_KEY, String(Date.now())); } catch (_) {}
  }
  function writeOfficeKeys(data) {
    try { data = data || {}; Object.keys(data).forEach(function (officeKey) { if (Array.isArray(data[officeKey])) localStorage.setItem(OFFICE_KEY_PREFIX + officeKey + OFFICE_KEY_SUFFIX, JSON.stringify(data[officeKey])); }); } catch (_) {}
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
    return [readJson(MAIN_KEY, {}), readJson(BACKUP_KEY, {}), readJson(LAST_GOOD_KEY, {}), readJson(LEGACY_KEY, {}), readJson(SAFE_DATA_KEY, {}), readBundleData(), readOfficeKeysData(), readPreWipeSnapshotData()].reduce(function (best, item) { return isBetterData(item, best) ? item : best; }, {});
  }
  // بيانات snapshot الطوارئ الذي يلتقطه cloud-sync قبل أي مسح تشغيلي (تبديل سياق/مراجعة)
  var PRE_WIPE_KEY = 'adminOfficesPreWipeSnapshot_v1';
  function readPreWipeSnapshotData() {
    try {
      var snap = readJson(PRE_WIPE_KEY, null);
      if (!snap || typeof snap !== 'object') return {};
      // لا تستخدم snapshot الطوارئ في جلسة المراجعة — المراجعة تعتمد بيانات السحابة
      var s = JSON.parse(localStorage.getItem('najran_session') || '{}');
      if (s && (s.reviewOnly === true || (s.canReviewCurrentHospital === true && s.canEditCurrentHospital === false))) return {};
      return (snap.core && snap.core.attendanceData) || {};
    } catch (_) { return {}; }
  }
  function mirrorData(data, reason) {
    if (window.__ADMIN_OFFICES_CLEARING__) return false;
    if (!data || typeof data !== 'object') return false;
    var s = score(data);
    if (s.rows <= 0) return false;
    var raw = JSON.stringify(data);
    if (raw === lastMirroredDataRaw) return true;
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
      lastMirroredDataRaw = raw;
      if (reason) console.info('[Admin Offices Persistence] mirrored data:', reason, s);
      return true;
    } catch (err) {
      console.warn('[Admin Offices Persistence] mirror failed:', err);
      return false;
    }
  }
  function mirrorNames(reason) {
    if (window.__ADMIN_OFFICES_CLEARING__) return;
    var names = readJson(NAMES_KEY, {}), aff = readJson(AFF_KEY, {});
    var raw = JSON.stringify([names, aff]);
    if (raw === lastMirroredNamesRaw) return;
    if (names && Object.keys(names).length) writeJson(SAFE_NAMES_KEY, names);
    if (aff && Object.keys(aff).length) writeJson(SAFE_AFF_KEY, aff);
    lastMirroredNamesRaw = raw;
    if (reason && names && Object.keys(names).length) console.info('[Admin Offices Persistence] mirrored names:', reason, Object.keys(names).length);
  }
  function restoreNamesIfNeeded(reason) {
    if (window.__ADMIN_OFFICES_CLEARING__) return false;
    var names = readJson(NAMES_KEY, {}), safeNames = readJson(SAFE_NAMES_KEY, {}), restored = false;
    if ((!names || !Object.keys(names).length) && safeNames && Object.keys(safeNames).length) { writeJson(NAMES_KEY, safeNames); restored = true; }
    var aff = readJson(AFF_KEY, {}), safeAff = readJson(SAFE_AFF_KEY, {});
    if ((!aff || !Object.keys(aff).length) && safeAff && Object.keys(safeAff).length) { writeJson(AFF_KEY, safeAff); restored = true; }
    if (restored) console.warn('[Admin Offices Persistence] restored names/affiliations:', reason || 'restore');
    return restored;
  }
  function restoreDataIfNeeded(reason) {
    if (window.__ADMIN_OFFICES_CLEARING__ || restoringData) return false;
    var current = readJson(MAIN_KEY, {}), best = bestData();
    var cs = score(current), bs = score(best);
    if (cs.rows === 0 && bs.rows > 0) {
      restoringData = true;
      try { mirrorData(best, reason || 'restore'); } finally { restoringData = false; }
      console.warn('[Admin Offices Persistence] restored labor data without render loop:', reason || 'restore', bs);
      return true;
    }
    if (cs.rows > 0) mirrorData(current, reason || 'keep-current');
    return false;
  }
  function zeroLocalBackupsForClear() {
    window.__ADMIN_OFFICES_CLEARING__ = true;
    [MAIN_KEY, BACKUP_KEY, LAST_GOOD_KEY, LEGACY_KEY, SAFE_DATA_KEY, FULL_BUNDLE_KEY, NAMES_KEY, AFF_KEY, SAFE_NAMES_KEY, SAFE_AFF_KEY, EXTRACT_KEY, SAFE_EXTRACT_KEY].forEach(function (key) { try { localStorage.setItem(key, '{}'); } catch (_) {} });
    [BACKUP_TS_KEY, LAST_GOOD_TS_KEY, SAFE_DATA_TS_KEY, FULL_BUNDLE_TS_KEY, SAFE_EXTRACT_TS_KEY, 'extractMonth', 'extractYear', 'extractStart', 'extractEnd', 'extractNumber', 'paymentNumber', 'najran_admin_offices_attendance_done'].forEach(function (key) { try { localStorage.setItem(key, ''); } catch (_) {} });
    try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf(OFFICE_KEY_PREFIX) === 0 && k.slice(-OFFICE_KEY_SUFFIX.length) === OFFICE_KEY_SUFFIX) localStorage.setItem(k, '[]'); }); } catch (_) {}
  }
  function patchSetItem() {
    if (window.__ADMIN_OFFICES_PERSISTENCE_SETITEM_V4__) return;
    window.__ADMIN_OFFICES_PERSISTENCE_SETITEM_V4__ = true;
    var old = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      var result = old.apply(this, arguments);
      try {
        if (this === localStorage && !window.__ADMIN_OFFICES_CLEARING__) {
          if (String(key) === MAIN_KEY) mirrorData(JSON.parse(String(value || '{}')), 'setItem:' + MAIN_KEY);
          else if (String(key) === NAMES_KEY) { var names = JSON.parse(String(value || '{}')); if (names && Object.keys(names).length) old.call(localStorage, SAFE_NAMES_KEY, JSON.stringify(names)); }
          else if (String(key) === AFF_KEY) { var aff = JSON.parse(String(value || '{}')); if (aff && Object.keys(aff).length) old.call(localStorage, SAFE_AFF_KEY, JSON.stringify(aff)); }
          else if (String(key) === EXTRACT_KEY) { var ex = normalizeExtract(JSON.parse(String(value || '{}'))); if (extractScore(ex) > 0) { old.call(localStorage, SAFE_EXTRACT_KEY, JSON.stringify(ex)); old.call(localStorage, SAFE_EXTRACT_TS_KEY, String(Date.now())); } }
        }
      } catch (_) {}
      return result;
    };
  }
  function saveCurrentSnapshot(reason) {
    if (window.__ADMIN_OFFICES_CLEARING__) return;
    try {
      var live = null;
      if (typeof window.getAttendanceData === 'function') live = window.getAttendanceData();
      var data = (live && countRows(live) > 0) ? live : bestData();
      if (data && countRows(data)) mirrorData(data, reason || 'snapshot');
      mirrorNames(reason || 'snapshot');
      mirrorExtract(reason || 'snapshot');
    } catch (_) {}
  }
  function wrapFunction(name, after) {
    var fn = window[name];
    if (typeof fn !== 'function' || fn.__adminOfficesPersistV4Wrapped) return false;
    window[name] = function () {
      var result = fn.apply(this, arguments);
      Promise.resolve(result).finally(function () { if (!window.__ADMIN_OFFICES_CLEARING__) { setTimeout(function () { after(name); }, 80); setTimeout(function () { after(name + ':late'); }, 700); } });
      return result;
    };
    window[name].__adminOfficesPersistV4Wrapped = true;
    return true;
  }
  function patchCoreFunctions() {
    if (typeof window.saveAttendanceData === 'function' && !window.saveAttendanceData.__adminOfficesPersistV4Wrapped) {
      var originalSave = window.saveAttendanceData;
      window.saveAttendanceData = function (data) { var result = originalSave.apply(this, arguments); mirrorData(data || {}, 'saveAttendanceData'); mirrorNames('saveAttendanceData'); mirrorExtract('saveAttendanceData'); return result; };
      window.saveAttendanceData.__adminOfficesPersistV4Wrapped = true;
    }
    if (typeof window.getAttendanceData === 'function' && !window.getAttendanceData.__adminOfficesPersistV4Wrapped) {
      var originalGet = window.getAttendanceData;
      window.getAttendanceData = function () {
        if (window.__ADMIN_OFFICES_CLEARING__) return originalGet.apply(this, arguments) || {};
        if (inGetAttendanceData) return originalGet.apply(this, arguments) || {};
        inGetAttendanceData = true;
        try {
          restoreExtractIfNeeded('before-getAttendanceData');
          restoreNamesIfNeeded('before-getAttendanceData');
          restoreDataIfNeeded('before-getAttendanceData');
          var data = originalGet.apply(this, arguments) || {};
          var ds = score(data);
          if (ds.rows === 0) {
            var best = bestData();
            if (score(best).rows > 0) return best;
          }
          return data;
        } finally {
          inGetAttendanceData = false;
        }
      };
      window.getAttendanceData.__adminOfficesPersistV4Wrapped = true;
    }
    if (typeof window.clearAllData === 'function' && !window.clearAllData.__adminOfficesPersistV4Wrapped) {
      var originalClear = window.clearAllData;
      window.clearAllData = function () {
        window.__ADMIN_OFFICES_CLEARING__ = true;
        try { zeroLocalBackupsForClear(); } catch (_) {}
        try { return originalClear.apply(this, arguments); }
        finally { setTimeout(function () { zeroLocalBackupsForClear(); window.__ADMIN_OFFICES_CLEARING__ = false; }, 1000); }
      };
      window.clearAllData.__adminOfficesPersistV4Wrapped = true;
    }
  }
  function patchLoadAndImportFunctions() {
    var after = function (reason) { saveCurrentSnapshot(reason); restoreNamesIfNeeded(reason); restoreDataIfNeeded(reason); restoreExtractIfNeeded(reason); };
    ['confirmLoadAdminOfficePositions','confirmLoadAllAdminOfficePositions','confirmAdminOfficeImportReplace','confirmAdminOfficeImportUpdate','handleSingleFileImport','runAdminOfficeNormalImport'].forEach(function (name) { wrapFunction(name, after); });
  }
  function boot(attempt) {
    patchSetItem();
    patchCoreFunctions();
    patchLoadAndImportFunctions();
    saveCurrentSnapshot('initial');
    if ((attempt || 0) < 20) setTimeout(function () { boot((attempt || 0) + 1); }, 500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { boot(0); }); else boot(0);
  window.addEventListener('beforeunload', function () { saveCurrentSnapshot('beforeunload'); });
function pad2(n) {
  return String(n).padStart(2, '0');
}
function backupStamp() {
  var d = new Date();
  return [
    d.getFullYear(),
    pad2(d.getMonth() + 1),
    pad2(d.getDate())
  ].join('-') + '_' + [
    pad2(d.getHours()),
    pad2(d.getMinutes()),
    pad2(d.getSeconds())
  ].join('-');
}

function parseMaybeJson(raw) {
  if (raw == null) return null;
  try { return JSON.parse(raw); } catch (_) { return raw; }
}

function isSensitiveBackupKey(key) {
  key = String(key || '').toLowerCase();
  return (
    key.indexOf('token') > -1 ||
    key.indexOf('clerk') > -1 ||
    key.indexOf('jwt') > -1 ||
    key.indexOf('auth') > -1 ||
    key.indexOf('password') > -1 ||
    key === 'najran_session'
  );
}

function normalizeBackupKey(key) {
  return String(key || '').replace(/^(?:_u\d+_)+/, '');
}

function shouldIncludeAdminOfficeBackupKey(key) {
  var nk = normalizeBackupKey(key);
  var lk = nk.toLowerCase();

  if (isSensitiveBackupKey(nk)) return false;

  return (
    lk.indexOf('adminoffice') > -1 ||
    lk.indexOf('admin_office') > -1 ||
    lk.indexOf('admin_offices') > -1 ||
    lk.indexOf('adminoffices') > -1 ||
    lk.indexOf('office') > -1 ||
    lk.indexOf('signature') > -1 ||
    lk.indexOf('signatures') > -1 ||
    lk.indexOf('sig') > -1 ||
    lk.indexOf('sigs') > -1 ||
    lk.indexOf('prefs') > -1 ||
    lk.indexOf('contractor') > -1 ||
    lk.indexOf('dynamic') > -1 ||
    lk.indexOf('performance') > -1 ||
    lk.indexOf('achievement') > -1 ||
    lk.indexOf('grand') > -1 ||
    lk.indexOf('extract') > -1 ||
    lk.indexOf('payment') > -1 ||
    lk.indexOf('contract') > -1 ||
    lk.indexOf('hospital') > -1 ||
    lk.indexOf('company') > -1 ||
    lk.indexOf('najran_admin') > -1 ||
    nk === MAIN_KEY ||
    nk === BACKUP_KEY ||
    nk === LAST_GOOD_KEY ||
    nk === LEGACY_KEY ||
    nk === SAFE_DATA_KEY ||
    nk === SAFE_NAMES_KEY ||
    nk === SAFE_AFF_KEY ||
    nk === FULL_BUNDLE_KEY ||
    nk === EXTRACT_KEY ||
    nk === SAFE_EXTRACT_KEY ||
    nk === NAMES_KEY ||
    nk === AFF_KEY
  );
}

function collectAdminOfficesStorageSnapshot() {
  var out = {};
  var seen = {};
  var stores = [];

  try { stores.push(localStorage); } catch (_) {}
  try {
    if (window._najranRealStorage && window._najranRealStorage !== localStorage) {
      stores.push(window._najranRealStorage);
    }
  } catch (_) {}

  stores.forEach(function (store) {
    try {
      for (var i = 0; i < store.length; i++) {
        var rawKey = store.key(i);
        if (!rawKey) continue;

        var cleanKey = normalizeBackupKey(rawKey);
        if (seen[cleanKey]) continue;
        if (!shouldIncludeAdminOfficeBackupKey(cleanKey)) continue;

        var rawValue = store.getItem(rawKey);
        if (rawValue == null) continue;

        seen[cleanKey] = true;
        out[cleanKey] = parseMaybeJson(rawValue);
      }
    } catch (_) {}
  });

  return out;
}

function downloadAdminOfficesFullBackup() {
  try {
    restoreExtractIfNeeded('full-backup-download');
    restoreNamesIfNeeded('full-backup-download');
    restoreDataIfNeeded('full-backup-download');
    saveCurrentSnapshot('full-backup-download');

    var data = bestData();
    var allStorage = collectAdminOfficesStorageSnapshot();

    var payload = {
      type: 'admin_offices_full_backup',
      schema: 2,
      createdAt: new Date().toISOString(),
      localTime: new Date().toLocaleString('ar-SA'),
      page: 'admin_offices_attendance.html',

      summary: {
        attendanceScore: score(data),
        namesCount: Object.keys(readJson(NAMES_KEY, {})).length,
        affiliationsCount: Object.keys(readJson(AFF_KEY, {})).length,
        storageKeysCount: Object.keys(allStorage).length
      },

      core: {
        attendanceData: data,
        names: readJson(NAMES_KEY, {}),
        affiliations: readJson(AFF_KEY, {}),
        extractData: normalizeExtract(readJson(EXTRACT_KEY, {})),
        fullBundle: readJson(FULL_BUNDLE_KEY, {})
      },

      allAdminOfficeStorage: allStorage
    };

    var blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8'
    });

    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'نسخة-احتياطية-كاملة-المكاتب-الإدارية_' + backupStamp() + '.json';
    document.body.appendChild(a);
    a.click();

    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      if (a.parentElement) a.remove();
    }, 1000);

    console.info('[Admin Offices Persistence] full backup downloaded:', payload.summary);
    return payload.summary;
  } catch (err) {
    console.error('[Admin Offices Persistence] full backup download failed:', err);
    alert('فشل تنزيل النسخة الاحتياطية الكاملة للمكاتب');
    return null;
  }
}

function injectAdminOfficesBackupButton() {
  try {
    injectAdminOfficesRestoreButton();
    if (document.getElementById('admin-offices-full-backup-btn')) return;

    var host =
      document.querySelector('.top-actions') ||
      document.querySelector('.page-actions') ||
      document.querySelector('.actions-bar') ||
      document.querySelector('.toolbar') ||
      document.querySelector('.header-actions') ||
      document.querySelector('.controls') ||
      document.body;

    var btn = document.createElement('button');
    btn.id = 'admin-offices-full-backup-btn';
    btn.type = 'button';
    btn.className = 'btn btn-secondary no-print';
    btn.innerHTML = '<i class="fas fa-download"></i> نسخة احتياطية كاملة';
    btn.style.cssText = 'margin:6px;padding:9px 14px;border-radius:10px;font-weight:800;';

    btn.onclick = function () {
      downloadAdminOfficesFullBackup();
    };

    host.appendChild(btn);
  } catch (_) {}
}

// ── استرجاع النسخة الاحتياطية الكاملة (ملف JSON الذي ينزّله زر "نسخة احتياطية كاملة") ──
function restoreAdminOfficesFullBackupFromObject(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('ملف غير صالح');
  var core = payload.core || {};
  var att = core.attendanceData || (payload.allAdminOfficeStorage && readJsonValue(payload.allAdminOfficeStorage[MAIN_KEY])) || {};
  var attScore = score(att);
  if (attScore.rows <= 0) throw new Error('النسخة لا تحتوي بيانات حضور صالحة');

  // 1) البيانات الأساسية عبر mirrorData (يكتب MAIN + كل نسخ الحماية + bundle)
  lastMirroredDataRaw = null; // فرض الكتابة حتى لو تطابق آخر mirror
  mirrorData(att, 'restore-full-backup');
  if (core.names && Object.keys(core.names).length) writeJson(NAMES_KEY, core.names);
  if (core.affiliations && Object.keys(core.affiliations).length) writeJson(AFF_KEY, core.affiliations);
  if (core.extractData && Object.keys(core.extractData).length) { writeJson(EXTRACT_KEY, normalizeExtract(core.extractData)); lastMirroredExtractRaw = null; mirrorExtract('restore-full-backup'); }
  lastMirroredNamesRaw = null;
  mirrorNames('restore-full-backup');

  // 2) باقي مفاتيح التخزين المرتبطة (توقيعات/عناوين/خطابات...) من allAdminOfficeStorage
  var all = payload.allAdminOfficeStorage || {};
  var restoredKeys = 0;
  Object.keys(all).forEach(function (k) {
    if (!k) return;
    if (/^(najran_session|__clerk|clerk_|loglevel)/.test(k)) return; // لا تلمس الجلسة
    if (k === MAIN_KEY) return; // كُتب أعلاه عبر mirrorData
    try {
      var v = all[k];
      localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
      restoredKeys++;
    } catch (_) {}
  });

  // 3) إعادة الرندر — استرجاع محلي فقط، بدون أي رفع تلقائي للسحابة.
  // الرفع يحصل فقط بالمسارات الاعتيادية (حفظ يدوي / اعتماد مستخلص) بقرار المستخدم.
  try { if (typeof window.renderCenterIcons === 'function') window.renderCenterIcons(); } catch (_) {}
  try { if (typeof window.renderMainGrid === 'function') window.renderMainGrid(); } catch (_) {}
  try { if (typeof window.calculateAndDisplayGrandTotal === 'function') window.calculateAndDisplayGrandTotal(); } catch (_) {}

  console.info('[Admin Offices Persistence] full backup restored:', attScore, '+', restoredKeys, 'keys');
  return { attendance: attScore, extraKeys: restoredKeys };
}
function readJsonValue(v) { try { return typeof v === 'string' ? JSON.parse(v) : v; } catch (_) { return v; } }

function injectAdminOfficesRestoreButton() {
  try {
    if (document.getElementById('admin-offices-full-restore-btn')) return;
    var host =
      document.querySelector('.top-actions') ||
      document.querySelector('.page-actions') ||
      document.querySelector('.actions-bar') ||
      document.querySelector('.toolbar') ||
      document.querySelector('.header-actions') ||
      document.querySelector('.controls') ||
      document.body;

    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    input.id = 'admin-offices-full-restore-input';
    input.onchange = function () {
      var file = input.files && input.files[0];
      input.value = '';
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var payload = JSON.parse(String(e.target.result || '{}'));
          var sum = payload.summary && payload.summary.attendanceScore;
          var msg = 'استرجاع نسخة احتياطية كاملة (محليًا فقط)؟\n' +
            (sum ? ('المكاتب: ' + sum.offices + ' — الصفوف: ' + sum.rows + ' — الأسماء: ' + sum.named + '\n') : '') +
            'سيتم استبدال البيانات المحلية الحالية بمحتوى النسخة. لن يتم رفع أي شيء للسحابة تلقائيًا.';
          if (!confirm(msg)) return;
          var r = restoreAdminOfficesFullBackupFromObject(payload);
          alert('✓ تم الاسترجاع محليًا: ' + r.attendance.offices + ' مكتب / ' + r.attendance.rows + ' صف / ' + r.attendance.named + ' اسم + ' + r.extraKeys + ' مفتاح إضافي.\nلم يُرفع شيء للسحابة — الرفع يتم فقط عند الحفظ الصريح أو اعتماد المستخلص.');
        } catch (err) {
          console.error('[Admin Offices Persistence] restore failed:', err);
          alert('فشل الاسترجاع: ' + (err && err.message ? err.message : 'ملف غير صالح'));
        }
      };
      reader.onerror = function () { alert('تعذر قراءة الملف.'); };
      reader.readAsText(file, 'utf-8');
    };

    var btn = document.createElement('button');
    btn.id = 'admin-offices-full-restore-btn';
    btn.type = 'button';
    btn.className = 'btn btn-secondary no-print';
    btn.innerHTML = '<i class="fas fa-upload"></i> استرجاع نسخة كاملة';
    btn.style.cssText = 'margin:6px;padding:9px 14px;border-radius:10px;font-weight:800;';
    btn.onclick = function () { input.click(); };

    host.appendChild(input);
    host.appendChild(btn);
    window.restoreAdminOfficesFullBackup = restoreAdminOfficesFullBackupFromObject;
  } catch (_) {}
}


  // إعادة الرندر بعد سحب سحابي كتب بيانات المكاتب فعليًا (متصفح جديد) — بدون المرور على مسار getAttendanceData
  window.addEventListener('najranCloudPulled', function (ev) {
    setTimeout(function () {
      try {
        restoreNamesIfNeeded('after-cloud-pull');
        restoreDataIfNeeded('after-cloud-pull');
        restoreExtractIfNeeded('after-cloud-pull');
        var mergedKeys = (ev && ev.detail && ev.detail.mergedKeys) || [];
        var wrote = mergedKeys.indexOf('adminOfficesAttendanceData_v1') !== -1 || mergedKeys.indexOf('adminOfficesFullAttendanceBundle_v1') !== -1;
        if (!wrote) return;
        if (typeof window.renderCenterIcons === 'function') window.renderCenterIcons();
        if (typeof window.renderMainGrid === 'function') window.renderMainGrid();
        if (typeof window.calculateAndDisplayGrandTotal === 'function') window.calculateAndDisplayGrandTotal();
        console.info('[Admin Offices Persistence] re-rendered after cloud pull wrote office data');
      } catch (_) {}
    }, 120);
  });
  // حقن زرّي النسخة الاحتياطية والاسترجاع
  function injectBackupButtonsWithRetry(n) {
    injectAdminOfficesBackupButton();
    if (!document.getElementById('admin-offices-full-backup-btn') && (n || 0) < 20) setTimeout(function () { injectBackupButtonsWithRetry((n || 0) + 1); }, 500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { injectBackupButtonsWithRetry(0); }); else injectBackupButtonsWithRetry(0);

  console.info('[Admin Offices Attendance Persistence] installed v5 = v4 anti-loop + backup/restore buttons + pre-wipe source');
})();