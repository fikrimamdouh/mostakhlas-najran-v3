/* signature-style-control.js — V1
 * أداة موحدة للتحكم في شكل التواقيع (محاذاة/حجم/مسافة/بولد/سطر جديد) عبر
 * كل أنظمة الخطابات الأربعة في البرنامج، بدون تعديل أي محرك خطابات موجود.
 *
 * الفكرة: كل محركات الخطابات (مستهلكات المستشفى، خطابات عامة، مكاتب إدارية
 * عمالة، مكاتب إدارية مستهلكات) تفتح نافذة طباعة منفصلة عبر
 * window.open('', ...) ثم win.document.write(...) وتستخدم نفس تسمية
 * الأصناف: .sig-title (أو .sig-role في محرك الخطابات العامة) و.sig-name داخل خلية توقيع واحدة (الأب المباشر).
 *
 * هذا الملف:
 *  1) يعترض window.open ليمسك نافذة الطباعة فور فتحها.
 *  2) يطبّق إعدادات التنسيق المحفوظة تلقائيًا على أي توقيعات يجدها (بدون
 *     أي تدخل من المستخدم — "إعداد مرة، وتفعيل تلقائي بعدها في كل خطاب").
 *  3) يضيف زر عائم داخل نافذة الطباعة نفسها لضبط التنسيق بمعاينة حية فورية
 *     (تعديل العناصر الحقيقية مباشرة، مثل تحريك مسطرة Word).
 *  4) الإعدادات تُحفظ في localStorage الصفحة الأصلية (فتُطبَّق تلقائيًا نفس
 *     الحماية بالمستخدم/المستشفى الموجودة أصلًا عبر user-storage-proxy.js،
 *     دون أي تعديل عليه).
 */
(function () {
  'use strict';
  if (window.__NAJRAN_SIGNATURE_STYLE_CONTROL_V1__) return;
  window.__NAJRAN_SIGNATURE_STYLE_CONTROL_V1__ = true;

  var KEY = 'najranSignatureStyleSettings_v1';
  var MAX_SIGS = 24; // سقف أمان فقط (صفحات "طباعة الكل" قد تجمّع خطابات كثيرة)
  var FONT_MIN = 10, FONT_MAX = 26;
  var GAP_MIN = -60, GAP_MAX = 140;

  function defaultSlot() { return { fontSize: null, bold: null, gapBefore: 0, newLine: false }; }

  function defaults() {
    return { version: 2, containerAlign: null, perSignature: [] };
  }

  function getSlot(settings, i) {
    while (settings.perSignature.length <= i) settings.perSignature.push(defaultSlot());
    return settings.perSignature[i];
  }

  function readSettings() {
    var d = defaults();
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return d;
      var p = JSON.parse(raw);
      if (!p || typeof p !== 'object') return d;
      d.containerAlign = ['right', 'left', 'center', 'distribute'].indexOf(p.containerAlign) > -1 ? p.containerAlign : null;
      if (Array.isArray(p.perSignature)) {
        for (var i = 0; i < Math.min(p.perSignature.length, MAX_SIGS); i++) {
          var s = p.perSignature[i];
          if (s && typeof s === 'object') {
            d.perSignature[i] = {
              fontSize: typeof s.fontSize === 'number' && s.fontSize >= FONT_MIN && s.fontSize <= FONT_MAX ? s.fontSize : null,
              bold: s.bold === true ? true : (s.bold === false ? false : null),
              gapBefore: typeof s.gapBefore === 'number' ? Math.max(GAP_MIN, Math.min(GAP_MAX, s.gapBefore)) : 0,
              newLine: s.newLine === true
            };
          } else {
            d.perSignature[i] = defaultSlot();
          }
        }
      }
    } catch (_) {}
    return d;
  }

  function writeSettings(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) {}
  }

  function clone(s) { return JSON.parse(JSON.stringify(s)); }

  function alignToJustify(a) {
    if (a === 'right') return 'end';
    if (a === 'left') return 'start';
    if (a === 'center') return 'center';
    if (a === 'distribute') return 'space-between';
    return '';
  }

  // يجمع خلايا التوقيع في صفوف حسب أقرب أب مشترك (لتطبيق المحاذاة على مستوى
  // الصف)، ويعطي كل خلية أيضًا فهرسًا تسلسليًا عبر المستند كله (globalIndex)
  // بترتيب ظهورها في الصفحة — فتوقيع "مدير المستشفى" في صف مستقل (خطاب آخر
  // ضمن "طباعة الكل" مثلًا) لا يشارك إعداد "التوقيع الأول" مع "مندوب المقاول"
  // في صف مختلف، حتى لو كان كلاهما أول توقيع في صفه.
  function findSignatureRows(doc) {
    var titles = doc.querySelectorAll('.sig-title, .sig-role');
    var rows = [];
    var rowIndex = new Map();
    var globalIndex = 0;
    for (var i = 0; i < titles.length; i++) {
      var cell = titles[i].parentElement;
      if (!cell) continue;
      var row = cell.parentElement;
      if (!row) continue;
      var idx = rowIndex.get(row);
      if (idx === undefined) { idx = rows.length; rowIndex.set(row, idx); rows.push({ row: row, cells: [] }); }
      rows[idx].cells.push({ cell: cell, globalIndex: globalIndex });
      globalIndex++;
    }
    return rows;
  }

  function resetInlineOverrides(cell) {
    var title = cell.querySelector('.sig-title, .sig-role');
    var name = cell.querySelector('.sig-name');
    if (title) { title.style.fontSize = ''; title.style.fontWeight = ''; }
    if (name) { name.style.fontSize = ''; name.style.fontWeight = ''; }
    cell.style.marginInlineStart = '';
    cell.style.gridColumn = '';
    cell.style.flexBasis = '';
  }

  function applyStyles(doc, settings) {
    settings = settings || readSettings();
    var groups = findSignatureRows(doc);
    groups.forEach(function (g) {
      var justify = alignToJustify(settings.containerAlign);
      g.row.style.justifyContent = justify || '';
      var usesFlexBreak = false;
      g.cells.forEach(function (entry) {
        var cell = entry.cell, i = entry.globalIndex;
        resetInlineOverrides(cell);
        if (i >= MAX_SIGS) return;
        var cfg = settings.perSignature[i];
        if (!cfg) return;
        var title = cell.querySelector('.sig-title, .sig-role');
        var name = cell.querySelector('.sig-name');
        if (cfg.fontSize) {
          if (title) title.style.fontSize = cfg.fontSize + 'px';
          if (name) name.style.fontSize = cfg.fontSize + 'px';
        }
        if (cfg.bold === true) {
          if (title) title.style.fontWeight = '900';
          if (name) name.style.fontWeight = '900';
        } else if (cfg.bold === false) {
          if (title) title.style.fontWeight = '400';
          if (name) name.style.fontWeight = '400';
        }
        if (cfg.gapBefore) cell.style.marginInlineStart = cfg.gapBefore + 'px';
        if (cfg.newLine) {
          var disp = (doc.defaultView || window).getComputedStyle(g.row).display;
          if (disp === 'grid') cell.style.gridColumn = '1 / -1';
          else usesFlexBreak = true, cell.style.flexBasis = '100%';
        }
      });
      if (usesFlexBreak) { g.row.style.display = 'flex'; g.row.style.flexWrap = 'wrap'; }
    });
    var total = groups.reduce(function (n, g) { return n + g.cells.length; }, 0);
    return total;
  }

  // ─── لوحة التحكم — تُبنى داخل نافذة الطباعة، لكن القراءة/الحفظ من
  // localStorage الصفحة الأم (المحمي بنفس نظام الحماية بالمستخدم/المستشفى) ───
  function panelStyles(doc) {
    var style = doc.createElement('style');
    style.textContent = [
      '#najran-sig-toggle{position:fixed;bottom:16px;left:16px;z-index:99998;background:#0f766e;color:#fff;border:none;border-radius:999px;padding:10px 18px;font-family:Tajawal,Arial,sans-serif;font-weight:800;font-size:14px;cursor:pointer;box-shadow:0 6px 18px rgba(15,118,110,.4)}',
      '#najran-sig-panel{position:fixed;bottom:64px;left:16px;z-index:99999;background:#fff;border:2px solid #0f766e;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.28);font-family:Tajawal,Arial,sans-serif;direction:rtl;width:320px;max-height:80vh;overflow:auto;padding:14px 16px;display:none}',
      '#najran-sig-panel.open{display:block}',
      '#najran-sig-panel h4{margin:0 0 10px;font-size:15px;color:#0f766e}',
      '#najran-sig-panel .sig-align-row{display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap}',
      '#najran-sig-panel .sig-align-row button{flex:1;min-width:60px;border:1px solid #0f766e;background:#fff;color:#0f766e;border-radius:8px;padding:6px 4px;font-size:12px;font-weight:800;cursor:pointer}',
      '#najran-sig-panel .sig-align-row button.active{background:#0f766e;color:#fff}',
      '#najran-sig-panel .sig-group{border:1px dashed #cbd5e1;border-radius:10px;padding:8px 10px;margin-bottom:10px}',
      '#najran-sig-panel .sig-group b{display:block;font-size:13px;margin-bottom:6px;color:#334155}',
      '#najran-sig-panel .sig-row{display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:12px;color:#475569}',
      '#najran-sig-panel .sig-row input[type=range]{flex:1}',
      '#najran-sig-panel .sig-row span{min-width:38px;text-align:left;font-weight:800;color:#0f766e}',
      '#najran-sig-panel .sig-check{display:flex;align-items:center;gap:6px;font-size:12px;color:#475569;margin-bottom:4px}',
      '#najran-sig-panel .sig-actions{display:flex;gap:8px;margin-top:8px}',
      '#najran-sig-panel .sig-actions button{flex:1;border:none;border-radius:8px;padding:8px;font-weight:800;font-size:13px;cursor:pointer}',
      '#najran-sig-panel .sig-save{background:#0f766e;color:#fff}',
      '#najran-sig-panel .sig-reset{background:#f1f5f9;color:#475569}',
      '@media print{#najran-sig-toggle,#najran-sig-panel{display:none!important}}'
    ].join('\n');
    doc.head.appendChild(style);
  }

  function buildPanel(doc, count) {
    if (doc.getElementById('najran-sig-panel')) return;
    panelStyles(doc);
    var draft = readSettings();
    for (var k = 0; k < count; k++) getSlot(draft, k);

    var toggle = doc.createElement('button');
    toggle.id = 'najran-sig-toggle';
    toggle.type = 'button';
    toggle.textContent = '🖋 تنسيق التواقيع';
    doc.body.appendChild(toggle);

    var panel = doc.createElement('div');
    panel.id = 'najran-sig-panel';
    doc.body.appendChild(panel);

    var ORDINALS = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
    function sigLabel(i) { return 'التوقيع ' + (ORDINALS[i] || '#' + (i + 1)); }
    var ALIGN_LABELS = [['right', 'يمين'], ['left', 'يسار'], ['center', 'توسيط'], ['distribute', 'توزيع متساوٍ']];

    function render() {
      var alignBtns = ALIGN_LABELS.map(function (a) {
        return '<button type="button" data-align="' + a[0] + '" class="' + (draft.containerAlign === a[0] ? 'active' : '') + '">' + a[1] + '</button>';
      }).join('');

      var groupsHtml = '';
      for (var i = 0; i < count; i++) {
        var cfg = getSlot(draft, i);
        var fs = cfg.fontSize || 15;
        groupsHtml += '' +
          '<div class="sig-group" data-idx="' + i + '">' +
          '<b>' + sigLabel(i) + '</b>' +
          '<div class="sig-row"><label style="min-width:78px">حجم الخط</label>' +
          '<input type="range" class="sig-font" min="' + FONT_MIN + '" max="' + FONT_MAX + '" value="' + fs + '">' +
          '<span>' + fs + 'px</span></div>' +
          '<div class="sig-row"><label style="min-width:78px">المسافة (المسطرة)</label>' +
          '<input type="range" class="sig-gap" min="' + GAP_MIN + '" max="' + GAP_MAX + '" value="' + (cfg.gapBefore || 0) + '">' +
          '<span>' + (cfg.gapBefore || 0) + 'px</span></div>' +
          '<label class="sig-check"><input type="checkbox" class="sig-bold" ' + (cfg.bold === true ? 'checked' : '') + '> بولد</label>' +
          '<label class="sig-check"><input type="checkbox" class="sig-newline" ' + (cfg.newLine ? 'checked' : '') + '> سطر جديد قبل هذا التوقيع</label>' +
          '</div>';
      }

      panel.innerHTML =
        '<h4>تنسيق التواقيع (' + count + ' توقيع في هذه الصفحة — كل توقيع مستقل تمامًا، ويُحفظ ويُطبَّق تلقائيًا على كل الخطابات)</h4>' +
        '<div class="sig-align-row">' + alignBtns + '</div>' +
        groupsHtml +
        '<div class="sig-actions"><button type="button" class="sig-save">حفظ</button><button type="button" class="sig-reset">استعادة الافتراضي</button></div>';

      panel.querySelectorAll('[data-align]').forEach(function (b) {
        b.onclick = function () {
          draft.containerAlign = draft.containerAlign === b.getAttribute('data-align') ? null : b.getAttribute('data-align');
          applyStyles(doc, draft);
          render();
        };
      });
      panel.querySelectorAll('.sig-group').forEach(function (g) {
        var idx = Number(g.getAttribute('data-idx'));
        var cfg = getSlot(draft, idx);
        var fontInput = g.querySelector('.sig-font');
        var gapInput = g.querySelector('.sig-gap');
        var boldInput = g.querySelector('.sig-bold');
        var newLineInput = g.querySelector('.sig-newline');
        fontInput.oninput = function () {
          cfg.fontSize = Number(fontInput.value);
          g.querySelector('.sig-row:nth-child(2) span').textContent = cfg.fontSize + 'px';
          applyStyles(doc, draft);
        };
        gapInput.oninput = function () {
          cfg.gapBefore = Number(gapInput.value);
          g.querySelector('.sig-row:nth-child(3) span').textContent = cfg.gapBefore + 'px';
          applyStyles(doc, draft);
        };
        boldInput.onchange = function () { cfg.bold = boldInput.checked ? true : null; applyStyles(doc, draft); };
        newLineInput.onchange = function () { cfg.newLine = newLineInput.checked; applyStyles(doc, draft); };
      });
      panel.querySelector('.sig-save').onclick = function () {
        writeSettings(draft);
        toggle.textContent = '✓ تم الحفظ';
        setTimeout(function () { toggle.textContent = '🖋 تنسيق التواقيع'; }, 1400);
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
    toggle.onclick = function () { panel.classList.toggle('open'); };
  }

  function onSignatureWindow(win) {
    try {
      var doc = win.document;
      if (!doc || !doc.body) return false;
      var count = applyStyles(doc, readSettings());
      if (count > 0) buildPanel(doc, count);
      return count > 0;
    } catch (_) { return false; }
  }

  // اعتراض window.open لمسك نوافذ الطباعة المنبثقة فور فتحها — بدون أي
  // تعديل على دوال الطباعة نفسها في أي محرك خطابات.
  var nativeOpen = window.open;
  window.open = function () {
    var win = nativeOpen.apply(window, arguments);
    if (win) {
      var attempts = 0;
      var poll = setInterval(function () {
        attempts++;
        var done = false;
        try { done = win.closed || onSignatureWindow(win); } catch (_) {}
        if (done || attempts > 40) clearInterval(poll); // ~6 ثوانٍ كحد أقصى للانتظار
      }, 150);
    }
    return win;
  };
})();
