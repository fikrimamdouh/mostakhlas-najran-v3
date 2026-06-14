/* review-consumables-summary-exact.js
 * يعرض الملخص الشهري لمستخلص المستهلكات في شاشة المراجعة بنفس أعمدة شهادة الملخص الفعلية.
 * لا يغير البيانات ولا يعيد حسابها؛ يقرأ snapshot المحفوظ وقت الرفع.
 */
(function () {
  'use strict';
  if (!/\/original\/approval\.html(?:$|[?#])/.test(location.pathname + location.search)) return;

  var currentExtractId = null;
  var KEY = 'summary_data_consumables_v27';

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]; }); }
  function parse(x) { if (!x) return null; if (typeof x === 'object') return x; try { return JSON.parse(x); } catch (_) { return null; } }
  function num(v) { var n = Number(String(v == null ? 0 : v).replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : 0; }
  function plain(n) { return Number(n || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ر.س'; }
  function statCard(t, v, cls) { return '<div class="rv-stat ' + (cls || '') + '"><span>' + esc(t) + '</span><b>' + esc(v) + '</b></div>'; }
  function token() { try { return (JSON.parse(localStorage.getItem('najran_session') || '{}') || {}).clerkToken || ''; } catch (_) { return ''; } }

  async function fetchExtract(id) {
    if (!id) return null;
    var tk = token();
    var r = await fetch('/api/submitted-extracts', { headers: tk ? { Authorization: 'Bearer ' + tk } : {}, credentials: 'include' });
    if (!r.ok) return null;
    var data = await r.json();
    var arr = data.extracts || [];
    return arr.find(function (x) { return String(x.id) === String(id); }) || null;
  }

  function snapshotFromExtract(e) {
    var data = parse(e && e.extractData) || {};
    return data.localStorageSnapshot || data.storageSnapshot || data.snapshot || data.submittedData || data || {};
  }

  function findSummaryRows(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return [];
    var rows = parse(snapshot[KEY]) || snapshot[KEY];
    if (Array.isArray(rows)) return rows;
    var keys = Object.keys(snapshot);
    for (var i = 0; i < keys.length; i++) {
      var k = String(keys[i] || '').replace(/^(?:_u\d+_)+/, '').trim();
      if (k === KEY || k === 'summaryData' || k === 'summary_data') {
        rows = parse(snapshot[keys[i]]) || snapshot[keys[i]];
        if (Array.isArray(rows)) return rows;
      }
    }
    return [];
  }

  function hasExactCols(rows) {
    return rows.some(function (r) {
      return r && typeof r === 'object' && (r.monthlyValue != null || r.extractValue != null || r.deduction != null || r.penalty != null || r.netValue != null || r.isFinalTotal || r.isTafqeet);
    });
  }

  function buildExactSummary(rows) {
    if (!rows || !rows.length) return '';
    var mainRows = [], totalRows = [], finalRows = [], tafqeetRows = [];
    rows.forEach(function (r) {
      if (!r || typeof r !== 'object') return;
      if (r.isTafqeet) tafqeetRows.push(r);
      else if (r.isFinalTotal) finalRows.push(r);
      else if (r.isSubTotal || r.isCustom || r.isSummaryTotalRow) totalRows.push(r);
      else mainRows.push(r);
    });

    var totalMonthly = 0, totalExtract = 0, totalDeduction = 0, totalPenalty = 0, totalNet = 0;
    function rowHtml(r, idx, cls) {
      var monthly = num(r.monthlyValue != null ? r.monthlyValue : r.value);
      var extract = num(r.extractValue);
      var deduction = num(r.deduction);
      var penalty = num(r.penalty);
      var net = num(r.netValue != null ? r.netValue : r.value);
      if (!cls) { totalMonthly += monthly; totalExtract += extract; totalDeduction += deduction; totalPenalty += penalty; totalNet += net; }
      return '<tr class="' + (cls || '') + '"><td>' + (idx != null ? idx : '—') + '</td><td class="nm">' + esc(r.name || '—') + '</td><td>' + plain(monthly) + '</td><td>' + plain(extract) + '</td><td>' + plain(deduction) + '</td><td>' + plain(penalty) + '</td><td><b>' + plain(net) + '</b></td></tr>';
    }

    var body = mainRows.map(function (r, i) { return rowHtml(r, i + 1, ''); }).join('');
    body += totalRows.map(function (r) { return rowHtml(r, '—', r.isCustom ? 'rv-deduction-row' : 'rv-total-row'); }).join('');
    body += finalRows.map(function (r) { return '<tr class="total final-total"><td colspan="6">' + esc(r.name || 'الصافي النهائي المستحق للمقاول') + '</td><td><b>' + plain(r.netValue != null ? r.netValue : r.value) + '</b></td></tr>'; }).join('');
    var tafqeet = tafqeetRows.map(function (r) { return '<div class="rv-period-note"><b>' + esc(r.name || '') + '</b></div>'; }).join('');
    var finalNet = finalRows.length ? num(finalRows[0].netValue != null ? finalRows[0].netValue : finalRows[0].value) : totalNet;

    return '<section id="rv-consumables-summary-exact" class="rv-section-break rv-print-block">' +
      '<h3>شهادة الاستحقاق الشهري لبنود المستهلكات</h3>' +
      '<div class="rv-period-note">تم عرض الملخص الشهري من لقطة المستخلص المحفوظة وقت الرفع، بنفس أعمدة شهادة الملخص الفعلية.</div>' +
      '<div class="rv-main-stats">' +
        statCard('إجمالي القيمة الشهرية', plain(totalMonthly), 'primary') +
        statCard('إجمالي القيمة بالمستخلص', plain(totalExtract), 'primary') +
        statCard('إجمالي الحسميات', plain(totalDeduction + totalPenalty), (totalDeduction + totalPenalty) > 0 ? 'warn' : 'ok') +
        statCard('الصافي النهائي', plain(finalNet), 'ok') +
      '</div>' +
      '<div class="rv-block rv-print-block rv-cons-summary-exact-block"><div class="rv-block-title"><h4>الملخص الشهري</h4><span>' + mainRows.length + ' بند</span></div><div class="rv-scroll"><table class="rv-table generic"><thead><tr><th>م</th><th>البند</th><th>القيمة الشهرية</th><th>القيمة بالمستخلص</th><th>الحسم</th><th>الغرامة</th><th>الصافي</th></tr></thead><tbody>' + body + '</tbody></table></div></div>' + tafqeet +
    '</section>';
  }

  async function replaceSummary(id) {
    var body = document.getElementById('rv-body');
    if (!body || !id) return;
    var doc = body.querySelector('.rv-doc');
    if (!doc || doc.dataset.consumablesExactSummaryFor === String(id)) return;
    var e = await fetchExtract(id);
    if (!e) return;
    var rows = findSummaryRows(snapshotFromExtract(e));
    if (!rows.length || !hasExactCols(rows)) return;
    doc.dataset.consumablesExactSummaryFor = String(id);

    var oldExact = doc.querySelector('#rv-consumables-summary-exact');
    if (oldExact) oldExact.remove();
    Array.prototype.slice.call(doc.querySelectorAll('.rv-block')).forEach(function (b) {
      var h = b.querySelector('.rv-block-title h4');
      if (h && /الملخص الشهري/.test(h.textContent || '')) b.remove();
    });

    var holder = document.createElement('div');
    holder.innerHTML = buildExactSummary(rows);
    var sec = holder.firstElementChild;
    if (!sec) return;
    var decision = doc.querySelector('#rv-decision');
    if (decision && decision.parentNode) decision.parentNode.insertBefore(sec, decision);
    else doc.appendChild(sec);
  }

  function run() {
    var id = currentExtractId || (typeof window.expandedId !== 'undefined' ? window.expandedId : null);
    if (id) replaceSummary(id);
  }

  function hookOpen() {
    if (window.__rvConsumablesSummaryHooked || typeof window.rvOpenExtract !== 'function') return;
    window.__rvConsumablesSummaryHooked = true;
    var old = window.rvOpenExtract;
    window.rvOpenExtract = async function (id) {
      currentExtractId = id;
      var res = await old.apply(this, arguments);
      setTimeout(run, 250); setTimeout(run, 800); setTimeout(run, 1500);
      return res;
    };
  }

  document.addEventListener('DOMContentLoaded', function () { hookOpen(); run(); });
  document.addEventListener('click', function () { setTimeout(function () { hookOpen(); run(); }, 150); }, true);
  setInterval(function () { hookOpen(); run(); }, 900);
})();