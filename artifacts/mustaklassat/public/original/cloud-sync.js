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
const DIRTY_KEYS = new Set();

function markDirtyKey(key) {
  try {
    if (!key) return;
    if (shouldSyncKey(key)) {
      DIRTY_KEYS.add(key);
    }
  } catch (_) {}
}

function clearDirtyKeys(keys) {
  try {
    keys.forEach(k => DIRTY_KEYS.delete(k));
  } catch (_) {}
}
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
'hospitalActivityStatus',
    'admin_staff', 'dynamicSignatures', 'contractorSignature',
    'appTitles_v1', 'healthCentersData', 'reviewExtractData', 'requestVisitData',
    'settings_main', 'settings_advanced',
    'finalLaborCost', 'performanceTotalDeduction', 'grand-net-total',
    'grand-net-total-centers', 'grand-net-total-admin',
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
  const PREFER_LOCAL_KEYS = new Set([
    'attendanceData',
    'centersAttendanceData_v2',
    'healthCentersAttendanceData',
    'adminOfficesAttendanceData_v1',
  ]);

  const SETTINGS_PAGE_KEYS = new Set([
    'persistentContractData', 'persistentExtractData',
    'contractData', 'contractDetails', 'contractNumber', 'contractType',
    'contractStartDate', 'contractEndDate', 'contractSignatureData',
    'extractMonth', 'extractYear', 'extractNumber', 'extractStart', 'extractEnd',
    'extractFromDate', 'extractToDate',
    'hospitalName', 'companyName', 'directPurchaseRatio',
    'settings_main', 'settings_advanced',
    'dynamicSignatures', 'contractorSignature', 'appTitles_v1',
    'admin_staff', 'contract_foundation_data'
  ]);

  function isSettingsMainPage() {
    return getCurrentPageFile() === 'settings_main.html';
  }

  function shouldMergePulledKeyForCurrentPage(key) {
    if (!isSettingsMainPage()) return true;
    const nk = String(key || '').replace(/^_u\d+_/, '');
    return SETTINGS_PAGE_KEYS.has(nk);
  }

 function shouldSyncKey(key) {
  const nk = key.replace(/^_u\d+_/, '');
  return (
    SYNC_KEYS.includes(key) ||
    SYNC_KEYS.includes(nk) ||
    nk.includes('deptCalculatedCost_') ||
    nk.includes('dept_') ||
    nk.includes('sb_sigs_') ||
    nk.includes('finalLaborCost') ||
    nk.includes('grand-net-total') ||
    nk.includes('najran_labor_') ||
    nk.includes('najran_health_') ||
    nk.includes('najran_admin_')
  );
}
  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (Date.now() - s.timestamp > 8 * 60 * 60 * 1000) return null;
      return s;
    } catch (_) { return null; }
  }

async function getFreshToken() {
  try {
    // من React App مباشرة
    if (typeof window.najranGetFreshToken === 'function') {
      const token = await window.najranGetFreshToken();
      if (token) return token;
    }

    // لو الصفحة الأصلية داخل iframe
    if (
      window.parent &&
      window.parent !== window &&
      typeof window.parent.najranGetFreshToken === 'function'
    ) {
      const token = await window.parent.najranGetFreshToken();
      if (token) return token;
    }
  } catch (_) {}

  const s = getSession();
  return s?.clerkToken || null;
}

  function getHospitalName() {
    const s = getSession();
    return s?.hospital?.trim() || null;
  }
function getCurrentUserLabel() {
  const s = getSession();
  return s?.name || s?.email || 'مستخدم';
}

function getCurrentPageFile() {
  return window.location.pathname.split('/').pop() || '';
}

function getCurrentPageLabel() {
  const file = getCurrentPageFile();

 const map = {
  'attendance.html': 'الحضور والانصراف',
  'performance.html': 'شهادة الأداء',
  'achievement.html': 'شهادة الإنجاز',
  'consumables.html': 'مستخلص المستهلكات',
  'spare_parts.html': 'مستخلص قطع الغيار',
  'settings_main.html': 'الإعدادات الرئيسية',
  'approval.html': 'اعتماد المستخلص',
  'review_extract.html': 'مراجعة المستخلص',
  'monthly-overview.html': 'النظرة الشاملة',
  'health_centers_attendance.html': 'حضور المراكز الصحية',
  'health_centers_consumables.html': 'مستهلكات المراكز الصحية',
  'admin_offices_attendance.html': 'حضور المكاتب الإدارية',
  'admin_offices_consumables.html': 'مستهلكات المكاتب الإدارية',
};

  return map[file] || document.title || file || 'صفحة غير محددة';
}

function readExtractMeta() {
  let d = {};
  try {
    d = JSON.parse(localStorage.getItem('persistentExtractData') || '{}');
  } catch (_) {}

  return {
    month: d.extractMonth || localStorage.getItem('extractMonth') || '',
    year: d.extractYear || localStorage.getItem('extractYear') || '',
    extractNumber: d.extractNumber || localStorage.getItem('extractNumber') || '',
  };
}

function updateHospitalActivityStatus() {
  try {
    const s = getSession();
    if (!s?.hospital) return;

    const meta = readExtractMeta();

    const activity = {
      userId: s.userId || '',
      userName: getCurrentUserLabel(),
      hospital: s.hospital,
      page: getCurrentPageLabel(),
      pageFile: getCurrentPageFile(),
      month: meta.month,
      year: meta.year,
      extractNumber: meta.extractNumber,
      updatedAt: new Date().toISOString(),
    };

localStorage.setItem('hospitalActivityStatus', JSON.stringify(activity));
markDirtyKey('hospitalActivityStatus');  } catch (_) {}
}

function showHospitalActivityNotice() {
  try {
    const raw = localStorage.getItem('hospitalActivityStatus');
    if (!raw) return;

    const activity = JSON.parse(raw);
    const s = getSession();
    if (!activity || !s) return;

    if (activity.userId && activity.userId === s.userId) return;

    const currentPage = getCurrentPageFile();
    if (activity.pageFile && activity.pageFile !== currentPage) return;

    const updatedAt = activity.updatedAt ? new Date(activity.updatedAt) : null;
    const ageMs = updatedAt ? Date.now() - updatedAt.getTime() : null;
    if (ageMs !== null && ageMs > 6 * 60 * 60 * 1000) return;

    const noticeKey = 'activity_notice_seen_' + activity.pageFile + '_' + activity.updatedAt;
    if (sessionStorage.getItem(noticeKey)) return;
    sessionStorage.setItem(noticeKey, '1');

    const parts = [
      `آخر عمل على هذه الصفحة كان بواسطة: ${activity.userName || 'مستخدم آخر'}`,
      activity.month || activity.year ? `الفترة: ${activity.month || ''} ${activity.year || ''}`.trim() : '',
      activity.extractNumber ? `رقم المستخلص/الدفعة: ${activity.extractNumber}` : '',
    ].filter(Boolean);

    const box = document.createElement('div');
    box.className = 'no-print';
    box.style.cssText = `
      position: fixed;
      bottom: 18px;
      left: 18px;
      z-index: 999999;
      max-width: 460px;
      background: #0f172a;
      color: #fff;
      padding: 13px 16px;
      border-radius: 14px;
      font-family: Tajawal, Arial, sans-serif;
      font-size: 13px;
      line-height: 1.8;
      direction: rtl;
      box-shadow: 0 10px 28px rgba(0,0,0,.28);
      border-right: 4px solid #d4af37;
    `;

    box.innerHTML = `
      <div style="font-weight:800;color:#d4af37;margin-bottom:3px;">تنبيه آخر نشاط</div>
      <div>${parts.join('<br>')}</div>
    `;

    document.body.appendChild(box);
    setTimeout(() => {
      if (box.parentElement) box.remove();
    }, 9000);
  } catch (_) {}
}
 async function apiFetch(path, options = {}) {
  const session = getSession();
  if (!session) return null;

const token = await getFreshToken();
if (!token) {
  console.warn('[MzamanaCloud] لا يوجد clerkToken صالح — تم إيقاف طلب المزامنة داخلياً');
  return null;
}

  try {
    const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 20_000);
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    };

    const resp = await fetch(API_BASE + path, {
      ...options,
      headers,
      credentials: 'include',
      signal: controller.signal,
    });

    clearTimeout(timer);

  if (resp.status === 401) {
  console.warn('[MzamanaCloud] رفض التوثيق 401 — سيتم التعامل معه داخلياً بدون إظهار رسالة للمستخدم');
  return null;
}

    return resp.ok ? resp.json() : null;
  } catch (_) {
    return null;
  }
}
  // ── مفاتيح البيانات الشهرية ──────────────────────────────────────────────
  const MONTH_SPECIFIC_KEYS = [
    'attendanceData', 'centersAttendanceData_v2', 'healthCentersAttendanceData',
    'consumablesTableData', 'healthCentersConsumables', 'mainHospitalConsumables',
    'consumablesTitle', 'consumablesPeriodFrom', 'consumablesPeriodTo',
    'spare_partsData', 'performanceData', 'achievementData',
    'performanceSignatures', 'performanceSignatures_v2', 'performanceTableNames',
    'performanceTotalDeduction', 'finalLaborCost', 'grand-net-total',
    'grand-net-total-centers', 'grand-net-total-admin',
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
  async function pullFromCloud() {
    const hospitalName = getHospitalName();


const storageScope = isSettingsMainPage() ? '?scope=settings' : '';

const [userResult, hospitalResult] = await Promise.all([
  apiFetch('/storage' + storageScope),
  hospitalName ? apiFetch('/hospital-storage' + storageScope) : Promise.resolve(null),
]);

    const userData     = userResult?.data     || {};
    const hospitalData = hospitalResult?.data  || {};

const cloudExtractData = hospitalData['persistentExtractData'] || userData['persistentExtractData'] || null;
const localExtractData = localStorage.getItem('persistentExtractData');

const oldMonthKey = getMonthKeyFromExtractData(localExtractData);
const newMonthKey = getMonthKeyFromExtractData(cloudExtractData);

// بعد المنطق الجديد: الإعدادات هي مصدر الفترة الحالي.
// لا نسمح للسحابة بفتح شهر مختلف تلقائيًا فوق الشهر الذي حفظه المستخدم محليًا.
const localHasConfirmedExtract = (() => {
  try {
    const d = JSON.parse(localExtractData || '{}');
    return !!(d.extractMonth && d.extractYear && d.extractStart && d.extractEnd && d.paymentNumber);
  } catch (_) {
    return false;
  }
})();

const monthChanged =
  oldMonthKey &&
  newMonthKey &&
  oldMonthKey !== newMonthKey &&
  !localHasConfirmedExtract;
const EXTRACT_META_KEYS = new Set([
  'persistentExtractData',
  'extractMonth',
  'extractYear',
  'extractStart',
  'extractEnd',
  'extractFromDate',
  'extractToDate',
  'paymentNumber',
  'extractNumber'
]);

const keepLocalExtractMeta =
  oldMonthKey &&
  newMonthKey &&
  oldMonthKey !== newMonthKey &&
  localHasConfirmedExtract;
if (monthChanged) {
  if (typeof window.saveMonthSnapshot === 'function') {
    window.saveMonthSnapshot(oldMonthKey);
  } else {
    try {
      const snap = {};
      MONTH_SPECIFIC_KEYS.forEach(k => {
        const v = localStorage.getItem(k);
        if (v !== null) snap[k] = v;
      });

      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('deptCalculatedCost_') || k.startsWith('dept_'))) {
          snap[k] = localStorage.getItem(k);
        }
      }

      localStorage.setItem('monthSnapshot_' + oldMonthKey, JSON.stringify(snap));
    } catch (_) {}
  }

  console.log(`[MzamanaCloud] تغيّر الشهر: ${oldMonthKey} → ${newMonthKey}`);
} else if (oldMonthKey && newMonthKey && oldMonthKey !== newMonthKey && localHasConfirmedExtract) {
  console.log(`[MzamanaCloud] تم تجاهل شهر السحابة (${newMonthKey}) لأن المستخلص المحلي المؤكد هو (${oldMonthKey})`);
}

    let merged = 0;
    let skippedByPage = 0;
    for (const [key, value] of Object.entries(userData)) {
      try {
                const normalizedKey = String(key || '').replace(/^_u\d+_/, '');

        if (keepLocalExtractMeta && EXTRACT_META_KEYS.has(normalizedKey)) {
          skippedByPage++;
          continue;
        }
        if (!shouldMergePulledKeyForCurrentPage(key)) { skippedByPage++; continue; }
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

    for (const [key, value] of Object.entries(hospitalData)) {
      if (!PERSONAL_KEYS.has(key)) {
        try {
                    const normalizedKey = String(key || '').replace(/^_u\d+_/, '');

          if (keepLocalExtractMeta && EXTRACT_META_KEYS.has(normalizedKey)) {
            skippedByPage++;
            continue;
          }
          if (!shouldMergePulledKeyForCurrentPage(key)) { skippedByPage++; continue; }
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
    const skipped = skippedByPage ? ` · تم تجاهل ${skippedByPage} مفتاح غير مطلوب لهذه الصفحة` : '';
    console.log(`[MzamanaCloud] ✓ ${merged} مفتاح شخصي${hosp}${skipped}`);

    try {
      window.dispatchEvent(new CustomEvent('najranCloudPulled', { detail: { monthChanged } }));
    } catch (_) {}

    try { if (typeof window.updateContractDisplayData === 'function') window.updateContractDisplayData(); } catch (_) {}
    try { if (typeof window... (truncated)