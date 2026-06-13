/* review-generic-tables.js - professional non-labor review tables + extra saved snapshot appendix. No source data/calculations are changed. */
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

  var DISPLAYED_EXACT = {
    persistentExtractData: 1, persistentContractData: 1,
    attendanceData: 1, ng_attendanceData: 1, nd_attendanceData: 1, healthCentersAttendanceData: 1, centersAttendanceData_v2: 1, adminOfficesAttendanceData_v1: 1,
    performanceData: 1, performanceData_v4: 1, performanceDeductions: 1, performanceDeductions_v4: 1, performanceItems: 1, performanceItems_general_v1: 1,
    consumablesTableData: 1, sparePartsData: 1,
    subcontractors_data_consumables_v27: 1, subcontractorsData: 1, subcontractors_data: 1,
    performance_data_consumables_v27: 1, performance_data: 1,
    water_supply_data_consumables_v27: 1, waterData: 1, water_supply_data: 1,
    sewage_disposal_data_consumables_v27: 1, sewageData: 1, sewage_disposal_data: 1,
    summary_data_consumables_v27: 1, summaryData: 1, summary_data: 1
  };

  function isTechnicalKey(k) {
    var n = norm(k);
    var low = n.toLowerCase();
    if (DISPLAYED_EXACT[n]) return true;
    if (/^performanceitems_/i.test(n)) return true;
    if (/^_?u\d+_/i.test(k)) return false;
    if (/^(najran_|hospitalactivitystatus|cloudsync|audit|last|cache|dirty|pending|sync|debug|__|theme|sidebar|toast)/i.test(low)) return true;
    if (/(_locked_|_done$|last_check|seen_ids|timestamp|token|session|clerk)/i.test(low)) return true;
    if (/^(companyname|hospitalname|contractdetails|contractnumber|extractmonth|extractyear|paymentnumber|extractstart|extractend)$/i.test(low)) return true;
    return false;
  }

  function usefulExtra(v) {
    v = parse(v) || v;
    if (v == null || v === '') return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return String(v).trim().length > 0;
  }

  function rawJson(v) {
    try { return JSON.stringify(v, null, 2); } catch (_) { return String(v); }
  }

  function makeRowsForExtra(v) {
    v = parse(v) || v;
    if (Array.isArray(v)) {
      return v.map(function (x, i) {
        if (x && typeof x === 'object') return x;
        return { value: x, index: i + 1 };
      });
    }
    if (v && typeof v === 'object') {
      var keys = Object.keys(v);
      var objectLike = keys.some(function (k) { return v[k] && typeof v[k] === 'object'; });
      if (objectLike) {
        return keys.map(function (k) {
          var x = v[k];
          if (x && typeof x === 'object' && !Array.isArray(x)) {
            var r = { key: k };
            Object.keys(x).forEach(function (kk) { r[kk] = x[kk]; });
            return r;
          }
          return { key: k, value: x };
        });
      }
      return keys.map(function (k) { return { key: k, value: v[k] }; });
    }
    return [{ value: v }];
  }

  function collectCols(rows) {
    var cols = [];
    rows.forEach(function (r) {
      if (!r || typeof r !== 'object') return;
      Object.keys(r).forEach(function (k) {
        if (cols.indexOf(k) === -1 && cols.length < 14) cols.push(k);
      });
    });
    return cols.length ? cols : ['value'];
  }

  function valForCell(v) {
    if (v == null || v === '') return '—';
    if (typeof v === 'object') return rawJson(v);
    return v;
  }

  function extraBlock(key, value) {
    var rows = makeRowsForExtra(value);
    var cols = collectCols(rows);
    var head = cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('');
    var body = rows.map(function (r, i) {
      return '<tr><td>' + (i + 1) + '</td>' + cols.map(function (c) {
        return '<td>' + esc(valForCell(r && typeof r === 'object' ? r[c] : r)) + '</td>';
      }).join('') + '</tr>';
    }).join('');
    var raw = rawJson(parse(value) || value);
    return '<div class="rv-block rv-print-block rv-extra-block"><div class="rv-block-title"><h4>' + esc(key) + '</h4><span>' + rows.length + ' سجل</span></div><div class="rv-scroll"><table class="rv-table generic"><thead><tr><th>م</th>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div><details class="rv-extra-raw"><summary>عرض البيانات الخام الكاملة لهذا المفتاح</summary><pre class="rv-pre">' + esc(raw) + '</pre></details></div>';
  }

  function buildExtraAppendix(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return '';
    var keys = Object.keys(snapshot).filter(function (k) {
      return !isTechnicalKey(k) && usefulExtra(snapshot[k]);
    });
    if (!keys.length) return '';
    return '<section id="rv-extra-saved-data" class="rv-section-break"><h3>بيانات إضافية محفوظة داخل المستخلص</h3><div class="rv-period-note">هذا الملحق يعرض أي بيانات محفوظة في لقطة المستخلص ولم تدخل في جداول العرض الأساسية، لضمان أن المراجع يرى نفس ما تم رفعه وقت الإرسال.</div>' + keys.map(function (k) { return extraBlock(k, snapshot[k]); }).join('') + '</section>';
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

  async function appendExtraIfPossible() {
    var body = document.getElementById('rv-body');
    if (!body || !currentExtractId) return;
    var doc = body.querySelector('.rv-doc');
    if (!doc || doc.dataset.extraSnapshotFor === String(currentExtractId)) return;
    var e = await fetchExtract(currentExtractId);
    if (!e) return;
    var html = buildExtraAppendix(snapshotFromExtract(e));
    doc.dataset.extraSnapshotFor = String(currentExtractId);
    if (!html) return;
    var old = doc.querySelector('#rv-extra-saved-data');
    if (old) old.remove();
    var holder = document.createElement('div');
    holder.innerHTML = html;
    var sec = holder.firstElementChild;
    var decision = doc.querySelector('#rv-decision');
    if (decision && decision.parentNode) decision.parentNode.insertBefore(sec, decision);
    else doc.appendChild(sec);
  }

  function run() {
    document.querySelectorAll('#rv-body pre.rv-pre').forEach(enhancePre);
    replaceEmptyIfPossible();
    appendExtraIfPossible();
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
      setTimeout(run, 1200);
      return res;
    };
  }

  document.addEventListener('DOMContentLoaded', function () { hookOpen(); run(); });
  document.addEventListener('click', function () { setTimeout(function () { hookOpen(); run(); }, 100); }, true);
  setInterval(function () { hookOpen(); run(); }, 700);
})();