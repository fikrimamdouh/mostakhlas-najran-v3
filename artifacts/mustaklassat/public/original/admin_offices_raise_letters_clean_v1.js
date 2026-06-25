// ===================================================================
// Admin Offices Raise Letters Clean V1
// Safe test screen. Loads only when URL has ?raiseLettersClean=1
// Does not hide body children and does not modify admin offices page structure.
// Complete clean center + per-document settings + A4 letterhead + legacy parity.
// ===================================================================
(function () {
  'use strict';

  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;
  if (new URLSearchParams(location.search).get('raiseLettersClean') !== '1') return;
  if (window.__ADMIN_OFFICES_RAISE_LETTERS_CLEAN_V1__) return;
  window.__ADMIN_OFFICES_RAISE_LETTERS_CLEAN_V1__ = true;

  const SETTINGS_KEY = 'adminOfficesRaiseLettersSettings_v1';
  const LINE_MM = 6;
  const UI = { globalOpen: false, docOpen: false };

  const DOCS = [
    { key: 'fullExtract', label: 'طباعة المستخلص كامل', group: 'extract' },
    { key: 'finalRaise', label: 'خطاب الرفع النهائي', group: 'extract' },
    { key: 'noPrevious', label: 'إقرار عدم أسبقية الصرف', group: 'extract' },
    { key: 'laborRaise', label: 'خطاب الرفع للمستخلص', group: 'extract' },
    { key: 'groupedCert', label: 'شهادة الاستحقاق الشهري المجمعة', group: 'cert' },
    { key: 'entitlement', label: 'بيان استحقاق', group: 'cert' },
    { key: 'salary', label: 'شهادة تسليم الرواتب', group: 'cert' },
    { key: 'saudiJobs', label: 'بيان الوظائف المشغولة بالسعوديين', group: 'cert' },
    { key: 'absence', label: 'بيان الغيابات', group: 'cert' },
    { key: 'vacation', label: 'بيان الإجازات', group: 'cert' },
    { key: 'performance', label: 'شهادة الأداء الشهري', group: 'cert' },
    { key: 'selectedSites', label: 'طباعة خطابات المواقع المحددة', group: 'site' },
    { key: 'oneSite', label: 'طباعة خطاب الموقع المحدد', group: 'site' }
  ];

  const TEXT_FIELDS = [
    ['recipient', 'المخاطب / الجهة'],
    ['recipientSuffix', 'صفة المخاطب'],
    ['entityTitle', 'العنوان الرئيسي'],
    ['departmentTitle', 'الإدارة / القسم'],
    ['scopeName', 'نطاق الخطاب'],
    ['phoneFaxAr', 'الهاتف والفاكس عربي'],
    ['phoneFaxEn', 'الهاتف والفاكس إنجليزي'],
    ['managerTitle', 'صفة توقيع الخطاب'],
    ['managerName', 'اسم توقيع الخطاب'],
    ['unitManagerTitle', 'صفة توقيع الإقرار'],
    ['unitManagerName', 'اسم توقيع الإقرار'],
    ['finalLetterHeaderLine1', 'خطاب الرفع النهائي — سطر الترويسة ١'],
    ['finalLetterHeaderLine2', 'خطاب الرفع النهائي — سطر الترويسة ٢'],
    ['finalLetterHeaderLine3', 'خطاب الرفع النهائي — سطر الترويسة ٣'],
    ['finalLetterSubject', 'خطاب الرفع النهائي — الموضوع'],
    ['finalLetterTo', 'خطاب الرفع النهائي — الموجه إليه'],
    ['finalLetterToSuffix', 'خطاب الرفع النهائي — صفة الموجه إليه'],
    ['finalLetterGreeting', 'خطاب الرفع النهائي — التحية'],
    ['finalLetterRegards', 'خطاب الرفع النهائي — التقدير'],
    ['finalLetterSignatureTitle', 'خطاب الرفع النهائي — صفة التوقيع'],
    ['finalLetterSignatureName', 'خطاب الرفع النهائي — اسم المسؤول'],
    ['finalLetterIban', 'الآيبان']
  ];
  const AREA_FIELDS = [
    ['finalLetterOpening', 'افتتاح خطاب الرفع النهائي'],
    ['finalLetterClosing', 'ختام خطاب الرفع النهائي'],
    ['customIntro', 'نص افتتاح خاص'],
    ['customClosing', 'نص ختام خاص']
  ];
  const NUM_FIELDS = [
    ['vatRate', 'نسبة الضريبة'],
    ['declarationManualAmount', 'مبلغ الإقرار اليدوي']
  ];
  const DATE_FIELDS = [
    ['declarationDate', 'تاريخ الإقرار']
  ];
  const SELECT_FIELDS = [
    ['declarationAmountMode', 'طريقة مبلغ الإقرار', [['laborGrandTotal', 'تلقائي من إجمالي مستحقات العمالة'], ['manual', 'مبلغ يدوي']]]
  ];

  function readJson(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }
  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value || {})); return true; }
    catch (_) { alert('تعذر الحفظ. غالباً حجم صورة الترويسة كبير. صغّر الصورة ثم ارفعها مرة أخرى.'); return false; }
  }
  function parseObj(raw) { if (!raw) return {}; if (typeof raw === 'object') return raw; try { return JSON.parse(raw); } catch (_) { return {}; } }
  function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function clean(v) { return String(v == null ? '' : v).replace(/[\u200e\u200f]/g, '').replace(/\s+/g, ' ').trim(); }
  function firstValue() { for (let i = 0; i < arguments.length; i++) { const v = clean(arguments[i]); if (v && !['غير محدد', 'undefined', 'null', '—', '-'].includes(v)) return v; } return ''; }
  function normalizeDigits(v) { const ar = '٠١٢٣٤٥٦٧٨٩', fa = '۰۱۲۳۴۵۶۷۸۹'; return clean(v).replace(/[٠-٩]/g, d => ar.indexOf(d)).replace(/[۰-۹]/g, d => fa.indexOf(d)); }
  function normalizePaymentNo(v) { const s = normalizeDigits(v); return /^0*\d+$/.test(s) ? String(Number(s)) : (s || '—'); }
  function toIsoDate(v) {
    const s = normalizeDigits(v); if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    let m = s.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/); if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
    m = s.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/); if (m) return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
    const d = new Date(s); return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function todayIso() { return new Date().toLocaleDateString('en-CA'); }

  function defaults() {
    return {
      recipient: 'سعادة / مساعد المدير العام للدعم المساند', recipientSuffix: 'المحترم', entityTitle: 'المديرية العامة للشئون الصحية بمنطقة نجران', departmentTitle: 'إدارة الشئون الهندسية',
      scopeName: 'المكاتب الإدارية والمرافق الصحية وصيانة وإصلاح السيارات والعيادات المتنقلة', vatRate: 15,
      phoneFaxAr: 'نجران – تليفون 0175225872    فاكس 017523312', phoneFaxEn: 'Najran – Tel.: 0175225872       Fax: 017523312',
      managerTitle: '................................', managerName: '................................', unitManagerTitle: '................................', unitManagerName: '................................',
      declarationDate: todayIso(), declarationAmountMode: 'laborGrandTotal', declarationManualAmount: 0,
      finalLetterHeaderLine1: 'وزارة الصحة', finalLetterHeaderLine2: 'فرع وزارة الصحة بمنطقة نجران', finalLetterHeaderLine3: 'الإدارة المساعدة للدعم المساند', finalLetterSubject: '',
      finalLetterTo: 'المكرم / مدير الإدارة المالية', finalLetterToSuffix: 'المحترم', finalLetterGreeting: 'السلام عليكم ورحمة الله وبركاته',
      finalLetterOpening: 'نرفق طيه المستخلص النهائي لأعمال الصيانة والنظافة والتشغيل غير الطبي لـ {scopeName} حسب البيانات التالية:',
      finalLetterClosing: 'نأمل التكرم بالاطلاع وتوجيه الجهة المختصة نحو صرف استحقاق المقاول حسب النظام.', finalLetterRegards: 'مع أطيب تحياتي وتقديري،،',
      finalLetterSignatureTitle: 'مساعد المدير العام للدعم المساند', finalLetterSignatureName: '', finalLetterIban: '',
      siteLetterDefaultCenter: '', letterheadEnabled: false, letterheadMode: 'external', letterheadDataUrl: '', letterheadHeightMm: 45,
      contentTopMm: 0, blankLines: 0, lineHeightMm: LINE_MM, printScale: 100, documentSettings: {}, selectedDocKey: 'finalRaise'
    };
  }
  function settings() { const stored = readJson(SETTINGS_KEY, {}); const out = Object.assign(defaults(), stored); out.documentSettings = Object.assign({}, stored.documentSettings || {}); return out; }
  function saveAll(next) { return writeJson(SETTINGS_KEY, Object.assign(defaults(), next || {})); }
  function docLabel(key) { return (DOCS.find(d => d.key === key) || {}).label || key; }
  function docSettings(key) { const s = settings(); return Object.assign({ enabled: false, useGlobalLetterhead: true }, (s.documentSettings || {})[key] || {}); }
  function effective(key) {
    const s = settings(), d = docSettings(key); if (!d.enabled) return s;
    const out = Object.assign({}, s);
    Object.keys(d).forEach(k => { if (['enabled', 'useGlobalLetterhead'].includes(k)) return; if (d[k] !== '' && d[k] != null) out[k] = d[k]; });
    if (d.useGlobalLetterhead !== false) ['letterheadEnabled','letterheadMode','letterheadDataUrl','letterheadHeightMm','contentTopMm','blankLines','lineHeightMm','printScale'].forEach(k => out[k] = s[k]);
    return out;
  }

  function revisionData() {
    const snap = readJson('najran_revision_snapshot', {});
    return parseObj(snap.persistentExtractData) || snap.extractData || {};
  }
  function domMeta() {
    return {
      start: firstValue(document.getElementById('extract-start-date')?.textContent, document.querySelector('[data-extract-start]')?.textContent, document.querySelector('.extract-start')?.textContent),
      end: firstValue(document.getElementById('extract-end-date')?.textContent, document.querySelector('[data-extract-end]')?.textContent, document.querySelector('.extract-end')?.textContent),
      payment: firstValue(document.getElementById('payment-number')?.textContent, document.querySelector('.paymentNumber')?.textContent, document.querySelector('[data-payment-no]')?.textContent, document.querySelector('.extract-number')?.textContent)
    };
  }
  function nativePeriodMeta() {
    try {
      const fn = window.__ADMIN_OFFICES_NATIVE_GET_EXTRACT_PERIOD_DETAILS__ || window.getExtractPeriodDetails;
      if (typeof fn === 'function') {
        const p = fn() || {};
        return { start: p.startDate || p.extractStart || p.periodStart || p.start || p.fromDate || '', end: p.endDate || p.extractEnd || p.periodEnd || p.end || p.toDate || '', days: p.daysInExtract || p.daysInMonth || p.duration || 0, payment: p.paymentNo || p.paymentNumber || '' };
      }
    } catch (_) {}
    return { start: '', end: '', days: 0, payment: '' };
  }
  function addDaysIso(startIso, days) { const d = new Date(String(startIso || '') + 'T00:00:00'); if (Number.isNaN(d.getTime()) || !days) return ''; d.setDate(d.getDate() + Math.max(0, Number(days) - 1)); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  function resolveMeta() {
    try { if (window.AdminOfficesRaiseLettersPeriodFix?.getMeta) { const m = window.AdminOfficesRaiseLettersPeriodFix.getMeta() || {}; return { start: toIsoDate(m.start), end: toIsoDate(m.end), paymentNo: normalizePaymentNo(m.paymentNo) }; } } catch (_) {}
    const e = readJson('persistentExtractData', {}), s = settings(), rev = revisionData(), dom = domMeta(), fn = nativePeriodMeta();
    let start = toIsoDate(firstValue(e.extractStart, e.periodStart, e.startDate, e.start, e.fromDate, e.dateFrom, rev.extractStart, rev.periodStart, rev.startDate, rev.start, rev.fromDate, rev.dateFrom, localStorage.getItem('extractStart'), localStorage.getItem('periodStart'), localStorage.getItem('startDate'), s.extractStart, s.period2Start, s.period1Start, fn.start, dom.start));
    let end = toIsoDate(firstValue(e.extractEnd, e.periodEnd, e.endDate, e.end, e.toDate, e.dateTo, rev.extractEnd, rev.periodEnd, rev.endDate, rev.end, rev.toDate, rev.dateTo, localStorage.getItem('extractEnd'), localStorage.getItem('periodEnd'), localStorage.getItem('endDate'), s.extractEnd, s.period2End, s.period1End, fn.end, dom.end));
    if (!end && start && fn.days) end = addDaysIso(start, fn.days);
    const paymentNo = normalizePaymentNo(firstValue(e.paymentNumber, e.extractNumber, e.paymentNo, e.extractNo, e.batchNumber, e.batchNo, rev.paymentNumber, rev.extractNumber, rev.paymentNo, rev.extractNo, rev.batchNumber, rev.batchNo, localStorage.getItem('paymentNumber'), localStorage.getItem('extractNumber'), localStorage.getItem('paymentNo'), localStorage.getItem('extractNo'), localStorage.getItem('batchNumber'), s.paymentNo, s.paymentNumber, s.extractNumber, fn.payment, dom.payment) || '—');
    return { start, end, paymentNo };
  }
  function persistMeta(m) {
    if (!m) return m;
    const e = Object.assign({}, readJson('persistentExtractData', {}));
    if (m.start) e.extractStart = m.start; if (m.end) e.extractEnd = m.end; if (m.paymentNo && m.paymentNo !== '—') e.paymentNumber = normalizePaymentNo(m.paymentNo);
    try { localStorage.setItem('persistentExtractData', JSON.stringify(e)); if (m.start) { localStorage.setItem('extractStart', m.start); localStorage.setItem('periodStart', m.start); localStorage.setItem('startDate', m.start); } if (m.end) { localStorage.setItem('extractEnd', m.end); localStorage.setItem('periodEnd', m.end); localStorage.setItem('endDate', m.end); } if (m.paymentNo && m.paymentNo !== '—') { localStorage.setItem('paymentNumber', normalizePaymentNo(m.paymentNo)); localStorage.setItem('extractNumber', normalizePaymentNo(m.paymentNo)); localStorage.setItem('paymentNo', normalizePaymentNo(m.paymentNo)); } } catch (_) {}
    return m;
  }
  function meta() { return persistMeta(resolveMeta()); }
  function extractPhrase() { const m = meta(); return `دفعة رقم (${esc(m.paymentNo || '—')}) عن الفترة من ${esc(m.start || 'غير محدد')} م إلى ${esc(m.end || 'غير محدد')} م`; }

  function getNames() { try { if (typeof window.getCenterNames === 'function') return window.getCenterNames() || {}; } catch (_) {} return readJson('adminOfficeNames_v1', {}); }
  function countRows(o) { return Object.values(o || {}).reduce((s, r) => s + (Array.isArray(r) ? r.length : 0), 0); }
  function getAttendance() {
    const arr = [];
    try { if (typeof window.getAttendanceData === 'function') arr.push(window.getAttendanceData() || {}); } catch (_) {}
    arr.push(readJson('adminOfficesAttendanceData_v1', {}), readJson('adminOfficesAttendanceData_v1_localBackup', {}), readJson('adminOfficesAttendanceData', {}), readJson('admin_offices_attendance_data', {}));
    const best = arr.reduce((b, o) => countRows(o) > countRows(b) ? o : b, {});
    if (countRows(best) > 0) { try { localStorage.setItem('adminOfficesAttendanceData_v1', JSON.stringify(best)); } catch (_) {} }
    return best;
  }
  function officeKeys() {
    const n = getNames(), d = getAttendance();
    return Array.from(new Set(Object.keys(n || {}).concat(Object.keys(d || {}))))
      .filter(k => k === 'admin_staff' || /^center_\d+$/.test(k) || Array.isArray(d[k]))
      .sort((a, b) => { const ac = /^center_\d+$/.test(a), bc = /^center_\d+$/.test(b); if (ac && bc) return parseInt(a.split('_')[1], 10) - parseInt(b.split('_')[1], 10); if (ac) return -1; if (bc) return 1; return String(a).localeCompare(String(b), 'ar'); });
  }

  function flash(t) { const el = document.getElementById('rl-clean-flash'); if (!el) return; el.textContent = t; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 1800); }
  function input(name, label, type, scope, val) { return `<label class="rl-field"><span>${esc(label)}</span><input type="${esc(type || 'text')}" ${scope === 'doc' ? 'data-doc-field' : 'data-global-field'}="${esc(name)}" value="${esc(val ?? '')}"></label>`; }
  function area(name, label, scope, val) { return `<label class="rl-field wide"><span>${esc(label)}</span><textarea ${scope === 'doc' ? 'data-doc-field' : 'data-global-field'}="${esc(name)}">${esc(val ?? '')}</textarea></label>`; }
  function select(name, label, scope, val, opts) { return `<label class="rl-field"><span>${esc(label)}</span><select ${scope === 'doc' ? 'data-doc-field' : 'data-global-field'}="${esc(name)}">${opts.map(o => `<option value="${esc(o[0])}" ${String(val) === String(o[0]) ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select></label>`; }
  function button(action, text, cls, key) { return `<button type="button" class="rl-btn ${esc(cls || '')}" data-action="${esc(action)}" ${key ? `data-doc-key="${esc(key)}"` : ''}>${esc(text)}</button>`; }

  function fieldHtml(scope, source) {
    return TEXT_FIELDS.map(f => input(f[0], f[1], 'text', scope, source[f[0]])).join('') +
      NUM_FIELDS.map(f => input(f[0], f[1], 'number', scope, source[f[0]])).join('') +
      DATE_FIELDS.map(f => input(f[0], f[1], 'date', scope, source[f[0]])).join('') +
      SELECT_FIELDS.map(f => select(f[0], f[1], scope, source[f[0]], f[2])).join('') +
      AREA_FIELDS.map(f => area(f[0], f[1], scope, source[f[0]])).join('');
  }

  function saveGlobalFromUI() { const s = settings(); document.querySelectorAll('#admin-raise-clean [data-global-field]').forEach(el => { s[el.dataset.globalField] = el.type === 'checkbox' ? el.checked : el.value; }); saveAll(s); UI.globalOpen = true; flash('تم حفظ الإعدادات العامة.'); render(); }
  function saveDocFromUI() { const s = settings(), key = document.getElementById('rl-doc-select')?.value || s.selectedDocKey || 'finalRaise'; s.selectedDocKey = key; s.documentSettings = s.documentSettings || {}; const d = Object.assign({}, s.documentSettings[key] || {}); document.querySelectorAll('#admin-raise-clean [data-doc-field]').forEach(el => { d[el.dataset.docField] = el.type === 'checkbox' ? el.checked : el.value; }); d.enabled = !!document.getElementById('rl-doc-enabled')?.checked; d.useGlobalLetterhead = !!document.getElementById('rl-doc-use-global-letterhead')?.checked; s.documentSettings[key] = d; saveAll(s); UI.docOpen = true; flash('تم حفظ إعدادات خطاب: ' + docLabel(key)); render(); }
  function copyGlobalToDoc() { const s = settings(), key = document.getElementById('rl-doc-select')?.value || s.selectedDocKey || 'finalRaise'; const d = { enabled: true, useGlobalLetterhead: true }; TEXT_FIELDS.concat(AREA_FIELDS).concat(NUM_FIELDS).concat(DATE_FIELDS).forEach(x => { d[x[0]] = s[x[0]] || ''; }); SELECT_FIELDS.forEach(x => { d[x[0]] = s[x[0]] || ''; }); ['contentTopMm','blankLines','lineHeightMm','printScale','letterheadMode','letterheadHeightMm'].forEach(k => d[k] = s[k] || ''); s.documentSettings = s.documentSettings || {}; s.documentSettings[key] = d; s.selectedDocKey = key; saveAll(s); UI.docOpen = true; flash('تم نسخ العام إلى خطاب: ' + docLabel(key)); render(); }
  function clearDoc() { const s = settings(), key = document.getElementById('rl-doc-select')?.value || s.selectedDocKey || 'finalRaise'; s.documentSettings = s.documentSettings || {}; s.documentSettings[key] = { enabled: false, useGlobalLetterhead: true }; s.selectedDocKey = key; saveAll(s); UI.docOpen = true; flash('تم تفريغ إعدادات خطاب: ' + docLabel(key)); render(); }
  function copyDocToDoc() { const from = document.getElementById('rl-doc-select')?.value || settings().selectedDocKey || 'finalRaise', to = document.getElementById('rl-copy-to-doc')?.value; if (!to || to === from) return alert('اختر خطاباً مختلفاً للنسخ إليه.'); const s = settings(); s.documentSettings = s.documentSettings || {}; s.documentSettings[to] = Object.assign({}, s.documentSettings[from] || {}, { enabled: true }); s.selectedDocKey = to; saveAll(s); UI.docOpen = true; flash('تم نسخ إعدادات ' + docLabel(from) + ' إلى ' + docLabel(to)); render(); }
  function resetAllSettings() { if (!confirm('سيتم حذف كل إعدادات الخطابات والترويسة. تأكيد؟')) return; localStorage.removeItem(SETTINGS_KEY); UI.globalOpen = true; UI.docOpen = false; render(); flash('تمت إعادة ضبط إعدادات الخطابات.'); }
  function exportSettings() { const blob = new Blob([JSON.stringify(settings(), null, 2)], { type: 'application/json;charset=utf-8' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'admin_offices_raise_letters_settings.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  function importSettings(file) { if (!file) return; const r = new FileReader(); r.onload = function () { try { const imported = JSON.parse(String(r.result || '{}')); const next = Object.assign(defaults(), imported || {}); next.documentSettings = imported.documentSettings || {}; saveAll(next); UI.globalOpen = true; UI.docOpen = false; render(); flash('تم استيراد إعدادات الخطابات.'); } catch (_) { alert('ملف الإعدادات غير صالح.'); } }; r.readAsText(file, 'utf-8'); }
  function uploadLetterhead(file) { if (!file) return; if (!/^image\//.test(file.type || '')) return alert('ارفع صورة ترويسة فقط.'); if (file.size > 1000000 && !confirm('حجم الصورة أكبر من 1MB وقد يبطئ الحفظ. الأفضل ضغطها. الاستمرار؟')) return; const r = new FileReader(); r.onload = function () { const s = settings(); s.letterheadDataUrl = String(r.result || ''); s.letterheadEnabled = true; saveAll(s); UI.globalOpen = true; flash('تم رفع الترويسة A4.'); render(); }; r.readAsDataURL(file); }

  function totalTopMm(eff) { return Number(eff.contentTopMm || 0) + Number(eff.blankLines || 0) * Number(eff.lineHeightMm || LINE_MM); }
  function printCss(eff) { const top = totalTopMm(eff), scale = Math.max(70, Math.min(130, Number(eff.printScale || 100))) / 100, img = eff.letterheadEnabled && eff.letterheadDataUrl ? String(eff.letterheadDataUrl) : '', mode = eff.letterheadMode || 'external', h = Number(eff.letterheadHeightMm || 45); let before = ''; if (img && mode === 'full') before = `body:before{content:"";position:fixed;inset:0;background:url("${img}") top center/210mm 297mm no-repeat!important;z-index:-1;pointer-events:none}`; if (img && mode === 'top') before = `body:before{content:"";position:fixed;top:0;left:0;right:0;height:${h}mm;background:url("${img}") top center/100% ${h}mm no-repeat!important;z-index:999999;pointer-events:none}`; return `<style id="rl-clean-print-letterhead">@media screen,print{body{padding-top:${top}mm!important;transform:scale(${scale})!important;transform-origin:top center!important}${before}}@media print{.toolbar,.print-toolbar,.no-print{display:none!important}}</style>`; }
  function decoratePrintHtml(html, eff) { if (typeof html !== 'string') return html; const css = printCss(eff); if (/rl-clean-print-letterhead/.test(html)) return html; if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, css + '</head>'); return css + html; }
  function installPrintGuard() { if (window.__RL_CLEAN_PRINT_GUARD__) return; window.__RL_CLEAN_PRINT_GUARD__ = true; const nativeOpen = window.open; window.open = function () { const w = nativeOpen.apply(window, arguments); patchPrintWindow(w); setTimeout(() => patchPrintWindow(w), 50); setTimeout(() => patchPrintWindow(w), 150); return w; }; }
  function patchPrintWindow(w) { try { if (!w || !w.document || w.document.__RL_CLEAN_DOC_PATCHED__) return; w.document.__RL_CLEAN_DOC_PATCHED__ = true; const oldWrite = w.document.write.bind(w.document); w.document.write = function () { const eff = window.__RL_CLEAN_ACTIVE_PRINT_SETTINGS__ || settings(); const args = Array.from(arguments).map(x => decoratePrintHtml(x, eff)); return oldWrite.apply(w.document, args); }; } catch (_) {} }
  function applySiteSelectionForLegacy(key) { const s = settings(), single = document.getElementById('rl-site-select'); if (single && single.value) { s.siteLetterDefaultCenter = single.value; saveAll(s); } if (key === 'oneSite' && single && !single.value) { const first = s.siteLetterDefaultCenter || officeKeys()[0]; if (first) single.value = first; } }
  function withDocSettings(key, fn) { installPrintGuard(); applySiteSelectionForLegacy(key); const raw = localStorage.getItem(SETTINGS_KEY), base = settings(), eff = effective(key), m = meta(); window.__RL_CLEAN_ACTIVE_PRINT_SETTINGS__ = eff; const merged = Object.assign({}, base, eff, { documentSettings: base.documentSettings, selectedDocKey: key, paymentNo: m.paymentNo, paymentNumber: m.paymentNo, extractStart: m.start, extractEnd: m.end }); writeJson(SETTINGS_KEY, merged); try { if (window.AdminOfficesRaiseLettersPeriodFix?.fixNow) window.AdminOfficesRaiseLettersPeriodFix.fixNow(); fn(); } catch (err) { console.error('[RaiseLettersClean]', key, err); alert('تعذر تنفيذ ' + docLabel(key) + '\n' + (err.message || err)); } finally { setTimeout(() => { if (raw == null) localStorage.removeItem(SETTINGS_KEY); else localStorage.setItem(SETTINGS_KEY, raw); }, 2500); } }

  const actions = {
    fullExtract: () => withDocSettings('fullExtract', () => window.AdminOfficesExtraDocs?.generateFullExtractPrint ? window.AdminOfficesExtraDocs.generateFullExtractPrint() : missing('generateFullExtractPrint')),
    finalRaise: () => withDocSettings('finalRaise', () => window.AdminOfficesExtraDocs?.generateFinalFinancialRaiseLetter ? window.AdminOfficesExtraDocs.generateFinalFinancialRaiseLetter() : missing('generateFinalFinancialRaiseLetter')),
    noPrevious: () => withDocSettings('noPrevious', () => window.AdminOfficesRaiseLetters?.generateDeclaration ? window.AdminOfficesRaiseLetters.generateDeclaration() : missing('generateDeclaration')),
    laborRaise: () => withDocSettings('laborRaise', () => window.AdminOfficesRaiseLetters?.generateLaborRaiseLetter ? window.AdminOfficesRaiseLetters.generateLaborRaiseLetter() : missing('generateLaborRaiseLetter')),
    groupedCert: () => withDocSettings('groupedCert', () => window.AdminOfficesExtraDocs?.generateGroupedMonthlyEntitlementCertificate ? window.AdminOfficesExtraDocs.generateGroupedMonthlyEntitlementCertificate() : missing('generateGroupedMonthlyEntitlementCertificate')),
    entitlement: () => withDocSettings('entitlement', () => window.AdminOfficesExtraDocs?.generateEntitlementStatement ? window.AdminOfficesExtraDocs.generateEntitlementStatement() : missing('generateEntitlementStatement')),
    salary: () => withDocSettings('salary', () => window.AdminOfficesExtraDocs?.generateSalaryDeliveryCertificate ? window.AdminOfficesExtraDocs.generateSalaryDeliveryCertificate() : missing('generateSalaryDeliveryCertificate')),
    saudiJobs: () => withDocSettings('saudiJobs', () => window.AdminOfficesExtraDocs?.generateSaudiOccupiedJobsStatement ? window.AdminOfficesExtraDocs.generateSaudiOccupiedJobsStatement() : missing('generateSaudiOccupiedJobsStatement')),
    absence: () => withDocSettings('absence', () => window.AdminOfficesExtraDocs?.openEditableStatement ? window.AdminOfficesExtraDocs.openEditableStatement('absence') : missing('openEditableStatement')),
    vacation: () => withDocSettings('vacation', () => window.AdminOfficesExtraDocs?.openEditableStatement ? window.AdminOfficesExtraDocs.openEditableStatement('vacation') : missing('openEditableStatement')),
    performance: () => withDocSettings('performance', () => window.AdminOfficesExtraDocs?.generateMonthlyPerformanceCertificates ? window.AdminOfficesExtraDocs.generateMonthlyPerformanceCertificates() : missing('generateMonthlyPerformanceCertificates')),
    selectedSites: () => withDocSettings('selectedSites', () => window.AdminOfficesRaiseLetters?.generateSelectedSiteLetters ? window.AdminOfficesRaiseLetters.generateSelectedSiteLetters() : missing('generateSelectedSiteLetters')),
    oneSite: () => withDocSettings('oneSite', () => window.AdminOfficesRaiseLetters?.generateSiteRaiseLetter ? window.AdminOfficesRaiseLetters.generateSiteRaiseLetter() : missing('generateSiteRaiseLetter')),
    close: () => document.getElementById('admin-raise-clean')?.remove()
  };
  function missing(n) { throw new Error('الدالة غير موجودة: ' + n); }

  function renderGlobal() { const s = settings(); return `<section id="rl-settings" class="settings-panel ${UI.globalOpen ? 'open' : ''}"><h3>الإعدادات العامة لكل الخطابات</h3><div class="rl-note">هذه القيم يستخدمها كل خطاب ما لم تفعل إعداداً مستقلاً لهذا الخطاب.</div><div class="rl-grid">${fieldHtml('global', s)}${select('letterheadMode', 'طريقة الترويسة', 'global', s.letterheadMode, [['external', 'مطبوع خارجي — لا تطبع صورة وتُنزل المحتوى فقط'], ['full', 'صورة A4 كاملة كخلفية'], ['top', 'صورة ترويسة علوية فقط']])}${input('contentTopMm', 'نزول بداية الخطاب من أعلى الورقة — ملم', 'number', 'global', s.contentTopMm)}${input('blankLines', 'نزول إضافي بعدد السطور', 'number', 'global', s.blankLines)}${input('lineHeightMm', 'ارتفاع السطر بالملليمتر', 'number', 'global', s.lineHeightMm || LINE_MM)}${input('letterheadHeightMm', 'ارتفاع الترويسة العلوية — ملم', 'number', 'global', s.letterheadHeightMm)}${input('printScale', 'تكبير/تصغير الطباعة %', 'number', 'global', s.printScale)}</div><div class="rl-upload"><label><input type="checkbox" data-global-field="letterheadEnabled" ${s.letterheadEnabled ? 'checked' : ''}> تفعيل الترويسة</label><input type="file" id="rl-letterhead-file" accept="image/*"><button type="button" class="rl-btn" data-action="clearLetterhead">حذف الترويسة</button>${s.letterheadDataUrl ? '<span class="ok">ترويسة محفوظة</span>' : '<span class="warn">لا توجد ترويسة مرفوعة</span>'}</div><div class="rl-row">${button('saveGlobal', 'حفظ الإعدادات العامة', 'primary')}${button('exportSettings', 'تصدير الإعدادات', '')}<label class="rl-btn file-btn">استيراد الإعدادات<input type="file" id="rl-import-file" accept="application/json,.json" hidden></label>${button('resetAll', 'إعادة ضبط المصنع', 'danger')}</div></section>`; }
  function renderDocSettings() { const s = settings(), key = s.selectedDocKey || 'finalRaise', d = docSettings(key); return `<section id="rl-doc-settings" class="settings-panel doc-panel ${UI.docOpen ? 'open' : ''}"><h3>إعداد مستقل لكل خطاب</h3><div class="rl-note">اختر الخطاب، فعّل الإعداد المستقل، ثم عدّل المخاطب والنص والتوقيع ونزول الورقة لهذا الخطاب وحده.</div><div class="rl-doc-top"><label class="rl-field"><span>اختر الخطاب</span><select id="rl-doc-select">${DOCS.map(x => `<option value="${esc(x.key)}" ${x.key === key ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select></label><label class="switch"><input type="checkbox" id="rl-doc-enabled" ${d.enabled ? 'checked' : ''}> تفعيل إعداد مستقل لهذا الخطاب</label><label class="switch"><input type="checkbox" id="rl-doc-use-global-letterhead" ${d.useGlobalLetterhead !== false ? 'checked' : ''}> استخدام ترويسة الإعداد العام</label></div><div class="rl-grid">${fieldHtml('doc', d)}${select('letterheadMode', 'طريقة ترويسة هذا الخطاب', 'doc', d.letterheadMode || 'external', [['external', 'مطبوع خارجي — نزول فقط'], ['full', 'صورة A4 كاملة'], ['top', 'صورة علوية فقط']])}${input('contentTopMm', 'نزول هذا الخطاب من أعلى الورقة — ملم', 'number', 'doc', d.contentTopMm || '')}${input('blankLines', 'نزول إضافي لهذا الخطاب بعدد السطور', 'number', 'doc', d.blankLines || '')}${input('lineHeightMm', 'ارتفاع السطر لهذا الخطاب — ملم', 'number', 'doc', d.lineHeightMm || '')}${input('letterheadHeightMm', 'ارتفاع الترويسة العلوية لهذا الخطاب — ملم', 'number', 'doc', d.letterheadHeightMm || '')}${input('printScale', 'تكبير/تصغير هذا الخطاب %', 'number', 'doc', d.printScale || '')}</div><div class="rl-row">${button('saveDoc', 'حفظ إعداد هذا الخطاب', 'primary')}${button('copyGlobalToDoc', 'نسخ العام لهذا الخطاب', '')}${button('clearDoc', 'تفريغ هذا الخطاب', 'danger')}${button(key, 'تجربة طباعة هذا الخطاب', 'site')}</div><div class="rl-row copy-row"><label class="rl-field copy-select"><span>نسخ إعداد هذا الخطاب إلى</span><select id="rl-copy-to-doc">${DOCS.map(x => `<option value="${esc(x.key)}" ${x.key === key ? 'disabled' : ''}>${esc(x.label)}</option>`).join('')}</select></label>${button('copyDocToDoc', 'نسخ خطاب إلى خطاب آخر', '')}</div></section>`; }
  function renderSites() { const s = settings(), names = getNames(), keys = officeKeys(), selected = s.siteLetterDefaultCenter || keys[0] || ''; return `<div class="rl-site-top"><label class="rl-field"><span>الموقع المحدد لخطاب واحد</span><select id="rl-site-select"><option value="">اختر الموقع</option>${keys.map(k => `<option value="${esc(k)}" ${k === selected ? 'selected' : ''}>${esc(names[k] || k)}</option>`).join('')}</select></label><div class="rl-phrase">${extractPhrase()}</div></div><div class="rl-sites">${keys.map(k => `<label class="rl-site"><input type="checkbox" class="rl-site-check" value="${esc(k)}" checked><span>${esc(names[k] || k)}</span></label>`).join('') || '<b>لا توجد مواقع محفوظة.</b>'}</div>`; }
  function docButtons(group, cls) { return DOCS.filter(d => d.group === group).map(d => `<div class="rl-doc-card"><div><b>${esc(d.label)}</b><small>${docSettings(d.key).enabled ? 'إعداد مستقل مفعل' : 'يستخدم الإعداد العام'}</small></div><div>${button(d.key, 'طباعة', cls, d.key)}${button('openDocSettings', 'إعدادات', '', d.key)}</div></div>`).join(''); }
  function ensureCss() { if (document.getElementById('admin-raise-clean-css')) return; const st = document.createElement('style'); st.id = 'admin-raise-clean-css'; st.textContent = `#admin-raise-clean{position:fixed;inset:0;z-index:2147483000;background:#eef3f9;overflow:auto;padding:18px;font-family:Tajawal,Arial,sans-serif;color:#0f172a;direction:rtl}#admin-raise-clean *{box-sizing:border-box}#admin-raise-clean .box{width:min(1340px,97vw);margin:0 auto;background:#fff;border-radius:22px;padding:18px;box-shadow:0 18px 55px rgba(15,23,42,.18)}.head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;border-bottom:1px solid #e2e8f0;padding-bottom:14px;margin-bottom:12px}h2{margin:0 0 6px;color:#003087;font-size:22px;font-weight:950}h3{margin:0 0 8px;font-size:17px}.rl-note,p,small{color:#64748b;font-weight:800;line-height:1.7}.rl-group{border:1px solid #dbe4f0;border-radius:18px;padding:14px;margin:12px 0;background:#fff}.extract{border-top:4px solid #003087}.cert{border-top:4px solid #0f766e}.sites-box{border-top:4px solid #d4af37;background:#fffdf3}.manage{border-top:4px solid #64748b}.rl-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.rl-btn{border:1px solid #cbd5e1;border-radius:10px;padding:9px 13px;font-weight:950;cursor:pointer;background:#f1f5f9;color:#0f172a;font-family:inherit;margin:2px;text-decoration:none;display:inline-block}.rl-btn.primary{background:#003087;color:#fff;border-color:#003087}.rl-btn.cert{background:#ecfdf5;color:#065f46;border-color:#a7f3d0}.rl-btn.site{background:#fff7d6;color:#7a4f00;border-color:#f3d675}.rl-btn.danger{background:#fee2e2;color:#991b1b;border-color:#fecaca}.settings-panel{display:none;border:2px solid #0f766e;background:#f0fdfa;border-radius:18px;padding:14px;margin:12px 0}.settings-panel.open{display:block}.rl-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.rl-field{display:block;background:#fff;border:1px solid #dbe4f0;border-radius:12px;padding:10px}.rl-field span{display:block;font-size:12px;font-weight:950;color:#334155;margin-bottom:6px}.rl-field input,.rl-field select,.rl-field textarea{width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:9px;font-family:inherit;font-weight:800}.rl-field.wide{grid-column:1/-1}.rl-field textarea{min-height:76px}.rl-upload,.rl-doc-top{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:12px 0}.ok{color:#166534;font-weight:950}.warn{color:#92400e;font-weight:950}.switch{font-weight:950;background:#fff;border:1px solid #dbe4f0;border-radius:12px;padding:12px}.rl-doc-card{display:flex;justify-content:space-between;gap:10px;align-items:center;border:1px solid #e2e8f0;background:#fff;border-radius:12px;padding:10px;margin:8px 0}.rl-doc-card b{display:block}.copy-select{min-width:300px}.file-btn{position:relative;overflow:hidden}.rl-site-top{display:grid;grid-template-columns:minmax(260px,380px) 1fr;gap:12px}.rl-phrase{padding:12px;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;font-weight:950;color:#7a4f00}.rl-sites{max-height:260px;overflow:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px;margin-top:10px}.rl-site{display:flex;gap:8px;align-items:center;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px;font-weight:900}#rl-clean-flash{display:none;margin:0 0 10px;padding:10px;border-radius:12px;background:#ecfdf5;color:#166534;border:1px solid #bbf7d0;text-align:center;font-weight:950}#rl-clean-flash.show{display:block}@media(max-width:820px){.head,.rl-site-top{display:block}.rl-doc-card{display:block}}@media print{#admin-raise-clean{position:static;padding:0;background:#fff}.rl-btn,.settings-panel{display:none!important}.box{box-shadow:none!important;width:auto!important}}`; document.head.appendChild(st); }
  function render() { document.getElementById('admin-raise-clean')?.remove(); const html = `<div id="admin-raise-clean"><div class="box"><div class="head"><div><h2>خطابات رفع عمالة المكاتب الإدارية</h2><h3>مركز خطابات المستخلص</h3><p>نسخة نظيفة مكتملة: إعداد عام + إعداد مستقل لكل خطاب + ترويسة A4 + نزول المحتوى + توافق إعدادات الخطابات القديمة.</p></div>${button('close', 'إغلاق', '')}</div><div id="rl-clean-flash"></div><div class="rl-row">${button('toggleGlobal', 'الإعدادات العامة والترويسة', 'primary')}${button('toggleDoc', 'إعداد مستقل لكل خطاب', '')}${button('saveGlobal', 'حفظ سريع', '')}</div>${renderGlobal()}${renderDocSettings()}<section class="rl-group extract"><h3>١. مستندات المستخلص</h3>${docButtons('extract', 'primary')}</section><section class="rl-group cert"><h3>٢. الشهادات والبيانات العامة</h3>${docButtons('cert', 'cert')}</section><section class="rl-group sites-box"><h3>٣. خطابات ومرفقات المواقع</h3>${renderSites()}${docButtons('site', 'site')}</section><section class="rl-group manage"><h3>٤. إدارة</h3><small>إغلاق نافذة الخطابات فقط.</small><div class="rl-row">${button('close', 'إغلاق التبويب', '')}</div></section></div></div>`; document.body.insertAdjacentHTML('beforeend', html); ensureCss(); }

  document.addEventListener('click', function (e) { const root = document.getElementById('admin-raise-clean'), b = e.target.closest && e.target.closest('#admin-raise-clean [data-action]'); if (!root || !b) return; e.preventDefault(); const a = b.dataset.action, k = b.dataset.docKey; if (k) { const s = settings(); s.selectedDocKey = k; saveAll(s); } if (a === 'toggleGlobal') { UI.globalOpen = !UI.globalOpen; return render(); } if (a === 'toggleDoc') { UI.docOpen = !UI.docOpen; return render(); } if (a === 'openDocSettings') { UI.docOpen = true; return render(); } if (a === 'saveGlobal') return saveGlobalFromUI(); if (a === 'saveDoc') return saveDocFromUI(); if (a === 'copyGlobalToDoc') return copyGlobalToDoc(); if (a === 'clearDoc') return clearDoc(); if (a === 'copyDocToDoc') return copyDocToDoc(); if (a === 'exportSettings') return exportSettings(); if (a === 'resetAll') return resetAllSettings(); if (a === 'clearLetterhead') { const s = settings(); s.letterheadDataUrl = ''; s.letterheadEnabled = false; saveAll(s); UI.globalOpen = true; flash('تم حذف الترويسة.'); return render(); } if (actions[a]) return actions[a](); }, true);
  document.addEventListener('change', function (e) { if (e.target && e.target.id === 'rl-letterhead-file') return uploadLetterhead(e.target.files && e.target.files[0]); if (e.target && e.target.id === 'rl-import-file') return importSettings(e.target.files && e.target.files[0]); if (e.target && e.target.id === 'rl-doc-select') { const s = settings(); s.selectedDocKey = e.target.value; saveAll(s); UI.docOpen = true; return render(); } if (e.target && e.target.id === 'rl-site-select') { const s = settings(); s.siteLetterDefaultCenter = e.target.value || ''; saveAll(s); } }, true);

  window.AdminOfficesRaiseLettersCleanV1 = { render, settings, effective, meta, extractPhrase, exportSettings };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render); else render();
  setTimeout(render, 700);
  console.info('[Admin Offices Raise Letters Clean V1] installed complete legacy parity fields');
})();