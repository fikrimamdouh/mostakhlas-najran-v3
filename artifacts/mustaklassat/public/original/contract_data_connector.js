/**
 * contract_data_connector.js
 * ملف جافاسكريبت موحد لربط بيانات العقد بين صفحة الإعدادات وباقي الصفحات
 */
function normalizeContractDisplayId() {
    try {
        const sideDisplay = document.querySelector('.side-data > .contract-data');
        if (sideDisplay && sideDisplay.id === 'contract-data') {
            sideDisplay.id = 'contract-info-display';
        }
    } catch (e