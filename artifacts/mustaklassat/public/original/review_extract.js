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
function getDepartmentName(deptKey) {
    const names = { cleaning: 'النظافة', electricity: 'الكهرباء', agriculture: 'الزراعة', civil_works: 'الأعمال المدنية', mechanical: 'الميكانيكا', laundry: 'المغسلة', patient_services: 'خدمات المرضى' };
    return names[deptKey] || deptKey;
}

// دالة تعبئة الجدول (عرض فقط)
function populateReviewTable() {
    const attendanceData = getAttendanceData();
    const sparePartsData = getSparePartsData();
    const consumablesData = getConsumablesData();

    const tbody = document.getElementById('review-body');
    tbody.innerHTML = '';

    // عرض بيانات العمالة
    if (Object.keys(attendanceData).length > 0) {
        Object.keys(attendanceData).forEach(dept => {
            const employees = attendanceData[dept];
            const totalCost = employees.reduce((sum, emp) => sum + (emp.salary || 0), 0);
            const totalDeductions = employees.reduce((sum, emp) => sum + (emp.deduction || 0), 0);
            const totalFines = employees.reduce((sum, emp) => sum + (emp.totalFine || 0), 0);
            const netTotal = totalCost - totalDeductions - totalFines;
            const row = tbody.insertRow();
            row.insertCell().textContent = 'عمالة';
            row.insertCell().textContent = getDepartmentName(dept);
            row.insertCell().textContent = totalCost.toFixed(2);
            row.insertCell().textContent = totalDeductions.toFixed(2);
            row.insertCell().textContent = totalFines.toFixed(2);
            row.insertCell().textContent = netTotal.toFixed(2);
        });
    }

    // عرض بيانات قطع الغيار
    const sparePartsTotal = sparePartsData.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0);
    if (sparePartsTotal > 0) {
        const row = tbody.insertRow();
        row.insertCell().textContent = 'قطع غيار';
        row.insertCell().textContent = 'إجمالي قطع الغيار';
        row.insertCell().textContent = sparePartsTotal.toFixed(2);
        row.insertCell().textContent = '0.00';
        row.insertCell().textContent = '0.00';
        row.insertCell().textContent = sparePartsTotal.toFixed(2);
    }

    // عرض بيانات المستهلكات
    const consumablesTotal = consumablesData.reduce((sum, row) => sum + (parseFloat(row[4]) || 0), 0);
    if (consumablesTotal > 0) {
        const row = tbody.insertRow();
        row.insertCell().textContent = 'مستهلكات';
        row.insertCell().textContent = 'إجمالي المستهلكات';
        row.insertCell().textContent = consumablesTotal.toFixed(2);
        row.insertCell().textContent = '0.00';
        row.insertCell().textContent = '0.00';
        row.insertCell().textContent = consumablesTotal.toFixed(2);
    }

    // تنسيق الأرقام
    const formatter = new Intl.NumberFormat('ar-SA', { style: 'decimal', minimumFractionDigits: 2 });
    document.querySelectorAll('#review-table td:nth-child(n+3)').forEach(cell => {
        cell.textContent = formatter.format(parseFloat(cell.textContent) || 0);
    });

    // رسالة إذا مفيش بيانات
    if (tbody.rows.length === 0) {
        const row = tbody.insertRow();
        row.insertCell({ colSpan: 6 }).textContent = 'لا توجد بيانات للعرض';
        row.className = 'empty-message';
    }
}

// تهيئة الصفحة
document.addEventListener('DOMContentLoaded', () => {
    updateDateTime();
    setInterval(updateDateTime, 60000);
    initializeContractDisplay();
    populateReviewTable();
});