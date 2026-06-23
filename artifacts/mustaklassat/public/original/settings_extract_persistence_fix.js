// ===================================================================
// Settings Extract Persistence Fix — V1
// Scope: settings_main.html + operational pages
// يحفظ بيانات المستخلص في نسخة آمنة لا تمسحها حراسة تبديل السياق، ويرجعها عند الحاجة.
// ===================================================================
(function () {
  'use strict';

  var sig = location.pathname + location.search;
  if (!/settings_main\.html|admin_offices_attendance\.html|admin_offices_consumables\.html|original-viewer\?page=(settings_main|admin_offices_attendance|admin_offices_consumables)\.html/.test(sig)) return;
  if (window.__SETTINGS_EXTRACT_PERSISTENCE_FIX_V1__) return;
  window.__SETTINGS_EXTRACT_PERSISTENCE_FIX_V1__ = true;

  var MAIN = 'persistentExtractData';
  var SAFE = 'najranExtractDataSafe_v1';
  var SAFE_TS = 'najranExtractDataSafe_v1_ts';
  var KEYS = ['extractMonth','extractYear','extractNumber','paymentNumber','extractStart','extractEnd','extractFromDate','extractToDate'];

  function readJson(key, fallback) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }
  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value || {})); } catch (_) {}
  }
  function clean(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
  function score(d) {
    d = d || {};
    var n = 0;
    ['paymentNumber','extractNumber','extractMonth','extractYear','extractStart','extractEnd'].forEach(function(k){ if (clean(d[k])) n++; });
    return n;
  }
  function normalize(data) {
    data = Object.assign({}, data || {});
    data.paymentNumber = clean(data.paymentNumber || data.extractNumber || localStorage.getItem('paymentNumber') || localStorage.getItem('extractNumber'));
    data.extractNumber = clean(data.extractNumber || data.paymentNumber || localStorage.getItem('extractNumber') || localStorage.getItem('paymentNumber'));
    data.extractStart = clean(data.extractStart || data.startDate || localStorage.getItem('extractStart'));
    data.extractEnd = clean(data.extractEnd || data.endDate || localStorage.getItem('extractEnd'));
    data.extractMonth = clean(data.extractMonth || localStorage.getItem('extractMonth'));
    data.extractYear = clean(data.extractYear || localStorage.getItem('extractYear'));
    data.extractCalendar = clean(data.extractCalendar || 'ميلادي');
    data.extractDuration = clean(data.extractDuration || 'شهر واحد');
    return data;
  }
  function mirror(reason) {
    var data = normalize(readJson(MAIN, {}));
    if (score(data) <= 0) return false;
    writeJson(MAIN, data);
    writeJson(SAFE, data);
    try { localStorage.setItem(SAFE_TS, String(Date.now())); } catch (_) {}
    try {
      if (data.extractMonth) localStorage.setItem('extractMonth', data.extractMonth);
      if (data.extractYear) localStorage.setItem('extractYear', data.extractYear);
      if (data.paymentNumber) { localStorage.setItem('paymentNumber', data.paymentNumber); localStorage.setItem('extractNumber', data.extractNumber || data.paymentNumber); }
      if (data.extractStart) localStorage.setItem('extractStart', data.extractStart);
      if (data.extractEnd) localStorage.setItem('extractEnd', data.extractEnd);
    } catch (_) {}
    if (reason) console.info('[ExtractPersistence] mirrored:', reason, data);
    return true;
  }
  function restore(reason) {
    var main = normalize(readJson(MAIN, {}));
    var safe = normalize(readJson(SAFE, {}));
    if (score(safe) > score(main)) {
      writeJson(MAIN, safe);
      try {
        if (safe.extractMonth) localStorage.setItem('extractMonth', safe.extractMonth);
        if (safe.extractYear) localStorage.setItem('extractYear', safe.extractYear);
        if (safe.paymentNumber) { localStorage.setItem('paymentNumber', safe.paymentNumber); localStorage.setItem('extractNumber', safe.extractNumber || safe.paymentNumber); }
        if (safe.extractStart) localStorage.setItem('extractStart', safe.extractStart);
        if (safe.extractEnd) localStorage.setItem('extractEnd', safe.extractEnd);
      } catch (_) {}
      try { if (typeof window.updateExtractDisplayData === 'function') window.updateExtractDisplayData(); } catch (_) {}
      try { if (typeof window.calculateExtractDurationDays === 'function') window.calculateExtractDurationDays(); } catch (_) {}
      console.warn('[ExtractPersistence] restored:', reason || 'restore', safe);
      return true;
    }
    if (score(main) > 0) mirror(reason || 'keep-current');
    return false;
  }
  function readFormExtract() {
    var data = readJson(MAIN, {});
    var ids = {
      extractCalendar: 'extract-calendar', extractMonth: 'extract-month', extractYear: 'extract-year', paymentNumber: 'payment-number',
      extractStart: 'extract-start', extractEnd: 'extract-end', extractDuration: 'extract-duration'
    };
    Object.keys(ids).forEach(function(k){ var el = document.getElementById(ids[k]); if (el) data[k] = el.type === 'checkbox' ? el.checked : el.value; });
    return normalize(data);
  }
  function mirrorFromForm(reason) {
    var data = readFormExtract();
    if (score(data) <= 0) return false;
    writeJson(MAIN, data);
    writeJson(SAFE, data);
    try { localStorage.setItem(SAFE_TS, String(Date.now())); } catch (_) {}
    return true;
  }
  function patchSaveExtractData() {
    if (typeof window.saveExtractData !== 'function' || window.saveExtractData.__extractPersistenceWrapped) return false;
    var old = window.saveExtractData;
    window.saveExtractData = function () {
      mirrorFromForm('before-saveExtractData');
      var result = old.apply(this, arguments);
      setTimeout(function(){ mirror('after-saveExtractData'); }, 80);
      setTimeout(function(){ mirror('after-saveExtractData-late'); }, 800);
      return result;
    };
    window.saveExtractData.__extractPersistenceWrapped = true;
    return true;
  }
  function patchSetItem() {
    if (window.__EXTRACT_PERSISTENCE_SETITEM_PATCHED__) return;
    window.__EXTRACT_PERSISTENCE_SETITEM_PATCHED__ = true;
    var old = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      var result = old.apply(this, arguments);
      try {
        if (this === localStorage && String(key) === MAIN) {
          var data = normalize(JSON.parse(String(value || '{}')));
          if (score(data) > 0) { old.call(localStorage, SAFE, JSON.stringify(data)); old.call(localStorage, SAFE_TS, String(Date.now())); }
        }
      } catch (_) {}
      return result;
    };
  }
  function boot(reason) {
    patchSetItem();
    restore(reason || 'boot');
    patchSaveExtractData();
  }

  boot('initial');
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ boot('dom-ready'); });
  setTimeout(function(){ boot('t500'); }, 500);
  setTimeout(function(){ boot('t1500'); }, 1500);
  setTimeout(function(){ boot('t3500'); }, 3500);
  window.addEventListener('beforeunload', function(){ mirrorFromForm('beforeunload'); mirror('beforeunload'); });
  window.ExtractPersistence = { mirror: mirror, restore: restore, score: function(){ return { main: score(readJson(MAIN, {})), safe: score(readJson(SAFE, {})), mainData: readJson(MAIN, {}), safeData: readJson(SAFE, {}) }; } };

  console.info('[ExtractPersistence] installed v1 safe settings persistence');
})();