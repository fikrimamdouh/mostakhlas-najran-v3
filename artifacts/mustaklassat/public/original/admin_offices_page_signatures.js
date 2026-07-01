// ===================================================================
// Admin Offices Page Signatures
// Scope: admin_offices_attendance.html only
// فصل التواقيع لكل مكتب + لكل صفحة: الحضور / الأداء / الإنجاز + الشهادة الإجمالية
// + نسخ تواقيع مكتب مصدر إلى مكاتب مختارة لنفس نوع الصفحة.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;

  const PREFIX = 'sb_sigs_';
  const PREFS = 'sb_prefs_';
  const GRAND_KEY = 'admin_offices_grand_certificate';
  const COPY_DIALOG_ID = 'admin-office-signature-copy-dialog';

  function readJson(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }
  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; }
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
    const copyBtn = type === 'grand_certificate'
      ? ''
      : `<button type="button" class="btn-action btn-signatures" onclick="AdminOfficesPageSignatures.openCopy('${type}','${esc(c)}')"><i class="fas fa-copy"></i> نسخ للمكاتب</button>`;
    return `<div class="admin-page-signature-bar no-print" style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin:14px 0 8px;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;"><strong style="color:#1e3c72;">${esc(label)}</strong><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${copyBtn}<button type="button" class="btn-action btn-signatures" onclick="SignatureBlock.open('${key}')"><i class="fas fa-signature"></i> تعديل التواقيع</button></div></div>`;
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
        // لا تعيد تهيئة تواقيع صفحات المكاتب أثناء فتح شاشة خطابات الرفع أو تعديل تواقيع الخطابات.
    // هذا يمنع SignatureBlock.init / pullCloud المتكرر من تجميد حقول إعدادات الخطابات.
    if (
      document.getElementById('raise-letters-overlay') &&
      (
        document.getElementById('rl-professional-settings-panel') ||
        document.getElementById('rl-signature-settings-shell')
      )
    ) {
      return;
    }
    if (!ensureSignatureBlockReady()) return;
    const t = normalizeType(type);
    const c = cleanCenterKey(centerKey) || currentCenterKey();
    const key = signatureKey(t, c);
    const target = t === 'grand_certificate' ? null : containerFor(t, c);
    if (!target) return;
    target.innerHTML = `<div class="admin-page-signature-block" data-admin-signature-key="${key}">${buildEditBar(t, c, key)}<div id="sb-container-${key}" data-sb-page="${key}"></div></div>`;
    try { window.SignatureBlock.init(key, { showStamp: true }); } catch (_) {}
    try { window.SignatureBlock.rerender ? window.SignatureBlock.rerender(key) : null; } catch (_) {}
  }

  function getToken() {
    try {
      const s = JSON.parse(localStorage.getItem('najran_session') || '{}');
      if (!s.clerkToken) return null;
      return (Date.now() - (s.timestamp || 0)) < 55000 ? s.clerkToken : null;
    } catch (_) { return null; }
  }
  async function pushSignatureCopies(payload) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    try {
      const r = await fetch('/api/hospital-storage', {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify({ data: payload })
      });
      return r.ok;
    } catch (_) { return false; }
  }
  function ensureCopyCss() {
    if (document.getElementById('admin-office-signature-copy-css')) return;
    const st = document.createElement('style');
    st.id = 'admin-office-signature-copy-css';
    st.textContent = `#${COPY_DIALOG_ID}{position:fixed;inset:0;z-index:2147483500;background:rgba(15,23,42,.58);display:flex;align-items:center;justify-content:center;direction:rtl;font-family:Tajawal,Arial,sans-serif}#${COPY_DIALOG_ID} .sig-copy-box{width:min(780px,94vw);max-height:88vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.25);padding:18px}#${COPY_DIALOG_ID} h3{margin:0 0 6px;color:#003087;font-size:20px;font-weight:950}#${COPY_DIALOG_ID} p{margin:0 0 12px;color:#64748b;font-weight:800;line-height:1.8}.sig-copy-row{display:grid;grid-template-columns:1fr;gap:10px;margin:12px 0}.sig-copy-field{display:block;background:#f8fafc;border:1px solid #dbe4f0;border-radius:12px;padding:10px}.sig-copy-field span{display:block;font-size:12px;font-weight:950;color:#334155;margin-bottom:6px}.sig-copy-field select{width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:9px;font-family:inherit;font-weight:900}.sig-copy-targets{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;max-height:290px;overflow:auto;border:1px solid #e2e8f0;border-radius:12px;padding:10px}.sig-copy-target{display:flex;gap:8px;align-items:center;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px;font-weight:850}.sig-copy-actions{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:14px}.sig-copy-actions button{border:0;border-radius:10px;padding:10px 15px;font-family:inherit;font-weight:950;cursor:pointer}.sig-copy-primary{background:#166534;color:white}.sig-copy-light{background:#e2e8f0;color:#0f172a}.sig-copy-danger{background:#fee2e2;color:#991b1b}.sig-copy-note{background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:9px;color:#92400e;font-weight:850;line-height:1.8}`;
    document.head.appendChild(st);
  }
  function closeCopyDialog() {
    const d = document.getElementById(COPY_DIALOG_ID);
    if (d) d.remove();
  }
  function officeOptions(selected) {
    const names = getNames();
    return Object.keys(names).map(k => `<option value="${esc(k)}" ${k === selected ? 'selected' : ''}>${esc(names[k] || k)}</option>`).join('');
  }
  function targetChecks(sourceKey) {
    const names = getNames();
    return Object.keys(names).map(k => `<label class="sig-copy-target"><input type="checkbox" class="sig-copy-target-check" value="${esc(k)}" ${k === sourceKey ? '' : 'checked'}><span>${esc(names[k] || k)}</span></label>`).join('');
  }
  function openCopyDialog(type, centerKey) {
    if (!ensureSignatureBlockReady()) return alert('نظام التواقيع لم يكتمل تحميله بعد. أعد تحميل الصفحة.');
    const t = normalizeType(type);
    if (t === 'grand_certificate') return alert('الشهادة الإجمالية لها توقيع واحد مستقل، ولا تحتاج نسخ بين المكاتب.');
    ensureCopyCss();
    closeCopyDialog();
    const source = cleanCenterKey(centerKey) || currentCenterKey();
    const names = getNames();
    const dialog = document.createElement('div');
    dialog.id = COPY_DIALOG_ID;
    dialog.innerHTML = `<div class="sig-copy-box"><h3>نسخ تواقيع ${esc(typeArabic(t))} إلى مكاتب مختارة</h3><p>سيتم نسخ تواقيع نوع الصفحة الحالي فقط. لن يتم خلط تواقيع الحضور مع الأداء أو الإنجاز.</p><div class="sig-copy-note">المصدر الحالي: <b>${esc(names[source] || source)}</b>. سيتم نسخ التواقيع وخيارات الطباعة الخاصة بها إلى المكاتب المختارة.</div><div class="sig-copy-row"><label class="sig-copy-field"><span>مكتب المصدر</span><select id="sig-copy-source">${officeOptions(source)}</select></label></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0"><button type="button" class="sig-copy-light" id="sig-copy-all">تحديد الكل</button><button type="button" class="sig-copy-light" id="sig-copy-none">إلغاء الكل</button></div><div id="sig-copy-targets" class="sig-copy-targets">${targetChecks(source)}</div><div class="sig-copy-actions"><button type="button" class="sig-copy-primary" id="sig-copy-apply">نسخ التواقيع للمكاتب المختارة</button><button type="button" class="sig-copy-danger" id="sig-copy-close">إغلاق</button></div></div>`;
    document.body.appendChild(dialog);
    document.getElementById('sig-copy-close').onclick = closeCopyDialog;
    document.getElementById('sig-copy-all').onclick = () => document.querySelectorAll('.sig-copy-target-check').forEach(cb => { cb.checked = true; });
    document.getElementById('sig-copy-none').onclick = () => document.querySelectorAll('.sig-copy-target-check').forEach(cb => { cb.checked = false; });
    document.getElementById('sig-copy-source').onchange = function () {
      const src = this.value;
      const holder = document.getElementById('sig-copy-targets');
      if (holder) holder.innerHTML = targetChecks(src);
    };
    document.getElementById('sig-copy-apply').onclick = function () { applyCopy(t); };
  }
  async function applyCopy(type) {
    const src = cleanCenterKey(document.getElementById('sig-copy-source')?.value || currentCenterKey());
    const targets = Array.from(document.querySelectorAll('.sig-copy-target-check:checked')).map(cb => cleanCenterKey(cb.value)).filter(Boolean);
    if (!src || !targets.length) return alert('اختر مكتب مصدر ومكتب هدف واحد على الأقل.');
    const sourceKey = signatureKey(type, src);
    let sigs = [];
    try { sigs = window.SignatureBlock.getSigs(sourceKey) || []; } catch (_) {}
    if (!sigs.length) sigs = readJson(PREFIX + sourceKey, []);
    const prefs = readJson(PREFS + sourceKey, readJson(PREFS + sourceKey, {}));
    if (!Array.isArray(sigs) || !sigs.length) {
      if (!confirm('مكتب المصدر لا يحتوي على توقيعات محفوظة. الاستمرار سيجعل المكاتب المختارة بدون توقيعات.')) return;
      sigs = [];
    }
    const payload = {};
    targets.forEach(target => {
      const key = signatureKey(type, target);
      writeJson(PREFIX + key, sigs);
      writeJson(PREFS + key, prefs || {});
      payload[PREFIX + key] = JSON.stringify(sigs);
      payload[PREFS + key] = JSON.stringify(prefs || {});
      try { window.SignatureBlock.init(key, { showStamp: true }); } catch (_) {}
      try { renderSeparatedSignatures(type, target); } catch (_) {}
    });
    const ok = await pushSignatureCopies(payload);
    alert(ok ? 'تم نسخ التواقيع للمكاتب المختارة ومزامنتها.' : 'تم نسخ التواقيع محلياً. المزامنة السحابية لم تكتمل الآن.');
    closeCopyDialog();
    rerenderCurrent();
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

  // لا تنشئ توقيع افتراضي للشهادة الإجمالية إذا المستخدم حذف التواقيع
  if (!Array.isArray(sigs) || !sigs.length) return '';

  const items = sigs
    .filter(s => String(s?.title || '').trim() || String(s?.name || '').trim())
    .map(s => `<div><div class="g-title">${esc(s.title)}</div><div class="line"></div><div class="g-name">${esc(s.name || '')}</div></div>`)
    .join('');

  if (!items) return '';

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
         doc.querySelectorAll('.cert > .sign, .cert > .grand-signatures, .cert .admin-grand-cert-print').forEach(el => el.remove());
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

  window.AdminOfficesPageSignatures = {
    openCopy: openCopyDialog,
    closeCopy: closeCopyDialog,
    signatureKey,
    refresh: rerenderCurrent
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot(0));
  else boot(0);
  console.info('[Admin Offices Signatures] page-level independent signatures installed + copy selected offices');
})();
