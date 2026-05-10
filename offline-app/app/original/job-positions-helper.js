/**
 * JobPositionsDB — حفظ وجلب مناصب الوظائف من IndexedDB
 * يُشارَك بين صفحة رفع المناصب وصفحات الحضور والانصراف
 */
const JobPositionsDB = (function () {
  const DB_NAME = 'najranJobPositions';
  const DB_VER  = 1;
  const STORE   = 'positions';

  function openDB() {
    return new Promise((res, rej) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE))
          db.createObjectStore(STORE, { keyPath: 'hospitalName' });
      };
      req.onsuccess = e => res(e.target.result);
      req.onerror   = e => rej(e.target.error);
    });
  }

  async function save(hospitalName, rows) {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ hospitalName, rows, savedAt: new Date().toISOString() });
      tx.oncomplete = res;
      tx.onerror    = e => rej(e.target.error);
    });
  }

  async function load(hospitalName) {
    const db = await openDB();
    return new Promise((res, rej) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(hospitalName);
      req.onsuccess = e => res(e.target.result || null);
      req.onerror   = e => rej(e.target.error);
    });
  }

  async function loadAll() {
    const db = await openDB();
    return new Promise((res, rej) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      req.onsuccess = e => res(e.target.result || []);
      req.onerror   = e => rej(e.target.error);
    });
  }

  async function remove(hospitalName) {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(hospitalName);
      tx.oncomplete = res;
      tx.onerror    = e => rej(e.target.error);
    });
  }

  // خريطة أسماء الأقسام العربية → مفاتيح الجداول
  const DEPT_MAP = {
    'نظافة':                         'cleaning',
    'النظافة':                        'cleaning',
    'تنظيف':                         'cleaning',
    'كهرباء':                        'electricity',
    'الكهرباء':                       'electricity',
    'كهربا':                         'electricity',
    'زراعة':                         'agriculture',
    'الزراعة':                        'agriculture',
    'مساحات خضراء':                   'agriculture',
    'مدني':                          'civil_works',
    'الأعمال المدنية':                 'civil_works',
    'أعمال مدنية':                    'civil_works',
    'أعمال مدنيه':                    'civil_works',
    'ميكانيكا':                       'mechanical',
    'الميكانيكا':                      'mechanical',
    'ميكانيك':                        'mechanical',
    'ميكانيكي':                       'mechanical',
    'مغسلة':                         'laundry',
    'المغسلة':                        'laundry',
    'غسيل':                          'laundry',
    'خدمات مرضى':                    'patient_services',
    'خدمات المرضى':                   'patient_services',
    'خدمة مرضى':                     'patient_services',
    'وظائف إدارية':                   'admin_saudi',
    'الوظائف الإدارية السعوديين':       'admin_saudi',
    'الوظائف الإدارية':                'admin_saudi',
    'إداري':                          'admin_saudi',
    'إدارية':                         'admin_saudi',
    'وظيفة إدارية':                   'admin_saudi',
  };

  const DEPT_LABELS = {
    cleaning:        'النظافة',
    electricity:     'الكهرباء',
    agriculture:     'الزراعة',
    civil_works:     'الأعمال المدنية',
    mechanical:      'الميكانيكا',
    laundry:         'المغسلة',
    patient_services:'خدمات المرضى',
    admin_saudi:     'الوظائف الإدارية السعوديين',
  };

  function mapDept(arabicName) {
    if (!arabicName) return null;
    const t = arabicName.trim();
    if (DEPT_MAP[t]) return DEPT_MAP[t];
    // بحث جزئي
    for (const [k, v] of Object.entries(DEPT_MAP)) {
      if (t.includes(k) || k.includes(t)) return v;
    }
    return null;
  }

  return { save, load, loadAll, remove, mapDept, DEPT_MAP, DEPT_LABELS };
})();
