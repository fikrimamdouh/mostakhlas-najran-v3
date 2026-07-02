// Hospital Raise Letters Saudi Names Last Signature Fix V2
// Scope: hospital_raise_letters.html only.
// Runs after selected print polish. Re-paginates Saudi names compactly and keeps signatures on the final page only.
// Signature columns are kept in one row when signCols is set; long titles are compacted to avoid stacking.
(function () {
  'use strict';

  if (!/hospital_raise_letters\.html/.test(location.pathname) && !window.__HOSPITAL_LETTERS_STANDALONE_PAGE__) return;
  if (window.__HOSPITAL_RAISE_LETTERS_SAUDI_NAMES_LAST_SIGNATURE_FIX_V2__) return;
  window.__HOSPITAL_RAISE_LETTERS_SAUDI_NAMES_LAST_SIGNATURE_FIX_V2__ = true;

  var SETTINGS_KEY = 'hospitalRaiseLettersSettings_v8';
  var ROWS_PER_PAGE = 36;

  function clean(v) { return String(v == null ? '' : v).replace(/[\u200e\u200f]/g, '').replace(/\s+/g, ' ').trim(); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c]; }); }
  function ar(v) { return String(v).replace(/\d/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'[d]; }); }
  function readJson(k, f) { try { var r = localStorage.getItem(k); return r ? JSON.parse(r) : f; } catch (_) { return f; } }
  function serialize(doc) { return '<!doctype html>\n' + doc.documentElement.outerHTML; }
  function parseHtml(html) { try { return new DOMParser().parseFromString(String(html || ''), 'text/html'); } catch (_) { return null; } }
  function mm(v, fallback) { var n = Number(v); return Number.isFinite(n) && n >= 0 ? n : fallback; }

  function pageCss() {
    return '<style id="hospital-raise-saudi-names-last-signature-fix-v2">' +
      'body.hrl-polished .saudi-names-page .tbl{width:176mm!important;font-size:8.1px!important;margin:2mm auto!important;table-layout:fixed!important}' +
      'body.hrl-polished .saudi-names-page .tbl th,body.hrl-polished .saudi-names-page .tbl td{padding:1.2px 1.7px!important;line-height:1.04!important;vertical-align:middle!important;word-break:break-word!important}' +
      'body.hrl-polished .saudi-names-page .doc-page-counter{font-size:10.5px!important;margin:0 0 2.5mm!important;line-height:1.2!important;color:#003087!important;font-weight:900!important;text-align:left!important}' +
      'body.hrl-polished .saudi-names-page .sig-grid{display:grid!important;align-items:start!important;justify-content:space-between!important;width:100%!important;margin-right:auto!important;margin-left:auto!important}' +
      'body.hrl-polished .saudi-names-page .sig-left{width:100%!important;max-width:62mm!important;margin:0 auto!important;text-align:center!important;font-weight:900!important;white-space:normal!important}' +
      'body.hrl-polished .saudi-names-page .sig-line{height:7mm!important;border-bottom:1px solid #111!important;margin:0 8mm 1.5mm!important}' +
      'body.hrl-polished .saudi-names-page .sig-role{font-size:9.8pt!important;font-weight:900!important;line-height:1.18!important;white-space:normal!important;overflow-wrap:anywhere!important}' +
      'body.hrl-polished .saudi-names-page .sig-name{font-size:9.6pt!important;font-weight:900!important;line-height:1.22!important;white-space:normal!important;overflow-wrap:anywhere!important}' +
      '</style>';
  }

  function findSaudiPages(doc) {
    return Array.prototype.filter.call(doc.querySelectorAll('section.page'), function (p) {
      var title = p.querySelector('.title');
      return title && clean(title.textContent) === 'بيان أسماء السعوديين';
    });
  }

  function applyTpl(t, settings) {
    var s = settings || {};
    return String(t || '').replace(/\{sigTitle\}/g, clean(s.sigTitle || 'مدير المستشفى')).replace(/\{sigName\}/g, clean(s.sigName || ''));
  }

  function signatureHtml() {
    var s = readJson(SETTINGS_KEY, {});
    var texts = (s.texts && s.texts.saudiNames) || {};
    var layout = (s.layout && s.layout.saudiNames) || {};
    if (layout.showSign === 'no') return '';

    var arr = [];
    for (var i = 1; i <= 3; i++) {
      var t = applyTpl(texts['s' + i + 't'], s);
      var n = applyTpl(texts['s' + i + 'n'], s);
      if (t || n) arr.push([t, n]);
    }
    if (!arr.length) arr.push([clean(s.sigTitle || 'مدير المستشفى'), clean(s.sigName || '')]);

    var signCount = Math.max(1, Math.min(3, Number(layout.signCount) || arr.length || 1));
    arr = arr.slice(0, signCount);
    var cols = Math.max(1, Math.min(signCount, Number(layout.signCols) || signCount));
    var gap = cols > 1 ? 18 : 0;
    var top = mm(layout.sigTop, 18);

    if (arr.length === 1) {
      return '<div class="sig sig-left" style="margin-top:' + top + 'mm!important"><div class="sig-role">' + esc(arr[0][0]) + '</div><div class="sig-line"></div><div class="sig-name">' + esc(arr[0][1]) + '</div></div>';
    }

    return '<div class="sig-grid" style="grid-template-columns:repeat(' + cols + ',minmax(0,1fr))!important;gap:' + gap + 'mm!important;margin-top:' + top + 'mm!important">' + arr.map(function (x) {
      return '<div class="sig-left"><div class="sig-role">' + esc(x[0]) + '</div><div class="sig-line"></div><div class="sig-name">' + esc(x[1]) + '</div></div>';
    }).join('') + '</div>';
  }

  function setRows(page, rows) {
    var tbody = page.querySelector('table.tbl tbody');
    if (!tbody) return;
    tbody.innerHTML = rows.map(function (tr) { return tr.outerHTML; }).join('') || '<tr><td colspan="5">لا توجد بيانات</td></tr>';
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

  function removeAfterTable(page, isLast) {
    var table = page.querySelector('table.tbl');
    if (!table) return;
    var n = table.nextSibling;
    while (n) {
      var next = n.nextSibling;
      if (n.nodeType === 1) n.remove();
      n = next;
    }
    if (isLast) {
      table.insertAdjacentHTML('afterend', signatureHtml());
    } else {
      var note = page.ownerDocument.createElement('div');
      note.className = 'status-cont-note';
      note.textContent = 'يتبع في الصفحة التالية';
      table.parentNode.appendChild(note);
    }
  }

  function fixDoc(doc) {
    if (!doc || !doc.documentElement) return false;
    if (!doc.getElementById('hospital-raise-saudi-names-last-signature-fix-v2')) {
      try { doc.head.insertAdjacentHTML('beforeend', pageCss()); } catch (_) {}
    }
    try { doc.body.classList.add('hrl-polished'); } catch (_) {}

    var pages = findSaudiPages(doc);
    if (!pages.length) return false;

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

    var groups = [];
    for (var i = 0; i < rows.length; i += ROWS_PER_PAGE) groups.push(rows.slice(i, i + ROWS_PER_PAGE));
    if (!groups.length) groups = [[]];

    var parent = pages[0].parentNode;
    if (!parent) return false;
    var anchor = pages[0];
    var template = pages[0].cloneNode(true);

    groups.forEach(function (group, idx) {
      var page = template.cloneNode(true);
      var isLast = idx === groups.length - 1;
      page.classList.add('saudi-names-page');
      setRows(page, group);
      insertCounter(page, idx + 1, groups.length, rows.length, idx * ROWS_PER_PAGE + 1, idx * ROWS_PER_PAGE + group.length);
      removeAfterTable(page, isLast);
      parent.insertBefore(page, anchor);
    });
    pages.forEach(function (p) { if (p.parentNode) p.parentNode.removeChild(p); });
    return true;
  }

  function transform(html) {
    html = String(html || '');
    if (!/بيان أسماء السعوديين/.test(html)) return html;
    var doc = parseHtml(html);
    if (!fixDoc(doc)) return html;
    return serialize(doc);
  }

  function wrapWindowOpen() {
    if (window.__HOSPITAL_RAISE_SAUDI_NAMES_LAST_SIGNATURE_OPEN_WRAPPED_V2__) return;
    window.__HOSPITAL_RAISE_SAUDI_NAMES_LAST_SIGNATURE_OPEN_WRAPPED_V2__ = true;
    var oldOpen = window.open;
    window.open = function () {
      var win = oldOpen.apply(window, arguments);
      try {
        if (win && win.document && !win.__hospitalRaiseSaudiNamesLastSignatureWrappedV2) {
          win.__hospitalRaiseSaudiNamesLastSignatureWrappedV2 = true;
          var oldWrite = win.document.write.bind(win.document);
          win.document.write = function (html) {
            var result = oldWrite(html);
            setTimeout(function () { try { fixDoc(win.document); } catch (_) {} }, 60);
            return result;
          };
        }
      } catch (_) {}
      return win;
    };
  }

  function patchPreview() {
    try {
      var f = document.getElementById('prev');
      if (!f || !f.srcdoc || !/بيان أسماء السعوديين/.test(f.srcdoc)) return;
      var fixed = transform(f.srcdoc);
      if (fixed && fixed !== f.srcdoc) f.srcdoc = fixed;
    } catch (_) {}
  }

  wrapWindowOpen();
  setTimeout(patchPreview, 500);
  setTimeout(patchPreview, 1500);
  setInterval(patchPreview, 1200);

  window.HospitalRaiseLettersSaudiNamesLastSignatureFixV2 = { transform: transform, fixDoc: fixDoc };
  console.info('[Hospital Raise Letters Saudi Names Last Signature Fix] installed v2 one-row signatures');
})();
