// ===================================================================
// Admin Offices Raise Letters Autofill
// Scope: admin_offices_attendance.html only
// يربط خطابات الرفع بالمستخلص المفتوح: رقم الدفعة + التواريخ + بيانات العقد
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
    try { localStorage.setItem(key, JSON.stringify(value || {})); } catch (_) {}
  }

  function cleanText(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function normalizeDigits(value) {
    const ar = '٠١٢٣٤٥٦٧٨٩';
    const fa = '۰۱۲۳۴۵۶۷۸۹';
    return String(value ?? '').replace(/[٠-٩]/g, d => ar.indexOf(d)).replace(/[۰-۹]/g, d => fa.indexOf(d));
  }

  function firstValue() {
    for (const v of arguments) {
      const s = cleanText(v);
      if (s && s !== 'غير محدد' && s !== 'undefined' && s !== 'null' && s !== '—') return s;
    }
    return '';
  }

  function toIsoDate(value) {
    const v = normalizeDigits(cleanText(value));
    if (!v || v === 'غير محدد') return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

    let m = v.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;

    m = v.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (m) return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;

    const d = new Date(v);
    if (!isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return '';
  }

  function formatPaymentNo(value) {
    const v = normalizeDigits(cleanText(value));
    if (!v) return '';
    if (/^\d+$/.test(v)) return v.padStart(2, '0');
    return v;
  }

  function parseMaybeJson(value) {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try { return JSON.parse(value); } catch (_) { return {}; }
  }

  function readRevisionExtract() {
    const snap = readJson('najran_revision_snapshot', {});
    const direct = parseMaybeJson(snap.persistentExtractData);
    return Object.assign({}, snap.extractData || {}, direct);
  }

  function detectActiveExtract() {
    const ed = readJson('persistentExtractData', {});
    const revEd = readRevisionExtract();
    const settings = readJson(SETTINGS_KEY, {});
    const contract = readJson('persistentContractData', {});
    const session = readJson('najran_session', {});

    const domStart = firstValue(
      document.getElementById('extract-start-date')?.textContent,
      document.querySelector('[data-extract-start]')?.textContent,
      document.querySelector('.extract-start')?.textContent
    );
    const domEnd = firstValue(
      document.getElementById('extract-end-date')?.textContent,
      document.querySelector('[data-extract-end]')?.textContent,
      document.querySelector('.extract-end')?.textContent
    );
    const domPayment = firstValue(
      document.getElementById('payment-number')?.textContent,
      document.querySelector('[data-payment-no]')?.textContent,
      document.querySelector('.paymentNo')?.textContent,
      document.querySelector('.extract-number')?.textContent
    );

    const start = toIsoDate(firstValue(
      ed.extractStart, ed.periodStart, ed.startDate, ed.start, ed.fromDate, ed.dateFrom,
      revEd.extractStart, revEd.periodStart, revEd.startDate, revEd.start, revEd.fromDate, revEd.dateFrom,
      settings.extractStart, settings.period2Start, settings.period1Start,
      localStorage.getItem('extractStart'), localStorage.getItem('periodStart'), localStorage.getItem('startDate'),
      domStart
    ));

    const end = toIsoDate(firstValue(
      ed.extractEnd, ed.periodEnd, ed.endDate, ed.end, ed.toDate, ed.dateTo,
      revEd.extractEnd, revEd.periodEnd, revEd.endDate, revEd.end, revEd.toDate, revEd.dateTo,
      settings.extractEnd, settings.period2End, settings.period1End,
      localStorage.getItem('extractEnd'), localStorage.getItem('periodEnd'), localStorage.getItem('endDate'),
      domEnd
    ));

    const paymentNo = formatPaymentNo(firstValue(
      ed.paymentNumber, ed.extractNumber, ed.paymentNo, ed.extractNo, ed.batchNumber, ed.batchNo, ed.installmentNumber, ed.payment,
      revEd.paymentNumber, revEd.extractNumber, revEd.paymentNo, revEd.extractNo, revEd.batchNumber, revEd.batchNo, revEd.installmentNumber, revEd.payment,
      settings.paymentNo, settings.paymentNumber, settings.extractNumber,
      localStorage.getItem('paymentNumber'), localStorage.getItem('extractNumber'), localStorage.getItem('paymentNo'), localStorage.getItem('extractNo'), localStorage.getItem('batchNumber'),
      domPayment
    ));

    const companyName = firstValue(
      contract.contractorName,
      contract.contractor_name,
      contract.contractorCompany,
      contract.contractor_company,
      contract.companyName,
      contract.company_name,
      contract.company,
      contract.contractor,
      contract.supplierName,
      contract.vendorName,
      document.querySelector('.companyName')?.textContent,
      session.contractorName,
      session.contractorCompany
    );

    const contractType = firstValue(contract.contractType, document.querySelector('.contractType')?.textContent);
    const purchasePeriodLabel = firstValue(
      ed.purchasePeriodLabel,
      ed.directPurchasePeriod,
      ed.periodLabel,
      revEd.purchasePeriodLabel,
      revEd.directPurchasePeriod,
      revEd.periodLabel,
      contract.purchasePeriodLabel,
      contract.directPurchasePeriod,
      contractType && contractType.includes('شراء مباشر') ? contractType : ''
    );

    return { start, end, paymentNo, companyName, purchasePeriodLabel };
  }

  function normalizeCanonicalStorage(live) {
    const ed = readJson('persistentExtractData', {});
    let changedExtract = false;

    if (live.start && ed.extractStart !== live.start) { ed.extractStart = live.start; changedExtract = true; }
    if (live.end && ed.extractEnd !== live.end) { ed.extractEnd = live.end; changedExtract = true; }
    if (live.paymentNo && ed.paymentNumber !== live.paymentNo) { ed.paymentNumber = live.paymentNo; changedExtract = true; }

    if (changedExtract) writeJson('persistentExtractData', ed);

    if (live.start) localStorage.setItem('extractStart', live.start);
    if (live.end) localStorage.setItem('extractEnd', live.end);
    if (live.paymentNo) {
      localStorage.setItem('paymentNumber', live.paymentNo);
      localStorage.setItem('extractNumber', live.paymentNo);
      localStorage.setItem('paymentNo', live.paymentNo);
    }

    if (live.companyName) {
      const contract = readJson('persistentContractData', {});
      if (!contract.contractorName) contract.contractorName = live.companyName;
      if (!contract.companyName || /تجمع نجران|وحدة الصيانة/i.test(String(contract.companyName))) contract.companyName = live.companyName;
      writeJson('persistentContractData', contract);
    }
  }

  function syncRaiseLettersFromActiveExtract() {
    const live = detectActiveExtract();
    normalizeCanonicalStorage(live);

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

    set('period1Start', live.start, true);
    set('period1End', live.end, true);
    set('period2Start', live.start, true);
    set('period2End', live.end, true);
    set('paymentNo', live.paymentNo, true);
    set('purchasePeriodLabel', live.purchasePeriodLabel, false);

    if (changed) writeJson(SETTINGS_KEY, settings);

    const saud = readJson(SAUDIZATION_KEY, {});
    saud.period1 = saud.period1 || { rows: [] };
    saud.period2 = saud.period2 || { rows: [] };
    if (live.start) {
      saud.period1.start = live.start;
      saud.period2.start = live.start;
    }
    if (live.end) {
      saud.period1.end = live.end;
      saud.period2.end = live.end;
    }
    writeJson(SAUDIZATION_KEY, saud);

    refreshOpenDialogFields(settings, live);
    return Object.assign({}, settings, live);
  }

  function refreshOpenDialogFields(settings, live) {
    const overlay = document.getElementById('raise-letters-overlay');
    if (!overlay) return;

    ['paymentNo', 'period1Start', 'period1End', 'period2Start', 'period2End', 'purchasePeriodLabel'].forEach(key => {
      const el = overlay.querySelector(`[data-rl-setting="${key}"]`);
      if (el && settings[key]) el.value = settings[key];
    });

    const readonlyText = overlay.querySelector('.readonly-box');
    if (readonlyText && live && live.paymentNo && live.start && live.end) {
      readonlyText.textContent = `دفعة رقم (${live.paymentNo}) عن الفترة من ${live.start} م إلى ${live.end} م`;
    }
  }

  function patchRaiseLettersApi() {
    const api = window.AdminOfficesRaiseLetters;
    if (!api || api.__activeExtractAutofillPatched) return false;

    ['openDialog', 'generateLaborRaiseLetter', 'generateDeclaration', 'generateSiteRaiseLetter', 'generateSelectedSiteLetters'].forEach(name => {
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
    console.info('[Admin Offices Raise Letters] active extract normalized for letters');
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
    if (['persistentExtractData', 'paymentNumber', 'extractNumber', 'paymentNo', 'extractStart', 'extractEnd'].includes(e.key)) {
      setTimeout(syncRaiseLettersFromActiveExtract, 50);
    }
  });
})();