// Admin Offices Employee Delete Index Fix
// Fixes wrong employee name/delete target in management dialog after search/sort or duplicate/empty iqama IDs.
// Adds safe employee transfer between admin office sites without changing calculations or storage keys.
// Adds missing DEFAULT_TITLES guard used by the title editor.
(function () {
  'use strict';

  if (!window.DEFAULT_TITLES) {
    window.DEFAULT_TITLES = {
      attendanceMainTitle: 'بيان الحضور والانصراف لمنسوبي {companyName} بموقع {centerName} عن الفترة من {startDate} إلى {endDate}',
      performanceMainTitle: 'شهادة تقييم الأداء الشهري',
      achievementMainTitle: 'شهادة الاستحقاق الشهري',
      achievementSubTitle: 'عن أعمال الصيانة والنظافة والتشغيل غير الطبي',
      grandMainTitle: 'الشهادة الإجمالية للمكاتب الإدارية والمرافق الصحية',
      grandSubTitle: 'إجمالي صافي الاستحقاق لجميع المواقع'
    };
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getNames() {
    if (typeof getCenterNames === 'function') return getCenterNames();
    return readJson('adminOfficeNames_v1', {});
  }

  function getData() {
    if (typeof getAttendanceData === 'function') return getAttendanceData();
    return readJson('adminOfficesAttendanceData_v1', {});
  }

  function saveData(data) {
    if (typeof saveAttendanceData === 'function') return saveAttendanceData(data);
    localStorage.setItem('adminOfficesAttendanceData_v1', JSON.stringify(data || {}));
  }

  function getSortOrder() {
    try {
      if (typeof currentSortOrder !== 'undefined') return currentSortOrder;
    } catch (_) {}
    return 'asc';
  }

  function sortedCenterKeys(names) {
    return Object.keys(names || {}).sort((a, b) => {
      if (a.startsWith('center_') && b.startsWith('center_')) {
        return (parseInt(a.split('_')[1], 10) || 0) - (parseInt(b.split('_')[1], 10) || 0);
      }
      if (a.startsWith('center_')) return -1;
      if (b.startsWith('center_')) return 1;
      return String(names[a] || a).localeCompare(String(names[b] || b), 'ar');
    });
  }

  function closeTransferDialog() {
    const dlg = document.getElementById('admin-office-transfer-dialog');
    const overlay = document.getElementById('admin-office-transfer-overlay');
    if (dlg) dlg.remove();
    if (overlay) overlay.remove();
  }

  function refreshAfterChange(centerKey) {
    try { window.displayEmployeesForCenter(centerKey); } catch (_) {}
    try { if (typeof renderCenterIcons === 'function') renderCenterIcons(); } catch (_) {}
    try { if (typeof calculateAndDisplayGrandTotal === 'function') calculateAndDisplayGrandTotal(); } catch (_) {}
    try { if (typeof updateGrandTotal === 'function') updateGrandTotal(); } catch (_) {}
    try {
      if (typeof showCenterDetails === 'function' && document.getElementById('center-details-view')?.style.display !== 'none') {
        showCenterDetails(centerKey);
      }
    } catch (_) {}
  }

  window.displayEmployeesForCenter = function displayEmployeesForCenterPatched(centerKey) {
    if (!centerKey) return;

    window.activeCenterKeyForManagement = centerKey;
    try {
      if (typeof activeCenterKeyForManagement !== 'undefined') activeCenterKeyForManagement = centerKey;
    } catch (_) {}

    const contentArea = document.getElementById('management-content-area');
    const title = document.getElementById('content-title');
    const addButton = document.getElementById('add-employee-btn');
    const searchInput = String(document.getElementById('employee-search-input')?.value || '').toLowerCase();
    if (!contentArea || !title || !addButton) return;

    const names = getNames();
    const centerName = names[centerKey] || centerKey;
    title.innerHTML = `<i class="fas fa-users"></i> موظفو موقع: <strong>${esc(centerName)}</strong>`;
    addButton.style.display = 'inline-flex';

    const allData = getData();
    const originalRows = Array.isArray(allData[centerKey]) ? allData[centerKey] : [];

    let rowsForDisplay = originalRows.map((emp, originalIndex) => ({ emp, originalIndex }));

    if (searchInput) {
      rowsForDisplay = rowsForDisplay.filter(({ emp }) => {
        emp = emp || {};
        return String(emp.name || '').toLowerCase().includes(searchInput)
          || String(emp.iqamaId || '').toLowerCase().includes(searchInput)
          || String(emp.jobTitle || '').toLowerCase().includes(searchInput);
      });
    }

    rowsForDisplay.sort((a, b) => {
      const nameA = String(a.emp?.name || '').toLowerCase();
      const nameB = String(b.emp?.name || '').toLowerCase();
      if (nameA < nameB) return getSortOrder() === 'asc' ? -1 : 1;
      if (nameA > nameB) return getSortOrder() === 'asc' ? 1 : -1;
      return a.originalIndex - b.originalIndex;
    });

    contentArea.innerHTML = '';
    if (!rowsForDisplay.length) {
      contentArea.innerHTML = '<p class="info-text-v3"><i class="fas fa-exclamation-circle"></i> لا يوجد موظفون يطابقون البحث أو في هذا الموقع.</p>';
      return;
    }

    rowsForDisplay.forEach(({ emp, originalIndex }) => {
      const card = document.createElement('div');
      card.className = 'employee-card-v3';
      card.innerHTML = `
        <div class="employee-details">
          <strong class="employee-name">${esc(emp.name || '')}</strong>
          <span class="employee-job">${esc(emp.jobTitle || '')}</span>
          <div class="employee-meta">
            <span><i class="fas fa-id-card"></i> ${esc(emp.iqamaId || 'لا يوجد')}</span>
            <span><i class="fas fa-flag"></i> ${esc(emp.nationality || '')}</span>
            <span><i class="fas fa-layer-group"></i> فئة ${esc(emp.category || '')}</span>
          </div>
        </div>
        <div class="employee-actions">
          <button title="تعديل بيانات الموظف" class="action-btn btn-edit" onclick="openEditEmployeeForm('${centerKey}', ${originalIndex})"><i class="fas fa-pencil-alt"></i></button>
          <button title="تعديل الحضور الجماعي" class="action-btn btn-attendance" onclick="openBulkAttendanceForm('${centerKey}', ${originalIndex})"><i class="fas fa-calendar-alt"></i></button>
          <button title="نقل الموظف لموقع آخر" class="action-btn btn-transfer" style="background:#2563eb;color:white" onclick="openTransferEmployeeDialog('${centerKey}', ${originalIndex})"><i class="fas fa-exchange-alt"></i></button>
          <button title="حذف الموظف" class="action-btn btn-danger" onclick="confirmDeleteEmployee('${centerKey}', ${originalIndex})"><i class="fas fa-trash"></i></button>
        </div>
      `;
      contentArea.appendChild(card);
    });
  };

  window.openTransferEmployeeDialog = function openTransferEmployeeDialog(centerKey, empIndex) {
    const data = getData();
    const rows = Array.isArray(data[centerKey]) ? data[centerKey] : [];
    const employee = rows[empIndex];
    const names = getNames();

    if (!employee) {
      alert('تعذر تحديد الموظف المطلوب نقله. أعد فتح شاشة الإدارة وحاول مرة أخرى.');
      return;
    }

    const targetOptions = sortedCenterKeys(names)
      .filter(key => key !== centerKey)
      .map(key => `<option value="${esc(key)}">${esc(names[key] || key)}</option>`)
      .join('');

    if (!targetOptions) {
      alert('لا يوجد موقع آخر متاح لنقل الموظف إليه.');
      return;
    }

    closeTransferDialog();

    const overlay = document.createElement('div');
    overlay.id = 'admin-office-transfer-overlay';
    overlay.className = 'overlay';
    overlay.style.display = 'block';
    overlay.onclick = closeTransferDialog;

    const dlg = document.createElement('div');
    dlg.id = 'admin-office-transfer-dialog';
    dlg.className = 'dialog';
    dlg.style.display = 'block';
    dlg.style.maxWidth = '560px';
    dlg.innerHTML = `
      <div class="dialog-header">
        <h3><i class="fas fa-exchange-alt"></i> نقل موظف</h3>
        <span class="close" onclick="closeTransferEmployeeDialog()">×</span>
      </div>
      <div class="dialog-body">
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:12px;margin-bottom:14px;line-height:1.8">
          <div><strong>الموظف:</strong> ${esc(employee.name || 'بدون اسم')}</div>
          <div><strong>الوظيفة:</strong> ${esc(employee.jobTitle || '')}</div>
          <div><strong>من موقع:</strong> ${esc(names[centerKey] || centerKey)}</div>
        </div>
        <div class="form-group">
          <label for="admin-office-transfer-target">اختر الموقع الجديد:</label>
          <select id="admin-office-transfer-target">${targetOptions}</select>
        </div>
        <p class="info-text-v3" style="margin-top:10px">سيتم نقل نفس بيانات الموظف ونفس أيام الحضور كما هي، بدون تغيير الحسابات أو الحفظ.</p>
      </div>
      <div class="dialog-footer" style="display:flex;gap:10px;justify-content:flex-end;padding:12px 16px;border-top:1px solid #e5e7eb">
        <button class="btn btn-secondary" onclick="closeTransferEmployeeDialog()">إلغاء</button>
        <button class="btn btn-success" onclick="confirmTransferEmployee('${centerKey}', ${empIndex})"><i class="fas fa-check"></i> نقل الموظف</button>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(dlg);
  };

  window.closeTransferEmployeeDialog = closeTransferDialog;

  window.confirmTransferEmployee = function confirmTransferEmployee(centerKey, empIndex) {
    const targetKey = document.getElementById('admin-office-transfer-target')?.value;
    const data = getData();
    const sourceRows = Array.isArray(data[centerKey]) ? data[centerKey] : [];
    const employee = sourceRows[empIndex];
    const names = getNames();

    if (!targetKey || targetKey === centerKey) {
      alert('اختر موقعاً مختلفاً للنقل.');
      return;
    }

    if (!employee) {
      alert('تعذر تحديد الموظف المطلوب نقله. أعد فتح شاشة الإدارة وحاول مرة أخرى.');
      closeTransferDialog();
      return;
    }

    const employeeName = employee.name || 'بدون اسم';
    if (!confirm(`تأكيد نقل الموظف "${employeeName}" من "${names[centerKey] || centerKey}" إلى "${names[targetKey] || targetKey}"؟`)) return;

    const movedEmployee = sourceRows.splice(empIndex, 1)[0];
    if (!Array.isArray(data[targetKey])) data[targetKey] = [];
    data[targetKey].push(movedEmployee);
    data[centerKey] = sourceRows;

    saveData(data);
    closeTransferDialog();

    try { if (typeof showSuccessMessage === 'function') showSuccessMessage(`تم نقل الموظف "${employeeName}" بنجاح.`); } catch (_) {}
    refreshAfterChange(centerKey);
  };

  window.confirmDeleteEmployee = function confirmDeleteEmployeePatched(centerKey, empIndex) {
    const data = getData();
    const rows = Array.isArray(data[centerKey]) ? data[centerKey] : [];
    const employee = rows[empIndex];

    if (!employee) {
      alert('تعذر تحديد الموظف المطلوب حذفه. أعد فتح شاشة الإدارة وحاول مرة أخرى.');
      return;
    }

    const employeeName = employee.name || 'بدون اسم';
    if (!confirm(`هل أنت متأكد من حذف الموظف "${employeeName}"؟ لا يمكن التراجع عن هذا الإجراء.`)) return;

    rows.splice(empIndex, 1);
    data[centerKey] = rows;
    saveData(data);

    try { if (typeof showSuccessMessage === 'function') showSuccessMessage(`تم حذف الموظف "${employeeName}" بنجاح.`); } catch (_) {}
    refreshAfterChange(centerKey);
  };

  console.info('[Admin Offices Employee Tools] delete index + compact transfer + titles guard installed v3');
})();