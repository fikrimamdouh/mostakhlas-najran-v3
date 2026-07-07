/* signature-style-control.js — V3
 * الأداة الموحدة للتحكم في شكل التواقيع داخل نوافذ الطباعة.
 * لا تضيف محرك خطابات جديد ولا تتدخل في الحسابات؛ فقط تمسك نافذة الطباعة
 * وتطبق تنسيقًا محفوظًا على عناصر التوقيع الحقيقية: .sig-title/.sig-role و.sig-name.
 */
(function () {
  'use strict';
  if (window.__NAJRAN_SIGNATURE_STYLE_CONTROL_V2__) return;
  window.__NAJRAN_SIGNATURE_STYLE_CONTROL_V2__ = true;

  var KEY = 'najranSignatureStyleSettings_v1';
  var MAX_SIGS = 24;

  var FONT_MIN = 6, FONT_MAX = 44;
  var WEIGHT_MIN = 100, WEIGHT_MAX = 900;
  var H_SHIFT_MIN = -180, H_SHIFT_MAX = 180;
  var TITLE_NAME_GAP_MIN = -40, TITLE_NAME_GAP_MAX = 140;
  var LINE_MIN = 0.8, LINE_MAX = 3;
  var LETTER_MIN = -2, LETTER_MAX = 8;
  var SIGNATURE_GAP_MIN = -80, SIGNATURE_GAP_MAX = 160;
  var BLOCK_Y_MIN = -160, BLOCK_Y_MAX = 260;

  function defaultSlot() {
    return {
      // مفاتيح قديمة محفوظة للتوافق مع إعدادات المستخدم السابقة.
      fontSize: null,
      bold: null,
      newLine: false,

      // التحكمات التفصيلية الحالية.
      titleFontSize: null,
      nameFontSize: null,
      titleWeight: null,
      nameWeight: null,
      titleNameGap: null,
      lineHeight: null,
      letterSpacing: null,
      gapBefore: 0,
      textAlign: null
    };
  }

  function defaults() {
    return {
      version: 4,
      // مفاتيح قديمة محفوظة للتوافق، لكن التطبيق الفعلي يظل على عناصر التوقيع فقط.
      containerAlign: null,
      rowGap: null,
      rowTopMargin: null,
      perSignature: []
    };
  }

  function clamp(n, min, max) {
    n = Number(n);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : null;
  }

  function clampInt(n, min, max) {
    var x = clamp(n, min, max);
    return x === null ? null : Math.round(x);
  }

  function safeAlign(v) {
    return ['right', 'left', 'center'].indexOf(v) > -1 ? v : null;
  }

  function getSlot(settings, i) {
    while (settings.perSignature.length <= i) settings.perSignature.push(defaultSlot());
    return settings.perSignature[i];
  }

  function normalizeSlot(raw) {
    raw = raw && typeof raw === 'object' ? raw : {};
    var out = defaultSlot();

    out.fontSize = clampInt(raw.fontSize, FONT_MIN, FONT_MAX);
    out.bold = raw.bold === true ? true : (raw.bold === false ? false : null);
    out.newLine = raw.newLine === true;

    out.titleFontSize = clampInt(raw.titleFontSize, FONT_MIN, FONT_MAX);
    out.nameFontSize = clampInt(raw.nameFontSize, FONT_MIN, FONT_MAX);
    out.titleWeight = clampInt(raw.titleWeight, WEIGHT_MIN, WEIGHT_MAX);
    out.nameWeight = clampInt(raw.nameWeight, WEIGHT_MIN, WEIGHT_MAX);
    out.titleNameGap = clampInt(raw.titleNameGap, TITLE_NAME_GAP_MIN, TITLE_NAME_GAP_MAX);
    out.lineHeight = clamp(raw.lineHeight, LINE_MIN, LINE_MAX);
    out.letterSpacing = clamp(raw.letterSpacing, LETTER_MIN, LETTER_MAX);
    out.gapBefore = clampInt(raw.gapBefore, H_SHIFT_MIN, H_SHIFT_MAX) || 0;
    out.textAlign = safeAlign(raw.textAlign);

    // توافق خلفي: الإعداد القديم fontSize/bold يظل مؤثرًا لو لم يحدد الجديد.
    if (out.titleFontSize === null && out.fontSize !== null) out.titleFontSize = out.fontSize;
    if (out.nameFontSize === null && out.fontSize !== null) out.nameFontSize = out.fontSize;
    if (out.titleWeight === null && out.bold !== null) out.titleWeight = out.bold ? 900 : 400;
    if (out.nameWeight === null && out.bold !== null) out.nameWeight = out.bold ? 900 : 400;

    return out;
  }

  function readSettings() {
    var d = defaults();
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return d;
      var p = JSON.parse(raw);
      if (!p || typeof p !== 'object') return d;

      d.containerAlign = ['right', 'left', 'center', 'distribute'].indexOf(p.containerAlign) > -1 ? p.containerAlign : null;
      d.rowGap = clampInt(p.rowGap, SIGNATURE_GAP_MIN, SIGNATURE_GAP_MAX);
      d.rowTopMargin = clampInt(p.rowTopMargin, BLOCK_Y_MIN, BLOCK_Y_MAX);

      if (Array.isArray(p.perSignature)) {
        for (var i = 0; i < Math.min(p.perSignature.length, MAX_SIGS); i++) {
          d.perSignature[i] = normalizeSlot(p.perSignature[i]);
        }
      }
    } catch (_) {}
    return d;
  }

  function writeSettings(s) {
    try {
      s.version = 4;
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch (_) {}
  }

  function findSignatureRows(doc) {
    var titles = doc.querySelectorAll('.sig-title, .sig-role');
    var rows = [];
    var rowIndex = new Map();
    var globalIndex = 0;

    for (var i = 0; i < titles.length; i++) {
      var title = titles[i];
      var holder = title.parentElement;
      if (!holder) continue;

      var row = holder.parentElement || holder;
      var idx = rowIndex.get(row);
      if (idx === undefined) {
        idx = rows.length;
        rowIndex.set(row, idx);
        rows.push({ row: row, cells: [] });
      }

      rows[idx].cells.push({
        title: title,
        name: holder.querySelector('.sig-name'),
        globalIndex: globalIndex
      });
      globalIndex++;
    }

    return rows;
  }

  function resetSignatureElements(title, name) {
    [title, name].forEach(function (el) {
      if (!el) return;
      el.style.fontSize = '';
      el.style.fontWeight = '';
      el.style.marginTop = '';
      el.style.marginBottom = '';
      el.style.letterSpacing = '';
      el.style.lineHeight = '';
      el.style.textAlign = '';
      el.style.transform = '';
      el.style.display = '';
    });
  }

  function applyToElement(el, cfg, isTitle, translateX, translateY) {
    if (!el) return;

    if (isTitle) {
      if (cfg.titleFontSize !== null) el.style.fontSize = cfg.titleFontSize + 'px';
      if (cfg.titleWeight !== null) el.style.fontWeight = String(cfg.titleWeight);
      if (cfg.titleNameGap !== null) el.style.marginBottom = cfg.titleNameGap + 'px';
    } else {
      if (cfg.nameFontSize !== null) el.style.fontSize = cfg.nameFontSize + 'px';
      if (cfg.nameWeight !== null) el.style.fontWeight = String(cfg.nameWeight);
      if (cfg.lineHeight !== null) el.style.lineHeight = String(cfg.lineHeight);
    }

    if (cfg.letterSpacing !== null) el.style.letterSpacing = cfg.letterSpacing + 'px';

    if (cfg.textAlign) {
      el.style.display = 'block';
      el.style.textAlign = cfg.textAlign;
    }

    if (translateX || translateY) {
      el.style.transform = 'translate(' + translateX + 'px, ' + translateY + 'px)';
    }
  }

  function applyStyles(doc, settings) {
    settings = settings || readSettings();
    var groups = findSignatureRows(doc);
    var blockY = settings.rowTopMargin === null ? 0 : settings.rowTopMargin;
    var signatureGap = settings.rowGap === null ? 0 : settings.rowGap;

    groups.forEach(function (g) {
      var countInRow = g.cells.length;
      var center = (countInRow - 1) / 2;

      g.cells.forEach(function (entry, position) {
        resetSignatureElements(entry.title, entry.name);
        if (entry.globalIndex >= MAX_SIGS) return;

        var cfg = settings.perSignature[entry.globalIndex];
        if (!cfg) return;

        var spreadX = countInRow > 1 ? Math.round((position - center) * signatureGap) : 0;
        var shiftX = (cfg.gapBefore || 0) + spreadX;

        applyToElement(entry.title, cfg, true, shiftX, blockY);
        applyToElement(entry.name, cfg, false, shiftX, blockY);
      });
    });

    return groups.reduce(function (n, g) { return n + g.cells.length; }, 0);
  }

  function panelStyles(doc) {
    if (doc.getElementById('najran-sig-panel-style-v2')) return;
    var style = doc.createElement('style');
    style.id = 'najran-sig-panel-style-v2';
    style.textContent = [
      '#najran-sig-toggle{position:fixed;bottom:16px;left:16px;z-index:99998;background:#0f766e;color:#fff;border:none;border-radius:999px;padding:10px 18px;font-family:Tajawal,Arial,sans-serif;font-weight:800;font-size:14px;cursor:pointer;box-shadow:0 6px 18px rgba(15,118,110,.4)}',
      '#najran-sig-panel{position:fixed;bottom:64px;left:16px;z-index:99999;background:#fff;border:2px solid #0f766e;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.28);font-family:Tajawal,Arial,sans-serif;direction:rtl;width:450px;max-height:82vh;overflow:auto;padding:14px 16px;display:none;color:#0f172a}',
      '#najran-sig-panel.open{display:block}',
      '#najran-sig-panel h4{margin:0 0 10px;font-size:15px;color:#0f766e}',
      '#najran-sig-panel .sig-global{border:1px solid #99f6e4;background:#ecfdf5;border-radius:10px;padding:8px 10px;margin:8px 0 12px}',
      '#najran-sig-panel .sig-group{border:1px dashed #cbd5e1;border-radius:10px;padding:8px 10px;margin-bottom:10px;background:#fff}',
      '#najran-sig-panel .sig-group b,#najran-sig-panel .sig-global b{display:block;font-size:13px;margin-bottom:6px;color:#334155}',
      '#najran-sig-panel .sig-row{display:grid;grid-template-columns:124px 1fr 56px;align-items:center;gap:8px;margin-bottom:6px;font-size:12px;color:#475569}',
      '#najran-sig-panel .sig-row input[type=range]{width:100%}',
      '#najran-sig-panel .sig-row span{min-width:50px;text-align:left;font-weight:800;color:#0f766e}',
      '#najran-sig-panel .sig-mini-buttons{display:flex;gap:6px;flex-wrap:wrap;margin:5px 0 7px}',
      '#najran-sig-panel .sig-mini-buttons button{border:1px solid #cbd5e1;background:#f8fafc;border-radius:7px;padding:5px 8px;font-size:11px;font-weight:800;cursor:pointer}',
      '#najran-sig-panel .sig-mini-buttons button.active{background:#0f766e;color:#fff;border-color:#0f766e}',
      '#najran-sig-panel .sig-actions{display:flex;gap:8px;margin-top:8px}',
      '#najran-sig-panel .sig-actions button{flex:1;border:none;border-radius:8px;padding:8px;font-weight:800;font-size:13px;cursor:pointer}',
      '#najran-sig-panel .sig-save{background:#0f766e;color:#fff}',
      '#najran-sig-panel .sig-reset{background:#f1f5f9;color:#475569}',
      '@media(max-width:700px){#najran-sig-panel{right:8px;left:8px;width:auto;bottom:58px}}',
      '@media print{#najran-sig-toggle,#najran-sig-panel{display:none!important}}'
    ].join('\n');
    doc.head.appendChild(style);
  }

  function formatValue(value, suffix) {
    var num = Number(value);
    if (Number.isFinite(num) && Math.abs(num % 1) > 0.001) value = num.toFixed(1);
    return value + (suffix || '');
  }

  function rangeHtml(cls, label, min, max, step, value, suffix) {
    return '<div class="sig-row"><label>' + label + '</label>' +
      '<input type="range" class="' + cls + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '">' +
      '<span>' + formatValue(value, suffix) + '</span></div>';
  }

  function setRowValue(row, value, suffix) {
    var span = row && row.querySelector('span');
    if (span) span.textContent = formatValue(value, suffix);
  }

  function buildPanel(doc, count) {
    if (doc.getElementById('najran-sig-panel')) return;
    panelStyles(doc);

    var draft = readSettings();
    for (var k = 0; k < count; k++) getSlot(draft, k);

    var toggle = doc.createElement('button');
    toggle.id = 'najran-sig-toggle';
    toggle.type = 'button';
    toggle.textContent = 'تنسيق التواقيع';
    doc.body.appendChild(toggle);

    var panel = doc.createElement('div');
    panel.id = 'najran-sig-panel';
    doc.body.appendChild(panel);

    var ORDINALS = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
    var TEXT_ALIGN_LABELS = [['right', 'يمين'], ['center', 'توسيط'], ['left', 'يسار']];

    function sigLabel(i) {
      return 'التوقيع ' + (ORDINALS[i] || '#' + (i + 1));
    }

    function render() {
      var rowGap = draft.rowGap === null ? 0 : draft.rowGap;
      var rowTop = draft.rowTopMargin === null ? 0 : draft.rowTopMargin;

      var globalHtml = '<div class="sig-global"><b>تحكم عام في كتلة التوقيعات</b>' +
        rangeHtml('sig-row-gap', 'المسافة بين التوقيعات', SIGNATURE_GAP_MIN, SIGNATURE_GAP_MAX, 1, rowGap, 'px') +
        rangeHtml('sig-row-top', 'رفع/تنزيل كتلة التوقيعات', BLOCK_Y_MIN, BLOCK_Y_MAX, 1, rowTop, 'px') +
        '</div>';

      var groupsHtml = '';
      for (var i = 0; i < count; i++) {
        var cfg = getSlot(draft, i);
        var titleSize = cfg.titleFontSize !== null ? cfg.titleFontSize : 15;
        var nameSize = cfg.nameFontSize !== null ? cfg.nameFontSize : 15;
        var titleWeight = cfg.titleWeight !== null ? cfg.titleWeight : 900;
        var nameWeight = cfg.nameWeight !== null ? cfg.nameWeight : 900;
        var titleNameGap = cfg.titleNameGap !== null ? cfg.titleNameGap : 14;
        var lineHeight = cfg.lineHeight !== null ? cfg.lineHeight : 1.7;
        var letterSpacing = cfg.letterSpacing !== null ? cfg.letterSpacing : 0;
        var horizontalShift = cfg.gapBefore || 0;

        var textAlignButtons = TEXT_ALIGN_LABELS.map(function (a) {
          return '<button type="button" data-text-align="' + a[0] + '" class="' + (cfg.textAlign === a[0] ? 'active' : '') + '">' + a[1] + '</button>';
        }).join('');

        groupsHtml += '' +
          '<div class="sig-group" data-idx="' + i + '">' +
          '<b>' + sigLabel(i) + '</b>' +
          rangeHtml('sig-title-font', 'حجم خط الصفة', FONT_MIN, FONT_MAX, 1, titleSize, 'px') +
          rangeHtml('sig-name-font', 'حجم خط الاسم', FONT_MIN, FONT_MAX, 1, nameSize, 'px') +
          rangeHtml('sig-title-weight', 'سماكة الصفة', WEIGHT_MIN, WEIGHT_MAX, 100, titleWeight, '') +
          rangeHtml('sig-name-weight', 'سماكة الاسم', WEIGHT_MIN, WEIGHT_MAX, 100, nameWeight, '') +
          rangeHtml('sig-title-name-gap', 'المسافة بين الصفة والاسم', TITLE_NAME_GAP_MIN, TITLE_NAME_GAP_MAX, 1, titleNameGap, 'px') +
          rangeHtml('sig-line-height', 'تباعد أسطر الاسم', LINE_MIN, LINE_MAX, 0.1, lineHeight, '') +
          rangeHtml('sig-letter-spacing', 'تباعد الحروف', LETTER_MIN, LETTER_MAX, 0.1, letterSpacing, 'px') +
          rangeHtml('sig-gap', 'تحريك التوقيع يمين/يسار', H_SHIFT_MIN, H_SHIFT_MAX, 1, horizontalShift, 'px') +
          '<div class="sig-mini-buttons" data-text-align-box>' + textAlignButtons + '</div>' +
          '</div>';
      }

      panel.innerHTML =
        '<h4>تنسيق التواقيع (' + count + ' توقيع في هذه الصفحة)</h4>' +
        globalHtml + groupsHtml +
        '<div class="sig-actions"><button type="button" class="sig-save">حفظ</button><button type="button" class="sig-reset">استعادة الافتراضي</button></div>';

      var rowGapInput = panel.querySelector('.sig-row-gap');
      if (rowGapInput) rowGapInput.oninput = function () {
        draft.rowGap = Number(rowGapInput.value);
        setRowValue(rowGapInput.closest('.sig-row'), draft.rowGap, 'px');
        applyStyles(doc, draft);
      };

      var rowTopInput = panel.querySelector('.sig-row-top');
      if (rowTopInput) rowTopInput.oninput = function () {
        draft.rowTopMargin = Number(rowTopInput.value);
        setRowValue(rowTopInput.closest('.sig-row'), draft.rowTopMargin, 'px');
        applyStyles(doc, draft);
      };

      panel.querySelectorAll('.sig-group').forEach(function (g) {
        var idx = Number(g.getAttribute('data-idx'));
        var cfg = getSlot(draft, idx);

        function bindRange(selector, prop, suffix, cast) {
          var input = g.querySelector(selector);
          if (!input) return;
          input.oninput = function () {
            cfg[prop] = cast ? cast(input.value) : Number(input.value);
            setRowValue(input.closest('.sig-row'), cfg[prop], suffix);
            applyStyles(doc, draft);
          };
        }

        bindRange('.sig-title-font', 'titleFontSize', 'px');
        bindRange('.sig-name-font', 'nameFontSize', 'px');
        bindRange('.sig-title-weight', 'titleWeight', '', function (v) { return Math.round(Number(v)); });
        bindRange('.sig-name-weight', 'nameWeight', '', function (v) { return Math.round(Number(v)); });
        bindRange('.sig-title-name-gap', 'titleNameGap', 'px');
        bindRange('.sig-line-height', 'lineHeight', '');
        bindRange('.sig-letter-spacing', 'letterSpacing', 'px');
        bindRange('.sig-gap', 'gapBefore', 'px');

        g.querySelectorAll('[data-text-align]').forEach(function (b) {
          b.onclick = function () {
            var val = b.getAttribute('data-text-align');
            cfg.textAlign = cfg.textAlign === val ? null : val;
            applyStyles(doc, draft);
            render();
          };
        });
      });

      panel.querySelector('.sig-save').onclick = function () {
        writeSettings(draft);
        toggle.textContent = 'تم الحفظ';
        setTimeout(function () { toggle.textContent = 'تنسيق التواقيع'; }, 1400);
      };

      panel.querySelector('.sig-reset').onclick = function () {
        draft = defaults();
        for (var k2 = 0; k2 < count; k2++) getSlot(draft, k2);
        writeSettings(draft);
        applyStyles(doc, draft);
        render();
      };
    }

    render();

    toggle.onclick = function () {
      panel.classList.toggle('open');
      if (panel.classList.contains('open')) {
        try {
          var firstTitle = doc.querySelector('.sig-title, .sig-role');
          if (firstTitle) {
            var target = firstTitle;
            if (target.scrollIntoView) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            var prevOutline = target.style.outline, prevOffset = target.style.outlineOffset, prevTransition = target.style.transition;
            target.style.transition = 'outline-color .25s ease';
            target.style.outline = '3px solid #2563eb';
            target.style.outlineOffset = '4px';
            setTimeout(function () {
              target.style.outline = prevOutline || '';
              target.style.outlineOffset = prevOffset || '';
              setTimeout(function () { target.style.transition = prevTransition || ''; }, 300);
            }, 1400);
          }
        } catch (_) {}
      }
    };
  }

  function hasSaudiNamesRebuildPage(doc) {
    try {
      var titles = doc.querySelectorAll('.title');
      for (var i = 0; i < titles.length; i++) {
        if (String(titles[i].textContent || '').replace(/\s+/g, ' ').trim() === 'بيان أسماء السعوديين') return true;
      }
    } catch (_) {}
    return false;
  }

  function onSignatureWindow(win) {
    try {
      var doc = win.document;
      if (!doc || !doc.body) return false;
      if (hasSaudiNamesRebuildPage(doc)) return false;

      var count = applyStyles(doc, readSettings());
      if (count > 0) buildPanel(doc, count);
      return count > 0;
    } catch (_) { return false; }
  }

  var nativeOpen = window.open;
  window.open = function () {
    var win = nativeOpen.apply(window, arguments);
    if (win) {
      var attempts = 0;
      var poll = setInterval(function () {
        attempts++;
        var done = false;
        try { done = win.closed || onSignatureWindow(win); } catch (_) {}
        if (done || attempts > 40) clearInterval(poll);
      }, 150);
    }
    return win;
  };
})();
