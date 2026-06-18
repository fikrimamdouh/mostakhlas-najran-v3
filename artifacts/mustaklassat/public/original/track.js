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

  // Report page visit on load
  reportActivity();

  // Re-report every 3 minutes to keep "online" status alive
  setInterval(function () { reportActivity(); }, 3 * 60 * 1000);

  // Global function for other scripts to report special events (e.g. backup)
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

  // Hook into backup download button (capture phase — fires before page handler)
  document.addEventListener("DOMContentLoaded", function () {
    document.addEventListener("click", function (e) {
      var btn = e.target && (
        e.target.id === "download-backup-btn" ||
        (e.target.closest && e.target.closest("#download-backup-btn"))
      );
      if (btn) {
        window.najranTrackEvent("💾 نسخة احتياطية", "تم تنزيل نسخة احتياطية — " + pageName);
      }

      // Also hook into "upload backup" confirmation
      var uploadLabel = e.target && e.target.htmlFor === "backup-file-input";
      if (uploadLabel) {
        window.najranTrackEvent("📤 استعادة نسخة", "تم رفع نسخة احتياطية — " + pageName);
      }
    }, true);

    // Hook into the save toast (catches any internal save)
    var origSetItem = localStorage.setItem.bind(localStorage);
    var saveDebounce;
    localStorage.setItem = function (key, value) {
      origSetItem(key, value);
      // Report save activity when core data keys change
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
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function getNamesSafe() {
    try {
      if (typeof getCenterNames === "function") return getCenterNames() || {};
    } catch (e) {}
    return readJson("adminOfficeNames_v1", {});
  }

  function orderedCenterKeys() {
    var names = getNamesSafe();
    return Object.keys(names).sort(function (a, b) {
      if (a.indexOf("center_") === 0 && b.indexOf("center_") === 0) {
        return parseInt(a.split("_")[1], 10) - parseInt(b.split("_")[1], 10);
      }
      if (a.indexOf("center_") === 0) return -1;
      if (b.indexOf("center_") === 0) return 1;
      return a.localeCompare(b);
    });
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function closeAdminPrintDialog() {
    var dialog = document.getElementById("admin-office-print-dialog");
    var overlay = document.getElementById("admin-office-print-overlay");
    if (dialog) dialog.remove();
    if (overlay) overlay.remove();
  }

  function toggleAllAdminOfficePrint(checked) {
    document.querySelectorAll(".admin-office-print-center").forEach(function (checkbox) {
      checkbox.checked = checked;
    });
  }

  window.closeAdminPrintDialog = closeAdminPrintDialog;
  window.toggleAllAdminOfficePrint = toggleAllAdminOfficePrint;

  window.openPrintDialog = function openAdminOfficePrintDialog() {
    closeAdminPrintDialog();

    var names = getNamesSafe();
    var keys = orderedCenterKeys();
    if (!keys.length) {
      alert("لا توجد مكاتب/مرافق للطباعة.");
      return;
    }

    var centerOptions = keys.map(function (key) {
      return [
        '<label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;">',
        '<input type="checkbox" class="admin-office-print-center" value="' + escapeHtml(key) + '" checked>',
        '<span>' + escapeHtml(names[key] || key) + '</span>',
        '</label>'
      ].join("");
    }).join("");

    var overlay = document.createElement("div");
    overlay.id = "admin-office-print-overlay";
    overlay.className = "overlay";
    overlay.onclick = closeAdminPrintDialog;

    var dialog = document.createElement("div");
    dialog.id = "admin-office-print-dialog";
    dialog.className = "dialog";
    dialog.style.display = "block";
    dialog.innerHTML = [
      '<div class="dialog-content">',
      '<span class="close" onclick="closeAdminPrintDialog()">×</span>',
      '<h3><i class="fas fa-print"></i> طباعة المكاتب والمرافق</h3>',
      '<div class="form-group">',
      '<label style="display:flex;align-items:center;gap:8px;font-weight:700;cursor:pointer;">',
      '<input type="checkbox" id="admin-office-select-all-print" checked onchange="toggleAllAdminOfficePrint(this.checked)">',
      '<span>تحديد جميع المكاتب والمرافق</span>',
      '</label>',
      '</div>',
      '<div style="border:1px solid #e5e7eb;border-radius:10px;padding:10px;max-height:260px;overflow-y:auto;background:#f8fafc;">',
      centerOptions,
      '</div>',
      '<div style="margin-top:14px;border-top:1px solid #e5e7eb;padding-top:12px;">',
      '<label style="display:flex;align-items:center;gap:8px;margin-bottom:6px;cursor:pointer;"><input type="checkbox" id="admin-office-print-opt-attendance" checked> طباعة جدول الحضور</label>',
      '<label style="display:flex;align-items:center;gap:8px;margin-bottom:6px;cursor:pointer;"><input type="checkbox" id="admin-office-print-opt-performance"> طباعة تقييم الأداء</label>',
      '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" id="admin-office-print-opt-achievement"> طباعة شهادة الإنجاز</label>',
      '</div>',
      '<div class="buttons" style="margin-top:18px;">',
      '<button class="btn btn-success" onclick="printSelectedAdminOfficeReports()"><i class="fas fa-print"></i> طباعة</button>',
      '<button class="btn btn-secondary" onclick="closeAdminPrintDialog()"><i class="fas fa-times-circle"></i> إلغاء</button>',
      '</div>',
      '</div>'
    ].join("");

    document.body.appendChild(overlay);
    document.body.appendChild(dialog);
    overlay.style.display = "block";
  };

  window.printSelectedAdminOfficeReports = function printSelectedAdminOfficeReports() {
    var selectedKeys = Array.from(document.querySelectorAll(".admin-office-print-center:checked")).map(function (cb) {
      return cb.value;
    });

    var attendance = !!(document.getElementById("admin-office-print-opt-attendance") && document.getElementById("admin-office-print-opt-attendance").checked);
    var performance = !!(document.getElementById("admin-office-print-opt-performance") && document.getElementById("admin-office-print-opt-performance").checked);
    var achievement = !!(document.getElementById("admin-office-print-opt-achievement") && document.getElementById("admin-office-print-opt-achievement").checked);

    if (!selectedKeys.length) {
      alert("الرجاء اختيار مكتب/مرفق واحد على الأقل.");
      return;
    }
    if (!attendance && !performance && !achievement) {
      alert("الرجاء اختيار نوع تقرير واحد على الأقل.");
      return;
    }

    var host = document.createElement("div");
    host.id = "print-centers-checkboxes";
    host.style.display = "none";
    host.innerHTML = selectedKeys.map(function (key) {
      return '<input type="checkbox" value="' + escapeHtml(key) + '" checked>';
    }).join("");
    document.body.appendChild(host);

    var oldAttendance = document.getElementById("print-opt-attendance");
    var oldPerformance = document.getElementById("print-opt-performance");
    var oldAchievement = document.getElementById("print-opt-achievement");
    var created = [];

    function ensureOption(id, checked) {
      var el = document.getElementById(id);
      if (!el) {
        el = document.createElement("input");
        el.type = "checkbox";
        el.id = id;
        el.style.display = "none";
        document.body.appendChild(el);
        created.push(el);
      }
      el.checked = checked;
      return el;
    }

    ensureOption("print-opt-attendance", attendance);
    ensureOption("print-opt-performance", performance);
    ensureOption("print-opt-achievement", achievement);

    closeAdminPrintDialog();

    try {
      if (typeof window.printSelected === "function") {
        window.printSelected();
      } else if (attendance && selectedKeys.length === 1 && typeof window.preparePrint === "function") {
        var activeTab = document.querySelector(".tab-link.active");
        if (activeTab) activeTab.dataset.centerKey = selectedKeys[0];
        window.preparePrint();
      } else {
        alert("نظام الطباعة لم يكتمل تحميله. أعد تحميل الصفحة ثم اطبع.");
      }
    } finally {
      setTimeout(function () {
        host.remove();
        created.forEach(function (el) { el.remove(); });
        if (oldAttendance) oldAttendance.checked = attendance;
        if (oldPerformance) oldPerformance.checked = performance;
        if (oldAchievement) oldAchievement.checked = achievement;
      }, 1200);
    }
  };
})();
