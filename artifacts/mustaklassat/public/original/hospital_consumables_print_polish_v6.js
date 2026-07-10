// Hospital Consumables Print Polish V11
// Scope: normal consumables.html only.
// Keeps original calculations. Polishes full consumables extract print, makes subcontractors landscape,
// keeps the monthly summary certificate on one page, copies table signatures between certificates,
// and prevents print-all/full-extract flows from opening signature-format controls.
(function () {
  'use strict';

  var sig = location.pathname + location.search;
  var pageFile = '';
  try {
    pageFile = new URLSearchParams(location.search || '').get('page') || '';
    pageFile = pageFile ? pageFile.split('/').pop() : (location.pathname || '').split('/').pop();
  } catch (_) {
    pageFile = (location.pathname || '').split('/').pop();
  }
  if (pageFile !== 'consumables.html' && !/\/original\/consumables\.html(?:$|[?#])/.test(sig)) return;
  if (/admin_offices_consumables\.html|health_centers_consumables\.html|najran_general_consumables\.html/.test(pageFile)) return;
  if (window.__HOSPITAL_CONSUMABLES_PRINT_POLISH_V11__) return;
  window.__HOSPITAL_CONSUMABLES_PRINT_POLISH_V11__ = true;

  var SETTINGS_KEY = 'hospitalConsumablesRaiseLettersSettings_v1';
  var FALLBACK_IMG_KEY = 'hospitalConsumablesLetterheadDataUrl_v1';
  var TABLE_SIGNATURES_KEY = 'signatures_data_consumables_v27';
  var TABLE_SIGNATURE_STYLE_KEY = 'sb_style_prefs_consumables_v1';
  var TABLE_SIGNATURE_PREFS_KEY = 'sb_prefs_consumables';
  var FULL_PRINT_BYPASS_MS = 2600;

  var TABLE_SIGNATURE_LABELS = {
    subcontractors: 'شهادة عقود الباطن',
    performance: 'جدول أداء المستهلكات',
    water: 'شهادة توريد المياه',
    sewage: 'شهادة التخلص من الصرف الصحي',
    summary: 'شهادة الاستحقاق الشهري (الملخص)'
  };

  var STAMP_SVG = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="5,3"/><circle cx="50" cy="50" r="33" fill="none" stroke="currentColor" stroke-width="1.5"/><text x="50" y="56" text-anchor="middle" font-family="Tajawal,Arial,sans-serif" font-size="17" fill="currentColor" font-weight="bold">ختم</text></svg>';

  function clean(v) { return String(v == null ? '' : v).replace(/[\u200e\u200f]/g, '').replace(/\s+/g, ' ').trim(); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c]; }); }
  function readJson(k, f) { try { var raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : f; } catch (_) { return f; } }
  function yes(v) { return v === true || v === 'yes' || v === 'true' || v === '1'; }
  function settings() { return readJson(SETTINGS_KEY, {}); }
  function fallbackImage() { return clean(localStorage.getItem(FALLBACK_IMG_KEY) || ''); }
  function letterheadData(s) { return clean((s && s.letterheadDataUrl) || '') || fallbackImage(); }
  function clamp(n, min, max, fallback) { n = Number(n); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback; }

  function activeHospital() {
    try {
      var cd = JSON.parse(localStorage.getItem('persistentContractData') || '{}');
      return clean(cd.hospitalName || cd.siteName || cd.centerName || localStorage.getItem('hospitalName') || localStorage.getItem('currentHospital') || (document.querySelector('.hospitalName') && document.querySelector('.hospitalName').textContent) || '');
    } catch (_) {
      return clean((document.querySelector('.hospitalName') && document.querySelector('.hospitalName').textContent) || '');
    }
  }

  function activePeriod() {
    try {
      var ex = JSON.parse(localStorage.getItem('persistentExtractData') || '{}');
      var s = clean(ex.extractStart || ex.periodStart || ex.startDate || localStorage.getItem('extractStart') || (document.getElementById('extract-start-date') && document.getElementById('extract-start-date').textContent) || '');
      var e = clean(ex.extractEnd || ex.periodEnd || ex.endDate || localStorage.getItem('extractEnd') || (document.getElementById('extract-end-date') && document.getElementById('extract-end-date').textContent) || '');
      if (s || e) return 'عن الفترة من ' + (s || 'غير محدد') + ' إلى ' + (e || 'غير محدد');
    } catch (_) {}
    return clean((document.getElementById('extract-period') && document.getElementById('extract-period').textContent) || '');
  }

  function tableSignatureStyle() {
    var raw = readJson(TABLE_SIGNATURE_STYLE_KEY, {});
    raw = raw && typeof raw === 'object' ? raw : {};
    return {
      titleFontSize: clamp(raw.titleFontSize, 6, 44, 13),
      nameFontSize: clamp(raw.nameFontSize, 6, 44, 12),
      titleWeight: clamp(raw.titleWeight, 100, 900, 900),
      nameWeight: clamp(raw.nameWeight, 100, 900, 800),
      titleNameGap: clamp(raw.titleNameGap, -40, 140, 6),
      nameLineHeight: clamp(raw.nameLineHeight, 0.8, 3, 1.35),
      letterSpacing: clamp(raw.letterSpacing, -2, 8, 0),
      textAlign: ['right', 'center', 'left'].indexOf(raw.textAlign) > -1 ? raw.textAlign : 'center',
      blockTop: clamp(raw.blockTop, 0, 100, 10),
      gap: clamp(raw.gap, 0, 120, 10),
      perRow: ['2', '3', '4'].indexOf(String(raw.perRow)) > -1 ? String(raw.perRow) : 'auto',
      cardWidth: clamp(raw.cardWidth, 120, 340, 170),
      cardHeight: clamp(raw.cardHeight, 48, 180, 68),
      cardBorderVisible: raw.cardBorderVisible !== false,
      cardBorderWidth: clamp(raw.cardBorderWidth, 0, 3, 1),
      cardBorderRadius: clamp(raw.cardBorderRadius, 0, 20, 10),
      cardBorderColor: raw.cardBorderColor === 'black' ? '#111827' : (raw.cardBorderColor === 'gray' ? '#94a3b8' : (raw.cardBorderColor === 'navy' ? '#1e3c72' : '#cbd5e1')),
      cardBackground: raw.cardBackground === 'transparent' ? 'transparent' : (raw.cardBackground === 'lightgray' ? '#f8fafc' : '#fff'),
      cardPadding: clamp(raw.cardPadding, 0, 30, 7),
      textOnly: raw.textOnly === true,
      showLine: raw.showLine === true,
      lineLength: clamp(raw.lineLength, 20, 320, 110),
      lineNameGap: clamp(raw.lineNameGap, -30, 80, 4),
      showStamp: raw.showStamp !== false,
      stampSize: clamp(raw.stampSize, 32, 130, 55),
      perSignature: Array.isArray(raw.perSignature) ? raw.perSignature : []
    };
  }

  function tableSignaturePrefs() {
    var raw = readJson(TABLE_SIGNATURE_PREFS_KEY, {});
    raw = raw && typeof raw === 'object' ? raw : {};
    return {
      includeSigs: raw.includeSigs !== false,
      includeStamp: raw.includeStamp !== false
    };
  }

  function tableSignatures() {
    var data = readJson(TABLE_SIGNATURES_KEY, {});
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  }

  function sectionKeyFromTitle(title) {
    title = clean(String(title || '').replace(/<[^>]*>/g, ''));
    if (/عقود\s+الباطن|مقاولي\s+الباطن/.test(title)) return 'subcontractors';
    if (/ح\s*م\s*1|أداء\s+المستهلكات|المستهلكات\s+والمواد\s+الهندسية/.test(title)) return 'performance';
    if (/توريد\s+المياه/.test(title)) return 'water';
    if (/الصرف\s+الصحي|التخلص\s+من\s+مياه\s+الصرف/.test(title)) return 'sewage';
    if (/الاستحقاق\s+الشهري|الملخص\s+الشهري|المستهلكات\s*-\s*مقاولي/.test(title)) return 'summary';
    return '';
  }

  function fullExtractSignatureHtml(sectionKey) {
    var prefs = tableSignaturePrefs();
    if (!prefs.includeSigs) return '';
    var all = tableSignatures();
    var arr = Array.isArray(all[sectionKey]) ? all[sectionKey] : [];
    arr = arr.map(function (s) { return { title: clean(s && s.title), name: clean(s && s.name) }; }).filter(function (s) { return s.title || s.name; });
    if (!arr.length) return '';

    var st = tableSignatureStyle();
    var columns = st.perRow === 'auto' ? 'repeat(auto-fit,minmax(' + st.cardWidth + 'px,' + st.cardWidth + 'px))' : 'repeat(' + st.perRow + ',minmax(0,' + st.cardWidth + 'px))';
    var borderWidth = (st.textOnly || !st.cardBorderVisible) ? 0 : st.cardBorderWidth;
    var background = st.textOnly ? 'transparent' : st.cardBackground;
    var padding = st.textOnly ? 0 : st.cardPadding;
    var radius = st.textOnly ? 0 : st.cardBorderRadius;

    var items = arr.map(function (s, i) {
      var one = st.perSignature[i] && typeof st.perSignature[i] === 'object' ? st.perSignature[i] : {};
      var x = clamp(one.x, -180, 180, 0);
      var y = clamp(one.y, -160, 220, 0);
      var align = ['right', 'center', 'left'].indexOf(one.textAlign) > -1 ? one.textAlign : st.textAlign;
      return '<div class="consumables-full-sig-item" style="width:' + st.cardWidth + 'px;min-height:' + st.cardHeight + 'px;border:' + borderWidth + 'px solid ' + st.cardBorderColor + ';border-radius:' + radius + 'px;background:' + background + ';padding:' + padding + 'px;transform:translate(' + x + 'px,' + y + 'px);text-align:' + align + '">' +
        '<div class="sig-title consumables-full-sig-title" style="font-size:' + st.titleFontSize + 'px;font-weight:' + st.titleWeight + ';letter-spacing:' + st.letterSpacing + 'px;margin-bottom:' + st.titleNameGap + 'px">' + esc(s.title) + '</div>' +
        '<div class="sig-line consumables-full-sig-line" style="display:' + (st.showLine ? 'block' : 'none') + ';width:' + st.lineLength + 'px;margin:0 auto ' + st.lineNameGap + 'px"></div>' +
        '<div class="sig-name consumables-full-sig-name" style="font-size:' + st.nameFontSize + 'px;font-weight:' + st.nameWeight + ';line-height:' + st.nameLineHeight + ';letter-spacing:' + st.letterSpacing + 'px">' + esc(s.name) + '</div>' +
        '</div>';
    }).join('');

    var stamp = prefs.includeStamp && st.showStamp ? '<div class="consumables-full-sig-item consumables-full-stamp" style="width:' + st.cardWidth + 'px;min-height:' + st.cardHeight + 'px;border:0;padding:' + padding + 'px"><div style="width:' + st.stampSize + 'px;height:' + st.stampSize + 'px;margin:auto">' + STAMP_SVG + '</div></div>' : '';
    return '<div class="consumables-full-signatures consumables-full-signatures-' + esc(sectionKey) + '" style="margin-top:' + st.blockTop + 'px"><div class="consumables-full-signatures-grid" style="grid-template-columns:' + columns + ';gap:' + st.gap + 'px">' + items + stamp + '</div></div>';
  }

  function appendFullExtractSignatures(html) {
    html = String(html || '');
    return html.replace(/<section class="page"><div class="extract-page"><h1>([\s\S]*?)<\/h1><h2>([\s\S]*?)<\/h2>([\s\S]*?)<\/div><\/section>/g, function (_, title, subtitle, body) {
      var key = sectionKeyFromTitle(title);
      var signatures = key ? fullExtractSignatureHtml(key) : '';
      return '<section class="page"><div class="extract-page"><h1>' + title + '</h1><h2>' + subtitle + '</h2>' + body + signatures + '</div></section>';
    });
  }

  function polishCss() {
    return `
<style id="consumables-polish-print-css-v11">
@page consumablesPortrait { size: A4 portrait; margin: 0; }
@page consumablesLandscape { size: A4 landscape; margin: 0; }
.extract-page{position:relative!important;padding:14mm 12mm 18mm!important;font-family:Tajawal,Arial,sans-serif!important;}
.print-brand{display:grid!important;grid-template-columns:72px 1fr 72px!important;align-items:center!important;border:2px solid #003087!important;border-radius:14px!important;padding:8px 12px!important;margin:0 0 10mm!important;background:linear-gradient(180deg,#ffffff,#f8fafc)!important;box-shadow:0 2px 10px rgba(15,23,42,.08)!important;}
.print-brand img{width:64px!important;height:auto!important;object-fit:contain!important;}
.print-brand .brand-center{text-align:center!important;line-height:1.5!important;}
.print-brand h1{margin:0!important;color:#003087!important;font-size:17px!important;font-weight:900!important;text-decoration:none!important;}
.print-brand h2{margin:3px 0 0!important;color:#111827!important;font-size:13px!important;font-weight:900!important;}
.print-brand h3{margin:2px 0 0!important;color:#475569!important;font-size:12px!important;font-weight:800!important;}
.extract-page table{width:100%!important;border-collapse:collapse!important;table-layout:auto!important;background:#fff!important;font-family:Tajawal,Arial,sans-serif!important;}
.extract-page th{background:#003087!important;color:#fff!important;font-weight:900!important;border:1px solid #1e3a8a!important;padding:5px!important;text-align:center!important;vertical-align:middle!important;line-height:1.35!important;}
.extract-page td{border:1px solid #64748b!important;padding:5px!important;text-align:center!important;vertical-align:middle!important;line-height:1.45!important;color:#111827!important;}
.extract-page tbody tr:nth-child(even) td{background:#f8fafc!important;}
.extract-page tfoot td,.extract-page .grand td{background:#fff7d6!important;font-weight:900!important;}
.page.landscape-page{width:297mm!important;min-height:210mm!important;page:consumablesLandscape!important;}
.page.landscape-page .extract-page{padding:10mm 9mm 12mm!important;}
.page.landscape-page .print-brand{grid-template-columns:62px 1fr 62px!important;margin-bottom:7mm!important;padding:6px 10px!important;}
.page.landscape-page .print-brand img{width:54px!important;}
.page.landscape-page .print-brand h1{font-size:15px!important;}
.page.landscape-page .print-brand h2{font-size:12px!important;}
.page.landscape-page .print-brand h3{font-size:11px!important;}
.page.landscape-page table{font-size:9.2px!important;}
.page.landscape-page th,.page.landscape-page td{padding:3px 4px!important;line-height:1.28!important;}
.page.summary-one-page .extract-page{padding:7mm 8mm 8mm!important;}
.page.summary-one-page .print-brand{margin-bottom:4mm!important;padding:4px 8px!important;grid-template-columns:48px 1fr 48px!important;}
.page.summary-one-page .print-brand img{width:42px!important;}
.page.summary-one-page .print-brand h1{font-size:13px!important;}
.page.summary-one-page .print-brand h2,.page.summary-one-page .print-brand h3{font-size:9.5px!important;margin:1px 0!important;}
.page.summary-one-page table{font-size:8px!important;}
.page.summary-one-page th,.page.summary-one-page td{padding:2px 3px!important;line-height:1.12!important;}
.consumables-full-signatures{break-inside:avoid!important;page-break-inside:avoid!important;width:100%!important;}
.consumables-full-signatures-grid{display:grid!important;direction:rtl!important;justify-content:center!important;align-items:stretch!important;width:100%!important;}
.consumables-full-sig-item{box-sizing:border-box!important;display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:center!important;break-inside:avoid!important;page-break-inside:avoid!important;}
.consumables-full-sig-line{height:0!important;border-bottom:1.3px solid #111827!important;}
.consumables-full-stamp svg{width:100%!important;height:100%!important;}
.page.summary-one-page .consumables-full-signatures{margin-top:3mm!important;zoom:.82!important;}
.consumables-letterhead-force{position:absolute!important;top:0!important;left:0!important;width:210mm!important;height:297mm!important;object-fit:cover!important;z-index:0!important;pointer-events:none!important;}
.page>.letter-content{position:relative!important;z-index:1!important;}
.page>.letter-content:not(.no-letterhead){background:transparent!important;}
.head .t h2{display:none!important;}
body[data-signature-scope="consumables:fullExtract"] #najran-sig-toggle,
body[data-signature-scope="consumables:fullExtract"] #najran-sig-panel,
body.consumables-full-extract-print #najran-sig-toggle,
body.consumables-full-extract-print #najran-sig-panel{display:none!important;}
@media print{
  .page{page:consumablesPortrait;}
  .page.landscape-page{page:consumablesLandscape!important;width:297mm!important;min-height:210mm!important;}
  #najran-sig-toggle,#najran-sig-panel,#sb-consumables-print-style-toggle,#sb-consumables-print-style-panel,[id*="toast"],[class*="toast"]{display:none!important;}
}
</style>`;
  }

  function consumablesLetterHtml(html) {
    html = String(html || '');
    return /خطاب\s+رفع\s+المستهلكات|خطاب\s+المستهلكات|عدم\s+أسبقية\s+صرف|محضر\s+استهلاك|محضر\s+حصر\s+استهلاك|مشهد\s+مستهلكات|مشهد\s+مياه|شهادة/.test(html) && /letter-content|letterhead-bg|hospital-consumables/i.test(html);
  }

  function forceConsumablesLetterhead(html) {
    html = String(html || '');
    if (!consumablesLetterHtml(html)) return html;

    var s = settings();
    var dataUrl = letterheadData(s);
    var enabled = yes(s.letterheadEnabled) || !!dataUrl;

    if (html.indexOf('consumables-polish-print-css-v11') === -1 && html.indexOf('consumables-polish-print-css-v10') === -1 && html.indexOf('consumables-polish-print-css-v8') === -1) html = html.replace('</head>', polishCss() + '</head>');

    html = html.replace(/<h2>\s*وحدة\s+الصيانة\s+العامة\s*<\/h2>/g, '');
    html = html.replace(/<h2>\s*وحدة\s+الصيانه\s+العامه\s*<\/h2>/g, '');

    if (enabled && dataUrl) {
      var img = '<img class="letterhead-bg full consumables-letterhead-force" src="' + esc(dataUrl) + '">';
      html = html.replace(/<section class="page">\s*<img[^>]+(?:letterhead-bg|consumables-letterhead-force)[^>]*>/g, '<section class="page">');
      html = html.replace(/<section class="page">/g, '<section class="page">' + img);
      html = html.replace(/letter-content\s+no-letterhead/g, 'letter-content');
    }

    return html;
  }

  function transformFullHtml(html) {
    var hospital = activeHospital();
    var period = activePeriod();
    html = String(html || '');
    html = appendFullExtractSignatures(html);
    html = forceConsumablesLetterhead(html);
    if (html.indexOf('consumables-polish-print-css-v11') === -1 && html.indexOf('consumables-polish-print-css-v10') === -1 && html.indexOf('consumables-polish-print-css-v8') === -1) html = html.replace('</head>', polishCss() + '</head>');
    html = html.replace('<body data-signature-scope="consumables:fullExtract">', '<body class="consumables-full-extract-print" data-signature-scope="consumables:fullExtract">');
    html = html.replace(/<section class="page"><div class="extract-page"><h1>([\s\S]*?)<\/h1><h2>([\s\S]*?)<\/h2>/g, function (_, title, subtitle) {
      var plainTitle = clean(title.replace(/<[^>]*>/g, ''));
      var isSub = /باطن|مقاول/i.test(plainTitle);
      var isSummary = sectionKeyFromTitle(plainTitle) === 'summary';
      var cls = isSub ? 'page landscape-page' : (isSummary ? 'page landscape-page summary-one-page' : 'page');
      var cleanSubtitle = clean(subtitle.replace(/<[^>]*>/g, ''));
      var brand = '<section class="' + cls + '"><div class="extract-page"><div class="print-brand">' +
        '<img src="najran_health_cluster_logo.png" alt="شعار">' +
        '<div class="brand-center"><h1>' + title + '</h1><h2>' + esc(hospital || cleanSubtitle) + '</h2><h3>' + esc(period || cleanSubtitle) + '</h3></div>' +
        '<img src="najran_health_cluster_logo.png" alt="شعار">' +
        '</div>';
      return brand;
    });
    return html;
  }

  function installAnyLetterPrintInterceptor() {
    if (window.__HOSPITAL_CONSUMABLES_ANY_LETTER_PRINT_INTERCEPTOR_V11__) return;
    window.__HOSPITAL_CONSUMABLES_ANY_LETTER_PRINT_INTERCEPTOR_V11__ = true;
    var oldOpen = window.open;
    window.open = function () {
      var win = oldOpen.apply(window, arguments);
      try {
        if (win && win.document && !win.__consumablesAnyLetterPolishV11) {
          win.__consumablesAnyLetterPolishV11 = true;
          var oldWrite = win.document.write.bind(win.document);
          win.document.write = function (html) { return oldWrite(forceConsumablesLetterhead(html)); };
        }
      } catch (_) {}
      return win;
    };
  }

  function installFullPrintInterceptor() {
    if (!window.HospitalConsumablesRaiseLetter || window.HospitalConsumablesRaiseLetter.__polishedV11) return false;
    var oldFull = window.HospitalConsumablesRaiseLetter.printFullExtract;
    if (typeof oldFull !== 'function') return false;

    function polishedFullPrint() {
      var realOpen = window.open;
      window.__sbConsumablesFinalPrint = true;
      window.open = function () {
        var win = realOpen.apply(window, arguments);
        if (win && win.document && !win.__consumablesPolishWrappedV11) {
          win.__consumablesPolishWrappedV11 = true;
          var oldWrite = win.document.write.bind(win.document);
          win.document.write = function (html) { return oldWrite(transformFullHtml(html)); };
        }
        return win;
      };
      try { oldFull(); }
      finally {
        setTimeout(function () {
          window.open = realOpen;
          window.__sbConsumablesFinalPrint = false;
          window.__sbConsumablesTablePrintIntent = null;
          installAnyLetterPrintInterceptor();
        }, 500);
      }
    }

    window.HospitalConsumablesRaiseLetter.printFullExtract = polishedFullPrint;
    window.HospitalConsumablesRaiseLetter.__polishedV11 = true;
    return true;
  }

  function interceptCenterFullButton() {
    var box = document.getElementById('hospital-consumables-letters-center');
    var btn = box && box.querySelector('[data-hc-action="full"]');
    if (!btn || btn.__polishedFullPrintV11) return false;
    btn.__polishedFullPrintV11 = true;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (window.HospitalConsumablesRaiseLetter && typeof window.HospitalConsumablesRaiseLetter.printFullExtract === 'function') {
        window.HospitalConsumablesRaiseLetter.printFullExtract();
      }
    }, true);
    return true;
  }

  function installSubcontractorsLandscape() {
    var btn = document.querySelector('.btn-print[data-section="subcontractors"]');
    if (!btn || btn.__subLandscapeV11) return false;
    btn.__subLandscapeV11 = true;
    btn.addEventListener('click', function () {
      document.body.classList.add('print-subcontractors-landscape');
      var st = document.getElementById('subcontractors-landscape-v11-style');
      if (!st) {
        st = document.createElement('style');
        st.id = 'subcontractors-landscape-v11-style';
        st.textContent = `
@page subcontractorsLandscape { size: A4 landscape; margin: 0; }
@media print{
  body.print-subcontractors-landscape #subcontractors-section{page:subcontractorsLandscape!important;width:297mm!important;min-height:210mm!important;padding:10mm 9mm!important;}
  body.print-subcontractors-landscape #subcontractors-section .printable-header{display:grid!important;grid-template-columns:62px 1fr 62px!important;align-items:center!important;border:2px solid #003087!important;border-radius:14px!important;padding:6px 10px!important;margin-bottom:7mm!important;background:#fff!important;}
  body.print-subcontractors-landscape #subcontractors-section .print-logo{width:54px!important;height:auto!important;}
  body.print-subcontractors-landscape #subcontractors-section .print-title-container{text-align:center!important;}
  body.print-subcontractors-landscape #subcontractors-section .print-title-container h1{font-size:15px!important;color:#003087!important;margin:0!important;font-weight:900!important;}
  body.print-subcontractors-landscape #subcontractors-section .print-title-container h2,body.print-subcontractors-landscape #subcontractors-section .print-title-container h3{font-size:11px!important;margin:2px 0!important;font-weight:800!important;}
  body.print-subcontractors-landscape #subcontractors-section table{font-size:9px!important;table-layout:auto!important;width:100%!important;}
  body.print-subcontractors-landscape #subcontractors-section th,
  body.print-subcontractors-landscape #subcontractors-section td{padding:3px 4px!important;line-height:1.25!important;}
}
`;
        document.head.appendChild(st);
      }
      setTimeout(function () { document.body.classList.remove('print-subcontractors-landscape'); }, 1600);
    }, true);
    return true;
  }

  function installSummaryOnePageCss() {
    if (document.getElementById('consumables-summary-one-page-v11')) return;
    var st = document.createElement('style');
    st.id = 'consumables-summary-one-page-v11';
    st.textContent = `
#sb-overlay #sb-save-btn.consumables-save-highlight,
#sb-overlay .sb-save-btn.consumables-save-highlight{
  background:#15803d!important;color:#fff!important;border:2px solid #166534!important;
  box-shadow:0 7px 18px rgba(21,128,61,.32)!important;font-weight:950!important;
  padding:10px 26px!important;min-width:150px!important;
}
#sb-consumables-copy-box{border:1px solid #bbf7d0;background:#f0fdf4;border-radius:12px;padding:10px;margin:0 0 12px;}
#sb-consumables-copy-box strong{display:block;color:#166534;margin-bottom:7px;font-size:13px;}
#sb-consumables-copy-row{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;}
#sb-consumables-copy-target{width:100%;padding:8px;border:1px solid #86efac;border-radius:8px;font-family:inherit;font-weight:800;}
#sb-consumables-copy-btn{background:#0369a1;color:#fff;border:0;border-radius:8px;padding:9px 13px;font-family:inherit;font-weight:900;cursor:pointer;}
#sb-consumables-copy-note{min-height:18px;color:#166534;font-size:12px;font-weight:800;margin-top:6px;}
@page consumablesSummaryLandscape { size:A4 landscape; margin:5mm; }
@media print{
  #najran-revision-mode-badge,#najran-sig-toggle,#najran-sig-panel,#sb-consumables-print-style-toggle,#sb-consumables-print-style-panel,[id*="toast"],[class*="toast"]{display:none!important;}
  #summary-section{
    page:consumablesSummaryLandscape!important;width:287mm!important;min-height:190mm!important;
    box-sizing:border-box!important;margin:0!important;padding:3mm!important;
    break-inside:avoid!important;page-break-inside:avoid!important;overflow:visible!important;
  }
  #summary-section .printable-header{margin:0 0 3mm!important;padding:3px 0!important;min-height:0!important;}
  #summary-section .printable-header .print-logo{width:42px!important;}
  #summary-section .printable-header h1{font-size:12pt!important;margin:0!important;line-height:1.2!important;}
  #summary-section .printable-header h2,#summary-section .printable-header h3{font-size:8.5pt!important;margin:1px 0!important;line-height:1.15!important;}
  #summary-section .table-container{overflow:visible!important;margin:0!important;}
  #summary-section .data-table{font-size:7.3pt!important;width:100%!important;table-layout:auto!important;}
  #summary-section .data-table th,#summary-section .data-table td{font-size:7.3pt!important;padding:2px 3px!important;line-height:1.08!important;}
  #summary-section .notes-section{margin:2mm 0 0!important;padding:2mm!important;font-size:7pt!important;}
  #summary-section .signatures-display-section{margin:2mm auto 0!important;max-width:100%!important;break-inside:avoid!important;page-break-inside:avoid!important;}
  #summary-section [data-sb-page="consumables"] .sb-wrap{margin-top:0!important;transform:scale(.76)!important;transform-origin:top center!important;width:131.5%!important;margin-right:-15.75%!important;}
  #summary-section [data-sb-page="consumables"] .sb-grid{gap:5px!important;}
  #summary-section [data-sb-page="consumables"] .sb-item{min-height:46px!important;padding:3px!important;}
}
`;
    document.head.appendChild(st);
  }

  function collectDialogSignatures() {
    var out = [];
    document.querySelectorAll('#sb-fields .sb-field-row').forEach(function (row) {
      var title = clean(row.querySelector('.sb-f-title') && row.querySelector('.sb-f-title').value);
      var name = clean(row.querySelector('.sb-f-name') && row.querySelector('.sb-f-name').value);
      if (title || name) out.push({ title: title, name: name });
    });
    return out;
  }

  function fillDialogSignatures(list) {
    var fields = document.getElementById('sb-fields');
    var add = document.getElementById('sb-add-btn');
    if (!fields || !add) return false;
    fields.innerHTML = '';
    var rows = Array.isArray(list) && list.length ? list : [{ title: '', name: '' }];
    rows.forEach(function (sig) {
      try { add.click(); } catch (_) {}
      var row = fields.lastElementChild;
      if (!row) return;
      var title = row.querySelector('.sb-f-title');
      var name = row.querySelector('.sb-f-name');
      if (title) title.value = sig.title || '';
      if (name) name.value = sig.name || '';
    });
    return true;
  }

  function refreshCopyTargets(source, targetSelect) {
    if (!targetSelect) return;
    var previous = targetSelect.value;
    targetSelect.innerHTML = Object.keys(TABLE_SIGNATURE_LABELS).filter(function (k) { return k !== source; }).map(function (k) {
      return '<option value="' + esc(k) + '">' + esc(TABLE_SIGNATURE_LABELS[k]) + '</option>';
    }).join('');
    if (previous && previous !== source && TABLE_SIGNATURE_LABELS[previous]) targetSelect.value = previous;
  }

  function enhanceSignatureDialog() {
    var cert = document.getElementById('sb-consumables-cert');
    var save = document.getElementById('sb-save-btn');
    var extra = document.getElementById('sb-extra');
    if (!cert || !save || !extra) return false;

    save.classList.add('consumables-save-highlight');
    save.textContent = 'حفظ التغييرات';

    var box = document.getElementById('sb-consumables-copy-box');
    if (!box) {
      box = document.createElement('div');
      box.id = 'sb-consumables-copy-box';
      box.innerHTML = '<strong>نسخ تواقيع الشهادة الحالية إلى شهادة أخرى</strong>' +
        '<div id="sb-consumables-copy-row"><select id="sb-consumables-copy-target"></select><button id="sb-consumables-copy-btn" type="button">نسخ التواقيع</button></div>' +
        '<div id="sb-consumables-copy-note"></div>';
      cert.insertAdjacentElement('afterend', box);
    }

    var targetSelect = document.getElementById('sb-consumables-copy-target');
    refreshCopyTargets(cert.value || 'subcontractors', targetSelect);

    if (!cert.__copyTargetRefreshV11) {
      cert.__copyTargetRefreshV11 = true;
      cert.addEventListener('change', function () {
        setTimeout(function () { refreshCopyTargets(cert.value, targetSelect); }, 0);
      });
    }

    var copyBtn = document.getElementById('sb-consumables-copy-btn');
    if (copyBtn && !copyBtn.__copyBoundV11) {
      copyBtn.__copyBoundV11 = true;
      copyBtn.addEventListener('click', function () {
        var source = cert.value;
        var target = targetSelect && targetSelect.value;
        var note = document.getElementById('sb-consumables-copy-note');
        var sourceRows = collectDialogSignatures();
        if (!target || target === source) {
          if (note) note.textContent = 'اختر شهادة مختلفة للنسخ.';
          return;
        }
        if (!sourceRows.length) {
          if (note) note.textContent = 'لا توجد توقيعات مكتوبة في الشهادة الحالية.';
          return;
        }

        cert.value = target;
        cert.dispatchEvent(new Event('change', { bubbles: true }));
        fillDialogSignatures(sourceRows);
        if (note) note.textContent = 'تم النسخ إلى «' + TABLE_SIGNATURE_LABELS[target] + '». راجعها ثم اضغط حفظ التغييرات.';
      });
    }
    return true;
  }

  function installSignatureDialogEnhancer() {
    if (window.__CONSUMABLES_SIGNATURE_COPY_ENHANCER_V11__) return;
    window.__CONSUMABLES_SIGNATURE_COPY_ENHANCER_V11__ = true;
    document.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest && e.target.closest('#edit-signatures-btn');
      if (!btn) return;
      setTimeout(enhanceSignatureDialog, 0);
      setTimeout(enhanceSignatureDialog, 120);
    }, true);
    var mo = new MutationObserver(function () { enhanceSignatureDialog(); });
    try { mo.observe(document.documentElement, { childList: true, subtree: true }); } catch (_) {}
    enhanceSignatureDialog();
  }

  function installPrintAllBypass() {
    if (window.__CONSUMABLES_PRINT_ALL_BYPASS_V11__) return;
    window.__CONSUMABLES_PRINT_ALL_BYPASS_V11__ = true;
    document.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest && e.target.closest('#print-all-btn');
      if (!btn) return;
      window.__sbConsumablesFinalPrint = true;
      var panel = document.getElementById('sb-consumables-print-style-panel');
      if (panel) panel.classList.remove('open');
      setTimeout(function () {
        window.__sbConsumablesFinalPrint = false;
        window.__sbConsumablesTablePrintIntent = null;
      }, FULL_PRINT_BYPASS_MS);
    }, true);
  }

  function boot() {
    installSummaryOnePageCss();
    installAnyLetterPrintInterceptor();
    installFullPrintInterceptor();
    interceptCenterFullButton();
    installSubcontractorsLandscape();
    installSignatureDialogEnhancer();
    installPrintAllBypass();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  setTimeout(boot, 300);
  setTimeout(boot, 800);
  setTimeout(boot, 1600);
  setTimeout(boot, 3000);
  console.info('[Hospital Consumables Print Polish] installed v11 signature copy + direct print-all + one-page summary + full extract signatures');
})();
