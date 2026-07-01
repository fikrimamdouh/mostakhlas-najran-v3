// Hospital Consumables Settings Route Guard V8
// Scope: normal consumables.html only.
// Routes consumables letters settings button to the standalone consumables settings page.
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
  if (window.__HOSPITAL_CONSUMABLES_SETTINGS_ROUTE_GUARD_V8__) return;
  window.__HOSPITAL_CONSUMABLES_SETTINGS_ROUTE_GUARD_V8__ = true;

  var SETTINGS_URL = '/original/hospital_consumables_letters_settings.html?v=20260702_v2_form';

  function clean(v) {
    return String(v || '').replace(/[\u200e\u200f]/g, '').replace(/\s+/g, ' ').trim();
  }

  function isConsumablesSettingsTrigger(el) {
    if (!el) return false;
    var node = el.closest && el.closest('a,button,[role="button"],[data-hc-action],#hospital-consumables-raise-letter-settings-btn');
    if (!node) return false;

    var text = clean(node.innerText || node.textContent || node.getAttribute('aria-label') || node.title || '');
    var href = clean(node.getAttribute && (node.getAttribute('href') || node.getAttribute('data-href') || ''));
    var action = clean(node.getAttribute && (node.getAttribute('data-hc-action') || ''));
    var id = clean(node.id || '');
    var center = node.closest && node.closest('#hospital-consumables-letters-center,.hospital-consumables-letters-center');

    if (action === 'settings') return true;
    if (id === 'hospital-consumables-raise-letter-settings-btn') return true;
    if (/إعدادات\s+خطابات\s+(رفع\s+)?المستهلكات/.test(text)) return true;
    if (center && /إعدادات/.test(text) && /مستهلكات/.test((center.innerText || center.textContent || ''))) return true;
    if (/hospital_raise_letters\.html/.test(href) && (/مستهلكات/.test(text) || center)) return true;

    return false;
  }

  function goSettings() {
    location.href = SETTINGS_URL;
  }

  document.addEventListener('click', function (e) {
    if (!isConsumablesSettingsTrigger(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    goSettings();
  }, true);

  function neutralizeBadLinks() {
    try {
      document.querySelectorAll('a,button,[role="button"]').forEach(function (node) {
        if (!isConsumablesSettingsTrigger(node)) return;
        if (node.tagName === 'A') {
          node.dataset.originalHref = node.getAttribute('href') || '';
          node.setAttribute('href', SETTINGS_URL);
        }
        node.onclick = function (e) {
          e.preventDefault();
          e.stopPropagation();
          goSettings();
          return false;
        };
      });
    } catch (_) {}
  }

  setTimeout(neutralizeBadLinks, 200);
  setTimeout(neutralizeBadLinks, 700);
  setTimeout(neutralizeBadLinks, 1500);
  setTimeout(neutralizeBadLinks, 3000);

  console.info('[Hospital Consumables Settings Route Guard] installed v8 standalone settings page');
})();
