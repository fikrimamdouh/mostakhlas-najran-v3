// extract-submit.js — stable loader for preserved implementation + phase 1 safety guard
(function () {
  'use strict';

  if (window.__NAJRAN_EXTRACT_SUBMIT_PHASE1_LOADER_V2__) return;
  window.__NAJRAN_EXTRACT_SUBMIT_PHASE1_LOADER_V2__ = true;

  var BASE_SRC = '/original/extract-submit-base-20260712.js?v=20260712_phase1_submit_safety_v2';
  var GUARD_SRC = '/original/extract-submit-phase1-safety.js?v=20260712_phase1_submit_safety_v2';

  function appendSequentially() {
    var head = document.head || document.documentElement;
    var base = document.createElement('script');
    base.src = BASE_SRC;
    base.async = false;
    base.onload = function () {
      var guard = document.createElement('script');
      guard.src = GUARD_SRC;
      guard.async = false;
      head.appendChild(guard);
    };
    base.onerror = function () {
      console.error('[ExtractSubmitLoader] تعذر تحميل النسخة الأساسية لمسار رفع المستخلص');
    };
    head.appendChild(base);
  }

  if (document.readyState === 'loading' && document.currentScript) {
    document.write('<script src="' + BASE_SRC + '"><\/script>');
    document.write('<script src="' + GUARD_SRC + '"><\/script>');
  } else {
    appendSequentially();
  }
})();