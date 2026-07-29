(function () {
  'use strict';

  function loadIncomingWorkflow() {
    if (document.getElementById('najran-incoming-visit-workflow-loader')) return;
    var script = document.createElement('script');
    script.id = 'najran-incoming-visit-workflow-loader';
    script.defer = true;
    script.src = '/original/visit-incoming-workflow.js?v=20260722_incoming_split_v1';
    script.addEventListener('load', function () {
      console.log('[NajranVisits] incoming visit workflow loaded');
    });
    script.addEventListener('error', function () {
      console.error('[NajranVisits] incoming visit workflow failed to load');
    });
    document.head.appendChild(script);
  }

  loadIncomingWorkflow();

  if (window.__NAJRAN_CENTRAL_VISIT_APPROVAL_V3__) return;
  window.__NAJRAN_CENTRAL_VISIT_APPROVAL_V3__ = true;

  var currentVisitId = 0;
  var approvalInFlight = false;
  var ensureScheduled = false;
  var BUTTON_ID = 'central-facility-approve';

  function tokenGetters() {
    var scopes = [];
    var seen = [];
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
      var timer;

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

      timer = setTimeout(function () { finish(null); }, 10000);
      window.addEventListener('message', receive);
      try {
        window.parent.postMessage({
          type: 'NAJRAN_TOKEN_REQUEST',
          requestId: requestId,
          skipCache: !!force
        }, location.origin);
      } catch (_) {
        finish(null);
      }
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
        if (session.clerkToken && Date.now() - Number(session.timestamp || 0) < 55000) return session.clerkToken;
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

  function facilityRejected() {
    var card = facilityApprovalCard();
    return !!(card && String(card.textContent || '').indexOf('رفضتها المنشأة') !== -1);
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
      if (badge.className !== 'badge badge-approved') badge.className = 'badge badge-approved';
      if (badge.textContent !== 'اعتمدتها المنشأة') badge.textContent = 'اعتمدتها المنشأة';
    }
    if (!card.querySelector('[data-central-approval-note]')) {
      var note = document.createElement('div');
      note.dataset.centralApprovalNote = 'true';
      note.className = 'note';
      note.style.marginTop = '10px';
      note.style.background = '#f0fdf4';
      note.style.borderColor = '#bbf7d0';
      note.style.color = '#166534';
      note.textContent = 'تم الاعتماد باسم الموقع: ' + (result.facilityApproval.approverName || result.facilityApproval.siteName || 'الموقع') + ' — الصفة: ' + (result.facilityApproval.approverTitle || 'مدير وحدة الصيانة العامة بتجمع نجران الصحي') + '.';
      card.appendChild(note);
    }
  }

  function setButtonState(button, className, disabled, label) {
    if (button.className !== className) button.className = className;
    if (button.disabled !== disabled) button.disabled = disabled;
    if (button.textContent !== label) button.textContent = label;
  }

  function applyButtonState(button) {
    if (facilityRejected()) {
      setButtonState(button, 'btn btn-red', true, 'المنشأة رفضت الزيارة');
      return;
    }
    if (facilityAlreadyApproved()) {
      setButtonState(button, 'btn btn-green', true, 'الزيارة معتمدة');
      return;
    }
    setButtonState(button, 'btn btn-green', false, 'اعتماد الزيارة');
  }

  async function approveCurrentVisit(button) {
    if (approvalInFlight || !currentVisitId || facilityAlreadyApproved()) return;
    if (facilityRejected()) {
      toast('المنشأة رفضت الزيارة بالفعل؛ لا يمكن للاعتماد المركزي تجاوز قرار الرفض', false);
      return;
    }

    approvalInFlight = true;
    setButtonState(button, 'btn btn-green', true, 'جارٍ اعتماد الزيارة');
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
      setButtonState(button, 'btn btn-green', true, 'الزيارة معتمدة');
      toast(result.alreadyApproved ? 'الزيارة كانت معتمدة بالفعل' : 'تم اعتماد الزيارة وحفظ القرار باسم الموقع', true);
      refreshVisibleData();
    } catch (error) {
      setButtonState(button, 'btn btn-green', false, 'اعتماد الزيارة');
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
      applyButtonState(existing);
      return;
    }

    var button = document.createElement('button');
    button.type = 'button';
    button.id = BUTTON_ID;
    button.dataset.visitId = String(currentVisitId);
    applyButtonState(button);
    button.addEventListener('click', function () { approveCurrentVisit(button); });
    foot.insertBefore(button, foot.firstChild);
  }

  function scheduleEnsureApprovalButton() {
    if (ensureScheduled) return;
    ensureScheduled = true;
    var schedule = typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame.bind(window)
      : function (callback) { return setTimeout(callback, 0); };
    schedule(function () {
      ensureScheduled = false;
      ensureApprovalButton();
    });
  }

  document.addEventListener('click', function (event) {
    var trigger = event.target.closest('[data-visit-detail]');
    if (!trigger) return;
    currentVisitId = Number(trigger.dataset.visitDetail || 0);
    scheduleEnsureApprovalButton();
  }, true);

  var modal = document.getElementById('app-modal');
  if (modal) {
    new MutationObserver(function () {
      if (!visitModalIsOpen()) return;
      scheduleEnsureApprovalButton();
    }).observe(modal, {
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
      subtree: true
    });
  }

  var managementBootstrapCache = null;
  var directRepresentativeRepairTimer = 0;
  var companyEditorBusy = false;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function entityName(row) {
    return row ? (row.displayName || row.name || '') : '';
  }

  async function managementBootstrap(force) {
    if (force) managementBootstrapCache = null;
    if (!managementBootstrapCache) managementBootstrapCache = api('/management/bootstrap');
    try {
      return await managementBootstrapCache;
    } catch (error) {
      managementBootstrapCache = null;
      throw error;
    }
  }

  function directRepresentativeIds() {
    return Array.from(document.querySelectorAll('[data-direct-representative]:checked'))
      .map(function (node) { return Number(node.value || 0); })
      .filter(Boolean);
  }

  function ensureExactOption(select, row, suffix) {
    if (!select || !row) return;
    var value = String(row.id);
    var exists = Array.from(select.options).some(function (option) { return option.value === value; });
    if (!exists) {
      var option = document.createElement('option');
      option.value = value;
      option.textContent = entityName(row) + (suffix ? ' — ' + suffix : '');
      select.appendChild(option);
    }
    select.value = value;
  }

  function renderExactRepresentativeChoices(data, contractorId, systemId, selectedIds) {
    var container = document.getElementById('direct-representative-options');
    if (!container) return;
    var selected = new Set((selectedIds || []).map(Number).filter(Boolean).slice(-4));
    var rows = (data.representatives || []).filter(function (representative) {
      return representative.isActive &&
        Number(representative.contractorId) === contractorId &&
        (data.representativeSystems || []).some(function (link) {
          return link.isActive &&
            Number(link.representativeId) === Number(representative.id) &&
            Number(link.systemId) === systemId;
        });
    }).sort(function (a, b) {
      return String(a.fullName || '').localeCompare(String(b.fullName || ''), 'ar');
    });

    container.innerHTML = rows.length ? rows.map(function (representative) {
      var identity = representative.identityNumber || representative.identityMasked || '—';
      var mobile = representative.mobile || representative.mobileMasked || '—';
      return '<label class="representative-choice"><input type="checkbox" data-direct-representative value="' +
        representative.id + '"' + (selected.has(Number(representative.id)) ? ' checked' : '') +
        '><span><strong>' + esc(representative.fullName) + '</strong><small>' +
        esc(identity) + ' — ' + esc(mobile) + '</small></span></label>';
    }).join('') : '<div class="empty" style="grid-column:1/-1;padding:16px!important">لا يوجد مندوب مرتبط بهذه الشركة والنظام.</div>';

    var chosen = container.querySelector('[data-direct-representative]:checked');
    if (chosen) chosen.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function repairDirectSavedRepresentative() {
    clearTimeout(directRepresentativeRepairTimer);
    var savedSelect = document.getElementById('direct-saved-representative');
    var form = document.getElementById('direct-form');
    if (!savedSelect || !form) return;
    var representativeId = Number(savedSelect.value || 0);
    if (!representativeId) return;

    try {
      var data = await managementBootstrap(false);
      var representative = (data.representatives || []).find(function (row) {
        return row.isActive && Number(row.id) === representativeId;
      });
      if (!representative) return;

      var links = (data.representativeSystems || []).filter(function (row) {
        return row.isActive && Number(row.representativeId) === representativeId;
      });
      var systemSelect = form.elements.systemId;
      var currentSystemId = Number(systemSelect && systemSelect.value || 0);
      var selectedLink = links.find(function (row) { return Number(row.systemId) === currentSystemId; }) || links[0];
      if (!selectedLink) return;

      var system = (data.systems || []).find(function (row) { return Number(row.id) === Number(selectedLink.systemId); });
      var contractor = (data.contractors || []).find(function (row) { return Number(row.id) === Number(representative.contractorId); });
      if (!system || !contractor) return;

      ensureExactOption(systemSelect, system, '');
      var contractorSelect = form.elements.contractorId;
      ensureExactOption(contractorSelect, contractor, 'مرتبطة بالمندوب');

      var selectedIds = directRepresentativeIds();
      if (selectedIds.indexOf(representativeId) === -1) selectedIds.push(representativeId);
      renderExactRepresentativeChoices(data, Number(contractor.id), Number(system.id), selectedIds);
      savedSelect.value = String(representativeId);
    } catch (error) {
      toast(error.message || 'تعذر تثبيت شركة المندوب المختار', false);
    }
  }

  function scheduleDirectRepresentativeRepair() {
    clearTimeout(directRepresentativeRepairTimer);
    directRepresentativeRepairTimer = setTimeout(repairDirectSavedRepresentative, 0);
  }

  function completedVisitLabels() {
    var option = document.querySelector('#archive-filter select[name="status"] option[value="expired"]');
    if (option && option.textContent !== 'تمت الزيارة') option.textContent = 'تمت الزيارة';
    document.querySelectorAll('[data-panel="archive"] .badge-expired').forEach(function (badge) {
      if (badge.textContent !== 'تمت الزيارة') badge.textContent = 'تمت الزيارة';
    });
  }

  function contractorOptionLabel(contractor, duplicateNames) {
    var name = entityName(contractor) || ('شركة #' + contractor.id);
    var registration = String(contractor.registrationNumber || '').trim();
    var suffix = registration ? ' — سجل ' + registration : '';
    if (duplicateNames[name] > 1) suffix += ' — رقم داخلي ' + contractor.id;
    return name + suffix;
  }

  async function openRepresentativeCompanyEditor(representativeId) {
    if (companyEditorBusy) return;
    companyEditorBusy = true;
    try {
      var data = await managementBootstrap(false);
      var representative = (data.representatives || []).find(function (row) {
        return Number(row.id) === representativeId;
      });
      if (!representative) throw new Error('المندوب غير موجود في البيانات الحالية');

      var contractors = (data.contractors || []).filter(function (row) { return row.isActive; });
      var duplicateNames = {};
      contractors.forEach(function (row) {
        var name = entityName(row);
        duplicateNames[name] = Number(duplicateNames[name] || 0) + 1;
      });
      var options = contractors.sort(function (a, b) {
        return entityName(a).localeCompare(entityName(b), 'ar');
      }).map(function (contractor) {
        return '<option value="' + contractor.id + '"' +
          (Number(contractor.id) === Number(representative.contractorId) ? ' selected' : '') +
          '>' + esc(contractorOptionLabel(contractor, duplicateNames)) + '</option>';
      }).join('');

      var currentContractor = contractors.find(function (row) {
        return Number(row.id) === Number(representative.contractorId);
      });
      var html = '<form id="representative-company-form" class="form-grid">' +
        '<div class="field full"><label>المندوب</label><input value="' + esc(representative.fullName) + '" disabled></div>' +
        '<div class="field full"><label>الشركة الحالية</label><input value="' + esc(entityName(currentContractor) || 'غير محددة') + '" disabled></div>' +
        '<div class="field full"><label>ربط المندوب بشركة</label><select name="contractorId" required>' + options + '</select></div>' +
        '<div class="field full"><div class="note">يتغير ربط المندوب في الدليل والإصدارات الجديدة فقط. لا تُعدّل بيانات الزيارات القديمة أو أرقام الهوية أو روابط الأنظمة.</div></div>' +
        '</form>';

      var modalTitle = document.getElementById('modal-title');
      var modalBody = document.getElementById('modal-body');
      var modalFoot = document.getElementById('modal-foot');
      var modalNode = document.getElementById('app-modal');
      if (!modalTitle || !modalBody || !modalFoot || !modalNode) throw new Error('نافذة التعديل غير متاحة');
      modalTitle.textContent = 'تعديل شركة المندوب';
      modalBody.innerHTML = html;
      modalFoot.innerHTML = '';
      var save = document.createElement('button');
      save.type = 'button';
      save.className = 'btn btn-green';
      save.textContent = 'حفظ ربط الشركة';
      save.addEventListener('click', async function () {
        var form = document.getElementById('representative-company-form');
        if (!form || !form.reportValidity()) return;
        var contractorId = Number(form.elements.contractorId.value || 0);
        if (!contractorId) return;
        save.disabled = true;
        try {
          var result = await api('/management/representatives/' + representativeId, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contractorId: contractorId })
          });
          if (!result || !result.representative || Number(result.representative.id) !== representativeId || Number(result.representative.contractorId) !== contractorId) {
            throw new Error('لم يرجع الخادم تأكيدًا صحيحًا لتعديل شركة المندوب');
          }
          modalNode.classList.remove('open');
          document.body.style.overflow = '';
          managementBootstrapCache = null;
          toast('تم تعديل شركة المندوب مع الاحتفاظ بالهوية والأنظمة والزيارات السابقة', true);
          refreshVisibleData();
        } catch (error) {
          save.disabled = false;
          toast(error.message || 'تعذر تعديل شركة المندوب', false);
        }
      });
      modalFoot.appendChild(save);
      modalNode.classList.add('open');
      document.body.style.overflow = 'hidden';
    } catch (error) {
      toast(error.message || 'تعذر فتح تعديل شركة المندوب', false);
    } finally {
      companyEditorBusy = false;
    }
  }

  function ensureRepresentativeCompanyButtons() {
    document.querySelectorAll('#reps-list .representative-card').forEach(function (card) {
      var actions = card.querySelector('.representative-actions');
      var idSource = card.querySelector('[data-rep-systems]');
      if (!actions || !idSource) return;
      var representativeId = Number(idSource.dataset.repSystems || 0);
      if (!representativeId || actions.querySelector('[data-edit-representative-company="' + representativeId + '"]')) return;
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-amber';
      button.dataset.editRepresentativeCompany = String(representativeId);
      button.innerHTML = '<i class="fas fa-building" aria-hidden="true"></i> تعديل الشركة';
      actions.insertBefore(button, actions.firstChild);
    });
  }

  document.addEventListener('change', function (event) {
    if (event.target && event.target.id === 'direct-saved-representative') scheduleDirectRepresentativeRepair();
    if (event.target && event.target.matches && event.target.matches('#direct-form [name="systemId"]')) scheduleDirectRepresentativeRepair();
  });

  document.addEventListener('click', function (event) {
    var trigger = event.target.closest('[data-edit-representative-company]');
    if (!trigger) return;
    openRepresentativeCompanyEditor(Number(trigger.dataset.editRepresentativeCompany || 0));
  });

  completedVisitLabels();
  ensureRepresentativeCompanyButtons();
  new MutationObserver(function () {
    completedVisitLabels();
    ensureRepresentativeCompanyButtons();
  }).observe(document.body, { childList: true, subtree: true });

  console.log('[NajranVisits] central approval + direct representative binding repairs loaded');
})();