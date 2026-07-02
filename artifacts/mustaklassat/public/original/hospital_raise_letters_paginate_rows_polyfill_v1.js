// Hospital Raise Letters Paginate Rows Polyfill V1
// Scope: hospital_raise_letters.html print transform helpers.
(function () {
  'use strict';

  if (!/hospital_raise_letters\.html/.test(location.pathname) && !window.__HOSPITAL_LETTERS_STANDALONE_PAGE__) return;

  function ar(v) {
    return String(v == null ? '' : v).replace(/\d/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'[d]; });
  }

  function rowsFromHtml(doc, rowHtml) {
    var box = doc.createElement('tbody');
    box.innerHTML = String(rowHtml || '');
    return Array.prototype.map.call(box.children || [], function (tr) { return tr.outerHTML; });
  }

  function setTableRows(table, html, colspan) {
    var tbody = table && table.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = html || '<tr><td colspan="' + (colspan || 5) + '">لا توجد بيانات</td></tr>';
  }

  function insertCounter(page, i, total) {
    var old = page.querySelector('.doc-page-counter');
    if (old) old.remove();
    var title = page.querySelector('.title') || page.querySelector('h1') || page.querySelector('.subject-wrap');
    var div = page.ownerDocument.createElement('div');
    div.className = 'doc-page-counter';
    div.textContent = 'صفحة ' + ar(i) + ' من ' + ar(total);
    if (title && title.parentNode) title.parentNode.insertBefore(div, title.nextSibling);
    else page.insertBefore(div, page.firstChild);
  }

  function removeAfterTable(page) {
    var table = page.querySelector('table.tbl');
    if (!table) return;
    var n = table.nextSibling;
    while (n) {
      var next = n.nextSibling;
      if (n.nodeType === 1) n.remove();
      n = next;
    }
    var note = page.ownerDocument.createElement('div');
    note.className = 'status-cont-note';
    note.textContent = 'يتبع في الصفحة التالية';
    table.parentNode.appendChild(note);
  }

  function chunk(arr, size) {
    var out = [];
    size = Math.max(1, Number(size) || 24);
    for (var i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out.length ? out : [[]];
  }

  window.paginateRows = function paginateRows(doc, pages, base, table, rowHtml, rowsPerPage, headers) {
    try {
      if (!doc || !base || !table) return;
      var colspan = headers && headers.length ? headers.length : 5;
      var rowList = rowsFromHtml(doc, rowHtml);
      var groups = chunk(rowList, rowsPerPage);
      var parent = base.parentNode;
      if (!parent) return;

      groups.forEach(function (g, idx) {
        var page = idx === 0 ? base : base.cloneNode(true);
        page.classList.add('saudi-names-page');
        setTableRows(page.querySelector('table.tbl'), g.join(''), colspan);
        if (groups.length > 1) insertCounter(page, idx + 1, groups.length);
        if (idx < groups.length - 1) removeAfterTable(page);
        if (idx > 0) parent.insertBefore(page, base.nextSibling);
      });

      Array.prototype.slice.call(pages || [], 1).forEach(function (p) {
        if (p && p.parentNode) p.parentNode.removeChild(p);
      });
    } catch (e) {
      console.warn('[Hospital Raise Letters Paginate Rows Polyfill] failed:', e);
    }
  };

  console.warn('[Hospital Raise Letters Paginate Rows Polyfill] installed v1');
})();