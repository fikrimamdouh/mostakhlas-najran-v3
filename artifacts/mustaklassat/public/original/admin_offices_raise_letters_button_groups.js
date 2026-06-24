// ===================================================================
// Admin Offices Raise Letters Button Groups — V2
// Scope: admin_offices_attendance.html / raise letters overlay
// ينظف شاشة الخطابات:
// 1) مستندات المستخلص
// 2) الشهادات والبيانات العامة
// 3) خطابات ومرفقات المواقع + اختيار المواقع داخل نفس المجموعة
// 4) إدارة
// يخفي الأقسام القديمة: خطابات وبيانات إضافية / بيانات المستخلص / إعدادات مستقلة لكل خطاب.
// لا يغير دوال الطباعة ولا الحسابات؛ ينقل الأزرار والعناصر فقط ويحافظ على onclick.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_RAISE_LETTER_BUTTON_GROUPS_V2__) return;
  window.__ADMIN_OFFICES_RAISE_LETTER_BUTTON_GROUPS_V2__ = true;

  function clean(v) { return String(v || '').replace(/\s+/g, ' ').trim(); }

  function ensureCss() {
    if (document.getElementById('rl-button-groups-css')) return;
    var st = document.createElement('style');
    st.id = 'rl-button-groups-css';
    st.textContent = [
      '#raise-letters-overlay #rl-professional-toolbar{border:1px solid #d7e2f0!important;background:linear-gradient(180deg,#ffffff,#f8fafc)!important;border-radius:20px!important;padding:14px!important}',
      '#raise-letters-overlay #rl-professional-toolbar .rl-pro-actions{display:grid!important;grid-template-columns:repeat(2,minmax(280px,1fr))!important;gap:12px!important;align-items:stretch!important}',
      '#raise-letters-overlay #rl-professional-toolbar .rl-pro-group{min-height:unset!important;border:1px solid #dbe4f0!important;background:#fff!important;border-radius:16px!important;padding:12px!important;box-shadow:0 8px 18px rgba(15,23,42,.045)!important}',
      '#raise-letters-overlay #rl-professional-toolbar .rl-pro-group[data-rl-group="extract"]{border-top:4px solid #003087!important}',
      '#raise-letters-overlay #rl-professional-toolbar .rl-pro-group[data-rl-group="certificates"]{border-top:4px solid #0f766e!important}',
      '#raise-letters-overlay #rl-professional-toolbar .rl-pro-group[data-rl-group="sites"]{border-top:4px solid #d4af37!important;grid-column:1 / -1!important}',
      '#raise-letters-overlay #rl-professional-toolbar .rl-pro-group[data-rl-group="system"]{border-top:4px solid #64748b!important}',
      '#raise-letters-overlay #rl-professional-toolbar .rl-pro-group h4{margin:0 0 4px!important;padding:0!important;border:0!important;font-size:14px!important;font-weight:900!important;color:#0f172a!important}',
      '#raise-letters-overlay #rl-professional-toolbar .rl-pro-group .rl-group-hint{display:block;margin:0 0 9px!important;color:#64748b!important;font-size:11.5px!important;font-weight:800!important;line-height:1.55!important}',
      '#raise-letters-overlay #rl-professional-toolbar .rl-pro-buttons{display:flex!important;gap:8px!important;flex-wrap:wrap!important;align-items:center!important}',
      '#raise-letters-overlay #rl-professional-toolbar .rl-pro-buttons .btn{margin:0!important;border-radius:10px!important;padding:8px 12px!important;font-size:13px!important;line-height:1.3!important;min-height:36px!important}',
      '#raise-letters-overlay #rl-professional-toolbar .rl-extract-btn{background:#003087!important;color:#fff!important;border:1px solid #003087!important}',
      '#raise-letters-overlay #rl-professional-toolbar .rl-cert-btn{background:#ecfdf5!important;color:#065f46!important;border:1px solid #a7f3d0!important}',
      '#raise-letters-overlay #rl-professional-toolbar .rl-site-btn{background:#fff7d6!important;color:#7a4f00!important;border:1px solid #f3d675!important}',
      '#raise-letters-overlay #rl-professional-toolbar .rl-system-btn{background:#f1f5f9!important;color:#334155!important;border:1px solid #cbd5e1!important}',
      '#raise-letters-overlay #rl-professional-toolbar .rl-group-main-action{font-weight:950!important;box-shadow:0 5px 12px rgba(15,23,42,.10)!important}',
      '#raise-letters-overlay #admin-extra-docs-section{display:none!important}',
      '#raise-letters-overlay .rl-legacy-extra-hidden{display:none!important}',
      '#raise-letters-overlay .rl-sites-picker-host{margin-top:10px;border-top:1px dashed #e2e8f0;padding-top:10px;width:100%}',
      '#raise-letters-overlay .rl-sites-picker-host .section-box{display:block!important;margin:0!important;background:#fffbeb!important;border:1px solid #fde68a!important}',
      '#raise-letters-overlay .rl-sites-picker-host .section-box h3{margin:0 0 8px!important;font-size:13px!important;color:#7a4f00!important}',
      '#raise-letters-overlay .rl-sites-picker-host select,#raise-letters-overlay .rl-sites-picker-host input{max-width:100%}',
      '#raise-letters-overlay .rl-sites-picker-host label{font-size:12px!important;font-weight:800!important}',
      '#raise-letters-overlay .rl-sites-picker-host .settings-grid{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))!important}',
      '@media(max-width:900px){#raise-letters-overlay #rl-professional-toolbar .rl-pro-actions{grid-template-columns:1fr!important}#raise-letters-overlay #rl-professional-toolbar .rl-pro-group[data-rl-group="sites"]{grid-column:auto!important}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  var GROUPS = {
    extract: {
      title: '١. مستندات المستخلص',
      hint: 'كل ما يخص المستخلص كاملًا قبل تفاصيل المواقع.',
      cls: 'rl-extract-btn',
      order: ['طباعة المستخلص كامل', 'خطاب الرفع النهائي', 'إقرار عدم أسبقية الصرف', 'خطاب الرفع للمستخلص', 'خطاب العمالة الإجمالي']
    },
    certificates: {
      title: '٢. الشهادات والبيانات العامة',
      hint: 'شهادات وبيانات على مستوى المستخلص كله وليست لموقع منفرد.',
      cls: 'rl-cert-btn',
      order: ['شهادة الاستحقاق', 'بيان استحقاق', 'بيان الاستحقاق', 'شهادة تسليم الرواتب', 'شهادة الرواتب', 'بيان الوظائف', 'السعوديين', 'بيان الغيابات', 'بيان الإجازات', 'شهادة الأداء الشهري']
    },
    sites: {
      title: '٣. خطابات ومرفقات المواقع',
      hint: 'اختيار المواقع هنا فقط، وتطبع المستندات المتكررة لكل موقع.',
      cls: 'rl-site-btn',
      order: ['طباعة خطابات المواقع المحددة', 'خطابات المواقع المختارة', 'طباعة خطاب الموقع المحدد', 'خطاب الموقع المحدد', 'خطاب الموقع', 'حضور الموقع', 'أداء الموقع', 'إنجاز الموقع']
    },
    system: {
      title: '٤. إدارة',
      hint: 'إغلاق نافذة الخطابات فقط.',
      cls: 'rl-system-btn',
      order: ['إغلاق التبويب', 'إغلاق']
    }
  };

  function getDialog() {
    var overlay = document.getElementById('raise-letters-overlay');
    return overlay && overlay.querySelector('.settings-dialog');
  }

  function ensureToolbar(dialog) {
    var toolbar = dialog.querySelector('#rl-professional-toolbar');
    if (!toolbar) return null;
    var actions = toolbar.querySelector('.rl-pro-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'rl-pro-actions';
      toolbar.appendChild(actions);
    }
    return toolbar;
  }

  function ensureGroup(toolbar, id) {
    var actions = toolbar.querySelector('.rl-pro-actions');
    var group = toolbar.querySelector('[data-rl-group="' + id + '"]');
    if (!group) {
      group = document.createElement('div');
      group.className = 'rl-pro-group';
      group.setAttribute('data-rl-group', id);
      group.innerHTML = '<h4></h4><small class="rl-group-hint"></small><div class="rl-pro-buttons"></div>';
      actions.appendChild(group);
    }
    var meta = GROUPS[id];
    var h = group.querySelector('h4') || document.createElement('h4');
    h.textContent = meta.title;
    if (!h.parentNode) group.insertBefore(h, group.firstChild);
    var hint = group.querySelector('.rl-group-hint');
    if (!hint) {
      hint = document.createElement('small');
      hint.className = 'rl-group-hint';
      h.parentNode.insertBefore(hint, h.nextSibling);
    }
    hint.textContent = meta.hint;
    var box = group.querySelector('.rl-pro-buttons');
    if (!box) {
      box = document.createElement('div');
      box.className = 'rl-pro-buttons';
      group.appendChild(box);
    }
    return box;
  }

  function canonicalButtonText(btn) {
    var t = clean(btn && btn.textContent);
    if (t === 'خطاب العمالة الإجمالي') return 'خطاب الرفع للمستخلص';
    if (t === 'خطابات المواقع المختارة') return 'طباعة خطابات المواقع المحددة';
    if (t === 'خطاب الموقع المحدد') return 'طباعة خطاب الموقع المحدد';
    if (t === 'إغلاق') return 'إغلاق التبويب';
    return t;
  }

  function rename(btn) {
    var t = clean(btn.textContent);
    if (t === 'خطاب العمالة الإجمالي') btn.innerHTML = 'خطاب الرفع للمستخلص';
    if (t === 'خطابات المواقع المختارة') btn.innerHTML = 'طباعة خطابات المواقع المحددة';
    if (t === 'خطاب الموقع المحدد') btn.innerHTML = 'طباعة خطاب الموقع المحدد';
    if (t === 'إغلاق') btn.innerHTML = 'إغلاق التبويب';
  }

  function classify(btn) {
    var t = canonicalButtonText(btn);
    if (!t) return '';
    if (t.indexOf('حفظ') > -1 || t.indexOf('إعدادات') > -1 || t.indexOf('إخفاء') > -1) return '';
    if (t.indexOf('إغلاق') > -1) return 'system';
    if (t.indexOf('الموقع') > -1 || t.indexOf('المواقع') > -1 || t.indexOf('حضور الموقع') > -1 || t.indexOf('أداء الموقع') > -1 || t.indexOf('إنجاز الموقع') > -1) return 'sites';
    if (t.indexOf('شهادة') > -1 || t.indexOf('بيان') > -1 || t.indexOf('السعوديين') > -1 || t.indexOf('الغيابات') > -1 || t.indexOf('الإجازات') > -1 || t.indexOf('الرواتب') > -1 || t.indexOf('الاستحقاق') > -1) return 'certificates';
    if (t.indexOf('المستخلص كامل') > -1 || t.indexOf('الرفع النهائي') > -1 || t.indexOf('خطاب الرفع للمستخلص') > -1 || t.indexOf('العمالة الإجمالي') > -1 || t.indexOf('أسبقية') > -1) return 'extract';
    return 'extract';
  }

  function priority(groupId, btn) {
    var t = canonicalButtonText(btn);
    var list = (GROUPS[groupId] && GROUPS[groupId].order) || [];
    for (var i = 0; i < list.length; i++) {
      if (t.indexOf(list[i]) > -1) return i;
    }
    return 999;
  }

  function collectButtons(dialog) {
    var buttons = [];
    var seen = Object.create(null);
    Array.prototype.slice.call(dialog.querySelectorAll('button')).forEach(function (btn) {
      if (!btn.closest('#raise-letters-overlay')) return;
      if (btn.id === 'rl-open-settings-btn' || btn.id === 'rl-close-settings-btn' || btn.id === 'rl-save-hide-settings-btn' || btn.id === 'rl-cancel-hide-settings-btn' || btn.id === 'rl-open-grand-signatures') return;
      if (btn.closest('#rl-professional-settings-panel')) return;
      if (clean(btn.textContent).indexOf('حفظ') > -1) return;
      var group = classify(btn);
      if (!group) return;
      var text = canonicalButtonText(btn);
      var signature = group + '::' + text;
      if (seen[signature]) {
        btn.classList.add('rl-legacy-extra-hidden');
        btn.style.display = 'none';
        return;
      }
      seen[signature] = true;
      buttons.push({ btn: btn, group: group, p: priority(group, btn), text: text });
    });
    return buttons;
  }

  function resetClasses(btn) {
    btn.classList.remove('rl-extract-btn', 'rl-cert-btn', 'rl-site-btn', 'rl-system-btn', 'rl-group-main-action', 'rl-legacy-extra-hidden');
    btn.style.display = '';
  }

  function applyGroupStyle(btn, groupId) {
    resetClasses(btn);
    btn.classList.add(GROUPS[groupId].cls);
    var t = canonicalButtonText(btn);
    if (t.indexOf('طباعة المستخلص كامل') > -1 || t.indexOf('خطاب الرفع النهائي') > -1 || t.indexOf('شهادة الاستحقاق') > -1 || t.indexOf('طباعة خطابات المواقع') > -1) {
      btn.classList.add('rl-group-main-action');
    }
  }

  function sortButtons(box, groupId) {
    var arr = Array.prototype.slice.call(box.querySelectorAll('button'));
    arr.sort(function (a, b) {
      var pa = priority(groupId, a), pb = priority(groupId, b);
      if (pa !== pb) return pa - pb;
      return canonicalButtonText(a).localeCompare(canonicalButtonText(b), 'ar');
    });
    arr.forEach(function (b) { box.appendChild(b); });
  }

  function findSitePickerSection(dialog) {
    var extra = document.getElementById('admin-extra-docs-section');
    var source = extra || dialog;
    var sections = Array.prototype.slice.call(source.querySelectorAll('.section-box'));
    return sections.find(function (sec) {
      var t = clean(sec.textContent);
      return t.indexOf('اختيار المواقع') > -1 || t.indexOf('الموقع المحدد لخطاب واحد') > -1 || t.indexOf('تحديد سريع') > -1;
    }) || null;
  }

  function moveSitePicker(dialog, sitesGroup) {
    if (!sitesGroup) return;
    var host = sitesGroup.querySelector('.rl-sites-picker-host');
    if (!host) {
      host = document.createElement('div');
      host.className = 'rl-sites-picker-host';
      sitesGroup.appendChild(host);
    }
    var section = findSitePickerSection(dialog);
    if (!section) return;
    if (section.parentNode !== host) host.appendChild(section);
    var h = section.querySelector('h3');
    if (h) h.textContent = 'اختيار المواقع لخطابات المواقع';
  }

  function hideLegacySections(dialog) {
    var extra = document.getElementById('admin-extra-docs-section');
    if (extra) {
      extra.classList.add('rl-legacy-extra-hidden');
      Array.prototype.slice.call(extra.children).forEach(function (child) {
        if (!child.classList || !child.classList.contains('section-box')) return;
        var t = clean(child.textContent);
        if (t.indexOf('اختيار المواقع') === -1 && t.indexOf('الموقع المحدد') === -1 && t.indexOf('تحديد سريع') === -1) child.classList.add('rl-legacy-extra-hidden');
      });
    }
    Array.prototype.slice.call(dialog.querySelectorAll('.section-box')).forEach(function (sec) {
      if (sec.closest('#rl-professional-settings-panel')) return;
      if (sec.closest('#rl-professional-toolbar')) return;
      var t = clean(sec.textContent);
      if (t.indexOf('بيانات المستخلص الحالية') > -1 || t.indexOf('إعدادات مستقلة لكل خطاب') > -1 || t.indexOf('الخانات الفارغة تستخدم الإعدادات العامة') > -1) {
        sec.classList.add('rl-legacy-extra-hidden');
      }
    });
  }

  function organize() {
    var dialog = getDialog();
    if (!dialog) return;
    ensureCss();
    var toolbar = ensureToolbar(dialog);
    if (!toolbar) return;

    var boxes = {
      extract: ensureGroup(toolbar, 'extract'),
      certificates: ensureGroup(toolbar, 'certificates'),
      sites: ensureGroup(toolbar, 'sites'),
      system: ensureGroup(toolbar, 'system')
    };

    Array.prototype.slice.call(toolbar.querySelectorAll('[data-rl-group]')).forEach(function (g) {
      var id = g.getAttribute('data-rl-group');
      if (!GROUPS[id]) g.style.display = 'none';
      else g.style.display = '';
    });

    var buttons = collectButtons(dialog);
    buttons.forEach(function (item) {
      rename(item.btn);
      applyGroupStyle(item.btn, item.group);
      boxes[item.group].appendChild(item.btn);
    });

    moveSitePicker(dialog, boxes.sites);
    hideLegacySections(dialog);

    Object.keys(boxes).forEach(function (id) {
      sortButtons(boxes[id], id);
      var empty = boxes[id].querySelector('.rl-pro-empty');
      if (boxes[id].querySelector('button') && empty) empty.remove();
      if (!boxes[id].querySelector('button') && !empty && id !== 'sites') {
        boxes[id].innerHTML = '<span class="rl-pro-empty">لا توجد أزرار في هذه المجموعة</span>';
      }
    });
  }

  window.AdminOfficesRaiseLettersButtonGroups = { organize: organize };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', organize);
  else organize();
  document.addEventListener('click', function () {
    setTimeout(organize, 80);
    setTimeout(organize, 350);
    setTimeout(organize, 1000);
  }, true);
  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    organize();
    if (tries >= 80) clearInterval(timer);
  }, 350);
  console.info('[Admin Offices Raise Letters Button Groups] installed v2 clean screen');
})();