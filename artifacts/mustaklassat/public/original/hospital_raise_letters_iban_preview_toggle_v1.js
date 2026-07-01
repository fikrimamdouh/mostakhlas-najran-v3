// Hospital Raise Letters IBAN + Preview Toggle V1
// Scope: hospital_raise_letters.html only.
// Adds a standalone company IBAN setting and collapsible preview without changing calculations.
(function () {
  'use strict';

  if (!/hospital_raise_letters\.html/.test(location.pathname) && !window.__HOSPITAL_LETTERS_STANDALONE_PAGE__) return;
  if (window.__HOSPITAL_RAISE_LETTERS_IBAN_PREVIEW_TOGGLE_V1__) return;
  window.__HOSPITAL_RAISE_LETTERS_IBAN_PREVIEW_TOGGLE_V1__ = true;

  var SETTINGS_KEY = 'hospitalRaiseLettersSettings_v8';
  var PREVIEW_COLLAPSED_KEY = 'hospitalRaiseLettersPreviewCollapsed_v1';
  var PANEL_OPEN_KEY = 'hospitalRaiseLettersIbanPanelOpen_v1';

  function clean(v) {
    return String(v == null ? '' : v).replace(/[\u200e\u200f]/g, '').replace(/\s+/g, ' ').trim();
  }
  function readJson(key, fallback) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }
  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value || {})); return true; } catch (_) { return false; }
  }
  function normalizeIban(v) {
    var x = clean(v).replace(/\s+/g, '').toUpperCase();
    x = x.replace(/[^A-Z0-9]/g, '');
    if (x && !/^SA/.test(x) && /^\d/.test(x)) x = 'SA' + x;
    return x.replace(/(.{4})(?=.)/g, '$1 ').trim();
  }
  function compactIban(v) {
    return normalizeIban(v).replace(/\s+/g, '');
  }
  function getSavedIban() {
    var s = readJson(SETTINGS_KEY, {});
    var c = readJson('persistentContractData', {});
    return normalizeIban(s.companyIban || c.iban || c.bankIban || c.accountIban || localStorage.getItem('contractorIban') || '');
  }
  function saveIban(value) {
    var iban = normalizeIban(value);
    var compact = compactIban(iban);
    var s = readJson(SETTINGS_KEY, {});
    s.companyIban = iban;
    s.version = s.version || 'hospital-v8-compact';
    writeJson(SETTINGS_KEY, s);

    var c = readJson('persistentContractData', {});
    c.iban = iban;
    c.bankIban = iban;
    c.accountIban = iban;
    writeJson('persistentContractData', c);

    try {
      localStorage.setItem('contractorIban', iban);
      localStorage.setItem('contractorIbanCompact', compact);
      localStorage.setItem('companyIban', iban);
      localStorage.setItem('hospitalRaiseLettersCompanyIban_v1', iban);
      localStorage.setItem('hospitalRaiseLettersCompanyIban_v1_ts', String(Date.now()));
    } catch (_) {}
    return iban;
  }
  function syncIbanToRuntime() {
    var iban = getSavedIban();
    if (iban) saveIban(iban);
  }

  function ensureCss() {
    if (document.getElementById('hrl-iban-preview-toggle-css')) return;
    var st = document.createElement('style');
    st.id = 'hrl-iban-preview-toggle-css';
    st.textContent = '#hrl .iban-panel-extra{border:2px solid #1d4ed8;background:#eff6ff;border-radius:18px;padding:14px;margin:12px 0;display:none}#hrl .iban-panel-extra.open{display:block}#hrl .iban-panel-extra h3{margin:0 0 8px;color:#003087;font-weight:950}#hrl .iban-panel-extra p{margin:0 0 10px;color:#334155;font-weight:800}#hrl .iban-panel-extra .iban-input{direction:ltr;text-align:left;font-family:Arial,Tahoma,sans-serif;font-weight:950;letter-spacing:.8px}#hrl .iban-panel-extra .small-note{font-size:12px;color:#047857;font-weight:900;margin-top:8px}#hrl .preview.hrl-preview-collapsed{display:none!important}#hrl .btn.iban-btn{background:#1d4ed8;color:#fff}#hrl .btn.preview-btn{background:#7c3aed;color:#fff}';
    document.head.appendChild(st);
  }

  function togglePreview(force) {
    var collapsed = force;
    if (typeof collapsed !== 'boolean') collapsed = localStorage.getItem(PREVIEW_COLLAPSED_KEY) === '1';
    var preview = document.querySelector('#hrl .preview');
    if (preview) preview.classList.toggle('hrl-preview-collapsed', collapsed);
    document.querySelectorAll('#hrl [data-hrl-preview-toggle]').forEach(function (b) {
      b.textContent = collapsed ? 'إظهار المعاينة' : 'إخفاء المعاينة';
    });
  }
  function refreshEnginePreview() {
    try {
      var el = document.querySelector('#hrl [data-f="selected"]');
      if (el) {
        var ev = new Event('change', { bubbles: true });
        el.dispatchEvent(ev);
      }
    } catch (_) {}
  }

  function injectControls() {
    var root = document.getElementById('hrl');
    if (!root) return;
    ensureCss();
    syncIbanToRuntime();

    var toolbar = root.querySelector('.toolbar');
    if (toolbar && !root.querySelector('[data-hrl-iban-toggle]')) {
      var ibanBtn = document.createElement('button');
      ibanBtn.type = 'button';
      ibanBtn.className = 'btn iban-btn';
      ibanBtn.setAttribute('data-hrl-iban-toggle', '1');
      ibanBtn.textContent = 'إعداد IBAN الشركة';
      toolbar.insertBefore(ibanBtn, toolbar.firstChild);

      var previewBtn = document.createElement('button');
      previewBtn.type = 'button';
      previewBtn.className = 'btn preview-btn';
      previewBtn.setAttribute('data-hrl-preview-toggle', '1');
      previewBtn.textContent = localStorage.getItem(PREVIEW_COLLAPSED_KEY) === '1' ? 'إظهار المعاينة' : 'إخفاء المعاينة';
      toolbar.insertBefore(previewBtn, ibanBtn.nextSibling);
    }

    var shell = root.querySelector('.shell');
    if (shell && !root.querySelector('#hrl-iban-panel-extra')) {
      var panel = document.createElement('section');
      panel.id = 'hrl-iban-panel-extra';
      panel.className = 'iban-panel-extra ' + (localStorage.getItem(PANEL_OPEN_KEY) === '1' ? 'open' : '');
      panel.innerHTML = '<h3>إعداد IBAN الشركة</h3><p>هذا الرقم يُحفظ مستقلًا، ويظهر مباشرة في جدول الآيبان داخل خطابات الرفع العادية والعمالة.</p><label class="field"><span>IBAN الشركة</span><input id="hrl-company-iban-input" class="iban-input" type="text" value=""></label><div class="small-note" id="hrl-iban-save-note">يحفظ تلقائيًا أثناء الكتابة.</div>';
      var firstPanel = shell.querySelector('.panel, .preview');
      shell.insertBefore(panel, firstPanel || shell.lastChild);
    }

    var input = root.querySelector('#hrl-company-iban-input');
    if (input && !input.__hrlIbanBound) {
      input.__hrlIbanBound = true;
      input.value = getSavedIban();
      input.addEventListener('input', function () {
        var pos = input.selectionStart;
        var iban = saveIban(input.value);
        input.value = iban;
        try { input.setSelectionRange(Math.min(pos || input.value.length, input.value.length), Math.min(pos || input.value.length, input.value.length)); } catch (_) {}
        var note = root.querySelector('#hrl-iban-save-note');
        if (note) note.textContent = 'تم حفظ IBAN تلقائيًا: ' + iban;
        refreshEnginePreview();
      });
      input.addEventListener('change', function () {
        input.value = saveIban(input.value);
        refreshEnginePreview();
      });
    }

    root.querySelectorAll('[data-hrl-iban-toggle]').forEach(function (btn) {
      if (btn.__hrlIbanToggleBound) return;
      btn.__hrlIbanToggleBound = true;
      btn.onclick = function () {
        var p = root.querySelector('#hrl-iban-panel-extra');
        if (!p) return;
        var open = !p.classList.contains('open');
        p.classList.toggle('open', open);
        localStorage.setItem(PANEL_OPEN_KEY, open ? '1' : '0');
        if (open) setTimeout(function () { var i = root.querySelector('#hrl-company-iban-input'); if (i) i.focus(); }, 80);
      };
    });

    root.querySelectorAll('[data-hrl-preview-toggle]').forEach(function (btn) {
      if (btn.__hrlPreviewToggleBound) return;
      btn.__hrlPreviewToggleBound = true;
      btn.onclick = function () {
        var next = !(localStorage.getItem(PREVIEW_COLLAPSED_KEY) === '1');
        localStorage.setItem(PREVIEW_COLLAPSED_KEY, next ? '1' : '0');
        togglePreview(next);
      };
    });

    togglePreview(localStorage.getItem(PREVIEW_COLLAPSED_KEY) === '1');
  }

  var scheduled = false;
  function scheduleInject() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(function () { scheduled = false; injectControls(); }, 60);
  }

  syncIbanToRuntime();
  scheduleInject();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleInject);
  setTimeout(scheduleInject, 400);
  setTimeout(scheduleInject, 1200);
  setTimeout(scheduleInject, 2500);

  try {
    var mo = new MutationObserver(scheduleInject);
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } catch (_) {}

  window.HospitalRaiseLettersIbanSettings = {
    save: saveIban,
    get: getSavedIban,
    open: function () { localStorage.setItem(PANEL_OPEN_KEY, '1'); injectControls(); }
  };

  console.info('[Hospital Raise Letters IBAN + Preview Toggle] installed v1');
})();
