// Admin Offices attendance hotfix
// - Keeps print header/logo per office affiliation
// - Renames special category to workshops
// - Fixes printed attendance title wording for admin offices
(function () {
    'use strict';

    const WORKSHOP_LABEL = 'الورش (صيانة وإصلاح السيارات)';
    const NAJRAN_OFFICE_KEYS = new Set(['center_9', 'center_10', 'center_11', 'center_12', 'center_13', 'center_14']);

    function isPlainObject(value) {
        return value && typeof value === 'object' && !Array.isArray(value);
    }

    function readJson(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (_) {
            return fallback;
        }
    }

    function writeJson(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function getAdminOfficeNamesSafe() {
        if (typeof getCenterNames === 'function') return getCenterNames();
        return readJson('adminOfficeNames_v1', {});
    }

    function saveAdminOfficeNamesSafe(names) {
        if (typeof saveCenterNames === 'function') return saveCenterNames(names);
        writeJson('adminOfficeNames_v1', names);
    }

    function getAdminOfficeAffiliationsSafe() {
        if (typeof getAffiliations === 'function') return getAffiliations();
        return readJson('adminOfficeAffiliations_v1', {});
    }

    function saveAdminOfficeAffiliationsSafe(affiliations) {
        if (typeof saveAffiliations === 'function') return saveAffiliations(affiliations);
        writeJson('adminOfficeAffiliations_v1', affiliations);
    }

    function normalizeWorkshopLabel() {
        const names = getAdminOfficeNamesSafe();
        if (!isPlainObject(names)) return;
        if (names.admin_staff !== WORKSHOP_LABEL) {
            names.admin_staff = WORKSHOP_LABEL;
            saveAdminOfficeNamesSafe(names);
        }
    }

    function normalizeOfficeAffiliations() {
        const affiliations = getAdminOfficeAffiliationsSafe();
        if (!isPlainObject(affiliations)) return;

        for (let i = 1; i <= 7; i++) affiliations[`center_${i}`] = affiliations[`center_${i}`] || 'moh';
        affiliations.center_8 = affiliations.center_8 || 'wiqaya';
        NAJRAN_OFFICE_KEYS.forEach(key => { affiliations[key] = 'najran'; });
        affiliations.admin_staff = affiliations.admin_staff || 'moh';

        saveAdminOfficeAffiliationsSafe(affiliations);
    }

    window.getHeaderForCenter = function getHeaderForCenterPatched(centerKey) {
        const affiliations = getAdminOfficeAffiliationsSafe();
        let aff = affiliations[centerKey];

        if (!aff) {
            if (NAJRAN_OFFICE_KEYS.has(centerKey)) aff = 'najran';
            else if (centerKey === 'center_8') aff = 'wiqaya';
            else aff = 'moh';
        }

        if (aff === 'najran') {
            return {
                logoSrc: 'najran_health_cluster_logo.png',
                h1: 'تجمع نجران الصحي',
                h3: 'وحدة الصيانة العامة',
            };
        }

        if (aff === 'wiqaya') {
            return {
                logoSrc: 'moh_logo.png',
                h1: 'هيئة الصحة العامة وقاية',
                h3: 'المكاتب الإدارية',
            };
        }

        return {
            logoSrc: 'moh_logo.png',
            h1: 'فرع وزارة الصحة بمنطقة نجران',
            h3: 'المكاتب الإدارية',
        };
    };

    const originalInitializeCenterNames = window.initializeCenterNames;
    window.initializeCenterNames = function initializeCenterNamesPatched() {
        if (typeof originalInitializeCenterNames === 'function') {
            originalInitializeCenterNames.apply(this, arguments);
        }
        normalizeWorkshopLabel();
        normalizeOfficeAffiliations();
    };

    const originalPrintSelected = window.printSelected;
    window.printSelected = function printSelectedPatched() {
        if (typeof originalPrintSelected !== 'function') return;

        const originalOpen = window.open;
        window.open = function patchedOpen() {
            const printWindow = originalOpen.apply(window, arguments);
            if (!printWindow || !printWindow.document) return printWindow;

            const originalWrite = printWindow.document.write.bind(printWindow.document);
            printWindow.document.write = function patchedWrite(html) {
                if (typeof html === 'string') {
                    html = html
                        .replace(/بمركز صحي /g, 'بالمكتب/المرفق: ')
                        .replace(/تقرير_حضور_المراكز/g, 'تقرير_حضور_المكاتب_الإدارية');
                }
                return originalWrite(html);
            };

            return printWindow;
        };

        try {
            return originalPrintSelected.apply(this, arguments);
        } finally {
            window.open = originalOpen;
        }
    };

    normalizeWorkshopLabel();
    normalizeOfficeAffiliations();
})();