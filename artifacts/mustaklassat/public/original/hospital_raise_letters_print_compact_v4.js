// Hospital Raise Letters Print Compact V4
// Scope: hospital_raise_letters.html only.
// Runs after print polish v3. Tightens vertical spacing so labor letter fits like a real A4 letter.
(function () {
  'use strict';

  if (!/hospital_raise_letters\.html/.test(location.pathname) && !window.__HOSPITAL_LETTERS_STANDALONE_PAGE__) return;
  if (window.__HOSPITAL_RAISE_LETTERS_PRINT_COMPACT_V4__) return;
  window.__HOSPITAL_RAISE_LETTERS_PRINT_COMPACT_V4__ = true;

  function compactCss() {
    return `
<style id="hospital-raise-letters-print-compact-v4">
body.hrl-polished .page{width:210mm!important;min-height:297mm!important;max-height:297mm!important;overflow:hidden!important;}
body.hrl-polished .content{width:210mm!important;max-width:210mm!important;min-height:auto!important;margin:0!important;}
body.hrl-polished .content.no-letterhead{padding:14mm 15mm 16mm!important;}
body.hrl-polished .content:not(.no-letterhead){padding-right:15mm!important;padding-left:15mm!important;padding-bottom:16mm!important;}
body.hrl-polished .print-brand{margin:0 0 7mm!important;padding:6px 10px!important;border-radius:12px!important;}
body.hrl-polished .print-brand img{width:58px!important;}
body.hrl-polished .print-brand h1{font-size:16px!important;}
body.hrl-polished .print-brand h2{font-size:12.5px!important;}
body.hrl-polished .print-brand h3{font-size:11.5px!important;}
body.hrl-polished .subject-wrap{margin:0 0 4.5mm!important;font-size:12px!important;}
body.hrl-polished .title{font-size:17px!important;line-height:1.35!important;margin:0 0 5.5mm!important;}
body.hrl-polished .to{font-size:14.5px!important;line-height:1.55!important;margin:0 0 5mm!important;padding-bottom:2mm!important;}
body.hrl-polished .g{font-size:14.5px!important;margin:0 0 5mm!important;}
body.hrl-polished .body{font-size:14.2px!important;line-height:1.72!important;margin:3.5mm 0!important;font-weight:800!important;}
body.hrl-polished .after-text{font-size:13.4px!important;line-height:1.55!important;margin:2.5mm 0!important;}
body.hrl-polished .tbl{width:100%!important;margin:4mm auto!important;font-size:10.4px!important;box-shadow:none!important;}
body.hrl-polished .tbl th{padding:3.6px 4px!important;line-height:1.22!important;}
body.hrl-polished .tbl td{padding:3.6px 4px!important;line-height:1.27!important;}
body.hrl-polished .amount-table{margin-top:4mm!important;margin-bottom:3.5mm!important;}
body.hrl-polished .tafqeet{padding:6px 10px!important;margin:3.5mm auto 4mm!important;font-size:12.4px!important;line-height:1.45!important;border-radius:7px!important;}
body.hrl-polished .iban-table{margin:3.5mm auto 4mm!important;font-size:10.4px!important;}
body.hrl-polished .sig-left{margin-top:7mm!important;width:68mm!important;}
body.hrl-polished .sig-grid{margin-top:7mm!important;gap:7mm!important;}
body.hrl-polished .sig-line{height:7mm!important;margin:0 8mm 1.5mm!important;}
body.hrl-polished .sig-role,body.hrl-polished .sig-name{font-size:13.4px!important;line-height:1.35!important;}
body.hrl-polished .stamp{margin-top:4mm!important;}
@media print{
  body.hrl-polished .page{width:210mm!important;min-height:297mm!important;max-height:297mm!important;margin:0!important;}
}
</style>`;
  }

  function injectInto(win) {
    try {
      var doc = win && win.document;
      if (!doc || !doc.head || doc.getElementById('hospital-raise-letters-print-compact-v4')) return;
      doc.head.insertAdjacentHTML('beforeend', compactCss());
    } catch (_) {}
  }

  function wrapWindowOpen() {
    if (window.__HOSPITAL_RAISE_LETTERS_COMPACT_V4_OPEN_WRAPPED__) return;
    window.__HOSPITAL_RAISE_LETTERS_COMPACT_V4_OPEN_WRAPPED__ = true;
    var oldOpen = window.open;
    window.open = function () {
      var win = oldOpen.apply(window, arguments);
      try {
        if (win && win.document && !win.__hospitalRaiseCompactV4WriteWrapped) {
          win.__hospitalRaiseCompactV4WriteWrapped = true;
          var oldWrite = win.document.write.bind(win.document);
          win.document.write = function (html) {
            var result = oldWrite(html);
            setTimeout(function () { injectInto(win); }, 0);
            setTimeout(function () { injectInto(win); }, 80);
            return result;
          };
        }
      } catch (_) {}
      return win;
    };
  }

  wrapWindowOpen();
  console.info('[Hospital Raise Letters Print Compact] installed v4');
})();
