/* signature-block-fine-control.js — V1
 * تحكم دقيق إضافي (تكبير/تصغير، اتجاه يمين/يسار، مسافة) لنظام التواقيع
 * الموجود أصلًا في صفحات الحضور/الأداء/الإنجاز (signature-block.js)، بدون
 * أي تعديل على ذلك الملف أو أي محرك حضور/أداء/إنجاز.
 *
 * نظام signature-block.js يبني كل توقيع كـ:
 *   <div class="sb-item"><div class="sb-item-title">..</div><div class="sb-item-name">..</div></div>
 * داخل صف: <div class="sb-grid ...">.
 *
 * هذا الملف فقط "يراقب ويحسّن من برّه":
 *  - يكتشف أي .sb-item-title تظهر في الصفحة (عبر MutationObserver، لأن هذا
 *    النظام يرسم داخل نفس الصفحة مباشرة، وليس في نافذة طباعة منفصلة).
 *  - يعطي كل توقيع رقمًا تسلسليًا مستقلًا عبر الصفحة كلها (نفس فكرة أداة
 *    خطابات الرفع) فتكبير توقيع في جدول لا يؤثر على توقيع في جدول آخر.
 *  - يضيف أزرار [-]/[+] فقط (لا سلايدر) لثلاث خاصيات: الحجم، الاتجاه
 *    يمين/يسار، والمسافة بين توقيعات نفس الصف.
 */
(function () {
  'use strict';
  if (window.__NAJRAN_SIGNATURE_BLOCK_FINE_CONTROL_V1__) return;
  window.__NAJRAN_SIGNATURE_BLOCK_FINE_CONTROL_V1__ = true;

  var KEY = 'najranSignatureBlockFineControl_v1';
  var SIZE_STEP = 1, SIZE_MIN = 9, SIZE_MAX = 30;
  var OFFSET_STEP = 8, OFFSET_MIN = -120, OFFSET_MAX = 120;
  var GAP_STEP = 4, GAP_MIN = 0, GAP_MAX = 80;

  function defaults() { return { version: 1, bySignature: {}, byRow: {} }; }

  function readSettings() {
    var d = defaults();
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return d;
      var p = JSON.parse(raw);
      if (p && typeof p === 'object') {
        if (p.bySignature && typeof p.bySignature === 'object') d.bySignature = p.bySignature;
        if (p.byRow && typeof p.byRow === 'object') d.byRow = p.byRow;
      }
    } catch (_) {}
    return d;
  }

  function writeSettings(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) {} }

  function clampNum(v, lo, hi, fallback) {
    var n = Number(v);
    if (!isFinite(n)) return fallback;
    return Math.max(lo, Math.min(hi, n));
  }

  function sigSlot(settings, idx) {
    var s = settings.bySignature[idx];
    if (!s) { s = { fontSize: null, offsetX: 0 }; settings.bySignature[idx] = s; }
    return s;
  }
  function rowSlot(settings, idx) {
    var r = settings.byRow[idx];
    if (!r) { r = { gap: null }; settings.byRow[idx] = r; }
    return r;
  }

  // يجمع كل .sb-item في صفوف (.sb-grid) مع فهرس تسلسلي مستقل لكل توقيع عبر
  // الصفحة كلها (وليس فقط داخل صفه)، بنفس منطق أداة خطابات الرفع.
  function findSignatureGroups(root) {
    var titles = root.querySelectorAll('.sb-item-title');
    var rows = [];
    var rowIndex = new Map();
    var globalIndex = 0;
    for (var i = 0; i < titles.length; i++) {
      var cell = titles[i].closest ? titles[i].closest('.sb-item') : titles[i].parentElement;
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

  function applyFineStyles(root, settings) {
    settings = settings || readSettings();
    var groups = findSignatureGroups(root);
    groups.forEach(function (g, rowIdx) {
      var rcfg = settings.byRow[rowIdx];
      g.row.style.gap = rcfg && rcfg.gap != null ? rcfg.gap + 'px' : '';
      g.cells.forEach(function (entry) {
        var cell = entry.cell, i = entry.globalIndex;
        var cfg = settings.bySignature[i];
        var title = cell.querySelector('.sb-item-title');
        var name = cell.querySelector('.sb-item-name');
        if (cfg && cfg.fontSize) {
          cell.style.setProperty('--sb-title-size', cfg.fontSize + 'px');
          cell.style.setProperty('--sb-name-size', Math.max(SIZE_MIN, cfg.fontSize - 2) + 'px');
        } else {
          cell.style.removeProperty('--sb-title-size');
          cell.style.removeProperty('--sb-name-size');
        }
        cell.style.transform = cfg && cfg.offsetX ? 'translateX(' + cfg.offsetX + 'px)' : '';
      });
    });
    var total = groups.reduce(function (n, g) { return n + g.cells.length; }, 0);
    return { total: total, groups: groups };
  }

  function currentFontSize(cell) {
    try {
      var title = cell.querySelector('.sb-item-title');
      var v = (window.getComputedStyle(title).fontSize || '15px');
      return clampNum(parseFloat(v), SIZE_MIN, SIZE_MAX, 15);
    } catch (_) { return 15; }
  }

  // ─── لوحة تحكم بسيطة بأزرار +/- فقط (لا سلايدر) ───
  function panelStyles() {
    if (document.getElementById('najran-sbfine-style')) return;
    var style = document.createElement('style');
    style.id = 'najran-sbfine-style';
    style.textContent = [
      '#najran-sbfine-toggle{position:fixed;bottom:16px;left:170px;z-index:99998;background:#7c3aed;color:#fff;border:none;border-radius:999px;padding:10px 18px;font-family:Tajawal,Arial,sans-serif;font-weight:800;font-size:14px;cursor:pointer;box-shadow:0 6px 18px rgba(124,58,237,.4)}',
      '#najran-sbfine-panel{position:fixed;bottom:64px;left:170px;z-index:99999;background:#fff;border:2px solid #7c3aed;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.28);font-family:Tajawal,Arial,sans-serif;direction:rtl;width:300px;max-height:75vh;overflow:auto;padding:14px 16px;display:none}',
      '#najran-sbfine-panel.open{display:block}',
      '#najran-sbfine-panel h4{margin:0 0 10px;font-size:14px;color:#7c3aed}',
      '#najran-sbfine-panel .row-block{border:1px dashed #ddd6fe;border-radius:10px;padding:8px 10px;margin-bottom:10px}',
      '#najran-sbfine-panel .row-block>b{display:block;font-size:12px;color:#6d28d9;margin-bottom:6px}',
      '#najran-sbfine-panel .sig-block{border-top:1px solid #f1f5f9;padding-top:6px;margin-top:6px}',
      '#najran-sbfine-panel .sig-block b{display:block;font-size:12px;color:#334155;margin-bottom:4px}',
      '#najran-sbfine-panel .ctrl-row{display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:12px;color:#475569}',
      '#najran-sbfine-panel .ctrl-row label{min-width:56px}',
      '#najran-sbfine-panel .ctrl-row .val{min-width:44px;text-align:center;font-weight:800;color:#7c3aed}',
      '#najran-sbfine-panel button.step{width:28px;height:28px;border:1px solid #7c3aed;background:#fff;color:#7c3aed;border-radius:8px;font-weight:900;cursor:pointer;font-size:15px;line-height:1}',
      '#najran-sbfine-panel button.step:active{background:#7c3aed;color:#fff}',
      '#najran-sbfine-panel .reset-btn{width:100%;margin-top:6px;border:none;border-radius:8px;padding:7px;background:#f1f5f9;color:#475569;font-weight:800;font-size:12px;cursor:pointer}',
      '@media print{#najran-sbfine-toggle,#najran-sbfine-panel{display:none!important}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  var toggleEl = null, panelEl = null;

  function ensureButton() {
    if (toggleEl) return;
    panelStyles();
    toggleEl = document.createElement('button');
    toggleEl.id = 'najran-sbfine-toggle';
    toggleEl.type = 'button';
    toggleEl.textContent = '🖋 تحكم دقيق بالتواقيع';
    toggleEl.onclick = function () { panelEl.classList.toggle('open'); renderPanel(); };
    document.body.appendChild(toggleEl);

    panelEl = document.createElement('div');
    panelEl.id = 'najran-sbfine-panel';
    document.body.appendChild(panelEl);
  }

  function step(cfgGetter, key, delta, lo, hi, onChange) {
    var cfg = cfgGetter();
    var cur = cfg[key] == null ? (key === 'fontSize' ? 15 : 0) : cfg[key];
    cfg[key] = clampNum(cur + delta, lo, hi, cur);
    onChange();
  }

  function renderPanel() {
    if (!panelEl || !panelEl.classList.contains('open')) return;
    var settings = readSettings();
    var scan = applyFineStyles(document, settings);

    if (!scan.total) {
      panelEl.innerHTML = '<h4>لا توجد توقيعات في هذه الصفحة حاليًا</h4>';
      return;
    }

    var html = '<h4>تحكم دقيق بالتواقيع (' + scan.total + ' توقيع — كل توقيع مستقل ويُحفظ تلقائيًا)</h4>';
    scan.groups.forEach(function (g, rowIdx) {
      var rcfg = rowSlot(settings, rowIdx);
      html += '<div class="row-block" data-row="' + rowIdx + '">' +
        '<b>مسافة صف رقم ' + (rowIdx + 1) + '</b>' +
        '<div class="ctrl-row"><label>المسافة</label><button type="button" class="step" data-act="gap-" data-row="' + rowIdx + '">-</button><span class="val" data-gapval="' + rowIdx + '">' + (rcfg.gap == null ? 'افتراضي' : rcfg.gap + 'px') + '</span><button type="button" class="step" data-act="gap+" data-row="' + rowIdx + '">+</button></div>';
      g.cells.forEach(function (entry) {
        var i = entry.globalIndex;
        var cfg = sigSlot(settings, i);
        var fs = cfg.fontSize || currentFontSize(entry.cell);
        html += '<div class="sig-block" data-sig="' + i + '">' +
          '<b>توقيع #' + (i + 1) + '</b>' +
          '<div class="ctrl-row"><label>الحجم</label><button type="button" class="step" data-act="size-" data-sig="' + i + '">A-</button><span class="val" data-sizeval="' + i + '">' + fs + 'px</span><button type="button" class="step" data-act="size+" data-sig="' + i + '">A+</button></div>' +
          '<div class="ctrl-row"><label>الاتجاه</label><button type="button" class="step" data-act="left" data-sig="' + i + '">◀</button><span class="val" data-offval="' + i + '">' + (cfg.offsetX || 0) + 'px</span><button type="button" class="step" data-act="right" data-sig="' + i + '">▶</button></div>' +
          '</div>';
      });
      html += '</div>';
    });
    html += '<button type="button" class="reset-btn" id="najran-sbfine-reset">استعادة الافتراضي للكل</button>';
    panelEl.innerHTML = html;

    function persistAndApply() { writeSettings(settings); applyFineStyles(document, settings); }

    panelEl.querySelectorAll('button.step').forEach(function (btn) {
      btn.onclick = function () {
        var act = btn.getAttribute('data-act');
        if (act === 'gap-' || act === 'gap+') {
          var rIdx = Number(btn.getAttribute('data-row'));
          var rcfg2 = rowSlot(settings, rIdx);
          var base = rcfg2.gap == null ? 14 : rcfg2.gap;
          rcfg2.gap = clampNum(base + (act === 'gap+' ? GAP_STEP : -GAP_STEP), GAP_MIN, GAP_MAX, base);
          panelEl.querySelector('[data-gapval="' + rIdx + '"]').textContent = rcfg2.gap + 'px';
        } else {
          var sIdx = Number(btn.getAttribute('data-sig'));
          var scfg = sigSlot(settings, sIdx);
          if (act === 'size-' || act === 'size+') {
            var baseSize = scfg.fontSize == null ? currentFontSize(findCellByGlobalIndex(scan, sIdx)) : scfg.fontSize;
            scfg.fontSize = clampNum(baseSize + (act === 'size+' ? SIZE_STEP : -SIZE_STEP), SIZE_MIN, SIZE_MAX, baseSize);
            panelEl.querySelector('[data-sizeval="' + sIdx + '"]').textContent = scfg.fontSize + 'px';
          } else if (act === 'left' || act === 'right') {
            var baseOff = scfg.offsetX || 0;
            scfg.offsetX = clampNum(baseOff + (act === 'right' ? OFFSET_STEP : -OFFSET_STEP), OFFSET_MIN, OFFSET_MAX, baseOff);
            panelEl.querySelector('[data-offval="' + sIdx + '"]').textContent = scfg.offsetX + 'px';
          }
        }
        persistAndApply();
      };
    });
    var resetBtn = document.getElementById('najran-sbfine-reset');
    if (resetBtn) resetBtn.onclick = function () {
      settings = defaults();
      persistAndApply();
      renderPanel();
    };
  }

  function findCellByGlobalIndex(scan, idx) {
    for (var r = 0; r < scan.groups.length; r++) {
      for (var c = 0; c < scan.groups[r].cells.length; c++) {
        if (scan.groups[r].cells[c].globalIndex === idx) return scan.groups[r].cells[c].cell;
      }
    }
    return null;
  }

  var scheduled = false;
  function scheduleScan() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(function () {
      scheduled = false;
      var settings = readSettings();
      var scan = applyFineStyles(document, settings);
      if (scan.total > 0) { ensureButton(); if (panelEl && panelEl.classList.contains('open')) renderPanel(); }
    }, 200);
  }

  function boot() {
    scheduleScan();
    try {
      var mo = new MutationObserver(function () { scheduleScan(); });
      mo.observe(document.body, { childList: true, subtree: true });
    } catch (_) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
