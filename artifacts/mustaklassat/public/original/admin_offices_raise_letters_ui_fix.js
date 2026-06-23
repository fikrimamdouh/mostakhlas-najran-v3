// ===================================================================
// Admin Offices Raise Letters UI Fix
// Disabled intentionally.
// The main admin_offices_raise_letters.js now owns the dialog, signatures,
// site letters, and print layout directly.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;
  console.info('[Admin Offices Raise Letters UI Fix] disabled — main raise letters UI is authoritative');
})();