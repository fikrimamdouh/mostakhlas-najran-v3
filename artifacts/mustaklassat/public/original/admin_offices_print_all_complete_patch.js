// ===================================================================
// Admin Offices Lightweight Consolidated Print Flow — V11
// - نافذة طباعة مستقلة لا تحذف management-dialog الأصلي.
// - الحضور: مقاس 96% مع إبقاء التوقيع في نفس صفحة الحضور قدر الإمكان.
// - إصلاح عدم فتح الطباعة مرة ثانية بعد الإغلاق.
// - لا يغير الحسابات أو مفاتيح الحفظ.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_PRINT_ALL_LIGHT_V11__) return;
  window.__ADMIN_OFFICES_PRINT_ALL_LIGHT_V11__ = true;

  let isPrinting = false;
  const DIALOG_ID = 'admin-offices-print-dialog-v11';

  const readJson = (k, fb) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : fb; } catch (_) { return fb; } };
  const esc = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const num = v => { const n = Number(String(v ?? '').replace(/,/g,'').replace(/[ ريال﷼]/g,'')); return Number.isFinite(n) ? n : 0; };
  const money = v => num(v).toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDate = v => { try { return v ? new Date(v).toLocaleDateString('en-CA') : 'غير محدد'; } catch (_) { return 'غير محدد'; } };

  function names() { try { if (typeof getCenterNames === 'function') return getCenterNames() || {}; } catch (_) {} return readJson('adminOfficeNames_v1', {}); }
  function data() { try { if (typeof getAttendanceData === 'function') return getAttendanceData() || {}; } catch (_) {} return readJson('adminOfficesAttendanceData_v1', {}); }
  const extract = () => readJson('persistentExtractData', {});
  const contract = () => readJson('persistentContractData', {});

  function period() {
    try { if (typeof getExtractPeriodDetails === 'function') return getExtractPeriodDetails() || {}; } catch (_) {}
    const e = extract(), s = new Date(e.extractStart || Date.now()), n = new Date(e.extractEnd || e.extractStart || Date.now());
    return { startDate:s, daysInExtract:Math.max(1, Math.ceil((n-s)/86400000)+1 || 30), totalDaysInMonth:new Date(s.getFullYear(), s.getMonth()+1, 0).getDate() || 30 };
  }
  function monthName() { try { return new Date(extract().extractStart || Date.now()).toLocaleString('ar-SA-u-nu-latn-ca-gregory', { month:'long', year:'numeric' }); } catch (_) { return ''; } }

  function currentKey() {
    const visible = Array.from(document.querySelectorAll('[id^="table-div-"]')).find(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
    if (visible?.id) return visible.id.replace('table-div-', '');
    const active = document.querySelector('.tab-link.active[data-center-key]');
    if (active?.dataset?.centerKey) return active.dataset.centerKey;
    const title = (document.getElementById('center-main-title')?.textContent || '').trim();
    const ns = names();
    return Object.keys(ns).find(k => ns[k] && title.includes(ns[k])) || Object.keys(ns)[0] || '';
  }

  function headerData(key) {
    let h = { logoSrc:'moh_logo.png', h1:'فرع وزارة الصحة بمنطقة نجران', h3:'المكاتب الإدارية' };
    try { if (typeof getHeaderForCenter === 'function') h = getHeaderForCenter(key) || h; } catch (_) {}
    return h;
  }
  function headerHtml(key, tableMode) {
    const h = headerData(key);
    if (tableMode) return `<table class="header-table"><tr><td><img class="logo" src="${esc(h.logoSrc)}"></td><td class="title-box"><h1>${esc(h.h1)}</h1><h2>${esc(h.h3)}</h2></td><td><img class="logo" src="${esc(h.logoSrc)}"></td></tr></table>`;
    return `<div class="printable-header"><img src="${esc(h.logoSrc)}" class="logo"><div class="header-text"><h1>${esc(h.h1)}</h1><h3>${esc(h.h3)}</h3><h2>مستخلص العمالة للمكاتب الإدارية والمرافق الصحية</h2></div><img src="${esc(h.logoSrc)}" class="logo"></div>`;
  }

  function scopedSignatures(type, key) {
    try {
      let sigKey = type;
      if (typeof getSignatureKeyForContext === 'function') sigKey = getSignatureKeyForContext(type, key);
      let sigs = typeof getSignatures === 'function' ? (getSignatures(sigKey) || []) : [];
      if (!sigs.length && sigKey !== type && typeof getSignatures === 'function') sigs = getSignatures(type) || [];
      return Array.isArray(sigs) ? sigs : [];
    } catch (_) { return []; }
  }
  function signaturesHtml(type, key, compact) {
    let sigs = scopedSignatures(type, key);
    if (!sigs.length) sigs = [{title:'مدير المشروع', name:''}, {title:'ممثل الجهة', name:''}, {title:'مندوب المقاول', name:''}];
    return `<div class="${compact ? 'signatures-grid' : 'signatures'}">${sigs.map(s => `<div class="${compact ? 'signature-item' : 'sign-box'}"><div class="title">${esc(s.title || '')}</div><div class="line"></div><div class="name">${esc(s.name || '................')}</div></div>`).join('')}</div>`;
  }

  function calcEmp(emp, p) {
    try { if (typeof calculateAdminOfficeEmployeeFinancials === 'function') return calculateAdminOfficeEmployeeFinancials(emp, { totalDaysInMonth:p.totalDaysInMonth, daysInExtract:p.daysInExtract, contractType:contract().contractType || 'عقد أساسي', directPurchaseRatio:num(contract().directPurchaseRatio) }); } catch (_) {}
    const salary = num(emp.salary), daily = p.totalDaysInMonth ? salary / p.totalDaysInMonth : 0;
    const days = Array.isArray(emp.days) ? emp.days.slice(0, p.daysInExtract) : Array(p.daysInExtract).fill('ح');
    while (days.length < p.daysInExtract) days.push('ح');
    const abs = days.filter(d => d === 'غ').length, cost = daily * p.daysInExtract, deduction = abs * daily;
    return { days, attendanceDays:p.daysInExtract-abs, absenceDays:abs, costForPeriod:cost, deduction, absenceFine:0, nationalityFine:num(emp.nationalityFine), netSalary:cost-deduction-num(emp.nationalityFine) };
  }
  function totals(key) {
    const p = period();
    return (data()[key] || []).reduce((t, emp) => { const r = calcEmp(emp, p); t.monthly += num(r.costForPeriod); t.ded += num(r.deduction); t.absFine += num(r.absenceFine); t.natFine += num(r.nationalityFine); return t; }, { monthly:0, ded:0, absFine:0, natFine:0 });
  }
  function netAfterPerformance(key) {
    const t = totals(key);
    const perf = num(readJson('performanceDeductions', {})[key] || readJson('adminOfficePerformanceDeductions_v1', {})[key] || 0);
    return t.monthly - t.ded - t.absFine - t.natFine - perf;
  }

  function freezeFormControls(root) {
    root.querySelectorAll('select').forEach(sel => {
      const span = document.createElement('span');
      span.className = 'print-cell-value';
      span.textContent = sel.options[sel.selectedIndex]?.text || sel.value || '';
      sel.replaceWith(span);
    });
    root.querySelectorAll('input').forEach(inp => {
      const span = document.createElement('span');
      span.className = 'print-cell-value';
      span.textContent = inp.type === 'checkbox' ? (inp.checked ? '✓' : '') : (inp.value || '');
      inp.replaceWith(span);
    });
    root.querySelectorAll('textarea').forEach(t => {
      const span = document.createElement('span');
      span.className = 'print-cell-value';
      span.textContent = t.value || '';
      t.replaceWith(span);
    });
  }

  function cloneAttendance(key) {
    const existing = document.getElementById('table-div-' + key);
    if (!existing) return '';
    const clone = existing.cloneNode(true);
    freezeFormControls(clone);
    clone.querySelectorAll('.tab-action-buttons,.no-print,button').forEach(el => el.remove());
    clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
    const sigContainer = clone.querySelector('.signatures-display-section') || clone.querySelector('#attendance-signatures-' + CSS.escape(key));
    if (sigContainer) sigContainer.innerHTML = signaturesHtml('attendance', key, true);
    else clone.insertAdjacentHTML('beforeend', signaturesHtml('attendance', key, true));
    return clone.outerHTML;
  }

  function fallbackAttendance(key) {
    const p = period(), e = extract(), ns = names(), rows = data()[key] || [], site = ns[key] || key, c = contract();
    const dayHead = Array.from({length:p.daysInExtract}, (_, i) => `<th class="day-col">${i+1}</th>`).join('');
    const body = rows.map((emp, i) => { const r = calcEmp(emp, p); return `<tr><td>${i+1}</td><td class="job-title">${esc(emp.jobTitle || emp.position || '')}</td><td>${esc(emp.category || '')}</td><td class="employee-name">${esc(emp.name || '')}</td>${r.days.map(d => `<td class="day-col">${esc(d)}</td>`).join('')}<td>${money(r.costForPeriod)}</td><td>${r.attendanceDays}</td><td>${r.absenceDays}</td><td>${money(r.deduction)}</td><td>${money(r.absenceFine)}</td><td>${money(r.netSalary)}</td><td>${esc(emp.nationality || '')}</td><td>${money(r.nationalityFine)}</td><td>${esc(emp.iqamaId || emp.idNumber || '')}</td></tr>`; }).join('') || `<tr><td colspan="${14+p.daysInExtract}">لا توجد بيانات</td></tr>`;
    return `<div class="department-table"><div class="extract-details-v2"><div>بيان بالحضور والغياب لمنسوبي شركة (${esc(c.companyName || 'الشركة')}) بموقع ${esc(site)}</div><div>الفترة (${fmtDate(e.extractStart)}م - ${fmtDate(e.extractEnd)}م)</div></div><div class="table-summary-v2"><div class="summary-item">عدد الموظفين: ${rows.length}</div></div><div class="table-responsive-wrapper"><table><thead><tr><th rowspan="2">م</th><th rowspan="2" class="job-title">مسمى الوظيفة</th><th rowspan="2">الفئة</th><th rowspan="2" class="employee-name">اسم شاغل الوظيفة</th><th colspan="${p.daysInExtract}">الأيام</th><th rowspan="2">التكلفة</th><th colspan="2">الأيام</th><th colspan="2">الحسم والغرامة</th><th rowspan="2">الصافي</th><th rowspan="2">الجنسية</th><th rowspan="2">غرامة جنسية</th><th rowspan="2">الإقامة</th></tr><tr>${dayHead}<th>حضور</th><th>غياب</th><th>الحسم</th><th>الغرامة</th></tr></thead><tbody>${body}</tbody></table></div>${signaturesHtml('attendance', key, true)}</div>`;
  }
  function attendancePage(key) {
    const info = document.querySelector('.page-contract-info-v2,.page-contract-info');
    return `<section class="page-container landscape-page"><div class="attendance-report">${headerHtml(key, false)}${info ? info.outerHTML : ''}${cloneAttendance(key) || fallbackAttendance(key)}</div></section>`;
  }

  function perfItems(key) { try { if (typeof getAdminOfficePerformanceItems === 'function') return getAdminOfficePerformanceItems(key) || []; } catch (_) {} return [{text:'الالتزام بتنفيذ الأعمال طبقاً للعقد', max:100, score:100}]; }
  function perfScore(key, item, i) { const scores = readJson('adminOfficePerformanceScores_v1', {}); const max = num(item.max); const raw = scores[key] && scores[key][i] !== undefined ? num(scores[key][i]) : (item.score !== undefined ? num(item.score) : max); return Math.max(0, Math.min(raw, max)); }
  function performanceDeductionPercentage(pct) { if (pct < 60) return 15; if (pct < 65) return 10; if (pct < 70) return 8; if (pct < 75) return 6; if (pct < 80) return 4; if (pct < 85) return 2; return 0; }
  function performancePage(key) {
    const ns = names(), site = ns[key] || key, items = perfItems(key); let maxTotal=0, scoreTotal=0;
    const rows = items.map((it, i) => { const max=num(it.max), score=perfScore(key,it,i); maxTotal += max; scoreTotal += score; const text = it.section ? `${it.section} - ${it.sub || it.text || ''}` : (it.text || it.sub || it.name || ''); return `<tr><td>${i+1}</td><td class="item-text">${esc(text)}</td><td>${max}</td><td>${score}</td></tr>`; }).join('');
    const pct = maxTotal ? (scoreTotal/maxTotal*100) : 100, dedPct = performanceDeductionPercentage(pct), centerCost = totals(key).monthly, dedAmount = centerCost * dedPct / 100;
    return `<section class="page-container portrait-page-perf"><div class="performance-report">${headerHtml(key,true)}<div class="cert-title">جدول تقييم مستوى الأداء والإنجاز</div><div class="sub-title">لموقع: ${esc(site)} - عن شهر ${esc(monthName())}</div><div class="cost-bar">إجمالي المبلغ لأنشطة القسم: ${money(centerCost)} ريال</div><table><thead><tr><th>م</th><th style="width:65%">أنشطة القسم</th><th>الدرجة القصوى</th><th>التقدير</th></tr></thead><tbody>${rows}<tr class="total-row"><td colspan="2">المجموع</td><td>${maxTotal}</td><td>${scoreTotal}</td></tr></tbody></table><div class="summary"><p>التقدير الذي حصل عليه المقاول: <b>${pct.toFixed(2)}%</b>، نسبة الحسم: <b>${dedPct}%</b>، ويساوي: <b>${money(dedAmount)} ريال</b></p></div>${signaturesHtml('performance',key,false)}</div></section>`;
  }

  function achievementPage(key) {
    const ns = names(), site = ns[key] || key, t = totals(key), perf = num(readJson('performanceDeductions', {})[key] || readJson('adminOfficePerformanceDeductions_v1', {})[key] || 0), net = t.monthly - t.ded - t.absFine - t.natFine - perf;
    return `<section class="page-container portrait-page-ach"><div class="achievement-report">${headerHtml(key,true)}<div class="certificate-header"><h2>شهادة الإنجاز</h2><h3>لموقع: ${esc(site)} - عن شهر ${esc(monthName())}</h3></div><table><thead><tr><th>البند</th><th>القيمة الشهرية</th><th>حسم الغياب</th><th>غرامة الغياب</th><th>غرامة الأداء</th><th>غرامة الجنسية</th><th>الصافي</th></tr></thead><tbody><tr><td>العمالة</td><td>${money(t.monthly)}</td><td>${money(t.ded)}</td><td>${money(t.absFine)}</td><td>${money(perf)}</td><td>${money(t.natFine)}</td><td>${money(net)}</td></tr></tbody></table>${signaturesHtml('achievement',key,false)}</div></section>`;
  }
  function siteLetterPage(key) {
    const ns = names(), site = ns[key] || key, net = netAfterPerformance(key);
    if (window.AdminOfficePrintLetters && typeof window.AdminOfficePrintLetters.buildSiteRaiseLetterForSite === 'function') return window.AdminOfficePrintLetters.buildSiteRaiseLetterForSite({ key, siteName: site, netAmount: net });
    return `<section class="page-container portrait-page-ach"><div class="raise-letter-page-simple">${headerHtml(key,true)}<h2>خطاب رفع مستخلص الموقع</h2><p>نرفق لسعادتكم مستخلص موقع <b>${esc(site)}</b>.</p><table><tr><td>صافي مستحقات الموقع</td><td>${money(net)}</td></tr></table>${signaturesHtml('raise_letters',key,false)}</div></section>`;
  }

  function printCss() { return `<style>@page{size:A4}@page landscape-orientation{size:A4 landscape;margin:.15cm}@page portrait-orientation-perf{size:A4 portrait;margin:.7cm}@page portrait-orientation-ach{size:A4 portrait;margin:.8in}body{font-family:Tajawal,Arial,sans-serif;direction:rtl;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;margin:0}.page-container{page-break-after:always}.landscape-page{page:landscape-orientation;width:104.2%!important;max-width:none!important;transform:scale(.96);transform-origin:top right;margin-right:0!important;margin-left:auto!important;direction:rtl;break-inside:avoid;page-break-inside:avoid}.portrait-page-perf{page:portrait-orientation-perf}.portrait-page-ach{page:portrait-orientation-ach}.printable-header{display:flex;justify-content:space-between;align-items:center;padding-bottom:2px;margin-bottom:2px;border-bottom:1px solid #ccc}.printable-header .logo{width:38px}.printable-header .header-text{text-align:center;flex-grow:1}.printable-header h1,.printable-header h2,.printable-header h3{margin:1px 0;font-size:8pt}.header-table{width:100%;border-bottom:2px solid #0056b3;margin-bottom:15px}.header-table td{vertical-align:middle;text-align:center}.header-table .logo{width:75px}.header-table .title-box{text-align:center}.header-table .title-box h1,.header-table .title-box h2{margin:2px}.attendance-report{width:100%!important;break-inside:avoid;page-break-inside:avoid}.attendance-report .extract-details-v2{font-size:8pt;padding:3px;background:linear-gradient(145deg,#003087,#0056b3)!important;color:#fff!important;border-radius:8px 8px 0 0;margin-bottom:-1px;display:flex;justify-content:space-between;align-items:center}.attendance-report .table-responsive-wrapper{overflow:visible!important;width:100%!important}.attendance-report table{width:100%!important;border-collapse:collapse;table-layout:auto}.attendance-report th,.attendance-report td{border:1px solid #ccc;padding:1.4px;text-align:center;font-size:6.5pt;vertical-align:middle;white-space:nowrap}.attendance-report th.job-title,.attendance-report td.job-title,.attendance-report th.employee-name,.attendance-report td.employee-name{font-size:7pt;font-weight:500}.attendance-report thead th{background:#003087!important;color:#fff!important;font-size:7pt}.attendance-report .table-summary-v2{font-size:7pt;padding:3px;display:flex;flex-wrap:wrap;justify-content:center;gap:8px;border:1px solid #ccc;background:#f8f9fa;font-weight:bold}.attendance-report .signatures-grid{display:flex!important;justify-content:space-around!important;align-items:flex-start!important;margin-top:6px!important;padding-top:4px!important;border-top:1px solid #333!important;gap:10px!important;break-inside:avoid!important;page-break-inside:avoid!important}.attendance-report .signature-item{text-align:center!important;font-size:8pt!important;font-weight:800!important;min-width:140px!important;width:30%!important;break-inside:avoid!important;page-break-inside:avoid!important}.attendance-report .signature-item .title{font-weight:900!important;margin-bottom:3px!important}.attendance-report .signature-item .line{border-bottom:1px solid #000!important;min-height:18px!important;margin:6px 10px 4px!important}.attendance-report .signature-item .name{font-size:8pt!important;font-weight:800!important}.print-cell-value{display:inline-block;min-width:10px}.performance-report .cert-title{font-size:15pt;font-weight:bold;text-align:center;margin:8px 0}.performance-report .sub-title{font-size:12pt;text-align:center;margin:4px 0}.performance-report .cost-bar{background:#f2f2f2;padding:6px;border-radius:4px;text-align:center;font-size:11pt;font-weight:bold;margin:8px 0}.performance-report table{width:100%;border-collapse:collapse;font-size:9pt;table-layout:fixed}.performance-report th,.performance-report td{border:1px solid #333;padding:4px;text-align:center}.performance-report th{background:#e9ecef}.performance-report .item-text{text-align:right}.performance-report .summary{margin-top:10px;font-size:11pt;line-height:1.5}.performance-report .signatures{margin-top:25px;display:flex;justify-content:space-around;border-top:1px solid #333;padding-top:10px}.performance-report .sign-box{text-align:center;font-size:10pt;width:24%}.performance-report .sign-box .line{border-bottom:1px solid #000;margin-top:30px}.achievement-report .certificate-header{text-align:center;margin-bottom:20px}.achievement-report table,.raise-letter-page-simple table{width:100%;border-collapse:collapse;font-size:10pt;table-layout:fixed}.achievement-report th,.achievement-report td,.raise-letter-page-simple td{border:1px solid #333;padding:8px;text-align:center;vertical-align:middle}.achievement-report th{background:#e9ecef;font-weight:700}.achievement-report .signatures,.raise-letter-page-simple .signatures{margin-top:40px;display:flex;justify-content:space-around;border-top:1px solid #333;padding-top:15px}.achievement-report .sign-box,.raise-letter-page-simple .sign-box{text-align:center;font-size:11pt;width:24%}.achievement-report .sign-box .line,.raise-letter-page-simple .sign-box .line{border-bottom:1px solid #000;margin-top:45px}</style>`; }

  function dialogCss() { return `<style id="admin-offices-print-dialog-css-v11">#${DIALOG_ID}{position:fixed;inset:0;z-index:1000000;background:rgba(15,23,42,.58);display:flex;align-items:center;justify-content:center;direction:rtl;font-family:Tajawal,Arial,sans-serif}#${DIALOG_ID} .dialog-content{width:min(920px,94vw);max-height:88vh;background:#fff;border-radius:16px;box-shadow:0 25px 70px rgba(0,0,0,.25);display:flex;flex-direction:column;overflow:hidden}#${DIALOG_ID} .dialog-header{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid #e2e8f0;background:#f8fafc}#${DIALOG_ID} .dialog-header h3{margin:0;color:#003087;font-weight:900}.admin-print-close{border:0;background:#ef4444;color:#fff;border-radius:8px;padding:5px 10px;font-weight:900;cursor:pointer}#${DIALOG_ID} .dialog-body{padding:14px 18px;overflow:auto}#${DIALOG_ID} fieldset{border:1px solid #cbd5e1;border-radius:12px;margin:0 0 12px;padding:12px}#${DIALOG_ID} legend{font-weight:900;color:#003087;padding:0 8px}.checkbox-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px}.form-group-checkbox{display:flex;align-items:center;gap:8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:8px;font-weight:800}.dialog-footer{padding:12px 18px;border-top:1px solid #e2e8f0;display:flex;justify-content:flex-end;background:#f8fafc}.dialog-footer .btn{border:0;border-radius:10px;padding:10px 18px;font-weight:900;cursor:pointer}.btn-success{background:#16a34a;color:white}</style>`; }
  function closeAdminPrintDialog(){ const el = document.getElementById(DIALOG_ID); if (el) el.remove(); isPrinting = false; }
  function toggleAllPrintCenters(master) { document.querySelectorAll('#print-centers-checkboxes input[type="checkbox"]').forEach(cb => { cb.checked = master.checked; }); }
  window.closeAdminPrintDialog = closeAdminPrintDialog;
  window.toggleAllPrintCenters = toggleAllPrintCenters;
  function ensureDialogCss(){ if (!document.getElementById('admin-offices-print-dialog-css-v11')) document.head.insertAdjacentHTML('beforeend', dialogCss()); }

  function openPrintDialog() {
    closeAdminPrintDialog();
    ensureDialogCss();
    const ns = names(), cur = currentKey();
    const checks = Object.keys(ns).map(key => `<div class="form-group-checkbox"><input type="checkbox" value="${esc(key)}" id="print-${esc(key)}" ${key===cur?'checked':''}><label for="print-${esc(key)}">${esc(ns[key])}</label></div>`).join('');
    const modal = document.createElement('div');
    modal.id = DIALOG_ID;
    modal.className = 'admin-print-dialog';
    modal.innerHTML = `<div class="dialog-content"><div class="dialog-header"><h3>طباعة التقارير المجمعة</h3><button type="button" class="admin-print-close" onclick="closeAdminPrintDialog()">×</button></div><div class="dialog-body"><fieldset><legend>1. اختر المكاتب والمرافق</legend><div class="form-group-checkbox all-selector"><input type="checkbox" id="print-all-centers" onchange="toggleAllPrintCenters(this)"><label for="print-all-centers"><strong>تحديد الكل / إلغاء تحديد الكل</strong></label></div><div id="print-centers-checkboxes" class="checkbox-grid">${checks}</div></fieldset><fieldset><legend>2. اختر التقارير للطباعة</legend><div class="checkbox-grid"><div class="form-group-checkbox"><input type="checkbox" id="print-opt-attendance" checked><label for="print-opt-attendance">تقرير الحضور والانصراف</label></div><div class="form-group-checkbox"><input type="checkbox" id="print-opt-performance"><label for="print-opt-performance">شهادة تقييم الأداء</label></div><div class="form-group-checkbox"><input type="checkbox" id="print-opt-achievement"><label for="print-opt-achievement">شهادة الإنجاز</label></div><div class="form-group-checkbox"><input type="checkbox" id="print-opt-site-raise-letter"><label for="print-opt-site-raise-letter">خطاب رفع الموقع</label></div></div></fieldset></div><div class="dialog-footer"><button id="admin-print-start-btn" class="btn btn-success" onclick="printSelected()">بدء الطباعة</button></div></div>`;
    document.body.appendChild(modal);
  }

  const selectedKeys = () => Array.from(document.querySelectorAll('#print-centers-checkboxes input:checked')).map(cb => cb.value);
  const checked = id => !!document.getElementById(id)?.checked;
  function finishPrint() { isPrinting = false; const btn = document.getElementById('admin-print-start-btn'); if (btn) { btn.disabled = false; btn.textContent = 'بدء الطباعة'; } }

  function printSelected() {
    if (isPrinting) return;
    const keys = selectedKeys(), opts = { a:checked('print-opt-attendance'), p:checked('print-opt-performance'), h:checked('print-opt-achievement'), l:checked('print-opt-site-raise-letter') };
    if (!keys.length || (!opts.a && !opts.p && !opts.h && !opts.l)) return alert('اختر مكتب/مرفق وتقرير واحد على الأقل.');
    isPrinting = true;
    const btn = document.getElementById('admin-print-start-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'جاري تجهيز الطباعة...'; }

    setTimeout(() => {
      let w = null;
      try {
        closeAdminPrintDialog();
        w = window.open('', '_blank', 'width=1200,height=900');
        if (!w) throw new Error('popup-blocked');
        const doc = w.document;
        const letterCss = opts.l && window.AdminOfficePrintLetters && typeof window.AdminOfficePrintLetters.lettersCss === 'function' ? window.AdminOfficePrintLetters.lettersCss() : '';
        doc.open();
        doc.write(`<html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>طباعة التقارير</title><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">${printCss()}${letterCss}</head><body>`);
        keys.forEach(key => { if (opts.a) doc.write(attendancePage(key)); if (opts.p) doc.write(performancePage(key)); if (opts.h) doc.write(achievementPage(key)); if (opts.l) doc.write(siteLetterPage(key)); });
        doc.write('</body></html>');
        doc.close();
        const done = () => { finishPrint(); try { setTimeout(() => w && !w.closed && w.close(), 500); } catch (_) {} };
        w.onafterprint = done;
        w.onbeforeunload = finishPrint;
        setTimeout(() => { try { w.focus(); w.print(); } finally { setTimeout(done, 1200); } }, 500);
      } catch (e) {
        finishPrint();
        alert('تعذر تجهيز الطباعة. راجع Console.');
        console.error('[Admin Offices Print All] print failed', e);
      }
    }, 30);
  }

  function preparePrint() {
    const key = currentKey();
    const w = window.open('', '_blank', 'width=1200,height=900');
    if (!w) return alert('المتصفح منع فتح نافذة الطباعة.');
    w.document.open();
    w.document.write(`<html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>طباعة الحضور</title><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">${printCss()}</head><body>${attendancePage(key)}</body></html>`);
    w.document.close();
    w.onload = function(){ w.focus(); w.print(); setTimeout(() => { try { w.close(); } catch (_) {} }, 800); };
  }

  function printCurrentPerformanceOnly() {
    if (isPrinting) return;
    const key = currentKey();
    if (!key) return alert('لم يتم تحديد المكتب/المرفق الحالي.');
    isPrinting = true;
    try {
      const w = window.open('', 'admin_offices_performance_print', 'width=1000,height=900');
      if (!w) throw new Error('popup-blocked');
      const doc = w.document;
      doc.open();
      doc.write(`<html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>جدول تقييم الأداء</title><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">${printCss()}<style>@page { size: A4 portrait; margin: .7cm; } body { margin: 0; } .page-container { page-break-after: auto !important; } .portrait-page-perf { page: auto !important; } .performance-report,.performance-report table,.performance-report tr{page-break-inside:avoid!important;break-inside:avoid!important}</style></head><body>${performancePage(key)}</body></html>`);
      doc.close();
      const done = () => { isPrinting = false; try { setTimeout(() => !w.closed && w.close(), 500); } catch (_) {} };
      w.onafterprint = done;
      w.onbeforeunload = () => { isPrinting = false; };
      setTimeout(() => { try { w.focus(); w.print(); } finally { setTimeout(done, 1200); } }, 500);
    } catch (e) {
      isPrinting = false;
      alert('تعذر طباعة جدول تقييم الأداء. راجع Console.');
      console.error('[Admin Offices Performance Print] failed', e);
    }
  }

  window.openPrintDialog = openPrintDialog;
  window.printSelected = printSelected;
  window.preparePrint = preparePrint;
  window.printCurrentPerformanceOnly = printCurrentPerformanceOnly;
  console.info('[Admin Offices Print All] lightweight v11 fixed dialog + scale 96 + same-page signatures');
})();