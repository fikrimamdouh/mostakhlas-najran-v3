// ===================================================================
// Admin Offices Raise Letters Payment Number Output Guard
// Scope: admin_offices_attendance.html only
// Keeps raise-letter print output on plain payment numbers: 1, 2, 3 without 01/001.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_RAISE_LETTERS_PAYMENT_OUTPUT_GUARD__) return;
  window.__ADMIN_OFFICES_RAISE_LETTERS_PAYMENT_OUTPUT_GUARD__ = true;

  function normalizeDigits(value) {
    const ar = '٠١٢٣٤٥٦٧٨٩';
    const fa = '۰۱۲۳۴۵۶۷۸۹';
    return String(value ?? '').replace(/[٠-٩]/g, d => ar.indexOf(d)).replace(/[۰-۹]/g, d => fa.indexOf(d));
  }

  function normalizePaymentNo(value) {
    const v = normalizeDigits(value).replace(/[\u200e\u200f]/g, '').trim();
    if (!v || v === '—' || v === '-') return v || '—';
    if (/^0*\d+$/.test(v)) return String(Number(v));
    return v;
  }

  function normalizeStoredPayment() {
    try {
      const keys = ['paymentNumber', 'extractNumber', 'paymentNo', 'extractNo', 'batchNumber'];
      keys.forEach(key => {
        const raw = localStorage.getItem(key);
        const next = normalizePaymentNo(raw);
        if (raw && next && raw !== next) localStorage.setItem(key, next);
      });
      const raw = localStorage.getItem('persistentExtractData');
      if (raw) {
        const data = JSON.parse(raw);
        ['paymentNumber', 'extractNumber', 'paymentNo', 'extractNo', 'batchNumber'].forEach(key => {
          if (data[key]) data[key] = normalizePaymentNo(data[key]);
        });
        localStorage.setItem('persistentExtractData', JSON.stringify(data));
      }
      document.querySelectorAll('.paymentNumber,#payment-number,[data-payment-no],.extract-number').forEach(el => {
        el.textContent = normalizePaymentNo(el.textContent);
      });
    } catch (_) {}
  }

  function stripPaymentZeros(html) {
    return String(html ?? '')
      .replace(/(دفعة\s*رقم\s*\()\s*0+(\d+)\s*(\))/g, '$1$2$3')
      .replace(/(رقم\s*الدفعة(?:\s*\/\s*المستخلص)?\s*[:：]\s*)0+(\d+)/g, '$1$2')
      .replace(/(دفعة\s*\/\s*المستخلص\s*[:：]\s*)0+(\d+)/g, '$1$2');
  }

  const originalOpen = window.open;
  window.open = function () {
    normalizeStoredPayment();
    const win = originalOpen.apply(window, arguments);
    try {
      if (win && win.document && !win.__raiseLettersPaymentWritePatched) {
        win.__raiseLettersPaymentWritePatched = true;
        const originalWrite = win.document.write.bind(win.document);
        win.document.write = function () {
          const args = Array.prototype.slice.call(arguments).map(arg => typeof arg === 'string' ? stripPaymentZeros(arg) : arg);
          return originalWrite.apply(win.document, args);
        };
      }
    } catch (_) {}
    return win;
  };

  normalizeStoredPayment();
  setTimeout(normalizeStoredPayment, 300);
  setTimeout(normalizeStoredPayment, 1000);
  document.addEventListener('click', function () { setTimeout(normalizeStoredPayment, 0); }, true);

  console.info('[Admin Offices Raise Letters Payment Output Guard] installed no leading zeros');
})();