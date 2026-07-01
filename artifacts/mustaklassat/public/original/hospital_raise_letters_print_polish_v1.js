// Hospital Raise Letters Print Polish V3
// Scope: hospital_raise_letters.html only.
// Purpose: make normal raise/labor letter print use consumables-like A4 sizing and add clear exit navigation.
// No data/calculation changes.
(function () {
  'use strict';

  if (!/hospital_raise_letters\.html/.test(location.pathname) && !window.__HOSPITAL_LETTERS_STANDALONE_PAGE__) return;
  if (window.__HOSPITAL_RAISE_LETTERS_PRINT_POLISH_V3__) return;
  window.__HOSPITAL_RAISE_LETTERS_PRINT_POLISH_V3__ = true;

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
<style id="hospital-raise-letters-print-polish-v3">
@page hrlPortrait { size:A4 portrait; margin:0; }
*{box-sizing:border-box!important;}
html,body{margin:0!important;direction:rtl!important;font-family:Tajawal,Arial,sans-serif!important;}
body.hrl-polished{background:#e9eef5!important;color:#111827!important;}
body.hrl-polished .page{page:hrlPortrait!important;width:210mm!important;min-height:297mm!important;margin:12px auto!important;background:#fff!important;box-shadow:0 10px 30px rgba(15,23,42,.16)!important;border-radius:0!important;position:relative!important;overflow:hidden!important;padding:0!important;page-break-after:always!important;break-after:page!important;}
body.hrl-polished .lh{position:absolute!important;top:0!important;left:0!important;width:210mm!important;z-index:0!important;pointer-events:none!important;}
body.hrl-polished .lh.full{height:297mm!important;object-fit:cover!important;}
body.hrl-polished .lh.top{object-fit:cover!important;}
body.hrl-polished .content{font-family:Tajawal,Arial,sans-serif!important;transform:none!important;transform-origin:top right!important;width:auto!important;min-height:297mm!important;margin:0!important;}
body.hrl-polished .content.no-letterhead{padding:14mm 12mm 18mm!important;}
body.hrl-polished .content:not(.no-letterhead){padding-right:15mm!important;padding-left:15mm!important;padding-bottom:18mm!important;}
body.hrl-polished .print-brand{display:none;grid-template-columns:72px 1fr 72px;align-items:center;border:2px solid #003087;border-radius:14px;padding:8px 12px;margin:0 0 10mm;background:linear-gradient(180deg,#ffffff,#f8fafc);box-shadow:0 2px 10px rgba(15,23,42,.08);}
body.hrl-polished .content.no-letterhead>.print-brand{display:grid!important;}
body.hrl-polished .print-brand img{width:64px!important;height:auto!important;object-fit:contain!important;}
body.hrl-polished .print-brand .brand-center{text-align:center!important;line-height:1.5!important;}
body.hrl-polished .print-brand h1{margin:0!important;color:#003087!important;font-size:17px!important;font-weight:900!important;text-decoration:none!important;}
body.hrl-polished .print-brand h2{margin:3px 0 0!important;color:#111827!important;font-size:13px!important;font-weight:900!important;}
body.hrl-polished .print-brand h3{margin:2px 0 0!important;color:#475569!important;font-size:12px!important;font-weight:800!important;}
body.hrl-polished .subject-wrap{text-align:left!important;margin:0 0 6mm!important;font-size:12.5px!important;font-weight:900!important;color:#111827!important;}
body.hrl-polished .subject-text{display:inline-block!important;border-bottom:1.5px solid #003087!important;color:#003087!important;padding:0 2mm 1mm!important;font-weight:900!important;}
body.hrl-polished .title{text-align:center!important;color:#003087!important;font-size:19px!important;font-weight:900!important;line-height:1.55!important;margin:0 0 8mm!important;text-decoration:underline!important;text-underline-offset:5px!important;}
body.hrl-polished .to{display:flex!important;justify-content:space-between!important;align-items:center!important;gap:18mm!important;width:100%!important;font-size:15.5px!important;font-weight:900!important;margin:0 0 8mm!important;line-height:1.8!important;white-space:nowrap!important;border-bottom:1px solid #dbeafe!important;padding-bottom:3mm!important;}
body.hrl-polished .g{text-align:center!important;font-size:15.5px!important;font-weight:900!important;margin:0 0 7mm!important;color:#0f172a!important;}
body.hrl-polished .body{font-size:15.7px!important;line-height:2.05!important;text-align:justify!important;margin:5mm 0!important;color:#111827!important;font-weight:800!important;white-space:pre-line!important;}
body.hrl-polished .after-text{text-align:right!important;font-size:14.5px!important;font-weight:900!important;line-height:1.9!important;}
body.hrl-polished .tbl{width:100%!important;max-width:100%!important;border-collapse:collapse!important;table-layout:auto!important;background:#fff!important;margin:7mm auto!important;font-size:11.5px!important;box-shadow:0 1px 5px rgba(15,23,42,.06)!important;}
body.hrl-polished .tbl th{background:#003087!important;color:#fff!important;border:1px solid #1e3a8a!important;font-weight:900!important;padding:5.5px!important;text-align:center!important;vertical-align:middle!important;line-height:1.35!important;}
body.hrl-polished .tbl td{border:1px solid #64748b!important;padding:5.5px!important;text-align:center!important;vertical-align:middle!important;line-height:1.45!important;color:#111827!important;}
body.hrl-polished .tbl tbody tr:nth-child(even) td{background:#f8fafc!important;}
body.hrl-polished .tbl td:first-child{font-weight:900!important;background:#f8fafc!important;text-align:right!important;}
body.hrl-polished .amount-table td:last-child{direction:ltr!important;text-align:center!important;white-space:nowrap!important;font-weight:900!important;}
body.hrl-polished .amount-table .grand td{background:#fff7d6!important;font-weight:900!important;color:#111827!important;}
body.hrl-polished .tafqeet{border:1px solid #94a3b8!important;background:#f8fafc!important;border-radius:8px!important;padding:9px 12px!important;margin:5mm auto 7mm!important;font-weight:900!important;line-height:1.8!important;color:#111827!important;width:100%!important;font-size:13.7px!important;}
body.hrl-polished .iban-table{width:100%!important;margin:5mm auto 6mm!important;font-size:11.5px!important;}
body.hrl-polished .iban-table td:first-child{background:#003087!important;color:#fff!important;text-align:center!important;width:28%!important;font-weight:900!important;}
body.hrl-polished .iban-value{background:#fff!important;direction:ltr!important;text-align:left!important;font-family:Arial,Tahoma,sans-serif!important;font-weight:900!important;letter-spacing:.8px!important;unicode-bidi:plaintext!important;}
body.hrl-polished .sig-left{margin-top:16mm!important;width:72mm!important;margin-right:auto!important;margin-left:4mm!important;text-align:center!important;font-weight:900!important;white-space:nowrap!important;}
body.hrl-polished .sig-role,body.hrl-polished .sig-name{font-size:14.5px!important;font-weight:900!important;color:#111827!important;white-space:nowrap!important;}
body.hrl-polished .sig-line{height:12mm!important;border-bottom:1px solid #111!important;margin:0 8mm 3mm!important;}
body.hrl-polished .sig-grid{display:grid!important;gap:10mm!important;margin-top:16mm!important;}
body.hrl-polished .stamp{border:2px solid #333!important;border-radius:50%!important;width:34mm!important;height:18mm!important;line-height:18mm!important;margin:7mm auto!important;font-weight:900!important;text-align:center!important;}
body.hrl-polished .print-toolbar{position:sticky!important;top:0!important;display:flex!important;justify-content:center!important;gap:10px!important;background:#111827!important;padding:10px!important;z-index:50!important;}
body.hrl-polished .print-toolbar button{border:0!important;border-radius:10px!important;padding:10px 18px!important;font-weight:900!important;cursor:pointer!important;background:#d4af37!important;color:#111!important;}
#hrl-exit-btn,#hrl-floating-exit{font-family:Tajawal,Arial,sans-serif!important;}
#hrl-exit-btn{background:#991b1b!important;color:#fff!important;border:0!important;border-radius:10px!important;padding:9px 13px!important;font-weight:950!important;cursor:pointer!important;}
#hrl-floating-exit{position:fixed!important;top:14px!important;left:14px!important;z-index:2147482500!important;width:42px!important;height:42px!important;border-radius:50%!important;border:0!important;background:#991b1b!important;color:#fff!important;font-size:22px!important;font-weight:900!important;box-shadow:0 8px 24px rgba(0,0,0,.25)!important;cursor:pointer!important;display:flex!important;align-items:center!important;justify-content:center!important;}
@media print{
  html,body{background:#fff!important;}
  body.hrl-polished .print-toolbar{display:none!important;}
  body.hrl-polished .page{margin:0!important;box-shadow:none!important;width:210mm!important;min-height:297mm!important;}
  body.hrl-polished .page:last-child{page-break-after:auto!important;break-after:auto!important;}
  #hrl-exit-btn,#hrl-floating-exit{display:none!important;}
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
    if (html.indexOf('hospital-raise-letters-print-polish-v3') === -1) {
      html = html.replace('</head>', polishCss() + '</head>');
    }
    html = html.replace('<body>', '<body class="hrl-polished">');
    html = html.replace(/<body class="hrl-polished" class="hrl-polished">/g, '<body class="hrl-polished">');
    html = html.replace(/(<div class="content [^>]*>)/g, '$1' + brandHtml());
    return html;
  }

  function wrapWindowOpen() {
    if (window.__HOSPITAL_RAISE_LETTERS_WINDOW_OPEN_POLISHED_V3__) return;
    window.__HOSPITAL_RAISE_LETTERS_WINDOW_OPEN_POLISHED_V3__ = true;
    var oldOpen = window.open;
    window.open = function () {
      var win = oldOpen.apply(window, arguments);
      try {
        if (win && win.document && !win.__hospitalRaisePolishWriteWrappedV3) {
          win.__hospitalRaisePolishWriteWrappedV3 = true;
          var oldWrite = win.document.write.bind(win.document);
          win.document.write = function (html) {
            var text = String(html || '');
            if (text.indexOf('خطابات رفع المستخلص العادي') !== -1 || text.indexOf('خطاب العمالة') !== -1 || text.indexOf('خطاب الرفع النهائي') !== -1 || text.indexOf('عدم أسبقية الصرف') !== -1) {
              return oldWrite(transform(text));
            }
            return oldWrite(html);
          };
        }
      } catch (_) {}
      return win;
    };
  }

  function exitLettersPage() {
    try {
      if (window.opener && !window.opener.closed) {
        window.close();
        return;
      }
    } catch (_) {}
    try {
      if (history.length > 1) {
        history.back();
        return;
      }
    } catch (_) {}
    location.href = '/';
  }

  function injectExitButtons() {
    try {
      var toolbar = document.querySelector('#hrl .toolbar');
      if (toolbar && !document.getElementById('hrl-exit-btn')) {
        var btn = document.createElement('button');
        btn.id = 'hrl-exit-btn';
        btn.type = 'button';
        btn.textContent = 'خروج / رجوع للبرنامج';
        btn.onclick = exitLettersPage;
        toolbar.insertBefore(btn, toolbar.firstChild);
      }
      if (!document.getElementById('hrl-floating-exit')) {
        var x = document.createElement('button');
        x.id = 'hrl-floating-exit';
        x.type = 'button';
        x.title = 'رجوع للبرنامج';
        x.textContent = '×';
        x.onclick = exitLettersPage;
        document.body.appendChild(x);
      }
    } catch (_) {}
  }

  function boot() {
    wrapWindowOpen();
    injectExitButtons();
  }

  boot();
  setTimeout(boot, 400);
  setTimeout(boot, 1200);
  setTimeout(boot, 2500);
  console.info('[Hospital Raise Letters Print Polish] installed v3 A4 sizing + exit');
})();
