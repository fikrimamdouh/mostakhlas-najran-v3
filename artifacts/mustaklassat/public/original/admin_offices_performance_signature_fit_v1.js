// ===================================================================
// Admin Offices Performance Signature Fit — V1
// Scope: admin_offices_attendance.html print windows
// يضغط تواقيع جدول تقييم الأداء فقط حتى تبقى في نفس الصفحة.
// لا يغير الحضور أو الشهادة أو الحسابات.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_PERFORMANCE_SIGNATURE_FIT_V1__) return;
  window.__ADMIN_OFFICES_PERFORMANCE_SIGNATURE_FIT_V1__ = true;

  function css() {
    return '<style id="admin-offices-performance-signature-fit-v1">' +
      '@media print{' +
      '.portrait-page-perf{break-inside:avoid!important;page-break-inside:avoid!important;}' +
      '.performance-report{font-size:9pt!important;line-height:1.25!important;break-inside:avoid!important;page-break-inside:avoid!important;}' +
      '.performance-report .cert-title{font-size:13pt!important;margin:4px 0!important;}' +
      '.performance-report .sub-title{font-size:10pt!important;margin:2px 0!important;}' +
      '.performance-report .cost-bar{font-size:9.5pt!important;padding:4px!important;margin:5px 0!important;}' +
      '.performance-report table{font-size:8.2pt!important;margin:3px 0!important;}' +
      '.performance-report th,.performance-report td{padding:2.5px 3px!important;line-height:1.18!important;}' +
      '.performance-report .summary{font-size:9.5pt!important;line-height:1.25!important;margin-top:5px!important;}' +
      '.performance-report .summary p{margin:3px 0!important;}' +
      '.performance-report .signatures{margin-top:7px!important;padding-top:5px!important;display:flex!important;justify-content:space-around!important;border-top:1px solid #333!important;break-inside:avoid!important;page-break-inside:avoid!important;}' +
      '.performance-report .sign-box{font-size:8.5pt!important;width:24%!important;break-inside:avoid!important;page-break-inside:avoid!important;}' +
      '.performance-report .sign-box .title{font-weight:900!important;margin-bottom:2px!important;}' +
      '.performance-report .sign-box .line{border-bottom:1px solid #000!important;margin:10px 12px 3px!important;height:14px!important;}' +
      '.performance-report .sign-box .name{font-size:8.5pt!important;font-weight:800!important;}' +
      '}' +
      '</style>';
  }

  function injectInto(win) {
    try {
      if (!win || win.closed || !win.document || !win.document.head) return;
      if (win.document.getElementById('admin-offices-performance-signature-fit-v1')) return;
      var text = '';
      try { text = String(win.document.documentElement && win.document.documentElement.innerHTML || ''); } catch (_) {}
      if (text.indexOf('performance-report') === -1 && text.indexOf('جدول تقييم مستوى الأداء') === -1) return;
      win.document.head.insertAdjacentHTML('beforeend', css());
    } catch (_) {}
  }

  function patchWindowOpen() {
    if (window.open.__adminOfficesPerformanceSignatureFitV1) return;
    var nativeOpen = window.open;
    window.open = function () {
      var w = nativeOpen.apply(window, arguments);
      function tryInject() { injectInto(w); }
      setTimeout(tryInject, 50);
      setTimeout(tryInject, 180);
      setTimeout(tryInject, 420);
      setTimeout(tryInject, 800);
      setTimeout(tryInject, 1300);
      return w;
    };
    window.open.__adminOfficesPerformanceSignatureFitV1 = true;
  }

  patchWindowOpen();
  console.info('[Admin Offices Performance Signature Fit] installed v1');
})();
