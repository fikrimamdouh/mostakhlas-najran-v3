// Hospital Raise Letters Final V5
// Host: achievement.html?hospitalLettersClean=1#hospital-letters-clean
// Prints hospital raise letters with full-page letterhead background for Maternity and Children's Hospital.
(function(){
'use strict';

var qs = new URLSearchParams(location.search || '');
var pageParam = qs.get('page') || '';
var sig = location.pathname + location.search;
var isLettersMode = qs.get('hospitalLettersClean') === '1' || /hospitalLettersClean=1/.test(pageParam) || /hospitalLettersClean=1/.test(location.href);
var isAchievementHost = /achievement\.html(?:$|[?#])/.test(sig) || /original-viewer\?page=achievement\.html/.test(sig) || /achievement\.html/.test(pageParam);
if (!isLettersMode || !isAchievementHost) return;
if (window.__HOSPITAL_LETTERS_AFTER_ACHIEVEMENT_V5__) return;
window.__HOSPITAL_LETTERS_AFTER_ACHIEVEMENT_V5__ = true;

var KEY = 'hospitalRaiseLettersAfterAchievement_v3';
var DOCS = [
  ['packet','طباعة ملف الخطابات كامل'],
  ['labor','خطاب العمالة للمستشفى'],
  ['noPrev','إقرار عدم أسبقية الصرف'],
  ['salary','شهادة تسليم الرواتب'],
  ['vacancies','بيان الشواغر'],
  ['vacations','بيان الإجازات'],
  ['saudi','غرامة النقص في نسبة تحقيق السعودة'],
  ['final','خطاب الرفع النهائي'],
  ['custom','خطاب مخصص / صفحة فاضية']
];

function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;')}
function clean(v){return String(v==null?'':v).replace(/[\u200e\u200f]/g,'').replace(/\s+/g,' ').trim()}
function first(){for(var i=0;i<arguments.length;i++){var v=clean(arguments[i]);if(v&&['غير محدد','undefined','null','—','-'].indexOf(v)<0)return v}return''}
function rj(k,f){try{var v=localStorage.getItem(k);return v?JSON.parse(v):f}catch(_){return f}}
function wj(k,v){try{localStorage.setItem(k,JSON.stringify(v||{}));return true}catch(_){alert('تعذر حفظ إعدادات الخطابات');return false}}
function num(v,f){if(typeof v==='string')v=v.replace(/[٬,]/g,'').replace(/[ ريال﷼()]/g,'');v=Number(v);return Number.isFinite(v)?v:(f||0)}
function money(v){return num(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}
function norm(v){var ar='٠١٢٣٤٥٦٧٨٩',fa='۰۱۲۳۴۵۶۷۸۹';return clean(v).replace(/[٠-٩]/g,function(d){return ar.indexOf(d)}).replace(/[۰-۹]/g,function(d){return fa.indexOf(d)})}
function iso(v){var s=norm(v);if(!s)return'';if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;var m=s.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);if(m)return m[3]+'-'+String(m[2]).padStart(2,'0')+'-'+String(m[1]).padStart(2,'0');m=s.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);if(m)return m[1]+'-'+String(m[2]).padStart(2,'0')+'-'+String(m[3]).padStart(2,'0');var d=new Date(s);return Number.isNaN(d.getTime())?'':d.toLocaleDateString('en-CA')}
function dmy(v){var s=iso(v);if(!s)return'غير محدد';var a=s.split('-');return Number(a[2])+'/'+Number(a[1])+'/'+a[0]}
function pay(v){var s=norm(v);return /^0*\d+$/.test(s)?String(Number(s)):(s||'—')}
function txt(sel){try{var e=document.querySelector(sel);return e?first(e.textContent,e.value,e.getAttribute('content')):''}catch(_){return''}}
function parseObj(o){if(!o)return{};if(typeof o==='object')return o;try{return JSON.parse(o)}catch(_){return{}}}
function snap(){var s=rj('najran_revision_snapshot',{});return Object.assign({},parseObj(s.persistentContractData),parseObj(s.contractData),parseObj(s.persistentExtractData),parseObj(s.extractData))}

function isMaternityHospital(name){return /الولادة|الأطفال|الاطفال|مستشفى الولادة|maternity|children/i.test(String(name||''))}
function maternityLetterheadUrl(){
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 210 297">'
    + '<rect width="210" height="297" fill="#fff"/>'
    + '<g fill="#2b9ac5" font-family="Arial, Tahoma, sans-serif" font-weight="700">'
    + '<text x="198" y="23" text-anchor="end" font-size="6.2">مستشفى الولادة والأطفال</text>'
    + '<text x="198" y="33" text-anchor="end" font-size="5.1">Maternity and Children&apos;s Hospital</text>'
    + '<line x1="129" y1="41" x2="199" y2="41" stroke="#2b9ac5" stroke-width="0.45"/>'
    + '<text x="10" y="27" font-size="4.3">تجمع نجران الصحي</text>'
    + '<text x="10" y="34" font-size="4.2">Najran Health Cluster</text>'
    + '</g>'
    + '<g transform="translate(55 82) scale(1.12)" opacity="0.095" stroke="#2b9ac5" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="M50 0 C66 22 64 43 50 62 C36 43 34 22 50 0Z"/>'
    + '<path d="M50 78 C66 99 64 122 50 140 C36 122 34 99 50 78Z"/>'
    + '<path d="M0 70 C22 54 43 56 62 70 C43 84 22 86 0 70Z"/>'
    + '<path d="M78 70 C99 54 122 56 140 70 C122 84 99 86 78 70Z"/>'
    + '<circle cx="70" cy="70" r="23"/>'
    + '</g>'
    + '<g stroke="#2b9ac5" stroke-width="0.8"><line x1="8" y1="284" x2="154" y2="284"/><line x1="174" y1="284" x2="199" y2="284"/></g>'
    + '<g fill="#2b9ac5" font-family="Arial, Tahoma, sans-serif" font-weight="700"><text x="159" y="284" font-size="3.2">تجمع نجران الصحي</text><text x="159" y="289" font-size="3.1">Najran Health Cluster</text></g>'
    + '</svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function ctx(){
  var c=rj('persistentContractData',{}),ss=rj('najran_session',{}),p=snap();
  return {
    hospital:first(localStorage.getItem('hospitalName'),localStorage.getItem('currentHospital'),txt('.hospitalName'),txt('[data-hospital-name]'),c.hospitalName,c.siteName,ss.hospitalName,p.hospitalName,'المستشفى'),
    company:first(c.companyName,c.contractorName,txt('.companyName'),txt('[data-company-name]'),localStorage.getItem('companyName'),ss.companyName,p.companyName,p.contractorName,'الشركة'),
    contract:first(c.contractDetails,c.contractName,c.scopeName,txt('.contractDetails'),txt('[data-contract-name]'),p.contractName,p.scopeName,'مشروع التشغيل والصيانة غير الطبية'),
    contractNo:first(c.contractNumber,c.contractNo,localStorage.getItem('contractNumber'),p.contractNo,p.contractNumber,'')
  };
}
function meta(){
  var e=rj('persistentExtractData',{}),p=snap(),n={};
  try{if(typeof window.getExtractPeriodDetails==='function')n=window.getExtractPeriodDetails()||{}}catch(_){}
  var start=iso(first(n.startDate,n.extractStart,e.extractStart,e.periodStart,p.extractStart,p.periodStart,localStorage.getItem('extractStart'),localStorage.getItem('periodStart')));
  var end=iso(first(n.endDate,n.extractEnd,e.extractEnd,e.periodEnd,p.extractEnd,p.periodEnd,localStorage.getItem('extractEnd'),localStorage.getItem('periodEnd')));
  var payment=pay(first(n.paymentNo,n.paymentNumber,e.paymentNumber,e.extractNumber,p.paymentNumber,p.extractNumber,localStorage.getItem('paymentNumber'),localStorage.getItem('extractNumber')));
  try{if(start){e.extractStart=start;localStorage.setItem('extractStart',start)}if(end){e.extractEnd=end;localStorage.setItem('extractEnd',end)}if(payment&&payment!=='—'){e.paymentNumber=payment;localStorage.setItem('paymentNumber',payment)}localStorage.setItem('persistentExtractData',JSON.stringify(e))}catch(_){}
  return{start:start,end:end,paymentNo:payment};
}
function defaults(){var c=ctx();return{hospitalName:c.hospital,companyName:c.company,contractName:c.contract,contractNo:c.contractNo,recipient:'سعادة / نائب الرئيس التنفيذى للتشغيل',recipientSuffix:'المحترم',managerTitle:'مدير '+c.hospital+' بنجران',managerName:'',accountantTitle:'محاسب المستشفى',accountantName:'',engineeringTitle:'مساعد مدير المستشفى للشئون الهندسية والمشاريع',engineeringName:'',unitManagerTitle:'مدير الإدارة',unitManagerName:'',declarationDate:new Date().toLocaleDateString('en-CA'),vatRate:15,amountMode:'auto',manualGrandAmount:0,requiredSaudiRate:5,printScale:100,letterheadEnabled:true,letterheadDataUrl:'',finalTo:'المكرم / مدير الإدارة المالية',finalToSuffix:'المحترم',finalOpening:'نرفق طيه المستخلص النهائي لأعمال الصيانة والنظافة والتشغيل غير الطبي حسب البيانات التالية:',finalClosing:'نأمل التكرم بالاطلاع وتوجيه الجهة المختصة نحو صرف استحقاق المقاول حسب النظام.',customTitle:'خطاب مخصص',customBody:'',includeCustom:'no'}}
function settings(){var d=defaults(),s=rj(KEY,{}),o=Object.assign(d,s);if(!s.hospitalName||s.hospitalName==='المستشفى')o.hospitalName=d.hospitalName;if(!s.companyName||s.companyName==='الشركة')o.companyName=d.companyName;if(!s.contractName)o.contractName=d.contractName;if(isMaternityHospital(o.hospitalName)&&!s.letterheadDataUrl)o.letterheadDataUrl=maternityLetterheadUrl();return o}
function save(o){return wj(KEY,Object.assign(defaults(),o||{}))}

function data(){var list=['attendanceData','ng_attendanceData','nd_attendanceData','healthCentersAttendanceData'].map(function(k){return rj(k,{})});function cnt(o){if(!o)return 0;if(Array.isArray(o))return o.length;return Object.keys(o).reduce(function(s,k){return s+(Array.isArray(o[k])?o[k].length:0)},0)}return list.reduce(function(b,x){return cnt(x)>cnt(b)?x:b},{})}
function emps(){var x=data(),a=[];function push(e){if(e&&(clean(e.name)||clean(e.employeeName)||clean(e.jobTitle)||clean(e.position)||clean(e.status)))a.push(e)}if(Array.isArray(x))x.forEach(push);else Object.keys(x||{}).forEach(function(k){(x[k]||[]).forEach(push)});return a}
function days(e){return Array.isArray(e.days)?e.days:(Array.isArray(e.attendance)?e.attendance:[])}
function name(e){return first(e.name,e.employeeName,e.fullName,'')}
function job(e){return first(e.jobTitle,e.position,e.title,e.job,'')}
function salary(e){return num(e.salary||e.monthlySalary||e.basicSalary||e.cost||0)}
function totalSalary(){return emps().reduce(function(s,e){return s+salary(e)},0)}
function isSaudi(e){var n=clean(e.nationality||e.nationalityName||e.country||e.citizenship||''),st=clean(e.status||e.category||e.type||'');return /سعود|saudi/i.test(n)||/سعود|saudi/i.test(st)||e.isSaudi===true}
function vacancies(){return emps().filter(function(e){return name(e)===''||name(e)==='شاغر'||clean(e.status)==='شاغر'||days(e).indexOf('ش')>=0})}
function vacations(){return emps().filter(function(e){return days(e).indexOf('ج')>=0||days(e).indexOf('إ')>=0})}
function saudis(){return emps().filter(isSaudi)}
function amount(s){var net=0,keys=['finalLaborCost_'+(s.hospitalName||''),'finalLaborCost','grand-net-total-admin','grandNetTotal','laborNetTotal'];for(var i=0;i<keys.length;i++){var v=localStorage.getItem(keys[i]);if(num(v)>0){net=num(v);break}}if(!net)net=totalSalary();var vat=net*num(s.vatRate,15)/100,grand=net+vat;if(s.amountMode==='manual'){grand=num(s.manualGrandAmount);net=grand/(1+num(s.vatRate,15)/100);vat=grand-net}return{net:net,vat:vat,grand:grand}}

function page(body,s,cls){
  var bg=s.letterheadEnabled!==false&&s.letterheadDataUrl?' style="background-image:url('+esc(s.letterheadDataUrl)+')"':'';
  var fallback=bg?'':'<div class="lh-head"><div class="lh-right">'+esc(s.hospitalName)+'<span>Maternity and Children\'s Hospital</span></div><div class="lh-left">تجمع نجران الصحي<br><span>Najran Health Cluster</span></div></div><div class="lh-mark">✦</div><div class="lh-foot">تجمع نجران الصحي</div>';
  return'<section class="rl-page '+(cls||'')+'"'+bg+'>'+fallback+'<main>'+body+'</main></section>'
}
function sig2(s){return'<div class="sig2"><div><b>'+esc(s.engineeringTitle)+'</b><br><br><b>'+esc(s.engineeringName)+'</b></div><div><b>'+esc(s.accountantTitle)+'</b><br><br><b>'+esc(s.accountantName)+'</b></div></div>'}
function manager(s){return'<div class="manager"><b>'+esc(s.managerTitle)+'</b><br><br><b>'+esc(s.managerName)+'</b></div>'}
function amountTable(a,s){return'<table class="amt"><tr><td>المبلغ الصافى الشهرى<br>المستحق للمقاول</td><td>'+money(a.net)+'</td></tr><tr><td>ضريبة القيمة المضافة '+num(s.vatRate,15)+'%</td><td>'+money(a.vat)+'</td></tr><tr><td>الاجمـــــــــــــــــــــــــالى</td><td>'+money(a.grand)+'</td></tr></table>'}
function labor(s){var m=meta(),a=amount(s);return page('<div class="to">'+esc(s.recipient)+'<br>'+esc(s.recipientSuffix)+'</div><p class="salam">السلام عليكم ورحمة الله وبركاته ...</p><p class="center big">مرفق طيه المستخلص الشهري لشركة '+esc(s.companyName)+'<br>والخاص ببند (العمالة) بـ'+esc(s.hospitalName)+'<br>بمنطقة نجران دفعة رقم ('+esc(m.paymentNo)+') للفترة من '+dmy(m.start)+' م وحتى '+dmy(m.end)+' م</p>'+amountTable(a,s)+'<p class="center lower">لذا نأمل بعد الإطلاع إحالته إلى جهة الاختصاص لتدقيقه وصرف مستحقات المقاول /<br>'+esc(s.companyName)+'.</p><p class="regards">وتقبلوا تحياتنا ,,</p>'+manager(s),s,'labor')}
function finalRaise(s){var m=meta(),a=amount(s);return page('<div class="to">'+esc(s.finalTo)+'<br>'+esc(s.finalToSuffix)+'</div><p class="salam">السلام عليكم ورحمة الله وبركاته، وبعد،،</p><p class="body">'+esc(s.finalOpening)+'</p><table class="amt final"><tr><td>المستشفى</td><td>'+esc(s.hospitalName)+'</td></tr><tr><td>الشركة</td><td>'+esc(s.companyName)+'</td></tr><tr><td>الفترة</td><td>من '+dmy(m.start)+' إلى '+dmy(m.end)+'</td></tr><tr><td>رقم الدفعة</td><td>'+esc(m.paymentNo)+'</td></tr><tr><td>الإجمالي شامل الضريبة</td><td>'+money(a.grand)+'</td></tr></table><p class="body">'+esc(s.finalClosing)+'</p>'+manager(s),s,'final')}
function noPrev(s){var m=meta(),a=amount(s);return page('<div class="date">تاريخ القرار : '+dmy(s.declarationDate||m.end)+'</div><h1 class="title u">إقرار بعدم أسبقية الصرف</h1><p class="cert">تشهد إدارة '+esc(s.hospitalName)+' بنجران<br>بأن استحقاق شركة /<br>'+esc(s.companyName)+'<br>لمستخلص العمالة لفترة المستخلص دفعة<br>رقم ('+esc(m.paymentNo)+') بمبلغ ('+money(a.grand)+' ريال)<br><br>. لم يسبق صرف هذا المستخلص من قبلنا</p><p class="regards">،،، مع أطيب تحياتي</p><div class="adminSig"><div><b>الموظف المختص</b><br><br>الاسم : '+esc(s.unitManagerName)+'</div><div><b>مدير الإدارة</b><br><br>الاسم : '+esc(s.managerName)+'</div></div><div class="stamp">الختم</div>',s,'noprev')}
function salaryCert(s){var m=meta();return page('<h1 class="title u">شهادة</h1><p class="cert text">تشهد إدارة '+esc(s.hospitalName)+' بنجران<br>بأن '+esc(s.companyName)+'<br>قامت بتسليم جميع الرواتب لكل منسوبيها<br>داخل الموقع وذلك عن الفترة من '+dmy(m.start)+' وحتى<br>'+dmy(m.end)+'م .<br><br>وهذا مشهد منا بذلك .</p>'+sig2(s),s,'salary')}
function vacanciesPage(s){var m=meta(),rows=vacancies().map(function(e,i){return'<tr><td>'+(i+1)+'</td><td>'+esc(job(e)||'شاغر')+'</td><td>'+dmy(m.start)+'</td><td>'+dmy(m.end)+'</td><td>'+esc(e.notes||'')+'</td></tr>'}).join('')||'<tr><td colspan="5">لا توجد شواغر</td></tr>';return page('<h1 class="tableTitle">بيان بملخص الشواغر عن الفترة من '+dmy(m.start)+'م وحتى '+dmy(m.end)+'م</h1><table class="tbl"><thead><tr><th>م</th><th>مسمى الوظيفة</th><th colspan="2">الفترة</th><th>ملاحظات</th></tr><tr><th></th><th></th><th>من</th><th>إلى</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>'+sig2(s),s,'table')}
function vacationsPage(s){var m=meta(),rows=vacations().map(function(e,i){return'<tr><td>'+(i+1)+'</td><td>'+esc(name(e))+'</td><td>'+esc(job(e))+'</td><td>'+dmy(m.start)+'</td><td>'+dmy(m.end)+'</td><td>'+esc(e.notes||'')+'</td></tr>'}).join('')||'<tr><td colspan="6">لا توجد إجازات</td></tr>';return page('<h1 class="tableTitle u">بيان بملخص الاجازات عن الفترة من '+dmy(m.start)+' الى '+dmy(m.end)+'</h1><table class="tbl vacations"><thead><tr><th>م</th><th>اسم صاحب الوظيفة</th><th>مسمى الوظيفة</th><th colspan="2">الفترة</th><th>ملاحظات</th></tr><tr><th></th><th></th><th></th><th>من</th><th>إلى</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>'+sig2(s),s,'table vacation')}
function saudiPage(s){var m=meta(),all=emps(),vac=vacancies().length,sa=saudis().length,total=Math.max(all.length,sa+vac),req=num(s.requiredSaudiRate,5),actual=total?sa*100/total:0,short=Math.max(0,req-actual);return page('<h1 class="title u small">غرامة النقص في نسبة تحقيق السعودة المطلوبة بالعقد</h1><div class="project"><b>'+esc(s.contractName)+'</b><br><b>'+esc(s.hospitalName)+'</b><br><br><b>الفترة من : '+dmy(m.start)+' وحتى '+dmy(m.end)+'م</b></div><table class="tbl saudi"><thead><tr><th>عدد الوظائف بالعقد</th><th>عدد السعوديين الفعلي</th><th>عدد الوظائف الشاغرة</th><th>النسبة المطلوبة حسب التعميم العام 1428هـ</th><th>نسبة السعوديين الفعلية</th><th>نسبة عدم تحقيق السعودة</th></tr></thead><tbody><tr><td>'+total+'</td><td>'+sa+'</td><td>'+vac+'</td><td>'+req+'%</td><td>'+actual.toFixed(2)+'%</td><td>'+short.toFixed(2)+'%</td></tr></tbody></table>'+sig2(s),s,'saudiPage')}
function custom(s){return page('<h1 class="title u">'+esc(s.customTitle)+'</h1><div class="body custom">'+esc(s.customBody).replace(/\n/g,'<br>')+'</div>'+manager(s),s,'custom')}
function build(k,s){if(k==='labor')return labor(s);if(k==='noPrev')return noPrev(s);if(k==='salary')return salaryCert(s);if(k==='vacancies')return vacanciesPage(s);if(k==='vacations')return vacationsPage(s);if(k==='saudi')return saudiPage(s);if(k==='final')return finalRaise(s);if(k==='custom')return custom(s);if(k==='packet'){var arr=['labor','noPrev','salary','vacancies','vacations','saudi','final'];if(s.includeCustom==='yes')arr.push('custom');return arr.map(function(x){return build(x,s)}).join('')}return''}

function css(s){var scale=Math.max(80,Math.min(120,num(s.printScale,100)))/100;return'<style>@page{size:A4 portrait;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#e5e7eb;direction:rtl;font-family:Tajawal,Arial,sans-serif;color:#000}.rl-page{width:210mm;height:297mm;margin:0 auto 10px;background:#fff center/210mm 297mm no-repeat;position:relative;page-break-after:always;overflow:hidden}.rl-page:last-child{page-break-after:auto}.rl-page main{position:absolute;inset:47mm 18mm 25mm 18mm;transform:scale('+scale+');transform-origin:top center;font-weight:900}.lh-head{position:absolute;top:13mm;left:14mm;right:14mm;display:flex;justify-content:space-between;align-items:flex-start;color:#1689b1;font-weight:900}.lh-right{text-align:right;font-size:16pt}.lh-right span{display:block;font-size:10pt}.lh-left{text-align:left;font-size:11pt}.lh-mark{position:absolute;left:37mm;top:66mm;width:135mm;height:135mm;opacity:.08;color:#1689b1;font-size:120mm;text-align:center;line-height:135mm}.lh-foot{position:absolute;right:28mm;bottom:11mm;color:#1689b1;font-size:8pt;font-weight:900}.rl-page:after{content:"";position:absolute;left:10mm;right:35mm;bottom:17mm;border-bottom:2px solid #4aa3c7}.to{font-size:18pt;text-align:right;margin:8mm 52mm 14mm 0;line-height:1.35}.salam{text-align:center;font-size:16pt;margin:8mm 0}.center{text-align:center}.big{font-size:17pt;line-height:1.35}.lower{font-size:16pt;margin-top:7mm}.regards{text-align:center;font-size:17pt;margin-top:7mm}.body{font-size:16pt;line-height:1.7;text-align:justify}.title{text-align:center;font-size:24pt;margin:12mm 0}.title.small{font-size:17pt;margin:3mm 0 8mm}.u{text-decoration:underline}.date{font-size:16pt;margin:1mm 12mm 12mm 0}.cert{font-size:21pt;line-height:1.55;text-align:center;margin:0 auto;width:155mm}.cert.text{text-align:justify;text-align-last:right;width:145mm}.amt{border-collapse:collapse;margin:6mm auto;width:155mm;font-size:16pt;direction:ltr}.amt td{border:1px solid #333;padding:1.6mm 3mm;text-align:center;font-weight:900}.amt td:first-child{direction:rtl;width:105mm}.amt.final{direction:rtl;font-size:13pt}.manager{position:absolute;right:50mm;bottom:14mm;font-size:18pt;text-align:center;line-height:1.8}.adminSig{display:grid;grid-template-columns:1fr 1fr;gap:24mm;margin-top:10mm;font-size:16pt;line-height:1.8}.stamp{text-align:center;font-size:17pt;margin-top:9mm}.sig2{display:grid;grid-template-columns:1fr 1fr;gap:24mm;position:absolute;left:22mm;right:22mm;bottom:28mm;font-size:16pt;line-height:1.65;text-align:center}.tableTitle{text-align:center;font-size:17pt;margin:0 0 5mm}.tbl{width:100%;border-collapse:collapse;font-size:13pt}.tbl th,.tbl td{border:1px solid #333;padding:1.8mm;text-align:center;vertical-align:middle;line-height:1.25}.tbl th{font-weight:900}.table main{inset:52mm 18mm 25mm 18mm}.vacation main{inset:55mm 5mm 25mm 5mm}.vacations{font-size:15pt}.project{text-align:center;font-size:17pt;line-height:1.9;margin:9mm 0}.saudiPage main{inset:52mm 30mm 25mm 30mm}.saudi{font-size:12pt}.custom{white-space:pre-wrap}@media print{html,body{background:#fff}.rl-page{margin:0;box-shadow:none}}</style>'}
function print(k){var s=settings(),w=window.open('','_blank','width=1200,height=900');if(!w)return alert('المتصفح منع فتح نافذة الطباعة.');w.document.open();w.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>'+esc(k)+'</title><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap" rel="stylesheet">'+css(s)+'</head><body>'+build(k,s)+'</body></html>');w.document.close();setTimeout(function(){try{w.focus();w.print()}catch(_){ }},600)}

function field(k,l,v,type){return'<label><span>'+esc(l)+'</span><input data-f="'+k+'" type="'+(type||'text')+'" value="'+esc(v==null?'':v)+'"></label>'}
function area(k,l,v){return'<label class="wide"><span>'+esc(l)+'</span><textarea data-f="'+k+'">'+esc(v||'')+'</textarea></label>'}
function panel(){var s=settings(),btns=DOCS.map(function(d){return'<button data-print="'+d[0]+'">'+esc(d[1])+'</button>'}).join('');var f='';[['hospitalName','اسم المستشفى'],['companyName','اسم الشركة / المقاول'],['contractName','اسم العقد'],['recipient','المخاطب'],['recipientSuffix','صفة المخاطب'],['managerTitle','صفة مدير المستشفى'],['managerName','اسم مدير المستشفى'],['accountantTitle','صفة المحاسب'],['accountantName','اسم المحاسب'],['engineeringTitle','صفة الشئون الهندسية'],['engineeringName','اسم الشئون الهندسية'],['unitManagerTitle','صفة توقيع الإقرار'],['unitManagerName','اسم توقيع الإقرار'],['finalTo','خطاب الرفع النهائي - إلى'],['finalToSuffix','صفة الموجه إليه']].forEach(function(x){f+=field(x[0],x[1],s[x[0]])});[['vatRate','ضريبة القيمة المضافة %'],['manualGrandAmount','مبلغ يدوي شامل الضريبة'],['requiredSaudiRate','النسبة المطلوبة للسعودة %'],['printScale','تكبير/تصغير الطباعة %']].forEach(function(x){f+=field(x[0],x[1],s[x[0]],'number')});f+=area('finalOpening','افتتاح خطاب الرفع النهائي',s.finalOpening)+area('finalClosing','ختام خطاب الرفع النهائي',s.finalClosing)+area('customBody','نص الخطاب المخصص',s.customBody)+'<label><span>طريقة المبلغ</span><select data-f="amountMode"><option value="auto" '+(s.amountMode==='auto'?'selected':'')+'>تلقائي</option><option value="manual" '+(s.amountMode==='manual'?'selected':'')+'>يدوي شامل الضريبة</option></select></label><label><span>إرفاق الخطاب المخصص في الملف</span><select data-f="includeCustom"><option value="no" '+(s.includeCustom!=='yes'?'selected':'')+'>لا</option><option value="yes" '+(s.includeCustom==='yes'?'selected':'')+'>نعم</option></select></label><label class="wide"><span>رفع صورة ترويسة كاملة بدل الخلفية الافتراضية</span><input type="file" id="rl-head-file" accept="image/*"></label>';var bgMsg=isMaternityHospital(s.hospitalName)?'خلفية الولادة والأطفال مثبتة كـ background كامل للصفحة.':'سيتم استخدام خلفية عامة، ويمكن رفع صورة ترويسة خاصة.';return'<div id="rl-root"><div class="rl-card"><div class="rl-top"><div><h2>خطابات رفع المستشفيات</h2><p>'+bgMsg+'</p></div><button id="rl-save">حفظ الإعدادات</button></div><div class="rl-actions">'+btns+'</div><details open><summary>الإعدادات</summary><div class="rl-grid">'+f+'</div></details></div></div>'}
function appCss(){return'<style id="rl-css">body.hospital-letters-mode .main-content-area,body.hospital-letters-mode #_najran_approve_btn{display:none!important}#rl-root{direction:rtl;font-family:Tajawal,Arial,sans-serif;margin:24px auto;max-width:1200px;position:relative;z-index:9999}.rl-card{background:#fff;border:1px solid #dbe4f0;border-radius:18px;box-shadow:0 12px 35px rgba(15,23,42,.10);padding:22px}.rl-top{display:flex;justify-content:space-between;gap:16px;align-items:center;border-bottom:1px solid #e5e7eb;padding-bottom:14px}.rl-top h2{margin:0;color:#003087}.rl-top p{margin:6px 0 0;color:#64748b}.rl-actions{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0}.rl-actions button,#rl-save{border:0;border-radius:10px;background:#475569;color:#fff;padding:10px 14px;font-weight:900;cursor:pointer}#rl-save{background:#16a34a}.rl-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;margin-top:14px}label{display:flex;flex-direction:column;gap:5px}.wide{grid-column:1/-1}label span{font-size:13px;font-weight:900;color:#334155}input,textarea,select{border:1px solid #cbd5e1;border-radius:9px;padding:9px;font-family:inherit}textarea{min-height:90px}summary{font-weight:900;cursor:pointer;color:#003087}</style>'}
function collect(){var s=settings();document.querySelectorAll('[data-f]').forEach(function(el){var k=el.getAttribute('data-f'),v=el.value;if(el.type==='number')v=num(v);s[k]=v});save(s);alert('تم حفظ إعدادات الخطابات.');mount()}
function headFile(ev){var f=ev.target.files&&ev.target.files[0];if(!f)return;var rd=new FileReader();rd.onload=function(){var s=settings();s.letterheadDataUrl=String(rd.result||'');s.letterheadEnabled=true;save(s);alert('تم حفظ الترويسة كخلفية كاملة للصفحة.');mount()};rd.readAsDataURL(f)}
function mount(){document.body.classList.add('hospital-letters-mode');var old=document.getElementById('rl-root');if(old)old.remove();if(!document.getElementById('rl-css'))document.head.insertAdjacentHTML('beforeend',appCss());var host=document.createElement('div');host.innerHTML=panel();document.body.appendChild(host.firstChild);document.querySelectorAll('[data-print]').forEach(function(b){b.onclick=function(){print(this.getAttribute('data-print'))}});document.getElementById('rl-save').onclick=collect;var hf=document.getElementById('rl-head-file');if(hf)hf.onchange=headFile;console.info('[HospitalLetters] mounted V5, mode=', location.href)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
