/**
 * auth-check.js
 * يتحقق من تسجيل الدخول قبل عرض أي صفحة من صفحات النظام الأصلي
 * + نظام الإشعارات الداخلي (جرس + badge)
 */
(function () {
  var BASE = window.location.origin;
  var BUILD_V = '20260614b';

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

  function getOriginalPageFile() {
    try {
      var pathFile = (window.location.pathname || '').split('/').pop() || '';
      if (pathFile) return pathFile;
      var pageParam = new URLSearchParams(window.location.search || '').get('page');
      return pageParam || '';
    } catch (_) {
      return (window.location.pathname || '').split('/').pop() || '';
    }
  }

  function parseAllowedModules(raw) {
    if (!raw) return null;
    if (Array.isArray(raw)) return raw.map(String);
    try {
      var parsed = JSON.parse(String(raw));
      return Array.isArray(parsed) ? parsed.map(String) : null;
    } catch (_) {
      return null;
    }
  }

  function moduleKeyFromPage(pageFile) {
    var map = {
      'approval.html': 'approval',
      'settings_main.html': 'settings_main',
      'settings_advanced.html': 'settings_advanced',
      'attendance.html': 'attendance',
      'performance.html': 'performance',
      'achievement.html': 'achievement',
      'consumables.html': 'consumables',
      'spare_parts.html': 'spare_parts',
      'request-visit.html': 'request-visit',
      'visit-admin-review.html': 'visit_review',
      'health_centers_attendance.html': 'health_centers_attendance',
      'health_centers_consumables.html': 'health_centers_consumables',
      'admin_offices_attendance.html': 'admin_offices_attendance',
      'admin_offices_consumables.html': 'admin_offices_consumables',
      'review_extract.html': 'review_extract',
      'monthly-overview.html': 'monthly_overview',
      'extract-archive.html': 'extract_archive',
      'najran_general.html': 'najran_general'
    };
    return map[pageFile] || '';
  }

  function isOriginalPageAllowed() {
    var role = String(session.role || 'user').toLowerCase();
    if (role === 'admin' || role === 'supervisor') return true;

    var pageFile = getOriginalPageFile();
    var moduleKey = moduleKeyFromPage(pageFile);
    if (!moduleKey) return true;

    var explicitOnly = { 'request-visit': true, 'visit_review': true };
    var allowed = parseAllowedModules(session.allowedModules);

    if (allowed === null) return !explicitOnly[moduleKey];

    return allowed.indexOf(moduleKey) > -1;
  }

  function blockUnauthorizedOriginalPage() {
    try { window.stop(); } catch (_) {}
    try {
      document.open();
      document.write([
        '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width,initial-scale=1">',
        '<title>غير مصرح</title>',
        '<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#f0f4ff,#e8edf5);font-family:Tajawal,Arial,sans-serif;color:#1e293b}.card{background:#fff;border:1px solid #e5e7eb;border-radius:18px;box-shadow:0 20px 55px rgba(15,23,42,.14);padding:34px;max-width:460px;text-align:center}.title{color:#b91c1c;font-size:24px;font-weight:800;margin-bottom:10px}.msg{font-size:15px;line-height:1.9;color:#475569}.btn{display:inline-block;margin-top:22px;padding:10px 20px;border-radius:10px;background:#1e3c72;color:#fff;text-decoration:none;font-weight:700}</style>',
        '</head><body><div class="card"><div class="title">غير مصرح بالوصول</div>',
        '<div class="msg">ليست لديك صلاحية فتح هذه الصفحة. تم إيقاف تحميل الصفحة لمنع أي حفظ أو مزامنة غير مصرح بها.</div>',
        '<a class="btn" href="/dashboard">العودة للرئيسية</a></div></body></html>'
      ].join(''));
      document.close();
    } catch (_) {
      window.location.replace(BASE + '/dashboard');
    }
  }

  if (!isOriginalPageAllowed()) {
    blockUnauthorizedOriginalPage();
    return;
  }

  var hospitalContextGuardScript = document.createElement('script');
  hospitalContextGuardScript.src = '/original/hospital-context-guard.js?v=20260611d';
  hospitalContextGuardScript.defer = false;
  document.head.appendChild(hospitalContextGuardScript);

  var hospitalStorageExtractContextGuardScript = document.createElement('script');
  hospitalStorageExtractContextGuardScript.src = '/original/hospital-storage-extract-context-guard.js?v=' + BUILD_V;
  hospitalStorageExtractContextGuardScript.defer = false;
  document.head.appendChild(hospitalStorageExtractContextGuardScript);

  if (/attendance\.html(?:$|[?#])/.test(window.location.pathname + window.location.search) || /[?&]page=.*attendance\.html(?:$|&)/.test(window.location.pathname + window.location.search)) {
    var attendanceCloudRefreshGuardScript = document.createElement('script');
    attendanceCloudRefreshGuardScript.src = '/original/attendance-cloud-refresh-guard.js?v=' + BUILD_V;
    attendanceCloudRefreshGuardScript.defer = true;
    document.head.appendChild(attendanceCloudRefreshGuardScript);
  }

  if (/\/original\/approval\.html(?:$|[?#])/.test(window.location.pathname + window.location.search)) {
    var reviewPrintScript = document.createElement('script');
    reviewPrintScript.src = '/original/review-print-override.js?v=' + BUILD_V;
    reviewPrintScript.defer = true;
    document.head.appendChild(reviewPrintScript);

    var reviewScript = document.createElement('script');
    reviewScript.src = '/original/review-workflow.js?v=' + BUILD_V;
    reviewScript.defer = true;
    document.head.appendChild(reviewScript);

    var reviewGenericScript = document.createElement('script');
    reviewGenericScript.src = '/original/review-generic-tables.js?v=' + BUILD_V;
    reviewGenericScript.defer = true;
    document.head.appendChild(reviewGenericScript);

    var reviewConsumablesSummaryScript = document.createElement('script');
    reviewConsumablesSummaryScript.src = '/original/review-consumables-summary-exact.js?v=' + BUILD_V;
    reviewConsumablesSummaryScript.defer = true;
    document.head.appendChild(reviewConsumablesSummaryScript);
  }

  if (/\/original\/.*consumables\.html(?:$|[?#])/.test(window.location.pathname + window.location.search)) {
    var consumablesGuardScript = document.createElement('script');
    consumablesGuardScript.src = '/original/consumables-submit-snapshot-guard.js?v=' + BUILD_V;
    consumablesGuardScript.defer = true;
    document.head.appendChild(consumablesGuardScript);
  }

  if (/\/original\/settings_main\.html(?:$|[?#])/.test(window.location.pathname + window.location.search)) {
    var settingsBackupCompleteScript = document.createElement('script');
    settingsBackupCompleteScript.src = '/original/settings-backup-complete-guard.js?v=20260611d';
    settingsBackupCompleteScript.defer = true;
    document.head.appendChild(settingsBackupCompleteScript);
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
    if (!token) {
      callback(0, []);
      return;
    }
    var headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };
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
    fetchNotifCount(function (count, allIds) {
      updateBell(count);
      var btn = document.getElementById('najran-bell-btn');
      if (btn) {
        btn.onclick = function () {
          markAllSeen(allIds || []);
          updateBell(0);
          window.location.href = '/original/approval.html';
        };
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    checkNotifications();
    setInterval(checkNotifications, 60000);
  });
})();