/* review-print-override.js - preview and print styling only. No data manipulation. */
(function () {
  'use strict';
  if (!/\/original\/approval\.html(?:$|[?#])/.test(window.location.pathname + window.location.search)) return;

  function pad(n) { return String(n).padStart(2, '0'); }
  function safeFileName(s) {
    return String(s || '').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
  }

  var PREVIEW_PRINT_STYLE = [
    ':root{--rv-blue:#123b6d;--rv-blue2:#1e5aa8;--rv-gold:#c9a227;--rv-line:#d8e2ef;--rv-soft:#f4f7fb;--rv-text:#172033}',
    '.rv-modal{height:calc(100vh - 14px)!important;width:calc(100vw - 14px)!important;border-radius:18px!important;grid-template-rows:auto minmax(0,1fr)!important;overflow:hidden!important}',
    '.rv-body{padding:14px!important;background:linear-gradient(180deg,#edf4fb,#f7fafc)!important;overflow:auto!important}',
    '.rv-doc{max-width:none!important;width:100%!important;margin:0 auto!important;border-radius:16px!important;box-shadow:0 18px 60px rgba(15,32,80,.18)!important;border:1px solid var(--rv-line)!important;background:#fff!important}',
    '.rv-doc-head{background:linear-gradient(135deg,#fff,#f7fbff)!important;border-bottom:2px solid var(--rv-blue)!important;position:sticky!important;top:0!important;z-index:5!important;padding:18px 22px!important}',
    '.rv-doc-head h2{font-size:24px!important;color:var(--rv-blue)!important;margin:0 0 8px!important}',
    '.rv-doc-head p{font-size:14px!important;color:#334155!important;line-height:1.65!important}',
    '.rv-doc-head>b{background:#e8f1ff!important;color:#123b6d!important;border:1px solid #b8cff3!important;border-radius:999px!important;padding:7px 14px!important}',
    '.rv-tabs{grid-template-columns:repeat(4,1fr)!important;gap:10px!important;background:#f8fbff!important;border-bottom:1px solid var(--rv-line)!important;padding:12px!important;position:sticky!important;top:80px!important;z-index:4!important}',
    '.rv-nav-card{height:76px!important;border-radius:14px!important;border:1px solid var(--rv-line)!important;background:#fff!important;box-shadow:0 6px 20px rgba(15,32,80,.06)!important;display:flex!important;flex-direction:column!important;justify-content:center!important}',
    '.rv-nav-card b{font-size:15px!important;color:var(--rv-blue)!important}',
    '.rv-nav-card span{font-size:12px!important;color:#64748b!important;margin-top:4px!important}',
    '#rv-body section{padding:18px 22px!important}',
    '#rv-body section h3{font-size:22px!important;color:var(--rv-blue)!important;margin:0 0 14px!important;padding-bottom:8px!important;border-bottom:1px solid var(--rv-line)!important}',
    '.rv-main-stats,.rv-att-mini,.rv-substats{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:12px!important;margin:10px 0 16px!important}',
    '.rv-stat{background:#fff!important;border:1px solid var(--rv-line)!important;border-radius:14px!important;padding:14px 16px!important;min-height:82px!important;box-shadow:0 8px 24px rgba(15,32,80,.055)!important;display:flex!important;flex-direction:column!important;justify-content:center!important}',
    '.rv-stat span{font-size:12.5px!important;color:#64748b!important;font-weight:700!important}',
    '.rv-stat b{font-size:20px!important;color:#0f172a!important;margin-top:6px!important;line-height:1.25!important}',
    '.rv-stat.primary{border-right:5px solid var(--rv-blue2)!important}',
    '.rv-stat.ok{border-right:5px solid #16a34a!important}',
    '.rv-stat.warn{border-right:5px solid #f59e0b!important}',
    '.rv-info-grid{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:10px!important}',
    '.rv-info-grid div{background:#fbfdff!important;border:1px solid var(--rv-line)!important;border-radius:12px!important;padding:12px!important}',
    '.rv-info-grid b{display:block!important;color:#64748b!important;font-size:12px!important;margin-bottom:6px!important}',
    '.rv-info-grid span{display:block!important;color:#172033!important;font-size:15px!important;font-weight:800!important}',
    '.rv-period-note{background:#f8fbff!important;border:1px solid #cfe0f5!important;border-right:5px solid var(--rv-blue2)!important;border-radius:12px!important;padding:12px 14px!important;margin:0 0 14px!important;color:#334155!important}',
    '.rv-block{background:#fff!important;border:1px solid var(--rv-line)!important;border-radius:16px!important;margin:0 0 18px!important;overflow:hidden!important;box-shadow:0 8px 26px rgba(15,32,80,.055)!important}',
    '.rv-block-title{background:linear-gradient(135deg,#f8fbff,#eef6ff)!important;border-bottom:1px solid var(--rv-line)!important;padding:13px 16px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important}',
    '.rv-block-title h4{font-size:17px!important;color:var(--rv-blue)!important;margin:0!important}',
    '.rv-block-title span{font-size:12.5px!important;color:#475569!important;font-weight:800!important;background:#fff!important;border:1px solid var(--rv-line)!important;border-radius:999px!important;padding:5px 10px!important}',
    '.rv-scroll{overflow:auto!important;max-width:100%!important;background:#fff!important}',
    '.rv-table{width:100%!important;border-collapse:collapse!important;font-size:13px!important;min-width:max-content!important}',
    '.rv-table th{background:#123b6d!important;color:#fff!important;font-weight:800!important;border:1px solid #0b2d55!important;padding:8px 7px!important;white-space:nowrap!important}',
    '.rv-table td{border:1px solid #d7e0ea!important;padding:7px 6px!important;white-space:nowrap!important;color:#172033!important;background:#fff!important}',
    '.rv-table tbody tr:nth-child(even) td{background:#fbfdff!important}',
    '.rv-table .nm,.rv-table .it{white-space:normal!important;min-width:210px!important;max-width:360px!important;text-align:right!important;line-height:1.5!important}',
    '.rv-table .total td,.rv-table tr.total td{background:#eef6ff!important;font-weight:900!important;color:#123b6d!important}',
    '.rv-day{min-width:28px!important;text-align:center!important;font-weight:900!important}',
    '.rv-day.dح{background:#dcfce7!important;color:#166534!important}',
    '.rv-day.dغ{background:#fee2e2!important;color:#991b1b!important}',
    '.rv-day.dج{background:#fef3c7!important;color:#92400e!important}',
    '.rv-day.dش,.rv-day.dت{background:#e0f2fe!important;color:#075985!important}',
    '.tafq{font-size:15px!important;font-weight:900!important;text-align:right!important;background:#fff7ed!important;color:#7c2d12!important}',
    '.rv-print-meta{display:none}',
    '@media print{',
      '@page{size:A3 landscape;margin:7mm}',
      '*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}',
      'html,body{background:#fff!important;width:100%!important;height:auto!important;overflow:visible!important;margin:0!important;padding:0!important}',
      '.rv-print-root{width:100%!important;max-width:none!important;margin:0!important;padding:0!important;background:#fff!important}',
      '.rv-print-root .rv-doc{width:100%!important;max-width:none!important;margin:0!important;border:0!important;box-shadow:none!important;border-radius:0!important;overflow:visible!important}',
      '.rv-print-root .rv-doc-head{position:static!important;top:auto!important;padding:4mm 5mm 3mm!important;background:#fff!important;border-bottom:2px solid #123b6d!important;break-inside:avoid!important}',
      '.rv-print-root .rv-doc-head h2{font-size:18pt!important;margin:0 0 2mm!important;color:#123b6d!important}',
      '.rv-print-root .rv-doc-head p{font-size:9.8pt!important;line-height:1.45!important;margin:0!important;color:#334155!important}',
      '.rv-print-root .rv-doc-head>b{font-size:9pt!important;padding:1.6mm 3mm!important}',
      '.rv-print-root .rv-tabs,.rv-print-root .rv-no-print{display:none!important}',
      '.rv-print-root section{padding:4mm 5mm!important;border-bottom:0!important;break-inside:auto!important;page-break-inside:auto!important}',
      '.rv-print-root section h3{font-size:15pt!important;margin:0 0 3mm!important;color:#123b6d!important}',
      '.rv-print-root .rv-main-stats,.rv-print-root .rv-att-mini,.rv-print-root .rv-substats{display:grid!important;grid-template-columns:repeat(4,1fr)!important;gap:2.5mm!important;margin:1.5mm 0 3mm!important}',
      '.rv-print-root .rv-stat{padding:2.2mm 2.6mm!important;min-height:0!important;border-radius:5px!important;box-shadow:none!important;break-inside:avoid!important}',
      '.rv-print-root .rv-stat span{font-size:8pt!important}',
      '.rv-print-root .rv-stat b{font-size:10.8pt!important;margin-top:.7mm!important}',
      '.rv-print-root .rv-info-grid{display:grid!important;grid-template-columns:repeat(5,1fr)!important;gap:2mm!important}',
      '.rv-print-root .rv-info-grid div{padding:2mm!important;border-radius:5px!important}',
      '.rv-print-root .rv-info-grid b{font-size:7.8pt!important}',
      '.rv-print-root .rv-info-grid span{font-size:9.5pt!important}',
      '.rv-print-root .rv-period-note{font-size:9pt!important;padding:2.2mm!important;margin:0 0 3mm!important;border-radius:5px!important}',
      '.rv-print-root .rv-block{margin:0 0 4mm!important;border:1px solid #cbd5e1!important;border-radius:0!important;box-shadow:none!important;break-inside:auto!important;page-break-inside:auto!important}',
      '.rv-print-root .rv-block-title{padding:2mm 2.5mm!important;break-inside:avoid!important;background:#eef6ff!important}',
      '.rv-print-root .rv-block-title h4{font-size:11.8pt!important}',
      '.rv-print-root .rv-block-title span{font-size:8.7pt!important;padding:1mm 2mm!important}',
      '.rv-print-root .rv-scroll{overflow:visible!important;max-width:none!important;width:100%!important}',
      '.rv-print-root .rv-table{width:100%!important;min-width:0!important;table-layout:auto!important;font-size:7.35pt!important;border-collapse:collapse!important}',
      '.rv-print-root .rv-table th,.rv-print-root .rv-table td{padding:1mm .55mm!important;white-space:nowrap!important;border:1px solid #cbd5e1!important}',
      '.rv-print-root .rv-table .nm,.rv-print-root .rv-table .it{white-space:normal!important;min-width:28mm!important;max-width:56mm!important;text-align:right!important;line-height:1.25!important}',
      '.rv-print-root .rv-day{min-width:4.1mm!important;text-align:center!important}',
      '.rv-print-root #rv-performance .rv-table{font-size:8.2pt!important}',
      '.rv-print-root #rv-performance .rv-table .it{min-width:125mm!important;max-width:160mm!important}',
      '.rv-print-root #rv-achievement .rv-table{font-size:9pt!important}',
      '.rv-print-root .rv-section-break{break-before:page!important;page-break-before:always!important}',
      '.rv-print-root #rv-summary{break-before:auto!important;page-break-before:auto!important}',
      '.rv-print-root #rv-performance .rv-block{break-inside:avoid!important;page-break-inside:avoid!important}',
      '.rv-print-meta{display:block!important;position:fixed;bottom:2mm;left:6mm;right:6mm;font-size:8pt;color:#475569;border-top:1px solid #cbd5e1;padding-top:1.5mm;text-align:center;background:#fff!important}',
    '}'
  ].join('');

  function injectStyle() {
    var st = document.getElementById('rv-extra-style');
    if (!st) {
      st = document.createElement('style');
      st.id = 'rv-extra-style';
      document.head.appendChild(st);
    }
    st.textContent = PREVIEW_PRINT_STYLE;
  }

  function extractPrintInfo() {
    var doc = document.querySelector('#rv-body .rv-doc');
    var title = doc && doc.querySelector('.rv-doc-head h2') ? doc.querySelector('.rv-doc-head h2').textContent.trim() : 'مستخلص';
    var subtitle = doc && doc.querySelector('.rv-doc-head p') ? doc.querySelector('.rv-doc-head p').textContent.trim() : '';
    var parts = subtitle.split('—').map(function (x) { return x.trim(); }).filter(Boolean);
    var hospital = parts.length ? parts[0] : '';
    var pay = '---';
    var period = '';
    var info = doc ? Array.prototype.slice.call(doc.querySelectorAll('#rv-summary .rv-info-grid div, #rv-summary .rv-stat')) : [];
    info.forEach(function (el) {
      var t = el.textContent.replace(/\s+/g, ' ').trim();
      if (t.indexOf('رقم الدفعة') > -1) pay = (t.replace('رقم الدفعة', '').trim() || pay);
      if (t.indexOf('من تاريخ') > -1) period += ' من ' + t.replace('من تاريخ', '').trim();
      if (t.indexOf('إلى تاريخ') > -1) period += ' إلى ' + t.replace('إلى تاريخ', '').trim();
    });
    return { title: title, hospital: hospital, pay: pay, period: period };
  }

  function baseStyleText() {
    var rvStyle = document.getElementById('rv-style');
    return (rvStyle ? rvStyle.textContent : '') + '\n' + PREVIEW_PRINT_STYLE;
  }

  function printReviewDocument() {
    injectStyle();
    var body = document.getElementById('rv-body');
    var docHtml = body ? body.innerHTML : '';
    var info = extractPrintInfo();
    var today = new Date();
    var dateStr = today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate());
    var filename = safeFileName(info.title + ' - ' + (info.hospital || 'بدون مستشفى') + ' - دفعة ' + info.pay + ' - ' + dateStr);
    var meta = '<div class="rv-print-meta">' + info.title + (info.hospital ? ' — ' + info.hospital : '') + ' — دفعة ' + info.pay + ' — تاريخ الطباعة: ' + dateStr + (info.period ? ' — الفترة:' + info.period : '') + '</div>';
    var w = window.open('', '_blank', 'width=1800,height=1100');
    if (!w) { alert('المتصفح منع فتح نافذة الطباعة. اسمح بالنافذة المنبثقة ثم حاول مرة أخرى.'); return; }
    w.document.open();
    w.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>' + filename + '</title><style>' + baseStyleText().replace(/<\/style/gi, '') + '</style></head><body><div class="rv-print-root">' + docHtml + meta + '</div><script>window.onload=function(){document.title=' + JSON.stringify(filename) + ';setTimeout(function(){window.focus();window.print();},650)};<\/script></body></html>');
    w.document.close();
  }

  window.rvDownload = printReviewDocument;
  window.rvPrintClean = printReviewDocument;

  function relabelButtons() {
    injectStyle();
    var btn = document.getElementById('rv-download');
    if (btn) {
      btn.textContent = 'طباعة / حفظ PDF';
      btn.title = 'يطبع مستندًا مستقلًا واضحًا باسم المستشفى ورقم الدفعة وتاريخ الطباعة';
      btn.onclick = function (ev) { if (ev && ev.preventDefault) ev.preventDefault(); printReviewDocument(); };
    }
    var quick = document.getElementById('rv-print');
    if (quick) quick.onclick = function (ev) { if (ev && ev.preventDefault) ev.preventDefault(); printReviewDocument(); };
  }

  document.addEventListener('DOMContentLoaded', relabelButtons);
  document.addEventListener('click', function () { setTimeout(relabelButtons, 50); }, true);
  setInterval(relabelButtons, 800);
})();