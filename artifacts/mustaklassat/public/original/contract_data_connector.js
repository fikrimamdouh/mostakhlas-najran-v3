/**
 * contract_data_connector.js
 * ملف جافاسكريبت موحد لربط بيانات العقد بين صفحة الإعدادات وباقي الصفحات
 */
function initializeContractDisplay(config = {}) {
    const { containerSelector = '.side-data', fields = [
        'hospitalName', 'contractDetails', 'companyName', 'contractType', 
        'directPurchaseRatio', 'extractPeriod'
    ] } = config;
    const container = document.querySelector(containerSelector);
    if (!container) return;
    createContractDisplayElements(container, fields);
    updateContractDisplayData(fields);
}
function createContractDisplayElements(container, fields) {
    if (container.querySelector('.contract-data')) return;
    const contractData = document.createElement('div');
    contractData.className = 'contract-data';
    contractData.id = 'contract-info-display';
    container.appendChild(contractData);
}
function updateContractDisplayData(fields = [
    'hospitalName', 'contractDetails', 'companyName', 'contractType', 
    'directPurchaseRatio', 'extractPeriod'
]) {
    const data = loadFromLocalStorage('persistentContractData') || {};
    const extractData = loadFromLocalStorage('persistentExtractData') || {};
    const defaults = {
        hospitalName: 'غير محدد',
        contractDetails: 'غير محدد',
        companyName: 'غير محدد',
        contractType: 'عقد أساسي',
        directPurchaseRatio: '0',
        extractStart: 'غير محدد',
        extractEnd: 'غير محدد',
        extractMonth: '',
        extractDuration: ''
    };
    const mergedData = { ...defaults, ...data, ...extractData };
    const container = document.querySelector('.side-data .contract-data');
    if (!container) return;
    const fieldLabels = {
        hospitalName: 'اسم المستشفى',
        contractDetails: 'تفاصيل العقد',
        companyName: 'اسم الشركة',
        contractType: 'نوع العقد',
        directPurchaseRatio: 'نسبة الشراء المباشر',
        extractPeriod: 'مدة المستخلص'
    };
    container.innerHTML = fields.map(field => {
        if (field === 'directPurchaseRatio' && mergedData.contractType !== 'شراء مباشر') return '';
        if (field === 'extractPeriod') {
            const period = mergedData.extractMonth && mergedData.extractDuration === 'شهر واحد' 
                ? `${mergedData.extractMonth} ` : '';
            return `<p>${fieldLabels[field]}: ${period}<span class="period">من ${mergedData.extractStart} إلى ${mergedData.extractEnd}</span></p>`;
        }
        return `<p>${fieldLabels[field]}: ${field === 'directPurchaseRatio' ? mergedData[field] + '%' : mergedData[field]}</p>`;
    }).join('');
function updateSignaturesIfPresent(signatures) {
    const signatureFields = [
        { selector: '.projectManagerSignatureName', value: signatures.projectManager || 'غير محدد' },
        { selector: '.maintenanceHeadSignatureName', value: signatures.maintenanceHead || 'غير محدد' },
        { selector: '.operationsAssistantSignatureName', value: signatures.operationsAssistant || 'غير محدد' },
        { selector: '.contractorRepresentativeSignatureName', value: signatures.contractorRepresentative || 'غير محدد' },
        { selector: '.hospitalAccountantSignatureName', value: signatures.hospitalAccountant || 'غير محدد' },
        { selector: '.hospitalAdminOperationsAssistantSignatureName', value: signatures.hospitalAdminOperationsAssistant || 'غير محدد' },
        { selector: '.siteRepresentativeSignatureName', value: signatures.siteRepresentative || 'غير محدد' },
        { selector: '.engineeringAffairsManagerSignatureName', value: signatures.engineeringAffairsManager || 'غير محدد' },
        { selector: '.generalServicesManagerSignatureName', value: signatures.generalServicesManager || 'غير محدد' },
        { selector: '.followUpManagerSignatureName', value: signatures.followUpManager || 'غير محدد' }
    ];

    signatureFields.forEach(field => {
        document.querySelectorAll(field.selector).forEach(element => {
            element.textContent = field.value;
        });
    });
}
}
function saveToLocalStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
        console.error(`Error saving to localStorage: ${key}`, error);
        alert('حدث خطأ أثناء حفظ البيانات!');
    }
}
function loadFromLocalStorage(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error(`Error loading from localStorage: ${key}`, error);
        return null;
    }
}
document.addEventListener('DOMContentLoaded', () => initializeContractDisplay());
function updateSignaturesFromLocalStorage() {
    const stored = localStorage.getItem("contractSignatureData");
    if (!stored) {
        console.warn("⚠️ لا توجد بيانات تواقيع مخزنة");
        return;
    }

    try {
        const parsed = JSON.parse(stored);
        updateSignaturesIfPresent(parsed);
    } catch (e) {
        console.error("❌ خطأ في قراءة بيانات التواقيع:", e);
    }
}

