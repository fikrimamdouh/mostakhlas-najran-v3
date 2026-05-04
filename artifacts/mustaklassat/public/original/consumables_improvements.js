/* تحسينات لملف consumables.js */

// تحسين ظهور بيانات العقد في وضع الطباعة
function setupPrintStyles() {
    // إنشاء ورقة أنماط خاصة بالطباعة
    const printStyleSheet = document.createElement('style');
    printStyleSheet.setAttribute('media', 'print');
    printStyleSheet.textContent = `
        @page {
            size: landscape;
            margin: 1cm;
        }
        body {
            font-family: 'Tajawal', sans-serif;
            background-color: white !important;
            color: black !important;
        }
        .header-container {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        .logo {
            width: 80px;
            height: auto;
        }
        .contract-info {
            display: block !important;
            margin-bottom: 20px;
            border: 1px solid #ddd;
            padding: 10px;
            background-color: #f9f9f9;
        }
        .contract-info p {
            margin: 5px 0;
            font-size: 12px;
        }
        .table-container {
            page-break-inside: avoid;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        table, th, td {
            border: 1px solid #000;
        }
        th, td {
            padding: 8px;
            text-align: center;
        }
        th {
            background-color: #f2f2f2;
        }
        .signatures {
            display: flex;
            justify-content: space-between;
            margin-top: 30px;
            page-break-inside: avoid;
        }
        .signature-box {
            text-align: center;
            width: 22%;
        }
        .signature-line {
            border-top: 1px solid #000;
            margin-top: 40px;
            margin-bottom: 5px;
        }
        .no-print {
            display: none !important;
        }
        .table-tabs {
            display: none !important;
        }
        .data-table-container {
            display: block !important;
            margin-bottom: 30px;
        }
    `;
    document.head.appendChild(printStyleSheet);
}

// تحسين تنسيق تصدير PDF
function exportToPdf() {
    // إخفاء الأزرار والعناصر غير المطلوبة للطباعة
    document.querySelectorAll('.no-print').forEach(el => {
        el.style.display = 'none';
    });
    
    // إظهار جميع الجداول للطباعة
    document.querySelectorAll('.data-table-container').forEach(el => {
        el.style.display = 'block';
    });
    
    // إظهار معلومات العقد بشكل واضح
    const contractInfo = document.querySelector('.contract-info');
    if (contractInfo) {
        contractInfo.style.display = 'block';
    }
    
    // تحسين عرض الجداول
    document.querySelectorAll('table').forEach(table => {
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.marginBottom = '20px';
        
        const rows = table.querySelectorAll('tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('th, td');
            cells.forEach(cell => {
                cell.style.border = '1px solid #000';
                cell.style.padding = '8px';
                cell.style.textAlign = 'center';
            });
        });
    });
    
    // تحسين عرض التواقيع
    document.querySelectorAll('.signature-box').forEach(box => {
        box.style.textAlign = 'center';
        box.style.width = '22%';
    });
    
    // استخدام window.print() كبديل لتصدير PDF
    window.print();
    
    // إعادة العناصر إلى حالتها الأصلية
    setTimeout(() => {
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
        
        if (contractInfo) {
            contractInfo.style.display = '';
        }
    }, 1000);
}

// تحسين القيم الافتراضية للحقول
function updateDefaultValues() {
    // تحديث بيانات العقد من localStorage
    const hospitalName = localStorage.getItem('hospitalName') || 'مستشفى نجران العام';
    const contractDetails = localStorage.getItem('contractDetails') || 'عقد تشغيل وصيانة مستشفى نجران العام';
    const companyName = localStorage.getItem('companyName') || 'شركة الخدمات المتكاملة للصيانة';
    const contractStartDate = localStorage.getItem('contractStartDate') || '2024-01-01';
    const contractEndDate = localStorage.getItem('contractEndDate') || '2024-12-31';
    
    // تحديث العناصر في الصفحة
    document.getElementById('hospitalName').textContent = hospitalName;
    document.getElementById('contractDetails').textContent = contractDetails;
    document.getElementById('companyName').textContent = companyName;
    
    // تحديث رقم العقد ورقم المستخلص
    const contractNumber = localStorage.getItem('contractNumber') || '001';
    const extractNumber = localStorage.getItem('extractNumber') || '001';
    
    if (document.getElementById('contractNumber')) {
        document.getElementById('contractNumber').textContent = contractNumber;
    }
    
    if (document.getElementById('extractNumber')) {
        document.getElementById('extractNumber').textContent = extractNumber;
    }
    
    // تحديث تواريخ المستخلص
    const today = new Date();
    const fromDate = localStorage.getItem('extractFromDate') || formatDate(today);
    
    // تاريخ نهاية المستخلص (افتراضياً نهاية الشهر الحالي)
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const toDate = localStorage.getItem('extractToDate') || formatDate(endOfMonth);
    
    if (document.getElementById('periodFrom')) {
        document.getElementById('periodFrom').textContent = fromDate;
    }
    
    if (document.getElementById('periodTo')) {
        document.getElementById('periodTo').textContent = toDate;
    }
    
    // تحديث عناوين الجداول
    if (document.getElementById('consumablesTitle')) {
        document.getElementById('consumablesTitle').textContent = localStorage.getItem('consumablesTitle') || 'المستهلكات';
    }
    
    if (document.getElementById('subcontractorsTitle')) {
        document.getElementById('subcontractorsTitle').textContent = localStorage.getItem('subcontractorsTitle') || 'مقاولي الباطن';
    }
    
    if (document.getElementById('waterTitle')) {
        document.getElementById('waterTitle').textContent = localStorage.getItem('waterTitle') || 'المياه';
    }
    
    // تحديث عناوين الأزرار
    updateTableTitles();
}

// تنسيق التاريخ بصيغة YYYY-MM-DD
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// تحسين عرض التواقيع
function updateSignatures() {
    // استدعاء التواقيع من localStorage
    const contractorSignature = localStorage.getItem('contractorSignature') || 'مندوب المقاول';
    const projectManagerSignature = localStorage.getItem('projectManagerSignature') || 'مدير المشروع';
    const maintenanceHeadSignature = localStorage.getItem('maintenanceHeadSignature') || 'رئيس قسم الصيانة';
    const operationsAssistantSignature = localStorage.getItem('operationsAssistantSignature') || 'المساعد للتشغيل والصيانة';
    
    // تحديث التواقيع في الصفحة
    if (document.getElementById('contractorSignature')) {
        document.getElementById('contractorSignature').textContent = contractorSignature;
    }
    
    if (document.getElementById('projectManagerSignature')) {
        document.getElementById('projectManagerSignature').textContent = projectManagerSignature;
    }
    
    if (document.getElementById('maintenanceHeadSignature')) {
        document.getElementById('maintenanceHeadSignature').textContent = maintenanceHeadSignature;
    }
    
    if (document.getElementById('operationsAssistantSignature')) {
        document.getElementById('operationsAssistantSignature').textContent = operationsAssistantSignature;
    }
}

// تحديث الصفحة عند التحميل
document.addEventListener('DOMContentLoaded', function() {
    // تهيئة أنماط الطباعة
    setupPrintStyles();
    
    // تحديث القيم الافتراضية
    updateDefaultValues();
    
    // تحديث التواقيع
    updateSignatures();
    
    // إضافة مستمعي الأحداث للأزرار
    if (document.getElementById('exportPdfBtn')) {
        document.getElementById('exportPdfBtn').addEventListener('click', exportToPdf);
    }
});
