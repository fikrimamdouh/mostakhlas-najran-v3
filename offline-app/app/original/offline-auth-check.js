/**
 * offline-auth-check.js
 * نسخة الديسكتوب — يتحقق من الجلسة المحلية فقط بدون Clerk
 */
(function () {
  function getSession() {
    try {
      var raw = localStorage.getItem('najran_session');
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || !s.timestamp) return null;
      if (Date.now() - s.timestamp > 10 * 60 * 60 * 1000) {
        localStorage.removeItem('najran_session');
        return null;
      }
      return s;
    } catch (e) { return null; }
  }

  var session = getSession();
  if (!session) {
    window.location.href = '/login.html';
    return;
  }

  // ── زر الخروج + اسم المستخدم في الشريط ───────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    var bar = document.querySelector('.sn-actions') || document.querySelector('.sn-header');
    if (!bar) return;
    var logoutBtn = document.createElement('button');
    logoutBtn.style.cssText = 'background:rgba(255,255,255,.15);color:#fff;border:1px solid rgba(255,255,255,.3);padding:6px 14px;border-radius:8px;cursor:pointer;font-size:13px;margin-right:8px;';
    logoutBtn.textContent = '⏻ خروج';
    logoutBtn.onclick = function () {
      if (confirm('هل تريد تسجيل الخروج؟')) {
        localStorage.removeItem('najran_session');
        window.location.href = '/login.html';
      }
    };
    bar.appendChild(logoutBtn);
  });
})();
