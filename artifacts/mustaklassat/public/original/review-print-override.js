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
      if (/^(extractStart|extractEnd|startDate|endDate)$/i.test(k)) {
        obj[k] = toLocalDateOnly(v);
      }
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

  function periodFromExtract(e, data) {
    var p = (data && (data.persistentExtractData || data.persistentContractData)) || {};
    var start = e.extractStart || p.extractStart || (data && data.extractStart) || p.startDate || (data && data.startDate) || null;
    var end = e.extractEnd || p.extractEnd || (data && data.extractEnd) || p.endDate || (data && data.endDate) || null;
    start = toLocalDateOnly(start);
    end = toLocalDateOnly(end);
    var st = parseDateOnly(start), en = parseDateOnly(end);
    if (!st || !en) return null;
    var duration = Math.max(1, Math.round((en - st) / 86400000) + 1);
    return { startDay: st.getDate(), endDay: en.getDate(), duration: duration };
  }

  function snapshotOf(data) {
    if (!data || typeof data !== 'object') return null;
    return data.localStorageSnapshot || data.storageSnapshot || data.snapshot || data.submittedData || data;
  }

  function normalizeEmployeeDays(emp, period) {
    if (!emp || typeof emp !== 'object' || !Array.isArray(emp.days) || !period) return;
    var days = emp.days.slice();
    var endDay = period.endDay;
    var startDay = period.startDay;
    var duration = period.duration;

    // صفحة الحضور الأساسية تحفظ days بطول مدة المستخلص فقط.
    // شاشة المراجعة القديمة تقرأها كأنها شهر كامل: days[dayNumber - 1].
    // لذلك نحولها داخليًا إلى مصفوفة مفهرسة برقم اليوم داخل الشهر.
    if (startDay > 1 && days.length <= duration + 1 && days.length < endDay) {
      var expanded = Array(endDay).fill('');
      for (var i = 0; i < duration && i < days.length; i++) {
        expanded[startDay - 1 + i] = days[i] || '';
      }
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
        } catch (_) {
          return res;
        }
      });
    };
  }

  function printReviewDocument() {
    if (typeof window.rvPrintClean === 'function') {
      window.rvPrintClean();
      return;
    }
    window.print();
  }

  window.rvDownload = function () {
    printReviewDocument();
  };

  function relabelButton() {
    var btn = document.getElementById('rv-download');
    if (!btn) return;
    btn.textContent = 'طباعة / حفظ PDF';
    btn.title = 'يفتح نافذة الطباعة لاختيار الطباعة أو الحفظ PDF';
    btn.onclick = function (ev) {
      if (ev && ev.preventDefault) ev.preventDefault();
      window.rvDownload();
    };
  }

  document.addEventListener('DOMContentLoaded', relabelButton);
  document.addEventListener('click', function () {
    setTimeout(relabelButton, 50);
  }, true);
  setInterval(relabelButton, 800);
})();