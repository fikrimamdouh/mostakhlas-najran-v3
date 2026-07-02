// Hospital Raise Letters Signature Bounds Fix V1
// Scope: hospital_raise_letters.html only.
// Keeps large labor/raise letter signatures inside A4 page and prevents long titles from pushing signatures outside the page.
(function () {
  'use strict';

  if (!/hospital_raise_letters\.html/.test(location.pathname) && !window.__HOSPITAL_LETTERS_STANDALONE_PAGE__) return;
  if (window.__HOSPITAL_RAISE_LETTERS_SIGNATURE_BOUNDS_FIX_V1__) return;
  window.__HOSPITAL_RAISE_LETTERS_SIGNATURE_BOUNDS_FIX_V1__ = true;

  function css() {
    return '<style id="hospital-raise-signature-bounds-fix-v1">' +
      'body.hrl-polished .sig-grid{display:grid!important;width:100%!important;max-width:180mm!important;margin-right:auto!important;margin-left:auto!important;box-sizing:border-box!important;align-items:start!important;justify-content:center!important;gap:12mm!important}' +
      'body.hrl-polished .sig-left{box-sizing:border-box!important;max-width:62mm!important;width:100%!important;margin-right:auto!important;margin-left:auto!important;text-align:center!important;white-space:normal!important;overflow:visible!important}' +
      'body.hrl-polished .sig-role,body.hrl-polished .sig-name{white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important;max-width:100%!important;line-height:1.18!important}' +
      'body.hrl-polished .sig-role{font-size:11.2pt!important}' +
      'body.hrl-polished .sig-name{font-size:10.8pt!important}' +
      'body.hrl-polished .sig-line{width:auto!important;min-width:30mm!important;max-width:50mm!important;margin-right:auto!important;margin-left:auto!important}' +
      'body.hrl-polished .content,body.hrl-polished .letter-content{overflow:hidden!important;box-sizing:border-box!important}' +
      'body.hrl-polished .page{overflow:hidden!important}' +
      'body.hrl-polished .saudi-names-page .sig-grid{max-width:180mm!important;gap:18mm!important}' +
      'body.hrl-polished .saudi-names-page .sig-left{max-width:62mm!important}' +
      '</style>';
  }

  function applyToDoc(doc) {
    try {
      if (!doc || !doc.head || doc.getElementById('hospital-raise-signature-bounds-fix-v1')) return false;
      doc.head.insertAdjacentHTML('beforeend', css());
      try { doc.body.classList.add('hrl-polished'); } catch (_) {}
      return true;
    } catch (_) { return false; }
  }

  function transform(html) {
    html = String(html || '');
    if (!/خطابات رفع المستخلص العادي|خطاب العمالة|بيان السعودة|بيان أسماء السعوديين|بيان الشواغر|بيان الإجازات|بيان الغياب|شهادة تسليم الرواتب|عدم أسبقية الصرف|خطاب الرفع النهائي/.test(html)) return html;
    if (html.indexOf('hospital-raise-signature-bounds-fix-v1') >= 0) return html;
    if (html.indexOf('</head>') >= 0) html = html.replace('</head>', css() + '</head>');
    if (!/<body[^>]*class="[^"]*hrl-polished/.test(html)) html = html.replace(/<body([^>]*)>/i, '<body$1 class="hrl-polished">');
    return html;
  }

  function wrapWindowOpen() {
    if (window.__HOSPITAL_RAISE_SIGNATURE_BOUNDS_OPEN_WRAPPED_V1__) return;
    window.__HOSPITAL_RAISE_SIGNATURE_BOUNDS_OPEN_WRAPPED_V1__ = true;
    var oldOpen = window.open;
    window.open = function () {
      var win = oldOpen.apply(window, arguments);
      try {
        if (win && win.document && !win.__hospitalRaiseSignatureBoundsWrappedV1) {
          win.__hospitalRaiseSignatureBoundsWrappedV1 = true;
          var oldWrite = win.document.write.bind(win.document);
          win.document.write = function (html) {
            var result = oldWrite(transform(html));
            setTimeout(function () { try { applyToDoc(win.document); } catch (_) {} }, 80);
            return result;
          };
        }
      } catch (_) {}
      return win;
    };
  }

  function patchPreview() {
    try {
      var f = document.getElementById('prev');
      if (!f || !f.srcdoc) return;
      var fixed = transform(f.srcdoc);
      if (fixed && fixed !== f.srcdoc) f.srcdoc = fixed;
    } catch (_) {}
  }

  applyToDoc(document);
  wrapWindowOpen();
  setTimeout(patchPreview, 500);
  setTimeout(patchPreview, 1500);
  setInterval(patchPreview, 1200);

  window.HospitalRaiseLettersSignatureBoundsFixV1 = { transform: transform, applyToDoc: applyToDoc };
  console.info('[Hospital Raise Letters Signature Bounds Fix] installed v1');
})();
