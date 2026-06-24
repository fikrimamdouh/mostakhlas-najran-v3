// ===================================================================
// Admin Offices Raise Letters Professional Layout — V3
// Scope: admin_offices_attendance.html / raise letters overlay
// - إعدادات الخطابات في لوحة واحدة.
// - اختيار نوع الخطاب من قائمة، ثم تظهر إعداداته فقط.
// - إضافة حقل آيبان خطاب الرفع النهائي.
// - إضافة مدخل تواقيع الشهادة الإجمالية داخل إعدادات الخطابات.
// - ضبط مسافة "المحترم" في نوافذ خطابات الرفع بنفس مبدأ خطاب الرفع النهائي.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_RAISE_LETTER_PRO_LAYOUT_V3__) return;
  window.__ADMIN_OFFICES_RAISE_LETTER_PRO_LAYOUT_V3__ = true;

  var SETTINGS_KEY = 'adminOfficesRaiseLettersSettings_v1';
  var currentDocKey = 'general';

  var DOCS = [
    { key: 'general', label: 'الإعدادات العامة لخطابات الرفع', hint: 'اسم المخاطب، نطاق الخطاب، الضريبة، الهاتف والفاكس، والتوقيع العام.' },
    { key: 'final', label: 'خطاب الرفع النهائي للإدارة المالية', hint: 'ترويسة وزارة الصحة، المخاطب، نص الخطاب، الآيبان، وتوقيع الخطاب النهائي.' },
    { key: 'declaration', label: 'إقرار عدم أسبقية الصرف', hint: 'يستخدم إعدادات الخطابات العامة مع توقيعين: توقيع إضافي + توقيع خطابات الرفع.' },
    { key: 'site', label: 'خطاب رفع الموقع', hint: 'يستخدم إعدادات الخطابات العامة، ويطبق على الموقع المحدد أو المواقع المختارة.' },
    { key: 'grandAchievement', label: 'شهادة الإنجاز / الاستحقاق المجمعة', hint: 'تواقيع مستقلة للشهادة الإجمالية المجمعة.' },
    { key: 'notes', label: 'بيان الغيابات والإجازات', hint: 'يستخدم التوقيع العام، وملاحظاته تحفظ تلقائيًا من شاشة البيان.' },
    { key: 'salary', label: 'شهادة الرواتب وبيان السعوديين', hint: 'يستخدم التوقيع العام الحالي، ويمكن تخصيصه لاحقًا عند فصل إعدادات كل نموذج.' }
  ];

  function clean(v) { return String(v || '').replace(/\s+/g, ' ').trim(); }
  function readJson(key, fallback) { try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; } }
  function writeJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value || {})); } catch (_) {} }
  function esc(v) { return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function ensureCss() {
    if (document.getElementById('raise-letter-professional-layout-css')) return;
    var st = document.createElement('style');
    st.id = 'raise-letter-professional-layout-css';
    st.textContent = [
      '#raise-letters-overlay .rl-pro-toolbar{background:#f8fafc;border:1px solid #dbe4f0;border-radius:18px;padding:12px;margin:0 0 14px;box-shadow:0 10px 24px rgba(15,23,42,.06)}',
      '#raise-letters-overlay .rl-pro-toolbar-title{display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:1px solid #e2e8f0;padding-bottom:9px;margin-bottom:10px}',
      '#raise-letters-overlay .rl-pro-toolbar-title strong{font-size:15px;color:#003087;font-weight:900}',
      '#raise-letters-overlay .rl-pro-toolbar-title small{font-size:12px;color:#64748b;font-weight:800}',
      '#raise-letters-overlay .rl-pro-actions{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px}',
      '#raise-letters-overlay .rl-pro-group{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:10px;min-height:82px}',
      '#raise-letters-overlay .rl-pro-group h4{margin:0 0 8px;color:#0f172a;font-size:13px;font-weight:900;border-bottom:1px dashed #dbe4f0;padding-bottom:6px}',
      '#raise-letters-overlay .rl-pro-group .rl-pro-buttons{display:flex;gap:7px;flex-wrap:wrap;align-items:center}',
      '#raise-letters-overlay .rl-pro-toolbar .btn{margin:0!important;padding:8px 11px!important;border-radius:10px!important;font-size:13px!important;box-shadow:none!important}',
      '#raise-letters-overlay .rl-pro-settings-toggle{background:#0f766e!important;color:#fff!important;border:0!important}',
      '#raise-letters-overlay .rl-old-top-actions{display:none!important}',
      '#raise-letters-overlay #admin-extra-docs-section>.btn-row{display:none!important}',
      '#raise-letters-overlay .rl-pro-settings-panel{border:2px solid #0f766e;background:#f0fdfa;border-radius:18px;padding:14px;margin:0 0 14px;box-shadow:0 12px 28px rgba(15,118,110,.10)}',
      '#raise-letters-overlay .rl-pro-settings-panel.rl-collapsed{display:none!important}',
      '#raise-letters-overlay .rl-pro-settings-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #99f6e4}',
      '#raise-letters-overlay .rl-pro-settings-head h3{margin:0!important;color:#0f766e!important;text-align:right!important;font-size:18px!important}',
      '#raise-letters-overlay .rl-pro-settings-head span{font-size:12px;color:#475569;font-weight:800}',
      '#raise-letters-overlay .rl-doc-selector-wrap{background:#fff;border:1px solid #99f6e4;border-radius:14px;padding:12px;margin-bottom:12px}',
      '#raise-letters-overlay .rl-doc-selector-wrap label{display:block;font-weight:900;color:#0f172a;margin-bottom:7px}',
      '#raise-letters-overlay #rl-doc-settings-selector{width:100%;padding:10px;border:1px solid #94a3b8;border-radius:10px;font-family:Tajawal,Arial,sans-serif;font-weight:900;background:#fff}',
      '#raise-letters-overlay .rl-doc-hint{margin-top:8px;color:#475569;font-size:12px;font-weight:800;line-height:1.7}',
      '#raise-letters-overlay .rl-pro-settings-content{display:grid;grid-template-columns:1fr;gap:12px}',
      '#raise-letters-overlay .rl-settings-block{display:none!important}',
      '#raise-letters-overlay .rl-settings-block.active{display:block!important}',
      '#raise-letters-overlay .rl-pro-settings-content>.section-box{margin:0!important;background:#fff!important;border:1px solid #ccfbf1!important}',
      '#raise-letters-overlay .rl-pro-settings-content #final-raise-letter-settings{margin:0!important;background:#fff!important;border:1px solid #ccfbf1!important;border-style:solid!important}',
      '#raise-letters-overlay .rl-pro-settings-footer{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:12px;padding-top:12px;border-top:1px solid #99f6e4}',
      '#raise-letters-overlay .rl-pro-save-note{display:none;margin:8px 0 0;padding:9px 12px;border-radius:10px;background:#ecfdf5;color:#166534;border:1px solid #bbf7d0;text-align:center;font-weight:900}',
      '#raise-letters-overlay .rl-pro-save-note.show{display:block}',
      '#raise-letters-overlay .rl-signature-clarity{background:#eef6ff;border:1px solid #bfdbfe;border-right:5px solid #003087;border-radius:12px;padding:12px 14px;margin:0 0 12px;color:#0f2f5f;font-weight:800;line-height:1.8}',
      '#raise-letters-overlay .rl-signature-chip-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}',
      '#raise-letters-overlay .rl-signature-chip{background:#fff;border:1px solid #cbd5e1;border-radius:999px;padding:5px 10px;font-size:12px;color:#334155;font-weight:900}',
      '#raise-letters-overlay .rl-grand-sign-card{background:#fff;border:1px solid #cbd5e1;border-radius:14px;padding:14px;line-height:1.8;font-weight:800;color:#334155}',
      '#raise-letters-overlay .rl-grand-sign-card .btn{margin-top:10px;background:#003087;color:#fff}',
      '#raise-letters-overlay .field[data-injected="finalLetterIban"] input{direction:ltr;text-align:left;font-weight:900;letter-spacing:.4px}',
      '@media(max-width:760px){#raise-letters-overlay .rl-pro-actions{grid-template-columns:1fr}#raise-letters-overlay .rl-pro-toolbar-title{align-items:flex-start;flex-direction:column}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  function labelForKey(key) {
    var map = {
      unitManagerTitle: 'التوقيع الإضافي للإقرار — الصفة',
      unitManagerName: 'التوقيع الإضافي للإقرار — الاسم',
      managerTitle: 'التوقيع العام لخطابات الرفع — الصفة',
      managerName: 'التوقيع العام لخطابات الرفع — الاسم',
      finalLetterSignatureTitle: 'توقيع خطاب الرفع النهائي — الصفة',
      finalLetterSignatureName: 'توقيع خطاب الرفع النهائي — الاسم',
      finalLetterIban: 'رقم الحساب البنكي الآيبان'
    };
    return map[key] || '';
  }

  function findSectionByTitle(overlay, matcher) {
    var sections = Array.prototype.slice.call(overlay.querySelectorAll('.section-box'));
    return sections.find(function (box) {
      var title = clean(box.querySelector('h3') && box.querySelector('h3').textContent);
      return matcher(title, box);
    }) || null;
  }

  function ensureToolbar(dialog) {
    var toolbar = dialog.querySelector('#rl-professional-toolbar');
    if (toolbar) return toolbar;
    toolbar = document.createElement('div');
    toolbar.id = 'rl-professional-toolbar';
    toolbar.className = 'rl-pro-toolbar';
    toolbar.innerHTML = [
      '<div class="rl-pro-toolbar-title">',
        '<div><strong>مركز خطابات المستخلص</strong><br><small>الأزرار مرتبة حسب نوع المستند. الإعدادات مخفية وتفتح عند الحاجة فقط.</small></div>',
        '<div class="rl-pro-top-controls"><button type="button" class="btn rl-pro-settings-toggle" id="rl-open-settings-btn">إعدادات الخطابات</button></div>',
      '</div>',
      '<div class="rl-pro-actions"></div>'
    ].join('');
    var h2 = dialog.querySelector('h2');
    if (h2 && h2.nextSibling) dialog.insertBefore(toolbar, h2.nextSibling);
    else dialog.insertBefore(toolbar, dialog.firstChild);
    toolbar.querySelector('#rl-open-settings-btn').onclick = function () { toggleSettingsPanel(true); };
    return toolbar;
  }

  function patchSignatureSection(section) {
    if (!section) return;
    var h3 = section.querySelector('h3');
    if (h3) h3.textContent = 'التوقيع العام والإقرار';
    if (!section.querySelector('.rl-signature-clarity')) {
      var note = document.createElement('div');
      note.className = 'rl-signature-clarity';
      note.innerHTML = [
        '<b>طريقة الاستخدام:</b>',
        '<div>التوقيع العام يظهر في: خطاب الرفع للمستخلص + خطاب الموقع + خطابات المواقع.</div>',
        '<div>إقرار عدم أسبقية الصرف يظهر فيه: التوقيع الإضافي للإقرار + التوقيع العام.</div>',
        '<div class="rl-signature-chip-row">',
          '<span class="rl-signature-chip">توقيع عام</span>',
          '<span class="rl-signature-chip">توقيع إضافي للإقرار</span>',
        '</div>'
      ].join('');
      var grid = section.querySelector('.settings-grid');
      section.insertBefore(note, grid || section.firstChild);
    }
    Array.prototype.slice.call(section.querySelectorAll('[data-rl-setting]')).forEach(function (input) {
      var key = input.getAttribute('data-rl-setting');
      var label = input.closest('.field') && input.closest('.field').querySelector('label');
      var next = labelForKey(key);
      if (label && next) label.textContent = next;
    });
    Array.prototype.slice.call(section.querySelectorAll('button')).forEach(function (btn) { btn.style.display = 'none'; });
  }

  function injectFinalIbanField(finalSettings) {
    if (!finalSettings || finalSettings.querySelector('[data-rl-setting="finalLetterIban"]')) return;
    var current = readJson(SETTINGS_KEY, {});
    var value = current.finalLetterIban || 'SA................................';
    var grid = finalSettings.querySelector('.settings-grid') || finalSettings;
    var div = document.createElement('div');
    div.className = 'field';
    div.setAttribute('data-injected', 'finalLetterIban');
    div.innerHTML = '<label>رقم الحساب البنكي الآيبان</label><input type="text" data-rl-setting="finalLetterIban" value="' + esc(value) + '" placeholder="SA................................">';
    grid.appendChild(div);
  }

  function patchLabels(root) {
    Array.prototype.slice.call(root.querySelectorAll('[data-rl-setting]')).forEach(function (input) {
      var label = input.closest('.field') && input.closest('.field').querySelector('label');
      var next = labelForKey(input.getAttribute('data-rl-setting'));
      if (label && next) label.textContent = next;
    });
  }

  function ensureSettingsPanel() {
    var overlay = document.getElementById('raise-letters-overlay');
    if (!overlay) return;
    var dialog = overlay.querySelector('.settings-dialog');
    if (!dialog) return;
    ensureCss();
    ensureToolbar(dialog);

    var panel = dialog.querySelector('#rl-professional-settings-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'rl-professional-settings-panel';
      panel.className = 'rl-pro-settings-panel rl-collapsed';
      panel.innerHTML = [
        '<div class="rl-pro-settings-head">',
          '<div><h3>إعدادات الخطابات</h3><span>اختر نوع الخطاب، عدّل إعداداته، ثم احفظ. الإعدادات تحفظ مرة واحدة للعقد.</span></div>',
          '<button type="button" class="btn btn-light" id="rl-close-settings-btn">إخفاء</button>',
        '</div>',
        '<div class="rl-doc-selector-wrap"><label>اختر الخطاب / البيان</label><select id="rl-doc-settings-selector">',
          DOCS.map(function (d) { return '<option value="' + esc(d.key) + '">' + esc(d.label) + '</option>'; }).join(''),
        '</select><div class="rl-doc-hint" id="rl-doc-settings-hint"></div></div>',
        '<div class="rl-pro-settings-content" id="rl-professional-settings-content"></div>',
        '<div class="rl-pro-save-note" id="rl-pro-save-note">تم حفظ إعدادات الخطابات.</div>',
        '<div class="rl-pro-settings-footer">',
          '<button type="button" class="btn btn-primary" id="rl-save-hide-settings-btn">حفظ وإخفاء الإعدادات</button>',
          '<button type="button" class="btn btn-light" id="rl-cancel-hide-settings-btn">إخفاء بدون حفظ</button>',
        '</div>'
      ].join('');
      var toolbar = dialog.querySelector('#rl-professional-toolbar');
      if (toolbar && toolbar.nextSibling) dialog.insertBefore(panel, toolbar.nextSibling);
      else dialog.insertBefore(panel, dialog.firstChild);
      panel.querySelector('#rl-close-settings-btn').onclick = function () { toggleSettingsPanel(false); };
      panel.querySelector('#rl-cancel-hide-settings-btn').onclick = function () { toggleSettingsPanel(false); };
      panel.querySelector('#rl-save-hide-settings-btn').onclick = saveSettingsAndHide;
      panel.querySelector('#rl-doc-settings-selector').onchange = function () { currentDocKey = this.value || 'general'; applyDocVisibility(); };
    }

    var content = panel.querySelector('#rl-professional-settings-content');
    if (!content) return;

    var general = findSectionByTitle(overlay, function (title, box) {
      return box.id !== 'admin-extra-docs-section' && box.id !== 'final-raise-letter-settings' &&
        (title.indexOf('إعدادات الخطابات') > -1 || title.indexOf('إعدادات الخطاب') > -1 || title.indexOf('إعدادات الخطابات المحفوظة') > -1);
    });
    var signatures = findSectionByTitle(overlay, function (title) { return title.indexOf('تواقيع') > -1 || title.indexOf('التواقيع') > -1; });
    var finalSettings = overlay.querySelector('#final-raise-letter-settings');

    if (general) { general.classList.add('rl-settings-block'); general.setAttribute('data-doc-settings', 'general site declaration notes salary'); var gh = general.querySelector('h3'); if (gh) gh.textContent = 'الإعدادات العامة المشتركة'; if (general.parentNode !== content) content.appendChild(general); }
    if (finalSettings) { injectFinalIbanField(finalSettings); finalSettings.classList.add('rl-settings-block'); finalSettings.setAttribute('data-doc-settings', 'final'); var fh = finalSettings.querySelector('h3'); if (fh) fh.textContent = 'إعدادات خطاب الرفع النهائي للإدارة المالية'; if (finalSettings.parentNode !== content) content.appendChild(finalSettings); }
    if (signatures) { patchSignatureSection(signatures); signatures.classList.add('rl-settings-block'); signatures.setAttribute('data-doc-settings', 'general site declaration notes salary'); if (signatures.parentNode !== content) content.appendChild(signatures); }

    if (!content.querySelector('[data-doc-settings="grandAchievement"]')) {
      var card = document.createElement('div');
      card.className = 'rl-settings-block rl-grand-sign-card';
      card.setAttribute('data-doc-settings', 'grandAchievement');
      card.innerHTML = '<h3>تواقيع الشهادة الإجمالية / شهادة الإنجاز المجمعة</h3><div>هذه التواقيع مستقلة عن تواقيع خطابات الرفع. اضغط الزر التالي لتعديلها وحفظها.</div><button type="button" class="btn" id="rl-open-grand-signatures">تعديل تواقيع الشهادة الإجمالية</button>';
      content.appendChild(card);
      card.querySelector('#rl-open-grand-signatures').onclick = function () {
        if (typeof window.openAdminOfficesGrandCertificateSignatures === 'function') window.openAdminOfficesGrandCertificateSignatures();
        else alert('نظام تواقيع الشهادة الإجمالية لم يكتمل تحميله بعد.');
      };
    }

    Array.prototype.slice.call(content.querySelectorAll('.rl-section-save-row, .btn-row')).forEach(function (row) {
      var txt = clean(row.textContent);
      if (txt.indexOf('حفظ') > -1) row.style.display = 'none';
    });

    patchLabels(content);
    applyDocVisibility();
  }

  function applyDocVisibility() {
    var panel = document.getElementById('rl-professional-settings-panel');
    if (!panel) return;
    var sel = panel.querySelector('#rl-doc-settings-selector');
    if (sel && sel.value !== currentDocKey) sel.value = currentDocKey;
    var doc = DOCS.find(function (d) { return d.key === currentDocKey; }) || DOCS[0];
    var hint = panel.querySelector('#rl-doc-settings-hint');
    if (hint) hint.textContent = doc.hint;
    Array.prototype.slice.call(panel.querySelectorAll('.rl-settings-block')).forEach(function (block) {
      var keys = (block.getAttribute('data-doc-settings') || '').split(/\s+/);
      block.classList.toggle('active', keys.indexOf(currentDocKey) > -1);
    });
  }

  function toggleSettingsPanel(open) {
    var panel = document.getElementById('rl-professional-settings-panel');
    if (!panel) return;
    if (open) { panel.classList.remove('rl-collapsed'); applyDocVisibility(); try { panel.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) { panel.scrollIntoView(); } }
    else panel.classList.add('rl-collapsed');
  }

  function saveSettingsAndHide() {
    var panel = document.getElementById('rl-professional-settings-panel');
    if (!panel) return;
    var patch = {};
    Array.prototype.slice.call(panel.querySelectorAll('[data-rl-setting]')).forEach(function (el) { patch[el.dataset.rlSetting] = el.value; });
    var current = readJson(SETTINGS_KEY, {});
    writeJson(SETTINGS_KEY, Object.assign({}, current, patch));
    try { if (patch.finalLetterIban) localStorage.setItem('contractorIban', patch.finalLetterIban); } catch (_) {}
    var note = panel.querySelector('#rl-pro-save-note');
    if (note) { note.classList.add('show'); note.textContent = 'تم حفظ إعدادات الخطابات والتواقيع بنجاح.'; }
    setTimeout(function () { if (note) note.classList.remove('show'); toggleSettingsPanel(false); }, 650);
  }

  function markOldActionRows() {
    var overlay = document.getElementById('raise-letters-overlay');
    if (!overlay) return;
    var dialog = overlay.querySelector('.settings-dialog');
    if (!dialog) return;
    Array.prototype.slice.call(dialog.children).forEach(function (el) {
      if (el.classList && el.classList.contains('btn-row') && !el.closest('#rl-professional-toolbar') && !el.closest('#rl-professional-settings-panel')) el.classList.add('rl-old-top-actions');
    });
  }

  function patchPrintWindowSpacing() {
    if (window.open.__adminOfficesRecipientSuffixSpacingV3) return;
    var originalOpen = window.open;
    window.open = function () {
      var win = originalOpen.apply(window, arguments);
      function inject() {
        try {
          if (!win || win.closed || !win.document || !win.document.head) return;
          if (win.document.getElementById('admin-offices-recipient-suffix-spacing')) return;
          var hasRecipient = win.document.querySelector('.recipient-suffix') || win.document.querySelector('.to');
          if (!hasRecipient) return;
          var st = win.document.createElement('style');
          st.id = 'admin-offices-recipient-suffix-spacing';
          st.textContent = '.to{display:flex!important;justify-content:space-between!important;align-items:center!important;gap:18px!important}.recipient-name{display:block!important;flex:1!important;text-align:right!important}.recipient-suffix{display:block!important;min-width:96px!important;text-align:left!important;margin-right:0!important;margin-inline-start:auto!important}.final-to{display:flex!important;justify-content:space-between!important;align-items:center!important}';
          win.document.head.appendChild(st);
        } catch (_) {}
      }
      setTimeout(inject, 80); setTimeout(inject, 300); setTimeout(inject, 900);
      return win;
    };
    window.open.__adminOfficesRecipientSuffixSpacingV3 = true;
  }

  function patchProfessionalLayout() {
    var overlay = document.getElementById('raise-letters-overlay');
    if (!overlay) return;
    ensureCss();
    var dialog = overlay.querySelector('.settings-dialog');
    if (dialog) ensureToolbar(dialog);
    ensureSettingsPanel();
    markOldActionRows();
    patchPrintWindowSpacing();
  }

  window.AdminOfficesRaiseLettersProfessionalLayout = {
    refresh: patchProfessionalLayout,
    openSettings: function () { patchProfessionalLayout(); toggleSettingsPanel(true); },
    closeSettings: function () { toggleSettingsPanel(false); },
    saveSettingsAndHide: saveSettingsAndHide,
    selectDocument: function (key) { currentDocKey = key || 'general'; patchProfessionalLayout(); toggleSettingsPanel(true); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', patchProfessionalLayout);
  else patchProfessionalLayout();
  document.addEventListener('click', function () { setTimeout(patchProfessionalLayout, 80); setTimeout(patchProfessionalLayout, 350); setTimeout(patchProfessionalLayout, 900); }, true);
  setInterval(patchProfessionalLayout, 900);
  patchPrintWindowSpacing();

  console.info('[Admin Offices Raise Letters Professional Layout] installed v3 document settings + IBAN + signatures');
})();