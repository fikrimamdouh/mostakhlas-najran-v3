// ===================================================================
// Admin Offices Raise Letters Professional Layout — V4
// Scope: admin_offices_attendance.html / raise letters overlay
// - إعدادات الخطابات في لوحة واحدة.
// - فصل إعدادات التواقيع في قسم مستقل واضح.
// - اختيار نوع المستند ثم تعديل التواقيع مع معاينة فورية.
// - لا يغير أماكن ظهور التواقيع ولا مفاتيح الحفظ الأصلية.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_RAISE_LETTER_PRO_LAYOUT_V4__) return;
  window.__ADMIN_OFFICES_RAISE_LETTER_PRO_LAYOUT_V4__ = true;

  var SETTINGS_KEY = 'adminOfficesRaiseLettersSettings_v1';
  var currentDocKey = 'general';
  var currentSigDocKey = 'general';

  var DOCS = [
    { key: 'general', label: 'الإعدادات العامة لخطابات الرفع', hint: 'اسم المخاطب، نطاق الخطاب، الضريبة، الهاتف والفاكس. التواقيع لها قسم مستقل بالأسفل.' },
    { key: 'final', label: 'خطاب الرفع النهائي للإدارة المالية', hint: 'ترويسة وزارة الصحة، المخاطب، نص الخطاب، الآيبان. توقيع الخطاب النهائي في قسم إعدادات التواقيع.' },
    { key: 'declaration', label: 'إقرار عدم أسبقية الصرف', hint: 'يستخدم إعدادات الخطابات العامة. تواقيعه في قسم إعدادات التواقيع.' },
    { key: 'site', label: 'خطاب رفع الموقع', hint: 'يستخدم إعدادات الخطابات العامة، ويطبق على الموقع المحدد أو المواقع المختارة.' },
    { key: 'grandAchievement', label: 'شهادة الإنجاز / الاستحقاق المجمعة', hint: 'تواقيعها مستقلة وموجودة في قسم إعدادات التواقيع.' },
    { key: 'notes', label: 'بيان الغيابات والإجازات', hint: 'ملاحظاته تحفظ من شاشة البيان، وتوقيعه من قسم إعدادات التواقيع.' },
    { key: 'salary', label: 'شهادة الرواتب وبيان السعوديين', hint: 'يستخدم التوقيع العام الحالي من قسم إعدادات التواقيع.' }
  ];

  var SIG_DOCS = [
    { key: 'general', label: 'خطابات الرفع العامة / خطاب الموقع', hint: 'هذا التوقيع يظهر في خطاب الرفع للمستخلص وخطابات المواقع.', fields: [
      { key: 'managerTitle', label: 'صفة التوقيع العام' },
      { key: 'managerName', label: 'اسم صاحب التوقيع العام' }
    ]},
    { key: 'final', label: 'خطاب الرفع النهائي للإدارة المالية', hint: 'توقيع مستقل لخطاب الرفع النهائي.', fields: [
      { key: 'finalLetterSignatureTitle', label: 'صفة توقيع الخطاب النهائي' },
      { key: 'finalLetterSignatureName', label: 'اسم صاحب توقيع الخطاب النهائي' }
    ]},
    { key: 'declaration', label: 'إقرار عدم أسبقية الصرف', hint: 'الإقرار يظهر به توقيع إضافي مع التوقيع العام.', fields: [
      { key: 'unitManagerTitle', label: 'صفة التوقيع الإضافي للإقرار' },
      { key: 'unitManagerName', label: 'اسم صاحب التوقيع الإضافي للإقرار' },
      { key: 'managerTitle', label: 'صفة التوقيع العام' },
      { key: 'managerName', label: 'اسم صاحب التوقيع العام' }
    ]},
    { key: 'grandAchievement', label: 'الشهادة الإجمالية / شهادة الإنجاز المجمعة', hint: 'تواقيع مستقلة تماماً عن خطابات الرفع.', fields: [] },
    { key: 'notes', label: 'بيان الغيابات والإجازات', hint: 'يستخدم التوقيع العام، مع معاينة قبل الطباعة.', fields: [
      { key: 'managerTitle', label: 'صفة التوقيع' },
      { key: 'managerName', label: 'اسم صاحب التوقيع' }
    ]},
    { key: 'salary', label: 'شهادة الرواتب وبيان السعوديين', hint: 'يستخدم التوقيع العام الحالي.', fields: [
      { key: 'managerTitle', label: 'صفة التوقيع' },
      { key: 'managerName', label: 'اسم صاحب التوقيع' }
    ]}
  ];

  function clean(v) { return String(v || '').replace(/\s+/g, ' ').trim(); }
  function readJson(key, fallback) { try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; } }
  function writeJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value || {})); } catch (_) {} }
  function esc(v) { return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function ensureCss() {
    if (document.getElementById('raise-letter-professional-layout-css-v4')) return;
    var st = document.createElement('style');
    st.id = 'raise-letter-professional-layout-css-v4';
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
      '#raise-letters-overlay #rl-doc-settings-selector,#raise-letters-overlay #rl-sign-settings-selector{width:100%;padding:10px;border:1px solid #94a3b8;border-radius:10px;font-family:Tajawal,Arial,sans-serif;font-weight:900;background:#fff}',
      '#raise-letters-overlay .rl-doc-hint{margin-top:8px;color:#475569;font-size:12px;font-weight:800;line-height:1.7}',
      '#raise-letters-overlay .rl-pro-settings-content{display:grid;grid-template-columns:1fr;gap:12px}',
      '#raise-letters-overlay .rl-settings-block{display:none!important}',
      '#raise-letters-overlay .rl-settings-block.active{display:block!important}',
      '#raise-letters-overlay .rl-pro-settings-content>.section-box{margin:0!important;background:#fff!important;border:1px solid #ccfbf1!important}',
      '#raise-letters-overlay .rl-pro-settings-content #final-raise-letter-settings{margin:0!important;background:#fff!important;border:1px solid #ccfbf1!important;border-style:solid!important}',
      '#raise-letters-overlay .rl-pro-settings-footer{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:12px;padding-top:12px;border-top:1px solid #99f6e4}',
      '#raise-letters-overlay .rl-pro-save-note{display:none;margin:8px 0 0;padding:9px 12px;border-radius:10px;background:#ecfdf5;color:#166534;border:1px solid #bbf7d0;text-align:center;font-weight:900}',
      '#raise-letters-overlay .rl-pro-save-note.show{display:block}',
      '#raise-letters-overlay .rl-legacy-signature-block{display:none!important}',
      '#raise-letters-overlay .rl-sign-settings-shell{background:#fff;border:2px solid #bfdbfe;border-right:6px solid #003087;border-radius:18px;padding:14px;margin:0 0 12px;box-shadow:0 10px 24px rgba(0,48,135,.08)}',
      '#raise-letters-overlay .rl-sign-settings-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;border-bottom:1px solid #dbeafe;padding-bottom:10px;margin-bottom:12px}',
      '#raise-letters-overlay .rl-sign-settings-head h3{margin:0!important;color:#003087!important;font-size:17px!important}',
      '#raise-letters-overlay .rl-sign-settings-head small{display:block;color:#475569;font-weight:800;line-height:1.7;margin-top:4px}',
      '#raise-letters-overlay .rl-sign-settings-body{display:grid;grid-template-columns:minmax(240px,.85fr) 1.15fr;gap:12px;align-items:start}',
      '#raise-letters-overlay .rl-sign-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;background:#f8fafc;border:1px solid #dbeafe;border-radius:14px;padding:12px}',
      '#raise-letters-overlay .rl-sign-field label{display:block;font-size:12px;font-weight:900;color:#1e3a8a;margin-bottom:6px}',
      '#raise-letters-overlay .rl-sign-field input{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:10px;padding:9px;font-family:Tajawal,Arial,sans-serif;font-weight:850;background:#fff}',
      '#raise-letters-overlay .rl-sign-preview{background:#fff;border:1px dashed #94a3b8;border-radius:14px;padding:12px;min-height:118px}',
      '#raise-letters-overlay .rl-sign-preview-title{font-weight:950;color:#0f172a;margin-bottom:8px;text-align:center}',
      '#raise-letters-overlay .rl-sign-preview-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}',
      '#raise-letters-overlay .rl-sign-preview-box{text-align:center;border:1px solid #e2e8f0;border-radius:12px;padding:10px;background:#f8fafc}',
      '#raise-letters-overlay .rl-sign-preview-box .t{font-weight:950;color:#003087}.rl-sign-preview-box .l{height:28px;border-bottom:1px solid #111;margin:8px 18px}.rl-sign-preview-box .n{font-weight:850;color:#111827}',
      '#raise-letters-overlay .rl-sign-settings-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:center;margin-top:10px}',
      '#raise-letters-overlay .rl-sign-settings-actions .btn{padding:8px 12px!important;border-radius:10px!important;font-weight:900!important}',
      '#raise-letters-overlay .rl-grand-sign-card{background:#fff;border:1px solid #cbd5e1;border-radius:14px;padding:14px;line-height:1.8;font-weight:800;color:#334155}',
      '#raise-letters-overlay .rl-grand-sign-card .btn{margin-top:10px;background:#003087;color:#fff}',
      '#raise-letters-overlay .field[data-injected="finalLetterIban"] input{direction:ltr;text-align:left;font-weight:900;letter-spacing:.4px}',
      '@media(max-width:860px){#raise-letters-overlay .rl-sign-settings-body{grid-template-columns:1fr}}',
      '@media(max-width:760px){#raise-letters-overlay .rl-pro-actions{grid-template-columns:1fr}#raise-letters-overlay .rl-pro-toolbar-title,#raise-letters-overlay .rl-sign-settings-head{align-items:flex-start;flex-direction:column}}'
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
    if (h3) h3.textContent = 'التواقيع القديمة — مخفية';
    section.classList.add('rl-legacy-signature-block');
    Array.prototype.slice.call(section.querySelectorAll('[data-rl-setting]')).forEach(function (input) {
      var key = input.getAttribute('data-rl-setting');
      var label = input.closest('.field') && input.closest('.field').querySelector('label');
      var next = labelForKey(key);
      if (label && next) label.textContent = next;
    });
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

  function getSigDoc(key) { return SIG_DOCS.find(function (d) { return d.key === key; }) || SIG_DOCS[0]; }
  function settingValue(key) { return readJson(SETTINGS_KEY, {})[key] || ''; }

  function renderSignaturePreview(doc, values) {
    if (doc.key === 'grandAchievement') {
      return '<div class="rl-grand-sign-card"><b>تواقيع الشهادة الإجمالية مستقلة.</b><br>يتم تعديلها من نافذة مخصصة حتى لا تختلط مع تواقيع خطابات الرفع.<br><button type="button" class="btn" id="rl-open-grand-signatures-from-sign-panel">فتح إعدادات تواقيع الشهادة الإجمالية</button></div>';
    }
    var pairs = [];
    if (doc.key === 'declaration') {
      pairs.push({ title: values.unitManagerTitle || 'التوقيع الإضافي للإقرار', name: values.unitManagerName || '' });
      pairs.push({ title: values.managerTitle || 'التوقيع العام', name: values.managerName || '' });
    } else if (doc.key === 'final') {
      pairs.push({ title: values.finalLetterSignatureTitle || 'توقيع خطاب الرفع النهائي', name: values.finalLetterSignatureName || '' });
    } else {
      pairs.push({ title: values.managerTitle || 'التوقيع العام', name: values.managerName || '' });
    }
    return '<div class="rl-sign-preview-title">معاينة التواقيع كما ستظهر في المستند</div><div class="rl-sign-preview-grid">' + pairs.map(function (p) {
      return '<div class="rl-sign-preview-box"><div class="t">' + esc(p.title) + '</div><div class="l"></div><div class="n">' + esc(p.name || '................') + '</div></div>';
    }).join('') + '</div>';
  }

  function syncSettingInputs(key, value, source) {
    Array.prototype.slice.call(document.querySelectorAll('[data-rl-setting="' + key + '"]')).forEach(function (el) {
      if (el !== source) el.value = value;
    });
  }

  function renderSignatureSettings(shell) {
    if (!shell) return;
    var doc = getSigDoc(currentSigDocKey);
    var current = readJson(SETTINGS_KEY, {});
    var fieldsHtml = doc.fields.length ? doc.fields.map(function (f) {
      var value = current[f.key] || '';
      return '<div class="rl-sign-field"><label>' + esc(f.label) + '</label><input type="text" data-rl-setting="' + esc(f.key) + '" data-rl-sign-field="1" value="' + esc(value) + '"></div>';
    }).join('') : '<div class="rl-grand-sign-card">هذا المستند له نافذة تواقيع مستقلة. افتحها من زر المعاينة.</div>';

    shell.innerHTML = [
      '<div class="rl-sign-settings-head">',
        '<div><h3>إعدادات التواقيع</h3><small>اختر المستند، عدّل التوقيعات، وشاهد المعاينة قبل الحفظ. أماكن التواقيع في الطباعة كما هي بدون تغيير.</small></div>',
      '</div>',
      '<div class="rl-sign-settings-body">',
        '<div class="rl-doc-selector-wrap" style="margin:0">',
          '<label>اختر الشهادة / الخطاب</label>',
          '<select id="rl-sign-settings-selector">',
            SIG_DOCS.map(function (d) { return '<option value="' + esc(d.key) + '" ' + (d.key === currentSigDocKey ? 'selected' : '') + '>' + esc(d.label) + '</option>'; }).join(''),
          '</select>',
          '<div class="rl-doc-hint" id="rl-sign-settings-hint">' + esc(doc.hint) + '</div>',
          '<div class="rl-sign-settings-actions">',
            '<button type="button" class="btn btn-primary" id="rl-save-signatures-only">حفظ التواقيع</button>',
            '<button type="button" class="btn btn-light" id="rl-preview-signatures-only">تحديث المعاينة</button>',
          '</div>',
        '</div>',
        '<div>',
          '<div class="rl-sign-fields">' + fieldsHtml + '</div>',
          '<div class="rl-sign-preview" id="rl-sign-preview-box">' + renderSignaturePreview(doc, current) + '</div>',
        '</div>',
      '</div>'
    ].join('');

    shell.querySelector('#rl-sign-settings-selector').onchange = function () {
      currentSigDocKey = this.value || 'general';
      renderSignatureSettings(shell);
    };
    Array.prototype.slice.call(shell.querySelectorAll('[data-rl-sign-field="1"]')).forEach(function (input) {
      input.oninput = function () {
        syncSettingInputs(input.getAttribute('data-rl-setting'), input.value, input);
        var preview = shell.querySelector('#rl-sign-preview-box');
        if (preview) preview.innerHTML = renderSignaturePreview(getSigDoc(currentSigDocKey), collectSignatureValues(shell));
      };
    });
    var saveBtn = shell.querySelector('#rl-save-signatures-only');
    if (saveBtn) saveBtn.onclick = saveSignaturesOnly;
    var previewBtn = shell.querySelector('#rl-preview-signatures-only');
    if (previewBtn) previewBtn.onclick = function () { var preview = shell.querySelector('#rl-sign-preview-box'); if (preview) preview.innerHTML = renderSignaturePreview(getSigDoc(currentSigDocKey), collectSignatureValues(shell)); bindGrandSignatureButton(shell); };
    bindGrandSignatureButton(shell);
  }

  function collectSignatureValues(shell) {
    var current = readJson(SETTINGS_KEY, {});
    Array.prototype.slice.call((shell || document).querySelectorAll('[data-rl-sign-field="1"]')).forEach(function (el) { current[el.getAttribute('data-rl-setting')] = el.value; });
    return current;
  }

  function bindGrandSignatureButton(shell) {
    var btn = shell && shell.querySelector('#rl-open-grand-signatures-from-sign-panel');
    if (!btn) return;
    btn.onclick = function () {
      if (typeof window.openAdminOfficesGrandCertificateSignatures === 'function') window.openAdminOfficesGrandCertificateSignatures();
      else alert('نظام تواقيع الشهادة الإجمالية لم يكتمل تحميله بعد.');
    };
  }

  function saveSignaturesOnly() {
    var shell = document.getElementById('rl-signature-settings-shell');
    var patch = {};
    Array.prototype.slice.call((shell || document).querySelectorAll('[data-rl-sign-field="1"]')).forEach(function (el) { patch[el.getAttribute('data-rl-setting')] = el.value; });
    var current = readJson(SETTINGS_KEY, {});
    writeJson(SETTINGS_KEY, Object.assign({}, current, patch));
    var note = document.getElementById('rl-pro-save-note');
    if (note) { note.classList.add('show'); note.textContent = 'تم حفظ إعدادات التواقيع.'; setTimeout(function () { note.classList.remove('show'); }, 900); }
  }

  function ensureSignatureSettingsShell(panel) {
    var shell = panel.querySelector('#rl-signature-settings-shell');
    if (!shell) {
      shell = document.createElement('div');
      shell.id = 'rl-signature-settings-shell';
      shell.className = 'rl-sign-settings-shell';
      var content = panel.querySelector('#rl-professional-settings-content');
      if (content) panel.insertBefore(shell, content);
      else panel.appendChild(shell);
    }
    renderSignatureSettings(shell);
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
          '<div><h3>إعدادات الخطابات</h3><span>الإعدادات العامة منفصلة عن التواقيع حتى لا يتوه المستخدم. الإعدادات تحفظ مرة واحدة للعقد.</span></div>',
          '<button type="button" class="btn btn-light" id="rl-close-settings-btn">إخفاء</button>',
        '</div>',
        '<div class="rl-doc-selector-wrap"><label>اختر الخطاب / البيان لإعدادات النصوص والبيانات</label><select id="rl-doc-settings-selector">',
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

    ensureSignatureSettingsShell(panel);

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
    if (signatures) { patchSignatureSection(signatures); signatures.classList.add('rl-settings-block'); signatures.setAttribute('data-doc-settings', '__legacy_signatures_hidden'); if (signatures.parentNode !== content) content.appendChild(signatures); }

    if (!content.querySelector('[data-doc-settings="grandAchievement"]')) {
      var card = document.createElement('div');
      card.className = 'rl-settings-block rl-grand-sign-card';
      card.setAttribute('data-doc-settings', 'grandAchievement');
      card.innerHTML = '<h3>تواقيع الشهادة الإجمالية / شهادة الإنجاز المجمعة</h3><div>هذه التواقيع مستقلة عن تواقيع خطابات الرفع. يمكن تعديلها أيضاً من قسم إعدادات التواقيع بالأعلى.</div><button type="button" class="btn" id="rl-open-grand-signatures">تعديل تواقيع الشهادة الإجمالية</button>';
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
    if (window.open.__adminOfficesRecipientSuffixSpacingV4) return;
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
    window.open.__adminOfficesRecipientSuffixSpacingV4 = true;
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
    saveSignaturesOnly: saveSignaturesOnly,
    selectDocument: function (key) { currentDocKey = key || 'general'; patchProfessionalLayout(); toggleSettingsPanel(true); },
    selectSignatureDocument: function (key) { currentSigDocKey = key || 'general'; patchProfessionalLayout(); toggleSettingsPanel(true); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', patchProfessionalLayout);
  else patchProfessionalLayout();
  document.addEventListener('click', function () { setTimeout(patchProfessionalLayout, 80); setTimeout(patchProfessionalLayout, 350); setTimeout(patchProfessionalLayout, 900); }, true);
  setInterval(patchProfessionalLayout, 900);
  patchPrintWindowSpacing();

  console.info('[Admin Offices Raise Letters Professional Layout] installed v4 separated signature settings');
})();