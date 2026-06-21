/**
 * extract-snapshot.js
 * أداة أرشفة مستخلصات العمالة — تحفظ سجلاً لكل عملية حفظ أو طباعة
 * تحديث: حفظ لقطة محلية كاملة قابلة للاستكمال بدون رفع للخادم.
 * تحديث: الاحتفاظ بآخر نسخة فقط لنفس المستخلص المحلي.
 */
(function () {
  if (window.__NAJRAN_EXTRACT_SNAPSHOT_V2__) return;
  window.__NAJRAN_EXTRACT_SNAPSHOT_V2__ = true;

  var ARCHIVE_KEY   = 'extractArchive';
  var MAX_SNAPSHOTS = 100;

  var MONTH_NAMES = [
    'يناير','فبراير','مارس','أبريل','مايو','يونيو',
    'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'
  ];

  var TYPE_PAGE = {
    labor: '/original/attendance.html',
    consumables: '/original/consumables.html',
    spare_parts: '/original/spare_parts.html',
    health_centers: '/original/health_centers_attendance.html',
    admin_offices: '/original/admin_offices_attendance.html'
  };

  var OPERATIONAL_EXACT_KEYS = [
    'attendanceData', 'ng_attendanceData', 'nd_attendanceData',
    'centersAttendanceData_v2', 'healthCentersAttendanceData', 'adminOfficesAttendanceData_v1',
    'persistentExtractData', 'extractMonth', 'extractYear', 'extractStart', 'extractEnd',
    'extractFromDate', 'extractToDate', 'paymentNumber', 'extractNumber', 'periodMonth',
    'performanceData', 'performanceData_v4', 'performanceDeductions', 'performanceTotalDeduction', 'performanceTotalDue',
    'achievementData', 'achievementTitles_v1', 'achievementItemNames',
    'consumablesTableData', 'healthCentersConsumables', 'mainHospitalConsumables', 'admin_offices_consumables_v1.0',
    'spare_partsData', 'sparePartsTotalAmount', 'approvalData', 'displayApprovalData',
    'finalLaborCost', 'finalConsumablesCost', 'grand-net-total', 'grand-net-total-centers', 'grand-net-total-admin',
'najran_labor_attendance_done', 'najran_labor_performance_done', 'najran_health_attendance_done', 'najran_admin_offices_attendance_done',
'najran_revision_extract_id', 'najran_revision_mode', 'najran_revision_extract_type', 'najran_revision_started_at',
'najran_revision_boot_lock', 'najran_revision_source', 'najran_revision_snapshot', 'najran_revision_previous_total_amount'
  ];

  var OPERATIONAL_PREFIXES = [
    'deptCalculatedCost_', 'dept_', 'tableData_', 'achievement_', 'consumables_', 'spare_',
    'water_', 'sewage_', 'subcontractors_', 'najran_labor_', 'najran_health_', 'najran_admin_',
'adminOfficePerformanceItems_', 'adminOfficesPerformanceData_', 'adminOfficesPerformanceDeductions_'
  ];

  var SNAPSHOT_SKIP_PREFIXES = [
    'najran_session', '__clerk', 'clerk_', 'loglevel', 'amplitude', 'chakra', 'persist:'
  ];

var SNAPSHOT_SKIP_KEYS = {
  extractArchive: true,
  najranSignedPdfs: true,
  najran_revision_previous_local_backup: true,
  najran_revision_mode: true,
  najran_revision_extract_id: true,
  najran_revision_extract_type: true,
  najran_revision_started_at: true,
  najran_revision_boot_lock: true,
  najran_revision_source: true,
  najran_revision_snapshot: true,
  najran_revision_previous_total_amount: true
};

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }

  function writeLocalStorageValue(key, value) {
    if (value == null) return;
    try {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    } catch (e) {
      try { localStorage.setItem(key, String(value)); } catch (_) {}
    }
  }

  function normalizeDraftPart(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
  }

  function makeDraftKey(parts) {
    return [
      normalizeDraftPart(parts.extractType),
      normalizeDraftPart(parts.hospitalName),
      normalizeDraftPart(parts.companyName),
      normalizeDraftPart(parts.contractDetails),
      normalizeDraftPart(parts.paymentNumber),
      normalizeDraftPart(parts.extractMonth),
      normalizeDraftPart(parts.extractYear)
    ].join('|');
  }

  function captureFullLocalSnapshot() {
    var snapshot = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key) continue;
        if (SNAPSHOT_SKIP_KEYS[key]) continue;
        if (SNAPSHOT_SKIP_PREFIXES.some(function (p) { return key.indexOf(p) === 0; })) continue;
        var val = localStorage.getItem(key);
        if (val !== null) {
          try { snapshot[key] = JSON.parse(val); }
          catch (_) { snapshot[key] = val; }
        }
      }
    } catch (e) {
      console.warn('extract-snapshot: full snapshot error', e);
    }
    return snapshot;
  }

  function clearOperationalKeysBeforeLocalResume() {
    try {
      OPERATIONAL_EXACT_KEYS.forEach(function (key) { localStorage.removeItem(key); });
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var key = localStorage.key(i);
        if (!key) continue;
        if (OPERATIONAL_PREFIXES.some(function (prefix) { return key.indexOf(prefix) === 0; })) {
          localStorage.removeItem(key);
        }
      }
    } catch (e) {
      console.warn('extract-snapshot: clear operational keys error', e);
    }
  }

  function inferExtractType() {
    var path = (window.location.pathname || '').toLowerCase();
    if (path.indexOf('health_centers') > -1) return 'health_centers';
    if (path.indexOf('admin_offices') > -1) return 'admin_offices';
    if (path.indexOf('spare_parts') > -1) return 'spare_parts';
    if (path.indexOf('consumables') > -1) return 'consumables';
    if (readJson('healthCentersAttendanceData', null) || readJson('healthCentersConsumables', null)) return 'health_centers';
    if (readJson('adminOfficesAttendanceData_v1', null) || readJson('admin_offices_consumables_v1.0', null)) return 'admin_offices';
    if (readJson('spare_partsData', null) || localStorage.getItem('sparePartsTotalAmount')) return 'spare_parts';
    if (readJson('consumablesTableData', null) || readJson('mainHospitalConsumables', null)) return 'consumables';
    return 'labor';
  }

  function pageForType(type, currentPage) {
    if (currentPage && currentPage.indexOf('/original/') === 0) return currentPage;
    return TYPE_PAGE[type] || '/original/attendance.html';
  }

  function hasMeaningfulLocalWork() {
    var keys = [
      'attendanceData', 'ng_attendanceData', 'nd_attendanceData',
      'healthCentersAttendanceData', 'centersAttendanceData_v2', 'adminOfficesAttendanceData_v1',
      'achievementData', 'consumablesTableData', 'healthCentersConsumables', 'mainHospitalConsumables',
      'admin_offices_consumables_v1.0', 'spare_partsData', 'sparePartsTotalAmount'
    ];
    try {
      for (var i = 0; i < keys.length; i++) {
        var raw = localStorage.getItem(keys[i]);
        if (!raw) continue;
        if (raw !== '{}' && raw !== '[]' && raw !== '0') return true;
      }
      return ['najran_labor_attendance_done', 'najran_labor_performance_done', 'najran_health_attendance_done', 'najran_admin_offices_attendance_done']
        .some(function (key) { return localStorage.getItem(key) === '1'; });
    } catch (_) { return false; }
  }
function getCurrentLocalWorkLabel() {
  try {
    var extractData = readJson('persistentExtractData', {});
    var contractData = readJson('persistentContractData', {});

    var payment = extractData.paymentNumber || localStorage.getItem('paymentNumber') || localStorage.getItem('extractNumber') || '';
    var month = extractData.extractMonth || localStorage.getItem('extractMonth') || '';
    var year = extractData.extractYear || localStorage.getItem('extractYear') || '';
    var hospital = contractData.hospitalName || localStorage.getItem('hospitalName') || '';
    var company = contractData.companyName || localStorage.getItem('companyName') || '';

    var parts = [];
    if (payment) parts.push('رقم الدفعة: ' + payment);
    if (month || year) parts.push('الفترة: ' + [month, year].filter(Boolean).join(' '));
    if (hospital) parts.push('الموقع: ' + hospital);
    if (company) parts.push('الشركة: ' + company);

    return parts.join(' — ') || 'مستخلص محلي مفتوح حاليًا';
  } catch (_) {
    return 'مستخلص محلي مفتوح حاليًا';
  }
}

function showLocalProtectionModal(options) {
  options = options || {};

  return new Promise(function (resolve) {
    var old = document.getElementById('najran-local-protection-modal');
    if (old) old.remove();

    var overlay = document.createElement('div');
    overlay.id = 'najran-local-protection-modal';
    overlay.className = 'no-print';
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:10000000;background:rgba(15,23,42,.62);' +
      'display:flex;align-items:center;justify-content:center;direction:rtl;' +
      'font-family:Tajawal,Arial,sans-serif;';

    overlay.innerHTML =
      '<div style="width:min(620px,94vw);background:#fff;border-radius:22px;padding:24px;' +
        'box-shadow:0 28px 80px rgba(0,0,0,.32);border-top:7px solid #b45309;text-align:right;">' +

        '<div style="display:flex;gap:14px;align-items:flex-start;margin-bottom:14px;">' +
          '<div style="width:52px;height:52px;border-radius:17px;background:#fff7ed;color:#b45309;' +
            'display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;">!</div>' +
          '<div style="flex:1;">' +
            '<h2 style="margin:0;color:#92400e;font-size:22px;font-weight:900;">' + (options.title || 'يوجد مستخلص محلي غير محفوظ') + '</h2>' +
            '<p style="margin:8px 0 0;color:#475569;font-size:14px;line-height:1.9;">' +
              (options.message || 'قبل الانتقال، احفظ المستخلص الحالي محليًا حتى لا يتم استبدال البيانات الموجودة على هذا الجهاز.') +
            '</p>' +
          '</div>' +
        '</div>' +

        '<div style="background:#fffbeb;border:1px solid #fde68a;color:#78350f;border-radius:14px;' +
          'padding:12px 14px;font-size:13px;line-height:1.9;margin:14px 0;">' +
          '<b>البيانات الحالية:</b><br>' + getCurrentLocalWorkLabel() +
        '</div>' +

        '<div style="display:flex;gap:10px;justify-content:flex-start;flex-wrap:wrap;margin-top:16px;">' +
          '<button id="najran-local-protection-primary" style="background:linear-gradient(135deg,#166534,#16a34a);' +
            'color:white;border:0;border-radius:12px;padding:12px 18px;font-weight:900;cursor:pointer;' +
            'font-family:Tajawal,Arial,sans-serif;">' + (options.primaryText || 'حفظ محليًا ثم المتابعة') + '</button>' +

          '<button id="najran-local-protection-secondary" style="background:#1e3a8a;color:white;border:0;border-radius:12px;' +
            'padding:12px 18px;font-weight:900;cursor:pointer;font-family:Tajawal,Arial,sans-serif;">' +
            (options.secondaryText || 'استكمال المستخلص الحالي') + '</button>' +

          '<button id="najran-local-protection-cancel" style="background:#475569;color:white;border:0;border-radius:12px;' +
            'padding:12px 18px;font-weight:900;cursor:pointer;font-family:Tajawal,Arial,sans-serif;">' +
            (options.cancelText || 'إلغاء') + '</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    function close(result) {
      overlay.remove();
      resolve(result);
    }

    document.getElementById('najran-local-protection-primary').onclick = function () { close('primary'); };
    document.getElementById('najran-local-protection-secondary').onclick = function () { close('secondary'); };
    document.getElementById('najran-local-protection-cancel').onclick = function () { close('cancel'); };
  });
}
  /* ───── قراءة الأرشيف ───── */
  window.getExtractArchive = function () {
    try { return JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]'); }
    catch (e) { return []; }
  };

  /* ───── حفظ snapshot ───── */
  window.saveExtractSnapshot = function (source) {
    source = source || 'manual';
    try {
      var extractData  = readJson('persistentExtractData', {});
      var contractData = readJson('persistentContractData', {});
      var fullSnapshot = captureFullLocalSnapshot();
      var extractType  = inferExtractType();
      var currentPage  = window.location.pathname || pageForType(extractType);

      var paymentNumber = extractData.paymentNumber || localStorage.getItem('paymentNumber') || '';
      var extractMonth  = extractData.extractMonth || localStorage.getItem('extractMonth') || '';
      var extractYear   = String(extractData.extractYear || localStorage.getItem('extractYear') || '');
      var extractStart  = extractData.extractStart || localStorage.getItem('extractStart') || '';
      var extractEnd    = extractData.extractEnd || localStorage.getItem('extractEnd') || '';
      var hospitalName  = contractData.hospitalName || localStorage.getItem('hospitalName') || '';
      var companyName   = contractData.companyName || localStorage.getItem('companyName') || '';
      var contractDetails = contractData.contractDetails || contractData.contractNumber || localStorage.getItem('contractDetails') || '';

      /* ملخص أقسام الحضور */
      var totalEmployees = 0;
      var totalNetAmount = 0;
      var departments    = {};
      try {
        var att = readJson('attendanceData', {});
        Object.keys(att || {}).forEach(function (dept) {
          var emps = att[dept] || [];
          var deptNet = emps.reduce(function (s, emp) {
            var sal  = parseFloat(emp.salary) || 0;
            var ded  = parseFloat(emp.totalDeduction || emp.deduction) || 0;
            var fine = parseFloat(emp.totalFine) || 0;
            return s + Math.max(0, sal - ded - fine);
          }, 0);
          departments[dept] = { count: emps.length, total: deptNet };
          totalEmployees += emps.length;
          totalNetAmount += deptNet;
        });
      } catch (e) {}

      var draftKey = makeDraftKey({
        extractType: extractType,
        hospitalName: hospitalName,
        companyName: companyName,
        contractDetails: contractDetails,
        paymentNumber: paymentNumber,
        extractMonth: extractMonth,
        extractYear: extractYear
      });

     var archive = window.getExtractArchive();
var existingSnap = archive.find(function (oldSnap) {
  if (!oldSnap) return false;
  if (oldSnap.draftKey && oldSnap.draftKey === draftKey) return true;

  if (!oldSnap.draftKey) {
    var oldKey = makeDraftKey({
      extractType: oldSnap.extractType || 'labor',
      hospitalName: oldSnap.hospitalName,
      companyName: oldSnap.companyName,
      contractDetails: oldSnap.contractDetails,
      paymentNumber: oldSnap.paymentNumber,
      extractMonth: oldSnap.extractMonth,
      extractYear: oldSnap.extractYear
    });
    return oldKey === draftKey;
  }

  return false;
});

var snap = {
  id:             existingSnap && existingSnap.id ? String(existingSnap.id) : String(Date.now()),
  draftKey:       draftKey,
  savedAt:        new Date().toISOString(),
  source:         source,
        canResume:      true,
        extractType:    extractType,
        currentPage:    currentPage,
        extractData:    fullSnapshot,
        paymentNumber:  paymentNumber,
        extractMonth:   extractMonth,
        extractYear:    extractYear,
        extractStart:   extractStart,
        extractEnd:     extractEnd,
        hospitalName:   hospitalName,
        companyName:    companyName,
        contractDetails: contractDetails,
        engineeringManager:    contractData.engineeringManager    || '',
        generalServicesManager: contractData.generalServicesManager || '',
        hospitalManager:       contractData.hospitalManager        || '',
        followUpManager:       contractData.followUpManager        || '',
        totalEmployees:  totalEmployees,
        totalNetAmount:  totalNetAmount,
        departments:     departments
      };

      var before = archive.length;
      archive = archive.filter(function (oldSnap) {
        if (!oldSnap) return false;
        if (oldSnap.draftKey && oldSnap.draftKey === draftKey) return false;
        if (!oldSnap.draftKey) {
          var oldKey = makeDraftKey({
            extractType: oldSnap.extractType || 'labor',
            hospitalName: oldSnap.hospitalName,
            companyName: oldSnap.companyName,
            contractDetails: oldSnap.contractDetails,
            paymentNumber: oldSnap.paymentNumber,
            extractMonth: oldSnap.extractMonth,
            extractYear: oldSnap.extractYear
          });
          if (oldKey === draftKey) return false;
        }
        return true;
      });
      archive.unshift(snap);
      if (archive.length > MAX_SNAPSHOTS) archive.splice(MAX_SNAPSHOTS);
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archive));
      try {
        localStorage.setItem('najran_last_local_snapshot_key', draftKey);
        localStorage.setItem('najran_last_local_snapshot_replaced', String(before - archive.length + 1));
      } catch (_) {}
      return snap;
    } catch (e) {
      console.warn('extract-snapshot: save error', e);
      return null;
    }
  };

  /* ───── استكمال لقطة محلية ───── */
  window.resumeExtractSnapshot = function (id, options) {     options = options || {};
    try {
      var snap = window.getExtractArchive().find(function (s) { return String(s.id) === String(id); });
      if (!snap) { alert('لم يتم العثور على اللقطة المحلية.'); return false; }
      if (!snap.extractData || typeof snap.extractData !== 'object') {
        alert('هذه اللقطة قديمة ولا تحتوي بيانات كاملة للاستكمال.');
        return false;
      }

    if (hasMeaningfulLocalWork() && !options.skipProtection) {
        showLocalProtectionModal({
          title: 'يوجد مستخلص محلي مفتوح حاليًا',
          message: 'استكمال لقطة محلية أخرى سيستبدل بيانات التشغيل الحالية. احفظ الحالي محليًا أولًا أو استكمل العمل الحالي.',
          primaryText: 'حفظ الحالي محليًا ثم استكمال اللقطة',
          secondaryText: 'استكمال المستخلص الحالي',
          cancelText: 'إلغاء'
        }).then(function (action) {
          if (action === 'primary') {
            var saved = window.saveExtractSnapshot('before-resume-local-snapshot');
            if (!saved) {
              alert('تعذر حفظ المستخلص الحالي محليًا. لم يتم استكمال اللقطة الأخرى.');
              return;
            }
            window.resumeExtractSnapshot(id, { skipProtection: true });
            return;
          }

          if (action === 'secondary') {
            return;
          }

          return;
        });

        return false;
      }

      clearOperationalKeysBeforeLocalResume();
      Object.keys(snap.extractData).forEach(function (key) {
        writeLocalStorageValue(key, snap.extractData[key]);
      });
      localStorage.removeItem('najran_revision_extract_id');
localStorage.removeItem('najran_revision_mode');
localStorage.removeItem('najran_revision_extract_type');
localStorage.removeItem('najran_revision_started_at');
localStorage.removeItem('najran_revision_boot_lock');
localStorage.removeItem('najran_revision_source');
localStorage.removeItem('najran_revision_snapshot');
localStorage.removeItem('najran_revision_previous_total_amount');

localStorage.setItem('najran_local_draft_resume_id', String(snap.id));
      localStorage.setItem('najran_local_draft_resumed_at', new Date().toISOString());

      window.location.href = pageForType(snap.extractType || inferExtractType(), snap.currentPage);
      return true;
    } catch (e) {
      console.warn('extract-snapshot: resume error', e);
      alert('تعذر استكمال اللقطة المحلية.');
      return false;
    }
  };

  /* ───── حذف snapshot ───── */
  window.deleteExtractSnapshot = function (id) {
    try {
      var arc = window.getExtractArchive().filter(function (s) { return s.id !== id; });
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify(arc));
      return true;
    } catch (e) { return false; }
  };

  /* ───── فحص التكرار ───── */
  window.checkDuplicateExtract = function (paymentNumber, month, year) {
    var pn = String(paymentNumber || '').trim();
    if (!pn) return null;
    return window.getExtractArchive().find(function (s) {
      return s.paymentNumber === pn &&
             s.extractMonth  === String(month  || '') &&
             String(s.extractYear) === String(year || '');
    }) || null;
  };

  /* ───── مساعد: تنسيق التاريخ محلياً بدون تحويل UTC ───── */
  function toLocalDateStr(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  /* ───── مساعد: تحليل سلسلة YYYY-MM-DD كتاريخ محلي ───── */
  function parseLocalDate(str) {
    var parts = (str || '').split('-');
    if (parts.length < 3) return new Date(str);
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }

  /* ───── تقديم تلقائي للفترة التالية ───── */
  window.autoIncrementExtractPeriod = function () {
    try {
      var data = readJson('persistentExtractData', {});
      if (!data.extractStart) return null;

      var start = parseLocalDate(data.extractStart);
      start.setDate(1);
      start.setMonth(start.getMonth() + 1);
      var end = new Date(start.getFullYear(), start.getMonth() + 1, 0);

      var pn = String(data.paymentNumber || '1').trim();
      var num = parseInt(pn, 10);
      var newPn = isNaN(num) ? pn : String(num + 1).padStart(pn.length, '0');

      var newData = Object.assign({}, data, {
        extractMonth: MONTH_NAMES[start.getMonth()],
        extractYear:  start.getFullYear(),
        paymentNumber: newPn,
        extractStart: toLocalDateStr(start),
        extractEnd:   toLocalDateStr(end)
      });

      localStorage.setItem('persistentExtractData', JSON.stringify(newData));
      return newData;
    } catch (e) {
      console.warn('extract-snapshot: autoIncrement error', e);
      return null;
    }
  };

  /* ───── زر استكمال داخل تبويب المحلي الموجود ───── */
  function enhanceArchiveResumeButtons() {
    try {
      var archive = window.getExtractArchive();
      archive.forEach(function (snap) {
        if (!snap || !snap.canResume || !snap.extractData) return;
        var card = document.getElementById('card-' + snap.id);
        if (!card || card.querySelector('.arc-btn-resume')) return;
        var actions = card.querySelector('.arc-actions');
        if (!actions) return;
        var btn = document.createElement('button');
        btn.className = 'arc-btn arc-btn-resume';
        btn.style.background = 'linear-gradient(135deg,#15803d,#16a34a)';
        btn.style.color = '#fff';
        btn.innerHTML = '<i class="fas fa-play"></i> استكمال';
        btn.onclick = function () { window.resumeExtractSnapshot(snap.id); };
        actions.insertBefore(btn, actions.firstChild);
      });
    } catch (e) {}
  }

  function installArchiveRenderPatch() {
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      if (typeof window.renderArchive === 'function' && !window.__NAJRAN_ARCHIVE_RESUME_PATCH__) {
        window.__NAJRAN_ARCHIVE_RESUME_PATCH__ = true;
        var originalRenderArchive = window.renderArchive;
        window.renderArchive = function () {
          var out = originalRenderArchive.apply(this, arguments);
          setTimeout(enhanceArchiveResumeButtons, 0);
          return out;
        };
        setTimeout(enhanceArchiveResumeButtons, 0);
        clearInterval(timer);
      }
      if (tries > 40) clearInterval(timer);
    }, 100);
  }

  /* ───── حفظ محلي عند الخروج للرئيسية بدل الرفع ───── */
  function installLocalSaveOnHomeExit() {
    var file = (window.location.pathname || '').split('/').pop() || '';
    var workPages = {
      'attendance.html': true,
      'performance.html': true,
      'achievement.html': true,
      'consumables.html': true,
      'spare_parts.html': true,
      'health_centers_attendance.html': true,
      'health_centers_consumables.html': true,
      'admin_offices_attendance.html': true,
      'admin_offices_consumables.html': true,
      'najran_general_attendance.html': true,
      'najran_general_performance.html': true,
      'najran_general_achievement.html': true,
      'najran_dental_attendance.html': true,
      'najran_dental_performance.html': true
    };
    if (!workPages[file]) return;

    document.addEventListener('click', function (e) {
      var el = e.target && e.target.closest ? e.target.closest('a,button') : null;
      if (!el) return;
      var href = el.getAttribute('href') || '';
      var text = (el.textContent || '').trim();
      var goesHome = href === '/dashboard' || href.indexOf('/dashboard') === 0 || text.indexOf('الرئيسية') > -1;
      if (!goesHome) return;
      if (!hasMeaningfulLocalWork()) return;

      e.preventDefault();
      e.stopPropagation();

          showLocalProtectionModal({
        title: 'يوجد مستخلص محلي غير محفوظ على هذا الجهاز',
        message: 'قبل الرجوع للرئيسية، احفظ المستخلص الحالي محليًا حتى لا تضيع بيانات التشغيل الحالية.',
        primaryText: 'حفظ محليًا ثم الرجوع للرئيسية',
        secondaryText: 'استكمال المستخلص الحالي',
        cancelText: 'إلغاء'
      }).then(function (action) {
        if (action === 'primary') {
          var snap = window.saveExtractSnapshot('home-exit-save');
          if (!snap) {
            alert('تعذر حفظ المستخلص الحالي محليًا. لم يتم الخروج من الصفحة.');
            return;
          }
          alert('تم حفظ آخر نسخة من هذا المستخلص محليًا. يمكنك استكمالها لاحقًا من أرشيف المستخلصات > لقطات العمل المحلية.');
          window.location.href = href || '/dashboard';
          return;
        }

        if (action === 'secondary') {
          return;
        }

        return;
      });
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      installArchiveRenderPatch();
      installLocalSaveOnHomeExit();
    });
  } else {
    installArchiveRenderPatch();
    installLocalSaveOnHomeExit();
  }
})();
