/**
 * ===================================================================
 *      ===>   ✅ نظام النسخ الاحتياطي والاستعادة (V16 - شامل لكل الأقسام)   <===
 * ===================================================================
 * @description ملف JavaScript موحد يحتوي على كل ما يخص النسخ الاحتياطي والاستعادة.
 * يغطي: المستشفى الرئيسي + المراكز الصحية + المكاتب الإدارية + الإعدادات.
 */

// === 1. دوال الواجهة (فتح/إغلاق النوافذ) ===

function openBackupRestoreModal() {
    const modal = document.getElementById('backup-restore-modal');
    if (modal) {
        const fileInput = document.getElementById('restore-file-input');
        const fileNameDisplay = document.getElementById('file-name-display');
        if (fileInput) fileInput.value = '';
        if (fileNameDisplay) fileNameDisplay.textContent = 'لم يتم اختيار أي ملف.';
        modal.style.display = 'flex';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

function updateFileName(input) {
    const fileNameDisplay = document.getElementById('file-name-display');
    if (input.files && input.files.length > 0) {
        fileNameDisplay.textContent = `الملف المختار: ${input.files[0].name}`;
    } else {
        fileNameDisplay.textContent = 'لم يتم اختيار أي ملف.';
    }
}

// === 2. إدارة سجل العمليات ===

function addLogEntry(operation, type, status) {
    try {
        const logs = JSON.parse(localStorage.getItem('backupLogs') || '[]');
        const newLog = {
            timestamp: new Date().toLocaleString('ar-EG'),
            operation: operation,
            type: type,
            status: status
        };
        logs.unshift(newLog);
        if (logs.length > 20) logs.pop();
        localStorage.setItem('backupLogs', JSON.stringify(logs));
        renderBackupLog();
    } catch (e) { console.error("فشل إضافة سجل:", e); }
}

function renderBackupLog() {
    const logBody = document.getElementById('backup-log-body');
    if (!logBody) return;
    const logs = JSON.parse(localStorage.getItem('backupLogs') || '[]');
    if (logs.length === 0) {
        logBody.innerHTML = '<tr><td colspan="4">لا توجد عمليات مسجلة.</td></tr>';
        return;
    }
    logBody.innerHTML = logs.map(log => `
        <tr>
            <td>${log.timestamp}</td>
            <td>${log.operation}</td>
            <td>${log.type}</td>
            <td class="${log.status === 'نجاح' ? 'log-success' : 'log-fail'}">${log.status}</td>
        </tr>
    `).join('');
}

// === 3. إنشاء النسخة الاحتياطية ===

function createSpecificBackup(backupType) {
    try {
        const backupObject = collectDataForBackup(backupType);
        
        if (Object.keys(backupObject.data.data).length === 0) {
            alert(`لا توجد بيانات لإنشاء نسخة احتياطية من نوع "${getSectionName(backupType)}".\nتأكد من أنك أدخلت بيانات في هذا القسم أولاً.`);
            return;
        }

        const blob = new Blob([JSON.stringify(backupObject.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = backupObject.filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        addLogEntry('إنشاء نسخة', getSectionName(backupType), 'نجاح');
        alert(`✅ تم إنشاء النسخة الاحتياطية بنجاح.\nالملف: "${backupObject.filename}"`);

    } catch (error) {
        console.error(`خطأ في إنشاء النسخة (${backupType}):`, error);
        alert('حدث خطأ أثناء إنشاء النسخة الاحتياطية.');
        addLogEntry('إنشاء نسخة', getSectionName(backupType), 'فشل');
    }
}

// === 4. جمع البيانات حسب النوع ===

function collectDataForBackup(backupType) {
    const allData = {};
    const timestamp = new Date().toISOString().slice(0, 10);
    const hospitalName = JSON.parse(localStorage.getItem('persistentContractData') || '{}').hospitalName || 'النظام';

    // النسخة الشاملة — كل مفاتيح localStorage
    if (backupType === 'full_system') {
        const allKeys = Object.keys(localStorage);
        allKeys.forEach(key => {
            try {
                allData[key] = JSON.parse(localStorage.getItem(key));
            } catch (e) {
                allData[key] = localStorage.getItem(key);
            }
        });
        const filename = `نسخة_شاملة_كاملة_${hospitalName.replace(/\s/g, '_')}_${timestamp}.json`;
        return { filename, data: { type: 'full_system', entityName: 'النظام_الشامل', timestamp: new Date().toISOString(), data: allData } };
    }

    /**
     * مفاتيح كل قسم — نوعان:
     *  - string  → مطابقة تامة
     *  - RegExp  → نمط (prefix)
     *
     * المفاتيح المشتركة بين جميع الأقسام: persistentContractData, persistentExtractData
     */
    const SHARED_KEYS = ['persistentContractData', 'persistentExtractData', 'appTitles_v1'];

    const keyPatterns = {

        // ── إعدادات النظام ──────────────────────────────────────────
        settings: [
            'persistentContractData', 'persistentExtractData',
            'distributionSettings', 'performanceTableNames', 'performanceSignatures_v2',
            'contractData', 'contractDetails', 'contractNumber', 'contractType',
            'contractStartDate', 'contractEndDate', 'contractSignatureData',
            'extractMonth', 'extractYear', 'extractNumber', 'extractStart', 'extractEnd',
            'extractFromDate', 'extractToDate',
            'hospitalName', 'companyName', 'directPurchaseRatio',
            'centerNames_v3', 'departmentNames', 'admin_staff',
            'adminOfficeNames_v1', 'appTitles_v1',
            'settings_main', 'settings_advanced',
            'dynamicSignatures', 'contractorSignature',
        ],

        // ── عمالة وأداء المستشفى الرئيسي ───────────────────────────
        main_hospital_attendance: [
            ...SHARED_KEYS,
            'attendanceData', 'performanceTotalDeduction',
            'finalLaborCost', 'grand-net-total',
            'performanceData', 'performanceSignatures', 'performanceTableNames',
            'achievementData', 'achievementTitles_v1',
            'najran_labor_attendance_done', 'najran_labor_performance_done',
            /^tableData_/,
            /^deptCalculatedCost_/,
            /^dept_/,
        ],

        // ── مستهلكات المستشفى الرئيسي ──────────────────────────────
        main_hospital_consumables: [
            ...SHARED_KEYS,
            /^main_hospital_consumables_/,
            /^sparePartsData_/,
            'spare_partsData',
        ],

        // ── عمالة وأداء المراكز الصحية ──────────────────────────────
        health_centers_attendance: [
            ...SHARED_KEYS,
            'centerNames_v3',
            'centersAttendanceData_v2',
            'healthCentersAttendanceData',
            'performanceData_v4',
            'performanceDeductions',
            'grand-net-total',
            'admin_staff',
            'najran_health_attendance_done',
            /^table-/,
        ],

        // ── مستهلكات المراكز الصحية ──────────────────────────────────
        health_centers_consumables: [
            ...SHARED_KEYS,
            'consumables_final_v1.0',
            /^subcontractors_data_consumables_final_/,
            /^performance_data_consumables_final_/,
            /^water_supply_data_consumables_final_/,
            /^laundry_supply_data_consumables_final_/,
            /^sewage_disposal_data_consumables_final_/,
            /^summary_data_consumables_final_/,
            /^signatures_data_consumables_final_/,
            /^print_titles_data_consumables_final_/,
            /^notes_data_consumables_final_/,
        ],

        // ── عمالة وأداء المكاتب الإدارية ────────────────────────────
        admin_offices_attendance: [
            ...SHARED_KEYS,
            'adminOfficeNames_v1',
            'adminOfficesAttendanceData_v1',
            'performanceData_v4',
            'performanceDeductions',
            'grand-net-total',
            'admin_staff',
            'najran_admin_offices_attendance_done',
            /^table-/,
        ],

        // ── مستهلكات المكاتب الإدارية ────────────────────────────────
        admin_offices_consumables: [
            ...SHARED_KEYS,
            'admin_offices_consumables_v1.0',
            /^subcontractors_data_admin_offices_consumables_/,
            /^performance_data_admin_offices_consumables_/,
            /^water_supply_data_admin_offices_consumables_/,
            /^laundry_supply_data_admin_offices_consumables_/,
            /^sewage_disposal_data_admin_offices_consumables_/,
            /^summary_data_admin_offices_consumables_/,
            /^signatures_data_admin_offices_consumables_/,
            /^print_titles_data_admin_offices_consumables_/,
            /^notes_data_admin_offices_consumables_/,
        ],
    };

    const keysToCollect = keyPatterns[backupType] || [];
    keysToCollect.forEach(pattern => {
        const regex = (typeof pattern === 'string')
            ? new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&')}$`)
            : pattern;
        for (const key of Object.keys(localStorage)) {
            if (regex.test(key)) {
                try { allData[key] = JSON.parse(localStorage.getItem(key)); }
                catch { allData[key] = localStorage.getItem(key); }
            }
        }
    });

    const filename = `نسخة_${getSectionName(backupType)}_${hospitalName.replace(/\s/g, '_')}_${timestamp}.json`;
    return { filename, data: { type: backupType, entityName: hospitalName, timestamp: new Date().toISOString(), data: allData } };
}

// === 5. استعادة النسخة الاحتياطية ===

function confirmRestore() {
    const fileInput = document.getElementById('restore-file-input');
    if (!fileInput.files.length) {
        alert('يرجى اختيار ملف نسخة احتياطية أولاً.');
        return;
    }
    const file = fileInput.files[0];

    if (!confirm(`هل أنت متأكد من استعادة البيانات من الملف "${file.name}"؟\nسيتم الكتابة فوق كل البيانات الحالية.`)) {
        return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const backupWrapper = JSON.parse(event.target.result);

            if (!backupWrapper.data || !backupWrapper.timestamp) {
                throw new Error('صيغة ملف النسخة الاحتياطية غير صحيحة أو قديمة.');
            }

            const backupData = backupWrapper.data;

            // ── احفظ المفاتيح المحمية قبل المسح ─────────────────────────────
            // بيانات التأسيسي والمناصب لا تُمسح إلا بحذف صريح من المستخدم
            const protectedSnapshot = {};
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (!k) continue;
                // بيانات التأسيسي: contract_foundation_v2_<مستشفى> + المفتاح السحابي
                if (k.startsWith('contract_foundation_v2_') || k === 'contract_foundation_data') {
                    protectedSnapshot[k] = localStorage.getItem(k);
                }
            }
            // احفظ الجلسة أيضاً حتى لا يُقطع التوكن
            const savedSession = Storage.prototype.getItem.call(localStorage, 'najran_session');

            localStorage.clear();

            // ── استعد البيانات المحمية فوراً (تتغلب على الـ backup) ──────────
            for (const [k, v] of Object.entries(protectedSnapshot)) {
                if (v !== null) localStorage.setItem(k, v);
            }
            if (savedSession) Storage.prototype.setItem.call(localStorage, 'najran_session', savedSession);

            for (const key in backupData) {
                if (Object.prototype.hasOwnProperty.call(backupData, key)) {
                    const value = backupData[key];
                    if (value !== null && value !== undefined) {
                        localStorage.setItem(key, typeof value === 'object' ? JSON.stringify(value) : value);
                    }
                }
            }

            addLogEntry('استعادة نسخة', file.name, 'نجاح');
            alert('✅ تمت استعادة البيانات بنجاح!\nسيتم إعادة تحميل الصفحة الآن.');
            setTimeout(() => window.location.reload(), 1500);

        } catch (error) {
            console.error('فشل الاستعادة:', error);
            alert(`فشل استعادة الملف: ${error.message}`);
            addLogEntry('استعادة نسخة', file.name, 'فشل');
        }
    };
    reader.readAsText(file);
}

// === 6. دالة مساعدة لترجمة الأنواع ===
function getSectionName(type) {
    const names = {
        settings:                  'الإعدادات',
        main_hospital_attendance:  'عمالة_المستشفى',
        main_hospital_consumables: 'مستهلكات_المستشفى',
        health_centers_attendance: 'عمالة_المراكز_الصحية',
        health_centers_consumables:'مستهلكات_المراكز_الصحية',
        admin_offices_attendance:  'عمالة_المكاتب_الإدارية',
        admin_offices_consumables: 'مستهلكات_المكاتب_الإدارية',
        full_system:               'شاملة',
    };
    return names[type] || type;
}

// === 7. تشغيل عند تحميل الصفحة ===
document.addEventListener('DOMContentLoaded', renderBackupLog);
