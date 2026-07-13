/* review-labor-final-snapshot-exact.js — V1
 * يعرض العمالة العادية من finalReviewSnapshot فقط عند وجودها.
 * يمنع رجوع شاشة المراجعة لحساب الحضور/الأداء من localStorage أو snapshot الخام.
 */
(function () {
  'use strict';
  var loc = location.pathname + location.search;
  if (!/(approval|review_extract)\.html/.test(loc)) return;
  if (window.__NAJRAN_LABOR_FINAL_SNAPSHOT_EXACT_V1__) return;
  window.__NAJRAN_LABOR_FINAL_SNAPSHOT_EXACT_V1__ = true;

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
  function optionalNum(v) {
    if (v == null || String(v).trim() === '') return null;
    var n = Number(String(v).replace(/,/g, '').replace(/[^0-9.\-]/g, ''));
    return isFinite(n) ? n : null;
  }
  function money(v) {
    return Number(v == null ? 0 : v).toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' });
  }
  function clean(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
  function token() {
    try { return (JSON.parse(localStorage.getItem('najran_session') || '{}') || {}).clerkToken || ''; } catch (_) { return ''; }
  }
  function snap(e) {
    var d = parse(e && e.extractData, {});
    return parse(d.localStorageSnapshot || d.storageSnapshot || d.snapshot || d.submittedData || d.extractData || d, {});
  }
  function findFinalSnapshot(e) {
    var s = snap(e);
    var frs = parse(s.finalReviewSnapshot, null);
    if (frs && frs.schema && String(frs.schema).indexOf('final_review_snapshot') > -1) return frs;
    var direct = parse((e && e.extractData && e.extractData.finalReviewSnapshot), null);
    if (direct && direct.schema && String(direct.schema).indexOf('final_review_snapshot') > -1) return direct;
    return null;
  }
  function parseDate(v) {
    if (!v) return null;
    var d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  function daysCount(start, end) {
    var s = parseDate(start), e = parseDate(end);
    if (!s || !e) return '—';
    return Math.max(1, Math.ceil((e - s) / 86400000) + 1);
  }
  function fmtDate(v) {
    try {
      var d = parseDate(v);
      return d ? d.toLocaleDateString('en-CA') : '—';
    } catch (_) { return '—'; }
  }
  function stat(title, value, cls) {
    return '<div class="rv-stat ' + (cls || '') + '"><span>' + esc(title) + '</span><b>' + esc(value) + '</b></div>';
  }
  function actionButtons(e) {
    if (String(e.status || '') === 'approved') return '';
    return '<section id="rv-decision" class="rv-no-print"><h3>قرار المراجع</h3>' +
      '<textarea id="rv-notes" placeholder="اكتب الملاحظة هنا عند طلب التعديل أو الرفض. الاعتماد لا يحتاج ملاحظة.">' + esc(e.adminNotes || '') + '</textarea>' +
      '<div class="rv-actions"><button class="rv-act review" data-rv-status="under_review">بدء المراجعة</button>' +
      '<button class="rv-act revision" data-rv-status="needs_revision">طلب تعديل</button>' +
      '<button class="rv-act approve" data-rv-status="approved">اعتماد</button>' +
      '<button class="rv-act reject" data-rv-status="rejected">رفض</button></div></section>';
  }
  function rowsFromFinal(frs) {
    var table = parse(frs.table, {});
    var headers = Array.isArray(table.headers) ? table.headers : [];
    var rows = Array.isArray(frs.displayRows) ? frs.displayRows : (Array.isArray(table.rows) ? table.rows : []);
    if (!rows.length) return '<div class="rv-empty">لا توجد صفوف محفوظة داخل اللقطة النهائية.</div>';
    if (!headers.length) {
      var longest = rows.reduce(function (m, r) { return Math.max(m, Array.isArray(r.cells) ? r.cells.length : 0); }, 0);
      for (var i = 0; i < longest; i++) headers.push('عمود ' + (i + 1));
    }
    var body = rows.map(function (r) {
      var cells = Array.isArray(r.cells) ? r.cells : headers.map(function (h) { return r[h] == null ? '' : r[h]; });
      var cls = r.rowType === 'total' ? ' class="total"' : r.rowType === 'tafqeet' ? ' class="tafq-row"' : '';
      return '<tr' + cls + '>' + headers.map(function (_, i) { return '<td>' + esc(cells[i] == null ? '' : cells[i]) + '</td>'; }).join('') + '</tr>';
    }).join('');
    return '<div class="rv-block rv-print-block"><div class="rv-block-title"><h4>شهادة الإنجاز المحفوظة وقت الرفع</h4><span>Snapshot نهائي مغلق</span></div>' +
      '<div class="rv-scroll"><table class="rv-table generic"><thead><tr>' + headers.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' + body + '</tbody></table></div></div>';
  }
  function signatureGroup(title, list) {
    list = Array.isArray(list) ? list : [];
    var cards = list.map(function (item) {
      item = item && typeof item === 'object' ? item : { name: item };
      var role = clean(item.title || item.role || item.position || item.label || 'توقيع');
      var name = clean(item.name || item.signer || item.value || '—');
      return '<div class="rv-stat primary"><span>' + esc(role) + '</span><b style="font-size:16px">' + esc(name) + '</b></div>';
    }).join('');
    if (!cards) cards = '<div class="rv-empty">لم تكن هناك توقيعات مسجلة لهذا القسم وقت الرفع.</div>';
    return '<div class="rv-block rv-print-block"><div class="rv-block-title"><h4>' + esc(title) + '</h4><span>' + list.length + ' توقيع</span></div><div class="rv-main-stats" style="padding:16px">' + cards + '</div></div>';
  }
  function signaturesFromFinal(frs) {
    var signatures = parse(frs && frs.signatures, {});
    return signatureGroup('توقيعات الحضور والانصراف', signatures.attendance) +
      signatureGroup('توقيعات جداول الأداء', signatures.performance) +
      signatureGroup('توقيعات شهادة الإنجاز', signatures.achievement);
  }
  function renderExact(e, frs) {
    var m = frs.meta || {};
    var totals = frs.achievementTotals || {};
    var frozenFinal = optionalNum(frs.finalAmount && frs.finalAmount.value);
    var totalsFinal = optionalNum(totals.netMonthly);
    var extractFinal = optionalNum(e.totalAmount);
    var final = frozenFinal !== null ? frozenFinal : totalsFinal !== null ? totalsFinal : extractFinal !== null ? extractFinal : 0;
    var monthly = num(totals.monthlyValue);
    var deductions = num(totals.absenceDeduction) + num(totals.absencePenalty) + num(totals.performancePenalty) + num(totals.nationalityPenalty);
    var days = daysCount(m.extractStart || e.extractStart, m.extractEnd || e.extractEnd);
    var status = e.status || '—';

    var html = '<div class="rv-doc" data-labor-final-snapshot-exact="1"><header class="rv-doc-head"><div><h2>مستخلص العمالة</h2>' +
      '<p>' + esc(m.hospitalName || e.hospitalName || e.submittedByHospital || '—') + ' — ' + esc(m.companyName || e.companyName || '—') + ' — ' + esc(m.period || e.periodMonth || '—') + ' — دفعة ' + esc(m.paymentNumber || e.paymentNumber || '—') + '</p>' +
      '<small style="display:block;margin-top:6px;color:#64748b;font-weight:900">مصدر العرض: finalReviewSnapshot — ممنوع إعادة الحساب</small></div><b>' + esc(status) + '</b></header>';
    // أقسام التفاصيل من snapshot المرفوع فقط (نفس عارضي المسار الكامل) — الإجماليات تبقى من frs بلا إعادة حساب.
    var sections = window.__najranReviewLaborSections || null;
    var s = snap(e);

    // Diagnostic صريح — لا تخمين لاحقًا: يوضّح فورًا هل السبب cache قديم
    // (sections غير موجود = auth-check.js حمّل نسخة قديمة من review-workflow.js)
    // أم snapshot ناقص من السيرفر (مفاتيح الحضور/الأداء غير موجودة أصلًا).
    (function diagnostics() {
      try {
        var snapKeys = Object.keys(s || {});
        var attKeys = snapKeys.filter(function (k) { return /attendance/i.test(k) || /^dept_/i.test(k); });
        var perfKeys = snapKeys.filter(function (k) { return /^tableData_/i.test(k) || /performance/i.test(k); });
        console.info('[LaborFinalSnapshotExact][diagnostic] extractId=' + e.id, {
          sectionsAvailable: !!sections,
          attendanceKeysInSnapshot: attKeys,
          performanceKeysInSnapshot: perfKeys,
          allSnapshotKeys: snapKeys
        });
        if (!sections) {
          console.warn('[LaborFinalSnapshotExact][diagnostic] window.__najranReviewLaborSections غير موجود — على الأغلب review-workflow.js نسخة قديمة من الـcache (تحقق من version query في auth-check.js).');
        }
        if (sections && !attKeys.length) {
          console.warn('[LaborFinalSnapshotExact][diagnostic] لا توجد مفاتيح حضور (attendanceData/dept_*) داخل extractData — الأرجح أن submitted_extract_archive_bundle_guard.js كان نسخة قديمة وقت رفع هذا المستخلص (حذفت المفاتيح الخام قبل الحفظ). هذا المستخلص بالذات يحتاج إعادة رفع، لا إصلاح عرض.');
        }
      } catch (diagErr) { console.warn('[LaborFinalSnapshotExact][diagnostic] فشل التشخيص', diagErr); }
    })();

    var attHtml = '', perfHtml = '';
    if (sections) {
      try {
        var pi = sections.periodInfo(sections.meta(e));
        attHtml = sections.attendanceHtml(s, pi) || '';
        perfHtml = sections.performanceHtml(s) || '';
        console.info('[LaborFinalSnapshotExact][diagnostic] attendanceHtml length=' + attHtml.length + ' performanceHtml length=' + perfHtml.length);
      } catch (err) { console.warn('[LaborFinalSnapshotExact] detail sections skipped', err); }
    }
    // القسمان يظهران دائمًا (حتى لو فارغين) بدل إخفائهما بصمت — رسالة واضحة
    // تفرّق بين "لا بيانات محفوظة" و"تعطّل العرض"، بدل قسم مفقود بلا تفسير.
    if (!attHtml) attHtml = '<div class="rv-empty">لا توجد بيانات حضور محفوظة داخل هذا المستخلص — راجع الـconsole للتشخيص.</div>';
    if (!perfHtml) perfHtml = '<div class="rv-empty">لا توجد بيانات أداء محفوظة داخل هذا المستخلص — راجع الـconsole للتشخيص.</div>';
    html += '<nav class="rv-tabs"><a href="#rv-summary" class="rv-nav-card"><b>ملخص المراجعة</b><span>لقطة نهائية</span></a>' +
      (attHtml ? '<a href="#rv-attendance" class="rv-nav-card"><b>الحضور والانصراف</b><span>من snapshot المرفوع</span></a>' : '') +
      (perfHtml ? '<a href="#rv-performance" class="rv-nav-card"><b>شهادة الأداء الشهري</b><span>من snapshot المرفوع</span></a>' : '') +
      '<a href="#rv-achievement" class="rv-nav-card"><b>شهادة الإنجاز</b><span>نفس جدول المستخدم</span></a>' +
      '<a href="#rv-signatures" class="rv-nav-card"><b>التوقيعات</b><span>محفوظة وقت الرفع</span></a></nav>';
    html += '<section id="rv-summary"><h3>ملخص المراجعة</h3><div class="rv-period-note" style="background:#f0fdf4;border-color:#86efac;color:#166534"><b>✓ يتم العرض من لقطة المستخدم النهائية فقط — لا إعادة حساب من localStorage أو الحضور الخام</b></div>';
    html += '<div class="rv-main-stats">' +
      stat('نوع المستخلص', 'مستخلص العمالة', 'primary') +
      stat('رقم الدفعة', m.paymentNumber || e.paymentNumber || '—', 'primary') +
      stat('مدة المستخلص', days === '—' ? '—' : days + ' يوم', 'primary') +
      stat('قيمة الكارت / الصافي النهائي', money(final), 'ok') +
      '</div>';
    html += '<div class="rv-info-grid"><div><b>الفترة</b><span>' + esc(m.period || e.periodMonth || '—') + '</span></div><div><b>من تاريخ</b><span>' + esc(fmtDate(m.extractStart || e.extractStart)) + '</span></div><div><b>إلى تاريخ</b><span>' + esc(fmtDate(m.extractEnd || e.extractEnd)) + '</span></div><div><b>Snapshot</b><span>' + esc(frs.schema || '—') + '</span></div><div><b>noRecalculate</b><span>' + esc(frs.noRecalculate === true ? 'true' : '—') + '</span></div></div></section>';
    if (attHtml) html += '<section id="rv-attendance" class="rv-section-break"><h3>الحضور والانصراف</h3>' + attHtml + '</section>';
    if (perfHtml) html += '<section id="rv-performance" class="rv-section-break"><h3>شهادة الأداء الشهري</h3>' + perfHtml + '</section>';
    html += '<section id="rv-achievement" class="rv-section-break"><h3>شهادة الإنجاز</h3><div class="rv-main-stats">' +
      stat('القيمة قبل الحسميات', money(monthly), 'primary') +
      stat('إجمالي الحسميات والغرامات', money(deductions), deductions > 0 ? 'warn' : 'ok') +
      stat('الصافي النهائي', money(final), 'ok') +
      stat('مصدر الصافي', (frs.finalAmount && frs.finalAmount.source) || 'finalReviewSnapshot', 'primary') +
      '</div>' + rowsFromFinal(frs) + '</section>' +
      '<section id="rv-signatures" class="rv-section-break"><h3>التوقيعات المحفوظة وقت الرفع</h3>' + signaturesFromFinal(frs) + '</section>' +
      actionButtons(e) + '</div>';
    return html;
  }
  async function findExtract(id) {
    var tk = token();
    // P0: القوائم لا ترجع extractData — نجلب السجل الكامل (snapshot المرفوع) من /:id فقط.
    var res = await fetch('/api/submitted-extracts/' + encodeURIComponent(id), { headers: tk ? { Authorization: 'Bearer ' + tk } : {}, credentials: 'include' });
    if (!res.ok) throw new Error('api');
    return await res.json();
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
    if (window.rvOpenExtract.__laborFinalSnapshotExactV1) return;
    var old = window.rvOpenExtract;
    window.rvOpenExtract = async function (id) {
      await old.apply(this, arguments);
      try {
        var e = await findExtract(id);
        if (!e || String(e.extractType || '') !== 'labor') return;
        var frs = findFinalSnapshot(e);
        if (!frs) return;
        var body = document.getElementById('rv-body');
        if (!body) return;
        body.innerHTML = renderExact(e, frs);
        bindActions(id);
        console.warn('[LaborFinalSnapshotExact] rendered finalReviewSnapshot without recalculation', {
          id: id,
          amount: frs.finalAmount && frs.finalAmount.value,
          rows: frs.displayRows && frs.displayRows.length
        });
      } catch (err) {
        console.warn('[LaborFinalSnapshotExact] exact render skipped', err);
      }
    };
    window.rvOpenExtract.__laborFinalSnapshotExactV1 = true;
    console.info('[LaborFinalSnapshotExact] installed v1');
  }
  install(0);
})();
