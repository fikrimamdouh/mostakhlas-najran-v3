// ===================================================================
// Admin Offices Performance Logic - separated from health centers
// Scope: /original/admin_offices_attendance.html only
// - Admin offices center_1..center_14: HG1 table 100 / 87
// - Workshop admin_staff: fixed HG1 workshop table 100 / 90
// - Does not read or write health-center performance keys
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;

  const OFFICE_ITEMS = [
    ['مدى نظافة المباني من الداخل والخارج وكذلك الأسطح',4,4],
    ['نظافة الأفنية والممرات',4,4],
    ['مدى نظافة الأثاث',4,4],
    ['مدى نظافة دورات المياه',4,3],
    ['مدى مكافحة الحشرات والتخلص من النفايات غير الطبية',4,3],
    ['السنترال والتليفونات والفاكس',4,4],
    ['نظام إنذار الحريق',4,4],
    ['مدى صيانة شبكات الكهرباء ولوحات التوزيع واستبدال الأجزاء التالفة',4,4],
    ['مدى كفاية الإنارة وتغيير التالف من اللمبات والبرايز والمفاتيح',4,4],
    ['مدى المرور والصيانة لفريق الصيانة',4,4],
    ['مدى صيانة الأجهزة الكهربية (تليفزيون، فيديو، مراوح..... إلخ)',4,3],
    ['مدى صيانة المكيفات والثلاجات والبرادات والسخانات',4,4],
    ['مدى تنظيف خزانات المياه العلوية والسفلية',3,3],
    ['مدى تسليك مواسير الصرف الصحي وكسح المجاري',3,3],
    ['مدى إصلاح المغاسل والسيفونات والمحابس والحنفيات',4,4],
    ['مدى إصلاح الطلمبات وشبكة المياه',3,3],
    ['مدى أداء الصيانة العامة للمبنى (نجارة - دهان - بلاط)',4,3],
    ['مدى صيانة الأثاث (مكاتب - كراسي - دواليب)',4,3],
    ['مدى صيانة وتعبئة وسائل مكافحة الحريق وأجهزة كشف الدخان',4,3],
    ['مدى صيانة ماكينات التصوير وأجهزة الحاسب الآلي والطابعات',4,3],
    ['مدى الإصلاح للأجهزة المعطلة',4,3],
    ['مدى توفير قطع الغيار والمستهلكات الصيانة ومستهلكات أجهزة النسخ والطباعة النسخ والتصوير',6,4],
    ['مدى توفير مواد النظافة ومطابقتها للمواصفات',4,3],
    ['مدى توفير أدوات النظافة من (مكانس - سطول - سلات مهملات - أكياس... إلخ)',6,5],
    ['مدى ارتداء العاملين للزي الرسمي وحمل بطاقات التعريف',3,2]
  ].map(x => ({ text: x[0], max: x[1], score: x[2] }));

  const WORKSHOP_ITEMS = [
    { section:'', sub:'المغسلة', text:'المغسلة', max:6, score:5 },
    { section:'', sub:'السمكرة والبوية', text:'السمكرة والبوية', max:6, score:6 },
    { section:'', sub:'البنشر', text:'البنشر', max:6, score:6 },
    { section:'', sub:'التبريد', text:'التبريد', max:8, score:7 },
    { section:'', sub:'فحص الأعطال', text:'فحص الأعطال', max:7, score:6 },
    { section:'قسم الكهرباء', sub:'تشغيل', text:'قسم الكهرباء - تشغيل', max:10, score:9, rowspan:2 },
    { section:'', sub:'صيانة وقائية', text:'قسم الكهرباء - صيانة وقائية', max:2, score:2, groupedContinuation:true },
    { section:'قسم الميكانيكا', sub:'تشغيل', text:'قسم الميكانيكا - تشغيل', max:16, score:15, rowspan:2 },
    { section:'', sub:'صيانة وقائية', text:'قسم الميكانيكا - صيانة وقائية', max:4, score:4, groupedContinuation:true },
    { section:'', sub:'الأعمال الإدارية', text:'الأعمال الإدارية', max:7, score:6 },
    { section:'', sub:'النظافة', text:'النظافة', max:7, score:6 },
    { section:'', sub:'المخزن/المشتريات', text:'المخزن/المشتريات', max:7, score:6 },
    { section:'', sub:'هل تتم الاستجابة لتعليمات المهندس المشرف من الموقع', text:'هل تتم الاستجابة لتعليمات المهندس المشرف من الموقع', max:5, score:5 },
    { section:'', sub:'هل تتم الاستجابة السريعة لأي حالة طارئة', text:'هل تتم الاستجابة السريعة لأي حالة طارئة', max:6, score:5 },
    { section:'', sub:'هل يحمل منسوبو المقاول بطاقات التعريف ويرتدون الزي الرسمي', text:'هل يحمل منسوبو المقاول بطاقات التعريف ويرتدون الزي الرسمي', max:3, score:2 }
  ];

  const SCORE_KEY = 'adminOfficePerformanceScores_v1';
  const DEDUCTION_KEY = 'adminOfficePerformanceDeductions_v1';
  const OFFICE_ITEMS_PREFIX = 'adminOfficePerformanceItems_';
  const OFFICE_ITEMS_VERSION = 'admin_offices_hg1_20260622_v1';

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function isWorkshop(key) { return key === 'admin_staff'; }
  function readJson(key, fallback) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; } }
  function writeJson(key, value) { localStorage.setItem(key, JSON.stringify(value || {})); }
  function money(value) { return (Number(value) || 0).toLocaleString('ar-SA', { style:'currency', currency:'SAR' }); }
  function fmtDate(value) { if (!value) return 'غير محدد'; try { return new Date(value).toLocaleDateString('en-CA'); } catch (_) { return 'غير محدد'; } }
  function getNames() { try { if (typeof getCenterNames === 'function') return getCenterNames() || {}; } catch (_) {} return readJson('adminOfficeNames_v1', {}); }
  function getData() { try { if (typeof getAttendanceData === 'function') return getAttendanceData() || {}; } catch (_) {} return readJson('adminOfficesAttendanceData_v1', {}); }
  function getPeriodInfo() { return readJson('persistentExtractData', {}); }
  function getDefaultScore(item) { const max = parseInt(item.max,10) || 0; const score = item.score !== undefined ? parseInt(item.score,10) : max; return isNaN(score) ? max : Math.max(0, Math.min(score, max)); }

  function getAdminOfficePerformanceItems(centerKey) {
    if (isWorkshop(centerKey)) return clone(WORKSHOP_ITEMS);
    const storageKey = `${OFFICE_ITEMS_PREFIX}${centerKey}_v1`;
    const versionKey = `${storageKey}_version`;
    const stored = localStorage.getItem(storageKey);
    if (stored && localStorage.getItem(versionKey) === OFFICE_ITEMS_VERSION) {
      try { const parsed = JSON.parse(stored); if (Array.isArray(parsed) && parsed.length) return parsed; } catch (_) {}
    }
    const defaults = clone(OFFICE_ITEMS);
    localStorage.setItem(storageKey, JSON.stringify(defaults));
    localStorage.setItem(versionKey, OFFICE_ITEMS_VERSION);
    return defaults;
  }

  function saveAdminOfficePerformanceItems(centerKey, items) {
    if (isWorkshop(centerKey)) return;
    const storageKey = `${OFFICE_ITEMS_PREFIX}${centerKey}_v1`;
    localStorage.setItem(storageKey, JSON.stringify(items || []));
    localStorage.setItem(`${storageKey}_version`, OFFICE_ITEMS_VERSION);
  }

  function getScores() { return readJson(SCORE_KEY, {}); }
  function saveScores(scores) { writeJson(SCORE_KEY, scores); }
  function getScore(centerKey, item, index) {
    const scores = getScores();
    const raw = scores[centerKey] && scores[centerKey][index] !== undefined ? parseInt(scores[centerKey][index], 10) : getDefaultScore(item);
    const max = parseInt(item.max, 10) || 0;
    return isNaN(raw) ? getDefaultScore(item) : Math.max(0, Math.min(raw, max));
  }

  function calculateCenterTotalCost(centerKey) {
    const rows = getData()[centerKey] || [];
    const contract = readJson('persistentContractData', {});
    const ratio = Number(contract.directPurchaseRatio) || 0;
    return rows.reduce((sum, emp) => {
      let salary = Number(emp.salary) || 0;
      if (contract.contractType === 'شراء مباشر' && ratio > 0) salary += salary * ratio / 100;
      return sum + salary;
    }, 0);
  }

  function inputHtml(centerKey, item, index) {
    return `<input type="number" inputmode="numeric" lang="en" dir="ltr" class="admin-office-performance-score" style="font-family:Arial,Tahoma,sans-serif;direction:ltr;unicode-bidi:plaintext;text-align:center;width:70px;" min="0" max="${item.max}" value="${getScore(centerKey,item,index)}" data-index="${index}" oninput="saveAdminOfficePerformanceScore('${centerKey}', this)">`;
  }

  function buildOfficeRows(centerKey) {
    const items = getAdminOfficePerformanceItems(centerKey);
    let rows = '', maxTotal = 0;
    items.forEach((item, index) => {
      maxTotal += Number(item.max) || 0;
      rows += `<tr><td>${index + 1}</td><td class="item-text">${item.text}</td><td>${item.max}</td><td>${inputHtml(centerKey,item,index)}</td></tr>`;
    });
    return { rows, maxTotal };
  }

  function buildWorkshopRows(centerKey, printMode) {
    const items = getAdminOfficePerformanceItems(centerKey);
    let rows = '', maxTotal = 0;
    items.forEach((item, index) => {
      maxTotal += Number(item.max) || 0;
      const scoreCell = printMode ? getScore(centerKey,item,index) : inputHtml(centerKey,item,index);
      let cells = '';
      if (item.groupedContinuation) cells = `<td class="workshop-sub">${item.sub}</td>`;
      else if (item.section) cells = `<td class="workshop-group" rowspan="${item.rowspan || 1}">${item.section}</td><td class="workshop-sub">${item.sub}</td>`;
      else cells = `<td class="item-text" colspan="2">${item.sub || item.text}</td>`;
      rows += `<tr>${cells}<td>${item.max}</td><td>${scoreCell}</td></tr>`;
    });
    return { rows, maxTotal };
  }

  function buildTable(centerKey) {
    if (isWorkshop(centerKey)) {
      const b = buildWorkshopRows(centerKey, false);
      return `<table class="performance-table admin-office-performance-table workshop-performance-table"><thead><tr><th colspan="2">أنشطة القسم</th><th>الدرجة القصوى</th><th>التقدير</th></tr></thead><tbody>${b.rows}<tr class="total-row"><td colspan="2">المجمــــــــــــــــوع</td><td id="admin-perf-max-${centerKey}">${b.maxTotal}</td><td id="admin-perf-score-${centerKey}">0</td></tr></tbody></table>`;
    }
    const b = buildOfficeRows(centerKey);
    return `<table class="performance-table admin-office-performance-table"><thead><tr><th>م</th><th>أنشطة القسم</th><th>الدرجة القصوى</th><th>التقدير</th></tr></thead><tbody>${b.rows}<tr class="total-row"><td colspan="2">المجمــــــــــــــــوع</td><td id="admin-perf-max-${centerKey}">${b.maxTotal}</td><td id="admin-perf-score-${centerKey}">0</td></tr></tbody></table>`;
  }

  function calculateAdminOfficePerformanceSummary(centerKey) {
    const items = getAdminOfficePerformanceItems(centerKey);
    let maxTotal = 0, scoreTotal = 0;
    items.forEach((item, index) => { maxTotal += Number(item.max) || 0; scoreTotal += getScore(centerKey, item, index); });
    const maxEl = document.getElementById(`admin-perf-max-${centerKey}`);
    const scoreEl = document.getElementById(`admin-perf-score-${centerKey}`);
    if (maxEl) maxEl.textContent = maxTotal;
    if (scoreEl) scoreEl.textContent = scoreTotal;
    const pct = maxTotal ? (scoreTotal / maxTotal) * 100 : 100;
    let rate = 0;
    if (pct < 60) rate = 15; else if (pct < 65) rate = 10; else if (pct < 70) rate = 8; else if (pct < 75) rate = 6; else if (pct < 80) rate = 4; else if (pct < 85) rate = 2;
    const centerCost = calculateCenterTotalCost(centerKey);
    const amount = centerCost * rate / 100;
    const all = readJson(DEDUCTION_KEY, {});
    all[centerKey] = amount;
    writeJson(DEDUCTION_KEY, all);
    const oldAll = readJson('performanceDeductions', {});
    oldAll[centerKey] = amount;
    writeJson('performanceDeductions', oldAll);
    const summary = document.getElementById(`admin-perf-summary-${centerKey}`);
    if (summary) summary.innerHTML = `<p>إجمالي المبلغ لأنشطة القسم = <span>${centerCost.toFixed(2)}</span> ريال</p><p>التقدير الذي حصل عليه المقاول : <span>${pct.toFixed(2)}%</span></p><p>نسبة الحسم على المقاول لهذا القسم : <span>${rate}%</span> ويساوي <span>${amount.toFixed(2)}</span> ريال</p>`;
  }

  function saveAdminOfficePerformanceScore(centerKey, input) {
    const index = parseInt(input.dataset.index, 10);
    const item = getAdminOfficePerformanceItems(centerKey)[index];
    const max = Number(item && item.max) || 0;
    let value = parseInt(input.value, 10);
    if (isNaN(value)) value = 0;
    if (value < 0) value = 0;
    if (value > max) value = max;
    input.value = value;
    const scores = getScores();
    scores[centerKey] = scores[centerKey] || {};
    scores[centerKey][index] = value;
    saveScores(scores);
    calculateAdminOfficePerformanceSummary(centerKey);
    if (typeof renderAchievementCertificate === 'function') renderAchievementCertificate(centerKey);
  }

  function renderAdminOfficePerformanceTable(centerKey) {
    const container = document.getElementById('performance-tab');
    if (!container) return;
    const names = getNames();
    const centerName = names[centerKey] || (isWorkshop(centerKey) ? 'الورش (صيانة وإصلاح السيارات)' : 'الموقع');
    const extract = getPeriodInfo();
    const start = fmtDate(extract.extractStart);
    const end = fmtDate(extract.extractEnd);
    const cost = calculateCenterTotalCost(centerKey);
    const manageButton = isWorkshop(centerKey) ? '' : `<button class="btn-action btn-manage-items" onclick="openAdminOfficePerformanceItemsDialog('${centerKey}')"><i class="fas fa-tasks"></i> إدارة البنود</button>`;
    container.innerHTML = `<div class="certificate-container" id="admin-office-performance-certificate-${centerKey}"><style>.admin-office-performance-table th{background:#d6ffd6;font-weight:700}.admin-office-performance-table td{text-align:center;vertical-align:middle}.admin-office-performance-table .item-text,.admin-office-performance-table .workshop-sub,.admin-office-performance-table .workshop-group{font-weight:600}.admin-office-performance-table .workshop-group{width:22%}.admin-office-performance-table .workshop-sub{width:28%}</style><div class="performance-cost-display"><span>إجمالي المبلغ لأنشطة القسم (تكلفة العمالة):</span><span class="cost-value">${cost.toFixed(2)} ريال</span></div><div class="certificate-header"><h2>جدول ح غ 1</h2><h3>جدول الغرامات الخاصة بمستوى الأداء لموقع ${centerName}</h3><p>عن الفترة من : ${start}م إلى ${end}م</p></div>${buildTable(centerKey)}<div class="certificate-summary" id="admin-perf-summary-${centerKey}"></div><div class="signatures-display-section" id="perf-signatures-${centerKey}"></div><div class="tab-action-buttons">${manageButton}<button class="btn-action btn-reset" onclick="resetAdminOfficePerformanceScores('${centerKey}')"><i class="fas fa-undo"></i> إعادة تعيين</button><button class="btn-action btn-print" onclick="printAdminOfficePerformanceCertificate('${centerKey}')"><i class="fas fa-print"></i> طباعة</button><button class="btn-action btn-export-excel" onclick="exportAdminOfficePerformanceToExcel('${centerKey}')"><i class="fas fa-file-excel"></i> تصدير Excel</button><button class="btn-action btn-signatures" onclick="openSignatureDialog('performance','${centerKey}')"><i class="fas fa-signature"></i> التواقيع</button></div></div>`;
    calculateAdminOfficePerformanceSummary(centerKey);
    if (typeof displaySignatures === 'function') displaySignatures('performance', centerKey);
  }

  function resetAdminOfficePerformanceScores(centerKey) {
    const scores = getScores();
    delete scores[centerKey];
    saveScores(scores);
    renderAdminOfficePerformanceTable(centerKey);
  }

  function openAdminOfficePerformanceItemsDialog(centerKey) {
    alert('بنود المكاتب منفصلة عن المراكز الصحية. التعديل اليدوي للبنود يؤجل بعد تثبيت الفصل النهائي.');
  }

  function printAdminOfficePerformanceCertificate(centerKey) { window.print(); }

  function exportAdminOfficePerformanceToExcel(centerKey) {
    if (typeof XLSX === 'undefined') { alert('مكتبة Excel غير محملة.'); return; }
    const items = getAdminOfficePerformanceItems(centerKey);
    const rows = isWorkshop(centerKey) ? [['القسم','البند','الدرجة القصوى','التقدير']] : [['م','أنشطة القسم','الدرجة القصوى','التقدير']];
    let max = 0, score = 0;
    items.forEach((item, i) => {
      const s = getScore(centerKey,item,i);
      max += Number(item.max) || 0;
      score += s;
      if (isWorkshop(centerKey)) rows.push([item.section || '', item.sub || item.text, item.max, s]);
      else rows.push([i + 1, item.text, item.max, s]);
    });
    rows.push(['','المجمــــــــــــــــوع',max,score]);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'جدول ح غ 1');
    XLSX.writeFile(wb, 'admin_office_performance.xlsx');
  }

  function currentCenterKey() {
    const active = document.querySelector('.tab-link.active[data-center-key]');
    if (active && active.dataset.centerKey) return active.dataset.centerKey;
    const title = document.getElementById('center-main-title')?.textContent || '';
    const names = getNames();
    const found = Object.entries(names).find(entry => title.includes(entry[1]));
    if (found) return found[0];
    if (title.includes('الورش')) return 'admin_staff';
    return null;
  }

  function patchOpenTab() {
    if (typeof window.openTab !== 'function') return false;
    if (window.openTab.__adminOfficePerformanceSeparated) return true;
    const original = window.openTab;
    window.openTab = function patchedAdminOfficeOpenTab(evt, tabName, centerKey) {
      const result = original.apply(this, arguments);
      if (tabName === 'performance-tab') {
        setTimeout(() => renderAdminOfficePerformanceTable(centerKey || currentCenterKey() || 'admin_staff'), 50);
      }
      return result;
    };
    window.openTab.__adminOfficePerformanceSeparated = true;
    return true;
  }

  function retryPatch(attempt) {
    if (patchOpenTab()) return;
    if (attempt >= 40) return;
    setTimeout(() => retryPatch(attempt + 1), 250);
  }

  window.getAdminOfficePerformanceItems = getAdminOfficePerformanceItems;
  window.saveAdminOfficePerformanceScore = saveAdminOfficePerformanceScore;
  window.calculateAdminOfficePerformanceSummary = calculateAdminOfficePerformanceSummary;
  window.renderAdminOfficePerformanceTable = renderAdminOfficePerformanceTable;
  window.resetAdminOfficePerformanceScores = resetAdminOfficePerformanceScores;
  window.openAdminOfficePerformanceItemsDialog = openAdminOfficePerformanceItemsDialog;
  window.printAdminOfficePerformanceCertificate = printAdminOfficePerformanceCertificate;
  window.exportAdminOfficePerformanceToExcel = exportAdminOfficePerformanceToExcel;

  retryPatch(0);
  console.info('[Admin Offices Performance] separated module loaded');
})();
