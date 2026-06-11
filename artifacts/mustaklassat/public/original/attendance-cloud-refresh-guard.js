/**
 * attendance-cloud-refresh-guard.js — V2
 *
 * FIX الأساسي:
 * لما remoteRows = 0 والجلسة مش reviewOnly:
 * - الكود القديم: يعرض localRows القديم (خطر تسريب بيانات)
 * - الكود الجديد: يتحقق هل الـ local من نفس المستشفى الحالية
 *   لو مختلف → يمسح المحلي
 *   لو نفس المستشفى → يحتفظ بيه (ده الوضع الطبيعي)
 */
(function () {
  'use strict';

  var sig = location.pathname + location.search;
  var isAttendancePage = /attendance\.html(?:$|[?#])/.test(sig) || /[?&]page=.*attendance\.html(?:$|&)/.test(sig);
  if (!isAttendancePage) return;

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

  function getSession() {
    try { return JSON.parse(localStorage.getItem('najran_session') || '{}') || {}; } catch (_) { return {}; }
  }
  function isReviewOnlySession() {
    var s = getSession();
    return !!(s && s.reviewOnly === true);
  }
  function getCurrentHospital() {
    var s = getSession();
    return s && s.hospital ? String(s.hospital).trim() : '';
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
        snap.extractMonth = extract.extractMonth || ''; snap.extractYear = String(extract.extractYear || '');
        snap.extractStart = extract.extractStart || ''; snap.extractEnd = extract.extractEnd || '';
        snap.paymentNumber = extract.paymentNumber || ''; snap.extractNumber = extract.paymentNumber || '';
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

  // ─── FIX: تحقق هل الـ local من نفس المستشفى الحالية ─────────────────────
  function isLocalAttendanceFromCurrentHospital() {
    var currentHospital = getCurrentHospital();
    if (!currentHospital) return false;

    // طريقة 1: تحقق من hospitalActivityStatus
    try {
      var activity = parse(localStorage.getItem('hospitalActivityStatus'));
      if (activity && activity.hospital) {
        return String(activity.hospital).trim() === currentHospital;
      }
    } catch (_) {}

    // طريقة 2: تحقق من hospitalName المحفوظ
    try {
      var storedHospital = localStorage.getItem('hospitalName');
      if (storedHospital) {
        return String(storedHospital).trim() === currentHospital;
      }
    } catch (_) {}

    // مش متأكد → اعتبرها من مستشفى مختلفة (الأأمن)
    return false;
  }

  function shouldReplaceLocalAttendance(localRows, remoteRows, meta, keys) {
    var msg =
      'يوجد اختلاف بين بيانات الحضور المحلية والنسخة السحابية.\n\n' +
      'المفاتيح: ' + (keys || []).join(', ') + '\n' +
      'المحلي: ' + localRows + ' صف\n' +
      'السحابي: ' + remoteRows + ' صف\n' +
      'آخر تعديل: ' + (meta.userName || 'مستخدم آخر') + '\n' +
      (meta.updatedAt ? ('الوقت: ' + formatDateTime(meta.updatedAt) + '\n') : '') +
      '\nموافق = استبدال المحلي بالسحابي\nإلغاء = الاحتفاظ بالمحلي مع ضبطه على مدة المستخلص';
    return confirm(msg);
  }

  function renderAgain(reason) {
    try { if (typeof window.updateContractDisplayData === 'function') window.updateContractDisplayData(); } catch (_) {}
    try { if (typeof window.rebuildTableHeaders === 'function') window.rebuildTableHeaders(); } catch (_) {}
    try { if (typeof window.renderTables === 'function') window.renderTables(); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('najranAttendanceCloudRestored', { detail: { reason: reason || '' } })); } catch (_) {}
  }

  async function refreshFromHospitalStorage() {
    var activeKeys = getActiveAttendanceKeys();
    var localRows = localAttendanceRows(activeKeys);
    var token = await getToken();
    if (!token) { console.warn('[AttendanceCloudGuard] لا يوجد token'); return; }

    try {
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

      // ─── حالة: السيرفر فاضي لهذه المستشفى ───────────────────────────────
    if (remoteRows <= 0) {
  activeKeys.forEach(function(k) {
    localStorage.removeItem(k);
  });

  Object.keys(localStorage).forEach(function(k) {
    var lk = k.toLowerCase();

    if (
      lk.indexOf('attendancedata') >= 0 ||
      lk.indexOf('attendance') >= 0 ||
      lk.indexOf('monthsnapshot') >= 0
    ) {
      localStorage.removeItem(k);
    }
  });

  console.warn(
    '[AttendanceCloudGuard] لا توجد نسخة حضور سحابية لهذه المستشفى — تم تفريغ الحضور المحلي لمنع خلط المستشفيات — keys=' +
    activeKeys.join(',')
  );

  setTimeout(function() {
    renderAgain(
      isReviewOnlySession()
        ? 'review-empty-cloud'
        : 'normal-empty-ready-for-input'
    );
  }, 50);

  setTimeout(function() {
    renderAgain(
      isReviewOnlySession()
        ? 'review-empty-cloud'
        : 'normal-empty-ready-for-input'
    );
  }, 500);

  return;
}

      // ─── حالة: السيرفر عنده بيانات ───────────────────────────────────────
      if (localRows > 0 && !sameAttendanceSnapshot(data, activeKeys)) {
        var replace = shouldReplaceLocalAttendance(localRows, remoteRows, meta, activeKeys);
        if (!replace) {
          applyExtractSettingsFromCloud(data);
          normalizeLocalAttendanceForCurrentPeriod(activeKeys);
          setTimeout(function(){ applyExtractSettingsFromCloud(data); normalizeLocalAttendanceForCurrentPeriod(activeKeys); renderAgain('keep-local'); }, 50);
          setTimeout(function(){ applyExtractSettingsFromCloud(data); normalizeLocalAttendanceForCurrentPeriod(activeKeys); renderAgain('keep-local'); }, 500);
          setTimeout(function(){ applyExtractSettingsFromCloud(data); normalizeLocalAttendanceForCurrentPeriod(activeKeys); renderAgain('keep-local'); }, 1500);
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
        console.log('[AttendanceCloudGuard] استرجاع من السحابة: ' + restored + ' مفتاح / ' + restoredRows + ' صف');
        setTimeout(function(){ renderAgain(localRows > 0 ? 'cloud-replaced-local' : 'cloud-restored'); }, 50);
        setTimeout(function(){ renderAgain(localRows > 0 ? 'cloud-replaced-local' : 'cloud-restored'); }, 500);
      }
    } catch (e) { console.warn('[AttendanceCloudGuard] خطأ', e); }
  }

  window.addEventListener('najranCloudPulled', function(){ setTimeout(refreshFromHospitalStorage, 200); setTimeout(refreshFromHospitalStorage, 1200); });
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(refreshFromHospitalStorage, 1200); setTimeout(refreshFromHospitalStorage, 3000); });
})();
