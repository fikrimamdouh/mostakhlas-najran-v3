// Admin Offices Raise Letters IBAN Autosave V1
// Scope: admin_offices_attendance.html?raiseLettersClean=1
// Adds a separate company IBAN setting for admin offices raise letters and syncs it to existing finalLetterIban.
(function () {
  'use strict';

  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;
  if (new URLSearchParams(location.search || '').get('raiseLettersClean') !== '1') return;
  if (window.__ADMIN_OFFICES_RAISE_LETTERS_IBAN_AUTOSAVE_V1__) return;
  window.__ADMIN_OFFICES_RAISE_LETTERS_IBAN_AUTOSAVE_V1__ = true;

  var SETTINGS_KEY = 'adminOfficesRaiseLettersSettings_v1';
  var PANEL_OPEN_KEY = 'adminOfficesRaiseLettersIbanPanelOpen_v1';

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
    var x = clean(v).replace(/\s+/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (x && !/^SA/.test(x) && /^\d/.test(x)) x = 'SA' + x;
    return x.replace(/(.{4})(?=.)/g, '$1 ').trim();
  }
  function compactIban(v) {
    return normalizeIban(v).replace(/\s+/g, '');
  }
  function getSavedIban() {
    var s = readJson(SETTINGS_KEY, {});
    var c = readJson('persistentContractData', {});
    return normalizeIban(
      s.finalLetterIban ||
      s.companyIban ||
      c.iban || c.bankIban || c.accountIban || c.bankAccount ||
      localStorage.getItem('contractorIban') ||
      localStorage.getItem('companyIban') ||
      ''
    );
  }
  function saveIban(value) {
    var iban = normalizeIban(value);
    var compact = compactIban(iban);

    var s = readJson(SETTINGS_KEY, {});
    s.finalLetterIban = iban;
    s.companyIban = iban;
    s.version = s.version || 'admin-offices-raise-letters';
    writeJson(SETTINGS_KEY, s);

    var c = readJson('persistentContractData', {});
    c.iban = iban;
    c.bankIban = iban;
    c.accountIban = iban;
    c.bankAccount = iban;
    writeJson('persistentContractData', c);

    try {
      localStorage.setItem('contractorIban', iban);
      localStorage.setItem('contractorIbanCompact', compact);
      localStorage.setItem('companyIban', iban);
      localStorage.setItem('adminOfficesRaiseLettersCompanyIban_v1', iban);
      localStorage.setItem('adminOfficesRaiseLettersCompanyIban_v1_ts', String(Date.now()));
    } catch (_) {}

    return iban;
  }
  function ensureCss() {
    if (document.getElementById('admin-offices-raise-iban-css')) return;
    var st = document.createElement('style');
    st.id = 'admin-offices-raise-iban-css';
    st.textContent = '#admin-raise-clean .rl-btn.iban-btn{background:#1d4ed8;color:#fff;border-color:#1d4ed8}#admin-raise-clean .iban-panel{display:none;border:2px solid #1d4ed8;background:#eff6ff;border-radius:18px;padding:14px;margin:12px 0}#admin-raise-clean .iban-panel.open{display:block}#admin-raise-clean .iban-panel h3{margin:0 0 8px;color:#003087;font-weight:950}#admin-raise-clean .iban-panel .iban-input{direction:ltr;text-align:left;font-family:Arial,Tahoma,sans-serif;font-weight:950;letter-spacing:.8px}#admin-raise-clean .iban-panel .iban-note{font-weight:950;color:#047857;margin-top:8px}';
    document.head.appendChild(st);
  }
  function inject() {
    var root = document.getElementById('admin-raise-clean');
    if (!root) return;
    ensureCss();

    var firstRow = root.querySelector('.box > .rl-row') || root.querySelector('.rl-row');
    if (firstRow && !root.querySelector('[data-action="toggleIbanPanel"]')) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rl-btn iban-btn';
      btn.setAttribute('data-action', 'toggleIbanPanel');
      btn.textContent = 'إعداد IBAN الشركة';
      firstRow.appendChild(btn);
    }

    if (!root.querySelector('#admin-offices-iban-panel')) {
      var panel = document.createElement('section');
      panel.id = 'admin-offices-iban-panel';
      panel.className = 'iban-panel ' + (localStorage.getItem(PANEL_OPEN_KEY) === '1' ? 'open' : '');
      panel.innerHTML = '<h3>إعداد IBAN الشركة</h3><div class="rl-note">يحفظ تلقائيًا ويظهر في خطاب الرفع النهائي للمكاتب الإدارية.</div><label class="rl-field"><span>IBAN الشركة</span><input id="admin-offices-company-iban-input" class="iban-input" type="text" value=""></label><div id="admin-offices-iban-note" class="iban-note">الحفظ تلقائي أثناء الكتابة.</div>';
      var settingsPanel = root.querySelector('#rl-settings');
      if (settingsPanel && settingsPanel.parentNode) settingsPanel.parentNode.insertBefore(panel, settingsPanel);
      else firstRow && firstRow.parentNode && firstRow.parentNode.insertBefore(panel, firstRow.nextSibling);
    }

    var input = root.querySelector('#admin-offices-company-iban-input');
    if (input && !input.__adminOfficesIbanBound) {
      input.__adminOfficesIbanBound = true;
      input.value = getSavedIban();
      input.addEventListener('input', function () {
        input.value = saveIban(input.value);
        var note = root.querySelector('#admin-offices-iban-note');
        if (note) note.textContent = 'تم حفظ IBAN تلقائيًا: ' + input.value;
      });
      input.addEventListener('change', function () {
        input.value = saveIban(input.value);
      });
    }
  }

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('#admin-raise-clean [data-action="toggleIbanPanel"]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    inject();
    var panel = document.getElementById('admin-offices-iban-panel');
    if (!panel) return false;
    var open = !panel.classList.contains('open');
    panel.classList.toggle('open', open);
    localStorage.setItem(PANEL_OPEN_KEY, open ? '1' : '0');
    if (open) setTimeout(function () { var input = document.getElementById('admin-offices-company-iban-input'); if (input) input.focus(); }, 80);
    return false;
  }, true);

  function schedule() { setTimeout(inject, 80); }
  schedule();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule);
  setTimeout(inject, 500);
  setTimeout(inject, 1200);
  setTimeout(inject, 2500);
  try {
    var mo = new MutationObserver(function () { setTimeout(inject, 80); });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } catch (_) {}

  window.AdminOfficesRaiseLettersIbanSettings = { get: getSavedIban, save: saveIban, refresh: inject };
  console.info('[Admin Offices Raise Letters IBAN] installed v1 autosave');
})();
