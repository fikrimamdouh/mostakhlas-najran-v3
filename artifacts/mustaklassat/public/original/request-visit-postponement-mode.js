(function () {
  'use strict';

  var visits = [];
  var reasons = [];

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  async function token(force) {
    var getters = [window.najranGetFreshToken, window.parent && window.parent.najranGetFreshToken, window.top && window.top.najranGetFreshToken];
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

  function showMessage(message, type) {
    var node = document.getElementById('status-message');
    if (!node) return;
    node.textContent = message;
    node.className = type;
    node.style.display = 'block';
    clearTimeout(node._postponementTimer);
    node._postponementTimer = setTimeout(function () { node.style.display = 'none'; }, 7000);
  }

  function dateText(value) {
    if (!value) return '—';
    try { return new Date(String(value).slice(0, 10) + 'T12:00:00').toLocaleDateString('ar-SA'); }
    catch (_) { return String(value); }
  }

  function nextDay(value) {
    var date = new Date(String(value || '').slice(0, 10) + 'T12:00:00.000Z');
    if (Number.isNaN(date.getTime())) date = new Date();
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
  }

  function eligibleVisits() {
    return visits.filter(function (visit) {
      return (visit.status === 'pending' || visit.status === 'approved') && !(visit.postponement && visit.postponement.status === 'pending');
    });
  }

  function renderVisitOptions(selected) {
    var select = document.getElementById('hospital-postponement-visit');
    if (!select) return;
    var rows = eligibleVisits();
    select.innerHTML = '<option value="">اختر الزيارة المطلوب تأجيلها</option>' + rows.map(function (visit) {
      var label = [visit.serialNumber || ('زيارة ' + visit.id), visit.repName, visit.siteLocation, dateText(visit.visitDate)].filter(Boolean).join(' — ');
      return '<option value="' + visit.id + '"' + (String(selected || '') === String(visit.id) ? ' selected' : '') + '>' + esc(label) + '</option>';
    }).join('');
    if (!rows.length) select.innerHTML = '<option value="">لا توجد زيارة متاحة للتأجيل حاليًا</option>';
    renderSummary();
  }

  function renderSummary() {
    var select = document.getElementById('hospital-postponement-visit');
    var summary = document.getElementById('hospital-postponement-summary');
    if (!select || !summary) return;
    var visit = visits.find(function (row) { return String(row.id) === String(select.value); });
    if (!visit) {
      summary.textContent = 'اختر زيارة من طلباتك السابقة، ثم حدد التاريخ الجديد وسبب التأجيل.';
      return;
    }
    summary.innerHTML = '<strong>' + esc(visit.repName || '—') + '</strong> — ' + esc(visit.siteLocation || '—') + '<br>الموعد الحالي: ' + esc(dateText(visit.visitDate)) + ' — النظام: ' + esc(visit.systemName || '—') + ' — الشركة: ' + esc(visit.subContractor || '—');
    var requestedDate = document.getElementById('hospital-postponement-date');
    requestedDate.min = nextDay(visit.visitDate);
    if (!requestedDate.value || requestedDate.value <= String(visit.visitDate || '').slice(0, 10)) requestedDate.value = nextDay(visit.visitDate);
  }

  function setMode(mode) {
    var visitForm = document.getElementById('visit-form');
    var postponementForm = document.getElementById('hospital-postponement-form');
    var newButton = document.getElementById('request-mode-new');
    var postponeButton = document.getElementById('request-mode-postpone');
    var isPostpone = mode === 'postpone';
    if (visitForm) visitForm.style.display = isPostpone ? 'none' : '';
    if (postponementForm) postponementForm.hidden = !isPostpone;
    if (newButton) newButton.classList.toggle('active', !isPostpone);
    if (postponeButton) postponeButton.classList.toggle('active', isPostpone);
    if (isPostpone) renderVisitOptions();
  }

  function installUi() {
    if (document.getElementById('hospital-request-mode')) return;
    var visitForm = document.getElementById('visit-form');
    if (!visitForm) return;

    var style = document.createElement('style');
    style.textContent = '.request-mode-card{margin:0 0 22px;border:1px solid #dbe3ef;border-radius:14px;padding:16px;background:#f8fafc}.request-mode-title{font-weight:800;color:#1e3c72;margin-bottom:10px}.request-mode-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.request-mode-button{border:1.5px solid #cbd5e1;border-radius:11px;padding:12px;background:#fff;color:#334155;font:800 14px Tajawal;cursor:pointer}.request-mode-button.active{background:linear-gradient(135deg,#1e3c72,#2a5298);border-color:#1e3c72;color:#fff}.hospital-postponement-form{border:1px solid #dbe3ef;border-radius:14px;padding:18px;background:#fff}.hospital-postponement-form .shared-grid{margin-top:12px}.hospital-postponement-summary{background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;border-radius:10px;padding:11px 13px;line-height:1.7;font-size:12px}@media(max-width:650px){.request-mode-actions{grid-template-columns:1fr}}';
    document.head.appendChild(style);

    var mode = document.createElement('section');
    mode.id = 'hospital-request-mode';
    mode.className = 'request-mode-card';
    mode.innerHTML = '<div class="request-mode-title"><i class="fas fa-list-check"></i> اختر نوع الطلب</div><div class="request-mode-actions"><button id="request-mode-new" type="button" class="request-mode-button active"><i class="fas fa-calendar-plus"></i> طلب زيارة جديدة</button><button id="request-mode-postpone" type="button" class="request-mode-button"><i class="fas fa-calendar-day"></i> طلب تأجيل زيارة</button></div>';
    visitForm.parentNode.insertBefore(mode, visitForm);

    var form = document.createElement('form');
    form.id = 'hospital-postponement-form';
    form.className = 'hospital-postponement-form';
    form.hidden = true;
    form.innerHTML = '<div class="section-title" style="margin-top:0"><i class="fas fa-calendar-day"></i> بيانات طلب تأجيل الزيارة</div><div id="hospital-postponement-summary" class="hospital-postponement-summary">اختر زيارة من طلباتك السابقة، ثم حدد التاريخ الجديد وسبب التأجيل.</div><div class="shared-grid"><div class="input-group full"><label for="hospital-postponement-visit">الزيارة المطلوب تأجيلها</label><select id="hospital-postponement-visit" required></select></div><div class="input-group"><label for="hospital-postponement-date">التاريخ الجديد المطلوب</label><input id="hospital-postponement-date" type="date" required></div><div class="input-group"><label for="hospital-postponement-reason">سبب الموقع للتأجيل</label><select id="hospital-postponement-reason" required></select></div><div class="input-group full"><label for="hospital-postponement-details">تفاصيل السبب</label><input id="hospital-postponement-details" maxlength="1000" placeholder="اكتب تفاصيل إضافية عند الحاجة"></div></div><button id="hospital-postponement-submit" class="btn-submit" type="submit"><i class="fas fa-paper-plane"></i> إرسال طلب التأجيل للإدارة</button>';
    visitForm.parentNode.insertBefore(form, visitForm.nextSibling);

    document.getElementById('request-mode-new').addEventListener('click', function () { setMode('new'); });
    document.getElementById('request-mode-postpone').addEventListener('click', function () { setMode('postpone'); });
    document.getElementById('hospital-postponement-visit').addEventListener('change', renderSummary);
    document.getElementById('hospital-postponement-reason').addEventListener('change', function () {
      document.getElementById('hospital-postponement-details').required = this.value === 'other';
    });
    form.addEventListener('submit', submitPostponement);
  }

  async function loadData() {
    var body = await api('/');
    visits = Array.isArray(body.visits) ? body.visits : [];
    reasons = Array.isArray(body.postponementReasons) ? body.postponementReasons : [];
    var reasonSelect = document.getElementById('hospital-postponement-reason');
    if (reasonSelect) reasonSelect.innerHTML = '<option value="">اختر سبب الموقع</option>' + reasons.map(function (row) { return '<option value="' + esc(row.code) + '">' + esc(row.label) + '</option>'; }).join('');
    renderVisitOptions();
  }

  async function submitPostponement(event) {
    event.preventDefault();
    var form = event.currentTarget;
    if (!form.reportValidity()) return;
    var visitId = Number(document.getElementById('hospital-postponement-visit').value || 0);
    var button = document.getElementById('hospital-postponement-submit');
    if (!visitId) return showMessage('اختر الزيارة المطلوب تأجيلها', 'error');
    button.disabled = true;
    button.innerHTML = '<span class="spinner"></span> جارٍ إرسال طلب التأجيل...';
    try {
      await api('/' + visitId + '/postponement-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestedVisitDate: document.getElementById('hospital-postponement-date').value,
          reasonCode: document.getElementById('hospital-postponement-reason').value,
          reasonDetails: document.getElementById('hospital-postponement-details').value.trim()
        })
      });
      showMessage('تم إرسال طلب التأجيل إلى الإدارة. يظل الموعد الحالي كما هو حتى الموافقة.', 'success');
      form.reset();
      await loadData();
    } catch (error) {
      showMessage(error.message || 'تعذر إرسال طلب التأجيل', 'error');
    } finally {
      button.disabled = false;
      button.innerHTML = '<i class="fas fa-paper-plane"></i> إرسال طلب التأجيل للإدارة';
    }
  }

  installUi();
  loadData().catch(function (error) { showMessage(error.message || 'تعذر تحميل الزيارات المتاحة للتأجيل', 'error'); });
})();
