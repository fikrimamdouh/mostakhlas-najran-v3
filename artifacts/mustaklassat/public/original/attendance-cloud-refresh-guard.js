/**
 * attendance-cloud-refresh-guard.js — V4 safe operational/local-wins mode
 *
 * القاعدة النهائية:
 * - المراجع: قراءة فقط. لو لا توجد نسخة سحابية، يتم تفريغ المحلي دائماً لمنع خلط المستشفيات.
 * - المستخدم العادي: لو السيرفر فاضي، ينظف المحلي القديم مرة واحدة فقط عند بداية الصفحة.
 * - المستخدم العادي: لو توجد نسخة سحابية مختلفة ورفض استبدال المحلي، يصبح المحلي هو المصدر الفائز ويتم رفعه للسحابة.
 * - بعد أول تعديل من المستخدم، لا يتم استبدال عمله تلقائياً بسحابة قديمة أثناء نفس الجلسة.
 */
(function () {
  'use strict';

  var sig = location.pathname + location.search;
  var isAttendancePage = /attendance\.html(?:$|[?#])/.test(sig) || /[?&]page=.*attendance\.html(?:$|&)/.test(sig);
  if (!isAttendancePage) return;

  var normalEmptyCloudHandled = false;
  var userTouchedAttendance = false;
  var localWinsUntilSynced = false;
  var cloudComparisonStarted = false;
  var cloudComparisonRunning = false;

  function markAttendanceUserTouched() {
    if (!isReviewOnlySession()) userTouchedAttendance = true;
  }

  document.addEventListener('input', markAttendanceUserTouched, true);
  document.addEventListener('change', markAttendanceUserTouched, true);

  var ATTENDANCE_KEYS = [
    'attendanceData','ng_attendanceData','nd_attendanceData',
    'centersAttendanceData_v2','healthCentersAttendanceData','adminOfficesAttendanceData_v1'
  ];

  function getActiveAttendanceKeys() {
    var full = location.pathname + (location.search || '');
    if (/admin_offices_attendance\.html/.test(full)) return ['adminOfficesAttendanceData_v1'];
    if (/health_centers_attendance\.html/.test(full)) return ['healthCentersAttendanceData'];
    if (/najran_general/.test(full)) return ['ng_attendanceData'];
    if (/dental/.test(full)) return ['nd_attendanceData'];
    return ['attendanceData'];
  }

  function getLocalWinsKey(activeKeys) {
    var s = getSession();
    var hospital = String((s && s.hospital) || '').trim();
    var keys = (activeKeys || getActiveAttendanceKeys()).join('|');
    return 'najran_attendance_local_wins_' + hospital + '_' + keys;
  }

  function markLocalWinsPersistent(activeKeys, reason) {
    try {
      var s = getSession();
      localStorage.setItem(getLocalWinsKey(activeKeys), JSON.stringify({
        hospital: (s && s.hospital) || '',
        keys: activeKeys || getActiveAttendanceKeys(),
        reason: reason || '',
        updatedAt: new Date().toISOString()
      }));
    } catch (_) {}
  }

  function hasLocalWinsPersistent(activeKeys) {
    try {
      var raw = localStorage.getItem(getLocalWinsKey(activeKeys));
      if (!raw) return false;

      var saved = parse(raw);
      var s = getSession();
      if (!saved || !s) return false;

      return String(saved.hospital || '').trim() === String(s.hospital || '').trim();
    } catch (_) {
      return false;
    }
  }

  function clearLocalWinsPersistent(activeKeys) {
    try {
      localStorage.removeItem(getLocalWinsKey(activeKeys));
    } catch (_) {}
  }

  function getSession() {
    try { return JSON.parse(localStorage.getItem('najran_session') || '{}') || {}; } catch (_) { return {}; }
  }

  function isReviewOnlySession() {
    var s = getSession();
    return !!(s && s.reviewOnly === true);
  }

  async function getToken() {
    try {
      if (typeof window.najranGetFreshToken === 'function') { var t = await window.najranGetFreshToken(); if (t) return t; }
      if (window.parent && window.parent !== window && typeof window.parent.najranGetFreshToken === 'function') { var pt = await window.parent.najranGetFreshToken(); if (pt) return pt; }
    } catch (_) {}
    return getSession().clerkToken || '';
  }

  function getHospitalStorageUrl() {
    var s = getSession();
    var url = '/api/hospital-storage';
    if (s && s.reviewOnly === true && s.hospital) url += '?hospital=' + encodeURIComponent(String(s.hospital).trim());
    return url;
  }

  function parse(v) {
    if (!v) return null;
    if (typeof v === 'object') return v;
    try { return JSON.parse(v); } catch (_) { return null; }
  }

  function normalizeKey(key) { return String(key || '').replace(/^(_u\d+_)+/, ''); }

  function normalizeRemoteDataKeys(data) {
    var out = {};
    data = data || {};
    Object.keys(data).forEach(function(key) {
      var nk = normalizeKey(key);
      if (!nk) return;
      if (out[nk] == null || countRows(data[key]) > countRows(out[nk])) out[nk] = data[key];
    });
    return out;
  }

  function countRows(obj) {
    var v = parse(obj);
    if (!v) return 0;
    if (Array.isArray(v)) return v.length;
    if (typeof v === 'object') {
      var total = 0;
      Object.keys(v).forEach(function(k) {
        var x = v[k];
        if (Array.isArray(x)) total += x.length;
        else if (x && typeof x === 'object') total += countRows(x);
      });
      return total;
    }
    return 0;
  }

  function daysBetweenInclusive(start, end) {
    if (!start || !end) return 0;
    var s = new Date(start), e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
    return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
  }

  function readCurrentExtractPeriodDays() {
    try {
      var d = JSON.parse(localStorage.getItem('persistentExtractData') || '{}');
      return daysBetweenInclusive(d.extractStart || localStorage.getItem('extractStart'), d.extractEnd || localStorage.getItem('extractEnd'));
    } catch (_) { return daysBetweenInclusive(localStorage.getItem('extractStart'), localStorage.getItem('extractEnd')); }
  }

  function applyExtractSettingsFromCloud(data) {
    try {
      data = data || {};
      var extract = parse(data.persistentExtractData) || {};
      if (!extract.extractMonth && data.extractMonth) extract.extractMonth = data.extractMonth;
      if (!extract.extractYear && data.extractYear) extract.extractYear = data.extractYear;
      if (!extract.extractStart && data.extractStart) extract.extractStart = data.extractStart;
      if (!extract.extractEnd && data.extractEnd) extract.extractEnd = data.extractEnd;
      if (!extract.paymentNumber && (data.paymentNumber || data.extractNumber)) extract.paymentNumber = data.paymentNumber || data.extractNumber;
      if (!extract.extractCalendar) extract.extractCalendar = 'ميلادي';
      if (!extract.extractDuration) extract.extractDuration = 'شهر واحد';
      if (!extract.extractStart || !extract.extractEnd || !extract.extractMonth || !extract.extractYear) return false;
      localStorage.setItem('persistentExtractData', JSON.stringify(extract));
      localStorage.setItem('extractMonth', extract.extractMonth || '');
      localStorage.setItem('extractYear', String(extract.extractYear || ''));
      localStorage.setItem('extractStart', extract.extractStart || '');
      localStorage.setItem('extractEnd', extract.extractEnd || '');
      localStorage.setItem('paymentNumber', extract.paymentNumber || '');
      localStorage.setItem('extractNumber', extract.paymentNumber || '');
      var monthKey = extract.extractYear && extract.extractMonth ? String(extract.extractYear) + '_' + String(extract.extractMonth) : '';
      if (monthKey) {
        var snapKey = 'monthSnapshot_' + monthKey;
        var snap = parse(localStorage.getItem(snapKey)) || {};
        snap.persistentExtractData = JSON.stringify(extract);
        snap.extractMonth = extract.extractMonth || '';
        snap.extractYear = String(extract.extractYear || '');
        snap.extractStart = extract.extractStart || '';
        snap.extractEnd = extract.extractEnd || '';
        snap.paymentNumber = extract.paymentNumber || '';
        snap.extractNumber = extract.paymentNumber || '';
        localStorage.setItem(snapKey, JSON.stringify(snap));
      }
      return true;
    } catch (e) { console.warn('[AttendanceCloudGuard] فشل تثبيت إعدادات المستخلص', e); return false; }
  }

  function normalizeEmployeeDays(x, daysInPeriod) {
    if (!x || typeof x !== 'object' || !Array.isArray(x.days) || daysInPeriod <= 0) return;
    if (x.days.length < daysInPeriod) x.days = x.days.concat(Array(daysInPeriod - x.days.length).fill('ح'));
    else if (x.days.length > daysInPeriod) x.days = x.days.slice(0, daysInPeriod);
  }

  function normalizeAttendanceValueForCurrentPeriod(value) {
    var parsed = parse(value);
    var daysInPeriod = readCurrentExtractPeriodDays();
    if (!parsed || !daysInPeriod) return value;
    function walk(node) {
      if (!node) return;
      if (Array.isArray(node)) { node.forEach(function(item){ normalizeEmployeeDays(item, daysInPeriod); if (item && typeof item === 'object') walk(item); }); return; }
      if (typeof node === 'object') { normalizeEmployeeDays(node, daysInPeriod); Object.keys(node).forEach(function(k){ walk(node[k]); }); }
    }
    walk(parsed);
    return JSON.stringify(parsed);
  }

  function normalizeLocalAttendanceForCurrentPeriod(keys) {
    var changed = 0;
    (keys || getActiveAttendanceKeys()).forEach(function(k) {
      var val = localStorage.getItem(k);
      if (!val) return;
      var normalized = normalizeAttendanceValueForCurrentPeriod(val);
      if (normalized && normalized !== val) { localStorage.setItem(k, normalized); changed++; }
    });
    return changed;
  }

  function localAttendanceRows(keys) {
    var total = 0;
    (keys || getActiveAttendanceKeys()).forEach(function(k){ total += countRows(localStorage.getItem(k)); });
    return total;
  }

  function remoteAttendanceRows(data, keys) {
    var total = 0;
    (keys || getActiveAttendanceKeys()).forEach(function(k){ total += countRows(data && data[k]); });
    return total;
  }

  function getRemoteMeta(data) {
    try {
      var activity = data && data.hospitalActivityStatus ? parse(data.hospitalActivityStatus) : null;
      return { userName: (activity && activity.userName) || 'مستخدم آخر', updatedAt: (activity && activity.updatedAt) || '', page: (activity && activity.page) || '', pageFile: (activity && activity.pageFile) || '' };
    } catch (_) { return { userName: 'مستخدم آخر', updatedAt: '', page: '', pageFile: '' }; }
  }

  function sameAttendanceSnapshot(data, keys) {
    try {
      return (keys || getActiveAttendanceKeys()).every(function(k) {
        var localVal = localStorage.getItem(k) || '';
        var remoteVal = data && data[k] != null ? (typeof data[k] === 'string' ? data[k] : JSON.stringify(data[k])) : '';
        remoteVal = normalizeAttendanceValueForCurrentPeriod(remoteVal);
        return localVal === remoteVal;
      });
    } catch (_) { return false; }
  }

  function formatDateTime(value) {
    if (!value) return '';
    try { return new Date(value).toLocaleString('ar-SA', { hour12: true }); } catch (_) { return String(value); }
  }

  function clearLocalAttendanceState(reason, activeKeys) {
    var removed = [];
    try {
      (activeKeys || getActiveAttendanceKeys()).forEach(function(k) {
        if (localStorage.getItem(k) != null) removed.push(k);
        localStorage.removeItem(k);
      });
      Object.keys(localStorage).forEach(function(k) {
        var lk = String(k || '').toLowerCase();
        if (lk.indexOf('attendancedata') >= 0 || lk.indexOf('attendance') >= 0 || lk.indexOf('monthsnapshot') >= 0) {
          removed.push(k);
          localStorage.removeItem(k);
        }
      });
    } catch (_) {}
    console.warn('[AttendanceCloudGuard] تم تفريغ الحضور المحلي: ' + (reason || '') + ' — removed=' + removed.length);
  }

  function forceLocalAttendanceDirtyAndSync(activeKeys, reason) {
    if (isReviewOnlySession()) return;
    try {
      (activeKeys || getActiveAttendanceKeys()).forEach(function(k) {
        var val = localStorage.getItem(k);
        if (val != null) localStorage.setItem(k, val);
      });
      console.warn('[AttendanceCloudGuard] LOCAL WINS: سيتم رفع النسخة المحلية للسحابة — ' + (reason || ''));
      if (typeof window.najranSyncNow === 'function') {
        setTimeout(function(){ window.najranSyncNow().catch(function(){}); }, 1000);
      }
    } catch (e) {
      console.warn('[AttendanceCloudGuard] تعذر تعليم المحلي كنسخة فائزة', e);
    }
  }

  function shouldReplaceLocalAttendance(localRows, remoteRows, meta, keys) {
    var msg =
      'يوجد اختلاف بين بيانات الحضور المحلية والنسخة السحابية.\n\n' +
      'المفاتيح: ' + (keys || []).join(', ') + '\n' +
      'المحلي عندك: ' + localRows + ' صف\n' +
      'السحابي: ' + remoteRows + ' صف\n' +
      'آخر تعديل على السحابة: ' + (meta.userName || 'مستخدم آخر') + '\n' +
      (meta.updatedAt ? ('الوقت: ' + formatDateTime(meta.updatedAt) + '\n') : '') +
      '\nموافق = تنزيل النسخة السحابية واستبدال المحلي\nإلغاء = الاحتفاظ بعملك المحلي ورفعه للسحابة';
    return confirm(msg);
  }

  function renderAgain(reason) {
    try { if (typeof window.updateContractDisplayData === 'function') window.updateContractDisplayData(); } catch (_) {}
    try { if (typeof window.rebuildTableHeaders === 'function') window.rebuildTableHeaders(); } catch (_) {}
    try { if (typeof window.renderTables === 'function') window.renderTables(); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('najranAttendanceCloudRestored', { detail: { reason: reason || '' } })); } catch (_) {}
  }

  async function refreshFromHospitalStorage(options) {
    options = options || {};
    if (cloudComparisonRunning) {
      console.warn('[AttendanceCloudGuard] تم تجاهل فحص مكرر أثناء تنفيذ الفحص الأول');
      return;
    }
    if (cloudComparisonStarted && !options.force) {
      console.warn('[AttendanceCloudGuard] تم تجاهل فحص مكرر — الفحص يعمل مرة واحدة عند فتح الصفحة فقط');
      return;
    }

    cloudComparisonStarted = true;
    cloudComparisonRunning = true;

    try {
      var activeKeys = getActiveAttendanceKeys();
      normalizeLocalAttendanceForCurrentPeriod(activeKeys);
      var localRows = localAttendanceRows(activeKeys);
      var token = await getToken();

      if (!isReviewOnlySession() && localRows > 0 && hasLocalWinsPersistent(activeKeys)) {
        console.warn('[AttendanceCloudGuard] LOCAL WINS PERSISTENT: تم منع استبدال المحلي بالسحابة بعد الريفريش');
        forceLocalAttendanceDirtyAndSync(activeKeys, 'persistent-local-wins-after-refresh');
        setTimeout(function(){ renderAgain('persistent-local-wins-preserved'); }, 50);
        setTimeout(function(){ renderAgain('persistent-local-wins-preserved'); }, 500);
        return;
      }

      if (!token) { console.warn('[AttendanceCloudGuard] لا يوجد token'); return; }

      var res = await fetch(getHospitalStorageUrl(), {
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        credentials: 'include'
      });
      if (!res.ok) { console.warn('[AttendanceCloudGuard] فشل: ' + res.status); return; }

      var json = await res.json();
      var data = normalizeRemoteDataKeys(json && json.data ? json.data : {});
      applyExtractSettingsFromCloud(data);
      var remoteRows = remoteAttendanceRows(data, activeKeys);
      var meta = getRemoteMeta(data);

      if (remoteRows <= 0) {
        if (isReviewOnlySession()) {
          clearLocalAttendanceState('reviewOnly-no-cloud-attendance', activeKeys);
          console.warn('[AttendanceCloudGuard] REVIEW ONLY: لا توجد نسخة حضور سحابية لهذه المستشفى — تم تفريغ الحضور المحلي لمنع خلط المستشفيات — keys=' + activeKeys.join(','));
          setTimeout(function(){ renderAgain('review-empty-cloud'); }, 50);
          setTimeout(function(){ renderAgain('review-empty-cloud'); }, 500);
          return;
        }

        if (!normalEmptyCloudHandled) {
          clearLocalAttendanceState('normal-initial-no-cloud-attendance', activeKeys);
          normalEmptyCloudHandled = true;
          console.warn('[AttendanceCloudGuard] لا توجد نسخة حضور سحابية — تم تنظيف المحلي مرة واحدة والصفحة جاهزة للإدخال — keys=' + activeKeys.join(','));
          setTimeout(function(){ renderAgain('normal-empty-ready-for-input'); }, 50);
          setTimeout(function(){ renderAgain('normal-empty-ready-for-input'); }, 500);
          return;
        }

        console.warn('[AttendanceCloudGuard] السيرفر لا يحتوي حضور، وتم تجاهل التنظيف المتكرر لحماية تعديلات المستخدم — keys=' + activeKeys.join(','));
        setTimeout(function(){ renderAgain('normal-empty-preserve-user-edits'); }, 50);
        forceLocalAttendanceDirtyAndSync(activeKeys, 'remote-empty-after-user-session');
        return;
      }

      if (!isReviewOnlySession() && localWinsUntilSynced && localRows > 0 && !sameAttendanceSnapshot(data, activeKeys)) {
        normalizeLocalAttendanceForCurrentPeriod(activeKeys);
        forceLocalAttendanceDirtyAndSync(activeKeys, 'previous-user-rejected-cloud');
        setTimeout(function(){ renderAgain('local-wins-uploading'); }, 50);
        return;
      }

      if (!isReviewOnlySession() && userTouchedAttendance) {
        console.warn('[AttendanceCloudGuard] تم تجاهل استبدال السحابة لأن المستخدم بدأ التعديل محلياً');
        forceLocalAttendanceDirtyAndSync(activeKeys, 'user-touched-local');
        return;
      }

      if (localRows > 0 && !sameAttendanceSnapshot(data, activeKeys)) {
        var replace = shouldReplaceLocalAttendance(localRows, remoteRows, meta, activeKeys);

        if (!replace) {
          localWinsUntilSynced = true;
          userTouchedAttendance = true;
          markLocalWinsPersistent(activeKeys, 'user-clicked-cancel-keep-local');
          normalizeLocalAttendanceForCurrentPeriod(activeKeys);
          forceLocalAttendanceDirtyAndSync(activeKeys, 'user-clicked-cancel-keep-local');
          setTimeout(function(){ renderAgain('keep-local-and-upload'); }, 50);
          setTimeout(function(){ renderAgain('keep-local-and-upload'); }, 500);
          setTimeout(function(){ renderAgain('keep-local-and-upload'); }, 1500);
          return;
        }
      }

      var restored = 0, restoredRows = 0;
      activeKeys.forEach(function(k) {
        var val = data[k];
        var rows = countRows(val);
        if (val == null || rows <= 0) return;
        var normalizedVal = normalizeAttendanceValueForCurrentPeriod(val);
        localStorage.setItem(k, normalizedVal);
        restored++;
        restoredRows += rows;
      });

      if (restored > 0) {
        localWinsUntilSynced = false;
        clearLocalWinsPersistent(activeKeys);
        console.log('[AttendanceCloudGuard] استرجاع من السحابة: ' + restored + ' مفتاح / ' + restoredRows + ' صف');
        setTimeout(function(){ renderAgain(localRows > 0 ? 'cloud-replaced-local' : 'cloud-restored'); }, 50);
        setTimeout(function(){ renderAgain(localRows > 0 ? 'cloud-replaced-local' : 'cloud-restored'); }, 500);
      }
    } catch (e) {
      console.warn('[AttendanceCloudGuard] خطأ', e);
    } finally {
      cloudComparisonRunning = false;
    }
  }

  window.najranUseCloudAttendance = function () {
    try {
      var activeKeys = getActiveAttendanceKeys();
      clearLocalWinsPersistent(activeKeys);
      localWinsUntilSynced = false;
      userTouchedAttendance = false;
      cloudComparisonStarted = false;
      console.warn('[AttendanceCloudGuard] تم إلغاء تفضيل النسخة المحلية — سيتم السماح بسحب السحابة');
      setTimeout(function(){ refreshFromHospitalStorage({ force: true }); }, 100);
    } catch (e) {
      console.warn('[AttendanceCloudGuard] فشل إلغاء تفضيل المحلي', e);
    }
  };

  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(function(){ refreshFromHospitalStorage({ reason: 'initial-page-open' }); }, 1200);
  });
})();