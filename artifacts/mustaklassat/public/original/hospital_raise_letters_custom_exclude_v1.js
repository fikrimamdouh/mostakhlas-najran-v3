// Hospital Raise Letters Custom Exclude V1
// Scope: hospital_raise_letters.html only.
// Excludes custom letter from packet/print-all output. Custom still prints when selected alone.
(function () {
  'use strict';

  if (!/hospital_raise_letters\.html/.test(location.pathname) && !window.__HOSPITAL_LETTERS_STANDALONE_PAGE__) return;
  if (window.__HOSPITAL_RAISE_LETTERS_CUSTOM_EXCLUDE_V1__) return;
  window.__HOSPITAL_RAISE_LETTERS_CUSTOM_EXCLUDE_V1__ = true;

  function removeCustomFromPacket(html) {
    html = String(html || '');
    var pageCount = (html.match(/<section class="page">/g) || []).length;
    if (pageCount <= 1) return html;

    // Remove custom document row from the index table only.
    html = html.replace(/<tr>[\s\S]*?خطاب مخصص[\s\S]*?<\/tr>/g, '');

    // Remove only the custom document page, not the index page.
    html = html.replace(/<section class="page">[\s\S]*?<\/section>/g, function (section) {
      if (/class="title"[^>]*>\s*خطاب مخصص\s*<\/div>/.test(section) || /الموضوع:\s*خطاب مخصص/.test(section)) return '';
      return section;
    });

    return html;
  }

  function wrapWindowOpen() {
    if (window.__HOSPITAL_RAISE_LETTERS_CUSTOM_EXCLUDE_OPEN_WRAPPED__) return;
    window.__HOSPITAL_RAISE_LETTERS_CUSTOM_EXCLUDE_OPEN_WRAPPED__ = true;
    var oldOpen = window.open;
    window.open = function () {
      var win = oldOpen.apply(window, arguments);
      try {
        if (win && win.document && !win.__hospitalRaiseCustomExcludeWriteWrapped) {
          win.__hospitalRaiseCustomExcludeWriteWrapped = true;
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
  console.info('[Hospital Raise Letters Custom Exclude] installed v1');
})();
