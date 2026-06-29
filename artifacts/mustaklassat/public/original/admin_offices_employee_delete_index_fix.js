// Admin Offices Employee Delete Index Fix
// Fixes wrong employee name/delete target in management dialog after search/sort or duplicate/empty iqama IDs.
(function () {
  'use strict';

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
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
    title.innerHTML = `<i class="fas fa-users"></i> موظفو موقع: <strong>${centerName}</strong>`;
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
          <strong class="employee-name">${emp.name || ''}</strong>
          <span class="employee-job">${emp.jobTitle || ''}</span>
          <div class="employee-meta">
            <span><i class="fas fa-id-card"></i> ${emp.iqamaId || 'لا يوجد'}</span>
            <span><i class="fas fa-flag"></i> ${emp.nationality || ''}</span>
            <span><i class="fas fa-layer-group"></i> فئة ${emp.category || ''}</span>
          </div>
        </div>
        <div class="employee-actions">
          <button title="تعديل بيانات الموظف" class="action-btn btn-edit" onclick="openEditEmployeeForm('${centerKey}', ${originalIndex})"><i class="fas fa-pencil-alt"></i></button>
          <button title="تعديل الحضور الجماعي" class="action-btn btn-attendance" onclick="openBulkAttendanceForm('${centerKey}', ${originalIndex})"><i class="fas fa-calendar-alt"></i></button>
          <button title="حذف الموظف" class="action-btn btn-danger" onclick="confirmDeleteEmployee('${centerKey}', ${originalIndex})"><i class="fas fa-trash"></i></button>
        </div>
      `;
      contentArea.appendChild(card);
    });
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
    try { window.displayEmployeesForCenter(centerKey); } catch (_) {}
    try { if (typeof renderCenterIcons === 'function') renderCenterIcons(); } catch (_) {}
    try { if (typeof calculateAndDisplayGrandTotal === 'function') calculateAndDisplayGrandTotal(); } catch (_) {}
  };
})();
