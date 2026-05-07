/* تحسينات لملف spare_parts.js */

// تحسين ظهور بيانات العقد في وضع الطباعة
function setupPrintStyles() {
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
    `;
    document.head.appendChild(printStyleSheet);
}
}

// تحسين تنسيق تصدير PDF
function exportToPdf() {
    // إخفاء الأزرار والعناصر غير المطلوبة للطباعة
    document.querySelectorAll('.no-print').forEach(el => {
        el.style.display = 'none';
    });
    
    // إظهار معلومات العقد بشكل واضح
    const contractInfo = document.querySelector('.contract-info');
    if (contractInfo) {
        contractInfo.style.display = 'block';
    }
    
    // تحسين عرض التواقيع
    document.querySelectorAll('.signature-box').forEach(box => {
        box.style.textAlign = 'center';
        box.style.width = '22%';
    });
    
    // استدعاء الطباعة
    window.print();
    
    // إعادة العناصر إلى حالتها الأصلية
    setTimeout(() => {
        document.querySelectorAll('.no-print').forEach(el => {
            el.style.display = '';
        });
        
        if (contractInfo) {
            contractInfo.style.display = '';
        }
    }, 1000);
}
    
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
        
        if (contractInfo) {
            contractInfo.style.display = '';
        }
    }, 1000);
}

// تحسين القيم الافتراضية للحقول
function updateDefaultValues() {
    // سحب بيانات العقد من localStorage
    const hospitalName = localStorage.getItem('hospitalName') || 'مستشفى نجران العام';
    const contractDetails = localStorage.getItem('contractDetails') || 'عقد تشغيل وصيانة مستشفى نجران العام';
    const companyName = localStorage.getItem('companyName') || 'شركة الخدمات المتكاملة للصيانة';
    const contractType = localStorage.getItem('contractType') || 'عقد أساسي';
    const directPurchaseRatio = localStorage.getItem('directPurchaseRatio') || '0';
    const extractFromDate = localStorage.getItem('extractFromDate') || 'غير محدد';
    const extractToDate = localStorage.getItem('extractToDate') || 'غير محدد';

    // تحديث العناصر في الصفحة (في side-data)
    document.getElementById('hospital-name').textContent = hospitalName;
    document.getElementById('contract-details').textContent = contractDetails;
    document.getElementById('company-name').textContent = companyName;
    document.getElementById('contract-type').textContent = contractType;

    // التحكم في إظهار نسبة الشراء المباشر
    const directPurchaseElement = document.getElementById('direct-purchase-ratio');
    if (contractType === 'شراء مباشر') {
        directPurchaseElement.style.display = 'block';
        document.getElementById('purchase-ratio').textContent = directPurchaseRatio;
    } else {
        directPurchaseElement.style.display = 'none';
    }

    // تحديث مدة المستخلص
    document.getElementById('extract-period').textContent = `من ${extractFromDate} إلى ${extractToDate}`;
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
    document.getElementById('contractorSignatureName').textContent = contractorSignature;
    document.getElementById('projectManagerSignatureName').textContent = projectManagerSignature;
    document.getElementById('maintenanceHeadSignatureName').textContent = maintenanceHeadSignature;
    document.getElementById('operationsAssistantSignatureName').textContent = operationsAssistantSignature;
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
    document.getElementById('pdfExportBtn').addEventListener('click', exportToPdf);
});
function updateDefaultValues() {
    // سحب القيم من settings_main.html (مثلاً عبر localStorage أو API)
    const hospitalName = localStorage.getItem('hospitalName') || '[من settings_main.html]';
    const contractDetails = localStorage.getItem('contractDetails') || '[من settings_main.html]';
    const companyName = localStorage.getItem('companyName') || '[من settings_main.html]';
    const contractType = localStorage.getItem('contractType') || 'عقد أساسي';
    const directPurchaseRatio = localStorage.getItem('directPurchaseRatio') || '0';
    const extractFromDate = localStorage.getItem('extractFromDate') || '[من settings_main.html]';
    const extractToDate = localStorage.getItem('extractToDate') || '[من settings_main.html]';

    // تحديث div.side-data
    document.querySelector('.side-data .hospitalName').textContent = hospitalName;
    document.querySelector('.side-data .contractDetails').textContent = contractDetails;
    document.querySelector('.side-data .companyName').textContent = companyName;
    document.querySelector('.side-data .contractType').textContent = contractType;
    if (contractType === 'شراء مباشر') {
        document.querySelector('.side-data .directPurchaseRatio').textContent = directPurchaseRatio + '%';
    }
    document.querySelector('.side-data .extractPeriod').textContent = `من ${extractFromDate} إلى ${extractToDate}`;
}

function updateSignatures() {
    // سحب التواقيع من settings_main.html
    const projectManagerSignature = localStorage.getItem('projectManagerSignature') || '[من settings_main.html]';
    const maintenanceHeadSignature = localStorage.getItem('maintenanceHeadSignature') || '[من settings_main.html]';
    const operationsAssistantSignature = localStorage.getItem('operationsAssistantSignature') || '[من settings_main.html]';
    const contractorSignature = localStorage.getItem('contractorSignature') || '[منفصل أو من settings_main.html]';

    // تحديث التواقيع
    document.getElementById('projectManagerSignatureName').textContent = projectManagerSignature;
    document.getElementById('maintenanceHeadSignatureName').textContent = maintenanceHeadSignature;
    document.getElementById('operationsAssistantSignatureName').textContent = operationsAssistantSignature;
    document.getElementById('contractorSignatureName').textContent = contractorSignature;

    // تحديث تواقيع الجدول (المسؤول والمستلم)
    // لو عايز ربط معين، هيتم هنا
}