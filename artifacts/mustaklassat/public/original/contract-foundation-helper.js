/**
 * ContractFoundationDB — حفظ وجلب بيانات التأسيسي (عقود الباطن + المستهلكات) من localStorage
 * يُشارَك بين صفحة الرفع وصفحة المستهلكات
 */
const ContractFoundationDB = (function () {
  const STORE_KEY = 'contract_foundation_v2';

  function _key(hospitalName) {
    return STORE_KEY + '_' + (hospitalName || 'default').trim();
  }

  function save(hospitalName, subcontractors, consumables) {
    const rec = {
      hospitalName: (hospitalName || 'default').trim(),
      subcontractors: subcontractors || [],
      consumables: consumables || [],
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(_key(hospitalName), JSON.stringify(rec));
    return rec;
  }

  function load(hospitalName) {
    try {
      const raw = localStorage.getItem(_key(hospitalName));
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function loadAll() {
    const results = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STORE_KEY + '_')) {
        try {
          const d = JSON.parse(localStorage.getItem(k));
          if (d && d.hospitalName) results.push(d);
        } catch {}
      }
    }
    return results.sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
  }

  function remove(hospitalName) {
    localStorage.removeItem(_key(hospitalName));
  }

  return { save, load, loadAll, remove };
})();
