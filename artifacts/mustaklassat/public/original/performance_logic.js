// ===================================================================
// Performance Logic - HG1 Admin Offices / Workshops
// - المكاتب: جدول ح غ 1 بإجمالي 100 / 87
// - الورش: جدول ح غ 1 بإجمالي 100 / 90 بشكل مطابق للنموذج الورقي
// - التقدير مفتوح ويحفظ تلقائيًا
// - العنوان: لموقع وليس لمركز
// ===================================================================

// --- 1. CONFIGURATION & DEFAULTS ---

const ADMIN_OFFICE_PERFORMANCE_ITEMS = [
    { text: 'مدى نظافة المباني من الداخل والخارج وكذلك الأسطح', max: 4, score: 4 },
    { text: 'نظافة الأفنية والممرات', max: 4, score: 4 },
    { text: 'مدى نظافة الأثاث', max: 4, score: 4 },
    { text: 'مدى نظافة دورات المياه', max: 4, score: 3 },
    { text: 'مدى مكافحة الحشرات والتخلص من النفايات غير الطبية', max: 4, score: 3 },
    { text: 'السنترال والتليفونات والفاكس', max: 4, score: 4 },
    { text: 'نظام إنذار الحريق', max: 4, score: 4 },
    { text: 'مدى صيانة شبكات الكهرباء ولوحات التوزيع واستبدال الأجزاء التالفة', max: 4, score: 4 },
    { text: 'مدى كفاية الإنارة وتغيير التالف من اللمبات والبرايز والمفاتيح', max: 4, score: 4 },
    { text: 'مدى المرور والصيانة لفريق الصيانة', max: 4, score: 4 },
    { text: 'مدى صيانة الأجهزة الكهربية (تليفزيون، فيديو، مراوح..... إلخ)', max: 4, score: 3 },
    { text: 'مدى صيانة المكيفات والثلاجات والبرادات والسخانات', max: 4, score: 4 },
    { text: 'مدى تنظيف خزانات المياه العلوية والسفلية', max: 3, score: 3 },
    { text: 'مدى تسليك مواسير الصرف الصحي وكسح المجاري', max: 3, score: 3 },
    { text: 'مدى إصلاح المغاسل والسيفونات والمحابس والحنفيات', max: 4, score: 4 },
    { text: 'مدى إصلاح الطلمبات وشبكة المياه', max: 3, score: 3 },
    { text: 'مدى أداء الصيانة العامة للمبنى (نجارة - دهان - بلاط)', max: 4, score: 3 },
    { text: 'مدى صيانة الأثاث (مكاتب - كراسي - دواليب)', max: 4, score: 3 },
    { text: 'مدى صيانة وتعبئة وسائل مكافحة الحريق وأجهزة كشف الدخان', max: 4, score: 3 },
    { text: 'مدى صيانة ماكينات التصوير وأجهزة الحاسب الآلي والطابعات', max: 4, score: 3 },
    { text: 'مدى الإصلاح للأجهزة المعطلة', max: 4, score: 3 },
    { text: 'مدى توفير قطع الغيار والمستهلكات الصيانة ومستهلكات أجهزة النسخ والطباعة النسخ والتصوير', max: 6, score: 4 },
    { text: 'مدى توفير مواد النظافة ومطابقتها للمواصفات', max: 4, score: 3 },
    { text: 'مدى توفير أدوات النظافة من (مكانس - سطول - سلات مهملات - أكياس... إلخ)', max: 6, score: 5 },
    { text: 'مدى ارتداء العاملين للزي الرسمي وحمل بطاقات التعريف', max: 3, score: 2 }
];

const WORKSHOP_PERFORMANCE_ITEMS = [
    { section: '', sub: 'المغسلة', text: 'المغسلة', max: 6, score: 5 },
    { section: '', sub: 'السمكرة والبوية', text: 'السمكرة والبوية', max: 6, score: 6 },
    { section: '', sub: 'البنشر', text: 'البنشر', max: 6, score: 6 },
    { section: '', sub: 'التبريد', text: 'التبريد', max: 8, score: 7 },
    { section: '', sub: 'فحص الأعطال', text: 'فحص الأعطال', max: 7, score: 6 },
    { section: 'قسم الكهرباء', sub: 'تشغيل', text: 'قسم الكهرباء - تشغيل', max: 10, score: 9, rowspan: 2 },
    { section: '', sub: 'صيانة وقائية', text: 'قسم الكهرباء - صيانة وقائية', max: 2, score: 2, groupedContinuation: true },
    { section: 'قسم الميكانيكا', sub: 'تشغيل', text: 'قسم الميكانيكا - تشغيل', max: 16, score: 15, rowspan: 2 },
    { section: '', sub: 'صيانة وقائية', text: 'قسم الميكانيكا - صيانة وقائية', max: 4, score: 4, groupedContinuation: true },
    { section: '', sub: 'الأعمال الإدارية', text: 'الأعمال الإدارية', max: 7, score: 6 },
    { section: '', sub: 'النظافة', text: 'النظافة', max: 7, score: 6 },
    { section: '', sub: 'المخزن/المشتريات', text: 'المخزن/المشتريات', max: 7, score: 6 },
    { section: '', sub: 'هل تتم الاستجابة لتعليمات المهندس المشرف من الموقع', text: 'هل تتم الاستجابة لتعليمات المهندس المشرف من الموقع', max: 5, score: 5 },
    { section: '', sub: 'هل تتم الاستجابة السريعة لأي حالة طارئة', text: 'هل تتم الاستجابة السريعة لأي حالة طارئة', max: 6, score: 5 },
    { section: '', sub: 'هل يحمل منسوبو المقاول بطاقات التعريف ويرتدون الزي الرسمي', text: 'هل يحمل منسوبو المقاول بطاقات التعريف ويرتدون الزي الرسمي', max: 3, score: 2 }
];

const DEFAULT_PERFORMANCE_ITEMS = ADMIN_OFFICE_PERFORMANCE_ITEMS;
const PERFORMANCE_TEMPLATE_VERSION = 'hg1_admin_workshop_grouped_2026_06_22_v4';
const PERFORMANCE_SCORE_VERSION = 'hg1_scores_grouped_2026_06_22_v4';

function isWorkshopCenter(centerKey) { return centerKey === 'admin_staff'; }
function cloneItems(items) { return JSON.parse(JSON.stringify(items)); }
function getDefaultPerformanceItems(centerKey) { return cloneItems(isWorkshopCenter(centerKey) ? WORKSHOP_PERFORMANCE_ITEMS : ADMIN_OFFICE_PERFORMANCE_ITEMS); }
function getDefaultScore(item) { const max = parseInt(item.max, 10) || 0; const score = item.score !== undefined ? parseInt(item.score, 10) : max; if (isNaN(score)) return max; return Math.max(0, Math.min(score, max)); }
function getPerformanceStorageKey(centerKey) { return `performanceItems_hg1_${centerKey}_v4`; }

function getPerformanceItems(centerKey) {
    if (isWorkshopCenter(centerKey)) {
        ['v1','v2','v3','v4'].forEach(v => {
            localStorage.removeItem(`performanceItems_hg1_admin_staff_${v}`);
            localStorage.removeItem(`performanceItems_hg1_admin_staff_${v}_version`);
        });
        clearOldPerformanceScoresOnce(centerKey);
        return cloneItems(WORKSHOP_PERFORMANCE_ITEMS);
    }
    const storageKey = getPerformanceStorageKey(centerKey);
    const versionKey = `${storageKey}_version`;
    const storedItems = localStorage.getItem(storageKey);
    const storedVersion = localStorage.getItem(versionKey);
    if (storedItems && storedVersion === PERFORMANCE_TEMPLATE_VERSION) {
        try { const parsedItems = JSON.parse(storedItems); if (Array.isArray(parsedItems) && parsedItems.length > 0) return parsedItems; }
        catch (e) { console.error(`خطأ في تحليل بيانات البنود للمفتاح ${storageKey}:`, e); }
    }
    const defaults = getDefaultPerformanceItems(centerKey);
    localStorage.setItem(storageKey, JSON.stringify(defaults));
    localStorage.setItem(versionKey, PERFORMANCE_TEMPLATE_VERSION);
    clearOldPerformanceScoresOnce(centerKey);
    return defaults;
}

function savePerformanceItems(centerKey, items) { if (isWorkshopCenter(centerKey)) return; const storageKey = getPerformanceStorageKey(centerKey); localStorage.setItem(storageKey, JSON.stringify(items)); localStorage.setItem(`${storageKey}_version`, PERFORMANCE_TEMPLATE_VERSION); }
function getPerformanceData() { return JSON.parse(localStorage.getItem('performanceData_v4')) || {}; }
function savePerformanceData(data) { localStorage.setItem('performanceData_v4', JSON.stringify(data)); }

function clearOldPerformanceScoresOnce(centerKey) {
    const key = `performanceScoreVersion_${centerKey}`;
    if (localStorage.getItem(key) === PERFORMANCE_SCORE_VERSION) return;
    const allPerformanceData = getPerformanceData();
    if (allPerformanceData[centerKey]) { delete allPerformanceData[centerKey]; savePerformanceData(allPerformanceData); }
    localStorage.setItem(key, PERFORMANCE_SCORE_VERSION);
}

function getPerformanceScore(centerKey, item, index) {
    const centerPerformance = getPerformanceData()[centerKey] || {};
    if (centerPerformance[index] !== undefined) {
        const max = parseInt(item.max, 10) || 0;
        let value = parseInt(centerPerformance[index], 10);
        if (isNaN(value)) value = getDefaultScore(item);
        return Math.max(0, Math.min(value, max));
    }
    return getDefaultScore(item);
}

function formatPerformanceDate(dateString) { if (!dateString) return 'غير محدد'; try { return new Date(dateString).toLocaleDateString('en-CA'); } catch (_) { return 'غير محدد'; } }
function scoreInputHTML(centerKey, item, index) { const score = getPerformanceScore(centerKey, item, index); return `<input type="number" inputmode="numeric" lang="en" dir="ltr" class="score-input" style="font-family:Arial,Tahoma,sans-serif;direction:ltr;unicode-bidi:plaintext;text-align:center;width:70px;" data-item-index="${index}" min="0" max="${item.max}" value="${score}" oninput="savePerformanceScoreLive('${centerKey}', this)">`; }

function buildAdminPerformanceRows(centerKey) {
    const items = getPerformanceItems(centerKey); let rows = '', maxTotal = 0;
    items.forEach((item, index) => { rows += `<tr><td>${index + 1}</td><td class="item-text">${item.text}</td><td>${item.max}</td><td>${scoreInputHTML(centerKey, item, index)}</td></tr>`; maxTotal += parseInt(item.max, 10) || 0; });
    return { rows, maxTotal };
}

function buildWorkshopPerformanceRows(centerKey, printMode = false) {
    const items = getPerformanceItems(centerKey); let rows = '', maxTotal = 0;
    items.forEach((item, index) => {
        const scoreValue = getPerformanceScore(centerKey, item, index);
        const scoreCell = printMode ? scoreValue : scoreInputHTML(centerKey, item, index);
        let activityCells = '';
        if (item.groupedContinuation) activityCells = `<td class="workshop-sub">${item.sub || item.text}</td>`;
        else if (item.section) activityCells = `<td class="workshop-group" rowspan="${item.rowspan || 1}">${item.section}</td><td class="workshop-sub">${item.sub || ''}</td>`;
        else activityCells = `<td class="item-text" colspan="2">${item.sub || item.text}</td>`;
        rows += `<tr>${activityCells}<td>${item.max}</td><td>${scoreCell}</td></tr>`;
        maxTotal += parseInt(item.max, 10) || 0;
    });
    return { rows, maxTotal };
}

function buildPerformanceTableHTML(centerKey) {
    if (isWorkshopCenter(centerKey)) { const built = buildWorkshopPerformanceRows(centerKey, false); return `<table class="performance-table workshop-performance-table"><thead><tr><th colspan="2">أنشطة القسم</th><th>الدرجة القصوى</th><th>التقدير</th></tr></thead><tbody>${built.rows}<tr class="total-row"><td colspan="2">المجمــــــــــــــــوع</td><td id="perf-max-total-${centerKey}">${built.maxTotal}</td><td id="perf-score-total-${centerKey}">0</td></tr></tbody></table>`; }
    const built = buildAdminPerformanceRows(centerKey); return `<table class="performance-table"><thead><tr><th>م</th><th>أنشطة القسم</th><th>الدرجة القصوى</th><th>التقدير</th></tr></thead><tbody>${built.rows}<tr class="total-row"><td colspan="2">المجمــــــــــــــــوع</td><td id="perf-max-total-${centerKey}">${built.maxTotal}</td><td id="perf-score-total-${centerKey}">0</td></tr></tbody></table>`;
}

function renderPerformanceTable(centerKey) {
    const container = document.getElementById('performance-tab'); if (!container) return;
    const centerName = getCenterNames()[centerKey] || 'الموقع';
    const extractData = JSON.parse(localStorage.getItem('persistentExtractData') || '{}');
    const extractStart = formatPerformanceDate(extractData.extractStart);
    const extractEnd = formatPerformanceDate(extractData.extractEnd);
    const centerTotalCost = calculateCenterTotalCost(centerKey);
    const manageButton = isWorkshopCenter(centerKey) ? '' : `<button class="btn-action btn-manage-items" onclick="openEditItemsDialog('${centerKey}')"><i class="fas fa-tasks"></i> إدارة البنود</button>`;
    const certificateHTML = `<div class="certificate-container" id="performance-certificate-${centerKey}"><style>#performance-certificate-${centerKey} .workshop-performance-table th{background:#d6ffd6;font-weight:700}#performance-certificate-${centerKey} .workshop-performance-table td{text-align:center;vertical-align:middle}#performance-certificate-${centerKey} .workshop-performance-table .item-text,#performance-certificate-${centerKey} .workshop-performance-table .workshop-sub,#performance-certificate-${centerKey} .workshop-performance-table .workshop-group{font-weight:600}#performance-certificate-${centerKey} .workshop-performance-table .workshop-group{width:22%}#performance-certificate-${centerKey} .workshop-performance-table .workshop-sub{width:28%}</style><div class="performance-cost-display"><span>إجمالي المبلغ لأنشطة القسم (تكلفة العمالة):</span><span class="cost-value">${centerTotalCost.toFixed(2)} ريال</span></div><div class="certificate-header"><h2>جدول ح غ 1</h2><h3>جدول الغرامات الخاصة بمستوى الأداء لموقع ${centerName}</h3><p>عن الفترة من : ${extractStart}م إلى ${extractEnd}م</p></div>${buildPerformanceTableHTML(centerKey)}<div class="certificate-summary" id="perf-summary-${centerKey}"></div><div class="signatures-display-section" id="perf-signatures-${centerKey}"></div><div class="tab-action-buttons">${manageButton}<button class="btn-action btn-update" onclick="renderPerformanceTable('${centerKey}')"><i class="fas fa-sync-alt"></i> تحديث</button><button class="btn-action btn-reset" onclick="resetPerformanceScores('${centerKey}')"><i class="fas fa-undo"></i> إعادة تعيين</button><button class="btn-action btn-print" onclick="printPerformanceCertificate('${centerKey}')"><i class="fas fa-print"></i> طباعة</button><button class="btn-action btn-export-pdf" onclick="exportPerformanceToPDF('${centerKey}')"><i class="fas fa-file-pdf"></i> تصدير PDF</button><button class="btn-action btn-export-excel" onclick="exportPerformanceToExcel('${centerKey}')"><i class="fas fa-file-excel"></i> تصدير Excel</button><button class="btn-action btn-signatures" onclick="openSignatureDialog('performance', '${centerKey}')"><i class="fas fa-signature"></i> التواقيع</button></div></div>`;
    container.innerHTML = certificateHTML;
    calculatePerformanceSummary(centerKey);
    if (typeof displaySignatures === 'function') displaySignatures('performance', centerKey);
}

function savePerformanceScoreLive(centerKey, input) { const itemIndex = parseInt(input.dataset.itemIndex, 10); const performanceItems = getPerformanceItems(centerKey); const max = parseInt(performanceItems[itemIndex].max, 10); let value = parseInt(input.value, 10); if (isNaN(value)) value = 0; if (value < 0) value = 0; if (value > max) value = max; input.value = value; const allPerformanceData = getPerformanceData(); if (!allPerformanceData[centerKey]) allPerformanceData[centerKey] = {}; allPerformanceData[centerKey][itemIndex] = value; savePerformanceData(allPerformanceData); calculatePerformanceSummary(centerKey); if (typeof renderAchievementCertificate === 'function') renderAchievementCertificate(centerKey); }
function togglePerformanceEditMode(centerKey, button){const inputs=document.querySelectorAll(`#performance-certificate-${centerKey} .score-input`);inputs.forEach(input=>input.disabled=false);if(button)button.style.display='none';}
function saveAllPerformanceScores(centerKey){document.querySelectorAll(`#performance-certificate-${centerKey} .score-input`).forEach(input=>savePerformanceScoreLive(centerKey,input));if(typeof showSuccessMessage==='function')showSuccessMessage('تم حفظ الدرجات بنجاح!');}
function calculatePerformanceSummary(centerKey){const performanceItems=getPerformanceItems(centerKey);let totalScore=0,maxTotal=0;performanceItems.forEach((item,index)=>{totalScore+=getPerformanceScore(centerKey,item,index);maxTotal+=parseInt(item.max,10)||0;});const maxEl=document.getElementById(`perf-max-total-${centerKey}`);const scoreEl=document.getElementById(`perf-score-total-${centerKey}`);if(maxEl)maxEl.textContent=maxTotal;if(scoreEl)scoreEl.textContent=totalScore;const percentage=maxTotal>0?(totalScore/maxTotal)*100:100;let deductionPercentage=0;if(percentage<60)deductionPercentage=15;else if(percentage<65)deductionPercentage=10;else if(percentage<70)deductionPercentage=8;else if(percentage<75)deductionPercentage=6;else if(percentage<80)deductionPercentage=4;else if(percentage<85)deductionPercentage=2;const centerCost=calculateCenterTotalCost(centerKey);const deductionAmount=(centerCost*deductionPercentage)/100;const summaryEl=document.getElementById(`perf-summary-${centerKey}`);if(summaryEl)summaryEl.innerHTML=`<p>إجمالي المبلغ لأنشطة القسم = <span>${centerCost.toFixed(2)}</span> ريال</p><p>التقدير الذي حصل عليه المقاول : <span>${percentage.toFixed(2)}%</span></p><p>نسبة الحسم على المقاول لهذا القسم : <span>${deductionPercentage}%</span> ويساوي <span>${deductionAmount.toFixed(2)}</span> ريال</p>`;const allDeductions=JSON.parse(localStorage.getItem('performanceDeductions')||'{}');allDeductions[centerKey]=deductionAmount;localStorage.setItem('performanceDeductions',JSON.stringify(allDeductions));}
function calculateCenterTotalCost(centerKey){const centerData=(typeof getAttendanceData==='function'?getAttendanceData()[centerKey]:[])||[];const contractData=JSON.parse(localStorage.getItem('persistentContractData')||'{}');const contractType=contractData.contractType||'عقد أساسي';const directPurchaseRatio=parseFloat(contractData.directPurchaseRatio)||0;return centerData.reduce((total,emp)=>{const salary=parseFloat(emp.salary)||0;let adjustedSalary=salary;if(contractType==='شراء مباشر'&&directPurchaseRatio>0)adjustedSalary=salary+(salary*directPurchaseRatio/100);return total+adjustedSalary;},0);}
function openEditItemsDialog(centerKey){if(isWorkshopCenter(centerKey)){alert('بنود الورش ثابتة حسب نموذج جدول ح غ 1.');return;}const performanceItems=getPerformanceItems(centerKey);let itemsHTML='';performanceItems.forEach((item,index)=>{itemsHTML+=`<div class="dialog-item-row" id="edit-item-${index}"><div class="item-content"><div class="form-group"><label>نص البند (بند ${index+1}):</label><input type="text" class="edit-text-input" value="${item.text}"></div><div class="form-group max-score-group"><label>الدرجة القصوى:</label><input type="number" lang="en" dir="ltr" class="edit-max-input" value="${item.max}" min="1"></div><div class="form-group max-score-group"><label>التقدير الافتراضي:</label><input type="number" lang="en" dir="ltr" class="edit-score-input" value="${getDefaultScore(item)}" min="0" max="${item.max}"></div></div><button class="btn-danger" onclick="this.parentElement.remove()" title="حذف هذا البند"><i class="fas fa-trash"></i></button></div>`;});const content=`<div class="dialog-header"><h3><i class="fas fa-tasks"></i> إدارة بنود تقييم الأداء لموقع: ${getCenterNames()[centerKey]}</h3><span class="close" onclick="closeDialog('management-dialog')">×</span></div><div class="dialog-body" id="edit-items-container">${itemsHTML}</div><div class="dialog-footer"><button class="btn btn-primary" onclick="addNewPerformanceItemField()"><i class="fas fa-plus"></i> إضافة بند جديد</button><div class="footer-actions"><button class="btn btn-success" onclick="saveEditedPerformanceItems('${centerKey}')"><i class="fas fa-save"></i> حفظ التغييرات</button><button class="btn btn-secondary" onclick="closeDialog('management-dialog')">إغلاق</button></div></div>`;openDialog(content,'management-dialog',true);}
function saveEditedPerformanceItems(centerKey){const newItems=[];document.querySelectorAll('#edit-items-container .dialog-item-row').forEach(row=>{const text=row.querySelector('.edit-text-input').value.trim();const max=parseInt(row.querySelector('.edit-max-input').value,10);let score=parseInt(row.querySelector('.edit-score-input')?.value,10);if(isNaN(score))score=max;if(!isNaN(max)&&max>0)score=Math.max(0,Math.min(score,max));if(text&&!isNaN(max)&&max>0)newItems.push({text,max,score});});savePerformanceItems(centerKey,newItems);const allPerformanceData=getPerformanceData();delete allPerformanceData[centerKey];savePerformanceData(allPerformanceData);closeDialog();renderPerformanceTable(centerKey);if(typeof renderAchievementCertificate==='function')renderAchievementCertificate(centerKey);if(typeof showSuccessMessage==='function')showSuccessMessage('تم حفظ التغييرات على البنود بنجاح!');}
function addNewPerformanceItemField(){const container=document.getElementById('edit-items-container');const newItem=document.createElement('div');newItem.className='dialog-item-row';newItem.innerHTML=`<div class="item-content"><div class="form-group"><label>نص البند الجديد:</label><input type="text" class="edit-text-input" placeholder="اكتب نص البند هنا"></div><div class="form-group max-score-group"><label>الدرجة القصوى:</label><input type="number" lang="en" dir="ltr" class="edit-max-input" value="5" min="1"></div><div class="form-group max-score-group"><label>التقدير الافتراضي:</label><input type="number" lang="en" dir="ltr" class="edit-score-input" value="5" min="0"></div></div><button class="btn-danger" onclick="this.parentElement.remove()" title="حذف هذا البند"><i class="fas fa-trash"></i></button>`;container.appendChild(newItem);}
function resetPerformanceScores(centerKey){const allPerformanceData=getPerformanceData();delete allPerformanceData[centerKey];savePerformanceData(allPerformanceData);localStorage.removeItem(`performanceScoreVersion_${centerKey}`);renderPerformanceTable(centerKey);}
function buildPrintRows(centerKey){if(isWorkshopCenter(centerKey))return buildWorkshopPerformanceRows(centerKey,true);const items=getPerformanceItems(centerKey);let rows='',maxTotal=0;items.forEach((it,i)=>{const s=getPerformanceScore(centerKey,it,i);rows+=`<tr><td>${i+1}</td><td class="item-text">${it.text}</td><td>${it.max}</td><td>${s}</td></tr>`;maxTotal+=parseInt(it.max,10)||0;});return{rows,maxTotal};}
function calculatePerformanceTotalScore(centerKey){return getPerformanceItems(centerKey).reduce((sum,item,index)=>sum+getPerformanceScore(centerKey,item,index),0);}
function printPerformanceCertificate(centerKey){const extractData=JSON.parse(localStorage.getItem('persistentExtractData')||'{}');const centerName=getCenterNames()[centerKey]||'الموقع';const extractStart=formatPerformanceDate(extractData.extractStart);const extractEnd=formatPerformanceDate(extractData.extractEnd);const win=window.open('','_blank','width=1200,height=800');const doc=win.document;const built=buildPrintRows(centerKey);const tableHead=isWorkshopCenter(centerKey)?'<tr><th colspan="2">أنشطة القسم</th><th>الدرجة القصوى</th><th>التقدير</th></tr>':'<tr><th>م</th><th>أنشطة القسم</th><th>الدرجة القصوى</th><th>التقدير</th></tr>';let signaturesHTML='';const sig=document.getElementById(`perf-signatures-${centerKey}`);if(sig){sig.querySelectorAll('.signature-item-display,.signature-block-display,.sb-item').forEach(item=>{const title=item.querySelector('.title,.sb-item-title')?.textContent||'غير محدد';const name=item.querySelector('.name,.sb-item-name')?.textContent||'..............................';signaturesHTML+=`<div class="sign-box"><div>${title}</div><div class="name-placeholder">${name}</div><div class="line"></div></div>`;});}doc.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>طباعة تقييم الأداء - ${centerName}</title><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet"><style>@page{size:A4 portrait;margin:.7cm}*{box-sizing:border-box;font-family:'Tajawal',Arial,sans-serif}body{margin:0;background:#fff;color:#000;-webkit-print-color-adjust:exact}.header-table{width:100%;border-bottom:2px solid #0056b3;margin-bottom:10px}.header-table td{text-align:center;padding:2px 4px}.logo{width:70px}.title-box h1{font-size:16pt;margin:2px;color:#003087}.title-box h2{font-size:12pt;margin:2px}.cert-title{font-size:15pt;font-weight:700;text-align:center;margin:8px 0}.sub-title{font-size:12pt;text-align:center;margin:4px 0}.cost-bar{background:#f2f2f2;padding:6px;text-align:center;font-size:11pt;font-weight:700;margin:8px 0}table.performance-print{width:100%;border-collapse:collapse;font-size:9pt;table-layout:fixed}table.performance-print th,table.performance-print td{border:1px solid #333;padding:4px;text-align:center}table.performance-print th{background:#d6ffd6}.item-text{text-align:center;font-weight:600}.workshop-group,.workshop-sub{font-weight:600}.summary{margin-top:10px;font-size:11pt;line-height:1.5}.summary span{font-weight:700}.signatures{margin-top:25px;display:flex;justify-content:space-around;border-top:1px solid #333;padding-top:10px}.sign-box{text-align:center;font-size:10pt;width:24%;font-weight:500}.sign-box .line{border-bottom:1px solid #000;margin-top:30px}</style></head><body><table class="header-table"><tr><td style="width:18%"><img class="logo" src="${document.querySelector('.logo-left')?.src}" alt="Logo"></td><td class="title-box"><h1>${document.querySelector('.header-info h1')?.textContent}</h1><h2>${document.querySelector('.header-info h3')?.textContent}</h2></td><td style="width:18%"><img class="logo" src="${document.querySelector('.logo-right')?.src}" alt="Logo"></td></tr></table><div class="cert-title">جدول ح غ 1</div><div class="sub-title">جدول الغرامات الخاصة بمستوى الأداء لموقع ${centerName}</div><div class="sub-title">عن الفترة من : ${extractStart}م إلى ${extractEnd}م</div><div class="cost-bar">إجمالي المبلغ لأنشطة القسم (تكلفة العمالة): ${calculateCenterTotalCost(centerKey).toFixed(2)} ريال</div><table class="performance-print"><thead>${tableHead}</thead><tbody>${built.rows}<tr style="font-weight:bold;background:#d6ffd6"><td colspan="2">المجمــــــــــــــــوع</td><td>${built.maxTotal}</td><td>${calculatePerformanceTotalScore(centerKey)}</td></tr></tbody></table><div class="summary">${document.getElementById(`perf-summary-${centerKey}`)?.innerHTML||''}</div><div class="signatures">${signaturesHTML}</div></body></html>`);doc.close();win.onload=function(){win.focus();win.print();win.close();};}
function exportPerformanceToPDF(centerKey){const element=document.getElementById(`performance-certificate-${centerKey}`);if(typeof html2pdf!=='undefined'&&element)html2pdf().from(element).save(`performance_${centerKey}.pdf`);else printPerformanceCertificate(centerKey);}
function exportPerformanceToExcel(centerKey){if(typeof XLSX==='undefined'){alert('مكتبة Excel غير محملة.');return;}const centerName=getCenterNames()[centerKey]||'الموقع';const items=getPerformanceItems(centerKey);let maxT=0,scoreT=0;const rows=isWorkshopCenter(centerKey)?[['القسم','البند','الدرجة القصوى','التقدير']]:[['م','أنشطة القسم','الدرجة القصوى','التقدير']];items.forEach((item,index)=>{const s=getPerformanceScore(centerKey,item,index);maxT+=parseInt(item.max,10)||0;scoreT+=s;if(isWorkshopCenter(centerKey))rows.push([item.section||'',item.sub||item.text,item.max,s]);else rows.push([index+1,item.text,item.max,s]);});rows.push(['','المجمــــــــــــــــوع',maxT,scoreT]);const wb=XLSX.utils.book_new();const ws=XLSX.utils.aoa_to_sheet(rows);XLSX.utils.book_append_sheet(wb,ws,'جدول ح غ 1');XLSX.writeFile(wb,`جدول_ح_غ_1_${centerName}.xlsx`);}
window.buildAdminOfficePerformancePrintHtml = function(centerKey, options = {}) {
  const contractData = JSON.parse(localStorage.getItem('persistentContractData') || '{}');
  const extractData = JSON.parse(localStorage.getItem('persistentExtractData') || '{}');
  const centerNames = typeof getCenterNames === 'function'
    ? getCenterNames()
    : JSON.parse(localStorage.getItem('adminOfficeNames_v1') || '{}');

  const centerName = centerNames[centerKey] || centerKey;
  const items = typeof getPerformanceItems === 'function'
    ? getPerformanceItems(centerKey)
    : [];

  const scores = items.map((item, index) => {
    if (typeof getPerformanceScore === 'function') {
      return getPerformanceScore(centerKey, item, index);
    }
    return item.score !== undefined ? item.score : item.max;
  });

  const esc = v => String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const money = v => (Number(v) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const fmtDate = v => {
    if (!v) return 'غير محدد';
    try { return new Date(v).toLocaleDateString('en-CA'); }
    catch (_) { return 'غير محدد'; }
  };

  const getSignaturesForPrint = (type, key) => {
    let sigKey = type;
    try {
      if (typeof getSignatureKeyForContext === 'function') {
        sigKey = getSignatureKeyForContext(type, key);
      }
    } catch (_) {}

    let sigs = [];
    try {
      if (typeof getSignatures === 'function') sigs = getSignatures(sigKey) || [];
    } catch (_) {}

    if (!sigs.length && sigKey !== type) {
      try { sigs = getSignatures(type) || []; } catch (_) {}
    }

    if (!sigs.length) {
      sigs = [
        { title: 'مدير المشروع', name: '' },
        { title: 'رئيس قسم الصيانة', name: '' },
        { title: 'مندوب المقاول', name: '' }
      ];
    }

    return sigs;
  };

  let maxTotal = 0;
  let scoreTotal = 0;

  const rows = items.map((item, index) => {
    const max = Number(item.max) || 0;
    const score = Number(scores[index]) || 0;
    maxTotal += max;
    scoreTotal += score;

    return `
      <tr>
        <td class="activity-cell">${esc(item.sub || item.text || '')}</td>
        <td>${max}</td>
        <td>${score}</td>
      </tr>
    `;
  }).join('');

  const percent = maxTotal > 0 ? (scoreTotal / maxTotal * 100) : 100;

  let deductionPercent = 0;
  if (percent < 60) deductionPercent = 15;
  else if (percent < 65) deductionPercent = 10;
  else if (percent < 70) deductionPercent = 8;
  else if (percent < 75) deductionPercent = 6;
  else if (percent < 80) deductionPercent = 4;
  else if (percent < 85) deductionPercent = 2;

  const sectionAmount =
    typeof calculateCenterTotalCost === 'function'
      ? calculateCenterTotalCost(centerKey)
      : 0;

  const performanceFine = sectionAmount * deductionPercent / 100;

  const deductions = JSON.parse(localStorage.getItem('performanceDeductions') || '{}');
  deductions[centerKey] = performanceFine;
  localStorage.setItem('performanceDeductions', JSON.stringify(deductions));

  const signatures = getSignaturesForPrint('performance', centerKey).map(sig => `
    <div class="perf-sign-box">
      <div class="sig-title">${esc(sig.title || '')}</div>
      <div class="sig-line"></div>
      <div class="sig-name">${esc(sig.name || '')}</div>
    </div>
  `).join('');

  return `
    <div class="page-container portrait-page-perf admin-performance-print-page">
      <div class="perf-header">
        <img src="najran_health_cluster_logo.png">
        <div>
          <h1>فرع وزارة الصحة بمنطقة نجران</h1>
          <h2>المكاتب الإدارية والمرافق الصحية</h2>
        </div>
        <img src="najran_health_cluster_logo.png">
      </div>

      <div class="perf-contract-box">
        <div><b>تفاصيل العقد:</b> ${esc(contractData.contractDetails || '—')} | <b>نوع العقد:</b> ${esc(contractData.contractType || 'عقد أساسي')}</div>
        <div><b>مدة المستخلص:</b> من ${fmtDate(extractData.extractStart)} إلى ${fmtDate(extractData.extractEnd)}</div>
      </div>

      <div class="perf-blue-title">جدول ح غ 1 - تقييم قسم ${esc(centerName)}</div>

      <div class="perf-amount-line">
        <b>إجمالي المبلغ للقسم:</b> ${money(sectionAmount)} ريال
      </div>

      <table class="perf-print-table">
        <thead>
          <tr>
            <th>أنشطة القسم</th>
            <th>الدرجة القصوى</th>
            <th>التقدير</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="perf-total-row">
            <td>المجموع</td>
            <td>${maxTotal}</td>
            <td>${scoreTotal}</td>
          </tr>
        </tbody>
      </table>

      <div class="perf-summary-lines">
        <p>التقدير الذي حصل عليه المقاول: ${scoreTotal} من ${maxTotal} (%${percent.toFixed(2)})</p>
        <p>نسبة الحسم للمقاول في هذا القسم: %${deductionPercent}</p>
        <p>مبلغ غرامة الأداء علي المقاول لهذا الجدول: ${money(performanceFine)} ريال سعودي</p>
        <p>بناءً على ما سبق تم تقييم القسم من خلال لجنة الإشراف والمتابعة حسب المعايير المعتمدة، وتم احتساب المبلغ المستحق بناءً على نسبة التقييم.</p>
      </div>

      <div class="perf-signatures">${signatures}</div>
    </div>
  `;
};
