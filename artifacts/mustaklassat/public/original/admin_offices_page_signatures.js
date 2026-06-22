// ===================================================================
// Admin Offices Page Signatures
// Scope: admin_offices_attendance.html only
// فصل التواقيع لكل مكتب + لكل صفحة: الحضور / الأداء / الإنجاز + الشهادة الإجمالية
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;

  const PREFIX = 'sb_sigs_';
  const PREFS = 'sb_prefs_';
  const GRAND_KEY = 'admin_offices_grand_certificate';

  function readJson(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }
  function esc(v) {
    return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function getNames() {
    try { if (typeof getCenterNames === 'function') return getCenterNames() || {}; } catch (_) {}
    return readJson('adminOfficeNames_v1', {});
  }
  function cleanCenterKey(v) {
    return String(v || '')
      .replace(/^attendance-signatures-/, '')
      .replace(/^perf-signatures-/, '')
      .replace(/^performance-signatures-/, '')
      .replace(/^ach-signatures-/, '')
      .replace(/^achievement-signatures-/, '')
      .replace(/^table-div-/, '')
      .replace(/^table-/, '')
      .trim();
  }
  function currentCenterKey() {
    const active = document.querySelector('.tab-link.active[data-center-key]');
    if (active && active.dataset.centerKey) return active.dataset.centerKey;
    try { if (window.activeCenterKeyForManagement) return window.activeCenterKeyForManagement; } catch (_) {}
    const title = document.getElementById('center-main-title')?.textContent || '';
    const names = getNames();
    const found = Object.entries(names).find(([, name]) => name && title.includes(name));
    if (found) return found[0];
    if (title.includes('الورش')) return 'admin_staff';
    const visibleTable = Array.from(document.querySelectorAll('[id^="table-div-"]')).find(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    if (visibleTable) return visibleTable.id.replace('table-div-', '');
    return 'general';
  }
  function normalizeType(type) {
    const t = String(type || 'attendance');
    if (t.includes('performance')) return 'performance';
    if (t.includes('achievement')) return 'achievement';
    if (t.includes('grand')) return 'grand_certificate';
    return 'attendance';
  }
  function typeArabic(type) {
    return type === 'performance' ? 'تقييم الأداء' : type === 'achievement' ? 'شهادة الإنجاز' : type === 'grand_certificate' ? 'الشهادة الإجمالية' : 'الحضور والانصراف';
  }
  function signatureKey(type, centerKey) {
    const t = normalizeType(type);
    if (t === 'grand_certificate') return GRAND_KEY;
    const c = cleanCenterKey(centerKey) || currentCenterKey() || 'general';
    return `admin_offices_${c}_${t}`;
  }
  function ensureSignatureBlockReady() {
    return !!(window.SignatureBlock && typeof window.SignatureBlock.open === 'function' && typeof window.SignatureBlock.buildPrintHTML === 'function');
  }
  function buildEditBar(type, centerKey, key) {
    const names = getNames();
    const c = cleanCenterKey(centerKey) || currentCenterKey();
    const label = type === 'grand_certificate'
      ? 'تواقيع الشهادة الإجمالية'
      : `تواقيع ${typeArabic(type)} — ${names[c] || c || 'الموقع'}`;
    return `<div class="admin-page-signature-bar no-print" style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin:14px 0 8px;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;"><strong style="color:#1e3c72;">${esc(label)}</strong><button type="button" class="btn-action btn-signatures" onclick="SignatureBlock.open('${key}')"><i class="fas fa-signature"></i> تعديل التواقيع</button></div>`;
  }
  function containerFor(type, centerKey) {
    const t = normalizeType(type);
    const c = cleanCenterKey(centerKey) || currentCenterKey();
    if (t === 'performance') return document.getElementById(`perf-signatures-${c}`) || document.querySelector('#performance-tab .signatures-display-section') || document.getElementById('performance-tab');
    if (t === 'achievement') return document.getElementById(`ach-signatures-${c}`) || document.querySelector('#achievement-tab .signatures-display-section') || document.getElementById('achievement-tab');
    let el = document.getElementById(`attendance-signatures-${c}`);
    if (!el) {
      const tab = document.getElementById('attendance-tab');
      if (!tab) return null;
      el = document.createElement('div');
      el.id = `attendance-signatures-${c}`;
      el.className = 'signatures-display-section attendance-signatures-display-section';
      tab.appendChild(el);
    }
    return el;
  }
  function renderSeparatedSignatures(type, centerKey) {
    if (!ensureSignatureBlockReady()) return;
    const t = normalizeType(type);
    const c = cleanCenterKey(centerKey) || currentCenterKey();
    const key = signatureKey(t, c);
    const target = t === 'grand_certificate' ? null : containerFor(t, c);
    if (!target) return;
    target.innerHTML = `<div class="admin-page-signature-block" data-admin-signature-key="${key}">${buildEditBar(t, c, key)}<div id="sb-container-${key}" data-sb-page="${key}"></div></div>`;
    try { window.SignatureBlock.rerender(key); } catch (_) {}
  }
  function patchDialogs() {
    window.getAdminOfficePageSignatureKey = signatureKey;
    window.displaySignatures = function patchedDisplaySignatures(type, centerKey) {
      renderSeparatedSignatures(type, centerKey || currentCenterKey());
    };
    window.openSignatureDialog = function patchedOpenSignatureDialog(type, centerKey) {
      if (!ensureSignatureBlockReady()) return alert('نظام التواقيع لم يكتمل تحميله بعد. أعد تحميل الصفحة.');
      const key = signatureKey(type, centerKey || currentCenterKey());
      window.SignatureBlock.open(key);
    };
    window.getSignatures = function patchedGetSignatures(type, centerKey) {
      const key = signatureKey(type, centerKey || currentCenterKey());
      try { return window.SignatureBlock.getSigs(key) || []; } catch (_) { return []; }
    };
  }
  function patchOpenTab() {
    if (typeof window.openTab !== 'function') return false;
    if (window.openTab.__adminOfficePageSignaturesPatched) return true;
    const original = window.openTab;
    window.openTab = function patchedOpenTab(evt, tabName, centerKey) {
      const result = original.apply(this, arguments);
      const c = centerKey || currentCenterKey();
      setTimeout(() => {
        if (tabName === 'attendance-tab') renderSeparatedSignatures('attendance', c);
        if (tabName === 'performance-tab') renderSeparatedSignatures('performance', c);
        if (tabName === 'achievement-tab') renderSeparatedSignatures('achievement', c);
      }, 180);
      return result;
    };
    window.openTab.__adminOfficePageSignaturesPatched = true;
    return true;
  }
  function ensureGrandEditButton() {
    if (!ensureSignatureBlockReady()) return;
    const bar = document.getElementById('main-action-buttons');
    if (!bar || document.getElementById('edit-grand-certificate-signatures-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'edit-grand-certificate-signatures-btn';
    btn.className = 'ab ab-titles';
    btn.innerHTML = '<i class="fas fa-signature"></i> تواقيع الشهادة الإجمالية';
    btn.onclick = function () { window.SignatureBlock.open(GRAND_KEY); };
    const grandBtn = Array.from(bar.querySelectorAll('button')).find(b => (b.textContent || '').includes('الشهادة الإجمالية'));
    if (grandBtn && grandBtn.nextSibling) bar.insertBefore(btn, grandBtn.nextSibling);
    else bar.appendChild(btn);
  }
  function buildGrandSignatureHTML() {
    const prefs = readJson(PREFS + GRAND_KEY, {});
    if (prefs.includeSigs === false) return '';
    const sigs = readJson(PREFIX + GRAND_KEY, []);
    const rows = Array.isArray(sigs) && sigs.length ? sigs : [
      { title: 'إعداد', name: '' },
      { title: 'مراجعة', name: '' },
      { title: 'اعتماد', name: '' }
    ];
    const items = rows.map(s => `<div><div class="g-title">${esc(s.title)}</div><div class="line"></div><div class="g-name">${esc(s.name || '')}</div></div>`).join('');
    return `<section class="sign grand-signatures">${items}</section>`;
  }
  function patchGrandWindowOpen() {
    if (window.open.__adminOfficeGrandSignaturePatched) return;
    const originalOpen = window.open;
    window.open = function patchedWindowOpen() {
      const win = originalOpen.apply(window, arguments);
      setTimeout(() => {
        try {
          if (!win || win.closed || !win.document) return;
          const doc = win.document;
          const title = doc.title || '';
          const cert = doc.querySelector && doc.querySelector('.cert');
          if (!cert || !title.includes('الشهادة الإجمالية')) return;
          const oldSign = doc.querySelector('.sign');
          if (oldSign) oldSign.remove();
          const holder = doc.createElement('div');
          holder.innerHTML = buildGrandSignatureHTML();
          cert.appendChild(holder.firstElementChild);
          const style = doc.createElement('style');
          style.textContent = `.grand-signatures{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:24px;text-align:center;margin-top:28px}.grand-signatures>div{font-weight:900}.grand-signatures .line{height:48px;border-bottom:1px solid #111;margin:8px 25px 0}.grand-signatures .g-title{font-weight:900;color:#111827}.grand-signatures .g-name{font-size:12px;color:#475569;min-height:16px}`;
          doc.head.appendChild(style);
        } catch (_) {}
      }, 650);
      return win;
    };
    window.open.__adminOfficeGrandSignaturePatched = true;
  }
  function rerenderCurrent() {
    const c = currentCenterKey();
    if (document.getElementById('attendance-tab') && getComputedStyle(document.getElementById('attendance-tab')).display !== 'none') renderSeparatedSignatures('attendance', c);
    if (document.getElementById('performance-tab') && getComputedStyle(document.getElementById('performance-tab')).display !== 'none') renderSeparatedSignatures('performance', c);
    if (document.getElementById('achievement-tab') && getComputedStyle(document.getElementById('achievement-tab')).display !== 'none') renderSeparatedSignatures('achievement', c);
  }
  function boot(attempt) {
    patchDialogs();
    patchOpenTab();
    patchGrandWindowOpen();
    ensureGrandEditButton();
    rerenderCurrent();
    if (attempt < 20) setTimeout(() => boot(attempt + 1), 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot(0));
  else boot(0);
  console.info('[Admin Offices Signatures] page-level independent signatures installed');
})();
