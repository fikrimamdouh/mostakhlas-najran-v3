// Merge offices/admin offices department into workshops in job positions upload.
// Scope: job-positions-upload.html only.
(function () {
  'use strict';

  function normalize(value) {
    return String(value || '')
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه');
  }

  function isOfficesOrWorkshops(value) {
    const t = normalize(value);
    return t.includes('ورش') ||
      t.includes('مكاتب') ||
      t.includes('المكاتب') ||
      t.includes('مكتب') ||
      t.includes('المكتب') ||
      t.includes('صيانة واصلاح السيارات') ||
      t.includes('صيانه واصلاح السيارات') ||
      t.includes('صيانة وإصلاح السيارات');
  }

  function patch() {
    if (!window.JobPositionsDB || window.JobPositionsDB.__officesWorkshopsMerged) return;

    if (JobPositionsDB.DEPT_LABELS) {
      JobPositionsDB.DEPT_LABELS.workshops = 'المكاتب والورش';
    }

    if (JobPositionsDB.DEPT_MAP) {
      [
        'ورش', 'الورش', 'قسم الورش',
        'المكاتب', 'مكاتب', 'قسم المكاتب', 'المكاتب الإدارية', 'المكاتب الادارية',
        'مكتب', 'المكتب', 'قسم المكتب',
        'صيانة وإصلاح السيارات', 'صيانة واصلاح السيارات', 'صيانة السيارات'
      ].forEach(name => { JobPositionsDB.DEPT_MAP[name] = 'workshops'; });
    }

    const oldMapDept = JobPositionsDB.mapDept;
    JobPositionsDB.mapDept = function mergedOfficesWorkshopsMapDept(value) {
      if (isOfficesOrWorkshops(value)) return 'workshops';
      return typeof oldMapDept === 'function' ? oldMapDept(value) : null;
    };

    JobPositionsDB.__officesWorkshopsMerged = true;
  }

  patch();
  document.addEventListener('DOMContentLoaded', patch);
})();
