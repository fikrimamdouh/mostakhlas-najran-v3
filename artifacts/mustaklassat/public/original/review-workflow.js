/* review workflow - detailed review is loaded by extract id from API */
(function(){
  'use strict';
  if(!/\/original\/approval\.html(?:$|[?#])/.test(location.pathname + location.search)) return;

  var TYPES={labor:'مستخلص العمالة',consumables:'مستخلص المستهلكات',spare_parts:'مستخلص قطع الغيار',health_centers:'مستخلص المراكز الصحية',admin_offices:'مستخلص المكاتب الإدارية'};
  var STAT={submitted:'بانتظار المراجعة',under_review:'قيد المراجعة',needs_revision:'يحتاج تعديل',approved:'معتمد',rejected:'مرفوض'};
  var LABOR_DEPTS=[
    {key:'cleaning', label:'ح غ 1 - النظافة', aliases:['cleaning','clean','hygiene','النظافة']},
    {key:'electricity', label:'ح غ 2 - الكهرباء', aliases:['electricity','electrical','electric','الكهرباء']},
    {key:'agriculture', label:'ح غ 3 - الزراعة', aliases:['agriculture','agri','landscape','الزراعة']},
    {key:'civil', label:'ح غ 4 - المدني', aliases:['civil','civil-works','civil_works','civilworks','المدني']},
    {key:'mechanics', label:'ح غ 5 - الميكانيكا', aliases:['mechanics','mechanical','mechanic','الميكانيكا']},
    {key:'laundry', label:'ح غ 7 - المغسلة', aliases:['laundry','laundary','المغسلة']},
    {key:'security', label:'ح غ 6 - الأمن', aliases:['security','guards','guard','الأمن']},
    {key:'admin_saudi', label:'الوظائف الإدارية السعوديين', aliases:['admin-saudi','admin_saudi','saudi-admin','administrative_saudi','admin','الإدارية','السعوديين']}
  ];
  var PERFORMANCE_DEPTS=LABOR_DEPTS.slice(0,7);
  var PERF_ITEMS=[
    ['مدى نظافة المبنى من الداخل والخارج وكذلك السطح',5],['مدى نظافة العيادات والصيدلية والمختبر',5],['مدى نظافة الممرات',5],['مدى نظافة الأثاث والمفروشات',4],['مدى نظافة دورات المياه',5],['مدى مكافحة الحشرات والتخلص من النفايات غير الطبية',4],['مدى صيانة شبكة الكهرباء واستبدال الأجزاء التالفة',4],['مدى كفاءة الإنارة وتغيير التالف من اللمبات والبرايز والمفاتيح',4],['مدى المرور والصيانة لفريق الصيانة',5],['مدى صيانة الأجهزة الكهربائية',4],['مدى صيانة المكيفات والثلاجات والبردات والسخانات',5],['مدى تنظيف خزانات المياه العلوية والسفلية كل ثلاث شهور',5],['مدى تسليك مواسير الصرف الصحي وكسح المجاري',3],['مدى إصلاح المغاسل والسيفونات والمحابس والحنفيات',4],['مدى إصلاح الطلمبات وشبكة المياه',4],['مدى أداء الصيانة العامة للمبنى',4],['مدى صيانة الأثاث',4],['مدى صيانة وتعبئة وسائل مكافحة الحريق وأجهزة كشف الدخان',3],['مدى صيانة آلات التصوير والآلات الكاتبة',5],['مدى توفير قطع الغيار ومستهلكات الصيانة',5],['مدى توفير أدوات النظافة',4],['مدى ارتداء العاملين للزي الرسمي وحمل بطاقات الهوية وتوفير الشهادات الصحية',4],['مدى إصلاح المصاعد',5]
  ];

  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];});}
  function parse(x){if(!x)return{}; if(typeof x==='object')return x; try{return JSON.parse(x);}catch(e){return{};}}
  function norm(k){return String(k||'').replace(/^(?:_u\d+_)+/,'').trim();}
  function raw(e){return parse(e && e.extractData);}
  function snap(e){var d=raw(e); return d.localStorageSnapshot || d.storageSnapshot || d.snapshot || d.submittedData || d || {};}
  function get(s,key){if(!s)return undefined; if(Object.prototype.hasOwnProperty.call(s,key))return s[key]; var ks=Object.keys(s); for(var i=0;i<ks.length;i++){if(norm(ks[i])===key)return s[ks[i]];} return undefined;}
  function num(v){var n=Number(String(v==null?0:v).replace(/[^0-9.\-]/g,'')); return isFinite(n)?n:0;}
  function money(n){return Number(n||0).toLocaleString('ar-SA',{style:'currency',currency:'SAR'});}
  function plain(n){return Number(n||0).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})+' ر.س';}
  function meta(e){var d=raw(e),s=snap(e),p=get(s,'persistentExtractData')||get(s,'persistentContractData')||{}; return {pay:e.paymentNumber||p.paymentNumber||d.paymentNumber||'—',period:e.periodMonth||[e.extractMonth||p.extractMonth||d.extractMonth||'',e.extractYear||p.extractYear||d.extractYear||''].filter(Boolean).join(' ')||'—',start:e.extractStart||p.extractStart||d.extractStart||'—',end:e.extractEnd||p.extractEnd||d.extractEnd||'—'};}
  function token(){try{return (JSON.parse(localStorage.getItem('najran_session')||'{}')||{}).clerkToken||'';}catch(e){return '';}}
  async function findExtract(id){
    var tk=token();
    var r=await fetch('/api/submitted-extracts',{headers:tk?{Authorization:'Bearer '+tk}:{},credentials:'include'});
    if(!r.ok)throw new Error('api');
    var data=await r.json();
    var arr=data.extracts||[];
    window.__rvExtractCache=arr;
    return arr.find(function(x){return String(x.id)===String(id);});
  }

  function toRows(v){
    if(Array.isArray(v))return v.filter(Boolean);
    if(v && typeof v==='object'){
      var vals=Object.keys(v).map(function(k){return v[k];});
      if(vals.some(Array.isArray)) return vals.reduce(function(a,x){return a.concat(toRows(x));},[]);
      return vals.filter(function(x){return x && typeof x==='object';});
    }
    return [];
  }
  function looksEmployee(r){return r && typeof r==='object' && (r.name||r.employeeName||r.workerName||Array.isArray(r.days)||r.salary||r.monthlySalary||r.netSalary||r.finalSalary);}
  function rowKey(r,i){return [r.id,r.employeeId,r.iqamaId,r.idNumber,r.name,r.employeeName,i].filter(Boolean).join('|');}
  function getAtt(s){var att=get(s,'attendanceData'); return att && typeof att==='object'?att:null;}
  function rowsFor(att,dept,used){
    var rows=[], keys=Object.keys(att||{}), aliases=dept.aliases.map(norm);
    keys.forEach(function(k){
      var nk=norm(k); if(aliases.indexOf(nk)===-1)return;
      used[nk]=true;
      rows=rows.concat(toRows(att[k]).filter(looksEmployee));
    });
    if(Array.isArray(att)) rows=att.filter(function(r){var dk=norm(r.department||r.dept||r.section||r.categoryKey); return aliases.indexOf(dk)>-1;});
    var seen={};
    return rows.filter(function(r,i){var kk=rowKey(r,i); if(seen[kk])return false; seen[kk]=true; return true;});
  }
  function collectAttendanceGroups(s){
    var att=getAtt(s); if(!att)return [];
    var used={}, groups=[];
    LABOR_DEPTS.forEach(function(d){var rows=rowsFor(att,d,used); if(rows.length)groups.push({label:d.label,key:d.key,rows:rows,dept:d});});
    Object.keys(att).forEach(function(k){
      var nk=norm(k); if(used[nk])return;
      if(/^(ng_|nd_|hc_|health|center|admin_offices|office|maktab|najran_dental|najran_general)/i.test(nk))return;
      var rows=toRows(att[k]).filter(looksEmployee);
      if(rows.length)groups.push({label:'قسم إضافي داخل نفس المستخلص - '+k,key:nk,rows:rows,dept:{aliases:[nk]}});
    });
    return groups;
  }
  function countDays(days){var c={p:0,a:0,v:0,e:0}; (Array.isArray(days)?days:[]).forEach(function(d){if(d==='ح'||d==='ت')c.p++; else if(d==='غ')c.a++; else if(d==='ج')c.v++; else if(d==='ش')c.e++;}); return c;}
  function monthlyValue(r){return num(r.salary||r.monthlySalary||r.contractValue||r.grossSalary||r.basicSalary||r.netSalary||r.finalSalary);}
  function deductionValue(r){return num(r.deduction||r.absenceDeduction||r.totalDeduction);}
  function fineValue(r){return num(r.totalFine||r.absencePenalty||r.absenceFine||r.penalty||r.fine)+num(r.nationalityFine);}
  function netValue(r){var n=num(r.netSalary||r.finalSalary||r.netAmount); if(n)return n; return monthlyValue(r)-deductionValue(r)-fineValue(r);}
  function dayCells(days){var h=''; for(var i=0;i<31;i++){var v=(Array.isArray(days)?days[i]:'')||''; h+='<td class="rv-day d'+esc(v)+'">'+esc(v||'')+'</td>'; } return h;}
  function statCard(t,v,cls){return '<div class="rv-stat '+(cls||'')+'"><span>'+esc(t)+'</span><b>'+esc(v)+'</b></div>';}
  function navCard(id,t,s){return '<a href="#'+esc(id)+'" class="rv-nav-card"><b>'+esc(t)+'</b><span>'+esc(s)+'</span></a>';}
  function empty(t){return '<div class="rv-empty">'+esc(t)+'</div>';}

  function attendanceHtml(s){
    var groups=collectAttendanceGroups(s);
    if(!groups.length)return empty('لا توجد بيانات حضور وانصراف محفوظة داخل هذا المستخلص');
    var total={emp:0,cost:0,ded:0,fine:0,net:0,p:0,a:0,v:0,e:0}, html='';
    groups.forEach(function(g){
      var body='', sub={emp:0,cost:0,ded:0,fine:0,net:0,p:0,a:0,v:0,e:0};
      g.rows.forEach(function(r,i){
        var c=countDays(r.days), p=num(r.attendanceDays||r.presentDays)||c.p, a=num(r.absenceDays)||c.a, v=num(r.vacationDays)||c.v, e=num(r.vacantDays||r.openDays)||c.e;
        var cost=monthlyValue(r), ded=deductionValue(r), fine=fineValue(r), net=netValue(r);
        sub.emp++; sub.cost+=cost; sub.ded+=ded; sub.fine+=fine; sub.net+=net; sub.p+=p; sub.a+=a; sub.v+=v; sub.e+=e;
        body+='<tr><td>'+(i+1)+'</td><td class="nm">'+esc(r.name||r.employeeName||r.workerName||'—')+'</td><td>'+esc(r.jobTitle||r.position||r.job||'—')+'</td><td>'+esc(r.category||r.classification||'—')+'</td><td>'+esc(r.nationality||'—')+'</td><td>'+esc(r.iqamaId||r.idNumber||r.identityNumber||'—')+'</td>'+dayCells(r.days)+'<td>'+p+'</td><td>'+a+'</td><td>'+v+'</td><td>'+e+'</td><td>'+plain(cost)+'</td><td>'+plain(ded)+'</td><td>'+plain(fine)+'</td><td><b>'+plain(net)+'</b></td></tr>';
      });
      Object.keys(sub).forEach(function(k){total[k]+=sub[k];});
      html+='<div class="rv-block rv-print-block"><div class="rv-block-title"><h4>'+esc(g.label)+'</h4><span>'+sub.emp+' موظف</span></div><div class="rv-substats">'+statCard('إجمالي التكلفة',plain(sub.cost))+statCard('الحسميات والغرامات',plain(sub.ded+sub.fine))+statCard('صافي الاستحقاق',plain(sub.net))+'</div><div class="rv-scroll"><table class="rv-table att"><thead><tr><th>م</th><th>اسم الموظف</th><th>الوظيفة</th><th>الفئة</th><th>الجنسية</th><th>رقم الهوية / الإقامة</th>'+Array.from({length:31},function(_,i){return '<th>'+(i+1)+'</th>';}).join('')+'<th>حضور</th><th>غياب</th><th>إجازة</th><th>شاغر</th><th>القيمة</th><th>الحسم</th><th>الغرامة</th><th>الصافي</th></tr></thead><tbody>'+body+'</tbody></table></div></div>';
    });
    return '<div class="rv-main-stats">'+statCard('إجمالي الموظفين',total.emp,'primary')+statCard('إجمالي التكلفة',money(total.cost),'primary')+statCard('إجمالي الحسميات والغرامات',money(total.ded+total.fine),'warn')+statCard('صافي الاستحقاق',money(total.net),'ok')+'</div><div class="rv-att-mini">'+statCard('إجمالي الحضور',total.p)+statCard('إجمالي الغياب',total.a)+statCard('الإجازات',total.v)+statCard('الشاغر / تحت الإجراء',total.e)+'</div>'+html;
  }

  function scoreSource(perf,dept){
    perf=perf||{};
    var aliases=dept.aliases.concat([dept.key]);
    for(var i=0;i<aliases.length;i++){var k=aliases[i]; if(perf[k]!=null)return perf[k]; if(perf[norm(k)]!=null)return perf[norm(k)];}
    return null;
  }
  function itemSource(s,dept){
    var aliases=dept.aliases.concat([dept.key]);
    for(var i=0;i<aliases.length;i++){
      var v=get(s,'performanceItems_isolated_'+norm(aliases[i])+'_v1')||get(s,'performanceItems_'+norm(aliases[i]))||get(s,'performanceItems_'+norm(aliases[i])+'_v1');
      if(v)return toRows(v);
    }
    var general=get(s,'performanceItems_general_v1')||get(s,'performanceItems');
    return general?toRows(general):PERF_ITEMS.map(function(x){return {text:x[0],max:x[1]};});
  }
  function scoreOf(src,i,max){
    if(Array.isArray(src)){var v=src[i]; if(v && typeof v==='object')return num(v.score||v.value||v.actual||v.degree||v.mark||max); return v==null?num(max):num(v);}
    if(src && typeof src==='object'){
      var arr=src.scores||src.items||src.rows||src.data; if(arr)return scoreOf(arr,i,max);
      if(src[i]!=null)return num(src[i]); if(src[String(i)]!=null)return num(src[String(i)]);
    }
    return num(max);
  }
  function performancePenaltyRate(pct){return pct<60?15:pct<65?10:pct<70?8:pct<75?6:pct<80?4:pct<85?2:0;}
  function performanceDeductions(s){return get(s,'performanceDeductions')||get(s,'performanceDeductions_v4')||{};}
  function getDeductionForDept(s,dept,cost,rate){
    var d=performanceDeductions(s), aliases=dept.aliases.concat([dept.key]);
    for(var i=0;i<aliases.length;i++){var k=aliases[i]; if(d && d[k]!=null)return num(d[k]); if(d && d[norm(k)]!=null)return num(d[norm(k)]);}
    return cost*rate/100;
  }
  function performanceHtml(s){
    var perf=get(s,'performanceData_v4')||get(s,'performanceData')||{};
    var groups=collectAttendanceGroups(s), groupMap={}; groups.forEach(function(g){groupMap[g.key]=g;});
    var html='', totals={cost:0,ded:0,score:0,max:0,count:0};
    PERFORMANCE_DEPTS.forEach(function(dept){
      var g=groupMap[dept.key]||{rows:[],label:dept.label};
      var source=scoreSource(perf,dept);
      var items=itemSource(s,dept); if(!items.length)items=PERF_ITEMS.map(function(x){return {text:x[0],max:x[1]};});
      var body='', mxT=0, scT=0;
      items.forEach(function(it,i){var mx=num(it.max||it.degree||it.maxScore||it.maximum||it[1]||0), sc=scoreOf(source,i,mx); mxT+=mx; scT+=sc; body+='<tr><td>'+(i+1)+'</td><td class="it">'+esc(it.text||it.name||it.title||it[0]||'—')+'</td><td>'+mx+'</td><td>'+sc+'</td></tr>';});
      var pct=mxT?scT/mxT*100:100, rate=performancePenaltyRate(pct), cost=g.rows.reduce(function(a,r){return a+netValue(r);},0), ded=getDeductionForDept(s,dept,cost,rate);
      totals.cost+=cost; totals.ded+=ded; totals.score+=scT; totals.max+=mxT; totals.count++;
      html+='<div class="rv-block rv-print-block"><div class="rv-block-title"><h4>شهادة الأداء الشهري - '+esc(dept.label.replace(/^ح غ \d+ - /,''))+'</h4><span>'+esc(dept.label)+'</span></div><div class="rv-substats">'+statCard('إجمالي تكلفة القسم',plain(cost))+statCard('نسبة التقييم',pct.toFixed(2)+'%')+statCard('نسبة الحسم',rate+'%')+statCard('قيمة حسم الأداء',plain(ded))+'</div><div class="rv-scroll"><table class="rv-table perf"><thead><tr><th>م</th><th>أنشطة القسم</th><th>الدرجة القصوى</th><th>التقدير</th></tr></thead><tbody>'+body+'<tr class="total"><td colspan="2">المجموع</td><td>'+mxT+'</td><td>'+scT+'</td></tr></tbody></table></div></div>';
    });
    return '<div class="rv-main-stats">'+statCard('عدد جداول الأداء',totals.count,'primary')+statCard('إجمالي تكلفة الأقسام',money(totals.cost),'primary')+statCard('إجمالي حسم الأداء',money(totals.ded),'warn')+statCard('متوسط التقييم',totals.max?(totals.score/totals.max*100).toFixed(2)+'%':'—','ok')+'</div>'+html;
  }

  function calcAchievement(s){
    var groups=collectAttendanceGroups(s), perfDed=performanceDeductions(s), result={labor:{monthly:0,absDed:0,absFine:0,perfFine:0,natFine:0,net:0},admin:{monthly:0,absDed:0,absFine:0,perfFine:0,natFine:0,net:0}};
    groups.forEach(function(g){
      var target=g.key==='admin_saudi'?result.admin:result.labor;
      g.rows.forEach(function(r){target.monthly+=monthlyValue(r); target.absDed+=deductionValue(r); target.absFine+=num(r.totalFine||r.absencePenalty||r.absenceFine||r.penalty||r.fine); target.natFine+=num(r.nationalityFine); target.net+=netValue(r);});
      var aliases=(g.dept&&g.dept.aliases)||[g.key]; aliases.concat([g.key]).some(function(k){if(perfDed && perfDed[k]!=null){target.perfFine+=num(perfDed[k]); return true;} if(perfDed && perfDed[norm(k)]!=null){target.perfFine+=num(perfDed[norm(k)]); return true;} return false;});
    });
    result.labor.net=result.labor.monthly-result.labor.absDed-result.labor.absFine-result.labor.perfFine-result.labor.natFine;
    result.admin.net=result.admin.monthly-result.admin.absDed-result.admin.absFine-result.admin.perfFine-result.admin.natFine;
    return result;
  }
  function tafqit(n){
    n=Number(n||0); if(!isFinite(n))return 'صفر ريال سعودي';
    var fixed=n.toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2});
    return fixed+' ريال سعودي';
  }
  function achievementHtml(s){
    var a=calcAchievement(s);
    var t={monthly:a.labor.monthly+a.admin.monthly,absDed:a.labor.absDed+a.admin.absDed,absFine:a.labor.absFine+a.admin.absFine,perfFine:a.labor.perfFine+a.admin.perfFine,natFine:a.labor.natFine+a.admin.natFine,net:a.labor.net+a.admin.net};
    function row(n,o,c){return '<tr class="'+(c||'')+'"><td>'+esc(n)+'</td><td>'+money(o.monthly)+'</td><td>'+money(o.absDed)+'</td><td>'+money(o.absFine)+'</td><td>'+money(o.perfFine)+'</td><td>'+money(o.natFine)+'</td><td><b>'+money(o.net)+'</b></td></tr>';}
    return '<div class="rv-main-stats">'+statCard('القيمة الشهرية حسب العقد',money(t.monthly),'primary')+statCard('إجمالي الحسميات والغرامات',money(t.absDed+t.absFine+t.perfFine+t.natFine),'warn')+statCard('المبلغ الصافي الشهري',money(t.net),'ok')+statCard('عدد بنود الشهادة','3','primary')+'</div><div class="rv-block rv-print-block"><div class="rv-block-title"><h4>شهادة الإنجاز / الاستحقاق الشهري</h4><span>محسوبة من نفس مستخلص المراجعة</span></div><div class="rv-scroll"><table class="rv-table ach"><thead><tr><th>البند</th><th>القيمة الشهرية حسب العقد</th><th>حسم الغياب</th><th>غرامة الغياب</th><th>غرامة الأداء</th><th>غرامة الجنسية</th><th>المبلغ الصافي الشهري</th></tr></thead><tbody>'+row('العمالة',a.labor)+row('الوظائف الإدارية السعوديين',a.admin)+row('إجمالي المستحق للمقاول',t,'total')+'<tr><td colspan="7" class="tafq">إجمالي المستحق للمقاول فقط وقدره: '+tafqit(t.net)+'</td></tr></tbody></table></div></div>';
  }
  function generic(s,type){var k=type==='consumables'?'consumablesTableData':type==='spare_parts'?'sparePartsData':''; var v=k?get(s,k):null; return v?'<pre class="rv-pre">'+esc(JSON.stringify(v,null,2))+'</pre>':empty('لا توجد معاينة تفصيلية محفوظة لهذا النوع داخل لقطة المستخلص');}
  function doc(e){
    var s=snap(e),m=meta(e),labor=e.extractType==='labor';
    var attCount=collectAttendanceGroups(s).reduce(function(a,g){return a+g.rows.length;},0);
    var status=STAT[e.status]||e.status||'—';
    var h='<div class="rv-doc"><header class="rv-doc-head"><div><h2>'+esc(TYPES[e.extractType]||e.extractType)+'</h2><p>'+esc(e.hospitalName||e.submittedByHospital||'—')+' — '+esc(e.companyName||'—')+' — '+esc(m.period)+' — دفعة '+esc(m.pay)+'</p></div><b>'+esc(status)+'</b></header>';
    h+='<nav class="rv-tabs">'+navCard('rv-summary','ملخص المراجعة','بيانات المستخلص')+(labor?navCard('rv-attendance','الحضور والانصراف',attCount?attCount+' موظف':'ناقص')+navCard('rv-performance','شهادة الأداء الشهري','7 جداول')+navCard('rv-achievement','شهادة الإنجاز','جدول الاستحقاق'):'')+'</nav>';
    h+='<section id="rv-summary"><h3>ملخص المراجعة</h3><div class="rv-main-stats">'+statCard('نوع المستخلص',TYPES[e.extractType]||e.extractType,'primary')+statCard('رقم الدفعة',m.pay,'primary')+statCard('الفترة',m.period,'primary')+statCard('قيمة الكارت',money(e.totalAmount||0),'ok')+'</div><div class="rv-info-grid"><div><b>من تاريخ</b><span>'+esc(m.start)+'</span></div><div><b>إلى تاريخ</b><span>'+esc(m.end)+'</span></div><div><b>الحالة</b><span>'+esc(status)+'</span></div><div><b>المراجع</b><span>'+esc(e.reviewedByName||e.adminName||'—')+'</span></div></div></section>';
    if(labor){h+='<section id="rv-attendance" class="rv-section-break"><h3>الحضور والانصراف</h3>'+attendanceHtml(s)+'</section><section id="rv-performance" class="rv-section-break"><h3>شهادة الأداء الشهري</h3>'+performanceHtml(s)+'</section><section id="rv-achievement" class="rv-section-break"><h3>شهادة الإنجاز</h3>'+achievementHtml(s)+'</section>';}else{h+='<section><h3>تفاصيل المستخلص</h3>'+generic(s,e.extractType)+'</section>';}
    h+='<section id="rv-decision"><h3>قرار المراجع</h3><textarea id="rv-notes" placeholder="اكتب الملاحظة هنا عند طلب التعديل أو الرفض. الاعتماد لا يحتاج ملاحظة.">'+esc(e.adminNotes||'')+'</textarea><div class="rv-actions"><button class="rv-act review" data-rv-status="under_review">بدء المراجعة</button><button class="rv-act revision" data-rv-status="needs_revision">طلب تعديل</button><button class="rv-act approve" data-rv-status="approved">اعتماد</button><button class="rv-act reject" data-rv-status="rejected">رفض</button></div></section></div>';
    return h;
  }

  var RV_STYLE='.rv-detail-btn{background:linear-gradient(135deg,#123b6d,#1e6aa8)!important;color:#fff!important;border:0!important;border-radius:12px!important;padding:11px 18px!important;font-family:Tajawal,Arial!important;font-weight:900!important;cursor:pointer!important;margin:0 0 14px!important;box-shadow:0 8px 18px rgba(18,59,109,.18)!important}.rv-ov{position:fixed;inset:0;background:rgba(15,23,42,.72);z-index:999999;display:none;padding:14px;direction:rtl}.rv-ov.open{display:block}.rv-modal{height:100%;background:#eef3f8;border-radius:20px;overflow:hidden;display:grid;grid-template-rows:auto 1fr}.rv-head{background:linear-gradient(135deg,#0f2f55,#1e5d92);color:#fff;padding:15px 20px;display:flex;justify-content:space-between;align-items:center;gap:12px}.rv-head h2{margin:0;font-size:18px}.rv-head button{border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.14);color:#fff;border-radius:11px;padding:9px 13px;font-family:Tajawal,Arial;font-weight:900;cursor:pointer}.rv-head .green{background:#16a34a}.rv-body{overflow:auto;padding:18px}.rv-doc{background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 10px 28px rgba(15,47,85,.08);font-family:Tajawal,Arial;color:#172554}.rv-doc-head{padding:19px 23px;border-bottom:4px solid #123b6d;display:flex;justify-content:space-between;align-items:center;gap:18px}.rv-doc-head h2{margin:0;color:#123b6d}.rv-doc-head p{margin:6px 0 0;color:#475569;font-weight:800}.rv-doc-head>b{border:2px solid #123b6d;border-radius:14px;color:#123b6d;padding:9px 15px;white-space:nowrap}.rv-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;padding:18px 22px;background:#f8fafc;border-bottom:1px solid #e2e8f0}.rv-nav-card{height:96px;text-decoration:none;background:linear-gradient(180deg,#fff,#f8fbff);border:1px solid #dbe5ef;border-top:5px solid #123b6d;border-radius:18px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;color:#123b6d;box-shadow:0 8px 18px rgba(15,47,85,.06)}.rv-nav-card b{font-size:16px;font-weight:900}.rv-nav-card span{margin-top:8px;background:#eef6ff;color:#1e5d92;border-radius:999px;padding:5px 16px;font-size:12px;font-weight:900}.rv-doc section{padding:22px 24px;border-bottom:1px solid #e2e8f0}.rv-doc h3{color:#123b6d;border-right:6px solid #123b6d;padding-right:12px;margin:0 0 16px;font-size:20px}.rv-main-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:12px 0 16px}.rv-att-mini,.rv-substats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:10px 0}.rv-stat{min-height:78px;background:linear-gradient(180deg,#f8fafc,#fff);border:1px solid #dbe5ef;border-radius:16px;padding:12px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center}.rv-stat span{font-size:12px;color:#64748b;font-weight:900}.rv-stat b{font-size:18px;color:#0f2f55;font-weight:900;margin-top:5px}.rv-stat.primary{border-color:#bfdbfe;background:linear-gradient(180deg,#eff6ff,#fff)}.rv-stat.warn{border-color:#fed7aa;background:linear-gradient(180deg,#fff7ed,#fff)}.rv-stat.ok{border-color:#bbf7d0;background:linear-gradient(180deg,#f0fdf4,#fff)}.rv-info-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.rv-info-grid div{background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:13px}.rv-info-grid b{display:block;color:#64748b;margin-bottom:6px}.rv-info-grid span{font-weight:900;color:#123b6d}.rv-block{border:1px solid #dbe5ef;border-radius:16px;margin:16px 0;overflow:hidden;background:#fff}.rv-block-title{background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#123b6d;margin:0;padding:13px 15px;display:flex;justify-content:space-between;align-items:center}.rv-block-title h4{margin:0;font-size:16px}.rv-block-title span{font-weight:900;color:#64748b}.rv-scroll{overflow:auto}.rv-table{width:100%;border-collapse:collapse;font-size:11px}.rv-table th{background:#123b6d;color:#fff;border:1px solid #0f2f55;padding:7px;white-space:nowrap;text-align:center}.rv-table td{border:1px solid #dbe5ef;padding:6px;vertical-align:middle;text-align:center}.rv-table tr:nth-child(even) td{background:#f8fafc}.rv-table tr.total td,.total td{background:#fff3cd!important;font-weight:900}.att{min-width:1850px}.ach{min-width:1000px}.perf .it{text-align:right;min-width:520px}.rv-day{min-width:24px;font-weight:900}.dح{background:#e8f0fe!important;color:#1d4ed8}.dغ{background:#fee2e2!important;color:#b91c1c}.dج{background:#fef3c7!important;color:#b45309}.dش{background:#d1ecf1!important;color:#0369a1}.dت{background:#e2e8f0!important;color:#475569}.nm{font-weight:900;color:#123b6d;min-width:160px}.rv-empty{padding:30px;text-align:center;color:#64748b;background:#f8fafc;border:1.5px dashed #cbd5e1;border-radius:16px;font-weight:900}.tafq{text-align:center;font-weight:900;color:#123b6d;background:#f8fafc!important}.rv-pre{direction:ltr;text-align:left;white-space:pre-wrap;background:#0f172a;color:#e2e8f0;padding:16px;border-radius:12px}#rv-notes{width:100%;min-height:96px;border:1.5px solid #cbd5e1;border-radius:12px;padding:12px;font-family:Tajawal,Arial;font-weight:800}.rv-actions{text-align:center}.rv-act{border:0;border-radius:12px;padding:12px 20px;margin:12px 5px 0;color:#fff;font-family:Tajawal,Arial;font-weight:900;cursor:pointer}.review{background:#1e5d92}.revision{background:#ea580c}.approve{background:#16a34a}.reject{background:#dc2626}@media(max-width:1100px){.rv-tabs,.rv-main-stats,.rv-att-mini,.rv-substats,.rv-info-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:720px){.rv-tabs,.rv-main-stats,.rv-att-mini,.rv-substats,.rv-info-grid{grid-template-columns:1fr}.rv-doc-head{display:block}.rv-head{display:block}.rv-head div{margin-top:10px}}@page{size:A3 landscape;margin:8mm}@media print{html,body{background:#fff!important}body *{visibility:hidden!important}.rv-doc,.rv-doc *{visibility:visible!important}.rv-head,#rv-decision,.rv-tabs{display:none!important}.rv-ov{position:static!important;display:block!important;background:#fff!important;padding:0!important}.rv-modal{display:block!important;height:auto!important;background:#fff!important}.rv-body{padding:0!important;overflow:visible!important}.rv-doc{box-shadow:none!important;border-radius:0!important}.rv-doc section{page-break-inside:auto;padding:10px 0!important}.rv-section-break{page-break-before:always}.rv-print-block{page-break-inside:avoid}.rv-scroll{overflow:visible!important}.att{min-width:0!important}.rv-table{font-size:7px!important;table-layout:auto}.rv-table th,.rv-table td{padding:3px!important}.rv-main-stats,.rv-att-mini,.rv-substats{grid-template-columns:repeat(4,1fr)!important;gap:6px!important}.rv-stat{min-height:48px!important;padding:6px!important}.rv-stat b{font-size:12px!important}.rv-stat span{font-size:9px!important}.rv-doc h3{font-size:15px!important;margin-bottom:8px!important}.rv-block-title{padding:7px!important}.rv-block-title h4{font-size:12px!important}}';
  function style(){if(document.getElementById('rv-style'))return; var x=document.createElement('style'); x.id='rv-style'; x.textContent=RV_STYLE; document.head.appendChild(x);}
  function modal(){var o=document.getElementById('rv-ov'); if(o)return o; o=document.createElement('div'); o.id='rv-ov'; o.className='rv-ov'; o.innerHTML='<div class="rv-modal"><div class="rv-head"><h2>ملف المراجعة التفصيلية</h2><div><button class="green" id="rv-download">تحميل المستخلص الكامل</button><button id="rv-print">طباعة</button><button id="rv-close">إغلاق</button></div></div><div id="rv-body" class="rv-body"></div></div>'; document.body.appendChild(o); document.getElementById('rv-close').onclick=rvClose; document.getElementById('rv-print').onclick=function(){window.print();}; document.getElementById('rv-download').onclick=rvDownload; return o;}
  window.rvClose=function(){var o=document.getElementById('rv-ov'); if(o)o.classList.remove('open'); document.body.style.overflow='';};
  window.rvDownload=function(){var html='<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>المستخلص الكامل</title><style>'+RV_STYLE.replace(/@media print[\s\S]*$/,'')+'</style></head><body><div class="rv-body">'+((document.getElementById('rv-body')||{}).innerHTML||'')+'</div></body></html>'; var blob=new Blob([html],{type:'text/html;charset=utf-8'}),a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='review-extract-full.html'; a.click(); setTimeout(function(){URL.revokeObjectURL(a.href);},1000);};
  window.rvOpenExtract=async function(id){try{style(); var o=modal(),b=document.getElementById('rv-body'); b.innerHTML=empty('جاري تحميل بيانات المستخلص...'); o.classList.add('open'); document.body.style.overflow='hidden'; var e=await findExtract(id); if(!e){b.innerHTML=empty('تعذر العثور على بيانات المستخلص. اضغط تحديث ثم افتح الكارت مرة أخرى.'); return;} b.innerHTML=doc(e); b.querySelectorAll('[data-rv-status]').forEach(function(btn){btn.onclick=function(){rvAction(id,btn.getAttribute('data-rv-status'));};});}catch(err){console.error('[ReviewWorkflow]',err); alert('تعذر تحميل ملف المراجعة التفصيلية');}};
  window.rvAction=function(id,status){var n=document.getElementById('rv-notes'),note=n?n.value.trim():''; if((status==='needs_revision'||status==='rejected')&&!note){alert('اكتب الملاحظة أولاً حتى يعرف المستخدم سبب الإرجاع'); if(n)n.focus(); return;} var h=document.getElementById('notes-'+id); if(!h){h=document.createElement('textarea'); h.id='notes-'+id; h.style.display='none'; document.body.appendChild(h);} h.value=note; if(typeof updateStatus==='function'){rvClose(); updateStatus(id,status);} };
  function bind(){
    style();
    document.querySelectorAll('.card[id^="card-"]').forEach(function(c){
      var id=c.id.replace('card-',''); var body=c.querySelector('.card-body.open'); if(!body)return;
      body.querySelectorAll('.rv-detail-btn').forEach(function(x){x.remove();});
      Array.prototype.slice.call(body.querySelectorAll('button,a')).forEach(function(x){var t=(x.textContent||'').replace(/\s+/g,' ').trim(); if(t && t.indexOf('فتح ملف المراجعة التفصيلية')>-1 && !x.classList.contains('rv-detail-btn'))x.remove();});
      var btn=document.createElement('button'); btn.className='rv-detail-btn'; btn.type='button'; btn.textContent='فتح ملف المراجعة التفصيلية'; btn.onclick=function(ev){ev.stopPropagation(); window.rvOpenExtract(id);}; body.insertBefore(btn,body.firstChild);
    });
  }
  setInterval(bind,700);
  document.addEventListener('DOMContentLoaded',bind);
})();