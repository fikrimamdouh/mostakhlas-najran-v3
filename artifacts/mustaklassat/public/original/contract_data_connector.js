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
    const contractData =