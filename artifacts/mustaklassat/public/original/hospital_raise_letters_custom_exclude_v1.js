// Hospital Raise Letters Custom Exclude V2
// Scope: hospital_raise_letters.html only.
// Excludes custom letter from packet/print-all output. Custom still prints when selected alone.
// Important: do not wipe index rows when removing the custom row.
(function () {
  'use strict';

  if (!/hospital_raise_letters\.html/.test(location.pathname) && !window.__HOSPITAL_LETTERS_STANDALONE_PAGE__) return;
  if (window.__HOSPITAL_RAISE_LETTERS_CUSTOM_EXCLUDE_V2__) return;
  window.__HOSPITAL_RAISE_LETTERS_CUSTOM_EXCLUDE_V2__ = true;

  function removeCustomRowOnly(html) {
    return String(html || '').replace(/<tr\b[\s\S]*?<\/tr>/g, function (row) {
      return /خطاب\s+مخصص/.test(row) ? '' : row;
    });
  }

  function removeCustomPageOnly(html) {
    return String(html || '').replace(/<section class="page">[\s\S]*?<\/section>/g, function (section) {
      if (/class="title"[^>]*>\s*خطاب\s+مخصص\s*<\/div>/.test(section)) return '';
      if (/الموضوع:\s*خطاب\s+مخصص/.test(section)) return '';
      return section;
    });
  }

  function removeCustomFromPacket(html) {
    html = String(html || '');
    var pageCount = (html.match(/<section class="page">/g) || []).length;
    if (pageCount <= 1) return html;

    html = removeCustomRowOnly(html);
    html = removeCustomPageOnly(html);
    return html;
  }

  function wrapWindowOpen() {
    if (window.__HOSPITAL_RAISE_LETTERS_CUSTOM_EXCLUDE_OPEN_WRAPPED_V2__) return;
    window.__HOSPITAL_RAISE_LETTERS_CUSTOM_EXCLUDE_OPEN_WRAPPED_V2__ = true;
    var oldOpen = window.open;
    window.open = function () {
      var win = oldOpen.apply(window, arguments);
      try {
        if (win && win.document && !win.__hospitalRaiseCustomExcludeWriteWrappedV2) {
          win.__hospitalRaiseCustomExcludeWriteWrappedV2 = true;
          var oldWrite = win.document.write.bind(win.document);
          win.document.write = function (html) {
            return oldWrite(removeCustomFromPacket(html));
          };
        }
      } catch (_) {}
      return win;
    };
  }

  wrapWindowOpen();
  console.info('[Hospital Raise Letters Custom Exclude] installed v2 safe index rows');
})();
