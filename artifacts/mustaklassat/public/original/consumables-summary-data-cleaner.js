// Consumables Summary Data Cleaner
// Scope: normal consumables.html only.
// Removes accidental total/net-payable rows saved as normal summary items.
// Also loads hospital consumables letters center, settings fix, hard standalone settings route guard, settings deep link, print polish, and letterhead storage guard for normal hospital consumables only.
(function () {
  'use strict';

  var CACHE_MARKER = '20260704_v14_consumables_letter_signature_bridge';
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
    loadScriptFresh('hospital-consumables-raise-letter-js', '/original/hospital_consumables_raise_letter.js?v=20260704_v14_signature_bridge');
    setTimeout(function () {
      loadScriptFresh('hospital-consumables-letterhead-storage-guard-js', '/original/hospital_consumables_letterhead_storage_guard_v1.js?v=20260702_v2_fallback_letterhead_key');
    }, 60);
    setTimeout(function () {
      loadScriptFresh('hospital-consumables-settings-fix-js', '/original/hospital_consumables_settings_fix_v6.js?v=20260702_v9_consumables_letterhead_like_labor');
    }, 80);
    setTimeout(function () {
      loadScriptFresh('hospital-consumables-settings-route-guard-js', '/original/hospital_consumables_settings_route_guard_v7.js?v=20260702_v11_fallback_letterhead_route');
    }, 100);
    setTimeout(function () {
      loadScriptFresh('hospital-consumables-settings-deeplink-js', '/original/hospital_consumables_settings_deeplink_v1.js?v=20260702_v3_consumables_a4_letterhead_print');
    }, 140);
    setTimeout(function () {
      loadScriptFresh('hospital-consumables-print-polish-js', '/original/hospital_consumables_print_polish_v6.js?v=20260702_v9_fallback_letterhead_print');
    }, 200);
  }

  function installConsumablesLetterSignatureBridge() {
    try {
      if (window.__HOSPITAL_CONSUMABLES_LETTER_SIGNATURE_BRIDGE_V14__) return;
      window.__HOSPITAL_CONSUMABLES_LETTER_SIGNATURE_BRIDGE_V14__ = true;

      var LETTER_SETTINGS_KEY = 'hospitalConsumablesRaiseLettersSettings_v1';
      var LEGACY_SIGNATURES_KEY = 'signatures_data_consumables_v27';
      var DEFAULT_NOPREV_TITLES = ['الموظف المختص', 'مدير الإدارة'];
      var forceLegacySyncUntil = 0;
      var originalSetItem = localStorage.setItem.bind(localStorage);

      function clean(v) {
        return String(v == null ? '' : v).replace(/[\u200e\u200f]/g, '').replace(/\s+/g, ' ').trim();
      }

      function readJson(key, fallback) {
        try {
          var raw = localStorage.getItem(key);
          return raw ? JSON.parse(raw) : fallback;
        } catch (_) {
          return fallback;
        }
      }

      function compactSignatures(arr) {
        if (!Array.isArray(arr)) return [];
        return arr
          .map(function (s) { return { title: clean(s && s.title), name: clean(s && s.name) }; })
          .filter(function (s) { return s.title || s.name; });
      }

      function pickLegacySignatures(legacy) {
        legacy = legacy && typeof legacy === 'object' ? legacy : {};
        var candidates = [legacy.noPrev, legacy.summary, legacy.subcontractors, legacy.performance, legacy.water, legacy.sewage];
        for (var i = 0; i < candidates.length; i++) {
          var sigs = compactSignatures(candidates[i]);
          if (sigs.length) return sigs;
        }
        return [];
      }

      function noPrevIsBlankOrDefault(sigs) {
        sigs = Array.isArray(sigs) ? sigs : [];
        if (!sigs.length) return true;
        var hasNames = sigs.some(function (s) { return clean(s && s.name); });
        if (!hasNames) return true;
        if (sigs.length !== DEFAULT_NOPREV_TITLES.length) return false;
        return sigs.every(function (s, i) {
          return clean(s && s.title) === DEFAULT_NOPREV_TITLES[i] && !clean(s && s.name);
        });
      }

      function ensureLetterShape(s) {
        s = s && typeof s === 'object' ? s : {};
        s.letters = s.letters && typeof s.letters === 'object' ? s.letters : {};
        s.letters.noPrev = s.letters.noPrev && typeof s.letters.noPrev === 'object' ? s.letters.noPrev : {};
        if (!clean(s.letters.noPrev.title)) s.letters.noPrev.title = 'إقرار بعدم أسبقية الصرف';
        if (!clean(s.letters.noPrev.body)) s.letters.noPrev.body = 'تشهد إدارة / {hospital} بأن استحقاق شركة / {company} لمستخلص المستهلكات ومقاولي الباطن دفعة رقم ({paymentNo}) بمبلغ ({grand} ريال).\n\nلم يسبق صرف هذا المستخلص من قبلنا.';
        if (!clean(s.letters.noPrev.closing)) s.letters.noPrev.closing = 'مع أطيب تحياتي ،،،';
        if (!s.letters.noPrev.showDate) s.letters.noPrev.showDate = 'yes';
        if (!s.letters.noPrev.showStamp) s.letters.noPrev.showStamp = 'yes';
        return s;
      }

      function syncLegacyToNoPrev(reason, force) {
        try {
          var legacy = readJson(LEGACY_SIGNATURES_KEY, {});
          var mapped = pickLegacySignatures(legacy);
          if (!mapped.length) return false;

          var settings = ensureLetterShape(readJson(LETTER_SETTINGS_KEY, {}));
          var existing = settings.letters.noPrev.signatures || [];
          if (!force && !noPrevIsBlankOrDefault(existing)) return false;

          settings.version = settings.version || 'hospital-consumables-letters-v6';
          settings.letters.noPrev.signatures = mapped;
          settings.__signatureBridge = {
            source: LEGACY_SIGNATURES_KEY,
            target: 'letters.noPrev.signatures',
            reason: reason || 'auto',
            syncedAt: new Date().toISOString()
          };
          originalSetItem(LETTER_SETTINGS_KEY, JSON.stringify(settings));
          console.warn('[HospitalConsumablesSignatureBridge] synced legacy signatures to noPrev:', reason || 'auto');
          return true;
        } catch (e) {
          console.warn('[HospitalConsumablesSignatureBridge] sync failed:', e);
          return false;
        }
      }

      function markLegacySignatureSave() {
        forceLegacySyncUntil = Date.now() + 2500;
      }

      localStorage.setItem = function (key, value) {
        var result = originalSetItem.apply(localStorage, arguments);
        try {
          if (String(key) === LEGACY_SIGNATURES_KEY) {
            var force = Date.now() <= forceLegacySyncUntil;
            setTimeout(function () { syncLegacyToNoPrev(force ? 'legacy-signature-editor-save' : 'legacy-setItem', force); }, 0);
          }
        } catch (_) {}
        return result;
      };

      document.addEventListener('click', function (e) {
        var target = e.target && e.target.closest && e.target.closest('#save-signatures-btn,#sb-save-btn');
        if (!target) return;
        if (target.id === 'save-signatures-btn' || document.getElementById('sb-consumables-cert')) markLegacySignatureSave();
      }, true);

      function relabelLegacySignatureButton() {
        try {
          var btn = document.getElementById('edit-signatures-btn');
          if (!btn || btn.__hcLegacySignatureLabelV14) return;
          btn.__hcLegacySignatureLabelV14 = true;
          btn.title = 'هذا الزر يعدل تواقيع جداول المستهلكات فقط. تواقيع الخطابات من زر خطابات المستهلكات.';
          btn.innerHTML = '<i class="fas fa-signature"></i> تواقيع جداول المستهلكات';
        } catch (_) {}
      }

      relabelLegacySignatureButton();
      setTimeout(relabelLegacySignatureButton, 500);
      setTimeout(relabelLegacySignatureButton, 1500);
      setTimeout(function () { syncLegacyToNoPrev('boot-if-letter-signature-empty', false); }, 1200);
    } catch (e) {
      console.warn('[HospitalConsumablesSignatureBridge] install failed:', e);
    }
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
        location.href = '/original/hospital_consumables_letters_settings.html?v=20260704_v14_signature_bridge&t=' + Date.now();
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
  installConsumablesLetterSignatureBridge();
  ensureConsumablesLettersButton('immediate');
  cleanSummaryData('immediate');
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      cleanSummaryData('domcontentloaded');
      loadHospitalConsumablesRaiseLetter();
      installConsumablesLetterSignatureBridge();
      ensureConsumablesLettersButton('domcontentloaded');
    });
  } else {
    cleanSummaryData('ready');
    loadHospitalConsumablesRaiseLetter();
    installConsumablesLetterSignatureBridge();
    ensureConsumablesLettersButton('ready');
  }
  setTimeout(function () { cleanSummaryData('late-500'); loadHospitalConsumablesRaiseLetter(); installConsumablesLetterSignatureBridge(); ensureConsumablesLettersButton('late-500'); }, 500);
  setTimeout(function () { cleanSummaryData('late-1500'); loadHospitalConsumablesRaiseLetter(); installConsumablesLetterSignatureBridge(); ensureConsumablesLettersButton('late-1500'); }, 1500);
  setTimeout(function () { loadHospitalConsumablesRaiseLetter(); installConsumablesLetterSignatureBridge(); ensureConsumablesLettersButton('late-3000'); }, 3000);
  console.info('[ConsumablesSummaryCleaner] cache marker:', CACHE_MARKER);
})();