// ===================================================================
// Achievement Penalty Bridge V1
// Scope: achievement.html / normal hospital labor extract
// Purpose: make achievement read absence and performance penalties reliably.
// Does not change UI layout, department names, or saved attendance data shape.
// ===================================================================
(function () {
  'use strict';
  if (!/achievement\.html(?:$|[?#])/.test(location.pathname + location.search)) return;
  if (window.__ACHIEVEMENT_PENALTY_BRIDGE_V1__) return;
  window.__ACHIEVEMENT_PENALTY_BRIDGE_V1__ = true;

  var ABSENCE_FINES_BY_CATEGORY = {
    1: { saudi: 500, non_saudi: 500 },
    2: { saudi: 500, non_saudi: 500 },
    3: { saudi: 250, non_saudi: 100 },
    4: { saudi: 180, non_saudi: 80 },
    5: { saudi: 150, non_saudi: 80 },
    6: { saudi: 20, non_saudi: 20 },
    7: { saudi: 10, non_saudi: 10 },
    default: { saudi: 0, non_saudi: 0 }
  };

  var PERF_TABLE_IDS = ['cleaning', 'electricity', 'agriculture', 'civil', 'mechanics', 'laundry', 'security', 'new_section_8'];
  var TABLE_TO_DEPT = {
    cleaning: 'cleaning',
    electricity: 'electricity',
    agriculture: 'agriculture',
    civil: 'civil_works',
    mechanics: 'mechanical',
    laundry: 'laundry',
    security: 'patient_services',
    new_section_8: 'new_section_8'
  };

  function readJson(key, fallback) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }
  function num(v) {
    var n = Number(String(v == null ? '' : v).replace(/,/g, '').replace(/[ ريال﷼ر.سSAR]/g, '').trim());
    return Number.isFinite(n) ? n : 0;
  }
  function periodDetails() {
    try {
      if (typeof window.getExtractPeriodDetails === 'function') {
        var p = window.getExtractPeriodDetails();
        if (p && (p.totalDaysInMonth || p.daysInMonth)) return {
          daysInMonth: Math.max(1, num(p.daysInMonth || p.daysInExtract || 30) || 30),
          totalDaysInMonth: Math.max(1, num(p.totalDaysInMonth || 30) || 30)
        };
      }
    } catch (_) {}
    var e = readJson('persistentExtractData', readJson('extractData', {}));
    var start = e.extractStart ? new Date(e.extractStart) : new Date();
    var end = e.extractEnd ? new Date(e.extractEnd) : start;
    var days = Math.max(1, Math.ceil((end - start) / 86400000) + 1 || 30);
    var total = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate() || 30;
    return { daysInMonth: days, totalDaysInMonth: total };
  }
  function isSaudi(emp) {
    return String(emp.nationality || emp.nationalityText || '').trim() === 'سعودي';
  }
  function categoryFine(emp) {
    var cat = String(emp.category || emp.cat || emp.fineCategory || '1').replace(/[^\d]/g, '') || '1';
    return ABSENCE_FINES_BY_CATEGORY[cat] || ABSENCE_FINES_BY_CATEGORY.default;
  }
  function normalizeDays(emp, daysInMonth) {
    var days = Array.isArray(emp.days) ? emp.days.slice() : [];
    if (!days.length && Array.isArray(emp.attendance)) days = emp.attendance.slice();
    if (!days.length && emp.statuses && typeof emp.statuses === 'object') days = Object.values(emp.statuses);
    while (days.length < daysInMonth) days.push('ح');
    return days.slice(0, daysInMonth).map(function (x) { return String(x || 'ح').trim(); });
  }
  function calcEmp(emp, p) {
    var salary = num(emp.salary || emp.basicSalary || emp.totalSalary || emp.monthlySalary);
    var daily = p.totalDaysInMonth > 0 ? salary / p.totalDaysInMonth : 0;
    var days = normalizeDays(emp, p.daysInMonth);
    var absenceDays = days.filter(function (d) { return d === 'غ'; }).length;
    var deductionOnlyDays = days.filter(function (d) { return d !== 'ح' && d !== 'ت' && d !== 'غ'; }).length;
    var deduction = Number.isFinite(num(emp.deduction)) && num(emp.deduction) > 0 ? num(emp.deduction) : (absenceDays + deductionOnlyDays) * daily;
    var fineCfg = categoryFine(emp);
    var absencePenalty = Number.isFinite(num(emp.absencePenalty)) && num(emp.absencePenalty) > 0
      ? num(emp.absencePenalty)
      : absenceDays * (isSaudi(emp) ? fineCfg.saudi : fineCfg.non_saudi);
    var nationalityFine = num(emp.nationalityFine || emp.nationalityPenalty || 0);
    return { deduction: deduction, absencePenalty: absencePenalty, nationalityFine: nationalityFine };
  }
  function deptAttendanceTotals(deptKey) {
    var attendanceData = readJson('attendanceData', {});
    var rows = Array.isArray(attendanceData[deptKey]) ? attendanceData[deptKey] : [];
    var p = periodDetails();
    return rows.reduce(function (t, emp) {
      var r = calcEmp(emp || {}, p);
      t.deduction += r.deduction;
      t.absencePenalty += r.absencePenalty;
      t.nationalityFine += r.nationalityFine;
      return t;
    }, { deduction: 0, absencePenalty: 0, nationalityFine: 0 });
  }
  function calcDeductionPercent(percent) {
    percent = Number(percent) || 0;
    if (percent < 60) return 15;
    if (percent < 65) return 10;
    if (percent < 70) return 8;
    if (percent < 75) return 6;
    if (percent < 80) return 4;
    if (percent < 85) return 2;
    return 0;
  }
  function scoreFromSavedTable(tableId) {
    var saved = readJson('tableData_' + tableId, null);
    if (!saved || !Array.isArray(saved.rows)) return null;
    var max = 0, score = 0;
    saved.rows.forEach(function (r) {
      max += num(r.maxScore || r.max || r.maximum);
      score += num(r.score || r.value || r.actualScore);
    });
    var amount = num(saved.amount || localStorage.getItem(tableId + '-amount'));
    return { max: max, score: score, amount: amount };
  }
  function scoreFromDom(tableId) {
    var table = document.getElementById(tableId + '-table');
    var amountInput = document.getElementById(tableId + '-amount');
    if (!table) return null;
    var max = 0, score = 0;
    table.querySelectorAll('tbody tr:not(.total-row)').forEach(function (row) {
      var cells = row.cells || [];
      max += num(cells[1] && cells[1].textContent);
      var input = cells[2] && cells[2].querySelector('input');
      score += input ? num(input.value) : num(cells[2] && cells[2].textContent);
    });
    return { max: max, score: score, amount: num(amountInput && amountInput.value) };
  }
  function computePerformancePenalty() {
    var total = 0;
    PERF_TABLE_IDS.forEach(function (tableId) {
      var data = scoreFromDom(tableId) || scoreFromSavedTable(tableId);
      if (!data || !data.amount || !data.max) return;
      var percent = (data.score / data.max) * 100;
      var pct = calcDeductionPercent(Math.floor(percent));
      total += data.amount * pct / 100;
    });
    return total;
  }
  function repairStoredPerformanceTotal() {
    var computed = computePerformancePenalty();
    if (computed > 0) {
      localStorage.setItem('performanceTotalDeduction', computed.toFixed(2));
      return computed;
    }
    return num(localStorage.getItem('performanceTotalDeduction'));
  }
  function patchAchievementProcessor() {
    if (typeof window.loadAndProcessAchievementData !== 'function') return false;
    if (window.loadAndProcessAchievementData.__penaltyBridgeV1) return true;
    var original = window.loadAndProcessAchievementData;
    window.loadAndProcessAchievementData = function bridgedLoadAndProcessAchievementData() {
      try { repairStoredPerformanceTotal(); } catch (e) { console.warn('[AchievementPenaltyBridge] performance repair failed', e); }
      var result = original.apply(this, arguments);
      try { patchRenderedRows(); } catch (e) { console.warn('[AchievementPenaltyBridge] row patch failed', e); }
      return result;
    };
    window.loadAndProcessAchievementData.__penaltyBridgeV1 = true;
    return true;
  }
  function money(v) {
    return Number(v || 0).toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' });
  }
  function patchRenderedRows() {
    var rows = Array.from(document.querySelectorAll('#tableBody tr'));
    if (!rows.length) return;
    var workforce = { deduction: 0, absencePenalty: 0, nationalityFine: 0 };
    ['cleaning', 'electricity', 'agriculture', 'civil_works', 'mechanical', 'laundry', 'patient_services'].forEach(function (k) {
      var t = deptAttendanceTotals(k);
      workforce.deduction += t.deduction;
      workforce.absencePenalty += t.absencePenalty;
      workforce.nationalityFine += t.nationalityFine;
    });
    var admin = deptAttendanceTotals('admin_saudi');
    var performance = repairStoredPerformanceTotal();
    var workforceRow = rows.find(function (r) { return /العمالة|القوى|workforce/i.test(r.cells[0] && r.cells[0].textContent || ''); });
    var adminRow = document.getElementById('admin-jobs-row') || rows.find(function (r) { return /الإدارية|السعود/i.test(r.cells[0] && r.cells[0].textContent || ''); });
    if (workforceRow && workforceRow.cells.length >= 7) {
      var monthly = num(workforceRow.cells[1].textContent);
      var net = monthly - workforce.deduction - workforce.absencePenalty - performance - workforce.nationalityFine;
      workforceRow.cells[2].textContent = money(workforce.deduction);
      workforceRow.cells[3].textContent = money(workforce.absencePenalty);
      workforceRow.cells[4].textContent = money(performance);
      workforceRow.cells[5].textContent = money(workforce.nationalityFine);
      workforceRow.cells[6].textContent = money(net);
    }
    if (adminRow && adminRow.cells.length >= 7) {
      var adminMonthly = num(adminRow.cells[1].textContent);
      var adminNet = adminMonthly - admin.deduction - admin.absencePenalty - admin.nationalityFine;
      adminRow.cells[2].textContent = money(admin.deduction);
      adminRow.cells[3].textContent = money(admin.absencePenalty);
      adminRow.cells[5].textContent = money(admin.nationalityFine);
      adminRow.cells[6].textContent = money(adminNet);
    }
    patchTotalRow(rows);
  }
  function patchTotalRow(rows) {
    var totalRow = rows.find(function (r) { return r.classList.contains('total-row'); });
    if (!totalRow || totalRow.cells.length < 7) return;
    var totals = [0, 0, 0, 0, 0, 0];
    rows.forEach(function (row) {
      if (row === totalRow || row.classList.contains('tafqeet-row')) return;
      if (row.style && row.style.display === 'none') return;
      for (var i = 1; i <= 6; i++) totals[i - 1] += num(row.cells[i] && row.cells[i].textContent);
    });
    for (var c = 1; c <= 6; c++) totalRow.cells[c].innerHTML = '<strong>' + money(totals[c - 1]) + '</strong>';
    try {
      localStorage.setItem('finalLaborCost', totals[5].toFixed(2));
      var hn = (localStorage.getItem('hospitalName') || '').trim();
      if (hn) localStorage.setItem('finalLaborCost_' + hn, totals[5].toFixed(2));
    } catch (_) {}
  }

  function boot(attempt) {
    patchAchievementProcessor();
    if (typeof window.loadAndProcessAchievementData === 'function') {
      try { window.loadAndProcessAchievementData(); } catch (_) {}
    }
    if (attempt < 16) setTimeout(function () { boot(attempt + 1); }, 450);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { boot(0); });
  else boot(0);
  window.addEventListener('storage', function () { setTimeout(function () { try { window.loadAndProcessAchievementData(); } catch (_) {} }, 120); });

  console.info('[AchievementPenaltyBridge] installed v1 absence + performance bridge');
})();
