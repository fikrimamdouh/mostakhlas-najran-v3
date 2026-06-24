// ===================================================================
// Admin Offices Full Extract — Site Performance/Achievement Guard V1
// Scope: admin_offices_attendance.html
// يضمن في طباعة المستخلص الكامل أن يأتي بعد حضور كل موقع:
// 1) جدول الأداء الخاص بالموقع في صفحة A4 واحدة.
// 2) شهادة الإنجاز الخاصة بالموقع بعدها، إذا لم تكن موجودة بالفعل.
// لا يكرر الصفحات الموجودة ولا يغير حسابات الحضور/الأداء/الإنجاز.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_FULL_EXTRACT_SITE_PERF_ACH_GUARD_V1__) return;
  window.__ADMIN_OFFICES_FULL_EXTRACT_SITE_PERF_ACH_GUARD_V1__ = true;

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
    return '<div class="signatures">' + sigs.map(function (sig) {
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
    return '<div class="page-container portrait-page-perf" data-center-key="' + esc(centerKey) + '" data-auto-site-performance="1"><div class="performance-report auto-site-performance-report">' + headerTable(centerKey) + '<div class="cert-title">جدول تقييم مستوى الأداء والإنجاز</div><div class="sub-title">لموقع: ' + esc(centerName) + ' - عن شهر ' + esc(monthName()) + '</div><div class="cost-bar">إجمالي المبلغ لأنشطة القسم: ' + money(cost) + ' ريال</div><table><thead><tr><th>م</th><th style="width:65%">أنشطة القسم</th><th>الدرجة القصوى</th><th>التقدير</th></tr></thead><tbody>' + rows + '</tbody></table><div class="summary"><p>التقدير الذي حصل عليه المقاول: <b>' + pct.toFixed(2) + '%</b>، نسبة الحسم: <b>' + deductionPct + '%</b>، ويساوي: <b>' + money(deductionAmount) + ' ريال</b></p></div>' + signatureBlock('performance') + '</div></div>';
  }

  function achievementPage(centerKey) {
    var n = getNames();
    var centerName = n[centerKey] || centerKey;
    var titles = achievementTitles();
    var a = calcAchievement(centerKey);
    var row = '<tr><td>العمالة</td><td>' + sar(a.monthly) + '</td><td>' + sar(a.absenceDeduct) + '</td><td>' + sar(a.absencePenalty) + '</td><td>' + sar(a.perf) + '</td><td>' + sar(a.nationPenalty) + '</td><td><b>' + sar(a.net) + '</b></td></tr><tr class="total-row"><td colspan="6">إجمالي المستحق للمقاول</td><td><b>' + sar(a.net) + '</b></td></tr><tr class="tafqeet-cell"><td colspan="7">فقط وقدره: ' + esc(tafqit(a.net)) + '</td></tr>';
    return '<div class="page-container portrait-page-ach" data-center-key="' + esc(centerKey) + '" data-auto-site-achievement="1"><div class="achievement-report auto-site-achievement-report">' + headerTable(centerKey) + '<div class="certificate-header"><h2>' + esc(titles.mainTitle || 'شهادة الإنجاز') + '</h2><h3 style="font-weight:normal;">' + esc(titles.subTitle || '') + '</h3><h3>لموقع: ' + esc(centerName) + ' - عن شهر ' + esc(monthName()) + '</h3></div><table><thead><tr><th>البند</th><th>القيمة الشهرية</th><th>حسم الغياب</th><th>غرامة الغياب</th><th>غرامة الأداء</th><th>غرامة الجنسية</th><th>الصافي الشهري</th></tr></thead><tbody>' + row + '</tbody></table>' + signatureBlock('achievement') + '</div></div>';
  }

  function printCss() {
    return '<style id="admin-full-extract-site-performance-achievement-guard-css">' +
      '@page portrait-orientation-perf{size:A4 portrait!important;margin:5mm!important}' +
      '@page portrait-orientation-ach{size:A4 portrait!important;margin:7mm!important}' +
      '.portrait-page-perf{page:portrait-orientation-perf!important;break-after:page!important;page-break-after:always!important;margin:0!important;padding:0!important;overflow:hidden!important}' +
      '.portrait-page-perf .performance-report{height:287mm!important;max-height:287mm!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;margin:0!important;padding:0!important;break-inside:avoid!important;page-break-inside:avoid!important}' +
      '.portrait-page-perf .header-table{margin:0 0 4px!important;border-bottom:1.5px solid #0056b3!important;flex:0 0 auto!important}.portrait-page-perf .header-table .logo{width:42px!important}.portrait-page-perf .header-table h1,.portrait-page-perf .header-table h2{font-size:9pt!important;line-height:1.1!important;margin:0!important}' +
      '.portrait-page-perf .cert-title{font-size:13pt!important;margin:4px 0 3px!important;line-height:1.2!important;flex:0 0 auto!important}.portrait-page-perf .sub-title{font-size:9pt!important;margin:2px 0 3px!important;line-height:1.25!important;flex:0 0 auto!important}.portrait-page-perf .cost-bar{font-size:8.5pt!important;padding:4px!important;margin:3px 0!important;line-height:1.2!important;flex:0 0 auto!important}' +
      '.portrait-page-perf table{width:100%!important;border-collapse:collapse!important;table-layout:fixed!important;font-size:7.1pt!important;margin:0!important;flex:0 1 auto!important}.portrait-page-perf th,.portrait-page-perf td{padding:2px 3px!important;line-height:1.15!important;border:1px solid #333!important;vertical-align:middle!important}.portrait-page-perf .item-text{text-align:right!important;white-space:normal!important;overflow-wrap:anywhere!important}.portrait-page-perf .perf-total td{background:#f0f0f0!important;font-weight:900!important}' +
      '.portrait-page-perf .summary{font-size:8.4pt!important;line-height:1.28!important;margin:4px 0 2px!important;flex:0 0 auto!important}.portrait-page-perf .signatures{margin-top:auto!important;padding-top:5px!important;border-top:1px solid #333!important;display:flex!important;justify-content:space-around!important;gap:8px!important;flex:0 0 auto!important}.portrait-page-perf .sign-box{font-size:8.5pt!important;width:24%!important;text-align:center!important}.portrait-page-perf .sign-box .line{margin-top:13px!important;border-bottom:1px solid #000!important}' +
      '.portrait-page-ach .achievement-report{break-inside:avoid!important;page-break-inside:avoid!important}.portrait-page-ach .header-table .logo{width:58px!important}.portrait-page-ach .certificate-header{margin-bottom:12px!important}.portrait-page-ach .certificate-header h2{font-size:17pt!important}.portrait-page-ach .certificate-header h3{font-size:11pt!important}.portrait-page-ach table{font-size:9.5pt!important}.portrait-page-ach th,.portrait-page-ach td{padding:6px!important}.portrait-page-ach .signatures{margin-top:28px!important}' +
    '</style>';
  }

  function selectedKeysAtPrintTime() {
    return Array.from(document.querySelectorAll('#print-centers-checkboxes input:checked')).map(function (cb) { return cb.value; }).filter(Boolean);
  }

  function hasReport(doc, centerKey, className, centerName) {
    var selectors = ['[data-center-key="' + CSS.escape(centerKey) + '"] .' + className, '.' + className];
    var nodes = Array.from(doc.querySelectorAll(selectors.join(',')));
    return nodes.some(function (node) {
      var text = clean(node.textContent);
      return text.indexOf(centerName) > -1 || (node.closest('[data-center-key]') && node.closest('[data-center-key]').getAttribute('data-center-key') === centerKey);
    });
  }

  function findAttendancePage(doc, centerName) {
    var pages = Array.from(doc.querySelectorAll('.page-container'));
    return pages.find(function (page) {
      var report = page.querySelector('.attendance-report');
      if (!report) return false;
      return clean(report.textContent).indexOf(centerName) > -1;
    }) || null;
  }

  function ensureSitePerfAchievementPages(win, keys, opts) {
    if (!win || !win.document || !win.document.body) return;
    var doc = win.document;
    if (!doc.getElementById('admin-full-extract-site-performance-achievement-guard-css')) {
      doc.head.insertAdjacentHTML('beforeend', printCss());
    }
    var n = getNames();
    keys.forEach(function (centerKey) {
      var centerName = n[centerKey] || centerKey;
      var attendancePage = findAttendancePage(doc, centerName);
      if (!attendancePage) return;
      var cursor = attendancePage;
      if (opts.performance && !hasReport(doc, centerKey, 'performance-report', centerName)) {
        cursor.insertAdjacentHTML('afterend', performancePage(centerKey));
        cursor = cursor.nextElementSibling || cursor;
      } else {
        var existingPerf = Array.from(doc.querySelectorAll('.performance-report')).find(function (node) { return clean(node.textContent).indexOf(centerName) > -1; });
        if (existingPerf && existingPerf.closest('.page-container')) cursor = existingPerf.closest('.page-container');
      }
      if (opts.achievement && !hasReport(doc, centerKey, 'achievement-report', centerName)) {
        cursor.insertAdjacentHTML('afterend', achievementPage(centerKey));
      }
    });
  }

  function patchPrintSelected() {
    if (typeof window.printSelected !== 'function' || window.printSelected.__sitePerfAchGuardWrapped) return false;
    var old = window.printSelected;
    window.printSelected = function sitePerfAchGuardPrintSelected() {
      var opts = {
        attendance: !!document.getElementById('print-opt-attendance')?.checked,
        performance: !!document.getElementById('print-opt-performance')?.checked,
        achievement: !!document.getElementById('print-opt-achievement')?.checked
      };
      var keys = selectedKeysAtPrintTime();
      var captured = null;
      var realOpen = window.open;
      window.open = function () { captured = realOpen.apply(window, arguments); return captured; };
      var result;
      try { result = old.apply(this, arguments); }
      finally { window.open = realOpen; }
      if (captured && opts.attendance && (opts.performance || opts.achievement) && keys.length) {
        var run = function () {
          try { ensureSitePerfAchievementPages(captured, keys, opts); }
          catch (e) { console.error('[FullExtractSitePerfAchGuard] failed:', e); }
        };
        run();
        setTimeout(run, 0);
        setTimeout(run, 60);
        setTimeout(run, 180);
      }
      return result;
    };
    window.printSelected.__sitePerfAchGuardWrapped = true;
    return true;
  }

  function boot(attempt) {
    patchPrintSelected();
    if (attempt < 60 && !window.printSelected?.__sitePerfAchGuardWrapped) setTimeout(function () { boot(attempt + 1); }, 250);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { boot(0); }); else boot(0);
  setTimeout(function () { boot(0); }, 1200);
  setTimeout(function () { boot(0); }, 3000);
  console.info('[Admin Offices Full Extract Site Perf/Ach Guard] installed v1');
})();