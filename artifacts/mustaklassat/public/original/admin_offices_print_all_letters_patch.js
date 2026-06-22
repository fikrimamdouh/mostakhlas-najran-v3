// ===================================================================
// Admin Offices Print All + Raise Letters
// Scope: admin_offices_attendance.html only
// يضيف خطابات الرفع داخل طباعة الكل بدون تعديل دالة الطباعة الأصلية
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;

  const SETTINGS_KEY = 'adminOfficesRaiseLettersSettings_v1';
  const SAUDIZATION_KEY = 'adminOfficesSaudization_v1';
  const SIG_PREFIX = 'sb_sigs_';
  const RAISE_SIG_KEY = 'admin_offices_raise_letters_signatures';
  const VAT_DEFAULT = 15;

  function readJson(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }
  function esc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function num(v) { const n = Number(String(v ?? '').replace(/,/g, '')); return isNaN(n) ? 0 : n; }
  function money(v) { return num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function moneyPlain(v) { const n = num(v); return Number.isInteger(n) ? String(n) : money(n); }
  function fmtDate(v) { if (!v) return 'غير محدد'; try { return new Date(v).toLocaleDateString('en-CA'); } catch (_) { return 'غير محدد'; } }
  function today() { return new Date().toLocaleDateString('en-CA'); }
  function monthNameAr(v) { try { return new Date(v || Date.now()).toLocaleDateString('ar-SA', { month: 'long' }); } catch (_) { return 'الشهر'; } }

  function getContract() { return readJson('persistentContractData', {}); }
  function getExtract() { return readJson('persistentExtractData', {}); }
  function getSession() { return readJson('najran_session', {}); }
  function getCompanyName() {
    const c = getContract();
    const s = getSession();
    const dom = document.querySelector('.companyName')?.textContent;
    return c.companyName || s.companyName || (dom && dom !== 'غير محدد' ? dom : '') || 'غير محدد';
  }
  function defaultSettings() {
    const e = getExtract();
    return {
      recipient: 'سعادة / مساعد المدير العام للدعم المساند',
      recipientSuffix: 'المحترم',
      entityTitle: 'المديرية العامة للشئون الصحية بمنطقة نجران',
      departmentTitle: 'إدارة الشئون الهندسية',
      scopeName: 'المكاتب الإدارية والمرافق الصحية وصيانة وإصلاح السيارات بمنطقة نجران',
      purchasePeriodLabel: 'الشراء المباشر الثاني',
      paymentNo: e.paymentNumber || localStorage.getItem('paymentNumber') || localStorage.getItem('extractNumber') || '01',
      vatRate: VAT_DEFAULT,
      phoneFaxAr: 'نجران – تليفون 0175225872    فاكس 017523312',
      phoneFaxEn: 'Najran – Tel.: 0175225872       Fax: 017523312',
      period1Start: '',
      period1End: '',
      period1LaborNet: 0,
      period2Start: e.extractStart || localStorage.getItem('extractStart') || '',
      period2End: e.extractEnd || localStorage.getItem('extractEnd') || '',
      consumablesPeriod1Net: 0,
      consumablesPeriod2Net: 0,
      declarationDate: today(),
      declarationManualAmount: 0,
      projectName: 'الصيانة والنظافة والتشغيل غير الطبي للمكاتب الإدارية والمرافق الصحية وصيانة وإصلاح السيارات',
      projectValue: '',
      governmentEntity: 'المديرية العامة للشئون الصحية',
      projectDuration: '',
      projectStart: '',
      projectEnd: '',
      saudizationOpportunities: ''
    };
  }
  function getSettings() { return Object.assign(defaultSettings(), readJson(SETTINGS_KEY, {})); }
  function getSaudization() { return readJson(SAUDIZATION_KEY, { period1: { rows: [] }, period2: { rows: [] } }); }
  function saudizationTotal(key) { const d = getSaudization(); return ((d[key] && d[key].rows) || []).reduce((s, r) => s + num(r.compensation), 0); }
  function tafqeet(v) {
    if (window.AdminOfficesRaiseLetters && typeof window.AdminOfficesRaiseLetters.tafqeetSAR === 'function') return window.AdminOfficesRaiseLetters.tafqeetSAR(v);
    return `فقط ${money(v)} ريال لا غير`;
  }
  function laborValues() {
    if (window.AdminOfficesRaiseLetters && typeof window.AdminOfficesRaiseLetters.syncFromActiveExtract === 'function') window.AdminOfficesRaiseLetters.syncFromActiveExtract();
    if (window.AdminOfficesRaiseLetters && typeof window.AdminOfficesRaiseLetters.laborValues === 'function') return window.AdminOfficesRaiseLetters.laborValues();
    const s = getSettings();
    const net = num(s.period1LaborNet);
    const vat = net * num(s.vatRate) / 100;
    return { p1: num(s.period1LaborNet), p2: 0, net, vat, saud1: saudizationTotal('period1'), saud2: saudizationTotal('period2'), saud: saudizationTotal('period1') + saudizationTotal('period2'), grand: net + vat + saudizationTotal('period1') + saudizationTotal('period2') };
  }
  function logoSrc() { return document.querySelector('.logo-right')?.getAttribute('src') || 'najran_health_cluster_logo.png'; }
  function headerHtml(s) { return `<div class="raise-head"><img src="${esc(logoSrc())}"><div><h1>${esc(s.entityTitle)}</h1><h2>${esc(s.departmentTitle)}</h2></div><img src="${esc(logoSrc())}"></div>`; }
  function footerHtml(s) { return `<div class="raise-footer"><span>${esc(s.phoneFaxEn)}</span><span dir="rtl">${esc(s.phoneFaxAr)}</span></div>`; }
  function signaturesHtml() {
    const sigs = readJson(SIG_PREFIX + RAISE_SIG_KEY, [{ title: 'مدير إدارة الإمداد والصيانة', name: '' }]);
    const rows = Array.isArray(sigs) && sigs.length ? sigs : [{ title: 'مدير إدارة الإمداد والصيانة', name: '' }];
    return `<div class="raise-signatures" style="grid-template-columns:repeat(${Math.min(Math.max(rows.length, 1), 3)},1fr)">${rows.map(sig => `<div><div class="sig-title">${esc(sig.title)}</div><div class="line"></div><div class="sig-name">${esc(sig.name || '')}</div></div>`).join('')}</div>`;
  }
  function amountTable(rows) { return `<table class="raise-amount-table"><tbody>${rows.map(r => `<tr class="${r.cls || ''}"><td>${r.label}</td><td>${r.value}</td></tr>`).join('')}</tbody></table>`; }

  function laborLetterPage() {
    const s = getSettings(), v = laborValues(), company = getCompanyName();
    return `<div class="page-container raise-letter-page">${headerHtml(s)}<div class="raise-to">${esc(s.recipient)} &nbsp;&nbsp; ${esc(s.recipientSuffix)}</div><div class="raise-body">السلام عليكم ورحمة الله وبركاته ...<br>مرفق طيه المستخلص الشهري لشركة ${esc(company)} والخاص ببند (العمالة) لفترة ${esc(s.purchasePeriodLabel)} لـ ${esc(s.scopeName)} دفعة رقم (${esc(s.paymentNo)}) للفترة من ${esc(fmtDate(s.period1Start))} م وحتى ${esc(fmtDate(s.period1End))} م والفترة من ${esc(fmtDate(s.period2Start))} إلى ${esc(fmtDate(s.period2End))} م.</div>${amountTable([{label:`المبلغ الصافي المستحق للمقاول عن الفترة من ${esc(fmtDate(s.period1Start))} إلى ${esc(fmtDate(s.period1End))} م`,value:moneyPlain(v.p1)},{label:`المبلغ الصافي المستحق للمقاول عن الفترة من ${esc(fmtDate(s.period2Start))} إلى ${esc(fmtDate(s.period2End))} م`,value:moneyPlain(v.p2)},{label:'إجمالي المبلغ المستحق للمقاول',value:money(v.net),cls:'total'},{label:`ضريبة القيمة المضافة ${moneyPlain(s.vatRate)}%`,value:money(v.vat)},{label:`مبلغ التعويض عن توطين الوظائف خلال الفترة من ${esc(fmtDate(s.period1Start))} إلى ${esc(fmtDate(s.period1End))} م`,value:moneyPlain(v.saud1)},{label:`مبلغ التعويض عن توطين الوظائف خلال الفترة من ${esc(fmtDate(s.period2Start))} إلى ${esc(fmtDate(s.period2End))} م`,value:moneyPlain(v.saud2)},{label:'إجمالي مبلغ التوطين',value:money(v.saud),cls:'total'},{label:'الإجمالي',value:money(v.grand),cls:'grand'}])}<div class="raise-tafqeet">${esc(tafqeet(v.grand))}</div><div class="raise-body">لذا نأمل بعد الإطلاع إحالته إلى جهة الاختصاص لتدقيقه وصرف مستحقات المقاول / ${esc(company)}<br>وتقبلوا تحياتنا ,,</div>${signaturesHtml()}${footerHtml(s)}</div>`;
  }
  function consumablesLetterPage() {
    const s = getSettings(), company = getCompanyName();
    const p1 = num(s.consumablesPeriod1Net), p2 = num(s.consumablesPeriod2Net), net = p1 + p2, vat = net * num(s.vatRate) / 100, grand = net + vat;
    return `<div class="page-container raise-letter-page">${headerHtml(s)}<div class="raise-to">${esc(s.recipient)} &nbsp;&nbsp; ${esc(s.recipientSuffix)}</div><div class="raise-body">السلام عليكم ورحمة الله وبركاته ...<br>مرفق طيه المستخلص الشهري لشركة ${esc(company)} والخاص ببند (المستهلكات ومقاولي الباطن) لفترة ${esc(s.purchasePeriodLabel)} لـ ${esc(s.scopeName)} دفعة رقم (${esc(s.paymentNo)}) للفترة من ${esc(fmtDate(s.period1Start))} م إلى ${esc(fmtDate(s.period1End))} م والفترة من ${esc(fmtDate(s.period2Start))} م إلى ${esc(fmtDate(s.period2End))} م.</div>${amountTable([{label:`المبلغ الصافي الشهري المستحق للمقاول عن الفترة من ${esc(fmtDate(s.period1Start))} إلى ${esc(fmtDate(s.period1End))} م`,value:moneyPlain(p1)},{label:`المبلغ الصافي الشهري المستحق للمقاول عن الفترة من ${esc(fmtDate(s.period2Start))} إلى ${esc(fmtDate(s.period2End))} م`,value:moneyPlain(p2)},{label:`ضريبة القيمة المضافة ${moneyPlain(s.vatRate)}%`,value:money(vat)},{label:'الإجمالي',value:money(grand),cls:'grand'}])}<div class="raise-tafqeet">${esc(tafqeet(grand))}</div><div class="raise-body">لذا نأمل بعد الإطلاع إحالته إلى جهة الاختصاص لتدقيقه وصرف مستحقات المقاول / ${esc(company)}<br>وتقبلوا تحياتنا ,,</div>${signaturesHtml()}${footerHtml(s)}</div>`;
  }
  function saudizationReportPage() {
    const s = getSettings(), company = getCompanyName(), data = getSaudization(), p = data.period2 || { rows: [] };
    const rows = (p.rows || []).map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.jobTitle)}</td><td>${esc(r.name)}</td><td>${esc(r.idNo)}</td><td>${moneyPlain(r.salary)}</td><td>${moneyPlain(r.compensation)}</td></tr>`).join('');
    return `<div class="page-container raise-letter-page">${headerHtml(s)}<div class="raise-title">نموذج التقرير السنوي للعقود المعتمدة ضمن لجنة تعويضات فروق الراتب</div><table class="raise-meta"><tr><td>اسم المشروع</td><td>${esc(s.projectName)}</td></tr><tr><td>قيمة المشروع</td><td>${esc(s.projectValue)}</td></tr><tr><td>الجهة الحكومية / القطاع الفرعي</td><td>${esc(s.governmentEntity)}</td></tr><tr><td>اسم المقاول</td><td>${esc(company)}</td></tr><tr><td>مدة المشروع (شهر)</td><td>${esc(s.projectDuration)}</td></tr><tr><td>تاريخ بداية المشروع</td><td>${esc(fmtDate(s.projectStart))}</td></tr><tr><td>تاريخ نهاية المشروع</td><td>${esc(fmtDate(s.projectEnd))}</td></tr><tr><td>عدد الفرص الإضافية المعتمدة بالتوطين (تعويض)</td><td>${esc(s.saudizationOpportunities)}</td></tr></table><div class="raise-title small">تفاصيل مصروفات التعويض خلال الفترة (${esc(monthNameAr(p.start || s.period2Start))} من ${esc(fmtDate(p.start || s.period2Start))} م إلى ${esc(fmtDate(p.end || s.period2End))} م)</div><table class="raise-data"><thead><tr><th>م</th><th>المسمى الوظيفي</th><th>اسم الموظف</th><th>رقم الهوية الوطنية</th><th>الراتب</th><th>مبلغ التعويض</th></tr></thead><tbody>${rows || '<tr><td colspan="6">لا توجد بيانات توطين.</td></tr>'}<tr><th colspan="5">الإجمالي</th><th>${moneyPlain(saudizationTotal('period2'))}</th></tr></tbody></table>${signaturesHtml()}${footerHtml(s)}</div>`;
  }
  function declarationPage() {
    const s = getSettings(), company = getCompanyName(), v = laborValues(), amount = num(s.declarationManualAmount) > 0 ? num(s.declarationManualAmount) : v.grand;
    return `<div class="page-container raise-letter-page">${headerHtml(s)}<div class="raise-date">التاريخ : ${esc(fmtDate(s.declarationDate))} م</div><div class="raise-title big">إقرار بعدم أسبقية الصرف</div><div class="raise-body declaration">تقر إدارة الصيانة بالشئون الهندسية بصحة نجران بأن مستخلص العمالة لشركة ${esc(company)} موقع (${esc(s.scopeName)}) لفترة ${esc(s.purchasePeriodLabel)} دفعة رقم (${esc(s.paymentNo)}) بمبلغ وقدره (${money(amount)}) ${esc(tafqeet(amount))}.<br><br>لم يسبق صرفه من قبلنا.</div>${signaturesHtml()}${footerHtml(s)}</div>`;
  }
  function lettersCss() {
    return `<style id="raise-letters-print-all-css">
      @page raise-letters-page { size:A4 portrait; margin:12mm; }
      .raise-letter-page{page:raise-letters-page!important;position:relative;min-height:273mm;padding:0;font-family:Tajawal,Arial,sans-serif;direction:rtl;color:#111827;background:#fff;page-break-after:always;}
      .raise-head{display:grid;grid-template-columns:80px 1fr 80px;align-items:center;border-bottom:2px solid #003087;padding-bottom:8px;margin-bottom:18px}.raise-head img{width:70px}.raise-head div{text-align:center}.raise-head h1{font-size:17px;margin:0 0 3px;color:#003087}.raise-head h2{font-size:15px;margin:0;color:#111827}.raise-to{font-size:15px;font-weight:900;margin:18px 0 10px}.raise-body{font-size:15px;line-height:2.05;text-align:justify}.raise-amount-table{width:100%;border-collapse:collapse;margin:14px 0;font-size:14px}.raise-amount-table td{border:1px solid #333;padding:8px}.raise-amount-table td:first-child{text-align:right;font-weight:700;width:72%}.raise-amount-table td:last-child{text-align:center;font-weight:900;direction:ltr}.raise-amount-table .total td{background:#f1f5f9;font-weight:900}.raise-amount-table .grand td{background:#fff7d6;font-weight:900}.raise-tafqeet{border:1px solid #94a3b8;background:#f8fafc;border-radius:8px;padding:8px 12px;margin-top:8px;font-weight:900;line-height:1.8}.raise-signatures{display:grid;gap:20px;margin-top:35px;text-align:center}.raise-signatures .sig-title{font-weight:900}.raise-signatures .sig-name{font-weight:800;margin-top:10px}.raise-signatures .line{height:42px;border-bottom:1px solid #111;margin:8px 30px}.raise-footer{position:absolute;bottom:0;left:0;right:0;border-top:1px solid #cbd5e1;padding-top:5px;font-size:11px;display:flex;justify-content:space-between;direction:ltr}.raise-title{text-align:center;font-size:18px;font-weight:900;margin:14px 0}.raise-title.small{font-size:14px}.raise-title.big{font-size:25px;text-decoration:underline;margin:25px 0}.raise-date{text-align:left;font-size:14px;font-weight:900;margin-top:10px}.raise-meta,.raise-data{width:100%;border-collapse:collapse;font-size:12.5px;margin:10px 0}.raise-meta td,.raise-data td,.raise-data th{border:1px solid #333;padding:6px}.raise-data th{background:#e5e7eb;font-weight:900}.raise-data td{text-align:center}.declaration{font-size:20px;line-height:2.1;margin-top:20px}
    </style>`;
  }
  function buildSelectedLetters() {
    const opts = {
      labor: !!document.getElementById('print-opt-raise-labor')?.checked,
      consumables: !!document.getElementById('print-opt-raise-consumables')?.checked,
      saudization: !!document.getElementById('print-opt-raise-saudization')?.checked,
      declaration: !!document.getElementById('print-opt-raise-declaration')?.checked
    };
    let html = '';
    if (opts.saudization) html += saudizationReportPage();
    if (opts.labor) html += laborLetterPage();
    if (opts.consumables) html += consumablesLetterPage();
    if (opts.declaration) html += declarationPage();
    return html;
  }
  function patchPrintDialog() {
    if (typeof window.openPrintDialog !== 'function' || window.openPrintDialog.__raiseLettersPatched) return false;
    const original = window.openPrintDialog;
    window.openPrintDialog = function patchedOpenPrintDialog() {
      const result = original.apply(this, arguments);
      setTimeout(() => {
        const body = document.querySelector('#management-dialog .dialog-body');
        if (!body || document.getElementById('print-opt-raise-labor')) return;
        body.insertAdjacentHTML('beforeend', `<fieldset><legend>3. خطابات الرفع</legend><div class="checkbox-grid"><div class="form-group-checkbox"><input type="checkbox" id="print-opt-raise-saudization" checked><label for="print-opt-raise-saudization">تقرير التوطين</label></div><div class="form-group-checkbox"><input type="checkbox" id="print-opt-raise-labor" checked><label for="print-opt-raise-labor">خطاب رفع العمالة</label></div><div class="form-group-checkbox"><input type="checkbox" id="print-opt-raise-consumables" checked><label for="print-opt-raise-consumables">خطاب رفع المستهلكات</label></div><div class="form-group-checkbox"><input type="checkbox" id="print-opt-raise-declaration" checked><label for="print-opt-raise-declaration">إقرار عدم أسبقية الصرف</label></div></div></fieldset>`);
      }, 80);
      return result;
    };
    window.openPrintDialog.__raiseLettersPatched = true;
    return true;
  }
  function patchPrintSelected() {
    if (typeof window.printSelected !== 'function' || window.printSelected.__raiseLettersPatched) return false;
    const original = window.printSelected;
    window.printSelected = function patchedPrintSelected() {
      const lettersHtml = buildSelectedLetters();
      if (!lettersHtml) return original.apply(this, arguments);
      let capturedWin = null;
      const realOpen = window.open;
      window.open = function () { capturedWin = realOpen.apply(window, arguments); return capturedWin; };
      const result = original.apply(this, arguments);
      window.open = realOpen;
      if (capturedWin && capturedWin.document) {
        setTimeout(() => {
          try {
            const originalOnload = capturedWin.onload;
            capturedWin.onload = function () {
              try {
                if (!capturedWin.document.getElementById('raise-letters-print-all-css')) capturedWin.document.head.insertAdjacentHTML('beforeend', lettersCss());
                capturedWin.document.body.insertAdjacentHTML('beforeend', lettersHtml);
              } catch (e) { console.error('[PrintAllLetters] append failed', e); }
              if (typeof originalOnload === 'function') return originalOnload.call(capturedWin);
              capturedWin.focus(); capturedWin.print(); capturedWin.close();
            };
          } catch (e) { console.error('[PrintAllLetters] onload patch failed', e); }
        }, 0);
      }
      return result;
    };
    window.printSelected.__raiseLettersPatched = true;
    return true;
  }
  function boot(attempt) {
    patchPrintDialog();
    patchPrintSelected();
    if (attempt < 40 && (!window.openPrintDialog?.__raiseLettersPatched || !window.printSelected?.__raiseLettersPatched)) setTimeout(() => boot(attempt + 1), 250);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot(0)); else boot(0);
  console.info('[Admin Offices Print All Letters] installed');
})();
