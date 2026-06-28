(function () {
  'use strict';

  if (window.__NAJRAN_HOME_SIDEBAR_GUARD__) return;
  window.__NAJRAN_HOME_SIDEBAR_GUARD__ = true;

  var HOSPITAL_LETTERS_STANDALONE_URL = '/original/hospital_raise_letters.html?hospitalLettersClean=1&page=achievement.html#hospital-letters-clean';

  function redirectLegacyHospitalLettersRoute() {
    try {
      var sig = String(window.location.pathname + window.location.search + window.location.hash);
      var isOldLettersRoute = sig.indexOf('hospitalLettersClean=1') > -1 && sig.indexOf('achievement.html') > -1 && sig.indexOf('hospital_raise_letters.html') === -1;
      if (!isOldLettersRoute) return false;
      console.warn('[HospitalLetters] legacy achievement route redirected to standalone page:', HOSPITAL_LETTERS_STANDALONE_URL);
      window.location.replace(HOSPITAL_LETTERS_STANDALONE_URL);
      return true;
    } catch (_) {
      return false;
    }
  }

  if (redirectLegacyHospitalLettersRoute()) return;

  function textOf(el) {
    return String((el && (el.textContent || el.innerText)) || '').trim();
  }

  function shouldOpenStandaloneLetters(target) {
    if (!target || !target.closest) return false;
    if (target.closest('#rl-root')) return false;

    var text = textOf(target);
    var href = String(target.getAttribute && (target.getAttribute('href') || target.getAttribute('data-href') || '') || '');
    var onclick = String(target.getAttribute && (target.getAttribute('onclick') || '') || '');
    var sig = [text, href, onclick].join(' ');

    if (sig.indexOf('hospital_raise_letters.html') > -1) return false;

    var hasLettersText =
      sig.indexOf('خطابات') > -1 ||
      sig.indexOf('خطاب الرفع') > -1 ||
      sig.indexOf('مركز خطابات') > -1 ||
      sig.indexOf('hospitalLettersClean') > -1;

    var hasOldRoute =
      sig.indexOf('achievement.html') > -1 ||
      sig.indexOf('بعد شهادة الإنجاز') > -1 ||
      sig.indexOf('بعد شهادة الانجاز') > -1;

    return hasLettersText && (hasOldRoute || sig.indexOf('hospitalLettersClean') > -1);
  }

  function openStandaloneHospitalLetters(event, target) {
    try {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
        if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      }
      console.warn('[HospitalLetters] button click routed to standalone page:', HOSPITAL_LETTERS_STANDALONE_URL, target);
      window.location.href = HOSPITAL_LETTERS_STANDALONE_URL;
      return true;
    } catch (_) {
      return false;
    }
  }

  function isVisibleEnough(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
    return true;
  }

  function isSidebarLike(el) {
  if (!el || el.nodeType !== 1) return false;

  var id = String(el.id || '').toLowerCase();
  var cls = String(el.className || '').toLowerCase();
  var text = textOf(el);

  if (
    id.indexOf('sidebar') > -1 ||
    id.indexOf('side-menu') > -1 ||
    id.indexOf('drawer') > -1 ||
    cls.indexOf('sidebar') > -1 ||
    cls.indexOf('side-menu') > -1 ||
    cls.indexOf('drawer') > -1 ||
    cls.indexOf('mobile-menu') > -1 ||
    cls.indexOf('nav-menu') > -1
  ) {
    return true;
  }

  if (!isVisibleEnough(el)) return false;

  var tag = String(el.tagName || '').toLowerCase();
  if (tag !== 'nav' && tag !== 'aside') return false;

  if (
    text.indexOf('الرئيسية') > -1 &&
    text.indexOf('الحضور') > -1 &&
    (
      text.indexOf('الإعدادات') > -1 ||
      text.indexOf('المستخلصات') > -1 ||
      text.indexOf('الأرشيف') > -1 ||
      text.indexOf('شهادة') > -1
    )
  ) {
    return true;
  }

  return false;
}

  function getSidebars() {
    return Array.prototype.slice
      .call(document.querySelectorAll('body *'))
      .filter(isSidebarLike);
  }

  function scoreSidebar(el) {
    var id = String(el.id || '').toLowerCase();
    var cls = String(el.className || '').toLowerCase();
    var score = 0;

    if (id.indexOf('sidebar') > -1) score += 20;
    if (cls.indexOf('sidebar') > -1) score += 20;
    if (id.indexOf('drawer') > -1 || cls.indexOf('drawer') > -1) score += 10;
    if (isVisibleEnough(el)) score += 5;
    if (document.body.firstElementChild === el) score += 3;

    return score;
  }

  function cleanupDuplicateSidebars() {
    var nodes = getSidebars();
    if (nodes.length <= 1) return;

    nodes.sort(function (a, b) {
      return scoreSidebar(b) - scoreSidebar(a);
    });

    nodes.slice(1).forEach(function (el) {
      try {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      } catch (_) {}
    });

    console.warn('[HomeSidebarGuard] duplicate sidebars cleaned:', nodes.length - 1);
  }

  function rewriteLegacyHospitalLettersLinks() {
    try {
      Array.prototype.slice.call(document.querySelectorAll('a[href],button,[onclick],[data-href]')).forEach(function (el) {
        if (!shouldOpenStandaloneLetters(el)) return;
        if (el.tagName === 'A') el.setAttribute('href', HOSPITAL_LETTERS_STANDALONE_URL);
        el.setAttribute('data-hospital-letters-standalone-route', '1');
      });
    } catch (_) {}
  }

  function scheduleCleanup() {
    setTimeout(cleanupDuplicateSidebars, 0);
    setTimeout(cleanupDuplicateSidebars, 150);
    setTimeout(cleanupDuplicateSidebars, 600);
    setTimeout(cleanupDuplicateSidebars, 1500);

    setTimeout(rewriteLegacyHospitalLettersLinks, 0);
    setTimeout(rewriteLegacyHospitalLettersLinks, 150);
    setTimeout(rewriteLegacyHospitalLettersLinks, 600);
    setTimeout(rewriteLegacyHospitalLettersLinks, 1500);
  }

  function installObserver() {
    if (!window.MutationObserver || !document.body) return;

    var obs = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (!m.addedNodes || !m.addedNodes.length) continue;

        for (var j = 0; j < m.addedNodes.length; j++) {
          var n = m.addedNodes[j];
          if (
            isSidebarLike(n) ||
            shouldOpenStandaloneLetters(n) ||
            (n.querySelector && n.querySelector('[id*="sidebar"],[class*="sidebar"],[class*="drawer"],[class*="mobile-menu"]'))
          ) {
            scheduleCleanup();
            return;
          }
        }
      }
    });

    obs.observe(document.body, { childList: true, subtree: true });
    window.__NAJRAN_HOME_SIDEBAR_OBSERVER__ = obs;
  }

  document.addEventListener('click', function (e) {
    var target = e.target && e.target.closest
      ? e.target.closest('a,button,div,span')
      : null;

    if (!target) return;

    if (shouldOpenStandaloneLetters(target)) {
      openStandaloneHospitalLetters(e, target);
      return;
    }

    var text = textOf(target);

    if (
      text.indexOf('الرئيسية') > -1 ||
      text.indexOf('حفظ محلي') > -1 ||
      text.indexOf('الرجوع للرئيسية') > -1
    ) {
      scheduleCleanup();
    }
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      scheduleCleanup();
      installObserver();
    });
  } else {
    scheduleCleanup();
    installObserver();
  }

  console.warn('[HomeSidebarGuard] installed safe duplicate-cleanup + standalone hospital letters button routing');
})();