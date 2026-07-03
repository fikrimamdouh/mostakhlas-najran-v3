// ===================================================================
// Admin Offices Page Signatures — controls separated V6
// Scope: admin_offices_attendance.html only
//
// - يضيف زرًا مستقلًا لتوقيع الشهادة الإجمالية أعلى الصفحة.
// - يربط توقيع الشهادة الإجمالية فعليًا بنافذة الشهادة عند الطباعة/العرض.
// - لا يدمج الشهادة الإجمالية مع توحيد تواقيع المكاتب.
// - يمنع ظهور تعديل/إضافة/بلوكات التواقيع أسفل صفحات المكاتب.
// - يترك getSignatures/signatureKey متاحة للطباعة والمنطق الداخلي.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_PAGE_SIGNATURES_CONTROLS_SEPARATED_V6__) return;
  window.__ADMIN_OFFICES_PAGE_SIGNATURES_CONTROLS_SEPARATED_V6__ = true;

  var GRAND_KEY = 'admin_offices_grand_certificate';
  var SIG_PREFIX = 'sb_sigs_';
  var PREF_PREFIX = 'sb_prefs_';
  var GRAND_BTN_ID = 'admin-offices-grand-certificate-signature-btn';

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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

  function ensureGrandDefaults() {
    var key = SIG_PREFIX + GRAND_KEY;
    var existing = readJson(key, null);
    if (!Array.isArray(existing)) {
      writeJson(key, [
        { title: 'إعداد', name: '' },
        { title: 'مراجعة', name: '' },
        { title: 'اعتماد', name: '' }
      ]);
    }
  }

  function buildGrandSignaturesHtml() {
    ensureGrandDefaults();
    var prefs = readJson(PREF_PREFIX + GRAND_KEY, {});
    if (prefs && prefs.includeSigs === false) return '';

    var rows = readJson(SIG_PREFIX + GRAND_KEY, []);
    if (!Array.isArray(rows) || !rows.length) {
      rows = [
        { title: 'إعداد', name: '' },
        { title: 'مراجعة', name: '' },
        { title: 'اعتماد', name: '' }
      ];
    }

    return '<section class="sign grand-signatures" data-source="admin_offices_page_signatures_v6">' + rows.map(function (s) {
      return '<div><div class="g-title">' + esc(s.title || '') + '</div><div class="line"></div><div class="g-name">' + esc(s.name || '') + '</div></div>';
    }).join('') + '</section>';
  }

  function injectGrandStyle(doc) {
    if (!doc || doc.getElementById('admin-offices-grand-signatures-v6-style')) return;
    var style = doc.createElement('style');
    style.id = 'admin-offices-grand-signatures-v6-style';
    style.textContent = '' +
      '.grand-signatures{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:24px;text-align:center;margin-top:28px}' +
      '.grand-signatures>div{font-weight:900}' +
      '.grand-signatures .line{height:48px;border-bottom:1px solid #111;margin:8px 25px 0}' +
      '.grand-signatures .g-title{font-weight:900;color:#111827}' +
      '.grand-signatures .g-name{font-size:12px;color:#475569;min-height:16px}' +
      '@media print{.grand-signatures .g-name{color:#000}.grand-signatures .g-title{color:#000}}';
    try { doc.head.appendChild(style); } catch (_) {}
  }

  function applyGrandSignaturesToWindow(win) {
    try {
      if (!win || win.closed || !win.document) return;
      var doc = win.document;
      var cert = doc.querySelector && doc.querySelector('.cert');
      if (!cert) return;
      var titleText = (doc.title || '') + ' ' + (cert.textContent || '').slice(0, 300);
      if (titleText.indexOf('الشهادة الإجمالية') === -1) return;

      cert.querySelectorAll('.grand-signatures, .cert > .sign').forEach(function (el) {
        try { el.remove(); } catch (_) {}
      });

      var html = buildGrandSignaturesHtml();
      if (!html) return;
      var holder = doc.createElement('div');
      holder.innerHTML = html;
      cert.appendChild(holder.firstElementChild);
      injectGrandStyle(doc);
    } catch (_) {}
  }

  function patchWindowOpenForGrandSignatures() {
    if (window.open.__adminOfficesGrandSignatureInjectV6) return;
    var originalOpen = window.open;
    window.open = function patchedWindowOpen() {
      var win = originalOpen.apply(window, arguments);
      setTimeout(function () { applyGrandSignaturesToWindow(win); }, 120);
      setTimeout(function () { applyGrandSignaturesToWindow(win); }, 450);
      setTimeout(function () { applyGrandSignaturesToWindow(win); }, 1000);
      setTimeout(function () { applyGrandSignaturesToWindow(win); }, 1800);
      return win;
    };
    window.open.__adminOfficesGrandSignatureInjectV6 = true;
  }

  function removeOfficePageSignatureControls() {
    var selectors = [
      '.admin-page-signature-bar',
      '.admin-page-signature-block',
      '#sb-container-admin_offices',
      '[id^="attendance-signatures-"]',
      '[id^="perf-signatures-"]',
      '[id^="ach-signatures-"]'
    ];
    document.querySelectorAll(selectors.join(',')).forEach(function (el) {
      try { el.remove(); } catch (_) {}
    });

    var details = document.getElementById('center-details-view');
    if (details) {
      details.querySelectorAll('button').forEach(function (btn) {
        var text = String(btn.textContent || '').replace(/\s+/g, ' ').trim();
        if (/تعديل التواقيع|تعديل التوقيع|إضافة توقيع|نسخ للمكاتب/.test(text)) {
          try { btn.remove(); } catch (_) {}
        }
      });
    }
  }

  function renderSeparatedSignatures(type, centerKey) {
    removeOfficePageSignatureControls();
  }

  function openGrandSignatureDialog() {
    ensureGrandDefaults();
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

    var btn = document.getElementById(GRAND_BTN_ID);
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = GRAND_BTN_ID;
      btn.className = 'ab ab-titles';
      var certBtn = Array.prototype.slice.call(bar.querySelectorAll('button')).find(function (b) {
        return String(b.textContent || '').indexOf('الشهادة الإجمالية') > -1 && b.id !== GRAND_BTN_ID;
      });
      if (certBtn && certBtn.nextSibling) bar.insertBefore(btn, certBtn.nextSibling);
      else bar.appendChild(btn);
    }
    btn.innerHTML = '<i class="fas fa-signature"></i> توقيع الشهادة الإجمالية';
    btn.onclick = openGrandSignatureDialog;
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
    openGrand: openGrandSignatureDialog,
    buildGrandSignaturesHtml: buildGrandSignaturesHtml,
    applyGrandSignaturesToWindow: applyGrandSignaturesToWindow
  };

  function boot(attempt) {
    ensureGrandDefaults();
    patchWindowOpenForGrandSignatures();
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

  console.info('[Admin Offices Signatures] grand certificate signatures bound; lower office signatures purged v6');
})();