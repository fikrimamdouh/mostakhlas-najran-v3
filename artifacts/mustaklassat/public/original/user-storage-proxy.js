/**
 * user-storage-proxy.js
 * يعزل بيانات localStorage لكل مستخدم بشكل تلقائي وشفاف.
 * يجب تحميله قبل أي script آخر يستخدم localStorage.
 */
(function () {
const EXCLUDED_KEYS = [
  'najran_session',

  // مفاتيح تشغيلية مشتركة بين مستخدمي نفس المستشفى — ممنوع تتحول إلى _uX_
  'attendanceData',
  'ng_attendanceData',
  'nd_attendanceData',
  'centersAttendanceData_v2',
  'healthCentersAttendanceData',
  'adminOfficesAttendanceData_v1'
];
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

  const _get = Storage.prototype.getItem.bind(localStorage);
  const _set = Storage.prototype.setItem.bind(localStorage);
  const _remove = Storage.prototype.removeItem.bind(localStorage);
  const _key = Storage.prototype.key.bind(localStorage);

  function cleanKey(key) {
    return String(key || '').replace(/^(?:_u\d+_)+/, '');
  }

  function prefixed(key) {
    const clean = cleanKey(key);
    return EXCLUDED_KEYS.includes(clean) ? clean : PREFIX + clean;
  }

  function visibleKeys(target) {
    const keys = [];
    const seen = new Set();
    for (let i = 0; i < target.length; i++) {
      const raw = _key(i);
      if (!raw) continue;
      const clean = cleanKey(raw);
      if (EXCLUDED_KEYS.includes(clean)) {
        if (!seen.has(clean)) { seen.add(clean); keys.push(clean); }
      } else if (raw.startsWith(PREFIX)) {
        if (!seen.has(clean)) { seen.add(clean); keys.push(clean); }
      }
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

  function hasContent(raw) {
    if (!raw) return false;

    try {
      const data = JSON.parse(raw);

      if (Array.isArray(data)) return data.length > 0;

      if (data && typeof data === 'object') {
        return Object.keys(data).some(function (dept) {
          return Array.isArray(data[dept]) && data[dept].length > 0;
        });
      }

      return false;
    } catch (_) {
      return String(raw).trim().length > 0;
    }
  }

  function getSessionRaw() {
    try {
      const raw = Storage.prototype.getItem.call(localStorage, 'najran_session');
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function migratePersonalAttendanceToShared() {
    try {
      const session = getSessionRaw();
      if (!session || !session.userId) return;

      const personalKey = '_u' + session.userId + '_attendanceData';
      const sharedKey = 'attendanceData';

      const personalRaw = Storage.prototype.getItem.call(localStorage, personalKey);
      const sharedRaw = Storage.prototype.getItem.call(localStorage, sharedKey);

      if (!hasContent(personalRaw)) return;
      if (hasContent(sharedRaw)) return;

      Storage.prototype.setItem.call(localStorage, sharedKey, personalRaw);

      console.warn(
        '[AttendanceMigration] تم نقل بيانات الحضور من المفتاح الشخصي إلى المفتاح المشترك:',
        personalKey,
        '→',
        sharedKey
      );

      setTimeout(function () {
        try {
          if (typeof window.najranSyncNow === 'function') {
            window.najranSyncNow();
          }
        } catch (_) {}
      }, 2500);

    } catch (e) {
      console.warn('[AttendanceMigration] فشل ترحيل بيانات الحضور الشخصية للمشتركة', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(migratePersonalAttendanceToShared, 3000);
    });
  } else {
    setTimeout(migratePersonalAttendanceToShared, 3000);
  }
})();
/**
 * ملف المراجعة التفصيلية داخل صفحة اعتماد المستخلص.
 * يعرض بيانات نوع المستخلص المرفوع فقط، ويضع قرار المراجع في نفس النافذة.
 */
(function () {
  'use strict';

  const pageSignature = window.location.pathname + window.location.search;
  if (!(/\/original\/approval\.html(?:$|[?#])/.test(pageSignature) || /[?&]page=approval\.html(?:$|&)/.test(pageSignature))) return;

  const TYPE_LABELS = {
    labor: 'مستخلص العمالة',
    consumables: 'مستخلص المستهلكات',
    spare_parts: 'مستخلص قطع الغيار',
    health_centers: 'مستخلص المراكز الصحية',
    admin_offices: 'مستخلص المكاتب الإدارية'
  };

  const STATUS_TEXT = {
    submitted: 'بانتظار المراجعة',
    under_review: 'قيد المراجعة',
    needs_revision: 'يحتاج تعديل',
    approved: 'معتمد',
    rejected: 'مرفوض'
  };

  const DEPT_NAMES = {
    cleaning: 'النظافة', electricity: 'الكهرباء', agriculture: 'الزراعة',
    civil_works: 'الأعمال المدنية', 'civil-works': 'الأعمال المدنية', civil: 'الأعمال المدنية',
    mechanical: 'الميكانيكا', mechanics: 'الميكانيكا', security: 'الأمن', laundry: 'المغسلة',
    patient_services: 'خدمات المرضى', 'patient-services': 'خدمات المرضى',
    admin_saudi: 'الإداريون السعوديون', 'admin-saudi': 'الإداريون السعوديون'
  };

  const DAY_LABELS = { 'ح': 'حاضر', 'غ': 'غائب', 'ج': 'إجازة', 'ش': 'شاغرة', 'ت': 'تحت الإجراء', 'ب': 'بداية العقد', 'ن': 'نهاية العقد' };

  const FIELD_LABELS = {
    name:'الاسم', employeeName:'اسم الموظف', jobTitle:'الوظيفة', category:'الفئة', nationality:'الجنسية', iqamaId:'رقم الإقامة', idNumber:'رقم الهوية',
    attendanceDays:'أيام الحضور', absenceDays:'أيام الغياب', leaveDays:'إجازات', deduction:'الحسم', absencePenalty:'غرامة الغياب', totalFine:'إجمالي الغرامة', netSalary:'صافي الاستحقاق', salary:'الراتب',
    total:'الإجمالي', amount:'المبلغ', item:'الصنف', itemName:'الصنف', materialName:'الصنف', quantity:'الكمية', qty:'الكمية', unit:'الوحدة', price:'السعر', unitPrice:'سعر الوحدة', totalPrice:'الإجمالي',
    notes:'ملاحظات', note:'ملاحظة', percentage:'النسبة', percent:'النسبة', deductionAmount:'قيمة الخصم', score:'التقييم', grade:'الدرجة', maxScore:'الدرجة القصوى', actual:'الفعلي', target:'المستهدف',
    title:'البيان', description:'الوصف', department:'القسم', departmentName:'القسم', location:'الموقع', date:'التاريخ', status:'الحالة', value:'القيمة', paymentNumber:'رقم الدفعة'
  };

  const DATA_LABELS = {
    attendanceData:'جدول الحضور والانصراف', ng_attendanceData:'حضور مستشفى نجران العام', nd_attendanceData:'حضور مركز طب الأسنان', centersAttendanceData_v2:'حضور المراكز', healthCentersAttendanceData:'حضور المراكز الصحية', adminOfficesAttendanceData_v1:'حضور المكاتب الإدارية',
    performanceData:'جداول تقييم الأداء', performanceTotalDeduction:'إجمالي خصومات الأداء', ng_performanceTotalDeduction:'إجمالي خصومات أداء نجران العام', nd_performanceTotalDeduction:'إجمالي خصومات أداء طب الأسنان', performance_data_consumables_v27:'تقييم أداء المستهلكات',
    achievementData:'شهادة الإنجاز', achievementTitles_v1:'بنود شهادة الإنجاز', achievementItemNames:'أسماء بنود الإنجاز', nd_dentalAchievementTotals:'إجماليات إنجاز طب الأسنان',
    consumablesTableData:'جدول المستهلكات', healthCentersConsumables:'مستهلكات المراكز الصحية', mainHospitalConsumables:'مستهلكات المستشفى', 'admin_offices_consumables_v1.0':'مستهلكات المكاتب الإدارية', finalConsumablesCost:'إجمالي المستهلكات', water_supply_data_consumables_v27:'توريد المياه', sewage_disposal_data_consumables_v27:'التخلص من الصرف', subcontractors_data_consumables_v27:'مقاولو الباطن',
    spare_partsData:'جدول قطع الغيار', sparePartsTotalAmount:'إجمالي قطع الغيار'
  };

  const SECTION_DEFS = [
    { id:'summary', title:'ملخص المراجعة', icon:'🧾', types:['labor','consumables','spare_parts','health_centers','admin_offices'], special:true },
    { id:'attendance', title:'الحضور والانصراف', icon:'📋', types:['labor','health_centers','admin_offices'], keys:['attendanceData','ng_attendanceData','nd_attendanceData','centersAttendanceData_v2','healthCentersAttendanceData','adminOfficesAttendanceData_v1'], prefixes:['deptCalculatedCost_'] },
    { id:'performance', title:'جداول تقييم الأداء', icon:'📊', types:['labor','consumables'], keys:['performanceData','performanceTotalDeduction','ng_performanceTotalDeduction','nd_performanceTotalDeduction','performance_data_consumables_v27'], prefixes:['dept_','performance_'] },
    { id:'achievement', title:'شهادة الإنجاز', icon:'🏆', types:['labor'], keys:['achievementData','achievementTitles_v1','achievementItemNames','nd_dentalAchievementTotals'], prefixes:['achievement_','nd_dentalAchievement'] },
    { id:'consumables', title:'المستهلكات والمواد', icon:'🧪', types:['consumables','health_centers','admin_offices'], keys:['consumablesTableData','healthCentersConsumables','mainHospitalConsumables','admin_offices_consumables_v1.0','finalConsumablesCost','water_supply_data_consumables_v27','sewage_disposal_data_consumables_v27','subcontractors_data_consumables_v27'], prefixes:['consumables_','water_','sewage_','subcontractors_'] },
    { id:'spare', title:'قطع الغيار', icon:'🔩', types:['spare_parts'], keys:['spare_partsData','sparePartsTotalAmount'], prefixes:['spare_'] }
  ];

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function normalizeKey(k) { return String(k || '').replace(/^(?:_u\d+_)+/, ''); }
  function parseJSON(raw) {
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(raw); } catch (_) { return {}; }
  }
  function snapshotOf(e) {
    const data = parseJSON(e && e.extractData);
    return data.localStorageSnapshot || data.storageSnapshot || data.snapshot || data.submittedData || data;
  }
  function persistentOf(e) {
    const data = parseJSON(e && e.extractData);
    return data.persistentExtractData || data.persistentContractData || data.extractMeta || {};
  }
  function getGlobalExtractById(id) {
    try {
      if (typeof allExtracts !== 'undefined' && Array.isArray(allExtracts)) {
        return allExtracts.find(e => String(e.id) === String(id)) || null;
      }
    } catch (_) {}
    return null;
  }
  function money(n) {
    const v = Number(n || 0);
    return v ? v.toLocaleString('ar-SA', { minimumFractionDigits:2, maximumFractionDigits:2 }) + ' ر.س' : '—';
  }
  function fmtDate(d) {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('ar-SA', { year:'numeric', month:'long', day:'numeric' }); } catch (_) { return '—'; }
  }
  function metaOf(e) {
    const p = persistentOf(e);
    const data = parseJSON(e && e.extractData);
    const extractMonth = e.extractMonth || p.extractMonth || data.extractMonth || '';
    const extractYear = e.extractYear || p.extractYear || data.extractYear || '';
    return {
      paymentNumber: e.paymentNumber || p.paymentNumber || data.paymentNumber || '—',
      period: e.periodMonth || [extractMonth, extractYear].filter(Boolean).join(' ') || '—',
      start: e.extractStart || p.extractStart || data.extractStart || '—',
      end: e.extractEnd || p.extractEnd || data.extractEnd || '—'
    };
  }
  function arabicKey(key) {
    const nk = normalizeKey(key);
    if (DATA_LABELS[nk]) return DATA_LABELS[nk];
    if (nk.startsWith('deptCalculatedCost_')) return 'تكلفة قسم ' + (DEPT_NAMES[nk.replace('deptCalculatedCost_', '')] || 'غير محدد');
    if (nk.startsWith('dept_')) return 'تقييم قسم ' + (DEPT_NAMES[nk.replace('dept_', '')] || 'غير محدد');
    if (nk.startsWith('achievement_')) return 'شهادة إنجاز';
    if (nk.startsWith('consumables_')) return 'مستهلكات';
    if (nk.startsWith('spare_')) return 'قطع غيار';
    return nk || 'بيانات إضافية';
  }
  function fieldLabel(key, idx) {
    if (FIELD_LABELS[key]) return FIELD_LABELS[key];
    const clean = String(key || '').toLowerCase();
    if (clean.includes('name')) return 'الاسم';
    if (clean.includes('date')) return 'التاريخ';
    if (clean.includes('total')) return 'الإجمالي';
    if (clean.includes('amount') || clean.includes('cost')) return 'المبلغ';
    if (clean.includes('note')) return 'ملاحظات';
    if (clean.includes('percent')) return 'النسبة';
    if (clean.includes('qty') || clean.includes('quantity')) return 'الكمية';
    if (clean.includes('price')) return 'السعر';
    return 'بيان ' + (idx + 1);
  }
  function sectionEntries(snapshot, def) {
    if (!snapshot || def.special) return [];
    const exact = new Set(def.keys || []);
    const prefixes = def.prefixes || [];
    const out = [];
    Object.keys(snapshot).forEach(rawKey => {
      const nk = normalizeKey(rawKey);
      if (exact.has(nk) || prefixes.some(p => nk.startsWith(p))) out.push({ key:nk, value:snapshot[rawKey] });
    });
    return out;
  }
  function isObjectArray(arr) { return Array.isArray(arr) && arr.length > 0 && arr.every(x => x && typeof x === 'object' && !Array.isArray(x)); }
  function cell(v) {
    if (v == null || v === '') return '<span class="nr-muted">—</span>';
    if (typeof v === 'number') return esc(Number(v).toLocaleString('ar-SA', { maximumFractionDigits:2 }));
    if (typeof v === 'boolean') return v ? 'نعم' : 'لا';
    if (typeof v === 'object') return '<details><summary>تفاصيل</summary><pre>' + esc(JSON.stringify(v, null, 2)) + '</pre></details>';
    return esc(v);
  }
  function renderTable(arr) {
    const rows = Array.isArray(arr) ? arr : [];
    const preferred = ['name','employeeName','jobTitle','category','nationality','iqamaId','idNumber','attendanceDays','absenceDays','leaveDays','deduction','absencePenalty','totalFine','netSalary','salary','item','itemName','materialName','quantity','qty','unit','price','unitPrice','total','amount','percentage','percent','deductionAmount','score','notes'];
    const colsSet = new Set();
    preferred.forEach(c => rows.some(r => r && r[c] !== undefined) && colsSet.add(c));
    rows.forEach(r => Object.keys(r || {}).forEach(k => { if (k !== 'days') colsSet.add(k); }));
    const cols = Array.from(colsSet);
    if (!cols.length) return emptyBox('لا توجد أعمدة قابلة للعرض');
    return '<div class="nr-table-card"><div class="nr-table-wrap"><table class="nr-table"><thead><tr>' + cols.map((c,i) => '<th>' + esc(fieldLabel(c,i)) + '</th>').join('') + '</tr></thead><tbody>' + rows.map(r => '<tr>' + cols.map(c => '<td>' + cell(r ? r[c] : '') + '</td>').join('') + '</tr>').join('') + '</tbody></table></div><div class="nr-note">تم عرض كامل البيانات: ' + rows.length + ' سجل</div></div>';
  }
  function countDays(days) {
    const c = { present:0, absent:0, leave:0, vacant:0, pending:0, start:0, end:0, other:0 };
    (Array.isArray(days) ? days : []).forEach(d => {
      if (d === 'ح') c.present++; else if (d === 'غ') c.absent++; else if (d === 'ج') c.leave++;
      else if (d === 'ش') c.vacant++; else if (d === 'ت') c.pending++; else if (d === 'ب') c.start++;
      else if (d === 'ن') c.end++; else c.other++;
    });
    return c;
  }
  function dayStrip(days) {
    if (!Array.isArray(days) || !days.length) return '<span class="nr-muted">—</span>';
    return '<div class="nr-days-strip">' + days.map((d, i) => '<span class="nr-day nr-day-' + esc(d) + '" title="يوم ' + (i + 1) + ' — ' + esc(DAY_LABELS[d] || d || 'غير محدد') + '">' + esc(d || '—') + '</span>').join('') + '</div>';
  }
  function renderAttendance(data) {
    if (!data || typeof data !== 'object') return renderValue(data);
    const depts = Object.keys(data).filter(k => Array.isArray(data[k]));
    if (!depts.length) return renderValue(data);
    let empTotal = 0, presentTotal = 0, absentTotal = 0, deductionTotal = 0, fineTotal = 0, netTotal = 0;
    const cards = depts.map(dept => {
      const rows = data[dept] || [];
      let deptAbsent = 0, deptNet = 0;
      rows.forEach(emp => {
        const c = countDays(emp.days);
        empTotal++;
        presentTotal += Number(emp.attendanceDays ?? c.present ?? 0);
        absentTotal += Number(emp.absenceDays ?? c.absent ?? 0);
        deptAbsent += Number(emp.absenceDays ?? c.absent ?? 0);
        deductionTotal += Number(emp.deduction || 0);
        fineTotal += Number(emp.totalFine || emp.absencePenalty || 0);
        deptNet += Number(emp.netSalary || 0);
        netTotal += Number(emp.netSalary || 0);
      });
      const body = rows.map((emp, idx) => {
        const c = countDays(emp.days);
        return '<tr><td>' + (idx + 1) + '</td><td class="nr-strong">' + esc(emp.name || emp.employeeName || '—') + '</td><td>' + esc(emp.jobTitle || '—') + '</td><td>' + esc(emp.category || '—') + '</td><td>' + esc(emp.nationality || '—') + '</td><td>' + esc(emp.iqamaId || emp.idNumber || '—') + '</td><td>' + (emp.attendanceDays ?? c.present) + '</td><td>' + (emp.absenceDays ?? c.absent) + '</td><td>' + c.leave + '</td><td>' + c.vacant + '</td><td>' + c.pending + '</td><td>' + money(emp.deduction) + '</td><td>' + money(emp.totalFine || emp.absencePenalty) + '</td><td>' + money(emp.netSalary) + '</td><td>' + dayStrip(emp.days) + '</td></tr>';
      }).join('');
      return '<article class="nr-panel"><div class="nr-panel-head"><h4>' + esc(DEPT_NAMES[dept] || dept || 'قسم غير محدد') + '</h4><div><span>' + rows.length + ' موظف</span><span>غياب: ' + deptAbsent + '</span><span>الصافي: ' + money(deptNet) + '</span></div></div><div class="nr-table-wrap"><table class="nr-table nr-att-table"><thead><tr><th>#</th><th>الموظف</th><th>الوظيفة</th><th>الفئة</th><th>الجنسية</th><th>الإقامة</th><th>حضور</th><th>غياب</th><th>إجازة</th><th>شاغرة</th><th>تحت الإجراء</th><th>الحسم</th><th>الغرامة</th><th>الصافي</th><th>أيام الشهر</th></tr></thead><tbody>' + body + '</tbody></table></div></article>';
    }).join('');
    return summaryCards([
      ['إجمالي الموظفين', empTotal], ['أيام الحضور', presentTotal], ['أيام الغياب', absentTotal], ['إجمالي الحسم', money(deductionTotal)], ['إجمالي الغرامات', money(fineTotal)], ['صافي الاستحقاق', money(netTotal)]
    ]) + cards;
  }
  function summaryCards(items) {
    return '<div class="nr-summary-grid">' + items.map(x => '<div class="nr-summary-card"><b>' + esc(x[1]) + '</b><span>' + esc(x[0]) + '</span></div>').join('') + '</div>';
  }
  function renderValue(value) {
    if (isObjectArray(value)) return renderTable(value);
    if (Array.isArray(value)) return value.length ? '<div class="nr-list">' + value.map(x => '<div class="nr-list-item">' + cell(x) + '</div>').join('') + '</div>' : emptyBox('لا توجد بيانات مسجلة');
    if (value && typeof value === 'object') {
      const keys = Object.keys(value);
      if (!keys.length) return emptyBox('لا توجد بيانات مسجلة');
      const arrayKey = keys.find(k => isObjectArray(value[k]));
      if (arrayKey) return '<div class="nr-subtitle">' + esc(fieldLabel(arrayKey,0)) + '</div>' + renderTable(value[arrayKey]);
      return '<div class="nr-kv-grid">' + keys.map((k,i) => '<div class="nr-kv"><span>' + esc(fieldLabel(k,i)) + '</span><b>' + cell(value[k]) + '</b></div>').join('') + '</div>';
    }
    return summaryCards([['القيمة', value == null || value === '' ? '—' : value]]);
  }
  function emptyBox(text) {
    return '<div class="nr-empty"><b>' + esc(text) + '</b><span>هذا الجزء غير موجود داخل نسخة الرفع الحالية.</span></div>';
  }
  function renderSummary(e, snapshot, defs) {
    const meta = metaOf(e);
    const checklist = defs.filter(d => !d.special).map(def => {
      const ok = sectionEntries(snapshot, def).length > 0;
      return '<div class="nr-check ' + (ok ? 'ok' : 'bad') + '"><b>' + def.icon + ' ' + esc(def.title) + '</b><span>' + (ok ? 'موجود داخل نسخة الرفع' : 'غير موجود داخل نسخة الرفع') + '</span></div>';
    }).join('');
    return '<section class="nr-section active" id="nr-sec-summary"><div class="nr-section-title"><h3>🧾 ملخص المراجعة</h3><span class="nr-state">مراجعة كاملة</span></div>' +
      summaryCards([
        ['نوع المستخلص', TYPE_LABELS[e.extractType] || e.extractType || '—'], ['رقم الدفعة', meta.paymentNumber], ['الفترة', meta.period], ['من تاريخ', meta.start], ['إلى تاريخ', meta.end], ['قيمة المستخلص', money(e.totalAmount)]
      ]) +
      '<article class="nr-data-block"><header>بيانات الرفع والاعتماد</header><div class="nr-kv-grid">' +
      '<div class="nr-kv"><span>المستشفى</span><b>' + esc(e.hospitalName || e.submittedByHospital || '—') + '</b></div>' +
      '<div class="nr-kv"><span>الشركة</span><b>' + esc(e.companyName || '—') + '</b></div>' +
      '<div class="nr-kv"><span>رقم العقد</span><b>' + esc(e.contractNumber || '—') + '</b></div>' +
      '<div class="nr-kv"><span>الحالة</span><b>' + esc(STATUS_TEXT[e.status] || e.status || '—') + '</b></div>' +
      '<div class="nr-kv"><span>رفع بواسطة</span><b>' + esc(e.submittedByName || '—') + '</b></div>' +
      '<div class="nr-kv"><span>تاريخ الرفع</span><b>' + esc(fmtDate(e.createdAt)) + '</b></div>' +
      '<div class="nr-kv"><span>اعتمد بواسطة</span><b>' + esc(e.approvedBy || '—') + '</b></div>' +
      '<div class="nr-kv"><span>تاريخ الاعتماد</span><b>' + esc(fmtDate(e.approvedAt)) + '</b></div>' +
      '</div></article><article class="nr-data-block"><header>قائمة أجزاء المراجعة الخاصة بهذا النوع فقط</header><div class="nr-check-grid">' + checklist + '</div></article>' +
      (e.adminNotes ? '<article class="nr-data-block"><header>ملاحظات المراجع</header><div class="nr-note-box">' + esc(e.adminNotes) + '</div></article>' : '') +
      '</section>';
  }
  function renderSection(snapshot, def, active) {
    const entries = sectionEntries(snapshot, def);
    const state = entries.length ? 'بيانات متاحة للمراجعة' : 'غير مرفوع داخل هذه النسخة';
    if (!entries.length) {
      return '<section class="nr-section' + (active ? ' active' : '') + '" id="nr-sec-' + esc(def.id) + '"><div class="nr-section-title"><h3>' + def.icon + ' ' + esc(def.title) + '</h3><span class="nr-state nr-state-warn">' + state + '</span></div>' + emptyBox('لا توجد بيانات محفوظة لهذا الجزء') + '</section>';
    }
    return '<section class="nr-section' + (active ? ' active' : '') + '" id="nr-sec-' + esc(def.id) + '"><div class="nr-section-title"><h3>' + def.icon + ' ' + esc(def.title) + '</h3><span class="nr-state">' + state + '</span></div>' + entries.map(entry => '<article class="nr-data-block"><header>' + esc(arabicKey(entry.key)) + '</header>' + (def.id === 'attendance' && /attendance/i.test(entry.key) ? renderAttendance(entry.value) : renderValue(entry.value)) + '</article>').join('') + '</section>';
  }
  function sectionStatus(snapshot, def) { return def.special ? 'ملخص' : (sectionEntries(snapshot, def).length ? 'مكتمل' : 'ناقص'); }
  function defsForType(type) {
    const out = SECTION_DEFS.filter(d => !d.types || d.types.includes(type));
    return out.length ? out : SECTION_DEFS;
  }
  function injectReviewStyles() {
    if (document.getElementById('najran-review-details-style')) return;
    const style = document.createElement('style');
    style.id = 'najran-review-details-style';
    style.textContent = `
      .nr-detail-btn{background:linear-gradient(135deg,#123b6d,#1e6aa8)!important;color:#fff!important;border-color:transparent!important;box-shadow:0 8px 18px rgba(30,60,114,.18)!important;font-weight:900!important}.nr-detail-btn::before{content:'📂'}
      .nr-overlay{position:fixed;inset:0;background:rgba(15,23,42,.66);z-index:999999;display:none;align-items:stretch;justify-content:center;padding:18px;direction:rtl}.nr-overlay.open{display:flex}
      .nr-modal{background:#eef3f8;width:min(1460px,100%);border-radius:24px;box-shadow:0 28px 90px rgba(0,0,0,.38);display:grid;grid-template-rows:auto auto auto auto 1fr;overflow:hidden;border:1px solid rgba(255,255,255,.5)}
      .nr-head{background:linear-gradient(135deg,#0f2f55,#1e5d92);color:#fff;padding:22px 26px;display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.nr-head h2{font-size:22px;font-weight:900;margin:0}.nr-head p{font-size:13px;opacity:.82;margin-top:6px}.nr-close{background:rgba(255,255,255,.14);color:#fff;border:1px solid rgba(255,255,255,.28);border-radius:12px;padding:9px 15px;cursor:pointer;font-family:inherit;font-weight:900}
      .nr-alert{background:#ecfdf5;color:#166534;border-bottom:1px solid #bbf7d0;padding:10px 18px;font-size:12px;font-weight:900}.nr-topline{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px;padding:14px 18px;background:#fff;border-bottom:1px solid #dbe5ef}.nr-top-card{border:1px solid #e2e8f0;border-radius:14px;padding:12px;background:linear-gradient(180deg,#fff,#f8fafc)}.nr-top-card b{display:block;color:#123b6d;font-size:15px}.nr-top-card span{font-size:11px;color:#64748b;font-weight:800}
      .nr-actionbar{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:12px 18px;background:#fff7ed;border-bottom:1px solid #fed7aa}.nr-actionbar textarea{width:100%;resize:vertical;min-height:46px;border:1.5px solid #fdba74;border-radius:12px;padding:10px;font-family:inherit;font-size:13px}.nr-actions{display:flex;gap:8px;flex-wrap:wrap}.nr-act{border:none;border-radius:12px;padding:10px 14px;font-family:inherit;font-weight:900;cursor:pointer;color:#fff}.nr-act.review{background:#1e5d92}.nr-act.revision{background:#ea580c}.nr-act.approve{background:#16a34a}.nr-act.reject{background:#dc2626}
      .nr-tabs{display:flex;gap:9px;overflow-x:auto;padding:14px 18px;background:#f8fafc;border-bottom:1px solid #dbe5ef}.nr-tab{white-space:nowrap;border:1px solid #dbe5ef;background:#fff;color:#334155;border-radius:999px;padding:9px 15px;font-family:inherit;font-size:12px;font-weight:900;cursor:pointer;display:flex;align-items:center;gap:7px}.nr-tab small{font-size:10px;border-radius:999px;padding:2px 7px;background:#eef2f7;color:#64748b}.nr-tab.active{background:#123b6d;color:#fff;border-color:#123b6d}.nr-tab.active small{background:rgba(255,255,255,.18);color:#fff}.nr-tab.warn small{background:#fff7ed;color:#c2410c}
      .nr-body{padding:18px;overflow:auto;max-height:calc(100vh - 360px)}.nr-section{display:none}.nr-section.active{display:block}.nr-section-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.nr-section-title h3{font-size:20px;color:#123b6d;margin:0;font-weight:900}.nr-state{background:#ecfdf5;color:#15803d;border:1px solid #bbf7d0;border-radius:999px;padding:5px 11px;font-size:11px;font-weight:900}.nr-state-warn{background:#fff7ed;color:#c2410c;border-color:#fed7aa}
      .nr-data-block{background:#fff;border:1px solid #dbe5ef;border-radius:20px;margin-bottom:16px;overflow:hidden;box-shadow:0 6px 18px rgba(15,47,85,.05)}.nr-data-block>header{background:#f8fafc;color:#123b6d;font-size:14px;font-weight:900;padding:13px 16px;border-bottom:1px solid #e2e8f0}.nr-summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px;padding:14px}.nr-summary-card{background:linear-gradient(180deg,#f0f9ff,#fff);border:1px solid #bae6fd;border-radius:15px;padding:13px;text-align:center}.nr-summary-card b{display:block;color:#0c4a6e;font-size:18px}.nr-summary-card span{font-size:11px;color:#0369a1;font-weight:900}
      .nr-check-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;padding:14px}.nr-check{border-radius:14px;padding:13px;border:1px solid}.nr-check b{display:block;font-size:14px;margin-bottom:4px}.nr-check span{font-size:12px;font-weight:800}.nr-check.ok{background:#f0fdf4;border-color:#bbf7d0;color:#166534}.nr-check.bad{background:#fff7ed;border-color:#fed7aa;color:#9a3412}
      .nr-panel{margin:14px;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden}.nr-panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;background:#f8fafc;padding:12px 14px;border-bottom:1px solid #e2e8f0}.nr-panel-head h4{margin:0;color:#123b6d;font-size:15px}.nr-panel-head div{display:flex;gap:8px;flex-wrap:wrap}.nr-panel-head span{font-size:11px;background:#fff;border:1px solid #dbe5ef;border-radius:999px;padding:4px 9px;color:#475569;font-weight:900}
      .nr-table-card{padding:14px}.nr-table-wrap{overflow:auto}.nr-table{width:100%;border-collapse:separate;border-spacing:0;font-size:12px;background:#fff}.nr-table th{background:#123b6d;color:#fff;padding:10px;white-space:nowrap;position:sticky;top:0;z-index:1}.nr-table td{border-bottom:1px solid #edf2f7;padding:9px;vertical-align:top;max-width:520px}.nr-table tr:nth-child(even) td{background:#f8fafc}.nr-att-table td{white-space:nowrap}.nr-strong{font-weight:900;color:#123b6d}
      .nr-kv-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;padding:14px}.nr-kv{background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:12px}.nr-kv span{display:block;font-size:11px;color:#64748b;font-weight:900;margin-bottom:5px}.nr-kv b{display:block;font-size:14px;color:#1e293b;word-break:break-word}.nr-muted{color:#94a3b8}.nr-empty{margin:14px;padding:28px;text-align:center;color:#64748b;background:#f8fafc;border:1.5px dashed #cbd5e1;border-radius:16px}.nr-empty b{display:block;color:#334155;margin-bottom:5px}.nr-empty span{font-size:12px}.nr-list{padding:14px;display:grid;gap:8px}.nr-list-item{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px;font-size:12px}.nr-subtitle{font-size:12px;font-weight:900;color:#123b6d;margin:12px 14px 0}.nr-note,.nr-note-box{margin:14px;padding:12px;border-radius:12px;background:#fffbeb;border:1px solid #fde68a;color:#92400e;font-size:12px;font-weight:800;line-height:1.7}
      .nr-days-strip{display:flex;gap:2px;min-width:240px}.nr-day{display:inline-flex;width:20px;height:20px;border-radius:6px;align-items:center;justify-content:center;font-size:11px;font-weight:900;border:1px solid #e2e8f0}.nr-day-ح{background:#e8f0fe;color:#1d4ed8}.nr-day-غ{background:#fee2e2;color:#b91c1c}.nr-day-ج{background:#fef3c7;color:#b45309}.nr-day-ش{background:#d1ecf1;color:#0369a1}.nr-day-ت{background:#e2e8f0;color:#475569}.nr-day-ب,.nr-day-ن{background:#f3e8ff;color:#7e22ce}pre{white-space:pre-wrap;direction:ltr;text-align:left;font-size:11px}@media(max-width:900px){.nr-actionbar{grid-template-columns:1fr}.nr-overlay{padding:6px}.nr-head{padding:16px}.nr-body{max-height:calc(100vh - 410px)}}@media print{.nr-overlay{display:none!important}}
    `;
    document.head.appendChild(style);
  }
  function ensureModal() {
    injectReviewStyles();
    let overlay = document.getElementById('najran-review-details-overlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'najran-review-details-overlay';
    overlay.className = 'nr-overlay';
    overlay.innerHTML = '<div class="nr-modal"><div class="nr-head"><div><h2 id="nr-title">ملف المراجعة التفصيلية</h2><p id="nr-subtitle">نسخة كاملة من بيانات المستخلص وقت الرفع</p></div><button class="nr-close" onclick="window.closeNajranReviewDetails()">إغلاق ✕</button></div><div class="nr-alert"><b>المسار الصحيح:</b> راجع البيانات كاملة. عند وجود ملاحظة اكتبها واضغط طلب تعديل. عند عدم وجود ملاحظات اضغط اعتماد.</div><div class="nr-topline" id="nr-topline"></div><div class="nr-actionbar" id="nr-actionbar"><textarea id="nr-action-notes" placeholder="اكتب ملاحظة المراجع هنا عند طلب التعديل أو الرفض..."></textarea><div class="nr-actions" id="nr-actions"></div></div><div class="nr-tabs" id="nr-tabs"></div><div class="nr-body" id="nr-body"></div></div>';
    overlay.addEventListener('click', e => { if (e.target === overlay) window.closeNajranReviewDetails(); });
    document.body.appendChild(overlay);
    return overlay;
  }
  function activateSection(id) {
    document.querySelectorAll('.nr-tab').forEach(b => b.classList.toggle('active', b.dataset.id === id));
    document.querySelectorAll('.nr-section').forEach(s => s.classList.toggle('active', s.id === 'nr-sec-' + id));
  }
  window.closeNajranReviewDetails = function () {
    const overlay = document.getElementById('najran-review-details-overlay');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
  };
  window.najranReviewAction = function (id, status) {
    const e = getGlobalExtractById(id);
    const notesBox = document.getElementById('nr-action-notes');
    const note = notesBox ? notesBox.value.trim() : '';
    if ((status === 'needs_revision' || status === 'rejected') && !note) {
      alert('اكتب الملاحظة أولاً حتى يعرف المستخدم سبب الإرجاع');
      if (notesBox) notesBox.focus();
      return;
    }
    if (status === 'approved' && !confirm('اعتماد المستخلص بعد المراجعة؟')) return;
    if (status === 'needs_revision' && !confirm('إرجاع المستخلص للمستخدم بطلب تعديل؟')) return;
    if (status === 'rejected' && !confirm('رفض المستخلص؟')) return;
    let hidden = document.getElementById('notes-' + id);
    if (!hidden) {
      hidden = document.createElement('textarea');
      hidden.id = 'notes-' + id;
      hidden.style.display = 'none';
      document.body.appendChild(hidden);
    }
    hidden.value = note || (e && e.adminNotes) || '';
    if (typeof updateStatus === 'function') {
      window.closeNajranReviewDetails();
      updateStatus(id, status);
    } else {
      alert('تعذر تنفيذ الإجراء الآن');
    }
  };
  window.openNajranReviewDetails = function (id) {
    const e = getGlobalExtractById(id);
    if (!e) return alert('تعذر العثور على بيانات المستخلص في الصفحة');
    const snapshot = snapshotOf(e);
    const meta = metaOf(e);
    const defs = defsForType(e.extractType);
    const overlay = ensureModal();
    document.getElementById('nr-title').textContent = 'مراجعة تفصيلية — ' + (TYPE_LABELS[e.extractType] || e.extractType || 'مستخلص');
    document.getElementById('nr-subtitle').textContent = (e.hospitalName || e.submittedByHospital || '—') + ' · ' + meta.period + ' · دفعة ' + meta.paymentNumber;
    const notesBox = document.getElementById('nr-action-notes');
    if (notesBox) notesBox.value = e.adminNotes || '';
    document.getElementById('nr-topline').innerHTML =
      '<div class="nr-top-card"><span>نوع المستخلص</span><b>' + esc(TYPE_LABELS[e.extractType] || e.extractType || '—') + '</b></div>' +
      '<div class="nr-top-card"><span>رقم الدفعة</span><b>' + esc(meta.paymentNumber) + '</b></div>' +
      '<div class="nr-top-card"><span>الفترة</span><b>' + esc(meta.period) + '</b></div>' +
      '<div class="nr-top-card"><span>من / إلى</span><b>' + esc(meta.start) + ' — ' + esc(meta.end) + '</b></div>' +
      '<div class="nr-top-card"><span>المبلغ</span><b>' + money(e.totalAmount) + '</b></div>' +
      '<div class="nr-top-card"><span>الحالة</span><b>' + esc(STATUS_TEXT[e.status] || e.status || '—') + '</b></div>';
    document.getElementById('nr-actions').innerHTML =
      (e.status === 'submitted' ? '<button class="nr-act review" onclick="window.najranReviewAction(' + Number(e.id) + ',\'under_review\')">بدء المراجعة</button>' : '') +
      (e.status !== 'needs_revision' && e.status !== 'approved' ? '<button class="nr-act revision" onclick="window.najranReviewAction(' + Number(e.id) + ',\'needs_revision\')">طلب تعديل</button>' : '') +
      (e.status !== 'approved' ? '<button class="nr-act approve" onclick="window.najranReviewAction(' + Number(e.id) + ',\'approved\')">اعتماد</button>' : '') +
      (e.status !== 'rejected' && e.status !== 'approved' ? '<button class="nr-act reject" onclick="window.najranReviewAction(' + Number(e.id) + ',\'rejected\')">رفض</button>' : '');
    document.getElementById('nr-tabs').innerHTML = defs.map((def, idx) => {
      const st = sectionStatus(snapshot, def);
      return '<button class="nr-tab ' + (idx === 0 ? 'active ' : '') + (st === 'ناقص' ? 'warn' : '') + '" data-id="' + esc(def.id) + '" onclick="window.activateNajranReviewSection(\'' + esc(def.id) + '\')"><span>' + def.icon + ' ' + esc(def.title) + '</span><small>' + st + '</small></button>';
    }).join('');
    document.getElementById('nr-body').innerHTML = defs.map((def, idx) => def.special ? renderSummary(e, snapshot, defs) : renderSection(snapshot, def, idx === 0)).join('');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  };
  window.activateNajranReviewSection = activateSection;
  function enhanceApprovalCards() {
    let extracts = [];
    try { if (typeof allExtracts !== 'undefined' && Array.isArray(allExtracts)) extracts = allExtracts; } catch (_) { return; }
    if (!extracts.length) return;
    extracts.forEach(e => {
      const card = document.getElementById('card-' + e.id);
      if (!card) return;
      const body = card.querySelector('.card-body.open');
      if (!body || body.querySelector('.nr-detail-wrap')) return;
      const btnWrap = document.createElement('div');
      btnWrap.className = 'nr-detail-wrap';
      btnWrap.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px;border-bottom:1px solid #f1f5f9;padding-bottom:12px';
      btnWrap.innerHTML = '<button type="button" class="admin-btn nr-detail-btn" onclick="window.openNajranReviewDetails(' + Number(e.id) + ')">فتح ملف المراجعة التفصيلية</button>';
      body.insertBefore(btnWrap, body.firstChild);
    });
  }
  function installEnhancer() {
    injectReviewStyles();
    const timer = setInterval(enhanceApprovalCards, 700);
    window.addEventListener('beforeunload', () => clearInterval(timer));
    try {
      if (typeof renderList === 'function' && !renderList.__najranReviewWrapped) {
        const originalRenderList = renderList;
        renderList = function () {
          const r = originalRenderList.apply(this, arguments);
          setTimeout(enhanceApprovalCards, 0);
          return r;
        };
        renderList.__najranReviewWrapped = true;
      }
    } catch (_) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installEnhancer);
  else installEnhancer();
})();
