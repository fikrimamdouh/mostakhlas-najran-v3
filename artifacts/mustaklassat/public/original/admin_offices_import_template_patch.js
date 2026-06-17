// Admin Offices import patch
// Supports the template generated from job-positions-upload.html:
// اسم الموظف | رقم الهوية / الإقامة | القسم | مسمى الوظيفة | التكلفة الشهرية | الفئة | الجنسية
(function () {
  'use strict';

  function norm(value) {
    return String(value || '')
      .replace(/\u200f|\u200e/g, '')
      .replace(/[إأآا]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function findHeaderRow(rows) {
    const max = Math.min(15, rows.length);
    for (let i = 0; i < max; i++) {
      const normalized = rows[i].map(norm);
      const hasJob = normalized.some(c => c.includes('مسمي الوظيفه') || c.includes('الوظيفه') || c.includes('job'));
      const hasName = normalized.some(c => c.includes('اسم الموظف') || c.includes('اسم شاغل الوظيفه') || c.includes('name'));
      const hasId = normalized.some(c => c.includes('الهويه') || c.includes('الاقامه') || c.includes('رقم الهويه') || c.includes('رقم الاقامه'));
      if (hasJob && (hasName || hasId)) return i;
    }
    return -1;
  }

  function findIndex(headers, predicates) {
    for (let i = 0; i < headers.length; i++) {
      const h = norm(headers[i]);
      if (predicates.some(fn => fn(h))) return i;
    }
    return -1;
  }

  function parseSalary(value) {
    if (typeof value === 'number') return value || 0;
    const cleaned = String(value || '').replace(/,/g, '').replace(/[ ريال﷼]/g, '').trim();
    return parseFloat(cleaned) || 0;
  }

  function parseEmployeeFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = event => {
        try {
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

          if (!rows.length) throw new Error('الملف فارغ أو لا يمكن قراءته.');

          const headerRowIndex = findHeaderRow(rows);
          if (headerRowIndex === -1) {
            throw new Error('لم يتم العثور على صف العناوين. التامبلت المقبول: اسم الموظف، رقم الهوية / الإقامة، القسم، مسمى الوظيفة، التكلفة الشهرية، الفئة، الجنسية.');
          }

          const headers = rows[headerRowIndex];
          const nameIndex = findIndex(headers, [h => h.includes('اسم الموظف'), h => h.includes('اسم شاغل الوظيفه'), h => h === 'name']);
          const iqamaIndex = findIndex(headers, [h => h.includes('رقم الهويه'), h => h.includes('رقم الاقامه'), h => h.includes('الهويه'), h => h.includes('الاقامه'), h => h.includes('id')]);
          const deptIndex = findIndex(headers, [h => h.includes('القسم'), h => h.includes('قسم'), h => h.includes('dept')]);
          const jobIndex = findIndex(headers, [h => h.includes('مسمي الوظيفه'), h => h === 'الوظيفه', h => h.includes('job')]);
          const salaryIndex = findIndex(headers, [h => h.includes('التكلفه الشهريه'), h => h.includes('تكلفه'), h => h.includes('راتب'), h => h.includes('salary')]);
          const categoryIndex = findIndex(headers, [h => h.includes('الفئه'), h => h.includes('فئه'), h => h.includes('cat')]);
          const nationalityIndex = findIndex(headers, [h => h.includes('الجنسيه'), h => h.includes('جنسيه'), h => h.includes('nat')]);
          const nationalityFineIndex = findIndex(headers, [h => h.includes('غرامه جنسيه')]);

          if (jobIndex === -1) throw new Error('عمود مسمى الوظيفة غير موجود.');
          if (nameIndex === -1) throw new Error('عمود اسم الموظف غير موجود.');

          const daysInExtract = typeof getExtractPeriodDetails === 'function'
            ? getExtractPeriodDetails().daysInExtract
            : 31;

          const ignoredNames = new Set(['اسم الموظف', 'اسم شاغل الوظيفة', 'مندوب المقاول', 'غير محدد', 'مدير المركز', '']);
          const employees = [];

          for (let i = headerRowIndex + 1; i < rows.length; i++) {
            const row = rows[i];
            const name = String(row[nameIndex] || '').trim();
            const jobTitle = String(row[jobIndex] || '').trim();
            const iqamaId = iqamaIndex !== -1 ? String(row[iqamaIndex] || '').trim() : '';
            const dept = deptIndex !== -1 ? String(row[deptIndex] || '').trim() : '';

            if (!name && !jobTitle && !iqamaId) continue;
            if (ignoredNames.has(name)) continue;
            if (norm(jobTitle).includes('مسمي الوظيفه')) continue;

            employees.push({
              jobTitle: jobTitle || 'غير محدد',
              name: name || 'شاغر',
              salary: salaryIndex !== -1 ? parseSalary(row[salaryIndex]) : 0,
              category: categoryIndex !== -1 ? String(row[categoryIndex] || '7').trim() : '7',
              nationality: nationalityIndex !== -1 ? String(row[nationalityIndex] || '').trim() || 'غير سعودي' : 'غير سعودي',
              iqamaId,
              dept,
              nationalityFine: nationalityFineIndex !== -1 ? parseSalary(row[nationalityFineIndex]) : 0,
              days: Array(daysInExtract).fill('ح')
            });
          }

          resolve(employees);
        } catch (error) {
          reject(error instanceof Error ? error : new Error('حدث خطأ أثناء تحليل الملف.'));
        }
      };
      reader.onerror = () => reject(new Error('فشلت قراءة الملف.'));
      reader.readAsArrayBuffer(file);
    });
  }

  window.processSingleExcelFile = parseEmployeeFile;
})();