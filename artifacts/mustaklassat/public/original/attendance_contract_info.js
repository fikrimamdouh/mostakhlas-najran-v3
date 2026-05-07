// ملف JavaScript لتحديث بيانات العقد في مكون عرض البيانات

// تحديث بيانات العقد من localStorage
function updateContractDisplayData() {
    // استدعاء دالة تحميل البيانات من contract_data_connector.js إذا كانت متاحة
    let contractData = {};
    let extractData = {};
    
    try {
        // محاولة استخدام دالة loadFromLocalStorage من contract_data_connector.js
        if (typeof loadFromLocalStorage === 'function') {
            contractData = loadFromLocalStorage('persistentContractData') || {};
            extractData = loadFromLocalStorage('persistentExtractData') || {};
        }
    } catch (error) {
        console.warn('لم يتم العثور على دالة loadFromLocalStorage، سيتم استخدام localStorage مباشرة');
    }

    // الحصول على البيانات من localStorage أو من الدالة المستدعاة
    const hospitalName = contractData.hospitalName || localStorage.getItem('hospitalName') || 'غير محدد';
    const contractDetails = contractData.contractDetails || localStorage.getItem('contractDetails') || 'غير محدد';
    const companyName = contractData.companyName || localStorage.getItem('companyName') || 'غير محدد';
    const contractType = contractData.contractType || localStorage.getItem('contractType') || 'غير محدد';
    const directPurchaseRatio = contractData.directPurchaseRatio || localStorage.getItem('directPurchaseRatio') || '0';
    
    // بيانات المستخلص
    const extractStart = extractData.extractStart || localStorage.getItem('extractStart') || 'غير محدد';
    const extractEnd = extractData.extractEnd || localStorage.getItem('extractEnd') || 'غير محدد';
    const extractMonth = extractData.extractMonth || localStorage.getItem('extractMonth') || 'غير محدد';
    const extractYear = extractData.extractYear || localStorage.getItem('extractYear') || 'غير محدد';
    
    // تحديث العناصر في الصفحة
    const hospitalNameElements = document.getElementsByClassName('hospitalName');
    const contractDetailsElements = document.getElementsByClassName('contractDetails');
    const companyNameElements = document.getElementsByClassName('companyName');
    const contractTypeElements = document.getElementsByClassName('contractType');
    const directPurchaseRatioElements = document.getElementsByClassName('directPurchaseRatio');
    const directPurchaseContainers = document.getElementsByClassName('directPurchaseContainer');
    
    // تحديث اسم المستشفى
    for (let i = 0; i < hospitalNameElements.length; i++) {
        hospitalNameElements[i].textContent = hospitalName;
    }
    
    // تحديث تفاصيل العقد
    for (let i = 0; i < contractDetailsElements.length; i++) {
        contractDetailsElements[i].textContent = contractDetails;
    }
    
    // تحديث اسم الشركة
    for (let i = 0; i < companyNameElements.length; i++) {
        companyNameElements[i].textContent = companyName;
    }
    
    // تحديث نوع العقد
    for (let i = 0; i < contractTypeElements.length; i++) {
        contractTypeElements[i].textContent = contractType;
    }
    
    // تحديث نسبة الشراء المباشر وإظهارها فقط إذا كان نوع العقد "شراء مباشر"
    for (let i = 0; i < directPurchaseRatioElements.length; i++) {
        directPurchaseRatioElements[i].textContent = directPurchaseRatio;
    }
    
    // إظهار أو إخفاء حقل نسبة الشراء المباشر حسب نوع العقد
    for (let i = 0; i < directPurchaseContainers.length; i++) {
        if (contractType === 'شراء مباشر') {
            directPurchaseContainers[i].style.display = 'block';
        } else {
            directPurchaseContainers[i].style.display = 'none';
        }
    }
    
    // تحديث بيانات المستخلص
    const extractStartDateElements = document.querySelectorAll('#extract-start-date, #extract-start');
    const extractEndDateElements = document.querySelectorAll('#extract-end-date, #extract-end');
    const extractMonthElements = document.querySelectorAll('#extract-month');
    const extractYearElements = document.querySelectorAll('#extract-year');
    
    // تحديث تاريخ بداية المستخلص
    extractStartDateElements.forEach(element => {
        if (element) element.textContent = formatDate(extractStart);
    });
    
    // تحديث تاريخ نهاية المستخلص
    extractEndDateElements.forEach(element => {
        if (element) element.textContent = formatDate(extractEnd);
    });
    
    // تحديث شهر المستخلص
    extractMonthElements.forEach(element => {
        if (element) element.textContent = extractMonth || getMonthName(extractStart);
    });
    
    // تحديث سنة المستخلص
    extractYearElements.forEach(element => {
        if (element) element.textContent = extractYear || getYearFromDate(extractStart);
    });
}

// دالة مساعدة لتنسيق التاريخ
function formatDate(dateString) {
    if (!dateString || dateString === 'غير محدد') return 'غير محدد';
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        
        return `${day}/${month}/${year}`;
    } catch (error) {
        console.error('خطأ في تنسيق التاريخ:', error);
        return dateString;
    }
}

// دالة مساعدة للحصول على اسم الشهر من التاريخ
function getMonthName(dateString) {
    if (!dateString || dateString === 'غير محدد') return 'غير محدد';
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'غير محدد';
        
        const monthNames = [
            'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
            'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
        ];
        
        return monthNames[date.getMonth()];
    } catch (error) {
        console.error('خطأ في استخراج اسم الشهر:', error);
        return 'غير محدد';
    }
}

// دالة مساعدة للحصول على السنة من التاريخ
function getYearFromDate(dateString) {
    if (!dateString || dateString === 'غير محدد') return 'غير محدد';
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'غير محدد';
        
        return date.getFullYear().toString();
    } catch (error) {
        console.error('خطأ في استخراج السنة:', error);
        return 'غير محدد';
    }
}

// تنفيذ الدالة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', updateContractDisplayData);
