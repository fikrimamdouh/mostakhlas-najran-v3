/**
 * backup.js
 * النسخ المحلي من صفحة الإعدادات فقط.
 * نسخة متصفح للمستخدم الحالي، وليست النسخة المركزية الكاملة للنظام.
 * النسخة الشاملة المحلية تحفظ كل مفاتيح التشغيل الخاصة بالمستخدم/المستشفى من المتصفح:
 * العمالة، الحضور، الأداء، الإنجاز، المستهلكات، قطع الغيار، الإعدادات، التأسيسي، التواقيع، وأرشيف الشهور.
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
        hospitals: s.hospitals || null,
        company: s.company || s.companyName || localStorage.getItem('companyName') || null,
        createdAt: new Date().toISOString()
    };
}

function _buSameOwner(owner) {
    const s = _buSession();
    if (!owner || typeof owner !== 'object') return true;
    if (owner.userId != null && s.userId != null && String(owner.userId) !== String(s.userId)) return false;
    if (owner.email && s.email && String(owner.email).toLowerCase() !== String(s.email).toLowerCase()) return false;
    return true;
}

function _buProtectedKey(k) {
    return k === 'najran_session' ||
        k === '__clerk_db_jwt' ||
        k.indexOf('__clerk') === 0 ||
        k.indexOf('clerk_') === 0 ||
        k.indexOf('amplitude') === 0 ||
        k === 'loglevel';
}

function _buKeepAuthOnly() {
    const keep = {};
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && _buProtectedKey(k)) keep[k] = Storage.prototype.getItem.call(localStorage, k);
    }
    return keep;
}

function _buRestoreKeep(keep) {
    Object.entries(keep || {}).forEach(([k, v]) => { if (v !== null && v !== undefined) Storage.prototype.setItem.call(localStorage, k, v); });
}

function _buReadLocalValue(key) {
    try { return JSON.parse(localStorage.getItem(key)); }
    catch { return localStorage.getItem(key); }
}

function _buPutLocalValue(target, key) {
    if (!key || _buProtectedKey(key)) return;
    target[key] = _buReadLocalValue(key);
}

function _buBuildManifest(data) {
    const keys = Object.keys(data || {});
    const has = (re) => keys.some(k => re.test(k));
    return {
        totalKeys: keys.length,
        includesLaborAttendance: has(/attendance|Attendance|عمالة|labor|dept|department|admin_staff|centersAttendance/i),
        includesPerformance: has(/performance|Performance|deduction|Deduction|tableData_|deptCalculatedCost_/i),
        includesAchievement: has(/achievement|Achievement|إنجاز|انجاز/i),
        includesConsumables: has(/consumables|Consumables|mainHospitalConsumables|healthCentersConsumables|subcontractors|water_supply|sewage|summary_data|laundry_supply/i),
        includesSpareParts: has(/spare|Spare|parts|Parts|spare_parts|spareParts/i),
        includesSettings: has(/persistentContractData|persistentExtractData|hospitalName|companyName|contract|settings|signature|Signatures/i),
        includesFoundation: has(/contract_foundation|foundation/i),
        includesMonthArchive: has(/monthSnapshot_|monthly|archive/i)
    };
}

function _buPlainObject(v) {
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}

function _buLooksLikeLegacySectionedBackup(raw) {
    const d = _buPlainObject(raw && raw.data);
    if (!d || Object.keys(d).length === 0) return false;

    const hasOldSections =
        d.contract ||
        d.extract ||
        d.attendance ||
        d.performance ||
        d.achievement ||
        d.consumables ||
        d.spare_parts;

    const alreadyLocalStorageShape =
        d.persistentContractData ||
        d.persistentExtractData ||
        d.attendanceData ||
        d.adminOfficesAttendanceData_v1 ||
        d.healthCentersAttendanceData;

    return !!hasOldSections && !alreadyLocalStorageShape;
}

function _buLegacyRowsLookLikeSecurity(rows) {
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) return false;

    const hits = list.filter(function (emp) {
        const title = String((emp && emp.jobTitle) || '').trim();
        return /أمن|امن|سلامة|سلامه|حارس/i.test(title);
    }).length;

    return hits > 0 && hits >= Math.ceil(list.length / 2);
}

function _buNormalizeLegacyDeptKey(key, rows) {
    const oldKey = String(key || '').trim();

    // attendance_interactive_v9_corrected.js يقرأ attendanceData بمفاتيح underscore.
    // لا نحول civil_works/admin_saudi إلى hyphen.
    if (oldKey === 'civil_works' || oldKey === 'civil-works') return 'civil_works';
    if (oldKey === 'admin_saudi' || oldKey === 'admin-saudi') return 'admin_saudi';

    // بعض النسخ القديمة خزنت الأمن والسلامة داخل patient_services.
    if (oldKey === 'patient_services' || oldKey === 'patient-services') {
        return _buLegacyRowsLookLikeSecurity(rows) ? 'security' : 'patient_services';
    }

    return oldKey;
}

function _buNormalizeLegacyDays(days, fallbackLength) {
    const len = Math.max(1, Number(fallbackLength) || 30);
    const result = Array.isArray(days) ? days.slice(0, len) : [];

    while (result.length < len) result.push('ح');

    return result.map(function (d) {
        const v = String(d || '').trim();
        return v || 'ح';
    });
}

function _buNormalizeLegacyEmployee(emp, daysInExtract) {
    const e = Object.assign({}, _buPlainObject(emp));

    e.jobTitle = String(e.jobTitle || '').trim() || 'غير محدد';
    e.name = String(e.name || '').trim() || 'غير محدد';
    e.category = String(e.category || '7').trim();
    e.salary = Number(e.salary) || 0;
    e.nationality = String(e.nationality || 'غير سعودي').trim();
    e.nationalityFine = Number(e.nationalityFine) || 0;
    e.days = _buNormalizeLegacyDays(e.days, daysInExtract);

    // لا نعتمد على الحسابات القديمة نهائيًا.
    // الصفحات الحالية ستعيد الحساب بمنطقها الجديد.
    delete e.absenceDays;
    delete e.attendanceDays;
    delete e.deduction;
    delete e.absencePenalty;
    delete e.totalFine;
    delete e.netSalary;

    return e;
}

function _buConvertLegacySectionedBackup(raw) {
    const src = _buPlainObject(raw && raw.data);
    const out = {};

    const contract = Object.assign({}, _buPlainObject(src.contract));
    const extract = Object.assign({}, _buPlainObject(src.extract));

    if (Object.keys(contract).length > 0) {
        if (!contract.contractType) contract.contractType = 'عقد أساسي';
        if (contract.directPurchaseRatio == null) contract.directPurchaseRatio = '0';

        // مفتاح الميزة الجديدة.
        // الافتراضي apply حتى لا تتغير نتائج النسخ القديمة بدون اختيار صريح.
        if (!contract.directPurchaseAbsenceFineMode) {
            contract.directPurchaseAbsenceFineMode = 'apply';
        }

        out.persistentContractData = contract;
        out.hospitalName = contract.hospitalName || '';
        out.companyName = contract.companyName || '';
        out.contractType = contract.contractType || 'عقد أساسي';
        out.directPurchaseRatio = String(contract.directPurchaseRatio || '0');
        out.directPurchaseAbsenceFineMode = contract.directPurchaseAbsenceFineMode || 'apply';
    }

    if (Object.keys(extract).length > 0) {
        if (!extract.extractCalendar) extract.extractCalendar = 'ميلادي';

        // النسخ القديمة لا تحتوي رقم دفعة غالبًا.
        // نضيف قيمة آمنة حتى لا تكسر الصفحات الجديدة.
        if (!extract.paymentNumber && !extract.extractNumber) {
            extract.paymentNumber = '001';
            extract.extractNumber = '001';
        } else if (!extract.paymentNumber) {
            extract.paymentNumber = String(extract.extractNumber);
        } else if (!extract.extractNumber) {
            extract.extractNumber = String(extract.paymentNumber);
        }

        out.persistentExtractData = extract;
        out.extractCalendar = extract.extractCalendar || 'ميلادي';
        out.extractMonth = extract.extractMonth || '';
        out.extractYear = extract.extractYear || '';
        out.extractStart = extract.extractStart || '';
        out.extractEnd = extract.extractEnd || '';
        out.paymentNumber = String(extract.paymentNumber || '001');
        out.extractNumber = String(extract.extractNumber || extract.paymentNumber || '001');
    }

    const daysInExtract = (function () {
        try {
            if (extract.extractStart && extract.extractEnd) {
                const s = new Date(extract.extractStart);
                const e = new Date(extract.extractEnd);
                const n = Math.ceil((e.getTime() - s.getTime()) / 86400000) + 1;
                if (Number.isFinite(n) && n > 0) return n;
            }
        } catch (_) {}
        return 30;
    })();

    const legacyAttendance = _buPlainObject(src.attendance);
    const attendanceData = {};

    Object.keys(legacyAttendance).forEach(function (oldKey) {
        const rows = Array.isArray(legacyAttendance[oldKey]) ? legacyAttendance[oldKey] : [];
        const newKey = _buNormalizeLegacyDeptKey(oldKey, rows);
        const normalizedRows = rows.map(function (emp) {
            return _buNormalizeLegacyEmployee(emp, daysInExtract);
        });

        // لو أكثر من مفتاح قديم اتجمعوا تحت نفس المفتاح الجديد، لا نمسح السابق.
        attendanceData[newKey] = (attendanceData[newKey] || []).concat(normalizedRows);
    });

    if (Object.keys(attendanceData).length > 0) {
        out.attendanceData = attendanceData;
    }

    // أقسام قديمة اختيارية. لا نكسر لو كانت فاضية.
    if (src.performance && typeof src.performance === 'object' && Object.keys(src.performance).length > 0) {
        out.performanceData = src.performance;
    }

    if (src.achievement && typeof src.achievement === 'object' && Object.keys(src.achievement).length > 0) {
        out.achievementData = src.achievement;
    }

    if (src.consumables && typeof src.consumables === 'object' && Object.keys(src.consumables).length > 0) {
        out.mainHospitalConsumables = src.consumables;
    }

    if (src.spare_parts && typeof src.spare_parts === 'object' && Object.keys(src.spare_parts).length > 0) {
        out.spare_partsData = src.spare_parts;
    }

    return out;
}

function _buNormalizeIncomingBackup(raw) {
    if (!raw || typeof raw !== 'object') throw new Error('صيغة ملف النسخة غير صالحة.');
    if (raw.tables) throw new Error('هذا ملف نسخة مركزية من الإدارة، لا يستعاد من صفحة إعدادات المستخدم. استخدم /admin/backup.');
    if (_buLooksLikeLegacySectionedBackup(raw)) {
        const converted = _buConvertLegacySectionedBackup(raw);

        return {
            type: 'legacy_sectioned_backup_v1',
            scope: 'legacy-sectioned-safe-merge',
            owner: null,
            entityName:
                converted.persistentContractData?.hospitalName ||
                raw.data?.contract?.hospitalName ||
                null,
            timestamp: raw.timestamp || new Date().toISOString(),
            manifest: _buBuildManifest(converted),
            data: converted,
            replaceMode: false
        };
    }
    if (raw.data && typeof raw.data === 'object') {
        return {
            type: raw.type || 'local_wrapped',
            scope: raw.scope || 'local-user-browser-section',
            owner: raw.owner || null,
            entityName: raw.entityName || null,
            timestamp: raw.timestamp || new Date().toISOString(),
            manifest: raw.manifest || _buBuildManifest(raw.data),
            data: raw.data,
            replaceMode: raw.scope === 'local-user-browser-complete' || raw.type === 'user_hospital_complete' || raw.type === 'full_system'
        };
    }

    // دعم النسخ القديمة المسطحة التي تبدأ مباشرة بمفاتيح localStorage مثل persistentContractData / attendanceData.
    return {
        type: 'legacy_flat_local',
        scope: 'legacy-flat-merge',
        owner: null,
        entityName: raw.persistentContractData?.hospitalName || raw.hospitalName || null,
        timestamp: new Date().toISOString(),
        manifest: _buBuildManifest(raw),
        data: raw,
        replaceMode: false
    };
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
        const mf = backupObject.data.manifest || {};
        addLogEntry('إنشاء نسخة محلية', getSectionName(backupType), 'نجاح');
        alert(`تم إنشاء النسخة المحلية بنجاح.\nالملف: "${backupObject.filename}"\nعدد المفاتيح: ${mf.totalKeys || Object.keys(backupObject.data.data).length}`);
    } catch (error) {
        console.error(`خطأ في إنشاء النسخة (${backupType}):`, error);
        alert('حدث خطأ أثناء إنشاء النسخة الاحتياطية المحلية.');
        addLogEntry('إنشاء نسخة محلية', getSectionName(backupType), 'فشل');
    }
}

function collectDataForBackup(backupType) {
    const allData = {};
    const timestamp = new Date().toISOString().slice(0, 10);
    const contract = JSON.parse(localStorage.getItem('persistentContractData') || '{}');
    const hospitalName = contract.hospitalName || localStorage.getItem('hospitalName') || (_buOwner().hospital || 'النظام');

    if (backupType === 'full_system' || backupType === 'user_hospital_complete') {
        Object.keys(localStorage).forEach(key => _buPutLocalValue(allData, key));
        const filename = `نسخة_محلية_شاملة_للمستخدم_${hospitalName.replace(/\s/g, '_')}_${timestamp}.json`;
        return { filename, data: { type: 'user_hospital_complete', scope: 'local-user-browser-complete', owner: _buOwner(), entityName: hospitalName, timestamp: new Date().toISOString(), manifest: _buBuildManifest(allData), data: allData } };
    }

    const SHARED_KEYS = ['persistentContractData', 'persistentExtractData', 'appTitles_v1', 'hospitalName', 'companyName', 'contractNumber'];
    const keyPatterns = {
        settings: [...SHARED_KEYS, 'distributionSettings', 'performanceTableNames', 'performanceSignatures_v2', 'contractData', 'contractDetails', 'contractType', 'contractStartDate', 'contractEndDate', 'contractSignatureData', 'extractMonth', 'extractYear', 'extractNumber', 'extractStart', 'extractEnd', 'extractFromDate', 'extractToDate', 'directPurchaseRatio', 'centerNames_v3', 'departmentNames', 'admin_staff', 'adminOfficeNames_v1', 'settings_main', 'settings_advanced', 'dynamicSignatures', 'contractorSignature', /^contract_foundation/, /^sb_sigs_/, /^signatures?/i],
        main_hospital_attendance: [
            ...SHARED_KEYS,
            'attendanceData',
            'ng_attendanceData',
            'nd_attendanceData',
            'performanceTotalDeduction',
            'finalLaborCost',
            'grand-net-total',
            'grand-net-total-centers',
            'grand-net-total-admin',
            'performanceData',
            'performanceSignatures',
            'performanceTableNames',
            'achievementData',
            'achievementTitles_v1',
            'najran_labor_attendance_done',
            'najran_labor_performance_done',

            // تواقيع صفحة الحضور العادي + تفضيلات ظهور التوقيع والختم في الطباعة
            'sb_sigs_attendance',
            'sb_prefs_attendance',

            /^tableData_/,
            /^deptCalculatedCost_/,
            /^dept_/,
            /^ng_/,
            /^nd_/,
            /attendance/i,
            /labor/i,
            /employee/i,
            /staff/i
        ],
        main_hospital_consumables: [...SHARED_KEYS, /^main_hospital_consumables_/, /^sparePartsData_/, 'mainHospitalConsumables', 'spare_partsData', 'sparePartsTotalAmount', 'subcontractors_data_consumables_v27', 'performance_data_consumables_v27', 'water_supply_data_consumables_v27', 'sewage_disposal_data_consumables_v27', 'summary_data_consumables_v27', /^summary_data_consumables/, /^signatures_data_consumables/, /consumables/i, /subcontractors/i, /water_supply/i, /sewage/i, /laundry_supply/i],
        spare_parts: [...SHARED_KEYS, 'spare_partsData', 'sparePartsTotalAmount', /^sparePartsData_/, /^spare_parts/, /spare/i, /parts/i],
        health_centers_attendance: [...SHARED_KEYS, 'centerNames_v3', 'centersAttendanceData_v2', 'healthCentersAttendanceData', 'performanceData_v4', 'performanceDeductions', 'grand-net-total', 'admin_staff', 'najran_health_attendance_done', /^table-/, /healthCenters/i],
        health_centers_consumables: [...SHARED_KEYS, 'healthCentersConsumables', 'consumables_final_v1.0', /^subcontractors_data_consumables_final_/, /^performance_data_consumables_final_/, /^water_supply_data_consumables_final_/, /^laundry_supply_data_consumables_final_/, /^sewage_disposal_data_consumables_final_/, /^summary_data_consumables_final_/, /^signatures_data_consumables_final_/, /^print_titles_data_consumables_final_/, /^notes_data_consumables_final_/],
        admin_offices_attendance: [...SHARED_KEYS, 'adminOfficeNames_v1', 'adminOfficesAttendanceData_v1', 'performanceData_v4', 'performanceDeductions', 'grand-net-total', 'admin_staff', 'najran_admin_offices_attendance_done', /^table-/, /adminOffices/i],
        admin_offices_consumables: [...SHARED_KEYS, 'admin_offices_consumables_v1.0', /^subcontractors_data_admin_offices_consumables_/, /^performance_data_admin_offices_consumables_/, /^water_supply_data_admin_offices_consumables_/, /^laundry_supply_data_admin_offices_consumables_/, /^sewage_disposal_data_admin_offices_consumables_/, /^summary_data_admin_offices_consumables_/, /^signatures_data_admin_offices_consumables_/, /^print_titles_data_admin_offices_consumables_/, /^notes_data_admin_offices_consumables_/]
    };

    const keysToCollect = keyPatterns[backupType] || [];
    keysToCollect.forEach(pattern => {
        const regex = typeof pattern === 'string' ? new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&')}$`) : pattern;
        Object.keys(localStorage).forEach(key => { if (regex.test(key)) _buPutLocalValue(allData, key); });
    });

    const filename = `نسخة_محلية_${getSectionName(backupType)}_${hospitalName.replace(/\s/g, '_')}_${timestamp}.json`;
    return { filename, data: { type: backupType, scope: 'local-user-browser-section', owner: _buOwner(), entityName: hospitalName, timestamp: new Date().toISOString(), manifest: _buBuildManifest(allData), data: allData } };
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
            const raw = JSON.parse(event.target.result);
            const normalized = _buNormalizeIncomingBackup(raw);
            if (normalized.owner && !_buSameOwner(normalized.owner)) {
                alert('تم إيقاف الاستعادة: هذه النسخة تخص مستخدمًا آخر.');
                return;
            }
            if (!normalized.owner && !confirm('هذا ملف نسخة قديم/مسطح لا يحتوي على هوية المستخدم. سيتم دمجه بدون مسح البيانات الأخرى. هل تريد المتابعة؟')) return;

            const mf = normalized.manifest || _buBuildManifest(normalized.data || {});
            const modeText = normalized.replaceMode ? 'استبدال كامل للبيانات المحلية غير المحمية' : 'دمج آمن بدون مسح بيانات غير موجودة في الملف';
            const msg = [
                `سيتم استعادة بيانات محلية للمستخدم الحالي من الملف "${file.name}".`,
                `طريقة الاستعادة: ${modeText}`,
                `عدد المفاتيح داخل الملف: ${mf.totalKeys || Object.keys(normalized.data || {}).length}`,
                `العمالة/الحضور: ${mf.includesLaborAttendance ? 'نعم' : 'لا'}`,
                `الأداء: ${mf.includesPerformance ? 'نعم' : 'لا'}`,
                `الإنجاز: ${mf.includesAchievement ? 'نعم' : 'لا'}`,
                `المستهلكات: ${mf.includesConsumables ? 'نعم' : 'لا'}`,
                `قطع الغيار: ${mf.includesSpareParts ? 'نعم' : 'لا'}`,
                `الإعدادات/التواقيع: ${mf.includesSettings ? 'نعم' : 'لا'}`,
                'سيتم الحفاظ على جلسة الدخول الحالية. هل تريد المتابعة؟'
            ].join('\n');
            if (!confirm(msg)) return;

            const keep = _buKeepAuthOnly();
            const backupData = normalized.data || {};
            if (normalized.replaceMode) {
                localStorage.clear();
                _buRestoreKeep(keep);
            }
            Object.keys(backupData).forEach(key => {
                if (key === 'owner' || key === 'scope' || key === 'manifest') return;
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
        spare_parts: 'قطع_الغيار',
        health_centers_attendance: 'عمالة_المراكز_الصحية',
        health_centers_consumables: 'مستهلكات_المراكز_الصحية',
        admin_offices_attendance: 'عمالة_المكاتب_الإدارية',
        admin_offices_consumables: 'مستهلكات_المكاتب_الإدارية',
        full_system: 'محلية_شاملة_للمستخدم',
        user_hospital_complete: 'محلية_شاملة_للمستخدم'
    };
    return names[type] || type;
}

document.addEventListener('DOMContentLoaded', renderBackupLog);
