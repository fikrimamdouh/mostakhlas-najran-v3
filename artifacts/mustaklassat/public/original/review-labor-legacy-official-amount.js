/* review-labor-legacy-official-amount.js — V1
 * علاج مستخلصات العمالة القديمة التي لا تحتوي finalReviewSnapshot.
 * لا يعيد حساب القديم كأنه جديد. يعرض قيمة الكارت الرسمية كرقم حاكم ويخفي شهادة الإنجاز المحسوبة خطأ من الراتب الشهري.
 */
(function () {
  'use strict';
  var loc = location.pathname + location.search;
  if (!/(approval|review_extract)\.html/.test(loc)) return;
  if (window.__NAJRAN_LABOR_LEGACY_OFFICIAL_AMOUNT_V1__) return;
  window.__NAJRAN_LABOR_LEGACY_OFFICIAL_AMOUNT_V1__ = true;

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
  function parse(v, fb) {
    if (v == null) return fb || {};
    if (typeof v === 'object') return v;
    try { return JSON.parse(String(v)); } catch (_) { return fb || {}; }
  }
  function num(v) {
    var n = Number(String(v == null ? 0 : v).replace(/,/g, '').replace(/[^0-9.\-]/g, ''));
    return isFinite(n) ? n : 0;
  }
  function money(v) {
    return Number(v || 0).toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' });
  }
  function clean(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
  function token() {
    try { return (JSON.parse(localStorage.getItem('najran_session') || '{}') || {}).clerkToken || ''; } catch (_) { return ''; }
  }
  function snap(e) {
    var d = parse(e && e.extractData, {});
    return parse(d.localStorageSnapshot || d.storageSnapshot || d.snapshot || d.submittedData || d.extractData || d, {});
  }
  function norm(k) { return String(k || '').replace(/^(?:_u\d+_)+/, '').trim(); }
  function get(s, key) {
    if (!s || typeof s !== 'object') return undefined;
    if (Object.prototype.hasOwnProperty.call(s, key)) return parse(s[key], s[key]);
    var ks = Object.keys(s);
    for (var i = 0; i < ks.length; i++) {
      if (norm(ks[i]) === key) return parse(s[ks[i]], s[ks[i]]);
    }
    return undefined;
  }
  function hasFinalSnapshot(e) {
    var s = snap(e);
    var f = parse(get(s, 'finalReviewSnapshot'), null) || parse(e && e.extractData && e.extractData.finalReviewSnapshot, null);
    return !!(f && f.schema && String(f.schema).indexOf('final_review_snapshot') > -1);
  }
  function parseDate(v) {
    if (!v || v === '—') return null;
    var d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  function daysCount(start, end) {
    var s = parseDate(start), e = parseDate(end);
    if (!s || !e) return '—';
    return Math.max(1, Math.ceil((e - s) / 86400000) + 1);
  }
  function fmtDate(v) {
    try { var d = parseDate(v); return d ? d.toLocaleDateString('en-CA') : '—'; } catch (_) { return '—'; }
  }
  function stat(title, value, cls) {
    return '<div class="rv-stat ' + (cls || '') + '"><span>' + esc(title) + '</span><b>' + esc(value) + '</b></div>';
  }
  function extractMeta(e) {
    var s = snap(e);
    var pe = parse(get(s, 'persistentExtractData'), {});
    var pc = parse(get(s, 'persistentContractData'), {});
    return {
      paymentNumber: e.paymentNumber || pe.paymentNumber || pe.extractNumber || '—',
      period: e.periodMonth || [e.extractMonth || pe.extractMonth || '', e.extractYear || pe.extractYear || ''].filter(Boolean).join(' ') || '—',
      start: e.extractStart || pe.extractStart || pe.startDate || '—',
      end: e.extractEnd || pe.extractEnd || pe.endDate || '—',
      hospital: e.hospitalName || e.submittedByHospital || pc.hospitalName || '—',
      company: e.companyName || pc.companyName || '—'
    };
  }
  function actionButtons(e) {
    return '<section id="rv-decision" class="rv-no-print"><h3>قرار المراجع</h3>' +
      '<textarea id="rv-notes" placeholder="اكتب الملاحظة هنا عند طلب التعديل أو الرفض. الاعتماد لا يحتاج ملاحظة.">' + esc(e.adminNotes || '') + '</textarea>' +
      '<div class="rv-actions"><button class="rv-act review" data-rv-status="under_review">بدء المراجعة</button>' +
      '<button class="rv-act revision" data-rv-status="needs_revision">طلب تعديل</button>' +
      '<button class="rv-act approve" data-rv-status="approved">اعتماد</button>' +
      '<button class="rv-act reject" data-rv-status="rejected">رفض</button></div></section>';
  }
  function extractDisplayedWarnings(body) {
    try {
      var txt = clean(body && body.textContent || '');
      var nums = [];
      txt.replace(/‏?([٠-٩0-9٬,]+(?:[٫.][٠-٩0-9]+)?)\s*ر\.س/g, function (_, x) { nums.push(x); return _; });
      return nums.slice(0, 12);
    } catch (_) { return []; }
  }
  function renderLegacy(e, previousBody) {
    var m = extractMeta(e);
    var amount = num(e.totalAmount || e.totalNetAmount || 0);
    var days = daysCount(m.start, m.end);
    var status = e.status || '—';
    var observed = extractDisplayedWarnings(previousBody);
    var observedHtml = observed.length ? '<div class="rv-period-note" style="background:#fff7ed;border-color:#fdba74;color:#9a3412"><b>تنبيه:</b> تم تجاهل أرقام قديمة محسوبة من الشاشة لأنها متعارضة مع قيمة الكارت الرسمية. أول أرقام رُصدت قبل التصحيح: ' + esc(observed.join(' / ')) + '</div>' : '';
    return '<div class="rv-doc" data-labor-legacy-official="1"><header class="rv-doc-head"><div><h2>مستخلص العمالة</h2>' +
      '<p>' + esc(m.hospital) + ' — ' + esc(m.company) + ' — ' + esc(m.period) + ' — دفعة ' + esc(m.paymentNumber) + '</p>' +
      '<small style="display:block;margin-top:6px;color:#64748b;font-weight:900">مستخلص قديم بدون finalReviewSnapshot — قيمة الكارت الرسمية هي الرقم الحاكم</small></div><b>' + esc(status) + '</b></header>' +
      '<nav class="rv-tabs"><a href="#rv-summary" class="rv-nav-card"><b>ملخص المراجعة</b><span>Legacy official amount</span></a><a href="#rv-achievement" class="rv-nav-card"><b>شهادة الإنجاز</b><span>من قيمة الكارت</span></a></nav>' +
      '<section id="rv-summary"><h3>ملخص المراجعة</h3><div class="rv-period-note" style="background:#eff6ff;border-color:#93c5fd;color:#1e3a8a"><b>هذا مستخلص قديم:</b> لا توجد لقطة نهائية مغلقة داخله. لذلك لا يجوز إعادة حسابه من الحضور أو الأداء الحالي. العرض هنا يعتمد قيمة الكارت المرفوعة رسميًا.</div>' + observedHtml +
      '<div class="rv-main-stats">' + stat('نوع المستخلص', 'مستخلص العمالة', 'primary') + stat('رقم الدفعة', m.paymentNumber, 'primary') + stat('مدة المستخلص', days === '—' ? '—' : days + ' يوم', 'primary') + stat('قيمة الكارت الرسمية', money(amount), 'ok') + '</div>' +
      '<div class="rv-info-grid"><div><b>الفترة</b><span>' + esc(m.period) + '</span></div><div><b>من تاريخ</b><span>' + esc(fmtDate(m.start)) + '</span></div><div><b>إلى تاريخ</b><span>' + esc(fmtDate(m.end)) + '</span></div><div><b>مصدر الرقم</b><span>submittedExtract.totalAmount</span></div><div><b>وضع العرض</b><span>legacy-no-recalculate</span></div></div></section>' +
      '<section id="rv-achievement" class="rv-section-break"><h3>شهادة الإنجاز</h3><div class="rv-main-stats">' + stat('الصافي النهائي المعتمد', money(amount), 'ok') + stat('مصدر الصافي', 'قيمة الكارت', 'primary') + stat('إعادة الحساب', 'ممنوعة للقديم', 'warn') + stat('Snapshot النهائي', 'غير موجود', 'warn') + '</div>' +
      '<div class="rv-block rv-print-block"><div class="rv-block-title"><h4>القيمة الرسمية للمستخلص القديم</h4><span>لا يتم استخدام الحضور/الأداء لإعادة الحساب</span></div><div class="rv-scroll"><table class="rv-table generic"><thead><tr><th>البند</th><th>القيمة</th><th>المصدر</th></tr></thead><tbody><tr class="total"><td>إجمالي المستحق للمقاول</td><td><b>' + money(amount) + '</b></td><td>قيمة الكارت المخزنة عند الرفع</td></tr></tbody></table></div></div></section>' + actionButtons(e) + '</div>';
  }
  async function findExtract(id) {
    var tk = token();
    var res = await fetch('/api/submitted-extracts', { headers: tk ? { Authorization: 'Bearer ' + tk } : {}, credentials: 'include' });
    if (!res.ok) throw new Error('api');
    var data = await res.json();
    var arr = data.extracts || [];
    return arr.find(function (x) { return String(x.id) === String(id); });
  }
  function bindActions(id) {
    var body = document.getElementById('rv-body');
    if (!body) return;
    body.querySelectorAll('[data-rv-status]').forEach(function (btn) {
      btn.onclick = function () {
        if (typeof window.rvAction === 'function') window.rvAction(id, btn.getAttribute('data-rv-status'));
      };
    });
  }
  function install(attempt) {
    if (typeof window.rvOpenExtract !== 'function') {
      if ((attempt || 0) < 80) setTimeout(function () { install((attempt || 0) + 1); }, 150);
      return;
    }
    if (window.rvOpenExtract.__laborLegacyOfficialAmountV1) return;
    var old = window.rvOpenExtract;
    window.rvOpenExtract = async function (id) {
      await old.apply(this, arguments);
      try {
        var e = await findExtract(id);
        if (!e || String(e.extractType || '') !== 'labor') return;
        if (hasFinalSnapshot(e)) return;
        var amount = num(e.totalAmount || e.totalNetAmount || 0);
        if (!(amount > 0)) return;
        var body = document.getElementById('rv-body');
        if (!body) return;
        body.innerHTML = renderLegacy(e, body);
        bindActions(id);
        console.warn('[LaborLegacyOfficialAmount] rendered old labor extract from official card amount only', { id: id, amount: amount });
      } catch (err) {
        console.warn('[LaborLegacyOfficialAmount] legacy official render skipped', err);
      }
    };
    window.rvOpenExtract.__laborLegacyOfficialAmountV1 = true;
    console.info('[LaborLegacyOfficialAmount] installed v1');
  }
  install(0);
})();