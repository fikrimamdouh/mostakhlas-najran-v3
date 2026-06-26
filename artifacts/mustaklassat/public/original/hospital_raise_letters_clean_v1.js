// ===================================================================
// Hospital Raise Letters Clean V1
// Scope: attendance.html only, test URL only: ?hospitalLettersClean=1
// No official button binding. No storage key changes. No attendance save changes.
// Printing policy:
// - Attendance uses the original attendance page tables/DOM.
// - Default print reduction follows the existing consolidated print function: scale(.72) = 72%.
// - Performance and Achievement are captured from their original pages in same-origin iframes.
// - Raise-letter attachments remain generated inside this clean screen.
// ===================================================================
(function () {
  'use strict';

  if (!/attendance\.html(?:$|[?#])|original-viewer\?page=attendance\.html/.test(location.pathname + location.search)) return;
  if (new URLSearchParams(location.search).get('hospitalLettersClean') !== '1') return;
  if (window.__HOSPITAL_RAISE_LETTERS_CLEAN_V1__) return;
  window.__HOSPITAL_RAISE_LETTERS_CLEAN_V1__ = true;

  var SETTINGS_KEY = 'hospitalRaiseLettersSettings_v1';
  var LINE_MM = 6;
  var DEFAULT_PRINT_SCALE = 72;
  var UI = { settingsOpen: false, docOpen: false };

  var DOCS = [
    { key: 'fullExtract', label: 'طباعة المستخلص كامل', group: 'extract' },
    { key: 'finalRaise', label: 'خطاب الرفع النهائي', group: 'extract' },
    { key: 'laborRaise', label: 'خطاب الرفع للمستخلص', group: 'extract' },
    { key: 'noPrevious', label: 'إقرار عدم أسبقية الصرف', group: 'extract' },
    { key: 'attendance', label: 'جدول الحضور والانصراف', group: 'ops' },
    { key: 'performanceTable', label: 'جدول تقييم الأداء كامل', group: 'ops' },
    { key: 'performanceCert', label: 'شهادة الأداء', group: 'ops' },
    { key: 'achievement', label: 'شهادة الإنجاز', group: 'ops' },
    { key: 'vacations', label: 'بيان الإجازات', group: 'attach' },
    { key: 'vacancies', label: 'بيان الشواغر', group: 'attach' },
    { key: 'salary', label: 'شهادة تسليم الرواتب', group: 'attach' },
    { key: 'entitlement', label: 'بيان استحقاق', group: 'attach' },
    { key: 'customLetter', label: 'خطاب مخصص / صفحة فاضية', group: 'attach' }
  ];

  var TEXT_FIELDS = [
    ['hospitalName', 'اسم المستشفى'],
    ['companyName', 'اسم الشركة / المقاول'],
    ['contractName', 'اسم العقد'],
    ['contractNo', 'رقم العقد'],
    ['recipient', 'المخاطب / الجهة'],
    ['recipientSuffix', 'صفة المخاطب'],
    ['subject', 'موضوع خطاب الرفع'],
    ['managerTitle', 'صفة التوقيع'],
    ['managerName', 'اسم المسؤول'],
    ['iban', 'الآيبان'],
    ['customLetterTitle', 'الخطاب المخصص — العنوان']
  ];
  var AREA_FIELDS = [
    ['finalOpening', 'افتتاح خطاب الرفع النهائي'],
    ['finalClosing', 'ختام خطاب الرفع النهائي'],
    ['generalNotes', 'ملاحظات عامة اختيارية'],
    ['customLetterBody', 'الخطاب المخصص — نص الخطاب']
  ];
  var NUM_FIELDS = [
    ['vatRate', 'نسبة الضريبة'],
    ['contentTopMm', 'نزول بداية الطباعة من أعلى الورقة — ملم'],
    ['blankLines', 'نزول إضافي بعدد السطور'],
    ['lineHeightMm', 'ارتفاع السطر بالملليمتر'],
    ['letterheadHeightMm', 'ارتفاع الترويسة العلوية — ملم'],
    ['printScale', 'تكبير/تصغير الطباعة %']
  ];

  function readJson(key, fallback) { try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; } }
  function writeJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value || {})); return true; } catch (_) { alert('تعذر الحفظ. صغّر صورة الترويسة أو صدّر الإعدادات أولاً.'); return false; } }
  function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function clean(v) { return String(v == null ? '' : v).replace(/[\u200e\u200f]/g, '').replace(/\s+/g, ' ').trim(); }
  function first() { for (var i = 0; i < arguments.length; i++) { var v = clean(arguments[i]); if (v && !['غير محدد', 'undefined', 'null', '—', '-'].includes(v)) return v; } return ''; }
  function normDigits(v) { var ar = '٠١٢٣٤٥٦٧٨٩', fa = '۰۱۲۳۴۵۶۷۸۹'; return clean(v).replace(/[٠-٩]/g, function (d) { return ar.indexOf(d); }).replace(/[۰-۹]/g, function (d) { return fa.indexOf(d); }); }
  function payNo(v) { var s = normDigits(v); return /^0*\d+$/.test(s) ? String(Number(s)) : (s || '—'); }
  function iso(v) {
    var s = normDigits(v); if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    var m = s.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/); if (m) return m[1] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[3]).padStart(2, '0');
    m = s.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/); if (m) return m[3] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0');
    var d = new Date(s); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-CA');
  }

  function defaults() {
    var c = readJson('persistentContractData', {});
    return {
      hospitalName: first(localStorage.getItem('hospitalName'), c.hospitalName, c.siteName, 'المستشفى'),
      companyName: first(c.companyName, c.contractorName, localStorage.getItem('companyName'), 'الشركة'),
      contractName: first(c.contractDetails, c.contractName, c.scopeName, 'عقد الصيانة والنظافة والتشغيل غير الطبي'),
      contractNo: first(c.contractNumber, c.contractNo, ''),
      recipient: 'سعادة / مدير الإدارة المالية',
      recipientSuffix: 'المحترم',
      subject: 'خطاب رفع مستخلص عمالة المستشفى',
      managerTitle: 'مدير الموقع',
      managerName: '',
      iban: '',
      vatRate: 15,
      finalOpening: 'نرفق لسعادتكم مستخلص عمالة {hospitalName} عن الفترة الموضحة أدناه، آملين التكرم بالاطلاع واتخاذ اللازم حسب النظام.',
      finalClosing: 'شاكرين ومقدرين تعاونكم،،',
      generalNotes: '',
      customLetterTitle: 'خطاب مخصص',
      customLetterBody: '',
      letterheadEnabled: false,
      letterheadMode: 'external',
      letterheadDataUrl: '',
      letterheadHeightMm: 45,
      contentTopMm: 0,
      blankLines: 0,
      lineHeightMm: LINE_MM,
      printScale: DEFAULT_PRINT_SCALE,
      documentSettings: {},
      selectedDocKey: 'fullExtract'
    };
  }
  function settings() { var stored = readJson(SETTINGS_KEY, {}); var out = Object.assign(defaults(), stored); out.documentSettings = Object.assign({}, stored.documentSettings || {}); if (!out.printScale) out.printScale = DEFAULT_PRINT_SCALE; return out; }
  function saveSettings(s) { return writeJson(SETTINGS_KEY, Object.assign(defaults(), s || {})); }
  function docSettings(key) { var s = settings(); return Object.assign({ enabled: false, useGlobalLetterhead: true }, (s.documentSettings || {})[key] || {}); }
  function effective(key) {
    var s = settings(), d = docSettings(key); if (!d.enabled) return s;
    var out = Object.assign({}, s);
    Object.keys(d).forEach(function (k) { if (['enabled', 'useGlobalLetterhead'].includes(k)) return; if (d[k] !== '' && d[k] != null) out[k] = d[k]; });
    if (d.useGlobalLetterhead !== false) ['letterheadEnabled','letterheadMode','letterheadDataUrl','letterheadHeightMm','contentTopMm','blankLines','lineHeightMm','printScale'].forEach(function(k){ out[k]=s[k]; });
    if (!out.printScale) out.printScale = DEFAULT_PRINT_SCALE;
    return out;
  }

  function extractMeta() {
    var e = readJson('persistentExtractData', {});
    var p = {};
    try { if (typeof window.getExtractPeriodDetails === 'function') p = window.getExtractPeriodDetails() || {}; } catch (_) {}
    var start = iso(first(p.startDate, p.extractStart, e.extractStart, e.periodStart, e.startDate, localStorage.getItem('extractStart'), localStorage.getItem('periodStart')));
    var end = iso(first(p.endDate, p.extractEnd, e.extractEnd, e.periodEnd, e.endDate, localStorage.getItem('extractEnd'), localStorage.getItem('periodEnd')));
    var no = payNo(first(p.paymentNo, p.paymentNumber, e.paymentNumber, e.extractNumber, e.paymentNo, localStorage.getItem('paymentNumber'), localStorage.getItem('extractNumber')) || '—');
    return { start: start, end: end, paymentNo: no };
  }

  function rawAttendance() {
    var list = [];
    try { if (typeof window.getAttendanceData === 'function') list.push(window.getAttendanceData() || {}); } catch (_) {}
    ['attendanceData', 'ng_attendanceData', 'nd_attendanceData', 'healthCentersAttendanceData'].forEach(function(k){ list.push(readJson(k, {})); });
    function count(o) { return Object.values(o || {}).reduce(function(s, rows){ return s + (Array.isArray(rows) ? rows.length : 0); }, 0); }
    return list.reduce(function(best, item){ return count(item) > count(best) ? item : best; }, {});
  }
  function employees() {
    var data = rawAttendance(), out = [];
    if (Array.isArray(data)) out = data;
    else Object.keys(data || {}).forEach(function(k){ (Array.isArray(data[k]) ? data[k] : []).forEach(function(e){ out.push(e); }); });
    return out.filter(function(e){ return e && (clean(e.name) || clean(e.jobTitle)); });
  }
  function vacancyRows() { return employees().filter(function(e){ return clean(e.name) === '' || clean(e.name) === 'شاغر' || clean(e.status) === 'شاغر' || (e.days || []).some(function(d){ return d === 'ش'; }); }); }
  function vacationRows() { return employees().filter(function(e){ return (e.days || []).some(function(d){ return d === 'ج'; }); }); }
  function money(n) { n = Number(n || 0); return n.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function calcTotals() { var total = 0, absent = 0, vac = 0, vacant = 0; employees().forEach(function(e){ total += Number(e.salary || e.monthlySalary || e.cost || 0); (e.days || []).forEach(function(d){ if (d === 'غ' || d === 'غ•') absent++; if (d === 'ج') vac++; if (d === 'ش') vacant++; }); }); return { employees: employees().length, totalSalary: total, absent: absent, vacation: vac, vacant: vacant }; }

  function replaceVars(txt, eff) { var m = extractMeta(); return String(txt || '').replace(/\{hospitalName\}/g, eff.hospitalName || '').replace(/\{companyName\}/g, eff.companyName || '').replace(/\{start\}/g, m.start || '').replace(/\{end\}/g, m.end || '').replace(/\{paymentNo\}/g, m.paymentNo || ''); }
  function htmlText(txt, eff) { return esc(replaceVars(txt || '', eff)).replace(/\r?\n/g, '<br>'); }
  function topOffset(eff) { return Number(eff.contentTopMm || 0) + Number(eff.blankLines || 0) * Number(eff.lineHeightMm || LINE_MM); }
  function letterheadCss(eff) {
    var top = topOffset(eff), scale = Math.max(60, Math.min(130, Number(eff.printScale || DEFAULT_PRINT_SCALE))), img = eff.letterheadEnabled && eff.letterheadDataUrl ? String(eff.letterheadDataUrl) : '', mode = eff.letterheadMode || 'external', h = Number(eff.letterheadHeightMm || 45);
    var before = '';
    if (img && mode === 'full') before = 'body:before{content:"";position:fixed;inset:0;background:url("' + img + '") top center/210mm 297mm no-repeat!important;z-index:-1;pointer-events:none}';
    if (img && mode === 'top') before = 'body:before{content:"";position:fixed;top:0;left:0;right:0;height:' + h + 'mm;background:url("' + img + '") top center/100% ' + h + 'mm no-repeat!important;z-index:999999;pointer-events:none}';
    return '<style>@page{size:A4;margin:8mm}body{font-family:Tajawal,Arial,sans-serif;direction:rtl;color:#111827;padding-top:' + top + 'mm;zoom:' + scale + '%;-webkit-print-color-adjust:exact;print-color-adjust:exact}' + before + '.page{page-break-after:always;break-after:page;min-height:260mm}.no-print,.action-buttons,.zoom-buttons,.nav-bar,.dialog,.overlay,#particles-js-bg,.std-action-bar{display:none!important}.department-table,.table-container{display:block!important;visibility:visible!important;opacity:1!important}table{border-collapse:collapse!important}.head{text-align:center;border-bottom:2px solid #003087;padding-bottom:8px;margin-bottom:14px}.head h1{font-size:18px;margin:2px}.head h2{font-size:15px;margin:2px}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:10px 0}.meta div{border:1px solid #cbd5e1;padding:6px;border-radius:6px;background:#f8fafc}.letter{font-size:15px;line-height:2.1}.sign{margin-top:35px;text-align:left;font-weight:700}.tbl{width:100%;border-collapse:collapse;margin-top:8px}.tbl th,.tbl td{border:1px solid #9ca3af;padding:4px;font-size:10px;text-align:center}.tbl th{background:#e5edf7}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}.summary div{background:#eef6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px;text-align:center;font-weight:700}.custom-letter-body{min-height:160mm;white-space:normal}</style>';
  }
  function pageHeader(title, eff) { var m = extractMeta(); return '<div class="head"><h1>' + esc(title) + '</h1><h2>' + esc(eff.hospitalName || '') + '</h2></div><div class="meta"><div>دفعة رقم: <b>' + esc(m.paymentNo) + '</b></div><div>من: <b>' + esc(m.start || 'غير محدد') + '</b></div><div>إلى: <b>' + esc(m.end || 'غير محدد') + '</b></div></div>'; }
  function letterPage(title, body, eff) { return '<section class="page">' + pageHeader(title, eff) + '<div class="letter"><p>' + esc(eff.recipient || '') + ' ' + esc(eff.recipientSuffix || '') + '</p><p><b>الموضوع: ' + esc(eff.subject || title) + '</b></p><p>' + htmlText(body, eff) + '</p><p>' + esc(eff.generalNotes || '') + '</p><div class="sign">' + esc(eff.managerTitle || '') + '<br><br>' + esc(eff.managerName || '') + '</div></div></section>'; }
  function customLetterPage(eff) { return '<section class="page">' + pageHeader(eff.customLetterTitle || 'خطاب مخصص', eff) + '<div class="letter custom-letter-body">' + (eff.customLetterBody ? htmlText(eff.customLetterBody, eff) : '&nbsp;') + '</div><div class="sign">' + esc(eff.managerTitle || '') + '<br><br>' + esc(eff.managerName || '') + '</div></section>'; }
  function simpleTable(title, rows, eff) { var body = rows.map(function(e,i){ return '<tr><td>'+(i+1)+'</td><td>'+esc(e.name||'')+'</td><td>'+esc(e.jobTitle||'')+'</td><td>'+esc((e.days||[]).join(' '))+'</td></tr>'; }).join('') || '<tr><td colspan="4">لا توجد بيانات</td></tr>'; return '<section class="page">' + pageHeader(title, eff) + '<table class="tbl"><thead><tr><th>م</th><th>الاسم</th><th>الوظيفة</th><th>الحالات</th></tr></thead><tbody>' + body + '</tbody></table></section>'; }
  function salaryPage(eff) { var rows = employees().map(function(e,i){ return '<tr><td>'+(i+1)+'</td><td>'+esc(e.name||'')+'</td><td>'+esc(e.jobTitle||'')+'</td><td>'+money(e.salary||e.monthlySalary||0)+'</td></tr>'; }).join(''); return '<section class="page">' + pageHeader('شهادة تسليم الرواتب', eff) + '<p>تشهد الشركة بأنه تم تسليم رواتب العمالة الموضحة أدناه حسب البيانات المتاحة للمستخلص.</p><table class="tbl"><tr><th>م</th><th>الاسم</th><th>الوظيفة</th><th>الراتب</th></tr>' + rows + '</table></section>'; }
  function entitlementPage(eff) { var t = calcTotals(); return '<section class="page">' + pageHeader('بيان استحقاق', eff) + '<div class="summary"><div>عدد العمالة<br>' + t.employees + '</div><div>إجمالي الرواتب<br>' + money(t.totalSalary) + '</div><div>أيام الغياب<br>' + t.absent + '</div><div>الشواغر<br>' + t.vacant + '</div></div></section>'; }

  function cleanClone(root) {
    if (!root) return '';
    var clone = root.cloneNode(true);
    clone.querySelectorAll('script,.no-print,.action-buttons,.zoom-buttons,.nav-bar,.dialog,.overlay,#particles-js-bg,.std-action-bar,button,input[type="button"],input[type="file"]').forEach(function(el){ el.remove(); });
    clone.querySelectorAll('.department-table,.table-container').forEach(function(el){ el.style.display = 'block'; el.style.visibility = 'visible'; el.style.opacity = '1'; });
    return clone.outerHTML;
  }
  function cloneDocumentStyles(doc) {
    return Array.prototype.slice.call((doc || document).querySelectorAll('link[rel="stylesheet"],style')).map(function(n){
      if (n.tagName === 'LINK') return '<link rel="stylesheet" href="' + esc(n.href) + '">';
      return '<style>' + (n.textContent || '') + '</style>';
    }).join('\n');
  }
  function originalAttendancePage(eff) {
    try { if (typeof window.updateContractDataForPrint === 'function') window.updateContractDataForPrint(); } catch (_) {}
    try { if (typeof window.renderTables === 'function') window.renderTables(); } catch (_) {}
    var parts = [];
    ['.header-info', '.page-contract-info', '.extract-details'].forEach(function(sel){ var el = document.querySelector(sel); if (el) parts.push(cleanClone(el)); });
    var tables = Array.prototype.slice.call(document.querySelectorAll('.department-table'));
    if (!tables.length) tables = Array.prototype.slice.call(document.querySelectorAll('.table-container'));
    if (!tables.length) tables = Array.prototype.slice.call(document.querySelectorAll('table'));
    tables.forEach(function(t){ parts.push(cleanClone(t)); });
    var sigs = Array.prototype.slice.call(document.querySelectorAll('.print-signatures'));
    sigs.forEach(function(s){ parts.push(cleanClone(s)); });
    if (!parts.length) return letterPage('جدول الحضور والانصراف', 'لم يتم العثور على جداول الحضور الأصلية في الصفحة الحالية.', eff);
    return '<section class="page original-page original-attendance">' + parts.join('\n') + '</section>';
  }
  function wait(ms) { return new Promise(function(resolve){ setTimeout(resolve, ms); }); }
  function captureOriginalPage(pageName, title) {
    return new Promise(function(resolve){
      var iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:absolute;width:1px;height:1px;left:-9999px;top:-9999px;opacity:0;pointer-events:none;';
      iframe.src = '/original/' + pageName + '?cleanCapture=1';
      var done = false;
      function finish(html) { if (done) return; done = true; try { iframe.remove(); } catch (_) {} resolve(html); }
      iframe.onload = async function(){
        try {
          await wait(1800);
          var doc = iframe.contentDocument || iframe.contentWindow.document;
          try { if (iframe.contentWindow.updateContractDataForPrint) iframe.contentWindow.updateContractDataForPrint(); } catch (_) {}
          try { if (iframe.contentWindow.renderTables) iframe.contentWindow.renderTables(); } catch (_) {}
          await wait(500);
          var body = doc.body ? doc.body.cloneNode(true) : null;
          if (!body) return finish('<section class="page"><h1>' + esc(title) + '</h1><p>تعذر قراءة الصفحة الأصلية.</p></section>');
          body.querySelectorAll('script,.no-print,.action-buttons,.zoom-buttons,.nav-bar,.dialog,.overlay,#particles-js-bg,.std-action-bar,button,input[type="button"],input[type="file"],select#navigation').forEach(function(el){ el.remove(); });
          finish('<section class="page original-page original-' + esc(pageName.replace(/\.html/g,'')) + '">' + body.innerHTML + '</section>');
        } catch (e) {
          finish('<section class="page"><h1>' + esc(title) + '</h1><p>تعذر تحميل الصفحة الأصلية: ' + esc(e.message || e) + '</p></section>');
        }
      };
      iframe.onerror = function(){ finish('<section class="page"><h1>' + esc(title) + '</h1><p>فشل تحميل الصفحة الأصلية.</p></section>'); };
      document.body.appendChild(iframe);
      setTimeout(function(){ finish('<section class="page"><h1>' + esc(title) + '</h1><p>انتهت مهلة تحميل الصفحة الأصلية.</p></section>'); }, 7000);
    });
  }

  async function buildDoc(key, eff) {
    if (key === 'finalRaise') return letterPage('خطاب الرفع النهائي', eff.finalOpening + ' ' + eff.finalClosing, eff);
    if (key === 'laborRaise') return letterPage('خطاب الرفع للمستخلص', 'نرفع لسعادتكم مستخلص عمالة {hospitalName} دفعة رقم ({paymentNo}) عن الفترة من {start} إلى {end}.', eff);
    if (key === 'noPrevious') return letterPage('إقرار عدم أسبقية الصرف', 'نقر بأنه لم يسبق صرف مستحقات هذا المستخلص عن الفترة من {start} إلى {end} دفعة رقم ({paymentNo}).', eff);
    if (key === 'attendance') return originalAttendancePage(eff);
    if (key === 'performanceTable' || key === 'performanceCert') return captureOriginalPage('performance.html', 'جداول الأداء / شهادة الأداء');
    if (key === 'achievement') return captureOriginalPage('achievement.html', 'شهادة الإنجاز');
    if (key === 'vacations') return simpleTable('بيان الإجازات', vacationRows(), eff);
    if (key === 'vacancies') return simpleTable('بيان الشواغر', vacancyRows(), eff);
    if (key === 'salary') return salaryPage(eff);
    if (key === 'entitlement') return entitlementPage(eff);
    if (key === 'customLetter') return customLetterPage(eff);
    if (key === 'fullExtract') {
      var order = ['finalRaise','laborRaise','noPrevious','attendance','performanceTable','achievement','vacations','vacancies','salary','entitlement'];
      var html = [];
      for (var i = 0; i < order.length; i++) html.push(await buildDoc(order[i], effective(order[i])));
      return html.join('');
    }
    return '';
  }
  function docLabel(key) { var d = DOCS.find(function(x){ return x.key === key; }); return d ? d.label : key; }
  async function printDoc(key) {
    var eff = effective(key);
    var waitBox = showWait('جاري تجهيز الطباعة الأصلية...');
    try {
      var html = '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>' + esc(docLabel(key)) + '</title><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap" rel="stylesheet">' + cloneDocumentStyles(document) + letterheadCss(eff) + '</head><body>' + await buildDoc(key, eff) + '<script>setTimeout(function(){window.print()},700)<\/script></body></html>';
      var w = window.open('', '_blank', 'width=1200,height=900');
      if (!w) return alert('المتصفح منع فتح نافذة الطباعة.');
      w.document.open(); w.document.write(html); w.document.close();
    } finally { if (waitBox) waitBox.remove(); }
  }
  function showWait(text) { var old = document.getElementById('hrl-wait'); if (old) old.remove(); var div = document.createElement('div'); div.id = 'hrl-wait'; div.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:2147483600;display:flex;align-items:center;justify-content:center;font-family:Tajawal,Arial,sans-serif;direction:rtl'; div.innerHTML = '<div style="background:#fff;border-radius:18px;padding:22px 30px;font-weight:950;color:#003087;box-shadow:0 20px 60px rgba(0,0,0,.25)">' + esc(text || 'جاري التجهيز...') + '</div>'; document.body.appendChild(div); return div; }

  function input(name, label, type, scope, val) { return '<label class="hrl-field"><span>' + esc(label) + '</span><input type="' + esc(type || 'text') + '" ' + (scope === 'doc' ? 'data-doc-field' : 'data-global-field') + '="' + esc(name) + '" value="' + esc(val == null ? '' : val) + '"></label>'; }
  function area(name, label, scope, val) { return '<label class="hrl-field wide"><span>' + esc(label) + '</span><textarea ' + (scope === 'doc' ? 'data-doc-field' : 'data-global-field') + '="' + esc(name) + '">' + esc(val || '') + '</textarea></label>'; }
  function select(name, label, scope, val, opts) { return '<label class="hrl-field"><span>' + esc(label) + '</span><select ' + (scope === 'doc' ? 'data-doc-field' : 'data-global-field') + '="' + esc(name) + '">' + opts.map(function(o){ return '<option value="' + esc(o[0]) + '" ' + (String(val) === String(o[0]) ? 'selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>'; }
  function fieldHtml(scope, src) { return TEXT_FIELDS.map(function(f){ return input(f[0], f[1], 'text', scope, src[f[0]]); }).join('') + NUM_FIELDS.map(function(f){ return input(f[0], f[1], 'number', scope, src[f[0]]); }).join('') + select('letterheadMode','طريقة الترويسة',scope,src.letterheadMode,[['external','مطبوع خارجي — نزول فقط'],['full','صورة A4 كاملة'],['top','صورة علوية فقط']]) + AREA_FIELDS.map(function(f){ return area(f[0], f[1], scope, src[f[0]]); }).join(''); }
  function btn(action, text, cls, key) { return '<button type="button" class="hrl-btn ' + esc(cls || '') + '" data-action="' + esc(action) + '" ' + (key ? 'data-doc-key="' + esc(key) + '"' : '') + '>' + esc(text) + '</button>'; }
  function flash(t) { var el = document.getElementById('hrl-flash'); if (!el) return; el.textContent = t; el.classList.add('show'); setTimeout(function(){ el.classList.remove('show'); }, 1600); }
  function saveGlobal() { var s = settings(); document.querySelectorAll('#hospital-letters-clean [data-global-field]').forEach(function(el){ s[el.dataset.globalField] = el.value; }); s.letterheadEnabled = !!document.getElementById('hrl-letterhead-enabled')?.checked; saveSettings(s); UI.settingsOpen = true; render(); flash('تم حفظ الإعدادات العامة.'); }
  function saveDoc() { var s = settings(), key = document.getElementById('hrl-doc-select')?.value || s.selectedDocKey; s.selectedDocKey = key; var d = Object.assign({}, s.documentSettings[key] || {}); document.querySelectorAll('#hospital-letters-clean [data-doc-field]').forEach(function(el){ d[el.dataset.docField] = el.value; }); d.enabled = !!document.getElementById('hrl-doc-enabled')?.checked; d.useGlobalLetterhead = !!document.getElementById('hrl-doc-use-global-letterhead')?.checked; s.documentSettings[key] = d; saveSettings(s); UI.docOpen = true; render(); flash('تم حفظ إعداد الخطاب.'); }
  function uploadHead(file) { if (!file) return; if (!/^image\//.test(file.type || '')) return alert('ارفع صورة فقط.'); var r = new FileReader(); r.onload = function(){ var s = settings(); s.letterheadDataUrl = String(r.result || ''); s.letterheadEnabled = true; saveSettings(s); UI.settingsOpen = true; render(); flash('تم رفع الترويسة.'); }; r.readAsDataURL(file); }
  function exportSettings() { var a = document.createElement('a'), blob = new Blob([JSON.stringify(settings(), null, 2)], { type: 'application/json' }); a.href = URL.createObjectURL(blob); a.download = 'hospital_raise_letters_settings.json'; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  function importSettings(file) { if (!file) return; var r = new FileReader(); r.onload = function(){ try { var x = JSON.parse(String(r.result || '{}')); saveSettings(Object.assign(defaults(), x, { documentSettings: x.documentSettings || {} })); render(); flash('تم استيراد الإعدادات.'); } catch (_) { alert('ملف الإعدادات غير صالح.'); } }; r.readAsText(file); }

  function css() { if (document.getElementById('hospital-letters-clean-css')) return; var st = document.createElement('style'); st.id = 'hospital-letters-clean-css'; st.textContent = '#hospital-letters-clean{position:fixed;inset:0;z-index:2147483000;background:#eef3f9;overflow:auto;padding:18px;font-family:Tajawal,Arial,sans-serif;direction:rtl;color:#0f172a}#hospital-letters-clean *{box-sizing:border-box}.hrl-box{width:min(1280px,96vw);margin:auto;background:#fff;border-radius:22px;padding:18px;box-shadow:0 18px 55px rgba(15,23,42,.18)}.hrl-head{display:flex;justify-content:space-between;border-bottom:1px solid #e2e8f0;padding-bottom:12px}.hrl-head h2{margin:0;color:#003087}.hrl-row{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.hrl-group{border:1px solid #dbe4f0;border-radius:18px;padding:14px;margin:12px 0}.hrl-btn{border:1px solid #cbd5e1;border-radius:10px;padding:9px 13px;font-weight:950;cursor:pointer;background:#f1f5f9}.hrl-btn.primary{background:#003087;color:white}.hrl-btn.cert{background:#ecfdf5;color:#065f46}.hrl-btn.danger{background:#fee2e2;color:#991b1b}.hrl-panel{display:none;border:2px solid #0f766e;background:#f0fdfa;border-radius:18px;padding:14px;margin:12px 0}.hrl-panel.open{display:block}.hrl-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.hrl-field{background:white;border:1px solid #dbe4f0;border-radius:12px;padding:10px}.hrl-field span{display:block;font-size:12px;font-weight:950;margin-bottom:6px}.hrl-field input,.hrl-field textarea,.hrl-field select{width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:9px;font-family:inherit}.hrl-field.wide{grid-column:1/-1}.hrl-doc-card{display:flex;justify-content:space-between;gap:10px;align-items:center;border:1px solid #e2e8f0;border-radius:12px;padding:10px;margin:8px 0}.hrl-note{color:#64748b;font-weight:800;line-height:1.7}#hrl-flash{display:none;margin:8px 0;padding:10px;border-radius:12px;background:#ecfdf5;color:#166534;border:1px solid #bbf7d0;text-align:center;font-weight:950}#hrl-flash.show{display:block}'; document.head.appendChild(st); }
  function docCards(group, cls) { return DOCS.filter(function(d){ return d.group === group; }).map(function(d){ return '<div class="hrl-doc-card"><div><b>' + esc(d.label) + '</b><div class="hrl-note">' + (docSettings(d.key).enabled ? 'إعداد مستقل مفعل' : 'يستخدم الإعداد العام') + '</div></div><div>' + btn(d.key, 'طباعة', cls, d.key) + btn('openDoc', 'إعدادات', '', d.key) + '</div></div>'; }).join(''); }
  function renderSettings() { var s = settings(); return '<section id="hrl-settings" class="hrl-panel ' + (UI.settingsOpen ? 'open' : '') + '"><h3>الإعدادات العامة والترويسة</h3><div class="hrl-grid">' + fieldHtml('global', s) + '</div><div class="hrl-row"><label><input type="checkbox" id="hrl-letterhead-enabled" ' + (s.letterheadEnabled ? 'checked' : '') + '> تفعيل الترويسة</label><input type="file" id="hrl-letterhead-file" accept="image/*">' + btn('saveGlobal','حفظ الإعدادات العامة','primary') + btn('export','تصدير','') + '<label class="hrl-btn">استيراد<input hidden type="file" id="hrl-import-file" accept=".json,application/json"></label>' + btn('reset','إعادة ضبط','danger') + '</div></section>'; }
  function renderDocPanel() { var s = settings(), key = s.selectedDocKey || 'fullExtract', d = docSettings(key); return '<section id="hrl-doc-panel" class="hrl-panel ' + (UI.docOpen ? 'open' : '') + '"><h3>إعداد مستقل لكل خطاب</h3><div class="hrl-row"><label class="hrl-field"><span>اختر الخطاب</span><select id="hrl-doc-select">' + DOCS.map(function(x){ return '<option value="' + x.key + '" ' + (x.key === key ? 'selected' : '') + '>' + esc(x.label) + '</option>'; }).join('') + '</select></label><label class="hrl-field"><input type="checkbox" id="hrl-doc-enabled" ' + (d.enabled ? 'checked' : '') + '> تفعيل إعداد مستقل</label><label class="hrl-field"><input type="checkbox" id="hrl-doc-use-global-letterhead" ' + (d.useGlobalLetterhead !== false ? 'checked' : '') + '> استخدام الترويسة العامة</label></div><div class="hrl-grid">' + fieldHtml('doc', d) + '</div><div class="hrl-row">' + btn('saveDoc','حفظ إعداد الخطاب','primary') + btn(key,'تجربة طباعة','cert',key) + '</div></section>'; }
  function render() { document.getElementById('hospital-letters-clean')?.remove(); css(); var html = '<div id="hospital-letters-clean"><div class="hrl-box"><div class="hrl-head"><div><h2>خطابات رفع عمالة المستشفى</h2><div class="hrl-note">نسخة اختبار مستقلة. الحضور يطبع جداول الصفحة الأصلية، والأداء والإنجاز من صفحاتهما الأصلية. التصغير الافتراضي 72% مطابق لدالة الطباعة المجمعة.</div></div>' + btn('close','إغلاق','danger') + '</div><div id="hrl-flash"></div><div class="hrl-row">' + btn('toggleSettings','الإعدادات العامة والترويسة','primary') + btn('toggleDoc','إعداد مستقل لكل خطاب','') + '</div>' + renderSettings() + renderDocPanel() + '<section class="hrl-group"><h3>١. مستندات المستخلص</h3>' + docCards('extract','primary') + '</section><section class="hrl-group"><h3>٢. الجداول والشهادات التشغيلية</h3>' + docCards('ops','cert') + '</section><section class="hrl-group"><h3>٣. البيانات والمرفقات</h3>' + docCards('attach','') + '</section></div></div>'; document.body.insertAdjacentHTML('beforeend', html); }

  document.addEventListener('click', async function(e){ var b = e.target.closest && e.target.closest('#hospital-letters-clean [data-action]'); if (!b) return; e.preventDefault(); var a = b.dataset.action, k = b.dataset.docKey; if (k) { var s = settings(); s.selectedDocKey = k; saveSettings(s); } if (a === 'close') return document.getElementById('hospital-letters-clean')?.remove(); if (a === 'toggleSettings') { UI.settingsOpen = !UI.settingsOpen; return render(); } if (a === 'toggleDoc') { UI.docOpen = !UI.docOpen; return render(); } if (a === 'openDoc') { UI.docOpen = true; return render(); } if (a === 'saveGlobal') return saveGlobal(); if (a === 'saveDoc') return saveDoc(); if (a === 'export') return exportSettings(); if (a === 'reset') { if (confirm('حذف إعدادات خطابات المستشفى؟')) { localStorage.removeItem(SETTINGS_KEY); render(); } return; } if (DOCS.some(function(d){ return d.key === a; })) return printDoc(a); }, true);
  document.addEventListener('change', function(e){ if (e.target && e.target.id === 'hrl-letterhead-file') return uploadHead(e.target.files && e.target.files[0]); if (e.target && e.target.id === 'hrl-import-file') return importSettings(e.target.files && e.target.files[0]); if (e.target && e.target.id === 'hrl-doc-select') { var s = settings(); s.selectedDocKey = e.target.value; saveSettings(s); UI.docOpen = true; render(); } }, true);

  window.HospitalRaiseLettersCleanV1 = { render: render, settings: settings, printDoc: printDoc, employees: employees, originalAttendancePage: originalAttendancePage, captureOriginalPage: captureOriginalPage };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render); else render();
  setTimeout(render, 700);
  console.info('[Hospital Raise Letters Clean V1] installed original-print aligned test screen + custom letter');
})();