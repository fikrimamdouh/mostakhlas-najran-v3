// ===================================================================
// Admin Offices Raise Letters Button Groups — V1
// Scope: admin_offices_attendance.html / raise letters overlay
// يعيد تقسيم أزرار الخطابات بوضوح:
// 1) مستندات المستخلص
// 2) الشهادات والبيانات العامة
// 3) خطابات ومرفقات المواقع
// 4) إدارة
// لا يغير دوال الطباعة ولا الحسابات؛ ينقل الأزرار فقط ويحافظ على onclick.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_RAISE_LETTER_BUTTON_GROUPS_V1__) return;
  window.__ADMIN_OFFICES_RAISE_LETTER_BUTTON_GROUPS_V1__ = true;

  function clean(v) {
    return String(v || '').replace(/\s+/g, ' ').trim();
  }
  function esc(v) {
    return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

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
      '#raise-letters-overlay #rl-professional-toolbar .rl-pro-group[data-rl-group="sites"]{border-top:4px solid #d4af37!important}',
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
      '@media(max-width:900px){#raise-letters-overlay #rl-professional-toolbar .rl-pro-actions{grid-template-columns:1fr!important}}'
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
      order: ['شهادة الاستحقاق', 'بيان الاستحقاق', 'شهادة الرواتب', 'بيان الوظائف', 'السعوديين', 'بيان الغيابات', 'بيان الإجازات', 'شهادة الأداء الشهري']
    },
    sites: {
      title: '٣. خطابات ومرفقات المواقع',
      hint: 'تستخدم اختيار المواقع، وتطبع المستندات المتكررة لكل موقع.',
      cls: 'rl-site-btn',
      order: ['طباعة خطابات المواقع المحددة', 'خطابات المواقع المختارة', 'طباعة خطاب الموقع المحدد', 'خطاب الموقع المحدد', 'خطاب الموقع', 'حضور الموقع', 'أداء الموقع', 'إنجاز الموقع']
    },
    system: {
      title: '٤. إدارة',
      hint: 'إغلاق أو إجراءات مساعدة.',
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
    var t = clean(btn.textContent);
    if (t === 'خطاب العمالة الإجمالي') return 'خطاب الرفع للمستخلص';
    if (t === 'خطابات المواقع المختارة') return 'طباعة خطابات المواقع المحددة';
    if (t === 'خطاب الموقع المحدد') return 'طباعة خطاب الموقع المحدد';
    return t;
  }

  function rename(btn) {
    var t = clean(btn.textContent);
    if (t === 'خطاب العمالة الإجمالي') btn.innerHTML = 'خطاب الرفع للمستخلص';
    if (t === 'خطابات المواقع المختارة') btn.innerHTML = 'طباعة خطابات المواقع المحددة';
    if (t === 'خطاب الموقع المحدد') btn.innerHTML = 'طباعة خطاب الموقع المحدد';
  }

  function classify(btn) {
    var t = canonicalButtonText(btn);
    if (!t) return '';
    if (t.indexOf('حفظ') > -1 || t.indexOf('إعدادات') > -1) return '';
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

  function collectButtons(dialog, toolbar) {
    var buttons = [];
    Array.prototype.slice.call(dialog.querySelectorAll('button')).forEach(function (btn) {
      if (!btn.closest('#raise-letters-overlay')) return;
      if (btn.id === 'rl-open-settings-btn' || btn.id === 'rl-close-settings-btn' || btn.id === 'rl-save-hide-settings-btn' || btn.id === 'rl-cancel-hide-settings-btn') return;
      if (btn.closest('#rl-professional-settings-panel')) return;
      if (clean(btn.textContent).indexOf('حفظ') > -1) return;
      var group = classify(btn);
      if (!group) return;
      buttons.push({ btn: btn, group: group, p: priority(group, btn), text: canonicalButtonText(btn) });
    });
    return buttons;
  }

  function resetClasses(btn) {
    btn.classList.remove('rl-extract-btn', 'rl-cert-btn', 'rl-site-btn', 'rl-system-btn', 'rl-group-main-action');
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

    // Hide old duplicated groups created by earlier layout names if still present.
    Array.prototype.slice.call(toolbar.querySelectorAll('[data-rl-group]')).forEach(function (g) {
      var id = g.getAttribute('data-rl-group');
      if (!GROUPS[id]) g.style.display = 'none';
      else g.style.display = '';
    });

    var buttons = collectButtons(dialog, toolbar);
    buttons.forEach(function (item) {
      rename(item.btn);
      applyGroupStyle(item.btn, item.group);
      boxes[item.group].appendChild(item.btn);
    });
    Object.keys(boxes).forEach(function (id) {
      sortButtons(boxes[id], id);
      if (!boxes[id].querySelector('button') && !boxes[id].querySelector('.rl-pro-empty')) {
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
  console.info('[Admin Offices Raise Letters Button Groups] installed v1');
})();