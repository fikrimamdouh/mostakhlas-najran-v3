/**
 * JobPositionsDB — حفظ وجلب مناصب الوظائف
 * يحفظ على السيرفر أولاً (دائم) + IndexedDB كـ cache محلي
 * البيانات تبقى حتى بعد تحديث البرنامج أو تغيير الجهاز
 */
const JobPositionsDB = (function () {
  const DB_NAME = 'najranJobPositions';
  const DB_VER  = 1;
  const STORE   = 'positions';

  // ── IndexedDB helpers (cache محلي) ────────────────────────────────────────

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

  async function _idbPut(rec) {
    try {
      const db = await openDB();
      return new Promise((res, rej) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(rec);
        tx.oncomplete = res;
        tx.onerror    = e => rej(e.target.error);
      });
    } catch {}
  }

  async function _idbGet(hospitalName) {
    try {
      const db = await openDB();
      return new Promise((res, rej) => {
        const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(hospitalName);
        req.onsuccess = e => res(e.target.result || null);
        req.onerror   = e => rej(e.target.error);
      });
    } catch { return null; }
  }

  async function _idbGetAll() {
    try {
      const db = await openDB();
      return new Promise((res, rej) => {
        const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
        req.onsuccess = e => res(e.target.result || []);
        req.onerror   = e => rej(e.target.error);
      });
    } catch { return []; }
  }

  async function _idbDelete(hospitalName) {
    try {
      const db = await openDB();
      return new Promise((res, rej) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(hospitalName);
        tx.oncomplete = res;
        tx.onerror    = e => rej(e.target.error);
      });
    } catch {}
  }

  // ── Auth token ────────────────────────────────────────────────────────────

  function _getToken() {
    try {
      return JSON.parse(localStorage.getItem('najran_session') || '{}').clerkToken || null;
    } catch { return null; }
  }

  function _authHeaders() {
    const tok = _getToken();
    const h = { 'Content-Type': 'application/json' };
    if (tok) h['Authorization'] = 'Bearer ' + tok;
    return h;
  }

  // ── Server API ────────────────────────────────────────────────────────────

  /**
   * save — يحفظ على السيرفر (دائم) + IndexedDB cache
   */
  async function save(hospitalName, rows) {
    const rec = { hospitalName, rows, savedAt: new Date().toISOString() };

    // 1. حفظ على السيرفر أولاً
    try {
      const resp = await fetch('/api/admin/job-positions', {
        method: 'POST',
        headers: _authHeaders(),
        credentials: 'include',
        body: JSON.stringify({ hospitalName, rows }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'خطأ من السيرفر');
      }
    } catch (e) {
      // إذا فشل السيرفر احفظ في IndexedDB فقط وأبلغ بالخطأ
      await _idbPut(rec);
      throw e;
    }

    // 2. حفظ cache محلي
    await _idbPut(rec);
    return rec;
  }

  /**
   * load — يجلب بيانات مستشفى (السيرفر أولاً، ثم cache)
   */
  async function load(hospitalName) {
    try {
      const tok = _getToken();
      const headers = tok ? { Authorization: 'Bearer ' + tok } : {};
      const resp = await fetch('/api/admin/job-positions?hospital=' + encodeURIComponent(hospitalName), {
        headers, credentials: 'include',
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.rows?.length) {
          await _idbPut({ hospitalName: data.hospitalName || hospitalName, rows: data.rows, savedAt: data.savedAt });
          return data;
        }
      }
    } catch {}
    // fallback: IndexedDB cache
    return await _idbGet(hospitalName);
  }

  /**
   * loadAll — يجلب قائمة جميع المستشفيات من السيرفر
   */
  async function loadAll() {
    try {
      const tok = _getToken();
      const headers = tok ? { Authorization: 'Bearer ' + tok } : {};
      const resp = await fetch('/api/admin/job-positions/list', { headers, credentials: 'include' });
      if (resp.ok) {
        const data = await resp.json();
        if (data && Array.isArray(data.list) && data.list.length > 0) {
          return data.list.map(item => ({
            hospitalName: item.hospitalName,
            rows: [], // الصفوف التفصيلية تُحمَّل عند الحاجة
            savedAt: item.savedAt,
            count: item.count,
            totalCost: item.totalCost,
          }));
        }
      }
    } catch {}
    // fallback: IndexedDB cache
    return await _idbGetAll();
  }

  /**
   * remove — حذف من السيرفر + IndexedDB
   */
  async function remove(hospitalName) {
    try {
      const tok = _getToken();
      const headers = tok ? { Authorization: 'Bearer ' + tok } : {};
      await fetch('/api/admin/job-positions?hospital=' + encodeURIComponent(hospitalName), {
        method: 'DELETE', headers, credentials: 'include',
      });
    } catch {}
    await _idbDelete(hospitalName);
  }

  // ── خريطة الأقسام ──────────────────────────────────────────────────────────

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
    'السلامة والحراسات':               'patient_services',
    'السلامة والحراسات الأمنية':        'patient_services',
    'قسم السلامة والحراسات الأمنية':    'patient_services',
    'سلامة وحراسة':                   'patient_services',
    'الحراسات الأمنية':                'patient_services',
    'حراسات':                         'patient_services',
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
    for (const [k, v] of Object.entries(DEPT_MAP)) {
      if (t.includes(k) || k.includes(t)) return v;
    }
    return null;
  }

  return { save, load, loadAll, remove, mapDept, DEPT_MAP, DEPT_LABELS };
})();
