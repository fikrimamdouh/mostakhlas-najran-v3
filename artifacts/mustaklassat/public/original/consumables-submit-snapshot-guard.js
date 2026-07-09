/* consumables-submit-snapshot-guard.js
 * يثبت Snapshot المستهلكات ويجبر بيانات توجيه الرفع على مستهلكات قبل /api/submitted-extracts.
 * V4:
 * - زر الرئيسية في المستهلكات العادية يحفظ لقطة محلية مباشرة كمسار أمان.
 * - يستمر pre-save قبل أي خروج للرئيسية.
 * - لا يلمس التوقيعات؛ extract-snapshot V5 يحفظ signatures_data_consumables_v27 و sb_sigs_ كما هي.
 */
(function () {
  'use strict';
  var pageSig = location.pathname + location.search;
  if (!/\/original\/.*consumables\.html(?:$|[?#])/.test(pageSig)) return;
  if (window.__NAJRAN_CONSUMABLES_SUBMIT_SNAPSHOT_GUARD_V4__) return;
  window.__NAJRAN_CONSUMABLES_SUBMIT_SNAPSHOT_GUARD_V4__ = true;

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

    if (countMainRows(rows) >= countMainRows(stored)) {
      saveRows(rows);
    } else {
      console.warn('[ConsumablesSnapshotGuard] BLOCKED destructive overwrite — DOM mains:', countMainRows(rows), '< stored mains:', countMainRows(stored));
      rows = ensureHousingDeductionRow(stored);
    }
    return rows;
  }

  function isHomeTarget(el) {
    if (!el) return false;
    var target = el.closest && el.closest('a,button,[role="button"]');
    if (!target) return false;
    var href = target.getAttribute('href') || '';
    var txt = (target.textContent || '').replace(/\s+/g, ' ').trim();
    return href === '/dashboard' || href.indexOf('/dashboard') === 0 || txt.indexOf('الرئيسية') > -1;
  }

  function ensureBeforeHomeNavigation(ev) {
    try {
      if (!isHomeTarget(ev && ev.target)) return;
      ensureSummarySnapshot();
      try { localStorage.setItem('najran_consumables_home_presave_at', new Date().toISOString()); } catch (_) {}
    } catch (e) {
      console.warn('[ConsumablesSnapshotGuard] pre-home snapshot failed', e);
    }
  }

  function saveLocalAndGoHome(ev) {
    if (!IS_STANDARD_CONSUMABLES) return;
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    }
    ensureSummarySnapshot();
    if (typeof window.saveExtractSnapshot !== 'function') {
      alert('تعذر الحفظ المحلي الآن: أداة اللقطات لم تكتمل بعد. أعد تحميل الصفحة وحاول مرة أخرى.');
      return false;
    }
    var snap = window.saveExtractSnapshot('consumables-home-direct-save');
    if (!snap || !snap.extractData) {
      alert('تعذر حفظ نسخة محلية من مستخلص المستهلكات. لم يتم الخروج من الصفحة.');
      return false;
    }
    alert('تم حفظ نسخة محلية من مستخلص المستهلكات.');
    window.location.href = '/dashboard';
    return false;
  }

  function installHomeButton() {
    if (!IS_STANDARD_CONSUMABLES) return;
    if (document.getElementById('najran-consumables-home-btn')) return;
    var bar = document.querySelector('.main-action-buttons') || document.querySelector('.nav-bar') || document.querySelector('.container');
    if (!bar) return;
    var a = document.createElement('a');
    a.id = 'najran-consumables-home-btn';
    a.className = 'btn btn-home no-print';
    a.href = '/dashboard';
    a.innerHTML = '<i class="fas fa-home"></i><span>الرئيسية</span>';
    a.style.cssText = 'background:linear-gradient(135deg,#1e3c72,#2a5298)!important;color:#fff!important;text-decoration:none!important;';
    a.addEventListener('pointerdown', function () { ensureSummarySnapshot(); }, true);
    a.addEventListener('click', saveLocalAndGoHome, true);
    if (bar.classList && bar.classList.contains('main-action-buttons')) bar.insertBefore(a, bar.firstChild);
    else bar.appendChild(a);
    console.info('[ConsumablesSnapshotGuard] home button installed v4 direct local save');
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
  document.addEventListener('pointerdown', ensureBeforeHomeNavigation, true);
  document.addEventListener('click', ensureBeforeHomeNavigation, true);
  document.addEventListener('DOMContentLoaded', function () { ensureSummarySnapshot(); installHomeButton(); });
  setTimeout(installHomeButton, 300);
  setTimeout(installHomeButton, 1200);
  setTimeout(installHomeButton, 2500);

  if (!window.__najranConsumablesFetchGuardV4) {
    window.__najranConsumablesFetchGuardV4 = true;
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
  window.najranInstallConsumablesHomeButton = installHomeButton;
  window.najranConsumablesSaveLocalAndGoHome = saveLocalAndGoHome;
  console.info('[ConsumablesSnapshotGuard] installed v4 direct home local-save + summary pre-snapshot');
})();
