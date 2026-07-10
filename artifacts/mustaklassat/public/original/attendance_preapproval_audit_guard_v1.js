/**
 * Attendance pre-approval audit guard V1
 * Scope: standard /original/attendance.html only.
 * - Opens a professional audit gate before attendance approval.
 * - Recalculates and persists derived attendance financial fields from nationality/category.
 * - Blocks approval while critical audit errors exist.
 * - Preserves the original approval button handler and navigation flow.
 */
(function () {
  'use strict';

  var VERSION = 'ATTENDANCE_PREAPPROVAL_AUDIT_GUARD_2026_07_10_V1';
  if (window.__ATTENDANCE_PREAPPROVAL_AUDIT_GUARD__ === VERSION) return;

  function currentPageFile() {
    try {
      var fromQuery = new URLSearchParams(location.search || '').get('page') || '';
      return (fromQuery || location.pathname || '').split('/').pop().split('?')[0];
    } catch (_) {
      return (location.pathname || '').split('/').pop();
    }
  }

  var file = currentPageFile();
  if (file !== 'attendance.html') return;
  if (/admin_offices|health_centers|najran_general|najran_dental/.test(location.pathname + location.search)) return;

  window.__ATTENDANCE_PREAPPROVAL_AUDIT_GUARD__ = VERSION;

  var FINE_MATRIX = {
    '1': { saudi: 500, nonSaudi: 500 },
    '2': { saudi: 500, nonSaudi: 500 },
    '3': { saudi: 250, nonSaudi: 100 },
    '4': { saudi: 180, nonSaudi: 80 },
    '5': { saudi: 150, nonSaudi: 80 },
    '6': { saudi: 20, nonSaudi: 20 },
    '7': { saudi: 10, nonSaudi: 10 }
  };

  var approvalCallback = null;
  var bypassApprovalCapture = false;
  var originalAuditApi = null;
  var installAttempts = 0;

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[ch];
    });
  }

  function money(value) {
    return (Number(value) || 0).toLocaleString('ar-SA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function normalizeDigits(value) {
    return String(value == null ? '' : value)
      .replace(/[٠-٩]/g, function (d) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)); })
      .replace(/[۰-۹]/g, function (d) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); });
  }

  function normalizedCategory(value) {
    var v = normalizeDigits(value).trim();
    return /^[1-7]$/.test(v) ? v : '';
  }

  function normalizedNationality(value) {
    var raw = String(value == null ? '' : value)
      .replace(/[\u200e\u200f\u202a-\u202e]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    var key = raw
      .replace(/[أإآ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .toLowerCase();

    if (!key || /^(غير محدد|غير معروف|—|-|null|undefined)$/.test(key)) {
      return { valid: false, value: raw, isSaudi: false, classLabel: 'غير محددة' };
    }

    var isSaudi = /^(سعودي|سعوديه|السعودي|السعوديه|saudi|ksa|k\.s\.a|saudi arabia)$/.test(key);
    return {
      valid: true,
      value: isSaudi ? 'سعودي' : raw,
      isSaudi: isSaudi,
      classLabel: isSaudi ? 'سعودي' : 'غير سعودي'
    };
  }

  function getData() {
    try {
      if (typeof window.getAttendanceData === 'function') return window.getAttendanceData() || {};
    } catch (_) {}
    return readJson('attendanceData', {});
  }

  function saveData(data) {
    try {
      if (typeof window.saveAttendanceData === 'function') {
        window.saveAttendanceData(data);
      } else {
        localStorage.setItem('attendanceData', JSON.stringify(data));
      }
      return true;
    } catch (error) {
      console.error('[AttendanceAuditGuard] failed to save recalculated attendance data', error);
      return false;
    }
  }

  function getPeriod() {
    try {
      if (typeof window.getExtractPeriodDetails === 'function') {
        var p = window.getExtractPeriodDetails() || {};
        return {
          daysInMonth: Number(p.daysInMonth || p.daysInExtract) || 30,
          totalDaysInMonth: Number(p.totalDaysInMonth) || 30
        };
      }
    } catch (_) {}
    return { daysInMonth: 30, totalDaysInMonth: 30 };
  }

  function getDepartmentNameSafe(key) {
    try {
      if (typeof window.getDepartmentName === 'function') return window.getDepartmentName(key) || key;
    } catch (_) {}
    return key;
  }

  function almostDifferent(a, b) {
    return Math.abs((Number(a) || 0) - (Number(b) || 0)) > 0.005;
  }

  function synchronizeFinancials() {
    var data = getData();
    var period = getPeriod();
    var contract = readJson('persistentContractData', {});
    var contractType = contract.contractType || localStorage.getItem('contractType') || 'عقد أساسي';
    var ratio = Number(contract.directPurchaseRatio || localStorage.getItem('directPurchaseRatio') || 0) || 0;
    var fineMode = contract.directPurchaseAbsenceFineMode || localStorage.getItem('directPurchaseAbsenceFineMode') || 'apply';
    var skipAbsenceFine = String(contractType).trim() === 'شراء مباشر' && fineMode === 'no_apply';

    var summary = {
      employees: 0,
      changedEmployees: 0,
      changedFields: 0,
      saudi: 0,
      nonSaudi: 0,
      invalidNationality: [],
      invalidCategory: [],
      totalAbsenceDays: 0,
      totalAbsenceFine: 0,
      totalManualNationalityFine: 0,
      totalDeduction: 0,
      totalNet: 0,
      saved: false,
      timestamp: new Date().toISOString()
    };

    Object.keys(data || {}).forEach(function (deptKey) {
      var rows = Array.isArray(data[deptKey]) ? data[deptKey] : [];
      rows.forEach(function (employee, index) {
        employee = employee || {};
        summary.employees++;

        var category = normalizedCategory(employee.category);
        var nationality = normalizedNationality(employee.nationality);
        var label = getDepartmentNameSafe(deptKey) + ' — صف ' + (index + 1) + ' — ' + (employee.name || 'بدون اسم');

        if (!category) summary.invalidCategory.push(label);
        if (!nationality.valid) summary.invalidNationality.push(label);
        if (nationality.valid && nationality.isSaudi) summary.saudi++;
        if (nationality.valid && !nationality.isSaudi) summary.nonSaudi++;

        var salary = Number(employee.salary) || 0;
        var adjustedSalary = salary;
        if (contractType === 'شراء مباشر' && ratio > 0) adjustedSalary += salary * ratio / 100;

        var dailySalary = period.totalDaysInMonth > 0 ? adjustedSalary / period.totalDaysInMonth : 0;
        var extractBaseSalary = period.daysInMonth >= period.totalDaysInMonth
          ? adjustedSalary
          : dailySalary * period.daysInMonth;

        var days = Array.isArray(employee.days)
          ? employee.days.slice(0, period.daysInMonth)
          : [];
        var attendanceDays = 0;
        var absenceDays = 0;
        var deductionOnlyDays = 0;

        days.forEach(function (day) {
          if (day === 'ح' || day === 'ت') attendanceDays++;
          else if (day === 'غ') absenceDays++;
          else deductionOnlyDays++;
        });

        var deduction = (absenceDays + deductionOnlyDays) * dailySalary;
        var fineConfig = category && FINE_MATRIX[category] ? FINE_MATRIX[category] : { saudi: 0, nonSaudi: 0 };
        var absenceFine = skipAbsenceFine || !category || !nationality.valid
          ? 0
          : absenceDays * (nationality.isSaudi ? fineConfig.saudi : fineConfig.nonSaudi);
        var nationalityFine = Number(employee.nationalityFine) || 0;
        var totalFine = absenceFine + nationalityFine;
        var netSalary = extractBaseSalary - deduction - totalFine;

        var employeeChanged = false;
        function assignNumber(key, value) {
          if (almostDifferent(employee[key], value)) {
            employee[key] = value;
            summary.changedFields++;
            employeeChanged = true;
          }
        }

        if (category && String(employee.category || '').trim() !== category) {
          employee.category = category;
          summary.changedFields++;
          employeeChanged = true;
        }
        if (nationality.valid && nationality.isSaudi && employee.nationality !== 'سعودي') {
          employee.nationality = 'سعودي';
          summary.changedFields++;
          employeeChanged = true;
        }

        assignNumber('attendanceDays', attendanceDays);
        assignNumber('absenceDays', absenceDays);
        assignNumber('deduction', deduction);
        assignNumber('absencePenalty', absenceFine);
        assignNumber('totalFine', totalFine);
        assignNumber('netSalary', netSalary);

        if (employeeChanged) summary.changedEmployees++;
        summary.totalAbsenceDays += absenceDays;
        summary.totalAbsenceFine += absenceFine;
        summary.totalManualNationalityFine += nationalityFine;
        summary.totalDeduction += deduction;
        summary.totalNet += netSalary;
      });
    });

    summary.saved = saveData(data);
    if (summary.saved) {
      try {
        localStorage.setItem('attendanceAuditFinancialSyncAt', summary.timestamp);
        localStorage.setItem('attendanceAuditFinancialSyncSummary', JSON.stringify(summary));
      } catch (_) {}
      try {
        if (typeof window.renderTables === 'function') window.renderTables();
      } catch (error) {
        console.warn('[AttendanceAuditGuard] data saved but table refresh failed', error);
      }
    }

    return summary;
  }

  function issue(title, detail) {
    return { title: title, detail: detail, meta: { attendanceAuditGuard: true } };
  }

  function collectEnhanced(syncSummary) {
    var audit = { critical: [], warnings: [], info: [], stats: {}, totals: {} };
    try {
      if (originalAuditApi && typeof originalAuditApi.collect === 'function') {
        audit = originalAuditApi.collect() || audit;
      }
    } catch (error) {
      audit.critical.push(issue('تعذر تشغيل الفحص الأساسي', error && error.message ? error.message : 'خطأ غير معروف'));
    }

    audit.critical = Array.isArray(audit.critical) ? audit.critical : [];
    audit.warnings = Array.isArray(audit.warnings) ? audit.warnings : [];
    audit.info = Array.isArray(audit.info) ? audit.info : [];

    if (!syncSummary.saved) {
      audit.critical.unshift(issue('فشل حفظ المزامنة المالية', 'لم يتم حفظ إعادة احتساب الغرامات والإجماليات. لا يمكن الاعتماد قبل نجاح الحفظ.'));
    }

    syncSummary.invalidNationality.forEach(function (label) {
      audit.critical.push(issue('الجنسية غير محددة', label + ': لا يمكن تحديد غرامة الغياب سعودي/غير سعودي.'));
    });

    syncSummary.invalidCategory.forEach(function (label) {
      var exists = audit.critical.some(function (x) {
        return String(x.detail || '').indexOf(label.split(' — ').slice(-1)[0]) !== -1 && String(x.title || '').indexOf('فئة') !== -1;
      });
      if (!exists) audit.critical.push(issue('الفئة غير صالحة للغرامة', label + ': يجب أن تكون الفئة رقمًا من 1 إلى 7.'));
    });

    audit.info.unshift(issue('مزامنة الغرامات حسب الجنسية',
      'تم فحص ' + syncSummary.employees + ' موظف: ' + syncSummary.saudi + ' سعودي، ' + syncSummary.nonSaudi + ' غير سعودي. ' +
      'تم تحديث القيم المشتقة لدى ' + syncSummary.changedEmployees + ' موظف دون تغيير غرامة الجنسية اليدوية.'));

    audit.__financialSync = syncSummary;
    audit.__canApprove = audit.critical.length === 0;
    return audit;
  }

  function closeDialog() {
    var dialog = document.getElementById('njs-enhanced-audit-dialog');
    var overlay = document.getElementById('njs-enhanced-audit-overlay');
    if (dialog) dialog.remove();
    if (overlay) overlay.remove();
    approvalCallback = null;
  }

  function renderIssueSection(title, items, tone, open) {
    var list = Array.isArray(items) ? items : [];
    return '<details ' + (open ? 'open' : '') + ' class="njs-audit-section njs-tone-' + tone + '">' +
      '<summary><span>' + esc(title) + '</span><b>' + list.length + '</b></summary>' +
      '<div class="njs-audit-list">' +
      (list.length ? list.map(function (item) {
        return '<article><strong>' + esc(item.title || '') + '</strong><p>' + esc(item.detail || '') + '</p></article>';
      }).join('') : '<div class="njs-audit-empty">لا توجد عناصر.</div>') +
      '</div></details>';
  }

  function injectStyles() {
    if (document.getElementById('njs-enhanced-audit-css')) return;
    var style = document.createElement('style');
    style.id = 'njs-enhanced-audit-css';
    style.textContent = [
      '#njs-enhanced-audit-overlay{position:fixed;inset:0;background:rgba(2,6,23,.78);backdrop-filter:blur(5px);z-index:2147483645}',
      '#njs-enhanced-audit-dialog{position:fixed;inset:3vh 3vw;z-index:2147483646;background:#f8fafc;border:1px solid rgba(148,163,184,.5);border-radius:24px;box-shadow:0 30px 100px rgba(0,0,0,.55);overflow:hidden;display:flex;flex-direction:column;direction:rtl;font-family:Tajawal,Arial,sans-serif;color:#0f172a}',
      '.njs-audit-head{padding:22px 26px;background:linear-gradient(125deg,#071a35,#0b3b6f 55%,#087f8c);color:#fff;display:flex;justify-content:space-between;gap:20px;align-items:center}',
      '.njs-audit-head h2{margin:0;font-size:22px;font-weight:900}.njs-audit-head p{margin:6px 0 0;color:#dbeafe;font-weight:700}',
      '.njs-audit-close{width:42px;height:42px;border-radius:12px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.1);color:#fff;font-size:26px;cursor:pointer}',
      '.njs-audit-body{padding:18px 22px;overflow:auto;flex:1}',
      '.njs-audit-alert{border-radius:16px;padding:14px 16px;margin-bottom:14px;font-weight:800;line-height:1.8}',
      '.njs-audit-alert.warning{background:#fff7ed;border:1px solid #fdba74;color:#7c2d12}',
      '.njs-audit-alert.success{background:#ecfdf5;border:1px solid #6ee7b7;color:#065f46}',
      '.njs-audit-cards{display:grid;grid-template-columns:repeat(6,minmax(125px,1fr));gap:10px;margin-bottom:14px}',
      '.njs-audit-card{background:#fff;border:1px solid #dbe4f0;border-radius:16px;padding:13px;box-shadow:0 5px 16px rgba(15,23,42,.05)}',
      '.njs-audit-card span{display:block;color:#64748b;font-size:12px;font-weight:800;margin-bottom:6px}.njs-audit-card b{font-size:24px;color:#0f3d70}',
      '.njs-audit-sync{display:grid;grid-template-columns:1fr 1fr;gap:12px;background:#eaf7ff;border:1px solid #93c5fd;border-radius:16px;padding:14px;margin-bottom:14px}',
      '.njs-audit-sync strong{display:block;color:#0c4a6e;margin-bottom:5px}.njs-audit-sync p{margin:0;color:#334155;font-weight:700;line-height:1.7}',
      '.njs-audit-section{background:#fff;border:1px solid #e2e8f0;border-radius:15px;margin-bottom:10px;overflow:hidden}',
      '.njs-audit-section summary{cursor:pointer;padding:13px 15px;display:flex;justify-content:space-between;font-weight:900}.njs-audit-section summary b{min-width:30px;text-align:center;border-radius:999px;padding:2px 8px;background:#e2e8f0}',
      '.njs-tone-critical summary{color:#991b1b;background:#fef2f2}.njs-tone-warning summary{color:#92400e;background:#fffbeb}.njs-tone-info summary{color:#1e3a8a;background:#eff6ff}',
      '.njs-audit-list{padding:10px 12px;display:grid;gap:8px;max-height:300px;overflow:auto}.njs-audit-list article{border:1px solid #e2e8f0;border-radius:11px;padding:10px 12px;background:#f8fafc}.njs-audit-list article strong{color:#0f172a}.njs-audit-list article p{margin:5px 0 0;color:#475569;line-height:1.75;font-weight:600}.njs-audit-empty{padding:12px;color:#64748b;font-weight:700}',
      '.njs-audit-footer{padding:14px 20px;background:#fff;border-top:1px solid #dbe4f0;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}',
      '.njs-audit-review{display:flex;align-items:center;gap:9px;font-weight:800;color:#334155}.njs-audit-review input{width:19px;height:19px}',
      '.njs-audit-actions{display:flex;gap:9px;flex-wrap:wrap}.njs-audit-btn{border:0;border-radius:11px;padding:11px 16px;font-family:inherit;font-weight:900;cursor:pointer}.njs-audit-btn.secondary{background:#e2e8f0;color:#334155}.njs-audit-btn.refresh{background:#0f4c81;color:#fff}.njs-audit-btn.approve{background:linear-gradient(135deg,#15803d,#16a34a);color:#fff;min-width:230px}.njs-audit-btn:disabled{background:#94a3b8!important;color:#e2e8f0!important;cursor:not-allowed}',
      '@media(max-width:950px){#njs-enhanced-audit-dialog{inset:1vh 1vw}.njs-audit-cards{grid-template-columns:repeat(2,1fr)}.njs-audit-sync{grid-template-columns:1fr}}',
      '@media print{#njs-enhanced-audit-dialog,#njs-enhanced-audit-overlay{display:none!important}}'
    ].join('');
    document.head.appendChild(style);
  }

  function openDialog(forApproval) {
    injectStyles();
    var sync = synchronizeFinancials();
    var audit = collectEnhanced(sync);

    var oldDialog = document.getElementById('njs-enhanced-audit-dialog');
    var oldOverlay = document.getElementById('njs-enhanced-audit-overlay');
    if (oldDialog) oldDialog.remove();
    if (oldOverlay) oldOverlay.remove();

    var overlay = document.createElement('div');
    overlay.id = 'njs-enhanced-audit-overlay';
    var dialog = document.createElement('div');
    dialog.id = 'njs-enhanced-audit-dialog';

    var statusClass = audit.__canApprove ? 'success' : 'warning';
    var statusText = audit.__canApprove
      ? 'الفحص لا يحتوي على أخطاء حرجة. راجع التحذيرات ثم أكّد المراجعة قبل الاعتماد.'
      : 'الاعتماد موقوف: عالج الأخطاء الحرجة الظاهرة ثم أعد الفحص.';

    dialog.innerHTML =
      '<header class="njs-audit-head"><div><h2><i class="fas fa-shield-alt"></i> مركز فحص المستخلص قبل الطباعة / الاعتماد</h2>' +
      '<p>مراجعة البيانات، الفئات، الجنسيات، الغرامات، الإجماليات والتواقيع في خطوة واحدة.</p></div>' +
      '<button class="njs-audit-close" type="button" aria-label="إغلاق">×</button></header>' +
      '<main class="njs-audit-body">' +
      (forApproval ? '<div class="njs-audit-alert warning"><i class="fas fa-exclamation-triangle"></i> قبل اعتماد الحضور والانتقال لجداول الأداء: راجع نتيجة الفحص وتأكد من سلامة المستخلص. لن يتم الانتقال قبل اجتياز الأخطاء الحرجة.</div>' : '') +
      '<div class="njs-audit-alert ' + statusClass + '">' + esc(statusText) + '</div>' +
      '<section class="njs-audit-cards">' +
      '<div class="njs-audit-card"><span>إجمالي الموظفين</span><b>' + sync.employees + '</b></div>' +
      '<div class="njs-audit-card"><span>سعودي</span><b>' + sync.saudi + '</b></div>' +
      '<div class="njs-audit-card"><span>غير سعودي</span><b>' + sync.nonSaudi + '</b></div>' +
      '<div class="njs-audit-card"><span>تم تحديث حساباتهم</span><b>' + sync.changedEmployees + '</b></div>' +
      '<div class="njs-audit-card"><span>أيام الغياب</span><b>' + sync.totalAbsenceDays + '</b></div>' +
      '<div class="njs-audit-card"><span>غرامة الغياب</span><b>' + money(sync.totalAbsenceFine) + '</b></div>' +
      '</section>' +
      '<section class="njs-audit-sync"><div><strong><i class="fas fa-sync-alt"></i> مزامنة تلقائية للغرامات</strong><p>تمت إعادة قراءة الجنسية والفئة لكل موظف وإعادة احتساب غرامة الغياب والحسم وصافي الاستحقاق ثم حفظ القيم المشتقة.</p></div>' +
      '<div><strong><i class="fas fa-lock"></i> حدود التعديل</strong><p>لم يتم تغيير الاسم أو الوظيفة أو الراتب أو الحضور أو رقم الهوية أو غرامة الجنسية اليدوية. إجمالي غرامة الجنسية اليدوية: ' + money(sync.totalManualNationalityFine) + ' ر.س.</p></div></section>' +
      renderIssueSection('الأخطاء الحرجة', audit.critical, 'critical', true) +
      renderIssueSection('التحذيرات', audit.warnings, 'warning', audit.critical.length === 0) +
      renderIssueSection('معلومات الفحص', audit.info, 'info', false) +
      '</main>' +
      '<footer class="njs-audit-footer">' +
      (forApproval ? '<label class="njs-audit-review"><input id="njs-audit-reviewed" type="checkbox" ' + (audit.__canApprove ? '' : 'disabled') + '> راجعت نتيجة الفحص والتحذيرات وأتحمل اعتماد البيانات الحالية</label>' : '<span></span>') +
      '<div class="njs-audit-actions"><button type="button" class="njs-audit-btn secondary" data-action="close">إغلاق</button>' +
      '<button type="button" class="njs-audit-btn refresh" data-action="refresh"><i class="fas fa-sync-alt"></i> إعادة المزامنة والفحص</button>' +
      (forApproval ? '<button type="button" class="njs-audit-btn approve" data-action="approve" disabled>' +
        (audit.__canApprove ? '<i class="fas fa-check-circle"></i> اعتماد الحضور والانتقال للأداء' : 'عالج الأخطاء الحرجة قبل الاعتماد') + '</button>' : '') +
      '</div></footer>';

    document.body.appendChild(overlay);
    document.body.appendChild(dialog);
    document.body.style.overflow = 'hidden';

    function closeAndRestore() {
      document.body.style.overflow = '';
      closeDialog();
    }

    dialog.querySelector('.njs-audit-close').onclick = closeAndRestore;
    dialog.querySelector('[data-action="close"]').onclick = closeAndRestore;
    dialog.querySelector('[data-action="refresh"]').onclick = function () { openDialog(forApproval); };

    var review = dialog.querySelector('#njs-audit-reviewed');
    var approve = dialog.querySelector('[data-action="approve"]');
    if (review && approve && audit.__canApprove) {
      review.onchange = function () { approve.disabled = !review.checked; };
      approve.onclick = function () {
        if (!review.checked || !audit.__canApprove) return;
        var callback = approvalCallback;
        closeAndRestore();
        if (typeof callback === 'function') callback();
      };
    }
  }

  function openForApproval(callback) {
    approvalCallback = typeof callback === 'function' ? callback : null;
    openDialog(true);
  }

  function runOriginalApproval(button) {
    bypassApprovalCapture = true;
    var nativeConfirm = window.confirm;
    try {
      window.confirm = function (message) {
        if (String(message || '').indexOf('اعتماد بيانات الحضور والانصراف') !== -1) return true;
        return nativeConfirm.apply(window, arguments);
      };
      button.click();
    } finally {
      window.confirm = nativeConfirm;
      bypassApprovalCapture = false;
    }
  }

  function captureApproveClick(event) {
    var target = event.target && event.target.closest ? event.target.closest('#_najran_approve_btn_inner') : null;
    if (!target || bypassApprovalCapture) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openForApproval(function () { runOriginalApproval(target); });
  }

  function install() {
    installAttempts++;
    if (!window.NJSExtractAudit || typeof window.NJSExtractAudit.collect !== 'function') {
      if (installAttempts < 80) setTimeout(install, 100);
      return;
    }

    originalAuditApi = {
      collect: window.NJSExtractAudit.collect,
      applySuggestedCategories: window.NJSExtractAudit.applySuggestedCategories,
      applyContractCategoryFixes: window.NJSExtractAudit.applyContractCategoryFixes
    };

    window.NJSExtractAudit.open = function () {
      approvalCallback = null;
      openDialog(false);
    };
    window.NJSExtractAudit.openForApproval = openForApproval;
    window.NJSExtractAudit.close = function () {
      document.body.style.overflow = '';
      closeDialog();
    };
    window.NJSExtractAudit.synchronizeFinancials = synchronizeFinancials;
    window.NJSExtractAudit.__enhancedGuardVersion = VERSION;

    document.addEventListener('click', captureApproveClick, true);
    console.warn('[AttendanceAuditGuard] active:', VERSION);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(install, 0); });
  } else {
    setTimeout(install, 0);
  }
})();
