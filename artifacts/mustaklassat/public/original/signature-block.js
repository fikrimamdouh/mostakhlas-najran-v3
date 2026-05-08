/**
 * signature-block.js — نظام التواقيع الموحد
 * يُستخدم في: attendance, performance, achievement, consumables, spare_parts, admin_offices
 * التخزين: hospital_storage (سحابي مشترك لكل المستشفى) + localStorage (فوري)
 * الاستخدام:
 *   SignatureBlock.init('pageKey', { showStamp: true });
 *   SignatureBlock.open('pageKey');
 */
(function (global) {
  'use strict';

  const PREFIX      = 'sb_sigs_';
  const SESSION_KEY = 'najran_session';

  /* ── ختم SVG ─────────────────────────────────────────────────────────────── */
  const STAMP_SVG = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="5,3"/>
    <circle cx="50" cy="50" r="33" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="50" y="56" text-anchor="middle" font-family="Tajawal,Arial,sans-serif"
          font-size="17" fill="currentColor" font-weight="bold">ختم</text>
  </svg>`;

  /* ── CSS مدمج ────────────────────────────────────────────────────────────── */
  const CSS = `
/* ═══════════════════ SignatureBlock ═══════════════════ */
.sb-wrap { margin: 20px 0 0; }
.sb-bar  { display:flex; gap:10px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }

.sb-btn {
  display:inline-flex; align-items:center; gap:6px; padding:8px 18px;
  border-radius:10px; border:none; cursor:pointer;
  font-family:Tajawal,Arial,sans-serif; font-size:13px; font-weight:700;
  transition:opacity .2s;
}
.sb-btn-edit { background:linear-gradient(135deg,#4f46e5,#6366f1); color:#fff; }
.sb-btn-edit:hover { opacity:.85; }

/* شبكة التواقيع */
.sb-grid {
  display:grid;
  grid-template-columns:repeat(auto-fit, minmax(170px, 1fr));
  gap:14px;
}
.sb-item {
  text-align:center; padding:14px 10px;
  background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px;
}
.sb-item-title { font-weight:700; font-size:13px; color:#1e3c72; margin-bottom:8px; }
.sb-item-line  { border-bottom:1px solid #1e3c72; height:36px; margin:0 12px 8px; }
.sb-item-name  { font-size:12px; color:#475569; min-height:16px; }

/* الختم */
.sb-stamp { display:flex; flex-direction:column; align-items:center; justify-content:center; color:#1e3c72; }
.sb-stamp svg { width:80px; height:80px; }

/* الـ overlay */
.sb-overlay {
  display:none; position:fixed; inset:0;
  background:rgba(0,0,0,.52); z-index:99990;
  align-items:center; justify-content:center;
}
.sb-overlay.open { display:flex; }

/* الحوار */
.sb-dialog {
  background:#fff; border-radius:18px; padding:28px;
  width:560px; max-width:95vw; max-height:88vh; overflow-y:auto;
  direction:rtl; font-family:Tajawal,Arial,sans-serif;
  box-shadow:0 20px 60px rgba(0,0,0,.28);
}
.sb-dialog h3 {
  font-size:18px; font-weight:800; color:#1e3c72;
  margin:0 0 6px; text-align:center;
}
.sb-dialog-sub {
  font-size:12px; color:#64748b; text-align:center; margin:0 0 20px;
}
.sb-field-row { display:flex; gap:8px; align-items:center; margin-bottom:10px; }
.sb-field-row input {
  flex:1; padding:9px 12px; border:1.5px solid #e2e8f0;
  border-radius:10px; font-family:Tajawal,Arial,sans-serif;
  font-size:13px; direction:rtl;
}
.sb-field-row input:focus { outline:none; border-color:#4f46e5; }
.sb-field-row input::placeholder { color:#94a3b8; }
.sb-del-btn {
  width:34px; height:34px; border:none; border-radius:8px;
  background:#fef2f2; color:#dc2626; cursor:pointer; font-size:15px;
  display:flex; align-items:center; justify-content:center; flex-shrink:0;
  transition:background .15s;
}
.sb-del-btn:hover { background:#fee2e2; }
.sb-add-btn {
  width:100%; padding:10px; border:2px dashed #c7d2fe; border-radius:10px;
  background:#eef2ff; color:#4f46e5; cursor:pointer;
  font-family:Tajawal,Arial,sans-serif; font-size:13px; font-weight:700;
  margin:4px 0 20px; transition:background .2s;
}
.sb-add-btn:hover { background:#e0e7ff; }
.sb-dialog-footer { display:flex; gap:10px; justify-content:center; }
.sb-save-btn {
  padding:10px 30px; border:none; border-radius:12px;
  background:linear-gradient(135deg,#16a34a,#15803d); color:#fff;
  font-family:inherit; font-size:14px; font-weight:700; cursor:pointer;
}
.sb-save-btn:hover { opacity:.9; }
.sb-cancel-btn {
  padding:10px 30px; border:1.5px solid #e2e8f0; border-radius:12px;
  background:#fff; color:#64748b; font-family:inherit;
  font-size:14px; font-weight:600; cursor:pointer;
}
.sb-cancel-btn:hover { background:#f8fafc; }
.sb-status {
  font-size:12px; color:#16a34a; text-align:center;
  margin-top:10px; min-height:18px;
}
.sb-empty {
  text-align:center; color:#94a3b8; font-size:13px; padding:16px;
}

/* ── للطباعة ── */
@media print {
  .sb-bar, .sb-btn { display:none !important; }
  .sb-wrap  { margin-top:16px !important; }
  .sb-grid  {
    display:grid !important;
    grid-template-columns:repeat(auto-fit, minmax(130px,1fr)) !important;
    gap:10px !important;
  }
  .sb-item {
    border:none !important; background:transparent !important;
    border-top:1px solid #000 !important; border-radius:0 !important;
    padding:6px 4px !important;
  }
  .sb-item-title { font-size:11px !important; color:#000 !important; margin-bottom:4px !important; }
  .sb-item-line  { height:28px !important; border-color:#000 !important; margin:0 8px 4px !important; }
  .sb-item-name  { font-size:10px !important; color:#000 !important; }
  .sb-stamp { color:#000 !important; }
  .sb-stamp svg  { width:60px !important; height:60px !important; }
}
/* ══════════════════════════════════════════════════════ */
`;

  /* ── حالة داخلية ──────────────────────────────────────────────────────────── */
  const instances = {};  // { pageKey → { sigs:[], options:{} } }
  let activeKey   = null;

  /* ── مساعدات ─────────────────────────────────────────────────────────────── */
  function getToken() {
    try {
      const s = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
      if (!s.clerkToken) return null;
      return (Date.now() - (s.timestamp || 0)) < 55000 ? s.clerkToken : null;
    } catch { return null; }
  }

  function esc(v) {
    return (v || '')
      .replace(/&/g,'&amp;').replace(/"/g,'&quot;')
      .replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  async function apiFetch(path, opts = {}) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    try {
      const r = await fetch('/api' + path, { ...opts, headers, credentials: 'include' });
      return r.ok ? r.json() : null;
    } catch { return null; }
  }

  /* ── حقن CSS ─────────────────────────────────────────────────────────────── */
  function injectCSS() {
    if (document.getElementById('sb-styles')) return;
    const el = document.createElement('style');
    el.id = 'sb-styles';
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  /* ── بناء DOM للحوار (مرة واحدة فقط) ────────────────────────────────────── */
  function buildDialogDOM() {
    if (document.getElementById('sb-overlay')) return;
    const ov = document.createElement('div');
    ov.id = 'sb-overlay';
    ov.className = 'sb-overlay';
    ov.innerHTML = `
      <div class="sb-dialog" id="sb-dialog">
        <h3>تعديل التواقيع</h3>
        <p class="sb-dialog-sub">أضف أو عدّل أو احذف التواقيع بحرية — تتزامن تلقائياً لجميع مستخدمي المستشفى</p>
        <div id="sb-fields"></div>
        <button class="sb-add-btn" id="sb-add-btn">＋ إضافة توقيع جديد</button>
        <div class="sb-dialog-footer">
          <button class="sb-save-btn"   id="sb-save-btn">💾 حفظ</button>
          <button class="sb-cancel-btn" id="sb-cancel-btn">إلغاء</button>
        </div>
        <div class="sb-status" id="sb-status"></div>
      </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov) closeDialog(); });
    document.getElementById('sb-add-btn').addEventListener('click', () => addRow());
    document.getElementById('sb-save-btn').addEventListener('click', saveDialog);
    document.getElementById('sb-cancel-btn').addEventListener('click', closeDialog);
  }

  /* ── إضافة صف توقيع في الحوار ────────────────────────────────────────────── */
  function addRow(title, name) {
    const fields = document.getElementById('sb-fields');
    const row = document.createElement('div');
    row.className = 'sb-field-row';
    row.innerHTML = `
      <input type="text" class="sb-f-title" placeholder="المسمى الوظيفي" value="${esc(title || '')}">
      <input type="text" class="sb-f-name"  placeholder="الاسم"          value="${esc(name  || '')}">
      <button class="sb-del-btn" title="حذف">✕</button>`;
    row.querySelector('.sb-del-btn').addEventListener('click', () => row.remove());
    fields.appendChild(row);
  }

  /* ── فتح/إغلاق الحوار ────────────────────────────────────────────────────── */
  function openDialog(pageKey) {
    if (!instances[pageKey]) return;
    activeKey = pageKey;
    const sigs   = instances[pageKey].sigs || [];
    const fields = document.getElementById('sb-fields');
    fields.innerHTML = '';
    if (sigs.length === 0) { addRow(); }
    else { sigs.forEach(s => addRow(s.title, s.name)); }
    document.getElementById('sb-status').textContent = '';
    document.getElementById('sb-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeDialog() {
    const ov = document.getElementById('sb-overlay');
    if (ov) ov.classList.remove('open');
    document.body.style.overflow = '';
    activeKey = null;
  }

  /* ── حفظ من الحوار ───────────────────────────────────────────────────────── */
  async function saveDialog() {
    const key = activeKey;
    if (!key) return;
    const rows = document.querySelectorAll('#sb-fields .sb-field-row');
    const sigs = [];
    rows.forEach(row => {
      const title = row.querySelector('.sb-f-title').value.trim();
      const name  = row.querySelector('.sb-f-name').value.trim();
      if (title) sigs.push({ title, name });
    });
    instances[key].sigs = sigs;
    localStorage.setItem(PREFIX + key, JSON.stringify(sigs));
    renderAll(key);
    closeDialog();
    // رفع إلى السحابة
    const st = document.getElementById('sb-status');
    const result = await apiFetch('/hospital-storage', {
      method: 'PUT',
      body: JSON.stringify({ data: { [PREFIX + key]: JSON.stringify(sigs) } }),
    });
    if (st) st.textContent = result ? '✅ تم الحفظ وتزامن مع جميع المستخدمين' : '💾 تم الحفظ محلياً';
  }

  /* ── بناء HTML للتواقيع ──────────────────────────────────────────────────── */
  function buildHTML(sigs, showStamp) {
    if (!sigs || sigs.length === 0) {
      return `<div class="sb-empty">لا توجد توقيعات — اضغط "تعديل التواقيع" للإضافة</div>`;
    }
    const items = sigs.map(s => `
      <div class="sb-item">
        <div class="sb-item-title">${esc(s.title)}:</div>
        <div class="sb-item-line"></div>
        <div class="sb-item-name">${esc(s.name || '')}</div>
      </div>`).join('');
    const stamp = showStamp !== false
      ? `<div class="sb-item sb-stamp">${STAMP_SVG}</div>` : '';
    return `<div class="sb-grid">${items}${stamp}</div>`;
  }

  /* ── عرض في كل الحاويات ─────────────────────────────────────────────────── */
  function renderAll(pageKey) {
    const inst = instances[pageKey];
    if (!inst) return;
    const html      = buildHTML(inst.sigs, inst.options.showStamp);
    const stampHide = buildHTML(inst.sigs, false);

    // الحاوية الرئيسية (للشاشة)
    const main = document.getElementById('sb-container-' + pageKey);
    if (main) main.innerHTML = html;

    // حاويات الطباعة المميّزة بـ data-sb-page
    document.querySelectorAll('[data-sb-page="' + pageKey + '"]').forEach(el => {
      // داخل منطقة print: أخفِ الختم إن كان مخصصاً للشبكة المضغوطة
      el.innerHTML = html;
    });
  }

  /* ── سحب من السحابة ─────────────────────────────────────────────────────── */
  async function pullCloud(pageKey) {
    const data = await apiFetch('/hospital-storage');
    if (!data?.data) return;
    const raw = data.data[PREFIX + pageKey];
    if (!raw) return;
    try {
      const sigs = JSON.parse(raw);
      instances[pageKey].sigs = sigs;
      localStorage.setItem(PREFIX + pageKey, JSON.stringify(sigs));
      renderAll(pageKey);
    } catch {}
  }

  /* ════════════════════ الواجهة العامة ════════════════════ */
  const SB = {

    /**
     * init(pageKey, options?)
     * options.showStamp   — boolean, default true
     * options.containerId — id مخصص بدلاً من sb-container-{pageKey}
     */
    init(pageKey, options = {}) {
      let sigs = [];
      try { sigs = JSON.parse(localStorage.getItem(PREFIX + pageKey) || '[]'); } catch {}
      instances[pageKey] = { sigs, options };

      const setup = () => {
        injectCSS();
        buildDialogDOM();
        renderAll(pageKey);
        pullCloud(pageKey);
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setup);
      } else {
        setup();
      }
    },

    /** فتح حوار التعديل */
    open(pageKey) { openDialog(pageKey); },

    /** قراءة التواقيع الحالية (للاستخدام في نوافذ الطباعة المخصصة) */
    getSigs(pageKey) {
      return (instances[pageKey]?.sigs || []).slice();
    },

    /** بناء HTML جاهز للطباعة */
    buildPrintHTML(pageKey) {
      const inst = instances[pageKey];
      if (!inst) return '';
      return buildHTML(inst.sigs, inst.options.showStamp);
    },
  };

  global.SignatureBlock = SB;
})(window);
