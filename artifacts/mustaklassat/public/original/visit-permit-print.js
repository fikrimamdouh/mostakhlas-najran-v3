(function () {
  'use strict';

  function loadScript(src) {
    document.write('<script src="' + src + '"><\/script>');
  }

  loadScript('/original/visit-permit-engine.js?v=20260716_engine_v2');
  loadScript('/original/visit-permit-download-qr-layout.js?v=20260716_footer_layout_v2');

  var pageUrl = String(window.location.href || '');
  if (/request-visit\.html/i.test(pageUrl)) {
    loadScript('/original/request-visit-postponement-mode.js?v=20260717_postponement_full_label_v3');
  }
  if (/cluster-subcontractor-visits\.html/i.test(pageUrl)) {
    loadScript('/original/visit-center-public-kiosk.js?v=20260717_cluster_full_name_v3');
  }
})();
