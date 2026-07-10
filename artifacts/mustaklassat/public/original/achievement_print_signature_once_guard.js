// achievement_print_signature_once_guard.js
// يثبت مسار شهادة الإنجاز فقط:
// 1) أول طباعة قبل اعتماد التنسيق تمر عبر أداة التنسيق الحالية.
// 2) بعد حفظ واعتماد التنسيق، زر الطباعة الحالي يطبع مباشرة بالتنسيق المحفوظ.
// 3) شارة/لوحة حالة المستخلص تظل للشاشة فقط ولا تظهر في الطباعة.
(function () {
  'use strict';

  if (window.__NAJRAN_ACHIEVEMENT_PRINT_SIGNATURE_ONCE_GUARD__) return;

  function pageFileName() {
    try {
      var fromQuery = new URLSearchParams(location.search || '').get('page') || '';
      return fromQuery ? fromQuery.split('/').pop() : (location.pathname || '').split('/').pop();
    } catch (_) {
      return (location.pathname || '').split('/').pop();
    }
  }

  if (pageFileName() !== 'achievement.html') return;
  window.__NAJRAN_ACHIEVEMENT_PRINT_SIGNATURE_ONCE_GUARD__ = true;

  var STYLE_KEY = 'sb_style_prefs_achievement_v1';
  var PRINT_STYLE_ID = 'najran-achievement-screen-only-print-guard';
  var PRINT_HIDE_CSS = [
    '@media print {',
    '  #najran-revision-mode-badge,',
    '  #najran-revision-exit-modal,',
    '  [data-najran-work-context-badge="true"] {',
    '    display: none !important;',
    '    visibility: hidden !important;',
    '    opacity: 0 !important;',
    '    position: absolute !important;',
    '    width: 0 !important;',
    '    height: 0 !important;',
    '    overflow: hidden !important;',
    '  }',
    '}'
  ].join('\n');

  function readApprovedStyle() {
    try {
      var value = JSON.parse(localStorage.getItem(STYLE_KEY) || '{}');
      return !!(value && value.styleApproved === true);
    } catch (_) {
      return false;
    }
  }

  function installPermanentPrintHideStyle() {
    var style = document.getElementById(PRINT_STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = PRINT_STYLE_ID;
      (document.head || document.documentElement).appendChild(style);
    }

    if (style.textContent !== PRINT_HIDE_CSS) {
      style.textContent = PRINT_HIDE_CSS;
    }
  }

  function markStatusBadgeScreenOnly() {
    try {
      var badge = document.getElementById('najran-revision-mode-badge');
      if (!badge) return;
      badge.setAttribute('data-najran-work-context-badge', 'true');
      badge.classList.add('no-print');
    } catch (_) {}
  }

  function installPrintDelegationGuard() {
    if (window.print && window.print.__najranAchievementOnceGuard) return;

    // نحفظ دالة الطباعة الحالية بعد تحميل أداة تنسيق التواقيع الأصلية.
    // الأداة الأصلية تتولى فتح التنسيق عند عدم وجود اعتماد، والطباعة المباشرة بعد الاعتماد.
    var delegatedPrint = window.print.bind(window);

    var guardedPrint = function () {
      installPermanentPrintHideStyle();
      markStatusBadgeScreenOnly();

      try {
        console.info(
          '[AchievementPrintGuard] print route:',
          readApprovedStyle() ? 'approved-style-direct-print' : 'first-time-formatting'
        );
      } catch (_) {}

      return delegatedPrint.apply(window, arguments);
    };

    guardedPrint.__najranAchievementOnceGuard = true;
    window.print = guardedPrint;
  }

  function install() {
    installPermanentPrintHideStyle();
    markStatusBadgeScreenOnly();
    installPrintDelegationGuard();

    try {
      window.addEventListener('beforeprint', function () {
        installPermanentPrintHideStyle();
        markStatusBadgeScreenOnly();
      });
    } catch (_) {}

    try {
      var observer = new MutationObserver(function () {
        installPermanentPrintHideStyle();
        markStatusBadgeScreenOnly();
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    } catch (_) {}

    console.info('[AchievementPrintGuard] installed — formatting once, then direct print');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(install, 0); });
  } else {
    setTimeout(install, 0);
  }
})();
