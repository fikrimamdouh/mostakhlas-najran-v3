(function () {
  'use strict';

  var currentQr = null;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  async function token(force) {
    var getters = [window.najranGetFreshToken, window.parent && window.parent.najranGetFreshToken, window.top && window.top.najranGetFreshToken];
    for (var i = 0; i < getters.length; i++) {
      if (typeof getters[i] === 'function') {
        try { var value = await getters[i](force ? { skipCache: true } : undefined); if (value) return value; } catch (_) {}
      }
    }
    try { var session = JSON.parse(localStorage.getItem('najran_session') || '{}'); if (session.clerkToken) return session.clerkToken; } catch (_) {}
    throw new Error('انتهت الجلسة؛ اضغط «تحديث آمن» ثم أعد المحاولة');
  }

  async function api(path, options, retried) {
    options = options || {};
    var response = await fetch('/api/visits' + path, Object.assign({}, options, {
      credentials: 'same-origin', cache: 'no-store',
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
      '<h3 style="margin-bottom:3px">تجمع نجران الصحي</h3>' +
      '<div style="font-size:14px;font-weight:900;color:#1e3c72;line-height:1.65">نموذج طلب زيارة<br><span dir="ltr">Visit Request Form</span><br><span dir="rtl">وزٹ درخواست فارم</span><br><span dir="ltr">विज़िट अनुरोध फ़ॉर्म</span></div>' +
      '<img class="qr" src="' + esc(result.qrDataUrl) + '" alt="باركود نموذج طلب زيارة عام">' +
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
      var result = await api('/management/request-form-qr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      currentQr = result;
      var preview = document.getElementById('kiosk-preview');
      preview.innerHTML = posterHtml(result);
      document.getElementById('public-kiosk-png').addEventListener('click', function () {
        var link = document.createElement('a'); link.href = result.qrDataUrl; link.download = 'باركود-نموذج-طلب-زيارة-عام.png'; link.click();
      });
      document.getElementById('public-kiosk-pdf').addEventListener('click', downloadPoster);
      document.getElementById('public-kiosk-copy').addEventListener('click', async function () {
        try { await navigator.clipboard.writeText(result.requestUrl); toast('تم نسخ رابط نموذج الزيارة العام', true); }
        catch (_) { toast('تعذر النسخ التلقائي؛ افتح النموذج وانسخ الرابط من المتصفح', false); }
      });
      toast('تم تجهيز الباركود العام لجميع المواقع والمقاولين', true);
    } catch (error) {
      toast(error.message || 'تعذر تجهيز الباركود العام', false);
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function downloadPoster() {
    var poster = document.getElementById('public-kiosk-poster');
    var button = document.getElementById('public-kiosk-pdf');
    if (!poster || !currentQr || !window.html2canvas || !window.jspdf || !window.jspdf.jsPDF) return toast('مكتبة تجهيز البوستر غير متاحة', false);
    button.disabled = true;
    try {
      var canvas = await window.html2canvas(poster, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false });
      var pdf = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      var width = pdf.internal.pageSize.getWidth() - 30;
      var height = canvas.height * width / canvas.width;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 15, 15, width, Math.min(height, pdf.internal.pageSize.getHeight() - 30));
      pdf.save('بوستر-نموذج-طلب-زيارة-عام-أربع-لغات.pdf');
      toast('تم تجهيز البوستر العام للطباعة', true);
    } catch (error) { toast(error.message || 'تعذر تجهيز البوستر', false); }
    finally { button.disabled = false; }
  }

  function install() {
    var oldForm = document.getElementById('kiosk-form');
    var preview = document.getElementById('kiosk-preview');
    if (!oldForm || !preview || oldForm.dataset.publicKioskInstalled === '1') return false;
    var card = oldForm.closest('.card');
    var title = card && card.querySelector('h3');
    var note = card && card.querySelector('.note');
    if (title) title.textContent = 'باركود عام لنموذج طلب زيارة مقاول الباطن';
    if (note) note.textContent = 'باركود ثابت واحد لجميع المواقع والمستشفيات ومقاولي الصيانة. اطبعه وعلّقه في المكتب؛ الزائر يختار اللغة ثم الموقع والشركة والنظام داخل النموذج.';

    var form = oldForm.cloneNode(false);
    form.id = 'kiosk-form';
    form.dataset.publicKioskInstalled = '1';
    form.className = 'form-grid';
    form.style.marginTop = '12px';
    form.innerHTML = '<div class="field full"><button class="btn btn-primary" type="submit"><i class="fas fa-qrcode"></i> تجهيز الباركود العام</button></div>';
    oldForm.replaceWith(form);
    form.addEventListener('submit', function (event) { event.preventDefault(); generate(form.querySelector('button')); });
    generate(form.querySelector('button'));
    return true;
  }

  var attempts = 0;
  var timer = setInterval(function () {
    attempts += 1;
    if (install() || attempts > 30) clearInterval(timer);
  }, 250);
})();
