// يحفظ بيانات التسجيل الأولى احتياطياً حتى لا تضيع أثناء الانتقال إلى Clerk.
// لا يلمس بيانات المستخلصات أو الحضور أو المعادلات.
(function preregGuard() {
  try {
    var KEY = 'najran_prereg';
    if (window.__najranPreregGuard) return;
    window.__najranPreregGuard = true;

    var originalSet = sessionStorage.setItem.bind(sessionStorage);
    var originalRemove = sessionStorage.removeItem.bind(sessionStorage);

    sessionStorage.setItem = function(key, value) {
      var result = originalSet.apply(sessionStorage, arguments);
      try {
        if (key === KEY && value) localStorage.setItem(KEY, String(value));
      } catch (_) {}
      return result;
    };

    sessionStorage.removeItem = function(key) {
      var result = originalRemove.apply(sessionStorage, arguments);
      try {
        if (key === KEY) localStorage.removeItem(KEY);
      } catch (_) {}
      return result;
    };
  } catch (_) {}
})();
