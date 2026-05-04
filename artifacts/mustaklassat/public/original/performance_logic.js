// ===================================================================
//
//  Performance Logic - (V12 - Targeted Isolation)
//  Author: Manus AI
//  Description: A targeted update that isolates performance items
//  ONLY for specific centers ('center_2' and 'center_8'), while all
//  other centers share a common list. This is the optimal solution.
//
// ===================================================================

// --- 1. CONFIGURATION & DEFAULTS ---
const DEFAULT_PERFORMANCE_ITEMS = [
    { text: 'مدى نظافة المبنى من الداخل والخارج وكذلك السطح', max: 5 },
    { text: 'مدى نظافة العيادات والصيدلية والمختبر', max: 5 },
    { text: 'مدى نظافة الممرات', max: 5 },
    { text: 'مدى نظافة الأثاث والمفروشات', max: 4 },
    { text: 'مدى نظافة دورات المياه', max: 5 },
    { text: 'مدى مكافحة الحشرات والتخلص من النفايات غير الطبية', max: 4 },
    { text: 'مدى صيانة سبكة الكهرباء واستبدال الأجزاء التالفة', max: 4 },
    { text: 'مدى كفائة الإنارة وتغيير التالف من اللمبات والبرايز والمفاتيح', max: 4 },
    { text: 'مدى المرور والصيانة لفريق الصيانة', max: 5 },
    { text: 'مدى صيانة الأجهزة الكهربائية ( تليفون - فيديو - مروحة )', max: 4 },
    { text: 'مدى صيانة المكيفات والثلاجات والبردات والسخانات', max: 5 },
    { text: 'مدى تنظيف خزانات المياه العلوية والسفلية كل ثلاث شهور', max: 5 },
    { text: 'مدى تسليك مواسير الصرف الصحي وكسح المجاري', max: 3 },
    { text: 'مدى إصلاح المغاسل والسيفونات والمحابس والحنفيات', max: 4 },
    { text: 'مدى إصلاح الطلمبات وشبكة المياه', max: 4 },
    { text: 'مدى أداء الصيانة العامة للمبنى ( نجارة - دهان - بلاط )', max: 4 },
    { text: 'مدى صيانة الأثاث ( مكتب - كرسي - دواليب - اسرة )', max: 4 },
    { text: 'مدى صيانة وتعبئة وسائل مكافحة الحريق وأجهزة كشف الدخان', max: 3 },
    { text: 'مدى صيانة الآت التصوير والالآت الكاتبة', max: 5 },
    { text: 'مدى توفير قطع الغيار ومستهلكات الصيانة', max: 5 },
    { text: 'مدى توفير أدوات النظافة ( مكانس - سطول -سلات - أكياس )', max: 4 },
    { text: 'مدى ارتداء العاملين للزي الرسمي وحمل بطاقات الهوية وتوفير الشهادات الصحية', max: 4 },
    { text: 'مدى إصلاح المصاعد', max: 5 }
];

// --- 2. DATA MANAGEMENT FUNCTIONS (TARGETED ISOLATION) ---

/**
 * ✅ [الحل النهائي] دالة ذكية تجلب البنود الصحيحة بناءً على المركز.
 * @param {string} centerKey - مفتاح المركز.
 * @returns {Array} - قائمة البنود الخاصة بالمركز أو القائمة العامة.
 */
function getPerformanceItems(centerKey) {
    // 1. تحديد المراكز التي لها قائمة بنود خاصة
    const isolatedCenters = ['center_2', 'center_8', 'center_72']; 
 // الأمير مشعل، دحضة الفريق الجوال

    // 2. تحديد المفتاح الذي سيتم استخدامه في الذاكرة
    let storageKey;
    if (isolatedCenters.includes(centerKey)) {
        // إذا كان المركز من المراكز الخاصة، استخدم مفتاحاً فريداً له
        storageKey = `performanceItems_isolated_${centerKey}_v1`;
    } else {
        // لجميع المراكز الأخرى، استخدم مفتاحاً عاماً وموحداً
        storageKey = `performanceItems_general_v1`;
    }

    // 3. جلب البيانات من الذاكرة
    const storedItems = localStorage.getItem(storageKey);
    if (storedItems) {
        try {
            const parsedItems = JSON.parse(storedItems);
            if (Array.isArray(parsedItems)) {
                return parsedItems;
            }
        } catch (e) {
            console.error(`خطأ في تحليل بيانات البنود للمفتاح ${storageKey}:`, e);
        }
    }
    
    // 4. في حالة عدم وجود بيانات، يتم إرجاع القائمة الافتراضية
    return JSON.parse(JSON.stringify(DEFAULT_PERFORMANCE_ITEMS));
}

/**
 * ✅ [الحل النهائي] دالة ذكية تحفظ البنود في المكان الصحيح.
 * @param {string} centerKey - مفتاح المركز.
 * @param {Array} items - قائمة البنود الجديدة للحفظ.
 */
function savePerformanceItems(centerKey, items) {
const isolatedCenters = ['center_2', 'center_8', 'center_72']; 
    let storageKey;
    if (isolatedCenters.includes(centerKey)) {
        storageKey = `performanceItems_isolated_${centerKey}_v1`;
    } else {
        storageKey = `performanceItems_general_v1`;
    }
    localStorage.setItem(storageKey, JSON.stringify(items));
}

function getPerformanceData() {
    return JSON.parse(localStorage.getItem('performanceData_v4')) || {};
}

function savePerformanceData(data) {
    localStorage.setItem('performanceData_v4', JSON.stringify(data));
}

// --- 3. UI RENDERING & CORE LOGIC ---

function renderPerformanceTable(centerKey) {
    const container = document.getElementById('performance-tab');
    const centerName = getCenterNames()[centerKey];
    const extractData = JSON.parse(localStorage.getItem('persistentExtractData') || '{}');
    const monthName = new Date(extractData.extractStart || new Date()).toLocaleString('ar-SA-u-nu-latn-ca-gregory', { month: 'long', year: 'numeric' });
    const formatDate = (dateString) => new Date(dateString).toLocaleDateString('en-CA');
    const extractStart = formatDate(extractData.extractStart);
    const extractEnd = formatDate(extractData.extractEnd);
    const centerTotalCost = calculateCenterTotalCost(centerKey);
    
    // ✅ [تم التحديث] جلب البنود باستخدام الدالة الذكية الجديدة
    const performanceItems = getPerformanceItems(centerKey);
    
    const centerPerformance = getPerformanceData()[centerKey] || {};
    let tableRows = '', maxTotal = 0;

    performanceItems.forEach((item, index) => {
        const score = centerPerformance[index] !== undefined ? item.max : item.max;
        tableRows += `<tr><td>${index + 1}</td><td class="item-text">${item.text}</td><td>${item.max}</td><td><input type="number" class="score-input" data-item-index="${index}" min="0" max="${item.max}" value="${score}" disabled></td></tr>`;
        maxTotal += (parseInt(item.max) || 0);
    });

    const certificateHTML = `
        <div class="certificate-container" id="performance-certificate-${centerKey}">
            <div class="performance-cost-display"><span>إجمالي المبلغ لأنشطة القسم (تكلفة العمالة):</span><span class="cost-value">${centerTotalCost.toFixed(2)} ريال</span></div>
            <div class="certificate-header"><h2>جدول تقييم مستوى الأداء والإنجاز</h2><h3>لمركز: ${centerName} - عن شهر ${monthName}</h3><p>الفترة من: ${extractStart}م إلى: ${extractEnd}م</p></div>
            <table class="performance-table"><thead><tr><th>م</th><th>أنشطة القسم</th><th>الدرجة القصوى</th><th>التقدير</th></tr></thead><tbody>${tableRows}<tr class="total-row"><td colspan="2">المجمــــــــــــــــوع</td><td id="perf-max-total-${centerKey}">${maxTotal}</td><td id="perf-score-total-${centerKey}">0</td></tr></tbody></table>
            <div class="certificate-summary" id="perf-summary-${centerKey}"></div>
            <div class="signatures-display-section" id="perf-signatures-${centerKey}"></div>
            <div class="tab-action-buttons">
                <button class="btn-action btn-edit-scores" onclick="togglePerformanceEditMode('${centerKey}', this)"><i class="fas fa-edit"></i> تعديل الدرجات</button>
                <button class="btn-action btn-save-scores" onclick="saveAllPerformanceScores('${centerKey}')" style="display:none;"><i class="fas fa-save"></i> حفظ التغييرات</button>
                <button class="btn-action btn-manage-items" onclick="openEditItemsDialog('${centerKey}')"><i class="fas fa-tasks"></i> إدارة البنود</button>
                <button class="btn-action btn-update" onclick="renderPerformanceTable('${centerKey}')"><i class="fas fa-sync-alt"></i> تحديث</button>
                <button class="btn-action btn-reset" onclick="resetPerformanceScores('${centerKey}')"><i class="fas fa-undo"></i> إعادة تعيين</button>
                <button class="btn-action btn-print" onclick="printPerformanceCertificate('${centerKey}')"><i class="fas fa-print"></i> طباعة</button>
                <button class="btn-action btn-export-pdf" onclick="exportPerformanceToPDF('${centerKey}')"><i class="fas fa-file-pdf"></i> تصدير PDF</button>
                <button class="btn-action btn-export-excel" onclick="exportPerformanceToExcel('${centerKey}')"><i class="fas fa-file-excel"></i> تصدير Excel</button>
                <button class="btn-action btn-signatures" onclick="openSignatureDialog('performance', '${centerKey}')"><i class="fas fa-signature"></i> التواقيع</button>
            </div>
        </div>`;
    container.innerHTML = certificateHTML;
    calculatePerformanceSummary(centerKey);
    if (typeof displaySignatures === 'function') displaySignatures('performance', centerKey);
}

function togglePerformanceEditMode(centerKey, button) {
    const inputs = document.querySelectorAll(`#performance-certificate-${centerKey} .score-input`);
    const saveButton = document.querySelector(`#performance-certificate-${centerKey} .btn-save-scores`);
    inputs.forEach(input => { input.disabled = !input.disabled; });
    if (!inputs[0].disabled) {
        button.innerHTML = '<i class="fas fa-times"></i> إلغاء';
        button.classList.add('cancel-mode');
        saveButton.style.display = 'inline-flex';
    } else {
        button.innerHTML = '<i class="fas fa-edit"></i> تعديل الدرجات';
        button.classList.remove('cancel-mode');
        saveButton.style.display = 'none';
        renderPerformanceTable(centerKey);
    }
}

function saveAllPerformanceScores(centerKey) {
    let allPerformanceData = getPerformanceData();
    if (!allPerformanceData[centerKey]) allPerformanceData[centerKey] = {};
    
    // ✅ [تم التحديث]
    const performanceItems = getPerformanceItems(centerKey);
    
    const inputs = document.querySelectorAll(`#performance-certificate-${centerKey} .score-input`);
    inputs.forEach(input => {
        const itemIndex = parseInt(input.dataset.itemIndex, 10);
        const max = performanceItems[itemIndex].max;
        let value = parseInt(input.value, 10);
        if (isNaN(value)) value = 0;
        if (value > max) { value = max; input.value = max; }
        allPerformanceData[centerKey][itemIndex] = value;
    });
    savePerformanceData(allPerformanceData);
    calculatePerformanceSummary(centerKey);
    if (typeof renderAchievementCertificate === 'function') renderAchievementCertificate(centerKey);
    const editButton = document.querySelector(`#performance-certificate-${centerKey} .btn-edit-scores`);
    togglePerformanceEditMode(centerKey, editButton);
    showSuccessMessage("تم حفظ الدرجات بنجاح!");
}

function calculatePerformanceSummary(centerKey) {
    const centerPerformance = getPerformanceData()[centerKey] || {};
    
    // ✅ [تم التحديث]
    const performanceItems = getPerformanceItems(centerKey);
    
    let totalScore = 0, maxTotal = 0;
    performanceItems.forEach((item, index) => {
        totalScore += centerPerformance[index] !== undefined ? centerPerformance[index] : (parseInt(item.max) || 0);
        maxTotal += (parseInt(item.max) || 0);
    });
    document.getElementById(`perf-max-total-${centerKey}`).textContent = maxTotal;
    document.getElementById(`perf-score-total-${centerKey}`).textContent = totalScore;
    const percentage = maxTotal > 0 ? (totalScore / maxTotal) * 100 : 100;
    let deductionPercentage = 0;
    if (percentage < 60) deductionPercentage = 15;
    else if (percentage < 65) deductionPercentage = 10;
    else if (percentage < 70) deductionPercentage = 8;
    else if (percentage < 75) deductionPercentage = 6;
    else if (percentage < 80) deductionPercentage = 4;
    else if (percentage < 85) deductionPercentage = 2;
    const centerCost = calculateCenterTotalCost(centerKey);
    const deductionAmount = (centerCost * deductionPercentage) / 100;
    document.getElementById(`perf-summary-${centerKey}`).innerHTML = `<p>إجمالي المبلغ لأنشطة القسم = <span>${centerCost.toFixed(2)}</span> ريال</p><p>التقدير الذي حصل عليه المقاول : <span>${percentage.toFixed(2)}%</span></p><p>نسبة الحسم على المقاول لهذا القسم : <span>${deductionPercentage}%</span> ويساوي <span>${deductionAmount.toFixed(2)}</span> ريال</p>`;
    let allDeductions = JSON.parse(localStorage.getItem('performanceDeductions') || '{}');
    allDeductions[centerKey] = deductionAmount;
    localStorage.setItem('performanceDeductions', JSON.stringify(allDeductions));
}

function calculateCenterTotalCost(centerKey) {
    const centerData = (typeof getAttendanceData === 'function' ? getAttendanceData()[centerKey] : []) || [];
    const contractData = JSON.parse(localStorage.getItem('persistentContractData') || '{}');
    const contractType = contractData.contractType || 'عقد أساسي';
    const directPurchaseRatio = parseFloat(contractData.directPurchaseRatio) || 0;
    return centerData.reduce((total, emp) => {
        const salary = parseFloat(emp.salary) || 0;
        let adjustedSalary = salary;
        if (contractType === 'شراء مباشر' && directPurchaseRatio > 0) {
            adjustedSalary = salary + (salary * directPurchaseRatio / 100);
        }
        return total + adjustedSalary;
    }, 0);
}

// --- 4. DYNAMIC ITEM MANAGEMENT ---

function openEditItemsDialog(centerKey) {
    // ✅ [تم التحديث]
    const performanceItems = getPerformanceItems(centerKey);
    
    let itemsHTML = '';
    performanceItems.forEach((item, index) => {
        itemsHTML += `
            <div class="dialog-item-row" id="edit-item-${index}">
                <div class="item-content">
                    <div class="form-group"><label>نص البند (بند ${index + 1}):</label><input type="text" class="edit-text-input" value="${item.text}"></div>
                    <div class="form-group max-score-group"><label>الدرجة:</label><input type="number" class="edit-max-input" value="${item.max}" min="1"></div>
                </div>
                <button class="btn-danger" onclick="this.parentElement.remove()" title="حذف هذا البند"><i class="fas fa-trash"></i></button>
            </div>`;
    });

    const content = `
        <div class="dialog-header">
            <h3><i class="fas fa-tasks"></i> إدارة بنود تقييم الأداء لمركز: ${getCenterNames()[centerKey]}</h3>
            <span class="close" onclick="closeDialog('management-dialog')">×</span>
        </div>
        <div class="dialog-body" id="edit-items-container">${itemsHTML}</div>
        <div class="dialog-footer">
            <button class="btn btn-primary" onclick="addNewPerformanceItemField()"><i class="fas fa-plus"></i> إضافة بند جديد</button>
            <div class="footer-actions">
                <button class="btn btn-success" onclick="saveEditedPerformanceItems('${centerKey}')"><i class="fas fa-save"></i> حفظ التغييرات</button>
                <button class="btn btn-secondary" onclick="closeDialog('management-dialog')">إغلاق</button>
            </div>
        </div>`;
        
    openDialog(content, 'management-dialog', true);
}

function saveEditedPerformanceItems(centerKey) {
    const newItems = [];
    const itemRows = document.querySelectorAll('#edit-items-container .dialog-item-row');
    itemRows.forEach(row => {
        const text = row.querySelector('.edit-text-input').value.trim();
        const max = parseInt(row.querySelector('.edit-max-input').value, 10);
        if (text && !isNaN(max) && max > 0) newItems.push({ text, max });
    });
    
    // ✅ [تم التحديث]
    savePerformanceItems(centerKey, newItems);
    
    closeDialog();
    renderPerformanceTable(centerKey);
    if (typeof renderAchievementCertificate === 'function') renderAchievementCertificate(centerKey);
    showSuccessMessage("تم حفظ التغييرات على البنود بنجاح!");
}

function addNewPerformanceItemField() {
    const container = document.getElementById('edit-items-container');
    const newItem = document.createElement('div');
    newItem.className = 'dialog-item-row';
    newItem.innerHTML = `<div class="item-content"><div class="form-group"><label>نص البند الجديد:</label><input type="text" class="edit-text-input" placeholder="اكتب نص البند هنا"></div><div class="form-group max-score-group"><label>الدرجة:</label><input type="number" class="edit-max-input" value="5" min="1"></div></div><button class="btn-danger" onclick="this.parentElement.remove()" title="حذف هذا البند"><i class="fas fa-trash"></i></button>`;
    container.appendChild(newItem);
}

// --- 5. EXPORT & PRINT FUNCTIONS ---

function printPerformanceCertificate(centerKey) {
    const extractData = JSON.parse(localStorage.getItem('persistentExtractData') || '{}');
    const centerName = getCenterNames()[centerKey];
    const monthName = new Date(extractData.extractStart || Date.now()).toLocaleString('ar-SA-u-nu-latn-ca-gregory', { month:'long', year:'numeric' });
    const win = window.open('', '_blank', 'width=1200,height=800');
    const doc = win.document;
    const signaturesContainer = document.getElementById(`perf-signatures-${centerKey}`);
    let signaturesHTML = '';
    if (signaturesContainer) {
        const signatureItems = signaturesContainer.querySelectorAll('.signature-item-display');
        signatureItems.forEach(item => {
            const title = item.querySelector('.title')?.textContent || 'غير محدد';
            const name = item.querySelector('.name')?.textContent || '..............................';
            signaturesHTML += `<div class="sign-box"><div>${title}</div><div class="name-placeholder">${name}</div><div class="line"></div></div>`;
        });
    }
    doc.write(`
    <!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>طباعة تقييم الأداء - ${centerName}</title>
    <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
    <style>@page{size:A4 portrait;margin:0.7cm}*{box-sizing:border-box;font-family:'Tajawal',Arial,sans-serif}body{margin:0;padding:0;background:#fff;color:#000;-webkit-print-color-adjust:exact}.header-table{width:100%;border-bottom:2px solid #0056b3;margin-bottom:10px}.header-table td{vertical-align:middle;text-align:center;padding:2px 4px}.logo{width:70px;height:auto}.title-box h1{font-size:16pt;margin:2px;color:#003087;font-weight:700}.title-box h2,.title-box h3{font-size:12pt;margin:2px}.cert-title{font-size:15pt;font-weight:700;text-align:center;margin:8px 0}.sub-title{font-size:12pt;text-align:center;margin:4px 0}.cost-bar{background:#f2f2f2;padding:6px;border-radius:4px;text-align:center;font-size:11pt;font-weight:700;margin:8px 0}table.performance-print{width:100%;border-collapse:collapse;font-size:9pt;table-layout:fixed}table.performance-print th,table.performance-print td{border:1px solid #333;padding:4px;text-align:center}table.performance-print th{background:#e9ecef}colgroup col:nth-child(1 ){width:5%}colgroup col:nth-child(2){width:65%}colgroup col:nth-child(3),colgroup col:nth-child(4){width:15%}.item-text{word-break:break-word;text-align:right;padding-right:5px}.summary{margin-top:10px;font-size:11pt;line-height:1.5}.summary span{font-weight:700}.signatures{margin-top:25px;display:flex;justify-content:space-around;border-top:1px solid #333;padding-top:10px}.sign-box{text-align:center;font-size:10pt;width:24%;font-weight:500}.sign-box .name-placeholder{min-height:18px;margin-top:5px;font-weight:normal}.sign-box .line{border-bottom:1px solid #000;margin-top:30px}</style>
    </head><body>
    <table class="header-table"><tr><td style="width:18%;"><img class="logo" src="${document.querySelector('.logo-left')?.src}" alt="Logo"></td><td class="title-box"><h1>${document.querySelector('.header-info h1')?.textContent}</h1><h2>${document.querySelector('.header-info h3')?.textContent}</h2></td><td style="width:18%;"><img class="logo" src="${document.querySelector('.logo-right')?.src}" alt="Logo"></td></tr></table>
    <div class="cert-title">جدول تقييم مستوى الأداء والإنجاز</div><div class="sub-title">لمركز: ${centerName} - عن شهر ${monthName}</div><div class="cost-bar">إجمالي المبلغ لأنشطة القسم (تكلفة العمالة): ${calculateCenterTotalCost(centerKey).toFixed(2)} ريال</div>
    <table class="performance-print"><colgroup><col><col><col><col></colgroup><thead><tr><th>م</th><th>أنشطة القسم</th><th>الدرجة القصوى</th><th>التقدير</th></tr></thead><tbody>
    ${(()=>{
        // ✅ [تم التحديث]
        const items = getPerformanceItems(centerKey);
        const scores = getPerformanceData()[centerKey] || {};
        let rows = '', maxT = 0, scoreT = 0;
        items.forEach((it, i) => {
            const s = scores[i] !== undefined ? scores[i] : it.max;
            rows += `<tr><td>${i + 1}</td><td class="item-text">${it.text}</td><td>${it.max}</td><td>${s}</td></tr>`;
            maxT += (parseInt(it.max) || 0); scoreT += s;
        });
        rows += `<tr style="font-weight:bold; background-color: #f0f0f0;"><td colspan="2">المجموع</td><td>${maxT}</td><td>${scoreT}</td></tr>`;
        return rows;
    })()}
    </tbody></table>
    <div class="summary">
    ${(()=>{
        // ✅ [تم التحديث]
        const items = getPerformanceItems(centerKey);
        const scores = getPerformanceData()[centerKey] || {};
        let maxT = 0, scoreT = 0;
        items.forEach((it, i) => { maxT += (parseInt(it.max) || 0); scoreT += (scores[i] !== undefined ? scores[i] : (parseInt(it.max) || 0)); });
        const perc = maxT ? (scoreT / maxT * 100) : 100;
        let ded = 0;
        if (perc < 60) ded = 15; else if (perc < 65) ded = 10; else if (perc < 70) ded = 8; else if (perc < 75) ded = 6; else if (perc < 80) ded = 4; else if (perc < 85) ded = 2;
        const cost = calculateCenterTotalCost(centerKey);
        const dedA = (cost * ded / 100);
        return `<p>التقدير الذي حصل عليه المقاول: <span>${perc.toFixed(2)}%</span>، نسبة الحسم: <span>${ded}%</span>، ويساوي: <span>${dedA.toFixed(2)} ريال</span></p>`;
    })()}
    </div>
    <div class="signatures">${signaturesHTML}</div>
    </body></html>`);
    doc.close();
    win.onload = function() { win.focus(); win.print(); win.close(); };
}
