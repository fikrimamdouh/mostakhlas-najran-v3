// Page activity tracker + admin offices production patches
(function () {
  var PAGE_NAMES = {
    "settings_main.html": "الإعدادات الرئيسية",
    "settings_advanced.html": "الإعدادات المتقدمة",
    "attendance.html": "الحضور والانصراف",
    "performance.html": "جداول الأداء",
    "achievement.html": "شهادة الإنجاز",
    "consumables.html": "مستخلص المستهلكات",
    "spare_parts.html": "مستخلص قطع الغيار",
    "approval.html": "اعتماد المستخلص",
    "health_centers.html": "المراكز الصحية",
    "health_centers_attendance.html": "حضور المراكز الصحية",
    "health_centers_consumables.html": "مستهلكات المراكز الصحية",
    "review_extract.html": "مراجعة المستخلص",
    "extract-archive.html": "أرشيف المستخلصات",
    "admin_offices_attendance.html": "مستخلص العمالة للمكاتب الإدارية والمرافق الصحية"
  };
  var filename = window.location.pathname.split("/").pop();
  var pageName = PAGE_NAMES[filename];
  if (!pageName) return;

  function getSession() {
    try {
      var s = JSON.parse(localStorage.getItem("najran_session") || "null");
      if (!s || !s.clerkToken) return null;
      if (Date.now() - s.timestamp > 8 * 60 * 60 * 1000) return null;
      return s;
    } catch (e) { return null; }
  }
  function reportActivity(extraFields) {
    var session = getSession();
    if (!session) return;
    fetch("/api/users/me/activity", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + session.clerkToken },
      body: JSON.stringify(Object.assign({ page: pageName }, extraFields || {}))
    }).catch(function () {});
  }
  reportActivity();
  setInterval(function () { reportActivity(); }, 3 * 60 * 1000);
  window.najranTrackEvent = function (eventType, details) { reportActivity({ event: eventType, details: details }); };
})();

(function () {
  var filename = window.location.pathname.split("/").pop();
  if (filename !== "admin_offices_attendance.html") return;

  var DEFAULT_ADMIN_PERFORMANCE_ITEMS = [
    { text: 'مدى نظافة المبنى من الداخل والخارج وكذلك السطح', max: 5 },
    { text: 'مدى نظافة العيادات والصيدلية والمختبر', max: 5 },
    { text: 'مدى نظافة الممرات', max: 5 },
    { text: 'مدى نظافة الأثاث والمفروشات', max: 4 },
    { text: 'مدى نظافة دورات المياه', max: 5 },
    { text: 'مدى مكافحة الحشرات والتخلص من النفايات غير الطبية', max: 4 },
    { text: 'مدى صيانة سبكة الكهرباء واستبدال الأجزاء التالفة', max: 4 },
    { text: 'مدى كفائة الإنارة وتغيير التالف من اللمبات والبرايز والمفاتيح', max: 4 },
    { text: 'مدى المرور والصيانة لفريق الصيانة', max: 5 },
    { text: 'مدى صيانة الأجهزة الكهربائية ( تليفون - فيديو - مروحة )', max: 4 },
    { text: 'مدى صيانة المكيفات والثلاجات والبردات والسخانات', max: 5 },
    { text: 'مدى تنظيف خزانات المياه العلوية والسفلية كل ثلاث شهور', max: 5 },
    { text: 'مدى تسليك مواسير الصرف الصحي وكسح المجاري', max: 3 },
    { text: 'مدى إصلاح المغاسل والسيفونات والمحابس والحنفيات', max: 4 },
    { text: 'مدى إصلاح الطلمبات وشبكة المياه', max: 4 },
    { text: 'مدى أداء الصيانة العامة للمبنى ( نجارة - دهان - بلاط )', max: 4 },
    { text: 'مدى صيانة الأثاث ( مكتب - كرسي - دواليب - اسرة )', max: 4 },
    { text: 'مدى صيانة وتعبئة وسائل مكافحة الحريق وأجهزة كشف الدخان', max: 3 },
    { text: 'مدى صيانة الآت التصوير والالآت الكاتبة', max: 5 },
    { text: 'مدى توفير قطع الغيار ومستهلكات الصيانة', max: 5 },
    { text: 'مدى توفير أدوات النظافة ( مكانس - سطول -سلات - أكياس )', max: 4 },
    { text: 'مدى ارتداء العاملين للزي الرسمي وحمل بطاقات الهوية وتوفير الشهادات الصحية', max: 4 },
    { text: 'مدى إصلاح المصاعد', max: 5 }
  ];

  function readJson(key, fallback) { try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; } }
  function writeJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function esc(v) { return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function money(n) { return (Number(n) || 0).toFixed(2); }
  function namesSafe() { try { if (typeof getCenterNames === 'function') return getCenterNames() || {}; } catch (e) {} return readJson('adminOfficeNames_v1', {}); }
  function dataSafe() { try { if (typeof getAttendanceData === 'function') return getAttendanceData() || {}; } catch (e) {} return readJson('adminOfficesAttendanceData_v1', {}); }
  function periodSafe() { try { if (typeof getExtractPeriodDetails === 'function') return getExtractPeriodDetails(); } catch (e) {} return { startDate: new Date(), daysInExtract: 30, totalDaysInMonth: 30 }; }
  function orderedKeys() {
    var n = namesSafe();
    return Object.keys(n).sort(function (a, b) {
      if (a.indexOf('center_') === 0 && b.indexOf('center_') === 0) return parseInt(a.split('_')[1], 10) - parseInt(b.split('_')[1], 10);
      if (a.indexOf('center_') === 0) return -1;
      if (b.indexOf('center_') === 0) return 1;
      return a.localeCompare(b);
    });
  }
  function getHeaderForOffice(centerKey) { try { if (typeof getHeaderForCenter === 'function') return getHeaderForCenter(centerKey); } catch (e) {} return { logoSrc: 'najran_health_cluster_logo.png', h1: 'فرع وزارة الصحة بمنطقة نجران', h3: 'المكاتب الإدارية' }; }
  function statusMeta(code) { return (window.STATUS_CODES && window.STATUS_CODES[code]) || ({ 'غ': { isAbsence: true } })[code] || { isAbsence: false }; }
  function fineCfg(category) { return (window.ABSENCE_FINES_BY_CATEGORY && window.ABSENCE_FINES_BY_CATEGORY[category]) || { saudi: 0, non_saudi: 0 }; }
  function formatDate(dateString) { try { return dateString ? new Date(dateString).toLocaleDateString('en-CA') : 'غير محدد'; } catch (e) { return 'غير محدد'; } }

  window.getPerformanceItems = function (centerKey) {
    var key = 'adminOfficePerformanceItems_' + (centerKey || 'general') + '_v1';
    var items = readJson(key, null);
    return Array.isArray(items) && items.length ? items : JSON.parse(JSON.stringify(DEFAULT_ADMIN_PERFORMANCE_ITEMS));
  };
  window.savePerformanceItems = function (centerKey, items) { writeJson('adminOfficePerformanceItems_' + (centerKey || 'general') + '_v1', Array.isArray(items) ? items : DEFAULT_ADMIN_PERFORMANCE_ITEMS); };
  window.getPerformanceData = function () { return readJson('adminOfficesPerformanceData_v1', {}); };
  window.savePerformanceData = function (data) { writeJson('adminOfficesPerformanceData_v1', data || {}); };
  window.calculateCenterTotalCost = function (centerKey) {
    var centerData = dataSafe()[centerKey] || [];
    var p = periodSafe();
    var totalDays = p.totalDaysInMonth || 30;
    var days = p.daysInExtract || 30;
    var contract = readJson('persistentContractData', {});
    var ratio = parseFloat(contract.directPurchaseRatio) || 0;
    return centerData.reduce(function (sum, emp) {
      var salary = parseFloat(emp.salary) || 0;
      var cost = (totalDays > 0 ? salary / totalDays : 0) * days;
      if (contract.contractType === 'شراء مباشر' && ratio > 0) cost += cost * ratio / 100;
      return sum + cost;
    }, 0);
  };
  window.calculatePerformanceSummary = function (centerKey) {
    var data = window.getPerformanceData()[centerKey] || {};
    var items = window.getPerformanceItems(centerKey);
    var maxTotal = 0, scoreTotal = 0;
    items.forEach(function (item, index) { var max = parseInt(item.max, 10) || 0; maxTotal += max; scoreTotal += data[index] !== undefined ? Number(data[index]) || 0 : max; });
    var percentage = maxTotal > 0 ? (scoreTotal / maxTotal) * 100 : 100;
    var deductionPercentage = 0;
    if (percentage < 60) deductionPercentage = 15; else if (percentage < 65) deductionPercentage = 10; else if (percentage < 70) deductionPercentage = 8; else if (percentage < 75) deductionPercentage = 6; else if (percentage < 80) deductionPercentage = 4; else if (percentage < 85) deductionPercentage = 2;
    var centerCost = window.calculateCenterTotalCost(centerKey);
    var deductionAmount = centerCost * deductionPercentage / 100;
    var maxEl = document.getElementById('perf-max-total-' + centerKey); if (maxEl) maxEl.textContent = maxTotal;
    var scoreEl = document.getElementById('perf-score-total-' + centerKey); if (scoreEl) scoreEl.textContent = scoreTotal;
    var summary = document.getElementById('perf-summary-' + centerKey);
    if (summary) summary.innerHTML = '<p>إجمالي المبلغ لأنشطة القسم = <span>' + money(centerCost) + '</span> ريال</p><p>التقدير الذي حصل عليه المقاول : <span>' + percentage.toFixed(2) + '%</span></p><p>نسبة الحسم على المقاول لهذا القسم : <span>' + deductionPercentage + '%</span> ويساوي <span>' + money(deductionAmount) + '</span> ريال</p>';
    var deductions = readJson('adminOfficesPerformanceDeductions_v1', {}); deductions[centerKey] = deductionAmount; writeJson('adminOfficesPerformanceDeductions_v1', deductions);
    var legacy = readJson('performanceDeductions', {}); legacy[centerKey] = deductionAmount; writeJson('performanceDeductions', legacy);
    if (typeof window.calculateAndDisplayGrandTotal === 'function') setTimeout(window.calculateAndDisplayGrandTotal, 0);
  };
  window.resetPerformanceScores = function (centerKey) {
    if (!confirm('هل تريد إعادة درجات تقييم الأداء لهذا المكتب/المرفق إلى الدرجة الكاملة؟')) return;
    var data = window.getPerformanceData(); delete data[centerKey]; window.savePerformanceData(data);
    var deductions = readJson('adminOfficesPerformanceDeductions_v1', {}); delete deductions[centerKey]; writeJson('adminOfficesPerformanceDeductions_v1', deductions);
    if (typeof renderPerformanceTable === 'function') renderPerformanceTable(centerKey);
    if (typeof window.calculateAndDisplayGrandTotal === 'function') window.calculateAndDisplayGrandTotal();
  };
  window.exportPerformanceToPDF = function (centerKey) { var el = document.getElementById('performance-certificate-' + centerKey); if (!el) return alert('افتح جدول الأداء أولاً.'); if (typeof html2pdf === 'undefined') return window.printPerformanceCertificate(centerKey); var clone = el.cloneNode(true); clone.querySelectorAll('.tab-action-buttons, .no-print, button').forEach(function (x) { x.remove(); }); html2pdf().set({ margin: 0.35, filename: 'performance_' + centerKey + '.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' } }).from(clone).save(); };
  window.exportPerformanceToExcel = function (centerKey) { if (typeof XLSX === 'undefined') return alert('مكتبة Excel غير متوفرة.'); var n = namesSafe(); var items = window.getPerformanceItems(centerKey); var scores = window.getPerformanceData()[centerKey] || {}; var aoa = [['م', 'أنشطة القسم', 'الدرجة القصوى', 'التقدير']]; var maxTotal = 0, scoreTotal = 0; items.forEach(function (item, i) { var max = parseInt(item.max, 10) || 0; var score = scores[i] !== undefined ? Number(scores[i]) || 0 : max; maxTotal += max; scoreTotal += score; aoa.push([i + 1, item.text, max, score]); }); aoa.push(['', 'المجموع', maxTotal, scoreTotal]); var wb = XLSX.utils.book_new(); var ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = [{ wch: 6 }, { wch: 80 }, { wch: 15 }, { wch: 12 }]; XLSX.utils.book_append_sheet(wb, ws, 'تقييم الأداء'); XLSX.writeFile(wb, 'تقييم-الأداء-' + String(n[centerKey] || centerKey).replace(/[\\/:*?"<>|]/g, '-') + '.xlsx'); };

  window.calculateAndDisplayGrandTotal = function () {
    var allData = dataSafe();
    var p = periodSafe();
    var totalDays = p.totalDaysInMonth || 30;
    var days = p.daysInExtract || 30;
    var contract = readJson('persistentContractData', {});
    var ratio = parseFloat(contract.directPurchaseRatio) || 0;
    var perfDeductions = readJson('adminOfficesPerformanceDeductions_v1', readJson('performanceDeductions', {}));
    var count = 0, costTotal = 0, deductionTotal = 0, finesTotal = 0, netTotal = 0;
    Object.keys(allData).forEach(function (centerKey) {
      var centerRows = allData[centerKey] || [];
      count += centerRows.length;
      var centerCost = 0, centerAbsDed = 0, centerFines = 0;
      centerRows.forEach(function (emp) {
        var salary = parseFloat(emp.salary) || 0;
        var daily = totalDays > 0 ? salary / totalDays : 0;
        var cost = daily * days;
        if (contract.contractType === 'شراء مباشر' && ratio > 0) cost += cost * ratio / 100;
        var absenceDays = (Array.isArray(emp.days) ? emp.days : []).filter(function (d) { return d === 'غ'; }).length;
        var cfg = fineCfg(emp.category);
        var isSaudi = String(emp.nationality || '').indexOf('سعودي') !== -1;
        var absenceFine = absenceDays * (isSaudi ? cfg.saudi : cfg.non_saudi);
        var natFine = parseFloat(emp.nationalityFine) || 0;
        var absDed = absenceDays * daily;
        centerCost += cost; centerAbsDed += absDed; centerFines += absenceFine + natFine;
      });
      var perfDed = parseFloat(perfDeductions[centerKey]) || 0;
      costTotal += centerCost; deductionTotal += centerAbsDed + perfDed; finesTotal += centerFines; netTotal += centerCost - centerAbsDed - perfDed - centerFines;
    });
    var el; if ((el = document.getElementById('grand-total-count'))) el.textContent = count; if ((el = document.getElementById('grand-total-cost'))) el.textContent = money(costTotal); if ((el = document.getElementById('grand-total-deduction'))) el.textContent = money(deductionTotal); if ((el = document.getElementById('grand-total-fines'))) el.textContent = money(finesTotal); if ((el = document.getElementById('grand-net-total'))) el.textContent = money(netTotal); localStorage.setItem('grand-net-total-admin', money(netTotal));
  };

  function buildAttendancePage(centerKey) {
    var n = namesSafe();
    var allData = dataSafe();
    var centerName = n[centerKey] || centerKey;
    var rowsData = allData[centerKey] || [];
    var p = periodSafe();
    var extract = readJson('persistentExtractData', {});
    var contract = readJson('persistentContractData', {});
    var startDate = p.startDate ? new Date(p.startDate) : new Date(extract.extractStart || Date.now());
    var days = p.daysInExtract || 30;
    var totalDays = p.totalDaysInMonth || 30;
    var ratio = parseFloat(contract.directPurchaseRatio) || 0;
    var companyName = contract.companyName || document.querySelector('.companyName')?.textContent || 'الشركة';
    var dayHeaders = '';
    for (var i = 0; i < days; i++) { var d = new Date(startDate); d.setDate(startDate.getDate() + i); dayHeaders += '<th class="day-cell">' + d.getDate() + '</th>'; }
    var totalCost = 0, totalDed = 0, totalFine = 0, totalNet = 0;
    var body = rowsData.length ? rowsData.map(function (emp, idx) {
      var empDays = Array.isArray(emp.days) ? emp.days.slice(0, days) : [];
      while (empDays.length < days) empDays.push('ح');
      var salary = parseFloat(emp.salary) || 0;
      var daily = totalDays > 0 ? salary / totalDays : 0;
      var cost = daily * days;
      if (contract.contractType === 'شراء مباشر' && ratio > 0) cost += cost * ratio / 100;
      var attendance = 0, absence = 0;
      empDays.forEach(function (x) { statusMeta(x).isAbsence ? absence++ : attendance++; });
      var cfg = fineCfg(emp.category);
      var isSaudi = String(emp.nationality || '').indexOf('سعودي') !== -1;
      var deduction = absence * daily;
      var absenceFine = absence * (isSaudi ? cfg.saudi : cfg.non_saudi);
      var natFine = parseFloat(emp.nationalityFine) || 0;
      var net = cost - deduction - absenceFine - natFine;
      totalCost += cost; totalDed += deduction; totalFine += absenceFine + natFine; totalNet += net;
      return '<tr><td>' + (idx + 1) + '</td><td class="job-title">' + esc(emp.jobTitle) + '</td><td class="category-cell">' + esc(emp.category) + '</td><td class="employee-name">' + esc(emp.name) + '</td>' + empDays.map(function (x) { return '<td class="day-cell ' + (x === 'غ' ? 'absent' : 'present') + '">' + esc(x) + '</td>'; }).join('') + '<td>' + money(cost) + '</td><td>' + attendance + '</td><td>' + absence + '</td><td>' + money(deduction) + '</td><td>' + money(absenceFine) + '</td><td>' + money(net) + '</td><td class="nationality-cell">' + esc(emp.nationality) + '</td><td>' + money(natFine) + '</td><td>' + esc(emp.iqamaId) + '</td></tr>';
    }).join('') : '<tr><td colspan="' + (14 + days) + '">لا يوجد موظفون في هذا المكتب/المرفق.</td></tr>';
    var ch = getHeaderForOffice(centerKey);
    var sigHtml = '';
    try {
      var sigs = typeof getSignatures === 'function' ? (getSignatures('attendance_' + centerKey) || getSignatures('attendance') || []) : [];
      sigHtml = sigs.length ? '<div class="signatures-block"><div class="signatures-title">التواقيع</div><div class="signatures-grid">' + sigs.map(function (s) { return '<div class="signature-item"><div class="signature-role">' + esc(s.title || '') + '</div><div class="signature-line"></div><div class="signature-name">' + esc(s.name || '') + '</div></div>'; }).join('') + '</div></div>' : '';
    } catch (e) {}
    return '<section class="print-page"><div class="header-info"><img src="' + ch.logoSrc + '" class="logo-right"><img src="' + ch.logoSrc + '" class="logo-left"><div class="header-lines"><h1>' + esc(ch.h1) + '</h1><h2>مستخلص العمالة للمكاتب الإدارية والمرافق الصحية</h2><h3>' + esc(ch.h3) + '</h3></div><div class="info-block"><span><b>المكتب/المرفق:</b> ' + esc(centerName) + '</span> | <span><b>اسم الشركة:</b> ' + esc(companyName) + '</span> | <span><b>مدة المستخلص:</b> من ' + esc(formatDate(extract.extractStart)) + ' إلى ' + esc(formatDate(extract.extractEnd)) + '</span></div><div class="extract-title">بيان بالحضور والغياب للمكتب/المرفق: ' + esc(centerName) + '</div></div><div class="department-title">' + esc(centerName) + '</div><div class="summary-block">عدد الموظفين: ' + rowsData.length + ' | التكلفة: ' + money(totalCost) + ' | الحسم: ' + money(totalDed) + ' | الغرامات: ' + money(totalFine) + ' | الصافي: ' + money(totalNet) + '</div><table><thead><tr><th rowspan="2">م</th><th rowspan="2">مسمى الوظيفة</th><th rowspan="2">الفئة</th><th rowspan="2">اسم شاغل الوظيفة</th><th colspan="' + days + '">الأيام</th><th rowspan="2">التكلفة للفترة</th><th colspan="2">عدد الأيام</th><th colspan="2">حسم وغرامة الغياب</th><th rowspan="2">صافي الاستحقاق</th><th rowspan="2">الجنسية</th><th rowspan="2">غرامة جنسية</th><th rowspan="2">رقم الإقامة/الهوية</th></tr><tr>' + dayHeaders + '<th>حضور</th><th>غياب</th><th>الحسم</th><th>غرامة الغياب</th></tr></thead><tbody>' + body + '</tbody></table>' + sigHtml + '</section>';
  }

  function buildPrintCss() {
    return '<style>@page{size:A4 landscape;margin:6mm}body{font-family:Tajawal,Arial,sans-serif;direction:rtl;margin:0;color:#000;background:#fff}.print-page{page-break-after:always}.print-page:last-child{page-break-after:auto}.header-info{text-align:center;margin-bottom:20px;position:relative}.logo-right{position:absolute;right:10px;top:10px;width:65px}.logo-left{position:absolute;left:10px;top:10px;width:65px}.header-lines{display:inline-block;margin:0 auto}.header-lines h1{font-size:20px;color:#003087;margin-bottom:5px;font-weight:bold}.header-lines h2{font-size:16px;color:#222;margin:0;font-weight:bold}.header-lines h3{font-size:14px;color:#444;margin:0 0 10px 0;font-weight:bold}.info-block{font-size:14px;margin:10px auto;text-align:center;max-width:90%}.info-block span{display:inline-block;min-width:100px;margin:5px;font-weight:bold}.extract-title{font-size:18px;font-weight:bold;text-align:center;margin:10px auto;color:#0d47a1}table{width:100%;border-collapse:collapse;font-size:12px;direction:rtl;margin-bottom:20px;table-layout:auto}th,td{border:1px solid #333;padding:4px 6px;text-align:center;white-space:nowrap}th{background:#003087!important;color:#fff!important}.job-title,.employee-name{font-size:11px;max-width:105px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.category-cell{font-size:12px;width:36px}.nationality-cell{font-size:11px;max-width:60px}.day-cell{font-size:12px;min-width:18px;max-width:24px}.present{color:#0072ff;font-weight:bold}.absent{color:#ff1744;font-weight:bold}.department-title{text-align:right;font-size:22px;color:#002060;font-weight:bold;margin:20px 0 12px 0;letter-spacing:1px}.summary-block{font-size:18px;text-align:right;margin:10px 0 14px 8px;color:#1565c0;font-weight:bold;background:#e3f2fd;border-radius:5px;padding:6px 10px}.signatures-block{margin-top:20px;page-break-inside:avoid}.signatures-title{text-align:center;font-size:16px;font-weight:bold;color:#003087;margin-bottom:10px}.signatures-grid{display:flex;justify-content:space-around;gap:8px}.signature-item{min-width:160px;text-align:center;margin:8px}.signature-line{border-bottom:2px solid #222;height:38px;margin:8px 0 4px}.signature-role{font-size:13px;font-weight:bold;color:#222}.signature-name{font-size:11px;color:#888}@media print{body{zoom:50%}table,tr,td,th{page-break-inside:avoid!important}}</style>';
  }

  window.printSelected = function () {
    var selected = Array.from(document.querySelectorAll('#print-centers-checkboxes input:checked')).map(function (x) { return x.value; });
    var attendance = document.getElementById('print-opt-attendance')?.checked !== false;
    if (!selected.length) return alert('الرجاء اختيار مكتب/مرفق واحد على الأقل للطباعة.');
    var pages = [];
    if (attendance) selected.forEach(function (key) { pages.push(buildAttendancePage(key)); });
    if (!pages.length) return alert('اختر طباعة جدول الحضور.');
    var win = window.open('', '', 'width=1200,height=900');
    var doc = win.document;
    doc.open();
    doc.write('<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>طباعة حضور المكاتب</title><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">' + buildPrintCss() + '</head><body>' + pages.join('') + '</body></html>');
    doc.close();
    setTimeout(function () { win.focus(); win.print(); }, 500);
  };

  function closeAdminPrintDialog() { var d = document.getElementById('admin-office-print-dialog'); var o = document.getElementById('admin-office-print-overlay'); if (d) d.remove(); if (o) o.remove(); }
  window.closeAdminPrintDialog = closeAdminPrintDialog;
  window.toggleAllAdminOfficePrint = function (checked) { document.querySelectorAll('.admin-office-print-center').forEach(function (cb) { cb.checked = checked; }); };
  window.openPrintDialog = function () {
    closeAdminPrintDialog();
    var n = namesSafe();
    var opts = orderedKeys().map(function (key) { return '<label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer"><input type="checkbox" class="admin-office-print-center" value="' + esc(key) + '" checked><span>' + esc(n[key] || key) + '</span></label>'; }).join('');
    var overlay = document.createElement('div'); overlay.id = 'admin-office-print-overlay'; overlay.className = 'overlay'; overlay.onclick = closeAdminPrintDialog;
    var dlg = document.createElement('div'); dlg.id = 'admin-office-print-dialog'; dlg.className = 'dialog'; dlg.style.display = 'block';
    dlg.innerHTML = '<div class="dialog-content"><span class="close" onclick="closeAdminPrintDialog()">×</span><h3><i class="fas fa-print"></i> طباعة المكاتب والمرافق</h3><label style="display:flex;gap:8px;font-weight:700"><input type="checkbox" checked onchange="toggleAllAdminOfficePrint(this.checked)"> تحديد جميع المكاتب والمرافق</label><div style="border:1px solid #e5e7eb;border-radius:10px;padding:10px;max-height:260px;overflow-y:auto;background:#f8fafc;margin-top:10px">' + opts + '</div><div style="margin-top:14px;border-top:1px solid #e5e7eb;padding-top:12px"><label style="display:flex;gap:8px"><input type="checkbox" id="admin-office-print-opt-attendance" checked> طباعة جدول الحضور</label></div><div class="buttons" style="margin-top:18px"><button class="btn btn-success" onclick="printSelectedAdminOfficeReports()"><i class="fas fa-print"></i> طباعة</button><button class="btn btn-secondary" onclick="closeAdminPrintDialog()">إلغاء</button></div></div>';
    document.body.appendChild(overlay); document.body.appendChild(dlg); overlay.style.display = 'block';
  };
  window.printSelectedAdminOfficeReports = function () {
    var selected = Array.from(document.querySelectorAll('.admin-office-print-center:checked')).map(function (cb) { return cb.value; });
    if (!selected.length) return alert('الرجاء اختيار مكتب/مرفق واحد على الأقل.');
    var host = document.createElement('div'); host.id = 'print-centers-checkboxes'; host.style.display = 'none'; host.innerHTML = selected.map(function (key) { return '<input type="checkbox" value="' + esc(key) + '" checked>'; }).join(''); document.body.appendChild(host);
    var opt = document.createElement('input'); opt.type = 'checkbox'; opt.id = 'print-opt-attendance'; opt.checked = true; opt.style.display = 'none'; document.body.appendChild(opt);
    closeAdminPrintDialog();
    try { window.printSelected(); } finally { setTimeout(function () { host.remove(); opt.remove(); }, 1000); }
  };

  document.addEventListener('DOMContentLoaded', function () { setTimeout(function () { if (typeof window.calculateAndDisplayGrandTotal === 'function') window.calculateAndDisplayGrandTotal(); }, 500); });
})();
