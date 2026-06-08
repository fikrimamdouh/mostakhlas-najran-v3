/**
 * backup.js
 * النسخ المحلي من صفحة الإعدادات فقط.
 * هذه نسخة متصفح للمستخدم الحالي، وليست النسخة المركزية الكاملة للنظام.
 */

function _buSession() {
    try { return JSON.parse(localStorage.getItem('najran_session') || '{}') || {}; } catch (_) { return {}; }
}

function _buOwner() {
    const s = _buSession();
    return {
        userId: s.userId || null,
        email: s.email || null,
        name: s.name || null,
        hospital: s.hospital || localStorage.getItem('hospitalName') || null,
        createdAt: new Date().toISOString()
    };
}

function _buSameOwner(owner) {
    const s = _buSession();
    if (!owner || typeof owner !== 'object') return false;
    if (owner.userId != null && s.userId != null && String(owner.userId) !== String(s.userId)) return false;
    if (owner.email && s.email && String(owner.email).toLowerCase() !== String(s.email).toLowerCase()) return false;
    return true;
}

function _buProtectedKey(k) {
    return k === 'najran_session' || k.indexOf('__clerk') === 0 || k.indexOf('clerk_') === 0 || k.indexOf('amplitude') === 0 || k === 'loglevel';
}

function _buKeepBeforeRestore() {
    const keep = {};
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (_buProtectedKey(k) || k.startsWith('contract_foundation_v2_') || k === 'contract_foundation_data') {
            keep[k] = Storage.prototype.getItem.call(localStorage, k);
        }
    }
    return keep;
}

function _buRestoreKeep(keep) {
    Object.entries(keep || {}).forEach(([k, v]) => { if (v !== null && v !== undefined) Storage.prototype.setItem.call(localStorage, k, v); });
}

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
    if (!fileNameDisplay) return;
    fileNameDisplay.textContent = input.files && input.files.length > 0 ? `الملف المختار: ${input.files[0].name}` : 'لم يتم اختيار أي ملف.';
}

function addLogEntry(operation, type, status) {
    try {
        const logs = JSON.parse(localStorage.getItem('backupLogs') || '[]');
        logs.unshift({ timestamp: new Date().toLocaleString('ar-EG'), operation, type, status });
        if (logs.length > 20) logs.pop();
        localStorage.setItem('backupLogs', JSON.stringify(logs));
        renderBackupLog();
    } catch (e) { console.error('فشل إضافة سجل:', e); }
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

function createSpecificBackup(backupType) {
    try {
        const backupObject = collectDataForBackup(backupType);
        if (Object.keys(backupObject.data.data).length === 0) {
            alert(`لا توجد بيانات لإنشاء نسخة احتياطية من نوع "${getSectionName(backupType)}".`);
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
        addLogEntry('إنشاء نسخة محلية', getSectionName(backupType), 'نجاح');
        alert(`تم إنشاء النسخة المحلية بنجاح.\nالملف: "${backupObject.filename}"`);
    } catch (error) {
        console.error(`خطأ في إنشاء النسخة (${backupType}):`, error);
        alert('حدث خطأ أثناء إنشاء النسخة الاحتياطية المحلية.');
        addLogEntry('إنشاء نسخة محلية', getSectionName(backupType), 'فشل');
    }
}

function collectDataForBackup(backupType) {
    const allData = {};
    const timestamp = new Date().toISOString().slice(0, 10);
    const hospitalName = JSON.parse(localStorage.getItem('persistentContractData') || '{}').hospitalName || localStorage.getItem('hospitalName') || 'النظام';

    if (backupType === 'full_system') {
        Object.keys(localStorage).forEach(key => {
            if (_buProtectedKey(key)) return;
            try { allData[key] = JSON.parse(localStorage.getItem(key)); }
            catch { allData[key] = localStorage.getItem(key); }
        });
        const filename = `نسخة_محلية_للمستخدم_${hospitalName.replace(/\s/g, '_')}_${timestamp}.json`;
        return { filename, data: { type: 'full_system', scope: 'local-user-browser', owner: _buOwner(), entityName: hospitalName, timestamp: new Date().toISOString(), data: allData } };
    }

    const SHARED_KEYS = ['persistentContractData', 'persistentExtractData', 'appTitles_v1'];
    const keyPatterns = {
        settings: [
            'persistentContractData', 'persistentExtractData', 'distributionSettings', 'performanceTableNames', 'performanceSignatures_v2',
            'contractData', 'contractDetails', 'contractNumber', 'contractType', 'contractStartDate', 'contractEndDate', 'contractSignatureData',
            'extractMonth', 'extractYear', 'extractNumber', 'extractStart', 'extractEnd', 'extractFromDate', 'extractToDate',
            'hospitalName', 'companyName', 'directPurchaseRatio', 'centerNames_v3', 'departmentNames', 'admin_staff',
            'adminOfficeNames_v1', 'appTitles_v1', 'settings_main', 'settings_advanced', 'dynamicSignatures', 'contractorSignature'
        ],
        main_hospital_attendance: [...SHARED_KEYS, 'attendanceData', 'performanceTotalDeduction', 'finalLaborCost', 'grand-net-total', 'performanceData', 'performanceSignatures', 'performanceTableNames', 'achievementData', 'achievementTitles_v1', 'najran_labor_attendance_done', 'najran_labor_performance_done', /^tableData_/, /^deptCalculatedCost_/, /^dept_/],
        main_hospital_consumables: [...SHARED_KEYS, /^main_hospital_consumables_/, /^sparePartsData_/, 'spare_partsData', 'subcontractors_data_consumables_v27', 'performance_data_consumables_v27', 'water_supply_data_consumables_v27', 'sewage_disposal_data_consumables_v27', 'summary_data_consumables_v27'],
        health_centers_attendance: [...SHARED_KEYS, 'centerNames_v3', 'centersAttendanceData_v2', 'healthCentersAttendanceData', 'performanceData_v4', 'performanceDeductions', 'grand-net-total', 'admin_staff', 'najran_health_attendance_done', /^table-/],
        health_centers_consumables: [...SHARED_KEYS, 'consumables_final_v1.0', /^subcontractors_data_consumables_final_/, /^performance_data_consumables_final_/, /^water_supply_data_consumables_final_/, /^laundry_supply_data_consumables_final_/, /^sewage_disposal_data_consumables_final_/, /^summary_data_consumables_final_/, /^signatures_data_consumables_final_/, /^print_titles_data_consumables_final_/, /^notes_data_consumables_final_/],
        admin_offices_attendance: [...SHARED_KEYS, 'adminOfficeNames_v1', 'adminOfficesAttendanceData_v1', 'performanceData_v4', 'performanceDeductions', 'grand-net-total', 'admin_staff', 'najran_admin_offices_attendance_done', /^table-/],
        admin_offices_consumables: [...SHARED_KEYS, 'admin_offices_consumables_v1.0', /^subcontractors_data_admin_offices_consumables_/, /^performance_data_admin_offices_consumables_/, /^water_supply_data_admin_offices_consumables_/, /^laundry_supply_data_admin_offices_consumables_/, /^sewage_disposal_data_admin_offices_consumables_/, /^summary_data_admin_offices_consumables_/, /^signatures_data_admin_offices_consumables_/, /^print_titles_data_admin_offices_consumables_/, /^notes_data_admin_offices_consumables_/]
    };

    const keysToCollect = keyPatterns[backupType] || [];
    keysToCollect.forEach(pattern => {
        const regex = typeof pattern === 'string' ? new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&')}$`) : pattern;
        Object.keys(localStorage).forEach(key => {
            if (_buProtectedKey(key)) return;
            if (regex.test(key)) {
                try { allData[key] = JSON.parse(localStorage.getItem(key)); }
                catch { allData[key] = localStorage.getItem(key); }
            }
        });
    });

    const filename = `نسخة_محلية_${getSectionName(backupType)}_${hospitalName.replace(/\s/g, '_')}_${timestamp}.json`;
    return { filename, data: { type: backupType, scope: 'local-user-browser', owner: _buOwner(), entityName: hospitalName, timestamp: new Date().toISOString(), data: allData } };
}

function confirmRestore() {
    const fileInput = document.getElementById('restore-file-input');
    if (!fileInput || !fileInput.files || !fileInput.files.length) {
        alert('يرجى اختيار ملف نسخة احتياطية أولاً.');
        return;
    }
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const backupWrapper = JSON.parse(event.target.result);
            if (!backupWrapper.data || !backupWrapper.timestamp) throw new Error('صيغة ملف النسخة الاحتياطية غير صحيحة أو قديمة.');
            if (backupWrapper.owner && !_buSameOwner(backupWrapper.owner)) {
                alert('تم إيقاف الاستعادة: هذه النسخة تخص مستخدمًا آخر.');
                return;
            }
            if (!backupWrapper.owner && !confirm('هذا ملف نسخة قديم لا يحتوي على هوية المستخدم. هل تريد المتابعة؟')) return;
            if (!confirm(`سيتم استعادة بيانات محلية للمستخدم الحالي فقط من الملف "${file.name}" مع الحفاظ على جلسة الدخول الحالية. هل تريد المتابعة؟`)) return;

            const keep = _buKeepBeforeRestore();
            const backupData = backupWrapper.data;
            localStorage.clear();
            _buRestoreKeep(keep);
            Object.keys(backupData).forEach(key => {
                if (key === 'owner' || key === 'scope') return;
                if (_buProtectedKey(key)) return;
                const value = backupData[key];
                if (value !== null && value !== undefined) localStorage.setItem(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
            });
            _buRestoreKeep(keep);
            addLogEntry('استعادة نسخة محلية', file.name, 'نجاح');
            alert('تمت استعادة بيانات المستخدم محليًا. سيتم إعادة تحميل الصفحة الآن.');
            setTimeout(() => window.location.reload(), 1000);
        } catch (error) {
            console.error('فشل الاستعادة:', error);
            alert(`فشل استعادة الملف: ${error.message}`);
            addLogEntry('استعادة نسخة محلية', file.name, 'فشل');
        }
    };
    reader.readAsText(file);
}

function getSectionName(type) {
    const names = {
        settings: 'الإعدادات',
        main_hospital_attendance: 'عمالة_المستشفى',
        main_hospital_consumables: 'مستهلكات_المستشفى',
        health_centers_attendance: 'عمالة_المراكز_الصحية',
        health_centers_consumables: 'مستهلكات_المراكز_الصحية',
        admin_offices_attendance: 'عمالة_المكاتب_الإدارية',
        admin_offices_consumables: 'مستهلكات_المكاتب_الإدارية',
        full_system: 'محلية_شاملة_للمستخدم'
    };
    return names[type] || type;
}

document.addEventListener('DOMContentLoaded', renderBackupLog);
