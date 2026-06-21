(function () {
  'use strict';

  if (window.__NAJRAN_HOME_SIDEBAR_GUARD__) return;
  window.__NAJRAN_HOME_SIDEBAR_GUARD__ = true;

  var cleanupTimer = null;
  var observerPaused = false;
  var suppressAllSidebarsUntil = 0;

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

  function removeNodes(nodes, reason) {
    var removed = 0;
    observerPaused = true;
    try {
      nodes.forEach(function (el) {
        if (el && el.parentNode) {
          el.parentNode.removeChild(el);
          removed++;
        }
      });
    } finally {
      observerPaused = false;
    }
    if (removed) console.warn('[HomeSidebarGuard] removed sidebars:', removed, reason || '');
  }

  function cleanupDuplicateSidebars() {
    if (observerPaused) return;

    var nodes = getSidebars();
    if (!nodes.length) return;

    if (Date.now() < suppressAllSidebarsUntil) {
      removeNodes(nodes, 'suppressed');
      return;
    }

    if (nodes.length <= 1) return;

    nodes.sort(function (a, b) {
      return scoreSidebar(b) - scoreSidebar(a);
    });

    removeNodes(nodes.slice(1), 'duplicate');
  }

  function suppressAllSidebars(ms) {
    suppressAllSidebarsUntil = Math.max(suppressAllSidebarsUntil, Date.now() + (ms || 8000));
    try {
      sessionStorage.setItem('najran_suppress_sidebars_until', String(suppressAllSidebarsUntil));
    } catch (_) {}
    cleanupDuplicateSidebars();
  }

  try {
    var storedSuppressUntil = parseInt(sessionStorage.getItem('najran_suppress_sidebars_until') || '0', 10);
    if (storedSuppressUntil && storedSuppressUntil > Date.now()) suppressAllSidebarsUntil = storedSuppressUntil;
  } catch (_) {}

  function scheduleCleanup() {
    if (cleanupTimer) clearTimeout(cleanupTimer);
    cleanupTimer = setTimeout(function () {
      cleanupTimer = null;
      cleanupDuplicateSidebars();
    }, 20);
  }

  function isLocalHomeExitPrimary(target) {
    if (!target || target.id !== 'najran-local-protection-primary') return false;
    var modal = document.getElementById('najran-local-protection-modal');
    if (!modal) return false;
    var modalText = textOf(modal);
    var btnText = textOf(target);
    return btnText.indexOf('حفظ محلي') > -1 && modalText.indexOf('الرجوع للرئيسية') > -1;
  }

  function directLocalSaveAndGoHome(e, target) {
    try {
      if (e && e.preventDefault) e.preventDefault();
      if (e && e.stopPropagation) e.stopPropagation();
      if (e && e.stopImmediatePropagation) e.stopImmediatePropagation();

      if (window.__NAJRAN_LOCAL_HOME_EXIT_RUNNING__) return;
      window.__NAJRAN_LOCAL_HOME_EXIT_RUNNING__ = true;

      suppressAllSidebars(12000);

      var snap = null;
      try {
        if (typeof window.saveExtractSnapshot === 'function') {
          snap = window.saveExtractSnapshot('home-exit-save-direct');
        }
      } catch (err) {
        console.warn('[HomeSidebarGuard] direct local save failed', err);
      }

      if (!snap) {
        window.__NAJRAN_LOCAL_HOME_EXIT_RUNNING__ = false;
        alert('تعذر حفظ المستخلص الحالي محليًا. لم يتم الخروج من الصفحة.');
        return;
      }

      var modal = document.getElementById('najran-local-protection-modal');
      if (modal && modal.parentNode) modal.parentNode.removeChild(modal);

      cleanupDuplicateSidebars();
      console.warn('[HomeSidebarGuard] local draft saved, redirecting directly to dashboard');
      setTimeout(function () {
        window.location.replace('/dashboard?localDraftSaved=1&hideSidebar=1');
      }, 30);
    } catch (err2) {
      window.__NAJRAN_LOCAL_HOME_EXIT_RUNNING__ = false;
      console.warn('[HomeSidebarGuard] direct home exit failed', err2);
      alert('تعذر تنفيذ الحفظ المحلي والخروج.');
    }
  }

  var originalAppendChild = Node.prototype.appendChild;
  Node.prototype.appendChild = function (child) {
    var wasSidebar = isSidebarLike(child);
    var result = originalAppendChild.call(this, child);
    if (wasSidebar || Date.now() < suppressAllSidebarsUntil) scheduleCleanup();
    return result;
  };

  var originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function (child, ref) {
    var wasSidebar = isSidebarLike(child);
    var result = originalInsertBefore.call(this, child, ref);
    if (wasSidebar || Date.now() < suppressAllSidebarsUntil) scheduleCleanup();
    return result;
  };

  document.addEventListener('click', function (e) {
    var target = e.target && e.target.closest
      ? e.target.closest('a,button,div,span')
      : null;

    if (!target) return;

    if (isLocalHomeExitPrimary(target)) {
      directLocalSaveAndGoHome(e, target);
      return;
    }

    var text = textOf(target);

    if (
      text === 'الرئيسية' ||
      text.indexOf('الرئيسية') > -1 ||
      text.indexOf('حفظ محلي') > -1 ||
      text.indexOf('الرجوع للرئيسية') > -1 ||
      text.indexOf('الخروج') > -1
    ) {
      if (text.indexOf('حفظ محلي') > -1 || text.indexOf('الرجوع للرئيسية') > -1) suppressAllSidebars(8000);
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
      if (Date.now() < suppressAllSidebarsUntil) {
        scheduleCleanup();
        return;
      }
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

  setInterval(cleanupDuplicateSidebars, 1000);

  console.warn('[HomeSidebarGuard] installed');
})();
