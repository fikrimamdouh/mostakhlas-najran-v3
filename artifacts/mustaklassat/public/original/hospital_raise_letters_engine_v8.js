// Hospital Raise Letters Engine V8
// Normal hospital raise letters only.
// Compact UI: collapsible settings, clean preview, print uses the exact same document as preview.
(function () {
  'use strict';

  if (!/hospital_raise_letters\.html/.test(location.pathname) && !window.__HOSPITAL_LETTERS_STANDALONE_PAGE__) return;
  if (window.__HOSPITAL_RAISE_LETTERS_ENGINE_V8_COMPACT__) return;
  window.__HOSPITAL_RAISE_LETTERS_ENGINE_V8_COMPACT__ = true;

  const KEY = 'hospitalRaiseLettersSettings_v8';
  const ORDER = ['index', 'final', 'labor', 'noPrev', 'salary', 'vacancies', 'vacations', 'saudi', 'custom'];
  const LABEL = {
    index: 'فهرس مستندات المستخلص',
    final: 'خطاب الرفع النهائي',
    labor: 'خطاب العمالة',
    noPrev: 'عدم أسبقية الصرف',
    salary: 'شهادة تسليم الرواتب',
    vacancies: 'بيان الشواغر',
    vacations: 'بيان الإجازات',
    saudi: 'بيان السعودة',
    custom: 'خطاب مخصص'
  };

  let openPanel = '';
  let previewTimer = 0;

  function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c])); }
  function clean(v) { return String(v ?? '').replace(/[\u200e\u200f]/g, '').replace(/\s+/g, ' ').trim(); }
  function readJson(k, f) { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : f; } catch (_) { return f; } }
  function writeJson(k, v) { try { localStorage.setItem(k, JSON.stringify(v || {})); return true; } catch (_) { alert('تعذر حفظ إعدادات خطابات الرفع. صغّر صورة الترويسة إذا كانت كبيرة.'); return false; } }
  function yes(v) { return v === true || v === 'yes' || v === 'true' || v === '1'; }
  function digits(v) { const ar = '٠١٢٣٤٥٦٧٨٩', fa = '۰۱۲۳۴۵۶۷۸۹'; return String(v ?? '').replace(/[٠-٩]/g, d => ar.indexOf(d)).replace(/[۰-۹]/g, d => fa.indexOf(d)); }
  function num(v) { const n = Number(digits(v).replace(/[٬, ريال﷼\s]/g, '')); return Number.isFinite(n) ? n : 0; }
  function money(v) { return num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function ar(v) { return String(v).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]); }
  function fmtDate(v) {
    if (!v || v === 'غير محدد') return 'غير محدد';
    const s = digits(v);
    let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (m) return Number(m[3]) + '/' + Number(m[2]) + '/' + m[1];
    m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    return m ? Number(m[1]) + '/' + Number(m[2]) + '/' + m[3] : String(v);
  }
  function first() {
    for (let i = 0; i < arguments.length; i++) {
      const v = clean(arguments[i]);
      if (v && !['undefined', 'null', 'غير محدد', '—', '-'].includes(v)) return v;
    }
    return '';
  }
  function formatIban(v) {
    let x = clean(v || '').replace(/\s+/g, '').toUpperCase();
    if (!x || x === '—' || x === '-') return '';
    x = x.replace(/^SA/i, 'SA');
    return x.replace(/(.{4})(?=.)/g, '$1 ').trim();
  }

  function baseData() {
    const c = readJson('persistentContractData', {}), e = readJson('persistentExtractData', {});
    return {
      hospital: first(c.hospitalName, c.siteName, c.centerName, localStorage.hospitalName, localStorage.currentHospital, 'المستشفى'),
      company: first(c.companyName, c.contractorName, e.companyName, localStorage.companyName, 'الشركة'),
      contract: first(c.contractDetails, c.contractName, c.scopeName, e.contractName, 'مشروع التشغيل والصيانة غير الطبية'),
      contractNo: first(c.contractNumber, c.contractNo, c.number, e.contractNumber, localStorage.contractNumber, '—'),
      iban: first(c.iban, c.bankIban, c.accountIban, e.iban, localStorage.contractorIban, 'SA................................'),
      start: first(e.extractStart, e.periodStart, e.startDate, e.fromDate, localStorage.extractStart, 'غير محدد'),
      end: first(e.extractEnd, e.periodEnd, e.endDate, e.toDate, localStorage.extractEnd, 'غير محدد'),
      payment: first(e.paymentNumber, e.extractNumber, e.paymentNo, e.payment, localStorage.paymentNumber, '—')
    };
  }

  function amount(s) {
    const e = readJson('persistentExtractData', {}), vat = num(s.vatRate) || 15;
    if (num(s.manualGrand) > 0) {
      const g = num(s.manualGrand), n = g / (1 + vat / 100);
      return { net: n, vat: g - n, grand: g, source: 'manualGrand' };
    }
    const gross = ['grandTotal', 'grandAmount', 'totalWithVat', 'totalAfterVat', 'grossAmount', 'finalTotal', 'totalIncludingVat', 'invoiceTotal', 'extractTotal', 'amountWithVat', 'netPayableWithVat'];
    for (const k of gross) {
      const g = num(e[k]);
      if (g > 0) { const n = g / (1 + vat / 100); return { net: n, vat: g - n, grand: g, source: 'persistentExtractData.' + k }; }
    }
    const nets = ['netTotal', 'netAmount', 'netPayable', 'laborNetTotal', 'finalLaborCost', 'amountBeforeVat', 'subtotal', 'totalBeforeVat', 'extractNetTotal', 'netDue'];
    for (const k of nets) {
      const n = num(e[k]);
      if (n > 0) return { net: n, vat: n * vat / 100, grand: n * (1 + vat / 100), source: 'persistentExtractData.' + k };
    }
    const b = baseData();
    const keys = ['grandTotal_' + b.hospital, 'grandNetTotal_' + b.hospital, 'invoiceTotal_' + b.hospital, 'grandTotal', 'grandNetTotal', 'invoiceTotal', 'totalWithVat', 'extractTotal', 'finalLaborCost_' + b.hospital, 'laborNetTotal_' + b.hospital, 'netAmount_' + b.hospital, 'finalLaborCost', 'laborNetTotal', 'netAmount'];
    for (const k of keys) {
      const v = num(localStorage.getItem(k));
      if (v > 0) {
        if (/finalLaborCost|laborNetTotal|netAmount/.test(k)) return { net: v, vat: v * vat / 100, grand: v * (1 + vat / 100), source: 'localStorage.' + k };
        const n = v / (1 + vat / 100);
        return { net: n, vat: v - n, grand: v, source: 'localStorage.' + k };
      }
    }
    return { net: 0, vat: 0, grand: 0, source: 'غير متوفر' };
  }

  function attendance() {
    const raw = readJson('attendanceData', []), out = [];
    const add = x => { if (x && typeof x === 'object') out.push(x); };
    if (Array.isArray(raw)) raw.forEach(add);
    else if (raw && typeof raw === 'object') Object.keys(raw).forEach(k => Array.isArray(raw[k]) ? raw[k].forEach(add) : add(raw[k]));
    return out;
  }
  function empName(e) { return first(e.name, e.employeeName, e.fullName); }
  function empJob(e) { return first(e.jobTitle, e.position, e.title, e.job); }
  function empStatus(e) { return first(e.status, e.attendanceStatus, e.type); }
  function empDays(e) { const d = e.days || e.attendance || e.statuses || e.daily || []; return Array.isArray(d) ? d : (d && typeof d === 'object' ? Object.values(d) : []); }
  function isVacant(e) { return !empName(e) || /شاغر/.test(empName(e) + empStatus(e)) || empDays(e).indexOf('ش') >= 0; }
  function isLeave(e) { return /إجاز|اجاز/.test(empStatus(e)) || empDays(e).indexOf('ج') >= 0 || empDays(e).indexOf('إ') >= 0; }
  function isSaudi(e) { return e.isSaudi === true || /سعود|saudi/i.test(first(e.nationality, e.nationalityName, e.country, e.citizenship, empStatus(e))); }

  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
  const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
  function underThousand(n) {
    n = Math.floor(num(n));
    const parts = [], h = Math.floor(n / 100), r = n % 100;
    if (h) parts.push(hundreds[h]);
    if (r) {
      if (r < 10) parts.push(ones[r]);
      else if (r < 20) parts.push(teens[r - 10]);
      else { const o = r % 10, t = Math.floor(r / 10); parts.push(o ? `${ones[o]} و${tens[t]}` : tens[t]); }
    }
    return parts.join(' و');
  }
  function intWords(n) {
    n = Math.floor(num(n));
    if (!n) return 'صفر';
    const scales = [{ v: 1000000, s: 'مليون', d: 'مليونان', p: 'ملايين' }, { v: 1000, s: 'ألف', d: 'ألفان', p: 'آلاف' }], parts = [];
    for (const sc of scales) {
      const x = Math.floor(n / sc.v);
      if (x) { parts.push(x === 1 ? sc.s : x === 2 ? sc.d : `${underThousand(x)} ${x >= 3 && x <= 10 ? sc.p : sc.s}`); n %= sc.v; }
    }
    if (n) parts.push(underThousand(n));
    return parts.join(' و');
  }
  function tafqeetSAR(v) {
    const total = Math.round(num(v) * 100) / 100, abs = Math.abs(total), r = Math.floor(abs), h = Math.round((abs - r) * 100);
    let t = `فقط وقدره ${intWords(r)} ريال سعودي`;
    if (h > 0) t += ` و${intWords(h)} هللة`;
    return (total < 0 ? 'سالب ' : '') + t + ' لا غير';
  }

  function defaultDoc() {
    return { top: 0, right: 0, width: 171, titleFont: 16, bodyFont: 14.5, tableWidth: 158, tableFont: 11.5, bodyAlign: 'justify', titleAlign: 'center', showRecipient: 'yes', showGreeting: 'yes', showBody: 'yes', showTable: 'yes', showSign: 'yes', showStamp: 'no', signCount: 1, signCols: 1, sigTop: 18, stampTop: 8 };
  }
  function defaultTexts() {
    return {
      index: { to: '', suffix: '', subject: 'فهرس مستندات المستخلص', title: 'فهرس مستندات المستخلص', body: 'يتضمن هذا الفهرس ترتيب مستندات المستخلص والصفحات الخاصة بكل مستند، لاستخدامه كغلاف تنظيمي للحزمة الرسمية.', close: '', note: '', s1t: '', s1n: '', s2t: '', s2n: '', s3t: '', s3n: '' },
      final: { to: 'المكرم / مدير الإدارة المالية', suffix: 'المحترم', subject: 'خطاب الرفع النهائي', title: 'خطاب الرفع النهائي', body: 'نرفق لسعادتكم مستخلص أعمال الصيانة والنظافة والتشغيل غير الطبي الخاص بـ {company}{placePhrase}، {period}.', close: 'لذا نأمل بعد الاطلاع إحالته إلى جهة الاختصاص لتدقيقه واستكمال إجراءات صرف مستحقات المقاول / {company}.', note: 'وتقبلوا تحياتنا ،،،', s1t: '{sigTitle}', s1n: '{sigName}', s2t: '', s2n: '', s3t: '', s3n: '' },
      labor: { to: 'سعادة / مساعد المدير العام للدعم المساند', suffix: 'المحترم', subject: 'خطاب العمالة', title: 'خطاب العمالة', body: 'نرفق لسعادتكم مستخلص بند العمالة الخاص بـ {company}{placePhrase}، {period}.', close: 'لذا نأمل بعد الاطلاع إحالته إلى جهة الاختصاص لتدقيقه واستكمال إجراءات صرف مستحقات المقاول / {company}.', note: 'وتقبلوا تحياتنا ،،،', s1t: '{sigTitle}', s1n: '{sigName}', s2t: '', s2n: '', s3t: '', s3n: '' },
      noPrev: { to: '', suffix: '', subject: 'عدم أسبقية الصرف', title: 'عدم أسبقية الصرف', body: 'تشهد {issuer} بأن مستخلص {company} الخاص بـ {contract}{placePhrase}، {period}، والبالغ إجماليه {grand} ريال لم يسبق صرفه من قبل حسب السجلات المتاحة.', close: 'حرر هذا الإقرار لاستخدامه فيما يلزم نظامًا.', note: '', s1t: '{sigTitle}', s1n: '{sigName}', s2t: '', s2n: '', s3t: '', s3n: '' },
      salary: { to: '', suffix: '', subject: 'شهادة تسليم الرواتب', title: 'شهادة تسليم الرواتب', body: 'تشهد {issuer} بأن {company} قامت بتسليم رواتب العاملين التابعين لها{placePhrase} عن {period} بحسب المستندات المقدمة.', close: 'وقد أعطيت هذه الشهادة ضمن مستندات المستخلص.', note: '', s1t: '{sigTitle}', s1n: '{sigName}', s2t: '', s2n: '', s3t: '', s3n: '' },
      vacancies: { to: '', suffix: '', subject: 'بيان الشواغر', title: 'بيان الشواغر', body: 'نرفق بيان الوظائف الشاغرة{placePhrase} عن {period}.', close: 'للاطلاع واستكمال ما يلزم.', note: '', s1t: '{sigTitle}', s1n: '{sigName}', s2t: '', s2n: '', s3t: '', s3n: '' },
      vacations: { to: '', suffix: '', subject: 'بيان الإجازات', title: 'بيان الإجازات', body: 'نرفق بيان الإجازات المسجلة للعاملين{placePhrase} عن {period}.', close: 'للاطلاع واستكمال ما يلزم.', note: '', s1t: '{sigTitle}', s1n: '{sigName}', s2t: '', s2n: '', s3t: '', s3n: '' },
      saudi: { to: '', suffix: '', subject: 'بيان السعودة', title: 'بيان السعودة', body: 'نرفق بيان نسبة السعودة{placePhrase} عن {period}.', close: 'للاطلاع واستكمال ما يلزم.', note: '', s1t: '{sigTitle}', s1n: '{sigName}', s2t: '', s2n: '', s3t: '', s3n: '' },
      custom: { to: '', suffix: '', subject: 'خطاب مخصص', title: 'خطاب مخصص', body: '', close: '', note: '', s1t: '{sigTitle}', s1n: '{sigName}', s2t: '', s2n: '', s3t: '', s3n: '' }
    };
  }
  function defaults() {
    const b = baseData(), layout = {}, pageCount = {};
    ORDER.forEach(k => { layout[k] = defaultDoc(); pageCount[k] = 1; });
    layout.index.showSign = 'no';
    ['vacancies', 'vacations', 'saudi'].forEach(k => { layout[k].tableWidth = 171; layout[k].tableFont = 10.5; layout[k].bodyFont = 13.5; });
    return {
      version: 'hospital-v8-compact', selected: 'final', hospital: b.hospital, company: b.company, contract: b.contract, issuer: 'إدارة ' + b.hospital,
      sigTitle: 'مدير المستشفى', sigName: '', vatRate: 15, manualGrand: 0, requiredSaudi: 5,
      letterheadEnabled: false, letterheadMode: 'external', letterheadHasPlaceData: 'yes', letterheadDataUrl: '', contentTop: 52, letterheadHeight: 45,
      printScale: 100, marginTop: 14, marginRight: 20, marginBottom: 16, marginLeft: 18,
      indexStart: 1, pageCount, texts: defaultTexts(), layout
    };
  }
  function merge(a, b) { a = a || {}; b = b || {}; Object.keys(b).forEach(k => { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k])) a[k] = merge(a[k] || {}, b[k]); else a[k] = b[k]; }); return a; }
  function settings() { const s = merge(defaults(), readJson(KEY, {})); delete s.uiGeneral; delete s.uiDoc; delete s.uiSign; delete s.uiLetterhead; return s; }
  function save(s) { s.version = 'hospital-v8-compact'; writeJson(KEY, s); }

  function activeLetterhead(s) { return yes(s.letterheadEnabled) && (s.letterheadMode === 'external' || clean(s.letterheadDataUrl)); }
  function headImage(s) { return yes(s.letterheadEnabled) && s.letterheadMode !== 'external' && clean(s.letterheadDataUrl) ? s.letterheadDataUrl : ''; }
  function hideInternalHeader(s) { return activeLetterhead(s) && yes(s.letterheadHasPlaceData); }
  function ctx(s) {
    const b = baseData(), am = amount(s), hide = hideInternalHeader(s);
    return {
      hospital: hide ? '' : (s.hospital || b.hospital), placePhrase: hide ? '' : (' بموقع ' + (s.hospital || b.hospital)),
      company: s.company || b.company, contract: s.contract || b.contract, issuer: s.issuer || ('إدارة ' + b.hospital),
      sigTitle: s.sigTitle || '', sigName: s.sigName || '', start: fmtDate(b.start), end: fmtDate(b.end), payment: b.payment, contractNo: b.contractNo, iban: b.iban,
      period: 'دفعة رقم (' + b.payment + ') عن الفترة من ' + fmtDate(b.start) + ' م إلى ' + fmtDate(b.end) + ' م',
      net: money(am.net), vat: money(am.vat), grand: money(am.grand), grandWords: tafqeetSAR(am.grand), source: am.source
    };
  }
  function tpl(t, s) { const c = ctx(s); return String(t || '').replace(/\{([a-zA-Z0-9_]+)\}/g, (_, k) => c[k] || ''); }
  function setPath(o, p, v) { p = p.split('.'); for (let i = 0; i < p.length - 1; i++) { o[p[i]] = o[p[i]] || {}; o = o[p[i]]; } o[p[p.length - 1]] = v; }

  function input(p, l, v, t) { return '<label class="field"><span>' + esc(l) + '</span><input data-f="' + esc(p) + '" type="' + (t || 'text') + '" value="' + esc(v ?? '') + '"></label>'; }
  function area(p, l, v) { return '<label class="field wide"><span>' + esc(l) + '</span><textarea data-f="' + esc(p) + '">' + esc(v || '') + '</textarea></label>'; }
  function sel(p, l, v, opts) { return '<label class="field"><span>' + esc(l) + '</span><select data-f="' + esc(p) + '">' + opts.map(o => '<option value="' + esc(o[0]) + '" ' + (String(v) === String(o[0]) ? 'selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select></label>'; }
  function yn(p, l, v) { return sel(p, l, yes(v) ? 'yes' : 'no', [['yes', 'نعم'], ['no', 'لا']]); }
  function align(p, l, v) { return sel(p, l, v, [['right', 'يمين'], ['center', 'وسط'], ['justify', 'ضبط'], ['left', 'يسار']]); }
  function section(t) { return '<div class="section-title">' + esc(t) + '</div>'; }

  function topActions(s) {
    return '<button class="btn primary" data-toggle="general">الإعدادات العامة</button><button class="btn" data-toggle="letterhead">ترويسة A4</button><button class="btn" data-toggle="doc">إعداد الخطاب</button><button class="btn" data-toggle="sign">إعداد التواقيع</button>' +
      '<select class="doc-select" data-f="selected">' + ORDER.map(k => '<option value="' + k + '" ' + (s.selected === k ? 'selected' : '') + '>' + LABEL[k] + '</option>').join('') + '</select>' +
      '<button class="btn safe" data-print="selected">طباعة المختار</button><button class="btn safe" data-print="packet">طباعة كل الخطابات</button>' +
      ORDER.map(k => '<button class="btn light" data-print="' + k + '">' + LABEL[k] + '</button>').join('') +
      '<button class="btn safe" id="exportSettings">تصدير</button><button class="btn safe" id="importBtn">استيراد</button><input id="importFile" type="file" accept="application/json" style="display:none">';
  }

  function appCss() {
    return '<style>#hrl{font-family:Tajawal,Arial,sans-serif;direction:rtl;background:#eef3f9;min-height:100vh;padding:16px;color:#0f172a}#hrl *{box-sizing:border-box}.shell{max-width:1360px;margin:auto;background:#fff;border-radius:22px;padding:16px;box-shadow:0 18px 55px #0f172a2e}.top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;border-bottom:1px solid #e2e8f0;padding-bottom:12px;margin-bottom:12px}.top h1{margin:0;color:#003087;font-size:23px}.top p{margin:6px 0 0;color:#64748b;font-weight:800}.toolbar{position:sticky;top:8px;z-index:25;background:#fff;border:1px solid #dbe3ef;border-radius:16px;padding:10px;box-shadow:0 8px 25px #0f172a14;margin:0 0 12px;display:flex;gap:8px;flex-wrap:wrap;justify-content:center}.btn{border:1px solid #cbd5e1;border-radius:10px;padding:9px 13px;font-weight:950;cursor:pointer;background:#f1f5f9;color:#0f172a;font-family:inherit}.btn.primary{background:#003087;color:#fff}.btn.safe{background:#047857;color:#fff}.btn.light{background:#fff}.btn.active{outline:3px solid #bae6fd}.doc-select{border:1px solid #cbd5e1;border-radius:10px;padding:9px 12px;font-weight:950;font-family:inherit;min-width:220px}.panel{display:none;border:2px solid #0f766e;background:#f0fdfa;border-radius:18px;padding:14px;margin:12px 0}.panel.open{display:block}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.field{display:block;background:#fff;border:1px solid #dbe4f0;border-radius:12px;padding:10px}.field span{display:block;font-size:12px;font-weight:950;color:#334155;margin-bottom:6px}.field input,.field select,.field textarea{width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:9px;font-family:inherit;font-weight:800}.field.wide{grid-column:1/-1}.field textarea{min-height:82px}.section-title{grid-column:1/-1;background:#e0f2fe;border-radius:10px;padding:8px 10px;font-weight:950}.preview{background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:12px;margin-top:12px}.preview-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:8px}.preview h3{margin:0;color:#003087}.preview iframe{width:100%;height:820px;border:1px solid #cbd5e1;border-radius:14px;background:#e5e7eb}.head-preview{max-width:160px;max-height:220px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;margin-top:8px}@media(max-width:820px){.grid{grid-template-columns:1fr}.toolbar .btn,.toolbar .doc-select{flex:1 1 145px}.top{display:block}}</style>';
  }

  function generalPanel(s) {
    const c = ctx(s);
    return '<section class="panel ' + (openPanel === 'general' ? 'open' : '') + '"><h3>الإعدادات العامة</h3><p>مصدر المبلغ الحالي: ' + esc(c.source) + '</p><div class="grid">' +
      input('hospital', 'اسم المستشفى', s.hospital) + input('company', 'الشركة', s.company) + input('contract', 'العقد', s.contract) + input('issuer', 'الجهة المصدرة', s.issuer) + input('sigTitle', 'صفة التوقيع الافتراضية', s.sigTitle) + input('sigName', 'اسم التوقيع الافتراضي', s.sigName) + input('vatRate', 'الضريبة %', s.vatRate, 'number') + input('manualGrand', 'مبلغ يدوي شامل الضريبة', s.manualGrand, 'number') + input('requiredSaudi', 'نسبة السعودة المطلوبة %', s.requiredSaudi, 'number') +
      section('هوامش ومقياس A4') + input('contentTop', 'بداية المحتوى بعد الترويسة mm', s.contentTop, 'number') + input('printScale', 'مقياس الطباعة %', s.printScale, 'number') + input('marginRight', 'الهامش الأيمن mm', s.marginRight, 'number') + input('marginLeft', 'الهامش الأيسر mm', s.marginLeft, 'number') + input('marginBottom', 'الهامش السفلي mm', s.marginBottom, 'number') + input('indexStart', 'رقم بداية الفهرس', s.indexStart, 'number') + ORDER.map(k => input('pageCount.' + k, 'عدد صفحات: ' + LABEL[k], s.pageCount[k], 'number')).join('') + '</div></section>';
  }
  function letterheadPanel(s) {
    const img = clean(s.letterheadDataUrl || '');
    return '<section class="panel ' + (openPanel === 'letterhead' ? 'open' : '') + '"><h3>ترويسة A4</h3><p>لو الترويسة فيها بيانات الجهة والمكان، اختر نعم حتى لا يتكرر اسم المستشفى داخل الخطاب.</p><div class="grid">' + yn('letterheadEnabled', 'تفعيل الترويسة', s.letterheadEnabled) + yn('letterheadHasPlaceData', 'الترويسة تحتوي بيانات الجهة والمكان', s.letterheadHasPlaceData) + sel('letterheadMode', 'طريقة الطباعة', s.letterheadMode, [['external', 'طباعة على ورق رسمي جاهز'], ['full', 'صورة A4 كاملة كخلفية'], ['top', 'صورة علوية فقط']]) + input('contentTop', 'بداية المحتوى بعد الترويسة mm', s.contentTop, 'number') + input('letterheadHeight', 'ارتفاع الترويسة العلوية mm', s.letterheadHeight, 'number') + '<label class="field wide"><span>رفع صورة الترويسة A4</span><input id="headFile" type="file" accept="image/*">' + (img ? '<br><img class="head-preview" src="' + esc(img) + '">' : '') + '</label></div><button class="btn" id="delHead">حذف الترويسة</button></section>';
  }
  function docPanel(s) {
    const k = s.selected, d = s.texts[k], l = s.layout[k];
    return '<section class="panel ' + (openPanel === 'doc' ? 'open' : '') + '"><h3>إعداد الخطاب: ' + LABEL[k] + '</h3><div class="grid">' + input('texts.' + k + '.subject', 'سطر الموضوع', d.subject || d.title) + input('texts.' + k + '.to', 'المخاطب', d.to) + input('texts.' + k + '.suffix', 'الصفة / المحترم', d.suffix) + input('texts.' + k + '.title', 'عنوان الخطاب', d.title) + area('texts.' + k + '.body', 'جسم الخطاب', d.body) + area('texts.' + k + '.close', 'الخاتمة', d.close) + area('texts.' + k + '.note', 'ملاحظة ختامية', d.note) + section('الشكل') + input('layout.' + k + '.top', 'نزول داخل الصفحة mm', l.top, 'number') + input('layout.' + k + '.right', 'تحريك يمين mm', l.right, 'number') + input('layout.' + k + '.width', 'عرض مساحة الخطاب mm', l.width, 'number') + input('layout.' + k + '.titleFont', 'حجم العنوان', l.titleFont, 'number') + align('layout.' + k + '.titleAlign', 'محاذاة العنوان', l.titleAlign) + input('layout.' + k + '.bodyFont', 'حجم الجسم', l.bodyFont, 'number') + align('layout.' + k + '.bodyAlign', 'محاذاة الجسم', l.bodyAlign) + yn('layout.' + k + '.showTable', 'إظهار الجدول', l.showTable) + input('layout.' + k + '.tableWidth', 'عرض الجدول mm', l.tableWidth, 'number') + input('layout.' + k + '.tableFont', 'حجم خط الجدول', l.tableFont, 'number') + '</div></section>';
  }
  function signPanel(s) {
    const k = s.selected, d = s.texts[k], l = s.layout[k];
    return '<section class="panel ' + (openPanel === 'sign' ? 'open' : '') + '"><h3>تواقيع: ' + LABEL[k] + '</h3><div class="grid">' + yn('layout.' + k + '.showSign', 'إظهار التواقيع', l.showSign) + input('layout.' + k + '.signCount', 'عدد التواقيع', l.signCount, 'number') + input('layout.' + k + '.signCols', 'عدد الأعمدة', l.signCols, 'number') + input('layout.' + k + '.sigTop', 'مسافة التواقيع من أعلى mm', l.sigTop, 'number') + input('texts.' + k + '.s1t', 'صفة التوقيع 1', d.s1t) + input('texts.' + k + '.s1n', 'اسم التوقيع 1', d.s1n) + input('texts.' + k + '.s2t', 'صفة التوقيع 2', d.s2t) + input('texts.' + k + '.s2n', 'اسم التوقيع 2', d.s2n) + input('texts.' + k + '.s3t', 'صفة التوقيع 3', d.s3t) + input('texts.' + k + '.s3n', 'اسم التوقيع 3', d.s3n) + yn('layout.' + k + '.showStamp', 'إظهار الختم', l.showStamp) + input('layout.' + k + '.stampTop', 'مكان الختم mm', l.stampTop, 'number') + '</div></section>';
  }

  function readUi() {
    const s = settings();
    document.querySelectorAll('#hrl [data-f]').forEach(el => {
      let v = el.value;
      if (el.type === 'number') v = num(v);
      setPath(s, el.dataset.f, v);
    });
    s.letterheadEnabled = yes(s.letterheadEnabled);
    return s;
  }
  function bind() {
    const root = document.getElementById('hrl');
    root.querySelectorAll('[data-toggle]').forEach(b => b.onclick = () => { openPanel = openPanel === b.dataset.toggle ? '' : b.dataset.toggle; const s = readUi(); save(s); mount(); });
    root.querySelectorAll('[data-print]').forEach(b => b.onclick = () => { const s = readUi(); save(s); printDoc(b.dataset.print, s); });
    root.querySelectorAll('[data-f]').forEach(el => {
      const handler = () => { const s = readUi(); save(s); if (el.dataset.f === 'selected') mount(); else schedulePreview(s); };
      el.oninput = handler;
      el.onchange = handler;
    });
    const hf = root.querySelector('#headFile');
    if (hf) hf.onchange = function () { const f = this.files && this.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { const s = readUi(); s.letterheadDataUrl = String(r.result || ''); s.letterheadEnabled = true; s.letterheadMode = 'full'; save(s); mount(); }; r.readAsDataURL(f); };
    const dh = root.querySelector('#delHead');
    if (dh) dh.onclick = () => { const s = readUi(); s.letterheadDataUrl = ''; save(s); mount(); };
    root.querySelector('#exportSettings').onclick = () => { const blob = new Blob([JSON.stringify(readUi(), null, 2)], { type: 'application/json' }), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'hospitalRaiseLettersSettings_v8.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 500); };
    root.querySelector('#importBtn').onclick = () => root.querySelector('#importFile').click();
    root.querySelector('#importFile').onchange = function () { const f = this.files && this.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { save(merge(defaults(), JSON.parse(String(r.result || '{}')))); openPanel = ''; mount(); } catch (_) { alert('ملف الإعدادات غير صالح'); } }; r.readAsText(f); };
  }
  function mount() {
    const s = settings();
    document.body.innerHTML = '<div id="hrl">' + appCss() + '<div class="shell"><div class="top"><div><h1>خطابات رفع المستخلص العادي</h1><p>الإعدادات تفتح عند الحاجة فقط وتُحفظ مرة واحدة. المعاينة والطباعة من نفس القالب.</p></div></div><div class="toolbar">' + topActions(s) + '</div>' + generalPanel(s) + letterheadPanel(s) + docPanel(s) + signPanel(s) + '<div class="preview"><div class="preview-head"><h3>المعاينة: ' + LABEL[s.selected] + '</h3><button class="btn safe" data-print="selected">طباعة نفس المعاينة</button></div><iframe id="prev"></iframe></div></div></div>';
    bind();
    schedulePreview(s, true);
  }
  function schedulePreview(s, now) { clearTimeout(previewTimer); previewTimer = setTimeout(() => { const f = document.getElementById('prev'); if (f) f.srcdoc = renderDocument(s.selected || 'final', s, false); }, now ? 0 : 180); }

  function printCss(s) {
    const top = Math.max(0, num(s.contentTop) || 52), scale = Math.max(60, Math.min(130, num(s.printScale) || 100)) / 100;
    return `<style>@page{size:A4 portrait;margin:0}*{box-sizing:border-box}html,body{margin:0;direction:rtl;font-family:Tajawal,Arial,sans-serif;background:#e9eef5;color:#111827}.print-toolbar{position:sticky;top:0;display:flex;justify-content:center;gap:10px;background:#111827;padding:10px;z-index:5}.print-toolbar button{border:0;border-radius:10px;padding:10px 18px;font-weight:900;cursor:pointer;background:#d4af37;color:#111}.page{width:210mm;min-height:297mm;margin:10mm auto;background:#fff;box-shadow:0 10px 30px rgba(15,23,42,.16);position:relative;overflow:hidden;padding:0;page-break-after:always;break-after:page}.lh{position:absolute;top:0;left:0;width:210mm;z-index:0;pointer-events:none}.lh.full{height:297mm;object-fit:cover}.lh.top{height:${num(s.letterheadHeight)}mm;object-fit:cover}.content{position:relative;z-index:1;padding:${top}mm ${num(s.marginRight)}mm ${num(s.marginBottom)}mm ${num(s.marginLeft)}mm;min-height:297mm;transform:scale(${scale});transform-origin:top right}.content.no-letterhead{padding:${num(s.marginTop)||14}mm ${num(s.marginRight)}mm ${num(s.marginBottom)}mm ${num(s.marginLeft)}mm}.subject-wrap{text-align:left;margin:0 0 7mm;font-size:12pt;font-weight:800}.subject-text{display:inline-block;border-bottom:1px solid #000;padding:0 2mm 1mm}.title{text-align:center;font-weight:900;margin:0 0 8mm;line-height:1.5}.to{display:flex;justify-content:space-between;align-items:center;gap:20mm;font-weight:900;font-size:14.5pt;margin:0 0 8mm;white-space:nowrap}.g{text-align:center;font-size:14.5pt;font-weight:900;margin:0 0 7mm}.body{font-weight:700;line-height:2.05;margin:5mm 0;text-align:right;white-space:pre-line}.tbl{border-collapse:collapse;page-break-inside:auto;margin:8mm auto;table-layout:auto}.tbl.dense{width:171mm!important;font-size:10.5pt!important}.tbl thead{display:table-header-group}.tbl tr{page-break-inside:avoid;break-inside:avoid}.tbl td,.tbl th{border:1px solid #000;padding:2mm;text-align:center;vertical-align:middle;line-height:1.45}.tbl.dense td,.tbl.dense th{padding:1.2mm 1.4mm;line-height:1.35}.tbl th{font-weight:900;background:#f3f4f6}.amount-table .grand td{background:#fff7d6;font-weight:900}.iban-table td:first-child{font-weight:900;background:#f8fafc;text-align:right}.iban-value{direction:ltr;text-align:left!important;font-family:Arial,Tahoma,sans-serif;font-weight:900;letter-spacing:.8px;unicode-bidi:plaintext}.tafqeet{border:1px solid #94a3b8;background:#f8fafc;border-radius:8px;padding:8px 12px;margin-top:8px;font-weight:900;line-height:1.8}.after-text{text-align:right}.sig{margin-top:18mm}.sig-left{width:72mm;margin-right:auto;margin-left:4mm;text-align:center;font-weight:900;white-space:nowrap}.sig-role,.sig-name{font-size:14.5pt;font-weight:900;white-space:nowrap}.sig-line{height:12mm;border-bottom:1px solid #000;margin:0 8mm 3mm}.sig-grid{display:grid;gap:10mm;margin-top:18mm}.stamp{text-align:center;border:2px solid #333;border-radius:50%;width:34mm;height:18mm;line-height:18mm;margin:7mm auto;font-weight:900}@media print{html,body{background:#fff}.print-toolbar{display:none}.page{margin:0;box-shadow:none}.page:last-child{page-break-after:auto}}</style>`;
  }
  function head(s) { const img = headImage(s); if (!img) return ''; return '<img class="lh ' + (s.letterheadMode === 'top' ? 'top' : 'full') + '" src="' + esc(img) + '">'; }
  function page(s, k, html) { const l = s.layout[k] || defaultDoc(); return '<section class="page">' + head(s) + '<div class="content ' + (activeLetterhead(s) ? '' : 'no-letterhead') + '" style="margin-top:' + num(l.top) + 'mm;margin-right:' + num(l.right) + 'mm;width:' + num(l.width) + 'mm">' + html + '</div></section>'; }
  function lead(s, k) {
    const d = s.texts[k], l = s.layout[k], subject = tpl(first(d.subject, d.title), s);
    return '<div class="subject-wrap"><span class="subject-text">الموضوع: ' + esc(subject) + '</span></div><div class="title" style="font-size:' + num(l.titleFont) + 'pt;text-align:' + esc(l.titleAlign) + '">' + esc(tpl(d.title, s)) + '</div>' + (l.showRecipient === 'no' || !d.to ? '' : '<div class="to"><span>' + esc(tpl(d.to, s)) + '</span><span>' + esc(tpl(d.suffix, s)) + '</span></div>') + (l.showGreeting === 'no' ? '' : '<div class="g">السلام عليكم ورحمة الله وبركاته، وبعد:</div>');
  }
  function body(s, k, t, cls) { const l = s.layout[k]; if (l.showBody === 'no' || !t) return ''; return '<div class="body ' + (cls || '') + '" style="font-size:' + num(l.bodyFont) + 'pt;text-align:' + esc(l.bodyAlign) + '">' + esc(tpl(t, s)) + '</div>'; }
  function table(s, k, heads, rows, amountMode) {
    const l = s.layout[k]; if (l.showTable === 'no') return '';
    const dense = /^(vacancies|vacations|saudi)$/.test(k), tw = dense ? 171 : (num(l.tableWidth) || 158), tf = dense ? Math.min(num(l.tableFont) || 10.5, 11) : (num(l.tableFont) || 11.5);
    return '<table class="tbl ' + (dense ? 'dense' : '') + (amountMode ? ' amount-table' : '') + '" style="width:' + tw + 'mm;font-size:' + tf + 'pt"><thead><tr>' + heads.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' + (rows.length ? rows.join('') : '<tr><td colspan="' + heads.length + '">لا توجد بيانات</td></tr>') + '</tbody></table>';
  }
  function sign(s, k) {
    const d = s.texts[k], l = s.layout[k]; if (l.showSign === 'no') return '';
    let a = [];
    for (let i = 1; i <= 3; i++) { const t = tpl(d['s' + i + 't'], s), n = tpl(d['s' + i + 'n'], s); if (t || n) a.push([t, n]); }
    a = a.slice(0, Math.max(1, num(l.signCount) || 1)); if (!a.length) return '';
    if (a.length === 1) return '<div class="sig sig-left" style="margin-top:' + num(l.sigTop) + 'mm"><div class="sig-role">' + esc(a[0][0]) + '</div><div class="sig-line"></div><div class="sig-name">' + esc(a[0][1]) + '</div></div>';
    return '<div class="sig-grid" style="margin-top:' + num(l.sigTop) + 'mm;grid-template-columns:repeat(' + Math.max(1, num(l.signCols) || 1) + ',1fr)">' + a.map(x => '<div class="sig-left"><div class="sig-role">' + esc(x[0]) + '</div><div class="sig-line"></div><div class="sig-name">' + esc(x[1]) + '</div></div>').join('') + '</div>';
  }
  function stamp(s, k) { const l = s.layout[k]; return l.showStamp === 'yes' ? '<div class="stamp" style="margin-top:' + num(l.stampTop) + 'mm">الختم</div>' : ''; }
  function amtTable(s, k) { const c = ctx(s); return table(s, k, ['البيان', 'المبلغ'], ['<tr><td>الصافي</td><td>' + c.net + ' ريال</td></tr>', '<tr><td>ضريبة القيمة المضافة</td><td>' + c.vat + ' ريال</td></tr>', '<tr class="grand"><td>الإجمالي شامل الضريبة</td><td>' + c.grand + ' ريال</td></tr>'], true) + '<div class="tafqeet">' + esc(c.grandWords) + '</div>'; }
  function ibanTable(s, k) {
    const c = ctx(s), iban = formatIban(c.iban);
    if (!iban) return '';
    const l = s.layout[k] || defaultDoc();
    const tw = /^(vacancies|vacations|saudi)$/.test(k) ? 171 : (num(l.tableWidth) || 158);
    const tf = /^(vacancies|vacations|saudi)$/.test(k) ? Math.min(num(l.tableFont) || 10.5, 11) : (num(l.tableFont) || 11.5);
    return '<table class="tbl iban-table" style="width:' + tw + 'mm;font-size:' + tf + 'pt"><tbody><tr><td style="width:28%">الآيبان</td><td class="iban-value" dir="ltr">' + esc(iban) + '</td></tr></tbody></table>';
  }

  function buildDoc(k, s) {
    if (k === 'selected') k = s.selected || 'final';
    if (k === 'packet') return ORDER.map(x => buildDoc(x, s)).join('');
    const d = s.texts[k], c = ctx(s); let html = lead(s, k) + body(s, k, d.body);
    if (k === 'index') {
      let p = num(s.indexStart) || 1, rows = [];
      ORDER.filter(x => x !== 'index').forEach((x, i) => { const cnt = Math.max(1, num(s.pageCount[x]) || 1); rows.push('<tr><td>' + ar(i + 1) + '</td><td>' + LABEL[x] + '</td><td>' + ar(p) + '</td><td>' + ar(cnt) + '</td></tr>'); p += cnt; });
      html += table(s, k, ['م', 'اسم المستند', 'صفحة البداية', 'عدد الصفحات'], rows);
    } else if (k === 'final' || k === 'labor') {
      html += table(s, k, ['البيان', 'القيمة'], ['<tr><td>اسم العقد</td><td>' + esc(c.contract) + '</td></tr>', '<tr><td>الشركة</td><td>' + esc(c.company) + '</td></tr>' + (hideInternalHeader(s) ? '' : '<tr><td>الموقع</td><td>' + esc(c.hospital) + '</td></tr>'), '<tr><td>الفترة</td><td>من ' + c.start + ' إلى ' + c.end + '</td></tr>', '<tr><td>رقم العقد</td><td>' + esc(c.contractNo) + '</td></tr>']) + amtTable(s, k) + ibanTable(s, k);
    } else if (k === 'noPrev') {
      html += amtTable(s, k) + ibanTable(s, k);
    } else if (k === 'vacancies') {
      const rows = attendance().filter(isVacant).map((e, i) => '<tr><td>' + ar(i + 1) + '</td><td>' + esc(empJob(e) || 'شاغر') + '</td><td>' + esc(e.notes || '') + '</td></tr>');
      html += table(s, k, ['م', 'الوظيفة', 'ملاحظات'], rows);
    } else if (k === 'vacations') {
      const rows = attendance().filter(isLeave).map((e, i) => '<tr><td>' + ar(i + 1) + '</td><td>' + esc(empName(e)) + '</td><td>' + esc(empJob(e)) + '</td><td>' + esc(e.notes || '') + '</td></tr>');
      html += table(s, k, ['م', 'الاسم', 'الوظيفة', 'ملاحظات'], rows);
    } else if (k === 'saudi') {
      const all = attendance(), sa = all.filter(isSaudi).length, total = all.length, perc = total ? sa * 100 / total : 0;
      html += table(s, k, ['عدد الوظائف', 'عدد السعوديين', 'النسبة الفعلية', 'النسبة المطلوبة'], ['<tr><td>' + ar(total) + '</td><td>' + ar(sa) + '</td><td>' + perc.toFixed(2) + '%</td><td>' + num(s.requiredSaudi) + '%</td></tr>']);
    }
    if (k === 'custom') html = lead(s, k) + body(s, k, d.body);
    html += body(s, k, d.close, 'after-text') + body(s, k, d.note, 'after-text') + sign(s, k) + stamp(s, k);
    return page(s, k, html);
  }
  function renderDocument(k, s, toolbar) {
    return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">' + printCss(s) + '</head><body>' + (toolbar ? '<div class="print-toolbar"><button onclick="window.print()">طباعة</button><button onclick="window.close()">إغلاق</button></div>' : '') + buildDoc(k, s) + '</body></html>';
  }
  function printDoc(k, s) {
    const key = k === 'selected' ? (s.selected || 'final') : (k === 'packet' ? 'packet' : k);
    const win = window.open('', '', 'width=1000,height=900');
    if (!win) return alert('المتصفح منع نافذة الطباعة. اسمح بالنوافذ المنبثقة.');
    win.document.open();
    win.document.write(renderDocument(key, s, true));
    win.document.close();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
