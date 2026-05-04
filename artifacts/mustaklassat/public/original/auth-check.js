/**
 * auth-check.js
 * يتحقق من تسجيل الدخول قبل عرض أي صفحة من صفحات النظام الأصلي
 */
(function () {
  var BASE = window.location.origin;

  function getSession() {
    try {
      var raw = localStorage.getItem('najran_session');
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || !s.timestamp) return null;
      // صلاحية الجلسة 8 ساعات
      if (Date.now() - s.timestamp > 8 * 60 * 60 * 1000) {
        localStorage.removeItem('najran_session');
        return null;
      }
      return s;
    } catch (e) {
      return null;
    }
  }

  var session = getSession();
  if (!session) {
    window.location.href = BASE + '/sign-in';
    return;
  }

  // إضافة شريط المستخدم في أعلى الصفحة
  document.addEventListener('DOMContentLoaded', function () {
    var bar = document.createElement('div');
    bar.id = 'najran-auth-bar';
    bar.style.cssText = [
      'position:fixed', 'bottom:0', 'left:0', 'right:0', 'z-index:99999',
      'background:linear-gradient(90deg,#1e3c72,#2a5298)',
      'color:#fff', 'display:flex', 'align-items:center',
      'justify-content:space-between', 'padding:6px 16px',
      'font-family:Tajawal,sans-serif', 'font-size:13px',
      'border-top:2px solid #d4af37', 'direction:rtl'
    ].join(';');

    bar.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px">' +
        '<img src="/logo.png" style="height:26px;vertical-align:middle" onerror="this.style.display=\'none\'">' +
        '<span style="color:#d4af37;font-weight:bold">تجمع نجران الصحي</span>' +
        '<span style="color:rgba(255,255,255,0.7)">|</span>' +
        '<span>' + (session.name || 'مستخدم') + '</span>' +
        (session.role === 'admin' ? '<span style="background:#d4af37;color:#1e3c72;border-radius:4px;padding:1px 6px;font-size:11px;font-weight:bold">مدير</span>' : '') +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:12px">' +
        '<a href="/dashboard" style="color:#d4af37;text-decoration:none;font-weight:bold">🏠 الرئيسية</a>' +
        '<button onclick="najranSignOut()" style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);color:#fff;padding:3px 12px;border-radius:6px;cursor:pointer;font-family:Tajawal,sans-serif;font-size:13px">تسجيل الخروج</button>' +
      '</div>';

    document.body.style.paddingBottom = '44px';
    document.body.appendChild(bar);
  });

  window.najranSignOut = function () {
    localStorage.removeItem('najran_session');
    window.location.href = BASE + '/sign-in';
  };

  window.najranSession = session;
})();
