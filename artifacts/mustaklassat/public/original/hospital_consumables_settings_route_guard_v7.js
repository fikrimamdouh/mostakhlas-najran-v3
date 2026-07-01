// Hospital Consumables Settings Route Guard V10
// Scope: normal consumables.html only.
// Forces the consumables letters settings button to the standalone autosave settings page.
(function () {
  'use strict';

  var sig = location.pathname + location.search;
  var pageFile = '';
  try {
    pageFile = new URLSearchParams(location.search || '').get('page') || '';
    pageFile = pageFile ? pageFile.split('/').pop() : (location.pathname || '').split('/').pop();
  } catch (_) {
    pageFile = (location.pathname || '').split('/').pop();
  }

  if (pageFile !== 'consumables.html' && !/\/original\/consumables\.html(?:$|[?#])/.test(sig)) return;
  if (/admin_offices_consumables\.html|health_centers_consumables\.html|najran_general_consumables\.html/.test(pageFile)) return;
  if (window.__HOSPITAL_CONSUMABLES_SETTINGS_ROUTE_GUARD_V10__) return;
  window.__HOSPITAL_CONSUMABLES_SETTINGS_ROUTE_GUARD_V10__ = true;

  var SETTINGS_URL = '/original/hospital_consumables_letters_settings.html?v=20260702_v3_autosave_signatures';

  function clean(v) {
    return String(v || '').replace(/[\u200e\u200f]/g, '').replace(/\s+/g, ' ').trim();
  }

  function getNode(el) {
    if (!el || !el.closest) return null;
    return el.closest('a,button,[role="button"],[data-hc-action],#hospital-consumables-raise-letter-settings-btn,.hc-primary');
  }

  function isConsumablesSettingsTrigger(el) {
    var node = getNode(el);
    if (!node) return false;

    var text = clean(node.innerText || node.textContent || node.getAttribute('aria-label') || node.title || '');
    var href = clean(node.getAttribute && (node.getAttribute('href') || node.getAttribute('data-href') || ''));
    var action = clean(node.getAttribute && (node.getAttribute('data-hc-action') || ''));
    var id = clean(node.id || '');
    var center = node.closest && node.closest('#hospital-consumables-letters-center,.hospital-consumables-letters-center');
    var centerText = clean(center && (center.innerText || center.textContent || ''));

    if (action === 'settings') return true;
    if (id === 'hospital-consumables-raise-letter-settings-btn') return true;
    if (/إعدادات\s+خطابات\s+(رفع\s+)?المستهلكات/.test(text)) return true;
    if (center && /إعدادات/.test(text) && /مستهلكات/.test(centerText)) return true;
    if (/hospital_raise_letters\.html/.test(href) && (/مستهلكات/.test(text) || center)) return true;

    return false;
  }

  function goSettings() {
    try { sessionStorage.setItem('lastConsumablesSettingsRouteGuard', String(Date.now())); } catch (_) {}
    location.assign(SETTINGS_URL);
  }

  function hardStop(e) {
    if (!isConsumablesSettingsTrigger(e.target)) return;
    try { e.preventDefault(); } catch (_) {}
    try { e.stopPropagation(); } catch (_) {}
    try { e.stopImmediatePropagation(); } catch (_) {}
    goSettings();
    return false;
  }

  ['pointerdown', 'mousedown', 'touchstart', 'click'].forEach(function (type) {
    try { window.addEventListener(type, hardStop, true); } catch (_) {}
    try { document.addEventListener(type, hardStop, true); } catch (_) {}
    try { document.documentElement.addEventListener(type, hardStop, true); } catch (_) {}
  });

  function neutralizeBadLinks() {
    try {
      document.querySelectorAll('a,button,[role="button"],[data-hc-action],.hc-primary').forEach(function (node) {
        if (!isConsumablesSettingsTrigger(node)) return;
        node.setAttribute('data-consumables-settings-standalone', '1');
        if (node.tagName === 'A') {
          node.dataset.originalHref = node.getAttribute('href') || '';
          node.setAttribute('href', SETTINGS_URL);
        }
        node.onclick = function (e) {
          try { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); } catch (_) {}
          goSettings();
          return false;
        };
      });
    } catch (_) {}
  }

  neutralizeBadLinks();
  setInterval(neutralizeBadLinks, 900);

  try {
    var mo = new MutationObserver(neutralizeBadLinks);
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } catch (_) {}

  window.openConsumablesLettersStandaloneSettings = goSettings;
  console.info('[Hospital Consumables Settings Route Guard] installed v10 hard standalone route');
})();
