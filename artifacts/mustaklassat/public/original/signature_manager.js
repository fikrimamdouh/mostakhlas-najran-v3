// نظام إدارة التواقيع التلقائي
// Automatic Signatures Management System

class SignatureManager {
    constructor() {
        this.signatureTypes = {
            // التواقيع المتاحة في النظام
            'projectManager': 'مدير المشروع',
            'maintenanceHead': 'رئيس قسم الصيانة', 
            'operationsAssistant': 'المساعد للتشغيل والصيانة',
            'engineeringManager': 'مدير الإدارة الهندسية',
            'financialManager': 'مدير الإدارة المالية',
            'hospitalManager': 'مدير المستشفى',
            'contractorRepresentative': 'مندوب المقاول',
            'hospitalAccountant': 'محاسب المستشفى',
            'hospitalAdminOperationsAssistant': 'مساعد مدير المستشفى للشؤون الإدارية والتشغيل',
            'siteRepresentative': 'ممثل الموقع',
            'engineeringAffairsManager': 'مدير الشؤون الهندسية',
            'generalServicesManager': 'مدير الخدمات العامة',
            'followUpManager': 'مدير إدارة المتابعة'
        };

        // تحديد التواقيع المطلوبة لكل صفحة
        this.pageSignatures = {
            'attendance': [
                'projectManager',
                'maintenanceHead', 
                'hospitalManager',
                'contractorRepresentative'
            ],
            'performance': [
                'projectManager',
                'engineeringManager',
                'hospitalManager',
                'contractorRepresentative',
                'hospitalAccountant'
            ],
            'achievement': [
                'projectManager',
                'hospitalManager',
                'engineeringManager',
                'contractorRepresentative',
                'followUpManager'
            ],
            'consumables': [
                'projectManager',
                'maintenanceHead',
                'hospitalManager',
                'contractorRepresentative',
                'hospitalAccountant',
                'financialManager'
            ],
            'spare_parts': [
                'projectManager',
                'maintenanceHead',
                'hospitalManager', 
                'contractorRepresentative',
                'hospitalAccountant',
                'engineeringManager'
            ]
        };
    }

    // استرجاع بيانات التواقيع من localStorage
    getSignaturesData() {
        try {
            const contractData = JSON.parse(localStorage.getItem('persistentContractData') || '{}');
            return contractData.signatures || {};
        } catch (error) {
            console.error('خطأ في استرجاع بيانات التواقيع:', error);
            return {};
        }
    }

    // استرجاع معلومات الاتصال من localStorage
    getContactInfo() {
        try {
            const contractData = JSON.parse(localStorage.getItem('persistentContractData') || '{}');
            return contractData.contactInfo || {};
        } catch (error) {
            console.error('خطأ في استرجاع معلومات الاتصال:', error);
            return {};
        }
    }

    // الحصول على التواقيع المطلوبة لصفحة معينة
    getPageSignatures(pageName) {
        const requiredSignatures = this.pageSignatures[pageName] || [];
        const signaturesData = this.getSignaturesData();
        const contactInfo = this.getContactInfo();
        
        return requiredSignatures.map(signatureKey => {
            const name = signaturesData[signatureKey] || '';
            const phone = contactInfo[signatureKey + 'Phone'] || '';
            const email = contactInfo[signatureKey + 'Email'] || '';
            
            return {
                key: signatureKey,
                title: this.signatureTypes[signatureKey],
                name: name,
                phone: phone,
                email: email,
                hasData: name.trim() !== ''
            };
        }).filter(signature => signature.hasData); // إرجاع التواقيع التي تحتوي على بيانات فقط
    }

    // إنشاء HTML للتواقيع
    generateSignaturesHTML(pageName, options = {}) {
        const signatures = this.getPageSignatures(pageName);
        
        if (signatures.length === 0) {
            return '<div class="no-signatures">لا توجد تواقيع محفوظة في الإعدادات</div>';
        }

        const {
            showContactInfo = false,
            layout = 'grid', // 'grid', 'table', 'list'
            columns = 2
        } = options;

        let html = '<div class="signatures-container">';
        
        if (layout === 'grid') {
            html += `<div class="signatures-grid" style="display: grid; grid-template-columns: repeat(${columns}, 1fr); gap: 20px; margin: 20px 0;">`;
            
            signatures.forEach(signature => {
                html += `
                    <div class="signature-item" style="text-align: center; padding: 15px; border: 1px solid #ddd; border-radius: 8px;">
                        <div class="signature-title" style="font-weight: bold; margin-bottom: 10px;">${signature.title}</div>
                        <div class="signature-line" style="border-bottom: 1px solid #000; height: 40px; margin: 10px 0;"></div>
                        <div class="signature-name" style="font-size: 14px; margin-top: 5px;">${signature.name}</div>
                        ${showContactInfo && signature.phone ? `<div class="signature-phone" style="font-size: 12px; color: #666;">${signature.phone}</div>` : ''}
                        ${showContactInfo && signature.email ? `<div class="signature-email" style="font-size: 12px; color: #666;">${signature.email}</div>` : ''}
                    </div>
                `;
            });
            
            html += '</div>';
        } else if (layout === 'table') {
            html += `
                <table class="signatures-table" style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <thead>
                        <tr style="background-color: #f5f5f5;">
                            <th style="border: 1px solid #ddd; padding: 10px;">المنصب</th>
                            <th style="border: 1px solid #ddd; padding: 10px;">التوقيع</th>
                            <th style="border: 1px solid #ddd; padding: 10px;">الاسم</th>
                            ${showContactInfo ? '<th style="border: 1px solid #ddd; padding: 10px;">معلومات الاتصال</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            signatures.forEach(signature => {
                html += `
                    <tr>
                        <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">${signature.title}</td>
                        <td style="border: 1px solid #ddd; padding: 10px; height: 50px;"></td>
                        <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">${signature.name}</td>
                        ${showContactInfo ? `<td style="border: 1px solid #ddd; padding: 10px; text-align: center;">${signature.phone}<br>${signature.email}</td>` : ''}
                    </tr>
                `;
            });
            
            html += '</tbody></table>';
        } else if (layout === 'list') {
            html += '<div class="signatures-list" style="margin: 20px 0;">';
            
            signatures.forEach(signature => {
                html += `
                    <div class="signature-item" style="display: flex; justify-content: space-between; align-items: center; padding: 15px; border-bottom: 1px solid #eee;">
                        <div class="signature-info">
                            <div class="signature-title" style="font-weight: bold;">${signature.title}</div>
                            <div class="signature-name" style="font-size: 14px; color: #666;">${signature.name}</div>
                            ${showContactInfo ? `<div class="signature-contact" style="font-size: 12px; color: #999;">${signature.phone} | ${signature.email}</div>` : ''}
                        </div>
                        <div class="signature-line" style="border-bottom: 1px solid #000; width: 200px; height: 1px;"></div>
                    </div>
                `;
            });
            
            html += '</div>';
        }
        
        html += '</div>';
        return html;
    }

    // إدراج التواقيع في صفحة معينة
    insertSignatures(pageName, containerId, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`لم يتم العثور على العنصر: ${containerId}`);
            return false;
        }

        const signaturesHTML = this.generateSignaturesHTML(pageName, options);
        container.innerHTML = signaturesHTML;
        return true;
    }

    // تحديث التواقيع تلقائياً عند تغيير البيانات
    autoUpdateSignatures() {
        // مراقبة تغييرات localStorage
        window.addEventListener('storage', (e) => {
            if (e.key === 'persistentContractData') {
                this.refreshAllSignatures();
            }
        });

        // مراقبة التغييرات المحلية في نفس النافذة
        const originalSetItem = localStorage.setItem;
        localStorage.setItem = function(key, value) {
            originalSetItem.apply(this, arguments);
            if (key === 'persistentContractData') {
                window.dispatchEvent(new Event('signaturesUpdated'));
            }
        };

        window.addEventListener('signaturesUpdated', () => {
            this.refreshAllSignatures();
        });
    }

    // تحديث جميع التواقيع في الصفحة الحالية
    refreshAllSignatures() {
        const signatureContainers = document.querySelectorAll('[data-signature-page]');
        signatureContainers.forEach(container => {
            const pageName = container.getAttribute('data-signature-page');
            const options = JSON.parse(container.getAttribute('data-signature-options') || '{}');
            const signaturesHTML = this.generateSignaturesHTML(pageName, options);
            container.innerHTML = signaturesHTML;
        });
    }

    // تهيئة النظام
    init() {
        this.autoUpdateSignatures();
        
        // تحديث التواقيع عند تحميل الصفحة
        document.addEventListener('DOMContentLoaded', () => {
            this.refreshAllSignatures();
        });
    }
}

// إنشاء مثيل عام من مدير التواقيع
window.signatureManager = new SignatureManager();

// تهيئة النظام تلقائياً
window.signatureManager.init();

// دوال مساعدة للاستخدام السريع
window.insertSignatures = function(pageName, containerId, options = {}) {
    return window.signatureManager.insertSignatures(pageName, containerId, options);
};

window.getPageSignatures = function(pageName) {
    return window.signatureManager.getPageSignatures(pageName);
};

window.generateSignaturesHTML = function(pageName, options = {}) {
    return window.signatureManager.generateSignaturesHTML(pageName, options);
};

