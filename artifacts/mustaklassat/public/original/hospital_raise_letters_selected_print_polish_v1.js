// Hospital Raise Letters Selected Print Polish V4
// Scope: hospital_raise_letters.html only.
// Keeps existing labor letters untouched.
// Ensures added documents have signatures and compacts/paginates Saudi names pages for large counts.
(function () {
  'use strict';

  if (!/hospital_raise_letters\.html/.test(location.pathname) && !window.__HOSPITAL_LETTERS_STANDALONE_PAGE__) return;
  if (window.__HOSPITAL_RAISE_LETTERS_SELECTED_PRINT_POLISH_V4__) return;
  window.__HOSPITAL_RAISE_LETTERS_SELECTED_PRINT_POLISH_V4__ = true;

  var SETTINGS_KEY = 'hospitalRaiseLettersSettings_v8';
  var NEW_DOCS_ONLY = ['absences', 'saudiNames'];
  var SAUDI_NAMES_ROWS_PER_PAGE = 32;

  function readJson(k, f) {
    try { var raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : f; } catch (_) { return f; }
  }
  function writeJson(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v || {})); return true; } catch (_) { return false; }
  }
  function clean(v) { return String(v == null ? '' : v).replace(/[\u200e\u200f]/g, '').replace(/\s+/g, ' ').trim(); }
  function ar(v) { return String(v).replace(/\d/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'[d]; }); }

  function ensureNewDocsSignatureFields(reason) {
    var s = readJson(SETTINGS_KEY, {});
    if (!s || typeof s !== 'object') s = {};
    s.texts = s.texts || {};
    s.layout = s.layout || {};
    var changed = false;

    NEW_DOCS_ONLY.forEach(function (key) {
      s.texts[key] = s.texts[key] || {};
      s.layout[key] = s.layout[key] || {};

      if (s.texts[key].s1t == null || !clean(s.texts[key].s1t)) { s.texts[key].s1t = '{sigTitle}'; changed = true; }
      if (s.texts[key].s1n == null) { s.texts[key].s1n = '{sigName}'; changed = true; }
      if (s.texts[key].s2t == null) { s.texts[key].s2t = ''; changed = true; }
      if (s.texts[key].s2n == null) { s.texts[key].s2n = ''; changed = true; }
      if (s.texts[key].s3t == null) { s.texts[key].s3t = ''; changed = true; }
      if (s.texts[key].s3n == null) { s.texts[key].s3n = ''; changed = true; }

      if (s.layout[key].showSign == null) { s.layout[key].showSign = 'yes'; changed = true; }
      if (!Number(s.layout[key].signCount)) { s.layout[key].signCount = 1; changed = true; }
      if (!Number(s.layout[key].signCols)) { s.layout[key].signCols = 1; changed = true; }
      if (!Number(s.layout[key].sigTop)) { s.layout[key].sigTop = 18; changed = true; }
    });

    if (changed) {
      s.version = s.version || 'hospital-v8-compact';
      writeJson(SETTINGS_KEY, s);
      try { console.warn('[Hospital Raise Letters New Docs Signature Fields] fixed:', reason || 'run'); } catch (_) {}
    }
    return s;
  }

  function needsPolish(html) {
    html = String(html || '');
    if (!/<section\s+class="page"/.test(html)) return false;
    if (!/خطابات رفع المستخلص العادي|فهرس مستندات المستخلص|خطاب الرفع النهائي|خطاب العمالة|عدم أسبقية الصرف|شهادة تسليم الرواتب|بيان الشواغر|بيان الإجازات|بيان الغياب|بيان السعودة|بيان أسماء السعوديين|خطاب مخصص/.test(html)) return false;
    return true;
  }

  function lightPolishCss() {
    return '<style id="hospital-raise-selected-print-polish-v4">' +
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
      'body.hrl-polished .saudi-names-page .tbl{width:176mm!important;font-size:8.5px!important;margin:2mm auto!important;table-layout:fixed!important}' +
      'body.hrl-polished .saudi-names-page .tbl th,body.hrl-polished .saudi-names-page .tbl td{padding:1.5px 2px!important;line-height:1.06!important;vertical-align:middle!important;word-break:break-word!important}' +
      'body.hrl-polished .saudi-names-page .tbl th:nth-child(1),body.hrl-polished .saudi-names-page .tbl td:nth-child(1){width:9mm!important}' +
      'body.hrl-polished .saudi-names-page .tbl th:nth-child(2),body.hrl-polished .saudi-names-page .tbl td:nth-child(2){width:58mm!important}' +
      'body.hrl-polished .saudi-names-page .tbl th:nth-child(3),body.hrl-polished .saudi-names-page .tbl td:nth-child(3){width:45mm!important}' +
      'body.hrl-polished .saudi-names-page .tbl th:nth-child(4),body.hrl-polished .saudi-names-page .tbl td:nth-child(4){width:25mm!important}' +
      'body.hrl-polished .saudi-names-page .tbl th:nth-child(5),body.hrl-polished .saudi-names-page .tbl td:nth-child(5){width:39mm!important}' +
      'body.hrl-polished .saudi-names-page .doc-page-counter{font-size:10.5px!important;margin:0 0 2.5mm!important;line-height:1.2!important;color:#003087!important;font-weight:900!important;text-align:left!important}' +
      'body.hrl-polished .saudi-names-page .sig,body.hrl-polished .saudi-names-page .sig-grid{margin-top:8mm!important}' +
      'body.hrl-polished .saudi-names-page .sig-line{height:8mm!important}' +
      'body.hrl-polished .saudi-names-page .sig-role{font-size:12.5pt!important}' +
      'body.hrl-polished .saudi-names-page .sig-name{font-size:11.5pt!important}' +
      'body.hrl-polished .status-cont-note{font-weight:900;text-align:center;color:#475569;margin:3mm 0;font-size:11.5px!important}' +
      '@media print{html,body{background:#fff!important}.print-toolbar{display:none!important}body.hrl-polished .page{margin:0!important;box-shadow:none!important;width:210mm!important;min-height:297mm!important;max-height:297mm!important}}' +
      '</style>';
  }

  function parseHtml(html) { try { return new DOMParser().parseFromString(String(html || ''), 'text/html'); } catch (_) { return null; } }
  function serialize(doc) { return '<!doctype html>\n' + doc.documentElement.outerHTML; }
  function findSaudiPages(doc) {
    return Array.prototype.filter.call(doc.querySelectorAll('section.page'), function (p) {
      var title = p.querySelector('.title');
      return title && clean(title.textContent) === 'بيان أسماء السعوديين';
    });
  }
  function insertCounter(page, i, total, totalRows, start, end) {
    var old = page.querySelector('.doc-page-counter');
    if (old) old.remove();
    var title = page.querySelector('.title') || page.querySelector('h1') || page.querySelector('.subject-wrap');
    var div = page.ownerDocument.createElement('div');
    div.className = 'doc-page-counter';
    div.textContent = 'صفحة ' + ar(i) + ' من ' + ar(total) + ' — إجمالي السعوديين: ' + ar(totalRows) + ' — الصفوف ' + ar(start) + '–' + ar(end);
    if (title && title.parentNode) title.parentNode.insertBefore(div, title.nextSibling);
    else page.insertBefore(div, page.firstChild);
  }
  function setRows(page, rows) {
    var tbody = page.querySelector('table.tbl tbody');
    if (!tbody) return;
    tbody.innerHTML = rows.map(function (tr) { return tr.outerHTML; }).join('') || '<tr><td colspan="5">لا توجد بيانات</td></tr>';
  }
  function removeAfterTable(page, keep) {
    var table = page.querySelector('table.tbl');
    if (!table) return;
    var n = table.nextSibling;
    while (n) {
      var next = n.nextSibling;
      if (n.nodeType === 1) n.remove();
      n = next;
    }
    if (!keep) {
      var note = page.ownerDocument.createElement('div');
      note.className = 'status-cont-note';
      note.textContent = 'يتبع في الصفحة التالية';
      table.parentNode.appendChild(note);
    }
  }
  function compactSaudiNamesPages(html) {
    if (!/بيان أسماء السعوديين/.test(html)) return html;
    var doc = parseHtml(html);
    if (!doc || !doc.documentElement) return html;
    var pages = findSaudiPages(doc);
    if (!pages.length) return html;

    var rows = [];
    pages.forEach(function (page) {
      Array.prototype.forEach.call(page.querySelectorAll('table.tbl tbody tr'), function (tr) {
        var text = clean(tr.textContent);
        if (!text || /لا توجد بيانات/.test(text)) return;
        rows.push(tr.cloneNode(true));
      });
    });
    rows.forEach(function (tr, idx) {
      var first = tr.querySelector('td');
      if (first) first.textContent = ar(idx + 1);
    });

    var total = rows.length;
    var groups = [];
    for (var i = 0; i < rows.length; i += SAUDI_NAMES_ROWS_PER_PAGE) groups.push(rows.slice(i, i + SAUDI_NAMES_ROWS_PER_PAGE));
    if (!groups.length) groups = [[]];

    var parent = pages[0].parentNode;
    var anchor = pages[0];
    var template = pages[pages.length - 1].cloneNode(true);
    groups.forEach(function (group, idx) {
      var page = template.cloneNode(true);
      page.classList.add('saudi-names-page');
      setRows(page, group);
      insertCounter(page, idx + 1, groups.length, total, idx * SAUDI_NAMES_ROWS_PER_PAGE + 1, idx * SAUDI_NAMES_ROWS_PER_PAGE + group.length);
      removeAfterTable(page, idx === groups.length - 1);
      parent.insertBefore(page, anchor);
    });
    pages.forEach(function (p) { if (p.parentNode) p.parentNode.removeChild(p); });
    return serialize(doc);
  }

  function transform(html) {
    html = String(html || '');
    if (!needsPolish(html)) return html;
    if (html.indexOf('hospital-raise-selected-print-polish-v4') === -1) {
      html = html.replace('</head>', lightPolishCss() + '</head>');
    }
    if (!/<body[^>]*class="[^"]*hrl-polished/.test(html)) {
      html = html.replace(/<body([^>]*)>/i, '<body$1 class="hrl-polished">');
    }
    html = compactSaudiNamesPages(html);
    return html;
  }

  function wrapWindowOpen() {
    if (window.__HOSPITAL_RAISE_SELECTED_PRINT_POLISH_OPEN_WRAPPED_V4__) return;
    window.__HOSPITAL_RAISE_SELECTED_PRINT_POLISH_OPEN_WRAPPED_V4__ = true;
    var oldOpen = window.open;
    window.open = function () {
      var win = oldOpen.apply(window, arguments);
      try {
        if (win && win.document && !win.__hospitalRaiseSelectedPrintPolishWriteWrappedV4) {
          win.__hospitalRaiseSelectedPrintPolishWriteWrappedV4 = true;
          var oldWrite = win.document.write.bind(win.document);
          win.document.write = function (html) { return oldWrite(transform(html)); };
        }
      } catch (_) {}
      return win;
    };
  }

  function patchPreview() {
    try {
      var f = document.getElementById('prev');
      if (!f || !f.srcdoc || !needsPolish(f.srcdoc)) return;
      var fixed = transform(f.srcdoc);
      if (fixed && fixed !== f.srcdoc) f.srcdoc = fixed;
    } catch (_) {}
  }

  ensureNewDocsSignatureFields('boot');
  wrapWindowOpen();
  setTimeout(function () { ensureNewDocsSignatureFields('late-500'); patchPreview(); }, 500);
  setTimeout(function () { ensureNewDocsSignatureFields('late-1500'); patchPreview(); }, 1500);
  setInterval(patchPreview, 900);

  window.HospitalRaiseLettersNewDocsSignatureFieldsV4 = { ensure: ensureNewDocsSignatureFields, transform: transform };
  console.info('[Hospital Raise Letters Selected Print Polish] installed v4 compact Saudi names pages');
})();
