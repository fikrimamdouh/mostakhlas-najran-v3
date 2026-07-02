// Consumables Summary Data Cleaner
// Scope: normal consumables.html only.
// Removes accidental total/net-payable rows saved as normal summary items.
// Also loads hospital consumables letters center, settings fix, hard standalone settings route guard, settings deep link, and print polish for normal hospital consumables only.
(function () {
  'use strict';

  var CACHE_MARKER = '20260702_v8_consumables_a4_letterhead_print';
  try { window.__CONSUMABLES_SUMMARY_CLEANER_CACHE_MARKER = CACHE_MARKER; } catch (_) {}

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

  function loadScriptFresh(id, src) {
    try {
      var old = document.getElementById(id);
      if (old && old.getAttribute('data-cache-marker') === CACHE_MARKER) return;
      if (old) old.remove();
      var s = document.createElement('script');
      s.id = id;
      s.src = src;
      s.defer = false;
      s.setAttribute('data-cache-marker', CACHE_MARKER);
      document.head.appendChild(s);
    } catch (_) {}
  }

  function loadHospitalConsumablesRaiseLetter() {
    loadScriptFresh('hospital-consumables-raise-letter-js', '/original/hospital_consumables_raise_letter.js?v=20260702_v8_consumables_a4_letterhead_print');
    setTimeout(function () {
      loadScriptFresh('hospital-consumables-settings-fix-js', '/original/hospital_consumables_settings_fix_v6.js?v=20260702_v8_consumables_a4_letterhead_print');
    }, 80);
    setTimeout(function () {
      loadScriptFresh('hospital-consumables-settings-route-guard-js', '/original/hospital_consumables_settings_route_guard_v7.js?v=20260702_v13_consumables_a4_letterhead_print');
    }, 100);
    setTimeout(function () {
      loadScriptFresh('hospital-consumables-settings-deeplink-js', '/original/hospital_consumables_settings_deeplink_v1.js?v=20260702_v3_consumables_a4_letterhead_print');
    }, 140);
    setTimeout(function () {
      loadScriptFresh('hospital-consumables-print-polish-js', '/original/hospital_consumables_print_polish_v6.js?v=20260702_v8_consumables_a4_letterhead_print');
    }, 200);
  }

  function ensureConsumablesLettersButton(reason) {
    try {
      var bar = document.querySelector('.std-action-bar');
      if (!bar) return false;

      var btn = document.getElementById('hospital-consumables-raise-letter-settings-btn');
      if (!btn) {
        btn = document.createElement('button');
        btn.className = 'ab ab-sig';
        btn.id = 'hospital-consumables-raise-letter-settings-btn';
        btn.setAttribute('data-hc-action', 'settings');
        btn.innerHTML = '<i class="fas fa-file-signature"></i> خطابات المستهلكات';

        var printBtn = document.getElementById('print-all-btn');
        if (printBtn && printBtn.parentNode) printBtn.insertAdjacentElement('afterend', btn);
        else bar.appendChild(btn);
      }

      btn.onclick = function (e) {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
          if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        }
        location.href = '/original/hospital_consumables_letters_settings.html?v=20260702_v8_consumables_a4_letterhead_print&t=' + Date.now();
        return false;
      };

      btn.style.display = '';
      btn.style.visibility = '';
      console.warn('[HospitalConsumablesLettersButton] ensured:', reason || 'run', CACHE_MARKER);
      return true;
    } catch (e) {
      console.warn('[HospitalConsumablesLettersButton] failed:', e);
      return false;
    }
  }

  var DB_VERSION = 'consumables_v27';
  var SUMMARY_KEY = 'summary_data_' + DB_VERSION;
  var BACKUP_PREFIX = SUMMARY_KEY + '_dirty_backup_';
  var MARKER_KEY = SUMMARY_KEY + '_cleaner_last_run_v1';

  var badPatterns = [
    /إجمالي/i,
    /الإجمالي/i,
    /اجمالي/i,
    /اجمالى/i,
    /الإجم/i,
    /الصافي/i,
    /صافى/i,
    /صافي/i,
    /المستحق/i,
    /المستحق\s+للمقاول/i,
    /فقط\s+وقدره/i,
    /لا\s+غير/i
  ];

  function isDirtyNormalSummaryItem(item) {
    if (!item || typeof item !== 'object') return false;
    if (item.isSubTotal || item.isCustom) return false;
    var name = String(item.name || '').trim();
    if (!name) return false;
    return badPatterns.some(function (re) { return re.test(name); });
  }

  function cleanSummaryData(reason) {
    try {
      var raw = localStorage.getItem(SUMMARY_KEY);
      if (!raw) return false;

      var data = JSON.parse(raw);
      if (!Array.isArray(data) || !data.length) return false;

      var dirty = data.filter(isDirtyNormalSummaryItem);
      if (!dirty.length) return false;

      var cleaned = data.filter(function (item) { return !isDirtyNormalSummaryItem(item); });
      localStorage.setItem(BACKUP_PREFIX + new Date().toISOString(), raw);
      localStorage.setItem(SUMMARY_KEY, JSON.stringify(cleaned));
      localStorage.setItem(MARKER_KEY, JSON.stringify({
        cleanedAt: new Date().toISOString(),
        reason: reason || 'boot',
        removed: dirty.map(function (item) { return { id: item.id || '', name: item.name || '', value: item.value || 0 }; })
      }));

      console.warn('[ConsumablesSummaryCleaner] removed dirty summary rows:', dirty.map(function (x) { return x.name; }));
      return true;
    } catch (e) {
      console.error('[ConsumablesSummaryCleaner] failed:', e);
      return false;
    }
  }

  loadHospitalConsumablesRaiseLetter();
  ensureConsumablesLettersButton('immediate');
  cleanSummaryData('immediate');
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      cleanSummaryData('domcontentloaded');
      loadHospitalConsumablesRaiseLetter();
      ensureConsumablesLettersButton('domcontentloaded');
    });
  } else {
    cleanSummaryData('ready');
    loadHospitalConsumablesRaiseLetter();
    ensureConsumablesLettersButton('ready');
  }
  setTimeout(function () { cleanSummaryData('late-500'); loadHospitalConsumablesRaiseLetter(); ensureConsumablesLettersButton('late-500'); }, 500);
  setTimeout(function () { cleanSummaryData('late-1500'); loadHospitalConsumablesRaiseLetter(); ensureConsumablesLettersButton('late-1500'); }, 1500);
  setTimeout(function () { loadHospitalConsumablesRaiseLetter(); ensureConsumablesLettersButton('late-3000'); }, 3000);
  console.info('[ConsumablesSummaryCleaner] cache marker:', CACHE_MARKER);
})();
