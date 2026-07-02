// Hospital Raise Letters Status Pages Fix V4
// Scope: hospital_raise_letters.html only.
// Fixes vacancies pagination, vacation/absence detection, Saudi counting, Saudi names, and signature styling in print windows.
// Saudi denominator counts every captured attendance/labor row, including admin rows and duplicate vacant rows by row path.
(function () {
  'use strict';

  if (!/hospital_raise_letters\.html/.test(location.pathname) && !window.__HOSPITAL_LETTERS_STANDALONE_PAGE__) return;
  if (window.__HOSPITAL_RAISE_LETTERS_STATUS_PAGES_FIX_V4__) return;
  window.__HOSPITAL_RAISE_LETTERS_STATUS_PAGES_FIX_V4__ = true;

  var VACANCY_ROWS_PER_PAGE = 22;
  var VACATION_ROWS_PER_PAGE = 24;
  var ABSENCE_ROWS_PER_PAGE = 24;
  var SAUDI_NAMES_ROWS_PER_PAGE = 24;

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c];
    });
  }
  function clean(v) { return String(v == null ? '' : v).replace(/[\u200e\u200f]/g, '').replace(/\s+/g, ' ').trim(); }
  function readJson(k, f) { try { var r = localStorage.getItem(k); return r ? JSON.parse(r) : f; } catch (_) { return f; } }
  function readSessionJson(k, f) { try { var r = sessionStorage.getItem(k); return r ? JSON.parse(r) : f; } catch (_) { return f; } }
  function ar(v) { return String(v).replace(/\d/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'[d]; }); }

  function deepText(x, depth) {
    if (depth > 6 || x == null) return '';
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
  function name(row) { return first(row, ['name', 'employeeName', 'fullName', 'empName', 'arabicName', 'employee_name', 'workerName', 'worker_name', 'اسم الموظف', 'الاسم', 'اسم العامل']); }
  function job(row) { return first(row, ['jobTitle', 'position', 'title', 'job', 'jobName', 'job_name', 'positionName', 'position_name', 'workPosition', 'role', 'roleName', 'profession', 'occupation', 'adminJob', 'وظيفة', 'الوظيفة', 'المهنة', 'المسمى الوظيفي']); }
  function notes(row) { return first(row, ['notes', 'note', 'remarks', 'comment', 'ملاحظات', 'الملاحظات']); }
  function nationality(row) { return first(row, ['nationality', 'nationalityName', 'country', 'citizenship', 'nat', 'الجنسية']); }
  function empId(row) { return first(row, ['iqamaId', 'iqama', 'idNumber', 'nationalId', 'identity', 'employeeId', 'id', 'workerId', 'هوية', 'الإقامة', 'رقم الهوية', 'رقم الإقامة']); }
  function status(row) { return first(row, ['status', 'attendanceStatus', 'type', 'state', 'حالة', 'الحالة']); }

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

  function dayCodeCount(row, code) {
    return Array.isArray(row && row.days) ? row.days.filter(function (x) { return clean(x) === code; }).length : 0;
  }

  function vacancyDays(row) { return dayCodeCount(row, 'ش'); }
  function vacancyNote(row) {
    var vd = vacancyDays(row);
    var base = notes(row);
    var employee = name(row);
    if (vd > 0) return 'شاغر عدد ' + ar(vd) + ' يوم' + (employee && !/شاغر|vacant|vacancy/i.test(employee) ? ' - الموظف: ' + employee : '') + (base ? ' - ' + base : '');
    if ((!employee || /شاغر|vacant|vacancy/i.test(employee)) && job(row)) return base || 'شاغر كامل';
    return base;
  }
  function isVacant(row) {
    var n = name(row);
    var j = job(row);
    var directText = [n, j, status(row), notes(row)].join(' ');
    return vacancyDays(row) > 0 || (!n && !!j) || /شاغر|شاغره|شاغرة|vacant|vacancy/i.test(directText);
  }

  function leaveDays(row) { return dayCodeCount(row, 'ج'); }
  function leaveNote(row) {
    var ld = leaveDays(row);
    var base = notes(row);
    if (ld > 0) return 'إجازة عدد ' + ar(ld) + ' يوم' + (base ? ' - ' + base : '');
    return base || 'إجازة';
  }
  function isVacation(row) {
    var t = deepText(row, 0);
    return leaveDays(row) > 0 || /إجاز|اجاز|اجازه|إجازه|vacation|annual\s+leave|leave/i.test(t) || hasExactCode(row, ['ج', 'إ', 'أجازة', 'إجازة', 'اجازة']);
  }

  function absenceDays(row) { return dayCodeCount(row, 'غ'); }
  function absenceNote(row) {
    var gd = absenceDays(row);
    var base = notes(row);
    if (gd > 0) return 'غياب عدد ' + ar(gd) + ' يوم' + (base ? ' - ' + base : '');
    return base || 'غياب';
  }
  function isAbsence(row) {
    var directText = [status(row), notes(row)].join(' ');
    return absenceDays(row) > 0 || /(^|\s)(غ|غياب|غائب|absence|absent)(\s|$)/i.test(directText);
  }

  function isSaudi(row) {
    var directText = [nationality(row), status(row)].join(' ');
    if (/غير\s*سعود|غير\s*سعودي|غير\s*سعودى|non[-\s]*saudi|not\s+saudi|أجنبي|اجنبي/i.test(directText)) return false;
    return /(^|\s)(سعودي|سعودى|سعودية|السعودية|saudi|ksa)(\s|$)/i.test(directText) || row.isSaudi === true || row.saudi === true;
  }

  function isRealNamedEmployee(row) {
    var n = clean(name(row));
    if (!n) return false;
    if (/^(شاغر|شاغره|شاغرة|vacant|vacancy)$/i.test(n)) return false;
    if (/شاغر|شاغره|شاغرة|vacant|vacancy/i.test(n)) return false;
    return true;
  }

  function hasAttendanceShape(row) {
    return !!row && typeof row === 'object' && !Array.isArray(row) && (
      Array.isArray(row.days) ||
      !!name(row) ||
      !!job(row) ||
      !!nationality(row) ||
      !!status(row) ||
      !!empId(row) ||
      isVacant(row)
    );
  }

  function isCountableLaborPosition(row) {
    // كل صف تم التقاطه من الحضور والانصراف كصف عمالة يتحسب في مقام السعودة.
    // لا نستبعد الإداريين أو الشواغر أو الصفوف التي ليس بها جنسية.
    return hasAttendanceShape(row);
  }

  function looksLikeEmployeeRow(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
    if (hasAttendanceShape(o)) return true;
    var t = deepText(o, 0);
    return /شاغر|شاغره|شاغرة|إجاز|اجاز|سعود|غياب|حضور|nationality|jobTitle|jobName|positionName|employeeName|workerName|admin_saudi/i.test(t) && Object.keys(o).length > 1;
  }

  function rowKey(row, path) {
  var id = clean(empId(row));
  var n = clean(name(row));
  var j = clean(job(row));
  var nat = clean(nationality(row));

  if (isVacant(row)) {
    return 'vacant-row-path|' + clean(path) + '|' + j + '|' + n + '|' + nat + '|' + vacancyDays(row);
  }

  if (id) return 'id|' + id;

  if (n) return 'name|' + n + '|' + j + '|' + nat;

  return 'row-path|' + clean(path) + '|' + j + '|' + nat + '|' + deepText(row, 0).slice(0, 160);
}
  function collectRows(src, out, seen, depth, path) {
    if (!src || depth > 8) return;
    path = path || 'root';
    if (Array.isArray(src)) {
      src.forEach(function (x, idx) { collectRows(x, out, seen, depth + 1, path + '/' + idx); });
      return;
    }
    if (typeof src !== 'object') return;
    if (looksLikeEmployeeRow(src)) {
      var key = rowKey(src, path);
      if (!seen[key]) { seen[key] = true; out.push(src); }
      return;
    }
    Object.keys(src).forEach(function (k) { collectRows(src[k], out, seen, depth + 1, path + '/' + k); });
  }

  function addSnapshotSources(snapshot, sources) {
    if (!snapshot || typeof snapshot !== 'object') return;
    sources.push(snapshot.attendanceData);
    sources.push(snapshot.ng_attendanceData);
    sources.push(snapshot.nd_attendanceData);
    sources.push(snapshot.persistentAttendanceData);
    if (snapshot.najran_revision_snapshot) {
      sources.push(snapshot.najran_revision_snapshot.attendanceData);
      sources.push(snapshot.najran_revision_snapshot.ng_attendanceData);
      sources.push(snapshot.najran_revision_snapshot.nd_attendanceData);
      sources.push(snapshot.najran_revision_snapshot.persistentAttendanceData);
    }
  }

  function attendanceRows() {
    var sources = [];
    try {
      if (window.HospitalRaiseLettersEngineV8 && typeof window.HospitalRaiseLettersEngineV8.attendanceRows === 'function') {
        sources.push(window.HospitalRaiseLettersEngineV8.attendanceRows());
      }
    } catch (_) {}

    addSnapshotSources(readSessionJson('hrl_snapshot_v1', {}), sources);
    addSnapshotSources(readJson('hrl_snapshot_v1', {}), sources);

    var revision = readJson('najran_revision_snapshot', {});
    sources.push(readJson('attendanceData', null));
    sources.push(readJson('ng_attendanceData', null));
    sources.push(readJson('nd_attendanceData', null));
    sources.push(readJson('persistentAttendanceData', null));
    sources.push(revision.attendanceData);
    sources.push(revision.ng_attendanceData);
    sources.push(revision.nd_attendanceData);
    sources.push(revision.persistentAttendanceData);

    var rows = [], seen = {};
    sources.forEach(function (s, srcIdx) { collectRows(s, rows, seen, 0, 'src' + srcIdx); });

    try {
      window.__HospitalRaiseLettersMergedAttendanceCount = rows.length;
      window.__HospitalRaiseLettersMergedAttendanceSources = sources.length;
      window.__HospitalRaiseLettersMergedVacancyCount = rows.filter(isVacant).length;
      window.__HospitalRaiseLettersMergedCountableCount = rows.filter(isCountableLaborPosition).length;
    } catch (_) {}
    return rows;
  }

  function statusFixCss() {
    return '<style id="hospital-raise-status-pages-fix-v4">' +
      'body.hrl-polished .doc-page-counter{font-weight:900;text-align:left;color:#003087;margin:0 0 3.5mm;font-size:11.5px!important}' +
      'body.hrl-polished .status-cont-note{font-weight:900;text-align:center;color:#475569;margin:4mm 0;font-size:12px!important}' +
      'body.hrl-polished .sig-line{border-bottom:none!important;height:15mm!important;margin:0 8mm 2mm!important}' +
      'body.hrl-polished .sig-role{font-size:15pt!important;font-weight:900!important;line-height:1.35!important}' +
      'body.hrl-polished .sig-name{font-size:13pt!important;font-weight:900!important;line-height:1.35!important}' +
      'body.hrl-polished .sig-left{white-space:normal!important}' +
      'body.hrl-polished .vacancies-page .tbl,body.hrl-polished .vacations-page .tbl,body.hrl-polished .absences-page .tbl,body.hrl-polished .saudi-names-page .tbl{font-size:10.2px!important;margin:3.2mm auto!important}' +
      'body.hrl-polished .vacancies-page .tbl th,body.hrl-polished .vacancies-page .tbl td,body.hrl-polished .vacations-page .tbl th,body.hrl-polished .vacations-page .tbl td,body.hrl-polished .absences-page .tbl th,body.hrl-polished .absences-page .tbl td,body.hrl-polished .saudi-names-page .tbl th,body.hrl-polished .saudi-names-page .tbl td{padding:3px 3.4px!important;line-height:1.22!important}' +
      '</style>';
  }

  function parseHtml(html) { try { return new DOMParser().parseFromString(String(html || ''), 'text/html'); } catch (_) { return null; } }
  function serialize(doc) { return '<!doctype html>\n' + doc.documentElement.outerHTML; }
  function findPages(doc, keyword) {
    return Array.prototype.filter.call(doc.querySelectorAll('section.page'), function (p) {
      var title = p.querySelector('.title');
      return title && clean(title.textContent) === keyword;
    });
  }
  function setTableRows(table, rowHtml, colspan) {
    var tbody = table && table.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = rowHtml || '<tr><td colspan="' + (colspan || 4) + '">لا توجد بيانات</td></tr>';
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

  function paginateStatusPages(pages, rowHtml, rowsPerPage, pageClass, colspan) {
    if (!pages.length) return;
    var base = pages[0], table = base.querySelector('table.tbl');
    if (!table || !base.parentNode) return;

    var template = base.cloneNode(true);
    var groups = chunk(rowHtml, rowsPerPage);
    var parent = base.parentNode;
    var anchor = base;

    groups.forEach(function (g, idx) {
      var page = idx === 0 ? base : template.cloneNode(true);
      page.classList.add(pageClass);
      setTableRows(page.querySelector('table.tbl'), g.join('') || '<tr><td colspan="' + colspan + '">لا توجد بيانات</td></tr>', colspan);
      if (groups.length > 1) insertCounter(page, idx + 1, groups.length);
      if (idx < groups.length - 1) removeAfterTable(page);
      if (idx > 0) {
        parent.insertBefore(page, anchor.nextSibling);
        anchor = page;
      }
    });

    pages.slice(1).forEach(function (p) { if (p.parentNode) p.parentNode.removeChild(p); });
  }

  function fixVacancies(doc) {
    var rows = attendanceRows().filter(isVacant);
    var pages = findPages(doc, 'بيان الشواغر');
    var rowHtml = rows.map(function (r, i) {
      return '<tr><td>' + ar(i + 1) + '</td><td>' + esc(job(r) || 'شاغر') + '</td><td>' + esc(vacancyNote(r)) + '</td></tr>';
    });
    pages.forEach(function (p) { p.classList.add('vacancies-page'); });
    paginateStatusPages(pages, rowHtml, VACANCY_ROWS_PER_PAGE, 'vacancies-page', 3);
  }

  function fixVacations(doc) {
    var rows = attendanceRows().filter(isVacation);
    var pages = findPages(doc, 'بيان الإجازات');
    var rowHtml = rows.map(function (r, i) {
      return '<tr><td>' + ar(i + 1) + '</td><td>' + esc(name(r)) + '</td><td>' + esc(job(r)) + '</td><td>' + esc(leaveNote(r)) + '</td></tr>';
    });
    pages.forEach(function (p) { p.classList.add('vacations-page'); });
    paginateStatusPages(pages, rowHtml, VACATION_ROWS_PER_PAGE, 'vacations-page', 4);
  }

  function fixAbsences(doc) {
    var rows = attendanceRows().filter(isAbsence);
    var pages = findPages(doc, 'بيان الغياب');
    var rowHtml = rows.map(function (r, i) {
      return '<tr><td>' + ar(i + 1) + '</td><td>' + esc(name(r)) + '</td><td>' + esc(job(r)) + '</td><td>' + esc(absenceNote(r)) + '</td></tr>';
    });
    pages.forEach(function (p) { p.classList.add('absences-page'); });
    paginateStatusPages(pages, rowHtml, ABSENCE_ROWS_PER_PAGE, 'absences-page', 4);
  }

  function fixSaudi(doc) {
    var pages = findPages(doc, 'بيان السعودة');
    if (!pages.length) return;
    var rows = attendanceRows();
    var countable = rows.filter(isCountableLaborPosition);
    var total = countable.length;
    var sa = rows.filter(function (r) { return isRealNamedEmployee(r) && isSaudi(r); }).length;
    var perc = total ? ((sa * 100 / total).toFixed(2) + '%') : '0.00%';
    try {
      window.__HospitalRaiseLettersSaudiTotal = total;
      window.__HospitalRaiseLettersSaudiNamedCount = sa;
    } catch (_) {}
    pages.forEach(function (page) {
      var table = page.querySelector('table.tbl');
      if (!table) return;
      setTableRows(table, '<tr><td>' + ar(total) + '</td><td>' + ar(sa) + '</td><td>' + ar(perc) + '</td><td>حسب متطلبات العقد</td></tr>', 4);
    });
  }

  function fixSaudiNames(doc) {
    var rows = attendanceRows().filter(function (r) { return isRealNamedEmployee(r) && isSaudi(r); });
    var pages = findPages(doc, 'بيان أسماء السعوديين');
    var rowHtml = rows.map(function (r, i) {
      return '<tr><td>' + ar(i + 1) + '</td><td>' + esc(name(r)) + '</td><td>' + esc(job(r)) + '</td><td>' + esc(nationality(r)) + '</td><td>' + esc(empId(r)) + '</td></tr>';
    });
    pages.forEach(function (p) { p.classList.add('saudi-names-page'); });
    paginateStatusPages(pages, rowHtml, SAUDI_NAMES_ROWS_PER_PAGE, 'saudi-names-page', 5);
  }

  function transform(html) {
    html = String(html || '');
    if (!/<section\s+class="page"/.test(html)) return html;
    if (!/بيان الشواغر|بيان الإجازات|بيان الغياب|بيان السعودة|بيان أسماء السعوديين|خطابات رفع المستخلص العادي|خطاب العمالة|خطاب الرفع النهائي/.test(html)) return html;
    var doc = parseHtml(html);
    if (!doc || !doc.documentElement) return html;
    if (!doc.getElementById('hospital-raise-status-pages-fix-v4')) doc.head.insertAdjacentHTML('beforeend', statusFixCss());
    if (!/\bhrl-polished\b/.test(doc.body.className || '')) doc.body.classList.add('hrl-polished');
    fixVacancies(doc);
    fixVacations(doc);
    fixAbsences(doc);
    fixSaudi(doc);
    fixSaudiNames(doc);
    return serialize(doc);
  }

  function wrapWindowOpen() {
    if (window.__HOSPITAL_RAISE_STATUS_PAGES_FIX_OPEN_WRAPPED_V4__) return;
    window.__HOSPITAL_RAISE_STATUS_PAGES_FIX_OPEN_WRAPPED_V4__ = true;
    var oldOpen = window.open;
    window.open = function () {
      var win = oldOpen.apply(window, arguments);
      try {
        if (win && win.document && !win.__hospitalRaiseStatusPagesFixWriteWrappedV4) {
          win.__hospitalRaiseStatusPagesFixWriteWrappedV4 = true;
          var oldWrite = win.document.write.bind(win.document);
          win.document.write = function (html) { return oldWrite(transform(html)); };
        }
      } catch (_) {}
      return win;
    };
  }

  function patchEngineRender() {
    try {
      var api = window.HospitalRaiseLettersEngineV8;
      if (!api || typeof api.renderDocument !== 'function' || api.__statusPagesMergedSaudiV4) return false;
      var oldRender = api.renderDocument;
      api.renderDocument = function () { return transform(oldRender.apply(this, arguments)); };
      api.__statusPagesMergedSaudiV4 = true;
      return true;
    } catch (_) { return false; }
  }

  function patchPreview() {
    try {
      var f = document.getElementById('prev');
      if (!f || !f.srcdoc || !/بيان السعودة|بيان أسماء السعوديين|بيان الشواغر|بيان الإجازات|بيان الغياب/.test(f.srcdoc)) return;
      var fixed = transform(f.srcdoc);
      if (fixed && fixed !== f.srcdoc) f.srcdoc = fixed;
    } catch (_) {}
  }

  wrapWindowOpen();
  patchEngineRender();
  setTimeout(patchEngineRender, 300);
  setTimeout(patchEngineRender, 1000);
  setInterval(patchPreview, 700);

  window.HospitalRaiseLettersStatusPagesFix = {
    rows: attendanceRows,
    transform: transform,
    isSaudi: isSaudi,
    isRealNamedEmployee: isRealNamedEmployee,
    isCountableLaborPosition: isCountableLaborPosition,
    isVacant: isVacant
  };
  console.info('[Hospital Raise Letters Status Pages Fix] installed v4 count-all attendance duplicate vacancies');
})();
