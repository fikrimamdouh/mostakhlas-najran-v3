/* consumables-submit-snapshot-guard.js
 * يضمن دخول مفتاح ملخص مستخلص المستهلكات داخل Snapshot المرسل للاعتماد.
 * يحفظ الملخص الشهري بنفس أعمدة الشهادة الفعلية قدر الإمكان.
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

      var rowText = text(tr);
      if (/فقط وقدره/.test(rowText)) return;

      var name = text(cells[0]);
      if (!name) return;

      var isTotal = /اجمالي|إجمالي|تكاليف|الصافي|غرامة الكهرباء/.test(name);
      var lastValue = parseNumber(text(cells[cells.length - 1]));

      if (isTotal || cells.length < 6) {
        rows.push({
          id: /غرامة الكهرباء/.test(name) ? 'sm_total_5' : ('summary_total_' + i),
          name: name,
          value: lastValue,
          monthlyValue: cells.length >= 2 ? parseNumber(text(cells[1])) : 0,
          extractValue: cells.length >= 3 ? parseNumber(text(cells[2])) : 0,
          deduction: cells.length >= 4 ? parseNumber(text(cells[3])) : 0,
          penalty: cells.length >= 5 ? parseNumber(text(cells[4])) : 0,
          netValue: lastValue,
          isSubTotal: !/غرامة الكهرباء/.test(name),
          isCustom: /غرامة الكهرباء/.test(name),
          isSummaryTotalRow: true,
          source: 'summary-table-exact'
        });
        return;
      }

      rows.push({
        id: 'item_' + (rows.filter(function (r) { return !r.isSubTotal && !r.isCustom && !r.isSummaryTotalRow; }).length + 1),
        name: name,
        value: parseNumber(text(cells[1])),
        monthlyValue: parseNumber(text(cells[1])),
        extractValue: parseNumber(text(cells[2])),
        deduction: parseNumber(text(cells[3])),
        penalty: parseNumber(text(cells[4])),
        netValue: parseNumber(text(cells[5])),
        isEditable: true,
        isCustom: false,
        source: 'summary-table-exact'
      });
    });

    Array.prototype.slice.call(table.querySelectorAll('tfoot tr')).forEach(function (tr, i) {
      var cells = Array.prototype.slice.call(tr.children || []);
      if (!cells.length) return;
      var rowText = text(tr);
      if (/فقط وقدره/.test(rowText)) {
        rows.push({ id: 'summary_tafqeet', name: rowText, value: 0, isTafqeet: true, source: 'summary-table-exact' });
        return;
      }
      var name = text(cells[0]);
      var val = parseNumber(text(cells[cells.length - 1]));
      if (name) {
        rows.push({
          id: 'summary_final_total_' + i,
          name: name,
          value: val,
          netValue: val,
          isFinalTotal: true,
          source: 'summary-table-exact'
        });
      }
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
          monthlyValue: parseNumber(c.monthlyCost || c.value || c.amount || 0),
          extractValue: 0,
          deduction: 0,
          penalty: 0,
          netValue: 0,
          isEditable: true,
          isCustom: false
        };
      });
      rows.push({ id: 'sm_total_1', name: 'اجمالى تكاليف بند المستهلكات', value: 0, netValue: 0, isSubTotal: true, type: 'consumablesTotal' });
      rows.push({ id: 'sm_total_2', name: 'تكاليف مقاولي الباطن', value: 0, netValue: 0, isSubTotal: true, type: 'subcontractorsTotal' });
      rows.push({ id: 'sm_total_3', name: 'تكاليف تامين بند المياه', value: 0, netValue: 0, isSubTotal: true, type: 'waterTotal' });
      rows.push({ id: 'sm_total_4', name: 'تكاليف التخلص من مياه الصرف الصحي', value: 0, netValue: 0, isSubTotal: true, type: 'sewageTotal' });
      rows.push({ id: 'sm_total_5', name: 'غرامة الكهرباء + الماء للسكن', value: 0, netValue: 0, isEditable: true, isCustom: true });
      return rows;
    } catch (_) {
      return [];
    }
  }

  function defaultRows() {
    return [
      { id: 'item_1', name: 'الوقود والزيوت والمحروقات (ماعدا وقود السيارات)', value: 4000, monthlyValue: 4000, extractValue: 0, deduction: 0, penalty: 0, netValue: 0, isEditable: true, isCustom: false },
      { id: 'item_2', name: 'المستهلكات الكيميائية والفلاتر', value: 4000, monthlyValue: 4000, extractValue: 0, deduction: 0, penalty: 0, netValue: 0, isEditable: true, isCustom: false },
      { id: 'item_3', name: 'مستهلكات الأعمال المدنية', value: 5500, monthlyValue: 5500, extractValue: 0, deduction: 0, penalty: 0, netValue: 0, isEditable: true, isCustom: false },
      { id: 'item_4', name: 'مواد ومطهرات النظافة', value: 15500, monthlyValue: 15500, extractValue: 0, deduction: 0, penalty: 0, netValue: 0, isEditable: true, isCustom: false },
      { id: 'item_5', name: 'مستهلكات الزراعة والري', value: 2100, monthlyValue: 2100, extractValue: 0, deduction: 0, penalty: 0, netValue: 0, isEditable: true, isCustom: false },
      { id: 'item_6', name: 'مستهلكات مكافحة الحشرات', value: 1000, monthlyValue: 1000, extractValue: 0, deduction: 0, penalty: 0, netValue: 0, isEditable: true, isCustom: false },
      { id: 'sm_total_1', name: 'اجمالى تكاليف بند المستهلكات', value: 0, netValue: 0, isSubTotal: true, type: 'consumablesTotal' },
      { id: 'sm_total_2', name: 'تكاليف مقاولي الباطن', value: 0, netValue: 0, isSubTotal: true, type: 'subcontractorsTotal' },
      { id: 'sm_total_3', name: 'تكاليف تامين بند المياه', value: 0, netValue: 0, isSubTotal: true, type: 'waterTotal' },
      { id: 'sm_total_4', name: 'تكاليف التخلص من مياه الصرف الصحي', value: 0, netValue: 0, isSubTotal: true, type: 'sewageTotal' },
      { id: 'sm_total_5', name: 'غرامة الكهرباء + الماء للسكن', value: 0, netValue: 0, isEditable: true, isCustom: true }
    ];
  }

  function buildSummaryRows() {
    var rows = rowsFromSummaryTable();
    if (rows.length) return rows;
    var old = existingRows();
    if (old.length > 0) return old;
    rows = rowsFromFoundation();
    if (!rows.length) rows = defaultRows();
    return rows;
  }

  function ensureSummarySnapshot() {
    var rows = buildSummaryRows();
    if (rows.length > 0) localStorage.setItem(KEY, JSON.stringify(rows));
    return rows;
  }

  function injectIntoPayloadBody(body) {
    try {
      if (!body || typeof body !== 'string') return body;
      var payload = JSON.parse(body);
      var rows = ensureSummarySnapshot();
      payload.extractData = payload.extractData && typeof payload.extractData === 'object' ? payload.extractData : {};
      payload.extractData[KEY] = rows;
      return JSON.stringify(payload);
    } catch (_) {
      return body;
    }
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
        if (url.indexOf('/api/submitted-extracts') > -1 && (method === 'POST' || method === 'PUT')) {
          ensureSummarySnapshot();
          if (opts && typeof opts.body === 'string') opts.body = injectIntoPayloadBody(opts.body);
        }
      } catch (_) {}
      return nativeFetch.apply(this, arguments);
    };
  }

  window.najranEnsureConsumablesSummarySnapshot = ensureSummarySnapshot;
})();