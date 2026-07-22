(function () {
  'use strict';
  if (window.__NAJRAN_INCOMING_VISIT_WORKFLOW_V1__) return;
  window.__NAJRAN_INCOMING_VISIT_WORKFLOW_V1__ = true;

  var bootstrapCache = null;
  var busy = false;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function normalize(value) {
    return String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('ar');
  }

  function tokenGetters() {
    var result = [], seen = [];
    [window.parent, window.top, window].forEach(function (scope) {
      try {
        var fn = scope && scope.najranGetFreshToken;
        if (typeof fn === 'function' && seen.indexOf(fn) === -1) {
          seen.push(fn); result.push({ scope: scope, fn: fn });
        }
      } catch (_) {}
    });
    return result;
  }

  function requestParentToken(force) {
    return new Promise(function (resolve) {
      if (!window.parent || window.parent === window) return resolve(null);
      var requestId = 'incoming-visit-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      var settled = false;
      function finish(token) {
        if (settled) return;
        settled = true; clearTimeout(timer); window.removeEventListener('message', receive);
        resolve(typeof token === 'string' && token.trim() ? token.trim() : null);
      }
      function receive(event) {
        if (event.origin !== location.origin || event.source !== window.parent || !event.data || event.data.type !== 'NAJRAN_TOKEN_RESPONSE' || event.data.requestId !== requestId) return;
        finish(event.data.token);
      }
      var timer = setTimeout(function () { finish(null); }, 10000);
      window.addEventListener('message', receive);
      try { window.parent.postMessage({ type: 'NAJRAN_TOKEN_REQUEST', requestId: requestId, skipCache: !!force }, location.origin); }
      catch (_) { finish(null); }
    });
  }

  async function freshToken(force) {
    var getters = tokenGetters();
    for (var i = 0; i < getters.length; i += 1) {
      try {
        var token = await Promise.race([
          Promise.resolve(getters[i].fn.call(getters[i].scope, force ? { skipCache: true } : undefined)),
          new Promise(function (_, reject) { setTimeout(function () { reject(new Error('TOKEN_TIMEOUT')); }, 8000); })
        ]);
        if (typeof token === 'string' && token.trim()) return token.trim();
      } catch (_) {}
    }
    var bridged = await requestParentToken(!!force);
    if (bridged) return bridged;
    if (!force) try {
      var session = JSON.parse(localStorage.getItem('najran_session') || '{}');
      if (session.clerkToken && Date.now() - Number(session.timestamp || 0) < 55000) return session.clerkToken;
    } catch (_) {}
    throw new Error('انتهت جلسة الدخول؛ اضغط «تحديث آمن» ثم أعد المحاولة');
  }

  async function api(path, options, retried) {
    options = options || {};
    var token = await freshToken(!!retried);
    var response = await fetch('/api/visits' + path, Object.assign({}, options, {
      credentials: 'same-origin', cache: 'no-store',
      headers: Object.assign({ Authorization: 'Bearer ' + token }, options.headers || {})
    }));
    var body = await response.json().catch(function () { return {}; });
    if (response.status === 401 && !retried) return api(path, options, true);
    if (!response.ok) throw new Error(body.error || 'فشلت العملية');
    return body;
  }

  function toast(message, ok) {
    var node = document.getElementById('toast');
    if (!node) return;
    node.textContent = message; node.className = 'toast show ' + (ok ? 'ok' : 'err');
    clearTimeout(node._incomingVisitTimer);
    node._incomingVisitTimer = setTimeout(function () { node.className = 'toast'; }, 6500);
  }

  function closeModal() {
    var modal = document.getElementById('app-modal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  function showModal(title, html, buttons) {
    var modal = document.getElementById('app-modal');
    if (!modal) return;
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = html;
    var foot = document.getElementById('modal-foot'); foot.innerHTML = '';
    (buttons || []).forEach(function (button) {
      var node = document.createElement('button');
      node.type = 'button'; node.className = 'btn ' + (button.className || 'btn-light'); node.textContent = button.label;
      node.addEventListener('click', function () { button.action(node); }); foot.appendChild(node);
    });
    modal.classList.add('open'); document.body.style.overflow = 'hidden';
  }

  function refreshIncoming() {
    bootstrapCache = null;
    var refresh = document.querySelector('[data-action="refresh"]');
    if (refresh && !refresh.disabled) refresh.click(); else location.reload();
  }

  async function bootstrap() {
    if (bootstrapCache) return bootstrapCache;
    bootstrapCache = await api('/management/bootstrap');
    return bootstrapCache;
  }

  function optionRows(rows, selected, label) {
    return '<option value="">اختر</option>' + (rows || []).map(function (row) {
      return '<option value="' + row.id + '"' + (String(row.id) === String(selected || '') ? ' selected' : '') + '>' + esc(label(row)) + '</option>';
    }).join('');
  }

  function siteOptions(data, maintenanceKey, selected) {
    var maintenance = (data.maintenanceContractors || []).find(function (row) { return row.key === maintenanceKey; });
    return '<option value="">اختر الموقع</option>' + ((maintenance && maintenance.sites) || []).map(function (site) {
      return '<option value="' + esc(site) + '"' + (site === selected ? ' selected' : '') + '>' + esc(site) + '</option>';
    }).join('');
  }

  function activeForDate(row, visitDate) {
    return !!row && row.status === 'active' && (!row.validFrom || row.validFrom <= visitDate) && (!row.validUntil || row.validUntil >= visitDate);
  }

  async function loadIncoming(id) {
    var body = await api('/' + id);
    var representative = (body.representatives || [])[0] || {};
    return { body: body, visit: body.visit, representative: representative, central: body.central || {} };
  }

  async function openEdit(id) {
    if (busy) return;
    busy = true;
    try {
      var responses = await Promise.all([loadIncoming(id), bootstrap()]);
      var current = responses[0], data = responses[1], visit = current.visit, representative = current.representative, central = current.central;
      var maintenance = (data.maintenanceContractors || []).find(function (row) { return row.name === visit.mainContractor; });
      var maintenanceKey = maintenance ? maintenance.key : '';
      var maintenanceOptions = (data.maintenanceContractors || []).map(function (row) {
        return '<option value="' + esc(row.key) + '"' + (row.key === maintenanceKey ? ' selected' : '') + '>' + esc(row.name) + '</option>';
      }).join('');
      var systemOptions = optionRows((data.systems || []).filter(function (row) { return row.isActive; }), central.system && central.system.id, function (row) { return row.displayName || row.name; });
      var contractorOptions = optionRows((data.contractors || []).filter(function (row) { return row.isActive; }), central.contractor && central.contractor.id, function (row) { return row.displayName || row.name; });
      var html = '<form id="incoming-edit-form" class="form-grid">' +
        '<div class="field full"><label>اسم الزائر</label><input name="repName" value="' + esc(visit.repName) + '" required></div>' +
        '<div class="field"><label>رقم الهوية / الإقامة</label><input name="identityNumber" inputmode="numeric" maxlength="10" pattern="[0-9]{10}" value="' + esc(representative.identityNumber || '') + '" required></div>' +
        '<div class="field"><label>الجوال</label><input name="mobile" inputmode="numeric" value="' + esc(representative.mobile || '') + '" required></div>' +
        '<div class="field"><label>مقاول الصيانة</label><select name="maintenanceContractorKey" required><option value="">اختر</option>' + maintenanceOptions + '</select></div>' +
        '<div class="field"><label>الموقع</label><select name="siteLocation" required>' + siteOptions(data, maintenanceKey, visit.siteLocation) + '</select></div>' +
        '<div class="field"><label>النظام</label><select name="systemId" required>' + systemOptions + '</select></div>' +
        '<div class="field"><label>شركة من الدليل</label><select name="contractorId">' + contractorOptions + '</select></div>' +
        '<div class="field"><label>اسم شركة غير موجودة بالدليل</label><input name="contractorName" value="' + (central.contractor ? '' : esc(visit.subContractor)) + '"></div>' +
        '<div class="field"><label>تاريخ الزيارة</label><input type="date" name="visitDate" value="' + esc(String(visit.visitDate || '').slice(0, 10)) + '" required></div>' +
        '<div class="field full"><div class="note">حفظ التعديل لا يعتمد الطلب، وأي ربط قديم يُلغى حتى تُنفذ «ربط البيانات» من جديد.</div></div></form>';
      showModal('تعديل طلب الزيارة الوارد', html, [{ label: 'حفظ التعديل', className: 'btn-green', action: async function (button) {
        var form = document.getElementById('incoming-edit-form');
        if (!form.reportValidity()) return;
        var contractorId = Number(form.elements.contractorId.value || 0);
        var contractorName = contractorId ? '' : form.elements.contractorName.value.trim();
        if (!contractorId && contractorName.length < 2) { toast('اختر شركة من الدليل أو اكتب اسم الشركة', false); return; }
        button.disabled = true;
        try {
          var result = await api('/management/incoming-visits/' + id + '/edit', {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              repName: form.elements.repName.value.trim(), identityNumber: form.elements.identityNumber.value.trim(),
              mobile: form.elements.mobile.value.trim(), maintenanceContractorKey: form.elements.maintenanceContractorKey.value,
              siteLocation: form.elements.siteLocation.value, systemId: Number(form.elements.systemId.value || 0),
              contractorId: contractorId || null, contractorName: contractorName, visitDate: form.elements.visitDate.value
            })
          });
          if (!result || result.saved !== true || Number(result.visitId) !== Number(id) || result.status !== 'pending') throw new Error('لم يرجع الخادم تأكيدًا صحيحًا لحفظ التعديل');
          closeModal(); toast('تم تعديل طلب الزيارة دون ربط أو اعتماد', true); refreshIncoming();
        } catch (error) { button.disabled = false; toast(error.message, false); }
      } }]);
      var form = document.getElementById('incoming-edit-form');
      form.elements.maintenanceContractorKey.addEventListener('change', function () { form.elements.siteLocation.innerHTML = siteOptions(data, this.value, ''); });
      form.elements.contractorId.addEventListener('change', function () {
        form.elements.contractorName.disabled = !!this.value;
        if (this.value) form.elements.contractorName.value = '';
      });
      form.elements.contractorName.disabled = !!form.elements.contractorId.value;
    } catch (error) { toast(error.message, false); }
    finally { busy = false; }
  }

  async function resolveLinks(id) {
    var responses = await Promise.all([loadIncoming(id), bootstrap()]);
    var current = responses[0], data = responses[1], visit = current.visit, representative = current.representative, central = current.central;
    var system = (data.systems || []).find(function (row) {
      return row.isActive && ((central.system && row.id === central.system.id) || normalize(row.displayName || row.name) === normalize(visit.systemName));
    });
    if (!system) throw new Error('تعذر مطابقة النظام مع دليل الأنظمة');
    var contractor = (data.contractors || []).find(function (row) {
      return row.isActive && ((central.contractor && row.id === central.contractor.id) || normalize(row.displayName || row.name) === normalize(visit.subContractor));
    });
    if (!contractor) throw new Error('تعذر مطابقة شركة مقاول الباطن مع دليل الشركات');
    var rep = (data.representatives || []).find(function (row) {
      return row.isActive && row.contractorId === contractor.id && String(row.identityNumber || '') === String(representative.identityNumber || '');
    });
    if (!rep) throw new Error('المندوب غير موجود في الدليل بنفس الهوية والشركة؛ يمكنك اعتماد الطلب بدون ربط');
    var repSystem = (data.representativeSystems || []).some(function (row) { return row.isActive && row.representativeId === rep.id && row.systemId === system.id; });
    if (!repSystem) throw new Error('المندوب موجود لكنه غير مربوط بالنظام؛ يمكنك اعتماد الطلب بدون ربط');
    var visitDate = String(visit.visitDate || '').slice(0, 10);
    var siteApproval = (data.siteApprovals || []).find(function (row) { return row.siteName === visit.siteLocation && row.systemId === system.id && row.contractorId === contractor.id && activeForDate(row, visitDate); });
    if (!siteApproval) throw new Error('لا يوجد اعتماد موقع ساري مطابق للتاريخ؛ يمكنك اعتماد الطلب بدون ربط');
    var qualification = (data.qualifications || []).find(function (row) { return row.systemId === system.id && row.contractorId === contractor.id && activeForDate(row, visitDate); });
    if (!qualification) throw new Error('لا يوجد تأهيل شركة ساري مطابق للتاريخ؛ يمكنك اعتماد الطلب بدون ربط');
    return { system: system, contractor: contractor, representative: rep, siteApproval: siteApproval, qualification: qualification, visitDate: visitDate };
  }

  function openLink(id) {
    showModal('ربط بيانات طلب الزيارة', '<div class="note"><strong>الربط إجراء مستقل.</strong><br>سيطابق النظام والشركة والمندوب واعتماد الموقع والتأهيل تلقائيًا. لن يعتمد الزيارة أو يصدر رقم تصريح.</div>', [{ label: 'تنفيذ الربط التلقائي', className: 'btn-primary', action: async function (button) {
      button.disabled = true;
      try {
        var links = await resolveLinks(id);
        var result = await api('/' + id + '/link', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemId: links.system.id, contractorId: links.contractor.id, representativeId: links.representative.id,
            siteApprovalId: links.siteApproval.id, qualificationId: links.qualification.id,
            startsAt: links.visitDate + 'T00:00:00.000Z', endsAt: null
          })
        });
        if (!result || result.validForApproval !== true || !result.visit || result.visit.status !== 'pending') throw new Error('لم يرجع الخادم تأكيدًا صحيحًا لحفظ الربط');
        closeModal(); toast('تم ربط بيانات الطلب فقط دون اعتماده', true); refreshIncoming();
      } catch (error) { button.disabled = false; toast(error.message, false); }
    } }]);
  }

  function openApprove(id) {
    showModal('اعتماد طلب الزيارة', '<div class="note" style="background:#f0fdf4;color:#166534;border-color:#bbf7d0"><strong>الاعتماد مستقل عن الربط.</strong><br>سيصدر رقم تصريح وQR من بيانات الطلب الحالية، حتى لو لم يتم الربط.</div>', [{ label: 'اعتماد وإصدار التصريح', className: 'btn-green', action: async function (button) {
      button.disabled = true;
      try {
        var result = await api('/management/incoming-visits/' + id + '/approve', { method: 'PATCH' });
        if (!result || result.approved !== true || !result.visit || !result.visit.id || result.visit.status !== 'approved' || !result.visit.serialNumber) throw new Error('لم يرجع الخادم تأكيدًا صحيحًا لاعتماد الزيارة');
        closeModal(); toast('تم اعتماد الزيارة وإصدار التصريح رقم ' + result.visit.serialNumber, true); refreshIncoming();
      } catch (error) { button.disabled = false; toast(error.message, false); }
    } }]);
  }

  function enhanceIncomingRows() {
    var body = document.getElementById('incoming-body');
    if (!body) return;
    body.querySelectorAll('button[data-link]').forEach(function (oldButton) {
      var id = Number(oldButton.dataset.link || 0), actions = oldButton.closest('.actions');
      if (!id || !actions || actions.dataset.incomingWorkflowReady === 'true') return;
      actions.dataset.incomingWorkflowReady = 'true';
      oldButton.removeAttribute('data-link'); oldButton.dataset.incomingLink = String(id);
      oldButton.className = 'btn btn-primary'; oldButton.textContent = 'ربط البيانات';
      var edit = document.createElement('button');
      edit.type = 'button'; edit.className = 'btn btn-amber'; edit.dataset.incomingEdit = String(id); edit.textContent = 'تعديل';
      actions.insertBefore(edit, oldButton);
      var approve = document.createElement('button');
      approve.type = 'button'; approve.className = 'btn btn-green'; approve.dataset.incomingApprove = String(id); approve.textContent = 'اعتماد';
      actions.insertBefore(approve, oldButton.nextSibling);
    });
  }

  document.addEventListener('click', function (event) {
    var target = event.target.closest('[data-incoming-edit],[data-incoming-link],[data-incoming-approve]');
    if (!target) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (target.dataset.incomingEdit) openEdit(Number(target.dataset.incomingEdit));
    else if (target.dataset.incomingLink) openLink(Number(target.dataset.incomingLink));
    else if (target.dataset.incomingApprove) openApprove(Number(target.dataset.incomingApprove));
  }, true);

  var incomingBody = document.getElementById('incoming-body');
  if (incomingBody) new MutationObserver(enhanceIncomingRows).observe(incomingBody, { childList: true, subtree: true });
  enhanceIncomingRows();
  console.log('[NajranVisits] incoming edit/link/approve workflow loaded');
})();
