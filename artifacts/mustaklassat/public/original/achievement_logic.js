// ===================================================================
// Achievement Logic - Admin Offices / Facilities
// - شهادة الإنجاز تعرض "لموقع" بدل "لمركز"
// - تحافظ على حساب الحسم والغرامات وغرامة الأداء
// - الحساب موحد مع منطق الحضور والانصراف للمكاتب الإدارية
// ===================================================================

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
            <button class="confirm-btn" onclick="saveAchievementTitles('${centerKey}')">حفظ</button>
            <button class="cancel-btn" onclick="closeAchievementTitlesDialog()">إلغاء</button>
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
    const mainTitle = document.getElementById('achievement-main-title-input').value.trim();
    const subTitle = document.getElementById('achievement-sub-title-input').value.trim();
    localStorage.setItem('achievementTitles_v1', JSON.stringify({
        achievementMainTitle: mainTitle || DEFAULT_ACHIEVEMENT_TITLES.mainTitle,
        achievementSubTitle: subTitle || DEFAULT_ACHIEVEMENT_TITLES.subTitle
    }));
    closeAchievementTitlesDialog();
    renderAchievementCertificate(centerKey);
    if (typeof showSuccessMessage === 'function') showSuccessMessage('تم حفظ العنوان بنجاح');
}

function getAchievementPeriod() {
    const extractData = JSON.parse(localStorage.getItem('persistentExtractData') || '{}');
    const formatDate = (dateString) => {
        if (!dateString) return 'غير محدد';
        try { return new Date(dateString).toLocaleDateString('en-CA'); } catch (_) { return 'غير محدد'; }
    };
    const monthName = new Date(extractData.extractStart || new Date()).toLocaleString('ar-SA-u-nu-latn-ca-gregory', { month: 'long', year: 'numeric' });
    return { monthName, extractStart: formatDate(extractData.extractStart), extractEnd: formatDate(extractData.extractEnd) };
}

function renderAchievementCertificate(centerKey) {
    const container = document.getElementById('achievement-tab');
    if (!container) return;
    const centerName = getCenterNames()[centerKey] || 'الموقع';
    const titles = getAchievementTitles();
    const period = getAchievementPeriod();

    const certificateHTML = `
        <div class="certificate-container" id="achievement-certificate-${centerKey}">
            <div class="tab-action-buttons no-print">
                <button class="btn-action btn-print" onclick="printAchievementCertificate('${centerKey}')"><i class="fas fa-print"></i> طباعة</button>
                <button class="btn-action btn-export-pdf" onclick="exportAchievementToPDF('${centerKey}')"><i class="fas fa-file-pdf"></i> تصدير PDF</button>
                <button class="btn-action btn-export-excel" onclick="exportAchievementToExcel('${centerKey}')"><i class="fas fa-file-excel"></i> تصدير Excel</button>
                <button class="btn-action btn-update" onclick="handleUpdateClick('${centerKey}')"><i class="fas fa-sync-alt"></i> تحديث البيانات</button>
                <button class="btn-action btn-signatures" onclick="openSignatureDialog('achievement', '${centerKey}')"><i class="fas fa-signature"></i> تعديل التواقيع</button>
                <button class="btn-action btn-titles" onclick="openAchievementTitlesDialog('${centerKey}')"><i class="fas fa-edit"></i> تعديل العنوان</button>
            </div>
            <div class="certificate-header text-center">
                <h2>${titles.mainTitle}</h2>
                <h3 style="font-weight: normal;">${titles.subTitle}</h3>
                <h3>لموقع: ${centerName} - عن شهر ${period.monthName}</h3>
                <p>الفترة من : ${period.extractStart}م الى ${period.extractEnd}م</p>
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
    if (typeof displaySignatures === 'function') displaySignatures('achievement', centerKey);
}

function handleUpdateClick(centerKey) {
    if (typeof showSuccessMessage === 'function') showSuccessMessage("تم تحديث وسحب البيانات بنجاح!");
    renderAchievementCertificate(centerKey);
}

function getAchievementPerformanceDeductions() {
    const legacy = JSON.parse(localStorage.getItem('performanceDeductions') || '{}');
    const separated = JSON.parse(localStorage.getItem('adminOfficePerformanceDeductions_v1') || '{}');
    return Object.assign({}, legacy, separated);
}

function fallbackAchievementEmployeeFinancials(emp, options = {}) {
    const totalDaysInMonth = Number(options.totalDaysInMonth) || 30;
    const daysInExtract = Number(options.daysInExtract) || 30;
    const contractType = options.contractType || 'عقد أساسي';
    const directPurchaseRatio = Number(options.directPurchaseRatio) || 0;

    const salary = parseFloat(emp.salary) || 0;
    const dailyRate = totalDaysInMonth > 0 ? salary / totalDaysInMonth : 0;
    let costForPeriod = dailyRate * daysInExtract;
    if (contractType === 'شراء مباشر' && directPurchaseRatio > 0) {
        costForPeriod += costForPeriod * (directPurchaseRatio / 100);
    }

    const days = Array.isArray(emp.days) ? emp.days.slice(0, daysInExtract) : [];
    while (days.length < daysInExtract) days.push('ح');

    let absenceDays = 0;
    let deductionOnlyDays = 0;

    days.forEach(day => {
        const meta = (typeof STATUS_CODES !== 'undefined' && STATUS_CODES[day]) ? STATUS_CODES[day] : {};
        if (day === 'غ•' || meta.noDeduction || meta.noFine) return;
        if (day === 'ح' || day === 'ت') return;
        if (day === 'غ' || meta.isAbsence) absenceDays++;
        else deductionOnlyDays++;
    });

    const deduction = (absenceDays + deductionOnlyDays) * dailyRate;
    const fineConfig = typeof getAdminOfficeFineConfig === 'function'
        ? getAdminOfficeFineConfig(emp.category || 1)
        : ((typeof ABSENCE_FINES_BY_CATEGORY !== 'undefined' && (ABSENCE_FINES_BY_CATEGORY[emp.category] || ABSENCE_FINES_BY_CATEGORY[String(emp.category)] || ABSENCE_FINES_BY_CATEGORY.default)) || { saudi: 0, non_saudi: 0 });
    const isSaudi = typeof isAdminOfficeSaudi === 'function'
        ? isAdminOfficeSaudi(emp.nationality)
        : String(emp.nationality || '').replace(/\s+/g, '').includes('سعودي');
    const absenceFine = absenceDays * (isSaudi ? fineConfig.saudi : fineConfig.non_saudi);
    const nationalityFine = parseFloat(emp.nationalityFine) || 0;
    const totalFine = absenceFine + nationalityFine;
    const netSalary = costForPeriod - deduction - totalFine;

    return { costForPeriod, deduction, absenceFine, nationalityFine, totalFine, netSalary };
}

function calculateAchievementValues(centerKey) {
    const centerData = getAttendanceData()[centerKey] || [];
    const period = getExtractPeriodDetails();
    const totalDaysInMonth = Number(period.totalDaysInMonth || period.daysInMonth) || 30;
    const daysInExtract = Number(period.daysInExtract || period.daysInMonth) || 30;
    const contractData = JSON.parse(localStorage.getItem('persistentContractData') || '{}');
    const contractType = contractData.contractType || 'عقد أساسي';
    const directPurchaseRatio = parseFloat(contractData.directPurchaseRatio) || 0;

    let totalMonthlyValue = 0;
    let totalAbsenceDeduction = 0;
    let totalAbsencePenalty = 0;
    let totalNationalityPenalty = 0;
    let laborNetTotal = 0;

    centerData.forEach(emp => {
        const calc = typeof calculateAdminOfficeEmployeeFinancials === 'function'
            ? calculateAdminOfficeEmployeeFinancials(emp, { totalDaysInMonth, daysInExtract, contractType, directPurchaseRatio })
            : fallbackAchievementEmployeeFinancials(emp, { totalDaysInMonth, daysInExtract, contractType, directPurchaseRatio });

        totalMonthlyValue += Number(calc.costForPeriod) || 0;
        totalAbsenceDeduction += Number(calc.deduction) || 0;
        totalAbsencePenalty += Number(calc.absenceFine) || 0;
        totalNationalityPenalty += Number(calc.nationalityFine) || 0;
        laborNetTotal += Number(calc.netSalary) || 0;
    });

    const allDeductions = getAchievementPerformanceDeductions();
    const performancePenalty = parseFloat(allDeductions[centerKey]) || 0;
    const netMonthly = laborNetTotal - performancePenalty;

    return { centerData, totalMonthlyValue, totalAbsenceDeduction, totalAbsencePenalty, performancePenalty, totalNationalityPenalty, netMonthly };
}

function formatMoney(value) {
    return (Number(value) || 0).toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' });
}

function calculateAndDisplayAchievement(centerKey) {
    const tbody = document.getElementById(`ach-tbody-${centerKey}`);
    if (!tbody) return;
    const v = calculateAchievementValues(centerKey);
    if (v.centerData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">لا يوجد بيانات موظفين لهذا الموقع.</td></tr>';
        return;
    }
    tbody.innerHTML = `
        <tr>
            <td>العمالة</td>
            <td>${formatMoney(v.totalMonthlyValue)}</td>
            <td>${formatMoney(v.totalAbsenceDeduction)}</td>
            <td>${formatMoney(v.totalAbsencePenalty)}</td>
            <td>${formatMoney(v.performancePenalty)}</td>
            <td>${formatMoney(v.totalNationalityPenalty)}</td>
            <td><strong>${formatMoney(v.netMonthly)}</strong></td>
        </tr>
        <tr class="total-row">
            <td>إجمالي المستحق للمقاول</td>
            <td>${formatMoney(v.totalMonthlyValue)}</td>
            <td>${formatMoney(v.totalAbsenceDeduction)}</td>
            <td>${formatMoney(v.totalAbsencePenalty)}</td>
            <td>${formatMoney(v.performancePenalty)}</td>
            <td>${formatMoney(v.totalNationalityPenalty)}</td>
            <td><strong>${formatMoney(v.netMonthly)}</strong></td>
        </tr>
        <tr><td colspan="7" class="tafqeet-cell">إجمالي المستحق للمقاول فقط وقدره: ${tafqit(v.netMonthly)}</td></tr>
    `;
}

function tafqit(number) {
    if (isNaN(number)) return "خطأ في المبلغ";
    if (number === 0) return "صفر ريال سعودي";
    const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"], tens = ["", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"], teens = ["", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"], hundreds = ["", "مائة", "مئتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"], scales = ["", "ألف", "مليون", "مليار"];
    function convertGroup(n){let t="",e=Math.floor(n/100),a=Math.floor(n%100/10),r=n%10;return e>0&&(t+=(t?" و":"")+hundreds[e]),a>1?(r>0&&(t+=(t?" و":"")+ones[r]),t+=(t?" و":"")+tens[a]):1==a?t+=(t?" و":"")+teens[r]:r>0&&(t+=(t?" و":"")+ones[r]),t}
    let intPart=Math.floor(number),fracPart=Math.round(100*(number-intPart)),result=[],i=0;
    for(;intPart>0;){const t=intPart%1000;t>0&&result.unshift((t==1&&i>0?scales[i]:t==2&&i>0?(scales[i]=="ألف"?"ألفان":scales[i]+"ان"):t>=3&&t<=10&&i>0?convertGroup(t)+" "+(scales[i]=="ألف"?"آلاف":scales[i]+"ات"):convertGroup(t)+(i>0?" "+scales[i]:"")).trim());intPart=Math.floor(intPart/1000);i++}
    let finalResult=result.join(" و ");
    if (finalResult) finalResult += " ريال سعودي";
    if (fracPart>0) finalResult += (finalResult?" و":"")+convertGroup(fracPart)+" هللة";
    return finalResult.trim();
}

function buildAchievementSignaturesHTML(centerKey) {
    const signaturesContainer = document.getElementById(`ach-signatures-${centerKey}`);
    let signaturesHTML = '';
    if (signaturesContainer) {
        const blocks = signaturesContainer.querySelectorAll('.signature-block-display, .signature-item-display, .sb-item');
        blocks.forEach(block => {
            const title = block.querySelector('.title, .sb-item-title')?.textContent || 'غير محدد';
            const name = block.querySelector('.name, .sb-item-name')?.textContent || '..............................';
            signaturesHTML += `<div class="signature-block"><div class="signature-content"><div class="title">${title}</div><div class="line"></div><div class="name">${name}</div></div></div>`;
        });
    }
    return signaturesHTML;
}

function printAchievementCertificate(centerKey) {
    const centerName = getCenterNames()[centerKey] || 'الموقع';
    const titles = getAchievementTitles();
    const period = getAchievementPeriod();
    const win = window.open('', '_blank', 'width=1200,height=800');
    const doc = win.document;
    const signaturesHTML = buildAchievementSignaturesHTML(centerKey);

    doc.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>طباعة شهادة الإنجاز - ${centerName}</title><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet"><style>@page{size:A4 portrait;margin:.7in}*{box-sizing:border-box;font-family:'Tajawal',Arial,sans-serif}body{margin:0;background:#fff;color:#000;-webkit-print-color-adjust:exact}.header-table{width:100%;border-bottom:2px solid #0056b3;margin-bottom:15px}.header-table td{text-align:center;padding:2px 4px}.logo{width:70px}.title-box h1{font-size:16pt;margin:2px;color:#003087}.title-box h2{font-size:14pt;margin:2px}.certificate-header{text-align:center;margin-bottom:15px}.certificate-header h2{font-size:15pt}.certificate-header h3{font-size:12pt;font-weight:normal}.certificate-header p{font-size:11pt}table.achievement-print{width:100%;border-collapse:collapse;font-size:9pt}table.achievement-print th,table.achievement-print td{border:1px solid #333;padding:6px;text-align:center}table.achievement-print th{background:#e9ecef}.signatures{margin-top:40px;display:flex;justify-content:space-between;gap:25px;border-top:1px solid #ddd;padding-top:20px}.signature-block{flex:1;text-align:center}.signature-content .title{font-size:12pt;font-weight:700;color:#003087}.signature-content .line{border-bottom:1px solid #333;height:1px;margin-top:40px}.signature-content .name{font-size:11pt;margin-top:8px}</style></head><body><table class="header-table"><tr><td style="width:20%"><img class="logo" src="${document.querySelector('.logo-left')?.src}" alt="Logo"></td><td class="title-box"><h1>${document.querySelector('.header-info h1')?.textContent}</h1><h2>${document.querySelector('.header-info h3')?.textContent}</h2></td><td style="width:20%"><img class="logo" src="${document.querySelector('.logo-right')?.src}" alt="Logo"></td></tr></table><div class="certificate-header"><h2>${titles.mainTitle}</h2><h3>${titles.subTitle}</h3><h3>لموقع: ${centerName} - عن شهر ${period.monthName}</h3><p>الفترة من: ${period.extractStart}م الى ${period.extractEnd}م</p></div><table class="achievement-print" id="print-table-content"></table><div class="signatures">${signaturesHTML}</div></body></html>`);

    const originalTableBody = document.getElementById(`ach-tbody-${centerKey}`);
    const printTable = doc.getElementById('print-table-content');
    const sourceTable = document.getElementById(`ach-table-${centerKey}`);
    if (originalTableBody && printTable && sourceTable) {
        printTable.innerHTML = `<thead>${sourceTable.querySelector('thead').innerHTML}</thead><tbody>${originalTableBody.innerHTML}</tbody>`;
    }
    doc.close();
    win.onload = function() { win.focus(); win.print(); win.close(); };
}

function exportAchievementToPDF(centerKey) {
    const element = document.getElementById(`achievement-certificate-${centerKey}`);
    if (typeof html2pdf !== 'undefined' && element) html2pdf().from(element).save(`achievement_${centerKey}.pdf`);
    else printAchievementCertificate(centerKey);
}

function exportAchievementToExcel(centerKey) {
    if (typeof XLSX === 'undefined') { alert('مكتبة Excel غير محملة.'); return; }
    const table = document.getElementById(`ach-table-${centerKey}`);
    if (!table) return;
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.table_to_sheet(table);
    XLSX.utils.book_append_sheet(wb, ws, 'شهادة الإنجاز');
    XLSX.writeFile(wb, `شهادة_الإنجاز_${getCenterNames()[centerKey] || centerKey}.xlsx`);
}