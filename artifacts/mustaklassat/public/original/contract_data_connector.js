/**
 * contract_data_connector.js
 * ملف جافاسكريبت موحد لربط بيانات العقد بين صفحة الإعدادات وباقي الصفحات
 */
(function suppressHospitalLettersAchievementMissingAttendanceAlert(){
    try {
        const sig = location.pathname + location.search;
        const isHospitalLettersMode = /hospitalLettersClean=1/.test(sig) && /achievement\.html|original-viewer\?page=achievement\.html/.test(sig);
        if (!isHospitalLettersMode || window.__hospitalLettersMissingAttendanceAlertSuppressed) return;
        window.__hospitalLettersMissingAttendanceAlertSuppressed = true;
        const nativeAlert = window.alert;
        window.alert = function(message) {
            if (String(message || '').indexOf('لا توجد بيانات حضور وانصراف') !== -1) {
                console.info('[HospitalLetters] تم تجاهل تنبيه شهادة الإنجاز لأن الصفحة مفتوحة بوضع خطابات الرفع فقط.');
                return;
            }
            return nativeAlert.apply(window, arguments);
        };
        sessionStorage.setItem('dataMissingAlertShown', 'true');
    } catch (_) {}
})();

function initializeContractDisplay(config = {}) {
    const { containerSelector = '.side-data', fields = [
        'hospitalName', 'contractDetails', 'companyName', 'contractType', 
        'directPurchaseRatio', 'extractPeriod'
    ] } = config;

    const container = document.querySelector(containerSelector);

    if (container) {
        createContractDisplayElements(container, fields);
    }

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

    const manualCompanyName = getManualCompanyName(
        mergedData.hospitalName ||
        localStorage.getItem('hospitalName') ||
        ''
    );

    if (manualCompanyName) {
        mergedData.companyName = manualCompanyName;
        data.companyName = manualCompanyName;
        data._manualCompanyName = true;

        localStorage.setItem('persistentContractData', JSON.stringify(data));
        localStorage.setItem('companyName', manualCompanyName);
    }

    // تحديث العناصر المباشرة داخل صفحات الحضور والأداء
    document.querySelectorAll('.hospitalName').forEach(el => {
        el.textContent = mergedData.hospitalName || 'غير محدد';
    });

    document.querySelectorAll('.contractDetails').forEach(el => {
        el.textContent = mergedData.contractDetails || 'غير محدد';
    });

    document.querySelectorAll('.companyName').forEach(el => {
        el.textContent = mergedData.companyName || 'غير محدد';
    });

    document.querySelectorAll('.contractType').forEach(el => {
        el.textContent = mergedData.contractType || 'عقد أساسي';
    });

    document.querySelectorAll('.directPurchaseRatio').forEach(el => {
        el.textContent = mergedData.directPurchaseRatio || '0';
    });

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
}

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

function manualCompanyKey(hospitalName) {
    return 'manualCompanyName__h__' + encodeURIComponent(hospitalName || '');
}

function getManualCompanyName(hospitalName) {
    try {
        return localStorage.getItem(manualCompanyKey(hospitalName || '')) || '';
    } catch (e) {
        return '';
    }
}

function forceContractDirectDisplay() {
    const data = loadFromLocalStorage('persistentContractData') || {};
    const extractData = loadFromLocalStorage('persistentExtractData') || {};

    const hospitalName =
        data.hospitalName ||
        localStorage.getItem('hospitalName') ||
        '—';

    const manualCompanyName = getManualCompanyName(hospitalName);

    const companyName =
        manualCompanyName ||
        data.companyName ||
        localStorage.getItem('companyName') ||
        '—';

    if (manualCompanyName) {
        data.companyName = manualCompanyName;
        data._manualCompanyName = true;

        localStorage.setItem('persistentContractData', JSON.stringify(data));
        localStorage.setItem('companyName', manualCompanyName);
    }

    const contractDetails = data.contractDetails || localStorage.getItem('contractDetails') || '—';
    const contractType = data.contractType || 'عقد أساسي';
    const directPurchaseRatio = data.directPurchaseRatio || '0';

    document.querySelectorAll('.hospitalName').forEach(el => {
        el.textContent = hospitalName;
    });

    document.querySelectorAll('.companyName').forEach(el => {
        el.textContent = companyName;
    });

    document.querySelectorAll('.contractDetails').forEach(el => {
        el.textContent = contractDetails;
    });

    document.querySelectorAll('.contractType').forEach(el => {
        el.textContent = contractType;
    });

    document.querySelectorAll('.directPurchaseRatio').forEach(el => {
        el.textContent = directPurchaseRatio;
    });

    if (extractData.extractStart) {
        document.querySelectorAll('#extract-start-date, #extract-start').forEach(el => {
            if (el.tagName === 'SPAN') el.textContent = extractData.extractStart;
        });
    }

    if (extractData.extractEnd) {
        document.querySelectorAll('#extract-end-date, #extract-end').forEach(el => {
            if (el.tagName === 'SPAN') el.textContent = extractData.extractEnd;
        });
    }
}

/* ════════════════════════════════════════════════════════
   syncExtractBanner — يربط رقم الدفعة + الشهر + السنة
   على جميع الصفحات من persistentExtractData
   ════════════════════════════════════════════════════════ */
function syncExtractBanner() {
    const extractData = loadFromLocalStorage('persistentExtractData') || {};
    const paymentNumber = extractData.paymentNumber || '—';
    const extractMonth  = extractData.extractMonth  || '—';
    const extractYear   = String(extractData.extractYear || '—');

    function fmt(dateStr) {
        if (!dateStr || dateStr === 'غير محدد') return 'غير محدد';

        try {
            const d = new Date(dateStr);
            if (isNaN(d)) return dateStr;
            return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
        } catch (_) {
            return dateStr;
        }
    }

    const startFmt = fmt(extractData.extractStart);
    const endFmt   = fmt(extractData.extractEnd);

    // رقم الدفعة
    document.querySelectorAll('#extract-payment-number, .extract-payment-number').forEach(el => {
        el.textContent = paymentNumber;
    });

    // الشهر والسنة (spans للعرض فقط، لا تلمس inputs)
    document.querySelectorAll('#extract-month-display, .extract-month-display').forEach(el => {
        el.textContent = extractMonth;
    });

    document.querySelectorAll('#extract-year-display, .extract-year-display').forEach(el => {
        el.textContent = extractYear;
    });

    // تحديث أوبشنز الشهر/السنة الخاصة بـ attendance.html إذا وُجدت
    document.querySelectorAll('#extract-month').forEach(el => {
        if (el.tagName === 'SPAN') el.textContent = extractMonth;
    });

    document.querySelectorAll('#extract-year').forEach(el => {
        if (el.tagName === 'SPAN') el.textContent = extractYear;
    });

    // تاريخ البداية والنهاية (spans للعرض فقط)
    document.querySelectorAll('#extract-start').forEach(el => {
        if (el.tagName === 'SPAN') el.textContent = startFmt;
    });

    document.querySelectorAll('#extract-end').forEach(el => {
        if (el.tagName === 'SPAN') el.textContent = endFmt;
    });

    document.querySelectorAll('#extract-start-date, #extract-end-date').forEach(el => {
        if (el.tagName === 'SPAN') {
            el.textContent = el.id === 'extract-start-date' ? startFmt : endFmt;
        }
    });
}

function isPerformancePage() {
    return /performance\.html(?:$|[?#])|original-viewer\?page=performance\.html/.test(location.pathname + location.search);
}

function syncPerformanceAmountsFromCurrentAttendance() {
    if (!isPerformancePage()) return false;
    try {
        const attendanceData = loadFromLocalStorage('attendanceData') || {};
        if (!attendanceData || typeof attendanceData !== 'object') return false;

        const extractData = loadFromLocalStorage('persistentExtractData') || {};
        const contractData = loadFromLocalStorage('persistentContractData') || {};
        const contractType = contractData.contractType || localStorage.getItem('contractType') || 'عقد أساسي';
        const directPurchaseRatio = parseFloat(contractData.directPurchaseRatio || localStorage.getItem('directPurchaseRatio') || 0) || 0;

        const start = extractData.extractStart ? new Date(extractData.extractStart) : new Date();
        const end = extractData.extractEnd ? new Date(extractData.extractEnd) : new Date();
        let daysInExtract = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        if (!Number.isFinite(daysInExtract) || daysInExtract < 1) daysInExtract = 1;
        const totalDaysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate() || 30;

        const deptKeys = ['cleaning', 'electricity', 'agriculture', 'civil_works', 'mechanical', 'laundry', 'patient_services', 'security', 'admin_saudi'];
        const totals = {};

        deptKeys.forEach(key => {
            const rows = Array.isArray(attendanceData[key]) ? attendanceData[key] : [];
            let total = 0;
            rows.forEach(emp => {
                const salary = parseFloat(emp && emp.salary) || 0;
                let adjustedSalary = salary;
                if (contractType === 'شراء مباشر' && directPurchaseRatio > 0) {
                    adjustedSalary = salary + (salary * directPurchaseRatio / 100);
                }
                const dailySalary = totalDaysInMonth > 0 ? adjustedSalary / totalDaysInMonth : 0;
                const extractBaseSalary = daysInExtract >= totalDaysInMonth ? adjustedSalary : dailySalary * daysInExtract;
                total += extractBaseSalary;
            });
            totals[key] = total;
            localStorage.setItem('deptCalculatedCost_' + key, total.toFixed(2));
        });

        localStorage.setItem('najran_performance_attendance_sync_stamp', JSON.stringify({
            at: new Date().toISOString(),
            source: 'contract_data_connector',
            totals
        }));

        return true;
    } catch (error) {
        console.warn('[PerformanceSync] failed to sync current attendance amounts', error);
        return false;
    }
}

window.syncPerformanceAmountsFromCurrentAttendance = syncPerformanceAmountsFromCurrentAttendance;

document.addEventListener('DOMContentLoaded', () => {
    syncPerformanceAmountsFromCurrentAttendance();
    initializeContractDisplay();
    syncExtractBanner();
    forceContractDirectDisplay();

    setTimeout(forceContractDirectDisplay, 300);
    setTimeout(forceContractDirectDisplay, 800);
    setTimeout(forceContractDirectDisplay, 1500);
    setTimeout(forceContractDirectDisplay, 3000);
});

window.addEventListener('najranCloudPulled', function () {
    syncPerformanceAmountsFromCurrentAttendance();
    updateContractDisplayData();
    syncExtractBanner();
    forceContractDirectDisplay();

    if (isPerformancePage() && typeof window.updateAllPerformanceData === 'function') {
        try { window.updateAllPerformanceData(); } catch (_) {}
    }

    setTimeout(forceContractDirectDisplay, 300);
    setTimeout(forceContractDirectDisplay, 1000);
});

window.addEventListener('storage', function (e) {
    if (!e || e.key === 'persistentContractData' || e.key === 'persistentExtractData' || e.key === 'attendanceData') {
        syncPerformanceAmountsFromCurrentAttendance();
        updateContractDisplayData();
        syncExtractBanner();
        forceContractDirectDisplay();

        if (isPerformancePage() && typeof window.updateAllPerformanceData === 'function') {
            try { window.updateAllPerformanceData(); } catch (_) {}
        }

        setTimeout(forceContractDirectDisplay, 300);
    }
});

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