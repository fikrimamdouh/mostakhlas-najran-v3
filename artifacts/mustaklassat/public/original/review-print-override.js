/* review-print-override.js - review print controls + safe period date normalization */
(function () {
  'use strict';
  if (!/\/original\/approval\.html(?:$|[?#])/.test(window.location.pathname + window.location.search)) return;

  function pad(n) { return String(n).padStart(2, '0'); }

  function toLocalDateOnly(v) {
    if (!v || typeof v !== 'string') return v;
    var s = v.trim();
    if (!/T/.test(s)) return v;
    var d = new Date(s);
    if (isNaN(d.getTime())) return v;
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function normalizePeriodKeys(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    var keys = Object.keys(obj);
    keys.forEach(function (k) {
      var v = obj[k];
      if (v && typeof v === 'object') {
        normalizePeriodKeys(v);
        return;
      }
      if (typeof v !== 'string') return;
      if (/^(extractStart|extractEnd|startDate|endDate)$/i.test(k)) {
        obj[k] = toLocalDateOnly(v);
      }
    });
    return obj;
  }

  function normalizeExtract(e) {
    if (!e || typeof e !== 'object') return e;
    normalizePeriodKeys(e);
    if (typeof e.extractData === 'string') {
      try {
        var data = JSON.parse(e.extractData || '{}');
        normalizePeriodKeys(data);
        e.extractData = JSON.stringify(data);
      } catch (_) {}
    } else if (e.extractData && typeof e.extractData === 'object') {
      normalizePeriodKeys(e.extractData);
    }
    return e;
  }

  if (!window.__rvPeriodFetchPatched) {
    window.__rvPeriodFetchPatched = true;
    var nativeFetch = window.fetch;
    window.fetch = function () {
      var args = arguments;
      return nativeFetch.apply(this, args).then(function (res) {
        try {
          var url = String(args[0] && args[0].url ? args[0].url : args[0] || '');
          if (url.indexOf('/api/submitted-extracts') === -1 || url.indexOf('/status') !== -1) return res;
          return res.clone().json().then(function (data) {
            if (data && Array.isArray(data.extracts)) data.extracts.forEach(normalizeExtract);
            else normalizeExtract(data);
            var headers = new Headers(res.headers);
            headers.set('content-type', 'application/json; charset=utf-8');
            return new Response(JSON.stringify(data), { status: res.status, statusText: res.statusText, headers: headers });
          }).catch(function () { return res; });
        } catch (_) {
          return res;
        }
      });
    };
  }

  function printReviewDocument() {
    if (typeof window.rvPrintClean === 'function') {
      window.rvPrintClean();
      return;
    }
    window.print();
  }

  window.rvDownload = function () {
    printReviewDocument();
  };

  function relabelButton() {
    var btn = document.getElementById('rv-download');
    if (!btn) return;
    btn.textContent = 'طباعة / حفظ PDF';
    btn.title = 'يفتح نافذة الطباعة لاختيار الطباعة أو الحفظ PDF';
    btn.onclick = function (ev) {
      if (ev && ev.preventDefault) ev.preventDefault();
      window.rvDownload();
    };
  }

  document.addEventListener('DOMContentLoaded', relabelButton);
  document.addEventListener('click', function () {
    setTimeout(relabelButton, 50);
  }, true);
  setInterval(relabelButton, 800);
})();