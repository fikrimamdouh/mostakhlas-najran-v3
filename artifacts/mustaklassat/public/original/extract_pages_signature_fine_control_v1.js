/**
 * Loader + non-destructive enhancement for the unified signature formatting tool.
 * The preserved base implementation is loaded first, then the performance
 * "Print all" window receives an always-visible toolbar: Save, Default, Collapse.
 */
(function () {
  'use strict';

  if (window.__NAJRAN_SIG_FINE_CONTROL_LOADER_V2__) return;
  window.__NAJRAN_SIG_FINE_CONTROL_LOADER_V2__ = true;

  var BASE_SRC = '/original/extract_pages_signature_fine_control_v1_base_20260712.js?v=20260712_print_all_toolbar_v2';

  function pageFileName() {
    try {
      var q = new URLSearchParams(location.search || '').get('page') || '';
      return q ? q.split('/').pop() : (location.pathname || '').split('/').pop();
    } catch (_) {
      return (location.pathname || '').split('/').pop();
    }
  }

  function loadBase() {
    var head = document.head || document.documentElement;
    try {
      var preload = document.createElement('link');
      preload.rel = 'preload';
      preload.as = 'script';
      preload.href = BASE_SRC;
      head.appendChild(preload);
    } catch (_) {}

    var script = document.createElement('script');
    script.src = BASE_SRC;
    script.async = false;
    script.onload = function () {
      if (pageFileName() === 'performance.html') waitForBaseInit();
    };
    script.onerror = function () {
      console.error('[SigFineControl] تعذر تحميل النسخة الأساسية لأداة تنسيق التواقيع');
    };
    head.appendChild(script);
  }

  function waitForBaseInit() {
    var attempts = 0;
    var timer = setInterval(function () {
      attempts += 1;
      if (document.getElementById('sbx-edit-fab')) {
        clearInterval(timer);
        installPrintAllToolbar();
      } else if (attempts > 100) {
        clearInterval(timer);
        console.warn('[SigFineControl] انتهت مهلة انتظار تهيئة أداة التنسيق الأساسية');
      }
    }, 50);
  }

  function installPrintAllToolbar() {
    if (window.__NAJRAN_PERFORMANCE_PRINT_ALL_TOOLBAR_V2__) return;
    window.__NAJRAN_PERFORMANCE_PRINT_ALL_TOOLBAR_V2__ = true;

    var baseOpen = window.open;

    window.open = function () {
      var child = baseOpen.apply(window, arguments);
      watchChild(child);
      return child;
    };

    function watchChild(child) {
      if (!child) return;
      var attempts = 0;
      var timer = setInterval(function () {
        attempts += 1;
        try {
          if (child.closed) {
            clearInterval(timer);
            return;
          }

          var doc = child.document;
          if (!doc || !doc.body) return;

          // المطلوب يخص نافذة "طباعة الكل" فقط، وليس طباعة جدول منفرد.
          if (!doc.querySelector('.perf-all-signatures-grid')) {
            if (attempts > 120) clearInterval(timer);
            return;
          }

          enhancePanel(child, doc);
          if (doc.getElementById('sbx-panel')) clearInterval(timer);
        } catch (_) {
          clearInterval(timer);
        }
      }, 100);
    }

    function injectCss(doc) {
      if (doc.getElementById('sbx-printall-toolbar-css')) return;
      var style = doc.createElement('style');
      style.id = 'sbx-printall-toolbar-css';
      style.textContent = [
        '#sbx-panel .sbx-head{position:sticky;top:0;z-index:5;flex-wrap:wrap;cursor:move}',
        '#sbx-panel .sbx-head>b{min-width:150px}',
        '#sbx-panel .sbx-printall-actions{display:flex;align-items:center;gap:5px;flex-wrap:wrap;direction:rtl}',
        '#sbx-panel .sbx-printall-actions button{border:0!important;color:#fff!important;padding:6px 10px!important;border-radius:8px!important;font-size:11px!important;box-shadow:0 2px 5px rgba(15,23,42,.18)!important;cursor:pointer!important}',
        '#sbx-panel .sbx-printall-save{background:#15803d!important}',
        '#sbx-panel .sbx-printall-default{background:#b45309!important}',
        '#sbx-panel .sbx-printall-collapse{background:#6d28d9!important}',
        '#sbx-panel.collapsed{overflow:visible!important;max-height:none!important}',
        '@media(max-width:620px){#sbx-panel .sbx-head>b{width:100%}#sbx-panel .sbx-printall-actions{width:100%;justify-content:center}}',
        '@media print{#sbx-panel .sbx-printall-actions{display:none!important}}'
      ].join('\n');
      (doc.head || doc.documentElement).appendChild(style);
    }

    function enhancePanel(child, doc) {
      injectCss(doc);

      var panel = doc.getElementById('sbx-panel');
      if (!panel) return;
      var head = panel.querySelector('.sbx-head');
      if (!head) return;

      var oldActions = head.querySelector('.sbx-printall-actions');
      if (!oldActions) {
        var actions = doc.createElement('div');
        actions.className = 'sbx-printall-actions';
        actions.innerHTML =
          '<button type="button" class="sbx-printall-save" title="حفظ واعتماد التنسيق">حفظ</button>' +
          '<button type="button" class="sbx-printall-default" title="استعادة إعدادات التنسيق الافتراضية">الافتراضي</button>' +
          '<button type="button" class="sbx-printall-collapse" title="طي أو فتح لوحة التنسيق">طي</button>';
        head.appendChild(actions);

        actions.querySelector('.sbx-printall-save').onclick = function (event) {
          event.preventDefault();
          event.stopPropagation();
          var target = panel.querySelector('.sbx-save');
          if (target) target.click();
        };

        actions.querySelector('.sbx-printall-default').onclick = function (event) {
          event.preventDefault();
          event.stopPropagation();
          var target = panel.querySelector('.sbx-reset');
          if (target) target.click();
          setTimeout(function () { enhancePanel(child, doc); }, 0);
        };

        actions.querySelector('.sbx-printall-collapse').onclick = function (event) {
          event.preventDefault();
          event.stopPropagation();
          var target = panel.querySelector('.sbx-collapse');
          if (target) target.click();
          setTimeout(function () { enhancePanel(child, doc); }, 0);
        };
      }

      var collapse = head.querySelector('.sbx-printall-collapse');
      if (collapse) {
        var collapseLabel = panel.classList.contains('collapsed') ? 'فتح' : 'طي';
        if (collapse.textContent !== collapseLabel) collapse.textContent = collapseLabel;
      }

      if (!doc.__sbxPrintAllToolbarObserver) {
        doc.__sbxPrintAllToolbarObserver = new child.MutationObserver(function () {
          setTimeout(function () {
            try { enhancePanel(child, doc); } catch (_) {}
          }, 0);
        });
        doc.__sbxPrintAllToolbarObserver.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
      }
    }

    console.info('[SigFineControl] performance print-all toolbar installed: save/default/collapse');
  }

  loadBase();
})();
