// Special absence without deduction/fine for selected contracts only.
// حالة مستقلة: تظهر كـ "غ•" ولا تدخل في غياب/حسم/غرامة الغياب.
(function () {
  'use strict';

  var CODE = 'غ•';
  var PATCH_FLAG = '__NAJRAN_SPECIAL_ABSENCE_NO_DEDUCTION__';

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function text(value) {
    return String(value || '')
      .replace(/[إأآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getHospitalContextText() {
    var session = readJson('najran_session', {});
    var contract = readJson('persistentContractData', {});
    return text([
      session.hospital,
      session.activeHospital,
      session.companyName,
      contract.hospitalName,
      localStorage.getItem('hospitalName'),
      document.querySelector('.hospitalName') && document.querySelector('.hospitalName').textContent,
      document.title,
      location.pathname
    ].filter(Boolean).join(' '));
  }

  function isAllowedHere() {
    var path = location.pathname + location.search;
    if (/admin_offices_attendance\.html(?:$|[?#])/.test(path)) return true;

    var h = getHospitalContextText();
    return h.indexOf('الولاده') !== -1 ||
      h.indexOf('الاولاد') !== -1 ||
      h.indexOf('غرب نجران') !== -1 ||
      h.indexOf('المكاتب الاداريه') !== -1 ||
      h.indexOf('المكاتب الإداريه') !== -1;
  }

  function installStatusCode() {
    var meta = {
      name: 'غياب بدون حسم',
      color: '#f8d7da',
      isAbsence: false,
      isSpecial: true,
      noDeduction: true,
      noFine: true,
      class: 'special-absence-no-deduction'
    };

    try {
      if (typeof STATUS_CODES !== 'undefined') STATUS_CODES[CODE] = meta;
    } catch (_) {}

    window.STATUS_CODES = window.STATUS_CODES || {};
    window.STATUS_CODES[CODE] = meta;
  }

  function injectCss() {
    if (document.getElementById('special-absence-no-deduction-css')) return;
    var st = document.createElement('style');
    st.id = 'special-absence-no-deduction-css';
    st.textContent = [
      '.special-absence-no-deduction,',
      'select.special-absence-no-deduction {',
      '  background:#f8d7da!important;',
      '  color:#991b1b!important;',
      '  font-weight:900!important;',
      '}',
      'option[value="' + CODE + '"] {',
      '  background:#f8d7da!important;',
      '  color:#991b1b!important;',
      '  font-weight:900!important;',
      '}'
    ].join('\n');
    document.head.appendChild(st);
  }

  function optionLabel(code, name) {
    return code === CODE ? 'غ•' : code;
  }

  function patchNormalAttendanceSelect() {
    if (typeof window.createAttendanceSelect !== 'function') return;
    if (window.createAttendanceSelect.__specialAbsencePatched) return;

    var original = window.createAttendanceSelect;

    window.createAttendanceSelect = function patchedCreateAttendanceSelect(currentStatus, departmentKey, employeeIndex, dayIndex) {
      if (!isAllowedHere()) return original.apply(this, arguments);

      var statuses = [
        { code: 'ح', name: 'حاضر' },
        { code: 'غ', name: 'غائب' },
        { code: 'ج', name: 'إجازة' },
        { code: 'ش', name: 'شاغرة' },
        { code: 'ت', name: 'تحت الإجراء' },
        { code: 'ب', name: 'بداية العقد' },
        { code: 'ن', name: 'نهاية العقد' },
        { code: CODE, name: 'غياب بدون حسم' }
      ];

      var select = document.createElement('select');
      select.style.width = '100%';
      select.style.border = 'none';
      select.style.padding = '1px 0';
      select.style.fontSize = '13px';
      select.style.fontWeight = '700';
      select.style.textAlign = 'center';
      select.style.color = '#111111';
      select.style.backgroundColor = 'transparent';
      select.title = currentStatus === CODE ? 'غياب بدون حسم' : '';

      statuses.forEach(function (status) {
        var option = document.createElement('option');
        option.value = status.code;
        option.textContent = optionLabel(status.code, status.name);
        option.title = status.name;
        option.selected = status.code === currentStatus;
        select.appendChild(option);
      });

      select.onchange = function () {
        if (typeof updateEmployeeAttendance === 'function') {
          updateEmployeeAttendance(departmentKey, employeeIndex, dayIndex, this.value);
        }
      };

      return select;
    };

    window.createAttendanceSelect.__specialAbsencePatched = true;
  }

  function patchAdminOfficeAttendanceSelect() {
    if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;
    if (typeof window.createAttendanceSelect !== 'function') return;
    if (window.createAttendanceSelect.__adminSpecialAbsencePatched) return;

    window.createAttendanceSelect = function patchedAdminCreateAttendanceSelect(currentStatus, centerKey, empIndex, dayIndex) {
      installStatusCode();
      var options = '';
      for (var code in STATUS_CODES) {
        if (code === 'default') continue;
        options += '<option value="' + code + '" ' + (code === currentStatus ? 'selected' : '') + ' title="' + (STATUS_CODES[code].name || code) + '">' + optionLabel(code, STATUS_CODES[code].name) + '</option>';
      }
      var statusInfo = STATUS_CODES[currentStatus] || STATUS_CODES.default;
      var cls = statusInfo.class || '';
      return '<select class="attendance-select ' + cls + '" title="' + (statusInfo.name || '') + '" onchange="updateEmployeeAttendance(\'' + centerKey + '\', ' + empIndex + ', ' + dayIndex + ', this.value)">' + options + '</select>';
    };

    window.createAttendanceSelect.__adminSpecialAbsencePatched = true;
  }

  function patchNormalUpdateAttendance() {
    if (/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) {
        return;
    }

    if (typeof window.updateEmployeeAttendance !== 'function') return;
    if (window.updateEmployeeAttendance.__specialAbsencePatched) return;

    window.updateEmployeeAttendance = function patchedUpdateEmployeeAttendance(departmentKey, employeeIndex, dayIndex, newStatus) {
      try {
        var data = getAttendanceData();
        var employee = data[departmentKey] && data[departmentKey][employeeIndex];
        if (!employee) return;

        var oldStatus = Array.isArray(employee.days) ? employee.days[dayIndex] : null;
        var employeeName = employee.name || 'غير محدد';
        var departmentName = typeof getDepartmentName === 'function' ? getDepartmentName(departmentKey) : departmentKey;

        var period = getExtractPeriodDetails();
        var daysInMonth = period.daysInMonth || period.daysInExtract || 30;
        if (!Array.isArray(employee.days) || employee.days.length < daysInMonth) {
          var existing = Array.isArray(employee.days) ? employee.days : [];
          employee.days = Array(daysInMonth).fill('ح').map(function (v, i) { return existing[i] || v; });
        }

        employee.days[dayIndex] = newStatus;

        var attendanceDays = 0;
        var absenceDays = 0;
        var deductionOnlyDays = 0;

        employee.days.forEach(function (day) {
          if (day === CODE) return;
          if (day === 'ح' || day === 'ت') attendanceDays++;
          else if (day === 'غ') absenceDays++;
          else deductionOnlyDays++;
        });

        var salary = parseFloat(employee.salary) || 0;
        var p2 = getExtractPeriodDetails();
        var totalDaysInMonth = p2.totalDaysInMonth || 30;
        var dailySalary = salary / totalDaysInMonth;
        var extractBaseSalary = dailySalary * daysInMonth;
        var deduction = (absenceDays + deductionOnlyDays) * dailySalary;
        var fineConfig = ABSENCE_FINES_BY_CATEGORY[employee.category || '1'] || ABSENCE_FINES_BY_CATEGORY[1] || ABSENCE_FINES_BY_CATEGORY.default;
        var isSaudi = (employee.nationality || 'سعودي').trim() === 'سعودي';
        var fine = absenceDays * (isSaudi ? fineConfig.saudi : fineConfig.non_saudi);
        var nationalityFine = parseFloat(employee.nationalityFine) || 0;
        var totalFine = fine + nationalityFine;
        var netSalary = extractBaseSalary - deduction - totalFine;

        employee.absenceDays = absenceDays;
        employee.attendanceDays = attendanceDays;
        employee.deduction = deduction;
        employee.absencePenalty = fine;
        employee.totalFine = totalFine;
        employee.netSalary = netSalary;

        saveAttendanceData(data);

        if (typeof window.najranAuditLog === 'function' && oldStatus !== newStatus) {
          window.najranAuditLog('تعديل حضور وانصراف', 'تم تعديل حضور الموظف ' + employeeName + ' في قسم ' + departmentName + ' - اليوم رقم ' + (dayIndex + 1) + ' من "' + (oldStatus || 'غير محدد') + '" إلى "' + newStatus + '"', {
            entityType: 'attendance',
            entityId: departmentKey + ':' + employeeIndex + ':' + dayIndex,
            before: oldStatus,
            after: newStatus
          });
        }

if (typeof renderTables === 'function') {
          renderTables();
        }      } catch (error) {
        console.error('خطأ في تحديث الحضور:', error);
      }
    };

    window.updateEmployeeAttendance.__specialAbsencePatched = true;
  }

  function patchNormalRenderTablesBySource() {
    if (typeof window.renderTables !== 'function') return;
    if (window.renderTables.__specialAbsencePatched) return;

    try {
      var src = String(window.renderTables);
      var replaced = src.replace(
        /if \(day === 'ح' \|\| day === 'ت'\) \{\s*attendanceDays\+\+;\s*\} else if \(day === 'غ'\) \{\s*absenceDays\+\+;\s*\} else \{\s*deductionOnlyDays\+\+;\s*\}/,
        "if (day === '" + CODE + "') {\n                        // غياب بدون حسم: لا حضور، لا غياب، لا حسم، لا غرامة\n                    } else if (day === 'ح' || day === 'ت') {\n                        attendanceDays++;\n                    } else if (day === 'غ') {\n                        absenceDays++;\n                    } else {\n                        deductionOnlyDays++;\n                    }"
      );

      if (replaced !== src) {
        window.renderTables = (0, eval)('(' + replaced + ')');
        window.renderTables.__specialAbsencePatched = true;
      }
    } catch (e) {
      console.warn('[SpecialAbsence] تعذر تعديل renderTables تلقائيًا', e);
    }
  }
function install() {
    if (!isAllowedHere()) return;

    installStatusCode();
    injectCss();

    var isAdminOffices = /admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search);
    var hasCreateAttendanceSelect = typeof window.createAttendanceSelect === 'function';
    var hasUpdateEmployeeAttendance = typeof window.updateEmployeeAttendance === 'function';
    var hasRenderTables = typeof window.renderTables === 'function';

    if (!hasCreateAttendanceSelect && !hasUpdateEmployeeAttendance && !hasRenderTables) {
      return;
    }

    if (isAdminOffices) {
      patchAdminOfficeAttendanceSelect();
    } else {
      patchNormalAttendanceSelect();
      patchNormalUpdateAttendance();
      patchNormalRenderTablesBySource();
    }

    window[PATCH_FLAG] = { installed: true, code: CODE, at: new Date().toISOString() };
    console.warn('[SpecialAbsence] حالة غياب بدون حسم مفعلة لهذا العقد — code=' + CODE);

    try {
      if (typeof renderTables === 'function') renderTables();
      if (typeof populateAttendanceTableBody === 'function') {
        var active = document.querySelector('.tab-link.active[data-center-key]');
        if (active && active.dataset.centerKey) populateAttendanceTableBody(active.dataset.centerKey);
      }
    } catch (_) {}
  }
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(install, 300);
    setTimeout(install, 1000);
    setTimeout(install, 2500);
  });

  setTimeout(install, 700);
})();
