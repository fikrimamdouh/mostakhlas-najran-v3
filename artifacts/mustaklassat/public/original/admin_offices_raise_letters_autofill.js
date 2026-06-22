// ===================================================================
// Admin Offices Raise Letters Autofill
// Scope: admin_offices_attendance.html only
// يربط خطابات الرفع بالمستخلص المفتوح: رقم الدفعة + الفترة + بيانات العقد
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;

  const SETTINGS_KEY = 'adminOfficesRaiseLettersSettings_v1';
  const SAUDIZATION_KEY = 'adminOfficesSaudization_v1';

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value || {}));
  }

  function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function toIsoDate(value) {
    const v = cleanText(value);
    if (!v || v === 'غير محدد') return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const m = v.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
    const dmy = v.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (dmy) return `${dmy[3]}-${String(dmy[2]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}`;
    const d = new Date(v);
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    return '';
  }

  function firstValue() {
    for (const v of arguments) {
      if (v !== undefined && v !== null && cleanText(v) && cleanText(v) !== 'غير محدد') return cleanText(v);
    }
    return '';
  }

  function formatPaymentNo(value) {
    const v = cleanText(value);
    if (!v) return '';
    if (/^\d+$/.test(v)) return v.padStart(2, '0');
    return v;
  }

  function detectActiveExtract() {
    const ed = readJson('persistentExtractData', {});
    const contract = readJson('persistentContractData', {});
    const session = readJson('najran_session', {});

    const domStart = document.getElementById('extract-start-date')?.textContent;
    const domEnd = document.getElementById('extract-end-date')?.textContent;

    const start = toIsoDate(firstValue(ed.extractStart, localStorage.getItem('extractStart'), domStart));
    const end = toIsoDate(firstValue(ed.extractEnd, localStorage.getItem('extractEnd'), domEnd));

    const paymentNo = formatPaymentNo(firstValue(
      ed.paymentNumber,
      ed.extractNumber,
      ed.paymentNo,
      ed.batchNumber,
      ed.batchNo,
      ed.installmentNumber,
      localStorage.getItem('paymentNumber'),
      localStorage.getItem('extractNumber'),
      localStorage.getItem('paymentNo'),
      localStorage.getItem('batchNumber')
    ));

    const companyName = firstValue(
      contract.companyName,
      session.companyName,
      document.querySelector('.companyName')?.textContent
    );

    const contractType = firstValue(contract.contractType, document.querySelector('.contractType')?.textContent);
    const purchasePeriodLabel = firstValue(
      ed.purchasePeriodLabel,
      ed.directPurchasePeriod,
      ed.periodLabel,
      contract.purchasePeriodLabel,
      contract.directPurchasePeriod,
      contractType && contractType.includes('شراء مباشر') ? contractType : ''
    );

    return { start, end, paymentNo, companyName, purchasePeriodLabel };
  }

  function syncRaiseLettersFromActiveExtract() {
    const live = detectActiveExtract();
    const settings = readJson(SETTINGS_KEY, {});
    let changed = false;

    function set(key, value, overwrite) {
      if (!value) return;
      if (overwrite || !settings[key]) {
        if (settings[key] !== value) {
          settings[key] = value;
          changed = true;
        }
      }
    }

    // هذه الحقول مرتبطة بالمستخلص المفتوح ويجب أن تتحدث دائمًا.
    set('period2Start', live.start, true);
    set('period2End', live.end, true);
    set('paymentNo', live.paymentNo, true);

    // هذه الحقول تُملأ من المستخلص إذا كانت فارغة فقط حتى لا نكسر تعديل المستخدم.
    set('purchasePeriodLabel', live.purchasePeriodLabel, false);

    if (changed) writeJson(SETTINGS_KEY, settings);

    const saud = readJson(SAUDIZATION_KEY, {});
    saud.period2 = saud.period2 || { rows: [] };
    if (live.start) saud.period2.start = live.start;
    if (live.end) saud.period2.end = live.end;
    writeJson(SAUDIZATION_KEY, saud);

    refreshOpenDialogFields(settings);
    return settings;
  }

  function refreshOpenDialogFields(settings) {
    const overlay = document.getElementById('raise-letters-overlay');
    if (!overlay) return;
    ['paymentNo', 'period2Start', 'period2End', 'purchasePeriodLabel'].forEach(key => {
      const el = overlay.querySelector(`[data-rl-setting="${key}"]`);
      if (el && settings[key]) el.value = settings[key];
    });
  }

  function patchRaiseLettersApi() {
    const api = window.AdminOfficesRaiseLetters;
    if (!api || api.__activeExtractAutofillPatched) return false;

    ['openDialog', 'generateLaborRaiseLetter', 'generateConsumablesRaiseLetter', 'generateSaudizationReport', 'generateDeclaration', 'generateSiteRaiseLetter'].forEach(name => {
      if (typeof api[name] !== 'function') return;
      const original = api[name];
      api[name] = function patchedRaiseLetterMethod() {
        syncRaiseLettersFromActiveExtract();
        return original.apply(this, arguments);
      };
    });

    api.syncFromActiveExtract = syncRaiseLettersFromActiveExtract;
    api.__activeExtractAutofillPatched = true;
    syncRaiseLettersFromActiveExtract();
    console.info('[Admin Offices Raise Letters] active extract autofill patched');
    return true;
  }

  function boot(attempt) {
    if (patchRaiseLettersApi()) return;
    if (attempt >= 40) return;
    setTimeout(() => boot(attempt + 1), 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot(0));
  else boot(0);

  window.addEventListener('storage', e => {
    if (e.key === 'persistentExtractData' || e.key === 'paymentNumber' || e.key === 'extractNumber') {
      setTimeout(syncRaiseLettersFromActiveExtract, 50);
    }
  });
})();
