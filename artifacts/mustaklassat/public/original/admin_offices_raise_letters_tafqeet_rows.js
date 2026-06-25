// ===================================================================
// Admin Offices Final Print Polish
// Scope: admin_offices_attendance.html only
// Purpose:
// 1) Add attendance signatures to grouped/combined/single-office attendance print.
// 2) Polish HG1 performance print table.
// 3) Delay browser print briefly so injected pages/styles appear in PDF.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_FINAL_PRINT_POLISH__) return;
  window.__ADMIN_OFFICES_FINAL_PRINT_POLISH__ = true;

  function selectedCenterKeys() {
    return Array.from(document.querySelectorAll('#print-centers-checkboxes input:checked')).map(cb => cb.value).filter(Boolean);
  }
  function detectCurrentCenterKey() {
    const activeTab = document.querySelector('.tab-link.active[data-center-key]');
    if (activeTab?.dataset?.centerKey) return activeTab.dataset.centerKey;
    const visibleTable = Array.from(document.querySelectorAll('[id^="table-div-"]')).find(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    if (visibleTable?.id) return visibleTable.id.replace('table-div-', '');
    const title = (document.getElementById('center-main-title')?.textContent || '').trim();
    try {
      const names = typeof getCenterNames === 'function' ? getCenterNames() : JSON.parse(localStorage.getItem('adminOfficeNames_v1') || '{}');
      const hit = Object.entries(names).find(([, name]) => title.includes(name));
      if (hit) return hit[0];
    } catch (_) {}
    return null;
  }
  function isChecked(id) { return !!document.getElementById(id)?.checked; }
  function esc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function getCenterTitle(centerKey) {
    try {
      const names = typeof getCenterNames === 'function' ? getCenterNames() : JSON.parse(localStorage.getItem('adminOfficeNames_v1') || '{}');
      return names?.[centerKey] || centerKey;
    } catch (_) { return centerKey; }
  }
  function getScopedSignatures(type, centerKey) {
    try {
      let key = type;
      if (typeof getSignatureKeyForContext === 'function') key = getSignatureKeyForContext(type, centerKey);
      let sigs = typeof getSignatures === 'function' ? (getSignatures(key) || []) : [];
      if (!sigs.length && key !== type && typeof getSignatures === 'function') sigs = getSignatures(type) || [];
      return Array.isArray(sigs) ? sigs : [];
    } catch (_) { return []; }
  }
  function attendanceSignaturesHtml(centerKey) {
    const sigs = getScopedSignatures('attendance', centerKey);
    const safeSigs = sigs.length ? sigs : [{ title: 'مدير المشروع', name: '' }, { title: 'رئيس قسم الصيانة', name: '' }, { title: 'مندوب المقاول', name: '' }];
    const title = getCenterTitle(centerKey);
    return `<section class="admin-attendance-signatures-fix" data-center="${esc(centerKey)}">
      <div class="sig-fix-caption">تواقيع الحضور والانصراف — ${esc(title)}</div>
      <div class="sig-fix-grid" style="grid-template-columns:repeat(${Math.min(Math.max(safeSigs.length, 1), 4)},1fr)">
        ${safeSigs.map(sig => `<div class="sig-fix-box"><div class="sig-fix-title">${esc(sig.title || '')}</div><div class="sig-fix-line"></div><div class="sig-fix-name">${esc(sig.name || '')}</div></div>`).join('')}
      </div>
    </section>`;
  }
  function finalPrintCss() {
    return `<style id="admin-offices-final-print-polish-css">
      .admin-attendance-signatures-fix{direction:rtl;font-family:Tajawal,Arial,sans-serif;margin-top:3mm!important;padding-top:2mm!important;border-top:1.2px solid #0f172a!important;page-break-inside:avoid!important;break-inside:avoid!important;clear:both!important}
      .admin-attendance-signatures-fix .sig-fix-caption{text-align:center!important;font-size:9px!important;font-weight:900!important;color:#0f172a!important;margin-bottom:2mm!important}
      .admin-attendance-signatures-fix .sig-fix-grid{display:grid!important;gap:7mm!important;align-items:end!important;text-align:center!important}
      .admin-attendance-signatures-fix .sig-fix-title{font-size:8.5px!important;font-weight:900!important;min-height:12px!important}
      .admin-attendance-signatures-fix .sig-fix-line{height:9mm!important;border-bottom:1px solid #111!important;margin:0 5mm 1mm!important}
      .admin-attendance-signatures-fix .sig-fix-name{font-size:8.5px!important;font-weight:800!important;min-height:11px!important}
      .site-perf-v3,.performance-compact-page,.portrait-page-perf{direction:rtl!important;font-family:Tajawal,Arial,sans-serif!important;color:#111827!important;background:#fff!important;padding:0!important;box-sizing:border-box!important;page-break-after:always!important}
      .site-perf-v3 .performance-compact-table,.performance-compact-page .performance-compact-table{width:100%!important;border-collapse:collapse!important;table-layout:fixed!important;font-size:10.5px!important;border:1.5px solid #111827!important}
      .site-perf-v3 th,.performance-compact-page th{background:#123c69!important;color:#fff!important;border:1px solid #111827!important;padding:4px!important;text-align:center!important;font-weight:900!important;line-height:1.2!important}
      .site-perf-v3 td,.performance-compact-page td{border:1px solid #475569!important;padding:3.5px 4px!important;text-align:center!important;vertical-align:middle!important;line-height:1.28!important;white-space:normal!important;overflow-wrap:anywhere!important}
      .site-perf-v3 th:nth-child(1),.site-perf-v3 td:nth-child(1),.performance-compact-page th:nth-child(1),.performance-compact-page td:nth-child(1){width:6%!important}
      .site-perf-v3 th:nth-child(2),.site-perf-v3 td:nth-child(2),.performance-compact-page th:nth-child(2),.performance-compact-page td:nth-child(2){width:68%!important;text-align:right!important}
      .site-perf-v3 th:nth-child(3),.site-perf-v3 td:nth-child(3),.performance-compact-page th:nth-child(3),.performance-compact-page td:nth-child(3){width:13%!important}
      .site-perf-v3 th:nth-child(4),.site-perf-v3 td:nth-child(4),.performance-compact-page th:nth-child(4),.performance-compact-page td:nth-child(4){width:13%!important}
      .site-perf-v3 tbody tr:nth-child(even) td,.performance-compact-page tbody tr:nth-child(even) td{background:#f8fafc!important}
      .site-perf-v3 .perf-total td,.performance-compact-page .perf-total td{background:#fde68a!important;font-weight:900!important;border-top:2px solid #92400e!important}
      .site-perf-v3 .signatures,.performance-compact-page .signatures{display:grid!important;grid-template-columns:repeat(3,1fr)!important;gap:24px!important;margin-top:8px!important;text-align:center!important;border-top:1px solid #111!important;padding-top:6px!important}
      .site-perf-v3 .sign-box .line,.performance-compact-page .sign-box .line{height:18px!important;border-bottom:1px solid #111!important;margin:2px 14px!important}
    </style>`;
  }
  function injectFinalCss(printWin) {
    try {
      if (!printWin?.document?.head) return;
      if (!printWin.document.getElementById('admin-offices-final-print-polish-css')) printWin.document.head.insertAdjacentHTML('beforeend', finalPrintCss());
    } catch (e) { console.error('[Admin Offices Final Print Polish] CSS inject failed', e); }
  }
  function appendAttendanceSignatures(printWin, keys) {
    try {
      if (!printWin?.document?.body || !keys.length) return;
      const pages = Array.from(printWin.document.querySelectorAll('.landscape-page, .print-page.landscape-page, .admin-attendance-print-page')).filter(p => !p.querySelector('.admin-attendance-signatures-fix'));
      keys.forEach((key, idx) => {
        const html = attendanceSignaturesHtml(key);
        const target = pages[idx] || pages[0] || printWin.document.body;
        if (target.querySelector && target.querySelector(`.admin-attendance-signatures-fix[data-center="${CSS.escape(key)}"]`)) return;
        target.insertAdjacentHTML('beforeend', html);
      });
    } catch (e) { console.error('[Admin Offices Final Print Polish] attendance signatures append failed', e); }
  }
  function beforePrintPolish(printWin, keys, wantsAttendance) {
    injectFinalCss(printWin);
    if (wantsAttendance) appendAttendanceSignatures(printWin, keys.length ? keys : [detectCurrentCenterKey()].filter(Boolean));
  }
  function protectWindowPrint(printWin, keys, wantsAttendance) {
    if (!printWin || printWin.__adminOfficesPrintProtectedV3) return;
    printWin.__adminOfficesPrintProtectedV3 = true;
    const realPrint = printWin.print ? printWin.print.bind(printWin) : null;
    printWin.print = function () {
      beforePrintPolish(printWin, keys, wantsAttendance);
      setTimeout(() => beforePrintPolish(printWin, keys, wantsAttendance), 120);
      setTimeout(() => { if (realPrint) realPrint(); }, 650);
    };
  }
  function patchPrintSelected() {
    if (typeof window.printSelected !== 'function' || window.printSelected.__adminOfficesFinalPrintPolishV1) return false;
    const old = window.printSelected;
    window.printSelected = function adminOfficesFinalPrintSelected() {
      const keys = selectedCenterKeys();
      const wantsAttendance = isChecked('print-opt-attendance') || keys.length > 0;
      let printWin = null;
      const realOpen = window.open;
      window.open = function () {
        printWin = realOpen.apply(window, arguments);
        protectWindowPrint(printWin, keys, wantsAttendance);
        return printWin;
      };
      let result;
      try { result = old.apply(this, arguments); }
      finally { window.open = realOpen; }
      if (printWin && printWin.document) {
        beforePrintPolish(printWin, keys, wantsAttendance);
        setTimeout(() => beforePrintPolish(printWin, keys, wantsAttendance), 250);
        setTimeout(() => beforePrintPolish(printWin, keys, wantsAttendance), 600);
      }
      return result;
    };
    window.printSelected.__adminOfficesFinalPrintPolishV1 = true;
    console.info('[Admin Offices Final Print Polish] printSelected patched v3 before-print');
    return true;
  }
  function patchPreparePrint() {
    if (typeof window.preparePrint !== 'function' || window.preparePrint.__adminOfficesFinalPrintPolishV1) return false;
    const old = window.preparePrint;
    window.preparePrint = function adminOfficesFinalPreparePrint() {
      const key = detectCurrentCenterKey();
      let printWin = null;
      const realOpen = window.open;
      window.open = function () {
        printWin = realOpen.apply(window, arguments);
        protectWindowPrint(printWin, [key].filter(Boolean), !!key);
        return printWin;
      };
      let result;
      try { result = old.apply(this, arguments); }
      finally { window.open = realOpen; }
      if (printWin && printWin.document && key) {
        beforePrintPolish(printWin, [key], true);
        setTimeout(() => beforePrintPolish(printWin, [key], true), 250);
        setTimeout(() => beforePrintPolish(printWin, [key], true), 600);
      }
      return result;
    };
    window.preparePrint.__adminOfficesFinalPrintPolishV1 = true;
    console.info('[Admin Offices Final Print Polish] preparePrint patched v3 before-print');
    return true;
  }
  function boot(attempt) {
    patchPrintSelected();
    patchPreparePrint();
    if (attempt < 60 && (!window.printSelected?.__adminOfficesFinalPrintPolishV1 || !window.preparePrint?.__adminOfficesFinalPrintPolishV1)) setTimeout(() => boot(attempt + 1), 250);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot(0)); else boot(0);
  setTimeout(() => boot(0), 1200);
  setTimeout(() => boot(0), 3000);
  console.info('[Admin Offices Final Print Polish] installed v3 before-print signatures + performance CSS');
})();