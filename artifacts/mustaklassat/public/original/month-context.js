/**
 * month-context.js — نظام عزل البيانات بين الشهور
 * يحفظ snapshot كامل لكل شهر ويتيح الرجوع اليدوي دون فتح شهر جديد تلقائياً من صفحة الإعدادات.
 */
(function () {
  'use strict';

  const IS_SETTINGS_PAGE = /settings_main\.html(?:$|[?#])/.test(window.location.href);
function isRevisionMode() {
  try {
    return localStorage.getItem('najran_revision_mode') === 'true'
      && !!localStorage.getItem('najran_revision_extract_id')
      && !!localStorage.getItem('najran_revision_snapshot');
  } catch (_) {
    return false;
  }
}
  // صفحة الإعدادات هي مصدر فترة المستخلص. لا نسمح بإشارة فتح الفترة التالية تلقائياً هنا.
  if (IS_SETTINGS_PAGE) {
    try {
      localStorage.removeItem('najran_advance_period');
      window.__najranDisableAutoAdvancePeriod = true;
    } catch (e) {}
  }

  const MONTH_DATA_KEYS = [
    'persistentExtractData', 'extractStart', 'extractEnd', 'extractMonth', 'extractYear', 'paymentNumber', 'extractNumber',
    'attendanceData',
    'performanceData', 'performanceTableNames', 'performanceTotalDeduction',
    'achievementItemNames', 'dentalLaborCheckboxState', 'dentalLaborData',
    'accreditationLetterData', 'adminJobsPrintState',
    'consumablesPeriodFrom', 'consumablesPeriodTo', 'consumablesTitle', 'consumablesTableData',
    'sparePartsTotalAmount',
    'centersAttendanceData_v2', 'performanceData_v4', 'performanceDeductions',
    'healthCentersConsumables', 'mainHospitalConsumables',
    'najran_labor_attendance_done', 'najran_labor_performance_done',
    'najran_health_attendance_done',
    'grand-net-total', 'finalLaborCost',
    'distributionSettings'
    // القاعدة المطلقة: dynamicSignatures و performanceSignatures أُزيلتا من لقطات
    // الشهور — التوقيعات بيانات ثابتة للموقع، والرجوع لشهر محفوظ كان يعيد
    // توقيعات قديمة فوق الحالية ثم تنتشر عبر المزامنة لكل الأجهزة.
  ];

  const DYNAMIC_PREFIXES = ['deptCalculatedCost_', 'dept_'];

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function normalizePaymentNumber(value) {
    const raw = String(value == null ? '' : value).trim();
    if (!raw) return '1';

    const digits = raw
      .replace(/[٠-٩]/g, function (d) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)); })
      .replace(/[۰-۹]/g, function (d) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); })
      .replace(/[^0-9]/g, '');

    if (!digits) return raw.replace(/\s+/g, '_');
    return String(parseInt(digits, 10) || 1);
  }

  function safePart(value, fallback) {
    return String(value == null ? '' : value).trim().replace(/\s+/g, '_') || fallback || '';
  }

  function readExtractData() {
    const ed = readJson('persistentExtractData', {}) || {};

    if (!ed.extractMonth) ed.extractMonth = localStorage.getItem('extractMonth') || '';
    if (!ed.extractYear) ed.extractYear = localStorage.getItem('extractYear') || new Date().getFullYear();

    if (!ed.paymentNumber && !ed.extractNumber) {
      ed.paymentNumber = localStorage.getItem('paymentNumber') || localStorage.getItem('extractNumber') || '001';
    }

    return ed;
  }

  function getLegacyMonthKeyFromExtractData(ed) {
    ed = ed || readExtractData();

    const month = String(ed.extractMonth || '').trim();
    const year = String(ed.extractYear || new Date().getFullYear()).trim();

    if (!month) return null;

    return safePart(year, String(new Date().getFullYear())) + '_' + safePart(month, 'month');
  }

  function getMonthKeyFromExtractData(ed) {
    ed = ed || readExtractData();

    const legacyKey = getLegacyMonthKeyFromExtractData(ed);
    if (!legacyKey) return null;

    const paymentDisplay = String(
      ed.paymentNumber ||
      ed.extractNumber ||
      localStorage.getItem('paymentNumber') ||
      localStorage.getItem('extractNumber') ||
      '001'
    ).trim() || '001';

    return legacyKey + '_p' + normalizePaymentNumber(paymentDisplay);
  }

  function getMonthKeyFromParts(year, month, paymentNumber) {
    return getMonthKeyFromExtractData({
      extractYear: year,
      extractMonth: month,
      paymentNumber: paymentNumber || '001'
    });
  }

  function getCurrentMonthKey() {
    try {
      return getMonthKeyFromExtractData(readExtractData());
    } catch (e) {
      return null;
    }
  }

  function getDynamicKeys() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && DYNAMIC_PREFIXES.some(p => k.startsWith(p))) keys.push(k);
    }
    return keys;
  }

  function getAllMonthDataKeys() {
    return [...MONTH_DATA_KEYS, ...getDynamicKeys()];
  }

  function collectMonthSnapshotData() {
    const snapshot = {};

    for (const key of getAllMonthDataKeys()) {
      const val = localStorage.getItem(key);
      if (val !== null) snapshot[key] = val;
    }

    return snapshot;
  }

  function readMonthSnapshotRecord(monthKey) {
    if (!monthKey) return null;

    let raw = localStorage.getItem('monthSnapshot_' + monthKey);
    if (raw) return { raw, key: monthKey, legacy: false };

    const legacyKey = String(monthKey).replace(/_p[^_]+$/, '');
    if (legacyKey && legacyKey !== monthKey) {
      raw = localStorage.getItem('monthSnapshot_' + legacyKey);
      if (raw) return { raw, key: legacyKey, legacy: true };
    }

    return null;
  }

  function parseMonthSnapshot(monthKey) {
    const rec = readMonthSnapshotRecord(monthKey);
    if (!rec) return null;

    try {
      const snap = JSON.parse(rec.raw);
      if (!snap || typeof snap !== 'object') return null;
      return { snap, key: rec.key, legacy: rec.legacy };
    } catch (e) {
      console.error('[MonthCtx] invalid snapshot:', monthKey, e);
      return null;
    }
  }

  function saveMonthSafetySnapshot(reason) {
    try {
      const safety = {
        schema: 'month_context_safety_v1',
        reason: reason || 'unknown',
        sourceKey: getCurrentMonthKey(),
        createdAt: new Date().toISOString(),
        data: collectMonthSnapshotData()
      };

      const raw = JSON.stringify(safety);
      const key = 'monthSafetySnapshot_' + Date.now();

      localStorage.setItem(key, raw);
      localStorage.setItem('monthSafetySnapshot_last', raw);

      if (localStorage.getItem(key) !== raw || localStorage.getItem('monthSafetySnapshot_last') !== raw) {
        throw new Error('SAFETY_VERIFY_FAILED');
      }

      const safetyKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('monthSafetySnapshot_')) safetyKeys.push(k);
      }

      safetyKeys.sort();

      while (safetyKeys.length > 5) {
        localStorage.removeItem(safetyKeys.shift());
      }

      return true;
    } catch (e) {
      console.error('[MonthCtx] safety snapshot failed:', e);
      void window.NajranDialogs.alert('تعذر حفظ نسخة أمان قبل تبديل الشهر/الدفعة. تم إيقاف العملية لحماية البيانات.');
      return false;
    }
  }

  window.saveMonthSnapshot = function (monthKey) {
    monthKey = monthKey || getCurrentMonthKey();
    if (!monthKey) return false;

    try {
      const raw = JSON.stringify(collectMonthSnapshotData());
      localStorage.setItem('monthSnapshot_' + monthKey, raw);

      const ok = localStorage.getItem('monthSnapshot_' + monthKey) === raw;
      if (ok) console.log('[MonthCtx] snapshot saved:', monthKey);

      return ok;
    } catch (e) {
      console.error('[MonthCtx] snapshot save failed:', e);
      return false;
    }
  };

  window.loadMonthSnapshot = function (monthKey, options) {
    options = options || {};

    const parsed = parseMonthSnapshot(monthKey);

    if (!parsed) {
      console.log('[MonthCtx] no valid snapshot for', monthKey, '— current data kept');
      return false;
    }

    if (!options.skipSafety && !saveMonthSafetySnapshot('before-load-month-snapshot')) {
      return false;
    }

    try {
      for (const key of getAllMonthDataKeys()) {
        localStorage.removeItem(key);
      }

      const SIGNATURE_SKIP = new Set(['dynamicSignatures', 'performanceSignatures', 'contractorSignature', 'performanceSignatures_v2']);
      for (const [k, v] of Object.entries(parsed.snap)) {
        // لقطات الشهور القديمة قد تحمل توقيعات تاريخية — لا تُكتب فوق الحالية.
        if (SIGNATURE_SKIP.has(k)) continue;
        localStorage.setItem(k, v);
      }

      console.log('[MonthCtx] snapshot loaded:', parsed.key, parsed.legacy ? '(legacy fallback)' : '');
      return true;
    } catch (e) {
      console.error('[MonthCtx] snapshot load failed:', e);
      return false;
    }
  };

  window.getSavedMonths = function () {
    const months = [];
    const seen = {};

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);

      if (k && k.startsWith('monthSnapshot_')) {
        const val = k.replace('monthSnapshot_', '');

        if (!seen[val]) {
          seen[val] = true;
          months.push(val);
        }
      }
    }

    return months.sort((a, b) => b.localeCompare(a));
  };

  window.switchToMonth = function (targetMonthKey) {
    const currentKey = getCurrentMonthKey();

    if (currentKey && !window.saveMonthSnapshot(currentKey)) {
      void window.NajranDialogs.alert('تعذر حفظ نسخة من الفترة الحالية. تم إيقاف التبديل لحماية البيانات.');
      return false;
    }

    return window.loadMonthSnapshot(targetMonthKey);
  };

  window.getLegacyMonthKeyFromExtractData = getLegacyMonthKeyFromExtractData;
  window.getMonthKeyFromExtractData = getMonthKeyFromExtractData;
  window.getMonthKeyFromParts = getMonthKeyFromParts;
  window.normalizePaymentNumberForMonthKey = normalizePaymentNumber;
  window.getCurrentMonthKey = getCurrentMonthKey;
  window.MONTH_DATA_KEYS_LIST = MONTH_DATA_KEYS;

 document.addEventListener('DOMContentLoaded', function () {
  if (IS_SETTINGS_PAGE) return;

  if (isRevisionMode()) {
    console.warn('[MonthCtx] REVISION MODE: منع تحميل monthSnapshot فوق بيانات المستخلص القديم');
    return;
  }

  const currentKey = getCurrentMonthKey();
  if (!currentKey) return;

  const hasLocalData =
  !!localStorage.getItem('attendanceData') ||
  !!localStorage.getItem('centersAttendanceData_v2') ||
  !!localStorage.getItem('consumablesTableData');

const hasSnapshot = !!readMonthSnapshotRecord(currentKey);

if (!hasLocalData && hasSnapshot) {
  window.loadMonthSnapshot(currentKey, { skipSafety: true });
  console.log('[MonthCtx] auto-restored snapshot for', currentKey);
}
});

  /**
   * Override آمن لحفظ بيانات المستخلص داخل صفحة الإعدادات فقط.
   * يحافظ على الأرشيف، لكنه يمنع فتح الفترة التالية تلقائياً.
   */
  document.addEventListener('DOMContentLoaded', function () {
    if (!IS_SETTINGS_PAGE) return;

    // احذف أي إشارة قديمة قبل أن تقرأها صفحة الإعدادات.
    try { localStorage.removeItem('najran_advance_period'); } catch (e) {}
    (function installExtractPeriodLinking() {
  if (window.__extractPeriodLinkingInstalled) return;
  window.__extractPeriodLinkingInstalled = true;

  const monthNames = [
    'يناير',
    'فبراير',
    'مارس',
    'أبريل',
    'مايو',
    'يونيو',
    'يوليو',
    'أغسطس',
    'سبتمبر',
    'أكتوبر',
    'نوفمبر',
    'ديسمبر'
  ];

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function toInputDate(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  function readEls() {
    return {
      month: document.getElementById('extract-month'),
      year: document.getElementById('extract-year'),
      start: document.getElementById('extract-start'),
      end: document.getElementById('extract-end')
    };
  }

  function saveLinkedExtractPeriod() {
    try {
      const els = readEls();
      const current = JSON.parse(localStorage.getItem('persistentExtractData') || '{}');

      if (els.month && els.month.value) current.extractMonth = els.month.value;
      if (els.year && els.year.value) current.extractYear = els.year.value;
      if (els.start && els.start.value) current.extractStart = els.start.value;
      if (els.end && els.end.value) current.extractEnd = els.end.value;

      const pay = document.getElementById('payment-number');
      if (pay && pay.value) current.paymentNumber = pay.value;

      localStorage.setItem('persistentExtractData', JSON.stringify(current));

      if (current.extractMonth) localStorage.setItem('extractMonth', current.extractMonth);
      if (current.extractYear) localStorage.setItem('extractYear', current.extractYear);
      if (current.extractStart) localStorage.setItem('extractStart', current.extractStart);
      if (current.extractEnd) localStorage.setItem('extractEnd', current.extractEnd);
      if (current.paymentNumber) {
        localStorage.setItem('paymentNumber', current.paymentNumber);
        localStorage.setItem('extractNumber', current.paymentNumber);
      }

      window.dispatchEvent(new StorageEvent('storage', {
        key: 'persistentExtractData',
        newValue: JSON.stringify(current)
      }));
    } catch (e) {
      console.warn('[extract-period-link] save failed:', e);
    }
  }

  function syncMonthYearFromStartDate() {
    const els = readEls();
    if (!els.start || !els.start.value) return;

    const d = new Date(els.start.value);
    if (isNaN(d.getTime())) return;

    if (els.month) els.month.value = monthNames[d.getMonth()];
    if (els.year) els.year.value = String(d.getFullYear());
  }

  function syncDatesFromMonthYear() {
    const els = readEls();
    if (!els.month || !els.year || !els.month.value || !els.year.value) return;

    const monthIndex = monthNames.indexOf(els.month.value);
    const year = parseInt(els.year.value, 10);

    if (monthIndex < 0 || !Number.isFinite(year)) return;

    const firstDay = new Date(year, monthIndex, 1);
    const lastDay = new Date(year, monthIndex + 1, 0);

    if (els.start) els.start.value = toInputDate(firstDay);
    if (els.end) els.end.value = toInputDate(lastDay);
  }

  function refreshDuration() {
    if (typeof calculateExtractDurationDays === 'function') {
      calculateExtractDurationDays();
    }
  }

  function onStartDateChanged() {
    syncMonthYearFromStartDate();
    refreshDuration();
    saveLinkedExtractPeriod();
  }

  function onEndDateChanged() {
    refreshDuration();
    saveLinkedExtractPeriod();
  }

  function onMonthYearChanged() {
    syncDatesFromMonthYear();
    refreshDuration();
    saveLinkedExtractPeriod();
  }

  setTimeout(function bindExtractPeriodFields() {
    const els = readEls();

    if (els.start) els.start.addEventListener('change', onStartDateChanged);
    if (els.end) els.end.addEventListener('change', onEndDateChanged);
    if (els.month) els.month.addEventListener('change', onMonthYearChanged);
    if (els.year) els.year.addEventListener('change', onMonthYearChanged);

    console.log('[MonthCtx] extract period linking installed');
  }, 50);
})();

    async function getClerkTokenForExtractUpload() {
      try {
        if (typeof window.najranGetFreshToken === 'function') {
          const t = await window.najranGetFreshToken();
          if (t) return t;
        }
        if (window.parent && window.parent !== window && typeof window.parent.najranGetFreshToken === 'function') {
          const pt = await window.parent.najranGetFreshToken();
          if (pt) return pt;
        }
        if (window.Clerk && window.Clerk.session) {
          const ct = await window.Clerk.session.getToken();
          if (ct) return ct;
        }
        if (window.parent && window.parent !== window && window.parent.Clerk && window.parent.Clerk.session) {
          const pct = await window.parent.Clerk.session.getToken();
          if (pct) return pct;
        }
      } catch (e) {}

      try {
        const raw = localStorage.getItem('najran_session');
        const s = raw ? JSON.parse(raw) : null;
        if (s && s.clerkToken) return s.clerkToken;
      } catch (e) {}

      return null;
    }

    async function pushExtractSettingsDirect(data) {
            if (isRevisionMode()) {
        const payload = {
          persistentExtractData: JSON.stringify(data),
          extractMonth: data.extractMonth || '',
          extractYear: String(data.extractYear || ''),
          extractStart: data.extractStart || '',
          extractEnd: data.extractEnd || '',
          paymentNumber: data.paymentNumber || '',
          extractNumber: data.paymentNumber || ''
        };

        Object.entries(payload).forEach(function(entry) {
          localStorage.setItem(entry[0], entry[1]);
        });

        console.warn('[MonthCtx] REVISION MODE: حفظ إعدادات المستخلص محليًا فقط بدون رفع hospital-storage');
        return { saved: Object.keys(payload).length, revisionOnly: true };
      }
      const token = await getClerkTokenForExtractUpload();
      if (!token) {
        console.error('[MonthCtx] لا يوجد token صالح لرفع إعدادات المستخلص مباشرة');
        throw new Error('NO_TOKEN_FOR_EXTRACT_SETTINGS_UPLOAD');
      }

      const payload = {
        persistentExtractData: JSON.stringify(data),
        extractMonth: data.extractMonth || '',
        extractYear: String(data.extractYear || ''),
        extractStart: data.extractStart || '',
        extractEnd: data.extractEnd || '',
        paymentNumber: data.paymentNumber || '',
        extractNumber: data.paymentNumber || ''
      };

      Object.entries(payload).forEach(function(entry) {
        localStorage.setItem(entry[0], entry[1]);
      });

      const resp = await fetch('/api/hospital-storage', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        credentials: 'include',
        body: JSON.stringify({ data: payload })
      });

      if (!resp.ok) throw new Error('EXTRACT_SETTINGS_UPLOAD_FAILED_' + resp.status);
      const result = await resp.json();
      console.log('[MonthCtx] extract settings direct upload:', result);
      return result;
    }
function getAttendancePageAfterExtractSave() {
  let session = {};
  let contractData = {};

  try {
    session = JSON.parse(localStorage.getItem('najran_session') || '{}') || {};
  } catch (_) {
    session = {};
  }

  try {
    contractData = JSON.parse(localStorage.getItem('persistentContractData') || '{}') || {};
  } catch (_) {
    contractData = {};
  }

  let allowedModules = null;
  try {
    allowedModules = Array.isArray(session.allowedModules)
      ? session.allowedModules
      : JSON.parse(session.allowedModules || 'null');
  } catch (_) {
    allowedModules = null;
  }

  const hospital = String(
    session.reviewActiveHospital ||
    session.hospital ||
    contractData.hospitalName ||
    localStorage.getItem('hospitalName') ||
    ''
  );

  if (Array.isArray(allowedModules)) {
    if (allowedModules.includes('admin_offices_attendance')) return 'admin_offices_attendance.html';
    if (allowedModules.includes('health_centers_attendance')) return 'health_centers_attendance.html';
    if (allowedModules.includes('najran_general')) return 'najran_general.html';
    if (allowedModules.includes('attendance')) return 'attendance.html';
  }

  if (
    hospital.includes('المكاتب الإدارية') ||
    hospital.includes('المرافق الصحية') ||
    hospital.includes('صيانة وإصلاح السيارات')
  ) {
    return 'admin_offices_attendance.html';
  }

  if (
    hospital.includes('المراكز الصحية') ||
    hospital.includes('مجمع')
  ) {
    return 'health_centers_attendance.html';
  }

  if (
    hospital.includes('نجران العام الجديد') ||
    hospital.includes('طب الأسنان')
  ) {
    return 'najran_general.html';
  }

  return 'attendance.html';
}
    function showExtractSaveCountdown(seconds) {
      let remaining = Number(seconds || 15);
      const old = document.getElementById('extract-save-countdown-modal');
      if (old) old.remove();

      const modal = document.createElement('div');
      modal.id = 'extract-save-countdown-modal';
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:999999;display:flex;align-items:center;justify-content:center;direction:rtl;font-family:Tajawal,Arial,sans-serif;';
      modal.innerHTML = '<div style="width:min(500px,92vw);background:#fff;border-radius:18px;padding:24px;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.25);border-top:6px solid #1e3c72;">' +
        '<h2 style="margin:0 0 12px;color:#1e3c72;font-size:22px;">تم حفظ مدة المستخلص بنجاح</h2>' +
        '<p style="margin:0 0 10px;color:#334155;font-size:15px;line-height:1.9;">جاري رفع التعديل ومزامنته مع السيرفر.<br>لا تفتح صفحة الحضور والانصراف قبل انتهاء العداد حتى لا تظهر المدة القديمة.</p>' +
        '<div style="margin:12px auto 4px;color:#0f766e;background:#ecfdf5;border:1px solid #99f6e4;border-radius:12px;padding:10px 12px;font-size:18px;font-weight:800;line-height:1.8;">استغفر الله العظيم وأتوب إليه</div>' +
        '<div style="color:#64748b;font-size:12px;margin-bottom:6px;">اذكر الله لحظات حتى تكتمل المزامنة</div>' +
        '<div id="extract-save-countdown-number" style="width:88px;height:88px;margin:16px auto;border-radius:50%;background:#eef4ff;color:#1e3c72;display:flex;align-items:center;justify-content:center;font-size:34px;font-weight:800;border:3px solid #bfdbfe;">' + remaining + '</div>' +
        '<button id="go-attendance-after-sync" disabled style="background:#94a3b8;color:#fff;border:none;border-radius:10px;padding:11px 22px;font-size:15px;font-weight:700;cursor:not-allowed;font-family:Tajawal,Arial,sans-serif;">جاري المزامنة...</button>' +
        '</div>';

      document.body.appendChild(modal);
      const numberEl = document.getElementById('extract-save-countdown-number');
      const btn = document.getElementById('go-attendance-after-sync');

      const timer = setInterval(function () {
        remaining -= 1;
        if (numberEl) numberEl.textContent = String(remaining);
        if (remaining <= 0) {
          clearInterval(timer);
          if (numberEl) numberEl.textContent = 'تم';
          if (btn) {
            btn.disabled = false;
            btn.textContent = 'الدخول إلى الحضور والانصراف';
            btn.style.background = '#1e3c72';
            btn.style.cursor = 'pointer';
            btn.onclick = function () {   window.location.href = getAttendancePageAfterExtractSave(); };
          }
        }
      }, 1000);
    }

    setTimeout(function installStableExtractSaveOverride() {
      if (window.__stableExtractSaveOverrideInstalled) return;
      window.__stableExtractSaveOverrideInstalled = true;

      window.saveExtractData = async function saveExtractDataStable() {
        try {
          console.log('بدء تشغيل دالة saveExtractData — stable no-auto-advance override');

                 const newMonth = document.getElementById('extract-month')?.value || '';
          const newYear  = document.getElementById('extract-year')?.value  || '';
          const currentPayment = String(document.getElementById('payment-number')?.value || '').trim();

          const prevRaw = localStorage.getItem('persistentExtractData');
          const prevData = prevRaw ? JSON.parse(prevRaw) : {};
          const oldPayment = String(prevData.paymentNumber || prevData.extractNumber || '').trim();

          if (isRevisionMode()) {
            const oldMonth = String(prevData.extractMonth || '').trim();
            const oldYear = String(prevData.extractYear || '').trim();

            const currentPayment = String(document.getElementById('payment-number')?.value || '').trim();

            if (
              oldMonth && oldYear &&
              (
                String(newMonth || '').trim() !== oldMonth ||
                String(newYear || '').trim() !== oldYear ||
                (oldPayment && currentPayment && currentPayment !== oldPayment)
              )
            ) {
              void window.NajranDialogs.alert(
                'لا يمكن تغيير شهر أو سنة أو رقم دفعة مستخلص مرفوع أثناء التعديل.\n\n' +
                'المستخلص الأصلي: ' + oldMonth + ' ' + oldYear + ' — دفعة ' + (oldPayment || '-') + '\n' +
                'البيانات الحالية: ' + newMonth + ' ' + newYear + ' — دفعة ' + (currentPayment || '-') + '\n\n' +
                'افتح بيانات المستخلص الأصلي أو ابدأ مستخلصًا جديدًا.'
              );

              const monthEl = document.getElementById('extract-month');
              const yearEl = document.getElementById('extract-year');
              const startEl = document.getElementById('extract-start');
              const endEl = document.getElementById('extract-end');
              const payEl = document.getElementById('payment-number');

              if (monthEl) monthEl.value = oldMonth;
              if (yearEl) yearEl.value = oldYear;
              if (startEl && prevData.extractStart) startEl.value = prevData.extractStart;
              if (endEl && prevData.extractEnd) endEl.value = prevData.extractEnd;
              if (payEl && oldPayment) payEl.value = oldPayment;

              if (typeof calculateExtractDurationDays === 'function') calculateExtractDurationDays();
              return;
            }
          }
          const prevMonth = (prevData.extractMonth || '').trim();
          const prevYear  = String(prevData.extractYear || '').trim();
       const prevKey = prevMonth && prevYear ? getMonthKeyFromExtractData(prevData) : null;
const newKey = newMonth && newYear
  ? getMonthKeyFromParts(newYear, newMonth, currentPayment || oldPayment || prevData.paymentNumber || '001')
  : null;

          const hasRealPreviousExtract =
            !!prevData.paymentNumber &&
            !!prevData.extractStart &&
            !!prevData.extractEnd &&
            !!prevMonth &&
            !!prevYear;

          if (hasRealPreviousExtract && prevKey && newKey && prevKey !== newKey) {
            const legacyPrevKey = getLegacyMonthKeyFromExtractData(prevData);
const laborLocked =
  localStorage.getItem('najran_labor_locked_' + prevKey) ||
  (legacyPrevKey ? localStorage.getItem('najran_labor_locked_' + legacyPrevKey) : null);

const consumablesLocked =
  localStorage.getItem('najran_consumables_locked_' + prevKey) ||
  (legacyPrevKey ? localStorage.getItem('najran_consumables_locked_' + legacyPrevKey) : null);

            const laborStatus = laborLocked ? 'تم اعتماده' : 'لم يتم اعتماده';
            const consumablesStatus = consumablesLocked ? 'تم اعتماده' : 'لم يتم اعتماده';

            const proceed = await window.NajranDialogs.confirm(
              'تنبيه: أنت تقوم بتغيير فترة المستخلص.\n\n' +
              'الفترة السابقة: ' + prevMonth + ' ' + prevYear + ' — دفعة ' + (prevData.paymentNumber || '-') + '\n' +
              'الفترة الجديدة: ' + newMonth + ' ' + newYear + '\n\n' +
              'حالة الفترة السابقة:\n' +
              '- مستخلص العمالة: ' + laborStatus + '\n' +
              '- مستخلص المستهلكات: ' + consumablesStatus + '\n\n' +
              'سيتم اعتماد الفترة الجديدة كمستخلص حالي، مع حفظ نسخة من الفترة السابقة في الأرشيف للرجوع إليها لاحقًا.\n\n' +
              'ملاحظة مهمة: عدم اعتماد المستهلكات لا يمنع إنشاء مستخلص عمالة جديد، لكنه سيظل ظاهرًا كغير معتمد حتى يتم الرجوع للفترة السابقة واعتماده.\n\n' +
              'هل تريد المتابعة؟'
            );

            if (!proceed) {
              const monthEl = document.getElementById('extract-month');
              const yearEl = document.getElementById('extract-year');
              const startEl = document.getElementById('extract-start');
              const endEl = document.getElementById('extract-end');
              const payEl = document.getElementById('payment-number');

              if (monthEl) monthEl.value = prevMonth;
              if (yearEl) yearEl.value = prevYear;
              if (startEl && prevData.extractStart) startEl.value = prevData.extractStart;
              if (endEl && prevData.extractEnd) endEl.value = prevData.extractEnd;
              if (payEl && prevData.paymentNumber) payEl.value = prevData.paymentNumber;

              if (typeof calculateExtractDurationDays === 'function') calculateExtractDurationDays();
              return;
            }

            // احفظ الفترة السابقة في الأرشيف فقط. ممنوع loadMonthSnapshot هنا.
            if (typeof window.saveMonthSnapshot === 'function') {
              window.saveMonthSnapshot(prevKey);
            }

            // زوّد رقم الدفعة فقط لو المستخدم لم يكتب رقمًا جديدًا بنفسه.
            const pnInput = document.getElementById('payment-number');
            if (pnInput && (!pnInput.value || pnInput.value === prevData.paymentNumber)) {
              const prevPn = parseInt(prevData.paymentNumber || '0', 10);
              const nextPn = String(prevPn + 1).padStart(Math.max(3, String(prevPn + 1).length), '0');
              pnInput.value = nextPn;
            }
          }

          const data = {
            extractCalendar: document.getElementById('extract-calendar')?.value || 'ميلادي',
            extractMonth: newMonth,
            extractYear: newYear,
            paymentNumber: document.getElementById('payment-number')?.value || '001',
            extractFinal: document.getElementById('extract-final')?.checked || false,
            extractStart: document.getElementById('extract-start')?.value || '',
            extractEnd: document.getElementById('extract-end')?.value || '',
            extractDuration: document.getElementById('extract-duration')?.value || 'شهر واحد'
          };

          console.log('البيانات المجمعة:', data);

          const validationError = (typeof validateExtractData === 'function') ? validateExtractData(data) : null;
          if (validationError) {
            console.error('خطأ التحقق:', validationError);
            void window.NajranDialogs.alert(validationError);
            return;
          }

          if (typeof window.checkDuplicateExtract === 'function' && data.paymentNumber) {
            const dup = window.checkDuplicateExtract(data.paymentNumber, data.extractMonth, data.extractYear);
            if (dup) {
              const dupDate = new Date(dup.savedAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
              const proceedDup = await window.NajranDialogs.confirm(
                'تحذير: يوجد مستخلص محفوظ بالفعل بنفس البيانات\n\n' +
                'رقم الدفعة: ' + data.paymentNumber + '\n' +
                'الشهر: ' + data.extractMonth + ' ' + data.extractYear + '\n' +
                'تاريخ الحفظ السابق: ' + dupDate + '\n\n' +
                'هل تريد المتابعة وحفظ نسخة جديدة؟'
              );
              if (!proceedDup) return;
            }
          }

          localStorage.setItem('persistentExtractData', JSON.stringify(data));
          localStorage.setItem('extractStart', data.extractStart || '');
          localStorage.setItem('extractEnd', data.extractEnd || '');
          localStorage.setItem('extractMonth', data.extractMonth || '');
          localStorage.setItem('extractYear', String(data.extractYear || ''));
          localStorage.setItem('paymentNumber', data.paymentNumber || '');
          localStorage.setItem('extractNumber', data.paymentNumber || '');

          await pushExtractSettingsDirect(data);

          // احفظ المستخلص الحالي في الأرشيف بعد الحفظ وبعد تثبيت المفاتيح المختصرة.
          const savedKey = getMonthKeyFromExtractData(data);
          if (savedKey && typeof window.saveMonthSnapshot === 'function') {
            window.saveMonthSnapshot(savedKey);
          }

          console.log('البيانات المحفوظة في localStorage:', JSON.parse(localStorage.getItem('persistentExtractData')));

          window.dispatchEvent(new StorageEvent('storage', {
            key: 'persistentExtractData',
            newValue: JSON.stringify(data)
          }));

          if (typeof window.saveExtractSnapshot === 'function') {
            window.saveExtractSnapshot('save');
          }

          if (typeof saveSectionData === 'function') {
            saveSectionData('extract', data, 'extract-save-success');
          }

          if (typeof updateExtractDisplayData === 'function') updateExtractDisplayData();
          if (typeof calculateExtractDurationDays === 'function') calculateExtractDurationDays();
          if (typeof renderMonthsArchive === 'function') renderMonthsArchive();

          // مهم: لا تقرأ najran_advance_period ولا تشغل autoIncrementExtractPeriod هنا.
          try { localStorage.removeItem('najran_advance_period'); } catch (e) {}

          if (typeof window.najranSyncNow === 'function') {
            window.najranSyncNow().catch(() => {});
          }

          showExtractSaveCountdown(15);
          console.log('تم حفظ البيانات ورفعها بنجاح!');
        } catch (error) {
          console.error('خطأ في حفظ بيانات المستخلص:', error);
          void window.NajranDialogs.alert('حدث خطأ أثناء حفظ بيانات المستخلص أو رفعها! تحقق من وحدة التحكم لمزيد من التفاصيل.');
        }
      };

      console.log('[MonthCtx] stable saveExtractData override installed — no auto advance + direct upload countdown');
    }, 0);
  });
})();
