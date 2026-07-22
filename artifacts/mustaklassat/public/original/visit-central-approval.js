(function () {
  'use strict';

  var currentVisitId = 0;
  var currentTrigger = null;
  var approvalInFlight = false;
  var BUTTON_ID = 'central-facility-approve';

  function tokenGetters() {
    var scopes = [], seen = [];
    [window.parent, window.top, window].forEach(function (scope) {
      try {
        var fn = scope && scope.najranGetFreshToken;
        if (typeof fn === 'function' && seen.indexOf(fn) === -1) {
          seen.push(fn);
          scopes.push({ scope: scope, fn: fn });
        }
      } catch (_) {}
    });
    return scopes;
  }

  function requestParentToken(force) {
    return new Promise(function (resolve) {
      if (!window.parent || window.parent === window) return resolve(null);
      var requestId = 'central-visit-approval-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      var settled = false;
      function finish(token) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        window.removeEventListener('message', receive);
        resolve(typeof token === 'string' && token.trim() ? token.trim() : null);
      }
      function receive(event) {
        if (
          event.origin !== location.origin ||
          event.source !== window.parent ||
          !event.data ||
          event.data.type !== 'NAJRAN_TOKEN_RESPONSE' ||
          event.data.requestId !== requestId
        ) return;
        finish(event.data.token);
      }
      var timer = setTimeout(function () { finish(null); }, 10000);
      window.addEventListener('message', receive);
      try {
        window.parent.postMessage({
          type: 'NAJRAN_TOKEN_REQUEST',
          requestId: requestId,
          skipCache: !!force
        }, location.origin);
      } catch (_) { finish(null); }
    });
  }

  async function freshToken(force) {
    var getters = tokenGetters();
    for (var i = 0; i < getters.length; i += 1) {
      try {
        var token = await Promise.race([
          Promise.resolve(getters[i].fn.call(getters[i].scope, force ? { skipCache: true } : undefined)),
          new Promise(function (_, reject) {
            setTimeout(function () { reject(new Error('TOKEN_TIMEOUT')); }, 8000);
          })
        ]);
        if (typeof token === 'string' && token.trim()) return token.trim();
      } catch (_) {}
    }
    var bridged = await requestParentToken(!!force);
    if (bridged) return bridged;
    if (!force) {
      try {
        var session = JSON.parse(localStorage.getItem('najran_session') || '{}');
        if (session.clerkToken && Date.now() - Number(session.timestamp || 0) < 55000) {
          return session.clerkToken;
        }
      } catch (_) {}
    }
    throw new Error('انتهت جلسة الدخول؛ اضغط «تحديث آمن» ثم أعد المحاولة');
  }

  async function api(path, options, retried) {
    options = options || {};
    var token = await freshToken(!!retried);
    var response = await fetch('/api/visits' + path, Object.assign({}, options, {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: Object.assign({ Authorization: 'Bearer ' + token }, options.headers || {})
    }));
    var body = await response.json().catch(function () { return {}; });
    if (response.status === 401 && !retried) return api(path, options, true);
    if (!response.ok) {
      var error = new Error(body.error || 'تعذر اعتماد الزيارة');
      error.status = response.status;
      throw error;
    }
    return body;
  }

  function toast(message, ok) {
    var node = document.getElementById('toast');
    if (!node) return;
    node.textContent = message;
    node.className = 'toast show ' + (ok ? 'ok' : 'err');
    clearTimeout(node._centralApprovalTimer);
    node._centralApprovalTimer = setTimeout(function () { node.className = 'toast'; }, 6000);
  }

  function visitModalIsOpen() {
    var modal = document.getElementById('app-modal');
    var title = document.getElementById('modal-title');
    return !!(
      modal &&
      modal.classList.contains('open') &&
      title &&
      String(title.textContent || '').trim().indexOf('ملف الزيارة') === 0
    );
  }

  function facilityApprovalCard() {
    var body = document.getElementById('modal-body');
    if (!body) return null;
    return Array.from(body.querySelectorAll('.card')).find(function (card) {
      var heading = card.querySelector('h3');
      return heading && String(heading.textContent || '').trim() === 'اعتماد إدارة المنشأة';
    }) || null;
  }

  function facilityAlreadyApproved() {
    var card = facilityApprovalCard();
    return !!(card && String(card.textContent || '').indexOf('اعتمدتها المنشأة') !== -1);
  }

  function refreshVisibleData() {
    var refreshButton = document.querySelector('[data-action="refresh"]');
    if (refreshButton && !refreshButton.disabled) refreshButton.click();
    var archiveForm = document.getElementById('archive-filter');
    if (archiveForm) archiveForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }

  function markModalApproved(result) {
    var card = facilityApprovalCard();
    if (!card) return;
    var badge = card.querySelector('.badge');
    if (badge) {
      badge.className = 'badge badge-approved';
      badge.textContent = 'اعتمدتها المنشأة';
    }
    if (!card.querySelector('[data-central-approval-note]')) {
      var note = document.createElement('div');
      note.dataset.centralApprovalNote = 'true';
      note.className = 'note';
      note.style.marginTop = '10px';
      note.style.background = '#f0fdf4';
      note.style.borderColor = '#bbf7d0';
      note.style.color = '#166534';
      note.textContent = 'تم الاعتماد مركزيًا بواسطة ' + (result.facilityApproval.approverName || 'إدارة مركز الزيارات') + '.';
      card.appendChild(note);
    }
  }

  async function approveCurrentVisit(button) {
    if (approvalInFlight || !currentVisitId || facilityAlreadyApproved()) return;
    approvalInFlight = true;
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> جارٍ اعتماد الزيارة';
    try {
      var result = await api('/management/visits/' + currentVisitId + '/facility-approve', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (!result || result.approved !== true || !result.facilityApproval || !result.facilityApproval.id || result.facilityApproval.status !== 'approved') {
        throw new Error('لم يرجع الخادم تأكيدًا صحيحًا لاعتماد الزيارة');
      }
      markModalApproved(result);
      button.innerHTML = '<i class="fas fa-circle-check" aria-hidden="true"></i> الزيارة معتمدة';
      button.disabled = true;
      toast('تم اعتماد الزيارة وحفظ القرار باسم منفذ الاعتماد', true);
      refreshVisibleData();
    } catch (error) {
      button.disabled = false;
      button.innerHTML = '<i class="fas fa-check-double" aria-hidden="true"></i> اعتماد الزيارة';
      toast(error.message || 'تعذر اعتماد الزيارة', false);
    } finally {
      approvalInFlight = false;
    }
  }

  function ensureApprovalButton() {
    if (!visitModalIsOpen() || !currentVisitId) return;
    var foot = document.getElementById('modal-foot');
    if (!foot) return;
    var existing = document.getElementById(BUTTON_ID);
    if (existing) {
      if (facilityAlreadyApproved()) {
        existing.disabled = true;
        existing.innerHTML = '<i class="fas fa-circle-check" aria-hidden="true"></i> الزيارة معتمدة';
      }
      return;
    }
    var button = document.createElement('button');
    button.type = 'button';
    button.id = BUTTON_ID;
    button.className = 'btn btn-green';
    button.disabled = facilityAlreadyApproved();
    button.innerHTML = button.disabled
      ? '<i class="fas fa-circle-check" aria-hidden="true"></i> الزيارة معتمدة'
      : '<i class="fas fa-check-double" aria-hidden="true"></i> اعتماد الزيارة';
    button.addEventListener('click', function () { approveCurrentVisit(button); });
    foot.insertBefore(button, foot.firstChild);
  }

  document.addEventListener('click', function (event) {
    var trigger = event.target.closest('[data-visit-detail]');
    if (!trigger) return;
    currentVisitId = Number(trigger.dataset.visitDetail || 0);
    currentTrigger = trigger;
    setTimeout(ensureApprovalButton, 0);
  }, true);

  var modal = document.getElementById('app-modal');
  if (modal) {
    new MutationObserver(function () {
      if (!visitModalIsOpen()) return;
      if (!currentVisitId && currentTrigger) currentVisitId = Number(currentTrigger.dataset.visitDetail || 0);
      ensureApprovalButton();
    }).observe(modal, { attributes: true, childList: true, subtree: true });
  }
})();
