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

    if (container) {
        createContractDisplayElements(container, fields