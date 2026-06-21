/**
 * auth-check.js
 * يتحقق من تسجيل الدخول قبل عرض أي صفحة من صفحات النظام الأصلي
 * + نظام الإشعارات الداخلي (جرس + badge)
 */
(function () {
  var BASE = window.location.origin;
  var BUILD_V = '20260620revisionBoot1';
  var NOTIF_INTERVAL_MS = 300000;
  var notifFetchInProgress = false;

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

  function appendScript(src, defer) {
    var script = document.createElement('script');
    script.src = src;
    script.defer = defer !== false;
    document.head.appendChild(script);
    return script;
  }

  appendScript('/original/hospital-context-guard.js?v=20260611d', false);
  appendScript('/original/hospital-storage-extract-context-guard.js?v=' + BUILD_V, false);
  appendScript('/original/home-sidebar-guard.js?v=20260621homeSidebarGuard1', false);

  var pageSig = window.location.pathname + window.location.search;

  appendScript('/original/approve-button-polish.js?v=' + BUILD_V, true);
  appendScript('/original/revision-local-draft-restore.js?v=' + BUILD_V, true);

  if (
    /\/original\/(attendance|performance|achievement|consumables|spare_parts|health_centers_attendance|health_centers_consumables|admin_offices_attendance|admin_offices_consumables|najran_general_attendance|najran_general_performance|najran_general_achievement|najran_dental_attendance|najran_dental_performance)\.html(?:$|[?#])/.test(pageSig)
  ) {
    appendScript('/original/extract-snapshot.js?v=' + BUILD_V, true);
  }

  if (/attendance\.html(?:$|[?#])/.test(pageSig) || /[?&]page=.*attendance\.html(?:$|&)/.test(pageSig)) {
    appendScript('/original/attendance-cloud-refresh-guard.js?v=' + BUILD_V, true);
  }

  if (
    /\/original\/attendance\.html(?:$|[?#])/.test(pageSig) ||
    /\/original\/admin_offices_attendance\.html(?:$|[?#])/.test(pageSig)
  ) {
    appendScript('/original/special-absence-no-deduction.js?v=' + BUILD_V, true);
  }

  if (/\/original\/approval\.html(?:$|[?#])/.test(pageSig)) {
    appendScript('/original/review-print-override.js?v=' + BUILD_V, true);
    appendScript('/original/review-workflow.js?v=' + BUILD_V, true);
    appendScript('/original/review-generic-tables.js?v=' + BUILD_V, true);
    appendScript('/original/review-consumables-summary-exact.js?v=' + BUILD_V, true);
  }

  if (/\/original\/.*consumables\.html(?:$|[?#])/.test(pageSig)) {
    appendScript('/original/consumables-submit-snapshot-guard.js?v=' + BUILD_V, true);
  }

  if (/\/original\/settings_main\.html(?:$|[?#])/.test(pageSig)) {
    appendScript('/original/settings-backup-complete-guard.js?v=20260611d', true);
  }

  function installPerformanceTemplateGuard() {
    if (!/\/original\/performance\.html(?:$|[?#])/.test(pageSig)) return;
    if (window.__NAJRAN_PERFORMANCE_TEMPLATE_GUARD__) return;
    window.__NAJRAN_PERFORMANCE_TEMPLATE_GUARD__ = true;

    var tableIds = ['cleaning', 'electricity', 'agriculture', 'civil', 'mechanics', 'laundry', 'security'];
    var templatePrefix = 'lastPerformanceTemplate_';

    function inRevisionMode() {
      return !!(
        localStorage.getItem('najran_revision_extract_id') ||
        localStorage.getItem('najran_revision_mode') === 'true'
      );
    }

    function safeSet(key, value) {
      if (value == null || value === '') return;
      try { localStorage.setItem(key, value); } catch (_) {}
    }

    function mirrorCurrentTableDataToTemplate(tableId) {
      if (!tableId || tableIds.indexOf(tableId) === -1) return;
      if (inRevisionMode()) return;
      var sourceKey = 'tableData_' + tableId;
      var value = localStorage.getItem(sourceKey);
      if (!value) return;
      safeSet(templatePrefix + tableId, value);
      safeSet('lastPerformanceTemplateSavedAt', new Date().toISOString());
    }

    function mirrorAllExistingTableDataToTemplate() {
      if (inRevisionMode()) return;
      tableIds.forEach(mirrorCurrentTableDataToTemplate);
    }

    function seedMissingTableDataFromTemplate() {
      if (inRevisionMode()) return;
      tableIds.forEach(function (tableId) {
        var sourceKey = 'tableData_' + tableId;
        if (localStorage.getItem(sourceKey)) return;
        var template = localStorage.getItem(templatePrefix + tableId);
        if (!template) return;
        safeSet(sourceKey, template);
        console.info('[PerformanceTemplate] تمت استعادة آخر نموذج محفوظ لجدول الأداء:', tableId);
      });
    }

    function wrapSaveTableData() {
      if (typeof window.saveTableData !== 'function') return false;
      if (window.saveTableData.__NAJRAN_TEMPLATE_WRAPPED__) return true;
      var original = window.saveTableData;
      window.saveTableData = function (tableId) {
        var result = original.apply(this, arguments);
        try { mirrorCurrentTableDataToTemplate(tableId); } catch (_) {}
        return result;
      };
      window.saveTableData.__NAJRAN_TEMPLATE_WRAPPED__ = true;
      return true;
    }

    function retryWrapSaveTableData(attempt) {
      if (wrapSaveTableData()) return;
      if (attempt >= 40) return;
      setTimeout(function () { retryWrapSaveTableData(attempt + 1); }, 250);
    }

    seedMissingTableDataFromTemplate();
    mirrorAllExistingTableDataToTemplate();
    retryWrapSaveTableData(0);

    document.addEventListener('DOMContentLoaded', function () {
      seedMissingTableDataFromTemplate();
      mirrorAllExistingTableDataToTemplate();
      retryWrapSaveTableData(0);
      setTimeout(seedMissingTableDataFromTemplate, 400);
      setTimeout(mirrorAllExistingTableDataToTemplate, 1200);
    });
  }

  installPerformanceTemplateGuard();

  var NOTIF_SEEN_KEY  = 'najran_notif_seen_ids';
  var NOTIF_CHECK_KEY = 'najran_notif_last_check';

  function getSeenIds() {
    try {
      var parsed = JSON.parse(localStorage.getItem(NOTIF_SEEN_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch (_) {
      return [];
    }
  }

  function getExtractChangedAt(e) {
    return String(
      (e && (e.updatedAt || e.revisedAt || e.approvedAt || e.createdAt)) || ''
    );
  }

  function getNotifMarker(e) {
    if (!e) return '';
    return [
      String(e.id || ''),
      String(e.status || ''),
      getExtractChangedAt(e)
    ].join('|');
  }

  function isNotifSeen(seenIds, e) {
    var marker = getNotifMarker(e);

    if (marker && seenIds.indexOf(marker) > -1) {
      return true;
    }

    if (e && e.status === 'submitted' && seenIds.indexOf(String(e.id)) > -1) {
      return true;
    }

    return false;
  }

  function markAllSeen(markers) {
    localStorage.setItem(
      NOTIF_SEEN_KEY,
      JSON.stringify((markers || []).map(String))
    );
    localStorage.setItem(NOTIF_CHECK_KEY, String(Date.now()));
  }

  function fetchNotifCount(callback) {
    var s = getSession();
    if (!s) return;
    if (notifFetchInProgress) return;

    var age = Date.now() - (s.timestamp || 0);
    var token = (s.clerkToken && age < 55000) ? s.clerkToken : null;

    if (!token) {
      callback(0, []);
      return;
    }

    notifFetchInProgress = true;

    var headers = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token
    };

    fetch('/api/submitted-extracts-lite', {
      headers: headers,
      credentials: 'include'
    })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (data) {
        if (!data || !data.extracts) {
          callback(0, []);
          return;
        }

        var role = s.role || 'user';
        var seenIds = getSeenIds();
        var unseen = [];

        if (role === 'admin' || role === 'supervisor') {
          unseen = data.extracts.filter(function (e) {
            return e.status === 'submitted' && !isNotifSeen(seenIds, e);
          });
        } else {
          var lastCheck =
            parseInt(localStorage.getItem(NOTIF_CHECK_KEY) || '0') ||
            (Date.now() - 7 * 24 * 3600 * 1000);

          unseen = data.extracts.filter(function (e) {
            var changed = new Date(
              e.updatedAt || e.revisedAt || e.approvedAt || e.createdAt
            ).getTime();

            return changed > lastCheck &&
              (e.status === 'approved' ||
               e.status === 'needs_revision' ||
               e.status === 'rejected') &&
              !isNotifSeen(seenIds, e);
          });
        }

        callback(
          unseen.length,
          data.extracts.map(getNotifMarker).filter(Boolean)
        );
      })
      .catch(function () {
        callback(0, []);
      })
      .finally(function () {
        notifFetchInProgress = false;
      });
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
          var role = String((getSession() || {}).role || 'user').toLowerCase();
          if (role === 'admin' || role === 'supervisor') {
            window.location.href = '/original/approval.html';
          } else {
            window.location.href = '/extracts/track';
          }
        };
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    checkNotifications();
    setInterval(checkNotifications, NOTIF_INTERVAL_MS);
  });
})();
