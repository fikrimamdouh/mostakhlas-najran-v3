// يقلل ضغط سجل المراقبة بمنع تسجيل تنقلات الصفحات فقط.
// لا يمنع تسجيل التعديلات الفعلية مثل الحضور أو الاعتماد أو الصلاحيات.
(function auditLightGuard() {
  try {
    if (window.__najranAuditLightGuard) return;
    window.__najranAuditLightGuard = true;

    var nativeFetch = window.fetch.bind(window);

    window.fetch = function(input, init) {
      try {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        var method = String((init && init.method) || 'GET').toUpperCase();

        if (url.indexOf('/api/audit') !== -1 && method === 'POST' && init && init.body) {
          var body = JSON.parse(String(init.body));
          if (body && body.entityType === 'navigation' && (body.action === 'دخول صفحة' || body.action === 'خروج صفحة')) {
            return Promise.resolve(new Response(JSON.stringify({ ok: true, skipped: true }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            }));
          }
        }
      } catch (_) {}

      return nativeFetch(input, init);
    };
  } catch (_) {}
})();
