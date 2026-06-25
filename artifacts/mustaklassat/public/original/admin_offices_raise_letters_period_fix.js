// ===================================================================
// Admin Offices Raise Letters Period Fix
// Scope: admin_offices_attendance.html / admin_offices_consumables.html
// Ensures raise letters always read extract period from/to correctly.
// Payment number is displayed as 1, 2, 3 without leading zeros.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_(attendance|consumables)\.html|original-viewer\?page=admin_offices_(attendance|consumables)\.html/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_RAISE_LETTERS_PERIOD_FIX__) return;
  window.__ADMIN_OFFICES_RAISE_LETTERS_PERIOD_FIX__ = true;

  function readJson(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value || {})); } catch (_) {}
  }

  function clean(v) {
    return String(v == null ? '' : v).replace(/[\u200e\u200f]/g, '').replace(/\s+/g, ' ').trim();
  }

  function firstValue() {
    for (var i = 0; i < arguments.length; i++) {
      var s = clean(arguments[i]);
      if (s && s !== 'غير محدد' && s !== 'undefined' && s !== 'null' && s !== '—' && s !== '-') return s;
    }
    return '';
  }

  function normalizeDigits(value) {
    var ar = '٠١٢٣٤٥٦٧٨٩';
    var fa = '۰۱۲۳۴۵۶۷۸۹';
    return clean(value).replace(/[٠-٩]/g, function (d) { return ar.indexOf(d); }).replace(/[۰-۹]/g, function (d) { return fa.indexOf(d); });
  }

  function normalizePaymentNo(value) {
    var v = normalizeDigits(value);
    if (!v || v === '—' || v === '-') return v || '—';
    if (/^0*\d+$/.test(v)) return String(Number(v));
    return v;
  }

  function toIsoDate(value) {
    var v = normalizeDigits(value);
    if (!v) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    var m = v.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (m) return m[1] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[3]).padStart(2, '0');
    m = v.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (m) return m[3] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0');
    var d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    return '';
  }

  function addDaysIso(startIso, days) {
    if (!startIso || !days) return '';
    var d = new Date(startIso + 'T00:00:00');
    if (Number.isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + Math.max(0, Number(days) - 1));
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function dateObjFromIso(iso) {
    var d = new Date(String(iso || '') + 'T00:00:00');
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function domText() {
    return {
      start: firstValue(
        document.getElementById('extract-start-date') && document.getElementById('extract-start-date').textContent,
        document.querySelector('[data-extract-start]') && document.querySelector('[data-extract-start]').textContent,
        document.querySelector('.extract-start') && document.querySelector('.extract-start').textContent
      ),
      end: firstValue(
        document.getElementById('extract-end-date') && document.getElementById('extract-end-date').textContent,
        document.querySelector('[data-extract-end]') && document.querySelector('[data-extract-end]').textContent,
        document.querySelector('.extract-end') && document.querySelector('.extract-end').textContent
      ),
      payment: firstValue(
        document.getElementById('payment-number') && document.getElementById('payment-number').textContent,
        document.querySelector('.paymentNumber') && document.querySelector('.paymentNumber').textContent,
        document.querySelector('[data-payment-no]') && document.querySelector('[data-payment-no]').textContent,
        document.querySelector('.extract-number') && document.querySelector('.extract-number').textContent
      )
    };
  }

  function nativePeriodFunctionData() {
    try {
      var fn = window.__ADMIN_OFFICES_NATIVE_GET_EXTRACT_PERIOD_DETAILS__ || window.getExtractPeriodDetails;
      if (typeof fn === 'function' && fn !== fixedExtractPeriodDetails) {
        var p = fn() || {};
        return {
          start: p.startDate || p.extractStart || p.periodStart || p.start || p.fromDate || '',
          end: p.endDate || p.extractEnd || p.periodEnd || p.end || p.toDate || '',
          days: p.daysInExtract || p.daysInMonth || p.duration || 0
        };
      }
    } catch (_) {}
    return { start: '', end: '', days: 0 };
  }

  function revisionData() {
    var snap = readJson('najran_revision_snapshot', {});
    var rev = {};
    try { rev = typeof snap.persistentExtractData === 'string' ? JSON.parse(snap.persistentExtractData) : (snap.persistentExtractData || snap.extractData || {}); } catch (_) { rev = {}; }
    return rev || {};
  }

  function resolveMeta() {
    var e = readJson('persistentExtractData', {});
    var s = readJson('adminOfficesRaiseLettersSettings_v1', {});
    var rev = revisionData();
    var dom = domText();
    var fn = nativePeriodFunctionData();

    var start = toIsoDate(firstValue(
      e.extractStart, e.periodStart, e.startDate, e.start, e.fromDate, e.dateFrom,
      rev.extractStart, rev.periodStart, rev.startDate, rev.start, rev.fromDate, rev.dateFrom,
      localStorage.getItem('extractStart'), localStorage.getItem('periodStart'), localStorage.getItem('startDate'),
      s.extractStart, s.period2Start, s.period1Start,
      fn.start,
      dom.start
    ));

    var end = toIsoDate(firstValue(
      e.extractEnd, e.periodEnd, e.endDate, e.end, e.toDate, e.dateTo,
      rev.extractEnd, rev.periodEnd, rev.endDate, rev.end, rev.toDate, rev.dateTo,
      localStorage.getItem('extractEnd'), localStorage.getItem('periodEnd'), localStorage.getItem('endDate'),
      s.extractEnd, s.period2End, s.period1End,
      fn.end,
      dom.end
    ));

    if (!end && start && fn.days) end = addDaysIso(start, fn.days);

    var paymentNo = firstValue(
      e.paymentNumber, e.extractNumber, e.paymentNo, e.extractNo, e.batchNumber, e.batchNo, e.installmentNumber, e.payment,
      rev.paymentNumber, rev.extractNumber, rev.paymentNo, rev.extractNo, rev.batchNumber, rev.batchNo, rev.installmentNumber, rev.payment,
      localStorage.getItem('paymentNumber'), localStorage.getItem('extractNumber'), localStorage.getItem('paymentNo'), localStorage.getItem('extractNo'), localStorage.getItem('batchNumber'),
      s.paymentNo, s.paymentNumber, s.extractNumber,
      dom.payment
    ) || '—';
    paymentNo = normalizePaymentNo(paymentNo);

    return { start: start, end: end, paymentNo: paymentNo };
  }

  function persistMeta(meta) {
    if (!meta) return meta;
    var paymentNo = normalizePaymentNo(meta.paymentNo);
    var e = Object.assign({}, readJson('persistentExtractData', {}));
    if (meta.start) e.extractStart = meta.start;
    if (meta.end) e.extractEnd = meta.end;
    if (paymentNo && paymentNo !== '—') e.paymentNumber = paymentNo;
    writeJson('persistentExtractData', e);

    try {
      if (meta.start) {
        localStorage.setItem('extractStart', meta.start);
        localStorage.setItem('periodStart', meta.start);
        localStorage.setItem('startDate', meta.start);
      }
      if (meta.end) {
        localStorage.setItem('extractEnd', meta.end);
        localStorage.setItem('periodEnd', meta.end);
        localStorage.setItem('endDate', meta.end);
      }
      if (paymentNo && paymentNo !== '—') {
        localStorage.setItem('paymentNumber', paymentNo);
        localStorage.setItem('extractNumber', paymentNo);
        localStorage.setItem('paymentNo', paymentNo);
      }
    } catch (_) {}
    return { start: meta.start, end: meta.end, paymentNo: paymentNo };
  }

  function refreshPaymentDisplays(meta) {
    try {
      var m = meta || resolveMeta();
      var paymentNo = normalizePaymentNo(m && m.paymentNo);
      if (!paymentNo) return;
      document.querySelectorAll('.paymentNumber,#payment-number,[data-payment-no],.extract-number').forEach(function (el) {
        if (el) el.textContent = paymentNo;
      });
      var overlay = document.getElementById('raise-letters-overlay');
      if (!overlay) return;
      overlay.querySelectorAll('[data-rl-setting="paymentNo"],[data-rl-setting="paymentNumber"],[data-rl-setting="extractNumber"]').forEach(function (el) {
        if (el) el.value = paymentNo;
      });
      var box = overlay.querySelector('.readonly-box');
      if (box && m.start && m.end) box.textContent = extractPhrase();
    } catch (_) {}
  }

  function fixNow() {
    var meta = persistMeta(resolveMeta());
    refreshPaymentDisplays(meta);
    return meta;
  }

  function fmtDate(v) {
    var iso = toIsoDate(v);
    if (!iso) return 'غير محدد';
    return iso;
  }

  function fixedExtractPeriodDetails() {
    var meta = fixNow();
    var startDate = dateObjFromIso(meta.start) || new Date();
    var endDate = dateObjFromIso(meta.end) || startDate;
    var daysInExtract = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000) + 1 || 1);
    var totalDaysInMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate() || 30;
    return {
      startDate: startDate,
      endDate: endDate,
      extractStart: meta.start,
      extractEnd: meta.end,
      periodStart: meta.start,
      periodEnd: meta.end,
      daysInExtract: daysInExtract,
      totalDaysInMonth: totalDaysInMonth,
      paymentNo: normalizePaymentNo(meta.paymentNo),
      paymentNumber: normalizePaymentNo(meta.paymentNo),
      source: 'admin-offices-raise-letters-period-fix'
    };
  }

  function extractPhrase() {
    var m = fixNow();
    return 'دفعة رقم (' + normalizePaymentNo(m.paymentNo) + ') عن الفترة من ' + fmtDate(m.start) + ' م إلى ' + fmtDate(m.end) + ' م';
  }

  function patchGlobalPeriodFunction() {
    if (!window.__ADMIN_OFFICES_NATIVE_GET_EXTRACT_PERIOD_DETAILS__ && typeof window.getExtractPeriodDetails === 'function' && window.getExtractPeriodDetails !== fixedExtractPeriodDetails) {
      window.__ADMIN_OFFICES_NATIVE_GET_EXTRACT_PERIOD_DETAILS__ = window.getExtractPeriodDetails;
    }
    window.getExtractPeriodDetails = fixedExtractPeriodDetails;
  }

  function patchOpeners() {
    ['openPrintDialog', 'printSelected', 'generateConsumablesRaiseLetter'].forEach(function (name) {
      var fn = window[name];
      if (typeof fn !== 'function' || fn.__adminOfficesPeriodFixed) return;
      window[name] = function () {
        fixNow();
        var out = fn.apply(this, arguments);
        setTimeout(fixNow, 0);
        setTimeout(refreshPaymentDisplays, 80);
        return out;
      };
      window[name].__adminOfficesPeriodFixed = true;
    });

    if (window.AdminOfficesRaiseLetters && typeof window.AdminOfficesRaiseLetters.openDialog === 'function' && !window.AdminOfficesRaiseLetters.openDialog.__adminOfficesPeriodFixed) {
      var old = window.AdminOfficesRaiseLetters.openDialog;
      window.AdminOfficesRaiseLetters.openDialog = function () {
        fixNow();
        var out = old.apply(this, arguments);
        setTimeout(fixNow, 0);
        setTimeout(refreshPaymentDisplays, 80);
        setTimeout(refreshPaymentDisplays, 350);
        return out;
      };
      window.AdminOfficesRaiseLetters.openDialog.__adminOfficesPeriodFixed = true;
    }
  }

  window.AdminOfficesRaiseLettersPeriodFix = {
    fixNow: fixNow,
    getMeta: function () { return fixNow(); },
    extractPhrase: extractPhrase,
    normalizePaymentNo: normalizePaymentNo,
    getExtractPeriodDetails: fixedExtractPeriodDetails
  };

  function boot(attempt) {
    patchGlobalPeriodFunction();
    fixNow();
    patchOpeners();
    refreshPaymentDisplays();
    if (attempt < 40) setTimeout(function () { boot(attempt + 1); }, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { boot(0); }); else boot(0);
  document.addEventListener('click', function () { setTimeout(patchGlobalPeriodFunction, 0); setTimeout(fixNow, 0); setTimeout(patchOpeners, 0); setTimeout(refreshPaymentDisplays, 80); }, true);
  window.addEventListener('beforeprint', function () { patchGlobalPeriodFunction(); fixNow(); });

  console.info('[Admin Offices Raise Letters Period Fix] installed fixed extract period function + no leading zeros');
})();