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

        // التحقق من صحة البيانات
        const validationError = validateContractData(newData);
        if (validationError) {
            alert(validationError);
            return;
        }

        // دالة الحفظ النهائية (سنستدعيها في كل الحالات)
        const finalizeSave = (finalData) => {
            // 1. الحفظ في localStorage (أهم خطوة)
            localStorage.setItem('persistentContractData', JSON.stringify(finalData));
            
            // 2. إرسال إشعار لباقي الصفحات (اختياري)
            window.dispatchEvent(new StorageEvent('storage', { key: 'persistentContractData' }));

            // 3. إظهار رسالة النجاح وإغلاق وضع التعديل
            saveSectionData('contract', 'contract-save-success');
            
            // 4. تحديث الواجهة
            updateMainHospitalName();
            alert('تم حفظ البيانات بنجاح!');
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

// تحديث عرض بيانات العقد
function updateContractDisplayData() {
    const data = JSON.parse(localStorage.getItem('persistentContractData') || '{}');
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
        startDateInput.addEventListener('change', calculateExtractDurationDays);
        endDateInput.addEventListener('change', calculateExtractDurationDays);
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
        const data = {
            extractCalendar: document.getElementById('extract-calendar')?.value || 'ميلادي',
            extractMonth: document.getElementById('extract-month')?.value || '',
            extractYear: document.getElementById('extract-year')?.value || '',
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

        localStorage.setItem('persistentExtractData', JSON.stringify(data));
        console.log('البيانات المحفوظة في localStorage:', JSON.parse(localStorage.getItem('persistentExtractData')));

        window.dispatchEvent(new StorageEvent('storage', {
            key: 'persistentExtractData',
            newValue: JSON.stringify(data)
        }));

        saveSectionData('extract', data, 'extract-save-success');
        updateExtractDisplayData();
        calculateExtractDurationDays();
        console.log('تم حفظ البيانات بنجاح!');
    } catch (error) {
        console.error('خطأ في حفظ بيانات المستخلص:', error);
        alert('حدث خطأ أثناء حفظ بيانات المستخلص! تحقق من وحدة التحكم لمزيد من التفاصيل.');
    }
}
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
        loadPersistentData();
        console.log(">> اكتمل فرض تحميل البيانات.");
    }, 10); // تأخير بسيط جداً لكنه حاسم
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
