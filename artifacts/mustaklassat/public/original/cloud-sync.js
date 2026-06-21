/**
 * cloud-sync.js — V8 Local-first
 * السحب من السحابة عند فتح الصفحة فقط.
 * الرفع التلقائي مسموح للإعدادات الخفيفة فقط.
 * بيانات التشغيل الثقيلة تبقى محلية وتترفع فقط عند الرفع الصريح عبر najranSyncNow().
 */
(function () {
  'use strict';

  const API_BASE = '/api';
  const SESSION_KEY = 'najran_session';
  const SETTINGS_AUTO_SYNC_MS = 300000;
  const ACTIVITY_STATUS_THROTTLE_MS = 300000;
  const DIRTY_KEYS = new Set();

  let _origSetItem = null;
  let isApplyingCloudPull = false;
  let lastActivityStatusAt = 0;
  let syncInProgress = false;
  let syncIndicator = null;

  const PERSONAL_KEYS = new Set(['backupLog', 'backupLogs']);

  const ATTENDANCE_PAGE_KEYS = new Set([
    'attendanceData', 'ng_attendanceData', 'nd_attendanceData',
    'centersAttendanceData_v2', 'healthCentersAttendanceData', 'adminOfficesAttendanceData_v1'
  ]);

  const SETTINGS_PAGE_KEYS = new Set([
    'persistentContractData', 'persistentExtractData', 'contractData', 'contractDetails', 'contractNumber', 'contractType',
    'contractStartDate', 'contractEndDate', 'contractSignatureData',
    'extractMonth', 'extractYear', 'extractNumber', 'extractStart', 'extractEnd', 'extractFromDate', 'extractToDate', 'paymentNumber',
    'hospitalName', 'companyName', 'directPurchaseRatio',
    'settings_main', 'settings_advanced', 'dynamicSignatures', 'contractorSignature', 'appTitles_v1',
    'admin_staff', 'contract_foundation_data',
    'hospitalActivityStatus', 'hospitalActivityStatus_v2'
  ]);

  const SYNC_KEYS = new Set([
    ...SETTINGS_PAGE_KEYS,
    'attendanceData', 'centersAttendanceData_v2', 'healthCentersAttendanceData', 'adminOfficesAttendanceData_v1',
    'ng_attendanceData', 'ng_departmentNames', 'ng_distributionSettings', 'ng_finalLaborCost', 'ng_performanceTotalDeduction',
    'nd_attendanceData', 'nd_departmentNames', 'nd_distributionSettings', 'nd_finalLaborCost', 'nd_performanceTotalDeduction', 'nd_dentalAchievementTotals',
    'consumablesTableData', 'healthCentersConsumables', 'mainHospitalConsumables', 'admin_offices_consumables_v1.0', 'consumablesTitle', 'consumablesPeriodFrom', 'consumablesPeriodTo', 'finalConsumablesCost',
    'subcontractors_data_consumables_v27', 'performance_data_consumables_v27', 'water_supply_data_consumables_v27', 'sewage_disposal_data_consumables_v27', 'summary_data_consumables_v27',
    'spare_partsData', 'sparePartsTotalAmount', 'approvalData', 'displayApprovalData',
    'performanceData', 'performanceData_v4', 'performanceDeductions', 'achievementData', 'achievementTitles_v1', 'achievementItemNames',
    'centerNames_v3', 'departmentNames', 'distributionSettings',
    'healthCentersData', 'reviewExtractData', 'requestVisitData',
    'finalLaborCost', 'performanceTotalDeduction', 'grand-net-total', 'grand-net-total-centers', 'grand-net-total-admin',
    'performanceSignatures', 'performanceSignatures_v2', 'performanceTableNames',
    'najran_labor_attendance_done', 'najran_labor_performance_done', 'najran_health_attendance_done', 'najran_admin_offices_attendance_done',
    'adminOfficeNames_v1', 'adminOfficeAffiliations_v1',
    'backupLog', 'backupLogs'
  ]);

  const OPERATIONAL_EXACT_KEYS = new Set([
    'attendanceData', 'centersAttendanceData_v2', 'healthCentersAttendanceData', 'adminOfficesAttendanceData_v1',
    'ng_attendanceData', 'ng_departmentNames', 'ng_distributionSettings', 'ng_finalLaborCost', 'ng_performanceTotalDeduction',
    'nd_attendanceData', 'nd_departmentNames', 'nd_distributionSettings', 'nd_finalLaborCost', 'nd_performanceTotalDeduction', 'nd_dentalAchievementTotals',
    'consumablesTableData', 'healthCentersConsumables', 'mainHospitalConsumables', 'admin_offices_consumables_v1.0', 'finalConsumablesCost',
    'subcontractors_data_consumables_v27', 'performance_data_consumables_v27', 'water_supply_data_consumables_v27', 'sewage_disposal_data_consumables_v27', 'summary_data_consumables_v27',
    'spare_partsData', 'sparePartsTotalAmount', 'approvalData', 'displayApprovalData',
    'performanceData', 'performanceData_v4', 'performanceDeductions', 'achievementData', 'achievementTitles_v1', 'achievementItemNames',
    'finalLaborCost', 'performanceTotalDeduction', 'grand-net-total', 'grand-net-total-centers', 'grand-net-total-admin',
    'najran_labor_attendance_done', 'najran_labor_performance_done', 'najran_health_attendance_done', 'najran_admin_offices_attendance_done'
  ]);

  const OPERATIONAL_PREFIXES = [
    'deptCalculatedCost_', 'dept_', 'tableData_', 'achievement_', 'consumables_', 'spare_',
    'water_', 'sewage_', 'subcontractors_', 'najran_labor_', 'najran_health_', 'najran_admin_',
    'monthSnapshot_'
  ];

  const EMPTY_OVERWRITE_PROTECTED_KEYS = new Set([
    ...ATTENDANCE_PAGE_KEYS,
    'performanceData', 'performanceData_v4', 'performanceDeductions', 'achievementData',
    'consumablesTableData', 'healthCentersConsumables', 'mainHospitalConsumables',
    'admin_offices_consumables_v1.0', 'spare_partsData'
  ]);

  function normalizeKey(key) {
    return String(key || '').replace(/^(_u\d+_)+/, '');
  }

  function getCurrentPageFile() {
    return window.location.pathname.split('/').pop() || '';
  }

  function isSettingsMainPage() {
    return getCurrentPageFile() === 'settings_main.html';
  }

  function isAdminSession() {
    const s = getSession();
    const role = String((s && s.role) || '').toLowerCase();
    return role === 'admin' || role === 'super_admin' || role === 'administrator';
  }

  function isOperationalKey(key) {
    const nk = normalizeKey(key);
    return OPERATIONAL_EXACT_KEYS.has(nk) || OPERATIONAL_PREFIXES.some(p => nk.indexOf(p) === 0);
  }

  function shouldSyncKey(key) {
    const nk = normalizeKey(key);
    return SYNC_KEYS.has(nk) || isOperationalKey(nk) || nk.includes('finalLaborCost') || nk.includes('grand-net-total');
  }

  function shouldAutoSyncKey(key) {
    const nk = normalizeKey(key);
    return shouldSyncKey(nk) && !isOperationalKey(nk);
  }

  function shouldMergePulledKeyForCurrentPage(key) {
    const nk = normalizeKey(key);
    if (!isSettingsMainPage()) return true;
    return SETTINGS_PAGE_KEYS.has(nk);
  }

  function parseMaybeJSON(value) {
    if (value == null) return null;
    if (typeof value === 'object') return value;
    try { return JSON.parse(String(value)); } catch (_) { return value; }
  }

  function countGenericContent(value) {
    const v = parseMaybeJSON(value);
    if (v == null) return 0;
    if (typeof v === 'string') return v.trim() ? 1 : 0;
    if (typeof v === 'number') return Number.isFinite(v) && v !== 0 ? 1 : 0;
    if (Array.isArray(v)) return v.reduce((s, x) => s + countGenericContent(x), v.length ? 1 : 0);
    if (typeof v === 'object') {
      const keys = Object.keys(v);
      if (!keys.length) return 0;
      return keys.reduce((s, k) => s + countGenericContent(v[k]), keys.length ? 1 : 0);
    }
    return 0;
  }

  function countNamedEmployees(value) {
    const v = parseMaybeJSON(value);
    let count = 0;
    function walk(x) {
      if (!x) return;
      if (Array.isArray(x)) { x.forEach(walk); return; }
      if (typeof x === 'object') {
        const name = String(x.name || x.employeeName || x.workerName || x.empName || x.staffName || '').trim();
        if (name) count++;
        Object.values(x).forEach(walk);
      }
    }
    walk(v);
    return count;
  }

  function contentScoreForKey(key, value) {
    const nk = normalizeKey(key);
    if (ATTENDANCE_PAGE_KEYS.has(nk)) {
      const named = countNamedEmployees(value);
      if (named > 0) return named;
    }
    return countGenericContent(value);
  }

  function shouldProtectFromEmptyOverwrite(key) {
    const nk = normalizeKey(key);
    return EMPTY_OVERWRITE_PROTECTED_KEYS.has(nk) || isOperationalKey(nk);
  }

  function isUnsafeEmptyOverwrite(key, newValue, oldValue) {
    if (!shouldProtectFromEmptyOverwrite(key)) return false;
    if (oldValue == null) return false;
    return contentScoreForKey(key, oldValue) > 0 && contentScoreForKey(key, newValue) === 0;
  }

  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !s.timestamp) return null;
      if (Date.now() - s.timestamp > 8 * 60 * 60 * 1000) return null;
      return s;
    } catch (_) { return null; }
  }

  function getHospitalName() {
    const s = getSession();
    return s && s.hospital ? String(s.hospital).trim() : null;
  }

  function isReviewOnlySession() {
    const s = getSession();
    return !!(s && s.reviewOnly === true);
  }
function isRevisionMode() {
  try {
    return localStorage.getItem('najran_revision_mode') === 'true'
      && !!localStorage.getItem('najran_revision_extract_id')
      && !!localStorage.getItem('najran_revision_snapshot');
  } catch (_) {
    return false;
  }
}
  function parseHospitalList(v) {
    if (Array.isArray(v)) return v.map(String).map(x => x.trim()).filter(Boolean);
    if (!v) return [];
    try {
      const p = JSON.parse(String(v));
      if (Array.isArray(p)) return parseHospitalList(p);
    } catch (_) {}
    return String(v).split(/[،,|\n]/g).map(x => x.trim()).filter(Boolean);
  }

  function forceReviewOnlyBeforeInit() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw);
      if (!s) return false;
      const hospital = String(s.hospital || '').trim();
      const reviewActive = String(s.reviewActiveHospital || '').trim();
      const reviewHospitals = parseHospitalList(s.reviewHospitals);
      const shouldForceReview = !!hospital && (
        reviewActive === hospital ||
        (s.canReviewCurrentHospital === true && s.canEditCurrentHospital === false) ||
        (s.reviewOnly === true && reviewHospitals.indexOf(hospital) > -1)
      );
      if (!shouldForceReview) return false;
      s.hospital = hospital;
      s.reviewActiveHospital = hospital;
      s.canReviewCurrentHospital = true;
      s.canEditCurrentHospital = false;
      s.reviewOnly = true;
      s.timestamp = Date.now();
      localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      localStorage.removeItem('najran_active_hospital_context');
      Object.keys(localStorage).forEach(function(k){
        const lk = String(k || '').toLowerCase();
        if (lk.includes('attendance') || lk.includes('hospitalactivitystatus')) localStorage.removeItem(k);
      });
      sessionStorage.clear();
      console.warn('[MzamanaCloud] REVIEW ONLY: تم فرض وضع المراجعة قبل التهيئة للمستشفى «' + hospital + '»');
      return true;
    } catch (_) { return false; }
  }

  function clearOperationalKeysForHospitalSwitch() {
    const keepKeys = new Set([SESSION_KEY, 'hospitalName', 'companyName', 'contractNumber', 'sidebar_collapsed', 'najran_read_notifications']);
    const clearPrefixes = ['deptCalculatedCost_', 'dept_', 'sb_sigs_', 'sb_prefs_', 'tableData_', 'achievement_', 'consumables_', 'spare_', 'water_', 'sewage_', 'subcontractors_', 'najran_labor_', 'najran_health_', 'najran_admin_', 'monthSnapshot_', '_u'];
    const clearKeys = [
      'persistentContractData','persistentExtractData','contractData','contractDetails','contractType','contractStartDate','contractEndDate','contractSignatureData',
      'extractMonth','extractYear','extractNumber','extractStart','extractEnd','extractFromDate','extractToDate','paymentNumber',
      'attendanceData','centersAttendanceData_v2','healthCentersAttendanceData','adminOfficesAttendanceData_v1',
      'ng_attendanceData','ng_departmentNames','ng_distributionSettings','ng_finalLaborCost','ng_performanceTotalDeduction',
      'nd_attendanceData','nd_departmentNames','nd_distributionSettings','nd_finalLaborCost','nd_performanceTotalDeduction','nd_dentalAchievementTotals',
      'consumablesTableData','healthCentersConsumables','mainHospitalConsumables','admin_offices_consumables_v1.0','consumablesTitle','consumablesPeriodFrom','consumablesPeriodTo','finalConsumablesCost',
      'subcontractors_data_consumables_v27','performance_data_consumables_v27','water_supply_data_consumables_v27','sewage_disposal_data_consumables_v27','summary_data_consumables_v27',
      'spare_partsData','sparePartsTotalAmount','approvalData','displayApprovalData',
      'performanceData','performanceData_v4','performanceDeductions','achievementData','achievementTitles_v1','achievementItemNames',
      'centerNames_v3','departmentNames','distributionSettings','hospitalActivityStatus','hospitalActivityStatus_v2',
      'admin_staff','dynamicSignatures','contractorSignature','appTitles_v1','healthCentersData','reviewExtractData','requestVisitData',
      'settings_main','settings_advanced','finalLaborCost','performanceTotalDeduction','grand-net-total','grand-net-total-centers','grand-net-total-admin',
      'performanceSignatures','performanceSignatures_v2','performanceTableNames','adminOfficeNames_v1','adminOfficeAffiliations_v1','contract_foundation_data'
    ];
    clearKeys.forEach(key => { if (!keepKeys.has(key)) localStorage.removeItem(key); });
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key || keepKeys.has(key)) continue;
      if (clearPrefixes.some(p => key.indexOf(p) === 0)) localStorage.removeItem(key);
    }
    DIRTY_KEYS.clear();
  }

  function ensureHospitalContextClean() {
    const hospitalName = getHospitalName();
    if (!hospitalName) return;
    const ctxKey = 'najran_active_hospital_context';
    const prev = localStorage.getItem(ctxKey);
    const reviewOnly = isReviewOnlySession();
    const mustClean = reviewOnly || (prev && prev !== hospitalName);
    if (mustClean) {
      console.warn('[MzamanaCloud] تنظيف السياق: «' + hospitalName + '»' + (reviewOnly ? ' [مراجعة — يتنظف دايماً]' : ' [تبديل مستشفى]'));
      clearOperationalKeysForHospitalSwitch();
    }
    if (!reviewOnly) localStorage.setItem(ctxKey, hospitalName);
  }

  async function getFreshToken() {
    try {
      if (typeof window.najranGetFreshToken === 'function') {
        const t = await window.najranGetFreshToken();
        if (t) return t;
      }
      if (window.parent && window.parent !== window && typeof window.parent.najranGetFreshToken === 'function') {
        const t = await window.parent.najranGetFreshToken();
        if (t) return t;
      }
    } catch (_) {}
    const s = getSession();
    return s && s.clerkToken ? s.clerkToken : null;
  }

  async function apiFetch(path, options) {
    const session = getSession();
    if (!session) return null;
    const token = await getFreshToken();
    if (!token) { console.warn('[MzamanaCloud] لا يوجد token صالح'); return null; }
    try {
      const headers = Object.assign({'Content-Type':'application/json'}, (options && options.headers) || {}, { Authorization:'Bearer ' + token });
      const resp = await fetch(API_BASE + path, Object.assign({}, options || {}, { headers, credentials:'include' }));
      if (resp.status === 401) { console.warn('[MzamanaCloud] 401'); return null; }
      return resp.ok ? resp.json() : null;
    } catch (_) { return null; }
  }

  function readExtractMeta() {
    try {
      const d = JSON.parse(localStorage.getItem('persistentExtractData') || '{}');
      return { month: d.extractMonth || '', year: d.extractYear || '', extractNumber: d.extractNumber || d.paymentNumber || '' };
    } catch (_) { return { month:'', year:'', extractNumber:'' }; }
  }

  function getCurrentPageLabel() {
    const file = getCurrentPageFile();
    const map = {
      'attendance.html':'الحضور والانصراف','performance.html':'شهادة الأداء','achievement.html':'شهادة الإنجاز',
      'consumables.html':'مستخلص المستهلكات','spare_parts.html':'مستخلص قطع الغيار','settings_main.html':'الإعدادات الرئيسية',
      'approval.html':'اعتماد المستخلص','review_extract.html':'مراجعة المستخلص','monthly-overview.html':'النظرة الشاملة',
      'health_centers_attendance.html':'حضور المراكز الصحية','health_centers_consumables.html':'مستهلكات المراكز الصحية',
      'admin_offices_attendance.html':'حضور المكاتب الإدارية','admin_offices_consumables.html':'مستهلكات المكاتب الإدارية'
    };
    return map[file] || document.title || file || 'صفحة غير محددة';
  }

  function updateHospitalActivityStatus() {
    try {
      const now = Date.now();
      if (now - lastActivityStatusAt < ACTIVITY_STATUS_THROTTLE_MS) return;
      lastActivityStatusAt = now;
      const s = getSession();
      if (!s || !s.hospital || isReviewOnlySession()) return;
      const meta = readExtractMeta();
      const safeWrite = _origSetItem || localStorage.setItem.bind(localStorage);
      safeWrite('hospitalActivityStatus', JSON.stringify({
        userId: s.userId || '', userName: s.name || s.email || 'مستخدم', hospital: s.hospital,
        page: getCurrentPageLabel(), pageFile: getCurrentPageFile(), month: meta.month, year: meta.year,
        extractNumber: meta.extractNumber, updatedAt: new Date(now).toISOString()
      }));
      DIRTY_KEYS.add('hospitalActivityStatus');
    } catch (_) {}
  }

  function showHospitalActivityNotice() {
    try {
      if (isReviewOnlySession()) return;
      const raw = localStorage.getItem('hospitalActivityStatus');
      if (!raw) return;
      const activity = JSON.parse(raw);
      const s = getSession();
      if (!activity || !s || activity.userId === s.userId) return;
      if (activity.hospital && s.hospital && String(activity.hospital).trim() !== String(s.hospital).trim()) return;
      if (activity.pageFile && activity.pageFile !== getCurrentPageFile()) return;
      const updatedAt = activity.updatedAt ? new Date(activity.updatedAt) : null;
      if (updatedAt && Date.now() - updatedAt.getTime() > 6 * 60 * 60 * 1000) return;
      const noticeKey = 'activity_notice_seen_' + activity.pageFile + '_' + activity.updatedAt;
      if (sessionStorage.getItem(noticeKey)) return;
      sessionStorage.setItem(noticeKey, '1');
      const box = document.createElement('div');
      box.className = 'no-print';
      box.style.cssText = 'position:fixed;bottom:18px;left:18px;z-index:999999;max-width:460px;background:#0f172a;color:#fff;padding:13px 16px;border-radius:14px;font-family:Tajawal,Arial,sans-serif;font-size:13px;line-height:1.8;direction:rtl;box-shadow:0 10px 28px rgba(0,0,0,.28);border-right:4px solid #d4af37;';
      box.innerHTML = '<div style="font-weight:800;color:#d4af37;margin-bottom:3px;">تنبيه آخر نشاط</div><div>آخر عمل على هذه الصفحة كان بواسطة: ' + (activity.userName || 'مستخدم آخر') + '</div>';
      document.body.appendChild(box);
      setTimeout(function(){ if (box.parentElement) box.remove(); }, 9000);
    } catch (_) {}
  }

 async function pullFromCloud() {
  if (isRevisionMode() && !isSettingsMainPage()) {
    console.warn('[MzamanaCloud] REVISION MODE: تم منع Pull السحابة للحفاظ على snapshot المستخلص القديم');
    return;
  }

  const hospitalName = getHospitalName();
  const storageScope = isSettingsMainPage() ? 'scope=settings' : '';
    const reviewOnly = isReviewOnlySession();
    const hospitalQueryParts = [];
    if (storageScope) hospitalQueryParts.push(storageScope);
    if (reviewOnly && hospitalName) hospitalQueryParts.push('hospital=' + encodeURIComponent(hospitalName));
    const hospitalQuery = hospitalQueryParts.length ? '?' + hospitalQueryParts.join('&') : '';

    const results = await Promise.all([
      apiFetch('/storage' + (storageScope ? '?' + storageScope : '')),
      hospitalName ? apiFetch('/hospital-storage' + hospitalQuery) : Promise.resolve(null)
    ]);

    const userData = (results[0] && results[0].data) || {};
    const hospitalData = (results[1] && results[1].data) || {};
    let mergedUser = 0, mergedHospital = 0, skippedUserOperational = 0, skippedByPage = 0;
    const safeWrite = _origSetItem || localStorage.setItem.bind(localStorage);

    function mergeOne(key, value, fromHospital) {
      const nk = normalizeKey(key);
      if (ATTENDANCE_PAGE_KEYS.has(nk)) { skippedByPage++; return; }
      if (fromHospital && PERSONAL_KEYS.has(nk)) return;
      if (!fromHospital && hospitalName && !PERSONAL_KEYS.has(nk)) { skippedUserOperational++; return; }
      if (!shouldMergePulledKeyForCurrentPage(nk)) { skippedByPage++; return; }
      try { safeWrite(nk, value); fromHospital ? mergedHospital++ : mergedUser++; } catch (_) {}
    }

    Object.entries(userData).forEach(([k, v]) => mergeOne(k, v, false));
    Object.entries(hospitalData).forEach(([k, v]) => mergeOne(k, v, true));

    console.log('[MzamanaCloud] PULL ✓' + (reviewOnly ? ' [مراجعة]' : '') +
      ' ' + mergedUser + ' شخصي + ' + mergedHospital + ' مشترك' +
      (skippedUserOperational ? ' · ' + skippedUserOperational + ' تشغيلي شخصي' : '') +
      (skippedByPage ? ' · ' + skippedByPage + ' خارج نطاق الصفحة' : '')
    );

    try { window.dispatchEvent(new CustomEvent('najranCloudPulled', { detail: { monthChanged: false } })); } catch (_) {}
    try { if (typeof window.updateContractDisplayData === 'function') window.updateContractDisplayData(); } catch (_) {}
    try { if (typeof window.updateContractDataForPrint === 'function') window.updateContractDataForPrint(); } catch (_) {}
  }

  function splitObjectIntoChunks(obj, chunkSize) {
    const entries = Object.entries(obj || {});
    const chunks = [];
    for (let i = 0; i < entries.length; i += chunkSize) chunks.push(Object.fromEntries(entries.slice(i, i + chunkSize)));
    return chunks;
  }

  async function putStorageInBatches(path, data, batchSize) {
    const chunks = splitObjectIntoChunks(data, batchSize);
    let saved = 0;
    if (!chunks.length) return { saved:0 };
    for (const chunk of chunks) {
      const result = await apiFetch(path, { method:'PUT', body:JSON.stringify({ data:chunk }) });
      if (!result) return null;
      saved += result.saved || Object.keys(chunk).length || 0;
    }
    return { saved };
  }

  async function filterUnsafeHospitalWrites(hospitalData) {
    const keys = Object.keys(hospitalData || {});
    if (!keys.length) return hospitalData;
    const protectedKeys = keys.filter(shouldProtectFromEmptyOverwrite);
    if (!protectedKeys.length) return hospitalData;
    const remote = await apiFetch('/hospital-storage');
    if (!remote) {
      const safe = {};
      keys.forEach(key => { if (!shouldProtectFromEmptyOverwrite(key)) safe[key] = hospitalData[key]; });
      console.warn('[MzamanaCloud] BLOCKED protected keys — remote unavailable');
      return safe;
    }
    const remoteData = remote.data || {};
    const safe = {};
    let skipped = 0;
    keys.forEach(key => {
      const newValue = hospitalData[key];
      const oldValue = remoteData[key];
      if (isUnsafeEmptyOverwrite(key, newValue, oldValue)) { skipped++; return; }
      safe[key] = newValue;
    });
    if (skipped) console.warn('[MzamanaCloud] SKIP EMPTY OVERWRITE — ' + skipped + ' مفتاح');
    return safe;
  }

  async function pushToCloud(options) {
  options = options || {};

  if (isRevisionMode() && options.includeOperational !== true) {
    console.warn('[MzamanaCloud] REVISION MODE: تم منع Push تلقائي أثناء تعديل مستخلص قديم');
    DIRTY_KEYS.clear();
    return { ok: true, saved: 0, reason: 'REVISION_MODE_NO_AUTO_PUSH' };
  }

  const includeOperational = options.includeOperational === true;
    if (!getSession()) throw new Error('NO_SESSION');
    if (isReviewOnlySession()) {
      console.warn('[MzamanaCloud] REVIEW ONLY: ممنوع الرفع');
      DIRTY_KEYS.clear();
      return { ok:true, saved:0, readonly:true, reason:'REVIEW_ONLY_NO_UPLOAD' };
    }

    const hospitalName = getHospitalName();
    const userData = {}, hospitalData = {};
    const adminSession = isAdminSession();
    let skippedAdminAttendance = 0;
    let skippedOperationalAuto = 0;

    const keysToSync = Array.from(DIRTY_KEYS).filter(function(k){
      if (!k || !shouldSyncKey(k)) return false;
      if (!includeOperational && isOperationalKey(k)) { skippedOperationalAuto++; return false; }
      return true;
    });

    if (!keysToSync.length) {
      if (skippedOperationalAuto) console.log('[MzamanaCloud] AUTO SKIP operational dirty keys: ' + skippedOperationalAuto);
      return { ok:true, saved:0, reason: skippedOperationalAuto ? 'AUTO_SKIPPED_OPERATIONAL' : 'NO_LOCAL_CHANGES' };
    }

    keysToSync.forEach(function(key){
      const nk = normalizeKey(key);
      const s = getSession();
      const canAdminEditAttendance = s && (s.canEditAttendance === true || s.attendanceEditor === true || s.role === 'attendance_editor');
      if (adminSession && ATTENDANCE_PAGE_KEYS.has(nk) && !canAdminEditAttendance) { skippedAdminAttendance++; return; }
      const val = localStorage.getItem(nk);
      if (val === null) return;
      if (PERSONAL_KEYS.has(nk) || !hospitalName) userData[nk] = val;
      else hospitalData[nk] = val;
    });

    if (skippedAdminAttendance) {
      keysToSync.forEach(k => { if (ATTENDANCE_PAGE_KEYS.has(normalizeKey(k))) DIRTY_KEYS.delete(k); });
    }

    const safeHospitalData = hospitalName ? await filterUnsafeHospitalWrites(hospitalData) : {};
    const mustSaveUser = Object.keys(userData).length > 0;
    const mustSaveHospital = !!hospitalName && Object.keys(safeHospitalData).length > 0;
    if (!mustSaveUser && !mustSaveHospital) return { ok:true, saved:0, reason:'NOTHING_TO_SAVE' };

    console.log('[MzamanaCloud] PUSH →', includeOperational ? '[صريح]' : '[خفيف تلقائي]', hospitalName || 'user_storage', 'user=' + Object.keys(userData).length, 'hospital=' + Object.keys(safeHospitalData).length);
    const results = await Promise.all([
      mustSaveUser ? putStorageInBatches('/storage', userData, 300) : Promise.resolve({ saved:0 }),
      mustSaveHospital ? putStorageInBatches('/hospital-storage', safeHospitalData, 300) : Promise.resolve({ saved:0 })
    ]);
    if (mustSaveUser && !results[0]) throw new Error('USER_STORAGE_SAVE_FAILED');
    if (mustSaveHospital && !results[1]) throw new Error('HOSPITAL_STORAGE_SAVE_FAILED');

    const userSaved = (results[0] && results[0].saved) || 0;
    const hospitalSaved = (results[1] && results[1].saved) || 0;
    keysToSync.forEach(k => DIRTY_KEYS.delete(k));
    console.log('[MzamanaCloud] PUSH ✓ ' + userSaved + ' شخصي' + (hospitalSaved ? ' + ' + hospitalSaved + ' مشترك' : ''));
    return { ok:true, userSaved, hospitalSaved, hospitalName: hospitalName || null, explicit: includeOperational };
  }

  function showSyncStatus(status) {
    if (typeof window.najranSetSyncStatus === 'function') { window.najranSetSyncStatus(status); return; }
    const bar = document.getElementById('najran-auth-bar');
    if (!bar) return;
    if (!syncIndicator) {
      syncIndicator = document.createElement('span');
      syncIndicator.style.cssText = 'margin-right:12px;font-size:11px;opacity:.8;';
      bar.appendChild(syncIndicator);
    }
    syncIndicator.textContent = status === 'syncing' ? '⟳ جاري الحفظ...' : status === 'done' ? '✓ محفوظ' : status === 'error' ? '⚠ فشل الحفظ' : '☁ مزامنة';
    if (status === 'done') setTimeout(function(){ if (syncIndicator) syncIndicator.textContent = '☁ مزامنة'; }, 2000);
  }

  async function syncNow(options) {
    options = options || {};
    if (syncInProgress) return { ok:true, skipped:true, reason:'SYNC_ALREADY_RUNNING' };
    syncInProgress = true;
    showSyncStatus('syncing');
    try {
      const result = await pushToCloud({ includeOperational: options.includeOperational === true });
      showSyncStatus('done');
      return result || { ok:true };
    } catch (err) {
      console.error('[MzamanaCloud] فشل الرفع:', err);
      showSyncStatus('error');
      throw err;
    } finally {
      syncInProgress = false;
    }
  }

  window.najranSyncNow = function(){ return syncNow({ includeOperational:true }); };
  window.najranSyncSettingsNow = function(){ return syncNow({ includeOperational:false }); };
  window.najranPullFromCloud = pullFromCloud;
  window.najranGetDirtyKeys = function(){ return Array.from(DIRTY_KEYS); };

  try {
    if (window.parent && window.parent !== window) {
      window.parent.najranSyncNow = window.najranSyncNow;
      window.parent.najranSyncSettingsNow = window.najranSyncSettingsNow;
      window.parent.najranPullFromCloud = pullFromCloud;
    }
  } catch (_) {}

  async function init() {
    forceReviewOnlyBeforeInit();
    const session = getSession();
    if (!session) return;
    const hospitalName = getHospitalName();
    const reviewOnly = isReviewOnlySession();
    _origSetItem = localStorage.setItem.bind(localStorage);

    ensureHospitalContextClean();

    if (reviewOnly) console.log('[MzamanaCloud] وضع المراجعة [قراءة فقط]: «' + (hospitalName || '—') + '»');
    else if (hospitalName) console.log('[MzamanaCloud] وضع المشاركة المحلي أولاً: «' + hospitalName + '»');
    else console.log('[MzamanaCloud] وضع شخصي');

    let pulling = false;
    async function pullSafe() {
      if (pulling) return;
      pulling = true;
      isApplyingCloudPull = true;
      try { await pullFromCloud(); }
      finally { pulling = false; isApplyingCloudPull = false; }
    }
    window.najranPullFromCloud = pullSafe;

    await pullSafe();
    showHospitalActivityNotice();

    if (!reviewOnly) {
      updateHospitalActivityStatus();
      setInterval(function(){
        if (DIRTY_KEYS.size > 0) syncNow({ includeOperational:false }).catch(function(){});
      }, SETTINGS_AUTO_SYNC_MS);
      window.addEventListener('beforeunload', function(){
        if (DIRTY_KEYS.size > 0) pushToCloud({ includeOperational:false }).catch(function(){});
      });
    } else {
      console.warn('[MzamanaCloud] REVIEW ONLY: الرفع والتحديث الدوري معطّلان');
    }

    let debounce = null;
    function scheduleLightSync() {
      if (isReviewOnlySession()) { DIRTY_KEYS.clear(); return; }
      clearTimeout(debounce);
      updateHospitalActivityStatus();
      debounce = setTimeout(function(){ syncNow({ includeOperational:false }).catch(function(){}); }, 45000);
    }
    if (!reviewOnly) {
      document.addEventListener('input', scheduleLightSync);
      document.addEventListener('change', scheduleLightSync);
    }

    localStorage.setItem = function(key, value) {
      const oldValue = localStorage.getItem(key);
      _origSetItem(key, value);
      if (oldValue === value) return;
      if (isApplyingCloudPull) return;
      if (isReviewOnlySession()) { DIRTY_KEYS.clear(); return; }
      const nk = normalizeKey(key);
      if (!shouldSyncKey(nk)) return;
      DIRTY_KEYS.add(nk);
      if (shouldAutoSyncKey(nk)) {
        clearTimeout(localStorage._syncTimeout);
        localStorage._syncTimeout = setTimeout(function(){ syncNow({ includeOperational:false }).catch(function(){}); }, 45000);
      } else {
        console.log('[MzamanaCloud] LOCAL-FIRST: تم تعليم مفتاح تشغيلي بدون رفع تلقائي — ' + nk);
      }
    };

    console.log('[MzamanaCloud] ✓ V8 Local-first' + (reviewOnly ? ' [مراجعة]' : '') + ' — جاهز');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
