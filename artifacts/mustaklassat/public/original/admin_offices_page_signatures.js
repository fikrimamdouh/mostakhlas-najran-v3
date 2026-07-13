// ===================================================================
// Admin Offices Page Signatures — controls separated V9
// Scope: admin_offices_attendance.html only
//
// - زر مستقل لتوقيع الشهادة الإجمالية.
// - يربط توقيع الشهادة الإجمالية بنافذة الشهادة.
// - يجبر تحميل محرك التوقيع الجديد إذا كان المتصفح ماسك نسخة قديمة.
// - زر التوقيع يفتح/يقفل نفس النافذة بدل طبقات متراكبة.
// - لا يدمج الشهادة الإجمالية مع توحيد تواقيع المكاتب.
// - تنظيف التواقيع السفلية مؤجل ومحدود لمنع التجميد.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_PAGE_SIGNATURES_CONTROLS_SEPARATED_V9__) return;
  window.__ADMIN_OFFICES_PAGE_SIGNATURES_CONTROLS_SEPARATED_V9__ = true;

  var GRAND_KEY = 'admin_offices_grand_certificate';
  var SIG_PREFIX = 'sb_sigs_';
  var PREF_PREFIX = 'sb_prefs_';
  var GRAND_BTN_ID = 'admin-offices-grand-certificate-signature-btn';
  var cleanupScheduled = false;
  var cleanupRunning = false;
  var cleanupObserver = null;
  var freshSignatureBlockPromise = null;

  function readJson(key, fallback) { try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; } }
  function writeJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} }
  function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function normalizePrefs(prefs) { prefs = prefs && typeof prefs === 'object' ? prefs : {}; return { includeSigs: prefs.includeSigs !== false, align: ['right', 'center', 'left'].indexOf(prefs.align) > -1 ? prefs.align : 'center', size: ['small', 'normal', 'large'].indexOf(prefs.size) > -1 ? prefs.size : 'normal', width: Math.max(120, Math.min(320, Number(prefs.width) || 180)) }; }
  function getNames() { try { if (typeof window.getCenterNames === 'function') return window.getCenterNames() || {}; } catch (_) {} return readJson('adminOfficeNames_v1', {}); }
  function cleanCenterKey(value) { return String(value || '').replace(/^attendance-signatures-/, '').replace(/^perf-signatures-/, '').replace(/^performance-signatures-/, '').replace(/^ach-signatures-/, '').replace(/^achievement-signatures-/, '').replace(/^table-div-/, '').replace(/^table-/, '').trim(); }
  function currentCenterKey() { var active = document.querySelector('.tab-link.active[data-center-key]'); if (active && active.dataset.centerKey) return active.dataset.centerKey; try { if (window.activeCenterKeyForManagement) return window.activeCenterKeyForManagement; } catch (_) {} var title = (document.getElementById('center-main-title') || {}).textContent || ''; var names = getNames(); var keys = Object.keys(names || {}); for (var i = 0; i < keys.length; i++) if (names[keys[i]] && title.indexOf(names[keys[i]]) > -1) return keys[i]; if (title.indexOf('الورش') > -1) return 'admin_staff'; return keys[0] || 'general'; }
  function normalizeType(type) { var t = String(type || 'attendance'); if (t.indexOf('performance') > -1) return 'performance'; if (t.indexOf('achievement') > -1) return 'achievement'; return 'attendance'; }
  function signatureKey(type, centerKey) { return 'admin_offices_' + (cleanCenterKey(centerKey) || currentCenterKey() || 'general') + '_' + normalizeType(type); }

  function ensureGrandDefaults() { var key = SIG_PREFIX + GRAND_KEY; var existing = readJson(key, null); if (!Array.isArray(existing)) writeJson(key, [{ title: 'إعداد', name: '' }, { title: 'مراجعة', name: '' }, { title: 'اعتماد', name: '' }]); }
  function buildGrandSignaturesHtml() { ensureGrandDefaults(); var prefs = normalizePrefs(readJson(PREF_PREFIX + GRAND_KEY, {})); if (prefs.includeSigs === false) return ''; var rows = readJson(SIG_PREFIX + GRAND_KEY, []); if (!Array.isArray(rows) || !rows.length) rows = [{ title: 'إعداد', name: '' }, { title: 'مراجعة', name: '' }, { title: 'اعتماد', name: '' }]; return '<section class="sign grand-signatures grand-align-' + prefs.align + ' grand-size-' + prefs.size + '" data-source="admin_offices_page_signatures_v9" style="--grand-item-width:' + prefs.width + 'px">' + rows.map(function (s) { return '<div class="grand-signature-item"><div class="g-title">' + esc(s.title || '') + '</div><div class="g-name">' + esc(s.name || '') + '</div></div>'; }).join('') + '</section>'; }
  function injectGrandStyle(doc) { if (!doc || doc.getElementById('admin-offices-grand-signatures-v9-style')) return; var style = doc.createElement('style'); style.id = 'admin-offices-grand-signatures-v9-style'; style.textContent = '.grand-signatures{display:flex;flex-wrap:wrap;direction:ltr;gap:18px;margin-top:28px;width:100%;align-items:flex-start}.grand-signatures.grand-align-right{justify-content:flex-end}.grand-signatures.grand-align-center{justify-content:center}.grand-signatures.grand-align-left{justify-content:flex-start}.grand-signatures .grand-signature-item{direction:rtl;text-align:center;width:var(--grand-item-width,180px);page-break-inside:avoid;break-inside:avoid}.grand-signatures .g-title{font-weight:900;color:#111827;font-size:15px;line-height:1.45;margin-bottom:4px}.grand-signatures .g-name{font-weight:800;color:#334155;font-size:13px;line-height:1.45;min-height:16px}.grand-signatures .line{display:none!important}.grand-size-small{gap:10px}.grand-size-small .g-title{font-size:13px}.grand-size-small .g-name{font-size:11.5px}.grand-size-large{gap:22px}.grand-size-large .g-title{font-size:18px}.grand-size-large .g-name{font-size:15px}@media print{.grand-signatures .g-title{color:#000}.grand-signatures .g-name{color:#000}}'; try { doc.head.appendChild(style); } catch (_) {} }
  function applyGrandSignaturesToWindow(win) { try { if (!win || win.closed || !win.document) return; var doc = win.document; var cert = doc.querySelector && doc.querySelector('.cert'); if (!cert) return; var titleText = (doc.title || '') + ' ' + (cert.textContent || '').slice(0, 300); if (titleText.indexOf('الشهادة الإجمالية') === -1) return; cert.querySelectorAll('.grand-signatures, .cert > .sign').forEach(function (el) { try { el.remove(); } catch (_) {} }); var html = buildGrandSignaturesHtml(); if (!html) return; var holder = doc.createElement('div'); holder.innerHTML = html; cert.appendChild(holder.firstElementChild); injectGrandStyle(doc); } catch (_) {} }
  function patchWindowOpenForGrandSignatures() { if (window.open.__adminOfficesGrandSignatureInjectV9) return; var originalOpen = window.open; window.open = function patchedWindowOpen() { var win = originalOpen.apply(window, arguments); setTimeout(function () { applyGrandSignaturesToWindow(win); }, 120); setTimeout(function () { applyGrandSignaturesToWindow(win); }, 450); setTimeout(function () { applyGrandSignaturesToWindow(win); }, 1000); return win; }; window.open.__adminOfficesGrandSignatureInjectV9 = true; }

  function forceFreshSignatureBlockIfNeeded() {
    var ok = !!(window.SignatureBlock && typeof window.SignatureBlock.getPrefs === 'function' && typeof window.SignatureBlock.buildPrintHTML === 'function');
    if (ok) return Promise.resolve();
    if (freshSignatureBlockPromise) return freshSignatureBlockPromise;
    freshSignatureBlockPromise = new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = '/original/signature-block.js?v=20260703_signature_layout_v2_' + Date.now();
      s.onload = function () { console.info('[Admin Offices Signatures] fresh signature-block loaded'); resolve(); };
      s.onerror = function () { console.warn('[Admin Offices Signatures] failed to load fresh signature-block'); resolve(); };
      document.head.appendChild(s);
    });
    return freshSignatureBlockPromise;
  }

  function openOrCloseSignatureDialog(pageKey) {
    var overlay = document.getElementById('sb-overlay');
    if (overlay && overlay.classList.contains('open')) { overlay.classList.remove('open'); document.body.style.overflow = ''; return; }
    forceFreshSignatureBlockIfNeeded().then(function () {
      if (!window.SignatureBlock || typeof window.SignatureBlock.open !== 'function') return void window.NajranDialogs.alert('نظام التواقيع لم يكتمل تحميله بعد. أعد تحميل الصفحة.');
      window.SignatureBlock.open(pageKey);
    });
  }

  function removeOfficePageSignatureControlsNow() { if (cleanupRunning) return; cleanupRunning = true; try { document.querySelectorAll('.admin-page-signature-bar, .admin-page-signature-block, #sb-container-admin_offices').forEach(function (el) { try { el.remove(); } catch (_) {} }); document.querySelectorAll('[id^="attendance-signatures-"], [id^="perf-signatures-"], [id^="ach-signatures-"]').forEach(function (el) { el.dataset.adminOfficesNoInlineSigs = '1'; if (el.innerHTML) el.innerHTML = ''; }); var details = document.getElementById('center-details-view'); if (details) details.querySelectorAll('button').forEach(function (btn) { var text = String(btn.textContent || '').replace(/\s+/g, ' ').trim(); if (/تعديل التواقيع|تعديل التوقيع|إضافة توقيع|نسخ للمكاتب/.test(text)) { try { btn.remove(); } catch (_) {} } }); } finally { cleanupRunning = false; } }
  function scheduleOfficeSignatureCleanup() { if (cleanupScheduled) return; cleanupScheduled = true; var run = function () { cleanupScheduled = false; removeOfficePageSignatureControlsNow(); }; if (window.requestAnimationFrame) window.requestAnimationFrame(run); else setTimeout(run, 60); }
  function renderSeparatedSignatures() { scheduleOfficeSignatureCleanup(); }

  function openGrandSignatureDialog() { ensureGrandDefaults(); openOrCloseSignatureDialog(GRAND_KEY); }
  function ensureGrandButton(attempt) { var bar = document.getElementById('main-action-buttons'); if (!bar) { if ((attempt || 0) < 20) setTimeout(function () { ensureGrandButton((attempt || 0) + 1); }, 500); return; } var btn = document.getElementById(GRAND_BTN_ID); if (!btn) { btn = document.createElement('button'); btn.type = 'button'; btn.id = GRAND_BTN_ID; btn.className = 'ab ab-titles'; var certBtn = Array.prototype.slice.call(bar.querySelectorAll('button')).find(function (b) { return String(b.textContent || '').indexOf('الشهادة الإجمالية') > -1 && b.id !== GRAND_BTN_ID; }); if (certBtn && certBtn.nextSibling) bar.insertBefore(btn, certBtn.nextSibling); else bar.appendChild(btn); } btn.innerHTML = '<i class="fas fa-signature"></i> توقيع الشهادة الإجمالية'; btn.onclick = openGrandSignatureDialog; }

  window.displaySignatures = function (type, centerKey) { renderSeparatedSignatures(type, centerKey); };
  window.openSignatureDialog = function (type, centerKey) { openOrCloseSignatureDialog(signatureKey(type, centerKey || currentCenterKey())); };
  window.getSignatures = function (type, centerKey) { try { return window.SignatureBlock.getSigs(signatureKey(type, centerKey || currentCenterKey())) || []; } catch (_) { return []; } };
  window.AdminOfficesPageSignatures = { signatureKey: signatureKey, currentCenterKey: currentCenterKey, refresh: scheduleOfficeSignatureCleanup, openGrand: openGrandSignatureDialog, buildGrandSignaturesHtml: buildGrandSignaturesHtml, applyGrandSignaturesToWindow: applyGrandSignaturesToWindow, forceFreshSignatureBlock: forceFreshSignatureBlockIfNeeded };

  function boot(attempt) { ensureGrandDefaults(); patchWindowOpenForGrandSignatures(); ensureGrandButton(attempt || 0); scheduleOfficeSignatureCleanup(); if ((attempt || 0) < 8) setTimeout(function () { boot((attempt || 0) + 1); }, 500); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { boot(0); }); else boot(0);
  try { var root = document.getElementById('center-details-view') || document.body || document.documentElement; cleanupObserver = new MutationObserver(scheduleOfficeSignatureCleanup); cleanupObserver.observe(root, { childList: true, subtree: true }); } catch (_) {}
  console.info('[Admin Offices Signatures] v9: fresh signature editor forced + toggle dialog');
})();