// ===================================================================
//
//  Health Centers Attendance System - (V6 - Corrected and Integrated)
//  Author: Manus AI
//
// ===================================================================
/**
 * ✅ [جديد ومهم] يقرأ بيانات العقد والمستخلص من localStorage ويعرضها في الصفحة.
 */
/**
 * ✅ [مُصلح V2] يقرأ بيانات العقد ويعرضها مع ضمان استخدام التاريخ الميلادي.
 */




// ===================================================================
// === START: ZOOM & TABLE UTILITIES (FIXED) ===
// ===================================================================

/**
 * @description
 * ✅ [جديد ومُضاف] دالة لتكبير حجم الجدول المستهدف.
 * تحفظ مستوى التكبير الجديد في localStorage ليبقى ثابتاً عند العودة.
 * @param {string} tableId - الـ ID الخاص بالجدول المراد تكبيره.
 */
function zoomInTable(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return;
    // اقرأ الزوم الحالي أو ابدأ من 1 إذا لم يكن موجوداً
    let currentZoom = parseFloat(table.style.zoom || 1);
    currentZoom += 0.1; // زيادة مستوى التكبير
    table.style.zoom = currentZoom;
    // حفظ الحالة في localStorage باستخدام مفتاح فريد للمركز
    localStorage.setItem(`tableZoom_${tableId.replace('table-', '')}`, currentZoom);
}

/**
 * @description
 * ✅ [جديد ومُضاف] دالة لتصغير حجم الجدول المستهدف.
 * تحفظ مستوى التكبير الجديد في localStorage ليبقى ثابتاً عند العودة.
 * @param {string} tableId - الـ ID الخاص بالجدول المراد تصغيره.
 */
function zoomOutTable(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return;
    // اقرأ الزوم الحالي أو ابدأ من 1 إذا لم يكن موجوداً
    let currentZoom = parseFloat(table.style.zoom || 1);
    currentZoom -= 0.1; // تقليل مستوى التكبير
    table.style.zoom = currentZoom;
    // حفظ الحالة في localStorage باستخدام مفتاح فريد للمركز
    localStorage.setItem(`tableZoom_${tableId.replace('table-', '')}`, currentZoom);
}

// ===================================================================
// === END: ZOOM & TABLE UTILITIES ===
// ===================================================================

function updateContractDisplayData() {
    try {
        // جلب بيانات العقد
        const contractData = JSON.parse(localStorage.getItem('persistentContractData') || '{}');
        const hospitalName = contractData.hospitalName || 'غير محدد';
        const contractDetails = contractData.contractDetails || 'غير محدد';
        const companyName = contractData.companyName || 'غير محدد';
        const contractType = contractData.contractType || 'غير محدد';
        const directPurchaseRatio = contractData.directPurchaseRatio || '0';

        // جلب بيانات المستخلص
        const extractData = JSON.parse(localStorage.getItem('persistentExtractData') || '{}');
        
        // ✅✅✅ [الحل] استخدام 'en-CA' يضمن تنسيق YYYY-MM-DD الميلادي ✅✅✅
        const formatDateGregorian = (dateString) => {
            if (!dateString) return 'غير محدد';
            try {
                // en-CA يعطي الصيغة YYYY-MM-DD وهي مثالية للعرض الواضح والميلادي
                return new Date(dateString).toLocaleDateString('en-CA');
            } catch (e) {
                return 'تاريخ غير صالح';
            }
        };

        const extractStart = formatDateGregorian(extractData.extractStart);
        const extractEnd = formatDateGregorian(extractData.extractEnd);

        // تحديث عناصر الـ HTML
        document.querySelectorAll('.hospitalName').forEach(el => el.textContent = hospitalName);
        document.querySelectorAll('.contractDetails').forEach(el => el.textContent = contractDetails);
        document.querySelectorAll('.companyName').forEach(el => el.textContent = companyName);
        document.querySelectorAll('.contractType').forEach(el => el.textContent = contractType);
        document.querySelectorAll('.directPurchaseRatio').forEach(el => el.textContent = directPurchaseRatio);
        document.querySelectorAll('#extract-start-date').forEach(el => el.textContent = extractStart);
        document.querySelectorAll('#extract-end-date').forEach(el => el.textContent = extractEnd);

        // إظهار أو إخفاء حقل نسبة الشراء المباشر
        document.querySelectorAll('.directPurchaseContainer').forEach(el => {
            // ✅ [مُصلح] التأكد من أن الشرط يعمل بشكل صحيح
            if (contractType === 'شراء مباشر' && parseFloat(directPurchaseRatio) > 0) {
                el.style.display = 'block';
            } else {
                el.style.display = 'none';
            }
        });

    } catch (error) {
        console.error("خطأ في تحديث بيانات العقد المعروضة:", error);
    }
}

// --- 1. CONFIGURATION & CONSTANTS ---
// --- 1. CONFIGURATION & CONSTANTS ---
const PASSWORD = "admin123";
const CENTER_ICONS = [ "fa-clinic-medical", "fa-hospital", "fa-pills", "fa-stethoscope", "fa-user-md", "fa-ambulance", "fa-heartbeat", "fa-notes-medical", "fa-syringe", "fa-band-aid" ];

// ✅ [مُحدّث وشامل] تعريف جميع حالات الحضور مع خصائصها
const STATUS_CODES = {
  'ح': { name: 'حاضر', color: '#d4edda', isAbsence: false },
  'غ': { name: 'غائب', color: '#f8d7da', isAbsence: true },
  'ج': { name: 'إجازة', color: '#fff3cd', isAbsence: false, isSpecial: true },
  'ش': { name: 'شاغرة', color: '#d1ecf1', isAbsence: false, isSpecial: true },
  'ت': { name: 'تحت الإجراء', color: '#e2e3e5', isAbsence: false, isSpecial: true },
  'ب': { name: 'قبل بدء العقد', color: '#cce5ff', isAbsence: false, isSpecial: true },
  'ن': { name: 'بعد نهاية العقد', color: '#ffeeba', isAbsence: false, isSpecial: true },
  default: { name: 'غير معروف', color: '#ffffff', isAbsence: false }
};

const ABSENCE_FINES_BY_CATEGORY = { 1: { saudi: 300, non_saudi: 300 }, 2: { saudi: 250, non_saudi: 250 }, 3: { saudi: 100, non_saudi: 100 }, 4: { saudi: 80, non_saudi: 50 }, 5: { saudi: 80, non_saudi: 50 }, 6: { saudi: 50, non_saudi: 20 }, 7: { saudi: 10, non_saudi: 10 }, default: { saudi: 0, non_saudi: 0 } };

// --- 2. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // ✅✅✅ [السطر المضاف والمهم] استدعاء الدالة لربط البيانات ✅✅✅
    if (typeof updateContractDisplayData === 'function') {
        updateContractDisplayData();
    }
    // --- بقية الكود يبقى كما هو ---
    updateDateTime();
    setInterval(updateDateTime, 60000);
    initializeCenterNames();
    renderCenterIcons();
    calculateAndDisplayGrandTotal();
    if (typeof displaySignatures === 'function') {
        displaySignatures('attendance');
    }
});

function updateDateTime() {
    const el = document.getElementById('current-date-time');
    if (el) el.textContent = new Date().toLocaleString('ar-SA', { dateStyle: 'full', timeStyle: 'medium' });
}

window.navigateTo = (url) => { if (url && url !== '#') window.location.href = url; };

// --- 3. DATA MANAGEMENT ---
function getCenterNames() { return JSON.parse(localStorage.getItem('adminOfficeNames_v1')) || {}; }
function saveCenterNames(names) { localStorage.setItem('adminOfficeNames_v1', JSON.stringify(names)); }
function getAttendanceData() { return JSON.parse(localStorage.getItem('adminOfficesAttendanceData_v1')) || {}; }
function saveAttendanceData(data) { localStorage.setItem('adminOfficesAttendanceData_v1', JSON.stringify(data)); }

// ✅✅✅ [الكود النهائي والمطابق للصورة] ✅✅✅
function initializeCenterNames() {
    const defaultNames = {
        'center_1':  'مبنى فرع وزارة الصحة بنجران',
        'center_2':  'المختبر الإقليمي',
        'center_3':  'نواقل المرضى والأمراض المشتركة',
        'center_4':  'مبنى الطب الشرعي وثلاجة الموتى بالشرفة',
        'center_5':  'الأزمات والكوارث الصحية بفرع وزارة الصحة',
        'center_6':  'مبنى مستودعات الشرفة',
        'center_7':  'إدارة الشئون الهندسية والفريق الجوال',
        'center_8':  'مكتب هيئة الصحة العامة (وقاية)',
        'center_9':  'سكن الممرضات بالإثايبة',
        'center_10': 'مبنى التجمع الصحي',
        'center_11': 'التدريب والابتعاث',
        'center_12': 'إدارة مركز التحكم والكوارث بالفيصلية',
        'center_13': 'التموين الطبي',
        'center_14': 'الخدمات العامة',
        'center_15': 'مكتب إداري 15',
        'center_16': 'مكتب إداري 16',
        'center_17': 'مكتب إداري 17',
        'center_18': 'مكتب إداري 18',
        'center_19': 'مكتب إداري 19',
        'center_20': 'مكتب إداري 20',
        'center_21': 'مكتب إداري 21',
        'center_22': 'مكتب إداري 22',
        'center_23': 'مكتب إداري 23',
        'center_24': 'مكتب إداري 24',
        'center_25': 'مكتب إداري 25',
        'center_26': 'مكتب إداري 26',
        'center_27': 'مكتب إداري 27',
        'center_28': 'مكتب إداري 28',
        'center_29': 'مكتب إداري 29',
        'center_30': 'مكتب إداري 30',
        'admin_staff': 'فئات إدارية أخرى',
    };
    let names = getCenterNames();
    if (Object.keys(names).length === 0) {
        saveCenterNames(defaultNames);
    } else {
        // Migrate: overwrite any center that still has the old generic "مكتب إداري N" name
        let changed = false;
        for (let i = 1; i <= 14; i++) {
            const key = 'center_' + i;
            if (!names[key] || /^مكتب إداري \d+$/.test(names[key])) {
                names[key] = defaultNames[key];
                changed = true;
            }
        }
        if (changed) saveCenterNames(names);
    }
}

function getExtractPeriodDetails() {
    try {
        const data = JSON.parse(localStorage.getItem('persistentExtractData') || '{}');
        const start = new Date(data.extractStart || new Date());
        const end = new Date(data.extractEnd || new Date());
        
        // التأكد من أن التواريخ صالحة
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            throw new Error("Invalid dates in localStorage");
        }

        // حساب عدد أيام المستخلص الفعلية
        const daysInExtract = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        
        // حساب عدد أيام الشهر الميلادي الذي تبدأ فيه الفترة
        const totalDaysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
        
        return { 
            startDate: start, // تاريخ البداية ككائن Date
            daysInExtract: Math.max(1, daysInExtract), 
            totalDaysInMonth: totalDaysInMonth > 0 ? totalDaysInMonth : 30 
        };
    } catch (e) { 
        console.error("Error in getExtractPeriodDetails:", e);
        const today = new Date();
        const daysInCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        return { 
            startDate: today,
            daysInExtract: daysInCurrentMonth, 
            totalDaysInMonth: daysInCurrentMonth
        }; 
    }
}

// --- 4. UI RENDERING & NAVIGATION ---
// ✅✅✅ [الكود النهائي مع تمييز المراكز الفارغة] ✅✅✅
function renderCenterIcons() {
    const centersGrid = document.getElementById('centers-grid');
    const specialGrid = document.getElementById('special-categories-grid');
    const names = getCenterNames();
    const attendanceData = getAttendanceData();
    centersGrid.innerHTML = '';
    specialGrid.innerHTML = '';
    let centerCounter = 0;

    Object.keys(names).sort((a, b) => {
        if (a.startsWith('center_') && b.startsWith('center_')) {
            return parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]);
        }
        return a.localeCompare(b);
    }).forEach(key => {
        const name = names[key];
        
        // ✅ [التحسين الجديد] تحديد حالة المركز (يحتوي على بيانات أم فارغ)
        const hasData = attendanceData[key] && attendanceData[key].length > 0;
        const dataClass = hasData ? 'has-data' : 'is-empty'; // <-- التغيير هنا

        if (key.startsWith('center_')) {
            centerCounter++;
            const iconClass = CENTER_ICONS[(centerCounter - 1) % CENTER_ICONS.length];
            centersGrid.innerHTML += `<div class="center-icon ${dataClass}" onclick="showCenterDetails('${key}')"><div class="center-icon-badge">${centerCounter}</div><i class="fas ${iconClass}"></i><span>${name}</span></div>`;
        } else {
            specialGrid.innerHTML += `<div class="center-icon special-category ${dataClass}" onclick="showCenterDetails('${key}')"><i class="fas fa-user-tie"></i><span>${name}</span></div>`;
        }
    });
}

// ===================================================================
// --- START: NEW UI & TABS LOGIC ---
// ===================================================================
// ===================================================================
//
//  قسم استيراد ورفع ملفات الإكسل (النسخة النهائية والمُصححة)
//  Author: Manus AI
//
// ===================================================================

/**
 * @description
 * تفتح نافذة منبثقة بسيطة تسمح للمستخدم باختيار مركز صحي ورفع ملف إكسل واحد له.
 */
function openImportDialog() {
    const names = getCenterNames();
    let options = '';
    Object.keys(names).forEach(key => {
        options += `<option value="${key}">${names[key]}</option>`;
    });
    const content = `
        <div class="dialog-header">
            <h3><i class="fas fa-file-import"></i> استيراد بيانات من Excel لمركز محدد</h3>
            <span class="close" onclick="closeDialog('management-dialog')">×</span>
        </div>
        <div class="dialog-body">
            <p class="info-text">اختر المركز الذي تريد إضافة الموظفين إليه، ثم اختر ملف الإكسل.</p>
            <div class="form-group">
                <label for="center-select-import">اختر المركز الصحي:</label>
                <select id="center-select-import">${options}</select>
            </div>
            <div class="form-group">
                <label for="excel-file-input">اختر ملف الإكسل:</label>
                <input type="file" id="excel-file-input" accept=".xlsx, .xls, .csv">
            </div>
            <div id="import-status-area" class="status-area" style="margin-top: 15px;"></div>
        </div>
        <div class="dialog-footer">
            <div></div>
            <button class="btn btn-success" onclick="handleSingleFileImport()"><i class="fas fa-check"></i> بدء الاستيراد</button>
        </div>
    `;
    openDialog(content, 'management-dialog', true);
}

/**
 * @description
 * تفتح نافذة "الرفع الذكي" التي تسمح برفع عدة ملفات إكسل مرة واحدة.
 */
function openSmartUploadDialog() {
    const dialogContent = `
        <div class="dialog-header">
            <h3><i class="fas fa-magic"></i> الرفع الذكي لملفات المراكز</h3>
            <span class="close" onclick="closeDialog('management-dialog')">×</span>
        </div>
        <div class="dialog-body">
            <p class="info-text">هذه الأداة تربط كل ملف إكسل بالمركز الصحي الصحيح تلقائيًا بناءً على <strong>اسم الملف</strong>. يمكنك اختيار عدة ملفات مرة واحدة.</p>
            <input type="file" id="smart-upload-input" accept=".xlsx, .xls, .csv" multiple style="display: none;" onchange="handleSmartUpload(event)">
            <div class="dialog-buttons">
                <button class="btn btn-success btn-lg" onclick="document.getElementById('smart-upload-input').click()">
                    <i class="fas fa-file-excel"></i> اختر الملفات وابدأ الرفع
                </button>
            </div>
            <div id="smart-upload-status-area" class="status-area"></div>
        </div>
    `;
    openDialog(dialogContent, 'management-dialog', true);
}

/**
 * @description
 * ✅ [مُصحح] هذه الدالة تعالج الآن رفع ملف واحد فقط من نافذة "الاستيراد لمركز".
 */
async function handleSingleFileImport() {
    const centerKeyToImportTo = document.getElementById('center-select-import').value;
    const fileInput = document.getElementById('excel-file-input');
    const statusArea = document.getElementById('import-status-area');

    if (!fileInput.files.length) {
        statusArea.innerHTML = `<p class="status-error">الرجاء اختيار ملف أولاً.</p>`;
        return;
    }
    const file = fileInput.files[0];
    statusArea.innerHTML = `<h4><i class="fas fa-spinner fa-spin"></i> جاري معالجة ملف: ${file.name}...</h4>`;

    try {
        const newEmployees = await processSingleExcelFile(file);
        if (newEmployees.length === 0) {
            throw new Error("لم يتم العثور على بيانات موظفين صالحة في الملف.");
        }
        
        const allData = getAttendanceData();
        const centerNames = getCenterNames();
        let addedCount = 0;
        let skippedCount = 0;
        let skippedInfo = '';

        newEmployees.forEach(newEmp => {
            if (!newEmp.iqamaId) {
                skippedCount++;
                skippedInfo += `<p class="status-skipped">! تم تجاهل الموظف "${newEmp.name}" لعدم وجود رقم إقامة.</p>`;
                return;
            }

            let isDuplicate = false;
            for (const centerKey in allData) {
                if (allData[centerKey].some(emp => emp.iqamaId === newEmp.iqamaId)) {
                    skippedCount++;
                    skippedInfo += `<p class="status-skipped">! تم تجاهل الموظف "${newEmp.name}" لأنه مسجل بالفعل في مركز "${centerNames[centerKey]}".</p>`;
                    isDuplicate = true;
                    break;
                }
            }

            if (!isDuplicate) {
                if (!allData[centerKeyToImportTo]) {
                    allData[centerKeyToImportTo] = [];
                }
                allData[centerKeyToImportTo].push(newEmp);
                addedCount++;
            }
        });

        saveAttendanceData(allData);
        renderCenterIcons();
        
        statusArea.innerHTML = `
            <p class="status-success">✓ اكتملت العملية: تم استيراد ${addedCount} موظف بنجاح.</p>
            ${skippedCount > 0 ? `<p class="status-error">✗ تم تجاهل ${skippedCount} موظف مكرر أو بدون رقم إقامة.</p>${skippedInfo}` : ''}
        `;
        
        setTimeout(() => closeDialog('management-dialog'), 5000);

    } catch (error) {
        statusArea.innerHTML = `<p class="status-error">✗ فشل استيراد الملف. السبب: ${error.message}</p>`;
    }
}

/**
 * @description
 * ✅ [مُصحح] هذه الدالة تعالج الآن حدث الرفع من نافذة "الرفع الذكي".
 * @param {Event} event - كائن الحدث من حقل الإدخال.
 */
async function handleSmartUpload(event) {
    const files = event.target.files;
    if (files.length === 0) return;

    const statusArea = document.getElementById('smart-upload-status-area');
    statusArea.innerHTML = '<h4><i class="fas fa-spinner fa-spin"></i> جاري المعالجة...</h4>';
    
    let allData = getAttendanceData();
    const centerNames = getCenterNames();
    const centerNameMap = new Map(Object.entries(centerNames).map(([key, name]) => [name.toLowerCase().trim(), key]));
    
    let successCount = 0, errorCount = 0, skippedCount = 0;
    let statusHTML = '<h4>نتائج العملية:</h4>';

    for (const file of files) {
        const fileName = file.name.split('.').slice(0, -1).join('.').toLowerCase().trim();
        const matchedCenterKey = centerNameMap.get(fileName);

        if (matchedCenterKey) {
            try {
                const employees = await processSingleExcelFile(file);
                // هنا يتم استبدال بيانات المركز بالكامل لأن كل ملف يمثل المركز
                allData[matchedCenterKey] = employees;
                successCount++;
                statusHTML += `<p class="status-success">✓ تم ربط ملف <strong>"${file.name}"</strong> بمركز <strong>"${centerNames[matchedCenterKey]}"</strong> بنجاح.</p>`;
            } catch (error) {
                errorCount++;
                statusHTML += `<p class="status-error">✗ فشلت معالجة ملف <strong>"${file.name}"</strong>. السبب: ${error.message}</p>`;
            }
        } else {
            skippedCount++;
            statusHTML += `<p class="status-skipped">! تم تجاهل ملف <strong>"${file.name}"</strong> لأنه لا يطابق أي اسم مركز.</p>`;
        }
    }
    
    saveAttendanceData(allData);
    statusHTML += `<hr><p><strong>النتائج:</strong> ${successCount} نجاح، ${errorCount} فشل، ${skippedCount} تم تجاهله.</p>`;
    statusArea.innerHTML = statusHTML;
    
    // إعادة تعيين قيمة حقل الإدخال للسماح برفع نفس الملفات مرة أخرى
    event.target.value = '';
}

/**
 * @description
 * ✅ [النسخة النهائية V5 - مطابقة للصورة الجديدة] دالة مركزية وموثوقة لقراءة بيانات ملف إكسل واحد.
 * تم تحديثها لتتعرف بدقة على أسماء الأعمدة الموجودة في صورة المستخدم الجديدة.
 * @param {File} file - كائن الملف المراد معالجته.
 * @returns {Promise<Array>} - وعد يحتوي على قائمة بالموظفين.
 */
function processSingleExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

                if (jsonData.length === 0) {
                    return reject(new Error("الملف فارغ أو لا يمكن قراءته."));
                }

                let headerRowIndex = -1;
                for (let i = 0; i < Math.min(10, jsonData.length); i++) {
                    const row = jsonData[i].map(cell => String(cell).toLowerCase().trim().replace(/\s+/g, ' '));
                    if (row.some(c => c.includes("مسمى الوظيفة")) && row.some(c => c.includes("اسم شاغل الوظيفة"))) {
                        headerRowIndex = i;
                        break;
                    }
                }
                if (headerRowIndex === -1) {
                    return reject(new Error("لم يتم العثور على صف العناوين. تأكد من وجود أعمدة 'مسمى الوظيفة' و 'اسم شاغل الوظيفة'."));
                }
                
                const headers = jsonData[headerRowIndex].map(h => String(h).trim().replace(/\s+/g, ' '));
                
                const findIndex = (exactKeys) => {
                    for (const key of exactKeys) {
                        const index = headers.findIndex(h => h === key);
                        if (index !== -1) return index;
                    }
                    return -1;
                };

                const jobTitleIndex = findIndex(["مسمى الوظيفة"]);
                const nameIndex = findIndex(["اسم شاغل الوظيفة"]);
                const salaryIndex = findIndex(["التكلفة الشهرية"]);
                const categoryIndex = findIndex(["الفئة"]);
                const nationalityIndex = findIndex(["الجنسية"]);
                const iqamaIdIndex = findIndex(["رقم الاقامة", "رقم الإقامة"]);
                const nationalityFineIndex = findIndex(["غرامة جنسية"]);

                const employees = [];
                const { daysInExtract } = getExtractPeriodDetails();

                // ✅ [جديد] قائمة بالكلمات التي يجب تجاهلها
                const ignoredNames = ["اسم شاغل الوظيفة", "مندوب المقاول", "غير محدد", "مدير المركز", ""];

                for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
                    const row = jsonData[i];
                    const employeeName = String(nameIndex !== -1 ? row[nameIndex] : '').trim();
                    const jobTitle = String(jobTitleIndex !== -1 ? row[jobTitleIndex] : '').trim();

                    // ✅ [جديد] شروط التجاهل
                    if (!employeeName && !jobTitle) continue; // تجاهل الصفوف الفارغة
                    if (ignoredNames.includes(employeeName)) continue; // تجاهل الأسماء غير المرغوب فيها
                    if (jobTitle.includes("مسمى الوظيفة")) continue; // تجاهل بقايا الهيدر

                    employees.push({
                        jobTitle: jobTitle || 'غير محدد',
                        name: employeeName,
                        salary: salaryIndex !== -1 ? parseFloat(row[salaryIndex]) || 0 : 0,
                        category: categoryIndex !== -1 ? String(row[categoryIndex] || '7') : '7',
                        nationality: nationalityIndex !== -1 ? String(row[nationalityIndex] || 'سعودي') : 'سعودي',
                        iqamaId: iqamaIdIndex !== -1 ? String(row[iqamaIdIndex] || '') : '',
                        nationalityFine: nationalityFineIndex !== -1 ? parseFloat(row[nationalityFineIndex]) || 0 : 0,
                        days: Array(daysInExtract).fill('ح')
                    });
                }
                
                resolve(employees);
            } catch (err) {
                console.error("خطأ أثناء تحليل ملف الإكسل:", err);
                reject(new Error("حدث خطأ أثناء تحليل الملف. تأكد من أن الملف غير تالف."));
            }
        };
        reader.onerror = () => reject(new Error("فشلت قراءة الملف."));
        reader.readAsArrayBuffer(file);
    });
}

function getExtractPeriodDetailsFormatted() {
    const data = JSON.parse(localStorage.getItem('persistentExtractData') || '{}');
    const formatDate = (dateString) => {
        if (!dateString) return 'غير محدد';
        return new Date(dateString).toLocaleDateString('ar-SA-u-nu-latn', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };
    return { extractStart: formatDate(data.extractStart), extractEnd: formatDate(data.extractEnd) };
}
function showCenterDetails(centerKey) {
    // إخفاء الواجهة الرئيسية
    document.getElementById('main-grid-view').style.display = 'none';
    document.getElementById('main-summary-section').style.display = 'none';
    document.getElementById('main-action-buttons').style.display = 'none';
    
    // إظهار واجهة التفاصيل الجديدة
    document.getElementById('center-details-view').style.display = 'block';
    
    // --- ✅ التعديلات هنا ---
    const centerName = getCenterNames()[centerKey];
    const extractData = JSON.parse(localStorage.getItem('persistentExtractData') || '{}');

    // دالة مساعدة لتنسيق التاريخ الميلادي (YYYY-MM-DD)
    const formatDate = (dateString) => {
        if (!dateString) return 'غير محدد';
        try {
            // en-CA يعطي الصيغة YYYY-MM-DD وهي مثالية للعرض الواضح
            return new Date(dateString).toLocaleDateString('en-CA');
        } catch (e) {
            return 'تاريخ غير صالح';
        }
    };

    const extractStart = formatDate(extractData.extractStart);
    const extractEnd = formatDate(extractData.extractEnd);
// ✅✅✅ السطر الجديد والمصحح لعرض الشهر الميلادي ✅✅✅
const monthName = new Date(extractData.extractStart || new Date()).toLocaleString('ar-SA-u-nu-latn-ca-gregory', { month: 'long', year: 'numeric' });

    // تحديث العنوان الرئيسي في واجهة التفاصيل بالتنسيق الجديد
    document.getElementById('center-main-title').innerHTML = `
        <h2>مستخلص العمالة للمراكز الصحية</h2>
        <h3>لمركز: ${centerName} - عن شهر ${monthName}</h3>
        <p>الفترة من: ${extractStart}م إلى: ${extractEnd}م</p>
    `;
    // --- نهاية التعديلات ---

    // تفعيل التبويب الأول افتراضياً
    const tablinks = document.querySelectorAll(".tab-link");
    tablinks.forEach((link, index) => {
        link.classList.remove("active");
        if (index === 0) link.classList.add("active");
    });
    
    // فتح محتوى التبويب الأول
    openTab({ currentTarget: document.querySelector('.tabs-container .tab-link') }, 'attendance-tab', centerKey);
}

function backToGrid() {
    document.getElementById('center-details-view').style.display = 'none';
    document.getElementById('main-grid-view').style.display = 'block';
    document.getElementById('main-summary-section').style.display = 'block';
    document.getElementById('main-action-buttons').style.display = 'flex';
}

/**
 * ===================================================================
 *      ===>   فتح التبويبات (النسخة النهائية والمصححة)   <===
 * ===================================================================
 * @description تفتح التبويب المطلوب وتضمن دائمًا استدعاء وعرض
 *              مجموعة التواقيع الصحيحة (عامة أو خاصة) للمركز الحالي.
 */
function openTab(evt, tabName, centerKey) {
    if (!centerKey) {
        const activeTabButton = document.querySelector('.tab-link.active');
        if (activeTabButton) centerKey = activeTabButton.dataset.centerKey;
    }
    if (!centerKey) return;

    document.querySelectorAll(".tab-content").forEach(tab => tab.style.display = "none");
    document.querySelectorAll(".tab-link").forEach(link => {
        link.classList.remove("active");
        link.dataset.centerKey = centerKey;
    });

    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.classList.add("active");

    if (tabName === 'attendance-tab') {
        renderAttendanceTable(centerKey);
        // ✅ [الإصلاح هنا] استدعاء دالة عرض التواقيع
        displaySignatures('attendance', centerKey); 
    } 
    else if (tabName === 'performance-tab') {
        if (centerKey === 'admin_staff') {
            document.getElementById(tabName).innerHTML = `
                <div class="info-message-box">
                    <i class="fas fa-info-circle"></i>
                    <h3>لا يوجد تقييم أداء لهذه الفئة</h3>
                    <p>تقييم الأداء مخصص للمراكز الصحية فقط.</p>
                </div>`;
        } else if (typeof renderPerformanceTable === 'function') {
            renderPerformanceTable(centerKey);
            // ✅ [الإصلاح هنا] استدعاء دالة عرض التواقيع
            displaySignatures('performance', centerKey);
        } else {
            document.getElementById(tabName).innerHTML = '<p style="color:red; text-align:center;">خطأ: ملف performance_logic.js غير محمل.</p>';
        }
    } 
    else if (tabName === 'achievement-tab') {
        if (typeof renderAchievementCertificate === 'function') {
            renderAchievementCertificate(centerKey);
            // ✅ [الإصلاح هنا] استدعاء دالة عرض التواقيع
            displaySignatures('achievement', centerKey);
        } else {
            document.getElementById(tabName).innerHTML = '<p style="color:red; text-align:center;">خطأ: ملف achievement_logic.js غير محمل.</p>';
        }
    }
}
/**
 * ✅ [النسخة النهائية V19 - مُصلّحة ومتكاملة]
 * تحتوي على كل الإصلاحات اللازمة لتعريف المتغيرات وإضافة الكلاسات للطباعة.
 */
function renderAttendanceTable(centerKey) {
    const container = document.getElementById('attendance-tab');
    if (!container) return;

    // --- [مُصلّح] جلب كل البيانات المطلوبة في البداية ---
    const { startDate, daysInExtract } = getExtractPeriodDetails();
    const centerName = getCenterNames()[centerKey] || 'المركز';
    const companyName = (JSON.parse(localStorage.getItem('persistentContractData') || '{}').companyName || 'الشركة');
    const extractData = JSON.parse(localStorage.getItem('persistentExtractData') || '{}');
    const formatDate = (dateString) => new Date(dateString).toLocaleDateString('en-CA');
    const extractStart = formatDate(extractData.extractStart);
    const extractEnd = formatDate(extractData.extractEnd);

    // --- بناء كود HTML ---
    const tableTitleHTML = `
        <div class="extract-details-v2">
            <div class="title-main">بيان بالحضور والغياب لمنسوبي شركة (${companyName}) بمركز صحي ${centerName}</div>
            <div class="title-period">الفترة (${extractStart}م - ${extractEnd}م)</div>
            <div class="title-days">عدد أيام المستخلص: ${daysInExtract}</div>
        </div>`;

    const daysHeaderHTML = Array.from({ length: daysInExtract }, (_, i) => {
        const day = new Date(startDate);
        day.setDate(startDate.getDate() + i);
        return `<th class="day-col">${day.getDate()}</th>`;
    }).join('');

    const tableHTML = `
        <div class="department-table" id="table-div-${centerKey}">
            ${tableTitleHTML}
            <div class="table-responsive-wrapper">
                <table id="table-${centerKey}">
                    <caption id="total-${centerKey}"></caption>
                    <thead>
                        <tr>
                            <th rowspan="2" class="seq-col">م</th>
                            <th rowspan="2" class="job-title">مسمى الوظيفة</th>
                            <th rowspan="2" class="category-col">الفئة</th>
                            <th rowspan="2" class="employee-name">اسم شاغل الوظيفة</th>
                            <th colspan="${daysInExtract}">الأيام</th>
                            <th rowspan="2" class="cost-col">التكلفة للفترة</th>
                            <th colspan="2" class="days-group-col">عدد الأيام</th>
                            <th colspan="2" class="deduction-group-col">حسم وغرامة الغياب</th>
                            <th rowspan="2" class="net-col">صافي الاستحقاق</th>
                            <th rowspan="2" class="nationality-col">الجنسية</th>
                            <th rowspan="2" class="fine-col">غرامة جنسية</th>
                            <th rowspan="2" class="iqama-col">رقم الإقامة/الهوية</th>
                        </tr>
                        <tr id="days-header-${centerKey}">
                            ${daysHeaderHTML}
                            <th class="days-count-col">حضور</th>
                            <th class="days-count-col">غياب</th>
                            <th class="deduction-col">الحسم</th>
                            <th class="fine-col">غرامة الغياب</th>
                        </tr>
                    </thead>
                    <tbody id="tbody-${centerKey}"></tbody>
                </table>
            </div>
            <div class="signatures-display-section" id="attendance-signatures-${centerKey}"></div>
            <div class="tab-action-buttons no-print">
                <button onclick="preparePrint()"><i class="fas fa-print"></i> طباعة الجدول</button>
                <button onclick="openSignatureDialog('attendance', '${centerKey}')"><i class="fas fa-signature"></i> تعديل التواقيع</button>
                <button onclick="zoomInTable('table-${centerKey}')"><i class="fas fa-search-plus"></i> تكبير</button>
                <button onclick="zoomOutTable('table-${centerKey}')"><i class="fas fa-search-minus"></i> تصغير</button>
            </div>
        </div>`;
        
    container.innerHTML = tableHTML;
    populateAttendanceTableBody(centerKey);
    if (typeof displaySignatures === 'function') {
        displaySignatures('attendance', `attendance-signatures-${centerKey}`);
    }
    const savedZoom = localStorage.getItem(`tableZoom_${centerKey}`);
    if (savedZoom) {
        const table = document.getElementById(`table-${centerKey}`);
        if (table) table.style.zoom = savedZoom;
    }
}
/**
 * ✅ [النسخة النهائية V3 - طباعة احترافية متكاملة]
 * تطبع صفحة كاملة تحتوي على الهيدر الرسمي، معلومات العقد، جدول الحضور، والتواقيع.
 * @param {string} elementId - الـ ID الخاص بحاوية جدول الحضور (e.g., 'table-div-center_1').
 */
function printTabContent(elementId) {
    const contentToPrint = document.getElementById(elementId);
    if (!contentToPrint) {
        alert("خطأ: لم يتم العثور على المحتوى للطباعة.");
        return;
    }

    // 1. إنشاء حاوية رئيسية لكل محتوى الطباعة
    const printWrapper = document.createElement('div');
    
    // 2. إنشاء صفحة طباعة واحدة
    const printablePage = document.createElement('div');
    printablePage.className = 'printable-page';

    // 3. استنساخ العناصر المطلوبة من الصفحة الرئيسية بدقة
    const headerClone = document.querySelector('.header-info').cloneNode(true);
    const pageContractInfoClone = document.querySelector('.page-contract-info').cloneNode(true);
    const tableClone = contentToPrint.cloneNode(true);

    // 4. إزالة الأزرار غير المرغوب فيها من نسخة الجدول
    tableClone.querySelectorAll('.tab-action-buttons').forEach(btn => btn.remove());

    // 5. بناء الهيدر الرسمي للطباعة من النسخة المستنسخة
    const printableHeader = `
        <div class="printable-header">
            <img src="${headerClone.querySelector('.logo-left')?.src}" alt="Logo">
            <div class="header-text">
                <h1>${headerClone.querySelector('h1')?.textContent}</h1>
                <h3>${headerClone.querySelector('h3')?.textContent}</h3>
                <h2>${headerClone.querySelector('h2')?.textContent}</h2>
            </div>
            <img src="${headerClone.querySelector('.logo-right')?.src}" alt="Logo">
        </div>
    `;
    
    // 6. تجميع كل الأجزاء بالترتيب الصحيح داخل صفحة الطباعة
    printablePage.innerHTML = printableHeader;
    printablePage.appendChild(pageContractInfoClone);
    printablePage.appendChild(tableClone);

    // 7. إضافة الصفحة المكتملة إلى حاوية الطباعة الرئيسية
    printWrapper.appendChild(printablePage);

    // 8. فتح نافذة جديدة مخصصة للطباعة
    const printWindow = window.open('', '', 'height=800,width=1200');
    printWindow.document.write('<html><head><title>طباعة تقرير الحضور</title>');
    
    // 9. نسخ كل ملفات التنسيق (CSS) إلى النافذة الجديدة لضمان تطبيق الأنماط
    document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
        printWindow.document.write(`<link rel="stylesheet" href="${link.href}">`);
    });
    
    printWindow.document.write('</head><body dir="rtl">');
    printWindow.document.write(printWrapper.innerHTML); // وضع المحتوى المجهز للطباعة
    printWindow.document.write('</body></html>');
    
    // 10. انتظار تحميل المحتوى بالكامل ثم تنفيذ أمر الطباعة وإغلاق النافذة
    printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
    };
    printWindow.document.close();
}

// --- END: NEW UI & TABS LOGIC ---
// ===================================================================


// --- 5. TABLE & EMPLOYEE LOGIC ---
/**
/**
 * @description
 * ✅ [النسخة النهائية V7 - إجماليات احترافية] يعرض الموظفين مع حساب وعرض كل التفاصيل المطلوبة في شريط الإجمالي.
 */
function populateAttendanceTableBody(centerKey) {
    const tbody = document.getElementById(`tbody-${centerKey}`);
    if (!tbody) return;
    const data = getAttendanceData();
    const centerData = data[centerKey] || [];
    const { daysInExtract, totalDaysInMonth } = getExtractPeriodDetails();
    tbody.innerHTML = '';

    const contractData = JSON.parse(localStorage.getItem('persistentContractData') || '{}');
    const contractType = contractData.contractType || 'عقد أساسي';
    const directPurchaseRatio = parseFloat(contractData.directPurchaseRatio) || 0;

    let centerTotalCost = 0, centerNetTotal = 0, totalDeduction = 0, totalFine = 0;
    let employeesWithAbsence = 0;
    let specialStatusCounts = {};

    if (centerData.length === 0) {
        const colspan = 14 + daysInExtract;
        tbody.innerHTML = `<tr><td colspan="${colspan}">لا يوجد موظفون في هذا المركز.</td></tr>`;
        document.getElementById(`total-${centerKey}`).innerHTML = `<div class="table-summary-v2"><div class="summary-item"><span class="label">لا يوجد موظفين</span></div></div>`;
        return;
    }

    const fragment = document.createDocumentFragment();

    centerData.forEach((emp, index) => {
        const fullMonthSalary = parseFloat(emp.salary) || 0;
        
        const dailyRate = totalDaysInMonth > 0 ? fullMonthSalary / totalDaysInMonth : 0;
        let actualCostForPeriod = dailyRate * daysInExtract;
        if (contractType === 'شراء مباشر' && directPurchaseRatio > 0) {
            actualCostForPeriod += actualCostForPeriod * (directPurchaseRatio / 100);
        }
        
        const nationalityFine = parseFloat(emp.nationalityFine) || 0;
        
        let days = emp.days || Array(daysInExtract).fill('ح');
        if (days.length !== daysInExtract) {
            days = Array(daysInExtract).fill('ح');
            emp.days = days;
        }

        let attendanceDays = 0, absenceDays = 0, deductionOnlyDays = 0, hasAbsence = false;
        
        days.forEach(day => {
            const statusInfo = STATUS_CODES[day];
            if (statusInfo) {
                if (statusInfo.isAbsence) { absenceDays++; hasAbsence = true; }
                else if (statusInfo.deductionOnly) { deductionOnlyDays++; }
                else { attendanceDays++; }
                if (statusInfo.isSpecial) {
                    specialStatusCounts[day] = (specialStatusCounts[day] || 0) + 1;
                }
            }
        });
        if (hasAbsence) employeesWithAbsence++;

        const deduction = (absenceDays + deductionOnlyDays) * dailyRate;
        const fineConfig = ABSENCE_FINES_BY_CATEGORY[emp.category] || ABSENCE_FINES_BY_CATEGORY.default;
        const isSaudi = (emp.nationality || '').includes('سعودي');
        const absenceFine = absenceDays * (isSaudi ? fineConfig.saudi : fineConfig.non_saudi);
        const netSalary = actualCostForPeriod - deduction - absenceFine - nationalityFine;

        centerTotalCost += actualCostForPeriod;
        centerNetTotal += netSalary;
        totalDeduction += deduction;
        totalFine += absenceFine + nationalityFine;

        const row = document.createElement('tr');
        let dayCells = days.map((day, dayIndex) => `<td class="day-col">${createAttendanceSelect(day, centerKey, index, dayIndex)}</td>`).join('');
        
        let specialStatusCells = '';
        Object.keys(STATUS_CODES).forEach(code => {
            if (STATUS_CODES[code].isSpecial) {
                const statusKey = `status-${code.toLowerCase()}-col`;
                const countForEmp = days.filter(d => d === code).length;
                specialStatusCells += `<td class="status-header ${statusKey}" style="display: none;">${countForEmp}</td>`;
            }
        });

        row.innerHTML = `<td>${index + 1}</td><td class="job-title">${emp.jobTitle || ''}</td><td class="category-col">
    <select class="category-select" 
        style="background-color: ${getCategoryColor(emp.category)}; color: ${getCategoryTextColor(emp.category)}; width: 100%;" 
        onchange="updateEmployeeField('${centerKey}', ${index}, 'category', this.value); updateCategoryDisplay(this, ${index}, '${centerKey}')">
        ${[1,2,3,4,5,6,7].map(n => `<option value="${n}" ${n == emp.category ? 'selected' : ''}>${n}</option>`).join('')}
    </select>
</td><td class="employee-name">${emp.name || ''}</td>${dayCells}<td>${actualCostForPeriod.toFixed(2)}</td><td>${attendanceDays}</td><td>${absenceDays}</td><td>${deduction.toFixed(2)}</td><td>${absenceFine.toFixed(2)}</td><td>${netSalary.toFixed(2)}</td><td>${createNationalitySelect(emp.nationality, centerKey, index)}</td><td><input type="number" class="fine-input" value="${nationalityFine.toFixed(2)}" onchange="updateEmployeeField('${centerKey}', ${index}, 'nationalityFine', this.value)"></td><td><input type="text" class="iqama-input" value="${emp.iqamaId || ''}" onchange="updateEmployeeField('${centerKey}', ${index}, 'iqamaId', this.value)"></td>${specialStatusCells}`;
        fragment.appendChild(row);
    });

    tbody.appendChild(fragment);

    const tableElement = document.getElementById(`table-${centerKey}`);
    if (tableElement) {
        tableElement.querySelectorAll('thead .status-header, tbody .status-header').forEach(col => col.style.display = 'none');
        const currentlyUsedSpecialStatuses = new Set();
        centerData.forEach(emp => { (emp.days || []).forEach(day => { if (STATUS_CODES[day]?.isSpecial) currentlyUsedSpecialStatuses.add(day); }); });
        currentlyUsedSpecialStatuses.forEach(status => {
            const statusKey = `status-${status.toLowerCase()}-col`;
            tableElement.querySelectorAll(`.${statusKey}`).forEach(col => col.style.display = 'table-cell');
        });
    }

    let summaryHTML = `
        <div class="summary-item"><span class="label">عدد الموظفين</span><span class="value">${centerData.length}</span></div>
        <div class="summary-item"><span class="label">التكلفة للفترة</span><span class="value">${centerTotalCost.toFixed(2)}</span></div>
        <div class="summary-item"><span class="label">إجمالي الحسم</span><span class="value">${totalDeduction.toFixed(2)}</span></div>
        <div class="summary-item"><span class="label">إجمالي الغرامات</span><span class="value">${totalFine.toFixed(2)}</span></div>
        <div class="summary-item"><span class="label">صافي الاستحقاق</span><span class="value net-total">${centerNetTotal.toFixed(2)}</span></div>
        <div class="summary-item-divider">|</div>
        <div class="summary-item"><span class="label">حضور</span><span class="value">${centerData.length - employeesWithAbsence}</span></div>
        <div class="summary-item"><span class="label">غياب</span><span class="value">${employeesWithAbsence}</span></div>
    `;

    const specialOrder = ['ج', 'ش', 'ت', 'ب', 'ن', 'م', 'ع', 'ر'];
    specialOrder.forEach(status => {
        if (specialStatusCounts[status] > 0) {
            summaryHTML += `<div class="summary-item-divider">|</div><div class="summary-item"><span class="label">${STATUS_CODES[status].name}</span><span class="value">${specialStatusCounts[status]}</span></div>`;
        }
    });

    document.getElementById(`total-${centerKey}`).innerHTML = `<div class="table-summary-v2">${summaryHTML}</div>`;
    
    initializeAttendanceSelects(tbody);
}

/**
 * ✅ [مُحدّث] ينشئ قائمة منسدلة تحتوي على جميع حالات الحضور.
 */
/**
 * @description
 * ✅ [النسخة النهائية V3 - تصميم محسن] تنشئ قائمة منسدلة لحالات الحضور.
 * تقوم الآن بتلوين خلفية القائمة ولون النص تلقائيًا لتبدو كأنها نص ملون.
 * @param {string} currentStatus - الحالة الحالية للموظف (ح, غ, ج, ...).
 * @param {string} centerKey - مفتاح المركز.
 * @param {number} empIndex - فهرس الموظف.
 * @param {number} dayIndex - فهرس اليوم.
 * @returns {string} - كود HTML للقائمة المنسدلة مع التنسيقات المضمنة.
 */
function createAttendanceSelect(currentStatus, centerKey, empIndex, dayIndex) {
    let options = '';
    for (const code in STATUS_CODES) {
        if (code === 'default') continue;
        options += `<option value="${code}" ${code === currentStatus ? 'selected' : ''}>${code}</option>`;
    }
    const statusInfo = STATUS_CODES[currentStatus] || STATUS_CODES.default;
    return `<select class="attendance-select ${statusInfo.class}" onchange="updateEmployeeAttendance('${centerKey}', ${empIndex}, ${dayIndex}, this.value)">${options}</select>`;
}

/**
 * ✅ [النسخة النهائية V25 - الفئات الملونة والتفاعلية]
 * تقوم بتلوين الخلية، وحفظ التغيير، وتحديث الحسابات تلقائياً.
 */
function createCategorySelect(currentCategory, centerKey, empIndex) {
    const categories = [
        { value: '1', color: '#e74c3c' }, { value: '2', color: '#3498db' },
        { value: '3', color: '#2ecc71' }, { value: '4', color: '#f1c40f' },
        { value: '5', color: '#9b59b6' }, { value: '6', color: '#1abc9c' },
        { value: '7', color: '#e67e22' }
    ];
    
    const select = document.createElement('select');
    select.className = 'category-select';
    
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.value;
        option.textContent = cat.value;
        option.selected = String(cat.value) === String(currentCategory);
        select.appendChild(option);
    });
    
    const updateSelectColor = () => {
        const selectedCat = categories.find(c => c.value === select.value);
        if (selectedCat) {
            select.style.backgroundColor = selectedCat.color;
            select.style.color = (select.value === '4') ? '#333' : 'white';
        }
    };
    
    updateSelectColor();
    
    // ✅✅✅ هذا هو السطر الذي يحل كل شيء ✅✅✅
    select.onchange = function() {
        updateEmployeeField(centerKey, empIndex, 'category', this.value);
    };
    
    return select.outerHTML;
}
/**
 * @description
 * ✅ [النسخة النهائية V2 - ذكية] تنشئ قائمة منسدلة للجنسيات.
 * إذا كانت الجنسية الحالية للموظف غير موجودة في القائمة الافتراضية،
 * فإنها تضيفها تلقائيًا لضمان عرضها بشكل صحيح.
 * @param {string} currentNationality - الجنسية الحالية للموظف (من البيانات).
 * @param {string} centerKey - مفتاح المركز.
 * @param {number} empIndex - فهرس الموظف.
 * @returns {string} - كود HTML للقائمة المنسدلة.
 */
function createNationalitySelect(currentNationality, centerKey, empIndex) {
    // القائمة الأساسية للجنسيات
    const defaultNationalities = ['سعودي', 'مصري', 'هندي', 'باكستاني', 'فلبيني', 'بنجلادش', 'أخرى'];
    
    // إنشاء نسخة فريدة من القائمة لضمان عدم التكرار
    const nationalities = [...new Set(defaultNationalities)];

    // ✅ [التحسين الذكي]
    // التحقق مما إذا كانت جنسية الموظف الحالية موجودة في القائمة
    if (currentNationality && !nationalities.includes(currentNationality)) {
        // إذا لم تكن موجودة، قم بإضافتها إلى القائمة
        nationalities.push(currentNationality);
    }

    // بناء خيارات القائمة المنسدلة
    let options = '';
    nationalities.forEach(nat => {
        // تحديد الخيار المختار بناءً على جنسية الموظف الحالية
        options += `<option value="${nat}" ${nat === currentNationality ? 'selected' : ''}>${nat}</option>`;
    });

    // إرجاع كود HTML للقائمة المنسدلة
    return `<select class="nationality-select" onchange="updateEmployeeField('${centerKey}', ${empIndex}, 'nationality', this.value)">${options}</select>`;
}

// ✅✅✅ [الكود النهائي والمضمون] ✅✅✅
function updateEmployeeField(centerKey, empIndex, field, value) {
    let data = getAttendanceData();
    if (!data[centerKey]?.[empIndex]) return;

    data[centerKey][empIndex][field] = value;
    saveAttendanceData(data);

    populateAttendanceTableBody(centerKey); 
    calculateAndDisplayGrandTotal();
}

/**
 * ✅ [مُصلح V2] تحدث حالة حضور الموظف وتغير لون الخلية فوراً.
 */
/**
 * ✅ [مُصلح V3] تحدث حالة حضور الموظف وتغير لون القائمة المنسدلة فوراً.
 */
function updateEmployeeAttendance(centerKey, empIndex, dayIndex, newStatus) {
    let data = getAttendanceData();
    if (!data[centerKey]?.[empIndex]) return;
    
    const { daysInExtract } = getExtractPeriodDetails();
    if (!data[centerKey][empIndex].days || data[centerKey][empIndex].days.length !== daysInExtract) {
        data[centerKey][empIndex].days = Array(daysInExtract).fill('ح');
    }
    data[centerKey][empIndex].days[dayIndex] = newStatus;
    saveAttendanceData(data);
    
    populateAttendanceTableBody(centerKey); 
    calculateAndDisplayGrandTotal();
}
/**
 * ✅ [جديد] دالة مساعدة لتحديد لون النص المناسب (أسود أو أبيض) بناءً على لون الخلفية.
 */
function getContrastColor(hexColor) {
    if (!hexColor) return '#000000';
    const r = parseInt(hexColor.substr(1, 2), 16);
    const g = parseInt(hexColor.substr(3, 2), 16);
    const b = parseInt(hexColor.substr(5, 2), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#000000' : '#FFFFFF'; // إذا كانت الخلفية فاتحة، استخدم الأسود، وإلا الأبيض
}




function toggleAllCheckboxes(source, containerId) {
    const checkboxes = document.querySelectorAll(`#${containerId} .center-checkbox`);
    checkboxes.forEach(checkbox => checkbox.checked = source.checked);
}

function exportSelectedToExcel() {
    const selectedKeys = Array.from(document.querySelectorAll('#export-checkboxes input:checked')).map(cb => cb.value).filter(v => v);
    if (selectedKeys.length === 0) {
        alert("الرجاء اختيار مركز واحد على الأقل.");
        return;
    }
    const wb = XLSX.utils.book_new();
    const allData = getAttendanceData();
    const names = getCenterNames();
    const { daysInMonth, totalDaysInMonth } = getExtractPeriodDetails();
    selectedKeys.forEach(key => {
        const centerData = allData[key] || [];
        const sheetData = [];
        const headers = ['م', 'مسمى الوظيفة', 'الفئة', 'اسم شاغل الوظيفة', ...Array.from({length: daysInMonth}, (_, i) => i + 1), 'التكلفة الشهرية', 'حضور', 'غياب', 'الحسم', 'غرامة الغياب', 'صافي الاستحقاق', 'الجنسية', 'غرامة جنسية', 'رقم الإقامة/الهوية'];
        sheetData.push(headers);
        centerData.forEach((emp, index) => {
            const salary = parseFloat(emp.salary) || 0;
            const dailySalary = totalDaysInMonth > 0 ? salary / totalDaysInMonth : 0;
            const nationalityFine = parseFloat(emp.nationalityFine) || 0;
            let days = emp.days || Array(daysInMonth).fill('ح');
            let attendanceDays = 0, absenceDays = 0;
            days.forEach(day => {
                if (STATUS_CODES[day] && !STATUS_CODES[day].isAbsence) attendanceDays++;
                if (STATUS_CODES[day] && STATUS_CODES[day].isAbsence) absenceDays++;
            });
            const deduction = absenceDays * dailySalary;
            const fineConfig = ABSENCE_FINES_BY_CATEGORY[emp.category] || ABSENCE_FINES_BY_CATEGORY.default;
            const isSaudi = (emp.nationality || '').includes('سعودي');
            const absenceFine = absenceDays * (isSaudi ? fineConfig.saudi : fineConfig.non_saudi);
            const netSalary = salary - deduction - absenceFine - nationalityFine;
            const row = [index + 1, emp.jobTitle, emp.category, emp.name, ...days, salary, attendanceDays, absenceDays, deduction.toFixed(2), absenceFine.toFixed(2), netSalary.toFixed(2), emp.nationality, nationalityFine, emp.iqamaId];
            sheetData.push(row);
        });
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        XLSX.utils.book_append_sheet(wb, ws, names[key].substring(0, 30));
    });
    XLSX.writeFile(wb, 'تقرير_حضور_المراكز.xlsx');
    closeDialog();
}

/**
 * ✅ [مُصلح V2] يفتح نافذة تصدير Excel بتصميم احترافي وقائمة قابلة للتمرير.
 */
function openExportDialog() {
    const names = getCenterNames();
    let optionsHTML = '';
    Object.keys(names).forEach(key => {
        optionsHTML += `
            <div class="form-group-checkbox">
                <input type="checkbox" class="center-checkbox" value="${key}" id="export-${key}" checked>
                <label for="export-${key}">${names[key]}</label>
            </div>
        `;
    });

    const content = `
        <div class="dialog-header">
            <h3><i class="fas fa-file-excel"></i> تصدير جداول الحضور إلى Excel</h3>
            <span class="close" onclick="closeDialog('management-dialog')">×</span>
        </div>
        <div class="dialog-body">
            <div class="form-group-checkbox all-selector">
                <input type="checkbox" onchange="toggleAllCheckboxes(this, 'export-checkboxes')" id="export-all" checked>
                <label for="export-all"><strong>تحديد الكل / إلغاء تحديد الكل</strong></label>
            </div>
            <div id="export-checkboxes" class="checkbox-grid">${optionsHTML}</div>
        </div>
        <div class="dialog-footer">
            <div></div>
            <button class="btn btn-success" onclick="exportSelectedToExcel()"><i class="fas fa-download"></i> تصدير المحدد</button>
        </div>
    `;
    openDialog(content, 'management-dialog', true);
}

/**
 * ✅ [مُصلح V2] يفتح نافذة الطباعة بتصميم احترافي وقائمة قابلة للتمرير.
 */
/**
 * ✅ [النسخة المطورة V3]
 * تفتح نافذة الطباعة مع خيارات لتحديد التقارير المراد طباعتها لكل مركز.
 */
function openPrintDialog() {
    const names = getCenterNames();
    let centersHTML = '';
    Object.keys(names).forEach(key => {
        centersHTML += `
            <div class="form-group-checkbox">
                <input type="checkbox" class="center-checkbox" value="${key}" id="print-${key}" checked>
                <label for="print-${key}">${names[key]}</label>
            </div>
        `;
    });

    const content = `
        <div class="dialog-header">
            <h3><i class="fas fa-print"></i> طباعة التقارير المجمعة</h3>
            <span class="close" onclick="closeDialog('management-dialog')">×</span>
        </div>
        <div class="dialog-body">
            <fieldset>
                <legend>1. اختر المراكز</legend>
                <div class="form-group-checkbox all-selector">
                    <input type="checkbox" onchange="toggleAllCheckboxes(this, 'print-centers-checkboxes')" id="print-all-centers" checked>
                    <label for="print-all-centers"><strong>تحديد الكل / إلغاء تحديد الكل</strong></label>
                </div>
                <div id="print-centers-checkboxes" class="checkbox-grid">${centersHTML}</div>
            </fieldset>
            <fieldset>
                <legend>2. اختر التقارير للطباعة</legend>
                <div class="checkbox-grid">
                    <div class="form-group-checkbox">
                        <input type="checkbox" id="print-opt-attendance" checked>
                        <label for="print-opt-attendance">تقرير الحضور والانصراف</label>
                    </div>
                    <div class="form-group-checkbox">
                        <input type="checkbox" id="print-opt-performance" checked>
                        <label for="print-opt-performance">شهادة تقييم الأداء</label>
                    </div>
                    <div class="form-group-checkbox">
                        <input type="checkbox" id="print-opt-achievement" checked>
                        <label for="print-opt-achievement">شهادة الإنجاز</label>
                    </div>
                </div>
            </fieldset>
        </div>
        <div class="dialog-footer">
            <div></div>
            <button class="btn btn-success" onclick="printSelected()"><i class="fas fa-print"></i> بدء الطباعة</button>
        </div>
    `;
    openDialog(content, 'management-dialog', true);
}

/**
 * ✅ [النسخة النهائية V20 - مع استثناء فئات إدارية أخرى من طباعة الأداء]
 * 1. (استثناء ذكي): تتجاهل الآن طباعة "شهادة تقييم الأداء" تحديداً لفئة "فئات إدارية أخرى" حتى لو تم تحديدها.
 * 2. (بيانات محدثة): تضمن أن جميع البيانات المطبوعة (الحضور، الأداء، الإنجاز) يتم بناؤها لحظة الطباعة لتعكس آخر التحديثات.
 * 3. (تواقيع صحيحة): تم الحفاظ على الحل النهائي لمشكلة ظهور التواقيع بشكل صحيح في كل التقارير.
 * 4. (اتجاه الصفحات): تم الحفاظ على الحل النهائي لطباعة كل تقرير بالاتجاه الصحيح (أفقي أو عمودي).
 */
function printSelected() {
    // 1. جمع اختيارات المستخدم
    const selectedKeys = Array.from(document.querySelectorAll('#print-centers-checkboxes input:checked')).map(cb => cb.value);
    const printOptions = {
        attendance: document.getElementById('print-opt-attendance').checked,
        performance: document.getElementById('print-opt-performance').checked,
        achievement: document.getElementById('print-opt-achievement').checked
    };

    if (selectedKeys.length === 0 || (!printOptions.attendance && !printOptions.performance && !printOptions.achievement)) {
        alert("الرجاء اختيار مركز وتقرير واحد على الأقل للطباعة.");
        return;
    }
    closeDialog('management-dialog');

    // 2. تجهيز نافذة الطباعة مع كل الأنماط الممكنة في الهيدر
    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    const doc = printWindow.document;
    doc.write('<html><head><title>طباعة التقارير المجمعة</title>');
    doc.write('<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">'  );
    
    // وضع كل أنماط الطباعة هنا مرة واحدة لضمان الاستقرار
    doc.write(`
        <style>
            /* --- الأنماط العامة --- */
            body { font-family: 'Tajawal', Arial, sans-serif; direction: rtl; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .page-container { page-break-after: always; }

            /* --- تعريف اتجاهات الصفحات --- */
            @page { size: A4; }
            @page landscape-orientation { size: A4 landscape; margin: 0.5cm; }
            @page portrait-orientation-perf { size: A4 portrait; margin: 0.7cm; }
            @page portrait-orientation-ach { size: A4 portrait; margin: 0.8in; }

            .landscape-page { page: landscape-orientation; }
            .portrait-page-perf { page: portrait-orientation-perf; }
            .portrait-page-ach { page: portrait-orientation-ach; }

            /* --- أنماط الهيدر المشتركة --- */
            .printable-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 5px; margin-bottom: 5px; border-bottom: 1px solid #ccc; }
            .printable-header .logo { width: 55px; }
            .printable-header .header-text { text-align: center; flex-grow: 1; }
            .printable-header h1, .printable-header h2, .printable-header h3 { margin: 1px 0; font-size: 10pt; }
            .page-contract-info-v2 { font-size: 8pt; text-align: center; margin-bottom: 10px; padding: 5px; border: 1px solid #ccc; border-radius: 8px; }
            .header-table { width: 100%; border-bottom: 2px solid #0056b3; margin-bottom: 15px; }
            .header-table td { vertical-align: middle; text-align: center; }
            .header-table .logo { width: 75px; }
            .header-table .title-box { text-align: center; }
            .header-table .title-box h1, .header-table .title-box h2 { margin: 2px; }

            /* --- أنماط تقرير الحضور --- */
            .attendance-report .extract-details-v2 { font-size: 10pt; padding: 8px; background: linear-gradient(145deg, #003087, #0056b3 ) !important; color: #fff !important; border-radius: 8px 8px 0 0; margin-bottom: -1px; display: flex; justify-content: space-between; align-items: center; }
            .attendance-report table { width: 100%; border-collapse: collapse; table-layout: auto; }
            .attendance-report th, .attendance-report td { border: 1px solid #ccc; padding: 2px; text-align: center; font-size: 7pt; vertical-align: middle; white-space: nowrap; }
            .attendance-report th.job-title, .attendance-report td.job-title, .attendance-report th.employee-name, .attendance-report td.employee-name { font-size: 8pt; font-weight: 500; }
            .attendance-report thead th { background-color: #003087 !important; color: #fff !important; font-size: 8pt; }
            .attendance-report .table-summary-v2 { font-size: 8pt; padding: 5px; display: flex; flex-wrap: wrap; justify-content: center; gap: 15px; border: 1px solid #ccc; background-color: #f8f9fa; font-weight: bold; }
            .attendance-report .signatures-grid { display: flex; justify-content: space-around; margin-top: 15px; padding-top: 10px; border-top: 1px solid #ccc; }
            .attendance-report .signature-item { text-align: center; font-size: 9pt; }
            .attendance-report .signature-item .title { font-weight: bold; }
            .attendance-report .signature-item .line { border-bottom: 1px solid #000; min-height: 20px; margin-top: 20px; }
            .attendance-report .signature-item .name { font-size: 8pt; }

            /* --- أنماط تقرير الأداء --- */
            .performance-report .cert-title { font-size: 15pt; font-weight: bold; text-align: center; margin: 8px 0; }
            .performance-report .sub-title { font-size: 12pt; text-align: center; margin: 4px 0; }
            .performance-report .cost-bar { background: #f2f2f2; padding: 6px; border-radius: 4px; text-align: center; font-size: 11pt; font-weight: bold; margin: 8px 0; }
            .performance-report table { width: 100%; border-collapse: collapse; font-size: 9pt; table-layout: fixed; }
            .performance-report th, .performance-report td { border: 1px solid #333; padding: 4px; text-align: center; }
            .performance-report th { background: #e9ecef; }
            .performance-report .item-text { text-align: right; }
            .performance-report .summary { margin-top: 10px; font-size: 11pt; line-height: 1.5; }
            .performance-report .signatures { margin-top: 25px; display: flex; justify-content: space-around; border-top: 1px solid #333; padding-top: 10px; }
            .performance-report .sign-box { text-align: center; font-size: 10pt; width: 24%; }
            .performance-report .sign-box .line { border-bottom: 1px solid #000; margin-top: 30px; }

            /* --- أنماط شهادة الإنجاز --- */
            .achievement-report .certificate-header { text-align: center; margin-bottom: 20px; }
            .achievement-report .certificate-header h2, .achievement-report .certificate-header h3, .achievement-report .certificate-header p { margin: 5px 0; }
            .achievement-report table { width: 100%; border-collapse: collapse; font-size: 10pt; table-layout: fixed; }
            .achievement-report th, .achievement-report td { border: 1px solid #333; padding: 8px; text-align: center; vertical-align: middle; }
            .achievement-report th { background: #e9ecef; font-weight: 700; }
            .achievement-report .total-row td, .achievement-report .tafqeet-cell { font-weight: bold; background-color: #f0f0f0; }
            .achievement-report .signatures { margin-top: 40px; display: flex; justify-content: space-around; border-top: 1px solid #333; padding-top: 15px; }
            .achievement-report .sign-box { text-align: center; font-size: 11pt; width: 24%; }
            .achievement-report .sign-box .line { border-bottom: 1px solid #000; margin-top: 45px; }
        </style>
    `);
    doc.write('</head><body>');

    // 3. المرور على كل مركز وبناء صفحاته
    selectedKeys.forEach((centerKey) => {
        const centerName = getCenterNames()[centerKey];
        const { startDate, daysInExtract, totalDaysInMonth } = getExtractPeriodDetails();
        const extractData = JSON.parse(localStorage.getItem('persistentExtractData') || '{}');
        const monthName = new Date(extractData.extractStart || new Date()).toLocaleString('ar-SA-u-nu-latn-ca-gregory', { month: 'long', year: 'numeric' });
        const formatDate = (dateString) => new Date(dateString).toLocaleDateString('en-CA');
        
        const headerClone = document.querySelector('.header-info').cloneNode(true);
        const contractInfoClone = document.querySelector('.page-contract-info-v2').cloneNode(true);
        const headerHTML = `<div class="printable-header"><img src="${headerClone.querySelector('.logo-left')?.src}" class="logo"><div class="header-text"><h1>${headerClone.querySelector('h1')?.textContent}</h1><h3>${headerClone.querySelector('h3')?.textContent}</h3><h2>${headerClone.querySelector('h2')?.textContent}</h2></div><img src="${headerClone.querySelector('.logo-right')?.src}" class="logo"></div>`;
        const headerTableHTML = `<table class="header-table"><tr><td><img class="logo" src="${headerClone.querySelector('.logo-left')?.src}"></td><td class="title-box"><h1>${headerClone.querySelector('h1')?.textContent}</h1><h2>${headerClone.querySelector('h3')?.textContent}</h2></td><td><img class="logo" src="${headerClone.querySelector('.logo-right')?.src}"></td></tr></table>`;

        // =================================================================
        //  الجزء الأول: طباعة تقرير الحضور (الكود الكامل)
        // =================================================================
        if (printOptions.attendance) {
            const centerData = getAttendanceData()[centerKey] || [];
            let tableRows = '';
            let centerTotalCost = 0, centerNetTotal = 0, totalDeduction = 0, totalFine = 0;
            
            centerData.forEach((emp, index) => {
                let days = emp.days || Array(daysInExtract).fill('ح');
                if (days.length !== daysInExtract) days = Array(daysInExtract).fill('ح');
                const dayCells = days.map(day => `<td>${day}</td>`).join('');
                const salary = parseFloat(emp.salary) || 0;
                const dailyRate = totalDaysInMonth > 0 ? salary / totalDaysInMonth : 0;
                const costForPeriod = dailyRate * daysInExtract;
                let absenceDays = 0, attendanceDays = 0;
                days.forEach(d => { if(STATUS_CODES[d]?.isAbsence) { absenceDays++; } else { attendanceDays++; } });
                const deduction = absenceDays * dailyRate;
                const fineConfig = ABSENCE_FINES_BY_CATEGORY[emp.category] || ABSENCE_FINES_BY_CATEGORY.default;
                const isSaudi = (emp.nationality || '').includes('سعودي');
                const absenceFine = absenceDays * (isSaudi ? fineConfig.saudi : fineConfig.non_saudi);
                const nationalityFine = parseFloat(emp.nationalityFine) || 0;
                const netSalary = costForPeriod - deduction - absenceFine - nationalityFine;
                centerTotalCost += costForPeriod;
                totalDeduction += deduction;
                totalFine += absenceFine + nationalityFine;
                centerNetTotal += netSalary;
                tableRows += `<tr><td>${index + 1}</td><td class="job-title">${emp.jobTitle}</td><td>${emp.category}</td><td class="employee-name">${emp.name}</td>${dayCells}<td>${costForPeriod.toFixed(2)}</td><td>${attendanceDays}</td><td>${absenceDays}</td><td>${deduction.toFixed(2)}</td><td>${absenceFine.toFixed(2)}</td><td>${netSalary.toFixed(2)}</td><td>${emp.nationality}</td><td>${nationalityFine.toFixed(2)}</td><td>${emp.iqamaId || ''}</td></tr>`;
            });
            const daysHeader = Array.from({ length: daysInExtract }, (_, i) => `<th>${new Date(startDate.getTime() + i * 86400000).getDate()}</th>`).join('');
            const signatures = getSignatures('attendance').map(sig => `<div class="signature-item"><div class="title">${sig.title || ''}</div><div class="line"></div><div class="name">${sig.name || '................'}</div></div>`).join('');
            const summaryHTML = `<div class="table-summary-v2"><div class="summary-item"><span>عدد الموظفين:</span><span class="value">${centerData.length}</span></div><div class="summary-item"><span>التكلفة للفترة:</span><span class="value">${centerTotalCost.toFixed(2)}</span></div><div class="summary-item"><span>إجمالي الحسم:</span><span class="value">${totalDeduction.toFixed(2)}</span></div><div class="summary-item"><span>إجمالي الغرامات:</span><span class="value">${totalFine.toFixed(2)}</span></div><div class="summary-item net-total"><span>صافي الاستحقاق:</span><span class="value">${centerNetTotal.toFixed(2)}</span></div></div>`;
            const titleHTML = `<div class="extract-details-v2"><div class="title-main">بيان بالحضور والغياب لمنسوبي شركة (...) بمركز صحي ${centerName}</div><div class="title-period">الفترة (${formatDate(extractData.extractStart)}م - ${formatDate(extractData.extractEnd)}م)</div></div>`;

            const attendanceHtmlContent = `<div class="attendance-report">${headerHTML}${contractInfoClone.outerHTML}${titleHTML}${summaryHTML}<table><thead><tr><th rowspan="2">م</th><th rowspan="2" class="job-title">مسمى الوظيفة</th><th rowspan="2">الفئة</th><th rowspan="2" class="employee-name">اسم شاغل الوظيفة</th><th colspan="${daysInExtract}">الأيام</th><th rowspan="2">التكلفة</th><th colspan="2">الأيام</th><th colspan="2">الحسم والغرامة</th><th rowspan="2">الصافي</th><th rowspan="2">الجنسية</th><th rowspan="2">غرامة جنسية</th><th rowspan="2">الإقامة</th></tr><tr>${daysHeader}<th>حضور</th><th>غياب</th><th>الحسم</th><th>الغرامة</th></tr></thead><tbody>${tableRows}</tbody></table><div class="signatures-grid">${signatures}</div></div>`;
            doc.write(`<div class="page-container landscape-page">${attendanceHtmlContent}</div>`);
        }

        // =======================================================================
        //  الجزء الثاني: طباعة تقييم الأداء (الكود الكامل)
        // =======================================================================
        // ✅✅✅ [الحل هنا] إضافة شرط للتحقق من أن المركز ليس "فئات إدارية أخرى" ✅✅✅
        if (printOptions.performance && centerKey !== 'admin_staff') {
            const signatures = getSignatures('performance').map(sig => `<div class="sign-box"><div class="title">${sig.title}</div><div class="line"></div><div>${sig.name || '................'}</div></div>`).join('');
            const items = getDynamicPerformanceItems();
            const scores = getPerformanceData()[centerKey] || {};
            let performanceTableRows = '', maxTotal = 0, scoreTotal = 0;
            items.forEach((item, i) => {
                const score = scores[i] !== undefined ? scores[i] : item.max;
                performanceTableRows += `<tr><td>${i + 1}</td><td class="item-text">${item.text}</td><td>${item.max}</td><td>${score}</td></tr>`;
                maxTotal += item.max;
                scoreTotal += score;
            });
            performanceTableRows += `<tr style="font-weight:bold; background-color: #f0f0f0;"><td colspan="2">المجموع</td><td>${maxTotal}</td><td>${scoreTotal}</td></tr>`;
            const percentage = maxTotal > 0 ? (scoreTotal / maxTotal * 100) : 100;
            let deductionPercentage = 0;
            if (percentage < 60) deductionPercentage = 15; else if (percentage < 65) deductionPercentage = 10; else if (percentage < 70) deductionPercentage = 8; else if (percentage < 75) deductionPercentage = 6; else if (percentage < 80) deductionPercentage = 4; else if (percentage < 85) deductionPercentage = 2;
            const centerCost = calculateCenterTotalCost(centerKey);
            const deductionAmount = (centerCost * deductionPercentage / 100);
            const summaryHTML = `<p>التقدير الذي حصل عليه المقاول: <b>${percentage.toFixed(2)}%</b>، نسبة الحسم: <b>${deductionPercentage}%</b>، ويساوي: <b>${deductionAmount.toFixed(2)} ريال</b></p>`;
            
            const performanceHtmlContent = `<div class="performance-report">${headerTableHTML}<div class="cert-title">جدول تقييم مستوى الأداء والإنجاز</div><div class="sub-title">لمركز: ${centerName} - عن شهر ${monthName}</div><div class="cost-bar">إجمالي المبلغ لأنشطة القسم: ${centerCost.toFixed(2)} ريال</div><table><thead><tr><th>م</th><th style="width:65%">أنشطة القسم</th><th>الدرجة القصوى</th><th>التقدير</th></tr></thead><tbody>${performanceTableRows}</tbody></table><div class="summary">${summaryHTML}</div><div class="signatures">${signatures}</div></div>`;
            doc.write(`<div class="page-container portrait-page-perf">${performanceHtmlContent}</div>`);
        }

        // =======================================================================
        //  الجزء الثالث: طباعة شهادة الإنجاز (الكود الكامل)
        // =======================================================================
        if (printOptions.achievement) {
            const titles = getAchievementTitles();
            const signatures = getSignatures('achievement').map(sig => `<div class="sign-box"><div>${sig.title}</div><div class="line"></div><div>${sig.name || '................'}</div></div>`).join('');
            const centerData = getAttendanceData()[centerKey] || [];
            let monthly = 0, absenceDeduct = 0, absencePenalty = 0, nationPenalty = 0;
            if (centerData.length > 0) {
                const contractData = JSON.parse(localStorage.getItem('persistentContractData') || '{}');
                const directPurchaseRatio = parseFloat(contractData.directPurchaseRatio) || 0;
                centerData.forEach(emp => {
                    const salary = parseFloat(emp.salary) || 0;
                    let adjustedSalary = salary + (salary * (directPurchaseRatio / 100));
                    monthly += adjustedSalary;
                    const dailySalary = totalDaysInMonth > 0 ? adjustedSalary / totalDaysInMonth : 0;
                    const absenceDays = (emp.days || []).filter(d => STATUS_CODES[d]?.isAbsence).length;
                    const fineConfig = ABSENCE_FINES_BY_CATEGORY[emp.category] || ABSENCE_FINES_BY_CATEGORY.default;
                    absenceDeduct += absenceDays * dailySalary;
                    absencePenalty += absenceDays * ((emp.nationality || '').includes('سعودي') ? fineConfig.saudi : fineConfig.non_saudi);
                    nationPenalty += parseFloat(emp.nationalityFine) || 0;
                });
            }
            // ✅✅✅ [الحل هنا] التأكد من أن حسم الأداء لا يطبق على فئات إدارية أخرى ✅✅✅
            const perfPenalty = (centerKey !== 'admin_staff') ? ((JSON.parse(localStorage.getItem('performanceDeductions') || '{}'))[centerKey] || 0) : 0;
            const net = monthly - absenceDeduct - absencePenalty - perfPenalty - nationPenalty;
            const toSAR = (val) => val.toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' });
            const achievementTableRows = `<tr><td>العمالة</td><td>${toSAR(monthly)}</td><td>${toSAR(absenceDeduct)}</td><td>${toSAR(absencePenalty)}</td><td>${toSAR(perfPenalty)}</td><td>${toSAR(nationPenalty)}</td><td><b>${toSAR(net)}</b></td></tr><tr class="total-row"><td colspan="6">إجمالي المستحق للمقاول</td><td><b>${toSAR(net)}</b></td></tr><tr class="tafqeet-cell"><td colspan="7">فقط وقدره: ${tafqit(net)}</td></tr>`;

            const achievementHtmlContent = `<div class="achievement-report">${headerTableHTML}<div class="certificate-header"><h2>${titles.mainTitle}</h2><h3 style="font-weight: normal;">${titles.subTitle}</h3><h3>لمركز: ${centerName} - عن شهر ${monthName}</h3></div><table><thead><tr><th>البند</th><th>القيمة الشهرية</th><th>حسم الغياب</th><th>غرامة الغياب</th><th>غرامة الأداء</th><th>غرامة الجنسية</th><th>الصافي الشهري</th></tr></thead><tbody>${achievementTableRows}</tbody></table><div class="signatures">${signatures}</div></div>`;
            doc.write(`<div class="page-container portrait-page-ach">${achievementHtmlContent}</div>`);
        }
    });

    doc.write('</body></html>');
    doc.close();

    // 4. تنفيذ الطباعة
    printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
        if (typeof backToGrid === 'function') {
            backToGrid();
        }
    };
}

// --- 8. BACKUP & RESTORE ---
/**
 * ✅ [النسخة النهائية V23 - مع مفاتيح موحدة للحفظ]
 */
function backupData() {
    try {
        const backupObject = {
            version: "4.0", // رقم إصدار جديد
            createdAt: new Date().toISOString(),
            data: {
                // ✅ استخدام الأسماء الصحيحة والموحدة
                centersAttendanceData_v2: getAttendanceData(),
                centerNames_v3: getCenterNames(),
                persistentContractData: JSON.parse(localStorage.getItem('persistentContractData') || '{}'),
                persistentExtractData: JSON.parse(localStorage.getItem('persistentExtractData') || '{}'),
                
                // التوافق مع نظام التواقيع الجديد
                signatures_attendance: getSignatures('attendance'),
                signatures_performance: getSignatures('performance'),
                signatures_achievement: getSignatures('achievement'),

                // بيانات الأداء (إذا كانت موجودة)
                performanceData_v4: JSON.parse(localStorage.getItem('performanceData_v4') || '{}'),
                performanceDeductions: JSON.parse(localStorage.getItem('performanceDeductions') || '{}')
            }
        };
        const jsonString = JSON.stringify(backupObject, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const date = new Date().toISOString().slice(0, 10);
        a.download = `health-centers-backup-${date}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showSuccessMessage("تم إنشاء نسخة احتياطية شاملة بنجاح!");
    } catch (error) {
        console.error("فشل في إنشاء النسخة الاحتياطية:", error);
        alert("حدث خطأ أثناء محاولة إنشاء النسخة الاحتياطية.");
    }
}

/**
 * ✅ [النسخة النهائية V23 - مع مفاتيح موحدة للاستعادة]
 */
function restoreData(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!confirm("هل أنت متأكد؟ سيتم استبدال جميع البيانات الحالية ببيانات الملف.")) {
        event.target.value = '';
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const restored = JSON.parse(e.target.result);
            const restoredData = restored.data;

            // ✅ التحقق من وجود البيانات الأساسية بالأسماء الصحيحة
            if (restoredData && restoredData.centersAttendanceData_v2 && restoredData.centerNames_v3) {
                
                // حفظ البيانات في الأماكن الصحيحة
                saveAttendanceData(restoredData.centersAttendanceData_v2);
                saveCenterNames(restoredData.centerNames_v3);
                
                if (restoredData.persistentContractData) localStorage.setItem('persistentContractData', JSON.stringify(restoredData.persistentContractData));
                if (restoredData.persistentExtractData) localStorage.setItem('persistentExtractData', JSON.stringify(restoredData.persistentExtractData));
                
                if (restoredData.signatures_attendance) saveSignatures(restoredData.signatures_attendance, 'attendance');
                if (restoredData.signatures_performance) saveSignatures(restoredData.signatures_performance, 'performance');
                if (restoredData.signatures_achievement) saveSignatures(restoredData.signatures_achievement, 'achievement');

                if (restoredData.performanceData_v4) localStorage.setItem('performanceData_v4', JSON.stringify(restoredData.performanceData_v4));
                if (restoredData.performanceDeductions) localStorage.setItem('performanceDeductions', JSON.stringify(restoredData.performanceDeductions));

                alert("تم استعادة البيانات بنجاح! سيتم إعادة تحميل الصفحة لتطبيق كل التغييرات.");
                window.location.reload();
            } else {
                throw new Error("ملف النسخ الاحتياطي غير صالح أو لا يحتوي على البيانات المطلوبة (centersAttendanceData_v2, centerNames_v3).");
            }
        } catch (error) {
            alert(`فشل في استعادة البيانات: ${error.message}`);
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsText(file);
}

// ===================================================================
// --- 9. SIGNATURE MANAGEMENT (UNIFIED & SEPARATED) ---
// هذا هو النظام المحدث الذي يفصل التواقيع حسب طلبك
// ===================================================================

/**
 * دالة مركزية لجلب التواقيع من الذاكرة.
 * @param {string} type - المفتاح الكامل للتواقيع (مثال: 'attendance', 'attendance_special_center_72').
 * @returns {Array} - مصفوفة التواقيع.
 */
function getSignatures(type) {
    const key = `healthCenters_Signatures_${type}_v2`;
    try {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.error(`خطأ في قراءة التواقيع للمفتاح: ${key}`, e);
        return [];
    }
}
/**
 * دالة مركزية لحفظ التواقيع في الذاكرة.
 * @param {Array} signatures - مصفوفة التواقيع الجديدة.
 * @param {string} type - المفتاح الكامل للتواقيع.
 */
function saveSignatures(signatures, type) {
    const key = `healthCenters_Signatures_${type}_v2`;
    localStorage.setItem(key, JSON.stringify(signatures));
}
/**
 * تفتح نافذة تعديل التواقيع.
 * هذه الدالة أصبحت الآن ذكية وتعرف أي مجموعة تواقيع يجب أن تعرضها للتعديل.
 * @param {string} type - نوع التقرير الأساسي (attendance, performance, achievement).
 * @param {string|null} contextKey - مفتاح المركز أو القسم (مثال: 'center_1', 'admin_staff', 'grand_certificate').
 */
function openSignatureDialog(type, contextKey = null) {
    // --- 1. تحديد مفتاح التواقيع الصحيح الذي سيتم تعديله ---
    const signatureTypeKey = getSignatureKeyForContext(type, contextKey);
    
    // --- 2. تحديد عنوان وصفي للنافذة ---
    const dialogTitle = getSignatureDialogTitle(type, contextKey);

    // --- 3. بناء محتوى النافذة المنبثقة ---
    const content = `
        <div class="dialog-header">
            <h3><i class="fas fa-signature"></i> ${dialogTitle}</h3>
            <span class="close" onclick="closeDialog('signature-dialog')">×</span>
        </div>
        <div class="dialog-body" id="signature-fields-container">
            <!-- الحقول ستضاف هنا بواسطة populateSignatureEditor -->
        </div>
        <div class="dialog-footer">
            <button class="btn btn-primary" onclick="addSignatureField(false, '', '', '${signatureTypeKey}')"><i class="fas fa-plus"></i> إضافة توقيع جديد</button>
            <div class="footer-actions">
                <button class="btn btn-success" onclick="saveSignatureChanges('${signatureTypeKey}', '${type}', '${contextKey || ''}')"><i class="fas fa-save"></i> حفظ التواقيع</button>
                <button class="btn btn-secondary" onclick="closeDialog('signature-dialog')">إلغاء</button>
            </div>
        </div>
    `;
    
    openDialog(content, 'signature-dialog', true);
    
    // --- 4. ملء النافذة بالبيانات الصحيحة ---
    populateSignatureEditor(signatureTypeKey); 
}

/**
 * تعرض حقول تعديل التواقيع في النافذة المنبثقة.
 * @param {string} signatureTypeKey - المفتاح الكامل للتواقيع.
 */
function populateSignatureEditor(signatureTypeKey) {
    const container = document.getElementById('signature-fields-container');
    const signatures = getSignatures(signatureTypeKey);
    container.innerHTML = '';

    if (signatures.length === 0) {
        addSignatureField(true, 'مدير المشروع', '', signatureTypeKey);
        addSignatureField(true, 'رئيس قسم الصيانة', '', signatureTypeKey);
        addSignatureField(true, 'مندوب المقاول', '', signatureTypeKey);
    } else {
        signatures.forEach(sig => addSignatureField(true, sig.title, sig.name, signatureTypeKey));
    }
}
/**
 * تضيف حقلاً جديداً (مسمى واسم) في نافذة تعديل التواقيع.
 */
function addSignatureField(isInitial = false, title = '', name = '', type) {
    const container = document.getElementById('signature-fields-container');
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'signature-field-item';
    fieldDiv.innerHTML = `
        <input type="text" class="sig-title" placeholder="المسمى الوظيفي" value="${title}">
        <input type="text" class="sig-name" placeholder="الاسم" value="${name}">
        <label style="display:flex;align-items:center;margin-right:10px;font-size:12px;">
            <input type="checkbox" class="show-stamp-checkbox" ${isInitial || !title ? 'checked' : ''}>
            إظهار الختم
        </label>
        <button class="btn-danger" onclick="this.parentElement.remove()">حذف</button>
    `;
    container.appendChild(fieldDiv);
}function saveSignatureChanges(signatureTypeKey, originalType, contextKey) {
    const fields = document.querySelectorAll('#signature-fields-container .signature-field-item');
    const newSignatures = Array.from(fields).map(field => {
        const title = field.querySelector('.sig-title').value.trim();
        const name  = field.querySelector('.sig-name').value.trim();
        const showStamp = field.querySelector('.show-stamp-checkbox').checked;
        return { title, name, showStamp };
    }).filter(sig => sig.title); // تجاهل الحقول الفارغة

    saveSignatures(newSignatures, signatureTypeKey);
    closeDialog('signature-dialog');
    showSuccessMessage("تم حفظ التواقيع بنجاح.");

    displaySignatures(originalType, contextKey);
}

/**
 * تعرض التواقيع في المكان الصحيح على الصفحة.
 * @param {string} type - نوع التقرير الأساسي.
 * @param {string|null} contextKey - مفتاح المركز أو القسم.
 */
/**
 * ✅ [مُحدّث] يعرض التواقيع مع إضافة مساحة مخصصة للختم.
 */
function displaySignatures(type, contextKey = null) {
    let container;
    if (contextKey === 'grand_certificate') {
        container = document.getElementById('grand-cert-signatures');
    } else if (contextKey) {
        if (type === 'attendance') container = document.getElementById(`attendance-signatures-${contextKey}`);
        else if (type === 'performance') container = document.getElementById(`perf-signatures-${contextKey}`);
        else if (type === 'achievement') container = document.getElementById(`ach-signatures-${contextKey}`);
    } else {
        container = document.querySelector('#main-signatures-section .signatures-grid');
    }
    if (!container) return;

    const signatureTypeKey = getSignatureKeyForContext(type, contextKey);
    let signatures = getSignatures(signatureTypeKey);

    if (signatures.length === 0) {
        signatures = [
            { title: 'مدير المشروع', name: '', showStamp: true },
            { title: 'رئيس قسم الصيانة', name: '', showStamp: true },
            { title: 'مندوب المقاول', name: '', showStamp: true }
        ];
    }

    container.className = 'signatures-display-section signatures-grid';
    container.innerHTML = '';

    signatures.forEach(sig => {
        const showStamp = type === 'achievement' && sig.showStamp !== false;
        container.innerHTML += `
            <div class="signature-block-display" data-show-stamp="${showStamp}">
                <div class="signature-area-display">
                    <div class="title">${sig.title || 'مسمى وظيفي'}</div>
                    <div class="line"></div>
                    <div class="name">${sig.name || '..............................'}</div>
                </div>
                ${showStamp ? `
                <div class="stamp-area-display">
                    <div class="stamp-box-display">
                        <span>الختم</span>
                    </div>
                </div>` : ''}
            </div>
        `;
    });
}

// --- دوال مساعدة ذكية (Helper Functions) ---

/**
 * الدالة الأهم: تحدد المفتاح الفريد الذي سيتم استخدامه للحفظ والعرض.
 * @param {string} type - نوع التقرير.
 * @param {string|null} contextKey - مفتاح المركز أو القسم.
 * @returns {string} - المفتاح النهائي للتواقيع.
 */
function getSignatureKeyForContext(type, contextKey) {
    // قائمة الأقسام التي لها تواقيع فريدة
    const uniqueSignatureKeys = {
        'grand_certificate': 'achievement_grand_certificate', // الشهادة الإجمالية
        'center_72': `${type}_special_mobile_team`,         // مكتب إداري 73
        'admin_staff': `${type}_special_admin_jobs`,        // فئات إدارية أخرى
        'center_70': `${type}_special_nursing_home`         // سكن التمريض
    };

    // إذا كان السياق الحالي أحد الأقسام الخاصة، نرجع المفتاح الفريد الخاص به
    if (contextKey && uniqueSignatureKeys[contextKey]) {
        return uniqueSignatureKeys[contextKey];
    }

    // إذا لم يكن كذلك، نرجع المفتاح العادي (العام)
    return `${type}_general`;
}

/**
 * تحدد عنواناً مناسباً لنافذة تعديل التواقيع.
 */
function getSignatureDialogTitle(type, contextKey) {
    const centerNames = getCenterNames();
    const titles = {
        'grand_certificate': 'تواقيع الشهادة الإجمالية',
        'center_72': `تواقيع: ${centerNames['center_72'] || 'مكتب إداري 73'}`,
        'admin_staff': `تواقيع: ${centerNames['admin_staff'] || 'فئات إدارية أخرى'}`,
        'center_70': `تواقيع: ${centerNames['center_70'] || 'سكن التمريض'}`
    };

    if (contextKey && titles[contextKey]) {
        return titles[contextKey];
    }
    
    return `التواقيع العامة (لباقي المراكز)`;
}

// --- 10. UTILITY & TOTALS ---
function showSuccessMessage(message) {
    const div = document.createElement('div');
    div.className = 'success-toast';
    div.textContent = message;
    document.body.appendChild(div);
    setTimeout(() => {
        div.remove();
    }, 3000);
}

function clearAllData() {
    const password = prompt("لمسح جميع البيانات، يرجى إدخال كلمة المرور:");
    if (password !== PASSWORD) {
        if (password !== null) alert("كلمة المرور غير صحيحة.");
        return;
    }
    if (confirm("تحذير: هل أنت متأكد من رغبتك في مسح جميع بيانات الموظفين، المراكز، والتواقيع؟ لا يمكن التراجع عن هذا الإجراء.")) {
        localStorage.removeItem('adminOfficesAttendanceData_v1');
        localStorage.removeItem('adminOfficeNames_v1');
        localStorage.removeItem('performanceData_v4');
        localStorage.removeItem('performanceDeductions');
        localStorage.removeItem('healthCenters_Signatures_attendance_v1');
        localStorage.removeItem('healthCenters_Signatures_performance_v1');
        localStorage.removeItem('healthCenters_Signatures_achievement_v1');
        alert("تم مسح جميع البيانات بنجاح. سيتم إعادة تحميل الصفحة.");
        window.location.reload();
    }
}

/**
 * ✅ [النسخة النهائية V5 - تشمل فئات إدارية أخرى]
 * تحسب الإجمالي العام لجميع المكاتب الإدارية **بما في ذلك فئات إدارية أخرى**،
 * مع الأخذ في الاعتبار عدد أيام المستخلص الفعلية ونسبة الشراء المباشر.
 * وتقوم بحفظ صافي الاستحقاق في localStorage لصفحة المستهلكات.
 */
function calculateAndDisplayGrandTotal() {
    // --- 1. جلب كل البيانات اللازمة ---
    const allData = getAttendanceData();
    const { totalDaysInMonth, daysInExtract } = getExtractPeriodDetails();
    const contractData = JSON.parse(localStorage.getItem('persistentContractData') || '{}');
    const contractType = contractData.contractType || 'عقد أساسي';
    const directPurchaseRatio = parseFloat(contractData.directPurchaseRatio) || 0;

    // --- 2. تهيئة متغيرات الإجماليات ---
    let grandTotalCount = 0;
    let grandTotalCost = 0;
    let grandTotalDeduction = 0;
    let grandTotalFines = 0;
    let grandNetTotal = 0;

    // --- 3. المرور على كل المراكز والموظفين (بما في ذلك الإداريين) ---
    for (const centerKey in allData) {
        // ✅ [تم التعديل هنا] تم حذف السطر الذي يستثني 'admin_staff'
        // الآن سيتم تضمين جميع الفئات في الحساب.

        const centerData = allData[centerKey] || [];
        grandTotalCount += centerData.length;

        centerData.forEach(emp => {
            // --- أ. حساب التكلفة الفعلية للموظف خلال فترة المستخلص ---
            const fullMonthSalary = parseFloat(emp.salary) || 0;
            const dailyRate = totalDaysInMonth > 0 ? fullMonthSalary / totalDaysInMonth : 0;
            let actualCostForPeriod = dailyRate * daysInExtract;

            // إضافة نسبة الشراء المباشر إذا كان العقد من هذا النوع
            if (contractType === 'شراء مباشر' && directPurchaseRatio > 0) {
                actualCostForPeriod += actualCostForPeriod * (directPurchaseRatio / 100);
            }
            
            // --- ب. حساب الحسميات والغرامات ---
            const nationalityFine = parseFloat(emp.nationalityFine) || 0;
            const absenceDays = (emp.days || []).filter(day => STATUS_CODES[day]?.isAbsence).length;
            
            const deduction = absenceDays * dailyRate; 
            
            const fineConfig = ABSENCE_FINES_BY_CATEGORY[emp.category] || ABSENCE_FINES_BY_CATEGORY.default;
            const isSaudi = (emp.nationality || '').includes('سعودي');
            const absenceFine = absenceDays * (isSaudi ? fineConfig.saudi : fineConfig.non_saudi);
            
            // --- ج. حساب الصافي وتجميع الإجماليات ---
            const netSalary = actualCostForPeriod - deduction - absenceFine - nationalityFine;

            grandTotalCost += actualCostForPeriod;
            grandTotalDeduction += deduction;
            grandTotalFines += absenceFine + nationalityFine;
            grandNetTotal += netSalary;
        });
    }

    // --- 4. تحديث العرض في واجهة المستخدم ---
    document.getElementById('grand-total-count').textContent = grandTotalCount;
    document.getElementById('grand-total-cost').textContent = grandTotalCost.toFixed(2);
    document.getElementById('grand-total-deduction').textContent = grandTotalDeduction.toFixed(2);
    document.getElementById('grand-total-fines').textContent = grandTotalFines.toFixed(2);
    document.getElementById('grand-net-total').textContent = grandNetTotal.toFixed(2);

    // --- 5. [مهم للربط] حفظ صافي الاستحقاق الإجمالي (الذي يشمل الآن كل شيء) ---
    localStorage.setItem('grand-net-total', grandNetTotal.toFixed(2));
}


// --- A. Editable Titles Logic (الآن في الملف الصحيح) ---

const DEFAULT_TITLES = {
    attendanceMainTitle: "بيان بالحضور والغياب لمنسوبي شركة ({companyName})",
    performanceMainTitle: "جدول تقييم مستوى الأداء والإنجاز",
    achievementMainTitle: "شهادة الاستحقاق الشهري للعمالة",
    achievementSubTitle: "لأعمال النظافة والصيانة والتشغيل غير الطبي",
    grandMainTitle: "الشهادة الإجمالية المجمعة للمراكز الصحية",
    grandSubTitle: "لأعمال النظافة والصيانة والتشغيل غير الطبي"
};

function getAppTitles() {
    const storedTitles = localStorage.getItem('appTitles_v1');
    return storedTitles ? JSON.parse(storedTitles) : DEFAULT_TITLES;
}

function saveAppTitles(titles) {
    localStorage.setItem('appTitles_v1', JSON.stringify(titles));
}

function openTitleEditorDialog() {
    const titles = getAppTitles();
    const content = `
        <div class="dialog-header"><h3><i class="fas fa-heading"></i> تعديل العناوين الرئيسية</h3><span class="close" onclick="closeDialog('management-dialog')">×</span></div>
        <div class="dialog-body">
            <h4><i class="fas fa-calendar-check"></i> عناوين جدول الحضور</h4>
            <div class="form-group"><label>العنوان الرئيسي (استخدم {companyName}, {centerName}, {startDate}, {endDate} كمتغيرات):</label><input type="text" id="edit-att-main" value="${titles.attendanceMainTitle}"></div>
            
            <hr><h4 style="margin-top:20px;"><i class="fas fa-chart-line"></i> عناوين تقييم الأداء</h4>
            <div class="form-group"><label>العنوان الرئيسي:</label><input type="text" id="edit-perf-main" value="${titles.performanceMainTitle}"></div>

            <hr><h4 style="margin-top:20px;"><i class="fas fa-file-invoice-dollar"></i> عناوين شهادة الإنجاز</h4>
            <div class="form-group"><label>العنوان الرئيسي (فردي):</label><input type="text" id="edit-ach-main" value="${titles.achievementMainTitle}"></div>
            <div class="form-group"><label>العنوان الفرعي (فردي):</label><input type="text" id="edit-ach-sub" value="${titles.achievementSubTitle}"></div>

            <hr><h4 style="margin-top:20px;"><i class="fas fa-globe"></i> عناوين الشهادة الإجمالية</h4>
            <div class="form-group"><label>العنوان الرئيسي (إجمالي):</label><input type="text" id="edit-grand-main" value="${titles.grandMainTitle}"></div>
            <div class="form-group"><label>العنوان الفرعي (إجمالي):</label><input type="text" id="edit-grand-sub" value="${titles.grandSubTitle}"></div>
        </div>
        <div class="dialog-footer">
            <div></div>
            <div class="footer-actions">
                <button class="btn btn-success" onclick="saveEditedTitles()"><i class="fas fa-save"></i> حفظ كل العناوين</button>
                <button class="btn btn-secondary" onclick="closeDialog('management-dialog')">إغلاق</button>
            </div>
        </div>
    `;
    openDialog(content, 'management-dialog', true);
}

function saveEditedTitles() {
    const newTitles = {
        attendanceMainTitle: document.getElementById('edit-att-main').value,
        performanceMainTitle: document.getElementById('edit-perf-main').value,
        achievementMainTitle: document.getElementById('edit-ach-main').value,
        achievementSubTitle: document.getElementById('edit-ach-sub').value,
        grandMainTitle: document.getElementById('edit-grand-main').value,
        grandSubTitle: document.getElementById('edit-grand-sub').value
    };
    saveAppTitles(newTitles);
    closeDialog('management-dialog');
    showSuccessMessage("تم حفظ العناوين بنجاح!");
}

// --- B. Tafqeet Function (الآن في الملف الصحيح) ---
function tafqit(number) {
    if (isNaN(number)) return "خطأ في المبلغ";
    if (number === 0) return "صفر ريال سعودي";
    const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"], tens = ["", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"], teens = ["", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"], hundreds = ["", "مائة", "مئتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"], scales = ["", "ألف", "مليون", "مليار"];
    function convertGroup(n){let t="",e=Math.floor(n/100),a=Math.floor(n%100/10),r=n%10;return e>0&&(t+=(t?" و":"")+hundreds[e]),a>1?(r>0&&(t+=(t?" و":"")+ones[r]),t+=(t?" و":"")+tens[a]):1==a?t+=(t?" و":"")+teens[r]:r>0&&(t+=(t?" و":"")+ones[r]),t}let intPart=Math.floor(number),fracPart=Math.round(100*(number-intPart)),result=[],i=0;for(;intPart>0;){const t=intPart%1e3;t>0&&result.unshift((1==t&&i>0?scales[i]:2==t&&i>0?"ألفان"==scales[i]?"ألفان":scales[i]+"ان":t>=3&&t<=10&&i>0?convertGroup(t)+" "+("ألف"==scales[i]?"آلاف":scales[i]+"ات"):convertGroup(t)+(i>0?" "+scales[i]:"")).trim()),intPart=Math.floor(intPart/1e3),i++}let finalResult=result.join(" و ");return finalResult&&(finalResult+=" ريال سعودي"),fracPart>0&&(finalResult+=(finalResult?" و":"")+convertGroup(fracPart)+" هللة"),finalResult.trim()
}

// --- C. Grand Certificate Logic (الآن ستعمل بدون أخطاء) ---
/**
 * ✅ [مُصحح] وظيفة لتحديث لون قائمة منسدلة واحدة بناءً على قيمتها الحالية.
 * @param {HTMLSelectElement} selectElement - عنصر القائمة المنسدلة.
 */
function updateSelectColor(selectElement) {
    if (!selectElement) return;
    const classList = selectElement.classList;
    classList.remove('present', 'absent', 'leave', 'status-sh', 'status-t', 'status-b', 'status-n', 'default');

    const selectedValue = selectElement.value;
    switch (selectedValue) {
        case 'ح': classList.add('present'); break;
        case 'غ': classList.add('absent'); break;
        case 'ج': classList.add('leave'); break;
        case 'ش': classList.add('status-sh'); break;
        case 'ت': classList.add('status-t'); break;
        case 'ب': classList.add('status-b'); break;
        case 'ن': classList.add('status-n'); break;
        default: classList.add('default'); break;
    }
}

/**
 * ✅ [مُصحح] وظيفة لإعداد جميع قوائم الحضور في حاوية معينة.
 * @param {HTMLElement} container - الحاوية التي تحتوي على الجدول (عادة tbody).
 */
function initializeAttendanceSelects(container) {
    if (!container) return;
    // العثور على جميع قوائم الحضور في الحاوية المحددة
    const allSelects = container.querySelectorAll('.attendance-select');

    allSelects.forEach(select => {
        // 1. تطبيق اللون الأولي عند تحميل الصفحة
        updateSelectColor(select);

        // 2. إضافة مستمع حدث "change" لتحديث اللون عند كل تغيير
        // (ملاحظة: هذا احتياطي، لأن onchange في HTML يقوم بإعادة بناء الجدول)
        select.addEventListener('change', function() {
            updateSelectColor(this);
        });
    });
}

// عند تحميل الصفحة لأول مرة، قم بتشغيل وظائف التلوين على أي قوائم موجودة
document.addEventListener('DOMContentLoaded', function() {
    initializeAttendanceSelects(document.body);
});
/**
 * ✅ [النسخة النهائية V20 - مع الأعمدة المتكيفة مع المحتوى]
 * تستخدم table-layout: auto لتجعل الأعمدة تتوسع تلقائياً.
 */
function preparePrint() {
    const originalTabContent = document.getElementById('attendance-tab');
    if (!originalTabContent) {
        alert("خطأ: لم يتم العثور على محتوى التبويب للطباعة.");
        return;
    }

    const headerClone = document.querySelector('.header-info').cloneNode(true);
    const contractInfoClone = document.querySelector('.page-contract-info-v2').cloneNode(true);
    const tabContentClone = originalTabContent.cloneNode(true);

    tabContentClone.querySelectorAll('.tab-action-buttons, .no-print').forEach(el => el.remove());
    tabContentClone.querySelectorAll('select, input').forEach(el => {
        const span = document.createElement('span');
        span.textContent = el.value;
        span.style.cssText = el.style.cssText;
        span.className = el.className;
        span.style.display = 'inline-block';
        span.style.width = '100%';
        span.style.height = '100%';
        span.style.padding = '3px';
        span.style.boxSizing = 'border-box';
        el.parentNode.replaceChild(span, el);
    });

    const printWindow = window.open('', '', 'width=1200,height=900');
    const doc = printWindow.document;

    doc.write(`
        <html>
        <head>
            <title>طباعة تقرير الحضور</title>
            <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
            <style>
                @page { size: A4 landscape; margin: 1cm; }
                body { font-family: 'Tajawal', Arial, sans-serif; direction: rtl; zoom: 75%; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                
                .printable-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; margin-bottom: 10px; border-bottom: 1px solid #ccc; }
                .printable-header .logo { width: 60px; }
                .printable-header .header-text { text-align: center; flex-grow: 1; }
                .printable-header h1 { font-size: 14pt; color: #000; } .printable-header h2, .printable-header h3 { font-size: 11pt; color: #555; margin: 2px 0; }
                
                .page-contract-info-v2 { font-size: 9pt; text-align: center; margin-bottom: 15px; border: 1px solid #ccc; padding: 8px; border-radius: 8px; }
                
                .extract-details-v2 { padding: 10px; background: linear-gradient(145deg, #003087, #0056b3 ) !important; color: #fff !important; border-radius: 8px 8px 0 0; margin-bottom: -1px; display: flex; justify-content: space-between; align-items: center; font-size: 11pt; }
                .extract-details-v2 .title-main { font-weight: bold; text-align: right; flex-grow: 1; }
                .extract-details-v2 .title-period, .extract-details-v2 .title-days { font-size: 10pt; white-space: nowrap; }
                
                /* ✅✅✅ [الحل هنا] تعديل تخطيط الجدول ✅✅✅ */
                table {
                    width: 100%;
                    border-collapse: collapse;
                    table-layout: auto; /* السماح للمتصفح بتحديد عرض الأعمدة */
                }
                th, td {
                    border: 1px solid #ccc;
                    padding: 4px; /* زيادة الـ padding قليلاً */
                    text-align: center;
                    font-size: 8pt;
                    vertical-align: middle;
                    white-space: nowrap; /* منع التفاف النص في كل الخلايا */
                }
                thead th {
                    background-color: #003087 !important;
                    color: #fff !important;
                }
                
                .table-summary-v2 { display: flex; flex-wrap: wrap; justify-content: center; gap: 15px; padding: 8px; border: 1px solid #ccc; background-color: #f8f9fa; font-size: 9pt; font-weight: bold; }
                .signatures-display-section { margin-top: 25px; padding-top: 15px; border-top: 1px solid #ccc; }
                .signatures-grid { display: flex; justify-content: space-around; }
            </style>
        </head>
        <body dir="rtl">
    `);

    const headerHTML = `<div class="printable-header"><img src="${headerClone.querySelector('.logo-left')?.src}" class="logo"><div class="header-text"><h1>${headerClone.querySelector('h1')?.textContent}</h1><h3>${headerClone.querySelector('h3')?.textContent}</h3><h2>${headerClone.querySelector('h2')?.textContent}</h2></div><img src="${headerClone.querySelector('.logo-right')?.src}" class="logo"></div>`;
    
    doc.write(headerHTML);
    doc.body.appendChild(contractInfoClone);
    doc.body.appendChild(tabContentClone);

    doc.write('</body></html>');
    doc.close();
    
    printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
    };
}
function getCategoryColor(category) {
    const colors = {
        1: '#e74c3c',
        2: '#3498db',
        3: '#2ecc71',
        4: '#f1c40f',
        5: '#9b59b6',
        6: '#1abc9c',
        7: '#e67e22'
    };
    return colors[category] || '#ffffff';
}

function getCategoryTextColor(category) {
    return category == 4 ? '#000' : '#fff';
}

function updateCategoryDisplay(selectElement, empIndex, centerKey) {
    const category = selectElement.value;
    selectElement.style.backgroundColor = getCategoryColor(category);
    selectElement.style.color = getCategoryTextColor(category);

    // إعادة حساب الجدول كاملاً لتعكس التغيير
    populateAttendanceTableBody(centerKey);
}
// ===================================================================
// --- 6. DIALOGS & MANAGEMENT (V2 - Upgraded) ---
// ===================================================================

let activeCenterKeyForManagement = null; // متغير لتتبع المركز النشط
let currentSortOrder = 'asc'; // 'asc' for ascending, 'desc' for descending

function openDialog(contentHTML, dialogId = 'management-dialog', isWide = false) {
    // التأكد من إغلاق أي نوافذ فرعية قبل فتح نافذة جديدة
    if (document.getElementById('form-dialog')?.style.display === 'block') {
        closeDialog('form-dialog');
    }

    const dialog = document.getElementById(dialogId);
    if (dialog) {
        dialog.innerHTML = contentHTML;
        dialog.style.display = 'block';
        if (isWide) dialog.classList.add('wide-dialog');
        else dialog.classList.remove('wide-dialog');
    }
    document.getElementById('dialog-overlay').style.display = 'block';
}

function closeDialog(dialogId = 'management-dialog') {
    const dialog = document.getElementById(dialogId);
    if (dialog) {
        dialog.style.display = 'none';
        dialog.classList.remove('wide-dialog');
    }
    // إخفاء الغطاء فقط إذا كانت كل النوافذ مغلقة
    if (document.getElementById('management-dialog')?.style.display !== 'block' && document.getElementById('form-dialog')?.style.display !== 'block') {
        document.getElementById('dialog-overlay').style.display = 'none';
    }
}

// --- Upgraded Employee Management Dialog ---
function openEmployeeManagementDialog() {
    const content = `
        <div class="dialog-header">
            <h3><i class="fas fa-lock"></i> الوصول إلى لوحة الإدارة</h3>
            <span class="close" onclick="closeDialog('management-dialog')">×</span>
        </div>
        <div class="dialog-body">
            <p>للوصول إلى هذه الإعدادات، يرجى إدخال كلمة المرور.</p>
            <div class="form-group">
                <label for="management-password-input">كلمة المرور:</label>
                <input type="password" id="management-password-input" placeholder="••••••••" onkeyup="if(event.key==='Enter') verifyManagementPassword()">
            </div>
            <p id="password-error-message" class="error-message" style="display:none;"></p>
        </div>
        <div class="dialog-footer">
            <div></div>
            <button class="btn btn-success" onclick="verifyManagementPassword()">
                <i class="fas fa-check-circle"></i> تأكيد الدخول
            </button>
        </div>
    `;
    openDialog(content, 'management-dialog', false);
}

function verifyManagementPassword() {
    const input = document.getElementById('management-password-input').value;
    const errorMsg = document.getElementById('password-error-message');
    if (input === PASSWORD) {
        showUpgradedManagementInterface();
    } else {
        errorMsg.textContent = "كلمة المرور غير صحيحة. يرجى المحاولة مرة أخرى.";
        errorMsg.style.display = 'block';
    }
}

function showUpgradedManagementInterface() {
    const dialog = document.getElementById('management-dialog');
    if (!dialog) return;
    dialog.classList.add('wide-dialog');
    const content = `
        <div class="management-container-v3">
            <div class="management-sidebar-v3">
                <h3><i class="fas fa-hospital-user"></i> إدارة المراكز</h3>
                <div id="centers-list-sidebar" class="scrollable-list"></div>
                <button class="btn-secondary" onclick="showCenterNameManagement()">
                    <i class="fas fa-edit"></i> تعديل أسماء المراكز
                </button>
            </div>
            <div class="management-content-v3">
                <div id="management-header-v3">
                    <h3 id="content-title"><i class="fas fa-users"></i> إدارة الموظفين</h3>
                    <div class="search-sort-controls">
                        <input type="text" id="employee-search-input" placeholder="ابحث بالاسم أو رقم الإقامة..." oninput="displayEmployeesForCenter(activeCenterKeyForManagement)">
                        <button id="sort-toggle-btn" class="btn-secondary" onclick="toggleSortOrder()">
                            <i class="fas fa-sort-alpha-down"></i> فرز أبجدي
                        </button>
                    </div>
                </div>
                <div id="management-content-area" class="scrollable-list">
                    <p class="info-text-v3"><i class="fas fa-arrow-left"></i> اختر مركزاً من القائمة اليمنى لعرض الموظفين.</p>
                </div>
                <div id="management-footer-v3">
                     <button id="add-employee-btn" class="btn btn-success" style="display:none;" onclick="showAddEmployeeForm()">
                        <i class="fas fa-plus"></i> إضافة موظف جديد للمركز المحدد
                    </button>
                </div>
            </div>
        </div>
        <button class="close-dialog-btn" onclick="closeDialog('management-dialog')" title="إغلاق النافذة">
            <i class="fas fa-times"></i>
        </button>
    `;
    dialog.innerHTML = content;
    populateCentersSidebar();
    // ✅ [الإصلاح]: التأكد من أن عرض الموظفين يبدأ بشكل صحيح إذا كان هناك مركز نشط سابقًا
    if (activeCenterKeyForManagement) {
        displayEmployeesForCenter(activeCenterKeyForManagement);
        // إعادة تفعيل الرابط النشط في القائمة الجانبية
        document.querySelectorAll('#centers-list-sidebar a').forEach(link => {
            if (link.textContent === getCenterNames()[activeCenterKeyForManagement]) {
                link.classList.add('active');
            }
        });
    }
}

function populateCentersSidebar() {
    const container = document.getElementById('centers-list-sidebar');
    if (!container) return;
    const names = getCenterNames();
    container.innerHTML = '';
    Object.keys(names).sort((a, b) => {
        if (a.startsWith('center_') && b.startsWith('center_')) {
            return parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]);
        }
        return a.localeCompare(b);
    }).forEach(key => {
        const item = document.createElement('a');
        item.href = '#';
        item.textContent = names[key];
        item.onclick = (e) => {
            e.preventDefault();
            document.querySelectorAll('#centers-list-sidebar a').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            displayEmployeesForCenter(key);
        };
        container.appendChild(item);
    });
}

function toggleSortOrder() {
    currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
    const btn = document.getElementById('sort-toggle-btn');
    if (currentSortOrder === 'asc') {
        btn.innerHTML = '<i class="fas fa-sort-alpha-down"></i> فرز أبجدي';
    } else {
        btn.innerHTML = '<i class="fas fa-sort-alpha-up"></i> فرز عكسي';
    }
    displayEmployeesForCenter(activeCenterKeyForManagement);
}

function displayEmployeesForCenter(centerKey) {
    if (!centerKey) return;
    activeCenterKeyForManagement = centerKey;
    
    const contentArea = document.getElementById('management-content-area');
    const title = document.getElementById('content-title');
    const addButton = document.getElementById('add-employee-btn');
    const searchInput = document.getElementById('employee-search-input').value.toLowerCase();
    
    const centerName = getCenterNames()[centerKey];
    title.innerHTML = `<i class="fas fa-users"></i> موظفو مركز: <strong>${centerName}</strong>`;
    addButton.style.display = 'inline-flex';
    
    const allData = getAttendanceData();
    let centerEmployees = allData[centerKey] || [];

    // 1. Filter based on search
    if (searchInput) {
        centerEmployees = centerEmployees.filter(emp => 
            emp.name.toLowerCase().includes(searchInput) || 
            (emp.iqamaId && emp.iqamaId.includes(searchInput))
        );
    }

    // 2. Sort the array
    centerEmployees.sort((a, b) => {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();
        if (nameA < nameB) return currentSortOrder === 'asc' ? -1 : 1;
        if (nameA > nameB) return currentSortOrder === 'asc' ? 1 : -1;
        return 0;
    });

    contentArea.innerHTML = '';
    if (centerEmployees.length === 0) {
        contentArea.innerHTML = '<p class="info-text-v3"><i class="fas fa-exclamation-circle"></i> لا يوجد موظفون يطابقون البحث أو في هذا المركز.</p>';
        return;
    }

    centerEmployees.forEach(emp => {
const originalIndex = allData[centerKey].findIndex(originalEmp => originalEmp.iqamaId === emp.iqamaId);
        const card = document.createElement('div');
        card.className = 'employee-card-v3';
        card.innerHTML = `
            <div class="employee-details">
                <strong class="employee-name">${emp.name}</strong>
                <span class="employee-job">${emp.jobTitle}</span>
                <div class="employee-meta">
                    <span><i class="fas fa-id-card"></i> ${emp.iqamaId || 'لا يوجد'}</span>
                    <span><i class="fas fa-flag"></i> ${emp.nationality}</span>
                    <span><i class="fas fa-layer-group"></i> فئة ${emp.category}</span>
                </div>
            </div>
           <div class="employee-actions">
    <button title="تعديل بيانات الموظف" class="action-btn btn-edit" onclick="openEditEmployeeForm('${centerKey}', ${originalIndex})"><i class="fas fa-pencil-alt"></i></button>
    <button title="تعديل الحضور الجماعي" class="action-btn btn-attendance" onclick="openBulkAttendanceForm('${centerKey}', ${originalIndex})"><i class="fas fa-calendar-alt"></i></button>
    <button title="حذف الموظف" class="action-btn btn-danger" onclick="confirmDeleteEmployee('${centerKey}', ${originalIndex})"><i class="fas fa-trash"></i></button>
</div>

        `;
        contentArea.appendChild(card);
    });
}

function showAddEmployeeForm() {
    if (!activeCenterKeyForManagement) {
        alert("الرجاء اختيار مركز أولاً!");
        return;
    }
    const centerName = getCenterNames()[activeCenterKeyForManagement];
    const content = `
        <div class="dialog-header"><h3><i class="fas fa-user-plus"></i> إضافة موظف جديد إلى: ${centerName}</h3><span class="close" onclick="closeDialog('form-dialog')">×</span></div>
        <div class="dialog-body">${getEmployeeFormHTML()}</div>
        <div class="dialog-footer">
            <button class="btn btn-secondary" onclick="closeDialog('form-dialog')">إلغاء</button>
            <button class="btn btn-success" onclick="addEmployeeFromForm()"><i class="fas fa-check"></i> إضافة وتأكيد</button>
        </div>
    `;
    openDialog(content, 'form-dialog', false);
}

/**
 * ✅ [النسخة المطورة V2 - مع أزرار الحفظ والإلغاء]
 * تفتح نافذة تعديل بيانات الموظف مع إضافة أزرار التحكم اللازمة.
 * @param {string} centerKey
 * @param {number} empIndex
 */
function openEditEmployeeForm(centerKey, empIndex) {
    const employee = getAttendanceData()[centerKey][empIndex];
    
    // بناء محتوى النافذة المنبثقة
    const content = `
        <div class="dialog-header">
            <h3><i class="fas fa-pencil-alt"></i> تعديل بيانات: ${employee.name}</h3>
            <span class="close" onclick="closeDialog('form-dialog')">×</span>
        </div>
        <div class="dialog-body">
            ${getEmployeeFormHTML(employee)}
        </div>
        
        <!-- ✅✅✅ [الجزء المضاف هنا] ✅✅✅ -->
        <div class="dialog-footer">
            <button class="btn btn-secondary" onclick="closeDialog('form-dialog')">إلغاء</button>
            <button class="btn btn-success" onclick="saveEmployeeChanges('${centerKey}', ${empIndex})">
                <i class="fas fa-save"></i> حفظ التغييرات
            </button>
        </div>
    `;
    
    // فتح النافذة المنبثقة
    openDialog(content, 'form-dialog', false);
}

function getEmployeeFormHTML(employee = {}) {
    return `
        <div class="edit-form-container">
            <fieldset>
                <legend>البيانات الأساسية</legend>
                <div class="form-group"><label for="emp-name">اسم الموظف:</label><input type="text" id="emp-name" value="${employee.name || ''}"></div>
                <div class="form-group"><label for="emp-job">المسمى الوظيفي:</label><input type="text" id="emp-job" value="${employee.jobTitle || ''}"></div>
                <div class="form-group"><label for="emp-iqama">رقم الإقامة/الهوية:</label><input type="text" id="emp-iqama" value="${employee.iqamaId || ''}"></div>
            </fieldset>
            <fieldset>
                <legend>البيانات المالية والإدارية</legend>
                <div class="form-group"><label for="emp-salary">التكلفة الشهرية:</label><input type="number" id="emp-salary" value="${employee.salary || 0}"></div>
                <div class="form-group"><label for="emp-category">الفئة:</label><select id="emp-category">${[1,2,3,4,5,6,7].map(n => `<option value="${n}" ${n == employee.category ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
                <div class="form-group"><label for="emp-nationality">الجنسية:</label><select id="emp-nationality">${['سعودي', 'مصري', 'هندي', 'باكستاني', 'فلبيني', 'بنجلادش', 'أخرى'].map(n => `<option value="${n}" ${n === employee.nationality ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
            </fieldset>
        </div>
    `;
}

function addEmployeeFromForm() {
    const newEmployee = {
        jobTitle: document.getElementById('emp-job').value.trim(),
        name: document.getElementById('emp-name').value.trim(),
        salary: parseFloat(document.getElementById('emp-salary').value) || 0,
        category: document.getElementById('emp-category').value,
        nationality: document.getElementById('emp-nationality').value,
        iqamaId: document.getElementById('emp-iqama').value.trim(),
        nationalityFine: 0,
        days: Array(getExtractPeriodDetails().daysInExtract).fill('ح')
    };

    if (!newEmployee.name || !newEmployee.jobTitle || !newEmployee.iqamaId) {
        alert("الرجاء ملء جميع الحقول الأساسية (الاسم، الوظيفة، رقم الإقامة).");
        return;
    }

    const allData = getAttendanceData();
    for (const key in allData) {
        if (allData[key].some(emp => emp.iqamaId === newEmployee.iqamaId)) {
            alert(`خطأ: موظف برقم الإقامة هذا موجود بالفعل.`);
            return;
        }
    }

    if (!allData[activeCenterKeyForManagement]) allData[activeCenterKeyForManagement] = [];
    allData[activeCenterKeyForManagement].push(newEmployee);
    saveAttendanceData(allData);
    showSuccessMessage(`تم إضافة الموظف "${newEmployee.name}" بنجاح.`);
    closeDialog('form-dialog');
    displayEmployeesForCenter(activeCenterKeyForManagement);
    renderCenterIcons();
}

function saveEmployeeChanges(centerKey, empIndex) {
    const data = getAttendanceData();
    const employee = data[centerKey][empIndex];
    
    employee.name = document.getElementById('emp-name').value.trim();
    employee.jobTitle = document.getElementById('emp-job').value.trim();
    employee.iqamaId = document.getElementById('emp-iqama').value.trim();
    employee.salary = parseFloat(document.getElementById('emp-salary').value) || 0;
    employee.category = document.getElementById('emp-category').value;
    employee.nationality = document.getElementById('emp-nationality').value;

    if (!employee.name || !employee.jobTitle || !employee.iqamaId) {
        alert("الرجاء ملء جميع الحقول الأساسية.");
        return;
    }

    saveAttendanceData(data);
    showSuccessMessage(`تم تحديث بيانات "${employee.name}" بنجاح.`);
    closeDialog('form-dialog');
    displayEmployeesForCenter(centerKey);
}

function confirmDeleteEmployee(centerKey, empIndex) {
    const employeeName = getAttendanceData()[centerKey][empIndex].name;
    if (confirm(`هل أنت متأكد من حذف الموظف "${employeeName}"؟ لا يمكن التراجع عن هذا الإجراء.`)) {
        let data = getAttendanceData();
        data[centerKey].splice(empIndex, 1);
        saveAttendanceData(data);
        showSuccessMessage("تم حذف الموظف بنجاح.");
        displayEmployeesForCenter(centerKey);
        renderCenterIcons();
    }
}
/**
 * ✅ [النسخة المطورة V2]
 * تفتح نافذة تعديل الحضور الجماعي مع حقول لتحديد نطاق الأيام.
 * @param {string} centerKey - مفتاح المركز.
 * @param {number} empIndex - فهرس الموظف (اختياري، إذا كان التعديل لموظف واحد).
 */
function openBulkAttendanceForm(centerKey, empIndex = null) {
    const { daysInExtract } = getExtractPeriodDetails();
    const employee = empIndex !== null ? getAttendanceData()[centerKey][empIndex] : null;
    const title = employee ? `للموظف: ${employee.name}` : `لجميع موظفي المركز`;

    let statusOptions = '';
    for (const code in STATUS_CODES) {
        if (code === 'default') continue;
        statusOptions += `<option value="${code}">${STATUS_CODES[code].name} (${code})</option>`;
    }

    const content = `
        <div class="dialog-header">
            <h3><i class="fas fa-calendar-alt"></i> تعديل الحضور لفترة محددة</h3>
            <span class="close" onclick="closeDialog('form-dialog')">×</span>
        </div>
        <div class="dialog-body">
            <p class="info-text">اختر الحالة ونطاق الأيام لتطبيقها <strong>${title}</strong>.</p>
            <div class="form-group">
                <label for="bulk-status-select">الحالة الجديدة:</label>
                <select id="bulk-status-select">${statusOptions}</select>
            </div>
            <fieldset>
                <legend>تحديد نطاق الأيام</legend>
                <div class="form-group-inline">
                    <div class="form-group">
                        <label for="bulk-day-start">من يوم:</label>
                        <input type="number" id="bulk-day-start" value="1" min="1" max="${daysInExtract}">
                    </div>
                    <div class="form-group">
                        <label for="bulk-day-end">إلى يوم:</label>
                        <input type="number" id="bulk-day-end" value="${daysInExtract}" min="1" max="${daysInExtract}">
                    </div>
                </div>
            </fieldset>
        </div>
        <div class="dialog-footer">
            <button class="btn btn-secondary" onclick="closeDialog('form-dialog')">إلغاء</button>
            <button class="btn btn-success" onclick="applyBulkAttendance('${centerKey}', ${empIndex})"><i class="fas fa-check"></i> تطبيق التغييرات</button>
        </div>
    `;
    openDialog(content, 'form-dialog', false);
}

/**
 * ✅ [النسخة المطورة V2]
 * تطبق حالة الحضور على نطاق أيام محدد لموظف واحد أو لجميع الموظفين في المركز.
 * @param {string} centerKey
 * @param {number|null} empIndex
 */
function applyBulkAttendance(centerKey, empIndex) {
    const newStatus = document.getElementById('bulk-status-select').value;
    const startDay = parseInt(document.getElementById('bulk-day-start').value);
    const endDay = parseInt(document.getElementById('bulk-day-end').value);

    if (isNaN(startDay) || isNaN(endDay) || startDay > endDay || startDay < 1) {
        alert("الرجاء إدخال نطاق أيام صحيح.");
        return;
    }

    const data = getAttendanceData();
    const employee = empIndex !== null ? data[centerKey][empIndex] : null;
    const targetDescription = employee ? `الموظف "${employee.name}"` : `جميع موظفي مركز "${getCenterNames()[centerKey]}"`;
    
    if (confirm(`هل أنت متأكد من تغيير حالة ${targetDescription} إلى "${STATUS_CODES[newStatus].name}" من يوم ${startDay} إلى يوم ${endDay}؟`)) {
        
        const startIndex = startDay - 1;
        const endIndex = endDay - 1;

        if (employee) {
            // تطبيق على موظف واحد
            for (let i = startIndex; i <= endIndex; i++) {
                if (employee.days[i] !== undefined) {
                    employee.days[i] = newStatus;
                }
            }
        } else {
            // تطبيق على كل الموظفين في المركز
            data[centerKey].forEach(emp => {
                for (let i = startIndex; i <= endIndex; i++) {
                    if (emp.days[i] !== undefined) {
                        emp.days[i] = newStatus;
                    }
                }
            });
        }

        saveAttendanceData(data);
        showSuccessMessage("تم تطبيق الحالة المجمعة بنجاح.");
        closeDialog('form-dialog');
        // لا حاجة لإعادة رسم أي شيء هنا لأن التغيير سيظهر عند فتح تفاصيل المركز
    }
}

function showCenterNameManagement() {
    const contentArea = document.getElementById('management-content-area');
    const title = document.getElementById('content-title');
    const searchSortControls = document.querySelector('.search-sort-controls');
    const footer = document.getElementById('management-footer-v3');

    // ✅ [الإصلاح]: تعديل الواجهة الحالية بدلاً من فتح نافذة جديدة
    title.innerHTML = `<i class="fas fa-edit"></i> إدارة أسماء المراكز`;
    if(searchSortControls) searchSortControls.style.display = 'none'; // إخفاء البحث والفرز

    const names = getCenterNames();
    let editorHTML = `<div class="center-editor-grid">`;
    Object.keys(names).sort((a, b) => {
        if (a.startsWith('center_') && !b.startsWith('center_')) return -1;
        if (!a.startsWith('center_') && b.startsWith('center_')) return 1;
        if (a.startsWith('center_') && b.startsWith('center_')) {
            return parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]);
        }
        return a.localeCompare(b);
    }).forEach(key => {
        const isSpecial = !key.startsWith('center_');
        editorHTML += `
            <div class="center-name-card">
                <span class="center-number">${isSpecial ? names[key] : `المركز ${key.split('_')[1]}`}</span>
                <input type="text" class="center-name-input" data-key="${key}" value="${names[key]}">
                ${!isSpecial ? `<button class="btn-danger" onclick="confirmDeleteCenter('${key}')" title="حذف المركز"><i class="fas fa-trash"></i></button>` : ''}
            </div>`;
    });
    editorHTML += '</div>';
    contentArea.innerHTML = editorHTML;

    // ✅ [الإصلاح]: تعديل أزرار الجزء السفلي لتناسب واجهة تعديل المراكز
    footer.innerHTML = `
        <button class="btn btn-primary" onclick="showAddNewCenterFormInPlace()"><i class="fas fa-plus-circle"></i> إضافة مركز جديد</button>
        <button class="btn btn-success" onclick="saveAllCenterNames(true)"><i class="fas fa-save"></i> حفظ كل التغييرات</button>
        <button class="btn btn-secondary" onclick="showUpgradedManagementInterface()"> العودة لإدارة الموظفين</button>
    `;
}

function saveAllCenterNames() {
    const inputs = document.querySelectorAll('#center-name-editor-area .center-name-input');
    let names = getCenterNames();
    inputs.forEach(input => {
        names[input.dataset.key] = input.value.trim();
    });
    saveCenterNames(names);
    showSuccessMessage("تم حفظ أسماء المراكز بنجاح.");
    closeDialog('form-dialog');
    // Refresh the main management interface to show new names
    populateCentersSidebar();
    renderCenterIcons();
}

function confirmDeleteCenter(centerKey) {
    const names = getCenterNames();
    const centerName = names[centerKey];
    if (confirm(`تحذير: هل أنت متأكد من حذف مركز "${centerName}"؟\n\nسيتم حذف المركز وجميع الموظفين المسجلين فيه بشكل نهائي. لا يمكن التراجع عن هذا الإجراء.`)) {
        delete names[centerKey];
        let data = getAttendanceData();
        delete data[centerKey];
        saveCenterNames(names);
        saveAttendanceData(data);
        showSuccessMessage(`تم حذف مركز "${centerName}" بنجاح.`);
        // Refresh views
        closeDialog('form-dialog');
        showUpgradedManagementInterface();
        renderCenterIcons();
    }
}
// ✅ [دالة جديدة]: لحفظ الأسماء ثم العودة لواجهة تعديل الأسماء
function saveAllCenterNames(andReturn = false) {
    const inputs = document.querySelectorAll('#management-content-area .center-name-input');
    let names = getCenterNames();
    inputs.forEach(input => {
        names[input.dataset.key] = input.value.trim();
    });
    saveCenterNames(names);
    showSuccessMessage("تم حفظ أسماء المراكز بنجاح.");
    
    populateCentersSidebar();
    renderCenterIcons();

    if (andReturn) {
        showCenterNameManagement(); // العودة لنفس الشاشة بعد الحفظ
    }
}

// ✅ [دالة جديدة]: لعرض نموذج إضافة مركز جديد داخل الواجهة نفسها
function showAddNewCenterFormInPlace() {
    const contentArea = document.getElementById('management-content-area');
    contentArea.innerHTML = `
        <div class="edit-form-container" style="margin-top: 20px;">
            <h4>إضافة مركز صحي جديد</h4>
            <p>أدخل اسم المركز الجديد الذي تريد إضافته إلى القائمة.</p>
            <fieldset>
                <legend>بيانات المركز الجديد</legend>
                <div class="form-group">
                    <label for="new-center-name">اسم المركز الجديد:</label>
                    <input type="text" id="new-center-name" placeholder="مثال: مركز صحي العزيزية">
                </div>
            </fieldset>
        </div>
    `;
    const footer = document.getElementById('management-footer-v3');
    footer.innerHTML = `
        <button class="btn btn-success" onclick="confirmAddNewCenter(true)"><i class="fas fa-check"></i> إضافة وتأكيد</button>
        <button class="btn btn-secondary" onclick="showCenterNameManagement()"><i class="fas fa-times"></i> إلغاء</button>
    `;
}

// ✅ [تعديل بسيط]: تعديل دالة تأكيد الإضافة لتقبل متغير العودة
function confirmAddNewCenter(andReturn = false) {
    const newName = document.getElementById('new-center-name').value.trim();
    if (!newName) {
        alert("الرجاء إدخال اسم للمركز الجديد.");
        return;
    }
    if (!confirm(`هل أنت متأكد من إضافة "${newName}" إلى القائمة؟`)) {
        return;
    }
    const names = getCenterNames();
    const centerKeys = Object.keys(names).filter(k => k.startsWith('center_'));
    const lastCenterNum = centerKeys.length > 0 ? Math.max(...centerKeys.map(k => parseInt(k.split('_')[1]))) : 0;
    const newCenterKey = `center_${lastCenterNum + 1}`;
    names[newCenterKey] = newName;
    saveCenterNames(names);
    showSuccessMessage(`تمت إضافة "${newName}" بنجاح!`);
    renderCenterIcons();
    populateCentersSidebar();
    if (andReturn) {
        showCenterNameManagement();
    }
}
/**
 * ✅ [دالة جديدة وموحدة] تطبع أي محتوى HTML بتصميم احترافي.
 * @param {HTMLElement} contentElement - العنصر الذي يحتوي على كل الصفحات المراد طباعتها.
 * @param {string} documentTitle - عنوان مستند الطباعة.
 */
function printProfessional(contentElement, documentTitle = 'طباعة تقرير') {
    // 1. استنساخ المحتوى لتجنب تعديل الصفحة الأصلية
    const contentClone = contentElement.cloneNode(true);

    // 2. تنظيف المحتوى من الأزرار والحقول التفاعلية
    contentClone.querySelectorAll('.tab-action-buttons, .no-print').forEach(el => el.remove());
    contentClone.querySelectorAll('select, input').forEach(el => {
        const span = document.createElement('span');
        if (el.tagName.toLowerCase() === 'select') {
            span.textContent = el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : el.value;
        } else {
            span.textContent = el.value;
        }
        span.style.cssText = el.style.cssText;
        span.className = el.className;
        el.parentNode.replaceChild(span, el);
    });

    // 3. فتح نافذة طباعة جديدة وإعدادها
    const printWindow = window.open('', '', 'width=1200,height=900');
    const doc = printWindow.document;

    doc.write(`<html><head><title>${documentTitle}</title>`);
    document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
        doc.write(`<link rel="stylesheet" href="${link.href}">`);
    });
    
    // 4. إضافة أنماط الطباعة الأساسية
    doc.write(`
        <style>
            body { font-family: 'Tajawal', sans-serif; direction: rtl; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .page-break { page-break-after: always; }
            .printable-page { page-break-inside: avoid; }
            @page { margin: 1cm; }
            @page landscape { size: A4 landscape; }
            @page portrait { size: A4 portrait; }
            .printable-page.landscape { page: landscape; }
            .printable-page.portrait { page: portrait; }
        </style>
    `);
    doc.write('</head><body>');
    
    // 5. إضافة الهيدر الرسمي ومعلومات العقد
    const headerHTML = `<header class="header-info">${document.querySelector('.header-info').innerHTML}</header>`;
    const contractInfoHTML = `<section class="page-contract-info-v2">${document.querySelector('.page-contract-info-v2').innerHTML}</section>`;
    
    doc.write(headerHTML + contractInfoHTML + contentClone.innerHTML);
    
    doc.write('</body></html>');
    doc.close();

    // 6. تنفيذ الطباعة
    printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
    };
}
// ===================================================================
// === START: Grand Achievement Certificate (FINAL & FIXED CODE) ===
// ===================================================================

/**
 * ✅ [النسخة النهائية V11 - عرض الشهادة الإجمالية]
 * تم تعديلها لتعرض العنوان بالتنسيق الجديد والمطلوب من المستخدم.
 * تفصل بين العنوان الرئيسي، العنوان الفرعي، ومعلومات الفترة بشكل واضح.
 */
function showGrandAchievementCertificate() {
    // --- 1. جمع وحساب البيانات ---
    const allData = getAttendanceData();
    const centerNames = getCenterNames();
    const { totalDaysInMonth } = getExtractPeriodDetails();
    const contractData = JSON.parse(localStorage.getItem('persistentContractData') || '{}');
    const contractType = contractData.contractType || 'عقد أساسي';
    const directPurchaseRatio = parseFloat(contractData.directPurchaseRatio) || 0;
    const allPerfDeductions = JSON.parse(localStorage.getItem('performanceDeductions') || '{}');
    const titles = getAppTitles();

    let grandTotal = { monthly: 0, absenceDeduct: 0, absencePenalty: 0, perfPenalty: 0, nationPenalty: 0, net: 0 };
    let tableRows = '';

    const sortedCenterKeys = Object.keys(centerNames).sort((a, b) => {
        const aIsCenter = a.startsWith('center_');
        const bIsCenter = b.startsWith('center_');
        if (aIsCenter && !bIsCenter) return -1;
        if (!aIsCenter && bIsCenter) return 1;
        if (aIsCenter && bIsCenter) return parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]);
        return a.localeCompare(b);
    });

    sortedCenterKeys.forEach(centerKey => {
        const centerData = allData[centerKey] || [];
        let centerTotals = { monthly: 0, absenceDeduct: 0, absencePenalty: 0, perfPenalty: 0, nationPenalty: 0, net: 0 };

        if (centerData.length > 0) {
            centerData.forEach(emp => {
                const salary = parseFloat(emp.salary) || 0;
                let adjustedSalary = salary;
                if (contractType === 'شراء مباشر' && directPurchaseRatio > 0) adjustedSalary = salary + (salary * directPurchaseRatio / 100);
                centerTotals.monthly += adjustedSalary;
                const dailySalary = totalDaysInMonth > 0 ? adjustedSalary / totalDaysInMonth : 0;
                const absenceDays = (emp.days || []).filter(day => STATUS_CODES[day]?.isAbsence).length;
                const fineConfig = ABSENCE_FINES_BY_CATEGORY[emp.category] || ABSENCE_FINES_BY_CATEGORY.default;
                const isSaudi = (emp.nationality || '').includes('سعودي');
                centerTotals.absenceDeduct += absenceDays * dailySalary;
                centerTotals.absencePenalty += absenceDays * (isSaudi ? fineConfig.saudi : fineConfig.non_saudi);
                centerTotals.nationPenalty += parseFloat(emp.nationalityFine) || 0;
            });
            centerTotals.perfPenalty = allPerfDeductions[centerKey] || 0;
            centerTotals.net = centerTotals.monthly - centerTotals.absenceDeduct - centerTotals.absencePenalty - centerTotals.perfPenalty - centerTotals.nationPenalty;
        }

        tableRows += `
            <tr>
                <td>عمالة مكتب ${centerNames[centerKey]}</td>
                <td>${centerTotals.monthly.toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })}</td>
                <td>${centerTotals.absenceDeduct.toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })}</td>
                <td>${centerTotals.absencePenalty.toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })}</td>
                <td>${centerTotals.perfPenalty.toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })}</td>
                <td>${centerTotals.nationPenalty.toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })}</td>
                <td><strong>${centerTotals.net.toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })}</strong></td>
            </tr>
        `;
        Object.keys(grandTotal).forEach(key => grandTotal[key] += centerTotals[key]);
    });

    tableRows += `
        <tr class="total-row">
            <td>الإجمالي العام للمقاول</td>
            <td>${grandTotal.monthly.toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })}</td>
            <td>${grandTotal.absenceDeduct.toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })}</td>
            <td>${grandTotal.absencePenalty.toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })}</td>
            <td>${grandTotal.perfPenalty.toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })}</td>
            <td>${grandTotal.nationPenalty.toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })}</td>
            <td><strong>${grandTotal.net.toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })}</strong></td>
        </tr>
        <tr><td colspan="7" class="tafqeet-cell">إجمالي المستحق للمقاول فقط وقدره: ${tafqit(grandTotal.net)}</td></tr>
    `;

    const extractData = JSON.parse(localStorage.getItem('persistentExtractData') || '{}');
    const monthName = new Date(extractData.extractStart || new Date()).toLocaleString('ar-SA-u-nu-latn-ca-gregory', { month: 'long', year: 'numeric' });
    const formatDate = (dateString) => new Date(dateString).toLocaleDateString('en-CA');
    const extractStart = formatDate(extractData.extractStart);
    const extractEnd = formatDate(extractData.extractEnd);

    // --- 2. بناء محتوى النافذة المنبثقة مع الهيدر الجديد ---
    const dialogContent = `
        <div class="dialog-header">
            <h3>${titles.grandMainTitle}</h3>
            <span class="close" onclick="closeDialog('management-dialog')">×</span>
        </div>
        <div class="dialog-body" id="grand-cert-body">
            <div id="printable-grand-certificate">
                
                <!-- ✅✅✅ [الهيدر الجديد والمُعدل هنا] ✅✅✅ -->
                <div class="certificate-header text-center">
                    <h2>${titles.grandMainTitle}</h2>
                    <h3 style="font-weight: normal;">${titles.grandSubTitle}</h3>
                    <h4>عن شهر ${monthName} (الفترة من: ${extractStart}م إلى: ${extractEnd}م)</h4>
                </div>

                <table class="achievement-table">
                    <thead>
                        <tr>
                            <th>البند</th><th>القيمة الشهرية</th><th>حسم الغياب</th><th>غرامة الغياب</th>
                            <th>غرامة الأداء</th><th>غرامة الجنسية</th><th>الصافي الشهري</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
                <div class="signatures-display-section" id="grand-cert-signatures"></div>
            </div>
        </div>
        <div class="dialog-footer">
<button class="btn btn-primary" onclick="openSignatureDialog('achievement', 'grand_certificate')"><i class="fas fa-signature"></i> تعديل التواقيع</button>
            <div>
                <button class="btn btn-success" onclick="printGrandCertificate()"><i class="fas fa-print"></i> طباعة</button>
                <button class="btn btn-secondary" onclick="closeDialog('management-dialog')">إغلاق</button>
            </div>
        </div>
    `;
    
    // --- 3. فتح النافذة وعرض المحتوى ---
    openDialog(dialogContent, 'management-dialog', true);
    displaySignatures('achievement', 'grand-cert-signatures');
}

/**
 * ✅ [النسخة النهائية V14 - إصلاح حدود الجدول المقطوعة]
 * تم تحديث هذه الدالة لحل مشكلة "تآكل" حدود الجدول عند الطباعة:
 * 1.  **تقليص الحاوية:** تم تعديل عرض الحاوية الرئيسية إلى 98% لترك هامش أمان.
 * 2.  **نموذج الصندوق:** تم تطبيق `box-sizing: border-box` لضمان حساب أحجام العناصر بدقة.
 * 3.  **الحفاظ على الميزات:** تحتفظ بجميع الميزات السابقة (الهيدر الرسمي، العنوان المخصص، الجدول التكيفي).
 */
function printGrandCertificate() {
    // --- الخطوة 1: تحديد واستنساخ كل العناصر المطلوبة بدقة ---
    const mainPageHeader = document.querySelector('.header-info');
    const printableContainer = document.getElementById('printable-grand-certificate');

    if (!mainPageHeader || !printableContainer) {
        alert("خطأ: لم يتم العثور على الهيدر الرئيسي أو حاوية الشهادة للطباعة.");
        return;
    }

    const headerToPrint = printableContainer.querySelector('.certificate-header').cloneNode(true);
    const tableToPrint = printableContainer.querySelector('.achievement-table').cloneNode(true);
    const signaturesToPrint = printableContainer.querySelector('.signatures-display-section')?.cloneNode(true);

    if (!tableToPrint || !headerToPrint) {
        alert("خطأ: لم يتم العثور على كل مكونات الشهادة (العنوان والجدول).");
        return;
    }

    // --- الخطوة 2: إنشاء نافذة طباعة جديدة ---
    const printWindow = window.open('', '', 'height=800,width=1200');
    const doc = printWindow.document;
    doc.open();

    // --- الخطوة 3: بناء محتوى HTML الكامل للطباعة ---
    const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <title>الشهادة الإجمالية المجمعة</title>
            <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
            <style>
                /* --- إعدادات الصفحة والطباعة --- */
                @page { 
                    size: A4 portrait !important;
                    margin: 1cm !important;
                }
                /* ✅✅✅ [الإصلاح 1] تطبيق نموذج الصندوق لضمان حساب دقيق للأحجام ✅✅✅ */
                * {
                    box-sizing: border-box;
                }
                body { 
                    font-family: 'Tajawal', Arial, sans-serif;
                    direction: rtl;
                    -webkit-print-color-adjust: exact !important; 
                    print-color-adjust: exact !important;
                }
                /* ✅✅✅ [الإصلاح 2] تقليص عرض الحاوية لترك هامش أمان ✅✅✅ */
                #print-wrapper {
                    width: 98% !important; /* تقليص العرض قليلاً */
                    margin: 0 auto !important;
                }

                /* --- الهيدر الرسمي مع الشعارات --- */
                .official-header-table {
                    width: 100%;
                    border-bottom: 2px solid #0056b3;
                    margin-bottom: 20px;
                    border-collapse: collapse;
                }
                .official-header-table td { vertical-align: middle; text-align: center; padding: 5px; }
                .official-header-table .logo { width: 70px; height: auto; }
                .official-header-table .title-box h1 { font-size: 16pt; margin: 2px 0; color: #003087; font-weight: 700; }
                .official-header-table .title-box h2 { font-size: 14pt; margin: 2px 0; font-weight: normal; }

                /* --- هيدر الشهادة الديناميكي --- */
                .certificate-header { text-align: center; margin-bottom: 15px; }
                .certificate-header h2 { font-size: 16pt; font-weight: 700; margin: 5px 0; }
                .certificate-header h3 { font-size: 13pt; font-weight: normal; margin: 5px 0; }
                .certificate-header h4 { font-size: 11pt; font-weight: normal; margin: 5px 0; color: #555; }

                /* --- الجدول التكيفي والتواقيع --- */
                .achievement-table { width: 100%; border-collapse: collapse; font-size: 9pt; margin: 15px auto; table-layout: auto; }
                .achievement-table th, .achievement-table td { border: 1px solid #333; padding: 4px; text-align: center; vertical-align: middle; white-space: nowrap; }
                .achievement-table th { background-color: #e9ecef !important; font-weight: 700; }
                .achievement-table .total-row td, .achievement-table .tafqeet-cell { font-weight: bold; background-color: #f0f0f0 !important; }
                .achievement-table .tafqeet-cell { text-align: right; padding-right: 15px; white-space: normal; }
                
                .signatures-display-section { margin-top: 25px; display: flex; justify-content: space-around; width: 100%; page-break-inside: avoid; }
                .signature-item-display { text-align: center; font-size: 10pt; }
                .signature-item-display .line { border-bottom: 1px solid #000; margin-top: 40px; margin-bottom: 5px; }
            </style>
        </head>
        <body>
            <div id="print-wrapper">
                
                <table class="official-header-table">
                    <tr>
                        <td style="width:20%; text-align: left;">
                            <img class="logo" src="${mainPageHeader.querySelector('.logo-left' )?.src}" alt="Logo Left">
                        </td>
                        <td class="title-box">
                            <h1>${mainPageHeader.querySelector('h1')?.textContent}</h1>
                            <h2>${mainPageHeader.querySelector('h3')?.textContent}</h2>
                        </td>
                        <td style="width:20%; text-align: right;">
                            <img class="logo" src="${mainPageHeader.querySelector('.logo-right')?.src}" alt="Logo Right">
                        </td>
                    </tr>
                </table>

                ${headerToPrint.outerHTML}
                ${tableToPrint.outerHTML}
                ${signaturesToPrint ? signaturesToPrint.outerHTML : ''}

            </div>
        </body>
        </html>
    `;

    // --- الخطوة 4: كتابة المحتوى وتنفيذ الطباعة ---
    doc.write(htmlContent);
    doc.close();

    setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
    }, 500);
}
