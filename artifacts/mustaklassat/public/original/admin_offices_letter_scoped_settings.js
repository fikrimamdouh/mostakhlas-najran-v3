// Admin Offices Letter Scoped Settings — safe helper
(function(){
  'use strict';
  if (!/admin_offices_attendance\.html|original-viewer\?page=admin_offices_attendance\.html/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_LETTER_SCOPED_SETTINGS__) return;
  window.__ADMIN_OFFICES_LETTER_SCOPED_SETTINGS__ = true;

  var KEY = 'adminOfficesRaiseLettersSettings_v1';
  var SCOPES = {
    laborLetter: ['خطاب العمالة الإجمالي','laborLetter'],
    declaration: ['إقرار عدم أسبقية الصرف','declaration'],
    siteLetter: ['خطاب رفع الموقع','siteLetter'],
    groupedCertificate: ['شهادة الاستحقاق الشهري المجمعة','groupedCertificate'],
    entitlementStatement: ['بيان الاستحقاق','entitlementStatement'],
    salaryCertificate: ['شهادة تسليم الرواتب','salaryCertificate'],
    saudisStatement: ['بيان الوظائف المشغولة بالسعوديين','saudisStatement'],
    absenceStatement: ['بيان الغيابات','absenceStatement'],
    vacationStatement: ['بيان الإجازات','vacationStatement'],
    performanceCertificate: ['شهادة الأداء الشهري','performanceCertificate']
  };
  var FIELDS = [
    ['recipient','اسم المخاطب'],['recipientSuffix','الصفة / المحترم'],['entityTitle','العنوان الرئيسي'],['departmentTitle','الإدارة'],['scopeName','نطاق / موقع الخطاب'],['managerTitle','صفة التوقيع الرئيسي'],['managerName','اسم صاحب التوقيع الرئيسي'],['unitManagerTitle','صفة التوقيع الإضافي'],['unitManagerName','اسم صاحب التوقيع الإضافي'],['phoneFaxAr','الهاتف والفاكس عربي'],['phoneFaxEn','الهاتف والفاكس إنجليزي']
  ];

  function read(){ try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch(_) { return {}; } }
  function write(v){ try { localStorage.setItem(KEY, JSON.stringify(v || {})); localStorage.setItem(KEY + '_backup', JSON.stringify(v || {})); localStorage.setItem(KEY + '_backup_ts', String(Date.now())); } catch(_){} }
  function esc(v){ return String(v || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function clean(v){ return String(v || '').replace(/\s+/g,' ').trim(); }
  function cap(v){ v = String(v || ''); return v ? v.charAt(0).toUpperCase() + v.slice(1) : v; }
  function sKey(scope, field){ return (SCOPES[scope] ? SCOPES[scope][1] : scope) + cap(field); }

  function renderForm(){
    var sel = document.getElementById('admin-letter-scope-select');
    var box = document.getElementById('admin-letter-scoped-form');
    if (!sel || !box) return;
    var scope = sel.value || 'laborLetter';
    var data = read();
    var html = '<div style="font-size:12px;color:#475569;line-height:1.8;text-align:center;margin:0 0 10px">الخانات الفارغة تستخدم الإعدادات العامة تلقائيًا.</div><div class="settings-grid">';
    FIELDS.forEach(function(f){ var k = sKey(scope, f[0]); html += '<div class="field"><label>'+esc(f[1])+'</label><input type="text" data-letter-setting="'+esc(k)+'" value="'+esc(data[k] || '')+'"></div>'; });
    html += '</div><div class="btn-row"><button type="button" class="btn btn-primary" id="admin-letter-save-one">حفظ إعدادات هذا الخطاب</button><button type="button" class="btn btn-light" id="admin-letter-copy-general">نسخ العام لهذا الخطاب</button><button type="button" class="btn btn-light" id="admin-letter-clear-one">تفريغ هذا الخطاب</button></div>';
    box.innerHTML = html;
    document.getElementById('admin-letter-save-one').addEventListener('click', function(){ save(false); });
    document.getElementById('admin-letter-copy-general').addEventListener('click', copyGeneral);
    document.getElementById('admin-letter-clear-one').addEventListener('click', clearOne);
  }

  var saveTimer = null;
  function save(silent){
    var data = read();
    document.querySelectorAll('#admin-letter-scoped-form [data-letter-setting]').forEach(function(el){ data[el.getAttribute('data-letter-setting')] = el.value || ''; });
    write(data);
    if (!silent) alert('تم حفظ إعدادات الخطاب المحدد.');
  }
  function copyGeneral(){
    var scope = document.getElementById('admin-letter-scope-select') && document.getElementById('admin-letter-scope-select').value || 'laborLetter';
    var data = read();
    FIELDS.forEach(function(f){ data[sKey(scope, f[0])] = data[f[0]] || ''; });
    write(data); renderForm();
  }
  function clearOne(){
    var scope = document.getElementById('admin-letter-scope-select') && document.getElementById('admin-letter-scope-select').value || 'laborLetter';
    var data = read();
    FIELDS.forEach(function(f){ delete data[sKey(scope, f[0])]; });
    write(data); renderForm();
  }
  function installSection(){
    var overlay = document.getElementById('raise-letters-overlay');
    var dialog = overlay && overlay.querySelector('.settings-dialog');
    if (!dialog || document.getElementById('admin-letter-scoped-settings')) return;
    var section = document.createElement('div');
    section.id = 'admin-letter-scoped-settings';
    section.className = 'section-box';
    section.style.cssText = 'border:2px solid #94a3b8;background:#f8fafc;';
    var options = '';
    Object.keys(SCOPES).forEach(function(k){ options += '<option value="'+esc(k)+'">'+esc(SCOPES[k][0])+'</option>'; });
    section.innerHTML = '<h3>إعدادات مستقلة لكل خطاب</h3><div class="settings-grid"><div class="field"><label>اختر الخطاب</label><select id="admin-letter-scope-select">'+options+'</select></div></div><div id="admin-letter-scoped-form"></div>';
    var main = Array.prototype.slice.call(dialog.querySelectorAll('.section-box')).find(function(box){ return ((box.querySelector('h3') || {}).textContent || '').indexOf('إعدادات الخطابات') > -1; });
    if (main && main.parentNode) main.parentNode.insertBefore(section, main.nextSibling); else dialog.appendChild(section);
    document.getElementById('admin-letter-scope-select').addEventListener('change', renderForm);
    section.addEventListener('input', function(e){ if (e.target && e.target.matches('[data-letter-setting]')) { clearTimeout(saveTimer); saveTimer = setTimeout(function(){ save(true); }, 300); } }, true);
    renderForm();
  }

  function patch(scope){
    var data = read(), out = {};
    FIELDS.forEach(function(f){ var v = data[sKey(scope, f[0])]; if (clean(v)) out[f[0]] = v; });
    return out;
  }
  function withScope(scope, fn){
    var before = localStorage.getItem(KEY);
    var base = read();
    var p = patch(scope);
    if (Object.keys(p).length) write(Object.assign({}, base, p));
    try { return fn(); }
    finally { try { if (before == null) localStorage.removeItem(KEY); else localStorage.setItem(KEY, before); } catch(_){} }
  }
  function wrap(obj, name, scope){
    if (!obj || typeof obj[name] !== 'function' || obj[name].__scopedLetterSettingsWrapped) return;
    var old = obj[name];
    obj[name] = function(){ var args = arguments; var s = typeof scope === 'function' ? scope.apply(this, args) : scope; return withScope(s, function(){ return old.apply(obj, args); }); };
    obj[name].__scopedLetterSettingsWrapped = true;
  }
  function patchApis(){
    var r = window.AdminOfficesRaiseLetters;
    wrap(r, 'generateLaborRaiseLetter', 'laborLetter');
    wrap(r, 'generateDeclaration', 'declaration');
    wrap(r, 'generateSiteRaiseLetter', 'siteLetter');
    wrap(r, 'generateSelectedSiteLetters', 'siteLetter');
    var e = window.AdminOfficesExtraDocs;
    wrap(e, 'generateGroupedMonthlyEntitlementCertificate', 'groupedCertificate');
    wrap(e, 'generateEntitlementStatement', 'entitlementStatement');
    wrap(e, 'generateSalaryDeliveryCertificate', 'salaryCertificate');
    wrap(e, 'generateSaudiOccupiedJobsStatement', 'saudisStatement');
    wrap(e, 'generateMonthlyPerformanceCertificates', 'performanceCertificate');
    wrap(e, 'printEditableStatement', function(type){ return type === 'vacation' ? 'vacationStatement' : 'absenceStatement'; });
    wrap(e, 'openEditableStatement', function(type){ return type === 'vacation' ? 'vacationStatement' : 'absenceStatement'; });
  }
  function boot(){ patchApis(); installSection(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  setTimeout(boot, 500); setTimeout(boot, 1200); setTimeout(boot, 2500); setTimeout(boot, 4500);
  document.addEventListener('click', function(){ setTimeout(boot, 120); setTimeout(boot, 650); }, true);
  console.info('[Admin Offices Letter Scoped Settings] installed safe helper');
})();

// Admin Offices Full Excel Import — safe helper
(function(){
  'use strict';
  if (!/admin_offices_attendance\.html|original-viewer\?page=admin_offices_attendance\.html/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_FULL_EXCEL_IMPORT_HELPER__) return;
  window.__ADMIN_OFFICES_FULL_EXCEL_IMPORT_HELPER__ = true;

  var MAIN_KEY = 'adminOfficesAttendanceData_v1';
  var BACKUP_KEY = 'adminOfficesAttendanceData_v1_localBackup';
  var LAST_GOOD_KEY = 'adminOfficesAttendanceData_v1_lastGood';
  var LEGACY_KEY = 'adminOfficesAttendanceData';
  var SAFE_DATA_KEY = 'adminOfficesLaborDataSafe_v2';
  var NAMES_KEY = 'adminOfficeNames_v1';
  var SAFE_NAMES_KEY = 'adminOfficesLaborNamesSafe_v2';

  function readJson(key, fallback){ try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch(_) { return fallback; } }
  function writeJson(key, value){ try { localStorage.setItem(key, JSON.stringify(value || {})); } catch(_){} }
  function esc(v){ return String(v || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function trim(v){ return String(v == null ? '' : v).replace(/[\u200f\u200e]/g,'').replace(/\s+/g,' ').trim(); }
  function norm(v){ return trim(v).replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/ـ/g,'').replace(/[\s\-_/\\()\[\]{}،,.]+/g,'').toLowerCase(); }
  function parseNumber(v){ if (typeof v === 'number') return v || 0; return parseFloat(String(v || '').replace(/,/g,'').replace(/[ ريال﷼]/g,'').trim()) || 0; }
  function countRows(data){ var n = 0; Object.keys(data || {}).forEach(function(k){ if (Array.isArray(data[k])) n += data[k].length; }); return n; }
  function countNamed(data){ var n = 0; Object.keys(data || {}).forEach(function(k){ if (Array.isArray(data[k])) data[k].forEach(function(e){ if (trim(e && (e.name || e.employeeName || e.workerName))) n++; }); }); return n; }
  function score(data){ return { rows: countRows(data), named: countNamed(data) }; }
  function safeSheetName(v){ return trim(v).replace(/[\\/:*?"<>|]/g, '-').substring(0,31) || 'مكتب'; }

  function daysCount(){
    try { var p = typeof window.getExtractPeriodDetails === 'function' ? window.getExtractPeriodDetails() : {}; return p.daysInExtract || p.daysInMonth || 30; } catch(_) { return 30; }
  }
  function emptyDays(){ return Array(daysCount()).fill('ح'); }

  function bestData(){
    var list = [readJson(MAIN_KEY, {}), readJson(BACKUP_KEY, {}), readJson(LAST_GOOD_KEY, {}), readJson(LEGACY_KEY, {}), readJson(SAFE_DATA_KEY, {})];
    return list.reduce(function(best, item){ var b = score(best), s = score(item); if (s.named > b.named) return item; if (s.named === b.named && s.rows > b.rows) return item; return best; }, {});
  }

  function saveData(data){
    data = data || {};
    var raw = JSON.stringify(data);
    try {
      localStorage.setItem(MAIN_KEY, raw);
      localStorage.setItem(BACKUP_KEY, raw);
      localStorage.setItem(LAST_GOOD_KEY, raw);
      localStorage.setItem(LEGACY_KEY, raw);
      localStorage.setItem(SAFE_DATA_KEY, raw);
      localStorage.setItem('adminOfficesAttendanceData_v1_localBackup_ts', String(Date.now()));
      localStorage.setItem('adminOfficesAttendanceData_v1_lastGood_ts', String(Date.now()));
      localStorage.setItem('adminOfficesLaborDataSafe_v2_ts', String(Date.now()));
      localStorage.setItem('najran_admin_offices_attendance_done', 'true');
    } catch(_) {}
    try { if (typeof window.saveAttendanceData === 'function') window.saveAttendanceData(data); } catch(_) {}
    try { if (window.AdminOfficesAttendancePersistence && typeof window.AdminOfficesAttendancePersistence.snapshot === 'function') window.AdminOfficesAttendancePersistence.snapshot(); } catch(_) {}
  }

  function currentNames(){
    var names = {};
    try { if (typeof window.getCenterNames === 'function') names = window.getCenterNames() || {}; } catch(_) {}
    if (!names || !Object.keys(names).length) names = readJson(NAMES_KEY, {});
    if (!names || !Object.keys(names).length) names = readJson(SAFE_NAMES_KEY, {});
    return names || {};
  }

  function buildSheetMap(){
    var names = currentNames();
    var entries = [];
    Object.keys(names || {}).forEach(function(key){
      var name = names[key] || key;
      var aliases = [key, name, safeSheetName(name), safeSheetName(name).substring(0,31)];
      aliases.forEach(function(a){ entries.push({ key:key, name:name, norm:norm(a) }); });
    });
    return { names:names, entries:entries };
  }

  function matchSheetToCenter(sheetName, map){
    var s = norm(sheetName);
    if (!s) return null;
    var exact = map.entries.find(function(x){ return x.norm && x.norm === s; });
    if (exact) return exact.key;
    var contains = map.entries.find(function(x){ return x.norm && (s.indexOf(x.norm) > -1 || x.norm.indexOf(s) > -1); });
    return contains ? contains.key : null;
  }

  function normHeader(v){ return norm(v); }
  function findIdx(headers, tests){
    for (var i=0;i<headers.length;i++) {
      var h = normHeader(headers[i]);
      if (tests.some(function(fn){ return fn(h); })) return i;
    }
    return -1;
  }

  function parseSheetRows(ws){
    var raw = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
    if (!raw || raw.length < 2) return { rows:[], skipped:0, reason:'empty' };
    var headerRow = -1;
    for (var r=0;r<Math.min(15, raw.length);r++) {
      var row = raw[r].map(normHeader);
      var hasName = row.some(function(h){ return h.indexOf('اسمالموظف') > -1 || h.indexOf('اسمشاغلالوظيفه') > -1 || h === 'name'; });
      var hasJob = row.some(function(h){ return h.indexOf('مسمىالوظيفه') > -1 || h.indexOf('مسميالوظيفه') > -1 || h === 'الوظيفه' || h.indexOf('job') > -1; });
      if (hasName && hasJob) { headerRow = r; break; }
    }
    if (headerRow < 0) return { rows:[], skipped:raw.length, reason:'no-header' };

    var headers = raw[headerRow];
    var iName = findIdx(headers, [function(h){ return h.indexOf('اسمالموظف') > -1; }, function(h){ return h.indexOf('اسمشاغلالوظيفه') > -1; }, function(h){ return h === 'name'; }]);
    var iId = findIdx(headers, [function(h){ return h.indexOf('الهويه') > -1; }, function(h){ return h.indexOf('الاقامه') > -1; }, function(h){ return h.indexOf('iqama') > -1; }, function(h){ return h === 'id'; }]);
    var iJob = findIdx(headers, [function(h){ return h.indexOf('مسمىالوظيفه') > -1 || h.indexOf('مسميالوظيفه') > -1; }, function(h){ return h === 'الوظيفه'; }, function(h){ return h.indexOf('job') > -1; }]);
    var iSalary = findIdx(headers, [function(h){ return h.indexOf('التكلفه') > -1; }, function(h){ return h.indexOf('راتب') > -1; }, function(h){ return h.indexOf('salary') > -1; }]);
    var iCat = findIdx(headers, [function(h){ return h.indexOf('الفئه') > -1 || h.indexOf('فئه') > -1; }, function(h){ return h.indexOf('cat') > -1; }]);
    var iNat = findIdx(headers, [function(h){ return h.indexOf('الجنسيه') > -1 || h.indexOf('جنسيه') > -1; }, function(h){ return h.indexOf('nat') > -1; }]);
    var iFine = findIdx(headers, [function(h){ return h.indexOf('غرامهجنسيه') > -1; }, function(h){ return h.indexOf('nationalityfine') > -1; }]);
    if (iName < 0 || iJob < 0) return { rows:[], skipped:raw.length - headerRow - 1, reason:'missing-columns' };

    var rows = [], skipped = 0;
    for (var rr=headerRow+1; rr<raw.length; rr++) {
      var row = raw[rr];
      var empName = trim(row[iName]);
      var jobTitle = trim(row[iJob]);
      var iqamaId = iId >= 0 ? trim(row[iId]) : '';
      var salary = iSalary >= 0 ? parseNumber(row[iSalary]) : 0;
      var category = iCat >= 0 ? trim(row[iCat]) : '1';
      var nationality = iNat >= 0 ? trim(row[iNat]) : 'غير سعودي';
      var fine = iFine >= 0 ? parseNumber(row[iFine]) : 0;
      if (!empName && !jobTitle && !iqamaId && !salary) { skipped++; continue; }
      if (['اسم الموظف','اسم شاغل الوظيفة','مندوب المقاول','مدير المركز'].indexOf(empName) > -1) { skipped++; continue; }
      rows.push({
        name: empName,
        jobTitle: jobTitle || 'غير محدد',
        category: category || '1',
        salary: salary,
        nationality: nationality || 'غير سعودي',
        iqamaId: iqamaId,
        nationalityFine: fine,
        days: emptyDays()
      });
    }
    return { rows:rows, skipped:skipped, reason:'' };
  }

  function parseWorkbookFile(file){
    return new Promise(function(resolve, reject){
      if (!window.XLSX) return reject(new Error('مكتبة Excel غير محملة.'));
      var reader = new FileReader();
      reader.onload = function(e){
        try {
          var wb = XLSX.read(e.target.result, { type:'binary' });
          var map = buildSheetMap();
          var parsed = {}, report = [], unmatched = [];
          wb.SheetNames.forEach(function(sheet){
            var centerKey = matchSheetToCenter(sheet, map);
            if (!centerKey) { unmatched.push(sheet); return; }
            var res = parseSheetRows(wb.Sheets[sheet]);
            if (!res.rows.length) {
              report.push({ sheet:sheet, centerKey:centerKey, office:map.names[centerKey] || centerKey, rows:0, skipped:res.skipped, reason:res.reason });
              return;
            }
            parsed[centerKey] = res.rows;
            report.push({ sheet:sheet, centerKey:centerKey, office:map.names[centerKey] || centerKey, rows:res.rows.length, skipped:res.skipped, reason:'' });
          });
          resolve({ parsed:parsed, report:report, unmatched:unmatched, sheetCount:wb.SheetNames.length });
        } catch(err) { reject(err); }
      };
      reader.onerror = function(){ reject(new Error('فشلت قراءة ملف Excel.')); };
      reader.readAsBinaryString(file);
    });
  }

  function employeeKey(emp){
    var id = trim(emp && (emp.iqamaId || emp.idNumber || emp.identity || emp.nationalId));
    if (id) return 'id:' + id;
    return 'name:' + norm((emp && emp.name) || '') + '|job:' + norm((emp && emp.jobTitle) || '');
  }

  function mergeRows(currentRows, newRows){
    var rows = Array.isArray(currentRows) ? currentRows.slice() : [];
    var index = {};
    rows.forEach(function(emp, i){ var k = employeeKey(emp); if (k !== 'name:|job:') index[k] = i; });
    var added = 0, updated = 0;
    newRows.forEach(function(newEmp){
      var k = employeeKey(newEmp);
      if (k && index[k] != null) {
        var old = rows[index[k]] || {};
        rows[index[k]] = Object.assign({}, old, newEmp, { days: Array.isArray(old.days) ? old.days : newEmp.days });
        updated++;
      } else {
        rows.push(newEmp);
        if (k) index[k] = rows.length - 1;
        added++;
      }
    });
    return { rows:rows, added:added, updated:updated };
  }

  async function importFullWorkbook(mode){
    var input = document.getElementById('admin-offices-full-excel-input');
    var status = document.getElementById('admin-offices-full-import-status');
    if (!input || !input.files || !input.files.length) return alert('اختر ملف Excel شامل أولاً.');
    mode = mode === 'update' ? 'update' : 'replace';
    if (status) status.innerHTML = '<div style="color:#0369a1;font-weight:900">جاري قراءة الملف الشامل...</div>';
    try {
      var result = await parseWorkbookFile(input.files[0]);
      var keys = Object.keys(result.parsed || {});
      if (!keys.length) {
        if (status) status.innerHTML = '<div style="color:#b91c1c;font-weight:900">لم يتم مطابقة أي Sheet مع أسماء المكاتب.</div>';
        return alert('لم يتم مطابقة أي Sheet مع أسماء المكاتب. تأكد أن أسماء الصفحات هي نفس أسماء التامبلت المنزل من النظام.');
      }

      var totalRows = keys.reduce(function(sum, k){ return sum + result.parsed[k].length; }, 0);
      var actionText = mode === 'replace' ? 'استبدال بيانات الأقسام المطابقة بالكامل' : 'تحديث الأقسام المطابقة مع الحفاظ على الموجود';
      var msg = actionText + '\n\nعدد الصفحات المطابقة: ' + keys.length + '\nعدد الموظفين في الملف: ' + totalRows + (result.unmatched.length ? '\nصفحات غير مطابقة: ' + result.unmatched.join('، ') : '') + '\n\nهل تريد المتابعة؟';
      if (!confirm(msg)) return;

      var all = bestData();
      var replaced = 0, added = 0, updated = 0;
      keys.forEach(function(k){
        if (mode === 'replace') {
          all[k] = result.parsed[k];
          replaced += result.parsed[k].length;
        } else {
          var merged = mergeRows(all[k], result.parsed[k]);
          all[k] = merged.rows;
          added += merged.added;
          updated += merged.updated;
        }
      });
      saveData(all);
      try { if (typeof window.renderCenterIcons === 'function') window.renderCenterIcons(); } catch(_) {}
      try { if (typeof window.renderMainGrid === 'function') window.renderMainGrid(); } catch(_) {}
      try { if (typeof window.calculateAndDisplayGrandTotal === 'function') window.calculateAndDisplayGrandTotal(); } catch(_) {}
      try { if (window.AdminOfficesAttendancePersistence && typeof window.AdminOfficesAttendancePersistence.snapshot === 'function') window.AdminOfficesAttendancePersistence.snapshot(); } catch(_) {}

      var summary = mode === 'replace'
        ? 'تم الاستبدال الشامل.\nالأقسام المطابقة: ' + keys.length + '\nالموظفون المحفوظون: ' + replaced
        : 'تم التحديث الشامل.\nالأقسام المطابقة: ' + keys.length + '\nالمضافون: ' + added + '\nالمحدثون: ' + updated;
      if (result.unmatched.length) summary += '\nصفحات غير مطابقة تم تجاهلها: ' + result.unmatched.length;
      if (status) status.innerHTML = '<div style="color:#166534;font-weight:900;line-height:1.8">' + esc(summary).replace(/\n/g,'<br>') + '</div>';
      alert('✅ ' + summary);
    } catch(err) {
      console.error('[Admin Offices Full Excel Import] failed:', err);
      if (status) status.innerHTML = '<div style="color:#b91c1c;font-weight:900">فشل الاستيراد: ' + esc(err.message || err) + '</div>';
      alert('فشل استيراد الملف الشامل. راجع Console.');
    }
  }

  function injectFullImportSection(){
    var body = document.querySelector('#management-dialog .dialog-body');
    if (!body || document.getElementById('admin-offices-full-excel-section')) return;
    var section = document.createElement('div');
    section.id = 'admin-offices-full-excel-section';
    section.style.cssText = 'background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin:0 0 16px;text-align:center';
    section.innerHTML = '' +
      '<h4 style="color:#166534;margin:0 0 10px"><i class="fas fa-layer-group"></i> استيراد ملف شامل لكل الأقسام</h4>' +
      '<p style="font-size:.88rem;line-height:1.8;color:#374151;margin:0 0 10px">استخدم الملف الذي تم تنزيله كتامبلت كامل. كل Sheet يتم ربطه تلقائيًا بالمكتب/القسم المطابق لاسمه.</p>' +
      '<input type="file" id="admin-offices-full-excel-input" accept=".xlsx,.xls" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;margin:8px 0">' +
      '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:10px">' +
        '<button class="btn btn-success" type="button" onclick="AdminOfficesFullExcelImport.import(\'replace\')"><i class="fas fa-trash-alt"></i> استبدال شامل لكل الأقسام</button>' +
        '<button class="btn btn-secondary" type="button" onclick="AdminOfficesFullExcelImport.import(\'update\')"><i class="fas fa-sync-alt"></i> تحديث شامل لكل الأقسام</button>' +
      '</div>' +
      '<div id="admin-offices-full-import-status" style="margin-top:10px;font-size:.86rem"></div>';
    body.insertBefore(section, body.firstChild);
  }

  function patchOpenImportDialog(){
    if (typeof window.openImportDialog !== 'function' || window.openImportDialog.__adminOfficesFullExcelPatched) return false;
    var old = window.openImportDialog;
    window.openImportDialog = function(){
      var result = old.apply(this, arguments);
      setTimeout(injectFullImportSection, 80);
      setTimeout(injectFullImportSection, 350);
      return result;
    };
    window.openImportDialog.__adminOfficesFullExcelPatched = true;
    return true;
  }

  function boot(){ patchOpenImportDialog(); injectFullImportSection(); }
  window.AdminOfficesFullExcelImport = { import: importFullWorkbook, parse: parseWorkbookFile, inject: injectFullImportSection };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  setTimeout(boot, 500); setTimeout(boot, 1200); setTimeout(boot, 2500); setTimeout(boot, 4500);
  document.addEventListener('click', function(){ setTimeout(boot, 120); }, true);

  console.info('[Admin Offices Full Excel Import] installed full workbook + individual import');
})();