/* review-generic-tables.js - professional non-labor review tables. No calculations are changed. */
(function () {
  'use strict';
  if (!/\/original\/approval\.html(?:$|[?#])/.test(window.location.pathname + window.location.search)) return;

  var currentExtractId = null;

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }

  function parse(x) {
    if (!x) return null;
    if (typeof x === 'object') return x;
    try { return JSON.parse(x); } catch (_) { return null; }
  }

  function norm(k) {
    return String(k || '').replace(/^(?:_u\d+_)+/, '').trim();
  }

  function getAny(obj, names) {
    if (!obj || typeof obj !== 'object') return null;
    for (var i = 0; i < names.length; i++) {
      if (Object.prototype.hasOwnProperty.call(obj, names[i])) return parse(obj[names[i]]) || obj[names[i]];
    }
    var keys = Object.keys(obj);
    for (var j = 0; j < keys.length; j++) {
      var nk = norm(keys[j]);
      for (var k = 0; k < names.length; k++) {
        if (nk === names[k]) return parse(obj[keys[j]]) || obj[keys[j]];
      }
    }
    return null;
  }

  function num(v) {
    var n = Number(String(v == null ? 0 : v).replace(/[^0-9.\-]/g, ''));
    return isFinite(n) ? n : 0;
  }

  function money(n) {
    return Number(n || 0).toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' });
  }

  function first(obj, keys) {
    if (!obj || typeof obj !== 'object') return '';
    for (var i = 0; i < keys.length; i++) if (obj[keys[i]] != null && obj[keys[i]] !== '') return obj[keys[i]];
    var all = Object.keys(obj);
    for (var j = 0; j < all.length; j++) {
      var nk = String(all[j]).toLowerCase().replace(/[\s_\-]/g, '');
      for (var k = 0; k < keys.length; k++) {
        var kk = String(keys[k]).toLowerCase().replace(/[\s_\-]/g, '');
        if (nk === kk && obj[all[j]] != null && obj[all[j]] !== '') return obj[all[j]];
      }
    }
    return '';
  }

  function toRows(v) {
    v = parse(v) || v;
    if (!v) return [];
    if (Array.isArray(v)) return v.filter(Boolean);
    if (typeof v === 'object') return Object.keys(v).map(function (k) { return v[k]; }).filter(function (x) { return x && typeof x === 'object'; });
    return [];
  }

  function statCard(t, v, cls) {
    return '<div class="rv-stat ' + (cls || '') + '"><span>' + esc(t) + '</span><b>' + esc(v) + '</b></div>';
  }

  function sectionTable(title, rows, columns, totalLabel, totalValue) {
    rows = rows || [];
    var head = columns.map(function (c) { return '<th>' + esc(c.title) + '</th>'; }).join('');
    var body = rows.map(function (r, i) {
      return '<tr><td>' + (i + 1) + '</td>' + columns.map(function (c) {
        var v = typeof c.value === 'function' ? c.value(r, i) : r[c.value];
        return '<td class="' + (c.cls || '') + '">' + esc(v == null || v === '' ? '—' : v) + '</td>';
      }).join('') + '</tr>';
    }).join('');
    if (!body) body = '<tr><td colspan="' + (columns.length + 1) + '" class="rv-empty">لا توجد بيانات محفوظة لهذا القسم داخل لقطة المستخلص</td></tr>';
    var foot = totalLabel ? '<tr class="total"><td colspan="' + columns.length + '">' + esc(totalLabel) + '</td><td><b>' + esc(totalValue || '—') + '</b></td></tr>' : '';
    return '<div class="rv-block rv-print-block rv-cons-section"><div class="rv-block-title"><h4>' + esc(title) + '</h4><span>' + rows.length + ' بند</span></div><div class="rv-scroll"><table class="rv-table generic"><thead><tr><th>م</th>' + head + '</tr></thead><tbody>' + body + foot + '</tbody></table></div></div>';
  }

  function buildConsumablesFromSnapshot(snapshot) {
    var subs = toRows(getAny(snapshot, ['subcontractors_data_consumables_v27', 'subcontractorsData', 'subcontractors_data']));
    var perf = toRows(getAny(snapshot, ['performance_data_consumables_v27', 'performanceData', 'performance_data']));
    var water = toRows(getAny(snapshot, ['water_supply_data_consumables_v27', 'waterData', 'water_supply_data']));
    var sewage = toRows(getAny(snapshot, ['sewage_disposal_data_consumables_v27', 'sewageData', 'sewage_disposal_data']));
    var summary = toRows(getAny(snapshot, ['summary_data_consumables_v27', 'summaryData', 'summary_data']));

    var totalSubs = subs.reduce(function (a, r) {
      var visitValue = num(first(r, ['visitValue', 'value', 'cost']));
      var annual = num(first(r, ['annualVisits'])) || 1;
      var visitDate = String(first(r, ['visitDate']) || '');
      var due = visitDate.indexOf('خلال هذا الشهر') > -1 ? visitValue / annual : 0;
      var damage = num(first(r, ['damagePenalty']));
      return a + due - damage;
    }, 0);
    var totalWater = water.reduce(function (a, r) { return a + num(first(r, ['unitPrice', 'price'])) * num(first(r, ['quantity', 'qty'])); }, 0);
    var totalSewage = sewage.reduce(function (a, r) { return a + num(first(r, ['unitPrice', 'price'])) * num(first(r, ['quantity', 'qty'])); }, 0);
    var totalSummary = summary.reduce(function (a, r) { return a + (first(r, ['isSubTotal']) || first(r, ['isCustom']) ? 0 : num(first(r, ['value', 'amount']))); }, 0);

    var html = '<div class="rv-main-stats rv-generic-stats">' +
      statCard('عقود الباطن', subs.length + ' بند', 'primary') +
      statCard('أداء المستهلكات', perf.length + ' بند', 'primary') +
      statCard('توريد المياه', money(totalWater), 'ok') +
      statCard('إجمالي تقديري', money(totalSubs + totalWater + totalSewage + totalSummary), 'ok') +
      '</div>';

    html += sectionTable('عقود الباطن', subs, [
      { title: 'العقد', cls: 'nm', value: function (r) { return first(r, ['name']); } },
      { title: 'تكلفة الزيارة حسب العقد', value: function (r) { return money(num(first(r, ['visitValue']))); } },
      { title: 'عدد الزيارات', value: function (r) { return first(r, ['annualVisits']) || 1; } },
      { title: 'موعد الزيارة', value: function (r) { return first(r, ['visitDate']); } },
      { title: 'الحالة', value: function (r) { return first(r, ['status']); } },
      { title: 'غرامة أضرار', value: function (r) { return money(num(first(r, ['damagePenalty']))); } }
    ], 'إجمالي تقديري لعقود الباطن', money(totalSubs));

    html += sectionTable('أداء المستهلكات', perf, [
      { title: 'البيان', cls: 'nm', value: function (r) { return first(r, ['name']); } },
      { title: 'الدرجة القصوى', value: function (r) { return first(r, ['maxScore']); } },
      { title: 'درجة التقدير', value: function (r) { return first(r, ['score']); } }
    ], null, null);

    html += sectionTable('توريد المياه', water, [
      { title: 'البيان', cls: 'nm', value: function (r) { return first(r, ['name']); } },
      { title: 'سعر الوحدة', value: function (r) { return money(num(first(r, ['unitPrice']))); } },
      { title: 'الكمية', value: function (r) { return first(r, ['quantity']); } },
      { title: 'الإجمالي', value: function (r) { return money(num(first(r, ['unitPrice'])) * num(first(r, ['quantity']))); } }
    ], 'إجمالي توريد المياه', money(totalWater));

    html += sectionTable('التخلص من مياه الصرف', sewage, [
      { title: 'البيان', cls: 'nm', value: function (r) { return first(r, ['name']); } },
      { title: 'سعر الوحدة', value: function (r) { return money(num(first(r, ['unitPrice']))); } },
      { title: 'الكمية', value: function (r) { return first(r, ['quantity']); } },
      { title: 'الإجمالي', value: function (r) { return money(num(first(r, ['unitPrice'])) * num(first(r, ['quantity']))); } }
    ], 'إجمالي التخلص من مياه الصرف', money(totalSewage));

    html += sectionTable('الملخص الشهري', summary, [
      { title: 'البند', cls: 'nm', value: function (r) { return first(r, ['name']); } },
      { title: 'القيمة', value: function (r) { return money(num(first(r, ['value']))); } },
      { title: 'النوع', value: function (r) { return first(r, ['type']) || (first(r, ['isSubTotal']) ? 'إجمالي فرعي' : 'بند'); } }
    ], 'إجمالي بنود المستهلكات', money(totalSummary));

    return html;
  }

  function snapshotFromExtract(e) {
    var data = parse(e && e.extractData) || {};
    return data.localStorageSnapshot || data.storageSnapshot || data.snapshot || data.submittedData || data || {};
  }

  function token() {
    try { return (JSON.parse(localStorage.getItem('najran_session') || '{}') || {}).clerkToken || ''; } catch (_) { return ''; }
  }

  async function fetchExtract(id) {
    if (!id) return null;
    var tk = token();
    var r = await fetch('/api/submitted-extracts', { headers: tk ? { Authorization: 'Bearer ' + tk } : {}, credentials: 'include' });
    if (!r.ok) return null;
    var data = await r.json();
    var arr = data.extracts || [];
    return arr.find(function (x) { return String(x.id) === String(id); }) || null;
  }

  function enhancePre(pre) {
    if (!pre || pre.dataset.genericEnhanced === '1') return;
    pre.dataset.genericEnhanced = '1';
    var data = parse(pre.textContent || '');
    if (!data) return;
    var wrap = document.createElement('div');
    wrap.className = 'rv-generic-review';
    wrap.innerHTML = buildConsumablesFromSnapshot(data);
    pre.parentNode.replaceChild(wrap, pre);
  }

  async function replaceEmptyIfPossible() {
    var body = document.getElementById('rv-body');
    if (!body || !currentExtractId) return;
    var empty = body.querySelector('.rv-empty');
    if (!empty || empty.dataset.genericTried === '1') return;
    var txt = empty.textContent || '';
    if (txt.indexOf('لا توجد معاينة تفصيلية') === -1) return;
    empty.dataset.genericTried = '1';
    var e = await fetchExtract(currentExtractId);
    if (!e) return;
    var snap = snapshotFromExtract(e);
    var has = getAny(snap, ['subcontractors_data_consumables_v27', 'performance_data_consumables_v27', 'water_supply_data_consumables_v27', 'sewage_disposal_data_consumables_v27', 'summary_data_consumables_v27']);
    if (!has) return;
    var sec = empty.closest('section') || empty.parentNode;
    sec.innerHTML = '<h3>تفاصيل مستخلص المستهلكات</h3>' + buildConsumablesFromSnapshot(snap);
  }

  function run() {
    document.querySelectorAll('#rv-body pre.rv-pre').forEach(enhancePre);
    replaceEmptyIfPossible();
  }

  function hookOpen() {
    if (window.__rvGenericHooked || typeof window.rvOpenExtract !== 'function') return;
    window.__rvGenericHooked = true;
    var old = window.rvOpenExtract;
    window.rvOpenExtract = async function (id) {
      currentExtractId = id;
      var res = await old.apply(this, arguments);
      setTimeout(run, 150);
      setTimeout(run, 600);
      return res;
    };
  }

  document.addEventListener('DOMContentLoaded', function () { hookOpen(); run(); });
  document.addEventListener('click', function () { setTimeout(function () { hookOpen(); run(); }, 100); }, true);
  setInterval(function () { hookOpen(); run(); }, 700);
})();