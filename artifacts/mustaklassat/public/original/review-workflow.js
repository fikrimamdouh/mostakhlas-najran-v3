/*
 * review-workflow.js
 * طبقة مراجعة مهنية فوق عارض المستخلص الحالي.
 * لا يغير المعادلات أو الطباعة أو الرفع أو قاعدة البيانات.
 */
(function () {
  'use strict';

  if (!/\/original\/approval\.html(?:$|[?#])/.test(location.pathname + location.search)) return;

  const SECTIONS = [
    ['attendance', 'الحضور والانصراف'],
    ['performance', 'تقييم الأداء'],
    ['achievement', 'شهادة الإنجاز'],
    ['consumables', 'المستهلكات والمواد'],
    ['spare', 'قطع الغيار']
  ];

  const DEPT = {
    cleaning:'النظافة', electricity:'الكهرباء', agriculture:'الزراعة', civil_works:'الأعمال المدنية', 'civil-works':'الأعمال المدنية',
    mechanical:'الميكانيكا', security:'الأمن', laundry:'المغسلة', patient_services:'خدمات المرضى', 'patient-services':'خدمات المرضى',
    admin_saudi:'الإداريون السعوديون', 'admin-saudi':'الإداريون السعوديون', operations:'التشغيل', maintenance:'الصيانة', general:'عام'
  };

  const LABEL = {
    name:'الاسم', employeeName:'اسم الموظف', jobTitle:'الوظيفة', category:'الفئة', nationality:'الجنسية', iqamaId:'رقم الإقامة',
    attendanceDays:'حضور', absenceDays:'غياب', deduction:'الحسم', absencePenalty:'غرامة الغياب', totalFine:'الغرامة', netSalary:'الصافي', salary:'الراتب',
    item:'الصنف', itemName:'الصنف', materialName:'الصنف', title:'البيان', description:'الوصف', quantity:'الكمية', qty:'الكمية', unit:'الوحدة', price:'السعر', unitPrice:'سعر الوحدة',
    total:'الإجمالي', amount:'المبلغ', value:'القيمة', percentage:'النسبة', percent:'النسبة', deductionAmount:'قيمة الخصم', score:'التقييم', grade:'الدرجة', notes:'ملاحظات', note:'ملاحظة', status:'الحالة'
  };

  const SNAPSHOT_MAP = {
    performance: {
      keys:['performanceData','performanceTotalDeduction','ng_performanceTotalDeduction','nd_performanceTotalDeduction','performance_data_consumables_v27'],
      prefixes:['dept_','performance_']
    },
    achievement: {
      keys:['achievementData','achievementTitles_v1','achievementItemNames','nd_dentalAchievementTotals'],
      prefixes:['achievement_','nd_dentalAchievement']
    },
    consumables: {
      keys:['consumablesTableData','subcontractorsTableData','waterTableData','healthCentersConsumables','mainHospitalConsumables','admin_offices_consumables_v1.0','finalConsumablesCost','penaltyValue','water_supply_data_consumables_v27','sewage_disposal_data_consumables_v27','subcontractors_data_consumables_v27','consumablesPeriodFrom','consumablesPeriodTo'],
      prefixes:['consumables_','water_','sewage_','subcontractors_']
    },
    spare: {
      keys:['spare_partsData','sparePartsTotalAmount'],
      prefixes:['spare_']
    },
    attendance: {
      keys:['attendanceData','ng_attendanceData','nd_attendanceData','centersAttendanceData_v2','healthCentersAttendanceData','adminOfficesAttendanceData_v1'],
      prefixes:['deptCalculatedCost_']
    }
  };

  let currentReviewId = null;

  function esc(v) { return String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function norm(k) { return String(k || '').replace(/^_u\d+_/, ''); }
  function parse(raw) { if (!raw) return {}; if (typeof raw === 'object') return raw; try { return JSON.parse(raw); } catch (_) { return {}; } }
  function money(n) { const v = Number(n || 0); return v ? v.toLocaleString('ar-SA', { minimumFractionDigits:2, maximumFractionDigits:2 }) : '—'; }
  function field(k, i) {
    if (LABEL[k]) return LABEL[k];
    const c = String(k || '').toLowerCase();
    if (c.includes('name')) return 'الاسم';
    if (c.includes('date')) return 'التاريخ';
    if (c.includes('total')) return 'الإجمالي';
    if (c.includes('amount') || c.includes('cost')) return 'المبلغ';
    if (c.includes('note')) return 'ملاحظات';
    if (c.includes('percent')) return 'النسبة';
    if (c.includes('qty') || c.includes('quantity')) return 'الكمية';
    if (c.includes('price')) return 'السعر';
    if (c.includes('score') || c.includes('grade')) return 'التقييم';
    return 'بيان ' + (i + 1);
  }
  function cell(v) {
    if (v == null || v === '') return '<span class="muted">—</span>';
    if (typeof v === 'number') return esc(Number(v).toLocaleString('ar-SA', { maximumFractionDigits:2 }));
    if (typeof v === 'boolean') return v ? 'نعم' : 'لا';
    if (typeof v === 'object') return '<span class="muted">تفاصيل</span>';
    return esc(v);
  }
  function isObjArr(v) { return Array.isArray(v) && v.length > 0 && v.every(x => x && typeof x === 'object' && !Array.isArray(x)); }
  function findExtract(id) {
    try { if (typeof allExtracts !== 'undefined' && Array.isArray(allExtracts)) return allExtracts.find(e => String(e.id) === String(id)) || null; } catch (_) {}
    return null;
  }
  function getSnapshot() {
    const e = findExtract(currentReviewId);
    return parse(e && e.extractData);
  }
  function entries(snapshot, type) {
    const m = SNAPSHOT_MAP[type] || { keys:[], prefixes:[] };
    const exact = new Set(m.keys || []);
    const out = [];
    Object.keys(snapshot || {}).forEach(raw => {
      const k = norm(raw);
      if (exact.has(k) || (m.prefixes || []).some(p => k.startsWith(p))) out.push({ key:k, value:snapshot[raw] });
    });
    return out;
  }
  function labelKey(k) {
    if (k.startsWith('deptCalculatedCost_')) return 'تكلفة قسم ' + (DEPT[k.replace('deptCalculatedCost_', '')] || 'غير محدد');
    if (k.startsWith('dept_')) return 'جدول أداء: ' + (DEPT[k.replace('dept_', '')] || k.replace('dept_', ''));
    const map = {
      performanceData:'جداول تقييم الأداء', performanceTotalDeduction:'إجمالي خصومات الأداء', ng_performanceTotalDeduction:'إجمالي خصومات أداء نجران العام', nd_performanceTotalDeduction:'إجمالي خصومات أداء طب الأسنان', performance_data_consumables_v27:'تقييم أداء المستهلكات',
      achievementData:'شهادة الإنجاز', achievementTitles_v1:'بنود شهادة الإنجاز', achievementItemNames:'أسماء بنود الإنجاز', nd_dentalAchievementTotals:'إجماليات إنجاز طب الأسنان',
      consumablesTableData:'قسم المستهلكات', subcontractorsTableData:'قسم مقاولي الباطن', waterTableData:'قسم تأمين المياه', finalConsumablesCost:'إجمالي المستهلكات', penaltyValue:'الغرامات', water_supply_data_consumables_v27:'قسم توريد المياه', sewage_disposal_data_consumables_v27:'قسم التخلص من الصرف الصحي', subcontractors_data_consumables_v27:'قسم مقاولي الباطن',
      spare_partsData:'جدول قطع الغيار', sparePartsTotalAmount:'إجمالي قطع الغيار'
    };
    return map[k] || 'بيانات مراجعة';
  }

  function table(rows, preferred) {
    if (!Array.isArray(rows) || !rows.length) return empty('لا توجد بيانات جدولية');
    const r = rows.slice(0, 300);
    const pref = preferred || ['name','employeeName','jobTitle','category','nationality','iqamaId','attendanceDays','absenceDays','deduction','absencePenalty','totalFine','netSalary','item','itemName','materialName','quantity','qty','unit','price','unitPrice','total','amount','percentage','deductionAmount','score','notes'];
    const set = new Set();
    pref.forEach(c => r.some(x => x && x[c] !== undefined) && set.add(c));
    r.forEach(x => Object.keys(x || {}).slice(0, 28).forEach(k => { if (k !== 'days') set.add(k); }));
    const cols = Array.from(set).slice(0, 16);
    if (!cols.length) return empty('لا توجد أعمدة قابلة للعرض');
    return '<div class="rw-table-wrap"><table class="rw-table"><thead><tr>' + cols.map((c,i) => '<th>' + esc(field(c,i)) + '</th>').join('') + '</tr></thead><tbody>' + r.map(x => '<tr>' + cols.map(c => '<td>' + cell(x ? x[c] : '') + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
  }

  function valueView(v) {
    if (isObjArr(v)) return table(v);
    if (Array.isArray(v)) return v.length ? '<div class="rw-list">' + v.map((x,i) => '<div><b>بند ' + (i+1) + '</b><span>' + cell(x) + '</span></div>').join('') + '</div>' : empty('لا توجد بيانات');
    if (v && typeof v === 'object') {
      const keys = Object.keys(v);
      const arrKey = keys.find(k => isObjArr(v[k]));
      if (arrKey) return '<h5 class="rw-subtitle">' + esc(field(arrKey,0)) + '</h5>' + table(v[arrKey]);
      return '<div class="rw-kv">' + keys.slice(0,80).map((k,i) => '<div><span>' + esc(field(k,i)) + '</span><b>' + cell(v[k]) + '</b></div>').join('') + '</div>';
    }
    return '<div class="rw-mini-grid"><div><b>' + cell(v) + '</b><span>القيمة</span></div></div>';
  }
  function empty(text) { return '<div class="rw-empty">' + esc(text) + '</div>'; }

  function countDays(days) {
    const c = { p:0, a:0, l:0, v:0, w:0 };
    (Array.isArray(days) ? days : []).forEach(d => { if (d === 'ح') c.p++; else if (d === 'غ') c.a++; else if (d === 'ج') c.l++; else if (d === 'ش') c.v++; else if (d === 'ت') c.w++; });
    return c;
  }
  function daysStrip(days) {
    if (!Array.isArray(days) || !days.length) return '<span class="muted">—</span>';
    return '<div class="rw-days">' + days.map(d => '<span class="d d-' + esc(d) + '">' + esc(d || '—') + '</span>').join('') + '</div>';
  }
  function renderAttendance(data) {
    const depts = data && typeof data === 'object' ? Object.keys(data).filter(k => Array.isArray(data[k])) : [];
    if (!depts.length) return valueView(data);
    let emp=0,p=0,a=0,ded=0,fine=0,net=0;
    const panels = depts.map(dept => {
      const rows = data[dept] || [];
      let da=0,dn=0;
      rows.forEach(e => { const c=countDays(e.days); emp++; p+=Number(e.attendanceDays ?? c.p ?? 0); a+=Number(e.absenceDays ?? c.a ?? 0); da+=Number(e.absenceDays ?? c.a ?? 0); ded+=Number(e.deduction||0); fine+=Number(e.totalFine||e.absencePenalty||0); dn+=Number(e.netSalary||0); net+=Number(e.netSalary||0); });
      const body = rows.map((e,i) => { const c=countDays(e.days); return '<tr><td>'+(i+1)+'</td><td class="rw-strong">'+esc(e.name||e.employeeName||'—')+'</td><td>'+esc(e.jobTitle||'—')+'</td><td>'+esc(e.category||'—')+'</td><td>'+esc(e.nationality||'—')+'</td><td>'+esc(e.iqamaId||'—')+'</td><td>'+(e.attendanceDays??c.p)+'</td><td>'+(e.absenceDays??c.a)+'</td><td>'+c.l+'</td><td>'+c.v+'</td><td>'+c.w+'</td><td>'+money(e.deduction)+'</td><td>'+money(e.totalFine||e.absencePenalty)+'</td><td>'+money(e.netSalary)+'</td><td>'+daysStrip(e.days)+'</td></tr>'; }).join('');
      return '<article class="rw-panel"><header><h4>'+esc(DEPT[dept]||'قسم غير محدد')+'</h4><small>'+rows.length+' موظف · غياب '+da+' · صافي '+money(dn)+'</small></header><div class="rw-table-wrap"><table class="rw-table"><thead><tr><th>#</th><th>الموظف</th><th>الوظيفة</th><th>الفئة</th><th>الجنسية</th><th>الإقامة</th><th>حضور</th><th>غياب</th><th>إجازة</th><th>شاغرة</th><th>تحت الإجراء</th><th>الحسم</th><th>الغرامة</th><th>الصافي</th><th>الأيام</th></tr></thead><tbody>'+body+'</tbody></table></div></article>';
    }).join('');
    return '<div class="rw-mini-grid"><div><b>'+emp+'</b><span>الموظفون</span></div><div><b>'+p+'</b><span>حضور</span></div><div><b>'+a+'</b><span>غياب</span></div><div><b>'+money(ded)+'</b><span>الحسم</span></div><div><b>'+money(fine)+'</b><span>الغرامات</span></div><div><b>'+money(net)+'</b><span>الصافي</span></div></div>'+panels;
  }

  function renderPerformance(snapshot) {
    const en = entries(snapshot, 'performance');
    if (!en.length) return empty('لا توجد جداول أداء محفوظة داخل نسخة الرفع');
    const detail = en.filter(e => e.key.startsWith('dept_') || e.key === 'performanceData' || (e.value && typeof e.value === 'object'));
    const totals = en.filter(e => !detail.includes(e));
    const blocks = detail.map(e => '<article class="rw-panel"><header><h4>'+esc(labelKey(e.key))+'</h4><small>جدول مراجعة الأداء</small></header>'+valueView(e.value)+'</article>').join('');
    const totalHtml = totals.length ? '<div class="rw-mini-grid">'+totals.map(e=>'<div><b>'+cell(e.value)+'</b><span>'+esc(labelKey(e.key))+'</span></div>').join('')+'</div>' : '';
    return totalHtml + blocks;
  }
  function renderAchievement(snapshot) {
    const en = entries(snapshot, 'achievement');
    if (!en.length) return empty('شهادة الإنجاز غير محفوظة داخل نسخة الرفع');
    return '<div class="rw-certificate"><h4>شهادة الإنجاز</h4><p>هذه البيانات من الشهادة المحفوظة آليًا من الصفحات السابقة، والتوقيعات يضيفها المستخدم عند الاعتماد الداخلي.</p></div>' + en.map(e => '<article class="rw-panel"><header><h4>'+esc(labelKey(e.key))+'</h4></header>'+valueView(e.value)+'</article>').join('');
  }
  function renderConsumables(snapshot) {
    const en = entries(snapshot, 'consumables');
    if (!en.length) return empty('لا توجد مستهلكات محفوظة داخل نسخة الرفع');
    const order = ['consumablesTableData','subcontractorsTableData','waterTableData','water_supply_data_consumables_v27','sewage_disposal_data_consumables_v27','subcontractors_data_consumables_v27','mainHospitalConsumables','healthCentersConsumables','admin_offices_consumables_v1.0','finalConsumablesCost','penaltyValue'];
    en.sort((a,b)=>(order.indexOf(a.key)<0?99:order.indexOf(a.key))-(order.indexOf(b.key)<0?99:order.indexOf(b.key)));
    return en.map(e => '<article class="rw-panel"><header><h4>'+esc(labelKey(e.key))+'</h4><small>قسم مستقل للمراجعة</small></header>'+valueView(e.value)+'</article>').join('');
  }
  function renderGeneric(snapshot, type, fallback) {
    const en = entries(snapshot, type);
    if (!en.length) return empty(fallback);
    return en.map(e => '<article class="rw-panel"><header><h4>'+esc(labelKey(e.key))+'</h4></header>'+valueView(e.value)+'</article>').join('');
  }

  function replaceSection(id, title, html, status) {
    const sec = document.getElementById('nr-sec-' + id);
    if (!sec) return;
    const review = sec.querySelector('.rw-box');
    sec.innerHTML = '<div class="nr-section-title"><h3>'+esc(title)+'</h3><span class="nr-state">'+esc(status||'بيانات مراجعة')+'</span></div>' + html;
    if (review) sec.appendChild(review);
  }
  function enhanceDetails() {
    const snap = getSnapshot();
    if (!snap || !Object.keys(snap).length) return;
    replaceSection('attendance','الحضور والانصراف', renderGeneric(snap,'attendance','لا توجد بيانات حضور') .replace(/<article class="rw-panel"><header><h4>جدول الحضور والانصراف<\/h4><\/header>([\s\S]*?)<\/article>/, (m) => m), 'تصميم مراجعة محسن');
    const attEn = entries(snap,'attendance');
    if (attEn.length) replaceSection('attendance','الحضور والانصراف', attEn.map(e => '<article class="rw-panel"><header><h4>'+esc(labelKey(e.key))+'</h4></header>' + (e.key.indexOf('attendanceData') !== -1 ? renderAttendance(e.value) : valueView(e.value)) + '</article>').join(''), 'تصميم مراجعة محسن');
    replaceSection('performance','تقييم الأداء', renderPerformance(snap), 'جداول الأداء المفصلة');
    replaceSection('achievement','شهادة الإنجاز', renderAchievement(snap), 'شهادة الإنجاز الآلية');
    replaceSection('consumables','المستهلكات والمواد', renderConsumables(snap), 'الأقسام المفصلة');
    replaceSection('spare','قطع الغيار', renderGeneric(snap,'spare','لا توجد قطع غيار محفوظة داخل نسخة الرفع'), 'حسب المرفق');
  }

  function css() {
    if (document.getElementById('review-workflow-style')) return;
    const s = document.createElement('style');
    s.id = 'review-workflow-style';
    s.textContent = `
      .rw-box{background:#fff;border:1px solid #dbe5ef;border-radius:18px;padding:14px;margin-top:16px;box-shadow:0 4px 14px rgba(15,47,85,.04)}
      .rw-title{font-size:13px;font-weight:900;color:#123b6d;margin-bottom:10px}.rw-options{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px}.rw-options label{background:#f8fafc;border:1px solid #e2e8f0;border-radius:999px;padding:7px 12px;font-size:12px;font-weight:900;color:#334155;cursor:pointer}.rw-options input{vertical-align:middle;margin-left:5px}
      .rw-box textarea,.rw-general textarea{width:100%;border:1.5px solid #dbe5ef;border-radius:14px;padding:11px 13px;font-family:inherit;font-size:13px;resize:vertical;min-height:74px;background:#fff}.rw-general{background:#fff;border-top:1px solid #dbe5ef;padding:14px 18px}.rw-footer{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-start;background:#f8fafc;border-top:1px solid #dbe5ef;padding:14px 18px}.rw-action{border:none;border-radius:14px;padding:11px 18px;font-family:inherit;font-weight:900;cursor:pointer}.rw-revision{background:#ea580c;color:#fff}.rw-review{background:#123b6d;color:#fff}.rw-approve{background:#15803d;color:#fff}.rw-close{background:#e2e8f0;color:#334155}.rw-book{background:#7c3aed;color:#fff}
      .rw-mini-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(115px,1fr));gap:8px;margin:0 0 12px}.rw-mini-grid div{background:#f8fafc;border:1px solid #e2e8f0;border-right:4px solid #1e5d92;border-radius:12px;padding:10px;text-align:center}.rw-mini-grid b{display:block;color:#123b6d;font-size:15px}.rw-mini-grid span{font-size:10px;color:#64748b;font-weight:900}.rw-panel{background:#fff;border:1px solid #dbe5ef;border-radius:16px;margin:12px 0;overflow:hidden;box-shadow:0 4px 12px rgba(15,47,85,.04)}.rw-panel>header{background:linear-gradient(90deg,#f8fafc,#fff);border-bottom:1px solid #e2e8f0;padding:11px 14px;display:flex;justify-content:space-between;align-items:center;gap:12px}.rw-panel h4{margin:0;color:#123b6d;font-size:14px;font-weight:900}.rw-panel small{color:#64748b;font-weight:800}.rw-table-wrap{overflow:auto}.rw-table{width:100%;border-collapse:separate;border-spacing:0;font-size:12px}.rw-table th{background:#123b6d;color:#fff;padding:9px;white-space:nowrap}.rw-table td{border-bottom:1px solid #edf2f7;padding:8px;vertical-align:top}.rw-table tr:nth-child(even) td{background:#f8fafc}.rw-strong{font-weight:900;color:#123b6d}.rw-kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;padding:12px}.rw-kv div{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px}.rw-kv span{display:block;color:#64748b;font-size:10px;font-weight:900}.rw-kv b{display:block;color:#172033;margin-top:4px}.rw-list{display:grid;gap:8px;padding:12px}.rw-list div{border:1px solid #e2e8f0;border-radius:12px;padding:10px;background:#f8fafc}.rw-list b{display:block;color:#123b6d}.rw-list span{display:block;margin-top:5px}.rw-empty{padding:24px;background:#f8fafc;border:1.5px dashed #cbd5e1;border-radius:15px;text-align:center;color:#64748b;font-weight:900}.rw-days{display:flex;gap:2px;min-width:220px}.d{width:18px;height:18px;border-radius:5px;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;border:1px solid #e2e8f0}.d-ح{background:#e8f0fe;color:#1d4ed8}.d-غ{background:#fee2e2;color:#b91c1c}.d-ج{background:#fef3c7;color:#b45309}.d-ش{background:#d1ecf1;color:#0369a1}.d-ت{background:#e2e8f0;color:#475569}.rw-certificate{background:linear-gradient(135deg,#fff7ed,#ffffff);border:1px solid #fed7aa;border-radius:16px;padding:14px;margin:0 0 12px}.rw-certificate h4{margin:0 0 5px;color:#9a3412}.rw-certificate p{margin:0;color:#7c2d12;font-size:12px;font-weight:800}.muted{color:#94a3b8}
    `;
    document.head.appendChild(s);
  }

  function addBoxes() {
    const body = document.getElementById('nr-body');
    const modal = document.querySelector('#najran-review-details-overlay .nr-modal');
    if (!body || !modal || body.dataset.rwDone === '1') return;
    body.dataset.rwDone = '1';

    SECTIONS.forEach(([id, title]) => {
      const sec = document.getElementById('nr-sec-' + id);
      if (!sec || sec.querySelector('.rw-box')) return;
      const box = document.createElement('div');
      box.className = 'rw-box';
      box.innerHTML = `<div class="rw-title">قرار المراجع لهذا الجزء</div><div class="rw-options"><label><input type="radio" name="rw-${id}" value="سليم"> سليم</label><label><input type="radio" name="rw-${id}" value="يحتاج تعديل"> يحتاج تعديل</label><label><input type="radio" name="rw-${id}" value="غير قابل للمراجعة"> غير قابل للمراجعة</label></div><textarea id="rw-note-${id}" placeholder="ملاحظة ${title} — اكتب سبب طلب التعديل أو ما يجب مراجعته"></textarea>`;
      sec.appendChild(box);
    });
    if (!modal.querySelector('.rw-general')) { const g=document.createElement('div'); g.className='rw-general'; g.innerHTML='<textarea id="rw-general-note" placeholder="ملاحظات عامة على المستخلص بالكامل — اختيارية"></textarea>'; modal.appendChild(g); }
    if (!modal.querySelector('.rw-footer')) { const f=document.createElement('div'); f.className='rw-footer'; f.innerHTML=`<button class="rw-action rw-book" onclick="window.openFullExtractBook()">تحميل المستخلص الكامل</button><button class="rw-action rw-revision" onclick="window.reviewWorkflowSubmit('needs_revision')">إرجاع المستخلص بالملاحظات</button><button class="rw-action rw-review" onclick="window.reviewWorkflowSubmit('under_review')">حفظ كمراجعة جارية</button><button class="rw-action rw-approve" onclick="window.reviewWorkflowSubmit('approved')">اعتماد المستخلص</button><button class="rw-action rw-close" onclick="window.closeNajranReviewDetails && window.closeNajranReviewDetails()">إغلاق</button>`; modal.appendChild(f); }
  }

  function collect(label) {
    const lines = ['ملف مراجعة تفصيلي للمستخلص', 'الإجراء: ' + label, '']; let hasIssue = false;
    SECTIONS.forEach(([id, title]) => { const checked=document.querySelector('input[name="rw-'+id+'"]:checked'); const decision=checked?checked.value:'لم يتم تحديد قرار'; const note=(document.getElementById('rw-note-'+id)?.value||'').trim(); if(decision!=='سليم'||note) hasIssue=true; lines.push('['+title+']'); lines.push('الحالة: '+decision); if(note) lines.push('الملاحظة: '+note); lines.push(''); });
    const general=(document.getElementById('rw-general-note')?.value||'').trim(); if(general){hasIssue=true; lines.push('[ملاحظات عامة]'); lines.push(general);} return { text: lines.join('\n').trim(), hasIssue };
  }
  window.openFullExtractBook = function () { const id=currentReviewId; if(!id)return alert('تعذر تحديد رقم المستخلص. أغلق النافذة وافتحها مرة أخرى.'); window.open('/original/final-extract-book.html?id='+encodeURIComponent(id),'_blank'); };
  window.reviewWorkflowSubmit = function (status) { const id=currentReviewId; if(!id)return alert('تعذر تحديد رقم المستخلص. أغلق النافذة وافتحها مرة أخرى.'); const label=status==='approved'?'اعتماد المستخلص':status==='under_review'?'حفظ كمراجعة جارية':'إرجاع المستخلص للمستخدم للتعديل'; const data=collect(label); if((status==='needs_revision'||status==='rejected')&&!data.hasIssue){alert('حدد الجزء الذي يحتاج تعديلًا أو اكتب ملاحظة قبل إرجاع المستخلص.');return;} if(status==='approved'&&!confirm('تأكيد اعتماد المستخلص بعد مراجعة جميع التبويبات؟'))return; if(status==='needs_revision'&&!confirm('سيتم إرجاع المستخلص للمستخدم بهذه الملاحظات. تأكيد؟'))return; let ta=document.getElementById('notes-'+id); if(!ta){ta=document.createElement('textarea');ta.id='notes-'+id;ta.style.display='none';document.body.appendChild(ta);} ta.value=data.text; if(typeof updateStatus==='function')updateStatus(id,status); else alert('تعذر العثور على دالة تحديث الحالة داخل صفحة الاعتماد.'); if(window.closeNajranReviewDetails)window.closeNajranReviewDetails(); };

  function wrapOpen() {
    if (typeof window.openNajranReviewDetails !== 'function' || window.openNajranReviewDetails.__rwWrapped) return false;
    const old = window.openNajranReviewDetails;
    window.openNajranReviewDetails = function (id) {
      currentReviewId = id;
      const r = old.apply(this, arguments);
      const body=document.getElementById('nr-body'); if(body) body.dataset.rwDone='0';
      setTimeout(() => { enhanceDetails(); addBoxes(); }, 80);
      setTimeout(() => { enhanceDetails(); addBoxes(); }, 350);
      return r;
    };
    window.openNajranReviewDetails.__rwWrapped = true;
    return true;
  }

  function init() { css(); const t=setInterval(()=>{ if(wrapOpen()) clearInterval(t); },300); setTimeout(()=>clearInterval(t),12000); const obs=new MutationObserver(()=>addBoxes()); obs.observe(document.body,{childList:true,subtree:true}); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
