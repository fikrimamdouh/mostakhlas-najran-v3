// ===================================================================
// Hospital Raise Letters Clean V1
// Test URL only: attendance.html?hospitalLettersClean=1#hospital-letters-clean
// Standalone test screen. No official button binding.
// Rule:
// - Letters use the clean configurable letter engine.
// - Attendance, Performance, and Achievement use native original print only.
// ===================================================================
(function () {
  'use strict';

  var qs = new URLSearchParams(location.search || '');
  if (qs.get('hospitalLettersClean') !== '1') return;
  if (!/attendance\.html(?:$|[?#])|original-viewer\?page=attendance\.html/.test(location.pathname + location.search)) return;
  if (/admin_offices_attendance\.html/.test(location.pathname + location.search)) return;
  if (window.__HOSPITAL_RAISE_LETTERS_CLEAN_V1__) return;
  window.__HOSPITAL_RAISE_LETTERS_CLEAN_V1__ = true;

  var SETTINGS_KEY = 'hospitalRaiseLettersSettings_v1';
  var LINE_MM = 6;
  var DEFAULT_PRINT_SCALE = 72;
  var UI = { settingsOpen: false, docOpen: false };

  var NATIVE_DOCS = {
    attendance: true,
    performanceTable: true,
    performanceCert: true,
    achievement: true
  };

  var NATIVE_URLS = {
    performanceTable: '/original/performance.html?nativePrint=1',
    performanceCert: '/original/performance.html?nativePrint=1',
    achievement: '/original/achievement.html?nativePrint=1'
  };

  var DOCS = [
    { key: 'fullExtract', label: 'طباعة المستخلص كامل', group: 'extract' },
    { key: 'index', label: 'فهرس مستندات المستخلص', group: 'extract' },
    { key: 'finalRaise', label: 'خطاب الرفع النهائي', group: 'extract' },
    { key: 'laborRaise', label: 'خطاب الرفع للمستخلص', group: 'extract' },
    { key: 'noPrevious', label: 'إقرار عدم أسبقية الصرف', group: 'extract' },
    { key: 'attendance', label: 'جدول الحضور والانصراف — من الطباعة الأصلية', group: 'ops' },
    { key: 'performanceTable', label: 'جدول تقييم الأداء — من الطباعة الأصلية', group: 'ops' },
    { key: 'performanceCert', label: 'شهادة الأداء — من الطباعة الأصلية', group: 'ops' },
    { key: 'achievement', label: 'شهادة الإنجاز — من الطباعة الأصلية', group: 'ops' },
    { key: 'vacations', label: 'بيان الإجازات', group: 'attach' },
    { key: 'vacancies', label: 'بيان الشواغر', group: 'attach' },
    { key: 'salary', label: 'شهادة تسليم الرواتب', group: 'attach' },
    { key: 'entitlement', label: 'بيان استحقاق', group: 'attach' },
    { key: 'customLetter', label: 'خطاب مخصص / صفحة فاضية', group: 'attach' }
  ];

  var DOC_LABEL = DOCS.reduce(function (m, d) { m[d.key] = d.label; return m; }, {});
  var FULL_ORDER = ['index','finalRaise','laborRaise','noPrevious','vacations','vacancies','salary','entitlement','customLetter'];

  var TEXT_FIELDS = [
    ['hospitalName', 'اسم المستشفى'], ['companyName', 'اسم الشركة / المقاول'], ['contractName', 'اسم العقد'], ['contractNo', 'رقم العقد'],
    ['recipient', 'المخاطب / الجهة'], ['recipientSuffix', 'صفة المخاطب'], ['entityTitle', 'العنوان الرئيسي'], ['departmentTitle', 'الإدارة / القسم'], ['scopeName', 'نطاق الخطاب'],
    ['phoneFaxAr', 'الهاتف والفاكس عربي'], ['phoneFaxEn', 'الهاتف والفاكس إنجليزي'],
    ['managerTitle', 'صفة توقيع الخطاب'], ['managerName', 'اسم توقيع الخطاب'], ['unitManagerTitle', 'صفة توقيع الإقرار'], ['unitManagerName', 'اسم توقيع الإقرار'],
    ['finalLetterHeaderLine1', 'خطاب الرفع النهائي — سطر الترويسة ١'], ['finalLetterHeaderLine2', 'خطاب الرفع النهائي — سطر الترويسة ٢'], ['finalLetterHeaderLine3', 'خطاب الرفع النهائي — سطر الترويسة ٣'],
    ['finalLetterSubject', 'خطاب الرفع النهائي — الموضوع'], ['finalLetterTo', 'خطاب الرفع النهائي — الموجه إليه'], ['finalLetterToSuffix', 'خطاب الرفع النهائي — صفة الموجه إليه'],
    ['finalLetterGreeting', 'خطاب الرفع النهائي — التحية'], ['finalLetterRegards', 'خطاب الرفع النهائي — التقدير'], ['finalLetterSignatureTitle', 'خطاب الرفع النهائي — صفة التوقيع'], ['finalLetterSignatureName', 'خطاب الرفع النهائي — اسم المسؤول'], ['finalLetterIban', 'الآيبان'],
    ['customLetterTitle', 'الخطاب المخصص — العنوان']
  ];
  var AREA_FIELDS = [
    ['finalLetterOpening', 'افتتاح خطاب الرفع النهائي'], ['finalLetterClosing', 'ختام خطاب الرفع النهائي'], ['customIntro', 'نص افتتاح خاص'], ['customClosing', 'نص ختام خاص'],
    ['customLetterBody', 'الخطاب المخصص — نص الخطاب']
  ];
  var NUM_FIELDS = [
    ['vatRate', 'نسبة الضريبة'], ['declarationManualAmount', 'مبلغ الإقرار اليدوي'], ['contentTopMm', 'نزول بداية الطباعة من أعلى الورقة — ملم'], ['blankLines', 'نزول إضافي بعدد السطور'], ['lineHeightMm', 'ارتفاع السطر بالملليمتر'], ['letterheadHeightMm', 'ارتفاع الترويسة العلوية — ملم'], ['printScale', 'تكبير/تصغير طباعة الخطابات %']
  ];
  var DATE_FIELDS = [ ['declarationDate', 'تاريخ الإقرار'] ];
  var SELECT_FIELDS = [ ['declarationAmountMode', 'طريقة مبلغ الإقرار', [['laborGrandTotal', 'تلقائي من إجمالي مستحقات العمالة'], ['manual', 'مبلغ يدوي']]] ];
  var INDEX_NUM_FIELDS = [
    ['indexStartPage', 'رقم بداية ترقيم الفهرس'], ['pageCountFinalRaise', 'صفحات خطاب الرفع النهائي'], ['pageCountLaborRaise', 'صفحات خطاب الرفع للمستخلص'], ['pageCountNoPrevious', 'صفحات الإقرار'],
    ['pageCountAttendance', 'صفحات الحضور والانصراف'], ['pageCountPerformanceTable', 'صفحات تقييم الأداء'], ['pageCountPerformanceCert', 'صفحات شهادة الأداء'], ['pageCountAchievement', 'صفحات شهادة الإنجاز'],
    ['pageCountVacations', 'صفحات الإجازات'], ['pageCountVacancies', 'صفحات الشواغر'], ['pageCountSalary', 'صفحات تسليم الرواتب'], ['pageCountEntitlement', 'صفحات بيان الاستحقاق'],
    ['pageCountCustomLetter', 'صفحات الخطاب المخصص'], ['companyPapersPageCount', 'عدد صفحات أوراق الشركة الثابتة']
  ];

  function readJson(key, fallback) { try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; } }
  function writeJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value || {})); return true; } catch (_) { alert('تعذر الحفظ. صغّر صورة الترويسة أو صدّر الإعدادات.'); return false; } }
  function parseObj(raw) { if (!raw) return {}; if (typeof raw === 'object') return raw; try { return JSON.parse(String(raw)); } catch (_) { return {}; } }
  function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function clean(v) { return String(v == null ? '' : v).replace(/[\u200e\u200f]/g, '').replace(/\s+/g, ' ').trim(); }
  function first() { for (var i = 0; i < arguments.length; i++) { var v = clean(arguments[i]); if (v && !['غير محدد', 'undefined', 'null', '—', '-'].includes(v)) return v; } return ''; }
  function n(v, fb) { var x = Number(v); return Number.isFinite(x) ? x : (fb || 0); }
  function normDigits(v) { var ar = '٠١٢٣٤٥٦٧٨٩', fa = '۰۱۲۳۴۵۶۷۸۹'; return clean(v).replace(/[٠-٩]/g, function (d) { return ar.indexOf(d); }).replace(/[۰-۹]/g, function (d) { return fa.indexOf(d); }); }
  function payNo(v) { var s = normDigits(v); return /^0*\d+$/.test(s) ? String(Number(s)) : (s || '—'); }
  function iso(v) { var s = normDigits(v); if (!s) return ''; if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; var m = s.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/); if (m) return m[1] + '-' + String(m[2]).padStart(2,'0') + '-' + String(m[3]).padStart(2,'0'); m = s.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/); if (m) return m[3] + '-' + String(m[2]).padStart(2,'0') + '-' + String(m[1]).padStart(2,'0'); var d = new Date(s); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-CA'); }
  function textOf(sel) { try { var el = document.querySelector(sel); return el ? first(el.textContent, el.value, el.getAttribute('content')) : ''; } catch (_) { return ''; } }
  function todayIso() { return new Date().toLocaleDateString('en-CA'); }

  function snapshot() { var snap = readJson('najran_revision_snapshot', {}); return Object.assign({}, parseObj(snap.persistentContractData), parseObj(snap.contractData), parseObj(snap.persistentExtractData), parseObj(snap.extractData)); }
  function session() { return readJson('najran_session', {}); }
  function contractData() {
    var c = readJson('persistentContractData', {}), r = snapshot(), s = session();
    return {
      hospitalName: first(localStorage.getItem('hospitalName'), localStorage.getItem('currentHospital'), localStorage.getItem('selectedHospital'), textOf('[data-hospital-name]'), textOf('.hospital-name'), c.hospitalName, c.siteName, c.facilityName, s.hospitalName, s.hospital, r.hospitalName, r.siteName, 'المستشفى'),
      companyName: first(c.companyName, c.contractorName, textOf('[data-company-name]'), textOf('.company-name'), localStorage.getItem('companyName'), s.companyName, r.companyName, r.contractorName, 'الشركة'),
      contractName: first(c.contractDetails, c.contractName, c.scopeName, textOf('[data-contract-name]'), localStorage.getItem('contractName'), r.contractDetails, r.contractName, r.scopeName, 'عقد الصيانة والنظافة والتشغيل غير الطبي'),
      contractNo: first(c.contractNumber, c.contractNo, textOf('[data-contract-number]'), localStorage.getItem('contractNumber'), r.contractNumber, r.contractNo, '')
    };
  }
  function extractMeta() {
    var e = readJson('persistentExtractData', {}), r = snapshot(), p = {};
    try { if (typeof window.getExtractPeriodDetails === 'function') p = window.getExtractPeriodDetails() || {}; } catch (_) {}
    var start = iso(first(p.startDate, p.extractStart, p.periodStart, textOf('[data-extract-start]'), textOf('#extract-start-date'), e.extractStart, e.periodStart, e.startDate, r.extractStart, r.periodStart, localStorage.getItem('extractStart'), localStorage.getItem('periodStart'), localStorage.getItem('startDate')));
    var end = iso(first(p.endDate, p.extractEnd, p.periodEnd, textOf('[data-extract-end]'), textOf('#extract-end-date'), e.extractEnd, e.periodEnd, e.endDate, r.extractEnd, r.periodEnd, localStorage.getItem('extractEnd'), localStorage.getItem('periodEnd'), localStorage.getItem('endDate')));
    var payment = payNo(first(p.paymentNo, p.paymentNumber, textOf('[data-payment-no]'), textOf('#payment-number'), e.paymentNumber, e.extractNumber, e.paymentNo, r.paymentNumber, r.extractNumber, localStorage.getItem('paymentNumber'), localStorage.getItem('extractNumber'), localStorage.getItem('paymentNo')) || '—');
    try {
      if (start) { e.extractStart = start; localStorage.setItem('extractStart', start); localStorage.setItem('periodStart', start); localStorage.setItem('startDate', start); }
      if (end) { e.extractEnd = end; localStorage.setItem('extractEnd', end); localStorage.setItem('periodEnd', end); localStorage.setItem('endDate', end); }
      if (payment && payment !== '—') { e.paymentNumber = payment; localStorage.setItem('paymentNumber', payment); localStorage.setItem('extractNumber', payment); localStorage.setItem('paymentNo', payment); }
      localStorage.setItem('persistentExtractData', JSON.stringify(e));
    } catch (_) {}
    return { start: start, end: end, paymentNo: payment };
  }

  function defaults() {
    var c = contractData();
    var scope = c.hospitalName && c.hospitalName !== 'المستشفى' ? c.hospitalName : 'المستشفى';
    return {
      hospitalName: c.hospitalName, companyName: c.companyName, contractName: c.contractName, contractNo: c.contractNo,
      recipient: 'سعادة / مدير الإدارة المالية', recipientSuffix: 'المحترم', entityTitle: 'المديرية العامة للشئون الصحية بمنطقة نجران', departmentTitle: 'إدارة الشئون الهندسية', scopeName: scope,
      phoneFaxAr: 'نجران – تليفون 0175225872    فاكس 017523312', phoneFaxEn: 'Najran – Tel.: 0175225872       Fax: 017523312',
      managerTitle: '................................', managerName: '................................', unitManagerTitle: '................................', unitManagerName: '................................',
      declarationDate: todayIso(), declarationAmountMode: 'laborGrandTotal', declarationManualAmount: 0,
      finalLetterHeaderLine1: 'وزارة الصحة', finalLetterHeaderLine2: 'فرع وزارة الصحة بمنطقة نجران', finalLetterHeaderLine3: 'الإدارة المساعدة للدعم المساند', finalLetterSubject: '',
      finalLetterTo: 'المكرم / مدير الإدارة المالية', finalLetterToSuffix: 'المحترم', finalLetterGreeting: 'السلام عليكم ورحمة الله وبركاته',
      finalLetterOpening: 'نرفق طيه المستخلص النهائي لأعمال الصيانة والنظافة والتشغيل غير الطبي لـ {scopeName} حسب البيانات التالية:',
      finalLetterClosing: 'نأمل التكرم بالاطلاع وتوجيه الجهة المختصة نحو صرف استحقاق المقاول حسب النظام.', finalLetterRegards: 'مع أطيب تحياتي وتقديري،،',
      finalLetterSignatureTitle: 'مساعد المدير العام للدعم المساند', finalLetterSignatureName: '', finalLetterIban: '',
      vatRate: 15, customIntro: '', customClosing: '', customLetterTitle: 'خطاب مخصص', customLetterBody: '', customLetterMode: 'preprinted', customLetterShowSignature: 'yes', includeCustomLetterInFull: 'no',
      letterheadEnabled: false, letterheadMode: 'external', letterheadDataUrl: '', letterheadHeightMm: 45, contentTopMm: 0, blankLines: 0, lineHeightMm: LINE_MM, printScale: DEFAULT_PRINT_SCALE,
      indexEnabled: 'yes', indexTitle: 'فهرس مستندات المستخلص', indexStartPage: 1, includeCompanyPapersInIndex: 'yes', companyPapersTitle: 'أوراق الشركة الثابتة', companyPapersPageCount: 0,
      pageCountFinalRaise: 1, pageCountLaborRaise: 1, pageCountNoPrevious: 1, pageCountAttendance: 3, pageCountPerformanceTable: 2, pageCountPerformanceCert: 1, pageCountAchievement: 1, pageCountVacations: 1, pageCountVacancies: 1, pageCountSalary: 1, pageCountEntitlement: 1, pageCountCustomLetter: 1,
      selectedDocKey: 'finalRaise', documentSettings: {}
    };
  }
  function settings() { var st = readJson(SETTINGS_KEY, {}), d = defaults(), out = Object.assign(d, st); if (!st.hospitalName || st.hospitalName === 'المستشفى') out.hospitalName = d.hospitalName; if (!st.companyName || st.companyName === 'الشركة') out.companyName = d.companyName; if (!st.contractName) out.contractName = d.contractName; if (!st.contractNo) out.contractNo = d.contractNo; if (!st.scopeName || st.scopeName === 'المستشفى') out.scopeName = d.scopeName; out.documentSettings = Object.assign({}, st.documentSettings || {}); if (!out.printScale) out.printScale = DEFAULT_PRINT_SCALE; return out; }
  function saveSettings(s) { return writeJson(SETTINGS_KEY, Object.assign(defaults(), s || {})); }
  function docSettings(key) { var s = settings(); return Object.assign({ enabled: false, useGlobalLetterhead: true }, (s.documentSettings || {})[key] || {}); }
  function effective(key) { var s = settings(), d = docSettings(key); if (NATIVE_DOCS[key] || !d.enabled) return s; var out = Object.assign({}, s); Object.keys(d).forEach(function (k) { if (['enabled','useGlobalLetterhead'].indexOf(k) >= 0) return; if (d[k] !== '' && d[k] != null) out[k] = d[k]; }); if (d.useGlobalLetterhead !== false) ['letterheadEnabled','letterheadMode','letterheadDataUrl','letterheadHeightMm','contentTopMm','blankLines','lineHeightMm','printScale'].forEach(function(k){ out[k]=s[k]; }); if (!out.printScale) out.printScale = DEFAULT_PRINT_SCALE; return out; }

  function rawAttendance() { var list = []; try { if (typeof window.getAttendanceData === 'function') list.push(window.getAttendanceData() || {}); } catch (_) {} ['attendanceData','ng_attendanceData','nd_attendanceData','healthCentersAttendanceData'].forEach(function(k){ list.push(readJson(k, {})); }); function count(o) { if (!o) return 0; if (Array.isArray(o)) return o.length; return Object.keys(o).reduce(function(s,k){ return s + (Array.isArray(o[k]) ? o[k].length : 0); }, 0); } return list.reduce(function(best, item){ return count(item) > count(best) ? item : best; }, {}); }
  function groups() { var data = rawAttendance(), out = []; if (Array.isArray(data)) out.push({ name: 'عمالة المستشفى', rows: data }); else Object.keys(data || {}).forEach(function(k){ if (Array.isArray(data[k]) && data[k].length) out.push({ name: k, rows: data[k] }); }); if (!out.length) out.push({ name: 'عمالة المستشفى', rows: [] }); return out; }
  function employees() { var a = []; groups().forEach(function(g){ (g.rows || []).forEach(function(e){ if (e && (clean(e.name) || clean(e.jobTitle) || clean(e.position))) a.push(e); }); }); return a; }
  function days(e) { return Array.isArray(e.days) ? e.days : (Array.isArray(e.attendance) ? e.attendance : []); }
  function salary(e) { return n(e.salary || e.monthlySalary || e.basicSalary || e.cost || 0); }
  function money(v) { return n(v).toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function totalSalary() { return employees().reduce(function(s,e){ return s + salary(e); }, 0); }
  function vacationRows() { return employees().filter(function(e){ return days(e).indexOf('ج') >= 0 || days(e).indexOf('إ') >= 0; }); }
  function vacancyRows() { return employees().filter(function(e){ return clean(e.name) === '' || clean(e.name) === 'شاغر' || clean(e.status) === 'شاغر' || days(e).indexOf('ش') >= 0; }); }

  function replaceVars(txt, eff) { var m = extractMeta(); return String(txt || '').replace(/\{hospitalName\}/g, eff.hospitalName || '').replace(/\{companyName\}/g, eff.companyName || '').replace(/\{contractName\}/g, eff.contractName || '').replace(/\{contractNo\}/g, eff.contractNo || '').replace(/\{scopeName\}/g, eff.scopeName || eff.hospitalName || '').replace(/\{start\}/g, m.start || '').replace(/\{end\}/g, m.end || '').replace(/\{paymentNo\}/g, m.paymentNo || ''); }
  function htmlText(txt, eff) { return esc(replaceVars(txt || '', eff)).replace(/\r?\n/g, '<br>'); }
  function topOffset(eff) { return n(eff.contentTopMm) + n(eff.blankLines) * n(eff.lineHeightMm, LINE_MM); }

  function printCss(eff) {
    var top = topOffset(eff), scale = Math.max(60, Math.min(130, n(eff.printScale, DEFAULT_PRINT_SCALE))), img = eff.letterheadEnabled && eff.letterheadDataUrl ? String(eff.letterheadDataUrl) : '', mode = eff.letterheadMode || 'external', h = n(eff.letterheadHeightMm, 45), before = '';
    if (img && mode === 'full') before = 'body:before{content:"";position:fixed;inset:0;background:url("' + img + '") top center/210mm 297mm no-repeat!important;z-index:-1;pointer-events:none}';
    if (img && mode === 'top') before = 'body:before{content:"";position:fixed;top:0;left:0;right:0;height:' + h + 'mm;background:url("' + img + '") top center/100% ' + h + 'mm no-repeat!important;z-index:999999;pointer-events:none}';
    return '<style>@page{size:A4 portrait;margin:8mm}body{font-family:Tajawal,Arial,sans-serif;direction:rtl;color:#111827;padding-top:' + top + 'mm;zoom:' + scale + '%;-webkit-print-color-adjust:exact;print-color-adjust:exact}' + before + '.page{break-after:page;page-break-after:always;min-height:260mm}.official-top{display:grid;grid-template-columns:1fr 90px 1fr;align-items:start;gap:8px;margin-bottom:8px}.official-lines{text-align:right;line-height:1.55;font-weight:900;color:#0f172a}.official-lines.left{text-align:left;direction:ltr}.logo-box{height:45px;border:1px solid #cbd5e1;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:10px;margin:auto}.head{text-align:center;border-bottom:2px solid #003087;padding-bottom:8px;margin-bottom:12px}.head h1{margin:0;color:#003087;font-size:19px}.head h2{margin:5px 0 0;font-size:15px}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:10px 0}.meta div{border:1px solid #cbd5e1;border-radius:7px;background:#f8fafc;padding:7px;font-size:12px}.letter{font-size:15px;line-height:2.1}.sign{margin-top:36px;text-align:left;font-weight:800}.tbl{width:100%;border-collapse:collapse;margin-top:8px}.tbl th,.tbl td{border:1px solid #94a3b8;padding:5px;text-align:center;font-size:10px}.tbl th{background:#eaf1fb;color:#003087;font-weight:900}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}.summary div{background:#eef6ff;border:1px solid #bfdbfe;border-radius:10px;padding:10px;text-align:center;font-weight:900}.index-table{width:100%;border-collapse:collapse;margin-top:12px}.index-table th,.index-table td{border:1px solid #334155;padding:8px;text-align:center;font-size:12px}.index-table th{background:#e9eef6}.custom-letter-body{min-height:160mm}.subject-line{font-weight:900;text-align:center;margin:14px 0}.iban-line{direction:ltr;text-align:center;font-weight:900;border:1px solid #cbd5e1;border-radius:8px;padding:8px;margin:12px auto;max-width:520px}@media print{button,.no-print{display:none!important}}</style>';
  }
  function officialTop(eff) { return '<div class="official-top"><div class="official-lines"><div>' + esc(eff.finalLetterHeaderLine1 || 'وزارة الصحة') + '</div><div>' + esc(eff.finalLetterHeaderLine2 || '') + '</div><div>' + esc(eff.finalLetterHeaderLine3 || eff.departmentTitle || '') + '</div></div><div class="logo-box">الشعار</div><div class="official-lines left"><div>' + esc(eff.phoneFaxEn || '') + '</div><div>' + esc(eff.phoneFaxAr || '') + '</div></div></div>'; }
  function header(title, eff) { var m = extractMeta(); return officialTop(eff) + '<div class="head"><h1>' + esc(title) + '</h1><h2>' + esc(eff.hospitalName || '') + '</h2></div><div class="meta"><div>دفعة رقم: <b>' + esc(m.paymentNo) + '</b></div><div>من: <b>' + esc(m.start || 'غير محدد') + '</b></div><div>إلى: <b>' + esc(m.end || 'غير محدد') + '</b></div><div>الشركة: <b>' + esc(eff.companyName || '—') + '</b></div><div>رقم العقد: <b>' + esc(eff.contractNo || '—') + '</b></div><div>النطاق: <b>' + esc(eff.scopeName || eff.hospitalName || '—') + '</b></div></div>'; }
  function finalRaisePage(eff) { var m = extractMeta(), subject = eff.finalLetterSubject || ('بشأن رفع المستخلص النهائي دفعة رقم (' + (m.paymentNo || '—') + ')'); return '<section class="page">' + officialTop(eff) + '<div class="letter"><p>' + esc(eff.finalLetterTo || eff.recipient || '') + ' ' + esc(eff.finalLetterToSuffix || eff.recipientSuffix || '') + '</p><p>' + esc(eff.finalLetterGreeting || 'السلام عليكم ورحمة الله وبركاته') + '، وبعد،،</p><div class="subject-line">الموضوع: ' + esc(subject) + '</div><p>' + htmlText(eff.finalLetterOpening, eff) + '</p><table class="tbl"><tbody><tr><th>النطاق</th><td>' + esc(eff.scopeName || eff.hospitalName || '') + '</td></tr><tr><th>اسم الشركة</th><td>' + esc(eff.companyName || '') + '</td></tr><tr><th>رقم العقد</th><td>' + esc(eff.contractNo || '') + '</td></tr><tr><th>الفترة</th><td>من ' + esc(m.start || 'غير محدد') + ' إلى ' + esc(m.end || 'غير محدد') + '</td></tr><tr><th>رقم الدفعة</th><td>' + esc(m.paymentNo || '—') + '</td></tr></tbody></table>' + (eff.finalLetterIban ? '<div class="iban-line">IBAN: ' + esc(eff.finalLetterIban) + '</div>' : '') + '<p>' + htmlText(eff.finalLetterClosing, eff) + '</p><p>' + esc(eff.finalLetterRegards || 'مع أطيب تحياتي وتقديري،،') + '</p><div class="sign">' + esc(eff.finalLetterSignatureTitle || eff.managerTitle || '') + '<br><br>' + esc(eff.finalLetterSignatureName || eff.managerName || '') + '</div></div></section>'; }
  function letterPage(title, body, eff) { return '<section class="page">' + header(title, eff) + '<div class="letter"><p>' + esc(eff.recipient || '') + ' ' + esc(eff.recipientSuffix || '') + '</p><p><b>الموضوع: ' + esc(title) + '</b></p><p>' + (eff.customIntro ? htmlText(eff.customIntro, eff) + '</p><p>' : '') + htmlText(body, eff) + '</p><p>' + (eff.customClosing ? htmlText(eff.customClosing, eff) : '') + '</p><div class="sign">' + esc(eff.managerTitle || '') + '<br><br>' + esc(eff.managerName || '') + '</div></div></section>'; }
  function declarationAmount(eff) { return eff.declarationAmountMode === 'manual' ? n(eff.declarationManualAmount) : totalSalary(); }
  function noPreviousPage(eff) { var m = extractMeta(); return '<section class="page">' + header('إقرار عدم أسبقية الصرف', eff) + '<div class="letter"><p>نقر نحن / ' + esc(eff.companyName || '') + ' بأنه لم يسبق صرف مستحقات هذا المستخلص عن نطاق ' + esc(eff.scopeName || eff.hospitalName || '') + '، وذلك عن الفترة من ' + esc(m.start || 'غير محدد') + ' إلى ' + esc(m.end || 'غير محدد') + '، دفعة رقم (' + esc(m.paymentNo || '—') + ').</p><p>مبلغ الإقرار: <b>' + money(declarationAmount(eff)) + '</b> ريال سعودي.</p><p>تاريخ الإقرار: <b>' + esc(eff.declarationDate || todayIso()) + '</b></p><div class="sign">' + esc(eff.unitManagerTitle || eff.managerTitle || '') + '<br><br>' + esc(eff.unitManagerName || eff.managerName || '') + '</div></div></section>'; }
  function customPage(eff) { var body = '<div class="letter custom-letter-body">' + (eff.customLetterBody ? htmlText(eff.customLetterBody, eff) : '&nbsp;') + '</div>'; var sig = eff.customLetterShowSignature === 'no' ? '' : '<div class="sign">' + esc(eff.managerTitle || '') + '<br><br>' + esc(eff.managerName || '') + '</div>'; if (eff.customLetterMode === 'preprinted') return '<section class="page">' + body + sig + '</section>'; return '<section class="page">' + header(eff.customLetterTitle || 'خطاب مخصص', eff) + body + sig + '</section>'; }
  function indexItems() { var s = settings(), page = Math.max(1, n(s.indexStartPage, 1)), rows = []; function add(label, pages, note) { pages = Math.max(0, n(pages)); if (!pages) return; var from = page, to = page + pages - 1; rows.push({ label: label, from: from, to: to, note: note || '' }); page = to + 1; } add(DOC_LABEL.finalRaise, s.pageCountFinalRaise); add(DOC_LABEL.laborRaise, s.pageCountLaborRaise); add(DOC_LABEL.noPrevious, s.pageCountNoPrevious); add(DOC_LABEL.attendance, s.pageCountAttendance); add(DOC_LABEL.performanceTable, s.pageCountPerformanceTable); add(DOC_LABEL.performanceCert, s.pageCountPerformanceCert); add(DOC_LABEL.achievement, s.pageCountAchievement); add(DOC_LABEL.vacations, s.pageCountVacations); add(DOC_LABEL.vacancies, s.pageCountVacancies); add(DOC_LABEL.salary, s.pageCountSalary); add(DOC_LABEL.entitlement, s.pageCountEntitlement); if (s.includeCustomLetterInFull === 'yes') add(DOC_LABEL.customLetter, s.pageCountCustomLetter); if (s.includeCompanyPapersInIndex !== 'no') add(s.companyPapersTitle || 'أوراق الشركة الثابتة', s.companyPapersPageCount, 'تطبع خارج النظام وتُرفق آخر المستخلص'); return rows; }
  function indexPage(eff) { var rows = indexItems().map(function(r,i){ return '<tr><td>'+(i+1)+'</td><td>'+esc(r.label)+'</td><td>'+r.from+'</td><td>'+r.to+'</td><td>'+esc(r.note)+'</td></tr>'; }).join('') || '<tr><td colspan="5">لا توجد بنود</td></tr>'; return '<section class="page">' + header(settings().indexTitle || 'فهرس مستندات المستخلص', eff) + '<table class="index-table"><thead><tr><th>م</th><th>اسم المستند</th><th>من صفحة</th><th>إلى صفحة</th><th>ملاحظات</th></tr></thead><tbody>' + rows + '</tbody></table></section>'; }
  function simpleTable(title, rows, eff) { var body = rows.map(function(e,i){ return '<tr><td>'+(i+1)+'</td><td>'+esc(e.name||'')+'</td><td>'+esc(e.jobTitle||e.position||'')+'</td><td>'+esc(days(e).join(' '))+'</td></tr>'; }).join('') || '<tr><td colspan="4">لا توجد بيانات</td></tr>'; return '<section class="page">'+header(title, eff)+'<table class="tbl"><thead><tr><th>م</th><th>الاسم</th><th>الوظيفة</th><th>الحالات</th></tr></thead><tbody>'+body+'</tbody></table></section>'; }
  function salaryPage(eff) { var rows = employees().map(function(e,i){ return '<tr><td>'+(i+1)+'</td><td>'+esc(e.name||'')+'</td><td>'+esc(e.jobTitle||e.position||'')+'</td><td>'+money(salary(e))+'</td></tr>'; }).join(''); return '<section class="page">'+header('شهادة تسليم الرواتب', eff)+'<p>تشهد الشركة بأنه تم تسليم رواتب العمالة الموضحة أدناه حسب بيانات المستخلص.</p><table class="tbl"><thead><tr><th>م</th><th>الاسم</th><th>الوظيفة</th><th>الراتب</th></tr></thead><tbody>'+rows+'</tbody></table></section>'; }
  function entitlementPage(eff) { return '<section class="page">'+header('بيان استحقاق', eff)+'<div class="summary"><div>عدد العمالة<br>'+employees().length+'</div><div>إجمالي الرواتب<br>'+money(totalSalary())+'</div><div>بيان الغياب<br>من الطباعة الأصلية للحضور</div><div>الشواغر<br>'+vacancyRows().length+'</div></div></section>'; }

  function build(key, eff) {
    if (key === 'index') return indexPage(eff);
    if (key === 'finalRaise') return finalRaisePage(eff);
    if (key === 'laborRaise') return letterPage('خطاب الرفع للمستخلص', 'نرفع لسعادتكم مستخلص عمالة {scopeName} لشركة {companyName} عن عقد {contractName} رقم ({contractNo}) دفعة رقم ({paymentNo}) عن الفترة من {start} إلى {end}.', eff);
    if (key === 'noPrevious') return noPreviousPage(eff);
    if (key === 'vacations') return simpleTable('بيان الإجازات', vacationRows(), eff);
    if (key === 'vacancies') return simpleTable('بيان الشواغر', vacancyRows(), eff);
    if (key === 'salary') return salaryPage(eff);
    if (key === 'entitlement') return entitlementPage(eff);
    if (key === 'customLetter') return customPage(eff);
    if (key === 'fullExtract') return FULL_ORDER.filter(function(k){ if (k === 'customLetter') return settings().includeCustomLetterInFull === 'yes'; if (k === 'index') return settings().indexEnabled !== 'no'; return true; }).map(function(k){ return build(k, effective(k)); }).join('');
    return '';
  }

  function closeScript() { return '<script>(function(){var done=false;function closeSoon(){if(done)return;done=true;setTimeout(function(){try{window.close()}catch(e){}},250)}window.onafterprint=closeSoon;try{var m=window.matchMedia&&window.matchMedia("print");if(m){var h=function(e){if(!e.matches)closeSoon()};if(m.addEventListener)m.addEventListener("change",h);else if(m.addListener)m.addListener(h)}}catch(e){}setTimeout(function(){window.focus();window.print()},600)})();<\/script>'; }
  function printLetterDoc(key) { var eff = effective(key), html = '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>'+esc(DOC_LABEL[key]||key)+'</title><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap" rel="stylesheet">'+printCss(eff)+'</head><body>'+build(key, eff)+closeScript()+'</body></html>'; var w = window.open('', '_blank', 'width=1200,height=900'); if (!w) return alert('المتصفح منع فتح نافذة الطباعة.'); w.document.open(); w.document.write(html); w.document.close(); }

  function restoreAfterNativePrint(cls, style) { setTimeout(function(){ try { document.body.classList.add(cls); } catch (_) {} try { if (style && style.parentNode) style.parentNode.removeChild(style); } catch (_) {} }, 500); }
  function printNativeAttendance() {
    var cls = 'hospital-letters-clean-loading';
    var hadCls = document.body.classList.contains(cls);
    var style = document.createElement('style');
    style.textContent = '@media print{#hospital-letters-clean,#hospital-letters-clean-preload{display:none!important}}';
    document.head.appendChild(style);
    if (hadCls) document.body.classList.remove(cls);
    var done = false;
    function after(){ if (done) return; done = true; if (hadCls) restoreAfterNativePrint(cls, style); else if (style.parentNode) style.parentNode.removeChild(style); }
    window.addEventListener('afterprint', after, { once: true });
    try { window.print(); } finally { setTimeout(after, 2000); }
  }
  function printNativePage(key) {
    var src = NATIVE_URLS[key];
    if (!src) return printNativeAttendance();
    var w = window.open('', '_blank', 'width=1200,height=900');
    if (!w) return alert('المتصفح منع فتح نافذة الطباعة.');
    w.document.open();
    w.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>'+esc(DOC_LABEL[key]||key)+'</title><style>html,body{margin:0;height:100%;overflow:hidden;background:#fff}iframe{border:0;width:100%;height:100vh}</style></head><body><iframe id="nativeFrame" src="'+esc(src)+'"></iframe><script>(function(){var f=document.getElementById("nativeFrame");var done=false;function closeSoon(){if(done)return;done=true;setTimeout(function(){try{window.close()}catch(e){}},300)}f.onload=function(){setTimeout(function(){try{f.contentWindow.focus();f.contentWindow.onafterprint=closeSoon;var m=f.contentWindow.matchMedia&&f.contentWindow.matchMedia("print");if(m){var h=function(e){if(!e.matches)closeSoon()};if(m.addEventListener)m.addEventListener("change",h);else if(m.addListener)m.addListener(h)}f.contentWindow.print();}catch(e){alert("تعذر تشغيل الطباعة الأصلية");}},1600)};})();<\/script></body></html>');
    w.document.close();
  }
  function printDoc(key) { if (key === 'attendance') return printNativeAttendance(); if (NATIVE_DOCS[key]) return printNativePage(key); return printLetterDoc(key); }

  function input(name,label,type,scope,val){return '<label class="hrl-field"><span>'+esc(label)+'</span><input type="'+(type||'text')+'" '+(scope==='doc'?'data-doc-field':'data-global-field')+'="'+esc(name)+'" value="'+esc(val==null?'':val)+'"></label>';}
  function area(name,label,scope,val){return '<label class="hrl-field wide"><span>'+esc(label)+'</span><textarea '+(scope==='doc'?'data-doc-field':'data-global-field')+'="'+esc(name)+'">'+esc(val||'')+'</textarea></label>';}
  function selectF(name,label,scope,val,opts){return '<label class="hrl-field"><span>'+esc(label)+'</span><select '+(scope==='doc'?'data-doc-field':'data-global-field')+'="'+esc(name)+'">'+opts.map(function(o){return '<option value="'+esc(o[0])+'" '+(String(val)===String(o[0])?'selected':'')+'>'+esc(o[1])+'</option>';}).join('')+'</select></label>';}
  function fields(scope,src){return TEXT_FIELDS.map(function(f){return input(f[0],f[1],'text',scope,src[f[0]]);}).join('')+NUM_FIELDS.map(function(f){return input(f[0],f[1],'number',scope,src[f[0]]);}).join('')+DATE_FIELDS.map(function(f){return input(f[0],f[1],'date',scope,src[f[0]]);}).join('')+SELECT_FIELDS.map(function(f){return selectF(f[0],f[1],scope,src[f[0]],f[2]);}).join('')+selectF('letterheadMode','طريقة ترويسة الخطابات',scope,src.letterheadMode,[['external','مطبوع خارجي — نزول فقط'],['full','صورة A4 كاملة'],['top','صورة علوية فقط']])+selectF('customLetterMode','الخطاب المخصص — طريقة الطباعة',scope,src.customLetterMode,[['preprinted','مطبوع خارجي: بدون رأس ولا بيانات علوية'],['standard','نموذج عادي برأس وبيانات']])+selectF('customLetterShowSignature','الخطاب المخصص — إظهار التوقيع',scope,src.customLetterShowSignature,[['yes','نعم'],['no','لا']])+selectF('includeCustomLetterInFull','إدراج الخطاب المخصص داخل المستخلص الكامل',scope,src.includeCustomLetterInFull,[['no','لا'],['yes','نعم']])+AREA_FIELDS.map(function(f){return area(f[0],f[1],scope,src[f[0]]);}).join('');}
  function indexFields(s){return '<div class="hrl-grid">'+selectF('indexEnabled','تفعيل الفهرس','global',s.indexEnabled,[['yes','نعم'],['no','لا']])+input('indexTitle','عنوان الفهرس','text','global',s.indexTitle)+selectF('includeCompanyPapersInIndex','إظهار أوراق الشركة في الفهرس','global',s.includeCompanyPapersInIndex,[['yes','نعم'],['no','لا']])+input('companyPapersTitle','عنوان أوراق الشركة في الفهرس','text','global',s.companyPapersTitle)+INDEX_NUM_FIELDS.map(function(f){return input(f[0],f[1],'number','global',s[f[0]]);}).join('')+'</div><div class="hrl-note">أوراق الشركة لا تُرفع ولا تُطبع من النظام. الفهرس يحسب صفحاتها فقط. الحضور والأداء والإنجاز تُطبع من النظام الأصلي وتحافظ على شعارات المستشفى والتجمع.</div>';}
  function btn(action,text,cls,key){return '<button type="button" class="hrl-btn '+esc(cls||'')+'" data-action="'+esc(action)+'" '+(key?'data-doc-key="'+esc(key)+'"':'')+'>'+esc(text)+'</button>';}
  function flash(t){var el=document.getElementById('hrl-flash'); if(!el)return; el.textContent=t; el.classList.add('show'); setTimeout(function(){el.classList.remove('show');},1500);}
  function saveGlobal(){var s=settings(); document.querySelectorAll('#hospital-letters-clean [data-global-field]').forEach(function(el){s[el.dataset.globalField]=el.value;}); s.letterheadEnabled=!!document.getElementById('hrl-letterhead-enabled')?.checked; saveSettings(s); UI.settingsOpen=true; render(); flash('تم حفظ إعدادات الخطابات.');}
  function saveDoc(){var s=settings(), key=document.getElementById('hrl-doc-select')?.value||s.selectedDocKey; if (NATIVE_DOCS[key]) return alert('هذا مستند تشغيلي يطبع من النظام الأصلي ولا توجد له إعدادات خطابات.'); s.selectedDocKey=key; var d=Object.assign({},s.documentSettings[key]||{}); document.querySelectorAll('#hospital-letters-clean [data-doc-field]').forEach(function(el){d[el.dataset.docField]=el.value;}); d.enabled=!!document.getElementById('hrl-doc-enabled')?.checked; d.useGlobalLetterhead=!!document.getElementById('hrl-doc-use-global-letterhead')?.checked; s.documentSettings[key]=d; saveSettings(s); UI.docOpen=true; render(); flash('تم حفظ إعداد الخطاب.');}
  function uploadHead(file){if(!file)return; if(!/^image\//.test(file.type||''))return alert('ارفع صورة فقط.'); var r=new FileReader(); r.onload=function(){var s=settings(); s.letterheadDataUrl=String(r.result||''); s.letterheadEnabled=true; saveSettings(s); UI.settingsOpen=true; render();}; r.readAsDataURL(file);}
  function exportSettings(){var a=document.createElement('a'), blob=new Blob([JSON.stringify(settings(),null,2)],{type:'application/json'}); a.href=URL.createObjectURL(blob); a.download='hospital_raise_letters_settings.json'; document.body.appendChild(a); a.click(); setTimeout(function(){URL.revokeObjectURL(a.href); a.remove();},500);}
  function importSettings(file){if(!file)return; var r=new FileReader(); r.onload=function(){try{var x=JSON.parse(String(r.result||'{}')); saveSettings(Object.assign(defaults(),x,{documentSettings:x.documentSettings||{}})); render();}catch(_){alert('ملف الإعدادات غير صالح.');}}; r.readAsText(file);}

  function css(){if(document.getElementById('hospital-letters-clean-css'))return; var st=document.createElement('style'); st.id='hospital-letters-clean-css'; st.textContent='#hospital-letters-clean{position:fixed;inset:0;z-index:2147483600;background:#eef3f9;overflow:auto;padding:18px;font-family:Tajawal,Arial,sans-serif;direction:rtl;color:#0f172a}#hospital-letters-clean *{box-sizing:border-box}.hrl-box{width:min(1340px,97vw);margin:auto;background:#fff;border-radius:22px;padding:18px;box-shadow:0 18px 55px rgba(15,23,42,.18)}.hrl-head{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #e2e8f0;padding-bottom:14px}.hrl-head h2{margin:0;color:#003087}.hrl-row{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.hrl-group{border:1px solid #dbe4f0;border-radius:18px;padding:14px;margin:12px 0;background:#fff}.extract{border-top:4px solid #003087}.ops{border-top:4px solid #0f766e}.attach{border-top:4px solid #d4af37}.hrl-btn{border:1px solid #cbd5e1;border-radius:10px;padding:9px 13px;font-weight:950;cursor:pointer;background:#f1f5f9;color:#0f172a;font-family:inherit}.hrl-btn.primary{background:#003087;color:white}.hrl-btn.cert{background:#ecfdf5;color:#065f46}.hrl-btn.danger{background:#fee2e2;color:#991b1b}.hrl-panel{display:none;border:2px solid #0f766e;background:#f0fdfa;border-radius:18px;padding:14px;margin:12px 0}.hrl-panel.open{display:block}.hrl-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.hrl-field{background:white;border:1px solid #dbe4f0;border-radius:12px;padding:10px}.hrl-field span{display:block;font-size:12px;font-weight:950;margin-bottom:6px}.hrl-field input,.hrl-field textarea,.hrl-field select{width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:9px;font-family:inherit;font-weight:800}.hrl-field.wide{grid-column:1/-1}.hrl-field textarea{min-height:80px}.hrl-doc-card{display:flex;justify-content:space-between;gap:10px;align-items:center;border:1px solid #e2e8f0;border-radius:12px;padding:10px;margin:8px 0}.hrl-doc-card.native{background:#f8fafc;border-color:#0f766e}.hrl-note{color:#64748b;font-weight:800;line-height:1.7}#hrl-flash{display:none;margin:8px 0;padding:10px;border-radius:12px;background:#ecfdf5;color:#166534;border:1px solid #bbf7d0;text-align:center;font-weight:950}#hrl-flash.show{display:block}'; document.head.appendChild(st);}
  function docOptionsForSettings() { return DOCS.filter(function(d){ return !NATIVE_DOCS[d.key]; }); }
  function docCards(group, cls){return DOCS.filter(function(d){return d.group===group;}).map(function(d){var native=NATIVE_DOCS[d.key];return '<div class="hrl-doc-card '+(native?'native':'')+'"><div><b>'+esc(d.label)+'</b><div class="hrl-note">'+(native?'يطبع من النظام الأصلي بنفس الشعارات واللوجو، ولا توجد له إعدادات خطابات.':(docSettings(d.key).enabled?'إعداد مستقل مفعل':'يستخدم إعدادات الخطابات العامة'))+'</div></div><div>'+btn(d.key,'طباعة',cls,d.key)+(native?'':btn('openDoc','إعدادات','',d.key))+'</div></div>';}).join('');}
  function renderSettings(){var s=settings(); return '<section class="hrl-panel '+(UI.settingsOpen?'open':'')+'"><h3>الإعدادات العامة للخطابات فقط</h3><div class="hrl-note">لا تطبق هذه الإعدادات على الحضور والانصراف أو جداول الأداء أو شهادة الإنجاز؛ هذه المستندات تطبع من النظام الأصلي كما هي.</div><div class="hrl-grid">'+fields('global',s)+'</div><h3>إعداد الفهرس وأوراق الشركة</h3>'+indexFields(s)+'<div class="hrl-row"><label><input type="checkbox" id="hrl-letterhead-enabled" '+(s.letterheadEnabled?'checked':'')+'> تفعيل ترويسة الخطابات</label><input type="file" id="hrl-letterhead-file" accept="image/*">'+btn('saveGlobal','حفظ إعدادات الخطابات','primary')+btn('export','تصدير','')+'<label class="hrl-btn">استيراد<input hidden type="file" id="hrl-import-file" accept=".json,application/json"></label>'+btn('reset','إعادة ضبط','danger')+'</div></section>';}
  function renderDocPanel(){var s=settings(), key=s.selectedDocKey||'finalRaise'; if (NATIVE_DOCS[key]) key='finalRaise'; var d=docSettings(key); return '<section class="hrl-panel '+(UI.docOpen?'open':'')+'"><h3>إعداد مستقل لكل خطاب</h3><div class="hrl-note">القائمة هنا للخطابات فقط. المستندات التشغيلية تطبع من النظام الأصلي.</div><div class="hrl-row"><label class="hrl-field"><span>اختر الخطاب</span><select id="hrl-doc-select">'+docOptionsForSettings().map(function(x){return '<option value="'+x.key+'" '+(x.key===key?'selected':'')+'>'+esc(x.label)+'</option>';}).join('')+'</select></label><label class="hrl-field"><input type="checkbox" id="hrl-doc-enabled" '+(d.enabled?'checked':'')+'> تفعيل إعداد مستقل</label><label class="hrl-field"><input type="checkbox" id="hrl-doc-use-global-letterhead" '+(d.useGlobalLetterhead!==false?'checked':'')+'> استخدام ترويسة الخطابات العامة</label></div><div class="hrl-grid">'+fields('doc',d)+'</div><div class="hrl-row">'+btn('saveDoc','حفظ إعداد الخطاب','primary')+btn(key,'تجربة طباعة','cert',key)+'</div></section>';}
  function render(){document.getElementById('hospital-letters-clean')?.remove(); var preload=document.getElementById('hospital-letters-clean-preload'); if(preload)preload.remove(); css(); var html='<div id="hospital-letters-clean"><div class="hrl-box"><div class="hrl-head"><div><h2>خطابات رفع عمالة المستشفى</h2><h3>مركز خطابات المستخلص</h3><div class="hrl-note">الخطابات قابلة للإعداد. الحضور والانصراف، الأداء، وشهادة الإنجاز من طباعة النظام الأصلية بنفس شعارات المستشفى والتجمع.</div></div>'+btn('close','إغلاق','danger')+'</div><div id="hrl-flash"></div><div class="hrl-row">'+btn('toggleSettings','إعدادات الخطابات والفهرس','primary')+btn('toggleDoc','إعداد مستقل لكل خطاب','')+'</div>'+renderSettings()+renderDocPanel()+'<section class="hrl-group extract"><h3>١. مستندات المستخلص والخطابات</h3>'+docCards('extract','primary')+'</section><section class="hrl-group ops"><h3>٢. مستندات تشغيلية من النظام الأصلي</h3>'+docCards('ops','cert')+'</section><section class="hrl-group attach"><h3>٣. البيانات والمرفقات</h3>'+docCards('attach','')+'</section></div></div>'; document.body.insertAdjacentHTML('beforeend',html);}

  document.addEventListener('click', function(e){var b=e.target.closest&&e.target.closest('#hospital-letters-clean [data-action]'); if(!b)return; e.preventDefault(); var a=b.dataset.action,k=b.dataset.docKey; if(k && !NATIVE_DOCS[k]){var s=settings(); s.selectedDocKey=k; saveSettings(s);} if(a==='close')return document.getElementById('hospital-letters-clean')?.remove(); if(a==='toggleSettings'){UI.settingsOpen=!UI.settingsOpen; return render();} if(a==='toggleDoc'){UI.docOpen=!UI.docOpen; return render();} if(a==='openDoc'){UI.docOpen=true; return render();} if(a==='saveGlobal')return saveGlobal(); if(a==='saveDoc')return saveDoc(); if(a==='export')return exportSettings(); if(a==='reset'){if(confirm('حذف إعدادات خطابات المستشفى؟')){localStorage.removeItem(SETTINGS_KEY);render();}return;} if(DOCS.some(function(d){return d.key===a;}))return printDoc(a);},true);
  document.addEventListener('change',function(e){if(e.target&&e.target.id==='hrl-letterhead-file')return uploadHead(e.target.files&&e.target.files[0]); if(e.target&&e.target.id==='hrl-import-file')return importSettings(e.target.files&&e.target.files[0]); if(e.target&&e.target.id==='hrl-doc-select'){var s=settings(); s.selectedDocKey=e.target.value; saveSettings(s); UI.docOpen=true; render();}},true);

  window.HospitalRaiseLettersCleanV1 = { render: render, settings: settings, printDoc: printDoc, groups: groups, employees: employees, extractMeta: extractMeta, contractData: contractData, printNativeAttendance: printNativeAttendance, printNativePage: printNativePage };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render); else render();
  setTimeout(render, 300);
  console.info('[Hospital Raise Letters Clean V1] native operational print + configurable letters only');
})();