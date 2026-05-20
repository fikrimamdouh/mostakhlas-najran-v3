/**
 * cloud-sync.js — مزامنة سحابية للبيانات (V2 — مشاركة بيانات المستشفى)
 *
 * الآلية:
 * — كل مفاتيح البيانات التشغيلية تُخزّن على مستوى المستشفى (hospital_storage)
 *   → أي مستخدم من نفس المستشفى يرى نفس البيانات ويكتب في نفس المكان
 * — المفاتيح الشخصية (سجل النسخ) تبقى خاصة بالمستخدم (user_storage)
 * — المستخدمون بدون مستشفى (أدمن/مشرف) يستخدمون user_storage فقط
 */
(function () {
  'use strict';

  const API_BASE = '/api';
  const SYNC_INTERVAL_MS = 5 * 1000;
  const SESSION_KEY = 'najran_session';

  // ── المفاتيح التشغيلية (مشتركة على مستوى المستشفى) ──────────────────────
  const SYNC_KEYS = [
    'persistentContractData', 'persistentExtractData',
    'contractData', 'contractDetails', 'contractNumber', 'contractType',
    'contractStartDate', 'contractEndDate', 'contractSignatureData',
    'extractMonth', 'extractYear', 'extractNumber', 'extractStart', 'extractEnd',
    'extractFromDate', 'extractToDate',
    'attendanceData', 'centersAttendanceData_v2', 'healthCentersAttendanceData',
    'consumablesTableData', 'healthCentersConsumables', 'mainHospitalConsumables',
    'consumablesTitle', 'consumablesPeriodFrom', 'consumablesPeriodTo',
    'spare_partsData', 'approvalData', 'displayApprovalData',
    'performanceData', 'achievementData', 'achievementTitles_v1',
    'centerNames_v3', 'departmentNames', 'distributionSettings',
    'hospitalName', 'companyName', 'directPurchaseRatio',
    'admin_staff', 'dynamicSignatures', 'contractorSignature',
    'appTitles_v1', 'healthCentersData', 'reviewExtractData', 'requestVisitData',
    'settings_main', 'settings_advanced',
    'finalLaborCost', 'performanceTotalDeduction', 'grand-net-total',
    'performanceSignatures', 'performanceSignatures_v2', 'performanceTableNames',
    'najran_labor_attendance_done', 'najran_labor_performance_done',
    'najran_health_attendance_done', 'najran_admin_offices_attendance_done',
    'adminOfficeNames_v1', 'adminOfficesAttendanceData_v1',
    'admin_offices_consumables_v1.0',
    'finalConsumablesCost',
'adminOfficeAffiliations_v1',
'performance_data_consumables_v27',
'sewage_disposal_data_consumables_v27',
'subcontractors_data_consumables_v27',
'water_supply_data_consumables_v27',
    // بيانات التأسيسي (عقود الباطن + المستهلكات) — يرفعها الأدمن وتُوزَّع على كل مستخدمي المستشفى
    'contract_foundation_data',
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
    // مفاتيح شخصية تبقى خاصة بالمستخدم
    'backupLog', 'backupLogs',
  ];

  // المفاتيح التي تبقى خاصة بالمستخدم (لا تُشارك مع زملاء المستشفى)
  const PERSONAL_KEYS = new Set(['backupLog', 'backupLogs']);

  // المفاتيح المحسوبة — لا تُكتب فوقها من السحابة إلا لو القيمة السحابية أكبر
  const COMPUTED_KEYS = new Set([
    'finalLaborCost', 'grand-net-total',
    'grand-net-total-centers', 'grand-net-total-admin',
    'performanceTotalDeduction',
  ]);

  // المفاتيح المحمية — لا تُكتب فوقها من السحابة إذا كان المحلي موجوداً
  // (البيانات تُدخَل بالرفع اليدوي للـ Excel ولا يجب أن تتغير تلقائياً)
  const PREFER_LOCAL_KEYS = new Set([
    'attendanceData',
    'centersAttendanceData_v2',
    'healthCentersAttendanceData',
    'adminOfficesAttendanceData_v1',
  ]);

  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (Date.now() - s.timestamp > 8 * 60 * 60 * 1000) return null;
      return s;
    } catch (_) { return null; }
  }

  function getFreshToken() {
  const s = getSession();
  return s?.clerkToken || null;
}

  // اسم مستشفى المستخدم من الجلسة
  function getHospitalName() {
    const s = getSession();
    return s?.hospital?.trim() || null;
  }

  async function apiFetch(path, options = {}) {
    if (!getSession()) return null;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      const token = getFreshToken();
      const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const resp = await fetch(API_BASE + path, {
        ...options,
        headers,
        credentials: 'include',
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (resp.status === 401) {
        showTokenExpiredBanner();
        return null;
      }
      return resp.ok ? resp.json() : null;
    } catch (_) { return null; }
  }

  // ── مفاتيح البيانات الشهرية ──────────────────────────────────────────────
  const MONTH_SPECIFIC_KEYS = [
    'attendanceData', 'centersAttendanceData_v2', 'healthCentersAttendanceData',
    'consumablesTableData', 'healthCentersConsumables', 'mainHospitalConsumables',
    'consumablesTitle', 'consumablesPeriodFrom', 'consumablesPeriodTo',
    'spare_partsData', 'performanceData', 'achievementData',
    'performanceSignatures', 'performanceSignatures_v2', 'performanceTableNames',
    'performanceTotalDeduction', 'finalLaborCost', 'grand-net-total', 'grand-net-total-centers', 'grand-net-total-admin',
    'najran_labor_attendance_done', 'najran_labor_performance_done',
    'najran_health_attendance_done', 'najran_admin_offices_attendance_done',
    'accreditationLetterData', 'adminJobsPrintState',
    'dentalLaborCheckboxState', 'dentalLaborData',
    'achievementItemNames', 'sparePartsTotalAmount',
    'dynamicSignatures',
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
  ];

  function getMonthKeyFromExtractData(raw) {
    try {
      const d = JSON.parse(raw || '{}');
      const month = (d.extractMonth || '').trim();
      const year = d.extractYear || '';
      return (month && year) ? `${year}_${month}` : null;
    } catch { return null; }
  }

  function showMonthAdvancedBanner(newMonthLabel) {
    if (document.getElementById('cloud-month-advanced-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'cloud-month-advanced-banner';
    banner.className = 'no-print';
    banner.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; z-index: 999999;
      background: linear-gradient(135deg,#15803d,#166534);
      color: white; text-align: center;
      padding: 14px 20px; font-size: 15px; font-weight: 700;
      font-family: Tajawal, Arial, sans-serif; direction: rtl;
      box-shadow: 0 3px 12px rgba(0,0,0,0.25);
      display: flex; align-items: center; justify-content: center; gap: 12px;
    `;
    banner.innerHTML = `
      <span style="font-size:20px">✅</span>
      <span>تم اعتماد المستخلص — تم فتح <strong>${newMonthLabel}</strong> تلقائياً · ابدأ بياناتك الجديدة</span>
      <button onclick="this.parentElement.remove()" style="
        background:rgba(255,255,255,0.25);border:none;color:white;
        border-radius:8px;padding:4px 12px;cursor:pointer;font-size:13px;font-family:inherit;margin-right:8px;
      ">✕ إغلاق</button>
    `;
    document.body.prepend(banner);
    setTimeout(() => { banner.remove(); }, 12000);
  }

  // ── سحب البيانات من السحابة ──────────────────────────────────────────────
  // الترتيب: بيانات المستخدم أولاً → بيانات المستشفى تتغلب عليها
  async function pullFromCloud() {
    const hospitalName = getHospitalName();

    // اجلب بيانات المستخدم وبيانات المستشفى معاً (بالتوازي)
    const [userResult, hospitalResult] = await Promise.all([
      apiFetch('/storage'),
      hospitalName ? apiFetch('/hospital-storage') : Promise.resolve(null),
    ]);

    const userData     = userResult?.data     || {};
    const hospitalData = hospitalResult?.data  || {};

    // كشف تغيير الشهر — نعتمد على بيانات المستشفى إن وُجدت وإلا بيانات المستخدم
    const cloudExtractData = hospitalData['persistentExtractData'] || userData['persistentExtractData'] || null;
    const oldMonthKey = getMonthKeyFromExtractData(localStorage.getItem('persistentExtractData'));
    const newMonthKey = getMonthKeyFromExtractData(cloudExtractData);
    const monthChanged = oldMonthKey && newMonthKey && oldMonthKey !== newMonthKey;

    if (monthChanged) {
      // حفظ snapshot للشهر القديم
      if (typeof window.saveMonthSnapshot === 'function') {
        window.saveMonthSnapshot(oldMonthKey);
      } else {
        try {
          const snap = {};
          MONTH_SPECIFIC_KEYS.forEach(k => { const v = localStorage.getItem(k); if (v !== null) snap[k] = v; });
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && (k.startsWith('deptCalculatedCost_') || k.startsWith('dept_'))) snap[k] = localStorage.getItem(k);
          }
          localStorage.setItem('monthSnapshot_' + oldMonthKey, JSON.stringify(snap));
        } catch (_) {}
      }
      console.log(`[MzamanaCloud] تغيّر الشهر: ${oldMonthKey} → ${newMonthKey}`);
    }

    // تطبيق بيانات المستخدم أولاً (الطبقة الأساسية)
    let merged = 0;
    for (const [key, value] of Object.entries(userData)) {
      try {
        if (COMPUTED_KEYS.has(key)) {
          const local = localStorage.getItem(key);
          if (local !== null && parseFloat(local) > parseFloat(value)) { merged++; continue; }
        }
        if (PREFER_LOCAL_KEYS.has(key)) {
          const local = localStorage.getItem(key);
          if (local !== null) { merged++; continue; }
        }
        localStorage.setItem(key, value); merged++;
      } catch (_) {}
    }

    // ثم تطبيق بيانات المستشفى (تتغلب على البيانات الشخصية للمفاتيح المشتركة)
    for (const [key, value] of Object.entries(hospitalData)) {
      if (!PERSONAL_KEYS.has(key)) {
        try {
          if (COMPUTED_KEYS.has(key)) {
            const local = localStorage.getItem(key);
            if (local !== null && parseFloat(local) > parseFloat(value)) continue;
          }
          if (PREFER_LOCAL_KEYS.has(key)) {
            const local = localStorage.getItem(key);
            if (local !== null) continue;
          }
          localStorage.setItem(key, value);
        } catch (_) {}
      }
    }

    if (monthChanged) {
      MONTH_SPECIFIC_KEYS.forEach(k => localStorage.removeItem(k));
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('deptCalculatedCost_') || k.startsWith('dept_'))) localStorage.removeItem(k);
      }
      const newLabel = newMonthKey.replace('_', ' — ');
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => showMonthAdvancedBanner(newLabel));
      } else {
        showMonthAdvancedBanner(newLabel);
      }
    }

    const hosp = hospitalName
      ? ` + ${Object.keys(hospitalData).length} مفتاح مستشفى مشترك`
      : '';
    console.log(`[MzamanaCloud] ✓ ${merged} مفتاح شخصي${hosp}`);

    try {
      window.dispatchEvent(new CustomEvent('najranCloudPulled', { detail: { monthChanged } }));
    } catch (_) {}

    try { if (typeof window.updateContractDisplayData === 'function') window.updateContractDisplayData(); } catch (_) {}
    try { if (typeof window.updateContractDataForPrint  === 'function') window.updateContractDataForPrint();  } catch (_) {}
  }

  // ── رفع البيانات إلى السحابة ─────────────────────────────────────────────
  // المفاتيح التشغيلية → hospital_storage (مشتركة مع زملاء المستشفى)
  // المفاتيح الشخصية  → user_storage فقط
  // كلاهما أيضاً في user_storage كنسخة احتياطية للتوافق
async function pushToCloud() {
  if (!getSession()) return;

  const hospitalName = getHospitalName();
  const allData = {};
  const hospitalData = {};

  function toSharedHospitalKey(key) {
    return key.replace(/^_u\d+_/, '');
  }

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;

    const shouldSync = SYNC_KEYS.some(k =>   key === k ||   key.endsWith(k) ||   key.includes(k) );

    const isPatternKey =
      key.includes('deptCalculatedCost_') ||
      key.includes('dept_') ||
      key.includes('sb_sigs_');

    if (!shouldSync && !isPatternKey) continue;

    const val = localStorage.getItem(key);
    if (val === null) continue;

    allData[key] = val;

    const baseKey = SYNC_KEYS.find(k => key === k || key.endsWith(k)) || key;
    const personalBaseKey = baseKey.replace(/^_u\d+_/, '');

    if (!PERSONAL_KEYS.has(personalBaseKey)) {
      const hospitalKey = toSharedHospitalKey(key);
      hospitalData[hospitalKey] = val;
    }
  }

  if (Object.keys(allData).length === 0) return;

  console.log('[DEBUG hospitalName]', hospitalName);
  console.log('[DEBUG allData count]', Object.keys(allData).length);
  console.log('[DEBUG hospitalData count]', Object.keys(hospitalData).length);
  console.log('[DEBUG hospitalData keys]', Object.keys(hospitalData));

  const [userResult, hospitalResult] = await Promise.all([
    apiFetch('/storage', {
      method: 'PUT',
      body: JSON.stringify({ data: allData })
    }),
    hospitalName && Object.keys(hospitalData).length > 0
      ? apiFetch('/hospital-storage', {
          method: 'PUT',
          body: JSON.stringify({ data: hospitalData })
        })
      : Promise.resolve(null),
  ]);

  if (userResult || hospitalResult) {
    const hosp = hospitalResult?.saved ? ` + ${hospitalResult.saved} مشترك` : '';
    console.log(`[MzamanaCloud] ✓ رُفع ${userResult?.saved ?? 0} شخصي${hosp}`);
  }
}

  // ── إشعارات المستخدم ──────────────────────────────────────────────────────
  function showTokenExpiredBanner() {
    if (document.getElementById('cloud-token-expired-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'cloud-token-expired-banner';
    banner.className = 'no-print';
    banner.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; z-index: 99999;
      background: #d97706; color: white; text-align: center;
      padding: 10px; font-size: 14px; font-family: Arial, sans-serif;
      direction: rtl; display: flex; align-items: center; justify-content: center; gap: 12px;
    `;
    banner.innerHTML = `
      <span>⚠️ انتهت صلاحية الجلسة — بياناتك محفوظة محلياً.</span>
      <a href="/dashboard" style="color:white;font-weight:bold;text-decoration:underline;">
        ← تجديد الجلسة
      </a>
      <button onclick="this.parentElement.remove()" style="
        background:rgba(255,255,255,0.25);border:none;color:white;
        border-radius:6px;padding:3px 10px;cursor:pointer;font-size:13px;font-family:inherit;
      ">✕</button>
    `;
    document.body.prepend(banner);
    setTimeout(() => { if (banner.parentElement) banner.remove(); }, 8000);
  }

  // ── مؤشر حالة المزامنة ───────────────────────────────────────────────────
  let syncIndicator = null;

  function showSyncStatus(status) {
    if (typeof window.najranSetSyncStatus === 'function') {
      window.najranSetSyncStatus(status);
      return;
    }
    const bar = document.getElementById('najran-auth-bar');
    if (!bar) return;
    if (!syncIndicator) {
      syncIndicator = document.createElement('span');
      syncIndicator.style.cssText = 'margin-right: 12px; font-size: 11px; opacity: 0.8;';
      bar.querySelector('.bar-right')?.prepend(syncIndicator);
    }
    if (status === 'syncing') {
      syncIndicator.textContent = '⟳ جاري الحفظ...';
    } else if (status === 'done') {
      syncIndicator.textContent = '✓ محفوظ';
      setTimeout(() => { if (syncIndicator) syncIndicator.textContent = '☁ مزامنة'; }, 2000);
    } else {
      syncIndicator.textContent = '☁ مزامنة';
    }
  }

  async function syncNow() {
    showSyncStatus('syncing');
    await pushToCloud();
    showSyncStatus('done');
  }

  // كشف syncNow و pullFromCloud للاستخدام الخارجي
  window.najranSyncNow      = syncNow;
  window.najranPullFromCloud = pullFromCloud;

  // ── التهيئة الرئيسية ──────────────────────────────────────────────────────
  async function init() {
    const session = getSession();
    if (!session) return;

    const hospitalName = getHospitalName();
    if (hospitalName) {
      console.log(`[MzamanaCloud] وضع المشاركة: مستشفى «${hospitalName}»`);
    } else {
      console.log('[MzamanaCloud] وضع شخصي (لا يوجد مستشفى مرتبط)');
    }

    // علامة لمنع الـ setItem override من إطلاق sync أثناء السحب من السيرفر
    let _pulling = false;

    const origPullFromCloud = pullFromCloud;
    async function pullFromCloudSafe() {
      if (_pulling) return;
      _pulling = true;
      try { await origPullFromCloud(); } finally { _pulling = false; }
    }

    // تحديث التعريض العام بنسخة آمنة (مع _pulling guard)
    window.najranPullFromCloud = pullFromCloudSafe;

    await pullFromCloudSafe();

    setInterval(syncNow, SYNC_INTERVAL_MS);
    window.addEventListener('beforeunload', () => { pushToCloud(); });

    // مزامنة فورية عند تغيير أي حقل إدخال أو خلية (debounce 2 ث)
    let _inputDebounce = null;
    document.addEventListener('input', () => {
      clearTimeout(_inputDebounce);
      _inputDebounce = setTimeout(syncNow, 2_000);
    });
    document.addEventListener('change', () => {
      clearTimeout(_inputDebounce);
      _inputDebounce = setTimeout(syncNow, 2_000);
    });

    // debounce على storage event (30 ث) — يمنع الحلقة اللانهائية بين التابات
    let _storageDebounce = null;
    window.addEventListener('storage', (e) => {
const shouldSync =
  e.key &&
  (
    SYNC_KEYS.some(k => e.key === k || e.key.endsWith(k)) ||
    e.key.includes('deptCalculatedCost_') ||
    e.key.includes('dept_') ||
    e.key.includes('sb_sigs_')
  );

if (!shouldSync) return;      clearTimeout(_storageDebounce);
      _storageDebounce = setTimeout(syncNow, 30_000);
    });

    // override setItem مع debounce 30 ثانية
const origSetItem = localStorage.setItem.bind(localStorage);

localStorage.setItem = function (key, value) {
  origSetItem(key, value);

const shouldSync =
  SYNC_KEYS.some(k => key === k || key.endsWith(k)) ||
  key.includes('deptCalculatedCost_') ||
  key.includes('dept_') ||
  key.includes('sb_sigs_');

  if (!_pulling && shouldSync) {
    clearTimeout(localStorage._syncTimeout);

    localStorage._syncTimeout = setTimeout(
      syncNow,
      30_000
    );
  }
};

    console.log('[MzamanaCloud] تم تهيئة المزامنة السحابية (V2 — مشاركة بيانات المستشفى)');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
