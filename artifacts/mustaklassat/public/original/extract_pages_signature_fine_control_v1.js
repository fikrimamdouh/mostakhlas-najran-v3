/**
 * extract_pages_signature_fine_control_v1.js
 * أداة تنسيق تواقيع الطباعة الموحدة — العمالة (attendance) والأداء (performance) والإنجاز (achievement).
 * نفس فكرة «تنسيق تواقيع جداول المستهلكات»: عند فتح الطباعة يظهر زرار تحكم كامل
 * (خطوط، كروت، مسافات، ختم، خط توقيع، تحريك كل توقيع، وترتيب كل توقيع: الأول/الثاني...).
 * الحفظ يعتمد التنسيق محليًا وفي النظام (تخزين المستشفى /hospital-storage) فلا يضيع أبدًا
 * ولا يتغير إلا إذا عدّله المستخدم بنفسه.
 * لا تلمس أي حسابات ولا محركات خطابات؛ التنسيق يُطبق عبر CSS فقط فوق التواقيع الحقيقية.
 */
(function () {
  'use strict';
  if (window.__NAJRAN_EXTRACT_SIG_FINE_CONTROL_V1__) return;
  window.__NAJRAN_EXTRACT_SIG_FINE_CONTROL_V1__ = true;

  /* ---------------- تحديد الصفحة (الصفحات الرئيسية الثلاث فقط) ---------------- */
  function pageFileName() {
    try {
      var q = new URLSearchParams(location.search || '').get('page') || '';
      return q ? q.split('/').pop() : (location.pathname || '').split('/').pop();
    } catch (_) {
      return (location.pathname || '').split('/').pop();
    }
  }
  var FILE = pageFileName();
  var PAGE = FILE === 'attendance.html' ? 'attendance'
    : FILE === 'performance.html' ? 'performance'
    : FILE === 'achievement.html' ? 'achievement'
    : null;
  if (!PAGE) return;

  var PAGE_LABELS = { attendance: 'العمالة', performance: 'الأداء', achievement: 'الإنجاز' };
  var STYLE_KEY = 'sb_style_prefs_' + PAGE + '_v1';
  var nativePrint = window.print.bind(window);
  var nativeOpen = window.open.bind(window);
  var editIntent = false;
  var lastPrintTrigger = null;
  var currentDraft = null;

  function clamp(n, min, max, fb) { n = Number(n); return isFinite(n) ? Math.max(min, Math.min(max, n)) : fb; }
  function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* ---------------- نموذج التنسيق (نفس خصائص لوحة المستهلكات + ترتيب كل توقيع) ---------------- */
  function defaultStyle() {
    return {
      version: 1,
      styleApproved: false,
      savedAt: null,
      titleFontSize: 13, nameFontSize: 12, titleWeight: 900, nameWeight: 800,
      titleNameGap: 6, nameLineHeight: 1.45, letterSpacing: 0, textAlign: 'center',
      blockTop: 14, blockY: 0, gap: 12, perRow: 'auto',
      cardWidth: 180, cardHeight: 70,
      cardBorderVisible: false, cardBorderWidth: 1, cardBorderRadius: 10,
      cardBorderColor: 'default', cardBackground: 'transparent', cardPadding: 6,
      textOnly: false,
      showLine: PAGE === 'performance', lineLength: 130, lineNameGap: 5,
      showStamp: true, stampSize: 60, stampPosition: 'center', stampGap: 8,
      panelLeft: 18, panelTop: 66, panelCollapsed: false,
      perSignature: []
    };
  }
  function normalizePerSig(x) {
    x = x && typeof x === 'object' ? x : {};
    var ord = Number(x.order);
    return {
      x: clamp(x.x, -180, 180, 0),
      y: clamp(x.y, -160, 220, 0),
      textAlign: ['right', 'center', 'left'].indexOf(x.textAlign) > -1 ? x.textAlign : null,
      order: isFinite(ord) && ord >= 1 && ord <= 24 ? Math.round(ord) : null
    };
  }
  function normalizeStyle(s) {
    var d = defaultStyle();
    s = s && typeof s === 'object' ? s : {};
    d.styleApproved = s.styleApproved === true;
    d.savedAt = typeof s.savedAt === 'string' ? s.savedAt : null;
    d.titleFontSize = clamp(s.titleFontSize, 6, 44, d.titleFontSize);
    d.nameFontSize = clamp(s.nameFontSize, 6, 44, d.nameFontSize);
    d.titleWeight = clamp(s.titleWeight, 100, 900, d.titleWeight);
    d.nameWeight = clamp(s.nameWeight, 100, 900, d.nameWeight);
    d.titleNameGap = clamp(s.titleNameGap, -40, 140, d.titleNameGap);
    d.nameLineHeight = clamp(s.nameLineHeight, 0.8, 3, d.nameLineHeight);
    d.letterSpacing = clamp(s.letterSpacing, -2, 8, d.letterSpacing);
    d.textAlign = ['right', 'center', 'left'].indexOf(s.textAlign) > -1 ? s.textAlign : d.textAlign;
    d.blockTop = clamp(s.blockTop, 0, 120, d.blockTop);
    d.blockY = clamp(s.blockY, -180, 280, d.blockY);
    d.gap = clamp(s.gap, 0, 120, d.gap);
    d.perRow = ['auto', '2', '3', '4'].indexOf(String(s.perRow)) > -1 ? String(s.perRow) : d.perRow;
    d.cardWidth = clamp(s.cardWidth, 120, 340, d.cardWidth);
    d.cardHeight = clamp(s.cardHeight, 40, 200, d.cardHeight);
    d.cardBorderVisible = s.cardBorderVisible === true;
    d.cardBorderWidth = clamp(s.cardBorderWidth, 0, 3, d.cardBorderWidth);
    d.cardBorderRadius = clamp(s.cardBorderRadius, 0, 20, d.cardBorderRadius);
    d.cardBorderColor = ['default', 'black', 'gray', 'navy'].indexOf(s.cardBorderColor) > -1 ? s.cardBorderColor : d.cardBorderColor;
    d.cardBackground = ['transparent', 'white', 'lightgray'].indexOf(s.cardBackground) > -1 ? s.cardBackground : d.cardBackground;
    d.cardPadding = clamp(s.cardPadding, 0, 30, d.cardPadding);
    d.textOnly = s.textOnly === true;
    d.showLine = s.showLine === true;
    d.lineLength = clamp(s.lineLength, 20, 320, d.lineLength);
    d.lineNameGap = clamp(s.lineNameGap, -30, 80, d.lineNameGap);
    d.showStamp = s.showStamp !== false;
    d.stampSize = clamp(s.stampSize, 32, 130, d.stampSize);
    d.stampPosition = ['right', 'center', 'left'].indexOf(s.stampPosition) > -1 ? s.stampPosition : d.stampPosition;
    d.stampGap = clamp(s.stampGap, 0, 80, d.stampGap);
    d.panelLeft = clamp(s.panelLeft, 4, 1400, d.panelLeft);
    d.panelTop = clamp(s.panelTop, 4, 1000, d.panelTop);
    d.panelCollapsed = s.panelCollapsed === true;
    d.perSignature = Array.isArray(s.perSignature) ? s.perSignature.map(normalizePerSig) : [];
    return d;
  }
  function readStyle() {
    try { return normalizeStyle(JSON.parse(localStorage.getItem(STYLE_KEY) || '{}')); }
    catch (_) { return defaultStyle(); }
  }
  function writeStyle(s) {
    try { localStorage.setItem(STYLE_KEY, JSON.stringify(normalizeStyle(s))); return true; }
    catch (_) { return false; }
  }
  function styleStamp(s) {
    var t = s && typeof s.savedAt === 'string' ? Date.parse(s.savedAt) : NaN;
    return isFinite(t) ? t : 0;
  }

  /* ---------------- مزامنة النظام (تخزين المستشفى) ---------------- */
  var cloudTimer = null;
  function cloudToken() {
    try { var s = JSON.parse(localStorage.getItem('najran_session') || '{}'); return s && s.clerkToken ? s.clerkToken : null; }
    catch (_) { return null; }
  }
  function cloudFetch(path, opts) {
    opts = opts || {};
    var headers = { 'Content-Type': 'application/json' };
    var token = cloudToken();
    if (token) headers.Authorization = 'Bearer ' + token;
    var merged = {};
    for (var k in opts) { if (Object.prototype.hasOwnProperty.call(opts, k)) merged[k] = opts[k]; }
    merged.headers = headers;
    merged.credentials = 'include';
    return fetch('/api' + path, merged)
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }
  function syncStyleToCloud() {
    if (cloudTimer) clearTimeout(cloudTimer);
    cloudTimer = setTimeout(function () {
      cloudTimer = null;
      try {
        var raw = localStorage.getItem(STYLE_KEY);
        if (!raw) return;
        var payload = { data: {} };
        payload.data[STYLE_KEY] = raw;
        cloudFetch('/hospital-storage', { method: 'PUT', body: JSON.stringify(payload) })
          .then(function (res) {
            if (res) console.info('[SigFineControl:' + PAGE + '] style synced to system storage');
          });
      } catch (_) {}
    }, 250);
  }
  function pullStyleFromCloud() {
    cloudFetch('/hospital-storage?keys=' + encodeURIComponent(STYLE_KEY)).then(function (res) {
      try {
        if (!res || !res.data) return;
        var remoteRaw = typeof res.data[STYLE_KEY] === 'string' ? res.data[STYLE_KEY] : null;
        var local = readStyle();
        if (!remoteRaw) {
          if (styleStamp(local) > 0) syncStyleToCloud();
          return;
        }
        var remote = null;
        try { remote = normalizeStyle(JSON.parse(remoteRaw)); } catch (_) { return; }
        if (styleStamp(remote) > styleStamp(local)) {
          writeStyle(remote);
          currentDraft = null;
          applyApprovedStyleTag();
          console.info('[SigFineControl:' + PAGE + '] adopted style from system storage');
        } else if (styleStamp(local) > styleStamp(remote)) {
          syncStyleToCloud();
        }
      } catch (_) {}
    });
  }

  /* ---------------- التواقيع الحالية (للعدّ والتسميات) ---------------- */
  function currentSignatures() {
    try {
      if (window.SignatureBlock && typeof window.SignatureBlock.getSigs === 'function') {
        var s = window.SignatureBlock.getSigs(PAGE);
        if (Array.isArray(s)) return s;
      }
    } catch (_) {}
    try {
      var arr = JSON.parse(localStorage.getItem('sb_sigs_' + PAGE) || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch (_) { return []; }
  }

  /* ---------------- توليد CSS ---------------- */
  function borderColorValue(v) { if (v === 'black') return '#111827'; if (v === 'gray') return '#94a3b8'; if (v === 'navy') return '#1e3c72'; return '#cbd5e1'; }
  function backgroundValue(v) { if (v === 'white') return '#fff'; if (v === 'lightgray') return '#f8fafc'; return 'transparent'; }

  function computeOrders(st, count) {
    var entries = [];
    for (var i = 0; i < count; i++) {
      var slot = st.perSignature[i] ? normalizePerSig(st.perSignature[i]) : normalizePerSig({});
      entries.push({ i: i, key: slot.order !== null ? slot.order - 0.5 : i + 1 });
    }
    entries.sort(function (a, b) { return a.key - b.key || a.i - b.i; });
    var orders = new Array(count);
    entries.forEach(function (e, pos) { orders[e.i] = (pos + 1) * 10; });
    return orders;
  }
  function stampOrder(st, count) {
    if (st.stampPosition === 'right') return 1;
    if (st.stampPosition === 'left') return 99990;
    return Math.max(1, Math.round(count / 2)) * 10 + 5;
  }
  function gridColumns(st) {
    if (st.perRow === 'auto') return 'repeat(auto-fit,minmax(min(100%,' + st.cardWidth + 'px),' + st.cardWidth + 'px))';
    return 'repeat(' + st.perRow + ',minmax(0,' + st.cardWidth + 'px))';
  }

  /* CSS للصفحات ذات الطباعة داخل الصفحة (العمالة والإنجاز): تُطبَّق فوق كتل signature-block الحقيقية */
  function inPageCss(stRaw) {
    var st = normalizeStyle(stRaw);
    var sigs = currentSignatures();
    var count = Math.max(1, sigs.length);
    var roots = PAGE === 'attendance'
      ? ['[data-sb-page="attendance"]', '#sb-container-attendance']
      : ['[data-sb-page="achievement"]', '#sb-container-achievement'];
    function R(suffix) { return roots.map(function (r) { return r + ' ' + suffix; }).join(','); }
    var borderW = (st.textOnly || !st.cardBorderVisible) ? 0 : st.cardBorderWidth;
    var radius = st.textOnly ? 0 : st.cardBorderRadius;
    var bg = st.textOnly ? 'transparent' : backgroundValue(st.cardBackground);
    var pad = st.textOnly ? 0 : st.cardPadding;
    var css = [];
    css.push(R('.sb-grid') + '{display:grid!important;grid-template-columns:' + gridColumns(st) + '!important;direction:rtl!important;gap:' + st.gap + 'px!important;justify-content:center!important;align-items:stretch!important;margin-top:' + st.blockTop + 'px!important;transform:translateY(' + st.blockY + 'px)!important;break-inside:avoid!important;page-break-inside:avoid!important}');
    css.push(R('.sb-item') + '{box-sizing:border-box!important;width:' + st.cardWidth + 'px!important;max-width:100%!important;min-width:0!important;min-height:' + st.cardHeight + 'px!important;background:' + bg + '!important;border:' + borderW + 'px solid ' + borderColorValue(st.cardBorderColor) + '!important;border-radius:' + radius + 'px!important;padding:' + pad + 'px!important;display:flex!important;flex-direction:column!important;justify-content:center!important;break-inside:avoid!important;page-break-inside:avoid!important}');
    var titleMB = st.showLine ? st.lineNameGap : st.titleNameGap;
    css.push(R('.sb-item-title') + '{font-size:' + st.titleFontSize + 'px!important;font-weight:' + st.titleWeight + '!important;letter-spacing:' + st.letterSpacing + 'px!important;line-height:1.35!important;margin:0 0 ' + titleMB + 'px!important;text-align:' + st.textAlign + '!important}');
    css.push(R('.sb-item-title') + '::after{content:"";display:' + (st.showLine ? 'block' : 'none') + ';width:' + st.lineLength + 'px;max-width:100%;height:0;border-top:1.4px solid #111827;margin:' + st.titleNameGap + 'px auto 0}');
    css.push(R('.sb-item-name') + '{font-size:' + st.nameFontSize + 'px!important;font-weight:' + st.nameWeight + '!important;line-height:' + st.nameLineHeight + '!important;letter-spacing:' + st.letterSpacing + 'px!important;margin:0!important;min-height:0!important;text-align:' + st.textAlign + '!important}');
    if (st.showStamp === false) {
      css.push(R('.sb-item.sb-stamp') + '{display:none!important}');
    } else {
      css.push(R('.sb-item.sb-stamp') + '{order:' + stampOrder(st, count) + '!important;margin-inline:' + st.stampGap + 'px!important}');
      css.push(R('.sb-item.sb-stamp svg') + '{width:' + st.stampSize + 'px!important;height:' + st.stampSize + 'px!important}');
      css.push(R('.sb-item.sb-stamp .sb-item-title') + '::after{display:none}');
    }
    var orders = computeOrders(st, count);
    for (var i = 0; i < count; i++) {
      var one = st.perSignature[i] ? normalizePerSig(st.perSignature[i]) : normalizePerSig({});
      var nth = '.sb-item:nth-child(' + (i + 1) + '):not(.sb-stamp)';
      css.push(R(nth) + '{transform:translate(' + one.x + 'px,' + one.y + 'px)!important;order:' + orders[i] + '!important}');
      if (one.textAlign) {
        css.push(R(nth + ' .sb-item-title') + ',' + R(nth + ' .sb-item-name') + '{text-align:' + one.textAlign + '!important}');
      }
    }
    /* في وضع المعاينة (العمالة): إظهار كتل تواقيع الطباعة المخفية حتى يرى المستخدم ما سيُطبع */
    css.push('body.sbx-preview .print-signatures.sb-attendance-table-signatures{display:block!important;visibility:visible!important;opacity:1!important}');
    return css.join('\n');
  }

  /* CSS لنوافذ طباعة الأداء — يغطي الطباعة المفردة (.signature-item) وطباعة الكل (.perf-all-signature-item) */
  function childWindowCss(stRaw) {
    var st = normalizeStyle(stRaw);
    var count = Math.max(1, currentSignatures().length);
    var borderW = (st.textOnly || !st.cardBorderVisible) ? 0 : st.cardBorderWidth;
    var radius = st.textOnly ? 0 : st.cardBorderRadius;
    var bg = st.textOnly ? 'transparent' : backgroundValue(st.cardBackground);
    var pad = st.textOnly ? 0 : st.cardPadding;
    var orders = computeOrders(st, count);
    var css = [];
    var schemes = [
      { section: '.signatures-section', grid: '.signatures-grid', item: '.signature-item', title: '.signature-title', line: '.signature-line', name: '.signature-name', stamp: '.signatures-grid .signature-item:nth-child(' + (count + 1) + ')' },
      { section: '.perf-all-signatures-section', grid: '.perf-all-signatures-grid', item: '.perf-all-signature-item', title: '.perf-all-signature-title', line: '.perf-all-signature-line', name: '.perf-all-signature-name', stamp: '.perf-all-stamp-item' }
    ];
    schemes.forEach(function (S) {
      css.push(S.section + '{margin-top:' + st.blockTop + 'px!important;transform:translateY(' + st.blockY + 'px)!important;break-inside:avoid!important;page-break-inside:avoid!important}');
      css.push(S.grid + '{display:grid!important;grid-template-columns:' + gridColumns(st) + '!important;direction:rtl!important;gap:' + st.gap + 'px!important;justify-content:center!important;align-items:stretch!important}');
      css.push(S.item + '{box-sizing:border-box!important;flex:none!important;width:' + st.cardWidth + 'px!important;max-width:100%!important;min-width:0!important;min-height:' + st.cardHeight + 'px!important;background:' + bg + '!important;border:' + borderW + 'px solid ' + borderColorValue(st.cardBorderColor) + '!important;border-radius:' + radius + 'px!important;padding:' + pad + 'px!important;display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:center!important;break-inside:avoid!important;page-break-inside:avoid!important}');
      css.push(S.title + '{font-size:' + st.titleFontSize + 'px!important;font-weight:' + st.titleWeight + '!important;letter-spacing:' + st.letterSpacing + 'px!important;line-height:1.35!important;margin:0 0 ' + st.titleNameGap + 'px!important;text-align:' + st.textAlign + '!important;width:100%!important}');
      css.push(S.line + '{display:' + (st.showLine ? 'block' : 'none') + '!important;width:' + st.lineLength + 'px!important;max-width:100%!important;height:0!important;border-bottom:1.4px solid #111827!important;border-top:0!important;margin:0 auto ' + st.lineNameGap + 'px!important}');
      css.push(S.name + '{font-size:' + st.nameFontSize + 'px!important;font-weight:' + st.nameWeight + '!important;line-height:' + st.nameLineHeight + '!important;letter-spacing:' + st.letterSpacing + 'px!important;margin:0!important;text-align:' + st.textAlign + '!important;width:100%!important}');
      if (st.showStamp === false) {
        css.push(S.stamp + '{display:none!important}');
      } else {
        css.push(S.stamp + '{order:' + stampOrder(st, count) + '!important;margin-inline:' + st.stampGap + 'px!important}');
        css.push(S.item + ' svg{width:' + st.stampSize + 'px!important;height:' + st.stampSize + 'px!important}');
      }
      for (var i = 0; i < count; i++) {
        var one = st.perSignature[i] ? normalizePerSig(st.perSignature[i]) : normalizePerSig({});
        var nth = S.grid + ' ' + S.item + ':nth-child(' + (i + 1) + ')';
        css.push(nth + '{transform:translate(' + one.x + 'px,' + one.y + 'px)!important;order:' + orders[i] + '!important}');
        if (one.textAlign) {
          css.push(nth + ' ' + S.title + ',' + nth + ' ' + S.name + '{text-align:' + one.textAlign + '!important}');
        }
      }
    });
    return css.join('\n');
  }

  /* ---------------- تطبيق التنسيق ---------------- */
  function applyStyleTagTo(doc, cssText, id) {
    try {
      var el = doc.getElementById(id);
      if (!el) {
        el = doc.createElement('style');
        el.id = id;
        (doc.head || doc.documentElement).appendChild(el);
      }
      el.textContent = cssText;
      return el;
    } catch (_) { return null; }
  }
  /* يطبع التنسيق المعتمد دائمًا داخل الصفحة (العمالة/الإنجاز) حتى مع Ctrl+P */
  function applyApprovedStyleTag() {
    if (PAGE === 'performance') return;
    var st = currentDraft || readStyle();
    if (!currentDraft && st.styleApproved !== true) {
      /* بلا اعتماد صريح لا نغيّر شكل الطباعة الحالي إطلاقًا */
      var stale = document.getElementById('sbx-style-' + PAGE);
      if (stale) stale.textContent = '';
      return;
    }
    applyStyleTagTo(document, inPageCss(st), 'sbx-style-' + PAGE);
  }

  /* ---------------- واجهة اللوحة (مشتركة بين الصفحة ونوافذ الطباعة) ---------------- */
  var PANEL_CSS = [
    '#sbx-toggle{position:fixed;left:18px;top:18px;z-index:999991;border:none;border-radius:999px;background:#7c3aed;color:#fff;padding:10px 16px;font-family:Tajawal,Arial,sans-serif;font-weight:900;font-size:13px;box-shadow:0 8px 22px rgba(124,58,237,.35);cursor:pointer}',
    '#sbx-panel{position:fixed;left:18px;top:66px;z-index:999992;width:470px;max-width:calc(100vw - 22px);max-height:82vh;background:#fff;border:2px solid #7c3aed;border-radius:14px;box-shadow:0 14px 38px rgba(15,23,42,.32);direction:rtl;font-family:Tajawal,Arial,sans-serif;color:#0f172a;overflow:auto;display:none}',
    '#sbx-panel.open{display:block}',
    '#sbx-panel.collapsed .sbx-body{display:none}',
    '#sbx-panel .sbx-head{display:flex;align-items:center;gap:6px;padding:9px 10px;background:#f5f3ff;border-bottom:1px solid #ddd6fe;cursor:move;user-select:none}',
    '#sbx-panel .sbx-head b{flex:1;font-size:13px;color:#6d28d9}',
    '#sbx-panel button{font-family:inherit;font-weight:900;cursor:pointer;border-radius:8px;border:1px solid #cbd5e1;background:#f8fafc;color:#334155;padding:6px 8px;font-size:11px}',
    '.sbx-body{padding:10px}.sbx-tools{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}',
    '.sbx-group{border:1px dashed #cbd5e1;border-radius:10px;padding:8px;margin:8px 0;background:#fff}.sbx-group>strong{display:block;font-size:12px;color:#334155;margin-bottom:6px}',
    '.sbx-row{display:grid;grid-template-columns:138px 1fr 56px;align-items:center;gap:8px;margin:5px 0;font-size:12px;color:#475569}.sbx-row input[type=range]{width:100%}.sbx-row span{font-weight:900;color:#6d28d9;text-align:left}',
    '.sbx-select{width:100%;padding:7px;border:1px solid #cbd5e1;border-radius:8px;font-family:inherit;font-weight:800}',
    '.sbx-check{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;color:#475569;margin:6px 0}',
    '.sbx-save{background:#6d28d9!important;color:#fff!important;border-color:#6d28d9!important}',
    '.sbx-final{background:#166534!important;color:#fff!important;border-color:#166534!important}',
    '.sbx-reset{background:#fef2f2!important;color:#991b1b!important;border-color:#fecaca!important}',
    '#sbx-edit-fab{position:fixed;left:14px;bottom:14px;z-index:999990;border:none;border-radius:999px;background:#334155;color:#fff;padding:8px 14px;font-family:Tajawal,Arial,sans-serif;font-weight:900;font-size:12px;box-shadow:0 6px 18px rgba(15,23,42,.28);cursor:pointer}',
    '#sbx-edit-fab.sbx-intent{background:#7c3aed}',
    '@media print{#sbx-toggle,#sbx-panel,#sbx-edit-fab{display:none!important}}'
  ].join('\n');

  function rangeRow(cls, label, min, max, step, value, suffix) {
    return '<div class="sbx-row"><label>' + label + '</label><input type="range" class="' + cls + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '"><span>' + value + (suffix || '') + '</span></div>';
  }
  function setRangeText(input, value, suffix) {
    var row = input && input.closest ? input.closest('.sbx-row') : null;
    var sp = row ? row.querySelector('span') : null;
    if (sp) sp.textContent = String(value) + (suffix || '');
  }
  function showToast(doc, text, bg) {
    try {
      var msg = doc.createElement('div');
      msg.textContent = text;
      msg.setAttribute('style', 'position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:999999;background:' + (bg || '#166534') + ';color:#fff;padding:10px 18px;border-radius:10px;font-family:Tajawal,Arial,sans-serif;font-weight:900;box-shadow:0 10px 25px rgba(0,0,0,.25)');
      doc.body.appendChild(msg);
      setTimeout(function () { try { msg.remove(); } catch (_) {} }, 2200);
    } catch (_) {}
  }
  function makeDraggable(panel, handle, onDone) {
    if (!panel || !handle || handle.__sbxDrag) return;
    handle.__sbxDrag = true;
    handle.addEventListener('pointerdown', function (ev) {
      if (ev.button != null && ev.button !== 0) return;
      if (ev.target && ev.target.closest && ev.target.closest('button')) return;
      var win = panel.ownerDocument.defaultView || window;
      var sx = ev.clientX, sy = ev.clientY, rect = panel.getBoundingClientRect(), moved = false;
      function mv(e) {
        var nx = Math.max(4, Math.min((win.innerWidth || 900) - (panel.offsetWidth || 470) - 4, rect.left + e.clientX - sx));
        var ny = Math.max(4, Math.min((win.innerHeight || 700) - 60, rect.top + e.clientY - sy));
        panel.style.left = Math.round(nx) + 'px';
        panel.style.top = Math.round(ny) + 'px';
        moved = true;
        e.preventDefault();
      }
      function up() {
        win.removeEventListener('pointermove', mv, true);
        win.removeEventListener('pointerup', up, true);
        if (moved && onDone) {
          var r = panel.getBoundingClientRect();
          onDone(Math.round(r.left), Math.round(r.top));
        }
      }
      win.addEventListener('pointermove', mv, true);
      win.addEventListener('pointerup', up, true);
    });
  }

  /**
   * بناء اللوحة داخل مستند معين.
   * ctx: { doc, apply(), onSave(), onReset(), onFinal(), titleSuffix }
   */
  function buildPanel(ctx) {
    var doc = ctx.doc;
    applyStyleTagTo(doc, PANEL_CSS, 'sbx-panel-css');
    var toggle = doc.getElementById('sbx-toggle');
    if (!toggle) {
      toggle = doc.createElement('button');
      toggle.id = 'sbx-toggle';
      toggle.type = 'button';
      doc.body.appendChild(toggle);
    }
    toggle.textContent = 'تنسيق تواقيع ' + (ctx.titleSuffix || PAGE_LABELS[PAGE]);
    var panel = doc.getElementById('sbx-panel');
    if (!panel) {
      panel = doc.createElement('div');
      panel.id = 'sbx-panel';
      doc.body.appendChild(panel);
    }
    currentDraft = normalizeStyle(currentDraft || readStyle());
    var st = currentDraft;
    panel.style.left = st.panelLeft + 'px';
    panel.style.top = st.panelTop + 'px';
    panel.classList.toggle('collapsed', !!st.panelCollapsed);

    var sigs = currentSignatures();
    var count = Math.max(1, sigs.length);
    var rows = [];
    rows.push('<div class="sbx-group"><strong>تنسيق عام</strong>');
    rows.push(rangeRow('sbx-title-font', 'حجم خط الصفة', 6, 44, 1, st.titleFontSize, 'px'));
    rows.push(rangeRow('sbx-name-font', 'حجم خط الاسم', 6, 44, 1, st.nameFontSize, 'px'));
    rows.push(rangeRow('sbx-title-weight', 'سماكة الصفة', 100, 900, 100, st.titleWeight, ''));
    rows.push(rangeRow('sbx-name-weight', 'سماكة الاسم', 100, 900, 100, st.nameWeight, ''));
    rows.push(rangeRow('sbx-title-gap', 'المسافة بين الصفة والاسم', -40, 140, 1, st.titleNameGap, 'px'));
    rows.push(rangeRow('sbx-name-line', 'تباعد أسطر الاسم', 0.8, 3, 0.1, st.nameLineHeight, ''));
    rows.push(rangeRow('sbx-letter', 'تباعد الحروف', -2, 8, 0.1, st.letterSpacing, 'px'));
    rows.push(rangeRow('sbx-block-top', 'المسافة قبل كتلة التواقيع', 0, 120, 1, st.blockTop, 'px'));
    rows.push(rangeRow('sbx-block-y', 'رفع/تنزيل كتلة التواقيع', -180, 280, 1, st.blockY, 'px'));
    rows.push(rangeRow('sbx-card-w', 'عرض كارت التوقيع', 120, 340, 1, st.cardWidth, 'px'));
    rows.push(rangeRow('sbx-card-h', 'ارتفاع كارت التوقيع', 40, 200, 1, st.cardHeight, 'px'));
    rows.push('<label class="sbx-check" style="display:block">عدد التواقيع في الصف<select class="sbx-select sbx-per-row"><option value="auto" ' + (st.perRow === 'auto' ? 'selected' : '') + '>تلقائي</option><option value="2" ' + (st.perRow === '2' ? 'selected' : '') + '>2</option><option value="3" ' + (st.perRow === '3' ? 'selected' : '') + '>3</option><option value="4" ' + (st.perRow === '4' ? 'selected' : '') + '>4</option></select></label>');
    rows.push('<label class="sbx-check" style="display:block">محاذاة النص الافتراضية<select class="sbx-select sbx-text-align"><option value="right" ' + (st.textAlign === 'right' ? 'selected' : '') + '>يمين</option><option value="center" ' + (st.textAlign === 'center' ? 'selected' : '') + '>وسط</option><option value="left" ' + (st.textAlign === 'left' ? 'selected' : '') + '>يسار</option></select></label>');
    rows.push('</div>');
    rows.push('<div class="sbx-group"><strong>إطار التوقيع</strong>');
    rows.push('<label class="sbx-check"><input type="checkbox" class="sbx-text-only" ' + (st.textOnly ? 'checked' : '') + '> بدون كارت — توقيع نص فقط</label>');
    rows.push('<label class="sbx-check"><input type="checkbox" class="sbx-border-visible" ' + (st.cardBorderVisible ? 'checked' : '') + '> إظهار إطار التوقيع</label>');
    rows.push('<label class="sbx-check" style="display:block">سماكة الإطار<select class="sbx-select sbx-border-width"><option value="0" ' + (st.cardBorderWidth === 0 ? 'selected' : '') + '>0 px</option><option value="1" ' + (st.cardBorderWidth === 1 ? 'selected' : '') + '>1 px</option><option value="2" ' + (st.cardBorderWidth === 2 ? 'selected' : '') + '>2 px</option><option value="3" ' + (st.cardBorderWidth === 3 ? 'selected' : '') + '>3 px</option></select></label>');
    rows.push(rangeRow('sbx-border-radius', 'استدارة زوايا الإطار', 0, 20, 1, st.cardBorderRadius, 'px'));
    rows.push('<label class="sbx-check" style="display:block">لون الإطار<select class="sbx-select sbx-border-color"><option value="default" ' + (st.cardBorderColor === 'default' ? 'selected' : '') + '>افتراضي</option><option value="black" ' + (st.cardBorderColor === 'black' ? 'selected' : '') + '>أسود</option><option value="gray" ' + (st.cardBorderColor === 'gray' ? 'selected' : '') + '>رمادي</option><option value="navy" ' + (st.cardBorderColor === 'navy' ? 'selected' : '') + '>كحلي</option></select></label>');
    rows.push('<label class="sbx-check" style="display:block">لون خلفية الكارت<select class="sbx-select sbx-card-bg"><option value="transparent" ' + (st.cardBackground === 'transparent' ? 'selected' : '') + '>شفاف</option><option value="white" ' + (st.cardBackground === 'white' ? 'selected' : '') + '>أبيض</option><option value="lightgray" ' + (st.cardBackground === 'lightgray' ? 'selected' : '') + '>رمادي فاتح</option></select></label>');
    rows.push(rangeRow('sbx-card-padding', 'المسافة الداخلية داخل الكارت', 0, 30, 1, st.cardPadding, 'px'));
    rows.push(rangeRow('sbx-gap', 'المسافة بين كروت التوقيع', 0, 120, 1, st.gap, 'px'));
    rows.push('</div>');
    rows.push('<div class="sbx-group"><strong>خط التوقيع والختم</strong>');
    rows.push('<label class="sbx-check"><input type="checkbox" class="sbx-show-line" ' + (st.showLine ? 'checked' : '') + '> إظهار خط التوقيع</label>');
    rows.push(rangeRow('sbx-line-length', 'طول خط التوقيع', 20, 320, 1, st.lineLength, 'px'));
    rows.push(rangeRow('sbx-line-gap', 'المسافة بين الخط والاسم', -30, 80, 1, st.lineNameGap, 'px'));
    rows.push('<label class="sbx-check"><input type="checkbox" class="sbx-show-stamp" ' + (st.showStamp ? 'checked' : '') + '> إظهار الختم</label>');
    rows.push(rangeRow('sbx-stamp-size', 'حجم الختم', 32, 130, 1, st.stampSize, 'px'));
    rows.push(rangeRow('sbx-stamp-gap', 'المسافة حول الختم', 0, 80, 1, st.stampGap, 'px'));
    rows.push('<label class="sbx-check" style="display:block">موضع الختم<select class="sbx-select sbx-stamp-pos"><option value="right" ' + (st.stampPosition === 'right' ? 'selected' : '') + '>يمين</option><option value="center" ' + (st.stampPosition === 'center' ? 'selected' : '') + '>وسط</option><option value="left" ' + (st.stampPosition === 'left' ? 'selected' : '') + '>يسار</option></select></label>');
    rows.push('</div>');
    rows.push('<div class="sbx-group"><strong>التحكم في كل توقيع منفرد (المكان والترتيب)</strong>');
    for (var i = 0; i < count; i++) {
      var one = st.perSignature[i] ? normalizePerSig(st.perSignature[i]) : normalizePerSig({});
      var label = sigs[i] && sigs[i].title ? ' — ' + esc(sigs[i].title) : '';
      rows.push('<div class="sbx-group" data-sig-idx="' + i + '"><strong>التوقيع ' + (i + 1) + label + '</strong>');
      var orderOpts = '<option value="" ' + (one.order === null ? 'selected' : '') + '>حسب ترتيب الإدخال</option>';
      for (var o = 1; o <= count; o++) {
        orderOpts += '<option value="' + o + '" ' + (one.order === o ? 'selected' : '') + '>' + (o === 1 ? 'الأول' : o === 2 ? 'الثاني' : o === 3 ? 'الثالث' : o === 4 ? 'الرابع' : 'رقم ' + o) + '</option>';
      }
      rows.push('<label class="sbx-check" style="display:block">ترتيب هذا التوقيع<select class="sbx-select sbx-sig-order">' + orderOpts + '</select></label>');
      rows.push(rangeRow('sbx-sig-x', 'يمين/يسار', -180, 180, 1, one.x, 'px'));
      rows.push(rangeRow('sbx-sig-y', 'رفع/تنزيل', -160, 220, 1, one.y, 'px'));
      rows.push('<label class="sbx-check" style="display:block">محاذاة هذا التوقيع<select class="sbx-select sbx-sig-align"><option value="" ' + (!one.textAlign ? 'selected' : '') + '>حسب الافتراضي</option><option value="right" ' + (one.textAlign === 'right' ? 'selected' : '') + '>يمين</option><option value="center" ' + (one.textAlign === 'center' ? 'selected' : '') + '>وسط</option><option value="left" ' + (one.textAlign === 'left' ? 'selected' : '') + '>يسار</option></select></label>');
      rows.push('</div>');
    }
    rows.push('</div>');

    panel.innerHTML =
      '<div class="sbx-head"><b>تنسيق تواقيع ' + (ctx.titleSuffix || PAGE_LABELS[PAGE]) + '</b><button type="button" class="sbx-collapse">' + (st.panelCollapsed ? 'فتح' : 'طي') + '</button></div>' +
      '<div class="sbx-body"><div class="sbx-tools">' +
      '<button type="button" class="sbx-reset-panel">إعادة مكان اللوحة</button>' +
      '<button type="button" class="sbx-save">حفظ واعتماد التنسيق</button>' +
      '<button type="button" class="sbx-reset">استعادة الافتراضي</button>' +
      '<button type="button" class="sbx-final">طباعة نهائية</button>' +
      '</div>' + rows.join('') + '</div>';
    panel.classList.add('open');

    function ensureSlot(idx) {
      while (currentDraft.perSignature.length <= idx) currentDraft.perSignature.push(normalizePerSig({}));
      return currentDraft.perSignature[idx];
    }
    function apply() { currentDraft = normalizeStyle(currentDraft); ctx.apply(); }

    toggle.onclick = function () { panel.classList.toggle('open'); };
    makeDraggable(panel, panel.querySelector('.sbx-head'), function (left, top) {
      currentDraft.panelLeft = left; currentDraft.panelTop = top; writeStyle(currentDraft);
    });
    panel.querySelector('.sbx-collapse').onclick = function () {
      currentDraft.panelCollapsed = !currentDraft.panelCollapsed;
      writeStyle(currentDraft);
      buildPanel(ctx);
    };
    panel.querySelector('.sbx-reset-panel').onclick = function () {
      currentDraft.panelLeft = 18; currentDraft.panelTop = 66; currentDraft.panelCollapsed = false;
      writeStyle(currentDraft);
      buildPanel(ctx);
    };
    panel.querySelector('.sbx-save').onclick = function () { ctx.onSave(); };
    panel.querySelector('.sbx-reset').onclick = function () { ctx.onReset(); };
    panel.querySelector('.sbx-final').onclick = function () { ctx.onFinal(); };

    function bindRange(sel, prop, suffix) {
      var input = panel.querySelector(sel);
      if (!input) return;
      input.oninput = function () {
        currentDraft[prop] = Number(input.value);
        setRangeText(input, currentDraft[prop], suffix);
        apply();
      };
    }
    bindRange('.sbx-title-font', 'titleFontSize', 'px');
    bindRange('.sbx-name-font', 'nameFontSize', 'px');
    bindRange('.sbx-title-weight', 'titleWeight', '');
    bindRange('.sbx-name-weight', 'nameWeight', '');
    bindRange('.sbx-title-gap', 'titleNameGap', 'px');
    bindRange('.sbx-name-line', 'nameLineHeight', '');
    bindRange('.sbx-letter', 'letterSpacing', 'px');
    bindRange('.sbx-block-top', 'blockTop', 'px');
    bindRange('.sbx-block-y', 'blockY', 'px');
    bindRange('.sbx-card-w', 'cardWidth', 'px');
    bindRange('.sbx-card-h', 'cardHeight', 'px');
    bindRange('.sbx-border-radius', 'cardBorderRadius', 'px');
    bindRange('.sbx-card-padding', 'cardPadding', 'px');
    bindRange('.sbx-gap', 'gap', 'px');
    bindRange('.sbx-line-length', 'lineLength', 'px');
    bindRange('.sbx-line-gap', 'lineNameGap', 'px');
    bindRange('.sbx-stamp-size', 'stampSize', 'px');
    bindRange('.sbx-stamp-gap', 'stampGap', 'px');
    function bindSelect(sel, prop) {
      var el = panel.querySelector(sel);
      if (!el) return;
      el.onchange = function () { currentDraft[prop] = el.value; apply(); };
    }
    bindSelect('.sbx-per-row', 'perRow');
    bindSelect('.sbx-text-align', 'textAlign');
    bindSelect('.sbx-border-color', 'cardBorderColor');
    bindSelect('.sbx-card-bg', 'cardBackground');
    bindSelect('.sbx-stamp-pos', 'stampPosition');
    var bw = panel.querySelector('.sbx-border-width');
    if (bw) bw.onchange = function () { currentDraft.cardBorderWidth = Number(bw.value); apply(); };
    function bindCheck(sel, prop) {
      var el = panel.querySelector(sel);
      if (!el) return;
      el.onchange = function () { currentDraft[prop] = el.checked; apply(); };
    }
    bindCheck('.sbx-text-only', 'textOnly');
    bindCheck('.sbx-border-visible', 'cardBorderVisible');
    bindCheck('.sbx-show-line', 'showLine');
    bindCheck('.sbx-show-stamp', 'showStamp');

    panel.querySelectorAll('[data-sig-idx]').forEach(function (group) {
      var idx = Number(group.getAttribute('data-sig-idx'));
      var x = group.querySelector('.sbx-sig-x');
      var y = group.querySelector('.sbx-sig-y');
      var a = group.querySelector('.sbx-sig-align');
      var ord = group.querySelector('.sbx-sig-order');
      if (x) x.oninput = function () { ensureSlot(idx).x = Number(x.value); setRangeText(x, ensureSlot(idx).x, 'px'); apply(); };
      if (y) y.oninput = function () { ensureSlot(idx).y = Number(y.value); setRangeText(y, ensureSlot(idx).y, 'px'); apply(); };
      if (a) a.onchange = function () { ensureSlot(idx).textAlign = a.value || null; apply(); };
      if (ord) ord.onchange = function () {
        var v = Number(ord.value);
        ensureSlot(idx).order = isFinite(v) && v >= 1 ? Math.round(v) : null;
        apply();
      };
    });
  }

  function removePanel(doc) {
    ['sbx-toggle', 'sbx-panel'].forEach(function (id) {
      var el = doc.getElementById(id);
      if (el) el.remove();
    });
  }

  function saveApproved(doc, afterSave) {
    currentDraft = normalizeStyle(currentDraft || readStyle());
    currentDraft.styleApproved = true;
    currentDraft.savedAt = new Date().toISOString();
    var ok = writeStyle(currentDraft);
    syncStyleToCloud();
    showToast(doc, ok ? 'تم حفظ واعتماد تنسيق التواقيع في النظام بنجاح' : 'تعذر الحفظ — راجع Console', ok ? '#166534' : '#991b1b');
    if (ok && afterSave) afterSave();
  }
  function resetToDefault(doc, afterReset) {
    currentDraft = defaultStyle();
    currentDraft.savedAt = new Date().toISOString();
    writeStyle(currentDraft);
    syncStyleToCloud();
    showToast(doc, 'تمت استعادة التنسيق الافتراضي', '#334155');
    if (afterReset) afterReset();
  }

  /* ---------------- زرار التعديل الثابت ---------------- */
  function ensureEditFab() {
    applyStyleTagTo(document, PANEL_CSS, 'sbx-panel-css');
    var fab = document.getElementById('sbx-edit-fab');
    if (!fab) {
      fab = document.createElement('button');
      fab.id = 'sbx-edit-fab';
      fab.type = 'button';
      document.body.appendChild(fab);
      fab.addEventListener('click', function () {
        if (PAGE === 'performance') {
          editIntent = !editIntent;
          fab.classList.toggle('sbx-intent', editIntent);
          fab.textContent = editIntent ? '✔ افتح الطباعة الآن لتعديل التنسيق' : '🖋 تنسيق تواقيع الطباعة';
          if (editIntent) showToast(document, 'اضغط أي زر طباعة الآن وستفتح نافذة الطباعة بوضع تعديل التنسيق', '#7c3aed');
        } else {
          enterPreview();
        }
      });
    }
    fab.textContent = '🖋 تنسيق تواقيع الطباعة';
  }

  /* ---------------- وضع المعاينة داخل الصفحة (العمالة والإنجاز) ---------------- */
  function applyInPageDraft() {
    applyStyleTagTo(document, inPageCss(currentDraft || readStyle()), 'sbx-style-' + PAGE);
  }
  function exitPreview() {
    document.body.classList.remove('sbx-preview');
    removePanel(document);
  }
  function enterPreview() {
    currentDraft = readStyle();
    document.body.classList.add('sbx-preview');
    applyInPageDraft();
    var ctx = {
      doc: document,
      titleSuffix: PAGE_LABELS[PAGE],
      apply: applyInPageDraft,
      onSave: function () {
        saveApproved(document, function () {
          exitPreview();
          applyApprovedStyleTag();
        });
      },
      onReset: function () {
        resetToDefault(document, null);
        applyInPageDraft();
        buildPanel(ctx);
      },
      onFinal: function () {
        applyInPageDraft();
        doFinalInPagePrint();
      }
    };
    buildPanel(ctx);
  }
  function doFinalInPagePrint() {
    window.__sbxFinalPassthrough = true;
    try {
      var t = lastPrintTrigger && lastPrintTrigger.el && document.contains(lastPrintTrigger.el) ? lastPrintTrigger.el : null;
      if (t) { t.click(); } else { nativePrint(); }
    } finally {
      setTimeout(function () { window.__sbxFinalPassthrough = false; }, 1500);
    }
  }

  /* تسجيل آخر زر طباعة ضغطه المستخدم (لإعادة تشغيل نفس مسار الصفحة عند الطباعة النهائية) */
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('button,[onclick],a') : null;
    if (!el) return;
    var oc = (el.getAttribute && el.getAttribute('onclick')) || '';
    var txt = el.textContent || '';
    if (/print/i.test(oc) || /طباعة/.test(txt)) lastPrintTrigger = { el: el, ts: Date.now() };
  }, true);

  /* اعتراض window.print داخل الصفحة (العمالة والإنجاز فقط) */
  if (PAGE !== 'performance') {
    window.print = function () {
      if (window.__sbxFinalPassthrough) return nativePrint();
      var st = readStyle();
      if (document.body.classList.contains('sbx-preview')) {
        /* أثناء المعاينة لا نطبع من مسارات الصفحة الأخرى */
        return;
      }
      if (st.styleApproved === true) {
        currentDraft = null;
        applyApprovedStyleTag();
        return nativePrint();
      }
      enterPreview();
    };
  }

  /* ---------------- نوافذ طباعة الأداء ---------------- */
  function setupChildWindow(win, wantEdit) {
    var doc;
    try { doc = win.document; } catch (_) { return; }
    if (!doc || !doc.body || win.__sbxHandled) return;
    win.__sbxHandled = true;
    currentDraft = wantEdit ? readStyle() : null;
    var st = currentDraft || readStyle();
    if (st.styleApproved === true || wantEdit) {
      applyStyleTagTo(doc, childWindowCss(st), 'sbx-style-child');
    }
    if (!wantEdit) return;

    /* تعطيل الطباعة/الإغلاق التلقائي مؤقتًا حتى ينتهي المستخدم من التنسيق */
    try {
      win.__sbxRealPrint = win.print;
      win.__sbxRealClose = win.close;
      win.print = function () {};
      win.close = function () {};
    } catch (_) {}

    function applyChild() {
      applyStyleTagTo(doc, childWindowCss(currentDraft || readStyle()), 'sbx-style-child');
    }
    var ctx = {
      doc: doc,
      titleSuffix: PAGE_LABELS[PAGE],
      apply: applyChild,
      onSave: function () {
        saveApproved(doc, function () { applyChild(); });
      },
      onReset: function () {
        resetToDefault(doc, null);
        applyChild();
        buildPanel(ctx);
      },
      onFinal: function () { childFinalPrint(win, doc); }
    };
    buildPanel(ctx);
    showToast(doc, 'وضع تعديل تنسيق التواقيع — اضبط ثم اضغط «حفظ واعتماد» أو «طباعة نهائية»', '#7c3aed');
  }
  function childFinalPrint(win, doc) {
    applyStyleTagTo(doc, childWindowCss(currentDraft || readStyle()), 'sbx-style-child');
    removePanel(doc);
    try {
      if (win.__sbxRealPrint) win.print = win.__sbxRealPrint;
      if (win.__sbxRealClose) win.close = win.__sbxRealClose;
    } catch (_) {}
    try { win.print(); } catch (_) {}
    setTimeout(function () { try { win.close(); } catch (_) {} }, 400);
  }

  if (PAGE === 'performance') {
    window.open = function () {
      var win = nativeOpen.apply(window, arguments);
      if (win) {
        var wantEdit = editIntent || readStyle().styleApproved !== true;
        var attempts = 0;
        var poll = setInterval(function () {
          attempts++;
          var done = false;
          try {
            if (win.closed) { done = true; }
            else {
              var doc = win.document;
              if (doc && doc.body && doc.querySelector('.signatures-grid .signature-item, .perf-all-signatures-grid .perf-all-signature-item')) {
                if (wantEdit && editIntent) {
                  editIntent = false;
                  var fab = document.getElementById('sbx-edit-fab');
                  if (fab) { fab.classList.remove('sbx-intent'); fab.textContent = '🖋 تنسيق تواقيع الطباعة'; }
                }
                setupChildWindow(win, wantEdit);
                done = true;
              }
            }
          } catch (_) { done = true; }
          if (done || attempts > 60) clearInterval(poll);
        }, 100);
      }
      return win;
    };
  }

  /* ---------------- التهيئة ---------------- */
  function init() {
    ensureEditFab();
    applyApprovedStyleTag();
    pullStyleFromCloud();
    console.info('[SigFineControl] installed for page: ' + PAGE);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
