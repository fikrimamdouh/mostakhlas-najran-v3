/* consumables-submit-snapshot-guard.js
 * يحفظ مفاتيح مستخلص المستهلكات الحالية قبل الرفع فقط.
 * لا يعيد حساب الجداول ولا يغير القيم الظاهرة.
 */
(function () {
  'use strict';
  if (!/\/original\/consumables\.html(?:$|[?#])/.test(location.pathname + location.search)) return;

  var KEY = 'summary_data_consumables_v27';

  function parseNumber(v) {
    var n = Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, ''));
    return isFinite(n) ? n : 0;
  }

  function text(el) {
    if (!el) return '';
    var input = el.querySelector && el.querySelector('input,select,textarea');
    return ((input ? input.value : el.textContent) || '').replace(/\s+/g, ' ').trim();
  }

  function existingRows() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(v) ? v : [];
    } catch (_) {
      return [];
    }
  }

  function rowsFromSummaryTable() {
    var table = document.getElementById('summary-table');
    if (!table) return [];
    var rows = [];
    Array.prototype.slice.call(table.querySelectorAll('tbody tr')).forEach(function (tr, i) {
      var cells = Array.prototype.slice.call(tr.children || []);
      if (!cells.length) return;
      var name = text(cells[0]);
      if (!name) return;
      var isTotal = /اجمالي|إجمالي|تكاليف|الصافي|فقط وقدره|غرامة الكهرباء/.test(name);
      if (isTotal) {
        rows.push({
          id: /غرامة الكهرباء/.test(name) ? 'sm_total_5' : ('summary_total_' + i),
          name: name,
          value: parseNumber(text(cells[cells.length - 1])),
          isSubTotal: !/غرامة الكهرباء/.test(name),
          isCustom: /غرامة الكهرباء/.test(name)
        });
        return;
      }
      rows.push({
        id: 'item_' + (rows.length + 1),
        name: name,
        value: parseNumber(text(cells[1])),
        isEditable: true,
        isCustom: false
      });
    });
    return rows;
  }

  function ensureSummarySnapshot() {
    var old = existingRows();
    if (old.length > 0) return;
    var rows = rowsFromSummaryTable();
    if (rows.length > 0) {
      localStorage.setItem(KEY, JSON.stringify(rows));
    }
  }

  document.addEventListener('click', function (ev) {
    var btn = ev.target && ev.target.closest && ev.target.closest('#_najran_approve_btn_inner');
    if (!btn) return;
    ensureSummarySnapshot();
  }, true);

  window.najranEnsureConsumablesSummarySnapshot = ensureSummarySnapshot;
})();