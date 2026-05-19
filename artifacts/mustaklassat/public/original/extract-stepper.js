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

  function detectCurrentStep() {
    const p = window.location.pathname;
    if (p.includes('health_centers_consumables')) return { type: 'health', key: 'health_consumables' };
    if (p.includes('health_centers_attendance'))  return { type: 'health', key: 'health_attendance' };
    if (p.includes('performance'))  return { type: 'labor', key: 'labor_performance' };
    if (p.includes('achievement'))  return { type: 'labor', key: 'labor_achievement' };
    if (p.includes('attendance') && !p.includes('health')) return { type: 'labor', key: 'labor_attendance' };
    return null;
  }

  function getMonthLabel() {
    try {
      const ed = JSON.parse(localStorage.getItem('persistentExtractData') || '{}');
      const m = (ed.extractMonth || '').trim();
      const y = ed.extractYear || '';
      return m ? `📅 ${m} ${y}` : '';
    } catch { return ''; }
  }

  function buildStepper() {
    const current = detectCurrentStep();
    if (!current) return;

    const steps = current.type === 'health' ? STEPS_HEALTH : buildLaborSteps();
    const flowTitle = current.type === 'health' ? 'مستخلص المراكز الصحية' : 'مستخلص العمالة';
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
      #njs-stepper{font-family:'Tajawal',sans-serif;background:linear-gradient(135deg,#1e3c72,#2a5298);padding:12px 20px 14px;direction:rtl;position:sticky;top:0;z-index:200}
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
