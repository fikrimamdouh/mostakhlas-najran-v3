// ===================================================================
// Admin Offices Final Raise Letter Dynamic Subject — V1
// Scope: admin_offices_attendance.html
// يجعل موضوع خطاب الرفع النهائي ديناميكيًا حسب رقم الدفعة وموقع المكاتب، وبخط صغير أقصى اليسار.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html|original-viewer\?page=admin_offices_attendance\.html/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_FINAL_RAISE_DYNAMIC_SUBJECT_V1__) return;
  window.__ADMIN_OFFICES_FINAL_RAISE_DYNAMIC_SUBJECT_V1__ = true;

  const SETTINGS_KEY = 'adminOfficesRaiseLettersSettings_v1';
  const SITE_NAME = 'المكاتب الإدارية والمرافق الصحية وصيانة وإصلاح السيارات والعيادات المتنقلة';

  function readJson(key, fallback) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; } }
  function esc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function clean(v) { return String(v ?? '').replace(/\s+/g, ' ').trim(); }
  function firstValue() { for (const v of arguments) { const s = clean(v); if (s && !['غير محدد', 'undefined', 'null', '—'].includes(s)) return s; } return ''; }
  function num(v) { const ar='٠١٢٣٤٥٦٧٨٩', fa='۰۱۲۳۴۵۶۷۸۹'; const n = Number(String(v ?? '').replace(/[٠-٩]/g,d=>ar.indexOf(d)).replace(/[۰-۹]/g,d=>fa.indexOf(d)).replace(/,/g,'').replace(/[ ريال﷼()]/g,'').trim()); return Number.isFinite(n) ? n : 0; }
  function money(v) { return num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function sar(v) { return money(v) + ' ريال'; }
  function settings() {
    return Object.assign({
      finalLetterHeaderLine1: 'وزارة الصحة',
      finalLetterHeaderLine2: 'فرع وزارة الصحة بمنطقة نجران',
      finalLetterHeaderLine3: 'الإدارة المساعدة للدعم المساند',
      finalLetterTo: 'المكرم / مدير الإدارة المالية',
      finalLetterToSuffix: 'المحترم',
      finalLetterGreeting: 'السلام عليكم ورحمة الله وبركاته',
      finalLetterOpening: 'نرفق طيه المستخلص النهائي لأعمال الصيانة والنظافة والتشغيل غير الطبي لـ {scopeName} حسب البيانات التالية:',
      finalLetterClosing: 'نأمل التكرم بالاطلاع وتوجيه الجهة المختصة نحو صرف استحقاق المقاول حسب النظام.',
      finalLetterRegards: 'مع أطيب تحياتي وتقديري،،',
      finalLetterSignatureTitle: 'مساعد المدير العام للدعم المساند',
      finalLetterSignatureName: '',
      managerTitle: '................................',
      managerName: '................................',
      phoneFaxAr: 'نجران – تليفون 0175225872    فاكس 017523312',
      phoneFaxEn: 'Najran – Tel.: 0175225872       Fax: 017523312',
      scopeName: SITE_NAME
    }, readJson(SETTINGS_KEY, {}));
  }
  function contractData() { return readJson('persistentContractData', {}); }
  function extractData() { return readJson('persistentExtractData', {}); }
  function dateText(v) { if (!v) return 'غير محدد'; try { const d = new Date(v); return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-CA'); } catch (_) { return 'غير محدد'; } }
  function period() {
    try { if (typeof window.getExtractPeriodDetails === 'function') return window.getExtractPeriodDetails(); } catch (_) {}
    const e = extractData();
    const start = new Date(e.extractStart || localStorage.getItem('extractStart') || Date.now());
    const end = new Date(e.extractEnd || localStorage.getItem('extractEnd') || e.extractStart || Date.now());
    const safeStart = Number.isNaN(start.getTime()) ? new Date() : start;
    const safeEnd = Number.isNaN(end.getTime()) ? safeStart : end;
    return { startDate: safeStart, endDate: safeEnd, daysInExtract: Math.max(1, Math.ceil((safeEnd - safeStart) / 86400000) + 1 || 30), totalDaysInMonth: new Date(safeStart.getFullYear(), safeStart.getMonth() + 1, 0).getDate() || 30 };
  }
  function paymentNo() { const e = extractData(); const raw = firstValue(e.paymentNumber, e.extractNumber, e.paymentNo, e.extractNo, localStorage.getItem('paymentNumber'), localStorage.getItem('extractNumber'), localStorage.getItem('paymentNo')) || '—'; return /^\d+$/.test(raw) ? raw.padStart(3, '0') : raw; }
  function finalSubject() { return `مستخلص العمالة دفعة رقم (${paymentNo()}) لموقع ${SITE_NAME}`; }
  function companyName() { const c = contractData(); return firstValue(c.contractorName, c.contractorCompany, c.companyName, c.company, c.contractor, c.supplierName, c.vendorName, localStorage.getItem('companyName'), document.querySelector('.companyName')?.textContent) || 'غير محدد'; }
  function contractName() { const c = contractData(); return firstValue(c.contractName, c.projectName, c.contractTitle, c.name, c.scopeName, c.contractDetails, SITE_NAME) || SITE_NAME; }
  function contractNumber() { const c = contractData(); return firstValue(c.contractNumber, c.contractNo, c.number, localStorage.getItem('contractNumber')) || '—'; }
  function replaceTokens(text) { const p = period(); return String(text || '').replaceAll('{scopeName}', SITE_NAME).replaceAll('{companyName}', companyName()).replaceAll('{contractName}', contractName()).replaceAll('{paymentNo}', paymentNo()).replaceAll('{startDate}', dateText(p.startDate)).replaceAll('{endDate}', dateText(p.endDate)); }
  function getNames() { try { if (typeof window.getCenterNames === 'function') return window.getCenterNames() || {}; } catch (_) {} return readJson('adminOfficeNames_v1', {}); }
  function attendanceData() {
    const sources = [];
    try { if (typeof window.getAttendanceData === 'function') sources.push(window.getAttendanceData() || {}); } catch (_) {}
    sources.push(readJson('adminOfficesAttendanceData_v1', {}), readJson('adminOfficesAttendanceData_v1_localBackup', {}), readJson('adminOfficesLaborDataSafe_v2', {}), readJson('adminOfficesAttendanceData', {}));
    const count = obj => Object.values(obj || {}).reduce((sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0), 0);
    return sources.reduce((best, obj) => count(obj) > count(best) ? obj : best, {});
  }
  function centerKeys() { const n = getNames(), d = attendanceData(); return Array.from(new Set([...Object.keys(n || {}), ...Object.keys(d || {})])).filter(k => k === 'admin_staff' || /^center_\d+$/.test(k) || Array.isArray(d[k])); }
  function calcSite(key) {
    if (window.AdminOfficesRaiseLetters && typeof window.AdminOfficesRaiseLetters.calcSite === 'function') { try { const c = window.AdminOfficesRaiseLetters.calcSite(key) || {}; return { finalNet: num(c.finalNet) }; } catch (_) {} }
    return { finalNet: 0 };
  }
  function grandNet() { return centerKeys().reduce((s, k) => s + num(calcSite(k).finalNet), 0); }
  function css() { return `<style>@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{margin:0;background:#e9eef5;direction:rtl;font-family:Tajawal,Arial,sans-serif;color:#111827}.toolbar{position:sticky;top:0;background:#111827;padding:10px;text-align:center;z-index:5}.toolbar button{background:#d4af37;border:0;border-radius:10px;padding:10px 18px;font-weight:900;cursor:pointer}.page{width:210mm;min-height:297mm;margin:12px auto;background:#fff;padding:14mm 15mm 18mm;box-shadow:0 10px 30px rgba(15,23,42,.16);position:relative}.final-head{display:grid;grid-template-columns:150px 1fr;align-items:start;min-height:92px;margin-bottom:14px}.final-logo img{width:118px;opacity:.72}.final-ministry{text-align:right;padding-top:8px}.final-ministry h1,.final-ministry h2,.final-ministry h3{margin:0 0 6px;font-size:14.5px;font-weight:900}.final-subject{text-align:left!important;direction:rtl;font-size:11px!important;font-weight:800!important;text-decoration:none!important;margin:8px 0 32px!important;line-height:1.7;color:#111827}.final-to{display:flex;justify-content:space-between;font-size:16px;font-weight:900;margin:0 0 10px}.cert-title{text-align:center;font-size:16px;font-weight:900;margin:18px 0 12px}.body-text{font-size:16px;line-height:2.2;text-align:justify;margin-top:22px}.amount-table{width:100%;border-collapse:collapse;margin:14px 0;font-size:13px;table-layout:fixed}.amount-table td{border:1px solid #333;padding:7px;text-align:center}.amount-table td:first-child{text-align:right}.final-table{width:72%;margin:14px auto 10px;font-size:14px}.total-row td{background:#fff7d6;font-weight:900}.iban{text-align:center;margin:10px 0;font-weight:800}.signatures.one{display:block;margin-top:42px}.signatures.one>div{width:78mm;margin-right:auto;margin-left:0;text-align:center}.sig-title{font-weight:900;margin-bottom:18px}.line{height:34px;border-bottom:1px solid #111;margin:0 18px 10px}.sig-name{font-weight:900}@media print{body{background:#fff}.toolbar{display:none!important}.page{margin:0;box-shadow:none}}</style>`; }
  function openPrintDoc(title, html) { const win = window.open('', '', 'width=1200,height=900'); if (!win) return alert('المتصفح منع نافذة الطباعة. اسمح بالنوافذ المنبثقة.'); win.document.open(); win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>${esc(title)}</title><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">${css()}</head><body><div class="toolbar"><button onclick="window.print()">طباعة</button><button onclick="window.close()" style="margin-right:8px">إغلاق</button></div>${html}</body></html>`); win.document.close(); }
  function finalHead() { const s = settings(); return `<div class="final-head"><div class="final-logo"><img src="moh_logo.png"></div><div class="final-ministry"><h1>${esc(s.finalLetterHeaderLine1)}</h1><h2>${esc(s.finalLetterHeaderLine2)}</h2><h3>${esc(s.finalLetterHeaderLine3)}</h3></div></div>`; }
  function pageFinalRaiseLetter() {
    const s = settings(), p = period(), c = contractData();
    const net = grandNet(), vat = net * 0.15, other = num(localStorage.getItem('finalLetterOtherAmount')), total = net + vat + other;
    const iban = firstValue(c.iban, c.bankIban, c.accountIban, c.bankAccount, localStorage.getItem('contractorIban')) || 'SA................................';
    const title = firstValue(s.finalLetterSignatureTitle, s.managerTitle, 'مساعد المدير العام للدعم المساند');
    const name = firstValue(s.finalLetterSignatureName, s.managerName, '................................');
    return `<section class="page">${finalHead()}<div class="final-subject">${esc(finalSubject())}</div><div class="final-to"><span>${esc(s.finalLetterTo)}</span><span>${esc(s.finalLetterToSuffix)}</span></div><div class="cert-title">${esc(s.finalLetterGreeting)}</div><div class="body-text">${esc(replaceTokens(s.finalLetterOpening))}</div><ol style="line-height:1.9"><li>اسم العقد: ${esc(contractName())}</li><li>اسم المقاول / الشركة: ${esc(companyName())}</li><li>الموقع: ${esc(SITE_NAME)}</li><li>الفترة الزمنية: من ${esc(dateText(p.startDate))} م حتى ${esc(dateText(p.endDate))} م</li><li>رقم الدفعة / المستخلص: ${esc(paymentNo())}</li><li>رقم العقد: ${esc(contractNumber())}</li></ol><table class="amount-table final-table"><tr><td>صافي المستحق للمقاول</td><td>${sar(net)}</td></tr><tr><td>ضريبة القيمة المضافة 15%</td><td>${sar(vat)}</td></tr><tr><td>مبالغ أخرى / تعويضات / حسميات</td><td>${sar(other)}</td></tr><tr class="total-row"><td>الإجمالي</td><td>${sar(total)}</td></tr></table><div class="iban">رقم الحساب البنكي الآيبان: ${esc(iban)}</div><div class="body-text" style="text-align:center;font-weight:800">${esc(replaceTokens(s.finalLetterClosing))}</div><div class="body-text" style="text-align:center;font-weight:900">${esc(s.finalLetterRegards)}</div><div class="signatures one"><div><div class="sig-title">${esc(title)}</div><div class="line"></div><div class="sig-name">${esc(name)}</div></div></div></section>`;
  }
  function install() {
    try {
      const input = document.querySelector('#final-raise-letter-settings [data-rl-setting="finalLetterSubject"]');
      if (input) { input.value = finalSubject(); input.placeholder = finalSubject(); input.readOnly = true; input.title = 'يتغير تلقائيًا حسب رقم الدفعة'; }
    } catch (_) {}
    if (!window.AdminOfficesExtraDocs || window.AdminOfficesExtraDocs.__dynamicFinalSubjectPatched) return false;
    window.AdminOfficesExtraDocs.generateFinalFinancialRaiseLetter = function () { openPrintDoc('خطاب الرفع النهائي للإدارة المالية', pageFinalRaiseLetter()); };
    window.AdminOfficesExtraDocs.__dynamicFinalSubjectPatched = true;
    console.info('[Admin Offices Final Raise Letter] dynamic subject patched');
    return true;
  }
  function boot(attempt) { install(); if (attempt < 40) setTimeout(() => boot(attempt + 1), 250); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot(0)); else boot(0);
  document.addEventListener('click', function () { setTimeout(() => boot(0), 120); }, true);
  console.info('[Admin Offices Final Raise Letter] dynamic subject helper installed');
})();