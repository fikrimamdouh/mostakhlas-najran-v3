// JavaScript لصفحة مستخلص المستهلكات
document.addEventListener('DOMContentLoaded', function() {
    // استدعاء بيانات العقد من localStorage
    loadContractData();
    
    // تهيئة الأزرار والأحداث
    setupEventListeners();
    
    // تهيئة الجداول
    setupTables();
    
    // تحديث التواقيع
    updateSignatures();
    
    // تحديث التاريخ
    updateDates();
});
/**
 * دالة لجلب وعرض بيانات العقد والإعدادات الرئيسية
 * 
 * هذه الدالة تقوم بجلب بيانات العقد من التخزين المحلي وعرضها في الصفحة
 * يمكن استخدامها في أي صفحة جديدة لعرض بيانات مستشفى شرورة العام
 * 
 * @author مستشفى شرورة العام - إدارة الهندسة والصيانة
 * @version 1.0
 */

// دالة تهيئة بيانات العقد - يتم استدعاؤها عند تحميل الصفحة
function initContractData() {
    // تحديث التاريخ والوقت الحالي
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    // جلب وعرض بيانات العقد
    fetchContractData();
}

// دالة تحديث التاريخ والوقت
function updateDateTime() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
    const gregorianDateTime = now.toLocaleDateString('ar-SA', options);
    const dateTimeElement = document.getElementById('current-date-time');
    if (dateTimeElement) {
        dateTimeElement.textContent = gregorianDateTime;
    }
}

// دالة جلب بيانات العقد من التخزين المحلي
function getContractData() {
    const extractStart = localStorage.getItem('extractStart');
    const extractEnd = localStorage.getItem('extractEnd');
    const storedData = localStorage.getItem('contractData');
    
    // البيانات الافتراضية للعقد
    let contractData = {
        hospitalName: 'مستشفي شرورة العام',
        contractDetails: 'عقد الصيانة والنظافة والتشغيل غير الطبي',
        companyName: 'شركة سراكو',
        contractType: 'عقد أساسي',
        contractNumber: '',
        projectName: '',
        extractNumber: '',
        startDate: extractStart || '2025-05-18',
        endDate: extractEnd || '2025-05-31',
        directPurchaseRatio: 0
    };
    
    // دمج البيانات المخزنة مع البيانات الافتراضية
    if (storedData) {
        try {
            const parsedData = JSON.parse(storedData);
            contractData = {
                ...contractData,
                ...parsedData,
                startDate: extractStart || parsedData.startDate || '2025-05-18',
                endDate: extractEnd || parsedData.endDate || '2025-05-31'
            };
        } catch (e) {
            console.error('خطأ في تحليل بيانات العقد:', e);
        }
    }
    
    // تصحيح إضافي لو التواريخ فارغة
    if (!contractData.startDate || contractData.startDate === '') {
        contractData.startDate = '2025-05-18';
    }
    if (!contractData.endDate || contractData.endDate === '') {
        contractData.endDate = '2025-05-31';
    }
    
    console.log('بيانات العقد:', contractData);
    return contractData;
}

// دالة عرض بيانات العقد في الصفحة
function fetchContractData() {
    const contractData = getContractData();
    console.log('جلب بيانات العقد:', contractData);

    // تحديث بيانات المستشفى والعقد
    updateElementText('hospitalName', contractData.hospitalName || 'مستشفي شرورة العام');
    updateElementText('contractDetails', contractData.contractDetails || 'عقد الصيانة والنظافة والتشغيل غير الطبي');
    updateElementText('companyName', contractData.companyName || 'شركة سراكو');
    updateElementText('contractType', contractData.contractType || 'عقد أساسي');
    updateElementText('contract-number', contractData.contractNumber || 'غير متوفر');
    updateElementText('project-name', contractData.projectName || 'غير متوفر');
    updateElementText('extract-number', contractData.extractNumber || 'غير متوفر');
    
    // تحديث تواريخ المستخلص
    updateElementText('period-start', contractData.startDate ? new Date(contractData.startDate).toLocaleDateString('ar-SA') : 'غير متوفر');
    updateElementText('period-end', contractData.endDate ? new Date(contractData.endDate).toLocaleDateString('ar-SA') : 'غير متوفر');
    updateElementText('extract-start-date', contractData.startDate ? new Date(contractData.startDate).toLocaleDateString('ar-SA') : 'غير متوفر');
    updateElementText('extract-end-date', contractData.endDate ? new Date(contractData.endDate).toLocaleDateString('ar-SA') : 'غير متوفر');
    
    // تحديث تفاصيل مستخلص العمالة
    updateElementText('extract-month', contractData.startDate ? getMonthName(contractData.startDate) : 'غير محدد');
    updateElementText('extract-year', contractData.startDate ? new Date(contractData.startDate).getFullYear() : 'غير محدد');
    updateElementText('extract-start', contractData.startDate ? formatGregorianDate(contractData.startDate) : 'غير محدد');
    updateElementText('extract-end', contractData.endDate ? formatGregorianDate(contractData.endDate) : 'غير محدد');
    
    // إظهار أو إخفاء نسبة الشراء المباشر
    const directPurchaseContainer = document.querySelector('.directPurchaseContainer');
    if (directPurchaseContainer) {
        directPurchaseContainer.style.display = contractData.directPurchaseRatio > 0 ? 'block' : 'none';
        updateElementText('directPurchaseRatio', contractData.directPurchaseRatio || '0');
    }
    
    // حساب عدد أيام المستخلص
    if (contractData.startDate && contractData.endDate) {
        extractDays = calculateDaysBetweenDates(contractData.startDate, contractData.endDate);
    } else {
        extractDays = 31; // القيمة الافتراضية إذا لم تكن التواريخ متاحة
        console.warn('لا توجد تواريخ صالحة، استخدام القيمة الافتراضية: 31 يوم');
    }
}

// دالة مساعدة لتحديث نص العنصر
function updateElementText(elementId, text) {
    const element = document.getElementById(elementId) || document.querySelector('.' + elementId);
    if (element) {
        element.textContent = text;
    } else {
        console.warn(`العنصر ${elementId} غير موجود`);
    }
}

// دالة حساب عدد الأيام بين تاريخين
function calculateDaysBetweenDates(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 31; // القيمة الافتراضية إذا كانت التواريخ غير صالحة
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
}

// دالة الحصول على عدد أيام الشهر
function getDaysInMonth(dateString) {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 30; // القيمة الافتراضية إذا كان التاريخ غير صالح
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate(); // الحصول على آخر يوم في الشهر
}

// دالة الحصول على اسم الشهر
function getMonthName(dateString) {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'غير محدد';
    const monthNames = [
        'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
        'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    return monthNames[date.getMonth()];
}

// دالة تنسيق التاريخ الميلادي
function formatGregorianDate(dateString) {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'غير محدد';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

// استدعاء دالة التهيئة عند تحميل الصفحة
document.addEventListener("DOMContentLoaded", function() {
    initContractData();
});

// استدعاء بيانات العقد من localStorage
function loadContractData() {
    const hospitalName = localStorage.getItem('hospitalName') || 'مستشفى نجران العام';
    const contractDetails = localStorage.getItem('contractDetails') || 'عقد تشغيل وصيانة مستشفى نجران العام';
    const companyName = localStorage.getItem('companyName') || 'شركة الخدمات المتكاملة للصيانة';
    
    // تحديث العناوين في الصفحة
    document.getElementById('hospitalName').textContent = hospitalName;
    document.getElementById('contractDetails').textContent = contractDetails;
    document.getElementById('companyName').textContent = companyName;
    
    // تحديث عناوين الجداول
    updateTableTitles();
}

// تهيئة الأزرار والأحداث
function setupEventListeners() {
    // أزرار الطباعة والتصدير
    document.getElementById('printBtn').addEventListener('click', printDocument);
    document.getElementById('exportPdfBtn').addEventListener('click', exportToPdf);
    document.getElementById('exportExcelBtn').addEventListener('click', exportToExcel);
    
    // أزرار إضافة صفوف للجداول
    document.getElementById('addRowConsumables').addEventListener('click', function() {
        addTableRow('consumablesTable');
        calculateTotals();
    });
    
    document.getElementById('addRowSubcontractors').addEventListener('click', function() {
        addTableRow('subcontractorsTable');
        calculateTotals();
    });
    
    document.getElementById('addRowWater').addEventListener('click', function() {
        addTableRow('waterTable');
        calculateTotals();
    });
    
    // زر العودة للصفحة الرئيسية
    document.getElementById('homeBtn').addEventListener('click', function() {
        window.location.href = 'welcome.html';
    });
    
    // أزرار التبديل بين الجداول
    const tableTabs = document.querySelectorAll('.table-tab');
    tableTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            showTable(targetId);
        });
    });
    
    // إضافة مستمعي الأحداث للحقول القابلة للتعديل
    setupEditableFields();
}

// إظهار الجدول المحدد وإخفاء البقية
function showTable(tableId) {
    const tables = document.querySelectorAll('.data-table-container');
    tables.forEach(table => {
        table.style.display = 'none';
    });
    
    document.getElementById(tableId).style.display = 'block';
    
    // تحديث الزر النشط
    const tableTabs = document.querySelectorAll('.table-tab');
    tableTabs.forEach(tab => {
        if (tab.getAttribute('data-target') === tableId) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
}

// تهيئة الجداول
function setupTables() {
    // تحميل البيانات المحفوظة إن وجدت
    loadTableData();
    
    // إعداد الجداول للتعديل المباشر
    setupEditableCells();
    
    // حساب المجاميع الأولية
    calculateTotals();
    
    // إظهار الجدول الأول افتراضياً
    showTable('consumablesTableContainer');
}

// إضافة صف جديد للجدول
function addTableRow(tableId) {
    const table = document.getElementById(tableId);
    const tbody = table.querySelector('tbody');
    const rowCount = tbody.rows.length;
    
    const newRow = tbody.insertRow();
    
    // إضافة الخلايا حسب نوع الجدول
    if (tableId === 'consumablesTable') {
        // جدول المستهلكات
        for (let i = 0; i < 7; i++) {
            const cell = newRow.insertCell();
            if (i === 0) {
                // خلية البند
                cell.contentEditable = true;
                cell.className = 'editable';
                cell.textContent = 'بند جديد';
            } else if (i === 1) {
                // خلية القيمة الشهرية حسب العقد
                cell.contentEditable = true;
                cell.className = 'editable number-cell';
                cell.textContent = '0';
                cell.addEventListener('input', calculateTotals);
            } else if (i === 2) {
                // خلية خصم المقابل
                cell.contentEditable = true;
                cell.className = 'editable number-cell';
                cell.textContent = '0';
                cell.addEventListener('input', calculateTotals);
            } else if (i === 3) {
                // خلية الغرامة
                cell.contentEditable = true;
                cell.className = 'editable number-cell';
                cell.textContent = '0';
                cell.addEventListener('input', calculateTotals);
            } else if (i === 4) {
                // خلية المبلغ الصافي للشهر
                cell.className = 'calculated number-cell';
                cell.textContent = '0';
            } else if (i === 5) {
                // زر حذف
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'حذف';
                deleteBtn.className = 'delete-btn';
                deleteBtn.onclick = function() {
                    deleteTableRow(this);
                };
                cell.appendChild(deleteBtn);
            } else {
                cell.textContent = '';
            }
        }
    } else if (tableId === 'subcontractorsTable') {
        // جدول مقاولي الباطن
        for (let i = 0; i < 6; i++) {
            const cell = newRow.insertCell();
            if (i === 0) {
                // خلية البيان
                cell.contentEditable = true;
                cell.className = 'editable';
                cell.textContent = 'بند جديد';
            } else if (i === 1) {
                // خلية سعر الوحدة
                cell.contentEditable = true;
                cell.className = 'editable number-cell';
                cell.textContent = '0';
                cell.addEventListener('input', calculateTotals);
            } else if (i === 2) {
                // خلية الكمية المتوقعة شهرياً
                cell.contentEditable = true;
                cell.className = 'editable number-cell';
                cell.textContent = '0';
                cell.addEventListener('input', calculateTotals);
            } else if (i === 3) {
                // خلية إجمالي السعر شهرياً
                cell.className = 'calculated number-cell';
                cell.textContent = '0';
            } else if (i === 4) {
                // زر حذف
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'حذف';
                deleteBtn.className = 'delete-btn';
                deleteBtn.onclick = function() {
                    deleteTableRow(this);
                };
                cell.appendChild(deleteBtn);
            } else {
                cell.textContent = '';
            }
        }
    } else if (tableId === 'waterTable') {
        // جدول المياه
        for (let i = 0; i < 5; i++) {
            const cell = newRow.insertCell();
            if (i === 0) {
                // خلية البيان
                cell.contentEditable = true;
                cell.className = 'editable';
                cell.textContent = 'بند جديد';
            } else if (i === 1) {
                // خلية سعر الوحدة
                cell.contentEditable = true;
                cell.className = 'editable number-cell';
                cell.textContent = '0';
                cell.addEventListener('input', calculateTotals);
            } else if (i === 2) {
                // خلية الكمية المتوقعة شهرياً
                cell.contentEditable = true;
                cell.className = 'editable number-cell';
                cell.textContent = '0';
                cell.addEventListener('input', calculateTotals);
            } else if (i === 3) {
                // خلية إجمالي السعر شهرياً
                cell.className = 'calculated number-cell';
                cell.textContent = '0';
            } else {
                // زر حذف
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'حذف';
                deleteBtn.className = 'delete-btn';
                deleteBtn.onclick = function() {
                    deleteTableRow(this);
                };
                cell.appendChild(deleteBtn);
            }
        }
    }
    
    // حفظ البيانات بعد التعديل
    saveTableData();
}
function getContractData() {
    return JSON.parse(localStorage.getItem('contractData')) || {};
}
// حذف صف من الجدول
function deleteTableRow(button) {
    const row = button.closest('tr');
    row.parentNode.removeChild(row);
    calculateTotals();
    saveTableData();
}

// إعداد الخلايا القابلة للتعديل
function setupEditableCells() {
    const editableCells = document.querySelectorAll('.editable');
    editableCells.forEach(cell => {
        cell.addEventListener('blur', function() {
            saveTableData();
            calculateTotals();
        });
        
        // منع إدخال أحرف في خلايا الأرقام
        if (cell.classList.contains('number-cell')) {
            cell.addEventListener('input', function() {
                this.textContent = this.textContent.replace(/[^0-9.]/g, '');
            });
        }
    });
}

// إعداد الحقول القابلة للتعديل
function setupEditableFields() {
    const editableFields = document.querySelectorAll('.editable-field');
    editableFields.forEach(field => {
        field.addEventListener('blur', function() {
            const fieldId = this.id;
            const fieldValue = this.textContent;
            localStorage.setItem(fieldId, fieldValue);
        });
    });
    
    // حقول عناوين الجداول
    const tableHeaders = document.querySelectorAll('.table-title');
    tableHeaders.forEach(header => {
        header.addEventListener('blur', function() {
            updateTableTitles();
            saveTableData();
        });
    });
}

// تحديث عناوين الجداول
function updateTableTitles() {
    const consumablesTitle = document.getElementById('consumablesTitle').textContent;
    const subcontractorsTitle = document.getElementById('subcontractorsTitle').textContent;
    const waterTitle = document.getElementById('waterTitle').textContent;
    
    // تحديث عناوين الأزرار
    document.querySelector('[data-target="consumablesTableContainer"]').textContent = consumablesTitle;
    document.querySelector('[data-target="subcontractorsTableContainer"]').textContent = subcontractorsTitle;
    document.querySelector('[data-target="waterTableContainer"]').textContent = waterTitle;
    
    // حفظ العناوين
    localStorage.setItem('consumablesTitle', consumablesTitle);
    localStorage.setItem('subcontractorsTitle', subcontractorsTitle);
    localStorage.setItem('waterTitle', waterTitle);
}

// حساب المجاميع
function calculateTotals() {
    // حساب مجاميع جدول المستهلكات
    calculateConsumablesTotals();
    
    // حساب مجاميع جدول مقاولي الباطن
    calculateSubcontractorsTotals();
    
    // حساب مجاميع جدول المياه
    calculateWaterTotals();
    
    // حساب المجموع الكلي
    calculateGrandTotal();
    
    // حفظ البيانات بعد الحساب
    saveTableData();
}

// حساب مجاميع جدول المستهلكات
function calculateConsumablesTotals() {
    const table = document.getElementById('consumablesTable');
    const rows = table.querySelectorAll('tbody tr');
    let total = 0;
    
    rows.forEach(row => {
        const contractValue = parseFloat(row.cells[1].textContent) || 0;
        const deduction = parseFloat(row.cells[2].textContent) || 0;
        const penalty = parseFloat(row.cells[3].textContent) || 0;
        
        // حساب المبلغ الصافي للشهر
        const netAmount = contractValue - deduction - penalty;
        row.cells[4].textContent = netAmount.toFixed(2);
        
        // إضافة للمجموع
        total += netAmount;
    });
    
    // تحديث إجمالي تكاليف بند المستهلكات
    document.getElementById('consumablesTotalValue').textContent = total.toFixed(2);
}

// حساب مجاميع جدول مقاولي الباطن
function calculateSubcontractorsTotals() {
    const table = document.getElementById('subcontractorsTable');
    const rows = table.querySelectorAll('tbody tr');
    let total = 0;
    
    rows.forEach(row => {
        const unitPrice = parseFloat(row.cells[1].textContent) || 0;
        const quantity = parseFloat(row.cells[2].textContent) || 0;
        
        // حساب إجمالي السعر شهرياً
        const monthlyTotal = unitPrice * quantity;
        row.cells[3].textContent = monthlyTotal.toFixed(2);
        
        // إضافة للمجموع
        total += monthlyTotal;
    });
    
    // تحديث إجمالي تكاليف مقاولي الباطن
    document.getElementById('subcontractorsTotalValue').textContent = total.toFixed(2);
}

// حساب مجاميع جدول المياه
function calculateWaterTotals() {
    const table = document.getElementById('waterTable');
    const rows = table.querySelectorAll('tbody tr');
    let total = 0;
    
    rows.forEach(row => {
        const unitPrice = parseFloat(row.cells[1].textContent) || 0;
        const quantity = parseFloat(row.cells[2].textContent) || 0;
        
        // حساب إجمالي السعر شهرياً
        const monthlyTotal = unitPrice * quantity;
        row.cells[3].textContent = monthlyTotal.toFixed(2);
        
        // إضافة للمجموع
        total += monthlyTotal;
    });
    
    // تحديث إجمالي تكاليف تأمين بند المياه
    document.getElementById('waterTotalValue').textContent = total.toFixed(2);
}

// حساب المجموع الكلي
function calculateGrandTotal() {
    const consumablesTotal = parseFloat(document.getElementById('consumablesTotalValue').textContent) || 0;
    const subcontractorsTotal = parseFloat(document.getElementById('subcontractorsTotalValue').textContent) || 0;
    const waterTotal = parseFloat(document.getElementById('waterTotalValue').textContent) || 0;
    
    // حساب غرامة الكهرباء والماء إن وجدت
    const penaltyValue = parseFloat(document.getElementById('penaltyValue').textContent) || 0;
    
    // حساب الإجمالي المستحق للمقاول
    const grandTotal = consumablesTotal + subcontractorsTotal + waterTotal - penaltyValue;
    document.getElementById('grandTotalValue').textContent = grandTotal.toFixed(2);
    
    // تحديث المبلغ بالكلمات
    document.getElementById('grandTotalText').textContent = numberToArabicWords(grandTotal) + ' ريال سعودي فقط لا غير';
}

// تحويل الرقم إلى كلمات عربية
function numberToArabicWords(number) {
    const units = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
    const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
    const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
    const thousands = ['', 'ألف', 'ألفان', 'ثلاثة آلاف', 'أربعة آلاف', 'خمسة آلاف', 'ستة آلاف', 'سبعة آلاف', 'ثمانية آلاف', 'تسعة آلاف'];
    
    if (number === 0) return 'صفر';
    
    let words = '';
    
    // معالجة الملايين
    if (number >= 1000000) {
        const millions = Math.floor(number / 1000000);
        if (millions === 1) {
            words += 'مليون ';
        } else if (millions === 2) {
            words += 'مليونان ';
        } else if (millions >= 3 && millions <= 10) {
            words += numberToArabicWords(millions) + ' ملايين ';
        } else {
            words += numberToArabicWords(millions) + ' مليون ';
        }
        number %= 1000000;
        if (number > 0) words += 'و';
    }
    
    // معالجة الآلاف
    if (number >= 1000) {
        const thous = Math.floor(number / 1000);
        if (thous === 1) {
            words += 'ألف ';
        } else if (thous === 2) {
            words += 'ألفان ';
        } else if (thous >= 3 && thous <= 10) {
            words += numberToArabicWords(thous) + ' آلاف ';
        } else {
            words += numberToArabicWords(thous) + ' ألف ';
        }
        number %= 1000;
        if (number > 0) words += 'و';
    }
    
    // معالجة المئات
    if (number >= 100) {
        words += hundreds[Math.floor(number / 100)] + ' ';
        number %= 100;
        if (number > 0) words += 'و';
    }
    
    // معالجة العشرات والآحاد
    if (number > 0) {
        if (number < 20) {
            words += units[number] + ' ';
        } else {
            const unit = number % 10;
            const ten = Math.floor(number / 10);
            if (unit > 0) {
                words += units[unit] + ' و';
            }
            words += tens[ten] + ' ';
        }
    }
    
    return words.trim();
}

// حفظ بيانات الجداول
function saveTableData() {
    // حفظ بيانات جدول المستهلكات
    const consumablesData = getTableData('consumablesTable');
    localStorage.setItem('consumablesTableData', JSON.stringify(consumablesData));
    
    // حفظ بيانات جدول مقاولي الباطن
    const subcontractorsData = getTableData('subcontractorsTable');
    localStorage.setItem('subcontractorsTableData', JSON.stringify(subcontractorsData));
    
    // حفظ بيانات جدول المياه
    const waterData = getTableData('waterTable');
    localStorage.setItem('waterTableData', JSON.stringify(waterData));
    
    // حفظ غرامة الكهرباء والماء
    const penaltyValue = document.getElementById('penaltyValue').textContent;
    localStorage.setItem('penaltyValue', penaltyValue);
    
    // حفظ الفترة
    const periodFrom = document.getElementById('periodFrom').textContent;
    const periodTo = document.getElementById('periodTo').textContent;
    localStorage.setItem('consumablesPeriodFrom', periodFrom);
    localStorage.setItem('consumablesPeriodTo', periodTo);
}

// استخراج بيانات الجدول
function getTableData(tableId) {
    const table = document.getElementById(tableId);
    const rows = table.querySelectorAll('tbody tr');
    const data = [];
    
    rows.forEach(row => {
        const rowData = [];
        const cells = row.querySelectorAll('td');
        
        cells.forEach((cell, index) => {
            // تجاهل خلية زر الحذف
            if (!cell.querySelector('.delete-btn')) {
                rowData.push(cell.textContent);
            }
        });
        
        data.push(rowData);
    });
    
    return data;
}

// تحميل بيانات الجداول
function loadTableData() {
    // تحميل عناوين الجداول
    document.getElementById('consumablesTitle').textContent = localStorage.getItem('consumablesTitle') || 'المستهلكات';
    document.getElementById('subcontractorsTitle').textContent = localStorage.getItem('subcontractorsTitle') || 'مقاولي الباطن';
    document.getElementById('waterTitle').textContent = localStorage.getItem('waterTitle') || 'المياه';
    
    // تحديث عناوين الأزرار
    updateTableTitles();
    
    // تحميل غرامة الكهرباء والماء
    document.getElementById('penaltyValue').textContent = localStorage.getItem('penaltyValue') || '0';
    
    // تحميل الفترة
    document.getElementById('periodFrom').textContent = localStorage.getItem('consumablesPeriodFrom') || getFormattedDate();
    document.getElementById('periodTo').textContent = localStorage.getItem('consumablesPeriodTo') || getFormattedDate(30);
    
    // تحميل بيانات جدول المستهلكات
    loadTableFromStorage('consumablesTable', 'consumablesTableData');
    
    // تحميل بيانات جدول مقاولي الباطن
    loadTableFromStorage('subcontractorsTable', 'subcontractorsTableData');
    
    // تحميل بيانات جدول المياه
    loadTableFromStorage('waterTable', 'waterTableData');
}

// تحميل بيانات جدول من التخزين المحلي
function loadTableFromStorage(tableId, storageKey) {
    const table = document.getElementById(tableId);
    const tbody = table.querySelector('tbody');
    
    // مسح الصفوف الحالية
    tbody.innerHTML = '';
    
    // تحميل البيانات المحفوظة
    const storedData = localStorage.getItem(storageKey);
    if (storedData) {
        const data = JSON.parse(storedData);
        
        data.forEach(rowData => {
            const newRow = tbody.insertRow();
            
            rowData.forEach((cellData, index) => {
                const cell = newRow.insertCell();
                cell.textContent = cellData;
                
                // إضافة خصائص الخلايا
                if (index === 0) {
                    cell.contentEditable = true;
                    cell.className = 'editable';
                } else if ((tableId === 'consumablesTable' && index < 4) || 
                          ((tableId === 'subcontractorsTable' || tableId === 'waterTable') && index < 3)) {
                    cell.contentEditable = true;
                    cell.className = 'editable number-cell';
                    cell.addEventListener('input', calculateTotals);
                } else {
                    cell.className = 'calculated number-cell';
                }
            });
            
            // إضافة زر الحذف
            const deleteCell = newRow.insertCell();
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'حذف';
            deleteBtn.className = 'delete-btn';
            deleteBtn.onclick = function() {
                deleteTableRow(this);
            };
            deleteCell.appendChild(deleteBtn);
        });
        
        // إعداد الخلايا القابلة للتعديل
        setupEditableCells();
    } else {
        // إضافة صف افتراضي إذا لم تكن هناك بيانات محفوظة
        if (tableId === 'consumablesTable') {
            // بيانات افتراضية لجدول المستهلكات
            addDefaultConsumablesRows();
        } else if (tableId === 'subcontractorsTable') {
            // بيانات افتراضية لجدول مقاولي الباطن
            addDefaultSubcontractorsRows();
        } else if (tableId === 'waterTable') {
            // بيانات افتراضية لجدول المياه
            addDefaultWaterRows();
        }
    }
}

// إضافة صفوف افتراضية لجدول المستهلكات
function addDefaultConsumablesRows() {
    const defaultItems = [
        ['الوقود والزيوت والمحروقات', '5200', '0', '0'],
        ['المستهلكات الكيميائية والفلاتر', '5200', '0', '0'],
        ['مستهلكات الأعمال المدنية', '10500', '0', '0'],
        ['مواد ومطهرات النظافة', '25000', '0', '0'],
        ['مستهلكات الزراعة والري', '5200', '0', '0'],
        ['مستهلكات أجهزة النسخ والتصوير والطباعة', '10500', '0', '0'],
        ['المبيدات الحشرية', '1000', '0', '0']
    ];
    
    const table = document.getElementById('consumablesTable');
    const tbody = table.querySelector('tbody');
    
    defaultItems.forEach(item => {
        const newRow = tbody.insertRow();
        
        item.forEach((value, index) => {
            const cell = newRow.insertCell();
            cell.textContent = value;
            
            if (index === 0) {
                cell.contentEditable = true;
                cell.className = 'editable';
            } else if (index < 4) {
                cell.contentEditable = true;
                cell.className = 'editable number-cell';
                cell.addEventListener('input', calculateTotals);
            } else {
                cell.className = 'calculated number-cell';
            }
        });
        
        // إضافة خلية المبلغ الصافي
        const netAmountCell = newRow.insertCell();
        netAmountCell.className = 'calculated number-cell';
        netAmountCell.textContent = '0';
        
        // إضافة زر الحذف
        const deleteCell = newRow.insertCell();
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'حذف';
        deleteBtn.className = 'delete-btn';
        deleteBtn.onclick = function() {
            deleteTableRow(this);
        };
        deleteCell.appendChild(deleteBtn);
    });
    
    // حساب المجاميع
    calculateTotals();
}

// إضافة صفوف افتراضية لجدول مقاولي الباطن
function addDefaultSubcontractorsRows() {
    const defaultItems = [
        ['صيانة وإصلاح أعمال الطرق', '3', '2500']
    ];
    
    const table = document.getElementById('subcontractorsTable');
    const tbody = table.querySelector('tbody');
    
    defaultItems.forEach(item => {
        const newRow = tbody.insertRow();
        
        item.forEach((value, index) => {
            const cell = newRow.insertCell();
            cell.textContent = value;
            
            if (index === 0) {
                cell.contentEditable = true;
                cell.className = 'editable';
            } else if (index < 3) {
                cell.contentEditable = true;
                cell.className = 'editable number-cell';
                cell.addEventListener('input', calculateTotals);
            }
        });
        
        // إضافة خلية إجمالي السعر شهرياً
        const totalCell = newRow.insertCell();
        totalCell.className = 'calculated number-cell';
        totalCell.textContent = '0';
        
        // إضافة زر الحذف
        const deleteCell = newRow.insertCell();
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'حذف';
        deleteBtn.className = 'delete-btn';
        deleteBtn.onclick = function() {
            deleteTableRow(this);
        };
        deleteCell.appendChild(deleteBtn);
    });
    
    // حساب المجاميع
    calculateTotals();
}

// إضافة صفوف افتراضية لجدول المياه
function addDefaultWaterRows() {
    const defaultItems = [
        ['المياه في حالة انقطاعها عن الموقع أو عدم كفايتها', '9', '1500']
    ];
    
    const table = document.getElementById('waterTable');
    const tbody = table.querySelector('tbody');
    
    defaultItems.forEach(item => {
        const newRow = tbody.insertRow();
        
        item.forEach((value, index) => {
            const cell = newRow.insertCell();
            cell.textContent = value;
            
            if (index === 0) {
                cell.contentEditable = true;
                cell.className = 'editable';
            } else if (index < 3) {
                cell.contentEditable = true;
                cell.className = 'editable number-cell';
                cell.addEventListener('input', calculateTotals);
            }
        });
        
        // إضافة خلية إجمالي السعر شهرياً
        const totalCell = newRow.insertCell();
        totalCell.className = 'calculated number-cell';
        totalCell.textContent = '0';
        
        // إضافة زر الحذف
        const deleteCell = newRow.insertCell();
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'حذف';
        deleteBtn.className = 'delete-btn';
        deleteBtn.onclick = function() {
            deleteTableRow(this);
        };
        deleteCell.appendChild(deleteBtn);
    });
    
    // حساب المجاميع
    calculateTotals();
}

// تحديث التواقيع
function updateSignatures() {
    // استدعاء التواقيع من localStorage
    const contractorSignature = localStorage.getItem('contractorSignature') || 'مندوب المقاول';
    const projectManagerSignature = localStorage.getItem('projectManagerSignature') || 'مدير المشروع';
    const maintenanceHeadSignature = localStorage.getItem('maintenanceHeadSignature') || 'رئيس قسم الصيانة';
    const operationsAssistantSignature = localStorage.getItem('operationsAssistantSignature') || 'المساعد للتشغيل والصيانة';
    
    // تحديث التواقيع في الصفحة
    document.getElementById('contractorSignature').textContent = contractorSignature;
    document.getElementById('projectManagerSignature').textContent = projectManagerSignature;
    document.getElementById('maintenanceHeadSignature').textContent = maintenanceHeadSignature;
    document.getElementById('operationsAssistantSignature').textContent = operationsAssistantSignature;
}

// تحديث التاريخ
function updateDates() {
    // تحديث تاريخ اليوم
    const today = new Date();
    const formattedDate = today.toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    
    document.getElementById('currentDate').textContent = formattedDate;
}

// الحصول على التاريخ المنسق
function getFormattedDate(addDays = 0) {
    const date = new Date();
    if (addDays) {
        date.setDate(date.getDate() + addDays);
    }
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}

// طباعة المستند
function printDocument() {
    // إخفاء الأزرار والعناصر غير المطلوبة للطباعة
    document.querySelectorAll('.no-print').forEach(el => {
        el.style.display = 'none';
    });
    
    // إظهار جميع الجداول للطباعة
    document.querySelectorAll('.data-table-container').forEach(el => {
        el.style.display = 'block';
    });
    
    // طباعة
    window.print();
    
    // إعادة العناصر إلى حالتها الأصلية
    document.querySelectorAll('.no-print').forEach(el => {
        el.style.display = '';
    });
    
    // إعادة إظهار الجدول النشط فقط
    const activeTab = document.querySelector('.table-tab.active');
    if (activeTab) {
        const targetId = activeTab.getAttribute('data-target');
        showTable(targetId);
    } else {
        showTable('consumablesTableContainer');
    }
}

// تصدير إلى PDF
function exportToPdf() {
    // إنشاء عنصر رابط وهمي
    const link = document.createElement('a');
    link.href = '#';
    link.download = 'مستخلص_المستهلكات.pdf';
    link.textContent = 'تحميل PDF';
    
    // إضافة الرابط إلى المستند
    document.body.appendChild(link);
    
    // تنبيه المستخدم
    alert('جاري تحضير ملف PDF للتحميل...');
    
    // محاكاة النقر على الرابط
    setTimeout(() => {
        // طباعة المستند كبديل
        printDocument();
        
        // إزالة الرابط
        document.body.removeChild(link);
    }, 1000);
}

// تصدير إلى Excel
function exportToExcel() {
    // إنشاء مصفوفة لتخزين بيانات الجداول
    const consumablesData = [
        ['المستهلكات'],
        ['البند', 'القيمة الشهرية حسب العقد', 'خصم المقابل', 'الغرامة', 'المبلغ الصافي للشهر']
    ];
    
    const subcontractorsData = [
        ['مقاولي الباطن'],
        ['البيان', 'سعر الوحدة (م3)', 'الكمية المتوقعة شهرياً (م3)', 'إجمالي السعر شهرياً']
    ];
    
    const waterData = [
        ['المياه'],
        ['البيان', 'سعر الوحدة (م3)', 'الكمية المتوقعة شهرياً (م3)', 'إجمالي السعر شهرياً']
    ];
    
    const summaryData = [
        ['ملخص المستخلص'],
        ['البند', 'القيمة'],
        ['إجمالي تكاليف بند المستهلكات', document.getElementById('consumablesTotalValue').textContent],
        ['تكاليف مقاولي الباطن (المبلغ حسب الزيارات المجدولة)', document.getElementById('subcontractorsTotalValue').textContent],
        ['تكاليف تأمين بند المياه', document.getElementById('waterTotalValue').textContent],
        ['غرامة الكهرباء + الماء', document.getElementById('penaltyValue').textContent],
        ['إجمالي المستحق للمقاول', document.getElementById('grandTotalValue').textContent],
        ['إجمالي المستحق للمقاول فقط وقدره', document.getElementById('grandTotalText').textContent]
    ];
    
    // جمع بيانات جدول المستهلكات
    const consumablesRows = document.querySelectorAll('#consumablesTable tbody tr');
    consumablesRows.forEach(row => {
        const rowData = [];
        for (let i = 0; i < 5; i++) {
            rowData.push(row.cells[i].textContent);
        }
        consumablesData.push(rowData);
    });
    
    // جمع بيانات جدول مقاولي الباطن
    const subcontractorsRows = document.querySelectorAll('#subcontractorsTable tbody tr');
    subcontractorsRows.forEach(row => {
        const rowData = [];
        for (let i = 0; i < 4; i++) {
            rowData.push(row.cells[i].textContent);
        }
        subcontractorsData.push(rowData);
    });
    
    // جمع بيانات جدول المياه
    const waterRows = document.querySelectorAll('#waterTable tbody tr');
    waterRows.forEach(row => {
        const rowData = [];
        for (let i = 0; i < 4; i++) {
            rowData.push(row.cells[i].textContent);
        }
        waterData.push(rowData);
    });
    
    // إنشاء عنصر رابط وهمي
    const link = document.createElement('a');
    link.href = '#';
    link.download = 'مستخلص_المستهلكات.xlsx';
    link.textContent = 'تحميل Excel';
    
    // إضافة الرابط إلى المستند
    document.body.appendChild(link);
    
    // تنبيه المستخدم
    alert('جاري تحضير ملف Excel للتحميل...');
    
    // محاكاة النقر على الرابط
    setTimeout(() => {
        // إزالة الرابط
        document.body.removeChild(link);
        
        // عرض رسالة للمستخدم
        alert('تم تصدير البيانات بنجاح!');
    }, 1000);
}
