// Hospital Consumables Settings Deep Link V1
// Opens consumables letters settings modal directly when URL contains openConsumablesLettersSettings=1
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

  var params;
  try { params = new URLSearchParams(location.search || ''); } catch (_) { params = null; }
  var shouldOpen = params && (
    params.get('openConsumablesLettersSettings') === '1' ||
    params.get('openConsumablesLetters') === '1' ||
    params.get('lettersSettings') === 'consumables'
  );
  if (!shouldOpen) return;
  if (window.__HOSPITAL_CONSUMABLES_SETTINGS_DEEPLINK_OPENED_V1__) return;
  window.__HOSPITAL_CONSUMABLES_SETTINGS_DEEPLINK_OPENED_V1__ = true;

  function openSettings() {
    try {
      if (document.getElementById('hc-cons-settings-modal')) return true;
      if (window.HospitalConsumablesRaiseLetter && typeof window.HospitalConsumablesRaiseLetter.openDialog === 'function') {
        window.HospitalConsumablesRaiseLetter.openDialog();
        return true;
      }
      var btn = document.querySelector('[data-hc-action="settings"],#hospital-consumables-raise-letter-settings-btn');
      if (btn) {
        btn.click();
        return !!document.getElementById('hc-cons-settings-modal');
      }
    } catch (_) {}
    return false;
  }

  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    if (openSettings() || tries >= 30) clearInterval(timer);
  }, 250);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(openSettings, 200); });
  } else {
    setTimeout(openSettings, 200);
  }

  console.info('[Hospital Consumables Settings Deep Link] active');
})();
