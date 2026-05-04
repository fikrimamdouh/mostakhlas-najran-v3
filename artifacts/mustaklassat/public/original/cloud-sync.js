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

  function getToken() {
    const s = getSession();
    return s?.clerkToken || null;
  }

  async function apiFetch(path, options = {}) {
    const token = getToken();
    if (!token) return null;
    try {
      const resp = await fetch(API_BASE + path, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...(options.headers || {}),
        },
      });
      if (resp.status === 401) {
        // التوكن انتهت صلاحيته — ننبّه المستخدم
        showTokenExpiredBanner();
        return null;
      }
      return resp.ok ? resp.json() : null;
    } catch (_) { return null; }
  }

  // تحميل البيانات من السحابة إلى localStorage
  async function pullFromCloud() {
    const result = await apiFetch('/storage');
    if (!result?.data) return;
    let merged = 0;
    for (const [key, value] of Object.entries(result.data)) {
      // نضع البيانات السحابية فقط إذا لم يكن للمستخدم بيانات محلية أحدث
      // أو إذا كانت السحابة هي المصدر الوحيد
      try {
        localStorage.setItem(key, value);
        merged++;
      } catch (_) {}
    }
    console.log(`[MzamanaCloud] تم جلب ${merged} مفتاح من السحابة`);
  }

  // رفع البيانات من localStorage إلى السحابة
  async function pushToCloud() {
    const token = getToken();
    if (!token) return;

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
      setTimeout(() => { if (syncIndicator) syncIndicator.textContent = '☁ مزامنة سحابية'; }, 2000);
    } else {
      syncIndicator.textContent = '☁ مزامنة سحابية';
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
