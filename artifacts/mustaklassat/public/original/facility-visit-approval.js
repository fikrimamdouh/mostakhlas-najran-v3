(function () {
  'use strict';

  var state = { page: 1, pages: 1, lastVisitId: null };
  var refreshPromise = null;

  function esc(value) { return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function dateText(value, withTime) { if (!value) return '—'; var date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? value + 'T12:00:00Z' : value); if (Number.isNaN(date.getTime())) return String(value); return date.toLocaleString('ar-SA', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }); }
  function permitLabel(status) { return ({ active:'سارية', approved:'معتمدة من المركز', cancelled:'ملغاة', expired:'منتهية', rejected:'مرفوضة', pending:'بانتظار اعتماد المركز' })[status] || status || '—'; }
  function facilityLabel(status) { return ({ pending:'بانتظار قرار المنشأة', approved:'معتمدة من المنشأة', rejected:'مرفوضة من المنشأة' })[status] || 'بانتظار قرار المنشأة'; }
  function badge(status, label) { return '<span class="badge badge-' + esc(status || 'pending') + '">' + esc(label) + '</span>'; }

  function toast(message, ok) {
    var node = document.getElementById('toast');
    node.textContent = message; node.className = 'toast show ' + (ok ? 'ok' : 'err');
    clearTimeout(node._timer); node._timer = setTimeout(function () { node.className = 'toast'; }, 6500);
  }

  function tokenGetters() {
    var scopes = [], seen = [];
    [window.parent, window.top, window].forEach(function (scope) { try { var fn = scope && scope.najranGetFreshToken; if (typeof fn === 'function' && seen.indexOf(fn) === -1) { seen.push(fn); scopes.push({ scope:scope, fn:fn }); } } catch (_) {} });
    return scopes;
  }

  function requestParentToken(force) {
    return new Promise(function (resolve) {
      if (!window.parent || window.parent === window) return resolve(null);
      var requestId = 'facility-' + Date.now() + '-' + Math.random().toString(36).slice(2), settled = false;
      function finish(token) { if (settled) return; settled = true; clearTimeout(timer); window.removeEventListener('message', receive); resolve(typeof token === 'string' && token.trim() ? token.trim() : null); }
      function receive(event) { if (event.origin !== location.origin || event.source !== window.parent || !event.data || event.data.type !== 'NAJRAN_TOKEN_RESPONSE' || event.data.requestId !== requestId) return; finish(event.data.token); }
      var timer = setTimeout(function () { finish(null); }, 10000);
      window.addEventListener('message', receive);
      try { window.parent.postMessage({ type:'NAJRAN_TOKEN_REQUEST', requestId:requestId, skipCache:!!force }, location.origin); } catch (_) { finish(null); }
    });
  }

  async function freshToken(force) {
    var getters = tokenGetters();
    for (var i = 0; i < getters.length; i++) {
      try {
        var token = await Promise.race([
          Promise.resolve(getters[i].fn.call(getters[i].scope, force ? { skipCache:true } : undefined)),
          new Promise(function (_, reject) { setTimeout(function () { reject(new Error('TOKEN_TIMEOUT')); }, 8000); }),
        ]);
        if (typeof token === 'string' && token.trim()) return token.trim();
      } catch (_) {}
    }
    var bridged = await requestParentToken(!!force);
    if (bridged) return bridged;
    if (!force) try { var session = JSON.parse(localStorage.getItem('najran_session') || '{}'); if (session.clerkToken && Date.now() - Number(session.timestamp || 0) < 55000) return session.clerkToken; } catch (_) {}
    throw new Error('انتهت جلسة الدخول؛ اضغط «تحديث آمن» ثم أعد المحاولة');
  }

  async function refreshedToken() {
    if (refreshPromise) return refreshPromise;
    refreshPromise = freshToken(true);
    try { return await refreshPromise; } finally { refreshPromise = null; }
  }

  async function api(path, options, retried) {
    options = options || {};
    var token = retried ? await refreshedToken() : await freshToken(false);
    var response = await fetch('/api/visits' + path, Object.assign({}, options, {
      headers: Object.assign({ Authorization:'Bearer ' + token }, options.headers || {}),
      credentials:'same-origin', cache:'no-store',
    }));
    var body = await response.json().catch(function () { return {}; });
    if (response.status === 401 && !retried) return api(path, options, true);
    if (!response.ok) { var error = new Error(body.error || 'تعذر تنفيذ العملية'); error.status = response.status; throw error; }
    return body;
  }

  function closeModal() { document.getElementById('modal').classList.remove('open'); }
  function modal(title, html, buttons) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = html;
    var foot = document.getElementById('modal-foot'); foot.innerHTML = '';
    (buttons || []).forEach(function (item) { var button = document.createElement('button'); button.type = 'button'; button.className = 'btn ' + (item.className || 'btn-light'); button.textContent = item.label; button.addEventListener('click', function () { item.action(button); }); foot.appendChild(button); });
    document.getElementById('modal').classList.add('open');
  }

  function detailRows(rows) {
    return '<div class="detail-grid">' + rows.filter(function (row) { return row[1] !== null && row[1] !== undefined && row[1] !== ''; }).map(function (row) { return '<div class="detail"><small>' + esc(row[0]) + '</small><strong>' + esc(row[1]) + '</strong></div>'; }).join('') + '</div>';
  }

  async function loadVisits(page) {
    var form = document.getElementById('filters'), params = new URLSearchParams();
    params.set('page', page || 1); params.set('limit', 20);
    if (form.elements.status.value) params.set('status', form.elements.status.value);
    if (form.elements.search.value.trim()) params.set('search', form.elements.search.value.trim());
    try {
      var body = await api('/facility/visits?' + params.toString());
      state.page = body.page; state.pages = Math.max(1, body.pages || 1);
      document.getElementById('site-name').textContent = body.siteName || 'غير محدد';
      document.getElementById('page-label').textContent = state.page + ' / ' + state.pages;
      document.getElementById('prev').disabled = state.page <= 1; document.getElementById('next').disabled = state.page >= state.pages;
      document.getElementById('count-pending').textContent = body.summary && body.summary.pending || 0;
      document.getElementById('count-approved').textContent = body.summary && body.summary.approved || 0;
      document.getElementById('count-rejected').textContent = body.summary && body.summary.rejected || 0;
      document.getElementById('visits-body').innerHTML = body.visits.length ? body.visits.map(function (visit) {
        var facilityStatus = visit.facilityApproval && visit.facilityApproval.status || 'pending';
        return '<tr><td><strong>' + esc(visit.serialNumber || '—') + '</strong></td><td>' + esc(visit.repName) + '</td><td>' + esc(visit.subContractor) + '</td><td>' + esc(visit.systemName) + '</td><td>' + dateText(visit.visitDate) + '</td><td>' + badge(visit.effectiveStatus, permitLabel(visit.effectiveStatus)) + '</td><td>' + badge(facilityStatus, facilityLabel(facilityStatus)) + '</td><td><button class="btn btn-light" data-open="' + visit.id + '">فتح واعتماد</button></td></tr>';
      }).join('') : '<tr><td colspan="8" class="empty">لا توجد زيارات مطابقة</td></tr>';
    } catch (error) {
      document.getElementById('visits-body').innerHTML = '<tr><td colspan="8" class="empty">' + esc(error.message) + '</td></tr>';
      toast(error.message, false);
    }
  }

  async function openVisit(id) {
    try {
      var body = await api('/facility/visits/' + id), visit = body.visit, approval = body.facilityApproval || { status:'pending' };
      state.lastVisitId = id;
      var representativeHtml = '<div class="section"><h3>الفريق الزائر</h3><div class="table-wrap"><table class="table" style="min-width:620px"><thead><tr><th>م</th><th>الاسم</th><th>رقم الهوية / الإقامة</th><th>الجوال</th></tr></thead><tbody>' + (body.representatives || []).map(function (rep, index) { return '<tr><td>' + (index + 1) + '</td><td>' + esc(rep.fullName) + '</td><td style="direction:ltr;text-align:right">' + esc(rep.identityNumber || '—') + '</td><td style="direction:ltr;text-align:right">' + esc(rep.mobile || '—') + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
      var approvalHtml = '<div class="section"><h3>قرار إدارة المنشأة</h3><div style="margin-bottom:9px">' + badge(approval.status, facilityLabel(approval.status)) + '</div>' + detailRows([['اسم المعتمد',approval.approverName],['الصفة',approval.approverTitle],['وقت القرار',approval.decidedAt ? dateText(approval.decidedAt,true) : null],['الملاحظة / سبب الرفض',approval.notes]]) + '</div>';
      var documents = (body.documents || []).filter(function (document) { return document.status === 'active'; });
      var documentsHtml = '<div class="section"><h3>مرفق اعتماد المنشأة</h3>' + (documents.length ? documents.map(function (document) { return '<div class="doc"><span>' + esc(document.originalName) + ' — ' + Math.ceil(document.sizeBytes / 1024) + ' KB</span><button class="btn btn-light" data-document="' + document.id + '" data-visit="' + id + '">عرض محمي</button></div>'; }).join('') : '<div class="empty">لم يُرفع مرفق اعتماد بعد</div>') + '</div>';
      var buttons = [];
      if (visit.status === 'approved') buttons.push(
        { label:'اعتماد الزيارة', className:'btn-green', action:function () { openDecision(id, 'approved', approval); } },
        { label:'رفض الزيارة', className:'btn-red', action:function () { openDecision(id, 'rejected', approval); } },
        { label:'رفع صورة / PDF إثبات', className:'btn-primary', action:function () { openUpload(id); } }
      );
      modal('ملف الزيارة — ' + (visit.serialNumber || id), detailRows([
        ['رقم التصريح',visit.serialNumber],['حالة التصريح',permitLabel(visit.effectiveStatus)],['الموقع',visit.siteLocation],['مقاول الصيانة',visit.mainContractor],['مقاول الباطن',visit.subContractor],['النظام',visit.systemName],['تاريخ الزيارة',dateText(visit.visitDate)],['سبب الإلغاء',visit.cancelledReason],
      ]) + representativeHtml + approvalHtml + documentsHtml, buttons);
    } catch (error) { toast(error.message, false); }
  }

  function openDecision(id, status, current) {
    var rejected = status === 'rejected';
    modal(rejected ? 'رفض الزيارة من المنشأة' : 'اعتماد الزيارة من المنشأة', '<form id="decision-form"><div class="detail-grid"><div class="field"><label>اسم المعتمد</label><input name="approverName" value="' + esc(current.approverName || '') + '" placeholder="يُستخدم اسم حسابك عند تركه فارغًا"></div><div class="field"><label>الصفة</label><input name="approverTitle" value="' + esc(current.approverTitle || '') + '" placeholder="إدارة المنشأة"></div></div><div class="field" style="margin-top:10px"><label>' + (rejected ? 'سبب الرفض (مطلوب)' : 'ملاحظة الاعتماد (اختيارية)') + '</label><textarea name="notes" ' + (rejected ? 'required' : '') + '>' + esc(current.notes || '') + '</textarea></div></form>', [{ label:rejected ? 'تأكيد الرفض' : 'تأكيد الاعتماد', className:rejected ? 'btn-red' : 'btn-green', action:async function (button) {
      var form = document.getElementById('decision-form'); if (!form.reportValidity()) return; button.disabled = true;
      try { await api('/facility/visits/' + id + '/decision', { method:'PATCH', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ status:status, approverName:form.elements.approverName.value.trim(), approverTitle:form.elements.approverTitle.value.trim(), notes:form.elements.notes.value.trim() }) }); closeModal(); toast(rejected ? 'تم تسجيل رفض المنشأة' : 'تم اعتماد الزيارة من إدارة المنشأة', true); await loadVisits(state.page); }
      catch (error) { toast(error.message, false); button.disabled = false; }
    } }]);
  }

  function openUpload(id) {
    modal('رفع مرفق اعتماد المنشأة', '<form id="upload-form"><div class="field"><label>صورة أو ملف PDF</label><input type="file" name="file" accept="image/png,image/jpeg,application/pdf" required></div><p style="color:#64748b;font-size:12px">يفحص النظام نوع الملف الحقيقي وحجمه وبصمته. رفع بديل يحتفظ بالإصدار السابق في السجل.</p></form>', [{ label:'رفع وحفظ', className:'btn-primary', action:async function (button) {
      var file = document.getElementById('upload-form').elements.file.files[0]; if (!file) { toast('اختر المرفق أولاً', false); return; }
      button.disabled = true; var data = new FormData(); data.append('file', file);
      try { await api('/facility/visits/' + id + '/attachment', { method:'POST', body:data }); closeModal(); toast('تم حفظ مرفق اعتماد المنشأة', true); await loadVisits(state.page); await openVisit(id); }
      catch (error) { toast(error.message, false); button.disabled = false; }
    } }]);
  }

  async function openDocument(visitId, documentId) {
    try {
      var token = await freshToken(false), response = await fetch('/api/visits/facility/visits/' + visitId + '/attachments/' + documentId + '/content', { headers:{ Authorization:'Bearer ' + token }, cache:'no-store' });
      if (response.status === 401) { token = await refreshedToken(); response = await fetch('/api/visits/facility/visits/' + visitId + '/attachments/' + documentId + '/content', { headers:{ Authorization:'Bearer ' + token }, cache:'no-store' }); }
      if (!response.ok) { var body = await response.json().catch(function(){return {};}); throw new Error(body.error || 'تعذر فتح المرفق'); }
      var url = URL.createObjectURL(await response.blob()), link = document.createElement('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener'; link.click(); setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
    } catch (error) { toast(error.message, false); }
  }

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal').addEventListener('click', function (event) { if (event.target === this) closeModal(); });
  document.getElementById('filters').addEventListener('submit', function (event) { event.preventDefault(); loadVisits(1); });
  document.getElementById('prev').addEventListener('click', function () { if (state.page > 1) loadVisits(state.page - 1); });
  document.getElementById('next').addEventListener('click', function () { if (state.page < state.pages) loadVisits(state.page + 1); });
  document.getElementById('renew-session').addEventListener('click', async function () { var button = this; button.disabled = true; try { await refreshedToken(); await loadVisits(state.page); toast('تم تجديد الجلسة وتحميل أحدث الزيارات', true); } catch (error) { toast(error.message, false); } finally { button.disabled = false; } });
  document.addEventListener('click', function (event) { var open = event.target.closest('[data-open]'), documentButton = event.target.closest('[data-document]'); if (open) openVisit(Number(open.dataset.open)); else if (documentButton) openDocument(Number(documentButton.dataset.visit), Number(documentButton.dataset.document)); });
  window.addEventListener('focus', function () { refreshedToken().catch(function () {}); });
  setInterval(function () { if (!document.hidden) refreshedToken().catch(function () {}); }, 45000);
  loadVisits(1);
})();
