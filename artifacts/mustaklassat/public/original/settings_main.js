// ✅ 4. أضف هذه الدوال الفارغة لمنع الأخطاء
function showPasswordPrompt(sectionId) {
    const prompt = document.getElementById(`${sectionId}-password-prompt`);
    if (prompt) prompt.style.display = 'block';
}

function openBackupRestoreModal() {
    const modal = document.getElementById('backup-restore-modal');
    if (modal) modal.style.display = 'flex';
}

// ✅✅✅ استبدل الدالة القديمة بهذه الدالة الكاملة ✅✅✅
function createSpecificBackup(type) {
    console.log(`بدء إنشاء نسخة احتياطية من نوع: ${type}`);
    let dataToBackup = {};
    let fileName = `backup_${type}_${new Date().toISOString().slice(0, 10)}.json`;

    // 1. تجميع البيانات بناءً على النوع المطلوب
    if (type === 'settings' || type === 'full_system') {
        dataToBackup.persistentContractData = JSON.parse(localStorage.getItem('persistentContractData') || '{}');
        dataToBackup.persistentExtractData = JSON.parse(localStorage.getItem('persistentExtractData') || '{}');
    }
    if (type.includes('attendance') || type === 'full_system') {
        // هذا يجمع كل بيانات الحضور من كل الصفحات (إذا كانت موجودة)
        // تأكد من أن المفاتيح صحيحة
        dataToBackup.attendanceData = JSON.parse(localStorage.getItem('attendanceData') || '{}');
        dataToBackup.healthCentersAttendanceData = JSON.parse(localStorage.getItem('healthCentersAttendanceData') || '{}');
    }
    if (type.includes('consumables') || type === 'full_system') {
        // هذا يجمع بيانات المستهلكات
        dataToBackup.mainHospitalConsumables = JSON.parse(localStorage.getItem('mainHospitalConsumables') || '{}');
        dataToBackup.healthCentersConsumables = JSON.parse(localStorage.getItem('healthCentersConsumables') || '{}');
    }
    // يمكنك إضافة المزيد من الشروط هنا لأنواع أخرى

    // 2. تحويل البيانات إلى نص JSON منسق
    const jsonString = JSON.stringify(dataToBackup, null, 2);

    // 3. إنشاء رابط وهمي وتنزيل الملف
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`تم إنشاء وتنزيل الملف: ${fileName}`);
    alert(`تم إنشاء النسخة الاحتياطية "${fileName}" بنجاح.`);
}
// settings_main.js
// تحديث التاريخ والوقت
function updateDateTime() {
    const now = new Date();
    document.getElementById('current-date-time').textContent = now.toLocaleDateString('ar-SA', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

// التنقل بين الصفحات
function navigateTo(page) {
    const pageUrls = {
        'index.html': 'index.html',
        'attendance.html': 'attendance.html',
        'performance.html': 'performance.html',
        'achievement.html': 'achievement.html',
        'consumables.html': 'consumables.html',
        'spare_parts.html': 'spare_parts.html',
        'settings_main.html': 'settings_main.html'
    };

    if (page && pageUrls[page]) {
        window.location.href = pageUrls[page];
    }
}

// إظهار/إخفاء قسم الشراء المباشر
function toggleDirectPurchase() {
    const contractType = document.getElementById('contract-type').value;
    document.getElementById('direct-purchase-section').style.display = contractType === 'شراء مباشر' ? 'block' : 'none';
}

// إظهار قسم معين
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
        section.querySelectorAll('.section-content').forEach(content => {
            content.style.display = 'none';
        });
    });
    document.querySelectorAll('.tabs a').forEach(tab => tab.classList.remove('active'));
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.add('active');
        if (sectionId === 'contract') {
            document.querySelector('#contract #contract-data').style.display = 'block';
            updateContractDisplayData(); // تحديث بيانات العقد عند إظهار القسم
        }
    }
    const tab = document.querySelector(`.tabs a[href="#${sectionId}"]`);
    if (tab) {
        tab.classList.add('active');
    }
}

// التحقق من صحة بيانات العقد
function validateContractData(data) {
    if (!data.hospitalName) return 'اسم المستشفى مطلوب!';
    if (!data.companyName) return 'اسم الشركة مطلوب!';
    if (data.contractType === 'شراء مباشر' && (!data.directPurchaseRatio || data.directPurchaseRatio <= 0)) {
        return 'نسبة الشراء المباشر يجب أن تكون أكبر من 0!';
    }
    return null;
}

// التحقق من صحة بيانات المستخلص
function validateExtractData(data) {
    if (!data.extractStart) return 'تاريخ بداية المستخلص مطلوب!';
    if (!data.extractEnd) return 'تاريخ نهاية المستخلص مطلوب!';
    const contractData = JSON.parse(localStorage.getItem('persistentContractData') || '{}');
    if (contractData.startDate && contractData.endDate) {
        const extractStart = new Date(data.extractStart);
        const extractEnd = new Date(data.extractEnd);
        const contractStart = new Date(contractData.startDate);
        const contractEnd = new Date(contractData.endDate);
        if (extractStart < contractStart || extractEnd > contractEnd) {
            return 'تواريخ المستخلص يجب أن تكون ضمن فترة العقد!';
        }
    }
    return null;
}


// التحقق من صحة إعدادات النظام

// التحقق من صحة إعدادات النسخ الاحتياطي
function validateBackupData(data) {
    if (!data.frequency) return 'تكرار النسخ الاحتياطي مطلوب!';
    if (!data.location) return 'موقع النسخ الاحتياطي مطلوب!';
    return null;
}

// حساب المدة بالأيام
function calculateExtractDurationDays() {
    const startDate = document.getElementById('extract-start').value;
    const endDate = document.getElementById('extract-end').value;
    const durationSpan = document.getElementById('extract-duration-days');
    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        durationSpan.textContent = `${diffDays} أيام`;
    } else {
        durationSpan.textContent = '0 أيام';
    }
}

// حفظ تواريخ المستخلص فوراً عند تغييرها
function saveExtractDatesOnly() {
    try {
        const current = JSON.parse(localStorage.getItem('persistentExtractData') || '{}');
        const startVal = document.getElementById('extract-start')?.value || '';
        const endVal   = document.getElementById('extract-end')?.value   || '';
        if (startVal) current.extractStart = startVal;
        if (endVal)   current.extractEnd   = endVal;
        localStorage.setItem('persistentExtractData', JSON.stringify(current));
    } catch(e) {}
}

// حفظ بيانات قسم معين
// ✅✅✅ الكود الجديد لدالة saveSectionData ✅✅✅
// ✅ 2. استبدل هذه الدالة
function saveSectionData(sectionId, data, successMessageId) {
    try {
        const successMsg = document.getElementById(successMessageId);
        if(successMsg) {
            successMsg.style.display = 'block';
            setTimeout(() => { successMsg.style.display = 'none'; }, 3000);
        }
        // العودة إلى وضع القراءة فقط بعد الحفظ
        toggleFields(sectionId, false);
    } catch (error) {
        console.error(`Error saving ${sectionId} data:`, error);
        alert('حدث خطأ أثناء حفظ البيانات!');
    }
}

// مسح بيانات قسم
// ✅✅✅ ضع هذه الدالة الجديدة مكان القديمة ✅✅✅
function clearSectionData(sectionId) {
    // تأكيد من المستخدم قبل الحذف
    if (!confirm(`هل أنت متأكد من مسح بيانات "${sectionId}"؟ لا يمكن التراجع عن هذا الإجراء.`)) {
        return;
    }

    const key = `persistent${sectionId.charAt(0).toUpperCase() + sectionId.slice(1)}Data`;
    localStorage.removeItem(key);
    
    // تحديث الواجهة بعد الحذف
    if (sectionId === 'contract') {
        updateContractDisplayData();
        updateMainHospitalName(); // تحديث اسم المستشفى أيضًا
    } else if (sectionId === 'extract') {
        updateExtractDisplayData();
    }
    
    alert(`تم مسح بيانات "${sectionId}" بنجاح.`);
}

// إلغاء تعديلات قسم
// دالة إلغاء التعديلات (صحيحة كما هي)
function cancelSection(sectionId) {
    loadPersistentData(); // إعادة تحميل البيانات المحفوظة
    toggleFields(sectionId, false); // العودة لوضع القراءة وإخفاء الأزرار
}

// التحقق من كلمة المرور
function verifyPassword(sectionId) {
    const passwordInput = document.getElementById(`${sectionId}-password-input`).value;
    const correctPassword = 'admin123';
    if (passwordInput === correctPassword) {
        toggleFields(sectionId, true);
        closePasswordPrompt(sectionId);
    } else {
        alert('كلمة المرور غير صحيحة!');
    }
}

// فتح/قفل الحقول
// ✅✅✅ الكود الجديد لدالة toggleFields ✅✅✅
// ✅ 1. استبدل هذه الدالة بالكامل
// ✅✅✅ الحل النهائي: استبدل دالة toggleFields بالكامل بهذا الكود ✅✅✅
function toggleFields(sectionId, enable) {
    const sectionElement = document.getElementById(sectionId);
    if (!sectionElement) return;

    // 1. التحكم في جميع حقول الإدخال داخل القسم
    sectionElement.querySelectorAll('input, select, textarea').forEach(element => {
        if (element.type === 'file' || element.id.includes('password-input')) return;
        if (enable) {
            element.removeAttribute('readonly');
            element.removeAttribute('disabled');
        } else {
            element.setAttribute('readonly', 'readonly');
            if (element.tagName === 'SELECT' || element.type === 'checkbox' || element.type === 'radio') {
                element.setAttribute('disabled', 'disabled');
            }
        }
    });

    // 2. التحكم في جميع مجموعات الأزرار داخل القسم (هذا هو الإصلاح)
    const allButtonContainers = sectionElement.querySelectorAll('.buttons.single-row');
    
    allButtonContainers.forEach(buttonsContainer => {
        const saveBtn = buttonsContainer.querySelector('.btn-save');
        const cancelBtn = buttonsContainer.querySelector('.btn-cancel');
        const editBtn = buttonsContainer.querySelector('.btn-edit');
        const clearBtn = buttonsContainer.querySelector('.btn-clear');

        if (enable) { // وضع التعديل
            if (saveBtn) saveBtn.style.display = 'inline-block';
            if (cancelBtn) cancelBtn.style.display = 'inline-block';
            if (editBtn) editBtn.style.display = 'none';
            if (clearBtn) clearBtn.style.display = 'none';
        } else { // وضع القراءة
            if (saveBtn) saveBtn.style.display = 'none';
            if (cancelBtn) cancelBtn.style.display = 'none';
            if (editBtn) editBtn.style.display = 'inline-block';
            if (clearBtn) clearBtn.style.display = 'inline-block';
        }
    });
}

// حفظ بيانات العقد
// ✅✅✅ الحل النهائي والمؤكد لدالة saveContractData ✅✅✅
function saveContractData() {
    try {
        // الخطوة 1: تحميل البيانات القديمة كقاعدة أساس
        const oldData = JSON.parse(localStorage.getItem('persistentContractData') || '{}');

        // الخطوة 2: إنشاء كائن بيانات جديد وتحديثه من كل الحقول
        const newData = {
            ...oldData, // الأهم: نبدأ بالبيانات القديمة للحفاظ على الختم لو لم يتغير
            hospitalName: document.getElementById('hospital-name')?.value || '',
            contractDetails: document.getElementById('contract-details')?.value || '',
            companyName: document.getElementById('company-name')?.value || '',
            contractType: document.getElementById('contract-type')?.value || 'عقد أساسي',
            directPurchaseRatio: document.getElementById('direct-purchase-ratio')?.value || '0',
            startDate: document.getElementById('contract-start-date')?.value || '',
            endDate: document.getElementById('contract-end-date')?.value || '',
            contractValue: document.getElementById('contract-value')?.value || '',
            contractStatus: document.getElementById('contract-status')?.value || 'نشط',
            notes: document.getElementById('contract-notes')?.value || '',
            projectManager: document.getElementById('project-manager-name')?.value || '',
            maintenanceHead: document.getElementById('maintenance-head-name')?.value || '',
            operationsAssistant: document.getElementById('operations-assistant-name')?.value || '',
            engineeringManager: document.getElementById('engineering-manager-name')?.value || '',
            financialManager: document.getElementById('financial-manager-name')?.value || '',
            hospitalManager: document.getElementById('hospital-manager-name')?.value || '',
            contractorRepresentative: document.getElementById('contractor-representative-name')?.value || '',
            hospitalAccountant: document.getElementById('hospital-accountant-name')?.value || '',
            assistantManager: document.getElementById('assistant-manager-name')?.value || '',
            siteRepresentative: document.getElementById('site-representative-name')?.value || '',
            engineeringAffairsManager: document.getElementById('engineering-affairs-manager-name')?.value || '',
            generalServicesManager: document.getElementById('general-services-manager-name')?.value || '',
            followUpManager: document.getElementById('follow-up-manager-name')?.value || '',
            projectManagerPhone: document.getElementById('project-manager-phone')?.value || '',
            projectManagerEmail: document.getElementById('project-manager-email')?.value || '',
            maintenanceHeadPhone: document.getElementById('maintenance-head-phone')?.value || '',
            maintenanceHeadEmail: document.getElementById('maintenance-head-email')?.value || '',
            operationsAssistantPhone: document.getElementById('operations-assistant-phone')?.value || '',
            operationsAssistantEmail: document.getElementById('operations-assistant-email')?.value || '',
            engineeringManagerPhone: document.getElementById('engineering-manager-phone')?.value || '',
            engineeringManagerEmail: document.getElementById('engineering-manager-email')?.value || '',
            financialManagerPhone: document.getElementById('financial-manager-phone')?.value || '',
            financialManagerEmail: document.getElementById('financial-manager-email')?.value || '',
            hospitalManagerPhone: document.getElementById('hospital-manager-phone')?.value || '',
            hospitalManagerEmail: document.getElementById('hospital-manager-email')?.value || '',
            contractorRepresentativePhone: document.getElementById('contractor-representative-phone')?.value || '',
            contractorRepresentativeEmail: document.getElementById('contractor-representative-email')?.value || '',
            hospitalAccountantPhone: document.getElementById('hospital-accountant-phone')?.value || '',
            hospitalAccountantEmail: document.getElementById('hospital-accountant-email')?.value || '',
            assistantManagerPhone: document.getElementById('assistant-manager-phone')?.value || '',
            assistantManagerEmail: document.getElementById('assistant-manager-email')?.value || '',
            siteRepresentativePhone: document.getElementById('site-representative-phone')?.value || '',
            siteRepresentativeEmail: document.getElementById('site-representative-email')?.value || '',
            engineeringAffairsManagerPhone: document.getElementById('engineering-affairs-manager-phone')?.value || '',
            engineeringAffairsManagerEmail: document.getElementById('engineering-affairs-manager-email')?.value || '',
            generalServicesManagerPhone: document.getElementById('general-services-manager-phone')?.value || '',
            generalServicesManagerEmail: document.getElementById('general-services-manager-email')?.value || '',
            followUpManagerPhone: document.getElementById('follow-up-manager-phone')?.value || '',
            followUpManagerEmail: document.getElementById('follow-up-manager-email')?.value || ''
        };
        // إذا المستخدم حفظ تفاصيل عقد مختلفة عن الافتراضي، احترم تعديله لاحقاً
        const fixedForHospital = HOSPITAL_CONTRACT_MAP[newData.hospitalName];
        if (fixedForHospital && newData.contractDetails && newData.contractDetails !== fixedForHospital.contractDetails) {
            newData._manualContractDetails = true;
        } else if (fixedForHospital && newData.contractDetails === fixedForHospital.contractDetails) {
            newData._manualContractDetails = false;
        }
const defaultCompanyForHospital =
    (fixedForHospital && fixedForHospital.companyName) ||
    HOSPITAL_COMPANY_MAP[newData.hospitalName] ||
    '';

if (defaultCompanyForHospital && newData.companyName && newData.companyName !== defaultCompanyForHospital) {
    newData._manualCompanyName = true;
} else if (defaultCompanyForHospital && newData.companyName === defaultCompanyForHospital) {
    newData._manualCompanyName = false;
}
    if (newData.hospitalName && newData._manualCompanyName) {
    localStorage.setItem(_manualCompanyKey(newData.hospitalName), newData.companyName || '');
} else if (newData.hospitalName && newData._manualCompanyName === false) {
    localStorage.removeItem(_manualCompanyKey(newData.hospitalName));
}
        newData._autoHospitalName = newData.hospitalName || '';
        // التحقق من صحة البيانات
        const validationError = validateContractData(newData);
        if (validationError) {
            alert(validationError);
            return;
        }

        // دالة الحفظ النهائية (سنستدعيها في كل الحالات)
       const finalizeSave = async (finalData) => {
    try {
        // 1. الحفظ المحلي الأساسي
        localStorage.setItem('persistentContractData', JSON.stringify(finalData));

        // 2. حفظ مفاتيح مختصرة تقرأها باقي الصفحات كـ fallback
        localStorage.setItem('hospitalName', finalData.hospitalName || '');
        localStorage.setItem('companyName', finalData.companyName || '');
        localStorage.setItem('contractNumber', finalData.contractNumber || '');
        localStorage.setItem('contractDetails', finalData.contractDetails || '');

        // 3. إرسال إشعار لباقي الصفحات
        window.dispatchEvent(new StorageEvent('storage', {
            key: 'persistentContractData',
            newValue: JSON.stringify(finalData)
        }));

        // 4. تحديث الواجهة محليًا
        updateContractDisplayData();
        updateMainHospitalName();

        // 5. رفع فوري للسحابة وانتظار النتيجة قبل رسالة النجاح
        if (typeof window.najranSyncNow === 'function') {
            await window.najranSyncNow();
        }

        // 6. إغلاق وضع التعديل بعد نجاح الحفظ
        saveSectionData('contract', finalData, 'contract-save-success');

        alert('تم حفظ البيانات ورفعها بنجاح.');
    } catch (error) {
        console.error('فشل حفظ/رفع بيانات العقد:', error);
        alert('تم الحفظ محليًا، لكن فشل الرفع السحابي. لا تغادر الصفحة قبل إعادة المحاولة.');
    }
};
        // التعامل مع ملف الختم
        const fileInput = document.getElementById('hospital-stamp');
        if (fileInput && fileInput.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                newData.hospitalStamp = e.target.result; // أضف الختم الجديد للبيانات
                finalizeSave(newData); // استدعاء دالة الحفظ النهائية بعد قراءة الملف
            };
            reader.readAsDataURL(fileInput.files[0]);
        } else {
            // إذا لم يتم اختيار ملف جديد، احفظ البيانات كما هي (مع الختم القديم إن وجد)
            finalizeSave(newData);
        }

    } catch (error) {
        console.error("خطأ فادح في saveContractData:", error);
        alert("حدث خطأ أثناء محاولة حفظ البيانات. راجع الـ console.");
    }
}

var _updateContractDisplayRunning = false;

// تحديث عرض بيانات العقد
function updateContractDisplayData() {
    if (_updateContractDisplayRunning) return;
    _updateContractDisplayRunning = true;

    try {
        const data = JSON.parse(localStorage.getItem('persistentContractData') || '{}');
        const session = (typeof _getSession === 'function') ? _getSession() : null;
        const manualCompanyName = _getManualCompanyName(
            data.hospitalName ||
            localStorage.getItem('hospitalName') ||
            (session && session.hospital) ||
            ''
        );

if (manualCompanyName) {
    data.companyName = manualCompanyName;
    data._manualCompanyName = true;
    localStorage.setItem('persistentContractData', JSON.stringify(data));
    localStorage.setItem('companyName', data.companyName || '');
}
    if (!data.hospitalName) {
        data.hospitalName = localStorage.getItem('hospitalName') || (session && session.hospital) || '';
    }

    if (!data.companyName) {
        data.companyName =
            localStorage.getItem('companyName') ||
            (session && session.companyName) ||
            _resolveCompanyName(session, data.hospitalName) ||
            '';
    }

    if (!data.contractNumber) {
        data.contractNumber = localStorage.getItem('contractNumber') || (session && session.contractNumber) || '';
    }

    if (!data.contractDetails) {
        data.contractDetails = localStorage.getItem('contractDetails') || '';
    }

    if (data.hospitalName && HOSPITAL_CONTRACT_MAP[data.hospitalName]) {
        var before = JSON.stringify(data);
        _applyFixedContractData(data, data.hospitalName, false);
        if (JSON.stringify(data) !== before) {
            localStorage.setItem('persistentContractData', JSON.stringify(data));
            localStorage.setItem('hospitalName', data.hospitalName);
            localStorage.setItem('companyName', data.companyName || '');
            localStorage.setItem('contractNumber', data.contractNumber || '');
            localStorage.setItem('contractDetails', data.contractDetails || '');
        }
    }
    document.getElementById('hospital-name').value = data.hospitalName || '';
    document.getElementById('contract-details').value = data.contractDetails || '';
    document.getElementById('company-name').value = data.companyName || '';
    document.getElementById('contract-type').value = data.contractType || 'عقد أساسي';
    document.getElementById('direct-purchase-ratio').value = data.directPurchaseRatio || '0';
    document.getElementById('contract-start-date').value = data.startDate || '';
    document.getElementById('contract-end-date').value = data.endDate || '';
    document.getElementById('contract-value').value = data.contractValue || '';
    document.getElementById('contract-status').value = data.contractStatus || 'نشط';
    document.getElementById('contract-notes').value = data.notes || '';
    document.getElementById('project-manager-name').value = data.projectManager || '';
    document.getElementById('maintenance-head-name').value = data.maintenanceHead || '';
    document.getElementById('operations-assistant-name').value = data.operationsAssistant || '';
    document.getElementById('engineering-manager-name').value = data.engineeringManager || '';
    document.getElementById('financial-manager-name').value = data.financialManager || '';
    document.getElementById('hospital-manager-name').value = data.hospitalManager || '';
    document.getElementById('contractor-representative-name').value = data.contractorRepresentative || '';
    document.getElementById('hospital-accountant-name').value = data.hospitalAccountant || '';
    document.getElementById('assistant-manager-name').value = data.assistantManager || '';
    document.getElementById('site-representative-name').value = data.siteRepresentative || '';
    document.getElementById('engineering-affairs-manager-name').value = data.engineeringAffairsManager || '';
    document.getElementById('general-services-manager-name').value = data.generalServicesManager || '';
    document.getElementById('follow-up-manager-name').value = data.followUpManager || '';
    document.getElementById('project-manager-phone').value = data.projectManagerPhone || '';
    document.getElementById('project-manager-email').value = data.projectManagerEmail || '';
    document.getElementById('maintenance-head-phone').value = data.maintenanceHeadPhone || '';
    document.getElementById('maintenance-head-email').value = data.maintenanceHeadEmail || '';
    document.getElementById('operations-assistant-phone').value = data.operationsAssistantPhone || '';
    document.getElementById('operations-assistant-email').value = data.operationsAssistantEmail || '';
    document.getElementById('engineering-manager-phone').value = data.engineeringManagerPhone || '';
    document.getElementById('engineering-manager-email').value = data.engineeringManagerEmail || '';
    document.getElementById('financial-manager-phone').value = data.financialManagerPhone || '';
    document.getElementById('financial-manager-email').value = data.financialManagerEmail || '';
    document.getElementById('hospital-manager-phone').value = data.hospitalManagerPhone || '';
    document.getElementById('hospital-manager-email').value = data.hospitalManagerEmail || '';
    document.getElementById('contractor-representative-phone').value = data.contractorRepresentativePhone || '';
    document.getElementById('contractor-representative-email').value = data.contractorRepresentativeEmail || '';
    document.getElementById('hospital-accountant-phone').value = data.hospitalAccountantPhone || '';
    document.getElementById('hospital-accountant-email').value = data.hospitalAccountantEmail || '';
    document.getElementById('assistant-manager-phone').value = data.assistantManagerPhone || '';
    document.getElementById('assistant-manager-email').value = data.assistantManagerEmail || '';
    document.getElementById('site-representative-phone').value = data.siteRepresentativePhone || '';
    document.getElementById('site-representative-email').value = data.siteRepresentativeEmail || '';
    document.getElementById('engineering-affairs-manager-phone').value = data.engineeringAffairsManagerPhone || '';
    document.getElementById('engineering-affairs-manager-email').value = data.engineeringAffairsManagerEmail || '';
    document.getElementById('general-services-manager-phone').value = data.generalServicesManagerPhone || '';
    document.getElementById('general-services-manager-email').value = data.generalServicesManagerEmail || '';
    document.getElementById('follow-up-manager-phone').value = data.followUpManagerPhone || '';
    document.getElementById('follow-up-manager-email').value = data.followUpManagerEmail || '';
    const fileStatus = document.querySelector('.file-status');
    if (fileStatus) {
        fileStatus.textContent = data.hospitalStamp ? 'تم اختيار ملف' : 'لم يتم اختيار أي ملف';
    }
    // عرض صورة التوقيع إذا وجدت
    const stampImage = document.getElementById('hospital-stamp-preview');
    if (stampImage && data.hospitalStamp) {
        stampImage.src = data.hospitalStamp;
        stampImage.style.display = 'block';
    } else if (stampImage) {
        stampImage.style.display = 'none';
    }

    } finally {
        _updateContractDisplayRunning = false;
    }
}

// جمع بيانات كل الأقسام
// إنشاء نسخة احتياطية

// تأكيد إنشاء النسخة

// إظهار نافذة النسخ

// إظهار نافذة الاستعادة

// إغلاق النافذة
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// التحكم في اختيار "كل البرنامج"

// تحميل تفاصيل النسخة

// تأكيد الاستعادة

// تصدير البيانات

// استيراد البيانات

// تحديث سجل التصدير/الاستيراد

// حفظ بيانات المستخدمين

// حفظ إعدادات النظام

// مسح إعدادات النظام

// استعادة الإعدادات الافتراضية للنظام
// تحديث بيانات المستخلص
function updateExtractDisplayData() {
    const data = JSON.parse(localStorage.getItem('persistentExtractData') || '{}');
    const now = new Date();
    const months = [
        'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
        'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];

    document.getElementById('extract-calendar').value = data.extractCalendar || 'ميلادي';
    document.getElementById('extract-month').value = data.extractMonth || months[now.getMonth()];
    document.getElementById('extract-year').value = data.extractYear || now.getFullYear();
    const pnEl = document.getElementById('payment-number');
    if (pnEl) pnEl.value = data.paymentNumber || '';
    document.getElementById('extract-final').checked = data.extractFinal || false;
    document.getElementById('extract-start').value = data.extractStart || '';
    document.getElementById('extract-end').value = data.extractEnd || '';
    document.getElementById('extract-duration').value = data.extractDuration || 'شهر واحد';

    calculateExtractDurationDays();
}

// تحديث بيانات المستخدمين

// حذف مستخدم

// تحديث إعدادات النظام

// النسخ الأوتوماتيكي
function scheduleBackup() {
    const frequency = document.getElementById('backup-frequency')?.value;
    const backupTime = document.getElementById('backup-time')?.value;

    if (frequency !== 'يومي' || !backupTime) return;

    setInterval(() => {
        const now = new Date();
        const [hours, minutes] = backupTime.split(':');
        if (now.getHours() === parseInt(hours) && now.getMinutes() === parseInt(minutes)) {
            createBackup(['all']);
        }
    }, 60000);
}

// تحميل البيانات المحفوظة
// ✅✅✅ ضع هذه الدالة الجديدة مكان القديمة ✅✅✅
function loadPersistentData() {
    updateContractDisplayData();
    updateExtractDisplayData();
    // لا حاجة لتحديث الأقسام المحذوفة
}

// إضافة مستمع أحداث لتحديث المدة تلقائيًا
function setupExtractDateListeners() {
    const startDateInput = document.getElementById('extract-start');
    const endDateInput = document.getElementById('extract-end');
    if (startDateInput && endDateInput) {
        startDateInput.addEventListener('change', function() {
            calculateExtractDurationDays();
            saveExtractDatesOnly();
        });
        endDateInput.addEventListener('change', function() {
            calculateExtractDurationDays();
            saveExtractDatesOnly();
        });
    }
}

// ✅✅✅ أضف هذه الدالة لحل المشكلة ✅✅✅
function closePasswordPrompt(sectionId) {
    const prompt = document.getElementById(`${sectionId}-password-prompt`);
    if (prompt) {
        prompt.style.display = 'none';
        // تفريغ حقل كلمة المرور بعد الإغلاق للأمان
        const passwordInput = document.getElementById(`${sectionId}-password-input`);
        if (passwordInput) {
            passwordInput.value = '';
        }
    }
}

// التحكم في الطي/الفتح
function toggleSection(sectionId, event) {
    if (event) {
        event.stopPropagation();
    }
    console.log(`Attempting to toggle section: ${sectionId}`);
    let section;
    if (sectionId === 'contract-data') {
        section = document.querySelector('#contract #contract-data');
    } else {
        section = document.getElementById(sectionId);
    }
    if (section) {
        section.style.display = section.style.display === 'none' ? 'block' : 'none';
        console.log(`New display for ${sectionId}: ${section.style.display}`);
    } else {
        console.error(`Section with ID ${sectionId} not found`);
    }
}

// تحديث سجل النسخ
function updateBackupLog(filename, sections, timestamp, status) {
    const logTable = document.querySelector('#backup-log-table tbody');
    if (logTable) {
        const correctedTimestamp = timestamp.replace(/(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3}Z)/, '$1T$2:$3:$4.$5');
        const date = new Date(correctedTimestamp);

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${filename}</td>
            <td>${sections}</td>
            <td>${date.toLocaleDateString('ar-SA')}</td>
            <td>${date.toLocaleTimeString('ar-SA')}</td>
            <td>${status}</td>
            <td>
                <button class="button btn-restore" onclick="showRestoreModal()"><i class="fas fa-undo"></i> استعادة</button>
                <button class="button btn-delete" onclick="deleteBackup('${filename}')"><i class="fas fa-trash"></i> حذف</button>
            </td>
        `;
        logTable.prepend(row);
    } else {
        console.error('Backup log table not found');
    }
}

// تحميل سجل النسخ من localStorage
function loadBackupLog() {
    const logTable = document.querySelector('#backup-log-table tbody');
    if (!logTable) return;

    const backupLog = JSON.parse(localStorage.getItem('backupLog') || '[]');
    logTable.innerHTML = '';
    backupLog.forEach(entry => {
        const correctedTimestamp = entry.timestamp.replace(/(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3}Z)/, '$1T$2:$3:$4.$5');
        const date = new Date(correctedTimestamp);

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${entry.filename}</td>
            <td>${entry.sections}</td>
            <td>${date.toLocaleDateString('ar-SA')}</td>
            <td>${date.toLocaleTimeString('ar-SA')}</td>
            <td>${entry.status}</td>
            <td>
                <button class="button btn-restore" onclick="showRestoreModal()"><i class="fas fa-undo"></i> استعادة</button>
                <button class="button btn-delete" onclick="deleteBackup('${entry.filename}')"><i class="fas fa-trash"></i> حذف</button>
            </td>
        `;
        logTable.prepend(row);
    });
}

// حذف نسخة احتياطية
function deleteBackup(filename) {
    if (!confirm('هل أنت متأكد من حذف هذا السجل؟')) return;
    let backupLog = JSON.parse(localStorage.getItem('backupLog') || '[]');
    backupLog = backupLog.filter(entry => entry.filename !== filename);
    localStorage.setItem('backupLog', JSON.stringify(backupLog));
    loadBackupLog();
}

// تحميل الصفحة
// حفظ بيانات المستخلص
// settings_main.js

// ... (جميع الدوال الأخرى مثل updateDateTime, navigateTo, toggleDirectPurchase, showSection, validateContractData, validateUsersData, validateSystemData, validateBackupData, calculateExtractDurationDays, saveSectionData, clearSectionData, cancelSection, verifyPassword, toggleFields, closePasswordPrompt, showPasswordPrompt, saveContractData, updateContractDisplayData, collectAllData, createBackup, confirmBackup, showBackupModal, showRestoreModal, closeModal, toggleAllSections, loadBackupDetails, toggleAllRestoreSections, confirmRestore, exportSettings, importSettings, updateExportImportLog, saveUsersData, saveSystemData, clearSystemData, restoreDefaultSystemSettings, updateExtractDisplayData, updateUsersDisplayData, deleteUser, updateSystemData, updateBackupData, updateExportImportData, scheduleBackup, loadPersistentData, setupExtractDateListeners, toggleSection, updateBackupLog, loadBackupLog, deleteBackup) ...

// **هنا يجب أن تكون دالة saveExtractData معرفة**
function saveExtractData() {
    try {
        console.log('بدء تشغيل دالة saveExtractData');
        const newMonth = document.getElementById('extract-month')?.value || '';
        const newYear  = document.getElementById('extract-year')?.value  || '';

        // ── عزل البيانات بين الشهور ─────────────────────────────────────
        const prevRaw = localStorage.getItem('persistentExtractData');
        const prevData = prevRaw ? JSON.parse(prevRaw) : {};
        const prevMonth = (prevData.extractMonth || '').trim();
        const prevYear  = String(prevData.extractYear || '').trim();
        const prevKey   = prevMonth && prevYear ? `${prevYear}_${prevMonth}` : null;
        const newKey    = newMonth  && newYear  ? `${newYear}_${newMonth}`   : null;

        if (prevKey && newKey && prevKey !== newKey) {
            // ── تحذير (غير إلزامي) عند الانتقال قبل رفع المستخلصين للاعتماد ──
            const _laborLocked      = localStorage.getItem('najran_labor_locked_' + prevKey);
            const _consumablesLocked = localStorage.getItem('najran_consumables_locked_' + prevKey);
            if (!_laborLocked && !_consumablesLocked) {
                if (!confirm('⚠️ تنبيه: لم يتم رفع مستخلص العمالة ولا مستخلص المستهلكات للاعتماد بعد.\n\nهل تريد الانتقال لشهر جديد على أي حال؟')) {
                    document.getElementById('extract-month').value = prevMonth;
                    document.getElementById('extract-year').value  = prevYear;
                    return;
                }
            } else if (!_laborLocked) {
                if (!confirm('⚠️ تنبيه: لم يتم رفع مستخلص العمالة للاعتماد بعد.\n\nهل تريد الانتقال لشهر جديد على أي حال؟')) {
                    document.getElementById('extract-month').value = prevMonth;
                    document.getElementById('extract-year').value  = prevYear;
                    return;
                }
            } else if (!_consumablesLocked) {
                if (!confirm('⚠️ تنبيه: لم يتم رفع مستخلص المستهلكات للاعتماد بعد.\n\nهل تريد الانتقال لشهر جديد على أي حال؟')) {
                    document.getElementById('extract-month').value = prevMonth;
                    document.getElementById('extract-year').value  = prevYear;
                    return;
                }
            }
            // ─────────────────────────────────────────────────────────────────

            // حفظ snapshot الشهر الحالي أولاً
            if (window.saveMonthSnapshot) window.saveMonthSnapshot(prevKey);
            // تحميل بيانات الشهر الجديد (تنظيف إذا كان شهراً جديداً)
            if (window.loadMonthSnapshot) window.loadMonthSnapshot(newKey);
            console.log(`[MonthCtx] switched: ${prevKey} → ${newKey}`);

            // ── زيادة رقم الدفعة تلقائياً عند تغيير الشهر ──────────────
            const pnInput = document.getElementById('payment-number');
            if (pnInput) {
                const prevNewSnap = localStorage.getItem('monthSnapshot_' + newKey);
                if (prevNewSnap) {
                    // شهر موجود في الأرشيف — حمّل رقم دفعته
                    try {
                        const snap = JSON.parse(prevNewSnap);
                        const snapExtract = JSON.parse(snap['persistentExtractData'] || '{}');
                        if (snapExtract.paymentNumber) pnInput.value = snapExtract.paymentNumber;
                    } catch(e) {}
                } else {
                    // شهر جديد — زد رقم الدفعة بمقدار 1
                    const prevPn = parseInt(prevData.paymentNumber || '0', 10);
                    const newPn = String(prevPn + 1).padStart(Math.max(3, String(prevPn + 1).length), '0');
                    pnInput.value = newPn;
                }
            }
            // ─────────────────────────────────────────────────────────────
        }
        // ─────────────────────────────────────────────────────────────────

        const data = {
            extractCalendar: document.getElementById('extract-calendar')?.value || 'ميلادي',
            extractMonth: newMonth,
            extractYear: newYear,
            paymentNumber: document.getElementById('payment-number')?.value || '',
            extractFinal: document.getElementById('extract-final')?.checked || false,
            extractStart: document.getElementById('extract-start')?.value || '',
            extractEnd: document.getElementById('extract-end')?.value || '',
            extractDuration: document.getElementById('extract-duration')?.value || 'شهر واحد'
        };

        console.log('البيانات المجمعة:', data);

        const validationError = validateExtractData(data);
        if (validationError) {
            console.error('خطأ التحقق:', validationError);
            alert(validationError);
            return;
        }

        // ── فحص التكرار قبل الحفظ ──────────────────────────────────────────
        if (typeof window.checkDuplicateExtract === 'function' && data.paymentNumber) {
            var dup = window.checkDuplicateExtract(data.paymentNumber, data.extractMonth, data.extractYear);
            if (dup) {
                var dupDate = new Date(dup.savedAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
                var proceed = window.confirm(
                    'تحذير: يوجد مستخلص محفوظ بالفعل بنفس البيانات\n\n' +
                    'رقم الدفعة: ' + data.paymentNumber + '\n' +
                    'الشهر: ' + data.extractMonth + ' ' + data.extractYear + '\n' +
                    'تاريخ الحفظ السابق: ' + dupDate + '\n\n' +
                    'هل تريد المتابعة وحفظ نسخة جديدة؟'
                );
                if (!proceed) return;
            }
        }
        // ─────────────────────────────────────────────────────────────────

        localStorage.setItem('persistentExtractData', JSON.stringify(data));
        console.log('البيانات المحفوظة في localStorage:', JSON.parse(localStorage.getItem('persistentExtractData')));

        window.dispatchEvent(new StorageEvent('storage', {
            key: 'persistentExtractData',
            newValue: JSON.stringify(data)
        }));

        // ── حفظ snapshot في الأرشيف ─────────────────────────────────────
        if (typeof window.saveExtractSnapshot === 'function') {
            window.saveExtractSnapshot('save');
        }
        // ─────────────────────────────────────────────────────────────────

        saveSectionData('extract', data, 'extract-save-success');

        // ── فحص إشارة الاعتماد من النظام — التقديم للفترة التالية ──────
        var autoIncResult = null;
        var advanceFlag = localStorage.getItem('najran_advance_period');
        if (advanceFlag) {
            try {
                var flagData = JSON.parse(advanceFlag);
                // استخدم الإشارة مرة واحدة فقط ثم احذفها
                localStorage.removeItem('najran_advance_period');
                if (typeof window.autoIncrementExtractPeriod === 'function') {
                    autoIncResult = window.autoIncrementExtractPeriod();
                }
            } catch(e) { localStorage.removeItem('najran_advance_period'); }
        }
        // ─────────────────────────────────────────────────────────────────

        updateExtractDisplayData();
        calculateExtractDurationDays();

        // تحديث قسم الأرشيف
        if (typeof renderMonthsArchive === 'function') renderMonthsArchive();

        if (autoIncResult) {
            if (typeof showSuccessMessage === 'function') {
                showSuccessMessage('تم الحفظ ✓ — رقم الدفعة والتواريخ جاهزة للفترة التالية: دفعة ' + autoIncResult.paymentNumber + ' / ' + autoIncResult.extractMonth + ' ' + autoIncResult.extractYear);
            }
        }

        console.log('تم حفظ البيانات بنجاح!');
    } catch (error) {
        console.error('خطأ في حفظ بيانات المستخلص:', error);
        alert('حدث خطأ أثناء حفظ بيانات المستخلص! تحقق من وحدة التحكم لمزيد من التفاصيل.');
    }
}

// ── أرشيف الشهور المحفوظة ────────────────────────────────────────────────
function renderMonthsArchive() {
    const container = document.getElementById('months-archive-list');
    if (!container) return;
    const saved = window.getSavedMonths ? window.getSavedMonths() : [];
    const current = window.getCurrentMonthKey ? window.getCurrentMonthKey() : null;
    if (saved.length === 0) {
        container.innerHTML = '<p style="color:#94a3b8;font-size:13px;text-align:center;padding:12px">لا توجد شهور محفوظة بعد</p>';
        return;
    }
    container.innerHTML = saved.map(key => {
        const label = key.replace('_', ' — ');
        const isCurrent = key === current;
        return `<div class="month-arc-item ${isCurrent ? 'active' : ''}">
            <span class="month-arc-label">${label}</span>
            <div class="month-arc-btns">
                ${!isCurrent ? `<button onclick="switchMonthAndReload('${key}')" class="month-arc-btn load">تحميل</button>` : '<span style="font-size:11px;color:#16a34a;font-weight:700">● نشط</span>'}
                <button onclick="deleteMonthSnapshot('${key}')" class="month-arc-btn del" title="حذف">✕</button>
            </div>
        </div>`;
    }).join('');
}

function switchMonthAndReload(monthKey) {
    const current = window.getCurrentMonthKey ? window.getCurrentMonthKey() : null;
    if (current) window.saveMonthSnapshot(current);
    window.loadMonthSnapshot(monthKey);
    const parts = monthKey.split('_');
    const year = parts[0], month = parts.slice(1).join('_');
    const prevRaw = localStorage.getItem('persistentExtractData');
    if (prevRaw) {
        try {
            const ed = JSON.parse(prevRaw);
            ed.extractMonth = month;
            ed.extractYear = year;
            localStorage.setItem('persistentExtractData', JSON.stringify(ed));
        } catch {}
    }
    updateExtractDisplayData();
    renderMonthsArchive();
    const el = document.getElementById('months-archive-list');
    if (el) el.style.background = '#f0fdf4';
    setTimeout(() => { if (el) el.style.background = ''; }, 800);
}

function deleteMonthSnapshot(monthKey) {
    if (!confirm(`حذف بيانات ${monthKey.replace('_', ' ')}؟`)) return;
    localStorage.removeItem('monthSnapshot_' + monthKey);
    renderMonthsArchive();
}

function saveCurrentMonthManually() {
    const key = window.getCurrentMonthKey ? window.getCurrentMonthKey() : null;
    if (!key) { alert('حدد الشهر والسنة أولاً'); return; }
    window.saveMonthSnapshot(key);
    renderMonthsArchive();
    const btn = document.getElementById('btn-save-month-snap');
    if (btn) { btn.textContent = '✓ تم الحفظ'; setTimeout(() => { btn.textContent = '💾 حفظ snapshot الشهر الحالي'; }, 1500); }
}
// ── خريطة أسماء الشركات الكاملة ─────────────────────────────────────────────
var COMPANY_LABELS_MAP = {
    'تجمع_نجران': 'تجمع نجران الصحي — وحدة الصيانة العامة',
    'بيت_العرب':  'شركة مجموعة بيت العرب الحديثة المحدودة',
    'سراكو':      'شركة سراكو',
};

// خريطة: اسم المستشفى → اسم الشركة الكامل
var HOSPITAL_COMPANY_MAP = {
    'مستشفى يدمه العام':                                        'شركة مجموعة بيت العرب الحديثة المحدودة',
    'مستشفى حبونا العام':                                       'شركة مجموعة بيت العرب الحديثة المحدودة',
    'مستشفى بدر الجنوب العام':                                  'شركة مجموعة بيت العرب الحديثة المحدودة',
    'مستشفى الولادة والأطفال':                                  'شركة مجموعة بيت العرب الحديثة المحدودة',
    'مستشفى نجران العام القديم وسكن الممرضات الخارجي':         'شركة مجموعة بيت العرب الحديثة المحدودة',
    'المكاتب الإدارية والمرافق الصحية':                        'شركة مجموعة بيت العرب الحديثة المحدودة',
    'صيانة وإصلاح السيارات والعيادات المتنقلة':                 'شركة مجموعة بيت العرب الحديثة المحدودة',
    'مستشفى نجران العام الجديد':                                'شركة سراكو',
    'مركز طب الأسنان التخصصي':                                  'شركة سراكو',
    'مجمع الأمل للصحة النفسية':                                 'شركة سراكو',
    'مستشفى ثار العام':                                         'شركة سراكو',
    'مستشفى خباش العام':                                        'شركة سراكو',
    'المراكز الصحية':                                           'شركة سراكو',
    'مستشفى الملك خالد':                                        'شركة سراكو',
    'مركز الأمير سلطان':                                        'شركة سراكو',
    'مستشفى شروره العام':                                       'شركة سراكو',
};

// ── بيانات العقود الثابتة (تُملأ تلقائياً ولا تتأثر بإعادة التهيئة) ──────────
var HOSPITAL_CONTRACT_MAP = {
    'مستشفى يدمه العام': {
        contractNumber:  '250811180425',
        companyName:     'شركة مجموعة بيت العرب الحديثة المحدودة',
        startDate:       '2026-01-02',
        endDate:         '2031-01-01',
        contractType:    'عقد أساسي',
        contractValue:   '111691036.01',
        contractDetails: 'عقد الصيانة والنظافة والتشغيل غير الطبي لمواقع (م. يدمة العام - م. حبونا العام - م. بدر الجنوب العام)',
    },
    'مستشفى حبونا العام': {
        contractNumber:  '250811180425',
        companyName:     'شركة مجموعة بيت العرب الحديثة المحدودة',
        startDate:       '2026-01-02',
        endDate:         '2031-01-01',
        contractType:    'عقد أساسي',
        contractValue:   '111691036.01',
        contractDetails: 'عقد الصيانة والنظافة والتشغيل غير الطبي لمواقع (م. يدمة العام - م. حبونا العام - م. بدر الجنوب العام)',
    },
    'مستشفى بدر الجنوب العام': {
        contractNumber:  '250811180425',
        companyName:     'شركة مجموعة بيت العرب الحديثة المحدودة',
        startDate:       '2026-01-02',
        endDate:         '2031-01-01',
        contractType:    'عقد أساسي',
        contractValue:   '111691036.01',
        contractDetails: 'عقد الصيانة والنظافة والتشغيل غير الطبي لمواقع (م. يدمة العام - م. حبونا العام - م. بدر الجنوب العام)',
    },
    'مستشفى الولادة والأطفال': {
        contractNumber:  '250701156483',
        companyName:     'شركة مجموعة بيت العرب الحديثة المحدودة',
        startDate:       '2026-02-05',
        endDate:         '2031-02-04',
        contractType:    'عقد أساسي',
        contractValue:   '272601114.35',
        contractDetails: 'عقد الصيانة والنظافة والتشغيل غير الطبي لمواقع (م. الولادة والأطفال – م. نجران العام القديم وسكن الممرضات الخارجي – المكاتب الإدارية والمرافق الصحية وصيانة وإصلاح السيارات والعيادات المتنقلة)',
    },
    'مستشفى نجران العام القديم وسكن الممرضات الخارجي': {
        contractNumber:  '250701156483',
        companyName:     'شركة مجموعة بيت العرب الحديثة المحدودة',
        startDate:       '2026-02-04',
        endDate:         '2031-02-03',
        contractType:    'عقد أساسي',
        contractValue:   '272601114.35',
        contractDetails: 'عقد الصيانة والنظافة والتشغيل غير الطبي لمواقع (م. الولادة والأطفال – م. نجران العام القديم وسكن الممرضات الخارجي – المكاتب الإدارية والمرافق الصحية وصيانة وإصلاح السيارات والعيادات المتنقلة)',
    },
    'المكاتب الإدارية والمرافق الصحية': {
        contractNumber:  '250701156483',
        companyName:     'شركة مجموعة بيت العرب الحديثة المحدودة',
        startDate:       '2026-02-05',
        endDate:         '2031-02-04',
        contractType:    'عقد أساسي',
        contractValue:   '272601114.35',
        contractDetails: 'عقد الصيانة والنظافة والتشغيل غير الطبي لمواقع (م. الولادة والأطفال – م. نجران العام القديم وسكن الممرضات الخارجي – المكاتب الإدارية والمرافق الصحية وصيانة وإصلاح السيارات والعيادات المتنقلة)',
    },
    'صيانة وإصلاح السيارات والعيادات المتنقلة': {
        contractNumber:  '250701156483',
        companyName:     'شركة مجموعة بيت العرب الحديثة المحدودة',
        startDate:       '2026-02-05',
        endDate:         '2031-02-04',
        contractType:    'عقد أساسي',
        contractValue:   '272601114.35',
        contractDetails: 'عقد الصيانة والنظافة والتشغيل غير الطبي لمواقع (م. الولادة والأطفال – م. نجران العام القديم وسكن الممرضات الخارجي – المكاتب الإدارية والمرافق الصحية وصيانة وإصلاح السيارات والعيادات المتنقلة)',
    },
};

function _applyFixedContractData(data, hospitalName, force) {
    var fixed = HOSPITAL_CONTRACT_MAP[hospitalName];
    if (!fixed) return data;

    var hospitalChanged = data._autoHospitalName !== hospitalName;

    data.hospitalName = hospitalName || data.hospitalName || '';

    // بيانات أساسية ثابتة: تتعبأ تلقائياً عند أول اختيار أو عند تغيير المستشفى
    if (force || hospitalChanged || !data.contractNumber) data.contractNumber = fixed.contractNumber;
if (!data._manualCompanyName && (force || hospitalChanged || !data.companyName)) {
    data.companyName = fixed.companyName;
}    if (force || hospitalChanged || !data.startDate)      data.startDate      = fixed.startDate;
    if (force || hospitalChanged || !data.endDate)        data.endDate        = fixed.endDate;
    if (force || hospitalChanged || !data.contractType)   data.contractType   = fixed.contractType;
    if (force || hospitalChanged || !data.contractValue)  data.contractValue  = fixed.contractValue;

    // تفاصيل العقد: تتعبأ تلقائياً، لكن لا تُمسح إذا المستخدم عدّلها وحفظها
    if (!data._manualContractDetails && (force || hospitalChanged || !data.contractDetails)) {
        data.contractDetails = fixed.contractDetails;
    }

    data._autoHospitalName = hospitalName;

    return data;
}

// إرجاع اسم الشركة الكامل من الجلسة أو من اسم المستشفى
function _resolveCompanyName(session, hospitalName) {
    if (session && session.companyName) {
        return session.companyName;
    }
    if (session && session.company && COMPANY_LABELS_MAP[session.company]) {
        return COMPANY_LABELS_MAP[session.company];
    }
    return HOSPITAL_COMPANY_MAP[hospitalName] || '';
}

function _getSession() {
    try {
        var raw = localStorage.getItem('najran_session');
        var session = raw ? JSON.parse(raw) : {};

        var pcd = {};
        try {
            pcd = JSON.parse(localStorage.getItem('persistentContractData') || '{}');
        } catch (e) {}

        if (!session.hospital) {
            session.hospital =
                localStorage.getItem('hospitalName') ||
                pcd.hospitalName ||
                '';
        }

        if (!session.companyName) {
            session.companyName =
                localStorage.getItem('companyName') ||
                pcd.companyName ||
                '';
        }

        if (!session.company && session.companyName) {
            session.company = session.companyName;
        }

        if (!session.contractNumber) {
            session.contractNumber =
                localStorage.getItem('contractNumber') ||
                pcd.contractNumber ||
                '';
        }

        return session;
    } catch (e) {
        return null;
    }
}

// ── مفتاح localStorage لبيانات عقد مستشفى معين ────────────────────────────
function _hospitalContractKey(hospitalName) {
    return 'contractData__h__' + encodeURIComponent(hospitalName || '');
}
function _manualCompanyKey(hospitalName) {
    return 'manualCompanyName__h__' + encodeURIComponent(hospitalName || '');
}

function _getManualCompanyName(hospitalName) {
    try {
        return localStorage.getItem(_manualCompanyKey(hospitalName || '')) || '';
    } catch (e) {
        return '';
    }
}
// ── تبديل المستشفى النشط وتحميل بياناته ─────────────────────────────────────
function switchHospital(hospitalName) {
    var session = _getSession();
    if (!session) return;

    var currentHospital = session.hospital || '';

    // احفظ بيانات المستشفى الحالي في مفتاحه الخاص
    if (currentHospital) {
        var currentRaw = localStorage.getItem('persistentContractData');
        if (currentRaw) {
            localStorage.setItem(_hospitalContractKey(currentHospital), currentRaw);
        }
    }

    // حدّث الجلسة بالمستشفى الجديد (raw لتجاوز الـ proxy)
    try {
        var updated = Object.assign({}, session, { hospital: hospitalName });
        Storage.prototype.setItem.call(localStorage, 'najran_session', JSON.stringify(updated));
    } catch (e) {}

    // حمّل بيانات المستشفى الجديد إن وُجدت، وإلا ابدأ بأسمه فقط
    var savedForNew = localStorage.getItem(_hospitalContractKey(hospitalName));
    if (savedForNew) {
        localStorage.setItem('persistentContractData', savedForNew);
    } else {
        // بيانات جديدة للمستشفى: اسم المستشفى + اسم الشركة + باقي البيانات المشتركة
        var oldData = JSON.parse(localStorage.getItem('persistentContractData') || '{}');
        var fullCompanyNew = _resolveCompanyName(session, hospitalName);
        var freshData = {
            hospitalName:           hospitalName,
            companyName:            fullCompanyNew,
            contractNumber:         '',
            startDate:              '',
            endDate:                '',
            contractType:           '',
            // احتفظ بالبيانات المشتركة (مديرو المستشفى / الختم) فقط
            projectManager:         oldData.projectManager         || '',
            maintenanceHead:        oldData.maintenanceHead        || '',
            operationsAssistant:    oldData.operationsAssistant    || '',
            engineeringManager:     oldData.engineeringManager     || '',
            financialManager:       oldData.financialManager       || '',
            hospitalManager:        oldData.hospitalManager        || '',
            contractorRepresentative: oldData.contractorRepresentative || '',
            hospitalAccountant:     oldData.hospitalAccountant     || '',
            directPurchaseRatio:    oldData.directPurchaseRatio    || '0',
        };
        // طبّق البيانات الثابتة (رقم العقد، التواريخ، الشركة)
_applyFixedContractData(freshData, hospitalName, true);
        localStorage.setItem('persistentContractData', JSON.stringify(freshData));
    }

    loadPersistentData();

    // تحديث DOM مباشرة للحقول الثلاثة الرئيسية
    var _hn = document.getElementById('hospital-name');
    if (_hn) _hn.value = hospitalName;

    var _cd = document.getElementById('contract-details');
    var newData = JSON.parse(localStorage.getItem('persistentContractData') || '{}');
    if (_cd) _cd.value = newData.contractDetails || '';

 var _cn = document.getElementById('company-name');
if (_cn) _cn.value = newData.companyName || _resolveCompanyName(session, hospitalName);

    updateMainHospitalName();
    renderHospitalPicker();
    // ضمان نهائي
    setTimeout(autoFillFromSession, 100);
}

// ── عرض منتقي المستشفى (للمستخدمين الذين لديهم أكثر من موقع أو بدون context) ─
function renderHospitalPicker() {
    var container = document.getElementById('hospital-picker-container');
    if (!container) return;

    var session = _getSession();

    // اجمع قائمة المستشفيات: من session أولاً، ثم HOSPITAL_CONTRACT_MAP كـ fallback
    var hospitals = [];
    if (session) {
        try { hospitals = JSON.parse(session.hospitals || '[]'); } catch (e) {}
        if (!hospitals.length && session.hospital) hospitals = [session.hospital];
    }

    // إذا لا توجد مستشفيات في session → للأدمن والمشرف فقط: استخدم كل HOSPITAL_CONTRACT_MAP
    var _isAdmin = session && (session.role === 'admin' || session.role === 'supervisor');
    if (!hospitals.length && _isAdmin) {
        hospitals = Object.keys(HOSPITAL_CONTRACT_MAP);
    }

    if (!hospitals.length) { container.style.display = 'none'; return; }

    // إذا كان هناك مستشفى واحد فقط محدد مسبقاً → أخفِ المنتقي (لا يحتاج اختيار)
    var currentHospital = (session && session.hospital) || '';
    try {
        var _pcd = JSON.parse(localStorage.getItem('persistentContractData') || '{}');
        if (!currentHospital) currentHospital = _pcd.hospitalName || '';
    } catch(e) {}
    if (hospitals.length === 1 && currentHospital === hospitals[0]) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    container.innerHTML =
        '<div style="margin-bottom:14px;padding:14px 16px;background:rgba(30,60,114,0.07);border-radius:12px;border:1px solid rgba(30,60,114,0.18)">' +
        '<p style="font-weight:700;color:#1e3c72;margin:0 0 10px;font-size:14px;font-family:Tajawal,sans-serif">🏥 اختر الموقع لعرض إعداداته:</p>' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px">' +
        hospitals.map(function (h) {
            var active = h === currentHospital;
            var safeH = h.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            return '<button onclick="_selectHospitalFromOverlay(\'' + safeH + '\')" style="' +
                'padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px;font-family:Tajawal,sans-serif;transition:all .2s;' +
                'border:' + (active ? '2px solid #1e3c72' : '1.5px solid #d1d5db') + ';' +
                'background:' + (active ? '#1e3c72' : '#fff') + ';' +
                'color:' + (active ? '#fff' : '#374151') + ';' +
                'font-weight:' + (active ? '700' : '500') + '">' +
                (active ? '✓ ' : '') + h + '</button>';
        }).join('') +
        '</div></div>';
}

// ── ملء اسم المستشفى والشركة تلقائياً من بيانات المستخدم ────────────────────
function autoFillFromSession() {
    try {
        var session = _getSession();
        console.log('[autoFill] session.hospital=', session && session.hospital, '| session.company=', session && session.company);
        if (!session) return;

        var contractData = JSON.parse(localStorage.getItem('persistentContractData') || '{}');
        var changed = false;
var manualCompanyName = _getManualCompanyName(contractData.hospitalName || session.hospital || '');
if (manualCompanyName) {
    contractData.companyName = manualCompanyName;
    contractData._manualCompanyName = true;
    changed = true;
}
        // fallback: اقرأ hospitalName من المفتاح المنفصل إن لم يكن في persistentContractData
        if (!contractData.hospitalName) {
            var _fallbackHN = localStorage.getItem('hospitalName') || (session.hospital || '');
            if (_fallbackHN) { contractData.hospitalName = _fallbackHN; changed = true; }
        }

        // اسم المستشفى — يُملأ إذا كان فارغاً أو مختلفاً عن الجلسة الحالية
        if (session.hospital && contractData.hospitalName !== session.hospital) {
            contractData.hospitalName = session.hospital;
            changed = true;
        }

        // اسم الشركة — من الجلسة أو من اسم المستشفى (من الجلسة أو من localStorage)
     var _hospitalForCompany = session.hospital || contractData.hospitalName || '';
var fullCompany = _resolveCompanyName(session, _hospitalForCompany);

if (!contractData._manualCompanyName && fullCompany && contractData.companyName !== fullCompany) {
    contractData.companyName = fullCompany;
    changed = true;
}

        // رقم العقد — يُملأ فقط لو فارغ
        if (!contractData.contractNumber && session.contractNumber) {
            contractData.contractNumber = session.contractNumber;
            changed = true;
        }
        if (contractData.hospitalName && HOSPITAL_CONTRACT_MAP[contractData.hospitalName]) {
            var beforeFixed = JSON.stringify(contractData);
            _applyFixedContractData(contractData, contractData.hospitalName, false);
            if (JSON.stringify(contractData) !== beforeFixed) {
                changed = true;
            }
        }
        if (changed) {
            localStorage.setItem('persistentContractData', JSON.stringify(contractData));
            updateContractDisplayData();
            updateMainHospitalName();
        }

        // ── تحديث DOM مباشرة — بضمان مستقل عن localStorage وعن changed ──
        if (session.hospital) {
            var _hn = document.getElementById('hospital-name');
            if (_hn) _hn.value = session.hospital;
        }
   var _displayCompany = contractData.companyName || _resolveCompanyName(session, session.hospital || contractData.hospitalName || '');
if (_displayCompany) {
    var _cn = document.getElementById('company-name');
    if (_cn) _cn.value = _displayCompany;
}

        // ── إذا كان المستشفى أو الشركة غائبَّين في الجلسة — اجلب من API ──
if ((!session.hospital) && session.clerkToken) {            fetch('/api/users/me', {
                headers: { 'Authorization': 'Bearer ' + session.clerkToken }
            }).then(function(r) { return r.ok ? r.json() : null; })
              .then(function(user) {
                if (!user) return;
                var needsUpdate = (!session.hospital && user.hospital) ||
                                  (!session.company  && user.company);
                if (!needsUpdate) return;
                // حدّث الجلسة
                var updated = Object.assign({}, session, {
                    hospital: user.hospital || session.hospital || null,
                    company:  user.company  || session.company  || null,
                });
                try {
                    Storage.prototype.setItem.call(localStorage, 'najran_session',
                        JSON.stringify(updated));
                } catch(e2) {}
                // تطبيق على DOM مباشرة
if (user.hospital) {
    var hn2 = document.getElementById('hospital-name');
    if (hn2) hn2.value = user.hospital;
}

// حفظ في persistentContractData مع احترام التعديل اليدوي لاسم الشركة
try {
    var cd2 = JSON.parse(localStorage.getItem('persistentContractData') || '{}');
    var ch2 = false;

    if (user.hospital && cd2.hospitalName !== user.hospital) {
        cd2.hospitalName = user.hospital;
        ch2 = true;
    }

    if (user.company && !cd2._manualCompanyName) {
        var fc2 = COMPANY_LABELS_MAP[user.company] ||
                  user.company.replace(/_/g, ' ');

        if (cd2.companyName !== fc2) {
            cd2.companyName = fc2;
            ch2 = true;
        }
    }

    if (ch2) {
        localStorage.setItem('persistentContractData', JSON.stringify(cd2));
        updateMainHospitalName();
    }

    var cn2 = document.getElementById('company-name');
    if (cn2) {
        cn2.value = cd2.companyName || '';
    }
} catch(e3) {}

renderHospitalPicker();
                renderHospitalPicker();
              }).catch(function() {});
        }

        // اعرض منتقي المستشفى دائماً
        renderHospitalPicker();
    } catch (e) { /* تجاهل أي خطأ */ }
}

// ── اختيار مستشفى من الـ overlay مباشرة (لا يحتاج session) ─────────────────
window._selectHospitalFromOverlay = function(hospitalName) {
    // 1. حدّث الجلسة أولاً (حتى يعرف pullFromCloud أي مستشفى يجلب بياناته)
    try {
        var raw = Storage.prototype.getItem.call(localStorage, 'najran_session');
        if (raw) {
            var s = JSON.parse(raw);
            s.hospital = hospitalName;
            Storage.prototype.setItem.call(localStorage, 'najran_session', JSON.stringify(s));
        }
    } catch(e) {}

    // 2. احفظ مفتاح hospitalName المنفصل (عبر الـ proxy حتى تقرأه باقي الصفحات)
    localStorage.setItem('hospitalName', hospitalName);

    // 3. أزل الـ overlay
    var ov = document.getElementById('_najran_ctx_overlay');
    if (ov) { ov.style.opacity = '0'; setTimeout(function(){ if(ov && ov.parentNode) ov.parentNode.removeChild(ov); }, 300); }

    // دالة مشتركة لتحديث الواجهة
    function _refreshUI() {
        updateContractDisplayData();
        if (typeof loadPersistentData === 'function') loadPersistentData();
        renderHospitalPicker();
    }

    // دالة تطبيق الافتراضي (إن لم يوجد تعديل محفوظ على السيرفر)
    function _applyDefaults() {
        var freshData = { hospitalName: hospitalName };
_applyFixedContractData(freshData, hospitalName, true);
        // اكتب عبر الـ proxy حتى تقرأ باقي الصفحات البيانات من المكان الصحيح
        localStorage.setItem('persistentContractData', JSON.stringify(freshData));
    }

    // 4. جلب بيانات المستشفى من السيرفر (التعديلات المحفوظة سابقاً)
    if (typeof window.najranPullFromCloud === 'function') {
        window.najranPullFromCloud().then(function() {
            // تحقق هل جاءت بيانات حقيقية للمستشفى المختار
            var cd = {};
            try { cd = JSON.parse(localStorage.getItem('persistentContractData') || '{}'); } catch(e) {}
            if (!cd.hospitalName || cd.hospitalName !== hospitalName) {
                // لا يوجد شيء محفوظ للمستشفى → استخدم الافتراضي
                _applyDefaults();
            }
            _refreshUI();
        }).catch(function() {
            _applyDefaults();
            _refreshUI();
        });
    } else {
        // cloud-sync لم يُهيَّأ بعد → افتراضي
        _applyDefaults();
        _refreshUI();
    }
};

// ── إعادة تعبئة الصفحة بعد انتهاء cloud-sync من السحب ──────────────────────
var _settingsCloudRefreshTimer = null;

window.addEventListener('najranCloudPulled', function() {
    clearTimeout(_settingsCloudRefreshTimer);

    _settingsCloudRefreshTimer = setTimeout(function() {
        updateContractDisplayData();
        autoFillFromSession();
        renderHospitalPicker();
    }, 250);
});

// ── تغيير الموقع من الشريط الجانبي (sidebar) ───────────────────────────────
window.addEventListener('najranHospitalChanged', function(e) {
    var h = e && e.detail && e.detail.hospital;
    if (!h) return;
    if (typeof window._selectHospitalFromOverlay === 'function') {
        window._selectHospitalFromOverlay(h);
    }
});

// ✅✅✅ الحل النهائي: استبدل كتلة DOMContentLoaded بالكامل بهذا الكود ✅✅✅
document.addEventListener('DOMContentLoaded', () => {
    console.log("الصفحة جاهزة. بدء التهيئة...");

    // 1. قم بكل الإعدادات الأولية
    showSection('contract');
    updateMainHospitalName();
    updateDateTime();
    setInterval(updateDateTime, 60000);
    setupExtractDateListeners();
    toggleFields('contract', false);
    toggleFields('extract', false);

    // 2. الخطوة الحاسمة: قم بتحميل البيانات بعد تأخير بسيط جداً (10 مللي ثانية)
    // هذا يضمن أنها ستكون آخر عملية تحدث، وتتجاوز أي كود آخر قد يفرّغ الحقول.
    setTimeout(() => {
        console.log(">> الآن يتم فرض تحميل البيانات من localStorage...");

        // إذا كان session.hospital فارغاً لكن session.hospitals لها قيم → اختر الأول تلقائياً
        (function autoSelectFirstHospital() {
            try {
                var _s = _getSession();
                if (!_s) return;
                if (_s.hospital) return; // يوجد بالفعل مستشفى محدد
                var _hs = [];
                try { _hs = JSON.parse(_s.hospitals || '[]'); } catch(e) {}
                if (!_hs.length) return;
                var _cd = JSON.parse(localStorage.getItem('persistentContractData') || '{}');
                // اختر المستشفى المحفوظ سابقاً أو الأول في القائمة
                var _target = (_cd.hospitalName && _hs.indexOf(_cd.hospitalName) !== -1)
                    ? _cd.hospitalName : _hs[0];
                console.log('[autoSelect] تحديد المستشفى تلقائياً:', _target);
                switchHospital(_target);
            } catch(e) {}
        })();

        loadPersistentData();
        autoFillFromSession();
        renderMonthsArchive();
        // ضمان إضافي واحد فقط بعد استقرار الصفحة
setTimeout(autoFillFromSession, 300);
        // ── فحص إشارة اعتماد المستخلص — تقديم الفترة تلقائياً ──────────
        var advanceFlag = localStorage.getItem('najran_advance_period');
        if (advanceFlag) {
            try {
                localStorage.removeItem('najran_advance_period');
                if (typeof window.autoIncrementExtractPeriod === 'function') {
                    var result = window.autoIncrementExtractPeriod();
                    if (result) {
                        loadPersistentData();
                        renderMonthsArchive();
                        if (typeof showSuccessMessage === 'function') {
                            showSuccessMessage('✅ تم اعتماد المستخلص — الفترة والدفعة جُهّزت تلقائياً: دفعة ' + result.paymentNumber + ' / ' + result.extractMonth + ' ' + result.extractYear);
                        }
                    }
                }
            } catch(e) { localStorage.removeItem('najran_advance_period'); }
        }
        // ─────────────────────────────────────────────────────────────────

        console.log(">> اكتمل فرض تحميل البيانات.");
    }, 10);
});

function openBackupOptionsMenu() {
    const modal = document.getElementById('backup-options-modal');
    if (modal) {
        modal.style.display = 'block'; // أو 'flex' إذا كنت تستخدم flexbox لإظهار النافذة
    } else {
        console.error("خطأ: لم يتم العثور على نافذة خيارات النسخ الاحتياطي (backup-options-modal).");
        alert("خطأ في تحميل واجهة النسخ الاحتياطي.");
    }
}

/**
 * دالة عامة لإغلاق أي نافذة منبثقة.
 * يتم استدعاؤها من أزرار الإغلاق (علامة X) في النوافذ.
 */

/**
 * ===================================================================
 *      ===>   ✅ دوال الواجهة الجديدة (V2) ✅   <===
 * ===================================================================
 */

// دالة لفتح نافذة الاستعادة
function openRestoreDialog() {
    const modal = document.getElementById('restore-dialog');
    if (modal) {
        // إعادة تعيين الحقول عند الفتح
        const fileInput = document.getElementById('restore-file-input');
        const fileNameDisplay = document.getElementById('file-name-display');
        if(fileInput) fileInput.value = '';
        if(fileNameDisplay) fileNameDisplay.textContent = '';
        
        modal.style.display = 'flex';
    }
}

// دالة لتحديث اسم الملف المعروض عند اختياره
function updateFileName(fileInput) {
    const fileNameDisplay = document.getElementById('file-name-display');
    if (fileInput.files.length > 0) {
        fileNameDisplay.textContent = `الملف المختار: ${fileInput.files[0].name}`;
    } else {
        fileNameDisplay.textContent = '';
    }
}

// دالة لتحديث اسم المستشفى في الترويسة
function updateMainHospitalName() {
    const contractData = JSON.parse(localStorage.getItem('persistentContractData') || '{}');
    const hospitalName = contractData.hospitalName;
    const titleElement = document.getElementById('main-hospital-name');
    
    if (titleElement && hospitalName) {
        titleElement.textContent = hospitalName;
    }
}
