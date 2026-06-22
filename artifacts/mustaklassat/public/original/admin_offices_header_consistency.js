// ===================================================================
// Admin Offices Header Consistency
// Scope: admin_offices_attendance.html only
// يجعل الأداء والإنجاز يأخذان نفس شعار/عنوان المكتب الظاهر في الحضور والانصراف
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;

  function esc(v) {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function getNames() {
    try { if (typeof getCenterNames === 'function') return getCenterNames() || {}; } catch (_) {}
    return readJson('adminOfficeNames_v1', {});
  }

  function currentCenterKey(fallback) {
    if (fallback) return fallback;
    const activeTab = document.querySelector('.tab-link.active[data-center-key]');
    if (activeTab?.dataset?.centerKey) return activeTab.dataset.centerKey;

    const title = document.getElementById('center-main-title')?.textContent || '';
    const names = getNames();
    const found = Object.entries(names).find(([, name]) => title.includes(name));
    if (found) return found[0];
    if (title.includes('الورش')) return 'admin_staff';
    return null;
  }

  function headerFor(centerKey) {
    try {
      if (typeof window.getHeaderForCenter === 'function') return window.getHeaderForCenter(centerKey);
    } catch (_) {}
    return { logoSrc: 'moh_logo.png', h1: 'فرع وزارة الصحة بمنطقة نجران', h3: 'المكاتب الإدارية' };
  }

  function buildHeader(centerKey) {
    const h = headerFor(centerKey);
    return `
      <div class="admin-office-unified-doc-header" data-center-key="${esc(centerKey)}">
        <img class="logo" src="${esc(h.logoSrc || 'moh_logo.png')}" alt="logo">
        <div class="header-text">
          <h1>${esc(h.h1 || '')}</h1>
          <h3>${esc(h.h3 || '')}</h3>
          <h2>مستخلص العمالة للمكاتب الإدارية والمرافق الصحية</h2>
        </div>
        <img class="logo" src="${esc(h.logoSrc || 'moh_logo.png')}" alt="logo">
      </div>
    `;
  }

  function injectStyle() {
    if (document.getElementById('admin-offices-unified-doc-header-style')) return;
    const st = document.createElement('style');
    st.id = 'admin-offices-unified-doc-header-style';
    st.textContent = `
      .admin-office-unified-doc-header{
        display:flex;align-items:center;justify-content:space-between;gap:12px;
        border-bottom:3px solid #003087;padding:8px 12px 10px;margin:0 0 12px;
        background:#fff;direction:rtl;text-align:center;
      }
      .admin-office-unified-doc-header .logo{width:72px;height:auto;object-fit:contain;flex:0 0 auto;}
      .admin-office-unified-doc-header .header-text{flex:1;text-align:center;}
      .admin-office-unified-doc-header h1{margin:0;color:#003087;font-size:20px;font-weight:900;line-height:1.25;}
      .admin-office-unified-doc-header h2{margin:5px 0 0;color:#111827;font-size:17px;font-weight:900;line-height:1.25;}
      .admin-office-unified-doc-header h3{margin:4px 0 0;color:#334155;font-size:14px;font-weight:800;line-height:1.25;}
      @media print{
        .admin-office-unified-doc-header{padding:4px 8px 6px;margin-bottom:6px;border-bottom:1px solid #777;}
        .admin-office-unified-doc-header .logo{width:42px;}
        .admin-office-unified-doc-header h1{font-size:10pt;}
        .admin-office-unified-doc-header h2{font-size:9pt;margin-top:2px;}
        .admin-office-unified-doc-header h3{font-size:8pt;margin-top:1px;}
      }
    `;
    document.head.appendChild(st);
  }

  function applyHeader(container, centerKey) {
    if (!container || !centerKey) return;
    injectStyle();
    const existing = container.querySelector(':scope > .admin-office-unified-doc-header');
    const html = buildHeader(centerKey);
    if (existing) {
      if (existing.getAttribute('data-center-key') !== centerKey) existing.outerHTML = html;
      return;
    }
    container.insertAdjacentHTML('afterbegin', html);
  }

  function syncPerformance(centerKey) {
    const key = currentCenterKey(centerKey);
    if (!key) return;
    const container = document.getElementById(`admin-office-performance-certificate-${key}`) || document.querySelector('#performance-tab .certificate-container');
    applyHeader(container, key);
  }

  function syncAchievement(centerKey) {
    const key = currentCenterKey(centerKey);
    if (!key) return;
    const container = document.querySelector('#achievement-tab .certificate-container') || document.querySelector('#achievement-tab .achievement-certificate') || document.getElementById('achievement-tab');
    applyHeader(container, key);
  }

  function patchRenderers() {
    if (typeof window.renderAdminOfficePerformanceTable === 'function' && !window.renderAdminOfficePerformanceTable.__headerConsistencyPatched) {
      const original = window.renderAdminOfficePerformanceTable;
      window.renderAdminOfficePerformanceTable = function patchedRenderAdminOfficePerformanceTable(centerKey) {
        const result = original.apply(this, arguments);
        setTimeout(() => syncPerformance(centerKey), 30);
        setTimeout(() => syncPerformance(centerKey), 200);
        return result;
      };
      window.renderAdminOfficePerformanceTable.__headerConsistencyPatched = true;
    }

    if (typeof window.renderAchievementCertificate === 'function' && !window.renderAchievementCertificate.__headerConsistencyPatched) {
      const original = window.renderAchievementCertificate;
      window.renderAchievementCertificate = function patchedRenderAchievementCertificate(centerKey) {
        const result = original.apply(this, arguments);
        setTimeout(() => syncAchievement(centerKey), 30);
        setTimeout(() => syncAchievement(centerKey), 200);
        return result;
      };
      window.renderAchievementCertificate.__headerConsistencyPatched = true;
    }

    if (typeof window.openTab === 'function' && !window.openTab.__adminHeaderConsistencyPatched) {
      const originalOpenTab = window.openTab;
      window.openTab = function patchedOpenTab(evt, tabName, centerKey) {
        const result = originalOpenTab.apply(this, arguments);
        const key = centerKey || currentCenterKey();
        if (tabName === 'performance-tab') setTimeout(() => syncPerformance(key), 80);
        if (tabName === 'achievement-tab') setTimeout(() => syncAchievement(key), 80);
        return result;
      };
      window.openTab.__adminHeaderConsistencyPatched = true;
    }
  }

  function boot(attempt) {
    patchRenderers();
    syncPerformance();
    syncAchievement();
    if (attempt < 40) setTimeout(() => boot(attempt + 1), 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot(0));
  else boot(0);

  console.info('[Admin Offices Header Consistency] installed');
})();
