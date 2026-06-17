/**
 * shared-nav.js
 * الشريط العلوي القديم معطل.
 * التصحيح الفعلي هنا: عزل تواقيع المكاتب الإدارية لكل مكتب/مرفق.
 */
(function () {
  'use strict';

  function isAdminOfficesAttendancePage() {
    return /admin_offices_attendance\.html(?:$|[?#])/.test(location.href);
  }

  function getOfficeName(contextKey) {
    try {
      if (typeof window.getCenterNames === 'function') {
        return window.getCenterNames()[contextKey] || contextKey;
      }
      const names = JSON.parse(localStorage.getItem('adminOfficeNames_v1') || '{}');
      return names[contextKey] || contextKey;
    } catch (_) {
      return contextKey;
    }
  }

  function installAdminOfficeSignatureIsolation() {
    if (!isAdminOfficesAttendancePage()) return;

    window.getSignatureKeyForContext = function(type, contextKey) {
      if (contextKey === 'grand_certificate') return type + '_grand_certificate';
      if (contextKey) return type + '_' + contextKey;
      return type + '_general_admin_offices_only';
    };

    window.getSignatureDialogTitle = function(type, contextKey) {
      if (contextKey === 'grand_certificate') return 'تواقيع الشهادة الإجمالية';
      if (contextKey) return 'تواقيع: ' + getOfficeName(contextKey);
      return 'تواقيع عامة للمكاتب';
    };

    window.__ADMIN_OFFICES_SIGNATURES_ISOLATED__ = true;
    console.log('[AdminOffices] Signatures isolated per office/center');
  }

  installAdminOfficeSignatureIsolation();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installAdminOfficeSignatureIsolation);
  }
})();
