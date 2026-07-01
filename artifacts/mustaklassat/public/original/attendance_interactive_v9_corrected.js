/**
 * ملف تكامل صفحة الحضور والانصراف - النسخة التفاعلية المصححة
 * يجمع بين الوظائف الأساسية والوظائف الجديدة مع القوائم المنسدلة التفاعلية
 * النسخة النهائية المحدثة مع إصلاح ترتيب الأعمدة وهيكل الجدول
 * الإصدار 9: تصحيح ترتيب الأعمدة وإصلاح عرض الحالات الخاصة
 * تعديل إضافي: ترتيب الأيام من 1 إلى نهاية الشهر، وتوليد رؤوس الحالات الخاصة ديناميكيًا
 */

// ===== 0. إعدادات وقيم ثابتة =====

const ABSENCE_FINES_BY_CATEGORY = {
  1: { saudi: 500, non_saudi: 500 },
  2: { saudi: 500, non_saudi: 500 },
  3: { saudi: 250, non_saudi: 100 },
  4: { saudi: 180, non_saudi: 80  },
  5: { saudi: 150, non_saudi: 80  },
  6: { saudi: 20,  non_saudi: 20  },
  7: { saudi: 10,  non_saudi: 10  },
  default: { saudi: 0, non_saudi: 0 }
};
function normalizeAttendanceCategory(value) {
  const v = String(value || '').trim();

  // يقبل الأرقام العربية والإنجليزية
  const arabicDigits = { '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7' };
  const normalized = arabicDigits[v] || v;

  return /^[1-7]$/.test(normalized) ? normalized : '1';
}
const STATUS_CODES = {
  'ح': { name: 'حاضر', color: '#d4edda', isAbsence: false },
  'غ': { name: 'غائب', color: '#f8d7da', isAbsence: true },
  'ج': { name: 'إجازة', color: '#fff3cd', isAbsence: false, isSpecial: true },
  'ش': { name: 'شاغرة', color: '#d1ecf1', isAbsence: false, isSpecial: true },
  'ت': { name: 'تحت الإجراء', color: '#e2e3e5', isAbsence: false, isSpecial: true },
  'ب': { name: 'بداية العقد', color: '#e8d5f5', isAbsence: false, isSpecial: true },
  'ن': { name: 'نهاية العقد', color: '#fde8c8', isAbsence: false, isSpecial: true },
  default: { name: 'غير معروف', color: '#ffffff', isAbsence: false }
};
const PASSWORD = "admin123"; // تعريف الباسورد هنا
let currentDialogPurpose = null; // هذا المتغير أيضاً يجب أن يكون معرفاً في النطاق العام


// ===== 2. دوال القوائم المنسدلة التفاعلية =====
/* ================================================================ */
/* ✅✅✅ أضف هذه الدالة إلى ملف الجافاسكريبت الخاص بك ✅✅✅ */
/* ================================================================ */

function openManagementPasswordDialog() {
    let dialog = document.getElementById('password-dialog');
    if (!dialog) {
        dialog = document.createElement('div');
        dialog.id = 'password-dialog';
        dialog.className = 'dialog';
        document.body.appendChild(dialog);
    }
    dialog.innerHTML = `
        <div class="dialog-header">
            <h3><i class="fas fa-lock"></i> الوصول إلى لوحة الإدارة</h3>
            <span class="close" onclick="closeDialog('password-dialog')">×</span>
        </div>
        <div class="dialog-body">
            <p class="info-text">للوصول إلى هذه الإعدادات، يرجى إدخال كلمة المرور.</p>
            <div class="form-group">
                <label for="management-password-input">كلمة المرور:</label>
                <input type="password" id="management-password-input" placeholder="••••••••" onkeypress="if(event.key==='Enter') verifyManagementPassword()">
            </div>
            <p id="password-error-message" style="display:none; color: #dc3545; text-align:center;"></p>
        </div>
        <div class="dialog-footer">
            <button class="btn-success" onclick="verifyManagementPassword()"><i class="fas fa-check-circle"></i> تأكيد الدخول</button>
        </div>
    `;
    openDialog('password-dialog');
}

function createCategorySelect(currentCategory, departmentKey, employeeIndex) {
  const categories = [
    { value: '1', color: '#ff6b6b', name: '1' },
    { value: '2', color: '#4ecdc4', name: '2' },
    { value: '3', color: '#45b7d1', name: '3' },
    { value: '4', color: '#96ceb4', name: '4' },
    { value: '5', color: '#feca57', name: '5' },
    { value: '6', color: '#ff9ff3', name: '6' },
    { value: '7', color: '#54a0ff', name: '7' }
  ];
  
  const select = document.createElement('select');
  select.style.cssText = `
    width: 50px;
    height: 30px;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 2px;
    text-align: center;
    font-size: 12px;
    font-weight: bold;
    cursor: pointer;
  `;
  
  categories.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat.value;
    option.textContent = cat.name;
    option.selected = cat.value === currentCategory;
    option.style.backgroundColor = cat.color;
    option.style.color = 'white';
    select.appendChild(option);
  });
  
  // تطبيق لون الخيار المحدد على القائمة
  const updateSelectColor = () => {
    const selectedCat = categories.find(c => c.value === select.value);
    if (selectedCat) {
      select.style.backgroundColor = selectedCat.color;
      select.style.color = 'white';
    }
  };
  
  updateSelectColor();
  
  select.onchange = function() {
    updateEmployeeCategory(departmentKey, employeeIndex, this.value);
    updateSelectColor();
  };
  
  return select;
}

function createAttendanceSelect(currentStatus, departmentKey, employeeIndex, dayIndex) {
  const statuses = [
    { code: 'ح', name: 'حاضر' },
    { code: 'غ', name: 'غائب' },
    { code: 'ج', name: 'إجازة' },
    { code: 'ش', name: 'شاغرة' },
    { code: 'ت', name: 'تحت الإجراء' },
    { code: 'ب', name: 'بداية العقد' },
    { code: 'ن', name: 'نهاية العقد' },
  ];
  
  const select = document.createElement('select');
  select.style.width = '100%';
  select.style.border = 'none';
  select.style.padding = '1px 0';
  select.style.fontSize = '13px';
  select.style.fontWeight = '700';
  select.style.textAlign = 'center';
  select.style.color = '#111111';
  select.style.backgroundColor = 'transparent';
  
  statuses.forEach(status => {
    const option = document.createElement('option');
    option.value = status.code;
    option.textContent = status.code;
    option.selected = status.code === currentStatus;
    select.appendChild(option);
  });
  
  select.onchange = function() {
    updateEmployeeAttendance(departmentKey, employeeIndex, dayIndex, this.value);
  };
  
  return select;
}

function createNationalitySelect(currentNationality, departmentKey, employeeIndex) {
  const nationalities = [
    'سعودي',
    'مصري', 
    'هندي',
    'باكستاني',
    'فلبيني',
    'بنجلادش',
    'أخرى'
  ];
  
  const select = document.createElement('select');
  select.style.cssText = `
    width: 100px;
    border: 1px solid #ddd;
    padding: 2px;
    text-align: center;
    font-size: 12px;
    border-radius: 4px;
    background-color: white;
  `;
  
  nationalities.forEach(nat => {
    const option = document.createElement('option');
    option.value = nat;
    option.textContent = nat;
    option.selected = nat === currentNationality;
    select.appendChild(option);
  });
  
  select.onchange = function() {
    updateEmployeeNationality(departmentKey, employeeIndex, this.value);
  };
  
  return select;
}

function updateEmployeeCategory(departmentKey, employeeIndex, newCategory) {
  try {
    const data = getAttendanceData();
    const employee = data[departmentKey]?.[employeeIndex];
    if (!employee) return;

    employee.category = normalizeAttendanceCategory(newCategory);
    saveAttendanceData(data);
    renderTables();
  } catch (error) {
    console.error('خطأ في تحديث الفئة:', error);
  }
}
function rebuildTableHeaders() {
  const { daysInMonth, monthDaysArray } = getExtractPeriodDetails();

  const departments = [
    'cleaning',
    'electricity',
    'agriculture',
    'civil-works',
    'mechanical',
    'security',
    'laundry',
    'patient-services',
    'admin-saudi'
  ];

  departments.forEach(dept => {
    // تحديث colspan
    const daysHeader = document.getElementById(`${dept}-days-header`);
    if (daysHeader) daysHeader.setAttribute('colspan', daysInMonth);

    // توليد رؤوس الأيام
    const headerRow = document.getElementById(`${dept}-table-header`);
    if (!headerRow) return;
    headerRow.innerHTML = ''; // امسح الرؤوس القديمة

    monthDaysArray.forEach(dayNumber => {
      const th = document.createElement('th');
      th.textContent = dayNumber;
      th.className = 'day-header';
      headerRow.appendChild(th);
    });

    // رؤوس الملخصات
    ['حضور', 'غياب', 'الحسم', 'غرامة الغياب'].forEach(label => {
      const th = document.createElement('th');
      th.textContent = label;
      headerRow.appendChild(th);
    });
  });
}

function updateEmployeeAttendance(departmentKey, employeeIndex, dayIndex, newStatus) {
    try {
        const data = getAttendanceData();
        const employee = data[departmentKey]?.[employeeIndex];
        if (!employee) return;

        const oldStatus = Array.isArray(employee.days) ? employee.days[dayIndex] : null;
        const employeeName = employee.name || 'غير محدد';
        const departmentName = typeof getDepartmentName === 'function'
          ? getDepartmentName(departmentKey)
          : departmentKey;

        const { daysInMonth } = getExtractPeriodDetails();
        // تهيئة days كمصفوفة كاملة بقيم "ح" لو مش موجودة أو مش array
        if (!Array.isArray(employee.days) || employee.days.length < daysInMonth) {
            const existing = Array.isArray(employee.days) ? employee.days : [];
            employee.days = Array(daysInMonth).fill('ح').map((v, i) => existing[i] || v);
        }

        // تحديث حالة اليوم المحدد فقط
        employee.days[dayIndex] = newStatus;

        // إعادة حساب الحضور والغياب
        let attendanceDays = 0;
        let absenceDays = 0;
        let deductionOnlyDays = 0;

        employee.days.forEach(day => {
            if (day === 'ح' || day === 'ت') {
                attendanceDays++;
            } else if (day === 'غ') {
                absenceDays++;
            } else {
                deductionOnlyDays++;
            }
        });

        const salary = parseFloat(employee.salary) || 0;
        const { totalDaysInMonth } = getExtractPeriodDetails();
        const dailySalary = salary / totalDaysInMonth;
        const extractBaseSalary = dailySalary * daysInMonth;
        const deduction = (absenceDays + deductionOnlyDays) * dailySalary;
const category = normalizeAttendanceCategory(employee.category);
employee.category = category;
const fineConfig = ABSENCE_FINES_BY_CATEGORY[category] || ABSENCE_FINES_BY_CATEGORY[1];        const isSaudi = (employee.nationality || 'سعودي').trim() === 'سعودي';
        const fine = absenceDays * (isSaudi ? fineConfig.saudi : fineConfig.non_saudi);
        const nationalityFine = parseFloat(employee.nationalityFine) || 0;
        const totalFine = fine + nationalityFine;
        const netSalary = extractBaseSalary - deduction - totalFine;

               employee.absenceDays = absenceDays;
        employee.attendanceDays = attendanceDays;
        employee.deduction = deduction;
        employee.absencePenalty = fine;
        employee.totalFine = totalFine;
        employee.netSalary = netSalary;

        saveAttendanceData(data);

        if (typeof window.najranAuditLog === 'function' && oldStatus !== newStatus) {
            window.najranAuditLog(
                'تعديل حضور وانصراف',
                `تم تعديل حضور الموظف ${employeeName} في قسم ${departmentName} - اليوم رقم ${dayIndex + 1} من "${oldStatus || 'غير محدد'}" إلى "${newStatus}"`,
                {
                    entityType: 'attendance',
                    entityId: `${departmentKey}:${employeeIndex}:${dayIndex}`,
                    before: oldStatus,
                    after: newStatus
                }
            );
        }

        // تحديث اللون في الخلية
        const select = document.querySelector(`#${departmentKey}-table tbody tr:nth-child(${employeeIndex + 1}) td.day-cell[data-day-index="${dayIndex}"] select`);
        if (select) {
            const status = STATUS_CODES[newStatus] || STATUS_CODES.default;
            select.classList.remove('present', 'absent', 'leave', 'vacant', 'pending');
            select.classList.add(newStatus === 'ح' ? 'present' : newStatus === 'غ' ? 'absent' : STATUS_CODES[newStatus].name.toLowerCase().replace(/\s+/g, '-'));
            select.parentElement.style.backgroundColor = status.color;
        }

        renderTables();
    } catch (error) {
        console.error('خطأ في تحديث الحضور:', error);
    }
}
function updateEmployeeNationality(departmentKey, employeeIndex, newNationality) {
  try {
    const data = getAttendanceData();
    const employee = data[departmentKey]?.[employeeIndex];
    if (!employee) return;

    employee.nationality = newNationality;
    saveAttendanceData(data);
    renderTables();
  } catch (error) {
    console.error('خطأ في تحديث الجنسية:', error);
  }
}

// ===== 3. تحديث بيانات العقد والمستخلص =====

// ✅✅✅ هذا هو الكود البديل والنهائي. ضعه مكان الدالتين القديمتين. ✅✅✅

function updateContractDisplayData() {
  try {
    // --- القسم الأول: جلب البيانات ---
    let contractData = {};
    let extractData = {};

    // محاولة استخدام دالة التحميل المتقدمة إن وجدت
    try {
      if (typeof loadFromLocalStorage === 'function') {
        contractData = loadFromLocalStorage('persistentContractData') || {};
        extractData = loadFromLocalStorage('persistentExtractData') || {};
      }
    } catch (error) {
      console.warn('لم يتم العثور على دالة loadFromLocalStorage، سيتم استخدام localStorage مباشرة');
    }

    // جلب البيانات الأساسية مع قيم افتراضية
    const hospitalName = contractData.hospitalName || localStorage.getItem('hospitalName') || 'غير محدد';
    const contractDetails = contractData.contractDetails || localStorage.getItem('contractDetails') || 'غير محدد';
    const companyName = contractData.companyName || localStorage.getItem('companyName') || 'غير محدد';
    const contractType = contractData.contractType || localStorage.getItem('contractType') || 'غير محدد';
    const directPurchaseRatio = contractData.directPurchaseRatio || localStorage.getItem('directPurchaseRatio') || '0';

    const extractStart = extractData.extractStart || localStorage.getItem('extractStart') || '';
    const extractEnd = extractData.extractEnd || localStorage.getItem('extractEnd') || '';
    const extractMonth = extractData.extractMonth || localStorage.getItem('extractMonth') || '';
    const extractYear = extractData.extractYear || localStorage.getItem('extractYear') || '';

    // --- القسم الثاني: تحديث عناصر الصفحة (بدون أي استدعاء للتواقيع) ---
    document.querySelectorAll('.hospitalName').forEach(el => el.textContent = hospitalName);
    document.querySelectorAll('.contractDetails').forEach(el => el.textContent = contractDetails);
    document.querySelectorAll('.companyName').forEach(el => el.textContent = companyName);
    document.querySelectorAll('.contractType').forEach(el => el.textContent = contractType);
    document.querySelectorAll('.directPurchaseRatio').forEach(el => el.textContent = directPurchaseRatio);
    document.querySelectorAll('.directPurchaseContainer').forEach(el => {
      el.style.display = (contractType === 'شراء مباشر') ? 'block' : 'none';
    });

    // تحديث تفاصيل المستخلص
    const { monthName, year } = getExtractPeriodDetails(extractStart, extractEnd);
    document.querySelectorAll('#extract-start-date, #extract-start').forEach(el => el.textContent = formatDate(extractStart) || 'غير محدد');
    document.querySelectorAll('#extract-end-date, #extract-end').forEach(el => el.textContent = formatDate(extractEnd) || 'غير محدد');
    document.querySelectorAll('#extract-month').forEach(el => el.textContent = extractMonth || monthName || 'غير محدد');
    document.querySelectorAll('#extract-year').forEach(el => el.textContent = extractYear || year || 'غير محدد');
    
    // --- القسم الثالث: إعادة بناء رؤوس الجدول (مهم) ---
    // 🗑️ تم حذف استدعاءات updateSignatures() من هنا بشكل كامل
    rebuildTableHeaders();

  } catch (error) {
    console.error('خطأ في تحديث بيانات العقد:', error);
  }
}


// ===== 4. استيراد إكسل للعمالة =====

// متغيرات مؤقتة لتخزين بيانات الاستيراد حتى يختار المستخدم
let _pendingImportEmployees = [];
let _pendingImportDeptId    = null;

function importExcelWithDepartment() {
  const fileInput = document.getElementById('excel-file-input');
  const file = fileInput?.files?.[0];
  if (!file) {
    alert('الرجاء اختيار ملف إكسل أولاً');
    return;
  }
  openDialog('select-department-dialog');
}

// ✅ دالة استبدال: تمسح موظفي القسم المحدد وتضع الجدد مباشرة
function replaceEmployeesInDepartment(departmentKey, newEmployees) {
    try {
        const allData = getAttendanceData();
        allData[departmentKey] = newEmployees;
        saveAttendanceData(allData);
        renderTables();
        alert(`✅ تم استبدال بيانات القسم بـ ${newEmployees.length} موظف.`);
    } catch (error) {
        console.error('خطأ في استبدال الموظفين:', error);
        alert('حدث خطأ أثناء الاستبدال');
    }
}

// ✅ نافذة الاختيار: استبدال أم تحديث؟
function showImportModeDialog(departmentId, employees) {
    _pendingImportEmployees = employees;
    _pendingImportDeptId    = departmentId;

    const existing = (getAttendanceData()[departmentId] || []).length;
    const deptName = getDepartmentName(departmentId);

    let dlg = document.getElementById('import-mode-dialog');
    if (!dlg) {
        dlg = document.createElement('div');
        dlg.id = 'import-mode-dialog';
        dlg.className = 'dialog';
        document.body.appendChild(dlg);
        const ov = document.createElement('div');
        ov.id = 'import-mode-overlay';
        ov.className = 'overlay';
        ov.onclick = () => closeDialog('import-mode-dialog');
        document.body.appendChild(ov);
    }

    dlg.innerHTML = `
        <div class="dialog-header">
            <h3><i class="fas fa-file-excel"></i> كيف تريد استيراد الملف؟</h3>
            <span class="close" onclick="closeDialog('import-mode-dialog')">×</span>
        </div>
        <div class="dialog-body" style="text-align:center; padding: 20px 16px;">
            <p style="margin-bottom:6px; font-size:.95rem;">
                القسم: <strong>${deptName}</strong><br>
                موظفون حاليون: <strong>${existing}</strong> &nbsp;|&nbsp;
                موظفون في الملف: <strong>${employees.length}</strong>
            </p>
            <div style="display:flex; gap:12px; justify-content:center; margin-top:20px; flex-wrap:wrap;">
                <button onclick="confirmImportReplace()"
                    style="background:#dc2626;color:#fff;border:none;border-radius:8px;padding:12px 28px;font-size:1rem;font-weight:700;cursor:pointer;">
                    <i class="fas fa-trash-alt"></i> استبدال<br>
                    <small style="font-weight:400;font-size:.78rem;">يمسح الحاليين ويضع الجدد</small>
                </button>
                <button onclick="confirmImportUpdate()"
                    style="background:#16a34a;color:#fff;border:none;border-radius:8px;padding:12px 28px;font-size:1rem;font-weight:700;cursor:pointer;">
                    <i class="fas fa-sync-alt"></i> تحديث<br>
                    <small style="font-weight:400;font-size:.78rem;">يضيف الجدد ويتجاهل المكررين</small>
                </button>
                <button onclick="closeDialog('import-mode-dialog')"
                    style="background:#6b7280;color:#fff;border:none;border-radius:8px;padding:12px 28px;font-size:1rem;cursor:pointer;">
                    <i class="fas fa-times"></i> إلغاء
                </button>
            </div>
        </div>`;

    openDialog('import-mode-dialog');
}

function confirmImportReplace() {
    closeDialog('import-mode-dialog');
    closeDialog('select-department-dialog');
    closeDialog('upload-excel-dialog');
    replaceEmployeesInDepartment(_pendingImportDeptId, _pendingImportEmployees);
    _pendingImportEmployees = [];
    _pendingImportDeptId    = null;
}

function confirmImportUpdate() {
    closeDialog('import-mode-dialog');
    closeDialog('select-department-dialog');
    closeDialog('upload-excel-dialog');
    addEmployeesToDepartment(_pendingImportDeptId, _pendingImportEmployees);
    renderTables();
    _pendingImportEmployees = [];
    _pendingImportDeptId    = null;
}

// ✅ دالة معالجة الإكسل النهائية
async function processExcelFile(departmentId) {
    const fileInput = document.getElementById('excel-file-input');
    const file = fileInput?.files?.[0];
    if (!file) {
        alert('الرجاء اختيار ملف إكسل أولاً');
        return;
    }

    const statusArea = document.getElementById('import-status-area');
    if (statusArea) statusArea.innerHTML = `<h4><i class="fas fa-spinner fa-spin"></i> جاري معالجة الملف...</h4>`;

    try {
        const newEmployees = await processAndFilterExcelData(file);
        if (newEmployees.length === 0) {
            throw new Error("لم يتم العثور على بيانات موظفين صالحة في الملف.");
        }

        const employeesWithoutIqama = newEmployees.filter(emp => !emp.iqamaId);
        let employeesWithIqama = newEmployees.filter(emp => emp.iqamaId);

        if (employeesWithoutIqama.length > 0) {
            const names = employeesWithoutIqama.map(e => e.name).join('، ');
            const msg = `تحذير: ${employeesWithoutIqama.length} موظف بدون رقم إقامة:\n\n(${names})\n\nهل تريد استيراد الآخرين فقط؟`;
            if (!confirm(msg)) {
                if (statusArea) statusArea.innerHTML = `<p class="status-skipped">تم إلغاء العملية.</p>`;
                fileInput.value = '';
                return;
            }
        }

        // عرض نافذة الاختيار بدلاً من الإضافة المباشرة
        showImportModeDialog(departmentId, employeesWithIqama);

    } catch (error) {
        if (statusArea) statusArea.innerHTML = `<p class="status-error">✗ فشل استيراد الملف: ${error.message}</p>`;
        else alert(`فشل استيراد الملف: ${error.message}`);
    }
}

// ✅✅✅ [دالة مساعدة جديدة: لفصل منطق القراءة عن منطق الحفظ] ✅✅✅
/* ================================================================ */
/* ================================================================ */
/* ✅✅✅ دالة الإكسل النهائية (مع إصلاح منطق قراءة الجنسية) ✅✅✅ */
/* ================================================================ */

function processAndFilterExcelData(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

                if (jsonData.length === 0) {
                    return reject(new Error("الملف فارغ أو لا يمكن قراءته."));
                }

                let headerRowIndex = -1;
                for (let i = 0; i < Math.min(10, jsonData.length); i++) {
                    const row = jsonData[i].map(cell => String(cell).toLowerCase().trim());
                    if (row.some(c => c.includes("مسمى الوظيفة")) && row.some(c => c.includes("اسم شاغل الوظيفة"))) {
                        headerRowIndex = i;
                        break;
                    }
                }
                if (headerRowIndex === -1) {
                    return reject(new Error("لم يتم العثور على صف العناوين."));
                }
                
                const headers = jsonData[headerRowIndex].map(h => String(h).trim());
                
                const jobTitleIndex = headers.findIndex(h => h.includes("مسمى الوظيفة"));
                const nameIndex = headers.findIndex(h => h.includes("اسم شاغل الوظيفة"));
                const salaryIndex = headers.findIndex(h => h.includes("التكلفة الشهرية"));
                const categoryIndex = headers.findIndex(h => h.includes("الفئة"));
                const nationalityIndex = headers.findIndex(h => h.includes("الجنسية"));
                const iqamaIdIndex = headers.findIndex(h => h.includes("رقم الاقامة") || h.includes("رقم الإقامة"));

                const employees = [];
                const { daysInMonth } = getExtractPeriodDetails();
                const ignoredNames = ["اسم شاغل الوظيفة", "مندوب المقاول", "غير محدد", "مدير المركز", ""];

                for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
                    const row = jsonData[i];
                    if (!row || row.every(cell => !cell)) continue;

                    const name = String(row[nameIndex] || "").trim();
                    const jobTitle = String(row[jobTitleIndex] || "").trim();

                    if ((!jobTitle && !name) || ignoredNames.includes(name) || jobTitle.includes("مسمى الوظيفة")) {
                        continue;
                    }

                    // =====> هذا هو الجزء الذي تم إصلاحه <=====
                    let nationalityValue = "سعودي"; // القيمة الافتراضية
                    if (nationalityIndex !== -1 && String(row[nationalityIndex]).trim() !== "") {
                        // إذا وجدنا العمود، وكانت الخلية ليست فارغة، نستخدم قيمتها
                        nationalityValue = String(row[nationalityIndex]).trim();
                    }
                    // =====> نهاية الإصلاح <=====
    console.log(`الموظف: ${name}, الجنسية المقروءة من الملف: "${String(row[nationalityIndex]).trim()}", الجنسية النهائية: "${nationalityValue}"`);

                    employees.push({
                        jobTitle: jobTitle,
                        name: name,
                        salary: parseFloat(row[salaryIndex]) || 0,
                        category: normalizeAttendanceCategory(row[categoryIndex]),
                        nationality: nationalityValue, // استخدام القيمة الصحيحة هنا
                        iqamaId: String(row[iqamaIdIndex] || "").trim(),
                        nationalityFine: 0,
                        days: Array(daysInMonth).fill('ح')
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

// ===== 5. عرض الجداول والحسابات مع القوائم المنسدلة - النسخة المصححة =====

/**
 * الجزء 4: عرض الجداول والحسابات
 * يحتوي على دالة renderTables لعرض الجداول مع تطبيق معادلة الشراء المباشر
 */function renderTables() {
    try {
        const attendanceData = getAttendanceData();
        const { daysInMonth, totalDaysInMonth, monthDaysArray } = getExtractPeriodDetails();
        const contractData = JSON.parse(localStorage.getItem('persistentContractData') || '{}');
        const contractType = contractData.contractType || localStorage.getItem('contractType') || 'عقد أساسي';
        const directPurchaseRatio = parseFloat(contractData.directPurchaseRatio || localStorage.getItem('directPurchaseRatio') || 0);

        const departments = [
            { id: 'cleaning', key: 'cleaning', number: 1 },
            { id: 'electricity', key: 'electricity', number: 2 },
            { id: 'agriculture', key: 'agriculture', number: 3 },
            { id: 'civil-works', key: 'civil_works', number: 4 },
            { id: 'mechanical', key: 'mechanical', number: 5 },
            { id: 'security', key: 'security', number: 5 },
            { id: 'laundry', key: 'laundry', number: 6 },
            { id: 'patient-services', key: 'patient_services', number: 7 },
            { id: 'admin-saudi', key: 'admin_saudi', number: 8 }
        ];

        let usedSpecialStatuses = new Set();
        let grandTotalCount = 0;
        let grandTotalCost = 0;
        let grandTotalDeduction = 0;
        let grandTotalFine = 0;
        let grandTotalCostBeforePMDeduction = 0; // <--- أضف هذا السطر


        departments.forEach(dept => {
            // تحديث عنوان الجدول (h3)
            const deptName = getDepartmentName(dept.key);
            const _tableEl = document.querySelector(`#${dept.id}-table`);
            if (!_tableEl) return; // هذا القسم غير موجود في هذه الصفحة — تجاهله
            const tableHeader = _tableEl.closest('.department-table').querySelector('h3');

            if (tableHeader) {
                tableHeader.textContent = `جدول رقم ${dept.number}: ${deptName}`;
            }

            const deptData = attendanceData[dept.key] || [];
            const tableBody = document.getElementById(`${dept.id}-table-body`);
            if (!tableBody) return;

            const daysHeader = document.getElementById(`${dept.id}-days-header`);
            if (daysHeader) {
                daysHeader.setAttribute('colspan', daysInMonth);
            }
  const allSpecialStatusesInDept = new Set();
    deptData.forEach(emp => {
        (Array.isArray(emp.days) ? emp.days : []).forEach(day => {
            if (STATUS_CODES[day]?.isSpecial) {
                allSpecialStatusesInDept.add(day);
            }
        });
    });
// ====================>   هذا هو الكود البديل والنهائي   <====================
// 1. تنظيف وإعادة بناء رأس الجدول بالتسلسل الصحيح
const headerRow = document.getElementById(`${dept.id}-table-header`);
if (headerRow) {
    headerRow.innerHTML = ''; // مسح الرؤوس القديمة للأيام

    // بناء رؤوس الأيام الجديدة باستخدام التسلسل الصحيح (مثل 17, 18, 19...)
    monthDaysArray.forEach(dayNumber => {
        const th = document.createElement('th');
        th.textContent = dayNumber;
        headerRow.appendChild(th);
    });

    // إعادة إضافة رؤوس الإجماليات الثابتة
    ['حضور', 'غياب', 'الحسم', 'غرامة الغياب'].forEach(label => {
        const th = document.createElement('th');
        th.textContent = label;
        headerRow.appendChild(th);
    });
}

// 2. تنظيف الرؤوس العلوية (للحالات الخاصة)
const firstHeaderRow = document.querySelector(`#${dept.id}-table thead tr:first-child`);
if (firstHeaderRow) {
    const existingStatusHeaders = firstHeaderRow.querySelectorAll('.status-header');
    existingStatusHeaders.forEach(header => header.remove());
}

// 3. تجهيز جسم الجدول والمتغيرات للحسابات
tableBody.innerHTML = '';
let deptTotalCost = 0;
let deptTotalDeduction = 0;
let deptTotalFine = 0;
let deptTotalNetSalary = 0;
let deptAbsentEmployees = 0;
let deptStatusTotals = {};
// ... بجانب let deptTotalNetSalary = 0; ...
let deptStatusDetails = {}; // ✅✅✅ أضف هذا السطر ✅✅✅

const emptyMessage = document.getElementById(`${dept.id}-empty`);
if (emptyMessage) {
    emptyMessage.style.display = deptData.length === 0 ? 'block' : 'none';
}
// =========================================================================

            deptData.forEach((emp, index) => {
                const row = document.createElement('tr');
                const salary = parseFloat(emp.salary) || 0;
const category = normalizeAttendanceCategory(emp.category);
emp.category = category;                const nationality = emp.nationality || 'سعودي';
                const isSaudi = nationality.trim() === 'سعودي';

                let adjustedSalary = salary;
                if (contractType === 'شراء مباشر' && directPurchaseRatio > 0) {
                    adjustedSalary = salary + (salary * directPurchaseRatio / 100);

                }

                grandTotalCostBeforePMDeduction += adjustedSalary; // <--- أضف هذا السطر

                let days = Array.isArray(emp.days) ? emp.days : Array(daysInMonth).fill('ح');
                if (days.length < daysInMonth) {
                    days = [...days, ...Array(daysInMonth - days.length).fill('ح')];
                }
                days = days.slice(0, daysInMonth);

                let attendanceDays = 0;
                let absenceDays = 0;
                let deductionOnlyDays = 0;
                let statusCounts = {};

                days.forEach(day => {
                    const status = STATUS_CODES[day] || STATUS_CODES.default;
                    if (day === 'ح' || day === 'ت') {
                        attendanceDays++;
                    } else if (day === 'غ') {
                        absenceDays++;
                    } else {
                        deductionOnlyDays++;
                    }
                    if (status.isSpecial) {
                        statusCounts[day] = (statusCounts[day] || 0) + 1;
                        usedSpecialStatuses.add(day);
                    }
                });
// ===================================================================
//      ✅✅✅ هنا تضع الخطوة الثانية (كود تحديث تفاصيل الحالات) ✅✅✅
// ===================================================================
Object.keys(statusCounts).forEach(statusKey => {
    if (!deptStatusDetails[statusKey]) {
        // إذا كانت هذه أول مرة نرى فيها هذه الحالة، ننشئ لها كائنًا
        deptStatusDetails[statusKey] = { employeeCount: 0, dayCount: 0 };
    }
    // زيادة عدد الموظفين لهذه الحالة بمقدار 1
    deptStatusDetails[statusKey].employeeCount += 1;
    // إضافة عدد أيام هذه الحالة من هذا الموظف إلى الإجمالي
    deptStatusDetails[statusKey].dayCount += statusCounts[statusKey];
});
// ===================================================================
                                        let dailySalary = adjustedSalary / totalDaysInMonth; // <--- تم نقل التعريف إلى هنا (خارج الشرط)
                let extractBaseSalary;

                // المنطق الجديد: إذا كانت مدة المستخلص تغطي شهرًا كاملاً أو أكثر
                if (daysInMonth >= totalDaysInMonth) {
                    extractBaseSalary = adjustedSalary; // الراتب الشهري الكامل
                } else {
                    // إذا كانت مدة المستخلص أقل من شهر كامل
                    extractBaseSalary = dailySalary * daysInMonth; // <--- هنا نستخدم dailySalary المعرف بالخارج
                }

                const deduction = (absenceDays + deductionOnlyDays) * dailySalary; // <--- الآن dailySalary معرف

                const fineConfig = ABSENCE_FINES_BY_CATEGORY[category] || ABSENCE_FINES_BY_CATEGORY.default;
                const fine = absenceDays * (isSaudi ? fineConfig.saudi : fineConfig.non_saudi);
                const nationalityFine = parseFloat(emp.nationalityFine) || 0;
                const totalFine = fine + nationalityFine;
                const netSalary = extractBaseSalary - deduction - totalFine;

                emp.absenceDays = absenceDays;
                emp.attendanceDays = attendanceDays;
                emp.deduction = deduction;
                emp.absencePenalty = fine;
                emp.totalFine = totalFine;
                emp.netSalary = netSalary;

// --- START: التعديل المطلوب لحساب التكلفة الصحيحة ---
deptTotalCost += extractBaseSalary; // اجمع التكلفة المحسوبة حسب أيام المستخلص
// --- END: التعديل المطلوب ---

                deptTotalDeduction += deduction;
                deptTotalFine += totalFine;
                deptTotalNetSalary += netSalary;
                if (absenceDays > 0) {
                    deptAbsentEmployees++;
                }

                Object.keys(statusCounts).forEach(status => {
                    deptStatusTotals[status] = (deptStatusTotals[status] || 0) + statusCounts[status];
                });

                const cells = [];
                cells.push(`<td>${index + 1}</td>`);
                cells.push(`<td class="job-title">${emp.jobTitle || ''}</td>`);
                cells.push(`<td class="category-cell"></td>`);
                cells.push(`<td class="employee-name">${emp.name || ''}</td>`);
// --- START: التعديل المطلوب لتحديث رؤوس الأيام ---
if (index === 0) { // نفذ هذا الكود مرة واحدة فقط لكل قسم
    const headerRow = document.getElementById(`${dept.id}-table-header`);
    if(headerRow) {
        headerRow.innerHTML = ''; // مسح الرؤوس القديمة
        monthDaysArray.forEach(dayNumber => {
            const th = document.createElement('th');
            th.textContent = dayNumber;
            headerRow.appendChild(th);
        });
        // إعادة إضافة رؤوس الأعمدة الثابتة
        ['حضور', 'غياب', 'الحسم', 'غرامة الغياب'].forEach(label => {
            const th = document.createElement('th');
            th.textContent = label;
            headerRow.appendChild(th);
        });
    }
}
// --- END: التعديل المطلوب ---

                days.forEach((day, dayIndex) => {
                    const status = STATUS_CODES[day] || STATUS_CODES.default;
                    cells.push(`<td class="day-cell" style="background-color: ${status.color}; padding: 2px;" data-day-index="${dayIndex}"></td>`);
                });

// --- START: التعديل المطلوب لعرض التكلفة الصحيحة ---
cells.push(`<td>${extractBaseSalary.toFixed(2)}</td>`);
// --- END: التعديل المطلوب ---
                cells.push(`<td>${attendanceDays}</td>`);
                cells.push(`<td>${absenceDays}</td>`);
                cells.push(`<td>${deduction.toFixed(2)}</td>`);
                cells.push(`<td>${fine.toFixed(2)}</td>`);
                cells.push(`<td>${netSalary.toFixed(2)}</td>`);
                cells.push(`<td class="nationality-cell"></td>`);
                cells.push(`<td><input type="number" value="${nationalityFine}" 
                             readonly 
                             data-dept="${dept.key}" 
                             data-index="${index}"
                             style="width: 80px; background-color: #f8f9fa; cursor: not-allowed;" 
                             title="يمكن تعديل هذا الحقل فقط من خلال زر 'تعديل غرامة الجنسية'"></td>`);
               // ✅ ضع هذا الكود الجديد مكانه
cells.push(`
    <td class="iqama-col">
        <input type="text" value="${emp.iqamaId || ''}" 
               class="iqama-input no-print" 
               data-dept="${dept.key}" 
               data-index="${index}"
               onchange="updateEmployeeIqama(this.dataset.dept, this.dataset.index, this.value)"
               style="width: 90px; text-align: center; border: 1px solid #ccc; border-radius: 4px; font-size: 11px;">
        <span class="print-only" style="display: none; font-weight: bold; font-size: 10px;">${emp.iqamaId || ''}</span>
    </td>
`);

               // ===================================================================
//      ✅✅✅ النسخة النهائية (مع إخفاء الأصفار) ✅✅✅
// ===================================================================
allSpecialStatusesInDept.forEach(status => {
    // احصل على العدد، أو اعتبره صفرًا إذا لم يكن موجودًا
    const count = statusCounts[status] || 0;
    
    // أنشئ الخلية: إذا كان العدد أكبر من صفر، اعرضه. وإلا، اعرض خلية فارغة.
    const cellContent = count > 0 ? count : ''; 
    
    cells.push(`<td class="status-${status.toLowerCase()}-col" style="display: none;">${cellContent}</td>`);
});
// ===================================================================


                row.innerHTML = cells.join('');

                const rowCells = row.querySelectorAll('td');
                const categoryCell = rowCells[2];
                const categorySelect = createCategorySelect(category, dept.key, index);
                categoryCell.appendChild(categorySelect);

                const dayCells = row.querySelectorAll('.day-cell');
                dayCells.forEach((dayCell, dayIndex) => {
                    const dayStatus = days[dayIndex] || 'ح';
                    const attendanceSelect = createAttendanceSelect(dayStatus, dept.key, index, dayIndex);
                    const status = STATUS_CODES[dayStatus] || STATUS_CODES.default;
                    attendanceSelect.classList.add(dayStatus === 'ح' ? 'present' : dayStatus === 'غ' ? 'absent' : status.name.toLowerCase().replace(/\s+/g, '-'));
                    dayCell.appendChild(attendanceSelect);
                });

                const nationalityCell = row.querySelector('.nationality-cell');
                const nationalitySelect = createNationalitySelect(nationality, dept.key, index);
                nationalityCell.appendChild(nationalitySelect);

                tableBody.appendChild(row);
            });

            if (firstHeaderRow && usedSpecialStatuses.size > 0 && !firstHeaderRow.hasAttribute('data-special-headers-added')) {
                const existingHeaders = firstHeaderRow.querySelectorAll('.status-header');
                existingHeaders.forEach(header => header.remove());

                Array.from(usedSpecialStatuses).forEach(status => {
                    const statusHeader = document.createElement('th');
                    statusHeader.className = `status-header status-${status.toLowerCase()}-col`;
                    statusHeader.textContent = STATUS_CODES[status]?.name || 'غير معروف';
                    statusHeader.setAttribute('rowspan', '2');
                    statusHeader.style.display = 'none';
                    firstHeaderRow.appendChild(statusHeader);
                });
                firstHeaderRow.setAttribute('data-special-headers-added', 'true');
            }

           // ===================================================================
//      ✅✅✅ بناء شريط الإجمالي النهائي (مقسم إلى سطرين) ✅✅✅
// ===================================================================
const totalContainer = document.querySelector(`#${dept.id}-table`).closest('.department-table').querySelector('.total');
if (totalContainer) {
    // --- 1. بناء سطر الإحصائيات (السطر الثاني) ---
    // نبدأ بعدد الموظفين الغائبين
    let statsText = `<strong>إحصائيات:</strong> موظفون بغياب: ${deptAbsentEmployees}`;
    
    // نضيف تفاصيل الحالات الخاصة إذا كانت موجودة
    const statusDetails = Object.keys(deptStatusDetails).map(statusKey => {
        const details = deptStatusDetails[statusKey];
        const statusInfo = STATUS_CODES[statusKey] || STATUS_CODES.default;
        return `<strong>${statusInfo.name}:</strong> ${details.employeeCount} موظفين (${details.dayCount} يوم)`;
    }).join(' | ');

    if (statusDetails) {
        statsText += ` | ${statusDetails}`;
    }

    // --- 2. بناء سطر الإجماليات المالي (السطر الأول) ---
    const mainTotalsText = `
        <strong>الإجمالي:</strong> 
        عدد الموظفين: ${deptData.length} | 
        التكلفة الشهرية: ${deptTotalCost.toFixed(2)} | 
        إجمالي الحسم: ${deptTotalDeduction.toFixed(2)} | 
        إجمالي الغرامة: ${deptTotalFine.toFixed(2)} | 
        <strong>صافي الاستحقاق: ${deptTotalNetSalary.toFixed(2)}</strong>
    `;

    // --- 3. دمج السطرين ووضعهما في الحاوية ---
    totalContainer.innerHTML = `
        <div style="text-align: right; font-size: 14px; line-height: 1.6;">${mainTotalsText}</div>
        <div style="margin-top: 5px; text-align: right; font-size: 13px; color: #555; line-height: 1.6;">${statsText}</div>
    `;
}
// ===================================================================


localStorage.setItem(`deptCalculatedCost_${dept.key}`, deptTotalCost.toFixed(2));

            grandTotalCount += deptData.length;
            grandTotalCost += deptTotalCost;
            grandTotalDeduction += deptTotalDeduction;
            grandTotalFine += deptTotalFine;
        });

updateGrandTotals(grandTotalCount, grandTotalCost, grandTotalDeduction, grandTotalFine); // <--- السطر الصحيح
        updateSpecialStatusColumns(usedSpecialStatuses);
        updateStatusLegend(usedSpecialStatuses);
// rebuildTableHeaders();
    } catch (error) {
        console.error('خطأ في عرض الجداول:', error);
    }
}


/**
 * ===================================================================
 *      ===>  تحديث الإجمالي العام (النسخة المدمجة في الصفحة)  <===
 * ===================================================================
 * @description تعرض الإجماليات العامة في شريط أنيق فوق قسم التواقيع.
 * @param {number} count - إجمالي عدد الموظفين.
 * @param {number} cost - إجمالي التكلفة قبل الحسم.
 * @param {number} deduction - إجمالي الحسميات.
 * @param {number} fine - إجمالي الغرامات.
 */
function updateGrandTotals(count, cost, deduction, fine) {
  try {
    let grandTotalContainer = document.getElementById('grand-total-container');
    if (!grandTotalContainer) {
      grandTotalContainer = document.createElement('div');
      grandTotalContainer.id = 'grand-total-container';
      grandTotalContainer.className = 'grand-total-professional'; // اسم كلاس جديد للتصميم الاحترافي
      
      const anchor = document.getElementById('grand-total-anchor');
      if (anchor) {
        anchor.appendChild(grandTotalContainer);
      } else {
        document.querySelector('.container').appendChild(grandTotalContainer);
      }
    }

    const totalFines = deduction + fine;
    const netTotal = cost - totalFines;

    // حفظ صافي الاستحقاق للربط مع صفحة المستهلكات
    try { localStorage.setItem('finalLaborCost', netTotal.toFixed(2)); } catch (_) {}

    // ====> التعديل هنا: إضافة class لكل عنصر <====
    grandTotalContainer.innerHTML = `
      <div class="total-card total-employees">
        <div class="card-icon"><i class="fas fa-users"></i></div>
        <div class="card-content">
          <span class="label">إجمالي الموظفين</span>
          <span class="value">${count}</span>
        </div>
      </div>
      <div class="total-card total-cost">
        <div class="card-icon"><i class="fas fa-file-invoice-dollar"></i></div>
        <div class="card-content">
          <span class="label">إجمالي التكلفة</span>
          <span class="value">${cost.toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })}</span>
        </div>
      </div>
      <div class="total-card total-deductions">
        <div class="card-icon"><i class="fas fa-arrow-down"></i></div>
        <div class="card-content">
          <span class="label">إجمالي الحسميات والغرامات</span>
          <span class="value">${totalFines.toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })}</span>
        </div>
      </div>
      <div class="total-card total-net">
        <div class="card-icon"><i class="fas fa-check-circle"></i></div>
        <div class="card-content">
          <span class="label">صافي الاستحقاق</span>
          <span class="value">${netTotal.toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })}</span>
        </div>
      </div>
    `;
  } catch (error) {
    console.error('خطأ في تحديث شريط الإجماليات العامة:', error);
  }
}
/**
 * دالة لتحديث رقم الإقامة أو الهوية للموظف
 */
function updateEmployeeIqama(departmentKey, employeeIndex, newIqamaId) {
  try {
    const data = getAttendanceData();
    const employee = data[departmentKey]?.[employeeIndex];
    if (!employee) return;

    employee.iqamaId = newIqamaId.trim(); // تحديث القيمة مع إزالة المسافات الزائدة
    saveAttendanceData(data);
    
    // لا نحتاج لـ renderTables() هنا إلا إذا كانت هناك حسابات تعتمد على رقم الإقامة
    // هذا يجعل التعديل أسرع
    showSuccessMessage(`تم تحديث رقم الإقامة للموظف ${employee.name || ''} بنجاح.`);

  } catch (error) {
    console.error('خطأ في تحديث رقم الإقامة:', error);
  }
}

function updateSpecialStatusColumns(usedStatuses) {
  try {
    // إخفاء جميع أعمدة الحالات الخاصة أولاً
    const allStatusColumns = document.querySelectorAll('[class*="status-"][class*="-col"]');
    allStatusColumns.forEach(col => col.style.display = 'none');

    // إظهار الأعمدة المستخدمة فقط وتجنب التكرار
    const processedStatuses = new Set();
    
    usedStatuses.forEach(status => {
      if (!processedStatuses.has(status)) {
        processedStatuses.add(status);
        const columns = document.querySelectorAll(`.status-${status.toLowerCase()}-col`);
        columns.forEach(col => {
          // التأكد من عدم وجود تكرار
          if (col.style.display !== 'table-cell') {
            col.style.display = 'table-cell';
          }
        });
      }
    });
  } catch (error) {
    console.error('خطأ في تحديث أعمدة الحالات:', error);
  }
}

function updateStatusLegend(usedStatuses) {
  try {
    const legendElement = document.getElementById('status-legend');
    const legendContent = document.getElementById('status-legend-content');
    
    if (!legendElement || !legendContent) return;

    if (usedStatuses.size > 0) {
      const legendItems = Array.from(usedStatuses).map(status => {
        const statusInfo = STATUS_CODES[status] || STATUS_CODES.default;
        return `<span style="background-color: ${statusInfo.color}; padding: 2px 8px; margin: 2px; border-radius: 3px;">${status} - ${statusInfo.name}</span>`;
      });
      
      legendContent.innerHTML = legendItems.join(' ');
      legendElement.style.display = 'block';
    } else {
      legendElement.style.display = 'none';
    }
  } catch (error) {
    console.error('خطأ في تحديث دليل الحالات:', error);
  }
}

// ===== 6. دوال مساعدة =====

function getAttendanceData() {
  try {
    const data = localStorage.getItem('attendanceData');
    return data ? JSON.parse(data) : {
      cleaning: [],
      electricity: [],
      agriculture: [],
      civil_works: [],
      mechanical: [],
      laundry: [],
      patient_services: [],
      admin_saudi: [] // ✅ إضافة هذا السطر
    };
  } catch (error) {
    console.error('خطأ في قراءة بيانات الحضور:', error);
    return {
      cleaning: [],
      electricity: [],
      agriculture: [],
      civil_works: [],
      mechanical: [],
      laundry: [],
      patient_services: [],
      admin_saudi: [] // ✅ إضافة نفس السطر هنا أيضًا
    };
  }
}

function saveAttendanceData(data) {
  try {
    try {
  Object.keys(data || {}).forEach(function (deptKey) {
    if (!Array.isArray(data[deptKey])) return;
    data[deptKey].forEach(function (emp) {
      emp.category = normalizeAttendanceCategory(emp.category);
    });
  });
} catch (_) {}
    localStorage.setItem('attendanceData', JSON.stringify(data));

    try {
      var totalRows = 0;
      Object.keys(data || {}).forEach(function (k) {
        if (Array.isArray(data[k])) totalRows += data[k].length;
      });

      if (totalRows > 0) {
        sessionStorage.removeItem('najran_new_extract_clear_attendance_once');
        localStorage.removeItem('najran_new_extract_clear_attendance_once');
        console.warn('[AttendanceSave] تم إنهاء وضع مسح المستخلص الجديد بعد حفظ عمالة جديدة');
      }
    } catch (_) {}

  } catch (error) {
    console.error('خطأ في حفظ بيانات الحضور:', error);
    alert('حدث خطأ أثناء حفظ البيانات');
  }
}

// ✅ دالة منع التكرار — تفحص رقم الإقامة والاسم معاً عبر جميع الأقسام
function addEmployeesToDepartment(departmentKey, newEmployees) {
    try {
        const allData = getAttendanceData();
        let addedCount = 0;
        let skippedCount = 0;
        let skippedInfo = '';

        newEmployees.forEach(newEmp => {
            const newIqama = (newEmp.iqamaId || '').trim();
            const newName  = (newEmp.name  || '').trim().toLowerCase();
            let dupReason  = null;
            let dupDept    = null;

            for (const deptKey in allData) {
                for (const emp of (allData[deptKey] || [])) {
                    // فحص تكرار رقم الإقامة (إذا كان غير فارغ)
                    if (newIqama && (emp.iqamaId || '').trim() === newIqama) {
                        dupReason = `رقم إقامة مكرر (${newIqama})`;
                        dupDept   = deptKey;
                        break;
                    }
                    // فحص تكرار اسم شاغل الوظيفة (إذا كان غير فارغ)
                    if (newName && (emp.name || '').trim().toLowerCase() === newName) {
                        dupReason = `اسم مكرر`;
                        dupDept   = deptKey;
                        break;
                    }
                }
                if (dupReason) break;
            }

            if (dupReason) {
                skippedCount++;
                skippedInfo += `\n- "${newEmp.name}" — ${dupReason} (موجود في: ${getDepartmentName(dupDept)})`;
            } else {
                if (!allData[departmentKey]) allData[departmentKey] = [];
                allData[departmentKey].push(newEmp);
                addedCount++;
            }
        });

        saveAttendanceData(allData);

        let alertMessage = `اكتملت العملية:\n- تم إضافة ${addedCount} موظف بنجاح.`;
        if (skippedCount > 0) {
            alertMessage += `\n\n- تم تجاهل ${skippedCount} موظف (تكرار):${skippedInfo}`;
        }
        alert(alertMessage);

    } catch (error) {
        console.error('خطأ في إضافة الموظفين:', error);
        alert('حدث خطأ أثناء إضافة الموظفين');
    }
}


function toggleStatus(departmentKey, employeeIndex, dayIndex) {
  try {
    const data = getAttendanceData();
    const employee = data[departmentKey]?.[employeeIndex];
    if (!employee) return;

    const currentStatus = employee.days[dayIndex] || 'ح';
    const statusKeys = Object.keys(STATUS_CODES);
    const currentIndex = statusKeys.indexOf(currentStatus);
    const nextIndex = (currentIndex + 1) % statusKeys.length;
    
    employee.days[dayIndex] = statusKeys[nextIndex];
    saveAttendanceData(data);
    renderTables();
  } catch (error) {
    console.error('خطأ في تبديل الحالة:', error);
  }
}

function updateNationalityFine(departmentKey, employeeIndex, value) {
  try {
    const data = getAttendanceData();
    const employee = data[departmentKey]?.[employeeIndex];
    if (!employee) return;

    employee.nationalityFine = parseFloat(value) || 0;
    saveAttendanceData(data);
    renderTables();
  } catch (error) {
    console.error('خطأ في تحديث غرامة الجنسية:', error);
  }
}

function getExtractPeriodDetails(startDate, endDate) {
  try {
    // محاولة الحصول على البيانات من localStorage أولاً
    const persistentData = JSON.parse(localStorage.getItem('persistentExtractData') || '{}');
    
    // استخدام التواريخ المرسلة أو المحفوظة أو القيم الافتراضية
    const extractStart = startDate || persistentData.extractStart || null;
    const extractEnd = endDate || persistentData.extractEnd || null;
    
    function parseLocalDate(str) {
      if (!str) return null;
      const parts = str.split('-');
      if (parts.length === 3) return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return new Date(str);
    }
    const start = extractStart ? parseLocalDate(extractStart) : new Date();
    const end = extractEnd ? parseLocalDate(extractEnd) : new Date();
    
    // لو مفيش تواريخ محفوظة، نحسب المدة من أول الشهر لنهايته
    if (!extractStart || !extractEnd) {
      const now = new Date();
      start.setDate(1);                      // أول يوم في الشهر
      end.setMonth(now.getMonth() + 1, 0);   // آخر يوم في الشهر
    }

    const daysInMonth = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    
    // حساب عدد أيام الشهر الكامل
    const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
    const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    const totalDaysInMonth = monthEnd.getDate();
    
    const monthDaysArray = [];

    for (let i = 0; i < daysInMonth; i++) {
      const currentDate = new Date(start);
      currentDate.setDate(start.getDate() + i);
      monthDaysArray.push(currentDate.getDate());
    }

    return {
      startDay: start.getDate(),
      endDay: end.getDate(),
      daysInMonth: Math.max(1, daysInMonth), // عدد أيام المستخلص
      totalDaysInMonth: totalDaysInMonth, // عدد أيام الشهر الكامل
      monthDaysArray,
      monthName: start.toLocaleDateString('ar-SA', { month: 'long' }),
      year: start.getFullYear()
    };
  } catch (error) {
    console.error('خطأ في حساب تفاصيل المستخلص:', error);
    return {
      startDay: 1,
      endDay: 30,
      daysInMonth: 30,
      totalDaysInMonth: 30,
      monthDaysArray: Array.from({ length: 30 }, (_, i) => i + 1),
      monthName: 'غير محدد',
      year: new Date().getFullYear()
    };
  }
}
function formatDate(dateString) {
    if (!dateString || dateString === 'غير محدد') return 'غير محدد';
    try {
        const date = new Date(dateString);
        const gregorian = date.toLocaleDateString('en-GB');
        return gregorian.replace(
            /(\d{2})\/(\d{2})\/(\d{4})/,
            (m, d, mth, y) => `${parseInt(d)}/${parseInt(mth)}/${y} م`
        );
    } catch (e) {
        return dateString;
    }
}

// ===== 7. تهيئة الصفحة =====

document.addEventListener('DOMContentLoaded', function() {
  try {
    updateContractDisplayData();
    renderTables();
    updateDateTime();
    setInterval(updateDateTime, 60000);
        displaySignaturesOnPage(); // <-- أضف هذا السطر المهم هنا

    console.log('تم تحميل صفحة الحضور والانصراف التفاعلية المصححة بنجاح');
  } catch (error) {
    console.error('خطأ في تهيئة الصفحة:', error);
  }
});

function updateDateTime() {
    const now = new Date();
    const dateTimeElement = document.getElementById('current-date-time');
    if (dateTimeElement) {
        // اسم اليوم بالعربي
        const dayName = now.toLocaleDateString('ar-EG', { weekday: 'long' });
        // التاريخ ميلادي (سنة/شهر/يوم)
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const dateStr = `${year}/${month}/${day}`;
        // الوقت 24 ساعة
        const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        // النتيجة النهائية
        dateTimeElement.textContent = `${dayName} ${dateStr} م ${timeStr}`;
    }
}

// ===== دوال تعديل وحذف الموظفين =====
/**
 * @function displaySignaturesOnPage
 * @description تقرأ التواقيع المحفوظة من localStorage وتعرضها في قسم العرض الدائم.
 */
function displaySignaturesOnPage() {
    // 1. تحديد الحاوية التي سنضع فيها التواقيع
    const container = document.querySelector('.signatures-display-section .signatures-grid');
    if (!container) {
        console.error('خطأ: لم يتم العثور على حاوية عرض التواقيع (.signatures-grid)');
        return; // الخروج من الدالة إذا لم نجد الحاوية
    }

    // 2. تعريف التواقيع التي نريد عرضها ومفاتيحها في localStorage
    const signaturesToDisplay = [
        { keyName: 'projectManagerName', keyTitle: 'projectManagerTitle', defaultTitle: 'مدير المشروع' },
        { keyName: 'maintenanceHeadName', keyTitle: 'maintenanceHeadTitle', defaultTitle: 'رئيس قسم الصيانة' },
        { keyName: 'hospitalManagerName', keyTitle: 'hospitalManagerTitle', defaultTitle: 'مدير المستشفى' },
        { keyName: 'contractorRepresentativeName', keyTitle: 'contractorRepresentativeTitle', defaultTitle: 'مندوب المقاول' }
    ];

    let htmlContent = ''; // سنقوم ببناء كود الـ HTML هنا

    // 3. جلب البيانات المحفوظة من localStorage
    const contractData = JSON.parse(localStorage.getItem('persistentContractData') || '{}');

    // 4. المرور على كل توقيع لإنشاء كود العرض الخاص به
    signaturesToDisplay.forEach(sig => {
        // الحصول على الاسم والمسمى الوظيفي من البيانات المحفوظة، أو استخدام قيمة افتراضية
        const name = contractData[sig.keyName] || '..............................'; // نص افتراضي أنيق
        const title = contractData[sig.keyTitle] || sig.defaultTitle;

        // بناء كود HTML لكل توقيع باستخدام التنسيقات الجديدة
        htmlContent += `
            <div class="signature-item-display">
                <div class="title">${title}:</div>
                <div class="line"></div>
                <div class="name">${name}</div>
            </div>
        `;
    });

    // 5. وضع المحتوى المكتمل داخل الحاوية في الصفحة
    container.innerHTML = htmlContent;
}

function deleteEmployee(departmentKey, employeeIndex) {
  if (confirm('هل أنت متأكد من رغبتك في حذف هذا الموظف؟ لا يمكن التراجع عن هذه العملية.')) {
    try {
      const data = getAttendanceData();
      if (data[departmentKey] && data[departmentKey][employeeIndex]) {
        // حذف الموظف من المصفوفة
        data[departmentKey].splice(employeeIndex, 1);
        saveAttendanceData(data);
        renderTables();
        alert('تم حذف الموظف بنجاح');
      }
    } catch (error) {
      console.error('خطأ في حذف الموظف:', error);
      alert('حدث خطأ أثناء حذف الموظف');
    }
  }
}

function editEmployee(departmentKey, employeeIndex) {
  try {
    const data = getAttendanceData();
    const employee = data[departmentKey]?.[employeeIndex];
    
    if (!employee) {
      alert('لم يتم العثور على الموظف');
      return;
    }

    // إنشاء نافذة تعديل بسيطة
    const newJobTitle = prompt('مسمى الوظيفة:', employee.jobTitle || '');
    if (newJobTitle === null) return; // المستخدم ألغى العملية

    const newName = prompt('اسم الموظف:', employee.name || '');
    if (newName === null) return;

    const newSalary = prompt('الراتب الشهري:', employee.salary || '0');
    if (newSalary === null) return;

    const newCategory = prompt('الفئة (1-7):', employee.category || '1');
    if (newCategory === null) return;

    const newNationality = prompt('الجنسية:', employee.nationality || 'سعودي');
    if (newNationality === null) return;

    // التحقق من صحة البيانات
    const salary = parseFloat(newSalary);
    const category = newCategory.toString();
    
    if (isNaN(salary) || salary < 0) {
      alert('الرجاء إدخال راتب صحيح');
      return;
    }

    if (!['1', '2', '3', '4', '5', '6', '7'].includes(category)) {
      alert('الرجاء إدخال فئة صحيحة (1-7)');
      return;
    }

    // تحديث بيانات الموظف
    employee.jobTitle = newJobTitle.trim();
    employee.name = newName.trim();
    employee.salary = salary;
    employee.category = category;
    employee.nationality = newNationality.trim();

    // حفظ البيانات وإعادة عرض الجداول
    saveAttendanceData(data);
    renderTables();
    alert('تم تعديل بيانات الموظف بنجاح');

  } catch (error) {
    console.error('خطأ في تعديل الموظف:', error);
    alert('حدث خطأ أثناء تعديل الموظف');
  }
}

// دالة تعديل متقدمة باستخدام نافذة منبثقة (اختيارية)
function editEmployeeAdvanced(departmentKey, employeeIndex) {
  try {
    const data = getAttendanceData();
    const employee = data[departmentKey]?.[employeeIndex];
    
    if (!employee) {
      alert('لم يتم العثور على الموظف');
      return;
    }

    const editDialog = document.createElement('div');
    editDialog.id = 'edit-dialog';
    editDialog.className = 'dialog';
    editDialog.innerHTML = `
      <div class="dialog-content">
        <span class="close" onclick="cancelEmployeeEdit()">×</span>
        <h3><i class="fas fa-user-edit" style="color:#003087;"></i> تعديل بيانات الموظف</h3>
        <div class="form-group">
          <label>مسمى الوظيفة:</label>
          <input type="text" id="edit-job-title" value="${employee.jobTitle || ''}">
        </div>
        <div class="form-group">
          <label>اسم الموظف:</label>
          <input type="text" id="edit-name" value="${employee.name || ''}">
        </div>
        <div class="form-group">
          <label>التكلفة الشهرية:</label>
          <input type="number" id="edit-salary" value="${employee.salary || 0}">
        </div>
        <div class="form-group">
          <label>الفئة:</label>
          <select id="edit-category">
            ${[1,2,3,4,5,6,7].map(n => `<option value="${n}" ${employee.category == n ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>الجنسية:</label>
          <select id="edit-nationality">
            ${['سعودي','مصري','هندي','باكستاني','فلبيني','بنجلادش','أخرى'].map(n => `<option value="${n}" ${employee.nationality === n ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
        </div>
        <div class="buttons">
          <button onclick="saveEmployeeEdit('${departmentKey}', ${employeeIndex})" class="confirm-btn">
            <i class="fas fa-save"></i> حفظ التعديلات
          </button>
          <button onclick="cancelEmployeeEdit()" class="cancel-btn">
            <i class="fas fa-times-circle"></i> إلغاء
          </button>
        </div>
      </div>`;

    document.body.appendChild(editDialog);
    editDialog.style.display = 'flex';

  } catch (error) {
    console.error('خطأ في فتح نافذة التعديل:', error);
    alert('حدث خطأ أثناء فتح نافذة التعديل');
  }
}

function saveEmployeeEdit(departmentKey, employeeIndex) {
  try {
    const data = getAttendanceData();
    const employee = data[departmentKey]?.[employeeIndex];
    
    if (!employee) {
      alert('لم يتم العثور على الموظف');
      return;
    }

    // الحصول على القيم الجديدة
    const newJobTitle = document.getElementById('edit-job-title').value.trim();
    const newName = document.getElementById('edit-name').value.trim();
    const newSalary = parseFloat(document.getElementById('edit-salary').value);
    const newCategory = document.getElementById('edit-category').value;
    const newNationality = document.getElementById('edit-nationality').value;

    // التحقق من صحة البيانات
    if (!newJobTitle || !newName) {
      alert('الرجاء إدخال مسمى الوظيفة واسم الموظف');
      return;
    }

    if (isNaN(newSalary) || newSalary < 0) {
      alert('الرجاء إدخال راتب صحيح');
      return;
    }

    // تحديث بيانات الموظف
    employee.jobTitle = newJobTitle;
    employee.name = newName;
    employee.salary = newSalary;
employee.category = normalizeAttendanceCategory(newCategory);    employee.nationality = newNationality;

    // حفظ البيانات وإعادة عرض الجداول
    saveAttendanceData(data);
    renderTables();
    
    // إغلاق النافذة
    cancelEmployeeEdit();
    
    alert('تم تعديل بيانات الموظف بنجاح');

  } catch (error) {
    console.error('خطأ في حفظ تعديل الموظف:', error);
    alert('حدث خطأ أثناء حفظ التعديلات');
  }
}

function cancelEmployeeEdit() {
  const dialog = document.getElementById('edit-dialog');
  if (dialog) dialog.remove();
}


// ===== دالة تعديل غرامة الجنسية مع كلمة المرور =====

let nationalityFineEditMode = false; // متغير لتتبع حالة التعديل

function openNationalityFineEditor() {
  // طلب كلمة المرور
  const password = prompt('أدخل كلمة المرور للوصول إلى تعديل غرامة الجنسية:');
  
  if (password !== 'admin123') {
    if (password !== null) { // إذا لم يضغط المستخدم إلغاء
      alert('كلمة المرور غير صحيحة');
    }
    return;
  }
  
  // تفعيل وضع التعديل
  nationalityFineEditMode = true;
  enableNationalityFineEditing();
  
  // إظهار رسالة نجاح
  showSuccessMessage('تم تفعيل وضع تعديل غرامة الجنسية. يمكنك الآن تعديل القيم في الجدول مباشرة.');
}

function enableNationalityFineEditing() {
  // العثور على جميع حقول غرامة الجنسية وتفعيلها
  const nationalityFineInputs = document.querySelectorAll('input[title*="غرامة الجنسية"]');
  
  nationalityFineInputs.forEach(input => {
    input.removeAttribute('readonly');
    input.style.backgroundColor = '#fff';
    input.style.cursor = 'text';
    input.style.border = '2px solid #28a745';
    input.title = 'يمكنك الآن تعديل غرامة الجنسية. اضغط Enter لحفظ التعديل.';
    
    // إضافة مستمع للضغط على Enter
    input.addEventListener('keypress', function(event) {
      if (event.key === 'Enter') {
        const deptKey = this.getAttribute('data-dept');
        const empIndex = this.getAttribute('data-index');
        updateNationalityFineFromTable(deptKey, empIndex, this.value);
      }
    });
  });
  
  // تغيير نص الزر وإضافة زر إنهاء التعديل
  updateNationalityFineButton();
}

function disableNationalityFineEditing() {
  // العثور على جميع حقول غرامة الجنسية وتعطيلها
  const nationalityFineInputs = document.querySelectorAll('input[title*="غرامة الجنسية"], input[title*="يمكنك الآن تعديل"]');
  
  nationalityFineInputs.forEach(input => {
    input.setAttribute('readonly', 'true');
    input.style.backgroundColor = '#f8f9fa';
    input.style.cursor = 'not-allowed';
    input.style.border = '1px solid #ced4da';
    input.title = 'يمكن تعديل هذا الحقل فقط من خلال زر "تعديل غرامة الجنسية"';
    
    // إزالة مستمعي الأحداث
    input.removeEventListener('keypress', function() {});
  });
  
  nationalityFineEditMode = false;
  updateNationalityFineButton();
}

function updateNationalityFineButton() {
  const button = document.querySelector('button[onclick="openNationalityFineEditor()"]');
  if (button) {
    if (nationalityFineEditMode) {
      button.textContent = 'إنهاء تعديل غرامة الجنسية';
      button.onclick = disableNationalityFineEditing;
      button.style.backgroundColor = '#dc3545';
      button.title = 'إنهاء وضع تعديل غرامة الجنسية';
    } else {
      button.textContent = 'تعديل غرامة الجنسية';
      button.onclick = openNationalityFineEditor;
      button.style.backgroundColor = '#17a2b8';
      button.title = 'تعديل غرامة الجنسية لجميع الموظفين (يتطلب كلمة مرور)';
    }
  }
}

function updateNationalityFineFromTable(departmentKey, employeeIndex, newValue) {
  try {
    const data = getAttendanceData();
    const employee = data[departmentKey]?.[employeeIndex];
    
    if (!employee) {
      alert('لم يتم العثور على الموظف');
      return;
    }

    const fineValue = parseFloat(newValue) || 0;
    employee.nationalityFine = fineValue;
    
    saveAttendanceData(data);
    renderTables(); // إعادة عرض الجداول لتحديث الحسابات
    
    // إعادة تفعيل وضع التعديل بعد إعادة العرض
    if (nationalityFineEditMode) {
      setTimeout(() => {
        enableNationalityFineEditing();
      }, 100);
    }
    
    // إظهار رسالة نجاح مؤقتة
    showSuccessMessage(`تم تعديل غرامة الجنسية للموظف ${employee.name || 'غير محدد'} بنجاح`);
    
  } catch (error) {
    console.error('خطأ في تحديث غرامة الجنسية:', error);
    alert('حدث خطأ أثناء تحديث غرامة الجنسية');
  }
}

function getDepartmentName(deptKey, returnAll = false) {
  const defaultNames = {
    cleaning: 'النظافة',
    electricity: 'الكهرباء',
    agriculture: 'الزراعة',
    civil_works: 'الأعمال المدنية',
    mechanical: 'الميكانيكا',
    laundry: 'المغسلة',
    patient_services: 'الأمن والسلامة',
    admin_saudi: 'الوظائف الإدارية السعوديين'
  };

  // أسماء مخصصة محفوظة (إن وجدت)
  const custom = JSON.parse(localStorage.getItem('departmentNames') || '{}');

  // لو طُلب الكل: ارجع خريطة كاملة key => name
  if (returnAll) {
    const keys = [
      'cleaning',
      'electricity',
      'agriculture',
      'civil_works',
      'mechanical',
      'laundry',
      'patient_services',
      'admin_saudi'
    ];
    const map = {};
    keys.forEach(k => {
      map[k] = custom[k] || defaultNames[k] || k;
    });
    return map;
  }

  // خلاف ذلك: اسم قسم واحد
  return custom[deptKey] || defaultNames[deptKey] || deptKey;
}

function updateSingleNationalityFine(departmentKey, employeeIndex, newValue) {
  try {
    const data = getAttendanceData();
    const employee = data[departmentKey]?.[employeeIndex];
    
    if (!employee) {
      alert('لم يتم العثور على الموظف');
      return;
    }

    const fineValue = parseFloat(newValue) || 0;
    employee.nationalityFine = fineValue;
    
    saveAttendanceData(data);
    
    // إظهار رسالة نجاح مؤقتة
    showSuccessMessage(`تم تعديل غرامة الجنسية للموظف ${employee.name || 'غير محدد'} بنجاح`);
    
  } catch (error) {
    console.error('خطأ في تحديث غرامة الجنسية:', error);
    alert('حدث خطأ أثناء تحديث غرامة الجنسية');
  }
}

function saveAllNationalityFines() {
  try {
    const data = getAttendanceData();
    let updatedCount = 0;
    
    Object.keys(data).forEach(deptKey => {
      data[deptKey].forEach((emp, index) => {
        const inputElement = document.getElementById(`fine-${deptKey}-${index}`);
        if (inputElement) {
          const newValue = parseFloat(inputElement.value) || 0;
          if (emp.nationalityFine !== newValue) {
            emp.nationalityFine = newValue;
            updatedCount++;
          }
        }
      });
    });
    
    saveAttendanceData(data);
    renderTables(); // إعادة عرض الجداول لتحديث القيم
    
    showSuccessMessage(`تم حفظ جميع التعديلات بنجاح (${updatedCount} موظف تم تحديثه)`);
    
    // إغلاق النافذة بعد ثانيتين
    setTimeout(() => {
      closeNationalityFineEditor();
    }, 2000);
    
  } catch (error) {
    console.error('خطأ في حفظ غرامات الجنسية:', error);
    alert('حدث خطأ أثناء حفظ التعديلات');
  }
}

function closeNationalityFineEditor() {
  const dialog = document.getElementById('nationality-fine-dialog');
  const overlay = document.getElementById('nationality-fine-overlay');
  
  if (dialog) dialog.remove();
  if (overlay) overlay.remove();
}

function showSuccessMessage(message) {
  // إنشاء رسالة نجاح مؤقتة
  const successMsg = document.createElement('div');
  successMsg.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #28a745;
    color: white;
    padding: 10px 20px;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    z-index: 1001;
    font-size: 14px;
    max-width: 300px;
  `;
  successMsg.textContent = message;
  
  document.body.appendChild(successMsg);
  
  // إزالة الرسالة بعد 3 ثوان
  setTimeout(() => {
    if (successMsg.parentNode) {
      successMsg.parentNode.removeChild(successMsg);
    }
  }, 3000);
}






function openPDFExportDialog() {
  const departments = [
    { key: 'cleaning',         name: 'النظافة' },
    { key: 'electricity',      name: 'الكهرباء' },
    { key: 'agriculture',      name: 'الزراعة' },
    { key: 'civil-works',      name: 'الأعمال المدنية' },
    { key: 'mechanical',       name: 'الميكانيكا' },
    { key: 'security',         name: 'أمن وسلامة' },
    { key: 'laundry',          name: 'المغسلة' },
    { key: 'patient-services', name: 'الأمن والسلامة' },
    { key: 'admin-saudi',      name: 'الوظائف الإدارية السعوديين' }
  ];

  let departmentCheckboxes = '';
  departments.forEach(dept => {
    departmentCheckboxes += `
      <div class="form-group">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:600;">
          <input type="checkbox" value="${dept.key}" checked>
          ${dept.name}
        </label>
      </div>`;
  });

  const exportDialog = document.createElement('div');
  exportDialog.id = 'pdf-export-dialog';
  exportDialog.className = 'dialog';
  exportDialog.innerHTML = `
    <div class="dialog-content">
      <span class="close" onclick="closePDFExportDialog()">×</span>
      <h3><i class="fas fa-file-pdf" style="color:#dc2626;"></i> تصدير PDF</h3>
      <div class="form-group">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:700;">
          <input type="checkbox" id="select-all-pdf" checked onchange="toggleAllDepartmentsPDF(this)">
          تحديد جميع الأقسام
        </label>
      </div>
      <div style="border:1.5px solid #e2e8f0;border-radius:10px;padding:10px;max-height:220px;overflow-y:auto;background:#f8fafc;">
        ${departmentCheckboxes}
      </div>
      <div class="buttons">
        <button onclick="exportSelectedDepartmentsToPDF()" class="confirm-btn" style="background:linear-gradient(135deg,#991b1b,#dc2626)!important;">
          <i class="fas fa-file-pdf"></i> تصدير
        </button>
        <button onclick="closePDFExportDialog()" class="cancel-btn">
          <i class="fas fa-times-circle"></i> إلغاء
        </button>
      </div>
    </div>`;

  document.body.appendChild(exportDialog);
  exportDialog.style.display = 'flex';
}

function toggleAllDepartmentsPDF(selectAllCheckbox) {
  const checkboxes = document.querySelectorAll('#pdf-export-dialog input[type="checkbox"]:not(#select-all-pdf)');
  checkboxes.forEach(checkbox => {
    checkbox.checked = selectAllCheckbox.checked;
  });
}

function exportSelectedDepartmentsToPDF() {
  const selectedDepartments = [];
  const checkboxes = document.querySelectorAll('#pdf-export-dialog input[type="checkbox"]:not(#select-all-pdf)');
  
  checkboxes.forEach(checkbox => {
    if (checkbox.checked) {
      selectedDepartments.push(checkbox.value);
    }
  });

  if (selectedDepartments.length === 0) {
    alert('الرجاء اختيار قسم واحد على الأقل');
    return;
  }

  // إخفاء الأقسام غير المحددة مؤقتاً
  const allDepartments = document.querySelectorAll('.department-table');
  const hiddenDepartments = [];
  
  allDepartments.forEach(dept => {
    const deptId = dept.querySelector('h3').textContent;
    let shouldHide = true;
    
    selectedDepartments.forEach(selectedKey => {
      const deptName = getDepartmentName(selectedKey);
      if (deptId.includes(deptName)) {
        shouldHide = false;
      }
    });
    
    if (shouldHide) {
      dept.style.display = 'none';
      hiddenDepartments.push(dept);
    }
  });

  // تصدير PDF
  const element = document.querySelector('.container');
  const opt = {
    margin: 0.5,
    filename: `attendance_report_${new Date().toISOString().split('T')[0]}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' }
  };
  
  if (typeof html2pdf !== 'undefined') {
    html2pdf().set(opt).from(element).save().then(() => {
      // إعادة إظهار الأقسام المخفية
      hiddenDepartments.forEach(dept => {
        dept.style.display = 'block';
      });
      closePDFExportDialog();
      showSuccessMessage('تم تصدير PDF بنجاح');
    });
  } else {
    alert('مكتبة تصدير PDF غير متوفرة');
    // إعادة إظهار الأقسام المخفية
    hiddenDepartments.forEach(dept => {
      dept.style.display = 'block';
    });
  }
}

function closePDFExportDialog() {
  const dialog = document.getElementById('pdf-export-dialog');
  const overlay = document.getElementById('pdf-export-overlay');
  
  if (dialog) dialog.remove();
  if (overlay) overlay.remove();
}

/**
 * الجزء 5: تصدير Excel
 * يحتوي على دوال لتصدير البيانات إلى ملف Excel مع تطبيق معادلة الشراء المباشر
 */
function openExcelExportDialog() {
  const departments = [
    { key: 'cleaning',          name: getDepartmentName('cleaning') },
    { key: 'electricity',       name: getDepartmentName('electricity') },
    { key: 'agriculture',       name: getDepartmentName('agriculture') },
    { key: 'civil_works',       name: getDepartmentName('civil_works') },
    { key: 'mechanical',        name: getDepartmentName('mechanical') },
    { key: 'security',          name: getDepartmentName('security') },
    { key: 'laundry',           name: getDepartmentName('laundry') },
    { key: 'patient_services',  name: getDepartmentName('patient_services') },
    { key: 'admin_saudi',       name: getDepartmentName('admin_saudi') }
  ];

  let departmentCheckboxes = '';
  departments.forEach(dept => {
    departmentCheckboxes += `
      <div class="form-group">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:600;">
          <input type="checkbox" value="${dept.key}" checked>
          ${dept.name}
        </label>
      </div>`;
  });

  const exportDialog = document.createElement('div');
  exportDialog.id = 'excel-export-dialog';
  exportDialog.className = 'dialog';
  exportDialog.innerHTML = `
    <div class="dialog-content">
      <span class="close" onclick="closeExcelExportDialog()">×</span>
      <h3><i class="fas fa-file-excel" style="color:#16a34a;"></i> تصدير Excel</h3>
      <div class="form-group">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:700;">
          <input type="checkbox" id="select-all-excel" checked onchange="toggleAllDepartmentsExcel(this)">
          تحديد جميع الأقسام
        </label>
      </div>
      <div style="border:1.5px solid #e2e8f0;border-radius:10px;padding:10px;max-height:220px;overflow-y:auto;background:#f8fafc;">
        ${departmentCheckboxes}
      </div>
      <div class="buttons">
        <button onclick="exportSelectedDepartmentsToExcel()" class="confirm-btn" style="background:linear-gradient(135deg,#166534,#16a34a)!important;">
          <i class="fas fa-file-excel"></i> تصدير
        </button>
        <button onclick="closeExcelExportDialog()" class="cancel-btn">
          <i class="fas fa-times-circle"></i> إلغاء
        </button>
      </div>
    </div>`;

  document.body.appendChild(exportDialog);
  exportDialog.style.display = 'flex';
}

function toggleAllDepartmentsExcel(selectAllCheckbox) {
  const checkboxes = document.querySelectorAll('#excel-export-dialog input[type="checkbox"]:not(#select-all-excel)');
  checkboxes.forEach(checkbox => {
    checkbox.checked = selectAllCheckbox.checked;
  });
}


function closeExcelExportDialog() {
  const dialog = document.getElementById('excel-export-dialog');
  const overlay = document.getElementById('excel-export-overlay');
  
  if (dialog) dialog.remove();
  if (overlay) overlay.remove();
}
function toggleAllDepartmentsExcel(selectAllCheckbox) {
  const checkboxes = document.querySelectorAll('#excel-export-dialog input[type="checkbox"]:not(#select-all-excel)');
  checkboxes.forEach(checkbox => {
    checkbox.checked = selectAllCheckbox.checked;
  });
}

function exportSelectedDepartmentsToExcel() {
    const selectedDepartments = Array.from(document.querySelectorAll('#excel-export-dialog input[type="checkbox"]:checked')).map(cb => cb.value);

    if (selectedDepartments.length === 0) {
        alert('الرجاء اختيار قسم واحد على الأقل');
        return;
    }

    try {
        const attendanceData = getAttendanceData();
        const { daysInMonth, totalDaysInMonth } = getExtractPeriodDetails();
        const contractData = JSON.parse(localStorage.getItem('persistentContractData') || '{}');
        const contractType = contractData.contractType || 'عقد أساسي';
        const directPurchaseRatio = parseFloat(contractData.directPurchaseRatio || 0);
        const workbook = XLSX.utils.book_new();

        selectedDepartments.forEach(deptKey => {
            const deptName = getDepartmentName(deptKey);
            const employees = attendanceData[deptKey] || [];
            
            if (employees.length === 0) return; // تخطي الأقسام الفارغة

            const worksheetData = [];
            const headers = ['م', 'مسمى الوظيفة', 'الفئة', 'اسم شاغل الوظيفة'];
            for (let i = 1; i <= daysInMonth; i++) {
                headers.push(i.toString());
            }
            headers.push('التكلفة الشهرية', 'عدد أيام المستخلص', 'حضور', 'غياب', 'الحسم', 'غرامة الغياب', 'صافي الاستحقاق', 'الجنسية', 'غرامة جنسية', 'رقم الإقامة/الهوية');
            worksheetData.push(headers);

            employees.forEach((emp, index) => {
                try { // <--- بداية بلوك الحماية
                    const row = [index + 1, emp.jobTitle || '', emp.category || '', emp.name || ''];
                    const days = Array.isArray(emp.days) ? emp.days : [];
                    for (let i = 0; i < daysInMonth; i++) {
                        row.push(days[i] || 'ح');
                    }

                    // --- بداية الحسابات مع التحقق ---
                    const salary = parseFloat(emp.salary) || 0;
                    let adjustedSalary = salary;
                    if (contractType === 'شراء مباشر' && directPurchaseRatio > 0) {
                        adjustedSalary = salary + (salary * directPurchaseRatio / 100);
                    }

                    // التحقق من المقام قبل القسمة
                    const dailySalary = (totalDaysInMonth > 0) ? (adjustedSalary / totalDaysInMonth) : 0;
                    
                    let attendanceDays = 0;
                    let absenceDays = 0;
                    let deductionOnlyDays = 0;

                    days.slice(0, daysInMonth).forEach(day => {
                        if (day === 'ح' || day === 'ت') attendanceDays++;
                        else if (day === 'غ') absenceDays++;
                        else deductionOnlyDays++;
                    });

                    const deduction = (absenceDays + deductionOnlyDays) * dailySalary;
                    const fineConfig = ABSENCE_FINES_BY_CATEGORY[emp.category || '1'] || ABSENCE_FINES_BY_CATEGORY[1];
                    const isSaudi = (emp.nationality || 'سعودي').trim() === 'سعودي';
                    const absenceFine = absenceDays * (isSaudi ? fineConfig.saudi : fineConfig.non_saudi);
                    const nationalityFine = parseFloat(emp.nationalityFine) || 0;
                    const totalFine = absenceFine + nationalityFine;
                    
                    // التحقق من أن كل القيم أرقام صالحة
                    const netSalary = adjustedSalary - deduction - totalFine;
                    if (isNaN(netSalary) || isNaN(deduction) || isNaN(totalFine)) {
                        console.error(`خطأ حسابي للموظف: ${emp.name} في قسم ${deptName}. تم تخطي الحسابات.`);
                        // في حالة الخطأ، نضيف القيم كـ 0 لتجنب فشل التصدير
                        row.push(adjustedSalary.toFixed(2), daysInMonth, attendanceDays, absenceDays, '0.00', '0.00', '0.00', emp.nationality || '', nationalityFine.toFixed(2));
                    } else {
                         row.push(
                        adjustedSalary.toFixed(2),
                        daysInMonth,
                        attendanceDays,
                        absenceDays,
                        deduction.toFixed(2),
                        absenceFine.toFixed(2),
                        netSalary.toFixed(2),
                        emp.nationality || '',
                        nationalityFine.toFixed(2),
                        emp.iqamaId || '' // ✅ تأكد من وجود هذا السطر

                        );
                    }

                    worksheetData.push(row);

                } catch (empError) {
                    console.error(`حدث خطأ فادح عند معالجة الموظف: ${emp.name || 'غير معروف'}`, empError);
                } // <--- نهاية بلوك الحماية
            });

            const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
            XLSX.utils.book_append_sheet(workbook, worksheet, deptName);
        });

        if (workbook.SheetNames.length > 0) {
            const fileName = `attendance_report_${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(workbook, fileName);
            showSuccessMessage('تم تصدير Excel بنجاح');
        } else {
            alert('لم يتم العثور على بيانات لتصديرها في الأقسام المحددة.');
        }
        
    } catch (error) {
        console.error('خطأ في تصدير Excel:', error);
        alert('حدث خطأ أثناء تصدير Excel. راجع الكونسول لمزيد من التفاصيل.');
    } finally {
        closeExcelExportDialog();
    }
}


// ===== 1. الدوال الأساسية المطلوبة للأزرار =====

function openDialog(id) {
  const dialog = document.getElementById(id);
  if (dialog) {
    dialog.style.display = 'flex';
  } else {
    console.warn('Dialog ID not found:', id);
  }
}

function closeDialog(id) {
  const dialog = document.getElementById(id);
  if (dialog) {
    dialog.remove(); // إزالة النافذة المنبثقة من الـ DOM
  }

  // محاولة إزالة الـ overlay المرتبط بالنافذة
  const overlayId = id.replace('-dialog', '-overlay'); 
  const overlay = document.getElementById(overlayId);
  if (overlay) {
    overlay.remove(); // إزالة الـ overlay من الـ DOM
  }

  // في حال وجود أي overlays أخرى لم يتم إزالتها بشكل صحيح (كإجراء احتياطي)
  const genericOverlays = document.querySelectorAll('[id$="-overlay"]'); 
  genericOverlays.forEach(ov => {
      if (ov.id !== 'particles-js-bg') { 
          ov.remove();
      }
  });
}

function exportToExcel(tableId = 'cleaning-table') {
  try {
    const table = document.getElementById(tableId);
    if (!table) {
      alert('لم يتم العثور على الجدول');
      return;
    }
    
    if (typeof XLSX === 'undefined') {
      alert('مكتبة Excel غير متوفرة');
      return;
    }
    
    const clonedTable = table.cloneNode(true);
    const cells = clonedTable.querySelectorAll('td, th');
    cells.forEach(cell => {
      const text = cell.textContent.trim();
      switch(text) {
        case 'ح': cell.textContent = 'حاضر'; break;
        case 'غ': cell.textContent = 'غائب'; break;
        case 'ج': cell.textContent = 'إجازة'; break;
        case 'م': cell.textContent = 'مرضي'; break;
        case 'ع': cell.textContent = 'عطلة'; break;
        case 'ت': cell.textContent = 'تأخير'; break;
        case 'ش': cell.textContent = 'شاغرة'; break;
        case 'ر': cell.textContent = 'راحة'; break;
        case 'ط': cell.textContent = 'طوارئ'; break;
        case 'د': cell.textContent = 'دورة'; break;
        case 'ن': cell.textContent = 'نهاية العقد'; break;
        case 'س': cell.textContent = 'سفر'; break;
      }
    });
    
    const wb = XLSX.utils.table_to_book(clonedTable);
    XLSX.writeFile(wb, 'جدول_الحضور_والغياب.xlsx');
    console.log('تم تصدير Excel بالحالات الكاملة');
  } catch (error) {
    console.error('خطأ في تصدير Excel:', error);
    alert('حدث خطأ أثناء تصدير الملف');
  }
}

function zoomInTable(tableId) {
  const table = document.getElementById(tableId);
  if (table) {
    const currentZoom = parseFloat(table.style.zoom) || 1;
    const newZoom = Math.min(currentZoom + 0.2, 3);
    table.style.zoom = newZoom.toString();
  }
}

function zoomOutTable(tableId) {
  const table = document.getElementById(tableId);
  if (table) {
    const currentZoom = parseFloat(table.style.zoom) || 1;
    const newZoom = Math.max(currentZoom - 0.2, 0.5);
    table.style.zoom = newZoom.toString();
  }
}

function clearData() {
  const password = prompt('أدخل كلمة المرور لمسح البيانات:');
  if (password !== 'admin123') {
    if (password !== null) {
      alert('كلمة المرور غير صحيحة');
    }
    return;
  }

  if (confirm('هل أنت متأكد من رغبتك في مسح جميع بيانات الحضور والغياب؟ لا يمكن التراجع عن هذه العملية.')) {
    try {
      [
        'attendanceData',
        'ng_attendanceData',
        'nd_attendanceData',
        'centersAttendanceData_v2',
        'healthCentersAttendanceData',
        'adminOfficesAttendanceData_v1',
        'najran_labor_attendance_done',
        'najran_labor_performance_done'
      ].forEach(function (key) {
        try { localStorage.removeItem(key); } catch (_) {}
      });

      sessionStorage.setItem('najran_new_extract_clear_attendance_once', '1');
      localStorage.setItem('najran_new_extract_clear_attendance_once', '1');

      try {
        if (typeof saveAttendanceData === 'function') {
          saveAttendanceData({
            cleaning: [],
            electricity: [],
            agriculture: [],
            civil_works: [],
            mechanical: [],
            laundry: [],
            patient_services: [],
            admin_saudi: []
          });
        }
      } catch (_) {}

      console.warn('[AttendanceClear] NEW EXTRACT flag set before clearing attendance');
      alert('تم مسح بيانات الحضور. سيتم إعادة تحميل الصفحة بدون استرجاع العمالة القديمة من السحابة.');
      window.location.reload();
    } catch (error) {
      console.error('خطأ في مسح البيانات:', error);
      alert('حدث خطأ أثناء مسح البيانات');
    }
  }
}

function addEmployee() {
  try {
    const department = document.getElementById('add-employee-department').value;
    const jobTitle = document.getElementById('add-employee-job-title').value;
    const category = document.getElementById('add-employee-category').value;
    const name = document.getElementById('add-employee-name').value;
    const salary = parseFloat(document.getElementById('add-employee-salary').value) || 0;
    const nationality = document.getElementById('add-employee-nationality').value;

    const iqamaId = (document.getElementById('add-employee-iqama')?.value || '').trim();

    if (!jobTitle || !name || !iqamaId) {
      alert('الرجاء إدخال مسمى الوظيفة واسم الموظف ورقم الإقامة');
      return;
    }

    const { daysInMonth } = getExtractPeriodDetails();
    const newEmployee = {
      jobTitle,
      category,
      name,
      salary,
      days: Array(daysInMonth).fill('ح'),
      nationality: nationality || 'سعودي',
      iqamaId,
      nationalityFine: 0
    };

    addEmployeesToDepartment(department, [newEmployee]);
    closeDialog('add-employee-dialog');
    renderTables();
    document.getElementById('add-employee-form').reset();
    alert('تم إضافة الموظف بنجاح');
  } catch (error) {
    console.error('خطأ في إضافة الموظف:', error);
    alert('حدث خطأ أثناء إضافة الموظف');
  }
}

// ===================================================================
//      ===> النظام الجديد والكامل للطباعة (يحل المشكلة) <===
// ===================================================================

// الدالة رقم 1: تفتح نافذة اختيار الأقسام
function openPrintDialog() {
    // أولاً، نتأكد من عدم وجود نافذة قديمة
    closeDialog('print-dialog'); 

    const printDialog = document.createElement('div');
    printDialog.id = 'print-dialog';
    printDialog.className = 'dialog'; // استخدم تنسيقاتك الجاهزة
    
    const overlay = document.createElement('div');
    overlay.id = 'print-dialog-overlay';
    overlay.className = 'overlay';

   // استبدل المصفوفة القديمة في دالة الطباعة بهذه النسخة
// استبدل المصفوفة القديمة في دالة الطباعة بهذه النسخة
const departments = [
    { key: 'cleaning', name: getDepartmentName('cleaning') },
    { key: 'electricity', name: getDepartmentName('electricity') },
    { key: 'agriculture', name: getDepartmentName('agriculture') },
    { key: 'civil_works', name: getDepartmentName('civil_works') },
    { key: 'mechanical', name: getDepartmentName('mechanical') },
    { key: 'security', name: getDepartmentName('security') },
    { key: 'laundry', name: getDepartmentName('laundry') },
    { key: 'patient_services', name: getDepartmentName('patient_services') },
    { key: 'admin_saudi', name: getDepartmentName('admin_saudi') }
];

    let departmentCheckboxes = '';
    departments.forEach(dept => {
        departmentCheckboxes += `
            <div class="form-group">
                <label style="display: flex; align-items: center; cursor: pointer; width: 100%;">
                    <input type="checkbox" class="print-dept-checkbox" value="${dept.key}" checked style="width: 20px; height: 20px; margin-left: 10px;">
                    ${dept.name}
                </label>
            </div>
        `;
    });

  printDialog.innerHTML = `
    <div class="dialog-content">
        <span class="close" onclick="closeDialog('print-dialog')">×</span>
        <h3>طباعة الجداول</h3>

        <div class="form-group">
            <label style="display: flex; align-items: center; cursor: pointer; font-weight: bold;">
                <input type="checkbox"
                       id="select-all-print"
                       checked
                       onchange="toggleAllDepartmentsPrint(this.checked)"
                       style="width: 20px; height: 20px; margin-left: 10px;">
                تحديد جميع الأقسام
            </label>
        </div>

        <div class="form-group" style="margin-top: 10px; border-top: 1px solid #eee; padding-top: 10px;">
            <label style="display: flex; align-items: center; cursor: pointer; font-weight: bold; color: #1e3c72;">
                <input type="checkbox"
                       id="print-grand-total-signatures"
                       style="width: 20px; height: 20px; margin-left: 10px;">
                إضافة توقيع بعد الإجمالي العام
            </label>
        </div>

        <div style="border-top: 1px solid #eee; margin-top: 15px; padding-top: 15px; max-height: 250px; overflow-y: auto;">
            ${departmentCheckboxes}
        </div>

        <div class="buttons" style="margin-top: 20px;">
            <button onclick="printSelectedDepartments()" class="btn btn-success">
                <i class="fas fa-print"></i> طباعة
            </button>
            <button onclick="closeDialog('print-dialog')" class="btn btn-secondary">
                <i class="fas fa-times-circle"></i> إلغاء
            </button>
        </div>
    </div>
`;

    document.body.appendChild(overlay);
    document.body.appendChild(printDialog);
    openDialog('print-dialog');
}

// الدالة رقم 2: دالة مساعدة لتحديد كل الخيارات أو إلغائها
function toggleAllDepartmentsPrint(isChecked) {
    document.querySelectorAll('.print-dept-checkbox').forEach(checkbox => {
        checkbox.checked = isChecked;
    });
}

// الدالة رقم 3: تجهز الصفحة وتطبع الأقسام المحددة
function printSelectedDepartments() {
    const selectedDepartments = Array.from(document.querySelectorAll('.print-dept-checkbox:checked')).map(cb => cb.value);

    if (selectedDepartments.length === 0) {
        alert('الرجاء اختيار قسم واحد على الأقل للطباعة.');
        return;
    }

    closeDialog('print-dialog');

    // إظهار وإخفاء الجداول حسب التحديد
    document.querySelectorAll('.department-table').forEach(tableDiv => {
        const tableId = tableDiv.querySelector('table').id;
        const deptKey = tableId.replace('-table', '').replace(/-/g, '_');
        if (selectedDepartments.includes(deptKey)) {
            tableDiv.style.display = 'block';
        } else {
            tableDiv.style.display = 'none';
        }
    });

    // إخفاء العناصر غير المرغوب فيها
    const elementsToHide = document.querySelectorAll('.action-buttons, .zoom-buttons, .nav-bar, .no-print, .dialog, #particles-js-bg, footer, .signatures-display-section');
    elementsToHide.forEach(el => el.style.display = 'none');
// --- الإضافة المطلوبة لطباعة الإجمالي العام ---
const grandTotalSection = document.querySelector('.grand-total');
if (grandTotalSection) {
    grandTotalSection.style.display = 'block';
}
// --- نهاية الإضافة ---

    // إظهار تواقيع الطباعة وتحديثها
    const printSignatures = document.querySelectorAll('.print-signatures');
    printSignatures.forEach(sig => sig.style.display = 'block');
    if (typeof updatePrintSignatures === 'function') {
        updatePrintSignatures();
    }


    // الطباعة
    window.print();
if (grandTotalSection) {
    grandTotalSection.style.display = 'block';
}

    // إعادة كل شيء لطبيعته بعد الطباعة
    setTimeout(() => {
        elementsToHide.forEach(el => el.style.display = '');
        printSignatures.forEach(sig => sig.style.display = 'none');
        document.querySelectorAll('.department-table').forEach(tableDiv => tableDiv.style.display = 'block');
    }, 1000);
}

function toggleAllDepartmentsPrint(isChecked) {
  const checkboxes = document.querySelectorAll(
    '#print-dialog input[type="checkbox"]:not(#select-all-print):not(#print-grand-total-signatures)'
  );

  checkboxes.forEach(checkbox => {
    checkbox.checked = isChecked;
  });
}

function closePrintDialog() {
  const dialog = document.getElementById('print-dialog');
  const overlay = document.getElementById('print-dialog-overlay');

  if (dialog) dialog.remove();
  if (overlay) overlay.remove();
}

function printSelectedDepartments() {
  const selectedDepartments = [];

  // مهم: نستبعد checkbox تحديد الكل + checkbox توقيع الإجمالي العام
  const checkboxes = document.querySelectorAll(
    '#print-dialog input[type="checkbox"]:not(#select-all-print):not(#print-grand-total-signatures)'
  );

  checkboxes.forEach(checkbox => {
    if (checkbox.checked) {
      selectedDepartments.push(checkbox.value);
    }
  });

  if (selectedDepartments.length === 0) {
    alert('الرجاء اختيار قسم واحد على الأقل');
    return;
  }

  // اختيار طباعة توقيع بعد الإجمالي العام
  const includeGrandTotalSignatures =
    document.getElementById('print-grand-total-signatures')?.checked === true;

  preparePrint(selectedDepartments, includeGrandTotalSignatures);
  closePrintDialog();
}
function preparePrint(selectedDepartments = null, includeGrandTotalSignatures = false) {  // حفظ snapshot تلقائي عند كل طباعة
  if (typeof window.saveExtractSnapshot === 'function') {
    window.saveExtractSnapshot('print');
  }

  const elementsToHide = document.querySelectorAll('.action-buttons, .zoom-buttons, .nav-bar');
  elementsToHide.forEach(el => el.style.display = 'none');

  const printWindow = window.open('', '', 'width=1200,height=900');
  const doc = printWindow.document;

  doc.write(`
    <style>
      body { font-family: 'Tajawal', Arial, sans-serif; direction: rtl; margin: 0; color: #000; background: #fff; }
      .header-info { text-align: center; margin-bottom: 20px; position: relative; }
      .logo-right { position: absolute; right: 10px; top: 10px; width: 65px; }
      .logo-left { position: absolute; left: 10px; top: 10px; width: 65px; }
      .header-lines { display: inline-block; margin: 0 auto; }
      .header-lines h1 { font-size: 20px; color: #003087; margin-bottom: 5px; font-weight: bold; }
      .header-lines h2 { font-size: 16px; color: #222; margin: 0; font-weight: bold; }
      .header-lines h3 { font-size: 14px; color: #444; margin: 0 0 10px 0; font-weight: bold; }
      .info-block { font-size: 14px; margin: 10px auto; text-align: center; max-width: 80%; }
      .info-block span { display: inline-block; min-width: 100px; margin: 5px; font-weight: bold; }
      .extract-title { font-size: 18px; font-weight: bold; text-align: center; margin: 10px auto; color: #0d47a1; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; direction: rtl; margin-bottom: 20px; table-layout: auto; }
      th, td { border: 1px solid #333; padding: 4px 6px; text-align: center; white-space: nowrap; }
      th { background: #003087; color: #fff; }
      .job-title, .employee-name { font-size: 11px; max-width: 105px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .category-cell { font-size: 12px; width: 36px; }
      .nationality-cell { font-size: 11px; max-width: 60px; }
      .day-cell { font-size: 12px; min-width: 18px; max-width: 24px; }
      .present { color: #0072ff; font-weight: bold; }
      .absent { color: #ff1744; font-weight: bold; }
      .department-title { text-align: right; font-size: 22px; color: #002060; font-weight: bold; margin: 20px 0 12px 0; letter-spacing: 1px; }
      .summary-block { font-size: 18px; text-align: right; margin: 10px 0 14px 8px; color: #1565c0; font-weight: bold; background: #e3f2fd; border-radius: 5px; }
      .signatures-block { margin-top: 20px; page-break-inside: avoid; }
      .signatures-title { text-align: center; font-size: 16px; font-weight: bold; color: #003087; margin-bottom: 10px; }
      .signatures-grid { display: flex; justify-content: space-around; gap: 8px; }
      .signature-item { min-width: 160px; text-align: center; margin: 8px; }
      .signature-line { border-bottom: 2px solid #222; height: 38px; margin: 8px 0 4px 0; }
      .signature-role { font-size: 13px; font-weight: bold; color: #222; }
      .signature-name { font-size: 11px; color: #888; }
      @media print {
  body { zoom: 50%; }
  table { page-break-inside: auto !important; }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  tr { page-break-inside: avoid !important; }
  td, th { page-break-inside: avoid !important; }
  .print-break { page-break-before: always; }
}
    </style>
  `);

  const hospitalName = document.querySelector('.hospitalName')?.textContent.trim() || 'غير محدد';
  const contractDetails = document.querySelector('.contractDetails')?.textContent.trim() || 'غير محدد';
  const companyName = document.querySelector('.companyName')?.textContent.trim() || 'غير محدد';
  const contractType = document.querySelector('.contractType')?.textContent.trim() || 'غير محدد';
  const directPurchaseRatio = document.querySelector('.directPurchaseRatio')?.textContent.trim() || '0%';
  let extractStart = 'غير محدد';
  let extractEnd = 'غير محدد';
  
  // جلب تواريخ المستخلص من localStorage أو extractPeriod
  try {
    const persistentData = JSON.parse(localStorage.getItem('persistentExtractData') || '{}');
    extractStart = formatDate(persistentData.extractStart) || document.querySelector('#extract-start')?.textContent.trim() || 'غير محدد';
    extractEnd = formatDate(persistentData.extractEnd) || document.querySelector('#extract-end')?.textContent.trim() || 'غير محدد';
  } catch (error) {
    console.warn('خطأ في جلب تواريخ المستخلص:', error);
  }
  
  // جلب أسماء التواقيع من localStorage أو HTML
  let engineeringManager = 'غير محدد';
  let generalServicesManager = 'غير محدد';
  let hospitalManager = 'غير محدد';
  let followUpManager = 'غير محدد';
  
  try {
    const contractData = JSON.parse(localStorage.getItem('persistentContractData') || '{}');
    engineeringManager = contractData.engineeringManager || document.querySelector('#engineering-manager-name')?.textContent.trim() || 'غير محدد';
    generalServicesManager = contractData.generalServicesManager || document.querySelector('#general-services-manager-name')?.textContent.trim() || 'غير محدد';
    hospitalManager = contractData.hospitalManager || document.querySelector('#hospital-manager-name')?.textContent.trim() || 'غير محدد';
    followUpManager = contractData.followUpManager || document.querySelector('#follow-up-manager-name')?.textContent.trim() || 'غير محدد';
  } catch (error) {
    console.warn('خطأ في جلب أسماء التواقيع:', error);
  }
  
const extractStartDate = new Date(JSON.parse(localStorage.getItem('persistentExtractData') || '{}').extractStart || new Date());
const currentMonthYear = extractStartDate.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric', calendar: 'gregory' });
  doc.write(`
    <div class="header-info">
      <img src="najran_health_cluster_logo.png" class="logo-right" alt="شعار تجمع نجران الصحي">
      <img src="najran_health_cluster_logo.png" class="logo-left" alt="شعار تجمع نجران الصحي">
      <div class="header-lines">
        <h1>تجمع نجران الصحي</h1>
        <h2>وحدة الصيانة العامة</h2>
        <h3>بيان بالحضور والغياب</h3>
      </div>
      <div class="info-block">
        <span><b>اسم المستشفى:</b> ${hospitalName}</span> |
        <span><b>تفاصيل العقد:</b> ${contractDetails}</span> |
        <span><b>اسم الشركة:</b> ${companyName}</span> |
        <span><b>نوع العقد:</b> ${contractType}</span><br>
  ${contractType === 'شراء مباشر' ? `<span><b>نسبة الشراء المباشر:</b> ${directPurchaseRatio}</span> |` : ''}
        <span><b>مدة المستخلص:</b> من ${extractStart} م إلى ${extractEnd} م</span>
      </div>
      <div class="extract-title">مستخلص العمالة: شهر ${currentMonthYear} من تاريخ ${extractStart} إلى ${extractEnd}</div>
    </div>
  `);

  const departmentTables = Array.from(document.querySelectorAll('.department-table'));
  const departmentMap = {
  'النظافة': 'cleaning',
  'الكهرباء': 'electricity',
  'الزراعة': 'agriculture',
  'الأعمال المدنية': 'civil_works',   // ← underscore
  'الميكانيكا': 'mechanical',
  'المغسلة': 'laundry',
  'خدمات المرضى': 'patient_services',
  'قسم السلامة والحراسات الأمنية': 'patient_services',
  'السلامة والحراسات الأمنية': 'patient_services',
  'السلامة والحراسات': 'patient_services',
  'الحراسات الأمنية': 'patient_services',
  'حراسات': 'patient_services',
  'الوظائف الإدارية السعوديين': 'admin_saudi'
};

  let selectedCount = 0;
function buildAttendanceTableSignaturesHTML() {
  const latestSignatures = (typeof SignatureBlock !== 'undefined')
    ? SignatureBlock.getSigs('attendance')
    : (typeof getSignatures === 'function' ? getSignatures() : []);

  const prefs = (typeof SignatureBlock !== 'undefined')
    ? SignatureBlock.getPrefs('attendance')
    : { includeSigs: true, includeStamp: true };

  if (!prefs.includeSigs) return '';

  let html = `
    <div class="signatures-block" style="page-break-inside:avoid;margin:14px 0 20px;">
      <div class="signatures-title">التواقيع</div>
      <div class="signatures-grid">
  `;

  if (latestSignatures && latestSignatures.length > 0) {
    latestSignatures.forEach(sig => {
      html += `
        <div class="signature-item">
          <div class="signature-role">${sig.title || 'مسمى غير محدد'}</div>
          <div class="signature-line"></div>
          <div class="signature-name">${sig.name || ''}</div>
        </div>
      `;
    });

    if (prefs.includeStamp) {
      html += `
        <div class="signature-item">
          <div class="signature-role">الختم</div>
          <div class="signature-line"></div>
          <div class="signature-name"></div>
        </div>
      `;
    }
  } else {
    html += '<p style="text-align:center;color:#888;">لا توجد تواقيع معتمدة.</p>';
  }

  html += '</div></div>';
  return html;
}
  departmentTables.forEach((tableDiv) => {
    const title = tableDiv.querySelector('h3')?.textContent || '';
    let deptKey = null;
    for (const [name, key] of Object.entries(departmentMap)) {
      if (title.includes(name)) {
        deptKey = key;
        break;
      }
    }

    if (selectedDepartments && deptKey && !selectedDepartments.includes(deptKey)) {
      return;
    }

    if (selectedCount > 0) doc.write(`<div class="print-break"></div>`);

    doc.write('<div class="department-title">' + title + '</div>');

    const table = tableDiv.querySelector('table');

    const summary = tableDiv.querySelector('.total')?.outerHTML || '';
    if (summary) doc.write('<div class="summary-block">' + summary + '</div>');

    if (table) {
      let tableHTML = '';
      if (table.tHead) {
        let theadHTML = '<thead>';
        table.tHead.querySelectorAll('tr').forEach(row => {
          theadHTML += '<tr>';
          row.querySelectorAll('th, td').forEach(cell => {
            if (cell.style.display === 'none') return;
            const tag = cell.tagName.toLowerCase();
            const rowspan = cell.getAttribute('rowspan') ? ` rowspan="${cell.getAttribute('rowspan')}"` : '';
            const colspan = cell.getAttribute('colspan') ? ` colspan="${cell.getAttribute('colspan')}"` : '';
            theadHTML += `<${tag}${rowspan}${colspan}>${cell.textContent}</${tag}>`;
          });
          theadHTML += '</tr>';
        });
        theadHTML += '</thead>';
        tableHTML = theadHTML;
      }
      let tbodyHTML = '<tbody>';
      table.querySelectorAll('tbody tr').forEach(row => {
        tbodyHTML += '<tr>';
        row.querySelectorAll('td').forEach(td => {
          if (td.style.display === 'none') return;
          const select = td.querySelector('select');
          const input = td.querySelector('input');
          if (select) {
            tbodyHTML += `<td style="text-align:center;font-weight:bold;">${select.value}</td>`;
          } else if (input) {
            tbodyHTML += `<td style="text-align:center;">${input.value}</td>`;
          } else {
            tbodyHTML += `<td>${td.textContent.trim()}</td>`;
          }
        });
        tbodyHTML += '</tr>';
      });
      tbodyHTML += '</tbody>';
doc.write('<table>' + tableHTML + tbodyHTML + '</table>');
doc.write(buildAttendanceTableSignaturesHTML());
    }

    selectedCount++;
  }); // نهاية forEach

  // الإجمالي العام — مرة واحدة فقط في النهاية، بدون page-break لكي يظهر فوق التواقيع مباشرة
  const grandTotalEl = document.getElementById('grand-total-container');
  if (grandTotalEl) {
    const cards = grandTotalEl.querySelectorAll('.total-card');
    if (cards.length > 0) {
      let gtRows = '';
      cards.forEach(card => {
        const label = card.querySelector('.label')?.textContent || '';
        const value = card.querySelector('.value')?.textContent || '';
        gtRows += `<td style="padding:8px 14px;text-align:center;border:1px solid #003087;"><div style="font-size:11px;color:#555;margin-bottom:4px;">${label}</div><div style="font-size:14px;font-weight:900;color:#003087;">${value}</div></td>`;
      });
      doc.write(`
        <table style="width:100%;border-collapse:collapse;margin:20px 0;direction:rtl;page-break-inside:avoid;">
          <thead>
            <tr><th colspan="${cards.length}" style="background:#003087;color:#fff;padding:8px;font-size:14px;text-align:center;border:1px solid #003087;">الإجماليات العامة</th></tr>
          </thead>
          <tbody><tr>${gtRows}</tr></tbody>
        </table>
      `);
    }
  }

if (includeGrandTotalSignatures) {
  doc.write(buildAttendanceTableSignaturesHTML());
}

// تم تعطيل التواقيع النهائية العامة
// السبب: كانت تظهر مرة واحدة فقط في آخر صفحة الطباعة
// المطلوب: التواقيع تكون تحت كل جدول داخل حلقة طباعة الجداول

doc.close();
printWindow.focus();
printWindow.print();

setTimeout(() => {
  elementsToHide.forEach(el => el.style.display = '');
}, 500);
}
function openUpdateSignaturesDialog() {
  const existing = document.getElementById('update-signatures-dialog');
  if (existing) existing.remove();

  let contractData = {};
  try {
    contractData = JSON.parse(localStorage.getItem('persistentContractData') || '{}');
  } catch (e) {}

  const engineeringManager    = contractData.engineeringManager    || document.querySelector('#engineering-manager-name')?.textContent.trim()    || '';
  const generalServicesManager = contractData.generalServicesManager || document.querySelector('#general-services-manager-name')?.textContent.trim() || '';
  const hospitalManager        = contractData.hospitalManager        || document.querySelector('#hospital-manager-name')?.textContent.trim()        || '';
  const followUpManager        = contractData.followUpManager        || document.querySelector('#follow-up-manager-name')?.textContent.trim()        || '';

  const updateDialog = document.createElement('div');
  updateDialog.id = 'update-signatures-dialog';
  updateDialog.className = 'dialog';
  updateDialog.innerHTML = `
    <div class="dialog-content">
      <span class="close" onclick="closeDialog('update-signatures-dialog')">×</span>
      <h3><i class="fas fa-signature" style="color:#0f766e;"></i> تحديث التواقيع</h3>
      <div class="form-group">
        <label>مدير المشروع:</label>
        <input type="text" id="update-engineering-manager" value="${engineeringManager}">
      </div>
      <div class="form-group">
        <label>رئيس قسم الصيانة:</label>
        <input type="text" id="update-general-services-manager" value="${generalServicesManager}">
      </div>
      <div class="form-group">
        <label>مدير المستشفى:</label>
        <input type="text" id="update-hospital-manager" value="${hospitalManager}">
      </div>
      <div class="form-group">
        <label>مندوب المقاول:</label>
        <input type="text" id="update-follow-up-manager" value="${followUpManager}">
      </div>
      <div class="buttons">
        <button onclick="saveUpdateSignatures()" class="confirm-btn" style="background:linear-gradient(135deg,#134e4a,#0f766e)!important;">
          <i class="fas fa-save"></i> حفظ التغييرات
        </button>
        <button onclick="closeDialog('update-signatures-dialog')" class="cancel-btn">
          <i class="fas fa-times-circle"></i> إلغاء
        </button>
      </div>
    </div>`;

  document.body.appendChild(updateDialog);
  updateDialog.style.display = 'flex';
}

function saveUpdateSignatures() {
  try {
    // جلب البيانات من النافذة
    const engineeringManager = document.getElementById('update-engineering-manager')?.value.trim() || '';
    const generalServicesManager = document.getElementById('update-general-services-manager')?.value.trim() || '';
    const hospitalManager = document.getElementById('update-hospital-manager')?.value.trim() || '';
    const followUpManager = document.getElementById('update-follow-up-manager')?.value.trim() || '';

    // جلب البيانات الحالية من localStorage
    let contractData = {};
    try {
      contractData = JSON.parse(localStorage.getItem('persistentContractData') || '{}');
    } catch (error) {
      console.warn('خطأ في جلب بيانات localStorage:', error);
    }

    // تحديث الحقول المدخلة فقط
    if (engineeringManager) contractData.engineeringManager = engineeringManager;
    if (generalServicesManager) contractData.generalServicesManager = generalServicesManager;
    if (hospitalManager) contractData.hospitalManager = hospitalManager;
    if (followUpManager) contractData.followUpManager = followUpManager;

    // حفظ البيانات في localStorage
    localStorage.setItem('persistentContractData', JSON.stringify(contractData));

    // تحديث العرض في الصفحة
    if (engineeringManager) document.querySelectorAll('#engineering-manager-name').forEach(el => el.textContent = engineeringManager);
    if (generalServicesManager) document.querySelectorAll('#general-services-manager-name').forEach(el => el.textContent = generalServicesManager);
    if (hospitalManager) document.querySelectorAll('#hospital-manager-name').forEach(el => el.textContent = hospitalManager);
    if (followUpManager) document.querySelectorAll('#follow-up-manager-name').forEach(el => el.textContent = followUpManager);

    // استدعاء updateContractDisplayData إذا كانت موجودة
    if (typeof updateContractDisplayData === 'function') {
      updateContractDisplayData();
    }

    // إغلاق النافذة والتأكد من إزالة الـ overlay
    closeDialog('update-signatures-dialog');
    showSuccessMessage('تم تحديث التواقيع بنجاح');
  } catch (error) {
    console.error('خطأ في حفظ التواقيع:', error);
    alert('حدث خطأ أثناء حفظ التواقيع');
    // في حالة الخطأ، نضمن إغلاق النافذة والـ overlay
    closeDialog('update-signatures-dialog');
  }
}

function showSuccessMessage(message) {
  try {
    const successMsg = document.createElement('div');
    successMsg.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #28a745;
      color: white;
      padding: 10px 20px;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      z-index: 1001;
      font-size: 14px;
      max-width: 300px;
    `;
    successMsg.textContent = message;

    document.body.appendChild(successMsg);

    setTimeout(() => {
      if (successMsg.parentNode) {
        successMsg.parentNode.removeChild(successMsg);
      }
    }, 3000);
  } catch (error) {
    console.warn('خطأ في عرض رسالة النجاح:', error);
  }
}
// ===== دوال جديدة للتحكم في الحضور الجماعي على مستوى الموظف =====

// دالة لتعيين حالة معينة لجميع أيام الشهر لموظف واحد
// (هذه الدالة موجودة بالفعل في كودك، تأكد من أنها بهذه الصيغة)
function setEmployeeAttendanceForAllDays(departmentKey, employeeIndex, status) {
  try {
    const data = getAttendanceData();
    const employee = data[departmentKey]?.[employeeIndex];
    if (!employee) return;

    const { daysInMonth } = getExtractPeriodDetails();
    employee.days = Array(daysInMonth).fill(status); // تعيين الحالة لجميع الأيام

    saveAttendanceData(data);
    renderTables(); // إعادة عرض الجداول لتحديث الواجهة
    showSuccessMessage(`تم تعيين حالة الموظف ${employee.name} إلى "${STATUS_CODES[status].name}" لجميع أيام الشهر.`);
  } catch (error) {
    console.error('خطأ في تعيين الحضور لجميع الأيام:', error);
    alert('حدث خطأ أثناء تعيين الحضور لجميع الأيام.');
  }
}

// دالة لفتح نافذة التعديل الجماعي (الخطوة 1: اختيار القسم)
// (هذه الدالة ستحل محل أي تعريف سابق لـ openBulkAttendanceDialog)
// ✅✅✅ [تعديل رقم 4: تعديل جماعي مرن للحضور] ✅✅✅
function openBulkAttendanceDialog() {
    const dialog = document.createElement('div');
    dialog.id = 'bulk-attendance-dialog';
    dialog.className = 'dialog'; // استخدم تنسيقاتك الجاهزة
    
    const overlay = document.createElement('div');
    overlay.id = 'bulk-attendance-overlay';
    overlay.className = 'overlay';

    const departments = Object.keys(getAttendanceData());
    let deptOptions = '';
    departments.forEach(key => {
        deptOptions += `<option value="${key}">${getDepartmentName(key)}</option>`;
    });

    dialog.innerHTML = `
        <div class="dialog-content">
            <span class="close" onclick="closeDialog('bulk-attendance-dialog')">×</span>
            <h3>تعديل حضور جماعي</h3>
            <div class="form-group">
                <label>اختر القسم:</label>
                <select id="bulk-dept-select" onchange="showEmployeesForBulkAttendance(this.value)">
                    <option value="">-- اختر قسمًا --</option>
                    ${deptOptions}
                </select>
            </div>
            <div id="bulk-attendance-employee-list" style="margin-top: 15px; border-top: 1px solid #eee; padding-top: 15px;">
                <p style="text-align: center; color: #666;">اختر قسمًا لعرض الموظفين</p>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(dialog);
    openDialog('bulk-attendance-dialog');
}

function showEmployeesForBulkAttendance(departmentKey) {
    const employeeListDiv = document.getElementById('bulk-attendance-employee-list');
    if (!departmentKey) {
        employeeListDiv.innerHTML = `<p style="text-align: center; color: #666;">اختر قسمًا لعرض الموظفين</p>`;
        return;
    }
    
    const { monthDaysArray } = getExtractPeriodDetails();
    let dayOptions = '';
    monthDaysArray.forEach((day, index) => {
        dayOptions += `<option value="${index}">${day}</option>`;
    });

    let statusOptions = '';
    for (const code in STATUS_CODES) {
        if (code !== 'default') {
            statusOptions += `<option value="${code}">${STATUS_CODES[code].name} (${code})</option>`;
        }
    }

    employeeListDiv.innerHTML = `
        <div class="form-group">
            <label>اختر الحالة الجديدة:</label>
            <select id="bulk-status-select">${statusOptions}</select>
        </div>
        <div class="form-group-inline">
            <div class="form-group">
                <label>من يوم:</label>
                <select id="bulk-start-day">${dayOptions}</select>
            </div>
            <div class="form-group">
                <label>إلى يوم:</label>
                <select id="bulk-end-day">${dayOptions}</select>
            </div>
        </div>
        <div class="buttons">
            <button class="btn btn-success" onclick="applyBulkAttendance('${departmentKey}')"><i class="fas fa-check"></i> تطبيق على كل القسم</button>
        </div>
    `;
}

function applyBulkAttendance(departmentKey) {
    const newStatus = document.getElementById('bulk-status-select').value;
    const startIndex = parseInt(document.getElementById('bulk-start-day').value);
    const endIndex = parseInt(document.getElementById('bulk-end-day').value);

    if (startIndex > endIndex) {
        alert("خطأ: يوم البداية يجب أن يكون قبل أو نفس يوم النهاية.");
        return;
    }

    const startDay = document.getElementById('bulk-start-day').options[startIndex].text;
    const endDay = document.getElementById('bulk-end-day').options[endIndex].text;

    if (confirm(`هل أنت متأكد من تطبيق الحالة "${STATUS_CODES[newStatus].name}" على جميع موظفي قسم "${getDepartmentName(departmentKey)}" من يوم ${startDay} إلى يوم ${endDay}؟`)) {
        const data = getAttendanceData();
        if (data[departmentKey]) {
            data[departmentKey].forEach(employee => {
                for (let i = startIndex; i <= endIndex; i++) {
                    if (employee.days && i < employee.days.length) {
                        employee.days[i] = newStatus;
                    }
                }
            });
            saveAttendanceData(data);
            renderTables();
            closeDialog('bulk-attendance-dialog');
            showSuccessMessage("تم تطبيق التعديل الجماعي بنجاح.");
        }
    }
}

// دالة لعرض الموظفين بعد اختيار القسم (الخطوة 2: اختيار الموظف)
function showEmployeesForBulkAttendance(departmentKey) {
  const employeeListDiv = document.getElementById('bulk-attendance-employee-list');
  const attendanceData = getAttendanceData();
  const employees = attendanceData[departmentKey] || [];

  if (employees.length === 0) {
    employeeListDiv.innerHTML = `<p style="text-align: center; color: #666;">لا يوجد موظفون في هذا القسم.</p>`;
    return;
  }

  let employeesHtml = '<h4 style="margin-bottom: 10px; color: #6f42c1;">اختر موظفًا:</h4>';
  employees.forEach((emp, index) => {
    employeesHtml += `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid #eee;">
        <span>${emp.name} (${emp.jobTitle})</span>
        <button onclick="showAttendanceStatusOptions('${departmentKey}', ${index}, '${emp.name}')"
                style="background: #007bff; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">
          تحديد حالة
        </button>
      </div>
    `;
  });
  employeeListDiv.innerHTML = employeesHtml;
}

// دالة لعرض خيارات الحالة بعد اختيار الموظف (الخطوة 3: اختيار الحالة)
function showAttendanceStatusOptions(departmentKey, employeeIndex, employeeName) {
  const dialog = document.getElementById('bulk-attendance-dialog'); // نستخدم نفس النافذة
  if (!dialog) return;

  let statusOptions = '';
  for (const code in STATUS_CODES) {
    if (code === 'default') continue;
    const statusInfo = STATUS_CODES[code];
    statusOptions += `<option value="${code}">${statusInfo.name} (${code})</option>`;
  }

  dialog.innerHTML = `
    <h3 style="margin-top: 0; color: #6f42c1; text-align: center;">تحديد حالة حضور لـ: ${employeeName}</h3>
    <div style="margin-bottom: 20px;">
      <label style="display: block; margin-bottom: 5px; font-weight: bold;">اختر الحالة لتطبيقها على جميع أيام الشهر:</label>
      <select id="bulk-attendance-status-select" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
        ${statusOptions}
      </select>
    </div>
    <div style="text-align: center;">
      <button onclick="applyBulkAttendanceToEmployee('${departmentKey}', ${employeeIndex})" 
              style="background: #28a745; color: white; border: none; padding: 10px 20px; margin: 5px; border-radius: 4px; cursor: pointer; font-size: 14px;">
        تطبيق الحالة
      </button>
      <button onclick="openBulkAttendanceDialog()" // للعودة لقائمة الأقسام
              style="background: #6c757d; color: white; border: none; padding: 10px 20px; margin: 5px; border-radius: 4px; cursor: pointer; font-size: 14px;">
        العودة
      </button>
      <button onclick="closeDialog('bulk-attendance-dialog')" 
              style="background: #dc3545; color: white; border: none; padding: 10px 20px; margin: 5px; border-radius: 4px; cursor: pointer; font-size: 14px;">
        إلغاء
      </button>
    </div>
  `;
}

// دالة لتطبيق الحالة على الموظف المحدد
function applyBulkAttendanceToEmployee(departmentKey, employeeIndex) {
  const status = document.getElementById('bulk-attendance-status-select').value;
  const data = getAttendanceData();
  const employee = data[departmentKey]?.[employeeIndex];

  if (!employee) {
    alert('خطأ: لم يتم العثور على الموظف.');
    return;
  }

  if (confirm(`هل أنت متأكد من تعيين حالة "${STATUS_CODES[status].name}" للموظف ${employee.name} لجميع أيام الشهر؟`)) {
    setEmployeeAttendanceForAllDays(departmentKey, employeeIndex, status); // نستخدم الدالة الموجودة بالفعل
    closeDialog('bulk-attendance-dialog');
  }
}

/* ================================================================ */
/* ✅✅✅ الكود النهائي والكامل لنظام إدارة الموظفين (استبدل به القديم) ✅✅✅ */
/* ================================================================ */

// --- 1. الدوال الرئيسية لفتح وإغلاق النوافذ (تأكد من وجودها) ---

function openDialog(dialogId) {
    const dialog = document.getElementById(dialogId);
    const overlay = document.getElementById(dialogId.replace('-dialog', '-overlay'));
    if (dialog) dialog.style.display = 'flex'; // Use flex for modern dialogs
    if (overlay) overlay.style.display = 'block';
}

function closeDialog(dialogId) {
    const dialog = document.getElementById(dialogId);
    const overlay = document.getElementById(dialogId.replace('-dialog', '-overlay'));
    if (dialog) dialog.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
}


// دالة فتح النافذة
/* ================================================================ */
/* ✅ 2. تحديث دوال النوافذ المنبثقة الأخرى بالتصميم الموحد ✅ */
/* ================================================================ */

// --- دالة "تعديل جماعي" المحدثة ---
function openBulkAttendanceDialog() {
    let dialog = document.getElementById('bulk-attendance-dialog');
    if (!dialog) {
        dialog = document.createElement('div');
        dialog.id = 'bulk-attendance-dialog';
        dialog.className = 'dialog wide-dialog'; // نافذة عريضة
        document.body.appendChild(dialog);
    }

    const departments = Object.keys(getAttendanceData());
    let deptOptions = departments.map(key => `<option value="${key}">${getDepartmentName(key)}</option>`).join('');

    dialog.innerHTML = `
        <div class="dialog-header">
            <h3><i class="fas fa-calendar-alt"></i> تعديل جماعي للحضور</h3>
            <span class="close" onclick="closeDialog('bulk-attendance-dialog')">×</span>
        </div>
        <div class="dialog-body">
            <div class="form-group">
                <label>1. اختر القسم لعرض الخيارات:</label>
                <select id="bulk-dept-select" onchange="showBulkAttendanceOptions(this.value)">
                    <option value="">-- اختر قسمًا --</option>
                    ${deptOptions}
                </select>
            </div>
            <div id="bulk-attendance-options" style="margin-top: 15px; border-top: 1px solid #eee; padding-top: 15px; display: none;">
                <!-- الخيارات ستظهر هنا -->
            </div>
        </div>
        <div class="dialog-footer">
            <button class="btn-secondary" onclick="closeDialog('bulk-attendance-dialog')">إغلاق</button>
        </div>
    `;
    openDialog('bulk-attendance-dialog');
}

// --- دالة "تعديل التواقيع" المحدثة ---
function openSignatureEditDialog() {
    const password = prompt('أدخل كلمة المرور لتعديل التواقيع:');
    if (password !== PASSWORD) {
        if (password !== null) alert('كلمة المرور غير صحيحة');
        return;
    }

    let dialog = document.getElementById('signature-edit-dialog');
    if (!dialog) {
        dialog = document.createElement('div');
        dialog.id = 'signature-edit-dialog';
        dialog.className = 'dialog wide-dialog';
        document.body.appendChild(dialog);
    }

    dialog.innerHTML = `
        <div class="dialog-header">
            <h3><i class="fas fa-signature"></i> تعديل التواقيع المعتمدة</h3>
            <span class="close" onclick="closeDialog('signature-edit-dialog')">×</span>
        </div>
        <div class="dialog-body" id="signature-fields-container">
            <!-- حقول التواقيع الديناميكية ستظهر هنا -->
        </div>
        <div class="dialog-footer">
            <button class="btn-primary" onclick="addSignatureField()"><i class="fas fa-plus"></i> إضافة توقيع</button>
            <button class="btn-success" onclick="saveSignatures()"><i class="fas fa-save"></i> حفظ التواقيع</button>
        </div>
    `;
    
    openDialog('signature-edit-dialog');
    populateSignatureFields(); // دالة ملء الحقول
}

// تأكد من وجود هذه الدوال المساعدة أيضاً
function populateSignatureFields() {
    const container = document.getElementById('signature-fields-container');
    if (!container) return;
    container.innerHTML = '';
    const signatures = getSignatures(); // دالة جلب التواقيع
    signatures.forEach(sig => {
        container.innerHTML += `
            <div class="form-group signature-edit-item" style="display:flex; gap:10px; align-items:center;">
                <input type="text" class="sig-title-input" value="${sig.title}" placeholder="المسمى الوظيفي" style="flex:1;">
                <input type="text" class="sig-name-input" value="${sig.name}" placeholder="الاسم" style="flex:2;">
                <button class="btn-danger" onclick="this.parentElement.remove()"><i class="fas fa-trash"></i></button>
            </div>
        `;
    });
}

function addSignatureField() {
    const container = document.getElementById('signature-fields-container');
    container.innerHTML += `
        <div class="form-group signature-edit-item" style="display:flex; gap:10px; align-items:center;">
            <input type="text" class="sig-title-input" value="" placeholder="المسمى الوظيفي" style="flex:1;">
            <input type="text" class="sig-name-input" value="" placeholder="الاسم" style="flex:2;">
            <button class="btn-danger" onclick="this.parentElement.remove()"><i class="fas fa-trash"></i></button>
        </div>
    `;
}

// دالة إغلاق النافذة
function closeSignatureEditDialog() {
    document.getElementById('signature-edit-dialog').style.display = 'none';
    document.getElementById('signature-edit-overlay').style.display = 'none';
}

// دالة التحقق من كلمة المرور (مع تعديل بسيط لإظهار الخطأ)
function verifySignaturePassword() {
    const input = document.getElementById('signature-password-input').value;
    const errorEl = document.getElementById('signature-password-error');
    const PASSWORD = "admin123"; // تأكد من أن هذا الباسورد معرف

    if (input === PASSWORD) {
        document.getElementById('signature-password-section').style.display = 'none';
        document.getElementById('signature-edit-content').style.display = 'block';
        errorEl.style.display = 'none';
        populateSignatureFields(); // دالتك الحالية لملء الحقول
    } else {
        errorEl.textContent = 'الباسورد غير صحيح';
        errorEl.style.display = 'block'; // إظهار رسالة الخطأ
    }
}

/**
 * =================================================
 *  دوال نظام التواقيع الديناميكي
 * =================================================
 */

/**
 * (الدالة الرئيسية) تملأ نافذة تعديل التواقيع بالحقول الديناميكية.
 */
function populateSignatureFields() {
    const container = document.getElementById('signature-fields-container');
    if (!container) return;
    container.innerHTML = ''; // مسح المحتوى القديم

    // إنشاء حاوية مخصصة فقط لحقول التواقيع
    const fieldsWrapper = document.createElement('div');
    fieldsWrapper.id = 'signature-fields-wrapper';
    container.appendChild(fieldsWrapper);

    const signatures = getSignatures();

    signatures.forEach((sig, index) => {
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'signature-edit-item';
        fieldDiv.innerHTML = `
            <div class="form-group">
                <label>مسمى التوقيع:</label>
                <input type="text" class="sig-title-input" value="${sig.title}" placeholder="مثال: مدير المستشفى">
            </div>
            <div class="form-group">
                <label>اسم صاحب التوقيع:</label>
                <input type="text" class="sig-name-input" value="${sig.name}" placeholder="أدخل الاسم هنا">
            </div>
            <button class="btn btn-danger" onclick="deleteSignatureField(this)"><i class="fas fa-trash"></i> حذف</button>
        `;
        fieldsWrapper.appendChild(fieldDiv); // الإضافة إلى الحاوية الداخلية
    });

    // إضافة زر "إضافة توقيع جديد" خارج حاوية الحقول
    const addButtonContainer = document.createElement('div');
    addButtonContainer.style.marginTop = '20px';
    addButtonContainer.innerHTML = `
        <button class="btn btn-primary" onclick="addSignatureField()">
            <i class="fas fa-plus"></i> إضافة توقيع جديد
        </button>
    `;
    container.appendChild(addButtonContainer);
}
function addSignatureField() {
    // استهداف الحاوية الداخلية مباشرة
    const fieldsWrapper = document.getElementById('signature-fields-wrapper');
    if (!fieldsWrapper) return;

    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'signature-edit-item';
    fieldDiv.innerHTML = `
        <div class="form-group">
            <label>مسمى التوقيع:</label>
            <input type="text" class="sig-title-input" value="" placeholder="مثال: مدير الشؤون المالية">
        </div>
        <div class="form-group">
            <label>اسم صاحب التوقيع:</label>
            <input type="text" class="sig-name-input" value="" placeholder="أدخل الاسم هنا">
        </div>
        <button class="btn btn-danger" onclick="deleteSignatureField(this)"><i class="fas fa-trash"></i> حذف</button>
    `;

    // إضافة الحقل الجديد إلى نهاية قائمة الحقول
    fieldsWrapper.appendChild(fieldDiv);
}

/**
 * يحذف حقل التوقيع من واجهة التعديل.
 * @param {HTMLElement} deleteButton - زر الحذف الذي تم النقر عليه.
 */
function deleteSignatureField(deleteButton) {
    if (confirm('هل أنت متأكد من رغبتك في حذف هذا التوقيع؟')) {
        // يحذف العنصر الأب للزر، وهو 'signature-edit-item'
        deleteButton.parentElement.remove();
    }
}
function addSignatureField() {
    const container = document.getElementById('signature-fields-container');
    const addButton = container.querySelector('.btn-primary'); // العثور على زر الإضافة

    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'signature-edit-item';
    fieldDiv.innerHTML = `
        <div class="form-group">
            <label>مسمى التوقيع:</label>
            <input type="text" class="sig-title-input" value="" placeholder="مثال: مدير الشؤون المالية">
        </div>
        <div class="form-group">
            <label>اسم صاحب التوقيع:</label>
            <input type="text" class="sig-name-input" value="" placeholder="أدخل الاسم هنا">
        </div>
        <button class="btn btn-danger" onclick="this.parentElement.remove()"><i class="fas fa-trash"></i> حذف</button>
    `;

    // إدراج الحقل الجديد قبل زر "إضافة"
    container.insertBefore(fieldDiv, addButton);
}

/**
 * يحذف توقيعاً من الواجهة (مؤقتاً قبل الحفظ).
 * @param {number} index - فهرس التوقيع المراد حذفه.
 */
function deleteSignature(index) {
    if (confirm('هل أنت متأكد من رغبتك في حذف هذا التوقيع؟')) {
        // هذه الدالة ستحذف فقط من العرض الحالي، الحفظ الفعلي يتم في saveSignatures
        const items = document.querySelectorAll('.signature-edit-item');
        if (items[index]) {
            items[index].remove();
        }
    }
}
// ✅✅ دالة الحفظ الجديدة التي تتعامل مع التواقيع الديناميكية ✅✅
function saveSignatures() {
    const newSignatures = [];
    const signatureItems = document.querySelectorAll('#signature-fields-container .signature-edit-item');

    signatureItems.forEach(item => {
        const titleInput = item.querySelector('.sig-title-input');
        const nameInput = item.querySelector('.sig-name-input');

        // إضافة التوقيع فقط إذا كان المسمى الوظيفي غير فارغ
        if (titleInput && nameInput && titleInput.value.trim() !== '') {
            newSignatures.push({
                title: titleInput.value.trim(),
                name: nameInput.value.trim()
            });
        }
    });

    // حفظ المصفوفة الجديدة في localStorage
    localStorage.setItem('dynamicSignatures', JSON.stringify(newSignatures));

    showSuccessMessage('تم حفظ التواقيع بنجاح!');
    
    // تحديث العرض في كل مكان
    displaySignaturesOnPage();
    updatePrintSignatures(); // قد تحتاج لتعديل هذه الدالة أيضاً

    closeDialog('signature-edit-dialog');
}
/**
 * @function displaySignaturesOnPage
 * @description تعرض التواقيع المحفوظة في قسم العرض الدائم بأسفل الصفحة.
 */
// ✅✅ دالة عرض التواقيع الديناميكية في الصفحة ✅✅
function displaySignaturesOnPage() {
    const container = document.querySelector('.signatures-display-section .signatures-grid');
    if (!container) return;

    const signatures = getSignatures();
    let htmlContent = '';

    if (signatures.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #888;">لا توجد تواقيع معتمدة. يمكنك إضافتها من زر "تعديل التواقيع".</p>';
        return;
    }

    signatures.forEach(sig => {
        htmlContent += `
            <div class="signature-item-display">
                <div class="title">${sig.title}:</div>
                <div class="line"></div>
                <div class="name">${sig.name || '..............................'}</div>
            </div>
        `;
    });
    container.innerHTML = htmlContent;
}
// function showSuccessMessage(message) { ... }

// تعديل دالة loadSignatures الأصلية لتستخدم المفاتيح الجديدة وتحدث الـ HTML
// هذا الجزء مهم جداً لربط نافذة التعديل بالعرض في الصفحة
function loadSignatures() {
    try {
        const contractData = JSON.parse(localStorage.getItem('persistentContractData') || '{}');
        
        // تحديث التواقيع في قسم الطباعة (print-signatures)
        // يجب أن يكون لديك IDs فريدة لكل توقيع في كل جدول
        // مثال: print-project-manager-1, print-project-manager-2, وهكذا
        // سأفترض أنك تريد تحديث التواقيع في كل قسم (النظافة، الكهرباء، إلخ)
        // وفي قسم التواقيع العام (إذا كان موجوداً في attendance.html)
        
        // تحديث التواقيع في قسم الطباعة لكل جدول
        const departments = ['cleaning', 'electricity', 'agriculture', 'civil-works', 'mechanical', 'laundry', 'patient-services', 'admin-saudi'];
        departments.forEach((deptKey, index) => {
            const pmName = contractData.projectManagerName || 'غير محدد';
            const mhName = contractData.maintenanceHeadName || 'غير محدد';
            const hmName = contractData.hospitalManagerName || 'غير محدد';
            const crName = contractData.contractorRepresentativeName || 'غير محدد';

            const pmTitle = contractData.projectManagerTitle || 'مدير المشروع';
            const mhTitle = contractData.maintenanceHeadTitle || 'رئيس قسم الصيانة';
            const hmTitle = contractData.hospitalManagerTitle || 'مدير المستشفى';
            const crTitle = contractData.contractorRepresentativeTitle || 'مندوب المقاول';

            // تحديث الأسماء
            const pmEl = document.getElementById(`print-project-manager-${index + 1}`);
            if (pmEl) pmEl.textContent = pmName;
            const mhEl = document.getElementById(`print-maintenance-head-${index + 1}`);
            if (mhEl) mhEl.textContent = mhName;
            const hmEl = document.getElementById(`print-hospital-manager-${index + 1}`);
            if (hmEl) hmEl.textContent = hmName;
            const crEl = document.getElementById(`print-contractor-rep-${index + 1}`);
            if (crEl) crEl.textContent = crName;

            // تحديث المسميات (إذا كانت موجودة في HTML)
            // ستحتاج إلى إضافة IDs للمسميات في HTML إذا لم تكن موجودة
            // مثال: <div class="print-signature-title" id="print-project-manager-title-${index+1}">مدير المشروع:</div>
            // const pmTitleEl = document.getElementById(`print-project-manager-title-${index + 1}`);
            // if (pmTitleEl) pmTitleEl.textContent = pmTitle + ':';
        });

        // تحديث التواقيع في قسم "auto-signatures" (إذا كان هذا هو القسم العام)
        const signatureContainer = document.getElementById('auto-signatures');
        if (signatureContainer) {
            let html = '<h3 style="text-align: center; margin-bottom: 20px;">التواقيع</h3>';
            html += '<div class="signatures-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 20px 0;">';
            
            editableSignatures.forEach(sig => {
                const name = contractData[`${sig.key}Name`] || '';
                const title = contractData[`${sig.key}Title`] || sig.title;
                html += `
                    <div class="signature-item" style="text-align: center; padding: 15px; border: 1px solid #ddd; border-radius: 8px;">
                        <div class="signature-title" style="font-weight: bold; margin-bottom: 10px;">${title}:</div>
                        <div class="signature-line" style="border-bottom: 2px solid #000; height: 40px; margin: 10px 0;"></div>
                        <div class="signature-name" style="font-size: 12px; color: #666;">${name}</div>
                    </div>
                `;
            });
            html += '</div>';
            signatureContainer.innerHTML = html;
        }

    } catch (error) {
        console.error('خطأ في تحميل التواقيع:', error);
    }
}

// تأكد من استدعاء loadSignatures عند تحميل الصفحة
// document.addEventListener('DOMContentLoaded', loadSignatures); // هذا موجود بالفعل
    displaySignaturesOnPage(); // <-- أضف هذا السطر هنا

// ===================================================================
//      النظام الجديد والكامل لإدارة التواقيع (عرض وتعديل)
// ===================================================================

// --- المتغيرات والإعدادات ---
const SIGNATURE_PASSWORD = "admin123";
const SIGNATURES_CONFIG = [
    { keyName: 'projectManagerName', keyTitle: 'projectManagerTitle', defaultTitle: 'مدير المشروع' },
    { keyName: 'maintenanceHeadName', keyTitle: 'maintenanceHeadTitle', defaultTitle: 'رئيس قسم الصيانة' },
    { keyName: 'hospitalManagerName', keyTitle: 'hospitalManagerTitle', defaultTitle: 'مدير المستشفى' },
    { keyName: 'contractorRepresentativeName', keyTitle: 'contractorRepresentativeTitle', defaultTitle: 'مندوب المقاول' }
];

// --- دوال فتح وإغلاق النوافذ المنبثقة (موحدة) ---
function openDialog(dialogId) {
    const dialog = document.getElementById(dialogId);
    const overlay = document.getElementById(dialogId.replace('-dialog', '-overlay'));
    if (dialog) dialog.style.display = 'flex';
    if (overlay) overlay.style.display = 'block';
}

function closeDialog(dialogId) {
    const dialog = document.getElementById(dialogId);
    const overlay = document.getElementById(dialogId.replace('-dialog', '-overlay'));
    if (dialog) dialog.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
}

// --- دوال خاصة بنافذة تعديل التواقيع ---
function openSignatureEditDialog() {
    openDialog('signature-edit-dialog');
    document.getElementById('signature-password-section').style.display = 'block';
    document.getElementById('signature-edit-content').style.display = 'none';
    const passwordInput = document.getElementById('signature-password-input');
    const passwordError = document.getElementById('signature-password-error');
    if (passwordInput) passwordInput.value = '';
    if (passwordError) {
        passwordError.textContent = '';
        passwordError.style.display = 'none';
    }
}

function verifySignaturePassword() {
    const input = document.getElementById('signature-password-input').value;
    const errorEl = document.getElementById('signature-password-error');
    if (input === SIGNATURE_PASSWORD) {
        document.getElementById('signature-password-section').style.display = 'none';
        document.getElementById('signature-edit-content').style.display = 'block';
        errorEl.style.display = 'none';
        populateSignatureFields();
    } else {
        errorEl.textContent = 'الباسورد غير صحيح';
        errorEl.style.display = 'block';
    }
}
/**
 * =================================================
 *  نظام التواقيع الديناميكي - النسخة النهائية
 * =================================================
 */

// --- 1. الدالة المساعدة الرئيسية لجلب البيانات ---

/**
 * تجلب مصفوفة التواقيع من localStorage.
 * إذا لم تجدها، تنشئ مصفوفة افتراضية وتحفظها.
 * @returns {Array} مصفوفة من كائنات التواقيع.
 */
function getSignatures() {
    try {
        const storedSignatures = localStorage.getItem('dynamicSignatures');
        if (storedSignatures) {
            return JSON.parse(storedSignatures);
        } else {
            const defaultSignatures = [
                { title: 'مدير المشروع', name: '' },
                { title: 'رئيس قسم الصيانة', name: '' },
                { title: 'مدير المستشفى', name: '' },
                { title: 'مندوب المقاول', name: '' }
            ];
            localStorage.setItem('dynamicSignatures', JSON.stringify(defaultSignatures));
            return defaultSignatures;
        }
    } catch (error) {
        console.error("خطأ في قراءة التواقيع من localStorage:", error);
        return [];
    }
}

// --- 2. دوال نافذة تعديل التواقيع ---

/**
 * (مُصححة) تبني واجهة تعديل التواقيع مع أزرار الإضافة والحذف.
 */
function populateSignatureFields() {
    const container = document.getElementById('signature-fields-container');
    if (!container) return;
    container.innerHTML = '';

    const fieldsWrapper = document.createElement('div');
    fieldsWrapper.id = 'signature-fields-wrapper';
    container.appendChild(fieldsWrapper);

    const signatures = getSignatures();
    signatures.forEach((sig) => {
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'signature-edit-item';
        fieldDiv.innerHTML = `
            <div class="form-group">
                <label>مسمى التوقيع:</label>
                <input type="text" class="sig-title-input" value="${sig.title}" placeholder="مثال: مدير المستشفى">
            </div>
            <div class="form-group">
                <label>اسم صاحب التوقيع:</label>
                <input type="text" class="sig-name-input" value="${sig.name}" placeholder="أدخل الاسم هنا">
            </div>
            <button class="btn btn-danger" onclick="deleteSignatureField(this)"><i class="fas fa-trash"></i> حذف</button>
        `;
        fieldsWrapper.appendChild(fieldDiv);
    });

    const addButtonContainer = document.createElement('div');
    addButtonContainer.style.marginTop = '20px';
    addButtonContainer.innerHTML = `
        <button class="btn btn-primary" onclick="addSignatureField()">
            <i class="fas fa-plus"></i> إضافة توقيع جديد
        </button>
    `;
    container.appendChild(addButtonContainer);
}

/**
 * (مُصححة) تضيف حقلاً جديداً فارغاً لإدخال توقيع.
 */
function addSignatureField() {
    const fieldsWrapper = document.getElementById('signature-fields-wrapper');
    if (!fieldsWrapper) return;

    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'signature-edit-item';
    fieldDiv.innerHTML = `
        <div class="form-group">
            <label>مسمى التوقيع:</label>
            <input type="text" class="sig-title-input" value="" placeholder="مثال: مدير الشؤون المالية">
        </div>
        <div class="form-group">
            <label>اسم صاحب التوقيع:</label>
            <input type="text" class="sig-name-input" value="" placeholder="أدخل الاسم هنا">
        </div>
        <button class="btn btn-danger" onclick="deleteSignatureField(this)"><i class="fas fa-trash"></i> حذف</button>
    `;
    fieldsWrapper.appendChild(fieldDiv);
}

/**
 * (مُصححة) تحذف حقل التوقيع من واجهة التعديل.
 */
function deleteSignatureField(deleteButton) {
    if (confirm('هل أنت متأكد من رغبتك في حذف هذا التوقيع؟')) {
        deleteButton.parentElement.remove();
    }
}

// ✅✅✅ النسخة النهائية والصحيحة 100% لدالة تحديث تواقيع الطباعة ✅✅✅
// (تأكد من أن هذا الكود موجود مرة واحدة فقط في ملفك)

function updatePrintSignatures() {
    try {
        // 1. جلب مصفوفة التواقيع من المصدر الصحيح (النظام الديناميكي)
        const signatures = getSignatures(); 

        // 2. تحديث جميع أقسام الطباعة في الصفحة
        document.querySelectorAll('.print-signatures').forEach(printSection => {
            const grid = printSection.querySelector('.print-signatures-grid');
            if (!grid) return; // تخطي إذا لم يتم العثور على الشبكة

            let htmlContent = '';
            if (signatures.length === 0) {
                htmlContent = '<p>لا توجد تواقيع محددة للطباعة.</p>';
            } else {
                // بناء HTML لكل توقيع موجود في المصفوفة
                signatures.forEach(sig => {
                    htmlContent += `
                        <div class="print-signature-item">
                            <div class="print-signature-title">${sig.title || 'مسمى غير محدد'}:</div>
                            <div class="print-signature-line"></div>
                            <div class="print-signature-name">${sig.name || 'غير محدد'}</div>
                        </div>
                    `;
                });
            }
            // وضع المحتوى المكتمل داخل شبكة التواقيع
            grid.innerHTML = htmlContent;
        });
        
        console.log('تم تحديث جميع أقسام تواقيع الطباعة بنجاح.');

    } catch (error) {
        console.error('حدث خطأ فادح أثناء تحديث تواقيع الطباعة:', error);
    }
}


/**
 * (مُصححة) تحدث التواقيع في جميع أقسام الطباعة.
 */

/**
 * =================================================
 *  دالة مساعدة لجلب التواقيع
 * =================================================
 */

/**
 * تجلب مصفوفة التواقيع من localStorage.
 * @returns {Array} مصفوفة من كائنات التواقيع.
 */
function getSignatures() {
    try {
        // ابحث عن المفتاح الجديد 'dynamicSignatures'
        const storedSignatures = localStorage.getItem('dynamicSignatures');
        
        // إذا وجدنا بيانات، قم بتحويلها من نص إلى مصفوفة
        if (storedSignatures) {
            return JSON.parse(storedSignatures);
        } else {
            // إذا لم نجد بيانات، قم بإنشاء مصفوفة افتراضية لأول مرة
            const defaultSignatures = [
                { title: 'مدير المشروع', name: '' },
                { title: 'رئيس قسم الصيانة', name: '' },
                { title: 'مدير المستشفى', name: '' },
                { title: 'مندوب المقاول', name: '' }
            ];
            // حفظها في localStorage للمستقبل
            localStorage.setItem('dynamicSignatures', JSON.stringify(defaultSignatures));
            return defaultSignatures;
        }
    } catch (error) {
        console.error("خطأ في قراءة التواقيع من localStorage:", error);
        return []; // إرجاع مصفوفة فارغة في حالة وجود أي خطأ
    }
}

/**
 * =================================================
 *  دوال النسخ الاحتياطي والاستعادة
 * =================================================
 */

/**
 * يقوم بحفظ بيانات الحضور والغياب الحالية في ملف JSON وتنزيله.
 */
function backupAttendanceData() {
  try {
    // 1. الحصول على البيانات من localStorage
    const attendanceData = localStorage.getItem('attendanceData');
    if (!attendanceData) {
      alert('لا توجد بيانات لحفظها!');
      return;
    }

    // 2. إنشاء كائن Blob (Binary Large Object) من البيانات
    const blob = new Blob([attendanceData], { type: 'application/json' });

    // 3. إنشاء رابط مؤقت لتنزيل الملف
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // 4. تحديد اسم الملف (مثال: backup-2025-07-29.json)
    const date = new Date().toISOString().split('T')[0];
    a.download = `attendance-backup-${date}.json`;

    // 5. محاكاة النقر على الرابط لبدء التنزيل
    document.body.appendChild(a);
    a.click();

    // 6. تنظيف الرابط المؤقت من الذاكرة
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showSuccessMessage('تم تنزيل ملف النسخة الاحتياطية بنجاح!');

  } catch (error) {
    console.error('حدث خطأ أثناء إنشاء النسخة الاحتياطية:', error);
    alert('فشل إنشاء النسخة الاحتياطية. راجع الكونسول لمزيد من التفاصيل.');
  }
}

/**
 * يقوم بقراءة ملف نسخة احتياطية واستعادة البيانات منه.
 * @param {Event} event - الحدث الناتج عن تغيير حقل إدخال الملف.
 */
function restoreAttendanceData(event) {
  const file = event.target.files[0];
  if (!file) {
    return; // لم يتم اختيار ملف
  }

  // التأكد من أن المستخدم يريد فعلاً استبدال البيانات الحالية
  if (!confirm('هل أنت متأكد من رغبتك في استعادة البيانات من هذا الملف؟\nسيتم حذف جميع البيانات الحالية واستبدالها ببيانات الملف.')) {
    // إعادة تعيين قيمة حقل الإدخال للسماح باختيار نفس الملف مرة أخرى
    event.target.value = '';
    return;
  }

  const reader = new FileReader();

  reader.onload = function(e) {
    try {
      const content = e.target.result;
      
      // 1. التحقق من أن المحتوى هو JSON صالح
      const restoredData = JSON.parse(content);

      // 2. التحقق من أن البيانات المستعادة لها الهيكل المتوقع (اختياري ولكنه جيد)
      if (typeof restoredData.cleaning === 'undefined' || typeof restoredData.electricity === 'undefined') {
        throw new Error('الملف غير صالح أو لا يطابق هيكل البيانات المطلوب.');
      }

      // 3. حفظ البيانات المستعادة في localStorage
      localStorage.setItem('attendanceData', JSON.stringify(restoredData));

      // 4. إعادة تحميل الصفحة لتطبيق البيانات الجديدة
      alert('تم استعادة البيانات بنجاح! سيتم إعادة تحميل الصفحة الآن.');
      window.location.reload();

    } catch (error) {
      console.error('حدث خطأ أثناء استعادة البيانات:', error);
      alert(`فشل استعادة الملف. تأكد من أنك اخترت ملف نسخة احتياطية صحيح.\n\nالخطأ: ${error.message}`);
    } finally {
      // إعادة تعيين قيمة حقل الإدخال للسماح باختيار نفس الملف مرة أخرى
      event.target.value = '';
    }
  };

  reader.onerror = function() {
    alert('حدث خطأ أثناء قراءة الملف.');
    event.target.value = '';
  };

  // بدء قراءة الملف كنص
  reader.readAsText(file);
}
// ✅✅✅ [إضافة رقم 3: دوال الرفع الذكي والتعديل الجماعي] ✅✅✅

// ✅✅✅ [إضافة رقم 3: دوال الرفع الذكي والتعديل الجماعي] ✅✅✅

// --- دوال الرفع الذكي ---

// --- دوال التعديل الجماعي للحضور ---

/* ================================================================ */
/* ✅ 2. الكود الكامل والنهائي لكل النوافذ المنبثقة (مع إصلاح الباسورد) ✅ */
/* ================================================================ */

// --- 1. نظام إدارة الموظفين (مع إصلاح كلمة المرور) ---

function openEmployeeManagement() {
    // هذه الدالة الآن تفتح نافذة كلمة المرور فقط
    let dialog = document.getElementById('password-dialog');
    if (!dialog) {
        dialog = document.createElement('div');
        dialog.id = 'password-dialog';
        dialog.className = 'dialog';
        document.body.appendChild(dialog);
    }
    dialog.innerHTML = `
        <div class="dialog-header">
            <h3><i class="fas fa-lock"></i> الوصول إلى لوحة الإدارة</h3>
            <span class="close" onclick="closeDialog('password-dialog')">×</span>
        </div>
        <div class="dialog-body">
            <p class="info-text">للوصول إلى هذه الإعدادات، يرجى إدخال كلمة المرور.</p>
            <div class="form-group">
                <label for="management-password-input">كلمة المرور:</label>
                <input type="password" id="management-password-input" placeholder="••••••••" onkeypress="if(event.key==='Enter') verifyManagementPassword()">
            </div>
            <p id="password-error-message" style="display:none; color: #dc3545; text-align:center;"></p>
        </div>
        <div class="dialog-footer">
            <button class="btn-success" onclick="verifyManagementPassword()"><i class="fas fa-check-circle"></i> تأكيد الدخول</button>
        </div>
    `;
    openDialog('password-dialog');
}

/* ================================================================ */
/* ✅ 1. دالة التحقق من كلمة المرور المُصححة (ضعها مكان القديمة) ✅ */
/* ================================================================ */
function verifyManagementPassword() {
    const input = document.getElementById('management-password-input').value;
    const errorMsg = document.getElementById('password-error-message');
    
    if (input === PASSWORD) {
        // عند نجاح كلمة المرور:
        // 1. أغلق نافذة كلمة المرور
        closeDialog('password-dialog');
        
        // 2. استدع الدالة الجديدة والمُحسّنة لفتح واجهة الإدارة
        openEmployeeManagementInterface(); 
    } else {
        // في حالة فشل كلمة المرور
        errorMsg.textContent = "كلمة المرور غير صحيحة.";
        errorMsg.style.display = 'block';
    }
}
/* ================================================================ */
/* ✅ 2. أضف هذه الدالة الجديدة لفتح واجهة الإدارة ✅ */
/* ================================================================ */
function openEmployeeManagementInterface() {
    let dialog = document.getElementById('management-dialog');
    if (!dialog) {
        dialog = document.createElement('div');
        dialog.id = 'management-dialog';
        dialog.className = 'dialog';
        document.body.appendChild(dialog);
    }
    
    dialog.innerHTML = `
        <div class="dialog-header">
            <h3><i class="fas fa-users-cog"></i> لوحة إدارة الموظفين والأقسام</h3>
            <span class="close" onclick="closeDialog('management-dialog')">×</span>
        </div>
        <div class="dialog-body">
            <div class="management-container">
                <div class="management-sidebar">
                    <h4><i class="fas fa-building"></i> الأقسام</h4>
                    <div id="centers-list-sidebar"></div>
                </div>
                <div class="management-content">
                    <div id="management-header">
                        <h3 id="content-title">اختر قسماً من القائمة</h3>
                        <button id="add-employee-btn" class="btn-success" style="display:none;" onclick="showAddEmployeeFormForCenter()">
                            <i class="fas fa-plus"></i> إضافة موظف
                        </button>
                    </div>
                    <div id="management-content-area">
                        <p style="text-align:center; color:#888; margin-top:50px;">سيتم عرض الموظفين هنا.</p>
                    </div>
                </div>
            </div>
        </div>
        <div class="dialog-footer">
            <button class="btn-secondary" onclick="closeDialog('management-dialog')">إغلاق</button>
        </div>
    `;

    dialog.classList.add('wide-dialog');
    openDialog('management-dialog');
    populateCentersSidebar(); // هذه الدالة يجب أن تكون موجودة لديك من قبل
}

function showFullManagementInterface() {
    // هذه الدالة الآن تفتح الواجهة الرئيسية للإدارة
    let dialog = document.getElementById('management-dialog');
    if (!dialog) {
        dialog = document.createElement('div');
        dialog.id = 'management-dialog';
        dialog.className = 'dialog';
        document.body.appendChild(dialog);
    }
    dialog.innerHTML = `
        <div class="dialog-header">
            <h3><i class="fas fa-users-cog"></i> لوحة إدارة الموظفين والأقسام</h3>
            <span class="close" onclick="closeDialog('management-dialog')">×</span>
        </div>
        <div class="dialog-body">
            <div class="management-container">
                <div class="management-sidebar">
                    <h4><i class="fas fa-building"></i> الأقسام</h4>
                    <div id="centers-list-sidebar"></div>
                </div>
                <div class="management-content">
                    <div id="management-header">
                        <h3 id="content-title">اختر قسماً من القائمة</h3>
                        <button id="add-employee-btn" class="btn-success" style="display:none;" onclick="showAddEmployeeFormForCenter()">
                            <i class="fas fa-plus"></i> إضافة موظف
                        </button>
                    </div>
                    <div id="management-content-area">
                        <p style="text-align:center; color:#888; margin-top:50px;">سيتم عرض الموظفين هنا.</p>
                    </div>
                </div>
            </div>
        </div>
        <div class="dialog-footer">
            <button class="btn-secondary" onclick="closeDialog('management-dialog')">إغلاق</button>
        </div>
    `;
    dialog.classList.add('wide-dialog');
    openDialog('management-dialog');
    populateCentersSidebar();
}


// --- 2. نظام الرفع الذكي (بالتصميم الاحترافي) ---

function openSmartUploadDialog() {
    let dialog = document.getElementById('smart-upload-dialog');
    if (!dialog) {
        dialog = document.createElement('div');
        dialog.id = 'smart-upload-dialog';
        dialog.className = 'dialog wide-dialog';
        document.body.appendChild(dialog);
    }
    dialog.innerHTML = `
        <div class="dialog-header">
            <h3><i class="fas fa-magic"></i> الرفع الذكي لملفات الأقسام</h3>
            <span class="close" onclick="closeDialog('smart-upload-dialog')">×</span>
        </div>
        <div class="dialog-body">
            <p class="info-text">هذه الأداة تربط كل ملف إكسل بالقسم الصحيح تلقائيًا بناءً على <strong>اسم الملف</strong>. يمكنك اختيار عدة ملفات مرة واحدة.</p>
            <input type="file" id="smart-upload-input" accept=".xlsx, .xls, .csv" multiple style="display: none;" onchange="handleSmartUpload(event)">
            <div class="buttons" style="justify-content: center;">
                <button class="btn-success" onclick="document.getElementById('smart-upload-input').click()">
                    <i class="fas fa-file-excel"></i> اختر الملفات وابدأ الرفع
                </button>
            </div>
            <div id="smart-upload-status-area" class="status-area"></div>
        </div>
        <div class="dialog-footer">
            <button class="btn-secondary" onclick="closeDialog('smart-upload-dialog')">إغلاق</button>
        </div>
    `;
    openDialog('smart-upload-dialog');
}

async function handleSmartUpload(event) {
    const files = event.target.files;
    if (files.length === 0) return;

    const statusArea = document.getElementById('smart-upload-status-area');
    statusArea.innerHTML = '<h4><i class="fas fa-spinner fa-spin"></i> جاري المعالجة...</h4>';
    
    const departmentNameMap = new Map();
    const departmentKeys = ['cleaning', 'electricity', 'agriculture', 'civil_works', 'mechanical', 'laundry', 'patient_services', 'admin_saudi'];
    departmentKeys.forEach(key => {
        departmentNameMap.set(getDepartmentName(key).toLowerCase().trim(), key);
    });
    
    let successCount = 0, errorCount = 0, skippedFileCount = 0;
    let statusHTML = '<h4>نتائج العملية:</h4>';

    for (const file of files) {
        const fileName = file.name.split('.').slice(0, -1).join('.').toLowerCase().trim();
        const matchedDeptKey = departmentNameMap.get(fileName);

        if (matchedDeptKey) {
            try {
                const employees = await processAndFilterExcelData(file); // دالة الإكسل التي أصلحناها
                addEmployeesToDepartment(matchedDeptKey, employees);
                successCount++;
                statusHTML += `<p class="status-success">✓ تمت معالجة ملف <strong>"${file.name}"</strong> بنجاح.</p>`;
            } catch (error) {
                errorCount++;
                statusHTML += `<p class="status-error">✗ فشلت معالجة ملف <strong>"${file.name}"</strong>. السبب: ${error.message}</p>`;
            }
        } else {
            skippedFileCount++;
            statusHTML += `<p class="status-skipped">! تم تجاهل ملف <strong>"${file.name}"</strong> لأنه لا يطابق أي اسم قسم.</p>`;
        }
    }
    
    statusHTML += `<hr><p><strong>النتائج:</strong> ${successCount} ملف تمت معالجته، ${errorCount} فشل، ${skippedFileCount} تم تجاهله.</p>`;
    statusArea.innerHTML = statusHTML;
    renderTables();
    event.target.value = '';
}


// --- 3. نظام تعديل الحضور الجماعي (بالتصميم الاحترافي) ---

function openBulkAttendanceDialog() {
    let dialog = document.getElementById('bulk-attendance-dialog');
    if (!dialog) {
        dialog = document.createElement('div');
        dialog.id = 'bulk-attendance-dialog';
        dialog.className = 'dialog wide-dialog';
        document.body.appendChild(dialog);
    }

    const departments = Object.keys(getAttendanceData());
    let deptOptions = departments.map(key => `<option value="${key}">${getDepartmentName(key)}</option>`).join('');

    dialog.innerHTML = `
        <div class="dialog-header">
            <h3><i class="fas fa-calendar-alt"></i> تعديل جماعي للحضور</h3>
            <span class="close" onclick="closeDialog('bulk-attendance-dialog')">×</span>
        </div>
        <div class="dialog-body">
            <div class="form-group">
                <label>1. اختر القسم لعرض الخيارات:</label>
                <select id="bulk-dept-select" onchange="showBulkAttendanceOptions(this.value)">
                    <option value="">-- اختر قسمًا --</option>
                    ${deptOptions}
                </select>
            </div>
            <div id="bulk-attendance-options" style="margin-top: 15px; border-top: 1px solid #eee; padding-top: 15px; display: none;">
                <!-- الخيارات ستظهر هنا ديناميكياً -->
            </div>
        </div>
        <div class="dialog-footer">
            <button class="btn-secondary" onclick="closeDialog('bulk-attendance-dialog')">إغلاق</button>
        </div>
    `;
    openDialog('bulk-attendance-dialog');
}

function showBulkAttendanceOptions(departmentKey) {
    const optionsDiv = document.getElementById('bulk-attendance-options');
    if (!departmentKey) {
        optionsDiv.style.display = 'none';
        return;
    }
    
    const { monthDaysArray } = getExtractPeriodDetails();
    let dayOptions = monthDaysArray.map((day, index) => `<option value="${index}">${day}</option>`).join('');
    let statusOptions = Object.keys(STATUS_CODES).filter(c => c !== 'default').map(c => `<option value="${c}">${STATUS_CODES[c].name} (${c})</option>`).join('');
    const employees = getAttendanceData()[departmentKey] || [];

    let employeeCheckboxes = '<p class="info-text">لا يوجد موظفون في هذا القسم.</p>';
    if (employees.length > 0) {
        employeeCheckboxes = `
            <div class="form-group">
                <label>2. اختر الموظفين (أو اتركهم جميعاً محددين):</label>
                <div class="checkbox-grid">
                    <div class="form-group-checkbox">
                        <input type="checkbox" id="select-all-employees-bulk" checked onchange="toggleAllCheckboxes(this, 'bulk-employee-checkboxes')">
                        <label for="select-all-employees-bulk"><strong>تحديد الكل / إلغاء التحديد</strong></label>
                    </div>
                </div>
                <div id="bulk-employee-checkboxes" class="checkbox-grid" style="max-height: 150px; overflow-y: auto; border: 1px solid #ddd; padding: 10px;">
                  <div style="margin-bottom:8px;">
    <input
        type="text"
        id="bulk-employee-search"
        placeholder="ابحث بالاسم / الوظيفة / رقم الإقامة"
        oninput="filterBulkAttendanceEmployees(this.value)"
        style="width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:8px;font-family:Tajawal,Arial,sans-serif;"
    >
</div>

${employees.map((emp, index) => {
    const name = String(emp.name || '').trim() || 'بدون اسم';
    const jobTitle = String(emp.jobTitle || '').trim() || 'بدون وظيفة';
    const iqamaId = String(emp.iqamaId || '').trim() || 'بدون إقامة';
    const searchText = `${name} ${jobTitle} ${iqamaId}`.toLowerCase();

    return `
        <div class="form-group-checkbox bulk-employee-row" data-search="${searchText.replace(/"/g, '&quot;')}">
            <input type="checkbox" class="employee-checkbox" value="${index}" id="bulk-emp-${index}" checked>
            <label for="bulk-emp-${index}">
                <strong>${name}</strong>
                <span style="color:#64748b;font-size:12px;"> — ${jobTitle} — ${iqamaId} — رقم ${index + 1}</span>
            </label>
        </div>
    `;
}).join('')}
                </div>
            </div>
        `;
    }

    optionsDiv.innerHTML = `
        ${employeeCheckboxes}
        <div class="form-group" style="margin-top: 15px;">
            <label>3. اختر الحالة الجديدة والفترة:</label>
            <select id="bulk-status-select">${statusOptions}</select>
        </div>
        <div style="display:flex; gap: 15px;">
            <div class="form-group" style="flex:1;">
                <label>من يوم:</label>
                <select id="bulk-start-day">${dayOptions}</select>
            </div>
            <div class="form-group" style="flex:1;">
                <label>إلى يوم:</label>
                <select id="bulk-end-day">${dayOptions}</select>
            </div>
        </div>
        <div class="buttons" style="justify-content: center;">
            <button class="btn-success" onclick="applyBulkAttendance('${departmentKey}')"><i class="fas fa-check"></i> تطبيق على الموظفين المحددين</button>
        </div>
    `;
    optionsDiv.style.display = 'block';
}
function filterBulkAttendanceEmployees(query) {
    query = String(query || '').trim().toLowerCase();

    document.querySelectorAll('#bulk-employee-checkboxes .bulk-employee-row').forEach(row => {
        const text = row.getAttribute('data-search') || '';
        row.style.display = !query || text.includes(query) ? '' : 'none';
    });
}
function applyBulkAttendance(departmentKey) {
    const selectedEmployeeIndexes = Array.from(document.querySelectorAll('#bulk-employee-checkboxes input:checked')).map(cb => parseInt(cb.value));
    if (selectedEmployeeIndexes.length === 0) {
        alert("الرجاء اختيار موظف واحد على الأقل.");
        return;
    }

    const newStatus = document.getElementById('bulk-status-select').value;
    const startIndex = parseInt(document.getElementById('bulk-start-day').value);
    const endIndex = parseInt(document.getElementById('bulk-end-day').value);

    if (startIndex > endIndex) {
        alert("خطأ: يوم البداية يجب أن يكون قبل أو نفس يوم النهاية.");
        return;
    }

    const startDayText = document.getElementById('bulk-start-day').options[startIndex].text;
    const endDayText = document.getElementById('bulk-end-day').options[endIndex].text;

    if (confirm(`هل أنت متأكد من تطبيق الحالة "${STATUS_CODES[newStatus].name}" على ${selectedEmployeeIndexes.length} موظف من يوم ${startDayText} إلى يوم ${endDayText}؟`)) {
        const data = getAttendanceData();
        if (data[departmentKey]) {
            selectedEmployeeIndexes.forEach(empIndex => {
                const employee = data[departmentKey][empIndex];
                if (employee) {
                    for (let i = startIndex; i <= endIndex; i++) {
                        if (employee.days && i < employee.days.length) employee.days[i] = newStatus;
                    }
                }
            });
            saveAttendanceData(data);
            renderTables();
            closeDialog('bulk-attendance-dialog');
            showSuccessMessage("تم تطبيق التعديل الجماعي بنجاح.");
        }
    }
}

// دالة مساعدة لتحديد كل الخيارات
function toggleAllCheckboxes(source, containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        const checkboxes = container.querySelectorAll('.employee-checkbox');
        checkboxes.forEach(checkbox => checkbox.checked = source.checked);
    }
}

// =================================================================================
//      نظام إدارة الموظفين والأقسام (النسخة النهائية والموحدة)
// =================================================================================

// --- 1. الدوال الرئيسية لفتح وإغلاق لوحة الإدارة ---

/**
 * تفتح نافذة طلب كلمة المرور للوصول إلى لوحة الإدارة.
 */
function openEmployeeManagement() {
    let dialog = document.getElementById('password-dialog');
    if (!dialog) {
        dialog = document.createElement('div');
        dialog.id = 'password-dialog';
        dialog.className = 'dialog';
        document.body.appendChild(dialog);
    }
    dialog.innerHTML = `
        <div class="dialog-header">
            <h3><i class="fas fa-lock"></i> الوصول إلى لوحة الإدارة</h3>
            <span class="close" onclick="closeDialog('password-dialog')">×</span>
        </div>
        <div class="dialog-body">
            <p class="info-text">للوصول إلى هذه الإعدادات، يرجى إدخال كلمة المرور.</p>
            <div class="form-group">
                <label for="management-password-input">كلمة المرور:</label>
                <input type="password" id="management-password-input" placeholder="••••••••" onkeypress="if(event.key==='Enter') verifyManagementPassword()">
            </div>
            <p id="password-error-message" style="display:none; color: #dc3545; text-align:center;"></p>
        </div>
        <div class="dialog-footer">
            <button class="btn-success" onclick="verifyManagementPassword()"><i class="fas fa-check-circle"></i> تأكيد الدخول</button>
        </div>
    `;
    openDialog('password-dialog');
}

/**
 * تتحقق من كلمة المرور، وإذا كانت صحيحة، تفتح واجهة الإدارة.
 */
function verifyManagementPassword() {
    const input = document.getElementById('management-password-input').value;
    const errorMsg = document.getElementById('password-error-message');
    
    if (input === PASSWORD) {
        closeDialog('password-dialog');
        openEmployeeManagementInterface(); 
    } else {
        errorMsg.textContent = "كلمة المرور غير صحيحة.";
        errorMsg.style.display = 'block';
    }
}

/**
 * تبني وتفتح واجهة لوحة الإدارة الكاملة.
 */
function openEmployeeManagementInterface() {
    let dialog = document.getElementById('management-dialog');
    if (!dialog) {
        dialog = document.createElement('div');
        dialog.id = 'management-dialog';
        dialog.className = 'dialog wide-dialog';
        document.body.appendChild(dialog);
    }
    
    dialog.innerHTML = `
        <div class="dialog-header">
            <h3><i class="fas fa-users-cog"></i> لوحة إدارة الموظفين والأقسام</h3>
            <span class="close" onclick="closeDialog('management-dialog')">×</span>
        </div>
        <div class="dialog-body">
            <div class="management-container">
                <div class="management-sidebar">
                    <h4><i class="fas fa-building"></i> الأقسام</h4>
                    <div id="centers-list-sidebar"></div>
                </div>
                <div class="management-content">
                    <div id="management-header">
                        <h3 id="content-title">اختر قسماً من القائمة</h3>
                        <button id="add-employee-btn" class="btn-success" style="display:none;" onclick="showAddEmployeeFormForCenter()">
                            <i class="fas fa-plus"></i> إضافة موظف
                        </button>
                    </div>
                    <div id="management-content-area">
                        <p style="text-align:center; color:#888; margin-top:50px;">سيتم عرض الموظفين هنا.</p>
                    </div>
                </div>
            </div>
        </div>
        <div class="dialog-footer">
            <button class="btn-secondary" onclick="closeDialog('management-dialog')">إغلاق</button>
        </div>
    `;

    openDialog('management-dialog');
    populateCentersSidebar();
}

// =================================================================================
//      (تكملة) الدوال المساعدة لنظام الإدارة
// =================================================================================

/**
 * تملأ الشريط الجانبي بأسماء الأقسام وخيارات الإعدادات.
 */
function populateCentersSidebar() {
    const sidebarContainer = document.getElementById('centers-list-sidebar');
    if (!sidebarContainer) return;
    
   const allDeptNames = getDepartmentName(null, true) || {}; // <= إضافة || {}
  sidebarContainer.innerHTML = '';
    
    Object.keys(allDeptNames).forEach(key => {
        const item = document.createElement('a');
        item.href = '#';
        item.textContent = allDeptNames[key];
        item.dataset.key = key; 
        item.onclick = (e) => {
            e.preventDefault();
            const currentActive = sidebarContainer.querySelector('.active');
            if (currentActive) currentActive.classList.remove('active');
            item.classList.add('active');
            displayEmployeesForCenter(item.dataset.key);
        };
        sidebarContainer.appendChild(item);
    });

    const divider = document.createElement('hr');
    divider.style.margin = '15px 0';
    sidebarContainer.appendChild(divider);

    const settingsHeader = document.createElement('div');
    settingsHeader.innerHTML = '<h4><i class="fas fa-cogs"></i> إعدادات النظام</h4>';
    settingsHeader.style.padding = '0 10px';
    sidebarContainer.appendChild(settingsHeader);

    const editNamesLink = document.createElement('a');
    editNamesLink.href = '#';
    editNamesLink.innerHTML = '<i class="fas fa-edit"></i> تعديل أسماء الأقسام';
    editNamesLink.onclick = (e) => {
        e.preventDefault();
        const currentActive = sidebarContainer.querySelector('.active');
        if (currentActive) currentActive.classList.remove('active');
        editNamesLink.classList.add('active');
        showEditTableNames(); 
    };
    sidebarContainer.appendChild(editNamesLink);
}

/**
 * تعرض الموظفين عند اختيار قسم معين.
 */
function displayEmployeesForCenter(deptKey) {
    window.activeCenterKey = deptKey;
    const contentArea = document.getElementById('management-content-area');
    const title = document.getElementById('content-title');
    const addButton = document.getElementById('add-employee-btn');
    
    const deptName = getDepartmentName(deptKey);
    title.innerHTML = `<i class="fas fa-users"></i> موظفو قسم: ${deptName}`;
    addButton.style.display = 'inline-flex';
    
    const data = getAttendanceData()[deptKey] || [];
    contentArea.innerHTML = '';
    
    if (data.length === 0) {
        contentArea.innerHTML = '<p style="text-align:center; color:#888; margin-top:50px;">لا يوجد موظفون في هذا القسم.</p>';
        return;
    }
    
    data.forEach((emp, index) => {
        const card = document.createElement('div');
        card.className = 'employee-card';
        card.innerHTML = `
            <div class="employee-info">
                <strong class="employee-name">${emp.name}</strong>
                <span class="employee-job">${emp.jobTitle}</span>
            </div>
            <div class="employee-actions">
                <button title="تعديل" class="btn-primary" onclick="openEditEmployeeForm('${deptKey}', ${index})"><i class="fas fa-pencil-alt"></i></button>
                <button title="حذف" class="btn-danger" onclick="confirmDeleteEmployeeFromMgmt('${deptKey}', ${index})"><i class="fas fa-trash"></i></button>
            </div>
        `;
        contentArea.appendChild(card);
    });
}

/**
 * تعرض نموذج تعديل أسماء الجداول في منطقة المحتوى.
 */
function showEditTableNames() {
  const contentArea = document.getElementById('management-content-area');
  const title = document.getElementById('content-title');
  const addButton = document.getElementById('add-employee-btn');

  if (!contentArea || !title || !addButton) return;

  title.innerHTML = '<i class="fas fa-edit"></i> تعديل أسماء الأقسام';
  addButton.style.display = 'none';

  const departments = [
    { id: 'cleaning', key: 'cleaning', number: 1 }, { id: 'electricity', key: 'electricity', number: 2 },
    { id: 'agriculture', key: 'agriculture', number: 3 }, { id: 'civil-works', key: 'civil_works', number: 4 },
    { id: 'mechanical', key: 'mechanical', number: 5 }, { id: 'laundry', key: 'laundry', number: 6 },
    { id: 'patient-services', key: 'patient_services', number: 7 }, { id: 'admin-saudi', key: 'admin_saudi', number: 8 }
  ];

  let formHTML = `
    <p style="color: #666; margin-bottom: 20px;">يمكنك تعديل اسم كل قسم. سيتم حفظ التغييرات وتحديث الواجهة تلقائيًا.</p>
    <div style="max-height: 400px; overflow-y: auto; padding-right: 10px;">
  `;

  departments.forEach(dept => {
    const currentName = getDepartmentName(dept.key);
    formHTML += `
      <div class="form-group" style="border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 10px;">
        <label style="font-weight: bold;">جدول رقم ${dept.number}:</label>
        <input type="text" id="table-name-${dept.id}" value="${currentName}" placeholder="أدخل اسم القسم الجديد">
      </div>
    `;
  });

  formHTML += `
    </div>
    <div class="buttons" style="justify-content: flex-start; margin-top: 20px;">
      <button onclick="saveTableNames()" class="btn-success"><i class="fas fa-save"></i> حفظ التغييرات</button>
      <button onclick="resetTableNames()" class="btn-warning"><i class="fas fa-undo"></i> استعادة الأسماء الافتراضية</button>
    </div>
  `;
  contentArea.innerHTML = formHTML;
}

/**
 * تحفظ الأسماء الجديدة للأقسام وتحدث الواجهة.
 */
function saveTableNames() {
    try {
        const departments = [
            { id: 'cleaning', key: 'cleaning' }, { id: 'electricity', key: 'electricity' },
            { id: 'agriculture', key: 'agriculture' }, { id: 'civil-works', key: 'civil_works' },
            { id: 'mechanical', key: 'mechanical' }, { id: 'laundry', key: 'laundry' },
            { id: 'patient-services', key: 'patient_services' }, { id: 'admin-saudi', key: 'admin_saudi' }
        ];
        const departmentNames = JSON.parse(localStorage.getItem('departmentNames')) || {};
        let hasChanges = false;

        departments.forEach(dept => {
            const input = document.getElementById(`table-name-${dept.id}`);
            if (input && input.value.trim()) {
                const newName = input.value.trim();
                if (departmentNames[dept.key] !== newName) {
                    departmentNames[dept.key] = newName;
                    hasChanges = true;
                }
            }
        });

        if (hasChanges) {
            localStorage.setItem('departmentNames', JSON.stringify(departmentNames));
            renderTables();
            populateCentersSidebar();
            showSuccessMessage('تم حفظ أسماء الأقسام بنجاح');
        } else {
            alert('لم يتم إجراء أي تغييرات.');
        }
    } catch (error) {
        console.error('خطأ في حفظ أسماء الجداول:', error);
    }
}

/**
 * تستعيد الأسماء الافتراضية للأقسام.
 */
function resetTableNames() {
    if (confirm('هل أنت متأكد من رغبتك في استعادة الأسماء الافتراضية لجميع الأقسام؟')) {
        localStorage.removeItem('departmentNames');
        renderTables();
        populateCentersSidebar();
        showEditTableNames();
        showSuccessMessage('تم استعادة الأسماء الافتراضية بنجاح.');
    }
}

/**
 * تحذف موظفًا من داخل لوحة الإدارة.
 */
function confirmDeleteEmployeeFromMgmt(deptKey, employeeIndex) {
    const employeeName = getAttendanceData()[deptKey][employeeIndex].name;
    if (confirm(`هل أنت متأكد من حذف الموظف "${employeeName}"؟ لا يمكن التراجع عن هذا الإجراء.`)) {
        const data = getAttendanceData();
        data[deptKey].splice(employeeIndex, 1);
        saveAttendanceData(data);
        showSuccessMessage("تم حذف الموظف بنجاح.");
        displayEmployeesForCenter(deptKey);
        renderTables();
    }
}

/**
 * تفتح نموذج إضافة موظف جديد في منطقة المحتوى.
 */
function showAddEmployeeFormForCenter() {
    const deptKey = window.activeCenterKey;
    if (!deptKey) { alert("الرجاء تحديد قسم أولاً من القائمة الجانبية."); return; }
    const contentArea = document.getElementById('management-content-area');
    const title = document.getElementById('content-title');
    const deptName = getDepartmentName(deptKey);
    title.innerHTML = `<i class="fas fa-user-plus"></i> إضافة موظف جديد إلى: ${deptName}`;
    contentArea.innerHTML = `
        <div class="form-group"><label>مسمى الوظيفة:</label><input type="text" id="add-emp-job" placeholder="مثال: فني كهرباء"></div>
        <div class="form-group"><label>اسم الموظف:</label><input type="text" id="add-emp-name" placeholder="الاسم الكامل"></div>
        <div class="form-group"><label>رقم الإقامة/الهوية:</label><input type="text" id="add-emp-iqama" placeholder="10 أرقام أو أكثر"></div>
        <div class="form-group"><label>التكلفة الشهرية:</label><input type="number" id="add-emp-salary" placeholder="مثال: 3000"></div>
        <div class="form-group"><label>الفئة:</label><select id="add-emp-category">${[1,2,3,4,5,6,7].map(n=>`<option value="${n}">${n}</option>`).join('')}</select></div>
        <div class="form-group"><label>الجنسية:</label><select id="add-emp-nationality">${['سعودي', 'مصري', 'هندي', 'باكستاني', 'فلبيني', 'بنغلاديشي', 'أخرى'].map(n=>`<option value="${n}">${n}</option>`).join('')}</select></div>
        <div class="buttons" style="justify-content: flex-start;"><button class="btn-success" onclick="addEmployeeFromManagement()"><i class="fas fa-check"></i> إضافة</button><button class="btn-secondary" onclick="displayEmployeesForCenter('${deptKey}')"><i class="fas fa-times"></i> إلغاء</button></div>`;
}

/**
 * تضيف الموظف الجديد من البيانات المدخلة في نموذج الإدارة.
 */
function addEmployeeFromManagement() {
    const deptKey = window.activeCenterKey;
    if (!deptKey) return;
    const newEmployee = {
        jobTitle: document.getElementById('add-emp-job').value.trim(),
        name: document.getElementById('add-emp-name').value.trim(),
        iqamaId: document.getElementById('add-emp-iqama').value.trim(),
        salary: parseFloat(document.getElementById('add-emp-salary').value) || 0,
        category: document.getElementById('add-emp-category').value,
        nationality: document.getElementById('add-emp-nationality').value,
        nationalityFine: 0,
        days: Array(getExtractPeriodDetails().daysInMonth).fill('ح')
    };
    if (!newEmployee.jobTitle || !newEmployee.name || !newEmployee.iqamaId) {
        alert("الرجاء ملء جميع الحقول: المسمى الوظيفي، الاسم، ورقم الإقامة.");
        return;
    }
    addEmployeesToDepartment(deptKey, [newEmployee]);
    renderTables();
    displayEmployeesForCenter(deptKey);
}

/**
 * تفتح نموذج تعديل بيانات موظف موجود.
 */
function openEditEmployeeForm(deptKey, index) {
    const data = getAttendanceData();
    const emp = data[deptKey][index];
    const contentArea = document.getElementById('management-content-area');
    contentArea.innerHTML = `
        <h4>تعديل بيانات: ${emp.name}</h4>
        <div class="form-group"><label>مسمى الوظيفة:</label><input type="text" id="edit-emp-job" value="${emp.jobTitle}"></div>
        <div class="form-group"><label>اسم الموظف:</label><input type="text" id="edit-emp-name" value="${emp.name}"></div>
        <div class="form-group"><label>رقم الإقامة/الهوية:</label><input type="text" id="edit-emp-iqama" value="${emp.iqamaId}"></div>
        <div class="form-group"><label>التكلفة الشهرية:</label><input type="number" id="edit-emp-salary" value="${emp.salary}"></div>
        <div class="form-group"><label>الفئة:</label><select id="edit-emp-category">${[1,2,3,4,5,6,7].map(n => `<option value="${n}" ${emp.category == n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <div class="form-group"><label>الجنسية:</label><select id="edit-emp-nationality">${['سعودي', 'مصري', 'هندي', 'باكستاني', 'فلبيني', 'بنغلاديشي', 'أخرى'].map(n => `<option value="${n}" ${emp.nationality == n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <div class="buttons" style="justify-content: flex-start;"><button class="btn-success" onclick="saveEmployeeChanges('${deptKey}', ${index})"><i class="fas fa-save"></i> حفظ التعديلات</button><button class="btn-secondary" onclick="displayEmployeesForCenter('${deptKey}')"><i class="fas fa-times"></i> إلغاء</button></div>`;
}

/**
 * تحفظ التعديلات التي تمت على بيانات الموظف.
 */
function saveEmployeeChanges(deptKey, index) {
    const data = getAttendanceData();
    const emp = data[deptKey][index];
    const newIqama = document.getElementById('edit-emp-iqama').value.trim();
    const newName  = document.getElementById('edit-emp-name').value.trim();

    // فحص التكرار — يستثني الموظف الحالي نفسه
    for (const dk in data) {
        const arr = data[dk] || [];
        for (let i = 0; i < arr.length; i++) {
            if (dk === deptKey && i === index) continue; // نفس الموظف
            if (newIqama && (arr[i].iqamaId || '').trim() === newIqama) {
                alert(`⚠️ رقم الإقامة (${newIqama}) مكرر — موجود عند الموظف "${arr[i].name}" في قسم "${getDepartmentName(dk)}".`);
                return;
            }
            if (newName && (arr[i].name || '').trim().toLowerCase() === newName.toLowerCase()) {
                alert(`⚠️ الاسم "${newName}" مكرر — موجود بالفعل في قسم "${getDepartmentName(dk)}".`);
                return;
            }
        }
    }

    emp.jobTitle = document.getElementById('edit-emp-job').value.trim();
    emp.name = newName;
    emp.iqamaId = newIqama;
    emp.salary = parseFloat(document.getElementById('edit-emp-salary').value) || 0;
    emp.category = document.getElementById('edit-emp-category').value;
    emp.nationality = document.getElementById('edit-emp-nationality').value;
    saveAttendanceData(data);
    showSuccessMessage("تم حفظ التعديلات بنجاح.");
    renderTables();
    displayEmployeesForCenter(deptKey);
}

/**
 * ===================================================================
 *      ===>   مركز التحكم في الأداء (النسخة العالمية والاحترافية)   <===
 * ===================================================================
 * @description نظام متكامل لفتح نافذة إعدادات الأداء، التحقق من كلمة المرور،
 *              عرض الخيارات بشكل ذكي، وحفظها بطريقة آمنة.
 */

// --- الخطوة 1: الدالة الرئيسية التي يستدعيها الزر ---
function openPerformanceControlCenter() {
    // بناء وعرض نافذة كلمة المرور الأنيقة
    let dialog = document.getElementById('performance-control-password-dialog');
    if (!dialog) {
        dialog = document.createElement('div');
        dialog.id = 'performance-control-password-dialog';
        dialog.className = 'dialog';
        document.body.appendChild(dialog);
    }

    dialog.innerHTML = `
        <div class="dialog-header" style="background: linear-gradient(135deg, #6f42c1, #9a67ea); color: white;">
            <h3><i class="fas fa-shield-alt"></i> الوصول إلى الإعدادات المتقدمة</h3>
            <span class="close" onclick="closeDialog('performance-control-password-dialog')">×</span>
        </div>
        <div class="dialog-body">
            <p class="info-text" style="font-size: 16px; color: #555; margin-bottom: 20px; text-align: center;">
                <i class="fas fa-exclamation-triangle" style="color: #ffc107;"></i>
                هذه الإعدادات تؤثر مباشرة على الحسابات في <strong>شهادة الأداء</strong>.
            </p>
            <div class="form-group">
                <label for="control-center-password">للمتابعة، يرجى إدخال كلمة المرور:</label>
                <input type="password" id="control-center-password" placeholder="••••••••" onkeypress="if(event.key==='Enter') verifyAndOpenControlCenter()">
            </div>
            <p id="control-center-error" style="display:none; color: #dc3545; text-align:center;"></p>
        </div>
        <div class="dialog-footer">
            <button class="btn-success" onclick="verifyAndOpenControlCenter()"><i class="fas fa-check-circle"></i> متابعة</button>
        </div>
    `;
    openDialog('performance-control-password-dialog');
}

// --- الخطوة 2: التحقق من كلمة المرور وفتح مركز التحكم ---
function verifyAndOpenControlCenter() {
    const input = document.getElementById('control-center-password').value;
    const errorMsg = document.getElementById('control-center-error');

    if (input === PASSWORD) {
        closeDialog('performance-control-password-dialog');
        showPerformanceControlCenter(); 
    } else {
        errorMsg.textContent = "كلمة المرور غير صحيحة.";
        errorMsg.style.display = 'block';
    }
}

// --- الخطوة 3: عرض نافذة الإعدادات الفعلية (مركز التحكم) ---
function showPerformanceControlCenter() {
    // دمج ذكي للقيم الافتراضية مع المحفوظة لضمان عدم حدوث أخطاء
    const defaultSettings = {
        hasProjectManager: false,
        activeDepartments: ['cleaning', 'electricity', 'agriculture', 'civil_works', 'mechanical', 'laundry', 'patient_services']
    };
    const savedSettings = JSON.parse(localStorage.getItem('distributionSettings')) || {};
    const settings = { ...defaultSettings, ...savedSettings };

    let dialog = document.getElementById('performance-control-center-dialog');
    if (!dialog) {
        dialog = document.createElement('div');
        dialog.id = 'performance-control-center-dialog';
        dialog.className = 'dialog wide-dialog';
        document.body.appendChild(dialog);
    }

    const allDepartments = {
        cleaning: 'النظافة',
        electricity: 'الكهرباء',
        agriculture: 'الزراعة',
        civil_works: 'الأعمال المدنية',
        mechanical: 'الميكانيكا',
        laundry: 'المغسلة',
        patient_services: 'الأمن والسلامة'
    };

    // بناء مربعات الاختيار مع التحقق من القائمة النشطة
    let departmentCheckboxes = Object.keys(allDepartments).map(key => {
        const isChecked = settings.activeDepartments.includes(key);
        return `
            <label class="checkbox-label">
                <input type="checkbox" class="dept-checkbox" value="${key}" ${isChecked ? 'checked' : ''}>
                <span>${allDepartments[key]}</span>
            </label>
        `;
    }).join('');

    dialog.innerHTML = `
        <div class="dialog-header">
            <h3><i class="fas fa-cogs"></i> مركز التحكم في الأداء</h3>
            <span class="close" onclick="closeDialog('performance-control-center-dialog')">×</span>
        </div>
        <div class="dialog-body">
            <div class="setting-box">
                <label class="setting-label">1. توزيع راتب مدير الموقع</label>
                <p class="setting-description">هل سيتم توزيع راتب أول موظف في جدول الكهرباء على باقي الأقسام؟</p>
                <div class="radio-group">
                    <label class="radio-label"><input type="radio" name="hasProjectManager" value="yes" ${settings.hasProjectManager ? 'checked' : ''}> نعم، قم بالتوزيع</label>
                    <label class="radio-label"><input type="radio" name="hasProjectManager" value="no" ${!settings.hasProjectManager ? 'checked' : ''}> لا، لا تقم بالتوزيع</label>
                </div>
            </div>
            <div class="setting-box">
                <label class="setting-label">2. تفعيل شهادات الأداء</label>
                <p class="setting-description">حدد الأقسام التي تريد أن تظهر لها شهادة أداء في صفحة الأداء.</p>
                <div class="checkbox-grid">${departmentCheckboxes}</div>
            </div>
        </div>
        <div class="dialog-footer">
            <button class="btn-success" onclick="savePerformanceSettings()"><i class="fas fa-save"></i> حفظ الإعدادات</button>
        </div>
    `;
    openDialog('performance-control-center-dialog');
}

// --- الخطوة 4: دالة الحفظ النهائية ---
function savePerformanceSettings() {
    const hasProjectManager = document.querySelector('input[name="hasProjectManager"]:checked').value === 'yes';
    
    const activeDepartments = [];
    document.querySelectorAll('.dept-checkbox:checked').forEach(checkbox => {
        activeDepartments.push(checkbox.value);
    });
    
    const settings = {
        hasProjectManager: hasProjectManager,
        activeDepartments: activeDepartments 
    };

    localStorage.setItem('distributionSettings', JSON.stringify(settings));
    
    showSuccessMessage('تم حفظ إعدادات الأداء بنجاح!');
    closeDialog('performance-control-center-dialog');
}
