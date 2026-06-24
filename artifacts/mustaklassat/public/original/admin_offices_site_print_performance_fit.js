// ===================================================================
// Admin Offices Single Site Print + Performance Fit — V2
// Scope: admin_offices_attendance.html
// تعديل داخل الملف الموجود فقط، بدون حارس جديد:
// - زر طباعة الموقع يطبع 3 صفحات فقط: الحضور + تقييم الأداء + شهادة الإنجاز.
// - ضبط تقييم الأداء A4 صفحة واحدة: العنوان + الجدول كامل + الملخص + التواقيع.
// - شهادة الأداء الشهرية تظل صفحة واحدة بدون أزرار خارجية.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html|original-viewer\?page=admin_offices_attendance\.html/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_SITE_PRINT_PERFORMANCE_FIT_V2__) return;
  window.__ADMIN_OFFICES_SITE_PRINT_PERFORMANCE_FIT_V2__ = true;

  const DATA_KEYS = [
    'adminOfficesAttendanceData_v1',
    'adminOfficesAttendanceData_v1_localBackup',
    'adminOfficesAttendanceData_v1_lastGood',
    'adminOfficesLaborDataSafe_v2',
    'adminOfficesAttendanceData'
  ];

  function readJson(key, fallback) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; } }
  function esc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function clean(v) { return String(v ?? '').replace(/\s+/g, ' ').trim(); }
  function number(v) { const n = Number(String(v ?? '').replace(/,/g, '').replace(/[ ريال﷼]/g, '').trim()); return Number.isFinite(n) ? n : 0; }
  function money(v) { return number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function sar(v) { return money(v) + ' ريال'; }
  function countRows(data) { return Object.values(data || {}).reduce((s, rows) => s + (Array.isArray(rows) ? rows.length : 0), 0); }
  function getNames() { try { if (typeof window.getCenterNames === 'function') return window.getCenterNames() || {}; } catch (_) {} return readJson('adminOfficeNames_v1', {}); }
  function getData() {
    const list = [];
    try { if (typeof window.getAttendanceData === 'function') list.push(window.getAttendanceData() || {}); } catch (_) {}
    DATA_KEYS.forEach(k => list.push(readJson(k, {})));
    return list.reduce((best, item) => countRows(item) > countRows(best) ? item : best, {});
  }
  function getPeriod() {
    try { if (typeof window.getExtractPeriodDetails === 'function') return window.getExtractPeriodDetails(); } catch (_) {}
    const e = readJson('persistentExtractData', {});
    const start = new Date(e.extractStart || localStorage.getItem('extractStart') || Date.now());
    const end = new Date(e.extractEnd || localStorage.getItem('extractEnd') || e.extractStart || Date.now());
    const safeStart = Number.isNaN(start.getTime()) ? new Date() : start;
    const safeEnd = Number.isNaN(end.getTime()) ? safeStart : end;
    return { startDate: safeStart, endDate: safeEnd, daysInExtract: Math.max(1, Math.ceil((safeEnd - safeStart) / 86400000) + 1 || 30), totalDaysInMonth: new Date(safeStart.getFullYear(), safeStart.getMonth() + 1, 0).getDate() || 30 };
  }
  function dateText(v) { try { const d = v instanceof Date ? v : new Date(v); return Number.isNaN(d.getTime()) ? 'غير محدد' : d.toLocaleDateString('en-CA'); } catch (_) { return 'غير محدد'; } }
  function paymentNo() { const e = readJson('persistentExtractData', {}); const raw = clean(e.paymentNumber || e.extractNumber || localStorage.getItem('paymentNumber') || localStorage.getItem('extractNumber') || '—'); return /^\d+$/.test(raw) ? raw.padStart(3, '0') : raw; }

  function currentCenterKey() {
    try { if (typeof window.getActiveAdminOfficeCenterKey === 'function') return window.getActiveAdminOfficeCenterKey(); } catch (_) {}
    const tab = document.querySelector('.tab-link.active[data-center-key]');
    if (tab && tab.dataset.centerKey) return tab.dataset.centerKey;
    const visibleTable = Array.from(document.querySelectorAll('[id^="table-div-"]')).find(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    if (visibleTable && visibleTable.id) return visibleTable.id.replace('table-div-', '');
    const title = document.getElementById('center-main-title')?.textContent || '';
    const names = getNames();
    const match = Object.entries(names).find(([, name]) => title.includes(String(name || '')));
    if (match) return match[0];
    const keys = Object.keys(getData());
    return keys.length === 1 ? keys[0] : '';
  }

  function injectPerformanceFitCss(win) {
    if (!win || !win.document) return;
    const css = `
      <style id="admin-offices-performance-one-page-fit">
        @page portrait-orientation-perf{size:A4 portrait!important;margin:4mm!important}
        @page performance-cert-page{size:A4 portrait!important;margin:8mm!important}

        .portrait-page-perf{
          page:portrait-orientation-perf!important;
          break-after:page!important;page-break-after:always!important;
          margin:0!important;padding:0!important;overflow:hidden!important;min-height:0!important;
          box-sizing:border-box!important;
        }
        .portrait-page-perf .performance-report{
          height:289mm!important;max-height:289mm!important;min-height:0!important;
          display:flex!important;flex-direction:column!important;justify-content:flex-start!important;
          overflow:hidden!important;padding:0!important;margin:0!important;
          break-inside:avoid!important;page-break-inside:avoid!important;box-sizing:border-box!important;
        }
        .portrait-page-perf .header-table{
          margin:0 0 2.5mm!important;border-bottom:1px solid #0056b3!important;flex:0 0 auto!important;width:100%!important;
        }
        .portrait-page-perf .header-table .logo{width:34px!important;max-height:34px!important;object-fit:contain!important}
        .portrait-page-perf .header-table h1,.portrait-page-perf .header-table h2{
          font-size:8.1pt!important;line-height:1.05!important;margin:0!important;font-weight:800!important;
        }
        .portrait-page-perf .cert-title{
          font-size:12pt!important;margin:1.5mm 0 1mm!important;line-height:1.12!important;flex:0 0 auto!important;text-align:center!important;font-weight:900!important;
        }
        .portrait-page-perf .sub-title{
          font-size:8.2pt!important;margin:0 0 1mm!important;line-height:1.16!important;flex:0 0 auto!important;text-align:center!important;font-weight:800!important;
        }
        .portrait-page-perf .cost-bar{
          font-size:7.8pt!important;padding:2.2mm!important;margin:1mm 0!important;line-height:1.08!important;flex:0 0 auto!important;border-radius:3px!important;
        }
        .portrait-page-perf table{
          width:100%!important;border-collapse:collapse!important;table-layout:fixed!important;
          font-size:6.25pt!important;margin:0!important;flex:0 1 auto!important;
        }
        .portrait-page-perf thead{display:table-header-group!important}
        .portrait-page-perf tr{break-inside:avoid!important;page-break-inside:avoid!important}
        .portrait-page-perf th,.portrait-page-perf td{
          padding:1.15px 2px!important;line-height:1.05!important;border:1px solid #333!important;vertical-align:middle!important;text-align:center!important;
        }
        .portrait-page-perf th{font-weight:900!important;background:#eef2f7!important}
        .portrait-page-perf .item-text{text-align:right!important;white-space:normal!important;word-break:normal!important;overflow-wrap:anywhere!important}
        .portrait-page-perf th:nth-child(1),.portrait-page-perf td:nth-child(1){width:6%!important}
        .portrait-page-perf th:nth-child(2),.portrait-page-perf td:nth-child(2){width:68%!important}
        .portrait-page-perf th:nth-child(3),.portrait-page-perf td:nth-child(3),.portrait-page-perf th:nth-child(4),.portrait-page-perf td:nth-child(4){width:13%!important}
        .portrait-page-perf .summary{
          font-size:7.4pt!important;line-height:1.18!important;margin:1.2mm 0 .5mm!important;flex:0 0 auto!important;text-align:center!important;
        }
        .portrait-page-perf .summary p{margin:0!important}
        .portrait-page-perf .signatures{
          margin-top:auto!important;padding-top:2.5mm!important;border-top:1px solid #333!important;
          display:flex!important;justify-content:space-around!important;gap:5px!important;flex:0 0 auto!important;
        }
        .portrait-page-perf .sign-box{font-size:7.5pt!important;width:24%!important;text-align:center!important;line-height:1.15!important}
        .portrait-page-perf .sign-box .line{margin-top:8mm!important;border-bottom:1px solid #000!important;height:1px!important}

        .admin-performance-cert-page{page:performance-cert-page!important;width:100%!important;min-height:281mm!important;height:281mm!important;margin:0!important;padding:0!important;display:flex!important;align-items:center!important;justify-content:center!important;break-after:page!important;page-break-after:always!important;background:#fff!important}
        .admin-performance-cert-box{width:92%!important;min-height:210mm!important;border:1px solid #d1d5db!important;padding:16mm 13mm!important;display:flex!important;flex-direction:column!important;justify-content:center!important;text-align:center!important}
        .admin-performance-cert-box .head{margin-bottom:16mm!important}.admin-performance-cert-box .head img{width:62px!important}
        .admin-performance-cert-box h1{font-size:20pt!important;margin:0 0 8mm!important;color:#003087!important}.admin-performance-cert-box .meta{font-size:12pt!important;line-height:2!important;margin-bottom:10mm!important}
        .admin-performance-cert-box table{width:78%!important;margin:0 auto 18mm!important;border-collapse:collapse!important;font-size:12pt!important}.admin-performance-cert-box th,.admin-performance-cert-box td{border:1px solid #111!important;padding:8px!important}.admin-performance-cert-box th{background:#f1f5f9!important}
        .admin-performance-cert-box .signatures{margin-top:auto!important;display:flex!important;justify-content:space-around!important;gap:16mm!important}.admin-performance-cert-box .signature-item{width:42%!important;text-align:center!important;font-size:11pt!important}.admin-performance-cert-box .signature-item .line{height:18mm!important;border-bottom:1px solid #111!important;margin:5mm 8mm 3mm!important}
        .toolbar,.print-toolbar,.no-print,button{display:none!important}
      </style>`;
    const inject = () => { try { if (!win.document.getElementById('admin-offices-performance-one-page-fit')) win.document.head.insertAdjacentHTML('beforeend', css); } catch (_) {} };
    inject(); setTimeout(inject, 80); setTimeout(inject, 300); setTimeout(inject, 900);
  }

  function patchPrintSelectedCss() {
    if (typeof window.printSelected !== 'function') return false;
    if (window.printSelected.__adminPerformanceFitWrappedV2) return true;
    const old = window.printSelected;
    window.printSelected = function () {
      let opened = null;
      const oldOpen = window.open;
      window.open = function () { opened = oldOpen.apply(window, arguments); return opened; };
      try { return old.apply(this, arguments); }
      finally { window.open = oldOpen; if (opened) injectPerformanceFitCss(opened); }
    };
    window.printSelected.__adminPerformanceFitWrappedV2 = true;
    return true;
  }

  function printOneCenterLikeMain(centerKey, options) {
    centerKey = centerKey || currentCenterKey();
    if (!centerKey) return alert('لم يتم تحديد الموقع الحالي للطباعة. افتح الموقع مرة أخرى ثم اطبع.');
    if (typeof window.printSelected !== 'function') return alert('دالة الطباعة الرئيسية غير محملة بعد. أعد تحديث الصفحة.');
    const holder = document.createElement('div');
    holder.id = 'admin-single-site-main-print-holder';
    holder.style.cssText = 'position:fixed;left:-99999px;top:-99999px;width:1px;height:1px;overflow:hidden;';
    const opt = Object.assign({ attendance: true, performance: true, achievement: true }, options || {});
    holder.innerHTML = `
      <div id="print-centers-checkboxes"><input type="checkbox" value="${esc(centerKey)}" checked></div>
      <input type="checkbox" id="print-opt-attendance" ${opt.attendance ? 'checked' : ''}>
      <input type="checkbox" id="print-opt-performance" ${opt.performance ? 'checked' : ''}>
      <input type="checkbox" id="print-opt-achievement" ${opt.achievement ? 'checked' : ''}>
    `;
    const old = document.getElementById(holder.id);
    if (old) old.remove();
    document.body.appendChild(holder);
    try { window.printSelected(); }
    finally { setTimeout(() => holder.remove(), 2500); }
  }

  function installSitePrintButton() {
    const view = document.getElementById('center-details-view');
    if (!view || view.style.display === 'none') return;
    const header = view.querySelector('.center-header-container');
    if (!header) return;
    let btn = document.getElementById('admin-single-site-main-print-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'admin-single-site-main-print-btn';
      btn.className = 'back-button';
      btn.style.cssText = 'background:#0f766e;margin-inline-start:8px;';
      header.appendChild(btn);
    }
    btn.innerHTML = '<i class="fas fa-print"></i> طباعة الموقع: حضور + أداء + إنجاز';
    btn.title = 'يطبع للموقع الحالي فقط: الحضور والانصراف، جدول تقييم الأداء، شهادة الإنجاز. لا يطبع الشهادة الإجمالية.';
    btn.onclick = function () { printOneCenterLikeMain(currentCenterKey(), { attendance: true, performance: true, achievement: true }); };
  }

  function patchPerSitePrintNames() {
    const fn = function () { return printOneCenterLikeMain(currentCenterKey(), { attendance: true, performance: true, achievement: true }); };
    window.printCurrentAdminOfficeAttendanceLikeMain = fn;
    window.preparePrint = fn;
    window.printCurrentAttendanceTable = fn;
    window.printCurrentAdminOfficeAttendance = fn;
    window.printCurrentSiteAttendance = fn;
  }

  function signatureHtml(type, centerKey) {
    try {
      if (typeof window.getSignatureKeyForContext === 'function' && typeof window.getSignatures === 'function') {
        const scoped = window.getSignatures(window.getSignatureKeyForContext(type, centerKey)) || [];
        if (scoped.length) return scoped;
      }
      if (typeof window.getSignatures === 'function') return window.getSignatures(type) || [];
    } catch (_) {}
    return [];
  }
  function signatureBlock(type, centerKey) {
    const sigs = signatureHtml(type, centerKey);
    if (!sigs.length) return '<div class="signatures"><div class="signature-item"><div class="title">........................</div><div class="line"></div><div class="name">........................</div></div><div class="signature-item"><div class="title">........................</div><div class="line"></div><div class="name">........................</div></div></div>';
    return `<div class="signatures">${sigs.map(s => `<div class="signature-item"><div class="title">${esc(s.title || '')}</div><div class="line"></div><div class="name">${esc(s.name || '........................')}</div></div>`).join('')}</div>`;
  }
  function headerFor(centerKey) {
    try { if (typeof window.getHeaderForCenter === 'function') return window.getHeaderForCenter(centerKey); } catch (_) {}
    return { logoSrc: 'moh_logo.png', h1: 'فرع وزارة الصحة بمنطقة نجران', h3: 'المكاتب الإدارية' };
  }
  function performanceDeduction(centerKey) {
    try { if (typeof window.calculateAdminOfficePerformanceSummary === 'function') window.calculateAdminOfficePerformanceSummary(centerKey); } catch (_) {}
    const a = readJson('adminOfficePerformanceDeductions_v1', {}), b = readJson('performanceDeductions', {});
    return number(a[centerKey] !== undefined ? a[centerKey] : b[centerKey]);
  }
  function performanceCertPage(centerKey) {
    const names = getNames();
    const p = getPeriod();
    const h = headerFor(centerKey);
    return `<section class="admin-performance-cert-page"><div class="admin-performance-cert-box"><div class="head"><img src="${esc(h.logoSrc || 'moh_logo.png')}"><div><strong>${esc(h.h1 || '')}</strong></div><div>${esc(h.h3 || '')}</div></div><h1>شهادة الأداء الشهري لأعمال النظافة والصيانة والتشغيل غير الطبي</h1><div class="meta">لموقع: <strong>${esc(names[centerKey] || centerKey)}</strong><br>عن دفعة رقم (${esc(paymentNo())}) من ${esc(dateText(p.startDate))} م إلى ${esc(dateText(p.endDate))} م</div><table><thead><tr><th>القسم</th><th>إجمالي مبلغ الحسميات</th></tr></thead><tbody><tr><td>أداء الصيانة</td><td>${sar(performanceDeduction(centerKey))}</td></tr></tbody></table>${signatureBlock('performance', centerKey)}</div></section>`;
  }
  function openPlainPerformanceCertificate() {
    const keys = Object.keys(getNames()).filter(k => k === 'admin_staff' || /^center_\d+$/.test(k));
    const selected = keys.length ? keys : Object.keys(getData());
    if (!selected.length) return alert('لا توجد مواقع متاحة لإصدار شهادة الأداء.');
    const win = window.open('', '_blank', 'width=1000,height=900');
    if (!win) return alert('المتصفح منع نافذة الطباعة. اسمح بالنوافذ المنبثقة.');
    const pages = selected.map(performanceCertPage).join('');
    win.document.open();
    win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>شهادة الأداء الشهري</title><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet"></head><body>${pages}</body></html>`);
    win.document.close();
    injectPerformanceFitCss(win);
    setTimeout(() => { try { win.focus(); win.print(); } catch (_) {} }, 500);
  }
  function patchExtraDocsPerformanceCertificate() {
    const api = window.AdminOfficesExtraDocs;
    if (!api || api.__performanceCertificatePlainPatchedV2) return false;
    api.generateMonthlyPerformanceCertificates = openPlainPerformanceCertificate;
    api.__performanceCertificatePlainPatchedV2 = true;
    return true;
  }

  function boot() {
    patchPerSitePrintNames();
    patchPrintSelectedCss();
    patchExtraDocsPerformanceCertificate();
    installSitePrintButton();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  let tries = 0;
  const timer = setInterval(function () { tries++; boot(); if (tries >= 60) clearInterval(timer); }, 250);
  document.addEventListener('click', function () { setTimeout(boot, 80); setTimeout(boot, 350); setTimeout(boot, 900); }, true);

  window.AdminOfficesSitePrintPerformanceFit = {
    printCurrentSiteBundle: () => printOneCenterLikeMain(currentCenterKey(), { attendance: true, performance: true, achievement: true }),
    printCurrentAttendance: () => printOneCenterLikeMain(currentCenterKey(), { attendance: true, performance: true, achievement: true }),
    printOneCenterLikeMain,
    printPerformanceCertificates: openPlainPerformanceCertificate,
    fitPrintCss: injectPerformanceFitCss
  };
  console.info('[Admin Offices Site Print + Performance Fit] installed v2 — site prints attendance + performance + achievement only');
})();