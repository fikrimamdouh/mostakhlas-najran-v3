// Admin Offices attendance hotfix
// - Keeps print header/logo per office affiliation
// - Renames special category to workshops
// - Fixes printed attendance title wording for admin offices
// - Fixes individual attendance-tab print button header/logo
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

    function detectCurrentCenterKey() {
        const activeTab = document.querySelector('.tab-link.active[data-center-key]');
        if (activeTab?.dataset?.centerKey) return activeTab.dataset.centerKey;

        const visibleTable = Array.from(document.querySelectorAll('[id^="table-div-"]')).find(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        });
        if (visibleTable?.id) return visibleTable.id.replace('table-div-', '');

        const titleText = document.getElementById('center-main-title')?.textContent || '';
        const names = getAdminOfficeNamesSafe();
        const match = Object.entries(names).find(([, name]) => titleText.includes(name));
        return match ? match[0] : null;
    }

    function buildOfficialPrintHeader(centerKey) {
        const ch = window.getHeaderForCenter(centerKey);
        return `
            <div class="printable-header admin-office-fixed-header">
                <img class="logo" src="${ch.logoSrc}" alt="Logo">
                <div class="header-text">
                    <h1>${ch.h1}</h1>
                    <h3>${ch.h3}</h3>
                    <h2>مستخلص العمالة للمكاتب الإدارية والمرافق الصحية</h2>
                </div>
                <img class="logo" src="${ch.logoSrc}" alt="Logo">
            </div>
        `;
    }

    function cleanInteractiveFields(root) {
        root.querySelectorAll('.tab-action-buttons, .no-print').forEach(el => el.remove());
        root.querySelectorAll('select, input').forEach(el => {
            const span = document.createElement('span');
            span.className = el.className;
            span.style.cssText = el.style.cssText;
            if (el.tagName.toLowerCase() === 'select') {
                span.textContent = el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : el.value;
            } else {
                span.textContent = el.value;
            }
            el.replaceWith(span);
        });
    }

    function printCurrentAttendanceTable() {
        const centerKey = detectCurrentCenterKey();
        if (!centerKey) {
            alert('لم يتم تحديد المكتب الحالي للطباعة. افتح المكتب مرة أخرى ثم اطبع.');
            return;
        }

        const tableContainer = document.getElementById(`table-div-${centerKey}`);
        if (!tableContainer) {
            alert('لم يتم العثور على جدول الحضور الخاص بالمكتب الحالي.');
            return;
        }

        const contentClone = tableContainer.cloneNode(true);
        cleanInteractiveFields(contentClone);

        contentClone.innerHTML = contentClone.innerHTML
            .replace(/بمركز صحي /g, 'بالمكتب/المرفق: ')
            .replace(/لمركز:/g, 'للمكتب/المرفق:');

        const contractInfo = document.querySelector('.page-contract-info-v2')?.cloneNode(true);

        const printWindow = window.open('', '', 'height=800,width=1200');
        const doc = printWindow.document;
        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <title>طباعة حضور المكاتب الإدارية</title>
                <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
                <style>
                    @page { size: A4 landscape; margin: 0.5cm; }
                    * { box-sizing: border-box; }
                    body { font-family: 'Tajawal', Arial, sans-serif; direction: rtl; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    .printable-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 6px; margin-bottom: 8px; border-bottom: 1px solid #ccc; }
                    .printable-header .logo { width: 60px; height: auto; }
                    .printable-header .header-text { text-align: center; flex: 1; }
                    .printable-header h1, .printable-header h2, .printable-header h3 { margin: 2px 0; }
                    .printable-header h1 { font-size: 13pt; }
                    .printable-header h3 { font-size: 11pt; font-weight: 500; }
                    .printable-header h2 { font-size: 12pt; }
                    .page-contract-info-v2 { font-size: 8pt; text-align: center; margin-bottom: 8px; padding: 5px; border: 1px solid #ccc; border-radius: 8px; }
                    .extract-details-v2 { font-size: 10pt; padding: 8px; background: #003087 !important; color: #fff !important; border-radius: 8px 8px 0 0; display: flex; justify-content: space-between; gap: 10px; }
                    table { width: 100%; border-collapse: collapse; table-layout: auto; }
                    th, td { border: 1px solid #777; padding: 2px 3px; text-align: center; font-size: 7pt; white-space: nowrap; }
                    th { background: #003087 !important; color: #fff !important; }
                    caption { caption-side: top; }
                    .table-summary-v2 { font-size: 8pt; padding: 5px; display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; border: 1px solid #ccc; background: #f8f9fa; font-weight: bold; }
                    .signatures-display-section, .signatures-grid { display: flex; justify-content: space-around; margin-top: 15px; padding-top: 10px; border-top: 1px solid #ccc; }
                    .signature-item, .signature-item-display { text-align: center; font-size: 9pt; }
                    .signature-item .line, .signature-item-display .line { border-bottom: 1px solid #000; min-height: 20px; margin-top: 20px; }
                </style>
            </head>
            <body>
                ${buildOfficialPrintHeader(centerKey)}
                ${contractInfo ? contractInfo.outerHTML : ''}
                ${contentClone.outerHTML}
            </body>
            </html>
        `);
        doc.close();

        printWindow.onload = () => {
            printWindow.focus();
            printWindow.print();
            printWindow.close();
        };
    }

    window.preparePrint = printCurrentAttendanceTable;

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
                        .replace(/لمركز:/g, 'للمكتب/المرفق:')
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