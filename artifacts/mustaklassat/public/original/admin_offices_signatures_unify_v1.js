// ===================================================================
// Admin Offices Signatures Unify — V1
// Scope: admin_offices_attendance.html only
// توحيد التواقيع: نموذج واحد يطبّق تواقيع مكتب مصدر على كل المكاتب دفعة واحدة
// أو على مكتب محدد فقط — ويشمل الأنواع الثلاثة (حضور/أداء/إنجاز) معًا.
// يعتمد نفس مفاتيح التخزين والرفع المستخدمة في admin_offices_page_signatures.js
// (sb_sigs_admin_offices_{office}_{type} + sb_prefs_...) ولا يغيّر أي منطق قائم.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_SIGNATURES_UNIFY_V1__) return;
  window.__ADMIN_OFFICES_SIGNATURES_UNIFY_V1__ = true;

  var PREFIX = 'sb_sigs_';
  var PREFS = 'sb_prefs_';
  var DIALOG_ID = 'admin-offices-signatures-unify-dialog';
  var BTN_ID = 'admin-offices-signatures-unify-btn';
  var TYPES = [
    { id: 'attendance', label: 'الحضور والانصراف' },
    { id: 'performance', label: 'تقييم الأداء' },
    { id: 'achievement', label: 'شهادة الإنجاز' }
  ];

  function readJson(key, fallback) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }
  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; }
  }
  function esc(v) {
    return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function getNames() {
    try { if (typeof getCenterNames === 'function') return getCenterNames() || {}; } catch (_) {}
    return readJson('adminOfficeNames_v1', {});
  }
  function sigKey(officeKey, type) {
    // نفس بناء المفتاح في admin_offices_page_signatures.js → signatureKey()
    if (window.AdminOfficesPageSignatures && typeof window.AdminOfficesPageSignatures.signatureKey === 'function') {
      try { return window.AdminOfficesPageSignatures.signatureKey(type, officeKey); } catch (_) {}
    }
    return 'admin_offices_' + officeKey + '_' + type;
  }
  function readSourceSigs(officeKey, type) {
    var key = sigKey(officeKey, type);
    var sigs = [];
    try { if (window.SignatureBlock && typeof window.SignatureBlock.getSigs === 'function') sigs = window.SignatureBlock.getSigs(key) || []; } catch (_) {}
    if (!Array.isArray(sigs) || !sigs.length) sigs = readJson(PREFIX + key, []);
    var prefs = readJson(PREFS + key, {});
    return { sigs: Array.isArray(sigs) ? sigs : [], prefs: prefs || {} };
  }
  function getToken() {
    try {
      var s = JSON.parse(localStorage.getItem('najran_session') || '{}');
      if (!s.clerkToken) return null;
      return (Date.now() - (s.timestamp || 0)) < 55000 ? s.clerkToken : null;
    } catch (_) { return null; }
  }
  function pushToHospitalStorage(payload) {
    var token = getToken();
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    return fetch('/api/hospital-storage', {
      method: 'PUT',
      headers: headers,
      credentials: 'include',
      body: JSON.stringify({ data: payload })
    }).then(function (r) { return r.ok; }).catch(function () { return false; });
  }

  function ensureCss() {
    if (document.getElementById('admin-offices-signatures-unify-css')) return;
    var st = document.createElement('style');
    st.id = 'admin-offices-signatures-unify-css';
    st.textContent =
      '#' + DIALOG_ID + '{position:fixed;inset:0;z-index:2147483500;background:rgba(15,23,42,.58);display:flex;align-items:center;justify-content:center;direction:rtl;font-family:Tajawal,Arial,sans-serif}' +
      '#' + DIALOG_ID + ' .unify-box{width:min(720px,94vw);max-height:88vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.25);padding:20px}' +
      '#' + DIALOG_ID + ' h3{margin:0 0 6px;color:#003087;font-size:20px;font-weight:950}' +
      '#' + DIALOG_ID + ' p{margin:0 0 12px;color:#64748b;font-weight:800;line-height:1.8}' +
      '.unify-field{display:block;background:#f8fafc;border:1px solid #dbe4f0;border-radius:12px;padding:12px;margin:10px 0}' +
      '.unify-field>span{display:block;font-size:13px;font-weight:950;color:#334155;margin-bottom:8px}' +
      '.unify-field select{width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:9px;font-family:inherit;font-weight:900}' +
      '.unify-types{display:flex;gap:10px;flex-wrap:wrap}' +
      '.unify-check{display:flex;gap:7px;align-items:center;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px 12px;font-weight:850;cursor:pointer}' +
      '.unify-scope{display:flex;gap:10px;flex-wrap:wrap}' +
      '.unify-scope label{display:flex;gap:7px;align-items:center;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:9px 13px;font-weight:900;cursor:pointer}' +
      '.unify-scope label.active{border-color:#166534;background:#f0fdf4;color:#166534}' +
      '#unify-single-office-wrap{display:none;margin-top:9px}' +
      '.unify-preview{background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:10px;color:#92400e;font-weight:850;line-height:1.9;margin:10px 0}' +
      '.unify-actions{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:14px}' +
      '.unify-actions button{border:0;border-radius:10px;padding:11px 16px;font-family:inherit;font-weight:950;cursor:pointer;font-size:14px}' +
      '.unify-primary{background:#166534;color:#fff}' +
      '.unify-light{background:#e2e8f0;color:#0f172a}' +
      '.unify-danger{background:#fee2e2;color:#991b1b}';
    document.head.appendChild(st);
  }
  function closeDialog() {
    var d = document.getElementById(DIALOG_ID);
    if (d) d.remove();
  }
  function officeOptions(names, selected) {
    return Object.keys(names).map(function (k) {
      return '<option value="' + esc(k) + '"' + (k === selected ? ' selected' : '') + '>' + esc(names[k] || k) + '</option>';
    }).join('');
  }
  function updatePreview() {
    var names = getNames();
    var src = document.getElementById('unify-source') ? document.getElementById('unify-source').value : '';
    var checkedTypes = TYPES.filter(function (t) {
      var cb = document.getElementById('unify-type-' + t.id);
      return cb && cb.checked;
    });
    var scopeAll = document.getElementById('unify-scope-all') && document.getElementById('unify-scope-all').checked;
    var single = document.getElementById('unify-single-office') ? document.getElementById('unify-single-office').value : '';
    var counts = checkedTypes.map(function (t) {
      var s = readSourceSigs(src, t.id);
      return t.label + ' (' + s.sigs.length + ' توقيع)';
    });
    var targetTxt = scopeAll
      ? 'كل المكاتب (' + Math.max(Object.keys(names).length - 1, 0) + ' مكتب عدا المصدر)'
      : 'مكتب: ' + esc(names[single] || single || '—');
    var el = document.getElementById('unify-preview');
    if (el) {
      el.innerHTML = 'سيتم نقل تواقيع <b>' + esc(names[src] || src) + '</b> — ' +
        (counts.length ? counts.join('، ') : '<b style="color:#991b1b">لم تختر أي نوع!</b>') +
        ' → إلى <b>' + targetTxt + '</b>.';
    }
    // إبراز نطاق الاختيار
    var lblAll = document.getElementById('unify-scope-all-label');
    var lblOne = document.getElementById('unify-scope-one-label');
    var wrap = document.getElementById('unify-single-office-wrap');
    if (lblAll && lblOne && wrap) {
      lblAll.classList.toggle('active', !!scopeAll);
      lblOne.classList.toggle('active', !scopeAll);
      wrap.style.display = scopeAll ? 'none' : 'block';
    }
  }
  function openDialog() {
    var names = getNames();
    var officeKeys = Object.keys(names);
    if (!officeKeys.length) return alert('لا توجد مكاتب معرفة بعد.');
    if (!(window.SignatureBlock && typeof window.SignatureBlock.getSigs === 'function')) {
      return alert('نظام التواقيع لم يكتمل تحميله بعد. أعد تحميل الصفحة.');
    }
    ensureCss();
    closeDialog();
    var defaultSource = officeKeys[0];
    try { if (window.activeCenterKeyForManagement && names[window.activeCenterKeyForManagement]) defaultSource = window.activeCenterKeyForManagement; } catch (_) {}
    var dialog = document.createElement('div');
    dialog.id = DIALOG_ID;
    dialog.innerHTML =
      '<div class="unify-box">' +
      '<h3><i class="fas fa-signature"></i> توحيد التواقيع بين المكاتب</h3>' +
      '<p>اختر مكتب المصدر، وأنواع الصفحات المطلوب توحيدها، ثم طبّق على كل المكاتب دفعة واحدة أو على مكتب محدد. التواقيع وخيارات الطباعة الخاصة بها تُنسخ كما هي.</p>' +
      '<label class="unify-field"><span>مكتب المصدر (النموذج الموحد)</span><select id="unify-source">' + officeOptions(names, defaultSource) + '</select></label>' +
      '<div class="unify-field"><span>أنواع الصفحات المشمولة</span><div class="unify-types">' +
      TYPES.map(function (t) {
        return '<label class="unify-check"><input type="checkbox" id="unify-type-' + t.id + '" checked><span>' + t.label + '</span></label>';
      }).join('') +
      '</div></div>' +
      '<div class="unify-field"><span>نطاق التطبيق</span><div class="unify-scope">' +
      '<label id="unify-scope-all-label" class="active"><input type="radio" name="unify-scope" id="unify-scope-all" checked><span>كل المكاتب</span></label>' +
      '<label id="unify-scope-one-label"><input type="radio" name="unify-scope" id="unify-scope-one"><span>مكتب محدد فقط</span></label>' +
      '</div><div id="unify-single-office-wrap"><select id="unify-single-office">' + officeOptions(names, '') + '</select></div></div>' +
      '<div id="unify-preview" class="unify-preview"></div>' +
      '<div class="unify-actions">' +
      '<button type="button" class="unify-light" id="unify-edit-source">تعديل تواقيع المصدر أولاً</button>' +
      '<button type="button" class="unify-primary" id="unify-apply">تطبيق التوحيد الآن</button>' +
      '<button type="button" class="unify-danger" id="unify-close">إغلاق</button>' +
      '</div></div>';
    document.body.appendChild(dialog);

    ['unify-source', 'unify-scope-all', 'unify-scope-one', 'unify-single-office'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('change', updatePreview);
    });
    TYPES.forEach(function (t) {
      var cb = document.getElementById('unify-type-' + t.id);
      if (cb) cb.addEventListener('change', updatePreview);
    });
    document.getElementById('unify-close').onclick = closeDialog;
    document.getElementById('unify-edit-source').onclick = function () {
      var src = document.getElementById('unify-source').value;
      // افتح محرر تواقيع أول نوع مختار للمكتب المصدر، وبعد الحفظ يقدر يرجع يطبق
      var firstType = TYPES.filter(function (t) {
        var cb = document.getElementById('unify-type-' + t.id);
        return cb && cb.checked;
      })[0] || TYPES[0];
      try { window.SignatureBlock.open(sigKey(src, firstType.id)); } catch (_) { alert('تعذر فتح محرر التواقيع.'); }
    };
    document.getElementById('unify-apply').onclick = applyUnify;
    updatePreview();
  }

  async function applyUnify() {
    var names = getNames();
    var src = document.getElementById('unify-source').value;
    var checkedTypes = TYPES.filter(function (t) {
      var cb = document.getElementById('unify-type-' + t.id);
      return cb && cb.checked;
    });
    if (!checkedTypes.length) return alert('اختر نوع صفحة واحد على الأقل.');

    var scopeAll = document.getElementById('unify-scope-all').checked;
    var targets;
    if (scopeAll) {
      targets = Object.keys(names).filter(function (k) { return k !== src; });
    } else {
      var single = document.getElementById('unify-single-office').value;
      if (!single) return alert('اختر المكتب الهدف.');
      if (single === src) return alert('المكتب الهدف هو نفسه المصدر — اختر مكتبًا مختلفًا.');
      targets = [single];
    }
    if (!targets.length) return alert('لا توجد مكاتب هدف.');

    // اقرأ المصدر لكل نوع مرة واحدة
    var sources = {};
    var emptyTypes = [];
    checkedTypes.forEach(function (t) {
      var s = readSourceSigs(src, t.id);
      sources[t.id] = s;
      if (!s.sigs.length) emptyTypes.push(t.label);
    });
    if (emptyTypes.length) {
      var goOn = confirm('مكتب المصدر ليس لديه توقيعات محفوظة في: ' + emptyTypes.join('، ') +
        '.\nالاستمرار سيجعل المكاتب الهدف بدون توقيعات لهذه الأنواع. متابعة؟');
      if (!goOn) return;
    }

    var payload = {};
    var written = 0;
    targets.forEach(function (target) {
      checkedTypes.forEach(function (t) {
        var key = sigKey(target, t.id);
        var s = sources[t.id];
        writeJson(PREFIX + key, s.sigs);
        writeJson(PREFS + key, s.prefs || {});
        payload[PREFIX + key] = JSON.stringify(s.sigs);
        payload[PREFS + key] = JSON.stringify(s.prefs || {});
        try { window.SignatureBlock.init(key, { showStamp: true }); } catch (_) {}
        written++;
      });
    });

    var ok = await pushToHospitalStorage(payload);
    try { if (window.AdminOfficesPageSignatures && typeof window.AdminOfficesPageSignatures.refresh === 'function') window.AdminOfficesPageSignatures.refresh(); } catch (_) {}
    alert(ok
      ? '✓ تم توحيد التواقيع (' + written + ' مجموعة) على ' + targets.length + ' مكتب ومزامنتها سحابيًا.'
      : 'تم توحيد التواقيع محليًا (' + written + ' مجموعة). المزامنة السحابية لم تكتمل الآن وستُرفع لاحقًا.');
    closeDialog();
  }

  function injectButton(attempt) {
    if (document.getElementById(BTN_ID)) return;
    var bar = document.getElementById('main-action-buttons');
    if (!bar) {
      if ((attempt || 0) < 20) setTimeout(function () { injectButton((attempt || 0) + 1); }, 500);
      return;
    }
    var btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.className = 'ab ab-titles';
    btn.innerHTML = '<i class="fas fa-clone"></i> توحيد التواقيع';
    btn.onclick = openDialog;
    // ضعه بجوار زر تواقيع الشهادة الإجمالية إن وجد
    var grandBtn = document.getElementById('edit-grand-certificate-signatures-btn');
    if (grandBtn && grandBtn.nextSibling) bar.insertBefore(btn, grandBtn.nextSibling);
    else bar.appendChild(btn);
  }

  window.AdminOfficesSignaturesUnify = { open: openDialog, close: closeDialog };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { injectButton(0); });
  else injectButton(0);
  console.info('[Admin Offices Signatures Unify] V1 installed — توحيد التواقيع لكل المكاتب أو مكتب محدد');
})();
