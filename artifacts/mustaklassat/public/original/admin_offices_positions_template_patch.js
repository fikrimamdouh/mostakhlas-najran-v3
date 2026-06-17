// Admin Offices positions template download
// Same workflow as normal attendance: download editable Excel, edit, then import back.
(function () {
  'use strict';

  const WORKSHOP_SITE_NAME = 'الورش (صيانة وإصلاح السيارات)';
  const WORKSHOP_LOCAL_KEY = 'adminOfficeWorkshopJobPositions_v1';

  const DEFAULT_WORKSHOP_POSITIONS = [
    { jobTitle: 'مشرف موقع', salary: 0, category: '5', nationality: 'سعودي' },
    { jobTitle: 'فني ميكانيكا بنزين', salary: 0, category: '4', nationality: 'غير سعودي' },
    { jobTitle: 'فني ميكانيكا ديزل', salary: 0, category: '4', nationality: 'غير سعودي' },
    { jobTitle: 'فني تبريد وتكييف سيارات', salary: 0, category: '4', nationality: 'غير سعودي' },
    { jobTitle: 'فني كهربائي سيارات', salary: 0, category: '4', nationality: 'غير سعودي' },
    { jobTitle: 'فني سمكرة سيارات', salary: 0, category: '4', nationality: 'غير سعودي' },
    { jobTitle: 'دهان سيارات', salary: 0, category: '5', nationality: 'غير سعودي' },
    { jobTitle: 'فني ميزان سيارات', salary: 0, category: '4', nationality: 'غير سعودي' },
    { jobTitle: 'عامل زيت وبنشر', salary: 0, category: '6', nationality: 'غير سعودي' },
    { jobTitle: 'عامل غسيل وتشحيم', salary: 0, category: '6', nationality: 'غير سعودي' }
  ];

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function safeFileName(name) {
    return String(name || 'المكاتب')
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getOfficeNames() {
    if (typeof getCenterNames === 'function') return getCenterNames();
    return readJson('adminOfficeNames_v1', {});
  }

  function getAttendanceRows(centerKey) {
    const data = typeof getAttendanceData === 'function'
      ? getAttendanceData()
      : readJson('adminOfficesAttendanceData_v1', {});
    return Array.isArray(data[centerKey]) ? data[centerKey] : [];
  }

  async function loadSavedPositions(centerKey, centerName) {
    // 1) Existing employee data wins: user can download current data, edit, then import again.
    const currentEmployees = getAttendanceRows(centerKey);
    if (currentEmployees.length) {
      return currentEmployees.map(emp => ({
        name: emp.name || '',
        iqamaId: emp.iqamaId || '',
        jobTitle: emp.jobTitle || '',
        salary: emp.salary || 0,
        category: emp.category || '7',
        nationality: emp.nationality || 'غير سعودي'
      }));
    }

    // 2) Load saved positions from the central job positions store.
    if (window.JobPositionsDB && typeof JobPositionsDB.load === 'function') {
      try {
        const rec = await JobPositionsDB.load(centerName);
        if (rec && Array.isArray(rec.rows) && rec.rows.length) {
          return rec.rows.map(row => ({
            name: '',
            iqamaId: '',
            jobTitle: row.jobTitle || '',
            salary: row.salary || 0,
            category: row.category || '7',
            nationality: row.nationality || 'غير سعودي'
          }));
        }
      } catch (_) {}
    }

    // 3) Workshops local/system seed fallback.
    if (centerKey === 'admin_staff' || centerName === WORKSHOP_SITE_NAME || String(centerName || '').includes('الورش')) {
      const local = readJson(WORKSHOP_LOCAL_KEY, null);
      const rows = Array.isArray(local?.rows) && local.rows.length ? local.rows : DEFAULT_WORKSHOP_POSITIONS;
      return rows.map(row => ({
        name: '',
        iqamaId: '',
        jobTitle: row.jobTitle || '',
        salary: row.salary || 0,
        category: row.category || '7',
        nationality: row.nationality || 'غير سعودي'
      }));
    }

    return [];
  }

  function writeTemplate(centerName, rows) {
    if (typeof XLSX === 'undefined') {
      alert('مكتبة Excel غير محملة. أعد تحميل الصفحة.');
      return;
    }

    const headers = ['اسم الموظف', 'رقم الهوية / الإقامة', 'مسمى الوظيفة', 'التكلفة الشهرية', 'الفئة', 'الجنسية'];
    const data = rows.map(row => [
      row.name || '',
      row.iqamaId || '',
      row.jobTitle || '',
      row.salary || 0,
      row.category || '7',
      row.nationality || 'غير سعودي'
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    ws['!cols'] = [{ wch: 28 }, { wch: 22 }, { wch: 30 }, { wch: 16 }, { wch: 10 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws, safeFileName(centerName).substring(0, 31));
    XLSX.writeFile(wb, 'مناصب-' + safeFileName(centerName) + '.xlsx');
  }

  async function downloadPositionsForOffice(centerKey) {
    const names = getOfficeNames();
    const centerName = names[centerKey] || centerKey;
    const rows = await loadSavedPositions(centerKey, centerName);

    if (!rows.length) {
      alert('لا توجد مناصب محفوظة لهذا المكتب/المرفق حتى الآن.');
      return;
    }

    writeTemplate(centerName, rows);
  }

  function openPositionsDownloadDialog() {
    const names = getOfficeNames();
    const keys = Object.keys(names).sort((a, b) => {
      const aCenter = a.startsWith('center_');
      const bCenter = b.startsWith('center_');
      if (aCenter && bCenter) return parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]);
      if (aCenter && !bCenter) return -1;
      if (!aCenter && bCenter) return 1;
      return a.localeCompare(b);
    });

    const content = `
      <div class="dialog-header">
        <h3><i class="fas fa-briefcase"></i> تحميل مناصب المكاتب</h3>
        <span class="close" onclick="closeDialog('management-dialog')">×</span>
      </div>
      <div class="dialog-body">
        <p class="info-text">اختر المكتب/المرفق لتنزيل Excel قابل للتعديل. إذا كانت هناك بيانات موظفين مستوردة سابقًا ستنزل كما هي، وإذا لا توجد بيانات سينزل تامبلت المناصب المحفوظة.</p>
        <div class="form-group">
          <label for="admin-office-template-center">المكتب/المرفق:</label>
          <select id="admin-office-template-center">
            ${keys.map(key => `<option value="${key}">${names[key]}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="dialog-footer">
        <button class="btn btn-secondary" onclick="closeDialog('management-dialog')">إلغاء</button>
        <button class="btn btn-success" onclick="window.downloadAdminOfficePositionsTemplateFromDialog()"><i class="fas fa-file-excel"></i> تحميل Excel</button>
      </div>
    `;

    if (typeof openDialog === 'function') openDialog(content, 'management-dialog', false);
    else alert('نافذة التحميل غير جاهزة. أعد تحميل الصفحة.');
  }

  window.openAdminOfficesPositionsTemplateDialog = openPositionsDownloadDialog;

  window.downloadAdminOfficePositionsTemplateFromDialog = async function () {
    const selected = document.getElementById('admin-office-template-center')?.value;
    if (!selected) {
      alert('اختر المكتب/المرفق أولاً.');
      return;
    }
    await downloadPositionsForOffice(selected);
    if (typeof closeDialog === 'function') closeDialog('management-dialog');
  };

  function wireButton() {
    const buttons = Array.from(document.querySelectorAll('button'));
    buttons.forEach(btn => {
      const text = (btn.textContent || '').trim();
      if (text.includes('تحميل المناصب')) {
        btn.onclick = openPositionsDownloadDialog;
      }
    });

    const nav = document.getElementById('navigation');
    if (nav) {
      Array.from(nav.options).forEach(opt => {
        if ((opt.textContent || '').includes('تحميل المناصب')) opt.value = '__admin_office_positions_template__';
      });
      const originalChange = nav.onchange;
      nav.onchange = function () {
        if (this.value === '__admin_office_positions_template__') {
          this.value = 'admin_offices_attendance.html';
          openPositionsDownloadDialog();
          return;
        }
        if (typeof originalChange === 'function') return originalChange.call(this);
      };
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireButton);
  else wireButton();
})();