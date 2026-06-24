// ===================================================================
// Admin Offices Full Extract — Site Performance/Achievement Guard V2
// Scope: admin_offices_attendance.html
// يضمن في طباعة المستخلص الكامل أن يأتي بعد حضور كل موقع:
// 1) جدول الأداء الخاص بالموقع في صفحة A4 واحدة.
// 2) شهادة الإنجاز الخاصة بالموقع بعدها، إذا لم تكن موجودة بالفعل.
// لا يكرر الصفحات الموجودة ولا يغير حسابات الحضور/الأداء/الإنجاز.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_FULL_EXTRACT_SITE_PERF_ACH_GUARD_V2__) return;
  window.__ADMIN_OFFICES_FULL_EXTRACT_SITE_PERF_ACH_GUARD_V2__ = true;

  function readJson(key, fallback) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }
  function esc(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function clean(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
  function num(v) {
    var n = Number(String(v == null ? '' : v).replace(/,/g, '').replace(/[ ريال﷼]/g, '').trim());
    return Number.isFinite(n) ? n : 0;
  }
  function money(v) { return num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function sar(v) { return money(v) + ' ريال'; }
  function safeDate(v) { try { var d = v instanceof Date ? v : new Date(v); return Number.isNaN(d.getTime()) ? 'غير محدد' : d.toLocaleDateString('en-CA'); } catch (_) { return 'غير محدد'; } }

  function getNames() {
    try { if (typeof window.getCenterNames === 'function') return window.getCenterNames() || {}; } catch (_) {}
    return readJson('adminOfficeNames_v1', {});
  }
  function getData() {
    var list = [];
    try { if (typeof window.getAttendanceData === 'function') list.push(window.getAttendanceData() || {}); } catch (_) {}
    list.push(readJson('adminOfficesAttendanceData_v1', {}), readJson('adminOfficesAttendanceData_v1_localBackup', {}), readJson('adminOfficesLaborDataSafe_v2', {}), readJson('adminOfficesAttendanceData', {}));
    function count(o) { return Object.values(o || {}).reduce(function (s, rows) { return s + (Array.isArray(rows) ? rows.length : 0); }, 0); }
    return list.reduce(function (best, item) { return count(item) > count(best) ? item : best; }, {});
  }
  function getPeriod() {
    try { if (typeof window.getExtractPeriodDetails === 'function') return window.getExtractPeriodDetails(); } catch (_) {}
    var e = readJson('persistentExtractData', {});
    var start = new Date(e.extractStart || localStorage.getItem('extractStart') || Date.now());
    var end = new Date(e.extractEnd || localStorage.getItem('extractEnd') || e.extractStart || Date.now());
    var safeStart = Number.isNaN(start.getTime()) ? new Date() : start;
    var safeEnd = Number.isNaN(end.getTime()) ? safeStart : end;
    return {
      startDate: safeStart,
      endDate: safeEnd,
      daysInExtract: Math.max(1, Math.ceil((safeEnd - safeStart) / 86400000) + 1 || 30),
      totalDaysInMonth: new Date(safeStart.getFullYear(), safeStart.getMonth() + 1, 0).getDate() || 30
    };
  }
  function monthName() {
    var p = getPeriod();
    try { return p.startDate.toLocaleString('ar-SA-u-nu-latn-ca-gregory', { month: 'long', year: 'numeric' }); } catch (_) { return safeDate(p.startDate); }
  }
  function headerTable(centerKey) {
    var ch = { logoSrc: 'moh_logo.png', h1: 'فرع وزارة الصحة بمنطقة نجران', h3: 'المكاتب الإدارية والمرافق الصحية' };
    try { if (typeof window.getHeaderForCenter === 'function') ch = window.getHeaderForCenter(centerKey) || ch; } catch (_) {}
    return '<table class="header-table"><tr><td><img class="logo" src="' + esc(ch.logoSrc || 'moh_logo.png') + '"></td><td class="title-box"><h1>' + esc(ch.h1 || '') + '</h1><h2>' + esc(ch.h3 || '') + '</h2></td><td><img class="logo" src="' + esc(ch.logoSrc || 'moh_logo.png') + '"></td></tr></table>';
  }
  function signatureBlock(type) {
    var sigs = [];
    try { if (typeof window.getSignatures === 'function') sigs = window.getSignatures(type) || []; } catch (_) {}
    if (!sigs.length) sigs = [{ title: '........................', name: '........................' }, { title: '........................', name: '........................' }];
    return '<div class="signatures performance-signature-zone">' + sigs.map(function (sig) {
      return '<div class="sign-box"><div class="title">' + esc(sig.title || '') + '</div><div class="line"></div><div>' + esc(sig.name || '................') + '</div></div>';
    }).join('') + '</div>';
  }
  function performanceItems() {
    try { if (typeof window.getDynamicPerformanceItems === 'function') return window.getDynamicPerformanceItems() || []; } catch (_) {}
    var saved = readJson('adminOfficePerformanceItems_v1', []);
    if (Array.isArray(saved) && saved.length) return saved;
    return [
      { text: 'الالتزام بتنفيذ أعمال الصيانة والنظافة والتشغيل غير الطبي وفق متطلبات العقد', max: 100 }
    ];
  }
  function performanceScores(centerKey) {
    try { if (typeof window.getPerformanceData === 'function') return (window.getPerformanceData() || {})[centerKey] || {}; } catch (_) {}
    return (readJson('performanceData_v4', {})[centerKey] || readJson('performanceData', {})[centerKey] || {});
  }
  function centerCost(centerKey) {
    try { if (typeof window.calculateCenterTotalCost === 'function') return num(window.calculateCenterTotalCost(centerKey)); } catch (_) {}
    var rows = getData()[centerKey] || [];
    var p = getPeriod();
    return rows.reduce(function (sum, emp) {
      var salary = num(emp.salary);
      return sum + (p.totalDaysInMonth > 0 ? salary / p.totalDaysInMonth * p.daysInExtract : 0);
    }, 0);
  }
  function achievementTitles() {
    try { if (typeof window.getAchievementTitles === 'function') return window.getAchievementTitles() || {}; } catch (_) {}
    return { mainTitle: 'شهادة الإنجاز', subTitle: 'أعمال النظافة والصيانة والتشغيل غير الطبي' };
  }
  function calcAchievement(centerKey) {
    var rows = getData()[centerKey] || [];
    var p = getPeriod();
    var contract = readJson('persistentContractData', {});
    var directRatio = num(contract.directPurchaseRatio);
    var monthly = 0, absenceDeduct = 0, absencePenalty = 0, nationPenalty = 0;
    rows.forEach(function (emp) {
      var salary = num(emp.salary);
      var adjusted = salary + (salary * directRatio / 100);
      monthly += adjusted;
      var daily = p.totalDaysInMonth > 0 ? adjusted / p.totalDaysInMonth : 0;
      var days = Array.isArray(emp.days) ? emp.days : [];
      var absenceDays = days.filter(function (d) {
        try { return (window.STATUS_CODES && window.STATUS_CODES[d] && window.STATUS_CODES[d].isAbsence) || d === 'غ'; } catch (_) { return d === 'غ'; }
      }).length;
      var fineConfig = (window.ABSENCE_FINES_BY_CATEGORY && (window.ABSENCE_FINES_BY_CATEGORY[emp.category] || window.ABSENCE_FINES_BY_CATEGORY.default)) || { saudi: 0, non_saudi: 0 };
      absenceDeduct += absenceDays * daily;
      absencePenalty += absenceDays * (String(emp.nationality || '').includes('سعودي') && !String(emp.nationality || '').includes('غير') ? num(fineConfig.saudi) : num(fineConfig.non_saudi));
      nationPenalty += num(emp.nationalityFine);
    });
    var perf = num((readJson('adminOfficePerformanceDeductions_v1', {})[centerKey] !== undefined ? readJson('adminOfficePerformanceDeductions_v1', {})[centerKey] : readJson('performanceDeductions', {})[centerKey]));
    var net = monthly - absenceDeduct - absencePenalty - perf - nationPenalty;
    return { monthly: monthly, absenceDeduct: absenceDeduct, absencePenalty: absencePenalty, perf: perf, nationPenalty: nationPenalty, net: net };
  }
  function tafqit(value) {
    try { if (typeof window.tafqit === 'function') return window.tafqit(value); } catch (_) {}
    try { if (window.AdminOfficesRaiseLetters && typeof window.AdminOfficesRaiseLetters.tafqeetSAR === 'function') return window.AdminOfficesRaiseLetters.tafqeetSAR(value); } catch (_) {}
    return 'فقط وقدره ' + sar(value) + ' لا غير';
  }

  function performancePage(centerKey) {
    var n = getNames();
    var centerName = n[centerKey] || centerKey;
    var items = performanceItems();
    var scores = performanceScores(centerKey);
    var maxTotal = 0, scoreTotal = 0;
    var rows = items.map(function (item, i) {
      var max = num(item.max || item.maxScore || item.degree || 0);
      var score = scores[i] !== undefined ? num(scores[i]) : max;
      maxTotal += max;
      scoreTotal += score;
      return '<tr><td>' + (i + 1) + '</td><td class="item-text">' + esc(item.text || item.name || item.title || '') + '</td><td>' + max + '</td><td>' + score + '</td></tr>';
    }).join('');
    rows += '<tr class="perf-total"><td colspan="2">المجموع</td><td>' + maxTotal + '</td><td>' + scoreTotal + '</td></tr>';
    var pct = maxTotal > 0 ? (scoreTotal / maxTotal * 100) : 100;
    var deductionPct = 0;
    if (pct < 60) deductionPct = 15; else if (pct < 65) deductionPct = 10; else if (pct < 70) deductionPct = 8; else if (pct < 75) deductionPct = 6; else if (pct < 80) deductionPct = 4; else if (pct < 85) deductionPct = 2;
    var cost = centerCost(centerKey);
    var deductionAmount = cost * deductionPct / 100;
    var table = '<table class="performance-compact-table"><thead><tr><th>م</th><th>أنشطة القسم</th><th>الدرجة القصوى</th><th>التقدير</th></tr></thead><tbody>' + rows + '</tbody></table>';
    var summary = '<div class="performance-compact-summary">التقدير: <b>' + pct.toFixed(2) + '%</b> | نسبة الحسم: <b>' + deductionPct + '%</b> | مبلغ الحسم: <b>' + money(deductionAmount) + ' ريال</b></div>';
    return '<div class="page-container portrait-page-perf performance-compact-page" data-center-key="' + esc(centerKey) + '" data-auto-site-performance="1"><div class="performance-report auto-site-performance-report performance-compact-report">' + headerTable(centerKey) + '<div class="cert-title">جدول تقييم مستوى الأداء والإنجاز</div><div class="sub-title">لموقع: ' + esc(centerName) + ' - عن شهر ' + esc(monthName()) + '</div><div class="cost-bar">إجمالي المبلغ لأنشطة القسم (تكلفة العمالة): ' + money(cost) + ' ريال</div>' + table + summary + signatureBlock('performance') + '</div></div>';
  }

  function achievementPage(centerKey) {
    var n = getNames();
    var centerName = n[centerKey] || centerKey;
    var titles = achievementTitles();
    var a = calcAchievement(centerKey);
    var row = '<tr><td>العمالة</td><td>' + sar(a.monthly) + '</td><td>' + sar(a.absenceDeduct) + '</td><td>' + sar(a.absencePenalty) + '</td><td>' + sar(a.perf) + '</td><td>' + sar(a.nationPenalty) + '</td><td><b>' + sar(a.net) + '</b></td></tr><tr class="total-row"><td colspan="6">إجمالي المستحق للمقاول</td><td><b>' + sar(a.net) + '</b></td></tr><tr class="tafqeet-cell"><td colspan="7">فقط وقدره: ' + esc(tafqit(a.net)) + '</td></tr>';
    return '<div class="page-container portrait-page-ach" data-center-key="' + esc(centerKey) + '" data-auto-site-achievement="1"><div class="achievement-report auto-site-achievement-report">' + headerTable(centerKey) + '<div class="certificate-header"><h2>' + esc(titles.mainTitle || 'شهادة الإنجاز') + '</h2><h3 style="font-weight:normal;">' + esc(titles.subTitle || '') + '</h3><h3>لموقع: ' + esc(centerName) + ' - عن شهر ' + esc(monthName()) + '</h3></div><table><thead><tr><th>البند</th><th>القيمة الشهرية</th><th>حسم الغياب</th><th>غرامة الغياب</th><th>غرامة الأداء</th><th>غرامة الجنسية</th><th>الصافي الشهري</th></tr></thead><tbody>' + row + '</tbody></table>' + signatureBlock('achievement') + '</div></div>';
  }

  function hasPage(doc, centerKey, attr) {
    try { return !!doc.querySelector('[data-center-key="' + CSS.escape(centerKey) + '"][' + attr + ']'); } catch (_) { return false; }
  }
  function selectedKeysFromPrintWindow(doc) {
    var keys = [];
    doc.querySelectorAll('[data-center-key]').forEach(function (el) {
      var k = el.getAttribute('data-center-key');
      if (k && keys.indexOf(k) === -1) keys.push(k);
    });
    if (!keys.length) keys = Object.keys(getData() || {});
    return keys;
  }
  function injectPages(win) {
    if (!win || !win.document || win.__adminOfficesFullExtractPerfAchDone) return;
    win.__adminOfficesFullExtractPerfAchDone = true;
    var doc = win.document;
    var keys = selectedKeysFromPrintWindow(doc);
    var html = '';
    keys.forEach(function (key) {
      if (!hasPage(doc, key, 'data-auto-site-performance')) html += performancePage(key);
      if (!hasPage(doc, key, 'data-auto-site-achievement')) html += achievementPage(key);
    });
    if (!html) return;
    doc.body.insertAdjacentHTML('beforeend', html);
  }
  function patchPrintSelected() {
    if (typeof window.printSelected !== 'function' || window.printSelected.__adminOfficesFullExtractPerfAchGuardV2) return false;
    var old = window.printSelected;
    window.printSelected = function patchedPrintSelected() {
      var captured = null;
      var realOpen = window.open;
      window.open = function () { captured = realOpen.apply(window, arguments); return captured; };
      try {
        var out = old.apply(this, arguments);
        if (captured) {
          setTimeout(function () { injectPages(captured); }, 250);
          setTimeout(function () { injectPages(captured); }, 650);
          setTimeout(function () { injectPages(captured); }, 1100);
        }
        return out;
      } finally {
        window.open = realOpen;
      }
    };
    window.printSelected.__adminOfficesFullExtractPerfAchGuardV2 = true;
    return true;
  }
  function boot(attempt) {
    patchPrintSelected();
    if (attempt < 40 && !window.printSelected?.__adminOfficesFullExtractPerfAchGuardV2) setTimeout(function () { boot(attempt + 1); }, 250);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { boot(0); }); else boot(0);
  setTimeout(function () { boot(0); }, 1000);
  setTimeout(function () { boot(0); }, 2500);
  document.addEventListener('click', function () { setTimeout(function () { boot(0); }, 80); setTimeout(function () { boot(0); }, 300); }, true);
  console.info('[Admin Offices Full Extract Site Perf/Ach Guard] installed v2 compact performance structure');
})();
