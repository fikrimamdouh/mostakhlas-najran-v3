// Admin Offices attendance patch
// - Per-office print logo/header
// - Individual and grouped print fixes
// - Same positions workflow as normal attendance, without internal departments
(function () {
    'use strict';

    const WORKSHOP_LABEL = 'الورش (صيانة وإصلاح السيارات)';
    const NAJRAN_OFFICE_KEYS = new Set(['center_9', 'center_10', 'center_11', 'center_12', 'center_13', 'center_14']);
    const JOB_POS_DB_NAME = 'najranJobPositions';
    const JOB_POS_DB_VER = 1;
    const JOB_POS_STORE = 'positions';

    const DEFAULT_WORKSHOP_POSITIONS = [
        { jobTitle: 'مشرف موقع', salary: 0, category: '5', nationality: 'سعودي' },
        { jobTitle: 'فني ميكانيكا بنزين', salary: 0, category: '4', nationality: 'غير سعودي' },
        { jobTitle: 'فني ميكانيكا ديزل', salary: 0, category: '4', nationality: 'غير سعودي' },
        { jobTitle: 'فني تبريد وتكييف سيارات', salary: 0, category: '4', nationality: 'غير سعودي' },
        { jobTitle: 'فني كهربائي سيارات', salary: 0, category: '4', nationality: 'غير سعودي' },
        { jobTitle: 'فني سمكرة سيارات', salary: 0, category: '4', nationality: 'غير سعودي' },
        { jobTitle: 'دهان سيارات', salary: 0, category: '5', nationality: 'غير سعودي' },
        { jobTitle: 'فني ميزان سيارات', salary: 0, category: '4', nationality: 'غير سعودي' },
        { jobTitle: 'عامل زيت وبنشر', salary: 0, category: '6', nationality: 'غير سعودي' },
        { jobTitle: 'عامل غسيل وتشحيم', salary: 0, category: '6', nationality: 'غير سعودي' }
    ];

    let pendingAdminOfficeImport = { centerKey: null, employees: [], skipped: 0 };

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

    function getAttendanceDataSafe() {
        if (typeof getAttendanceData === 'function') return getAttendanceData();
        return readJson('adminOfficesAttendanceData_v1', {});
    }

    function saveAttendanceDataSafe(data) {
        if (typeof saveAttendanceData === 'function') return saveAttendanceData(data);
        writeJson('adminOfficesAttendanceData_v1', data);
    }

    function rerenderAdminOffices(centerKey) {
        try { if (typeof renderCenterIcons === 'function') renderCenterIcons(); } catch (_) {}
        try { if (typeof renderMainGrid === 'function') renderMainGrid(); } catch (_) {}
        try { if (typeof updateGrandTotal === 'function') updateGrandTotal(); } catch (_) {}
        try { if (typeof displayEmployeesForCenter === 'function' && centerKey && window.activeCenterKeyForManagement === centerKey) displayEmployeesForCenter(centerKey); } catch (_) {}
        try { if (typeof showCenterDetails === 'function' && centerKey && document.getElementById('center-details-view')?.style.display !== 'none') showCenterDetails(centerKey); } catch (_) {}
    }

    function daysCountSafe() {
        try {
            const p = typeof getExtractPeriodDetails === 'function' ? getExtractPeriodDetails() : {};
            return p.daysInExtract || p.daysInMonth || 30;
        } catch (_) {
            return 30;
        }
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
            return { logoSrc: 'najran_health_cluster_logo.png', h1: 'تجمع نجران الصحي', h3: 'وحدة الصيانة العامة' };
        }
        if (aff === 'wiqaya') {
            return { logoSrc: 'moh_logo.png', h1: 'هيئة الصحة العامة وقاية', h3: 'المكاتب الإدارية' };
        }
        return { logoSrc: 'moh_logo.png', h1: 'فرع وزارة الصحة بمنطقة نجران', h3: 'المكاتب الإدارية' };
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
            span.textContent = el.tagName.toLowerCase() === 'select'
                ? (el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : el.value)
                : el.value;
            el.replaceWith(span);
        });
    }

    function openPrintWindow(pagesHtml, title) {
        const printWindow = window.open('', '', 'width=1200,height=900');
        const doc = printWindow.document;
        doc.open();
        doc.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><title>${title}</title><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet"><style>
         @page { size: A4 landscape; margin: 3mm; }
@page landscape { size: A4 landscape; margin: 3mm; }
@page portrait { size: A4 portrait; margin: 7mm; }

html,
body {
  width: auto !important;
  min-height: auto !important;
  margin: 0 !important;
  padding: 0 !important;
}
            * { box-sizing: border-box; }
            body { font-family: 'Tajawal', Arial, sans-serif; direction: rtl; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
.print-page {
  break-after: page;
  page-break-after: always;
  page-break-inside: avoid;
  display: block;
  width: 100% !important;
  max-width: 291mm !important;
  overflow: visible !important;
}            .print-page:last-child { break-after: auto; page-break-after: auto; }
.landscape-page {
  page: landscape;
  transform: scale(0.92);
  transform-origin: top center;
  width: 108.5% !important;
}            .portrait-page { page: portrait; }
            @media print {
  html,
  body {
    width: 297mm !important;
    min-height: 210mm !important;
  }

 .landscape-page {
  page: landscape;
  transform: scale(0.92);
  transform-origin: top center;
  width: 108.5% !important;
  min-height: auto !important;
}
                        .printable-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding-bottom: 2px;
              margin-bottom: 3px;
              border-bottom: 1px solid #ccc;
            }

            .printable-header .logo {
              width: 40px;
              height: auto;
            }

            .printable-header .header-text {
              text-align: center;
              flex: 1;
            }

            .printable-header h1,
            .printable-header h2,
            .printable-header h3 {
              margin: 1px 0;
              line-height: 1.05;
            }

            .printable-header h1 { font-size: 9pt; }
            .printable-header h3 { font-size: 8pt; font-weight: 500; }
            .printable-header h2 { font-size: 9pt; }

            .page-contract-info-v2 {
              font-size: 6pt;
              text-align: center;
              margin-bottom: 3px;
              padding: 2px 4px;
              border: 1px solid #ccc;
              border-radius: 5px;
              line-height: 1.1;
            }

            .extract-details-v2 {
              font-size: 7pt;
              padding: 3px 5px;
              background: #003087 !important;
              color: #fff !important;
              border-radius: 5px 5px 0 0;
              display: flex;
              justify-content: space-between;
              gap: 5px;
              line-height: 1.1;
            }

            .table-responsive-wrapper {
              overflow: visible !important;
              width: 100% !important;
              max-width: 100% !important;
            }

       table {
  width: 100% !important;
  max-width: 100% !important;
  border-collapse: collapse;
  table-layout: fixed;
  margin-top: 2px;
}

th,
td {
  border: 1px solid #555;
  padding: 1px 1px;
  text-align: center;
  font-size: 6.2pt;
  line-height: 1.05;
  vertical-align: middle;
  word-break: break-word;
  overflow: hidden;
}

th {
  background: #003087 !important;
  color: #fff !important;
  font-size: 6.4pt;
  font-weight: 700;
}

th.seq-col,
td.seq-col,
table th:first-child,
table td:first-child {
  width: 1.5% !important;
}

th.job-title,
td.job-title {
  width: 9% !important;
  font-size: 6.4pt;
  white-space: normal !important;
}

th.category-col,
td.category-col {
  width: 2.4% !important;
  white-space: nowrap !important;
}

th.employee-name,
td.employee-name {
  width: 9.5% !important;
  font-size: 6.4pt;
  white-space: normal !important;
}

th.day-col,
td.day-col {
  width: 1.25% !important;
  min-width: 1.25% !important;
  max-width: 1.25% !important;
  padding: 1px 0 !important;
  font-size: 5.7pt !important;
  line-height: 1 !important;
  white-space: nowrap !important;
  word-break: normal !important;
}

th.cost-col,
td.cost-col,
th.net-col,
td.net-col {
  width: 4.5% !important;
  font-size: 5.8pt !important;
  white-space: nowrap !important;
}
/* أعمدة جدول حضور المكاتب حسب ترتيب الأعمدة */
table th:nth-child(1),
table td:nth-child(1) {
  width: 1.5% !important;
}

table th:nth-child(2),
table td:nth-child(2) {
  width: 9% !important;
  white-space: normal !important;
  font-size: 6.4pt !important;
}

table th:nth-child(3),
table td:nth-child(3) {
  width: 2.4% !important;
  white-space: nowrap !important;
}

table th:nth-child(4),
table td:nth-child(4) {
  width: 9.5% !important;
  white-space: normal !important;
  font-size: 6.4pt !important;
}

table th:nth-child(n+5):nth-child(-n+35),
table td:nth-child(n+5):nth-child(-n+35) {
  width: 1.25% !important;
  padding: 1px 0 !important;
  font-size: 5.6pt !important;
  white-space: nowrap !important;
}

table th:nth-last-child(-n+9),
table td:nth-last-child(-n+9) {
  font-size: 5.7pt !important;
  white-space: nowrap !important;
}
th.days-count-col,
td.days-count-col,
th.deduction-col,
td.deduction-col,
th.fine-col,
td.fine-col {
  width: 3.2% !important;
  font-size: 5.8pt !important;
  white-space: nowrap !important;
}

th.nationality-col,
td.nationality-col {
  width: 3.8% !important;
  font-size: 5.8pt !important;
  white-space: normal !important;
}

th.iqama-col,
td.iqama-col {
  width: 5.8% !important;
  font-size: 5.6pt !important;
  white-space: nowrap !important;
}

select,
input,
span {
  max-width: 100% !important;
  font-size: inherit !important;
  line-height: inherit !important;
}

            .portrait-page th,
            .portrait-page td {
              font-size: 9pt;
              padding: 5px;
            }

            .table-summary-v2 {
              font-size: 6pt;
              padding: 2px;
              display: flex;
              flex-wrap: wrap;
              justify-content: center;
              gap: 4px;
              border: 1px solid #ccc;
              background: #f8f9fa;
              font-weight: bold;
              line-height: 1.05;
            }

            .signatures-grid,
            .signatures {
              display: flex;
              justify-content: space-around;
              margin-top: 4px;
              padding-top: 4px;
              border-top: 1px solid #ccc;
            }

            .signature-item {
              text-align: center;
              font-size: 7pt;
              min-width: 110px;
            }

            .signature-item .title {
              font-weight: bold;
            }

            .signature-item .line {
              border-bottom: 1px solid #000;
              min-height: 10px;
              margin-top: 8px;
            }

            .cert-title,
            .sub-title,
            .certificate-header {
              text-align: center;
            }

            .cost-bar,
            .summary {
              text-align: center;
              margin: 8px 0;
              font-weight: bold;
            }

            .item-text {
              text-align: right;
            }

            .total-row {
              font-weight: bold;
              background: #f0f0f0 !important;
            }
            }
        </style></head><body>${pagesHtml}</body></html>`);
        doc.close();
        setTimeout(() => {
            printWindow.focus();
            printWindow.print();
            printWindow.close();
        }, 700);
    }

    function printCurrentAttendanceTable() {
        const centerKey = detectCurrentCenterKey();
        if (!centerKey) return alert('لم يتم تحديد المكتب الحالي للطباعة. افتح المكتب مرة أخرى ثم اطبع.');
        const tableContainer = document.getElementById(`table-div-${centerKey}`);
        if (!tableContainer) return alert('لم يتم العثور على جدول الحضور الخاص بالمكتب الحالي.');
        const contentClone = tableContainer.cloneNode(true);
        cleanInteractiveFields(contentClone);
        contentClone.innerHTML = contentClone.innerHTML.replace(/بمركز صحي /g, 'بالمكتب/المرفق: ').replace(/لمركز:/g, 'للمكتب/المرفق:');
        const contractInfo = document.querySelector('.page-contract-info-v2')?.cloneNode(true);
        openPrintWindow(     `<section class="print-page landscape-page">${buildOfficialPrintHeader(centerKey)}${contractInfo ? contractInfo.outerHTML : ''}${contentClone.outerHTML}</section>`,     'طباعة حضور المكاتب الإدارية' );
    }
    window.preparePrint = printCurrentAttendanceTable;

    function formatDate(dateString) {
        if (!dateString) return 'غير محدد';
        try { return new Date(dateString).toLocaleDateString('en-CA'); } catch (_) { return 'غير محدد'; }
    }

    function periodDetailsSafe() {
        if (typeof getExtractPeriodDetails === 'function') return getExtractPeriodDetails();
        const extractData = readJson('persistentExtractData', {});
        const startDate = new Date(extractData.extractStart || new Date());
        const endDate = new Date(extractData.extractEnd || new Date());
        const daysInExtract = Math.max(1, Math.ceil((endDate - startDate) / 86400000) + 1);
        const totalDaysInMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate();
        return { startDate, daysInExtract, totalDaysInMonth };
    }

    function statusMeta(code) {
        if (window.STATUS_CODES && window.STATUS_CODES[code]) return window.STATUS_CODES[code];
        return ({ 'غ': { isAbsence: true } })[code] || { isAbsence: false };
    }

    function fineConfigFor(category) {
        if (window.ABSENCE_FINES_BY_CATEGORY && window.ABSENCE_FINES_BY_CATEGORY[category]) return window.ABSENCE_FINES_BY_CATEGORY[category];
        return ({     1: { saudi: 500, non_saudi: 500 },     2: { saudi: 500, non_saudi: 500 },     3: { saudi: 250, non_saudi: 100 },     4: { saudi: 180, non_saudi: 80 },     5: { saudi: 150, non_saudi: 80 },     6: { saudi: 20, non_saudi: 20 },     7: { saudi: 10, non_saudi: 10 } })[category] || { saudi: 0, non_saudi: 0 };
    }

    function money(value) {
        const n = Number(value) || 0;
        return n.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function getSignaturesSafe(type, centerKey) {
    try {
        if (
            centerKey &&
            typeof getSignatureKeyForContext === 'function' &&
            typeof getSignatures === 'function'
        ) {
            const scopedKey = getSignatureKeyForContext(type, centerKey);
            const scoped = getSignatures(scopedKey) || [];
            if (scoped.length) return scoped;
        }

        if (typeof getSignatures === 'function') {
            return getSignatures(type) || [];
        }
    } catch (_) {}

    return [];
}

function signatureHtml(type, centerKey, cls = 'signatures-grid') {
    const signatures = getSignaturesSafe(type, centerKey);
    if (!signatures.length) return '';
    return `<div class="${cls}">${signatures.map(sig => `<div class="signature-item"><div class="title">${sig.title || ''}</div><div class="line"></div><div class="name">${sig.name || '................'}</div></div>`).join('')}</div>`;
}
    function buildContractInfoHtml() {
        const node = document.querySelector('.page-contract-info-v2');
        return node ? node.outerHTML : '';
    }

    function buildAttendancePage(centerKey) {
    const names = getAdminOfficeNamesSafe();
    const allData = getAttendanceDataSafe();
    const centerName = names[centerKey] || centerKey;
    const centerData = allData[centerKey] || [];
    const { startDate, daysInExtract, totalDaysInMonth } = periodDetailsSafe();
    const contractData = readJson('persistentContractData', {});
    const extractData = readJson('persistentExtractData', {});
    const companyName = contractData.companyName || 'الشركة';
    const directPurchaseRatio = parseFloat(contractData.directPurchaseRatio) || 0;
    const contractType = contractData.contractType || 'عقد أساسي';

    let totalCost = 0, totalDeduction = 0, totalFine = 0, totalNet = 0;

    const dayHeaders = Array.from({ length: daysInExtract }, (_, i) => {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        return `<th>${d.getDate()}</th>`;
    }).join('');

    const rows = centerData.length ? centerData.map((emp, index) => {
        let days = Array.isArray(emp.days) ? emp.days.slice(0, daysInExtract) : [];
        while (days.length < daysInExtract) days.push('ح');

        let costForPeriod = 0;
        let attendanceDays = 0;
        let absenceDays = 0;
        let deduction = 0;
        let absenceFine = 0;
        let nationalityFine = 0;
        let net = 0;

        if (typeof calculateAdminOfficeEmployeeFinancials === 'function') {
            const calc = calculateAdminOfficeEmployeeFinancials(emp, {
                totalDaysInMonth,
                daysInExtract,
                contractType,
                directPurchaseRatio
            });

            days = calc.days;
            costForPeriod = calc.costForPeriod;
            attendanceDays = calc.attendanceDays;
            absenceDays = calc.absenceDays;
            deduction = calc.deduction;
            absenceFine = calc.absenceFine;
            nationalityFine = calc.nationalityFine;
            net = calc.netSalary;
        } else {
            const salary = parseFloat(emp.salary) || 0;
            const dailyRate = totalDaysInMonth > 0 ? salary / totalDaysInMonth : 0;

            costForPeriod = dailyRate * daysInExtract;
            if (contractType === 'شراء مباشر' && directPurchaseRatio > 0) {
                costForPeriod += costForPeriod * directPurchaseRatio / 100;
            }

            days.forEach(day => {
                if (day === 'غ•') return;

                const meta = statusMeta(day);

                if (day === 'ح' || day === 'ت') {
                    attendanceDays++;
                } else if (day === 'غ' || meta.isAbsence) {
                    absenceDays++;
                }
            });

            deduction = absenceDays * dailyRate;

            const fineConfig = fineConfigFor(emp.category);
            const isSaudi = String(emp.nationality || '').includes('سعودي');
            absenceFine = absenceDays * (isSaudi ? fineConfig.saudi : fineConfig.non_saudi);
            nationalityFine = parseFloat(emp.nationalityFine) || 0;
            net = costForPeriod - deduction - absenceFine - nationalityFine;
        }

        totalCost += costForPeriod;
        totalDeduction += deduction;
        totalFine += absenceFine + nationalityFine;
        totalNet += net;

        return `<tr><td>${index + 1}</td><td>${emp.jobTitle || ''}</td><td>${emp.category || ''}</td><td>${emp.name || ''}</td>${days.map(d => `<td>${d}</td>`).join('')}<td>${money(costForPeriod)}</td><td>${attendanceDays}</td><td>${absenceDays}</td><td>${money(deduction)}</td><td>${money(absenceFine)}</td><td>${money(net)}</td><td>${emp.nationality || ''}</td><td>${money(nationalityFine)}</td><td>${emp.iqamaId || ''}</td></tr>`;
    }).join('') : `<tr><td colspan="${14 + daysInExtract}">لا يوجد موظفون في هذا المكتب/المرفق.</td></tr>`;

    const summary = `<div class="table-summary-v2"><span>عدد الموظفين: <b>${centerData.length}</b></span><span>التكلفة للفترة: <b>${money(totalCost)}</b></span><span>إجمالي الحسم: <b>${money(totalDeduction)}</b></span><span>إجمالي الغرامات: <b>${money(totalFine)}</b></span><span>صافي الاستحقاق: <b>${money(totalNet)}</b></span></div>`;
    const title = `<div class="extract-details-v2"><div>بيان بالحضور والغياب لمنسوبي شركة (${companyName}) بالمكتب/المرفق: ${centerName}</div><div>الفترة (${formatDate(extractData.extractStart)}م - ${formatDate(extractData.extractEnd)}م)</div><div>عدد أيام المستخلص: ${daysInExtract}</div></div>`;

    return `<section class="print-page landscape-page">${buildOfficialPrintHeader(centerKey)}${buildContractInfoHtml()}${title}${summary}<table><thead><tr><th rowspan="2">م</th><th rowspan="2">مسمى الوظيفة</th><th rowspan="2">الفئة</th><th rowspan="2">اسم شاغل الوظيفة</th><th colspan="${daysInExtract}">الأيام</th><th rowspan="2">التكلفة</th><th colspan="2">الأيام</th><th colspan="2">الحسم والغرامة</th><th rowspan="2">الصافي</th><th rowspan="2">الجنسية</th><th rowspan="2">غرامة جنسية</th><th rowspan="2">الإقامة</th></tr><tr>${dayHeaders}<th>حضور</th><th>غياب</th><th>الحسم</th><th>الغرامة</th></tr></thead><tbody>${rows}</tbody></table>${signatureHtml('attendance', centerKey)}</section>`;
}
    function buildPerformancePage(centerKey) {
        if (centerKey === 'admin_staff') return '';
        if (typeof getDynamicPerformanceItems !== 'function' || typeof getPerformanceData !== 'function') return '';
        const names = getAdminOfficeNamesSafe();
        const centerName = names[centerKey] || centerKey;
        const items = getDynamicPerformanceItems();
        const scores = getPerformanceData()[centerKey] || {};
        let maxTotal = 0, scoreTotal = 0;
        const rows = items.map((item, i) => {
            const score = scores[i] !== undefined ? scores[i] : item.max;
            maxTotal += Number(item.max) || 0;
            scoreTotal += Number(score) || 0;
            return `<tr><td>${i + 1}</td><td class="item-text">${item.text}</td><td>${item.max}</td><td>${score}</td></tr>`;
        }).join('') + `<tr class="total-row"><td colspan="2">المجموع</td><td>${maxTotal}</td><td>${scoreTotal}</td></tr>`;
        const percent = maxTotal > 0 ? scoreTotal / maxTotal * 100 : 100;
        const centerCost = typeof calculateCenterTotalCost === 'function' ? calculateCenterTotalCost(centerKey) : 0;
        return `<section class="print-page portrait-page">${buildOfficialPrintHeader(centerKey)}<h2 class="cert-title">جدول تقييم مستوى الأداء والإنجاز</h2><h3 class="sub-title">للمكتب/المرفق: ${centerName}</h3><div class="cost-bar">إجمالي المبلغ لأنشطة القسم: ${money(centerCost)} ريال</div><table><thead><tr><th>م</th><th>أنشطة القسم</th><th>الدرجة القصوى</th><th>التقدير</th></tr></thead><tbody>${rows}</tbody></table><div class="summary">التقدير الذي حصل عليه المقاول: <b>${percent.toFixed(2)}%</b></div>${signatureHtml('performance', centerKey, 'signatures')}</section>`;
    }

    function buildAchievementPage(centerKey) {
        const names = getAdminOfficeNamesSafe();
        const centerName = names[centerKey] || centerKey;
        const centerData = getAttendanceDataSafe()[centerKey] || [];
        const { totalDaysInMonth } = periodDetailsSafe();
        const contractData = readJson('persistentContractData', {});
        const directPurchaseRatio = parseFloat(contractData.directPurchaseRatio) || 0;
        const contractType = contractData.contractType || 'عقد أساسي';
        const perfDeductions = readJson('performanceDeductions', {});
        const titles = typeof getAchievementTitles === 'function' ? getAchievementTitles() : { mainTitle: 'شهادة الإنجاز', subTitle: 'مستخلص العمالة' };
        let monthly = 0, absenceDeduct = 0, absencePenalty = 0, nationPenalty = 0;
        centerData.forEach(emp => {
    if (typeof calculateAdminOfficeEmployeeFinancials === 'function') {
        const calc = calculateAdminOfficeEmployeeFinancials(emp, {
            totalDaysInMonth,
            daysInExtract: totalDaysInMonth,
            contractType,
            directPurchaseRatio
        });

        monthly += calc.costForPeriod;
        absenceDeduct += calc.deduction;
        absencePenalty += calc.absenceFine;
        nationPenalty += calc.nationalityFine;
    } else {
        const salary = parseFloat(emp.salary) || 0;
        let adjusted = salary;

        if (contractType === 'شراء مباشر' && directPurchaseRatio > 0) {
            adjusted += adjusted * directPurchaseRatio / 100;
        }

        monthly += adjusted;

        const daily = totalDaysInMonth > 0 ? adjusted / totalDaysInMonth : 0;
        const absences = (emp.days || []).filter(d => d !== 'غ•' && statusMeta(d).isAbsence).length;
        const fineConfig = fineConfigFor(emp.category);
        const isSaudi = String(emp.nationality || '').includes('سعودي');

        absenceDeduct += absences * daily;
        absencePenalty += absences * (isSaudi ? fineConfig.saudi : fineConfig.non_saudi);
        nationPenalty += parseFloat(emp.nationalityFine) || 0;
    }
});
        const perfPenalty = centerKey !== 'admin_staff' ? (parseFloat(perfDeductions[centerKey]) || 0) : 0;
        const net = monthly - absenceDeduct - absencePenalty - perfPenalty - nationPenalty;
        const tafqitText = typeof tafqit === 'function' ? tafqit(net) : '';
        return `<section class="print-page portrait-page">${buildOfficialPrintHeader(centerKey)}<div class="certificate-header"><h2>${titles.mainTitle}</h2><h3>${titles.subTitle}</h3><h3>للمكتب/المرفق: ${centerName}</h3></div><table><thead><tr><th>البند</th><th>القيمة الشهرية</th><th>حسم الغياب</th><th>غرامة الغياب</th><th>غرامة الأداء</th><th>غرامة الجنسية</th><th>الصافي الشهري</th></tr></thead><tbody><tr><td>العمالة</td><td>${money(monthly)}</td><td>${money(absenceDeduct)}</td><td>${money(absencePenalty)}</td><td>${money(perfPenalty)}</td><td>${money(nationPenalty)}</td><td><b>${money(net)}</b></td></tr><tr class="total-row"><td colspan="6">إجمالي المستحق للمقاول</td><td><b>${money(net)}</b></td></tr><tr><td colspan="7">فقط وقدره: ${tafqitText}</td></tr></tbody></table>${signatureHtml('achievement', centerKey, 'signatures')}</section>`;
    }

    window.printSelected = function printSelectedFullPatched() {
        const selectedKeys = Array.from(document.querySelectorAll('#print-centers-checkboxes input:checked')).map(cb => cb.value).filter(Boolean);
        const printOptions = {
            attendance: !!document.getElementById('print-opt-attendance')?.checked,
            performance: !!document.getElementById('print-opt-performance')?.checked,
            achievement: !!document.getElementById('print-opt-achievement')?.checked,
        };
        if (selectedKeys.length === 0 || (!printOptions.attendance && !printOptions.performance && !printOptions.achievement)) return alert('الرجاء اختيار مكتب/مرفق وتقرير واحد على الأقل للطباعة.');
        if (typeof closeDialog === 'function') closeDialog('management-dialog');
        const pages = [];
        selectedKeys.forEach(centerKey => {
            if (printOptions.attendance) pages.push(buildAttendancePage(centerKey));
            if (printOptions.performance) { const page = buildPerformancePage(centerKey); if (page) pages.push(page); }
            if (printOptions.achievement) pages.push(buildAchievementPage(centerKey));
        });
        openPrintWindow(pages.join(''), 'طباعة التقارير المجمعة للمكاتب الإدارية');
    };

    function jobPositionAuthHeaders() {
        let tok = null;
        try { tok = JSON.parse(localStorage.getItem('najran_session') || '{}').clerkToken || null; } catch (_) {}
        const h = { 'Content-Type': 'application/json' };
        if (tok) h.Authorization = 'Bearer ' + tok;
        return h;
    }

    function openJobPositionIDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(JOB_POS_DB_NAME, JOB_POS_DB_VER);
            req.onupgradeneeded = e => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(JOB_POS_STORE)) db.createObjectStore(JOB_POS_STORE, { keyPath: 'hospitalName' });
            };
            req.onsuccess = e => resolve(e.target.result);
            req.onerror = e => reject(e.target.error);
        });
    }

    async function idbGetJobPositions(hospitalName) {
        try {
            const db = await openJobPositionIDB();
            return await new Promise((resolve, reject) => {
                const req = db.transaction(JOB_POS_STORE, 'readonly').objectStore(JOB_POS_STORE).get(hospitalName);
                req.onsuccess = e => resolve(e.target.result || null);
                req.onerror = e => reject(e.target.error);
            });
        } catch (_) {
            return null;
        }
    }

    async function loadSavedJobPositions(hospitalName) {
        try {
            const resp = await fetch('/api/admin/job-positions?hospital=' + encodeURIComponent(hospitalName), { headers: jobPositionAuthHeaders(), credentials: 'include' });
            if (resp.ok) {
                const data = await resp.json();
                if (data && Array.isArray(data.rows) && data.rows.length) return data;
            }
        } catch (_) {}
        return await idbGetJobPositions(hospitalName);
    }

    function positionRowsForOffice(centerKey, officeName, rec) {
        if (rec && Array.isArray(rec.rows) && rec.rows.length) return rec.rows;
        if (centerKey === 'admin_staff' || String(officeName || '').includes('الورش')) return DEFAULT_WORKSHOP_POSITIONS;
        return [];
    }

    function employeeFromPosition(row) {
        return {
            name: '',
            jobTitle: row.jobTitle || row.title || '',
            category: String(row.category || '1'),
            salary: parseFloat(row.salary) || 0,
            nationality: row.nationality || 'غير سعودي',
            iqamaId: '',
            nationalityFine: 0,
            days: Array(daysCountSafe()).fill('ح')
        };
    }

    async function loadPositionsIntoOffice(centerKey) {
        const names = getAdminOfficeNamesSafe();
        const officeName = names[centerKey] || centerKey;
        const rec = await loadSavedJobPositions(officeName);
        const rows = positionRowsForOffice(centerKey, officeName, rec);
        if (!rows.length) return alert('لا توجد مناصب محفوظة لـ "' + officeName + '".');

        const allData = getAttendanceDataSafe();
        const currentCount = Array.isArray(allData[centerKey]) ? allData[centerKey].length : 0;
        const summary = 'وُجدت ' + rows.length + ' منصب وظيفي لـ "' + officeName + '".';
        if (currentCount > 0) {
            const ok = confirm(summary + '\n\n⚠️ يوجد بيانات حالية في هذا المكتب/المرفق.\nاضغط "موافق" للاستبدال الكامل.\nاضغط "إلغاء" لإلغاء العملية.');
            if (!ok) return;
        } else {
            const ok = confirm(summary + '\n\nهل تريد تحميلها؟');
            if (!ok) return;
        }

        allData[centerKey] = rows.map(employeeFromPosition);
        saveAttendanceDataSafe(allData);
        rerenderAdminOffices(centerKey);
        alert('✅ تم تحميل ' + rows.length + ' منصب بنجاح.\nأدخل أسماء الموظفين وأرقام الهويات في جدول المكتب.');
        if (typeof closeDialog === 'function') closeDialog('management-dialog');
    }

    function orderedOfficeKeys() {
        const names = getAdminOfficeNamesSafe();
        return Object.keys(names).sort((a, b) => {
            if (a.startsWith('center_') && b.startsWith('center_')) return parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]);
            if (a.startsWith('center_')) return -1;
            if (b.startsWith('center_')) return 1;
            return a.localeCompare(b);
        });
    }

    window.loadAdminOfficePositionsFromTemplate = function loadAdminOfficePositionsFromTemplate() {
        const names = getAdminOfficeNamesSafe();
        const current = detectCurrentCenterKey();
        const keys = orderedOfficeKeys();
        const content = `
            <div class="dialog-header"><h3><i class="fas fa-clipboard-list"></i> تحميل المناصب</h3><span class="close" onclick="closeDialog('management-dialog')">×</span></div>
            <div class="dialog-body">
                <p class="info-text">اختر المكتب/المرفق لتحميل المناصب المحفوظة مباشرة داخل جدول العمالة. المكاتب لا تحتوي أقسام داخلية.</p>
                <div class="form-group"><label for="admin-office-load-center">المكتب/المرفق:</label><select id="admin-office-load-center">${keys.map(k => `<option value="${k}" ${k === current ? 'selected' : ''}>${names[k]}</option>`).join('')}</select></div>
            </div>
            <div class="dialog-footer"><button class="btn btn-secondary" onclick="closeDialog('management-dialog')">إلغاء</button><button class="btn btn-success" onclick="window.confirmLoadAdminOfficePositions()"><i class="fas fa-check"></i> تحميل المناصب</button></div>
        `;
        if (typeof openDialog === 'function') openDialog(content, 'management-dialog', false);
        else alert('نظام النوافذ غير جاهز. أعد تحميل الصفحة.');
    };

    window.confirmLoadAdminOfficePositions = function confirmLoadAdminOfficePositions() {
        const centerKey = document.getElementById('admin-office-load-center')?.value;
        if (!centerKey) return alert('اختر المكتب/المرفق أولاً.');
        loadPositionsIntoOffice(centerKey);
    };

    function normHeader(value) {
        return String(value || '')
            .replace(/\u200f|\u200e/g, '')
            .replace(/[إأآا]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/ى/g, 'ي')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    function findHeaderIndex(headers, tests) {
        for (let i = 0; i < headers.length; i++) {
            const h = normHeader(headers[i]);
            if (tests.some(fn => fn(h))) return i;
        }
        return -1;
    }

    function parseNumber(value) {
        if (typeof value === 'number') return value || 0;
        return parseFloat(String(value || '').replace(/,/g, '').replace(/[ ريال﷼]/g, '').trim()) || 0;
    }

    window.processSingleExcelFile = function processAdminOfficeExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => {
                try {
                    const wb = XLSX.read(e.target.result, { type: 'binary' });
                    const employees = [];
                    let skipped = 0;
                    const days = daysCountSafe();

                    wb.SheetNames.forEach(sheetName => {
                        const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
                        if (raw.length < 2) return;
                        let headerRow = 0;
                        for (let r = 0; r < Math.min(12, raw.length); r++) {
                            const row = raw[r].map(normHeader);
                            const hasName = row.some(h => h.includes('اسم الموظف') || h.includes('اسم شاغل الوظيفه') || h === 'name');
                            const hasJob = row.some(h => h.includes('مسمي الوظيفه') || h === 'الوظيفه' || h.includes('job'));
                            if (hasName && hasJob) { headerRow = r; break; }
                        }
                        const headers = raw[headerRow];
                        const iName = findHeaderIndex(headers, [h => h.includes('اسم الموظف'), h => h.includes('اسم شاغل الوظيفه'), h => h === 'name']);
                        const iId = findHeaderIndex(headers, [h => h.includes('الهويه'), h => h.includes('الاقامه'), h => h.includes('iqama'), h => h.includes('id')]);
                        const iJob = findHeaderIndex(headers, [h => h.includes('مسمي الوظيفه'), h => h === 'الوظيفه', h => h.includes('job')]);
                        const iSalary = findHeaderIndex(headers, [h => h.includes('التكلفه'), h => h.includes('راتب'), h => h.includes('salary')]);
                        const iCat = findHeaderIndex(headers, [h => h.includes('الفئه'), h => h.includes('فئه'), h => h.includes('cat')]);
                        const iNat = findHeaderIndex(headers, [h => h.includes('الجنسيه'), h => h.includes('جنسيه'), h => h.includes('nat')]);
                        const iFine = findHeaderIndex(headers, [h => h.includes('غرامه جنسيه')]);
                        if (iName < 0 || iJob < 0) return;

                        for (let r = headerRow + 1; r < raw.length; r++) {
                            const row = raw[r];
                            const empName = String(row[iName] || '').trim();
                            const jobTitle = String(row[iJob] || '').trim();
                            const iqamaId = iId >= 0 ? String(row[iId] || '').trim() : '';
                            const salary = iSalary >= 0 ? parseNumber(row[iSalary]) : 0;
                            if (!empName && !jobTitle && !salary && !iqamaId) { skipped++; continue; }
                            if (['اسم الموظف', 'اسم شاغل الوظيفة', 'مندوب المقاول', 'مدير المركز'].includes(empName)) { skipped++; continue; }
                            employees.push({
                                name: empName,
                                jobTitle: jobTitle || 'غير محدد',
                                category: iCat >= 0 ? String(row[iCat] || '1').trim() : '1',
                                salary,
                                nationality: iNat >= 0 ? (String(row[iNat] || '').trim() || 'غير سعودي') : 'غير سعودي',
                                iqamaId,
                                nationalityFine: iFine >= 0 ? parseNumber(row[iFine]) : 0,
                                days: Array(days).fill('ح')
                            });
                        }
                    });
                    employees._skipped = skipped;
                    resolve(employees);
                } catch (err) {
                    reject(new Error('حدث خطأ أثناء تحليل الملف. تأكد من أن الملف غير تالف.'));
                }
            };
            reader.onerror = () => reject(new Error('فشلت قراءة الملف.'));
            reader.readAsBinaryString(file);
        });
    };

    window.handleSingleFileImport = async function handleAdminOfficeSingleFileImport() {
        const centerKey = document.getElementById('center-select-import')?.value;
        const fileInput = document.getElementById('excel-file-input');
        const statusArea = document.getElementById('import-status-area');
        if (!centerKey) return alert('اختر المكتب/المرفق أولاً.');
        if (!fileInput || !fileInput.files.length) {
            if (statusArea) statusArea.innerHTML = `<p class="status-error">الرجاء اختيار ملف أولاً.</p>`;
            return;
        }
        if (statusArea) statusArea.innerHTML = `<h4><i class="fas fa-spinner fa-spin"></i> جاري معالجة ملف: ${fileInput.files[0].name}...</h4>`;
        try {
            const employees = await window.processSingleExcelFile(fileInput.files[0]);
            if (!employees.length) throw new Error('لم يتم العثور على بيانات موظفين صالحة في الملف.');
            pendingAdminOfficeImport = { centerKey, employees, skipped: employees._skipped || 0 };
            showAdminOfficeImportModeDialog(centerKey, employees.length);
        } catch (err) {
            if (statusArea) statusArea.innerHTML = `<p class="status-error">✗ فشل استيراد الملف. السبب: ${err.message}</p>`;
        }
    };

    function showAdminOfficeImportModeDialog(centerKey, totalFound) {
        const names = getAdminOfficeNamesSafe();
        const currentCount = (getAttendanceDataSafe()[centerKey] || []).length;
        const dlgId = 'admin-office-template-import-mode-dialog';
        document.getElementById(dlgId)?.remove();
        document.getElementById(dlgId + '-overlay')?.remove();
        const dlg = document.createElement('div');
        dlg.id = dlgId;
        dlg.className = 'dialog';
        dlg.innerHTML = `
<div class="dialog-header"><h3><i class="fas fa-file-excel"></i> كيف تريد استيراد الملف؟</h3><span class="close" onclick="window.closeAdminOfficeImportModeDialog()">×</span></div>            <div class="dialog-body" style="padding:16px;">
                <p style="font-size:.9rem;color:#374151;margin-bottom:12px;">المكتب/المرفق: <strong>${names[centerKey] || centerKey}</strong></p>
                <table style="width:100%;border-collapse:collapse;font-size:.85rem;margin-bottom:16px;"><thead><tr style="background:#f1f5f9;"><th style="padding:6px;text-align:right;">حاليون</th><th style="padding:6px;text-align:right;">في الملف</th></tr></thead><tbody><tr><td style="padding:6px;">${currentCount}</td><td style="padding:6px;color:#16a34a;font-weight:700;">${totalFound}</td></tr></tbody></table>
                <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
                    <button onclick="window.confirmAdminOfficeImportReplace()" style="background:#dc2626;color:#fff;border:none;border-radius:8px;padding:11px 24px;font-size:.92rem;font-weight:700;cursor:pointer;"><i class="fas fa-trash-alt"></i> استبدال<br><small style="font-weight:400;font-size:.75rem;">يمسح الحاليين ويضع الجدد</small></button>
                    <button onclick="window.confirmAdminOfficeImportUpdate()" style="background:#16a34a;color:#fff;border:none;border-radius:8px;padding:11px 24px;font-size:.92rem;font-weight:700;cursor:pointer;"><i class="fas fa-sync-alt"></i> تحديث<br><small style="font-weight:400;font-size:.75rem;">يضيف الجدد ويتجاهل المكررين</small></button>
<button onclick="window.closeAdminOfficeImportModeDialog()" style="background:#6b7280;color:#fff;border:none;border-radius:8px;padding:11px 20px;font-size:.92rem;cursor:pointer;"><i class="fas fa-times"></i> إلغاء</button>                </div>
            </div>`;
     const overlay = document.createElement('div');
overlay.id = dlgId + '-overlay';
overlay.className = 'overlay';
overlay.onclick = function(){ window.closeAdminOfficeImportModeDialog(); };
document.body.appendChild(overlay);
document.body.appendChild(dlg);
overlay.style.display = 'block';
dlg.style.display = 'block';
}


    window.closeAdminOfficeImportModeDialog = function () {
        const dlgId = 'admin-office-template-import-mode-dialog';
        document.getElementById(dlgId)?.remove();
        document.getElementById(dlgId + '-overlay')?.remove();
    };

    window.confirmAdminOfficeImportReplace = function confirmAdminOfficeImportReplace() {
        const { centerKey, employees, skipped } = pendingAdminOfficeImport;
        if (!centerKey || !employees.length) return;
        const allData = getAttendanceDataSafe();
        allData[centerKey] = employees;
        saveAttendanceDataSafe(allData);
window.closeAdminOfficeImportModeDialog();        closeDialog('management-dialog');
        rerenderAdminOffices(centerKey);
        alert('✅ تم الاستبدال بنجاح!\nتمت إضافة ' + employees.length + ' موظف' + (skipped ? '\nصفوف فارغة: ' + skipped : ''));
        pendingAdminOfficeImport = { centerKey: null, employees: [], skipped: 0 };
    };

    window.confirmAdminOfficeImportUpdate = function confirmAdminOfficeImportUpdate() {
        const { centerKey, employees, skipped } = pendingAdminOfficeImport;
        if (!centerKey || !employees.length) return;
        const allData = getAttendanceDataSafe();
        if (!Array.isArray(allData[centerKey])) allData[centerKey] = [];
        let added = 0, dup = 0;
        employees.forEach(newEmp => {
            const newIqama = (newEmp.iqamaId || '').trim();
            const newName = (newEmp.name || '').trim().toLowerCase();
            const exists = allData[centerKey].some(emp => (newIqama && (emp.iqamaId || '').trim() === newIqama) || (newName && (emp.name || '').trim().toLowerCase() === newName));
            if (exists) dup++;
            else { allData[centerKey].push(newEmp); added++; }
        });
        saveAttendanceDataSafe(allData);
        window.closeAdminOfficeImportModeDialog();
        closeDialog('management-dialog');
        rerenderAdminOffices(centerKey);
        alert('✅ تم التحديث!\nأُضيف: ' + added + ' موظف جديد' + (dup ? '\nتجاهل مكرر: ' + dup : '') + (skipped ? '\nصفوف فارغة: ' + skipped : ''));
        pendingAdminOfficeImport = { centerKey: null, employees: [], skipped: 0 };
    };

    function wirePositionsButton() {
        Array.from(document.querySelectorAll('button')).forEach(btn => {
            if ((btn.textContent || '').includes('تحميل المناصب')) btn.onclick = window.loadAdminOfficePositionsFromTemplate;
        });
        const nav = document.getElementById('navigation');
        if (nav) {
            Array.from(nav.options).forEach(opt => {
                if ((opt.textContent || '').includes('تحميل المناصب')) opt.value = '__load_admin_office_positions__';
            });
            const oldChange = nav.onchange;
            nav.onchange = function () {
                if (this.value === '__load_admin_office_positions__') {
                    this.value = 'admin_offices_attendance.html';
                    window.loadAdminOfficePositionsFromTemplate();
                    return;
                }
                if (typeof oldChange === 'function') return oldChange.call(this);
            };
        }
    }

    const originalInitializeCenterNames = window.initializeCenterNames;
    window.initializeCenterNames = function initializeCenterNamesPatched() {
        if (typeof originalInitializeCenterNames === 'function') originalInitializeCenterNames.apply(this, arguments);
        normalizeWorkshopLabel();
        normalizeOfficeAffiliations();
        wirePositionsButton();
    };

    normalizeWorkshopLabel();
    normalizeOfficeAffiliations();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wirePositionsButton);
    else wirePositionsButton();
})();
