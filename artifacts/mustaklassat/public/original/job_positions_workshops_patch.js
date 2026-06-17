// Workshops fixed positions seed for Admin Offices
// Hidden system seed. No visible button for normal users.
(function () {
  'use strict';

  const WORKSHOP_SITE_NAME = 'الورش (صيانة وإصلاح السيارات)';
  const WORKSHOP_DEPT_KEY = 'workshops';
  const WORKSHOP_DEPT_LABEL = 'الورش';
  const LOCAL_KEY = 'adminOfficeWorkshopJobPositions_v1';
  const SEEDED_KEY = 'adminOfficeWorkshopJobPositions_seeded_v2';

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
    if (!window.JobPositionsDB) return false;

    if (JobPositionsDB.DEPT_LABELS) JobPositionsDB.DEPT_LABELS[WORKSHOP_DEPT_KEY] = WORKSHOP_DEPT_LABEL;
    if (JobPositionsDB.DEPT_MAP) {
      JobPositionsDB.DEPT_MAP['ورش'] = WORKSHOP_DEPT_KEY;
      JobPositionsDB.DEPT_MAP['الورش'] = WORKSHOP_DEPT_KEY;
      JobPositionsDB.DEPT_MAP['صيانة وإصلاح السيارات'] = WORKSHOP_DEPT_KEY;
      JobPositionsDB.DEPT_MAP['صيانة واصلاح السيارات'] = WORKSHOP_DEPT_KEY;
    }

    if (!JobPositionsDB.__workshopsMapPatched) {
      const originalMapDept = JobPositionsDB.mapDept;
      JobPositionsDB.mapDept = function mapDeptWithWorkshops(arabicName) {
        const value = String(arabicName || '').trim();
        if (value.includes('ورش') || value.includes('صيانة وإصلاح السيارات') || value.includes('صيانة واصلاح السيارات')) {
          return WORKSHOP_DEPT_KEY;
        }
        return typeof originalMapDept === 'function' ? originalMapDept(arabicName) : null;
      };
      JobPositionsDB.__workshopsMapPatched = true;
    }

    return true;
  }

  function saveLocalCopy(rows) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify({
      siteName: WORKSHOP_SITE_NAME,
      dept: WORKSHOP_DEPT_KEY,
      rows,
      savedAt: new Date().toISOString()
    }));
  }

  function canSeedServer() {
    try {
      const s = JSON.parse(localStorage.getItem('najran_session') || '{}');
      const role = String(s.role || '').toLowerCase();
      return ['admin', 'super_admin', 'contract_supervisor', 'company_admin'].some(r => role.includes(r));
    } catch (_) {
      return false;
    }
  }

  async function seedWorkshopsSilently() {
    saveLocalCopy(WORKSHOP_POSITIONS);

    if (!window.JobPositionsDB || typeof JobPositionsDB.save !== 'function') return false;
    if (!canSeedServer()) return true;

    const lastSeed = localStorage.getItem(SEEDED_KEY);
    const today = new Date().toISOString().slice(0, 10);
    if (lastSeed === today) return true;

    try {
      await JobPositionsDB.save(WORKSHOP_SITE_NAME, WORKSHOP_POSITIONS);
      localStorage.setItem(SEEDED_KEY, today);
      if (typeof renderSavedList === 'function') await renderSavedList();
      return true;
    } catch (err) {
      console.warn('[workshops-positions] server seed failed; local copy saved only:', err.message);
      return false;
    }
  }

  function removeVisibleLoaderIfAny() {
    const old = document.getElementById('workshopsPositionsLoader');
    if (old) old.remove();
  }

  function bootWithRetry(triesLeft) {
    removeVisibleLoaderIfAny();
    const mapped = patchDeptMapping();
    seedWorkshopsSilently();

    if (!mapped && triesLeft > 0) {
      setTimeout(() => bootWithRetry(triesLeft - 1), 300);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => bootWithRetry(10));
  else bootWithRetry(10);
})();