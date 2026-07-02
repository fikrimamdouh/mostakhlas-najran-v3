// Hospital Raise Letters Index Guard V1
// Scope: hospital_raise_letters.html only.
// Ensures "فهرس مستندات المستخلص" always prints with its table even if old saved settings hid the table.
(function () {
  'use strict';

  if (!/hospital_raise_letters\.html/.test(location.pathname) && !window.__HOSPITAL_LETTERS_STANDALONE_PAGE__) return;
  if (window.__HOSPITAL_RAISE_LETTERS_INDEX_GUARD_V1__) return;
  window.__HOSPITAL_RAISE_LETTERS_INDEX_GUARD_V1__ = true;

  var SETTINGS_KEY = 'hospitalRaiseLettersSettings_v8';
  var ORDER = ['final', 'labor', 'noPrev', 'salary', 'vacancies', 'vacations', 'saudi', 'custom'];
  var LABEL = {
    final: 'خطاب الرفع النهائي',
    labor: 'خطاب العمالة',
    noPrev: 'عدم أسبقية الصرف',
    salary: 'شهادة تسليم الرواتب',
    vacancies: 'بيان الشواغر',
    vacations: 'بيان الإجازات',
    saudi: 'بيان السعودة',
    custom: 'خطاب مخصص'
  };

  function readJson(k, fallback) {
    try { var raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }
  function writeJson(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v || {})); return true; } catch (_) { return false; }
  }
  function clean(v) { return String(v == null ? '' : v).replace(/[\u200e\u200f]/g, '').replace(/\s+/g, ' ').trim(); }
  function ar(v) { return String(v).replace(/\d/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'[d]; }); }
  function num(v) { var n = Number(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : 0; }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c];
    });
  }

  function ensureSettings() {
    var s = readJson(SETTINGS_KEY, {});
    var changed = false;
    s.layout = s.layout || {};
    s.layout.index = s.layout.index || {};
    if (s.layout.index.showTable === 'no' || s.layout.index.showTable === false) {
      s.layout.index.showTable = 'yes';
      changed = true;
    }
    s.texts = s.texts || {};
    s.texts.index = s.texts.index || {};
    if (!clean(s.texts.index.title)) {
      s.texts.index.title = 'فهرس مستندات المستخلص';
      changed = true;
    }
    if (!s.pageCount) { s.pageCount = {}; changed = true; }
    ORDER.forEach(function (k) {
      if (!num(s.pageCount[k])) { s.pageCount[k] = 1; changed = true; }
    });
    if (!num(s.indexStart)) { s.indexStart = 1; changed = true; }
    if (changed) writeJson(SETTINGS_KEY, s);
    return s;
  }

  function indexRowsHtml() {
    var s = ensureSettings();
    var p = num(s.indexStart) || 1;
    return ORDER.map(function (k, i) {
      var cnt = Math.max(1, num(s.pageCount && s.pageCount[k]) || 1);
      var row = '<tr><td>' + ar(i + 1) + '</td><td>' + esc(LABEL[k] || k) + '</td><td>' + ar(p) + '</td><td>' + ar(cnt) + '</td></tr>';
      p += cnt;
      return row;
    }).join('');
  }

  function indexTableHtml() {
    return '<table class="tbl index-table" style="width:158mm;font-size:11.5pt"><thead><tr><th>م</th><th>اسم المستند</th><th>صفحة البداية</th><th>عدد الصفحات</th></tr></thead><tbody>' + indexRowsHtml() + '</tbody></table>';
  }

  function isIndexPage(page) {
    return /فهرس\s+مستندات\s+المستخلص/.test(clean(page && page.textContent));
  }

  function fixIndexInDoc(doc) {
    var pages = Array.prototype.filter.call(doc.querySelectorAll('section.page'), isIndexPage);
    if (!pages.length) return false;
    var changed = false;

    pages.forEach(function (page) {
      var table = page.querySelector('table.tbl');
      var rows = table ? table.querySelectorAll('tbody tr') : [];
      var emptyOnly = rows.length === 0 || (rows.length === 1 && /لا\s+توجد\s+بيانات/.test(clean(rows[0].textContent)));
      var content = page.querySelector('.content') || page;

      if (!table) {
        var anchor = page.querySelector('.body') || page.querySelector('.title') || page.querySelector('.subject-wrap');
        var holder = doc.createElement('div');
        holder.innerHTML = indexTableHtml();
        var newTable = holder.firstChild;
        if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(newTable, anchor.nextSibling);
        else content.appendChild(newTable);
        changed = true;
        return;
      }

      if (emptyOnly) {
        var tbody = table.querySelector('tbody');
        if (tbody) tbody.innerHTML = indexRowsHtml();
        changed = true;
      }

      table.style.display = '';
      table.style.visibility = 'visible';
      table.classList.add('index-table');
    });

    return changed;
  }

  function transform(html) {
    html = String(html || '');
    if (!/فهرس\s+مستندات\s+المستخلص/.test(html)) return html;
    var doc;
    try { doc = new DOMParser().parseFromString(html, 'text/html'); } catch (_) { return html; }
    if (!doc || !doc.documentElement) return html;
    fixIndexInDoc(doc);
    if (!doc.getElementById('hospital-raise-index-guard-v1')) {
      doc.head.insertAdjacentHTML('beforeend', '<style id="hospital-raise-index-guard-v1">body.hrl-polished .index-table{width:100%!important;margin:5mm auto!important;font-size:11px!important}body.hrl-polished .index-table th{background:#003087!important;color:#fff!important;font-weight:900!important}body.hrl-polished .index-table td,body.hrl-polished .index-table th{border:1px solid #64748b!important;padding:4.5px!important;text-align:center!important;line-height:1.35!important}</style>');
    }
    return '<!doctype html>\n' + doc.documentElement.outerHTML;
  }

  function wrapWindowOpen() {
    if (window.__HOSPITAL_RAISE_INDEX_GUARD_OPEN_WRAPPED__) return;
    window.__HOSPITAL_RAISE_INDEX_GUARD_OPEN_WRAPPED__ = true;
    var oldOpen = window.open;
    window.open = function () {
      ensureSettings();
      var win = oldOpen.apply(window, arguments);
      try {
        if (win && win.document && !win.__hospitalRaiseIndexGuardWriteWrapped) {
          win.__hospitalRaiseIndexGuardWriteWrapped = true;
          var oldWrite = win.document.write.bind(win.document);
          win.document.write = function (html) { return oldWrite(transform(html)); };
        }
      } catch (_) {}
      return win;
    };
  }

  ensureSettings();
  wrapWindowOpen();
  window.HospitalRaiseLettersIndexGuard = { fixSettings: ensureSettings, transform: transform };
  console.info('[Hospital Raise Letters Index Guard] installed v1 table required');
})();
