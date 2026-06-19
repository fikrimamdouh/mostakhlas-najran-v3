// Polished fixed approve/submit button used by extract-submit.js.
// Also adds a safe print pagination fix for large first tables.
// Also enforces local-only attendance work in normal entry mode.
// Also fixes empty-message spacing in attendance tables.
(function () {
  'use strict';

  function isAttendanceWorkPage() {
    var sig = location.pathname + location.search;
    return /attendance\.html(?:$|[?#])/.test(sig) || /[?&]page=.*attendance\.html(?:$|&)/.test(sig);
  }

  function readSession() {
    try { return JSON.parse(localStorage.getItem('najran_session') || '{}') || {}; } catch (_) { return {}; }
  }

  function isRevisionOrPreviewMode() {
    var s = readSession();
    var q = location.search || '';
    return !!(
      s.reviewOnly === true ||
      localStorage.getItem('najran_revision_extract_id') ||
      q.indexOf('extractId=') >= 0 ||
      q.indexOf('previewExtract=') >= 0 ||
      q.indexOf('revision=') >= 0 ||
      q.indexOf('cloud=1') >= 0 ||
      q.indexOf('restoreCloud=1') >= 0
    );
  }

  function installAttendanceLocalOnlyGuard() {
    if (!isAttendanceWorkPage()) return;
    if (isRevisionOrPreviewMode()) return;
    if (window.__NAJRAN_ATTENDANCE_LOCAL_ONLY_GUARD__) return;
    window.__NAJRAN_ATTENDANCE_LOCAL_ONLY_GUARD__ = true;

    var originalFetch = window.fetch ? window.fetch.bind(window) : null;
    if (!originalFetch) return;

    window.fetch = function(input, init) {
      var url = '';
      try { url = typeof input === 'string' ? input : (input && input.url) || ''; } catch (_) {}
      var method = String((init && init.method) || 'GET').toUpperCase();
      var isHospitalStorageGet = method === 'GET' && /\/api\/hospital-storage(?:\?|$)/.test(url);

      if (isHospitalStorageGet && !isRevisionOrPreviewMode()) {
        console.warn('[AttendanceLocalOnly] تم منع سحب الحضور/المستشفى من السحابة في التشغيل العادي. البيانات المحلية هي المصدر الوحيد.');
        return Promise.resolve(new Response(JSON.stringify({ ok: true, data: {}, localOnly: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }));
      }

      return originalFetch(input, init);
    };
  }

  function fixScreenOnlySpacing() {
    if (!isAttendanceWorkPage()) return;
    try {
      document.querySelectorAll('.department-table > .print-signature-item').forEach(function (el) {
        el.setAttribute('data-screen-hidden-print-signature', '1');
      });
      document.querySelectorAll('.print-signatures .print-signature-item').forEach(function (el) {
        el.setAttribute('data-screen-hidden-print-signature', '1');
      });
      document.querySelectorAll('.department-table .empty-message').forEach(function (el) {
        el.setAttribute('data-attendance-empty-message', '1');
      });
    } catch (_) {}
  }

  function injectCss() {
    if (document.getElementById('approve-button-polish-css')) return;

    var style = document.createElement('style');
    style.id = 'approve-button-polish-css';
    style.textContent = `
      @media screen {
        body:not(.printing) .print-signatures,
        body:not(.printing) .print-signatures *,
        body:not(.printing) .department-table > .print-signature-item,
        body:not(.printing) [data-screen-hidden-print-signature="1"] {
          display: none !important;
          visibility: hidden !important;
          height: 0 !important;
          min-height: 0 !important;
          max-height: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          border: 0 !important;
          overflow: hidden !important;
        }

        body:not(.printing) .department-table .empty-message,
        body:not(.printing) [data-attendance-empty-message="1"] {
          display: none !important;
          visibility: hidden !important;
          height: 0 !important;
          min-height: 0 !important;
          max-height: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          border: 0 !important;
          overflow: hidden !important;
        }

        body:not(.printing) .department-table {
          margin-top: 16px !important;
          margin-bottom: 16px !important;
          padding-bottom: 0 !important;
        }
      }

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
        html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
        .container, .content, .main-content, .print-section-container, .department-table, .performance-table-section, .table-section, .card, .table-card, .printable-section { break-inside: auto !important; page-break-inside: auto !important; }
        .department-table:first-of-type, .performance-table-section:first-of-type, .table-section:first-of-type, .print-section-container:first-of-type { break-before: auto !important; page-break-before: auto !important; margin-top: 0 !important; }
        table { break-inside: auto !important; page-break-inside: auto !important; page-break-before: auto !important; }
        thead { display: table-header-group !important; }
        tfoot { display: table-footer-group !important; }
        tbody { break-inside: auto !important; page-break-inside: auto !important; }
        tr, td, th { break-inside: avoid !important; page-break-inside: avoid !important; }
        .page-contract-info, .page-contract-info-v2, .extract-details, .extract-details-v2, .header-info, .page-header, .company-header, .print-header, h1, h2, h3, h4, .total, .table-summary, .table-summary-v2 { break-after: avoid !important; page-break-after: avoid !important; margin-bottom: 6px !important; }
        .department-table, .performance-table-section, .table-section { margin-top: 6px !important; margin-bottom: 10px !important; padding-top: 0 !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function normalizeButton() {
    var btn = document.getElementById('_najran_approve_btn_inner');
    if (!btn || btn.dataset.polishedApproveButton === '1') return;
    btn.dataset.polishedApproveButton = '1';
    btn.setAttribute('aria-label', (btn.textContent || 'اعتماد المستخلص').trim());
    Array.from(btn.querySelectorAll('span')).forEach(function (span) {
      if ((span.textContent || '').trim() === '←') span.remove();
    });
  }

  function install() {
    installAttendanceLocalOnlyGuard();
    injectCss();
    fixScreenOnlySpacing();
    normalizeButton();
  }

  installAttendanceLocalOnlyGuard();
  document.addEventListener('DOMContentLoaded', function () {
    install();
    setTimeout(install, 500);
    setTimeout(install, 1500);
    setTimeout(install, 3000);
  });

  var mo = new MutationObserver(install);
  try { mo.observe(document.documentElement, { childList: true, subtree: true }); } catch (_) {}
})();
