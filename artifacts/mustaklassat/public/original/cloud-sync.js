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
  const SYNC_INTERVAL_MS = 60 * 1000;
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
    // مفاتيح شخصية تبقى خاصة بالمستخدم
    'backupLog', 'backupLogs',
  ];

  // المفاتيح التي تبقى خاصة بالمستخدم (لا تُشارك مع زملاء المستشفى)
  const PERSONAL_KEYS = new Set(['backupLog', 'backupLogs']);

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
    if (!s?.clerkToken) return null;
    const age = Date.now() - (s.timestamp || 0);
    return age < 55_000 ? s.clerkToken : null;
  }

  // اسم مستشفى المستخدم من الجلسة
  function getHospitalName() {
    const s = getSession();
    return s?.hospital?.trim() || null;
  }

  async function apiFetch(path, options = {}) {
    if (!getSession()) return null;
    try {
      const token = getFreshToken();
      const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const resp = await fetch(API_BASE + path, {
        ...options,
        headers,
        credentials: 'include',
      });
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
    'performanceTotalDeduction', 'finalLaborCost', 'grand-net-total',
    'najran_labor_attendance_done', 'najran_labor_performance_done',
    'najran_health_attendance_done', 'najran_admin_offices_attendance_done',
    'accreditationLetterData', 'adminJobsPrintState',
    'dentalLaborCheckboxState', 'dentalLaborData',
    'achievementItemNames', 'sparePartsTotalAmount',
    'dynamicSignatures',
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
      try { localStorage.setItem(key, value); merged++; } catch (_) {}
    }

    // ثم تطبيق بيانات المستشفى (تتغلب على البيانات الشخصية للمفاتيح المشتركة)
    for (const [key, value] of Object.entries(hospitalData)) {
      if (!PERSONAL_KEYS.has(key)) {
        try { localStorage.setItem(key, value); } catch (_) {}
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
    const allData      = {};   // كل المفاتيح → user_storage (نسخ احتياطي)
    const hospitalData = {};   // المفاتيح التشغيلية → hospital_storage

    for (const key of SYNC_KEYS) {
      const val = localStorage.getItem(key);
      if (val !== null) {
        allData[key] = val;
        if (!PERSONAL_KEYS.has(key)) {
          hospitalData[key] = val;
        }
      }
    }

    // مفاتيح pattern-based (deptCalculatedCost_X, dept_X)
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith('deptCalculatedCost_') || k.startsWith('dept_')) {
        const v = localStorage.getItem(k);
        if (v !== null) {
          allData[k]      = v;
          hospitalData[k] = v;
        }
      }
    }

    if (Object.keys(allData).length === 0) return;

    // رفع الكل إلى user_storage (نسخ احتياطي + توافق مع المستخدمين بلا مستشفى)
    const [userResult, hospitalResult] = await Promise.all([
      apiFetch('/storage', { method: 'PUT', body: JSON.stringify({ data: allData }) }),
      hospitalName && Object.keys(hospitalData).length > 0
        ? apiFetch('/hospital-storage', { method: 'PUT', body: JSON.stringify({ data: hospitalData }) })
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
    banner.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; z-index: 99999;
      background: #d97706; color: white; text-align: center;
      padding: 10px; font-size: 14px; font-family: Arial, sans-serif;
      direction: rtl;
    `;
    banner.innerHTML = `
      ⚠️ انتهت صلاحية الجلسة — بياناتك محفوظة محلياً.
      <a href="/dashboard" style="color:white;font-weight:bold;margin-right:10px;text-decoration:underline;">
        ← العودة للوحة القيادة لتجديد الجلسة
      </a>
    `;
    document.body.prepend(banner);
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

    await pullFromCloud();

    setInterval(syncNow, SYNC_INTERVAL_MS);
    window.addEventListener('beforeunload', () => { pushToCloud(); });
    window.addEventListener('storage', () => { syncNow(); });

    const origSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (key, value) {
      origSetItem(key, value);
      if (SYNC_KEYS.includes(key)) {
        clearTimeout(localStorage._syncTimeout);
        localStorage._syncTimeout = setTimeout(syncNow, 3000);
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
