/**
 * attendance-cloud-refresh-guard.js — V4 safe operational/local-wins mode
 *
 * القاعدة النهائية:
 * - المراجع: قراءة فقط. لو لا توجد نسخة سحابية، يتم تفريغ المحلي دائماً لمنع خلط المستشفيات.
 * - المستخدم العادي: لو السيرفر فاضي، ينظف المحلي القديم مرة واحدة فقط عند بداية الصفحة.
- عند اختلاف المحلي والسحابي: موافق = تنزيل السحابة. إلغاء = وقف فقط بدون رفع المحلي.
- بعد أول تعديل من المستخدم، لا يتم استبداله ولا رفعه تلقائياً فوق السحابة. * - بعد أول تعديل من المستخدم، لا يتم استبدال عمله تلقائياً بسحابة قديمة أثناء نفس الجلسة.
 */
(function () {
  'use strict';

  var sig = location.pathname + location.search;
  var isAttendancePage = /attendance\.html(?:$|[?#])/.test(sig) || /[?&]page=.*attendance\.html(?:$|&)/.test(sig);
  if (!isAttendancePage) return;

  var normalEmptyCloudHandled = false;
  var userTouchedAttendance = false;
  var localWinsUntilSynced = false;
  var cloudComparisonStarted = false;
  var cloudComparisonRunning = false;
var pendingLocalAttendanceUpload = false;
  function markAttendanceUserTouched() {
    if (!isReviewOnlySession()) userTouchedAttendance = true;
  }

  document.addEventListener('input', markAttendanceUserTouched, true);
  document.addEventListener('change', markAttendanceUserTouched, true);

  var ATTENDANCE_KEYS = [
    'attendanceData','ng_attendanceData','nd_attendanceData',
    'centersAttendanceData_v2','healthCentersAttendanceData','adminOfficesAttendanceData_v1'
  ];

  function getActiveAttendanceKeys() {
    var full = location.pathname + (location.search || '');
    if (/admin_offices_attendance\.html/.test(full)) return ['adminOfficesAttendanceData_v1'];
    if (/health_centers_attendance\.html/.test(full)) return ['healthCentersAttendanceData'];
    if (/najran_general/.test(full)) return ['ng_attendanceData'];
    if (/dental/.test(full)) return ['nd_attendanceData'];
    return ['attendanceData'];
  }

  function getLocalWinsKey(activeKeys) {
    var s = getSession();
    var hospital = String((s && s.hospital) || '').trim();
    var keys = (activeKeys || getActiveAttendanceKeys()).join('|');
    return 'najran_attendance_local_wins_' + hospital + '_' + keys;
  }

  function markLocalWinsPersistent(activeKeys, reason) {
    try {
      var s = getSession();
      localStorage.setItem(getLocalWinsKey(activeKeys), JSON.stringify({
        hospital: (s && s.hospital) || '',
        keys: activeKeys || getActiveAttendanceKeys(),
        reason: reason || '',
        updatedAt: new Date().toISOString()
      }));
    } catch (_) {}
  }

  function hasLocalWinsPersistent(activeKeys) {
    try {
      var raw = localStorage.getItem(getLocalWinsKey(activeKeys));
      if (!raw) return false;

      var saved = parse(raw);
      var s = getSession();
      if (!saved || !s) return false;

      return String(saved.hospital || '').trim() === String(s.hospital || '').trim();
    } catch (_) {
      return false;
    }
  }

  function clearLocalWinsPersistent(activeKeys) {
    try {
      localStorage.removeItem(getLocalWinsKey(activeKeys));
    } catch (_) {}
  }

  function getSession() {
    try { return JSON.parse(localStorage.getItem('najran_session') || '{}') || {}; } catch (_) { return {}; }
  }

  function isReviewOnlySession() {
    var s = getSession();
    return !!(s && s.reviewOnly === true);
  }

  async function getToken() {
    try {
      if (typeof window.najranGetFreshToken === 'function') { var t = await window.najranGetFreshToken(); if (t) return t; }
      if (window.parent && window.parent !== window && typeof window.parent.najranGetFreshToken === 'function') { var pt = await window.parent.najranGetFreshToken(); if (pt) return pt; }
    } catch (_) {}
    return getSession().clerkToken || '';
  }

  function getHospitalStorageUrl() {
    var s = getSession();
    var url = '/api/hospital-storage';
    if (s && s.reviewOnly === true && s.hospital) url += '?hospital=' + encodeURIComponent(String(s.hospital).trim());
    return url;
  }

  function parse(v) {
    if (!v) return null;
    if (typeof v === 'object') return v;
    try { return JSON.parse(v); } catch (_) { return null; }
  }

  function normalizeKey(key) { return String(key || '').replace(/^(_u\d+_)+/, ''); }

  function normalizeRemoteDataKeys(data) {
    var out = {};
    data = data || {};
    Object.keys(data).forEach(function(key) {
      var nk = normalizeKey(key);
      if (!nk) return;
      if (out[nk] == null || countRows(data[key]) > countRows(out[nk])) out[nk] = data[key];
    });
    return out;
  }

  function countRows(obj) {
    var v = parse(obj);
    if (!v) return 0;
    if (Array.isArray(v)) return v.length;
    if (typeof v === 'object') {
      var total = 0;
      Object.keys(v).forEach(function(k) {
        var x = v[k];
        if (Array.isArray(x)) total += x.length;
        else if (x && typeof x === 'object') total += countRows(x);
      });
      return total;
    }
    return 0;
  }

  function daysBetweenInclusive(start, end) {
    if (!start || !end) return 0;
    var s = new Date(start), e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
    return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
  }

  function readCurrentExtractPeriodDays() {
    try {
      var d = JSON.parse(localStorage.getItem('persistentExtractData') || '{}');
      return daysBetweenInclusive(d.extractStart || localStorage.getItem('extractStart'), d.extractEnd || localStorage.getItem('extractEnd'));
    } catch (_) { return daysBetweenInclusive(localStorage.getItem('extractStart'), localStorage.getItem('extractEnd')); }
  }

  function applyExtractSettingsFromCloud(data) {
    try {
      data = data || {};
      var extract = parse(data.persistentExtractData) || {};
      if (!extract.extractMonth && data.extractMonth) extract.extractMonth = data.extractMonth;
      if (!extract.extractYear && data.extractYear) extract.extractYear = data.extractYear;
      if (!extract.extractStart && data.extractStart) extract.extractStart = data.extractStart;
      if (!extract.extractEnd && data.extractEnd) extract.extractEnd = data.extractEnd;
      if (!extract.paymentNumber && (data.paymentNumber || data.extractNumber)) extract.paymentNumber = data.paymentNumber || data.extractNumber;
      if (!extract.extractCalendar) extract.extractCalendar = 'ميلادي';
      if (!extract.extractDuration) extract.extractDuration = 'شهر واحد';
      if (!extract.extractStart || !extract.extractEnd || !extract.extractMonth || !extract.extractYear) return false;
      localStorage.setItem('persistentExtractData', JSON.stringify(extract));
      localStorage.setItem('extractMonth', extract.extractMonth || '');
      localStorage.setItem('extractYear', String(extract.extractYear || ''));
      localStorage.setItem('extractStart', extract.extractStart || '');
      localStorage.setItem('extractEnd', extract.extractEnd || '');
      localStorage.setItem('paymentNumber', extract.paymentNumber || '');
      localStorage.setItem('extractNumber', extract.paymentNumber || '');
      var monthKey = extract.extractYear && extract.extractMonth ? String(extract.extractYear) + '_' + String(extract.extractMonth) : '';
      if (monthKey) {
        var snapKey = 'monthSnapshot_' + monthKey;
        var snap = parse(localStorage.getItem(snapKey)) || {};
        snap.persistentExtractData = JSON.stringify(extract);
        snap.extractMonth = extract.extractMonth || '';
        snap.extractYear = String(extract.extractYear || '');
        snap.extractStart = extract.extractStart || '';
        snap.extractEnd = extract.extractEnd || '';
        snap.paymentNumber = extract.paymentNumber || '';
        snap.extractNumber = extract.paymentNumber || '';
        localStorage.setItem(snapKey, JSON.stringify(snap));
      }
      return true;
    } catch (e) { console.warn('[AttendanceCloudGuard] فشل تثبيت إعدادات المستخلص', e); return false; }
  }

  function normalizeEmployeeDays(x, daysInPeriod) {
    if (!x || typeof x !== 'object' || !Array.isArray(x.days) || daysInPeriod <= 0) return;
    if (x.days.length < daysInPeriod) x.days = x.days.concat(Array(daysInPeriod - x.days.length).fill('ح'));
    else if (x.days.length > daysInPeriod) x.days = x.days.slice(0, daysInPeriod);
  }

  function normalizeAttendanceValueForCurrentPeriod(value) {
    var parsed = parse(value);
    var daysInPeriod = readCurrentExtractPeriodDays();
    if (!parsed || !daysInPeriod) return value;
    function walk(node) {
      if (!node) return;
      if (Array.isArray(node)) { node.forEach(function(item){ normalizeEmployeeDays(item, daysInPeriod); if (item && typeof item === 'object') walk(item); }); return; }
      if (typeof node === 'object') { normalizeEmployeeDays(node, daysInPeriod); Object.keys(node).forEach(function(k){ walk(node[k]); }); }
    }
    walk(parsed);
    return JSON.stringify(parsed);
  }

  function normalizeLocalAttendanceForCurrentPeriod(keys) {
    var changed = 0;
    (keys || getActiveAttendanceKeys()).forEach(function(k) {
      var val = localStorage.getItem(k);
      if (!val) return;
      var normalized = normalizeAttendanceValueForCurrentPeriod(val);
      if (normalized && normalized !== val) { localStorage.setItem(k, normalized); changed++; }
    });
    return changed;
  }

  function localAttendanceRows(keys) {
    var total = 0;
    (keys || getActiveAttendanceKeys()).forEach(function(k){ total += countRows(localStorage.getItem(k)); });
    return total;
  }

  function remoteAttendanceRows(data, keys) {
    var total = 0;
    (keys || getActiveAttendanceKeys()).forEach(function(k){ total += countRows(data && data[k]); });
    return total;
  }

  function getRemoteMeta(data) {
    try {
      var activity = data && data.hospitalActivityStatus ? parse(data.hospitalActivityStatus) : null;
      return { userName: (activity && activity.userName) || 'مستخدم آخر', updatedAt: (activity && activity.updatedAt) || '', page: (activity && activity.page) || '', pageFile: (activity && activity.pageFile) || '' };
    } catch (_) { return { userName: 'مستخدم آخر', updatedAt: '', page: '', pageFile: '' }; }
  }

  function sameAttendanceSnapshot(data, keys) {
    try {
      return (keys || getActiveAttendanceKeys()).every(function(k) {
        var localVal = localStorage.getItem(k) || '';
        var remoteVal = data && data[k] != null ? (typeof data[k] === 'string' ? data[k] : JSON.stringify(data[k])) : '';
        remoteVal = normalizeAttendanceValueForCurrentPeriod(remoteVal);
        return localVal === remoteVal;
      });
    } catch (_) { return false; }
  }

  function formatDateTime(value) {
    if (!value) return '';
    try { return new Date(value).toLocaleString('ar-SA', { hour12: true }); } catch (_) { return String(value); }
  }

  function clearLocalAttendanceState(reason, activeKeys) {
    var removed = [];
    try {
      (activeKeys || getActiveAttendanceKeys()).forEach(function(k) {
        if (localStorage.getItem(k) != null) removed.push(k);
        localStorage.removeItem(k);
      });
      Object.keys(localStorage).forEach(function(k) {
        var lk = String(k || '').toLowerCase();
        if (lk.indexOf('attendancedata') >= 0 || lk.indexOf('attendance') >= 0 || lk.indexOf('monthsnapshot') >= 0) {
          removed.push(k);
          localStorage.removeItem(k);
        }
      });
    } catch (_) {}
    console.warn('[AttendanceCloudGuard] تم تفريغ الحضور المحلي: ' + (reason || '') + ' — removed=' + removed.length);
  }

 function forceLocalAttendanceDirtyAndSync(activeKeys, reason) {
  console.warn('[AttendanceCloudGuard] SAFE STOP: تم منع رفع النسخة المحلية تلقائياً — ' + (reason || ''));
}

  function shouldReplaceLocalAttendance(localRows, remoteRows, meta, keys) {
    var msg =
      'يوجد اختلاف بين بيانات الحضور المحلية والنسخة السحابية.\n\n' +
      'المفاتيح: ' + (keys || []).join(', ') + '\n' +
      'المحلي عندك: ' + localRows + ' صف\n' +
      'السحابي: ' + remoteRows + ' صف\n' +
      'آخر تعديل على السحابة: ' + (meta.userName || 'مستخدم آخر') + '\n' +
      (meta.updatedAt ? ('الوقت: ' + formatDateTime(meta.updatedAt) + '\n') : '') +
'\nموافق = تنزيل النسخة السحابية واستبدال المحلي\nإلغاء = الاحتفاظ بالوضع الحالي فقط بدون رفع المحلي للسحابة';   
    return confirm(msg);
  }

  function renderAgain(reason) {
    try { if (typeof window.updateContractDisplayData === 'function') window.updateContractDisplayData(); } catch (_) {}
    try { if (typeof window.rebuildTableHeaders === 'function') window.rebuildTableHeaders(); } catch (_) {}
    try { if (typeof window.renderTables === 'function') window.renderTables(); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('najranAttendanceCloudRestored', { detail: { reason: reason || '' } })); } catch (_) {}
  }
function showAttendanceUploadProgressModal() {
  var old = document.getElementById('attendance-upload-progress-modal');
  if (old) old.remove();

  var modal = document.createElement('div');
  modal.id = 'attendance-upload-progress-modal';
  modal.className = 'no-print';
  modal.style.cssText =
    'position:fixed;inset:0;background:rgba(15,23,42,.62);z-index:1000000;' +
    'display:flex;align-items:center;justify-content:center;direction:rtl;' +
    'font-family:Tajawal,Arial,sans-serif;';

  modal.innerHTML =
    '<div style="width:min(560px,94vw);background:#fff;border-radius:20px;padding:24px;' +
      'box-shadow:0 24px 70px rgba(0,0,0,.32);border-top:6px solid #166534;text-align:right;">' +

      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">' +
        '<div id="attendance-upload-spinner" style="width:42px;height:42px;border-radius:50%;border:4px solid #dcfce7;border-top-color:#166534;animation:attendanceUploadSpin .8s linear infinite;"></div>' +
        '<div>' +
          '<h2 id="attendance-upload-title" style="margin:0;color:#14532d;font-size:22px;font-weight:900;">جاري رفع بيانات الحضور</h2>' +
          '<div id="attendance-upload-subtitle" style="color:#64748b;font-size:13px;margin-top:4px;">يرجى عدم إغلاق الصفحة حتى انتهاء العملية</div>' +
        '</div>' +
      '</div>' +

      '<div id="attendance-upload-step" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:11px 13px;color:#334155;font-size:14px;margin-bottom:14px;">تجهيز البيانات...</div>' +

      '<div style="height:16px;background:#e5e7eb;border-radius:999px;overflow:hidden;margin-bottom:8px;">' +
        '<div id="attendance-upload-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#16a34a,#22c55e);border-radius:999px;transition:width .25s ease;"></div>' +
      '</div>' +

      '<div style="display:flex;justify-content:space-between;align-items:center;color:#64748b;font-size:13px;">' +
        '<span id="attendance-upload-percent">0%</span>' +
        '<span id="attendance-upload-status">بدء الرفع</span>' +
      '</div>' +

      '<div id="attendance-upload-error" style="display:none;margin-top:14px;background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:12px;padding:10px 12px;font-size:14px;line-height:1.8;"></div>' +

      '<button id="attendance-upload-close-error" style="display:none;margin-top:14px;background:#475569;color:#fff;border:none;border-radius:10px;padding:10px 16px;font-weight:800;cursor:pointer;font-family:Tajawal,Arial,sans-serif;">إغلاق</button>' +
    '</div>';

  document.body.appendChild(modal);

  if (!document.getElementById('attendance-upload-progress-style')) {
    var style = document.createElement('style');
    style.id = 'attendance-upload-progress-style';
    style.textContent =
      '@keyframes attendanceUploadSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
    document.head.appendChild(style);
  }

  return {
    modal: modal,
    setProgress: function(percent, step, status) {
      percent = Math.max(0, Math.min(100, Number(percent || 0)));

      var bar = document.getElementById('attendance-upload-bar');
      var percentEl = document.getElementById('attendance-upload-percent');
      var stepEl = document.getElementById('attendance-upload-step');
      var statusEl = document.getElementById('attendance-upload-status');

      if (bar) bar.style.width = percent + '%';
      if (percentEl) percentEl.textContent = percent + '%';
      if (stepEl && step) stepEl.textContent = step;
      if (statusEl && status) statusEl.textContent = status;
    },
    success: function(message) {
      var title = document.getElementById('attendance-upload-title');
      var subtitle = document.getElementById('attendance-upload-subtitle');
      var spinner = document.getElementById('attendance-upload-spinner');

      this.setProgress(100, message || 'تم رفع البيانات بنجاح', 'اكتمل الرفع');

      if (title) {
        title.textContent = 'تم الرفع بنجاح';
        title.style.color = '#166534';
      }
      if (subtitle) subtitle.textContent = 'تم حفظ بيانات الحضور على السحابة';
      if (spinner) {
        spinner.style.animation = 'none';
        spinner.style.border = '4px solid #bbf7d0';
        spinner.style.background = '#22c55e';
      }
    },
    error: function(message) {
      var title = document.getElementById('attendance-upload-title');
      var subtitle = document.getElementById('attendance-upload-subtitle');
      var spinner = document.getElementById('attendance-upload-spinner');
      var errorBox = document.getElementById('attendance-upload-error');
      var closeBtn = document.getElementById('attendance-upload-close-error');

      if (title) {
        title.textContent = 'فشل الرفع';
        title.style.color = '#991b1b';
      }
      if (subtitle) subtitle.textContent = 'لم يتم حفظ التعديلات على السحابة';
      if (spinner) {
        spinner.style.animation = 'none';
        spinner.style.border = '4px solid #fecaca';
        spinner.style.background = '#ef4444';
      }
      if (errorBox) {
        errorBox.style.display = 'block';
        errorBox.textContent = message || 'حدث خطأ أثناء الرفع. لم يتم تغيير بيانات السحابة.';
      }
      if (closeBtn) {
        closeBtn.style.display = 'inline-block';
        closeBtn.onclick = function() {
          var modal = document.getElementById('attendance-upload-progress-modal');
          if (modal) modal.remove();
        };
      }
    },
    close: function() {
      if (modal && modal.parentElement) modal.remove();
    }
  };
}

async function uploadLocalAttendanceExplicitly(activeKeys, reason) {
  if (isReviewOnlySession()) return { ok: false, reason: 'REVIEW_ONLY' };

  var ui = showAttendanceUploadProgressModal();
  var progressTimer = null;
  var currentProgress = 0;

  function startSoftProgress() {
    var steps = [
      { at: 8,  text: 'تجهيز بيانات الحضور...', status: 'تجهيز' },
      { at: 22, text: 'مراجعة المفاتيح المحلية...', status: 'فحص' },
      { at: 38, text: 'تعليم البيانات كجاهزة للرفع...', status: 'تجهيز الرفع' },
      { at: 55, text: 'الاتصال بالسيرفر...', status: 'اتصال' },
      { at: 72, text: 'رفع البيانات للسحابة...', status: 'رفع' },
      { at: 88, text: 'انتظار تأكيد الحفظ...', status: 'تأكيد' }
    ];

    var idx = 0;
    progressTimer = setInterval(function() {
      if (idx < steps.length) {
        currentProgress = steps[idx].at;
        ui.setProgress(steps[idx].at, steps[idx].text, steps[idx].status);
        idx++;
      } else if (currentProgress < 92) {
        currentProgress += 1;
        ui.setProgress(currentProgress, 'انتظار تأكيد الحفظ من السيرفر...', 'تأكيد');
      }
    }, 350);
  }

  try {
    ui.setProgress(3, 'بدء عملية الرفع...', 'بدء');
    startSoftProgress();

    (activeKeys || getActiveAttendanceKeys()).forEach(function(k) {
      var val = localStorage.getItem(k);
      if (val != null) localStorage.setItem(k, val);
    });

    pendingLocalAttendanceUpload = false;

    console.warn('[AttendanceCloudGuard] EXPLICIT LOCAL UPLOAD: رفع صريح للنسخة المحلية — ' + (reason || ''));

    if (typeof window.najranSyncNow !== 'function') {
      throw new Error('najranSyncNow غير متاحة');
    }

    var result = await window.najranSyncNow();

    if (progressTimer) clearInterval(progressTimer);

    ui.setProgress(96, 'تم استلام رد السيرفر...', 'تحقق');

    if (!result || result.ok === false) {
      throw new Error((result && result.reason) || 'لم يؤكد السيرفر نجاح الرفع');
    }

    ui.success('تم رفع بيانات الحضور للسحابة بنجاح');

    setTimeout(function() {
      ui.close();
    }, 1400);

    return { ok: true, result: result };
  } catch (e) {
    if (progressTimer) clearInterval(progressTimer);
    pendingLocalAttendanceUpload = true;
    ui.error(e && e.message ? e.message : 'فشل رفع بيانات الحضور للسحابة');
    return { ok: false, error: e };
  }
}

function showPendingUploadDecisionModal(onLeave) {
  var activeKeys = getActiveAttendanceKeys();
  var localRows = localAttendanceRows(activeKeys);

  var old = document.getElementById('attendance-pending-upload-modal');
  if (old) old.remove();

  var modal = document.createElement('div');
  modal.id = 'attendance-pending-upload-modal';
  modal.className = 'no-print';
  modal.style.cssText =
    'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:999999;' +
    'display:flex;align-items:center;justify-content:center;direction:rtl;' +
    'font-family:Tajawal,Arial,sans-serif;';

  modal.innerHTML =
    '<div style="width:min(560px,94vw);background:#fff;border-radius:18px;padding:22px;box-shadow:0 20px 50px rgba(0,0,0,.28);border-top:6px solid #b45309;text-align:right;">' +
      '<h2 style="margin:0 0 12px;color:#92400e;font-size:21px;">تعديلات غير مرفوعة للسحابة</h2>' +
      '<p style="margin:0 0 12px;color:#334155;line-height:1.9;font-size:15px;">لديك تعديلات محلية على بيانات الحضور لم يتم رفعها للسحابة.</p>' +
      '<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:10px 12px;margin-bottom:14px;color:#7c2d12;font-size:14px;line-height:1.8;">' +
        'عدد صفوف الحضور المحلية: <b>' + localRows + '</b><br>' +
        'رفع هذه النسخة سيجعلها النسخة المعتمدة على السحابة للمستشفى الحالي.<br>' +
        'الخروج بدون رفع يعني أن التعديلات لن تظهر لباقي المستخدمين أو المراجع.' +
      '</div>' +
      '<div style="display:flex;gap:10px;justify-content:flex-start;flex-wrap:wrap;">' +
        '<button id="upload-local-attendance-now" style="background:#166534;color:#fff;border:none;border-radius:10px;padding:11px 16px;font-weight:800;cursor:pointer;font-family:Tajawal,Arial,sans-serif;">رفع تعديلاتي للسحابة</button>' +
        '<button id="leave-without-upload" style="background:#991b1b;color:#fff;border:none;border-radius:10px;padding:11px 16px;font-weight:800;cursor:pointer;font-family:Tajawal,Arial,sans-serif;">الخروج بدون رفع</button>' +
        '<button id="stay-on-attendance-page" style="background:#475569;color:#fff;border:none;border-radius:10px;padding:11px 16px;font-weight:800;cursor:pointer;font-family:Tajawal,Arial,sans-serif;">البقاء في الصفحة</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(modal);

  document.getElementById('upload-local-attendance-now').onclick = async function() {
    modal.remove();

    var result = await uploadLocalAttendanceExplicitly(activeKeys, 'user-confirmed-before-leave');

    if (result && result.ok && typeof onLeave === 'function') {
      setTimeout(onLeave, 1500);
    }
  };

  document.getElementById('leave-without-upload').onclick = function() {
    pendingLocalAttendanceUpload = false;
    modal.remove();
    if (typeof onLeave === 'function') onLeave();
  };

  document.getElementById('stay-on-attendance-page').onclick = function() {
    modal.remove();
  };
}
  async function refreshFromHospitalStorage(options) {
    options = options || {};
    if (cloudComparisonRunning) {
      console.warn('[AttendanceCloudGuard] تم تجاهل فحص مكرر أثناء تنفيذ الفحص الأول');
      return;
    }
    if (cloudComparisonStarted && !options.force) {
      console.warn('[AttendanceCloudGuard] تم تجاهل فحص مكرر — الفحص يعمل مرة واحدة عند فتح الصفحة فقط');
      return;
    }

    cloudComparisonStarted = true;
    cloudComparisonRunning = true;

    try {
      var activeKeys = getActiveAttendanceKeys();
      normalizeLocalAttendanceForCurrentPeriod(activeKeys);
      var localRows = localAttendanceRows(activeKeys);
      var token = await getToken();

   if (!isReviewOnlySession() && localRows > 0 && hasLocalWinsPersistent(activeKeys)) {
  clearLocalWinsPersistent(activeKeys);
  pendingLocalAttendanceUpload = true;
  console.warn('[AttendanceCloudGuard] SAFE STOP: تم تجاهل تفضيل محلي قديم ومنع رفعه تلقائياً');
  setTimeout(function(){ renderAgain('persistent-local-wins-cleared'); }, 50);
  setTimeout(function(){ renderAgain('persistent-local-wins-cleared'); }, 500);
  return;
}

      if (!token) { console.warn('[AttendanceCloudGuard] لا يوجد token'); return; }

      var res = await fetch(getHospitalStorageUrl(), {
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        credentials: 'include'
      });
      if (!res.ok) { console.warn('[AttendanceCloudGuard] فشل: ' + res.status); return; }

      var json = await res.json();
      var data = normalizeRemoteDataKeys(json && json.data ? json.data : {});
      applyExtractSettingsFromCloud(data);
      var remoteRows = remoteAttendanceRows(data, activeKeys);
      var meta = getRemoteMeta(data);

      if (remoteRows <= 0) {
        if (isReviewOnlySession()) {
          clearLocalAttendanceState('reviewOnly-no-cloud-attendance', activeKeys);
          console.warn('[AttendanceCloudGuard] REVIEW ONLY: لا توجد نسخة حضور سحابية لهذه المستشفى — تم تفريغ الحضور المحلي لمنع خلط المستشفيات — keys=' + activeKeys.join(','));
          setTimeout(function(){ renderAgain('review-empty-cloud'); }, 50);
          setTimeout(function(){ renderAgain('review-empty-cloud'); }, 500);
          return;
        }

        if (!normalEmptyCloudHandled) {
          clearLocalAttendanceState('normal-initial-no-cloud-attendance', activeKeys);
          normalEmptyCloudHandled = true;
          console.warn('[AttendanceCloudGuard] لا توجد نسخة حضور سحابية — تم تنظيف المحلي مرة واحدة والصفحة جاهزة للإدخال — keys=' + activeKeys.join(','));
          setTimeout(function(){ renderAgain('normal-empty-ready-for-input'); }, 50);
          setTimeout(function(){ renderAgain('normal-empty-ready-for-input'); }, 500);
          return;
        }

        console.warn('[AttendanceCloudGuard] السيرفر لا يحتوي حضور، وتم تجاهل التنظيف المتكرر لحماية تعديلات المستخدم — بدون رفع تلقائي — keys=' + activeKeys.join(','));
pendingLocalAttendanceUpload = localRows > 0;
setTimeout(function(){ renderAgain('normal-empty-preserve-user-edits-no-upload'); }, 50);
return;
}

  if (!isReviewOnlySession() && localWinsUntilSynced && localRows > 0 && !sameAttendanceSnapshot(data, activeKeys)) {
  localWinsUntilSynced = false;
  pendingLocalAttendanceUpload = true;
  clearLocalWinsPersistent(activeKeys);
  console.warn('[AttendanceCloudGuard] SAFE STOP: تم إلغاء localWinsUntilSynced ومنع الرفع التلقائي');
  setTimeout(function(){ renderAgain('local-wins-cancelled-no-upload'); }, 50);
  return;
}

     if (!isReviewOnlySession() && userTouchedAttendance) {
  pendingLocalAttendanceUpload = true;
  console.warn('[AttendanceCloudGuard] SAFE STOP: المستخدم بدأ التعديل محلياً — لا استبدال ولا رفع تلقائي');
  return;
}

      if (localRows > 0 && !sameAttendanceSnapshot(data, activeKeys)) {
        var replace = shouldReplaceLocalAttendance(localRows, remoteRows, meta, activeKeys);

       if (!replace) {
  localWinsUntilSynced = false;
  userTouchedAttendance = true;
  pendingLocalAttendanceUpload = true;
  clearLocalWinsPersistent(activeKeys);
  console.warn('[AttendanceCloudGuard] SAFE STOP: المستخدم رفض استبدال المحلي بالسحابة — لا رفع ولا استبدال، بانتظار قرار الخروج');
  setTimeout(function(){ renderAgain('keep-local-pending-upload-decision'); }, 50);
  setTimeout(function(){ renderAgain('keep-local-pending-upload-decision'); }, 500);
  return;
}
}

      var restored = 0, restoredRows = 0;
      activeKeys.forEach(function(k) {
        var val = data[k];
        var rows = countRows(val);
        if (val == null || rows <= 0) return;
        var normalizedVal = normalizeAttendanceValueForCurrentPeriod(val);
        localStorage.setItem(k, normalizedVal);
        restored++;
        restoredRows += rows;
      });

      if (restored > 0) {
        localWinsUntilSynced = false;
        clearLocalWinsPersistent(activeKeys);
        console.log('[AttendanceCloudGuard] استرجاع من السحابة: ' + restored + ' مفتاح / ' + restoredRows + ' صف');
        setTimeout(function(){ renderAgain(localRows > 0 ? 'cloud-replaced-local' : 'cloud-restored'); }, 50);
        setTimeout(function(){ renderAgain(localRows > 0 ? 'cloud-replaced-local' : 'cloud-restored'); }, 500);
      }
    } catch (e) {
      console.warn('[AttendanceCloudGuard] خطأ', e);
    } finally {
      cloudComparisonRunning = false;
    }
  }

  window.najranUseCloudAttendance = function () {
    try {
      var activeKeys = getActiveAttendanceKeys();
      clearLocalWinsPersistent(activeKeys);
      localWinsUntilSynced = false;
      userTouchedAttendance = false;
      cloudComparisonStarted = false;
      console.warn('[AttendanceCloudGuard] تم إلغاء تفضيل النسخة المحلية — سيتم السماح بسحب السحابة');
      setTimeout(function(){ refreshFromHospitalStorage({ force: true }); }, 100);
    } catch (e) {
      console.warn('[AttendanceCloudGuard] فشل إلغاء تفضيل المحلي', e);
    }
  };

document.addEventListener('click', function(e) {
  var link = e.target && e.target.closest ? e.target.closest('a[href]') : null;
  if (!link) return;

  var href = link.getAttribute('href') || '';
  if (!href || href.indexOf('#') === 0 || href.indexOf('javascript:') === 0) return;

  if (pendingLocalAttendanceUpload && !isReviewOnlySession()) {
    e.preventDefault();
    showPendingUploadDecisionModal(function() {
      window.location.href = href;
    });
  }
}, true);

window.addEventListener('beforeunload', function(e) {
  if (pendingLocalAttendanceUpload && !isReviewOnlySession()) {
    e.preventDefault();
    e.returnValue = '';
    return '';
  }
});

document.addEventListener('DOMContentLoaded', function(){
  setTimeout(function(){ refreshFromHospitalStorage({ reason: 'initial-page-open' }); }, 1200);
});
})();
