/* reviewer-permissions-guard.js
 * صلاحية مراجعة آمنة بدون تعديل قاعدة البيانات:
 * - تضيف زر "مراجعة" في شاشة إدارة المستخدمين.
 * - تخزن review_extract + reviewHospitals في /api/reviewer-permissions.
 * - تمنع أي رفع إلى hospital_storage لمستخدم في وضع مراجعة فقط.
 * - تقفل حقول الإدخال داخل صفحات المستخلصات عند المراجع فقط.
 */
(function () {
  'use strict';

  if (window.__NAJRAN_REVIEWER_PERMISSIONS_GUARD__) return;
  window.__NAJRAN_REVIEWER_PERMISSIONS_GUARD__ = true;

  var currentPerms = null;
  var usersByEmail = new Map();
  var usersById = new Map();

  function isAdminUsersPage() {
    return /\/admin\/users(?:$|[?#])/.test(location.pathname + location.search);
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
      usersById.set(String(u.id), u);
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

  async function editReviewerPermissions(user) {
    if (!user || user.id == null) return alert('تعذر تحديد المستخدم');
    var current = await api('/api/reviewer-permissions/' + encodeURIComponent(String(user.id))).catch(function () { return { permissions: [], reviewHospitals: [] }; });
    var oldHospitals = (current.reviewHospitals || []).join('، ');
    var input = prompt('اكتب مستشفيات المراجعة مفصولة بفاصلة. اتركها فارغة لإلغاء صلاحية المراجع:', oldHospitals);
    if (input == null) return;
    var hospitals = String(input).split(/[،,|\n]/g).map(function (x) { return x.trim(); }).filter(Boolean);
    var permissions = hospitals.length ? ['review_extract'] : [];
    await api('/api/reviewer-permissions/' + encodeURIComponent(String(user.id)), {
      method: 'PATCH',
      body: JSON.stringify({ permissions: permissions, reviewHospitals: hospitals })
    });
    alert(hospitals.length ? 'تم حفظ صلاحية المراجعة' : 'تم إلغاء صلاحية المراجعة');
    setTimeout(patchAdminTable, 150);
  }

  function patchAdminTable() {
    if (!isAdminUsersPage()) return;
    var table = findUsersTable();
    if (!table) return;
    Array.prototype.slice.call(table.querySelectorAll('tbody tr')).forEach(function (tr) {
      if (tr.querySelector('[data-review-permissions-btn="1"]')) return;
      var email = getEmailFromRow(tr);
      var user = usersByEmail.get(email);
      if (!user) return;
      var lastCell = tr.children[tr.children.length - 1];
      if (!lastCell) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.reviewPermissionsBtn = '1';
      btn.textContent = 'مراجعة';
      btn.title = 'تحديد مستشفيات المراجعة فقط — لا يسمح بالرفع';
      btn.style.cssText = 'height:28px;padding:0 9px;border-radius:8px;border:1px solid #fed7aa;background:#fff7ed;color:#9a3412;font-size:11px;font-weight:800;cursor:pointer;margin:2px';
      btn.onclick = function () { editReviewerPermissions(user).catch(function (e) { alert(e.message || 'فشل حفظ صلاحية المراجعة'); }); };
      lastCell.appendChild(btn);
    });
  }

  patchFetch();
  loadCurrentPermissions();
  setInterval(function () { loadCurrentPermissions(); patchAdminTable(); watchFramesAndPage(); }, 5000);
  document.addEventListener('DOMContentLoaded', function () {
    patchAdminTable();
    watchFramesAndPage();
  });
})();
