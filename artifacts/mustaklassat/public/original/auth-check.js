/**
 * auth-check.js
 * يتحقق من تسجيل الدخول قبل عرض صفحات النظام الأصلي
 * + تحميل الحراس العامة
 * + دعم original-viewer?page=...
 * + fresh token support for original-page notification/API polling
 */
(function () {
  'use strict';

  var BASE = window.location.origin;
  var BUILD_V = '20260709_auth_fresh_token_v3_archive_filter';
  var HOSPITAL_STORAGE_GUARD_V = '20260709_fresh_token_retry_v2';
  var APPROVAL_REVISION_GUARD_V = '20260710_v5_sig_never_delete';
  var MONITOR_V = '20260709_monitor_v2_circuit_breaker';
  var NOTIF_INTERVAL_MS = 900000;
  var NAJRAN_BUILD_VERSION = '2026.07.09-auth-r3';
  window.NAJRAN_BUILD_VERSION = NAJRAN_BUILD_VERSION;

  try { console.info('%c[Najran] النسخة: ' + NAJRAN_BUILD_VERSION, 'color:#1e3c72;font-weight:bold'); } catch (_) {}

  var notifFetchInProgress = false;

  function getSession() {
    try {
      var raw = localStorage.getItem('najran_session');
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s) return null;
      if (s.timestamp && Date.now() - s.timestamp > 8 * 60 * 60 * 1000) {
        localStorage.removeItem('najran_session');
        return null;
      }
      return s;
    } catch (_) { return null; }
  }

  function saveSessionToken(token) {
    if (!token) return;
    try {
      var s = getSession() || {};
      s.clerkToken = token;
      s.timestamp = Date.now();
      localStorage.setItem('najran_session', JSON.stringify(s));
    } catch (_) {}
  }

  async function callTokenGetter(fn, force) {
    try {
      if (typeof fn !== 'function') return null;
      var token = null;
      try { token = await fn(force ? { skipCache: true } : undefined); }
      catch (_) { token = await fn(); }
      if (token) saveSessionToken(token);
      return token || null;
    } catch (_) { return null; }
  }

  async function getFreshToken(force) {
    var token = await callTokenGetter(window.najranGetFreshToken, !!force);
    if (token) return token;
    try {
      if (window.parent && window.parent !== window) {
        token = await callTokenGetter(window.parent.najranGetFreshToken, !!force);
        if (token) return token;
      }
    } catch (_) {}
    try {
      if (window.top && window.top !== window) {
        token = await callTokenGetter(window.top.najranGetFreshToken, !!force);
        if (token) return token;
      }
    } catch (_) {}
    // آخر بديل: توكن الجلسة المخزّن — لكن فقط لو حديث (توكنات Clerk تنتهي
    // خلال ~60 ثانية). توكن قديم = طلب محكوم عليه بـ401 أحمر في Console بلا
    // فائدة، فالأصح ألا يخرج الطلب أصلًا؛ المستدعي (authJson) يرجع فشلًا
    // صامتًا والإشعارات تُقرأ من الكاش.
    var s = getSession();
    if (s && s.clerkToken && s.timestamp && (Date.now() - s.timestamp) < 55000) return s.clerkToken;
    return null;
  }

  async function authJson(url, options, force) {
    options = options || {};
    var token = await getFreshToken(!!force);
    if (!token) return { ok: false, status: 0, data: null };
    var headers = new Headers(options.headers || {});
    headers.set('Authorization', 'Bearer ' + token);
    if (options.method && options.method !== 'GET' && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    var res = await fetch(url, Object.assign({}, options, { headers: headers, credentials: 'include' }));
    if (res.status === 401 && !force) return authJson(url, options, true);
    var data = null;
    try { data = res.ok ? await res.json() : null; } catch (_) { data = null; }
    return { ok: res.ok, status: res.status, data: data };
  }

  var session = getSession();
  if (!session) {
    window.location.href = BASE + '/sign-in';
    return;
  }

  function getOriginalPageFile() {
    try {
      var fromQuery = new URLSearchParams(window.location.search || '').get('page') || '';
      if (fromQuery) return String(fromQuery).split('/').pop();
      return (window.location.pathname || '').split('/').pop() || '';
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
    } catch (_) { return null; }
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
    var moduleKey = moduleKeyFromPage(getOriginalPageFile());
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
    } catch (_) { window.location.replace(BASE + '/dashboard'); }
  }

  if (!isOriginalPageAllowed()) {
    blockUnauthorizedOriginalPage();
    return;
  }

  function appendScript(src, defer) {
    if (document.querySelector('script[src="' + src.replace(/"/g, '\\"') + '"]')) return null;
    var script = document.createElement('script');
    script.src = src;
    script.defer = defer !== false;
    document.head.appendChild(script);
    return script;
  }

  var pageSig = window.location.pathname + window.location.search;
  var pageFile = getOriginalPageFile();
  var isAttendancePage = pageFile === 'attendance.html' || /\/original\/attendance\.html(?:$|[?#])/.test(pageSig);
  var isAdminOfficesPage = pageFile === 'admin_offices_attendance.html' || /\/original\/admin_offices_attendance\.html(?:$|[?#])/.test(pageSig);
  var isAdminOfficesConsumablesPage = pageFile === 'admin_offices_consumables.html' || /\/original\/admin_offices_consumables\.html(?:$|[?#])/.test(pageSig);
  var isSidebarSensitivePage = isAttendancePage || isAdminOfficesPage;

  console.info('[AuthCheck] original page resolved:', pageFile);

  appendScript('/original/hospital-context-guard.js?v=20260611d', false);
  appendScript('/original/hospital-storage-extract-context-guard.js?v=' + HOSPITAL_STORAGE_GUARD_V, false);
  appendScript('/original/production-client-monitor.js?v=' + MONITOR_V, false);
  if (!isSidebarSensitivePage) appendScript('/original/home-sidebar-guard.js?v=20260703_review_exclude_v2', false);

  appendScript('/original/approve-button-polish.js?v=' + BUILD_V, true);
  appendScript('/original/revision-local-draft-restore.js?v=' + BUILD_V, true);
  appendScript('/original/revision-session-guard.js?v=' + BUILD_V, true);

  var snapshotPages = {
    'attendance.html': true,
    'performance.html': true,
    'achievement.html': true,
    'consumables.html': true,
    'spare_parts.html': true,
    'health_centers_attendance.html': true,
    'health_centers_consumables.html': true,
    'admin_offices_attendance.html': true,
    'admin_offices_consumables.html': true,
    'najran_general_attendance.html': true,
    'najran_general_performance.html': true,
    'najran_general_achievement.html': true,
    'najran_dental_attendance.html': true,
    'najran_dental_performance.html': true
  };

  if (snapshotPages[pageFile]) {
    appendScript('/original/extract-snapshot.js?v=20260710_sig_never_delete_v1', true);
    appendScript('/original/submitted_extract_archive_bundle_guard.js?v=20260705_v2_labor_details_bridge', true);
  }

  if (isAdminOfficesPage || isAdminOfficesConsumablesPage) appendScript('/original/admin_offices_full_submit_snapshot_guard.js?v=20260705_v4_admin_offices_duplicate_fix', true);
  if (isAttendancePage) appendScript('/original/attendance-cloud-refresh-guard-loader.js?v=' + BUILD_V, true);
  if (isAdminOfficesPage) {
    appendScript('/original/admin_offices_performance_logic.js?v=' + BUILD_V, true);
    appendScript('/original/admin_offices_grand_certificate_stamp_fix.js?v=20260701_stamp_v3', true);
  }
  if (isAttendancePage || isAdminOfficesPage) appendScript('/original/special-absence-no-deduction.js?v=' + BUILD_V, true);

  if (pageFile === 'approval.html') {
    appendScript('/original/approval_revision_route_guard.js?v=' + APPROVAL_REVISION_GUARD_V, true);
    appendScript('/original/review-print-override.js?v=' + BUILD_V, true);
    appendScript('/original/review-workflow.js?v=20260705_v3_duplicate_resubmit_and_admin_offices_parts', true);
    appendScript('/original/review-labor-final-snapshot-exact.js?v=20260705_v2_labor_details_bridge', true);
    appendScript('/original/review-labor-legacy-official-amount.js?v=20260705_cache_bust_v1', true);
    appendScript('/original/review-generic-tables.js?v=20260703_admin_preview_v3', true);
    appendScript('/original/admin_offices_review_detail_patch.js?v=20260705_v4_admin_offices_duplicate_fix', true);
    appendScript('/original/review-consumables-summary-exact.js?v=' + BUILD_V, true);
  }

  if (pageFile === 'extract-archive.html') {
    appendScript('/original/extract_archive_route_guard.js?v=20260703_extract_archive_route_v5', true);
    appendScript('/original/extract_archive_server_hospital_filter.js?v=' + BUILD_V, true);
  }
  if (/consumables\.html$/.test(pageFile)) appendScript('/original/consumables-submit-snapshot-guard.js?v=20260708_consumables_guard_v5_nondestructive', true);
  if (pageFile === 'settings_main.html') {
    appendScript('/original/settings-backup-complete-guard.js?v=20260611d', true);
    appendScript('/original/settings_contract_fixed_patch.js?v=20260623_fixed_contract_v1', true);
  }

  function installPerformanceTemplateGuard() {
    if (pageFile !== 'performance.html') return;
    if (window.__NAJRAN_PERFORMANCE_TEMPLATE_GUARD__) return;
    window.__NAJRAN_PERFORMANCE_TEMPLATE_GUARD__ = true;
    var tableIds = ['cleaning', 'electricity', 'agriculture', 'civil', 'mechanics', 'laundry', 'security'];
    var templatePrefix = 'lastPerformanceTemplate_';
    function inRevisionMode() { return !!(localStorage.getItem('najran_revision_extract_id') || localStorage.getItem('najran_revision_mode') === 'true'); }
    function safeSet(key, value) { if (value == null || value === '') return; try { localStorage.setItem(key, value); } catch (_) {} }
    function mirrorCurrentTableDataToTemplate(tableId) {
      if (!tableId || tableIds.indexOf(tableId) === -1) return;
      if (inRevisionMode()) return;
      var value = localStorage.getItem('tableData_' + tableId);
      if (!value) return;
      safeSet(templatePrefix + tableId, value);
      safeSet('lastPerformanceTemplateSavedAt', new Date().toISOString());
    }
    function mirrorAllExistingTableDataToTemplate() { if (inRevisionMode()) return; tableIds.forEach(mirrorCurrentTableDataToTemplate); }
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

  var NOTIF_SEEN_KEY = 'najran_notif_seen_ids';
  var NOTIF_CHECK_KEY = 'najran_notif_last_check';
  var NOTIF_LAST_FINGERPRINT_KEY = 'najran_notif_last_fingerprint';
  var NOTIF_LAST_COMPUTED_COUNT_KEY = 'najran_notif_last_computed_count';

  function getSeenIds() {
    try {
      var parsed = JSON.parse(localStorage.getItem(NOTIF_SEEN_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch (_) { return []; }
  }
  function getExtractChangedAt(e) { return String((e && (e.updatedAt || e.revisedAt || e.approvedAt || e.createdAt)) || ''); }
  function getNotifMarker(e) { if (!e) return ''; return [String(e.id || ''), String(e.status || ''), getExtractChangedAt(e)].join('|'); }
  function isNotifSeen(seenIds, e) {
    var marker = getNotifMarker(e);
    if (marker && seenIds.indexOf(marker) > -1) return true;
    if (e && e.status === 'submitted' && seenIds.indexOf(String(e.id)) > -1) return true;
    return false;
  }
  function markAllSeen(markers) {
    localStorage.setItem(NOTIF_SEEN_KEY, JSON.stringify((markers || []).map(String)));
    localStorage.setItem(NOTIF_CHECK_KEY, String(Date.now()));
  }
  function getCachedNotifState() {
    try {
      return {
        fingerprint: localStorage.getItem(NOTIF_LAST_FINGERPRINT_KEY) || null,
        count: parseInt(localStorage.getItem(NOTIF_LAST_COMPUTED_COUNT_KEY) || '0', 10) || 0,
        markers: JSON.parse(localStorage.getItem('najran_notif_last_computed_markers') || '[]')
      };
    } catch (_) { return { fingerprint: null, count: 0, markers: [] }; }
  }
  function setCachedNotifState(fingerprint, count, markers) {
    try {
      localStorage.setItem(NOTIF_LAST_FINGERPRINT_KEY, fingerprint || '');
      localStorage.setItem(NOTIF_LAST_COMPUTED_COUNT_KEY, String(count || 0));
      localStorage.setItem('najran_notif_last_computed_markers', JSON.stringify(markers || []));
    } catch (_) {}
  }

  async function fetchNotifCountFull(s, callback) {
    try {
      var full = await authJson('/api/submitted-extracts-lite', {}, false);
      if (!full.ok || !full.data || !full.data.extracts) { callback(0, []); return; }
      var data = full.data;
      var role = s.role || 'user';
      var seenIds = getSeenIds();
      var unseen = [];
      if (role === 'admin' || role === 'supervisor') {
        unseen = data.extracts.filter(function (e) { return e.status === 'submitted' && !isNotifSeen(seenIds, e); });
      } else {
        var lastCheck = parseInt(localStorage.getItem(NOTIF_CHECK_KEY) || '0') || (Date.now() - 7 * 24 * 3600 * 1000);
        unseen = data.extracts.filter(function (e) {
          var changed = new Date(e.updatedAt || e.revisedAt || e.approvedAt || e.createdAt).getTime();
          return changed > lastCheck && (e.status === 'approved' || e.status === 'needs_revision' || e.status === 'rejected') && !isNotifSeen(seenIds, e);
        });
      }
      callback(unseen.length, data.extracts.map(getNotifMarker).filter(Boolean));
    } catch (_) {
      callback(0, []);
    } finally {
      notifFetchInProgress = false;
    }
  }

  // === توفير Neon (Network Transfer) ===
  // 1) كاش زمني: لو آخر فحص شبكي ناجح أقرب من TTL الدور الحالي، تُعاد النتيجة
  //    المخزّنة محليًا بلا أي fetch. TTL المستخدم العادي 60 دقيقة؛
  //    admin/supervisor 15 دقيقة.
  // 2) قفل بين التبويبات: najran_notif_fetch_lock (TTL 60 ثانية) — لو عدة
  //    تبويبات مفتوحة، تبويب واحد فقط يعمل fetch والباقي يقرأ الكاش.
  // 3) قمع الـ fallback: فشل العدّاد الخفيف لا يستدعي القائمة الكاملة تلقائيًا؛
  //    نعرض آخر count مخزّن، والـ fallback الكامل مسموح مرة واحدة فقط كل 30
  //    دقيقة — حتى لا يتضاعف الحمل بالضبط وقت ما تكون قاعدة البيانات متعبة.
  // force=true (صفحة المراجعة عند الفتح) يتخطى الكاش الزمني فقط، لا القفل ولا القمع.
  var NOTIF_LAST_FETCH_AT_KEY = 'najran_notif_last_fetch_at';
  var NOTIF_FETCH_LOCK_KEY = 'najran_notif_fetch_lock';
  var NOTIF_LAST_FULL_FALLBACK_AT_KEY = 'najran_notif_last_full_fallback_at';
  var NOTIF_LOCK_TTL_MS = 60 * 1000;
  var NOTIF_FULL_FALLBACK_MIN_GAP_MS = 30 * 60 * 1000;

  function notifRoleTtlMs() {
    var role = String((getSession() || {}).role || 'user').toLowerCase();
    if (role === 'admin' || role === 'supervisor') return 15 * 60 * 1000;
    return 60 * 60 * 1000;
  }
  function notifCacheFresh() {
    var last = parseInt(localStorage.getItem(NOTIF_LAST_FETCH_AT_KEY) || '0', 10) || 0;
    return (Date.now() - last) < notifRoleTtlMs();
  }
  function notifAcquireLock() {
    try {
      var now = Date.now();
      var lock = parseInt(localStorage.getItem(NOTIF_FETCH_LOCK_KEY) || '0', 10) || 0;
      if (lock && (now - lock) < NOTIF_LOCK_TTL_MS) return false;
      localStorage.setItem(NOTIF_FETCH_LOCK_KEY, String(now));
      return true;
    } catch (_) { return true; }
  }
  function notifReleaseLock() {
    try { localStorage.removeItem(NOTIF_FETCH_LOCK_KEY); } catch (_) {}
  }
  function notifFullFallbackAllowed() {
    var last = parseInt(localStorage.getItem(NOTIF_LAST_FULL_FALLBACK_AT_KEY) || '0', 10) || 0;
    return (Date.now() - last) > NOTIF_FULL_FALLBACK_MIN_GAP_MS;
  }
  function notifMarkFullFallback() {
    try { localStorage.setItem(NOTIF_LAST_FULL_FALLBACK_AT_KEY, String(Date.now())); } catch (_) {}
  }
  function notifMarkFetched() {
    try { localStorage.setItem(NOTIF_LAST_FETCH_AT_KEY, String(Date.now())); } catch (_) {}
  }
  function notifServeFromCache(callback) {
    var cached = getCachedNotifState();
    callback(cached.count, cached.markers);
  }

  async function fetchNotifCount(callback, force) {
    var s = getSession();
    if (!s || notifFetchInProgress) return;

    // (1) كاش زمني — بلا شبكة إلا لو force
    if (!force && notifCacheFresh()) { notifServeFromCache(callback); return; }

    // (2) قفل بين التبويبات
    if (!notifAcquireLock()) { notifServeFromCache(callback); return; }

    notifFetchInProgress = true;
    var wrapped = function (count, markers) {
      notifMarkFetched();
      notifReleaseLock();
      callback(count, markers);
    };
    try {
      var light = await authJson('/api/notifications/count', {}, false);
      if (!light.ok || !light.data) {
        // (3) قمع الـ fallback — فشل العدّاد لا يستدعي القائمة الكاملة إلا نادرًا
        if (notifFullFallbackAllowed()) {
          notifMarkFullFallback();
          fetchNotifCountFull(s, wrapped);
        } else {
          notifFetchInProgress = false;
          notifReleaseLock();
          notifServeFromCache(callback);
        }
        return;
      }
      var fingerprint = String(light.data.latestUpdatedAt || '') + '|' + String(light.data.count || 0);
      var cached = getCachedNotifState();
      if (cached.fingerprint && cached.fingerprint === fingerprint) {
        notifFetchInProgress = false;
        wrapped(cached.count, cached.markers);
        return;
      }
      fetchNotifCountFull(s, function (count, markers) {
        setCachedNotifState(fingerprint, count, markers);
        wrapped(count, markers);
      });
    } catch (_) {
      if (notifFullFallbackAllowed()) {
        notifMarkFullFallback();
        fetchNotifCountFull(s, wrapped);
      } else {
        notifFetchInProgress = false;
        notifReleaseLock();
        notifServeFromCache(callback);
      }
    }
  }

  function updateBell(count) {
    var badge = document.getElementById('najran-bell-badge');
    var btn = document.getElementById('najran-bell-btn');
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

  function attachBellClick(allIds) {
    var btn = document.getElementById('najran-bell-btn');
    if (!btn) return;
    btn.onclick = function () {
      markAllSeen(allIds || []);
      updateBell(0);
      var role = String((getSession() || {}).role || 'user').toLowerCase();
      window.location.href = (role === 'admin' || role === 'supervisor') ? '/original/approval.html' : '/extracts/track';
    };
  }

  function checkNotifications(force) {
    fetchNotifCount(function (count, allIds) {
      updateBell(count);
      attachBellClick(allIds);
    }, force);
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (window.__NAJRAN_NOTIF_POLL_INSTALLED__) return;
    window.__NAJRAN_NOTIF_POLL_INSTALLED__ = true;

    // === تصنيف الصفحة (توفير Neon) ===
    // صفحات التشغيل اليومي: البادج من الكاش فقط — لا fetch تلقائي إطلاقًا،
    // لأن المستخدم بيتنقل بينها عشرات المرات وكل تنقّل كان = ضربة قاعدة بيانات.
    // صفحة المراجعة (approval): فحص فوري force عند الفتح.
    // باقي الصفحات: فحص عادي يمر على الكاش الزمني (TTL حسب الدور).
    var OPERATIONAL_PAGES = {
      'attendance.html': 1, 'performance.html': 1, 'achievement.html': 1,
      'consumables.html': 1, 'spare_parts.html': 1,
      'najran_general.html': 1, 'najran_general_performance.html': 1, 'najran_general_achievement.html': 1,
      'najran_dental_attendance.html': 1, 'najran_dental_performance.html': 1,
      'admin_offices_attendance.html': 1, 'admin_offices_consumables.html': 1,
      'health_centers_attendance.html': 1
    };
    var REVIEW_PAGES = { 'approval.html': 1 };
    var isOperationalPage = !!OPERATIONAL_PAGES[pageFile];
    var isReviewPage = !!REVIEW_PAGES[pageFile];

    function serveCachedBadge() {
      var cached = getCachedNotifState();
      updateBell(cached.count);
      attachBellClick(cached.markers);
    }

    function checkIfVisible() {
      if (document.hidden) return;
      if (isOperationalPage) { serveCachedBadge(); return; }
      checkNotifications(isReviewPage);
    }

    checkIfVisible();
    // صفحات التشغيل: بلا interval نهائيًا. غيرها: interval موجود لكن الكاش
    // الزمني يمنع أي fetch فعلي زائد.
    if (!isOperationalPage) setInterval(checkIfVisible, NOTIF_INTERVAL_MS);

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) return;
      if (isOperationalPage) { serveCachedBadge(); return; }
      checkNotifications(false);
    });
  });
})();
