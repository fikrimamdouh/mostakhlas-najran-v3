// ===================================================================
// Admin Offices Raise Letters Clean Signatures — V3
// Scope: admin_offices_attendance.html?raiseLettersClean=1
// يضيف قسم إعدادات التواقيع داخل شاشة مركز الخطابات النظيفة.
// يمنع إعادة بناء الحقول أثناء الكتابة حتى لا تُمسح أو تفقد التركيز.
// لا يغير أماكن التواقيع في الطباعة ولا مفاتيح الحفظ.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;
  if (new URLSearchParams(location.search || '').get('raiseLettersClean') !== '1') return;
  if (window.__ADMIN_OFFICES_CLEAN_SIGNATURES_V3__) return;
  window.__ADMIN_OFFICES_CLEAN_SIGNATURES_V3__ = true;

  var SETTINGS_KEY = 'adminOfficesRaiseLettersSettings_v1';
  var currentDoc = 'general';
  var installing = false;

  var DOCS = [
    { key: 'general', label: 'خطابات الرفع العامة / خطاب الموقع', hint: 'يستخدمها خطاب رفع عمالة المكاتب الإدارية وخطابات المواقع.', fields: [
      ['managerTitle', 'صفة توقيع الخطاب'],
      ['managerName', 'اسم توقيع الخطاب']
    ]},
    { key: 'final', label: 'خطاب الرفع النهائي', hint: 'توقيع مستقل لخطاب الرفع النهائي.', fields: [
      ['finalLetterSignatureTitle', 'صفة توقيع خطاب الرفع النهائي'],
      ['finalLetterSignatureName', 'اسم توقيع خطاب الرفع النهائي']
    ]},
    { key: 'declaration', label: 'إقرار عدم أسبقية الصرف', hint: 'توقيع الإقرار مع التوقيع العام.', fields: [
      ['unitManagerTitle', 'صفة توقيع الإقرار'],
      ['unitManagerName', 'اسم توقيع الإقرار'],
      ['managerTitle', 'صفة التوقيع العام'],
      ['managerName', 'اسم التوقيع العام']
    ]},
    { key: 'salary', label: 'شهادة تسليم الرواتب / بيان السعوديين', hint: 'تستخدم التوقيع العام الحالي.', fields: [
      ['managerTitle', 'صفة التوقيع'],
      ['managerName', 'اسم التوقيع']
    ]},
    { key: 'notes', label: 'بيان الغيابات / بيان الإجازات', hint: 'تستخدم التوقيع العام الحالي.', fields: [
      ['managerTitle', 'صفة التوقيع'],
      ['managerName', 'اسم التوقيع']
    ]},
    { key: 'grand', label: 'الشهادة الإجمالية / شهادة الاستحقاق المجمعة', hint: 'تواقيعها مستقلة من نافذة الشهادة الإجمالية، وهنا يظهر زر الوصول لها.', fields: [] }
  ];

  function readJson(key, fallback) { try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; } }
  function writeJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value || {})); return true; } catch (_) { return false; } }
  function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function settings() { return readJson(SETTINGS_KEY, {}); }
  function doc() { return DOCS.find(function (d) { return d.key === currentDoc; }) || DOCS[0]; }

  function ensureCss() {
    if (document.getElementById('admin-clean-signatures-css-v3')) return;
    var st = document.createElement('style');
    st.id = 'admin-clean-signatures-css-v3';
    st.textContent = [
      '#admin-raise-clean .rl-clean-signatures-box{background:#fff;border:2px solid #bfdbfe;border-right:7px solid #003087;border-radius:18px;padding:14px;margin:14px 0;box-shadow:0 12px 28px rgba(0,48,135,.08);font-family:Tajawal,Arial,sans-serif;position:relative;z-index:5000;pointer-events:auto!important}',
      '#admin-raise-clean .rl-clean-signatures-box *{pointer-events:auto!important}',
      '#admin-raise-clean .rl-clean-signatures-head{display:flex;justify-content:space-between;align-items:center;gap:10px;border-bottom:1px solid #dbeafe;padding-bottom:10px;margin-bottom:12px}',
      '#admin-raise-clean .rl-clean-signatures-head h3{margin:0;color:#003087;font-size:18px;font-weight:950}',
      '#admin-raise-clean .rl-clean-signatures-head p{margin:4px 0 0;color:#475569;font-size:12px;font-weight:800;line-height:1.7}',
      '#admin-raise-clean .rl-clean-signatures-toggle,#admin-raise-clean .rl-clean-signatures-top-btn{background:#003087!important;color:#fff!important;border:0!important;border-radius:10px!important;padding:9px 13px!important;font-weight:950!important;cursor:pointer;font-family:Tajawal,Arial,sans-serif!important}',
      '#admin-raise-clean .rl-clean-signatures-top-btn{margin-inline-start:8px!important;background:#0f766e!important}',
      '#admin-raise-clean .rl-clean-signatures-body{display:none;grid-template-columns:minmax(240px,.8fr) 1.2fr;gap:12px;align-items:start}',
      '#admin-raise-clean .rl-clean-signatures-box.open .rl-clean-signatures-body{display:grid}',
      '#admin-raise-clean .rl-clean-signatures-select-card,#admin-raise-clean .rl-clean-signatures-form-card,#admin-raise-clean .rl-clean-signatures-preview{background:#f8fafc;border:1px solid #dbeafe;border-radius:14px;padding:12px}',
      '#admin-raise-clean .rl-clean-signatures-select-card label{display:block;font-weight:950;color:#0f172a;margin-bottom:7px}',
      '#admin-raise-clean #rl-clean-sign-doc{width:100%;padding:10px;border:1px solid #94a3b8;border-radius:10px;font-family:Tajawal,Arial,sans-serif;font-weight:900;background:#fff}',
      '#admin-raise-clean .rl-clean-sign-hint{margin-top:8px;color:#475569;font-size:12px;font-weight:800;line-height:1.7}',
      '#admin-raise-clean .rl-clean-sign-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}',
      '#admin-raise-clean .rl-clean-sign-field span{display:block;font-size:12px;font-weight:950;color:#1e3a8a;margin-bottom:6px}',
      '#admin-raise-clean .rl-clean-sign-field input{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:10px;padding:9px;font-family:Tajawal,Arial,sans-serif;font-weight:850;background:#fff;color:#111827!important;cursor:text!important;user-select:text!important;-webkit-user-select:text!important;position:relative;z-index:6000}',
      '#admin-raise-clean .rl-clean-sign-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:10px}',
      '#admin-raise-clean .rl-clean-sign-actions button{border:0;border-radius:10px;padding:9px 13px;font-family:Tajawal,Arial,sans-serif;font-weight:950;cursor:pointer}',
      '#admin-raise-clean .rl-clean-sign-save{background:#16a34a;color:white}.rl-clean-sign-preview-btn{background:#e2e8f0;color:#0f172a}.rl-clean-grand-btn{background:#003087;color:white}',
      '#admin-raise-clean .rl-clean-sign-preview-title{text-align:center;font-weight:950;color:#0f172a;margin-bottom:8px}',
      '#admin-raise-clean .rl-clean-sign-preview-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}',
      '#admin-raise-clean .rl-clean-sign-preview-box{text-align:center;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:10px}',
      '#admin-raise-clean .rl-clean-sign-preview-box .t{font-weight:950;color:#003087}.rl-clean-sign-preview-box .l{height:28px;border-bottom:1px solid #111;margin:8px 18px}.rl-clean-sign-preview-box .n{font-weight:850;color:#111827}',
      '@media(max-width:860px){#admin-raise-clean .rl-clean-signatures-body{grid-template-columns:1fr}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  function currentValuesFromBox(box) {
    var s = settings();
    Array.prototype.slice.call((box || document).querySelectorAll('[data-clean-sign-field]')).forEach(function (input) {
      s[input.getAttribute('data-clean-sign-field')] = input.value;
    });
    return s;
  }

  function saveBoxValues(box) {
    return writeJson(SETTINGS_KEY, currentValuesFromBox(box));
  }

  function previewHtml(d, s) {
    if (d.key === 'grand') {
      return '<div class="rl-clean-sign-preview-title">تواقيع الشهادة الإجمالية</div><div style="text-align:center;font-weight:850;line-height:1.8;color:#334155">هذه التواقيع لها نافذة مستقلة حتى لا تختلط مع خطابات الرفع.<br><button type="button" class="rl-clean-grand-btn" id="rl-clean-open-grand-signs">فتح إعدادات تواقيع الشهادة الإجمالية</button></div>';
    }
    var pairs = [];
    if (d.key === 'final') pairs.push({ t: s.finalLetterSignatureTitle || 'توقيع خطاب الرفع النهائي', n: s.finalLetterSignatureName || '' });
    else if (d.key === 'declaration') {
      pairs.push({ t: s.unitManagerTitle || 'توقيع الإقرار', n: s.unitManagerName || '' });
      pairs.push({ t: s.managerTitle || 'التوقيع العام', n: s.managerName || '' });
    } else pairs.push({ t: s.managerTitle || 'صفة التوقيع', n: s.managerName || '' });
    return '<div class="rl-clean-sign-preview-title">معاينة التواقيع</div><div class="rl-clean-sign-preview-grid">' + pairs.map(function (p) {
      return '<div class="rl-clean-sign-preview-box"><div class="t">' + esc(p.t) + '</div><div class="l"></div><div class="n">' + esc(p.n || '................') + '</div></div>';
    }).join('') + '</div>';
  }

  function isEditingInside(box) {
    var a = document.activeElement;
    return !!(a && box && box.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/i.test(a.tagName || ''));
  }

  function unlockFields(box) {
    Array.prototype.slice.call((box || document).querySelectorAll('[data-clean-sign-field]')).forEach(function (input) {
      input.removeAttribute('disabled');
      input.removeAttribute('readonly');
      input.removeAttribute('inert');
      input.readOnly = false;
    });
  }

  function bindBody(box) {
    if (!box || box.getAttribute('data-rl-clean-bound') === '1') return;
    box.setAttribute('data-rl-clean-bound', '1');

    ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'keydown', 'keyup', 'input', 'change', 'paste', 'compositionend'].forEach(function (type) {
      box.addEventListener(type, function (ev) {
        var target = ev.target;
        var editable = target && target.closest && target.closest('[data-clean-sign-field],#rl-clean-sign-doc,.rl-clean-sign-save,.rl-clean-sign-preview-btn,.rl-clean-grand-btn,.rl-clean-signatures-toggle');
        if (!editable) return;

        if (type === 'input' || type === 'change' || type === 'keyup' || type === 'paste' || type === 'compositionend') {
          setTimeout(function () {
            saveBoxValues(box);
            var prev = box.querySelector('.rl-clean-signatures-preview');
            if (prev) prev.innerHTML = previewHtml(doc(), currentValuesFromBox(box));
            bindGrand(box);
          }, 0);
        }
        ev.stopPropagation();
      }, false);
    });
  }

  function renderBody(box, force) {
    var d = doc();
    var body = box.querySelector('.rl-clean-signatures-body');
    if (!body) return;

    if (!force && body.getAttribute('data-rendered-doc') === currentDoc && body.querySelector('#rl-clean-sign-doc')) {
      unlockFields(box);
      bindBody(box);
      return;
    }

    var s = settings();
    var fields = d.fields.length ? d.fields.map(function (f) {
      return '<label class="rl-clean-sign-field"><span>' + esc(f[1]) + '</span><input type="text" autocomplete="off" data-clean-sign-field="' + esc(f[0]) + '" value="' + esc(s[f[0]] || '') + '"></label>';
    }).join('') : '<div style="font-weight:850;color:#334155;line-height:1.8">هذا النوع له نافذة تواقيع مستقلة. استخدم زر فتح إعدادات تواقيع الشهادة الإجمالية.</div>';

    body.innerHTML = '<div class="rl-clean-signatures-select-card"><label>اختر الشهادة / الخطاب</label><select id="rl-clean-sign-doc">' + DOCS.map(function (x) { return '<option value="' + esc(x.key) + '" ' + (x.key === currentDoc ? 'selected' : '') + '>' + esc(x.label) + '</option>'; }).join('') + '</select><div class="rl-clean-sign-hint">' + esc(d.hint) + '</div><div class="rl-clean-sign-actions"><button type="button" class="rl-clean-sign-save">حفظ التواقيع</button><button type="button" class="rl-clean-sign-preview-btn">تحديث المعاينة</button></div></div><div><div class="rl-clean-signatures-form-card"><div class="rl-clean-sign-fields">' + fields + '</div></div><div class="rl-clean-signatures-preview">' + previewHtml(d, s) + '</div></div>';
    body.setAttribute('data-rendered-doc', currentDoc);
    box.removeAttribute('data-rl-clean-bound');

    var selector = box.querySelector('#rl-clean-sign-doc');
    if (selector) selector.onchange = function () { saveBoxValues(box); currentDoc = this.value || 'general'; renderBody(box, true); };

    Array.prototype.slice.call(box.querySelectorAll('[data-clean-sign-field]')).forEach(function (input) {
      input.oninput = function () {
        saveBoxValues(box);
        var preview = box.querySelector('.rl-clean-signatures-preview');
        if (preview) preview.innerHTML = previewHtml(doc(), currentValuesFromBox(box));
        bindGrand(box);
      };
    });

    var saveBtn = box.querySelector('.rl-clean-sign-save');
    if (saveBtn) saveBtn.onclick = function () {
      saveBoxValues(box);
      flash('تم حفظ إعدادات التواقيع.');
    };
    var prevBtn = box.querySelector('.rl-clean-sign-preview-btn');
    if (prevBtn) prevBtn.onclick = function () {
      var preview = box.querySelector('.rl-clean-signatures-preview');
      if (preview) preview.innerHTML = previewHtml(doc(), currentValuesFromBox(box));
      bindGrand(box);
    };
    bindGrand(box);
    bindBody(box);
    unlockFields(box);
  }

  function flash(msg) {
    var f = document.getElementById('rl-clean-flash');
    if (f) { f.textContent = msg; f.classList.add('show'); setTimeout(function () { f.classList.remove('show'); }, 1600); }
    else alert(msg);
  }

  function bindGrand(box) {
    var btn = box && box.querySelector('#rl-clean-open-grand-signs');
    if (!btn) return;
    btn.onclick = function () {
      if (typeof window.openAdminOfficesGrandCertificateSignatures === 'function') window.openAdminOfficesGrandCertificateSignatures();
      else alert('نافذة تواقيع الشهادة الإجمالية غير محملة في هذه الشاشة. افتح الشهادة الإجمالية من صفحة المكاتب لتعديلها.');
    };
  }

  function patchLabels(root) {
    Array.prototype.slice.call(root.querySelectorAll('button,option,label,h3,h4,div,span')).forEach(function (el) {
      if (el.childElementCount > 0) return;
      var t = String(el.textContent || '').trim();
      if (t === 'خطاب الرفع للمستخلص') el.textContent = 'خطاب رفع عمالة المكاتب الإدارية';
      if (t === 'صفحات خطاب الرفع للمستخلص') el.textContent = 'صفحات خطاب رفع عمالة المكاتب الإدارية';
    });
  }

  function openSignaturesBox() {
    var box = document.getElementById('rl-clean-signatures-box');
    if (!box) { install(); box = document.getElementById('rl-clean-signatures-box'); }
    if (!box) return;
    box.classList.add('open');
    renderBody(box, false);
    try { box.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) { box.scrollIntoView(); }
  }

  function ensureTopButton(root, box) {
    if (root.querySelector('#rl-clean-open-signatures-top')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'rl-clean-open-signatures-top';
    btn.className = 'rl-clean-signatures-top-btn';
    btn.textContent = 'تعديل التواقيع';
    btn.onclick = openSignaturesBox;
    var closeBtn = Array.prototype.slice.call(root.querySelectorAll('button')).find(function (b) { return String(b.textContent || '').trim() === 'إغلاق'; });
    if (closeBtn && closeBtn.parentNode) closeBtn.parentNode.insertBefore(btn, closeBtn);
    else if (box && box.parentNode) box.parentNode.insertBefore(btn, box);
    else root.insertBefore(btn, root.firstChild);
  }

  function install() {
    if (installing) return false;
    installing = true;
    try {
      var root = document.getElementById('admin-raise-clean');
      if (!root) return false;
      ensureCss();
      patchLabels(root);

      var box = document.getElementById('rl-clean-signatures-box');
      var created = false;
      if (!box || !root.contains(box)) {
        box = document.createElement('div');
        created = true;
        box.id = 'rl-clean-signatures-box';
        box.className = 'rl-clean-signatures-box';
        box.innerHTML = '<div class="rl-clean-signatures-head"><div><h3>إعدادات التواقيع</h3><p>قسم مستقل لتعديل تواقيع خطابات الرفع والشهادات بدون تغيير أماكنها في الطباعة.</p></div><button type="button" class="rl-clean-signatures-toggle">فتح / إخفاء</button></div><div class="rl-clean-signatures-body"></div>';
        var anchor = root.querySelector('.rl-toolbar,.rl-clean-toolbar,.rl-actions,.rl-top-actions') || root.querySelector('h2') || root.firstElementChild;
        if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(box, anchor.nextSibling);
        else root.insertBefore(box, root.firstChild);
      }

      var toggle = box.querySelector('.rl-clean-signatures-toggle');
      if (toggle && !toggle.__rlBound) {
        toggle.onclick = function () { box.classList.toggle('open'); renderBody(box, false); };
        toggle.__rlBound = true;
      }

      // لا تعيد بناء الحقول أثناء الكتابة. هذا كان سبب بقاء القيم كنقط وعدم قبول التعديل.
      if (created || !isEditingInside(box)) renderBody(box, false);
      else { unlockFields(box); bindBody(box); }

      ensureTopButton(root, box);
      return true;
    } finally {
      installing = false;
    }
  }

  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    install();
    if (document.getElementById('admin-raise-clean') && document.getElementById('rl-clean-signatures-box') && tries > 20) clearInterval(timer);
    if (tries > 160) clearInterval(timer);
  }, 150);

  var mo = new MutationObserver(function (mutations) {
    var box = document.getElementById('rl-clean-signatures-box');
    if (box && isEditingInside(box)) return;
    setTimeout(install, 80);
  });
  try { mo.observe(document.documentElement, { childList: true, subtree: true }); } catch (_) {}
  document.addEventListener('click', function (ev) {
    var box = document.getElementById('rl-clean-signatures-box');
    if (box && ev.target && box.contains(ev.target)) return;
    setTimeout(install, 80);
    setTimeout(install, 350);
  }, true);

  window.AdminOfficesCleanSignatureSettings = { open: openSignaturesBox, refresh: install };
  console.info('[Admin Offices Raise Letters Clean Signatures] installed v3 stable editable editor');
})();
