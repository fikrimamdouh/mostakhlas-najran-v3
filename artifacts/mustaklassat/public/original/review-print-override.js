/* review-print-override.js - review print controls + safe period/date/attendance normalization */
(function () {
  'use strict';
  if (!/\/original\/approval\.html(?:$|[?#])/.test(window.location.pathname + window.location.search)) return;

  function pad(n) { return String(n).padStart(2, '0'); }

  function toLocalDateOnly(v) {
    if (!v || typeof v !== 'string') return v;
    var s = v.trim();
    if (!/T/.test(s)) return v;
    var d = new Date(s);
    if (isNaN(d.getTime())) return v;
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function normalizePeriodKeys(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    var keys = Object.keys(obj);
    keys.forEach(function (k) {
      var v = obj[k];
      if (v && typeof v === 'object') {
        normalizePeriodKeys(v);
        return;
      }
      if (typeof v !== 'string') return;
      if (/^(extractStart|extractEnd|startDate|endDate)$/i.test(k)) obj[k] = toLocalDateOnly(v);
    });
    return obj;
  }

  function parseDateOnly(v) {
    if (!v || v === '—') return null;
    var s = String(v).trim();
    var m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    var d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  function snapshotOf(data) {
    if (!data || typeof data !== 'object') return null;
    return data.localStorageSnapshot || data.storageSnapshot || data.snapshot || data.submittedData || data;
  }

  function periodFromExtract(e, data) {
    var snap = snapshotOf(data) || {};
    var p = (data && (data.persistentExtractData || data.persistentContractData)) || snap.persistentExtractData || snap.persistentContractData || {};
    var start = e.extractStart || p.extractStart || (data && data.extractStart) || snap.extractStart || p.startDate || (data && data.startDate) || snap.startDate || null;
    var end = e.extractEnd || p.extractEnd || (data && data.extractEnd) || snap.extractEnd || p.endDate || (data && data.endDate) || snap.endDate || null;
    start = toLocalDateOnly(start);
    end = toLocalDateOnly(end);
    var st = parseDateOnly(start), en = parseDateOnly(end);
    if (!st || !en) return null;
    var duration = Math.max(1, Math.round((en - st) / 86400000) + 1);
    return { startDay: st.getDate(), endDay: en.getDate(), duration: duration, start: start, end: end };
  }

  function normalizeEmployeeDays(emp, period) {
    if (!emp || typeof emp !== 'object' || !Array.isArray(emp.days) || !period) return;
    var days = emp.days.slice();
    var endDay = period.endDay;
    var startDay = period.startDay;
    var duration = period.duration;

    // الحضور الأصلي أحيانًا يحفظ أيام الفترة ناقصة خانة واحدة رغم أن الفترة 12 يوم.
    // طالما لا توجد غياب/إجازة محفوظة لليوم الناقص، يتم إكماله كحضور فقط داخل المراجعة.
    if (startDay > 1 && days.length < duration) {
      while (days.length < duration) days.push('ح');
    }

    if (startDay > 1 && days.length <= duration + 1 && days.length < endDay) {
      var expanded = Array(endDay).fill('');
      for (var i = 0; i < duration; i++) expanded[startDay - 1 + i] = days[i] || 'ح';
      emp.days = expanded;
    }
  }

  function normalizeAttendanceDays(data, e) {
    var snap = snapshotOf(data);
    if (!snap || typeof snap !== 'object') return;
    var att = snap.attendanceData;
    if (!att || typeof att !== 'object') return;
    var period = periodFromExtract(e || {}, data || {});
    if (!period) return;
    if (Array.isArray(att)) {
      att.forEach(function (emp) { normalizeEmployeeDays(emp, period); });
      return;
    }
    Object.keys(att).forEach(function (deptKey) {
      var rows = att[deptKey];
      if (Array.isArray(rows)) rows.forEach(function (emp) { normalizeEmployeeDays(emp, period); });
    });
  }

  function normalizeExtract(e) {
    if (!e || typeof e !== 'object') return e;
    normalizePeriodKeys(e);
    if (typeof e.extractData === 'string') {
      try {
        var data = JSON.parse(e.extractData || '{}');
        normalizePeriodKeys(data);
        normalizeAttendanceDays(data, e);
        e.extractData = JSON.stringify(data);
      } catch (_) {}
    } else if (e.extractData && typeof e.extractData === 'object') {
      normalizePeriodKeys(e.extractData);
      normalizeAttendanceDays(e.extractData, e);
    }
    return e;
  }

  if (!window.__rvPeriodFetchPatched) {
    window.__rvPeriodFetchPatched = true;
    var nativeFetch = window.fetch;
    window.fetch = function () {
      var args = arguments;
      return nativeFetch.apply(this, args).then(function (res) {
        try {
          var url = String(args[0] && args[0].url ? args[0].url : args[0] || '');
          if (url.indexOf('/api/submitted-extracts') === -1 || url.indexOf('/status') !== -1) return res;
          return res.clone().json().then(function (data) {
            if (data && Array.isArray(data.extracts)) data.extracts.forEach(normalizeExtract);
            else normalizeExtract(data);
            var headers = new Headers(res.headers);
            headers.set('content-type', 'application/json; charset=utf-8');
            return new Response(JSON.stringify(data), { status: res.status, statusText: res.statusText, headers: headers });
          }).catch(function () { return res; });
        } catch (_) { return res; }
      });
    };
  }

  var EXTRA_STYLE = [
    '.rv-modal{height:calc(100vh - 16px)!important;border-radius:18px!important;grid-template-rows:auto minmax(0,1fr)!important}',
    '.rv-body{padding:14px!important;background:#eaf1f8!important}',
    '.rv-doc{max-width:none!important;width:100%!important;margin:0 auto!important;border-radius:16px!important}',
    '.rv-doc-head{background:#fff!important;position:sticky;top:0;z-index:2}',
    '.rv-tabs{grid-template-columns:repeat(4,1fr)!important;position:sticky;top:72px;z-index:2}',
    '.rv-nav-card{height:74px!important}',
    '.rv-scroll{overflow:auto!important;max-width:100%!important}',
    '.rv-table{font-size:13px!important;width:100%!important}',
    '.rv-table th,.rv-table td{padding:7px 6px!important}',
    '.rv-table .nm,.rv-table .it{min-width:190px!important}',
    '.rv-print-meta{display:none}',
    '@media print{',
      '@page{size:A3 landscape;margin:7mm}',
      '*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}',
      'html,body{background:#fff!important;width:100%!important;height:auto!important;overflow:visible!important;margin:0!important;padding:0!important}',
      '.rv-print-root{width:100%!important;max-width:none!important;margin:0!important;padding:0!important;background:#fff!important}',
      '.rv-print-root .rv-doc{width:100%!important;max-width:none!important;box-shadow:none!important;border-radius:0!important;overflow:visible!important;margin:0!important}',
      '.rv-print-root .rv-doc-head{position:static!important;padding:4mm 5mm 3mm!important;border-bottom:2px solid #123b6d!important;break-inside:avoid!important}',
      '.rv-print-root .rv-doc-head h2{font-size:19pt!important}',
      '.rv-print-root .rv-doc-head p{font-size:10pt!important;line-height:1.45!important}',
      '.rv-print-root section{padding:4mm 5mm!important;border-bottom:0!important}',
      '.rv-print-root section h3{font-size:16pt!important;margin:0 0 4mm!important}',
      '.rv-print-root .rv-main-stats,.rv-print-root .rv-att-mini,.rv-print-root .rv-substats{display:grid!important;grid-template-columns:repeat(4,1fr)!important;gap:3mm!important;margin:2mm 0 4mm!important}',
      '.rv-print-root .rv-stat{padding:2.4mm 3mm!important;min-height:0!important;border-radius:6px!important;break-inside:avoid!important}',
      '.rv-print-root .rv-stat span{font-size:8.6pt!important}',
      '.rv-print-root .rv-stat b{font-size:11.5pt!important;margin-top:1mm!important}',
      '.rv-print-root .rv-info-grid{display:grid!important;grid-template-columns:repeat(5,1fr)!important;gap:2mm!important}',
      '.rv-print-root .rv-info-grid div{padding:2.3mm!important;border-radius:5px!important}',
      '.rv-print-root .rv-period-note{font-size:10pt!important;padding:2.5mm!important;margin:0 0 3mm!important}',
      '.rv-print-root .rv-block{margin:0 0 4mm!important;border-radius:0!important;break-inside:auto!important;page-break-inside:auto!important}',
      '.rv-print-root .rv-block-title{padding:2.4mm 3mm!important;break-inside:avoid!important}',
      '.rv-print-root .rv-block-title h4{font-size:12.5pt!important}',
      '.rv-print-root .rv-block-title span{font-size:9.5pt!important}',
      '.rv-print-root .rv-scroll{overflow:visible!important;max-width:none!important;width:100%!important}',
      '.rv-print-root .rv-table{width:100%!important;table-layout:auto!important;font-size:7.7pt!important;border-collapse:collapse!important}',
      '.rv-print-root .rv-table th,.rv-print-root .rv-table td{padding:1.15mm .65mm!important;white-space:nowrap!important}',
      '.rv-print-root .rv-table .nm,.rv-print-root .rv-table .it{white-space:normal!important;min-width:31mm!important;max-width:58mm!important;text-align:right!important}',
      '.rv-print-root .rv-day{min-width:4.3mm!important}',
      '.rv-print-root .rv-section-break{break-before:page!important;page-break-before:always!important}',
      '.rv-print-root #rv-summary{break-before:auto!important;page-break-before:auto!important}',
      '.rv-print-root .rv-tabs,.rv-print-root .rv-no-print{display:none!important}',
      '.rv-print-meta{display:block!important;position:fixed;bottom:2mm;left:6mm;right:6mm;font-size:8pt;color:#475569;border-top:1px solid #cbd5e1;padding-top:1.5mm;text-align:center}',
    '}'
  ].join('');

  function injectExtraStyle() {
    if (document.getElementById('rv-extra-style')) return;
    var st = document.createElement('style');
    st.id = 'rv-extra-style';
    st.textContent = EXTRA_STYLE;
    document.head.appendChild(st);
  }

  function extractPrintInfo() {
    var doc = document.querySelector('#rv-body .rv-doc');
    var title = doc && doc.querySelector('.rv-doc-head h2') ? doc.querySelector('.rv-doc-head h2').textContent.trim() : 'مستخلص';
    var subtitle = doc && doc.querySelector('.rv-doc-head p') ? doc.querySelector('.rv-doc-head p').textContent.trim() : '';
    var parts = subtitle.split('—').map(function (x) { return x.trim(); }).filter(Boolean);
    var hospital = parts.length ? parts[0] : '';
    var pay = '---';
    var period = '';
    var info = doc ? Array.prototype.slice.call(doc.querySelectorAll('#rv-summary .rv-info-grid div, #rv-summary .rv-stat')) : [];
    info.forEach(function (el) {
      var t = el.textContent.replace(/\s+/g, ' ').trim();
      if (t.indexOf('رقم الدفعة') > -1) pay = (t.replace('رقم الدفعة', '').trim() || pay);
      if (t.indexOf('من تاريخ') > -1) period += ' من ' + t.replace('من تاريخ', '').trim();
      if (t.indexOf('إلى تاريخ') > -1) period += ' إلى ' + t.replace('إلى تاريخ', '').trim();
    });
    return { title: title, subtitle: subtitle, hospital: hospital, pay: pay, period: period };
  }

  function safeFileName(s) {
    return String(s || '').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
  }

  function currentBaseStyle() {
    var a = document.getElementById('rv-style');
    var b = document.getElementById('rv-extra-style');
    return (a ? a.textContent : '') + '\n' + (b ? b.textContent : '') + '\n' + EXTRA_STYLE;
  }

  function printReviewDocument() {
    injectExtraStyle();
    var body = document.getElementById('rv-body');
    var docHtml = body ? body.innerHTML : '';
    var info = extractPrintInfo();
    var today = new Date();
    var dateStr = today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate());
    var filename = safeFileName(info.title + ' - ' + (info.hospital || 'بدون مستشفى') + ' - دفعة ' + info.pay + ' - ' + dateStr);
    var meta = '<div class="rv-print-meta">' + info.title + (info.hospital ? ' — ' + info.hospital : '') + ' — دفعة ' + info.pay + ' — تاريخ الطباعة: ' + dateStr + (info.period ? ' — الفترة:' + info.period : '') + '</div>';
    var w = window.open('', '_blank', 'width=1800,height=1100');
    if (!w) { alert('المتصفح منع فتح نافذة الطباعة. اسمح بالنافذة المنبثقة ثم حاول مرة أخرى.'); return; }
    w.document.open();
    w.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>' + filename + '</title><style>' + currentBaseStyle().replace(/<\/style/gi, '') + '</style></head><body><div class="rv-print-root">' + docHtml + meta + '</div><script>window.onload=function(){document.title=' + JSON.stringify(filename) + ';setTimeout(function(){window.focus();window.print();},650)};<\/script></body></html>');
    w.document.close();
  }

  window.rvDownload = printReviewDocument;
  window.rvPrintClean = printReviewDocument;

  function relabelButton() {
    injectExtraStyle();
    var btn = document.getElementById('rv-download');
    if (btn) {
      btn.textContent = 'طباعة / حفظ PDF';
      btn.title = 'يطبع مستندًا مستقلًا واضحًا باسم المستشفى ورقم الدفعة وتاريخ الطباعة';
      btn.onclick = function (ev) { if (ev && ev.preventDefault) ev.preventDefault(); printReviewDocument(); };
    }
    var quick = document.getElementById('rv-print');
    if (quick) quick.onclick = function (ev) { if (ev && ev.preventDefault) ev.preventDefault(); printReviewDocument(); };
  }

  document.addEventListener('DOMContentLoaded', relabelButton);
  document.addEventListener('click', function () { setTimeout(relabelButton, 50); }, true);
  setInterval(relabelButton, 800);
})();