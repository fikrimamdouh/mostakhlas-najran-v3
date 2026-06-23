// ===================================================================
// Admin Offices Raise Letters Professional Layout — V2
// Scope: admin_offices_attendance.html / raise letters overlay
// - يوضح تواقيع الخطابات.
// - يخفي إعدادات الخطابات داخل لوحة قابلة للفتح.
// - يحفظ الإعدادات ثم يخفي اللوحة.
// - يرتب أزرار الخطابات في مجموعات واضحة بدون تغيير دوال الطباعة.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_RAISE_LETTER_PRO_LAYOUT_V2__) return;
  window.__ADMIN_OFFICES_RAISE_LETTER_PRO_LAYOUT_V2__ = true;

  var SETTINGS_KEY = 'adminOfficesRaiseLettersSettings_v1';

  function clean(v) {
    return String(v || '').replace(/\s+/g, ' ').trim();
  }

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
      '#raise-letters-overlay .rl-pro-toolbar .btn-primary{background:#003087!important;color:#fff!important}',
      '#raise-letters-overlay .rl-pro-toolbar .btn-gold{background:#d4af37!important;color:#111827!important}',
      '#raise-letters-overlay .rl-pro-toolbar .btn-light{background:#eef2f7!important;color:#111827!important;border:1px solid #cbd5e1!important}',
      '#raise-letters-overlay .rl-pro-settings-toggle{background:#0f766e!important;color:#fff!important;border:0!important}',
      '#raise-letters-overlay .rl-old-top-actions{display:none!important}',
      '#raise-letters-overlay #admin-extra-docs-section>.btn-row{display:none!important}',
      '#raise-letters-overlay .rl-pro-settings-panel{border:2px solid #0f766e;background:#f0fdfa;border-radius:18px;padding:14px;margin:0 0 14px;box-shadow:0 12px 28px rgba(15,118,110,.10)}',
      '#raise-letters-overlay .rl-pro-settings-panel.rl-collapsed{display:none!important}',
      '#raise-letters-overlay .rl-pro-settings-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #99f6e4}',
      '#raise-letters-overlay .rl-pro-settings-head h3{margin:0!important;color:#0f766e!important;text-align:right!important;font-size:18px!important}',
      '#raise-letters-overlay .rl-pro-settings-head span{font-size:12px;color:#475569;font-weight:800}',
      '#raise-letters-overlay .rl-pro-settings-content{display:grid;grid-template-columns:1fr;gap:12px}',
      '#raise-letters-overlay .rl-pro-settings-content>.section-box{margin:0!important;background:#fff!important;border:1px solid #ccfbf1!important}',
      '#raise-letters-overlay .rl-pro-settings-content #final-raise-letter-settings{margin:0!important;background:#fff!important;border:1px solid #ccfbf1!important;border-style:solid!important}',
      '#raise-letters-overlay .rl-pro-settings-footer{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:12px;padding-top:12px;border-top:1px solid #99f6e4}',
      '#raise-letters-overlay .rl-pro-save-note{display:none;margin:8px 0 0;padding:9px 12px;border-radius:10px;background:#ecfdf5;color:#166534;border:1px solid #bbf7d0;text-align:center;font-weight:900}',
      '#raise-letters-overlay .rl-pro-save-note.show{display:block}',
      '#raise-letters-overlay .rl-signature-clarity{background:#eef6ff;border:1px solid #bfdbfe;border-right:5px solid #003087;border-radius:12px;padding:12px 14px;margin:0 0 12px;color:#0f2f5f;font-weight:800;line-height:1.8}',
      '#raise-letters-overlay .rl-signature-clarity b{color:#003087}',
      '#raise-letters-overlay .rl-signature-chip-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}',
      '#raise-letters-overlay .rl-signature-chip{background:#fff;border:1px solid #cbd5e1;border-radius:999px;padding:5px 10px;font-size:12px;color:#334155;font-weight:900}',
      '#raise-letters-overlay .rl-signature-section h3{display:flex;align-items:center;justify-content:center;gap:8px}',
      '#raise-letters-overlay .rl-signature-section label{line-height:1.45!important}',
      '#raise-letters-overlay .rl-pro-empty{font-size:12px;color:#94a3b8;font-weight:800;padding:5px 0}',
      '@media(max-width:760px){#raise-letters-overlay .rl-pro-actions{grid-template-columns:1fr}#raise-letters-overlay .rl-pro-toolbar-title{align-items:flex-start;flex-direction:column}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  function labelForKey(key) {
    var map = {
      unitManagerTitle: 'توقيع إضافي للإقرار فقط — الصفة',
      unitManagerName: 'توقيع إضافي للإقرار فقط — الاسم',
      managerTitle: 'توقيع خطابات الرفع والإقرار — الصفة',
      managerName: 'توقيع خطابات الرفع والإقرار — الاسم'
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

  function patchSignatureSection() {
    var overlay = document.getElementById('raise-letters-overlay');
    if (!overlay) return;
    ensureCss();

    var section = findSectionByTitle(overlay, function (title) { return title.indexOf('التواقيع') > -1; });
    if (!section) return;

    section.classList.add('rl-signature-section');
    var h3 = section.querySelector('h3');
    if (h3) h3.textContent = 'تواقيع خطابات الرفع والإقرار';

    if (!section.querySelector('.rl-signature-clarity')) {
      var note = document.createElement('div');
      note.className = 'rl-signature-clarity';
      note.innerHTML = [
        '<b>توضيح الاستخدام:</b>',
        '<div>توقيع خطابات الرفع يظهر في: خطاب العمالة الإجمالي + خطاب الموقع المحدد + خطابات المواقع المختارة.</div>',
        '<div>إقرار عدم أسبقية الصرف يظهر فيه توقيعان: التوقيع الإضافي + توقيع خطابات الرفع.</div>',
        '<div class="rl-signature-chip-row">',
          '<span class="rl-signature-chip">خطاب العمالة الإجمالي: توقيع خطابات الرفع فقط</span>',
          '<span class="rl-signature-chip">خطاب الموقع: توقيع خطابات الرفع فقط</span>',
          '<span class="rl-signature-chip">إقرار عدم أسبقية الصرف: التوقيعان معًا</span>',
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
      if (next) input.setAttribute('title', next);
    });

    Array.prototype.slice.call(section.querySelectorAll('button')).forEach(function (btn) {
      var text = clean(btn.textContent);
      if (text.indexOf('حفظ التواقيع') > -1 || text.indexOf('حفظ إعدادات') > -1) {
        btn.innerHTML = '<i class="fas fa-save"></i> حفظ تواقيع الخطابات والإقرار';
        btn.title = 'يحفظ التوقيع المستخدم في خطابات الرفع والتوقيع الإضافي الخاص بالإقرار';
      }
    });
  }

  function buttonText(btn) {
    return clean(btn && btn.textContent);
  }

  function createGroup(toolbar, id, title) {
    var g = toolbar.querySelector('[data-rl-group="' + id + '"]');
    if (g) return g.querySelector('.rl-pro-buttons');
    g = document.createElement('div');
    g.className = 'rl-pro-group';
    g.setAttribute('data-rl-group', id);
    g.innerHTML = '<h4>' + title + '</h4><div class="rl-pro-buttons"><span class="rl-pro-empty">لم يتم تحميل الأزرار بعد</span></div>';
    toolbar.querySelector('.rl-pro-actions').appendChild(g);
    return g.querySelector('.rl-pro-buttons');
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
        '<div class="rl-pro-top-controls">',
          '<button type="button" class="btn rl-pro-settings-toggle" id="rl-open-settings-btn">إعدادات الخطابات</button>',
        '</div>',
      '</div>',
      '<div class="rl-pro-actions"></div>'
    ].join('');

    var h2 = dialog.querySelector('h2');
    if (h2 && h2.nextSibling) dialog.insertBefore(toolbar, h2.nextSibling);
    else dialog.insertBefore(toolbar, dialog.firstChild);

    var settingsBtn = toolbar.querySelector('#rl-open-settings-btn');
    settingsBtn.onclick = function () { toggleSettingsPanel(true); };

    createGroup(toolbar, 'main', 'المستخلص والخطابات الرئيسية');
    createGroup(toolbar, 'certs', 'الشهادات والبيانات');
    createGroup(toolbar, 'sites', 'خطابات المواقع');
    createGroup(toolbar, 'system', 'إدارة النافذة');
    return toolbar;
  }

  function appendButton(group, btn) {
    if (!group || !btn) return;
    if (btn.dataset.rlProfessionalMoved === '1' && btn.parentNode === group) return;
    var empty = group.querySelector('.rl-pro-empty');
    if (empty) empty.remove();
    btn.dataset.rlProfessionalMoved = '1';
    group.appendChild(btn);
  }

  function classifyButton(btn) {
    var t = buttonText(btn);
    if (!t) return '';
    if (t.indexOf('حفظ') > -1) return 'settings-save';
    if (t.indexOf('إغلاق') > -1) return 'system';
    if (t.indexOf('خطاب الموقع') > -1 || t.indexOf('خطابات المواقع') > -1) return 'sites';
    if (t.indexOf('شهادة') > -1 || t.indexOf('بيان') > -1) return 'certs';
    if (t.indexOf('المستخلص كامل') > -1 || t.indexOf('الرفع النهائي') > -1 || t.indexOf('العمالة الإجمالي') > -1 || t.indexOf('أسبقية') > -1) return 'main';
    return 'main';
  }

  function renameActionButton(btn) {
    var t = buttonText(btn);
    if (t === 'خطاب العمالة الإجمالي') btn.innerHTML = 'خطاب الرفع للمستخلص';
    if (t === 'خطابات المواقع المختارة') btn.innerHTML = 'طباعة خطابات المواقع المحددة';
    if (t === 'خطاب الموقع المحدد') btn.innerHTML = 'طباعة خطاب الموقع المحدد';
    if (t === 'إقرار عدم أسبقية الصرف') btn.innerHTML = 'إقرار عدم أسبقية الصرف';
  }

  function organizeButtons() {
    var overlay = document.getElementById('raise-letters-overlay');
    if (!overlay) return;
    var dialog = overlay.querySelector('.settings-dialog');
    if (!dialog) return;
    var toolbar = ensureToolbar(dialog);
    var groups = {
      main: createGroup(toolbar, 'main', 'المستخلص والخطابات الرئيسية'),
      certs: createGroup(toolbar, 'certs', 'الشهادات والبيانات'),
      sites: createGroup(toolbar, 'sites', 'خطابات المواقع'),
      system: createGroup(toolbar, 'system', 'إدارة النافذة')
    };

    var topRow = Array.prototype.slice.call(dialog.children).find(function (el) {
      return el.classList && el.classList.contains('btn-row') && !el.closest('#rl-professional-toolbar') && !el.closest('#rl-professional-settings-panel');
    });
    if (topRow) topRow.classList.add('rl-old-top-actions');

    var candidates = [];
    if (topRow) candidates = candidates.concat(Array.prototype.slice.call(topRow.querySelectorAll('button')));
    var extra = document.getElementById('admin-extra-docs-section');
    if (extra) {
      var extraRow = Array.prototype.slice.call(extra.children).find(function (el) { return el.classList && el.classList.contains('btn-row'); });
      if (extraRow) candidates = candidates.concat(Array.prototype.slice.call(extraRow.querySelectorAll('button')));
    }

    candidates.forEach(function (btn) {
      var kind = classifyButton(btn);
      if (kind === 'settings-save') {
        btn.style.display = 'none';
        return;
      }
      renameActionButton(btn);
      appendButton(groups[kind] || groups.main, btn);
    });
  }

  function ensureSettingsPanel() {
    var overlay = document.getElementById('raise-letters-overlay');
    if (!overlay) return;
    var dialog = overlay.querySelector('.settings-dialog');
    if (!dialog) return;
    ensureToolbar(dialog);

    var panel = dialog.querySelector('#rl-professional-settings-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'rl-professional-settings-panel';
      panel.className = 'rl-pro-settings-panel rl-collapsed';
      panel.innerHTML = [
        '<div class="rl-pro-settings-head">',
          '<div><h3>إعدادات الخطابات</h3><span>عدّل نصوص الخطابات والتواقيع ثم اضغط حفظ. بعد الحفظ ستختفي الإعدادات تلقائيًا.</span></div>',
          '<button type="button" class="btn btn-light" id="rl-close-settings-btn">إخفاء</button>',
        '</div>',
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
    }

    var content = panel.querySelector('#rl-professional-settings-content');
    if (!content) return;

    var general = findSectionByTitle(overlay, function (title, box) {
      return box.id !== 'admin-extra-docs-section' && box.id !== 'final-raise-letter-settings' &&
        (title.indexOf('إعدادات الخطابات') > -1 || title.indexOf('إعدادات الخطاب') > -1 || title.indexOf('إعدادات الخطابات المحفوظة') > -1);
    });
    var signatures = findSectionByTitle(overlay, function (title) { return title.indexOf('تواقيع') > -1 || title.indexOf('التواقيع') > -1; });
    var finalSettings = overlay.querySelector('#final-raise-letter-settings');

    if (general && general.parentNode !== content) {
      var h = general.querySelector('h3');
      if (h) h.textContent = 'إعدادات الخطابات العامة';
      content.appendChild(general);
    }
    if (finalSettings && finalSettings.parentNode !== content) {
      var fh = finalSettings.querySelector('h3');
      if (fh) fh.textContent = 'إعدادات خطاب الرفع النهائي للإدارة المالية';
      content.appendChild(finalSettings);
    }
    if (signatures && signatures.parentNode !== content) {
      content.appendChild(signatures);
    }

    Array.prototype.slice.call(content.querySelectorAll('.rl-section-save-row, .btn-row')).forEach(function (row) {
      if (row.closest('#rl-professional-settings-footer')) return;
      var txt = clean(row.textContent);
      if (txt.indexOf('حفظ') > -1) row.style.display = 'none';
    });
  }

  function toggleSettingsPanel(open) {
    var panel = document.getElementById('rl-professional-settings-panel');
    if (!panel) return;
    if (open) {
      panel.classList.remove('rl-collapsed');
      try { panel.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) { panel.scrollIntoView(); }
    } else {
      panel.classList.add('rl-collapsed');
    }
  }

  function saveSettingsAndHide() {
    var panel = document.getElementById('rl-professional-settings-panel');
    if (!panel) return;
    var patch = {};
    Array.prototype.slice.call(panel.querySelectorAll('[data-rl-setting]')).forEach(function (el) {
      patch[el.dataset.rlSetting] = el.value;
    });
    var current = readJson(SETTINGS_KEY, {});
    writeJson(SETTINGS_KEY, Object.assign({}, current, patch));

    var note = panel.querySelector('#rl-pro-save-note');
    if (note) {
      note.classList.add('show');
      note.textContent = 'تم حفظ إعدادات الخطابات والتواقيع بنجاح.';
    }
    setTimeout(function () {
      if (note) note.classList.remove('show');
      toggleSettingsPanel(false);
    }, 650);
  }

  function patchProfessionalLayout() {
    var overlay = document.getElementById('raise-letters-overlay');
    if (!overlay) return;
    ensureCss();
    ensureSettingsPanel();
    patchSignatureSection();
    organizeButtons();
  }

  function boot() {
    patchProfessionalLayout();
  }

  window.AdminOfficesRaiseLettersProfessionalLayout = {
    refresh: patchProfessionalLayout,
    openSettings: function () { patchProfessionalLayout(); toggleSettingsPanel(true); },
    closeSettings: function () { toggleSettingsPanel(false); },
    saveSettingsAndHide: saveSettingsAndHide
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  document.addEventListener('click', function () {
    setTimeout(patchProfessionalLayout, 80);
    setTimeout(patchProfessionalLayout, 350);
    setTimeout(patchProfessionalLayout, 900);
  }, true);
  setInterval(patchProfessionalLayout, 900);

  console.info('[Admin Offices Raise Letters Professional Layout] installed v2');
})();