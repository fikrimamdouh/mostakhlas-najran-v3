// ===================================================================
// Admin Offices Final Print Polish
// Scope: admin_offices_attendance.html only
// Purpose:
// 1) Add attendance signatures to grouped/combined attendance print.
// 2) Polish HG1 performance print table.
// 3) Do not append duplicate raise letters.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_FINAL_PRINT_POLISH__) return;
  window.__ADMIN_OFFICES_FINAL_PRINT_POLISH__ = true;

  function selectedCenterKeys() {
    return Array.from(document.querySelectorAll('#print-centers-checkboxes input:checked'))
      .map(cb => cb.value)
      .filter(Boolean);
  }

  function isChecked(id) {
    return !!document.getElementById(id)?.checked;
  }

  function esc(v) {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getCenterTitle(centerKey) {
    try {
      const names = typeof getCenterNames === 'function'
        ? getCenterNames()
        : JSON.parse(localStorage.getItem('adminOfficeNames_v1') || '{}');
      return names?.[centerKey] || centerKey;
    } catch (_) {
      return centerKey;
    }
  }

  function getScopedSignatures(type, centerKey) {
    try {
      let key = type;
      if (typeof getSignatureKeyForContext === 'function') key = getSignatureKeyForContext(type, centerKey);
      let sigs = typeof getSignatures === 'function' ? (getSignatures(key) || []) : [];
      if (!sigs.length && key !== type && typeof getSignatures === 'function') sigs = getSignatures(type) || [];
      return Array.isArray(sigs) ? sigs : [];
    } catch (_) {
      return [];
    }
  }

  function attendanceSignaturesHtml(centerKey) {
    const sigs = getScopedSignatures('attendance', centerKey);
    if (!sigs.length) return '';
    const title = getCenterTitle(centerKey);
    return `<section class="admin-attendance-signatures-fix" data-center="${esc(centerKey)}">
      <div class="sig-fix-caption">تواقيع الحضور والانصراف — ${esc(title)}</div>
      <div class="sig-fix-grid" style="grid-template-columns:repeat(${Math.min(Math.max(sigs.length, 1), 4)},1fr)">
        ${sigs.map(sig => `<div class="sig-fix-box">
          <div class="sig-fix-title">${esc(sig.title || '')}</div>
          <div class="sig-fix-line"></div>
          <div class="sig-fix-name">${esc(sig.name || '')}</div>
        </div>`).join('')}
      </div>
    </section>`;
  }

  function finalPrintCss() {
    return `<style id="admin-offices-final-print-polish-css">
      .admin-attendance-signatures-fix{
        direction:rtl;
        font-family:Tajawal,Arial,sans-serif;
        margin-top:10mm!important;
        padding-top:5mm!important;
        border-top:1.5px solid #0f172a!important;
        page-break-inside:avoid!important;
        break-inside:avoid!important;
      }
      .admin-attendance-signatures-fix .sig-fix-caption{
        text-align:center!important;
        font-size:13px!important;
        font-weight:900!important;
        color:#0f172a!important;
        margin-bottom:7mm!important;
      }
      .admin-attendance-signatures-fix .sig-fix-grid{
        display:grid!important;
        gap:12mm!important;
        align-items:end!important;
        text-align:center!important;
      }
      .admin-attendance-signatures-fix .sig-fix-title{
        font-size:12px!important;
        font-weight:900!important;
        min-height:18px!important;
      }
      .admin-attendance-signatures-fix .sig-fix-line{
        height:20mm!important;
        border-bottom:1px solid #111!important;
        margin:0 6mm 3mm!important;
      }
      .admin-attendance-signatures-fix .sig-fix-name{
        font-size:12px!important;
        font-weight:800!important;
        min-height:16px!important;
      }

      /* HG1 performance print polish */
      .exact-hg1-print{
        direction:rtl!important;
        font-family:Tajawal,Arial,sans-serif!important;
        color:#0f172a!important;
        background:#fff!important;
        padding:7mm 9mm!important;
        box-sizing:border-box!important;
        page-break-after:always!important;
      }
      .exact-hg1-print .hg1-contract-box{
        background:#f8fafc!important;
        border:1px solid #cbd5e1!important;
        border-radius:8px!important;
        padding:7px 10px!important;
        margin:6px 0 8px!important;
        font-size:12.5px!important;
        line-height:1.65!important;
      }
      .exact-hg1-print .hg1-title{
        background:#123c69!important;
        color:#fff!important;
        text-align:center!important;
        font-weight:900!important;
        font-size:17px!important;
        padding:9px 8px!important;
        margin:8px 0 10px!important;
        border-radius:8px!important;
        letter-spacing:0!important;
      }
      .exact-hg1-print .hg1-section-amount{
        background:#fff7ed!important;
        border:1px solid #fed7aa!important;
        color:#7c2d12!important;
        border-radius:7px!important;
        padding:6px 8px!important;
        margin:8px 0!important;
        font-size:13px!important;
        font-weight:900!important;
      }
      .exact-hg1-print .hg1-table{
        width:100%!important;
        border-collapse:collapse!important;
        table-layout:fixed!important;
        font-size:13px!important;
        margin-top:8px!important;
        border:1.5px solid #1e293b!important;
      }
      .exact-hg1-print .hg1-table th{
        background:#123c69!important;
        color:#fff!important;
        border:1px solid #1e293b!important;
        padding:8px 6px!important;
        text-align:center!important;
        font-weight:900!important;
        line-height:1.35!important;
      }
      .exact-hg1-print .hg1-table td{
        border:1px solid #94a3b8!important;
        padding:7px 6px!important;
        text-align:center!important;
        vertical-align:middle!important;
        line-height:1.65!important;
        white-space:normal!important;
        word-break:normal!important;
        overflow-wrap:anywhere!important;
      }
      .exact-hg1-print .hg1-table td:first-child,
      .exact-hg1-print .hg1-table th:first-child{
        width:68%!important;
        text-align:right!important;
        padding-right:10px!important;
      }
      .exact-hg1-print .hg1-table td:nth-child(2),
      .exact-hg1-print .hg1-table th:nth-child(2){
        width:16%!important;
      }
      .exact-hg1-print .hg1-table td:nth-child(3),
      .exact-hg1-print .hg1-table th:nth-child(3){
        width:16%!important;
      }
      .exact-hg1-print .hg1-table tbody tr:nth-child(even) td{
        background:#f8fafc!important;
      }
      .exact-hg1-print .hg1-total-row td{
        background:#fde68a!important;
        color:#111827!important;
        font-weight:900!important;
        border-top:2px solid #92400e!important;
      }
      .exact-hg1-print .hg1-summary{
        margin-top:10px!important;
        background:#f1f5f9!important;
        border:1px solid #cbd5e1!important;
        border-radius:8px!important;
        padding:8px 10px!important;
        font-size:13px!important;
        line-height:1.75!important;
        text-align:right!important;
        font-weight:800!important;
      }
      .exact-hg1-print .hg1-summary p{
        margin:3px 0!important;
      }
    </style>`;
  }

  function injectFinalCss(printWin) {
    try {
      if (!printWin?.document?.head) return;
      if (!printWin.document.getElementById('admin-offices-final-print-polish-css')) {
        printWin.document.head.insertAdjacentHTML('beforeend', finalPrintCss());
      }
    } catch (e) {
      console.error('[Admin Offices Final Print Polish] CSS inject failed', e);
    }
  }

  function appendAttendanceSignatures(printWin, keys) {
    try {
      if (!printWin?.document?.body || !keys.length) return;
      const pages = Array.from(printWin.document.querySelectorAll('.landscape-page, .print-page.landscape-page, .admin-attendance-print-page'));
      keys.forEach((key, idx) => {
        const html = attendanceSignaturesHtml(key);
        if (!html) return;
        const target = pages[idx] || printWin.document.body;
        if (target.querySelector && target.querySelector(`.admin-attendance-signatures-fix[data-center="${CSS.escape(key)}"]`)) return;
        target.insertAdjacentHTML('beforeend', html);
      });
    } catch (e) {
      console.error('[Admin Offices Final Print Polish] attendance signatures append failed', e);
    }
  }

  function patchPrintSelected() {
    if (typeof window.printSelected !== 'function' || window.printSelected.__adminOfficesFinalPrintPolishV1) return false;
    const old = window.printSelected;
    window.printSelected = function adminOfficesFinalPrintSelected() {
      const keys = selectedCenterKeys();
      const wantsAttendance = isChecked('print-opt-attendance');
      let printWin = null;
      const realOpen = window.open;
      window.open = function () { printWin = realOpen.apply(window, arguments); return printWin; };
      let result;
      try { result = old.apply(this, arguments); }
      finally { window.open = realOpen; }
      if (printWin && printWin.document) {
        setTimeout(() => {
          injectFinalCss(printWin);
          if (wantsAttendance) appendAttendanceSignatures(printWin, keys);
        }, 450);
      }
      return result;
    };
    window.printSelected.__adminOfficesFinalPrintPolishV1 = true;
    console.info('[Admin Offices Final Print Polish] printSelected patched v1');
    return true;
  }

  function boot(attempt) {
    patchPrintSelected();
    if (attempt < 60 && !window.printSelected?.__adminOfficesFinalPrintPolishV1) setTimeout(() => boot(attempt + 1), 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot(0)); else boot(0);
  setTimeout(() => boot(0), 1200);
  setTimeout(() => boot(0), 3000);
  console.info('[Admin Offices Final Print Polish] installed v1 attendance signatures + HG1 table polish');
})();