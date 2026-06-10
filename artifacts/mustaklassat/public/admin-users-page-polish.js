/* admin-users-page-polish.js
 * تحسين عرض صفحة إدارة المستخدمين فقط.
 * لا يغير API، لا يغير صلاحيات، لا يغير بيانات، لا يلمس المزامنة.
 */
(function () {
  'use strict';

  if (window.__NAJRAN_ADMIN_USERS_PAGE_POLISH__) return;
  window.__NAJRAN_ADMIN_USERS_PAGE_POLISH__ = true;

  function isAdminUsersPage() {
    return /\/admin\/users(?:$|[?#])/.test(location.pathname + location.search);
  }

  function ensureStyle() {
    if (document.getElementById('najran-admin-users-polish-style')) return;
    var st = document.createElement('style');
    st.id = 'najran-admin-users-polish-style';
    st.textContent = [
      'body:has(table) main{background:#f4f7fb!important}',
      'body:has(table) main>div{padding:16px!important}',
      'body:has(table) h1{font-size:24px!important;letter-spacing:-.2px}',
      'body:has(table) h1+ p{font-size:13px!important;color:#64748b!important}',
      'body:has(table) .space-y-6{display:flex!important;flex-direction:column!important;gap:14px!important}',
      'body:has(table) .space-y-6>div:first-child{background:#fff!important;border:1px solid #e2e8f0!important;border-radius:18px!important;padding:16px!important;box-shadow:0 10px 28px rgba(15,23,42,.06)!important}',
      'body:has(table) .space-y-6>div:first-child>div:last-child{gap:8px!important}',
      'body:has(table) .space-y-6>div:first-child button{border-radius:10px!important;font-weight:800!important}',
      'body:has(table) .space-y-6>div:nth-child(2){background:#e9eef8!important;border:1px solid #dbe5f5!important;border-radius:14px!important;padding:5px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.8)}',
      'body:has(table) .space-y-6>div:nth-child(2) button{border-radius:10px!important;height:36px!important}',
      'body:has(table) .relative{background:#fff!important;border:1px solid #e2e8f0!important;border-radius:14px!important;padding:6px!important;box-shadow:0 8px 20px rgba(15,23,42,.04)!important}',
      'body:has(table) .relative input{border:0!important;box-shadow:none!important;background:#f8fafc!important;border-radius:10px!important;height:38px!important}',
      '.najran-users-table-card{background:#fff!important;border:1px solid #dbe5f5!important;border-radius:18px!important;box-shadow:0 14px 36px rgba(15,23,42,.08)!important;overflow:hidden!important}',
      '.najran-users-table-card:before{content:"قائمة المستخدمين";display:block;padding:12px 16px;background:linear-gradient(135deg,#f8fafc,#eef4ff);border-bottom:1px solid #e2e8f0;color:#1e3c72;font-size:14px;font-weight:900}',
      '.najran-users-table-card table{width:100%!important;border-collapse:separate!important;border-spacing:0!important;table-layout:auto!important}',
      '.najran-users-table-card thead tr{background:#0f2d57!important}',
      '.najran-users-table-card th{position:sticky!important;top:0!important;z-index:2!important;background:#0f2d57!important;color:#fff!important;font-size:12px!important;font-weight:900!important;white-space:nowrap!important;padding:11px 9px!important;border:0!important}',
      '.najran-users-table-card td{font-size:12px!important;padding:10px 8px!important;border-bottom:1px solid #edf2f7!important;vertical-align:middle!important;color:#334155!important}',
      '.najran-users-table-card tbody tr:nth-child(even){background:#f8fbff!important}',
      '.najran-users-table-card tbody tr:hover{background:#fff7ed!important}',
      '.najran-users-table-card td:nth-child(1){min-width:150px!important;font-weight:900!important;color:#0f172a!important}',
      '.najran-users-table-card td:nth-child(2){max-width:235px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;color:#64748b!important;direction:ltr!important;text-align:left!important}',
      '.najran-users-table-card td:nth-child(3){min-width:230px!important}',
      '.najran-users-table-card td:nth-child(4){min-width:135px!important}',
      '.najran-users-table-card td:nth-child(5),.najran-users-table-card td:nth-child(6){white-space:nowrap!important;color:#64748b!important}',
      '.najran-users-table-card td:nth-last-child(1){min-width:150px!important}',
      '.najran-users-table-card button,.najran-users-table-card select{border-radius:9px!important;font-weight:800!important}',
      '.najran-users-table-card select{height:28px!important;background:#fff!important;border:1px solid #cbd5e1!important;color:#334155!important}',
      '.najran-users-role-wrap{display:flex!important;align-items:center!important;gap:6px!important;flex-wrap:wrap!important}',
      '.najran-users-action-wrap{display:flex!important;align-items:center!important;justify-content:center!important;gap:5px!important;flex-wrap:wrap!important}',
      '.najran-users-note{margin-top:8px;padding:9px 12px;border-radius:12px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:12px;font-weight:800;display:flex;align-items:center;gap:8px;line-height:1.7}',
      '@media(max-width:1300px){.najran-users-table-card{overflow-x:auto!important}.najran-users-table-card table{min-width:1180px!important}}',
      '@media(max-width:900px){body:has(table) main>div{padding:10px!important}.najran-users-table-card table{min-width:1120px!important}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  function findUsersTable() {
    var tables = Array.prototype.slice.call(document.querySelectorAll('table'));
    return tables.find(function (table) {
      var t = table.textContent || '';
      return t.indexOf('الصلاحية') > -1 && t.indexOf('الوحدات') > -1 && t.indexOf('الإجراءات') > -1;
    }) || null;
  }

  function polishTable() {
    if (!isAdminUsersPage()) return;
    ensureStyle();
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

  function loop() {
    polishTable();
    setTimeout(loop, 1200);
  }

  document.addEventListener('DOMContentLoaded', polishTable);
  loop();
})();
