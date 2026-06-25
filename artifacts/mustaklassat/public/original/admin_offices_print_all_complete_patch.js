// ===================================================================
// Admin Offices Consolidated Print Flow
// مصدر واحد للطباعة:
// - الزر الرئيسي: اختيار المكاتب + اختيار التقارير + طباعة مجمعة.
// - الحضور والانصراف: من نفس جدول الصفحة الأصلي + CSS الطباعة المضبوط من admin_offices_attendance_patch.js.
// - التقييم: من بنود المكتب الفعلية getAdminOfficePerformanceItems(centerKey).
// - الخطابات في الطباعة المجمعة: خطاب رفع الموقع فقط.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;

  function readJson(key, fallback) { try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; } }
  function esc(v) { return String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function num(v) { var n = Number(String(v == null ? '' : v).replace(/,/g,'').replace(/[ ريال﷼]/g,'')); return Number.isFinite(n) ? n : 0; }
  function money(v) { return num(v).toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function fmtDate(v) { try { return v ? new Date(v).toLocaleDateString('en-CA') : 'غير محدد'; } catch (_) { return 'غير محدد'; } }

  function officeNames() { try { if (typeof window.getCenterNames === 'function') return window.getCenterNames() || {}; } catch (_) {} return readJson('adminOfficeNames_v1', {}); }
  function attendanceData() { try { if (typeof window.getAttendanceData === 'function') return window.getAttendanceData() || {}; } catch (_) {} return readJson('adminOfficesAttendanceData_v1', {}); }
  function contract() { return readJson('persistentContractData', {}); }
  function extract() { return readJson('persistentExtractData', {}); }
  function period() {
    try { if (typeof window.getExtractPeriodDetails === 'function') return window.getExtractPeriodDetails() || {}; } catch (_) {}
    var e = extract(), s = new Date(e.extractStart || Date.now()), n = new Date(e.extractEnd || e.extractStart || Date.now());
    return { startDate:s, daysInExtract:Math.max(1, Math.ceil((n-s)/86400000)+1 || 30), totalDaysInMonth:new Date(s.getFullYear(), s.getMonth()+1, 0).getDate() || 30 };
  }
  function monthName() { try { return new Date(extract().extractStart || Date.now()).toLocaleString('ar-SA-u-nu-latn-ca-gregory', {month:'long', year:'numeric'}); } catch (_) { return ''; } }

  function statusInfo(code) {
    try { if (window.STATUS_CODES && window.STATUS_CODES[code]) return window.STATUS_CODES[code]; } catch (_) {}
    return ({'ح':{isAbsence:false},'غ':{isAbsence:true},'ج':{isAbsence:false},'ش':{isAbsence:false},'ت':{isAbsence:false},'ب':{isAbsence:false},'ن':{isAbsence:false}})[code] || {isAbsence:false};
  }
  function fineConfig(cat) { return ({1:{saudi:500,non_saudi:500},2:{saudi:500,non_saudi:500},3:{saudi:250,non_saudi:100},4:{saudi:180,non_saudi:80},5:{saudi:150,non_saudi:80},6:{saudi:20,non_saudi:20},7:{saudi:10,non_saudi:10},default:{saudi:0,non_saudi:0}})[cat] || {saudi:0,non_saudi:0}; }

  function scopedSignatures(type, key) {
    try {
      var sigKey = type;
      if (typeof window.getSignatureKeyForContext === 'function') sigKey = window.getSignatureKeyForContext(type, key);
      var sigs = typeof window.getSignatures === 'function' ? (window.getSignatures(sigKey) || []) : [];
      if (!sigs.length && sigKey !== type && typeof window.getSignatures === 'function') sigs = window.getSignatures(type) || [];
      return Array.isArray(sigs) ? sigs : [];
    } catch (_) { return []; }
  }
  function signaturesHtml(type, key, mode) {
    var sigs = scopedSignatures(type, key);
    if (!sigs.length) sigs = [{title:'مدير المشروع', name:''}, {title:'ممثل الجهة', name:''}, {title:'مندوب المقاول', name:''}];
    if (mode === 'attendance') return '<div class="signatures-grid">' + sigs.map(function(s){ return '<div class="signature-item"><div class="title">'+esc(s.title||'')+'</div><div class="line"></div><div class="name">'+esc(s.name||'................')+'</div></div>'; }).join('') + '</div>';
    return '<div class="signatures">' + sigs.map(function(s){ return '<div class="sign-box"><div class="title">'+esc(s.title||'')+'</div><div class="line"></div><div>'+esc(s.name||'................')+'</div></div>'; }).join('') + '</div>';
  }

  function headerData(key) {
    var h = {logoSrc:'najran_health_cluster_logo.png', h1:'فرع وزارة الصحة بمنطقة نجران', h3:'المكاتب الإدارية والمرافق الصحية'};
    try { if (typeof window.getHeaderForCenter === 'function') h = window.getHeaderForCenter(key) || h; } catch (_) {}
    return h;
  }
  function headerHtml(key, tableMode) {
    var h = headerData(key);
    if (tableMode) return '<table class="header-table"><tr><td><img class="logo" src="'+esc(h.logoSrc)+'"></td><td class="title-box"><h1>'+esc(h.h1||'')+'</h1><h2>'+esc(h.h3||'')+'</h2></td><td><img class="logo" src="'+esc(h.logoSrc)+'"></td></tr></table>';
    return '<div class="printable-header"><img src="'+esc(h.logoSrc)+'" class="logo"><div class="header-text"><h1>'+esc(h.h1||'')+'</h1><h3>'+esc(h.h3||'')+'</h3><h2>مستخلص العمالة للمكاتب الإدارية والمرافق الصحية</h2></div><img src="'+esc(h.logoSrc)+'" class="logo"></div>';
  }

  function employeeCalc(emp, p) {
    var c = contract();
    if (typeof window.calculateAdminOfficeEmployeeFinancials === 'function') return window.calculateAdminOfficeEmployeeFinancials(emp, {totalDaysInMonth:Number(p.totalDaysInMonth)||30,daysInExtract:Number(p.daysInExtract)||30,contractType:c.contractType||'عقد أساسي',directPurchaseRatio:num(c.directPurchaseRatio)});
    var salary = num(emp.salary), daily = p.totalDaysInMonth ? salary / p.totalDaysInMonth : 0, cost = daily * p.daysInExtract;
    if (c.contractType === 'شراء مباشر' && num(c.directPurchaseRatio)) cost += cost * num(c.directPurchaseRatio) / 100;
    var days = Array.isArray(emp.days) ? emp.days.slice(0, p.daysInExtract) : Array(p.daysInExtract).fill('ح'); while(days.length < p.daysInExtract) days.push('ح');
    var attendanceDays=0, absenceDays=0, deductionOnly=0; days.forEach(function(d){ var s=statusInfo(d); if(s.isAbsence) absenceDays++; else attendanceDays++; if(s.deductionOnly) deductionOnly++; });
    var deduction = (absenceDays + deductionOnly) * daily, cfg = fineConfig(emp.category), isSaudi = String(emp.nationality||'').includes('سعودي') && !String(emp.nationality||'').includes('غير'), absenceFine = absenceDays * (isSaudi ? cfg.saudi : cfg.non_saudi), nationalityFine = num(emp.nationalityFine);
    return {days:days,attendanceDays:attendanceDays,absenceDays:absenceDays,costForPeriod:cost,deduction:deduction,absenceFine:absenceFine,nationalityFine:nationalityFine,netSalary:cost-deduction-absenceFine-nationalityFine};
  }
  function siteTotals(key) {
    var p = period(), rows = attendanceData()[key] || [], t = {monthly:0,ded:0,absFine:0,natFine:0,netBeforePerf:0,perf:0,net:0};
    rows.forEach(function(emp){ var r = employeeCalc(emp,p); t.monthly += num(r.costForPeriod); t.ded += num(r.deduction); t.absFine += num(r.absenceFine); t.natFine += num(r.nationalityFine); });
    t.perf = key !== 'admin_staff' ? num(readJson('performanceDeductions', {})[key] || readJson('adminOfficePerformanceDeductions_v1', {})[key] || 0) : 0;
    t.netBeforePerf = t.monthly - t.ded - t.absFine - t.natFine;
    t.net = t.netBeforePerf - t.perf;
    return t;
  }

  function cloneOriginalAttendanceTable(key) {
    var existing = document.getElementById('table-div-' + key);
    if (existing) return existing.cloneNode(true);
    var tab = document.getElementById('attendance-tab');
    if (!tab || typeof window.renderAttendanceTable !== 'function') return null;
    var oldHtml = tab.innerHTML;
    try { window.renderAttendanceTable(key); var built = document.getElementById('table-div-' + key); return built ? built.cloneNode(true) : null; }
    finally { tab.innerHTML = oldHtml; }
  }
  function cleanClonedAttendance(clone, key) {
    clone.querySelectorAll('.tab-action-buttons,.no-print,button,input,select,textarea').forEach(function(el){ el.remove(); });
    clone.querySelectorAll('[contenteditable]').forEach(function(el){ el.removeAttribute('contenteditable'); });
    clone.innerHTML = clone.innerHTML.replace(/بمركز صحي /g, 'بالمكتب/المرفق: ').replace(/لمركز:/g, 'للمكتب/المرفق:');
    var sigContainer = clone.querySelector('#attendance-signatures-' + CSS.escape(key)) || clone.querySelector('.signatures-display-section');
    if (sigContainer) sigContainer.innerHTML = signaturesHtml('attendance', key, 'attendance'); else clone.insertAdjacentHTML('beforeend', signaturesHtml('attendance', key, 'attendance'));
    return clone.outerHTML;
  }
  function fallbackAttendancePage(key) {
    var names=officeNames(), officeName=names[key]||key, rows=attendanceData()[key]||[], p=period(), e=extract(), company=contract().companyName||'الشركة';
    var daysHeader=Array.from({length:p.daysInExtract},function(_,i){var d=new Date(p.startDate);d.setDate(d.getDate()+i);return '<th class="day-col">'+d.getDate()+'</th>';}).join('');
    var body='', totals=siteTotals(key);
    rows.forEach(function(emp,idx){var r=employeeCalc(emp,p), dayCells=(r.days||[]).map(function(d){return '<td class="day-col">'+esc(d)+'</td>';}).join('');body+='<tr><td class="seq-col">'+(idx+1)+'</td><td class="job-title">'+esc(emp.jobTitle||emp.position||'')+'</td><td class="category-col">'+esc(emp.category||'')+'</td><td class="employee-name">'+esc(emp.name||'')+'</td>'+dayCells+'<td class="cost-col">'+money(r.costForPeriod)+'</td><td class="days-count-col">'+num(r.attendanceDays)+'</td><td class="days-count-col">'+num(r.absenceDays)+'</td><td class="deduction-col">'+money(r.deduction)+'</td><td class="fine-col">'+money(r.absenceFine)+'</td><td class="net-col">'+money(r.netSalary)+'</td><td class="nationality-col">'+esc(emp.nationality||'')+'</td><td class="fine-col">'+money(r.nationalityFine)+'</td><td class="iqama-col">'+esc(emp.iqamaId||emp.idNumber||'')+'</td></tr>';});
    if(!body)body='<tr><td colspan="'+(14+p.daysInExtract)+'">لا توجد بيانات لهذا المكتب/المرفق.</td></tr>';
    var summary='<div class="table-summary-v2"><div class="summary-item"><span>عدد الموظفين:</span><span class="value">'+rows.length+'</span></div><div class="summary-item"><span>التكلفة للفترة:</span><span class="value">'+money(totals.monthly)+'</span></div><div class="summary-item"><span>إجمالي الحسم:</span><span class="value">'+money(totals.ded)+'</span></div><div class="summary-item"><span>إجمالي الغرامات:</span><span class="value">'+money(totals.absFine+totals.natFine)+'</span></div><div class="summary-item net-total"><span>صافي الاستحقاق:</span><span class="value">'+money(totals.netBeforePerf)+'</span></div></div>';
    var title='<div class="extract-details-v2"><div class="title-main">بيان بالحضور والغياب لمنسوبي شركة ('+esc(company)+') بموقع '+esc(officeName)+'</div><div class="title-period">الفترة ('+fmtDate(e.extractStart)+'م - '+fmtDate(e.extractEnd)+'م)</div></div>';
    return '<div class="department-table" id="table-div-'+esc(key)+'">'+title+summary+'<div class="table-responsive-wrapper"><table id="table-'+esc(key)+'"><thead><tr><th rowspan="2" class="seq-col">م</th><th rowspan="2" class="job-title">مسمى الوظيفة</th><th rowspan="2" class="category-col">الفئة</th><th rowspan="2" class="employee-name">اسم شاغل الوظيفة</th><th colspan="'+p.daysInExtract+'">الأيام</th><th rowspan="2" class="cost-col">التكلفة</th><th colspan="2">الأيام</th><th colspan="2">الحسم والغرامة</th><th rowspan="2" class="net-col">الصافي</th><th rowspan="2" class="nationality-col">الجنسية</th><th rowspan="2" class="fine-col">غرامة جنسية</th><th rowspan="2" class="iqama-col">الإقامة</th></tr><tr>'+daysHeader+'<th class="days-count-col">حضور</th><th class="days-count-col">غياب</th><th class="deduction-col">الحسم</th><th class="fine-col">غرامة الغياب</th></tr></thead><tbody>'+body+'</tbody></table></div>'+signaturesHtml('attendance',key,'attendance')+'</div>';
  }
  function attendancePage(key) {
    var clone = cloneOriginalAttendanceTable(key), body = clone ? cleanClonedAttendance(clone, key) : fallbackAttendancePage(key), contractInfo = document.querySelector('.page-contract-info-v2,.page-contract-info');
    return '<div class="page-container landscape-page"><div class="attendance-report attendance-report-original">'+headerHtml(key,false)+(contractInfo ? contractInfo.outerHTML : '')+body+'</div></div>';
  }

  function perfItems(key) { try { if (typeof window.getAdminOfficePerformanceItems === 'function') return window.getAdminOfficePerformanceItems(key) || []; } catch (_) {} return []; }
  function perfScore(key, item, index) {
    var scores = readJson('adminOfficePerformanceScores_v1', {});
    var raw = scores[key] && scores[key][index] !== undefined ? parseInt(scores[key][index],10) : (item.score !== undefined ? parseInt(item.score,10) : parseInt(item.max,10));
    var max = parseInt(item.max,10) || 0;
    raw = isNaN(raw) ? max : raw;
    return Math.max(0, Math.min(raw, max));
  }
  function performancePage(key){
    if(key==='admin_staff'){}
    var officeName=officeNames()[key]||key, items=perfItems(key), maxTotal=0, scoreTotal=0, rows='';
    if (!items.length) items = [{text:'الالتزام بتنفيذ الأعمال طبقاً للعقد', max:100, score:100}];
    var isWorkshop = key === 'admin_staff';
    items.forEach(function(item,i){ var max=num(item.max), score=perfScore(key,item,i); maxTotal+=max; scoreTotal+=score; if(isWorkshop){ var label=esc(item.sub||item.text||''); if(item.section) label=esc(item.section)+' - '+label; rows+='<tr><td>'+(i+1)+'</td><td class="item-text">'+label+'</td><td>'+max+'</td><td>'+score+'</td></tr>'; } else { rows+='<tr><td>'+(i+1)+'</td><td class="item-text">'+esc(item.text||item.name||item.title||'')+'</td><td>'+max+'</td><td>'+score+'</td></tr>'; } });
    rows+='<tr class="total-row"><td colspan="2">المجمــــــــــــــــوع</td><td>'+maxTotal+'</td><td>'+scoreTotal+'</td></tr>';
    var pct=maxTotal?(scoreTotal/maxTotal*100):100,dedPct=0;if(pct<60)dedPct=15;else if(pct<65)dedPct=10;else if(pct<70)dedPct=8;else if(pct<75)dedPct=6;else if(pct<80)dedPct=4;else if(pct<85)dedPct=2;var cost=siteTotals(key).monthly,dedAmount=cost*dedPct/100;
    var html='<div class="performance-report">'+headerHtml(key,true)+'<div class="cert-title">جدول ح غ 1</div><div class="sub-title">جدول الغرامات الخاصة بمستوى الأداء لموقع '+esc(officeName)+'</div><div class="cost-bar">إجمالي المبلغ لأنشطة القسم (تكلفة العمالة): '+money(cost)+' ريال</div><table><thead><tr><th>م</th><th style="width:65%">أنشطة القسم</th><th>الدرجة القصوى</th><th>التقدير</th></tr></thead><tbody>'+rows+'</tbody></table><div class="summary"><p>التقدير الذي حصل عليه المقاول: <b>'+pct.toFixed(2)+'%</b>، نسبة الحسم: <b>'+dedPct+'%</b>، ويساوي: <b>'+money(dedAmount)+' ريال</b></p></div>'+signaturesHtml('performance',key,'sign-box')+'</div>';
    return '<div class="page-container portrait-page-perf">'+html+'</div>';
  }
  function achievementTitles(){try{if(typeof window.getAchievementTitles==='function')return window.getAchievementTitles()||{}}catch(_){}return{mainTitle:'شهادة الإنجاز',subTitle:'مستخلص العمالة'};}
  function tafqitText(v){try{if(typeof window.tafqit==='function')return window.tafqit(v)}catch(_){}return money(v)+' ريال سعودي لا غير';}
  function achievementPage(key){var officeName=officeNames()[key]||key,t=siteTotals(key),titles=achievementTitles();var trs='<tr><td>العمالة</td><td>'+money(t.monthly)+'</td><td>'+money(t.ded)+'</td><td>'+money(t.absFine)+'</td><td>'+money(t.perf)+'</td><td>'+money(t.natFine)+'</td><td><b>'+money(t.net)+'</b></td></tr><tr class="total-row"><td colspan="6">إجمالي المستحق للمقاول</td><td><b>'+money(t.net)+'</b></td></tr><tr class="tafqeet-cell"><td colspan="7">فقط وقدره: '+esc(tafqitText(t.net))+'</td></tr>';var html='<div class="achievement-report">'+headerHtml(key,true)+'<div class="certificate-header"><h2>'+esc(titles.mainTitle||'شهادة الإنجاز')+'</h2><h3 style="font-weight:normal">'+esc(titles.subTitle||'')+'</h3><h3>لموقع: '+esc(officeName)+' - عن شهر '+esc(monthName())+'</h3></div><table><thead><tr><th>البند</th><th>القيمة الشهرية</th><th>حسم الغياب</th><th>غرامة الغياب</th><th>غرامة الأداء</th><th>غرامة الجنسية</th><th>الصافي الشهري</th></tr></thead><tbody>'+trs+'</tbody></table>'+signaturesHtml('achievement',key,'sign-box')+'</div>';return '<div class="page-container portrait-page-ach">'+html+'</div>';}

  function letterSettings(){return Object.assign({recipient:'سعادة / مساعد المدير العام للدعم المساند',recipientSuffix:'المحترم',entityTitle:'المديرية العامة للشئون الصحية بمنطقة نجران',departmentTitle:'إدارة الشئون الهندسية',vatRate:15,phoneFaxAr:'نجران – تليفون 0175225872    فاكس 017523312',phoneFaxEn:'Najran – Tel.: 0175225872       Fax: 017523312'}, readJson('adminOfficesRaiseLettersSettings_v1',{}));}
  function siteRaiseLetterPage(key){var s=letterSettings(), e=extract(), names=officeNames(), site=names[key]||key, c=contract(), company=c.companyName||'غير محدد', net=siteTotals(key).net, vat=net*num(s.vatRate)/100,total=net+vat;var head='<div class="raise-head"><img src="moh_logo.png"><div><h1>'+esc(s.entityTitle)+'</h1><h2>'+esc(s.departmentTitle)+'</h2></div><img src="moh_logo.png"></div>';var body='السلام عليكم ورحمة الله وبركاته، وبعد:<br>نرفق لسعادتكم مستخلص موقع <b>'+esc(site)+'</b> لشركة '+esc(company)+'، عن الفترة من '+esc(fmtDate(e.extractStart))+' م إلى '+esc(fmtDate(e.extractEnd))+' م.';var table='<table class="raise-amount-table"><tbody><tr><td>صافي مستحقات الموقع</td><td>'+money(net)+'</td></tr><tr><td>ضريبة القيمة المضافة '+num(s.vatRate)+'%</td><td>'+money(vat)+'</td></tr><tr class="grand"><td>الإجمالي</td><td>'+money(total)+'</td></tr><tr class="tafqeet-row"><td colspan="2">'+esc(tafqitText(total))+'</td></tr></tbody></table>';var sigs=signaturesHtml('raise_letters',key,'sign-box');var footer='<div class="raise-footer"><span>'+esc(s.phoneFaxEn)+'</span><span dir="rtl">'+esc(s.phoneFaxAr)+'</span></div>';return '<div class="page-container raise-letter-page">'+head+'<div class="raise-to">'+esc(s.recipient)+' &nbsp;&nbsp; '+esc(s.recipientSuffix)+'</div><div class="raise-title">خطاب رفع مستخلص الموقع</div><div class="raise-body">'+body+'</div>'+table+'<div class="raise-body">لذا نأمل بعد الاطلاع إحالته إلى جهة الاختصاص لتدقيقه واستكمال إجراءات صرف مستحقات المقاول.<br>وتقبلوا تحياتنا ،،،</div>'+sigs+footer+'</div>';}

  function printCss(){return '<style>@page{size:A4}@page landscape{size:A4 landscape;margin:3mm}@page portrait{size:A4 portrait;margin:7mm}@page raise-letter-page{size:A4 portrait;margin:12mm}html,body{width:auto!important;min-height:auto!important;margin:0!important;padding:0!important}*{box-sizing:border-box}body{font-family:Tajawal,Arial,sans-serif;direction:rtl;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}.page-container{break-after:page;page-break-after:always;page-break-inside:avoid;display:block;width:100%!important;overflow:visible!important}.page-container:last-child{break-after:auto;page-break-after:auto}.landscape-page{page:landscape;transform:scale(.92);transform-origin:top center;width:108.5%!important}.portrait-page-perf,.portrait-page-ach{page:portrait}.raise-letter-page{page:raise-letter-page!important;position:relative;min-height:270mm;padding:8mm 10mm}@media print{html,body{width:297mm!important;min-height:210mm!important}.landscape-page{page:landscape;transform:scale(.92);transform-origin:top center;width:108.5%!important;min-height:auto!important}}.printable-header{display:flex;justify-content:space-between;align-items:center;padding-bottom:2px;margin-bottom:3px;border-bottom:1px solid #ccc}.printable-header .logo{width:40px;height:auto}.printable-header .header-text{text-align:center;flex:1}.printable-header h1,.printable-header h2,.printable-header h3{margin:1px 0;line-height:1.05}.printable-header h1{font-size:9pt}.printable-header h3{font-size:8pt;font-weight:500}.printable-header h2{font-size:9pt}.page-contract-info-v2,.page-contract-info{font-size:6pt;text-align:center;margin-bottom:3px;padding:2px 4px;border:1px solid #ccc;border-radius:5px;line-height:1.1}.extract-details-v2{font-size:7pt;padding:3px 5px;background:#003087!important;color:#fff!important;border-radius:5px 5px 0 0;display:flex;justify-content:space-between;gap:5px;line-height:1.1}.table-responsive-wrapper{overflow:visible!important;width:100%!important;max-width:100%!important}.attendance-report table{width:100%!important;max-width:100%!important;border-collapse:collapse;table-layout:fixed;margin-top:2px}.attendance-report th,.attendance-report td{border:1px solid #555;padding:1px;text-align:center;font-size:6.2pt;line-height:1.05;vertical-align:middle;word-break:break-word;overflow:hidden}.attendance-report th{background:#003087!important;color:#fff!important;font-size:6.4pt;font-weight:700}.attendance-report table th:first-child,.attendance-report table td:first-child,.attendance-report .seq-col{width:1.5%!important}.attendance-report .job-title,.attendance-report table th:nth-child(2),.attendance-report table td:nth-child(2){width:9%!important;font-size:6.4pt!important;white-space:normal!important}.attendance-report .category-col,.attendance-report table th:nth-child(3),.attendance-report table td:nth-child(3){width:2.4%!important;white-space:nowrap!important}.attendance-report .employee-name,.attendance-report table th:nth-child(4),.attendance-report table td:nth-child(4){width:9.5%!important;font-size:6.4pt!important;white-space:normal!important}.attendance-report .day-col,.attendance-report table th:nth-child(n+5):nth-child(-n+35),.attendance-report table td:nth-child(n+5):nth-child(-n+35){width:1.25%!important;min-width:1.25%!important;max-width:1.25%!important;padding:1px 0!important;font-size:5.7pt!important;line-height:1!important;white-space:nowrap!important;word-break:normal!important}.attendance-report table th:nth-last-child(-n+9),.attendance-report table td:nth-last-child(-n+9){font-size:5.7pt!important;white-space:nowrap!important}.attendance-report .cost-col,.attendance-report .net-col{width:4.5%!important;font-size:5.8pt!important;white-space:nowrap!important}.attendance-report .days-count-col,.attendance-report .deduction-col,.attendance-report .fine-col{width:3.2%!important;font-size:5.8pt!important;white-space:nowrap!important}.attendance-report .nationality-col{width:3.8%!important;font-size:5.8pt!important;white-space:normal!important}.attendance-report .iqama-col{width:5.8%!important;font-size:5.6pt!important;white-space:nowrap!important}.attendance-report select,.attendance-report input,.attendance-report span{max-width:100%!important;font-size:inherit!important;line-height:inherit!important}.table-summary-v2{font-size:6pt;padding:2px;display:flex;flex-wrap:wrap;justify-content:center;gap:4px;border:1px solid #ccc;background:#f8f9fa;font-weight:bold;line-height:1.05}.signatures-grid,.signatures{display:flex;justify-content:space-around;margin-top:4px;padding-top:4px;border-top:1px solid #ccc}.signature-item{text-align:center;font-size:7pt;min-width:110px}.signature-item .title{font-weight:bold}.signature-item .line{border-bottom:1px solid #000;min-height:10px;margin-top:8px}.header-table{width:100%;border-bottom:2px solid #0056b3;margin-bottom:15px}.header-table td{text-align:center}.header-table .logo{width:75px}.performance-report .cert-title{font-size:15pt;font-weight:bold;text-align:center;margin:8px 0}.performance-report .sub-title{text-align:center;margin:4px 0}.performance-report .cost-bar{background:#f2f2f2;padding:6px;border-radius:4px;text-align:center;font-weight:bold;margin:8px 0}.performance-report table,.achievement-report table{width:100%;border-collapse:collapse;table-layout:fixed}.performance-report th,.performance-report td,.achievement-report th,.achievement-report td{border:1px solid #333;padding:4px;text-align:center}.performance-report th,.achievement-report th{background:#e9ecef}.performance-report .item-text{text-align:right}.performance-report .total-row,.achievement-report .total-row{font-weight:bold;background:#f0f0f0!important}.performance-report .summary{text-align:center;margin:8px 0;font-weight:bold}.performance-report .sign-box,.achievement-report .sign-box{ text-align:center;font-size:10pt;width:24%}.performance-report .sign-box .line,.achievement-report .sign-box .line{border-bottom:1px solid #000;margin-top:30px}.achievement-report .certificate-header{text-align:center;margin-bottom:20px}.achievement-report .tafqeet-cell{font-weight:bold;background:#f0f0f0}.raise-head{display:grid;grid-template-columns:78px 1fr 78px;align-items:center;border-bottom:2px solid #003087;padding-bottom:8px;margin-bottom:18px}.raise-head img{width:68px}.raise-head div{text-align:center}.raise-head h1{font-size:17px;margin:0 0 4px;color:#003087}.raise-head h2{font-size:15px;margin:0}.raise-to{font-size:15px;font-weight:900;margin:18px 0 12px}.raise-title{text-align:center;font-size:19px;font-weight:900;color:#003087;margin:20px 0}.raise-body{font-size:15px;line-height:2.05;text-align:justify}.raise-amount-table{width:100%;border-collapse:collapse;margin:16px 0;font-size:14px}.raise-amount-table td{border:1px solid #333;padding:8px}.raise-amount-table td:first-child{text-align:right;font-weight:800;width:72%}.raise-amount-table td:last-child{text-align:center;font-weight:900;direction:ltr}.raise-amount-table .grand td{background:#fff7d6}.raise-footer{position:absolute;bottom:4mm;left:10mm;right:10mm;border-top:1px solid #cbd5e1;padding-top:5px;font-size:11px;display:flex;justify-content:space-between;direction:ltr}</style>';}

  function cleanDialogLayers(){try{if(typeof window.closeDialog==='function')window.closeDialog('management-dialog')}catch(_){}document.querySelectorAll('#management-dialog').forEach(function(el){el.remove();});}
  function openPrintDialog(){cleanDialogLayers();var names=officeNames(),html='';Object.keys(names).forEach(function(key){html+='<div class="form-group-checkbox"><input type="checkbox" class="center-checkbox" value="'+esc(key)+'" id="print-'+esc(key)+'" checked><label for="print-'+esc(key)+'">'+esc(names[key])+'</label></div>';});var content='<div class="dialog-header"><h3><i class="fas fa-print"></i> طباعة التقارير المجمعة</h3><span class="close" onclick="closeDialog(\'management-dialog\')">×</span></div><div class="dialog-body"><fieldset><legend>1. اختر المكاتب والمرافق</legend><div class="form-group-checkbox all-selector"><input type="checkbox" onchange="toggleAllCheckboxes(this, \'print-centers-checkboxes\')" id="print-all-centers" checked><label for="print-all-centers"><strong>تحديد الكل / إلغاء تحديد الكل</strong></label></div><div id="print-centers-checkboxes" class="checkbox-grid">'+html+'</div></fieldset><fieldset><legend>2. اختر التقارير للطباعة</legend><div class="checkbox-grid"><div class="form-group-checkbox"><input type="checkbox" id="print-opt-attendance" checked><label for="print-opt-attendance">تقرير الحضور والانصراف</label></div><div class="form-group-checkbox"><input type="checkbox" id="print-opt-performance" checked><label for="print-opt-performance">شهادة تقييم الأداء</label></div><div class="form-group-checkbox"><input type="checkbox" id="print-opt-achievement" checked><label for="print-opt-achievement">شهادة الإنجاز</label></div><div class="form-group-checkbox"><input type="checkbox" id="print-opt-site-raise-letter"><label for="print-opt-site-raise-letter">خطاب رفع الموقع</label></div></div></fieldset></div><div class="dialog-footer"><div></div><button class="btn btn-success" onclick="printSelected()"><i class="fas fa-print"></i> بدء الطباعة</button></div>';if(typeof window.openDialog==='function')window.openDialog(content,'management-dialog',true);else alert('openDialog غير موجودة');}
  function selectedKeys(){return Array.from(document.querySelectorAll('#print-centers-checkboxes input:checked')).map(function(cb){return cb.value;});}
  function checked(id){return !!document.getElementById(id)?.checked;}
  function printSelected(){var keys=selectedKeys(),opts={attendance:checked('print-opt-attendance'),performance:checked('print-opt-performance'),achievement:checked('print-opt-achievement'),siteLetter:checked('print-opt-site-raise-letter')};if(!keys.length||(!opts.attendance&&!opts.performance&&!opts.achievement&&!opts.siteLetter)){alert('الرجاء اختيار مكتب/مرفق وتقرير واحد على الأقل للطباعة.');return;}cleanDialogLayers();var w=window.open('','_blank','width=1200,height=900');if(!w)return alert('المتصفح منع فتح نافذة الطباعة.');var doc=w.document;doc.open();doc.write('<html><head><title>طباعة التقارير المجمعة</title><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">'+printCss()+'</head><body>');keys.forEach(function(key){if(opts.attendance)doc.write(attendancePage(key));if(opts.performance)doc.write(performancePage(key));if(opts.achievement)doc.write(achievementPage(key));if(opts.siteLetter)doc.write(siteRaiseLetterPage(key));});doc.write('</body></html>');doc.close();w.onload=function(){w.focus();w.print();w.close();};}
  function detectCurrentKey(){var visible=Array.from(document.querySelectorAll('[id^="table-div-"]')).find(function(el){var r=el.getBoundingClientRect();return r.width>0&&r.height>0;});if(visible&&visible.id)return visible.id.replace('table-div-','');var title=(document.getElementById('center-main-title')?.textContent||'').trim(),names=officeNames();return Object.keys(names).find(function(k){return names[k]&&title.indexOf(names[k])!==-1;})||null;}
  function preparePrint(){var key=detectCurrentKey();if(!key)return alert('لم يتم تحديد المكتب الحالي للطباعة.');var w=window.open('','_blank','width=1200,height=900');if(!w)return alert('المتصفح منع فتح نافذة الطباعة.');w.document.open();w.document.write('<html><head><title>طباعة تقرير الحضور</title><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">'+printCss()+'</head><body>'+attendancePage(key)+'</body></html>');w.document.close();w.onload=function(){w.focus();w.print();w.close();};}

  window.openPrintDialog=openPrintDialog;
  window.printSelected=printSelected;
  window.preparePrint=preparePrint;
  console.info('[Admin Offices Print All] consolidated print flow v4 attendance layout + real performance items');
})();