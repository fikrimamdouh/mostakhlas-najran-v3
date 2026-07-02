// Hospital Raise Letters Toolbar Organizer V2
// Scope: hospital_raise_letters.html only.
// Separates printing controls from settings controls and removes explanatory text from official documents.
(function () {
  'use strict';

  if (!/hospital_raise_letters\.html/.test(location.pathname) && !window.__HOSPITAL_LETTERS_STANDALONE_PAGE__) return;
  if (window.__HOSPITAL_RAISE_LETTERS_TOOLBAR_ORGANIZER_V2__) return;
  window.__HOSPITAL_RAISE_LETTERS_TOOLBAR_ORGANIZER_V2__ = true;

  var SETTINGS_KEY = 'hospitalRaiseLettersSettings_v8';
  var BAD_TEXT_RE = /يتضمن\s+هذا\s+الفهرس|لاستخدامه\s+كغلاف\s+تنظيمي|غلاف\s+تنظيمي|الحزمة\s+الرسمية|شرح\s+تعريفي|الشروحات\s+التعريفية/i;

  function readJson(k, fallback) {
    try { var raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }
  function writeJson(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v || {})); return true; } catch (_) { return false; }
  }
  function scrubOfficialText(reason) {
    var s = readJson(SETTINGS_KEY, {});
    var changed = false;
    s.texts = s.texts || {};
    s.texts.index = s.texts.index || {};

    ['body', 'close', 'note'].forEach(function (field) {
      if (BAD_TEXT_RE.test(String(s.texts.index[field] || ''))) {
        s.texts.index[field] = '';
        changed = true;
      }
    });

    if (typeof s.texts.index.body === 'undefined' || BAD_TEXT_RE.test(String(s.texts.index.body || ''))) {
      s.texts.index.body = '';
      changed = true;
    }

    Object.keys(s.texts).forEach(function (k) {
      var t = s.texts[k] || {};
      ['body', 'close', 'note'].forEach(function (field) {
        if (BAD_TEXT_RE.test(String(t[field] || ''))) {
          t[field] = '';
          changed = true;
        }
      });
    });

    if (changed) {
      writeJson(SETTINGS_KEY, s);
      try { localStorage.setItem('hospitalRaiseLettersOfficialTextCleaner_v1_ts', String(Date.now())); } catch (_) {}
      console.warn('[Hospital Raise Letters Official Text Cleaner] removed explanatory text:', reason || 'clean');
    }
    return changed;
  }

  function patchPrintWindowText() {
    if (window.__HOSPITAL_RAISE_LETTERS_OFFICIAL_WRITE_PATCHED_V2__) return;
    window.__HOSPITAL_RAISE_LETTERS_OFFICIAL_WRITE_PATCHED_V2__ = true;
    var oldOpen = window.open;
    window.open = function () {
      var win = oldOpen.apply(window, arguments);
      try {
        if (win && win.document && !win.__officialTextPatchedV2) {
          win.__officialTextPatchedV2 = true;
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

  function ensureCss() {
    if (document.getElementById('hrl-toolbar-organizer-css')) return;
    var st = document.createElement('style');
    st.id = 'hrl-toolbar-organizer-css';
    st.textContent = [
      '#hrl .toolbar.hrl-organized{display:block!important;position:sticky;top:8px;z-index:30;background:#ffffff!important;border:1px solid #dbe3ef;border-radius:18px;padding:12px;box-shadow:0 8px 25px rgba(15,23,42,.10);}',
      '#hrl .hrl-tool-section{border:1px solid #e2e8f0;border-radius:16px;background:#f8fafc;padding:12px;margin:0 0 10px;}',
      '#hrl .hrl-tool-section:last-child{margin-bottom:0;}',
      '#hrl .hrl-tool-title{font-weight:950;color:#003087;text-align:center;margin:0 0 10px;font-size:16px;}',
      '#hrl .hrl-print-table{width:100%;border-collapse:separate;border-spacing:0 7px;}',
      '#hrl .hrl-print-table th{background:#003087;color:#fff;padding:8px;border:0;font-weight:950;text-align:center;}',
      '#hrl .hrl-print-table th:first-child{border-radius:0 10px 10px 0;}',
      '#hrl .hrl-print-table th:last-child{border-radius:10px 0 0 10px;}',
      '#hrl .hrl-print-table td{background:#fff;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;padding:8px;text-align:center;vertical-align:middle;}',
      '#hrl .hrl-print-table td:first-child{border-right:1px solid #e2e8f0;border-radius:0 10px 10px 0;font-weight:950;color:#0f172a;}',
      '#hrl .hrl-print-table td:last-child{border-left:1px solid #e2e8f0;border-radius:10px 0 0 10px;}',
      '#hrl .hrl-print-table .btn{width:100%;justify-content:center;display:inline-flex;align-items:center;}',
      '#hrl .hrl-row-settings{background:#1d4ed8!important;color:#fff!important;}',
      '#hrl .hrl-packet-row td{background:#ecfdf5!important;border-color:#99f6e4!important;}',
      '#hrl .hrl-settings-grid{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}',
      '#hrl .hrl-settings-grid .btn,#hrl .hrl-settings-grid .doc-select{min-width:150px;justify-content:center;}',
      '#hrl .hrl-hidden-holder{display:none!important;}',
      '@media(max-width:820px){#hrl .hrl-print-table,#hrl .hrl-print-table tbody,#hrl .hrl-print-table tr,#hrl .hrl-print-table td{display:block;width:100%;}#hrl .hrl-print-table thead{display:none;}#hrl .hrl-print-table tr{background:#fff;border:1px solid #e2e8f0;border-radius:12px;margin:8px 0;padding:8px;}#hrl .hrl-print-table td{border:0!important;border-radius:0!important;padding:5px;}#hrl .hrl-print-table td:first-child{font-size:15px;background:#eff6ff;border-radius:10px!important;margin-bottom:6px;}#hrl .hrl-settings-grid .btn,#hrl .hrl-settings-grid .doc-select{flex:1 1 145px;}}'
    ].join('');
    document.head.appendChild(st);
  }

  function clean(v) {
    return String(v || '').replace(/[\u200e\u200f]/g, '').replace(/\s+/g, ' ').trim();
  }

  function labelFromButton(btn) {
    var text = clean(btn && (btn.innerText || btn.textContent || ''));
    return text.replace(/^طباعة\s*/,'').trim() || clean(btn && btn.dataset && btn.dataset.print) || 'خطاب';
  }

  function selectDocAndOpenSettings(root, key) {
    try {
      var sel = root.querySelector('.doc-select');
      if (sel) {
        sel.value = key;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
      setTimeout(function () {
        var docBtn = root.querySelector('[data-toggle="doc"]');
        if (docBtn) docBtn.click();
        setTimeout(function () {
          var panel = root.querySelector('.panel.open');
          if (panel && panel.scrollIntoView) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }, 80);
    } catch (_) {}
  }

  function buildSettingsButton(root, key) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn hrl-row-settings';
    b.textContent = 'إعداد';
    b.onclick = function () { selectDocAndOpenSettings(root, key); };
    return b;
  }

  function refreshPreviewIfNeeded(changed) {
    if (!changed) return;
    try {
      var el = document.querySelector('#hrl [data-f="selected"]');
      if (el) el.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (_) {}
  }

  function organizeToolbar() {
    var root = document.getElementById('hrl');
    if (!root) return;
    refreshPreviewIfNeeded(scrubOfficialText('organize'));
    patchPrintWindowText();

    var toolbar = root.querySelector('.toolbar');
    if (!toolbar || toolbar.__hrlOrganizing) return;
    if (toolbar.querySelector('.hrl-print-zone') && toolbar.querySelector('.hrl-settings-zone')) return;

    ensureCss();
    toolbar.__hrlOrganizing = true;
    try {
      var docSelect = toolbar.querySelector('.doc-select');
      var printSelected = toolbar.querySelector('button[data-print="selected"]');
      var printPacket = toolbar.querySelector('button[data-print="packet"]');
      var printDocs = Array.from(toolbar.querySelectorAll('button[data-print]')).filter(function (b) {
        return b.dataset.print !== 'selected' && b.dataset.print !== 'packet';
      });
      var settingsButtons = Array.from(toolbar.querySelectorAll('button[data-toggle]'));
      var ibanBtn = toolbar.querySelector('button[data-hrl-iban-toggle]');
      var previewBtn = toolbar.querySelector('button[data-hrl-preview-toggle]');
      var exportBtn = toolbar.querySelector('#exportSettings');
      var importBtn = toolbar.querySelector('#importBtn');
      var importFile = toolbar.querySelector('#importFile');

      toolbar.innerHTML = '';
      toolbar.classList.add('hrl-organized');

      var printZone = document.createElement('section');
      printZone.className = 'hrl-tool-section hrl-print-zone';
      printZone.innerHTML = '<div class="hrl-tool-title">الخطابات والطباعة</div>';

      var table = document.createElement('table');
      table.className = 'hrl-print-table';
      table.innerHTML = '<thead><tr><th>الخطاب</th><th>إعداد</th><th>طباعة</th></tr></thead><tbody></tbody>';
      var tbody = table.querySelector('tbody');

      printDocs.forEach(function (btn) {
        var key = btn.dataset.print;
        var tr = document.createElement('tr');
        var tdName = document.createElement('td');
        tdName.textContent = labelFromButton(btn);
        var tdSet = document.createElement('td');
        tdSet.appendChild(buildSettingsButton(root, key));
        var tdPrint = document.createElement('td');
        tdPrint.appendChild(btn);
        tr.appendChild(tdName);
        tr.appendChild(tdSet);
        tr.appendChild(tdPrint);
        tbody.appendChild(tr);
      });

      if (printPacket || printSelected) {
        var trAll = document.createElement('tr');
        trAll.className = 'hrl-packet-row';
        var tdN = document.createElement('td');
        tdN.textContent = 'طباعة مجمعة / المختار';
        var tdS = document.createElement('td');
        if (docSelect) tdS.appendChild(docSelect);
        var tdP = document.createElement('td');
        if (printSelected) tdP.appendChild(printSelected);
        if (printPacket) tdP.appendChild(printPacket);
        trAll.appendChild(tdN);
        trAll.appendChild(tdS);
        trAll.appendChild(tdP);
        tbody.insertBefore(trAll, tbody.firstChild);
      }

      printZone.appendChild(table);

      var settingsZone = document.createElement('section');
      settingsZone.className = 'hrl-tool-section hrl-settings-zone';
      settingsZone.innerHTML = '<div class="hrl-tool-title">الإعدادات العامة وأدوات التحكم</div>';
      var grid = document.createElement('div');
      grid.className = 'hrl-settings-grid';

      settingsButtons.forEach(function (b) { grid.appendChild(b); });
      if (ibanBtn) grid.appendChild(ibanBtn);
      if (previewBtn) grid.appendChild(previewBtn);
      if (exportBtn) grid.appendChild(exportBtn);
      if (importBtn) grid.appendChild(importBtn);
      if (importFile) {
        var holder = document.createElement('span');
        holder.className = 'hrl-hidden-holder';
        holder.appendChild(importFile);
        grid.appendChild(holder);
      }

      settingsZone.appendChild(grid);
      toolbar.appendChild(printZone);
      toolbar.appendChild(settingsZone);
    } catch (err) {
      console.warn('[Hospital Raise Letters Toolbar Organizer] failed:', err);
    } finally {
      toolbar.__hrlOrganizing = false;
    }
  }

  var scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(function () { scheduled = false; organizeToolbar(); }, 120);
  }

  scrubOfficialText('initial');
  patchPrintWindowText();
  schedule();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule);
  setTimeout(schedule, 700);
  setTimeout(schedule, 1400);
  setTimeout(schedule, 2600);
  setTimeout(schedule, 4200);

  try {
    var mo = new MutationObserver(schedule);
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } catch (_) {}

  window.HospitalRaiseLettersOfficialTextCleaner = { clean: scrubOfficialText };
  console.info('[Hospital Raise Letters Toolbar Organizer] installed v2 + official text cleaner');
})();
