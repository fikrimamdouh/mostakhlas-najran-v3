// ===================================================================
// Admin Offices Raise Letters
// Scope: admin_offices_attendance.html only
// عمالة المكاتب: خطاب إجمالي + إقرار + خطابات مواقع فردية/مختارة
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;

  const SETTINGS_KEY = 'adminOfficesRaiseLettersSettings_v1';
  const VAT_DEFAULT = 15;

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

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value || {}));
  }

  function esc(v) {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function normalizeDigits(value) {
    const ar = '٠١٢٣٤٥٦٧٨٩';
    const fa = '۰۱۲۳۴۵۶۷۸۹';
    return String(value ?? '').replace(/[٠-٩]/g, d => ar.indexOf(d)).replace(/[۰-۹]/g, d => fa.indexOf(d));
  }

  function num(v) {
    const cleaned = normalizeDigits(v).replace(/,/g, '').replace(/[ ريال﷼()]/g, '').trim();
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  function money(v) {
    return num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function moneySAR(v) {
    return `${money(v)} ريال`;
  }

  function fmtDate(v) {
    if (!v) return 'غير محدد';
    try {
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? 'غير محدد' : d.toLocaleDateString('en-CA');
    } catch (_) {
      return 'غير محدد';
    }
  }

  function today() {
    return new Date().toLocaleDateString('en-CA');
  }

  function getContract() {
    return readJson('persistentContractData', {});
  }

  function getExtract() {
    return readJson('persistentExtractData', {});
  }

  function getCompanyName() {
    const c = getContract();
    const dom = document.querySelector('.companyName')?.textContent;
    return c.contractorName || c.companyName || c.company || c.contractor || (dom && dom !== 'غير محدد' ? dom : '') || 'غير محدد';
  }

  function getNames() {
    try {
      if (typeof window.getCenterNames === 'function') return window.getCenterNames() || {};
    } catch (_) {}
    return readJson('adminOfficeNames_v1', {});
  }

  function getAttendance() {
    try {
      if (typeof window.getAttendanceData === 'function') return window.getAttendanceData() || {};
    } catch (_) {}
    return readJson('adminOfficesAttendanceData_v1', {});
  }

  function getPeriod() {
    try {
      if (typeof window.getExtractPeriodDetails === 'function') return window.getExtractPeriodDetails();
    } catch (_) {}
    const e = getExtract();
    const start = new Date(e.extractStart || localStorage.getItem('extractStart') || Date.now());
    const end = new Date(e.extractEnd || localStorage.getItem('extractEnd') || e.extractStart || Date.now());
    const safeStart = Number.isNaN(start.getTime()) ? new Date() : start;
    const safeEnd = Number.isNaN(end.getTime()) ? safeStart : end;
    return {
      startDate: safeStart,
      endDate: safeEnd,
      daysInExtract: Math.max(1, Math.ceil((safeEnd - safeStart) / 86400000) + 1 || 30),
      totalDaysInMonth: new Date(safeStart.getFullYear(), safeStart.getMonth() + 1, 0).getDate() || 30
    };
  }

  function isSaudi(n) {
    return String(n || '').replace(/\s+/g, '').includes('سعودي');
  }

  function fineConfig(cat) {
    return ABSENCE_FINES[cat] || ABSENCE_FINES[String(cat)] || ABSENCE_FINES.default;
  }

  function performanceDeductions() {
    return Object.assign({}, readJson('performanceDeductions', {}), readJson('adminOfficePerformanceDeductions_v1', {}));
  }

  function defaultSettings() {
    return {
      recipient: 'سعادة / ................................',
      recipientSuffix: 'المحترم',
      entityTitle: 'المديرية العامة للشئون الصحية بمنطقة نجران',
      departmentTitle: 'إدارة الشئون الهندسية',
      scopeName: 'المكاتب الإدارية والمرافق الصحية وصيانة وإصلاح السيارات والعيادات المتنقلة',
      vatRate: VAT_DEFAULT,
      phoneFaxAr: 'نجران – تليفون 0175225872    فاكس 017523312',
      phoneFaxEn: 'Najran – Tel.: 0175225872       Fax: 017523312',
      managerTitle: '................................',
      managerName: '................................',
      unitManagerTitle: '................................',
      unitManagerName: '................................',
      declarationDate: today(),
      declarationAmountMode: 'laborGrandTotal',
      declarationManualAmount: 0,
      siteLetterDefaultCenter: ''
    };
  }

  function getActiveExtractMeta() {
    const e = getExtract();
    const paymentNo = e.paymentNumber || e.extractNumber || localStorage.getItem('paymentNumber') || localStorage.getItem('extractNumber') || '—';
    const start = e.extractStart || localStorage.getItem('extractStart') || '';
    const end = e.extractEnd || localStorage.getItem('extractEnd') || '';
    return {
      paymentNo: String(paymentNo).match(/^\d+$/) ? String(paymentNo).padStart(2, '0') : String(paymentNo),
      start,
      end
    };
  }

  function extractPhrase() {
    const m = getActiveExtractMeta();
    return `دفعة رقم (${esc(m.paymentNo)}) عن الفترة من ${esc(fmtDate(m.start))} م إلى ${esc(fmtDate(m.end))} م`;
  }

  function getSettings() {
    const settings = Object.assign(defaultSettings(), readJson(SETTINGS_KEY, {}));
    const meta = getActiveExtractMeta();
    settings.paymentNo = meta.paymentNo;
    settings.extractStart = meta.start;
    settings.extractEnd = meta.end;
    return settings;
  }

  function saveSettings(patch) {
    const current = readJson(SETTINGS_KEY, {});
    const cleanPatch = Object.assign({}, patch || {});
    ['paymentNo','extractStart','extractEnd','period1Start','period1End','period2Start','period2End','period1LaborNet','period2LaborNet','consumablesPeriod1Net','consumablesPeriod2Net','consumablesNet','purchasePeriodLabel'].forEach(k => delete cleanPatch[k]);
    writeJson(SETTINGS_KEY, Object.assign(defaultSettings(), current, cleanPatch));
  }

  function orderedOfficeKeys() {
    const names = getNames();
    const data = getAttendance();
    return Array.from(new Set([...Object.keys(names || {}), ...Object.keys(data || {})]))
      .filter(k => k === 'admin_staff' || /^center_\d+$/.test(k) || Array.isArray(data[k]))
      .sort((a, b) => {
        if (a.startsWith('center_') && b.startsWith('center_')) return parseInt(a.split('_')[1], 10) - parseInt(b.split('_')[1], 10);
        if (a.startsWith('center_')) return -1;
        if (b.startsWith('center_')) return 1;
        return a.localeCompare(b, 'ar');
      });
  }

  function calcSite(centerKey) {
    const rows = getAttendance()[centerKey] || [];
    const p = getPeriod();
    const c = getContract();
    const ratio = num(c.directPurchaseRatio);
    const out = { count: rows.length, cost: 0, absenceDeduction: 0, absenceFine: 0, nationalityFine: 0, fines: 0, netBeforePerformance: 0, performanceDeduction: 0, finalNet: 0 };

    rows.forEach(emp => {
      if (typeof window.calculateAdminOfficeEmployeeFinancials === 'function') {
        const calc = window.calculateAdminOfficeEmployeeFinancials(emp, {
          totalDaysInMonth: p.totalDaysInMonth,
          daysInExtract: p.daysInExtract,
          contractType: c.contractType || 'عقد أساسي',
          directPurchaseRatio: ratio
        });
        out.cost += num(calc.costForPeriod);
        out.absenceDeduction += num(calc.deduction);
        out.absenceFine += num(calc.absenceFine);
        out.nationalityFine += num(calc.nationalityFine);
        out.fines += num(calc.totalFine);
        out.netBeforePerformance += num(calc.netSalary);
        return;
      }

      const salary = num(emp.salary);
      const daily = p.totalDaysInMonth > 0 ? salary / p.totalDaysInMonth : 0;
      const days = Array.isArray(emp.days) ? emp.days.slice(0, p.daysInExtract) : [];
      while (days.length < p.daysInExtract) days.push('ح');
      let cost = daily * p.daysInExtract;
      if (c.contractType === 'شراء مباشر' && ratio > 0) cost += cost * ratio / 100;

      let absenceDays = 0;
      days.forEach(d => {
        const st = window.STATUS_CODES && window.STATUS_CODES[d];
        if (st && st.isAbsence) absenceDays++;
        else if (!st && d === 'غ') absenceDays++;
      });
      const absenceDeduction = absenceDays * daily;
      const cfg = fineConfig(emp.category || 1);
      const absenceFine = absenceDays * (isSaudi(emp.nationality) ? cfg.saudi : cfg.non_saudi);
      const natFine = num(emp.nationalityFine);
      const net = cost - absenceDeduction - absenceFine - natFine;

      out.cost += cost;
      out.absenceDeduction += absenceDeduction;
      out.absenceFine += absenceFine;
      out.nationalityFine += natFine;
      out.fines += absenceFine + natFine;
      out.netBeforePerformance += net;
    });

    out.performanceDeduction = num(performanceDeductions()[centerKey]);
    out.finalNet = out.netBeforePerformance - out.performanceDeduction;
    return out;
  }

  function calcGrandLabor() {
    return orderedOfficeKeys().reduce((total, key) => {
      const c = calcSite(key);
      Object.keys(c).forEach(k => total[k] = num(total[k]) + num(c[k]));
      return total;
    }, { count: 0, cost: 0, absenceDeduction: 0, absenceFine: 0, nationalityFine: 0, fines: 0, netBeforePerformance: 0, performanceDeduction: 0, finalNet: 0 });
  }

  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
  const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

  function underThousand(n) {
    n = Math.floor(num(n));
    const parts = [];
    const h = Math.floor(n / 100);
    const r = n % 100;
    if (h) parts.push(hundreds[h]);
    if (r) {
      if (r < 10) parts.push(ones[r]);
      else if (r < 20) parts.push(teens[r - 10]);
      else {
        const o = r % 10;
        const t = Math.floor(r / 10);
        parts.push(o ? `${ones[o]} و${tens[t]}` : tens[t]);
      }
    }
    return parts.join(' و');
  }

  function scaleName(value, singular, dual, plural) {
    if (value === 1) return singular;
    if (value === 2) return dual;
    if (value >= 3 && value <= 10) return plural;
    return singular;
  }

  function intToArabicWords(n) {
    n = Math.floor(num(n));
    if (n === 0) return 'صفر';
    const scales = [
      { value: 1000000000, singular: 'مليار', dual: 'ملياران', plural: 'مليارات' },
      { value: 1000000, singular: 'مليون', dual: 'مليونان', plural: 'ملايين' },
      { value: 1000, singular: 'ألف', dual: 'ألفان', plural: 'آلاف' }
    ];
    const parts = [];
    for (const s of scales) {
      const v = Math.floor(n / s.value);
      if (v) {
        if (v === 1) parts.push(s.singular);
        else if (v === 2) parts.push(s.dual);
        else parts.push(`${underThousand(v)} ${scaleName(v, s.singular, s.dual, s.plural)}`);
        n %= s.value;
      }
    }
    if (n) parts.push(underThousand(n));
    return parts.join(' و');
  }

  function tafqeetSAR(amount) {
    const total = Math.round(num(amount) * 100) / 100;
    const negative = total < 0;
    const abs = Math.abs(total);
    const riyal = Math.floor(abs);
    const halala = Math.round((abs - riyal) * 100);
    let txt = `فقط وقدره ${intToArabicWords(riyal)} ريال سعودي`;
    if (halala > 0) txt += ` و${intToArabicWords(halala)} هللة`;
    txt += ' لا غير';
    return negative ? `سالب ${txt}` : txt;
  }

  function logoSrc() { return 'moh_logo.png'; }
  function headerHtml(settings) { return `<div class="head"><img src="${esc(logoSrc())}"><div class="t"><h1>${esc(settings.entityTitle)}</h1><h2>${esc(settings.departmentTitle)}</h2></div><img src="${esc(logoSrc())}"></div>`; }
  function footerHtml(settings) { return `<div class="footer"><span>${esc(settings.phoneFaxEn)}</span><span dir="rtl">${esc(settings.phoneFaxAr)}</span></div>`; }
  function toHtml(settings) { return `<div class="to"><span class="recipient-name">${esc(settings.recipient)}</span><span class="recipient-suffix">${esc(settings.recipientSuffix)}</span></div>`; }

  function signatureHtml(settings, mode) {
    if (mode === 'two') {
      return `<div class="signatures"><div><div class="sig-title">${esc(settings.unitManagerTitle)}</div><div class="line"></div><div class="sig-name">${esc(settings.unitManagerName)}</div></div><div><div class="sig-title">${esc(settings.managerTitle)}</div><div class="line"></div><div class="sig-name">${esc(settings.managerName)}</div></div></div>`;
    }
    return `<div class="signatures one"><div><div class="sig-title">${esc(settings.managerTitle)}</div><div class="line"></div><div class="sig-name">${esc(settings.managerName)}</div></div></div>`;
  }

  function docCss() {
    return `<style>
      @page{size:A4 portrait;margin:12mm}
      *{box-sizing:border-box}
      body{direction:rtl;margin:0;background:#e9eef5;color:#111827;font-family:Tajawal,Arial,sans-serif}
      .toolbar{position:sticky;top:0;display:flex;justify-content:center;gap:10px;background:#111827;padding:10px;z-index:5}.toolbar button{border:0;border-radius:10px;padding:10px 18px;font-weight:900;cursor:pointer;background:#d4af37;color:#111}
      .page{width:210mm;min-height:297mm;margin:12px auto;background:#fff;padding:14mm 15mm 18mm;box-shadow:0 10px 30px rgba(15,23,42,.16);position:relative}
      .head{display:grid;grid-template-columns:82px 1fr 82px;align-items:center;border-bottom:2px solid #003087;padding-bottom:12px;margin-bottom:30px}.head img{width:72px;height:auto}.head .t{text-align:center}.head h1{font-size:17px;margin:0 0 5px;color:#003087;font-weight:900}.head h2{font-size:15px;margin:0;color:#111827;font-weight:800}
      .to{font-size:15.5px;font-weight:900;margin:4px 0 24px;line-height:2}.recipient-name,.recipient-suffix{display:inline}.recipient-suffix{margin-right:20px;padding-right:0}
      .salam{text-align:center;font-size:15.5px;font-weight:900;margin:20px 0 14px}.body-text{font-size:15px;line-height:2.15;text-align:justify;margin-top:6px}.amount-table{width:100%;border-collapse:collapse;margin:18px 0 14px;font-size:14px}.amount-table td,.amount-table th{border:1px solid #333;padding:8px}.amount-table td:first-child{text-align:right;font-weight:700;width:70%}.amount-table td:last-child{text-align:center;font-weight:900;direction:ltr;white-space:nowrap}.amount-table .grand td{background:#fff7d6;font-weight:900}.tafqeet{border:1px solid #94a3b8;background:#f8fafc;border-radius:8px;padding:8px 12px;margin-top:8px;font-weight:900;line-height:1.8}.closing{font-size:15px;line-height:2;margin-top:18px}
      .signatures{display:grid;grid-template-columns:repeat(2,1fr);gap:20px;margin-top:44px;text-align:center}.signatures.one{display:block;margin-top:48px}.signatures.one>div{width:78mm;margin-right:auto;margin-left:0;text-align:center}.sig-title{font-weight:900;margin-bottom:18px}.line{height:34px;border-bottom:1px solid #111;margin:0 18px 10px}.sig-name{font-weight:900;margin-top:8px}.footer{position:absolute;bottom:10mm;left:15mm;right:15mm;border-top:1px solid #cbd5e1;padding-top:5px;font-size:11px;display:flex;justify-content:space-between;direction:ltr}
      .settings-overlay{position:fixed;inset:0;background:rgba(15,23,42,.72);z-index:999999;display:flex;align-items:center;justify-content:center;padding:18px;direction:rtl;font-family:Tajawal,Arial,sans-serif}.settings-dialog{width:min(1220px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:18px;padding:18px;box-shadow:0 25px 70px rgba(0,0,0,.3)}.settings-dialog h2{margin:0 0 14px;color:#003087}.settings-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.field{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:10px}.field label{display:block;font-size:12px;font-weight:900;color:#334155;margin-bottom:6px}.field input,.field select{width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:8px;font-family:inherit}.readonly-box{padding:9px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;font-weight:900;line-height:1.8}.btn-row{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.btn{border:0;border-radius:10px;padding:9px 14px;font-weight:900;cursor:pointer}.btn-primary{background:#003087;color:#fff}.btn-gold{background:#d4af37;color:#111}.btn-light{background:#f1f5f9;color:#111}.section-box{border:1px solid #e2e8f0;border-radius:14px;padding:12px;margin-top:12px;background:#f8fafc}.section-box h3{margin:0 0 12px;color:#003087;font-weight:900}.site-checks{max-height:260px;overflow:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px}.site-check{display:flex;gap:8px;align-items:center;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px;font-weight:800}.site-check input{width:auto}
      @media print{body{background:#fff}.toolbar{display:none}.page{margin:0;box-shadow:none;width:auto;min-height:calc(297mm - 24mm);padding:0}.footer{bottom:0}.page{page-break-after:always}.page:last-child{page-break-after:auto}}
    </style>`;
  }

  function openPrintDoc(title, bodyHtml) {
    const win = window.open('', '', 'width=1000,height=900');
    if (!win) return alert('المتصفح منع نافذة الطباعة. اسمح بالنوافذ المنبثقة.');
    win.document.open();
    win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>${esc(title)}</title><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">${docCss()}</head><body><div class="toolbar"><button onclick="window.print()">طباعة</button><button onclick="window.close()">إغلاق</button></div>${bodyHtml}</body></html>`);
    win.document.close();
  }

  function laborValues() {
    const g = calcGrandLabor();
    const s = getSettings();
    const net = g.finalNet;
    const vat = net * num(s.vatRate) / 100;
    return { net, vat, grand: net + vat, currentGrand: g };
  }

  function laborLetterPage() {
    const s = getSettings();
    const v = laborValues();
    const company = getCompanyName();
    return `<section class="page">${headerHtml(s)}${toHtml(s)}<div class="salam">السلام عليكم ورحمة الله وبركاته، وبعد:</div><div class="body-text">نرفق لسعادتكم المستخلص الشهري لشركة ${esc(company)} والخاص ببند العمالة لمواقع ${esc(s.scopeName)}، ${extractPhrase()}.</div><table class="amount-table"><tbody><tr><td>صافي مستحقات العمالة عن مدة المستخلص</td><td>${moneySAR(v.net)}</td></tr><tr><td>ضريبة القيمة المضافة ${money(s.vatRate)}%</td><td>${moneySAR(v.vat)}</td></tr><tr class="grand"><td>الإجمالي</td><td>${moneySAR(v.grand)}</td></tr></tbody></table><div class="tafqeet">${esc(tafqeetSAR(v.grand))}</div><div class="closing">لذا نأمل بعد الاطلاع إحالته إلى جهة الاختصاص لتدقيقه واستكمال إجراءات صرف مستحقات المقاول / ${esc(company)}.<br>وتقبلوا تحياتنا ،،،</div>${signatureHtml(s, 'one')}${footerHtml(s)}</section>`;
  }

  function generateLaborRaiseLetter() {
    openPrintDoc('خطاب رفع العمالة الإجمالي', laborLetterPage());
  }

  function siteLetterPage(centerKey) {
    const s = getSettings();
    const names = getNames();
    const site = names[centerKey] || centerKey;
    const amount = calcSite(centerKey).finalNet;
    const company = getCompanyName();
    return `<section class="page">${headerHtml(s)}${toHtml(s)}<div class="salam">السلام عليكم ورحمة الله وبركاته، وبعد:</div><div class="body-text">إشارة إلى عقد الصيانة والنظافة والتشغيل غير الطبي لمواقع ${esc(s.scopeName)}، مقاولة ${esc(company)}، نرفق لسعادتكم المستخلص الشهري الخاص بموقع ${esc(site)} ببند العمالة، ${extractPhrase()}، بمبلغ وقدره (${moneySAR(amount)}) ${esc(tafqeetSAR(amount))}.</div><div class="closing">نأمل بعد الاطلاع إحالته إلى جهة الاختصاص لتدقيقه واستكمال إجراءات صرف مستحقات المقاول / ${esc(company)} حسب ما جاء أعلاه.<br>وتقبلوا خالص تحياتنا ،،،</div>${signatureHtml(s, 'one')}${footerHtml(s)}</section>`;
  }

  function generateSiteRaiseLetter(centerKey) {
    const selected = centerKey || document.getElementById('rl-site-select')?.value || getSettings().siteLetterDefaultCenter || orderedOfficeKeys()[0];
    if (!selected) return alert('لا يوجد موقع متاح لطباعة خطاب الموقع.');
    openPrintDoc('خطاب رفع موقع', siteLetterPage(selected));
  }

  function selectedSiteKeys() {
    const keys = Array.from(document.querySelectorAll('.rl-site-check:checked')).map(cb => cb.value).filter(Boolean);
    return keys.length ? keys : orderedOfficeKeys();
  }

  function generateSelectedSiteLetters() {
    const keys = selectedSiteKeys();
    if (!keys.length) return alert('اختر موقعًا واحدًا على الأقل.');
    openPrintDoc('خطابات رفع المواقع المختارة', keys.map(siteLetterPage).join(''));
  }

  function generateDeclaration() {
    const s = getSettings();
    const company = getCompanyName();
    const v = laborValues();
    const amount = s.declarationAmountMode === 'manual' ? num(s.declarationManualAmount) : v.grand;
    const body = `<section class="page">${headerHtml(s)}<div style="text-align:left;font-size:14px;font-weight:900">التاريخ : ${esc(fmtDate(s.declarationDate))} م</div><div class="report-title" style="text-align:center;font-size:19px;font-weight:900;margin:28px 0 18px">إقرار بعدم أسبقية الصرف</div><div class="body-text">تقر إدارة الصيانة بالشئون الهندسية بصحة نجران بأن مستخلص العمالة لشركة ${esc(company)} لمواقع ${esc(s.scopeName)}، ${extractPhrase()}، بمبلغ وقدره (${moneySAR(amount)}) ${esc(tafqeetSAR(amount))}.<br>لم يسبق صرفه من قبلنا.</div>${signatureHtml(s, 'two')}${footerHtml(s)}</section>`;
    openPrintDoc('إقرار عدم أسبقية الصرف', body);
  }

  function settingsField(key, label, type) {
    const s = getSettings();
    return `<div class="field"><label>${esc(label)}</label><input type="${type || 'text'}" data-rl-setting="${esc(key)}" value="${esc(s[key])}"></div>`;
  }

  function renderDialog() {
    const s = getSettings();
    const names = getNames();
    const keys = orderedOfficeKeys();
    const options = keys.map(k => `<option value="${esc(k)}" ${s.siteLetterDefaultCenter === k ? 'selected' : ''}>${esc(names[k] || k)}</option>`).join('');
    const checks = keys.map(k => `<label class="site-check"><input type="checkbox" class="rl-site-check" value="${esc(k)}" checked><span>${esc(names[k] || k)}</span></label>`).join('');
    const total = laborValues();
    const html = `<div class="settings-overlay" id="raise-letters-overlay"><div class="settings-dialog"><h2>خطابات رفع عمالة المكاتب الإدارية</h2><div class="btn-row"><button class="btn btn-primary" onclick="AdminOfficesRaiseLetters.saveDialog()">حفظ الإعدادات</button><button class="btn btn-gold" onclick="AdminOfficesRaiseLetters.generateLaborRaiseLetter()">خطاب العمالة الإجمالي</button><button class="btn btn-gold" onclick="AdminOfficesRaiseLetters.generateDeclaration()">إقرار عدم أسبقية الصرف</button><button class="btn btn-gold" onclick="AdminOfficesRaiseLetters.generateSiteRaiseLetter()">خطاب الموقع المحدد</button><button class="btn btn-gold" onclick="AdminOfficesRaiseLetters.generateSelectedSiteLetters()">خطابات المواقع المختارة</button><button class="btn btn-light" onclick="AdminOfficesRaiseLetters.closeDialog()">إغلاق</button></div><div class="section-box"><h3>بيانات المستخلص الحالية — قراءة فقط</h3><div class="settings-grid"><div class="field"><label>رقم الدفعة ومدة المستخلص</label><div class="readonly-box">${extractPhrase()}</div></div><div class="field"><label>اسم المقاول / الشركة</label><div class="readonly-box">${esc(getCompanyName())}</div></div><div class="field"><label>صافي العمالة الإجمالي</label><div class="readonly-box">${moneySAR(total.net)}</div></div></div></div><div class="section-box"><h3>اختيار المواقع لخطابات المواقع</h3><div class="settings-grid"><div class="field"><label>الموقع المحدد لخطاب واحد</label><select id="rl-site-select" data-rl-setting="siteLetterDefaultCenter"><option value="">اختر الموقع</option>${options}</select></div><div class="field"><label>تحديد سريع</label><div class="readonly-box"><button type="button" class="btn btn-light" onclick="document.querySelectorAll('.rl-site-check').forEach(cb=>cb.checked=true)">تحديد الكل</button> <button type="button" class="btn btn-light" onclick="document.querySelectorAll('.rl-site-check').forEach(cb=>cb.checked=false)">إلغاء الكل</button></div></div></div><div class="site-checks">${checks}</div></div><div class="section-box"><h3>إعدادات الخطابات المحفوظة</h3><div class="settings-grid">${settingsField('recipient', 'اسم المخاطب')}${settingsField('recipientSuffix', 'الصفة / المحترم')}${settingsField('entityTitle', 'العنوان الرئيسي')}${settingsField('departmentTitle', 'الإدارة')}${settingsField('scopeName', 'نطاق الخطاب الإجمالي')}${settingsField('vatRate', 'نسبة الضريبة', 'number')}${settingsField('phoneFaxAr', 'الهاتف والفاكس عربي')}${settingsField('phoneFaxEn', 'الهاتف والفاكس إنجليزي')}${settingsField('declarationDate', 'تاريخ الإقرار', 'date')}${settingsField('declarationManualAmount', 'مبلغ الإقرار اليدوي', 'number')}</div></div><div class="section-box"><h3>التواقيع المحفوظة</h3><div class="settings-grid">${settingsField('unitManagerTitle', 'توقيع 1 - الصفة')}${settingsField('unitManagerName', 'توقيع 1 - الاسم')}${settingsField('managerTitle', 'توقيع 2 - الصفة')}${settingsField('managerName', 'توقيع 2 - الاسم')}</div><div class="btn-row"><button type="button" class="btn btn-primary" onclick="AdminOfficesRaiseLetters.saveDialog()">حفظ التواقيع</button></div></div></div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function saveDialog() {
    const patch = {};
    document.querySelectorAll('[data-rl-setting]').forEach(el => { patch[el.dataset.rlSetting] = el.value; });
    saveSettings(patch);
    let note = document.getElementById('raise-letters-save-note');
    if (!note) {
      note = document.createElement('div');
      note.id = 'raise-letters-save-note';
      note.style.cssText = 'margin:10px 0;padding:10px 14px;border-radius:12px;background:#ecfdf5;color:#166534;font-weight:900;text-align:center;border:1px solid #bbf7d0;';
      const dialog = document.querySelector('#raise-letters-overlay .settings-dialog');
      if (dialog) dialog.prepend(note);
    }
    if (note) {
      note.textContent = 'تم حفظ إعدادات خطابات الرفع والتواقيع بنجاح.';
      setTimeout(() => { if (note) note.textContent = ''; }, 2500);
    }
  }

  function openDialog() { if (!document.getElementById('raise-letters-overlay')) renderDialog(); }
  function closeDialog() { document.getElementById('raise-letters-overlay')?.remove(); }

  function installButton() {
    const bar = document.getElementById('main-action-buttons') || document.querySelector('.std-action-bar') || document.querySelector('.main-action-buttons');
    if (!bar || document.getElementById('raise-letters-btn')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'raise-letters-btn';
    btn.className = 'ab ab-update no-print';
    btn.innerHTML = '<i class="fas fa-envelope-open-text"></i> خطابات الرفع';
    btn.onclick = openDialog;
    bar.appendChild(btn);
  }

  window.AdminOfficesRaiseLetters = {
    openDialog, closeDialog, saveDialog,
    generateLaborRaiseLetter, generateDeclaration, generateSiteRaiseLetter, generateSelectedSiteLetters,
    tafqeetSAR, calcSite, calcGrandLabor, laborValues
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installButton);
  else installButton();
  setTimeout(installButton, 700);
  setTimeout(installButton, 1800);
  setTimeout(installButton, 3500);
  console.info('[Admin Offices Raise Letters] installed clean labor/site v4 money-tafqeet');
})();