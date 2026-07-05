/* admin_offices_review_detail_patch.js — v4 period-safe admin offices review preview */
(function(){
  'use strict';
  if (window.__ADMIN_OFFICES_REVIEW_DETAIL_PATCH_V4__) return;
  window.__ADMIN_OFFICES_REVIEW_DETAIL_PATCH_V4__ = true;
  if (!/(approval|review_extract)\.html/.test(location.pathname + location.search)) return;

  var FINES = {
    1:{saudi:500,non_saudi:500}, 2:{saudi:500,non_saudi:500}, 3:{saudi:250,non_saudi:100},
    4:{saudi:180,non_saudi:80}, 5:{saudi:150,non_saudi:80}, 6:{saudi:20,non_saudi:20},
    7:{saudi:10,non_saudi:10}, default:{saudi:0,non_saudi:0}
  };

  function p(v,f){ if(v==null)return f; if(typeof v==='object')return v; try{return JSON.parse(String(v));}catch(_){return f;} }
  function h(v){ return String(v==null?'':v).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];}); }
  function n(v){ var x=Number(String(v==null?0:v).replace(/,/g,'').replace(/[^0-9.\-]/g,'')); return isFinite(x)?x:0; }
  function money(x){ return Number(x||0).toLocaleString('ar-SA',{style:'currency',currency:'SAR'}); }
  function plain(x){ return Number(x||0).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})+' ر.س'; }
  function ok(v){ if(v==null)return false; if(Array.isArray(v))return v.length>0; if(typeof v==='object')return Object.keys(v).length>0; var s=String(v).trim(); return !!s&&s!=='{}'&&s!=='[]'&&s!=='0'; }
  function rows(o){ if(Array.isArray(o))return o.length; if(o&&typeof o==='object')return Object.keys(o).reduce(function(s,k){return s+(Array.isArray(o[k])?o[k].length:0);},0); return 0; }
  function sigs(d){ return Object.keys(d||{}).filter(function(k){return /^sb_(sigs|prefs)_/.test(k)||/^healthCenters_Signatures_/.test(k)||k==='signatures_data_consumables_v27';}).length; }
  function val(r,k){ return r&&(r[k]!=null?r[k]:''); }
  function stat(a,b,c){return '<div class="rv-stat '+(c||'')+'"><span>'+h(a)+'</span><b>'+h(b)+'</b></div>';}
  function decisionSection(e){
    return '<section id="rv-decision" class="rv-no-print"><h3>قرار المراجع</h3><textarea id="rv-notes" placeholder="اكتب الملاحظة هنا عند طلب التعديل أو الرفض. الاعتماد لا يحتاج ملاحظة.">'+h(e.adminNotes||'')+'</textarea><div class="rv-actions"><button class="rv-act review" data-rv-status="under_review">بدء المراجعة</button><button class="rv-act revision" data-rv-status="needs_revision">طلب تعديل</button><button class="rv-act approve" data-rv-status="approved">اعتماد</button><button class="rv-act reject" data-rv-status="rejected">رفض</button></div></section>';
  }
  function getExtract(id){ try { return (allExtracts||[]).find(function(x){return String(x.id)===String(id);}); } catch(_) { return null; } }

  // مستخلص المكاتب الإدارية له جزآن منفصلان تمامًا (عمالة / مستهلكات)، وكل
  // مستخلص فعلي يحمل واحدًا منهما فقط. قبل هذا الإصلاح كان العرض يفترض دائمًا
  // "عمالة" حتى لو المستخلص الحقيقي "مستهلكات" — فتظهر "0 مكاتب" رغم أن
  // البيانات الحقيقية (جداول المستهلكات) موجودة لكن تحت مفاتيح مختلفة تمامًا.
  function adminOfficesPart(e, d){
    var part = String(e && e.adminOfficePart || '').trim();
    if (part === 'labor' || part === 'consumables') return part;
    var scope = String(e && e.reviewScope || d.reviewScope || '').trim();
    var src = String(e && e.sourceModule || d.sourceModule || '').trim();
    if (scope === 'admin_offices_consumables_only' || src === 'admin_offices_consumables') return 'consumables';
    if (scope === 'admin_offices_labor_only' || src === 'admin_offices_attendance') return 'labor';
    // سجلات قديمة بلا أي مؤشر: نفترض عمالة كما كان السلوك الأصلي قبل الإصلاح.
    return 'labor';
  }

  function data(e){
    var d=p(e&&e.extractData,{}), b=p(d.__submittedExtractArchiveBundle_v1,{}), t=p(b.trackedKeyCopies,{});
    Object.keys(t||{}).forEach(function(k){ if(d[k]===undefined)d[k]=t[k]; });
    return d;
  }

  function parseDate(v){ var d=new Date(v||''); return isNaN(d.getTime())?null:d; }
  function periodInfo(e,d){
    var meta=p(d.persistentExtractData,{});
    var start=parseDate(meta.extractStart||d.extractStart||e.extractStart||e.fromDate||e.startDate);
    var end=parseDate(meta.extractEnd||d.extractEnd||e.extractEnd||e.toDate||e.endDate||meta.extractStart||d.extractStart);
    if(!start) start=new Date();
    if(!end) end=start;
    var days=Math.max(1,Math.ceil((end-start)/86400000)+1||30);
    var monthDays=new Date(start.getFullYear(),start.getMonth()+1,0).getDate()||30;
    return {start:start,end:end,daysInExtract:days,totalDaysInMonth:monthDays};
  }
  function fmtDate(d){ try{return d?d.toLocaleDateString('en-CA'):'—';}catch(_){return '—';} }
  function isSaudi(v){ var s=String(v||'').replace(/ى/g,'ي').replace(/\s+/g,''); return s.indexOf('سعودي')>-1 && s.indexOf('غيرسعودي')===-1; }
  function fineCfg(cat){ return FINES[cat]||FINES[String(cat)]||FINES.default; }
  function statusKind(code){
    code=String(code||'ح').trim();
    if(code==='غ•') return 'free';
    if(code==='غ') return 'absence';
    if(code==='ح'||code==='ت') return 'attendance';
    return 'deductionOnly';
  }
  function salary(r){ return n(val(r,'salary'))||n(val(r,'monthlySalary'))||n(val(r,'contractValue'))||0; }
  function empName(r){ return val(r,'name')||val(r,'employeeName')||val(r,'workerName')||val(r,'empName')||'—'; }
  function empJob(r){ return val(r,'position')||val(r,'jobTitle')||val(r,'job')||val(r,'title')||'—'; }
  function empNat(r){ return val(r,'nationality')||'—'; }

  function calcEmp(r,period,contract){
    var days=Array.isArray(r&&r.days)?r.days.slice(0,period.daysInExtract):[];
    while(days.length<period.daysInExtract) days.push('ح');
    var base=salary(r);
    var daily=period.totalDaysInMonth>0?base/period.totalDaysInMonth:0;
    var cost=daily*period.daysInExtract;
    var ratio=n(contract&&contract.directPurchaseRatio);
    if(contract&&contract.contractType==='شراء مباشر'&&ratio>0) cost+=cost*ratio/100;
    if(!base){ cost=n(val(r,'costForPeriod'))||n(val(r,'periodCost'))||cost; daily=period.daysInExtract>0?cost/period.daysInExtract:0; }
    var attend=0,abs=0,dedOnly=0,vacant=0;
    days.forEach(function(code){
      if(code==='ش') vacant++;
      var k=statusKind(code);
      if(k==='attendance') attend++;
      else if(k==='absence') abs++;
      else if(k==='deductionOnly') dedOnly++;
    });
    var deduction=(abs+dedOnly)*daily;
    var cfg=fineCfg(r&&r.category||1);
    var absFine=abs*(isSaudi(empNat(r))?cfg.saudi:cfg.non_saudi);
    var natFine=n(val(r,'nationalityFine'));
    var totalFine=absFine+natFine;
    var net=cost-deduction-totalFine;
    return {days:days,cost:cost,attendance:attend,absence:abs,deductionOnly:dedOnly,vacant:vacant,deduction:deduction,absenceFine:absFine,nationalityFine:natFine,totalFine:totalFine,net:net};
  }

  function build(e){
    var d=data(e), bundle=p(d.__submittedExtractArchiveBundle_v1,{}), integrity=p(bundle.integrity,{});
    var part = adminOfficesPart(e, d);
    var meta=p(d.persistentExtractData,{}), contract=p(d.persistentContractData,{}), period=periodInfo(e,d);
    var pay=meta.paymentNumber||meta.extractNumber||d.paymentNumber||e.paymentNumber||'—';
    var periodLabel=e.periodMonth||[meta.extractMonth||d.extractMonth||'',meta.extractYear||d.extractYear||''].filter(Boolean).join(' ')||'—';
    var sg=sigs(d)||Number(integrity.signatureKeysCount||0)||0;
    var header='<header class=\"rv-doc-head\"><div><h2>مستخلص المكاتب الإدارية — '+(part==='consumables'?'مستهلكات':'عمالة')+'</h2><p>'+h(e.hospitalName||e.submittedByHospital||'—')+' — '+h(e.companyName||'—')+' — '+h(periodLabel)+' — دفعة '+h(pay)+'</p><small>الفترة المحسوبة: '+h(fmtDate(period.start))+' إلى '+h(fmtDate(period.end))+' — عدد أيام المستخلص: '+period.daysInExtract+'</small></div><b>'+h(e.status||'—')+'</b></header>';

    if (part === 'consumables') {
      // جزء المستهلكات: البيانات الحقيقية في جداول المستهلكات (نفس مفاتيح
      // مستخلص المستهلكات العادي) — إعادة استخدام العارض الجاهز والمُختبَر
      // بدل جدول عمالة فاضٍ لا معنى له لهذا النوع.
      var sections = window.__najranReviewLaborSections || null;
      var consHtml = '<div class=\"rv-empty\" style=\"padding:12px\">تعذّر تحميل عارض جداول المستهلكات (تحقق من نسخة review-workflow.js).</div>';
      if (sections && sections.consumablesHtml && sections.snap) {
        try { consHtml = sections.consumablesHtml(sections.snap(e)) || consHtml; }
        catch (err) { console.warn('[AdminOfficesReviewDetailPatch] consumables render skipped', err); }
      }
      return '<div class=\"rv-doc\" data-admin-offices-review=\"1\">'+header+
        '<nav class=\"rv-tabs\"><a href=\"#rv-summary\" class=\"rv-nav-card\"><b>ملخص المراجعة</b><span>بيانات المستخلص</span></a><a href=\"#rv-cons\" class=\"rv-nav-card\"><b>المستهلكات</b><span>الملخص والجداول</span></a></nav>'+
        '<section id=\"rv-summary\"><h3>ملخص المراجعة</h3><div class=\"rv-main-stats\">'+stat('نوع المستخلص','مستهلكات المكاتب الإدارية','primary')+stat('رقم الدفعة',pay,'primary')+stat('أيام المستخلص',period.daysInExtract,'primary')+stat('قيمة الكارت',money(e.totalAmount||0),'ok')+'</div><div class=\"rv-info-grid\"><div><b>التواقيع</b><span>'+(sg?sg+' مفتاح':'غير ظاهرة')+'</span></div><div><b>مصدر المراجعة</b><span>'+h(d.__najranSourceModule||d.sourceModule||'—')+'</span></div></div></section>'+
        '<section id=\"rv-cons\" class=\"rv-section-break\"><h3>مراجعة مستهلكات المكاتب الإدارية</h3>'+consHtml+'</section>'+
        decisionSection(e)+'</div>';
    }

    var names=p(d.adminOfficeNames_v1,{}), att=p(d.adminOfficesAttendanceData_v1||d.adminOfficesAttendanceData_v1_localBackup||d.adminOfficesLaborDataSafe_v2||d.adminOfficesAttendanceData,{});
    (function laborDiagnostics() {
      try {
        var allKeys = Object.keys(d || {});
        var namesRaw = d.adminOfficeNames_v1, attRaw = d.adminOfficesAttendanceData_v1;
        console.info('[AdminOfficesReviewDetailPatch][diagnostic] extractId=' + e.id + ' part=labor', {
          adminOfficeNames_v1_present: namesRaw != null,
          adminOfficeNames_v1_officeCount: Object.keys(names || {}).length,
          adminOfficesAttendanceData_v1_present: attRaw != null,
          adminOfficesAttendanceData_v1_officeCount: Object.keys(att || {}).length,
          allExtractDataKeysCount: allKeys.length,
          allExtractDataKeys: allKeys
        });
        if (!Object.keys(names || {}).length && !Object.keys(att || {}).length) {
          console.warn('[AdminOfficesReviewDetailPatch][diagnostic] extractData لا يحتوي أي مكاتب/عمالة على الإطلاق — البيانات لم تُحفظ أصلًا وقت الرفع (مشكلة تجميع بيانات، مش مشكلة عرض). هذا المستخلص يحتاج إعادة رفع بعد التأكد أن المتصفح محدَّث، لا إصلاح عرض.');
        }
      } catch (diagErr) { console.warn('[AdminOfficesReviewDetailPatch][diagnostic] فشل التشخيص', diagErr); }
    })();
    var perf=p(d.adminOfficePerformanceDeductions_v1||d.performanceDeductions||d.performanceData_v4||d.performanceData,{}), ach=p(d.achievementData||d.achievementTitles_v1||d.achievementItemNames,{}), off={};
    var meta=p(d.persistentExtractData,{}), contract=p(d.persistentContractData,{}), period=periodInfo(e,d);
    Object.keys(names||{}).forEach(function(k){off[k]=names[k]||k;}); Object.keys(att||{}).forEach(function(k){if(!off[k])off[k]=names[k]||k;});
    var keys=Object.keys(off), emp=rows(att)||Number(integrity.adminOfficesEmployees||0)||0, sg=sigs(d)||Number(integrity.signatureKeysCount||0)||0;
    var pay=meta.paymentNumber||meta.extractNumber||d.paymentNumber||e.paymentNumber||'—';
    var periodLabel=e.periodMonth||[meta.extractMonth||d.extractMonth||'',meta.extractYear||d.extractYear||''].filter(Boolean).join(' ')||'—';
    var totals={m:0,d:0,n:0,f:0,v:0};

    function empTable(arr){
      if(!arr.length) return '<div class="rv-empty" style="padding:12px">لا يوجد موظفون مسجلون في هذا المكتب داخل اللقطة.</div>';
      var body=arr.map(function(r,j){ var c=calcEmp(r,period,contract); return '<tr><td>'+(j+1)+'</td><td style="text-align:right;font-weight:800">'+h(empName(r))+'</td><td>'+h(empJob(r))+'</td><td>'+h(empNat(r))+'</td><td>'+c.vacant+'</td><td>'+c.absence+'</td><td>'+plain(c.cost)+'</td><td>'+plain(c.deduction+c.totalFine)+'</td><td><b>'+plain(c.net)+'</b></td></tr>'; }).join('');
      return '<div class="rv-scroll"><table class="rv-table generic rv-emp-table"><thead><tr><th>م</th><th>الاسم</th><th>الوظيفة</th><th>الجنسية</th><th>شاغر</th><th>غياب</th><th>تكلفة الفترة</th><th>الحسم/الغرامة</th><th>الصافي</th></tr></thead><tbody>'+body+'</tbody></table></div>';
    }

    var tr=keys.map(function(k,i){
      var arr=Array.isArray(att[k])?att[k]:[], m=0, dd=0, nn=0, ff=0, vv=0;
      arr.forEach(function(r){ var c=calcEmp(r,period,contract); m+=c.cost; dd+=c.deduction+c.totalFine; nn+=c.net; ff+=c.totalFine; vv+=c.vacant; });
      totals.m+=m; totals.d+=dd; totals.n+=nn; totals.f+=ff; totals.v+=vv;
      var head='<tr class="rv-off-row" data-rv-off="'+i+'" style="cursor:pointer" title="اضغط لعرض عمالة المكتب"><td>'+(i+1)+'</td><td style="text-align:right;font-weight:900"><span class="rv-off-caret" style="display:inline-block;margin-left:6px;color:#1e3c72;transition:transform .18s">▼</span>'+h(off[k]||k)+'</td><td>'+arr.length+'</td><td>'+(arr.length?'✓':'—')+'</td><td>'+(ok(perf)?'✓':'—')+'</td><td>'+(ok(ach)?'✓':'محسوب')+'</td><td>'+plain(m)+'</td><td>'+plain(dd)+'</td><td><b>'+plain(nn)+'</b></td></tr>';
      var detail='<tr class="rv-off-emp" data-rv-off-emp="'+i+'" style="display:none"><td colspan="9" style="background:#f8fafc;padding:10px 12px">'+empTable(arr)+'</td></tr>';
      return head+detail;
    }).join('');
    if(!tr)tr='<tr><td colspan="9" class="rv-empty">لا توجد أسماء مكاتب أو بيانات حضور داخل snapshot المرفوع.</td></tr>';

    return '<div class="rv-doc" data-admin-offices-review="1"><header class="rv-doc-head"><div><h2>مستخلص المكاتب الإدارية</h2><p>'+h(e.hospitalName||e.submittedByHospital||'—')+' — '+h(e.companyName||'—')+' — '+h(periodLabel)+' — دفعة '+h(pay)+'</p><small>الفترة المحسوبة: '+h(fmtDate(period.start))+' إلى '+h(fmtDate(period.end))+' — عدد أيام المستخلص: '+period.daysInExtract+'</small></div><b>'+h(e.status||'—')+'</b></header><nav class="rv-tabs"><a href="#rv-summary" class="rv-nav-card"><b>ملخص المراجعة</b><span>بيانات المستخلص</span></a><a href="#rv-admin" class="rv-nav-card"><b>المكاتب</b><span>'+keys.length+' مكتب</span></a><a href="#rv-ach" class="rv-nav-card"><b>الإنجاز</b><span>جدول الاستحقاق</span></a></nav><section id="rv-summary"><h3>ملخص المراجعة</h3><div class="rv-main-stats">'+stat('نوع المستخلص','مستخلص المكاتب الإدارية','primary')+stat('رقم الدفعة',pay,'primary')+stat('أيام المستخلص',period.daysInExtract,'primary')+stat('قيمة الكارت',money(e.totalAmount||0),'ok')+'</div><div class="rv-info-grid"><div><b>عدد المكاتب</b><span>'+keys.length+'</span></div><div><b>عدد الموظفين</b><span>'+emp+'</span></div><div><b>الشواغر المحتسبة</b><span>'+totals.v+'</span></div><div><b>الأداء</b><span>'+(ok(perf)?'موجود':'غير ظاهر')+'</span></div><div><b>التواقيع</b><span>'+(sg?sg+' مفتاح':'غير ظاهرة')+'</span></div><div><b>مصدر المراجعة</b><span>'+h(d.__najranSourceModule||d.sourceModule||'—')+'</span></div></div></section><section id="rv-admin" class="rv-section-break"><h3>تفاصيل مستخلص المكاتب</h3><div class="rv-block rv-print-block"><div class="rv-block-title"><h4>ملخص المكاتب الإدارية والمرافق</h4><span>'+keys.length+' مكتب / مرفق</span></div><div class="rv-scroll"><table class="rv-table generic"><thead><tr><th>م</th><th>المكتب / المرفق</th><th>الموظفون</th><th>الحضور</th><th>الأداء</th><th>الإنجاز</th><th>قيمة الفترة</th><th>الحسم/الغرامة</th><th>الصافي</th></tr></thead><tbody>'+tr+'</tbody></table></div></div></section><section id="rv-ach" class="rv-section-break"><h3>شهادة الإنجاز</h3><div class="rv-main-stats">'+stat('قيمة الفترة',money(totals.m),'primary')+stat('إجمالي الحسم/الغرامات',money(totals.d),totals.d>0?'warn':'ok')+stat('الصافي',money(totals.n),'ok')+stat('عدد أيام المستخلص',period.daysInExtract,'primary')+'</div></section><section id="rv-decision" class="rv-no-print"><h3>قرار المراجع</h3><textarea id="rv-notes" placeholder="اكتب الملاحظة هنا عند طلب التعديل أو الرفض. الاعتماد لا يحتاج ملاحظة.">'+h(e.adminNotes||'')+'</textarea><div class="rv-actions"><button class="rv-act review" data-rv-status="under_review">بدء المراجعة</button><button class="rv-act revision" data-rv-status="needs_revision">طلب تعديل</button><button class="rv-act approve" data-rv-status="approved">اعتماد</button><button class="rv-act reject" data-rv-status="rejected">رفض</button></div></section></div>';
  }

  function bindActions(b,id,e){ b.querySelectorAll('[data-rv-status]').forEach(function(btn){ btn.onclick=function(){ var st=btn.getAttribute('data-rv-status'),notes=document.getElementById('rv-notes'),note=notes?notes.value.trim():''; if((st==='needs_revision'||st==='rejected')&&!note){alert('اكتب الملاحظة أولاً');return;} var hidden=document.getElementById('notes-'+id); if(!hidden){hidden=document.createElement('textarea');hidden.id='notes-'+id;hidden.style.display='none';document.body.appendChild(hidden);} hidden.value=note; if(typeof window.rvClose==='function')window.rvClose(); if(typeof window.updateStatus==='function')window.updateStatus(id,st); }; }); }
  function bindOfficeToggles(b){ b.querySelectorAll('.rv-off-row').forEach(function(row){ row.onclick=function(ev){ try{ if(ev){ ev.preventDefault(); ev.stopPropagation(); } }catch(_){} var i=row.getAttribute('data-rv-off'); var det=b.querySelector('[data-rv-off-emp="'+i+'"]'); if(!det)return; var open=det.style.display!=='none'; det.style.display=open?'none':'table-row'; var caret=row.querySelector('.rv-off-caret'); if(caret)caret.style.transform=open?'':'rotate(180deg)'; }; }); }
  function renderStable(id,e){ var body=document.getElementById('rv-body'); if(!body)return false; body.innerHTML=build(e); bindActions(body,id,e); bindOfficeToggles(body); body.setAttribute('data-admin-offices-review-id',String(id)); body.setAttribute('data-admin-offices-review-locked','1'); return true; }
  function keepPreviewAlive(id,e){ var tries=0,max=35; (function ensure(){ tries++; var body=document.getElementById('rv-body'); if(!body){ if(tries<max)setTimeout(ensure,180); return; } var hasStable=!!body.querySelector('[data-admin-offices-review="1"]'); var text=(body.textContent||'').replace(/\s+/g,' '); var overwritten=!hasStable&&(/لا\s+(توجد|تتوفر).*معاينة|لا\s+توجد\s+بيانات/i.test(text)||body.children.length===0); if(!hasStable||overwritten)renderStable(id,e); if(tries<max)setTimeout(ensure,180); })(); }
  function patch(){ if(typeof window.rvOpenExtract!=='function')return false; if(window.rvOpenExtract.__adminOfficeReviewDetailPatchV4)return true; var old=window.rvOpenExtract; window.rvOpenExtract=function(id){ var e=getExtract(id); if(!e||String(e.extractType)!=='admin_offices')return old.apply(this,arguments); old.apply(this,arguments); keepPreviewAlive(id,e); }; window.rvOpenExtract.__adminOfficeReviewDetailPatchV4=true; console.info('[AdminOfficesReviewDetailPatch] installed v4 period-safe per-office employees expand'); return true; }
  var i=0;(function retry(){i++; if(!patch()&&i<80)setTimeout(retry,200);})();
})();