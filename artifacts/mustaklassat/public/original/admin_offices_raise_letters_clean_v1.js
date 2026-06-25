// ===================================================================
// Admin Offices Raise Letters Clean V1
// Safe test screen. Loads only when URL has ?raiseLettersClean=1
// Does not hide body children and does not modify admin offices page structure.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;
  if (new URLSearchParams(location.search).get('raiseLettersClean') !== '1') return;
  if (window.__ADMIN_OFFICES_RAISE_LETTERS_CLEAN_V1__) return;
  window.__ADMIN_OFFICES_RAISE_LETTERS_CLEAN_V1__ = true;

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

  function clean(v) {
    return String(v == null ? '' : v).replace(/[\u200e\u200f]/g, '').replace(/\s+/g, ' ').trim();
  }

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
    const start = toIsoDate(firstValue(e.extractStart, e.periodStart, e.startDate, e.fromDate, localStorage.getItem('extractStart'), localStorage.getItem('periodStart'), localStorage.getItem('startDate'), s.extractStart, s.period2Start, s.period1Start));
    const end = toIsoDate(firstValue(e.extractEnd, e.periodEnd, e.endDate, e.toDate, localStorage.getItem('extractEnd'), localStorage.getItem('periodEnd'), localStorage.getItem('endDate'), s.extractEnd, s.period2End, s.period1End));
    const paymentNo = normalizePaymentNo(firstValue(e.paymentNumber, e.extractNumber, e.paymentNo, localStorage.getItem('paymentNumber'), localStorage.getItem('extractNumber'), localStorage.getItem('paymentNo'), s.paymentNo, s.paymentNumber, s.extractNumber) || '—');
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
    candidates.push(readJson('adminOfficesAttendanceData', {}));
    const count = obj => Object.values(obj || {}).reduce((sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0), 0);
    return candidates.reduce((best, obj) => count(obj) > count(best) ? obj : best, {});
  }

  function officeKeys() {
    const names = getNames();
    const data = getAttendance();
    return Array.from(new Set(Object.keys(names || {}).concat(Object.keys(data || {}))))
      .filter(k => k === 'admin_staff' || /^center_\d+$/.test(k) || Array.isArray(data[k]))
      .sort((a, b) => {
        const ac = /^center_\d+$/.test(a), bc = /^center_\d+$/.test(b);
        if (ac && bc) return parseInt(a.split('_')[1], 10) - parseInt(b.split('_')[1], 10);
        if (ac) return -1;
        if (bc) return 1;
        return String(a).localeCompare(String(b), 'ar');
      });
  }

  function defaultSettings() {
    return {
      recipient: 'سعادة / مساعد المدير العام للدعم المساند',
      recipientSuffix: 'المحترم',
      scopeName: 'المكاتب الإدارية والمرافق الصحية وصيانة وإصلاح السيارات والعيادات المتنقلة',
      vatRate: 15,
      managerTitle: '................................',
      managerName: '................................',
      unitManagerTitle: '................................',
      unitManagerName: '................................',
      finalLetterTo: 'المكرم / مدير الإدارة المالية',
      finalLetterToSuffix: 'المحترم',
      finalLetterOpening: 'نرفق طيه المستخلص النهائي لأعمال الصيانة والنظافة والتشغيل غير الطبي لـ {scopeName} حسب البيانات التالية:',
      finalLetterClosing: 'نأمل التكرم بالاطلاع وتوجيه الجهة المختصة نحو صرف استحقاق المقاول حسب النظام.',
      finalLetterSignatureTitle: 'مساعد المدير العام للدعم المساند',
      finalLetterSignatureName: '',
      finalLetterIban: ''
    };
  }

  function settings() {
    return Object.assign(defaultSettings(), readJson(SETTINGS_KEY, {}));
  }

  function saveSettings() {
    const patch = {};
    document.querySelectorAll('#admin-raise-clean [data-rl-setting]').forEach(el => { patch[el.dataset.rlSetting] = el.value; });
    writeJson(SETTINGS_KEY, Object.assign(defaultSettings(), readJson(SETTINGS_KEY, {}), patch));
    flash('تم حفظ إعدادات الخطابات.');
  }

  function flash(text) {
    const el = document.getElementById('rl-clean-flash');
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 1600);
  }

  function missing(name) { throw new Error('Missing dependency: ' + name); }

  function run(label, fn) {
    try {
      if (window.AdminOfficesRaiseLettersPeriodFix && typeof window.AdminOfficesRaiseLettersPeriodFix.fixNow === 'function') window.AdminOfficesRaiseLettersPeriodFix.fixNow();
      fn();
    } catch (err) {
      console.error('[Admin Offices Raise Letters Clean] failed:', label, err);
      alert('تعذر تنفيذ: ' + label + '\n' + err.message);
    }
  }

  const actions = {
    fullExtract: () => run('طباعة المستخلص كامل', () => window.AdminOfficesExtraDocs?.generateFullExtractPrint ? window.AdminOfficesExtraDocs.generateFullExtractPrint() : missing('generateFullExtractPrint')),
    finalRaise: () => run('خطاب الرفع النهائي', () => window.AdminOfficesExtraDocs?.generateFinalFinancialRaiseLetter ? window.AdminOfficesExtraDocs.generateFinalFinancialRaiseLetter() : missing('generateFinalFinancialRaiseLetter')),
    noPrevious: () => run('إقرار عدم أسبقية الصرف', () => window.AdminOfficesRaiseLetters?.generateDeclaration ? window.AdminOfficesRaiseLetters.generateDeclaration() : missing('generateDeclaration')),
    laborRaise: () => run('خطاب الرفع للمستخلص', () => window.AdminOfficesRaiseLetters?.generateLaborRaiseLetter ? window.AdminOfficesRaiseLetters.generateLaborRaiseLetter() : missing('generateLaborRaiseLetter')),
    groupedCert: () => run('شهادة الاستحقاق الشهري المجمعة', () => window.AdminOfficesExtraDocs?.generateGroupedMonthlyEntitlementCertificate ? window.AdminOfficesExtraDocs.generateGroupedMonthlyEntitlementCertificate() : missing('generateGroupedMonthlyEntitlementCertificate')),
    entitlement: () => run('بيان استحقاق', () => window.AdminOfficesExtraDocs?.generateEntitlementStatement ? window.AdminOfficesExtraDocs.generateEntitlementStatement() : missing('generateEntitlementStatement')),
    salary: () => run('شهادة تسليم الرواتب', () => window.AdminOfficesExtraDocs?.generateSalaryDeliveryCertificate ? window.AdminOfficesExtraDocs.generateSalaryDeliveryCertificate() : missing('generateSalaryDeliveryCertificate')),
    saudiJobs: () => run('بيان الوظائف المشغولة بالسعوديين', () => window.AdminOfficesExtraDocs?.generateSaudiOccupiedJobsStatement ? window.AdminOfficesExtraDocs.generateSaudiOccupiedJobsStatement() : missing('generateSaudiOccupiedJobsStatement')),
    absence: () => run('بيان الغيابات', () => window.AdminOfficesExtraDocs?.openEditableStatement ? window.AdminOfficesExtraDocs.openEditableStatement('absence') : missing('openEditableStatement')),
    vacation: () => run('بيان الإجازات', () => window.AdminOfficesExtraDocs?.openEditableStatement ? window.AdminOfficesExtraDocs.openEditableStatement('vacation') : missing('openEditableStatement')),
    performance: () => run('شهادة الأداء الشهري', () => window.AdminOfficesExtraDocs?.generateMonthlyPerformanceCertificates ? window.AdminOfficesExtraDocs.generateMonthlyPerformanceCertificates() : missing('generateMonthlyPerformanceCertificates')),
    selectedSites: () => run('طباعة خطابات المواقع المحددة', () => window.AdminOfficesRaiseLetters?.generateSelectedSiteLetters ? window.AdminOfficesRaiseLetters.generateSelectedSiteLetters() : missing('generateSelectedSiteLetters')),
    oneSite: () => run('طباعة خطاب الموقع المحدد', () => window.AdminOfficesRaiseLetters?.generateSiteRaiseLetter ? window.AdminOfficesRaiseLetters.generateSiteRaiseLetter() : missing('generateSiteRaiseLetter')),
    close: () => { document.getElementById('admin-raise-clean')?.remove(); }
  };

  function btn(action, text, cls) {
    return `<button type="button" class="rl-btn ${esc(cls || '')}" data-action="${esc(action)}">${esc(text)}</button>`;
  }

  function input(key, label, type) {
    const s = settings();
    return `<label class="rl-field"><span>${esc(label)}</span><input type="${esc(type || 'text')}" data-rl-setting="${esc(key)}" value="${esc(s[key] || '')}"></label>`;
  }

  function textarea(key, label) {
    const s = settings();
    return `<label class="rl-field wide"><span>${esc(label)}</span><textarea data-rl-setting="${esc(key)}">${esc(s[key] || '')}</textarea></label>`;
  }

  function renderSites() {
    const names = getNames();
    const keys = officeKeys();
    const options = keys.map(k => `<option value="${esc(k)}">${esc(names[k] || k)}</option>`).join('');
    const checks = keys.map(k => `<label class="rl-site"><input type="checkbox" class="rl-site-check" value="${esc(k)}" checked><span>${esc(names[k] || k)}</span></label>`).join('');
    return `<div class="rl-site-top"><label class="rl-field"><span>الموقع المحدد لخطاب واحد</span><select id="rl-site-select"><option value="">اختر الموقع</option>${options}</select></label><div class="rl-phrase">${extractPhrase()}</div></div><div class="rl-sites">${checks || '<b>لا توجد مواقع محفوظة.</b>'}</div>`;
  }

  function ensureCss() {
    if (document.getElementById('admin-raise-clean-css')) return;
    const st = document.createElement('style');
    st.id = 'admin-raise-clean-css';
    st.textContent = `#admin-raise-clean{position:fixed;inset:0;z-index:2147483000;background:#eef3f9;overflow:auto;padding:18px;font-family:Tajawal,Arial,sans-serif;color:#0f172a;direction:rtl}#admin-raise-clean *{box-sizing:border-box}#admin-raise-clean .box{width:min(1280px,96vw);margin:0 auto;background:#fff;border-radius:22px;padding:18px;box-shadow:0 18px 55px rgba(15,23,42,.18)}#admin-raise-clean .head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;border-bottom:1px solid #e2e8f0;padding-bottom:14px;margin-bottom:12px}#admin-raise-clean h2{margin:0 0 6px;color:#003087;font-size:22px;font-weight:950}#admin-raise-clean h3{margin:0 0 4px;font-size:17px}#admin-raise-clean p,#admin-raise-clean small{color:#64748b;font-weight:800}.rl-group{border:1px solid #dbe4f0;border-radius:18px;padding:14px;margin:12px 0;background:#fff}.rl-group.extract{border-top:4px solid #003087}.rl-group.cert{border-top:4px solid #0f766e}.rl-group.sites-box{border-top:4px solid #d4af37;background:#fffdf3}.rl-group.manage{border-top:4px solid #64748b}.rl-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.rl-btn{border:1px solid #cbd5e1;border-radius:10px;padding:9px 13px;font-weight:950;cursor:pointer;background:#f1f5f9;color:#0f172a;font-family:inherit}.rl-btn.primary{background:#003087;color:#fff;border-color:#003087}.rl-btn.cert{background:#ecfdf5;color:#065f46;border-color:#a7f3d0}.rl-btn.site{background:#fff7d6;color:#7a4f00;border-color:#f3d675}.rl-btn.settings{background:#0f766e;color:#fff}.settings-panel{display:none;border:2px solid #0f766e;background:#f0fdfa;border-radius:18px;padding:14px;margin:12px 0}.settings-panel.open{display:block}.rl-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.rl-field{display:block;background:#fff;border:1px solid #dbe4f0;border-radius:12px;padding:10px}.rl-field span{display:block;font-size:12px;font-weight:950;color:#334155;margin-bottom:6px}.rl-field input,.rl-field select,.rl-field textarea{width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:9px;font-family:inherit;font-weight:800}.rl-field.wide{grid-column:1/-1}.rl-field textarea{min-height:76px}#rl-clean-flash{display:none;margin:0 0 10px;padding:10px;border-radius:12px;background:#ecfdf5;color:#166534;border:1px solid #bbf7d0;text-align:center;font-weight:950}#rl-clean-flash.show{display:block}.rl-site-top{display:grid;grid-template-columns:minmax(260px,380px) 1fr;gap:12px}.rl-phrase{padding:12px;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;font-weight:950;color:#7a4f00}.rl-sites{max-height:260px;overflow:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px;margin-top:10px}.rl-site{display:flex;gap:8px;align-items:center;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px;font-weight:900}@media(max-width:820px){#admin-raise-clean .head,.rl-site-top{display:block}}@media print{#admin-raise-clean{position:static;padding:0;background:#fff}.rl-btn,.settings-panel{display:none!important}.box{box-shadow:none!important;width:auto!important}}`;
    document.head.appendChild(st);
  }

  function render() {
    document.getElementById('admin-raise-clean')?.remove();
    const html = `<div id="admin-raise-clean"><div class="box"><div class="head"><div><h2>خطابات رفع عمالة المكاتب الإدارية</h2><h3>مركز خطابات المستخلص</h3><p>الأزرار مرتبة حسب نوع المستند. الإعدادات مخفية وتفتح عند الحاجة فقط.</p></div>${btn('close','إغلاق','')}</div><div id="rl-clean-flash"></div><div class="rl-row">${btn('toggleSettings','إعدادات الخطابات','settings')}</div><section id="rl-settings" class="settings-panel"><h3>إعدادات الخطابات</h3><div class="rl-grid">${input('recipient','اسم المخاطب')}${input('recipientSuffix','الصفة')}${input('scopeName','نطاق الخطاب')}${input('vatRate','نسبة الضريبة','number')}${input('managerTitle','صفة التوقيع')}${input('managerName','اسم المسؤول')}${input('finalLetterTo','خطاب الرفع النهائي — الموجه إليه')}${input('finalLetterIban','الآيبان')}${textarea('finalLetterOpening','افتتاح خطاب الرفع النهائي')}${textarea('finalLetterClosing','ختام خطاب الرفع النهائي')}</div><div class="rl-row">${btn('saveSettings','حفظ الإعدادات','primary')}${btn('toggleSettings','إخفاء الإعدادات','')}</div></section><section class="rl-group extract"><h3>١. مستندات المستخلص</h3><small>كل ما يخص المستخلص كاملًا قبل تفاصيل المواقع.</small><div class="rl-row">${btn('fullExtract','طباعة المستخلص كامل','primary')}${btn('finalRaise','خطاب الرفع النهائي','primary')}${btn('noPrevious','إقرار عدم أسبقية الصرف','primary')}${btn('laborRaise','خطاب الرفع للمستخلص','primary')}</div></section><section class="rl-group cert"><h3>٢. الشهادات والبيانات العامة</h3><small>شهادات وبيانات على مستوى المستخلص كله وليست لموقع منفرد.</small><div class="rl-row">${btn('groupedCert','شهادة الاستحقاق الشهري المجمعة','cert')}${btn('entitlement','بيان استحقاق','cert')}${btn('salary','شهادة تسليم الرواتب','cert')}${btn('saudiJobs','بيان الوظائف المشغولة بالسعوديين','cert')}${btn('absence','بيان الغيابات','cert')}${btn('vacation','بيان الإجازات','cert')}${btn('performance','شهادة الأداء الشهري','cert')}</div></section><section class="rl-group sites-box"><h3>٣. خطابات ومرفقات المواقع</h3><small>اختيار المواقع هنا فقط، وتطبع المستندات المتكررة لكل موقع.</small>${renderSites()}<div class="rl-row">${btn('selectedSites','طباعة خطابات المواقع المحددة','site')}${btn('oneSite','طباعة خطاب الموقع المحدد','site')}</div></section><section class="rl-group manage"><h3>٤. إدارة</h3><small>إغلاق نافذة الخطابات فقط.</small><div class="rl-row">${btn('close','إغلاق التبويب','')}</div></section></div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    ensureCss();
  }

  document.addEventListener('click', function (e) {
    const root = document.getElementById('admin-raise-clean');
    const btnEl = e.target.closest && e.target.closest('#admin-raise-clean [data-action]');
    if (!root || !btnEl) return;
    e.preventDefault();
    const a = btnEl.getAttribute('data-action');
    if (a === 'toggleSettings') return document.getElementById('rl-settings')?.classList.toggle('open');
    if (a === 'saveSettings') return saveSettings();
    if (actions[a]) return actions[a]();
  }, true);

  window.AdminOfficesRaiseLettersCleanV1 = { render, meta, extractPhrase };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render); else render();
  setTimeout(render, 700);
  console.info('[Admin Offices Raise Letters Clean V1] installed safe main test file');
})();