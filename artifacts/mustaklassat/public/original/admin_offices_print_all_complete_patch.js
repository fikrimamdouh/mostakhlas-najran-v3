// ===================================================================
// Admin Offices Consolidated Print Flow
// مصدر واحد للطباعة، بنفس فكرة دالة المراكز الصحية:
// - الزر الرئيسي: اختيار المكاتب + اختيار التقارير + طباعة مجمعة.
// - الأزرار الداخلية: طباعة الورقة الحالية فقط.
// - لا لفّ متكرر ولا طبقات طباعة خارجية.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;

  function readJson(key, fallback) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }
  function esc(v) {
    return String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function num(v) {
    var n = Number(String(v == null ? '' : v).replace(/,/g,'').replace(/[ ريال﷼]/g,''));
    return Number.isFinite(n) ? n : 0;
  }
  function money(v) { return num(v).toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function fmtDate(v) { try { return v ? new Date(v).toLocaleDateString('en-CA') : 'غير محدد'; } catch (_) { return 'غير محدد'; } }

  function officeNames() {
    try { if (typeof window.getCenterNames === 'function') return window.getCenterNames() || {}; } catch (_) {}
    return readJson('adminOfficeNames_v1', {});
  }
  function attendanceData() {
    try { if (typeof window.getAttendanceData === 'function') return window.getAttendanceData() || {}; } catch (_) {}
    return readJson('adminOfficesAttendanceData_v1', {});
  }
  function period() {
    try { if (typeof window.getExtractPeriodDetails === 'function') return window.getExtractPeriodDetails() || {}; } catch (_) {}
    var e = readJson('persistentExtractData', {});
    var start = new Date(e.extractStart || Date.now());
    var end = new Date(e.extractEnd || e.extractStart || Date.now());
    var days = Math.max(1, Math.ceil((end - start) / 86400000) + 1 || 30);
    return { startDate: start, daysInExtract: days, totalDaysInMonth: new Date(start.getFullYear(), start.getMonth()+1, 0).getDate() || 30 };
  }
  function contract() { return readJson('persistentContractData', {}); }
  function extract() { return readJson('persistentExtractData', {}); }

  function statusInfo(code) {
    try { if (window.STATUS_CODES && window.STATUS_CODES[code]) return window.STATUS_CODES[code]; } catch (_) {}
    return ({'ح':{isAbsence:false},'غ':{isAbsence:true},'ج':{isAbsence:false,isSpecial:true},'ش':{isAbsence:false,isSpecial:true},'ت':{isAbsence:false,isSpecial:true},'ب':{isAbsence:false,isSpecial:true},'ن':{isAbsence:false,isSpecial:true}})[code] || {isAbsence:false};
  }
  function fineConfig(cat) {
    return ({1:{saudi:500,non_saudi:500},2:{saudi:500,non_saudi:500},3:{saudi:250,non_saudi:100},4:{saudi:180,non_saudi:80},5:{saudi:150,non_saudi:80},6:{saudi:20,non_saudi:20},7:{saudi:10,non_saudi:10},default:{saudi:0,non_saudi:0}})[cat] || {saudi:0,non_saudi:0};
  }
  function scopedSignatures(type, key) {
    try {
      var sigKey = type;
      if (typeof window.getSignatureKeyForContext === 'function') sigKey = window.getSignatureKeyForContext(type, key);
      var sigs = typeof window.getSignatures === 'function' ? (window.getSignatures(sigKey) || []) : [];
      if (!sigs.length && sigKey !== type && typeof window.getSignatures === 'function') sigs = window.getSignatures(type) || [];
      return Array.isArray(sigs) ? sigs : [];
    } catch (_) { return []; }
  }
  function signaturesHtml(type, key, itemClass) {
    var sigs = scopedSignatures(type, key);
    if (!sigs.length) sigs = [{title:'مدير المشروع', name:''}, {title:'ممثل الجهة', name:''}, {title:'مندوب المقاول', name:''}];
    if (itemClass === 'signature-item') {
      return '<div class="signatures-grid">' + sigs.map(function(s){ return '<div class="signature-item"><div class="title">'+esc(s.title||'')+'</div><div class="line"></div><div class="name">'+esc(s.name||'................')+'</div></div>'; }).join('') + '</div>';
    }
    return '<div class="signatures">' + sigs.map(function(s){ return '<div class="sign-box"><div class="title">'+esc(s.title||'')+'</div><div class="line"></div><div>'+esc(s.name||'................')+'</div></div>'; }).join('') + '</div>';
  }
  function headerHtml(key, tableMode) {
    var h = {logoSrc:'najran_health_cluster_logo.png', h1:'فرع وزارة الصحة بمنطقة نجران', h3:'المكاتب الإدارية والمرافق الصحية'};
    try { if (typeof window.getHeaderForCenter === 'function') h = window.getHeaderForCenter(key) || h; } catch (_) {}
    if (tableMode) return '<table class="header-table"><tr><td><img class="logo" src="'+esc(h.logoSrc)+'"></td><td class="title-box"><h1>'+esc(h.h1||'')+'</h1><h2>'+esc(h.h3||'')+'</h2></td><td><img class="logo" src="'+esc(h.logoSrc)+'"></td></tr></table>';
    return '<div class="printable-header"><img src="'+esc(h.logoSrc)+'" class="logo"><div class="header-text"><h1>'+esc(h.h1||'')+'</h1><h3>'+esc(h.h3||'')+'</h3><h2>مستخلص العمالة للمكاتب الإدارية والمرافق الصحية</h2></div><img src="'+esc(h.logoSrc)+'" class="logo"></div>';
  }
  function monthName() {
    var e = extract();
    try { return new Date(e.extractStart || Date.now()).toLocaleString('ar-SA-u-nu-latn-ca-gregory', {month:'long', year:'numeric'}); } catch (_) { return ''; }
  }

  function employeeCalc(emp, p) {
    var c = contract();
    if (typeof window.calculateAdminOfficeEmployeeFinancials === 'function') {
      return window.calculateAdminOfficeEmployeeFinancials(emp, {
        totalDaysInMonth: Number(p.totalDaysInMonth)||30,
        daysInExtract: Number(p.daysInExtract)||30,
        contractType: c.contractType || 'عقد أساسي',
        directPurchaseRatio: num(c.directPurchaseRatio)
      });
    }
    var salary = num(emp.salary), daily = p.totalDaysInMonth ? salary / p.totalDaysInMonth : 0;
    var cost = daily * p.daysInExtract;
    if (c.contractType === 'شراء مباشر' && num(c.directPurchaseRatio)) cost += cost * num(c.directPurchaseRatio) / 100;
    var days = Array.isArray(emp.days) ? emp.days.slice(0, p.daysInExtract) : Array(p.daysInExtract).fill('ح');
    while (days.length < p.daysInExtract) days.push('ح');
    var attendanceDays=0, absenceDays=0, deductionOnly=0;
    days.forEach(function(d){ var s=statusInfo(d); if(s.isAbsence) absenceDays++; else attendanceDays++; if(s.deductionOnly) deductionOnly++; });
    var deduction = (absenceDays + deductionOnly) * daily;
    var cfg = fineConfig(emp.category);
    var isSaudi = String(emp.nationality||'').includes('سعودي') && !String(emp.nationality||'').includes('غير');
    var absenceFine = absenceDays * (isSaudi ? cfg.saudi : cfg.non_saudi);
    var nationalityFine = num(emp.nationalityFine);
    return {days:days, attendanceDays:attendanceDays, absenceDays:absenceDays, costForPeriod:cost, deduction:deduction, absenceFine:absenceFine, nationalityFine:nationalityFine, netSalary:cost-deduction-absenceFine-nationalityFine};
  }

  function attendancePage(key) {
    var names = officeNames(), officeName = names[key] || key, rows = attendanceData()[key] || [];
    var p = period(), e = extract(), company = contract().companyName || 'الشركة';
    var daysHeader = Array.from({length:p.daysInExtract}, function(_,i){ var d = new Date(p.startDate); d.setDate(d.getDate()+i); return '<th>'+d.getDate()+'</th>'; }).join('');
    var body='', totalCost=0,totalDed=0,totalFine=0,totalNet=0;
    rows.forEach(function(emp, idx){
      var r = employeeCalc(emp, p);
      totalCost += num(r.costForPeriod); totalDed += num(r.deduction); totalFine += num(r.absenceFine)+num(r.nationalityFine); totalNet += num(r.netSalary);
      var dayCells = (r.days || []).map(function(d){ return '<td>'+esc(d)+'</td>'; }).join('');
      body += '<tr><td>'+(idx+1)+'</td><td class="job-title">'+esc(emp.jobTitle||emp.position||'')+'</td><td>'+esc(emp.category||'')+'</td><td class="employee-name">'+esc(emp.name||'')+'</td>'+dayCells+'<td>'+money(r.costForPeriod)+'</td><td>'+num(r.attendanceDays)+'</td><td>'+num(r.absenceDays)+'</td><td>'+money(r.deduction)+'</td><td>'+money(r.absenceFine)+'</td><td>'+money(r.netSalary)+'</td><td>'+esc(emp.nationality||'')+'</td><td>'+money(r.nationalityFine)+'</td><td>'+esc(emp.iqamaId||emp.idNumber||'')+'</td></tr>';
    });
    if (!body) body = '<tr><td colspan="'+(14+p.daysInExtract)+'">لا توجد بيانات لهذا المكتب/المرفق.</td></tr>';
    var summary = '<div class="table-summary-v2"><div class="summary-item"><span>عدد الموظفين:</span><span class="value">'+rows.length+'</span></div><div class="summary-item"><span>التكلفة للفترة:</span><span class="value">'+money(totalCost)+'</span></div><div class="summary-item"><span>إجمالي الحسم:</span><span class="value">'+money(totalDed)+'</span></div><div class="summary-item"><span>إجمالي الغرامات:</span><span class="value">'+money(totalFine)+'</span></div><div class="summary-item net-total"><span>صافي الاستحقاق:</span><span class="value">'+money(totalNet)+'</span></div></div>';
    var title = '<div class="extract-details-v2"><div class="title-main">بيان بالحضور والغياب لمنسوبي شركة ('+esc(company)+') بموقع '+esc(officeName)+'</div><div class="title-period">الفترة ('+fmtDate(e.extractStart)+'م - '+fmtDate(e.extractEnd)+'م)</div></div>';
    var table = '<table><thead><tr><th rowspan="2">م</th><th rowspan="2" class="job-title">مسمى الوظيفة</th><th rowspan="2">الفئة</th><th rowspan="2" class="employee-name">اسم شاغل الوظيفة</th><th colspan="'+p.daysInExtract+'">الأيام</th><th rowspan="2">التكلفة</th><th colspan="2">الأيام</th><th colspan="2">الحسم والغرامة</th><th rowspan="2">الصافي</th><th rowspan="2">الجنسية</th><th rowspan="2">غرامة جنسية</th><th rowspan="2">الإقامة</th></tr><tr>'+daysHeader+'<th>حضور</th><th>غياب</th><th>الحسم</th><th>غرامة الغياب</th></tr></thead><tbody>'+body+'</tbody></table>';
    return '<div class="page-container landscape-page"><div class="attendance-report">'+headerHtml(key,false)+title+summary+table+signaturesHtml('attendance', key, 'signature-item')+'</div></div>';
  }

  function performanceItems() {
    try { if (typeof window.getDynamicPerformanceItems === 'function') return window.getDynamicPerformanceItems() || []; } catch (_) {}
    var saved = readJson('adminOfficePerformanceItems_v1', []);
    return Array.isArray(saved) && saved.length ? saved : [{text:'الالتزام بتنفيذ الأعمال طبقاً للعقد', max:100}];
  }
  function performanceScores(key) {
    try { if (typeof window.getPerformanceData === 'function') return (window.getPerformanceData() || {})[key] || {}; } catch (_) {}
    return (readJson('performanceData_v4', {})[key] || readJson('performanceData', {})[key] || {});
  }
  function centerCost(key) {
    try { if (typeof window.calculateCenterTotalCost === 'function') return num(window.calculateCenterTotalCost(key)); } catch (_) {}
    var p = period(); return (attendanceData()[key]||[]).reduce(function(s,emp){ return s + employeeCalc(emp,p).costForPeriod; }, 0);
  }
  function performancePage(key) {
    if (key === 'admin_staff') return '';
    var officeName = officeNames()[key] || key, items = performanceItems(), scores = performanceScores(key);
    var maxTotal=0, scoreTotal=0, rows='';
    items.forEach(function(item,i){ var max=num(item.max||item.maxScore||item.degree||0), score = scores[i] !== undefined ? num(scores[i]) : max; maxTotal += max; scoreTotal += score; rows += '<tr><td>'+(i+1)+'</td><td class="item-text">'+esc(item.text||item.name||item.title||'')+'</td><td>'+max+'</td><td>'+score+'</td></tr>'; });
    rows += '<tr style="font-weight:bold;background:#f0f0f0"><td colspan="2">المجموع</td><td>'+maxTotal+'</td><td>'+scoreTotal+'</td></tr>';
    var pct = maxTotal ? (scoreTotal/maxTotal*100) : 100, dedPct=0;
    if(pct<60)dedPct=15;else if(pct<65)dedPct=10;else if(pct<70)dedPct=8;else if(pct<75)dedPct=6;else if(pct<80)dedPct=4;else if(pct<85)dedPct=2;
    var cost=centerCost(key), dedAmount=cost*dedPct/100;
    var html = '<div class="performance-report">'+headerHtml(key,true)+'<div class="cert-title">جدول تقييم مستوى الأداء والإنجاز</div><div class="sub-title">لموقع: '+esc(officeName)+' - عن شهر '+esc(monthName())+'</div><div class="cost-bar">إجمالي المبلغ لأنشطة القسم: '+money(cost)+' ريال</div><table><thead><tr><th>م</th><th style="width:65%">أنشطة القسم</th><th>الدرجة القصوى</th><th>التقدير</th></tr></thead><tbody>'+rows+'</tbody></table><div class="summary"><p>التقدير الذي حصل عليه المقاول: <b>'+pct.toFixed(2)+'%</b>، نسبة الحسم: <b>'+dedPct+'%</b>، ويساوي: <b>'+money(dedAmount)+' ريال</b></p></div>'+signaturesHtml('performance',key,'sign-box')+'</div>';
    return '<div class="page-container portrait-page-perf">'+html+'</div>';
  }
  function achievementTitles(){ try{ if(typeof window.getAchievementTitles==='function') return window.getAchievementTitles() || {}; }catch(_){} return {mainTitle:'شهادة الإنجاز', subTitle:'مستخلص العمالة'}; }
  function tafqitText(v){ try{ if(typeof window.tafqit==='function') return window.tafqit(v); }catch(_){} return money(v)+' ريال سعودي لا غير'; }
  function achievementPage(key) {
    var officeName=officeNames()[key]||key, rows=attendanceData()[key]||[], p=period(), totals={monthly:0,ded:0,absFine:0,natFine:0};
    rows.forEach(function(emp){ var r=employeeCalc(emp,p); totals.monthly += num(r.costForPeriod); totals.ded += num(r.deduction); totals.absFine += num(r.absenceFine); totals.natFine += num(r.nationalityFine); });
    var perf = key !== 'admin_staff' ? num((readJson('performanceDeductions', {})[key] || readJson('adminOfficePerformanceDeductions_v1', {})[key] || 0)) : 0;
    var net = totals.monthly - totals.ded - totals.absFine - totals.natFine - perf, titles=achievementTitles();
    var tableRows='<tr><td>العمالة</td><td>'+money(totals.monthly)+'</td><td>'+money(totals.ded)+'</td><td>'+money(totals.absFine)+'</td><td>'+money(perf)+'</td><td>'+money(totals.natFine)+'</td><td><b>'+money(net)+'</b></td></tr><tr class="total-row"><td colspan="6">إجمالي المستحق للمقاول</td><td><b>'+money(net)+'</b></td></tr><tr class="tafqeet-cell"><td colspan="7">فقط وقدره: '+esc(tafqitText(net))+'</td></tr>';
    var html='<div class="achievement-report">'+headerHtml(key,true)+'<div class="certificate-header"><h2>'+esc(titles.mainTitle||'شهادة الإنجاز')+'</h2><h3 style="font-weight:normal">'+esc(titles.subTitle||'')+'</h3><h3>لموقع: '+esc(officeName)+' - عن شهر '+esc(monthName())+'</h3></div><table><thead><tr><th>البند</th><th>القيمة الشهرية</th><th>حسم الغياب</th><th>غرامة الغياب</th><th>غرامة الأداء</th><th>غرامة الجنسية</th><th>الصافي الشهري</th></tr></thead><tbody>'+tableRows+'</tbody></table>'+signaturesHtml('achievement',key,'sign-box')+'</div>';
    return '<div class="page-container portrait-page-ach">'+html+'</div>';
  }

  function printCss() {
    return '<style>body{font-family:Tajawal,Arial,sans-serif;direction:rtl;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}.page-container{page-break-after:always}@page{size:A4}@page landscape-orientation{size:A4 landscape;margin:.5cm}@page portrait-orientation-perf{size:A4 portrait;margin:.7cm}@page portrait-orientation-ach{size:A4 portrait;margin:.8in}.landscape-page{page:landscape-orientation}.portrait-page-perf{page:portrait-orientation-perf}.portrait-page-ach{page:portrait-orientation-ach}.printable-header{display:flex;justify-content:space-between;align-items:center;padding-bottom:5px;margin-bottom:5px;border-bottom:1px solid #ccc}.printable-header .logo{width:55px}.printable-header .header-text{text-align:center;flex-grow:1}.printable-header h1,.printable-header h2,.printable-header h3{margin:1px 0;font-size:10pt}.header-table{width:100%;border-bottom:2px solid #0056b3;margin-bottom:15px}.header-table td{vertical-align:middle;text-align:center}.header-table .logo{width:75px}.header-table .title-box{text-align:center}.header-table .title-box h1,.header-table .title-box h2{margin:2px}.attendance-report .extract-details-v2{font-size:10pt;padding:8px;background:linear-gradient(145deg,#003087,#0056b3)!important;color:#fff!important;border-radius:8px 8px 0 0;margin-bottom:-1px;display:flex;justify-content:space-between;align-items:center}.attendance-report table{width:100%;border-collapse:collapse;table-layout:auto}.attendance-report th,.attendance-report td{border:1px solid #ccc;padding:2px;text-align:center;font-size:7pt;vertical-align:middle;white-space:nowrap}.attendance-report th.job-title,.attendance-report td.job-title,.attendance-report th.employee-name,.attendance-report td.employee-name{font-size:8pt;font-weight:500}.attendance-report thead th{background:#003087!important;color:#fff!important;font-size:8pt}.attendance-report .table-summary-v2{font-size:8pt;padding:5px;display:flex;flex-wrap:wrap;justify-content:center;gap:15px;border:1px solid #ccc;background:#f8f9fa;font-weight:bold}.attendance-report .signatures-grid{display:flex;justify-content:space-around;margin-top:15px;padding-top:10px;border-top:1px solid #ccc}.attendance-report .signature-item{text-align:center;font-size:9pt}.attendance-report .signature-item .title{font-weight:bold}.attendance-report .signature-item .line{border-bottom:1px solid #000;min-height:20px;margin-top:20px}.attendance-report .signature-item .name{font-size:8pt}.performance-report .cert-title{font-size:15pt;font-weight:bold;text-align:center;margin:8px 0}.performance-report .sub-title{font-size:12pt;text-align:center;margin:4px 0}.performance-report .cost-bar{background:#f2f2f2;padding:6px;border-radius:4px;text-align:center;font-size:11pt;font-weight:bold;margin:8px 0}.performance-report table{width:100%;border-collapse:collapse;font-size:9pt;table-layout:fixed}.performance-report th,.performance-report td{border:1px solid #333;padding:4px;text-align:center}.performance-report th{background:#e9ecef}.performance-report .item-text{text-align:right}.performance-report .summary{margin-top:10px;font-size:11pt;line-height:1.5}.performance-report .signatures{margin-top:25px;display:flex;justify-content:space-around;border-top:1px solid #333;padding-top:10px}.performance-report .sign-box{text-align:center;font-size:10pt;width:24%}.performance-report .sign-box .line{border-bottom:1px solid #000;margin-top:30px}.achievement-report .certificate-header{text-align:center;margin-bottom:20px}.achievement-report .certificate-header h2,.achievement-report .certificate-header h3,.achievement-report .certificate-header p{margin:5px 0}.achievement-report table{width:100%;border-collapse:collapse;font-size:10pt;table-layout:fixed}.achievement-report th,.achievement-report td{border:1px solid #333;padding:8px;text-align:center;vertical-align:middle}.achievement-report th{background:#e9ecef;font-weight:700}.achievement-report .total-row td,.achievement-report .tafqeet-cell{font-weight:bold;background:#f0f0f0}.achievement-report .signatures{margin-top:40px;display:flex;justify-content:space-around;border-top:1px solid #333;padding-top:15px}.achievement-report .sign-box{text-align:center;font-size:11pt;width:24%}.achievement-report .sign-box .line{border-bottom:1px solid #000;margin-top:45px}</style>';
  }

  function openPrintDialog() {
    var names = officeNames(), html='';
    Object.keys(names).forEach(function(key){ html += '<div class="form-group-checkbox"><input type="checkbox" class="center-checkbox" value="'+esc(key)+'" id="print-'+esc(key)+'" checked><label for="print-'+esc(key)+'">'+esc(names[key])+'</label></div>'; });
    var content='<div class="dialog-header"><h3><i class="fas fa-print"></i> طباعة التقارير المجمعة</h3><span class="close" onclick="closeDialog(\'management-dialog\')">×</span></div><div class="dialog-body"><fieldset><legend>1. اختر المكاتب والمرافق</legend><div class="form-group-checkbox all-selector"><input type="checkbox" onchange="toggleAllCheckboxes(this, \'print-centers-checkboxes\')" id="print-all-centers" checked><label for="print-all-centers"><strong>تحديد الكل / إلغاء تحديد الكل</strong></label></div><div id="print-centers-checkboxes" class="checkbox-grid">'+html+'</div></fieldset><fieldset><legend>2. اختر التقارير للطباعة</legend><div class="checkbox-grid"><div class="form-group-checkbox"><input type="checkbox" id="print-opt-attendance" checked><label for="print-opt-attendance">تقرير الحضور والانصراف</label></div><div class="form-group-checkbox"><input type="checkbox" id="print-opt-performance" checked><label for="print-opt-performance">شهادة تقييم الأداء</label></div><div class="form-group-checkbox"><input type="checkbox" id="print-opt-achievement" checked><label for="print-opt-achievement">شهادة الإنجاز</label></div><div class="form-group-checkbox"><input type="checkbox" id="print-opt-raise-labor"><label for="print-opt-raise-labor">خطاب رفع العمالة</label></div><div class="form-group-checkbox"><input type="checkbox" id="print-opt-raise-consumables"><label for="print-opt-raise-consumables">خطاب رفع المستهلكات</label></div><div class="form-group-checkbox"><input type="checkbox" id="print-opt-raise-declaration"><label for="print-opt-raise-declaration">إقرار عدم أسبقية الصرف</label></div></div></fieldset></div><div class="dialog-footer"><div></div><button class="btn btn-success" onclick="printSelected()"><i class="fas fa-print"></i> بدء الطباعة</button></div>';
    if (typeof window.openDialog === 'function') window.openDialog(content, 'management-dialog', true); else alert('openDialog غير موجودة');
  }

  function selectedKeys() { return Array.from(document.querySelectorAll('#print-centers-checkboxes input:checked')).map(function(cb){return cb.value;}); }
  function checked(id) { return !!document.getElementById(id)?.checked; }
  function printSelected() {
    var keys = selectedKeys();
    var opts = {attendance:checked('print-opt-attendance'), performance:checked('print-opt-performance'), achievement:checked('print-opt-achievement')};
    var letters = checked('print-opt-raise-labor') || checked('print-opt-raise-consumables') || checked('print-opt-raise-declaration');
    if (!keys.length || (!opts.attendance && !opts.performance && !opts.achievement && !letters)) { alert('الرجاء اختيار مكتب/مرفق وتقرير واحد على الأقل للطباعة.'); return; }
    if (typeof window.closeDialog === 'function') window.closeDialog('management-dialog');
    var w = window.open('', '_blank', 'width=1200,height=900'); if(!w) return alert('المتصفح منع فتح نافذة الطباعة.');
    var doc = w.document; doc.open(); doc.write('<html><head><title>طباعة التقارير المجمعة</title><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">'+printCss());
    if (window.AdminOfficePrintLetters && typeof window.AdminOfficePrintLetters.lettersCss === 'function') doc.write(window.AdminOfficePrintLetters.lettersCss());
    doc.write('</head><body>');
    keys.forEach(function(key){ if(opts.attendance) doc.write(attendancePage(key)); if(opts.performance) doc.write(performancePage(key)); if(opts.achievement) doc.write(achievementPage(key)); });
    if (letters && window.AdminOfficePrintLetters && typeof window.AdminOfficePrintLetters.buildSelectedLetters === 'function') doc.write(window.AdminOfficePrintLetters.buildSelectedLetters());
    doc.write('</body></html>'); doc.close();
    w.onload=function(){ w.focus(); w.print(); w.close(); };
  }

  function detectCurrentKey() {
    var visible = Array.from(document.querySelectorAll('[id^="table-div-"]')).find(function(el){ var r=el.getBoundingClientRect(); return r.width>0 && r.height>0; });
    if (visible && visible.id) return visible.id.replace('table-div-','');
    var title = (document.getElementById('center-main-title')?.textContent || '').trim(), names=officeNames();
    var hit = Object.keys(names).find(function(k){ return names[k] && title.indexOf(names[k]) !== -1; });
    return hit || null;
  }
  function preparePrint() {
    var key = detectCurrentKey(); if(!key) return alert('لم يتم تحديد المكتب الحالي للطباعة.');
    var w = window.open('', '_blank', 'width=1200,height=900'); if(!w) return alert('المتصفح منع فتح نافذة الطباعة.');
    w.document.open(); w.document.write('<html><head><title>طباعة تقرير الحضور</title><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">'+printCss()+'</head><body>'+attendancePage(key)+'</body></html>'); w.document.close();
    w.onload=function(){ w.focus(); w.print(); w.close(); };
  }

  window.openPrintDialog = openPrintDialog;
  window.printSelected = printSelected;
  window.preparePrint = preparePrint;
  console.info('[Admin Offices Print All] consolidated health-centers style print flow installed v1');
})();