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

  function remoteAttendanceRows(data) {
    var total = 0;
    ATTENDANCE_KEYS.forEach(function (k) {
      total += countRows(data && data[k]);
    });
    return total;
  }

  function getRemoteMeta(data) {
    try {
      var activity = data && data.hospitalActivityStatus ? parse(data.hospitalActivityStatus) : null;
      return {
        userName: activity && activity.userName ? activity.userName : 'مستخدم آخر',
        updatedAt: activity && activity.updatedAt ? activity.updatedAt : '',
        page: activity && activity.page ? activity.page : '',
        pageFile: activity && activity.pageFile ? activity.pageFile : ''
      };
    } catch (_) {
      return { userName: 'مستخدم آخر', updatedAt: '', page: '', pageFile: '' };
    }
  }

  function sameAttendanceSnapshot(data) {
    try {
      return ATTENDANCE_KEYS.every(function (k) {
        var localVal = localStorage.getItem(k) || '';
        var remoteVal = data && data[k] != null ? (typeof data[k] === 'string' ? data[k] : JSON.stringify(data[k])) : '';
        return localVal === remoteVal;
      });
    } catch (_) {
      return false;
    }
  }

  function formatDateTime(value) {
    if (!value) return '';
    try {
      return new Date(value).toLocaleString('ar-SA', { hour12: true });
    } catch (_) {
      return String(value);
    }
  }

  function shouldReplaceLocalAttendance(localRows, remoteRows, meta) {
    var msg =
      'يوجد اختلاف بين بيانات الحضور المحلية والنسخة السحابية لهذه المستشفى.\n\n' +
      'البيانات المحلية عندك: ' + localRows + ' صف\n' +
      'النسخة السحابية: ' + remoteRows + ' صف\n' +
      'آخر تعديل بواسطة: ' + (meta.userName || 'مستخدم آخر') + '\n' +
      (meta.page ? ('الصفحة: ' + meta.page + '\n') : '') +
      (meta.updatedAt ? ('وقت التعديل: ' + formatDateTime(meta.updatedAt) + '\n') : '') +
      '\nهل تريد استبدال النسخة المحلية بالنسخة السحابية؟\n\n' +
      'موافق = استبدال المحلي بالسحابي\n' +
      'إلغاء = الاحتفاظ بالنسخة المحلية';

    return confirm(msg);
  }

  function renderAgain(reason) {
    try { if (typeof window.updateContractDisplayData === 'function') window.updateContractDisplayData(); } catch (_) {}
    try { if (typeof window.rebuildTableHeaders === 'function') window.rebuildTableHeaders(); } catch (_) {}
    try { if (typeof window.renderTables === 'function') window.renderTables(); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('najranAttendanceCloudRestored', { detail: { reason: reason || '' } })); } catch (_) {}
  }

  async function refreshFromHospitalStorage() {
    var localRows = localAttendanceRows();

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
      var remoteRows = remoteAttendanceRows(data);
      var meta = getRemoteMeta(data);

      if (remoteRows <= 0) {
        if (localRows > 0) {
          console.log('[AttendanceCloudGuard] لا توجد نسخة سحابية للحضور، تم الاحتفاظ بالنسخة المحلية: ' + localRows + ' صف');
          setTimeout(function () { renderAgain('local-existing-no-cloud'); }, 50);
          setTimeout(function () { renderAgain('local-existing-no-cloud'); }, 500);
        } else {
          console.warn('[AttendanceCloudGuard] لم يتم العثور على attendanceData ذات محتوى في hospital_storage لهذه المستشفى');
        }
        return;
      }

      if (localRows > 0 && !sameAttendanceSnapshot(data)) {
        var replace = shouldReplaceLocalAttendance(localRows, remoteRows, meta);
        if (!replace) {
          console.log('[AttendanceCloudGuard] احتفظ المستخدم بالنسخة المحلية ولم يستبدلها بالسحابية');
          setTimeout(function () { renderAgain('keep-local'); }, 50);
          setTimeout(function () { renderAgain('keep-local'); }, 500);
          return;
        }
      }

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
        console.log('[AttendanceCloudGuard] تم استرجاع/استبدال بيانات الحضور من hospital_storage: ' + restored + ' مفتاح / ' + restoredRows + ' صف');
        setTimeout(function () { renderAgain(localRows > 0 ? 'cloud-replaced-local' : 'cloud-restored'); }, 50);
        setTimeout(function () { renderAgain(localRows > 0 ? 'cloud-replaced-local' : 'cloud-restored'); }, 500);
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