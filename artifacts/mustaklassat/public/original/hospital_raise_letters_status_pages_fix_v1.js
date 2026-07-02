// Hospital Raise Letters Status Pages Fix V1
// Scope: hospital_raise_letters.html only.
// Fixes vacancies pagination, vacation detection, Saudi counting, and signature styling in print windows.
(function () {
  'use strict';

  if (!/hospital_raise_letters\.html/.test(location.pathname) && !window.__HOSPITAL_LETTERS_STANDALONE_PAGE__) return;
  if (window.__HOSPITAL_RAISE_LETTERS_STATUS_PAGES_FIX_V1__) return;
  window.__HOSPITAL_RAISE_LETTERS_STATUS_PAGES_FIX_V1__ = true;

  var VACANCY_ROWS_PER_PAGE = 22;
  var VACATION_ROWS_PER_PAGE = 24;

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c];
    });
  }
  function clean(v) { return String(v == null ? '' : v).replace(/[\u200e\u200f]/g, '').replace(/\s+/g, ' ').trim(); }
  function readJson(k, f) { try { var r = localStorage.getItem(k); return r ? JSON.parse(r) : f; } catch (_) { return f; } }
  function ar(v) { return String(v).replace(/\d/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'[d]; }); }

  function deepText(x, depth) {
    if (depth > 5 || x == null) return '';
    if (typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean') return ' ' + String(x) + ' ';
    if (Array.isArray(x)) return x.map(function (v) { return deepText(v, depth + 1); }).join(' ');
    if (typeof x === 'object') return Object.keys(x).map(function (k) { return ' ' + k + ' ' + deepText(x[k], depth + 1); }).join(' ');
    return '';
  }
  function first(row, keys) {
    for (var i = 0; i < keys.length; i++) {
      var v = clean(row && row[keys[i]]);
      if (v && !/^(undefined|null|غير محدد|—|-)$/.test(v)) return v;
    }
    return '';
  }
  function name(row) { return first(row, ['name', 'employeeName', 'fullName', 'empName', 'arabicName', 'اسم الموظف', 'الاسم']); }
  function job(row) { return first(row, ['jobTitle', 'position', 'title', 'job', 'profession', 'وظيفة', 'الوظيفة', 'المهنة']); }
  function notes(row) { return first(row, ['notes', 'note', 'remarks', 'ملاحظات', 'الملاحظات']); }
  function looksLikeEmployeeRow(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
    if (name(o) || job(o)) return true;
    var t = deepText(o, 0);
    return /شاغر|إجاز|اجاز|سعود|غياب|حضور|nationality|jobTitle|employeeName/i.test(t) && Object.keys(o).length > 1;
  }
  function collectRows(src, out, seen, depth) {
    if (!src || depth > 6) return;
    if (Array.isArray(src)) { src.forEach(function (x) { collectRows(x, out, seen, depth + 1); }); return; }
    if (typeof src !== 'object') return;
    if (looksLikeEmployeeRow(src)) {
      var key = clean(name(src) + '|' + job(src) + '|' + deepText(src, 0).slice(0, 80));
      if (!seen[key]) { seen[key] = true; out.push(src); }
      return;
    }
    Object.keys(src).forEach(function (k) { collectRows(src[k], out, seen, depth + 1); });
  }
  function attendanceRows() {
    try {
      if (window.HospitalRaiseLettersEngineV8 && typeof window.HospitalRaiseLettersEngineV8.attendanceRows === 'function') {
        var engineRows = window.HospitalRaiseLettersEngineV8.attendanceRows();
        if (Array.isArray(engineRows)) return engineRows;
      }
    } catch (_) {}

    var sources = [
      readJson('attendanceData', null),
      readJson('ng_attendanceData', null),
      readJson('nd_attendanceData', null),
      readJson('persistentAttendanceData', null),
      readJson('najran_revision_snapshot', {}).attendanceData,
      readJson('najran_revision_snapshot', {}).persistentAttendanceData
    ];
    var rows = [], seen = {};
    sources.forEach(function (s) { collectRows(s, rows, seen, 0); });
    return rows;
  }
  function hasExactCode(row, codes) {
    var found = false;
    function walk(x, depth) {
      if (found || depth > 5 || x == null) return;
      if (typeof x === 'string' || typeof x === 'number') {
        var v = clean(x);
        if (codes.indexOf(v) >= 0) found = true;
        return;
      }
      if (Array.isArray(x)) { x.forEach(function (v) { walk(v, depth + 1); }); return; }
      if (typeof x === 'object') Object.keys(x).forEach(function (k) { walk(x[k], depth + 1); });
    }
    walk(row, 0);
    return found;
  }
  function isVacation(row) {
    var t = deepText(row, 0);
    return /إجاز|اجاز|اجازه|إجازه|vacation|annual\s+leave|leave/i.test(t) || hasExactCode(row, ['ج', 'إ', 'أجازة', 'إجازة', 'اجازة']);
  }
  function dayCodeCount(row, code) {
    return Array.isArray(row && row.days) ? row.days.filter(function (x) { return clean(x) === code; }).length : 0;
  }

  function vacancyDays(row) {
    return dayCodeCount(row, 'ش');
  }

  function vacancyNote(row) {
    var vd = vacancyDays(row);
    var base = notes(row);
    var employee = name(row);

    if (vd > 0) {
      return 'شاغر عدد ' + ar(vd) + ' يوم' + (employee ? ' - الموظف: ' + employee : '') + (base ? ' - ' + base : '');
    }

    if (!employee && job(row)) return base || 'شاغر كامل';
    return base;
  }

  function isVacant(row) {
    var n = name(row);
    var j = job(row);
    var st = first(row, ['status', 'attendanceStatus', 'type', 'حالة', 'الحالة']);
    var directText = [n, j, st].join(' ');

    return vacancyDays(row) > 0 || (!n && !!j) || /شاغر|vacant|vacancy/i.test(directText);
  }
  function isSaudi(row) {
    var t = deepText(row, 0);
    return /سعودي|سعودية|السعودية|saudi|ksa/i.test(t) || /\bSA\b/i.test(t) || row.isSaudi === true || row.saudi === true;
  }

  function statusFixCss() {
    return '<style id="hospital-raise-status-pages-fix-v1">' +
      'body.hrl-polished .doc-page-counter{font-weight:900;text-align:left;color:#003087;margin:0 0 3.5mm;font-size:11.5px!important}' +
      'body.hrl-polished .status-cont-note{font-weight:900;text-align:center;color:#475569;margin:4mm 0;font-size:12px!important}' +
      'body.hrl-polished .sig-line{border-bottom:none!important;height:15mm!important;margin:0 8mm 2mm!important}' +
      'body.hrl-polished .sig-role{font-size:15pt!important;font-weight:900!important;line-height:1.35!important}' +
      'body.hrl-polished .sig-name{font-size:13pt!important;font-weight:900!important;line-height:1.35!important}' +
      'body.hrl-polished .sig-left{white-space:normal!important}' +
      'body.hrl-polished .vacancies-page .tbl,body.hrl-polished .vacations-page .tbl{font-size:10.2px!important;margin:3.2mm auto!important}' +
      'body.hrl-polished .vacancies-page .tbl th,body.hrl-polished .vacancies-page .tbl td,body.hrl-polished .vacations-page .tbl th,body.hrl-polished .vacations-page .tbl td{padding:3px 3.4px!important;line-height:1.22!important}' +
      '</style>';
  }

  function parseHtml(html) {
    try { return new DOMParser().parseFromString(String(html || ''), 'text/html'); } catch (_) { return null; }
  }
  function serialize(doc) { return '<!doctype html>\n' + doc.documentElement.outerHTML; }
  function findPages(doc, keyword) {
    return Array.prototype.filter.call(doc.querySelectorAll('section.page'), function (p) {
      var title = p.querySelector('.title');
      return title && clean(title.textContent) === keyword;
    });
  }
  function setTableRows(table, rowHtml) {
    var tbody = table && table.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = rowHtml || '<tr><td colspan="4">لا توجد بيانات</td></tr>';
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
    for (var i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out.length ? out : [[]];
  }

  function fixVacancies(doc) {
    var rows = attendanceRows().filter(isVacant);
    var pages = findPages(doc, 'بيان الشواغر');
    if (!pages.length) return;
    pages.forEach(function (p) { p.classList.add('vacancies-page'); });
    var base = pages[0], table = base.querySelector('table.tbl');
    if (!table) return;
    var rowHtml = rows.map(function (r, i) {
      return '<tr><td>' + ar(i + 1) + '</td><td>' + esc(job(r) || 'شاغر') + '</td><td>' + esc(vacancyNote(r)) + '</td></tr>';
    });
    var groups = chunk(rowHtml, VACANCY_ROWS_PER_PAGE);
    var parent = base.parentNode;
    groups.forEach(function (g, idx) {
      var page = idx === 0 ? base : base.cloneNode(true);
      page.classList.add('vacancies-page');
      setTableRows(page.querySelector('table.tbl'), g.join('') || '<tr><td colspan="3">لا توجد بيانات</td></tr>');
      insertCounter(page, idx + 1, groups.length);
      if (idx < groups.length - 1) removeAfterTable(page);
      if (idx > 0) parent.insertBefore(page, base.nextSibling);
    });
    pages.slice(1).forEach(function (p) { if (p.parentNode) p.parentNode.removeChild(p); });
  }

  function fixVacations(doc) {
    var rows = attendanceRows().filter(isVacation);
    var pages = findPages(doc, 'بيان الإجازات');
    if (!pages.length) return;
    var base = pages[0], table = base.querySelector('table.tbl');
    if (!table) return;
    var rowHtml = rows.map(function (r, i) {
      return '<tr><td>' + ar(i + 1) + '</td><td>' + esc(name(r)) + '</td><td>' + esc(job(r)) + '</td><td>' + esc(notes(r)) + '</td></tr>';
    });
    var groups = chunk(rowHtml, VACATION_ROWS_PER_PAGE);
    var parent = base.parentNode;
    groups.forEach(function (g, idx) {
      var page = idx === 0 ? base : base.cloneNode(true);
      page.classList.add('vacations-page');
      setTableRows(page.querySelector('table.tbl'), g.join('') || '<tr><td colspan="4">لا توجد بيانات</td></tr>');
      if (groups.length > 1) insertCounter(page, idx + 1, groups.length);
      if (idx < groups.length - 1) removeAfterTable(page);
      if (idx > 0) parent.insertBefore(page, base.nextSibling);
    });
    pages.slice(1).forEach(function (p) { if (p.parentNode) p.parentNode.removeChild(p); });
  }

  function fixSaudi(doc) {
    var pages = findPages(doc, 'بيان السعودة');
    if (!pages.length) return;
    var rows = attendanceRows();
    var total = rows.length;
    var sa = rows.filter(isSaudi).length;
    var perc = total ? ((sa * 100 / total).toFixed(1) + '%') : '0%';
    pages.forEach(function (page) {
      var table = page.querySelector('table.tbl');
      if (!table) return;
      setTableRows(table, '<tr><td>' + ar(total) + '</td><td>' + ar(sa) + '</td><td>' + ar(perc) + '</td><td>حسب متطلبات العقد</td></tr>');
    });
  }

  function transform(html) {
    html = String(html || '');
    if (!/<section\s+class="page"/.test(html)) return html;
    if (!/بيان الشواغر|بيان الإجازات|بيان السعودة|خطابات رفع المستخلص العادي|خطاب العمالة|خطاب الرفع النهائي/.test(html)) return html;
    var doc = parseHtml(html);
    if (!doc || !doc.documentElement) return html;
    if (!doc.getElementById('hospital-raise-status-pages-fix-v1')) {
      doc.head.insertAdjacentHTML('beforeend', statusFixCss());
    }
    if (!/\bhrl-polished\b/.test(doc.body.className || '')) doc.body.classList.add('hrl-polished');
    fixVacancies(doc);
    fixVacations(doc);
    fixSaudi(doc);
    return serialize(doc);
  }

  function wrapWindowOpen() {
    if (window.__HOSPITAL_RAISE_STATUS_PAGES_FIX_OPEN_WRAPPED__) return;
    window.__HOSPITAL_RAISE_STATUS_PAGES_FIX_OPEN_WRAPPED__ = true;
    var oldOpen = window.open;
    window.open = function () {
      var win = oldOpen.apply(window, arguments);
      try {
        if (win && win.document && !win.__hospitalRaiseStatusPagesFixWriteWrapped) {
          win.__hospitalRaiseStatusPagesFixWriteWrapped = true;
          var oldWrite = win.document.write.bind(win.document);
          win.document.write = function (html) { return oldWrite(transform(html)); };
        }
      } catch (_) {}
      return win;
    };
  }

  wrapWindowOpen();
  window.HospitalRaiseLettersStatusPagesFix = { rows: attendanceRows, transform: transform };
  console.info('[Hospital Raise Letters Status Pages Fix] installed v1 vacancies/vacations/saudi/signatures');
})();
