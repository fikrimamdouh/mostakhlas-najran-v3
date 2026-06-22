// ===================================================================
// Admin Offices Print All Complete Patch
// Scope: admin_offices_attendance.html only
// يضمن أن طباعة الكل تشمل: الحضور + الأداء + الإنجاز + الشهادة الإجمالية + خطابات الرفع
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;

  const ABSENCE_FINES = {
    1: { saudi: 500, non_saudi: 500 },
    2: { saudi: 500, non_saudi: 500 },
    3: { saudi: 250, non_saudi: 100 },
    4: { saudi: 180, non_saudi: 80 },
    5: { saudi: 150, non_saudi: 80 },
    6: { saudi: 20, non_saudi: 20 },
    7: { saudi: 10, non_saudi: 10 },
    default: { saudi: 0, non_saudi: 0 }
  };

  function readJson(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }
  function esc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function num(v) { const n = Number(String(v ?? '').replace(/,/g, '')); return isNaN(n) ? 0 : n; }
  function money(v) { return num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function fmtDate(v) { if (!v) return 'غير محدد'; try { return new Date(v).toLocaleDateString('en-CA'); } catch (_) { return 'غير محدد'; } }
  function getNames() { try { if (typeof getCenterNames === 'function') return getCenterNames() || {}; } catch (_) {} return readJson('adminOfficeNames_v1', {}); }
  function getData() { try { if (typeof getAttendanceData === 'function') return getAttendanceData() || {}; } catch (_) {} return readJson('adminOfficesAttendanceData_v1', {}); }
  function getContract() { return readJson('persistentContractData', {}); }
  function getExtract() { return readJson('persistentExtractData', {}); }
  function getHeader() { try { if (typeof getHeaderForCenter === 'function') return getHeaderForCenter(orderedKeys()[0]); } catch (_) {} return { logoSrc: 'najran_health_cluster_logo.png', h1: 'فرع وزارة الصحة بمنطقة نجران', h3: 'المكاتب الإدارية والمرافق الصحية' }; }
  function getPeriod() {
    try { if (typeof getExtractPeriodDetails === 'function') return getExtractPeriodDetails(); } catch (_) {}
    const e = getExtract();
    const start = new Date(e.extractStart || new Date());
    const end = new Date(e.extractEnd || e.extractStart || new Date());
    return { startDate: start, daysInExtract: Math.max(1, Math.ceil((end - start) / 86400000) + 1 || 30), totalDaysInMonth: new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate() || 30 };
  }
  function orderedKeys() {
    const names = getNames();
    const data = getData();
    return Array.from(new Set([...Object.keys(names || {}), ...Object.keys(data || {})]))
      .filter(k => k && (k === 'admin_staff' || /^center_\d+$/.test(k) || Array.isArray(data[k])))
      .sort((a, b) => {
        if (/^center_\d+$/.test(a) && /^center_\d+$/.test(b)) return parseInt(a.split('_')[1], 10) - parseInt(b.split('_')[1], 10);
        if (/^center_\d+$/.test(a)) return -1;
        if (/^center_\d+$/.test(b)) return 1;
        if (a === 'admin_staff') return 1;
        if (b === 'admin_staff') return -1;
        return String(a).localeCompare(String(b), 'ar');
      });
  }
  function isSaudi(v) { return String(v || '').replace(/\s+/g, '').includes('سعودي'); }
  function fineConfig(cat) { return ABSENCE_FINES[cat] || ABSENCE_FINES[String(cat)] || ABSENCE_FINES.default; }
  function performanceDeductions() { return Object.assign({}, readJson('performanceDeductions', {}), readJson('adminOfficePerformanceDeductions_v1', {})); }
  function calcSite(centerKey) {
    const rows = getData()[centerKey] || [];
    const period = getPeriod();
    const contract = getContract();
    const ratio = num(contract.directPurchaseRatio);
    const out = { count: rows.length, cost: 0, absenceDeduction: 0, absenceFine: 0, nationalityFine: 0, fines: 0, laborNet: 0 };
    rows.forEach(emp => {
      const salary = num(emp.salary);
      const daily = period.totalDaysInMonth > 0 ? salary / period.totalDaysInMonth : 0;
      const days = Array.isArray(emp.days) ? emp.days.slice(0, period.daysInExtract) : [];
      while (days.length < period.daysInExtract) days.push('ح');
      let cost = daily * period.daysInExtract;
      if (contract.contractType === 'شراء مباشر' && ratio > 0) cost += cost * ratio / 100;
      const absDays = days.filter(d => d === 'غ').length;
      const absDed = absDays * daily;
      const cfg = fineConfig(emp.category || 1);
      const absFine = absDays * (isSaudi(emp.nationality) ? cfg.saudi : cfg.non_saudi);
      const natFine = num(emp.nationalityFine);
      const fines = absFine + natFine;
      out.cost += cost;
      out.absenceDeduction += absDed;
      out.absenceFine += absFine;
      out.nationalityFine += natFine;
      out.fines += fines;
      out.laborNet += cost - absDed - fines;
    });
    return out;
  }

  function grandCertificateCss() {
    return `<style id="admin-grand-cert-print-all-css">
      @page admin-grand-cert-page{size:A4 landscape;margin:8mm}
      .admin-grand-cert-page{page:admin-grand-cert-page!important;direction:rtl;font-family:Tajawal,Arial,sans-serif;color:#0f172a;background:#fff;page-break-after:always;}
      .admin-grand-cert-page *{box-sizing:border-box}.admin-grand-cert-page .cert{width:100%;padding:0}.admin-grand-cert-page .head{position:relative;text-align:center;border-bottom:4px solid #003087;padding:8px 110px 14px;margin-bottom:12px}.admin-grand-cert-page .head img{position:absolute;top:4px;width:78px;height:auto}.admin-grand-cert-page .head .r{right:12px}.admin-grand-cert-page .head .l{left:12px}.admin-grand-cert-page .head h1{margin:0;color:#003087;font-size:23px;font-weight:900}.admin-grand-cert-page .head h2{margin:6px 0 3px;font-size:21px;color:#111827}.admin-grand-cert-page .head h3{margin:0;font-size:14px;color:#475569}.admin-grand-cert-page .info{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0}.admin-grand-cert-page .info div{border:1px solid #bfdbfe;background:#eff6ff;border-radius:10px;padding:8px;font-weight:800;font-size:12px}.admin-grand-cert-page .info b{color:#003087}.admin-grand-cert-page .cards{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:10px 0}.admin-grand-cert-page .card{background:#003087;color:#fff;border-radius:12px;padding:10px;text-align:center}.admin-grand-cert-page .card.gold{background:#d4af37;color:#111827}.admin-grand-cert-page .card span{display:block;font-size:11px}.admin-grand-cert-page .card strong{display:block;font-size:17px;margin-top:4px}.admin-grand-cert-page table{width:100%;border-collapse:collapse;font-size:10.5px;background:#fff;margin-top:10px}.admin-grand-cert-page th{background:#003087;color:#fff;border:1px solid #1e3a8a;padding:5px}.admin-grand-cert-page td{border:1px solid #cbd5e1;padding:5px;text-align:center}.admin-grand-cert-page td.site{text-align:right;font-weight:800}.admin-grand-cert-page tbody tr:nth-child(even) td{background:#f8fafc}.admin-grand-cert-page tfoot th{background:#d4af37;color:#111827;border:1px solid #b08921;padding:6px}.admin-grand-cert-page .grand-sign{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;text-align:center;margin-top:20px}.admin-grand-cert-page .line{height:36px;border-bottom:1px solid #111;margin:6px 25px 0}
    </style>`;
  }

  function buildGrandCertificateHtml() {
    const names = getNames();
    const contract = getContract();
    const extract = getExtract();
    const header = getHeader();
    const perf = performanceDeductions();
    const keys = orderedKeys();
    const total = { count:0, cost:0, absenceDeduction:0, absenceFine:0, nationalityFine:0, fines:0, laborNet:0, perf:0, finalNet:0 };
    const rows = keys.map((key, i) => {
      const c = calcSite(key);
      const p = num(perf[key]);
      const finalNet = c.laborNet - p;
      total.count += c.count; total.cost += c.cost; total.absenceDeduction += c.absenceDeduction; total.absenceFine += c.absenceFine; total.nationalityFine += c.nationalityFine; total.fines += c.fines; total.laborNet += c.laborNet; total.perf += p; total.finalNet += finalNet;
      const name = names[key] || (key === 'admin_staff' ? 'الورش (صيانة وإصلاح السيارات)' : key);
      return `<tr><td>${i + 1}</td><td class="site">${esc(name)}</td><td>${c.count}</td><td>${money(c.cost)}</td><td>${money(c.absenceDeduction)}</td><td>${money(c.absenceFine)}</td><td>${money(c.nationalityFine)}</td><td>${money(c.fines)}</td><td>${money(c.laborNet)}</td><td>${money(p)}</td><td><b>${money(finalNet)}</b></td></tr>`;
    }).join('');
    return `<div class="page-container admin-grand-cert-page"><main class="cert"><section class="head"><img class="r" src="${esc(header.logoSrc || 'najran_health_cluster_logo.png')}"><img class="l" src="${esc(header.logoSrc || 'najran_health_cluster_logo.png')}"><h1>${esc(header.h1 || 'فرع وزارة الصحة بمنطقة نجران')}</h1><h2>الشهادة الإجمالية للمكاتب الإدارية والمرافق الصحية</h2><h3>مستخلص العمالة لجميع المواقع والورش</h3></section><section class="info"><div><b>الشركة:</b> ${esc(contract.companyName || document.querySelector('.companyName')?.textContent || 'غير محدد')}</div><div><b>نوع العقد:</b> ${esc(contract.contractType || 'غير محدد')}</div><div><b>الفترة:</b> من ${esc(fmtDate(extract.extractStart))} إلى ${esc(fmtDate(extract.extractEnd))}</div><div><b>عدد المواقع:</b> ${keys.length}</div></section><section class="cards"><div class="card"><span>إجمالي العمالة</span><strong>${total.count}</strong></div><div class="card"><span>إجمالي التكلفة</span><strong>${money(total.cost)}</strong></div><div class="card"><span>غرامات وحسميات العمالة</span><strong>${money(total.absenceDeduction + total.fines)}</strong></div><div class="card"><span>خصم الأداء</span><strong>${money(total.perf)}</strong></div><div class="card gold"><span>الصافي النهائي</span><strong>${money(total.finalNet)}</strong></div></section><table><thead><tr><th>م</th><th>الموقع</th><th>العمالة</th><th>التكلفة</th><th>حسم الغياب</th><th>غرامة الغياب</th><th>غرامة الجنسية</th><th>إجمالي الغرامات</th><th>صافي العمالة</th><th>خصم الأداء</th><th>الصافي النهائي</th></tr></thead><tbody>${rows || '<tr><td colspan="11">لا توجد بيانات للمكاتب.</td></tr>'}</tbody><tfoot><tr><th colspan="2">الإجمالي</th><th>${total.count}</th><th>${money(total.cost)}</th><th>${money(total.absenceDeduction)}</th><th>${money(total.absenceFine)}</th><th>${money(total.nationalityFine)}</th><th>${money(total.fines)}</th><th>${money(total.laborNet)}</th><th>${money(total.perf)}</th><th>${money(total.finalNet)}</th></tr></tfoot></table><section class="grand-sign"><div><b>إعداد</b><div class="line"></div></div><div><b>مراجعة</b><div class="line"></div></div><div><b>اعتماد</b><div class="line"></div></div></section></main></div>`;
  }

  function patchPrintDialog() {
    if (typeof window.openPrintDialog !== 'function' || window.openPrintDialog.__completePrintAllPatched) return false;
    const old = window.openPrintDialog;
    window.openPrintDialog = function completeOpenPrintDialog() {
      const result = old.apply(this, arguments);
      setTimeout(() => {
        ['print-opt-attendance','print-opt-performance','print-opt-achievement','print-opt-raise-saudization','print-opt-raise-labor','print-opt-raise-consumables','print-opt-raise-declaration'].forEach(id => {
          const el = document.getElementById(id); if (el) el.checked = true;
        });
        const body = document.querySelector('#management-dialog .dialog-body');
        if (body && !document.getElementById('print-opt-grand-certificate')) {
          body.insertAdjacentHTML('beforeend', `<fieldset><legend>4. الشهادة الإجمالية</legend><div class="checkbox-grid"><div class="form-group-checkbox"><input type="checkbox" id="print-opt-grand-certificate" checked><label for="print-opt-grand-certificate">الشهادة الإجمالية للمكاتب الإدارية والمرافق الصحية</label></div></div></fieldset>`);
        }
      }, 120);
      return result;
    };
    window.openPrintDialog.__completePrintAllPatched = true;
    return true;
  }

  function patchPrintSelected() {
    if (typeof window.printSelected !== 'function' || window.printSelected.__completePrintAllPatched) return false;
    const old = window.printSelected;
    window.printSelected = function completePrintSelected() {
      ['print-opt-attendance','print-opt-performance','print-opt-achievement','print-opt-raise-saudization','print-opt-raise-labor','print-opt-raise-consumables','print-opt-raise-declaration','print-opt-grand-certificate'].forEach(id => {
        const el = document.getElementById(id); if (el) el.checked = true;
      });
      const includeGrand = !document.getElementById('print-opt-grand-certificate') || document.getElementById('print-opt-grand-certificate').checked;
      let capturedWin = null;
      const realOpen = window.open;
      window.open = function () { capturedWin = realOpen.apply(window, arguments); return capturedWin; };
      const result = old.apply(this, arguments);
      window.open = realOpen;
      if (capturedWin && capturedWin.document && includeGrand) {
        setTimeout(() => {
          const prevOnload = capturedWin.onload;
          capturedWin.onload = function () {
            try {
              if (!capturedWin.document.getElementById('admin-grand-cert-print-all-css')) capturedWin.document.head.insertAdjacentHTML('beforeend', grandCertificateCss());
              capturedWin.document.body.insertAdjacentHTML('beforeend', buildGrandCertificateHtml());
            } catch (e) { console.error('[CompletePrintAll] grand certificate append failed', e); }
            if (typeof prevOnload === 'function') return prevOnload.call(capturedWin);
            capturedWin.focus(); capturedWin.print(); capturedWin.close();
          };
        }, 0);
      }
      return result;
    };
    window.printSelected.__completePrintAllPatched = true;
    return true;
  }

  function boot(attempt) {
    patchPrintDialog();
    patchPrintSelected();
    if (attempt < 40 && (!window.openPrintDialog?.__completePrintAllPatched || !window.printSelected?.__completePrintAllPatched)) setTimeout(() => boot(attempt + 1), 250);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot(0)); else boot(0);
  console.info('[Admin Offices Complete Print All] installed');
})();
