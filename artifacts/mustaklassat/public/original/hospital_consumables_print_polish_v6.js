// Hospital Consumables Print Polish V10
// Scope: normal consumables.html only.
// Keeps original calculations. Polishes full consumables extract print, makes subcontractors landscape,
// and forces consumables letterhead. Signature formatting remains controlled only by signature-style-control.js.
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
  if (window.__HOSPITAL_CONSUMABLES_PRINT_POLISH_V10__) return;
  window.__HOSPITAL_CONSUMABLES_PRINT_POLISH_V10__ = true;

  var SETTINGS_KEY = 'hospitalConsumablesRaiseLettersSettings_v1';
  var FALLBACK_IMG_KEY = 'hospitalConsumablesLetterheadDataUrl_v1';

  function clean(v) { return String(v == null ? '' : v).replace(/[\u200e\u200f]/g, '').replace(/\s+/g, ' ').trim(); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c]; }); }
  function readJson(k, f) { try { var raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : f; } catch (_) { return f; } }
  function yes(v) { return v === true || v === 'yes' || v === 'true' || v === '1'; }
  function settings() { return readJson(SETTINGS_KEY, {}); }
  function fallbackImage() { return clean(localStorage.getItem(FALLBACK_IMG_KEY) || ''); }
  function letterheadData(s) { return clean((s && s.letterheadDataUrl) || '') || fallbackImage(); }

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

  function polishCss() {
    return `
<style id="consumables-polish-print-css-v10">
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
.consumables-letterhead-force{position:absolute!important;top:0!important;left:0!important;width:210mm!important;height:297mm!important;object-fit:cover!important;z-index:0!important;pointer-events:none!important;}
.page>.letter-content{position:relative!important;z-index:1!important;}
.page>.letter-content:not(.no-letterhead){background:transparent!important;}
.head .t h2{display:none!important;}
@media print{
  .page{page:consumablesPortrait;}
  .page.landscape-page{page:consumablesLandscape!important;width:297mm!important;min-height:210mm!important;}
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

    if (html.indexOf('consumables-polish-print-css-v10') === -1 && html.indexOf('consumables-polish-print-css-v8') === -1) html = html.replace('</head>', polishCss() + '</head>');

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
    html = forceConsumablesLetterhead(html);
    if (html.indexOf('consumables-polish-print-css-v10') === -1 && html.indexOf('consumables-polish-print-css-v8') === -1) html = html.replace('</head>', polishCss() + '</head>');
    html = html.replace(/<section class="page"><div class="extract-page"><h1>([\s\S]*?)<\/h1><h2>([\s\S]*?)<\/h2>/g, function (_, title, subtitle) {
      var plainTitle = clean(title.replace(/<[^>]*>/g, ''));
      var isSub = /باطن|مقاول/i.test(plainTitle);
      var cls = isSub ? 'page landscape-page' : 'page';
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
    if (window.__HOSPITAL_CONSUMABLES_ANY_LETTER_PRINT_INTERCEPTOR_V10__) return;
    window.__HOSPITAL_CONSUMABLES_ANY_LETTER_PRINT_INTERCEPTOR_V10__ = true;
    var oldOpen = window.open;
    window.open = function () {
      var win = oldOpen.apply(window, arguments);
      try {
        if (win && win.document && !win.__consumablesAnyLetterPolishV10) {
          win.__consumablesAnyLetterPolishV10 = true;
          var oldWrite = win.document.write.bind(win.document);
          win.document.write = function (html) { return oldWrite(forceConsumablesLetterhead(html)); };
        }
      } catch (_) {}
      return win;
    };
  }

  function installFullPrintInterceptor() {
    if (!window.HospitalConsumablesRaiseLetter || window.HospitalConsumablesRaiseLetter.__polishedV10) return false;
    var oldFull = window.HospitalConsumablesRaiseLetter.printFullExtract;
    if (typeof oldFull !== 'function') return false;

    function polishedFullPrint() {
      var realOpen = window.open;
      window.open = function () {
        var win = realOpen.apply(window, arguments);
        if (win && win.document && !win.__consumablesPolishWrappedV10) {
          win.__consumablesPolishWrappedV10 = true;
          var oldWrite = win.document.write.bind(win.document);
          win.document.write = function (html) { return oldWrite(transformFullHtml(html)); };
        }
        return win;
      };
      try { oldFull(); }
      finally { setTimeout(function () { window.open = realOpen; installAnyLetterPrintInterceptor(); }, 300); }
    }

    window.HospitalConsumablesRaiseLetter.printFullExtract = polishedFullPrint;
    window.HospitalConsumablesRaiseLetter.__polishedV10 = true;
    return true;
  }

  function interceptCenterFullButton() {
    var box = document.getElementById('hospital-consumables-letters-center');
    var btn = box && box.querySelector('[data-hc-action="full"]');
    if (!btn || btn.__polishedFullPrintV10) return false;
    btn.__polishedFullPrintV10 = true;
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
    if (!btn || btn.__subLandscapeV10) return false;
    btn.__subLandscapeV10 = true;
    btn.addEventListener('click', function () {
      document.body.classList.add('print-subcontractors-landscape');
      var st = document.getElementById('subcontractors-landscape-v10-style');
      if (!st) {
        st = document.createElement('style');
        st.id = 'subcontractors-landscape-v10-style';
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

  function boot() {
    installAnyLetterPrintInterceptor();
    installFullPrintInterceptor();
    interceptCenterFullButton();
    installSubcontractorsLandscape();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  setTimeout(boot, 600);
  setTimeout(boot, 1600);
  setTimeout(boot, 3000);
  console.info('[Hospital Consumables Print Polish] installed v10 fallback letterhead key; signature style delegated to signature-style-control.js');
})();