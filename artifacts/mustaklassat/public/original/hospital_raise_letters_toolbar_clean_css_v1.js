// Hospital Raise Letters Toolbar Clean CSS V1
// Scope: hospital_raise_letters.html only.
// Organizes buttons by CSS only. No DOM rebuild, no MutationObserver, no refresh/flicker.
(function () {
  'use strict';

  if (!/hospital_raise_letters\.html/.test(location.pathname) && !window.__HOSPITAL_LETTERS_STANDALONE_PAGE__) return;
  if (window.__HOSPITAL_RAISE_LETTERS_TOOLBAR_CLEAN_CSS_V1__) return;
  window.__HOSPITAL_RAISE_LETTERS_TOOLBAR_CLEAN_CSS_V1__ = true;

  function ensureCss() {
    if (document.getElementById('hrl-toolbar-clean-css-v1')) return;
    var st = document.createElement('style');
    st.id = 'hrl-toolbar-clean-css-v1';
    st.textContent = [
      '#hrl .toolbar{position:relative!important;top:auto!important;z-index:1!important;display:flex!important;flex-wrap:wrap!important;gap:8px!important;align-items:center!important;justify-content:center!important;background:#fff!important;border:1px solid #dbe3ef!important;border-radius:18px!important;padding:12px!important;box-shadow:0 8px 25px rgba(15,23,42,.08)!important;}',
      '#hrl .panel{scroll-margin-top:18px!important;}',
      '#hrl .toolbar .btn,#hrl .toolbar .doc-select{min-height:40px!important;}',
      '#hrl .toolbar button[data-print="packet"]{order:1!important;flex:1 1 220px!important;background:#047857!important;color:#fff!important;border-color:#047857!important;}',
      '#hrl .toolbar button[data-print="selected"]{order:2!important;flex:1 1 190px!important;background:#059669!important;color:#fff!important;border-color:#059669!important;}',
      '#hrl .toolbar button[data-print]:not([data-print="packet"]):not([data-print="selected"]){order:3!important;flex:1 1 150px!important;background:#ffffff!important;color:#003087!important;border-color:#93c5fd!important;}',
      '#hrl .toolbar .doc-select{order:20!important;flex:1 1 230px!important;background:#eef6ff!important;border:2px solid #93c5fd!important;color:#003087!important;}',
      '#hrl .toolbar button[data-toggle]{order:21!important;flex:1 1 145px!important;background:#f1f5f9!important;color:#0f172a!important;border-color:#cbd5e1!important;}',
      '#hrl .toolbar button[data-toggle="sign"]{background:#e0f2fe!important;border-color:#38bdf8!important;color:#075985!important;}',
      '#hrl .toolbar button[data-hrl-iban-toggle]{order:22!important;flex:1 1 165px!important;background:#1d4ed8!important;color:#fff!important;border-color:#1d4ed8!important;}',
      '#hrl .toolbar button[data-hrl-preview-toggle]{order:23!important;flex:1 1 155px!important;background:#7c3aed!important;color:#fff!important;border-color:#7c3aed!important;}',
      '#hrl .toolbar #exportSettings,#hrl .toolbar #importBtn{order:30!important;flex:0 1 120px!important;background:#334155!important;color:#fff!important;border-color:#334155!important;}',
      '#hrl .toolbar input#importFile{order:99!important;display:none!important;}',
      '@media(max-width:820px){#hrl .toolbar .btn,#hrl .toolbar .doc-select{flex:1 1 145px!important;min-width:0!important;}}'
    ].join('');
    document.head.appendChild(st);
  }

  function scrollOpenPanel() {
    try {
      var root = document.getElementById('hrl');
      if (!root) return;
      var panel = root.querySelector('.panel.open');
      if (panel && panel.scrollIntoView) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (_) {}
  }

  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('#hrl [data-toggle]');
    if (!b) return;
    setTimeout(scrollOpenPanel, 180);
    setTimeout(scrollOpenPanel, 420);
  }, true);

  ensureCss();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureCss);
  setTimeout(ensureCss, 600);
  console.info('[Hospital Raise Letters Toolbar Clean CSS] installed v1');
})();
