/* admin-users-hospital-column.js
 * عرض فقط: يضيف عمود المستشفى/المواقع في شاشة إدارة المستخدمين.
 * لا يغير المستخدمين، لا يرسل PATCH/POST، ولا يلمس الربط أو الصلاحيات.
 */
(function () {
  'use strict';

  var userHospitalByEmail = new Map();
  var userHospitalById = new Map();

  function isAdminUsersPage() {
    return /\/admin\/users(?:$|[?#])/.test(location.pathname + location.search);
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
      if (u.email) userHospitalByEmail.set(String(u.email).trim().toLowerCase(), label);
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
    td.style.minWidth = '150px';
    td.style.maxWidth = '220px';

    var label = userHospitalByEmail.get(String(email || '').trim().toLowerCase()) || 'غير محدد';
    var badge = document.createElement('span');
    badge.textContent = label;
    badge.title = label;
    badge.style.display = 'inline-block';
    badge.style.maxWidth = '210px';
    badge.style.overflow = 'hidden';
    badge.style.textOverflow = 'ellipsis';
    badge.style.whiteSpace = 'nowrap';
    badge.style.border = label === 'غير محدد' ? '1px solid #fed7aa' : '1px solid #bfdbfe';
    badge.style.background = label === 'غير محدد' ? '#fff7ed' : '#eff6ff';
    badge.style.color = label === 'غير محدد' ? '#9a3412' : '#1e3a8a';
    badge.style.borderRadius = '999px';
    badge.style.padding = '3px 9px';
    badge.style.fontWeight = '700';
    td.appendChild(badge);
    return td;
  }

  function patchTable() {
    if (!isAdminUsersPage()) return;
    var table = findUsersTable();
    if (!table) return;

    var headerRow = table.querySelector('thead tr');
    if (headerRow && !headerRow.querySelector('[data-najran-hospital-col="1"]')) {
      var heads = Array.prototype.slice.call(headerRow.children);
      var emailHead = heads.find(function (h) { return (h.textContent || '').trim() === 'البريد'; }) || heads[1];
      insertAfter(headerRow, makeHeaderCell(), emailHead);
    }

    Array.prototype.slice.call(table.querySelectorAll('tbody tr')).forEach(function (tr) {
      if (tr.querySelector('[data-najran-hospital-col="1"]')) return;
      var cells = Array.prototype.slice.call(tr.children);
      if (cells.length === 1 && cells[0].colSpan) {
        cells[0].colSpan = Math.max(Number(cells[0].colSpan || 8), 9);
        return;
      }
      var emailCell = cells[1];
      var email = emailCell ? (emailCell.textContent || '').trim() : '';
      if (!email) return;
      insertAfter(tr, makeBodyCell(email), emailCell);
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