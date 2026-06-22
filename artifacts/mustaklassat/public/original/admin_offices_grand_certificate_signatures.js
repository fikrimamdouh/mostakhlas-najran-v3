// ===================================================================
// Admin Offices Grand Certificate Signatures Only
// Scope: admin_offices_attendance.html only
// يعالج تواقيع الشهادة الإجمالية فقط بدون فصل تواقيع الحضور/الأداء/الإنجاز
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;

  const GRAND_KEY = 'admin_offices_grand_certificate';
  const SIG_PREFIX = 'sb_sigs_';
  const PREF_PREFIX = 'sb_prefs_';

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function esc(v) {
    return String(v || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function ensureDefaults() {
    const key = SIG_PREFIX + GRAND_KEY;
    const existing = readJson(key, null);
    if (!Array.isArray(existing)) {
      localStorage.setItem(key, JSON.stringify([
        { title: 'إعداد', name: '' },
        { title: 'مراجعة', name: '' },
        { title: 'اعتماد', name: '' }
      ]));
    }
  }

  function openGrandSignatures() {
    ensureDefaults();
    if (window.SignatureBlock && typeof window.SignatureBlock.open === 'function') {
      window.SignatureBlock.open(GRAND_KEY);
      return;
    }
    alert('نظام التواقيع لم يكتمل تحميله بعد. أعد تحميل الصفحة.');
  }

  function buildGrandSignaturesHTML() {
    ensureDefaults();
    const prefs = readJson(PREF_PREFIX + GRAND_KEY, {});
    if (prefs.includeSigs === false) return '';

    const sigs = readJson(SIG_PREFIX + GRAND_KEY, []);
    const rows = Array.isArray(sigs) && sigs.length ? sigs : [
      { title: 'إعداد', name: '' },
      { title: 'مراجعة', name: '' },
      { title: 'اعتماد', name: '' }
    ];

    const body = rows.map(s => `
      <div>
        <div class="g-title">${esc(s.title)}</div>
        <div class="line"></div>
        <div class="g-name">${esc(s.name || '')}</div>
      </div>
    `).join('');

    return `<section class="sign grand-signatures">${body}</section>`;
  }

  function injectGrandSignatureStyle(doc) {
    if (!doc || doc.getElementById('grand-signatures-style')) return;
    const style = doc.createElement('style');
    style.id = 'grand-signatures-style';
    style.textContent = `
      .grand-signatures{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:24px;text-align:center;margin-top:28px}
      .grand-signatures>div{font-weight:900}
      .grand-signatures .line{height:48px;border-bottom:1px solid #111;margin:8px 25px 0}
      .grand-signatures .g-title{font-weight:900;color:#111827}
      .grand-signatures .g-name{font-size:12px;color:#475569;min-height:16px}
      @media print{.grand-signatures .g-name{color:#000}.grand-signatures .g-title{color:#000}}
    `;
    doc.head.appendChild(style);
  }

  function replaceGrandWindowSignatures(win) {
    try {
      if (!win || win.closed || !win.document) return;
      const doc = win.document;
      const title = doc.title || '';
      const cert = doc.querySelector && doc.querySelector('.cert');
      if (!cert || !title.includes('الشهادة الإجمالية')) return;

      const oldSign = cert.querySelector('.sign');
      if (oldSign) oldSign.remove();

      const html = buildGrandSignaturesHTML();
      if (html) {
        const holder = doc.createElement('div');
        holder.innerHTML = html;
        cert.appendChild(holder.firstElementChild);
        injectGrandSignatureStyle(doc);
      }
    } catch (_) {}
  }

  function patchWindowOpen() {
    if (window.open.__adminOfficesGrandCertificateSignaturesOnly) return;
    const originalOpen = window.open;
    window.open = function patchedWindowOpen() {
      const win = originalOpen.apply(window, arguments);
      setTimeout(() => replaceGrandWindowSignatures(win), 250);
      setTimeout(() => replaceGrandWindowSignatures(win), 700);
      setTimeout(() => replaceGrandWindowSignatures(win), 1500);
      return win;
    };
    window.open.__adminOfficesGrandCertificateSignaturesOnly = true;
  }

  function addEditButton() {
    const bar = document.getElementById('main-action-buttons');
    if (!bar || document.getElementById('grand-certificate-signatures-btn')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'grand-certificate-signatures-btn';
    btn.className = 'ab ab-titles';
    btn.innerHTML = '<i class="fas fa-signature"></i> تواقيع الشهادة الإجمالية';
    btn.onclick = openGrandSignatures;

    const grandBtn = Array.from(bar.querySelectorAll('button')).find(b => (b.textContent || '').includes('الشهادة الإجمالية'));
    if (grandBtn && grandBtn.nextSibling) bar.insertBefore(btn, grandBtn.nextSibling);
    else bar.appendChild(btn);
  }

  function boot() {
    ensureDefaults();
    patchWindowOpen();
    addEditButton();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 700);
  setTimeout(boot, 1800);
  setTimeout(boot, 3500);

  window.openAdminOfficesGrandCertificateSignatures = openGrandSignatures;
  console.info('[Admin Offices Grand Certificate Signatures] installed');
})();
