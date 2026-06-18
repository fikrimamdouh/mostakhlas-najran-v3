// Page activity tracker for original HTML modules
// Reads session from localStorage and notifies the API silently
(function () {
  var PAGE_NAMES = {
    "settings_main.html":             "الإعدادات الرئيسية",
    "settings_advanced.html":         "الإعدادات المتقدمة",
    "attendance.html":                "الحضور والانصراف",
    "performance.html":               "جداول الأداء",
    "achievement.html":               "شهادة الإنجاز",
    "consumables.html":               "مستخلص المستهلكات",
    "spare_parts.html":               "مستخلص قطع الغيار",
    "approval.html":                  "اعتماد المستخلص",
    "health_centers.html":            "المراكز الصحية",
    "health_centers_attendance.html": "حضور المراكز الصحية",
    "health_centers_consumables.html":"مستهلكات المراكز الصحية",
    "review_extract.html":            "مراجعة المستخلص",
    "extract-archive.html":           "أرشيف المستخلصات",
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
    var body = Object.assign({ page: pageName }, extraFields || {});
    fetch("/api/users/me/activity", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + session.clerkToken,
      },
      body: JSON.stringify(body),
    }).catch(function () {});
  }

  reportActivity();
  setInterval(function () { reportActivity(); }, 3 * 60 * 1000);

  window.najranTrackEvent = function (eventType, details) {
    var session = getSession();
    if (!session) return;
    fetch("/api/users/me/activity", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + session.clerkToken,
      },
      body: JSON.stringify({ page: pageName, event: eventType, details: details }),
    }).catch(function () {});
  };

  document.addEventListener("DOMContentLoaded", function () {
    document.addEventListener("click", function (e) {
      var btn = e.target && (
        e.target.id === "download-backup-btn" ||
        (e.target.closest && e.target.closest("#download-backup-btn"))
      );
      if (btn) window.najranTrackEvent("💾 نسخة احتياطية", "تم تنزيل نسخة احتياطية — " + pageName);

      var uploadLabel = e.target && e.target.htmlFor === "backup-file-input";
      if (uploadLabel) window.najranTrackEvent("📤 استعادة نسخة", "تم رفع نسخة احتياطية — " + pageName);
    }, true);

    var origSetItem = localStorage.setItem.bind(localStorage);
    var saveDebounce;
    localStorage.setItem = function (key, value) {
      origSetItem(key, value);
      if (key && (key.includes("_data_") || key.includes("AttendanceData"))) {
        clearTimeout(saveDebounce);
        saveDebounce = setTimeout(function () {
          reportActivity({ event: "💾 حفظ بيانات", details: "تم حفظ بيانات — " + pageName });
        }, 5000);
      }
    };
  }, { once: true });
})();

// Admin offices print entry point
// Mirrors normal attendance print flow: dialog -> selected tables -> clean print window.
(function () {
  var filename = window.location.pathname.split("/").pop();
  if (filename !== "admin_offices_attendance.html") return;

  function readJson(key, fallback) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch (e) { return fallback; }
  }
  function getNamesSafe() {
    try { if (typeof getCenterNames === "function") return getCenterNames() || {}; } catch (e) {}
    return readJson("adminOfficeNames_v1", {});
  }
  function orderedCenterKeys() {
    var names = getNamesSafe();
    return Object.keys(names).sort(function (a, b) {
      if (a.indexOf("center_") === 0 && b.indexOf("center_") === 0) return parseInt(a.split("_")[1], 10) - parseInt(b.split("_")[1], 10);
      if (a.indexOf("center_") === 0) return -1;
      if (b.indexOf("center_") === 0) return 1;
      return a.localeCompare(b);
    });
  }
  function escapeHtml(value) {
    return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function closeAdminPrintDialog() {
    var dialog = document.getElementById("admin-office-print-dialog");
    var overlay = document.getElementById("admin-office-print-overlay");
    if (dialog) dialog.remove();
    if (overlay) overlay.remove();
  }
  function toggleAllAdminOfficePrint(checked) {
    document.querySelectorAll(".admin-office-print-center").forEach(function (checkbox) { checkbox.checked = checked; });
  }
  window.closeAdminPrintDialog = closeAdminPrintDialog;
  window.toggleAllAdminOfficePrint = toggleAllAdminOfficePrint;

  window.openPrintDialog = function openAdminOfficePrintDialog() {
    closeAdminPrintDialog();
    var names = getNamesSafe();
    var keys = orderedCenterKeys();
    if (!keys.length) return alert("لا توجد مكاتب/مرافق للطباعة.");
    var centerOptions = keys.map(function (key) {
      return '<label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;"><input type="checkbox" class="admin-office-print-center" value="' + escapeHtml(key) + '" checked><span>' + escapeHtml(names[key] || key) + '</span></label>';
    }).join("");
    var overlay = document.createElement("div");
    overlay.id = "admin-office-print-overlay";
    overlay.className = "overlay";
    overlay.onclick = closeAdminPrintDialog;
    var dialog = document.createElement("div");
    dialog.id = "admin-office-print-dialog";
    dialog.className = "dialog";
    dialog.style.display = "block";
    dialog.innerHTML = '<div class="dialog-content"><span class="close" onclick="closeAdminPrintDialog()">×</span><h3><i class="fas fa-print"></i> طباعة المكاتب والمرافق</h3><div class="form-group"><label style="display:flex;align-items:center;gap:8px;font-weight:700;cursor:pointer;"><input type="checkbox" id="admin-office-select-all-print" checked onchange="toggleAllAdminOfficePrint(this.checked)"><span>تحديد جميع المكاتب والمرافق</span></label></div><div style="border:1px solid #e5e7eb;border-radius:10px;padding:10px;max-height:260px;overflow-y:auto;background:#f8fafc;">' + centerOptions + '</div><div style="margin-top:14px;border-top:1px solid #e5e7eb;padding-top:12px;"><label style="display:flex;align-items:center;gap:8px;margin-bottom:6px;cursor:pointer;"><input type="checkbox" id="admin-office-print-opt-attendance" checked> طباعة جدول الحضور</label><label style="display:flex;align-items:center;gap:8px;margin-bottom:6px;cursor:pointer;"><input type="checkbox" id="admin-office-print-opt-performance"> طباعة تقييم الأداء</label><label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" id="admin-office-print-opt-achievement"> طباعة شهادة الإنجاز</label></div><div class="buttons" style="margin-top:18px;"><button class="btn btn-success" onclick="printSelectedAdminOfficeReports()"><i class="fas fa-print"></i> طباعة</button><button class="btn btn-secondary" onclick="closeAdminPrintDialog()"><i class="fas fa-times-circle"></i> إلغاء</button></div></div>';
    document.body.appendChild(overlay);
    document.body.appendChild(dialog);
    overlay.style.display = "block";
  };

  window.printSelectedAdminOfficeReports = function printSelectedAdminOfficeReports() {
    var selectedKeys = Array.from(document.querySelectorAll(".admin-office-print-center:checked")).map(function (cb) { return cb.value; });
    var attendance = !!(document.getElementById("admin-office-print-opt-attendance") && document.getElementById("admin-office-print-opt-attendance").checked);
    var performance = !!(document.getElementById("admin-office-print-opt-performance") && document.getElementById("admin-office-print-opt-performance").checked);
    var achievement = !!(document.getElementById("admin-office-print-opt-achievement") && document.getElementById("admin-office-print-opt-achievement").checked);
    if (!selectedKeys.length) return alert("الرجاء اختيار مكتب/مرفق واحد على الأقل.");
    if (!attendance && !performance && !achievement) return alert("الرجاء اختيار نوع تقرير واحد على الأقل.");
    var host = document.createElement("div");
    host.id = "print-centers-checkboxes";
    host.style.display = "none";
    host.innerHTML = selectedKeys.map(function (key) { return '<input type="checkbox" value="' + escapeHtml(key) + '" checked>'; }).join("");
    document.body.appendChild(host);
    var created = [];
    function ensureOption(id, checked) {
      var el = document.getElementById(id);
      if (!el) { el = document.createElement("input"); el.type = "checkbox"; el.id = id; el.style.display = "none"; document.body.appendChild(el); created.push(el); }
      el.checked = checked;
    }
    ensureOption("print-opt-attendance", attendance);
    ensureOption("print-opt-performance", performance);
    ensureOption("print-opt-achievement", achievement);
    closeAdminPrintDialog();
    try {
      if (typeof window.printSelected === "function") window.printSelected();
      else if (attendance && selectedKeys.length === 1 && typeof window.preparePrint === "function") {
        var activeTab = document.querySelector(".tab-link.active");
        if (activeTab) activeTab.dataset.centerKey = selectedKeys[0];
        window.preparePrint();
      } else alert("نظام الطباعة لم يكتمل تحميله. أعد تحميل الصفحة ثم اطبع.");
    } finally {
      setTimeout(function () { host.remove(); created.forEach(function (el) { el.remove(); }); }, 1200);
    }
  };
})();

// Admin offices performance behavior
// Same feature set as normal health-center performance, with independent office keys and totals.
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

  function readJson(key, fallback) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; }
  }
  function writeJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function cloneDefaultItems() { return JSON.parse(JSON.stringify(DEFAULT_ADMIN_PERFORMANCE_ITEMS)); }
  function money(n) { return (Number(n) || 0).toFixed(2); }
  function periodSafe() {
    try { if (typeof getExtractPeriodDetails === "function") return getExtractPeriodDetails(); } catch (e) {}
    return { daysInExtract: 30, totalDaysInMonth: 30 };
  }

  window.getPerformanceItems = function getAdminOfficePerformanceItems(centerKey) {
    var key = 'adminOfficePerformanceItems_' + (centerKey || 'general') + '_v1';
    var items = readJson(key, null);
    return Array.isArray(items) && items.length ? items : cloneDefaultItems();
  };

  window.savePerformanceItems = function saveAdminOfficePerformanceItems(centerKey, items) {
    var key = 'adminOfficePerformanceItems_' + (centerKey || 'general') + '_v1';
    writeJson(key, Array.isArray(items) ? items : cloneDefaultItems());
  };

  window.getPerformanceData = function getAdminOfficePerformanceData() {
    return readJson('adminOfficesPerformanceData_v1', {});
  };

  window.savePerformanceData = function saveAdminOfficePerformanceData(data) {
    writeJson('adminOfficesPerformanceData_v1', data || {});
  };

  window.calculateCenterTotalCost = function calculateAdminOfficeCenterTotalCost(centerKey) {
    var allData = (typeof getAttendanceData === 'function' ? getAttendanceData() : readJson('adminOfficesAttendanceData_v1', {})) || {};
    var centerData = allData[centerKey] || [];
    var p = periodSafe();
    var totalDays = p.totalDaysInMonth || 30;
    var days = p.daysInExtract || 30;
    var contract = readJson('persistentContractData', {});
    var directRatio = parseFloat(contract.directPurchaseRatio) || 0;
    var direct = contract.contractType === 'شراء مباشر' && directRatio > 0;
    return centerData.reduce(function (sum, emp) {
      var salary = parseFloat(emp.salary) || 0;
      var cost = (totalDays > 0 ? salary / totalDays : 0) * days;
      if (direct) cost += cost * directRatio / 100;
      return sum + cost;
    }, 0);
  };

  window.calculatePerformanceSummary = function calculateAdminOfficePerformanceSummary(centerKey) {
    var data = window.getPerformanceData()[centerKey] || {};
    var items = window.getPerformanceItems(centerKey);
    var maxTotal = 0, scoreTotal = 0;
    items.forEach(function (item, index) {
      var max = parseInt(item.max, 10) || 0;
      maxTotal += max;
      scoreTotal += data[index] !== undefined ? Number(data[index]) || 0 : max;
    });
    var maxEl = document.getElementById('perf-max-total-' + centerKey);
    var scoreEl = document.getElementById('perf-score-total-' + centerKey);
    if (maxEl) maxEl.textContent = maxTotal;
    if (scoreEl) scoreEl.textContent = scoreTotal;
    var percentage = maxTotal > 0 ? (scoreTotal / maxTotal) * 100 : 100;
    var deductionPercentage = 0;
    if (percentage < 60) deductionPercentage = 15;
    else if (percentage < 65) deductionPercentage = 10;
    else if (percentage < 70) deductionPercentage = 8;
    else if (percentage < 75) deductionPercentage = 6;
    else if (percentage < 80) deductionPercentage = 4;
    else if (percentage < 85) deductionPercentage = 2;
    var centerCost = window.calculateCenterTotalCost(centerKey);
    var deductionAmount = centerCost * deductionPercentage / 100;
    var summary = document.getElementById('perf-summary-' + centerKey);
    if (summary) summary.innerHTML = '<p>إجمالي المبلغ لأنشطة القسم = <span>' + money(centerCost) + '</span> ريال</p><p>التقدير الذي حصل عليه المقاول : <span>' + percentage.toFixed(2) + '%</span></p><p>نسبة الحسم على المقاول لهذا القسم : <span>' + deductionPercentage + '%</span> ويساوي <span>' + money(deductionAmount) + '</span> ريال</p>';
    var deductions = readJson('adminOfficesPerformanceDeductions_v1', {});
    deductions[centerKey] = deductionAmount;
    writeJson('adminOfficesPerformanceDeductions_v1', deductions);
    var legacy = readJson('performanceDeductions', {});
    legacy[centerKey] = deductionAmount;
    writeJson('performanceDeductions', legacy);
    if (typeof window.calculateAndDisplayGrandTotal === 'function') setTimeout(window.calculateAndDisplayGrandTotal, 0);
  };

  window.resetPerformanceScores = function resetAdminOfficePerformanceScores(centerKey) {
    if (!confirm('هل تريد إعادة درجات تقييم الأداء لهذا المكتب/المرفق إلى الدرجة الكاملة؟')) return;
    var data = window.getPerformanceData();
    delete data[centerKey];
    window.savePerformanceData(data);
    var deductions = readJson('adminOfficesPerformanceDeductions_v1', {});
    delete deductions[centerKey];
    writeJson('adminOfficesPerformanceDeductions_v1', deductions);
    var legacy = readJson('performanceDeductions', {});
    delete legacy[centerKey];
    writeJson('performanceDeductions', legacy);
    if (typeof renderPerformanceTable === 'function') renderPerformanceTable(centerKey);
    if (typeof window.calculateAndDisplayGrandTotal === 'function') window.calculateAndDisplayGrandTotal();
  };

  window.exportPerformanceToPDF = function exportAdminOfficePerformanceToPDF(centerKey) {
    var el = document.getElementById('performance-certificate-' + centerKey);
    if (!el) return alert('افتح جدول الأداء أولاً.');
    if (typeof html2pdf === 'undefined') return window.printPerformanceCertificate(centerKey);
    var clone = el.cloneNode(true);
    clone.querySelectorAll('.tab-action-buttons, .no-print, button').forEach(function (x) { x.remove(); });
    html2pdf().set({ margin: 0.35, filename: 'performance_' + centerKey + '.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' } }).from(clone).save();
  };

  window.exportPerformanceToExcel = function exportAdminOfficePerformanceToExcel(centerKey) {
    if (typeof XLSX === 'undefined') return alert('مكتبة Excel غير متوفرة.');
    var names = (typeof getCenterNames === 'function' ? getCenterNames() : readJson('adminOfficeNames_v1', {})) || {};
    var items = window.getPerformanceItems(centerKey);
    var scores = window.getPerformanceData()[centerKey] || {};
    var aoa = [['م', 'أنشطة القسم', 'الدرجة القصوى', 'التقدير']];
    var maxTotal = 0, scoreTotal = 0;
    items.forEach(function (item, i) {
      var max = parseInt(item.max, 10) || 0;
      var score = scores[i] !== undefined ? Number(scores[i]) || 0 : max;
      maxTotal += max; scoreTotal += score;
      aoa.push([i + 1, item.text, max, score]);
    });
    aoa.push(['', 'المجموع', maxTotal, scoreTotal]);
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 6 }, { wch: 80 }, { wch: 15 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, 'تقييم الأداء');
    XLSX.writeFile(wb, 'تقييم-الأداء-' + String(names[centerKey] || centerKey).replace(/[\\/:*?"<>|]/g, '-') + '.xlsx');
  };

  window.calculateAndDisplayGrandTotal = function calculateAdminOfficesGrandTotalWithPerformance() {
    var allData = (typeof getAttendanceData === 'function' ? getAttendanceData() : readJson('adminOfficesAttendanceData_v1', {})) || {};
    var p = periodSafe();
    var totalDays = p.totalDaysInMonth || 30;
    var days = p.daysInExtract || 30;
    var contract = readJson('persistentContractData', {});
    var contractType = contract.contractType || 'عقد أساسي';
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
        if (contractType === 'شراء مباشر' && ratio > 0) cost += cost * ratio / 100;
        var absenceDays = (Array.isArray(emp.days) ? emp.days : []).filter(function (d) { return d === 'غ'; }).length;
        var fineConfig = (window.ABSENCE_FINES_BY_CATEGORY && window.ABSENCE_FINES_BY_CATEGORY[emp.category]) || { saudi: 0, non_saudi: 0 };
        var isSaudi = String(emp.nationality || '').indexOf('سعودي') !== -1;
        var absenceFine = absenceDays * (isSaudi ? fineConfig.saudi : fineConfig.non_saudi);
        var natFine = parseFloat(emp.nationalityFine) || 0;
        var absDed = absenceDays * daily;
        centerCost += cost;
        centerAbsDed += absDed;
        centerFines += absenceFine + natFine;
      });
      var perfDed = parseFloat(perfDeductions[centerKey]) || 0;
      costTotal += centerCost;
      deductionTotal += centerAbsDed + perfDed;
      finesTotal += centerFines;
      netTotal += centerCost - centerAbsDed - perfDed - centerFines;
    });
    var el;
    if ((el = document.getElementById('grand-total-count'))) el.textContent = count;
    if ((el = document.getElementById('grand-total-cost'))) el.textContent = money(costTotal);
    if ((el = document.getElementById('grand-total-deduction'))) el.textContent = money(deductionTotal);
    if ((el = document.getElementById('grand-total-fines'))) el.textContent = money(finesTotal);
    if ((el = document.getElementById('grand-net-total'))) el.textContent = money(netTotal);
    localStorage.setItem('grand-net-total-admin', money(netTotal));
  };

  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
      if (typeof window.calculateAndDisplayGrandTotal === 'function') window.calculateAndDisplayGrandTotal();
    }, 500);
  });
})();
