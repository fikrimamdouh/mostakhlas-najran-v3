/**
 * contract_data_connector.js
 * ملف جافاسكريبت موحد لربط بيانات العقد بين صفحة الإعدادات وباقي الصفحات
 */

(function setupSettingsMainRuntimeGuards() {
    try {
        var isSettingsMain = /(^|\/)settings_main\.html(?:$|\?)/.test(location.pathname || '') ||
            /(?:^|[?&])page=settings_main\.html(?:&|$)/.test(location.search || '');

        if (!isSettingsMain || window.__settingsMainRuntimeGuardsInstalled) return;
        window.__settingsMainRuntimeGuardsInstalled = true;

        function fixSettingsContractDataDuplicateId() {
            try {
                var sideContractBox = document.querySelector('.side-data > .contract-data#contract-data');
                var mainContractSection = document.querySelector('#contract > .section-content#contract-data');
                if (sideContractBox && mainContractSection) {
                    sideContractBox.id = 'contract-info-display';
                }
            } catch (e) {}
        }

        function callIfReady(fnName) {
            try {
                if (typeof window[fnName] === 'function') {
                    window[fnName]();
                }
            } catch (e) {
                console.warn('[settings guard] skipped failed call:', fnName, e);
            }
        }

        function runGuardedSettingsRefresh() {
            fixSettingsContractDataDuplicateId();
            callIfReady('updateContractDisplayData');
            callIfReady('syncExtractBanner');
            callIfReady('forceContractDirectDisplay');
            callIfReady('autoFillFromSession');
            callIfReady('renderHospitalPicker');
        }

        var cloudRefreshTimer = null;
        window.addEventListener('naj