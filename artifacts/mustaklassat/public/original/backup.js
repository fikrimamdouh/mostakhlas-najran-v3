/**
 * ===================================================================
 *      ===>   ✅ نظام النسخ الاحتياطي والاستعادة (V15 - النهائي والموحد)   <===
 * ===================================================================
 * @description ملف JavaScript موحد يحتوي على كل ما يخص النسخ الاحتياطي والاستعادة.
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

// === 3. ✅✅✅ إنشاء النسخة الاحتياطية (الكود الصحيح) ✅✅✅ ===

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

        addLogEntry('إنشاء نسخة', getSectionName(backupType), 'نجاح');
        alert(`تم إنشاء النسخة الاحتياطية "${backupObject.filename}" بنجاح.`);

    } catch (error) {
        console.error(`خطأ في إنشاء النسخة (${backupType}):`, error);
        alert('حدث خطأ أثناء إنشاء النسخة الاحتياطية.');
        addLogEntry('إنشاء نسخة', getSectionName(backupType), 'فشل');
    }
}

// === 4. ✅✅✅ جمع البيانات (الكود الصحيح) ✅✅✅ ===

function collectDataForBackup(backupType) {
    const allData = {};
    const timestamp = new Date().toISOString().slice(0, 10);
    const hospitalName = JSON.parse(localStorage.getItem('persistentContractData') || '{}').hospitalName || 'النظام';

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

    // للحالات المخصصة
    const keyPatterns = {
        settings: ['persistentContractData', 'persistentExtractData', 'distributionSettings', 'performanceTableNames', 'performanceSignatures_v2'],
        main_hospital_attendance: ['attendanceData', 'performanceTotalDeduction', /^tableData_/],
        main_hospital_consumables: [/^main_hospital_consumables_/, /^sparePartsData_/],
    };

    const keysToCollect = keyPatterns[backupType] || [];
    keysToCollect.forEach(pattern => {
        const regex = (typeof pattern === 'string') ? new RegExp(`^${pattern}$`) : pattern;
        for (const key in localStorage) {
            if (regex.test(key)) {
                try { allData[key] = JSON.parse(localStorage.getItem(key)); } catch { allData[key] = localStorage.getItem(key); }
            }
        }
    });
    
    const filename = `نسخة_${getSectionName(backupType)}_${hospitalName.replace(/\s/g, '_')}_${timestamp}.json`;
    return { filename, data: { type: backupType, entityName: hospitalName, timestamp: new Date().toISOString(), data: allData } };
}

// === 5. ✅✅✅ استعادة النسخة الاحتياطية (الكود الصحيح) ✅✅✅ ===

function confirmRestore() {
    const fileInput = document.getElementById('restore-file-input');
    if (!fileInput.files.length) {
        alert('يرجى اختيار ملف نسخة احتياطية أولاً.');
        return;
    }
    const file = fileInput.files[0];

    if (!confirm(`هل أنت متأكد من استعادة البيانات من الملف "${file.name}"؟ سيتم الكتابة فوق كل البيانات الحالية.`)) {
        return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const backupWrapper = JSON.parse(event.target.result);
            
            // التحقق من بنية الملف الجديدة
            if (!backupWrapper.data || !backupWrapper.timestamp) {
                throw new Error('صيغة ملف النسخة الاحتياطية غير صحيحة أو قديمة.');
            }
            
            const backupData = backupWrapper.data; // البيانات الفعلية موجودة هنا

            localStorage.clear(); // امسح الذاكرة الحالية بالكامل
            
            for (const key in backupData) {
                if (Object.prototype.hasOwnProperty.call(backupData, key)) {
                    const value = backupData[key];
                    if (value !== null && value !== undefined) {
                        localStorage.setItem(key, typeof value === 'object' ? JSON.stringify(value) : value);
                    }
                }
            }
            
            addLogEntry('استعادة نسخة', file.name, 'نجاح');
            alert('تمت استعادة البيانات بنجاح! سيتم إعادة تحميل الصفحة الآن.');
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
        settings: 'الإعدادات',
        main_hospital_attendance: 'عمالة وأداء المستشفى',
        main_hospital_consumables: 'مستهلكات المستشفى',
        full_system: 'شاملة'
    };
    return names[type] || type;
}

// === 7. تشغيل عند تحميل الصفحة ===
document.addEventListener('DOMContentLoaded', renderBackupLog);
