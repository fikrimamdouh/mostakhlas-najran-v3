/**
 * production-client-monitor.js — Najran Production Incident Monitor v1b
 * Safe, additive browser incident monitor. No business logic changes.
 */
(function () {
  'use strict';

  if (window.__NAJRAN_MONITOR_V1_INSTALLED__) return;
  window.__NAJRAN_MONITOR_V1_INSTALLED__ = true;

  var SESSION_KEY = 'najran_session';
  var QUEUE_KEY = 'najran_monitor_event_queue_v1';
  var META_KEY = 'najran_monitor_meta_v1';
  var ENDPOINT = '/api/client-events';
  var BUILD = 'monitor_v2_20260709_circuit_breaker';
  var MAX_QUEUE = 20;
  var MAX_LAST_ACTIONS = 20;
  var RATE_LIMIT_MAX = 8;
  var RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
  var DEBOUNCE_FLUSH_MS = 2000;
  var PERIODIC_FLUSH_MS = 60 * 1000;

  var CRITICAL_KEYS = {
    persistentContractData: 1,
    persistentExtractData: 1,
    attendanceData: 1,
    ng_attendanceData: 1,
    nd_attendanceData: 1,
    centersAttendanceData_v2: 1,
    healthCentersAttendanceData: 1,
    adminOfficesAttendanceData_v1: 1,
    adminOfficesFullAttendanceBundle_v1: 1,
    summary_data_consumables_v27: 1,
    performance_data_consumables_v27: 1,
    subcontractors_data_consumables_v27: 1,
    water_supply_data_consumables_v27: 1,
    sewage_disposal_data_consumables_v27: 1,
    signatures_data_consumables_v27: 1,
    hospitalConsumablesRaiseLettersSettings_v1: 1,
    sb_sigs_consumables: 1,
    performanceSignatures_v2: 1,
    dynamicSignatures: 1,
    contractorSignature: 1,
    spare_partsData: 1,
    finalLaborCost: 1,
    finalConsumablesCost: 1,
    najran_revision_snapshot: 1,
    najran_revision_extract_id: 1,
    najran_revision_mode: 1,
    najran_active_hospital_context: 1
  };

  var SIGNATURE_KEYS = {
    signatures_data_consumables_v27: 1,
    sb_sigs_consumables: 1,
    performanceSignatures_v2: 1,
    dynamicSignatures: 1,
    contractorSignature: 1
  };

  var severityDefault = {
    JS_ERROR: 'error',
    UNHANDLED_REJECTION: 'error',
    API_FAILURE: 'warning',
    API_401: 'warning',
    API_403: 'warning',
    API_404: 'warning',
    API_500: 'error',
    STORAGE_EMPTY_OVERWRITE: 'critical',
    STORAGE_SHRUNK: 'critical',
    STORAGE_REMOVED: 'warning',
    STORAGE_CLEARED: 'critical',
    CTX_HOSPITAL_MISMATCH: 'critical',
    CONSUMABLES_SUMMARY_DOM_MISMATCH: 'critical',
    SIGNATURES_OVERWRITTEN_OR_MISSING: 'critical',
    BACKUP_RESTORE_OVERWRITTEN: 'critical',
    REVISION_ENTERED: 'info',
    REVISION_SNAPSHOT_APPLIED: 'info',
    REVISION_SNAPSHOT_REAPPLIED: 'warning',
    RENDER_TABLES_MISSING: 'warning',
    SUBMIT_INCOMPLETE_PAYLOAD: 'critical',
    MANUAL_INCIDENT: 'warning'
  };

  function safe(fn, fallback) { try { return fn(); } catch (_) { return fallback == null ? null : fallback; } }
  function cleanKey(k) { return String(k || '').replace(/^(_u\d+_)+/, ''); }
  function lsGet(k) { return safe(function () { return localStorage.getItem(k); }, null); }
  function lsSet(k, v) { return safe(function () { localStorage.setItem(k, v); return true; }, false); }
  function lsRemove(k) { return safe(function () { localStorage.removeItem(k); return true; }, false); }
  function lsKey(i) { return safe(function () { return localStorage.key(i); }, null); }
  function lsLen() { return safe(function () { return localStorage.length; }, 0) || 0; }
  function parseJson(v, fallback) { return safe(function () { return v ? JSON.parse(v) : fallback; }, fallback); }

  var SENSITIVE_KEY_RE = /(token|password|authorization|bearer|clerk|jwt|secret|api[_-]?key|cookie|session_id|sessionid|clerktoken)/i;
  var BEARER_INLINE_RE = /\b(bearer\s+)[\w.\-]{10,}/gi;
  var JWT_INLINE_RE = /\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/g;
  var LONG_TOKENISH_RE = /\b[A-Za-z0-9_\-]{40,}\b/g;

  function redactString(s) {
    if (typeof s !== 'string') return s;
    return s
      .replace(BEARER_INLINE_RE, '$1[REDACTED]')
      .replace(JWT_INLINE_RE, '[REDACTED_JWT]')
      .replace(LONG_TOKENISH_RE, function (m) {
        if (m.indexOf('/') !== -1 || m.indexOf('.') !== -1) return m;
        return '[REDACTED_TOKENISH]';
      });
  }

  function sanitize(value, depth) {
    depth = depth || 0;
    if (depth > 8) return '[TRUNCATED_DEPTH]';
    if (value === null || value === undefined) return value;
    if (typeof value === 'string') return redactString(value);
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.slice(0, 80).map(function (v) { return sanitize(v, depth + 1); });
    if (typeof value === 'object') {
      var out = {}, count = 0;
      for (var k in value) {
        if (!Object.prototype.hasOwnProperty.call(value, k)) continue;
        if (count++ > 50) break;
        out[k] = SENSITIVE_KEY_RE.test(k) ? '[REDACTED]' : sanitize(value[k], depth + 1);
      }
      return out;
    }
    return String(value).slice(0, 500);
  }

  function getSession() { return parseJson(lsGet(SESSION_KEY), {}) || {}; }
  function currentPage() {
    return safe(function () {
      var seg = (window.location.pathname || '').split('/').filter(Boolean).pop() || 'index';
      return String(seg).replace(/\.html$/, '');
    }, 'unknown');
  }

  var lastActions = [];
  function pushAction(kind, extra) {
    var a = { kind: String(kind).slice(0, 40), at: new Date().toISOString() };
    if (extra && typeof extra === 'object') a.extra = sanitize(extra);
    lastActions.push(a);
    if (lastActions.length > MAX_LAST_ACTIONS) lastActions.shift();
  }

  function countRows(obj) {
    if (obj == null) return 0;
    if (Array.isArray(obj)) return obj.length;
    if (typeof obj !== 'object') return 0;
    var n = 0;
    for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k) && Array.isArray(obj[k])) n += obj[k].length;
    return n;
  }
  function countMainRows(obj) {
    if (!obj || typeof obj !== 'object') return 0;
    if (Array.isArray(obj.summary)) return obj.summary.length;
    if (Array.isArray(obj.mainItems)) return obj.mainItems.length;
    if (Array.isArray(obj.rows)) return obj.rows.length;
    if (Array.isArray(obj)) return obj.length;
    return countRows(obj);
  }
  function countSignatures(obj) {
    if (!obj || typeof obj !== 'object') return 0;
    var count = 0;
    for (var k in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
      var v = obj[k];
      if (typeof v === 'string' && v.length > 20) count++;
      else if (typeof v === 'object' && v && (v.dataUrl || v.signature || v.data)) count++;
    }
    return count;
  }

  function loadMeta() {
    var m = parseJson(lsGet(META_KEY), {}) || {};
    if (!Array.isArray(m.timestamps)) m.timestamps = [];
    if (!m.dedupeKeys || typeof m.dedupeKeys !== 'object') m.dedupeKeys = {};
    return m;
  }
  function saveMeta(m) { lsSet(META_KEY, JSON.stringify(m)); }
  function withinRateLimit() {
    var m = loadMeta();
    var cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
    m.timestamps = m.timestamps.filter(function (t) { return t > cutoff; });
    saveMeta(m);
    return m.timestamps.length < RATE_LIMIT_MAX;
  }
  function bumpRateLimit() {
    var m = loadMeta();
    var cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
    m.timestamps = m.timestamps.filter(function (t) { return t > cutoff; });
    m.timestamps.push(Date.now());
    saveMeta(m);
  }
  function isDuplicate(type, page, message) {
    var key = String(type) + '|' + String(page) + '|' + String(message || '').slice(0, 200);
    var m = loadMeta(), cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
    for (var k in m.dedupeKeys) if (m.dedupeKeys[k] < cutoff) delete m.dedupeKeys[k];
    if (m.dedupeKeys[key] && m.dedupeKeys[key] > cutoff) { saveMeta(m); return true; }
    m.dedupeKeys[key] = Date.now();
    saveMeta(m);
    return false;
  }

  function readQueue() { return parseJson(lsGet(QUEUE_KEY), []) || []; }
  function writeQueue(q) { if (q.length > MAX_QUEUE) q = q.slice(-MAX_QUEUE); lsSet(QUEUE_KEY, JSON.stringify(q)); }

  function snapshotCriticalState() {
    var out = { keys: [], count: 0, emptyCount: 0 };
    for (var i = 0, n = lsLen(); i < n; i++) {
      var k = lsKey(i); if (!k) continue;
      var ck = cleanKey(k);
      if (!CRITICAL_KEYS[ck]) continue;
      var v = lsGet(k), size = v ? v.length : 0, empty = !v || v === '{}' || v === '[]' || v === '""';
      out.keys.push({ key: ck, size: size, empty: empty });
      out.count++;
      if (empty) out.emptyCount++;
    }
    return out;
  }

  function enqueue(type, payload, severity) {
    try {
      if (!withinRateLimit()) return;
      var page = currentPage();
      var msg = (payload && (payload.message || payload.reason)) || '';
      if (isDuplicate(type, page, msg)) return;
      var s = getSession();
      var event = {
        type: type,
        severity: severity || severityDefault[type] || 'info',
        page: page,
        url: String(window.location.href).slice(0, 500),
        userId: s.userId || s.id || null,
        userName: s.name || s.userName || null,
        userEmail: s.email || null,
        role: s.role || null,
        hospital: s.hospital || null,
        company: s.company || s.companyName || null,
        buildVersion: BUILD,
        revisionMode: !!lsGet('najran_revision_mode'),
        revisionExtractId: lsGet('najran_revision_extract_id'),
        message: msg ? String(msg).slice(0, 500) : '',
        stack: payload && payload.stack ? String(payload.stack).slice(0, 4000) : '',
        lastActions: lastActions.slice(-MAX_LAST_ACTIONS),
        criticalState: snapshotCriticalState(),
        timestamp: new Date().toISOString(),
        _payload: sanitize(payload || {})
      };
      var q = readQueue();
      q.push(event);
      writeQueue(q);
      bumpRateLimit();
      window.__najranMonitorLastIncidentValue = event;
      scheduleFlush();
    } catch (_) {}
  }

  window.__najranReportIncident = function (type, payload) {
    try { enqueue(String(type || 'MANUAL_INCIDENT').toUpperCase(), payload || {}); } catch (_) {}
  };

  var flushTimer = null;
  var flushInFlight = false;

  // === Circuit breaker (توفير Neon وقت الأعطال) ===
  // فشل POST مرتين متتاليتين (شبكة أو status >= 400) → إيقاف كل محاولات
  // الإرسال 10 دقائق. الأحداث تستمر فى التخزين المحلى (طابور الـ50) وتُرسل
  // بعد فتح الدائرة — صفر حمل إضافى على السيرفر/القاعدة وقت ما يكونوا متعبين.
  var CIRCUIT_FAILURE_THRESHOLD = 2;
  var CIRCUIT_OPEN_MS = 10 * 60 * 1000;
  var circuitConsecutiveFailures = 0;
  var circuitOpenUntil = 0;
  function circuitIsOpen() { return Date.now() < circuitOpenUntil; }
  function circuitRecordFailure() {
    circuitConsecutiveFailures++;
    if (circuitConsecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD) {
      circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS;
      circuitConsecutiveFailures = 0;
      try { console.warn('[NajranMonitor] circuit open — flush paused 10min'); } catch (_) {}
    }
  }
  function circuitRecordSuccess() { circuitConsecutiveFailures = 0; circuitOpenUntil = 0; }

  async function getFreshAuthToken() {
    try { if (typeof window.najranGetFreshToken === 'function') { var t = await window.najranGetFreshToken(); if (t) return t; } } catch (_) {}
    try { if (window.parent && window.parent !== window && typeof window.parent.najranGetFreshToken === 'function') { var pt = await window.parent.najranGetFreshToken(); if (pt) return pt; } } catch (_) {}
    // بديل أخير: توكن الجلسة فقط لو حديث (<55 ثانية) — توكن قديم = POST محكوم
    // بـ401 أحمر بلا فائدة ويستهلك عدّاد الـ circuit breaker. لو مفيش توكن
    // صالح، flush يرجع بهدوء والطابور محفوظ للمحاولة القادمة.
    var s = getSession();
    if (s && s.clerkToken && s.timestamp && (Date.now() - s.timestamp) < 55000) return s.clerkToken;
    return null;
  }
  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(function () { flushTimer = null; flush(); }, DEBOUNCE_FLUSH_MS);
  }
  async function flush() {
    if (flushInFlight) return;
    if (circuitIsOpen()) return; // الدائرة مفتوحة — تخزين محلى فقط، صفر شبكة
    if (!navigator.onLine) return;
    var q = readQueue();
    if (!q.length) return;
    var token = await getFreshAuthToken();
    if (!token) return;
    flushInFlight = true;
    var toSend = q.slice(0, 10);
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      credentials: 'include',
      body: JSON.stringify({ events: toSend })
    }).then(function (r) {
      if (r && r.ok) { circuitRecordSuccess(); writeQueue(readQueue().slice(toSend.length)); }
      else { circuitRecordFailure(); }
    }).catch(function () { circuitRecordFailure(); }).finally(function () { flushInFlight = false; });
  }

  window.__najranMonitorFlush = function () { flush(); return 'flush-attempted'; };
  window.__najranMonitorStatus = function () {
    var s = getSession(), m = loadMeta();
    return { installed: true, build: BUILD, user: s.name || null, role: s.role || null, hospital: s.hospital || null, page: currentPage(), queueSize: readQueue().length, circuitOpen: circuitIsOpen(), circuitOpenUntil: circuitOpenUntil ? new Date(circuitOpenUntil).toISOString() : null, rateWindowUsed: (m.timestamps || []).length, rateLimitMax: RATE_LIMIT_MAX, lastActions: lastActions.slice(-5), revisionMode: !!lsGet('najran_revision_mode') };
  };
  window.__najranMonitorExport = function () { return JSON.stringify(readQueue(), null, 2); };
  window.__najranMonitorLastIncident = function () { return window.__najranMonitorLastIncidentValue || null; };
  window.__najranMonitorClearLocal = async function () { if (!await window.NajranDialogs.confirm('مسح طابور الأحداث المحلى؟')) return 'canceled'; lsRemove(QUEUE_KEY); return 'cleared'; };

  window.addEventListener('error', function (ev) {
    try { enqueue('JS_ERROR', { message: (ev.message || (ev.error && ev.error.message) || 'error').slice(0, 500), stack: ev.error && ev.error.stack ? String(ev.error.stack).slice(0, 4000) : '', source: ev.filename ? String(ev.filename).slice(0, 200) : '', lineno: ev.lineno || 0, colno: ev.colno || 0 }); } catch (_) {}
  }, true);
  window.addEventListener('unhandledrejection', function (ev) {
    try { var r = ev.reason, msg = r && (r.message || r.toString && r.toString()) || 'unhandled rejection'; enqueue('UNHANDLED_REJECTION', { message: String(msg).slice(0, 500), stack: r && r.stack ? String(r.stack).slice(0, 4000) : '' }); } catch (_) {}
  });

  (function wrapFetch() {
    if (typeof window.fetch !== 'function') return;
    var origFetch = window.fetch;
    window.fetch = function (input, init) {
      var url = ''; try { url = typeof input === 'string' ? input : (input && input.url) || ''; } catch (_) {}
      var method = (init && init.method) || 'GET';
      var isOwnApi = /^\/api\//.test(url) || /\/api\//.test(url);
      return origFetch.apply(this, arguments).then(function (res) {
        try {
          if (isOwnApi && res && res.status >= 400 && url.indexOf(ENDPOINT) === -1) {
            var type = res.status === 401 ? 'API_401' : res.status === 403 ? 'API_403' : res.status === 404 ? 'API_404' : res.status >= 500 ? 'API_500' : 'API_FAILURE';
            enqueue(type, { method: method, url: url.replace(/\?.*/, '').slice(0, 200), status: res.status, statusText: (res.statusText || '').slice(0, 80), message: method + ' ' + url.replace(/\?.*/, '') + ' → ' + res.status });
          }
        } catch (_) {}
        return res;
      }).catch(function (err) {
        try { if (isOwnApi && url.indexOf(ENDPOINT) === -1) enqueue('API_FAILURE', { method: method, url: url.replace(/\?.*/, '').slice(0, 200), message: 'fetch failed: ' + (err && err.message ? err.message : 'network') }); } catch (_) {}
        throw err;
      });
    };
  })();

  var protoSet = Storage.prototype.setItem;
  var protoRemove = Storage.prototype.removeItem;
  var protoClear = Storage.prototype.clear;

  Storage.prototype.setItem = function (key, value) {
    try {
      var ck = cleanKey(key);
      if (ck !== QUEUE_KEY && ck !== META_KEY && CRITICAL_KEYS[ck]) {
        var sv = String(value == null ? '' : value);
        var oldV = lsGet(key);
        var oldSize = oldV ? oldV.length : 0;
        var newSize = sv.length;
        var isEmpty = !sv || sv === '{}' || sv === '[]' || sv === '""' || sv === 'null';
        if (isEmpty && oldSize > 20) {
          var oldParsed = parseJson(oldV, null);
          enqueue('STORAGE_EMPTY_OVERWRITE', { key: ck, oldSize: oldSize, newSize: newSize, oldRowCount: countRows(oldParsed), oldMainRowCount: countMainRows(oldParsed), signatureCount: SIGNATURE_KEYS[ck] ? countSignatures(oldParsed) : undefined, message: 'empty overwrite on ' + ck, stack: (new Error()).stack || '' });
        } else if (oldSize > 200 && newSize < oldSize / 4) {
          var oldP = parseJson(oldV, null), newP = parseJson(sv, null);
          enqueue('STORAGE_SHRUNK', { key: ck, oldSize: oldSize, newSize: newSize, oldRowCount: countRows(oldP), newRowCount: countRows(newP), oldMainRowCount: countMainRows(oldP), newMainRowCount: countMainRows(newP), signatureCount: SIGNATURE_KEYS[ck] ? countSignatures(newP) : undefined, message: 'shrunk ' + oldSize + '→' + newSize + ' on ' + ck, stack: (new Error()).stack || '' });
        }
        if (SIGNATURE_KEYS[ck]) {
          var oldSigs = countSignatures(parseJson(oldV, null));
          var newSigs = countSignatures(parseJson(sv, null));
          if (oldSigs > 0 && newSigs < oldSigs) enqueue('SIGNATURES_OVERWRITTEN_OR_MISSING', { key: ck, oldSignatureCount: oldSigs, newSignatureCount: newSigs, message: 'signatures reduced ' + oldSigs + '→' + newSigs + ' on ' + ck, stack: (new Error()).stack || '' });
        }
      }
    } catch (_) {}
    return protoSet.call(this, key, value);
  };

  Storage.prototype.removeItem = function (key) {
    try {
      var ck = cleanKey(key);
      if (ck !== QUEUE_KEY && ck !== META_KEY && CRITICAL_KEYS[ck]) {
        var oldV = lsGet(key);
        if (oldV && oldV.length > 20) enqueue('STORAGE_REMOVED', { key: ck, oldSize: oldV.length, oldRowCount: countRows(parseJson(oldV, null)), message: 'critical key removed: ' + ck, stack: (new Error()).stack || '' });
      }
    } catch (_) {}
    return protoRemove.call(this, key);
  };

  Storage.prototype.clear = function () {
    try {
      var snap = snapshotCriticalState();
      var savedQueue = lsGet(QUEUE_KEY);
      var savedMeta = lsGet(META_KEY);
      if (snap.count > 0) enqueue('STORAGE_CLEARED', { beforeCriticalCount: snap.count, beforeCriticalKeys: snap.keys.map(function (x) { return x.key; }), message: 'localStorage.clear() with ' + snap.count + ' critical keys present', stack: (new Error()).stack || '' });
      var result = protoClear.call(this);
      if (savedQueue) lsSet(QUEUE_KEY, savedQueue);
      if (savedMeta) lsSet(META_KEY, savedMeta);
      return result;
    } catch (_) { return protoClear.call(this); }
  };

  (function watchHospitalContext() {
    var lastMismatchLoggedMin = null;
    setInterval(function () {
      try {
        var s = getSession(), ctx = lsGet('najran_active_hospital_context');
        if (s.hospital && ctx && s.hospital !== ctx) {
          var min = Math.floor(Date.now() / 60000); if (lastMismatchLoggedMin === min) return; lastMismatchLoggedMin = min;
          var diff = [];
          if (s.hospital.length !== ctx.length) diff.push('lengths ' + s.hospital.length + ' vs ' + ctx.length);
          for (var i = 0, ml = Math.min(s.hospital.length, ctx.length); i < ml && diff.length < 6; i++) if (s.hospital.charCodeAt(i) !== ctx.charCodeAt(i)) diff.push('pos ' + i + ': U+' + s.hospital.charCodeAt(i).toString(16) + ' vs U+' + ctx.charCodeAt(i).toString(16));
          enqueue('CTX_HOSPITAL_MISMATCH', { sessionHospital: s.hospital, ctxHospital: ctx, byteDiff: diff, message: 'session hospital != ctx hospital' });
        }
      } catch (_) {}
    }, 3000);
  })();

  (function watchRevision() {
    var lastMode = lsGet('najran_revision_mode');
    var lastSnap = lsGet('najran_revision_snapshot');
    var appliedCount = 0;
    setInterval(function () {
      try {
        var cur = lsGet('najran_revision_mode');
        if (cur !== lastMode) { if (cur) { enqueue('REVISION_ENTERED', { revisionExtractId: lsGet('najran_revision_extract_id'), message: 'entered revision mode' }); pushAction('revision-entered'); } lastMode = cur; }
        var snap = lsGet('najran_revision_snapshot');
        if (snap && cur && snap !== lastSnap) { lastSnap = snap; appliedCount++; enqueue(appliedCount === 1 ? 'REVISION_SNAPSHOT_APPLIED' : 'REVISION_SNAPSHOT_REAPPLIED', { revisionExtractId: lsGet('najran_revision_extract_id'), count: appliedCount, message: appliedCount === 1 ? 'revision snapshot applied' : 'revision snapshot reapplied (count=' + appliedCount + ')' }); }
      } catch (_) {}
    }, 5000);
  })();

  function checkConsumablesDom() {
    try {
      if (!/consumables/i.test(currentPage())) return;
      var s = getSession();
      var userScoped = (s.userId ? '_u' + s.userId + '_' : '') + 'summary_data_consumables_v27';
      var summaryRaw = lsGet('summary_data_consumables_v27') || lsGet(userScoped);
      var parsed = parseJson(summaryRaw, null);
      var storageRows = countRows(parsed);
      var storageMainRows = countMainRows(parsed);
      var domRows = 0;
      var domTextSampleLengths = [];
      var tbody = document.querySelector('#summary-table tbody');
      if (tbody) {
        var trs = tbody.querySelectorAll('tr'); domRows = trs.length;
        for (var i = 0; i < Math.min(trs.length, 5); i++) domTextSampleLengths.push(String(trs[i].textContent || '').trim().length);
      }
      if (storageMainRows > 0 && domRows === 0) enqueue('CONSUMABLES_SUMMARY_DOM_MISMATCH', { storageRows: storageRows, storageMainRows: storageMainRows, domRows: domRows, domTextSampleLengths: domTextSampleLengths, renderTablesExists: typeof window.renderTables === 'function', renderAllTablesExists: typeof window.renderAllTables === 'function', message: 'consumables summary in storage (' + storageMainRows + ' main rows) but DOM empty' });
      if (!window.renderTables && /consumables/i.test(currentPage())) enqueue('RENDER_TABLES_MISSING', { message: 'window.renderTables is undefined on consumables page' });
    } catch (_) {}
  }

  (function watchBackupRestore() {
    var prevSizes = {};
    setInterval(function () {
      try {
        var now = Date.now(), currentSizes = {};
        for (var key in CRITICAL_KEYS) { var v = lsGet(key); currentSizes[key] = v ? v.length : 0; }
        for (var k in currentSizes) {
          if (prevSizes[k] === undefined) continue;
          if (prevSizes[k] > 500 && currentSizes[k] < prevSizes[k] / 3) {
            var recentRestore = lsGet('__najran_backup_restore_at') || lsGet('backupRestoredAt');
            if (recentRestore && (now - Number(recentRestore) < 10000)) enqueue('BACKUP_RESTORE_OVERWRITTEN', { key: k, sizeBefore: prevSizes[k], sizeAfter: currentSizes[k], restoreAt: new Date(Number(recentRestore)).toISOString(), message: 'key ' + k + ' shrunk shortly after backup restore' });
          }
        }
        prevSizes = currentSizes;
      } catch (_) {}
    }, 3000);
  })();

  var BUTTON_MATCHERS = [
    { kind: 'save', re: /حفظ|save/i }, { kind: 'approve', re: /اعتماد|approve/i }, { kind: 'submit', re: /رفع|submit/i }, { kind: 'restore', re: /استرجاع|استعادة|restore/i }, { kind: 'backup', re: /نسخة\s*احتياطية|backup/i }, { kind: 'load-foundation', re: /تحميل\s*من\s*التأسيسي|foundation/i }, { kind: 'edit', re: /تعديل|edit/i }, { kind: 'finish', re: /إنهاء|finish/i }, { kind: 'print', re: /طباعة|print/i }, { kind: 'open-letter', re: /فتح\s*خطاب|letter/i }, { kind: 'hospital-switch', re: /تغيير\s*(مستشفى|موقع)|switch/i }
  ];
  document.addEventListener('click', function (e) {
    try {
      var el = e.target;
      for (var i = 0; i < 4 && el && el !== document.body; i++, el = el.parentNode) {
        var tag = (el.tagName || '').toLowerCase();
        if (tag === 'button' || tag === 'a' || (el.getAttribute && el.getAttribute('role') === 'button')) {
          var label = (el.textContent || (el.getAttribute && el.getAttribute('aria-label')) || '').trim();
          if (label.length > 0 && label.length < 60) for (var j = 0; j < BUTTON_MATCHERS.length; j++) if (BUTTON_MATCHERS[j].re.test(label)) { pushAction('click:' + BUTTON_MATCHERS[j].kind); return; }
          return;
        }
      }
    } catch (_) {}
  }, true);

  setInterval(function () { flush(); }, PERIODIC_FLUSH_MS);
  window.addEventListener('online', function () { flush(); });
  window.addEventListener('focus', function () { flush(); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) flush(); });

  pushAction('page-loaded', { page: currentPage() });
  setTimeout(checkConsumablesDom, 3500);
  setTimeout(checkConsumablesDom, 10000);
  setTimeout(flush, 1500);
  try { console.info('[NajranMonitor] active — ' + BUILD + ' — page:' + currentPage()); } catch (_) {}
})();
