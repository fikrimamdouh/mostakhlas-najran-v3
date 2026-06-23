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