// ===================================================================
// Admin Offices Signature Unification + Backup Integrity — V3
// Scope: admin_offices_attendance.html only
//
// الزر الوحيد أعلى الصفحة: "توحيد التواقيع بين المكاتب".
// داخله: إضافة/تعديل توقيع للمكتب المصدر + نسخ نفس التوقيع للمكاتب.
// لا يتدخل في الشهادة الإجمالية نهائيًا.
// يحذف فقط أشرطة التوقيع السفلية القديمة داخل تبويبات الحضور/الأداء/الإنجاز.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;
  if (window.__ADMIN_OFFICES_SIGNATURE_UNIFY_V3__) return;
  window.__ADMIN_OFFICES_SIGNATURE_UNIFY_V3__ = true;

  var PREFIX = 'sb_sigs_';
  var PREFS = 'sb_prefs_';
  var DIALOG_ID = 'admin-offices-signatures-unify-dialog';
  var BTN_ID = 'admin-offices-signatures-unify-btn';
  var BEFORE_RESTORE_KEY = 'adminOfficesBeforeRestoreSafety_v1';
  var TYPES = [
    { id: 'attendance', label: 'الحضور والانصراف' },
    { id: 'performance', label: 'تقييم الأداء' },
    { id: 'achievement', label: 'شهادة الإنجاز' }
  ];

  function readJson(key, fallback) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
  }
  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { console.warn('[Admin Offices Integrity] write failed:', key, e); return false; }
  }
  function writeRaw(key, value) {
    try {
      if (typeof value === 'string') localStorage.setItem(key, value);
      else localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) { console.warn('[Admin Offices Integrity] write failed:', key, e); return false; }
  }
  function esc(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function clean(v) {
    return String(v == null ? '' : v).replace(/[\u200e\u200f]/g, '').replace(/\s+/g, ' ').trim();
  }
  function nowStamp() {
    var d = new Date();
    function p(n) { return String(n).padStart(2, '0'); }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '_' + p(d.getHours()) + '-' + p(d.getMinutes());
  }
  function countRows(data) {
    data = data || {};
    return Object.keys(data).reduce(function (sum, key) { return sum + (Array.isArray(data[key]) ? data[key].length : 0); }, 0);
  }
  function getNames() {
    try { if (typeof window.getCenterNames === 'function') return window.getCenterNames() || {}; } catch (_) {}
    return readJson('adminOfficeNames_v1', {});
  }
  function getAttendanceDataSafe() {
    var candidates = [];
    try { if (typeof window.getAttendanceData === 'function') candidates.push(window.getAttendanceData() || {}); } catch (_) {}
    [
      'adminOfficesAttendanceData_v1',
      'adminOfficesAttendanceData_v1_localBackup',
      'adminOfficesAttendanceData_v1_lastGood',
      'adminOfficesLaborDataSafe_v2',
      'adminOfficesAttendanceData'
    ].forEach(function (key) { candidates.push(readJson(key, {})); });
    return candidates.reduce(function (best, item) { return countRows(item) > countRows(best) ? item : best; }, {});
  }
  function currentCenterKey() {
    var active = document.querySelector('.tab-link.active[data-center-key]');
    if (active && active.dataset.centerKey) return active.dataset.centerKey;
    try { if (window.activeCenterKeyForManagement) return window.activeCenterKeyForManagement; } catch (_) {}
    var title = (document.getElementById('center-main-title') || {}).textContent || '';
    var names = getNames();
    var keys = Object.keys(names || {});
    for (var i = 0; i < keys.length; i++) {
      if (names[keys[i]] && title.indexOf(names[keys[i]]) > -1) return keys[i];
    }
    if (title.indexOf('الورش') > -1) return 'admin_staff';
    return keys[0] || 'general';
  }
  function currentVisibleType() {
    var perf = document.getElementById('performance-tab');
    var ach = document.getElementById('achievement-tab');
    if (perf && getComputedStyle(perf).display !== 'none') return 'performance';
    if (ach && getComputedStyle(ach).display !== 'none') return 'achievement';
    return 'attendance';
  }
  function sigKey(officeKey, type) {
    if (window.AdminOfficesPageSignatures && typeof window.AdminOfficesPageSignatures.signatureKey === 'function') {
      try { return window.AdminOfficesPageSignatures.signatureKey(type, officeKey); } catch (_) {}
    }
    return 'admin_offices_' + (officeKey || currentCenterKey()) + '_' + (type || currentVisibleType());
  }
  function readSourceSigs(officeKey, type) {
    var key = sigKey(officeKey, type);
    var sigs = [];
    try { if (window.SignatureBlock && typeof window.SignatureBlock.getSigs === 'function') sigs = window.SignatureBlock.getSigs(key) || []; } catch (_) {}
    if (!Array.isArray(sigs) || !sigs.length) sigs = readJson(PREFIX + key, []);
    var prefs = readJson(PREFS + key, {});
    return { sigs: Array.isArray(sigs) ? sigs : [], prefs: prefs || {} };
  }
  function getToken() {
    try {
      var s = JSON.parse(localStorage.getItem('najran_session') || '{}');
      if (!s.clerkToken) return null;
      return (Date.now() - (s.timestamp || 0)) < 55000 ? s.clerkToken : null;
    } catch (_) { return null; }
  }
  function pushToHospitalStorage(payload) {
    var token = getToken();
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    return fetch('/api/hospital-storage', {
      method: 'PUT',
      headers: headers,
      credentials: 'include',
      body: JSON.stringify({ data: payload })
    }).then(function (r) { return r.ok; }).catch(function () { return false; });
  }

  function ensureCss() {
    if (document.getElementById('admin-offices-signatures-unify-css')) return;
    var st = document.createElement('style');
    st.id = 'admin-offices-signatures-unify-css';
    st.textContent =
      '#' + DIALOG_ID + '{position:fixed;inset:0;z-index:2147483500;background:rgba(15,23,42,.58);display:flex;align-items:center;justify-content:center;direction:rtl;font-family:Tajawal,Arial,sans-serif}' +
      '#' + DIALOG_ID + ' .unify-box{width:min(780px,94vw);max-height:88vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.25);padding:20px}' +
      '#' + DIALOG_ID + ' h3{margin:0 0 6px;color:#003087;font-size:20px;font-weight:950}' +
      '#' + DIALOG_ID + ' p{margin:0 0 12px;color:#64748b;font-weight:800;line-height:1.8}' +
      '.unify-field{display:block;background:#f8fafc;border:1px solid #dbe4f0;border-radius:12px;padding:12px;margin:10px 0}' +
      '.unify-field>span{display:block;font-size:13px;font-weight:950;color:#334155;margin-bottom:8px}' +
      '.unify-field select{width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:9px;font-family:inherit;font-weight:900}' +
      '.unify-types,.unify-scope{display:flex;gap:10px;flex-wrap:wrap}' +
      '.unify-check,.unify-scope label{display:flex;gap:7px;align-items:center;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px 12px;font-weight:850;cursor:pointer}' +
      '.unify-scope label.active{border-color:#166534;background:#f0fdf4;color:#166534}' +
      '#unify-single-office-wrap{display:none;margin-top:9px}' +
      '.unify-preview{background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:10px;color:#92400e;font-weight:850;line-height:1.9;margin:10px 0}' +
      '.unify-actions{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:14px}' +
      '.unify-actions button{border:0;border-radius:10px;padding:11px 16px;font-family:inherit;font-weight:950;cursor:pointer;font-size:14px}' +
      '.unify-primary{background:#166534;color:#fff}.unify-blue{background:#1d4ed8;color:#fff}.unify-light{background:#e2e8f0;color:#0f172a}.unify-danger{background:#fee2e2;color:#991b1b}';
    document.head.appendChild(st);
  }
  function closeDialog() {
    var d = document.getElementById(DIALOG_ID);
    if (d) d.remove();
  }
  function officeOptions(names, selected) {
    return Object.keys(names).map(function (k) {
      return '<option value="' + esc(k) + '"' + (k === selected ? ' selected' : '') + '>' + esc(names[k] || k) + '</option>';
    }).join('');
  }
  function selectedTypes() {
    return TYPES.filter(function (t) {
      var cb = document.getElementById('unify-type-' + t.id);
      return cb && cb.checked;
    });
  }
  function updatePreview() {
    var names = getNames();
    var src = document.getElementById('unify-source') ? document.getElementById('unify-source').value : '';
    var checkedTypes = selectedTypes();
    var scopeAll = document.getElementById('unify-scope-all') && document.getElementById('unify-scope-all').checked;
    var single = document.getElementById('unify-single-office') ? document.getElementById('unify-single-office').value : '';
    var counts = checkedTypes.map(function (t) {
      var s = readSourceSigs(src, t.id);
      return t.label + ' (' + s.sigs.length + ' توقيع)';
    });
    var targetTxt = scopeAll ? 'كل المكاتب (' + Math.max(Object.keys(names).length - 1, 0) + ' مكتب عدا المصدر)' : 'مكتب: ' + esc(names[single] || single || '—');
    var el = document.getElementById('unify-preview');
    if (el) {
      el.innerHTML = 'المصدر: <b>' + esc(names[src] || src) + '</b> — ' +
        (counts.length ? counts.join('، ') : '<b style="color:#991b1b">لم تختر أي نوع!</b>') +
        '<br>النسخ إلى: <b>' + targetTxt + '</b>.';
    }
    var lblAll = document.getElementById('unify-scope-all-label');
    var lblOne = document.getElementById('unify-scope-one-label');
    var wrap = document.getElementById('unify-single-office-wrap');
    if (lblAll && lblOne && wrap) {
      lblAll.classList.toggle('active', !!scopeAll);
      lblOne.classList.toggle('active', !scopeAll);
      wrap.style.display = scopeAll ? 'none' : 'block';
    }
  }
  function openSelectedSourceSignature() {
    if (!(window.SignatureBlock && typeof window.SignatureBlock.open === 'function')) return alert('نظام التواقيع لم يكتمل تحميله بعد. أعد تحميل الصفحة.');
    var srcEl = document.getElementById('unify-source');
    var src = srcEl ? srcEl.value : currentCenterKey();
    var firstType = selectedTypes()[0] || TYPES.find(function (t) { return t.id === currentVisibleType(); }) || TYPES[0];
    window.SignatureBlock.open(sigKey(src, firstType.id));
  }
  function openDialog() {
    var names = getNames();
    var officeKeys = Object.keys(names);
    if (!officeKeys.length) return alert('لا توجد مكاتب معرفة بعد.');
    if (!(window.SignatureBlock && typeof window.SignatureBlock.getSigs === 'function')) return alert('نظام التواقيع لم يكتمل تحميله بعد. أعد تحميل الصفحة.');
    ensureCss();
    closeDialog();
    var defaultSource = currentCenterKey();
    if (!names[defaultSource]) defaultSource = officeKeys[0];
    var visibleType = currentVisibleType();
    var dialog = document.createElement('div');
    dialog.id = DIALOG_ID;
    dialog.innerHTML =
      '<div class="unify-box">' +
      '<h3><i class="fas fa-signature"></i> توحيد التواقيع بين المكاتب</h3>' +
      '<p>اختر مكتب المصدر، أضف أو عدّل توقيعه، ثم انسخ نفس التوقيع إلى كل المكاتب أو مكتب محدد. الشهادة الإجمالية مستقلة.</p>' +
      '<label class="unify-field"><span>مكتب المصدر</span><select id="unify-source">' + officeOptions(names, defaultSource) + '</select></label>' +
      '<div class="unify-field"><span>أنواع الصفحات المشمولة</span><div class="unify-types">' +
      TYPES.map(function (t) { return '<label class="unify-check"><input type="checkbox" id="unify-type-' + t.id + '"' + (t.id === visibleType ? ' checked' : '') + '><span>' + t.label + '</span></label>'; }).join('') +
      '</div></div>' +
      '<div class="unify-field"><span>نطاق النسخ</span><div class="unify-scope">' +
      '<label id="unify-scope-all-label" class="active"><input type="radio" name="unify-scope" id="unify-scope-all" checked><span>كل المكاتب</span></label>' +
      '<label id="unify-scope-one-label"><input type="radio" name="unify-scope" id="unify-scope-one"><span>مكتب محدد فقط</span></label>' +
      '</div><div id="unify-single-office-wrap"><select id="unify-single-office">' + officeOptions(names, '') + '</select></div></div>' +
      '<div id="unify-preview" class="unify-preview"></div>' +
      '<div class="unify-actions">' +
      '<button type="button" class="unify-blue" id="unify-add-signature">إضافة / تعديل توقيع المصدر</button>' +
      '<button type="button" class="unify-primary" id="unify-apply">تطبيق النسخ الآن</button>' +
      '<button type="button" class="unify-danger" id="unify-close">إغلاق</button>' +
      '</div></div>';
    document.body.appendChild(dialog);
    ['unify-source', 'unify-scope-all', 'unify-scope-one', 'unify-single-office'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('change', updatePreview);
    });
    TYPES.forEach(function (t) {
      var cb = document.getElementById('unify-type-' + t.id);
      if (cb) cb.addEventListener('change', updatePreview);
    });
    document.getElementById('unify-close').onclick = closeDialog;
    document.getElementById('unify-add-signature').onclick = openSelectedSourceSignature;
    document.getElementById('unify-apply').onclick = applyUnify;
    updatePreview();
  }
  async function applyUnify() {
    var names = getNames();
    var src = document.getElementById('unify-source').value;
    var checkedTypes = selectedTypes();
    if (!checkedTypes.length) return alert('اختر نوع صفحة واحد على الأقل.');
    var scopeAll = document.getElementById('unify-scope-all').checked;
    var targets;
    if (scopeAll) targets = Object.keys(names).filter(function (k) { return k !== src; });
    else {
      var single = document.getElementById('unify-single-office').value;
      if (!single) return alert('اختر المكتب الهدف.');
      if (single === src) return alert('المكتب الهدف هو نفسه المصدر — اختر مكتبًا مختلفًا.');
      targets = [single];
    }
    if (!targets.length) return alert('لا توجد مكاتب هدف.');
    var sources = {}, emptyTypes = [];
    checkedTypes.forEach(function (t) {
      var s = readSourceSigs(src, t.id);
      sources[t.id] = s;
      if (!s.sigs.length) emptyTypes.push(t.label);
    });
    if (emptyTypes.length && !confirm('مكتب المصدر ليس لديه توقيعات محفوظة في: ' + emptyTypes.join('، ') + '.\nالاستمرار سيجعل المكاتب الهدف بدون توقيعات لهذه الأنواع. متابعة؟')) return;
    var payload = {}, written = 0;
    targets.forEach(function (target) {
      checkedTypes.forEach(function (t) {
        var key = sigKey(target, t.id);
        var s = sources[t.id];
        writeJson(PREFIX + key, s.sigs);
        writeJson(PREFS + key, s.prefs || {});
        payload[PREFIX + key] = JSON.stringify(s.sigs);
        payload[PREFS + key] = JSON.stringify(s.prefs || {});
        try { window.SignatureBlock.init(key, { showStamp: true }); } catch (_) {}
        written++;
      });
    });
    var ok = await pushToHospitalStorage(payload);
    try { if (window.AdminOfficesPageSignatures && typeof window.AdminOfficesPageSignatures.refresh === 'function') window.AdminOfficesPageSignatures.refresh(); } catch (_) {}
    alert(ok ? '✓ تم توحيد التواقيع (' + written + ' مجموعة) ومزامنتها سحابيًا.' : 'تم توحيد التواقيع محليًا (' + written + ' مجموعة). المزامنة السحابية لم تكتمل الآن.');
    closeDialog();
  }

  function removeLegacyInlineButtons() {
    document.querySelectorAll('.admin-page-signature-bar, #sb-container-admin_offices').forEach(function (el) {
      try { el.remove(); } catch (_) {}
    });
    document.querySelectorAll('button').forEach(function (b) {
      if (b.id === BTN_ID) return;
      var txt = clean(b.textContent || '');
      if (txt === 'إدارة كل التواقيع') b.remove();
    });
  }
  function injectButton(attempt) {
    removeLegacyInlineButtons();
    var bar = document.getElementById('main-action-buttons');
    if (!bar) {
      if ((attempt || 0) < 20) setTimeout(function () { injectButton((attempt || 0) + 1); }, 500);
      return;
    }
    var btn = document.getElementById(BTN_ID);
    if (!btn) {
      btn = document.createElement('button');
      btn.id = BTN_ID;
      btn.className = 'ab ab-titles';
      var printBtn = Array.prototype.slice.call(bar.querySelectorAll('button')).find(function (b) { return clean(b.textContent || '').indexOf('طباعة') > -1; });
      if (printBtn && printBtn.nextSibling) bar.insertBefore(btn, printBtn.nextSibling);
      else bar.appendChild(btn);
    }
    btn.innerHTML = '<i class="fas fa-signature"></i> توحيد التواقيع بين المكاتب';
    btn.onclick = openDialog;
  }

  function isRelevantAdminOfficeKey(key) {
    key = String(key || '');
    if (!key || /^(najran_session|__clerk|clerk_|loglevel|amplitude|chakra|persist:)/.test(key)) return false;
    return (
      key.indexOf('adminOffice') > -1 || key.indexOf('adminOffices') > -1 || key.indexOf('admin_offices') > -1 ||
      /^sb_(sigs|prefs)_admin_offices_/.test(key) || /^healthCenters_Signatures_/.test(key) ||
      /^performance(Data|Deductions)/.test(key) || /^adminOfficePerformance/.test(key) ||
      key === 'persistentContractData' || key === 'persistentExtractData' || key === 'companyName' || key === 'hospitalName' || key === 'contractDetails' ||
      key === 'extractMonth' || key === 'extractYear' || key === 'paymentNumber' || key === 'extractNumber' || key === 'extractStart' || key === 'extractEnd' ||
      /raise.*letter/i.test(key) || /letterhead/i.test(key) || /signature/i.test(key)
    );
  }
  function collectRelevantLocalStorage() {
    var out = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!isRelevantAdminOfficeKey(key)) continue;
        out[key] = localStorage.getItem(key);
      }
    } catch (e) { console.warn('[Admin Offices Integrity] collect failed', e); }
    return out;
  }
  function forceSaveCurrentScreen() {
    try { if (typeof window.captureUIData === 'function') window.captureUIData(); } catch (_) {}
    try { if (typeof window.saveAllData === 'function') window.saveAllData(); } catch (_) {}
    try { if (typeof window.calculateAndDisplayGrandTotal === 'function') window.calculateAndDisplayGrandTotal(); } catch (_) {}
    try { if (typeof window.getAttendanceData === 'function' && typeof window.saveAttendanceData === 'function') window.saveAttendanceData(window.getAttendanceData()); } catch (_) {}
  }
  function buildFullBackupObject(reason) {
    forceSaveCurrentScreen();
    var attendance = getAttendanceDataSafe();
    var names = getNames();
    var affiliations = readJson('adminOfficeAffiliations_v1', {});
    var localSubset = collectRelevantLocalStorage();
    return {
      schema: 'admin_offices_full_local_backup_v3',
      createdAt: new Date().toISOString(),
      reason: reason || 'manual',
      page: 'admin_offices_attendance',
      summary: { offices: Object.keys(names || {}).length, employees: countRows(attendance), keys: Object.keys(localSubset).length },
      data: {
        centersAttendanceData_v2: attendance,
        centerNames_v3: names,
        adminOfficesAttendanceData_v1: attendance,
        adminOfficeNames_v1: names,
        adminOfficeAffiliations_v1: affiliations,
        persistentContractData: readJson('persistentContractData', {}),
        persistentExtractData: readJson('persistentExtractData', {}),
        performanceData_v4: readJson('performanceData_v4', {}),
        performanceDeductions: readJson('performanceDeductions', {}),
        adminOfficePerformanceScores_v1: readJson('adminOfficePerformanceScores_v1', {}),
        adminOfficePerformanceDeductions_v1: readJson('adminOfficePerformanceDeductions_v1', {})
      },
      localStorage: localSubset,
      keyManifest: Object.keys(localSubset).sort()
    };
  }
  function downloadJson(obj, filename) {
    var blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 500);
  }
  function exportAdminOfficesFullBackup() {
    try {
      var backup = buildFullBackupObject('manual-export');
      if (!backup.summary.employees && !confirm('النسخة لا تحتوي على موظفين. متابعة تنزيل نسخة فارغة؟')) return;
      downloadJson(backup, 'admin-offices-full-backup-' + nowStamp() + '.json');
      try { if (typeof window.showSuccessMessage === 'function') window.showSuccessMessage('تم إنشاء نسخة مكاتب كاملة.'); } catch (_) {}
    } catch (e) {
      console.error('[Admin Offices Integrity] backup failed', e);
      alert('فشل إنشاء نسخة المكاتب: ' + (e && e.message ? e.message : e));
    }
  }
  function addMapValue(map, key, value) { if (key && value !== undefined && value !== null) map[key] = typeof value === 'string' ? value : JSON.stringify(value); }
  function normalizeBackupToLocalMap(parsed) {
    var map = {};
    if (!parsed || typeof parsed !== 'object') return map;
    if (parsed.localStorage && typeof parsed.localStorage === 'object') Object.keys(parsed.localStorage).forEach(function (key) { map[key] = parsed.localStorage[key]; });
    if (parsed.localStorageSubset && typeof parsed.localStorageSubset === 'object') Object.keys(parsed.localStorageSubset).forEach(function (key) { map[key] = typeof parsed.localStorageSubset[key] === 'string' ? parsed.localStorageSubset[key] : JSON.stringify(parsed.localStorageSubset[key]); });
    if (parsed.allAdminOfficeStorage && typeof parsed.allAdminOfficeStorage === 'object') Object.keys(parsed.allAdminOfficeStorage).forEach(function (key) { map[key] = parsed.allAdminOfficeStorage[key]; });
    var d = parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;
    var core = parsed.core && typeof parsed.core === 'object' ? parsed.core : {};
    var attendance = d.adminOfficesAttendanceData_v1 || d.centersAttendanceData_v2 || d.attendanceData || core.attendanceData || (parsed.labor && parsed.labor.attendanceData) || null;
    var names = d.adminOfficeNames_v1 || d.centerNames_v3 || core.centerNames || core.names || (parsed.labor && parsed.labor.names) || null;
    var aff = d.adminOfficeAffiliations_v1 || core.affiliations || (parsed.labor && parsed.labor.affiliations) || null;
    addMapValue(map, 'adminOfficesAttendanceData_v1', attendance);
    addMapValue(map, 'adminOfficeNames_v1', names);
    addMapValue(map, 'adminOfficeAffiliations_v1', aff);
    ['persistentContractData','persistentExtractData','performanceData_v4','performanceDeductions','adminOfficePerformanceScores_v1','adminOfficePerformanceDeductions_v1','adminOfficesRaiseLettersSettings_v1'].forEach(function (key) {
      if (d[key] !== undefined) addMapValue(map, key, d[key]);
      else if (core[key] !== undefined) addMapValue(map, key, core[key]);
    });
    return map;
  }
  function clearCurrentAdminOfficeKeys() {
    var keys = [];
    try { for (var i = 0; i < localStorage.length; i++) { var key = localStorage.key(i); if (isRelevantAdminOfficeKey(key)) keys.push(key); } } catch (_) {}
    keys.forEach(function (key) { try { localStorage.removeItem(key); } catch (_) {} });
  }
  function afterRestoreDerivations() {
    var data = readJson('adminOfficesAttendanceData_v1', {});
    if (countRows(data) > 0) {
      var raw = JSON.stringify(data);
      ['adminOfficesAttendanceData_v1_localBackup','adminOfficesAttendanceData_v1_lastGood','adminOfficesLaborDataSafe_v2','adminOfficesAttendanceData'].forEach(function (key) { try { localStorage.setItem(key, raw); } catch (_) {} });
      try { localStorage.setItem('adminOfficesAttendanceData_v1_localBackup_ts', String(Date.now())); } catch (_) {}
    }
    var names = readJson('adminOfficeNames_v1', {});
    if (names && Object.keys(names).length) writeJson('adminOfficesLaborNamesSafe_v2', names);
    var aff = readJson('adminOfficeAffiliations_v1', {});
    if (aff && Object.keys(aff).length) writeJson('adminOfficesLaborAffiliationsSafe_v2', aff);
    var extract = readJson('persistentExtractData', {});
    try {
      if (extract.extractStart) localStorage.setItem('extractStart', extract.extractStart);
      if (extract.extractEnd) localStorage.setItem('extractEnd', extract.extractEnd);
      if (extract.extractMonth) localStorage.setItem('extractMonth', extract.extractMonth);
      if (extract.extractYear) localStorage.setItem('extractYear', extract.extractYear);
      if (extract.paymentNumber || extract.extractNumber) {
        localStorage.setItem('paymentNumber', extract.paymentNumber || extract.extractNumber);
        localStorage.setItem('extractNumber', extract.extractNumber || extract.paymentNumber);
      }
    } catch (_) {}
    try {
      localStorage.setItem('adminOfficesFullAttendanceBundle_v1', JSON.stringify({ schema: 1, updatedAt: new Date().toISOString(), names: names, affiliations: aff, attendanceByOffice: data, extractData: extract }));
      localStorage.setItem('adminOfficesFullAttendanceBundle_v1_ts', String(Date.now()));
    } catch (_) {}
  }
  function importAdminOfficesFullBackup(event) {
    var file = event && event.target && event.target.files ? event.target.files[0] : null;
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(String(reader.result || '{}'));
        var map = normalizeBackupToLocalMap(parsed);
        var hasData = !!(map.adminOfficesAttendanceData_v1 || map.adminOfficeNames_v1 || Object.keys(map).some(isRelevantAdminOfficeKey));
        if (!hasData) throw new Error('ملف النسخة لا يحتوي على بيانات مكاتب قابلة للاستعادة.');
        if (!confirm('سيتم استبدال بيانات المكاتب الحالية بالنسخة المختارة. سيتم حفظ Safety Backup داخلي قبل الاستبدال. متابعة؟')) return;
        try { writeJson(BEFORE_RESTORE_KEY, buildFullBackupObject('before-restore-safety')); } catch (_) {}
        clearCurrentAdminOfficeKeys();
        Object.keys(map).forEach(function (key) { writeRaw(key, map[key]); });
        afterRestoreDerivations();
        alert('تم استعادة نسخة المكاتب كاملة. سيتم إعادة تحميل الصفحة الآن.');
        location.reload();
      } catch (e) {
        console.error('[Admin Offices Integrity] restore failed', e);
        alert('فشل في استعادة البيانات: ' + (e && e.message ? e.message : e));
      } finally {
        try { event.target.value = ''; } catch (_) {}
      }
    };
    reader.onerror = function () { alert('فشل قراءة ملف النسخة.'); };
    reader.readAsText(file, 'utf-8');
  }

  function installBackupRestoreOverrides() {
    window.backupData = exportAdminOfficesFullBackup;
    window.restoreData = importAdminOfficesFullBackup;
    window.AdminOfficesFullLocalBackup = { export: exportAdminOfficesFullBackup, restore: importAdminOfficesFullBackup, build: buildFullBackupObject };
  }
  function installDirtyWarning() {
    if (window.__ADMIN_OFFICES_DIRTY_WARNING_V3__) return;
    window.__ADMIN_OFFICES_DIRTY_WARNING_V3__ = true;
    var initialRows = countRows(getAttendanceDataSafe());
    window.addEventListener('beforeunload', function (e) {
      try {
        var rows = countRows(getAttendanceDataSafe());
        if (rows > 0 && rows !== initialRows) {
          e.preventDefault();
          e.returnValue = 'لديك تعديلات في المكاتب. احفظ نسخة محلية أو ارفع المستخلص قبل الخروج/تغيير الفترة.';
          return e.returnValue;
        }
      } catch (_) {}
    });
  }
  function boot(attempt) {
    installBackupRestoreOverrides();
    injectButton(attempt || 0);
    installDirtyWarning();
    removeLegacyInlineButtons();
    if ((attempt || 0) < 20) setTimeout(function () { boot((attempt || 0) + 1); }, 500);
  }

  window.AdminOfficesSignaturesUnify = { open: openDialog, close: closeDialog };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { boot(0); });
  else boot(0);
  try { new MutationObserver(removeLegacyInlineButtons).observe(document.body || document.documentElement, { childList: true, subtree: true }); } catch (_) {}
  console.info('[Admin Offices Integrity] signature unification button installed v3; grand certificate untouched');
})();