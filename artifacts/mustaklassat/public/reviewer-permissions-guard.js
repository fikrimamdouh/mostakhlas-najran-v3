/* reviewer-permissions-guard.js — reviewer mode disabled system-wide */
(function () {
  'use strict';
  if (window.__NAJRAN_REVIEWER_MODE_DISABLED_V1__) return;
  window.__NAJRAN_REVIEWER_MODE_DISABLED_V1__ = true;

  function sanitizeSession() {
    try {
      var raw = localStorage.getItem('najran_session');
      if (!raw) return false;
      var session = JSON.parse(raw);
      if (!session || typeof session !== 'object') return false;

      var changed = false;
      var role = String(session.role || 'user').toLowerCase();
      var editableRole = role !== 'viewer';

      if (session.reviewOnly !== false) { session.reviewOnly = false; changed = true; }
      if (session.canReviewCurrentHospital !== false) { session.canReviewCurrentHospital = false; changed = true; }
      if (editableRole && session.canEditCurrentHospital !== true) { session.canEditCurrentHospital = true; changed = true; }
      if (Object.prototype.hasOwnProperty.call(session, 'reviewActiveHospital')) { delete session.reviewActiveHospital; changed = true; }
      if (Object.prototype.hasOwnProperty.call(session, 'reviewHospitals')) { delete session.reviewHospitals; changed = true; }

      if (Array.isArray(session.permissions) && session.permissions.indexOf('review_extract') !== -1) {
        session.permissions = session.permissions.filter(function (permission) {
          return String(permission) !== 'review_extract';
        });
        changed = true;
      }

      if (!changed) return false;
      session.timestamp = Date.now();
      Storage.prototype.setItem.call(localStorage, 'najran_session', JSON.stringify(session));
      return true;
    } catch (_) {
      return false;
    }
  }

  window.__najranDisableReviewerMode = sanitizeSession;
  sanitizeSession();
  window.addEventListener('storage', function (event) {
    if (event && event.key === 'najran_session') sanitizeSession();
  });
  window.addEventListener('pageshow', sanitizeSession);

  console.info('[NajranReview] reviewer mode disabled; stale review flags sanitized');
})();
