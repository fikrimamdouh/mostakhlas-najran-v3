// ===================================================================
// Extract Archive Route Guard — V1
// Scope: extract-archive.html
// يمنع زر "الحضور" في الأرشيف من فتح attendance.html العادي عندما يكون السياق مكاتب أو مراكز صحية.
// ===================================================================
(function () {
  'use strict';
  if (!/extract-archive\.html|original-viewer\?page=extract-archive\.html/.test(location.pathname + location.search)) return;
  if (window.__NAJRAN_EXTRACT_ARCHIVE_ROUTE_GUARD_V1__) return;
  window.__NAJRAN_EXTRACT_ARCHIVE_ROUTE_GUARD_V1__ = true;

  function readJson(key, fallback) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }
  function clean(v) { return String(v || '').replace(/\s+/g, ' ').trim(); }
  function hasMeaningful(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return false;
      if (raw === '{}' || raw === '[]' || raw === '0') return false;
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.length > 0;
      if (parsed && typeof parsed === 'object') return Object.keys(parsed).length > 0;
      return !!clean(raw);
    } catch (_) {
      return !!clean(localStorage.getItem(key));
    }
  }
  function allowedModules() {
    var s = readJson('najran_session', {});
    if (Array.isArray(s.allowedModules)) return s.allowedModules.map(String);
    try { return JSON.parse(String(s.allowedModules || '[]')).map(String); } catch (_) { return []; }
  }
  function sessionText() {
    var s = readJson('najran_session', {});
    var p = readJson('persistentContractData', {});
    return [s.hospital, s.name, s.role, p.hospitalName, p.contractDetails, localStorage.getItem('hospitalName')].map(clean).join(' | ');
  }
  function includesAny(text, words) {
    text = clean(text);
    return words.some(function (w) { return text.indexOf(w) > -1; });
  }
  function resolveAttendancePage() {
    var mods = allowedModules();
    var txt = sessionText();

    if (
      hasMeaningful('adminOfficesAttendanceData_v1') ||
      hasMeaningful('adminOfficesAttendanceData_v1_localBackup') ||
      hasMeaningful('adminOfficesLaborDataSafe_v2') ||
      hasMeaningful('adminOfficeNames_v1') ||
      mods.indexOf('admin_offices_attendance') > -1 ||
      includesAny(txt, ['المكاتب الإدارية', 'المكاتب الادارية', 'إصلاح السيارات', 'اصلاح السيارات', 'العيادات المتنقلة'])
    ) {
      return '/original/admin_offices_attendance.html';
    }

    if (
      hasMeaningful('healthCentersAttendanceData') ||
      hasMeaningful('centersAttendanceData_v2') ||
      mods.indexOf('health_centers_attendance') > -1 ||
      includesAny(txt, ['المراكز الصحية', 'مراكز صحية'])
    ) {
      return '/original/health_centers_attendance.html';
    }

    return '/original/attendance.html';
  }
  function patchHeaderAttendanceButton() {
    var href = resolveAttendancePage();
    Array.prototype.slice.call(document.querySelectorAll('a.btn-hdr, header a')).forEach(function (a) {
      var text = clean(a.textContent);
      if (text.indexOf('الحضور') === -1) return;
      var oldHref = a.getAttribute('href') || '';
      if (oldHref.indexOf('attendance.html') === -1) return;
      a.setAttribute('href', href);
      a.setAttribute('data-najran-route-guard', '1');
      a.title = 'يفتح صفحة الحضور المناسبة لسياق هذا المستخلص: ' + href;
    });
  }

  window.NajranArchiveRouteGuard = { resolveAttendancePage: resolveAttendancePage, patch: patchHeaderAttendanceButton };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', patchHeaderAttendanceButton); else patchHeaderAttendanceButton();
  setTimeout(patchHeaderAttendanceButton, 400);
  setTimeout(patchHeaderAttendanceButton, 1200);
  document.addEventListener('click', function () { setTimeout(patchHeaderAttendanceButton, 40); }, true);
  console.info('[ExtractArchiveRouteGuard] attendance button route:', resolveAttendancePage());
})();