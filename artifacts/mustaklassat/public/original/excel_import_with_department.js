// تطوير خاصية استيراد إكسل للعمالة مع اختيار القسم

// تعديل دالة استيراد الإكسل لتضمين اختيار القسم
function importExcelWithDepartment() {
    const fileInput = document.getElementById('excel-file-input');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('الرجاء اختيار ملف إكسل أولاً');
        return;
    }
    
    // إظهار مربع حوار اختيار القسم
    openDialog('select-department-dialog');
}

// دالة معالجة ملف الإكسل بعد اختيار القسم
function processExcelFile(departmentId) {
    const fileInput = document.getElementById('excel-file-input');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('الرجاء اختيار ملف إكسل أولاً');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // افتراض أن البيانات موجودة في الورقة الأولى
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // تحويل البيانات إلى مصفوفة من الكائنات
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            // البحث عن الأعمدة المطلوبة (مسمى الوظيفة، الفئة، اسم شاغل الوظيفة، التكلفة الشهرية)
            let jobTitleIndex = -1;
            let categoryIndex = -1;
            let employeeNameIndex = -1;
            let monthlyCostIndex = -1;
            
            // البحث في الصف الأول (العناوين) عن الأعمدة المطلوبة
            if (jsonData.length > 0) {
                const headers = jsonData[0];
                for (let i = 0; i < headers.length; i++) {
                    const header = headers[i]?.toString().trim().replace(/\s+/g, ' ').toLowerCase();
                    if (header.includes('مسمى الوظيفة') || header.includes('المسمى الوظيفي')) {
                        jobTitleIndex = i;
                    } else if (header.includes('الفئة')) {
                        categoryIndex = i;
                    } else if (header.includes('اسم شاغل الوظيفة') || header.includes('اسم الموظف')) {
                        employeeNameIndex = i;
                    } else if (header.includes('التكلفة الشهرية') || header.includes('الراتب')) {
                        monthlyCostIndex = i;
                    }
                }
            }
            
            // التحقق من وجود الأعمدة المطلوبة
            if (jobTitleIndex === -1 || categoryIndex === -1 || employeeNameIndex === -1 || monthlyCostIndex === -1) {
                alert('لم يتم العثور على جميع الأعمدة المطلوبة في ملف الإكسل. الأعمدة المطلوبة هي: مسمى الوظيفة، الفئة، اسم شاغل الوظيفة، التكلفة الشهرية');
                return;
            }
            
            // تحويل البيانات إلى التنسيق المطلوب
            const employees = [];
            for (let i = 1; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (row && row.length > 0) {
                    const jobTitle = row[jobTitleIndex]?.toString() || '';
                    const category = row[categoryIndex]?.toString() || '1';
                    const name = row[employeeNameIndex]?.toString() || '';
                    const salary = parseFloat(row[monthlyCostIndex]) || 0;
                    
                    // تجاهل الصفوف الفارغة
                    if (jobTitle || name) {
                        employees.push({
                            jobTitle,
                            category,
                            name,
                            salary,
                            days: Array(31).fill('ح'), // افتراضياً جميع الأيام حضور
                            nationality: 'سعودي', // افتراضي
                            nationalityFine: 0 // افتراضي
                        });
                    }
                }
            }
            
            // إضافة الموظفين إلى القسم المحدد
            if (employees.length > 0) {
                addEmployeesToDepartment(departmentId, employees);
                alert(`تم استيراد ${employees.length} موظف بنجاح إلى قسم ${getDepartmentName(departmentId)}`);
                closeDialog('select-department-dialog');
                closeDialog('upload-excel-dialog');
                
                // تحديث عرض الجداول
                fetchAttendanceData();
            } else {
                alert('لم يتم العثور على بيانات صالحة في ملف الإكسل');
            }
        } catch (error) {
            console.error('خطأ في معالجة ملف الإكسل:', error);
            alert('حدث خطأ أثناء معالجة ملف الإكسل. الرجاء التأكد من صحة الملف وتنسيقه.');
        }
    };
    
    reader.onerror = function() {
        alert('حدث خطأ أثناء قراءة الملف');
    };
    
    reader.readAsArrayBuffer(file);
}

// دالة إضافة الموظفين إلى القسم المحدد
function addEmployeesToDepartment(departmentId, employees) {
    // الحصول على بيانات الحضور الحالية
    const attendanceData = getAttendanceData();
    
    // تحويل معرف القسم إلى المفتاح المناسب في كائن البيانات
    const deptKey = departmentId.replace('-', '_');
    
    // إضافة الموظفين الجدد إلى القسم المحدد
    if (!attendanceData[deptKey]) {
        attendanceData[deptKey] = [];
    }
    
    // إضافة الموظفين الجدد إلى نهاية المصفوفة
    attendanceData[deptKey] = [...attendanceData[deptKey], ...employees];
    
    // حفظ البيانات المحدثة
    saveAttendanceData(attendanceData);
}

// دالة مساعدة للحصول على اسم القسم من معرفه
function getDepartmentName(departmentId) {
    const departmentNames = {
        'cleaning': 'النظافة',
        'electricity': 'الكهرباء',
        'agriculture': 'الزراعة',
        'civil-works': 'الأعمال المدنية',
        'mechanical': 'الميكانيكا',
        'laundry': 'المغسلة',
        'patient-services': 'خدمات المرضى'
    };
    
    return departmentNames[departmentId] || departmentId;
}

// إضافة مربع حوار اختيار القسم إلى HTML
document.addEventListener('DOMContentLoaded', function() {
    // التحقق من وجود مربع الحوار
    if (!document.getElementById('select-department-dialog')) {
        // إنشاء مربع حوار اختيار القسم
        const dialogHTML = `
        <div id="select-department-dialog" class="dialog" style="display: none;">
            <h2>اختيار القسم</h2>
            <p>الرجاء اختيار القسم الذي تريد استيراد بيانات العمالة إليه:</p>
            <div class="department-selection">
                <button onclick="processExcelFile('cleaning')">النظافة</button>
                <button onclick="processExcelFile('electricity')">الكهرباء</button>
                <button onclick="processExcelFile('agriculture')">الزراعة</button>
                <button onclick="processExcelFile('civil-works')">الأعمال المدنية</button>
                <button onclick="processExcelFile('mechanical')">الميكانيكا</button>
                <button onclick="processExcelFile('laundry')">المغسلة</button>
                <button onclick="processExcelFile('patient-services')">خدمات المرضى</button>
            </div>
            <div class="buttons">
                <button onclick="closeDialog('select-department-dialog')">إلغاء</button>
            </div>
        </div>
        `;
        
        // إضافة مربع الحوار إلى نهاية الصفحة
        document.body.insertAdjacentHTML('beforeend', dialogHTML);
    }
    
    // تعديل مربع حوار استيراد الإكسل
    const uploadExcelDialog = document.getElementById('upload-excel-dialog');
    if (uploadExcelDialog) {
        // تحديث محتوى مربع الحوار
        uploadExcelDialog.innerHTML = `
            <h2>استيراد من Excel</h2>
            <p>الرجاء اختيار ملف Excel يحتوي على بيانات العمالة:</p>
            <input type="file" id="excel-file-input" accept=".xlsx, .xls">
            <div class="buttons">
                <button onclick="importExcelWithDepartment()">استيراد</button>
                <button onclick="closeDialog('upload-excel-dialog')">إلغاء</button>
            </div>
        `;
    }
});

// تنسيق CSS إضافي لمربع حوار اختيار القسم
document.addEventListener('DOMContentLoaded', function() {
    // إضافة تنسيق CSS لمربع حوار اختيار القسم
    const style = document.createElement('style');
    style.textContent = `
        .department-selection {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin: 15px 0;
            justify-content: center;
        }
        
        .department-selection button {
            padding: 10px 15px;
            background-color: #2a5298;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            transition: background-color 0.3s;
            font-family: 'Tajawal', sans-serif;
            font-size: 14px;
        }
        
        .department-selection button:hover {
            background-color: #1e3c72;
        }
    `;
    
    document.head.appendChild(style);
});
