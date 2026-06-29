// Hospital Raise Letters Engine V8
// Scope: hospital normal raise letters only.
// Official templates share admin-offices document quality while keeping hospital issuer/data/header.
(function(){
'use strict';
if(!/hospital_raise_letters\.html/.test(location.pathname)&&!window.__HOSPITAL_LETTERS_STANDALONE_PAGE__&&!/hospitalLettersClean=1/.test(location.href))return;
if(window.__HL_ENGINE_V8__)return;
window.__HL_ENGINE_V8__=1;
try{if(/hospital_raise_letters\.html/.test(location.pathname)&&(location.search||location.hash))history.replaceState(null,'','/original/hospital_raise_letters.html')}catch(e){}

var KEY='hospitalRaiseLettersSettings_v8';
var OLD=['hospitalRaiseLettersSettings_v7','hospitalRaiseLettersSettings_v6'];
var VISUAL_MARK='__hospitalOfficeQualityV12';
var TEMPLATE_MARK='__hospitalOfficialTemplatesV12';
var LINE_MM=6,DEFAULT_SCALE=72;
var DOC={labor:'خطاب العمالة',noPrev:'عدم أسبقية الصرف',salary:'شهادة تسليم الرواتب',vacancies:'بيان الشواغر',vacations:'بيان الإجازات',saudi:'بيان السعودة',final:'خطاب الرفع النهائي',custom:'خطاب مخصص'};
var DOC_ORDER=['labor','noPrev','salary','vacancies','vacations','saudi','final','custom'];
var __previewTimer=0,__lastPreview='';

function E(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[c]})}
function J(k,f){try{var x=localStorage.getItem(k);return x?JSON.parse(x):f}catch(e){return f}}
function SV(s){try{localStorage.setItem(KEY,JSON.stringify(s||{}));OLD.forEach(function(k){try{localStorage.removeItem(k)}catch(e){}});return true}catch(e){alert('تعذر حفظ إعدادات الخطابات. غالباً حجم صورة الترويسة كبير. صغّر الصورة ثم ارفعها مرة أخرى.');return false}}
function N(v){return Number(String(v==null?0:v).replace(/[٬, ريال﷼]/g,''))||0}
function M(v){return N(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}
function P(){for(var i=0;i<arguments.length;i++){var v=String(arguments[i]||'').trim();if(v&&v!=='undefined'&&v!=='null'&&v!=='غير محدد'&&v!=='—')return v}return''}
function RV(){var on=localStorage.getItem('najran_revision_mode')==='true'||localStorage.getItem('najran_editing_submitted_extract_mode')==='true';if(!on)return{};var s=J('najran_revision_snapshot',{}),p=s.persistentExtractData;if(typeof p==='string'){try{p=JSON.parse(p||'{}')}catch(e){p={}}}return p&&typeof p==='object'?p:{}}
function V(){var c=J('persistentContractData',{}),e=J('persistentExtractData',{}),r=RV();return{h:P(c.hospitalName,c.siteName,r.hospitalName,localStorage.hospitalName,localStorage.currentHospital,'المستشفى'),co:P(c.companyName,c.contractorName,r.companyName,localStorage.companyName,'الشركة'),cn:P(c.contractDetails,c.contractName,c.scopeName,r.contractName,'مشروع التشغيل والصيانة غير الطبية'),st:P(e.extractStart,e.periodStart,e.startDate,r.extractStart,r.periodStart,r.startDate,localStorage.extractStart,'غير محدد'),en:P(e.extractEnd,e.periodEnd,e.endDate,r.extractEnd,r.periodEnd,r.endDate,localStorage.extractEnd,'غير محدد'),pay:P(e.paymentNumber,e.extractNumber,e.paymentNo,r.paymentNumber,r.extractNumber,r.paymentNo,localStorage.paymentNumber,'—')}}
function contractNo(){var c=J('persistentContractData',{});return P(c.contractNumber,c.contractNo,c.number,localStorage.contractNumber,'—')}
function ibanNo(){var c=J('persistentContractData',{});return P(c.iban,c.bankIban,c.accountIban,c.bankAccount,localStorage.contractorIban,'SA................................')}
function D(x){if(!x||x==='غير محدد')return'غير محدد';var s=String(x).replace(/[٠-٩]/g,function(d){return'٠١٢٣٤٥٦٧٨٩'.indexOf(d)}),m=s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);if(m)return Number(m[3])+'/'+Number(m[2])+'/'+m[1];m=s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);return m?Number(m[1])+'/'+Number(m[2])+'/'+m[3]:s}
function an(i){return String(i).replace(/\d/g,function(d){return'٠١٢٣٤٥٦٧٨٩'[d]})}

function officeLayout(){return{top:0,right:0,width:174,align:'right',font:14,line:1.85,titleVisible:'yes',titleFirst:'yes',titleTop:0,titleRight:0,titleWidth:100,titleFont:13,titleAlign:'center',titleAfter:15,titleWeight:900,titleColor:'#000000',titleUnderline:'yes',recipientVisible:'yes',recipientFont:15,recipientAlign:'right',recipientGap:8,recipientWeight:900,recipientColor:'#000000',recipientSpread:'yes',greetingVisible:'yes',greetingText:'السلام عليكم ورحمة الله وبركاته، وبعد:',greetingFont:15,greetingAlign:'center',greetingAfter:8,greetingWeight:900,greetingColor:'#000000',bodyVisible:'yes',bodyFont:15,bodyAlign:'justify',bodyLine:2.12,bodyWidth:100,bodyRight:0,bodyAfter:8,bodyWeight:700,bodyColor:'#000000',closeVisible:'yes',closeColor:'#000000',tableTop:9,tableWidth:132,tableFont:12.5,tableAlign:'center',showTable:'yes',tableRowHeight:8,tableHeaderBg:'#ffffff',tableHeaderText:'#000000',tableBodyBg:'#ffffff',tableBodyText:'#000000',tableBorder:'#000000',sigTop:24,signatureEnabled:'yes',signatureFont:14,signatureColumns:1,signatureCount:1,signatureAlign:'center',signatureWeight:800,signatureGap:16,signatureColor:'#000000',signatureLine:'yes',stampVisible:'no',stampTop:12,stampColor:'#000000',noteVisible:'no',noteFont:12,noteAlign:'center',noteTop:6,noteColor:'#000000'}}
function defaultLayouts(){var L={};DOC_ORDER.forEach(function(k){L[k]=officeLayout()});L.labor=Object.assign(officeLayout(),{titleFont:16,titleAfter:12,tableWidth:150,bodyLine:2.1});L.final=Object.assign(officeLayout(),{titleFont:13,titleAfter:14,tableWidth:128,tableFont:13,sigTop:26});L.noPrev=Object.assign(officeLayout(),{titleFont:17,tableWidth:140,stampVisible:'yes'});L.salary=Object.assign(officeLayout(),{titleFont:18,width:160,bodyFont:16,bodyLine:2.15});L.vacancies=Object.assign(officeLayout(),{width:185,tableWidth:180,tableFont:12,bodyAlign:'center',sigTop:24,titleFont:16});L.vacations=Object.assign(officeLayout(),{width:185,tableWidth:180,tableFont:12,bodyAlign:'center',sigTop:24,titleFont:16});L.saudi=Object.assign(officeLayout(),{width:170,tableWidth:165,tableFont:11,bodyAlign:'center',titleFont:15});return L}
function defaultLetters(v){return{
 labor:{recipient:'سعادة / مساعد المدير العام للدعم المساند',suffix:'المحترم',title:'خطاب رفع مستخلص العمالة',body:'نرفق لسعادتكم مستخلص بند العمالة الخاص بـ {companyName} عن {periodText}، وذلك مقابل الأعمال المنفذة ضمن نطاق {contractName} بموقع {hospitalName}، حسب البيانات والمرفقات المؤيدة.',close:'نأمل التكرم بالاطلاع وإحالة المستخلص إلى جهة الاختصاص لتدقيقه واستكمال إجراءات صرف مستحقات المقاول حسب النظام.',note:'',sign1Title:'{issuerSignatureTitle}',sign1Name:'{issuerSignatureName}',sign2Title:'',sign2Name:'',sign3Title:'',sign3Name:''},
 noPrev:{recipient:'',suffix:'',title:'إقرار بعدم أسبقية الصرف',body:'تشهد {issuerName} بأن مستخلص {companyName} الخاص بـ {contractName} بموقع {hospitalName} عن {periodText}، والبالغ إجماليه {grandAmount} ريال، لم يسبق صرفه من قبل، ولم يتم رفعه للصرف ضمن أي مستخلص سابق حسب السجلات المتاحة لدينا.',close:'حرر هذا الإقرار بناءً على البيانات المعتمدة لدينا لاستخدامه فيما يلزم نظاماً.',note:'',sign1Title:'{issuerSignatureTitle}',sign1Name:'{issuerSignatureName}',sign2Title:'',sign2Name:'',sign3Title:'',sign3Name:''},
 salary:{recipient:'',suffix:'',title:'شهادة تسليم رواتب',body:'تشهد {issuerName} بأن {companyName} قامت بتسليم رواتب العاملين التابعين لها داخل موقع {hospitalName} عن {periodText}، وذلك بحسب ما تم تقديمه من مستندات ومرفقات، ودون أن يترتب على هذه الشهادة أي تعديل على الحسابات أو المستحقات النظامية.',close:'وقد أعطيت هذه الشهادة بناءً على طلب الشركة لاستخدامها ضمن مستندات المستخلص.',note:'',sign1Title:'{issuerSignatureTitle}',sign1Name:'{issuerSignatureName}',sign2Title:'',sign2Name:'',sign3Title:'',sign3Name:''},
 vacancies:{recipient:'',suffix:'',title:'بيان بملخص الشواغر',body:'نرفق بيان الوظائف الشاغرة بموقع {hospitalName} عن {periodText}، وذلك ضمن مستندات مستخلص {companyName}.',close:'للاطلاع واستكمال ما يلزم حسب النظام.',note:'',sign1Title:'{issuerSignatureTitle}',sign1Name:'{issuerSignatureName}',sign2Title:'',sign2Name:'',sign3Title:'',sign3Name:''},
 vacations:{recipient:'',suffix:'',title:'بيان بملخص الإجازات',body:'نرفق بيان الإجازات المسجلة للعاملين بموقع {hospitalName} عن {periodText}، وذلك ضمن مستندات مستخلص {companyName}.',close:'للاطلاع واستكمال ما يلزم حسب النظام.',note:'',sign1Title:'{issuerSignatureTitle}',sign1Name:'{issuerSignatureName}',sign2Title:'',sign2Name:'',sign3Title:'',sign3Name:''},
 saudi:{recipient:'',suffix:'',title:'بيان السعودة',body:'نرفق بيان نسبة السعودة والوظائف المشغولة بالسعوديين بموقع {hospitalName} عن {periodText} ضمن مستندات مستخلص {companyName}.',close:'للاطلاع واستكمال ما يلزم حسب النظام.',note:'',sign1Title:'{issuerSignatureTitle}',sign1Name:'{issuerSignatureName}',sign2Title:'',sign2Name:'',sign3Title:'',sign3Name:''},
 final:{recipient:'المكرم / مدير الإدارة المالية',suffix:'المحترم',title:'مستخلص {contractName}',body:'نرفق طيه المستخلص النهائي لأعمال الصيانة والنظافة والتشغيل غير الطبي بموقع {hospitalName}، والمنفذة من قبل {companyName}، حسب البيانات التالية:',close:'نأمل التكرم بالاطلاع وتوجيه الجهة المختصة نحو صرف استحقاق المقاول حسب النظام.',note:'مع أطيب تحياتي وتقديري،،',sign1Title:'{issuerSignatureTitle}',sign1Name:'{issuerSignatureName}',sign2Title:'',sign2Name:'',sign3Title:'',sign3Name:''},
 custom:{recipient:'',suffix:'',title:'خطاب مخصص',body:'',close:'',note:'',sign1Title:'{issuerSignatureTitle}',sign1Name:'{issuerSignatureName}',sign2Title:'',sign2Name:'',sign3Title:'',sign3Name:''}
}}
function DEF(){var v=V(),L=defaultLayouts();return{selectedDocKey:'labor',hospitalName:v.h,companyName:v.co,contractName:v.cn,issuerName:'إدارة '+v.h,issuerDepartment:'إدارة الشئون الهندسية',issuerLocation:'نجران',issuerSignatureTitle:'مدير '+v.h,issuerSignatureName:'',managerTitle:'مدير '+v.h+' بنجران',managerName:'',accountantTitle:'محاسب المستشفى',accountantName:'',engineeringTitle:'مساعد مدير المستشفى للشئون الهندسية والمشاريع',engineeringName:'',unitManagerTitle:'مدير الإدارة',unitManagerName:'',employeeTitle:'الموظف المختص',employeeName:'',vatRate:15,manualGrand:0,requiredSaudi:5,customBody:'',letterheadEnabled:false,letterheadDataUrl:'',letterheadMode:'external',letterheadHeightMm:45,contentTopMm:0,blankLines:0,lineHeightMm:LINE_MM,printScale:DEFAULT_SCALE,layout:L,letters:defaultLetters(v)}}
function applyOfficialDefaults(s){var d=DEF();if(!s[VISUAL_MARK]){var base=defaultLayouts();s.layout=s.layout||{};DOC_ORDER.forEach(function(k){s.layout[k]=Object.assign({},s.layout[k]||{},base[k]||officeLayout())});s[VISUAL_MARK]=true}if(!s[TEMPLATE_MARK]){s.letters=Object.assign({},d.letters);s[TEMPLATE_MARK]=true}return s}
function C(){var d=DEF(),s=J(KEY,null);if(!s){for(var i=0;i<OLD.length&&!s;i++)s=J(OLD[i],null)}s=Object.assign(d,s||{});if(!s.printScale)s.printScale=DEFAULT_SCALE;if(!s.lineHeightMm)s.lineHeightMm=LINE_MM;if(!s.letterheadHeightMm)s.letterheadHeightMm=45;s.letters=Object.assign(d.letters,s.letters||{});s.layout=Object.assign(d.layout,s.layout||{});Object.keys(d.letters).forEach(function(k){s.letters[k]=Object.assign(d.letters[k],s.letters[k]||{});s.layout[k]=Object.assign(d.layout[k],s.layout[k]||{})});return applyOfficialDefaults(s)}
function SET(o,p,v){p=p.split('.');for(var i=0;i<p.length-1;i++){o[p[i]]=o[p[i]]||{};o=o[p[i]]}o[p[p.length-1]]=v}

function EM(){var d=J('attendanceData',{}),r=[];function add(e){if(e&&(P(e.name,e.employeeName,e.fullName,e.jobTitle,e.position,e.status)||N(e.salary)>0))r.push(e)}if(Array.isArray(d))d.forEach(add);else Object.keys(d||{}).forEach(function(k){(Array.isArray(d[k])?d[k]:[]).forEach(add)});if(!r.length&&window.console)console.warn('[HospitalLetters] لا توجد بيانات attendanceData للمستخلص العادي. تم منع قراءة مفاتيح حضور أخرى عشوائياً.');return r}
function nm(e){return P(e.name,e.employeeName,e.fullName)}
function jb(e){return P(e.jobTitle,e.position,e.title,e.job)}
function st(e){return P(e.status,e.attendanceStatus,e.type)}
function dy(e){var d=e.days||e.attendance||e.statuses||[];return Array.isArray(d)?d:(d&&typeof d==='object'?Object.values(d):[])}
function vac(e){return !nm(e)||/شاغر/.test(nm(e))||/شاغر/.test(st(e))||dy(e).indexOf('ش')>=0}
function leave(e){return /إجاز|اجاز/.test(st(e))||dy(e).indexOf('ج')>=0||dy(e).indexOf('إ')>=0}
function saud(e){return /سعود|saudi/i.test(P(e.nationality,e.nationalityName,e.country,e.citizenship,st(e)))||e.isSaudi===true}
function AM(s){var a=['finalLaborCost_'+s.hospitalName,'finalLaborCost','grandNetTotal','laborNetTotal','netAmount'],net=0,src='';for(var i=0;i<a.length;i++){net=N(localStorage.getItem(a[i]));if(net>0){src=a[i];break}}if(N(s.manualGrand)>0){net=N(s.manualGrand)/(1+N(s.vatRate)/100);src='manualGrand'}if(!net&&window.console)console.warn('[HospitalLetters] لا يوجد مبلغ صافي مؤكد. تم منع جمع رواتب الموظفين كبديل.');var vat=net*N(s.vatRate)/100;return{net:net,vat:vat,grand:net+vat,source:src}}
function tr(x){var u=['','واحد','اثنان','ثلاثة','أربعة','خمسة','ستة','سبعة','ثمانية','تسعة'],t=['','عشرة','عشرون','ثلاثون','أربعون','خمسون','ستون','سبعون','ثمانون','تسعون'],h=['','مائة','مائتان','ثلاثمائة','أربعمائة','خمسمائة','ستمائة','سبعمائة','ثمانمائة','تسعمائة'],te=['عشرة','أحد عشر','اثنا عشر','ثلاثة عشر','أربعة عشر','خمسة عشر','ستة عشر','سبعة عشر','ثمانية عشر','تسعة عشر'],a=[];if(x>=100){a.push(h[Math.floor(x/100)]);x%=100}if(x>=20){if(x%10)a.push(u[x%10]);a.push(t[Math.floor(x/10)])}else if(x>=10)a.push(te[x-10]);else if(x>0)a.push(u[x]);return a.join(' و ')}
function T(v){var q=Math.round(N(v)*100),r=Math.floor(q/100),h=q%100,p=[],m=Math.floor(r/1000000),th=Math.floor((r%1000000)/1000),rr=r%1000;if(m)p.push(tr(m)+' مليون');if(th)p.push(tr(th)+' ألف');if(rr)p.push(tr(rr));var out='فقط وقدره '+(p.join(' و ')||'صفر')+' ريال سعودي';if(h)out+=' و '+tr(h)+' هللة';return out+' لا غير'}

function L(s,k){return s.layout[k]||officeLayout()}
function totalTop(s){return N(s.contentTopMm)+N(s.blankLines)*N(s.lineHeightMm||LINE_MM)}
function printScale(s){var p=N(s.printScale)||DEFAULT_SCALE;return Math.max(60,Math.min(130,p))/100}
function tableMargin(a){return a==='right'?'margin-left:auto;margin-right:0':a==='left'?'margin-left:0;margin-right:auto':'margin-left:auto;margin-right:auto'}
function tableStyle(l){return'margin-top:'+N(l.tableTop)+'mm;width:'+N(l.tableWidth)+'mm;font-size:'+N(l.tableFont)+'pt;--rowh:'+N(l.tableRowHeight||8)+'mm;--headbg:'+E(l.tableHeaderBg||'#fff')+';--headfg:'+E(l.tableHeaderText||'#000')+';--bodybg:'+E(l.tableBodyBg||'#fff')+';--bodyfg:'+E(l.tableBodyText||'#000')+';--border:'+E(l.tableBorder||'#000')+';'+tableMargin(l.tableAlign||'center')}
function blk(cls,html,style){return'<div class="'+cls+'" style="'+(style||'')+'">'+html+'</div>'}
function ctx(s){var v=V(),a=AM(s);return{hospitalName:s.hospitalName||v.h,companyName:s.companyName||v.co,contractName:s.contractName||v.cn,issuerName:s.issuerName||('إدارة '+(s.hospitalName||v.h)),issuerDepartment:s.issuerDepartment||'إدارة الشئون الهندسية',issuerLocation:s.issuerLocation||'نجران',issuerSignatureTitle:P(s.issuerSignatureTitle,s.managerTitle,'مدير الموقع'),issuerSignatureName:P(s.issuerSignatureName,s.managerName,''),paymentNo:v.pay,startDate:D(v.st),endDate:D(v.en),periodText:'دفعة رقم ('+v.pay+') عن الفترة من '+D(v.st)+' م إلى '+D(v.en)+' م',netAmount:M(a.net),vatAmount:M(a.vat),grandAmount:M(a.grand),amountText:T(a.grand),contractNo:contractNo(),iban:ibanNo()}}
function R(text,s){var c=ctx(s);return String(text||'').replace(/\{([a-zA-Z0-9_]+)\}/g,function(_,k){return c[k]!=null?c[k]:''})}
function ttl(s,k,t){var l=L(s,k),ul=l.titleUnderline==='no'?'none':'underline';return l.titleVisible==='no'?'':blk('rl-title','<h1>'+E(R(t,s))+'</h1>','text-align:'+E(l.titleAlign||'center')+';font-size:'+N(l.titleFont)+'pt;margin-top:'+N(l.titleTop||0)+'mm;margin-right:'+N(l.titleRight||0)+'mm;width:'+N(l.titleWidth||100)+'%;margin-bottom:'+N(l.titleAfter||0)+'mm;font-weight:'+N(l.titleWeight||900)+';color:'+E(l.titleColor||'#000')+';text-decoration:'+ul)}
function to(s,k,x){var l=L(s,k),spread=l.recipientSpread==='no'?'flex-start':'space-between';return l.recipientVisible==='no'||!P(x.recipient)?'':blk('rl-recipient','<span>'+E(R(x.recipient,s))+'</span><b>'+E(R(x.suffix,s))+'</b>','justify-content:'+(l.recipientAlign==='center'?'center':l.recipientAlign==='left'?'flex-end':spread)+';text-align:'+E(l.recipientAlign||'right')+';font-size:'+N(l.recipientFont||15)+'pt;margin-bottom:'+N(l.recipientGap||0)+'mm;font-weight:'+N(l.recipientWeight||900)+';color:'+E(l.recipientColor||'#000'))}
function greet(s,k){var l=L(s,k),g=P(l.greetingText);return l.greetingVisible==='no'||!g?'':blk('rl-greeting',E(R(g,s)),'text-align:'+E(l.greetingAlign||'center')+';font-size:'+N(l.greetingFont||15)+'pt;margin-bottom:'+N(l.greetingAfter||0)+'mm;font-weight:'+N(l.greetingWeight||900)+';color:'+E(l.greetingColor||'#000'))}
function lead(s,k,x,title){var l=L(s,k),a=ttl(s,k,title||x.title),b=to(s,k,x),c=greet(s,k);return l.titleFirst==='yes'?a+b+c:b+a+c}
function bodyBlock(s,k,txt,extra){var l=L(s,k),col=extra==='close'?(l.closeColor||l.bodyColor):(l.bodyColor||'#000');return l.bodyVisible==='no'?'':blk('rl-body '+(extra||''),E(R(txt,s)).replace(/\n/g,'<br>'),'text-align:'+E(l.bodyAlign||'justify')+';font-size:'+N(l.bodyFont||15)+'pt;line-height:'+N(l.bodyLine||2.1)+';width:'+N(l.bodyWidth||100)+'%;margin-right:'+N(l.bodyRight||0)+'mm;margin-bottom:'+N(l.bodyAfter||0)+'mm;font-weight:'+N(l.bodyWeight||700)+';color:'+E(col))}
function closeBlock(s,k,txt){var l=L(s,k);return l.closeVisible==='no'?'':bodyBlock(s,k,(txt||'')+'\nوتقبلوا تحياتنا ،،','close')}
function noteBlock(s,k){var l=L(s,k),x=s.letters[k]||{};return l.noteVisible==='yes'&&P(x.note)?blk('rl-note',E(R(x.note,s)).replace(/\n/g,'<br>'),'font-size:'+N(l.noteFont||12)+'pt;text-align:'+E(l.noteAlign||'center')+';margin-top:'+N(l.noteTop||6)+'mm;color:'+E(l.noteColor||'#000')):''}
function headLayer(s){if(!s.letterheadEnabled||!s.letterheadDataUrl||s.letterheadMode==='external')return'';var cls=s.letterheadMode==='top'?'top':'full',style='';if(cls==='top')style='height:'+N(s.letterheadHeightMm||45)+'mm';return'<img class="rl-letterhead '+cls+'" src="'+E(s.letterheadDataUrl)+'" style="'+style+'" alt="">'}
function pg(s,k,html){var l=L(s,k);return'<section class="page">'+headLayer(s)+'<div class="letter-content" style="margin-top:'+N(l.top)+'mm;margin-right:'+N(l.right)+'mm;width:'+N(l.width||174)+'mm;text-align:'+E(l.align||'right')+';font-size:'+N(l.font||14)+'pt;line-height:'+N(l.line||1.85)+'">'+html+'</div></section>'}
function sigItems(s,k,items){var x=s.letters[k]||{},out=[];for(var i=1;i<=3;i++){var t=R(P(x['sign'+i+'Title']),s),n=R(P(x['sign'+i+'Name']),s);if(t||n)out.push({t:t,n:n})}return out.length?out:items}
function sig(s,k,items){var l=L(s,k);if(l.signatureEnabled==='no')return'';items=sigItems(s,k,items&&items.length?items:[{t:ctx(s).issuerSignatureTitle,n:ctx(s).issuerSignatureName}]);items=items.slice(0,Math.max(1,Math.min(3,N(l.signatureCount)||items.length||1)));var cols=Math.max(1,Math.min(3,N(l.signatureColumns)||1));return'<div class="rl-signatures" style="margin-top:'+N(l.sigTop||24)+'mm;grid-template-columns:repeat('+cols+',1fr);font-size:'+N(l.signatureFont||14)+'pt;text-align:'+E(l.signatureAlign||'center')+';font-weight:'+N(l.signatureWeight||800)+';gap:'+N(l.signatureGap||16)+'mm;color:'+E(l.signatureColor||'#000')+'">'+items.map(function(x){var line=l.signatureLine==='no'?'':'<div class="sig-line"></div>';return'<div class="sig-cell"><b>'+E(x.t||'')+'</b>'+line+'<b>'+E(x.n||'')+'</b></div>'}).join('')+'</div>'}
function stamp(s,k){var l=L(s,k);return l.stampVisible==='yes'?'<div class="stamp" style="margin-top:'+N(l.stampTop||12)+'mm;color:'+E(l.stampColor||'#000')+'">الختم</div>':''}
function amountTable(s,k){var l=L(s,k);if(l.showTable==='no')return'';var c=ctx(s);return'<table class="amt amount-table" style="'+tableStyle(l)+'"><colgroup><col class="label"><col class="value"></colgroup><thead><tr><th>البيان</th><th>المبلغ</th></tr></thead><tbody><tr><td>المبلغ الصافي المستحق للمقاول</td><td>'+E(c.netAmount)+' ريال</td></tr><tr><td>ضريبة القيمة المضافة '+N(s.vatRate)+'%</td><td>'+E(c.vatAmount)+' ريال</td></tr><tr><td>الإجمالي شامل الضريبة</td><td>'+E(c.grandAmount)+' ريال</td></tr><tr><td>فقط وقدره</td><td class="words">'+E(c.amountText)+'</td></tr></tbody></table>'}function dataTable(s,k,rows){var l=L(s,k);if(l.showTable==='no')return'';return'<table class="amt kv-table" style="'+tableStyle(l)+'"><colgroup><col class="label"><col class="value"></colgroup><tbody>'+rows.map(function(r){return'<tr><td>'+E(r[0])+'</td><td>'+E(R(r[1],s))+'</td></tr>'}).join('')+'</tbody></table>'}
function tb(s,k,h,rows,empty){var l=L(s,k);return'<table class="tbl list-table" style="'+tableStyle(l)+'"><thead><tr>'+h.map(function(x){return'<th>'+E(x)+'</th>'}).join('')+'</tr></thead><tbody>'+(rows.length?rows.join(''):'<tr><td colspan="'+h.length+'">'+empty+'</td></tr>')+'</tbody></table>'}
function labor(s){var k='labor',x=s.letters[k];return pg(s,k,lead(s,k,x)+bodyBlock(s,k,x.body)+amountTable(s,k)+closeBlock(s,k,x.close)+sig(s,k)+stamp(s,k)+noteBlock(s,k))}
function noPrev(s){var k='noPrev',x=s.letters[k];return pg(s,k,lead(s,k,x)+bodyBlock(s,k,x.body)+dataTable(s,k,[['الموقع','{hospitalName}'],['الشركة','{companyName}'],['الفترة','{periodText}'],['رقم العقد','{contractNo}'],['الإجمالي','{grandAmount} ريال']])+closeBlock(s,k,x.close)+sig(s,k)+stamp(s,k)+noteBlock(s,k))}
function salary(s){var k='salary',x=s.letters[k];return pg(s,k,lead(s,k,x)+bodyBlock(s,k,x.body)+closeBlock(s,k,x.close)+sig(s,k)+stamp(s,k)+noteBlock(s,k))}
function vacancies(s){var k='vacancies',x=s.letters[k],v=V(),rows=EM().filter(vac).map(function(e,i){return'<tr><td>'+an(i+1)+'</td><td>'+E(jb(e)||'شاغر')+'</td><td>'+D(v.st)+'</td><td>'+D(v.en)+'</td><td>'+E(e.notes||'')+'</td></tr>'});return pg(s,k,lead(s,k,x)+bodyBlock(s,k,x.body)+tb(s,k,['م','مسمى الوظيفة','من','إلى','ملاحظات'],rows,'لا توجد شواغر')+closeBlock(s,k,x.close)+sig(s,k)+stamp(s,k)+noteBlock(s,k))}
function vacations(s){var k='vacations',x=s.letters[k],v=V(),rows=EM().filter(leave).map(function(e,i){return'<tr><td>'+an(i+1)+'</td><td>'+E(nm(e))+'</td><td>'+E(jb(e))+'</td><td>'+D(v.st)+'</td><td>'+D(v.en)+'</td><td>'+E(e.notes||'')+'</td></tr>'});return pg(s,k,lead(s,k,x)+bodyBlock(s,k,x.body)+tb(s,k,['م','اسم الموظف','مسمى الوظيفة','من','إلى','ملاحظات'],rows,'لا توجد إجازات')+closeBlock(s,k,x.close)+sig(s,k)+stamp(s,k)+noteBlock(s,k))}
function saudi(s){var k='saudi',x=s.letters[k],all=EM(),vc=all.filter(vac).length,sa=all.filter(saud).length,total=Math.max(all.length,sa+vc),req=N(s.requiredSaudi)||5,act=total?sa*100/total:0,sh=Math.max(0,req-act);var row='<tr><td>'+an(total)+'</td><td>'+an(sa)+'</td><td>'+an(vc)+'</td><td>'+req+'%</td><td>'+act.toFixed(2)+'%</td><td>'+sh.toFixed(2)+'%</td></tr>';return pg(s,k,lead(s,k,x)+bodyBlock(s,k,x.body)+tb(s,k,['عدد الوظائف','عدد السعوديين','الشواغر','النسبة المطلوبة','النسبة الفعلية','نسبة النقص'],[row],'')+closeBlock(s,k,x.close)+sig(s,k)+stamp(s,k)+noteBlock(s,k))}
function finalDoc(s){var k='final',x=s.letters[k];return pg(s,k,lead(s,k,x)+bodyBlock(s,k,x.body)+dataTable(s,k,[['اسم العقد','{contractName}'],['اسم المقاول / الشركة','{companyName}'],['الموقع','{hospitalName}'],['الفترة الزمنية','من {startDate} م حتى {endDate} م'],['رقم الدفعة / المستخلص','{paymentNo}'],['رقم العقد','{contractNo}']])+amountTable(s,k)+blk('iban','رقم الحساب البنكي الآيبان: '+E(ctx(s).iban),'')+closeBlock(s,k,x.close)+bodyBlock(s,k,x.note,'regards')+sig(s,k)+stamp(s,k)+noteBlock(s,k))}
function build(k,s){if(k==='packet')return['labor','noPrev','salary','vacancies','vacations','saudi','final'].map(function(q){return build(q,s)}).join('');return k==='labor'?labor(s):k==='noPrev'?noPrev(s):k==='salary'?salary(s):k==='vacancies'?vacancies(s):k==='vacations'?vacations(s):k==='saudi'?saudi(s):k==='final'?finalDoc(s):pg(s,'custom',lead(s,'custom',s.letters.custom)+bodyBlock(s,'custom',(s.customBody||s.letters.custom.body).replace(/\n/g,'<br>'))+closeBlock(s,'custom',s.letters.custom.close)+sig(s,'custom')+stamp(s,'custom')+noteBlock(s,'custom'))}

function CSS(s){
  s=s||C();
  var top=totalTop(s),sc=printScale(s);
  return `<style>
@page{size:A4;margin:0}
html,body{margin:0;direction:rtl;font-family:Tajawal,Arial,sans-serif;background:#e5e7eb;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:210mm;height:297mm;margin:10mm auto;background:#fff;box-sizing:border-box;padding:22mm 18mm 18mm;page-break-after:always;position:relative;overflow:hidden;box-shadow:0 10px 30px #0002}
.rl-letterhead{position:absolute;left:0;right:0;top:0;width:210mm;z-index:0;pointer-events:none;user-select:none}
.rl-letterhead.full{height:297mm;object-fit:fill}
.rl-letterhead.top{object-fit:fill}
.letter-content{font-weight:700;color:#111;position:relative;z-index:1;padding-top:${top}mm;transform:scale(${sc});transform-origin:top right}
.rl-title h1{font-size:inherit;text-align:inherit;text-decoration:inherit;margin:0;color:inherit;border-bottom:0;padding-bottom:3px}
.rl-recipient{display:flex;gap:12mm;white-space:nowrap}
.date{text-align:right;margin-bottom:12mm;font-weight:700}

.amt,.tbl{border-collapse:collapse;direction:rtl;background:var(--bodybg,#fff);color:var(--bodyfg,#000)}
.amt{table-layout:fixed}
.tbl{table-layout:auto}
.amt th,.amt td,.tbl th,.tbl td{border:1px solid var(--border,#000);padding:2mm 2.5mm;text-align:center;vertical-align:middle;height:var(--rowh,auto);overflow-wrap:anywhere}
.amt th,.tbl th{background:var(--headbg,#fff);color:var(--headfg,#000);font-weight:900}
.amt td,.tbl td{background:var(--bodybg,#fff);color:var(--bodyfg,#000)}

.kv-table col.label{width:28%}
.kv-table col.value{width:72%}
.kv-table td:first-child{font-weight:900;text-align:center;white-space:nowrap}
.kv-table td:nth-child(2){text-align:right;line-height:1.75;direction:rtl}

.amount-table col.label{width:62%}
.amount-table col.value{width:38%}
.amount-table td:first-child{text-align:right;font-weight:900}
.amount-table td:nth-child(2){text-align:center;direction:rtl}
.amount-table .words{font-size:90%;line-height:1.7;text-align:right;direction:rtl}

.list-table{table-layout:auto}

.rl-signatures{display:grid}
.sig-cell{min-height:28mm}
.sig-line{height:18mm;border-bottom:1px solid currentColor;margin:0 10mm 4mm}
.stamp{text-align:center;font-size:17pt;font-weight:800}
.rl-note{font-weight:700}
.iban{text-align:center;margin:10px 0;font-weight:800}
.regards{text-align:center!important;font-weight:900}

@media print{
  html,body{background:#fff}
  .page{margin:0;box-shadow:none}
  .page:last-child{page-break-after:auto}
  .no-print{display:none!important}
}
</style>`;
}function htmlDoc(k,s){return'<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>'+E(DOC[k]||'خطابات الرفع')+'</title><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap" rel="stylesheet">'+CSS(s)+'</head><body>'+build(k,s)+'</body></html>'}
function PR(k){var s=C(),w=window.open('','_blank','width=1200,height=900');if(!w)return alert('المتصفح منع فتح نافذة الطباعة');w.document.open();w.document.write(htmlDoc(k,s));w.document.close();setTimeout(function(){try{w.focus();w.print()}catch(e){}},600)}

function F(p,l,v,t){return'<label class="rl-field"><span>'+E(l)+'</span><input data-f="'+p+'" type="'+(t||'text')+'" value="'+E(v||'')+'"></label>'}
function A(p,l,v){return'<label class="rl-field wide"><span>'+E(l)+'</span><textarea data-f="'+p+'">'+E(v||'')+'</textarea></label>'}
function S(p,l,v,opts){return'<label class="rl-field"><span>'+E(l)+'</span><select data-f="'+p+'">'+opts.map(function(o){return'<option value="'+E(o[0])+'" '+(String(v)===String(o[0])?'selected':'')+'>'+E(o[1])+'</option>'}).join('')+'</select></label>'}
function DOCSEL(s){return'<label class="rl-field"><span>اختر الخطاب</span><select id="rl-doc-select" data-f="selectedDocKey">'+DOC_ORDER.map(function(k){return'<option value="'+k+'" '+(s.selectedDocKey===k?'selected':'')+'>'+E(DOC[k])+'</option>'}).join('')+'</select></label>'}
function yesNo(p,l,v){return S(p,l,v,[['yes','نعم'],['no','لا']])}
function aligns(p,l,v){return S(p,l,v,[['right','يمين'],['center','وسط'],['justify','ضبط'],['left','يسار']])}
function sectionTitle(t){return'<div class="rl-section-title">'+E(t)+'</div>'}
function ED(s,k){var x=s.letters[k],l=L(s,k);return'<section id="rl-doc-settings" class="settings-panel doc-panel open"><h3>إعدادات الخطاب المختار</h3><div class="rl-note">النصوص الآن قوالب رسمية موحدة. استخدم {hospitalName} و {companyName} و {periodText} عند الحاجة.</div><div class="rl-grid">'+sectionTitle('النصوص الثابتة')+F('letters.'+k+'.recipient','المخاطب',x.recipient)+F('letters.'+k+'.suffix','الصفة',x.suffix)+F('letters.'+k+'.title','الموضوع',x.title)+A('letters.'+k+'.body','جسم الخطاب',x.body)+A('letters.'+k+'.close','الخاتمة',x.close)+A('letters.'+k+'.note','عبارة ختامية / ملاحظة',x.note)+sectionTitle('الموضوع والمخاطب والتحية')+yesNo('layout.'+k+'.recipientVisible','إظهار المخاطب',l.recipientVisible)+yesNo('layout.'+k+'.titleVisible','إظهار الموضوع',l.titleVisible)+yesNo('layout.'+k+'.titleFirst','الموضوع فوق الكل',l.titleFirst)+yesNo('layout.'+k+'.titleUnderline','خط تحت الموضوع',l.titleUnderline)+yesNo('layout.'+k+'.recipientSpread','فصل المخاطب والصفة على الطرفين',l.recipientSpread)+yesNo('layout.'+k+'.greetingVisible','إظهار التحية',l.greetingVisible)+F('layout.'+k+'.top','نزول الخطاب داخل الصفحة mm',l.top,'number')+F('layout.'+k+'.right','تحريك الخطاب من اليمين mm',l.right,'number')+F('layout.'+k+'.width','عرض مساحة الخطاب mm',l.width,'number')+S('layout.'+k+'.titleAlign','محاذاة الموضوع',l.titleAlign,[['right','يمين'],['center','وسط'],['left','يسار']])+F('layout.'+k+'.titleFont','حجم خط الموضوع',l.titleFont,'number')+F('layout.'+k+'.titleColor','لون الموضوع',l.titleColor,'color')+F('layout.'+k+'.titleAfter','مسافة بعد الموضوع mm',l.titleAfter,'number')+F('layout.'+k+'.recipientFont','حجم خط المخاطب',l.recipientFont,'number')+S('layout.'+k+'.recipientAlign','محاذاة المخاطب',l.recipientAlign,[['right','يمين'],['center','وسط'],['left','يسار']])+F('layout.'+k+'.greetingText','نص التحية',l.greetingText)+F('layout.'+k+'.greetingFont','حجم خط التحية',l.greetingFont,'number')+S('layout.'+k+'.greetingAlign','محاذاة التحية',l.greetingAlign,[['right','يمين'],['center','وسط'],['left','يسار']])+F('layout.'+k+'.greetingAfter','مسافة بعد التحية mm',l.greetingAfter,'number')+sectionTitle('جسم الخطاب والجداول والتوقيعات')+F('layout.'+k+'.bodyFont','حجم خط جسم الخطاب',l.bodyFont,'number')+aligns('layout.'+k+'.bodyAlign','محاذاة جسم الخطاب',l.bodyAlign)+F('layout.'+k+'.bodyLine','تباعد سطور الجسم',l.bodyLine,'number')+F('layout.'+k+'.tableTop','مسافة قبل الجدول mm',l.tableTop,'number')+F('layout.'+k+'.tableWidth','عرض الجدول mm',l.tableWidth,'number')+F('layout.'+k+'.tableFont','حجم خط الجدول',l.tableFont,'number')+F('layout.'+k+'.tableRowHeight','ارتفاع الصف mm',l.tableRowHeight,'number')+yesNo('layout.'+k+'.signatureEnabled','إظهار التواقيع',l.signatureEnabled)+yesNo('layout.'+k+'.signatureLine','خط التوقيع',l.signatureLine)+F('layout.'+k+'.signatureCount','عدد التوقيعات',l.signatureCount,'number')+F('layout.'+k+'.signatureColumns','عدد أعمدة التواقيع',l.signatureColumns,'number')+F('layout.'+k+'.sigTop','مكان التواقيع من أعلى mm',l.sigTop,'number')+F('layout.'+k+'.signatureFont','حجم خط التواقيع',l.signatureFont,'number')+F('letters.'+k+'.sign1Title','صفة التوقيع 1',x.sign1Title)+F('letters.'+k+'.sign1Name','اسم التوقيع 1',x.sign1Name)+F('letters.'+k+'.sign2Title','صفة التوقيع 2',x.sign2Title)+F('letters.'+k+'.sign2Name','اسم التوقيع 2',x.sign2Name)+F('letters.'+k+'.sign3Title','صفة التوقيع 3',x.sign3Title)+F('letters.'+k+'.sign3Name','اسم التوقيع 3',x.sign3Name)+yesNo('layout.'+k+'.stampVisible','إظهار الختم',l.stampVisible)+F('layout.'+k+'.stampTop','مكان الختم من أعلى mm',l.stampTop,'number')+'</div></section>'}

function flash(t){var el=document.getElementById('rl-flash');if(!el)return;el.textContent=t;el.classList.add('show');setTimeout(function(){el.classList.remove('show')},1400)}
function READUI(){var s=C();document.querySelectorAll('#rl-root [data-f]').forEach(function(e){SET(s,e.dataset.f,e.type==='number'?N(e.value):(e.type==='checkbox'?e.checked:e.value))});return s}
function renderPreview(s){s=s||C();var k=s.selectedDocKey||'labor',f=document.getElementById('rl-preview-frame');if(!f)return;var h=htmlDoc(k,s);if(h===__lastPreview)return;__lastPreview=h;f.srcdoc=h}
function PV(s,now){clearTimeout(__previewTimer);if(now){renderPreview(s);return}__previewTimer=setTimeout(function(){renderPreview(s)},250)}
function SAVE(silent){var s=READUI();s[VISUAL_MARK]=true;s[TEMPLATE_MARK]=true;SV(s);if(!silent)flash('تم الحفظ');PV(s,!silent)}
function AUTOSAVE(){var s=READUI();s[VISUAL_MARK]=true;s[TEMPLATE_MARK]=true;SV(s);PV(s,false)}
function bindAuto(scope){scope.querySelectorAll('input[data-f],textarea[data-f],select[data-f]').forEach(function(e){if(e.id==='rl-doc-select')return;e.oninput=AUTOSAVE;e.onchange=AUTOSAVE})}
function UP(f){if(!f)return;if(!/^image\//.test(f.type||''))return alert('ارفع صورة ترويسة فقط.');if(f.size>1000000&&!confirm('حجم الصورة أكبر من 1MB وقد يبطئ الحفظ. الأفضل ضغطها. الاستمرار؟'))return;var r=new FileReader();r.onload=function(){var s=C();s.letterheadDataUrl=String(r.result||'');s.letterheadEnabled=true;s[VISUAL_MARK]=true;s[TEMPLATE_MARK]=true;SV(s);flash('تم حفظ الترويسة');MT()};r.readAsDataURL(f)}
function DEL(){if(!confirm('حذف الترويسة المحفوظة؟'))return;var s=C();s.letterheadDataUrl='';s.letterheadEnabled=false;s[VISUAL_MARK]=true;s[TEMPLATE_MARK]=true;SV(s);flash('تم حذف الترويسة');MT()}
function CLOSE(){var r=document.getElementById('rl-root'),standalone=window.__HOSPITAL_LETTERS_STANDALONE_PAGE__||/hospital_raise_letters\.html/.test(location.pathname);if(!standalone){if(r)r.remove();return}try{window.close()}catch(e){}setTimeout(function(){if(window.closed)return;if(history.length>1){try{history.back();return}catch(e){}}document.body.innerHTML='<div dir="rtl" style="font-family:Tajawal,Arial,sans-serif;padding:30px"><div style="background:#fff;border:1px solid #ddd;border-radius:16px;padding:24px;max-width:620px;margin:auto;text-align:center"><h2>تم إغلاق شاشة خطابات الرفع</h2><p>يمكن إغلاق هذا التبويب يدوياً</p></div></div>'},120)}
function switchDoc(){var ss=READUI(),box=document.getElementById('rl-doc-settings-wrap');ss[VISUAL_MARK]=true;ss[TEMPLATE_MARK]=true;SV(ss);if(box){box.innerHTML=ED(ss,ss.selectedDocKey||'labor');bindAuto(box)}PV(ss,true);flash('تم اختيار الخطاب')}
function resetDoc(){var s=READUI(),d=DEF(),k=s.selectedDocKey||'labor';if(!confirm('رجوع هذا الخطاب للوضع الافتراضي الرسمي؟'))return;s.layout[k]=d.layout[k];s.letters[k]=d.letters[k];s[VISUAL_MARK]=true;s[TEMPLATE_MARK]=true;SV(s);MT()}
function resetAll(){var s=READUI(),d=DEF();if(!confirm('رجوع كل الخطابات للوضع الافتراضي الرسمي؟ الترويسة والبيانات العامة لن تُحذف.'))return;s.layout=d.layout;s.letters=d.letters;s[VISUAL_MARK]=true;s[TEMPLATE_MARK]=true;SV(s);MT()}
function exportSettings(){var s=READUI(),blob=new Blob([JSON.stringify(s,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='hospital_raise_letters_settings_v8.json';a.click();setTimeout(function(){URL.revokeObjectURL(a.href)},1000)}
function importSettings(f){if(!f)return;var r=new FileReader();r.onload=function(){try{var data=JSON.parse(String(r.result||'{}')),s=Object.assign(C(),data);s[VISUAL_MARK]=true;s[TEMPLATE_MARK]=true;SV(s);MT();flash('تم استيراد الإعدادات')}catch(e){alert('ملف الإعدادات غير صالح')}};r.readAsText(f)}
function forceOfficialTemplates(){var s=READUI(),d=DEF();if(!confirm('تطبيق القوالب الرسمية الموحدة على كل الخطابات؟'))return;s.letters=d.letters;s.layout=d.layout;s[VISUAL_MARK]=true;s[TEMPLATE_MARK]=true;SV(s);MT()}

function MT(){
  var s=C(),o=document.getElementById('rl-root');
  if(o)o.remove();
  __lastPreview='';

  var h=!!s.letterheadDataUrl;
  var k=s.selectedDocKey||'labor';
  var root=document.createElement('div');
  root.id='rl-root';

  root.innerHTML=
    '<style>'+uiCSS(h)+'</style>'+
    '<div class="rl-shell">'+
      '<div class="rl-toolbar">'+
        '<div><b>خطابات رفع المستشفى</b><div id="rl-flash">جاهز</div></div>'+
        '<div class="top-actions">'+
          '<button class="rl-btn secondary" id="preview-now" type="button">تحديث المعاينة</button>'+
          '<button class="rl-btn primary" id="save" type="button">حفظ الآن</button>'+
          '<button class="rl-btn danger" id="close-letters" type="button">إغلاق</button>'+
        '</div>'+
      '</div>'+

      '<section class="rl-settings">'+
        generalBox(s,h)+
        '<section class="settings-panel select-panel open"><h3>اختيار الخطاب</h3>'+DOCSEL(s)+'</section>'+
        '<div id="rl-doc-settings-wrap">'+ED(s,k)+'</div>'+
      '</section>'+

      '<section class="preview-box">'+
        '<h3>المعاينة المباشرة</h3>'+
        '<iframe id="rl-preview-frame" class="preview-frame"></iframe>'+
      '</section>'+

      '<div class="printbar">'+
        '<button class="rl-btn warn" id="reset-doc" type="button">رجوع افتراضي لهذا الخطاب</button>'+
        '<button class="rl-btn warn" id="reset-all" type="button">رجوع افتراضي للكل</button>'+
        '<button class="rl-btn" data-print="selected">طباعة الخطاب المختار</button>'+
        '<button class="rl-btn" data-print="packet">طباعة كل الخطابات</button>'+
        '<button class="rl-btn" data-print="final">طباعة الرفع النهائي</button>'+
        '<button class="rl-btn" data-print="salary">طباعة شهادة الرواتب</button>'+
        '<button class="rl-btn" data-print="noPrev">طباعة عدم أسبقية الصرف</button>'+
        '<button class="rl-btn" data-print="vacancies">طباعة الشواغر</button>'+
        '<button class="rl-btn" data-print="vacations">طباعة الإجازات</button>'+
        '<button class="rl-btn" data-print="saudi">طباعة السعودة</button>'+
        '<button class="rl-btn" data-print="custom">طباعة مخصص</button>'+
      '</div>'+
    '</div>';

  document.body.appendChild(root);

  root.querySelector('#save').onclick=function(){SAVE(false)};
  root.querySelector('#preview-now').onclick=function(){
    var ss=READUI();
    ss[VISUAL_MARK]=true;
    ss[TEMPLATE_MARK]=true;
    SV(ss);
    PV(ss,true);
    flash('تم تحديث المعاينة');
  };
  root.querySelector('#close-letters').onclick=CLOSE;
  root.querySelector('#head-file').onchange=function(){UP(this.files&&this.files[0])};
  root.querySelector('#delete-head').onclick=DEL;
  root.querySelector('#rl-doc-select').onchange=switchDoc;
  root.querySelector('#reset-doc').onclick=resetDoc;
  root.querySelector('#reset-all').onclick=resetAll;

  bindAuto(root);

  root.querySelectorAll('[data-print]').forEach(function(b){
    b.onclick=function(){
      var ss=READUI(),p=b.dataset.print;
      ss[VISUAL_MARK]=true;
      ss[TEMPLATE_MARK]=true;
      SV(ss);
      PR(p==='selected'?(ss.selectedDocKey||'labor'):p);
    };
  });

  var l=document.querySelector('.loading');
  if(l)l.remove();

  PV(s,true);
  console.info('[HospitalLettersEngine] V8 mounted office-quality documents v14');
}function generalBox(s,h){return'<section class="settings-panel global-panel open"><h3>الإعدادات العامة والترويسة</h3><div class="rl-note">الاختلاف عن المكاتب هنا في الجهة المصدرة وترويسة المستشفى ومصدر البيانات فقط.</div><div class="rl-grid">'+F('hospitalName','اسم المستشفى',s.hospitalName)+F('companyName','الشركة',s.companyName)+F('contractName','العقد',s.contractName)+F('issuerName','الجهة المصدرة',s.issuerName)+F('issuerDepartment','الإدارة / القسم المصدر',s.issuerDepartment)+F('issuerLocation','المدينة',s.issuerLocation)+F('issuerSignatureTitle','صفة توقيع الجهة المصدرة',s.issuerSignatureTitle)+F('issuerSignatureName','اسم توقيع الجهة المصدرة',s.issuerSignatureName)+F('managerTitle','صفة المدير',s.managerTitle)+F('managerName','اسم المدير',s.managerName)+F('accountantTitle','صفة المحاسب',s.accountantTitle)+F('accountantName','اسم المحاسب',s.accountantName)+F('vatRate','الضريبة %',s.vatRate,'number')+F('manualGrand','مبلغ يدوي شامل الضريبة',s.manualGrand,'number')+F('requiredSaudi','نسبة السعودة المطلوبة %',s.requiredSaudi,'number')+A('customBody','نص الخطاب المخصص',s.customBody)+'<label class="rl-field check"><span>تفعيل الترويسة</span><input data-f="letterheadEnabled" type="checkbox" '+(s.letterheadEnabled?'checked':'')+'></label>'+S('letterheadMode','طريقة الترويسة',s.letterheadMode,[['external','مطبوع خارجي — لا تطبع صورة وتُنزل المحتوى فقط'],['full','صورة A4 كاملة كخلفية'],['top','صورة ترويسة علوية فقط']])+F('letterheadHeightMm','ارتفاع الترويسة العلوية — ملم',s.letterheadHeightMm,'number')+F('contentTopMm','نزول بداية الخطاب من أعلى الورقة — ملم',s.contentTopMm,'number')+F('blankLines','نزول إضافي بعدد السطور',s.blankLines,'number')+F('lineHeightMm','ارتفاع السطر بالملليمتر',s.lineHeightMm,'number')+F('printScale','تكبير/تصغير الطباعة %',s.printScale,'number')+'</div><div class="head-status">حالة الترويسة: '+(h?'محفوظة':'لا توجد ترويسة محفوظة')+'</div><div class="rl-row"><input id="head-file" type="file" accept="image/*"><button class="rl-btn danger" id="delete-head" type="button">حذف الترويسة</button></div></section>'}
function uiCSS(h){
  return `#rl-root{font-family:Tajawal,Arial,sans-serif;direction:rtl;background:#eef2f7;padding:12px;min-height:100vh}
.rl-shell{background:#fff;border:1px solid #dbe3ef;border-radius:18px;padding:16px;box-shadow:0 18px 45px #0f172a16}
.rl-toolbar{position:sticky;top:0;z-index:20;background:linear-gradient(135deg,#fff,#eff6ff);border:1px solid #dbeafe;border-radius:16px;padding:12px;display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:14px}
.top-actions,.printbar,.rl-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.rl-btn{background:#003087;color:#fff;border:0;border-radius:10px;padding:10px 14px;font-weight:900;cursor:pointer}
.rl-btn:hover{filter:brightness(.95)}
.primary{background:#003087}
.danger{background:#b91c1c}
.secondary{background:#475569}
.safe{background:#047857}
.warn{background:#92400e}

.printbar{position:sticky;bottom:0;z-index:15;background:#fff;border:1px solid #dbe3ef;border-radius:16px;padding:12px;margin-top:12px;box-shadow:0 -8px 25px #0f172a14}

.rl-settings{display:block}
.settings-panel,.preview-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:12px;margin:0 0 10px}
.settings-panel h3,.preview-box h3{margin:0 0 10px;color:#0f172a}
.rl-note{background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:8px 10px;margin-bottom:10px;color:#7c2d12;font-weight:800}
.rl-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:10px 0}
.wide{grid-column:1/-1}
.rl-field{display:flex;flex-direction:column;font-weight:800;gap:5px}
.rl-field.check{align-items:flex-start}
input,textarea,select{border:1px solid #cbd5e1;border-radius:9px;padding:8px;font-family:inherit;background:#fff}
input:focus,textarea:focus,select:focus{outline:2px solid #93c5fd;border-color:#3b82f6}
textarea{min-height:78px}
.rl-section-title{grid-column:1/-1;background:#e0f2fe;color:#0f172a;border-radius:10px;padding:8px 10px;font-weight:900;margin-top:6px}
.head-status{font-weight:900;color:${h?'#15803d':'#b45309'};margin:8px 0}
#rl-flash{opacity:0;transition:.2s;color:#15803d;font-weight:900}
#rl-flash.show{opacity:1}

.preview-box{margin-top:14px}
.preview-frame{display:block;width:min(100%,1120px);height:840px;margin:0 auto;border:1px solid #cbd5e1;border-radius:14px;background:#e5e7eb}

@media(max-width:760px){
  .preview-frame{height:680px}
  .rl-grid{grid-template-columns:1fr}
  .rl-toolbar{align-items:flex-start;flex-direction:column}
}`;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',MT);else MT();
})();
