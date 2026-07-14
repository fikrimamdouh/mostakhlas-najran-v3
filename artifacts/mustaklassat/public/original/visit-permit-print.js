(function () {
  'use strict';

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
    var year = v.approvedAt ? new Date(v.approvedAt).getFullYear() : new Date().getFullYear();
    var rows = [
      ['الاسم', esc(v.repName)],
      ['المستشفى / المنشأة', esc(v.siteLocation)],
      ['تاريخ الزيارة', formatDate(v.visitDate, false)],
      ['النظام', esc(v.systemName)],
      ['رقم الهوية (الإقامة)', esc(v.repIdMasked || 'تم التحقق إلكترونيًا')],
      ['مقاول الصيانة', esc(v.mainContractor)],
      ['مقاول الباطن', esc(v.subContractor)]
    ].filter(Boolean);
    var stampHtml = settings.stamp
      ? '<img src="' + esc(settings.stamp) + '" style="max-width:110px;max-height:110px;object-fit:contain">'
      : '<div style="width:110px;height:110px;border:2px dashed #ccc;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;color:#aaa">الختم</div>';
    var signatureHtml = settings.signature
      ? '<img src="' + esc(settings.signature) + '" style="max-width:150px;max-height:70px;object-fit:contain">'
      : '<div style="width:150px;height:2px;background:#333;margin-top:40px"></div>';
    var draft = v.isDraft ? '<div style="position:absolute;inset:35% 8% auto;transform:rotate(-24deg);font-size:92px;font-weight:900;color:rgba(185,28,28,.13);text-align:center;border:9px solid rgba(185,28,28,.12);z-index:3;pointer-events:none">مسودة</div>' : '';
    var node = document.createElement('div');
    node.className = 'najran-visit-permit-document';
    node.style.cssText = (offscreen ? 'position:fixed;left:-9999px;top:0;' : 'position:relative;margin:auto;') + 'width:790px;min-height:200px;background:#fff;padding:44px 48px;font-family:Tajawal,Arial,sans-serif;direction:rtl;color:#1a1a1a;box-sizing:border-box';
    node.innerHTML = draft +
      '<div style="display:flex;align-items:center;gap:18px;border-bottom:3px solid #1e3c72;padding-bottom:16px;margin-bottom:20px">' +
        '<img src="/original/najran_health_cluster_logo.png" style="width:70px;height:70px;object-fit:contain">' +
        '<div><div style="font-size:11px;color:#64748b;margin-bottom:4px">تجمع نجران الصحي — وحدة الصيانة العامة</div>' +
        '<h2 style="font-size:20px;color:#1e3c72;margin:0 0 4px;font-weight:800">إعتماد موافقة زيارة مقاولي الباطن</h2>' +
        '<div style="font-size:13px;color:#475569">رقم الصادر: <strong>' + esc(v.serialNumber || 'بانتظار الاعتماد') + (v.serialNumber ? ' / ' + year : '') + '</strong></div></div></div>' +
      '<table style="width:100%;border-collapse:collapse;margin-bottom:12px">' + rows.map(function (row) {
        return '<tr><td style="border:1px solid #d1d5db;padding:8px 12px;font-weight:700;background:#f8fafc;width:32%;font-size:12px">' + row[0] + '</td><td style="border:1px solid #d1d5db;padding:8px 12px;font-size:12px">' + row[1] + '</td></tr>';
      }).join('') + '</table>' +
      '<div style="font-size:12px;font-weight:800;color:#166534;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:8px 12px;margin-bottom:12px;text-align:center">تم التحقق من بيانات الهوية/الإقامة إلكترونيًا</div>' +
      '<div style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:10px;padding:12px 18px;margin-bottom:14px;line-height:1.8;font-size:12px;text-align:justify">توافق وحدة الصيانة العامة بتجمع نجران الصحي بقيام مندوب مقاول الباطن الموضح اسمه وبياناته بعالية لزيارة الموقع لتنفيذ أعمال الصيانة الوقائية للنظام حسب شروط ومواصفات العقد.<br>وعلي ذلك جري التوقيع ،،،</div>' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-end;border:1.5px solid #d1d5db;border-radius:10px;padding:13px 20px">' +
        '<div><p style="font-weight:800;font-size:14px;color:#1e3c72;margin:0 0 6px">' + esc(settings.signerTitle || 'مشرف وحدة الصيانة العامة') + '</p>' +
        '<p style="font-size:13px;margin:0 0 4px">الاسم: ' + esc(settings.signerName || settings.managerName || 'م. محمد عباس المكرمي') + '</p>' +
        '<p style="font-size:13px;margin:0 0 8px">التاريخ: ' + formatDate(v.approvedAt, false) + ' م</p>' + signatureHtml + '</div>' +
        '<div data-role="permit-stamp" style="min-width:110px;text-align:center">' + stampHtml + '</div></div>' +
      '<div data-role="permit-qr" style="display:flex;justify-content:flex-start;margin-top:18px;padding-top:12px;border-top:1px solid #e2e8f0"><div style="text-align:center">' +
          '<img src="' + esc(v.qrDataUrl || '') + '" alt="QR تصريح الزيارة" style="width:105px;height:105px;display:block;image-rendering:pixelated">' +
          '<div style="font-size:10px;font-weight:800;margin-top:3px;color:#1e3c72">' + esc(v.serialNumber || 'مسودة') + '</div></div></div>';
    return node;
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
