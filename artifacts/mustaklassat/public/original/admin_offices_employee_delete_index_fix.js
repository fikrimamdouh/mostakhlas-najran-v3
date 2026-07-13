// Admin Offices Employee Management Tools — V4
// Fixes wrong employee target after search/sort/duplicate empty iqama IDs.
// Adds safe employee transfer between admin office sites.
// Fixes employee edit save when iqama is blank and preserves current non-default nationality.
// Adds missing DEFAULT_TITLES guard used by the title editor.
(function () {
  'use strict';

  if (!/admin_offices_attendance\.html|original-viewer\?page=admin_offices_attendance\.html/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_EMPLOYEE_TOOLS_V4__) return;
  window.__ADMIN_OFFICES_EMPLOYEE_TOOLS_V4__ = true;

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
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function clean(v) { return String(v == null ? '' : v).replace(/[\u200e\u200f]/g, '').replace(/\s+/g, ' ').trim(); }
  function getNames() { return typeof getCenterNames === 'function' ? getCenterNames() : readJson('adminOfficeNames_v1', {}); }
  function getData() { return typeof getAttendanceData === 'function' ? getAttendanceData() : readJson('adminOfficesAttendanceData_v1', {}); }
  function saveData(data) {
    if (typeof saveAttendanceData === 'function') return saveAttendanceData(data);
    localStorage.setItem('adminOfficesAttendanceData_v1', JSON.stringify(data || {}));
  }
  function getSortOrder() {
    try { if (typeof currentSortOrder !== 'undefined') return currentSortOrder; } catch (_) {}
    return 'asc';
  }
  function sortedCenterKeys(names) {
    return Object.keys(names || {}).sort((a, b) => {
      if (a.startsWith('center_') && b.startsWith('center_')) return (parseInt(a.split('_')[1], 10) || 0) - (parseInt(b.split('_')[1], 10) || 0);
      if (a.startsWith('center_')) return -1;
      if (b.startsWith('center_')) return 1;
      return String(names[a] || a).localeCompare(String(names[b] || b), 'ar');
    });
  }
  function refreshAfterChange(centerKey) {
    try { window.displayEmployeesForCenter(centerKey); } catch (_) {}
    try { if (typeof renderCenterIcons === 'function') renderCenterIcons(); } catch (_) {}
    try { if (typeof calculateAndDisplayGrandTotal === 'function') calculateAndDisplayGrandTotal(); } catch (_) {}
    try { if (typeof updateGrandTotal === 'function') updateGrandTotal(); } catch (_) {}
    try {
      const detailsVisible = document.getElementById('center-details-view')?.style.display !== 'none';
      const active = document.querySelector('.tab-link.active[data-center-key]')?.dataset?.centerKey;
      if (detailsVisible && active === centerKey) {
        if (typeof renderAttendanceTable === 'function') renderAttendanceTable(centerKey);
        else if (typeof populateAttendanceTableBody === 'function') populateAttendanceTableBody(centerKey);
      }
    } catch (_) {}
    try { if (window.AdminOfficesAttendancePersistence?.snapshot) window.AdminOfficesAttendancePersistence.snapshot(); } catch (_) {}
  }

  function nationalityOptions(currentNationality) {
    const defaults = ['سعودي', 'مصري', 'هندي', 'باكستاني', 'فلبيني', 'بنجلادش', 'بنجلاديشي', 'أخرى'];
    const list = [...new Set(defaults.concat(clean(currentNationality) ? [clean(currentNationality)] : []))];
    return list.map(n => `<option value="${esc(n)}" ${n === clean(currentNationality) ? 'selected' : ''}>${esc(n)}</option>`).join('');
  }

  window.getEmployeeFormHTML = function getEmployeeFormHTMLPatched(employee = {}) {
    return `
      <div class="edit-form-container">
        <fieldset>
          <legend>البيانات الأساسية</legend>
          <div class="form-group"><label for="emp-name">اسم الموظف:</label><input type="text" id="emp-name" value="${esc(employee.name || '')}"></div>
          <div class="form-group"><label for="emp-job">المسمى الوظيفي:</label><input type="text" id="emp-job" value="${esc(employee.jobTitle || '')}"></div>
          <div class="form-group"><label for="emp-iqama">رقم الإقامة/الهوية:</label><input type="text" id="emp-iqama" value="${esc(employee.iqamaId || '')}" placeholder="اختياري للصفوف الشاغرة أو غير المكتملة"></div>
        </fieldset>
        <fieldset>
          <legend>البيانات المالية والإدارية</legend>
          <div class="form-group"><label for="emp-salary">التكلفة الشهرية:</label><input type="number" id="emp-salary" value="${Number(employee.salary || 0)}"></div>
          <div class="form-group"><label for="emp-category">الفئة:</label><select id="emp-category">${[1,2,3,4,5,6,7].map(n => `<option value="${n}" ${String(n) === String(employee.category || '') ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
          <div class="form-group"><label for="emp-nationality">الجنسية:</label><select id="emp-nationality">${nationalityOptions(employee.nationality)}</select></div>
          <div class="form-group"><label for="emp-nationality-fine">غرامة جنسية:</label><input type="number" id="emp-nationality-fine" value="${Number(employee.nationalityFine || 0)}"></div>
        </fieldset>
      </div>
    `;
  };

  function closeTransferDialog() {
    const dlg = document.getElementById('admin-office-transfer-dialog');
    const overlay = document.getElementById('admin-office-transfer-overlay');
    if (dlg) dlg.remove();
    if (overlay) overlay.remove();
  }

  window.displayEmployeesForCenter = function displayEmployeesForCenterPatched(centerKey) {
    if (!centerKey) return;
    window.activeCenterKeyForManagement = centerKey;
    try { if (typeof activeCenterKeyForManagement !== 'undefined') activeCenterKeyForManagement = centerKey; } catch (_) {}

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
    let rowsForDisplay = originalRows.map((emp, originalIndex) => ({ emp: emp || {}, originalIndex }));

    if (searchInput) {
      rowsForDisplay = rowsForDisplay.filter(({ emp }) =>
        String(emp.name || '').toLowerCase().includes(searchInput) ||
        String(emp.iqamaId || '').toLowerCase().includes(searchInput) ||
        String(emp.jobTitle || '').toLowerCase().includes(searchInput) ||
        String(emp.nationality || '').toLowerCase().includes(searchInput)
      );
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
      card.setAttribute('data-center-key', centerKey);
      card.setAttribute('data-original-index', String(originalIndex));
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
        </div>`;
      contentArea.appendChild(card);
    });
  };

  window.openEditEmployeeForm = function openEditEmployeeFormPatched(centerKey, empIndex) {
    const data = getData();
    const rows = Array.isArray(data[centerKey]) ? data[centerKey] : [];
    const employee = rows[empIndex];
    if (!employee) {
      void window.NajranDialogs.alert('تعذر تحديد الموظف المطلوب تعديله. أعد فتح شاشة الإدارة وحاول مرة أخرى.');
      return;
    }
    const content = `
      <div class="dialog-header">
        <h3><i class="fas fa-pencil-alt"></i> تعديل بيانات: ${esc(employee.name || 'بدون اسم')}</h3>
        <span class="close" onclick="closeDialog('form-dialog')">×</span>
      </div>
      <div class="dialog-body">${window.getEmployeeFormHTML(employee)}</div>
      <div class="dialog-footer">
        <button class="btn btn-secondary" onclick="closeDialog('form-dialog')">إلغاء</button>
        <button class="btn btn-success" onclick="saveEmployeeChanges('${centerKey}', ${empIndex})"><i class="fas fa-save"></i> حفظ التغييرات</button>
      </div>`;
    if (typeof openDialog === 'function') openDialog(content, 'form-dialog', false);
  };

  window.addEmployeeFromForm = function addEmployeeFromFormPatched() {
    const centerKey = window.activeCenterKeyForManagement || (typeof activeCenterKeyForManagement !== 'undefined' ? activeCenterKeyForManagement : '');
    if (!centerKey) return void window.NajranDialogs.alert('الرجاء اختيار موقع أولاً.');
    const name = clean(document.getElementById('emp-name')?.value);
    const jobTitle = clean(document.getElementById('emp-job')?.value);
    const iqamaId = clean(document.getElementById('emp-iqama')?.value);
    const salary = parseFloat(document.getElementById('emp-salary')?.value) || 0;
    const category = document.getElementById('emp-category')?.value || '7';
    const nationality = document.getElementById('emp-nationality')?.value || 'سعودي';
    const nationalityFine = parseFloat(document.getElementById('emp-nationality-fine')?.value) || 0;
    if (!name || !jobTitle) return void window.NajranDialogs.alert('الرجاء ملء الاسم والمسمى الوظيفي. رقم الإقامة اختياري.');

    const data = getData();
    if (iqamaId) {
      for (const officeKey in data) {
        const rows = Array.isArray(data[officeKey]) ? data[officeKey] : [];
        if (rows.some(emp => clean(emp && emp.iqamaId) === iqamaId)) return void window.NajranDialogs.alert('خطأ: رقم الإقامة مسجل بالفعل لموظف آخر.');
      }
    }
    if (!Array.isArray(data[centerKey])) data[centerKey] = [];
    const daysInExtract = typeof getExtractPeriodDetails === 'function' ? (getExtractPeriodDetails().daysInExtract || 30) : 30;
    data[centerKey].push({ jobTitle, name, salary, category, nationality, iqamaId, nationalityFine, days: Array(daysInExtract).fill('ح') });
    saveData(data);
    try { if (typeof showSuccessMessage === 'function') showSuccessMessage(`تم إضافة الموظف "${name}" بنجاح.`); } catch (_) {}
    try { if (typeof closeDialog === 'function') closeDialog('form-dialog'); } catch (_) {}
    refreshAfterChange(centerKey);
  };

  window.saveEmployeeChanges = function saveEmployeeChangesPatched(centerKey, empIndex) {
    const data = getData();
    const rows = Array.isArray(data[centerKey]) ? data[centerKey] : [];
    const employee = rows[empIndex];
    if (!employee) return void window.NajranDialogs.alert('تعذر تحديد الموظف المطلوب تعديله. أعد فتح شاشة الإدارة وحاول مرة أخرى.');

    const name = clean(document.getElementById('emp-name')?.value);
    const jobTitle = clean(document.getElementById('emp-job')?.value);
    const iqamaId = clean(document.getElementById('emp-iqama')?.value);
    const salary = parseFloat(document.getElementById('emp-salary')?.value) || 0;
    const category = document.getElementById('emp-category')?.value || employee.category || '7';
    const nationality = document.getElementById('emp-nationality')?.value || employee.nationality || 'سعودي';
    const nationalityFine = parseFloat(document.getElementById('emp-nationality-fine')?.value);

    if (!name || !jobTitle) return void window.NajranDialogs.alert('الرجاء ملء الاسم والمسمى الوظيفي. رقم الإقامة اختياري.');

    if (iqamaId) {
      for (const officeKey in data) {
        const officeRows = Array.isArray(data[officeKey]) ? data[officeKey] : [];
        for (let i = 0; i < officeRows.length; i++) {
          if (officeKey === centerKey && i === empIndex) continue;
          if (clean(officeRows[i]?.iqamaId) && clean(officeRows[i]?.iqamaId) === iqamaId) {
            return void window.NajranDialogs.alert('خطأ: رقم الإقامة مسجل بالفعل لموظف آخر.');
          }
        }
      }
    }

    rows[empIndex] = Object.assign({}, employee, {
      name,
      jobTitle,
      iqamaId,
      salary,
      category,
      nationality,
      nationalityFine: Number.isFinite(nationalityFine) ? nationalityFine : (parseFloat(employee.nationalityFine) || 0)
    });
    data[centerKey] = rows;
    saveData(data);
    try { if (typeof showSuccessMessage === 'function') showSuccessMessage(`تم تحديث بيانات "${name}" بنجاح.`); } catch (_) {}
    try { if (typeof closeDialog === 'function') closeDialog('form-dialog'); } catch (_) {}
    refreshAfterChange(centerKey);
    try {
      if (typeof window.najranSyncNow === 'function') {
        window.najranSyncNow().catch(function (err) {
          console.warn('[Admin Offices Employee Edit] تعذر الرفع السحابي بعد تعديل الموظف، محفوظ محليًا:', err);
        });
      }
    } catch (_) {}
  };

  window.openTransferEmployeeDialog = function openTransferEmployeeDialog(centerKey, empIndex) {
    const data = getData();
    const rows = Array.isArray(data[centerKey]) ? data[centerKey] : [];
    const employee = rows[empIndex];
    const names = getNames();
    if (!employee) return void window.NajranDialogs.alert('تعذر تحديد الموظف المطلوب نقله. أعد فتح شاشة الإدارة وحاول مرة أخرى.');
    const targetOptions = sortedCenterKeys(names).filter(key => key !== centerKey).map(key => `<option value="${esc(key)}">${esc(names[key] || key)}</option>`).join('');
    if (!targetOptions) return void window.NajranDialogs.alert('لا يوجد موقع آخر متاح لنقل الموظف إليه.');
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
      <div class="dialog-header"><h3><i class="fas fa-exchange-alt"></i> نقل موظف</h3><span class="close" onclick="closeTransferEmployeeDialog()">×</span></div>
      <div class="dialog-body">
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:12px;margin-bottom:14px;line-height:1.8">
          <div><strong>الموظف:</strong> ${esc(employee.name || 'بدون اسم')}</div>
          <div><strong>الوظيفة:</strong> ${esc(employee.jobTitle || '')}</div>
          <div><strong>من موقع:</strong> ${esc(names[centerKey] || centerKey)}</div>
        </div>
        <div class="form-group"><label for="admin-office-transfer-target">اختر الموقع الجديد:</label><select id="admin-office-transfer-target">${targetOptions}</select></div>
        <p class="info-text-v3" style="margin-top:10px">سيتم نقل نفس بيانات الموظف ونفس أيام الحضور كما هي.</p>
      </div>
      <div class="dialog-footer" style="display:flex;gap:10px;justify-content:flex-end;padding:12px 16px;border-top:1px solid #e5e7eb">
        <button class="btn btn-secondary" onclick="closeTransferEmployeeDialog()">إلغاء</button>
        <button class="btn btn-success" onclick="confirmTransferEmployee('${centerKey}', ${empIndex})"><i class="fas fa-check"></i> نقل الموظف</button>
      </div>`;
    document.body.appendChild(overlay);
    document.body.appendChild(dlg);
  };

  window.closeTransferEmployeeDialog = closeTransferDialog;

  window.confirmTransferEmployee = async function confirmTransferEmployee(centerKey, empIndex) {
    const targetKey = document.getElementById('admin-office-transfer-target')?.value;
    const data = getData();
    const sourceRows = Array.isArray(data[centerKey]) ? data[centerKey] : [];
    const employee = sourceRows[empIndex];
    const names = getNames();
    if (!targetKey || targetKey === centerKey) return void window.NajranDialogs.alert('اختر موقعًا مختلفًا للنقل.');
    if (!employee) { closeTransferDialog(); return void window.NajranDialogs.alert('تعذر تحديد الموظف المطلوب نقله.'); }
    const employeeName = employee.name || 'بدون اسم';
    if (!await window.NajranDialogs.confirm(`تأكيد نقل الموظف "${employeeName}" من "${names[centerKey] || centerKey}" إلى "${names[targetKey] || targetKey}"؟`)) return;
    const movedEmployee = sourceRows.splice(empIndex, 1)[0];
    if (!Array.isArray(data[targetKey])) data[targetKey] = [];
    data[targetKey].push(movedEmployee);
    data[centerKey] = sourceRows;
    saveData(data);
    closeTransferDialog();
    try { if (typeof showSuccessMessage === 'function') showSuccessMessage(`تم نقل الموظف "${employeeName}" بنجاح.`); } catch (_) {}
    refreshAfterChange(centerKey);
  };

  window.confirmDeleteEmployee = async function confirmDeleteEmployeePatched(centerKey, empIndex) {
    const data = getData();
    const rows = Array.isArray(data[centerKey]) ? data[centerKey] : [];
    const employee = rows[empIndex];
    if (!employee) return void window.NajranDialogs.alert('تعذر تحديد الموظف المطلوب حذفه. أعد فتح شاشة الإدارة وحاول مرة أخرى.');
    const employeeName = employee.name || 'بدون اسم';
    if (!await window.NajranDialogs.confirm(`هل أنت متأكد من حذف الموظف "${employeeName}"؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
    rows.splice(empIndex, 1);
    data[centerKey] = rows;
    saveData(data);
    try { if (typeof showSuccessMessage === 'function') showSuccessMessage(`تم حذف الموظف "${employeeName}" بنجاح.`); } catch (_) {}
    refreshAfterChange(centerKey);
  };

  console.info('[Admin Offices Employee Tools] installed v4 robust edit/save/delete/transfer');
})();
