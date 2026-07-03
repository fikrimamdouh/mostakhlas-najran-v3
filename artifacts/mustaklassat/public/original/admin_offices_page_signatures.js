// ===================================================================
// Admin Offices Page Signatures — disabled inline controls
// Scope: admin_offices_attendance.html only
//
// هذا الملف كان يحقن زرين في نهاية تبويبات الحضور/الأداء/الإنجاز:
// - تعديل التواقيع
// - نسخ للمكاتب
// تم إيقاف حقن هذه الأزرار من المصدر بناءً على طلب المستخدم.
// زر التوقيع الوحيد يكون أعلى الصفحة من admin_offices_signatures_unify_v1.js.
// لا يتدخل هذا الملف في الشهادة الإجمالية.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_PAGE_SIGNATURES_INLINE_DISABLED__) return;
  window.__ADMIN_OFFICES_PAGE_SIGNATURES_INLINE_DISABLED__ = true;

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function getNames() {
    try {
      if (typeof window.getCenterNames === 'function') return window.getCenterNames() || {};
    } catch (_) {}
    return readJson('adminOfficeNames_v1', {});
  }

  function cleanCenterKey(value) {
    return String(value || '')
      .replace(/^attendance-signatures-/, '')
      .replace(/^perf-signatures-/, '')
      .replace(/^performance-signatures-/, '')
      .replace(/^ach-signatures-/, '')
      .replace(/^achievement-signatures-/, '')
      .replace(/^table-div-/, '')
      .replace(/^table-/, '')
      .trim();
  }

  function currentCenterKey() {
    var active = document.querySelector('.tab-link.active[data-center-key]');
    if (active && active.dataset.centerKey) return active.dataset.centerKey;

    try {
      if (window.activeCenterKeyForManagement) return window.activeCenterKeyForManagement;
    } catch (_) {}

    var titleEl = document.getElementById('center-main-title');
    var title = titleEl ? titleEl.textContent || '' : '';
    var names = getNames();
    var keys = Object.keys(names || {});
    for (var i = 0; i < keys.length; i++) {
      if (names[keys[i]] && title.indexOf(names[keys[i]]) > -1) return keys[i];
    }
    if (title.indexOf('الورش') > -1) return 'admin_staff';
    return 'general';
  }

  function normalizeType(type) {
    var t = String(type || 'attendance');
    if (t.indexOf('performance') > -1) return 'performance';
    if (t.indexOf('achievement') > -1) return 'achievement';
    return 'attendance';
  }

  function signatureKey(type, centerKey) {
    var t = normalizeType(type);
    var c = cleanCenterKey(centerKey) || currentCenterKey() || 'general';
    return 'admin_offices_' + c + '_' + t;
  }

  function removeInlineSignatureBars() {
    var selectors = [
      '.admin-page-signature-bar',
      '#edit-grand-certificate-signatures-btn',
      '#grand-certificate-signatures-btn',
      '#sb-container-admin_offices'
    ];
    document.querySelectorAll(selectors.join(',')).forEach(function (el) {
      try { el.remove(); } catch (_) {}
    });
  }

  function ensureSignatureContainer(type, centerKey) {
    var t = normalizeType(type);
    var c = cleanCenterKey(centerKey) || currentCenterKey();
    var id = t === 'performance' ? 'perf-signatures-' + c : t === 'achievement' ? 'ach-signatures-' + c : 'attendance-signatures-' + c;
    var el = document.getElementById(id);
    if (!el && t === 'attendance') {
      var tab = document.getElementById('attendance-tab');
      if (!tab) return null;
      el = document.createElement('div');
      el.id = id;
      el.className = 'signatures-display-section attendance-signatures-display-section';
      tab.appendChild(el);
    }
    return el;
  }

  function renderSeparatedSignatures(type, centerKey) {
    removeInlineSignatureBars();
    if (!window.SignatureBlock || typeof window.SignatureBlock.init !== 'function') return;
    var key = signatureKey(type, centerKey);
    var target = ensureSignatureContainer(type, centerKey);
    if (!target) return;
    target.innerHTML = '<div class="admin-page-signature-block" data-admin-signature-key="' + key + '"><div id="sb-container-' + key + '" data-sb-page="' + key + '"></div></div>';
    try { window.SignatureBlock.init(key, { showStamp: true }); } catch (_) {}
    try { if (window.SignatureBlock.rerender) window.SignatureBlock.rerender(key); } catch (_) {}
    removeInlineSignatureBars();
  }

  window.displaySignatures = function (type, centerKey) {
    renderSeparatedSignatures(type, centerKey);
  };

  window.openSignatureDialog = function (type, centerKey) {
    if (!window.SignatureBlock || typeof window.SignatureBlock.open !== 'function') {
      alert('نظام التواقيع لم يكتمل تحميله بعد. أعد تحميل الصفحة.');
      return;
    }
    window.SignatureBlock.open(signatureKey(type, centerKey || currentCenterKey()));
  };

  window.getSignatures = function (type, centerKey) {
    try {
      return window.SignatureBlock.getSigs(signatureKey(type, centerKey || currentCenterKey())) || [];
    } catch (_) {
      return [];
    }
  };

  window.AdminOfficesPageSignatures = {
    signatureKey: signatureKey,
    currentCenterKey: currentCenterKey,
    refresh: function () { removeInlineSignatureBars(); }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', removeInlineSignatureBars);
  } else {
    removeInlineSignatureBars();
  }
  try {
    new MutationObserver(removeInlineSignatureBars).observe(document.body || document.documentElement, { childList: true, subtree: true });
  } catch (_) {}

  console.info('[Admin Offices Signatures] inline signature buttons removed from source');
})();