(function () {
  'use strict';

  var sig = location.pathname + location.search;
  var isAttendancePage = /attendance\.html(?:$|[?#])/.test(sig) || /[?&]page=.*attendance\.html(?:$|&)/.test(sig);
  if (!isAttendancePage) return;

  var ATTENDANCE_KEYS = [
    'attendanceData',
    'ng_attendanceData',
    'nd_attendanceData',
    'centersAttendanceData_v2',
    'healthCentersAttendanceData',
    'adminOfficesAttendanceData_v1'
  ];

  console.log('[AttendanceCloudGuard] جاهز لفحص الحضور');

  function getSession() {
    try { return JSON.parse(localStorage.getItem('najran_session') || '{}') || {}; }
    catch (_) { return {}; }
  }

  async function getToken() {
    try {
      if (typeof window.najranGetFreshToken === 'function') {
        var t = await window.najranGetFreshToken();
        if (t) return t;
      }
      if (window.parent && window.parent !== window && typeof window.parent.najranGetFreshToken === 'function') {
        var pt = await window.parent.najranGetFreshToken();
        if (pt) return pt;
      }
    } catch (_) {}
    var s = getSession();
    return s.clerkToken || '';
  }

  function parse(v) {
    if (!v) return null;
    if (typeof v === 'object') return v;
    try { return JSON.parse(v); } catch (_) { return null; }
  }

  function countRows(obj) {
    var v = parse(obj);
    if (!v) return 0;
    if (Array.isArray(v)) return v.length;
    if (typeof v === 'object') {
      var total = 0;
      Object.keys(v).forEach(function (k) {
        var x = v[k];
        if (Array.isArray(x)) total += x.length;
        else if (x && typeof x === 'object') total += countRows(x);
      });
      return total;
    }
    return 0;
  }

  function localAttendanceRows() {
    var total = 0;
    ATTENDANCE_KEYS.forEach(function (k) { total += countRows(localStorage.getItem(k)); });
    return total;
  }

  function renderAgain(reason) {
    try { if (typeof window.updateContractDisplayData === 'function') window.updateContractDisplayData(); } catch (_) {}
    try { if (typeof window.rebuildTableHeaders === 'function') window.rebuildTableHeaders(); } catch (_) {}
    try { if (typeof window.renderTables === 'function') window.renderTables(); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('najranAttendanceCloudRestored', { detail: { reason: reason || '' } })); } catch (_) {}
  }

  async function refreshFromHospitalStorage() {
    var localRows = localAttendanceRows();
    if (localRows > 0) {
      console.log('[AttendanceCloudGuard] بيانات الحضور موجودة محلياً: ' + localRows + ' صف — إعادة رسم فقط');
      setTimeout(function () { renderAgain('local-existing'); }, 50);
      setTimeout(function () { renderAgain('local-existing'); }, 500);
      return;
    }

    var token = await getToken();
    if (!token) {
      console.warn('[AttendanceCloudGuard] لا يوجد توكن صالح لفحص hospital_storage');
      return;
    }

    try {
      var res = await fetch('/api/hospital-storage', {
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        credentials: 'include'
      });
      if (!res.ok) {
        console.warn('[AttendanceCloudGuard] فشل طلب hospital_storage: ' + res.status);
        return;
      }
      var json = await res.json();
      var data = json && json.data ? json.data : {};
      var restored = 0;
      var restoredRows = 0;

      ATTENDANCE_KEYS.forEach(function (k) {
        var val = data[k];
        var rows = countRows(val);
        if (val == null || rows <= 0) return;
        localStorage.setItem(k, typeof val === 'string' ? val : JSON.stringify(val));
        restored++;
        restoredRows += rows;
      });

      if (restored > 0) {
        console.log('[AttendanceCloudGuard] تم استرجاع بيانات الحضور من hospital_storage: ' + restored + ' مفتاح / ' + restoredRows + ' صف');
        setTimeout(function () { renderAgain('cloud-restored'); }, 50);
        setTimeout(function () { renderAgain('cloud-restored'); }, 500);
      } else {
        console.warn('[AttendanceCloudGuard] لم يتم العثور على attendanceData ذات محتوى في hospital_storage لهذه المستشفى');
      }
    } catch (e) {
      console.warn('[AttendanceCloudGuard] فشل فحص بيانات الحضور السحابية', e);
    }
  }

  window.addEventListener('najranCloudPulled', function () {
    setTimeout(refreshFromHospitalStorage, 200);
    setTimeout(refreshFromHospitalStorage, 1200);
  });

  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(refreshFromHospitalStorage, 1200);
    setTimeout(refreshFromHospitalStorage, 3000);
  });
})();