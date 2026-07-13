'use strict';

var events=[], enriched=[], groups=[], selectedEvent=-1, lastUsers=[], lastHospitals=[], lastBuilds=[], networkCount=0, previousIds=new Set(), baselineReady=false, loadedAt=null;

function q(id){return document.getElementById(id)}
function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function sess(){try{return JSON.parse(localStorage.getItem('najran_session')||'{}')}catch(_){return{}}}
function admin(){return String(sess().role||'').toLowerCase()==='admin'}
async function fresh(){
  async function get(fn){try{if(typeof fn!=='function')return'';try{return await fn({skipCache:true})||''}catch(_){return await fn()||''}}catch(_){return''}}
  var t=await get(window.najranGetFreshToken);if(t)return t;
  try{if(parent&&parent!==window){t=await get(parent.najranGetFreshToken);if(t)return t}}catch(_){}
  try{if(top&&top!==window){t=await get(top.najranGetFreshToken);if(t)return t}}catch(_){}
  var s=sess();return s.clerkToken&&s.timestamp&&Date.now()-Number(s.timestamp)<55000?s.clerkToken:''
}
async function authHeaders(){var t=await fresh();return t?{Authorization:'Bearer '+t}:{}}
function manualFetch(url,o){networkCount++;q('network-count').textContent=networkCount;return fetch(url,o)}
function set(id,v){var e=q(id);if(e)e.textContent=v==null?'—':v}
function norm(v){return String(v||'').toLowerCase().replace(/\s+/g,' ').trim()}
function time(e){var n=new Date(e.timestamp||e.createdAt||0).getTime();return isFinite(n)?n:0}
function fmt(v){try{return new Date(v).toLocaleString('ar-SA')}catch(_){return String(v||'')}}
function userKey(e){return String(e.userId||e.userEmail||e.userName||'غير محدد')}
function userName(e){return e.userName||e.userEmail||('User #'+(e.userId||'غير محدد'))}
function uniq(a){return Array.from(new Set(a.filter(Boolean)))}
function severityClass(s){s=norm(s);return ['critical','error','warning'].includes(s)?s:'info'}
function windowText(){var e=q('f-window');return e&&e.options[e.selectedIndex]?e.options[e.selectedIndex].text:'النطاق الحالي'}
function hasMissing(e){return !e.userId&&!e.userEmail&&!e.userName||!e.page||!e.type||!e.severity}
function isManualTest(e){var p=e&&e._payload||{};return norm(e&&e.type)==='manual_incident'||norm(p.reason)==='manual dashboard test'}
function isTelemetryNetworkFailure(e){var p=e&&e._payload||{},url=String(p.url||'');return norm(e&&e.type)==='api_failure'&&/^\/api\/(?:audit|users\/me\/activity)(?:$|[?#])/.test(url)}
function isExpectedPasswordInputError(e){var s=norm([e&&e.type,e&&e.message,e&&e.page,JSON.stringify(e&&e._payload||{})].join(' '));return norm(e&&e.type)==='js_error'&&/invalidcharactererror/.test(s)&&/btoa/.test(s)&&/latin1|latin-1/.test(s)}
function pageLoadDelayMs(e){
  try{
    var eventTime=time(e),actions=Array.isArray(e&&e.lastActions)?e.lastActions:[];
    for(var i=actions.length-1;i>=0;i--){
      if(actions[i]&&actions[i].kind==='page-loaded'){
        var loaded=new Date(actions[i].at||0).getTime();
        if(isFinite(eventTime)&&isFinite(loaded))return eventTime-loaded;
      }
    }
  }catch(_){}
  return Infinity
}
function isKnownMonitorFalsePositive(e){
  var type=norm(e&&e.type),p=e&&e._payload||{},delay=pageLoadDelayMs(e);
  if((type==='consumables_summary_dom_mismatch'||type==='render_tables_missing')&&norm(e&&e.page)==='consumables'&&delay>=0&&delay<=15000){
    if(type==='render_tables_missing')return true;
    return Number(p.storageMainRows||0)>0&&Number(p.domRows||0)===0&&p.renderTablesExists===false&&p.renderAllTablesExists===false;
  }
  if(type==='storage_cleared'){
    var stack=String(p.stack||e&&e.stack||'');
    return stack.indexOf('forceReviewOnlyBeforeInit')>-1&&stack.indexOf('cloud-sync.js')>-1;
  }
  return false
}

function category(e){
  if(isManualTest(e))return'اختبار يدوي';
  if(isTelemetryNetworkFailure(e))return'اتصال وخدمات مراقبة';
  var s=norm([e.type,e.message,e.page,JSON.stringify(e._payload||{})].join(' '));
  if(/signature|توقيع|sb_sigs|dynamicsignatures/.test(s))return'توقيعات';
  if(/storage_empty|storage_shrunk|storage_removed|storage_cleared|data.loss|فقد|اختف|overwrite|restore_overwritten/.test(s))return'فقد بيانات';
  if(/local|save|storage|quota|حفظ/.test(s))return'حفظ محلي';
  if(/sync|push|pull|upload|submit|cloud|رفع|مزامن/.test(s))return'رفع ومزامنة';
  if(/401|403|auth|token|login|clerk|دخول|توكن/.test(s))return'تسجيل دخول وتوكن';
  if(/attendance|حضور/.test(s))return'حضور';
  if(/performance|أداء/.test(s))return'أداء';
  if(/achievement|إنجاز/.test(s))return'إنجاز';
  if(/consumable|مستهلك/.test(s))return'مستهلكات';
  if(/print|طباعة|pdf/.test(s))return'طباعة';
  if(/button|click|render|dom|undefined|زر|واجهة/.test(s))return'أزرار وواجهة';
  return'أخرى'
}
function dataLoss(e){return /storage_empty_overwrite|storage_shrunk|storage_cleared|signatures_overwritten_or_missing|backup_restore_overwritten|ctx_hospital_mismatch|submit_incomplete_payload|فقد|اختف|مسح|overwrite/.test(norm([e.type,e.message,JSON.stringify(e._payload||{})].join(' ')))}
function reasonCode(e){var p=e._payload||{};return norm(p.reason||p.code||p.errorCode||p.status||e.reason||e.code||'')}
function fingerprint(e){var base=[norm(e.type||'unknown'),norm(e.page||'unknown')],rc=reasonCode(e);if(rc)base.push('reason:'+rc);else base.push(norm(e.message).replace(/https?:\/\/\S+/g,'{url}').replace(/\b[a-f0-9-]{8,}\b/g,'{id}').replace(/\d+/g,'#').slice(0,180));return base.join('|')}
function recommendation(g){
  if(g.manual)return'سجل اختبار مقصود للتحقق من مسار المراقبة؛ لا يعامل كعطل إنتاجي.';
  if(g.loss)return'راجع مسار الحفظ والمسح والاستعادة قبل أي تعديل؛ احفظ القيم قبل وبعد الحدث.';
  if(g.category==='اتصال وخدمات مراقبة')return'فشل شبكي في تسجيل النشاط أو التدقيق؛ لا ينسب إلى الصفحة التشغيلية إلا إذا ظهر معه فشل API أعمال.';
  if(g.category==='توقيعات')return'قارن مفتاح التوقيع قبل وبعد الريفريش أو فتح المستخلص، وحدد الكاتب والماسح.';
  if(g.category==='تسجيل دخول وتوكن')return'تحقق من fresh-token ثم أعد الطلب مرة واحدة فقط عند 401.';
  if(g.category==='رفع ومزامنة')return'افصل نجاح الحفظ المحلي عن نجاح الرفع، ولا تعرض نجاحًا قبل استجابة API.';
  if(g.category==='أزرار وواجهة')return'اختبر الزر في المتصفح وتحقق من listener والدالة والخطأ في Console.';
  if(g.category==='طباعة')return'قارن HTML الناتج قبل الطباعة وتحقق من وجود المحتوى وعدم فراغ النافذة.';
  return'افتح السجلات الأصلية وقارن أول وآخر ظهور والمستخدمين والصفحات المتأثرة.'
}

function rebuild(){
  enriched=events.filter(function(e){return !isExpectedPasswordInputError(e)&&!isKnownMonitorFalsePositive(e)}).map(function(e,i){
    var x=Object.assign({},e);
    x._index=i;x._category=category(e);x._manual=isManualTest(e);x._loss=x._manual?false:dataLoss(e);x._user=userKey(e);x._fp=fingerprint(e);x._time=time(e);x._missing=hasMissing(e);x._new=baselineReady&&!previousIds.has(String(e.id));
    return x
  });
  var m={};
  enriched.forEach(function(e){
    if(!m[e._fp])m[e._fp]={type:e.type||'UNKNOWN',category:e._category,severity:norm(e.severity||'info'),manual:e._manual,events:[],users:new Set(),hospitals:new Set(),pages:new Set(),builds:new Set(),first:0,last:0,lastMessage:''};
    var g=m[e._fp];g.events.push(e);g.users.add(e._user);if(e.hospital)g.hospitals.add(String(e.hospital));if(e.page)g.pages.add(String(e.page));if(e.buildVersion)g.builds.add(String(e.buildVersion));
    if(!g.first||e._time<g.first)g.first=e._time;if(e._time>=g.last){g.last=e._time;g.lastMessage=e.message||''}
    var rank={critical:0,error:1,warning:2,info:3};if((rank[norm(e.severity)]??3)<(rank[g.severity]??3))g.severity=norm(e.severity)
  });
  groups=Object.values(m).map(function(g){
    var repeated=g.events.length>1,multi=g.users.size>1,multiHosp=g.hospitals.size>1,loss=g.events.some(function(e){return e._loss}),age=Date.now()-g.last,telemetryOnly=g.events.every(isTelemetryNetworkFailure);
    if(g.manual)g.status='معلومات تشغيلية';
    else if(telemetryOnly)g.status=g.events.length>3?'يحتاج متابعة':'معلومات تشغيلية';
    else if(g.severity==='critical'||loss||(repeated&&(multi||multiHosp)))g.status='يحتاج تدخل';
    else if(g.severity==='error'||multi)g.status='يحتاج متابعة';
    else if(repeated&&age>72*3600000)g.status='متكرر معروف';
    else if(age>72*3600000)g.status='قديم غير متكرر';
    else if(repeated)g.status='يحتاج متابعة';
    else g.status='معلومات تشغيلية';
    g.repeated=repeated;g.multi=multi;g.loss=loss;g.manual=g.events.every(function(e){return e._manual});g.missing=g.events.some(function(e){return e._missing});g.newCount=g.events.filter(function(e){return e._new}).length;g.advice=recommendation(g);return g
  });
  groups.forEach(function(g,i){g.index=i});
  fillFilters()
}

function fillSelect(id,map,label){
  var e=q(id),cur=e.value;
  e.innerHTML='<option value="">'+label+'</option>'+Object.keys(map).sort().map(function(k){return'<option value="'+esc(k)+'" '+(cur===k?'selected':'')+'>'+esc(map[k])+'</option>'}).join('')
}
function fillFilters(){
  var cats={},types={},hosp={},pages={},users={},builds={};
  enriched.forEach(function(e){
    cats[e._category]=e._category;types[e.type||'UNKNOWN']=e.type||'UNKNOWN';
    if(e.hospital)hosp[e.hospital]=e.hospital;if(e.page)pages[e.page]=e.page;users[e._user]=userName(e);if(e.buildVersion)builds[e.buildVersion]=e.buildVersion
  });
  fillSelect('f-category',cats,'كل التصنيفات');fillSelect('f-type',types,'كل الأنواع');fillSelect('f-hospital',hosp,'كل المواقع');fillSelect('f-page',pages,'كل الصفحات');fillSelect('f-user',users,'كل المستخدمين');fillSelect('f-build',builds,'كل الإصدارات')
}