/* hospital-storage-extract-context-guard.js
 * يضيف extractContextKey تلقائياً لطلبات /api/hospital-storage حتى لا تختلط بيانات نفس المستشفى بين الشهور/الدفعات.
 * لا يضيف السياق لطلبات scope=settings لأن إعدادات العقد/المستشفى عامة وليست مستخلصاً تشغيلياً.
 */
(function () {
  'use strict';
  if (window.__najranHospitalStorageExtractContextGuard) return;
  window.__najranHospitalStorageExtractContextGuard = true;

  function parseJSON(value) {
    if (!value) return null;
    if (typeof value === 'object') return value;
    try { return JSON.parse(String(value)); } catch (_) { return null; }
  }

  function sanitize(value) {
    return String(value || '')
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^\u0600-\u06FFA-Za-z0-9_\-.]/g, '_')
      .slice(0, 140);
  }

  function readExtractContextKey() {
    var p = parseJSON(localStorage.getItem('persistentExtractData')) || {};
    var month = p.extractMonth || localStorage.getItem('extractMonth') || '';
    var year = p.extractYear || localStorage.getItem('extractYear') || '';
    var no = p.extractNumber || p.paymentNumber || localStorage.getItem('extractNumber') || localStorage.getItem('paymentNumber') || '';
    var start = p.extractStart || localStorage.getItem('extractStart') || '';
    var end = p.extractEnd || localStorage.getItem('extractEnd') || '';
    var raw = [year, month, no, start, end].filter(Boolean).join('__');
    return sanitize(raw);
  }

  function shouldSkip(urlObj) {
    if (!urlObj) return true;
    if (!/\/api\/hospital-storage(?:\/|$|\?)/.test(urlObj.pathname + urlObj.search)) return true;
    if (urlObj.pathname.indexOf('/api/hospital-storage/info') > -1) return true;
    if (urlObj.searchParams.get('scope') === 'settings') return true;
    if (urlObj.searchParams.get('extractContextKey') || urlObj.searchParams.get('extractKey')) return true;
    return false;
  }

  function withContext(input) {
    try {
      var rawUrl = typeof input === 'string' ? input : (input && input.url ? input.url : '');
      if (!rawUrl) return input;
      var urlObj = new URL(rawUrl, window.location.origin);
      if (shouldSkip(urlObj)) return input;
      var ctx = readExtractContextKey();
      if (!ctx) return input;
      urlObj.searchParams.set('extractContextKey', ctx);
      var finalUrl = urlObj.pathname + urlObj.search + urlObj.hash;
      if (typeof input === 'string') return finalUrl;
      if (input instanceof Request) return new Request(finalUrl, input);
      return finalUrl;
    } catch (_) {
      return input;
    }
  }

  var nativeFetch = window.fetch;
  window.fetch = function (input, init) {
    return nativeFetch.call(this, withContext(input), init);
  };

  window.najranGetExtractContextKey = readExtractContextKey;
  console.info('[HospitalStorageContextGuard] active');
})();