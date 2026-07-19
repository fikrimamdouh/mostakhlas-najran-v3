(function () {
  'use strict';

  function loadScript(src) {
    document.write('<script src="' + src + '"><\/script>');
  }

  loadScript('/original/visit-permit-engine.js?v=20260716_engine_v2');
  loadScript('/original/visit-permit-download-qr-layout.js?v=20260716_footer_layout_v2');

  var pageUrl = String(window.location.href || '');
  if (/request-visit\.html/i.test(pageUrl)) {
    loadScript('/original/request-visit-postponement-mode.js?v=20260719_deferred_visit_request_v5');
  }
  if (/cluster-subcontractor-visits\.html/i.test(pageUrl)) {
    loadScript('/original/visit-center-public-kiosk.js?v=20260719_general_all_sites_v6');
  }
})();
