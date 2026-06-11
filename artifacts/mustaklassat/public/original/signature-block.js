/**
 * signature-block.js — نظام التواقيع الموحد
 * يستخدم في صفحات المستخلصات.
 * تعديل مهم للحضور: يبني بلوك توقيع مستقل تحت كل جدول حضور، بدل ظهور التوقيع مرة واحدة في آخر صفحة.
 */
(function (global) {
  'use strict';

  const PREFIX = 'sb_sigs_';
  const PREFS_PFX = 'sb_prefs_';
  const SESSION_KEY = 'najran_session';
  const instances = {};
  let activeKey = null;
  let printHooksInstalled = false;

  const STAMP_SVG = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="5,3"/>
    <circle cx="50" cy="50" r="33" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="50" y="56" text-anchor="middle" font-family="Tajawal,Arial,sans-serif" font-size="17" fill="currentColor" font-weight="bold">ختم</text>
  </svg>`;

  const CSS = `
/* ═══════════════════ SignatureBlock ═══════════════════ */
.sb-wrap { margin:20px 0 0; }
.sb-bar { display:flex; gap:10px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
.sb-btn { display:inline-flex; align-items:center; gap:6px; padding:8px 18px; border-radius:10px; border:none; cursor:pointer; font-family:Tajawal,Arial,sans-serif; font-size:13px; font-weight:700; }
.sb-btn-edit { background:linear-gradient(135deg,#4f46e5,#6366f1); color:#fff; }
.sb-btn-edit:hover { opacity:.85; }
.sb-toggle-row { display:flex; align-items:center; gap:14px; flex-wrap:wrap; padding:7px 14px; background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:10px; margin-bottom:12px; }
.sb-toggle-label { display:inline-flex; align-items:center; gap:6px; font-family:Tajawal,Arial,sans-serif; font-size:13px; font-weight:600; color:#334155; cursor:pointer; user-select:none; }
.sb-toggle-label input[type="checkbox"] { width:16px; height:16px; cursor:pointer; accent-color:#4f46e5; }
.sb-toggle-hint { font-size:11px; color:#94a3b8; font-family:Tajawal,Arial,sans-serif; }
.sb-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:14px; }
.sb-item { text-align:center; padding:14px 10px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; }
.sb-item-title { font-weight:700; font-size:13px; color:#1e3c72; margin-bottom:8px; }
.sb-item-line { border-bottom:1px solid #1e3c72; height:36px; margin:0 12px 8px; }
.sb-item-name { font-size:12px; color:#475569; min-height:16px; }
.sb-stamp { display:flex; flex-direction:column; align-items:center; justify-content:center; color:#1e3c72; }
.sb-stamp svg { width:80px; height:80px; }
.sb-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,.52); z-index:99990; align-items:center; justify-content:center; }
.sb-overlay.open { display:flex; }
.sb-dialog { background:#fff; border-radius:18px; padding:28px; width:580px; max-width:95vw; max-height:90vh; overflow-y:auto; direction:rtl; font-family:Tajawal,Arial,sans-serif; box-shadow:0 20px 60px rgba(0,0,0,.28); }
.sb-dialog h3 { font-size:18px; font-weight:800; color:#1e3c72; margin:0 0 6px; text-align:center; }
.sb-dialog-sub { font-size:12px; color:#64748b; text-align:center; margin:0 0 20px; }
.sb-field-row { display:flex; gap:8px; align-items:center; margin-bottom:10px; }
.sb-field-row input[type="text"] { flex:1; padding:9px 12px; border:1.5px solid #e2e8f0; border-radius:10px; font-family:Tajawal,Arial,sans-serif; font-size:13px; direction:rtl; }
.sb-field-row input[type="text"]:focus { outline:none; border-color:#4f46e5; }
.sb-del-btn { width:34px; height:34px; border:none; border-radius:8px; background:#fef2f2; color:#dc2626; cursor:pointer; font-size:15px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.sb-add-btn { width:100%; padding:10px; border:2px dashed #c7d2fe; border-radius:10px; background:#eef2ff; color:#4f46e5; cursor:pointer; font-family:Tajawal,Arial,sans-serif; font-size:13px; font-weight:700; margin:4px 0 16px; }
.sb-print-opts { background:#f0f7ff; border:1.5px solid #bfdbfe; border-radius:12px; padding:14px 16px; margin-bottom:20px; }
.sb-print-opts-title { font-size:12px; font-weight:800; color:#1e40af; margin-bottom:10px; display:flex; align-items:center; gap:6px; }
.sb-print-opt-item { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
.sb-print-opt-item input[type="checkbox"] { width:17px; height:17px; cursor:pointer; accent-color:#2a5298; flex-shrink:0; }
.sb-print-opt-item label { font-family:Tajawal,Arial,sans-serif; font-size:13px; font-weight:600; color:#1e3c72; cursor:pointer; }
.sb-print-opt-item small { font-size:11px; color:#64748b; display:block; margin-top:2px; }
.sb-dialog-footer { display:flex; gap:10px; justify-content:center; }
.sb-save-btn { padding:10px 30px; border:none; border-radius:12px; background:linear-gradient(135deg,#16a34a,#15803d); color:#fff; font-family:inherit; font-size:14px; font-weight:700; cursor:pointer; }
.sb-cancel-btn { padding:10px 30px; border:1.5px solid #e2e8f0; border-radius:12px; background:#fff; color:#64748b; font-family:inherit; font-size:14px; font-weight:600; cursor:pointer; }
.sb-status { font-size:12px; color:#16a34a; text-align:center; margin-top:10px; min-height:18px; }
.sb-empty { text-align:center; color:#94a3b8; font-size:13px; padding:16px; }
.print-signatures.sb-attendance-table-signatures {
  display: none !important;
  visibility: hidden;
  opacity: 0;
  margin: 16px 0 0;
  padding-top: 10px;
  border-top: 1px solid #333;
  page-break-inside: avoid;
  break-inside: avoid;
}.print-signatures.sb-attendance-table-signatures h4 { text-align:center; margin:0 0 10px; font-size:13px; font-weight:800; color:#000; }
@media print {
  .sb-bar,.sb-btn,.sb-toggle-row { display:none !important; }
  #sb-container-attendance { display:none !important; }
  .sb-wrap { margin-top:16px !important; }
  .sb-wrap.sb-no-print-sigs { display:none !important; }
  .sb-no-print-sigs-inner { display:none !important; }
  .sb-stamp.sb-no-print-stamp { display:none !important; }
  .print-signatures.sb-attendance-table-signatures { display:block !important; visibility:visible !important; opacity:1 !important; }
  .department-table { page-break-inside:auto !important; break-inside:auto !important; }
  .sb-grid { display:grid !important; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)) !important; gap:10px !important; }
  .sb-item { border:none !important; background:transparent !important; border-top:1px solid #000 !important; border-radius:0 !important; padding:6px 4px !important; }
  .sb-item-title { font-size:11px !important; color:#000 !important; margin-bottom:4px !important; }
  .sb-item-line { height:28px !important; border-color:#000 !important; margin:0 8px 4px !important; }
  .sb-item-name { font-size:10px !important; color:#000 !important; }
  .sb-stamp { color:#000 !important; }
  .sb-stamp svg { width:60px !important; height:60px !important; }
}
`;

  function esc(v) {
    return String(v || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function getToken() {
    try {
      const s = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
      return s && s.clerkToken ? s.clerkToken : null;
    } catch { return null; }
  }

  async function apiFetch(path, opts = {}) {
    const token = getToken();
    const headers = { 'Content-Type':'application/json', ...(opts.headers || {}) };
    if (token) headers.Authorization = 'Bearer ' + token;
    try {
      const r = await fetch('/api' + path, { ...opts, headers, credentials:'include' });
      return r.ok ? r.json() : null;
    } catch { return null; }
  }

  function loadPrefs(pageKey) {
    try { return JSON.parse(localStorage.getItem(PREFS_PFX + pageKey) || '{}'); } catch { return {}; }
  }

  function savePrefs(pageKey, prefs) {
    localStorage.setItem(PREFS_PFX + pageKey, JSON.stringify(prefs || {}));
    if (instances[pageKey]) instances[pageKey].prefs = prefs || {};
  }

  function injectCSS() {
    if (document.getElementById('sb-styles')) return;
    const el = document.createElement('style');
    el.id = 'sb-styles';
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  function buildDialogDOM() {
    if (document.getElementById('sb-overlay')) return;
    const ov = document.createElement('div');
    ov.id = 'sb-overlay';
    ov.className = 'sb-overlay';
    ov.innerHTML = `
      <div class="sb-dialog" id="sb-dialog">
        <h3>تعديل التواقيع</h3>
        <p class="sb-dialog-sub">أضف أو عدّل أو احذف التواقيع — تتزامن لجميع مستخدمي نفس المستشفى</p>
        <div id="sb-fields"></div>
        <button class="sb-add-btn" id="sb-add-btn">＋ إضافة توقيع جديد</button>
        <div class="sb-print-opts">
          <div class="sb-print-opts-title">🖨️ خيارات الطباعة</div>
          <div class="sb-print-opt-item"><input type="checkbox" id="sb-opt-sigs" checked><label for="sb-opt-sigs">تضمين التواقيع في الطباعة<small>عند الإيقاف لن يظهر قسم التواقيع في نسخة الطباعة</small></label></div>
          <div class="sb-print-opt-item"><input type="checkbox" id="sb-opt-stamp" checked><label for="sb-opt-stamp">تضمين الختم في الطباعة<small>عند الإيقاف لن يظهر الختم الدائري</small></label></div>
        </div>
        <div class="sb-dialog-footer"><button class="sb-save-btn" id="sb-save-btn">💾 حفظ</button><button class="sb-cancel-btn" id="sb-cancel-btn">إلغاء</button></div>
        <div class="sb-status" id="sb-status"></div>
      </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov) closeDialog(); });
    document.getElementById('sb-add-btn').addEventListener('click', () => addRow());
    document.getElementById('sb-save-btn').addEventListener('click', saveDialog);
    document.getElementById('sb-cancel-btn').addEventListener('click', closeDialog);
  }

  function addRow(title, name) {
    const fields = document.getElementById('sb-fields');
    if (!fields) return;
    const row = document.createElement('div');
    row.className = 'sb-field-row';
    row.innerHTML = `<input type="text" class="sb-f-title" placeholder="المسمى الوظيفي" value="${esc(title || '')}"><input type="text" class="sb-f-name" placeholder="الاسم" value="${esc(name || '')}"><button class="sb-del-btn" title="حذف">✕</button>`;
    row.querySelector('.sb-del-btn').addEventListener('click', () => row.remove());
    fields.appendChild(row);
  }

  function openDialog(pageKey) {
    if (!pageKey || !instances[pageKey]) {
      console.warn('SignatureBlock.open: pageKey غير مُهيَّأ —', pageKey);
      return;
    }
    activeKey = pageKey;
    const sigs = Array.isArray(instances[pageKey].sigs) ? instances[pageKey].sigs : [];
    const prefs = instances[pageKey].prefs || {};
    const fields = document.getElementById('sb-fields');
    if (!fields) return;
    fields.innerHTML = '';
    if (!sigs.length) addRow();
    else sigs.forEach(s => addRow(s.title, s.name));
    const st = document.getElementById('sb-status');
    if (st) st.textContent = '';
    const optSigs = document.getElementById('sb-opt-sigs');
    const optStamp = document.getElementById('sb-opt-stamp');
    if (optSigs) optSigs.checked = prefs.includeSigs !== false;
    if (optStamp) optStamp.checked = prefs.includeStamp !== false;
    document.getElementById('sb-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeDialog() {
    const ov = document.getElementById('sb-overlay');
    if (ov) ov.classList.remove('open');
    document.body.style.overflow = '';
    activeKey = null;
  }

  async function saveDialog() {
    const key = activeKey;
    if (!key || !instances[key]) return;
    const rows = document.querySelectorAll('#sb-fields .sb-field-row');
    const sigs = [];
    rows.forEach(row => {
      const title = row.querySelector('.sb-f-title')?.value.trim() || '';
      const name = row.querySelector('.sb-f-name')?.value.trim() || '';
      if (title) sigs.push({ title, name });
    });
    const prefs = {
      includeSigs: document.getElementById('sb-opt-sigs')?.checked !== false,
      includeStamp: document.getElementById('sb-opt-stamp')?.checked !== false,
    };
    instances[key].sigs = sigs;
    instances[key].prefs = prefs;
    localStorage.setItem(PREFIX + key, JSON.stringify(sigs));
    savePrefs(key, prefs);
    renderAll(key);
    closeDialog();
    const result = await apiFetch('/hospital-storage', {
      method:'PUT',
      body: JSON.stringify({ data: { [PREFIX + key]: JSON.stringify(sigs), [PREFS_PFX + key]: JSON.stringify(prefs) } })
    });
    const st = document.getElementById('sb-status');
    if (st) st.textContent = result ? '✅ تم الحفظ والتزامن' : '💾 تم الحفظ محلياً';
  }

  function buildHTML(sigs, showStamp) {
    if (!Array.isArray(sigs) || sigs.length === 0) return `<div class="sb-empty">لا توجد توقيعات — اضغط "تعديل التواقيع" للإضافة</div>`;
    const items = sigs.map(s => `<div class="sb-item"><div class="sb-item-title">${esc(s.title)}:</div><div class="sb-item-line"></div><div class="sb-item-name">${esc(s.name || '')}</div></div>`).join('');
    const stamp = showStamp !== false ? `<div class="sb-item sb-stamp">${STAMP_SVG}</div>` : '';
    return `<div class="sb-grid">${items}${stamp}</div>`;
  }

  function ensureAttendanceSignatureContainers() {
    const tables = Array.from(document.querySelectorAll('.department-table')).filter(section => section.querySelector('table[id$="-table"]'));

    // امسح فقط بلوكات الحضور داخل كل جدول ثم أعد بناءها. لا تستخدم flag مرة واحدة؛ لأن renderTables قد يعيد بناء/تغيير الجداول بعد التهيئة.
    tables.forEach(section => {
      section.querySelectorAll('.print-signatures').forEach(el => el.remove());
    });

    tables.forEach((section, index) => {
      const table = section.querySelector('table[id$="-table"]');
      if (!table) return;
      const block = document.createElement('div');
      block.className = 'print-signatures sb-attendance-table-signatures';
      block.setAttribute('data-attendance-signature-block', String(index + 1));
      block.setAttribute('data-sb-table-owner', table.id || String(index + 1));
      block.innerHTML = `<h4>التواقيع</h4><div class="print-signatures-grid" data-sb-page="attendance" data-sb-table="${esc(table.id)}"></div>`;
      section.appendChild(block);
    });

    console.log('[SignatureBlock] تم تجهيز التواقيع تحت كل جدول حضور:', tables.length);
  }

  function applyPrintClasses(pageKey) {
    const inst = instances[pageKey];
    const prefs = inst?.prefs || {};
    const includeSigs = prefs.includeSigs !== false;
    const includeStamp = prefs.includeStamp !== false;
    const wrap = document.getElementById('sb-container-' + pageKey)?.closest('.sb-wrap');
    if (wrap) wrap.classList.toggle('sb-no-print-sigs', !includeSigs);
    document.querySelectorAll('[data-sb-page="' + pageKey + '"]').forEach(el => {
      el.classList.toggle('sb-no-print-sigs-inner', !includeSigs);
      if (el.parentElement) el.parentElement.classList.toggle('sb-no-print-sigs-inner', !includeSigs);
    });
    document.querySelectorAll('[data-sb-page="' + pageKey + '"] .sb-stamp, #sb-container-' + pageKey + ' .sb-stamp').forEach(el => el.classList.toggle('sb-no-print-stamp', !includeStamp));
    const badge = document.getElementById('sb-badge-' + pageKey);
    if (badge) {
      badge.textContent = (includeSigs ? 'التواقيع ✓' : 'التواقيع ✗') + ' | ' + (includeStamp ? 'الختم ✓' : 'الختم ✗');
      badge.style.color = (includeSigs || includeStamp) ? '#16a34a' : '#94a3b8';
    }
  }

  function renderAll(pageKey) {
    const inst = instances[pageKey];
    if (!inst) return;
    if (pageKey === 'attendance') ensureAttendanceSignatureContainers();
    const prefs = inst.prefs || {};
    const html = prefs.includeSigs === false ? '' : buildHTML(inst.sigs, inst.options.showStamp !== false && prefs.includeStamp !== false);
    const main = document.getElementById('sb-container-' + pageKey);
    if (main) main.innerHTML = html;
    document.querySelectorAll('[data-sb-page="' + pageKey + '"]').forEach(el => { el.innerHTML = html; });
    setTimeout(() => applyPrintClasses(pageKey), 0);
  }

  function installPrintHooks() {
    if (printHooksInstalled) return;
    printHooksInstalled = true;
    global.addEventListener('beforeprint', function () {
      if (instances.attendance) {
        renderAll('attendance');
        setTimeout(function () { renderAll('attendance'); }, 0);
      }
    });
  }

  async function pullCloud(pageKey) {
    const data = await apiFetch('/hospital-storage');
    if (!data?.data || !instances[pageKey]) return;
    const raw = data.data[PREFIX + pageKey];
    if (raw) {
      try {
        const sigs = JSON.parse(raw);
        instances[pageKey].sigs = Array.isArray(sigs) ? sigs : [];
        localStorage.setItem(PREFIX + pageKey, JSON.stringify(instances[pageKey].sigs));
      } catch {}
    }
    const rawPrefs = data.data[PREFS_PFX + pageKey];
    if (rawPrefs) {
      try {
        const prefs = JSON.parse(rawPrefs);
        instances[pageKey].prefs = prefs || {};
        localStorage.setItem(PREFS_PFX + pageKey, JSON.stringify(instances[pageKey].prefs));
      } catch {}
    }
    renderAll(pageKey);
  }

  const SB = {
    init(pageKey, options = {}) {
      let sigs = [];
      try { sigs = JSON.parse(localStorage.getItem(PREFIX + pageKey) || '[]'); } catch {}
      const prefs = loadPrefs(pageKey);
      instances[pageKey] = { sigs: Array.isArray(sigs) ? sigs : [], options, prefs };
      const setup = () => {
        injectCSS();
        buildDialogDOM();
        installPrintHooks();
        renderAll(pageKey);
        pullCloud(pageKey);
      };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
      else setup();
    },
    open(pageKey) { openDialog(pageKey); },
    getSigs(pageKey) {
      if (!pageKey || !instances[pageKey]) return [];
      const sigs = instances[pageKey].sigs;
      return Array.isArray(sigs) ? sigs.slice() : [];
    },
    getSig(pageKey, index) {
      const sigs = this.getSigs(pageKey);
      if (index < 0 || index >= sigs.length) return null;
      return sigs[index];
    },
    getPrefs(pageKey) {
      if (!pageKey || !instances[pageKey]) return { includeSigs:true, includeStamp:true };
      const prefs = instances[pageKey].prefs || {};
      return { includeSigs:prefs.includeSigs !== false, includeStamp:prefs.includeStamp !== false };
    },
    buildPrintHTML(pageKey) {
      if (!pageKey || !instances[pageKey]) return '';
      const inst = instances[pageKey];
      const prefs = inst.prefs || {};
      if (prefs.includeSigs === false) return '';
      return buildHTML(inst.sigs, inst.options.showStamp !== false && prefs.includeStamp !== false);
    },
    rerender(pageKey) { renderAll(pageKey); }
  };

  global.SignatureBlock = SB;
})(window);
