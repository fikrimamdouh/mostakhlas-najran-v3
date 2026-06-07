/* review-print-override.js - make full extract button print/save PDF instead of downloading HTML */
(function () {
  'use strict';
  if (!/\/original\/approval\.html(?:$|[?#])/.test(window.location.pathname + window.location.search)) return;

  function printReviewDocument() {
    window.print();
  }

  window.rvDownload = function () {
    printReviewDocument();
  };

  function relabelButton() {
    var btn = document.getElementById('rv-download');
    if (!btn) return;
    btn.textContent = 'طباعة / حفظ PDF';
    btn.title = 'يفتح نافذة الطباعة لاختيار الطباعة أو الحفظ PDF';
    btn.onclick = function (ev) {
      if (ev && ev.preventDefault) ev.preventDefault();
      window.rvDownload();
    };
  }

  document.addEventListener('DOMContentLoaded', relabelButton);
  document.addEventListener('click', function () {
    setTimeout(relabelButton, 50);
  }, true);
  setInterval(relabelButton, 800);
})();