/**
 * user-storage-proxy.js
 * يعزل بيانات localStorage لكل مستخدم بشكل تلقائي وشفاف
 * يجب تحميله قبل أي script آخر يستخدم localStorage
 */
(function () {
  const EXCLUDED_KEYS = ['najran_session']; // مفاتيح مشتركة لا تُعزل

  function getPrefix() {
    try {
      const raw = Storage.prototype.getItem.call(localStorage, 'najran_session');
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (!session || !session.userId) return null;
      return '_u' + session.userId + '_';
    } catch (_) {
      return null;
    }
  }
window._najranRealStorage = localStorage;

  const PREFIX = getPrefix();
  if (!PREFIX) return; // لا يوجد جلسة → تشغيل طبيعي

  const _get    = Storage.prototype.getItem.bind(localStorage);
  const _set    = Storage.prototype.setItem.bind(localStorage);
  const _remove = Storage.prototype.removeItem.bind(localStorage);

  function prefixed(key) {
    return EXCLUDED_KEYS.includes(key) ? key : PREFIX + key;
  }

  const proxyHandler = {
    get(target, prop) {
      if (prop === 'getItem') {
        return (key) => _get(prefixed(key));
      }
      if (prop === 'setItem') {
        return (key, value) => _set(prefixed(key), value);
      }
      if (prop === 'removeItem') {
        return (key) => _remove(prefixed(key));
      }
      if (prop === 'clear') {
        // مسح مفاتيح هذا المستخدم فقط
        return () => {
          const toDelete = [];
          for (let i = 0; i < target.length; i++) {
            const k = target.key(i);
            if (k && k.startsWith(PREFIX)) toDelete.push(k);
          }
          toDelete.forEach(k => _remove(k));
        };
      }
      const val = target[prop];
      return typeof val === 'function' ? val.bind(target) : val;
    }
  };

  try {
    const proxy = new Proxy(localStorage, proxyHandler);
    Object.defineProperty(window, 'localStorage', {
      value: proxy,
      configurable: true,
      writable: false,
    });
  } catch (_) {
    // بعض المتصفحات لا تدعم Proxy على localStorage — نتجاوز
  }
})();

/**
 * عارض مراجعة تفصيلي داخل صفحة اعتماد المستخلصات فقط.
 * لا يغير الحفظ، ولا المعادلات، ولا الطباعة؛ يقرأ فقط من submitted_extracts.extractData.
 */
(function () {
  'use strict';

  if (!/\/original\/approval\.html(?:$|[?#])/.test(window.location.pathname + window.location.search)) return;

  const SECTION_DEFS = [
    {
      id: 'summary',
      title: 'الملخص وبيانات العقد',
      icon: '📌',
      keys: ['persistentContractData', 'persistentExtractData', 'contractData', 'contractDetails', 'hospitalName', 'companyName', 'contractNumber', 'extractMonth', 'extractYear', 'extractStart', 'extractEnd']
    },
    {
      id: 'attendance',
      title: 'الحضور والانصراف',
      icon: '📋',
      keys: ['attendanceData', 'ng_attendanceData', 'nd_attendanceData', 'centersAttendanceData_v2', 'healthCentersAttendanceData', 'adminOfficesAttendanceData_v1']
    },
    {
      id: 'performance',
      title: 'تقييم الأداء',
      icon: '📊',
      keys: ['performanceData', 'performanceTotalDeduction', 'ng_performanceTotalDeduction', 'nd_performanceTotalDeduction', 'performance_data_consumables_v27']
    },
    {
      id: 'achievement',
      title: 'الإنجاز',
      icon: '🏆',
      keys: ['achievementData', 'achievementTitles_v1', 'achievementItemNames', 'nd_dentalAchievementTotals']
    },
    {
      id: 'consumables',
      title: 'المستهلكات والمواد',
      icon: '🧪',
      keys: ['consumablesTableData', 'healthCentersConsumables', 'mainHospitalConsumables', 'admin_offices_consumables_v1.0', 'finalConsumablesCost', 'water_supply_data_consumables_v27', 'sewage_disposal_data_consumables_v27', 'subcontractors_data_consumables_v27']
    },
    {
      id: 'spare',
      title: 'قطع الغيار',
      icon: '🔩',
      keys: ['spare_partsData', 'sparePartsTotalAmount']
    },
    {
      id: 'signatures',
      title: 'التوقيعات والاعتماد الداخلي',
      icon: '✍️',
      keys: ['dynamicSignatures', 'contractorSignature', 'performanceSignatures', 'performanceSignatures_v2', 'contractSignatureData', 'approvalData', 'displayApprovalData']
    }
  ];

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeKey(k) {
    return String(k || '').replace(/^_u\d+_/, '');
  }

  function parseExtractData(raw) {
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(raw); } catch (_) { return {}; }
  }

  function getGlobalExtractById(id) {
    try {
      if (typeof allExtracts !== 'undefined' && Array.isArray(allExtracts)) {
        return allExtracts.find(function (e) { return String(e.id) === String(id); }) || null;
      }
    } catch (_) {}
    return null;
  }

  function getSectionEntries(snapshot, def) {
    const out = [];
    const exact = new Set(def.keys);
    Object.keys(snapshot || {}).forEach(function (rawKey) {
      const nk = normalizeKey(rawKey);
      if (exact.has(nk)) out.push({ key: nk, originalKey: rawKey, value: snapshot[rawKey] });
    });
    return out;
  }

  function looksLikeObjectArray(arr) {
    return Array.isArray(arr) && arr.length > 0 && arr.every(function (x) { return x && typeof x === 'object' && !Array.isArray(x); });
  }

  function tableFromArray(arr) {
    const rows = arr.slice(0, 120);
    const colsSet = new Set();
    rows.forEach(function (r) { Object.keys(r || {}).slice(0, 20).forEach(function (k) { colsSet.add(k); }); });
    const cols = Array.from(colsSet).slice(0, 12);
    if (cols.length === 0) return '<div class="nr-empty">لا توجد أعمدة قابلة للعرض</div>';
    return '<div class="nr-table-wrap"><table class="nr-table"><thead><tr>' +
      cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') +
      '</tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr>' + cols.map(function (c) { return '<td>' + renderScalar(r ? r[c] : '') + '</td>'; }).join('') + '</tr>';
      }).join('') +
      '</tbody></table>' + (arr.length > rows.length ? '<div class="nr-note">تم عرض أول ' + rows.length + ' صف فقط من أصل ' + arr.length + '</div>' : '') + '</div>';
  }

  function renderScalar(v) {
    if (v == null || v === '') return '<span class="nr-muted">—</span>';
    if (typeof v === 'number') return esc(Number(v).toLocaleString('en-US'));
    if (typeof v === 'boolean') return v ? 'نعم' : 'لا';
    if (typeof v === 'object') return '<code>' + esc(JSON.stringify(v)) + '</code>';
    return esc(v);
  }

  function renderValue(value) {
    if (looksLikeObjectArray(value)) return tableFromArray(value);
    if (Array.isArray(value)) {
      if (value.length === 0) return '<div class="nr-empty">لا توجد بيانات</div>';
      return '<div class="nr-list">' + value.slice(0, 120).map(function (x) { return '<div class="nr-list-item">' + renderScalar(x) + '</div>'; }).join('') + '</div>';
    }
    if (value && typeof value === 'object') {
      const keys = Object.keys(value);
      if (keys.length === 0) return '<div class="nr-empty">لا توجد بيانات</div>';

      const firstArrayKey = keys.find(function (k) { return looksLikeObjectArray(value[k]); });
      if (firstArrayKey) {
        return '<div class="nr-subtitle">' + esc(firstArrayKey) + '</div>' + tableFromArray(value[firstArrayKey]);
      }

      return '<div class="nr-kv-grid">' + keys.slice(0, 80).map(function (k) {
        return '<div class="nr-kv"><div class="nr-k">' + esc(k) + '</div><div class="nr-v">' + renderScalar(value[k]) + '</div></div>';
      }).join('') + '</div>';
    }
    return '<div class="nr-kv-grid"><div class="nr-kv"><div class="nr-k">القيمة</div><div class="nr-v">' + renderScalar(value) + '</div></div></div>';
  }

  function renderSection(snapshot, def) {
    const entries = getSectionEntries(snapshot, def);
    if (entries.length === 0) {
      return '<div class="nr-section" id="nr-sec-' + esc(def.id) + '"><h3>' + def.icon + ' ' + esc(def.title) + '</h3><div class="nr-empty">لا توجد بيانات محفوظة لهذا الجزء داخل نسخة الرفع</div></div>';
    }
    return '<div class="nr-section" id="nr-sec-' + esc(def.id) + '"><h3>' + def.icon + ' ' + esc(def.title) + '</h3>' +
      entries.map(function (entry) {
        return '<div class="nr-block"><div class="nr-key">' + esc(entry.key) + (entry.originalKey !== entry.key ? ' <span>(' + esc(entry.originalKey) + ')</span>' : '') + '</div>' + renderValue(entry.value) + '</div>';
      }).join('') +
      '</div>';
  }

  function injectReviewStyles() {
    if (document.getElementById('najran-review-details-style')) return;
    const style = document.createElement('style');
    style.id = 'najran-review-details-style';
    style.textContent = `
      .nr-detail-btn{background:linear-gradient(135deg,#1e3c72,#2a5298)!important;color:#fff!important;border-color:transparent!important}
      .nr-overlay{position:fixed;inset:0;background:rgba(15,23,42,.62);z-index:999999;display:none;align-items:stretch;justify-content:center;padding:18px;direction:rtl}
      .nr-overlay.open{display:flex}
      .nr-modal{background:#fff;width:min(1180px,100%);border-radius:22px;box-shadow:0 24px 80px rgba(0,0,0,.35);display:flex;flex-direction:column;overflow:hidden}
      .nr-head{background:linear-gradient(135deg,#1e3c72,#2a5298);color:#fff;padding:18px 22px;display:flex;align-items:center;justify-content:space-between;gap:14px}
      .nr-head h2{font-size:20px;font-weight:800;margin:0}.nr-head p{font-size:12px;opacity:.78;margin-top:3px}.nr-close{background:rgba(255,255,255,.16);color:#fff;border:1px solid rgba(255,255,255,.25);border-radius:10px;padding:8px 13px;cursor:pointer;font-family:inherit;font-weight:800}
      .nr-tabs{display:flex;gap:8px;overflow-x:auto;padding:12px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0}.nr-tab{white-space:nowrap;border:1px solid #dbe3ef;background:#fff;color:#334155;border-radius:999px;padding:8px 14px;font-family:inherit;font-size:12px;font-weight:800;cursor:pointer}.nr-tab.active{background:#1e3c72;color:#fff;border-color:#1e3c72}
      .nr-body{padding:18px;overflow:auto;max-height:calc(100vh - 190px);background:#f0f4f8}.nr-section{display:none;background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:18px;box-shadow:0 2px 8px rgba(0,0,0,.04)}.nr-section.active{display:block}.nr-section h3{font-size:18px;color:#1e3c72;margin:0 0 14px}
      .nr-block{border:1px solid #edf2f7;border-radius:14px;margin-bottom:14px;overflow:hidden;background:#fff}.nr-key{background:#f8fafc;color:#475569;font-size:12px;font-weight:900;padding:10px 13px;border-bottom:1px solid #edf2f7}.nr-key span{color:#94a3b8;font-weight:600}.nr-subtitle{font-size:12px;font-weight:800;color:#0f172a;margin:10px 0}
      .nr-table-wrap{overflow:auto}.nr-table{width:100%;border-collapse:collapse;font-size:12px;background:#fff}.nr-table th{background:#1e3c72;color:#fff;padding:9px;white-space:nowrap}.nr-table td{border-bottom:1px solid #edf2f7;padding:8px;vertical-align:top;max-width:260px}.nr-table tr:nth-child(even) td{background:#f8fafc}
      .nr-kv-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:9px;padding:12px}.nr-kv{background:#f8fafc;border:1px solid #edf2f7;border-radius:10px;padding:10px}.nr-k{font-size:11px;color:#64748b;font-weight:800;margin-bottom:5px}.nr-v{font-size:13px;color:#1e293b;font-weight:700;word-break:break-word}.nr-muted{color:#94a3b8}.nr-empty{padding:18px;text-align:center;color:#94a3b8;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:13px}.nr-note{font-size:11px;color:#64748b;padding:8px 10px;background:#f8fafc}.nr-list{padding:12px;display:grid;gap:7px}.nr-list-item{background:#f8fafc;border:1px solid #edf2f7;border-radius:9px;padding:8px;font-size:12px}code{white-space:normal;word-break:break-word;color:#334155}
      @media print{.nr-overlay{display:none!important}}
    `;
    document.head.appendChild(style);
  }

  function ensureModal() {
    injectReviewStyles();
    let overlay = document.getElementById('najran-review-details-overlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'najran-review-details-overlay';
    overlay.className = 'nr-overlay';
    overlay.innerHTML = '<div class="nr-modal"><div class="nr-head"><div><h2 id="nr-title">مراجعة تفصيلية للمستخلص</h2><p id="nr-subtitle">بيانات محفوظة وقت الرفع</p></div><button class="nr-close" onclick="window.closeNajranReviewDetails()">إغلاق ✕</button></div><div class="nr-tabs" id="nr-tabs"></div><div class="nr-body" id="nr-body"></div></div>';
    overlay.addEventListener('click', function (e) { if (e.target === overlay) window.closeNajranReviewDetails(); });
    document.body.appendChild(overlay);
    return overlay;
  }

  function activateSection(id) {
    document.querySelectorAll('.nr-tab').forEach(function (b) { b.classList.toggle('active', b.dataset.id === id); });
    document.querySelectorAll('.nr-section').forEach(function (s) { s.classList.toggle('active', s.id === 'nr-sec-' + id); });
  }

  window.closeNajranReviewDetails = function () {
    const overlay = document.getElementById('najran-review-details-overlay');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
  };

  window.openNajranReviewDetails = function (id) {
    const e = getGlobalExtractById(id);
    if (!e) return alert('تعذر العثور على بيانات المستخلص في الصفحة');
    const snapshot = parseExtractData(e.extractData);
    const overlay = ensureModal();

    document.getElementById('nr-title').textContent = 'مراجعة تفصيلية — ' + (e.hospitalName || e.submittedByHospital || '—');
    document.getElementById('nr-subtitle').textContent = (e.periodMonth || '—') + ' · ' + (e.companyName || '—') + ' · رقم المستخلص #' + e.id;

    document.getElementById('nr-tabs').innerHTML = SECTION_DEFS.map(function (def, idx) {
      return '<button class="nr-tab ' + (idx === 0 ? 'active' : '') + '" data-id="' + esc(def.id) + '" onclick="window.activateNajranReviewSection(\'' + esc(def.id) + '\')">' + def.icon + ' ' + esc(def.title) + '</button>';
    }).join('');

    document.getElementById('nr-body').innerHTML = SECTION_DEFS.map(function (def, idx) {
      return renderSection(snapshot, def).replace('nr-section"', 'nr-section' + (idx === 0 ? ' active' : '') + '"');
    }).join('');

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  window.activateNajranReviewSection = activateSection;

  function enhanceApprovalCards() {
    let extracts = [];
    try { if (typeof allExtracts !== 'undefined' && Array.isArray(allExtracts)) extracts = allExtracts; } catch (_) { return; }
    if (!extracts.length) return;

    extracts.forEach(function (e) {
      const card = document.getElementById('card-' + e.id);
      if (!card) return;
      const body = card.querySelector('.card-body.open');
      if (!body || body.querySelector('.nr-detail-btn')) return;

      const btnWrap = document.createElement('div');
      btnWrap.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px;border-bottom:1px solid #f1f5f9;padding-bottom:12px';
      btnWrap.innerHTML = '<button type="button" class="admin-btn nr-detail-btn" onclick="window.openNajranReviewDetails(' + Number(e.id) + ')">🔎 فتح المراجعة التفصيلية</button>';
      body.insertBefore(btnWrap, body.firstChild);
    });
  }

  function installEnhancer() {
    injectReviewStyles();
    const timer = setInterval(enhanceApprovalCards, 700);
    window.addEventListener('beforeunload', function () { clearInterval(timer); });

    try {
      if (typeof renderList === 'function' && !renderList.__najranReviewWrapped) {
        const originalRenderList = renderList;
        renderList = function () {
          const r = originalRenderList.apply(this, arguments);
          setTimeout(enhanceApprovalCards, 0);
          return r;
        };
        renderList.__najranReviewWrapped = true;
      }
    } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installEnhancer);
  } else {
    installEnhancer();
  }
})();
