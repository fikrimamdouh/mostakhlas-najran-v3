// ===================================================================
// Admin Offices Raise Letters Clean V1
// Test-only clean screen for admin offices raise letters.
// Rules:
// - Does not hide or mutate body children.
// - Does not replace admin_offices_attendance.html.
// - Uses existing printing engines where possible.
// - Shows one clean full-screen layer above the page.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;

  const PARAM = 'raiseLettersClean';
  const isCleanMode = new URLSearchParams(location.search).get(PARAM) === '1';
  const SETTINGS_KEY = 'adminOfficesRaiseLettersSettings_v1';

  function readJson(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value || {})); } catch (_) {}
  }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function clean(v) { return String(v == null ? '' : v).replace(/[\u200e\u200f]/g, '').replace(/\s+/g, ' ').trim(); }

  function firstValue() {
    for (let i = 0; i < arguments.length; i++) {
      const v = clean(arguments[i]);
      if (v && v !== 'غير محدد' && v !== 'undefined' && v !== 'null' && v !== '—' && v !== '-') return v;
    }
    return '';
  }

  function normalizeDigits(value) {
    const ar = '٠١٢٣٤٥٦٧٨٩';
    const fa = '۰۱۲۳۴۵۶۷۸۹';
    return clean(value).replace(/[٠-٩]/g, d => ar.indexOf(d)).replace(/[۰-۹]/g, d => fa.indexOf(d));
  }

  function normalizePaymentNo(value) {
    const v = normalizeDigits(value);
    if (!v || v === '—' || v === '-') return v || '—';
    if (/^0*\d+$/.test(v)) return String(Number(v));
    return v;
  }

  function toIsoDate(value) {
    const v = normalizeDigits(value);
    if (!v) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    let m = v.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
    m = v.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (m) return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return '';
  }

  function meta() {
    try {
      if (window.AdminOfficesRaiseLettersPeriodFix && typeof window.AdminOfficesRaiseLettersPeriodFix.getMeta === 'function') {
        const m = window.AdminOfficesRaiseLettersPeriodFix.getMeta() || {};
        return { start: toIsoDate(m.start), end: toIsoDate(m.end), paymentNo: normalizePaymentNo(m.paymentNo) };
      }
    } catch (_) {}

    const e = readJson('persistentExtractData', {});
    const s = readJson(SETTINGS_KEY, {});
    const snap = readJson('najran_revision_snapshot', {});
    let rev = {};
    try { rev = typeof snap.persistentExtractData === 'string' ? JSON.parse(snap.persistentExtractData) : (snap.persistentExtractData || snap.extractData || {}); } catch (_) { rev = {}; }

    const start = toIsoDate(firstValue(
      e.extractStart, e.periodStart, e.startDate, e.start, e.fromDate, e.dateFrom,
      rev.extractStart, rev.periodStart, rev.startDate, rev.start, rev.fromDate, rev.dateFrom,
      localStorage.getItem('extractStart'), localStorage.getItem('periodStart'), localStorage.getItem('startDate'),
      s.extractStart, s.period2Start, s.period1Start
    ));
    const end = toIsoDate(firstValue(
      e.extractEnd, e.periodEnd, e.endDate, e.end, e.toDate, e.dateTo,
      rev.extractEnd, rev.periodEnd, rev.endDate, rev.end, rev.toDate, rev.dateTo,
      localStorage.getItem('extractEnd'), localStorage.getItem('periodEnd'), localStorage.getItem('endDate'),
      s.extractEnd, s.period2End, s.period1End
    ));
    const paymentNo = normalizePaymentNo(firstValue(
      e.paymentNumber, e.extractNumber, e.paymentNo, e.extractNo, e.batchNumber,
      rev.paymentNumber, rev.extractNumber, rev.paymentNo, rev.extractNo, rev.batchNumber,
      localStorage.getItem('paymentNumber'), localStorage.getItem('extractNumber'), localStorage.getItem('paymentNo'),
      s.paymentNo, s.paymentNumber, s.extractNumber
    ) || '—');
    return { start, end, paymentNo };
  }

  function extractPhrase() {
    const m = meta();
    return `دفعة رقم (${esc(m.paymentNo || '—')}) عن الفترة من ${esc(m.start || 'غير محدد')} م إلى ${esc(m.end || 'غير محدد')} م`;
  }

  function getNames() {
    try { if (typeof window.getCenterNames === 'function') return window.getCenterNames() || {}; } catch (_) {}
    return readJson('adminOfficeNames_v1', {});
  }

  function getAttendance() {
    const candidates = [];
    try { if (typeof window.getAttendanceData === 'function') candidates.push(window.getAttendanceData() || {}); } catch (_) {}
    candidates.push(readJson('adminOfficesAttendanceData_v1', {}));
    candidates.push(readJson('adminOfficesAttendanceData_v1_localBackup', {}));
    candidates.push(readJson('adminOfficesAttendanceData', {}));
    const count = obj => Object.values(obj || {}).reduce((s, rows) => s + (Array.isArray(rows) ? rows.length : 0), 0);
    return candidates.reduce((best, obj) => count(obj) > count(best) ? obj : best, {});
  }

  function officeKeys() {
    const names = getNames();
    const data = getAttendance();
    return Array.from(new Set([].concat(Object.keys(names || {}), Object.keys(data || {}))))
      .filter(k => k === 'admin_staff' || /^center_\d+$/.test(k) || Array.isArray(data[k]))
      .sort((a, b) => {
        const ac = /^center_\d+$/.test(a), bc = /^center_\d+$/.test(b);
        if (ac && bc) return parseInt(a.split('_')[1], 10) - parseInt(b.split('_')[1], 10);
        if (ac) return -1;
        if (bc) return 1;
        if (a === 'admin_staff') return 1;
        if (b === 'admin_staff') return -1;
        return String(a).localeCompare(String(b), 'ar');
      });
  }

  function defaultSettings() {
    return {
      recipient: 'سعادة / مساعد المدير العام للدعم المساند',
      recipientSuffix: 'المحترم',
      entityTitle: 'المديرية العامة للشئون الصحية بمنطقة نجران',
      departmentTitle: 'إدارة الشئون الهندسية',
      scopeName: 'المكاتب الإدارية والمرافق الصحية وصيانة وإصلاح السيارات والعيادات المتنقلة',
      vatRate: 15,
      phoneFaxAr: 'نجران – تليفون 0175225872    فاكس 017523312',
      phoneFaxEn: 'Najran – Tel.: 0175225872       Fax: 017523312',
      managerTitle: '................................',
      managerName: '................................',
      unitManagerTitle: '................................',
      unitManagerName: '................................',
      declarationDate: new Date().toLocaleDateString('en-CA'),
      declarationManualAmount: 0,
      finalLetterHeaderLine1: 'وزارة الصحة',
      finalLetterHeaderLine2: 'فرع وزارة الصحة بمنطقة نجران',
      finalLetterHeaderLine3: 'الإدارة المساعدة للدعم المساند',
      finalLetterSubject: '',
      finalLetterTo: 'المكرم / مدير الإدارة المالية',
      finalLetterToSuffix: 'المحترم',
      finalLetterGreeting: 'السلام عليكم ورحمة الله وبركاته',
      finalLetterOpening: 'نرفق طيه المستخلص النهائي لأعمال الصيانة والنظافة والتشغيل غير الطبي لـ {scopeName} حسب البيانات التالية:',
      finalLetterClosing: 'نأمل التكرم بالاطلاع وتوجيه الجهة المختصة نحو صرف استحقاق المقاول حسب النظام.',
      finalLetterRegards: 'مع أطيب تحياتي وتقديري،،',
      finalLetterSignatureTitle: 'مساعد المدير العام للدعم المساند',
      finalLetterSignatureName: '',
      finalLetterIban: ''
    };
  }

  function settings() { return Object.assign(defaultSettings(), readJson(SETTINGS_KEY, {})); }

  function saveSettings() {
    const patch = {};
    document.querySelectorAll('#admin-raise-clean [data-rl-setting]').forEach(el => { patch[el.dataset.rlSetting] = el.value; });
    writeJson(SETTINGS_KEY, Object.assign(defaultSettings(), readJson(SETTINGS_KEY, {}), patch));
    flash('تم حفظ إعدادات خطابات الرفع.');
  }

  function flash(text) {
    const el = document.getElementById('rl-clean-flash');
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 1600);
  }

  function field(key, label, type) {
    const s = settings();
    return `<div class="rl-field"><label>${esc(label)}</label><input type="${esc(type || 'text')}" data-rl-setting="${esc(key)}" value="${esc(s[key])}"></div>`;
  }

  function area(key, label) {
    const s = settings();
    return `<div class="rl-field rl-wide"><label>${esc(label)}</label><textarea data-rl-setting="${esc(key)}">${esc(s[key])}</textarea></div>`;
  }

  function run(label, fn) {
    try {
      if (window.AdminOfficesRaiseLettersPeriodFix && typeof window.AdminOfficesRaiseLettersPeriodFix.fixNow === 'function') window.AdminOfficesRaiseLettersPeriodFix.fixNow();
      fn();
    } catch (err) {
      console.error('[Admin Offices Raise Letters Clean] failed:', label, err);
      alert('تعذر تنفيذ: ' + label + '\nراجع Console لمعرفة السبب.');
    }
  }

  const actions = {
    fullExtract() { run('طباعة المستخلص كامل', () => window.AdminOfficesExtraDocs && window.AdminOfficesExtraDocs.generateFullExtractPrint ? window.AdminOfficesExtraDocs.generateFullExtractPrint() : missing('AdminOfficesExtraDocs.generateFullExtractPrint')); },
    finalRaise() { run('خطاب الرفع النهائي', () => window.AdminOfficesExtraDocs && window.AdminOfficesExtraDocs.generateFinalFinancialRaiseLetter ? window.AdminOfficesExtraDocs.generateFinalFinancialRaiseLetter() : missing('AdminOfficesExtraDocs.generateFinalFinancialRaiseLetter')); },
    noPrevious() { run('إقرار عدم أسبقية الصرف', () => window.AdminOfficesRaiseLetters && window.AdminOfficesRaiseLetters.generateDeclaration ? window.AdminOfficesRaiseLetters.generateDeclaration() : missing('AdminOfficesRaiseLetters.generateDeclaration')); },
    laborRaise() { run('خطاب الرفع للمستخلص', () => window.AdminOfficesRaiseLetters && window.AdminOfficesRaiseLetters.generateLaborRaiseLetter ? window.AdminOfficesRaiseLetters.generateLaborRaiseLetter() : missing('AdminOfficesRaiseLetters.generateLaborRaiseLetter')); },
    groupedCert() { run('شهادة الاستحقاق الشهري المجمعة', () => window.AdminOfficesExtraDocs && window.AdminOfficesExtraDocs.generateGroupedMonthlyEntitlementCertificate ? window.AdminOfficesExtraDocs.generateGroupedMonthlyEntitlementCertificate() : missing('AdminOfficesExtraDocs.generateGroupedMonthlyEntitlementCertificate')); },
    entitlement() { run('بيان استحقاق', () => window.AdminOfficesExtraDocs && window.AdminOfficesExtraDocs.generateEntitlementStatement ? window.AdminOfficesExtraDocs.generateEntitlementStatement() : missing('AdminOfficesExtraDocs.generateEntitlementStatement')); },
    salary() { run('شهادة تسليم الرواتب', () => window.AdminOfficesExtraDocs && window.AdminOfficesExtraDocs.generateSalaryDeliveryCertificate ? window.AdminOfficesExtraDocs.generateSalaryDeliveryCertificate() : missing('AdminOfficesExtraDocs.generateSalaryDeliveryCertificate')); },
    saudiJobs() { run('بيان الوظائف المشغولة بالسعوديين', () => window.AdminOfficesExtraDocs && window.AdminOfficesExtraDocs.generateSaudiOccupiedJobsStatement ? window.AdminOfficesExtraDocs.generateSaudiOccupiedJobsStatement() : missing('AdminOfficesExtraDocs.generateSaudiOccupiedJobsStatement')); },
    absence() { run('بيان الغيابات', () => window.AdminOfficesExtraDocs && window.AdminOfficesExtraDocs.openEditableStatement ? window.AdminOfficesExtraDocs.openEditableStatement('absence') : missing('AdminOfficesExtraDocs.openEditableStatement')); },
    vacation() { run('بيان الإجازات', () => window.AdminOfficesExtraDocs && window.AdminOfficesExtraDocs.openEditableStatement ? window.AdminOfficesExtraDocs.openEditableStatement('vacation') : missing('AdminOfficesExtraDocs.openEditableStatement')); },
    performance() { run('شهادة الأداء الشهري', () => window.AdminOfficesExtraDocs && window.AdminOfficesExtraDocs.generateMonthlyPerformanceCertificates ? window.AdminOfficesExtraDocs.generateMonthlyPerformanceCertificates() : missing('AdminOfficesExtraDocs.generateMonthlyPerformanceCertificates')); },
    selectedSites() { run('طباعة خطابات المواقع المحددة', () => window.AdminOfficesRaiseLetters && window.AdminOfficesRaiseLetters.generateSelectedSiteLetters ? window.AdminOfficesRaiseLetters.generateSelectedSiteLetters() : missing('AdminOfficesRaiseLetters.generateSelectedSiteLetters')); },
    oneSite() { run('طباعة خطاب الموقع المحدد', () => window.AdminOfficesRaiseLetters && window.AdminOfficesRaiseLetters.generateSiteRaiseLetter ? window.AdminOfficesRaiseLetters.generateSiteRaiseLetter() : missing('AdminOfficesRaiseLetters.generateSiteRaiseLetter')); },
    close() { document.getElementById('admin-raise-clean')?.remove(); try { window.close(); } catch (_) {} }
  };

  function missing(name) { throw new Error('Missing dependency: ' + name); }

  function button(key, text, cls) {
    return `<button type="button" class="rl-btn ${esc(cls || '')}" data-rl-action="${esc(key)}">${esc(text)}</button>`;
  }

  function renderSites() {
    const names = getNames();
    const keys = officeKeys();
    const options = keys.map(k => `<option value="${esc(k)}">${esc(names[k] || k)}</option>`).join('');
    const checks = keys.map(k => `<label class="rl-site"><input type="checkbox" class="rl-site-check" value="${esc(k)}" checked> <span>${esc(names[k] || k)}</span></label>`).join('');
    return `
      <div class="rl-sites-top">
        <div class="rl-field"><label>الموقع المحدد لخطاب واحد</label><select id="rl-site-select"><option value="">اختر الموقع</option>${options}</select></div>
        <div class="rl-quick"><b>تحديد سريع</b><div>${button('selectAll','تحديد الكل','soft')} ${button('selectNone','إلغاء الكل','soft')}</div><div class="rl-phrase">${extractPhrase()}</div></div>
      </div>
      <div class="rl-sites">${checks || '<div class="rl-empty">لا توجد مواقع محفوظة.</div>'}</div>
    `;
  }

  function render() {
    document.getElementById('admin-raise-clean')?.remove();
    const html = `
      <div id="admin-raise-clean" dir="rtl">
        <div class="rl-clean-dialog">
          <div class="rl-head">
            <div><h2>خطابات رفع عمالة المكاتب الإدارية</h2><h3>مركز خطابات المستخلص</h3><p>الأزرار مرتبة حسب نوع المستند. الإعدادات مخفية وتفتح عند الحاجة فقط.</p></div>
            <button type="button" class="rl-btn close" data-rl-action="close">إغلاق</button>
          </div>
          <div id="rl-clean-flash"></div>
          <div class="rl-settings-toggle-row">${button('toggleSettings','إعدادات الخطابات','settings')}</div>
          <section class="rl-settings-panel" id="rl-clean-settings" hidden>
            <h4>إعدادات الخطابات</h4>
            <div class="rl-grid">
              ${field('recipient','اسم المخاطب')}${field('recipientSuffix','الصفة / المحترم')}${field('entityTitle','العنوان الرئيسي')}${field('departmentTitle','الإدارة')}${field('scopeName','نطاق الخطاب الإجمالي')}${field('vatRate','نسبة الضريبة','number')}
              ${field('phoneFaxAr','الهاتف والفاكس عربي')}${field('phoneFaxEn','الهاتف والفاكس إنجليزي')}${field('managerTitle','التوقيع العام — الصفة')}${field('managerName','التوقيع العام — الاسم')}${field('unitManagerTitle','توقيع الإقرار — الصفة')}${field('unitManagerName','توقيع الإقرار — الاسم')}
              ${field('declarationDate','تاريخ الإقرار','date')}${field('declarationManualAmount','مبلغ الإقرار اليدوي','number')}${field('finalLetterIban','الآيبان')}${field('finalLetterTo','خطاب الرفع النهائي — الموجه إليه')}${field('finalLetterToSuffix','خطاب الرفع النهائي — الصفة')}${field('finalLetterSignatureTitle','خطاب الرفع النهائي — صفة التوقيع')}${field('finalLetterSignatureName','خطاب الرفع النهائي — اسم المسؤول')}
              ${area('finalLetterOpening','افتتاح خطاب الرفع النهائي')}${area('finalLetterClosing','ختام خطاب الرفع النهائي')}
            </div>
            <div class="rl-row">${button('saveSettings','حفظ الإعدادات','primary')} ${button('toggleSettings','إخفاء الإعدادات','soft')}</div>
          </section>
          <section class="rl-group extract"><h4>١. مستندات المستخلص</h4><small>كل ما يخص المستخلص كاملًا قبل تفاصيل المواقع.</small><div class="rl-row">${button('fullExtract','طباعة المستخلص كامل','primary')} ${button('finalRaise','خطاب الرفع النهائي','primary')} ${button('noPrevious','إقرار عدم أسبقية الصرف','primary')} ${button('laborRaise','خطاب الرفع للمستخلص','primary')}</div></section>
          <section class="rl-group cert"><h4>٢. الشهادات والبيانات العامة</h4><small>شهادات وبيانات على مستوى المستخلص كله وليست لموقع منفرد.</small><div class="rl-row">${button('groupedCert','شهادة الاستحقاق الشهري المجمعة','cert')} ${button('entitlement','بيان استحقاق','cert')} ${button('salary','شهادة تسليم الرواتب','cert')} ${button('saudiJobs','بيان الوظائف المشغولة بالسعوديين','cert')} ${button('absence','بيان الغيابات','cert')} ${button('vacation','بيان الإجازات','cert')} ${button('performance','شهادة الأداء الشهري','cert')}</div></section>
          <section class="rl-group sites-box"><h4>٣. خطابات ومرفقات المواقع</h4><small>اختيار المواقع هنا فقط، وتطبع المستندات المتكررة لكل موقع.</small><h5>اختيار المواقع لخطابات المواقع</h5>${renderSites()}<div class="rl-row">${button('selectedSites','طباعة خطابات المواقع المحددة','site')} ${button('oneSite','طباعة خطاب الموقع المحدد','site')}</div></section>
          <section class="rl-group manage"><h4>٤. إدارة</h4><small>إغلاق نافذة الخطابات فقط.</small><div class="rl-row">${button('close','إغلاق التبويب','soft')}</div></section>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    ensureCss();
    bind();
  }

  function ensureCss() {
    if (document.getElementById('admin-raise-clean-css')) return;
    const st = document.createElement('style');
    st.id = 'admin-raise-clean-css';
    st.textContent = `
      #admin-raise-clean{position:fixed;inset:0;z-index:2147483000;background:#eef3f9;overflow:auto;padding:18px;font-family:Tajawal,Arial,sans-serif;color:#0f172a}
      #admin-raise-clean *{box-sizing:border-box}
      #admin-raise-clean .rl-clean-dialog{width:min(1280px,96vw);margin:0 auto 24px;background:#fff;border-radius:22px;padding:18px;box-shadow:0 18px 55px rgba(15,23,42,.18)}
      #admin-raise-clean .rl-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;border-bottom:1px solid #e2e8f0;padding-bottom:14px;margin-bottom:14px}
      #admin-raise-clean h2{margin:0 0 6px;color:#003087;font-size:22px;font-weight:950}#admin-raise-clean h3{margin:0 0 4px;color:#0f172a;font-size:17px;font-weight:950}#admin-raise-clean p,#admin-raise-clean small{color:#64748b;font-weight:800;line-height:1.7}
      #admin-raise-clean .rl-group{border:1px solid #dbe4f0;background:#fff;border-radius:18px;padding:14px;margin:12px 0;box-shadow:0 8px 18px rgba(15,23,42,.045)}
      #admin-raise-clean .rl-group.extract{border-top:4px solid #003087}#admin-raise-clean .rl-group.cert{border-top:4px solid #0f766e}#admin-raise-clean .rl-group.sites-box{border-top:4px solid #d4af37;background:#fffdf3}#admin-raise-clean .rl-group.manage{border-top:4px solid #64748b}
      #admin-raise-clean h4{margin:0 0 4px;font-size:15px;font-weight:950}#admin-raise-clean h5{margin:12px 0 8px;color:#7a4f00;font-size:13px;font-weight:950}
      #admin-raise-clean .rl-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px}.rl-btn{border:1px solid #cbd5e1;border-radius:10px;padding:9px 13px;font-weight:950;cursor:pointer;background:#f1f5f9;color:#0f172a;font-family:inherit}.rl-btn.primary{background:#003087;color:#fff;border-color:#003087}.rl-btn.cert{background:#ecfdf5;color:#065f46;border-color:#a7f3d0}.rl-btn.site{background:#fff7d6;color:#7a4f00;border-color:#f3d675}.rl-btn.settings{background:#0f766e;color:#fff;border-color:#0f766e}.rl-btn.close{background:#f8fafc;color:#334155}
      #admin-raise-clean .rl-settings-toggle-row{display:flex;justify-content:flex-start;margin-bottom:10px}.rl-settings-panel{border:2px solid #0f766e;background:#f0fdfa;border-radius:18px;padding:14px;margin:12px 0}.rl-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.rl-field{background:#fff;border:1px solid #dbe4f0;border-radius:12px;padding:10px}.rl-field.rl-wide{grid-column:1/-1}.rl-field label{display:block;font-size:12px;font-weight:950;color:#334155;margin-bottom:6px}.rl-field input,.rl-field select,.rl-field textarea{width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:9px;font-family:inherit;font-weight:800}.rl-field textarea{min-height:76px;resize:vertical}
      #rl-clean-flash{display:none;margin:0 0 10px;padding:10px 12px;border-radius:12px;background:#ecfdf5;color:#166534;border:1px solid #bbf7d0;text-align:center;font-weight:950}#rl-clean-flash.show{display:block}.rl-sites-top{display:grid;grid-template-columns:minmax(240px,360px) 1fr;gap:12px;margin:10px 0}.rl-quick{background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:10px}.rl-phrase{margin-top:8px;padding:9px;background:#fff;border:1px solid #fde68a;border-radius:10px;font-weight:950;color:#7a4f00}.rl-sites{max-height:260px;overflow:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px}.rl-site{display:flex;gap:8px;align-items:center;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px;font-weight:900}.rl-site input{width:auto}.rl-empty{font-weight:900;color:#64748b;padding:10px}
      @media(max-width:820px){#admin-raise-clean .rl-head{flex-direction:column}.rl-sites-top{grid-template-columns:1fr}}
      @media print{#admin-raise-clean{position:static;inset:auto;padding:0;background:#fff}.rl-clean-dialog{box-shadow:none!important;width:auto!important}.rl-btn,.rl-settings-toggle-row,.rl-settings-panel{display:none!important}}
    `;
    document.head.appendChild(st);
  }

  function bind() {
    const root = document.getElementById('admin-raise-clean');
    if (!root) return;
    root.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-rl-action]');
      if (!btn) return;
      e.preventDefault();
      const action = btn.getAttribute('data-rl-action');
      if (action === 'toggleSettings') {
        const panel = document.getElementById('rl-clean-settings');
        if (panel) panel.hidden = !panel.hidden;
        return;
      }
      if (action === 'saveSettings') return saveSettings();
      if (action === 'selectAll') return document.querySelectorAll('#admin-raise-clean .rl-site-check').forEach(cb => { cb.checked = true; });
      if (action === 'selectNone') return document.querySelectorAll('#admin-raise-clean .rl-site-check').forEach(cb => { cb.checked = false; });
      if (actions[action]) return actions[action]();
    });
  }

  function openCleanTab() {
    const url = new URL(location.href);
    url.searchParams.delete('raiseLettersOnly');
    url.searchParams.set(PARAM, '1');
    url.hash = 'raise-letters-clean';
    window.open(url.toString(), '_blank');
  }

  function bootClean() {
    if (!isCleanMode) return;
    try { if (window.AdminOfficesRaiseLettersPeriodFix && typeof window.AdminOfficesRaiseLettersPeriodFix.fixNow === 'function') window.AdminOfficesRaiseLettersPeriodFix.fixNow(); } catch (_) {}
    render();
    setTimeout(render, 700);
  }

  window.AdminOfficesRaiseLettersCleanV1 = { openCleanTab, render, saveSettings, meta, extractPhrase };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootClean);
  else bootClean();

  console.info('[Admin Offices Raise Letters Clean V1] installed test-only clean screen');
})();