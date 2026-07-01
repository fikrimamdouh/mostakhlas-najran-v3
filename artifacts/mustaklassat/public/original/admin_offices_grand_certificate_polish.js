// ===================================================================
// Admin Offices Grand Certificate Polish + Calculation Unifier
// Scope: admin_offices_attendance.html only
// يوحد حساب شهادة الإنجاز والشهادة الإجمالية وإجمالي الصفحة مع منطق الحضور والانصراف المعتمد.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;

  const ABSENCE_FINES = {
    1: { saudi: 500, non_saudi: 500 },
    2: { saudi: 500, non_saudi: 500 },
    3: { saudi: 250, non_saudi: 100 },
    4: { saudi: 180, non_saudi: 80 },
    5: { saudi: 150, non_saudi: 80 },
    6: { saudi: 20, non_saudi: 20 },
    7: { saudi: 10, non_saudi: 10 },
    default: { saudi: 0, non_saudi: 0 }
  };

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function esc(v) {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function money(v) {
    return (Number(v) || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function fmtDate(v) {
    if (!v) return 'غير محدد';
    try { return new Date(v).toLocaleDateString('en-CA'); } catch (_) { return 'غير محدد'; }
  }

  function getNames() {
    try { if (typeof getCenterNames === 'function') return getCenterNames() || {}; } catch (_) {}
    return readJson('adminOfficeNames_v1', {});
  }

  function getData() {
    try { if (typeof getAttendanceData === 'function') return getAttendanceData() || {}; } catch (_) {}
    return readJson('adminOfficesAttendanceData_v1', {});
  }

  function getExtract() {
    return readJson('persistentExtractData', {});
  }

  function getContract() {
    return readJson('persistentContractData', {});
  }

  function getPeriod() {
    try {
      if (typeof getExtractPeriodDetails === 'function') {
        const p = getExtractPeriodDetails() || {};
        if (p.daysInExtract && p.totalDaysInMonth) return p;
      }
    } catch (_) {}

    const extract = getExtract();
    const start = new Date(extract.extractStart || new Date());
    const end = new Date(extract.extractEnd || extract.extractStart || new Date());
    return {
      startDate: start,
      daysInExtract: Math.max(1, Math.ceil((end - start) / 86400000) + 1 || 30),
      totalDaysInMonth: new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate() || 30
    };
  }

  function orderedKeys() {
    const names = getNames();
    const data = getData();
    const merged = Array.from(new Set([...Object.keys(names || {}), ...Object.keys(data || {})]));
    return merged
      .filter(k => k && (k === 'admin_staff' || /^center_\d+$/.test(k) || Array.isArray(data[k])))
      .sort((a, b) => {
        if (/^center_\d+$/.test(a) && /^center_\d+$/.test(b)) return parseInt(a.split('_')[1], 10) - parseInt(b.split('_')[1], 10);
        if (/^center_\d+$/.test(a)) return -1;
        if (/^center_\d+$/.test(b)) return 1;
        if (a === 'admin_staff') return 1;
        if (b === 'admin_staff') return -1;
        return String(a).localeCompare(String(b), 'ar');
      });
  }

  function isSaudi(n) {
    return String(n || '').replace(/\s+/g, '').includes('سعودي');
  }

  function fineConfig(cat) {
    try {
      if (typeof getAdminOfficeFineConfig === 'function') return getAdminOfficeFineConfig(cat);
    } catch (_) {}
    return ABSENCE_FINES[cat] || ABSENCE_FINES[String(cat)] || ABSENCE_FINES.default;
  }

  function getHeader() {
    try { if (typeof getHeaderForCenter === 'function') return getHeaderForCenter(orderedKeys()[0]); } catch (_) {}
    return { logoSrc: 'najran_health_cluster_logo.png', h1: 'فرع وزارة الصحة بمنطقة نجران', h3: 'المكاتب الإدارية والمرافق الصحية' };
  }

  function getStatusMeta(code) {
    try {
      if (typeof STATUS_CODES !== 'undefined' && STATUS_CODES && STATUS_CODES[code]) return STATUS_CODES[code];
    } catch (_) {}
    if (code === 'غ') return { isAbsence: true };
    if (code === 'غ•') return { noDeduction: true, noFine: true };
    if (['ج', 'ش', 'ب', 'ن'].includes(code)) return { isSpecial: true };
    return { isAbsence: false };
  }

  function fallbackEmployeeCalc(emp, period, contract) {
    const totalDaysInMonth = Number(period.totalDaysInMonth) || 30;
    const daysInExtract = Number(period.daysInExtract) || 30;
    const salary = Number(emp && emp.salary) || 0;
    const dailyRate = totalDaysInMonth > 0 ? salary / totalDaysInMonth : 0;
    const ratio = Number(contract && contract.directPurchaseRatio) || 0;

    let costForPeriod = dailyRate * daysInExtract;
    if (contract && contract.contractType === 'شراء مباشر' && ratio > 0) {
      costForPeriod += costForPeriod * ratio / 100;
    }

    const days = Array.isArray(emp && emp.days) ? emp.days.slice(0, daysInExtract) : [];
    while (days.length < daysInExtract) days.push('ح');

    let attendanceDays = 0;
    let absenceDays = 0;
    let deductionOnlyDays = 0;

    days.forEach(day => {
      const meta = getStatusMeta(day);
      if (day === 'غ•' || meta.noDeduction || meta.noFine) return;
      if (day === 'ح' || day === 'ت') attendanceDays++;
      else if (day === 'غ' || meta.isAbsence) absenceDays++;
      else deductionOnlyDays++;
    });

    const deduction = (absenceDays + deductionOnlyDays) * dailyRate;
    const cfg = fineConfig(emp && emp.category || 1);
    const absenceFine = absenceDays * (isSaudi(emp && emp.nationality) ? cfg.saudi : cfg.non_saudi);
    const nationalityFine = Number(emp && emp.nationalityFine) || 0;
    const totalFine = absenceFine + nationalityFine;
    const netSalary = costForPeriod - deduction - totalFine;

    return {
      days,
      dailyRate,
      costForPeriod,
      attendanceDays,
      absenceDays,
      deductionOnlyDays,
      deduction,
      absenceFine,
      nationalityFine,
      totalFine,
      netSalary
    };
  }

  function employeeCalc(emp, period, contract) {
    try {
      if (typeof calculateAdminOfficeEmployeeFinancials === 'function') {
        return calculateAdminOfficeEmployeeFinancials(emp, {
          totalDaysInMonth: period.totalDaysInMonth,
          daysInExtract: period.daysInExtract,
          contractType: contract.contractType || 'عقد أساسي',
          directPurchaseRatio: Number(contract.directPurchaseRatio) || 0
        });
      }
    } catch (err) {
      console.warn('[Admin Offices Calculation Unifier] fallback employee calc used:', err);
    }
    return fallbackEmployeeCalc(emp, period, contract);
  }

  function performanceDeductions() {
    const legacy = readJson('performanceDeductions', {});
    const separated = readJson('adminOfficePerformanceDeductions_v1', {});
    return Object.assign({}, legacy, separated);
  }

  function calcSite(centerKey) {
    const rows = Array.isArray(getData()[centerKey]) ? getData()[centerKey] : [];
    const period = getPeriod();
    const contract = getContract();
    const out = {
      count: rows.length,
      cost: 0,
      absenceDeduction: 0,
      absenceFine: 0,
      nationalityFine: 0,
      fines: 0,
      laborNet: 0
    };

    rows.forEach(emp => {
      const c = employeeCalc(emp, period, contract);
      out.cost += Number(c.costForPeriod) || 0;
      out.absenceDeduction += Number(c.deduction) || 0;
      out.absenceFine += Number(c.absenceFine) || 0;
      out.nationalityFine += Number(c.nationalityFine) || 0;
      out.fines += Number(c.totalFine) || 0;
      out.laborNet += Number(c.netSalary) || 0;
    });

    return out;
  }

  function calculateAchievementValuesUnified(centerKey) {
    const centerData = Array.isArray(getData()[centerKey]) ? getData()[centerKey] : [];
    const site = calcSite(centerKey);
    const perf = performanceDeductions();
    const performancePenalty = Number(perf[centerKey]) || 0;
    const netMonthly = site.laborNet - performancePenalty;

    return {
      centerData,
      totalMonthlyValue: site.cost,
      totalAbsenceDeduction: site.absenceDeduction,
      totalAbsencePenalty: site.absenceFine,
      performancePenalty,
      totalNationalityPenalty: site.nationalityFine,
      netMonthly
    };
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function calculateAndDisplayGrandTotalUnified() {
    const data = getData();
    const keys = Array.from(new Set([...orderedKeys(), ...Object.keys(data || {})]));
    const total = { count: 0, cost: 0, deduction: 0, fines: 0, net: 0 };

    keys.forEach(key => {
      if (!Array.isArray(data[key])) return;
      const c = calcSite(key);
      total.count += c.count;
      total.cost += c.cost;
      total.deduction += c.absenceDeduction;
      total.fines += c.fines;
      total.net += c.laborNet;
    });

    setText('grand-total-count', String(total.count));
    setText('grand-total-cost', money(total.cost));
    setText('grand-total-deduction', money(total.deduction));
    setText('grand-total-fines', money(total.fines));
    setText('grand-net-total', money(total.net));
    try { localStorage.setItem('grand-net-total-admin', money(total.net)); } catch (_) {}

    return total;
  }

  function installCalculationOverrides() {
    window.calculateAchievementValues = calculateAchievementValuesUnified;
    window.calculateAndDisplayGrandTotal = calculateAndDisplayGrandTotalUnified;
    window.updateGrandTotal = calculateAndDisplayGrandTotalUnified;

    try { calculateAchievementValues = calculateAchievementValuesUnified; } catch (_) {}
    try { calculateAndDisplayGrandTotal = calculateAndDisplayGrandTotalUnified; } catch (_) {}
    try { updateGrandTotal = calculateAndDisplayGrandTotalUnified; } catch (_) {}
  }

  function certCss() {
    return `<style>
      @page{size:A4 landscape;margin:8mm}
      *{box-sizing:border-box}
      body{margin:0;background:#eef3f8;color:#0f172a;font-family:Tajawal,Arial,sans-serif;direction:rtl}
      .toolbar{position:sticky;top:0;z-index:5;display:flex;gap:10px;justify-content:center;padding:12px;background:#0f172a;box-shadow:0 8px 24px rgba(15,23,42,.25)}
      .toolbar button{border:0;border-radius:10px;padding:10px 18px;font-weight:800;cursor:pointer;background:#d4af37;color:#111827}
      .toolbar button.secondary{background:#fff;color:#0f172a}
      .cert{max-width:1280px;margin:18px auto;background:#fff;border:1px solid #dbe4ef;border-radius:20px;box-shadow:0 18px 50px rgba(15,23,42,.12);padding:22px}
      .head{position:relative;text-align:center;border-bottom:4px solid #003087;padding:8px 115px 14px;margin-bottom:16px}
      .head img{position:absolute;top:4px;width:82px;height:auto}.head .r{right:12px}.head .l{left:12px}
      .head h1{margin:0;color:#003087;font-size:25px;font-weight:900}.head h2{margin:7px 0 3px;font-size:23px;color:#111827}.head h3{margin:0;font-size:15px;color:#475569}
      .info{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}.info div{border:1px solid #bfdbfe;background:#eff6ff;border-radius:12px;padding:10px;font-weight:800}.info b{color:#003087}
      .cards{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:14px 0}.card{background:linear-gradient(135deg,#003087,#1e40af);color:#fff;border-radius:16px;padding:13px;text-align:center}.card.gold{background:linear-gradient(135deg,#d4af37,#f8e08e);color:#111827}.card span{display:block;font-size:12px;opacity:.92}.card strong{display:block;font-size:20px;margin-top:5px}
      table{width:100%;border-collapse:collapse;font-size:12px;background:#fff;margin-top:12px}th{background:#003087;color:#fff;border:1px solid #1e3a8a;padding:8px}td{border:1px solid #cbd5e1;padding:7px;text-align:center}td.site{text-align:right;font-weight:800}tbody tr:nth-child(even) td{background:#f8fafc}tfoot th{background:#d4af37;color:#111827;border:1px solid #b08921;padding:8px}
      .sign{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;text-align:center;margin-top:28px}.sign>div{font-weight:900}.line{height:48px;border-bottom:1px solid #111;margin:8px 25px 0}
      .sb-print,.sb-print *{font-family:Tajawal,Arial,sans-serif!important}
      @media print{body{background:#fff}.toolbar{display:none}.cert{max-width:none;margin:0;box-shadow:none;border:0;border-radius:0;padding:0}.head{margin-top:0}table{font-size:10.5px}td,th{padding:5px}.cards{gap:6px}.info{gap:6px}}
    </style>`;
  }

  function grandSignaturesHtml() {
    try {
      const key = typeof getAdminOfficePageSignatureKey === 'function'
        ? getAdminOfficePageSignatureKey('grand_certificate', 'grand_certificate')
        : 'admin_offices_grand_certificate';
      if (window.SignatureBlock && typeof window.SignatureBlock.buildPrintHTML === 'function') {
        const html = window.SignatureBlock.buildPrintHTML(key);
        if (html && String(html).trim()) return html;
      }
    } catch (_) {}

    return '<section class="sign"><div>إعداد<div class="line"></div></div><div>مراجعة<div class="line"></div></div><div>اعتماد<div class="line"></div></div></section>';
  }

  function buildCertificateHtml() {
    installCalculationOverrides();

    const names = getNames();
    const contract = getContract();
    const extract = getExtract();
    const header = getHeader();
    const perf = performanceDeductions();
    const keys = orderedKeys();

    const total = {
      count: 0,
      cost: 0,
      absenceDeduction: 0,
      absenceFine: 0,
      nationalityFine: 0,
      fines: 0,
      laborNet: 0,
      perf: 0,
      finalNet: 0
    };

    const rows = keys.map((key, i) => {
      const c = calcSite(key);
      const p = Number(perf[key]) || 0;
      const finalNet = c.laborNet - p;

      total.count += c.count;
      total.cost += c.cost;
      total.absenceDeduction += c.absenceDeduction;
      total.absenceFine += c.absenceFine;
      total.nationalityFine += c.nationalityFine;
      total.fines += c.fines;
      total.laborNet += c.laborNet;
      total.perf += p;
      total.finalNet += finalNet;

      const siteName = names[key] || (key === 'admin_staff' ? 'الورش (صيانة وإصلاح السيارات)' : key);
      return `
        <tr>
          <td>${i + 1}</td>
          <td class="site">${esc(siteName)}</td>
          <td>${c.count}</td>
          <td>${money(c.cost)}</td>
          <td>${money(c.absenceDeduction)}</td>
          <td>${money(c.absenceFine)}</td>
          <td>${money(c.nationalityFine)}</td>
          <td>${money(c.fines)}</td>
          <td>${money(c.laborNet)}</td>
          <td>${money(p)}</td>
          <td><b>${money(finalNet)}</b></td>
        </tr>`;
    }).join('');

    return `
      <div class="toolbar">
        <button onclick="window.print()">طباعة الشهادة</button>
        <button class="secondary" onclick="window.close()">إغلاق</button>
      </div>
      <main class="cert">
        <section class="head">
          <img class="r" src="${esc(header.logoSrc || 'najran_health_cluster_logo.png')}">
          <img class="l" src="${esc(header.logoSrc || 'najran_health_cluster_logo.png')}">
          <h1>${esc(header.h1 || 'فرع وزارة الصحة بمنطقة نجران')}</h1>
          <h2>الشهادة الإجمالية للمكاتب الإدارية والمرافق الصحية</h2>
          <h3>مستخلص العمالة لجميع المواقع والورش</h3>
        </section>

        <section class="info">
          <div><b>الشركة:</b> ${esc(contract.companyName || document.querySelector('.companyName')?.textContent || 'غير محدد')}</div>
          <div><b>نوع العقد:</b> ${esc(contract.contractType || 'غير محدد')}</div>
          <div><b>الفترة:</b> من ${esc(fmtDate(extract.extractStart))} إلى ${esc(fmtDate(extract.extractEnd))}</div>
          <div><b>عدد المواقع:</b> ${keys.length}</div>
        </section>

        <section class="cards">
          <div class="card"><span>إجمالي العمالة</span><strong>${total.count}</strong></div>
          <div class="card"><span>إجمالي التكلفة</span><strong>${money(total.cost)}</strong></div>
          <div class="card"><span>غرامات وحسميات العمالة</span><strong>${money(total.absenceDeduction + total.fines)}</strong></div>
          <div class="card"><span>خصم الأداء</span><strong>${money(total.perf)}</strong></div>
          <div class="card gold"><span>الصافي النهائي</span><strong>${money(total.finalNet)}</strong></div>
        </section>

        <table>
          <thead>
            <tr>
              <th>م</th><th>الموقع</th><th>العمالة</th><th>التكلفة</th><th>حسم الغياب/الحالات</th>
              <th>غرامة الغياب</th><th>غرامة الجنسية</th><th>إجمالي الغرامات</th><th>صافي العمالة</th><th>خصم الأداء</th><th>الصافي النهائي</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="11">لا توجد بيانات للمكاتب.</td></tr>'}</tbody>
          <tfoot>
            <tr>
              <th colspan="2">الإجمالي</th>
              <th>${total.count}</th>
              <th>${money(total.cost)}</th>
              <th>${money(total.absenceDeduction)}</th>
              <th>${money(total.absenceFine)}</th>
              <th>${money(total.nationalityFine)}</th>
              <th>${money(total.fines)}</th>
              <th>${money(total.laborNet)}</th>
              <th>${money(total.perf)}</th>
              <th>${money(total.finalNet)}</th>
            </tr>
          </tfoot>
        </table>

        ${grandSignaturesHtml()}
      </main>`;
  }

  function showPolishedGrandCertificate() {
    installCalculationOverrides();
    const win = window.open('', '', 'width=1400,height=900');
    if (!win) return alert('المتصفح منع نافذة الشهادة. اسمح بالنوافذ المنبثقة.');
    win.document.open();
    win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>الشهادة الإجمالية للمكاتب الإدارية</title><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">${certCss()}</head><body>${buildCertificateHtml()}</body></html>`);
    win.document.close();
  }

  function bindExistingButton() {
    installCalculationOverrides();
    window.showAdminOfficesGrandCertificate = showPolishedGrandCertificate;
    window.showGrandAchievementCertificate = showPolishedGrandCertificate;
    try { showGrandAchievementCertificate = showPolishedGrandCertificate; } catch (_) {}

    const buttons = Array.from(document.querySelectorAll('button, a'));
    buttons.forEach(btn => {
      const text = (btn.textContent || '').trim();
      const onclick = String(btn.getAttribute('onclick') || '');
      if (text === 'الشهادة الإجمالية' || onclick.includes('showGrandAchievementCertificate') || onclick.includes('showAdminOfficesGrandCertificate')) {
        btn.onclick = function (e) {
          if (e) { e.preventDefault(); e.stopPropagation(); }
          showPolishedGrandCertificate();
          return false;
        };
      }
    });

    try { calculateAndDisplayGrandTotalUnified(); } catch (_) {}
  }

  installCalculationOverrides();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindExistingButton);
  else bindExistingButton();
  setTimeout(bindExistingButton, 700);
  setTimeout(bindExistingButton, 1800);
  setTimeout(bindExistingButton, 3500);

  console.info('[Admin Offices Grand Certificate] unified achievement + page totals with attendance calculations v3');
})();