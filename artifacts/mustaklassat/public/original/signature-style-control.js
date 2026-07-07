/* signature-style-control.js — V5 persistent approved save
 * الأداة الموحدة للتحكم في شكل التواقيع داخل نوافذ الطباعة.
 * لا تضيف محرك خطابات جديد ولا تتدخل في الحسابات؛ فقط تمسك نافذة الطباعة
 * وتطبق تنسيقًا محفوظًا على عناصر التوقيع الحقيقية: .sig-title/.sig-role و.sig-name.
 */
(function () {
  'use strict';
  if (window.__NAJRAN_SIGNATURE_STYLE_CONTROL_V2__) return;
  window.__NAJRAN_SIGNATURE_STYLE_CONTROL_V2__ = true;

  var KEY = 'najranSignatureStyleSettings_v1';
  var UI_KEY = 'najranSignatureStyleUiPosition_v1';
  var MAX_SIGS = 24;

  var FONT_MIN = 6, FONT_MAX = 44;
  var WEIGHT_MIN = 100, WEIGHT_MAX = 900;
  var H_SHIFT_MIN = -180, H_SHIFT_MAX = 180;
  var Y_SHIFT_MIN = -160, Y_SHIFT_MAX = 220;
  var TITLE_NAME_GAP_MIN = -40, TITLE_NAME_GAP_MAX = 140;
  var LINE_MIN = 0.8, LINE_MAX = 3;
  var LETTER_MIN = -2, LETTER_MAX = 8;
  var SIGNATURE_GAP_MIN = -80, SIGNATURE_GAP_MAX = 180;
  var BLOCK_Y_MIN = -180, BLOCK_Y_MAX = 280;
  var LINE_LENGTH_MIN = 20, LINE_LENGTH_MAX = 320;
  var LINE_NAME_GAP_MIN = -30, LINE_NAME_GAP_MAX = 80;

  function defaultSlot() {
    return {
      // مفاتيح قديمة محفوظة للتوافق مع إعدادات المستخدم السابقة.
      fontSize: null,
      bold: null,

      // التحكمات التفصيلية الحالية.
      titleFontSize: null,
      nameFontSize: null,
      titleWeight: null,
      nameWeight: null,
      titleNameGap: null,
      lineHeight: null,
      letterSpacing: null,
      gapBefore: 0,
      yShift: 0,
      textAlign: null,
      newLine: false,
      signatureLineVisible: null,
      signatureLineLength: null,
      signatureLineGap: null
    };
  }

function defaults() {
  return {
    version: 5,
    approved: false,
    savedAt: null,
    resetAt: null,
    containerAlign: null,
    rowGap: null,
    rowTopMargin: null,
    perSignature: []
  };
}

  function defaultTogglePos(win) {
    return { left: 16, top: 16 };
  }

  function defaultPanelPos(win) {
    return { left: 16, top: 62, collapsed: false };
  }

  function defaultUi(win) {
    return {
      version: 1,
      toggle: defaultTogglePos(win),
      panel: defaultPanelPos(win)
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

  function safeContainerAlign(v) {
    return ['right', 'left', 'center', 'distribute'].indexOf(v) > -1 ? v : null;
  }

  function safeLineVisible(v) {
    return ['show', 'hide'].indexOf(v) > -1 ? v : null;
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

    out.titleFontSize = clampInt(raw.titleFontSize, FONT_MIN, FONT_MAX);
    out.nameFontSize = clampInt(raw.nameFontSize, FONT_MIN, FONT_MAX);
    out.titleWeight = clampInt(raw.titleWeight, WEIGHT_MIN, WEIGHT_MAX);
    out.nameWeight = clampInt(raw.nameWeight, WEIGHT_MIN, WEIGHT_MAX);
    out.titleNameGap = clampInt(raw.titleNameGap, TITLE_NAME_GAP_MIN, TITLE_NAME_GAP_MAX);
    out.lineHeight = clamp(raw.lineHeight, LINE_MIN, LINE_MAX);
    out.letterSpacing = clamp(raw.letterSpacing, LETTER_MIN, LETTER_MAX);
    out.gapBefore = clampInt(raw.gapBefore, H_SHIFT_MIN, H_SHIFT_MAX) || 0;
    out.yShift = clampInt(raw.yShift, Y_SHIFT_MIN, Y_SHIFT_MAX) || 0;
    out.textAlign = safeAlign(raw.textAlign);
    out.newLine = raw.newLine === true;
    out.signatureLineVisible = safeLineVisible(raw.signatureLineVisible);
    out.signatureLineLength = clampInt(raw.signatureLineLength, LINE_LENGTH_MIN, LINE_LENGTH_MAX);
    out.signatureLineGap = clampInt(raw.signatureLineGap, LINE_NAME_GAP_MIN, LINE_NAME_GAP_MAX);

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
d.approved = p.approved === true;
d.savedAt = typeof p.savedAt === 'string' ? p.savedAt : null;
d.resetAt = typeof p.resetAt === 'string' ? p.resetAt : null;
      d.containerAlign = safeContainerAlign(p.containerAlign);
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
      s.version = 5;
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch (_) {}
  }

  function normalizePoint(raw, fallback, win, maxW, maxH) {
    raw = raw && typeof raw === 'object' ? raw : {};
    fallback = fallback || { left: 16, top: 16 };
    var left = clampInt(raw.left, 4, Math.max(4, (win.innerWidth || 900) - (maxW || 80) - 4));
    var top = clampInt(raw.top, 4, Math.max(4, (win.innerHeight || 700) - (maxH || 40) - 4));
    return {
      left: left === null ? fallback.left : left,
      top: top === null ? fallback.top : top,
      collapsed: raw.collapsed === true
    };
  }

  function readUi(win) {
    var d = defaultUi(win || window);
    try {
      var raw = localStorage.getItem(UI_KEY);
      if (!raw) return d;
      var p = JSON.parse(raw);
      if (!p || typeof p !== 'object') return d;
      d.toggle = normalizePoint(p.toggle, d.toggle, win || window, 160, 48);
      d.panel = normalizePoint(p.panel, d.panel, win || window, 470, 320);
      d.panel.collapsed = !!(p.panel && p.panel.collapsed);
    } catch (_) {}
    return d;
  }

  function writeUi(ui) {
    try {
      ui.version = 1;
      localStorage.setItem(UI_KEY, JSON.stringify(ui));
    } catch (_) {}
  }

  function alignToJustify(a) {
    if (a === 'right') return 'flex-end';
    if (a === 'left') return 'flex-start';
    if (a === 'center') return 'center';
    if (a === 'distribute') return 'space-between';
    return '';
  }

  function findSignatureLine(holder) {
    if (!holder || !holder.querySelector) return null;
    return holder.querySelector('.sig-line,.signature-line,.sign-line,.sig-rule,.signature-rule,hr');
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
        holder: holder,
        row: row,
        title: title,
        name: holder.querySelector('.sig-name'),
        line: findSignatureLine(holder),
        globalIndex: globalIndex
      });
      globalIndex++;
    }

    return rows;
  }

  function resetSignatureElements(entry) {
    [entry.title, entry.name].forEach(function (el) {
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

    if (entry.line) {
      entry.line.style.display = '';
      entry.line.style.width = '';
      entry.line.style.maxWidth = '';
      entry.line.style.marginTop = '';
      entry.line.style.marginBottom = '';
      entry.line.style.marginInlineStart = '';
      entry.line.style.marginInlineEnd = '';
      entry.line.style.transform = '';
    }

    if (entry.holder) {
      entry.holder.style.marginInlineStart = '';
      entry.holder.style.gridColumn = '';
      entry.holder.style.flexBasis = '';
      entry.holder.style.textAlign = '';
      entry.holder.style.minWidth = '';
    }
  }

  function applyTextAlignToLine(line, align) {
    if (!line || !align) return;
    if (align === 'center') {
      line.style.marginInlineStart = 'auto';
      line.style.marginInlineEnd = 'auto';
    } else if (align === 'left') {
      line.style.marginInlineStart = '0';
      line.style.marginInlineEnd = 'auto';
    } else if (align === 'right') {
      line.style.marginInlineStart = 'auto';
      line.style.marginInlineEnd = '0';
    }
  }

  function applyLine(entry, cfg, translateX, translateY) {
    var line = entry.line;
    if (!line) return;

    if (cfg.signatureLineVisible === 'hide') line.style.display = 'none';
    if (cfg.signatureLineVisible === 'show') line.style.display = 'block';
    if (cfg.signatureLineLength !== null) {
      line.style.width = cfg.signatureLineLength + 'px';
      line.style.maxWidth = cfg.signatureLineLength + 'px';
    }
    if (cfg.signatureLineGap !== null && entry.name) entry.name.style.marginTop = cfg.signatureLineGap + 'px';
    if (cfg.textAlign) applyTextAlignToLine(line, cfg.textAlign);
    if (translateX || translateY) line.style.transform = 'translate(' + translateX + 'px, ' + translateY + 'px)';
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

  function resetRow(row) {
    if (!row) return;
    row.style.justifyContent = '';
    row.style.alignItems = '';
    row.style.gap = '';
    row.style.columnGap = '';
    row.style.rowGap = '';
    row.style.flexWrap = '';
  }

  function applyStyles(doc, settings) {
    settings = settings || readSettings();
    var groups = findSignatureRows(doc);
    var blockY = settings.rowTopMargin === null ? 0 : settings.rowTopMargin;
    var signatureGap = settings.rowGap === null ? 0 : settings.rowGap;
    var rowAlign = alignToJustify(settings.containerAlign);

    groups.forEach(function (g) {
      resetRow(g.row);
      if (rowAlign) g.row.style.justifyContent = rowAlign;
      if (signatureGap !== 0) {
        g.row.style.gap = signatureGap + 'px';
        g.row.style.columnGap = signatureGap + 'px';
      }

      var usesFlexBreak = false;
      g.cells.forEach(function (entry) {
        resetSignatureElements(entry);
        if (entry.globalIndex >= MAX_SIGS) return;

        var cfg = settings.perSignature[entry.globalIndex];
        if (!cfg) return;

        var shiftX = cfg.gapBefore || 0;
        var shiftY = blockY + (cfg.yShift || 0);

        if (cfg.textAlign && entry.holder) entry.holder.style.textAlign = cfg.textAlign;
        if (cfg.newLine && g.cells.length > 1 && entry.holder) {
          var disp = (doc.defaultView || window).getComputedStyle(g.row).display;
          if (disp === 'grid') entry.holder.style.gridColumn = '1 / -1';
          else {
            usesFlexBreak = true;
            entry.holder.style.flexBasis = '100%';
          }
        }

        applyToElement(entry.title, cfg, true, shiftX, shiftY);
        applyToElement(entry.name, cfg, false, shiftX, shiftY);
        applyLine(entry, cfg, shiftX, shiftY);
      });

      if (usesFlexBreak && g.row) {
        g.row.style.display = 'flex';
        g.row.style.flexWrap = 'wrap';
      }
    });

    return groups.reduce(function (n, g) { return n + g.cells.length; }, 0);
  }

  function panelStyles(doc) {
    if (doc.getElementById('najran-sig-panel-style-v2')) return;
    var style = doc.createElement('style');
    style.id = 'najran-sig-panel-style-v2';
    style.textContent = [
      '#najran-sig-toggle{position:fixed;top:16px;left:16px;z-index:99998;background:#0f766e;color:#fff;border:none;border-radius:999px;padding:10px 18px;font-family:Tajawal,Arial,sans-serif;font-weight:800;font-size:14px;cursor:move;box-shadow:0 6px 18px rgba(15,118,110,.4);user-select:none;touch-action:none}',
      '#najran-sig-panel{position:fixed;top:62px;left:16px;z-index:99999;background:#fff;border:2px solid #0f766e;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.28);font-family:Tajawal,Arial,sans-serif;direction:rtl;width:470px;max-height:82vh;overflow:auto;padding:0;display:none;color:#0f172a}',
      '#najran-sig-panel.open{display:block}',
      '#najran-sig-panel.collapsed{height:auto;overflow:hidden}',
      '#najran-sig-panel.collapsed .sig-panel-body{display:none}',
      '#najran-sig-panel .sig-panel-head{display:flex;align-items:center;gap:6px;padding:10px 12px;background:#ecfdf5;border-bottom:1px solid #99f6e4;cursor:move;user-select:none;touch-action:none}',
      '#najran-sig-panel .sig-panel-head h4{margin:0;font-size:15px;color:#0f766e;flex:1}',
      '#najran-sig-panel .sig-panel-head button,#najran-sig-panel .sig-panel-tools button{border:1px solid #cbd5e1;background:#f8fafc;color:#334155;border-radius:7px;padding:5px 8px;font-size:11px;font-weight:800;cursor:pointer}',
      '#najran-sig-panel .sig-panel-body{padding:12px 14px}',
      '#najran-sig-panel .sig-panel-tools{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px}',
      '#najran-sig-panel .sig-global{border:1px solid #99f6e4;background:#ecfdf5;border-radius:10px;padding:8px 10px;margin:8px 0 12px}',
      '#najran-sig-panel .sig-group{border:1px dashed #cbd5e1;border-radius:10px;padding:8px 10px;margin-bottom:10px;background:#fff}',
      '#najran-sig-panel .sig-group b,#najran-sig-panel .sig-global b{display:block;font-size:13px;margin-bottom:6px;color:#334155}',
      '#najran-sig-panel .sig-row{display:grid;grid-template-columns:132px 1fr 58px;align-items:center;gap:8px;margin-bottom:6px;font-size:12px;color:#475569}',
      '#najran-sig-panel .sig-row input[type=range]{width:100%}',
      '#najran-sig-panel .sig-row span{min-width:50px;text-align:left;font-weight:800;color:#0f766e}',
      '#najran-sig-panel .sig-check{display:flex;align-items:center;gap:6px;font-size:12px;color:#475569;margin:5px 0 7px}',
      '#najran-sig-panel .sig-mini-buttons{display:flex;gap:6px;flex-wrap:wrap;margin:5px 0 7px}',
      '#najran-sig-panel .sig-mini-buttons button{border:1px solid #cbd5e1;background:#f8fafc;border-radius:7px;padding:5px 8px;font-size:11px;font-weight:800;cursor:pointer}',
      '#najran-sig-panel .sig-mini-buttons button.active{background:#0f766e;color:#fff;border-color:#0f766e}',
      '#najran-sig-panel .sig-actions{display:flex;gap:8px;margin-top:8px}',
      '#najran-sig-panel .sig-actions button{flex:1;border:none;border-radius:8px;padding:8px;font-weight:800;font-size:13px;cursor:pointer}',
      '#najran-sig-panel .sig-save{background:#0f766e;color:#fff}',
      '#najran-sig-panel .sig-reset{background:#f1f5f9;color:#475569}',
      '@media(max-width:700px){#najran-sig-panel{right:8px;left:8px!important;width:auto;max-width:none}}',
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

  function applyPoint(el, point) {
    if (!el || !point) return;
    el.style.left = point.left + 'px';
    el.style.top = point.top + 'px';
    el.style.right = 'auto';
    el.style.bottom = 'auto';
  }

  function clampToViewport(win, left, top, el) {
    var w = Math.max(60, el && el.offsetWidth ? el.offsetWidth : 120);
    var h = Math.max(32, el && el.offsetHeight ? el.offsetHeight : 44);
    return {
      left: Math.max(4, Math.min((win.innerWidth || 900) - w - 4, Math.round(left))),
      top: Math.max(4, Math.min((win.innerHeight || 700) - h - 4, Math.round(top)))
    };
  }

  function makeDraggable(doc, el, handle, done) {
    if (!el || !handle || handle.__najranDragBound) return;
    handle.__najranDragBound = true;
    var win = doc.defaultView || window;

    handle.addEventListener('pointerdown', function (ev) {
      if (ev.button != null && ev.button !== 0) return;
      var target = ev.target;
      if (target && /^(INPUT|TEXTAREA|SELECT|OPTION)$/.test(target.tagName || '')) return;
      if (target && target.closest && target.closest('button') && target !== handle) return;

      var startX = ev.clientX;
      var startY = ev.clientY;
      var rect = el.getBoundingClientRect();
      var moved = false;

      function move(e) {
        var dx = e.clientX - startX;
        var dy = e.clientY - startY;
        if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
        var p = clampToViewport(win, rect.left + dx, rect.top + dy, el);
        applyPoint(el, p);
        if (moved) {
          el.__najranWasDragged = true;
          e.preventDefault();
        }
      }

      function up() {
        win.removeEventListener('pointermove', move, true);
        win.removeEventListener('pointerup', up, true);
        if (moved && typeof done === 'function') {
          var r = el.getBoundingClientRect();
          done(clampToViewport(win, r.left, r.top, el));
          setTimeout(function () { el.__najranWasDragged = false; }, 80);
        }
      }

      win.addEventListener('pointermove', move, true);
      win.addEventListener('pointerup', up, true);
    });
  }

  function dockPanel(doc, panel, ui, place) {
    var win = doc.defaultView || window;
    var width = panel.offsetWidth || 470;
    var height = panel.offsetHeight || 320;
    var p;
    if (place === 'right') p = { left: (win.innerWidth || 900) - width - 16, top: 62 };
    else if (place === 'top') p = { left: ((win.innerWidth || 900) - width) / 2, top: 12 };
    else if (place === 'bottom') p = { left: ((win.innerWidth || 900) - width) / 2, top: (win.innerHeight || 700) - height - 16 };
    else p = { left: 16, top: 62 };
    ui.panel = Object.assign(ui.panel || {}, clampToViewport(win, p.left, p.top, panel));
    writeUi(ui);
    applyPoint(panel, ui.panel);
  }

  function buildPanel(doc, count) {
    if (doc.getElementById('najran-sig-panel')) return;
    panelStyles(doc);

    var win = doc.defaultView || window;
    var draft = readSettings();
    var ui = readUi(win);
    for (var k = 0; k < count; k++) getSlot(draft, k);

    var toggle = doc.createElement('button');
    toggle.id = 'najran-sig-toggle';
    toggle.type = 'button';
    toggle.textContent = 'تنسيق التواقيع V5 حفظ دائم';
    doc.body.appendChild(toggle);
    applyPoint(toggle, ui.toggle);

    var panel = doc.createElement('div');
    panel.id = 'najran-sig-panel';
    doc.body.appendChild(panel);
    applyPoint(panel, ui.panel);
    panel.classList.toggle('collapsed', !!ui.panel.collapsed);

    makeDraggable(doc, toggle, toggle, function (p) {
      ui = readUi(win);
      ui.toggle = p;
      writeUi(ui);
    });

    var ORDINALS = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
    var TEXT_ALIGN_LABELS = [['right', 'يمين'], ['center', 'وسط'], ['left', 'يسار']];
    var ROW_ALIGN_LABELS = [['right', 'يمين'], ['center', 'وسط'], ['left', 'يسار'], ['distribute', 'توزيع']];
    var LINE_VISIBLE_LABELS = [[null, 'الأصلي'], ['show', 'إظهار'], ['hide', 'إخفاء']];

    function sigLabel(i) {
      return 'التوقيع ' + (ORDINALS[i] || '#' + (i + 1));
    }

    function render() {
      ui = readUi(win);
      var rowGap = draft.rowGap === null ? 0 : draft.rowGap;
      var rowTop = draft.rowTopMargin === null ? 0 : draft.rowTopMargin;
      var collapsed = !!(ui.panel && ui.panel.collapsed);

      var rowAlignButtons = ROW_ALIGN_LABELS.map(function (a) {
        return '<button type="button" data-row-align="' + a[0] + '" class="' + (draft.containerAlign === a[0] ? 'active' : '') + '">' + a[1] + '</button>';
      }).join('');

      var globalHtml = '<div class="sig-global"><b>تحكم عام في صف التوقيعات</b>' +
        '<div class="sig-mini-buttons">' + rowAlignButtons + '</div>' +
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
        var verticalShift = cfg.yShift || 0;
        var lineLength = cfg.signatureLineLength !== null ? cfg.signatureLineLength : 120;
        var lineNameGap = cfg.signatureLineGap !== null ? cfg.signatureLineGap : 6;

        var textAlignButtons = TEXT_ALIGN_LABELS.map(function (a) {
          return '<button type="button" data-text-align="' + a[0] + '" class="' + (cfg.textAlign === a[0] ? 'active' : '') + '">' + a[1] + '</button>';
        }).join('');

        var lineVisibleButtons = LINE_VISIBLE_LABELS.map(function (a) {
          var val = a[0] === null ? '' : a[0];
          var active = (a[0] === null && !cfg.signatureLineVisible) || cfg.signatureLineVisible === a[0];
          return '<button type="button" data-line-visible="' + val + '" class="' + (active ? 'active' : '') + '">' + a[1] + '</button>';
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
          rangeHtml('sig-gap', 'تحريك يمين/يسار', H_SHIFT_MIN, H_SHIFT_MAX, 1, horizontalShift, 'px') +
          rangeHtml('sig-y-shift', 'رفع/تنزيل هذا التوقيع', Y_SHIFT_MIN, Y_SHIFT_MAX, 1, verticalShift, 'px') +
          '<div class="sig-mini-buttons"><span>محاذاة التوقيع:</span>' + textAlignButtons + '</div>' +
          '<div class="sig-mini-buttons"><span>خط التوقيع:</span>' + lineVisibleButtons + '</div>' +
          rangeHtml('sig-line-length', 'طول خط التوقيع', LINE_LENGTH_MIN, LINE_LENGTH_MAX, 1, lineLength, 'px') +
          rangeHtml('sig-line-name-gap', 'بين الخط والاسم', LINE_NAME_GAP_MIN, LINE_NAME_GAP_MAX, 1, lineNameGap, 'px') +
          '<label class="sig-check"><input type="checkbox" class="sig-newline" ' + (cfg.newLine ? 'checked' : '') + '> بدء هذا التوقيع في سطر جديد</label>' +
          '</div>';
      }

      panel.classList.toggle('collapsed', collapsed);
      panel.innerHTML =
        '<div class="sig-panel-head"><h4>تنسيق التواقيع (' + count + ')</h4><button type="button" class="sig-collapse">' + (collapsed ? 'فتح' : 'طي') + '</button></div>' +
        '<div class="sig-panel-body">' +
        '<div class="sig-panel-tools">' +
        '<button type="button" class="sig-reset-toggle-pos">إعادة مكان الزر</button>' +
        '<button type="button" class="sig-reset-panel-pos">إعادة مكان اللوحة</button>' +
        '<button type="button" data-panel-place="left">اللوحة يسار</button>' +
        '<button type="button" data-panel-place="right">اللوحة يمين</button>' +
        '<button type="button" data-panel-place="top">اللوحة أعلى</button>' +
        '<button type="button" data-panel-place="bottom">اللوحة أسفل</button>' +
        '</div>' + globalHtml + groupsHtml +
        '<div class="sig-actions"><button type="button" class="sig-save">حفظ</button><button type="button" class="sig-reset">استعادة الافتراضي</button></div>' +
        '</div>';

      makeDraggable(doc, panel, panel.querySelector('.sig-panel-head'), function (p) {
        ui = readUi(win);
        ui.panel.left = p.left;
        ui.panel.top = p.top;
        writeUi(ui);
      });

      var collapseBtn = panel.querySelector('.sig-collapse');
      if (collapseBtn) collapseBtn.onclick = function () {
        ui = readUi(win);
        ui.panel.collapsed = !ui.panel.collapsed;
        writeUi(ui);
        render();
      };

      var resetToggle = panel.querySelector('.sig-reset-toggle-pos');
      if (resetToggle) resetToggle.onclick = function () {
        ui = readUi(win);
        ui.toggle = defaultTogglePos(win);
        writeUi(ui);
        applyPoint(toggle, ui.toggle);
      };

      var resetPanel = panel.querySelector('.sig-reset-panel-pos');
      if (resetPanel) resetPanel.onclick = function () {
        ui = readUi(win);
        ui.panel = defaultPanelPos(win);
        writeUi(ui);
        applyPoint(panel, ui.panel);
        render();
      };

      panel.querySelectorAll('[data-panel-place]').forEach(function (b) {
        b.onclick = function () { dockPanel(doc, panel, ui, b.getAttribute('data-panel-place')); };
      });

      panel.querySelectorAll('[data-row-align]').forEach(function (b) {
        b.onclick = function () {
          var val = b.getAttribute('data-row-align');
          draft.containerAlign = draft.containerAlign === val ? null : val;
          applyStyles(doc, draft);
          render();
        };
      });

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
        bindRange('.sig-y-shift', 'yShift', 'px');
        bindRange('.sig-line-length', 'signatureLineLength', 'px', function (v) { return Math.round(Number(v)); });
        bindRange('.sig-line-name-gap', 'signatureLineGap', 'px');

        g.querySelectorAll('[data-text-align]').forEach(function (b) {
          b.onclick = function () {
            var val = b.getAttribute('data-text-align');
            cfg.textAlign = cfg.textAlign === val ? null : val;
            applyStyles(doc, draft);
            render();
          };
        });

        g.querySelectorAll('[data-line-visible]').forEach(function (b) {
          b.onclick = function () {
            var val = b.getAttribute('data-line-visible') || null;
            cfg.signatureLineVisible = val;
            applyStyles(doc, draft);
            render();
          };
        });

        var newLineInput = g.querySelector('.sig-newline');
        if (newLineInput) newLineInput.onchange = function () {
          cfg.newLine = newLineInput.checked;
          applyStyles(doc, draft);
        };
      });

  panel.querySelector('.sig-save').onclick = function () {
  draft.approved = true;
  draft.savedAt = new Date().toISOString();
  draft.resetAt = null;

  writeSettings(draft);
  applyStyles(doc, draft);

  var savedOk = false;
  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    savedOk = saved &&
      saved.approved === true &&
      saved.savedAt === draft.savedAt &&
      Array.isArray(saved.perSignature);
  } catch (_) {}

  panel.classList.remove('open');

  toggle.textContent = savedOk
    ? 'تم حفظ واعتماد التنسيق V5'
    : 'لم يتم الحفظ — راجع التخزين';

  setTimeout(function () {
    toggle.textContent = 'تنسيق التواقيع V5 حفظ دائم';
  }, 1800);
};

 panel.querySelector('.sig-reset').onclick = function () {
  draft = defaults();
  draft.approved = false;
  draft.resetAt = new Date().toISOString();
  draft.savedAt = null;

  for (var k2 = 0; k2 < count; k2++) getSlot(draft, k2);

  writeSettings(draft);
  applyStyles(doc, draft);
  render();

  toggle.textContent = 'تمت استعادة الافتراضي V5';

  setTimeout(function () {
    toggle.textContent = 'تنسيق التواقيع V5 حفظ دائم';
  }, 1600);
};

 
    toggle.onclick = function () {
      if (toggle.__najranWasDragged) return;
      panel.classList.toggle('open');
      if (panel.classList.contains('open')) {
        try {
          applyPoint(panel, readUi(win).panel);
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
            }, 1200);
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
    console.info('[SignatureStyleControl] V5 persistent approved save installed');
})();
