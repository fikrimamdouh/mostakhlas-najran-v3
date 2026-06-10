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

  function getActiveAttendanceKeys() {
    var q = location.search || '';
    var path = location.pathname || '';
    var full = path + q;

    if (/admin_offices_attendance\.html/.test(full)) return ['adminOfficesAttendanceData_v1'];
    if (/health_centers_attendance\.html/.test(full)) return ['healthCentersAttendanceData'];
    if (/najran_general/.test(full)) return ['ng_attendanceData'];
    if (/dental/.test(full)) return ['nd_attendanceData'];

    return ['attendanceData'];
  }

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
function isReviewOnlySession() {
  var s = getSession();
  return !!(s && s.reviewOnly === true);
}

function getHospitalStorageUrl() {
  var s = getSession();
  var url = '/api/hospital-storage';

  if (s && s.reviewOnly === true && s.hospital) {
    url += '?hospital=' + encodeURIComponent(String(s.hospital).trim());
  }

  return url;
}
  function parse(v) {
    if (!v) return null;
    if (typeof v === 'object') return v;
    try { return JSON.parse(v); } catch (_) { return null; }
  }
function normalizeKey(key) {
  return String(key || '').replace(/^(_u\d+_)+/, '');
}

function normalizeRemoteDataKeys(data) {
  var out = {};
  data = data || {};

  Object.keys(data).forEach(function (key) {
    var nk = normalizeKey(key);
    if (!nk) return;

    // لو المفتاح الطبيعي غير موجود، خده
    if (out[nk] == null) {
      out[nk] = data[key];
      return;
    }

    // لو موجود بالفعل، اختار النسخة ذات محتوى أكبر
    if (countRows(data[key]) > countRows(out[nk])) {
      out[nk] = data[key];
    }
  });

  return out;
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

  function localAttendanceRows(keys) {
    var total = 0;
    (keys || getActiveAttendanceKeys()).forEach(function (k) { total += countRows(localStorage.getItem(k)); });
    return total;
  }

  function remoteAttendanceRows(data, keys) {
    var total = 0;
    (keys || getActiveAttendanceKeys()).forEach(function (k) {
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

  function sameAttendanceSnapshot(data, keys) {
    try {
      return (keys || getActiveAttendanceKeys()).every(function (k) {
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

  function shouldReplaceLocalAttendance(localRows, remoteRows, meta, keys) {
    var msg =
      'يوجد اختلاف بين بيانات الحضور المحلية والنسخة السحابية لهذه المستشفى.\n\n' +
      'المفاتيح التي تتم مقارنتها: ' + (keys || []).join(', ') + '\n' +
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
    var activeKeys = getActiveAttendanceKeys();
    var localRows = localAttendanceRows(activeKeys);

    var token = await getToken();
    if (!token) {
      console.warn('[AttendanceCloudGuard] لا يوجد توكن صالح لفحص hospital_storage');
      return;
    }

    try {
var res = await fetch(getHospitalStorageUrl(), {
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        credentials: 'include'
      });
      if (!res.ok) {
        console.warn('[AttendanceCloudGuard] فشل طلب hospital_storage: ' + res.status);
        return;
      }
      var json = await res.json();
var rawData = json && json.data ? json.data : {};
var data = normalizeRemoteDataKeys(rawData);
var remoteRows = remoteAttendanceRows(data, activeKeys);

console.log(
  '[AttendanceCloudGuard] مفاتيح حضور موجودة بعد التطبيع:',
  Object.keys(data).filter(function(k) {
    return k.toLowerCase().indexOf('attendance') >= 0;
  })
);
      var meta = getRemoteMeta(data);

  if (remoteRows <= 0) {
  if (isReviewOnlySession()) {
    activeKeys.forEach(function (k) {
      localStorage.removeItem(k);
    });

    console.warn(
      '[AttendanceCloudGuard] REVIEW ONLY: لا توجد نسخة حضور سحابية لهذه المستشفى — تم تفريغ الحضور المحلي لمنع عرض بيانات مستشفى أخرى — keys=' +
      activeKeys.join(',')
    );

    setTimeout(function () { renderAgain('review-empty-cloud'); }, 50);
    setTimeout(function () { renderAgain('review-empty-cloud'); }, 500);
    return;
  }

  if (localRows > 0) {
    console.log('[AttendanceCloudGuard] لا توجد نسخة سحابية للحضور، تم الاحتفاظ بالنسخة المحلية: ' + localRows + ' صف — keys=' + activeKeys.join(','));
    setTimeout(function () { renderAgain('local-existing-no-cloud'); }, 50);
    setTimeout(function () { renderAgain('local-existing-no-cloud'); }, 500);
  } else {
    console.warn('[AttendanceCloudGuard] لم يتم العثور على attendanceData ذات محتوى في hospital_storage لهذه الصفحة — keys=' + activeKeys.join(','));
  }
  return;
}

      if (localRows > 0 && !sameAttendanceSnapshot(data, activeKeys)) {
        var replace = shouldReplaceLocalAttendance(localRows, remoteRows, meta, activeKeys);
        if (!replace) {
          console.log('[AttendanceCloudGuard] احتفظ المستخدم بالنسخة المحلية ولم يستبدلها بالسحابية');
          setTimeout(function () { renderAgain('keep-local'); }, 50);
          setTimeout(function () { renderAgain('keep-local'); }, 500);
          return;
        }
      }

      var restored = 0;
      var restoredRows = 0;

      activeKeys.forEach(function (k) {
        var val = data[k];
        var rows = countRows(val);
        if (val == null || rows <= 0) return;
        localStorage.setItem(k, typeof val === 'string' ? val : JSON.stringify(val));
        restored++;
        restoredRows += rows;
      });

      if (restored > 0) {
        console.log('[AttendanceCloudGuard] تم استرجاع/استبدال بيانات الحضور من hospital_storage: ' + restored + ' مفتاح / ' + restoredRows + ' صف — keys=' + activeKeys.join(','));
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
