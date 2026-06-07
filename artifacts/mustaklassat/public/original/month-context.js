/**
 * month-context.js — نظام عزل البيانات بين الشهور
 * يحفظ snapshot كامل لكل شهر ويتيح الرجوع اليدوي دون فتح شهر جديد تلقائياً من صفحة الإعدادات.
 */
(function () {
  'use strict';

  const IS_SETTINGS_PAGE = /settings_main\.html(?:$|[?#])/.test(window.location.href);

  // صفحة الإعدادات هي مصدر فترة المستخلص. لا نسمح بإشارة فتح الفترة التالية تلقائياً هنا.
  if (IS_SETTINGS_PAGE) {
    try {
      localStorage.removeItem('najran_advance_period');
      window.__najranDisableAutoAdvancePeriod = true;
    } catch (e) {}
  }

  const MONTH_DATA_KEYS = [
    'persistentExtractData', 'extractStart', 'extractEnd', 'extractMonth', 'extractYear', 'paymentNumber',
    'attendanceData',
    'performanceData', 'performanceSignatures', 'performanceTableNames', 'performanceTotalDeduction',
    'achievementItemNames', 'dentalLaborCheckboxState', 'dentalLaborData',
    'accreditationLetterData', 'adminJobsPrintState',
    'consumablesPeriodFrom', 'consumablesPeriodTo', 'consumablesTitle', 'consumablesTableData',
    'sparePartsTotalAmount',
    'centersAttendanceData_v2', 'performanceData_v4', 'performanceDeductions',
    'healthCentersConsumables', 'mainHospitalConsumables',
    'najran_labor_attendance_done', 'najran_labor_performance_done',
    'najran_health_attendance_done',
    'grand-net-total', 'finalLaborCost',
    'distributionSettings', 'dynamicSignatures'
  ];

  const DYNAMIC_PREFIXES = ['deptCalculatedCost_', 'dept_'];

  function getCurrentMonthKey() {
    try {
      const ed = JSON.parse(localStorage.getItem('persistentExtractData') || '{}');
      const month = (ed.extractMonth || '').trim();
      const year = (ed.extractYear || new Date().getFullYear());
      if (!month) return null;
      return `${year}_${month}`;
    } catch (e) {
      return null;
    }
  }

  function getDynamicKeys() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && DYNAMIC_PREFIXES.some(p => k.startsWith(p))) keys.push(k);
    }
    return keys;
  }

  function getAllMonthDataKeys() {
    return [...MONTH_DATA_KEYS, ...getDynamicKeys()];
  }

  window.saveMonthSnapshot = function (monthKey) {
    if (!monthKey) return;
    const snapshot = {};
    for (const key of getAllMonthDataKeys()) {
      const val = localStorage.getItem(key);
      if (val !== null) snapshot[key] = val;
    }
    localStorage.setItem('monthSnapshot_' + monthKey, JSON.stringify(snapshot));
    console.log('[MonthCtx] snapshot saved:', monthKey);
  };

  window.loadMonthSnapshot = function (monthKey) {
    for (const key of getAllMonthDataKeys()) {
      localStorage.removeItem(key);
    }
    const raw = localStorage.getItem('monthSnapshot_' + monthKey);
    if (raw) {
      try {
        const snap = JSON.parse(raw);
        for (const [k, v] of Object.entries(snap)) localStorage.setItem(k, v);
        console.log('[MonthCtx] snapshot loaded:', monthKey);
        return true;
      } catch (e) {
        return false;
      }
    }
    console.log('[MonthCtx] no snapshot for', monthKey, '— starting fresh');
    return false;
  };

  window.getSavedMonths = function () {
    const months = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('monthSnapshot_')) months.push(k.replace('monthSnapshot_', ''));
    }
    return months.sort((a, b) => b.localeCompare(a));
  };

  window.switchToMonth = function (targetMonthKey) {
    const currentKey = getCurrentMonthKey();
    if (currentKey) window.saveMonthSnapshot(currentKey);
    return window.loadMonthSnapshot(targetMonthKey);
  };

  window.getCurrentMonthKey = getCurrentMonthKey;
  window.MONTH_DATA_KEYS_LIST = MONTH_DATA_KEYS;

  document.addEventListener('DOMContentLoaded', function () {
    if (IS_SETTINGS_PAGE) return;

    const currentKey = getCurrentMonthKey();
    if (!currentKey) return;

    const hasLocalData = !!localStorage.getItem('attendanceData');
    const hasSnapshot = !!localStorage.getItem('monthSnapshot_' + currentKey);

    if (!hasLocalData && hasSnapshot) {
      window.loadMonthSnapshot(currentKey);
      console.log('[MonthCtx] auto-restored snapshot for', currentKey);
    }
  });

  /**
   * Override آمن لحفظ بيانات المستخلص داخل صفحة الإعدادات فقط.
   * يحافظ على الأرشيف، لكنه يمنع فتح الفترة التالية تلقائياً.
   */
  document.addEventListener('DOMContentLoaded', function () {
    if (!IS_SETTINGS_PAGE) return;

    // احذف أي إشارة قديمة قبل أن تقرأها صفحة الإعدادات.
    try { localStorage.removeItem('najran_advance_period'); } catch (e) {}
    (function installExtractPeriodLinking() {
  if (window.__extractPeriodLinkingInstalled) return;
  window.__extractPeriodLinkingInstalled = true;

  const monthNames = [
    'يناير',
    'فبراير',
    'مارس',
    'أبريل',
    'مايو',
    'يونيو',
    'يوليو',
    'أغسطس',
    'سبتمبر',
    'أكتوبر',
    'نوفمبر',
    'ديسمبر'
  ];

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function toInputDate(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  function readEls() {
    return {
      month: document.getElementById('extract-month'),
      year: document.getElementById('extract-year'),
      start: document.getElementById('extract-start'),
      end: document.getElementById('extract-end')
    };
  }

  function saveLinkedExtractPeriod() {
    try {
      const els = readEls();
      const current = JSON.parse(localStorage.getItem('persistentExtractData') || '{}');

      if (els.month && els.month.value) current.extractMonth = els.month.value;
      if (els.year && els.year.value) current.extractYear = els.year.value;
      if (els.start && els.start.value) current.extractStart = els.start.value;
      if (els.end && els.end.value) current.extractEnd = els.end.value;

      const pay = document.getElementById('payment-number');
      if (pay && pay.value) current.paymentNumber = pay.value;

      localStorage.setItem('persistentExtractData', JSON.stringify(current));

      if (current.extractMonth) localStorage.setItem('extractMonth', current.extractMonth);
      if (current.extractYear) localStorage.setItem('extractYear', current.extractYear);
      if (current.extractStart) localStorage.setItem('extractStart', current.extractStart);
      if (current.extractEnd) localStorage.setItem('extractEnd', current.extractEnd);
      if (current.paymentNumber) localStorage.setItem('paymentNumber', current.paymentNumber);

      window.dispatchEvent(new StorageEvent('storage', {
        key: 'persistentExtractData',
        newValue: JSON.stringify(current)
      }));
    } catch (e) {
      console.warn('[extract-period-link] save failed:', e);
    }
  }

  function syncMonthYearFromStartDate() {
    const els = readEls();
    if (!els.start || !els.start.value) return;

    const d = new Date(els.start.value);
    if (isNaN(d.getTime())) return;

    if (els.month) els.month.value = monthNames[d.getMonth()];
    if (els.year) els.year.value = String(d.getFullYear());
  }

  function syncDatesFromMonthYear() {
    const els = readEls();
    if (!els.month || !els.year || !els.month.value || !els.year.value) return;

    const monthIndex = monthNames.indexOf(els.month.value);
    const year = parseInt(els.year.value, 10);

    if (monthIndex < 0 || !Number.isFinite(year)) return;

    const firstDay = new Date(year, monthIndex, 1);
    const lastDay = new Date(year, monthIndex + 1, 0);

    if (els.start) els.start.value = toInputDate(firstDay);
    if (els.end) els.end.value = toInputDate(lastDay);
  }

  function refreshDuration() {
    if (typeof calculateExtractDurationDays === 'function') {
      calculateExtractDurationDays();
    }
  }

  function onStartDateChanged() {
    syncMonthYearFromStartDate();
    refreshDuration();
    saveLinkedExtractPeriod();
  }

  function onEndDateChanged() {
    refreshDuration();
    saveLinkedExtractPeriod();
  }

  function onMonthYearChanged() {
    syncDatesFromMonthYear();
    refreshDuration();
    saveLinkedExtractPeriod();
  }

  setTimeout(function bindExtractPeriodFields() {
    const els = readEls();

    if (els.start) els.start.addEventListener('change', onStartDateChanged);
    if (els.end) els.end.addEventListener('change', onEndDateChanged);
    if (els.month) els.month.addEventListener('change', onMonthYearChanged);
    if (els.year) els.year.addEventListener('change', onMonthYearChanged);

    console.log('[MonthCtx] extract period linking installed');
  }, 50);
})();

    setTimeout(function installStableExtractSaveOverride() {
      if (window.__stableExtractSaveOverrideInstalled) return;
      window.__stableExtractSaveOverrideInstalled = true;

      window.saveExtractData = function saveExtractDataStable() {
        try {
          console.log('بدء تشغيل دالة saveExtractData — stable no-auto-advance override');

          const newMonth = document.getElementById('extract-month')?.value || '';
          const newYear  = document.getElementById('extract-year')?.value  || '';

          const prevRaw = localStorage.getItem('persistentExtractData');
          const prevData = prevRaw ? JSON.parse(prevRaw) : {};

          const prevMonth = (prevData.extractMonth || '').trim();
          const prevYear  = String(prevData.extractYear || '').trim();
          const prevKey   = prevMonth && prevYear ? `${prevYear}_${prevMonth}` : null;
          const newKey    = newMonth && newYear ? `${newYear}_${newMonth}` : null;

          const hasRealPreviousExtract =
            !!prevData.paymentNumber &&
            !!prevData.extractStart &&
            !!prevData.extractEnd &&
            !!prevMonth &&
            !!prevYear;

          if (hasRealPreviousExtract && prevKey && newKey && prevKey !== newKey) {
            const laborLocked = localStorage.getItem('najran_labor_locked_' + prevKey);
            const consumablesLocked = localStorage.getItem('najran_consumables_locked_' + prevKey);

            const laborStatus = laborLocked ? 'تم اعتماده' : 'لم يتم اعتماده';
            const consumablesStatus = consumablesLocked ? 'تم اعتماده' : 'لم يتم اعتماده';

            const proceed = confirm(
              'تنبيه: أنت تقوم بتغيير فترة المستخلص.\n\n' +
              'الفترة السابقة: ' + prevMonth + ' ' + prevYear + ' — دفعة ' + (prevData.paymentNumber || '-') + '\n' +
              'الفترة الجديدة: ' + newMonth + ' ' + newYear + '\n\n' +
              'حالة الفترة السابقة:\n' +
              '- مستخلص العمالة: ' + laborStatus + '\n' +
              '- مستخلص المستهلكات: ' + consumablesStatus + '\n\n' +
              'سيتم اعتماد الفترة الجديدة كمستخلص حالي، مع حفظ نسخة من الفترة السابقة في الأرشيف للرجوع إليها لاحقًا.\n\n' +
              'ملاحظة مهمة: عدم اعتماد المستهلكات لا يمنع إنشاء مستخلص عمالة جديد، لكنه سيظل ظاهرًا كغير معتمد حتى يتم الرجوع للفترة السابقة واعتماده.\n\n' +
              'هل تريد المتابعة؟'
            );

            if (!proceed) {
              const monthEl = document.getElementById('extract-month');
              const yearEl = document.getElementById('extract-year');
              const startEl = document.getElementById('extract-start');
              const endEl = document.getElementById('extract-end');
              const payEl = document.getElementById('payment-number');

              if (monthEl) monthEl.value = prevMonth;
              if (yearEl) yearEl.value = prevYear;
              if (startEl && prevData.extractStart) startEl.value = prevData.extractStart;
              if (endEl && prevData.extractEnd) endEl.value = prevData.extractEnd;
              if (payEl && prevData.paymentNumber) payEl.value = prevData.paymentNumber;

              if (typeof calculateExtractDurationDays === 'function') calculateExtractDurationDays();
              return;
            }

            // احفظ الفترة السابقة في الأرشيف فقط. ممنوع loadMonthSnapshot هنا.
            if (typeof window.saveMonthSnapshot === 'function') {
              window.saveMonthSnapshot(prevKey);
            }

            // زوّد رقم الدفعة فقط لو المستخدم لم يكتب رقمًا جديدًا بنفسه.
            const pnInput = document.getElementById('payment-number');
            if (pnInput && (!pnInput.value || pnInput.value === prevData.paymentNumber)) {
              const prevPn = parseInt(prevData.paymentNumber || '0', 10);
              const nextPn = String(prevPn + 1).padStart(Math.max(3, String(prevPn + 1).length), '0');
              pnInput.value = nextPn;
            }
          }

          const data = {
            extractCalendar: document.getElementById('extract-calendar')?.value || 'ميلادي',
            extractMonth: newMonth,
            extractYear: newYear,
            paymentNumber: document.getElementById('payment-number')?.value || '001',
            extractFinal: document.getElementById('extract-final')?.checked || false,
            extractStart: document.getElementById('extract-start')?.value || '',
            extractEnd: document.getElementById('extract-end')?.value || '',
            extractDuration: document.getElementById('extract-duration')?.value || 'شهر واحد'
          };

          console.log('البيانات المجمعة:', data);

          const validationError = (typeof validateExtractData === 'function') ? validateExtractData(data) : null;
          if (validationError) {
            console.error('خطأ التحقق:', validationError);
            alert(validationError);
            return;
          }

          if (typeof window.checkDuplicateExtract === 'function' && data.paymentNumber) {
            const dup = window.checkDuplicateExtract(data.paymentNumber, data.extractMonth, data.extractYear);
            if (dup) {
              const dupDate = new Date(dup.savedAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
              const proceedDup = window.confirm(
                'تحذير: يوجد مستخلص محفوظ بالفعل بنفس البيانات\n\n' +
                'رقم الدفعة: ' + data.paymentNumber + '\n' +
                'الشهر: ' + data.extractMonth + ' ' + data.extractYear + '\n' +
                'تاريخ الحفظ السابق: ' + dupDate + '\n\n' +
                'هل تريد المتابعة وحفظ نسخة جديدة؟'
              );
              if (!proceedDup) return;
            }
          }

          localStorage.setItem('persistentExtractData', JSON.stringify(data));
          if (data.extractStart) localStorage.setItem('extractStart', data.extractStart);
          if (data.extractEnd) localStorage.setItem('extractEnd', data.extractEnd);
          if (data.extractMonth) localStorage.setItem('extractMonth', data.extractMonth);
          if (data.extractYear) localStorage.setItem('extractYear', data.extractYear);
          if (data.paymentNumber) localStorage.setItem('paymentNumber', data.paymentNumber);

          // احفظ المستخلص الحالي في الأرشيف بعد الحفظ.
          const savedKey = data.extractMonth && data.extractYear ? `${data.extractYear}_${data.extractMonth}` : null;
          if (savedKey && typeof window.saveMonthSnapshot === 'function') {
            window.saveMonthSnapshot(savedKey);
          }

          console.log('البيانات المحفوظة في localStorage:', JSON.parse(localStorage.getItem('persistentExtractData')));

          window.dispatchEvent(new StorageEvent('storage', {
            key: 'persistentExtractData',
            newValue: JSON.stringify(data)
          }));

          if (typeof window.saveExtractSnapshot === 'function') {
            window.saveExtractSnapshot('save');
          }

          if (typeof saveSectionData === 'function') {
            saveSectionData('extract', data, 'extract-save-success');
          }

          if (typeof updateExtractDisplayData === 'function') updateExtractDisplayData();
          if (typeof calculateExtractDurationDays === 'function') calculateExtractDurationDays();
          if (typeof renderMonthsArchive === 'function') renderMonthsArchive();

          // مهم: لا تقرأ najran_advance_period ولا تشغل autoIncrementExtractPeriod هنا.
          try { localStorage.removeItem('najran_advance_period'); } catch (e) {}

          if (typeof window.najranSyncNow === 'function') {
            window.najranSyncNow().catch(() => {});
          }

          console.log('تم حفظ البيانات بنجاح!');
        } catch (error) {
          console.error('خطأ في حفظ بيانات المستخلص:', error);
          alert('حدث خطأ أثناء حفظ بيانات المستخلص! تحقق من وحدة التحكم لمزيد من التفاصيل.');
        }
      };

      console.log('[MonthCtx] stable saveExtractData override installed — no auto advance');
    }, 0);
  });
})();
