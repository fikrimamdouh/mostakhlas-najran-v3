/**
 * JobPositionsDB — حفظ وجلب مناصب الوظائف
 * يحفظ على السيرفر أولاً + IndexedDB كـ cache محلي.
 * تعديل: ملف المكاتب الإدارية يُقرأ كمكاتب داخلية وليس كمستشفيات مستقلة.
 */
(function () {
  if (window.__JOB_POSITIONS_ARABIC_HEADER_FIX__) return;
  window.__JOB_POSITIONS_ARABIC_HEADER_FIX__ = true;

  const nativeIncludes = String.prototype.includes;
  function normalizeArabicHeader(value) {
    return String(value || '')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/[ـ\u064B-\u065F\u0670]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  String.prototype.includes = function patchedIncludes(searchString, position) {
    if (nativeIncludes.call(this, searchString, position)) return true;
    try {
      const left = String(this);
      const right = String(searchString);
      const joined = left + ' ' + right;
      if (/اسم|مستشفى|مستشفي|المستشفى|المستشفي|موقع|الموقع|مكتب|المكتب|مرفق|المرفق|هوية|هويه|إقامة|اقامة|الوظائف|ادارية|إدارية/.test(joined)) {
        return nativeIncludes.call(normalizeArabicHeader(left), normalizeArabicHeader(right), position || 0);
      }
    } catch (_) {}
    return false;
  };
})();

const JobPositionsDB = (function () {
  const DB_NAME = 'najranJobPositions';
  const DB_VER = 1;
  const STORE = 'positions';

  const OFFICIAL_ADMIN_OFFICE_NAMES = [
    'مبنى فرع وزارة الصحة بنجران',
    'المختبر الإقليمي',
    'نواقل المرضى والأمراض المشتركة',
    'مبنى الطب الشرعي وثلاجة الموتى بالشرفة',
    'الأزمات والكوارث الصحية بفرع وزارة الصحة',
    'مبنى مستودعات الشرفة',
    'إدارة الشئون الهندسية والفريق الجوال',
    'هيئة الصحة العامة وقاية',
    'سكن الممرضات بالإثايبة',
    'مبنى التجمع الصحي',
    'التدريب والابتعاث',
    'إدارة مركز التحكم والكوارث بالفيصلية',
    'التموين الطبي',
    'الخدمات العامة',
    'الورش (صيانة وإصلاح السيارات)'
  ];

  function normalizeSiteName(value) {
    return String(value || '')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/[ـ\u064B-\u065F\u0670]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function readJsonSafe(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function getInternalAdminOfficeNames() {
    const names = readJsonSafe('adminOfficeNames_v1', {});
    const result = OFFICIAL_ADMIN_OFFICE_NAMES.slice();
    if (names && typeof names === 'object') {
      Object.values(names).forEach(name => {
        const clean = String(name || '').trim();
        if (clean && !result.some(x => normalizeSiteName(x) === normalizeSiteName(clean))) result.push(clean);
      });
    }
    return result;
  }

  function findInternalAdminOfficeName(siteName) {
    const incoming = normalizeSiteName(siteName);
    if (!incoming) return '';
    const offices = getInternalAdminOfficeNames();
    const exact = offices.find(name => normalizeSiteName(name) === incoming);
    if (exact) return exact;
    const contains = offices.find(name => {
      const n = normalizeSiteName(name);
      return n && (n.includes(incoming) || incoming.includes(n));
    });
    return contains || '';
  }

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'hospitalName' });
      };
      req.onsuccess = e => resolve(e.target.result);
      req.onerror = e => reject(e.target.error);
    });
  }

  async function idbPut(rec) {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(rec);
        tx.oncomplete = resolve;
        tx.onerror = e => reject(e.target.error);
      });
    } catch (_) {}
  }

  async function idbGet(hospitalName) {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(hospitalName);
        req.onsuccess = e => resolve(e.target.result || null);
        req.onerror = e => reject(e.target.error);
      });
    } catch (_) { return null; }
  }

  async function idbGetAll() {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
        req.onsuccess = e => resolve(e.target.result || []);
        req.onerror = e => reject(e.target.error);
      });
    } catch (_) { return []; }
  }

  async function idbDelete(hospitalName) {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(hospitalName);
        tx.oncomplete = resolve;
        tx.onerror = e => reject(e.target.error);
      });
    } catch (_) {}
  }

  function getToken() {
    try { return JSON.parse(localStorage.getItem('najran_session') || '{}').clerkToken || null; }
    catch (_) { return null; }
  }

  function authHeaders() {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    return headers;
  }

  async function loadAll() {
    try {
      const token = getToken();
      const headers = token ? { Authorization: 'Bearer ' + token } : {};
      const resp = await fetch('/api/admin/job-positions/list', { headers, credentials: 'include' });
      if (resp.ok) {
        const data = await resp.json();
        if (data && Array.isArray(data.list) && data.list.length > 0) {
          return data.list.map(item => ({
            hospitalName: item.hospitalName,
            rows: [],
            savedAt: item.savedAt,
            count: item.count,
            totalCost: item.totalCost
          }));
        }
      }
    } catch (_) {}
    return await idbGetAll();
  }

  async function resolveExistingSiteName(hospitalName) {
    const incoming = String(hospitalName || '').trim();
    if (!incoming || incoming === 'غير محدد') return incoming;

    const internalName = findInternalAdminOfficeName(incoming);
    if (internalName) return internalName;

    const normalizedIncoming = normalizeSiteName(incoming);
    try {
      const all = await loadAll();
      const match = (Array.isArray(all) ? all : []).find(item => {
        const saved = item && item.hospitalName ? String(item.hospitalName).trim() : '';
        return saved && normalizeSiteName(saved) === normalizedIncoming;
      });
      if (match && match.hospitalName) return match.hospitalName;
    } catch (_) {}

    try {
      const allLocal = await idbGetAll();
      const matchLocal = (Array.isArray(allLocal) ? allLocal : []).find(item => {
        const saved = item && item.hospitalName ? String(item.hospitalName).trim() : '';
        return saved && normalizeSiteName(saved) === normalizedIncoming;
      });
      if (matchLocal && matchLocal.hospitalName) return matchLocal.hospitalName;
    } catch (_) {}

    return incoming;
  }

  async function save(hospitalName, rows) {
    const targetHospitalName = await resolveExistingSiteName(hospitalName);
    const rec = { hospitalName: targetHospitalName, rows, savedAt: new Date().toISOString() };
    try {
      const resp = await fetch('/api/admin/job-positions', {
        method: 'POST',
        headers: authHeaders(),
        credentials: 'include',
        body: JSON.stringify({ hospitalName: targetHospitalName, rows })
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'خطأ من السيرفر');
      }
    } catch (e) {
      await idbPut(rec);
      throw e;
    }
    await idbPut(rec);
    return rec;
  }

  async function load(hospitalName) {
    const targetHospitalName = await resolveExistingSiteName(hospitalName);
    const attempts = [hospitalName, targetHospitalName].filter((v, i, a) => v && a.indexOf(v) === i);

    for (const name of attempts) {
      try {
        const token = getToken();
        const headers = token ? { Authorization: 'Bearer ' + token } : {};
        const resp = await fetch('/api/admin/job-positions?hospital=' + encodeURIComponent(name), { headers, credentials: 'include' });
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.rows && data.rows.length) {
            await idbPut({ hospitalName: data.hospitalName || name, rows: data.rows, savedAt: data.savedAt });
            return data;
          }
        }
      } catch (_) {}
    }

    for (const name of attempts) {
      const local = await idbGet(name);
      if (local) return local;
    }
    return null;
  }

  async function remove(hospitalName) {
    try {
      const token = getToken();
      const headers = token ? { Authorization: 'Bearer ' + token } : {};
      await fetch('/api/admin/job-positions?hospital=' + encodeURIComponent(hospitalName), { method: 'DELETE', headers, credentials: 'include' });
    } catch (_) {}
    await idbDelete(hospitalName);
  }

  const DEPT_MAP = {
    'نظافة': 'cleaning',
    'النظافة': 'cleaning',
    'تنظيف': 'cleaning',
    'كهرباء': 'electricity',
    'الكهرباء': 'electricity',
    'كهربا': 'electricity',
    'زراعة': 'agriculture',
    'الزراعة': 'agriculture',
    'مساحات خضراء': 'agriculture',
    'مدني': 'civil_works',
    'الأعمال المدنية': 'civil_works',
    'أعمال مدنية': 'civil_works',
    'أعمال مدنيه': 'civil_works',
    'ميكانيكا': 'mechanical',
    'الميكانيكا': 'mechanical',
    'ميكانيك': 'mechanical',
    'ميكانيكي': 'mechanical',
    'مغسلة': 'laundry',
    'المغسلة': 'laundry',
    'غسيل': 'laundry',
    'خدمات مرضى': 'patient_services',
    'خدمات المرضى': 'patient_services',
    'خدمة مرضى': 'patient_services',
    'السلامة والحراسات': 'patient_services',
    'السلامة والحراسات الأمنية': 'patient_services',
    'قسم السلامة والحراسات الأمنية': 'patient_services',
    'سلامة وحراسة': 'patient_services',
    'الحراسات الأمنية': 'patient_services',
    'حراسات': 'patient_services',
    'وظائف إدارية': 'admin_saudi',
    'الوظائف الإدارية السعوديين': 'admin_saudi',
    'الوظائف الإدارية للسعوديين': 'admin_saudi',
    'الوظائف الادارية السعوديين': 'admin_saudi',
    'الوظائف الادارية للسعوديين': 'admin_saudi',
    'الوظائف الإدارية': 'admin_saudi',
    'إداري': 'admin_saudi',
    'إدارية': 'admin_saudi',
    'اداري': 'admin_saudi',
    'ادارية': 'admin_saudi',
    'وظيفة إدارية': 'admin_saudi',
    'ورش': 'workshops',
    'الورش': 'workshops',
    'قسم الورش': 'workshops',
    'صيانة وإصلاح السيارات': 'workshops',
    'صيانة واصلاح السيارات': 'workshops',
    'صيانة السيارات': 'workshops',
    'المكاتب': 'workshops',
    'مكاتب': 'workshops',
    'قسم المكاتب': 'workshops',
    'المكاتب الإدارية': 'workshops',
    'المكاتب الادارية': 'workshops',
    'مكتب': 'workshops',
    'المكتب': 'workshops',
    'قسم المكتب': 'workshops'
  };

  function getPatientServicesLabel() {
    try {
      const s = JSON.parse(localStorage.getItem('najran_session') || '{}');
      if ((s.hospital || '').includes('الأمل')) return 'خدمات المرضى';
    } catch (_) {}
    return 'قسم السلامة والحراسات الأمنية';
  }

  const DEPT_LABELS = {
    cleaning: 'النظافة',
    electricity: 'الكهرباء',
    agriculture: 'الزراعة',
    civil_works: 'الأعمال المدنية',
    mechanical: 'الميكانيكا',
    laundry: 'المغسلة',
    get patient_services() { return getPatientServicesLabel(); },
    admin_saudi: 'الوظائف الإدارية السعوديين',
    workshops: 'المكاتب والورش'
  };

  function normalizeDept(value) {
    return String(value || '')
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه');
  }

  function isOfficesOrWorkshops(value) {
    const t = normalizeDept(value);
    return t.includes('ورش') ||
      t.includes('مكاتب') ||
      t.includes('المكاتب') ||
      t.includes('مكتب') ||
      t.includes('المكتب') ||
      t.includes('صيانة واصلاح السيارات') ||
      t.includes('صيانه واصلاح السيارات');
  }

  function mapDept(arabicName) {
    if (!arabicName) return null;
    const t = String(arabicName).trim();
    const nt = normalizeDept(t);
    if (isOfficesOrWorkshops(t)) return 'workshops';
    if (DEPT_MAP[t]) return DEPT_MAP[t];
    for (const [k, v] of Object.entries(DEPT_MAP)) {
      const nk = normalizeDept(k);
      if (t.includes(k) || k.includes(t) || nt.includes(nk) || nk.includes(nt)) return v;
    }
    return null;
  }

  return {
    save,
    load,
    loadAll,
    remove,
    mapDept,
    DEPT_MAP,
    DEPT_LABELS,
    normalizeSiteName,
    resolveExistingSiteName,
    OFFICIAL_ADMIN_OFFICE_NAMES
  };
})();