(function () {
  'use strict';

  var state = { data: null, settings: null, archivePage: 1, archivePages: 1, stream: null, scanLoop: 0, scanning: false, barcodeDetector: null, qrDeepLinkHandled: false };

  function esc(value) { return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function formObject(form) { var out = {}; new FormData(form).forEach(function (value, key) { out[key] = typeof value === 'string' ? value.trim() : value; }); return out; }
  function dateText(value, time) { if (!value) return '—'; try { return new Date(value).toLocaleString('ar-SA', time ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }); } catch (_) { return String(value); } }
  function statusLabel(status) { return ({ active: 'سارية', expired: 'منتهية', cancelled: 'ملغاة', rejected: 'مرفوضة', pending: 'بانتظار الاعتماد', approved: 'معتمدة' })[status] || status || '—'; }
  function badge(status) { return '<span class="badge badge-' + esc(status) + '">' + esc(statusLabel(status)) + '</span>'; }
  function optionRows(rows, label, selected) { return '<option value="">اختر</option>' + (rows || []).map(function (row) { return '<option value="' + row.id + '"' + (String(row.id) === String(selected || '') ? ' selected' : '') + '>' + esc(label(row)) + '</option>'; }).join(''); }

  async function freshToken(force) {
    var getters = [window.najranGetFreshToken, window.parent && window.parent.najranGetFreshToken, window.top && window.top.najranGetFreshToken];
    for (var i = 0; i < getters.length; i++) if (typeof getters[i] === 'function') { try { var value = await getters[i](force ? { skipCache: true } : undefined); if (value) return value; } catch (_) {} }
    if (!force) try { var session = JSON.parse(localStorage.getItem('najran_session') || '{}'); if (session.clerkToken && Date.now() - Number(session.timestamp || 0) < 55000) return session.clerkToken; } catch (_) {}
    throw new Error('انتهت الجلسة؛ افتح المركز من الصفحة الرئيسية');
  }

  async function api(path, options, retried) {
    options = options || {};
    var token = await freshToken(!!retried);
    var headers = Object.assign({ Authorization: 'Bearer ' + token }, options.headers || {});
    var response = await fetch('/api/visits' + path, Object.assign({}, options, { headers: headers }));
    var body = await response.json().catch(function () { return {}; });
    if (response.status === 401 && !retried) return api(path, options, true);
    if (!response.ok) { var error = new Error(body.error || 'فشلت العملية'); error.status = response.status; throw error; }
    return body;
  }

  function toast(message, ok) {
    var node = document.getElementById('toast'); node.textContent = message; node.className = 'toast show ' + (ok ? 'ok' : 'err');
    clearTimeout(node._timer); node._timer = setTimeout(function () { node.className = 'toast'; }, 5000);
  }

  function modal(title, html, buttons) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = html;
    var foot = document.getElementById('modal-foot'); foot.innerHTML = '';
    (buttons || []).forEach(function (button) {
      var node = document.createElement('button'); node.type = 'button'; node.className = 'btn ' + (button.className || 'btn-light'); node.textContent = button.label;
      node.addEventListener('click', function () { button.action(node); }); foot.appendChild(node);
    });
    document.getElementById('app-modal').classList.add('open'); document.body.style.overflow = 'hidden';
  }
  function closeModal() { document.getElementById('app-modal').classList.remove('open'); document.body.style.overflow = ''; }
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('app-modal').addEventListener('click', function (event) { if (event.target === this) closeModal(); });

  document.getElementById('tabs').addEventListener('click', function (event) {
    var button = event.target.closest('[data-tab]'); if (!button) return;
    document.querySelectorAll('.tab').forEach(function (node) { node.classList.toggle('active', node === button); });
    document.querySelectorAll('.panel').forEach(function (node) { node.classList.toggle('active', node.dataset.panel === button.dataset.tab); });
    if (button.dataset.tab === 'archive') loadArchive(1);
    if (button.dataset.tab !== 'scan') stopCamera();
  });

  async function loadBootstrap() {
    try {
      var responses = await Promise.all([api('/management/bootstrap'), api('/settings')]);
      state.data = responses[0];
      state.settings = responses[1];
      renderAll();
      await handleQrDeepLink();
    } catch (error) {
      modal(error.status === 403 ? 'غير مصرح' : 'تعذر فتح المركز', '<div class="note" style="background:#fef2f2;color:#991b1b;border-color:#fecaca">' + esc(error.message) + '</div>', []);
      document.querySelectorAll('button,input,select,textarea').forEach(function (node) { if (!node.classList.contains('modal-close')) node.disabled = true; });
    }
  }

  function renderAll() {
    var data = state.data;
    document.getElementById('stat-pending').textContent = data.stats.pending;
    document.getElementById('stat-systems').textContent = data.stats.systems;
    document.getElementById('stat-contractors').textContent = data.stats.contractors;
    document.getElementById('stat-reps').textContent = data.stats.representatives;
    renderAlerts(data.alerts || []);
    renderPending(data.pending || []);
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

  function uniqueNamedRows(rows) {
    var seen = Object.create(null);
    return (rows || []).filter(function (row) { var key = String(row.name || '').trim().replace(/\s+/g, ' '); if (!key || seen[key]) return false; seen[key] = true; return true; });
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
  }

  function refreshDirectContractors() {
    var form = document.getElementById('direct-form'), systemId = Number(form.elements.systemId.value || 0), current = Number(form.elements.contractorId.value || 0), allowed = Object.create(null);
    var catalog = (state.data.approvedSubcontractors || []).find(function (row) { return row.systemId === systemId; });
    if (catalog) (catalog.contractors || []).forEach(function (row) { allowed[row.id] = true; });
    (state.data.qualifications || []).forEach(function (row) { if (row.status === 'active' && row.systemId === systemId) allowed[row.contractorId] = true; });
    var rows = uniqueNamedRows((state.data.contractors || []).filter(function (row) { return row.isActive && allowed[row.id]; }));
    form.elements.contractorId.innerHTML = optionRows(rows, function (row) { return row.name; }, current);
    refreshDirectRepresentatives();
  }

  function populateForms() {
    var d = state.data;
    var systems = uniqueNamedRows(d.systems.filter(function (x) { return x.isActive; })), contractors = uniqueNamedRows(d.contractors.filter(function (x) { return x.isActive; }));
    document.querySelectorAll('select[name="systemId"]').forEach(function (select) { var current = select.value; select.innerHTML = optionRows(systems, function (x) { return x.name; }, current); });
    document.querySelectorAll('select[name="contractorId"]').forEach(function (select) { var current = select.value; select.innerHTML = optionRows(contractors, function (x) { return x.name; }, current); });
    var maintenanceSelect = document.querySelector('#direct-form [name="maintenanceContractorKey"]'), maintenanceCurrent = maintenanceSelect.value;
    maintenanceSelect.innerHTML = '<option value="">اختر مقاول الصيانة</option>' + (d.maintenanceContractors || []).map(function (row) { return '<option value="' + esc(row.key) + '"' + (row.key === maintenanceCurrent ? ' selected' : '') + '>' + esc(row.name) + '</option>'; }).join('');
    var allSites = allMaintenanceSites(), approvalSite = document.getElementById('approval-site'), targetSite = document.querySelector('#copy-form [name="targetSite"]');
    approvalSite.innerHTML = siteOptions(allSites, approvalSite.value);
    targetSite.innerHTML = siteOptions(allSites, targetSite.value);
    var approvedSites = Array.from(new Set(d.siteApprovals.map(function (x) { return x.siteName; }))).filter(Boolean), sourceSite = document.querySelector('#copy-form [name="sourceSite"]');
    sourceSite.innerHTML = siteOptions(approvedSites, sourceSite.value);
    refreshDirectSites();
    refreshDirectContractors();
    var startInput = document.querySelector('#direct-form [name="startsAt"]');
    if (!startInput.value) { var start = new Date(); start.setMinutes(start.getMinutes() - start.getTimezoneOffset()); startInput.value = start.toISOString().slice(0, 16); }
  }

  function renderAssetPreview(id, value, emptyText) {
    var node = document.getElementById(id);
    node.innerHTML = value ? '<img src="' + esc(value) + '" alt="' + esc(emptyText) + '">' : esc(emptyText);
  }

  function renderPrintSettings() {
    var settings = state.settings || {}, form = document.getElementById('print-form');
    form.elements.signerTitle.value = settings.signerTitle || 'مشرف وحدة الصيانة العامة';
    form.elements.signerName.value = settings.signerName || settings.managerName || 'م. محمد عباس المكرمي';
    renderAssetPreview('stamp-preview', settings.stamp, 'لم يُرفع ختم إلكتروني');
    renderAssetPreview('signature-preview', settings.signature, 'لم يُرفع توقيع إلكتروني');
  }

  function renderCatalogLists() {
    var d = state.data;
    document.getElementById('systems-list').innerHTML = d.systems.map(function (x) { return '<div class="alert-row" style="background:#f8fafc;border-color:#e2e8f0;color:#334155"><span>' + esc(x.name) + '</span><button class="btn ' + (x.isActive ? 'btn-red' : 'btn-green') + '" data-toggle-system="' + x.id + '" data-active="' + x.isActive + '">' + (x.isActive ? 'إزالة من القوائم' : 'استعادة') + '</button></div>'; }).join('');
    document.getElementById('contractors-list').innerHTML = d.contractors.map(function (x) { return '<div class="alert-row" style="background:#f8fafc;border-color:#e2e8f0;color:#334155"><span>' + esc(x.name) + '</span><button class="btn ' + (x.isActive ? 'btn-red' : 'btn-green') + '" data-toggle-contractor="' + x.id + '" data-active="' + x.isActive + '">' + (x.isActive ? 'تعطيل' : 'تفعيل') + '</button></div>'; }).join('');
    document.getElementById('site-approvals-list').innerHTML = d.siteApprovals.length ? d.siteApprovals.map(function (approval) {
      var system = d.systems.find(function (x) { return x.id === approval.systemId; }), contractor = d.contractors.find(function (x) { return x.id === approval.contractorId; }), active = approval.status === 'active';
      return '<div class="alert-row" style="background:#f8fafc;border-color:#e2e8f0;color:#334155"><span><strong>' + esc(approval.siteName) + '</strong><small style="display:block">' + esc(system ? system.name : '') + ' — ' + esc(contractor ? contractor.name : '') + ' — حتى ' + esc(approval.validUntil) + '</small></span><button class="btn ' + (active ? 'btn-red' : 'btn-green') + '" data-toggle-approval="' + approval.id + '" data-active="' + active + '">' + (active ? 'تعطيل' : 'تفعيل') + '</button></div>';
    }).join('') : '<div class="empty">لا توجد اعتمادات مواقع</div>';
    document.getElementById('qualifications-list').innerHTML = d.qualifications.length ? d.qualifications.map(function (qualification) {
      var system = d.systems.find(function (x) { return x.id === qualification.systemId; }), contractor = d.contractors.find(function (x) { return x.id === qualification.contractorId; }), active = qualification.status === 'active';
      return '<div class="alert-row" style="background:#f8fafc;border-color:#e2e8f0;color:#334155"><span><strong>' + esc(contractor ? contractor.name : '') + '</strong><small style="display:block">' + esc(system ? system.name : '') + ' — حتى ' + esc(qualification.validUntil) + '</small></span><button class="btn ' + (active ? 'btn-red' : 'btn-green') + '" data-toggle-qualification="' + qualification.id + '" data-active="' + active + '">' + (active ? 'تعطيل' : 'تفعيل') + '</button></div>';
    }).join('') : '<div class="empty">لا توجد تأهيلات</div>';
    document.getElementById('reps-list').innerHTML = d.representatives.length ? d.representatives.map(function (rep) {
      var contractor = d.contractors.find(function (x) { return x.id === rep.contractorId; });
      var systemNames = d.representativeSystems.filter(function (link) { return link.representativeId === rep.id && link.isActive; }).map(function (link) { var s = d.systems.find(function (x) { return x.id === link.systemId; }); return s ? s.name : ''; }).filter(Boolean);
      return '<div class="card" style="margin-bottom:8px"><strong>' + esc(rep.fullName) + '</strong> ' + (rep.isActive ? badge('active') : badge('cancelled')) + '<small style="display:block;color:#64748b">' + esc(rep.identityMasked) + ' — ' + esc(contractor ? contractor.name : '') + '</small><div class="system-links">' + systemNames.map(function (name) { return '<span class="check-chip">' + esc(name) + '</span>'; }).join('') + '</div><div class="actions"><button class="btn btn-light" data-rep-systems="' + rep.id + '">ربط الأنظمة</button><button class="btn btn-light" data-upload-doc="representative:' + rep.id + '">رفع وثيقة</button><button class="btn ' + (rep.isActive ? 'btn-red' : 'btn-green') + '" data-toggle-rep="' + rep.id + '" data-active="' + rep.isActive + '">' + (rep.isActive ? 'تعطيل' : 'تفعيل') + '</button></div></div>';
    }).join('') : '<div class="empty">لا يوجد مندوبون</div>';
  }

  async function refresh() { await loadBootstrap(); toast('تم تحديث بيانات المركز', true); }
  document.querySelectorAll('[data-action="refresh"]').forEach(function (button) { button.addEventListener('click', refresh); });
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
    event.preventDefault(); var body = formObject(this); body.noResidenceException = this.elements.noResidenceException.checked;
    if (body.noResidenceException && !body.exceptionReason) { toast('سبب الاستثناء بدون إقامة مطلوب', false); return; }
    try { await api('/management/representatives', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); this.reset(); toast('تم حفظ المندوب', true); await loadBootstrap(); } catch (error) { toast(error.message, false); }
  });
  document.querySelector('#rep-form [name="noResidenceException"]').addEventListener('change', function () { var expiry = document.querySelector('#rep-form [name="residenceExpiresAt"]'), reason = document.querySelector('#rep-form [name="exceptionReason"]'); expiry.required = !this.checked; reason.required = this.checked; });

  document.addEventListener('click', async function (event) {
    var target = event.target.closest('[data-toggle-system],[data-toggle-contractor],[data-toggle-approval],[data-toggle-qualification],[data-toggle-rep],[data-rep-systems],[data-upload-doc],[data-download-doc],[data-disable-doc],[data-link],[data-reject],[data-preview],[data-visit-detail],[data-upload-signed],[data-download-signed]'); if (!target) return;
    try {
      if (target.dataset.toggleSystem) await toggleEntity('/management/systems/' + target.dataset.toggleSystem, target.dataset.active !== 'true');
      else if (target.dataset.toggleContractor) await toggleEntity('/management/contractors/' + target.dataset.toggleContractor, target.dataset.active !== 'true');
      else if (target.dataset.toggleApproval) await toggleStatus('/management/site-approvals/' + target.dataset.toggleApproval, target.dataset.active !== 'true');
      else if (target.dataset.toggleQualification) await toggleStatus('/management/qualifications/' + target.dataset.toggleQualification, target.dataset.active !== 'true');
      else if (target.dataset.toggleRep) await toggleEntity('/management/representatives/' + target.dataset.toggleRep, target.dataset.active !== 'true');
      else if (target.dataset.repSystems) openRepresentativeSystems(Number(target.dataset.repSystems));
      else if (target.dataset.uploadDoc) { var owner = target.dataset.uploadDoc.split(':'); openDocumentUpload(owner[0], Number(owner[1])); }
      else if (target.dataset.downloadDoc) downloadDocument(Number(target.dataset.downloadDoc), target.dataset.name || 'document');
      else if (target.dataset.disableDoc) openDisableDocument(Number(target.dataset.disableDoc));
      else if (target.dataset.uploadSigned) openSignedPermitUpload(Number(target.dataset.uploadSigned));
      else if (target.dataset.downloadSigned) downloadSignedPermit(Number(target.dataset.downloadSigned));
      else if (target.dataset.link) openLink(Number(target.dataset.link));
      else if (target.dataset.reject) openReject(Number(target.dataset.reject));
      else if (target.dataset.preview) window.NajranVisitPermit.preview(Number(target.dataset.preview)).catch(window.NajranVisitPermit.showError);
      else if (target.dataset.visitDetail) openVisitDetail(Number(target.dataset.visitDetail));
    } catch (error) { toast(error.message, false); }
  });

  async function toggleEntity(path, isActive) { await api(path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: isActive }) }); toast(isActive ? 'تم التفعيل' : 'تم التعطيل دون حذف', true); await loadBootstrap(); }
  async function toggleStatus(path, active) { await api(path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: active ? 'active' : 'disabled' }) }); toast(active ? 'تم التفعيل' : 'تم التعطيل دون حذف', true); await loadBootstrap(); }

  function openRepresentativeSystems(repId) {
    var links = state.data.representativeSystems.filter(function (x) { return x.representativeId === repId && x.isActive; }).map(function (x) { return x.systemId; });
    modal('ربط المندوب بالأنظمة', '<div class="system-links">' + state.data.systems.filter(function (x) { return x.isActive; }).map(function (system) { return '<label class="check-chip"><input type="checkbox" name="rep-system" value="' + system.id + '"' + (links.includes(system.id) ? ' checked' : '') + '> ' + esc(system.name) + '</label>'; }).join('') + '</div>', [{ label: 'حفظ الربط', className: 'btn-green', action: async function () { var ids = Array.from(document.querySelectorAll('input[name="rep-system"]:checked')).map(function (x) { return Number(x.value); }); try { await api('/management/representatives/' + repId + '/systems', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ systemIds: ids }) }); closeModal(); toast('تم حفظ ربط الأنظمة', true); await loadBootstrap(); } catch (e) { toast(e.message, false); } } }]);
  }

  function openDocumentUpload(ownerType, ownerId) {
    modal('رفع وثيقة محمية', '<form id="document-form" class="form-grid"><div class="field"><label>نوع الوثيقة</label><select name="documentType" required><option value="identity">الهوية / الإقامة</option><option value="residence">إثبات الإقامة</option><option value="qualification">مستند التأهيل</option><option value="other">مستند آخر</option></select></div><div class="field"><label>الملف</label><input type="file" name="file" accept="application/pdf,image/png,image/jpeg" required></div><div class="field full"><div class="note">لن يظهر محتوى الملف في القوائم أو نتيجة مسح QR.</div></div></form>', [{ label: 'رفع وحفظ', className: 'btn-green', action: async function (button) { var form = document.getElementById('document-form'), file = form.elements.file.files[0]; if (!file) { toast('اختر الملف', false); return; } var data = new FormData(); data.append('ownerType', ownerType); data.append('ownerId', ownerId); data.append('documentType', form.elements.documentType.value); data.append('file', file); button.disabled = true; try { await api('/management/documents', { method: 'POST', body: data }); closeModal(); toast('تم حفظ الوثيقة مع الاحتفاظ بتاريخ البدائل', true); } catch (e) { toast(e.message, false); button.disabled = false; } } }]);
  }

  async function downloadDocument(id, name) {
    try { var token = await freshToken(), response = await fetch('/api/visits/management/documents/' + id + '/content', { headers: { Authorization: 'Bearer ' + token } }); if (!response.ok) { var body = await response.json().catch(function(){return{};}); throw new Error(body.error || 'تعذر تنزيل الوثيقة'); } var blob = await response.blob(), url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(function(){URL.revokeObjectURL(url);},1000); } catch (e) { toast(e.message, false); }
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
    var d = state.data, start = visit.startsAt ? new Date(visit.startsAt).toISOString().slice(0, 16) : new Date(String(visit.visitDate) + 'T08:00:00').toISOString().slice(0, 16), end = visit.endsAt ? new Date(visit.endsAt).toISOString().slice(0, 16) : '';
    return '<form id="link-form" class="form-grid"><div class="field"><label>النظام</label><select name="systemId" required>' + optionRows(d.systems.filter(function(x){return x.isActive;}),function(x){return x.name;}) + '</select></div><div class="field"><label>الشركة</label><select name="contractorId" required>' + optionRows(d.contractors.filter(function(x){return x.isActive;}),function(x){return x.name;}) + '</select></div><div class="field"><label>المندوب</label><select name="representativeId" required>' + optionRows(d.representatives.filter(function(x){return x.isActive;}),function(x){return x.fullName+' — '+x.identityMasked;}) + '</select></div><div class="field"><label>اعتماد الموقع</label><select name="siteApprovalId" required>' + optionRows(d.siteApprovals.filter(function(x){return x.status==='active';}),function(x){return x.siteName+' #'+x.id;}) + '</select></div><div class="field"><label>التأهيل</label><select name="qualificationId" required>' + optionRows(d.qualifications.filter(function(x){return x.status==='active';}),function(x){return 'تأهيل #'+x.id;}) + '</select></div><div class="field"><label>تاريخ ووقت الزيارة</label><input type="datetime-local" name="startsAt" value="' + esc(start) + '" required></div><div class="field"><label>نهاية الزيارة (اختياري)</label><input type="datetime-local" name="endsAt" value="' + esc(end) + '"></div><div class="field full"><label>الغرض من الزيارة</label><textarea name="purpose" required>' + esc(visit.purpose || '') + '</textarea></div></form>';
  }
  function openLink(id) { var visit = state.data.pending.find(function (x) { return x.id === id; }); if (!visit) return; modal('ربط الطلب واعتماده', linkFormHtml(visit), [{ label: 'حفظ الربط واعتماد التصريح', className: 'btn-green', action: async function (button) { button.disabled = true; try { var body = formObject(document.getElementById('link-form')); body.startsAt = new Date(body.startsAt).toISOString(); body.endsAt = body.endsAt ? new Date(body.endsAt).toISOString() : null; await api('/' + id + '/link', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); await api('/' + id + '/status', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'approved' }) }); closeModal(); toast('تم الربط والاعتماد وإصدار رقم جديد', true); await loadBootstrap(); } catch (e) { toast(e.message, false); button.disabled = false; } } }]); }
  function openReject(id) { modal('رفض طلب الزيارة', '<div class="field"><label>سبب الرفض</label><textarea id="reject-note" required></textarea></div>', [{ label: 'تأكيد الرفض', className: 'btn-red', action: async function (button) { var note = document.getElementById('reject-note').value.trim(); if (!note) { toast('سبب الرفض مطلوب', false); return; } button.disabled = true; try { await api('/' + id + '/status', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'rejected', adminNotes: note }) }); closeModal(); toast('تم رفض الطلب دون حذفه', true); await loadBootstrap(); } catch (e) { toast(e.message, false); button.disabled = false; } } }]); }

  function refreshDirectRepresentatives() {
    var form = document.getElementById('direct-form'), contractorId = Number(form.elements.contractorId.value || 0), systemId = Number(form.elements.systemId.value || 0);
    var reps = (state.data ? state.data.representatives : []).filter(function (rep) { return rep.isActive && rep.contractorId === contractorId && state.data.representativeSystems.some(function (link) { return link.isActive && link.representativeId === rep.id && link.systemId === systemId; }); });
    form.elements.representativeId.innerHTML = optionRows(reps, function (x) { return x.fullName + ' — ' + x.identityMasked; });
  }
  document.querySelector('#direct-form [name="maintenanceContractorKey"]').addEventListener('change', refreshDirectSites); document.querySelector('#direct-form [name="contractorId"]').addEventListener('change', refreshDirectRepresentatives); document.querySelector('#direct-form [name="systemId"]').addEventListener('change', refreshDirectContractors);
  document.getElementById('direct-form').addEventListener('submit', async function (event) {
    event.preventDefault(); var body = formObject(this); body.systemId = Number(body.systemId); body.contractorId = Number(body.contractorId); body.representativeId = Number(body.representativeId); body.startsAt = new Date(body.startsAt).toISOString(); body.endsAt = body.endsAt ? new Date(body.endsAt).toISOString() : null;
    var approval = state.data.siteApprovals.find(function (x) { return x.status === 'active' && x.siteName === body.siteName && x.systemId === body.systemId && x.contractorId === body.contractorId; }); var qualification = state.data.qualifications.find(function (x) { return x.status === 'active' && x.systemId === body.systemId && x.contractorId === body.contractorId; });
    if (!approval || !qualification) { toast('لا يوجد اعتماد موقع وتأهيل ساريان للاختيار الحالي', false); return; } body.siteApprovalId = approval.id; body.qualificationId = qualification.id;
    try { var result = await api('/management/direct-issue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); toast('تم إصدار التصريح رقم ' + result.visit.serialNumber, true); await loadBootstrap(); window.NajranVisitPermit.preview(result.visit.id).catch(window.NajranVisitPermit.showError); } catch (e) { toast(e.message, false); }
  });

  document.getElementById('copy-form').addEventListener('submit', async function (event) { event.preventDefault(); var body = formObject(this); try { var preview = await api('/management/copy-site/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); var html = preview.rows.length ? '<div class="note">راجع الصفوف وحدد المطلوب نسخه إلى «' + esc(preview.targetSite) + '».</div><div class="system-links" style="margin-top:12px">' + preview.rows.map(function (row) { return '<label class="check-chip"><input type="checkbox" name="copy-approval" value="' + row.id + '" checked> ' + esc(row.systemName) + ' — ' + esc(row.contractorName) + '</label>'; }).join('') + '</div>' : '<div class="empty">لا توجد اعتمادات في الموقع المصدر</div>'; modal('مراجعة نسخ إعدادات الموقع', html, preview.rows.length ? [{ label: 'تأكيد النسخ', className: 'btn-green', action: async function () { var ids = Array.from(document.querySelectorAll('input[name="copy-approval"]:checked')).map(function (x) { return Number(x.value); }); try { await api('/management/copy-site/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceSite: preview.sourceSite, targetSite: preview.targetSite, approvalIds: ids }) }); closeModal(); toast('تم نسخ الاعتمادات بعد المراجعة', true); await loadBootstrap(); } catch (e) { toast(e.message, false); } } }] : []); } catch (e) { toast(e.message, false); } });

  document.getElementById('archive-filter').addEventListener('submit', function (event) { event.preventDefault(); loadArchive(1); }); document.getElementById('archive-prev').addEventListener('click', function () { if (state.archivePage > 1) loadArchive(state.archivePage - 1); }); document.getElementById('archive-next').addEventListener('click', function () { if (state.archivePage < state.archivePages) loadArchive(state.archivePage + 1); });
  async function loadArchive(page) { try { var params = new URLSearchParams(); var fields = formObject(document.getElementById('archive-filter')); Object.keys(fields).forEach(function (key) { if (fields[key]) params.set(key, fields[key]); }); params.set('page', page); params.set('limit', 25); var body = await api('/management/archive?' + params.toString()); state.archivePage = body.page; state.archivePages = Math.max(1, body.pages || 1); document.getElementById('archive-page').textContent = state.archivePage + ' / ' + state.archivePages; document.getElementById('archive-prev').disabled = state.archivePage <= 1; document.getElementById('archive-next').disabled = state.archivePage >= state.archivePages; document.getElementById('archive-body').innerHTML = body.visits.length ? body.visits.map(function (v) { return '<tr><td>' + esc(v.serialNumber || '—') + '</td><td>' + esc(v.repName) + '</td><td>' + esc(v.subContractor) + '</td><td>' + esc(v.systemName) + '</td><td>' + esc(v.siteLocation) + '</td><td>' + badge(v.effectiveStatus) + '</td><td>' + dateText(v.visitDate) + '</td><td><button class="btn btn-light" data-visit-detail="' + v.id + '">فتح</button></td></tr>'; }).join('') : '<tr><td colspan="8" class="empty">لا توجد نتائج</td></tr>'; } catch (e) { toast(e.message, false); } }

  async function openVisitDetail(id) { try { var body = await api('/' + id), v = body.visit; var details = [['رقم التصريح',v.serialNumber],['الحالة',statusLabel(v.effectiveStatus)],['الزائر',v.repName],['الهوية / الإقامة',v.repIdMasked],['مقاول الصيانة',v.mainContractor],['مقاول الباطن',v.subContractor],['النظام',v.systemName],['الموقع',v.siteLocation],['الغرض',v.purpose],['البداية',dateText(v.startsAt,true)],['النهاية',dateText(v.endsAt,true)],['سبب الإلغاء',v.cancelledReason]], documents = body.documents || []; var docHtml = '<div class="card" style="margin-top:12px"><h3>الوثائق</h3>' + (documents.length ? documents.map(function(doc){var disable=doc.status==='active'?'<button class="btn btn-red" data-disable-doc="'+doc.id+'">تعطيل</button>':'';return '<div class="alert-row" style="background:#f8fafc;border-color:#e2e8f0;color:#334155"><span>'+esc(doc.documentType)+' — '+esc(doc.originalName)+' '+badge(doc.status==='active'?'active':'cancelled')+'</span><span class="actions"><button class="btn btn-light" data-download-doc="'+doc.id+'" data-name="'+esc(doc.originalName)+'">تنزيل محمي</button>'+disable+'</span></div>';}).join('') : '<div class="empty">لا توجد وثائق مرتبطة بالزيارة</div>') + '</div>'; var buttons = [{ label:'رفع التصريح المعتمد',className:'btn-green',action:function(){openSignedPermitUpload(id);} },{ label:'رفع وثيقة',className:'btn-light',action:function(){openDocumentUpload('visit',id);} },{ label:'معاينة التصريح وQR',className:'btn-primary',action:function(){window.NajranVisitPermit.preview(id).catch(window.NajranVisitPermit.showError);} }]; if (v.hasSignedPermit) buttons.push({ label:'تنزيل التصريح المعتمد',className:'btn-light',action:function(){downloadSignedPermit(id);} }); buttons.push({ label:'إعادة إصدار',className:'btn-green',action:function(){openReissue(v);} },{ label:'إلغاء الزيارة',className:'btn-red',action:function(){openCancel(v);} }); modal('ملف الزيارة', '<div class="detail-grid">' + details.filter(function(x){return x[1];}).map(function (row) { return '<div class="detail"><small>' + esc(row[0]) + '</small><strong>' + esc(row[1]) + '</strong></div>'; }).join('') + '</div>' + docHtml, buttons); } catch (e) { toast(e.message,false); } }
  function openReissue(v) { var start = new Date(Date.now()+86400000); start.setHours(8,0,0,0); modal('إعادة إصدار زيارة برقم جديد','<form id="reissue-form" class="form-grid"><div class="field"><label>تاريخ ووقت الزيارة</label><input type="datetime-local" name="startsAt" value="'+start.toISOString().slice(0,16)+'" required></div><div class="field"><label>نهاية الزيارة (اختياري)</label><input type="datetime-local" name="endsAt"></div><div class="field full"><label>الغرض</label><textarea name="purpose" required>'+esc(v.purpose||'')+'</textarea></div></form>',[{label:'إنشاء تصريح جديد',className:'btn-green',action:async function(){var body=formObject(document.getElementById('reissue-form'));body.startsAt=new Date(body.startsAt).toISOString();body.endsAt=body.endsAt?new Date(body.endsAt).toISOString():null;try{var result=await api('/'+v.id+'/reissue',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});closeModal();toast('تم إنشاء تصريح جديد مع الحفاظ على الأصل',true);loadArchive(state.archivePage);window.NajranVisitPermit.preview(result.visit.id).catch(window.NajranVisitPermit.showError);}catch(e){toast(e.message,false);}}}]); }
  function openCancel(v) { modal('إلغاء الزيارة دون حذفها','<div class="field"><label>سبب الإلغاء</label><textarea id="cancel-reason" required></textarea></div>',[{label:'تأكيد الإلغاء',className:'btn-red',action:async function(){var reason=document.getElementById('cancel-reason').value.trim();if(!reason){toast('سبب الإلغاء مطلوب',false);return;}try{await api('/'+v.id+'/cancel',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason:reason})});closeModal();toast('تم إلغاء الزيارة مع الاحتفاظ بسجلها',true);loadArchive(state.archivePage);await loadBootstrap();}catch(e){toast(e.message,false);}}}]); }

  document.getElementById('zip-form').addEventListener('submit', async function (event) { event.preventDefault(); var file = this.elements.file.files[0]; if (!file) return; var data = new FormData(); data.append('file', file); try { var preview = await api('/management/import/preview', { method: 'POST', body: data }); document.getElementById('zip-preview').innerHTML = '<div class="card"><h3>نتيجة المعاينة</h3><p>SHA-256: <code>' + esc(preview.sha256) + '</code></p><p>الملفات: ' + preview.files.map(esc).join('، ') + '</p><p>السجلات: ' + esc(JSON.stringify(preview.counts)) + '</p><button class="btn btn-green" id="zip-confirm">تأكيد الاستيراد</button></div>'; document.getElementById('zip-confirm').addEventListener('click', async function () { try { await api('/management/import/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ previewToken: preview.previewToken, sha256: preview.sha256 }) }); toast('تم الاستيراد بنجاح', true); document.getElementById('zip-preview').innerHTML = ''; await loadBootstrap(); } catch (e) { toast(e.message, false); } }); } catch (e) { toast(e.message, false); } });

  function fileData(file) { return new Promise(function (resolve, reject) { if (!file) return resolve(undefined); if (!/^image\/(?:png|jpeg)$/.test(file.type || '')) return reject(new Error('يجب اختيار صورة PNG أو JPEG')); if (file.size > 2 * 1024 * 1024) return reject(new Error('حجم الصورة يتجاوز 2 ميجابايت')); var reader = new FileReader(); reader.onload = function () { resolve(reader.result); }; reader.onerror = reject; reader.readAsDataURL(file); }); }
  document.getElementById('print-form').addEventListener('submit', async function (event) { event.preventDefault(); try { var body = { signerTitle: this.elements.signerTitle.value.trim(), signerName: this.elements.signerName.value.trim() }, stamp = await fileData(this.elements.stampFile.files[0]), signature = await fileData(this.elements.signatureFile.files[0]); if (stamp !== undefined) body.stamp = stamp; if (signature !== undefined) body.signature = signature; await api('/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); state.settings = await api('/settings'); renderPrintSettings(); this.elements.stampFile.value = ''; this.elements.signatureFile.value = ''; toast('تم حفظ بيانات الموقّع والختم والتوقيع', true); } catch (e) { toast(e.message, false); } });
  async function removePrintAsset(field, label) { try { var body = {}; body[field] = ''; await api('/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); state.settings = await api('/settings'); renderPrintSettings(); toast('تمت إزالة ' + label, true); } catch (e) { toast(e.message, false); } }
  document.getElementById('remove-stamp').addEventListener('click', function () { removePrintAsset('stamp', 'الختم الإلكتروني'); });
  document.getElementById('remove-signature').addEventListener('click', function () { removePrintAsset('signature', 'التوقيع الإلكتروني'); });

  function scanMessage(message, ok) { var node = document.getElementById('camera-message'); node.textContent = message; node.className = 'scan-message ' + (ok ? 'success' : 'error'); }
  async function listCameras() { try { var devices = await navigator.mediaDevices.enumerateDevices(), cameras = devices.filter(function (x) { return x.kind === 'videoinput'; }); document.getElementById('camera-select').innerHTML = '<option value="">الكاميرا الافتراضية</option>' + cameras.map(function (camera, index) { return '<option value="' + esc(camera.deviceId) + '">' + esc(camera.label || ('كاميرا ' + (index + 1))) + '</option>'; }).join(''); } catch (_) {} }
  async function startCamera() { stopCamera(); if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { scanMessage('المتصفح لا يدعم تشغيل الكاميرا. استخدم البحث اليدوي برقم التصريح.', false); return; } var deviceId = document.getElementById('camera-select').value; try { state.stream = await navigator.mediaDevices.getUserMedia({ video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'environment' } }, audio: false }); var video = document.getElementById('camera-video'); video.srcObject = state.stream; video.style.display = 'block'; document.querySelector('.camera-frame').style.display = 'block'; document.getElementById('camera-placeholder').style.display = 'none'; document.getElementById('camera-start').disabled = true; document.getElementById('camera-stop').disabled = false; state.scanning = true; if ('BarcodeDetector' in window) { try { state.barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] }); } catch (_) { state.barcodeDetector = null; } } await listCameras(); scanFrame(); } catch (error) { scanMessage(error.name === 'NotAllowedError' ? 'تم رفض صلاحية الكاميرا. اسمح بها من إعدادات المتصفح أو استخدم رقم التصريح.' : 'تعذر تشغيل الكاميرا. استخدم البحث اليدوي برقم التصريح.', false); } }
  function stopCamera() { state.scanning = false; cancelAnimationFrame(state.scanLoop); if (state.stream) state.stream.getTracks().forEach(function (track) { track.stop(); }); state.stream = null; var video = document.getElementById('camera-video'); video.srcObject = null; video.style.display = 'none'; document.querySelector('.camera-frame').style.display = 'none'; document.getElementById('camera-placeholder').style.display = ''; document.getElementById('camera-start').disabled = false; document.getElementById('camera-stop').disabled = true; }
  async function scanFrame() { if (!state.scanning) return; var video = document.getElementById('camera-video'); try { if (video.readyState >= 2) { var value = null; if (state.barcodeDetector) { var codes = await state.barcodeDetector.detect(video); if (codes[0]) value = codes[0].rawValue; } else if (window.jsQR) { var canvas = document.getElementById('camera-canvas'), context = canvas.getContext('2d', { willReadFrequently: true }); canvas.width = video.videoWidth; canvas.height = video.videoHeight; context.drawImage(video, 0, 0); var image = context.getImageData(0, 0, canvas.width, canvas.height); var result = window.jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' }); if (result) value = result.data; } if (value) { stopCamera(); await verifyScannedValue(value); return; } } } catch (_) {} state.scanLoop = requestAnimationFrame(scanFrame); }
  function tokenFromValue(value) { try { var url = new URL(value, location.origin); return url.searchParams.get('visitQr') || url.searchParams.get('token') || (url.pathname === '/api/visits/qr/verify-link' ? '' : value); } catch (_) { return value; } }
  async function verifyScannedValue(value) { var token = tokenFromValue(value); if (!token) { scanMessage('محتوى QR ليس تصريح زيارة صالحًا', false); return; } try { var result = await api('/qr/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: token }) }); scanMessage('تمت قراءة التصريح بنجاح', true); showScanResult(result); } catch (e) { scanMessage(e.message, false); } }
  async function downloadPermitFromScan(v) { if (!v || !v.canOpenFull || !v.id) { toast('تنزيل التصريح الكامل يتطلب صلاحية إدارة المركز', false); return; } try { await window.NajranVisitPermit.print(v.id); toast('تم تجهيز تصريح PDF', true); } catch (e) { toast(e.message || 'تعذر تجهيز تصريح PDF', false); } }
  function showScanResult(result) { var v = result.visit, fields = [['رقم التصريح',v.serialNumber],['الحالة',statusLabel(v.status)],['اسم الزائر',v.visitorName],['الهوية / الإقامة',v.repIdMasked],['الشركة',v.company],['النظام / المشروع',v.system],['الموقع',v.site],['الغرض',v.purpose],['تاريخ الزيارة',dateText(v.visitDate)],['البداية',dateText(v.startsAt,true)],['النهاية',dateText(v.endsAt,true)],['المندوب',v.representativeName],['التحقق من الإقامة',v.residenceVerified===undefined?null:(v.residenceVerified?'متحقق':'غير مكتمل')],['التحقق من الوثائق',v.documentsVerified===undefined?null:(v.documentsVerified?'متحقق':'غير مكتمل')],['سبب الإلغاء',v.cancellationReason],['سبب الاستثناء',v.exceptionReason]], buttons = []; if (v.canOpenFull && v.id) { buttons.push({label:'تنزيل تصريح PDF',className:'btn-green',action:function(){downloadPermitFromScan(v);}}); if (v.hasSignedPermit) buttons.push({label:'تنزيل النسخة المعتمدة',className:'btn-light',action:function(){downloadSignedPermit(v.id);}}); buttons.push({label:'فتح ملف الزيارة الكامل',className:'btn-primary',action:function(){closeModal();openVisitDetail(v.id);}}); } modal('نتيجة التحقق من التصريح','<div style="text-align:center;margin-bottom:14px">'+badge(v.status)+'</div><div class="detail-grid">'+fields.filter(function(x){return x[1]!==undefined&&x[1]!==null&&x[1]!=='';}).map(function(row){return '<div class="detail"><small>'+esc(row[0])+'</small><strong>'+esc(row[1])+'</strong></div>';}).join('')+'</div>',buttons); }
  function deepLinkParams() { var candidates = []; try { candidates.push(new URL(window.top.location.href)); } catch (_) {} try { candidates.push(new URL(window.location.href)); } catch (_) {} return candidates.map(function(url){return { token:url.searchParams.get('visitQr'), download:url.searchParams.get('download')==='1' };}).find(function(row){return row.token;}) || null; }
  async function handleQrDeepLink() { if (state.qrDeepLinkHandled) return; var params = deepLinkParams(); if (!params) return; state.qrDeepLinkHandled = true; var tab = document.querySelector('[data-tab="scan"]'); if (tab) tab.click(); try { var result = await api('/qr/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: params.token }) }); scanMessage('تم التحقق من التصريح بنجاح', true); showScanResult(result); if (params.download && result.visit && result.visit.canOpenFull) await downloadPermitFromScan(result.visit); } catch (e) { scanMessage(e.message, false); modal('تعذر التحقق من التصريح','<div class="note" style="background:#fef2f2;color:#991b1b;border-color:#fecaca">'+esc(e.message)+'</div>',[]); } }
  document.getElementById('camera-start').addEventListener('click', startCamera); document.getElementById('camera-stop').addEventListener('click', stopCamera); document.getElementById('camera-rescan').addEventListener('click', function(){scanMessage('جاهز للمسح مرة أخرى',true);startCamera();}); document.getElementById('camera-select').addEventListener('change', function(){if(state.stream)startCamera();});
  document.getElementById('manual-scan-form').addEventListener('submit', async function(event){event.preventDefault();try{var body=await api('/qr/manual?serialNumber='+encodeURIComponent(this.elements.serialNumber.value.trim()));showScanResult(body);}catch(e){scanMessage(e.message,false);}});

  window.addEventListener('beforeunload', stopCamera);
  loadBootstrap();
})();
