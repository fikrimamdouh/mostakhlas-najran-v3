/**
 * shared-nav.js — Professional unified navigation bar
 * Replaces the <select> dropdown with a sticky horizontal nav on all pages.
 * Original .header-info stays in the DOM for print; hidden on screen.
 * Add <script src="/original/shared-nav.js"></script> to every HTML page.
 */
(function () {
  /* ── Icon map by page filename ── */
  var ICONS = {
    'index.html': '🏠',
    'attendance.html': '👥',
    'performance.html': '📈',
    'achievement.html': '🏆',
    'consumables.html': '📦',
    'spare_parts.html': '🔧',
    'health_centers_attendance.html': '🏥',
    'health_centers_consumables.html': '🗂️',
    'approval.html': '✅',
    'admin-dashboard.html': '🛡️',
    'settings_main.html': '⚙️',
    'extract-archive.html': '🗂️',
    'contract-foundation-upload.html': '📋',
  };

  /* ── Inject CSS ── */
  var css = `
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;600;700&display=swap');

/* ── Wrapper ── */
.sn-wrapper {
  background: linear-gradient(135deg, #0d2454 0%, #1a3562 45%, #1e3c72 100%);
  font-family: 'Tajawal', 'Segoe UI', Arial, sans-serif;
  direction: rtl;
  box-shadow: 0 4px 20px rgba(0,0,0,.35);
  position: relative;
  z-index: 999;
}

/* ── Top header strip ── */
.sn-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 28px 12px;
  border-bottom: 1px solid rgba(255,255,255,.1);
}
.sn-logo {
  width: 52px;
  height: 52px;
  border-radius: 10px;
  border: 2px solid rgba(212,175,55,.55);
  flex-shrink: 0;
  object-fit: contain;
  background: rgba(255,255,255,.05);
}
.sn-org {
  flex: 1;
  text-align: right;
  line-height: 1.35;
}
.sn-org-name {
  color: #d4af37;
  font-size: 19px;
  font-weight: 700;
  margin: 0;
  letter-spacing: .3px;
}
.sn-org-sub {
  color: rgba(255,255,255,.7);
  font-size: 12.5px;
  margin: 1px 0 0;
  font-weight: 400;
}
.sn-page-badge {
  background: rgba(212,175,55,.15);
  border: 1px solid rgba(212,175,55,.4);
  color: rgba(255,255,255,.9);
  font-size: 12px;
  font-weight: 600;
  padding: 5px 14px;
  border-radius: 20px;
  white-space: nowrap;
  font-family: 'Tajawal', sans-serif;
}

/* ── Tabs strip ── */
.sn-tabs {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding: 0 8px;
}
.sn-tabs::-webkit-scrollbar { display: none; }

.sn-tab {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 10px 18px;
  color: rgba(255,255,255,.68);
  text-decoration: none;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  border-bottom: 3px solid transparent;
  border-top: none;
  border-right: none;
  border-left: none;
  background: none;
  transition: color .18s, border-color .18s, background .18s;
  font-family: 'Tajawal', 'Segoe UI', Arial, sans-serif;
  line-height: 1;
}
.sn-tab .sn-icon {
  font-size: 15px;
  line-height: 1;
}
.sn-tab:hover {
  color: #fff;
  background: rgba(255,255,255,.07);
  border-bottom-color: rgba(212,175,55,.45);
}
.sn-tab.sn-active {
  color: #d4af37;
  border-bottom-color: #d4af37;
  background: rgba(212,175,55,.09);
  font-weight: 700;
}

/* ── Dropdown group ── */
.sn-dropdown {
  position: relative;
  display: inline-flex;
  align-items: stretch;
}
.sn-dropdown-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 10px 18px;
  color: rgba(255,255,255,.68);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  border-bottom: 3px solid transparent;
  border-top: none;
  border-right: none;
  border-left: none;
  background: none;
  transition: color .18s, border-color .18s, background .18s;
  font-family: 'Tajawal', 'Segoe UI', Arial, sans-serif;
  line-height: 1;
}
.sn-dropdown-btn:hover,
.sn-dropdown:hover .sn-dropdown-btn {
  color: #fff;
  background: rgba(255,255,255,.07);
  border-bottom-color: rgba(212,175,55,.45);
}
.sn-dropdown-btn.sn-active {
  color: #d4af37;
  border-bottom-color: #d4af37;
  background: rgba(212,175,55,.09);
  font-weight: 700;
}
.sn-caret {
  font-size: 10px;
  opacity: .7;
  margin-right: 2px;
  transition: transform .15s;
}
.sn-dropdown:hover .sn-caret,
.sn-dropdown.sn-open .sn-caret { transform: rotate(180deg); }

.sn-dropdown-menu {
  display: none;
  position: absolute;
  top: calc(100% + 1px);
  right: 0;
  background: linear-gradient(160deg, #122050 0%, #1a3562 100%);
  border-top: 2px solid #d4af37;
  border-radius: 0 0 10px 10px;
  box-shadow: 0 10px 30px rgba(0,0,0,.5);
  min-width: 170px;
  z-index: 1100;
  overflow: hidden;
}
.sn-dropdown:hover .sn-dropdown-menu,
.sn-dropdown.sn-open .sn-dropdown-menu { display: block; }

.sn-dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 18px;
  color: rgba(255,255,255,.8);
  text-decoration: none;
  font-size: 13px;
  font-family: 'Tajawal', sans-serif;
  white-space: nowrap;
  transition: background .15s, color .15s;
  border-bottom: 1px solid rgba(255,255,255,.06);
}
.sn-dropdown-item:last-child { border-bottom: none; }
.sn-dropdown-item:hover {
  background: rgba(255,255,255,.1);
  color: #fff;
}
.sn-dropdown-item.sn-active {
  color: #d4af37;
  background: rgba(212,175,55,.12);
  font-weight: 700;
}
.sn-dropdown-item .sn-di-icon { font-size: 15px; }

/* ── Hide old elements on screen only ── */
@media screen {
  .sn-hide-screen { display: none !important; }
}

/* ── Never print the new nav ── */
@media print {
  .sn-wrapper { display: none !important; }
}
  `;

  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ── Build and inject nav ── */
  function buildNav() {
    /* Find nav select — try common patterns */
    var select = document.querySelector(
      '.nav-bar select, nav.nav-bar select, .nav-bar .dropdown select, select#navigation'
    );
    if (!select) return;

    var currentPage = window.location.pathname.split('/').pop() || 'index.html';

    /* Collect valid options */
    var options = Array.from(select.options).filter(function (o) {
      return o.value && o.value !== '#' && o.value !== '' && o.value !== '#';
    });
    if (!options.length) return;

    /* ── فلترة حسب صلاحيات المستخدم من najran_session ── */
    try {
      var _raw = Storage.prototype.getItem.call(localStorage, 'najran_session');
      var _sess = _raw ? JSON.parse(_raw) : null;
      if (_sess) {
        var _role = _sess.role || 'user';
        var _isPriv = _role === 'admin' || _role === 'supervisor' || _role === 'contract_supervisor';
        // allowedModules: null = كل الوحدات مسموح بها، مصفوفة = وحدات محددة فقط
        var _allowed = null;
        try { _allowed = _sess.allowedModules ? JSON.parse(_sess.allowedModules) : null; } catch(e) {}

        // صفحات تظهر دائماً لكل المستخدمين
        var _always = ['index.html', 'extract-archive.html', 'review_extract.html', 'monthly-overview.html'];
        // صفحات للأدمن/المشرف فقط
        var _privOnly = ['admin-dashboard.html', 'contract-foundation-upload.html'];
        // خريطة اسم الملف → مفتاح الوحدة (من modules.ts)
        var _fileKey = {
          'approval.html':                   'approval',
          'settings_main.html':              'settings_main',
          'settings_advanced.html':          'settings_advanced',
          'attendance.html':                 'attendance',
          'performance.html':                'performance',
          'achievement.html':                'achievement',
          'consumables.html':                'consumables',
          'spare_parts.html':                'spare_parts',
          'request-visit.html':              'request-visit',
          'health_centers_attendance.html':  'health_centers_attendance',
          'health_centers_consumables.html': 'health_centers_consumables',
          'admin_offices_attendance.html':   'admin_offices_attendance',
          'admin_offices_consumables.html':  'admin_offices_consumables',
        };

        options = options.filter(function(opt) {
          var file = opt.value.split('/').pop().split('?')[0];
          if (_always.indexOf(file) !== -1) return true;          // دائماً مرئي
          if (_privOnly.indexOf(file) !== -1) return _isPriv;     // للمشرفين فقط
          if (_isPriv) return true;                                // المشرف يرى الكل
          if (_allowed === null) return true;                      // بدون قيود = يرى الكل
          var key = _fileKey[file];
          if (!key) return true;                                   // ملف غير معروف → اعرضه
          return _allowed.indexOf(key) !== -1;
        });
      }
    } catch(e) {}

    /* ── Build wrapper ── */
    var wrapper = document.createElement('div');
    wrapper.className = 'sn-wrapper no-print';

    /* ── Header ── */
    var header = document.createElement('div');
    header.className = 'sn-header';

    var logo = document.createElement('img');
    logo.src = '/original/najran_health_cluster_logo.png';
    logo.alt = 'شعار تجمع نجران الصحي';
    logo.className = 'sn-logo';

    var org = document.createElement('div');
    org.className = 'sn-org';
    org.innerHTML =
      '<p class="sn-org-name">تجمع نجران الصحي</p>' +
      '<p class="sn-org-sub">وحدة الصيانة العامة — نظام إدارة المستخلصات</p>';

    /* Active tab label as page badge */
    var activeOpt = options.find(function (o) {
      return o.selected || o.value === currentPage;
    }) || options[0];
    var badgeLabel = activeOpt ? cleanLabel(activeOpt.text) : '';

    var badge = document.createElement('span');
    badge.className = 'sn-page-badge';
    badge.textContent = badgeLabel;

    header.appendChild(logo);
    header.appendChild(org);
    header.appendChild(badge);

    /* ── Tabs ── */
    var tabs = document.createElement('div');
    tabs.className = 'sn-tabs';

    options.forEach(function (opt) {
      var isActive = opt.selected || opt.value === currentPage;
      var icon = ICONS[opt.value] || '📄';
      var label = cleanLabel(opt.text);

      var tab = document.createElement('a');
      tab.href = opt.value;
      tab.className = 'sn-tab' + (isActive ? ' sn-active' : '');
      tab.innerHTML =
        '<span class="sn-icon">' + icon + '</span>' +
        '<span>' + label + '</span>';
      tabs.appendChild(tab);
    });

    wrapper.appendChild(header);
    wrapper.appendChild(tabs);

    /* ── Insert at top of body (before particles or first child) ── */
    var insertTarget = document.getElementById('particles-js-bg');
    if (insertTarget) {
      insertTarget.parentNode.insertBefore(wrapper, insertTarget.nextSibling);
    } else {
      document.body.insertBefore(wrapper, document.body.firstChild);
    }

    /* ── Hide original header-info on screen (keep for print) ── */
    var oldHeader = document.querySelector('.header-info');
    if (oldHeader) oldHeader.classList.add('sn-hide-screen');

    /* ── Hide original nav-bar on screen ── */
    var navBar = select.closest('nav.nav-bar') || select.closest('.nav-bar') || select.parentElement;
    if (navBar) navBar.classList.add('sn-hide-screen');

    /* ── Also hide any wrapping <header> that has no-print class ── */
    var parentHeader = select.closest('header.no-print');
    if (parentHeader) parentHeader.classList.add('sn-hide-screen');
  }

  /* Strip emojis and leading/trailing spaces from option text */
  function cleanLabel(text) {
    return text
      .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}✅]/gu, '')
      .replace(/[^\u0600-\u06FF\u0750-\u077F\s\w]/g, '')
      .replace(/^\s*[-–—]\s*|\s*[-–—]\s*$/g, '')
      .trim();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildNav);
  } else {
    buildNav();
  }
})();
