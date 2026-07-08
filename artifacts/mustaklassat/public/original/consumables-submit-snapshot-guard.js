/* consumables-submit-snapshot-guard.js
 * يثبت Snapshot المستهلكات ويجبر بيانات توجيه الرفع على مستهلكات قبل /api/submitted-extracts.
 */
(function () {
  'use strict';
  var pageSig = location.pathname + location.search;
  if (!/\/original\/.*consumables\.html(?:$|[?#])/.test(pageSig)) return;
  if (window.__NAJRAN_CONSUMABLES_SUBMIT_SNAPSHOT_GUARD_V2__) return;
  window.__NAJRAN_CONSUMABLES_SUBMIT_SNAPSHOT_GUARD_V2__ = true;

  var KEY = 'summary_data_consumables_v27';
  var IS_STANDARD_CONSUMABLES = /\/original\/consumables\.html(?:$|[?#])/.test(pageSig) || /[?&]page=consumables\.html(?:$|[&#])/.test(pageSig);
  var HOUSING_ROW = { id: 'sm_total_5', name: 'غرامة الكهرباء + الماء للسكن', value: 0, netValue: 0, isEditable: true, isCustom: true };

  function parseNumber(v) {
    var n = Number(String(v == null ? '' : v).replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).replace(/,/g, '').replace(/[^0-9.\-]/g, ''));
    return isFinite(n) ? n : 0;
  }
  function text(el) {
    if (!el) return '';
    var input = el.querySelector && el.querySelector('input,select,textarea');
    return ((input ? input.value : el.textContent) || '').replace(/\s+/g, ' ').trim();
  }
  function existingRows() { try { var v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (_) { return []; } }
  function hasHousingDeductionRow(rows) { return Array.isArray(rows) && rows.some(function (r) { return r && (r.id === 'sm_total_5' || /غرامة\s*(الكهرباء|الماء|السكن)/.test(String(r.name || ''))); }); }
  function ensureHousingDeductionRow(rows) { rows = Array.isArray(rows) ? rows : []; if (!hasHousingDeductionRow(rows)) rows.push(Object.assign({}, HOUSING_ROW)); return rows; }
  function saveRows(rows) { if (Array.isArray(rows) && rows.length > 0) localStorage.setItem(KEY, JSON.stringify(rows)); }

  function findSummaryTable() {
    var t = document.getElementById('summary-table');
    if (t) return t;
    return Array.prototype.slice.call(document.querySelectorAll('table')).find(function (table) {
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
        rows.push({ id: /غرامة الكهرباء/.test(name) ? 'sm_total_5' : ('summary_total_' + i), name: name, value: lastValue, monthlyValue: cells.length >= 2 ? parseNumber(text(cells[1])) : 0, extractValue: cells.length >= 3 ? parseNumber(text(cells[2])) : 0, deduction: cells.length >= 4 ? parseNumber(text(cells[3])) : 0, penalty: cells.length >= 5 ? parseNumber(text(cells[4])) : 0, netValue: lastValue, isSubTotal: !/غرامة الكهرباء/.test(name), isCustom: /غرامة الكهرباء/.test(name), isSummaryTotalRow: true, source: 'summary-table-exact' });
        return;
      }
      rows.push({ id: 'item_' + (rows.filter(function (r) { return !r.isSubTotal && !r.isCustom && !r.isSummaryTotalRow; }).length + 1), name: name, value: parseNumber(text(cells[1])), monthlyValue: parseNumber(text(cells[1])), extractValue: parseNumber(text(cells[2])), deduction: parseNumber(text(cells[3])), penalty: parseNumber(text(cells[4])), netValue: parseNumber(text(cells[5])), isEditable: true, isCustom: false, source: 'summary-table-exact' });
    });
    Array.prototype.slice.call(table.querySelectorAll('tfoot tr')).forEach(function (tr, i) {
      var cells = Array.prototype.slice.call(tr.children || []);
      if (!cells.length) return;
      var rowText = text(tr);
      if (/فقط وقدره/.test(rowText)) { rows.push({ id: 'summary_tafqeet', name: rowText, value: 0, isTafqeet: true, source: 'summary-table-exact' }); return; }
      var name = text(cells[0]);
      var val = parseNumber(text(cells[cells.length - 1]));
      if (name) rows.push({ id: 'summary_final_total_' + i, name: name, value: val, netValue: val, isFinalTotal: true, source: 'summary-table-exact' });
    });
    return ensureHousingDeductionRow(rows);
  }

  function defaultRows() {
    return ensureHousingDeductionRow([
      { id: 'item_1', name: 'الوقود والزيوت والمحروقات (ماعدا وقود السيارات)', value: 4000, monthlyValue: 4000, extractValue: 0, deduction: 0, penalty: 0, netValue: 0, isEditable: true, isCustom: false },
      { id: 'item_2', name: 'المستهلكات الكيميائية والفلاتر', value: 4000, monthlyValue: 4000, extractValue: 0, deduction: 0, penalty: 0, netValue: 0, isEditable: true, isCustom: false },
      { id: 'item_3', name: 'مستهلكات الأعمال المدنية', value: 5500, monthlyValue: 5500, extractValue: 0, deduction: 0, penalty: 0, netValue: 0, isEditable: true, isCustom: false },
      { id: 'item_4', name: 'مواد ومطهرات النظافة', value: 15500, monthlyValue: 15500, extractValue: 0, deduction: 0, penalty: 0, netValue: 0, isEditable: true, isCustom: false },
      { id: 'item_5', name: 'مستهلكات الزراعة والري', value: 2100, monthlyValue: 2100, extractValue: 0, deduction: 0, penalty: 0, netValue: 0, isEditable: true, isCustom: false },
      { id: 'item_6', name: 'مستهلكات مكافحة الحشرات', value: 1000, monthlyValue: 1000, extractValue: 0, deduction: 0, penalty: 0, netValue: 0, isEditable: true, isCustom: false },
      { id: 'sm_total_1', name: 'اجمالى تكاليف بند المستهلكات', value: 0, netValue: 0, isSubTotal: true, type: 'consumablesTotal' },
      { id: 'sm_total_2', name: 'تكاليف مقاولي الباطن', value: 0, netValue: 0, isSubTotal: true, type: 'subcontractorsTotal' },
      { id: 'sm_total_3', name: 'تكاليف تامين بند المياه', value: 0, netValue: 0, isSubTotal: true, type: 'waterTotal' },
      { id: 'sm_total_4', name: 'تكاليف التخلص من مياه الصرف الصحي', value: 0, netValue: 0, isSubTotal: true, type: 'sewageTotal' }
    ]);
  }

  function countMainRows(rows) {
    return (Array.isArray(rows) ? rows : []).filter(function (r) {
      return r && !r.isSubTotal && !r.isCustom && !r.isSummaryTotalRow && !r.isFinalTotal && !r.isTafqeet && String(r.name || '').trim();
    }).length;
  }

  function ensureSummarySnapshot() {
    var domRows = rowsFromSummaryTable();
    var stored = existingRows();
    var rows = domRows.length ? domRows : stored;
    if (!rows.length) rows = defaultRows();
    rows = ensureHousingDeductionRow(rows);

    // حماية جوهرية: ممنوع كتابة نسخة بنودها الرئيسية أقل من المخزَّنة —
    // كشط DOM ناقص (رسمة قديمة) كان يدمّر بنود المستخدم وقيمه ويصدّر التلف للسيرفر.
    if (countMainRows(rows) >= countMainRows(stored)) {
      saveRows(rows);
    } else {
      console.warn('[ConsumablesSnapshotGuard] BLOCKED destructive overwrite — DOM mains:',
        countMainRows(rows), '< stored mains:', countMainRows(stored));
      rows = ensureHousingDeductionRow(stored);
    }
    return rows;
  }

  function injectIntoPayloadBody(body) {
    try {
      if (!body || typeof body !== 'string') return body;
      var payload = JSON.parse(body);
      var rows = ensureSummarySnapshot();
      payload.extractData = payload.extractData && typeof payload.extractData === 'object' ? payload.extractData : {};
      payload.extractData[KEY] = rows;
      if (String(payload.extractType || '') === 'consumables') {
        payload.sourceModule = 'consumables';
        var total = parseNumber(localStorage.getItem('finalConsumablesCost'));
        if (total > 0) payload.totalAmount = total;
        payload.extractData.sourceModule = 'consumables';
        payload.extractData.reviewPage = '/original/consumables.html';
      }
      return JSON.stringify(payload);
    } catch (_) { return body; }
  }

  document.addEventListener('pointerdown', function (ev) { var btn = ev.target && ev.target.closest && ev.target.closest('#_najran_approve_btn_inner, #_najran_approve_btn'); if (btn) ensureSummarySnapshot(); }, true);
  document.addEventListener('click', function (ev) { var btn = ev.target && ev.target.closest && ev.target.closest('#_najran_approve_btn_inner, #_najran_approve_btn'); if (btn) ensureSummarySnapshot(); }, true);
  document.addEventListener('DOMContentLoaded', function () { ensureSummarySnapshot(); });

  if (!window.__najranConsumablesFetchGuardV2) {
    window.__najranConsumablesFetchGuardV2 = true;
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