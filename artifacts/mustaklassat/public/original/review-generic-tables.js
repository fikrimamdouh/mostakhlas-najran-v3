/* review-generic-tables.js - professional non-labor review tables + attendance source fallback. Extra saved snapshot appendix is hidden from display. No source data/calculations are changed. */
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

  function plain(n) {
    return Number(n || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ر.س';
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
    if (typeof v === 'object') {
      var vals = Object.keys(v).map(function (k) { return v[k]; });
      if (vals.some(Array.isArray)) return vals.reduce(function (a, x) { return a.concat(toRows(x)); }, []);
      return vals.filter(function (x) { return x && typeof x === 'object'; });
    }
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

  function parseDate(v) {
    if (!v || v === '—') return null;
    var s = String(v).trim();
    var m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    var d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }

  function periodInfoFromExtract(e, snapshot) {
    var data = parse(e && e.extractData) || {};
    var p = getAny(snapshot, ['persistentExtractData']) || getAny(snapshot, ['persistentContractData']) || {};
    var start = e.extractStart || p.extractStart || data.extractStart || p.startDate || data.startDate || '';
    var end = e.extractEnd || p.extractEnd || data.extractEnd || p.endDate || data.endDate || '';
    var st = parseDate(start), en = parseDate(end), days = [], duration = '—';
    if (st && en) {
      var ms = 24 * 60 * 60 * 1000;
      duration = Math.max(1, Math.round((en - st) / ms) + 1);
      if (st.getFullYear() === en.getFullYear() && st.getMonth() === en.getMonth()) {
        for (var d = st.getDate(); d <= en.getDate(); d++) days.push(d);
      } else {
        var max = daysInMonth(st.getFullYear(), st.getMonth());
        for (var a = st.getDate(); a <= max; a++) days.push(a);
      }
    }
    if (!days.length) for (var i = 1; i <= 31; i++) days.push(i);
    return { days: days, duration: duration };
  }

  var LABOR_DEPTS = [
    { key: 'cleaning', label: 'ح غ 1 - النظافة', aliases: ['cleaning', 'clean', 'hygiene', 'النظافة'] },
    { key: 'electricity', label: 'ح غ 2 - الكهرباء', aliases: ['electricity', 'electrical', 'electric', 'الكهرباء'] },
    { key: 'agriculture', label: 'ح غ 3 - الزراعة', aliases: ['agriculture', 'agri', 'landscape', 'الزراعة'] },
    { key: 'civil', label: 'ح غ 4 - المدني', aliases: ['civil', 'civil-works', 'civil_works', 'civilworks', 'المدني'] },
    { key: 'mechanics', label: 'ح غ 5 - الميكانيكا', aliases: ['mechanics', 'mechanical', 'mechanic', 'الميكانيكا'] },
    { key: 'security', label: 'ح غ 6 - الأمن', aliases: ['security', 'guards', 'guard', 'الأمن'] },
    { key: 'laundry', label: 'ح غ 7 - المغسلة', aliases: ['laundry', 'laundary', 'المغسلة'] },
    { key: 'admin_saudi', label: 'الوظائف الإدارية السعوديين', aliases: ['admin-saudi', 'admin_saudi', 'saudi-admin', 'administrative_saudi', 'admin', 'الإدارية', 'السعوديين'] }
  ];

  function looksEmployee(r) {
    return r && typeof r === 'object' && (r.name || r.employeeName || r.workerName || r.jobTitle || r.position || r.job || r.iqamaId || r.idNumber || r.identityNumber || Array.isArray(r.days) || r.salary || r.monthlySalary || r.netSalary || r.finalSalary);
  }

  function rowKey(r, i) { return [r.id, r.employeeId, r.iqamaId, r.idNumber, r.identityNumber, r.name, r.employeeName, i].filter(Boolean).join('|'); }
  function countAttRows(v) { return toRows(v).filter(looksEmployee).length; }

  function getAttendanceSource(snapshot) {
    var keys = ['attendanceData', 'ng_attendanceData', 'nd_attendanceData', 'healthCentersAttendanceData', 'centersAttendanceData_v2', 'adminOfficesAttendanceData_v1'];
    var best = null, bestRows = 0;
    keys.forEach(function (k) {
      var v = getAny(snapshot, [k]);
      var rows = countAttRows(v);
      if (v && typeof v === 'object' && rows >= bestRows) { best = v; bestRows = rows; }
    });
    return best;
  }

  function rowsFor(att, dept, used) {
    var rows = [], aliases = dept.aliases.map(norm), keys = Object.keys(att || {});
    keys.forEach(function (k) {
      var nk = norm(k);
      if (aliases.indexOf(nk) === -1) return;
      used[nk] = true;
      rows = rows.concat(toRows(att[k]).filter(looksEmployee));
    });
    if (Array.isArray(att)) rows = att.filter(function (r) { var dk = norm(r.department || r.dept || r.section || r.categoryKey); return aliases.indexOf(dk) > -1; });
    var seen = {};
    return rows.filter(function (r, i) { var kk = rowKey(r, i); if (seen[kk]) return false; seen[kk] = true; return true; });
  }

  function collectAttendanceGroups(snapshot) {
    var att = getAttendanceSource(snapshot);
    if (!att) return [];
    var used = {}, groups = [];
    LABOR_DEPTS.forEach(function (d) { var rows = rowsFor(att, d, used); if (rows.length) groups.push({ label: d.label, key: d.key, rows: rows, dept: d }); });
    Object.keys(att).forEach(function (k) {
      var nk = norm(k);
      if (used[nk]) return;
      if (/^(ng_|nd_|hc_|health|center|admin_offices|office|maktab|najran_dental|najran_general)/i.test(nk)) return;
      var rows = toRows(att[k]).filter(looksEmployee);
      if (rows.length) groups.push({ label: 'قسم إضافي داخل نفس المستخلص - ' + k, key: nk, rows: rows, dept: { aliases: [nk] } });
    });
    return groups;
  }

  function attendanceDayValue(days, day, idx, dayNums) {
    if (!Array.isArray(days)) return '';
    if (days.length === dayNums.length) return days[idx] || '';
    if (days.length >= 28) return days[day - 1] || '';
    if (dayNums && dayNums.length && dayNums[0] > 1) return days[idx] || '';
    return days[day - 1] || days[idx] || '';
  }

  function countDays(days, dayNums) {
    var c = { p: 0, a: 0, v: 0, e: 0 };
    dayNums.forEach(function (day, idx) {
      var d = attendanceDayValue(days, day, idx, dayNums);
      if (d === 'ح') c.p++;
      else if (d === 'غ') c.a++;
      else if (d === 'ج') c.v++;
      else if (d === 'ش' || d === 'ت') c.e++;
    });
    return c;
  }

  function monthlyValue(r) { return num(r.salary || r.monthlySalary || r.contractValue || r.grossSalary || r.basicSalary || r.netSalary || r.finalSalary); }
  function deductionValue(r) { return num(r.deduction || r.absenceDeduction || r.totalDeduction); }
  function fineValue(r) { return num(r.totalFine || r.absencePenalty || r.absenceFine || r.penalty || r.fine) + num(r.nationalityFine); }
  function netValue(r) { var n = num(r.netSalary || r.finalSalary || r.netAmount); if (n) return n; return monthlyValue(r) - deductionValue(r) - fineValue(r); }

  function dayCells(days, dayNums) {
    var h = '';
    dayNums.forEach(function (day, idx) {
      var v = attendanceDayValue(days, day, idx, dayNums);
      h += '<td class="rv-day d' + esc(v) + '">' + esc(v) + '</td>';
    });
    return h;
  }

  function buildAttendanceFromAnySource(snapshot, pi) {
    var groups = collectAttendanceGroups(snapshot);
    if (!groups.length) return '';
    var dayNums = pi.days, total = { emp: 0, cost: 0, ded: 0, fine: 0, net: 0, p: 0, a: 0, v: 0, e: 0 }, html = '';
    groups.forEach(function (g) {
      var body = '', sub = { emp: 0, cost: 0, ded: 0, fine: 0, net: 0, p: 0, a: 0, v: 0, e: 0 };
      g.rows.forEach(function (r, i) {
        var c = countDays(r.days, dayNums), p = c.p, a = c.a, v = c.v, e = c.e, cost = monthlyValue(r), ded = deductionValue(r), fine = fineValue(r), net = netValue(r);
        sub.emp++; sub.cost += cost; sub.ded += ded; sub.fine += fine; sub.net += net; sub.p += p; sub.a += a; sub.v += v; sub.e += e;
        body += '<tr><td>' + (i + 1) + '</td><td class="nm">' + esc(r.name || r.employeeName || r.workerName || '—') + '</td><td>' + esc(r.jobTitle || r.position || r.job || '—') + '</td><td>' + esc(r.category || r.classification || '—') + '</td><td>' + esc(r.nationality || '—') + '</td><td>' + esc(r.iqamaId || r.idNumber || r.identityNumber || '—') + '</td>' + dayCells(r.days, dayNums) + '<td>' + p + '</td><td>' + a + '</td><td>' + v + '</td><td>' + e + '</td><td>' + plain(cost) + '</td><td>' + plain(ded) + '</td><td>' + plain(fine) + '</td><td><b>' + plain(net) + '</b></td></tr>';
      });
      Object.keys(sub).forEach(function (k) { total[k] += sub[k]; });
      html += '<div class="rv-block rv-print-block"><div class="rv-block-title"><h4>' + esc(g.label) + '</h4><span>' + sub.emp + ' موظف</span></div><div class="rv-substats">' + statCard('إجمالي التكلفة', plain(sub.cost)) + statCard('الحسميات والغرامات', plain(sub.ded + sub.fine)) + statCard('صافي الاستحقاق', plain(sub.net)) + '</div><div class="rv-scroll"><table class="rv-table att"><thead><tr><th>م</th><th>اسم الموظف</th><th>الوظيفة</th><th>الفئة</th><th>الجنسية</th><th>رقم الهوية / الإقامة</th>' + dayNums.map(function (d) { return '<th>' + d + '</th>'; }).join('') + '<th>حضور</th><th>غياب</th><th>إجازة</th><th>شاغر / تحت الإجراء</th><th>القيمة</th><th>الحسم</th><th>الغرامة</th><th>الصافي</th></tr></thead><tbody>' + body + '</tbody></table></div></div>';
    });
    return '<div class="rv-period-note">تم ضبط مصدر الحضور من لقطة المستخلص، وقراءة الأيام على فترة المستخلص الفعلية: <b>' + esc(pi.duration) + '</b> يوم — الأيام المعروضة: <b>' + esc(dayNums[0]) + ' إلى ' + esc(dayNums[dayNums.length - 1]) + '</b></div><div class="rv-main-stats">' + statCard('إجمالي الموظفين', total.emp, 'primary') + statCard('إجمالي التكلفة', money(total.cost), 'primary') + statCard('إجمالي الحسميات والغرامات', money(total.ded + total.fine), 'warn') + statCard('صافي الاستحقاق', money(total.net), 'ok') + '</div><div class="rv-att-mini">' + statCard('إجمالي الحضور', total.p) + statCard('إجمالي الغياب', total.a) + statCard('الإجازات', total.v) + statCard('الشاغر / تحت الإجراء', total.e) + '</div>' + html;
  }

  async function replaceAttendanceIfPossible() {
    var sec = document.getElementById('rv-attendance');
    if (!sec || !currentExtractId || sec.dataset.attendanceSourceFixedFor === String(currentExtractId)) return;
    var e = await fetchExtract(currentExtractId);
    if (!e) return;
    var snapshot = snapshotFromExtract(e);
    var html = buildAttendanceFromAnySource(snapshot, periodInfoFromExtract(e, snapshot));
    if (!html) return;
    sec.dataset.attendanceSourceFixedFor = String(currentExtractId);
    sec.innerHTML = '<h3>الحضور والانصراف</h3>' + html;
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
    if (!doc) return;

    var old = doc.querySelector('#rv-extra-saved-data');
    if (old) old.remove();

    doc.dataset.extraSnapshotFor = String(currentExtractId);
  }

  function run() {
    document.querySelectorAll('#rv-body pre.rv-pre').forEach(enhancePre);
    replaceAttendanceIfPossible();
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