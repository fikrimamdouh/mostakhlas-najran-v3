/**
 * shared-nav.js
 * الشريط العلوي القديم معطل.
 * تصحيحات آمنة لصفحة المكاتب الإدارية فقط:
 * 1) عزل تواقيع كل مكتب/مرفق من الـ 15 مكتب.
 * 2) إضافة أزرار جدول الحضور: تكبير، تصغير، إعادة الحجم، عرض كامل.
 */
(function () {
  'use strict';

  function isAdminOfficesAttendancePage() {
    return /admin_offices_attendance\.html(?:$|[?#])/.test(location.href);
  }

  if (!isAdminOfficesAttendancePage()) return;

  function getOfficeNames() {
    try {
      if (typeof window.getCenterNames === 'function') return window.getCenterNames() || {};
    } catch (_) {}
    try { return JSON.parse(localStorage.getItem('adminOfficeNames_v1') || '{}'); } catch (_) { return {}; }
  }

  function getOfficeName(contextKey) {
    return getOfficeNames()[contextKey] || contextKey || 'غير محدد';
  }

  function forceSignatureIsolation() {
    window.getSignatureKeyForContext = function(type, contextKey) {
      if (contextKey === 'grand_certificate') return type + '_grand_certificate';
      if (contextKey) return type + '_' + contextKey;
      return type + '_general_admin_offices_only';
    };

    window.getSignatureDialogTitle = function(type, contextKey) {
      if (contextKey === 'grand_certificate') return 'تواقيع الشهادة الإجمالية';
      if (contextKey) return 'تواقيع: ' + getOfficeName(contextKey);
      return 'تواقيع عامة للمكاتب';
    };

    window.__ADMIN_OFFICES_SIGNATURES_ISOLATED__ = true;
  }

  function injectAdminOfficeTableCss() {
    if (document.getElementById('admin-office-table-parity-css')) return;
    const css = document.createElement('style');
    css.id = 'admin-office-table-parity-css';
    css.textContent = `
      .admin-office-enhanced .table-responsive-wrapper,
      .admin-office-enhanced .dept-table-scroll{
        overflow-x:auto!important;width:100%!important;-webkit-overflow-scrolling:touch!important;
      }
      .admin-office-enhanced table{min-width:1150px!important;transition:zoom .15s ease;}
      .admin-office-table-btn{
        display:inline-flex!important;align-items:center!important;gap:6px!important;
        padding:7px 13px!important;border-radius:8px!important;border:1px solid #dbe4f0!important;
        background:#fff!important;color:#334155!important;font-family:Tajawal,Arial,sans-serif!important;
        font-size:12px!important;font-weight:700!important;cursor:pointer!important;margin:2px!important;
        box-shadow:0 1px 3px rgba(15,23,42,.08)!important;
      }
      .admin-office-table-btn:hover{background:#f8fafc!important;border-color:#94a3b8!important;}
      .admin-office-fullscreen-backdrop{position:fixed!important;inset:0!important;background:rgba(15,23,42,.55)!important;z-index:9996!important;}
      .department-table.admin-office-fullscreen{
        position:fixed!important;inset:0!important;z-index:9997!important;background:#f8fafc!important;
        overflow:auto!important;margin:0!important;padding:0!important;width:100vw!important;height:100vh!important;
        border-radius:0!important;box-shadow:none!important;
      }
      .department-table.admin-office-fullscreen .extract-details-v2,
      .department-table.admin-office-fullscreen .tab-action-buttons{
        position:sticky!important;top:0!important;z-index:10!important;background:#fff!important;
      }
      .department-table.admin-office-fullscreen .table-responsive-wrapper,
      .department-table.admin-office-fullscreen .dept-table-scroll{padding:10px 14px 24px!important;overflow-x:auto!important;}
      .department-table.admin-office-fullscreen table{zoom:1!important;min-width:1400px!important;}
      @media print{.admin-office-table-btn,.admin-office-fullscreen-backdrop{display:none!important}}
    `;
    document.head.appendChild(css);
  }

  function zoomKey(tableId) {
    return 'adminOfficeTableZoom_' + String(tableId || '').replace(/^table-/, '');
  }

  window.adminOfficeZoomIn = function(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return;
    let z = parseFloat(table.style.zoom || localStorage.getItem(zoomKey(tableId)) || '1');
    z = Math.min(1.8, +(z + 0.1).toFixed(2));
    table.style.zoom = z;
    localStorage.setItem(zoomKey(tableId), String(z));
  };

  window.adminOfficeZoomOut = function(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return;
    let z = parseFloat(table.style.zoom || localStorage.getItem(zoomKey(tableId)) || '1');
    z = Math.max(0.6, +(z - 0.1).toFixed(2));
    table.style.zoom = z;
    localStorage.setItem(zoomKey(tableId), String(z));
  };

  window.adminOfficeZoomReset = function(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return;
    table.style.zoom = '1';
    localStorage.setItem(zoomKey(tableId), '1');
  };

  window.adminOfficeToggleFullscreen = function(tableId, btn) {
    const table = document.getElementById(tableId);
    const section = table ? table.closest('.department-table') : null;
    if (!section) return;

    const active = !section.classList.contains('admin-office-fullscreen');
    document.querySelectorAll('.department-table.admin-office-fullscreen').forEach(el => el.classList.remove('admin-office-fullscreen'));
    document.getElementById('admin-office-fullscreen-backdrop')?.remove();

    if (active) {
      const backdrop = document.createElement('div');
      backdrop.id = 'admin-office-fullscreen-backdrop';
      backdrop.className = 'admin-office-fullscreen-backdrop';
      backdrop.onclick = () => window.adminOfficeToggleFullscreen(tableId, btn);
      document.body.appendChild(backdrop);
      section.classList.add('admin-office-fullscreen');
      document.body.style.overflow = 'hidden';
      if (btn) btn.innerHTML = '<i class="fas fa-compress"></i> خروج';
    } else {
      section.classList.remove('admin-office-fullscreen');
      document.body.style.overflow = '';
      if (btn) btn.innerHTML = '<i class="fas fa-expand"></i> عرض كامل';
    }
  };

  function enhanceOneTable(section) {
    if (!section || section.dataset.adminOfficeEnhanced === '1') return;
    const table = section.querySelector('table[id^="table-"]');
    if (!table || !table.id) return;

    section.classList.add('admin-office-enhanced');
    section.dataset.adminOfficeEnhanced = '1';

    const wrapper = table.closest('.table-responsive-wrapper') || table.parentElement;
    if (wrapper) wrapper.classList.add('dept-table-scroll');

    const savedZoom = localStorage.getItem(zoomKey(table.id));
    if (savedZoom) table.style.zoom = savedZoom;

    let bar = section.querySelector('.tab-action-buttons');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'tab-action-buttons no-print';
      const details = section.querySelector('.extract-details-v2');
      if (details && details.nextSibling) details.parentNode.insertBefore(bar, details.nextSibling);
      else section.insertBefore(bar, section.firstChild);
    }

    if (!bar.querySelector('[data-admin-office-control="zoom-in"]')) {
      bar.insertAdjacentHTML('beforeend', `
        <button type="button" class="admin-office-table-btn" data-admin-office-control="zoom-in" onclick="adminOfficeZoomIn('${table.id}')"><i class="fas fa-search-plus"></i> تكبير</button>
        <button type="button" class="admin-office-table-btn" data-admin-office-control="zoom-out" onclick="adminOfficeZoomOut('${table.id}')"><i class="fas fa-search-minus"></i> تصغير</button>
        <button type="button" class="admin-office-table-btn" data-admin-office-control="zoom-reset" onclick="adminOfficeZoomReset('${table.id}')"><i class="fas fa-compress-arrows-alt"></i> إعادة الحجم</button>
        <button type="button" class="admin-office-table-btn" data-admin-office-control="fullscreen" onclick="adminOfficeToggleFullscreen('${table.id}', this)"><i class="fas fa-expand"></i> عرض كامل</button>
      `);
    }
  }

  function enhanceAllTables() {
    forceSignatureIsolation();
    injectAdminOfficeTableCss();
    document.querySelectorAll('[id^="table-div-"]').forEach(enhanceOneTable);
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      const section = document.querySelector('.department-table.admin-office-fullscreen');
      const table = section?.querySelector('table[id^="table-"]');
      if (table) window.adminOfficeToggleFullscreen(table.id);
    }
  });

  const originalShowCenterDetails = window.showCenterDetails;
  if (typeof originalShowCenterDetails === 'function') {
    window.showCenterDetails = function() {
      const result = originalShowCenterDetails.apply(this, arguments);
      setTimeout(enhanceAllTables, 50);
      setTimeout(enhanceAllTables, 300);
      return result;
    };
  }

  const originalOpenSignatureDialog = window.openSignatureDialog;
  if (typeof originalOpenSignatureDialog === 'function') {
    window.openSignatureDialog = function(type, contextKey) {
      forceSignatureIsolation();
      return originalOpenSignatureDialog.call(this, type, contextKey);
    };
  }

  forceSignatureIsolation();
  injectAdminOfficeTableCss();
  enhanceAllTables();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhanceAllTables);
  } else {
    setTimeout(enhanceAllTables, 50);
  }

  let tries = 0;
  const timer = setInterval(function() {
    enhanceAllTables();
    tries++;
    if (tries >= 40) clearInterval(timer);
  }, 250);

  const mo = new MutationObserver(enhanceAllTables);
  if (document.body) mo.observe(document.body, { childList: true, subtree: true });
})();
