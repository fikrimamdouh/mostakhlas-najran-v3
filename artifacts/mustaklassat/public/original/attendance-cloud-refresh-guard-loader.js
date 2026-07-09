// attendance-cloud-refresh-guard-loader.js
// Loads the current attendance cloud guard without going through attendance.html's legacy appendChild rewrite.
(function () {
  'use strict';
  if (window.__NAJRAN_ATTENDANCE_CLOUD_REFRESH_LOADER__) return;
  window.__NAJRAN_ATTENDANCE_CLOUD_REFRESH_LOADER__ = true;

  var VERSION = '20260709_auth_fresh_token_v1';
  var url = '/original/attendance-cloud-refresh-guard.js?v=' + VERSION;

  import(url).then(function () {
    try { console.info('[AttendanceCloudGuardLoader] loaded current guard:', VERSION); } catch (_) {}
  }).catch(function (err) {
    console.error('[AttendanceCloudGuardLoader] failed to load current guard', err);
  });
})();
