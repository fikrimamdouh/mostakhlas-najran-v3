// ===================================================================
// Admin Offices Full Excel Visibility Guard — V3
// Scope: admin_offices_attendance.html
// يمنع ظهور "استيراد ملف شامل لكل الأقسام" خارج نافذة Excel النظيفة فقط.
// لا يغير منطق الاستيراد. ينظف الظهور الخاطئ ويمنع الحقن التلقائي القديم.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])|original-viewer\?page=admin_offices_attendance\.html/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_FULL_EXCEL_VISIBILITY_GUARD_V3__) return;
  window.__ADMIN_OFFICES_FULL_EXCEL_VISIBILITY_GUARD_V3__ = true;

  function clean(v) {
    return String(v || '').replace(/\s+/g, ' ').trim();
  }

  function removeNode(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function closestLeakedBlock(el) {
    if (!el) return null;
    return el.closest(
      '#admin-offices-full-excel-section,' +
      '.admin-offices-full-excel-section,' +
      '[data-admin-offices-full-excel],' +
      '.excel-clean-card,' +
      'fieldset,' +
      '.section-box,' +
      '.form-section,' +
      '.card'
    ) || el;
  }

  function managementDialog() {
    return document.getElementById('management-dialog');
  }

  function isVisible(el) {
    if (!el) return false;
    var style = window.getComputedStyle ? getComputedStyle(el) : null;
    return !!(!style || (style.display !== 'none' && style.visibility !== 'hidden'));
  }

  function isCleanExcelDialog() {
    var dlg = managementDialog();
    if (!dlg || !isVisible(dlg)) return false;
    return dlg.classList.contains('admin-excel-clean-dialog') || !!dlg.querySelector('.excel-clean-wrap');
  }

  function removeLeakedBlocks() {
    document.querySelectorAll('#admin-offices-full-excel-section, .admin-offices-full-excel-section, [data-admin-offices-full-excel]').forEach(removeNode);

    if (!isCleanExcelDialog()) {
      document.querySelectorAll('#admin-offices-full-excel-input').forEach(function (input) {
        removeNode(closestLeakedBlock(input));
      });
    }

    Array.prototype.slice.call(document.querySelectorAll('body div, body section, body fieldset')).forEach(function (el) {
      if (el.id === 'management-dialog' || el.classList.contains('excel-clean-wrap')) return;
      var text = clean(el.textContent);
      if (text.indexOf('استيراد ملف شامل لكل الأقسام') > -1 && !isCleanExcelDialog()) {
        removeNode(closestLeakedBlock(el));
      }
    });
  }

  function wrapPublicApi() {
    var api = window.AdminOfficesFullExcelImport;
    if (!api || api.__excelGuardNoAutoInjectV3) return false;
    if (typeof api.inject === 'function') {
      api.inject = function excelAutoInjectDisabled() {
        removeLeakedBlocks();
        return false;
      };
    }
    api.__excelGuardNoAutoInjectV3 = true;
    return true;
  }

  function guard() {
    wrapPublicApi();
    removeLeakedBlocks();
  }

  function scheduleGuard() {
    setTimeout(guard, 0);
    setTimeout(guard, 30);
    setTimeout(guard, 90);
    setTimeout(guard, 170);
    setTimeout(guard, 360);
    setTimeout(guard, 800);
    setTimeout(guard, 1400);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', guard);
  else guard();

  document.addEventListener('click', scheduleGuard, true);
  document.addEventListener('input', scheduleGuard, true);
  document.addEventListener('change', scheduleGuard, true);

  var mo = new MutationObserver(function () { scheduleGuard(); });
  try { mo.observe(document.documentElement, { childList: true, subtree: true }); } catch (_) {}

  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    guard();
    if (tries > 160) clearInterval(timer);
  }, 120);

  window.AdminOfficesFullExcelVisibilityGuard = { clean: guard, isCleanExcelDialog: isCleanExcelDialog };
  console.info('[Admin Offices Full Excel Visibility Guard] installed v3 force cleanup');
})();