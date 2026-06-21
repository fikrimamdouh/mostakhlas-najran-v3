(function () {
  'use strict';

  if (window.__NAJRAN_HOME_SIDEBAR_GUARD__) return;
  window.__NAJRAN_HOME_SIDEBAR_GUARD__ = true;

  function textOf(el) {
    return String((el && (el.textContent || el.innerText)) || '').trim();
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
      id.indexOf('menu') > -1 ||
      cls.indexOf('sidebar') > -1 ||
      cls.indexOf('side-menu') > -1 ||
      cls.indexOf('drawer') > -1 ||
      cls.indexOf('mobile-menu') > -1 ||
      cls.indexOf('nav-menu') > -1
    ) {
      return true;
    }

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

  function cleanupDuplicateSidebars() {
    var nodes = getSidebars();

    if (nodes.length <= 1) return;

    var keeper = nodes[0];

    nodes.slice(1).forEach(function (el) {
      if (el && el !== keeper && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });

    console.warn('[HomeSidebarGuard] removed duplicate sidebars:', nodes.length - 1);
  }

  var originalAppendChild = Node.prototype.appendChild;
  Node.prototype.appendChild = function (child) {
    if (isSidebarLike(child)) {
      cleanupDuplicateSidebars();

      var existing = getSidebars()[0];
      if (existing && existing !== child) {
        console.warn('[HomeSidebarGuard] blocked duplicate sidebar append');
        return child;
      }
    }

    return originalAppendChild.call(this, child);
  };

  var originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function (child, ref) {
    if (isSidebarLike(child)) {
      cleanupDuplicateSidebars();

      var existing = getSidebars()[0];
      if (existing && existing !== child) {
        console.warn('[HomeSidebarGuard] blocked duplicate sidebar insert');
        return child;
      }
    }

    return originalInsertBefore.call(this, child, ref);
  };

  document.addEventListener('click', function (e) {
    var target = e.target && e.target.closest
      ? e.target.closest('a,button,div,span')
      : null;

    if (!target) return;

    var text = textOf(target);

    if (text === 'الرئيسية' || text.indexOf('الرئيسية') > -1) {
      setTimeout(cleanupDuplicateSidebars, 0);
      setTimeout(cleanupDuplicateSidebars, 100);
      setTimeout(cleanupDuplicateSidebars, 400);
      setTimeout(cleanupDuplicateSidebars, 1000);
    }
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', cleanupDuplicateSidebars);
  } else {
    cleanupDuplicateSidebars();
  }

  console.warn('[HomeSidebarGuard] installed');
})();
