// Workshops fixed positions loader for Admin Offices
(function () {
  'use strict';

  const WORKSHOP_SITE_NAME = 'الورش (صيانة وإصلاح السيارات)';
  const WORKSHOP_DEPT_KEY = 'workshops';
  const WORKSHOP_DEPT_LABEL = 'الورش';
  const LOCAL_KEY = 'adminOfficeWorkshopJobPositions_v1';

  const WORKSHOP_POSITIONS = [
    { dept: WORKSHOP_DEPT_KEY, jobTitle: 'مشرف موقع', salary: 0, category: '5', nationality: 'سعودي' },
    { dept: WORKSHOP_DEPT_KEY, jobTitle: 'فني ميكانيكا بنزين', salary: 0, category: '4', nationality: 'غير سعودي' },
    { dept: WORKSHOP_DEPT_KEY, jobTitle: 'فني ميكانيكا ديزل', salary: 0, category: '4', nationality: 'غير سعودي' },
    { dept: WORKSHOP_DEPT_KEY, jobTitle: 'فني تبريد وتكييف سيارات', salary: 0, category: '4', nationality: 'غير سعودي' },
    { dept: WORKSHOP_DEPT_KEY, jobTitle: 'فني كهربائي سيارات', salary: 0, category: '4', nationality: 'غير سعودي' },
    { dept: WORKSHOP_DEPT_KEY, jobTitle: 'فني سمكرة سيارات', salary: 0, category: '4', nationality: 'غير سعودي' },
    { dept: WORKSHOP_DEPT_KEY, jobTitle: 'دهان سيارات', salary: 0, category: '5', nationality: 'غير سعودي' },
    { dept: WORKSHOP_DEPT_KEY, jobTitle: 'فني ميزان سيارات', salary: 0, category: '4', nationality: 'غير سعودي' },
    { dept: WORKSHOP_DEPT_KEY, jobTitle: 'عامل زيت وبنشر', salary: 0, category: '6', nationality: 'غير سعودي' },
    { dept: WORKSHOP_DEPT_KEY, jobTitle: 'عامل غسيل وتشحيم', salary: 0, category: '6', nationality: 'غير سعودي' }
  ];

  function patchDeptMapping() {
    if (!window.JobPositionsDB) return;

    if (JobPositionsDB.DEPT_LABELS) JobPositionsDB.DEPT_LABELS[WORKSHOP_DEPT_KEY] = WORKSHOP_DEPT_LABEL;
    if (JobPositionsDB.DEPT_MAP) {
      JobPositionsDB.DEPT_MAP['ورش'] = WORKSHOP_DEPT_KEY;
      JobPositionsDB.DEPT_MAP['الورش'] = WORKSHOP_DEPT_KEY;
      JobPositionsDB.DEPT_MAP['صيانة وإصلاح السيارات'] = WORKSHOP_DEPT_KEY;
      JobPositionsDB.DEPT_MAP['صيانة واصلاح السيارات'] = WORKSHOP_DEPT_KEY;
    }

    const originalMapDept = JobPositionsDB.mapDept;
    JobPositionsDB.mapDept = function mapDeptWithWorkshops(arabicName) {
      const value = String(arabicName || '').trim();
      if (value.includes('ورش') || value.includes('صيانة وإصلاح السيارات') || value.includes('صيانة واصلاح السيارات')) {
        return WORKSHOP_DEPT_KEY;
      }
      return typeof originalMapDept === 'function' ? originalMapDept(arabicName) : null;
    };
  }

  function injectWorkshopsCard() {
    const firstCardBody = document.querySelector('.wrap .card .card-body');
    if (!firstCardBody || document.getElementById('workshopsPositionsLoader')) return;

    const box = document.createElement('div');
    box.id = 'workshopsPositionsLoader';
    box.className = 'info-box';
    box.style.cssText = 'margin-top:14px;background:#f0fdf4;border-color:#bbf7d0;color:#14532d';
    box.innerHTML = `
      <strong>تحميل مناصب الورش فقط</strong>
      <div style="margin-bottom:10px;line-height:1.7">
        يثبت مسميات وظائف <b>${WORKSHOP_SITE_NAME}</b> فقط، بدون التأثير على باقي المستشفيات أو المكاتب.
      </div>
      <button class="btn btn-primary" type="button" onclick="window.loadWorkshopFixedPositions()">
        <i class="fas fa-tools"></i> تحميل مناصب الورش
      </button>
      <button class="btn btn-warning" type="button" onclick="window.previewWorkshopFixedPositions()" style="margin-right:8px">
        <i class="fas fa-eye"></i> معاينة قبل الحفظ
      </button>
    `;
    firstCardBody.appendChild(box);
  }

  function saveLocalCopy(rows) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify({
      siteName: WORKSHOP_SITE_NAME,
      dept: WORKSHOP_DEPT_KEY,
      rows,
      savedAt: new Date().toISOString()
    }));
  }

  window.previewWorkshopFixedPositions = function previewWorkshopFixedPositions() {
    if (!Array.isArray(window.parsedRows)) window.parsedRows = [];
    window.parsedRows = WORKSHOP_POSITIONS.map(row => ({
      hospitalName: WORKSHOP_SITE_NAME,
      deptAr: WORKSHOP_DEPT_LABEL,
      deptKey: WORKSHOP_DEPT_KEY,
      jobTitle: row.jobTitle,
      salary: row.salary,
      category: row.category,
      nationality: row.nationality,
      valid: true
    }));
    if (typeof renderPreview === 'function') renderPreview();
    if (typeof showAlert === 'function') showAlert('تم تجهيز معاينة مناصب الورش. اضغط حفظ المناصب للحفظ.', 'success');
  };

  window.loadWorkshopFixedPositions = async function loadWorkshopFixedPositions() {
    if (!window.JobPositionsDB || typeof JobPositionsDB.save !== 'function') {
      alert('قاعدة مناصب الوظائف غير جاهزة. أعد تحميل الصفحة.');
      return;
    }

    const btn = document.querySelector('#workshopsPositionsLoader .btn-primary');
    const oldHtml = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري حفظ الورش...';
    }

    try {
      await JobPositionsDB.save(WORKSHOP_SITE_NAME, WORKSHOP_POSITIONS);
      saveLocalCopy(WORKSHOP_POSITIONS);
      if (typeof renderSavedList === 'function') await renderSavedList();
      if (typeof showAlert === 'function') showAlert(`✅ تم حفظ ${WORKSHOP_POSITIONS.length} منصب للورش فقط`, 'success');
    } catch (err) {
      saveLocalCopy(WORKSHOP_POSITIONS);
      if (typeof showAlert === 'function') showAlert('تم حفظ نسخة محلية للورش، لكن حفظ السيرفر فشل: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = oldHtml;
      }
    }
  };

  function boot() {
    patchDeptMapping();
    injectWorkshopsCard();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();