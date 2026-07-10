'use strict';
function eventFilter(){
  var cat=q('f-category').value,type=q('f-type').value,sev=q('f-sev').value,h=q('f-hospital').value,p=q('f-page').value,u=q('f-user').value,b=q('f-build').value,status=q('f-status').value,search=norm(q('f-search').value),today=q('f-today').checked,missing=q('f-unknown').checked,showTests=q('f-tests').checked,start=new Date();start.setHours(0,0,0,0);
  return enriched.filter(function(e){
    if(e._manual&&!showTests)return false;
    var g=groups.find(function(x){return x.events.some(function(z){return z._index===e._index})});
    if(cat&&e._category!==cat||type&&e.type!==type||sev&&norm(e.severity)!==sev||h&&e.hospital!==h||p&&e.page!==p||u&&e._user!==u||b&&e.buildVersion!==b||status&&(!g||g.status!==status)||today&&e._time<start.getTime()||missing&&!e._missing)return false;
    if(search&&norm([e.type,e.message,e.userName,e.userEmail,e.hospital,e.page,e._category,e.buildVersion].join(' ')).indexOf(search)<0)return false;
    return true
  })
}
function groupFilter(){
  var allowed=new Set(eventFilter().map(function(e){return e._index}));
  var arr=groups.filter(function(g){
    if(!g.events.some(function(e){return allowed.has(e._index)}))return false;
    if(q('f-repeat').checked&&!g.repeated||q('f-multi-user').checked&&!g.multi||q('f-data-loss').checked&&!g.loss)return false;
    return true
  });
  var sort=q('f-sort').value,priority={'يحتاج تدخل':0,'يحتاج متابعة':1,'معلومات تشغيلية':2,'متكرر معروف':3,'قديم غير متكرر':4};
  arr.sort(function(a,b){
    if(sort==='latest')return b.last-a.last;
    if(sort==='count')return b.events.length-a.events.length||b.last-a.last;
    if(sort==='users')return b.users.size-a.users.size||b.events.length-a.events.length;
    if(sort==='hospitals')return b.hospitals.size-a.hospitals.size||b.events.length-a.events.length;
    return priority[a.status]-priority[b.status]||b.events.length-a.events.length||b.last-a.last
  });
  return arr
}
function statusClass(s,g){if(g&&g.manual)return'manual';return s==='يحتاج تدخل'?'urgent':s==='يحتاج متابعة'?'follow':(s==='متكرر معروف'||s==='قديم غير متكرر')?'old':'info'}
function groupCard(g){
  return'<div class="issue-card '+statusClass(g.status,g)+'"><div class="issue-title">'+esc(g.type)+'</div><div><span class="badge cat">'+esc(g.category)+'</span><span class="badge status">'+esc(g.status)+'</span><span class="badge">'+esc(String(g.severity).toUpperCase())+'</span>'+(g.newCount?'<span class="badge good">جديد '+g.newCount+'</span>':'')+(g.missing?'<span class="badge warn">بيانات ناقصة</span>':'')+(g.manual?'<span class="badge manual">اختبار</span>':'')+'</div><div class="issue-meta">التكرار: '+g.events.length+' · المستخدمون: '+g.users.size+' · المواقع: '+g.hospitals.size+' · الصفحات: '+esc(uniq(Array.from(g.pages)).join('، ')||'-')+'<br>أول ظهور: '+esc(fmt(g.first))+' · آخر ظهور: '+esc(fmt(g.last))+'</div><div class="issue-msg">'+esc(g.lastMessage)+'</div><div class="issue-meta"><b>الإجراء المقترح:</b> '+esc(g.advice)+'</div><div class="toolbar"><button class="btn primary js-group-open" data-group="'+g.index+'">عرض التفاصيل</button><button class="btn js-group-copy" data-group="'+g.index+'">نسخ تقرير المشكلة</button><button class="btn js-group-prompt" data-group="'+g.index+'">نسخ برومبت مراجعة</button></div></div>'
}
function renderQuality(){
  var total=enriched.length,missingUser=enriched.filter(function(e){return !e.userId&&!e.userEmail&&!e.userName}).length,missingHospital=enriched.filter(function(e){return !e.hospital}).length,missingPage=enriched.filter(function(e){return !e.page}).length,parseErrors=enriched.filter(function(e){return e._parseError||e._payload&&e._payload._parseError}).length,unknown=enriched.filter(function(e){return !e._manual&&e._category==='أخرى'}).length,manual=enriched.filter(function(e){return e._manual}).length;
  var items=[['هوية مستخدم ناقصة',missingUser],['موقع غير محدد',missingHospital],['صفحة غير محددة',missingPage],['أخطاء تحليل JSON',parseErrors],['تصنيف أخرى',unknown],['اختبارات يدوية مستبعدة افتراضيًا',manual,'test']];
  q('quality').innerHTML=items.map(function(x){return'<div class="quality-item '+(x[2]||(x[1]?'bad':'ok'))+'"><b>'+esc(x[0])+'</b><div>'+x[1]+' من '+total+'</div></div>'}).join('')
}
function renderAnalysis(fe,fg){
  var urgent=fg.filter(function(g){return g.status==='يحتاج تدخل'}).length,loss=fg.filter(function(g){return g.loss}).length,multi=fg.filter(function(g){return g.multi}).length,newEvents=fe.filter(function(e){return e._new}).length,topCat={};
  fe.forEach(function(e){topCat[e._category]=(topCat[e._category]||0)+1});
  var top=Object.keys(topCat).sort(function(a,b){return topCat[b]-topCat[a]})[0]||'-';
  q('analysis-kpis').innerHTML=[['مشاكل تحتاج تدخل',urgent],['فقد بيانات محتمل',loss],['مشاكل متعددة المستخدمين',multi],['حوادث جديدة منذ آخر تحديث',newEvents],['أكثر تصنيف',top]].map(function(x){return'<div class="kpi"><b>'+esc(x[0])+'</b><span>'+esc(x[1])+'</span></div>'}).join('')
}