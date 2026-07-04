// ===================================================================
// Admin Offices Attendance Persistence Fix — V10 revision-safe
// Scope: admin_offices_attendance.html / original-viewer?page=admin_offices_attendance.html
// يمنع أي local draft / backup قديم من الدهس فوق بيانات تعديل مستخلص محفوظ.
// ===================================================================
(function () {
  'use strict';

  if (!/admin_offices_attendance\.html|original-viewer\?page=admin_offices_attendance\.html/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_ATTENDANCE_PERSISTENCE_FIX_V10__) return;
  window.__ADMIN_OFFICES_ATTENDANCE_PERSISTENCE_FIX_V10__ = true;

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
  var revisionSkipLogged = false;

  function readJson(key, fallback) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value || {})); } catch (_) {}
  }

  function clean(v) {
    return String(v || '').replace(/[\u200f\u200e]/g, '').replace(/\s+/g, ' ').trim();
  }

  function isRevisionEditMode() {
    try {
      // revision mode يتحقق بوجود المفتاحين الأساسيين فقط — snapshot/summary اختياريين
      // (ممكن يفشلوا بسبب quota أو ترتيب تنفيذ الحراس)
      return localStorage.getItem('najran_revision_mode') === 'true' &&
        !!(localStorage.getItem('najran_revision_extract_id') || localStorage.getItem('najran_editing_submitted_extract_id'));
    } catch (_) { return false; }
  }

  function revisionSkip(reason) {
    if (!isRevisionEditMode()) return false;
    if (!revisionSkipLogged) {
      revisionSkipLogged = true;
      console.warn('[Admin Offices Persistence] revision mode detected — local draft restore skipped');
    }
    if (reason) console.info('[Admin Offices Persistence] skipped local restore during revision:', reason);
    return true;
  }

  function forceEditSessionDuringRevision() {
    if (!isRevisionEditMode()) return;
    try {
      var raw = localStorage.getItem('najran_session');
      if (!raw) return;
      var s = JSON.parse(raw);
      if (!s) return;
      s.reviewOnly = false;
      s.canReviewCurrentHospital = false;
      s.canEditCurrentHospital = true;
      s.timestamp = Date.now();
      localStorage.setItem('najran_session', JSON.stringify(s));
      if (s.hospital) localStorage.setItem('najran_active_hospital_context', String(s.hospital).trim());
    } catch (_) {}
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

  function makeFullBundle(data) {
    return { schema: 2, updatedAt: new Date().toISOString(), names: readJson(NAMES_KEY, {}), affiliations: readJson(AFF_KEY, {}), attendanceByOffice: data || {}, extractData: normalizeExtract(readJson(EXTRACT_KEY, {})) };
  }

  function readBundleData() {
    var b = readJson(FULL_BUNDLE_KEY, {});
    return b && b.attendanceByOffice && typeof b.attendanceByOffice === 'object' ? b.attendanceByOffice : {};
  }

  function writeFullBundle(data) {
    try { localStorage.setItem(FULL_BUNDLE_KEY, JSON.stringify(makeFullBundle(data || {}))); localStorage.setItem(FULL_BUNDLE_TS_KEY, String(Date.now())); } catch (_) {}
  }

  function writeOfficeKeys(data) {
    try {
      data = data || {};
      Object.keys(data).forEach(function (officeKey) {
        if (Array.isArray(data[officeKey])) localStorage.setItem(OFFICE_KEY_PREFIX + officeKey + OFFICE_KEY_SUFFIX, JSON.stringify(data[officeKey]));
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
    if (revisionSkip('bestData')) return {};
    return [
      readJson(MAIN_KEY, {}),
      readJson(BACKUP_KEY, {}),
      readJson(LAST_GOOD_KEY, {}),
      readJson(LEGACY_KEY, {}),
      readJson(SAFE_DATA_KEY, {}),
      readBundleData(),
      readOfficeKeysData()
    ].reduce(function (best, item) { return isBetterData(item, best) ? item : best; }, {});
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
    if (revisionSkip(reason || 'restoreExtract')) return false;
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
    if (revisionSkip(reason || 'restoreNames')) return false;
    var names = readJson(NAMES_KEY, {}), safeNames = readJson(SAFE_NAMES_KEY, {}), restored = false;
    if ((!names || !Object.keys(names).length) && safeNames && Object.keys(safeNames).length) { writeJson(NAMES_KEY, safeNames); restored = true; }
    var aff = readJson(AFF_KEY, {}), safeAff = readJson(SAFE_AFF_KEY, {});
    if ((!aff || !Object.keys(aff).length) && safeAff && Object.keys(safeAff).length) { writeJson(AFF_KEY, safeAff); restored = true; }
    if (restored) console.warn('[Admin Offices Persistence] restored names/affiliations:', reason || 'restore');
    return restored;
  }

  function restoreDataIfNeeded(reason) {
    if (window.__ADMIN_OFFICES_CLEARING__ || restoringData) return false;
    if (revisionSkip(reason || 'restoreData')) return false;
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
    if (window.__ADMIN_OFFICES_PERSISTENCE_SETITEM_V10__) return;
    window.__ADMIN_OFFICES_PERSISTENCE_SETITEM_V10__ = true;
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
      if (isRevisionEditMode()) {
        if (live && countRows(live) > 0) mirrorData(live, reason || 'revision-current');
        mirrorNames(reason || 'revision-current');
        mirrorExtract(reason || 'revision-current');
        revisionSkip(reason || 'snapshot');
        return;
      }
      var data = (live && countRows(live) > 0) ? live : bestData();
      if (data && countRows(data)) mirrorData(data, reason || 'snapshot');
      mirrorNames(reason || 'snapshot');
      mirrorExtract(reason || 'snapshot');
    } catch (_) {}
  }

  function wrapFunction(name, after) {
    var fn = window[name];
    if (typeof fn !== 'function' || fn.__adminOfficesPersistV10Wrapped) return false;
    window[name] = function () {
      var result = fn.apply(this, arguments);
      Promise.resolve(result).finally(function () {
        if (!window.__ADMIN_OFFICES_CLEARING__) {
          setTimeout(function () { after(name); }, 80);
          setTimeout(function () { after(name + ':late'); }, 700);
        }
      });
      return result;
    };
    window[name].__adminOfficesPersistV10Wrapped = true;
    return true;
  }

  function patchCoreFunctions() {
    if (typeof window.saveAttendanceData === 'function' && !window.saveAttendanceData.__adminOfficesPersistV10Wrapped) {
      var originalSave = window.saveAttendanceData;
      window.saveAttendanceData = function (data) {
        var result = originalSave.apply(this, arguments);
        mirrorData(data || {}, 'saveAttendanceData');
        mirrorNames('saveAttendanceData');
        mirrorExtract('saveAttendanceData');
        return result;
      };
      window.saveAttendanceData.__adminOfficesPersistV10Wrapped = true;
    }
    if (typeof window.getAttendanceData === 'function' && !window.getAttendanceData.__adminOfficesPersistV10Wrapped) {
      var originalGet = window.getAttendanceData;
      window.getAttendanceData = function () {
        if (window.__ADMIN_OFFICES_CLEARING__) return originalGet.apply(this, arguments) || {};
        if (inGetAttendanceData) return originalGet.apply(this, arguments) || {};
        inGetAttendanceData = true;
        try {
          if (!isRevisionEditMode()) {
            restoreExtractIfNeeded('before-getAttendanceData');
            restoreNamesIfNeeded('before-getAttendanceData');
            restoreDataIfNeeded('before-getAttendanceData');
          } else {
            revisionSkip('before-getAttendanceData');
          }
          var data = originalGet.apply(this, arguments) || {};
          if (score(data).rows === 0 && !isRevisionEditMode()) {
            var best = bestData();
            if (score(best).rows > 0) return best;
          }
          return data;
        } finally {
          inGetAttendanceData = false;
        }
      };
      window.getAttendanceData.__adminOfficesPersistV10Wrapped = true;
    }
    if (typeof window.clearAllData === 'function' && !window.clearAllData.__adminOfficesPersistV10Wrapped) {
      var originalClear = window.clearAllData;
      window.clearAllData = function () {
        window.__ADMIN_OFFICES_CLEARING__ = true;
        try { zeroLocalBackupsForClear(); } catch (_) {}
        try { return originalClear.apply(this, arguments); }
        finally { setTimeout(function () { zeroLocalBackupsForClear(); window.__ADMIN_OFFICES_CLEARING__ = false; }, 1000); }
      };
      window.clearAllData.__adminOfficesPersistV10Wrapped = true;
    }
  }

  function patchLoadAndImportFunctions() {
    var after = function (reason) {
      saveCurrentSnapshot(reason);
      if (!isRevisionEditMode()) {
        restoreNamesIfNeeded(reason);
        restoreDataIfNeeded(reason);
        restoreExtractIfNeeded(reason);
      }
    };
    ['confirmLoadAdminOfficePositions','confirmLoadAllAdminOfficePositions','confirmAdminOfficeImportReplace','confirmAdminOfficeImportUpdate','handleSingleFileImport','runAdminOfficeNormalImport'].forEach(function (name) { wrapFunction(name, after); });
  }

  function backupStamp() {
    var d = new Date();
    function p(n) { return String(n).padStart(2, '0'); }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '_' + p(d.getHours()) + '-' + p(d.getMinutes()) + '-' + p(d.getSeconds());
  }

  function downloadAdminOfficesFullBackup() {
    try {
      saveCurrentSnapshot('full-backup-download');
      var data = isRevisionEditMode() ? readJson(MAIN_KEY, {}) : bestData();
      var payload = {
        type: 'admin_offices_full_backup',
        schema: 3,
        createdAt: new Date().toISOString(),
        localTime: new Date().toLocaleString('ar-SA'),
        page: 'admin_offices_attendance.html',
        summary: { attendanceScore: score(data), namesCount: Object.keys(readJson(NAMES_KEY, {})).length, affiliationsCount: Object.keys(readJson(AFF_KEY, {})).length },
        core: { attendanceData: data, names: readJson(NAMES_KEY, {}), affiliations: readJson(AFF_KEY, {}), extractData: normalizeExtract(readJson(EXTRACT_KEY, {})), fullBundle: readJson(FULL_BUNDLE_KEY, {}) }
      };
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'نسخة-احتياطية-كاملة-المكاتب-الإدارية_' + backupStamp() + '.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); if (a.parentElement) a.remove(); }, 1000);
      console.info('[Admin Offices Persistence] full backup downloaded:', payload.summary);
      return payload.summary;
    } catch (err) {
      console.error('[Admin Offices Persistence] full backup download failed:', err);
      alert('فشل تنزيل النسخة الاحتياطية الكاملة للمكاتب');
      return null;
    }
  }

  function restoreAdminOfficesFullBackupFromObject(payload) {
    if (isRevisionEditMode()) {
      revisionSkip('manual-full-backup-restore');
      throw new Error('وضع تعديل مستخلص محفوظ نشط — ممنوع استرجاع نسخة محلية فوق بيانات التعديل.');
    }
    if (!payload || typeof payload !== 'object') throw new Error('ملف غير صالح');
    var core = payload.core || {};
    var att = core.attendanceData || (payload.allAdminOfficeStorage && payload.allAdminOfficeStorage[MAIN_KEY]) || {};
    var attScore = score(att);
    if (attScore.rows <= 0) throw new Error('النسخة لا تحتوي بيانات حضور صالحة');
    lastMirroredDataRaw = null;
    mirrorData(att, 'restore-full-backup');
    if (core.names && Object.keys(core.names).length) writeJson(NAMES_KEY, core.names);
    if (core.affiliations && Object.keys(core.affiliations).length) writeJson(AFF_KEY, core.affiliations);
    if (core.extractData && Object.keys(core.extractData).length) { writeJson(EXTRACT_KEY, normalizeExtract(core.extractData)); lastMirroredExtractRaw = null; mirrorExtract('restore-full-backup'); }
    lastMirroredNamesRaw = null;
    mirrorNames('restore-full-backup');
    try { if (typeof window.renderCenterIcons === 'function') window.renderCenterIcons(); } catch (_) {}
    try { if (typeof window.renderMainGrid === 'function') window.renderMainGrid(); } catch (_) {}
    try { if (typeof window.calculateAndDisplayGrandTotal === 'function') window.calculateAndDisplayGrandTotal(); } catch (_) {}
    console.info('[Admin Offices Persistence] full backup restored:', attScore);
    return { attendance: attScore, extraKeys: 0 };
  }

  function unifyTopBackupButtons() {
    try {
      if (typeof window.backupData === 'function' || document.querySelector('.ab-backup')) window.backupData = function () { downloadAdminOfficesFullBackup(); };
      var fileInput = document.getElementById('restore-file-input');
      if (fileInput) {
        window.restoreData = function () { fileInput.click(); };
        fileInput.onchange = function (ev) {
          var file = ev && ev.target && ev.target.files && ev.target.files[0];
          if (ev && ev.target) ev.target.value = '';
          if (!file) return;
          var reader = new FileReader();
          reader.onload = function (e2) {
            try {
              var payload = JSON.parse(String(e2.target.result || '{}'));
              var r = restoreAdminOfficesFullBackupFromObject(payload);
              alert('✓ تم الاسترجاع محليًا: ' + r.attendance.offices + ' مكتب / ' + r.attendance.rows + ' صف / ' + r.attendance.named + ' اسم.');
            } catch (err) {
              console.error('[Admin Offices Persistence] restore failed:', err);
              alert('فشل الاسترجاع: ' + (err && err.message ? err.message : 'ملف غير صالح'));
            }
          };
          reader.onerror = function () { alert('تعذر قراءة الملف.'); };
          reader.readAsText(file, 'utf-8');
        };
      }
      window.restoreAdminOfficesFullBackup = restoreAdminOfficesFullBackupFromObject;
    } catch (_) {}
  }

  function boot(attempt) {
    forceEditSessionDuringRevision();
    patchSetItem();
    patchCoreFunctions();
    patchLoadAndImportFunctions();
    unifyTopBackupButtons();
    if (!isRevisionEditMode()) saveCurrentSnapshot('initial');
    else revisionSkip('initial');
    if ((attempt || 0) < 20) setTimeout(function () { boot((attempt || 0) + 1); }, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { boot(0); }); else boot(0);
  window.addEventListener('beforeunload', function () { saveCurrentSnapshot('beforeunload'); });

  window.addEventListener('najranCloudPulled', function (ev) {
    if (isRevisionEditMode()) { revisionSkip('after-cloud-pull'); return; }
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

  console.info('[Admin Offices Attendance Persistence] installed v10 revision-safe local draft guard');
})();