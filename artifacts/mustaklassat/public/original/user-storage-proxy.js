/**
 * user-storage-proxy.js
 * يعزل بيانات localStorage لكل مستخدم بشكل تلقائي وشفاف
 * يجب تحميله قبل أي script آخر يستخدم localStorage
 */
(function () {
  const EXCLUDED_KEYS = ['najran_session']; // مفاتيح مشتركة لا تُعزل

  function getPrefix() {
    try {
      const raw = Storage.prototype.getItem.call(localStorage, 'najran_session');
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (!session || !session.userId) return null;
      return '_u' + session.userId + '_';
    } catch (_) {
      return null;
    }
  }
window._najranRealStorage = localStorage;

  const PREFIX = getPrefix();
  if (!PREFIX) return; // لا يوجد جلسة → تشغيل طبيعي

  const _get    = Storage.prototype.getItem.bind(localStorage);
  const _set    = Storage.prototype.setItem.bind(localStorage);
  const _remove = Storage.prototype.removeItem.bind(localStorage);

  function prefixed(key) {
    return EXCLUDED_KEYS.includes(key) ? key : PREFIX + key;
  }

  const proxyHandler = {
    get(target, prop) {
      if (prop === 'getItem') {
        return (key) => _get(prefixed(key));
      }
      if (prop === 'setItem') {
        return (key, value) => _set(prefixed(key), value);
      }
      if (prop === 'removeItem') {
        return (key) => _remove(prefixed(key));
      }
      if (prop === 'clear') {
        // مسح مفاتيح هذا المستخدم فقط
        return () => {
          const toDelete = [];
          for (let i = 0; i < target.length; i++) {
            const k = target.key(i);
            if (k && k.startsWith(PREFIX)) toDelete.push(k);
          }
          toDelete.forEach(k => _remove(k));
        };
      }
      const val = target[prop];
      return typeof val === 'function' ? val.bind(target) : val;
    }
  };

  try {
    const proxy = new Proxy(localStorage, proxyHandler);
    Object.defineProperty(window, 'localStorage', {
      value: proxy,
      configurable: true,
      writable: false,
    });
  } catch (_) {
    // بعض المتصفحات لا تدعم Proxy على localStorage — نتجاوز
  }
})();
