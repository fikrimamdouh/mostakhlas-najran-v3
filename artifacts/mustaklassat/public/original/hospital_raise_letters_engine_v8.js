// Hospital Raise Letters Engine V8 - Clean rebuild
// Scope: hospital normal extract raise letters only.
// No admin offices keys. No old hospital UI. No achievement dependency.
(function(){
'use strict';

if(!/hospital_raise_letters\.html/.test(location.pathname) && !window.__HOSPITAL_LETTERS_STANDALONE_PAGE__) return;
if(window.__HOSPITAL_RAISE_CLEAN_CENTER_V8__) return;
window.__HOSPITAL_RAISE_CLEAN_CENTER_V8__ = true;

var SETTINGS_KEY = 'hospitalRaiseLettersSettings_v8';
var CLEAN_MARK = 'hospitalRaiseLettersCleanRebuild_20260701_v2';
var DOCS = {
  index:'فهرس مستندات المستخلص',
  final:'خطاب الرفع النهائي',
  labor:'خطاب العمالة',
  noPrev:'عدم أسبقية الصرف',
  salary:'شهادة تسليم الرواتب',
  vacancies:'بيان الشواغر',
  vacations:'بيان الإجازات',
  saudi:'بيان السعودة',
  custom:'خطاب مخصص'
};
var DOC_ORDER = ['index','final','labor','noPrev','salary','vacancies','vacations','saudi','custom'];
var PACKET_ORDER = ['index','final','labor','noPrev','salary','vacancies','vacations','saudi','custom'];
var previewTimer = 0;
var lastPreview = '';

function esc(v){
  return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c];
  });
}
function readJson(key,fallback){
  try{
    var raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }catch(e){ return fallback; }
}
function saveJson(key,value){
  try{
    localStorage.setItem(key, JSON.stringify(value || {}));
    return true;
  }catch(e){
    alert('تعذر حفظ إعدادات الخطابات. غالبًا حجم صورة الترويسة كبير. صغّر الصورة ثم أعد رفعها.');
    return false;
  }
}
function num(v){
  if(v == null || v === '') return 0;
  var s = String(v).replace(/[٠-٩]/g,function(d){return '٠١٢٣٤٥٦٧٨٩'.indexOf(d);});
  s = s.replace(/[٬, ريال﷼\s]/g,'');
  var n = Number(s);
  return isFinite(n) ? n : 0;
}
function money(v){
  return num(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function pick(){
  for(var i=0;i<arguments.length;i++){
    var v = arguments[i];
    if(v == null) continue;
    var s = String(v).trim();
    if(s && s !== 'undefined' && s !== 'null' && s !== 'غير محدد' && s !== '—') return s;
  }
  return '';
}
function arDigits(v){
  return String(v).replace(/\d/g,function(d){ return '٠١٢٣٤٥٦٧٨٩'[d]; });
}
function dateFmt(v){
  if(!v || v === 'غير محدد') return 'غير محدد';
  var s = String(v).trim().replace(/[٠-٩]/g,function(d){return '٠١٢٣٤٥٦٧٨٩'.indexOf(d);});
  var m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if(m) return Number(m[3])+'/'+Number(m[2])+'/'+m[1];
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if(m) return Number(m[1])+'/'+Number(m[2])+'/'+m[3];
  return String(v);
}
function purgeOldOnce(){
  try{
    if(localStorage.getItem(CLEAN_MARK) === '1') return;
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem('hospitalRaiseLettersSettings_v7');
    localStorage.removeItem('hospitalRaiseLettersSettings_v6');
    localStorage.setItem(CLEAN_MARK,'1');
    console.info('[HospitalRaiseClean] تم حذف إعدادات خطابات المستشفى القديمة مرة واحدة.');
  }catch(e){}
}
function contractData(){ return readJson('persistentContractData',{}); }
function extractData(){ return readJson('persistentExtractData',{}); }
function baseData(){
  var c = contractData(), e = extractData();
  return {
    hospitalName: pick(c.hospitalName,c.siteName,c.centerName,localStorage.getItem('hospitalName'),localStorage.getItem('currentHospital'),'المستشفى'),
    companyName: pick(c.companyName,c.contractorName,e.companyName,localStorage.getItem('companyName'),'الشركة'),
    contractName: pick(c.contractDetails,c.contractName,c.scopeName,e.contractName,'مشروع التشغيل والصيانة غير الطبية'),
    contractNo: pick(c.contractNumber,c.contractNo,c.number,e.contractNumber,localStorage.getItem('contractNumber'),'—'),
    iban: pick(c.iban,c.bankIban,c.accountIban,c.bankAccount,e.iban,localStorage.getItem('contractorIban'),'SA................................'),
    startDate: pick(e.extractStart,e.periodStart,e.startDate,e.fromDate,localStorage.getItem('extractStart'),'غير محدد'),
    endDate: pick(e.extractEnd,e.periodEnd,e.endDate,e.toDate,localStorage.getItem('extractEnd'),'غير محدد'),
    paymentNo: pick(e.paymentNumber,e.extractNumber,e.paymentNo,e.payment,localStorage.getItem('paymentNumber'),'—')
  };
}
function readAttendance(){
  var raw = readJson('attendanceData',[]);
  var out = [];
  function add(x){
    if(!x || typeof x !== 'object') return;
    if(pick(x.name,x.employeeName,x.fullName,x.jobTitle,x.position,x.status,x.nationality,x.notes) || num(x.salary)>0) out.push(x);
  }
  if(Array.isArray(raw)){
    raw.forEach(add);
  }else if(raw && typeof raw === 'object'){
    Object.keys(raw).forEach(function(k){
      var v = raw[k];
      if(Array.isArray(v)) v.forEach(add);
      else if(v && typeof v === 'object') add(v);
    });
  }
  if(!out.length) console.warn('[HospitalRaiseClean] لا توجد بيانات attendanceData للمستخلص العادي.');
  return out;
}
function empName(e){ return pick(e.name,e.employeeName,e.fullName); }
function empJob(e){ return pick(e.jobTitle,e.position,e.title,e.job); }
function empStatus(e){ return pick(e.status,e.attendanceStatus,e.type); }
function empDays(e){
  var d = e.days || e.attendance || e.statuses || e.daily || [];
  if(Array.isArray(d)) return d;
  if(d && typeof d === 'object') return Object.values(d);
  return [];
}
function isVacant(e){
  return !empName(e) || /شاغر/.test(empName(e)) || /شاغر/.test(empStatus(e)) || empDays(e).indexOf('ش') >= 0;
}
function isLeave(e){
  return /إجاز|اجاز/.test(empStatus(e)) || empDays(e).indexOf('ج') >= 0 || empDays(e).indexOf('إ') >= 0;
}
function isSaudi(e){
  return e.isSaudi === true || /سعود|saudi/i.test(pick(e.nationality,e.nationalityName,e.country,e.citizenship,empStatus(e)));
}
function firstAmount(obj, keys){
  for(var i=0;i<keys.length;i++){
    var k = keys[i];
    var v = obj && obj[k];
    if(num(v)>0) return {value:num(v), source:'persistentExtractData.'+k};
  }
  return {value:0, source:''};
}
function amountFromData(settings){
  var e = extractData();
  var vatRate = num(settings.vatRate || 15);
  var grossKeys = [
    'grandTotal','grandAmount','totalWithVat','totalAfterVat','grossAmount','finalTotal',
    'totalIncludingVat','invoiceTotal','extractTotal','amountWithVat','netPayableWithVat'
  ];
  var netKeys = [
    'netTotal','netAmount','netPayable','laborNetTotal','finalLaborCost','amountBeforeVat',
    'subtotal','totalBeforeVat','extractNetTotal','netDue'
  ];

  if(num(settings.manualGrand)>0){
    var g = num(settings.manualGrand);
    return {net:g/(1+vatRate/100), vat:g-(g/(1+vatRate/100)), grand:g, source:'manualGrand'};
  }

  var g1 = firstAmount(e,grossKeys);
  if(g1.value>0){
    return {net:g1.value/(1+vatRate/100), vat:g1.value-(g1.value/(1+vatRate/100)), grand:g1.value, source:g1.source};
  }

  var n1 = firstAmount(e,netKeys);
  if(n1.value>0){
    return {net:n1.value, vat:n1.value*vatRate/100, grand:n1.value*(1+vatRate/100), source:n1.source};
  }

  var bd = baseData();
  var localGross = [
    'grandTotal_'+bd.hospitalName,'grandNetTotal_'+bd.hospitalName,'invoiceTotal_'+bd.hospitalName,
    'grandTotal','grandNetTotal','invoiceTotal','totalWithVat','extractTotal'
  ];
  for(var i=0;i<localGross.length;i++){
    var gv = num(localStorage.getItem(localGross[i]));
    if(gv>0) return {net:gv/(1+vatRate/100), vat:gv-(gv/(1+vatRate/100)), grand:gv, source:'localStorage.'+localGross[i]};
  }

  var localNet = [
    'finalLaborCost_'+bd.hospitalName,'laborNetTotal_'+bd.hospitalName,'netAmount_'+bd.hospitalName,
    'finalLaborCost','laborNetTotal','netAmount'
  ];
  for(var j=0;j<localNet.length;j++){
    var nv = num(localStorage.getItem(localNet[j]));
    if(nv>0) return {net:nv, vat:nv*vatRate/100, grand:nv*(1+vatRate/100), source:'localStorage.'+localNet[j]};
  }

  console.warn('[HospitalRaiseClean] لا يوجد مبلغ مؤكد في persistentExtractData أو localStorage المعروف. لم يتم اختراع مبلغ ولم يتم جمع رواتب الموظفين.');
  return {net:0, vat:0, grand:0, source:''};
}
function smallNumberText(x){
  x = Math.floor(num(x));
  var ones = ['','واحد','اثنان','ثلاثة','أربعة','خمسة','ستة','سبعة','ثمانية','تسعة'];
  var tens = ['','عشرة','عشرون','ثلاثون','أربعون','خمسون','ستون','سبعون','ثمانون','تسعون'];
  var teens = ['عشرة','أحد عشر','اثنا عشر','ثلاثة عشر','أربعة عشر','خمسة عشر','ستة عشر','سبعة عشر','ثمانية عشر','تسعة عشر'];
  var hund = ['','مائة','مائتان','ثلاثمائة','أربعمائة','خمسمائة','ستمائة','سبعمائة','ثمانمائة','تسعمائة'];
  var parts = [];
  if(x>=100){ parts.push(hund[Math.floor(x/100)]); x = x%100; }
  if(x>=20){ if(x%10) parts.push(ones[x%10]); parts.push(tens[Math.floor(x/10)]); }
  else if(x>=10){ parts.push(teens[x-10]); }
  else if(x>0){ parts.push(ones[x]); }
  return parts.filter(Boolean).join(' و ');
}
function amountWords(v){
  var totalHalalas = Math.round(num(v)*100);
  var riyal = Math.floor(totalHalalas/100);
  var halala = totalHalalas % 100;
  var parts = [];
  var million = Math.floor(riyal/1000000);
  var thousand = Math.floor((riyal%1000000)/1000);
  var rest = riyal % 1000;
  if(million) parts.push(smallNumberText(million)+' مليون');
  if(thousand) parts.push(smallNumberText(thousand)+' ألف');
  if(rest) parts.push(smallNumberText(rest));
  var txt = 'فقط وقدره '+(parts.join(' و ') || 'صفر')+' ريال سعودي';
  if(halala) txt += ' و '+smallNumberText(halala)+' هللة';
  return txt+' لا غير';
}
function defaultLayout(){
  return {
    top:0,right:0,width:174,align:'right',
    titleVisible:'yes',titleFirst:'yes',titleUnderline:'yes',titleFont:16,titleAlign:'center',titleAfter:12,titleTop:0,titleRight:0,titleWidth:100,titleWeight:900,
    recipientVisible:'yes',recipientFont:15,recipientAlign:'right',recipientGap:8,recipientSpread:'yes',recipientWeight:900,
    greetingVisible:'yes',greetingText:'السلام عليكم ورحمة الله وبركاته، وبعد:',greetingFont:15,greetingAlign:'center',greetingAfter:8,greetingWeight:900,
    bodyVisible:'yes',bodyFont:15,bodyAlign:'justify',bodyLine:2.05,bodyWidth:100,bodyRight:0,bodyAfter:8,bodyWeight:700,
    closeVisible:'yes',noteVisible:'no',noteFont:12,noteAlign:'center',noteTop:6,
    showTable:'yes',tableTop:9,tableWidth:150,tableFont:12.5,tableAlign:'center',tableRowHeight:8,
    signatureEnabled:'yes',signatureLine:'yes',signatureCount:1,signatureColumns:1,signatureFont:14,signatureAlign:'center',signatureWeight:800,signatureGap:16,sigTop:24,
    stampVisible:'no',stampTop:12
  };
}
function defaultLayouts(){
  var l = {};
  DOC_ORDER.forEach(function(k){ l[k] = defaultLayout(); });
  l.index = Object.assign(defaultLayout(),{titleFont:18,tableWidth:165,bodyAlign:'center',signatureEnabled:'no'});
  l.final = Object.assign(defaultLayout(),{titleFont:15,tableWidth:135,tableFont:13,sigTop:26});
  l.labor = Object.assign(defaultLayout(),{titleFont:16,tableWidth:150});
  l.noPrev = Object.assign(defaultLayout(),{titleFont:17,tableWidth:140,stampVisible:'yes'});
  l.salary = Object.assign(defaultLayout(),{titleFont:18,width:160,bodyFont:16});
  l.vacancies = Object.assign(defaultLayout(),{width:185,tableWidth:180,tableFont:12,bodyAlign:'center'});
  l.vacations = Object.assign(defaultLayout(),{width:185,tableWidth:180,tableFont:12,bodyAlign:'center'});
  l.saudi = Object.assign(defaultLayout(),{width:170,tableWidth:165,tableFont:11,bodyAlign:'center'});
  return l;
}
function defaultLetters(){
  return {
    index:{recipient:'',suffix:'',title:'فهرس مستندات المستخلص',body:'يتضمن هذا الفهرس ترتيب مستندات المستخلص والصفحات الخاصة بكل مستند، لاستخدامه كغلاف تنظيمي للحزمة الرسمية.',close:'',note:'',sign1Title:'',sign1Name:'',sign2Title:'',sign2Name:'',sign3Title:'',sign3Name:''},
    final:{recipient:'المكرم / مدير الإدارة المالية',suffix:'المحترم',title:'خطاب الرفع النهائي',body:'نرفق طيه مستخلص أعمال الصيانة والنظافة والتشغيل غير الطبي بموقع {hospitalName}، والمنفذة من قبل {companyName}، عن {periodText}، وذلك حسب البيانات التالية:',close:'نأمل التكرم بالاطلاع وتوجيه جهة الاختصاص نحو استكمال إجراءات صرف استحقاق المقاول حسب النظام.',note:'مع أطيب تحياتي وتقديري،،',sign1Title:'{issuerSignatureTitle}',sign1Name:'{issuerSignatureName}',sign2Title:'',sign2Name:'',sign3Title:'',sign3Name:''},
    labor:{recipient:'سعادة / مساعد المدير العام للدعم المساند',suffix:'المحترم',title:'خطاب رفع مستخلص العمالة',body:'نرفق لسعادتكم مستخلص بند العمالة الخاص بـ {companyName} عن {periodText}، وذلك مقابل الأعمال المنفذة ضمن نطاق {contractName} بموقع {hospitalName}، حسب البيانات والمرفقات المؤيدة.',close:'نأمل التكرم بالاطلاع وإحالة المستخلص إلى جهة الاختصاص لتدقيقه واستكمال إجراءات صرف مستحقات المقاول حسب النظام.',note:'',sign1Title:'{issuerSignatureTitle}',sign1Name:'{issuerSignatureName}',sign2Title:'',sign2Name:'',sign3Title:'',sign3Name:''},
    noPrev:{recipient:'',suffix:'',title:'إقرار بعدم أسبقية الصرف',body:'تشهد {issuerName} بأن مستخلص {companyName} الخاص بـ {contractName} بموقع {hospitalName} عن {periodText}، والبالغ إجماليه {grandAmount} ريال، لم يسبق صرفه من قبل، ولم يتم رفعه للصرف ضمن أي مستخلص سابق حسب السجلات المتاحة لدينا.',close:'حرر هذا الإقرار بناءً على البيانات المعتمدة لدينا لاستخدامه فيما يلزم نظاماً.',note:'',sign1Title:'{issuerSignatureTitle}',sign1Name:'{issuerSignatureName}',sign2Title:'',sign2Name:'',sign3Title:'',sign3Name:''},
    salary:{recipient:'',suffix:'',title:'شهادة تسليم رواتب',body:'تشهد {issuerName} بأن {companyName} قامت بتسليم رواتب العاملين التابعين لها داخل موقع {hospitalName} عن {periodText}، وذلك بحسب ما تم تقديمه من مستندات ومرفقات، ودون أن يترتب على هذه الشهادة أي تعديل على الحسابات أو المستحقات النظامية.',close:'وقد أعطيت هذه الشهادة بناءً على طلب الشركة لاستخدامها ضمن مستندات المستخلص.',note:'',sign1Title:'{issuerSignatureTitle}',sign1Name:'{issuerSignatureName}',sign2Title:'',sign2Name:'',sign3Title:'',sign3Name:''},
    vacancies:{recipient:'',suffix:'',title:'بيان الشواغر',body:'نرفق بيان الوظائف الشاغرة بموقع {hospitalName} عن {periodText}، وذلك ضمن مستندات مستخلص {companyName}.',close:'للاطلاع واستكمال ما يلزم حسب النظام.',note:'',sign1Title:'{issuerSignatureTitle}',sign1Name:'{issuerSignatureName}',sign2Title:'',sign2Name:'',sign3Title:'',sign3Name:''},
    vacations:{recipient:'',suffix:'',title:'بيان الإجازات',body:'نرفق بيان الإجازات المسجلة للعاملين بموقع {hospitalName} عن {periodText}، وذلك ضمن مستندات مستخلص {companyName}.',close:'للاطلاع واستكمال ما يلزم حسب النظام.',note:'',sign1Title:'{issuerSignatureTitle}',sign1Name:'{issuerSignatureName}',sign2Title:'',sign2Name:'',sign3Title:'',sign3Name:''},
    saudi:{recipient:'',suffix:'',title:'بيان السعودة',body:'نرفق بيان نسبة السعودة والوظائف المشغولة بالسعوديين بموقع {hospitalName} عن {periodText} ضمن مستندات مستخلص {companyName}.',close:'للاطلاع واستكمال ما يلزم حسب النظام.',note:'',sign1Title:'{issuerSignatureTitle}',sign1Name:'{issuerSignatureName}',sign2Title:'',sign2Name:'',sign3Title:'',sign3Name:''},
    custom:{recipient:'',suffix:'',title:'خطاب مخصص',body:'',close:'',note:'',sign1Title:'{issuerSignatureTitle}',sign1Name:'{issuerSignatureName}',sign2Title:'',sign2Name:'',sign3Title:'',sign3Name:''}
  };
}
function defaultSettings(){
  var b = baseData();
  return {
    version:'clean-v8-20260701-v2',
    selectedDoc:'final',
    hospitalName:b.hospitalName,
    companyName:b.companyName,
    contractName:b.contractName,
    issuerName:'إدارة '+b.hospitalName,
    issuerDepartment:'إدارة الشئون الهندسية',
    issuerLocation:'نجران',
    issuerSignatureTitle:'مدير '+b.hospitalName,
    issuerSignatureName:'',
    vatRate:15,
    manualGrand:0,
    requiredSaudi:5,
    customBody:'',
    letterheadEnabled:false,
    letterheadMode:'external',
    letterheadDataUrl:'',
    letterheadHeightMm:45,
    contentTopMm:0,
    blankLines:0,
    lineHeightMm:6,
    printScale:72,
    pageMarginTopMm:22,
    pageMarginRightMm:18,
    pageMarginBottomMm:18,
    pageMarginLeftMm:18,
    indexStartPage:1,
    pageCount:{index:1,final:1,labor:1,noPrev:1,salary:1,vacancies:1,vacations:1,saudi:1,custom:1},
    letters:defaultLetters(),
    layout:defaultLayouts()
  };
}
function mergeDeep(a,b){
  var out = Array.isArray(a) ? a.slice() : Object.assign({},a||{});
  Object.keys(b||{}).forEach(function(k){
    if(b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && !(b[k] instanceof File)){
      out[k] = mergeDeep(out[k], b[k]);
    }else{
      out[k] = b[k];
    }
  });
  return out;
}
function loadSettings(){
  var d = defaultSettings();
  var s = readJson(SETTINGS_KEY,{});
  s = mergeDeep(d,s);
  s.letters = mergeDeep(d.letters, s.letters || {});
  s.layout = mergeDeep(d.layout, s.layout || {});
  s.pageCount = mergeDeep(d.pageCount, s.pageCount || {});
  return s;
}
function saveSettings(s){
  s.version = 'clean-v8-20260701-v2';
  return saveJson(SETTINGS_KEY,s);
}
function setPath(obj,path,value){
  var p = path.split('.');
  for(var i=0;i<p.length-1;i++){
    if(!obj[p[i]] || typeof obj[p[i]] !== 'object') obj[p[i]] = {};
    obj = obj[p[i]];
  }
  obj[p[p.length-1]] = value;
}
function getLayout(s,k){ return s.layout[k] || defaultLayout(); }
function context(s){
  var b = baseData();
  var amt = amountFromData(s);
  return {
    hospitalName:s.hospitalName || b.hospitalName,
    companyName:s.companyName || b.companyName,
    contractName:s.contractName || b.contractName,
    issuerName:s.issuerName || ('إدارة '+(s.hospitalName||b.hospitalName)),
    issuerDepartment:s.issuerDepartment || 'إدارة الشئون الهندسية',
    issuerLocation:s.issuerLocation || 'نجران',
    issuerSignatureTitle:s.issuerSignatureTitle || 'مدير الموقع',
    issuerSignatureName:s.issuerSignatureName || '',
    startDate:dateFmt(b.startDate),
    endDate:dateFmt(b.endDate),
    paymentNo:b.paymentNo,
    periodText:'دفعة رقم ('+b.paymentNo+') عن الفترة من '+dateFmt(b.startDate)+' م إلى '+dateFmt(b.endDate)+' م',
    contractNo:b.contractNo,
    iban:b.iban,
    netAmount:money(amt.net),
    vatAmount:money(amt.vat),
    grandAmount:money(amt.grand),
    amountText:amountWords(amt.grand),
    amountSource:amt.source || 'غير متوفر'
  };
}
function tpl(text,s){
  var c = context(s);
  return String(text || '').replace(/\{([a-zA-Z0-9_]+)\}/g,function(_,k){ return c[k] == null ? '' : c[k]; });
}
function tableCss(l){
  var align = l.tableAlign === 'right' ? 'margin-left:auto;margin-right:0' : l.tableAlign === 'left' ? 'margin-left:0;margin-right:auto' : 'margin-left:auto;margin-right:auto';
  return 'margin-top:'+num(l.tableTop)+'mm;width:'+num(l.tableWidth)+'mm;font-size:'+num(l.tableFont)+'pt;--rowh:'+num(l.tableRowHeight||8)+'mm;'+align;
}
function leadHtml(s,k,x){
  var l = getLayout(s,k), out = [];
  function title(){
    if(l.titleVisible === 'no' || !pick(x.title)) return '';
    return '<div class="rl-title" style="text-align:'+esc(l.titleAlign||'center')+';font-size:'+num(l.titleFont)+'pt;margin-top:'+num(l.titleTop||0)+'mm;margin-right:'+num(l.titleRight||0)+'mm;width:'+num(l.titleWidth||100)+'%;margin-bottom:'+num(l.titleAfter||0)+'mm;font-weight:'+num(l.titleWeight||900)+';text-decoration:'+(l.titleUnderline==='no'?'none':'underline')+'">'+esc(tpl(x.title,s))+'</div>';
  }
  function recipient(){
    if(l.recipientVisible === 'no' || !pick(x.recipient)) return '';
    var spread = l.recipientSpread === 'no' ? 'flex-start' : 'space-between';
    var just = l.recipientAlign === 'center' ? 'center' : l.recipientAlign === 'left' ? 'flex-end' : spread;
    return '<div class="rl-recipient" style="justify-content:'+just+';font-size:'+num(l.recipientFont||15)+'pt;margin-bottom:'+num(l.recipientGap||0)+'mm;font-weight:'+num(l.recipientWeight||900)+'"><span>'+esc(tpl(x.recipient,s))+'</span><b>'+esc(tpl(x.suffix,s))+'</b></div>';
  }
  function greeting(){
    if(l.greetingVisible === 'no' || !pick(l.greetingText)) return '';
    return '<div class="rl-greeting" style="text-align:'+esc(l.greetingAlign||'center')+';font-size:'+num(l.greetingFont||15)+'pt;margin-bottom:'+num(l.greetingAfter||0)+'mm;font-weight:'+num(l.greetingWeight||900)+'">'+esc(tpl(l.greetingText,s))+'</div>';
  }
  if(l.titleFirst === 'yes') out.push(title(),recipient(),greeting());
  else out.push(recipient(),title(),greeting());
  return out.join('');
}
function bodyHtml(s,k,text,cls){
  var l = getLayout(s,k), t = String(tpl(text,s) || '').trim();
  if(l.bodyVisible === 'no' || !t) return '';
  return '<div class="rl-body '+(cls||'')+'" style="text-align:'+esc(l.bodyAlign||'justify')+';font-size:'+num(l.bodyFont||15)+'pt;line-height:'+num(l.bodyLine||2.05)+';width:'+num(l.bodyWidth||100)+'%;margin-right:'+num(l.bodyRight||0)+'mm;margin-bottom:'+num(l.bodyAfter||0)+'mm;font-weight:'+num(l.bodyWeight||700)+'">'+esc(t).replace(/\n/g,'<br>')+'</div>';
}
function closeHtml(s,k,text){
  var l = getLayout(s,k);
  if(l.closeVisible === 'no' || !pick(text)) return '';
  return bodyHtml(s,k,String(text).trim()+'\nوتقبلوا تحياتنا ،،','close');
}
function noteHtml(s,k){
  var l = getLayout(s,k), x = s.letters[k] || {};
  if(l.noteVisible !== 'yes' || !pick(x.note)) return '';
  return '<div class="rl-note-print" style="font-size:'+num(l.noteFont||12)+'pt;text-align:'+esc(l.noteAlign||'center')+';margin-top:'+num(l.noteTop||6)+'mm;font-weight:700">'+esc(tpl(x.note,s)).replace(/\n/g,'<br>')+'</div>';
}
function signatureHtml(s,k){
  var l = getLayout(s,k), x = s.letters[k] || {};
  if(l.signatureEnabled === 'no') return '';
  var arr = [];
  for(var i=1;i<=3;i++){
    var t = tpl(x['sign'+i+'Title'],s).trim();
    var n = tpl(x['sign'+i+'Name'],s).trim();
    if(t || n) arr.push({t:t,n:n});
  }
  if(!arr.length) return '';
  arr = arr.slice(0,Math.max(1,Math.min(3,num(l.signatureCount)||arr.length)));
  var cols = Math.max(1,Math.min(3,num(l.signatureColumns)||1));
  return '<div class="rl-signatures" style="margin-top:'+num(l.sigTop||24)+'mm;grid-template-columns:repeat('+cols+',1fr);font-size:'+num(l.signatureFont||14)+'pt;text-align:'+esc(l.signatureAlign||'center')+';font-weight:'+num(l.signatureWeight||800)+';gap:'+num(l.signatureGap||16)+'mm">'+arr.map(function(it){
    return '<div class="sig-cell"><b>'+esc(it.t)+'</b>'+(l.signatureLine==='no'?'':'<div class="sig-line"></div>')+'<b>'+esc(it.n)+'</b></div>';
  }).join('')+'</div>';
}
function stampHtml(s,k){
  var l = getLayout(s,k);
  return l.stampVisible === 'yes' ? '<div class="stamp" style="margin-top:'+num(l.stampTop||12)+'mm">الختم</div>' : '';
}
function preprinted(s){
  return !s.letterheadEnabled || !s.letterheadDataUrl || s.letterheadMode === 'external' || s.letterheadMode === 'preprinted';
}
function headLayer(s){
  if(preprinted(s)) return '';
  var cls = s.letterheadMode === 'top' ? 'top' : 'full';
  var style = cls === 'top' ? 'height:'+num(s.letterheadHeightMm||45)+'mm' : '';
  return '<img class="rl-letterhead '+cls+'" src="'+esc(s.letterheadDataUrl)+'" style="'+style+'" alt="">';
}
function pageHtml(s,k,html){
  var l = getLayout(s,k);
  return '<section class="page '+(preprinted(s)?'preprinted-a4':'')+'">'+headLayer(s)+'<div class="letter-content" style="margin-top:'+num(l.top)+'mm;margin-right:'+num(l.right)+'mm;width:'+num(l.width||174)+'mm;text-align:'+esc(l.align||'right')+'">'+html+'</div></section>';
}
function amountTable(s,k){
  var l = getLayout(s,k), c = context(s);
  if(l.showTable === 'no') return '';
  return '<table class="amt amount-table" style="'+tableCss(l)+'"><colgroup><col class="label"><col class="value"></colgroup><thead><tr><th>البيان</th><th>المبلغ</th></tr></thead><tbody>'+
    '<tr><td>المبلغ الصافي المستحق للمقاول</td><td>'+esc(c.netAmount)+' ريال</td></tr>'+
    '<tr><td>ضريبة القيمة المضافة '+num(s.vatRate)+'%</td><td>'+esc(c.vatAmount)+' ريال</td></tr>'+
    '<tr><td>الإجمالي شامل الضريبة</td><td>'+esc(c.grandAmount)+' ريال</td></tr>'+
    '<tr><td>فقط وقدره</td><td class="words">'+esc(c.amountText)+'</td></tr>'+
    '</tbody></table>';
}
function kvTable(s,k,rows){
  var l = getLayout(s,k);
  if(l.showTable === 'no') return '';
  return '<table class="amt kv-table" style="'+tableCss(l)+'"><colgroup><col class="label"><col class="value"></colgroup><tbody>'+rows.map(function(r){
    return '<tr><td>'+esc(r[0])+'</td><td>'+esc(tpl(r[1],s))+'</td></tr>';
  }).join('')+'</tbody></table>';
}
function listTable(s,k,heads,rows,empty){
  var l = getLayout(s,k);
  if(l.showTable === 'no') return '';
  return '<table class="tbl list-table" style="'+tableCss(l)+'"><thead><tr>'+heads.map(function(h){return '<th>'+esc(h)+'</th>';}).join('')+'</tr></thead><tbody>'+
    (rows.length ? rows.join('') : '<tr><td colspan="'+heads.length+'">'+esc(empty||'لا توجد بيانات')+'</td></tr>')+
    '</tbody></table>';
}
function docIndexItems(){
  return [
    ['final','خطاب الرفع النهائي'],['labor','خطاب العمالة'],['noPrev','عدم أسبقية الصرف'],
    ['salary','شهادة تسليم الرواتب'],['vacancies','بيان الشواغر'],['vacations','بيان الإجازات'],
    ['saudi','بيان السعودة'],['custom','خطاب مخصص']
  ];
}
function buildIndex(s){
  var k='index', x=s.letters[k], page=Math.max(1,num(s.indexStartPage)||1), rows=[];
  docIndexItems().forEach(function(it,i){
    var cnt = Math.max(1,num((s.pageCount||{})[it[0]])||1);
    rows.push('<tr><td>'+arDigits(i+1)+'</td><td>'+esc(it[1])+'</td><td>'+arDigits(page)+'</td><td>'+arDigits(cnt)+'</td></tr>');
    page += cnt;
  });
  return pageHtml(s,k,leadHtml(s,k,x)+bodyHtml(s,k,x.body)+listTable(s,k,['م','اسم المستند','صفحة البداية','عدد الصفحات'],rows,'')+closeHtml(s,k,x.close)+signatureHtml(s,k)+stampHtml(s,k)+noteHtml(s,k));
}
function buildFinal(s){
  var k='final', x=s.letters[k], c = context(s);
  return pageHtml(s,k,leadHtml(s,k,x)+bodyHtml(s,k,x.body)+kvTable(s,k,[
    ['اسم العقد','{contractName}'],['اسم المقاول / الشركة','{companyName}'],['الموقع','{hospitalName}'],
    ['الفترة الزمنية','من {startDate} م حتى {endDate} م'],['رقم الدفعة / المستخلص','{paymentNo}'],
    ['رقم العقد','{contractNo}']
  ])+amountTable(s,k)+'<div class="iban">رقم الحساب البنكي الآيبان: '+esc(c.iban)+'</div>'+closeHtml(s,k,x.close)+bodyHtml(s,k,x.note,'regards')+signatureHtml(s,k)+stampHtml(s,k)+noteHtml(s,k));
}
function buildLabor(s){
  var k='labor', x=s.letters[k];
  return pageHtml(s,k,leadHtml(s,k,x)+bodyHtml(s,k,x.body)+amountTable(s,k)+closeHtml(s,k,x.close)+signatureHtml(s,k)+stampHtml(s,k)+noteHtml(s,k));
}
function buildNoPrev(s){
  var k='noPrev', x=s.letters[k];
  return pageHtml(s,k,leadHtml(s,k,x)+bodyHtml(s,k,x.body)+kvTable(s,k,[
    ['الموقع','{hospitalName}'],['الشركة','{companyName}'],['الفترة','{periodText}'],['رقم العقد','{contractNo}'],['الإجمالي','{grandAmount} ريال']
  ])+closeHtml(s,k,x.close)+signatureHtml(s,k)+stampHtml(s,k)+noteHtml(s,k));
}
function buildSalary(s){
  var k='salary', x=s.letters[k];
  return pageHtml(s,k,leadHtml(s,k,x)+bodyHtml(s,k,x.body)+closeHtml(s,k,x.close)+signatureHtml(s,k)+stampHtml(s,k)+noteHtml(s,k));
}
function buildVacancies(s){
  var k='vacancies', x=s.letters[k], b=baseData();
  var rows = readAttendance().filter(isVacant).map(function(e,i){
    return '<tr><td>'+arDigits(i+1)+'</td><td>'+esc(empJob(e)||'شاغر')+'</td><td>'+dateFmt(b.startDate)+'</td><td>'+dateFmt(b.endDate)+'</td><td>'+esc(e.notes||'')+'</td></tr>';
  });
  return pageHtml(s,k,leadHtml(s,k,x)+bodyHtml(s,k,x.body)+listTable(s,k,['م','مسمى الوظيفة','من','إلى','ملاحظات'],rows,'لا توجد شواغر')+closeHtml(s,k,x.close)+signatureHtml(s,k)+stampHtml(s,k)+noteHtml(s,k));
}
function buildVacations(s){
  var k='vacations', x=s.letters[k], b=baseData();
  var rows = readAttendance().filter(isLeave).map(function(e,i){
    return '<tr><td>'+arDigits(i+1)+'</td><td>'+esc(empName(e))+'</td><td>'+esc(empJob(e))+'</td><td>'+dateFmt(b.startDate)+'</td><td>'+dateFmt(b.endDate)+'</td><td>'+esc(e.notes||'')+'</td></tr>';
  });
  return pageHtml(s,k,leadHtml(s,k,x)+bodyHtml(s,k,x.body)+listTable(s,k,['م','اسم الموظف','مسمى الوظيفة','من','إلى','ملاحظات'],rows,'لا توجد إجازات')+closeHtml(s,k,x.close)+signatureHtml(s,k)+stampHtml(s,k)+noteHtml(s,k));
}
function buildSaudi(s){
  var k='saudi', x=s.letters[k], all=readAttendance();
  var vacant = all.filter(isVacant).length;
  var saudi = all.filter(isSaudi).length;
  var total = Math.max(all.length,saudi+vacant);
  var req = num(s.requiredSaudi)||5;
  var actual = total ? saudi*100/total : 0;
  var shortage = Math.max(0,req-actual);
  var row = '<tr><td>'+arDigits(total)+'</td><td>'+arDigits(saudi)+'</td><td>'+arDigits(vacant)+'</td><td>'+req+'%</td><td>'+actual.toFixed(2)+'%</td><td>'+shortage.toFixed(2)+'%</td></tr>';
  return pageHtml(s,k,leadHtml(s,k,x)+bodyHtml(s,k,x.body)+listTable(s,k,['عدد الوظائف','عدد السعوديين','الشواغر','النسبة المطلوبة','النسبة الفعلية','نسبة النقص'],[row],'')+closeHtml(s,k,x.close)+signatureHtml(s,k)+stampHtml(s,k)+noteHtml(s,k));
}
function buildCustom(s){
  var k='custom', x=s.letters[k], body = s.customBody || x.body || '';
  return pageHtml(s,k,leadHtml(s,k,x)+bodyHtml(s,k,body)+closeHtml(s,k,x.close)+signatureHtml(s,k)+stampHtml(s,k)+noteHtml(s,k));
}
function buildDoc(k,s){
  if(k === 'packet') return PACKET_ORDER.map(function(q){return buildDoc(q,s);}).join('');
  if(k === 'index') return buildIndex(s);
  if(k === 'final') return buildFinal(s);
  if(k === 'labor') return buildLabor(s);
  if(k === 'noPrev') return buildNoPrev(s);
  if(k === 'salary') return buildSalary(s);
  if(k === 'vacancies') return buildVacancies(s);
  if(k === 'vacations') return buildVacations(s);
  if(k === 'saudi') return buildSaudi(s);
  return buildCustom(s);
}
function printCss(s){
  var top = num(s.contentTopMm) + num(s.blankLines)*num(s.lineHeightMm||6);
  var scale = Math.max(60,Math.min(130,num(s.printScale)||72))/100;
  return '<style>@page{size:A4 portrait;margin:0}html,body{margin:0;direction:rtl;font-family:Tajawal,Arial,sans-serif;background:#e5e7eb;-webkit-print-color-adjust:exact;print-color-adjust:exact}.page{width:210mm;height:297mm;margin:10mm auto;background:#fff;box-sizing:border-box;padding:'+num(s.pageMarginTopMm)+'mm '+num(s.pageMarginRightMm)+'mm '+num(s.pageMarginBottomMm)+'mm '+num(s.pageMarginLeftMm)+'mm;page-break-after:always;break-after:page;position:relative;overflow:hidden;box-shadow:0 10px 30px #0002}.rl-letterhead{position:absolute;left:0;right:0;top:0;width:210mm;z-index:0;pointer-events:none;user-select:none}.rl-letterhead.full{height:297mm;object-fit:fill}.rl-letterhead.top{object-fit:fill}.letter-content{position:relative;z-index:1;padding-top:'+top+'mm;transform:scale('+scale+');transform-origin:top right;font-weight:700;color:#111}.rl-title{margin:0}.rl-recipient{display:flex;gap:12mm;white-space:nowrap}.amt,.tbl{border-collapse:collapse;direction:rtl;background:#fff;color:#000}.amt{table-layout:fixed}.tbl{table-layout:auto}.amt th,.amt td,.tbl th,.tbl td{border:1px solid #000;padding:2mm 2.5mm;text-align:center;vertical-align:middle;height:var(--rowh,auto);overflow-wrap:anywhere}.amt th,.tbl th{font-weight:900}.kv-table col.label{width:28%}.kv-table col.value{width:72%}.kv-table td:first-child{font-weight:900;white-space:nowrap}.kv-table td:nth-child(2){text-align:right;line-height:1.75}.amount-table col.label{width:62%}.amount-table col.value{width:38%}.amount-table td:first-child{text-align:right;font-weight:900}.amount-table .words{font-size:90%;line-height:1.7;text-align:right}.rl-signatures{display:grid}.sig-cell{min-height:28mm}.sig-line{height:18mm;border-bottom:1px solid currentColor;margin:0 10mm 4mm}.stamp{text-align:center;font-size:17pt;font-weight:800}.iban{text-align:center;margin:10px 0;font-weight:800}.regards{text-align:center!important;font-weight:900}@media print{html,body{background:#fff}.page{margin:0!important;box-shadow:none!important}.page:last-child{page-break-after:auto!important;break-after:auto!important}}</style>';
}
function fullPrintHtml(k,s){
  return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>'+esc(DOCS[k]||'خطابات الرفع')+'</title><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap" rel="stylesheet">'+printCss(s)+'</head><body>'+buildDoc(k,s)+'</body></html>';
}
function openPrint(k){
  var s = readUi();
  saveSettings(s);
  var doc = k === 'selected' ? (s.selectedDoc || 'final') : k;
  var w = window.open('','_blank','width=1200,height=900');
  if(!w) return alert('المتصفح منع فتح نافذة الطباعة');
  w.document.open();
  w.document.write(fullPrintHtml(doc,s));
  w.document.close();
  setTimeout(function(){try{w.focus();w.print();}catch(e){}},600);
}
function field(path,label,value,type){
  return '<label class="field"><span>'+esc(label)+'</span><input data-f="'+esc(path)+'" type="'+(type||'text')+'" value="'+esc(value == null ? '' : value)+'"></label>';
}
function area(path,label,value){
  return '<label class="field wide"><span>'+esc(label)+'</span><textarea data-f="'+esc(path)+'">'+esc(value||'')+'</textarea></label>';
}
function select(path,label,value,opts){
  return '<label class="field"><span>'+esc(label)+'</span><select data-f="'+esc(path)+'">'+opts.map(function(o){
    return '<option value="'+esc(o[0])+'" '+(String(value)===String(o[0])?'selected':'')+'>'+esc(o[1])+'</option>';
  }).join('')+'</select></label>';
}
function yn(path,label,value){ return select(path,label,value,[['yes','نعم'],['no','لا']]); }
function align(path,label,value){ return select(path,label,value,[['right','يمين'],['center','وسط'],['justify','ضبط'],['left','يسار']]); }
function section(t){ return '<div class="section-title">'+esc(t)+'</div>'; }
function docSelect(s){
  return select('selectedDoc','اختر الخطاب',s.selectedDoc,DOC_ORDER.map(function(k){return [k,DOCS[k]];}));
}
function docCard(k){
  return '<div class="doc-card"><div><b>'+esc(DOCS[k])+'</b><small>'+(k==='index'?'فهرس وتنظيم الصفحات':'يستخدم بيانات المستخلص العادي فقط')+'</small></div><div><button class="btn primary" data-print="'+k+'" type="button">طباعة</button><button class="btn" data-select-doc="'+k+'" type="button">إعدادات</button></div></div>';
}
function generalPanel(s){
  var c = context(s);
  return '<section class="panel open" data-panel="general"><h3>الإعدادات العامة والفهرس والترويسة</h3><p class="hint">تقرأ الصفحة بيانات العقد والمستخلص من المستخلص العادي فقط. مصدر المبلغ الحالي: '+esc(c.amountSource)+'</p><div class="grid">'+
    field('hospitalName','اسم المستشفى',s.hospitalName)+
    field('companyName','الشركة',s.companyName)+
    field('contractName','العقد',s.contractName)+
    field('issuerName','الجهة المصدرة',s.issuerName)+
    field('issuerDepartment','الإدارة / القسم المصدر',s.issuerDepartment)+
    field('issuerLocation','المدينة',s.issuerLocation)+
    field('issuerSignatureTitle','صفة توقيع الجهة المصدرة',s.issuerSignatureTitle)+
    field('issuerSignatureName','اسم توقيع الجهة المصدرة',s.issuerSignatureName)+
    field('vatRate','الضريبة %',s.vatRate,'number')+
    field('manualGrand','مبلغ يدوي شامل الضريبة',s.manualGrand,'number')+
    field('requiredSaudi','نسبة السعودة المطلوبة %',s.requiredSaudi,'number')+
    area('customBody','نص الخطاب المخصص',s.customBody)+
    section('الترويسة والورق')+
    '<label class="field check"><span>تفعيل الترويسة</span><input data-f="letterheadEnabled" type="checkbox" '+(s.letterheadEnabled?'checked':'')+'></label>'+
    select('letterheadMode','وضع الترويسة',s.letterheadMode,[['external','ورق رسمي جاهز A4 / بدون طباعة ترويسة'],['full','صورة A4 كاملة كخلفية'],['top','صورة ترويسة علوية فقط']])+
    field('letterheadHeightMm','ارتفاع الترويسة العلوية mm',s.letterheadHeightMm,'number')+
    field('contentTopMm','نزول بداية المحتوى mm',s.contentTopMm,'number')+
    field('blankLines','نزول إضافي بعدد السطور',s.blankLines,'number')+
    field('lineHeightMm','ارتفاع السطر mm',s.lineHeightMm,'number')+
    field('printScale','تكبير/تصغير الطباعة %',s.printScale,'number')+
    section('هوامش A4')+
    field('pageMarginTopMm','الهامش العلوي mm',s.pageMarginTopMm,'number')+
    field('pageMarginRightMm','الهامش الأيمن mm',s.pageMarginRightMm,'number')+
    field('pageMarginBottomMm','الهامش السفلي mm',s.pageMarginBottomMm,'number')+
    field('pageMarginLeftMm','الهامش الأيسر mm',s.pageMarginLeftMm,'number')+
    section('الفهرس وعدد الصفحات')+
    field('indexStartPage','رقم بداية الفهرس',s.indexStartPage,'number')+
    DOC_ORDER.map(function(k){return field('pageCount.'+k,'عدد صفحات: '+DOCS[k],(s.pageCount||{})[k],'number');}).join('')+
    '</div><div class="actions"><input id="head-file" type="file" accept="image/*"><button class="btn danger" id="delete-head" type="button">حذف الترويسة</button><button class="btn danger" id="wipe-settings" type="button">مسح إعدادات الخطابات</button></div></section>';
}
function docPanel(s){
  var k = s.selectedDoc || 'final';
  var x = s.letters[k] || {};
  var l = getLayout(s,k);
  return '<section class="panel open" data-panel="doc"><h3>إعداد مستقل لكل خطاب</h3><p class="hint">اختر الخطاب وعدّل النصوص والشكل والتواقيع. الحفظ تلقائي والمعاينة مباشرة.</p><div class="doc-top">'+docSelect(s)+'</div><div class="grid">'+
    section('النصوص الثابتة')+
    field('letters.'+k+'.recipient','المخاطب',x.recipient)+
    field('letters.'+k+'.suffix','الصفة',x.suffix)+
    field('letters.'+k+'.title','الموضوع',x.title)+
    area('letters.'+k+'.body','جسم الخطاب',x.body)+
    area('letters.'+k+'.close','الخاتمة',x.close)+
    area('letters.'+k+'.note','عبارة ختامية / ملاحظة',x.note)+
    section('الموضوع والمخاطب والتحية')+
    yn('layout.'+k+'.recipientVisible','إظهار المخاطب',l.recipientVisible)+
    yn('layout.'+k+'.titleVisible','إظهار الموضوع',l.titleVisible)+
    yn('layout.'+k+'.titleFirst','الموضوع فوق الكل',l.titleFirst)+
    yn('layout.'+k+'.titleUnderline','خط تحت الموضوع',l.titleUnderline)+
    yn('layout.'+k+'.recipientSpread','فصل المخاطب والصفة',l.recipientSpread)+
    yn('layout.'+k+'.greetingVisible','إظهار التحية',l.greetingVisible)+
    field('layout.'+k+'.greetingText','نص التحية',l.greetingText)+
    field('layout.'+k+'.top','نزول الخطاب داخل الصفحة mm',l.top,'number')+
    field('layout.'+k+'.right','تحريك الخطاب من اليمين mm',l.right,'number')+
    field('layout.'+k+'.width','عرض مساحة الخطاب mm',l.width,'number')+
    align('layout.'+k+'.titleAlign','محاذاة الموضوع',l.titleAlign)+
    field('layout.'+k+'.titleFont','حجم خط الموضوع',l.titleFont,'number')+
    field('layout.'+k+'.titleAfter','مسافة بعد الموضوع mm',l.titleAfter,'number')+
    field('layout.'+k+'.recipientFont','حجم خط المخاطب',l.recipientFont,'number')+
    select('layout.'+k+'.recipientAlign','محاذاة المخاطب',l.recipientAlign,[['right','يمين'],['center','وسط'],['left','يسار']])+
    field('layout.'+k+'.greetingFont','حجم خط التحية',l.greetingFont,'number')+
    select('layout.'+k+'.greetingAlign','محاذاة التحية',l.greetingAlign,[['right','يمين'],['center','وسط'],['left','يسار']])+
    field('layout.'+k+'.greetingAfter','مسافة بعد التحية mm',l.greetingAfter,'number')+
    section('جسم الخطاب والجداول والتواقيع')+
    yn('layout.'+k+'.bodyVisible','إظهار جسم الخطاب',l.bodyVisible)+
    yn('layout.'+k+'.closeVisible','إظهار الخاتمة',l.closeVisible)+
    yn('layout.'+k+'.noteVisible','إظهار الملاحظة',l.noteVisible)+
    field('layout.'+k+'.bodyFont','حجم خط جسم الخطاب',l.bodyFont,'number')+
    align('layout.'+k+'.bodyAlign','محاذاة جسم الخطاب',l.bodyAlign)+
    field('layout.'+k+'.bodyLine','تباعد سطور الجسم',l.bodyLine,'number')+
    yn('layout.'+k+'.showTable','إظهار الجدول',l.showTable)+
    field('layout.'+k+'.tableTop','مسافة قبل الجدول mm',l.tableTop,'number')+
    field('layout.'+k+'.tableWidth','عرض الجدول mm',l.tableWidth,'number')+
    field('layout.'+k+'.tableFont','حجم خط الجدول',l.tableFont,'number')+
    field('layout.'+k+'.tableRowHeight','ارتفاع الصف mm',l.tableRowHeight,'number')+
    yn('layout.'+k+'.signatureEnabled','إظهار التواقيع',l.signatureEnabled)+
    yn('layout.'+k+'.signatureLine','خط التوقيع',l.signatureLine)+
    field('layout.'+k+'.signatureCount','عدد التواقيع',l.signatureCount,'number')+
    field('layout.'+k+'.signatureColumns','عدد أعمدة التواقيع',l.signatureColumns,'number')+
    field('layout.'+k+'.sigTop','مكان التواقيع من أعلى mm',l.sigTop,'number')+
    field('layout.'+k+'.signatureFont','حجم خط التواقيع',l.signatureFont,'number')+
    field('letters.'+k+'.sign1Title','صفة التوقيع 1',x.sign1Title)+
    field('letters.'+k+'.sign1Name','اسم التوقيع 1',x.sign1Name)+
    field('letters.'+k+'.sign2Title','صفة التوقيع 2',x.sign2Title)+
    field('letters.'+k+'.sign2Name','اسم التوقيع 2',x.sign2Name)+
    field('letters.'+k+'.sign3Title','صفة التوقيع 3',x.sign3Title)+
    field('letters.'+k+'.sign3Name','اسم التوقيع 3',x.sign3Name)+
    yn('layout.'+k+'.stampVisible','إظهار الختم',l.stampVisible)+
    field('layout.'+k+'.stampTop','مكان الختم من أعلى mm',l.stampTop,'number')+
    '</div></section>';
}
function appCss(){
  return '<style id="hospital-raise-clean-ui-css">html,body{margin:0;direction:rtl;font-family:Tajawal,Arial,sans-serif;background:#eef3f9;color:#0f172a}*{box-sizing:border-box}.app{min-height:100vh;padding:18px}.shell{width:min(1360px,97vw);margin:0 auto;background:#fff;border-radius:22px;padding:18px;box-shadow:0 18px 55px rgba(15,23,42,.18)}.head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;border-bottom:1px solid #e2e8f0;padding-bottom:14px;margin-bottom:12px}.head h1{margin:0 0 6px;color:#003087;font-size:23px;font-weight:950}.head h2{margin:0 0 6px;font-size:17px}.head p,.hint,.group p,small{color:#64748b;font-weight:800;line-height:1.7}.actions,.row,.printbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.btn{border:1px solid #cbd5e1;border-radius:10px;padding:9px 13px;font-weight:950;cursor:pointer;background:#f1f5f9;color:#0f172a;font-family:inherit;margin:2px}.btn.primary{background:#003087;color:#fff;border-color:#003087}.btn.safe{background:#047857;color:#fff;border-color:#047857}.btn.secondary{background:#475569;color:#fff;border-color:#475569}.btn.warn{background:#92400e;color:#fff;border-color:#92400e}.btn.danger{background:#fee2e2;color:#991b1b;border-color:#fecaca}.flash{opacity:0;transition:.2s;color:#15803d;font-weight:950;margin-top:6px}.flash.show{opacity:1}.panel{border:2px solid #0f766e;background:#f0fdfa;border-radius:18px;padding:14px;margin:12px 0}.panel h3,.preview h3{margin:0 0 8px;font-size:17px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.field{display:block;background:#fff;border:1px solid #dbe4f0;border-radius:12px;padding:10px}.field span{display:block;font-size:12px;font-weight:950;color:#334155;margin-bottom:6px}.field input,.field select,.field textarea{width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:9px;font-family:inherit;font-weight:800;background:#fff}.field.wide,.wide{grid-column:1/-1}.field textarea{min-height:76px}.field.check input{width:auto;transform:scale(1.2)}.section-title{grid-column:1/-1;background:#e0f2fe;color:#0f172a;border-radius:10px;padding:8px 10px;font-weight:950;margin-top:6px}.doc-top{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:8px 0}.group{border:1px solid #dbe4f0;border-radius:18px;padding:14px;margin:12px 0;background:#fff}.extract{border-top:4px solid #003087}.cert{border-top:4px solid #0f766e}.manage{border-top:4px solid #64748b}.doc-card{display:flex;justify-content:space-between;gap:10px;align-items:center;border:1px solid #e2e8f0;background:#fff;border-radius:12px;padding:10px;margin:8px 0}.doc-card b{display:block}.doc-card small{display:block}.preview{background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:12px;margin-top:14px}.preview iframe{display:block;width:min(100%,1120px);height:840px;margin:0 auto;border:1px solid #cbd5e1;border-radius:14px;background:#e5e7eb}.printbar{position:sticky;bottom:0;z-index:15;background:#fff;border:1px solid #dbe3ef;border-radius:16px;padding:12px;margin-top:12px;box-shadow:0 -8px 25px #0f172a14}@media(max-width:820px){.head{display:block}.doc-card{display:block}.preview iframe{height:680px}.grid{grid-template-columns:1fr}}</style>';
}
function buildAppHtml(s){
  return appCss()+'<div class="app"><div class="shell"><div class="head"><div><h1>خطابات رفع المستخلص العادي</h1><h2>مركز خطابات المستخلص</h2><p>نفس نظام مركز المكاتب: إعداد عام، إعداد مستقل لكل خطاب، ترويسة A4، معاينة، وطباعة. البيانات والحسابات من المستخلص العادي فقط.</p><div id="flash" class="flash">جاهز</div></div><div class="actions"><button class="btn primary" id="save-now" type="button">حفظ الآن</button><button class="btn secondary" id="preview-now" type="button">تحديث المعاينة</button><button class="btn danger" id="close-page" type="button">إغلاق</button></div></div><div class="row"><button class="btn primary" data-scroll="general" type="button">الإعدادات العامة والفهرس والترويسة</button><button class="btn" data-scroll="doc" type="button">إعداد مستقل لكل خطاب</button><button class="btn safe" data-print="packet" type="button">طباعة كل الخطابات</button></div>'+
    '<div id="general-wrap">'+generalPanel(s)+'</div><div id="doc-wrap">'+docPanel(s)+'</div>'+
    '<section class="group extract"><h3>١. مستندات المستخلص</h3><p>خطابات المستخلص الأساسية والفهرس وعدم أسبقية الصرف.</p>'+['index','final','labor','noPrev'].map(docCard).join('')+'</section>'+
    '<section class="group cert"><h3>٢. الشهادات والبيانات</h3><p>شهادات وبيانات تستخدم attendanceData وبيانات المستخلص العادي فقط.</p>'+['salary','vacancies','vacations','saudi'].map(docCard).join('')+'</section>'+
    '<section class="group manage"><h3>٣. إدارة ومعاينة</h3><div class="row">'+docCard('custom')+'<button class="btn warn" id="reset-doc" type="button">رجوع افتراضي لهذا الخطاب</button><button class="btn warn" id="reset-all" type="button">رجوع افتراضي للكل</button><button class="btn safe" id="export-settings" type="button">تصدير الإعدادات</button><button class="btn safe" id="import-settings-btn" type="button">استيراد الإعدادات</button><input id="import-settings-file" type="file" accept="application/json" style="display:none"></div><div class="preview"><h3>المعاينة المباشرة</h3><iframe id="preview-frame"></iframe></div></section>'+
    '<div class="printbar"><button class="btn" data-print="selected" type="button">طباعة الخطاب المختار</button><button class="btn safe" data-print="packet" type="button">طباعة كل الخطابات</button><button class="btn" data-print="index" type="button">طباعة الفهرس</button><button class="btn" data-print="final" type="button">طباعة الرفع النهائي</button><button class="btn" data-print="labor" type="button">طباعة العمالة</button><button class="btn" data-print="salary" type="button">طباعة شهادة الرواتب</button><button class="btn" data-print="noPrev" type="button">طباعة عدم أسبقية الصرف</button><button class="btn" data-print="vacancies" type="button">طباعة الشواغر</button><button class="btn" data-print="vacations" type="button">طباعة الإجازات</button><button class="btn" data-print="saudi" type="button">طباعة السعودة</button><button class="btn" data-print="custom" type="button">طباعة مخصص</button></div>'+
    '</div></div>';
}
function flash(t){
  var f = document.getElementById('flash');
  if(!f) return;
  f.textContent = t;
  f.classList.add('show');
  setTimeout(function(){ f.classList.remove('show'); },1400);
}
function readUi(){
  var s = loadSettings();
  document.querySelectorAll('#hospital-raise-clean-center [data-f]').forEach(function(el){
    var v = el.type === 'number' ? num(el.value) : el.type === 'checkbox' ? el.checked : el.value;
    setPath(s,el.dataset.f,v);
  });
  return s;
}
function renderPreview(s,force){
  clearTimeout(previewTimer);
  function run(){
    s = s || loadSettings();
    var k = s.selectedDoc || 'final';
    var html = fullPrintHtml(k,s);
    if(!force && html === lastPreview) return;
    lastPreview = html;
    var f = document.getElementById('preview-frame');
    if(f) f.srcdoc = html;
  }
  previewTimer = setTimeout(run, force ? 0 : 250);
}
function autosave(){
  var s = readUi();
  saveSettings(s);
  renderPreview(s,false);
}
function rerenderKeep(){
  var s = readUi();
  saveSettings(s);
  mount(false);
}
function bind(root){
  root.querySelector('#save-now').onclick = function(){ var s=readUi(); saveSettings(s); renderPreview(s,true); flash('تم الحفظ'); };
  root.querySelector('#preview-now').onclick = function(){ var s=readUi(); saveSettings(s); renderPreview(s,true); flash('تم تحديث المعاينة'); };
  root.querySelector('#close-page').onclick = function(){
    try{ window.close(); }catch(e){}
    setTimeout(function(){ if(!window.closed && history.length>1) history.back(); },100);
  };
  root.querySelectorAll('[data-print]').forEach(function(b){ b.onclick = function(){ openPrint(b.dataset.print); }; });
  root.querySelectorAll('[data-select-doc]').forEach(function(b){ b.onclick = function(){ var s=readUi(); s.selectedDoc=b.dataset.selectDoc; saveSettings(s); mount(false); }; });
  root.querySelectorAll('[data-scroll]').forEach(function(b){ b.onclick = function(){ var p=root.querySelector('[data-panel="'+b.dataset.scroll+'"]'); if(p) p.scrollIntoView({behavior:'smooth',block:'start'}); }; });
  root.querySelectorAll('input[data-f],textarea[data-f],select[data-f]').forEach(function(el){
    if(el.dataset.f === 'selectedDoc') el.onchange = rerenderKeep;
    else { el.oninput = autosave; el.onchange = autosave; }
  });
  root.querySelector('#head-file').onchange = function(){
    var f = this.files && this.files[0];
    if(!f) return;
    if(!/^image\//.test(f.type||'')) return alert('ارفع صورة فقط.');
    if(f.size > 1200000 && !confirm('حجم الصورة أكبر من 1.2MB وقد يبطئ الحفظ. الاستمرار؟')) return;
    var r = new FileReader();
    r.onload = function(){
      var s = readUi();
      s.letterheadDataUrl = String(r.result||'');
      s.letterheadEnabled = true;
      saveSettings(s);
      mount(false);
      flash('تم حفظ الترويسة');
    };
    r.readAsDataURL(f);
  };
  root.querySelector('#delete-head').onclick = function(){
    var s=readUi();
    s.letterheadDataUrl='';
    s.letterheadEnabled=false;
    saveSettings(s);
    mount(false);
  };
  root.querySelector('#wipe-settings').onclick = function(){
    if(!confirm('مسح إعدادات خطابات المستشفى فقط؟')) return;
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem('hospitalRaiseLettersSettings_v7');
    localStorage.removeItem('hospitalRaiseLettersSettings_v6');
    localStorage.removeItem(CLEAN_MARK);
    mount(true);
  };
  root.querySelector('#reset-doc').onclick = function(){
    if(!confirm('رجوع الخطاب المختار للوضع الافتراضي؟')) return;
    var s=readUi(), d=defaultSettings(), k=s.selectedDoc||'final';
    s.letters[k]=d.letters[k];
    s.layout[k]=d.layout[k];
    saveSettings(s);
    mount(false);
  };
  root.querySelector('#reset-all').onclick = function(){
    if(!confirm('رجوع كل الخطابات للوضع الافتراضي؟')) return;
    var s=readUi(), d=defaultSettings();
    s.letters=d.letters;
    s.layout=d.layout;
    s.pageCount=d.pageCount;
    saveSettings(s);
    mount(false);
  };
  root.querySelector('#export-settings').onclick = function(){
    var s=readUi();
    var blob = new Blob([JSON.stringify(s,null,2)],{type:'application/json'});
    var a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='hospital_raise_letters_settings_v8_clean.json';
    a.click();
    setTimeout(function(){URL.revokeObjectURL(a.href);},1000);
  };
  root.querySelector('#import-settings-btn').onclick = function(){ root.querySelector('#import-settings-file').click(); };
  root.querySelector('#import-settings-file').onchange = function(){
    var f=this.files&&this.files[0];
    if(!f) return;
    var r=new FileReader();
    r.onload=function(){
      try{
        var data=JSON.parse(String(r.result||'{}'));
        var s=mergeDeep(defaultSettings(),data);
        saveSettings(s);
        mount(false);
      }catch(e){ alert('ملف الإعدادات غير صالح'); }
    };
    r.readAsText(f);
  };
}
function takeoverPage(){
  document.documentElement.lang = 'ar';
  document.documentElement.dir = 'rtl';
  document.body.innerHTML = '';
  document.body.className = 'hospital-raise-clean-center-page';
}
function mount(resetOld){
  if(resetOld) purgeOldOnce();
  takeoverPage();
  lastPreview = '';
  var s = loadSettings();
  var root = document.createElement('div');
  root.id = 'hospital-raise-clean-center';
  root.innerHTML = buildAppHtml(s);
  document.body.appendChild(root);
  bind(root);
  renderPreview(s,true);
  console.info('[HospitalRaiseClean] mounted clean hospital raise letters center v8. Only keys: persistentContractData, persistentExtractData, attendanceData, hospitalRaiseLettersSettings_v8');
}
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded',function(){ mount(true); });
}else{
  mount(true);
}

})();
