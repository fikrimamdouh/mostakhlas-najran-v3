(function () {
  'use strict';

  var currentQr = null;
  var deferredPurposeByVisitId = Object.create(null);

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function requestUrl(input) {
    if (typeof input === 'string') return input;
    if (input && typeof input.url === 'string') return input.url;
    return '';
  }

  function captureBootstrap(body) {
    deferredPurposeByVisitId = Object.create(null);
    (body && Array.isArray(body.pending) ? body.pending : []).forEach(function (visit) {
      var purpose = String(visit && visit.purpose || '');
      if (purpose.indexOf('طلب زيارة مؤجلة') === 0) {
        deferredPurposeByVisitId[String(visit.id)] = purpose;
      }
    });
    decoratePendingRows();
  }

  function installBootstrapCapture() {
    if (window.__najranVisitBootstrapCaptureInstalled) return;
    window.__najranVisitBootstrapCaptureInstalled = true;

    var originalFetch = window.fetch.bind(window);
    window.fetch = async function (input, init) {
      var response = await originalFetch(input, init);
      var url = requestUrl(input);
      if (response.ok && /\/api\/visits\/management\/bootstrap(?:\?|$)/.test(url)) {
        response.clone().json().then(captureBootstrap).catch(function () {});
      }
      return response;
    };
  }

  function decoratePendingRows() {
    var body = document.getElementById('incoming-body');
    if (!body) return;

    body.querySelectorAll('tr').forEach(function (row) {
      var action = row.querySelector('[data-link], [data-preview]');
      if (!action) return;
      var visitId = String(action.getAttribute('data-link') || action.getAttribute('data-preview') || '');
      var purpose = deferredPurposeByVisitId[visitId];
      if (!purpose || row.dataset.deferredVisitDecorated === '1') return;

      var cells = row.querySelectorAll('td');
      if (!cells.length) return;

      row.dataset.deferredVisitDecorated = '1';
      var badge = document.createElement('span');
      badge.className = 'badge badge-pending';
      badge.style.marginRight = '6px';
      badge.textContent = 'زيارة مؤجلة';
      cells[0].appendChild(document.createElement('br'));
      cells[0].appendChild(badge);

      if (cells[4]) {
        var reason = purpose.replace(/^طلب زيارة مؤجلة\s*[—-]?\s*/, '');
        if (reason) {
          var reasonNode = document.createElement('small');
          reasonNode.style.display = 'block';
          reasonNode.style.marginTop = '4px';
          reasonNode.style.color = '#92400e';
          reasonNode.textContent = reason;
          cells[4].appendChild(reasonNode);
        }
      }
    });
  }

  function observePendingRows() {
    var attempts = 0;
    var timer = setInterval(function () {
      attempts += 1;
      var body = document.getElementById('incoming-body');
      if (!body) {
        if (attempts > 40) clearInterval(timer);
        return;
      }
      clearInterval(timer);
      new MutationObserver(decoratePendingRows).observe(body, { childList: true, subtree: true });
      decoratePendingRows();
    }, 250);
  }

  async function token(force) {
    var getters = [
      window.najranGetFreshToken,
      window.parent && window.parent.najranGetFreshToken,
      window.top && window.top.najranGetFreshToken
    ];
    for (var i = 0; i < getters.length; i++) {
      if (typeof getters[i] === 'function') {
        try {
          var value = await getters[i](force ? { skipCache: true } : undefined);
          if (value) return value;
        } catch (_) {}
      }
    }
    try {
      var session = JSON.parse(localStorage.getItem('najran_session') || '{}');
      if (session.clerkToken) return session.clerkToken;
    } catch (_) {}
    throw new Error('انتهت الجلسة؛ اضغط «تحديث آمن» ثم أعد المحاولة');
  }

  async function api(path, options, retried) {
    options = options || {};
    var response = await fetch('/api/visits' + path, Object.assign({}, options, {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: Object.assign({ Authorization: 'Bearer ' + await token(!!retried) }, options.headers || {})
    }));
    var body = await response.json().catch(function () { return {}; });
    if (response.status === 401 && !retried) return api(path, options, true);
    if (!response.ok) throw new Error(body.error || 'فشلت العملية');
    return body;
  }

  function toast(message, ok) {
    var node = document.getElementById('toast');
    if (!node) return;
    node.textContent = message;
    node.className = 'toast show ' + (ok ? 'ok' : 'err');
    clearTimeout(node._publicQrTimer);
    node._publicQrTimer = setTimeout(function () { node.className = 'toast'; }, 6500);
  }

  function posterHtml(result) {
    return '<div id="public-kiosk-poster" class="kiosk-poster" style="width:min(560px,100%);padding:25px">' +
      '<img class="logo" src="/original/najran_health_cluster_logo.png" alt="شعار تجمع نجران الصحي">' +
      '<h3 style="margin-bottom:1px">تجمع نجران الصحي</h3>' +
      '<div dir="ltr" style="font-size:13px;font-weight:800;color:#475569;letter-spacing:.4px;margin-bottom:6px">Najran Health Cluster</div>' +
      '<div style="font-size:14px;font-weight:900;color:#1e3c72;line-height:1.65">نموذج طلب زيارة مقاول الباطن<br><span dir="ltr">Subcontractor Visit Request</span><br><span dir="rtl">ذیلی ٹھیکیدار وزٹ درخواست</span><br><span dir="ltr">उप-ठेकेदार विज़िट अनुरोध</span></div>' +
      '<img class="qr" src="' + esc(result.qrDataUrl) + '" alt="باركود نموذج طلب زيارة">' +
      '<strong>' + esc(result.siteName || '') + '</strong>' +
      '<p>' + esc(result.maintenanceContractor || '') + '</p>' +
      '<div style="display:grid;gap:5px;font-size:12px;line-height:1.65;color:#334155;font-weight:800">' +
        '<div>امسح الرمز واختر لغتك ثم سجّل طلب الزيارة</div>' +
        '<div dir="ltr">Scan the code, choose your language, and submit the visit request</div>' +
        '<div dir="rtl">کوڈ اسکین کریں، اپنی زبان منتخب کریں اور وزٹ کی درخواست جمع کریں</div>' +
        '<div dir="ltr">कोड स्कैन करें, अपनी भाषा चुनें और विज़िट अनुरोध जमा करें</div>' +
      '</div></div>' +
      '<div class="actions" style="justify-content:center"><button type="button" class="btn btn-green" id="public-kiosk-pdf"><i class="fas fa-file-pdf"></i> تحميل بوستر PDF</button><button type="button" class="btn btn-light" id="public-kiosk-png"><i class="fas fa-qrcode"></i> تحميل الباركود PNG</button><button type="button" class="btn btn-primary" id="public-kiosk-copy"><i class="fas fa-link"></i> نسخ الرابط</button><a class="btn btn-light" href="' + esc(result.requestUrl) + '" target="_blank" rel="noopener">فتح النموذج</a></div>';
  }

  async function generate(button) {
    if (button) button.disabled = true;
    try {
      var form = document.getElementById('kiosk-form');
      var maintenanceSelect = form && form.elements && form.elements.maintenanceContractorKey;
      var siteSelect = form && form.elements && form.elements.siteName;

      if (!maintenanceSelect || !siteSelect) {
        throw new Error('حقول الموقع ومقاول الصيانة غير متاحة؛ حدّث الصفحة تحديثًا آمنًا');
      }
      if (!maintenanceSelect.value || !siteSelect.value) {
        throw new Error('اختر مقاول الصيانة والموقع أولًا');
      }

      var result = await api('/management/request-form-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maintenanceContractorKey: maintenanceSelect.value,
          siteName: siteSelect.value
        })
      });
      currentQr = result;

      var preview = document.getElementById('kiosk-preview');
      if (!preview) throw new Error('منطقة معاينة الباركود غير متاحة');
      preview.innerHTML = posterHtml(result);

      document.getElementById('public-kiosk-png').addEventListener('click', function () {
        var link = document.createElement('a');
        link.href = result.qrDataUrl;
        link.download = 'باركود-نموذج-طلب-زيارة-' + (result.siteName || 'الموقع') + '.png';
        link.click();
      });
      document.getElementById('public-kiosk-pdf').addEventListener('click', downloadPoster);
      document.getElementById('public-kiosk-copy').addEventListener('click', async function () {
        try {
          await navigator.clipboard.writeText(result.requestUrl);
          toast('تم نسخ رابط نموذج الزيارة', true);
        } catch (_) {
          toast('تعذر النسخ التلقائي؛ افتح النموذج وانسخ الرابط من المتصفح', false);
        }
      });
      toast('تم تجهيز باركود نموذج طلب الزيارة للموقع المحدد', true);
    } catch (error) {
      toast(error.message || 'تعذر تجهيز الباركود', false);
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function downloadPoster() {
    var poster = document.getElementById('public-kiosk-poster');
    var button = document.getElementById('public-kiosk-pdf');
    if (!poster || !currentQr || !window.html2canvas || !window.jspdf || !window.jspdf.jsPDF) {
      return toast('مكتبة تجهيز البوستر غير متاحة', false);
    }
    button.disabled = true;
    try {
      var canvas = await window.html2canvas(poster, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });
      var pdf = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      var width = pdf.internal.pageSize.getWidth() - 30;
      var height = canvas.height * width / canvas.width;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 15, 15, width, Math.min(height, pdf.internal.pageSize.getHeight() - 30));
      pdf.save('بوستر-نموذج-طلب-زيارة-' + (currentQr.siteName || 'الموقع') + '.pdf');
      toast('تم تجهيز البوستر للطباعة', true);
    } catch (error) {
      toast(error.message || 'تعذر تجهيز البوستر', false);
    } finally {
      button.disabled = false;
    }
  }

  function install() {
    var form = document.getElementById('kiosk-form');
    var preview = document.getElementById('kiosk-preview');
    if (!form || !preview || form.dataset.publicKioskInstalled === '1') return false;

    form.dataset.publicKioskInstalled = '1';
    var card = form.closest('.card');
    var title = card && card.querySelector('h3');
    var note = card && card.querySelector('.note');
    if (title) title.textContent = 'باركود نموذج طلب زيارة مقاول الباطن';
    if (note) note.textContent = 'اختر مقاول الصيانة والموقع ثم جهّز الباركود. تظل القوائم الأصلية موجودة ولا يتم استبدالها.';

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      generate(form.querySelector('button[type="submit"]'));
    });
    return true;
  }

  installBootstrapCapture();
  observePendingRows();

  var attempts = 0;
  var timer = setInterval(function () {
    attempts += 1;
    if (install() || attempts > 40) clearInterval(timer);
  }, 250);
})();
