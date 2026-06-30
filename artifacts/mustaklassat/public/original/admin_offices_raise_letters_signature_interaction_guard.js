// ===================================================================
// Admin Offices Raise Letters Signature Settings Interaction Guard
// Scope: admin_offices_attendance.html / raise letters overlay only
// Purpose: keep separated signature settings inputs clickable/editable.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_RAISE_LETTERS_SIGNATURE_INTERACTION_GUARD__) return;
  window.__ADMIN_OFFICES_RAISE_LETTERS_SIGNATURE_INTERACTION_GUARD__ = true;

  var STYLE_ID = 'admin-offices-raise-letters-signature-interaction-guard-css';

  function injectCss() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = [
      '#raise-letters-overlay #rl-professional-settings-panel{pointer-events:auto!important;position:relative!important;z-index:50!important}',
      '#raise-letters-overlay #rl-signature-settings-shell{pointer-events:auto!important;position:relative!important;z-index:60!important}',
      '#raise-letters-overlay #rl-signature-settings-shell input,#raise-letters-overlay #rl-signature-settings-shell textarea,#raise-letters-overlay #rl-signature-settings-shell select,#raise-letters-overlay #rl-signature-settings-shell button{pointer-events:auto!important;position:relative!important;z-index:70!important}',
      '#raise-letters-overlay #rl-signature-settings-shell input,#raise-letters-overlay #rl-signature-settings-shell textarea{cursor:text!important;background:#fff!important;user-select:text!important;-webkit-user-select:text!important}',
      '#raise-letters-overlay #rl-signature-settings-shell button,#raise-letters-overlay #rl-signature-settings-shell select{cursor:pointer!important}'
    ].join('\n');
    document.head.appendChild(st);
  }

  function unlockSignaturePanel() {
    injectCss();
    var shell = document.getElementById('rl-signature-settings-shell');
    if (!shell) return;
    try {
      shell.removeAttribute('inert');
      Array.prototype.slice.call(shell.querySelectorAll('input, textarea, select, button')).forEach(function (el) {
        el.removeAttribute('disabled');
        el.removeAttribute('inert');
        if (/^(INPUT|TEXTAREA)$/i.test(el.tagName || '')) el.removeAttribute('readonly');
      });
    } catch (_) {}
  }

  unlockSignaturePanel();
  setTimeout(unlockSignaturePanel, 300);
  setTimeout(unlockSignaturePanel, 1000);
  setInterval(unlockSignaturePanel, 1000);

  console.info('[Admin Offices Raise Letters Signature Interaction Guard] installed');
})();
