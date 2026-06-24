// ===================================================================
// Admin Offices Three Pages Print Polish
// Scope: admin_offices_attendance.html
// Polishes the 3 printed pages: attendance + performance + achievement.
// No calculations changed.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html|original-viewer\?page=admin_offices_attendance\.html/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_THREE_PAGES_PRINT_POLISH__) return;
  window.__ADMIN_OFFICES_THREE_PAGES_PRINT_POLISH__ = true;

  function polishCss() {
    return `<style id="admin-offices-three-pages-print-polish-css">
      @page admin-office-attendance-landscape-polish{size:A4 landscape;margin:3mm!important}
      @page admin-office-performance-landscape-polish{size:A4 landscape;margin:5mm!important}
      @page admin-office-achievement-portrait-polish{size:A4 portrait;margin:7mm!important}

      body{background:#fff!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
      .page-container,.site-page{margin:0!important;padding:0!important;box-sizing:border-box!important;break-after:page!important;page-break-after:always!important;overflow:visible!important}
      .page-container:last-child,.site-page:last-child{break-after:auto!important;page-break-after:auto!important}

      /* Attendance page */
      .site-attendance-page,.landscape-page{page:admin-office-attendance-landscape-polish!important}
      .attendance-report,.site-attendance{margin:0!important;padding:0!important;overflow:visible!important;break-inside:auto!important;page-break-inside:auto!important}
      .site-attendance .mini-header,.attendance-report .printable-header,.attendance-report .header-table{margin:0 0 1.5mm!important;padding:0 0 1mm!important;border-bottom:1.5px solid #003087!important;min-height:0!important}
      .site-attendance .mini-header img,.attendance-report .printable-header .logo,.attendance-report .header-table .logo{width:30px!important;height:30px!important;object-fit:contain!important}
      .site-attendance .mini-header h1,.site-attendance .mini-header h2,.site-attendance .mini-header h3,.attendance-report h1,.attendance-report h2,.attendance-report h3{line-height:1.05!important;margin:0!important}
      .site-attendance .mini-header h1,.attendance-report h1{font-size:7.5pt!important}.site-attendance .mini-header h2,.attendance-report h2{font-size:9pt!important;color:#003087!important}.site-attendance .mini-header h3,.attendance-report h3{font-size:6.5pt!important;color:#334155!important}
      .attendance-table,.attendance-report table{width:100%!important;border-collapse:collapse!important;table-layout:fixed!important;margin:0!important;font-size:4.8pt!important}
      .attendance-table thead,.attendance-report thead{display:table-header-group!important}.attendance-table tr,.attendance-report tr{break-inside:avoid!important;page-break-inside:avoid!important}
      .attendance-table th,.attendance-table td,.attendance-report th,.attendance-report td{border:1px solid #222!important;padding:.55px .8px!important;line-height:1.04!important;text-align:center!important;vertical-align:middle!important;white-space:nowrap!important}
      .attendance-table th,.attendance-report th{background:#003087!important;color:#fff!important;font-weight:900!important}
      .attendance-table .job,.attendance-table .emp,.attendance-report .job-title,.attendance-report .employee-name{white-space:normal!important;overflow-wrap:anywhere!important}
      .attendance-signatures,.print-signatures,.attendance-report .signatures{margin-top:2mm!important;padding-top:1.5mm!important;border-top:1px solid #111!important;display:flex!important;justify-content:space-around!important;gap:8mm!important}

      /* Performance page: clear landscape layout */
      .site-performance-page,.portrait-page-perf{page:admin-office-performance-landscape-polish!important;background:#fff!important;overflow:hidden!important}
      .site-performance,.portrait-page-perf .performance-report,.auto-site-performance-report{height:196mm!important;max-height:196mm!important;min-height:0!important;margin:0!important;padding:0!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;break-inside:avoid!important;page-break-inside:avoid!important;background:#fff!important}
      .site-performance .mini-header,.portrait-page-perf .header-table,.auto-site-performance-report .header-table{flex:0 0 auto!important;margin:0 0 1.4mm!important;padding:0 0 1mm!important;border-bottom:2px solid #003087!important}
      .site-performance .mini-header img,.portrait-page-perf .header-table .logo,.auto-site-performance-report .header-table .logo{width:38px!important;height:38px!important;object-fit:contain!important}
      .site-performance .mini-header h1,.portrait-page-perf .header-table h1,.auto-site-performance-report .header-table h1{font-size:9pt!important;line-height:1.08!important;margin:0!important;color:#111827!important}
      .site-performance .mini-header h2,.portrait-page-perf .cert-title,.auto-site-performance-report .cert-title{font-size:14pt!important;line-height:1.12!important;margin:.6mm 0!important;color:#003087!important;font-weight:900!important;text-align:center!important}
      .site-performance .mini-header h3,.portrait-page-perf .sub-title,.auto-site-performance-report .sub-title,.perf-subtitle{font-size:8pt!important;line-height:1.12!important;margin:0 0 .8mm!important;text-align:center!important;color:#334155!important;font-weight:800!important}
      .perf-cost,.portrait-page-perf .cost-bar,.auto-site-performance-report .cost-bar{flex:0 0 auto!important;background:#eef6ff!important;border:1px solid #bfdbfe!important;border-radius:7px!important;text-align:center!important;font-size:8.2pt!important;font-weight:900!important;color:#0f172a!important;padding:1mm!important;margin:0 0 1mm!important;line-height:1.1!important}
      .performance-table,.portrait-page-perf table,.auto-site-performance-report table{width:100%!important;border-collapse:collapse!important;table-layout:fixed!important;margin:0!important;font-size:8.2pt!important;flex:1 1 auto!important;background:#fff!important}
      .performance-table thead,.portrait-page-perf table thead,.auto-site-performance-report table thead{display:table-header-group!important}
      .performance-table tr,.portrait-page-perf tr,.auto-site-performance-report tr{break-inside:avoid!important;page-break-inside:avoid!important}
      .performance-table th,.performance-table td,.portrait-page-perf th,.portrait-page-perf td,.auto-site-performance-report th,.auto-site-performance-report td{border:1px solid #1f2937!important;padding:1.05mm 1.15mm!important;line-height:1.12!important;text-align:center!important;vertical-align:middle!important}
      .performance-table th,.portrait-page-perf th,.auto-site-performance-report th{background:#003087!important;color:#fff!important;font-weight:900!important;font-size:8.5pt!important}
      .performance-table th:nth-child(1),.performance-table td:nth-child(1),.portrait-page-perf th:nth-child(1),.portrait-page-perf td:nth-child(1){width:6%!important;font-weight:900!important}
      .performance-table th:nth-child(2),.performance-table td:nth-child(2),.portrait-page-perf th:nth-child(2),.portrait-page-perf td:nth-child(2),.auto-site-performance-report th:nth-child(2),.auto-site-performance-report td:nth-child(2),.performance-table .item-text,.portrait-page-perf .item-text,.auto-site-performance-report .item-text{width:72%!important;text-align:right!important;white-space:normal!important;overflow-wrap:anywhere!important;font-weight:800!important;font-size:8.2pt!important;line-height:1.16!important}
      .performance-table th:nth-child(3),.performance-table td:nth-child(3),.performance-table th:nth-child(4),.performance-table td:nth-child(4),.portrait-page-perf th:nth-child(3),.portrait-page-perf td:nth-child(3),.portrait-page-perf th:nth-child(4),.portrait-page-perf td:nth-child(4),.auto-site-performance-report th:nth-child(3),.auto-site-performance-report td:nth-child(3),.auto-site-performance-report th:nth-child(4),.auto-site-performance-report td:nth-child(4){width:11%!important;font-weight:900!important;font-size:8.4pt!important}
      .performance-table tbody tr:nth-child(even) td,.portrait-page-perf tbody tr:nth-child(even) td,.auto-site-performance-report tbody tr:nth-child(even) td{background:#f8fafc!important}
      .performance-table .perf-total td,.portrait-page-perf .perf-total td,.auto-site-performance-report .perf-total td{background:#dbeafe!important;color:#0f172a!important;font-weight:900!important;font-size:9pt!important}
      .perf-summary,.portrait-page-perf .summary,.auto-site-performance-report .summary{flex:0 0 auto!important;background:#fefce8!important;border:1px solid #d4af37!important;border-radius:8px!important;padding:1mm!important;margin:.9mm 0!important;text-align:center!important;font-size:8.2pt!important;line-height:1.15!important;font-weight:900!important;color:#111827!important}
      .performance-signatures,.portrait-page-perf .signatures,.auto-site-performance-report .signatures{flex:0 0 auto!important;margin-top:auto!important;padding-top:1.6mm!important;border-top:1.5px solid #111!important;display:flex!important;justify-content:space-around!important;gap:10mm!important}
      .performance-signatures .sign-item,.portrait-page-perf .sign-box,.auto-site-performance-report .sign-box{width:30%!important;text-align:center!important;font-size:8.4pt!important;font-weight:900!important;color:#111827!important}
      .performance-signatures .sig-line,.portrait-page-perf .line,.portrait-page-perf .sign-box .line,.auto-site-performance-report .line{height:8.5mm!important;border-bottom:1px solid #111!important;margin:1mm 8mm!important}

      /* Achievement page */
      .site-achievement-page,.portrait-page-ach{page:admin-office-achievement-portrait-polish!important;background:#fff!important;overflow:hidden!important}
      .site-achievement,.portrait-page-ach .achievement-report,.auto-site-achievement-report{min-height:284mm!important;margin:0!important;padding:0 8mm 7mm!important;background:#fff!important;break-inside:avoid!important;page-break-inside:avoid!important}
      .site-achievement .mini-header,.portrait-page-ach .header-table,.auto-site-achievement-report .header-table{margin:0 0 8mm!important;padding:0 0 2mm!important;border-bottom:2px solid #003087!important}
      .site-achievement .mini-header img,.portrait-page-ach .header-table .logo,.auto-site-achievement-report .header-table .logo{width:54px!important;height:54px!important;object-fit:contain!important}
      .site-achievement h2,.site-achievement h3,.portrait-page-ach .certificate-header h2,.portrait-page-ach .certificate-header h3,.auto-site-achievement-report .certificate-header h2,.auto-site-achievement-report .certificate-header h3{text-align:center!important;margin:2mm 0!important;line-height:1.25!important}
      .site-achievement h2,.portrait-page-ach .certificate-header h2,.auto-site-achievement-report .certificate-header h2{font-size:17pt!important;color:#003087!important;font-weight:900!important}
      .site-achievement h3,.portrait-page-ach .certificate-header h3,.auto-site-achievement-report .certificate-header h3{font-size:11pt!important;color:#111827!important}
      .achievement-table,.portrait-page-ach table,.auto-site-achievement-report table{width:100%!important;border-collapse:collapse!important;table-layout:fixed!important;font-size:9pt!important;margin:8mm 0!important}
      .achievement-table th,.achievement-table td,.portrait-page-ach th,.portrait-page-ach td,.auto-site-achievement-report th,.auto-site-achievement-report td{border:1px solid #1f2937!important;padding:5px!important;text-align:center!important;line-height:1.35!important}
      .achievement-table th,.portrait-page-ach th,.auto-site-achievement-report th{background:#003087!important;color:#fff!important;font-weight:900!important}
      .achievement-table .total-row td,.achievement-table .tafqit-row td,.portrait-page-ach .total-row td,.portrait-page-ach .tafqeet-cell td,.auto-site-achievement-report .total-row td,.auto-site-achievement-report .tafqeet-cell td{background:#fefce8!important;font-weight:900!important}
      .achievement-signatures,.portrait-page-ach .signatures,.auto-site-achievement-report .signatures{display:flex!important;justify-content:space-around!important;gap:8mm!important;margin-top:18mm!important}
      .achievement-signatures .sign-item,.portrait-page-ach .sign-box,.auto-site-achievement-report .sign-box{width:30%!important;text-align:center!important;font-size:9pt!important;font-weight:900!important}
      .achievement-signatures .sig-line,.portrait-page-ach .line,.auto-site-achievement-report .line{height:16mm!important;border-bottom:1px solid #111!important;margin:3mm 8mm!important}

      @media print{.toolbar,.no-print{display:none!important}}
    </style>`;
  }

  function inject(win) {
    if (!win || !win.document) return;
    const run = function () {
      try {
        if (!win.document.getElementById('admin-offices-three-pages-print-polish-css')) {
          win.document.head.insertAdjacentHTML('beforeend', polishCss());
        }
      } catch (_) {}
    };
    run();
    setTimeout(run, 50);
    setTimeout(run, 180);
    setTimeout(run, 500);
    setTimeout(run, 1200);
  }

  function wrapOpenDuring(fn) {
    let captured = null;
    const realOpen = window.open;
    window.open = function () {
      captured = realOpen.apply(window, arguments);
      return captured;
    };
    try {
      const result = fn();
      if (captured) inject(captured);
      return result;
    } finally {
      window.open = realOpen;
      if (captured) inject(captured);
    }
  }

  function patchPrintSelected() {
    if (typeof window.printSelected !== 'function' || window.printSelected.__adminThreePagesPolished) return false;
    const old = window.printSelected;
    window.printSelected = function polishedPrintSelected() {
      return wrapOpenDuring(() => old.apply(this, arguments));
    };
    window.printSelected.__adminThreePagesPolished = true;
    return true;
  }

  function patchSingleSitePrint() {
    if (typeof window.printCurrentSiteBundle !== 'function' || window.printCurrentSiteBundle.__adminThreePagesPolished) return false;
    const old = window.printCurrentSiteBundle;
    window.printCurrentSiteBundle = function polishedPrintCurrentSiteBundle() {
      return wrapOpenDuring(() => old.apply(this, arguments));
    };
    window.printCurrentSiteBundle.__adminThreePagesPolished = true;
    return true;
  }

  function boot(attempt) {
    patchPrintSelected();
    patchSingleSitePrint();
    if (attempt < 60 && (!window.printSelected?.__adminThreePagesPolished || (typeof window.printCurrentSiteBundle === 'function' && !window.printCurrentSiteBundle.__adminThreePagesPolished))) {
      setTimeout(() => boot(attempt + 1), 250);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot(0));
  else boot(0);
  setTimeout(() => boot(0), 1200);
  setTimeout(() => boot(0), 3000);
  document.addEventListener('click', () => { setTimeout(() => boot(0), 80); setTimeout(() => boot(0), 350); }, true);

  console.info('[Admin Offices Three Pages Print Polish] installed v2 performance landscape clear table');
})();
