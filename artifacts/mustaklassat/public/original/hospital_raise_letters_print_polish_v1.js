// Hospital Raise Letters Print Polish V1
// Scope: hospital_raise_letters.html only.
// Improves print output visual quality, especially labor raise letter, without changing data/calculations.
(function () {
  'use strict';

  if (!/hospital_raise_letters\.html/.test(location.pathname) && !window.__HOSPITAL_LETTERS_STANDALONE_PAGE__) return;
  if (window.__HOSPITAL_RAISE_LETTERS_PRINT_POLISH_V1__) return;
  window.__HOSPITAL_RAISE_LETTERS_PRINT_POLISH_V1__ = true;

  function clean(v) { return String(v == null ? '' : v).replace(/[\u200e\u200f]/g, '').replace(/\s+/g, ' ').trim(); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c]; }); }
  function readJson(k, f) { try { var r = localStorage.getItem(k); return r ? JSON.parse(r) : f; } catch (_) { return f; } }

  function meta() {
    var c = readJson('persistentContractData', {});
    var e = readJson('persistentExtractData', {});
    var hospital = clean(c.hospitalName || c.siteName || c.centerName || localStorage.getItem('hospitalName') || localStorage.getItem('currentHospital') || '');
    var company = clean(c.companyName || c.contractorName || e.companyName || localStorage.getItem('companyName') || '');
    var start = clean(e.extractStart || e.periodStart || e.startDate || localStorage.getItem('extractStart') || '');
    var end = clean(e.extractEnd || e.periodEnd || e.endDate || localStorage.getItem('extractEnd') || '');
    var payment = clean(e.paymentNumber || e.extractNumber || localStorage.getItem('paymentNumber') || localStorage.getItem('extractNumber') || '');
    var period = payment ? ('دفعة رقم (' + payment.replace(/^0+(?=\d)/, '') + ')') : '';
    if (start || end) period += (period ? ' — ' : '') + 'عن الفترة من ' + (start || 'غير محدد') + ' إلى ' + (end || 'غير محدد');
    return { hospital: hospital || 'المستشفى', company: company || 'الشركة', period: period };
  }

  function polishCss() {
    return `
<style id="hospital-raise-letters-print-polish-v1">
body.hrl-polished{background:#eef3f9!important;}
body.hrl-polished .page{background:#fff!important;border-radius:0!important;}
body.hrl-polished .content{font-family:Tajawal,Arial,sans-serif!important;}
body.hrl-polished .print-brand{display:none;grid-template-columns:66px 1fr 66px;align-items:center;border:2px solid #003087;border-radius:14px;padding:7px 11px;margin:0 0 8mm;background:linear-gradient(180deg,#fff,#f8fafc);box-shadow:0 2px 8px rgba(15,23,42,.08);}
body.hrl-polished .content.no-letterhead>.print-brand{display:grid!important;}
body.hrl-polished .print-brand img{width:58px;height:auto;object-fit:contain;}
body.hrl-polished .print-brand .brand-center{text-align:center;line-height:1.5;}
body.hrl-polished .print-brand h1{margin:0;color:#003087;font-size:15.5pt;font-weight:900;text-decoration:none;}
body.hrl-polished .print-brand h2{margin:2px 0 0;color:#111827;font-size:12.2pt;font-weight:900;}
body.hrl-polished .print-brand h3{margin:2px 0 0;color:#475569;font-size:10.8pt;font-weight:800;}
body.hrl-polished .subject-wrap{margin-bottom:5mm!important;color:#111827!important;}
body.hrl-polished .subject-text{border-bottom:1.5px solid #003087!important;color:#003087!important;font-weight:900!important;}
body.hrl-polished .title{color:#003087!important;font-size:17pt!important;margin-bottom:7mm!important;}
body.hrl-polished .to{font-size:14pt!important;margin-bottom:7mm!important;border-bottom:1px solid #dbeafe;padding-bottom:3mm;}
body.hrl-polished .g{font-size:14pt!important;margin-bottom:6mm!important;color:#0f172a!important;}
body.hrl-polished .body{font-size:13.7pt!important;line-height:1.95!important;color:#111827!important;}
body.hrl-polished .tbl{border-collapse:collapse!important;margin:6mm auto!important;background:#fff!important;box-shadow:0 1px 5px rgba(15,23,42,.06)!important;}
body.hrl-polished .tbl th{background:#003087!important;color:#fff!important;border:1px solid #1e3a8a!important;font-weight:900!important;padding:1.8mm 2mm!important;}
body.hrl-polished .tbl td{border:1px solid #64748b!important;padding:1.8mm 2mm!important;color:#111827!important;}
body.hrl-polished .tbl tbody tr:nth-child(even) td{background:#f8fafc!important;}
body.hrl-polished .tbl td:first-child{font-weight:900!important;background:#f8fafc!important;}
body.hrl-polished .amount-table .grand td{background:#fff7d6!important;font-weight:900!important;color:#111827!important;}
body.hrl-polished .tafqeet{border:1.5px solid #003087!important;background:#f8fafc!important;border-radius:10px!important;padding:8px 12px!important;margin:5mm auto!important;font-weight:900!important;line-height:1.7!important;color:#111827!important;width:calc(100% - 4mm)!important;}
body.hrl-polished .iban-table{margin-top:4mm!important;}
body.hrl-polished .iban-table td:first-child{background:#003087!important;color:#fff!important;text-align:center!important;width:28%!important;}
body.hrl-polished .iban-value{background:#fff!important;direction:ltr!important;text-align:left!important;font-family:Arial,Tahoma,sans-serif!important;font-weight:900!important;letter-spacing:.8px!important;unicode-bidi:plaintext!important;}
body.hrl-polished .sig-left{margin-top:14mm!important;}
body.hrl-polished .sig-role,body.hrl-polished .sig-name{font-size:14pt!important;color:#111827!important;}
@media print{
  body.hrl-polished{background:#fff!important;}
  body.hrl-polished .page{margin:0!important;box-shadow:none!important;}
}
</style>`;
  }

  function brandHtml() {
    var m = meta();
    return '<div class="print-brand">' +
      '<img src="najran_health_cluster_logo.png" alt="شعار">' +
      '<div class="brand-center"><h1>خطابات رفع المستخلص العادي</h1><h2>' + esc(m.hospital) + '</h2><h3>' + esc(m.period || m.company) + '</h3></div>' +
      '<img src="najran_health_cluster_logo.png" alt="شعار">' +
      '</div>';
  }

  function transform(html) {
    html = String(html || '');
    if (html.indexOf('hospital-raise-letters-print-polish-v1') === -1) {
      html = html.replace('</head>', polishCss() + '</head>');
    }
    html = html.replace('<body>', '<body class="hrl-polished">');
    html = html.replace(/(<div class="content [^>]*>)/g, '$1' + brandHtml());
    return html;
  }

  function wrapWindowOpen() {
    if (window.__HOSPITAL_RAISE_LETTERS_WINDOW_OPEN_POLISHED__) return;
    window.__HOSPITAL_RAISE_LETTERS_WINDOW_OPEN_POLISHED__ = true;
    var oldOpen = window.open;
    window.open = function () {
      var win = oldOpen.apply(window, arguments);
      try {
        if (win && win.document && !win.__hospitalRaisePolishWriteWrapped) {
          win.__hospitalRaisePolishWriteWrapped = true;
          var oldWrite = win.document.write.bind(win.document);
          win.document.write = function (html) {
            if (String(html || '').indexOf('خطابات رفع المستخلص العادي') !== -1 || String(html || '').indexOf('خطاب العمالة') !== -1 || String(html || '').indexOf('خطاب الرفع النهائي') !== -1) {
              return oldWrite(transform(html));
            }
            return oldWrite(html);
          };
        }
      } catch (_) {}
      return win;
    };
  }

  wrapWindowOpen();
  console.info('[Hospital Raise Letters Print Polish] installed v1');
})();
