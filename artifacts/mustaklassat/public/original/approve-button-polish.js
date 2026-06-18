// Polished fixed approve/submit button used by extract-submit.js.
(function () {
  'use strict';

  function injectCss() {
    if (document.getElementById('approve-button-polish-css')) return;

    var style = document.createElement('style');
    style.id = 'approve-button-polish-css';
    style.textContent = `
      #_najran_approve_btn {
        position: fixed !important;
        bottom: 26px !important;
        left: 26px !important;
        z-index: 99999 !important;
        direction: rtl !important;
        font-family: Tajawal, Arial, sans-serif !important;
      }

      #_najran_approve_btn_inner {
        min-width: 245px !important;
        min-height: 58px !important;
        padding: 13px 22px !important;
        border: 0 !important;
        border-radius: 18px !important;
        background: linear-gradient(135deg, #0f766e 0%, #16a34a 52%, #22c55e 100%) !important;
        color: #ffffff !important;
        font-size: 15px !important;
        font-weight: 900 !important;
        letter-spacing: 0 !important;
        cursor: pointer !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 11px !important;
        box-shadow: 0 15px 34px rgba(15, 118, 110, .34), 0 4px 10px rgba(15, 23, 42, .18) !important;
        outline: 2px solid rgba(255,255,255,.82) !important;
        outline-offset: -5px !important;
        transition: transform .18s ease, box-shadow .18s ease, filter .18s ease !important;
        white-space: nowrap !important;
        text-shadow: 0 1px 2px rgba(0,0,0,.28) !important;
      }

      #_najran_approve_btn_inner::before {
        content: "✓";
        width: 34px;
        height: 34px;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: rgba(255,255,255,.96);
        color: #0f766e;
        font-size: 19px;
        font-weight: 1000;
        box-shadow: inset 0 0 0 1px rgba(15,118,110,.13), 0 4px 10px rgba(0,0,0,.12);
        text-shadow: none;
        flex: 0 0 auto;
      }

      #_najran_approve_btn_inner::after {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: 18px;
        pointer-events: none;
        background: linear-gradient(180deg, rgba(255,255,255,.22), rgba(255,255,255,0) 48%);
      }

      #_najran_approve_btn_inner:hover {
        transform: translateY(-2px) scale(1.015) !important;
        box-shadow: 0 19px 42px rgba(15, 118, 110, .42), 0 6px 14px rgba(15, 23, 42, .2) !important;
        filter: saturate(1.08) !important;
        opacity: 1 !important;
      }

      #_najran_approve_btn_inner:active {
        transform: translateY(0) scale(.99) !important;
      }

      #_najran_approve_btn_inner:disabled {
        cursor: wait !important;
        opacity: .82 !important;
        filter: grayscale(.15) !important;
      }

      @media (max-width: 720px) {
        #_najran_approve_btn {
          left: 12px !important;
          right: 12px !important;
          bottom: 14px !important;
        }
        #_najran_approve_btn_inner {
          width: 100% !important;
          min-width: 0 !important;
          font-size: 14px !important;
          padding: 12px 16px !important;
        }
      }

      @media print {
        #_najran_approve_btn { display: none !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function normalizeButton() {
    var btn = document.getElementById('_najran_approve_btn_inner');
    if (!btn || btn.dataset.polishedApproveButton === '1') return;

    btn.dataset.polishedApproveButton = '1';
    btn.setAttribute('aria-label', (btn.textContent || 'اعتماد المستخلص').trim());

    // Remove the old arrow-only visual if present and keep the label clear.
    Array.from(btn.querySelectorAll('span')).forEach(function (span) {
      if ((span.textContent || '').trim() === '←') span.remove();
    });
  }

  function install() {
    injectCss();
    normalizeButton();
  }

  document.addEventListener('DOMContentLoaded', function () {
    install();
    setTimeout(install, 500);
    setTimeout(install, 1500);
  });

  var mo = new MutationObserver(install);
  try { mo.observe(document.documentElement, { childList: true, subtree: true }); } catch (_) {}
})();
