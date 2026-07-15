(function () {
  'use strict';

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function textSetting(settings, field, fallback) {
    var value = String(settings && settings[field] || '').trim();
    return value || fallback;
  }

  function multiline(value) {
    return esc(value).replace(/\r?\n/g, '<br>');
  }

  async function authToken(force) {
    var getters = [window.najranGetFreshToken, window.parent && window.parent.najranGetFreshToken, window.top && window.top.najranGetFreshToken];
    for (var i = 0; i < getters.length; i++) {
      if (typeof getters[i] === 'function') {
        try { var fresh = await getters[i](force ? { skipCache: true } : undefined); if (fresh) return fresh; } catch (_) {}
      }
    }
    if (!force) try {
      var session = JSON.parse(localStorage.getItem('najran_session') || '{}');
      if (session.clerkToken && Date.now() - Number(session.timestamp || 0) < 55000) return session.clerkToken;
    } catch (_) {}
    throw new Error('انتهت الجلسة؛ افتح الصفحة من النظام مرة أخرى');
  }

  async function loadPermit(id) {
    var token = await authToken();
    var response = await fetch('/api/visits/' + encodeURIComponent(id) + '/permit', { headers: { Authorization: 'Bearer ' + token } });
    if (response.status === 401) {
      token = await authToken(true);
      response = await fetch('/api/visits/' + encodeURIComponent(id) + '/permit', { headers: { Authorization: 'Bearer ' + token } });
    }
    var body = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(body.error || 'تعذر تحميل التصريح');
    return body;
  }

  function formatDate(value, withTime) {
    if (!value) return '—';
    try { return new Date(value).toLocaleString('ar-SA', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }); } catch (_) { return String(value); }
  }

  function buildPermitNode(payload, offscreen) {
    var v = payload.permit || {};
    var settings = payload.settings || {};
    var representatives = Array.isArray(v.representatives) && v.representatives.length ? v.representatives.slice(0, 4) : [{ fullName: v.repName, identityNumber: v.repId || v.repIdMasked, mobile: v.repMobile }];
    var rows = [
      ['الموقع', esc(v.siteLocation)],
      ['تاريخ الزيارة', formatDate(v.visitDate, false)],
      ['النظام', esc(v.systemName)],
      ['مقاول الصيانة', esc(v.mainContractor)],
      ['مقاول الباطن', esc(v.subContractor)]
    ].filter(Boolean);
    var representativesHtml = '<table style="width:100%;border-collapse:collapse;margin-bottom:10px;table-layout:fixed"><thead><tr><th style="border:1px solid #cbd5e1;padding:6px 5px;background:#eaf0f8;font-size:11px;width:7%">م</th><th style="border:1px solid #cbd5e1;padding:6px 5px;background:#eaf0f8;font-size:11px;width:39%">اسم المندوب</th><th style="border:1px solid #cbd5e1;padding:6px 5px;background:#eaf0f8;font-size:11px;width:28%">الهوية / الإقامة</th><th style="border:1px solid #cbd5e1;padding:6px 5px;background:#eaf0f8;font-size:11px;width:26%">الجوال</th></tr></thead><tbody>' + representatives.map(function (representative, index) { return '<tr><td style="border:1px solid #d1d5db;padding:6px 5px;text-align:center;font-size:11px">' + (index + 1) + '</td><td style="border:1px solid #d1d5db;padding:6px 7px;font-size:11px;font-weight:700">' + esc(representative.fullName || '—') + '</td><td style="border:1px solid #d1d5db;padding:6px 7px;font-size:11px;direction:ltr;text-align:center">' + esc(representative.identityNumber || '—') + '</td><td style="border:1px solid #d1d5db;padding:6px 7px;font-size:11px;direction:ltr;text-align:center">' + esc(representative.mobile || '—') + '</td></tr>'; }).join('') + '</tbody></table>';
    var stampSource = settings.stamp || '/original/visit-default-stamp.png';
    var signatureSource = settings.signature || '/original/visit-default-signature.png';
    var organizationText = textSetting(settings, 'organizationText', 'تجمع نجران الصحي — وحدة الصيانة العامة');
    var permitTitle = textSetting(settings, 'permitTitle', 'إعتماد موافقة زيارة مقاولي الباطن');
    var verificationText = textSetting(settings, 'verificationText', 'تم التحقق من بيانات الهوية/الإقامة إلكترونيًا');
    var approvalText = textSetting(settings, 'approvalText', 'توافق وحدة الصيانة العامة بتجمع نجران الصحي بقيام مندوب مقاول الباطن الموضح اسمه وبياناته بعالية لزيارة الموقع لتنفيذ أعمال الصيانة الوقائية للنظام حسب شروط ومواصفات العقد.');
    var closingText = textSetting(settings, 'closingText', 'وعلي ذلك جري التوقيع ،،،');
    var qrLabel = textSetting(settings, 'qrLabel', 'تحقق عام من التصريح');
    var footerNote = textSetting(settings, 'footerNote', 'يرجى إبراز بطاقة تأهيل الفريق الفني ونموذج اعتماد موافقة زيارة مقاولي الباطن للمسؤول بالمنشأة.');
    var stampHtml = '<img src="' + esc(stampSource) + '" alt="الختم الإلكتروني" style="display:block;width:auto;height:auto;max-width:190px;max-height:140px;object-fit:contain">';
    var signatureHtml = '<img src="' + esc(signatureSource) + '" alt="التوقيع الإلكتروني" style="display:block;max-width:165px;max-height:72px;object-fit:contain;margin:7px auto 0">';
    var draft = v.isDraft ? '<div style="position:absolute;inset:35% 8% auto;transform:rotate(-24deg);font-size:92px;font-weight:900;color:rgba(185,28,28,.13);text-align:center;border:9px solid rgba(185,28,28,.12);z-index:3;pointer-events:none">مسودة</div>' : '';
    var node = document.createElement('div');
    node.className = 'najran-visit-permit-document';
    node.style.cssText = (offscreen ? 'position:fixed;left:-9999px;top:0;' : 'position:relative;margin:auto;') + 'width:790px;min-height:200px;background:#fff;padding:44px 48px;font-family:Tajawal,Arial,sans-serif;direction:rtl;color:#1a1a1a;box-sizing:border-box';
    node.innerHTML = draft +
      '<div style="display:flex;align-items:center;gap:18px;border-bottom:3px solid #1e3c72;padding-bottom:16px;margin-bottom:20px">' +
        '<img src="/original/najran_health_cluster_logo.png" style="width:70px;height:70px;object-fit:contain">' +
        '<div><div style="font-size:11px;color:#64748b;margin-bottom:4px">' + esc(organizationText) + '</div>' +
        '<h2 style="font-size:20px;color:#1e3c72;margin:0 0 4px;font-weight:800">' + esc(permitTitle) + '</h2>' +
        '<div style="font-size:13px;color:#475569">رقم الصادر: <strong>' + esc(v.serialNumber || 'بانتظار الاعتماد') + '</strong></div></div></div>' +
      '<table style="width:100%;border-collapse:collapse;margin-bottom:10px">' + rows.map(function (row) {
        return '<tr><td style="border:1px solid #d1d5db;padding:6px 10px;font-weight:700;background:#f8fafc;width:32%;font-size:11px">' + row[0] + '</td><td style="border:1px solid #d1d5db;padding:6px 10px;font-size:11px">' + row[1] + '</td></tr>';
      }).join('') + '</table>' + representativesHtml +
      '<div style="font-size:12px;font-weight:800;color:#166534;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:8px 12px;margin-bottom:12px;text-align:center">' + multiline(verificationText) + '</div>' +
      '<div style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:10px;padding:12px 18px;margin-bottom:14px;line-height:1.8;font-size:12px;text-align:justify">' + multiline(approvalText) + '<br>' + multiline(closingText) + '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:center;gap:14px;border:1.5px solid #d1d5db;border-radius:10px;padding:13px 20px">' +
        '<div data-role="permit-signature" style="grid-column:1;text-align:center"><p style="font-weight:800;font-size:14px;color:#1e3c72;margin:0 0 6px">' + esc(settings.signerTitle || 'مدير وحدة الصيانة العامة بتجمع نجران الصحي') + '</p>' +
        '<p style="font-size:13px;margin:0 0 4px">الاسم: ' + esc(settings.signerName || settings.managerName || 'م. محمد عباس المكرمي') + '</p>' +
        '<p style="font-size:13px;margin:0 0 8px">التاريخ: ' + formatDate(v.approvedAt, false) + ' م</p>' + signatureHtml + '</div>' +
        '<div data-role="permit-stamp" style="grid-column:2;min-height:140px;display:flex;align-items:center;justify-content:center;text-align:center;overflow:visible">' + stampHtml + '</div>' +
        '<div data-role="permit-qr" style="grid-column:3;text-align:center;justify-self:center"><img src="' + esc(v.qrDataUrl || '') + '" alt="QR تصريح الزيارة" style="width:92px;height:92px;display:block;image-rendering:pixelated">' +
        '<div style="font-size:9px;font-weight:700;margin-top:3px;color:#475569">' + esc(qrLabel) + '</div><div style="font-size:9px;font-weight:800;margin-top:2px;color:#1e3c72">' + esc(v.serialNumber || 'مسودة') + '</div></div></div>' +
      '<div data-role="permit-footer-note" style="margin-top:10px;border-top:1px solid #cbd5e1;padding-top:8px;text-align:center;font-size:10.5px;font-weight:800;color:#334155">' + multiline(footerNote) + '</div>';
    return node;
  }

  function waitForImages(node) {
    return Promise.all(Array.from(node.querySelectorAll('img')).map(function (img) { return img.complete ? Promise.resolve() : new Promise(function (resolve) { img.addEventListener('load', resolve, { once: true }); img.addEventListener('error', resolve, { once: true }); }); }));
  }

  function ensurePreviewModal() {
    var existing = document.getElementById('najran-visit-preview-modal');
    if (existing) return existing;
    var modal = document.createElement('div');
    modal.id = 'najran-visit-preview-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,32,80,.78);z-index:2147483000;display:none;padding:24px;overflow:auto';
    modal.innerHTML = '<div style="max-width:860px;margin:auto"><div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:10px;position:sticky;top:0;z-index:4"><button type="button" data-print style="border:0;border-radius:9px;padding:10px 18px;background:#15803d;color:#fff;font-family:Tajawal;font-weight:800;cursor:pointer">طباعة / PDF</button><button type="button" data-close style="border:0;border-radius:9px;padding:10px 18px;background:#fff;color:#1e3c72;font-family:Tajawal;font-weight:800;cursor:pointer">إغلاق</button></div><div data-body></div></div>';
    modal.querySelector('[data-close]').addEventListener('click', function () { modal.style.display = 'none'; document.body.style.overflow = ''; });
    modal.addEventListener('click', function (event) { if (event.target === modal) { modal.style.display = 'none'; document.body.style.overflow = ''; } });
    document.body.appendChild(modal);
    return modal;
  }

  async function renderPdf(payload, filename) {
    if (!window.html2canvas || !window.jspdf || !window.jspdf.jsPDF) throw new Error('مكتبة الطباعة غير متاحة');
    var node = buildPermitNode(payload, true);
    document.body.appendChild(node);
    try {
      await waitForImages(node);
      var canvas = await window.html2canvas(node, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', logging: false });
      var pdf = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      var pageW = pdf.internal.pageSize.getWidth(), pageH = pdf.internal.pageSize.getHeight(), margin = 10;
      var imgW = pageW - margin * 2, imgH = canvas.height * imgW / canvas.width;
      var scale = imgH > pageH - margin * 2 ? (pageH - margin * 2) / imgH : 1;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, margin, imgW * scale, imgH * scale);
      pdf.save(filename);
    } finally { if (node.parentNode) node.parentNode.removeChild(node); }
  }

  async function preview(id) {
    var payload = await loadPermit(id);
    var modal = ensurePreviewModal();
    var body = modal.querySelector('[data-body]');
    body.innerHTML = '';
    body.appendChild(buildPermitNode(payload, false));
    modal.querySelector('[data-print]').onclick = function () { renderPdf(payload, 'تصريح-زيارة-' + (payload.permit.serialNumber || payload.permit.id) + '.pdf').catch(showError); };
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    return payload;
  }

  async function print(id) {
    var payload = await loadPermit(id);
    await renderPdf(payload, 'تصريح-زيارة-' + (payload.permit.serialNumber || payload.permit.id) + '.pdf');
    return payload;
  }

  function showError(error) {
    var message = error && error.message ? error.message : 'تعذر تجهيز التصريح';
    if (window.NajranDialogs && typeof window.NajranDialogs.alert === 'function') return window.NajranDialogs.alert(message);
    var modal = ensurePreviewModal(), body = modal.querySelector('[data-body]');
    body.innerHTML = '<div style="background:#fff;padding:28px;border-radius:12px;color:#b91c1c;text-align:center;font-weight:800">' + esc(message) + '</div>';
    modal.style.display = 'block';
  }

  window.NajranVisitPermit = { load: loadPermit, preview: preview, print: print, showError: showError };

})();

(function () {
  'use strict';

  if (!/request-visit\.html(?:$|[?#])/.test(location.href) && document.title !== 'بوابة تسجيل ومتابعة الزيارات') return;

  var requestSubmitting = false;
  var requestCatalog = null;
  var requestVisits = [];
  var requestSearchBound = false;

  function esc(value) {
    return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function showMessage(message, type) {
    var node = document.getElementById('status-message');
    if (!node) return;
    node.textContent = message;
    node.className = type;
    node.style.display = 'block';
    clearTimeout(node._safeTimer);
    node._safeTimer = setTimeout(function () { node.style.display = 'none'; }, 8000);
  }

  async function parentToken(force) {
    if (!window.parent || window.parent === window) return null;
    return new Promise(function (resolve) {
      var requestId = 'request-visit-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      var finished = false;
      function done(value) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        window.removeEventListener('message', receive);
        resolve(typeof value === 'string' && value.trim() ? value.trim() : null);
      }
      function receive(event) {
        if (event.origin !== location.origin || event.source !== window.parent || !event.data || event.data.type !== 'NAJRAN_TOKEN_RESPONSE' || event.data.requestId !== requestId) return;
        done(event.data.token);
      }
      var timer = setTimeout(function () { done(null); }, 9000);
      window.addEventListener('message', receive);
      try { window.parent.postMessage({ type: 'NAJRAN_TOKEN_REQUEST', requestId: requestId, skipCache: !!force }, location.origin); }
      catch (_) { done(null); }
    });
  }

  async function freshToken(force) {
    var scopes = [window, window.parent, window.top];
    for (var i = 0; i < scopes.length; i++) {
      try {
        var getter = scopes[i] && scopes[i].najranGetFreshToken;
        if (typeof getter === 'function') {
          var value = await getter.call(scopes[i], force ? { skipCache: true } : undefined);
          if (typeof value === 'string' && value.trim()) return value.trim();
        }
      } catch (_) {}
    }
    var bridged = await parentToken(force);
    if (bridged) return bridged;
    if (!force) try {
      var session = JSON.parse(localStorage.getItem('najran_session') || '{}');
      if (session.clerkToken && Date.now() - Number(session.timestamp || 0) < 55000) return session.clerkToken;
    } catch (_) {}
    throw new Error('انتهت صلاحية جلسة الدخول أو لم تعد صالحة؛ اضغط «تحديث آمن» ثم أعد المحاولة');
  }

  async function visitApi(path, options, retried) {
    options = options || {};
    var token = await freshToken(!!retried);
    var response = await fetch('/api/visits' + path, Object.assign({}, options, {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: Object.assign({ Authorization: 'Bearer ' + token }, options.headers || {})
    }));
    var body = await response.json().catch(function () { return {}; });
    if (response.status === 401 && !retried) return visitApi(path, options, true);
    if (!response.ok) {
      var error = new Error(body.error || 'فشلت العملية');
      error.status = response.status;
      error.code = body.code || '';
      throw error;
    }
    return body;
  }

  function visitDateText(value) {
    if (!value) return '—';
    try { return new Date(String(value).slice(0, 10) + 'T12:00:00').toLocaleDateString('ar-SA'); }
    catch (_) { return String(value); }
  }

  function renderRequestVisits() {
    var tbody = document.getElementById('req-tbody');
    if (!tbody) return;
    var query = String(document.getElementById('search-input')?.value || '').toLocaleLowerCase('ar').trim();
    var rows = requestVisits.filter(function (visit) {
      return !query || Object.keys(visit).some(function (key) { return visit[key] != null && String(visit[key]).toLocaleLowerCase('ar').indexOf(query) !== -1; });
    });
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-row"><i class="fas fa-inbox" style="font-size:20px;color:#cbd5e1"></i><br>لا توجد طلبات</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(function (visit) {
      var statusClass = visit.status === 'approved' ? 'status-approved' : visit.status === 'rejected' ? 'status-rejected' : 'status-pending';
      var statusText = visit.status === 'approved' ? 'موافق عليه' : visit.status === 'rejected' ? 'مرفوض' : visit.status === 'cancelled' ? 'ملغى' : 'قيد المراجعة';
      var actions = '';
      if (visit.status === 'approved') {
        var serial = visit.serialNumber ? '<div class="serial-badge"><i class="fas fa-hashtag"></i> ' + esc(visit.serialNumber) + '</div>' : '';
        actions = serial + '<button class="btn-dl btn-dl-pdf" onclick="genPDF(' + visit.id + ')"><i class="fas fa-file-pdf"></i> تحميل إلكتروني</button>';
        if (visit.hasSignedPermit) actions += '<button class="btn-dl btn-dl-signed" onclick="downloadSignedPermit(' + visit.id + ',\'' + esc(visit.serialNumber || visit.id) + '\')"><i class="fas fa-signature"></i> نسخة موقعة</button>';
        actions += '<button class="btn-dl" style="background:#1e3c72;color:#fff" onclick="NajranVisitPermit.preview(' + visit.id + ').catch(NajranVisitPermit.showError)"><i class="fas fa-eye"></i> معاينة</button>';
      } else if (visit.status === 'pending') {
        actions = '<button class="btn-dl" style="background:#b45309;color:#fff" onclick="NajranVisitPermit.preview(' + visit.id + ').catch(NajranVisitPermit.showError)"><i class="fas fa-eye"></i> معاينة مسودة</button>';
      } else if (visit.status === 'rejected' && visit.adminNotes) {
        actions = '<small style="color:#b91c1c;font-size:11px"><i class="fas fa-info-circle"></i> ' + esc(visit.adminNotes) + '</small>';
      }
      return '<tr><td><strong>' + esc(visit.repName) + '</strong><br><small style="color:#94a3b8">' + esc(visit.repIdMasked) + '</small></td><td>' + esc(visit.siteLocation) + '</td><td>' + esc(visit.systemName) + '</td><td>' + esc(visit.subContractor) + '</td><td>' + visitDateText(visit.visitDate) + '</td><td><span class="status-badge ' + statusClass + '">' + statusText + '</span></td><td>' + (actions || '—') + '</td></tr>';
    }).join('');
  }

  function bindSearch() {
    if (requestSearchBound) return;
    var input = document.getElementById('search-input');
    if (!input) return;
    requestSearchBound = true;
    input.addEventListener('input', function (event) {
      event.stopImmediatePropagation();
      renderRequestVisits();
    }, true);
  }

  function selectedRepresentativeIds() {
    return Array.from(document.querySelectorAll('.representative-select')).map(function (select) { return Number(select.value || 0); }).filter(Boolean);
  }

  function refreshRepresentativeOptions(selectedIds) {
    if (!requestCatalog) return;
    var contractorId = Number(document.getElementById('f_sub')?.value || 0);
    var systemId = Number(document.getElementById('f_system')?.value || 0);
    var allowed = requestCatalog.representatives.filter(function (representative) {
      return representative.isActive && representative.contractorId === contractorId && requestCatalog.representativeSystems.some(function (link) { return link.isActive && link.representativeId === representative.id && link.systemId === systemId; });
    });
    document.querySelectorAll('.representative-select').forEach(function (select, index) {
      var current = selectedIds && selectedIds[index] ? String(selectedIds[index]) : select.value;
      select.innerHTML = '<option value="">اختر المندوب المسجل</option>' + allowed.map(function (representative) { return '<option value="' + representative.id + '">' + esc(representative.fullName) + ' — ' + esc(representative.identityMasked) + '</option>'; }).join('');
      if (allowed.some(function (representative) { return String(representative.id) === current; })) select.value = current;
    });
  }

  async function loadSafeCatalog() {
    var systemValue = document.getElementById('f_system')?.value || '';
    var contractorValue = document.getElementById('f_sub')?.value || '';
    var representativeIds = selectedRepresentativeIds();
    var body = await visitApi('/catalog');
    requestCatalog = body;
    var systemSelect = document.getElementById('f_system');
    var contractorSelect = document.getElementById('f_sub');
    if (systemSelect) {
      systemSelect.innerHTML = '<option value="">اختر النظام من الكتالوج المركزي</option>' + body.systems.filter(function (row) { return row.isActive; }).map(function (row) { return '<option value="' + row.id + '">' + esc(row.displayName || row.name) + '</option>'; }).join('');
      if (body.systems.some(function (row) { return String(row.id) === String(systemValue); })) systemSelect.value = String(systemValue);
    }
    if (contractorSelect) {
      contractorSelect.innerHTML = '<option value="">اختر الشركة المؤهلة</option>' + body.contractors.filter(function (row) { return row.isActive; }).map(function (row) { return '<option value="' + row.id + '">' + esc(row.displayName || row.name) + '</option>'; }).join('');
      if (body.contractors.some(function (row) { return String(row.id) === String(contractorValue); })) contractorSelect.value = String(contractorValue);
    }
    refreshRepresentativeOptions(representativeIds);
  }

  async function loadSafeVisits() {
    var body = await visitApi('/');
    requestVisits = Array.isArray(body.visits) ? body.visits : [];
    renderRequestVisits();
  }

  async function safeRefresh(announce) {
    var button = document.getElementById('request-visit-safe-refresh');
    if (button) button.disabled = true;
    try {
      await freshToken(true);
      await Promise.all([loadSafeCatalog(), loadSafeVisits()]);
      bindSearch();
      if (announce) showMessage('تم تجديد الجلسة وتحديث بيانات الزيارات بدون فقد المدخلات الحالية', 'success');
      return true;
    } catch (error) {
      if (announce) showMessage(error.message || 'تعذر تجديد الجلسة', 'error');
      return false;
    } finally {
      if (button) button.disabled = false;
    }
  }

  function injectSafeRefreshButton() {
    if (document.getElementById('request-visit-safe-refresh')) return;
    var header = document.querySelector('.form-header');
    if (!header) return;
    var button = document.createElement('button');
    button.type = 'button';
    button.id = 'request-visit-safe-refresh';
    button.innerHTML = '<i class="fas fa-rotate"></i> تحديث آمن';
    button.style.cssText = 'margin-top:14px;border:0;border-radius:10px;padding:10px 18px;background:#1e3c72;color:#fff;font-family:Tajawal,sans-serif;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:7px';
    button.addEventListener('click', function () { safeRefresh(true); });
    header.appendChild(button);
  }

  function activeOnDate(row, date) {
    return row && row.status === 'active' && (!row.validFrom || row.validFrom <= date) && (!row.validUntil || row.validUntil >= date);
  }

  async function submitRequest(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (requestSubmitting) return;

    var button = document.getElementById('submit-btn');
    requestSubmitting = true;
    if (button) button.disabled = true;
    try {
      if (!requestCatalog && !(await safeRefresh(false))) throw new Error('تعذر تحميل بيانات الزيارات بعد تجديد الجلسة');
      var representativeIds = selectedRepresentativeIds();
      if (!representativeIds.length) throw new Error('اختر مندوبًا واحدًا على الأقل');
      if (new Set(representativeIds).size !== representativeIds.length) throw new Error('تم اختيار نفس المندوب أكثر من مرة؛ كل مندوب يُحفظ مرة واحدة فقط');

      var siteLocation = String(document.getElementById('f_site')?.value || '').trim();
      var mainContractor = String(document.getElementById('f_main')?.value || '').trim();
      var systemId = Number(document.getElementById('f_system')?.value || 0);
      var contractorId = Number(document.getElementById('f_sub')?.value || 0);
      var visitDate = String(document.getElementById('f_date')?.value || '');
      if (!siteLocation || !mainContractor || !systemId || !contractorId || !/^\d{4}-\d{2}-\d{2}$/.test(visitDate)) throw new Error('أكمل الموقع والمقاول والنظام والشركة وتاريخ الزيارة');

      var approval = requestCatalog.siteApprovals.find(function (row) { return row.siteName === siteLocation && row.systemId === systemId && row.contractorId === contractorId && activeOnDate(row, visitDate); });
      var qualification = requestCatalog.qualifications.find(function (row) { return row.systemId === systemId && row.contractorId === contractorId && activeOnDate(row, visitDate); });
      if (!approval || !qualification) throw new Error('لا يوجد اعتماد موقع وتأهيل ساريان للشركة والنظام في تاريخ الزيارة');

      if (button) button.innerHTML = '<span class="spinner"></span> جارٍ الحفظ الآمن...';
      var created = 0, duplicates = 0, failures = [];
      for (var i = 0; i < representativeIds.length; i++) {
        try {
          var result = await visitApi('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              siteLocation: siteLocation,
              mainContractor: mainContractor,
              systemId: systemId,
              contractorId: contractorId,
              representativeId: representativeIds[i],
              siteApprovalId: approval.id,
              qualificationId: qualification.id,
              visitDate: visitDate,
              startsAt: visitDate + 'T00:00:00.000Z',
              endsAt: null
            })
          });
          if (result.duplicate || result.code === 'VISIT_ALREADY_EXISTS') duplicates += 1;
          else created += 1;
        } catch (error) {
          failures.push(error.message || 'فشل الحفظ');
        }
      }

      await loadSafeVisits();
      if (!failures.length) {
        showMessage(created ? 'تم حفظ ' + created + ' زيارة مرة واحدة' + (duplicates ? '، وتم تجاهل ' + duplicates + ' طلب مكرر موجود بالفعل' : '') : 'الزيارة مسجلة بالفعل؛ لم يتم إنشاء نسخة مكررة', 'success');
        var wrapper = document.getElementById('visitors-wrap');
        if (wrapper && typeof window.addVisitor === 'function') {
          wrapper.innerHTML = '';
          try { window.visitorCount = 0; } catch (_) {}
          window.addVisitor();
          refreshRepresentativeOptions([]);
        }
      } else {
        showMessage('تم حفظ ' + created + '، وتم تجاهل ' + duplicates + ' مكرر، وتعذر حفظ ' + failures.length + ': ' + failures[0], 'error');
      }
    } catch (error) {
      showMessage(error.message || 'تعذر حفظ طلب الزيارة', 'error');
    } finally {
      requestSubmitting = false;
      if (button) {
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-paper-plane"></i> إرسال الطلب';
      }
    }
  }

  function install() {
    var form = document.getElementById('visit-form');
    if (!form || form.dataset.safeRequestInstalled === '1') return;
    form.dataset.safeRequestInstalled = '1';
    form.addEventListener('submit', submitRequest, true);
    document.getElementById('f_system')?.addEventListener('change', function () { refreshRepresentativeOptions(selectedRepresentativeIds()); }, true);
    document.getElementById('f_sub')?.addEventListener('change', function () { refreshRepresentativeOptions(selectedRepresentativeIds()); }, true);
    injectSafeRefreshButton();
    bindSearch();
    setTimeout(function () { safeRefresh(false); }, 350);
  }

  install();
})();
