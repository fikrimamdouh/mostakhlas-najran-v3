/**
 * extract-snapshot.js
 * أداة أرشفة مستخلصات العمالة — تحفظ سجلاً لكل عملية حفظ أو طباعة
 */
(function () {
  var ARCHIVE_KEY   = 'extractArchive';
  var MAX_SNAPSHOTS = 100;

  var MONTH_NAMES = [
    'يناير','فبراير','مارس','أبريل','مايو','يونيو',
    'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'
  ];

  /* ───── قراءة الأرشيف ───── */
  window.getExtractArchive = function () {
    try { return JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]'); }
    catch (e) { return []; }
  };

  /* ───── حفظ snapshot ───── */
  window.saveExtractSnapshot = function (source) {
    source = source || 'manual';
    try {
      var extractData  = JSON.parse(localStorage.getItem('persistentExtractData')  || '{}');
      var contractData = JSON.parse(localStorage.getItem('persistentContractData') || '{}');

      /* ملخص أقسام الحضور */
      var totalEmployees = 0;
      var totalNetAmount = 0;
      var departments    = {};
      try {
        var att = JSON.parse(localStorage.getItem('attendanceData') || '{}');
        Object.keys(att).forEach(function (dept) {
          var emps = att[dept] || [];
          var deptNet = emps.reduce(function (s, emp) {
            var sal  = parseFloat(emp.salary)   || 0;
            var ded  = parseFloat(emp.totalDeduction || emp.deduction) || 0;
            var fine = parseFloat(emp.totalFine) || 0;
            return s + Math.max(0, sal - ded - fine);
          }, 0);
          departments[dept] = { count: emps.length, total: deptNet };
          totalEmployees += emps.length;
          totalNetAmount += deptNet;
        });
      } catch (e) {}

      var snap = {
        id:             String(Date.now()),
        savedAt:        new Date().toISOString(),
        source:         source,
        paymentNumber:  extractData.paymentNumber  || '',
        extractMonth:   extractData.extractMonth   || '',
        extractYear:    String(extractData.extractYear  || ''),
        extractStart:   extractData.extractStart   || '',
        extractEnd:     extractData.extractEnd     || '',
        hospitalName:   contractData.hospitalName  || '',
        companyName:    contractData.companyName   || '',
        contractDetails: contractData.contractDetails || '',
        engineeringManager:    contractData.engineeringManager    || '',
        generalServicesManager: contractData.generalServicesManager || '',
        hospitalManager:       contractData.hospitalManager        || '',
        followUpManager:       contractData.followUpManager        || '',
        totalEmployees:  totalEmployees,
        totalNetAmount:  totalNetAmount,
        departments:     departments
      };

      var archive = window.getExtractArchive();
      archive.unshift(snap);
      if (archive.length > MAX_SNAPSHOTS) archive.splice(MAX_SNAPSHOTS);
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archive));
      return snap;
    } catch (e) {
      console.warn('extract-snapshot: save error', e);
      return null;
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

  /* ───── تقديم تلقائي للفترة التالية ───── */
  window.autoIncrementExtractPeriod = function () {
    try {
      var data = JSON.parse(localStorage.getItem('persistentExtractData') || '{}');
      if (!data.extractStart) return null;

      /* تقديم تاريخ البداية شهرًا */
      var start = new Date(data.extractStart);
      start.setDate(1);
      start.setMonth(start.getMonth() + 1);

      /* آخر يوم في الشهر الجديد */
      var end = new Date(start.getFullYear(), start.getMonth() + 1, 0);

      /* زيادة رقم الدفعة */
      var pn = String(data.paymentNumber || '1').trim();
      var num = parseInt(pn, 10);
      var newPn = isNaN(num) ? pn : String(num + 1).padStart(pn.length, '0');

      var newData = Object.assign({}, data, {
        extractMonth: MONTH_NAMES[start.getMonth()],
        extractYear:  start.getFullYear(),
        paymentNumber: newPn,
        extractStart: start.toISOString().split('T')[0],
        extractEnd:   end.toISOString().split('T')[0]
      });

      localStorage.setItem('persistentExtractData', JSON.stringify(newData));
      return newData;
    } catch (e) {
      console.warn('extract-snapshot: autoIncrement error', e);
      return null;
    }
  };
})();
