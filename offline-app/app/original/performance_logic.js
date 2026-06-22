// ===================================================================
// Performance Logic - HG1 Admin Offices / Workshops
// المكاتب: 100 / 87
// الورش: 100 / 90 - جدول ح غ 1 بشكل الورش
// ===================================================================

const ADMIN_OFFICE_PERFORMANCE_ITEMS = [
  ['مدى نظافة المباني من الداخل والخارج وكذلك الأسطح',4,4],
  ['نظافة الأفنية والممرات',4,4],
  ['مدى نظافة الأثاث',4,4],
  ['مدى نظافة دورات المياه',4,3],
  ['مدى مكافحة الحشرات والتخلص من النفايات غير الطبية',4,3],
  ['السنترال والتليفونات والفاكس',4,4],
  ['نظام إنذار الحريق',4,4],
  ['مدى صيانة شبكات الكهرباء ولوحات التوزيع واستبدال الأجزاء التالفة',4,4],
  ['مدى كفاية الإنارة وتغيير التالف من اللمبات والبرايز والمفاتيح',4,4],
  ['مدى المرور والصيانة لفريق الصيانة',4,4],
  ['مدى صيانة الأجهزة الكهربية (تليفزيون، فيديو، مراوح..... إلخ)',4,3],
  ['مدى صيانة المكيفات والثلاجات والبرادات والسخانات',4,4],
  ['مدى تنظيف خزانات المياه العلوية والسفلية',3,3],
  ['مدى تسليك مواسير الصرف الصحي وكسح المجاري',3,3],
  ['مدى إصلاح المغاسل والسيفونات والمحابس والحنفيات',4,4],
  ['مدى إصلاح الطلمبات وشبكة المياه',3,3],
  ['مدى أداء الصيانة العامة للمبنى (نجارة - دهان - بلاط)',4,3],
  ['مدى صيانة الأثاث (مكاتب - كراسي - دواليب)',4,3],
  ['مدى صيانة وتعبئة وسائل مكافحة الحريق وأجهزة كشف الدخان',4,3],
  ['مدى صيانة ماكينات التصوير وأجهزة الحاسب الآلي والطابعات',4,3],
  ['مدى الإصلاح للأجهزة المعطلة',4,3],
  ['مدى توفير قطع الغيار والمستهلكات الصيانة ومستهلكات أجهزة النسخ والطباعة النسخ والتصوير',6,4],
  ['مدى توفير مواد النظافة ومطابقتها للمواصفات',4,3],
  ['مدى توفير أدوات النظافة من (مكانس - سطول - سلات مهملات - أكياس... إلخ)',6,5],
  ['مدى ارتداء العاملين للزي الرسمي وحمل بطاقات التعريف',3,2]
].map(x => ({ text:x[0], max:x[1], score:x[2] }));

const WORKSHOP_PERFORMANCE_ITEMS = [
  { section:'', sub:'المغسلة', text:'المغسلة', max:6, score:5 },
  { section:'', sub:'السمكرة والبوية', text:'السمكرة والبوية', max:6, score:6 },
  { section:'', sub:'البنشر', text:'البنشر', max:6, score:6 },
  { section:'', sub:'التبريد', text:'التبريد', max:8, score:7 },
  { section:'', sub:'فحص الأعطال', text:'فحص الأعطال', max:7, score:6 },
  { section:'قسم الكهرباء', sub:'تشغيل', text:'قسم الكهرباء - تشغيل', max:10, score:9, rowspan:2 },
  { section:'', sub:'صيانة وقائية', text:'قسم الكهرباء - صيانة وقائية', max:2, score:2, groupedContinuation:true },
  { section:'قسم الميكانيكا', sub:'تشغيل', text:'قسم الميكانيكا - تشغيل', max:16, score:15, rowspan:2 },
  { section:'', sub:'صيانة وقائية', text:'قسم الميكانيكا - صيانة وقائية', max:4, score:4, groupedContinuation:true },
  { section:'', sub:'الأعمال الإدارية', text:'الأعمال الإدارية', max:7, score:6 },
  { section:'', sub:'النظافة', text:'النظافة', max:7, score:6 },
  { section:'', sub:'المخزن/المشتريات', text:'المخزن/المشتريات', max:7, score:6 },
  { section:'', sub:'هل تتم الاستجابة لتعليمات المهندس المشرف من الموقع', text:'هل تتم الاستجابة لتعليمات المهندس المشرف من الموقع', max:5, score:5 },
  { section:'', sub:'هل تتم الاستجابة السريعة لأي حالة طارئة', text:'هل تتم الاستجابة السريعة لأي حالة طارئة', max:6, score:5 },
  { section:'', sub:'هل يحمل منسوبو المقاول بطاقات التعريف ويرتدون الزي الرسمي', text:'هل يحمل منسوبو المقاول بطاقات التعريف ويرتدون الزي الرسمي', max:3, score:2 }
];

const DEFAULT_PERFORMANCE_ITEMS = ADMIN_OFFICE_PERFORMANCE_ITEMS;
const PERFORMANCE_TEMPLATE_VERSION = 'hg1_admin_workshop_final_20260622_v5';
const PERFORMANCE_SCORE_VERSION = 'hg1_score_final_20260622_v5';

function isWorkshopCenter(centerKey){ return centerKey === 'admin_staff'; }
function cloneItems(items){ return JSON.parse(JSON.stringify(items)); }
function getPerformanceStorageKey(centerKey){ return `performanceItems_hg1_${centerKey}_v5`; }
function getDefaultPerformanceItems(centerKey){ return cloneItems(isWorkshopCenter(centerKey) ? WORKSHOP_PERFORMANCE_ITEMS : ADMIN_OFFICE_PERFORMANCE_ITEMS); }
function getDefaultScore(item){ const max=parseInt(item.max,10)||0; const score=item.score!==undefined?parseInt(item.score,10):max; return isNaN(score)?max:Math.max(0,Math.min(score,max)); }
function getPerformanceData(){ try{return JSON.parse(localStorage.getItem('performanceData_v4')||'{}');}catch(_){return{};} }
function savePerformanceData(data){ localStorage.setItem('performanceData_v4', JSON.stringify(data||{})); }
function clearOldPerformanceScoresOnce(centerKey){ const key=`performanceScoreVersion_${centerKey}`; if(localStorage.getItem(key)===PERFORMANCE_SCORE_VERSION)return; const d=getPerformanceData(); if(d[centerKey]){delete d[centerKey];savePerformanceData(d);} localStorage.setItem(key,PERFORMANCE_SCORE_VERSION); }

function getPerformanceItems(centerKey){
  if(isWorkshopCenter(centerKey)){
    ['performanceItems_general_v1','performanceItems_hg1_admin_staff_v1','performanceItems_hg1_admin_staff_v2','performanceItems_hg1_admin_staff_v3','performanceItems_hg1_admin_staff_v4','performanceItems_hg1_admin_staff_v5'].forEach(k=>localStorage.removeItem(k));
    ['performanceItems_hg1_admin_staff_v1_version','performanceItems_hg1_admin_staff_v2_version','performanceItems_hg1_admin_staff_v3_version','performanceItems_hg1_admin_staff_v4_version','performanceItems_hg1_admin_staff_v5_version'].forEach(k=>localStorage.removeItem(k));
    clearOldPerformanceScoresOnce(centerKey);
    return cloneItems(WORKSHOP_PERFORMANCE_ITEMS);
  }
  const storageKey=getPerformanceStorageKey(centerKey);
  const versionKey=`${storageKey}_version`;
  const stored=localStorage.getItem(storageKey);
  if(stored && localStorage.getItem(versionKey)===PERFORMANCE_TEMPLATE_VERSION){
    try{const parsed=JSON.parse(stored); if(Array.isArray(parsed)&&parsed.length)return parsed;}catch(e){console.error(e);}
  }
  const defaults=getDefaultPerformanceItems(centerKey);
  localStorage.setItem(storageKey,JSON.stringify(defaults));
  localStorage.setItem(versionKey,PERFORMANCE_TEMPLATE_VERSION);
  clearOldPerformanceScoresOnce(centerKey);
  return defaults;
}
function savePerformanceItems(centerKey,items){ if(isWorkshopCenter(centerKey))return; const k=getPerformanceStorageKey(centerKey); localStorage.setItem(k,JSON.stringify(items)); localStorage.setItem(`${k}_version`,PERFORMANCE_TEMPLATE_VERSION); }
function getPerformanceScore(centerKey,item,index){ const d=getPerformanceData()[centerKey]||{}; if(d[index]!==undefined){ let v=parseInt(d[index],10); const max=parseInt(item.max,10)||0; if(isNaN(v))v=getDefaultScore(item); return Math.max(0,Math.min(v,max)); } return getDefaultScore(item); }
function formatPerformanceDate(dateString){ if(!dateString)return'غير محدد'; try{return new Date(dateString).toLocaleDateString('en-CA');}catch(_){return'غير محدد';} }
function scoreInputHTML(centerKey,item,index){ const score=getPerformanceScore(centerKey,item,index); return `<input type="number" inputmode="numeric" lang="en" dir="ltr" class="score-input" style="font-family:Arial,Tahoma,sans-serif;direction:ltr;unicode-bidi:plaintext;text-align:center;width:70px;" data-item-index="${index}" min="0" max="${item.max}" value="${score}" oninput="savePerformanceScoreLive('${centerKey}',this)">`; }

function buildAdminPerformanceRows(centerKey){ const items=getPerformanceItems(centerKey); let rows='',maxTotal=0; items.forEach((item,i)=>{rows+=`<tr><td>${i+1}</td><td class="item-text">${item.text}</td><td>${item.max}</td><td>${scoreInputHTML(centerKey,item,i)}</td></tr>`; maxTotal+=parseInt(item.max,10)||0;}); return {rows,maxTotal}; }
function buildWorkshopPerformanceRows(centerKey,printMode=false){ const items=getPerformanceItems(centerKey); let rows='',maxTotal=0; items.forEach((item,i)=>{ const s=getPerformanceScore(centerKey,item,i); const scoreCell=printMode?s:scoreInputHTML(centerKey,item,i); let cells=''; if(item.groupedContinuation){cells=`<td class="workshop-sub">${item.sub}</td>`;} else if(item.section){cells=`<td class="workshop-group" rowspan="${item.rowspan||1}">${item.section}</td><td class="workshop-sub">${item.sub}</td>`;} else {cells=`<td class="item-text" colspan="2">${item.sub||item.text}</td>`;} rows+=`<tr>${cells}<td>${item.max}</td><td>${scoreCell}</td></tr>`; maxTotal+=parseInt(item.max,10)||0; }); return {rows,maxTotal}; }
function buildPerformanceTableHTML(centerKey){ if(isWorkshopCenter(centerKey)){ const b=buildWorkshopPerformanceRows(centerKey,false); return `<table class="performance-table workshop-performance-table"><thead><tr><th colspan="2">أنشطة القسم</th><th>الدرجة القصوى</th><th>التقدير</th></tr></thead><tbody>${b.rows}<tr class="total-row"><td colspan="2">المجمــــــــــــــــوع</td><td id="perf-max-total-${centerKey}">${b.maxTotal}</td><td id="perf-score-total-${centerKey}">0</td></tr></tbody></table>`;} const b=buildAdminPerformanceRows(centerKey); return `<table class="performance-table"><thead><tr><th>م</th><th>أنشطة القسم</th><th>الدرجة القصوى</th><th>التقدير</th></tr></thead><tbody>${b.rows}<tr class="total-row"><td colspan="2">المجمــــــــــــــــوع</td><td id="perf-max-total-${centerKey}">${b.maxTotal}</td><td id="perf-score-total-${centerKey}">0</td></tr></tbody></table>`; }

function renderPerformanceTable(centerKey){
  const container=document.getElementById('performance-tab'); if(!container)return;
  const centerName=(typeof getCenterNames==='function'&&getCenterNames()[centerKey])||'الموقع';
  const extractData=JSON.parse(localStorage.getItem('persistentExtractData')||'{}');
  const extractStart=formatPerformanceDate(extractData.extractStart), extractEnd=formatPerformanceDate(extractData.extractEnd);
  const centerTotalCost=calculateCenterTotalCost(centerKey);
  const manageButton=isWorkshopCenter(centerKey)?'':`<button class="btn-action btn-manage-items" onclick="openEditItemsDialog('${centerKey}')"><i class="fas fa-tasks"></i> إدارة البنود</button>`;
  container.innerHTML=`<div class="certificate-container" id="performance-certificate-${centerKey}"><style>#performance-certificate-${centerKey} .workshop-performance-table th{background:#d6ffd6;font-weight:700}#performance-certificate-${centerKey} .workshop-performance-table td{text-align:center;vertical-align:middle}#performance-certificate-${centerKey} .workshop-performance-table .item-text,#performance-certificate-${centerKey} .workshop-performance-table .workshop-sub,#performance-certificate-${centerKey} .workshop-performance-table .workshop-group{font-weight:600}#performance-certificate-${centerKey} .workshop-performance-table .workshop-group{width:22%}#performance-certificate-${centerKey} .workshop-performance-table .workshop-sub{width:28%}</style><div class="performance-cost-display"><span>إجمالي المبلغ لأنشطة القسم (تكلفة العمالة):</span><span class="cost-value">${centerTotalCost.toFixed(2)} ريال</span></div><div class="certificate-header"><h2>جدول ح غ 1</h2><h3>جدول الغرامات الخاصة بمستوى الأداء لموقع ${centerName}</h3><p>عن الفترة من : ${extractStart}م إلى ${extractEnd}م</p></div>${buildPerformanceTableHTML(centerKey)}<div class="certificate-summary" id="perf-summary-${centerKey}"></div><div class="signatures-display-section" id="perf-signatures-${centerKey}"></div><div class="tab-action-buttons">${manageButton}<button class="btn-action btn-update" onclick="renderPerformanceTable('${centerKey}')"><i class="fas fa-sync-alt"></i> تحديث</button><button class="btn-action btn-reset" onclick="resetPerformanceScores('${centerKey}')"><i class="fas fa-undo"></i> إعادة تعيين</button><button class="btn-action btn-print" onclick="printPerformanceCertificate('${centerKey}')"><i class="fas fa-print"></i> طباعة</button><button class="btn-action btn-export-pdf" onclick="exportPerformanceToPDF('${centerKey}')"><i class="fas fa-file-pdf"></i> تصدير PDF</button><button class="btn-action btn-export-excel" onclick="exportPerformanceToExcel('${centerKey}')"><i class="fas fa-file-excel"></i> تصدير Excel</button><button class="btn-action btn-signatures" onclick="openSignatureDialog('performance','${centerKey}')"><i class="fas fa-signature"></i> التواقيع</button></div></div>`;
  calculatePerformanceSummary(centerKey); try{if(typeof displaySignatures==='function')displaySignatures('performance',centerKey);}catch(_){}
}
function savePerformanceScoreLive(centerKey,input){ const i=parseInt(input.dataset.itemIndex,10); const item=getPerformanceItems(centerKey)[i]; const max=parseInt(item.max,10)||0; let v=parseInt(input.value,10); if(isNaN(v))v=0; if(v<0)v=0; if(v>max)v=max; input.value=v; const d=getPerformanceData(); d[centerKey]=d[centerKey]||{}; d[centerKey][i]=v; savePerformanceData(d); calculatePerformanceSummary(centerKey); if(typeof renderAchievementCertificate==='function')renderAchievementCertificate(centerKey); }
function calculatePerformanceSummary(centerKey){ const items=getPerformanceItems(centerKey); let maxTotal=0,totalScore=0; items.forEach((item,i)=>{maxTotal+=parseInt(item.max,10)||0; totalScore+=getPerformanceScore(centerKey,item,i);}); const m=document.getElementById(`perf-max-total-${centerKey}`),s=document.getElementById(`perf-score-total-${centerKey}`); if(m)m.textContent=maxTotal; if(s)s.textContent=totalScore; const pct=maxTotal?totalScore/maxTotal*100:100; let ded=0; if(pct<60)ded=15; else if(pct<65)ded=10; else if(pct<70)ded=8; else if(pct<75)ded=6; else if(pct<80)ded=4; else if(pct<85)ded=2; const cost=calculateCenterTotalCost(centerKey); const amount=cost*ded/100; const sum=document.getElementById(`perf-summary-${centerKey}`); if(sum)sum.innerHTML=`<p>إجمالي المبلغ لأنشطة القسم = <span>${cost.toFixed(2)}</span> ريال</p><p>التقدير الذي حصل عليه المقاول : <span>${pct.toFixed(2)}%</span></p><p>نسبة الحسم على المقاول لهذا القسم : <span>${ded}%</span> ويساوي <span>${amount.toFixed(2)}</span> ريال</p>`; const all=JSON.parse(localStorage.getItem('performanceDeductions')||'{}'); all[centerKey]=amount; localStorage.setItem('performanceDeductions',JSON.stringify(all)); }
function calculateCenterTotalCost(centerKey){ const centerData=(typeof getAttendanceData==='function'?getAttendanceData()[centerKey]:[])||[]; const c=JSON.parse(localStorage.getItem('persistentContractData')||'{}'); const direct=parseFloat(c.directPurchaseRatio)||0; return centerData.reduce((t,emp)=>{let salary=parseFloat(emp.salary)||0; if(c.contractType==='شراء مباشر'&&direct>0)salary+=salary*direct/100; return t+salary;},0); }
function resetPerformanceScores(centerKey){ const d=getPerformanceData(); delete d[centerKey]; savePerformanceData(d); localStorage.removeItem(`performanceScoreVersion_${centerKey}`); renderPerformanceTable(centerKey); }
function togglePerformanceEditMode(centerKey,button){ document.querySelectorAll(`#performance-certificate-${centerKey} .score-input`).forEach(i=>i.disabled=false); if(button)button.style.display='none'; }
function saveAllPerformanceScores(centerKey){ document.querySelectorAll(`#performance-certificate-${centerKey} .score-input`).forEach(input=>savePerformanceScoreLive(centerKey,input)); }
function openEditItemsDialog(centerKey){ alert(isWorkshopCenter(centerKey)?'بنود الورش ثابتة حسب نموذج جدول ح غ 1.':'إدارة بنود المكاتب غير مفعلة في هذه النسخة المختصرة.'); }
function addNewPerformanceItemField(){}
function saveEditedPerformanceItems(centerKey){}
function calculatePerformanceTotalScore(centerKey){ return getPerformanceItems(centerKey).reduce((sum,item,i)=>sum+getPerformanceScore(centerKey,item,i),0); }
function buildPrintRows(centerKey){ return isWorkshopCenter(centerKey)?buildWorkshopPerformanceRows(centerKey,true):buildAdminPerformanceRows(centerKey); }
function printPerformanceCertificate(centerKey){ window.print(); }
function exportPerformanceToPDF(centerKey){ const el=document.getElementById(`performance-certificate-${centerKey}`); if(typeof html2pdf!=='undefined'&&el)html2pdf().from(el).save(`performance_${centerKey}.pdf`); else window.print(); }
function exportPerformanceToExcel(centerKey){ if(typeof XLSX==='undefined'){alert('مكتبة Excel غير محملة.');return;} const centerName=(getCenterNames()[centerKey]||centerKey); const items=getPerformanceItems(centerKey); const rows=isWorkshopCenter(centerKey)?[['القسم','البند','الدرجة القصوى','التقدير']]:[['م','أنشطة القسم','الدرجة القصوى','التقدير']]; let max=0,score=0; items.forEach((item,i)=>{const s=getPerformanceScore(centerKey,item,i);max+=parseInt(item.max,10)||0;score+=s;if(isWorkshopCenter(centerKey))rows.push([item.section||'',item.sub||item.text,item.max,s]);else rows.push([i+1,item.text,item.max,s]);}); rows.push(['','المجمــــــــــــــــوع',max,score]); const wb=XLSX.utils.book_new(); const ws=XLSX.utils.aoa_to_sheet(rows); XLSX.utils.book_append_sheet(wb,ws,'جدول ح غ 1'); XLSX.writeFile(wb,`جدول_ح_غ_1_${centerName}.xlsx`); }
