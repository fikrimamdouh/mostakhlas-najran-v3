(function () {
  'use strict';

  if (window.__NAJRAN_HOME_SIDEBAR_GUARD__) return;
  window.__NAJRAN_HOME_SIDEBAR_GUARD__ = true;

  var cleanupTimer = null;
  var observerPaused = false;

  function textOf(el) {
    return String((el && (el.textContent || el.innerText)) || '').trim();
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

    if (
      isVisibleEnough(el) &&
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
    if (observerPaused) return;

    var nodes = getSidebars();
    if (nodes.length <= 1) return;

    nodes.sort(function (a, b) {
      return scoreSidebar(b) - scoreSidebar(a);
    });

    var keeper = nodes[0];
    var removed = 0;

    observerPaused = true;
    try {
      nodes.slice(1).forEach(function (el) {
        if (el && el !== keeper && el.parentNode) {
          el.parentNode.removeChild(el);
          removed++;
        }
      });
    } finally {
      observerPaused = false;
    }

    if (removed) console.warn('[HomeSidebarGuard] removed duplicate sidebars:', removed);
  }

  function scheduleCleanup() {
    if (cleanupTimer) clearTimeout(cleanupTimer);
    cleanupTimer = setTimeout(function () {
      cleanupTimer = null;
      cleanupDuplicateSidebars();
    }, 30);
  }

  var originalAppendChild = Node.prototype.appendChild;
  Node.prototype.appendChild = function (child) {
    var wasSidebar = isSidebarLike(child);
    var result = originalAppendChild.call(this, child);
    if (wasSidebar) scheduleCleanup();
    return result;
  };

  var originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function (child, ref) {
    var wasSidebar = isSidebarLike(child);
    var result = originalInsertBefore.call(this, child, ref);
    if (wasSidebar) scheduleCleanup();
    return result;
  };

  document.addEventListener('click', function (e) {
    var target = e.target && e.target.closest
      ? e.target.closest('a,button,div,span')
      : null;

    if (!target) return;

    var text = textOf(target);

    if (
      text === 'الرئيسية' ||
      text.indexOf('الرئيسية') > -1 ||
      text.indexOf('حفظ محلي') > -1 ||
      text.indexOf('الرجوع للرئيسية') > -1 ||
      text.indexOf('الخروج') > -1
    ) {
      setTimeout(cleanupDuplicateSidebars, 0);
      setTimeout(cleanupDuplicateSidebars, 100);
      setTimeout(cleanupDuplicateSidebars, 400);
      setTimeout(cleanupDuplicateSidebars, 1000);
      setTimeout(cleanupDuplicateSidebars, 2000);
    }
  }, true);

  function installObserver() {
    if (!window.MutationObserver || !document.body) return;

    var obs = new MutationObserver(function (mutations) {
      if (observerPaused) return;
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (!m.addedNodes || !m.addedNodes.length) continue;
        for (var j = 0; j < m.addedNodes.length; j++) {
          var n = m.addedNodes[j];
          if (isSidebarLike(n) || (n.querySelector && n.querySelector('[id*="sidebar"],[class*="sidebar"],[class*="drawer"],[class*="mobile-menu"]'))) {
            scheduleCleanup();
            return;
          }
        }
      }
    });

    obs.observe(document.body, { childList: true, subtree: true });
    window.__NAJRAN_HOME_SIDEBAR_OBSERVER__ = obs;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      cleanupDuplicateSidebars();
      installObserver();
    });
  } else {
    cleanupDuplicateSidebars();
    installObserver();
  }

  setInterval(cleanupDuplicateSidebars, 3000);

  console.warn('[HomeSidebarGuard] installed');
})();
