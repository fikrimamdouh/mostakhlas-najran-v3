/**
 * ContractFoundationDB — حفظ وجلب بيانات التأسيسي (عقود الباطن + المستهلكات)
 * localStorage أولاً + مزامنة سحابية عبر API
 *
 * آلية العمل:
 * - الأدمن يرفع الإكسل → يُحفظ على السيرفر لكل مستشفى → cloud-sync يوزّعه
 * - contract_foundation_data في hospitalStorage يُحمَّل تلقائياً على كل أجهزة المستخدمين
 */
const ContractFoundationDB = (function () {
  const LOCAL_KEY_PREFIX = 'contract_foundation_v2';
  const SERVER_SYNC_KEY  = 'contract_foundation_data'; // مفتاح cloud-sync

  function _localKey(hospitalName) {
    return LOCAL_KEY_PREFIX + '_' + (hospitalName || 'default').trim();
  }

  // ── localStorage ─────────────────────────────────────────────────────────

  function save(hospitalName, subcontractors, consumables) {
    const rec = {
      hospitalName: (hospitalName || 'default').trim(),
      subcontractors: subcontractors || [],
      consumables: consumables || [],
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(_localKey(hospitalName), JSON.stringify(rec));
    return rec;
  }

  function load(hospitalName) {
    // 1. جرّب مفتاح المستشفى المحدد
    try {
      const raw = localStorage.getItem(_localKey(hospitalName));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.subcontractors?.length || parsed.consumables?.length)) return parsed;
      }
    } catch {}

    // 2. fallback: مفتاح السحابة العام الذي يوزّعه cloud-sync
    try {
      const raw = localStorage.getItem(SERVER_SYNC_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.subcontractors?.length || parsed.consumables?.length)) {
          // إذا تطابق اسم المستشفى أو لا يوجد اسم محدد
          const hn = (hospitalName || '').trim();
          if (!hn || !parsed.hospitalName || parsed.hospitalName === hn) return parsed;
        }
      }
    } catch {}

    return null;
  }

  function loadAll() {
    const results = [];
    const seen = new Set();
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(LOCAL_KEY_PREFIX + '_')) {
        try {
          const d = JSON.parse(localStorage.getItem(k));
          if (d && d.hospitalName && !seen.has(d.hospitalName)) {
            seen.add(d.hospitalName);
            results.push(d);
          }
        } catch {}
      }
    }
    // أضف المفتاح السحابي إن لم يكن مدرجاً بعد
    try {
      const raw = localStorage.getItem(SERVER_SYNC_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && d.hospitalName && !seen.has(d.hospitalName)) {
          seen.add(d.hospitalName);
          results.push(d);
        }
      }
    } catch {}
    return results.sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
  }

  function remove(hospitalName) {
    localStorage.removeItem(_localKey(hospitalName));
  }

  // ── Server API ────────────────────────────────────────────────────────────

  function _getToken() {
    try {
      const s = JSON.parse(localStorage.getItem('najran_session') || '{}');
      return s.clerkToken || null;
    } catch { return null; }
  }

  /**
   * saveToServer — يرفع بيانات التأسيسي للسيرفر (أدمن فقط)
   * يُستدعى تلقائياً من صفحة الرفع بعد الحفظ المحلي
   */
  async function saveToServer(hospitalName, subcontractors, consumables) {
    const token = _getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    try {
      const resp = await fetch('/api/admin/foundation', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ hospitalName, subcontractors, consumables }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        return { ok: false, error: err.error || 'خطأ من السيرفر' };
      }
      const result = await resp.json();

      // حفظ المفتاح السحابي محلياً فوراً حتى تعكسه الأجهزة بدون انتظار
      const rec = {
        hospitalName: (hospitalName || '').trim(),
        subcontractors: subcontractors || [],
        consumables: consumables || [],
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(SERVER_SYNC_KEY, JSON.stringify(rec));

      return { ok: true, ...result };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /**
   * loadFromServer — يجلب بيانات التأسيسي من السيرفر مباشرة
   * (للاستخدام من صفحات الاطلاع عندما لا يوجد localStorage)
   */
  async function loadFromServer(hospitalName) {
    const token = _getToken();
    const headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    try {
      const url = hospitalName
        ? '/api/admin/foundation?hospital=' + encodeURIComponent(hospitalName)
        : '/api/admin/foundation';
      const resp = await fetch(url, { headers, credentials: 'include' });
      if (!resp.ok) return null;
      const data = await resp.json();
      if (data && (data.subcontractors?.length || data.consumables?.length)) {
        // حفظ محلياً كـ cache
        const hn = data.hospitalName || hospitalName;
        if (hn) localStorage.setItem(_localKey(hn), JSON.stringify(data));
        localStorage.setItem(SERVER_SYNC_KEY, JSON.stringify(data));
        return data;
      }
      return null;
    } catch { return null; }
  }

  return { save, load, loadAll, remove, saveToServer, loadFromServer };
})();
