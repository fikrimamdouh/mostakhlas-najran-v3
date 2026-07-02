// Hospital Raise Letters Official Text Cleaner V1
// Scope: hospital_raise_letters.html only.
// Removes explanatory/meta descriptions from official printable documents and saved settings.
(function () {
  'use strict';

  if (!/hospital_raise_letters\.html/.test(location.pathname) && !window.__HOSPITAL_LETTERS_STANDALONE_PAGE__) return;
  if (window.__HOSPITAL_RAISE_LETTERS_OFFICIAL_TEXT_CLEANER_V1__) return;
  window.__HOSPITAL_RAISE_LETTERS_OFFICIAL_TEXT_CLEANER_V1__ = true;

  var KEY = 'hospitalRaiseLettersSettings_v8';
  var BAD_PATTERNS = [
    /يتضمن\s+هذا\s+الفهرس/i,
    /لاستخدامه\s+كغلاف\s+تنظيمي/i,
    /غلاف\s+تنظيمي/i,
    /الحزمة\s+الرسمية/i,
    /شرح\s+تعريفي/i,
    /الشروحات\s+التعريفية/i
  ];

  function readJson(k, fallback) {
    try { var raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }
  function writeJson(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v || {})); return true; } catch (_) { return false; }
  }
  function hasBadText(v) {
    v = String(v || '');
    return BAD_PATTERNS.some(function (re) { return re.test(v); });
  }
  function cleanText(v) {
    return hasBadText(v) ? '' : v;
  }

  function cleanSettings(reason) {
    var s = readJson(KEY, {});
    if (!s || !s.texts) return false;
    var changed = false;

    Object.keys(s.texts).forEach(function (docKey) {
      var t = s.texts[docKey] || {};
      ['body', 'close', 'note'].forEach(function (field) {
        if (hasBadText(t[field])) {
          t[field] = cleanText(t[field]);
          changed = true;
        }
      });
    });

    if (s.texts.index) {
      if (hasBadText(s.texts.index.body)) {
        s.texts.index.body = '';
        changed = true;
      }
      if (hasBadText(s.texts.index.close)) {
        s.texts.index.close = '';
        changed = true;
      }
      if (hasBadText(s.texts.index.note)) {
        s.texts.index.note = '';
        changed = true;
      }
    }

    if (changed) {
      writeJson(KEY, s);
      try { localStorage.setItem('hospitalRaiseLettersOfficialTextCleaner_v1_ts', String(Date.now())); } catch (_) {}
      console.warn('[Hospital Raise Letters Official Text Cleaner] removed explanatory text:', reason || 'clean');
    }
    return changed;
  }

  function patchDocumentWrite() {
    if (window.__HOSPITAL_RAISE_LETTERS_OFFICIAL_TEXT_CLEANER_WRITE_PATCHED__) return;
    window.__HOSPITAL_RAISE_LETTERS_OFFICIAL_TEXT_CLEANER_WRITE_PATCHED__ = true;
    var oldOpen = window.open;
    window.open = function () {
      var win = oldOpen.apply(window, arguments);
      try {
        if (win && win.document && !win.__hospitalOfficialTextCleanerPatched) {
          win.__hospitalOfficialTextCleanerPatched = true;
          var oldWrite = win.document.write.bind(win.document);
          win.document.write = function (html) {
            html = String(html || '')
              .replace(/يتضمن\s+هذا\s+الفهرس[\s\S]*?الحزمة\s+الرسمية\.?/g, '')
              .replace(/لاستخدامه\s+كغلاف\s+تنظيمي[\s\S]*?الحزمة\s+الرسمية\.?/g, '')
              .replace(/غلاف\s+تنظيمي/g, '')
              .replace(/الحزمة\s+الرسمية/g, '');
            return oldWrite(html);
          };
        }
      } catch (_) {}
      return win;
    };
  }

  function refreshPreview() {
    try {
      var el = document.querySelector('#hrl [data-f="selected"]');
      if (el) el.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (_) {}
  }

  cleanSettings('initial');
  patchDocumentWrite();
  setTimeout(function () { if (cleanSettings('t500')) refreshPreview(); }, 500);
  setTimeout(function () { if (cleanSettings('t1500')) refreshPreview(); }, 1500);
  window.HospitalRaiseLettersOfficialTextCleaner = { clean: cleanSettings };

  console.info('[Hospital Raise Letters Official Text Cleaner] installed v1');
})();
