// ===================================================================
// Admin Offices Raise Letters Signature Settings Interaction Guard — V2
// Scope: admin_offices_attendance.html / admin_offices_consumables.html / raise letters overlay only
// Purpose: keep separated signature settings inputs clickable/editable and persist typing immediately.
// ===================================================================
(function () {
  'use strict';

  var scope = location.pathname + location.search;
  if (!/admin_offices_(attendance|consumables)\.html(?:$|[?#&])/.test(scope)) return;
  if (window.__ADMIN_OFFICES_RAISE_LETTERS_SIGNATURE_INTERACTION_GUARD_V2__) return;
  window.__ADMIN_OFFICES_RAISE_LETTERS_SIGNATURE_INTERACTION_GUARD_V2__ = true;

  var STYLE_ID = 'admin-offices-raise-letters-signature-interaction-guard-css-v2';
  var SETTINGS_KEY = 'adminOfficesRaiseLettersSettings_v1';

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value || {})); } catch (_) {}
  }

  function injectCss() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = [
      '#raise-letters-overlay .settings-dialog{pointer-events:auto!important}',
      '#raise-letters-overlay #rl-professional-settings-panel{pointer-events:auto!important;position:relative!important;z-index:5000!important}',
      '#raise-letters-overlay #rl-signature-settings-shell{pointer-events:auto!important;position:relative!important;z-index:6000!important}',
      '#raise-letters-overlay #rl-signature-settings-shell *{pointer-events:auto!important}',
      '#raise-letters-overlay #rl-signature-settings-shell input,#raise-letters-overlay #rl-signature-settings-shell textarea,#raise-letters-overlay #rl-signature-settings-shell select,#raise-letters-overlay #rl-signature-settings-shell button{pointer-events:auto!important;position:relative!important;z-index:7000!important}',
      '#raise-letters-overlay #rl-signature-settings-shell input,#raise-letters-overlay #rl-signature-settings-shell textarea{cursor:text!important;background:#fff!important;color:#111827!important;user-select:text!important;-webkit-user-select:text!important;-moz-user-select:text!important}',
      '#raise-letters-overlay #rl-signature-settings-shell button,#raise-letters-overlay #rl-signature-settings-shell select{cursor:pointer!important}'
    ].join('\n');
    document.head.appendChild(st);
  }

  function persistField(el) {
    if (!el || !el.getAttribute) return;
    var key = el.getAttribute('data-rl-setting');
    if (!key) return;
    var current = readJson(SETTINGS_KEY, {});
    current[key] = el.value || '';
    writeJson(SETTINGS_KEY, current);
  }

  function mirrorSameSetting(el) {
    if (!el || !el.getAttribute) return;
    var key = el.getAttribute('data-rl-setting');
    if (!key) return;
    try {
      Array.prototype.slice.call(document.querySelectorAll('[data-rl-setting="' + key + '"]')).forEach(function (other) {
        if (other !== el && 'value' in other) other.value = el.value;
      });
    } catch (_) {}
  }

  function unlockSignaturePanel() {
    injectCss();
    var shell = document.getElementById('rl-signature-settings-shell');
    if (!shell) return;

    try {
      shell.removeAttribute('inert');
      shell.style.pointerEvents = 'auto';
      Array.prototype.slice.call(shell.querySelectorAll('input, textarea, select, button')).forEach(function (el) {
        el.removeAttribute('disabled');
        el.removeAttribute('inert');
        if (/^(INPUT|TEXTAREA)$/i.test(el.tagName || '')) {
          el.removeAttribute('readonly');
          el.readOnly = false;
          el.style.pointerEvents = 'auto';
          el.style.userSelect = 'text';
          el.style.webkitUserSelect = 'text';
        }
      });
    } catch (_) {}

    if (shell.getAttribute('data-rl-interaction-bound') === '1') return;
    shell.setAttribute('data-rl-interaction-bound', '1');

    // أوقف تشويش handlers الخارجية بعد وصول الحدث للعنصر نفسه، بدون تعطيل الكتابة أو الأزرار.
    ['click', 'dblclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'keydown', 'keyup', 'paste', 'input', 'change', 'compositionstart', 'compositionend'].forEach(function (type) {
      shell.addEventListener(type, function (ev) {
        var target = ev.target;
        var editable = target && target.closest && target.closest('input, textarea, select, button');
        if (!editable) return;
        if (type === 'input' || type === 'change' || type === 'keyup' || type === 'paste' || type === 'compositionend') {
          setTimeout(function () {
            persistField(editable);
            mirrorSameSetting(editable);
          }, 0);
        }
        ev.stopPropagation();
      }, false);
    });
  }

  unlockSignaturePanel();
  setTimeout(unlockSignaturePanel, 100);
  setTimeout(unlockSignaturePanel, 300);
  setTimeout(unlockSignaturePanel, 1000);
  setInterval(unlockSignaturePanel, 1000);

  console.info('[Admin Offices Raise Letters Signature Interaction Guard] installed v2 editable fields');
})();
