(function () {
  'use strict';

  var page = location.pathname.split('/').pop() || '';
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

  function localHasMeaningfulAttendance() {
    return ATTENDANCE_KEYS.some(function (k) { return countRows(localStorage.getItem(k)) > 0; });
  }

  function renderAgain() {
    try { if (typeof window.updateContractDisplayData === 'function') window.updateContractDisplayData(); } catch (_) {}
    try { if (typeof window.rebuildTableHeaders === 'function') window.rebuildTableHeaders(); } catch (_) {}
    try { if (typeof window.renderTables === 'function') window.renderTables(); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('najranAttendanceCloudRestored')); } catch (_) {}
  }

  async function refreshFromHospitalStorage() {
    if (localHasMeaningfulAttendance()) return;

    var token = await getToken();
    if (!token) return;

    try {
      var res = await fetch('/api/hospital-storage', {
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        credentials: 'include'
      });
      if (!res.ok) return;
      var json = await res.json();
      var data = json && json.data ? json.data : {};
      var restored = 0;

      ATTENDANCE_KEYS.forEach(function (k) {
        var val = data[k];
        if (val == null) return;
        if (countRows(val) <= 0) return;
        localStorage.setItem(k, typeof val === 'string' ? val : JSON.stringify(val));
        restored++;
      });

      if (restored > 0) {
        console.log('[AttendanceCloudGuard] تم استرجاع بيانات الحضور من hospital_storage: ' + restored + ' مفتاح');
        setTimeout(renderAgain, 50);
        setTimeout(renderAgain, 500);
      } else {
        console.warn('[AttendanceCloudGuard] لم يتم العثور على attendanceData ذات محتوى في hospital_storage لهذه المستشفى');
      }
    } catch (e) {
      console.warn('[AttendanceCloudGuard] فشل فحص بيانات الحضور السحابية', e);
    }
  }

  window.addEventListener('najranCloudPulled', function () {
    setTimeout(refreshFromHospitalStorage, 200);
  });

  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(refreshFromHospitalStorage, 1200);
    setTimeout(refreshFromHospitalStorage, 3000);
  });
})();