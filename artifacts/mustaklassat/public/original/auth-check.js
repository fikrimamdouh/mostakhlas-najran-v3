/**
 * auth-check.js
 * يتحقق من تسجيل الدخول قبل عرض أي صفحة من صفحات النظام الأصلي
 * + نظام الإشعارات الداخلي (جرس + badge)
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

  if (/\/original\/approval\.html(?:$|[?#])/.test(window.location.pathname + window.location.search)) {
    var reviewScript = document.createElement('script');
    reviewScript.src = '/original/review-workflow.js';
    reviewScript.defer = true;
    document.head.appendChild(reviewScript);

    var reviewPrintScript = document.createElement('script');
    reviewPrintScript.src = '/original/review-print-override.js';
    reviewPrintScript.defer = true;
    document.head.appendChild(reviewPrintScript);
  }

  var NOTIF_SEEN_KEY  = 'najran_notif_seen_ids';
  var NOTIF_CHECK_KEY = 'najran_notif_last_check';

  function getSeenIds() {
    try { return JSON.parse(localStorage.getItem(NOTIF_SEEN_KEY) || '[]'); } catch (_) { return []; }
  }

  function markAllSeen(ids) {
    localStorage.setItem(NOTIF_SEEN_KEY, JSON.stringify(ids));
    localStorage.setItem(NOTIF_CHECK_KEY, String(Date.now()));
  }

  function fetchNotifCount(callback) {
    var s = getSession();
    if (!s) return;
    var age = Date.now() - (s.timestamp || 0);
    var token = (s.clerkToken && age < 55000) ? s.clerkToken : null;
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    fetch('/api/submitted-extracts', { headers: headers, credentials: 'include' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.extracts) { callback(0, []); return; }
        var role = s.role || 'user';
        var seenIds = getSeenIds();
        var unseen = [];
        if (role === 'admin' || role === 'supervisor') {
          unseen = data.extracts.filter(function (e) {
            return e.status === 'submitted' && seenIds.indexOf(e.id) === -1;
          });
        } else {
          var lastCheck = parseInt(localStorage.getItem(NOTIF_CHECK_KEY) || '0') || (Date.now() - 7 * 24 * 3600 * 1000);
          unseen = data.extracts.filter(function (e) {
            var changed = new Date(e.updatedAt || e.createdAt).getTime();
            return changed > lastCheck &&
              (e.status === 'approved' || e.status === 'needs_revision' || e.status === 'rejected') &&
              seenIds.indexOf(e.id) === -1;
          });
        }
        callback(unseen.length, data.extracts.map(function (e) { return e.id; }));
      })
      .catch(function () { callback(0, []); });
  }

  function updateBell(count) {
    var badge = document.getElementById('najran-bell-badge');
    var btn   = document.getElementById('najran-bell-btn');
    if (!badge || !btn) return;
    if (count > 0) {
      badge.textContent = count > 9 ? '9+' : String(count);
      badge.style.display = 'inline-flex';
      btn.style.animation = 'naj-bell-ring 0.6s ease 3';
    } else {
      badge.style.display = 'none';
      btn.style.animation = '';
    }
  }

  function checkNotifications() {
    fetchNotifCount(function (count) { updateBell(count); });
  }

  function logActualSignOut(done) {
    var s = getSession() || session;
    if (!s || !s.clerkToken) { done(); return; }

    var payload = JSON.stringify({
      action: 'تسجيل خروج فعلي',
      details: JSON.stringify({
        details: 'قام المستخدم بتسجيل الخروج من البرنامج',
        page: location.pathname,
        url: location.pathname + location.search,
        title: document.title || null,
        hospital: s.hospital || localStorage.getItem('hospitalName') || null,
        company: s.companyName || localStorage.getItem('companyName') || null,
        userName: s.name || null,
        userEmail: s.email || null,
        at: new Date().toISOString()
      }),
      entityType: 'auth',
      entityId: String(s.userId || s.id || ''),
      before: null,
      after: null,
      page: location.pathname
    });

    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      done();
    }

    try {
      fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.clerkToken },
        credentials: 'include',
        keepalive: true,
        body: payload
      }).then(finish).catch(finish);
      setTimeout(finish, 450);
    } catch (_) {
      finish();
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var styleEl = document.createElement('style');
    styleEl.textContent = [
      '@keyframes naj-bell-ring{',
        '0%,100%{transform:rotate(0)}',
        '20%{transform:rotate(-18deg)}',
        '40%{transform:rotate(18deg)}',
        '60%{transform:rotate(-12deg)}',
        '80%{transform:rotate(12deg)}',
      '}'
    ].join('');
    document.head.appendChild(styleEl);

    var bar = document.createElement('div');
    bar.id = 'najran-auth-bar';
    bar.className = 'no-print';
    bar.style.cssText = [
      'position:fixed','bottom:0','left:0','right:0','z-index:99999',
      'background:linear-gradient(90deg,#0f2050,#1e3c72,#2a5298)',
      'color:#fff','display:flex','align-items:center',
      'justify-content:space-between','padding:5px 14px',
      'font-family:Tajawal,Arial,sans-serif','font-size:13px',
      'border-top:2px solid #d4af37','direction:rtl',
      'gap:8px','min-height:42px'
    ].join(';');

    var hospital = session.hospital || session.company || '';
    var hospitalHtml = hospital
      ? '<span style="color:rgba(255,255,255,0.55);margin:0 4px">|</span><span style="color:#93c5fd;font-size:12px">🏥 ' + hospital + '</span>'
      : '';

    var roleTag = '';
    if (session.role === 'admin')
      roleTag = '<span style="background:#d4af37;color:#1e3c72;border-radius:4px;padding:1px 7px;font-size:10px;font-weight:bold;margin-right:4px">مدير</span>';
    else if (session.role === 'supervisor')
      roleTag = '<span style="background:#f59e0b;color:#fff;border-radius:4px;padding:1px 7px;font-size:10px;font-weight:bold;margin-right:4px">مشرف</span>';
    else if (session.role === 'contract_supervisor')
      roleTag = '<span style="background:#7c3aed;color:#fff;border-radius:4px;padding:1px 7px;font-size:10px;font-weight:bold;margin-right:4px">مشرف عقد</span>';

    bar.innerHTML =
      '<div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;overflow:hidden">' +
        '<img src="/logo.png" style="height:24px;vertical-align:middle;flex-shrink:0" onerror="this.style.display=\'none\'">' +
        '<span style="color:#d4af37;font-weight:bold;white-space:nowrap">تجمع نجران الصحي</span>' +
        '<span style="color:rgba(255,255,255,0.35)">|</span>' +
        '<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (session.name || 'مستخدم') + '</span>' +
        roleTag + hospitalHtml +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0">' +
        '<span id="najran-sync-status" style="font-size:11px;opacity:0.7;white-space:nowrap">☁ مزامنة</span>' +
        '<button id="najran-bell-btn" title="الإشعارات" style="position:relative;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.25);color:#fff;width:32px;height:28px;border-radius:7px;cursor:pointer;font-size:15px;display:inline-flex;align-items:center;justify-content:center;transition:background 0.2s;transform-origin:top center;flex-shrink:0">🔔<span id="najran-bell-badge" style="display:none;position:absolute;top:-5px;left:-5px;background:#ef4444;color:#fff;font-size:9px;font-weight:bold;border-radius:9px;min-width:16px;height:16px;align-items:center;justify-content:center;padding:0 3px;font-family:Arial,sans-serif;line-height:1;border:1.5px solid #0f2050">0</span></button>' +
        '<a href="/original/approval.html" style="color:#d4af37;text-decoration:none;font-weight:bold;font-size:12px;white-space:nowrap">📋 المستخلصات</a>' +
        '<a href="/dashboard" style="color:rgba(255,255,255,0.8);text-decoration:none;font-size:12px;white-space:nowrap">🏠 الرئيسية</a>' +
        '<button id="najran-signout-btn" style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.25);color:#fff;padding:3px 12px;border-radius:6px;cursor:pointer;font-family:Tajawal,Arial,sans-serif;font-size:12px;white-space:nowrap">خروج</button>' +
      '</div>';

    if (window.self === window.top) {
      document.body.style.paddingBottom = '44px';
      document.body.appendChild(bar);
      document.getElementById('najran-bell-btn').addEventListener('click', function () {
        fetchNotifCount(function (count, allIds) {
          markAllSeen(allIds);
          updateBell(0);
          window.location.href = '/original/approval.html';
        });
      });
      document.getElementById('najran-signout-btn').addEventListener('click', function () {
        window.najranSignOut();
      });
    }

    setTimeout(checkNotifications, 1500);
    setInterval(checkNotifications, 2 * 60 * 1000);

    window.najranSignOut = function () {
      logActualSignOut(function () {
        try {
          localStorage.removeItem('najran_session');
          sessionStorage.removeItem('najran_prereg');
          localStorage.removeItem('hospitalName');
          localStorage.removeItem('companyName');
          localStorage.removeItem('contractNumber');
          localStorage.removeItem('contractDetails');
        } catch(e) {}
        window.location.href = BASE + '/sign-in';
      });
    };

    window.najranSession = session;

    window.najranSetSyncStatus = function (status) {
      var el = document.getElementById('najran-sync-status');
      if (!el) return;
      if (status === 'syncing') {
        el.textContent = '⟳ جاري الحفظ...'; el.style.color = '#fde68a';
      } else if (status === 'done') {
        el.textContent = '✓ محفوظ'; el.style.color = '#86efac';
        setTimeout(function () { if (el) { el.textContent = '☁ مزامنة'; el.style.color = ''; } }, 2500);
      } else if (status === 'error') {
        el.textContent = '⚠ خطأ في الحفظ'; el.style.color = '#fca5a5';
      } else {
        el.textContent = '☁ مزامنة'; el.style.color = '';
      }
    };
  });
})();