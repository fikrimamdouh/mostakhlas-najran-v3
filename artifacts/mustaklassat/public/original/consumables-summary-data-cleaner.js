// Consumables Summary Data Cleaner
// Scope: normal consumables.html only.
// Removes accidental total/net-payable rows saved as normal summary items.
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

  cleanSummaryData('immediate');
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { cleanSummaryData('domcontentloaded'); });
  } else {
    cleanSummaryData('ready');
  }
  setTimeout(function () { cleanSummaryData('late-500'); }, 500);
  setTimeout(function () { cleanSummaryData('late-1500'); }, 1500);
})();
