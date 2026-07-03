// ===================================================================
// Admin Offices Page Signatures — controls separated
// Scope: admin_offices_attendance.html only
//
// - يضيف زرًا مستقلًا لتوقيع الشهادة الإجمالية أعلى الصفحة.
// - لا يدمج الشهادة الإجمالية مع توحيد تواقيع المكاتب.
// - يمنع ظهور تعديل/إضافة التواقيع أسفل صفحات المكاتب.
// - يترك getSignatures/signatureKey متاحة للطباعة والمنطق الداخلي.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_PAGE_SIGNATURES_CONTROLS_SEPARATED_V5__) return;
  window.__ADMIN_OFFICES_PAGE_SIGNATURES_CONTROLS_SEPARATED_V5__ = true;

  var GRAND_KEY = 'admin_offices_grand_certificate';
  var GRAND_BTN_ID = 'admin-offices-grand-certificate-signature-btn';

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
    return keys[0] || 'general';
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

  function removeOfficePageSignatureControls() {
    var selectors = [
      '.admin-page-signature-bar',
      '#sb-container-admin_offices',
      '.admin-page-signature-block .sb-empty',
      '[id^="attendance-signatures-"] .sb-empty',
      '[id^="perf-signatures-"] .sb-empty',
      '[id^="ach-signatures-"] .sb-empty'
    ];
    document.querySelectorAll(selectors.join(',')).forEach(function (el) {
      try { el.remove(); } catch (_) {}
    });

    document.querySelectorAll('button').forEach(function (btn) {
      if (btn.id === GRAND_BTN_ID) return;
      var text = String(btn.textContent || '').replace(/\s+/g, ' ').trim();
      var inOfficeSignatureArea = !!btn.closest('[id^="attendance-signatures-"], [id^="perf-signatures-"], [id^="ach-signatures-"], .admin-page-signature-block, #sb-container-admin_offices');
      if (inOfficeSignatureArea && /تعديل التواقيع|إضافة توقيع|نسخ للمكاتب/.test(text)) {
        try { btn.remove(); } catch (_) {}
      }
    });
  }

  function clearOfficeSignatureContainer(type, centerKey) {
    var t = normalizeType(type);
    var c = cleanCenterKey(centerKey) || currentCenterKey();
    var ids = [
      'attendance-signatures-' + c,
      'perf-signatures-' + c,
      'ach-signatures-' + c
    ];
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.innerHTML = '';
    });
    removeOfficePageSignatureControls();
  }

  function renderSeparatedSignatures(type, centerKey) {
    // لا نعرض أي محرر/رسالة إضافة تحت صفحات المكاتب.
    // التعديل والإضافة من الزر العلوي فقط.
    clearOfficeSignatureContainer(type, centerKey);
  }

  function openGrandSignatureDialog() {
    if (!window.SignatureBlock || typeof window.SignatureBlock.open !== 'function') {
      alert('نظام التواقيع لم يكتمل تحميله بعد. أعد تحميل الصفحة.');
      return;
    }
    window.SignatureBlock.open(GRAND_KEY);
  }

  function ensureGrandButton(attempt) {
    var bar = document.getElementById('main-action-buttons');
    if (!bar) {
      if ((attempt || 0) < 20) setTimeout(function () { ensureGrandButton((attempt || 0) + 1); }, 500);
      return;
    }

    if (document.getElementById(GRAND_BTN_ID)) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = GRAND_BTN_ID;
    btn.className = 'ab ab-titles';
    btn.innerHTML = '<i class="fas fa-signature"></i> توقيع الشهادة الإجمالية';
    btn.onclick = openGrandSignatureDialog;

    var certBtn = Array.prototype.slice.call(bar.querySelectorAll('button')).find(function (b) {
      return String(b.textContent || '').indexOf('الشهادة الإجمالية') > -1 && b.id !== GRAND_BTN_ID;
    });
    if (certBtn && certBtn.nextSibling) bar.insertBefore(btn, certBtn.nextSibling);
    else bar.appendChild(btn);
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
    refresh: function () { removeOfficePageSignatureControls(); },
    openGrand: openGrandSignatureDialog
  };

  function boot(attempt) {
    ensureGrandButton(attempt || 0);
    removeOfficePageSignatureControls();
    if ((attempt || 0) < 20) setTimeout(function () { boot((attempt || 0) + 1); }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { boot(0); });
  } else {
    boot(0);
  }
  try {
    new MutationObserver(removeOfficePageSignatureControls).observe(document.body || document.documentElement, { childList: true, subtree: true });
  } catch (_) {}

  console.info('[Admin Offices Signatures] grand certificate button separated; office-page signature prompts removed v5');
})();