// ===================================================================
// Settings Contract Fixed Patch — V8
// Scope: settings_main.html / original-viewer?page=settings_main.html
// يثبت بيانات العقد المطلوبة بدون تغيير najran_session + يحمي حفظ بيانات المستخلص.
// V8: زهران/إيمان = Manual Contract Mode + تثبيت نوع العقد ونسبة الشراء المباشر + اسم عقد زهران.
// ===================================================================
(function () {
  'use strict';

  if (!/settings_main\.html|original-viewer\?page=settings_main\.html/.test(location.pathname + location.search)) return;
  if (window.__SETTINGS_CONTRACT_FIXED_PATCH_V8__) return;
  window.__SETTINGS_CONTRACT_FIXED_PATCH_V8__ = true;

  var OLD_NAJRAN_GENERAL = 'مستشفى نجران العام القديم';
  var OLD_NAJRAN_GENERAL_WITH_NURSES = 'مستشفى نجران العام القديم وسكن الممرضات الخارجي';
  var NEW_NAJRAN_GENERAL_DISPLAY = 'مستشفى غرب نجران للولادة والأطفال والعيادات التخصصية';
  var CANONICAL_OFFICES_SITE = 'المكاتب الإدارية والمرافق الصحية وصيانة وإصلاح السيارات والعيادات المتنقلة';
  var CONTRACT_DETAILS = 'الصيانة والتشغيل غير الطبي لمواقع (مستشفى الولادة والأطفال ومستشفى غرب نجران للولادة والأطفال والعيادات التخصصية والمكاتب الإدارية والمرافق الصحية وصيانة وإصلاح السيارات)';
  var EXTRACT_KEY = 'persistentExtractData';
  var SAFE_EXTRACT_KEY = 'najranExtractDataSafe_v1';
  var SAFE_EXTRACT_TS_KEY = 'najranExtractDataSafe_v1_ts';

  var FIXED = {
    contractNumber:  '250701156483',
    companyName:     'شركة مجموعة بيت العرب الحديثة المحدودة',
    startDate:       '2026-02-05',
    endDate:         '2031-02-04',
    contractType:    'عقد أساسي',
    contractValue:   '272601114.35',
    contractDetails: CONTRACT_DETAILS
  };

  var MANUAL_COMPANY_LABELS = {
    zahran: 'شركة زهران للتشغيل والصيانة',
    iman: 'شركة إيمان للتوكيلات والتجارة والمقاولات'
  };

  var MANUAL_CONTRACT_DETAILS = {
    zahran: 'عقد الصيانة والنظافة والتشغيل غير الطبي لمواقع مستشفى يدمه العام ومستشفى حبونا العام ومستشفى بدر الجنوب العام',
    iman: ''
  };

  var TARGET_KEYS = [
    'مستشفى الولادة والأطفال','مستشفى الولاده والاطفال',OLD_NAJRAN_GENERAL,OLD_NAJRAN_GENERAL_WITH_NURSES,NEW_NAJRAN_GENERAL_DISPLAY,
    CANONICAL_OFFICES_SITE,'المكاتب الإدارية والمرافق الصحية وصيانة وإصلاح السيارات','المكاتب الادارية والمرافق الصحية وصيانة واصلاح السيارات',
    'المكاتب الادارية والمرافق الصحية وصيانة واصلاح السيارات والعيادات المتنقلة','المكاتب الإدارية والمرافق الصحية','المكاتب الادارية والمرافق الصحية',
    'صيانة وإصلاح السيارات والعيادات المتنقلة','صيانة واصلاح السيارات والعيادات المتنقلة'
  ];

  function readJson(key, fallback) { try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; } }
  function writeJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value || {})); } catch (_) {} }
  function clean(v) { return String(v || '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/إيمان/g, 'ايمان').replace(/\s+/g, ' ').trim(); }
  function rawClean(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
  function valueOf(id) { var el = document.getElementById(id); if (!el) return ''; return rawClean(el.value != null ? el.value : el.textContent); }
  function hospitalContractKey(hospitalName) { return 'contractData__h__' + encodeURIComponent(hospitalName || ''); }
  function manualContractKey(hospitalName) { return 'manualContractData__h__' + encodeURIComponent(hospitalName || ''); }
  function currentSession() { return readJson('najran_session', {}); }
  function currentHospital() { var s = currentSession(); var p = readJson('persistentContractData', {}); return s.hospital || p.hospitalName || localStorage.getItem('hospitalName') || ''; }

  function manualCompanyType(hospitalName, companyName) {
    var h = clean(hospitalName);
    var c = clean(companyName);
    if (h.indexOf('زهران') > -1 || c.indexOf('زهران') > -1) return 'zahran';
    if (h.indexOf('ايمان') > -1 || c.indexOf('ايمان') > -1) return 'iman';
    return '';
  }
  function isManualContractCompany(hospitalName, companyName) { return !!manualCompanyType(hospitalName, companyName); }
  function resolveManualCompanyName(hospitalName, companyName) {
    var type = manualCompanyType(hospitalName, companyName);
    return type ? MANUAL_COMPANY_LABELS[type] : (companyName || '');
  }
  function resolveManualContractDetails(hospitalName, companyName, currentDetails) {
    var type = manualCompanyType(hospitalName, companyName);
    if (type === 'zahran') return MANUAL_CONTRACT_DETAILS.zahran;
    return currentDetails || '';
  }
  function mergeUsefulContractData(base, saved) {
    base = Object.assign({}, base || {});
    saved = saved || {};
    var useful = false;
    ['contractNumber','contractDetails','contractType','directPurchaseRatio','startDate','endDate','contractValue','contractStatus','notes'].forEach(function (k) {
      if (rawClean(saved[k])) useful = true;
    });
    if (!useful) return base;
    return Object.assign({}, base, saved, {
      hospitalName: base.hospitalName || saved.hospitalName || '',
      companyName: base.companyName || saved.companyName || ''
    });
  }
  function mirrorContractScalars(data) {
    data = data || {};
    try {
      localStorage.setItem('hospitalName', data.hospitalName || '');
      localStorage.setItem('companyName', data.companyName || '');
      localStorage.setItem('contractNumber', data.contractNumber || '');
      localStorage.setItem('contractDetails', data.contractDetails || '');
      localStorage.setItem('contractType', data.contractType || 'عقد أساسي');
      localStorage.setItem('directPurchaseRatio', data.directPurchaseRatio || '0');
      localStorage.setItem('directPurchaseAbsenceFineMode', 'apply');
    } catch (_) {}
  }
  function persistManualContractData(data, reason, forceDom) {
    if (!data) return false;
    data = Object.assign({}, data || {});
    if (!isManualContractCompany(data.hospitalName, data.companyName)) return false;
    data.companyName = resolveManualCompanyName(data.hospitalName, data.companyName);
    data.contractDetails = resolveManualContractDetails(data.hospitalName, data.companyName, data.contractDetails);
    data.directPurchaseAbsenceFineMode = 'apply';
    if (data.contractType === 'شراء مباشر' || Number(data.directPurchaseRatio || 0) > 0) {
      data.contractType = 'شراء مباشر';
      data._manualContractType = true;
      data._manualDirectPurchaseRatio = true;
    }
    if (data._manualDirectPurchaseRatio === true && !rawClean(data.directPurchaseRatio)) data.directPurchaseRatio = '0';
    writeJson('persistentContractData', data);
    writeJson(manualContractKey(data.hospitalName), data);
    writeJson(hospitalContractKey(data.hospitalName), data);
    mirrorContractScalars(data);
    if (forceDom !== false) updateDom(data);
    if (reason) console.info('[ManualContract] saved Zahran/Iman manual contract data:', reason, { hospitalName: data.hospitalName, companyName: data.companyName, contractDetails: data.contractDetails, contractType: data.contractType, ratio: data.directPurchaseRatio });
    return true;
  }
  function captureManualContractDomData() {
    var current = readJson('persistentContractData', {});
    var session = currentSession();
    var hospitalName = valueOf('hospital-name') || session.hospital || current.hospitalName || localStorage.getItem('hospitalName') || '';
    var companyName = valueOf('company-name') || current.companyName || localStorage.getItem('companyName') || session.companyName || session.company || '';
    if (!isManualContractCompany(hospitalName, companyName)) return null;
    var data = Object.assign({}, current);
    data.hospitalName = hospitalName;
    data.companyName = resolveManualCompanyName(hospitalName, companyName);
    data.contractDetails = resolveManualContractDetails(hospitalName, companyName, valueOf('contract-details') || data.contractDetails || '');
    data.contractNumber = valueOf('contract-number') || data.contractNumber || localStorage.getItem('contractNumber') || '';
    data.startDate = valueOf('contract-start-date') || data.startDate || '';
    data.endDate = valueOf('contract-end-date') || data.endDate || '';
    data.contractValue = valueOf('contract-value') || data.contractValue || '';
    data.contractStatus = valueOf('contract-status') || data.contractStatus || 'نشط';
    data.notes = valueOf('contract-notes') || data.notes || '';
    data.contractType = valueOf('contract-type') || data.contractType || localStorage.getItem('contractType') || 'عقد أساسي';
    data.directPurchaseRatio = valueOf('direct-purchase-ratio') || data.directPurchaseRatio || localStorage.getItem('directPurchaseRatio') || '0';
    data.directPurchaseAbsenceFineMode = 'apply';
    return data;
  }
  function protectManualContractData(reason, forceDom) {
    var session = currentSession();
    var current = readJson('persistentContractData', {});
    var hospitalName = session.hospital || current.hospitalName || localStorage.getItem('hospitalName') || '';
    var companyName = current.companyName || localStorage.getItem('companyName') || session.companyName || session.company || '';
    if (!isManualContractCompany(hospitalName, companyName)) return false;

    var cached = mergeUsefulContractData({}, readJson(manualContractKey(hospitalName), {}));
    if (!cached.contractType && !cached.directPurchaseRatio) cached = mergeUsefulContractData(cached, readJson(hospitalContractKey(hospitalName), {}));

    var data = mergeUsefulContractData(current, cached);
    data.hospitalName = hospitalName || data.hospitalName || '';
    data.companyName = resolveManualCompanyName(data.hospitalName, data.companyName || companyName);
    data.contractDetails = resolveManualContractDetails(data.hospitalName, data.companyName, data.contractDetails || current.contractDetails || '');

    if (data.contractType === 'شراء مباشر' || Number(data.directPurchaseRatio || 0) > 0) {
      data.contractType = 'شراء مباشر';
      data._manualContractType = true;
      data._manualDirectPurchaseRatio = true;
    }
    if (data._manualDirectPurchaseRatio === true && !rawClean(data.directPurchaseRatio)) data.directPurchaseRatio = '0';

    return persistManualContractData(data, reason || 'protectManualContractData', forceDom);
  }

  function isOldNajranGeneral(hospitalName) {
    var h = clean(hospitalName);
    return h === clean(OLD_NAJRAN_GENERAL) || h === clean(OLD_NAJRAN_GENERAL_WITH_NURSES) || h === clean('نجران العام القديم') || h === clean(NEW_NAJRAN_GENERAL_DISPLAY) || h.indexOf('نجران العام القديم') > -1;
  }
  function displayHospitalName(hospitalName) { return isOldNajranGeneral(hospitalName) ? NEW_NAJRAN_GENERAL_DISPLAY : hospitalName; }
  function isOldOfficeSplitName(hospitalName) {
    var h = clean(hospitalName);
    return h === clean('المكاتب الإدارية والمرافق الصحية') || h === clean('المكاتب الادارية والمرافق الصحية') ||
      h === clean('صيانة وإصلاح السيارات والعيادات المتنقلة') || h === clean('صيانة واصلاح السيارات والعيادات المتنقلة') ||
      h === clean('المكاتب الإدارية والمرافق الصحية وصيانة وإصلاح السيارات') || h === clean('المكاتب الادارية والمرافق الصحية وصيانة واصلاح السيارات') ||
      h === clean(CANONICAL_OFFICES_SITE) || h.indexOf('المكاتب الاداري') > -1 || h.indexOf('اصلاح السيارات') > -1;
  }
  function normalizeHospitalName(hospitalName) { return isOldOfficeSplitName(hospitalName) ? CANONICAL_OFFICES_SITE : displayHospitalName(hospitalName); }
  function isTargetHospital(hospitalName) {
    if (isManualContractCompany(hospitalName, localStorage.getItem('companyName') || '')) return false;
    var h = clean(hospitalName);
    if (!h) return false;
    return TARGET_KEYS.some(function (k) { return clean(k) === h; }) || (h.indexOf('الولاده') > -1 && h.indexOf('الاطفال') > -1) || h.indexOf('نجران العام القديم') > -1 || h.indexOf('غرب نجران') > -1 || isOldOfficeSplitName(hospitalName);
  }

  function extractScore(d) {
    d = d || {};
    var n = 0;
    ['paymentNumber','extractNumber','extractMonth','extractYear','extractStart','extractEnd'].forEach(function(k){ if (rawClean(d[k])) n++; });
    return n;
  }
  function normalizeExtract(d) {
    d = Object.assign({}, d || {});
    d.paymentNumber = rawClean(d.paymentNumber || d.extractNumber || document.getElementById('payment-number')?.value || localStorage.getItem('paymentNumber') || localStorage.getItem('extractNumber'));
    d.extractNumber = rawClean(d.extractNumber || d.paymentNumber || localStorage.getItem('extractNumber') || localStorage.getItem('paymentNumber'));
    d.extractStart = rawClean(d.extractStart || document.getElementById('extract-start')?.value || localStorage.getItem('extractStart'));
    d.extractEnd = rawClean(d.extractEnd || document.getElementById('extract-end')?.value || localStorage.getItem('extractEnd'));
    d.extractMonth = rawClean(d.extractMonth || document.getElementById('extract-month')?.value || localStorage.getItem('extractMonth'));
    d.extractYear = rawClean(d.extractYear || document.getElementById('extract-year')?.value || localStorage.getItem('extractYear'));
    d.extractCalendar = rawClean(d.extractCalendar || document.getElementById('extract-calendar')?.value || 'ميلادي');
    d.extractDuration = rawClean(d.extractDuration || document.getElementById('extract-duration')?.value || 'شهر واحد');
    d.extractFinal = !!(d.extractFinal || document.getElementById('extract-final')?.checked);
    return d;
  }
  function mirrorExtract(reason) {
    var data = normalizeExtract(readJson(EXTRACT_KEY, {}));
    if (extractScore(data) <= 0) return false;
    writeJson(EXTRACT_KEY, data);
    writeJson(SAFE_EXTRACT_KEY, data);
    try {
      localStorage.setItem(SAFE_EXTRACT_TS_KEY, String(Date.now()));
      if (data.extractMonth) localStorage.setItem('extractMonth', data.extractMonth);
      if (data.extractYear) localStorage.setItem('extractYear', String(data.extractYear));
      if (data.paymentNumber) { localStorage.setItem('paymentNumber', data.paymentNumber); localStorage.setItem('extractNumber', data.extractNumber || data.paymentNumber); }
      if (data.extractStart) localStorage.setItem('extractStart', data.extractStart);
      if (data.extractEnd) localStorage.setItem('extractEnd', data.extractEnd);
    } catch (_) {}
    if (reason) console.info('[ExtractPersistence] mirrored:', reason, data);
    return true;
  }
  function restoreExtract(reason) {
    var main = normalizeExtract(readJson(EXTRACT_KEY, {}));
    var safe = normalizeExtract(readJson(SAFE_EXTRACT_KEY, {}));
    if (extractScore(safe) > extractScore(main)) {
      writeJson(EXTRACT_KEY, safe);
      try {
        if (safe.extractMonth) localStorage.setItem('extractMonth', safe.extractMonth);
        if (safe.extractYear) localStorage.setItem('extractYear', String(safe.extractYear));
        if (safe.paymentNumber) { localStorage.setItem('paymentNumber', safe.paymentNumber); localStorage.setItem('extractNumber', safe.extractNumber || safe.paymentNumber); }
        if (safe.extractStart) localStorage.setItem('extractStart', safe.extractStart);
        if (safe.extractEnd) localStorage.setItem('extractEnd', safe.extractEnd);
        var map = { 'extract-calendar': safe.extractCalendar, 'extract-month': safe.extractMonth, 'extract-year': safe.extractYear, 'payment-number': safe.paymentNumber, 'extract-start': safe.extractStart, 'extract-end': safe.extractEnd, 'extract-duration': safe.extractDuration };
        Object.keys(map).forEach(function(id){ var el = document.getElementById(id); if (el && map[id]) el.value = map[id]; });
        var finalEl = document.getElementById('extract-final'); if (finalEl) finalEl.checked = !!safe.extractFinal;
      } catch (_) {}
      try { if (typeof window.updateExtractDisplayData === 'function') window.updateExtractDisplayData(); } catch (_) {}
      try { if (typeof window.calculateExtractDurationDays === 'function') window.calculateExtractDurationDays(); } catch (_) {}
      console.warn('[ExtractPersistence] restored:', reason || 'restore', safe);
      return true;
    }
    if (extractScore(main) > 0) mirrorExtract(reason || 'keep-current');
    return false;
  }
  function patchExtractSave() {
    if (typeof window.saveExtractData === 'function' && !window.saveExtractData.__extractPersistenceWrappedV8) {
      var old = window.saveExtractData;
      window.saveExtractData = function () {
        mirrorExtract('before-saveExtractData');
        var result = old.apply(this, arguments);
        setTimeout(function(){ mirrorExtract('after-saveExtractData'); }, 80);
        setTimeout(function(){ mirrorExtract('after-saveExtractData-late'); }, 800);
        return result;
      };
      window.saveExtractData.__extractPersistenceWrappedV8 = true;
    }
  }

  function patchMaps() {
    try {
      if (window.HOSPITAL_CONTRACT_MAP) { TARGET_KEYS.forEach(function (key) { window.HOSPITAL_CONTRACT_MAP[key] = Object.assign({}, window.HOSPITAL_CONTRACT_MAP[key] || {}, FIXED); }); window.HOSPITAL_CONTRACT_MAP[CANONICAL_OFFICES_SITE] = Object.assign({}, FIXED); window.HOSPITAL_CONTRACT_MAP[NEW_NAJRAN_GENERAL_DISPLAY] = Object.assign({}, FIXED); }
      if (window.HOSPITAL_COMPANY_MAP) { TARGET_KEYS.forEach(function (key) { window.HOSPITAL_COMPANY_MAP[key] = FIXED.companyName; }); window.HOSPITAL_COMPANY_MAP[CANONICAL_OFFICES_SITE] = FIXED.companyName; window.HOSPITAL_COMPANY_MAP[NEW_NAJRAN_GENERAL_DISPLAY] = FIXED.companyName; }
    } catch (_) {}
  }
  function setValue(id, value) { var el = document.getElementById(id); if (!el) return; if (el.type === 'checkbox') el.checked = !!value; else el.value = value || ''; }
  function updateDom(data) {
    data = data || {};
    setValue('hospital-name', displayHospitalName(data.hospitalName || currentHospital())); setValue('contract-details', data.contractDetails || ''); setValue('company-name', data.companyName || '');
    setValue('contract-start-date', data.startDate || ''); setValue('contract-end-date', data.endDate || ''); setValue('contract-value', data.contractValue || ''); setValue('contract-type', data.contractType || 'عقد أساسي');
    setValue('direct-purchase-ratio', data.directPurchaseRatio || '0');
    try { if (typeof window.toggleDirectPurchase === 'function') window.toggleDirectPurchase(); } catch (_) {}
  }
  function applyFixedContract(forceDom) {
    if (protectManualContractData('applyFixedContract-skip-fixed', forceDom)) return false;
    patchMaps();
    var originalHospitalName = currentHospital();
    if (!isTargetHospital(originalHospitalName)) return false;
    var canonicalHospitalName = normalizeHospitalName(originalHospitalName);
    var data = readJson('persistentContractData', {});
    if (isManualContractCompany(data.hospitalName || originalHospitalName, data.companyName)) return protectManualContractData('applyFixedContract-data-manual', forceDom);
    data.hospitalName = normalizeHospitalName(data.hospitalName || canonicalHospitalName);
    if (!isTargetHospital(data.hospitalName)) data.hospitalName = canonicalHospitalName;
    data.contractNumber = FIXED.contractNumber; data.companyName = FIXED.companyName; data.startDate = FIXED.startDate; data.endDate = FIXED.endDate; data.contractType = FIXED.contractType; data.contractValue = FIXED.contractValue; data.contractDetails = FIXED.contractDetails; data._autoHospitalName = data.hospitalName; data._fixedAdditionalRequestContract = true;
    writeJson(EXTRACT_KEY, normalizeExtract(readJson(EXTRACT_KEY, {})));
    writeJson('persistentContractData', data);
    try { localStorage.setItem('hospitalName', data.hospitalName); localStorage.setItem('companyName', FIXED.companyName); localStorage.setItem('contractNumber', FIXED.contractNumber); localStorage.setItem('contractType', FIXED.contractType); localStorage.setItem('directPurchaseRatio', '0'); } catch (_) {}
    writeJson(hospitalContractKey(data.hospitalName), data);
    if (originalHospitalName && originalHospitalName !== data.hospitalName) writeJson(hospitalContractKey(originalHospitalName), data);
    if (OLD_NAJRAN_GENERAL && data.hospitalName === NEW_NAJRAN_GENERAL_DISPLAY) writeJson(hospitalContractKey(OLD_NAJRAN_GENERAL), data);
    if (OLD_NAJRAN_GENERAL_WITH_NURSES && data.hospitalName === NEW_NAJRAN_GENERAL_DISPLAY) writeJson(hospitalContractKey(OLD_NAJRAN_GENERAL_WITH_NURSES), data);
    if (forceDom !== false) updateDom(data);
    return true;
  }
  function wrapFunction(name) {
    var fn = window[name];
    if (typeof fn !== 'function' || fn.__fixedAdditionalContractWrappedV8) return;
    window[name] = function () {
      var capturedManual = name === 'saveContractData' ? captureManualContractDomData() : null;
      if (capturedManual && (capturedManual.contractType === 'شراء مباشر' || Number(capturedManual.directPurchaseRatio || 0) > 0)) {
        persistManualContractData(capturedManual, 'saveContractData-before-original', false);
      }
      var result = fn.apply(this, arguments);
      setTimeout(function () {
        if (capturedManual && (capturedManual.contractType === 'شراء مباشر' || Number(capturedManual.directPurchaseRatio || 0) > 0)) persistManualContractData(capturedManual, name + '-after-call-captured', true);
        protectManualContractData(name + '-after-call', true);
        applyFixedContract(true);
        restoreExtract(name);
        patchExtractSave();
      }, 30);
      setTimeout(function () {
        if (capturedManual && (capturedManual.contractType === 'شراء مباشر' || Number(capturedManual.directPurchaseRatio || 0) > 0)) persistManualContractData(capturedManual, name + '-after-call-late', true);
      }, 900);
      return result;
    };
    window[name].__fixedAdditionalContractWrappedV8 = true;
  }
  function install() {
    patchMaps();
    protectManualContractData('install-before-fixed', true);
    restoreExtract('install');
    patchExtractSave();
    wrapFunction('autoFillFromSession'); wrapFunction('loadPersistentData'); wrapFunction('updateContractDisplayData'); wrapFunction('saveContractData'); wrapFunction('switchHospital');
    applyFixedContract(true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
  setTimeout(install, 600); setTimeout(install, 1600); setTimeout(install, 3200);
  window.addEventListener('beforeunload', function(){ mirrorExtract('beforeunload'); protectManualContractData('beforeunload', false); });
  window.ExtractPersistence = { mirror: mirrorExtract, restore: restoreExtract, score: function(){ return { main: extractScore(readJson(EXTRACT_KEY, {})), safe: extractScore(readJson(SAFE_EXTRACT_KEY, {})), mainData: readJson(EXTRACT_KEY, {}), safeData: readJson(SAFE_EXTRACT_KEY, {}) }; } };
  window.ManualContractProtection = { protect: protectManualContractData, isManual: isManualContractCompany, company: resolveManualCompanyName, contractDetails: resolveManualContractDetails, capture: captureManualContractDomData };

  console.info('[Settings Contract Fixed Patch] installed v8 — Zahran contract details fixed + manual direct purchase protected');
})();