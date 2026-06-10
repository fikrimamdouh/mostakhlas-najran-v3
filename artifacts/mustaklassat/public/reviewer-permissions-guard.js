/* reviewer-permissions-guard.js
 * صلاحية مراجعة آمنة بدون تعديل قاعدة البيانات:
 * - تضيف زر "مراجعة" بجوار صلاحية المستخدم في شاشة إدارة المستخدمين.
 * - تعرض نافذة اختيار مستشفيات المراجعة بقائمة متعددة بدل prompt يدوي.
 * - تخزن review_extract + reviewHospitals في /api/reviewer-permissions.
 * - تمنع أي رفع إلى hospital_storage لمستخدم في وضع مراجعة فقط.
 * - تقفل حقول الإدخال داخل صفحات المستخلصات عند المراجع فقط.
 * - تحسن ترتيب صفحة إدارة المستخدمين من نفس الملف لضمان التحميل.
 */
(function () {
  'use strict';

  if (window.__NAJRAN_REVIEWER_PERMISSIONS_GUARD__) return;
  window.__NAJRAN_REVIEWER_PERMISSIONS_GUARD__ = true;

  var currentPerms = null;
  var usersByEmail = new Map();
  var reviewerPermsByUserId = new Map();

  var DEFAULT_REVIEW_HOSPITALS = [
    'مستشفى بدر الجنوب العام',
    'مستشفى حبونا العام',
    'مستشفى يدمة العام',
    'مستشفى الولادة والأطفال',
    'مستشفى نجران العام القديم وسكن الممرضات الخارجي',
    'المكاتب الإدارية والمرافق الصحية',
    'صيانة وإصلاح السيارات والعيادات المتنقلة',
    'مستشفى نجران العام الجديد ومركز طب الأسنان التخصصي',
    'مجمع الأمل للصحة النفسية',
    'مستشفى ثار العام',
    'مستشفى خباش العام',
    'المراكز الصحية',
    'مستشفى الملك خالد',
    'مركز الأمير سلطان',
    'مستشفى شروره العام',
    'المقر الرئيسي — تجمع نجران الصحي'
  ];

  function isAdminUsersPage() {
    return /\/admin\/users(?:$|[?#])/.test(location.pathname + location.search);
  }

  function unique(arr) {
    return Array.from(new Set((arr || []).map(function (x) { return String(x || '').trim(); }).filter(Boolean)));
  }

  function parseHospitals(value) {
    if (Array.isArray(value)) return unique(value);
    if (!value) return [];
    try {
      var parsed = JSON.parse(String(value));
      if (Array.isArray(parsed)) return unique(parsed);
    } catch (_) {}
    return unique(String(value).split(/[،,|\n]/g));
  }

  function normalizeHospitalsFromUser(user) {
    if (!user || typeof user !== 'object') return [];
    return unique([].concat(
      user.hospital ? [user.hospital] : [],
      parseHospitals(user.hospitals),
      user.hospitalName ? [user.hospitalName] : []
    ));
  }

  function getAllHospitalOptions() {
    var fromUsers = [];
    usersByEmail.forEach(function (u) {
      fromUsers = fromUsers.concat(normalizeHospitalsFromUser(u));
    });
    return unique(DEFAULT_REVIEW_HOSPITALS.concat(fromUsers));
  }

  async function getFreshToken() {
    try {
      if (typeof window.najranGetFreshToken === 'function') {
        var t = await window.najranGetFreshToken();
        if (t) return t;
      }
    } catch (_) {}
    try {
      var s = JSON.parse(localStorage.getItem('najran_session') || '{}');
      return s.clerkToken || '';
    } catch (_) { return ''; }
  }

  async function api(path, options) {
    var token = await getFreshToken();
    var headers = Object.assign({ 'Content-Type': 'application/json' }, (options && options.headers) || {});
    if (token) headers.Authorization = 'Bearer ' + token;
    var res = await fetch(path, Object.assign({}, options || {}, { headers: headers, credentials: 'include' }));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  function rememberUsers(payload) {
    var users = payload && Array.isArray(payload.users) ? payload.users : Array.isArray(payload) ? payload : [];
    users.forEach(function (u) {
      if (!u || u.id == null) return;
      var email = String(u.email || '').trim().toLowerCase();
      if (email) usersByEmail.set(email, u);
    });
  }

  function patchFetch() {
    if (window.__NAJRAN_REVIEWER_FETCH_PATCHED__) return;
    window.__NAJRAN_REVIEWER_FETCH_PATCHED__ = true;
    var nativeFetch = window.fetch;
    window.fetch = function () {
      var args = arguments;
      var url = String(args[0] && args[0].url ? args[0].url : args[0] || '');
      var opts = args[1] || {};
      var method = String(opts.method || (args[0] && args[0].method) || 'GET').toUpperCase();

      if (currentPerms && currentPerms.reviewOnly && method === 'PUT' && url.indexOf('/api/hospital-storage') > -1) {
        console.warn('[NajranReviewOnly] منع رفع بيانات المستشفى من حساب مراجعة فقط');
        return Promise.resolve(new Response(JSON.stringify({ saved: 0, readonly: true, reason: 'REVIEW_ONLY_NO_UPLOAD' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }));
      }

      return nativeFetch.apply(this, args).then(function (res) {
        try {
          if (url.indexOf('/api/users') > -1 && url.indexOf('/api/users/me') === -1) {
            res.clone().json().then(rememberUsers).then(function () { setTimeout(patchAdminTable, 80); }).catch(function () {});
          }
        } catch (_) {}
        return res;
      });
    };
  }

  function applyReadOnlyToDocument(doc) {
    if (!doc || !currentPerms || !currentPerms.reviewOnly) return;
    try {
      if (!doc.getElementById('najran-review-only-style')) {
        var st = doc.createElement('style');
        st.id = 'najran-review-only-style';
        st.textContent = '[data-najran-review-only-disabled="1"]{background:#f8fafc!important;color:#64748b!important;cursor:not-allowed!important}.najran-review-only-banner{position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:999999;background:#7c2d12;color:#fff;border-radius:999px;padding:8px 18px;font-family:Tajawal,Arial,sans-serif;font-weight:800;font-size:13px;box-shadow:0 10px 25px rgba(0,0,0,.2);direction:rtl}';
        doc.head.appendChild(st);
      }
      if (!doc.getElementById('najran-review-only-banner')) {
        var b = doc.createElement('div');
        b.id = 'najran-review-only-banner';
        b.className = 'najran-review-only-banner no-print';
        b.textContent = 'وضع مراجعة فقط — لا يمكن تعديل أو رفع بيانات المستخلص';
        doc.body.appendChild(b);
      }
      Array.prototype.slice.call(doc.querySelectorAll('input,select,textarea')).forEach(function (el) {
        if (el.dataset && el.dataset.reviewField === 'true') return;
        var type = String(el.getAttribute('type') || '').toLowerCase();
        if (type === 'button' || type === 'submit' || type === 'reset') return;
        el.disabled = true;
        el.dataset.najranReviewOnlyDisabled = '1';
        el.title = 'وضع مراجعة فقط — التعديل غير مسموح';
      });
      Array.prototype.slice.call(doc.querySelectorAll('[contenteditable="true"]')).forEach(function (el) {
        if (el.dataset && el.dataset.reviewField === 'true') return;
        el.setAttribute('contenteditable', 'false');
        el.dataset.najranReviewOnlyDisabled = '1';
      });
    } catch (_) {}
  }

  function patchFrame(win) {
    if (!win || win.__NAJRAN_REVIEWER_FRAME_PATCHED__) return;
    try {
      win.__NAJRAN_REVIEWER_FRAME_PATCHED__ = true;
      var nativeFetch = win.fetch;
      win.fetch = function () {
        var args = arguments;
        var url = String(args[0] && args[0].url ? args[0].url : args[0] || '');
        var opts = args[1] || {};
        var method = String(opts.method || (args[0] && args[0].method) || 'GET').toUpperCase();
        if (currentPerms && currentPerms.reviewOnly && method === 'PUT' && url.indexOf('/api/hospital-storage') > -1) {
          console.warn('[NajranReviewOnly] iframe منع رفع بيانات المستشفى من حساب مراجعة فقط');
          return Promise.resolve(new win.Response(JSON.stringify({ saved: 0, readonly: true, reason: 'REVIEW_ONLY_NO_UPLOAD' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }));
        }
        return nativeFetch.apply(this, args);
      };
      applyReadOnlyToDocument(win.document);
      win.setInterval(function () { applyReadOnlyToDocument(win.document); }, 2500);
    } catch (_) {}
  }

  function watchFramesAndPage() {
    if (!currentPerms || !currentPerms.reviewOnly) return;
    applyReadOnlyToDocument(document);
    Array.prototype.slice.call(document.querySelectorAll('iframe')).forEach(function (frame) {
      try { patchFrame(frame.contentWindow); } catch (_) {}
    });
  }

  async function loadCurrentPermissions() {
    try {
      currentPerms = await api('/api/reviewer-permissions/me');
      try {
        var s = JSON.parse(localStorage.getItem('najran_session') || '{}');
        s.permissions = currentPerms.permissions || [];
        s.reviewHospitals = currentPerms.reviewHospitals || [];
        s.canEditCurrentHospital = !!currentPerms.canEditCurrentHospital;
        s.canReviewCurrentHospital = !!currentPerms.canReviewCurrentHospital;
        s.reviewOnly = !!currentPerms.reviewOnly;
        localStorage.setItem('najran_session', JSON.stringify(s));
      } catch (_) {}
      watchFramesAndPage();
    } catch (_) {}
  }

  function findUsersTable() {
    var tables = Array.prototype.slice.call(document.querySelectorAll('table'));
    return tables.find(function (table) {
      var t = table.textContent || '';
      return t.indexOf('الصلاحية') > -1 && t.indexOf('الوحدات') > -1 && t.indexOf('الإجراءات') > -1;
    }) || null;
  }

  function getEmailFromRow(tr) {
    var cells = Array.prototype.slice.call(tr.children || []);
    for (var i = 0; i < cells.length; i++) {
      var text = String(cells[i].textContent || '').trim().toLowerCase();
      if (text.indexOf('@') > -1) return text;
    }
    return '';
  }

  function ensureModalStyles() {
    if (document.getElementById('najran-review-modal-style')) return;
    var st = document.createElement('style');
    st.id = 'najran-review-modal-style';
    st.textContent = [
      '.najran-review-modal-backdrop{position:fixed;inset:0;z-index:999999;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:18px;direction:rtl}',
      '.najran-review-modal{width:min(720px,96vw);max-height:88vh;background:#fff;border-radius:20px;box-shadow:0 25px 70px rgba(0,0,0,.3);overflow:hidden;font-family:Tajawal,Arial,sans-serif;display:flex;flex-direction:column}',
      '.najran-review-modal-header{padding:18px 22px;background:linear-gradient(135deg,#7c2d12,#9a3412);color:#fff;display:flex;justify-content:space-between;gap:16px;align-items:flex-start}',
      '.najran-review-modal-title{font-size:18px;font-weight:900;margin:0}',
      '.najran-review-modal-sub{font-size:12px;opacity:.82;margin-top:4px;line-height:1.7}',
      '.najran-review-modal-close{border:0;background:transparent;color:#fff;font-size:26px;cursor:pointer;line-height:1}',
      '.najran-review-modal-tools{padding:12px 18px;border-bottom:1px solid #f1f5f9;background:#fff7ed;display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
      '.najran-review-modal-tools button{border:1px solid #fdba74;background:#fff;color:#9a3412;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:800;cursor:pointer}',
      '.najran-review-modal-body{padding:16px 18px;overflow:auto;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}',
      '.najran-review-hospital{display:flex;align-items:center;gap:9px;padding:10px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;cursor:pointer;font-size:13px;font-weight:700;color:#334155}',
      '.najran-review-hospital input{width:16px;height:16px;accent-color:#9a3412}',
      '.najran-review-hospital.checked{background:#fff7ed;border-color:#fdba74;color:#7c2d12}',
      '.najran-review-modal-footer{padding:14px 18px;border-top:1px solid #f1f5f9;display:flex;justify-content:space-between;gap:10px;background:#fff}',
      '.najran-review-modal-footer button{border:0;border-radius:12px;padding:10px 18px;font-weight:900;cursor:pointer}',
      '.najran-review-save{background:#166534;color:#fff}',
      '.najran-review-cancel{background:#f1f5f9;color:#334155}',
      '.najran-review-clear{background:#fee2e2;color:#991b1b}',
      '@media(max-width:760px){.najran-review-modal-body{grid-template-columns:1fr}}',
      '.najran-review-row-btn{height:24px;padding:0 8px;border-radius:999px;border:1px solid #fdba74;background:#fff7ed;color:#9a3412;font-size:11px;font-weight:900;cursor:pointer;margin-inline-start:4px;white-space:nowrap}',
      '.najran-review-row-btn.active{background:#9a3412;color:#fff;border-color:#9a3412}',
      '.najran-admin-polished main{background:#f4f7fb!important}',
      '.najran-admin-polished main>div{padding:16px!important}',
      '.najran-admin-polished h1{font-size:24px!important;letter-spacing:-.2px}',
      '.najran-admin-polished h1+ p{font-size:13px!important;color:#64748b!important}',
      '.najran-admin-polished .space-y-6{display:flex!important;flex-direction:column!important;gap:14px!important}',
      '.najran-admin-polished .space-y-6>div:first-child{background:#fff!important;border:1px solid #e2e8f0!important;border-radius:18px!important;padding:16px!important;box-shadow:0 10px 28px rgba(15,23,42,.06)!important}',
      '.najran-admin-polished .space-y-6>div:nth-child(2){background:#e9eef8!important;border:1px solid #dbe5f5!important;border-radius:14px!important;padding:5px!important}',
      '.najran-admin-polished .space-y-6>div:nth-child(2) button{border-radius:10px!important;height:36px!important}',
      '.najran-admin-polished .relative{background:#fff!important;border:1px solid #e2e8f0!important;border-radius:14px!important;padding:6px!important;box-shadow:0 8px 20px rgba(15,23,42,.04)!important}',
      '.najran-admin-polished .relative input{border:0!important;box-shadow:none!important;background:#f8fafc!important;border-radius:10px!important;height:38px!important}',
      '.najran-users-table-card{background:#fff!important;border:1px solid #dbe5f5!important;border-radius:18px!important;box-shadow:0 14px 36px rgba(15,23,42,.08)!important;overflow:hidden!important}',
      '.najran-users-table-card:before{content:"قائمة المستخدمين";display:block;padding:12px 16px;background:linear-gradient(135deg,#f8fafc,#eef4ff);border-bottom:1px solid #e2e8f0;color:#1e3c72;font-size:14px;font-weight:900}',
      '.najran-users-table-card table{width:100%!important;border-collapse:separate!important;border-spacing:0!important;table-layout:auto!important}',
      '.najran-users-table-card thead tr,.najran-users-table-card th{background:#0f2d57!important;color:#fff!important}',
      '.najran-users-table-card th{font-size:12px!important;font-weight:900!important;white-space:nowrap!important;padding:11px 9px!important;border:0!important}',
      '.najran-users-table-card td{font-size:12px!important;padding:10px 8px!important;border-bottom:1px solid #edf2f7!important;vertical-align:middle!important;color:#334155!important}',
      '.najran-users-table-card tbody tr:nth-child(even){background:#f8fbff!important}',
      '.najran-users-table-card tbody tr:hover{background:#fff7ed!important}',
      '.najran-users-table-card td:nth-child(1){min-width:150px!important;font-weight:900!important;color:#0f172a!important}',
      '.najran-users-table-card td:nth-child(2){max-width:235px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;color:#64748b!important;direction:ltr!important;text-align:left!important}',
      '.najran-users-table-card td:nth-child(3){min-width:230px!important}',
      '.najran-users-table-card td:nth-last-child(1){min-width:150px!important}',
      '.najran-users-table-card button,.najran-users-table-card select{border-radius:9px!important;font-weight:800!important}',
      '.najran-users-table-card select{height:28px!important;background:#fff!important;border:1px solid #cbd5e1!important;color:#334155!important}',
      '.najran-users-role-wrap{display:flex!important;align-items:center!important;gap:6px!important;flex-wrap:wrap!important}',
      '.najran-users-action-wrap{display:flex!important;align-items:center!important;justify-content:center!important;gap:5px!important;flex-wrap:wrap!important}',
      '.najran-users-note{margin-top:8px;padding:9px 12px;border-radius:12px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:12px;font-weight:800;display:flex;align-items:center;gap:8px;line-height:1.7}',
      '@media(max-width:1300px){.najran-users-table-card{overflow-x:auto!important}.najran-users-table-card table{min-width:1180px!important}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  function polishUsersPage() {
    if (!isAdminUsersPage()) return;
    ensureModalStyles();
    document.body.classList.add('najran-admin-polished');
    var table = findUsersTable();
    if (!table) return;
    var card = table.closest('.rounded-xl.border') || table.parentElement;
    if (card) card.classList.add('najran-users-table-card');

    Array.prototype.slice.call(table.querySelectorAll('tbody tr')).forEach(function (tr) {
      var cells = Array.prototype.slice.call(tr.children || []);
      if (cells.length < 6) return;
      var roleCell = cells[2];
      var actionsCell = cells[cells.length - 1];
      if (roleCell && !roleCell.querySelector('.najran-users-role-wrap')) {
        var roleWrap = document.createElement('div');
        roleWrap.className = 'najran-users-role-wrap';
        while (roleCell.firstChild) roleWrap.appendChild(roleCell.firstChild);
        roleCell.appendChild(roleWrap);
      }
      if (actionsCell && !actionsCell.querySelector('.najran-users-action-wrap')) {
        var actionWrap = document.createElement('div');
        actionWrap.className = 'najran-users-action-wrap';
        while (actionsCell.firstChild) actionWrap.appendChild(actionsCell.firstChild);
        actionsCell.appendChild(actionWrap);
      }
    });

    var root = table.closest('.space-y-6');
    if (root && !root.querySelector('[data-najran-users-note="1"]')) {
      var note = document.createElement('div');
      note.dataset.najranUsersNote = '1';
      note.className = 'najran-users-note';
      note.innerHTML = '<span style="font-size:15px">ℹ</span><span>صلاحية <b>مراجعة</b> تعني مشاهدة مستخلصات مستشفيات محددة فقط. لا تسمح بالتعديل أو الرفع للسيرفر.</span>';
      var search = root.querySelector('.relative');
      if (search && search.parentElement) search.parentElement.insertBefore(note, search.nextSibling);
    }
  }

  async function fetchReviewerPermsForUser(userId) {
    var cached = reviewerPermsByUserId.get(String(userId));
    if (cached) return cached;
    var data = await api('/api/reviewer-permissions/' + encodeURIComponent(String(userId))).catch(function () { return { permissions: [], reviewHospitals: [] }; });
    reviewerPermsByUserId.set(String(userId), data);
    return data;
  }

  async function editReviewerPermissions(user) {
    if (!user || user.id == null) return alert('تعذر تحديد المستخدم');
    ensureModalStyles();
    var current = await fetchReviewerPermsForUser(user.id);
    var selected = new Set(current.reviewHospitals || []);
    var allHospitals = getAllHospitalOptions();

    var backdrop = document.createElement('div');
    backdrop.className = 'najran-review-modal-backdrop';
    backdrop.innerHTML = '<div class="najran-review-modal">' +
      '<div class="najran-review-modal-header"><div><h3 class="najran-review-modal-title">صلاحية مراجعة المستخلصات</h3><div class="najran-review-modal-sub">' +
      'المستخدم: <b>' + (user.name || user.email || '') + '</b><br>اختر المستشفيات التي يراها للمراجعة فقط. هذه الصلاحية لا تسمح برفع أو تعديل بيانات المستخلص.' +
      '</div></div><button class="najran-review-modal-close" type="button">×</button></div>' +
      '<div class="najran-review-modal-tools"><button type="button" data-action="all">اختيار الكل</button><button type="button" data-action="none">إلغاء الكل</button><span style="font-size:12px;color:#7c2d12;font-weight:800" data-count></span></div>' +
      '<div class="najran-review-modal-body"></div>' +
      '<div class="najran-review-modal-footer"><button type="button" class="najran-review-clear">إلغاء صلاحية المراجع</button><div style="display:flex;gap:8px"><button type="button" class="najran-review-cancel">إغلاق</button><button type="button" class="najran-review-save">حفظ</button></div></div>' +
      '</div>';

    var body = backdrop.querySelector('.najran-review-modal-body');
    var count = backdrop.querySelector('[data-count]');

    function redraw() {
      if (count) count.textContent = 'مختار: ' + selected.size + ' مستشفى';
      Array.prototype.slice.call(body.querySelectorAll('.najran-review-hospital')).forEach(function (label) {
        var cb = label.querySelector('input');
        label.classList.toggle('checked', !!(cb && cb.checked));
      });
    }

    allHospitals.forEach(function (h) {
      var label = document.createElement('label');
      label.className = 'najran-review-hospital';
      var checked = selected.has(h) ? 'checked' : '';
      label.innerHTML = '<input type="checkbox" value="' + h.replace(/"/g, '&quot;') + '" ' + checked + '> <span>' + h + '</span>';
      var cb = label.querySelector('input');
      cb.addEventListener('change', function () {
        if (cb.checked) selected.add(h);
        else selected.delete(h);
        redraw();
      });
      body.appendChild(label);
    });

    backdrop.querySelector('.najran-review-modal-close').onclick = function () { backdrop.remove(); };
    backdrop.querySelector('.najran-review-cancel').onclick = function () { backdrop.remove(); };
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) backdrop.remove(); });
    backdrop.querySelector('[data-action="all"]').onclick = function () {
      allHospitals.forEach(function (h) { selected.add(h); });
      Array.prototype.slice.call(body.querySelectorAll('input')).forEach(function (cb) { cb.checked = true; });
      redraw();
    };
    backdrop.querySelector('[data-action="none"]').onclick = function () {
      selected.clear();
      Array.prototype.slice.call(body.querySelectorAll('input')).forEach(function (cb) { cb.checked = false; });
      redraw();
    };
    backdrop.querySelector('.najran-review-clear').onclick = async function () {
      await saveReviewerPerms(user, []);
      backdrop.remove();
    };
    backdrop.querySelector('.najran-review-save').onclick = async function () {
      await saveReviewerPerms(user, Array.from(selected));
      backdrop.remove();
    };

    document.body.appendChild(backdrop);
    redraw();
  }

  async function saveReviewerPerms(user, hospitals) {
    var permissions = hospitals.length ? ['review_extract'] : [];
    var data = await api('/api/reviewer-permissions/' + encodeURIComponent(String(user.id)), {
      method: 'PATCH',
      body: JSON.stringify({ permissions: permissions, reviewHospitals: hospitals })
    });
    reviewerPermsByUserId.set(String(user.id), data);
    patchAdminTable();
  }

  async function refreshButtonState(btn, user) {
    try {
      var data = await fetchReviewerPermsForUser(user.id);
      var count = (data.reviewHospitals || []).length;
      btn.classList.toggle('active', count > 0);
      btn.textContent = count > 0 ? 'مراجعة ' + count : 'مراجعة';
      btn.title = count > 0 ? ('مستشفيات المراجعة: ' + data.reviewHospitals.join(' / ')) : 'تحديد مستشفيات المراجعة فقط — لا يسمح بالرفع';
    } catch (_) {}
  }

  function patchAdminTable() {
    if (!isAdminUsersPage()) return;
    polishUsersPage();
    var table = findUsersTable();
    if (!table) return;
    Array.prototype.slice.call(table.querySelectorAll('tbody tr')).forEach(function (tr) {
      var email = getEmailFromRow(tr);
      var user = usersByEmail.get(email);
      if (!user) return;
      var cells = Array.prototype.slice.call(tr.children || []);
      var roleCell = cells.find(function (td) { return (td.textContent || '').indexOf('مستخدم') > -1 || (td.textContent || '').indexOf('مدير') > -1 || (td.textContent || '').indexOf('مشرف') > -1 || (td.textContent || '').indexOf('مراقب') > -1; }) || cells[2];
      if (!roleCell || roleCell.querySelector('[data-review-permissions-btn="1"]')) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.reviewPermissionsBtn = '1';
      btn.className = 'najran-review-row-btn';
      btn.textContent = 'مراجعة';
      btn.title = 'تحديد مستشفيات المراجعة فقط — لا يسمح بالرفع';
      btn.onclick = function () { editReviewerPermissions(user).catch(function (e) { alert(e.message || 'فشل حفظ صلاحية المراجعة'); }); };
      roleCell.appendChild(btn);
      refreshButtonState(btn, user);
    });
  }

  patchFetch();
  ensureModalStyles();
  loadCurrentPermissions();
  setInterval(function () { loadCurrentPermissions(); patchAdminTable(); watchFramesAndPage(); polishUsersPage(); }, 5000);
  document.addEventListener('DOMContentLoaded', function () {
    patchAdminTable();
    watchFramesAndPage();
    polishUsersPage();
  });
})();
