(function () {
  'use strict';

  var state = { data: null, settings: null, archivePage: 1, archivePages: 1, stream: null, scanLoop: 0, scanning: false, barcodeDetector: null, qrDeepLinkHandled: false, pendingRepresentativeContractor: null, documentPreviewUrl: null, kioskQr: null };
  var UI_STATE_KEY = 'najran_visit_center_ui_state_v1';
  var SESSION_KEEPALIVE_MS = 45 * 1000;
  var sessionRefreshPromise = null;
  var DEFAULT_VISIT_PRINT_TEXTS = {
    organizationText: 'تجمع نجران الصحي — وحدة الصيانة العامة',
    permitTitle: 'إعتماد موافقة زيارة مقاولي الباطن',
    verificationText: 'تم التحقق من بيانات الهوية/الإقامة إلكترونيًا',
    approvalText: 'توافق وحدة الصيانة العامة بتجمع نجران الصحي بقيام مندوب مقاول الباطن الموضح اسمه وبياناته بعالية لزيارة الموقع لتنفيذ أعمال الصيانة الوقائية للنظام حسب شروط ومواصفات العقد.',
    closingText: 'وعلي ذلك جري التوقيع ،،،',
    qrLabel: 'تحقق عام من التصريح',
    footerNote: 'يرجى إبراز بطاقة تأهيل الفريق الفني ونموذج اعتماد موافقة زيارة مقاولي الباطن للمسؤول بالمنشأة.'
  };

  function esc(value) { return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function formObject(form) { var out = {}; new FormData(form).forEach(function (value, key) { out[key] = typeof value === 'string' ? value.trim() : value; }); return out; }
  function dateText(value, time) { if (!value) return '—'; try { return new Date(value).toLocaleString('ar-SA', time ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }); } catch (_) { return String(value); } }
  function entityName(row) { return row ? (row.displayName || row.name || '') : ''; }
  function localDateValue(value) { if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10); var date = value ? new Date(value) : new Date(); if (Number.isNaN(date.getTime())) return ''; date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 10); }
  function dateOnlyIso(value, endOfDay) { if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null; return value + (endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z'); }
  function dateOnlyText(value) { return value ? dateText(localDateValue(value) + 'T12:00:00.000Z') : '—'; }
  function statusLabel(status) { return ({ active: 'سارية', expired: 'منتهية', cancelled: 'ملغاة', rejected: 'مرفوضة', pending: 'بانتظار الاعتماد', approved: 'معتمدة' })[status] || status || '—'; }
  function badge(status) { return '<span class="badge badge-' + esc(status) + '">' + esc(statusLabel(status)) + '</span>'; }
  function facilityApprovalBadge(approval) { var status = approval && approval.status || 'pending', label = ({ pending: 'بانتظار المنشأة', approved: 'اعتمدتها المنشأة', rejected: 'رفضتها المنشأة' })[status] || 'بانتظار المنشأة'; return '<span class="badge badge-' + esc(status) + '">' + esc(label) + '</span>'; }
  function optionRows(rows, label, selected) { return '<option value="">اختر</option>' + (rows || []).map(function (row) { return '<option value="' + row.id + '"' + (String(row.id) === String(selected || '') ? ' selected' : '') + '>' + esc(label(row)) + '</option>'; }).join(''); }

  function savedUiState() {
    try {
      var value = JSON.parse(sessionStorage.getItem(UI_STATE_KEY) || 'null');
      return value && Date.now() - Number(value.savedAt || 0) < 12 * 60 * 60 * 1000 ? value : null;
    } catch (_) { return null; }
  }

  function saveUiState() {
    try {
      var activeTab = document.querySelector('.tab.active'), form = document.getElementById('direct-form');
      sessionStorage.setItem(UI_STATE_KEY, JSON.stringify({
        savedAt: Date.now(),
        tab: activeTab ? activeTab.dataset.tab : 'summary',
        direct: form ? directSelection() : null,
      }));
    } catch (_) {}
  }

  function activateTab(tabName, loadData) {
    var button = document.querySelector('[data-tab="' + tabName + '"]');
    if (!button) return;
    document.querySelectorAll('.tab').forEach(function (node) { node.classList.toggle('active', node === button); });
    document.querySelectorAll('.panel').forEach(function (node) { node.classList.toggle('active', node.dataset.panel === tabName); });
    if (tabName === 'archive' && loadData !== false) loadArchive(1);
    if (tabName !== 'scan') stopCamera();
  }

  function clearCachedToken() {
    try {
      var session = JSON.parse(localStorage.getItem('najran_session') || '{}');
      delete session.clerkToken; delete session.timestamp;
      localStorage.setItem('najran_session', JSON.stringify(session));
    } catch (_) {}
  }

  function cacheSessionToken(token) {
    if (typeof token !== 'string' || !token.trim()) return;
    try {
      var session = JSON.parse(localStorage.getItem('najran_session') || '{}');
      session.clerkToken = token.trim(); session.timestamp = Date.now();
      localStorage.setItem('najran_session', JSON.stringify(session));
    } catch (_) {}
  }

  function tokenIsUsable(token, minimumLifetimeMs) {
    if (typeof token !== 'string' || !token.trim()) return false;
    try {
      var parts = token.split('.');
      if (parts.length < 2) return true;
      var encoded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (encoded.length % 4) encoded += '=';
      var payload = JSON.parse(atob(encoded));
      return !payload.exp || Number(payload.exp) * 1000 - Date.now() > Number(minimumLifetimeMs || 0);
    } catch (_) { return true; }
  }

  function tokenGetters() {
    var result = [], seen = [];
    function add(scope) { try { var fn = scope && scope.najranGetFreshToken; if (typeof fn === 'function' && seen.indexOf(fn) === -1) { seen.push(fn); result.push({ scope: scope, fn: fn }); } } catch (_) {} }
    add(window.parent && window.parent !== window ? window.parent : null);
    add(window.top && window.top !== window ? window.top : null);
    add(window);
    return result;
  }

  async function callTokenGetter(getter, force) {
    var timeout = new Promise(function (_, reject) { setTimeout(function () { reject(new Error('TOKEN_TIMEOUT')); }, 8000); });
    var call = Promise.resolve().then(function () { return getter.fn.call(getter.scope, force ? { skipCache: true } : undefined); });
    return Promise.race([call, timeout]);
  }

  function requestParentToken(force) {
    return new Promise(function (resolve) {
      if (!window.parent || window.parent === window) return resolve(null);
      var requestId = 'visit-' + Date.now() + '-' + Math.random().toString(36).slice(2), settled = false;
      function finish(token) { if (settled) return; settled = true; clearTimeout(timer); window.removeEventListener('message', receive); resolve(typeof token === 'string' && token.trim() ? token.trim() : null); }
      function receive(event) { if (event.origin !== location.origin || event.source !== window.parent || !event.data || event.data.type !== 'NAJRAN_TOKEN_RESPONSE' || event.data.requestId !== requestId) return; finish(event.data.token); }
      var timer = setTimeout(function () { finish(null); }, 10000);
      window.addEventListener('message', receive);
      try { window.parent.postMessage({ type: 'NAJRAN_TOKEN_REQUEST', requestId: requestId, skipCache: !!force }, location.origin); }
      catch (_) { finish(null); }
    });
  }

  async function freshToken(force) {
    var getters = tokenGetters();
    for (var i = 0; i < getters.length; i++) {
      try {
        var value = await callTokenGetter(getters[i], !!force);
        if (tokenIsUsable(value, force ? 15000 : 2000)) { cacheSessionToken(value); return value.trim(); }
      } catch (_) {}
    }
    var bridged = await requestParentToken(!!force);
    if (tokenIsUsable(bridged, force ? 15000 : 2000)) { cacheSessionToken(bridged); return bridged.trim(); }
    if (!force) try { var session = JSON.parse(localStorage.getItem('najran_session') || '{}'); if (session.clerkToken && Date.now() - Number(session.timestamp || 0) < 55000 && tokenIsUsable(session.clerkToken, 2000)) return session.clerkToken; } catch (_) {}
    var error = new Error('انتهت جلسة الدخول؛ اضغط «تجديد الجلسة» ثم أعد المحاولة'); error.status = 401; error.code = 'AUTH_REFRESH_REQUIRED'; throw error;
  }

  async function refreshSessionToken() {
    if (sessionRefreshPromise) return sessionRefreshPromise;
    sessionRefreshPromise = freshToken(true);
    try { return await sessionRefreshPromise; }
    finally { sessionRefreshPromise = null; }
  }

  async function keepSessionAlive() {
    if (document.hidden) return false;
    try { await refreshSessionToken(); return true; }
    catch (_) { return false; }
  }

  async function api(path, options, retried) {
    options = options || {};
    var token = retried ? await refreshSessionToken() : await freshToken(false);
    var headers = Object.assign({ Authorization: 'Bearer ' + token }, options.headers || {});
    var response = await fetch('/api/visits' + path, Object.assign({}, options, { headers: headers, credentials: 'same-origin', cache: 'no-store' }));
    var body = await response.json().catch(function () { return {}; });
    if (response.status === 401) {
      saveUiState();
      clearCachedToken();
      if (!retried) return api(path, options, true);
      var sessionError = new Error('انتهت صلاحية جلسة الدخول؛ اضغط «تجديد الجلسة» ثم أعد المحاولة'); sessionError.status = 401; sessionError.code = body.code || 'AUTH_TOKEN_INVALID'; throw sessionError;
    }
    if (!response.ok) { var error = new Error(body.error || 'فشلت العملية'); error.status = response.status; error.code = body.code; throw error; }
    return body;
  }

  async function renewSession() {
    saveUiState();
    clearCachedToken();
    await refreshSessionToken();
    return loadBootstrap({ throwOnError: true });
  }

  function toast(message, ok) {
    var node = document.getElementById('toast'); node.textContent = message; node.className = 'toast show ' + (ok ? 'ok' : 'err');
    clearTimeout(node._timer); node._timer = setTimeout(function () { node.className = 'toast'; }, 5000);
  }

  function releaseDocumentPreview() {
    if (!state.documentPreviewUrl) return;
    URL.revokeObjectURL(state.documentPreviewUrl);
    state.documentPreviewUrl = null;
  }

  function modal(title, html, buttons) {
    releaseDocumentPreview();
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = html;
    var foot = document.getElementById('modal-foot'); foot.innerHTML = '';
    (buttons || []).forEach(function (button) {
      var node = document.createElement('button'); node.type = 'button'; node.className = 'btn ' + (button.className || 'btn-light'); node.textContent = button.label;
      node.addEventListener('click', function () { button.action(node); }); foot.appendChild(node);
    });
    document.getElementById('app-modal').classList.add('open'); document.body.style.overflow = 'hidden';
  }
  function closeModal() { releaseDocumentPreview(); document.getElementById('app-modal').classList.remove('open'); document.body.style.overflow = ''; }
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('app-modal').addEventListener('click', function (event) { if (event.target === this) closeModal(); });

  document.getElementById('tabs').addEventListener('click', function (event) {
    var button = event.target.closest('[data-tab]'); if (!button) return;
    activateTab(button.dataset.tab);
    saveUiState();
  });

  async function loadBootstrap(options) {
    try {
      var responses = await Promise.all([api('/management/bootstrap'), api('/settings')]);
      state.data = responses[0];
      state.settings = responses[1];
      renderAll();
      var saved = savedUiState();
      if (saved?.direct) restoreDirectSelection(saved.direct);
      if (saved?.tab) activateTab(saved.tab);
      if (saved) saveUiState();
      await handleQrDeepLink();
      return true;
    } catch (error) {
      if (options && options.throwOnError) throw error;
      var buttons = error.status === 403 ? [{ label: 'العودة للرئيسية', className: 'btn-light', action: function () { window.top.location.href = '/dashboard'; } }] : [
        { label: 'تجديد الجلسة وإعادة المحاولة', className: 'btn-green', action: async function (button) { button.disabled = true; try { var ok = await renewSession(); if (ok) { closeModal(); toast('تم تجديد الجلسة وتحميل المركز', true); } } catch (refreshError) { button.disabled = false; toast(refreshError.message, false); } } },
        { label: 'العودة للرئيسية', className: 'btn-light', action: function () { window.top.location.href = '/dashboard'; } },
      ];
      modal(error.status === 403 ? 'غير مصرح' : 'تعذر فتح المركز', '<div class="note" style="background:#fef2f2;color:#991b1b;border-color:#fecaca">' + esc(error.message) + '</div>', buttons);
      return false;
    }
  }

  function renderAll() {
    var data = state.data;
    document.getElementById('stat-pending').textContent = data.stats.pending;
    document.getElementById('stat-postponements').textContent = data.stats.pendingPostponements || 0;
    document.getElementById('stat-systems').textContent = data.stats.systems;
    document.getElementById('stat-contractors').textContent = data.stats.contractors;
    document.getElementById('stat-reps').textContent = data.stats.representatives;
    renderAlerts(data.alerts || []);
    renderPending(data.pending || []);
    renderPostponements(data.pendingPostponements || []);
    populateForms();
    renderCatalogLists();
    renderPrintSettings();
  }

  function renderAlerts(alerts) {
    var html = alerts.length ? alerts.map(function (item) { return '<div class="alert-row"><strong>' + esc(item.title) + '</strong><span>' + esc(item.name || item.site || '') + ' — ' + dateText(item.date) + '</span></div>'; }).join('') : '<div class="empty">لا توجد تنبيهات حالية</div>';
    document.getElementById('alerts-list').innerHTML = html;
    document.getElementById('summary-alerts').innerHTML = alerts.length ? alerts.slice(0, 3).map(function (item) { return '<div class="alert-row"><strong>' + esc(item.title) + '</strong><span>' + esc(item.name || item.site || '') + ' — ' + dateText(item.date) + '</span></div>'; }).join('') : html;
  }

  function renderPending(rows) {
    document.getElementById('summary-pending').innerHTML = rows.length ? rows.slice(0, 5).map(function (visit) { return '<div style="padding:8px 0;border-bottom:1px solid #edf1f6"><strong>' + esc(visit.repName) + '</strong><small style="display:block;color:#64748b">' + esc(visit.siteLocation) + ' — ' + dateText(visit.visitDate) + '</small></div>'; }).join('') : '<div class="empty">لا توجد طلبات معلقة</div>';
    document.getElementById('incoming-body').innerHTML = rows.length ? rows.map(function (visit) {
      return '<tr><td><strong>' + esc(visit.repName) + '</strong><br><small>' + esc(visit.repIdMasked) + '</small></td><td>' + esc(visit.siteLocation) + '</td><td>' + esc(visit.systemName) + '</td><td>' + esc(visit.subContractor) + '</td><td>' + dateText(visit.visitDate) + '</td><td>' + badge(visit.status) + '</td><td><div class="actions"><button class="btn btn-green" data-link="' + visit.id + '">ربط واعتماد</button><button class="btn btn-red" data-reject="' + visit.id + '">رفض</button><button class="btn btn-light" data-preview="' + visit.id + '">معاينة</button></div></td></tr>';
    }).join('') : '<tr><td colspan="7" class="empty">لا توجد طلبات واردة</td></tr>';
  }

  function renderPostponements(rows) {
    document.getElementById('postponements-body').innerHTML = rows.length ? rows.map(function (visit) {
      var request = visit.postponement || {};
      var reason = request.reasonLabel || '—';
      if (request.reasonDetails) reason += '<br><small>' + esc(request.reasonDetails) + '</small>';
      return '<tr><td><strong>' + esc(visit.repName) + '</strong><br><small>' + esc(visit.serialNumber || ('VIS-' + visit.id)) + '</small></td><td>' + esc(visit.siteLocation) + '</td><td>' + dateOnlyText(request.previousVisitDate || visit.visitDate) + '</td><td><strong>' + dateOnlyText(request.requestedVisitDate) + '</strong></td><td>' + reason + '</td><td>' + esc(request.requestedByName || 'مستخدم الموقع') + '<br><small>' + esc(request.requestedBySite || '') + '</small></td><td><div class="actions"><button class="btn btn-green" data-postpone-approve="' + visit.id + '">موافقة</button><button class="btn btn-red" data-postpone-reject="' + visit.id + '">رفض</button><button class="btn btn-light" data-visit-detail="' + visit.id + '">فتح الزيارة</button></div></td></tr>';
    }).join('') : '<tr><td colspan="7" class="empty">لا توجد طلبات تأجيل معلقة</td></tr>';
  }

  function uniqueNamedRows(rows) {
    var seen = Object.create(null);
    return (rows || []).filter(function (row) { var key = String(entityName(row)).trim().replace(/\s+/g, ' '); if (!key || seen[key]) return false; seen[key] = true; return true; });
  }

  function allMaintenanceSites() {
    var seen = Object.create(null), sites = [];
    (state.data.maintenanceContractors || []).forEach(function (company) { (company.sites || []).forEach(function (site) { if (site && !seen[site]) { seen[site] = true; sites.push(site); } }); });
    return sites;
  }

  function siteOptions(sites, current) {
    return '<option value="">اختر الموقع</option>' + (sites || []).map(function (site) { return '<option value="' + esc(site) + '"' + (site === current ? ' selected' : '') + '>' + esc(site) + '</option>'; }).join('');
  }

  function refreshDirectSites() {
    var form = document.getElementById('direct-form'), key = form.elements.maintenanceContractorKey.value, current = form.elements.siteName.value;
    var company = (state.data.maintenanceContractors || []).find(function (row) { return row.key === key; });
    form.elements.siteName.innerHTML = siteOptions(company ? company.sites : [], current);
    renderDirectReadiness();
  }

  function refreshKioskSites() {
  var form = document.getElementById('kiosk-form');
  if (!form || !state.data) return;

  var maintenanceSelect = form.elements.maintenanceContractorKey;
  var siteSelect = form.elements.siteName;

  // نموذج الباركود العام الجديد لا يحتوي على حقول الموقع والمقاول.
  if (!maintenanceSelect || !siteSelect) return;

  var key = maintenanceSelect.value;
  var current = siteSelect.value;
  var company = (state.data.maintenanceContractors || []).find(function (row) {
    return row.key === key;
  });

  siteSelect.innerHTML = siteOptions(company ? company.sites : [], current);
}

  function refreshDirectContractors() {
    var form = document.getElementById('direct-form'), systemId = Number(form.elements.systemId.value || 0), current = Number(form.elements.contractorId.value || 0), allowed = Object.create(null);
    if (!systemId) {
      form.elements.contractorId.innerHTML = '<option value="">اختر النظام أولًا</option>';
      refreshDirectRepresentatives();
      return;
    }
    var selectedSystem = (state.data.systems || []).find(function (row) { return row.id === systemId; });
    var catalog = (state.data.approvedSubcontractors || []).find(function (row) { return row.systemId === systemId || (selectedSystem && row.systemName === entityName(selectedSystem)); });
    if (catalog) (catalog.contractors || []).forEach(function (row) { allowed[row.id] = true; });
    (state.data.qualifications || []).forEach(function (row) { if (row.status === 'active' && row.systemId === systemId) allowed[row.contractorId] = true; });
    (state.data.siteApprovals || []).forEach(function (row) { if (row.status === 'active' && row.systemId === systemId) allowed[row.contractorId] = true; });
    (state.data.representativeSystems || []).forEach(function (link) {
      if (!link.isActive || link.systemId !== systemId) return;
      var representative = (state.data.representatives || []).find(function (row) { return row.id === link.representativeId && row.isActive; });
      if (representative) allowed[representative.contractorId] = true;
    });
    var hasLinkedContractors = Object.keys(allowed).length > 0;
    var rows = uniqueNamedRows((state.data.contractors || []).filter(function (row) { return row.isActive && (!hasLinkedContractors || !!allowed[row.id]); })).sort(function (a, b) { return entityName(a).localeCompare(entityName(b), 'ar'); });
    form.elements.contractorId.innerHTML = optionRows(rows, function (row) { return entityName(row) + (hasLinkedContractors ? '' : ' — متاحة للاستكمال'); }, current);
    refreshDirectRepresentatives();
  }

  function refreshSavedRepresentativeOptions(query, selectedId) {
    var select = document.getElementById('direct-saved-representative');
    var needle = String(query || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ar');
    var rows = (state.data.representatives || []).filter(function (row) {
      if (!row.isActive) return false;
      var contractor = state.data.contractors.find(function (item) { return item.id === row.contractorId; });
      var searchable = [row.fullName, entityName(contractor), representativeIdentity(row), representativeMobile(row)].join(' ').toLocaleLowerCase('ar');
      return !needle || searchable.indexOf(needle) !== -1;
    }).sort(function (a, b) { return a.fullName.localeCompare(b.fullName, 'ar'); });
    select.innerHTML = '<option value="">' + (needle ? 'اختر من نتائج البحث' : 'اختر اسم المندوب') + '</option>' + rows.map(function (row) {
      var contractor = state.data.contractors.find(function (item) { return item.id === row.contractorId; });
      return '<option value="' + row.id + '"' + (String(row.id) === String(selectedId || '') ? ' selected' : '') + '>' + esc(row.fullName + ' — ' + entityName(contractor) + ' — ' + representativeIdentity(row)) + '</option>';
    }).join('');
  }

  function populateForms() {
    var d = state.data;
    var systems = uniqueNamedRows(d.systems.filter(function (x) { return x.isActive; })), contractors = uniqueNamedRows(d.contractors.filter(function (x) { return x.isActive; }));
    document.querySelectorAll('select[name="systemId"]').forEach(function (select) { var current = select.value; select.innerHTML = optionRows(systems, entityName, current); });
    document.querySelectorAll('select[name="contractorId"]').forEach(function (select) { var current = select.value; select.innerHTML = optionRows(contractors, entityName, current); });
    var repSystemOptions = document.getElementById('rep-system-options');
    if (repSystemOptions) repSystemOptions.innerHTML = systems.map(function (system) { return '<label class="check-chip"><input type="checkbox" name="repSystemIds" value="' + system.id + '"> ' + esc(entityName(system)) + '</label>'; }).join('');
    var maintenanceSelect = document.querySelector('#direct-form [name="maintenanceContractorKey"]'), maintenanceCurrent = maintenanceSelect.value;
    maintenanceSelect.innerHTML = '<option value="">اختر مقاول الصيانة</option>' + (d.maintenanceContractors || []).map(function (row) { return '<option value="' + esc(row.key) + '"' + (row.key === maintenanceCurrent ? ' selected' : '') + '>' + esc(row.name) + '</option>'; }).join('');
    var kioskMaintenance = document.querySelector('#kiosk-form [name="maintenanceContractorKey"]');
if (kioskMaintenance) {
  var kioskCurrent = kioskMaintenance.value;
  kioskMaintenance.innerHTML =
    '<option value="">اختر مقاول الصيانة</option>' +
    (d.maintenanceContractors || []).map(function (row) {
      return '<option value="' + esc(row.key) + '"' +
        (row.key === kioskCurrent ? ' selected' : '') +
        '>' + esc(row.name) + '</option>';
    }).join('');
}
    var savedRepresentativeSelect = document.getElementById('direct-saved-representative'), savedRepresentativeCurrent = savedRepresentativeSelect.value;
    refreshSavedRepresentativeOptions(document.getElementById('direct-representative-search').value, savedRepresentativeCurrent);
    var allSites = allMaintenanceSites(), approvalSite = document.getElementById('approval-site'), targetSite = document.querySelector('#copy-form [name="targetSite"]');
    approvalSite.innerHTML = siteOptions(allSites, approvalSite.value);
    targetSite.innerHTML = siteOptions(allSites, targetSite.value);
    var approvedSites = Array.from(new Set(d.siteApprovals.map(function (x) { return x.siteName; }))).filter(Boolean), sourceSite = document.querySelector('#copy-form [name="sourceSite"]');
    sourceSite.innerHTML = siteOptions(approvedSites, sourceSite.value);
    refreshDirectSites();
    refreshKioskSites();
    refreshDirectContractors();
    var startInput = document.querySelector('#direct-form [name="startsAt"]');
    if (!startInput.value) startInput.value = localDateValue();
    renderDirectRepresentativeSummary(Number(savedRepresentativeSelect.value || 0));
    renderDirectReadiness();
  }

  function renderAssetPreview(id, value, emptyText) {
    var node = document.getElementById(id);
    node.innerHTML = value ? '<img src="' + esc(value) + '" alt="' + esc(emptyText) + '">' : esc(emptyText);
  }

  function renderPrintSettings() {
    var settings = state.settings || {}, form = document.getElementById('print-form');
    form.elements.signerTitle.value = settings.signerTitle || 'مدير وحدة الصيانة العامة بتجمع نجران الصحي';
    form.elements.signerName.value = settings.signerName || settings.managerName || 'م. محمد عباس المكرمي';
    Object.keys(DEFAULT_VISIT_PRINT_TEXTS).forEach(function (field) {
      if (form.elements[field]) form.elements[field].value = settings[field] || DEFAULT_VISIT_PRINT_TEXTS[field];
    });
    renderAssetPreview('stamp-preview', settings.stamp || '/original/visit-default-stamp.png', 'الختم الإلكتروني الافتراضي');
    renderAssetPreview('signature-preview', settings.signature || '/original/visit-default-signature.png', 'التوقيع الإلكتروني الافتراضي');
  }

  function documentTypeLabel(type) {
    return ({ iqama_front: 'الهوية / الإقامة — الوجه الأمامي', iqama_back: 'الهوية / الإقامة — الوجه الخلفي', iqama_pdf: 'الهوية / الإقامة — ملف PDF', identity: 'الهوية / الإقامة', residence: 'إثبات الإقامة', qualification: 'مستند التأهيل', other: 'مستند آخر', facility_approval_proof: 'إثبات اعتماد المنشأة' })[type] || type;
  }

  function documentSizeText(bytes) {
    var value = Number(bytes || 0);
    return value >= 1024 * 1024 ? (value / (1024 * 1024)).toFixed(1) + ' م.ب' : Math.max(1, Math.round(value / 1024)) + ' ك.ب';
  }

  function representativeInitial(name) {
    var value = String(name || '').trim();
    return value ? value.charAt(0) : 'م';
  }

  function representativeIdentity(representative) {
    return representative && (representative.identityNumber || representative.identityMasked) || '—';
  }

  function representativeMobile(representative) {
    return representative && (representative.mobile || representative.mobileMasked) || '—';
  }

  function renderRepresentativesList() {
    var d = state.data;
    if (!d) return;
    var searchInput = document.getElementById('rep-list-search');
    var needle = String(searchInput ? searchInput.value : '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ar');
    var rows = d.representatives.filter(function (rep) { return rep.isActive; }).map(function (rep) {
      var contractor = d.contractors.find(function (item) { return item.id === rep.contractorId; });
      var systems = d.representativeSystems.filter(function (link) { return link.representativeId === rep.id && link.isActive; }).map(function (link) { return d.systems.find(function (item) { return item.id === link.systemId; }); }).filter(Boolean);
      var documents = (d.representativeDocuments || []).filter(function (document) { return document.ownerId === rep.id; });
      return { rep: rep, contractor: contractor, systems: systems, documents: documents };
    }).filter(function (row) {
      if (!needle) return true;
      var searchable = [row.rep.fullName, representativeIdentity(row.rep), representativeMobile(row.rep), entityName(row.contractor)]
        .concat(row.systems.map(entityName)).join(' ').toLocaleLowerCase('ar');
      return searchable.indexOf(needle) !== -1;
    });
    var count = document.getElementById('reps-list-count');
    if (count) count.textContent = rows.length + (rows.length === 1 ? ' مندوب' : ' مندوبين');
    document.getElementById('reps-list').innerHTML = rows.length ? rows.map(function (row) {
      var rep = row.rep;
      var documentsHtml = row.documents.length ? '<div class="document-list">' + row.documents.map(function (document) {
        return '<div class="document-row"><div class="document-copy"><i class="fas fa-id-card" aria-hidden="true"></i><span><strong>' + esc(documentTypeLabel(document.documentType)) + '</strong><small>' + esc(document.originalName) + ' — ' + esc(documentSizeText(document.sizeBytes)) + '</small></span></div><div class="document-actions"><button type="button" class="btn btn-primary" data-preview-doc="' + document.id + '" data-name="' + esc(document.originalName) + '" data-mime="' + esc(document.mimeType) + '"><i class="fas fa-eye" aria-hidden="true"></i> معاينة</button><button type="button" class="btn btn-light" data-download-doc="' + document.id + '" data-name="' + esc(document.originalName) + '"><i class="fas fa-download" aria-hidden="true"></i> تنزيل</button></div></div>';
      }).join('') + '</div>' : '<div class="note representative-empty-document"><i class="fas fa-circle-exclamation" aria-hidden="true"></i> لم تُرفع هوية أو إقامة لهذا المندوب بعد.</div>';
      var systemsHtml = row.systems.length ? row.systems.map(function (system) { return '<span class="check-chip"><i class="fas fa-link" aria-hidden="true"></i> ' + esc(entityName(system)) + '</span>'; }).join('') : '<span class="check-chip">غير مرتبط بنظام</span>';
      return '<article class="representative-card"><div class="representative-head"><div class="representative-avatar" aria-hidden="true">' + esc(representativeInitial(rep.fullName)) + '</div><div class="representative-identity"><div class="representative-name-line"><strong class="representative-name">' + esc(rep.fullName) + '</strong>' + badge('active') + '</div><div class="representative-meta"><span><i class="fas fa-building" aria-hidden="true"></i>' + esc(entityName(row.contractor) || 'شركة غير محددة') + '</span><span title="رقم الهوية أو الإقامة كامل داخل مركز الإدارة"><i class="fas fa-id-card" aria-hidden="true"></i>' + esc(representativeIdentity(rep)) + '</span><span title="رقم الجوال كامل داخل مركز الإدارة"><i class="fas fa-mobile-screen" aria-hidden="true"></i>' + esc(representativeMobile(rep)) + '</span></div></div></div><div class="representative-systems">' + systemsHtml + '</div>' + documentsHtml + '<div class="representative-actions"><button type="button" class="btn btn-light" data-rep-systems="' + rep.id + '"><i class="fas fa-link" aria-hidden="true"></i> ربط الأنظمة</button><button type="button" class="btn btn-green" data-upload-doc="representative:' + rep.id + '"><i class="fas fa-cloud-arrow-up" aria-hidden="true"></i> ' + (row.documents.length ? 'رفع بديل للهوية' : 'رفع الهوية') + '</button><button type="button" class="btn btn-red" data-toggle-rep="' + rep.id + '" data-active="true"><i class="fas fa-user-slash" aria-hidden="true"></i> تعطيل</button><button type="button" class="btn btn-light" data-delete-rep="' + rep.id + '"><i class="fas fa-trash" aria-hidden="true"></i> حذف</button></div></article>';
    }).join('') : '<div class="empty">' + (needle ? 'لا توجد نتائج مطابقة للبحث' : 'لا يوجد مندوبون نشطون') + '</div>';
  }

  function renderCatalogLists() {
    var d = state.data;
    document.getElementById('systems-list').innerHTML = d.systems.map(function (x) { return '<div class="alert-row catalog-row"><div class="catalog-copy"><strong class="catalog-title">' + esc(entityName(x)) + '</strong><div class="catalog-meta">' + (x.code ? '<div class="catalog-meta-item"><b>الكود:</b><span>' + esc(x.code) + '</span></div>' : '') + (x.description ? '<div class="catalog-meta-item"><b>الوصف:</b><span>' + esc(x.description) + '</span></div>' : '') + '</div></div><div class="actions catalog-actions"><button class="btn btn-light" data-edit-system="' + x.id + '">تعديل</button><button class="btn ' + (x.isActive ? 'btn-red' : 'btn-green') + '" data-toggle-system="' + x.id + '" data-active="' + x.isActive + '">' + (x.isActive ? 'تعطيل' : 'استعادة') + '</button><button class="btn btn-light" data-delete-system="' + x.id + '">حذف</button></div></div>'; }).join('');
    document.getElementById('contractors-list').innerHTML = d.contractors.map(function (x) { return '<div class="alert-row catalog-row"><div class="catalog-copy"><strong class="catalog-title">' + esc(entityName(x)) + '</strong></div><div class="actions catalog-actions"><button class="btn btn-light" data-edit-contractor="' + x.id + '">تعديل</button><button class="btn ' + (x.isActive ? 'btn-red' : 'btn-green') + '" data-toggle-contractor="' + x.id + '" data-active="' + x.isActive + '">' + (x.isActive ? 'تعطيل' : 'تفعيل') + '</button><button class="btn btn-light" data-delete-contractor="' + x.id + '">حذف</button></div></div>'; }).join('');
    document.getElementById('site-approvals-list').innerHTML = d.siteApprovals.length ? d.siteApprovals.map(function (approval) {
      var system = d.systems.find(function (x) { return x.id === approval.systemId; }), contractor = d.contractors.find(function (x) { return x.id === approval.contractorId; }), active = approval.status === 'active';
      return '<div class="alert-row catalog-row"><div class="catalog-copy"><strong class="catalog-title">' + esc(approval.siteName) + '</strong><div class="catalog-meta"><div class="catalog-meta-item"><b>النظام:</b><span>' + esc(entityName(system)) + '</span></div><div class="catalog-meta-item"><b>الشركة:</b><span>' + esc(entityName(contractor)) + '</span></div><div class="catalog-meta-item"><b>مدة الاعتماد:</b><span>من ' + esc(approval.validFrom) + ' حتى ' + esc(approval.validUntil) + '</span></div></div></div><div class="actions catalog-actions"><button class="btn btn-light" data-edit-approval="' + approval.id + '">تعديل</button><button class="btn ' + (active ? 'btn-red' : 'btn-green') + '" data-toggle-approval="' + approval.id + '" data-active="' + active + '">' + (active ? 'تعطيل' : 'تفعيل') + '</button><button class="btn btn-light" data-delete-approval="' + approval.id + '">حذف</button></div></div>';
    }).join('') : '<div class="empty">لا توجد اعتمادات مواقع</div>';
    document.getElementById('qualifications-list').innerHTML = d.qualifications.length ? d.qualifications.map(function (qualification) {
      var system = d.systems.find(function (x) { return x.id === qualification.systemId; }), contractor = d.contractors.find(function (x) { return x.id === qualification.contractorId; }), active = qualification.status === 'active';
      return '<div class="alert-row catalog-row"><div class="catalog-copy"><strong class="catalog-title">' + esc(entityName(contractor)) + '</strong><div class="catalog-meta"><div class="catalog-meta-item"><b>النظام:</b><span>' + esc(entityName(system)) + '</span></div><div class="catalog-meta-item"><b>مدة التأهيل:</b><span>من ' + esc(qualification.validFrom) + ' حتى ' + esc(qualification.validUntil) + '</span></div></div></div><div class="actions catalog-actions"><button class="btn btn-light" data-edit-qualification="' + qualification.id + '">تعديل</button><button class="btn ' + (active ? 'btn-red' : 'btn-green') + '" data-toggle-qualification="' + qualification.id + '" data-active="' + active + '">' + (active ? 'تعطيل' : 'تفعيل') + '</button><button class="btn btn-light" data-delete-qualification="' + qualification.id + '">حذف</button></div></div>';
    }).join('') : '<div class="empty">لا توجد تأهيلات</div>';
    renderRepresentativesList();
  }

  async function refresh() { if (await loadBootstrap()) toast('تم تحديث بيانات المركز', true); }
  document.querySelectorAll('[data-action="refresh"]').forEach(function (button) { button.addEventListener('click', refresh); });
  document.getElementById('renew-session').addEventListener('click', async function () { var button = this; button.disabled = true; try { if (await renewSession()) toast('تم تجديد الجلسة وتحميل أحدث البيانات', true); } catch (error) { toast(error.message, false); } finally { button.disabled = false; } });
  document.querySelector('[data-action="alerts"]').addEventListener('click', async function () { try { var body = await api('/management/alerts'); state.data.alerts = body.alerts; renderAlerts(body.alerts); toast('تم تحديث التنبيهات', true); } catch (e) { toast(e.message, false); } });

  async function submitJson(form, path, success) {
    var button = form.querySelector('button[type="submit"],button:not([type])'); button.disabled = true;
    try { await api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formObject(form)) }); form.reset(); toast(success, true); await loadBootstrap(); }
    catch (error) { toast(error.message, false); } finally { button.disabled = false; }
  }
  document.getElementById('system-form').addEventListener('submit', function (event) { event.preventDefault(); submitJson(this, '/management/systems', 'تم حفظ النظام'); });
  document.getElementById('contractor-form').addEventListener('submit', function (event) { event.preventDefault(); submitJson(this, '/management/contractors', 'تم حفظ الشركة'); });
  document.getElementById('qualification-form').addEventListener('submit', function (event) { event.preventDefault(); submitJson(this, '/management/qualifications', 'تم حفظ التأهيل'); });
  document.getElementById('approval-form').addEventListener('submit', function (event) { event.preventDefault(); submitJson(this, '/management/site-approvals', 'تم حفظ اعتماد الموقع'); });

  document.getElementById('rep-form').addEventListener('submit', async function (event) {
    event.preventDefault(); var form = this, button = form.querySelector('button[type="submit"],button:not([type])'), body = formObject(form); body.noResidenceException = form.elements.noResidenceException.checked;
    body.systemIds = Array.from(document.querySelectorAll('[name="repSystemIds"]:checked')).map(function (node) { return Number(node.value); }).filter(Boolean);
    if (state.pendingRepresentativeContractor) { body.newContractor = state.pendingRepresentativeContractor; delete body.contractorId; }
    if (body.noResidenceException && !body.exceptionReason) { toast('سبب الاستثناء بدون إقامة مطلوب', false); return; }
    if (!body.systemIds.length) { toast('اختر نظامًا واحدًا على الأقل لربط المندوب', false); return; }
    button.disabled = true;
    try { await api('/management/representatives', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); form.reset(); form.elements.contractorId.required = true; state.pendingRepresentativeContractor = null; renderPendingRepresentativeContractor(); toast('تم حفظ الشركة والمندوب وربط الأنظمة بخطوة واحدة', true); await loadBootstrap(); } catch (error) { toast(error.message, false); } finally { button.disabled = false; }
  });
  document.querySelector('#rep-form [name="noResidenceException"]').addEventListener('change', function () { var reason = document.querySelector('#rep-form [name="exceptionReason"]'); reason.required = this.checked; reason.disabled = !this.checked; if (!this.checked) reason.value = ''; });
  document.getElementById('rep-list-search').addEventListener('input', renderRepresentativesList);

  function openStandaloneContractor() {
    var draft = state.pendingRepresentativeContractor || {};
    modal('إضافة شركة مع المندوب', '<form id="standalone-contractor-form" class="form-grid"><div class="field full"><label>الاسم الرسمي الكامل للشركة</label><input name="name" value="' + esc(draft.name || '') + '" required></div><div class="field"><label>رقم السجل (اختياري)</label><input name="registrationNumber" value="' + esc(draft.registrationNumber || '') + '"></div><div class="field"><label>مسؤول التواصل (اختياري)</label><input name="contactName" value="' + esc(draft.contactName || '') + '"></div><div class="field"><label>جوال الشركة (اختياري)</label><input name="contactMobile" inputmode="numeric" placeholder="05xxxxxxxx" value="' + esc(draft.contactMobile || '') + '"></div><div class="field full"><div class="note">لن تُحفظ الشركة الآن؛ سيحفظها النظام مع المندوب وربط الأنظمة عند الضغط على زر الحفظ النهائي.</div></div></form>', [{ label: 'استخدام الشركة في الحفظ النهائي', className: 'btn-green', action: function () {
      var form = document.getElementById('standalone-contractor-form'); if (!form.reportValidity()) return;
      state.pendingRepresentativeContractor = formObject(form); var select = document.querySelector('#rep-form [name="contractorId"]'); select.value = ''; select.required = false; closeModal(); renderPendingRepresentativeContractor(); toast('تم تجهيز الشركة؛ أكمل المندوب والأنظمة ثم احفظ الكل', true);
    } }]);
  }
  function renderPendingRepresentativeContractor() {
    var node = document.getElementById('rep-new-contractor-summary'); if (!node) return;
    if (!state.pendingRepresentativeContractor) { node.hidden = true; node.innerHTML = ''; return; }
    node.hidden = false; node.innerHTML = '<strong>شركة جديدة ضمن الحفظ النهائي:</strong> ' + esc(state.pendingRepresentativeContractor.name) + ' <button type="button" class="btn btn-light" id="rep-cancel-new-contractor">إلغاء</button>';
    document.getElementById('rep-cancel-new-contractor').addEventListener('click', function () { state.pendingRepresentativeContractor = null; document.querySelector('#rep-form [name="contractorId"]').required = true; renderPendingRepresentativeContractor(); });
  }
  document.getElementById('rep-add-contractor').addEventListener('click', openStandaloneContractor);
  document.querySelector('#rep-form [name="contractorId"]').addEventListener('change', function () { if (this.value) { this.required = true; state.pendingRepresentativeContractor = null; renderPendingRepresentativeContractor(); } });

  function legacySystemOptions(suggestedSystemName) {
    var systems = uniqueNamedRows(state.data.systems.filter(function (row) { return row.isActive; }));
    return '<option value="">حدد النظام</option>' + systems.map(function (system) { return '<option value="' + system.id + '"' + (entityName(system) === suggestedSystemName ? ' selected' : '') + '>' + esc(entityName(system)) + '</option>'; }).join('');
  }

  document.getElementById('legacy-representatives-form').addEventListener('submit', async function (event) {
    event.preventDefault();
    var form = this, files = form.elements.files.files;
    if (!files.length) { toast('اختر ملفات Word القديمة', false); return; }
    var button = form.querySelector('button'); button.disabled = true;
    try {
      var data = new FormData(); Array.from(files).forEach(function (file) { data.append('files', file); });
      var preview = await api('/management/legacy-representatives/preview', { method: 'POST', body: data });
      var html = '<div class="note">تمت قراءة ' + preview.rows.length + ' مندوبًا. لا تظهر الهوية أو الجوال كاملين؛ راجع الشركة وحدد النظام لكل صف قبل الحفظ.</div><div style="display:grid;gap:9px;margin-top:12px">' + preview.rows.map(function (row) {
        return '<div class="card"><label class="check-chip"><input type="checkbox" data-legacy-row="' + row.index + '" checked> استيراد</label><strong style="display:block;margin-top:8px">' + esc(row.fullName) + '</strong><small style="display:block;color:#64748b">' + esc(row.companyName) + ' — ' + esc(row.identityMasked) + ' — ' + esc(row.mobileMasked) + '</small><div class="field" style="margin-top:8px"><label>النظام</label><select data-legacy-system="' + row.index + '">' + legacySystemOptions(row.suggestedSystemName) + '</select></div><small style="display:block;color:#94a3b8;margin-top:5px">المصدر: ' + esc(row.sourceFile) + '</small></div>';
      }).join('') + '</div>';
      modal('مراجعة مناديب النظام القديم', html, [{ label: 'حفظ المحدد وربطه بالأنظمة', className: 'btn-green', action: async function (confirmButton) {
        var selected = Array.from(document.querySelectorAll('[data-legacy-row]:checked')).map(function (checkbox) { var index = Number(checkbox.dataset.legacyRow), select = document.querySelector('[data-legacy-system="' + index + '"]'); return { index: index, systemId: Number(select.value || 0) }; });
        if (!selected.length) { toast('حدد مندوبًا واحدًا على الأقل', false); return; }
        if (selected.some(function (row) { return !row.systemId; })) { toast('حدد النظام لكل مندوب مختار', false); return; }
        confirmButton.disabled = true;
        try { var result = await api('/management/legacy-representatives/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ previewToken: preview.previewToken, rows: selected }) }); closeModal(); form.reset(); await loadBootstrap(); toast('تم حفظ ' + result.imported + ' مندوبًا في الدليل وربطهم بالأنظمة', true); }
        catch (error) { toast(error.message, false); confirmButton.disabled = false; }
      } }]);
    } catch (error) { toast(error.message, false); }
    finally { button.disabled = false; }
  });

  document.getElementById('representative-roster-form').addEventListener('submit', async function (event) {
    event.preventDefault();
    var form = this, file = form.elements.file.files[0], button = form.querySelector('button'), previewNode = document.getElementById('representative-roster-preview');
    if (!file) { toast('اختر ملف Excel', false); return; }
    button.disabled = true;
    try {
      var data = new FormData(); data.append('file', file);
      var preview = await api('/management/representative-roster/preview', { method: 'POST', body: data });
      var newCompanies = preview.newCompanies.length ? '<div class="note" style="margin-top:10px;background:#fff7ed;color:#9a3412;border-color:#fed7aa"><strong>شركات ستُنشأ لعدم وجود مطابقة:</strong> ' + preview.newCompanies.map(esc).join('، ') + '</div>' : '<div class="note" style="margin-top:10px">تمت مطابقة كل الشركات الموجودة في الملف مع النظام.</div>';
      previewNode.innerHTML = '<div class="note"><strong>نتيجة المعاينة:</strong> ' + preview.counts.representatives + ' مندوبًا — ' + preview.counts.companies + ' شركة — ' + preview.counts.systems + ' أنظمة. الأرقام الكاملة لا تظهر في المعاينة.</div>' + newCompanies + '<div class="table-wrap" style="margin-top:12px"><table class="table"><thead><tr><th>المندوب</th><th>الهوية / الجوال</th><th>الشركة</th><th>النظام</th><th>المطابقة</th></tr></thead><tbody>' + preview.rows.map(function (row) { return '<tr><td>' + esc(row.fullName) + '</td><td>' + esc(row.identityMasked) + '<br><small>' + esc(row.mobileMasked) + '</small></td><td>' + esc(row.contractorName) + '</td><td>' + row.systemNames.map(esc).join('، ') + '</td><td>' + (row.companyMatched ? '<span class="badge badge-active">موجودة</span>' : '<span class="badge badge-pending">ستُنشأ</span>') + '</td></tr>'; }).join('') + '</tbody></table></div><div class="actions"><button type="button" class="btn btn-red" id="representative-roster-confirm">مراجعة الاستبدال النهائي</button></div>';
      document.getElementById('representative-roster-confirm').addEventListener('click', function () {
        modal('تأكيد استبدال قائمة المندوبين', '<div class="note" style="background:#fef2f2;color:#991b1b;border-color:#fecaca"><strong>تنبيه:</strong> سيُعطّل كل مندوب حالي غير موجود في الملف، وتصبح قائمة Excel هي القائمة النشطة الوحيدة. تبقى الزيارات القديمة محفوظة دون تغيير.</div><form id="roster-confirm-form" class="form-grid" style="margin-top:12px"><div class="field full"><label>اكتب النص التالي كاملًا للتأكيد</label><code style="direction:ltr;display:block;padding:9px;background:#f8fafc;border-radius:8px">' + esc(preview.confirmationText) + '</code><input name="confirmation" autocomplete="off" required></div></form>', [{ label: 'استبدال القائمة الآن', className: 'btn-red', action: async function (confirmButton) {
          var confirmForm = document.getElementById('roster-confirm-form'); if (!confirmForm.reportValidity()) return;
          if (confirmForm.elements.confirmation.value.trim() !== preview.confirmationText) { toast('اكتب نص التأكيد كما هو ظاهر', false); return; }
          confirmButton.disabled = true;
          try {
            var result = await api('/management/representative-roster/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ previewToken: preview.previewToken, sha256: preview.sha256, confirmation: confirmForm.elements.confirmation.value.trim() }) });
            closeModal(); form.reset(); previewNode.innerHTML = ''; await loadBootstrap(); toast('تم اعتماد ' + result.imported + ' مندوبًا وتعطيل ' + result.representativesDisabled + ' مندوبًا سابقًا', true);
          } catch (error) { toast(error.message, false); confirmButton.disabled = false; }
        } }]);
      });
    } catch (error) { previewNode.innerHTML = ''; toast(error.message, false); }
    finally { button.disabled = false; }
  });

  document.addEventListener('click', async function (event) {
    var target = event.target.closest('[data-edit-system],[data-edit-contractor],[data-edit-qualification],[data-delete-system],[data-edit-approval],[data-delete-approval],[data-toggle-system],[data-toggle-contractor],[data-toggle-approval],[data-toggle-qualification],[data-toggle-rep],[data-delete-contractor],[data-delete-qualification],[data-delete-rep],[data-rep-systems],[data-upload-doc],[data-preview-doc],[data-download-doc],[data-disable-doc],[data-link],[data-reject],[data-preview],[data-visit-detail],[data-upload-signed],[data-download-signed],[data-postpone-approve],[data-postpone-reject]'); if (!target) return;
    try {
      if (target.dataset.editSystem) openEditSystem(Number(target.dataset.editSystem));
      else if (target.dataset.editContractor) openEditContractor(Number(target.dataset.editContractor));
      else if (target.dataset.editQualification) openEditQualification(Number(target.dataset.editQualification));
      else if (target.dataset.deleteSystem) openSafeDelete('النظام', '/management/systems/' + target.dataset.deleteSystem);
      else if (target.dataset.editApproval) openEditSiteApproval(Number(target.dataset.editApproval));
      else if (target.dataset.deleteApproval) openSafeDelete('اعتماد الموقع', '/management/site-approvals/' + target.dataset.deleteApproval);
      else if (target.dataset.toggleSystem) await toggleEntity('/management/systems/' + target.dataset.toggleSystem, target.dataset.active !== 'true');
      else if (target.dataset.toggleContractor) await toggleEntity('/management/contractors/' + target.dataset.toggleContractor, target.dataset.active !== 'true');
      else if (target.dataset.toggleApproval) await toggleStatus('/management/site-approvals/' + target.dataset.toggleApproval, target.dataset.active !== 'true');
      else if (target.dataset.toggleQualification) await toggleStatus('/management/qualifications/' + target.dataset.toggleQualification, target.dataset.active !== 'true');
      else if (target.dataset.toggleRep) await toggleEntity('/management/representatives/' + target.dataset.toggleRep, target.dataset.active !== 'true');
      else if (target.dataset.deleteContractor) openSafeDelete('الشركة', '/management/contractors/' + target.dataset.deleteContractor);
      else if (target.dataset.deleteQualification) openSafeDelete('التأهيل', '/management/qualifications/' + target.dataset.deleteQualification);
      else if (target.dataset.deleteRep) openSafeDelete('المندوب', '/management/representatives/' + target.dataset.deleteRep);
      else if (target.dataset.repSystems) openRepresentativeSystems(Number(target.dataset.repSystems));
      else if (target.dataset.uploadDoc) { var owner = target.dataset.uploadDoc.split(':'); openDocumentUpload(owner[0], Number(owner[1])); }
      else if (target.dataset.previewDoc) previewDocument(Number(target.dataset.previewDoc), target.dataset.name || 'الهوية / الإقامة', target.dataset.mime || '');
      else if (target.dataset.downloadDoc) downloadDocument(Number(target.dataset.downloadDoc), target.dataset.name || 'document');
      else if (target.dataset.disableDoc) openDisableDocument(Number(target.dataset.disableDoc));
      else if (target.dataset.uploadSigned) openSignedPermitUpload(Number(target.dataset.uploadSigned));
      else if (target.dataset.downloadSigned) downloadSignedPermit(Number(target.dataset.downloadSigned));
      else if (target.dataset.link) openLink(Number(target.dataset.link));
      else if (target.dataset.reject) openReject(Number(target.dataset.reject));
      else if (target.dataset.postponeApprove) openPostponementDecision(Number(target.dataset.postponeApprove), 'approved');
      else if (target.dataset.postponeReject) openPostponementDecision(Number(target.dataset.postponeReject), 'rejected');
      else if (target.dataset.preview) window.NajranVisitPermit.preview(Number(target.dataset.preview)).catch(window.NajranVisitPermit.showError);
      else if (target.dataset.visitDetail) openVisitDetail(Number(target.dataset.visitDetail));
    } catch (error) { toast(error.message, false); }
  });

  async function toggleEntity(path, isActive) { await api(path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: isActive }) }); toast(isActive ? 'تم التفعيل' : 'تم التعطيل دون حذف', true); await loadBootstrap(); }
  async function toggleStatus(path, active) { await api(path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: active ? 'active' : 'disabled' }) }); toast(active ? 'تم التفعيل' : 'تم التعطيل دون حذف', true); await loadBootstrap(); }
  function openSafeDelete(label, path) {
    modal('حذف ' + label, '<div class="note" style="background:#fff7ed;color:#9a3412;border-color:#fed7aa">يُسمح بالحذف النهائي فقط إذا كان السجل غير مستخدم. إذا كان مرتبطًا بزيارة أو وثيقة فسيمنع النظام الحذف ويطلب استخدام التعطيل.</div>', [{ label: 'تأكيد الحذف', className: 'btn-red', action: async function (button) {
      button.disabled = true;
      try { await api(path, { method: 'DELETE' }); closeModal(); toast('تم حذف ' + label + ' غير المستخدم', true); await loadBootstrap(); }
      catch (error) { toast(error.message, false); button.disabled = false; }
    } }]);
  }

  function openEditSystem(id) {
    var system = state.data.systems.find(function (row) { return row.id === id; }); if (!system) return;
    modal('تعديل نظام مقاول الباطن', '<form id="edit-system-form" class="form-grid"><div class="field full"><label>الاسم الكامل</label><input name="name" value="' + esc(system.name) + '" required></div><div class="field"><label>الكود</label><input name="code" value="' + esc(system.code || '') + '"></div><div class="field"><label>الوصف</label><input name="description" value="' + esc(system.description || '') + '"></div></form>', [{ label: 'حفظ التعديلات', className: 'btn-green', action: async function (button) {
      var form = document.getElementById('edit-system-form'); if (!form.reportValidity()) return; button.disabled = true;
      try { await api('/management/systems/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formObject(form)) }); closeModal(); toast('تم تعديل النظام', true); await loadBootstrap(); }
      catch (error) { toast(error.message, false); button.disabled = false; }
    } }]);
  }

  function openEditContractor(id) {
    var contractor = state.data.contractors.find(function (row) { return row.id === id; }); if (!contractor) return;
    modal('تعديل شركة مقاول الباطن', '<form id="edit-contractor-form" class="form-grid"><div class="field full"><label>الاسم الرسمي للشركة</label><input name="name" value="' + esc(contractor.name) + '" required></div><div class="field"><label>رقم السجل</label><input name="registrationNumber" value="' + esc(contractor.registrationNumber || '') + '"></div><div class="field"><label>مسؤول التواصل</label><input name="contactName" value="' + esc(contractor.contactName || '') + '"></div><div class="field"><label>جوال الشركة</label><input name="contactMobile" inputmode="numeric" value="' + esc(contractor.contactMobile || '') + '"></div></form>', [{ label: 'حفظ التعديلات', className: 'btn-green', action: async function (button) {
      var form = document.getElementById('edit-contractor-form'); if (!form.reportValidity()) return; button.disabled = true;
      try { await api('/management/contractors/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formObject(form)) }); closeModal(); toast('تم تعديل بيانات الشركة', true); await loadBootstrap(); }
      catch (error) { toast(error.message, false); button.disabled = false; }
    } }]);
  }

  function openEditQualification(id) {
    var qualification = state.data.qualifications.find(function (row) { return row.id === id; }); if (!qualification) return;
    var systems = state.data.systems.filter(function (row) { return row.isActive || row.id === qualification.systemId; });
    var contractors = state.data.contractors.filter(function (row) { return row.isActive || row.id === qualification.contractorId; });
    modal('تعديل تأهيل الشركة', '<form id="edit-qualification-form" class="form-grid"><div class="field"><label>الشركة</label><select name="contractorId" required>' + optionRows(contractors, entityName, qualification.contractorId) + '</select></div><div class="field"><label>النظام</label><select name="systemId" required>' + optionRows(systems, entityName, qualification.systemId) + '</select></div><div class="field"><label>من</label><input type="date" name="validFrom" value="' + esc(qualification.validFrom) + '" required></div><div class="field"><label>إلى</label><input type="date" name="validUntil" value="' + esc(qualification.validUntil) + '" required></div><div class="field"><label>الحالة</label><select name="status"><option value="active"' + (qualification.status === 'active' ? ' selected' : '') + '>نشط</option><option value="disabled"' + (qualification.status === 'disabled' ? ' selected' : '') + '>معطل</option><option value="expired"' + (qualification.status === 'expired' ? ' selected' : '') + '>منتهي</option></select></div><div class="field full"><label>ملاحظات</label><input name="notes" value="' + esc(qualification.notes || '') + '"></div></form>', [{ label: 'حفظ التعديلات', className: 'btn-green', action: async function (button) {
      var form = document.getElementById('edit-qualification-form'); if (!form.reportValidity()) return; var body = formObject(form); body.contractorId = Number(body.contractorId); body.systemId = Number(body.systemId); button.disabled = true;
      try { await api('/management/qualifications/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); closeModal(); toast('تم تعديل التأهيل', true); await loadBootstrap(); }
      catch (error) { toast(error.message, false); button.disabled = false; }
    } }]);
  }

  function openEditSiteApproval(id) {
    var approval = state.data.siteApprovals.find(function (row) { return row.id === id; }); if (!approval) return;
    var systems = state.data.systems.filter(function (row) { return row.isActive || row.id === approval.systemId; });
    var contractors = state.data.contractors.filter(function (row) { return row.isActive || row.id === approval.contractorId; });
    modal('تعديل اعتماد الموقع', '<form id="edit-site-approval-form" class="form-grid"><div class="field"><label>الموقع</label><select name="siteName" required>' + siteOptions(allMaintenanceSites(), approval.siteName) + '</select></div><div class="field"><label>النظام</label><select name="systemId" required>' + optionRows(systems, entityName, approval.systemId) + '</select></div><div class="field"><label>مقاول الباطن</label><select name="contractorId" required>' + optionRows(contractors, entityName, approval.contractorId) + '</select></div><div class="field"><label>من</label><input type="date" name="validFrom" value="' + esc(approval.validFrom) + '" required></div><div class="field"><label>إلى</label><input type="date" name="validUntil" value="' + esc(approval.validUntil) + '" required></div><div class="field"><label>الحالة</label><select name="status"><option value="active"' + (approval.status === 'active' ? ' selected' : '') + '>نشط</option><option value="disabled"' + (approval.status === 'disabled' ? ' selected' : '') + '>معطل</option><option value="expired"' + (approval.status === 'expired' ? ' selected' : '') + '>منتهي</option></select></div><div class="field full"><label>ملاحظات</label><input name="notes" value="' + esc(approval.notes || '') + '"></div></form>', [{ label: 'حفظ التعديلات', className: 'btn-green', action: async function (button) {
      var form = document.getElementById('edit-site-approval-form'); if (!form.reportValidity()) return; var body = formObject(form); body.systemId = Number(body.systemId); body.contractorId = Number(body.contractorId); button.disabled = true;
      try { await api('/management/site-approvals/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); closeModal(); toast('تم تعديل اعتماد الموقع', true); await loadBootstrap(); }
      catch (error) { toast(error.message, false); button.disabled = false; }
    } }]);
  }

  function openRepresentativeSystems(repId) {
    var links = state.data.representativeSystems.filter(function (x) { return x.representativeId === repId && x.isActive; }).map(function (x) { return x.systemId; });
    modal('ربط المندوب بالأنظمة', '<div class="system-links">' + state.data.systems.filter(function (x) { return x.isActive; }).map(function (system) { return '<label class="check-chip"><input type="checkbox" name="rep-system" value="' + system.id + '"' + (links.includes(system.id) ? ' checked' : '') + '> ' + esc(entityName(system)) + '</label>'; }).join('') + '</div>', [{ label: 'حفظ الربط', className: 'btn-green', action: async function () { var ids = Array.from(document.querySelectorAll('input[name="rep-system"]:checked')).map(function (x) { return Number(x.value); }); try { await api('/management/representatives/' + repId + '/systems', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ systemIds: ids }) }); closeModal(); toast('تم حفظ ربط الأنظمة', true); await loadBootstrap(); } catch (e) { toast(e.message, false); } } }]);
  }

  function openDocumentUpload(ownerType, ownerId) {
    var representativeOptions = '<option value="iqama_front">الهوية / الإقامة — الوجه الأمامي (صورة)</option><option value="iqama_back">الهوية / الإقامة — الوجه الخلفي (صورة)</option><option value="iqama_pdf">الهوية / الإقامة — ملف PDF كامل</option><option value="other">مستند آخر</option>';
    var generalOptions = '<option value="identity">الهوية / الإقامة</option><option value="residence">إثبات الإقامة</option><option value="qualification">مستند التأهيل</option><option value="other">مستند آخر</option>';
    modal(ownerType === 'representative' ? 'رفع هوية أو إقامة المندوب' : 'رفع وثيقة محمية', '<form id="document-form" class="form-grid"><div class="field"><label>نوع الوثيقة</label><select name="documentType" required>' + (ownerType === 'representative' ? representativeOptions : generalOptions) + '</select></div><div class="field"><label>الملف</label><input type="file" name="file" accept="application/pdf,image/png,image/jpeg" required></div><div class="field full"><div class="note">الصور حتى 5 ميجابايت وPDF حتى 10 ميجابايت. الملف محمي ولا يظهر في الباركود العام، وتظهر المعاينة فقط للمستخدم المخول بإدارة الزيارات.</div></div></form>', [{ label: 'رفع وحفظ', className: 'btn-green', action: async function (button) { var form = document.getElementById('document-form'), file = form.elements.file.files[0]; if (!file) { toast('اختر الملف', false); return; } var data = new FormData(); data.append('ownerType', ownerType); data.append('ownerId', ownerId); data.append('documentType', form.elements.documentType.value); data.append('file', file); button.disabled = true; try { await api('/management/documents', { method: 'POST', body: data }); closeModal(); toast('تم حفظ الوثيقة مع الاحتفاظ بتاريخ البدائل', true); await loadBootstrap(); } catch (e) { toast(e.message, false); button.disabled = false; } } }]);
  }

  async function fetchDocumentBlob(id, preview, retried) {
    var token = retried ? await refreshSessionToken() : await freshToken(false);
    var response = await fetch('/api/visits/management/documents/' + id + '/content' + (preview ? '?preview=1' : ''), { headers: { Authorization: 'Bearer ' + token }, credentials: 'same-origin', cache: 'no-store' });
    if (response.status === 401) {
      saveUiState(); clearCachedToken();
      if (!retried) return fetchDocumentBlob(id, preview, true);
      throw new Error('انتهت صلاحية جلسة الدخول؛ اضغط «تجديد الجلسة» ثم أعد المحاولة');
    }
    if (!response.ok) { var body = await response.json().catch(function(){return{};}); throw new Error(body.error || (preview ? 'تعذر معاينة الوثيقة' : 'تعذر تنزيل الوثيقة')); }
    return response.blob();
  }

  async function previewDocument(id, name, mimeType) {
    try {
      var blob = await fetchDocumentBlob(id, true), url = URL.createObjectURL(blob), type = blob.type || mimeType;
      var content = type === 'application/pdf' ? '<iframe title="معاينة ' + esc(name) + '" src="' + esc(url) + '" style="width:100%;height:68vh;border:1px solid #dbe4f0;border-radius:10px;background:#f8fafc"></iframe>' : '<div style="text-align:center;background:#f8fafc;border:1px solid #dbe4f0;border-radius:10px;padding:10px"><img src="' + esc(url) + '" alt="معاينة ' + esc(name) + '" style="max-width:100%;max-height:68vh;object-fit:contain"></div>';
      modal('معاينة محمية — ' + name, content + '<div class="note" style="margin-top:10px">هذه الوثيقة متاحة فقط للمستخدم المخول، وتم تسجيل عملية المعاينة في سجل التدقيق.</div>', [{ label: 'تنزيل نسخة', className: 'btn-light', action: function () { downloadDocument(id, name); } }]);
      state.documentPreviewUrl = url;
    } catch (e) { toast(e.message, false); }
  }

  async function downloadDocument(id, name) {
    try { var blob = await fetchDocumentBlob(id, false), url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(function(){URL.revokeObjectURL(url);},1000); } catch (e) { toast(e.message, false); }
  }

  function openSignedPermitUpload(visitId) {
    modal('رفع التصريح المعتمد أو الموقع', '<form id="signed-permit-form" class="form-grid"><div class="field full"><label>نسخة التصريح المعتمدة</label><input type="file" name="file" accept="application/pdf,image/png,image/jpeg" required></div><div class="field full"><div class="note">يمكن رفع PDF أو صورة حقيقية. رفع بديل يحتفظ بالنسخة السابقة في السجل دون حذفها.</div></div></form>', [{ label: 'رفع وحفظ', className: 'btn-green', action: async function (button) { var form = document.getElementById('signed-permit-form'), file = form.elements.file.files[0]; if (!file) { toast('اختر ملف التصريح المعتمد', false); return; } var data = new FormData(); data.append('file', file); button.disabled = true; try { await api('/' + visitId + '/signed-permit', { method: 'PATCH', body: data }); closeModal(); toast('تم حفظ التصريح المعتمد مع الاحتفاظ بتاريخ البدائل', true); } catch (e) { toast(e.message, false); button.disabled = false; } } }]);
  }

  async function downloadSignedPermit(visitId) {
    try { var token = await freshToken(), response = await fetch('/api/visits/' + visitId + '/signed-permit', { headers: { Authorization: 'Bearer ' + token } }); if (response.status === 401) { token = await freshToken(true); response = await fetch('/api/visits/' + visitId + '/signed-permit', { headers: { Authorization: 'Bearer ' + token } }); } if (!response.ok) { var body = await response.json().catch(function(){return{};}); throw new Error(body.error || 'تعذر تنزيل التصريح المعتمد'); } var blob = await response.blob(), url = URL.createObjectURL(blob), link = document.createElement('a'), extension = blob.type === 'application/pdf' ? '.pdf' : blob.type === 'image/png' ? '.png' : blob.type === 'image/jpeg' ? '.jpg' : ''; link.href = url; link.download = 'تصريح-زيارة-معتمد-' + visitId + extension; link.click(); setTimeout(function(){URL.revokeObjectURL(url);},1000); return true; } catch (e) { toast(e.message, false); return false; }
  }

  function openDisableDocument(id) {
    modal('تعطيل الوثيقة دون حذفها', '<div class="field"><label>سبب التعطيل</label><textarea id="disable-document-reason" required></textarea></div>', [{ label: 'تعطيل الوثيقة', className: 'btn-red', action: async function (button) { var reason = document.getElementById('disable-document-reason').value.trim(); if (!reason) { toast('سبب التعطيل مطلوب', false); return; } button.disabled = true; try { await api('/management/documents/' + id + '/disable', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: reason }) }); closeModal(); toast('تم تعطيل الوثيقة مع الاحتفاظ بتاريخها', true); } catch (e) { toast(e.message, false); button.disabled = false; } } }]);
  }

  function linkFormHtml(visit) {
    var d = state.data, start = localDateValue(visit.startsAt || visit.visitDate);
    return '<form id="link-form" class="form-grid"><div class="field"><label>النظام</label><select name="systemId" required>' + optionRows(d.systems.filter(function(x){return x.isActive;}),entityName) + '</select></div><div class="field"><label>الشركة</label><select name="contractorId" required>' + optionRows(d.contractors.filter(function(x){return x.isActive;}),entityName) + '</select></div><div class="field"><label>المندوب</label><select name="representativeId" required>' + optionRows(d.representatives.filter(function(x){return x.isActive;}),function(x){return x.fullName+' — '+representativeIdentity(x);}) + '</select></div><div class="field"><label>اعتماد الموقع</label><select name="siteApprovalId" required>' + optionRows(d.siteApprovals.filter(function(x){return x.status==='active';}),function(x){return x.siteName+' #'+x.id;}) + '</select></div><div class="field"><label>التأهيل</label><select name="qualificationId" required>' + optionRows(d.qualifications.filter(function(x){return x.status==='active';}),function(x){return 'تأهيل #'+x.id;}) + '</select></div><div class="field"><label>تاريخ الزيارة</label><input type="date" name="startsAt" value="' + esc(start) + '" required></div><div class="field full"><div class="note">زيارة دورية لأنظمة الموقع.</div></div></form>';
  }
  function openLink(id) { var visit = state.data.pending.find(function (x) { return x.id === id; }); if (!visit) return; modal('ربط الطلب واعتماده', linkFormHtml(visit), [{ label: 'حفظ الربط واعتماد التصريح', className: 'btn-green', action: async function (button) { button.disabled = true; try { var body = formObject(document.getElementById('link-form')); body.startsAt = dateOnlyIso(body.startsAt, false); body.endsAt = null; await api('/' + id + '/link', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); await api('/' + id + '/status', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'approved' }) }); closeModal(); toast('تم الربط والاعتماد وإصدار رقم جديد', true); await loadBootstrap(); } catch (e) { toast(e.message, false); button.disabled = false; } } }]); }
  function openReject(id) { modal('رفض طلب الزيارة', '<div class="field"><label>سبب الرفض</label><textarea id="reject-note" required></textarea></div>', [{ label: 'تأكيد الرفض', className: 'btn-red', action: async function (button) { var note = document.getElementById('reject-note').value.trim(); if (!note) { toast('سبب الرفض مطلوب', false); return; } button.disabled = true; try { await api('/' + id + '/status', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'rejected', adminNotes: note }) }); closeModal(); toast('تم رفض الطلب دون حذفه', true); await loadBootstrap(); } catch (e) { toast(e.message, false); button.disabled = false; } } }]); }

  function openPostponementDecision(id, decision) {
    var visit = (state.data.pendingPostponements || []).find(function (row) { return row.id === id; });
    if (!visit || !visit.postponement) return;
    var request = visit.postponement, rejected = decision === 'rejected';
    var summary = '<div class="detail-grid"><div class="detail"><small>الزائر</small><strong>' + esc(visit.repName) + '</strong></div><div class="detail"><small>الموقع</small><strong>' + esc(visit.siteLocation) + '</strong></div><div class="detail"><small>التاريخ الحالي</small><strong>' + dateOnlyText(request.previousVisitDate) + '</strong></div><div class="detail"><small>التاريخ المطلوب</small><strong>' + dateOnlyText(request.requestedVisitDate) + '</strong></div><div class="detail"><small>سبب الموقع</small><strong>' + esc(request.reasonLabel) + '</strong></div><div class="detail"><small>مقدم الطلب</small><strong>' + esc(request.requestedByName || 'مستخدم الموقع') + '</strong></div></div>' + (request.reasonDetails ? '<div class="note" style="margin-top:11px">' + esc(request.reasonDetails) + '</div>' : '') + '<div class="field" style="margin-top:12px"><label>' + (rejected ? 'سبب رفض التأجيل' : 'ملاحظة القرار — اختيارية') + '</label><textarea id="postponement-decision-note"' + (rejected ? ' required' : '') + '></textarea></div>';
    modal(rejected ? 'رفض طلب تأجيل الزيارة' : 'الموافقة على تأجيل الزيارة', summary, [{ label: rejected ? 'تأكيد رفض التأجيل' : 'تأكيد التاريخ الجديد', className: rejected ? 'btn-red' : 'btn-green', action: async function (button) {
      var note = document.getElementById('postponement-decision-note').value.trim();
      if (rejected && !note) { toast('سبب رفض التأجيل مطلوب', false); return; }
      button.disabled = true;
      try {
        await api('/management/postponement-requests/' + id + '/decision', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: request.requestId, decision: decision, decisionNotes: note }) });
        closeModal();
        toast(rejected ? 'تم رفض طلب التأجيل وبقي موعد الزيارة دون تغيير' : 'تم اعتماد التأجيل وتحديث موعد الزيارة والتصريح', true);
        await loadBootstrap();
      } catch (error) { toast(error.message, false); button.disabled = false; }
    } }]);
  }

  function selectedDirectRepresentativeIds() {
    return Array.from(document.querySelectorAll('[data-direct-representative]:checked')).map(function (node) { return Number(node.value); }).filter(Boolean);
  }

  function setDirectRepresentativeIds(ids) {
    var selected = new Set((ids || []).map(Number).filter(Boolean).slice(0, 4));
    document.querySelectorAll('[data-direct-representative]').forEach(function (node) { node.checked = selected.has(Number(node.value)); });
  }

  function refreshDirectRepresentatives(selectedIds) {
    var form = document.getElementById('direct-form'), contractorId = Number(form.elements.contractorId.value || 0), systemId = Number(form.elements.systemId.value || 0);
    var keep = Array.isArray(selectedIds) ? selectedIds : selectedDirectRepresentativeIds();
    var reps = (state.data ? state.data.representatives : []).filter(function (rep) { return rep.isActive && rep.contractorId === contractorId && state.data.representativeSystems.some(function (link) { return link.isActive && link.representativeId === rep.id && link.systemId === systemId; }); }).sort(function (a, b) { return a.fullName.localeCompare(b.fullName, 'ar'); });
    document.getElementById('direct-representative-options').innerHTML = reps.length ? reps.map(function (rep) {
      return '<label class="representative-choice"><input type="checkbox" data-direct-representative value="' + rep.id + '"><span><strong>' + esc(rep.fullName) + '</strong><small>' + esc(representativeIdentity(rep)) + ' — ' + esc(representativeMobile(rep)) + '</small></span></label>';
    }).join('') : '<div class="empty" style="grid-column:1/-1;padding:16px!important">لا يوجد مندوب مرتبط بهذه الشركة والنظام. استخدم زر الإضافة.</div>';
    setDirectRepresentativeIds(keep);
    renderDirectReadiness();
  }

  function renderDirectRepresentativeSummary(representativeId) {
    var node = document.getElementById('direct-representative-summary');
    if (!node || !state.data) return;
    var representative = state.data.representatives.find(function (row) { return row.id === representativeId; });
    if (!representative) { node.textContent = 'ابحث ثم اختر اسمًا محفوظًا لإضافته إلى التصريح وتحديد شركته ونظامه.'; return; }
    var contractor = state.data.contractors.find(function (row) { return row.id === representative.contractorId; });
    var systems = state.data.representativeSystems.filter(function (link) { return link.representativeId === representative.id && link.isActive; }).map(function (link) { var system = state.data.systems.find(function (row) { return row.id === link.systemId; }); return entityName(system); }).filter(Boolean);
    node.textContent = 'الشركة: ' + entityName(contractor) + ' — الهوية/الإقامة: ' + representativeIdentity(representative) + ' — الجوال: ' + representativeMobile(representative) + (systems.length ? ' — الأنظمة: ' + systems.join('، ') : ' — يحتاج ربط نظام') + ' — اختيار الاسم يضيفه لقائمة المندوبين.';
  }

  function applySavedRepresentative(representativeId) {
    var form = document.getElementById('direct-form'), representative = state.data.representatives.find(function (row) { return row.id === representativeId && row.isActive; });
    if (!representative) { renderDirectRepresentativeSummary(0); renderDirectReadiness(); return; }
    var selected = selectedDirectRepresentativeIds();
    var links = state.data.representativeSystems.filter(function (row) { return row.representativeId === representative.id && row.isActive; });
    var currentSystemId = Number(form.elements.systemId.value || 0), selectedLink = links.find(function (row) { return row.systemId === currentSystemId; }) || links[0];
    if (selectedLink) form.elements.systemId.value = String(selectedLink.systemId);
    refreshDirectContractors();
    form.elements.contractorId.value = String(representative.contractorId);
    if (selected.indexOf(representative.id) === -1) selected.push(representative.id);
    refreshDirectRepresentatives(selected.slice(-4));
    document.getElementById('direct-saved-representative').value = String(representative.id);
    renderDirectRepresentativeSummary(representative.id);
    renderDirectReadiness();
  }

  function activeForVisitDate(row, visitDate) {
    return !!row && row.status === 'active' && (!visitDate || ((!row.validFrom || row.validFrom <= visitDate) && (!row.validUntil || row.validUntil >= visitDate)));
  }

  function renderDirectReadiness() {
    var node = document.getElementById('direct-readiness');
    if (!node || !state.data) return;
    var selection = directSelection(), systemId = Number(selection.systemId || 0), contractorId = Number(selection.contractorId || 0), representativeIds = selection.representativeIds || [], visitDate = selection.startsAt || '';
    var qualification = state.data.qualifications.find(function (row) { return row.contractorId === contractorId && row.systemId === systemId && activeForVisitDate(row, visitDate); });
    var approval = state.data.siteApprovals.find(function (row) { return row.siteName === selection.siteName && row.contractorId === contractorId && row.systemId === systemId && activeForVisitDate(row, visitDate); });
    var representatives = representativeIds.map(function (id) { return state.data.representatives.find(function (row) { return row.id === id && row.isActive && row.contractorId === contractorId; }); }).filter(Boolean);
    var linked = representatives.length === representativeIds.length && representatives.every(function (representative) { return state.data.representativeSystems.some(function (row) { return row.representativeId === representative.id && row.systemId === systemId && row.isActive; }); });
    var exceptionIncomplete = representatives.some(function (representative) { return representative.noResidenceException && !representative.exceptionReason; });
    var checks = [
      { ok: !!selection.maintenanceContractorKey && !!selection.siteName, text: selection.siteName ? 'الموقع: ' + selection.siteName : 'اختر مقاول الصيانة والموقع' },
      { ok: !!systemId, text: systemId ? 'تم اختيار النظام' : 'اختر نظام مقاول الباطن' },
      { ok: !!contractorId, className: !contractorId ? 'missing' : qualification ? 'ready' : 'info', text: !contractorId ? 'اختر شركة مقاول الباطن' : qualification ? 'تأهيل الشركة ساري' : 'التأهيل اختياري ويمكن استكماله لاحقًا' },
      { ok: !!approval, text: approval ? 'اعتماد الموقع ساري' : 'أكمل اعتماد الموقع للشركة والنظام' },
      { ok: representativeIds.length > 0 && representativeIds.length <= 4 && linked, text: representativeIds.length && linked ? 'تم اختيار ' + representativeIds.length + ' مندوب وربطهم بالنظام' : 'اختر من مندوب واحد إلى أربعة مرتبطين' },
    ];
    if (exceptionIncomplete) checks.push({ ok: false, text: 'سبب الاستثناء غير مكتمل لأحد المندوبين' });
    node.innerHTML = checks.map(function (item) { var className = item.className || (item.ok ? 'ready' : 'missing'); return '<div class="readiness-item ' + className + '">' + (className === 'ready' ? '✓ ' : '• ') + esc(item.text) + '</div>'; }).join('');
  }

  function directSelection() {
    var form = document.getElementById('direct-form');
    return { maintenanceContractorKey: form.elements.maintenanceContractorKey.value, siteName: form.elements.siteName.value, systemId: form.elements.systemId.value, contractorId: form.elements.contractorId.value, representativeIds: selectedDirectRepresentativeIds(), startsAt: form.elements.startsAt.value };
  }

  function restoreDirectSelection(selection, contractorId, representativeId) {
    if (!selection) return;
    var form = document.getElementById('direct-form');
    form.elements.maintenanceContractorKey.value = selection.maintenanceContractorKey || '';
    refreshDirectSites();
    form.elements.siteName.value = selection.siteName || '';
    form.elements.systemId.value = selection.systemId || '';
    refreshDirectContractors();
    form.elements.contractorId.value = String(contractorId || selection.contractorId || '');
    var representativeIds = Array.isArray(selection.representativeIds) ? selection.representativeIds.slice(0, 4) : (selection.representativeId ? [selection.representativeId] : []);
    if (representativeId && representativeIds.indexOf(Number(representativeId)) === -1) representativeIds.push(Number(representativeId));
    refreshDirectRepresentatives(representativeIds.slice(-4));
    document.getElementById('direct-representative-search').value = '';
    var lastRepresentativeId = Number(representativeId || representativeIds[representativeIds.length - 1] || 0);
    refreshSavedRepresentativeOptions('', lastRepresentativeId || '');
    document.getElementById('direct-saved-representative').value = String(lastRepresentativeId || '');
    renderDirectRepresentativeSummary(lastRepresentativeId);
    form.elements.startsAt.value = selection.startsAt || localDateValue();
    renderDirectReadiness();
    saveUiState();
  }

  function openDirectSetup(createCompany) {
    var selection = directSelection(), systemId = Number(selection.systemId || 0), contractorId = Number(selection.contractorId || 0);
    if (!selection.maintenanceContractorKey || !selection.siteName || !systemId) { toast('اختر مقاول الصيانة والموقع والنظام أولًا', false); return; }
    if (!createCompany && !contractorId) { toast('اختر الشركة التي تريد اعتمادها للموقع', false); return; }
    var qualification = state.data.qualifications.find(function (row) { return row.contractorId === contractorId && row.systemId === systemId; });
    var approval = state.data.siteApprovals.find(function (row) { return row.contractorId === contractorId && row.systemId === systemId && row.siteName === selection.siteName; });
    var validFrom = (approval && approval.validFrom) || (qualification && qualification.validFrom) || selection.startsAt || localDateValue();
    var untilDate = new Date(validFrom + 'T00:00:00'); untilDate.setFullYear(untilDate.getFullYear() + 1);
    var validUntil = (approval && approval.validUntil) || (qualification && qualification.validUntil) || localDateValue(untilDate);
    var companyFields = createCompany ? '<div class="field full"><label>الاسم الرسمي الكامل للشركة</label><input name="companyName" placeholder="شركة / مؤسسة / مصنع ..." required></div><div class="field"><label>رقم السجل (اختياري)</label><input name="registrationNumber"></div><div class="field"><label>اسم مسؤول التواصل (اختياري)</label><input name="contactName"></div><div class="field"><label>جوال الشركة (اختياري)</label><input name="contactMobile" inputmode="numeric" placeholder="05xxxxxxxx"></div>' : '<div class="field full"><div class="note">سيتم حفظ اعتماد موقع «' + esc(entityName(state.data.contractors.find(function (row) { return row.id === contractorId; }))) + '» لهذا الموقع والنظام.</div></div>';
    modal(createCompany ? 'إضافة شركة واعتماد موقعها' : 'استكمال اعتماد الموقع', '<form id="direct-setup-form" class="form-grid">' + companyFields + '<div class="field"><label>بداية اعتماد الموقع</label><input type="date" name="validFrom" value="' + esc(validFrom) + '" required></div><div class="field"><label>نهاية اعتماد الموقع</label><input type="date" name="validUntil" value="' + esc(validUntil) + '" required></div><div class="field full"><label class="check-chip"><input type="checkbox" name="includeQualification"' + (qualification ? ' checked' : '') + '> حفظ أو تحديث تأهيل الشركة أيضًا (اختياري)</label></div><div class="field full"><label>ملاحظات / مرجع الاعتماد (اختياري)</label><textarea name="notes"></textarea></div><div class="field full"><div class="note">اعتماد الموقع مطلوب للإصدار. التأهيل اختياري في هذه المرحلة ويمكن إضافته لاحقًا من تبويب الشركات والتأهيلات.</div></div></form>', [{ label: createCompany ? 'إضافة الشركة وحفظ اعتماد الموقع' : 'حفظ اعتماد الموقع', className: 'btn-green', action: async function (button) {
      var form = document.getElementById('direct-setup-form'); if (!form.reportValidity()) return;
      var body = formObject(form); body.systemId = systemId; body.contractorId = createCompany ? null : contractorId; body.maintenanceContractorKey = selection.maintenanceContractorKey; body.siteName = selection.siteName; body.includeQualification = form.elements.includeQualification.checked;
      button.disabled = true;
      try { var result = await api('/management/direct-setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); closeModal(); await loadBootstrap(); restoreDirectSelection(selection, result.contractor.id); toast(createCompany ? 'تمت إضافة الشركة وحفظ اعتماد الموقع' : 'تم حفظ اعتماد الموقع' + (body.includeQualification ? ' والتأهيل' : ''), true); }
      catch (e) { toast(e.message, false); button.disabled = false; }
    } }]);
  }

  function openDirectRepresentative() {
    var selection = directSelection(), contractorId = Number(selection.contractorId || 0), systemId = Number(selection.systemId || 0);
    if (!contractorId || !systemId) { toast('اختر النظام والشركة أولًا', false); return; }
    var selectedSystem = state.data.systems.find(function (row) { return row.id === systemId; });
    var existingRepresentatives = state.data.representatives.filter(function (row) { return row.isActive && row.contractorId === contractorId; }).sort(function (a, b) { return a.fullName.localeCompare(b.fullName, 'ar'); });
    var existingOptions = '<option value="">اختر مندوبًا مسجلًا</option>' + existingRepresentatives.map(function (row) {
      var linked = state.data.representativeSystems.some(function (link) { return link.representativeId === row.id && link.systemId === systemId && link.isActive; });
      return '<option value="' + row.id + '">' + esc(row.fullName + ' — ' + representativeIdentity(row) + (linked ? ' — مرتبط بالفعل' : ' — سيتم ربطه بالنظام')) + '</option>';
    }).join('');
    var suggestions = (state.data.approvedPersonnel || []).filter(function (row) { return row.contractorId === contractorId && (row.systemId === systemId || (selectedSystem && row.systemName === entityName(selectedSystem))); });
    var suggestionOptions = '<option value="">اكتب الاسم يدويًا</option>' + suggestions.map(function (row, index) { return '<option value="' + index + '">' + esc(row.fullName + ' — ' + row.sourceCertificate) + '</option>'; }).join('');
    var existingSection = existingRepresentatives.length ? '<div class="card" style="margin-bottom:14px"><h3>اختيار مندوب مسجل للشركة</h3><div class="field"><label>المندوب المسجل</label><select id="existing-direct-representative">' + existingOptions + '</select><small style="color:#64748b">سيضاف ربط النظام فقط، ولن تُلغى روابط المندوب السابقة.</small></div></div>' : '<div class="note" style="margin-bottom:14px">لا يوجد مندوب مسجل لهذه الشركة حاليًا؛ يمكنك إضافة مندوب جديد أدناه.</div>';
    var buttons = [];
    if (existingRepresentatives.length) buttons.push({ label: 'اختيار وربط المندوب المسجل', className: 'btn-primary', action: async function (button) {
      var representativeId = Number(document.getElementById('existing-direct-representative').value || 0);
      if (!representativeId) { toast('اختر مندوبًا مسجلًا أولًا', false); return; }
      button.disabled = true;
      try {
        var result = await api('/management/direct-representative-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ representativeId: representativeId, contractorId: contractorId, systemId: systemId }) });
        closeModal(); await loadBootstrap(); restoreDirectSelection(selection, contractorId, result.representative.id); toast('تم اختيار المندوب المسجل وربطه بالنظام', true);
      } catch (e) { toast(e.message, false); button.disabled = false; }
    } });
    buttons.push({ label: 'حفظ مندوب جديد واختياره', className: 'btn-green', action: async function (button) {
      var form = document.getElementById('direct-representative-form'); if (!form.reportValidity()) return;
      var body = formObject(form); body.contractorId = contractorId; body.systemId = systemId; body.noResidenceException = form.elements.noResidenceException.checked;
      if (body.noResidenceException && !body.exceptionReason) { toast('سبب الاستثناء بدون إقامة مطلوب', false); return; }
      button.disabled = true;
      try { var result = await api('/management/direct-representative', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); closeModal(); await loadBootstrap(); restoreDirectSelection(selection, contractorId, result.representative.id); toast(result.reusedExisting ? 'تم تحديث المندوب الموجود وربطه بالنظام واختياره' : 'تم حفظ المندوب وربطه بالنظام واختياره', true); }
      catch (e) { toast(e.message, false); button.disabled = false; }
    } });
    modal('اختيار مندوب مسجل أو إضافة جديد', existingSection + '<div class="card"><h3>إضافة مندوب جديد</h3><form id="direct-representative-form" class="form-grid"><div class="field full"><label>اسم مقترح من شهادات التأهيل</label><select id="approved-personnel-suggestion">' + suggestionOptions + '</select><small style="color:#64748b">الاقتراحات من الخطابات المرفقة وتحتاج مراجعة الاسم واستكمال بياناته يدويًا.</small></div><div class="field full"><label>اسم المندوب الكامل</label><input name="fullName" required></div><div class="field"><label>رقم الهوية / الإقامة (10 أرقام)</label><input name="identityNumber" inputmode="numeric" pattern="[0-9]{10}" maxlength="10" required></div><div class="field"><label>رقم الجوال السعودي</label><input name="mobile" inputmode="numeric" placeholder="05xxxxxxxx" required></div><div class="field"><label class="check-chip"><input type="checkbox" name="noResidenceException"> استثناء بدون إقامة</label></div><div class="field full"><label>سبب الاستثناء</label><textarea name="exceptionReason" disabled></textarea></div><div class="field full"><div class="note">لا تُحفظ صور الكاميرا. تُخفى البيانات في القوائم وتظهر كاملة في التصريح وملف التحقق للمستخدم المصرح.</div></div></form></div>', buttons);
    var suggestion = document.getElementById('approved-personnel-suggestion'), form = document.getElementById('direct-representative-form');
    suggestion.addEventListener('change', function () { if (this.value !== '') form.elements.fullName.value = suggestions[Number(this.value)].fullName; });
    form.elements.noResidenceException.addEventListener('change', function () { form.elements.exceptionReason.required = this.checked; form.elements.exceptionReason.disabled = !this.checked; if (!this.checked) form.elements.exceptionReason.value = ''; });
  }

  document.getElementById('direct-add-contractor').addEventListener('click', function () { openDirectSetup(true); });
  document.getElementById('direct-complete-approval').addEventListener('click', function () { openDirectSetup(false); });
  document.getElementById('direct-add-representative').addEventListener('click', openDirectRepresentative);
  document.getElementById('direct-representative-search').addEventListener('input', function () { refreshSavedRepresentativeOptions(this.value, document.getElementById('direct-saved-representative').value); });
  document.getElementById('direct-saved-representative').addEventListener('change', function () { applySavedRepresentative(Number(this.value || 0)); });
  document.querySelector('#direct-form [name="maintenanceContractorKey"]').addEventListener('change', refreshDirectSites);
  document.querySelector('#direct-form [name="siteName"]').addEventListener('change', renderDirectReadiness);
  document.querySelector('#direct-form [name="contractorId"]').addEventListener('change', function () { refreshDirectRepresentatives([]); document.getElementById('direct-saved-representative').value = ''; renderDirectRepresentativeSummary(0); });
  document.querySelector('#direct-form [name="systemId"]').addEventListener('change', refreshDirectContractors);
  document.getElementById('direct-representative-options').addEventListener('change', function (event) { if (!event.target.matches('[data-direct-representative]')) return; var ids = selectedDirectRepresentativeIds(); if (event.target.checked && ids.length > 4) { event.target.checked = false; toast('يمكن اختيار أربعة مناديب كحد أقصى', false); } renderDirectReadiness(); saveUiState(); });
  document.querySelector('#direct-form [name="startsAt"]').addEventListener('change', renderDirectReadiness);
  document.getElementById('direct-form').addEventListener('change', function () { setTimeout(saveUiState, 0); });
  document.getElementById('direct-form').addEventListener('submit', async function (event) {
    event.preventDefault();
    var startDay = localDateValue(this.elements.startsAt.value);
    if (!startDay) { toast('اختر تاريخ الزيارة من حقل التاريخ', false); this.elements.startsAt.focus(); return; }
    var body = formObject(this); body.systemId = Number(body.systemId); body.contractorId = Number(body.contractorId); body.representativeIds = selectedDirectRepresentativeIds(); body.representativeId = body.representativeIds[0] || null; body.startsAt = startDay; body.endsAt = null;
    if (!body.representativeIds.length || body.representativeIds.length > 4) { toast('اختر من مندوب واحد إلى أربعة للتصريح', false); return; }
    var visitDay = localDateValue(body.startsAt); var approval = state.data.siteApprovals.find(function (x) { return x.siteName === body.siteName && x.systemId === body.systemId && x.contractorId === body.contractorId && activeForVisitDate(x, visitDay); }); var qualification = state.data.qualifications.find(function (x) { return x.systemId === body.systemId && x.contractorId === body.contractorId && activeForVisitDate(x, visitDay); });
    body.siteApprovalId = approval ? approval.id : null; body.qualificationId = qualification ? qualification.id : null;
    try { var result = await api('/management/direct-issue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); toast(result.duplicate ? (result.message || ('تم إصدار تصريح سابق بنفس البيانات برقم ' + (result.visit.serialNumber || '—') + '؛ لم يتم إنشاء تصريح جديد')) : ('تم إصدار التصريح رقم ' + result.visit.serialNumber), true); await loadBootstrap(); window.NajranVisitPermit.preview(result.visit.id).catch(window.NajranVisitPermit.showError); } catch (e) { toast(e.message, false); }
  });

  function renderKioskQr(result) {
    state.kioskQr = result;
    var node = document.getElementById('kiosk-preview');
    node.innerHTML = '<div id="kiosk-poster" class="kiosk-poster"><img class="logo" src="/original/najran_health_cluster_logo.png" alt="شعار تجمع نجران الصحي"><h3>نموذج طلب زيارة</h3><strong>' + esc(result.siteName) + '</strong><span style="display:block;color:#475569;font-size:12px;margin-top:4px">' + esc(result.maintenanceContractor) + '</span><img class="qr" src="' + esc(result.qrDataUrl) + '" alt="باركود نموذج طلب زيارة"><p>امسح الباركود بكاميرا الجوال، ثم اختر النظام والشركة وسجّل بيانات الزيارة. يصل الطلب مباشرة إلى إدارة الزيارات.</p></div><div class="actions" style="justify-content:center"><button type="button" class="btn btn-green" id="kiosk-download-pdf"><i class="fas fa-file-pdf"></i> تحميل بوستر PDF</button><button type="button" class="btn btn-light" id="kiosk-download-png"><i class="fas fa-qrcode"></i> تحميل الباركود PNG</button><a class="btn btn-primary" href="' + esc(result.requestUrl) + '" target="_blank" rel="noopener">فتح النموذج</a></div>';
    document.getElementById('kiosk-download-pdf').addEventListener('click', downloadKioskPoster);
    document.getElementById('kiosk-download-png').addEventListener('click', function () {
      var link = document.createElement('a'); link.href = result.qrDataUrl; link.download = 'باركود-نموذج-طلب-زيارة-' + result.siteName + '.png'; link.click();
    });
  }

  async function downloadKioskPoster() {
    var poster = document.getElementById('kiosk-poster');
    if (!poster || !state.kioskQr || !window.html2canvas || !window.jspdf?.jsPDF) { toast('مكتبة تجهيز البوستر غير متاحة', false); return; }
    var button = document.getElementById('kiosk-download-pdf'); button.disabled = true;
    try {
      var canvas = await window.html2canvas(poster, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false });
      var pdf = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      var pageWidth = pdf.internal.pageSize.getWidth(), margin = 18, imageWidth = pageWidth - margin * 2, imageHeight = canvas.height * imageWidth / canvas.width;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, 20, imageWidth, Math.min(imageHeight, pdf.internal.pageSize.getHeight() - 40));
      pdf.save('بوستر-نموذج-طلب-زيارة-' + state.kioskQr.siteName + '.pdf');
      toast('تم تجهيز بوستر الموقع للطباعة', true);
    } catch (error) { toast(error.message || 'تعذر تجهيز بوستر PDF', false); }
    finally { button.disabled = false; }
  }

  document.querySelector('#kiosk-form [name="maintenanceContractorKey"]').addEventListener('change', refreshKioskSites);
  document.getElementById('kiosk-form').addEventListener('submit', async function (event) {
    event.preventDefault();
    if (!this.reportValidity()) return;
    var button = this.querySelector('button[type="submit"]'); button.disabled = true;
    try {
      var result = await api('/management/request-form-qr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formObject(this)) });
      renderKioskQr(result);
      toast('تم تجهيز باركود نموذج طلب الزيارة للموقع', true);
    } catch (error) { toast(error.message, false); }
    finally { button.disabled = false; }
  });

  document.getElementById('copy-form').addEventListener('submit', async function (event) { event.preventDefault(); var body = formObject(this); try { var preview = await api('/management/copy-site/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); var html = preview.rows.length ? '<div class="note">راجع الصفوف وحدد المطلوب نسخه إلى «' + esc(preview.targetSite) + '».</div><div class="system-links" style="margin-top:12px">' + preview.rows.map(function (row) { return '<label class="check-chip"><input type="checkbox" name="copy-approval" value="' + row.id + '" checked> ' + esc(row.systemName) + ' — ' + esc(row.contractorName) + '</label>'; }).join('') + '</div>' : '<div class="empty">لا توجد اعتمادات في الموقع المصدر</div>'; modal('مراجعة نسخ إعدادات الموقع', html, preview.rows.length ? [{ label: 'تأكيد النسخ', className: 'btn-green', action: async function () { var ids = Array.from(document.querySelectorAll('input[name="copy-approval"]:checked')).map(function (x) { return Number(x.value); }); try { await api('/management/copy-site/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceSite: preview.sourceSite, targetSite: preview.targetSite, approvalIds: ids }) }); closeModal(); toast('تم نسخ الاعتمادات بعد المراجعة', true); await loadBootstrap(); } catch (e) { toast(e.message, false); } } }] : []); } catch (e) { toast(e.message, false); } });

  document.getElementById('archive-filter').addEventListener('submit', function (event) { event.preventDefault(); loadArchive(1); }); document.getElementById('archive-prev').addEventListener('click', function () { if (state.archivePage > 1) loadArchive(state.archivePage - 1); }); document.getElementById('archive-next').addEventListener('click', function () { if (state.archivePage < state.archivePages) loadArchive(state.archivePage + 1); });
  async function loadArchive(page) { try { var params = new URLSearchParams(); var fields = formObject(document.getElementById('archive-filter')); Object.keys(fields).forEach(function (key) { if (fields[key]) params.set(key, fields[key]); }); params.set('page', page); params.set('limit', 25); var body = await api('/management/archive?' + params.toString()); state.archivePage = body.page; state.archivePages = Math.max(1, body.pages || 1); document.getElementById('archive-page').textContent = state.archivePage + ' / ' + state.archivePages; document.getElementById('archive-prev').disabled = state.archivePage <= 1; document.getElementById('archive-next').disabled = state.archivePage >= state.archivePages; document.getElementById('archive-body').innerHTML = body.visits.length ? body.visits.map(function (v) { return '<tr><td>' + esc(v.serialNumber || '—') + '</td><td>' + esc(v.repName) + '</td><td>' + esc(v.subContractor) + '</td><td>' + esc(v.systemName) + '</td><td>' + esc(v.siteLocation) + '</td><td>' + badge(v.effectiveStatus) + '</td><td>' + facilityApprovalBadge(v.facilityApproval) + '</td><td>' + dateText(v.visitDate) + '</td><td><button class="btn btn-light" data-visit-detail="' + v.id + '">فتح</button></td></tr>'; }).join('') : '<tr><td colspan="9" class="empty">لا توجد نتائج</td></tr>'; } catch (e) { toast(e.message, false); } }

  function representativesTableHtml(representatives) {
    if (!Array.isArray(representatives) || !representatives.length) return '';
    return '<div class="card" style="margin-top:12px"><h3>المندوبون وبيانات التحقق</h3><div class="table-wrap"><table class="table" style="min-width:620px"><thead><tr><th>م</th><th>الاسم</th><th>الهوية / الإقامة</th><th>الجوال</th></tr></thead><tbody>' + representatives.slice(0, 4).map(function (representative, index) { return '<tr><td>' + (index + 1) + '</td><td><strong>' + esc(representative.fullName || '—') + '</strong></td><td style="direction:ltr;text-align:right">' + esc(representative.identityNumber || representative.identityMasked || '—') + '</td><td style="direction:ltr;text-align:right">' + esc(representative.mobile || representative.mobileMasked || '—') + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
  }

  async function openVisitDetail(id) { try { var body = await api('/' + id), v = body.visit, facility = body.facilityApproval || { status:'pending' }; var details = [['رقم التصريح',v.serialNumber],['الحالة',statusLabel(v.effectiveStatus)],['مقاول الصيانة',v.mainContractor],['مقاول الباطن',v.subContractor],['النظام',v.systemName],['الموقع',v.siteLocation],['تاريخ الزيارة',dateOnlyText(v.startsAt || v.visitDate)],['سبب الإلغاء',v.cancelledReason],['حذف من العرض',v.archivedAt?dateText(v.archivedAt,true):null],['سبب الحذف من العرض',v.archiveReason]], documents = body.documents || [], representativesHtml = representativesTableHtml(body.representatives); var facilityHtml = '<div class="card" style="margin-top:12px"><h3>اعتماد إدارة المنشأة</h3><div style="margin-bottom:9px">'+facilityApprovalBadge(facility)+'</div><div class="detail-grid">'+[['المعتمد',facility.approverName],['الصفة',facility.approverTitle],['وقت القرار',facility.decidedAt?dateText(facility.decidedAt,true):null],['الملاحظة / سبب الرفض',facility.notes]].filter(function(x){return x[1];}).map(function(row){return '<div class="detail"><small>'+esc(row[0])+'</small><strong>'+esc(row[1])+'</strong></div>';}).join('')+'</div></div>'; var docHtml = '<div class="card" style="margin-top:12px"><h3>الوثائق</h3>' + (documents.length ? documents.map(function(doc){var disable=doc.status==='active'?'<button class="btn btn-red" data-disable-doc="'+doc.id+'">تعطيل</button>':'',type=doc.documentType==='facility_approval_proof'?'إثبات اعتماد المنشأة':doc.documentType;return '<div class="alert-row" style="background:#f8fafc;border-color:#e2e8f0;color:#334155"><span>'+esc(type)+' — '+esc(doc.originalName)+' '+badge(doc.status==='active'?'active':'cancelled')+'</span><span class="actions"><button class="btn btn-light" data-download-doc="'+doc.id+'" data-name="'+esc(doc.originalName)+'">تنزيل محمي</button>'+disable+'</span></div>';}).join('') : '<div class="empty">لا توجد وثائق مرتبطة بالزيارة</div>') + '</div>'; var buttons = [{ label:'رفع التصريح المعتمد',className:'btn-green',action:function(){openSignedPermitUpload(id);} },{ label:'رفع وثيقة',className:'btn-light',action:function(){openDocumentUpload('visit',id);} },{ label:'معاينة التصريح وQR',className:'btn-primary',action:function(){window.NajranVisitPermit.preview(id).catch(window.NajranVisitPermit.showError);} }]; if (v.hasSignedPermit) buttons.push({ label:'تنزيل التصريح المعتمد',className:'btn-light',action:function(){downloadSignedPermit(id);} }); if (v.archivedAt) buttons.push({ label:'استعادة للأرشيف',className:'btn-green',action:function(){restoreArchivedVisit(v);} },{ label:'حذف نهائي',className:'btn-red',action:function(){openPermanentDelete(v);} }); else buttons.push({ label:'إعادة إصدار',className:'btn-green',action:function(){openReissue(v);} },{ label:'إلغاء الزيارة',className:'btn-red',action:function(){openCancel(v);} },{ label:'حذف من العرض',className:'btn-red',action:function(){openArchiveVisit(v);} }); modal('ملف الزيارة', '<div class="detail-grid">' + details.filter(function(x){return x[1];}).map(function (row) { return '<div class="detail"><small>' + esc(row[0]) + '</small><strong>' + esc(row[1]) + '</strong></div>'; }).join('') + '</div>' + facilityHtml + representativesHtml + docHtml, buttons); } catch (e) { toast(e.message,false); } }
  function openReissue(v) { var start = new Date(Date.now()+86400000); modal('إعادة إصدار زيارة برقم جديد','<form id="reissue-form" class="form-grid"><div class="field"><label>تاريخ الزيارة</label><input type="date" name="startsAt" value="'+localDateValue(start)+'" required></div><div class="field full"><div class="note">زيارة دورية لأنظمة الموقع. سيُنشأ رقم تصريح وQR جديدان مع الحفاظ على الأصل.</div></div></form>',[{label:'إنشاء تصريح جديد',className:'btn-green',action:async function(){var body=formObject(document.getElementById('reissue-form'));body.startsAt=dateOnlyIso(body.startsAt,false);body.endsAt=null;try{var result=await api('/'+v.id+'/reissue',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});closeModal();toast('تم إنشاء تصريح جديد مع الحفاظ على الأصل',true);loadArchive(state.archivePage);window.NajranVisitPermit.preview(result.visit.id).catch(window.NajranVisitPermit.showError);}catch(e){toast(e.message,false);}}}]); }
  function openCancel(v) { modal('إلغاء الزيارة دون حذفها','<div class="field"><label>سبب الإلغاء</label><textarea id="cancel-reason" required></textarea></div>',[{label:'تأكيد الإلغاء',className:'btn-red',action:async function(){var reason=document.getElementById('cancel-reason').value.trim();if(!reason){toast('سبب الإلغاء مطلوب',false);return;}try{await api('/'+v.id+'/cancel',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason:reason})});closeModal();toast('تم إلغاء الزيارة مع الاحتفاظ بسجلها',true);loadArchive(state.archivePage);await loadBootstrap();}catch(e){toast(e.message,false);}}}]); }
  function openArchiveVisit(v) { modal('حذف الزيارة التجريبية من العرض','<div class="note" style="background:#fff7ed;color:#9a3412;border-color:#fed7aa">لن تُحذف الزيارة أو رقم التصريح نهائيًا. ستُلغى وتنتقل إلى فلتر «المحذوفة من العرض» مع تسجيل العملية.</div><div class="field" style="margin-top:12px"><label>سبب الحذف من العرض</label><textarea id="archive-visit-reason" required>زيارة تجريبية</textarea></div>',[{label:'إلغاء وإخفاء من العرض',className:'btn-red',action:async function(button){var reason=document.getElementById('archive-visit-reason').value.trim();if(!reason){toast('سبب الحذف من العرض مطلوب',false);return;}button.disabled=true;try{await api('/'+v.id+'/archive',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason:reason})});closeModal();toast('تم إلغاء الزيارة وإخفاؤها من العرض مع حفظ السجل',true);loadArchive(1);await loadBootstrap();}catch(e){toast(e.message,false);button.disabled=false;}}}]); }
  async function restoreArchivedVisit(v) { try { await api('/'+v.id+'/archive/restore',{method:'PATCH'});closeModal();toast('تمت استعادة الزيارة الملغاة إلى الأرشيف المرئي',true);loadArchive(1);await loadBootstrap();} catch(e){toast(e.message,false);} }
  function openPermanentDelete(v) { var expected='DELETE:'+(v.serialNumber||('VISIT-'+v.id));modal('حذف الزيارة نهائيًا','<div class="note" style="background:#fef2f2;color:#991b1b;border-color:#fecaca"><strong>تحذير:</strong> هذه العملية نهائية، وستحذف الزيارة وQR واعتماد المنشأة ومرفقات الزيارة. سيبقى سجل تدقيق باسم المنفذ والسبب.</div><form id="permanent-delete-form" class="form-grid" style="margin-top:12px"><div class="field full"><label>اكتب النص التالي كاملًا للتأكيد</label><code style="direction:ltr;display:block;padding:9px;background:#f8fafc;border-radius:8px">'+esc(expected)+'</code><input name="confirmation" autocomplete="off" required></div><div class="field full"><label>سبب الحذف النهائي</label><textarea name="reason" required>حذف بيانات تجريبية والبدء من جديد</textarea></div></form>',[{label:'حذف نهائي لا يمكن التراجع عنه',className:'btn-red',action:async function(button){var form=document.getElementById('permanent-delete-form');if(!form.reportValidity())return;if(form.elements.confirmation.value.trim()!==expected){toast('اكتب نص التأكيد كما هو ظاهر',false);return;}button.disabled=true;try{await api('/'+v.id+'/permanent',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmation:form.elements.confirmation.value.trim(),reason:form.elements.reason.value.trim()})});closeModal();toast('تم حذف الزيارة التجريبية نهائيًا مع تسجيل العملية',true);loadArchive(1);await loadBootstrap();}catch(e){toast(e.message,false);button.disabled=false;}}}]); }

  document.getElementById('zip-form').addEventListener('submit', async function (event) { event.preventDefault(); var file = this.elements.file.files[0]; if (!file) return; var data = new FormData(); data.append('file', file); try { var preview = await api('/management/import/preview', { method: 'POST', body: data }); document.getElementById('zip-preview').innerHTML = '<div class="card"><h3>نتيجة المعاينة</h3><p>SHA-256: <code>' + esc(preview.sha256) + '</code></p><p>الملفات: ' + preview.files.map(esc).join('، ') + '</p><p>السجلات: ' + esc(JSON.stringify(preview.counts)) + '</p><button class="btn btn-green" id="zip-confirm">تأكيد الاستيراد</button></div>'; document.getElementById('zip-confirm').addEventListener('click', async function () { try { await api('/management/import/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ previewToken: preview.previewToken, sha256: preview.sha256 }) }); toast('تم الاستيراد بنجاح', true); document.getElementById('zip-preview').innerHTML = ''; await loadBootstrap(); } catch (e) { toast(e.message, false); } }); } catch (e) { toast(e.message, false); } });

  function fileData(file) { return new Promise(function (resolve, reject) { if (!file) return resolve(undefined); if (!/^image\/(?:png|jpeg)$/.test(file.type || '')) return reject(new Error('يجب اختيار صورة PNG أو JPEG')); if (file.size > 2 * 1024 * 1024) return reject(new Error('حجم الصورة يتجاوز 2 ميجابايت')); var reader = new FileReader(); reader.onload = function () { resolve(reader.result); }; reader.onerror = reject; reader.readAsDataURL(file); }); }
  function printTextBody(form) {
    var body = {};
    Object.keys(DEFAULT_VISIT_PRINT_TEXTS).forEach(function (field) { body[field] = form.elements[field].value.trim(); });
    return body;
  }
  document.getElementById('print-form').addEventListener('submit', async function (event) {
    event.preventDefault();
    var form = this, button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      var body = Object.assign({ signerTitle: form.elements.signerTitle.value.trim(), signerName: form.elements.signerName.value.trim() }, printTextBody(form));
      var stamp = await fileData(form.elements.stampFile.files[0]), signature = await fileData(form.elements.signatureFile.files[0]);
      if (stamp !== undefined) body.stamp = stamp;
      if (signature !== undefined) body.signature = signature;
      await api('/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      state.settings = await api('/settings');
      renderPrintSettings();
      form.elements.stampFile.value = '';
      form.elements.signatureFile.value = '';
      toast('تم حفظ بيانات الموقّع والنصوص والختم والتوقيع', true);
    } catch (e) { toast(e.message, false); }
    finally { button.disabled = false; }
  });
  async function removePrintAsset(field, label) { try { var body = {}; body[field] = ''; await api('/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); state.settings = await api('/settings'); renderPrintSettings(); toast('تمت إزالة ' + label, true); } catch (e) { toast(e.message, false); } }
  document.getElementById('remove-stamp').addEventListener('click', function () { removePrintAsset('stamp', 'الختم الإلكتروني'); });
  document.getElementById('remove-signature').addEventListener('click', function () { removePrintAsset('signature', 'التوقيع الإلكتروني'); });
  document.getElementById('reset-print-texts').addEventListener('click', function () {
    modal('استعادة النصوص الافتراضية', '<div class="note" style="background:#fff7ed;color:#9a3412;border-color:#fed7aa">سيتم استبدال النصوص المحفوظة بالنصوص الافتراضية. لن يتغير اسم الموقّع أو الختم أو التوقيع.</div>', [{ label: 'استعادة النصوص الافتراضية', className: 'btn-amber', action: async function (button) {
      button.disabled = true;
      try {
        await api('/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(DEFAULT_VISIT_PRINT_TEXTS) });
        state.settings = await api('/settings');
        renderPrintSettings();
        closeModal();
        toast('تمت استعادة نصوص التصريح الافتراضية', true);
      } catch (error) { button.disabled = false; toast(error.message, false); }
    } }]);
  });

  function scanMessage(message, ok) { var node = document.getElementById('camera-message'); node.textContent = message; node.className = 'scan-message ' + (ok ? 'success' : 'error'); }
  async function listCameras() { try { var devices = await navigator.mediaDevices.enumerateDevices(), cameras = devices.filter(function (x) { return x.kind === 'videoinput'; }); document.getElementById('camera-select').innerHTML = '<option value="">الكاميرا الافتراضية</option>' + cameras.map(function (camera, index) { return '<option value="' + esc(camera.deviceId) + '">' + esc(camera.label || ('كاميرا ' + (index + 1))) + '</option>'; }).join(''); } catch (_) {} }
  async function startCamera() { stopCamera(); if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { scanMessage('المتصفح لا يدعم تشغيل الكاميرا. استخدم البحث اليدوي برقم التصريح.', false); return; } var deviceId = document.getElementById('camera-select').value; try { state.stream = await navigator.mediaDevices.getUserMedia({ video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'environment' } }, audio: false }); var video = document.getElementById('camera-video'); video.srcObject = state.stream; video.style.display = 'block'; document.querySelector('.camera-frame').style.display = 'block'; document.getElementById('camera-placeholder').style.display = 'none'; document.getElementById('camera-start').disabled = true; document.getElementById('camera-stop').disabled = false; state.scanning = true; if ('BarcodeDetector' in window) { try { state.barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] }); } catch (_) { state.barcodeDetector = null; } } await listCameras(); scanFrame(); } catch (error) { scanMessage(error.name === 'NotAllowedError' ? 'تم رفض صلاحية الكاميرا. اسمح بها من إعدادات المتصفح أو استخدم رقم التصريح.' : 'تعذر تشغيل الكاميرا. استخدم البحث اليدوي برقم التصريح.', false); } }
  function stopCamera() { state.scanning = false; cancelAnimationFrame(state.scanLoop); if (state.stream) state.stream.getTracks().forEach(function (track) { track.stop(); }); state.stream = null; var video = document.getElementById('camera-video'); video.srcObject = null; video.style.display = 'none'; document.querySelector('.camera-frame').style.display = 'none'; document.getElementById('camera-placeholder').style.display = ''; document.getElementById('camera-start').disabled = false; document.getElementById('camera-stop').disabled = true; }
  async function scanFrame() { if (!state.scanning) return; var video = document.getElementById('camera-video'); try { if (video.readyState >= 2) { var value = null; if (state.barcodeDetector) { var codes = await state.barcodeDetector.detect(video); if (codes[0]) value = codes[0].rawValue; } else if (window.jsQR) { var canvas = document.getElementById('camera-canvas'), context = canvas.getContext('2d', { willReadFrequently: true }); canvas.width = video.videoWidth; canvas.height = video.videoHeight; context.drawImage(video, 0, 0); var image = context.getImageData(0, 0, canvas.width, canvas.height); var result = window.jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' }); if (result) value = result.data; } if (value) { stopCamera(); await verifyScannedValue(value); return; } } } catch (_) {} state.scanLoop = requestAnimationFrame(scanFrame); }
  function tokenFromValue(value) { var raw = String(value || '').trim(); if (/^NHC-NJ-VISIT:/i.test(raw)) return raw.slice(raw.indexOf(':') + 1).trim(); try { var url = new URL(raw, location.origin); return url.searchParams.get('visitQr') || url.searchParams.get('token') || (url.pathname.endsWith('/visit-permit-verify.html') && url.hash ? decodeURIComponent(url.hash.slice(1)) : '') || (url.pathname === '/api/visits/qr/verify-link' ? '' : raw); } catch (_) { return raw; } }
  async function verifyScannedValue(value) { var token = tokenFromValue(value); if (!token) { scanMessage('محتوى QR ليس تصريح زيارة صالحًا', false); return; } try { var result = await api('/qr/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: token }) }); scanMessage('تمت قراءة التصريح بنجاح', true); showScanResult(result); } catch (e) { scanMessage(e.message, false); } }
  async function downloadPermitFromScan(v) { if (!v || !v.canOpenFull || !v.id) { toast('تنزيل التصريح الكامل يتطلب صلاحية إدارة المركز', false); return; } try { await window.NajranVisitPermit.print(v.id); toast('تم تجهيز تصريح PDF', true); } catch (e) { toast(e.message || 'تعذر تجهيز تصريح PDF', false); } }
  function showScanResult(result) { var v = result.visit, fields = [['رقم التصريح',v.serialNumber],['الحالة',statusLabel(v.status)],['اسم الزائر',v.visitorName],['الشركة',v.company],['النظام / المشروع',v.system],['الموقع',v.site],['تاريخ الزيارة',dateOnlyText(v.startsAt || v.visitDate)],['التحقق من الإقامة',v.residenceVerified===undefined?null:(v.residenceVerified?'متحقق':'غير مكتمل')],['التحقق من الوثائق',v.documentsVerified===undefined?null:(v.documentsVerified?'متحقق':'غير مكتمل')],['سبب الإلغاء',v.cancellationReason],['سبب الاستثناء',v.exceptionReason]], buttons = []; if (v.canOpenFull && v.id) { buttons.push({label:'تنزيل تصريح PDF',className:'btn-green',action:function(){downloadPermitFromScan(v);}}); if (v.hasSignedPermit) buttons.push({label:'تنزيل النسخة المعتمدة',className:'btn-light',action:function(){downloadSignedPermit(v.id);}}); buttons.push({label:'فتح ملف الزيارة الكامل',className:'btn-primary',action:function(){closeModal();openVisitDetail(v.id);}}); } modal('نتيجة التحقق من التصريح','<div style="text-align:center;margin-bottom:14px">'+badge(v.status)+'</div><div class="detail-grid">'+fields.filter(function(x){return x[1]!==undefined&&x[1]!==null&&x[1]!=='';}).map(function(row){return '<div class="detail"><small>'+esc(row[0])+'</small><strong>'+esc(row[1])+'</strong></div>';}).join('')+'</div>'+representativesTableHtml(v.representatives),buttons); }
  function deepLinkParams() { var candidates = []; try { candidates.push(new URL(window.top.location.href)); } catch (_) {} try { candidates.push(new URL(window.location.href)); } catch (_) {} return candidates.map(function(url){return { token:url.searchParams.get('visitQr'), download:url.searchParams.get('download')==='1' };}).find(function(row){return row.token;}) || null; }
  async function handleQrDeepLink() { if (state.qrDeepLinkHandled) return; var params = deepLinkParams(); if (!params) return; state.qrDeepLinkHandled = true; var tab = document.querySelector('[data-tab="scan"]'); if (tab) tab.click(); try { var result = await api('/qr/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: params.token }) }); scanMessage('تم التحقق من التصريح بنجاح', true); showScanResult(result); if (params.download && result.visit && result.visit.canOpenFull) await downloadPermitFromScan(result.visit); } catch (e) { scanMessage(e.message, false); modal('تعذر التحقق من التصريح','<div class="note" style="background:#fef2f2;color:#991b1b;border-color:#fecaca">'+esc(e.message)+'</div>',[]); } }
  document.getElementById('camera-start').addEventListener('click', startCamera); document.getElementById('camera-stop').addEventListener('click', stopCamera); document.getElementById('camera-rescan').addEventListener('click', function(){scanMessage('جاهز للمسح مرة أخرى',true);startCamera();}); document.getElementById('camera-select').addEventListener('change', function(){if(state.stream)startCamera();});
  document.getElementById('manual-scan-form').addEventListener('submit', async function(event){event.preventDefault();try{var body=await api('/qr/manual?serialNumber='+encodeURIComponent(this.elements.serialNumber.value.trim()));showScanResult(body);}catch(e){scanMessage(e.message,false);}});
  document.querySelector('#manual-scan-form [name="serialNumber"]').placeholder = 'NHC-NJ-VIS-2026-07-00001';

  setInterval(keepSessionAlive, SESSION_KEEPALIVE_MS);
  window.addEventListener('focus', keepSessionAlive);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) keepSessionAlive(); });
  window.addEventListener('beforeunload', function () { saveUiState(); stopCamera(); });
  loadBootstrap();
})();
