// ===================================================================
// Admin Offices Full Excel Visibility Guard — V1
// Scope: admin_offices_attendance.html
// يمنع ظهور "استيراد ملف شامل لكل الأقسام" في أي شاشة غير شاشة Excel فقط.
// لا يغير منطق الاستيراد. ينظف الظهور الخاطئ فقط.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_FULL_EXCEL_VISIBILITY_GUARD_V1__) return;
  window.__ADMIN_OFFICES_FULL_EXCEL_VISIBILITY_GUARD_V1__ = true;

  function clean(v) {
    return String(v || '').replace(/\s+/g, ' ').trim();
  }

  function isExcelImportDialog() {
    var dlg = document.getElementById('management-dialog');
    if (!dlg) return false;
    var title = clean(dlg.querySelector('.dialog-header h3, h3') && dlg.querySelector('.dialog-header h3, h3').textContent);
    var bodyText = clean(dlg.querySelector('.dialog-body') && dlg.querySelector('.dialog-body').textContent);
    return (
      title.indexOf('استيراد بيانات من Excel') > -1 ||
      title.indexOf('استيراد Excel') > -1 ||
      bodyText.indexOf('تامبليت الوظائف') > -1 ||
      bodyText.indexOf('استيراد التامبليت بعد التعبئة') > -1 ||
      !!dlg.querySelector('input[type="file"][accept*=".xlsx"], input[type="file"][accept*=".xls"]') && bodyText.indexOf('استيراد Excel عادي') > -1
    );
  }

  function removeFromNonExcelDialogs() {
    var section = document.getElementById('admin-offices-full-excel-section');
    if (!section) return;
    if (isExcelImportDialog()) return;
    section.remove();
  }

  function wrapPublicInject() {
    var api = window.AdminOfficesFullExcelImport;
    if (!api || typeof api.inject !== 'function' || api.inject.__excelOnlyWrapped) return false;
    var old = api.inject;
    api.inject = function excelOnlyInject() {
      if (!isExcelImportDialog()) {
        removeFromNonExcelDialogs();
        return false;
      }
      return old.apply(this, arguments);
    };
    api.inject.__excelOnlyWrapped = true;
    return true;
  }

  function guard() {
    wrapPublicInject();
    removeFromNonExcelDialogs();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', guard);
  else guard();

  document.addEventListener('click', function () {
    setTimeout(guard, 20);
    setTimeout(guard, 90);
    setTimeout(guard, 170);
    setTimeout(guard, 360);
    setTimeout(guard, 800);
  }, true);

  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    guard();
    if (tries > 80 && wrapPublicInject()) clearInterval(timer);
  }, 150);

  window.AdminOfficesFullExcelVisibilityGuard = { clean: guard, isExcelImportDialog: isExcelImportDialog };
  console.info('[Admin Offices Full Excel Visibility Guard] installed v1');
})();