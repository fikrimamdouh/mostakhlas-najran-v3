/**
 * extract-stepper.js — شريط التقدم البصري لمراحل المستخلص
 * يُحقن تلقائياً في صفحات العمالة والمراكز الصحية
 */
(function () {
  'use strict';

  function buildLaborSteps() {
    const p = window.location.pathname;
    if (p.includes('najran_dental')) {
      return [
        { key: 'labor_attendance',  label: 'الحضور والانصراف', page: '/original/najran_dental_attendance.html' },
        { key: 'labor_performance', label: 'جداول الأداء',     page: '/original/najran_dental_performance.html', needsFlag: 'najran_labor_attendance_done' },
        { key: 'labor_achievement', label: 'شهادة الإنجاز',   page: '/original/najran_general_achievement.html', needsFlag: 'najran_labor_performance_done' },
        { key: 'labor_submit',      label: 'رفع للاعتماد',     page: null, isLast: true },
      ];
    }
    if (p.includes('najran_general')) {
      return [
        { key: 'labor_attendance',  label: 'الحضور والانصراف', page: '/original/najran_general_attendance.html' },
        { key: 'labor_performance', label: 'جداول الأداء',     page: '/original/najran_general_performance.html', needsFlag: 'najran_labor_attendance_done' },
        { key: 'labor_achievement', label: 'شهادة الإنجاز',   page: '/original/najran_general_achievement.html', needsFlag: 'najran_labor_performance_done' },
        { key: 'labor_submit',      label: 'رفع للاعتماد',     page: null, isLast: true },
      ];
    }
    return [
      { key: 'labor_attendance',  label: 'الحضور والانصراف', page: '/original/attendance.html' },
      { key: 'labor_performance', label: 'جداول الأداء',     page: '/original/performance.html', needsFlag: 'najran_labor_attendance_done' },
      { key: 'labor_achievement', label: 'شهادة الإنجاز',   page: '/original/achievement.html',  needsFlag: 'najran_labor_performance_done' },
      { key: 'labor_submit',      label: 'رفع للاعتماد',     page: null, isLast: true },
    ];
  }

  const STEPS_HEALTH = [
    { key: 'health_attendance',  label: 'عمالة المراكز',     page: '/original/health_centers_attendance.html' },
    { key: 'health_consumables', label: 'مستهلكات المراكز', page: '/original/health_centers_consumables.html', needsFlag: 'najran_health_attendance_done' },
    { key: 'health_submit',      label: 'رفع للاعتماد',      page: null, isLast: true },
  ];
const STEPS_ADMIN_OFFICES = [
  { key: 'admin_labor',       label: 'عمالة المكاتب',      page: '/original/admin_offices_attendance.html' },
  { key: 'admin_consumables', label: 'مستهلكات المكاتب',  page: '/original/admin_offices_consumables.html' },
  { key: 'admin_submit',      label: 'رفع للاعتماد',       page: null, isLast: true },
];
 function detectCurrentStep() {
  const p = window.location.pathname;

  if (p.includes('admin_offices_consumables')) return { type: 'admin_offices', key: 'admin_consumables' };
  if (p.includes('admin_offices_attendance'))  return { type: 'admin_offices', key: 'admin_labor' };

  if (p.includes('health_centers_consumables')) return { type: 'health', key: 'health_consumables' };
  if (p.includes('health_centers_attendance'))  return { type: 'health', key: 'health_attendance' };

  if (p.includes('performance'))  return { type: 'labor', key: 'labor_performance' };
  if (p.includes('achievement'))  return { type: 'labor', key: 'labor_achievement' };
  if (p.includes('attendance') && !p.includes('health')) return { type: 'labor', key: 'labor_attendance' };

  return null;
}

  function getMonthLabel() {
  function parseObj(v) {
    if (!v) return {};
    if (typeof v === 'object') return v;
    try { return JSON.parse(v); } catch (_) { return {}; }
  }

  function monthFromDate(startRaw) {
    if (!startRaw) return { m: '', y: '' };

    const d = new Date(startRaw);
    if (Number.isNaN(d.getTime())) return { m: '', y: '' };

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

    return {
      m: monthNames[d.getMonth()],
      y: String(d.getFullYear())
    };
  }

  try {
    const ed = parseObj(localStorage.getItem('persistentExtractData'));

    let m = String(
      ed.extractMonth ||
      ed.month ||
      localStorage.getItem('extractMonth') ||
      ''
    ).trim();

    let y = String(
      ed.extractYear ||
      ed.year ||
      localStorage.getItem('extractYear') ||
      ''
    ).trim();

    if (!m) {
      const derived = monthFromDate(
        ed.extractStart ||
        ed.startDate ||
        localStorage.getItem('extractStart') ||
        ''
      );

      m = derived.m;
      if (!y) y = derived.y;
    }

    const isRevision =
      localStorage.getItem('najran_revision_mode') === 'true' &&
      localStorage.getItem('najran_revision_extract_id') &&
      localStorage.getItem('najran_revision_snapshot');

    if ((!m || !y) && isRevision) {
      const snap = parseObj(localStorage.getItem('najran_revision_snapshot'));
      const ext = parseObj(snap.persistentExtractData);

      m = String(
        m ||
        ext.extractMonth ||
        snap.extractMonth ||
        ext.month ||
        snap.month ||
        ''
      ).trim();

      y = String(
        y ||
        ext.extractYear ||
        snap.extractYear ||
        ext.year ||
        snap.year ||
        ''
      ).trim();

      if (!m) {
        const derived = monthFromDate(
          ext.extractStart ||
          snap.extractStart ||
          ext.startDate ||
          snap.startDate ||
          ''
        );

        m = derived.m;
        if (!y) y = derived.y;
      }
    }

    return m ? `📅 ${m} ${y}` : '';
  } catch (_) {
    const m = String(localStorage.getItem('extractMonth') || '').trim();
    const y = String(localStorage.getItem('extractYear') || '').trim();
    return m ? `📅 ${m} ${y}` : '';
  }
}

  function buildStepper() {
    const current = detectCurrentStep();
    if (!current) return;

const steps =
  current.type === 'health'
    ? STEPS_HEALTH
    : current.type === 'admin_offices'
      ? STEPS_ADMIN_OFFICES
      : buildLaborSteps();

const flowTitle =
  current.type === 'health'
    ? 'مستخلص المراكز الصحية'
    : current.type === 'admin_offices'
      ? 'مستخلص المكاتب الإدارية'
      : 'مستخلص العمالة';
    const currentIdx = steps.findIndex(s => s.key === current.key);
    const monthLabel = getMonthLabel();

    const stepsHTML = steps.map((step, idx) => {
      let state = idx < currentIdx ? 'done' : idx === currentIdx ? 'active' : 'pending';
      const icon = state === 'done' ? '✓' : String(idx + 1);
      const clickable = idx < currentIdx && step.page;
      const connector = idx < steps.length - 1
        ? `<div class="njs-conn njs-conn--${idx < currentIdx ? 'done' : 'pending'}"></div>`
        : '';
      return `
        <div class="njs-step njs-step--${state}" ${clickable ? `onclick="window.location.href='${step.page}'" style="cursor:pointer"` : ''} title="${step.label}">
          <div class="njs-icon">${icon}</div>
          <div class="njs-lbl">${step.label}</div>
        </div>${connector}`;
    }).join('');

    const css = `<style id="njs-stepper-css">
      #njs-stepper{font-family:'Tajawal',sans-serif;background:linear-gradient(135deg,#1e3c72,#2a5298);padding:12px 20px 14px;direction:rtl;position:relative;z-index:200}
      @media print{#njs-stepper{display:none!important}}
      .njs-header{display:flex;align-items:center;gap:12px;margin-bottom:12px}
      .njs-title{color:#fff;font-size:14px;font-weight:800}
      .njs-month{background:rgba(255,255,255,.18);color:#fff;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:600;border:1px solid rgba(255,255,255,.3)}
      .njs-nav-home{background:rgba(255,255,255,.1);color:rgba(255,255,255,.85);border:1px solid rgba(255,255,255,.2);padding:4px 12px;border-radius:8px;font-family:'Tajawal',sans-serif;font-size:12px;font-weight:600;cursor:pointer;text-decoration:none;margin-right:auto}
      .njs-nav-home:hover{background:rgba(255,255,255,.2)}
      .njs-steps{display:flex;align-items:center}
      .njs-step{display:flex;flex-direction:column;align-items:center;gap:5px;min-width:70px}
      .njs-icon{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800}
      .njs-step--done .njs-icon{background:#16a34a;color:#fff;box-shadow:0 0 0 3px rgba(22,163,74,.3)}
      .njs-step--active .njs-icon{background:#fff;color:#1e3c72;box-shadow:0 0 0 3px rgba(255,255,255,.4)}
      .njs-step--pending .njs-icon{background:rgba(255,255,255,.12);color:rgba(255,255,255,.5);border:2px solid rgba(255,255,255,.2)}
      .njs-lbl{font-size:10px;font-weight:700;white-space:nowrap;color:rgba(255,255,255,.85)}
      .njs-step--active .njs-lbl{color:#fff;font-size:11px}
      .njs-step--pending .njs-lbl{color:rgba(255,255,255,.45)}
      .njs-step--done .njs-lbl{color:rgba(255,255,255,.7)}
      .njs-conn{height:2px;flex:1;min-width:16px;margin-bottom:18px;max-width:60px}
      .njs-conn--done{background:#16a34a}
      .njs-conn--pending{background:rgba(255,255,255,.18)}
      .njs-month-warning{background:rgba(255,193,7,.15);border:1px solid rgba(255,193,7,.4);color:#fef3c7;font-size:11px;padding:5px 12px;border-radius:8px;margin-top:8px;text-align:center}
    </style>`;

    const html = `<div id="njs-stepper">
      <div class="njs-header">
        <span class="njs-title">📋 ${flowTitle}</span>
        ${monthLabel ? `<span class="njs-month">${monthLabel}</span>` : '<span class="njs-month" style="background:rgba(255,100,100,.2);border-color:rgba(255,100,100,.4)">⚠️ الشهر غير محدد</span>'}
        <a href="/original/index.html" class="njs-nav-home">🏠 الرئيسية</a>
      </div>
      <div class="njs-steps">${stepsHTML}</div>
      ${!monthLabel ? '<div class="njs-month-warning">تأكد من ضبط الشهر في الإعدادات قبل إدخال البيانات</div>' : ''}
    </div>`;

    if (!document.getElementById('njs-stepper-css')) document.head.insertAdjacentHTML('beforeend', css);
    document.body.insertAdjacentHTML('afterbegin', html);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildStepper);
  } else {
    setTimeout(buildStepper, 0);
  }
})();

/**
 * Achievement monthly-value safety fix.
 * Keeps existing attendance/performance saving untouched.
 * Active only on /original/achievement.html and original-viewer?page=achievement.html.
 */
(function () {
  'use strict';

  const pageSig = window.location.pathname + window.location.search;
  const isAchievementPage = /\/achievement\.html(?:$|[?#])/.test(pageSig) || /[?&]page=achievement\.html(?:$|&)/.test(pageSig);
  if (!isAchievementPage) return;

  function toNumber(value) {
    if (typeof value === 'number') return isFinite(value) ? value : 0;
    if (value == null) return 0;
    const normalized = String(value)
      .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
      .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
      .replace(/ر\.?\s?س\.?/g, '')
      .replace(/ريال(?:\s+سعودي)?/g, '')
      .replace(/SAR/gi, '')
      .replace(/[,،\s]/g, '')
      .replace(/[^0-9.-]/g, '');
    const n = parseFloat(normalized);
    return isFinite(n) ? n : 0;
  }

  function parseJSON(raw) {
    if (!raw) return {};
    try { return JSON.parse(raw); } catch (_) { return {}; }
  }

  function getExtractPeriodSafe() {
    const keys = ['persistentExtractData', 'extractData', 'monthlyData'];

    for (const key of keys) {
      const data = parseJSON(localStorage.getItem(key));
      const startRaw = data.extractStart || data.startDate;
      const endRaw = data.extractEnd || data.endDate;
      if (!startRaw || !endRaw) continue;

      const start = new Date(startRaw);
      const end = new Date(endRaw);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;

      const daysInMonth = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;
      const totalDaysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();

      if (daysInMonth > 0 && totalDaysInMonth > 0) {
        return { daysInMonth, totalDaysInMonth, source: key };
      }
    }

    const today = new Date();
    const totalDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    return { daysInMonth: totalDays, totalDaysInMonth: totalDays, source: 'fallback-current-month' };
  }

  function getContractAdjustment() {
    const persistent = parseJSON(localStorage.getItem('persistentContractData'));
    const contractType = persistent.contractType || localStorage.getItem('contractType') || '';
    const directPurchaseRatio = toNumber(persistent.directPurchaseRatio || localStorage.getItem('directPurchaseRatio') || 0);
    return { contractType, directPurchaseRatio };
  }

  function adjustedSalary(emp) {
    let salary = toNumber(emp && (emp.salary ?? emp.monthlySalary ?? emp.cost ?? emp.amount));
    const { contractType, directPurchaseRatio } = getContractAdjustment();
    if (contractType === 'شراء مباشر' && directPurchaseRatio > 0) {
      salary += salary * directPurchaseRatio / 100;
    }
    return salary;
  }

  function getDeptMonthlyValue(deptKey, attendanceData) {
    const rows = Array.isArray(attendanceData && attendanceData[deptKey]) ? attendanceData[deptKey] : [];
    if (!rows.length) return 0;

    const period = getExtractPeriodSafe();
    const ratio = period.totalDaysInMonth > 0 ? period.daysInMonth / period.totalDaysInMonth : 1;

    return rows.reduce(function (sum, emp) {
      return sum + adjustedSalary(emp) * ratio;
    }, 0);
  }

  function getItemTitle(id, fallback) {
    try {
      if (typeof getItemName === 'function') return getItemName(id) || fallback;
    } catch (_) {}
    return fallback;
  }

  function zeroDentalData() {
    return { monthlyValue: 0, absenceDeduction: 0, absencePenalty: 0, performancePenalty: 0, nationalityPenalty: 0, netMonthly: 0 };
  }

  function installAchievementCalculationFix(attempt) {
    attempt = attempt || 0;

    if (typeof window.loadAndProcessAchievementData !== 'function' || typeof window.renderAchievementTable !== 'function') {
      if (attempt < 40) setTimeout(function () { installAchievementCalculationFix(attempt + 1); }, 150);
      return;
    }

    const originalLoad = window.loadAndProcessAchievementData;

    window.loadAndProcessAchievementData = function fixedAchievementLoader() {
      try {
        const attendanceData = parseJSON(localStorage.getItem('attendanceData'));
        const totalPerformancePenalty = toNumber(localStorage.getItem('performanceTotalDeduction'));

        if (!attendanceData || Object.keys(attendanceData).length === 0) {
          return originalLoad.apply(this, arguments);
        }

        const mainDepts = ['cleaning', 'electricity', 'agriculture', 'civil_works', 'mechanical', 'laundry', 'patient_services'];

        let workforceMonthlyValue = 0;
        let workforceAbsenceDeduction = 0;
        let workforceAbsencePenalty = 0;
        let workforceNationalityPenalty = 0;

        mainDepts.forEach(function (deptKey) {
          workforceMonthlyValue += getDeptMonthlyValue(deptKey, attendanceData);
          const rows = Array.isArray(attendanceData[deptKey]) ? attendanceData[deptKey] : [];
          rows.forEach(function (emp) {
            workforceAbsenceDeduction += toNumber(emp.deduction);
            workforceAbsencePenalty += toNumber(emp.absencePenalty);
            workforceNationalityPenalty += toNumber(emp.nationalityFine);
          });
        });

        let saudiMonthlyValue = getDeptMonthlyValue('admin_saudi', attendanceData);
        let saudiAbsenceDeduction = 0;
        let saudiAbsencePenalty = 0;
        let saudiNationalityPenalty = 0;

        const saudiRows = Array.isArray(attendanceData.admin_saudi) ? attendanceData.admin_saudi : [];
        saudiRows.forEach(function (emp) {
          saudiAbsenceDeduction += toNumber(emp.deduction);
          saudiAbsencePenalty += toNumber(emp.absencePenalty);
          saudiNationalityPenalty += toNumber(emp.nationalityFine);
        });

        const workforceNetMonthly = workforceMonthlyValue - (workforceAbsenceDeduction + workforceAbsencePenalty + totalPerformancePenalty + workforceNationalityPenalty);
        const saudiNetMonthly = saudiMonthlyValue - (saudiAbsenceDeduction + saudiAbsencePenalty + saudiNationalityPenalty);

        departmentDataForAchievement = [
          {
            id: 'workforce',
            name: getItemTitle('workforce', 'العمالة'),
            monthlyValue: workforceMonthlyValue,
            absenceDeduction: workforceAbsenceDeduction,
            absencePenalty: workforceAbsencePenalty,
            performancePenalty: totalPerformancePenalty,
            nationalityPenalty: workforceNationalityPenalty,
            netMonthly: workforceNetMonthly
          },
          {
            id: 'saudi_admin',
            name: getItemTitle('saudi_admin', 'الوظائف الإدارية السعوديين'),
            monthlyValue: saudiMonthlyValue,
            absenceDeduction: saudiAbsenceDeduction,
            absencePenalty: saudiAbsencePenalty,
            performancePenalty: 0,
            nationalityPenalty: saudiNationalityPenalty,
            netMonthly: saudiNetMonthly
          }
        ];

        const dentalData = (typeof getDentalData === 'function') ? getDentalData() : zeroDentalData();

        const grandTotalMonthlyValue = workforceMonthlyValue + saudiMonthlyValue + toNumber(dentalData.monthlyValue);
        const grandTotalAbsenceDeduction = workforceAbsenceDeduction + saudiAbsenceDeduction + toNumber(dentalData.absenceDeduction);
        const grandTotalAbsencePenalty = workforceAbsencePenalty + saudiAbsencePenalty + toNumber(dentalData.absencePenalty);
        const grandTotalPerformancePenalty = totalPerformancePenalty + toNumber(dentalData.performancePenalty);
        const grandTotalNationalityPenalty = workforceNationalityPenalty + saudiNationalityPenalty + toNumber(dentalData.nationalityPenalty);
        const grandTotalNetMonthly = workforceNetMonthly + saudiNetMonthly + toNumber(dentalData.netMonthly);

        renderAchievementTable(
          grandTotalMonthlyValue,
          grandTotalAbsenceDeduction,
          grandTotalAbsencePenalty,
          grandTotalPerformancePenalty,
          grandTotalNationalityPenalty,
          grandTotalNetMonthly
        );

        try { localStorage.setItem('finalLaborCost', grandTotalNetMonthly.toFixed(2)); } catch (_) {}
        console.info('[AchievementFix] تم احتساب القيمة الشهرية من الحضور والمدة الحالية مباشرة:', getExtractPeriodSafe());
      } catch (error) {
        console.error('[AchievementFix] فشل الإصلاح الآمن، سيتم الرجوع للحساب الأصلي:', error);
        return originalLoad.apply(this, arguments);
      }
    };

    setTimeout(function () {
      try { window.loadAndProcessAchievementData(); } catch (_) {}
    }, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(installAchievementCalculationFix, 0);
    });
  } else {
    setTimeout(installAchievementCalculationFix, 0);
  }
  function refreshStepperFromRevisionStorage() {
  try {
    var old = document.getElementById('njs-stepper');
    if (old) old.remove();

    buildStepper();

    console.warn('[ExtractStepper] refreshed from revision/current extract storage');
  } catch (e) {
    console.warn('[ExtractStepper] failed to refresh from revision/current extract storage', e);
  }
}

window.addEventListener('najranRevisionSettingsHydrated', function () {
  refreshStepperFromRevisionStorage();
});

setTimeout(function () {
  try {
    if (
      localStorage.getItem('najran_revision_mode') === 'true' &&
      (
        localStorage.getItem('extractMonth') ||
        localStorage.getItem('najran_revision_snapshot')
      )
    ) {
      refreshStepperFromRevisionStorage();
    }
  } catch (_) {}
}, 1800);
})();
