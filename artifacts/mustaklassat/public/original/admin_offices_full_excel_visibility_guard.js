// ===================================================================
// Admin Offices Full Excel Visibility Guard — V2
// Scope: admin_offices_attendance.html
// يمنع ظهور "استيراد ملف شامل لكل الأقسام" خارج نافذة Excel فقط.
// لا يغير منطق الاستيراد. ينظف الظهور الخاطئ فقط.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])|original-viewer\?page=admin_offices_attendance\.html/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_FULL_EXCEL_VISIBILITY_GUARD_V2__) return;
  window.__ADMIN_OFFICES_FULL_EXCEL_VISIBILITY_GUARD_V2__ = true;

  function clean(v) {
    return String(v || '').replace(/\s+/g, ' ').trim();
  }

  function managementDialog() {
    return document.getElementById('management-dialog');
  }

  function isVisible(el) {
    if (!el) return false;
    var style = window.getComputedStyle ? getComputedStyle(el) : null;
    return !style || (style.display !== 'none' && style.visibility !== 'hidden');
  }

  function isExcelImportDialog() {
    var dlg = managementDialog();
    if (!dlg || !isVisible(dlg)) return false;
    var titleNode = dlg.querySelector('.dialog-header h3, .excel-clean-head h3, h3');
    var title = clean(titleNode && titleNode.textContent);
    var bodyText = clean(dlg.textContent);
    var hasExcelInput = !!dlg.querySelector('input[type="file"][accept*=".xlsx"], input[type="file"][accept*=".xls"], #admin-offices-full-excel-input, #excel-file-input, #excel-file-input-normal');
    var isCleanDialog = dlg.classList.contains('admin-excel-clean-dialog') || !!dlg.querySelector('.excel-clean-wrap');

    return isCleanDialog || (
      hasExcelInput && (
        title.indexOf('Excel') > -1 ||
        title.indexOf('إكسل') > -1 ||
        title.indexOf('اكسل') > -1 ||
        title.indexOf('استيراد') > -1 ||
        bodyText.indexOf('تامبليت الوظائف') > -1 ||
        bodyText.indexOf('استيراد التامبليت بعد التعبئة') > -1 ||
        bodyText.indexOf('استيراد Excel عادي') > -1 ||
        bodyText.indexOf('استيراد ملف شامل لكل الأقسام') > -1
      )
    );
  }

  function removeNode(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function closestExcelBlock(el) {
    if (!el) return null;
    return el.closest(
      '#admin-offices-full-excel-section,' +
      '.excel-clean-card,' +
      '.admin-offices-full-excel-section,' +
      '[data-admin-offices-full-excel],' +
      'fieldset,' +
      '.section-box'
    ) || el;
  }

  function removeFromNonExcelDialogs() {
    if (isExcelImportDialog()) return;

    document.querySelectorAll('#admin-offices-full-excel-section, .admin-offices-full-excel-section, [data-admin-offices-full-excel]').forEach(removeNode);

    document.querySelectorAll('#admin-offices-full-excel-input').forEach(function (input) {
      removeNode(closestExcelBlock(input));
    });

    var dlg = managementDialog();
    if (dlg && isVisible(dlg)) {
      Array.prototype.slice.call(dlg.querySelectorAll('div, section, fieldset')).forEach(function (el) {
        var text = clean(el.textContent);
        if (text.indexOf('استيراد ملف شامل لكل الأقسام') > -1 && !isExcelImportDialog()) {
          removeNode(closestExcelBlock(el));
        }
      });
    }

    var bar = document.getElementById('main-action-buttons');
    if (bar) {
      Array.prototype.slice.call(bar.querySelectorAll('div, section, fieldset')).forEach(function (el) {
        var text = clean(el.textContent);
        if (text.indexOf('استيراد ملف شامل لكل الأقسام') > -1 || el.querySelector('#admin-offices-full-excel-input')) {
          removeNode(closestExcelBlock(el));
        }
      });
    }
  }

  function wrapPublicInject() {
    var api = window.AdminOfficesFullExcelImport;
    if (!api || typeof api.inject !== 'function' || api.inject.__excelOnlyWrappedV2) return false;
    var old = api.inject;
    api.inject = function excelOnlyInject() {
      if (!isExcelImportDialog()) {
        removeFromNonExcelDialogs();
        return false;
      }
      return old.apply(this, arguments);
    };
    api.inject.__excelOnlyWrappedV2 = true;
    return true;
  }

  function guard() {
    wrapPublicInject();
    removeFromNonExcelDialogs();
  }

  function scheduleGuard() {
    setTimeout(guard, 20);
    setTimeout(guard, 90);
    setTimeout(guard, 170);
    setTimeout(guard, 360);
    setTimeout(guard, 800);
    setTimeout(guard, 1400);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', guard);
  else guard();

  document.addEventListener('click', scheduleGuard, true);

  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    guard();
    if (tries > 100) clearInterval(timer);
  }, 150);

  window.AdminOfficesFullExcelVisibilityGuard = { clean: guard, isExcelImportDialog: isExcelImportDialog };
  console.info('[Admin Offices Full Excel Visibility Guard] installed v2');
})();