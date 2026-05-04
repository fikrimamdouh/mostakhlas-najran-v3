// تطوير منطق تصدير PDF وطباعة جدول العمالة كاملاً بدون تغيير في التنسيق

// دالة تحضير الصفحة للطباعة
function preparePrint() {
    // إنشاء نسخة من الصفحة للطباعة
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('يرجى السماح بالنوافذ المنبثقة لتمكين الطباعة');
        return;
    }
    
    // الحصول على جميع أقسام الجداول
    const departments = [
        'cleaning', 'electricity', 'agriculture', 'civil-works', 
        'mechanical', 'laundry', 'patient-services'
    ];
    
    // إنشاء محتوى HTML للطباعة
    let printContent = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <title>طباعة جدول الحضور والغياب</title>
        <style>
            @media print {
                @page {
                    size: A3 landscape;
                    margin: 0.5cm;
                }
            }
            body {
                font-family: 'Tajawal', Arial, sans-serif;
                margin: 0;
                padding: 10px;
                direction: rtl;
            }
            .header-info {
                text-align: center;
                margin-bottom: 20px;
            }
            .header-info h1 {
                margin: 5px 0;
                font-size: 24px;
                color: #1e3c72;
            }
            .header-info h2 {
                margin: 5px 0;
                font-size: 20px;
                color: #2a5298;
            }
            .header-info h3 {
                margin: 5px 0;
                font-size: 18px;
                color: #333;
            }
            .page-contract-info {
                background: #f9f9f9;
                border-radius: 5px;
                padding: 10px;
                margin-bottom: 15px;
                border-right: 3px solid #2a5298;
                display: flex;
                flex-wrap: wrap;
                font-size: 12px;
            }
            .page-contract-info p {
                margin: 3px 0;
                flex-basis: 19%;
            }
            .extract-details {
                background: #f0f0f0;
                padding: 10px;
                margin-bottom: 15px;
                text-align: center;
                font-weight: bold;
            }
            .department-table {
                margin-bottom: 30px;
                page-break-inside: avoid;
            }
            .department-table h3 {
                background: #2a5298;
                color: white;
                padding: 8px;
                margin: 0;
                border-radius: 5px 5px 0 0;
            }
            .total {
                background: #f0f0f0;
                padding: 8px;
                margin: 0;
                font-weight: bold;
                border: 1px solid #ddd;
                border-bottom: none;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                font-size: 12px;
            }
            th, td {
                border: 1px solid #ddd;
                padding: 5px;
                text-align: center;
            }
            th {
                background-color: #f0f0f0;
                font-weight: bold;
            }
            .job-title, .employee-name {
                min-width: 150px;
                text-align: right;
            }
            .empty-message {
                display: none;
            }
            .status-ح { background-color: #d4edda; }
            .status-غ { background-color: #f8d7da; }
            .status-ج { background-color: #fff3cd; }
            .status-ش { background-color: #d1ecf1; }
            .status-ت { background-color: #e2e3e5; }
            .status-ب { background-color: #cce5ff; }
            .status-ن { background-color: #ffeeba; }
            
            /* إخفاء عناصر التحكم في الطباعة */
            select, button, .zoom-buttons, .action-buttons {
                display: none !important;
            }
            
            /* تنسيق خاص للطباعة */
            td, th {
                font-size: 10px;
                padding: 3px;
            }
            
            /* ضمان ظهور جميع الأعمدة */
            .status-j-col, .status-sh-col, .status-t-col, .status-b-col, .status-n-col {
                display: table-cell !important;
            }
        </style>
    </head>
    <body>
        <!-- معلومات الرأس -->
        <div class="header-info">
            <h1>تجمع نجران الصحي</h1>
            <h3>إدارة الهندسة والصيانة</h3>
            <h2>بيان بالحضور والغياب</h2>
        </div>
        
        <!-- مكون عرض بيانات العقد -->
        <div class="page-contract-info">
            <p><strong>اسم المستشفى:</strong> <span class="hospitalName">${document.querySelector('.hospitalName')?.textContent || 'غير محدد'}</span></p>
            <p><strong>تفاصيل العقد:</strong> <span class="contractDetails">${document.querySelector('.contractDetails')?.textContent || 'غير محدد'}</span></p>
            <p><strong>اسم الشركة:</strong> <span class="companyName">${document.querySelector('.companyName')?.textContent || 'غير محدد'}</span></p>
            <p><strong>نوع العقد:</strong> <span class="contractType">${document.querySelector('.contractType')?.textContent || 'غير محدد'}</span></p>
            <p><strong>مدة المستخلص:</strong> من <span>${document.getElementById('extract-start-date')?.textContent || 'غير محدد'}</span> إلى <span>${document.getElementById('extract-end-date')?.textContent || 'غير محدد'}</span></p>
        </div>
        
        <!-- تفاصيل المستخلص -->
        <div class="extract-details">
            <p class="extract-details-text">مستخلص العمالة شهر <span>${document.getElementById('extract-month')?.textContent || 'غير محدد'}</span> <span>${document.getElementById('extract-year')?.textContent || 'غير محدد'}</span> من تاريخ <span>${document.getElementById('extract-start')?.textContent || 'غير محدد'}</span> إلى <span>${document.getElementById('extract-end')?.textContent || 'غير محدد'}</span></p>
        </div>
    `;
    
    // إضافة جداول الأقسام
    departments.forEach(dept => {
        const deptTable = document.getElementById(`${dept}-table`);
        const deptTitle = document.querySelector(`.department-table:has(#${dept}-table) h3`)?.textContent || `جدول ${dept}`;
        const deptTotal = document.querySelector(`.department-table:has(#${dept}-table) .total`)?.innerHTML || '';
        
        if (deptTable) {
            // التحقق من وجود بيانات في الجدول
            const hasData = deptTable.querySelector('tbody tr td:not(:empty)');
            if (hasData) {
                printContent += `
                <div class="department-table">
                    <h3>${deptTitle}</h3>
                    <div class="total">${deptTotal}</div>
                    ${deptTable.outerHTML}
                </div>
                `;
            }
        }
    });
    
    // إغلاق HTML
    printContent += `
    </body>
    </html>
    `;
    
    // كتابة المحتوى إلى نافذة الطباعة
    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // تحميل الخطوط قبل الطباعة
    printWindow.addEventListener('load', function() {
        // إضافة تأخير قصير للتأكد من تحميل الصفحة بالكامل
        setTimeout(function() {
            printWindow.print();
            // إغلاق النافذة بعد الطباعة (اختياري)
            // printWindow.close();
        }, 500);
    });
}

// دالة تصدير إلى PDF
function exportToPDF() {
    // الحصول على خيارات التصدير
    const includeAllDepartments = document.getElementById('export-all-departments').checked;
    const selectedDepartment = document.getElementById('export-department-select').value;
    
    // إنشاء عنصر div مؤقت لتجميع المحتوى
    const tempDiv = document.createElement('div');
    tempDiv.className = 'pdf-export-container';
    
    // إضافة معلومات الرأس
    const headerDiv = document.createElement('div');
    headerDiv.className = 'header-info';
    headerDiv.innerHTML = `
        <h1>تجمع نجران الصحي</h1>
        <h3>إدارة الهندسة والصيانة</h3>
        <h2>بيان بالحضور والغياب</h2>
    `;
    tempDiv.appendChild(headerDiv);
    
    // إضافة مكون عرض بيانات العقد
    const contractInfoDiv = document.createElement('div');
    contractInfoDiv.className = 'page-contract-info';
    contractInfoDiv.innerHTML = `
        <p><strong>اسم المستشفى:</strong> <span>${document.querySelector('.hospitalName')?.textContent || 'غير محدد'}</span></p>
        <p><strong>تفاصيل العقد:</strong> <span>${document.querySelector('.contractDetails')?.textContent || 'غير محدد'}</span></p>
        <p><strong>اسم الشركة:</strong> <span>${document.querySelector('.companyName')?.textContent || 'غير محدد'}</span></p>
        <p><strong>نوع العقد:</strong> <span>${document.querySelector('.contractType')?.textContent || 'غير محدد'}</span></p>
        <p><strong>مدة المستخلص:</strong> من <span>${document.getElementById('extract-start-date')?.textContent || 'غير محدد'}</span> إلى <span>${document.getElementById('extract-end-date')?.textContent || 'غير محدد'}</span></p>
    `;
    tempDiv.appendChild(contractInfoDiv);
    
    // إضافة تفاصيل المستخلص
    const extractDetailsDiv = document.createElement('div');
    extractDetailsDiv.className = 'extract-details';
    extractDetailsDiv.innerHTML = `
        <p>مستخلص العمالة شهر <span>${document.getElementById('extract-month')?.textContent || 'غير محدد'}</span> <span>${document.getElementById('extract-year')?.textContent || 'غير محدد'}</span> من تاريخ <span>${document.getElementById('extract-start')?.textContent || 'غير محدد'}</span> إلى <span>${document.getElementById('extract-end')?.textContent || 'غير محدد'}</span></p>
    `;
    tempDiv.appendChild(extractDetailsDiv);
    
    // تحديد الأقسام المراد تصديرها
    const departments = includeAllDepartments ? 
        ['cleaning', 'electricity', 'agriculture', 'civil-works', 'mechanical', 'laundry', 'patient-services'] : 
        [selectedDepartment];
    
    // إضافة جداول الأقسام المحددة
    departments.forEach(dept => {
        const deptTable = document.getElementById(`${dept}-table`);
        const deptTitle = document.querySelector(`.department-table:has(#${dept}-table) h3`)?.textContent || `جدول ${dept}`;
        const deptTotal = document.querySelector(`.department-table:has(#${dept}-table) .total`)?.innerHTML || '';
        
        if (deptTable) {
            // التحقق من وجود بيانات في الجدول
            const hasData = deptTable.querySelector('tbody tr td:not(:empty)');
            if (hasData) {
                // إنشاء نسخة من الجدول لتعديلها
                const tableClone = deptTable.cloneNode(true);
                
                // إظهار جميع أعمدة الحالة في النسخة
                const statusColumns = tableClone.querySelectorAll('.status-j-col, .status-sh-col, .status-t-col, .status-b-col, .status-n-col');
                statusColumns.forEach(col => {
                    col.style.display = 'table-cell';
                });
                
                // استبدال عناصر select بنصوص عادية
                const selects = tableClone.querySelectorAll('select');
                selects.forEach(select => {
                    const selectedOption = select.options[select.selectedIndex];
                    const textNode = document.createTextNode(selectedOption.textContent);
                    select.parentNode.replaceChild(textNode, select);
                });
                
                // إنشاء div للقسم
                const deptDiv = document.createElement('div');
                deptDiv.className = 'department-table';
                
                // إضافة عنوان القسم
                const titleDiv = document.createElement('h3');
                titleDiv.textContent = deptTitle;
                deptDiv.appendChild(titleDiv);
                
                // إضافة إجماليات القسم
                const totalDiv = document.createElement('div');
                totalDiv.className = 'total';
                totalDiv.innerHTML = deptTotal;
                deptDiv.appendChild(totalDiv);
                
                // إضافة الجدول
                deptDiv.appendChild(tableClone);
                
                // إضافة القسم إلى المحتوى
                tempDiv.appendChild(deptDiv);
            }
        }
    });
    
    // إضافة التنسيق CSS
    const style = document.createElement('style');
    style.textContent = `
        @page {
            size: A3 landscape;
            margin: 0.5cm;
        }
        body {
            font-family: 'Tajawal', Arial, sans-serif;
            margin: 0;
            padding: 10px;
            direction: rtl;
        }
        .header-info {
            text-align: center;
            margin-bottom: 20px;
        }
        .header-info h1 {
            margin: 5px 0;
            font-size: 24px;
            color: #1e3c72;
        }
        .header-info h2 {
            margin: 5px 0;
            font-size: 20px;
            color: #2a5298;
        }
        .header-info h3 {
            margin: 5px 0;
            font-size: 18px;
            color: #333;
        }
        .page-contract-info {
            background: #f9f9f9;
            border-radius: 5px;
            padding: 10px;
            margin-bottom: 15px;
            border-right: 3px solid #2a5298;
            display: flex;
            flex-wrap: wrap;
            font-size: 12px;
        }
        .page-contract-info p {
            margin: 3px 0;
            flex-basis: 19%;
        }
        .extract-details {
            background: #f0f0f0;
            padding: 10px;
            margin-bottom: 15px;
            text-align: center;
            font-weight: bold;
        }
        .department-table {
            margin-bottom: 30px;
            page-break-inside: avoid;
        }
        .department-table h3 {
            background: #2a5298;
            color: white;
            padding: 8px;
            margin: 0;
            border-radius: 5px 5px 0 0;
        }
        .total {
            background: #f0f0f0;
            padding: 8px;
            margin: 0;
            font-weight: bold;
            border: 1px solid #ddd;
            border-bottom: none;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 3px;
            text-align: center;
        }
        th {
            background-color: #f0f0f0;
            font-weight: bold;
        }
        .job-title, .employee-name {
            min-width: 150px;
            text-align: right;
        }
        .status-ح { background-color: #d4edda; }
        .status-غ { background-color: #f8d7da; }
        .status-ج { background-color: #fff3cd; }
        .status-ش { background-color: #d1ecf1; }
        .status-ت { background-color: #e2e3e5; }
        .status-ب { background-color: #cce5ff; }
        .status-ن { background-color: #ffeeba; }
    `;
    
    // إضافة التنسيق إلى المحتوى
    tempDiv.appendChild(style);
    
    // إنشاء خيارات PDF
    const pdfOptions = {
        margin: 10,
        filename: `الحضور_والغياب_${document.getElementById('extract-month')?.textContent || ''}_${document.getElementById('extract-year')?.textContent || ''}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a3', orientation: 'landscape' }
    };
    
    // تصدير إلى PDF
    html2pdf().from(tempDiv).set(pdfOptions).save();
    
    // إغلاق مربع الحوار
    closeDialog('export-pdf-dialog');
}

// إضافة مربع حوار تصدير PDF إلى HTML
document.addEventListener('DOMContentLoaded', function() {
    // التحقق من وجود مربع الحوار
    if (!document.getElementById('export-pdf-dialog')) {
        // إنشاء مربع حوار تصدير PDF
        const dialogHTML = `
        <div id="export-pdf-dialog" class="dialog" style="display: none;">
            <h2>تصدير إلى PDF</h2>
            <p>الرجاء اختيار الأقسام التي تريد تصديرها:</p>
            <div class="export-options">
                <div class="option">
                    <input type="radio" id="export-all-departments" name="export-departments" value="all" checked>
                    <label for="export-all-departments">جميع الأقسام</label>
                </div>
                <div class="option">
                    <input type="radio" id="export-single-department" name="export-departments" value="single">
                    <label for="export-single-department">قسم محدد:</label>
                    <select id="export-department-select" disabled>
                        <option value="cleaning">النظافة</option>
                        <option value="electricity">الكهرباء</option>
                        <option value="agriculture">الزراعة</option>
                        <option value="civil-works">الأعمال المدنية</option>
                        <option value="mechanical">الميكانيكا</option>
                        <option value="laundry">المغسلة</option>
                        <option value="patient-services">خدمات المرضى</option>
                    </select>
                </div>
            </div>
            <div class="buttons">
                <button onclick="exportToPDF()">تصدير</button>
                <button onclick="closeDialog('export-pdf-dialog')">إلغاء</button>
            </div>
        </div>
        `;
        
        // إضافة مربع الحوار إلى نهاية الصفحة
        document.body.insertAdjacentHTML('beforeend', dialogHTML);
        
        // إضافة مستمع حدث لتفعيل/تعطيل قائمة الأقسام
        document.addEventListener('click', function(event) {
            if (event.target && event.target.id === 'export-single-department') {
                document.getElementById('export-department-select').disabled = false;
            } else if (event.target && event.target.id === 'export-all-departments') {
                document.getElementById('export-department-select').disabled = true;
            }
        });
    }
    
    // تنسيق CSS إضافي لمربع حوار تصدير PDF
    const style = document.createElement('style');
    style.textContent = `
        .export-options {
            margin: 15px 0;
        }
        
        .export-options .option {
            margin-bottom: 10px;
        }
        
        #export-department-select {
            margin-right: 10px;
            padding: 5px;
            border-radius: 5px;
            border: 1px solid #ddd;
        }
    `;
    
    document.head.appendChild(style);
});
