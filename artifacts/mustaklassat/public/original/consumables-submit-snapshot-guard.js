/* consumables-submit-snapshot-guard.js
 * يحفظ مفتاح ملخص مستخلص المستهلكات قبل الرفع فقط.
 * لا يعيد حساب الجداول ولا يغير القيم الظاهرة.
 */
(function () {
  'use strict';
  if (!/\/original\/.*consumables\.html(?:$|[?#])/.test(location.pathname + location.search)) return;

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

  function findSummaryTable() {
    var t = document.getElementById('summary-table');
    if (t) return t;
    var tables = Array.prototype.slice.call(document.querySelectorAll('table'));
    return tables.find(function (table) {
      var h = table.textContent || '';
      return h.indexOf('القيمة الشهرية') > -1 && h.indexOf('القيمة بالمستخلص') > -1 && h.indexOf('الصافي') > -1;
    }) || null;
  }

  function rowsFromSummaryTable() {
    var table = findSummaryTable();
    if (!table) return [];
    var rows = [];
    Array.prototype.slice.call(table.querySelectorAll('tbody tr')).forEach(function (tr, i) {
      var cells = Array.prototype.slice.call(tr.children || []);
      if (!cells.length) return;
      var name = text(cells[0]);
      if (!name) return;
      var isTafqeet = /فقط وقدره/.test(name) || /فقط وقدره/.test(text(tr));
      if (isTafqeet) return;
      var isTotal = /اجمالي|إجمالي|تكاليف|الصافي|غرامة الكهرباء/.test(name);
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
        id: 'item_' + (rows.filter(function (r) { return !r.isSubTotal && !r.isCustom; }).length + 1),
        name: name,
        value: parseNumber(text(cells[1])),
        isEditable: true,
        isCustom: false
      });
    });
    return rows;
  }

  function rowsFromFoundation() {
    try {
      var cd = JSON.parse(localStorage.getItem('persistentContractData') || '{}');
      var hn = (cd.hospitalName || localStorage.getItem('hospitalName') || '').trim();
      var db = window.ContractFoundationDB && window.ContractFoundationDB.load && hn ? window.ContractFoundationDB.load(hn) : null;
      var cons = db && Array.isArray(db.consumables) ? db.consumables : [];
      if (!cons.length) return [];
      var rows = cons.map(function (c, i) {
        return {
          id: c.id || ('item_f_' + (i + 1)),
          name: c.name || c.item || c.description || ('بند مستهلكات ' + (i + 1)),
          value: parseNumber(c.monthlyCost || c.value || c.amount || 0),
          isEditable: true,
          isCustom: false
        };
      });
      rows.push({ id: 'sm_total_1', name: 'اجمالى تكاليف بند المستهلكات', value: 0, isSubTotal: true, type: 'consumablesTotal' });
      rows.push({ id: 'sm_total_2', name: 'تكاليف مقاولي الباطن', value: 0, isSubTotal: true, type: 'subcontractorsTotal' });
      rows.push({ id: 'sm_total_3', name: 'تكاليف تامين بند المياه', value: 0, isSubTotal: true, type: 'waterTotal' });
      rows.push({ id: 'sm_total_4', name: 'تكاليف التخلص من مياه الصرف الصحي', value: 0, isSubTotal: true, type: 'sewageTotal' });
      rows.push({ id: 'sm_total_5', name: 'غرامة الكهرباء + الماء للسكن', value: 0, isEditable: true, isCustom: true });
      return rows;
    } catch (_) {
      return [];
    }
  }

  function defaultRows() {
    return [
      { id: 'item_1', name: 'الوقود والزيوت والمحروقات (ماعدا وقود السيارات)', value: 4000, isEditable: true, isCustom: false },
      { id: 'item_2', name: 'المستهلكات الكيميائية والفلاتر', value: 4000, isEditable: true, isCustom: false },
      { id: 'item_3', name: 'مستهلكات الأعمال المدنية', value: 5500, isEditable: true, isCustom: false },
      { id: 'item_4', name: 'مواد ومطهرات النظافة', value: 15500, isEditable: true, isCustom: false },
      { id: 'item_5', name: 'مستهلكات الزراعة والري', value: 2100, isEditable: true, isCustom: false },
      { id: 'item_6', name: 'مستهلكات مكافحة الحشرات', value: 1000, isEditable: true, isCustom: false },
      { id: 'sm_total_1', name: 'اجمالى تكاليف بند المستهلكات', value: 0, isSubTotal: true, type: 'consumablesTotal' },
      { id: 'sm_total_2', name: 'تكاليف مقاولي الباطن', value: 0, isSubTotal: true, type: 'subcontractorsTotal' },
      { id: 'sm_total_3', name: 'تكاليف تامين بند المياه', value: 0, isSubTotal: true, type: 'waterTotal' },
      { id: 'sm_total_4', name: 'تكاليف التخلص من مياه الصرف الصحي', value: 0, isSubTotal: true, type: 'sewageTotal' },
      { id: 'sm_total_5', name: 'غرامة الكهرباء + الماء للسكن', value: 0, isEditable: true, isCustom: true }
    ];
  }

  function ensureSummarySnapshot() {
    var old = existingRows();
    if (old.length > 0) return;
    var rows = rowsFromSummaryTable();
    if (!rows.length) rows = rowsFromFoundation();
    if (!rows.length) rows = defaultRows();
    localStorage.setItem(KEY, JSON.stringify(rows));
  }

  document.addEventListener('pointerdown', function (ev) {
    var btn = ev.target && ev.target.closest && ev.target.closest('#_najran_approve_btn_inner, #_najran_approve_btn');
    if (btn) ensureSummarySnapshot();
  }, true);

  document.addEventListener('click', function (ev) {
    var btn = ev.target && ev.target.closest && ev.target.closest('#_najran_approve_btn_inner, #_najran_approve_btn');
    if (btn) ensureSummarySnapshot();
  }, true);

  if (!window.__najranConsumablesFetchGuard) {
    window.__najranConsumablesFetchGuard = true;
    var nativeFetch = window.fetch;
    window.fetch = function () {
      try {
        var url = String(arguments[0] && arguments[0].url ? arguments[0].url : arguments[0] || '');
        var opts = arguments[1] || {};
        var method = String(opts.method || 'GET').toUpperCase();
        if (url.indexOf('/api/submitted-extracts') > -1 && (method === 'POST' || method === 'PUT')) ensureSummarySnapshot();
      } catch (_) {}
      return nativeFetch.apply(this, arguments);
    };
  }

  window.najranEnsureConsumablesSummarySnapshot = ensureSummarySnapshot;
})();