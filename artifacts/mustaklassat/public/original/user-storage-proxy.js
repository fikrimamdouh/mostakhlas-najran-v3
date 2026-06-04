/**
 * user-storage-proxy.js
 * يعزل بيانات localStorage لكل مستخدم بشكل تلقائي وشفاف
 * يجب تحميله قبل أي script آخر يستخدم localStorage
 */
(function () {
  const EXCLUDED_KEYS = ['najran_session'];

  function getPrefix() {
    try {
      const raw = Storage.prototype.getItem.call(localStorage, 'najran_session');
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (!session || !session.userId) return null;
      return '_u' + session.userId + '_';
    } catch (_) {
      return null;
    }
  }

  window._najranRealStorage = localStorage;

  const PREFIX = getPrefix();
  if (!PREFIX) return;

  const _get    = Storage.prototype.getItem.bind(localStorage);
  const _set    = Storage.prototype.setItem.bind(localStorage);
  const _remove = Storage.prototype.removeItem.bind(localStorage);
  const _key    = Storage.prototype.key.bind(localStorage);

  function prefixed(key) {
    return EXCLUDED_KEYS.includes(key) ? key : PREFIX + key;
  }

  function visibleKeys(target) {
    const keys = [];
    for (let i = 0; i < target.length; i++) {
      const raw = _key(i);
      if (!raw) continue;
      if (EXCLUDED_KEYS.includes(raw)) keys.push(raw);
      else if (raw.startsWith(PREFIX)) keys.push(raw.slice(PREFIX.length));
    }
    return keys;
  }

  const proxyHandler = {
    get(target, prop) {
      if (prop === 'getItem') return (key) => _get(prefixed(key));
      if (prop === 'setItem') return (key, value) => _set(prefixed(key), value);
      if (prop === 'removeItem') return (key) => _remove(prefixed(key));
      if (prop === 'key') return (index) => visibleKeys(target)[index] || null;
      if (prop === 'length') return visibleKeys(target).length;
      if (prop === 'clear') {
        return () => {
          const toDelete = [];
          for (let i = 0; i < target.length; i++) {
            const k = _key(i);
            if (k && k.startsWith(PREFIX)) toDelete.push(k);
          }
          toDelete.forEach(k => _remove(k));
        };
      }
      const val = target[prop];
      return typeof val === 'function' ? val.bind(target) : val;
    }
  };

  try {
    const proxy = new Proxy(localStorage, proxyHandler);
    Object.defineProperty(window, 'localStorage', { value: proxy, configurable: true, writable: false });
  } catch (_) {}
})();

(function () {
  'use strict';

  if (!/\/original\/approval\.html(?:$|[?#])/.test(window.location.pathname + window.location.search)) return;

  const DEPT_NAMES = {
    cleaning: 'النظافة', electricity: 'الكهرباء', agriculture: 'الزراعة', civil_works: 'الأعمال المدنية', 'civil-works': 'الأعمال المدنية', mechanical: 'الميكانيكا', security: 'الأمن', laundry: 'المغسلة', patient_services: 'خدمات المرضى', 'patient-services': 'خدمات المرضى', admin_saudi: 'الإداريون السعوديون', 'admin-saudi': 'الإداريون السعوديون'
  };

  const STATUS_LABELS = { 'ح': 'حاضر', 'غ': 'غائب', 'ج': 'إجازة', 'ش': 'شاغرة', 'ت': 'تحت الإجراء', 'ب': 'بداية العقد', 'ن': 'نهاية العقد' };

  const LABELS = {
    attendanceData: 'الحضور والانصراف', ng_attendanceData: 'حضور مستشفى نجران العام', nd_attendanceData: 'حضور مركز طب الأسنان', centersAttendanceData_v2: 'حضور المراكز', healthCentersAttendanceData: 'حضور المراكز الصحية', adminOfficesAttendanceData_v1: 'حضور المكاتب الإدارية',
    performanceData: 'جداول تقييم الأداء', performanceTotalDeduction: 'إجمالي خصومات الأداء', ng_performanceTotalDeduction: 'إجمالي خصومات أداء نجران العام', nd_performanceTotalDeduction: 'إجمالي خصومات أداء طب الأسنان', performance_data_consumables_v27: 'تقييم أداء المستهلكات',
    achievementData: 'شهادة الإنجاز', achievementTitles_v1: 'بنود شهادة الإنجاز', achievementItemNames: 'أسماء بنود الإنجاز', nd_dentalAchievementTotals: 'إجماليات إنجاز طب الأسنان',
    consumablesTableData: 'جدول المستهلكات', healthCentersConsumables: 'مستهلكات المراكز الصحية', mainHospitalConsumables: 'مستهلكات المستشفى', 'admin_offices_consumables_v1.0': 'مستهلكات المكاتب الإدارية', finalConsumablesCost: 'إجمالي المستهلكات', water_supply_data_consumables_v27: 'توريد المياه', sewage_disposal_data_consumables_v27: 'التخلص من الصرف', subcontractors_data_consumables_v27: 'مقاولو الباطن',
    spare_partsData: 'جدول قطع الغيار', sparePartsTotalAmount: 'إجمالي قطع الغيار'
  };

  const SECTION_DEFS = [
    { id: 'attendance', title: 'الحضور والانصراف', icon: '📋', keys: ['attendanceData','ng_attendanceData','nd_attendanceData','centersAttendanceData_v2','healthCentersAttendanceData','adminOfficesAttendanceData_v1'], prefixes: ['deptCalculatedCost_'] },
    { id: 'performance', title: 'تقييم الأداء', icon: '📊', keys: ['performanceData','performanceTotalDeduction','ng_performanceTotalDeduction','nd_performanceTotalDeduction','performance_data_consumables_v27'], prefixes: ['dept_','performance_'] },
    { id: 'achievement', title: 'شهادة الإنجاز', icon: '🏆', keys: ['achievementData','achievementTitles_v1','achievementItemNames','nd_dentalAchievementTotals'], prefixes: ['achievement_','nd_dentalAchievement'] },
    { id: 'consumables', title: 'المستهلكات والمواد', icon: '🧪', keys: ['consumablesTableData','healthCentersConsumables','mainHospitalConsumables','admin_offices_consumables_v1.0','finalConsumablesCost','water_supply_data_consumables_v27','sewage_disposal_data_consumables_v27','subcontractors_data_consumables_v27'], prefixes: ['consumables_','water_','sewage_','subcontractors_'] },
    { id: 'spare', title: 'قطع الغيار', icon: '🔩', keys: ['spare_partsData','sparePartsTotalAmount'], prefixes: ['spare_'] }
  ];

  function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function normalizeKey(k) { return String(k || '').replace(/^_u\d+_/, ''); }
  function parseExtractData(raw) { if (!raw) return {}; if (typeof raw === 'object') return raw; try { return JSON.parse(raw); } catch (_) { return {}; } }
  function getGlobalExtractById(id) { try { if (typeof allExtracts !== 'undefined' && Array.isArray(allExtracts)) return allExtracts.find(e => String(e.id) === String(id)) || null; } catch (_) {} return null; }

  function labelKey(k) {
    const nk = normalizeKey(k);
    if (LABELS[nk]) return LABELS[nk];
    if (nk.startsWith('deptCalculatedCost_')) return 'تكلفة قسم ' + (DEPT_NAMES[nk.replace('deptCalculatedCost_', '')] || nk.replace('deptCalculatedCost_', ''));
    if (nk.startsWith('dept_')) return 'تقييم قسم ' + (DEPT_NAMES[nk.replace('dept_', '')] || nk.replace('dept_', ''));
    if (nk.startsWith('achievement_')) return 'شهادة إنجاز — ' + nk.replace('achievement_', '');
    if (nk.startsWith('consumables_')) return 'مستهلكات — ' + nk.replace('consumables_', '');
    if (nk.startsWith('spare_')) return 'قطع غيار — ' + nk.replace('spare_', '');
    return 'بيانات محفوظة';
  }

  function getSectionEntries(snapshot, def) {
    const out = [];
    const exact = new Set(def.keys || []);
    const prefixes = def.prefixes || [];
    Object.keys(snapshot || {}).forEach(rawKey => {
      const nk = normalizeKey(rawKey);
      if (exact.has(nk) || prefixes.some(p => nk.startsWith(p))) out.push({ key: nk, value: snapshot[rawKey] });
    });
    return out;
  }

  function looksLikeObjectArray(arr) { return Array.isArray(arr) && arr.length > 0 && arr.every(x => x && typeof x === 'object' && !Array.isArray(x)); }
  function renderScalar(v) { if (v == null || v === '') return '<span class="nr-muted">—</span>'; if (typeof v === 'number') return esc(Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 })); if (typeof v === 'boolean') return v ? 'نعم' : 'لا'; if (typeof v === 'object') return '<span class="nr-muted">بيانات تفصيلية</span>'; return esc(v); }
  function labelFor(k) { return { name:'الاسم', employeeName:'اسم الموظف', jobTitle:'الوظيفة', category:'الفئة', nationality:'الجنسية', iqamaId:'رقم الإقامة', attendanceDays:'حضور', absenceDays:'غياب', deduction:'الحسم', absencePenalty:'غرامة الغياب', totalFine:'إجمالي الغرامة', netSalary:'صافي الاستحقاق', salary:'الراتب', total:'الإجمالي', amount:'المبلغ', item:'الصنف', itemName:'الصنف', quantity:'الكمية', qty:'الكمية', price:'السعر', unitPrice:'سعر الوحدة', notes:'ملاحظات', percentage:'النسبة', deductionAmount:'قيمة الخصم' }[k] || k; }

  function tableFromArray(arr) {
    const rows = arr.slice(0, 200);
    const preferred = ['name','employeeName','jobTitle','category','nationality','iqamaId','attendanceDays','absenceDays','deduction','absencePenalty','totalFine','netSalary','salary','item','itemName','quantity','qty','price','unitPrice','total','amount','percentage','deductionAmount','notes'];
    const colsSet = new Set();
    preferred.forEach(c => rows.some(r => r && r[c] !== undefined) && colsSet.add(c));
    rows.forEach(r => Object.keys(r || {}).slice(0, 25).forEach(k => { if (k !== 'days') colsSet.add(k); }));
    const cols = Array.from(colsSet).slice(0, 14);
    if (cols.length === 0) return '<div class="nr-empty">لا توجد أعمدة قابلة للعرض</div>';
    return '<div class="nr-table-wrap"><table class="nr-table"><thead><tr>' + cols.map(c => '<th>' + esc(labelFor(c)) + '</th>').join('') + '</tr></thead><tbody>' + rows.map(r => '<tr>' + cols.map(c => '<td>' + renderScalar(r ? r[c] : '') + '</td>').join('') + '</tr>').join('') + '</tbody></table>' + (arr.length > rows.length ? '<div class="nr-note">تم عرض أول ' + rows.length + ' صف فقط من أصل ' + arr.length + '</div>' : '') + '</div>';
  }

  function countDays(days) { const counts = { present:0, absent:0, leave:0, vacant:0, pending:0, start:0, end:0, other:0 }; (Array.isArray(days) ? days : []).forEach(d => { if (d === 'ح') counts.present++; else if (d === 'غ') counts.absent++; else if (d === 'ج') counts.leave++; else if (d === 'ش') counts.vacant++; else if (d === 'ت') counts.pending++; else if (d === 'ب') counts.start++; else if (d === 'ن') counts.end++; else counts.other++; }); return counts; }
  function renderDaysStrip(days) { if (!Array.isArray(days) || days.length === 0) return '<span class="nr-muted">—</span>'; return '<div class="nr-days-strip">' + days.map((d, i) => '<span class="nr-day nr-day-' + esc(d) + '" title="يوم ' + (i + 1) + ' — ' + esc(STATUS_LABELS[d] || d) + '">' + esc(d || '—') + '</span>').join('') + '</div>'; }

  function renderAttendanceData(data) {
    if (!data || typeof data !== 'object') return renderValue(data);
    const depts = Object.keys(data).filter(k => Array.isArray(data[k]));
    if (!depts.length) return renderValue(data);
    let totalEmployees = 0, totalPresent = 0, totalAbsent = 0, totalNet = 0, totalDeduction = 0, totalFine = 0;
    const deptCards = depts.map(deptKey => {
      const rows = data[deptKey] || [];
      let dAbsent = 0, dNet = 0;
      rows.forEach(emp => { const c = countDays(emp.days); totalPresent += Number(emp.attendanceDays ?? c.present ?? 0); totalAbsent += Number(emp.absenceDays ?? c.absent ?? 0); dAbsent += Number(emp.absenceDays ?? c.absent ?? 0); dNet += Number(emp.netSalary || 0); totalNet += Number(emp.netSalary || 0); totalDeduction += Number(emp.deduction || 0); totalFine += Number(emp.totalFine || emp.absencePenalty || 0); });
      totalEmployees += rows.length;
      const body = rows.map((emp, idx) => { const c = countDays(emp.days); return '<tr><td>' + (idx + 1) + '</td><td class="nr-emp-name">' + esc(emp.name || emp.employeeName || '—') + '</td><td>' + esc(emp.jobTitle || '—') + '</td><td>' + esc(emp.category || '—') + '</td><td>' + esc(emp.nationality || '—') + '</td><td>' + esc(emp.iqamaId || '—') + '</td><td>' + (emp.attendanceDays ?? c.present) + '</td><td>' + (emp.absenceDays ?? c.absent) + '</td><td>' + c.leave + '</td><td>' + c.vacant + '</td><td>' + c.pending + '</td><td>' + renderScalar(emp.deduction) + '</td><td>' + renderScalar(emp.totalFine || emp.absencePenalty) + '</td><td>' + renderScalar(emp.netSalary) + '</td><td>' + renderDaysStrip(emp.days) + '</td></tr>'; }).join('');
      return '<div class="nr-att-card"><div class="nr-att-head"><strong>' + esc(DEPT_NAMES[deptKey] || deptKey) + '</strong><span>' + rows.length + ' موظف</span><span>غياب: ' + dAbsent + '</span><span>الصافي: ' + dNet.toLocaleString('en-US', { maximumFractionDigits: 2 }) + '</span></div><div class="nr-table-wrap"><table class="nr-table nr-att-table"><thead><tr><th>#</th><th>الموظف</th><th>الوظيفة</th><th>الفئة</th><th>الجنسية</th><th>الإقامة</th><th>حضور</th><th>غياب</th><th>إجازة</th><th>شاغرة</th><th>تحت الإجراء</th><th>الحسم</th><th>الغرامة</th><th>الصافي</th><th>أيام الشهر</th></tr></thead><tbody>' + body + '</tbody></table></div></div>';
    }).join('');
    return '<div class="nr-summary-grid"><div><b>' + totalEmployees + '</b><span>إجمالي الموظفين</span></div><div><b>' + totalPresent + '</b><span>أيام حضور</span></div><div><b>' + totalAbsent + '</b><span>أيام غياب</span></div><div><b>' + totalDeduction.toLocaleString('en-US', { maximumFractionDigits: 2 }) + '</b><span>إجمالي الحسم</span></div><div><b>' + totalFine.toLocaleString('en-US', { maximumFractionDigits: 2 }) + '</b><span>إجمالي الغرامات</span></div><div><b>' + totalNet.toLocaleString('en-US', { maximumFractionDigits: 2 }) + '</b><span>صافي الاستحقاق</span></div></div>' + deptCards;
  }

  function renderValue(value) {
    if (looksLikeObjectArray(value)) return tableFromArray(value);
    if (Array.isArray(value)) return value.length ? '<div class="nr-list">' + value.slice(0, 120).map(x => '<div class="nr-list-item">' + renderScalar(x) + '</div>').join('') + '</div>' : '<div class="nr-empty">لا توجد بيانات</div>';
    if (value && typeof value === 'object') {
      const keys = Object.keys(value);
      if (keys.length === 0) return '<div class="nr-empty">لا توجد بيانات</div>';
      const firstArrayKey = keys.find(k => looksLikeObjectArray(value[k]));
      if (firstArrayKey) return '<div class="nr-subtitle">' + esc(labelFor(firstArrayKey)) + '</div>' + tableFromArray(value[firstArrayKey]);
      return '<div class="nr-kv-grid">' + keys.slice(0, 120).map(k => '<div class="nr-kv"><div class="nr-k">' + esc(labelFor(k)) + '</div><div class="nr-v">' + renderScalar(value[k]) + '</div></div>').join('') + '</div>';
    }
    return '<div class="nr-kv-grid"><div class="nr-kv"><div class="nr-k">القيمة</div><div class="nr-v">' + renderScalar(value) + '</div></div></div>';
  }

  function renderSection(snapshot, def) {
    const entries = getSectionEntries(snapshot, def);
    if (entries.length === 0) return '<div class="nr-section" id="nr-sec-' + esc(def.id) + '"><h3>' + def.icon + ' ' + esc(def.title) + '</h3><div class="nr-empty">لا توجد بيانات محفوظة لهذا الجزء داخل نسخة الرفع</div></div>';
    return '<div class="nr-section" id="nr-sec-' + esc(def.id) + '"><h3>' + def.icon + ' ' + esc(def.title) + '</h3>' + entries.map(entry => '<div class="nr-block"><div class="nr-key">' + esc(labelKey(entry.key)) + '</div>' + (def.id === 'attendance' && /attendanceData/i.test(entry.key) ? renderAttendanceData(entry.value) : renderValue(entry.value)) + '</div>').join('') + '</div>';
  }

  function injectReviewStyles() {
    if (document.getElementById('najran-review-details-style')) return;
    const style = document.createElement('style');
    style.id = 'najran-review-details-style';
    style.textContent = `.nr-detail-btn{background:linear-gradient(135deg,#1e3c72,#2a5298)!important;color:#fff!important;border-color:transparent!important}.nr-overlay{position:fixed;inset:0;background:rgba(15,23,42,.62);z-index:999999;display:none;align-items:stretch;justify-content:center;padding:18px;direction:rtl}.nr-overlay.open{display:flex}.nr-modal{background:#fff;width:min(1280px,100%);border-radius:22px;box-shadow:0 24px 80px rgba(0,0,0,.35);display:flex;flex-direction:column;overflow:hidden}.nr-head{background:linear-gradient(135deg,#1e3c72,#2a5298);color:#fff;padding:18px 22px;display:flex;align-items:center;justify-content:space-between;gap:14px}.nr-head h2{font-size:20px;font-weight:800;margin:0}.nr-head p{font-size:12px;opacity:.78;margin-top:3px}.nr-close{background:rgba(255,255,255,.16);color:#fff;border:1px solid rgba(255,255,255,.25);border-radius:10px;padding:8px 13px;cursor:pointer;font-family:inherit;font-weight:800}.nr-tabs{display:flex;gap:8px;overflow-x:auto;padding:12px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0}.nr-tab{white-space:nowrap;border:1px solid #dbe3ef;background:#fff;color:#334155;border-radius:999px;padding:8px 14px;font-family:inherit;font-size:12px;font-weight:800;cursor:pointer}.nr-tab.active{background:#1e3c72;color:#fff;border-color:#1e3c72}.nr-body{padding:18px;overflow:auto;max-height:calc(100vh - 190px);background:#f0f4f8}.nr-section{display:none;background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:18px;box-shadow:0 2px 8px rgba(0,0,0,.04)}.nr-section.active{display:block}.nr-section h3{font-size:18px;color:#1e3c72;margin:0 0 14px}.nr-block{border:1px solid #edf2f7;border-radius:14px;margin-bottom:14px;overflow:hidden;background:#fff}.nr-key{background:#f8fafc;color:#1e3c72;font-size:13px;font-weight:900;padding:10px 13px;border-bottom:1px solid #edf2f7}.nr-table-wrap{overflow:auto}.nr-table{width:100%;border-collapse:collapse;font-size:12px;background:#fff}.nr-table th{background:#1e3c72;color:#fff;padding:9px;white-space:nowrap;position:sticky;top:0}.nr-table td{border-bottom:1px solid #edf2f7;padding:8px;vertical-align:top;max-width:320px}.nr-table tr:nth-child(even) td{background:#f8fafc}.nr-att-table td{white-space:nowrap}.nr-emp-name{font-weight:800;color:#1e3c72}.nr-kv-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:9px;padding:12px}.nr-kv{background:#f8fafc;border:1px solid #edf2f7;border-radius:10px;padding:10px}.nr-k{font-size:11px;color:#64748b;font-weight:800;margin-bottom:5px}.nr-v{font-size:13px;color:#1e293b;font-weight:700;word-break:break-word}.nr-muted{color:#94a3b8}.nr-empty{padding:18px;text-align:center;color:#94a3b8;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:13px}.nr-list{padding:12px;display:grid;gap:7px}.nr-list-item{background:#f8fafc;border:1px solid #edf2f7;border-radius:9px;padding:8px;font-size:12px}.nr-summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px;margin-bottom:14px}.nr-summary-grid div{background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:12px;text-align:center}.nr-summary-grid b{display:block;color:#0c4a6e;font-size:18px}.nr-summary-grid span{font-size:11px;color:#0369a1;font-weight:800}.nr-att-card{margin:14px 0;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden}.nr-att-head{display:flex;gap:10px;flex-wrap:wrap;align-items:center;background:#f8fafc;padding:10px 12px;border-bottom:1px solid #e2e8f0}.nr-att-head strong{color:#1e3c72;margin-left:8px}.nr-att-head span{font-size:12px;background:#fff;border:1px solid #e2e8f0;border-radius:999px;padding:4px 9px;color:#475569;font-weight:800}.nr-days-strip{display:flex;gap:2px;min-width:240px}.nr-day{display:inline-flex;width:20px;height:20px;border-radius:5px;align-items:center;justify-content:center;font-size:11px;font-weight:900;border:1px solid #e2e8f0}.nr-day-ح{background:#e8f0fe;color:#1d4ed8}.nr-day-غ{background:#fee2e2;color:#b91c1c}.nr-day-ج{background:#fef3c7;color:#b45309}.nr-day-ش{background:#d1ecf1;color:#0369a1}.nr-day-ت{background:#e2e8f0;color:#475569}.nr-day-ب,.nr-day-ن{background:#f3e8ff;color:#7e22ce}@media print{.nr-overlay{display:none!important}}`;
    document.head.appendChild(style);
  }

  function ensureModal() { injectReviewStyles(); let overlay = document.getElementById('najran-review-details-overlay'); if (overlay) return overlay; overlay = document.createElement('div'); overlay.id = 'najran-review-details-overlay'; overlay.className = 'nr-overlay'; overlay.innerHTML = '<div class="nr-modal"><div class="nr-head"><div><h2 id="nr-title">مراجعة تفصيلية للمستخلص</h2><p id="nr-subtitle">بيانات محفوظة وقت الرفع</p></div><button class="nr-close" onclick="window.closeNajranReviewDetails()">إغلاق ✕</button></div><div class="nr-tabs" id="nr-tabs"></div><div class="nr-body" id="nr-body"></div></div>'; overlay.addEventListener('click', e => { if (e.target === overlay) window.closeNajranReviewDetails(); }); document.body.appendChild(overlay); return overlay; }
  function activateSection(id) { document.querySelectorAll('.nr-tab').forEach(b => b.classList.toggle('active', b.dataset.id === id)); document.querySelectorAll('.nr-section').forEach(s => s.classList.toggle('active', s.id === 'nr-sec-' + id)); }
  window.closeNajranReviewDetails = function () { const overlay = document.getElementById('najran-review-details-overlay'); if (overlay) overlay.classList.remove('open'); document.body.style.overflow = ''; };
  window.openNajranReviewDetails = function (id) { const e = getGlobalExtractById(id); if (!e) return alert('تعذر العثور على بيانات المستخلص في الصفحة'); const snapshot = parseExtractData(e.extractData); const overlay = ensureModal(); document.getElementById('nr-title').textContent = 'مراجعة تفصيلية — ' + (e.hospitalName || e.submittedByHospital || '—'); document.getElementById('nr-subtitle').textContent = (e.periodMonth || '—') + ' · ' + (e.companyName || '—') + ' · رقم المستخلص #' + e.id; document.getElementById('nr-tabs').innerHTML = SECTION_DEFS.map((def, idx) => '<button class="nr-tab ' + (idx === 0 ? 'active' : '') + '" data-id="' + esc(def.id) + '" onclick="window.activateNajranReviewSection(\'' + esc(def.id) + '\')">' + def.icon + ' ' + esc(def.title) + '</button>').join(''); document.getElementById('nr-body').innerHTML = SECTION_DEFS.map((def, idx) => renderSection(snapshot, def).replace('nr-section"', 'nr-section' + (idx === 0 ? ' active' : '') + '"')).join(''); overlay.classList.add('open'); document.body.style.overflow = 'hidden'; };
  window.activateNajranReviewSection = activateSection;
  function enhanceApprovalCards() { let extracts = []; try { if (typeof allExtracts !== 'undefined' && Array.isArray(allExtracts)) extracts = allExtracts; } catch (_) { return; } if (!extracts.length) return; extracts.forEach(e => { const card = document.getElementById('card-' + e.id); if (!card) return; const body = card.querySelector('.card-body.open'); if (!body || body.querySelector('.nr-detail-btn')) return; const btnWrap = document.createElement('div'); btnWrap.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px;border-bottom:1px solid #f1f5f9;padding-bottom:12px'; btnWrap.innerHTML = '<button type="button" class="admin-btn nr-detail-btn" onclick="window.openNajranReviewDetails(' + Number(e.id) + ')">🔎 فتح المراجعة التفصيلية</button>'; body.insertBefore(btnWrap, body.firstChild); }); }
  function installEnhancer() { injectReviewStyles(); const timer = setInterval(enhanceApprovalCards, 700); window.addEventListener('beforeunload', () => clearInterval(timer)); try { if (typeof renderList === 'function' && !renderList.__najranReviewWrapped) { const originalRenderList = renderList; renderList = function () { const r = originalRenderList.apply(this, arguments); setTimeout(enhanceApprovalCards, 0); return r; }; renderList.__najranReviewWrapped = true; } } catch (_) {} }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installEnhancer); else installEnhancer();
})();
