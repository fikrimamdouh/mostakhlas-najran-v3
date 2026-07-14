(function () {
  'use strict';

  var CONFIRMATION_TEXT = 'تنظيف التجارب';
  var TEST_REASON_PATTERN = /تجريب/u;

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
    node._cleanupTimer = setTimeout(function () { node.className = 'toast'; }, 6000);
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

  function isExplicitTestVisit(visit) {
    var reason = String(visit.archiveReason || visit.cancelledReason || '');
    return !!visit.archivedAt && visit.status === 'cancelled' && TEST_REASON_PATTERN.test(reason);
  }

  function isProtectedVisit(visit) {
    return !!visit.hasSignedPermit || !!(visit.facilityApproval && visit.facilityApproval.status === 'approved');
  }

  async function loadArchivedVisits() {
    var visits = [], page = 1, pages = 1;
    do {
      var body = await api('/management/archive?visibility=archived&status=cancelled&page=' + page + '&limit=100');
      visits = visits.concat(Array.isArray(body.visits) ? body.visits : []);
      pages = Math.max(1, Math.min(100, Number(body.pages || 1)));
      page += 1;
    } while (page <= pages);
    return visits;
  }

  async function deleteTestVisits(visits, progressNode) {
    var pending = visits.slice().sort(function (a, b) { return Number(b.id) - Number(a.id); });
    var deleted = [], failed = [], pass = 0, progressMade = true;
    while (pending.length && progressMade && pass < visits.length + 1) {
      pass += 1;
      progressMade = false;
      var deferred = [];
      for (var i = 0; i < pending.length; i++) {
        var visit = pending[i];
        if (progressNode) progressNode.textContent = 'جارٍ تنظيف ' + (deleted.length + 1) + ' من ' + visits.length + ': ' + (visit.serialNumber || ('زيارة ' + visit.id));
        try {
          await api('/' + visit.id + '/permanent', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              confirmation: 'DELETE:' + (visit.serialNumber || ('VISIT-' + visit.id)),
              reason: 'تنظيف الزيارات التجريبية قبل التشغيل الفعلي'
            })
          });
          deleted.push(visit);
          progressMade = true;
        } catch (error) {
          if (/المعاد إصداره|مرتبط بهذه الزيارة/.test(error.message)) deferred.push(visit);
          else failed.push({ visit: visit, message: error.message });
        }
      }
      pending = deferred;
    }
    pending.forEach(function (visit) { failed.push({ visit: visit, message: 'مرتبطة بزيارة معاد إصدارها لم تُحذف' }); });
    return { deleted: deleted, failed: failed };
  }

  function refreshArchive() {
    var form = document.getElementById('archive-filter');
    if (!form) return;
    if (form.elements.visibility) form.elements.visibility.value = 'archived';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }

  async function openCleanup() {
    var trigger = document.getElementById('archive-clean-tests');
    if (trigger) trigger.disabled = true;
    try {
      var archived = await loadArchivedVisits();
      var explicitTests = archived.filter(isExplicitTestVisit);
      var eligible = explicitTests.filter(function (visit) { return !isProtectedVisit(visit); });
      var protectedVisits = explicitTests.filter(isProtectedVisit);
      if (!eligible.length) {
        showModal('تنظيف الزيارات التجريبية', '<div class="note">لا توجد زيارات تجريبية مؤرشفة قابلة للتنظيف. الزيارات الحقيقية، والزيارات المعتمدة من المنشأة، وأي زيارة لها تصريح موقّع لا يتم حذفها.</div>' + (protectedVisits.length ? '<div class="note" style="margin-top:10px;background:#fff7ed;color:#9a3412;border-color:#fed7aa">تم استبعاد ' + protectedVisits.length + ' زيارة محمية.</div>' : ''), []);
        return;
      }
      var sample = eligible.slice(0, 12).map(function (visit) { return '<li>' + esc(visit.serialNumber || ('زيارة ' + visit.id)) + ' — ' + esc(visit.repName || '') + '</li>'; }).join('');
      showModal('تنظيف الزيارات التجريبية',
        '<div class="note" style="background:#fff7ed;color:#9a3412;border-color:#fed7aa"><strong>سيتم حذف ' + eligible.length + ' زيارة تجريبية مؤرشفة نهائيًا.</strong><br>لن تُحذف أي زيارة حقيقية، أو زيارة معتمدة من المنشأة، أو زيارة لها تصريح موقّع. كل حذف يمر عبر الحماية الحالية ويُسجل في سجل التدقيق.</div>' +
        '<ul style="max-height:190px;overflow:auto;line-height:1.8;margin:12px 0">' + sample + (eligible.length > 12 ? '<li>و' + (eligible.length - 12) + ' زيارة أخرى</li>' : '') + '</ul>' +
        (protectedVisits.length ? '<div class="note" style="margin-bottom:12px">تم استبعاد ' + protectedVisits.length + ' زيارة محمية من التنظيف.</div>' : '') +
        '<div class="field"><label>اكتب «' + CONFIRMATION_TEXT + '» للتأكيد</label><input id="archive-clean-confirmation" autocomplete="off"></div><div id="archive-clean-progress" class="note" style="display:none;margin-top:12px"></div>',
        [{ label: 'تنظيف الزيارات التجريبية', className: 'btn-red', action: async function (button) {
          var confirmation = document.getElementById('archive-clean-confirmation');
          if (!confirmation || confirmation.value.trim() !== CONFIRMATION_TEXT) { toast('اكتب نص التأكيد كما هو ظاهر', false); return; }
          button.disabled = true;
          confirmation.disabled = true;
          var progress = document.getElementById('archive-clean-progress');
          progress.style.display = 'block';
          var result = await deleteTestVisits(eligible, progress);
          progress.innerHTML = 'تم حذف <strong>' + result.deleted.length + '</strong> زيارة تجريبية.' + (result.failed.length ? ' تعذر حذف <strong>' + result.failed.length + '</strong> زيارة مرتبطة أو محمية.' : ' لم تُمس أي زيارة أخرى.');
          refreshArchive();
          toast(result.failed.length ? 'تم التنظيف مع استبعاد الزيارات المرتبطة' : 'تم تنظيف الزيارات التجريبية المؤرشفة', result.failed.length === 0);
          button.textContent = 'تم التنفيذ';
          setTimeout(closeModal, 1400);
        } }]
      );
    } catch (error) {
      toast(error.message, false);
    } finally {
      if (trigger) trigger.disabled = false;
    }
  }

  function ensureCleanupButton() {
    var existing = document.getElementById('archive-clean-tests');
    if (existing) return existing;
    var title = document.querySelector('[data-panel="archive"] .panel-title');
    if (!title) return null;
    var button = document.createElement('button');
    button.type = 'button';
    button.id = 'archive-clean-tests';
    button.className = 'btn btn-red';
    button.innerHTML = '<i class="fas fa-broom"></i> تنظيف الزيارات التجريبية';
    title.appendChild(button);
    return button;
  }

  var button = ensureCleanupButton();
  if (button) button.addEventListener('click', openCleanup);
})();
