// Empty Local-first Pull Guard V1
// Pulls cloud data once when a user opens an operational page with no local work.
(function () {
  'use strict';

  if (window.__EMPTY_LOCAL_FIRST_PULL_GUARD_V1__) return;
  window.__EMPTY_LOCAL_FIRST_PULL_GUARD_V1__ = true;

  function pageFile() {
    return (location.pathname || '').split('/').pop() || '';
  }

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function countValue(value) {
    if (value == null) return 0;
    try {
      if (typeof value === 'string') value = JSON.parse(value);
    } catch (_) {
      return String(value || '').trim() ? 1 : 0;
    }
    if (Array.isArray(value)) return value.length;
    if (typeof value === 'object') return Object.keys(value).length;
    return value ? 1 : 0;
  }

  function hasLocalWork() {
    var keys = [
      'attendanceData',
      'ng_attendanceData',
      'nd_attendanceData',
      'persistentAttendanceData',
      'performanceData',
      'performanceData_v4',
      'achievementData',
      'consumablesTableData',
      'mainHospitalConsumables',
      'healthCentersConsumables',
      'admin_offices_consumables_v1.0',
      'spare_partsData'
    ];
    for (var i = 0; i < keys.length; i++) {
      if (countValue(localStorage.getItem(keys[i])) > 0) return true;
    }
    return false;
  }

  function sessionKey() {
    var s = readJson('najran_session', {});
    return 'emptyLocalFirstPulled_v1__' + encodeURIComponent(String((s && s.hospital) || 'personal')) + '__' + pageFile();
  }

  function isReviewOnly() {
    var s = readJson('najran_session', {});
    return !!(s && s.reviewOnly === true);
  }

  function isOperationalLocalPage() {
    var p = pageFile();
    return p && p !== 'settings_main.html' && p !== 'hospital_raise_letters.html' && p !== 'extract-archive.html' && p !== 'review_extract.html';
  }

  function run() {
    if (!isOperationalLocalPage()) return;
    if (isReviewOnly()) return;
    if (localStorage.getItem('najran_revision_mode') === 'true') return;
    if (hasLocalWork()) return;
    var key = sessionKey();
    if (localStorage.getItem(key) === 'done') return;
    if (typeof window.najranPullFromCloud !== 'function') return;

    localStorage.setItem(key, 'done');
    console.warn('[EmptyLocalFirstPullGuard] no local work found — pulling cloud data once');
    Promise.resolve(window.najranPullFromCloud()).then(function () {
      console.warn('[EmptyLocalFirstPullGuard] cloud pull finished — reloading page');
      location.reload();
    }).catch(function (err) {
      localStorage.removeItem(key);
      console.error('[EmptyLocalFirstPullGuard] cloud pull failed', err);
    });
  }

  setTimeout(run, 1200);
  setTimeout(run, 3000);
})();
