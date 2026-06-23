// ===================================================================
// Settings Contract Fixed Patch — V3
// Scope: settings_main.html / original-viewer?page=settings_main.html
// يثبت بيانات العقد للمواقع المطلوبة بدون تغيير najran_session حتى لا يتم تنظيف المستخلص والحضور عند التنقل.
// قاعدة: المكاتب الإدارية والمرافق الصحية + صيانة وإصلاح السيارات = موقع واحد موحد داخل بيانات العقد فقط.
// ===================================================================
(function () {
  'use strict';

  if (!/settings_main\.html|original-viewer\?page=settings_main\.html/.test(location.pathname + location.search)) return;
  if (window.__SETTINGS_CONTRACT_FIXED_PATCH_V3__) return;
  window.__SETTINGS_CONTRACT_FIXED_PATCH_V3__ = true;

  var CANONICAL_OFFICES_SITE = 'المكاتب الإدارية والمرافق الصحية وصيانة وإصلاح السيارات والعيادات المتنقلة';
  var CONTRACT_DETAILS = 'الصيانة والتشغيل غير الطبي لمواقع (مستشفى الولادة والأطفال ومستشفى نجران العام القديم والمكاتب الإدارية والمرافق الصحية وصيانة وإصلاح السيارات)';

  var FIXED = {
    contractNumber:  '250701156483',
    companyName:     'شركة مجموعة بيت العرب الحديثة المحدودة',
    startDate:       '2026-02-05',
    endDate:         '2031-02-04',
    contractType:    'عقد أساسي',
    contractValue:   '272601114.35',
    contractDetails: CONTRACT_DETAILS
  };

  var TARGET_KEYS = [
    'مستشفى الولادة والأطفال',
    'مستشفى الولاده والاطفال',
    'مستشفى نجران العام القديم',
    'مستشفى نجران العام القديم وسكن الممرضات الخارجي',
    CANONICAL_OFFICES_SITE,
    'المكاتب الإدارية والمرافق الصحية وصيانة وإصلاح السيارات',
    'المكاتب الادارية والمرافق الصحية وصيانة واصلاح السيارات',
    'المكاتب الادارية والمرافق الصحية وصيانة واصلاح السيارات والعيادات المتنقلة',
    'المكاتب الإدارية والمرافق الصحية',
    'المكاتب الادارية والمرافق الصحية',
    'صيانة وإصلاح السيارات والعيادات المتنقلة',
    'صيانة واصلاح السيارات والعيادات المتنقلة'
  ];

  function readJson(key, fallback) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }
  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value || {})); } catch (_) {}
  }
  function clean(v) {
    return String(v || '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim();
  }
  function hospitalContractKey(hospitalName) {
    return 'contractData__h__' + encodeURIComponent(hospitalName || '');
  }
  function currentSession() { return readJson('najran_session', {}); }
  function currentHospital() {
    var s = currentSession();
    var p = readJson('persistentContractData', {});
    return s.hospital || p.hospitalName || localStorage.getItem('hospitalName') || '';
  }
  function isOldOfficeSplitName(hospitalName) {
    var h = clean(hospitalName);
    return h === clean('المكاتب الإدارية والمرافق الصحية') ||
      h === clean('المكاتب الادارية والمرافق الصحية') ||
      h === clean('صيانة وإصلاح السيارات والعيادات المتنقلة') ||
      h === clean('صيانة واصلاح السيارات والعيادات المتنقلة') ||
      h === clean('المكاتب الإدارية والمرافق الصحية وصيانة وإصلاح السيارات') ||
      h === clean('المكاتب الادارية والمرافق الصحية وصيانة واصلاح السيارات') ||
      h === clean(CANONICAL_OFFICES_SITE) ||
      (h.indexOf('المكاتب الاداري') > -1) ||
      (h.indexOf('اصلاح السيارات') > -1);
  }
  function normalizeHospitalName(hospitalName) {
    return isOldOfficeSplitName(hospitalName) ? CANONICAL_OFFICES_SITE : hospitalName;
  }
  function isTargetHospital(hospitalName) {
    var h = clean(hospitalName);
    if (!h) return false;
    return TARGET_KEYS.some(function (k) { return clean(k) === h; }) ||
      (h.indexOf('الولاده') > -1 && h.indexOf('الاطفال') > -1) ||
      (h.indexOf('نجران العام القديم') > -1) ||
      isOldOfficeSplitName(hospitalName);
  }
  function patchMaps() {
    try {
      if (window.HOSPITAL_CONTRACT_MAP) {
        TARGET_KEYS.forEach(function (key) { window.HOSPITAL_CONTRACT_MAP[key] = Object.assign({}, window.HOSPITAL_CONTRACT_MAP[key] || {}, FIXED); });
        window.HOSPITAL_CONTRACT_MAP[CANONICAL_OFFICES_SITE] = Object.assign({}, FIXED);
      }
      if (window.HOSPITAL_COMPANY_MAP) {
        TARGET_KEYS.forEach(function (key) { window.HOSPITAL_COMPANY_MAP[key] = FIXED.companyName; });
        window.HOSPITAL_COMPANY_MAP[CANONICAL_OFFICES_SITE] = FIXED.companyName;
      }
    } catch (_) {}
  }
  function setValue(id, value) {
    var el = document.getElementById(id);
    if (!el) return;
    if (el.type === 'checkbox') el.checked = !!value;
    else el.value = value || '';
  }
  function updateDom(data) {
    setValue('hospital-name', data.hospitalName || currentHospital());
    setValue('contract-details', data.contractDetails || '');
    setValue('company-name', data.companyName || '');
    setValue('contract-start-date', data.startDate || '');
    setValue('contract-end-date', data.endDate || '');
    setValue('contract-value', data.contractValue || '');
    setValue('contract-type', data.contractType || 'عقد أساسي');
    try { if (typeof window.toggleDirectPurchase === 'function') window.toggleDirectPurchase(); } catch (_) {}
  }
  function applyFixedContract(forceDom) {
    patchMaps();

    var originalHospitalName = currentHospital();
    if (!isTargetHospital(originalHospitalName)) return false;

    var canonicalHospitalName = normalizeHospitalName(originalHospitalName);
    var data = readJson('persistentContractData', {});
    data.hospitalName = normalizeHospitalName(data.hospitalName || canonicalHospitalName);
    if (!isTargetHospital(data.hospitalName)) data.hospitalName = canonicalHospitalName;

    data.contractNumber = FIXED.contractNumber;
    data.companyName = FIXED.companyName;
    data.startDate = FIXED.startDate;
    data.endDate = FIXED.endDate;
    data.contractType = FIXED.contractType;
    data.contractValue = FIXED.contractValue;
    data.contractDetails = FIXED.contractDetails;
    data._autoHospitalName = data.hospitalName;
    data._fixedAdditionalRequestContract = true;

    writeJson('persistentContractData', data);
    try { localStorage.setItem('hospitalName', data.hospitalName); } catch (_) {}
    try { localStorage.setItem('companyName', FIXED.companyName); } catch (_) {}
    try { localStorage.setItem('contractNumber', FIXED.contractNumber); } catch (_) {}

    writeJson(hospitalContractKey(data.hospitalName), data);
    if (originalHospitalName && originalHospitalName !== data.hospitalName) writeJson(hospitalContractKey(originalHospitalName), data);

    if (forceDom !== false) updateDom(data);
    return true;
  }
  function wrapFunction(name) {
    var fn = window[name];
    if (typeof fn !== 'function' || fn.__fixedAdditionalContractWrappedV3) return;
    window[name] = function () {
      var result = fn.apply(this, arguments);
      setTimeout(function () { applyFixedContract(true); }, 30);
      return result;
    };
    window[name].__fixedAdditionalContractWrappedV3 = true;
  }
  function install() {
    patchMaps();
    wrapFunction('autoFillFromSession');
    wrapFunction('loadPersistentData');
    wrapFunction('updateContractDisplayData');
    wrapFunction('saveContractData');
    wrapFunction('switchHospital');
    applyFixedContract(true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  setTimeout(install, 600);
  setTimeout(install, 1600);
  setTimeout(install, 3200);

  console.info('[Settings Contract Fixed Patch] installed v3 — fixed contract without session mutation');
})();