/* admin-users-hospital-column.js
 * إضافات عرض آمنة لشاشة إدارة المستخدمين:
 * - عمود المستشفى/المواقع.
 * - زر تعديل الاسم للمدير عند ظهور اسم "مستخدم جديد" أو أي اسم يحتاج تصحيح.
 * - توسيع شاشة إدارة المستخدمين فقط لتقليل/إلغاء السكرول الأفقي.
 * لا يغير الربط أو الصلاحيات أو الوحدات.
 */
(function () {
  'use strict';

  var userHospitalByEmail = new Map();
  var userHospitalById = new Map();
  var userByEmail = new Map();

  function isAdminUsersPage() {
    return /\/admin\/users(?:$|[?#])/.test(location.pathname + location.search);
  }

  function ensureWideStyle() {
    if (document.getElementById('najran-admin-users-wide-style')) return;
    var st = document.createElement('style');
    st.id = 'najran-admin-users-wide-style';
    st.textContent = [
      'body:has(table) main > div.p-8{padding:18px!important}',
      'body:has(table) main > div.p-8 > .mx-auto.max-w-6xl{max-width:none!important;width:100%!important;margin:0!important}',
      '@media (min-width:1200px){body:has(table) main{overflow-x:hidden!important}}',
      '.najran-admin-users-wide table{width:100%!important;table-layout:auto!important}',
      '.najran-admin-users-wide th,.najran-admin-users-wide td{padding:10px 8px!important;vertical-align:middle!important}',
      '.najran-admin-users-wide th{white-space:nowrap!important;font-size:13px!important}',
      '.najran-admin-users-wide td{font-size:12.5px!important}',
      '.najran-admin-users-wide td:nth-child(1){min-width:150px!important}',
      '.najran-admin-users-wide td:nth-child(2){max-width:235px!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}',
      '.najran-admin-users-wide td:nth-child(3){min-width:145px!important}',
      '.najran-admin-users-wide td:nth-child(4){min-width:190px!important}',
      '.najran-admin-users-wide td:nth-child(5){min-width:95px!important}',
      '.najran-admin-users-wide td:nth-child(6),.najran-admin-users-wide td:nth-child(7){white-space:nowrap!important}',
      '.najran-admin-users-wide td:nth-child(8),.najran-admin-users-wide td:nth-child(9){white-space:nowrap!important}',
      '@media (max-width:1400px){.najran-admin-users-wide th,.najran-admin-users-wide td{padding:8px 5px!important;font-size:11.5px!important}.najran-admin-users-wide button,.najran-admin-users-wide select{font-size:10.5px!important}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  function normalizeHospitals(user) {
    if (!user || typeof user !== 'object') return 'غير محدد';

    var candidates = [];
    if (Array.isArray(user.hospitals)) candidates = user.hospitals;
    else if (typeof user.hospitals === 'string') {
      try {
        var parsed = JSON.parse(user.hospitals);
        candidates = Array.isArray(parsed) ? parsed : [user.hospitals];
      } catch (_) {
        candidates = user.hospitals.split(/[،,|]/g);
      }
    } else if (typeof user.hospital === 'string') candidates = [user.hospital];
    else if (typeof user.hospitalName === 'string') candidates = [user.hospitalName];

    candidates = candidates.map(function (x) { return String(x || '').trim(); }).filter(Boolean);
    candidates = Array.from(new Set(candidates));

    if (!candidates.length) return 'غير محدد';
    if (candidates.length === 1) return candidates[0];
    return candidates.length + ' مستشفيات';
  }

  function rememberUsers(payload) {
    var users = payload && Array.isArray(payload.users) ? payload.users : Array.isArray(payload) ? payload : [];
    users.forEach(function (u) {
      var label = normalizeHospitals(u);
      var email = String(u.email || '').trim().toLowerCase();
      if (email) {
        userHospitalByEmail.set(email, label);
        userByEmail.set(email, u);
      }
      if (u.id != null) userHospitalById.set(String(u.id), label);
    });
  }

  if (!window.__najranAdminUsersHospitalFetchPatched) {
    window.__najranAdminUsersHospitalFetchPatched = true;
    var nativeFetch = window.fetch;
    window.fetch = function () {
      var args = arguments;
      return nativeFetch.apply(this, args).then(function (res) {
        try {
          var url = String(args[0] && args[0].url ? args[0].url : args[0] || '');
          if (url.indexOf('/api/users') > -1 && url.indexOf('/api/users/me') === -1) {
            res.clone().json().then(rememberUsers).then(function () { setTimeout(patchTable, 60); }).catch(function () {});
          }
        } catch (_) {}
        return res;
      });
    };
  }

  async function getFreshToken() {
    try {
      if (window.Clerk && window.Clerk.session && typeof window.Clerk.session.getToken === 'function') {
        var fresh = await window.Clerk.session.getToken();
        if (fresh) return fresh;
      }
    } catch (_) {}
    try {
      var s = JSON.parse(localStorage.getItem('najran_session') || '{}');
      return s.clerkToken || '';
    } catch (_) {
      return '';
    }
  }

  function findUsersTable() {
    var tables = Array.prototype.slice.call(document.querySelectorAll('table'));
    return tables.find(function (table) {
      var t = table.textContent || '';
      return t.indexOf('الصلاحية') > -1 && t.indexOf('الوحدات') > -1 && t.indexOf('الإجراءات') > -1;
    }) || null;
  }

  function insertAfter(parent, node, after) {
    if (!parent || !node || !after) return;
    parent.insertBefore(node, after.nextSibling);
  }

  function makeHeaderCell() {
    var th = document.createElement('th');
    th.dataset.najranHospitalCol = '1';
    th.textContent = 'المستشفى / المواقع';
    th.className = 'font-bold text-right text-white';
    th.style.whiteSpace = 'nowrap';
    return th;
  }

  function makeBodyCell(email) {
    var td = document.createElement('td');
    td.dataset.najranHospitalCol = '1';
    td.className = 'text-xs text-slate-600';
    td.style.minWidth = '140px';
    td.style.maxWidth = '210px';

    var label = userHospitalByEmail.get(String(email || '').trim().toLowerCase()) || 'غير محدد';
    var badge = document.createElement('span');
    badge.textContent = label;
    badge.title = label;
    badge.style.display = 'inline-block';
    badge.style.maxWidth = '200px';
    badge.style.overflow = 'hidden';
    badge.style.textOverflow = 'ellipsis';
    badge.style.whiteSpace = 'nowrap';
    badge.style.border = label === 'غير محدد' ? '1px solid #fed7aa' : '1px solid #bfdbfe';
    badge.style.background = label === 'غير محدد' ? '#fff7ed' : '#eff6ff';
    badge.style.color = label === 'غير محدد' ? '#9a3412' : '#1e3a8a';
    badge.style.borderRadius = '999px';
    badge.style.padding = '3px 8px';
    badge.style.fontWeight = '700';
    td.appendChild(badge);
    return td;
  }

  async function patchName(user, emailKey, next, nameSpan, btn) {
    var token = await getFreshToken();
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    var res = await fetch('/api/users/' + encodeURIComponent(String(user.id)) + '/profile', {
      method: 'PATCH',
      headers: headers,
      credentials: 'include',
      body: JSON.stringify({ name: next })
    });
    if (res.status === 401) throw new Error('انتهت صلاحية الجلسة. اعمل تحديث للصفحة ثم جرّب مرة أخرى.');
    if (!res.ok) throw new Error('فشل تعديل الاسم');
    var updated = await res.json().catch(function () { return null; });
    nameSpan.textContent = (updated && updated.name) || next;
    user.name = (updated && updated.name) || next;
    userByEmail.set(emailKey, user);
  }

  function enhanceNameCell(nameCell, email) {
    if (!nameCell || nameCell.querySelector('[data-najran-edit-name="1"]')) return;
    var emailKey = String(email || '').trim().toLowerCase();
    var user = userByEmail.get(emailKey);
    if (!user || user.id == null) return;

    var currentName = String(user.name || nameCell.textContent || '').trim();
    nameCell.style.minWidth = '140px';

    var wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.style.gap = '5px';
    wrap.style.flexWrap = 'wrap';

    var nameSpan = document.createElement('span');
    nameSpan.textContent = currentName || 'مستخدم جديد';
    nameSpan.style.fontWeight = '700';
    nameSpan.style.color = '#1f2937';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.najranEditName = '1';
    btn.textContent = 'تعديل';
    btn.title = 'تعديل اسم المستخدم فقط';
    btn.style.border = '1px solid #bfdbfe';
    btn.style.background = '#eff6ff';
    btn.style.color = '#1d4ed8';
    btn.style.borderRadius = '999px';
    btn.style.fontSize = '10.5px';
    btn.style.fontWeight = '700';
    btn.style.padding = '2px 7px';
    btn.style.cursor = 'pointer';

    btn.addEventListener('click', async function () {
      var next = prompt('اكتب اسم المستخدم الصحيح:', currentName || '');
      if (next == null) return;
      next = String(next).trim();
      if (!next) return alert('الاسم لا يجوز أن يكون فارغًا');
      if (next === currentName) return;
      try {
        btn.disabled = true;
        btn.textContent = 'حفظ...';
        await patchName(user, emailKey, next, nameSpan, btn);
        currentName = next;
        btn.textContent = 'تم';
        setTimeout(function () { btn.textContent = 'تعديل'; btn.disabled = false; }, 900);
      } catch (e) {
        alert(e.message || 'فشل تعديل الاسم');
        btn.textContent = 'تعديل';
        btn.disabled = false;
      }
    });

    nameCell.textContent = '';
    wrap.appendChild(nameSpan);
    wrap.appendChild(btn);
    nameCell.appendChild(wrap);
  }

  function patchTable() {
    if (!isAdminUsersPage()) return;
    ensureWideStyle();
    var table = findUsersTable();
    if (!table) return;
    var wrapper = table.closest('.rounded-xl.border') || table.parentElement;
    if (wrapper) {
      wrapper.classList.add('najran-admin-users-wide');
      wrapper.style.overflowX = 'visible';
      wrapper.style.overflowY = 'visible';
      wrapper.style.width = '100%';
    }

    var headerRow = table.querySelector('thead tr');
    if (headerRow && !headerRow.querySelector('[data-najran-hospital-col="1"]')) {
      var heads = Array.prototype.slice.call(headerRow.children);
      var emailHead = heads.find(function (h) { return (h.textContent || '').trim() === 'البريد'; }) || heads[1];
      insertAfter(headerRow, makeHeaderCell(), emailHead);
    }

    Array.prototype.slice.call(table.querySelectorAll('tbody tr')).forEach(function (tr) {
      var cells = Array.prototype.slice.call(tr.children);
      if (cells.length === 1 && cells[0].colSpan) {
        cells[0].colSpan = Math.max(Number(cells[0].colSpan || 8), 9);
        return;
      }
      var nameCell = cells[0];
      var emailCell = cells[1];
      var email = emailCell ? (emailCell.textContent || '').trim() : '';
      if (!email) return;
      enhanceNameCell(nameCell, email);
      if (!tr.querySelector('[data-najran-hospital-col="1"]')) insertAfter(tr, makeBodyCell(email), emailCell);
    });
  }

  var observer = new MutationObserver(function () { patchTable(); });
  function start() {
    patchTable();
    try { observer.observe(document.body, { childList: true, subtree: true }); } catch (_) {}
    setInterval(patchTable, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();