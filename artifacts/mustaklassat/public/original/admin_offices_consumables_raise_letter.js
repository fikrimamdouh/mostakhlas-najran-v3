// ===================================================================
// Admin Offices Consumables Raise Letter
// Scope: admin_offices_consumables.html only
// خطاب رفع المستهلكات من صفحة مستخلص المستهلكات نفسها
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_consumables\.html(?:$|[?#])/.test(location.pathname + location.search)) return;

  const SETTINGS_KEY = 'adminOfficesRaiseLettersSettings_v1';
  const VAT_DEFAULT = 15;

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
    const n = Number(normalizeDigits(v).replace(/,/g, '').replace(/[ ريال﷼()]/g, '').trim());
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

  function getContract() { return readJson('persistentContractData', {}); }
  function getExtract() { return readJson('persistentExtractData', {}); }

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

  function getCompanyName() {
    const c = getContract();
    const dom = document.querySelector('.companyName')?.textContent;
    return c.contractorName || c.companyName || c.company || c.contractor || (dom && dom !== 'غير محدد' ? dom : '') || 'غير محدد';
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
      managerName: '................................'
    };
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
    ['paymentNo','extractStart','extractEnd','period1Start','period1End','period2Start','period2End','period1LaborNet','period2LaborNet','consumablesPeriod1Net','consumablesPeriod2Net','purchasePeriodLabel','siteLetterDefaultCenter'].forEach(k => delete cleanPatch[k]);
    writeJson(SETTINGS_KEY, Object.assign(defaultSettings(), current, cleanPatch));
  }

  function periodInfo() {
    const e = getExtract();
    const start = new Date(e.extractStart || localStorage.getItem('extractStart') || Date.now());
    const end = new Date(e.extractEnd || localStorage.getItem('extractEnd') || e.extractStart || Date.now());
    const safeStart = Number.isNaN(start.getTime()) ? new Date() : start;
    const safeEnd = Number.isNaN(end.getTime()) ? safeStart : end;
    return {
      daysInExtract: Math.max(1, Math.ceil((safeEnd - safeStart) / 86400000) + 1 || 30),
      totalDaysInMonth: new Date(safeStart.getFullYear(), safeStart.getMonth() + 1, 0).getDate() || 30
    };
  }

  function contractInfo() {
    const c = getContract();
    return { contractType: c.contractType || 'عقد أساسي', directPurchaseRatio: num(c.directPurchaseRatio) };
  }

  function normalizeVisitDate(value) {
    const oldFutureMonths = ['يناير القادم','فبراير القادم','مارس القادم','أبريل القادم','مايو القادم','يونيو القادم','يوليو القادم','أغسطس القادم','سبتمبر القادم','أكتوبر القادم','نوفمبر القادم','ديسمبر القادم'];
    return oldFutureMonths.includes(value) ? 'زيارة قادمة' : (value || 'خلال هذا الشهر');
  }

  function readRenderedTextNumber(selector) {
    const el = document.querySelector(selector);
    return el ? num(el.textContent) : 0;
  }

  function calculatePerformanceNetFromStorage() {
    const db = 'admin_offices_consumables_v1.0';
    const summary = readJson(`summary_data_${db}`, []);
    const performance = readJson(`performance_data_${db}`, []);
    const p = periodInfo();
    const c = contractInfo();
    let total = 0;

    (Array.isArray(summary) ? summary : [])
      .filter(item => !item.isCustom && !item.isSubTotal)
      .forEach(item => {
        const pf = (Array.isArray(performance) ? performance : []).find(row => row.id === item.id) || { maxScore: 100, score: 100 };
        let monthly = num(item.value);
        if (c.contractType === 'شراء مباشر' && c.directPurchaseRatio > 0) monthly += monthly * c.directPurchaseRatio / 100;
        const valueForPeriod = monthly / p.totalDaysInMonth * p.daysInExtract;
        const max = num(pf.maxScore);
        const score = num(pf.score);
        const deficiency = max > 0 ? (max - score) / max : 0;
        const deduction = valueForPeriod * deficiency;
        const penalty = deduction * 0.10;
        total += valueForPeriod - deduction - penalty;
      });

    const housing = (Array.isArray(summary) ? summary : []).find(i => i.id === 'sm_custom_deduction_1');
    total -= num(housing && housing.value);
    return total;
  }

  function calculateSubcontractorsNetFromStorage(expectedPenalty) {
    const db = 'admin_offices_consumables_v1.0';
    const rows = readJson(`subcontractors_data_${db}`, []);
    const c = contractInfo();
    let total = 0;

    (Array.isArray(rows) ? rows : []).forEach(item => {
      let visitValue = num(item.visitValue);
      if (c.contractType === 'شراء مباشر' && c.directPurchaseRatio > 0) visitValue += visitValue * c.directPurchaseRatio / 100;
      const annualVisits = parseInt(item.annualVisits, 10) || 1;
      const visitDate = normalizeVisitDate(item.visitDate);
      const dueVisitCost = visitDate === 'خلال هذا الشهر' ? visitValue / annualVisits : 0;
      const damagePenalty = num(item.damagePenalty);
      const latePenalty = (item.status === 'لا' && dueVisitCost > 0) ? num(expectedPenalty) : 0;
      const baseValue = item.status === 'نعم' ? dueVisitCost : 0;
      total += baseValue - latePenalty - damagePenalty;
    });

    return total;
  }

  function captureAndRender() {
    try { if (typeof window.captureUIData === 'function') window.captureUIData(); } catch (_) {}
    try { if (typeof window.renderAllTables === 'function') window.renderAllTables(); } catch (_) {}
  }

  function persistConsumablesNet(net) {
    const value = money(num(net));
    localStorage.setItem('admin_offices_consumables_current_net', value);
    localStorage.setItem('adminOfficesConsumablesNet', value);
    localStorage.setItem('finalConsumablesCost', value);
  }

  function getCurrentConsumablesNet() {
    captureAndRender();
    const summaryFooterNet = readRenderedTextNumber('#summary-table tfoot tr:first-child td:last-child');
    if (summaryFooterNet > 0) { persistConsumablesNet(summaryFooterNet); return summaryFooterNet; }
    const dashboardConsumables = readRenderedTextNumber('#display-consumables-cost');
    const dashboardSubcontractors = readRenderedTextNumber('#display-subcontractors-cost');
    const dashboardTotal = dashboardConsumables + dashboardSubcontractors;
    if (dashboardTotal > 0) { persistConsumablesNet(dashboardTotal); return dashboardTotal; }
    const expectedPenalty = readRenderedTextNumber('#expected-penalty');
    const calculated = calculatePerformanceNetFromStorage() + calculateSubcontractorsNetFromStorage(expectedPenalty);
    persistConsumablesNet(calculated);
    return calculated;
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
  function signatureHtml(settings) { return `<div class="signatures one"><div><div class="sig-title">${esc(settings.managerTitle)}</div><div class="line"></div><div class="sig-name">${esc(settings.managerName)}</div></div></div>`; }

  function printCss() {
    return `<style>
      @page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{direction:rtl;margin:0;background:#e9eef5;color:#111827;font-family:Tajawal,Arial,sans-serif}.toolbar{position:sticky;top:0;display:flex;justify-content:center;gap:10px;background:#111827;padding:10px;z-index:5}.toolbar button{border:0;border-radius:10px;padding:10px 18px;font-weight:900;cursor:pointer;background:#d4af37;color:#111}.page{width:210mm;min-height:297mm;margin:12px auto;background:#fff;padding:14mm 15mm 18mm;box-shadow:0 10px 30px rgba(15,23,42,.16);position:relative}.head{display:grid;grid-template-columns:82px 1fr 82px;align-items:center;border-bottom:2px solid #003087;padding-bottom:12px;margin-bottom:30px}.head img{width:72px;height:auto}.head .t{text-align:center}.head h1{font-size:17px;margin:0 0 5px;color:#003087;font-weight:900}.head h2{font-size:15px;margin:0;color:#111827;font-weight:800}.to{font-size:15.5px;font-weight:900;margin:4px 0 24px;line-height:2}.recipient-name,.recipient-suffix{display:inline}.recipient-suffix{margin-right:20px;padding-right:0}.salam{text-align:center;font-size:15.5px;font-weight:900;margin:20px 0 14px}.body-text{font-size:15px;line-height:2.15;text-align:justify;margin-top:6px}.amount-table{width:100%;border-collapse:collapse;margin:18px 0 14px;font-size:14px}.amount-table td,.amount-table th{border:1px solid #333;padding:8px}.amount-table td:first-child{text-align:right;font-weight:700;width:70%}.amount-table td:last-child{text-align:center;font-weight:900;direction:ltr;white-space:nowrap}.amount-table .grand td{background:#fff7d6;font-weight:900}.tafqeet{border:1px solid #94a3b8;background:#f8fafc;border-radius:8px;padding:8px 12px;margin-top:8px;font-weight:900;line-height:1.8}.closing{font-size:15px;line-height:2;margin-top:18px}.signatures.one{display:block;margin-top:48px}.signatures.one>div{width:78mm;margin-right:auto;margin-left:0;text-align:center}.sig-title{font-weight:900;margin-bottom:18px}.line{height:34px;border-bottom:1px solid #111;margin:0 18px 10px}.sig-name{font-weight:900;margin-top:8px}.footer{position:absolute;bottom:10mm;left:15mm;right:15mm;border-top:1px solid #cbd5e1;padding-top:5px;font-size:11px;display:flex;justify-content:space-between;direction:ltr}.settings-overlay{position:fixed;inset:0;background:rgba(15,23,42,.72);z-index:999999;display:flex;align-items:center;justify-content:center;padding:18px;direction:rtl;font-family:Tajawal,Arial,sans-serif}.settings-dialog{width:min(1180px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:18px;padding:18px;box-shadow:0 25px 70px rgba(0,0,0,.3)}.settings-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.field{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:10px}.field label{display:block;font-size:12px;font-weight:900;color:#334155;margin-bottom:6px}.field input,.field select{width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:8px;font-family:inherit}.readonly-box{padding:9px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;font-weight:900;line-height:1.8}.btn-row{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.btn{border:0;border-radius:10px;padding:9px 14px;font-weight:900;cursor:pointer}.btn-primary{background:#003087;color:#fff}.btn-gold{background:#d4af37;color:#111}.btn-light{background:#f1f5f9;color:#111}.section-box{border:1px solid #e2e8f0;border-radius:14px;padding:12px;margin-top:12px;background:#f8fafc}.section-box h3{margin:0 0 12px;color:#003087;font-weight:900}@media print{body{background:#fff}.toolbar{display:none}.page{margin:0;box-shadow:none;width:auto;min-height:calc(297mm - 24mm);padding:0}.footer{bottom:0}}
    </style>`;
  }

  function openPrintDoc(title, bodyHtml) {
    const win = window.open('', '', 'width=1000,height=900');
    if (!win) return alert('المتصفح منع نافذة الطباعة. اسمح بالنوافذ المنبثقة.');
    win.document.open();
    win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>${esc(title)}</title><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">${printCss()}</head><body><div class="toolbar"><button onclick="window.print()">طباعة</button><button onclick="window.close()">إغلاق</button></div>${bodyHtml}</body></html>`);
    win.document.close();
  }

  function generateConsumablesRaiseLetter() {
    const settings = getSettings();
    const net = getCurrentConsumablesNet();
    if (net <= 0) return alert('لم يتم العثور على صافي مستهلكات صالح داخل مستخلص المستهلكات الحالي. راجع الجداول ثم اضغط تحديث الحسابات.');
    const vat = net * num(settings.vatRate) / 100;
    const grand = net + vat;
    const company = getCompanyName();
    const body = `<section class="page">${headerHtml(settings)}${toHtml(settings)}<div class="salam">السلام عليكم ورحمة الله وبركاته، وبعد:</div><div class="body-text">نرفق لسعادتكم المستخلص الشهري لشركة ${esc(company)} والخاص ببند المستهلكات ومقاولي الباطن لمواقع ${esc(settings.scopeName)}، ${extractPhrase()}.</div><table class="amount-table"><tbody><tr><td>صافي مستحقات المستهلكات ومقاولي الباطن عن مدة المستخلص</td><td>${moneySAR(net)}</td></tr><tr><td>ضريبة القيمة المضافة ${money(settings.vatRate)}%</td><td>${moneySAR(vat)}</td></tr><tr class="grand"><td>الإجمالي</td><td>${moneySAR(grand)}</td></tr></tbody></table><div class="tafqeet">${esc(tafqeetSAR(grand))}</div><div class="closing">لذا نأمل بعد الاطلاع إحالته إلى جهة الاختصاص لتدقيقه واستكمال إجراءات صرف مستحقات المقاول / ${esc(company)}.<br>وتقبلوا تحياتنا ،،،</div>${signatureHtml(settings)}${footerHtml(settings)}</section>`;
    openPrintDoc('خطاب رفع المستهلكات', body);
  }

  function settingsField(key, label, type) {
    const s = getSettings();
    return `<div class="field"><label>${esc(label)}</label><input type="${type || 'text'}" data-cons-letter-setting="${esc(key)}" value="${esc(s[key])}"></div>`;
  }

  function renderDialog() {
    const net = getCurrentConsumablesNet();
    const html = `<div class="settings-overlay" id="consumables-raise-letter-overlay"><div class="settings-dialog"><h2>خطاب رفع المستهلكات — المكاتب الإدارية</h2><div class="btn-row"><button class="btn btn-primary" onclick="AdminOfficesConsumablesRaiseLetter.saveDialog()">حفظ الإعدادات</button><button class="btn btn-gold" onclick="AdminOfficesConsumablesRaiseLetter.generate()">طباعة خطاب المستهلكات</button><button class="btn btn-light" onclick="AdminOfficesConsumablesRaiseLetter.closeDialog()">إغلاق</button></div><div class="section-box"><h3>بيانات المستخلص الحالية — قراءة فقط</h3><div class="settings-grid"><div class="field"><label>رقم الدفعة ومدة المستخلص</label><div class="readonly-box">${extractPhrase()}</div></div><div class="field"><label>اسم المقاول / الشركة</label><div class="readonly-box">${esc(getCompanyName())}</div></div><div class="field"><label>صافي مستخلص المستهلكات الحالي</label><div class="readonly-box">${moneySAR(net)}</div></div></div></div><div class="section-box"><h3>إعدادات الخطاب المحفوظة</h3><div class="settings-grid">${settingsField('recipient', 'اسم المخاطب')}${settingsField('recipientSuffix', 'الصفة / المحترم')}${settingsField('entityTitle', 'العنوان الرئيسي')}${settingsField('departmentTitle', 'الإدارة')}${settingsField('scopeName', 'المواقع')}${settingsField('vatRate', 'نسبة الضريبة', 'number')}${settingsField('phoneFaxAr', 'الهاتف والفاكس عربي')}${settingsField('phoneFaxEn', 'الهاتف والفاكس إنجليزي')}</div></div><div class="section-box"><h3>التوقيع المحفوظ للخطاب</h3><div class="settings-grid">${settingsField('managerTitle', 'صفة التوقيع')}${settingsField('managerName', 'اسم صاحب التوقيع')}</div><div class="btn-row"><button type="button" class="btn btn-primary" onclick="AdminOfficesConsumablesRaiseLetter.saveDialog()">حفظ التوقيع</button></div></div></div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function saveDialog() {
    const patch = {};
    document.querySelectorAll('[data-cons-letter-setting]').forEach(el => { patch[el.dataset.consLetterSetting] = el.value; });
    saveSettings(patch);
    let note = document.getElementById('consumables-raise-letter-save-note');
    if (!note) {
      note = document.createElement('div');
      note.id = 'consumables-raise-letter-save-note';
      note.style.cssText = 'margin:10px 0;padding:10px 14px;border-radius:12px;background:#ecfdf5;color:#166534;font-weight:900;text-align:center;border:1px solid #bbf7d0;';
      const dialog = document.querySelector('#consumables-raise-letter-overlay .settings-dialog');
      if (dialog) dialog.prepend(note);
    }
    if (note) {
      note.textContent = 'تم حفظ إعدادات خطاب رفع المستهلكات والتوقيع بنجاح.';
      setTimeout(() => { if (note) note.textContent = ''; }, 2500);
    }
  }

  function openDialog() { if (!document.getElementById('consumables-raise-letter-overlay')) renderDialog(); }
  function closeDialog() { document.getElementById('consumables-raise-letter-overlay')?.remove(); }

  function installButtons() {
    const bar = document.querySelector('.std-action-bar') || document.querySelector('.main-action-buttons') || document.getElementById('main-action-buttons');
    if (!bar) return;
    if (!document.getElementById('consumables-raise-letter-settings-btn')) {
      const settingsBtn = document.createElement('button');
      settingsBtn.type = 'button';
      settingsBtn.id = 'consumables-raise-letter-settings-btn';
      settingsBtn.className = 'ab ab-sig no-print';
      settingsBtn.innerHTML = '<i class="fas fa-envelope-open-text"></i> إعدادات خطاب الرفع';
      settingsBtn.onclick = openDialog;
      bar.appendChild(settingsBtn);
    }
    if (!document.getElementById('consumables-raise-letter-btn')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'consumables-raise-letter-btn';
      btn.className = 'ab ab-update no-print';
      btn.innerHTML = '<i class="fas fa-print"></i> خطاب رفع المستهلكات';
      btn.onclick = generateConsumablesRaiseLetter;
      bar.appendChild(btn);
    }
  }

  window.AdminOfficesConsumablesRaiseLetter = { openDialog, closeDialog, saveDialog, generate: generateConsumablesRaiseLetter, getCurrentConsumablesNet, tafqeetSAR };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installButtons);
  else installButtons();
  setTimeout(installButtons, 700);
  setTimeout(installButtons, 1800);
  setTimeout(installButtons, 3500);
  console.info('[Admin Offices Consumables Raise Letter] installed v4 money-tafqeet');
})();