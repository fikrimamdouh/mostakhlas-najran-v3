// Hospital Raise Letters Selected Print Polish V1
// Scope: hospital_raise_letters.html only.
// Fixes selected-print pages that did not match the old polish trigger words.
(function () {
  'use strict';

  if (!/hospital_raise_letters\.html/.test(location.pathname) && !window.__HOSPITAL_LETTERS_STANDALONE_PAGE__) return;
  if (window.__HOSPITAL_RAISE_LETTERS_SELECTED_PRINT_POLISH_V1__) return;
  window.__HOSPITAL_RAISE_LETTERS_SELECTED_PRINT_POLISH_V1__ = true;

  function needsPolish(html) {
    html = String(html || '');
    if (!/<section\s+class="page"/.test(html)) return false;
    if (!/خطابات رفع المستخلص العادي|فهرس مستندات المستخلص|خطاب الرفع النهائي|خطاب العمالة|عدم أسبقية الصرف|شهادة تسليم الرواتب|بيان الشواغر|بيان الإجازات|بيان السعودة|خطاب مخصص/.test(html)) return false;
    return true;
  }

  function lightPolishCss() {
    return '<style id="hospital-raise-selected-print-polish-v1">' +
      '@page{size:A4 portrait;margin:0}' +
      'html,body{margin:0!important;direction:rtl!important;font-family:Tajawal,Arial,sans-serif!important;background:#e9eef5;color:#111827}' +
      'body.hrl-polished .page{width:210mm!important;min-height:297mm!important;max-height:297mm!important;margin:0 auto!important;background:#fff!important;box-shadow:none!important;position:relative!important;overflow:hidden!important;padding:0!important;page-break-after:always!important;break-after:page!important}' +
      'body.hrl-polished .page:last-child{page-break-after:auto!important;break-after:auto!important}' +
      'body.hrl-polished .content{font-family:Tajawal,Arial,sans-serif!important;transform:none!important;transform-origin:top right!important;width:auto!important;min-height:297mm!important;margin:0!important}' +
      'body.hrl-polished .content.no-letterhead{padding:14mm 15mm 16mm!important}' +
      'body.hrl-polished .content:not(.no-letterhead){padding-right:15mm!important;padding-left:15mm!important;padding-bottom:16mm!important}' +
      'body.hrl-polished .subject-wrap{text-align:left!important;margin:0 0 4.5mm!important;font-size:12px!important;font-weight:900!important}' +
      'body.hrl-polished .subject-text{display:inline-block!important;border-bottom:1.5px solid #003087!important;color:#003087!important;padding:0 2mm 1mm!important;font-weight:900!important}' +
      'body.hrl-polished .title{text-align:center!important;color:#003087!important;font-size:17px!important;font-weight:900!important;line-height:1.35!important;margin:0 0 5.5mm!important;text-decoration:underline!important;text-underline-offset:5px!important}' +
      'body.hrl-polished .to{display:flex!important;justify-content:space-between!important;align-items:center!important;gap:18mm!important;width:100%!important;font-size:14.5px!important;font-weight:900!important;margin:0 0 5mm!important;line-height:1.55!important;white-space:nowrap!important;border-bottom:1px solid #dbeafe!important;padding-bottom:2mm!important}' +
      'body.hrl-polished .g{text-align:center!important;font-size:14.5px!important;font-weight:900!important;margin:0 0 5mm!important}' +
      'body.hrl-polished .body{font-size:14.2px!important;line-height:1.72!important;text-align:justify!important;margin:3.5mm 0!important;color:#111827!important;font-weight:800!important;white-space:pre-line!important}' +
      'body.hrl-polished .after-text{text-align:right!important;font-size:13.4px!important;font-weight:900!important;line-height:1.55!important;margin:2.5mm 0!important}' +
      'body.hrl-polished .tbl{width:100%!important;max-width:100%!important;border-collapse:collapse!important;table-layout:auto!important;background:#fff!important;margin:4mm auto!important;font-size:10.4px!important;box-shadow:none!important}' +
      'body.hrl-polished .tbl th{background:#003087!important;color:#fff!important;border:1px solid #1e3a8a!important;font-weight:900!important;padding:3.6px 4px!important;text-align:center!important;vertical-align:middle!important;line-height:1.22!important}' +
      'body.hrl-polished .tbl td{border:1px solid #64748b!important;padding:3.6px 4px!important;text-align:center!important;vertical-align:middle!important;line-height:1.27!important;color:#111827!important}' +
      'body.hrl-polished .tbl tbody tr:nth-child(even) td{background:#f8fafc!important}' +
      'body.hrl-polished .tbl td:first-child{font-weight:900!important;background:#f8fafc!important;text-align:right!important}' +
      'body.hrl-polished .amount-table td:last-child{direction:ltr!important;text-align:center!important;white-space:nowrap!important;font-weight:900!important}' +
      'body.hrl-polished .amount-table .grand td{background:#fff7d6!important;font-weight:900!important;color:#111827!important}' +
      'body.hrl-polished .tafqeet{border:1px solid #94a3b8!important;background:#f8fafc!important;border-radius:7px!important;padding:6px 10px!important;margin:3.5mm auto 4mm!important;font-weight:900!important;line-height:1.45!important;color:#111827!important;width:100%!important;font-size:12.4px!important}' +
      'body.hrl-polished .iban-table{width:100%!important;margin:3.5mm auto 4mm!important;font-size:10.4px!important}' +
      'body.hrl-polished .iban-table td:first-child{background:#003087!important;color:#fff!important;text-align:center!important;width:28%!important;font-weight:900!important}' +
      'body.hrl-polished .iban-value{background:#fff!important;direction:ltr!important;text-align:left!important;font-family:Arial,Tahoma,sans-serif!important;font-weight:900!important;letter-spacing:.8px!important;unicode-bidi:plaintext!important}' +
      'body.hrl-polished .sig-left{margin-top:7mm!important;width:68mm!important;margin-right:auto!important;margin-left:4mm!important;text-align:center!important;font-weight:900!important;white-space:nowrap!important}' +
      'body.hrl-polished .sig-role,body.hrl-polished .sig-name{font-size:13.4px!important;font-weight:900!important;color:#111827!important;white-space:nowrap!important;line-height:1.35!important}' +
      'body.hrl-polished .sig-line{height:7mm!important;border-bottom:1px solid #111!important;margin:0 8mm 1.5mm!important}' +
      'body.hrl-polished .sig-grid{display:grid!important;gap:7mm!important;margin-top:7mm!important}' +
      'body.hrl-polished .stamp{border:2px solid #333!important;border-radius:50%!important;width:34mm!important;height:18mm!important;line-height:18mm!important;margin:4mm auto!important;font-weight:900!important;text-align:center!important}' +
      '@media print{html,body{background:#fff!important}.print-toolbar{display:none!important}body.hrl-polished .page{margin:0!important;box-shadow:none!important;width:210mm!important;min-height:297mm!important;max-height:297mm!important}}' +
      '</style>';
  }

  function transform(html) {
    html = String(html || '');
    if (!needsPolish(html)) return html;

    if (html.indexOf('hospital-raise-selected-print-polish-v1') === -1 && html.indexOf('hospital-raise-letters-print-polish-v3') === -1) {
      html = html.replace('</head>', lightPolishCss() + '</head>');
    } else if (html.indexOf('hospital-raise-selected-print-polish-v1') === -1) {
      html = html.replace('</head>', lightPolishCss() + '</head>');
    }

    if (!/<body[^>]*class="[^"]*hrl-polished/.test(html)) {
      html = html.replace(/<body([^>]*)>/i, '<body$1 class="hrl-polished">');
    }

    return html;
  }

  function wrapWindowOpen() {
    if (window.__HOSPITAL_RAISE_SELECTED_PRINT_POLISH_OPEN_WRAPPED__) return;
    window.__HOSPITAL_RAISE_SELECTED_PRINT_POLISH_OPEN_WRAPPED__ = true;
    var oldOpen = window.open;
    window.open = function () {
      var win = oldOpen.apply(window, arguments);
      try {
        if (win && win.document && !win.__hospitalRaiseSelectedPrintPolishWriteWrapped) {
          win.__hospitalRaiseSelectedPrintPolishWriteWrapped = true;
          var oldWrite = win.document.write.bind(win.document);
          win.document.write = function (html) {
            return oldWrite(transform(html));
          };
        }
      } catch (_) {}
      return win;
    };
  }

  wrapWindowOpen();
  console.info('[Hospital Raise Letters Selected Print Polish] installed v1 all documents');
})();
