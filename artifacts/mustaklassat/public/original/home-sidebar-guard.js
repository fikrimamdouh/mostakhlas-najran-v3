(function () {
  'use strict';

  if (window.__NAJRAN_HOME_SIDEBAR_GUARD__) return;
  window.__NAJRAN_HOME_SIDEBAR_GUARD__ = true;

  function textOf(el) {
    return String((el && (el.textContent || el.innerText)) || '').trim();
  }

  function isVisibleEnough(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
    return true;
  }

  function isHospitalLettersMode() {
    var sig = String(window.location.pathname + window.location.search + window.location.hash);
    return sig.indexOf('hospitalLettersClean=1') > -1 && sig.indexOf('achievement.html') > -1;
  }

  function injectHospitalLettersTopStyle() {
    if (!isHospitalLettersMode()) return;
    if (document.getElementById('hospital-letters-force-visible-style')) return;

    try { document.body.classList.add('hospital-letters-mode'); } catch (_) {}

    var st = document.createElement('style');
    st.id = 'hospital-letters-force-visible-style';
    st.textContent = [
      'body.hospital-letters-mode #rl-root{',
      'display:block!important;',
      'visibility:visible!important;',
      'opacity:1!important;',
      'position:relative!important;',
      'max-width:1200px!important;',
      'width:calc(100vw - 48px)!important;',
      'max-height:none!important;',
      'overflow:visible!important;',
      'margin:24px auto!important;',
      'z-index:2147483647!important;',
      '}',
      'body.hospital-letters-mode #_najran_approve_btn{display:none!important;}',
      'body.hospital-letters-mode [data-hospital-letters-loader-hidden="1"]{display:none!important;visibility:hidden!important;}',
      'body.hospital-letters-mode #hospital-letters-fallback-open{',
      'direction:rtl;font-family:Tajawal,Arial,sans-serif;margin:40px auto;max-width:720px;',
      'background:#fff;border:1px solid #dbe4f0;border-radius:18px;box-shadow:0 12px 35px rgba(15,23,42,.12);',
      'padding:24px;text-align:center;color:#0f172a;position:relative;z-index:2147483646;',
      '}',
      'body.hospital-letters-mode #hospital-letters-fallback-open button{',
      'border:0;border-radius:12px;background:#0056b3;color:#fff;padding:12px 18px;font-weight:900;cursor:pointer;',
      '}'
    ].join('');
    document.head.appendChild(st);
  }

  function ensureHospitalLettersScript() {
    if (!isHospitalLettersMode() || !document.body) return;
    injectHospitalLettersTopStyle();
    if (document.getElementById('rl-root')) return;

    var existing = document.querySelector('script[src*="hospital_raise_letters_final_v3.js"]');
    if (!existing && !window.__HOSPITAL_LETTERS_FORCE_SCRIPT_LOADING__) {
      window.__HOSPITAL_LETTERS_FORCE_SCRIPT_LOADING__ = true;
      var s = document.createElement('script');
      s.src = '/original/hospital_raise_letters_final_v3.js?v=20260628_letters_v5_force2';
      s.defer = true;
      s.onload = function () {
        console.info('[HospitalLetters] forced script loaded');
        setTimeout(function () { hideHospitalLettersOpeningLoader(); }, 100);
      };
      s.onerror = function () {
        console.warn('[HospitalLetters] forced script failed to load');
        showHospitalLettersFallback();
      };
      document.body.appendChild(s);
    }

    setTimeout(function () {
      if (!document.getElementById('rl-root')) showHospitalLettersFallback();
    }, 2200);
  }

  function showHospitalLettersFallback() {
    if (!isHospitalLettersMode() || document.getElementById('rl-root') || document.getElementById('hospital-letters-fallback-open')) return;
    injectHospitalLettersTopStyle();
    var box = document.createElement('div');
    box.id = 'hospital-letters-fallback-open';
    box.innerHTML = '<h2>مركز خطابات المستشفى</h2><p>ملف الخطابات لم يظهر تلقائيًا. اضغط الزر لإعادة تحميل مركز الخطابات فقط.</p><button type="button">فتح مركز الخطابات</button>';
    box.querySelector('button').onclick = function () {
      box.remove();
      window.__HOSPITAL_LETTERS_FORCE_SCRIPT_LOADING__ = false;
      var old = document.querySelector('script[src*="hospital_raise_letters_final_v3.js"]');
      if (old && old.parentNode) old.parentNode.removeChild(old);
      ensureHospitalLettersScript();
      setTimeout(function () {
        if (!document.getElementById('rl-root')) window.location.reload();
      }, 1800);
    };
    document.body.appendChild(box);
  }

  function hideHospitalLettersOpeningLoader() {
    if (!isHospitalLettersMode() || !document.body) return;
    injectHospitalLettersTopStyle();
    ensureHospitalLettersScript();

    var nodes = Array.prototype.slice.call(document.querySelectorAll('body *'));
    nodes.forEach(function (el) {
      if (!el || el.id === 'rl-root' || el.id === 'hospital-letters-fallback-open' || (el.closest && (el.closest('#rl-root') || el.closest('#hospital-letters-fallback-open')))) return;
      var text = textOf(el);
      var compact = text.length > 0 && text.length < 90;
      if (
        compact &&
        (
          text.indexOf('جاري فتح مركز خطابات المستشفى') > -1 ||
          text.indexOf('بعد شهادة الإنجاز') > -1
        )
      ) {
        try {
          el.style.setProperty('display', 'none', 'important');
          el.style.setProperty('visibility', 'hidden', 'important');
          el.setAttribute('data-hospital-letters-loader-hidden', '1');
        } catch (_) {}
      }
    });
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

  function scheduleCleanup() {
    setTimeout(cleanupDuplicateSidebars, 0);
    setTimeout(cleanupDuplicateSidebars, 150);
    setTimeout(cleanupDuplicateSidebars, 600);
    setTimeout(cleanupDuplicateSidebars, 1500);

    setTimeout(hideHospitalLettersOpeningLoader, 0);
    setTimeout(hideHospitalLettersOpeningLoader, 150);
    setTimeout(hideHospitalLettersOpeningLoader, 600);
    setTimeout(hideHospitalLettersOpeningLoader, 1500);
    setTimeout(hideHospitalLettersOpeningLoader, 3000);
  }

  function installObserver() {
    if (!window.MutationObserver || !document.body) return;

    var obs = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (!m.addedNodes || !m.addedNodes.length) continue;

        for (var j = 0; j < m.addedNodes.length; j++) {
          var n = m.addedNodes[j];
          var nText = textOf(n);
          if (
            isSidebarLike(n) ||
            (n.querySelector && n.querySelector('[id*="sidebar"],[class*="sidebar"],[class*="drawer"],[class*="mobile-menu"]')) ||
            (isHospitalLettersMode() && (nText.indexOf('جاري فتح مركز خطابات المستشفى') > -1 || nText.indexOf('بعد شهادة الإنجاز') > -1 || (n.querySelector && n.querySelector('#rl-root'))))
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

  console.warn('[HomeSidebarGuard] installed safe duplicate-cleanup + hospital letters forced loader');
})();