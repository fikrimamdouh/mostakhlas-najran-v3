/**
 * auth-check.js
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

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll("a[href$='/original/index.html'], a[href='/original/index.html'], a[href='index.html']").forEach(function(a){
      a.setAttribute('href', '/dashboard');
    });

    var style = document.createElement('style');
    style.textContent = `
      :root { --sb-w: 250px; --hdr-h: 56px; }
      #najran-shell-header{position:fixed;top:0;left:0;right:0;height:var(--hdr-h);z-index:99998;background:linear-gradient(90deg,#1e3c72,#2a5298);color:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 14px;border-bottom:2px solid #d4af37;font-family:Tajawal,sans-serif}
      #najran-shell-sidebar{position:fixed;top:var(--hdr-h);right:0;bottom:0;width:var(--sb-w);z-index:99997;background:#183465;color:#fff;overflow:auto;padding:12px 10px;font-family:Tajawal,sans-serif}
      #najran-shell-sidebar a{display:block;color:#fff;text-decoration:none;padding:10px 12px;border-radius:8px;margin-bottom:6px;background:rgba(255,255,255,.06)}
      #najran-shell-sidebar a:hover{background:rgba(212,175,55,.25)}
      body{padding-top:calc(var(--hdr-h) + 8px)!important;padding-right:calc(var(--sb-w) + 12px)!important;box-sizing:border-box}
      #najran-mobile-toggle{display:none}
      @media (max-width: 900px){
        #najran-mobile-toggle{display:inline-flex;align-items:center;justify-content:center;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);color:#fff;border-radius:8px;padding:6px 10px;cursor:pointer}
        #najran-shell-sidebar{transform:translateX(105%);transition:transform .25s ease}
        #najran-shell-sidebar.open{transform:translateX(0)}
        body{padding-right:10px!important}
      }
    `;
    document.head.appendChild(style);

    var header = document.createElement('div');
    header.id = 'najran-shell-header';
    header.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px">' +
        '<button id="najran-mobile-toggle">☰</button>' +
        '<img src="/logo.png" style="height:30px" onerror="this.style.display=\'none\'">' +
        '<strong>تجمع نجران الصحي</strong>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:10px">' +
        '<span>' + (session.name || 'مستخدم') + '</span>' +
        '<a href="/dashboard" style="color:#d4af37;text-decoration:none;font-weight:bold">الرئيسية</a>' +
        '<button onclick="najranSignOut()" style="background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);color:#fff;padding:5px 10px;border-radius:6px;cursor:pointer">تسجيل الخروج</button>' +
      '</div>';
    document.body.appendChild(header);

    var items = [
      ['الإعدادات الرئيسية','/original/settings_main.html'],
      ['الحضور والانصراف','/original/attendance.html'],
      ['جداول الأداء','/original/performance.html'],
      ['شهادة الإنجاز','/original/achievement.html'],
      ['مستخلص المستهلكات','/original/consumables.html'],
      ['مستخلص قطع الغيار','/original/spare_parts.html'],
      ['اعتماد المستخلص','/original/approval.html'],
      ['المراكز الصحية','/original/health_centers.html'],
      ['مراجعة المستخلص','/original/review_extract.html']
    ];

    var side = document.createElement('aside');
    side.id = 'najran-shell-sidebar';
    side.innerHTML = '<div style="color:#d4af37;font-weight:bold;padding:8px 10px 12px">وحدات النظام</div>' +
      items.map(function (it) { return '<a href="' + it[1] + '">' + it[0] + '</a>'; }).join('');
    document.body.appendChild(side);

    var toggle = document.getElementById('najran-mobile-toggle');
    if (toggle) toggle.onclick = function(){ side.classList.toggle('open'); };
  });

  window.najranSignOut = function () {
    localStorage.removeItem('najran_session');
    window.location.href = BASE + '/sign-in';
  };

  window.najranSession = session;
})();
