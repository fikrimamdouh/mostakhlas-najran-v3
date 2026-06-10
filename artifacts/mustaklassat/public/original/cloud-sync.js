/**
 * cloud-sync.js — مزامنة سحابية للبيانات (V2 — مشاركة بيانات المستشفى)
 * القاعدة الحاسمة:
 * - عند وجود مستشفى في الجلسة: التشغيل يُسحب من hospital_storage فقط.
 * - user_storage يُستخدم للمفاتيح الشخصية فقط مثل backupLogs.
 * هذا يمنع تكرار نفس حضور حساب المدير داخل أكثر من مستشفى.
 */
(function () {
  'use strict';

  const API_BASE = '/api';
  const SESSION_KEY = 'najran_session';
  const SYNC_INTERVAL_MS = 15000;
  const DIRTY_KEYS = new Set();

  const SYNC_KEYS = [
    'persistentContractData','persistentExtractData','contractData','contractDetails','contractNumber','contractType','contractStartDate','contractEndDate','contractSignatureData',
    'extractMonth','extractYear','extractNumber','extractStart','extractEnd','extractFromDate','extractToDate','paymentNumber',
    'attendanceData','centersAttendanceData_v2','healthCentersAttendanceData','adminOfficesAttendanceData_v1',
    'ng_attendanceData','ng_departmentNames','ng_distributionSettings','ng_finalLaborCost','ng_performanceTotalDeduction',
    'nd_attendanceData','nd_departmentNames','nd_distributionSettings','nd_finalLaborCost','nd_performanceTotalDeduction','nd_dentalAchievementTotals',
    'consumablesTableData','healthCentersConsumables','mainHospitalConsumables','admin_offices_consumables_v1.0','consumablesTitle','consumablesPeriodFrom','consumablesPeriodTo','finalConsumablesCost',
    'subcontractors_data_consumables_v27','performance_data_consumables_v27','water_supply_data_consumables_v27','sewage_disposal_data_consumables_v27','summary_data_consumables_v27',
    'spare_partsData','sparePartsTotalAmount','approvalData','displayApprovalData','performanceData','performanceData_v4','performanceDeductions','achievementData','achievementTitles_v1','achievementItemNames',
    'centerNames_v3','departmentNames','distributionSettings','hospitalName','companyName','directPurchaseRatio','hospitalActivityStatus','hospitalActivityStatus_v2',
    'admin_staff','dynamicSignatures','contractorSignature','appTitles_v1','healthCentersData','reviewExtractData','requestVisitData',
    'settings_main','settings_advanced','finalLaborCost','performanceTotalDeduction','grand-net-total','grand-net-total-centers','grand-net-total-admin',
    'performanceSignatures','performanceSignatures_v2','performanceTableNames','najran_labor_attendance_done','najran_labor_performance_done','najran_health_attendance_done','najran_admin_offices_attendance_done',
    'adminOfficeNames_v1','adminOfficeAffiliations_v1','contract_foundation_data','backupLog','backupLogs'
  ];

  const PERSONAL_KEYS = new Set(['backupLog','backupLogs']);
  const COMPUTED_KEYS = new Set(['finalLaborCost','grand-net-total','grand-net-total-centers','grand-net-total-admin','performanceTotalDeduction']);

  const ATTENDANCE_PAGE_KEYS = new Set([
    'attendanceData',
    'ng_attendanceData',
    'nd_attendanceData',
    'centersAttendanceData_v2',
    'healthCentersAttendanceData',
    'adminOfficesAttendanceData_v1'
  ]);





  // مفاتيح ممنوع رفع نسخة فاضية فوق نسخة موجودة لها محتوى
  const EMPTY_OVERWRITE_PROTECTED_KEYS = new Set([
    'attendanceData',
    'ng_attendanceData',
    'nd_attendanceData',
    'centersAttendanceData_v2',
    'healthCentersAttendanceData',
    'adminOfficesAttendanceData_v1',
    'performanceData',
    'performanceData_v4',
    'performanceDeductions',
    'achievementData',
    'consumablesTableData',
    'healthCentersConsumables',
    'mainHospitalConsumables',
    'admin_offices_consumables_v1.0',
    'spare_partsData'
  ]);

  function shouldProtectFromEmptyOverwrite(key) {
    const nk = normalizeKey(key);
    return EMPTY_OVERWRITE_PROTECTED_KEYS.has(nk) ||
      nk.startsWith('dept_') ||
      nk.startsWith('deptCalculatedCost_') ||
      nk.startsWith('tableData_') ||
      nk.startsWith('achievement_') ||
      nk.startsWith('consumables_') ||
      nk.startsWith('spare_') ||
      nk.startsWith('water_') ||
      nk.startsWith('sewage_') ||
      nk.startsWith('subcontractors_');
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

  function isUnsafeEmptyOverwrite(key, newValue, oldValue) {
    if (!shouldProtectFromEmptyOverwrite(key)) return false;
    if (oldValue == null) return false;
    const oldScore = contentScoreForKey(key, oldValue);
    const newScore = contentScoreForKey(key, newValue);
    return oldScore > 0 && newScore === 0;
  }

  async function filterUnsafeHospitalWrites(hospitalData) {
    const keys = Object.keys(hospitalData || {});
    if (!keys.length) return hospitalData;
    const protectedKeys = keys.filter(function(key){ return shouldProtectFromEmptyOverwrite(key); });
    if (!protectedKeys.length) return hospitalData;
    const remote = await apiFetch('/hospital-storage');
    const remoteData = (remote && remote.data) || {};
    const safe = {};
    let skipped = 0;
    keys.forEach(key => {
      const newValue = hospitalData[key];
      const oldValue = remoteData[key];
      if (isUnsafeEmptyOverwrite(key, newValue, oldValue)) {
        skipped++;
        console.warn('[MzamanaCloud] SKIP EMPTY OVERWRITE:', key, 'تم منع رفع قيمة فاضية فوق بيانات موجودة على السيرفر');
        return;
      }
      safe[key] = newValue;
    });
    if (skipped) console.warn('[MzamanaCloud] SKIP EMPTY OVERWRITE — تم تجاهل ' + skipped + ' مفتاح لحماية بيانات السيرفر');
    return safe;
  }

  const SETTINGS_PAGE_KEYS = new Set([
    'persistentContractData','persistentExtractData','contractData','contractDetails','contractNumber','contractType','contractStartDate','contractEndDate','contractSignatureData',
    'extractMonth','extractYear','extractNumber','extractStart','extractEnd','extractFromDate','extractToDate','paymentNumber','hospitalName','companyName','directPurchaseRatio',
    'settings_main','settings_advanced','dynamicSignatures','contractorSignature','appTitles_v1','admin_staff','contract_foundation_data'
  ]);

function normalizeKey(key) {
  return String(key || '').replace(/^(_u\d+_)+/, '');
}

function getCurrentPageFile() {
  return window.location.pathname.split('/').pop() || '';
}
  function isSettingsMainPage() { return getCurrentPageFile() === 'settings_main.html'; }
  function isAttendancePage() {
    const f = getCurrentPageFile();
    return f === 'attendance.html' || f === 'health_centers_attendance.html' || f === 'admin_offices_attendance.html';
  }
  function isAdminSession() {
    const s = getSession();
    const role = String((s && s.role) || '').toLowerCase();
    return role === 'admin' || role === 'super_admin' || role === 'administrator';
  }
function shouldMergePulledKeyForCurrentPage(key) {
  const nk = normalizeKey(key);
  if (!isSettingsMainPage()) return true;
  return SETTINGS_PAGE_KEYS.has(nk);
}
  function shouldSyncKey(key) {
    const nk = normalizeKey(key);
    return SYNC_KEYS.includes(nk) ||
      nk.startsWith('deptCalculatedCost_') || nk.startsWith('dept_') || nk.startsWith('sb_sigs_') || nk.startsWith('sb_prefs_') || nk.startsWith('tableData_') ||
      nk.startsWith('achievement_') || nk.startsWith('consumables_') || nk.startsWith('spare_') || nk.startsWith('water_') ||
      nk.startsWith('sewage_') || nk.startsWith('subcontractors_') || nk.startsWith('najran_labor_') || nk.startsWith('najran_health_') ||
      nk.startsWith('najran_admin_') || nk.includes('finalLaborCost') || nk.includes('grand-net-total');
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
  function clearOperationalKeysForHospitalSwitch() {
  const keepKeys = new Set([
    SESSION_KEY,
    'hospitalName',
    'companyName',
    'contractNumber',
    'sidebar_collapsed',
    'najran_read_notifications'
  ]);

  const clearPrefixes = [
    'deptCalculatedCost_',
    'dept_',
    'sb_sigs_',
    'sb_prefs_',
    'tableData_',
    'achievement_',
    'consumables_',
    'spare_',
    'water_',
    'sewage_',
    'subcontractors_',
    'najran_labor_',
    'najran_health_',
    'najran_admin_',
    'monthSnapshot_',
    '_u'
  ];

  const clearKeys = [
    'persistentContractData',
    'persistentExtractData',
    'contractData',
    'contractDetails',
    'contractType',
    'contractStartDate',
    'contractEndDate',
    'contractSignatureData',
    'extractMonth',
    'extractYear',
    'extractNumber',
    'extractStart',
    'extractEnd',
    'extractFromDate',
    'extractToDate',
    'paymentNumber',
    'attendanceData',
    'centersAttendanceData_v2',
    'healthCentersAttendanceData',
    'adminOfficesAttendanceData_v1',
    'ng_attendanceData',
    'ng_departmentNames',
    'ng_distributionSettings',
    'ng_finalLaborCost',
    'ng_performanceTotalDeduction',
    'nd_attendanceData',
    'nd_departmentNames',
    'nd_distributionSettings',
    'nd_finalLaborCost',
    'nd_performanceTotalDeduction',
    'nd_dentalAchievementTotals',
    'consumablesTableData',
    'healthCentersConsumables',
    'mainHospitalConsumables',
    'admin_offices_consumables_v1.0',
    'consumablesTitle',
    'consumablesPeriodFrom',
    'consumablesPeriodTo',
    'finalConsumablesCost',
    'subcontractors_data_consumables_v27',
    'performance_data_consumables_v27',
    'water_supply_data_consumables_v27',
    'sewage_disposal_data_consumables_v27',
    'summary_data_consumables_v27',
    'spare_partsData',
    'sparePartsTotalAmount',
    'approvalData',
    'displayApprovalData',
    'performanceData',
    'performanceData_v4',
    'performanceDeductions',
    'achievementData',
    'achievementTitles_v1',
    'achievementItemNames',
    'centerNames_v3',
    'departmentNames',
    'distributionSettings',
    'hospitalActivityStatus',
    'hospitalActivityStatus_v2',
    'admin_staff',
    'dynamicSignatures',
    'contractorSignature',
    'appTitles_v1',
    'healthCentersData',
    'reviewExtractData',
    'requestVisitData',
    'settings_main',
    'settings_advanced',
    'finalLaborCost',
    'performanceTotalDeduction',
    'grand-net-total',
    'grand-net-total-centers',
    'grand-net-total-admin',
    'performanceSignatures',
    'performanceSignatures_v2',
    'performanceTableNames',
    'adminOfficeNames_v1',
    'adminOfficeAffiliations_v1',
    'contract_foundation_data'
  ];

  clearKeys.forEach(function(key) {
    if (!keepKeys.has(key)) localStorage.removeItem(key);
  });

  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (!key || keepKeys.has(key)) continue;
    if (clearPrefixes.some(function(prefix) { return key.indexOf(prefix) === 0; })) {
      localStorage.removeItem(key);
    }
  }
}

function isReviewOnlySession() {
  const s = getSession();
  return !!(s && s.reviewOnly === true);
}

function ensureHospitalContextClean() {
  const hospitalName = getHospitalName();
  if (!hospitalName) return;

  const ctxKey = 'najran_active_hospital_context';
  const prev = localStorage.getItem(ctxKey);
  const reviewOnly = isReviewOnlySession();

  const mustClean =
    reviewOnly ||
    (prev && prev !== hospitalName);

  if (mustClean) {
    console.warn('[MzamanaCloud] تنظيف بيانات المتصفح قبل سحب بيانات المستشفى: «' + hospitalName + '»');
    clearOperationalKeysForHospitalSwitch();
  }

  localStorage.setItem(ctxKey, hospitalName);
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
    if (!token) {
      console.warn('[MzamanaCloud] لا يوجد clerkToken صالح — تم إيقاف طلب المزامنة داخلياً');
      return null;
    }
    try {
      const headers = Object.assign({'Content-Type':'application/json'}, (options && options.headers) || {}, { Authorization:'Bearer ' + token });
      const resp = await fetch(API_BASE + path, Object.assign({}, options || {}, { headers, credentials:'include' }));
      if (resp.status === 401) {
        console.warn('[MzamanaCloud] رفض التوثيق 401 — سيتم التعامل معه داخلياً');
        return null;
      }
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
      'attendance.html':'الحضور والانصراف','performance.html':'شهادة الأداء','achievement.html':'شهادة الإنجاز','consumables.html':'مستخلص المستهلكات','spare_parts.html':'مستخلص قطع الغيار','settings_main.html':'الإعدادات الرئيسية','approval.html':'اعتماد المستخلص','review_extract.html':'مراجعة المستخلص','monthly-overview.html':'النظرة الشاملة','health_centers_attendance.html':'حضور المراكز الصحية','health_centers_consumables.html':'مستهلكات المراكز الصحية','admin_offices_attendance.html':'حضور المكاتب الإدارية','admin_offices_consumables.html':'مستهلكات المكاتب الإدارية'
    };
    return map[file] || document.title || file || 'صفحة غير محددة';
  }
  function updateHospitalActivityStatus() {
    try {
      const s = getSession();
      if (!s || !s.hospital) return;
      const meta = readExtractMeta();
      localStorage.setItem('hospitalActivityStatus', JSON.stringify({
        userId: s.userId || '', userName: s.name || s.email || 'مستخدم', hospital: s.hospital,
        page: getCurrentPageLabel(), pageFile: getCurrentPageFile(), month: meta.month, year: meta.year,
        extractNumber: meta.extractNumber, updatedAt: new Date().toISOString()
      }));
      DIRTY_KEYS.add('hospitalActivityStatus');
    } catch (_) {}
  }
  function showHospitalActivityNotice() {
    try {
      const raw = localStorage.getItem('hospitalActivityStatus');
      if (!raw) return;
      const activity = JSON.parse(raw);
      const s = getSession();
      if (!activity || !s || activity.userId === s.userId) return;
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
    let mergedUser = 0;
    let mergedHospital = 0;
    let skippedUserOperational = 0;
    let skippedByPage = 0;

    function mergeOne(key, value, fromHospital) {
      const nk = normalizeKey(key);
      if (fromHospital && PERSONAL_KEYS.has(nk)) return;
      if (!fromHospital && hospitalName && !PERSONAL_KEYS.has(nk)) { skippedUserOperational++; return; }
      if (!shouldMergePulledKeyForCurrentPage(nk)) { skippedByPage++; return; }
      if (COMPUTED_KEYS.has(nk)) {
        const local = localStorage.getItem(nk);
        if (local !== null && parseFloat(local) > parseFloat(value)) return;
      }
      try { localStorage.setItem(nk, value); fromHospital ? mergedHospital++ : mergedUser++; } catch (_) {}
    }

    Object.entries(userData).forEach(([k,v]) => mergeOne(k, v, false));
    Object.entries(hospitalData).forEach(([k,v]) => mergeOne(k, v, true));

    const hosp = hospitalName ? ' + ' + Object.keys(hospitalData).length + ' مفتاح مستشفى مشترك' : '';
    const skippedUser = skippedUserOperational ? ' · تم تجاهل ' + skippedUserOperational + ' مفتاح شخصي تشغيلي لمنع خلط المستشفيات' : '';
    const skipped = skippedByPage ? ' · تم تجاهل ' + skippedByPage + ' مفتاح غير مطلوب لهذه الصفحة' : '';
    console.log('[MzamanaCloud] SERVER-FIRST PULL → ' + (hospitalName || 'بدون مستشفى'));
    console.log('[MzamanaCloud] ✓ ' + mergedUser + ' مفتاح شخصي + ' + mergedHospital + ' مفتاح مشترك مدمج' + hosp + skippedUser + skipped);
    try { window.dispatchEvent(new CustomEvent('najranCloudPulled', { detail: { monthChanged:false } })); } catch (_) {}
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
  async function pushToCloud() {
    if (!getSession()) throw new Error('NO_SESSION');
    if (isReviewOnlySession()) {
  console.warn('[MzamanaCloud] REVIEW ONLY: تم منع الرفع في وضع المراجعة');
  DIRTY_KEYS.clear();
  return { ok:true, saved:0, readonly:true, reason:'REVIEW_ONLY_NO_UPLOAD' };
}
    const hospitalName = getHospitalName();
    const userData = {};
    const hospitalData = {};
    const adminSession = isAdminSession();
    let skippedAdminAttendance = 0;
    const keysToSync = Array.from(DIRTY_KEYS).filter(k => k && shouldSyncKey(k));
    if (!keysToSync.length) return { ok:true, saved:0, reason:'NO_LOCAL_CHANGES' };
    keysToSync.forEach(function(key){
      const nk = normalizeKey(key);
      if (adminSession && ATTENDANCE_PAGE_KEYS.has(nk)) {
        skippedAdminAttendance++;
        return;
      }
      const val = localStorage.getItem(nk);
      if (val === null) return;
      if (PERSONAL_KEYS.has(nk) || !hospitalName) userData[nk] = val;
      else hospitalData[nk] = val;
    });
    if (skippedAdminAttendance) {
      console.warn('[MzamanaCloud] ADMIN READ-ONLY: تم منع رفع ' + skippedAdminAttendance + ' مفتاح حضور من حساب الأدمن إلى hospital_storage');
      keysToSync.forEach(function(k){
        if (ATTENDANCE_PAGE_KEYS.has(normalizeKey(k))) DIRTY_KEYS.delete(k);
      });
    }
    const safeHospitalData = hospitalName ? await filterUnsafeHospitalWrites(hospitalData) : {};

    const mustSaveUser = Object.keys(userData).length > 0;
    const mustSaveHospital = !!hospitalName && Object.keys(safeHospitalData).length > 0;

    if (!mustSaveUser && !mustSaveHospital) {
      return { ok:true, saved:0, reason:'NO_DATA_OR_EMPTY_OVERWRITE_SKIPPED' };
    }

    console.log('[MzamanaCloud] SERVER-FIRST SAVE →', hospitalName || 'user_storage', 'userKeys=' + Object.keys(userData).length, 'hospitalKeys=' + Object.keys(safeHospitalData).length);

    const results = await Promise.all([
      mustSaveUser ? putStorageInBatches('/storage', userData, 300) : Promise.resolve({ saved:0 }),
      mustSaveHospital ? putStorageInBatches('/hospital-storage', safeHospitalData, 300) : Promise.resolve({ saved:0 })
    ]);
    if (mustSaveUser && !results[0]) throw new Error('USER_STORAGE_SAVE_FAILED');
    if (mustSaveHospital && !results[1]) throw new Error('HOSPITAL_STORAGE_SAVE_FAILED');
    const userSaved = (results[0] && results[0].saved) || 0;
    const hospitalSaved = (results[1] && results[1].saved) || 0;
    keysToSync.forEach(k => DIRTY_KEYS.delete(k));
    const hosp = hospitalSaved ? ' + ' + hospitalSaved + ' مشترك' : '';
    console.log('[MzamanaCloud] ✓ رُفع ' + userSaved + ' شخصي' + hosp);
    return { ok:true, userSaved, hospitalSaved, hospitalName:hospitalName || null };
  }

  let syncIndicator = null;
  let syncInProgress = false;

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
  async function syncNow() {
    if (syncInProgress) return { ok:true, skipped:true, reason:'SYNC_ALREADY_RUNNING' };
    syncInProgress = true;
    showSyncStatus('syncing');
    try {
      const result = await pushToCloud();
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

  window.najranSyncNow = syncNow;
  window.najranPullFromCloud = pullFromCloud;
  try {
    if (window.parent && window.parent !== window) {
      window.parent.najranSyncNow = syncNow;
      window.parent.najranPullFromCloud = pullFromCloud;
    }
  } catch (_) {}

  async function init() {
    const session = getSession();
    if (!session) return;
 const hospitalName = getHospitalName();
ensureHospitalContextClean();

if (hospitalName) console.log('[MzamanaCloud] وضع المشاركة: مستشفى «' + hospitalName + '»');
else console.log('[MzamanaCloud] وضع شخصي (لا يوجد مستشفى مرتبط)');
    let pulling = false;
    async function pullSafe() {
      if (pulling) return;
      pulling = true;
      try { await pullFromCloud(); } finally { pulling = false; }
    }
    window.najranPullFromCloud = pullSafe;

  await pullSafe();
showHospitalActivityNotice();
updateHospitalActivityStatus();
syncNow().catch(function(){});
    setInterval(function(){ syncNow().catch(function(){}); }, SYNC_INTERVAL_MS);
    window.addEventListener('beforeunload', function(){ updateHospitalActivityStatus(); pushToCloud().catch(function(){}); });

    let debounce = null;
    function scheduleSync() {
      clearTimeout(debounce);
      updateHospitalActivityStatus();
      debounce = setTimeout(function(){ syncNow().catch(function(){}); }, 2000);
    }
    document.addEventListener('input', scheduleSync);
    document.addEventListener('change', scheduleSync);

    const origSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(key, value) {
      origSetItem(key, value);
      if (!pulling && shouldSyncKey(key)) {
        DIRTY_KEYS.add(normalizeKey(key));
        clearTimeout(localStorage._syncTimeout);
        localStorage._syncTimeout = setTimeout(function(){ syncNow().catch(function(){}); }, 2000);
      }
    };

    console.log('[MzamanaCloud] تم تهيئة المزامنة السحابية (V2 — مشاركة بيانات المستشفى)');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
