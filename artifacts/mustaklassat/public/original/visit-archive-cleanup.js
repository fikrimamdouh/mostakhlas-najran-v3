(function () {
  'use strict';

  var CONFIRMATION_TEXT = 'حذف المحدد نهائيًا';

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  async function authToken(force) {
    var scopes = [window, window.parent, window.top];
    for (var i = 0; i < scopes.length; i++) {
      try {
        var getter = scopes[i] && scopes[i].najranGetFreshToken;
        if (typeof getter === 'function') {
          var token = await getter.call(scopes[i], force ? { skipCache: true } : undefined);
          if (typeof token === 'string' && token.trim()) return token.trim();
        }
      } catch (_) {}
    }
    if (!force) try {
      var session = JSON.parse(localStorage.getItem('najran_session') || '{}');
      if (session.clerkToken && Date.now() - Number(session.timestamp || 0) < 55000) return session.clerkToken;
    } catch (_) {}
    throw new Error('انتهت الجلسة؛ اضغط «تحديث آمن» ثم أعد المحاولة');
  }

  async function api(path, options, retried) {
    options = options || {};
    var token = await authToken(!!retried);
    var response = await fetch('/api/visits' + path, Object.assign({}, options, {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: Object.assign({ Authorization: 'Bearer ' + token }, options.headers || {})
    }));
    var body = await response.json().catch(function () { return {}; });
    if (response.status === 401 && !retried) return api(path, options, true);
    if (!response.ok) {
      var error = new Error(body.error || 'فشلت العملية');
      error.status = response.status;
      error.code = body.code || '';
      throw error;
    }
    return body;
  }

  function toast(message, ok) {
    var node = document.getElementById('toast');
    if (!node) return;
    node.textContent = message;
    node.className = 'toast show ' + (ok ? 'ok' : 'err');
    clearTimeout(node._cleanupTimer);
    node._cleanupTimer = setTimeout(function () { node.className = 'toast'; }, 6500);
  }

  function showModal(title, html, buttons) {
    var modal = document.getElementById('app-modal');
    if (!modal) return;
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = html;
    var foot = document.getElementById('modal-foot');
    foot.innerHTML = '';
    (buttons || []).forEach(function (button) {
      var node = document.createElement('button');
      node.type = 'button';
      node.className = 'btn ' + (button.className || 'btn-light');
      node.textContent = button.label;
      node.addEventListener('click', function () { button.action(node); });
      foot.appendChild(node);
    });
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    var modal = document.getElementById('app-modal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  function statusText(visit) {
    return ({ pending: 'بانتظار الاعتماد', approved: 'معتمدة', rejected: 'مرفوضة', cancelled: 'ملغاة' })[visit.status] || visit.status || '—';
  }

  function visitDateText(value) {
    if (!value) return '—';
    try { return new Date(String(value).slice(0, 10) + 'T12:00:00').toLocaleDateString('ar-SA'); }
    catch (_) { return String(value); }
  }

  async function loadAllVisits() {
    var visits = [], page = 1, pages = 1;
    do {
      var body = await api('/management/archive?visibility=all&page=' + page + '&limit=100');
      visits = visits.concat(Array.isArray(body.visits) ? body.visits : []);
      pages = Math.max(1, Math.min(200, Number(body.pages || 1)));
      page += 1;
    } while (page <= pages);
    return visits;
  }

  function visitRow(visit) {
    var protectedLabels = [];
    if (visit.hasSignedPermit) protectedLabels.push('له تصريح موقّع');
    if (visit.facilityApproval && visit.facilityApproval.status === 'approved') protectedLabels.push('اعتمدته المنشأة');
    if (visit.archivedAt) protectedLabels.push('منظف من العرض بالفعل');
    var searchable = [visit.serialNumber, visit.repName, visit.subContractor, visit.systemName, visit.siteLocation, statusText(visit), visitDateText(visit.visitDate)].join(' ').toLocaleLowerCase('ar');
    return '<label class="card" data-clean-row data-search="' + esc(searchable) + '" style="display:grid;grid-template-columns:auto minmax(0,1fr);gap:11px;align-items:start;cursor:pointer;margin-bottom:8px">' +
      '<input type="checkbox" data-clean-visit value="' + visit.id + '" style="width:18px;height:18px;margin-top:4px">' +
      '<span><strong>' + esc(visit.serialNumber || ('زيارة ' + visit.id)) + ' — ' + esc(visit.repName || '—') + '</strong>' +
      '<small style="display:block;color:#64748b;margin-top:3px">' + esc(visit.siteLocation || '—') + ' — ' + esc(visit.systemName || '—') + ' — ' + esc(visit.subContractor || '—') + '</small>' +
      '<small style="display:block;color:#475569;margin-top:3px">' + esc(statusText(visit)) + ' — ' + esc(visitDateText(visit.visitDate)) + (protectedLabels.length ? ' — ' + esc(protectedLabels.join('، ')) : '') + '</small></span></label>';
  }

  function filterRows() {
    var input = document.getElementById('archive-clean-search');
    var query = String(input && input.value || '').toLocaleLowerCase('ar').trim();
    document.querySelectorAll('[data-clean-row]').forEach(function (row) {
      row.style.display = !query || String(row.dataset.search || '').indexOf(query) !== -1 ? 'grid' : 'none';
    });
  }

  function setVisibleSelection(checked) {
    document.querySelectorAll('[data-clean-row]').forEach(function (row) {
      if (row.style.display === 'none') return;
      var checkbox = row.querySelector('[data-clean-visit]');
      if (checkbox) checkbox.checked = checked;
    });
  }

  function refreshArchive() {
    var form = document.getElementById('archive-filter');
    if (!form) return;
    if (form.elements.visibility) form.elements.visibility.value = 'all';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }

  async function permanentlyDeleteSelected(visits, progressNode) {
    var deleted = 0, archivedFirst = 0, failed = [];
    for (var i = 0; i < visits.length; i++) {
      var visit = visits[i];
      if (progressNode) progressNode.textContent = 'جارٍ حذف ' + (i + 1) + ' من ' + visits.length + ': ' + (visit.serialNumber || ('زيارة ' + visit.id));
      try {
        if (!visit.archivedAt) {
          await api('/' + visit.id + '/archive', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'تهيئة الزيارة التجريبية للحذف النهائي من أداة التنظيف' })
          });
          archivedFirst += 1;
        }
        await api('/' + visit.id + '/permanent', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            confirmation: 'DELETE:' + (visit.serialNumber || ('VISIT-' + visit.id)),
            reason: 'حذف نهائي لبيانات زيارة تجريبية من أداة تنظيف الأرشيف'
          })
        });
        deleted += 1;
      } catch (error) {
        failed.push({ visit: visit, message: error.message });
      }
    }
    return { deleted: deleted, archivedFirst: archivedFirst, failed: failed };
  }

  async function openCleanup() {
    var trigger = document.getElementById('archive-clean-tests');
    if (trigger) trigger.disabled = true;
    try {
      var visits = await loadAllVisits();
      if (!visits.length) {
        showModal('تنظيف زيارات محددة', '<div class="note">لا توجد زيارات في الأرشيف.</div>', []);
        return;
      }

      showModal('حذف الزيارات التجريبية',
        '<div class="note" style="background:#fef2f2;color:#991b1b;border-color:#fecaca"><strong>اختر الزيارات بنفسك.</strong><br>سيحذف النظام الزيارات المحددة نهائيًا مع QR والمرفقات واعتماد المنشأة وبيانات الربط. العملية لا يمكن التراجع عنها، وسيبقى سجل تدقيق بالحذف.</div>' +
        '<div class="toolbar" style="margin-top:12px"><input id="archive-clean-search" type="search" placeholder="ابحث بالرقم أو الاسم أو الموقع أو النظام" style="flex:1;min-width:260px"><button type="button" class="btn btn-primary" id="archive-clean-select-visible">تحديد الظاهر</button><button type="button" class="btn btn-light" id="archive-clean-clear">إلغاء التحديد</button></div>' +
        '<div id="archive-clean-list" style="max-height:430px;overflow:auto;padding:2px">' + visits.map(visitRow).join('') + '</div>' +
        '<div class="field" style="margin-top:12px"><label>اكتب «' + CONFIRMATION_TEXT + '» للتأكيد</label><input id="archive-clean-confirmation" autocomplete="off"></div>' +
        '<div id="archive-clean-progress" class="note" style="display:none;margin-top:12px"></div>',
        [{ label: 'حذف الزيارات المحددة نهائيًا', className: 'btn-red', action: async function (button) {
          var confirmation = document.getElementById('archive-clean-confirmation');
          if (!confirmation || confirmation.value.trim() !== CONFIRMATION_TEXT) { toast('اكتب نص التأكيد كما هو ظاهر', false); return; }
          var selectedIds = Array.from(document.querySelectorAll('[data-clean-visit]:checked')).map(function (node) { return Number(node.value); }).filter(Boolean);
          if (!selectedIds.length) { toast('حدد زيارة واحدة على الأقل', false); return; }
          var selected = visits.filter(function (visit) { return selectedIds.indexOf(Number(visit.id)) !== -1; });
          button.disabled = true;
          confirmation.disabled = true;
          var progress = document.getElementById('archive-clean-progress');
          progress.style.display = 'block';
          var result = await permanentlyDeleteSelected(selected, progress);
          progress.innerHTML = 'تم حذف <strong>' + result.deleted + '</strong> زيارة نهائيًا.' + (result.archivedFirst ? ' ونُقلت <strong>' + result.archivedFirst + '</strong> زيارة أولًا إلى المحذوف من العرض.' : '') + (result.failed.length ? ' وتعذر حذف <strong>' + result.failed.length + '</strong> زيارة مرتبطة؛ افتحها واحذف التصاريح المعاد إصدارها أولًا.' : '');
          refreshArchive();
          toast(result.failed.length ? 'تم الحذف مع وجود زيارات مرتبطة لم تُحذف' : 'تم حذف الزيارات المحددة نهائيًا', result.failed.length === 0);
          button.textContent = 'تم التنفيذ';
          setTimeout(closeModal, 1700);
        } }]
      );

      document.getElementById('archive-clean-search')?.addEventListener('input', filterRows);
      document.getElementById('archive-clean-select-visible')?.addEventListener('click', function () { setVisibleSelection(true); });
      document.getElementById('archive-clean-clear')?.addEventListener('click', function () { document.querySelectorAll('[data-clean-visit]').forEach(function (node) { node.checked = false; }); });
    } catch (error) {
      toast(error.message, false);
    } finally {
      if (trigger) trigger.disabled = false;
    }
  }

  function ensureCleanupButton() {
    var button = document.getElementById('archive-clean-tests');
    var title = document.querySelector('[data-panel="archive"] .panel-title');
    if (!button && title) {
      button = document.createElement('button');
      button.type = 'button';
      button.id = 'archive-clean-tests';
      button.className = 'btn btn-red';
      title.appendChild(button);
    }
    if (button) button.innerHTML = '<i class="fas fa-trash-alt"></i> حذف وتنظيف الزيارات';
    var note = document.querySelector('[data-panel="archive"] .note');
    if (note) note.textContent = 'زر الحذف والتنظيف يقرأ جميع الزيارات ويعرضها للاختيار اليدوي. الزيارات المحددة تُحذف نهائيًا مع QR والمرفقات وبيانات الربط، مع تسجيل عملية الحذف باسم المنفذ.';
    return button;
  }

  var button = ensureCleanupButton();
  if (button) button.addEventListener('click', openCleanup);
})();
