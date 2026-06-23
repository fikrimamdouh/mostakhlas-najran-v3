// ===================================================================
// Admin Offices Consumables Raise Letter — SAFE V8
// Scope: admin_offices_consumables.html / original-viewer page
// - شاشة منبثقة لإعدادات خطاب رفع المستهلكات
// - حفظ تلقائي للإعدادات
// - منطق آمن لزيارة مقاولي الباطن بدون MutationObserver وبدون حلقات إعادة حساب
// - توسيع عمود البند وتحسين عرض الجدول
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_consumables\.html|original-viewer\?page=admin_offices_consumables\.html/.test(location.pathname + location.search)) return;

  const SETTINGS_KEY = 'adminOfficesRaiseLettersSettings_v1';
  const DB_VERSION = 'admin_offices_consumables_v1.0';

  function readJson(key, fallback) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; } }
  function writeJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value || {})); } catch (_) {} }
  function esc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function digits(v) { const ar = '٠١٢٣٤٥٦٧٨٩', fa = '۰۱۲۳۴۵۶۷۸۹'; return String(v ?? '').replace(/[٠-٩]/g, d => ar.indexOf(d)).replace(/[۰-۹]/g, d => fa.indexOf(d)); }
  function num(v) { const n = Number(digits(v).replace(/,/g, '').replace(/[ ريال﷼()]/g, '').trim()); return Number.isFinite(n) ? n : 0; }
  function money(v) { return num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function moneySAR(v) { return money(v) + ' ريال'; }
  function fmtDate(v) { if (!v) return 'غير محدد'; try { const d = new Date(v); return Number.isNaN(d.getTime()) ? 'غير محدد' : d.toLocaleDateString('en-CA'); } catch (_) { return 'غير محدد'; } }

  function getContract() { return readJson('persistentContractData', {}); }
  function getExtract() { return readJson('persistentExtractData', {}); }
  function defaultSettings() {
    return {
      recipient: 'سعادة / مساعد المدير العام للدعم المساند',
      recipientSuffix: 'المحترم',
      entityTitle: 'المديرية العامة للشئون الصحية بمنطقة نجران',
      departmentTitle: 'إدارة الشئون الهندسية',
      scopeName: 'المكاتب الإدارية والمرافق الصحية وصيانة وإصلاح السيارات بمنطقة نجران',
      vatRate: 15,
      phoneFaxAr: 'نجران – تليفون 0175225872    فاكس 017523312',
      phoneFaxEn: 'Najran – Tel.: 0175225872       Fax: 017523312',
      managerTitle: 'مدير إدارة الإمداد والصيانة',
      managerName: 'م /علي المكرمي'
    };
  }
  function getSettings() { return Object.assign(defaultSettings(), readJson(SETTINGS_KEY, {})); }
  function saveSettings(patch) { const current = readJson(SETTINGS_KEY, {}); const clean = Object.assign({}, patch || {}); ['paymentNo', 'extractStart', 'extractEnd'].forEach(k => delete clean[k]); writeJson(SETTINGS_KEY, Object.assign(defaultSettings(), current, clean)); }

  function getActiveExtractMeta() { const e = getExtract(); const p = e.paymentNumber || e.extractNumber || localStorage.getItem('paymentNumber') || localStorage.getItem('extractNumber') || '—'; return { paymentNo: String(p).match(/^\d+$/) ? String(p).padStart(3, '0') : String(p), start: e.extractStart || localStorage.getItem('extractStart') || '', end: e.extractEnd || localStorage.getItem('extractEnd') || '' }; }
  function extractPhrase() { const m = getActiveExtractMeta(); return `دفعة رقم (${esc(m.paymentNo)}) عن الفترة من ${esc(fmtDate(m.start))} م إلى ${esc(fmtDate(m.end))} م`; }
  function getCompanyName() { const c = getContract(); const dom = document.querySelector('.companyName')?.textContent; return c.contractorName || c.companyName || c.company || c.contractor || (dom && dom !== 'غير محدد' ? dom : '') || 'غير محدد'; }

  function normalizeVisitDate(value) {
    const old = ['يناير القادم','فبراير القادم','مارس القادم','أبريل القادم','مايو القادم','يونيو القادم','يوليو القادم','أغسطس القادم','سبتمبر القادم','أكتوبر القادم','نوفمبر القادم','ديسمبر القادم'];
    return old.includes(value) ? 'زيارة قادمة' : (value || 'خلال هذا الشهر');
  }
  function wantedStatusForVisit(value) { return normalizeVisitDate(value) === 'خلال هذا الشهر' ? 'نعم' : 'لا'; }
  function statusClass(value) { return value === 'نعم' ? 'status-yes' : 'status-no'; }
  function visitClass(value) {
    const v = normalizeVisitDate(value);
    if (v === 'خلال هذا الشهر') return 'visit-date-monthly';
    if (v === 'تمت الزيارة من قبل') return 'visit-date-done';
    if (v === 'زيارة مؤجلة') return 'visit-date-postponed';
    return 'visit-date-future';
  }

  function periodInfo() {
    const e = getExtract();
    const start = new Date(e.extractStart || localStorage.getItem('extractStart') || Date.now());
    const end = new Date(e.extractEnd || localStorage.getItem('extractEnd') || e.extractStart || Date.now());
    const safeStart = Number.isNaN(start.getTime()) ? new Date() : start;
    const safeEnd = Number.isNaN(end.getTime()) ? safeStart : end;
    return { daysInExtract: Math.max(1, Math.ceil((safeEnd - safeStart) / 86400000) + 1 || 30), totalDaysInMonth: new Date(safeStart.getFullYear(), safeStart.getMonth() + 1, 0).getDate() || 30 };
  }
  function contractInfo() { const c = getContract(); return { contractType: c.contractType || 'عقد أساسي', directPurchaseRatio: num(c.directPurchaseRatio) }; }
  function calculatePerformanceNetFromStorage() {
    const summary = readJson(`summary_data_${DB_VERSION}`, []);
    const performance = readJson(`performance_data_${DB_VERSION}`, []);
    const p = periodInfo(), c = contractInfo();
    let total = 0;
    (Array.isArray(summary) ? summary : []).filter(i => !i.isCustom && !i.isSubTotal).forEach(item => {
      const pf = (Array.isArray(performance) ? performance : []).find(row => row.id === item.id) || { maxScore: 100, score: 100 };
      let monthly = num(item.value);
      if (c.contractType === 'شراء مباشر' && c.directPurchaseRatio > 0) monthly += monthly * c.directPurchaseRatio / 100;
      const valueForPeriod = monthly / p.totalDaysInMonth * p.daysInExtract;
      const max = num(pf.maxScore), score = num(pf.score);
      const deduction = valueForPeriod * (max > 0 ? (max - score) / max : 0);
      total += valueForPeriod - deduction - (deduction * 0.10);
    });
    const housing = (Array.isArray(summary) ? summary : []).find(i => i.id === 'sm_custom_deduction_1');
    total -= num(housing && housing.value);
    return total;
  }
  function calculateSubcontractorsNetFromStorage(expectedPenalty) {
    const rows = readJson(`subcontractors_data_${DB_VERSION}`, []);
    const c = contractInfo();
    let total = 0;
    (Array.isArray(rows) ? rows : []).forEach(item => {
      let visitValue = num(item.visitValue);
      if (c.contractType === 'شراء مباشر' && c.directPurchaseRatio > 0) visitValue += visitValue * c.directPurchaseRatio / 100;
      const annualVisits = parseInt(item.annualVisits, 10) || 1;
      const dueVisitCost = normalizeVisitDate(item.visitDate) === 'خلال هذا الشهر' ? visitValue / annualVisits : 0;
      const status = item.status || wantedStatusForVisit(item.visitDate);
      const latePenalty = status === 'لا' && dueVisitCost > 0 ? num(expectedPenalty) : 0;
      const base = status === 'نعم' ? dueVisitCost : 0;
      total += base - latePenalty - num(item.damagePenalty);
    });
    return total;
  }
  function persistConsumablesNet(value) { const v = money(value); localStorage.setItem('admin_offices_consumables_current_net', v); localStorage.setItem('adminOfficesConsumablesNet', v); localStorage.setItem('finalConsumablesCost', v); }
  function readRenderedNumber(selector) { const el = document.querySelector(selector); return el ? num(el.textContent) : 0; }
  function getCurrentConsumablesNet() {
    const rendered = readRenderedNumber('#summary-table tfoot tr:first-child td:last-child');
    if (rendered > 0) { persistConsumablesNet(rendered); return rendered; }
    const dashboard = readRenderedNumber('#display-consumables-cost') + readRenderedNumber('#display-subcontractors-cost');
    if (dashboard > 0) { persistConsumablesNet(dashboard); return dashboard; }
    const calculated = calculatePerformanceNetFromStorage() + calculateSubcontractorsNetFromStorage(readRenderedNumber('#expected-penalty'));
    persistConsumablesNet(calculated);
    return calculated;
  }

  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
  const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const teens = ['عشرة','أحد عشر','اثنا عشر','ثلاثة عشر','أربعة عشر','خمسة عشر','ستة عشر','سبعة عشر','ثمانية عشر','تسعة عشر'];
  const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
  function underThousand(n) { n = Math.floor(num(n)); const parts = []; const h = Math.floor(n / 100), r = n % 100; if (h) parts.push(hundreds[h]); if (r) { if (r < 10) parts.push(ones[r]); else if (r < 20) parts.push(teens[r - 10]); else { const o = r % 10, t = Math.floor(r / 10); parts.push(o ? `${ones[o]} و${tens[t]}` : tens[t]); } } return parts.join(' و'); }
  function intWords(n) { n = Math.floor(num(n)); if (n === 0) return 'صفر'; const scales = [{v:1000000,s:'مليون',d:'مليونان',p:'ملايين'},{v:1000,s:'ألف',d:'ألفان',p:'آلاف'}]; const parts = []; for (const sc of scales) { const x = Math.floor(n / sc.v); if (x) { parts.push(x === 1 ? sc.s : x === 2 ? sc.d : `${underThousand(x)} ${x >= 3 && x <= 10 ? sc.p : sc.s}`); n %= sc.v; } } if (n) parts.push(underThousand(n)); return parts.join(' و'); }
  function tafqeetSAR(amount) { const total = Math.round(num(amount) * 100) / 100; const abs = Math.abs(total); const r = Math.floor(abs), h = Math.round((abs - r) * 100); let txt = `فقط وقدره ${intWords(r)} ريال سعودي`; if (h > 0) txt += ` و${intWords(h)} هللة`; txt += ' لا غير'; return total < 0 ? 'سالب ' + txt : txt; }

  function suffixEndCss() { return `.to{display:flex!important;justify-content:space-between!important;align-items:flex-start!important;width:100%!important;gap:18px!important;direction:rtl!important}.to .recipient-name{display:block!important;max-width:78%!important;white-space:normal!important;text-align:right!important}.to .recipient-suffix{display:block!important;margin:0!important;padding:0!important;min-width:72px!important;white-space:nowrap!important;text-align:left!important}`; }
  function printCss() { return `<style>@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{direction:rtl;margin:0;background:#e9eef5;color:#111827;font-family:Tajawal,Arial,sans-serif}.toolbar{position:sticky;top:0;display:flex;justify-content:center;gap:10px;background:#111827;padding:10px;z-index:5}.toolbar button{border:0;border-radius:10px;padding:10px 18px;font-weight:900;cursor:pointer;background:#d4af37;color:#111}.page{width:210mm;min-height:297mm;margin:12px auto;background:#fff;padding:14mm 15mm 18mm;box-shadow:0 10px 30px rgba(15,23,42,.16);position:relative}.head{display:grid;grid-template-columns:82px 1fr 82px;align-items:center;border-bottom:2px solid #003087;padding-bottom:12px;margin-bottom:30px}.head img{width:72px}.head .t{text-align:center}.head h1{font-size:17px;margin:0 0 5px;color:#003087;font-weight:900}.head h2{font-size:15px;margin:0;color:#111827;font-weight:800}.salam{text-align:center;font-size:15.5px;font-weight:900;margin:20px 0 14px}.body-text{font-size:15px;line-height:2.15;text-align:justify;margin-top:6px}.amount-table{width:100%;border-collapse:collapse;margin:18px 0 14px;font-size:14px;table-layout:fixed}.amount-table td,.amount-table th{border:1px solid #333;padding:8px;text-align:center;vertical-align:middle;white-space:normal;word-break:normal;overflow-wrap:anywhere}.amount-table td:first-child{text-align:right;font-weight:700;width:68%}.amount-table td:last-child{font-weight:900;direction:ltr;white-space:nowrap}.amount-table .grand td{background:#fff7d6;font-weight:900}.tafqeet{border:1px solid #94a3b8;background:#f8fafc;border-radius:8px;padding:8px 12px;margin-top:8px;font-weight:900;line-height:1.8}.closing{font-size:15px;line-height:2;margin-top:18px}.signatures.one{display:block;margin-top:48px}.signatures.one>div{width:78mm;margin-right:auto;margin-left:0;text-align:center}.sig-title{font-weight:900;margin-bottom:18px}.line{height:34px;border-bottom:1px solid #111;margin:0 18px 10px}.sig-name{font-weight:900;margin-top:8px}.footer{position:absolute;bottom:10mm;left:15mm;right:15mm;border-top:1px solid #cbd5e1;padding-top:5px;font-size:11px;display:flex;justify-content:space-between;direction:ltr}${suffixEndCss()}@media print{body{background:#fff}.toolbar{display:none}.page{margin:0;box-shadow:none;width:auto;min-height:calc(297mm - 24mm);padding:0}.footer{bottom:0}}</style>`; }
  function openPrintDoc(title, bodyHtml) { const win = window.open('', '', 'width=1000,height=900'); if (!win) return alert('المتصفح منع نافذة الطباعة. اسمح بالنوافذ المنبثقة.'); win.document.open(); win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>${esc(title)}</title><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">${printCss()}</head><body><div class="toolbar"><button onclick="window.print()">طباعة</button><button onclick="window.close()">إغلاق</button></div>${bodyHtml}</body></html>`); win.document.close(); }
  function headerHtml(s) { return `<div class="head"><img src="moh_logo.png"><div class="t"><h1>${esc(s.entityTitle)}</h1><h2>${esc(s.departmentTitle)}</h2></div><img src="moh_logo.png"></div>`; }
  function footerHtml(s) { return `<div class="footer"><span>${esc(s.phoneFaxEn)}</span><span dir="rtl">${esc(s.phoneFaxAr)}</span></div>`; }
  function toHtml(s) { return `<div class="to"><span class="recipient-name">${esc(s.recipient)}</span><span class="recipient-suffix">${esc(s.recipientSuffix)}</span></div>`; }
  function signatureHtml(s) { return `<div class="signatures one"><div><div class="sig-title">${esc(s.managerTitle)}</div><div class="line"></div><div class="sig-name">${esc(s.managerName)}</div></div></div>`; }

  function generateConsumablesRaiseLetter() {
    const s = getSettings();
    const net = getCurrentConsumablesNet();
    if (net <= 0) return alert('لم يتم العثور على صافي مستهلكات صالح داخل مستخلص المستهلكات الحالي. راجع الجداول ثم اضغط تحديث الحسابات.');
    const vat = net * num(s.vatRate) / 100;
    const grand = net + vat;
    const body = `<section class="page">${headerHtml(s)}${toHtml(s)}<div class="salam">السلام عليكم ورحمة الله وبركاته، وبعد:</div><div class="body-text">نرفق لسعادتكم المستخلص الشهري لشركة ${esc(getCompanyName())} والخاص ببند المستهلكات ومقاولي الباطن لمواقع ${esc(s.scopeName)}، ${extractPhrase()}.</div><table class="amount-table"><tbody><tr><td>صافي مستحقات المستهلكات ومقاولي الباطن عن مدة المستخلص</td><td>${moneySAR(net)}</td></tr><tr><td>ضريبة القيمة المضافة ${money(s.vatRate)}%</td><td>${moneySAR(vat)}</td></tr><tr class="grand"><td>الإجمالي</td><td>${moneySAR(grand)}</td></tr></tbody></table><div class="tafqeet">${esc(tafqeetSAR(grand))}</div><div class="closing">لذا نأمل بعد الاطلاع إحالته إلى جهة الاختصاص لتدقيقه واستكمال إجراءات صرف مستحقات المقاول / ${esc(getCompanyName())}.<br>وتقبلوا تحياتنا ،،،</div>${signatureHtml(s)}${footerHtml(s)}</section>`;
    openPrintDoc('خطاب رفع المستهلكات', body);
  }

  function field(key, label, type) { const s = getSettings(); return `<div class="field"><label>${esc(label)}</label><input type="${type || 'text'}" data-cons-letter-setting="${esc(key)}" value="${esc(s[key])}"></div>`; }
  function renderDialog() {
    const net = getCurrentConsumablesNet();
    const html = `<div class="settings-overlay" id="consumables-raise-letter-overlay" onclick="if(event.target.id==='consumables-raise-letter-overlay') AdminOfficesConsumablesRaiseLetter.closeDialog()"><div class="settings-dialog"><h2>خطاب رفع المستهلكات — المكاتب الإدارية</h2><div class="btn-row"><button class="btn btn-primary" onclick="AdminOfficesConsumablesRaiseLetter.saveDialog()">حفظ الإعدادات</button><button class="btn btn-gold" onclick="AdminOfficesConsumablesRaiseLetter.generate()">طباعة خطاب المستهلكات</button><button class="btn btn-light" onclick="AdminOfficesConsumablesRaiseLetter.closeDialog()">إغلاق</button></div><div class="section-box"><h3>بيانات المستخلص الحالية — قراءة فقط</h3><div class="settings-grid"><div class="field"><label>رقم الدفعة ومدة المستخلص</label><div class="readonly-box">${extractPhrase()}</div></div><div class="field"><label>اسم المقاول / الشركة</label><div class="readonly-box">${esc(getCompanyName())}</div></div><div class="field"><label>صافي مستخلص المستهلكات الحالي</label><div class="readonly-box">${moneySAR(net)}</div></div></div></div><div class="section-box"><h3>إعدادات الخطاب المحفوظة</h3><div class="settings-grid">${field('recipient','اسم المخاطب')}${field('recipientSuffix','الصفة / المحترم')}${field('entityTitle','العنوان الرئيسي')}${field('departmentTitle','الإدارة')}${field('scopeName','المواقع')}${field('vatRate','نسبة الضريبة','number')}${field('phoneFaxAr','الهاتف والفاكس عربي')}${field('phoneFaxEn','الهاتف والفاكس إنجليزي')}</div></div><div class="section-box"><h3>التوقيع المحفوظ للخطاب</h3><div class="settings-grid">${field('managerTitle','صفة التوقيع')}${field('managerName','اسم صاحب التوقيع')}</div><div class="btn-row"><button type="button" class="btn btn-primary" onclick="AdminOfficesConsumablesRaiseLetter.saveDialog()">حفظ التوقيع</button></div></div></div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    document.body.classList.add('consumables-letter-modal-open');
    installAutoSaveForDialog();
  }
  function saveDialog(silent) {
    const patch = {};
    document.querySelectorAll('[data-cons-letter-setting]').forEach(el => { patch[el.dataset.consLetterSetting] = el.value; });
    saveSettings(patch);
    if (silent === true) return;
    let note = document.getElementById('consumables-raise-letter-save-note');
    if (!note) { note = document.createElement('div'); note.id = 'consumables-raise-letter-save-note'; note.style.cssText = 'margin:10px 0;padding:10px 14px;border-radius:12px;background:#ecfdf5;color:#166534;font-weight:900;text-align:center;border:1px solid #bbf7d0;'; document.querySelector('#consumables-raise-letter-overlay .settings-dialog')?.prepend(note); }
    note.textContent = 'تم حفظ إعدادات خطاب رفع المستهلكات والتوقيع بنجاح.';
    setTimeout(() => { if (note) note.textContent = ''; }, 2500);
  }
  let saveTimer = null;
  function scheduleAutoSave() { clearTimeout(saveTimer); saveTimer = setTimeout(() => saveDialog(true), 250); }
  function installAutoSaveForDialog() {
    const overlay = document.getElementById('consumables-raise-letter-overlay');
    if (!overlay || overlay.__consLetterAutoSaveInstalled) return;
    overlay.__consLetterAutoSaveInstalled = true;
    overlay.addEventListener('input', e => { if (e.target && e.target.matches('[data-cons-letter-setting]')) scheduleAutoSave(); }, true);
    overlay.addEventListener('change', e => { if (e.target && e.target.matches('[data-cons-letter-setting]')) scheduleAutoSave(); }, true);
    overlay.addEventListener('blur', e => { if (e.target && e.target.matches('[data-cons-letter-setting]')) scheduleAutoSave(); }, true);
  }
  function openDialog() { if (!document.getElementById('consumables-raise-letter-overlay')) renderDialog(); }
  function closeDialog() { saveDialog(true); document.getElementById('consumables-raise-letter-overlay')?.remove(); document.body.classList.remove('consumables-letter-modal-open'); }

  function injectPageFixes() {
    if (document.getElementById('admin-consumables-raise-letter-ui-fixes')) return;
    const style = document.createElement('style');
    style.id = 'admin-consumables-raise-letter-ui-fixes';
    style.textContent = `
      body.consumables-letter-modal-open{overflow:hidden!important}
      #consumables-raise-letter-overlay.settings-overlay{position:fixed!important;inset:0!important;background:rgba(15,23,42,.76)!important;backdrop-filter:blur(3px);z-index:2147483000!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:18px!important;direction:rtl!important;font-family:Tajawal,Arial,sans-serif!important}
      #consumables-raise-letter-overlay .settings-dialog{width:min(980px,95vw)!important;max-height:88vh!important;overflow:auto!important;background:#fff!important;border-radius:22px!important;padding:20px!important;box-shadow:0 28px 80px rgba(0,0,0,.35)!important;color:#0f172a!important}
      #consumables-raise-letter-overlay h2{text-align:center;color:#003087;margin:0 0 14px;font-weight:900}
      #consumables-raise-letter-overlay .settings-grid{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(230px,1fr))!important;gap:10px!important}
      #consumables-raise-letter-overlay .field{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:10px}
      #consumables-raise-letter-overlay .field label{display:block;font-size:12px;font-weight:900;color:#334155;margin-bottom:6px}
      #consumables-raise-letter-overlay .field input{width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:8px;font-family:inherit}
      #consumables-raise-letter-overlay .readonly-box{padding:9px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;font-weight:900;line-height:1.8}
      #consumables-raise-letter-overlay .btn-row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin:12px 0}
      #consumables-raise-letter-overlay .btn{border:0;border-radius:10px;padding:9px 14px;font-weight:900;cursor:pointer}
      #consumables-raise-letter-overlay .btn-primary{background:#003087;color:#fff}.btn-gold{background:#d4af37;color:#111}.btn-light{background:#f1f5f9;color:#111;border:1px solid #cbd5e1}
      #consumables-raise-letter-overlay .section-box{border:1px solid #e2e8f0;border-radius:14px;padding:12px;margin-top:12px;background:#f8fafc}
      #subcontractors-table{table-layout:fixed!important;width:100%!important;min-width:1250px!important}
      #subcontractors-table th,#subcontractors-table td{white-space:normal!important;word-break:normal!important;overflow-wrap:anywhere!important;line-height:1.45!important;vertical-align:middle!important}
      #subcontractors-table th:nth-child(1),#subcontractors-table td:nth-child(1){width:30%!important;min-width:340px!important;text-align:right!important}
      #subcontractors-table td:nth-child(1) input{text-align:right!important;min-height:44px!important;line-height:1.55!important;padding:9px 10px!important}
      #subcontractors-table input,#subcontractors-table select{height:auto!important;min-height:38px!important;white-space:normal!important;line-height:1.4!important}
      #subcontractors-section .table-container{overflow-x:auto!important;padding-bottom:8px!important}
      @media print{#subcontractors-table{table-layout:fixed!important;width:100%!important;min-width:0!important;font-size:8.5pt!important}#subcontractors-table th,#subcontractors-table td{white-space:normal!important;word-break:normal!important;overflow-wrap:anywhere!important;padding:5px 4px!important;line-height:1.35!important;vertical-align:middle!important}#subcontractors-table th:nth-child(1),#subcontractors-table td:nth-child(1){width:30%!important;min-width:0!important;text-align:right!important}}
    `;
    document.head.appendChild(style);
  }

  function updateStatusForRow(row, dispatch) {
    const visitSelect = row && row.querySelector('select[data-field="visitDate"]');
    const statusSelect = row && row.querySelector('select[data-field="status"]');
    if (!visitSelect || !statusSelect) return;
    const normalized = normalizeVisitDate(visitSelect.value);
    const wanted = wantedStatusForVisit(normalized);
    if (visitSelect.value !== normalized) visitSelect.value = normalized;
    visitSelect.className = (visitSelect.className || '').replace(/visit-date-(monthly|done|postponed|future)/g, '').trim() + ' ' + visitClass(normalized);
    statusSelect.className = (statusSelect.className || '').replace(/status-(yes|no)/g, '').trim() + ' ' + statusClass(wanted);
    if (statusSelect.value !== wanted) {
      statusSelect.value = wanted;
      if (dispatch) statusSelect.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const visitPrint = visitSelect.parentElement && visitSelect.parentElement.querySelector('.cell-print-content');
    const statusPrint = statusSelect.parentElement && statusSelect.parentElement.querySelector('.cell-print-content');
    if (visitPrint) visitPrint.textContent = normalized;
    if (statusPrint) statusPrint.textContent = wanted;
  }
  function syncSubcontractorVisitRows() {
    document.querySelectorAll('#subcontractors-table tbody tr[data-table="subcontractors"]').forEach(row => updateStatusForRow(row, false));
  }
  function installSubcontractorVisitLogic() {
    if (window.__adminOfficesSubcontractorSafeV8) return;
    window.__adminOfficesSubcontractorSafeV8 = true;
    document.addEventListener('change', function (e) {
      if (!e.target || !e.target.matches('#subcontractors-table select[data-field="visitDate"]')) return;
      updateStatusForRow(e.target.closest('tr'), true);
    }, true);
    document.addEventListener('input', function (e) {
      if (!e.target || !e.target.matches('#subcontractors-table select[data-field="visitDate"]')) return;
      updateStatusForRow(e.target.closest('tr'), true);
    }, true);
    setTimeout(syncSubcontractorVisitRows, 700);
    setTimeout(syncSubcontractorVisitRows, 1800);
    setTimeout(syncSubcontractorVisitRows, 3500);
  }

  function installButtons() {
    injectPageFixes();
    installSubcontractorVisitLogic();
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

  window.AdminOfficesConsumablesRaiseLetter = { openDialog, closeDialog, saveDialog, generate: generateConsumablesRaiseLetter, getCurrentConsumablesNet, tafqeetSAR, syncSubcontractorVisitRows };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installButtons); else installButtons();
  setTimeout(installButtons, 700);
  setTimeout(installButtons, 1800);
  setTimeout(installButtons, 3500);
  console.info('[Admin Offices Consumables Raise Letter] installed v8 safe subcontractor visit logic');
})();