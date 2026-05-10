// استيراد الدوال
function navigateTo(url) { window.location.href = url; }
function updateDateTime() {
    document.getElementById('current-date-time').textContent = new Date().toLocaleDateString('ar-SA', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}
function getAttendanceData() { return JSON.parse(localStorage.getItem('attendanceData')) || {}; }
function getSparePartsData() { return JSON.parse(localStorage.getItem('sparePartsData')) || []; }
function getConsumablesData() { return JSON.parse(localStorage.getItem('consumablesTableData')) || []; }
function getExtractData() { return JSON.parse(localStorage.getItem('persistentExtractData')) || {}; }
function getContractData() { return JSON.parse(localStorage.getItem('persistentContractData')) || {}; }
function getExtractId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('extractId');
}
function getDepartmentName(deptKey) {
    const names = { project: 'إدارة المشروع', maintenance: 'إدارة الصيانة', operations: 'إدارة التشغيل والصيانة', engineering: 'الإدارة الهندسية', financial: 'الإدارة المالية', hospital: 'إدارة المستشفى' };
    return names[deptKey] || deptKey;
}

// دالة موافقة
function approve() {
    const dept = getCurrentDepartment(); // دالة لتحديد الإدارة الحالية
    if (dept) {
        const approvalData = JSON.parse(localStorage.getItem('approvalData')) || {};
        const now = new Date().toLocaleString('ar-SA');
        approvalData[dept] = { status: 'معتمد', date: now };
        localStorage.setItem('approvalData', JSON.stringify(approvalData));
        logMovement(dept, 'موافقة', '');
        updateStatus();
        sendNotification(dept, 'موافقة');
        nextDepartment();
    }
}

// دالة إرجاع
function returnExtract() {
    const dept = getCurrentDepartment();
    const note = prompt('أدخل سبب الإرجاع:');
    if (dept && note) {
        const returnLog = JSON.parse(localStorage.getItem('returnLog')) || [];
        const now = new Date().toLocaleString('ar-SA');
        returnLog.push({ transaction: getExtractId() || 'TRX-001', dept, action: 'إرجاع', note, date: now });
        localStorage.setItem('returnLog', JSON.stringify(returnLog));
        logMovement(dept, 'إرجاع', note);
        updateStatus();
        sendNotification(dept, 'إرجاع', note);
        previousDepartment();
    }
}

// دالة تحديث الحالة
function updateStatus() {
    const approvalData = JSON.parse(localStorage.getItem('approvalData')) || {};
    const departments = ['project', 'maintenance', 'operations', 'engineering', 'financial', 'hospital'];
    const status = document.getElementById('extract-status');
    const currentDept = getCurrentDepartment();
    if (currentDept && !approvalData[currentDept]) {
        status.textContent = `📁 الحالة: بانتظار المراجعة من ${getDepartmentName(currentDept)}`;
    } else if (departments.every(d => approvalData[d])) {
        status.textContent = '📁 الحالة: معتمد نهائيًا';
    } else {
        const nextDept = departments.find(d => !approvalData[d]);
        status.textContent = `📁 الحالة: بانتظار المراجعة من ${getDepartmentName(nextDept)}`;
    }
}

// دالة تسجيل الحركات
function logMovement(dept, action, note) {
    const movementLog = JSON.parse(localStorage.getItem('movementLog')) || [];
    const now = new Date().toLocaleString('ar-SA');
    movementLog.push({ transaction: getExtractId() || 'TRX-001', dept: getDepartmentName(dept), action, note, date: now });
    localStorage.setItem('movementLog', JSON.stringify(movementLog));
    populateMovementLog();
}

// دالة تعبئة سجل الحركات
function populateMovementLog() {
    const movementLog = JSON.parse(localStorage.getItem('movementLog')) || [];
    const tbody = document.getElementById('movement-log-body');
    tbody.innerHTML = '';
    movementLog.forEach(log => {
        const row = tbody.insertRow();
        row.insertCell().textContent = log.transaction;
        row.insertCell().textContent = log.dept;
        row.insertCell().textContent = log.action;
        row.insertCell().textContent = log.note || '—';
        row.insertCell().textContent = log.date;
    });
}

// دالة تعبئة سجل الإرجاع
function populateReturnLog() {
    const returnLog = JSON.parse(localStorage.getItem('returnLog')) || [];
    const tbody = document.getElementById('return-log-body');
    tbody.innerHTML = '';
    returnLog.forEach(log => {
        const row = tbody.insertRow();
        row.insertCell().textContent = log.transaction;
        row.insertCell().textContent = log.dept;
        row.insertCell().textContent = log.action;
        row.insertCell().textContent = log.note || '—';
        row.insertCell().textContent = log.date;
    });
}

// دالة الانتقال للإدارة التالية
function nextDepartment() {
    const departments = ['project', 'maintenance', 'operations', 'engineering', 'financial', 'hospital'];
    const approvalData = JSON.parse(localStorage.getItem('approvalData')) || {};
    const currentIdx = departments.indexOf(getCurrentDepartment());
    if (currentIdx < departments.length - 1) {
        const nextDept = departments[currentIdx + 1];
        if (!approvalData[nextDept]) window.location.href = `review_extract.html?extractId=${getExtractId()}&dept=${nextDept}`;
    }
}

// دالة العودة للإدارة السابقة
function previousDepartment() {
    const departments = ['project', 'maintenance', 'operations', 'engineering', 'financial', 'hospital'];
    const currentIdx = departments.indexOf(getCurrentDepartment());
    if (currentIdx > 0) {
        const prevDept = departments[currentIdx - 1];
        window.location.href = `review_extract.html?extractId=${getExtractId()}&dept=${prevDept}`;
    }
}

// دالة تحديد الإدارة الحالية
function getCurrentDepartment() {
    const params = new URLSearchParams(window.location.search);
    return params.get('dept') || 'project'; // الإدارة الأولى افتراضيًا
}

// دالة تعبئة الجدول
function populateReviewTable() {
    const attendanceData = getAttendanceData();
    const sparePartsData = getSparePartsData();
    const consumablesData = getConsumablesData();
    const contractData = getContractData();
    const approvalData = JSON.parse(localStorage.getItem('approvalData')) || {};

    const tbody = document.getElementById('review-body');
    tbody.innerHTML = '';
    const departments = ['project', 'maintenance', 'operations', 'engineering', 'financial', 'hospital'];

    departments.forEach(dept => {
        const employeeName = contractData.signatures[dept] || '—';
        const row = tbody.insertRow();
        row.insertCell().textContent = getDepartmentName(dept);
        row.insertCell().textContent = employeeName;
        row.insertCell().textContent = approvalData[dept] ? 'معتمد' : '🕓 لم يتم الاعتماد';
        row.insertCell().textContent = approvalData[dept] ? approvalData[dept].date : '—';
        const actionCell = row.insertCell();
        if (!approvalData[dept]) {
            actionCell.innerHTML = `<button onclick="approve()">موافقة</button> <button onclick="returnExtract()">إرجاع</button>`;
        }
    });

    // تحديث بيانات العقد
    document.getElementById('contract-info-display').innerHTML = `
        <p>رقم المعاملة: ${getExtractId() || '—'}</p>
        <p>نوع المستخلص: ${getExtractType()}</p>
        <p>اسم المستشفى: ${contractData.hospitalName || '—'}</p>
        <p>اسم الشركة: ${contractData.companyName || '—'}</p>
        <p>تفاصيل العقد: ${contractData.contractDetails || '—'}</p>
        <p>مدة المستخلص: من ${getExtractData().extractStart || '—'} إلى ${getExtractData().extractEnd || '—'} (${getExtractData().extractDuration || ''})</p>
    `;
}

// دالة تحديد نوع المستخلص
function getExtractType() {
    const urlParams = new URLSearchParams(window.location.search);
    const page = urlParams.get('page');
    if (page === 'attendance') return 'مستخلص العمالة';
    if (page === 'consumables') return 'مستخلص المستهلكات';
    if (page === 'spare_parts') return 'مستخلص قطع الغيار';
    return 'غير محدد';
}

// دالة إرسال الإشعار (سيتم تطويره لاحقًا)
function sendNotification(dept, action, note = '') {
    const employee = getContractData().signatures[dept] || 'غير محدد';
    const email = getContractData().contactInfo[`${dept}Email`] || '';
    const phone = getContractData().contactInfo[`${dept}Phone`] || '';
    console.log(`إشعار لـ ${employee}: حالة المعاملة ${action}. ملاحظة: ${note}. إيميل: ${email}, هاتف: ${phone}`);
    // ملاحظة: سيتم تطوير هذا مع EmailJS أو API واتساب لاحقًا
}

// تهيئة الصفحة
document.addEventListener('DOMContentLoaded', () => {
    updateDateTime();
    setInterval(updateDateTime, 60000);
    initializeContractDisplay();
    populateReviewTable();
    populateMovementLog();
    populateReturnLog();
    updateStatus();
});