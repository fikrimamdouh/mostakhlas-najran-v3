/**
 * track.js loader — preserves the production tracker/admin patches and adds
 * the isolated attendance pre-approval audit guard.
 */
(function () {
  'use strict';
  var legacy = '/original/track_legacy_20260710.js?v=20260710_preapproval_audit_v1';
  var auditGuard = '/original/attendance_preapproval_audit_guard_v1.js?v=20260710_preapproval_audit_v1';

  function appendScript(src, done) {
    var script = document.createElement('script');
    script.src = src;
    script.async = false;
    if (typeof done === 'function') {
      script.onload = done;
      script.onerror = done;
    }
    (document.head || document.documentElement).appendChild(script);
  }

  if (document.readyState === 'loading') {
    document.write('<script src="' + legacy + '"><\/script>');
    document.write('<script src="' + auditGuard + '"><\/script>');
  } else {
    appendScript(legacy, function () { appendScript(auditGuard); });
  }
})();
