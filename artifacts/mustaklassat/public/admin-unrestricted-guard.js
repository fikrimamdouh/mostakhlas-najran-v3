/* admin-unrestricted-guard.js
 * يزيل قيود reviewOnly عن حسابات الأدمن فقط.
 * لا يؤثر على المستخدم أو المراجع العادي.
 */
(function () {
  'use strict';
  if (window.__NAJRAN_ADMIN_UNRESTRICTED_GUARD__) return;
  window.__NAJRAN_ADMIN_UNRESTRICTED_GUARD__ = true;

  var SESSION_KEY = 'najran_session';

  function readSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || '{}'); } catch (_) { return {}; }
  }

  function writeSession(s) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(s || {})); } catch (_) {}
  }

  function isAdminRole(role) {
    role = String(role || '').toLowerCase();
    return role === 'admin' || role === 'super_admin' || role === 'administrator' || role === 'supervisor';
  }

  function isAdminSession() {
    var s = readSession();
    return !!(s && isAdminRole(s.role));
  }

  function sanitizeAdminSession(reason) {
    var s = readSession();
    if (!s || !isAdminRole(s.role)) return false;
    var changed = false;

    if (s.reviewOnly === true) { s.reviewOnly = false; changed = true; }
    if (s.canEditCurrentHospital !== true) { s.canEditCurrentHospital = true; changed = true; }
    if (s.canReviewCurrentHospital === true) { s.canReviewCurrentHospital = false; changed = true; }
    if (s.reviewActiveHospital) { delete s.reviewActiveHospital; changed = true; }

    if (Array.isArray(s.permissions) && s.permissions.indexOf('review_extract') > -1) {
      s.permissions = s.permissions.filter(function (p) { return p !== 'review_extract'; });
      changed = true;
    }

    if (changed) {
      s.timestamp = Date.now();
      writeSession(s);
      try { console.info('[AdminUnrestricted] admin review restrictions removed:', reason || 'tick'); } catch (_) {}
    }
    return changed;
  }

  function extractReviewHospitalFromButton(btn) {
    try {
      var txt = String(btn.textContent || '')
        .replace(/✓/g, '')
        .replace(/○/g, '')
        .replace(/مراجعة فقط/g, '')
        .replace(/—/g, '')
        .trim();
      return txt;
    } catch (_) { return ''; }
  }

  document.addEventListener('click', function (ev) {
    try {
      if (!isAdminSession()) return;
      var el = ev.target;
      for (var i = 0; i < 5 && el && el !== document.body; i++, el = el.parentNode) {
        if (!el || !el.textContent) continue;
        var text = String(el.textContent || '');
        if (text.indexOf('مراجعة فقط') === -1) continue;
        var h = extractReviewHospitalFromButton(el);
        if (!h) return;

        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation && ev.stopImmediatePropagation();

        var s = readSession();
        s.hospital = h;
        s.reviewOnly = false;
        s.canReviewCurrentHospital = false;
        s.canEditCurrentHospital = true;
        delete s.reviewActiveHospital;
        s.timestamp = Date.now();
        writeSession(s);
        try { localStorage.setItem('hospitalName', h); } catch (_) {}
        try { localStorage.setItem('najran_active_hospital_context', h); } catch (_) {}
        try { window.dispatchEvent(new CustomEvent('najranHospitalChanged', { detail: { hospital: h, reviewOnly: false, adminUnrestricted: true } })); } catch (_) {}
        setTimeout(function () { location.reload(); }, 60);
        return;
      }
    } catch (_) {}
  }, true);

  sanitizeAdminSession('boot');
  window.addEventListener('focus', function () { sanitizeAdminSession('focus'); });
  window.addEventListener('storage', function () { sanitizeAdminSession('storage'); });
  setInterval(function () { sanitizeAdminSession('interval'); }, 1200);

  window.__najranAdminUnrestrictedStatus = function () {
    var s = readSession();
    return {
      installed: true,
      admin: isAdminRole(s.role),
      role: s.role || null,
      hospital: s.hospital || null,
      reviewOnly: !!s.reviewOnly,
      canEditCurrentHospital: !!s.canEditCurrentHospital,
      canReviewCurrentHospital: !!s.canReviewCurrentHospital,
      reviewActiveHospital: s.reviewActiveHospital || null
    };
  };
})();
