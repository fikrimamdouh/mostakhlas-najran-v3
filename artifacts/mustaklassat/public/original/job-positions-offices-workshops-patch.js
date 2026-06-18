// Merge offices/admin offices department into workshops in job positions upload.
// Also preserves employee name and iqama fields when templates are loaded/downloaded.
(function () {
  'use strict';

  function normalize(value) {
    return String(value || '')
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه');
  }

  function isOfficesOrWorkshops(value) {
    const t = normalize(value);
    return t.includes('ورش') ||
      t.includes('مكاتب') ||
      t.includes('المكاتب') ||
      t.includes('مكتب') ||
      t.includes('المكتب') ||
      t.includes('صيانة واصلاح السيارات') ||
      t.includes('صيانه واصلاح السيارات') ||
      t.includes('صيانة وإصلاح السيارات');
  }

  function pick(row, keys, fallback) {
    row = row || {};
    for (let i = 0; i < keys.length; i++) {
      const v = row[keys[i]];
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    return fallback;
  }

  function getHospitalName() {
    try {
      const s = JSON.parse(localStorage.getItem('najran_session') || '{}');
      if (s && s.hospital) return String(s.hospital).trim();
    } catch (_) {}
    const el = document.querySelector('.hospitalName');
    return el ? String(el.textContent || '').trim() : '';
  }

  function getDeptLabels() {
    return (window.JobPositionsDB && JobPositionsDB.DEPT_LABELS) || {
      cleaning: 'النظافة',
      electricity: 'الكهرباء',
      agriculture: 'الزراعة',
      civil_works: 'الأعمال المدنية',
      mechanical: 'الميكانيكا',
      laundry: 'المغسلة',
      patient_services: 'الأمن والسلامة',
      admin_saudi: 'الوظائف الإدارية السعوديين',
      workshops: 'المكاتب والورش'
    };
  }

  function buildDays(row, count) {
    const out = Array.isArray(row && row.days) ? row.days.slice(0, count) : [];
    while (out.length < count) out.push('ح');
    return out;
  }

  function toEmployee(row, count) {
    return {
      name: String(pick(row, ['name', 'employeeName', 'اسم الموظف', 'اسم شاغل الوظيفة'], '') || '').trim(),
      jobTitle: String(pick(row, ['jobTitle', 'position', 'مسمى الوظيفة'], '') || '').trim(),
      category: String(pick(row, ['category', 'الفئة'], '1') || '1').trim(),
      salary: parseFloat(pick(row, ['salary', 'monthlyCost', 'monthlySalary', 'التكلفة الشهرية'], 0)) || 0,
      nationality: String(pick(row, ['nationality', 'الجنسية'], 'غير سعودي') || 'غير سعودي').trim(),
      nationalityFine: parseFloat(pick(row, ['nationalityFine', 'غرامة جنسية'], 0)) || 0,
      iqamaId: String(pick(row, ['iqamaId', 'idNumber', 'رقم الهوية / الإقامة', 'رقم الهوية', 'رقم الإقامة', 'رقم الاقامة'], '') || '').trim(),
      days: buildDays(row, count)
    };
  }

  function patchDeptMapping() {
    if (!window.JobPositionsDB || window.JobPositionsDB.__officesWorkshopsMerged) return;

    if (JobPositionsDB.DEPT_LABELS) JobPositionsDB.DEPT_LABELS.workshops = 'المكاتب والورش';

    if (JobPositionsDB.DEPT_MAP) {
      [
        'ورش', 'الورش', 'قسم الورش',
        'المكاتب', 'مكاتب', 'قسم المكاتب', 'المكاتب الإدارية', 'المكاتب الادارية',
        'مكتب', 'المكتب', 'قسم المكتب',
        'صيانة وإصلاح السيارات', 'صيانة واصلاح السيارات', 'صيانة السيارات'
      ].forEach(name => { JobPositionsDB.DEPT_MAP[name] = 'workshops'; });
    }

    const oldMapDept = JobPositionsDB.mapDept;
    JobPositionsDB.mapDept = function mergedOfficesWorkshopsMapDept(value) {
      if (isOfficesOrWorkshops(value)) return 'workshops';
      return typeof oldMapDept === 'function' ? oldMapDept(value) : null;
    };

    JobPositionsDB.__officesWorkshopsMerged = true;
  }

  function patchTemplateButtons() {
    if (!window.JobPositionsDB || window.__fullJobPositionsTemplatePatched) return;
    window.__fullJobPositionsTemplatePatched = true;

    window.loadJobPositionsFromTemplate = async function () {
      const hospitalName = getHospitalName();
      if (!hospitalName || hospitalName === '—' || hospitalName === 'غير محدد') {
        alert('يرجى تعيين اسم المستشفى في الإعدادات أولاً');
        return;
      }

      const record = await JobPositionsDB.load(hospitalName);
      if (!record || !record.rows || !record.rows.length) {
        alert('لا توجد مناصب محفوظة لـ "' + hospitalName + '".');
        return;
      }

      if (record.hospitalName && record.hospitalName !== hospitalName) {
        if (!confirm('⚠️ المناصب المحفوظة تخص "' + record.hospitalName + '" وأنت حالياً في "' + hospitalName + '". هل تريد تحميلها؟')) return;
      }

      const rows = record.rows;
      const labels = getDeptLabels();
      const byDept = {};
      rows.forEach(r => { if (r && r.dept) (byDept[r.dept] || (byDept[r.dept] = [])).push(r); });
      const filled = rows.filter(r => { const e = toEmployee(r, 30); return e.name || e.iqamaId; }).length;
      let summary = Object.keys(byDept).map(k => '• ' + (labels[k] || k) + ': ' + byDept[k].length + ' صف').join('\n');
      if (filled) summary += '\n\nصفوف بها أسماء/هويات محفوظة: ' + filled;

      const current = typeof getAttendanceData === 'function' ? getAttendanceData() : {};
      const hasCurrent = Object.values(current || {}).some(a => Array.isArray(a) && a.length > 0);
      if (hasCurrent) {
        if (!confirm('وُجدت ' + rows.length + ' صف لـ "' + hospitalName + '":\n\n' + summary + '\n\nموافق = استبدال كامل.\nإلغاء = إلغاء العملية.')) return;
      } else {
        if (!confirm('وُجدت ' + rows.length + ' صف لـ "' + hospitalName + '":\n\n' + summary + '\n\nهل تريد تحميلها؟')) return;
      }

      let daysCount = 30;
      try { if (typeof getExtractPeriodDetails === 'function') daysCount = getExtractPeriodDetails().daysInMonth || 30; } catch (_) {}

      const allData = {};
      let fullRows = 0;
      rows.forEach(r => {
        if (!r || !r.dept) return;
        if (!allData[r.dept]) allData[r.dept] = [];
        const emp = toEmployee(r, daysCount);
        if (emp.name || emp.iqamaId) fullRows++;
        allData[r.dept].push(emp);
      });

      saveAttendanceData(allData);
      renderTables();
      alert('✅ تم تحميل ' + rows.length + ' صف.\nصفوف بأسماء/هويات محفوظة: ' + fullRows);
    };

    window.downloadPositionsTemplate = function () {
      if (typeof XLSX === 'undefined') { alert('مكتبة Excel غير محملة، يرجى تحديث الصفحة'); return; }
      const hospitalName = getHospitalName();
      if (!hospitalName || hospitalName === '—' || hospitalName === 'غير محدد') {
        alert('يرجى تعيين اسم المستشفى في الإعدادات أولاً.');
        return;
      }

      JobPositionsDB.load(hospitalName).then(function (rec) {
        if (!rec || !rec.rows || !rec.rows.length) {
          alert('لا توجد مناصب محفوظة لـ "' + hospitalName + '".');
          return;
        }
        const labels = getDeptLabels();
        const headers = ['اسم الموظف', 'رقم الهوية / الإقامة', 'القسم', 'مسمى الوظيفة', 'التكلفة الشهرية', 'الفئة', 'الجنسية', 'غرامة جنسية'];
        const body = rec.rows.map(function (r) {
          const e = toEmployee(r, 30);
          return [e.name, e.iqamaId, labels[r.dept] || r.dept || '', e.jobTitle, e.salary, e.category, e.nationality, e.nationalityFine];
        });
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers].concat(body));
        ws['!cols'] = [{ wch: 28 }, { wch: 22 }, { wch: 24 }, { wch: 34 }, { wch: 18 }, { wch: 8 }, { wch: 15 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(wb, ws, hospitalName.substring(0, 31));
        XLSX.writeFile(wb, 'تامبلت-' + hospitalName + '.xlsx');
        try { if (typeof closeDialog === 'function') closeDialog('upload-excel-dialog'); } catch (_) {}
      }).catch(function (err) {
        alert('خطأ: ' + (err && err.message ? err.message : err));
      });
    };

    console.warn('[JobPositions] تم تفعيل تحميل المناصب بالبيانات الكاملة');
  }

  function patch() {
    patchDeptMapping();
    patchTemplateButtons();
  }

  patch();
  document.addEventListener('DOMContentLoaded', function () { setTimeout(patch, 0); });
  setTimeout(patch, 800);
})();
