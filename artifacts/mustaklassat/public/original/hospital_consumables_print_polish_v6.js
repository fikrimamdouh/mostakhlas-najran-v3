// Hospital Consumables Print Polish V6
// Scope: normal consumables.html only.
// Keeps original calculations. Polishes full consumables extract print and makes subcontractors landscape.
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
  if (window.__HOSPITAL_CONSUMABLES_PRINT_POLISH_V6__) return;
  window.__HOSPITAL_CONSUMABLES_PRINT_POLISH_V6__ = true;

  function clean(v) { return String(v == null ? '' : v).replace(/[\u200e\u200f]/g, '').replace(/\s+/g, ' ').trim(); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c]; }); }

  function activeHospital() {
    try {
      var cd = JSON.parse(localStorage.getItem('persistentContractData') || '{}');
      return clean(cd.hospitalName || cd.siteName || cd.centerName || localStorage.getItem('hospitalName') || localStorage.getItem('currentHospital') || document.querySelector('.hospitalName')?.textContent || '');
    } catch (_) {
      return clean(document.querySelector('.hospitalName')?.textContent || '');
    }
  }

  function activePeriod() {
    try {
      var ex = JSON.parse(localStorage.getItem('persistentExtractData') || '{}');
      var s = clean(ex.extractStart || ex.periodStart || ex.startDate || localStorage.getItem('extractStart') || document.getElementById('extract-start-date')?.textContent || '');
      var e = clean(ex.extractEnd || ex.periodEnd || ex.endDate || localStorage.getItem('extractEnd') || document.getElementById('extract-end-date')?.textContent || '');
      if (s || e) return 'عن الفترة من ' + (s || 'غير محدد') + ' إلى ' + (e || 'غير محدد');
    } catch (_) {}
    return clean(document.getElementById('extract-period')?.textContent || '');
  }

  function polishCss() {
    return `
<style id="consumables-polish-print-css">
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
@media print{
  .page{page:consumablesPortrait;}
  .page.landscape-page{page:consumablesLandscape!important;width:297mm!important;min-height:210mm!important;}
}
</style>`;
  }

  function transformFullHtml(html) {
    var hospital = activeHospital();
    var period = activePeriod();
    html = String(html || '');
    html = html.replace('</head>', polishCss() + '</head>');
    html = html.replace(/<section class="page"><div class="extract-page"><h1>([\s\S]*?)<\/h1><h2>([\s\S]*?)<\/h2>/g, function (_, title, subtitle) {
      var plainTitle = clean(title.replace(/<[^>]*>/g, ''));
      var isSub = /باطن|مقاول/i.test(plainTitle);
      var cls = isSub ? 'page landscape-page' : 'page';
      var brand = '<section class="' + cls + '"><div class="extract-page"><div class="print-brand">' +
        '<img src="najran_health_cluster_logo.png" alt="شعار">' +
        '<div class="brand-center"><h1>' + title + '</h1><h2>' + esc(hospital || clean(subtitle.replace(/<[^>]*>/g, ''))) + '</h2><h3>' + esc(period || clean(subtitle.replace(/<[^>]*>/g, ''))) + '</h3></div>' +
        '<img src="najran_health_cluster_logo.png" alt="شعار">' +
        '</div>';
      return brand;
    });
    return html;
  }

  function installFullPrintInterceptor() {
    if (!window.HospitalConsumablesRaiseLetter || window.HospitalConsumablesRaiseLetter.__polishedV6) return false;
    var oldFull = window.HospitalConsumablesRaiseLetter.printFullExtract;
    if (typeof oldFull !== 'function') return false;

    function polishedFullPrint() {
      var realOpen = window.open;
      window.open = function () {
        var win = realOpen.apply(window, arguments);
        if (win && win.document && !win.__consumablesPolishWrapped) {
          win.__consumablesPolishWrapped = true;
          var oldWrite = win.document.write.bind(win.document);
          win.document.write = function (html) {
            return oldWrite(transformFullHtml(html));
          };
        }
        return win;
      };
      try { oldFull(); }
      finally { setTimeout(function () { window.open = realOpen; }, 300); }
    }

    window.HospitalConsumablesRaiseLetter.printFullExtract = polishedFullPrint;
    window.HospitalConsumablesRaiseLetter.__polishedV6 = true;
    return true;
  }

  function interceptCenterFullButton() {
    var box = document.getElementById('hospital-consumables-letters-center');
    var btn = box && box.querySelector('[data-hc-action="full"]');
    if (!btn || btn.__polishedFullPrintV6) return false;
    btn.__polishedFullPrintV6 = true;
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
    if (!btn || btn.__subLandscapeV6) return false;
    btn.__subLandscapeV6 = true;
    btn.addEventListener('click', function () {
      document.body.classList.add('print-subcontractors-landscape');
      var st = document.getElementById('subcontractors-landscape-v6-style');
      if (!st) {
        st = document.createElement('style');
        st.id = 'subcontractors-landscape-v6-style';
        st.textContent = `
@page subcontractorsLandscape { size: A4 landscape; margin: 0; }
@media print{
  body.print-subcontractors-landscape #subcontractors-section{page:subcontractorsLandscape!important;width:297mm!important;min-height:210mm!important;padding:10mm 9mm!important;}
  body.print-subcontractors-landscape #subcontractors-section .printable-header{display:grid!important;grid-template-columns:62px 1fr 62px!important;align-items:center!important;border:2px solid #003087!important;border-radius:14px!important;padding:6px 10px!important;margin-bottom:7mm!important;background:#fff!important;}
  body.print-subcontractors-landscape #subcontractors-section .print-logo{width:54px!important;height:auto!important;}
  body.print-subcontractors-landscape #subcontractors-section .print-title-container{text-align:center!important;}
  body.print-subcontractors-landscape #subcontractors-section .print-title-container h1{font-size:15px!important;color:#003087!important;margin:0!important;font-weight:900!important;}
  body.print-subcontractors-landscape #subcontractors-section .print-title-container h2,body.print-subcontractors-landscape #subcontractors-section .print-title-container h3{font-size:11px!important;margin:2px 0!important;font-weight:800!important;}
  body.print-subcontractors-landscape #subcontractors-section table{font-size:9.2px!important;table-layout:auto!important;width:100%!important;}
  body.print-subcontractors-landscape #subcontractors-section th{background:#003087!important;color:#fff!important;font-weight:900!important;padding:3px 4px!important;line-height:1.25!important;}
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
    installFullPrintInterceptor();
    interceptCenterFullButton();
    installSubcontractorsLandscape();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  setTimeout(boot, 600);
  setTimeout(boot, 1600);
  setTimeout(boot, 3000);
  console.info('[Hospital Consumables Print Polish] installed v6');
})();
