/**
 * offline-user-proxy.js
 * نسخة الديسكتوب — عزل بيانات كل مستخدم بمعرّفه المحلي
 */
(function () {
  const EXCLUDED_KEYS = ['najran_session'];

  function getPrefix() {
    try {
      const raw = Storage.prototype.getItem.call(localStorage, 'najran_session');
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !s.userId) return null;
      return '_u' + s.userId + '_';
    } catch (_) { return null; }
  }

  const PREFIX = getPrefix();
  if (!PREFIX) return;

  const _get    = Storage.prototype.getItem.bind(localStorage);
  const _set    = Storage.prototype.setItem.bind(localStorage);
  const _remove = Storage.prototype.removeItem.bind(localStorage);

  function prefixed(key) {
    return EXCLUDED_KEYS.includes(key) ? key : PREFIX + key;
  }

  try {
    const proxy = new Proxy(localStorage, {
      get(target, prop) {
        if (prop === 'getItem')    return (k) => _get(prefixed(k));
        if (prop === 'setItem')    return (k, v) => _set(prefixed(k), v);
        if (prop === 'removeItem') return (k) => _remove(prefixed(k));
        if (prop === 'clear')      return () => {
          const keys = [];
          for (let i = 0; i < target.length; i++) { const k = target.key(i); if (k?.startsWith(PREFIX)) keys.push(k); }
          keys.forEach(k => _remove(k));
        };
        const val = target[prop];
        return typeof val === 'function' ? val.bind(target) : val;
      }
    });
    Object.defineProperty(window, 'localStorage', { value: proxy, configurable: true, writable: false });
  } catch (_) {}
})();
