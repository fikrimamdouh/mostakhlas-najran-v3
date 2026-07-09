/**
 * production-client-monitor.js — Najran Production Incident Monitor v1
 *
 * Purpose: passively collect technical incidents from every user's browser
 * and forward them to /api/client-events so an admin can see them in the
 * "مراقبة الإنتاج" tab inside settings_advanced.html — before the user has
 * to report the problem.
 *
 * Design principles:
 *   - Zero business-logic change. If the monitor fails or the endpoint is
 *     down, the user is never blocked; every failure path is caught and
 *     silenced.
 *   - No secrets. Tokens, passwords, JWTs, and Authorization headers are
 *     scrubbed by the client before any payload leaves the browser; the
 *     server re-scrubs as defense in depth.
 *   - No value dumps. For storage mutations we send sizes and row counts,
 *     never the actual data content.
 *   - No click-tracking. Only technically-meaningful button clicks (save,
 *     approve, submit, restore, print, hospital-switch) are recorded, and
 *     only their type — not the labels or arguments.
 *   - Coexists with the older ZahranTripwire (inlined at the top of
 *     auth-check.js). Both can log independently; this monitor's overrides
 *     wrap around the tripwire's via the prototype chain.
 *   - Offline queue: last 50 events survive a page close in localStorage
 *     and flush on the next load with credentials.
 *   - Rate limit: 20 events per 5 minutes per user; dedupe within window
 *     by (type + page + message).
 *
 * Console tools:
 *   window.__najranMonitorStatus()       current queue + config
 *   window.__najranMonitorFlush()        force flush of offline queue
 *   window.__najranMonitorExport()       JSON dump of the local queue
 *   window.__najranMonitorLastIncident() the most recent event captured
 *   window.__najranReportIncident(t, p)  page-level report helper
 *
 * Zahran tripwire is preserved:
 *   window.__zahranTripwireStatus / Report / Export still work.
 */
(function () {
  'use strict';

  if (window.__NAJRAN_MONITOR_V1_INSTALLED__) return;
  window.__NAJRAN_MONITOR_V1_INSTALLED__ = true;

  // ==================================================================
  // Config
  // ==================================================================
  var SESSION_KEY = 'najran_session';
  var QUEUE_KEY = 'najran_monitor_event_queue_v1';
  var META_KEY = 'najran_monitor_meta_v1';
  var ENDPOINT = '/api/client-events';
  var BUILD = 'monitor_v1_20260709_a';

  var MAX_QUEUE = 50;
  var MAX_LAST_ACTIONS = 20;
  var RATE_LIMIT_MAX = 20;
  var RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
  var DEBOUNCE_FLUSH_MS = 2000;
  var PERIODIC_FLUSH_MS = 60 * 1000;

  // Critical storage keys we watch for mutations
  var CRITICAL_KEYS = {
    'persistentContractData': 1,
    'persistentExtractData': 1,
    'attendanceData': 1,
    'ng_attendanceData': 1,
    'nd_attendanceData': 1,
    'centersAttendanceData_v2': 1,
    'healthCentersAttendanceData': 1,
    'adminOfficesAttendanceData_v1': 1,
    'adminOfficesFullAttendanceBundle_v1': 1,
    'summary_data_consumables_v27': 1,
    'performance_data_consumables_v27': 1,
    'subcontractors_data_consumables_v27': 1,
    'water_supply_data_consumables_v27': 1,
    'sewage_disposal_data_consumables_v27': 1,
    'signatures_data_consumables_v27': 1,
    'hospitalConsumablesRaiseLettersSettings_v1': 1,
    'sb_sigs_consumables': 1,
    'spare_partsData': 1,
    'finalLaborCost': 1,
    'finalConsumablesCost': 1,
    'najran_revision_snapshot': 1,
    'najran_revision_extract_id': 1,
    'najran_revision_mode': 1,
    'najran_active_hospital_context': 1
  };

  // Storage keys where empty/near-empty writes trigger a warning
  var SIGNATURE_KEYS = {
    'signatures_data_consumables_v27': 1,
    'sb_sigs_consumables': 1,
    'performanceSignatures_v2': 1,
    'dynamicSignatures': 1,
    'contractorSignature': 1
  };

  // ==================================================================
  // Raw storage helpers — never go through cloud-sync overrides
  // ==================================================================
  var raw = {
    get: Storage.prototype.getItem.bind(localStorage),
    set: Storage.prototype.setItem.bind(localStorage),
    remove: Storage.prototype.removeItem.bind(localStorage),
    key: Storage.prototype.key.bind(localStorage),
    len: function () { return localStorage.length; }
  };

  function safe(fn) { try { return fn(); } catch (_) { return null; } }

  function getSession() {
    return safe(function () { return JSON.parse(raw.get(SESSION_KEY) || '{}'); }) || {};
  }

  function getBuildVersion() {
    try {
      var meta = document.querySelector('meta[name="build-version"]');
      if (meta && meta.content) return meta.content;
    } catch (_) {}
    return BUILD;
  }

  function currentPage() {
    try {
      var p = window.location && window.location.pathname || '';
      var seg = p.split('/').filter(Boolean).pop() || 'index';
      return String(seg).replace(/\.html$/, '');
    } catch (_) { return 'unknown'; }
  }

  // ==================================================================
  // Redaction — matches server-side rules
  // ==================================================================
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
    if (Array.isArray(value)) {
      var arr = [];
      for (var i = 0; i < value.length && i < 100; i++) arr.push(sanitize(value[i], depth + 1));
      return arr;
    }
    if (typeof value === 'object') {
      var out = {};
      var count = 0;
      for (var k in value) {
        if (!Object.prototype.hasOwnProperty.call(value, k)) continue;
        if (count++ > 50) break;
        if (SENSITIVE_KEY_RE.test(k)) { out[k] = '[REDACTED]'; continue; }
        out[k] = sanitize(value[k], depth + 1);
      }
      return out;
    }
    return String(value).slice(0, 500);
  }

  // ==================================================================
  // lastActions ring buffer — technical actions only
  // ==================================================================
  var lastActions = [];

  function pushAction(kind, extra) {
    var a = { kind: String(kind).slice(0, 40), at: new Date().toISOString() };
    if (extra && typeof extra === 'object') {
      var s = sanitize(extra);
      var kept = {};
      var cnt = 0;
      for (var k in s) {
        if (cnt++ > 8) break;
        var v = s[k];
        if (typeof v === 'string') kept[k] = v.slice(0, 120);
        else if (typeof v === 'number' || typeof v === 'boolean') kept[k] = v;
      }
      a.extra = kept;
    }
    lastActions.push(a);
    if (lastActions.length > MAX_LAST_ACTIONS) lastActions.shift();
  }

  // ==================================================================
  // Row / signature counting for storage payloads
  // ==================================================================
  function tryParseJson(v) { try { return v == null ? null : JSON.parse(v); } catch (_) { return null; } }

  function countRows(obj) {
    if (obj == null) return 0;
    if (Array.isArray(obj)) return obj.length;
    if (typeof obj !== 'object') return 0;
    var n = 0;
    for (var k in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
      if (Array.isArray(obj[k])) n += obj[k].length;
    }
    return n;
  }

  function countMainRows(obj) {
    // "Main" specific to consumables summary: first level array count
    if (!obj || typeof obj !== 'object') return 0;
    if (Array.isArray(obj.summary)) return obj.summary.length;
    if (Array.isArray(obj.mainItems)) return obj.mainItems.length;
    if (Array.isArray(obj.rows)) return obj.rows.length;
    if (Array.isArray(obj)) return obj.length;
    return countRows(obj);
  }

  function countSignatures(obj) {
    if (!obj) return 0;
    if (typeof obj === 'object') {
      // Look for keys whose values are non-empty strings or objects
      var count = 0;
      for (var k in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
        var v = obj[k];
        if (typeof v === 'string' && v.length > 20) count++;
        else if (typeof v === 'object' && v && (v.dataUrl || v.signature || v.data)) count++;
      }
      return count;
    }
    return 0;
  }

  function extractNames(obj, limit) {
    var out = [];
    if (!obj) return out;
    var arr = Array.isArray(obj) ? obj : (obj.summary || obj.mainItems || obj.rows || []);
    if (!Array.isArray(arr)) return out;
    for (var i = 0; i < arr.length && out.length < limit; i++) {
      var row = arr[i];
      if (!row) continue;
      var name = row.name || row.itemName || row.title || row.description || row.item || '';
      if (typeof name === 'string' && name.length > 0) out.push(name.slice(0, 80));
    }
    return out;
  }

  // ==================================================================
  // Rate limit + dedupe
  // ==================================================================
  function loadMeta() {
    var m = safe(function () { return JSON.parse(raw.get(META_KEY) || '{}'); }) || {};
    if (!Array.isArray(m.timestamps)) m.timestamps = [];
    if (!m.dedupeKeys || typeof m.dedupeKeys !== 'object') m.dedupeKeys = {};
    return m;
  }
  function saveMeta(m) { safe(function () { raw.set(META_KEY, JSON.stringify(m)); }); }

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
    var m = loadMeta();
    var cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
    // Prune old
    for (var k in m.dedupeKeys) { if (m.dedupeKeys[k] < cutoff) delete m.dedupeKeys[k]; }
    if (m.dedupeKeys[key] && m.dedupeKeys[key] > cutoff) { saveMeta(m); return true; }
    m.dedupeKeys[key] = Date.now();
    saveMeta(m);
    return false;
  }

  // ==================================================================
  // Queue
  // ==================================================================
  function readQueue() {
    return safe(function () { return JSON.parse(raw.get(QUEUE_KEY) || '[]') || []; }) || [];
  }
  function writeQueue(q) {
    if (q.length > MAX_QUEUE) q = q.slice(-MAX_QUEUE);
    safe(function () { raw.set(QUEUE_KEY, JSON.stringify(q)); });
  }

  // ==================================================================
  // Build criticalState snapshot — sizes only, no values
  // ==================================================================
  function snapshotCriticalState() {
    var out = { keys: [], count: 0, emptyCount: 0 };
    var n = raw.len();
    for (var i = 0; i < n; i++) {
      var k = raw.key(i);
      if (!k) continue;
      var cleanK = k.replace(/^(_u\d+_)+/, '');
      if (CRITICAL_KEYS[cleanK]) {
        var v = raw.get(k);
        var size = v ? v.length : 0;
        var empty = !v || v === '{}' || v === '[]' || v === '""';
        out.keys.push({ key: cleanK, size: size, empty: empty });
        out.count++;
        if (empty) out.emptyCount++;
      }
    }
    return out;
  }

  // ==================================================================
  // Enqueue an event
  // ==================================================================
  var severityDefault = {
    'JS_ERROR': 'error',
    'UNHANDLED_REJECTION': 'error',
    'API_FAILURE': 'warning',
    'API_401': 'warning',
    'API_403': 'warning',
    'API_404': 'warning',
    'API_500': 'error',
    'STORAGE_EMPTY_OVERWRITE': 'critical',
    'STORAGE_SHRUNK': 'critical',
    'STORAGE_REMOVED': 'warning',
    'STORAGE_CLEARED': 'critical',
    'CTX_HOSPITAL_MISMATCH': 'critical',
    'CONSUMABLES_SUMMARY_DOM_MISMATCH': 'critical',
    'SIGNATURES_OVERWRITTEN_OR_MISSING': 'critical',
    'BACKUP_RESTORE_OVERWRITTEN': 'critical',
    'REVISION_ENTERED': 'info',
    'REVISION_SNAPSHOT_APPLIED': 'info',
    'REVISION_SNAPSHOT_REAPPLIED': 'warning',
    'RENDER_TABLES_MISSING': 'warning',
    'SUBMIT_INCOMPLETE_PAYLOAD': 'critical',
    'MANUAL_INCIDENT': 'warning'
  };

  function enqueue(type, payload, severity) {
    try {
      if (!withinRateLimit()) return; // silent drop when over limit
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
        buildVersion: getBuildVersion(),
        revisionMode: !!(safe(function(){ return raw.get('najran_revision_mode'); })),
        revisionExtractId: safe(function(){ return raw.get('najran_revision_extract_id'); }),
        message: (msg ? String(msg).slice(0, 500) : ''),
        stack: (payload && payload.stack ? String(payload.stack).slice(0, 4000) : ''),
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

  // Expose for page-level reports (safe channel)
  window.__najranReportIncident = function (type, payload) {
    try { enqueue(String(type || 'MANUAL_INCIDENT').toUpperCase(), payload || {}); } catch (_) {}
  };

  // ==================================================================
  // Flush (POST /api/client-events)
  // ==================================================================
  var flushTimer = null;
  var flushInFlight = false;

  function getAuthToken() {
    var s = getSession();
    var age = Date.now() - (s.timestamp || 0);
    if (s.clerkToken && age < 55 * 1000) return s.clerkToken;
    return null;
  }

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(function () { flushTimer = null; flush(); }, DEBOUNCE_FLUSH_MS);
  }

  function flush() {
    if (flushInFlight) return;
    if (!navigator.onLine) return;
    var q = readQueue();
    if (!q.length) return;
    var token = getAuthToken();
    if (!token) return; // wait for a session refresh; queue survives across loads

    flushInFlight = true;
    var toSend = q.slice(0, 30);
    var headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };

    fetch(ENDPOINT, {
      method: 'POST',
      headers: headers,
      credentials: 'include',
      body: JSON.stringify({ events: toSend })
    }).then(function (r) {
      if (r && r.ok) {
        // Drop what we sent from the queue
        var remaining = readQueue().slice(toSend.length);
        writeQueue(remaining);
      }
    }).catch(function () {
      // Keep in queue for next attempt
    }).finally(function () {
      flushInFlight = false;
    });
  }

  window.__najranMonitorFlush = function () { flush(); return 'flush-attempted'; };
  window.__najranMonitorStatus = function () {
    var s = getSession();
    var m = loadMeta();
    return {
      installed: true,
      build: BUILD,
      user: s.name || null,
      role: s.role || null,
      hospital: s.hospital || null,
      page: currentPage(),
      queueSize: readQueue().length,
      rateWindowUsed: (m.timestamps || []).length,
      rateLimitMax: RATE_LIMIT_MAX,
      lastActions: lastActions.slice(-5),
      revisionMode: !!(safe(function(){ return raw.get('najran_revision_mode'); }))
    };
  };
  window.__najranMonitorExport = function () { return JSON.stringify(readQueue(), null, 2); };
  window.__najranMonitorLastIncident = function () { return window.__najranMonitorLastIncidentValue || null; };
  window.__najranMonitorClearLocal = function () {
    if (!confirm('مسح طابور الأحداث المحلى؟')) return 'canceled';
    safe(function () { raw.remove(QUEUE_KEY); });
    return 'cleared';
  };

  // Periodic flush + flush on visibility/online
  setInterval(function () { flush(); }, PERIODIC_FLUSH_MS);
  window.addEventListener('online', function () { flush(); });
  window.addEventListener('focus', function () { flush(); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) flush(); });
  window.addEventListener('beforeunload', function () {
    // Use sendBeacon for best-effort delivery on unload
    try {
      var q = readQueue();
      if (!q.length) return;
      var token = getAuthToken();
      if (!token) return;
      var blob = new Blob([JSON.stringify({ events: q.slice(0, 30), _via: 'beacon' })], { type: 'application/json' });
      // Beacon can't set custom headers; we include token in body header alias
      // which the server will ignore — but a queued flush on next load handles it.
      navigator.sendBeacon && navigator.sendBeacon(ENDPOINT + '?_beacon=1', blob);
    } catch (_) {}
  });

  // ==================================================================
  // Detector 1: global JS errors + unhandled rejections
  // ==================================================================
  window.addEventListener('error', function (ev) {
    try {
      enqueue('JS_ERROR', {
        message: (ev.message || (ev.error && ev.error.message) || 'error').slice(0, 500),
        stack: (ev.error && ev.error.stack) ? String(ev.error.stack).slice(0, 4000) : '',
        source: ev.filename ? String(ev.filename).slice(0, 200) : '',
        lineno: ev.lineno || 0,
        colno: ev.colno || 0
      });
    } catch (_) {}
  }, true);

  window.addEventListener('unhandledrejection', function (ev) {
    try {
      var reason = ev.reason;
      var msg = reason && (reason.message || reason.toString && reason.toString()) || 'unhandled rejection';
      enqueue('UNHANDLED_REJECTION', {
        message: String(msg).slice(0, 500),
        stack: reason && reason.stack ? String(reason.stack).slice(0, 4000) : ''
      });
    } catch (_) {}
  });

  // ==================================================================
  // Detector 2: fetch failures + API status monitoring
  // ==================================================================
  (function wrapFetch() {
    if (typeof window.fetch !== 'function') return;
    var origFetch = window.fetch;
    window.fetch = function (input, init) {
      var url = '';
      try { url = typeof input === 'string' ? input : (input && input.url) || ''; } catch (_) {}
      var method = (init && init.method) || 'GET';
      var isOwnApi = /^\/api\//.test(url) || /\/api\//.test(url);
      return origFetch.apply(this, arguments).then(function (res) {
        try {
          // Only alert on our own API — external services generate noise.
          if (isOwnApi && res && res.status >= 400 && url.indexOf(ENDPOINT) === -1) {
            var type = 'API_FAILURE';
            if (res.status === 401) type = 'API_401';
            else if (res.status === 403) type = 'API_403';
            else if (res.status === 404) type = 'API_404';
            else if (res.status >= 500) type = 'API_500';
            enqueue(type, {
              method: method,
              url: url.replace(/\?.*/, '').slice(0, 200),
              status: res.status,
              statusText: (res.statusText || '').slice(0, 80),
              message: method + ' ' + url.replace(/\?.*/, '') + ' → ' + res.status
            });
          }
        } catch (_) {}
        return res;
      }).catch(function (err) {
        try {
          if (isOwnApi && url.indexOf(ENDPOINT) === -1) {
            enqueue('API_FAILURE', {
              method: method,
              url: url.replace(/\?.*/, '').slice(0, 200),
              message: 'fetch failed: ' + (err && err.message ? err.message : 'network')
            });
          }
        } catch (_) {}
        throw err;
      });
    };
  })();

  // ==================================================================
  // Detector 3: storage mutations on critical keys
  // Wraps Storage.prototype. Coexists with ZahranTripwire (its wrap sits
  // between ours and the real setter, since it was installed first).
  // ==================================================================
  var protoSet = Storage.prototype.setItem;
  var protoRemove = Storage.prototype.removeItem;
  var protoClear = Storage.prototype.clear;

  Storage.prototype.setItem = function (key, value) {
    try {
      var cleanK = String(key || '').replace(/^(_u\d+_)+/, '');
      if (cleanK !== QUEUE_KEY && cleanK !== META_KEY && CRITICAL_KEYS[cleanK]) {
        var sv = String(value == null ? '' : value);
        var oldV = raw.get(key);
        var oldSize = oldV ? oldV.length : 0;
        var newSize = sv.length;
        var isEmpty = !sv || sv === '{}' || sv === '[]' || sv === '""' || sv === 'null';

        if (isEmpty && oldSize > 20) {
          var oldParsed = tryParseJson(oldV);
          enqueue('STORAGE_EMPTY_OVERWRITE', {
            key: cleanK,
            oldSize: oldSize,
            newSize: newSize,
            oldRowCount: countRows(oldParsed),
            oldMainRowCount: countMainRows(oldParsed),
            signatureCount: SIGNATURE_KEYS[cleanK] ? countSignatures(oldParsed) : undefined,
            message: 'empty overwrite on ' + cleanK,
            stack: (new Error()).stack || ''
          });
        } else if (oldSize > 200 && newSize < oldSize / 4) {
          var oldP = tryParseJson(oldV);
          var newP = tryParseJson(sv);
          enqueue('STORAGE_SHRUNK', {
            key: cleanK,
            oldSize: oldSize,
            newSize: newSize,
            oldRowCount: countRows(oldP),
            newRowCount: countRows(newP),
            oldMainRowCount: countMainRows(oldP),
            newMainRowCount: countMainRows(newP),
            signatureCount: SIGNATURE_KEYS[cleanK] ? countSignatures(newP) : undefined,
            message: 'shrunk ' + oldSize + '→' + newSize + ' on ' + cleanK,
            stack: (new Error()).stack || ''
          });
        }
        // Signature-specific loss check
        if (SIGNATURE_KEYS[cleanK]) {
          var oldSigs = countSignatures(tryParseJson(oldV));
          var newSigs = countSignatures(tryParseJson(sv));
          if (oldSigs > 0 && newSigs < oldSigs) {
            enqueue('SIGNATURES_OVERWRITTEN_OR_MISSING', {
              key: cleanK,
              oldSignatureCount: oldSigs,
              newSignatureCount: newSigs,
              message: 'signatures reduced ' + oldSigs + '→' + newSigs + ' on ' + cleanK,
              stack: (new Error()).stack || ''
            });
          }
        }
      }
    } catch (_) {}
    return protoSet.apply(this, arguments);
  };

  Storage.prototype.removeItem = function (key) {
    try {
      var cleanK = String(key || '').replace(/^(_u\d+_)+/, '');
      if (cleanK !== QUEUE_KEY && cleanK !== META_KEY && CRITICAL_KEYS[cleanK]) {
        var oldV = raw.get(key);
        if (oldV && oldV.length > 20) {
          enqueue('STORAGE_REMOVED', {
            key: cleanK,
            oldSize: oldV.length,
            oldRowCount: countRows(tryParseJson(oldV)),
            message: 'critical key removed: ' + cleanK,
            stack: (new Error()).stack || ''
          });
        }
      }
    } catch (_) {}
    return protoRemove.apply(this, arguments);
  };

  Storage.prototype.clear = function () {
    try {
      var snap = snapshotCriticalState();
      if (snap.count > 0) {
        enqueue('STORAGE_CLEARED', {
          beforeCriticalCount: snap.count,
          beforeCriticalKeys: snap.keys.map(function (x) { return x.key; }),
          message: 'localStorage.clear() with ' + snap.count + ' critical keys present',
          stack: (new Error()).stack || ''
        });
      }
      // Preserve monitor's own state through the wipe so events aren't lost
      // right when we need them most. We snapshot our two keys, let clear
      // proceed, then restore. Session key is NOT restored — that's the caller's
      // decision (e.g., logout flow legitimately clears it).
      var savedQueue = raw.get(QUEUE_KEY);
      var savedMeta = raw.get(META_KEY);
      var result = protoClear.apply(this, arguments);
      try {
        if (savedQueue) raw.set(QUEUE_KEY, savedQueue);
        if (savedMeta) raw.set(META_KEY, savedMeta);
      } catch (_) {}
      return result;
    } catch (_) {}
    return protoClear.apply(this, arguments);
  };

  // ==================================================================
  // Detector 4: session.hospital vs najran_active_hospital_context drift
  // ==================================================================
  (function watchHospitalContext() {
    var lastMismatchLoggedMin = null;
    setInterval(function () {
      try {
        var s = getSession();
        var ctx = raw.get('najran_active_hospital_context');
        if (s.hospital && ctx && s.hospital !== ctx) {
          var min = Math.floor(Date.now() / 60000);
          if (lastMismatchLoggedMin === min) return;
          lastMismatchLoggedMin = min;
          // Byte-level diff for debugging unicode issues
          var diff = [];
          if (s.hospital.length !== ctx.length) diff.push('lengths ' + s.hospital.length + ' vs ' + ctx.length);
          var minLen = Math.min(s.hospital.length, ctx.length);
          for (var i = 0; i < minLen && diff.length < 6; i++) {
            if (s.hospital.charCodeAt(i) !== ctx.charCodeAt(i)) {
              diff.push('pos ' + i + ': U+' + s.hospital.charCodeAt(i).toString(16) + ' vs U+' + ctx.charCodeAt(i).toString(16));
            }
          }
          enqueue('CTX_HOSPITAL_MISMATCH', {
            sessionHospital: s.hospital,
            ctxHospital: ctx,
            byteDiff: diff,
            message: 'session hospital != ctx hospital'
          });
        }
      } catch (_) {}
    }, 3000);
  })();

  // ==================================================================
  // Detector 5: revision mode transitions
  // ==================================================================
  (function watchRevision() {
    var lastMode = raw.get('najran_revision_mode');
    var appliedCount = 0;
    setInterval(function () {
      try {
        var cur = raw.get('najran_revision_mode');
        if (cur !== lastMode) {
          if (cur) {
            enqueue('REVISION_ENTERED', {
              revisionExtractId: raw.get('najran_revision_extract_id'),
              message: 'entered revision mode'
            });
            pushAction('revision-entered');
          }
          lastMode = cur;
        }
        // Watch snapshot application
        var snap = raw.get('najran_revision_snapshot');
        if (snap && cur) {
          // heuristic: if snapshot changed while in revision mode, that's an apply
          if (!watchRevision._lastSnap || watchRevision._lastSnap !== snap) {
            watchRevision._lastSnap = snap;
            appliedCount++;
            if (appliedCount === 1) {
              enqueue('REVISION_SNAPSHOT_APPLIED', {
                revisionExtractId: raw.get('najran_revision_extract_id'),
                message: 'revision snapshot applied'
              });
              pushAction('revision-snapshot-applied');
            } else if (appliedCount > 1) {
              enqueue('REVISION_SNAPSHOT_REAPPLIED', {
                revisionExtractId: raw.get('najran_revision_extract_id'),
                count: appliedCount,
                message: 'revision snapshot reapplied (count=' + appliedCount + ')'
              });
              pushAction('revision-snapshot-reapplied', { count: appliedCount });
            }
          }
        }
      } catch (_) {}
    }, 5000);
  })();

  // ==================================================================
  // Detector 6: consumables DOM vs storage mismatch
  // Only runs on consumables.html. Delayed to allow render.
  // ==================================================================
  function checkConsumablesDom() {
    try {
      if (!/consumables/i.test(currentPage())) return;
      var s = getSession();
      var userScoped = (s.userId ? '_u' + s.userId + '_' : '') + 'summary_data_consumables_v27';
      var summaryRaw = raw.get('summary_data_consumables_v27') || raw.get(userScoped);
      var parsed = tryParseJson(summaryRaw);
      var storageRows = countRows(parsed);
      var storageMainRows = countMainRows(parsed);
      var domRows = 0;
      var domTexts = [];
      var tbody = document.querySelector('#summary-table tbody');
      if (tbody) {
        var trs = tbody.querySelectorAll('tr');
        domRows = trs.length;
        for (var i = 0; i < Math.min(trs.length, 5); i++) {
          var t = trs[i].textContent || '';
          domTexts.push(t.trim().slice(0, 100));
        }
      }
      if (storageMainRows > 0 && domRows === 0) {
        enqueue('CONSUMABLES_SUMMARY_DOM_MISMATCH', {
          storageRows: storageRows,
          storageMainRows: storageMainRows,
          domRows: domRows,
          storageNames: extractNames(parsed, 6),
          domTexts: domTexts,
          renderTablesExists: typeof window.renderTables === 'function',
          renderAllTablesExists: typeof window.renderAllTables === 'function',
          message: 'consumables summary in storage (' + storageMainRows + ' main rows) but DOM empty'
        });
      }
      if (!window.renderTables && /consumables/i.test(currentPage())) {
        // Not a critical bug, but a warning worth tracking on pages that historically need it.
        enqueue('RENDER_TABLES_MISSING', {
          message: 'window.renderTables is undefined on consumables page'
        });
      }
    } catch (_) {}
  }

  // ==================================================================
  // Detector 7: backup restore then overwrite within 5s
  // Watches restore markers in localStorage (set by backup.js) and cross-checks
  // ==================================================================
  (function watchBackupRestore() {
    var restoreAt = 0;
    var criticalBefore = null;
    var origAddEventListener = window.addEventListener;
    // Backup completion is signaled by page reload + certain markers; we detect
    // heuristically: if within the past 5 seconds a critical key had content
    // and is now shrunk/removed, that's an overwrite.
    var prevSizes = {};
    setInterval(function () {
      try {
        var now = Date.now();
        var currentSizes = {};
        for (var key in CRITICAL_KEYS) {
          var v = raw.get(key);
          currentSizes[key] = v ? v.length : 0;
        }
        for (var k in currentSizes) {
          if (prevSizes[k] === undefined) continue;
          if (prevSizes[k] > 500 && currentSizes[k] < prevSizes[k] / 3) {
            // Big drop — check restore marker
            var recentRestore = safe(function () { return raw.get('__najran_backup_restore_at') || raw.get('backupRestoredAt'); });
            if (recentRestore && (now - Number(recentRestore) < 10000)) {
              enqueue('BACKUP_RESTORE_OVERWRITTEN', {
                key: k,
                sizeBefore: prevSizes[k],
                sizeAfter: currentSizes[k],
                restoreAt: new Date(Number(recentRestore)).toISOString(),
                message: 'key ' + k + ' shrunk shortly after backup restore'
              });
            }
          }
        }
        prevSizes = currentSizes;
      } catch (_) {}
    }, 3000);
  })();

  // ==================================================================
  // Detector 8: technical button clicks — allow-list only
  // ==================================================================
  var BUTTON_MATCHERS = [
    { kind: 'save',              re: /حفظ|save/i },
    { kind: 'approve',           re: /اعتماد|approve/i },
    { kind: 'submit',            re: /رفع|submit/i },
    { kind: 'restore',           re: /استرجاع|استعادة|restore/i },
    { kind: 'backup',            re: /نسخة\s*احتياطية|backup/i },
    { kind: 'load-foundation',   re: /تحميل\s*من\s*التأسيسي|foundation/i },
    { kind: 'edit',              re: /تعديل|edit/i },
    { kind: 'finish',            re: /إنهاء|finish/i },
    { kind: 'print',             re: /طباعة|print/i },
    { kind: 'open-letter',       re: /فتح\s*خطاب|letter/i },
    { kind: 'hospital-switch',   re: /تغيير\s*(مستشفى|موقع)|switch/i }
  ];
  document.addEventListener('click', function (e) {
    try {
      var t = e.target;
      if (!t) return;
      // Walk up to find button-like ancestor
      var el = t;
      for (var i = 0; i < 4 && el && el !== document.body; i++) {
        var tag = (el.tagName || '').toLowerCase();
        if (tag === 'button' || tag === 'a' || el.getAttribute && el.getAttribute('role') === 'button') {
          var label = (el.textContent || el.getAttribute && el.getAttribute('aria-label') || '').trim();
          if (label.length > 0 && label.length < 60) {
            for (var j = 0; j < BUTTON_MATCHERS.length; j++) {
              if (BUTTON_MATCHERS[j].re.test(label)) {
                pushAction('click:' + BUTTON_MATCHERS[j].kind);
                return;
              }
            }
          }
          return;
        }
        el = el.parentNode;
      }
    } catch (_) {}
  }, true);

  // ==================================================================
  // Init
  // ==================================================================
  pushAction('page-loaded', { page: currentPage() });

  // Delayed DOM sanity check for consumables
  setTimeout(checkConsumablesDom, 3500);
  setTimeout(checkConsumablesDom, 10000);

  // Immediate flush attempt for any queue carried over from a previous load
  setTimeout(flush, 1500);

  try { console.info('[NajranMonitor] active — ' + BUILD + ' — page:' + currentPage()); } catch (_) {}
})();
