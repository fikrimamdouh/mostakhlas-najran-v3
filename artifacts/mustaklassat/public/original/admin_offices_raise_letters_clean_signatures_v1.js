// ===================================================================
// Admin Offices Raise Letters Clean Signatures — Rebuilt V4
// Scope: admin_offices_attendance.html?raiseLettersClean=1
// حذف محرر التواقيع القديم بالكامل وإعادة إنشائه من الصفر.
// لا Patch. لا إعادة بناء أثناء الكتابة. لا تغيير في مفاتيح الحفظ أو أماكن الطباعة.
// ===================================================================
(function () {
  'use strict';

  var scope = location.pathname + location.search;
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(scope)) return;
  if (new URLSearchParams(location.search || '').get('raiseLettersClean') !== '1') return;
  if (window.__ADMIN_OFFICES_CLEAN_SIGNATURES_REBUILT_V4__) return;
  window.__ADMIN_OFFICES_CLEAN_SIGNATURES_REBUILT_V4__ = true;

  var SETTINGS_KEY = 'adminOfficesRaiseLettersSettings_v1';
  var CSS_ID = 'admin-clean-signatures-rebuilt-css-v4';
  var BOX_ID = 'rl-clean-signatures-box';
  var TOP_BTN_ID = 'rl-clean-open-signatures-top';

  var DOCS = [
    {
      key: 'general',
      label: 'خطابات الرفع العامة / خطاب الموقع',
      hint: 'يستخدمها خطاب رفع عمالة المكاتب الإدارية وخطابات المواقع.',
      fields: [
        { key: 'managerTitle', label: 'صفة توقيع الخطاب' },
        { key: 'managerName', label: 'اسم توقيع الخطاب' }
      ],
      preview: function (s) { return [{ title: s.managerTitle || 'صفة التوقيع', name: s.managerName || '' }]; }
    },
    {
      key: 'final',
      label: 'خطاب الرفع النهائي',
      hint: 'توقيع مستقل لخطاب الرفع النهائي.',
      fields: [
        { key: 'finalLetterSignatureTitle', label: 'صفة توقيع خطاب الرفع النهائي' },
        { key: 'finalLetterSignatureName', label: 'اسم توقيع خطاب الرفع النهائي' }
      ],
      preview: function (s) { return [{ title: s.finalLetterSignatureTitle || 'توقيع خطاب الرفع النهائي', name: s.finalLetterSignatureName || '' }]; }
    },
    {
      key: 'declaration',
      label: 'إقرار عدم أسبقية الصرف',
      hint: 'توقيع الإقرار مع التوقيع العام.',
      fields: [
        { key: 'unitManagerTitle', label: 'صفة توقيع الإقرار' },
        { key: 'unitManagerName', label: 'اسم توقيع الإقرار' },
        { key: 'managerTitle', label: 'صفة التوقيع العام' },
        { key: 'managerName', label: 'اسم التوقيع العام' }
      ],
      preview: function (s) {
        return [
          { title: s.unitManagerTitle || 'توقيع الإقرار', name: s.unitManagerName || '' },
          { title: s.managerTitle || 'التوقيع العام', name: s.managerName || '' }
        ];
      }
    },
    {
      key: 'salary',
      label: 'شهادة تسليم الرواتب / بيان السعوديين',
      hint: 'تستخدم التوقيع العام الحالي.',
      fields: [
        { key: 'managerTitle', label: 'صفة التوقيع' },
        { key: 'managerName', label: 'اسم التوقيع' }
      ],
      preview: function (s) { return [{ title: s.managerTitle || 'صفة التوقيع', name: s.managerName || '' }]; }
    },
    {
      key: 'notes',
      label: 'بيان الغيابات / بيان الإجازات',
      hint: 'تستخدم التوقيع العام الحالي.',
      fields: [
        { key: 'managerTitle', label: 'صفة التوقيع' },
        { key: 'managerName', label: 'اسم التوقيع' }
      ],
      preview: function (s) { return [{ title: s.managerTitle || 'صفة التوقيع', name: s.managerName || '' }]; }
    },
    {
      key: 'grand',
      label: 'الشهادة الإجمالية / شهادة الاستحقاق المجمعة',
      hint: 'تواقيعها مستقلة من نافذة الشهادة الإجمالية.',
      fields: [],
      preview: function () { return []; }
    }
  ];

  var state = {
    docKey: 'general',
    root: null,
    box: null,
    body: null,
    form: null,
    preview: null,
    selector: null,
    flash: null
  };

  function readSettings() {
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  function writeSettings(next) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next || {}));
      return true;
    } catch (_) {
      return false;
    }
  }

  function currentDoc() {
    return DOCS.find(function (d) { return d.key === state.docKey; }) || DOCS[0];
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function ensureCss() {
    if (document.getElementById(CSS_ID)) return;
    var style = document.createElement('style');
    style.id = CSS_ID;
    style.textContent = [
      '#admin-raise-clean .rl-clean-signatures-box{background:#fff;border:2px solid #bfdbfe;border-right:7px solid #003087;border-radius:18px;padding:14px;margin:14px 0;box-shadow:0 12px 28px rgba(0,48,135,.08);font-family:Tajawal,Arial,sans-serif;position:relative;z-index:5000;pointer-events:auto!important}',
      '#admin-raise-clean .rl-clean-signatures-box *{pointer-events:auto!important;box-sizing:border-box}',
      '#admin-raise-clean .rl-clean-signatures-head{display:flex;justify-content:space-between;align-items:center;gap:10px;border-bottom:1px solid #dbeafe;padding-bottom:10px;margin-bottom:12px}',
      '#admin-raise-clean .rl-clean-signatures-head h3{margin:0;color:#003087;font-size:18px;font-weight:950}',
      '#admin-raise-clean .rl-clean-signatures-head p{margin:4px 0 0;color:#475569;font-size:12px;font-weight:800;line-height:1.7}',
      '#admin-raise-clean .rl-clean-signatures-toggle,#admin-raise-clean .rl-clean-signatures-top-btn{background:#003087!important;color:#fff!important;border:0!important;border-radius:10px!important;padding:9px 13px!important;font-weight:950!important;cursor:pointer;font-family:Tajawal,Arial,sans-serif!important}',
      '#admin-raise-clean .rl-clean-signatures-top-btn{margin-inline-start:8px!important;background:#0f766e!important}',
      '#admin-raise-clean .rl-clean-signatures-body{display:none;grid-template-columns:minmax(260px,.8fr) 1.2fr;gap:12px;align-items:start}',
      '#admin-raise-clean .rl-clean-signatures-box.open .rl-clean-signatures-body{display:grid}',
      '#admin-raise-clean .rl-clean-card{background:#f8fafc;border:1px solid #dbeafe;border-radius:14px;padding:12px}',
      '#admin-raise-clean .rl-clean-card label{display:block;font-weight:950;color:#0f172a;margin-bottom:7px}',
      '#admin-raise-clean .rl-clean-select{width:100%;padding:10px;border:1px solid #94a3b8;border-radius:10px;font-family:Tajawal,Arial,sans-serif;font-weight:900;background:#fff;color:#111827}',
      '#admin-raise-clean .rl-clean-hint{margin-top:8px;color:#475569;font-size:12px;font-weight:800;line-height:1.7}',
      '#admin-raise-clean .rl-clean-sign-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}',
      '#admin-raise-clean .rl-clean-sign-field span{display:block;font-size:12px;font-weight:950;color:#1e3a8a;margin-bottom:6px}',
      '#admin-raise-clean .rl-clean-sign-field input{width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:9px;font-family:Tajawal,Arial,sans-serif;font-weight:850;background:#fff;color:#111827!important;cursor:text!important;user-select:text!important;-webkit-user-select:text!important;position:relative;z-index:6000}',
      '#admin-raise-clean .rl-clean-sign-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:10px}',
      '#admin-raise-clean .rl-clean-sign-actions button{border:0;border-radius:10px;padding:9px 13px;font-family:Tajawal,Arial,sans-serif;font-weight:950;cursor:pointer}',
      '#admin-raise-clean .rl-clean-sign-save{background:#16a34a;color:white}.rl-clean-sign-preview-btn{background:#e2e8f0;color:#0f172a}.rl-clean-grand-btn{background:#003087;color:white}',
      '#admin-raise-clean .rl-clean-sign-preview-title{text-align:center;font-weight:950;color:#0f172a;margin-bottom:8px}',
      '#admin-raise-clean .rl-clean-sign-preview-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}',
      '#admin-raise-clean .rl-clean-sign-preview-box{text-align:center;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:10px}',
      '#admin-raise-clean .rl-clean-sign-preview-box .t{font-weight:950;color:#003087}.rl-clean-sign-preview-box .l{height:28px;border-bottom:1px solid #111;margin:8px 18px}.rl-clean-sign-preview-box .n{font-weight:850;color:#111827}',
      '#admin-raise-clean .rl-clean-flash{display:none;margin-top:10px;text-align:center;background:#ecfdf5;border:1px solid #bbf7d0;color:#166534;border-radius:10px;padding:8px;font-weight:950}',
      '#admin-raise-clean .rl-clean-flash.show{display:block}',
      '@media(max-width:860px){#admin-raise-clean .rl-clean-signatures-body{grid-template-columns:1fr}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function wipeOldEditor(root) {
    Array.prototype.slice.call(root.querySelectorAll('#' + BOX_ID + ',#' + TOP_BTN_ID)).forEach(function (node) {
      if (node && node.parentNode) node.parentNode.removeChild(node);
    });
  }

  function patchLabels(root) {
    Array.prototype.slice.call(root.querySelectorAll('button,option,label,h3,h4,div,span')).forEach(function (node) {
      if (node.childElementCount > 0) return;
      var text = String(node.textContent || '').trim();
      if (text === 'خطاب الرفع للمستخلص') node.textContent = 'خطاب رفع عمالة المكاتب الإدارية';
      if (text === 'صفحات خطاب الرفع للمستخلص') node.textContent = 'صفحات خطاب رفع عمالة المكاتب الإدارية';
    });
  }

  function saveFromInputs() {
    var current = readSettings();
    if (!state.form) return current;
    Array.prototype.slice.call(state.form.querySelectorAll('[data-sign-key]')).forEach(function (input) {
      current[input.getAttribute('data-sign-key')] = input.value || '';
    });
    writeSettings(current);
    return current;
  }

  function renderFields() {
    var doc = currentDoc();
    var values = readSettings();
    state.form.innerHTML = '';

    if (!doc.fields.length) {
      var empty = el('div', '', 'هذا النوع له نافذة تواقيع مستقلة. استخدم زر فتح إعدادات تواقيع الشهادة الإجمالية.');
      empty.style.fontWeight = '850';
      empty.style.color = '#334155';
      empty.style.lineHeight = '1.8';
      state.form.appendChild(empty);
      return;
    }

    doc.fields.forEach(function (field) {
      var label = el('label', 'rl-clean-sign-field');
      label.appendChild(el('span', '', field.label));
      var input = document.createElement('input');
      input.type = 'text';
      input.autocomplete = 'off';
      input.setAttribute('data-sign-key', field.key);
      input.value = values[field.key] || '';
      input.addEventListener('input', function () {
        saveFromInputs();
        renderPreview();
      });
      input.addEventListener('keydown', function (ev) { ev.stopPropagation(); });
      input.addEventListener('click', function (ev) { ev.stopPropagation(); });
      label.appendChild(input);
      state.form.appendChild(label);
    });
  }

  function renderPreview() {
    var doc = currentDoc();
    var values = saveFromInputs();
    state.preview.innerHTML = '';

    if (doc.key === 'grand') {
      state.preview.appendChild(el('div', 'rl-clean-sign-preview-title', 'تواقيع الشهادة الإجمالية'));
      var msg = el('div');
      msg.style.textAlign = 'center';
      msg.style.fontWeight = '850';
      msg.style.lineHeight = '1.8';
      msg.style.color = '#334155';
      msg.appendChild(document.createTextNode('هذه التواقيع لها نافذة مستقلة حتى لا تختلط مع خطابات الرفع.'));
      msg.appendChild(document.createElement('br'));
      var btn = el('button', 'rl-clean-grand-btn', 'فتح إعدادات تواقيع الشهادة الإجمالية');
      btn.type = 'button';
      btn.onclick = function () {
        if (typeof window.openAdminOfficesGrandCertificateSignatures === 'function') window.openAdminOfficesGrandCertificateSignatures();
        else alert('نافذة تواقيع الشهادة الإجمالية غير محملة في هذه الشاشة. افتح الشهادة الإجمالية من صفحة المكاتب لتعديلها.');
      };
      msg.appendChild(btn);
      state.preview.appendChild(msg);
      return;
    }

    state.preview.appendChild(el('div', 'rl-clean-sign-preview-title', 'معاينة التواقيع'));
    var grid = el('div', 'rl-clean-sign-preview-grid');
    doc.preview(values).forEach(function (pair) {
      var box = el('div', 'rl-clean-sign-preview-box');
      box.appendChild(el('div', 't', pair.title || 'صفة التوقيع'));
      box.appendChild(el('div', 'l'));
      box.appendChild(el('div', 'n', pair.name || '................'));
      grid.appendChild(box);
    });
    state.preview.appendChild(grid);
  }

  function flash(message) {
    if (!state.flash) return;
    state.flash.textContent = message;
    state.flash.classList.add('show');
    setTimeout(function () { state.flash.classList.remove('show'); }, 1200);
  }

  function renderDoc() {
    var doc = currentDoc();
    var hint = state.box.querySelector('.rl-clean-hint');
    if (hint) hint.textContent = doc.hint;
    renderFields();
    renderPreview();
  }

  function buildEditor(root) {
    wipeOldEditor(root);

    var box = el('div', 'rl-clean-signatures-box');
    box.id = BOX_ID;

    var head = el('div', 'rl-clean-signatures-head');
    var titleWrap = el('div');
    titleWrap.appendChild(el('h3', '', 'إعدادات التواقيع'));
    titleWrap.appendChild(el('p', '', 'قسم مستقل لتعديل تواقيع خطابات الرفع والشهادات بدون تغيير أماكنها في الطباعة.'));
    var toggle = el('button', 'rl-clean-signatures-toggle', 'فتح / إخفاء');
    toggle.type = 'button';
    toggle.onclick = function (ev) {
      ev.stopPropagation();
      box.classList.toggle('open');
      if (box.classList.contains('open')) renderDoc();
    };
    head.appendChild(titleWrap);
    head.appendChild(toggle);

    var body = el('div', 'rl-clean-signatures-body');
    var selectCard = el('div', 'rl-clean-card');
    selectCard.appendChild(el('label', '', 'اختر الشهادة / الخطاب'));
    var selector = document.createElement('select');
    selector.className = 'rl-clean-select';
    DOCS.forEach(function (doc) {
      var option = document.createElement('option');
      option.value = doc.key;
      option.textContent = doc.label;
      selector.appendChild(option);
    });
    selector.value = state.docKey;
    selector.onchange = function () {
      saveFromInputs();
      state.docKey = selector.value || 'general';
      renderDoc();
    };
    var hint = el('div', 'rl-clean-hint', currentDoc().hint);
    var actions = el('div', 'rl-clean-sign-actions');
    var saveBtn = el('button', 'rl-clean-sign-save', 'حفظ التواقيع');
    saveBtn.type = 'button';
    saveBtn.onclick = function (ev) {
      ev.stopPropagation();
      saveFromInputs();
      renderPreview();
      flash('تم حفظ إعدادات التواقيع.');
    };
    var previewBtn = el('button', 'rl-clean-sign-preview-btn', 'تحديث المعاينة');
    previewBtn.type = 'button';
    previewBtn.onclick = function (ev) {
      ev.stopPropagation();
      saveFromInputs();
      renderPreview();
    };
    actions.appendChild(saveBtn);
    actions.appendChild(previewBtn);
    selectCard.appendChild(selector);
    selectCard.appendChild(hint);
    selectCard.appendChild(actions);

    var editWrap = el('div');
    var formCard = el('div', 'rl-clean-card');
    var fields = el('div', 'rl-clean-sign-fields');
    formCard.appendChild(fields);
    var preview = el('div', 'rl-clean-card rl-clean-signatures-preview');
    preview.style.marginTop = '12px';
    var flashBox = el('div', 'rl-clean-flash');
    editWrap.appendChild(formCard);
    editWrap.appendChild(preview);
    editWrap.appendChild(flashBox);

    body.appendChild(selectCard);
    body.appendChild(editWrap);
    box.appendChild(head);
    box.appendChild(body);

    state.root = root;
    state.box = box;
    state.body = body;
    state.form = fields;
    state.preview = preview;
    state.selector = selector;
    state.flash = flashBox;

    var anchor = root.querySelector('.rl-toolbar,.rl-clean-toolbar,.rl-actions,.rl-top-actions') || root.querySelector('h2') || root.firstElementChild;
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(box, anchor.nextSibling);
    else root.insertBefore(box, root.firstChild);

    var topBtn = el('button', 'rl-clean-signatures-top-btn', 'تعديل التواقيع');
    topBtn.id = TOP_BTN_ID;
    topBtn.type = 'button';
    topBtn.onclick = function (ev) {
      ev.stopPropagation();
      box.classList.add('open');
      renderDoc();
      try { box.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) { box.scrollIntoView(); }
    };
    var closeBtn = Array.prototype.slice.call(root.querySelectorAll('button')).find(function (btn) {
      return String(btn.textContent || '').trim() === 'إغلاق';
    });
    if (closeBtn && closeBtn.parentNode) closeBtn.parentNode.insertBefore(topBtn, closeBtn);
    else root.insertBefore(topBtn, root.firstChild);

    renderDoc();
    return box;
  }

  function install() {
    var root = document.getElementById('admin-raise-clean');
    if (!root) return false;
    ensureCss();
    patchLabels(root);
    buildEditor(root);
    window.AdminOfficesCleanSignatureSettings = {
      open: function () {
        if (!state.box || !document.body.contains(state.box)) buildEditor(root);
        state.box.classList.add('open');
        renderDoc();
      },
      refresh: function () {
        if (!state.box || !document.body.contains(state.box)) buildEditor(root);
        else renderDoc();
      }
    };
    console.info('[Admin Offices Raise Letters Clean Signatures] rebuilt v4 clean editor');
    return true;
  }

  var tries = 0;
  var timer = setInterval(function () {
    tries += 1;
    if (install() || tries > 120) clearInterval(timer);
  }, 150);
})();
