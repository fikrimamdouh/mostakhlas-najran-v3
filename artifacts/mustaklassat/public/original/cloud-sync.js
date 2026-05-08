/**
 * cloud-sync.js — مزامنة سحابية للبيانات
 * يقرأ بيانات المستخدم من قاعدة البيانات عند تحميل الصفحة
 * ويرفع التغييرات تلقائياً كل 60 ثانية وعند إغلاق الصفحة
 */
(function () {
  'use strict';

  const API_BASE = '/api';
  const SYNC_INTERVAL_MS = 60 * 1000; // كل دقيقة
  const SESSION_KEY = 'najran_session';

  // المفاتيح التي يجب مزامنتها (جميع مفاتيح النظام الأصلي)
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
    'appTitles_v1', 'backupLog', 'backupLogs',
    'healthCentersData', 'reviewExtractData', 'requestVisitData',
    'settings_main', 'settings_advanced',
    'finalLaborCost', 'performanceTotalDeduction', 'grand-net-total',
    'performanceSignatures', 'performanceTableNames',
    'najran_labor_attendance_done', 'najran_labor_performance_done', 'najran_health_attendance_done',
    'najran_admin_offices_attendance_done',
    // admin offices keys
    'adminOfficeNames_v1', 'adminOfficesAttendanceData_v1',
    // admin offices consumables
    'admin_offices_consumables_v1.0',
    // pattern-based keys handled separately in pushToCloud
  ];

  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      // تحقق من انتهاء الصلاحية (8 ساعات)
      if (Date.now() - s.timestamp > 8 * 60 * 60 * 1000) return null;
      return s;
    } catch (_) { return null; }
  }

  // نُعيد التوكن فقط إذا كان طازجاً (أقل من 55 ثانية منذ حفظه)
  function getFreshToken() {
    const s = getSession();
    if (!s?.clerkToken) return null;
    const age = Date.now() - (s.timestamp || 0);
    return age < 55_000 ? s.clerkToken : null;
  }

  async function apiFetch(path, options = {}) {
    if (!getSession()) return null; // لا جلسة على الإطلاق
    try {
      const token = getFreshToken();
      const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      // إذا لم يكن التوكن طازجاً، يعتمد clerkMiddleware على session cookies تلقائياً
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

  // مفاتيح البيانات الشهرية التي تُمسح عند تغيير الشهر
  const MONTH_SPECIFIC_KEYS = [
    'attendanceData', 'centersAttendanceData_v2', 'healthCentersAttendanceData',
    'consumablesTableData', 'healthCentersConsumables', 'mainHospitalConsumables',
    'consumablesTitle', 'consumablesPeriodFrom', 'consumablesPeriodTo',
    'spare_partsData', 'performanceData', 'achievementData',
    'performanceSignatures', 'performanceTableNames', 'performanceTotalDeduction',
    'finalLaborCost', 'grand-net-total',
    'najran_labor_attendance_done', 'najran_labor_performance_done', 'najran_health_attendance_done',
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

  // تحميل البيانات من السحابة إلى localStorage مع كشف تغيير الشهر
  async function pullFromCloud() {
    const result = await apiFetch('/storage');
    if (!result?.data) return;

    // كشف ما إذا كان الشهر تغيّر في السحابة (بعد اعتماد المستخلص من الأدمن)
    const oldMonthKey = getMonthKeyFromExtractData(localStorage.getItem('persistentExtractData'));
    const newMonthKey = getMonthKeyFromExtractData(result.data['persistentExtractData'] || null);
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

    // تطبيق البيانات السحابية
    let merged = 0;
    for (const [key, value] of Object.entries(result.data)) {
      try {
        localStorage.setItem(key, value);
        merged++;
      } catch (_) {}
    }

    if (monthChanged) {
      // مسح بيانات الشهر القديم الشهرية
      MONTH_SPECIFIC_KEYS.forEach(k => localStorage.removeItem(k));
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('deptCalculatedCost_') || k.startsWith('dept_'))) localStorage.removeItem(k);
      }

      // إعلام المستخدم
      const newLabel = newMonthKey.replace('_', ' — ');
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => showMonthAdvancedBanner(newLabel));
      } else {
        showMonthAdvancedBanner(newLabel);
      }
    }

    console.log(`[MzamanaCloud] تم جلب ${merged} مفتاح من السحابة`);

    // أخطر الصفحات بأن البيانات السحابية جُلبت — يتيح لها إعادة رسم الهيدر
    try {
      window.dispatchEvent(new CustomEvent('najranCloudPulled', { detail: { monthChanged } }));
    } catch (_) {}

    // إعادة رسم بيانات الهيدر مباشرةً إن كانت الدوال موجودة في الصفحة
    try { if (typeof window.updateContractDisplayData === 'function') window.updateContractDisplayData(); } catch (_) {}
    try { if (typeof window.updateContractDataForPrint === 'function') window.updateContractDataForPrint(); } catch (_) {}
  }

  // رفع البيانات من localStorage إلى السحابة
  async function pushToCloud() {
    if (!getSession()) return;

    const data = {};
    for (const key of SYNC_KEYS) {
      const val = localStorage.getItem(key);
      if (val !== null) data[key] = val;
    }

    const count = Object.keys(data).length;
    if (count === 0) return;

    const result = await apiFetch('/storage', {
      method: 'PUT',
      body: JSON.stringify({ data }),
    });

    if (result) {
      console.log(`[MzamanaCloud] تم رفع ${result.saved} مفتاح للسحابة`);
    }
  }

  // إشعار انتهاء صلاحية التوكن
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

  // مؤشر حالة المزامنة
  let syncIndicator = null;

  function showSyncStatus(status) {
    // Prefer the auth-check.js hook if available
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

  // التهيئة الرئيسية
  async function init() {
    const session = getSession();
    if (!session) return; // لا جلسة — auth-check.js سيتولى الأمر

    // جلب البيانات من السحابة أولاً
    await pullFromCloud();

    // رفع دوري
    setInterval(syncNow, SYNC_INTERVAL_MS);

    // رفع عند إغلاق الصفحة
    window.addEventListener('beforeunload', () => { pushToCloud(); });

    // رفع عند تغيير localStorage (يلتقط تغييرات النظام الأصلي)
    window.addEventListener('storage', () => { syncNow(); });

    // Hook على localStorage.setItem لرصد التغييرات الداخلية
    const origSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (key, value) {
      origSetItem(key, value);
      if (SYNC_KEYS.includes(key)) {
        clearTimeout(localStorage._syncTimeout);
        localStorage._syncTimeout = setTimeout(syncNow, 3000); // debounce 3 ثواني
      }
    };

    console.log('[MzamanaCloud] تم تهيئة المزامنة السحابية');
  }

  // تشغيل بعد اكتمال الصفحة
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
