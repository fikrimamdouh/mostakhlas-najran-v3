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
