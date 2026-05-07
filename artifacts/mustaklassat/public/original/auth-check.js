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
      if (Date.now() - s.timestamp > 8 * 60 * 60 * 1000) {
        localStorage.removeItem('najran_session');
        return null;
      }
      return s;
    } catch (e) { return null; }
  }

  var session = getSession();
  if (!session) {
    window.location.href = BASE + '/sign-in';
    return;
  }

  // Add bottom status bar after DOM is ready
  document.addEventListener('DOMContentLoaded', function () {
    // ─── Status bar ───
    var bar = document.createElement('div');
    bar.id = 'najran-auth-bar';
    bar.style.cssText = [
      'position:fixed', 'bottom:0', 'left:0', 'right:0', 'z-index:99999',
      'background:linear-gradient(90deg,#0f2050,#1e3c72,#2a5298)',
      'color:#fff', 'display:flex', 'align-items:center',
      'justify-content:space-between', 'padding:5px 14px',
      'font-family:Tajawal,Arial,sans-serif', 'font-size:13px',
      'border-top:2px solid #d4af37', 'direction:rtl',
      'gap:8px', 'min-height:42px'
    ].join(';');

    // Left section: logo + org + user info
    var hospital = session.hospital || session.company || '';
    var hospitalHtml = hospital
      ? '<span style="color:rgba(255,255,255,0.55);margin:0 4px">|</span><span style="color:#93c5fd;font-size:12px">🏥 ' + hospital + '</span>'
      : '';

    var roleTag = '';
    if (session.role === 'admin')
      roleTag = '<span class="bar-role-tag" style="background:#d4af37;color:#1e3c72;border-radius:4px;padding:1px 7px;font-size:10px;font-weight:bold;margin-right:4px">مدير</span>';
    else if (session.role === 'supervisor')
      roleTag = '<span class="bar-role-tag" style="background:#f59e0b;color:#fff;border-radius:4px;padding:1px 7px;font-size:10px;font-weight:bold;margin-right:4px">مشرف</span>';

    bar.innerHTML =
      '<div class="bar-left" style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;overflow:hidden">' +
        '<img src="/logo.png" style="height:24px;vertical-align:middle;flex-shrink:0" onerror="this.style.display=\'none\'">' +
        '<span style="color:#d4af37;font-weight:bold;white-space:nowrap">تجمع نجران الصحي</span>' +
        '<span style="color:rgba(255,255,255,0.35)">|</span>' +
        '<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (session.name || 'مستخدم') + '</span>' +
        roleTag +
        hospitalHtml +
      '</div>' +
      '<div class="bar-right" style="display:flex;align-items:center;gap:10px;flex-shrink:0">' +
        '<span id="najran-sync-status" style="font-size:11px;opacity:0.7;white-space:nowrap">☁ مزامنة</span>' +
        '<a href="/dashboard" style="color:#d4af37;text-decoration:none;font-weight:bold;font-size:13px;white-space:nowrap">🏠 الرئيسية</a>' +
        '<button onclick="najranSignOut()" style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.25);color:#fff;padding:3px 12px;border-radius:6px;cursor:pointer;font-family:Tajawal,Arial,sans-serif;font-size:12px;white-space:nowrap">خروج</button>' +
      '</div>';

    document.body.style.paddingBottom = '44px';
    document.body.appendChild(bar);
  });

  window.najranSignOut = function () {
    localStorage.removeItem('najran_session');
    window.location.href = BASE + '/sign-in';
  };

  window.najranSession = session;

  // Expose sync status updater for cloud-sync.js
  window.najranSetSyncStatus = function (status) {
    var el = document.getElementById('najran-sync-status');
    if (!el) return;
    if (status === 'syncing') {
      el.textContent = '⟳ جاري الحفظ...';
      el.style.color = '#fde68a';
    } else if (status === 'done') {
      el.textContent = '✓ محفوظ';
      el.style.color = '#86efac';
      setTimeout(function () {
        if (el) { el.textContent = '☁ مزامنة'; el.style.color = ''; }
      }, 2500);
    } else if (status === 'error') {
      el.textContent = '⚠ خطأ في الحفظ';
      el.style.color = '#fca5a5';
    } else {
      el.textContent = '☁ مزامنة';
      el.style.color = '';
    }
  };
})();
