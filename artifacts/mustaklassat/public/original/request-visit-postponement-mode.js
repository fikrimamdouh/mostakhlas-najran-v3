(function () {
  'use strict';

  var REASONS = [
    { code: 'site_not_ready', label: 'الموقع غير جاهز لاستقبال الزيارة' },
    { code: 'operational_conflict', label: 'تعارض مع أعمال أو تشغيل داخل الموقع' },
    { code: 'access_unavailable', label: 'تعذر توفير الدخول أو التصاريح اللازمة' },
    { code: 'safety_emergency', label: 'حالة طارئة أو متطلبات سلامة بالموقع' },
    { code: 'coordination_incomplete', label: 'عدم اكتمال التنسيق مع الجهة المختصة' },
    { code: 'site_request', label: 'طلب إدارة الموقع تغيير الموعد' },
    { code: 'other', label: 'سبب آخر' }
  ];

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function reasonOptions() {
    return '<option value="">اختر سبب التأجيل</option>' +
      REASONS.map(function (reason) {
        return '<option value="' + esc(reason.code) + '">' +
          esc(reason.label) +
          '</option>';
      }).join('');
  }

  function setMode(mode) {
    var deferred = mode === 'deferred';
    var visitForm = document.getElementById('visit-form');
    var newButton = document.getElementById('request-mode-new');
    var deferredButton = document.getElementById('request-mode-postpone');
    var fields = document.getElementById('deferred-visit-fields');
    var reason = document.getElementById('deferred-reason');
    var details = document.getElementById('deferred-details');
    var submit = document.getElementById('submit-btn');
    var dateLabel = document.querySelector('label[for="f_date"]');
    var requestNotice = visitForm &&
      visitForm.querySelector('.shared-grid .info-banner');

    document.body.dataset.visitRequestMode = deferred ? 'deferred' : 'new';

    if (newButton) newButton.classList.toggle('active', !deferred);
    if (deferredButton) deferredButton.classList.toggle('active', deferred);
    if (fields) fields.hidden = !deferred;

    if (reason) {
      reason.required = deferred;
      if (!deferred) reason.value = '';
    }

    if (details) {
      details.required = deferred && reason && reason.value === 'other';
      if (!deferred) details.value = '';
    }

    if (dateLabel) {
      dateLabel.innerHTML = deferred
        ? '<i class="fas fa-calendar-day"></i> تاريخ الزيارة المؤجلة المطلوب'
        : '<i class="fas fa-calendar-alt"></i> تاريخ الزيارة';
    }

    if (requestNotice) {
      requestNotice.innerHTML = deferred
        ? '<i class="fas fa-calendar-day"></i> سيتم تسجيل الطلب مباشرة كزيارة مؤجلة، دون إنشاء زيارة سابقة أولاً.'
        : '<i class="fas fa-tools"></i> نوع الطلب: زيارة جديدة لأنظمة المستشفى.';
    }

    if (submit) {
      submit.innerHTML = deferred
        ? '<i class="fas fa-calendar-day"></i> إرسال طلب الزيارة المؤجلة'
        : '<i class="fas fa-paper-plane"></i> إرسال طلب الزيارة الجديدة';
    }
  }

  function installUi() {
    if (document.getElementById('hospital-request-mode')) return;

    var visitForm = document.getElementById('visit-form');
    var visitorsWrap = document.getElementById('visitors-wrap');

    if (!visitForm || !visitorsWrap) return;

    var style = document.createElement('style');
    style.textContent =
      '.request-mode-card{margin:0 0 22px;border:1px solid #dbe3ef;border-radius:14px;padding:16px;background:#f8fafc}' +
      '.request-mode-title{font-weight:800;color:#1e3c72;margin-bottom:10px}' +
      '.request-mode-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}' +
      '.request-mode-button{border:1.5px solid #cbd5e1;border-radius:11px;padding:12px;background:#fff;color:#334155;font:800 14px Tajawal;cursor:pointer}' +
      '.request-mode-button.active{background:linear-gradient(135deg,#1e3c72,#2a5298);border-color:#1e3c72;color:#fff}' +
      '.deferred-visit-fields{margin-top:20px;border:1px solid #fed7aa;border-radius:14px;padding:16px;background:#fff7ed}' +
      '@media(max-width:650px){.request-mode-actions{grid-template-columns:1fr}}';

    document.head.appendChild(style);

    var modeCard = document.createElement('section');
    modeCard.id = 'hospital-request-mode';
    modeCard.className = 'request-mode-card';
    modeCard.innerHTML =
      '<div class="request-mode-title"><i class="fas fa-list-check"></i> اختر نوع الطلب</div>' +
      '<div class="request-mode-actions">' +
        '<button id="request-mode-new" type="button" class="request-mode-button active">' +
          '<i class="fas fa-calendar-plus"></i> طلب زيارة جديدة' +
        '</button>' +
        '<button id="request-mode-postpone" type="button" class="request-mode-button">' +
          '<i class="fas fa-calendar-day"></i> طلب زيارة مؤجلة' +
        '</button>' +
      '</div>';

    visitForm.parentNode.insertBefore(modeCard, visitForm);

    var fields = document.createElement('section');
    fields.id = 'deferred-visit-fields';
    fields.className = 'deferred-visit-fields';
    fields.hidden = true;
    fields.innerHTML =
      '<div class="section-title" style="margin-top:0">' +
        '<i class="fas fa-calendar-day"></i> بيانات الزيارة المؤجلة' +
      '</div>' +
      '<div class="shared-grid">' +
        '<div class="input-group">' +
          '<label for="deferred-reason">سبب التأجيل</label>' +
          '<select id="deferred-reason">' + reasonOptions() + '</select>' +
        '</div>' +
        '<div class="input-group">' +
          '<label for="deferred-details">تفاصيل السبب</label>' +
          '<input id="deferred-details" maxlength="1000" placeholder="اكتب التفاصيل عند الحاجة">' +
        '</div>' +
        '<div class="input-group full">' +
          '<div class="info-banner">' +
            '<i class="fas fa-circle-info"></i> اختر النظام والشركة والمندوب والتاريخ كالمعتاد. الطلب سيصل للإدارة باسم زيارة مؤجلة.' +
          '</div>' +
        '</div>' +
      '</div>';

    var visitorsTitle = visitorsWrap.previousElementSibling;
    visitForm.insertBefore(
      fields,
      visitorsTitle || document.getElementById('submit-btn')
    );

    document.getElementById('request-mode-new')
      .addEventListener('click', function () {
        setMode('new');
      });

    document.getElementById('request-mode-postpone')
      .addEventListener('click', function () {
        setMode('deferred');
      });

    document.getElementById('deferred-reason')
      .addEventListener('change', function () {
        var details = document.getElementById('deferred-details');
        details.required =
          document.body.dataset.visitRequestMode === 'deferred' &&
          this.value === 'other';
      });

    setMode('new');
  }

  installUi();
})();
