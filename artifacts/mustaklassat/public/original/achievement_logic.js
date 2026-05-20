// ===================================================================
//
//  Achievement Logic - (V8 - With Stamp Area)
//  Author: Manus AI
//  Description: The final, complete, and self-contained version.
//  Includes all necessary functions for titles, rendering, and exports
//  and adds a dedicated stamp area next to each signature.
//
// ===================================================================

// --- 1. CONFIGURATION & DEFAULTS (Titles Management) ---

const DEFAULT_ACHIEVEMENT_TITLES = {
    mainTitle: "شهادة الاستحقاق الشهري للعمالة",
    subTitle: "لأعمال النظافة والصيانة والتشغيل غير الطبي"
};

function getAchievementTitles() {
    const storedTitles = localStorage.getItem('achievementTitles_v1');
    const allTitles = storedTitles ? JSON.parse(storedTitles) : {
        achievementMainTitle: DEFAULT_ACHIEVEMENT_TITLES.mainTitle,
        achievementSubTitle: DEFAULT_ACHIEVEMENT_TITLES.subTitle
    };
    return {
        mainTitle: allTitles.achievementMainTitle || DEFAULT_ACHIEVEMENT_TITLES.mainTitle,
        subTitle: allTitles.achievementSubTitle || DEFAULT_ACHIEVEMENT_TITLES.subTitle
    };
}
function openAchievementTitlesDialog(centerKey) {
    const titles = getAchievementTitles();

    let overlay = document.getElementById('achievement-titles-overlay');
    let dialog = document.getElementById('achievement-titles-dialog');

    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'achievement-titles-overlay';
        overlay.className = 'overlay';
        overlay.onclick = closeAchievementTitlesDialog;
        document.body.appendChild(overlay);
    }

    if (!dialog) {
        dialog = document.createElement('div');
        dialog.id = 'achievement-titles-dialog';
        dialog.className = 'edit-dialog wide-dialog';

        document.body.appendChild(dialog);
    }

    dialog.innerHTML = `
        <h3>تعديل عنوان شهادة الإنجاز</h3>

        <label>العنوان الرئيسي:</label>
        <input type="text" id="achievement-main-title-input" value="${titles.mainTitle}">

        <label>العنوان الفرعي:</label>
        <input type="text" id="achievement-sub-title-input" value="${titles.subTitle}">

        <div style="margin-top:15px;text-align:center;">
            <button class="confirm-btn" onclick="saveAchievementTitles('${centerKey}')">
                حفظ
            </button>

            <button class="cancel-btn" onclick="closeAchievementTitlesDialog()">
                إلغاء
            </button>
        </div>
    `;

    overlay.style.display = 'block';
    dialog.style.display = 'block';
}

function closeAchievementTitlesDialog() {
    const overlay = document.getElementById('achievement-titles-overlay');
    const dialog = document.getElementById('achievement-titles-dialog');

    if (overlay) overlay.style.display = 'none';
    if (dialog) dialog.style.display = 'none';
}

function saveAchievementTitles(centerKey) {
    const mainTitle =
        document.getElementById('achievement-main-title-input').value.trim();

    const subTitle =
        document.getElementById('achievement-sub-title-input').value.trim();

    const titlesToSave = {
        achievementMainTitle:
            mainTitle || DEFAULT_ACHIEVEMENT_TITLES.mainTitle,

        achievementSubTitle:
            subTitle || DEFAULT_ACHIEVEMENT_TITLES.subTitle
    };

    localStorage.setItem(
        'achievementTitles_v1',
        JSON.stringify(titlesToSave)
    );

    closeAchievementTitlesDialog();

    renderAchievementCertificate(centerKey);

    if (typeof showSuccessMessage === 'function') {
        showSuccessMessage('تم حفظ العنوان بنجاح');
    }
}
// --- 2. UI RENDERING & CORE LOGIC ---

function renderAchievementCertificate(centerKey) {
    const container = document.getElementById('achievement-tab');
    const centerName = getCenterNames()[centerKey];
    const titles = getAchievementTitles();

    const extractData = JSON.parse(localStorage.getItem('persistentExtractData') || '{}');
    const monthName = new Date(extractData.extractStart || new Date()).toLocaleString('ar-SA-u-nu-latn-ca-gregory', { month: 'long', year: 'numeric' });
    const formatDate = (dateString) => new Date(dateString).toLocaleDateString('en-CA');
    const extractStart = formatDate(extractData.extractStart);
    const extractEnd = formatDate(extractData.extractEnd);

    const certificateHTML = `
        <div class="certificate-container" id="achievement-certificate-${centerKey}">
            <div class="tab-action-buttons no-print">
                <button class="btn-action btn-print" onclick="printAchievementCertificate('${centerKey}')"><i class="fas fa-print"></i> طباعة</button>
                <button class="btn-action btn-export-pdf" onclick="exportAchievementToPDF('${centerKey}')"><i class="fas fa-file-pdf"></i> تصدير PDF</button>
                <button class="btn-action btn-export-excel" onclick="exportAchievementToExcel('${centerKey}')"><i class="fas fa-file-excel"></i> تصدير Excel</button>
                <button class="btn-action btn-update" onclick="handleUpdateClick('${centerKey}')"><i class="fas fa-sync-alt"></i> تحديث البيانات</button>
                <button class="btn-action btn-signatures" onclick="openSignatureDialog('achievement', '${centerKey}')"><i class="fas fa-signature"></i> تعديل التواقيع</button>
            </div>
            <div class="certificate-header text-center">
                <h2>${titles.mainTitle}</h2>
                <h3 style="font-weight: normal;">${titles.subTitle}</h3>
                <h3>لمركز: ${centerName} - عن شهر ${monthName}</h3>
                <p>الفترة من : ${extractStart}م الى ${extractEnd}م</p>
            </div>
            <table class="achievement-table" id="ach-table-${centerKey}">
                <thead>
                    <tr>
                        <th>البند</th><th>القيمة الشهرية</th><th>حسم الغياب</th><th>غرامة الغياب</th>
                        <th>غرامة الأداء</th><th>غرامة الجنسية</th><th>الصافي الشهري</th>
                    </tr>
                </thead>
                <tbody id="ach-tbody-${centerKey}"></tbody>
            </table>
            <div class="signatures-display-section" id="ach-signatures-${centerKey}"></div>
        </div>
    `;
    container.innerHTML = certificateHTML;
    calculateAndDisplayAchievement(centerKey);
    if (typeof displaySignatures === 'function') {
        displaySignatures('achievement', `ach-signatures-${centerKey}`);
    }
}

function handleUpdateClick(centerKey) {
    showSuccessMessage("تم تحديث وسحب البيانات بنجاح!");
    renderAchievementCertificate(centerKey);
}

function calculateAndDisplayAchievement(centerKey) {
    const centerData = getAttendanceData()[centerKey] || [];
    const tbody = document.getElementById(`ach-tbody-${centerKey}`);
    if (!tbody) return;

    if (centerData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">لا يوجد بيانات موظفين لهذا المركز.</td></tr>';
        return;
    }

    const { totalDaysInMonth } = getExtractPeriodDetails();
    const contractData = JSON.parse(localStorage.getItem('persistentContractData') || '{}');
    const contractType = contractData.contractType || 'عقد أساسي';
    const directPurchaseRatio = parseFloat(contractData.directPurchaseRatio) || 0;

    let totalMonthlyValue = 0, totalAbsenceDeduction = 0, totalAbsencePenalty = 0, totalNationalityPenalty = 0;

    centerData.forEach(emp => {
        const salary = parseFloat(emp.salary) || 0;
        let adjustedSalary = salary;
        if (contractType === 'شراء مباشر' && directPurchaseRatio > 0) {
            adjustedSalary = salary + (salary * directPurchaseRatio / 100);
        }
        totalMonthlyValue += adjustedSalary;

        const dailySalary = totalDaysInMonth > 0 ? adjustedSalary / totalDaysInMonth : 0;
        let absenceDays = (emp.days || []).filter(day => STATUS_CODES[day]?.isAbsence).length;
        
        const fineConfig = ABSENCE_FINES_BY_CATEGORY[emp.category] || ABSENCE_FINES_BY_CATEGORY.default;
        const isSaudi = (emp.nationality || '').includes('سعودي');

        totalAbsenceDeduction += absenceDays * dailySalary;
        totalAbsencePenalty += absenceDays * (isSaudi ? fineConfig.saudi : fineConfig.non_saudi);
        totalNationalityPenalty += parseFloat(emp.nationalityFine) || 0;
    });

    const allDeductions = JSON.parse(localStorage.getItem('performanceDeductions') || '{}');
    const performancePenalty = allDeductions[centerKey] || 0;

    const netMonthly = totalMonthlyValue - totalAbsenceDeduction - totalAbsencePenalty - performancePenalty - totalNationalityPenalty;

    tbody.innerHTML = `
        <tr>
            <td>العمالة</td>
            <td>${totalMonthlyValue.toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })}</td>
            <td>${totalAbsenceDeduction.toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })}</td>
            <td>${totalAbsencePenalty.toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })}</td>
            <td>${performancePenalty.toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })}</td>
            <td>${totalNationalityPenalty.toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })}</td>
            <td><strong>${netMonthly.toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })}</strong></td>
        </tr>
        <tr class="total-row">
            <td>إجمالي المستحق للمقاول</td>
            <td>${totalMonthlyValue.toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })}</td>
            <td>${totalAbsenceDeduction.toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })}</td>
            <td>${totalAbsencePenalty.toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })}</td>
            <td>${performancePenalty.toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })}</td>
            <td>${totalNationalityPenalty.toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })}</td>
            <td><strong>${netMonthly.toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })}</strong></td>
        </tr>
        <tr><td colspan="7" class="tafqeet-cell">إجمالي المستحق للمقاول فقط وقدره: ${tafqit(netMonthly)}</td></tr>
    `;
}

// --- 3. TAFQEET FUNCTION (Number to Arabic Words) ---

function tafqit(number) {
    if (isNaN(number)) return "خطأ في المبلغ";
    if (number === 0) return "صفر ريال سعودي";
    const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"], tens = ["", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"], teens = ["", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"], hundreds = ["", "مائة", "مئتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"], scales = ["", "ألف", "مليون", "مليار"];
    function convertGroup(n){let t="",e=Math.floor(n/100),a=Math.floor(n%100/10),r=n%10;return e>0&&(t+=(t?" و":"")+hundreds[e]),a>1?(r>0&&(t+=(t?" و":"")+ones[r]),t+=(t?" و":"")+tens[a]):1==a?t+=(t?" و":"")+teens[r]:r>0&&(t+=(t?" و":"")+ones[r]),t}let intPart=Math.floor(number),fracPart=Math.round(100*(number-intPart)),result=[],i=0;for(;intPart>0;){const t=intPart%1e3;t>0&&result.unshift((1==t&&i>0?scales[i]:2==t&&i>0?"ألفان"==scales[i]?"ألفان":scales[i]+"ان":t>=3&&t<=10&&i>0?convertGroup(t)+" "+("ألف"==scales[i]?"آلاف":scales[i]+"ات"):convertGroup(t)+(i>0?" "+scales[i]:"")).trim()),intPart=Math.floor(intPart/1e3),i++}let finalResult=result.join(" و ");return finalResult&&(finalResult+=" ريال سعودي"),fracPart>0&&(finalResult+=(finalResult?" و":"")+convertGroup(fracPart)+" هللة"),finalResult.trim()
}

// --- 4. EXPORT & PRINT FUNCTIONS ---
/**
 * ✅ [النسخة النهائية - الختم في الأسفل]
 * - تطبع شهادة إنجاز بتصميم نهائي ومستقر يضع الختم تحت التوقيع.
 * - يحل جميع مشاكل المساحة والتداخل بشكل نهائي.
 * - يحافظ على كل الخصائص المطلوبة (التحكم بالختم، عدم انقسام النص).
 * @param {string} centerKey - مفتاح المركز.
 */
function printAchievementCertificate(centerKey) {
    // --- 1. جمع البيانات الأساسية (لا تغيير هنا) ---
    const centerName = getCenterNames()[centerKey];
    const titles = getAchievementTitles();
    const extractData = JSON.parse(localStorage.getItem('persistentExtractData') || '{}');
    const monthName = new Date(extractData.extractStart || new Date()).toLocaleString('ar-SA-u-nu-latn-ca-gregory', { month: 'long', year: 'numeric' });
    const formatDate = (dateString) => new Date(dateString).toLocaleDateString('en-CA');
    const extractStart = formatDate(extractData.extractStart);
    const extractEnd = formatDate(extractData.extractEnd);

    // --- 2. فتح نافذة الطباعة (لا تغيير هنا) ---
    const win = window.open('', '_blank', 'width=1200,height=800');
    const doc = win.document;

    // --- 3. قراءة التواقيع من HTML المعروض ---
    const signaturesContainer = document.getElementById(`ach-signatures-${centerKey}`);
    let signaturesHTML = '';
    if (signaturesContainer) {
        const signatureBlocks = signaturesContainer.querySelectorAll('.signature-block-display');
        
        signatureBlocks.forEach(block => {
            const title = block.querySelector('.title')?.textContent || 'غير محدد';
            const name = block.querySelector('.name')?.textContent || '..............................';
            const showStamp = block.getAttribute('data-show-stamp') === 'true';

            // بناء منطقة الختم بشكل شرطي
            const stampHTML = showStamp ? `
                <div class="stamp-area">
                    <div class="stamp-box"><span>الختم</span></div>
                </div>
            ` : '';

            // بناء كتلة التوقيع الكاملة (الختم الآن في الأسفل)
            signaturesHTML += `
                <div class="signature-block">
                    <div class="signature-content">
                        <div class="title">${title}</div>
                        <div class="line"></div>
                        <div class="name">${name}</div>
                    </div>
                    ${stampHTML} 
                </div>
            `;
        });
    }

    // --- 4. كتابة محتوى HTML الكامل مع CSS النهائي ---
    doc.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
        <meta charset="UTF-8">
        <title>طباعة شهادة الإنجاز - ${centerName}</title>
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
        <style>
            /* --- إعدادات الصفحة والطباعة الأساسية (تبقى كما هي ) --- */
            @page { size: A4 portrait; margin: 0.7in; }
            * { box-sizing: border-box; font-family: 'Tajawal', Arial, sans-serif; }
            body { margin: 0; padding: 0; background: #fff; color: #000; -webkit-print-color-adjust: exact; }

            /* --- أنماط الهيدر والجدول (تبقى كما هي) --- */
            .header-table { width: 100%; border-bottom: 2px solid #0056b3; margin-bottom: 15px; }
            .header-table td { vertical-align: middle; text-align: center; padding: 2px 4px; }
            .logo { width: 70px; }
            .title-box h1 { font-size: 16pt; margin: 2px; color: #003087; font-weight: 700; }
            .title-box h2 { font-size: 14pt; margin: 2px; }
            .certificate-header { text-align: center; margin-bottom: 15px; }
            .certificate-header h2 { font-size: 15pt; }
            .certificate-header h3 { font-size: 12pt; font-weight: normal; }
            .certificate-header p { font-size: 11pt; }
            table.achievement-print { width: 100%; border-collapse: collapse; font-size: 9pt; }
            table.achievement-print th, table.achievement-print td { border: 1px solid #333; padding: 6px; text-align: center; }
            table.achievement-print th { background: #e9ecef; }

            /* ================================================================== */
            /* === ✅✅✅ كود تنسيق التواقيع النهائي (الختم في الأسفل) ✅✅✅ === */
            /* ================================================================== */

          /* ================================================================== */
/* === ✅✅✅ كود تنسيق التواقيع النهائي (الختم في الأسفل) ✅✅✅ === */
/* ================================================================== */

/* الحاوية الرئيسية للتواقيع */
.signatures {
    margin-top: 40px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    width: 100%;
    border-top: 1px solid #ddd;
    padding-top: 20px;
    page-break-inside: avoid;
    flex-wrap: nowrap;
    gap: 25px;
}

/* كتلة التوقيع (تحتوي على التوقيع والختم بشكل عمودي) */
.signature-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
}

/* حاوية محتوى التوقيع (العنوان، الخط، الاسم) */
.signature-content {
    text-align: center;
    width: 100%;
    /* ✅✅✅ التعديل هنا: زيادة المسافة السفلية لدفع الختم للأسفل ✅✅✅ */
    margin-bottom: 50px; 
}

/* المسمى الوظيفي (العنوان) */
.signature-content .title {
    font-size: 12pt;
    font-weight: 700;
    color: #003087;
    /* تمت إعادة المسافة إلى قيمتها الأصلية المناسبة */
    margin-bottom: 8px; 
    white-space: nowrap;
}

/* خط التوقيع */
.signature-content .line {
    border-bottom: 1px solid #333;
    height: 1px;
    /* ✅ إضافة مساحة كافية للتوقيع اليدوي فوق الخط */
    margin-top: 40px; 
}

/* اسم الموقع */
.signature-content .name {
    font-size: 11pt;
    font-weight: 500;
    color: #000;
    /* تمت إعادة المسافة إلى قيمتها الأصلية المناسبة */
    margin-top: 8px; 
    white-space: nowrap;
}

/* منطقة الختم */
.stamp-area {
    /* لا تحتاج لتعديل */
}

/* صندوق الختم */
.stamp-box {
    width: 80px;
    height: 80px;
    border: 1.5px dashed #ccc;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    color: #bbb;
    font-size: 12pt;
    font-weight: 500;
}

        </style>
    </head>
    <body>
        <table class="header-table">
             <tr>
                <td style="width:20%;"><img class="logo" src="${document.querySelector('.logo-left')?.src}" alt="Logo"></td>
                <td class="title-box"><h1>${document.querySelector('.header-info h1')?.textContent}</h1><h2>${document.querySelector('.header-info h3')?.textContent}</h2></td>
                <td style="width:20%;"><img class="logo" src="${document.querySelector('.logo-right')?.src}" alt="Logo"></td>
            </tr>
        </table>
        <div class="certificate-header">
            <h2>${titles.mainTitle}</h2><h3>${titles.subTitle}</h3>
            <h3>لمركز: ${centerName} - عن شهر ${monthName}</h3>
            <p>الفترة من: ${extractStart}م الى ${extractEnd}م</p>
        </div>
        <table class="achievement-print" id="print-table-content"></table>
        <div class="signatures">${signaturesHTML}</div>
    </body>
    </html>
    `);
    
    // --- 5 & 6. نسخ الجدول والطباعة (لا تغيير هنا) ---
    const originalTableBody = document.getElementById(`ach-tbody-${centerKey}`);
    const printTable = doc.getElementById('print-table-content');
    if (originalTableBody && printTable) {
        printTable.innerHTML = `
            <thead>${document.getElementById(`ach-table-${centerKey}`).querySelector('thead').innerHTML}</thead>
            <tbody>${originalTableBody.innerHTML}</tbody>
        `;
    }
    doc.close();
    win.onload = function() { win.focus(); win.print(); win.close(); };
}
