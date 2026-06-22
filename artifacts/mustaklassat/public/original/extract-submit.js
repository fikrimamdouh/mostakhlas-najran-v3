/**
 * extract-submit.js
 * مشترك بين جميع صفحات المستخلصات
 * يوفر أزرار الاعتماد والرفع للنظام
 */

(function () {
  const STEP_KEY = {
    labor_attendance: 'najran_labor_attendance_done',
    labor_performance: 'najran_labor_performance_done',
  };

  function getSession() {
    try {
      return JSON.parse(localStorage.getItem('najran_session') || '{}');
    } catch { return {}; }
  }

  function getContractData() {
    try {
      const c = JSON.parse(localStorage.getItem('persistentContractData') || '{}');
      const e = JSON.parse(localStorage.getItem('persistentExtractData') || '{}');

      const extractMonth = e.extractMonth || localStorage.getItem('extractMonth') || '';
      const extractYear = e.extractYear || localStorage.getItem('extractYear') || new Date().getFullYear();
      const paymentNumber = e.paymentNumber || localStorage.getItem('paymentNumber') || '';
      const extractStart = e.extractStart || localStorage.getItem('extractStart') || '';
      const extractEnd = e.extractEnd || localStorage.getItem('extractEnd') || '';

      return {
        companyName: localStorage.getItem('companyName') || c.companyName || c.company || '',
        contractNumber: c.contractNumber || localStorage.getItem('contractDetails') || '',
        hospitalName: c.hospitalName || localStorage.getItem('hospitalName') || '',

        extractMonth,
        extractYear: String(extractYear || ''),
        paymentNumber,
        extractStart,
        extractEnd,

        periodMonth: `${extractMonth || ''} ${extractYear || ''}`.trim(),
        totalAmount: parseFloat(
          localStorage.getItem('finalConsumablesCost') ||
          localStorage.getItem('finalLaborCost') ||
          e.totalCost ||
          '0'
        ) || 0,
      };
    } catch { return {}; }
  }

  /** لقطة كاملة من localStorage عند الإرسال — تُحفظ في DB */
  function captureStorageSnapshot() {
    const SKIP_PREFIXES = ['najran_session', '__clerk', 'clerk_', 'loglevel', 'amplitude', 'chakra', 'persist:'];
    const snapshot = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (SKIP_PREFIXES.some(p => key.startsWith(p))) continue;
        const val = localStorage.getItem(key);
        if (val !== null) {
          try { snapshot[key] = JSON.parse(val); }
          catch { snapshot[key] = val; }
        }
      }
    } catch (err) {
      console.warn('snapshot error', err);
    }
    return snapshot;
  }

  const REVISION_KEY = 'najran_revision_extract_id';

  async function submitExtract(type, extraData = {}) {
    const session = getSession();
    if (!session) {
      alert('انتهت جلستك — يرجى تسجيل الدخول مجدداً');
      window.location.href = '/sign-in';
      return null;
    }

    const contractData = getContractData();
    const extractData = captureStorageSnapshot();
    const payload = { extractType: type, ...contractData, ...extraData, extractData };
    
const submitUniqueKey = [
  'submitted_extract',
  type || '',
  contractData.companyName || '',
  contractData.hospitalName || localStorage.getItem('hospitalName') || '',
  contractData.extractYear || '',
  contractData.extractMonth || '',
  contractData.paymentNumber || contractData.extractNumber || ''
].join('__');

const submitLockKey = 'najran_submit_lock_' + submitUniqueKey;
const submitDoneKey = 'najran_submit_done_' + submitUniqueKey;

const editingSubmittedId = localStorage.getItem('najran_editing_submitted_extract_id');
const isEditingSubmittedExtract =
  localStorage.getItem('najran_editing_submitted_extract_mode') === 'true' &&
  !!editingSubmittedId;

try {
  const now = Date.now();

  const activeLock = JSON.parse(sessionStorage.getItem(submitLockKey) || 'null');
  if (activeLock && activeLock.startedAt && now - activeLock.startedAt < 120000) {
    alert('جاري رفع نفس المستخلص بالفعل. لا تضغط الرفع مرة أخرى.');
    return null;
  }

  const doneLock = JSON.parse(localStorage.getItem(submitDoneKey) || 'null');
  if (
    !localStorage.getItem('najran_revision_mode') &&
    !isEditingSubmittedExtract &&
    doneLock &&
    doneLock.submittedAt &&
    now - doneLock.submittedAt < 24 * 60 * 60 * 1000
  ) {
    alert(
      'تم منع رفع مستخلص مكرر.\n\n' +
      'نفس النوع/الشهر/السنة/رقم الدفعة تم رفعه بالفعل خلال آخر 24 ساعة.\n\n' +
      'لو تريد رفع مستخلص جديد، غيّر رقم الدفعة أو الشهر من الإعدادات.'
    );
    return null;
  }

  sessionStorage.setItem(submitLockKey, JSON.stringify({
    startedAt: now,
    type: type || '',
    month: contractData.extractMonth || '',
    year: contractData.extractYear || '',
    payment: contractData.paymentNumber || contractData.extractNumber || ''
  }));
} catch (_) {}
    // Check if this is a revision of an existing extract
   const revisionId = localStorage.getItem(REVISION_KEY)
     || localStorage.getItem('najran_editing_submitted_extract_id');
const isRevision =
  (
    localStorage.getItem('najran_revision_mode') === 'true' &&
    !!localStorage.getItem(REVISION_KEY) &&
    !!localStorage.getItem('najran_revision_snapshot')
  ) || (
    localStorage.getItem('najran_editing_submitted_extract_mode') === 'true' &&
    !!localStorage.getItem('najran_editing_submitted_extract_id')
  );

if (localStorage.getItem(REVISION_KEY) && !isRevision) {
  localStorage.removeItem(REVISION_KEY);
  localStorage.removeItem('najran_revision_mode');
  localStorage.removeItem('najran_revision_extract_type');
  localStorage.removeItem('najran_revision_started_at');
  localStorage.removeItem('najran_revision_boot_lock');
  localStorage.removeItem('najran_revision_source');
  localStorage.removeItem('najran_revision_snapshot');
  localStorage.removeItem('najran_revision_previous_total_amount');

  try { sessionStorage.removeItem('najran_revision_reloaded'); } catch (_) {}

  console.warn('[ExtractSubmit] تم تنظيف وضع تعديل ناقص: id بدون mode/snapshot');
}

if (isRevision) {
  try {
    const snapshotRaw = localStorage.getItem('najran_revision_snapshot');
    const snapshot = snapshotRaw ? JSON.parse(snapshotRaw) : {};
    const oldExtractRaw = snapshot.persistentExtractData;
    const oldExtract = typeof oldExtractRaw === 'string'
      ? JSON.parse(oldExtractRaw || '{}')
      : (oldExtractRaw || {});

    const oldMonth = String(oldExtract.extractMonth || '').trim();
    const oldYear = String(oldExtract.extractYear || '').trim();
    const oldPayment = String(oldExtract.paymentNumber || oldExtract.extractNumber || '').trim();

    const newMonth = String(contractData.extractMonth || '').trim();
    const newYear = String(contractData.extractYear || '').trim();
    const newPayment = String(contractData.paymentNumber || '').trim();

    const changed =
      (oldMonth && newMonth && oldMonth !== newMonth) ||
      (oldYear && newYear && oldYear !== newYear) ||
      (oldPayment && newPayment && oldPayment !== newPayment);

    if (changed) {
      alert(
        'تم إيقاف الرفع لحماية المستخلص.\n\n' +
        'أنت تعدّل مستخلصًا قديمًا:\n' +
        oldMonth + ' ' + oldYear + ' — دفعة ' + (oldPayment || '-') + '\n\n' +
        'لكن البيانات الحالية:\n' +
        newMonth + ' ' + newYear + ' — دفعة ' + (newPayment || '-') + '\n\n' +
        'لا يمكن حفظ شهر/دفعة مختلفة على نفس المستخلص.\n' +
        'اخرج من وضع التعديل إذا كنت تريد إنشاء مستخلص جديد.'
      );
      return null;
    }
  } catch (e) {
    alert('تعذر التحقق من بيانات المستخلص القديم. تم إيقاف الرفع للحماية.');
    return null;
  }
}
let token = session.clerkToken || null;

try {
  if (window.najranGetFreshToken) {
    const freshToken = await Promise.race([
      window.najranGetFreshToken(),
      new Promise(resolve => setTimeout(() => resolve(null), 1200))
    ]);
    if (freshToken) token = freshToken;
  }
} catch (_) {}

const headers = { 'Content-Type': 'application/json' };
if (token) headers['Authorization'] = `Bearer ${token}`;

    let res = await fetch(
      isRevision ? `/api/submitted-extracts/${revisionId}` : '/api/submitted-extracts',
      {
        method: isRevision ? 'PUT' : 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(payload),
      }
    );

    // أثناء تعديل مستخلص قديم، ممنوع التحويل التلقائي إلى POST.
    // لو فشل PUT، نوقف العملية حتى لا يتم إنشاء مستخلص جديد بالخطأ.
    if (!res.ok && isRevision) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(
        errData.error ||
        'تعذر إعادة رفع المستخلص المعدل على نفس السجل. لم يتم إنشاء مستخلص جديد.'
      );
    }

     if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'خطأ في الاتصال بالخادم');
    }

    const result = await res.json();
    try {
  localStorage.setItem(submitDoneKey, JSON.stringify({
    submittedAt: Date.now(),
    resultId: result?.id || result?.extract?.id || result?.extractId || '',
    type: type || '',
    month: contractData.extractMonth || '',
    year: contractData.extractYear || '',
    payment: contractData.paymentNumber || contractData.extractNumber || ''
  }));

  sessionStorage.removeItem(submitLockKey);

  console.warn('[ExtractSubmit] تم تسجيل قفل منع تكرار رفع نفس المستخلص');
} catch (_) {}
try {
  sessionStorage.removeItem('najran_new_extract_clear_attendance_once');
  localStorage.removeItem('najran_new_extract_clear_attendance_once');
  console.warn('[ExtractSubmit] تم تنظيف علامة مسح الحضور بعد رفع المستخلص');
} catch (_) {}
    
    try {
      const submittedId =
        result?.id ||
        result?.extract?.id ||
        result?.extractId ||
        revisionId ||
        '';

      if (submittedId) {
        localStorage.setItem('najran_last_submitted_extract_id', String(submittedId));
        localStorage.setItem('najran_last_submitted_extract_type', String(type || ''));
        localStorage.setItem('najran_last_submitted_period', String(contractData.periodMonth || ''));
        localStorage.setItem('najran_last_submitted_payment', String(contractData.paymentNumber || ''));
        localStorage.setItem('najran_last_submitted_at', new Date().toISOString());
      }
    } catch (_) {}

    if (isRevision) {
  localStorage.removeItem(REVISION_KEY);
  localStorage.removeItem('najran_revision_mode');
  localStorage.removeItem('najran_revision_extract_type');
  localStorage.removeItem('najran_revision_started_at');
  localStorage.removeItem('najran_revision_boot_lock');
  localStorage.removeItem('najran_revision_source');
  localStorage.removeItem('najran_revision_snapshot');
  localStorage.removeItem('najran_revision_previous_total_amount');
  localStorage.removeItem('najran_editing_submitted_extract_id');
  localStorage.removeItem('najran_editing_submitted_extract_mode');
  localStorage.removeItem('najran_editing_submitted_extract_started_at');
      sessionStorage.removeItem('najran_revision_reloaded');
}

    return result;
  }

 // Legacy direct revision opener disabled.
// Revision must start only from track.tsx because it loads old extractData,
// sets boot lock, clears current operational data, then writes the old snapshot.
window.startExtractRevision = function () {
  alert('فتح تعديل المستخلص يجب أن يتم من صفحة متابعة المستخلصات حتى يتم تحميل بيانات المستخلص القديمة بشكل آمن.');
  window.location.href = '/extracts/track';
};
  // ── إخفاء الزر عند الطباعة ─────────────────────────────────────────────────
  (function injectPrintHideStyle() {
    const style = document.createElement('style');
    style.textContent = '@media print { #_najran_approve_btn { display: none !important; } }';
    document.head.appendChild(style);
  })();

  // ── مشترك: إنشاء الزر المثبّت ──────────────────────────────────────────────
  function createApproveBtn({ label, color = '#fff', gradient = 'linear-gradient(135deg,#1565c0,#0ea5e9)', onClick }) {
    const existing = document.getElementById('_najran_approve_btn');
    if (existing) existing.remove();

    const wrap = document.createElement('div');
    wrap.id = '_najran_approve_btn';
    wrap.style.cssText = 'position:fixed;bottom:28px;left:28px;z-index:99999;direction:rtl;';

    const btn = document.createElement('button');
    btn.id = '_najran_approve_btn_inner';
    btn.style.cssText = `
      background:${gradient};
      color:${color};
      border:none;border-radius:18px;
      padding:15px 30px;
      font-size:1.05rem;font-weight:700;
      cursor:pointer;
      box-shadow:0 8px 28px rgba(30,60,114,0.35);
      display:flex;align-items:center;gap:10px;
      font-family:inherit;
      transition:opacity .2s;
    `;
    btn.innerHTML = `<span>${label}</span><span style="font-size:1.2rem">←</span>`;
    btn.addEventListener('click', onClick);
    btn.addEventListener('mouseover', () => btn.style.opacity = '0.9');
    btn.addEventListener('mouseout', () => btn.style.opacity = '1');

    wrap.appendChild(btn);
    document.body.appendChild(wrap);
    return btn;
  }

  function setLoading(text) {
    const btn = document.getElementById('_najran_approve_btn_inner');
    if (btn) { btn.innerHTML = `<span>${text}</span>`; btn.disabled = true; btn.style.opacity = '0.7'; }
  }

  function resetBtn(label) {
    const btn = document.getElementById('_najran_approve_btn_inner');
    if (btn) { btn.innerHTML = `<span>${label}</span><span style="font-size:1.2rem">←</span>`; btn.disabled = false; btn.style.opacity = '1'; }
  }

  // ════════════════════════════════════════════════════════════
  // صفحة الحضور والانصراف  →  الانتقال لجداول الأداء
  // ════════════════════════════════════════════════════════════
  window.initAttendanceApproveBtn = function () {
    createApproveBtn({
      label: 'اعتماد الحضور والانصراف',
      onClick: () => {
        if (!confirm('هل تريد اعتماد بيانات الحضور والانصراف والانتقال لجداول الأداء؟')) return;
        localStorage.setItem(STEP_KEY.labor_attendance, '1');
        window.location.href = '/original/performance.html';
      },
    });
  };

  // ════════════════════════════════════════════════════════════
  // صفحة جداول الأداء  →  الانتقال لشهادة الإنجاز
  // ════════════════════════════════════════════════════════════
  window.initPerformanceApproveBtn = function () {
    createApproveBtn({
      label: 'اعتماد جداول الأداء',
    onClick: () => {
  if (!confirm('هل تريد اعتماد جداول الأداء والانتقال لشهادة الإنجاز؟')) return;

  try {
    const performanceTables = [
      'cleaning',
      'electricity',
      'agriculture',
      'civil',
      'mechanics',
      'laundry',
      'security',
      'new_section_8'
    ];

    performanceTables.forEach(tableId => {
      if (document.getElementById(tableId + '-table')) {
        if (typeof updateTotal === 'function') {
          updateTotal(tableId);
        }

        if (typeof saveTableData === 'function') {
          saveTableData(tableId, true);
        }
      }
    });

    if (typeof updateCertificateFromPerformance === 'function') {
      updateCertificateFromPerformance();
    }

    const deductedEl = document.getElementById('total-deducted-amount');
    if (deductedEl) {
      localStorage.setItem(
        'performanceTotalDeduction',
        String(deductedEl.textContent || '0').replace(/[^0-9.\-]/g, '')
      );
    }

    const totalDueEl = document.getElementById('total-due');
    if (totalDueEl) {
      localStorage.setItem(
        'performanceTotalDue',
        String(totalDueEl.textContent || '0').replace(/[^0-9.\-]/g, '')
      );
    }

    localStorage.setItem('performanceSavedAtBeforeAchievement', new Date().toISOString());
  } catch (e) {
    console.warn('[PerformanceApprove] تعذر حفظ بعض بيانات الأداء قبل الانتقال', e);
  }

  localStorage.setItem(STEP_KEY.labor_performance, '1');
  window.location.href = '/original/achievement.html';
},
    });
  };

  // ════════════════════════════════════════════════════════════
  // صفحة شهادة الإنجاز  →  رفع مستخلص العمالة كاملاً
  // ════════════════════════════════════════════════════════════
  window.initAchievementSubmitBtn = function () {
    createApproveBtn({
      label: 'رفع مستخلص العمالة للاعتماد',
      onClick: async () => {
        if (!confirm('هل تريد رفع مستخلص العمالة كاملاً للاعتماد؟\n\nسيشمل المستخلص:\n✓ الحضور والانصراف\n✓ جداول الأداء\n✓ شهادة الإنجاز')) return;
        setLoading('جاري الرفع...');
        try {
          await submitExtract('labor');
          localStorage.removeItem(STEP_KEY.labor_attendance);
          localStorage.removeItem(STEP_KEY.labor_performance);
          // ── تسجيل قفل العمالة للشهر الحالي ──────────────────────────
          try {
            const _ed = JSON.parse(localStorage.getItem('persistentExtractData') || '{}');
            const _mk = String(_ed.extractYear || '') + '_' + String(_ed.extractMonth || '').trim();
            if (_mk !== '_') localStorage.setItem('najran_labor_locked_' + _mk, '1');
          } catch(_) {}
          // ─────────────────────────────────────────────────────────────
          window.location.href = '/extracts/track';
        } catch (e) {
          alert('حدث خطأ: ' + e.message);
          resetBtn('رفع مستخلص العمالة للاعتماد');
        }
      },
    });
  };

  // ════════════════════════════════════════════════════════════
  // صفحة المستهلكات  →  رفع مستخلص المستهلكات
  // ════════════════════════════════════════════════════════════
  window.initConsumablesSubmitBtn = function () {
    createApproveBtn({
      label: 'رفع مستخلص المستهلكات للاعتماد',
      onClick: async () => {
        if (!confirm('هل تريد رفع مستخلص المستهلكات للاعتماد؟')) return;
        setLoading('جاري الرفع...');
        try {
          await submitExtract('consumables');
          // ── تسجيل قفل المستهلكات للشهر الحالي ───────────────────────
          try {
            const _ed = JSON.parse(localStorage.getItem('persistentExtractData') || '{}');
            const _mk = String(_ed.extractYear || '') + '_' + String(_ed.extractMonth || '').trim();
            if (_mk !== '_') localStorage.setItem('najran_consumables_locked_' + _mk, '1');
          } catch(_) {}
          // ─────────────────────────────────────────────────────────────

         // ── حفظ أرشيف الشهر الحالي فقط بدون فتح شهر جديد تلقائياً ─────────────
try {
  const _ed2 = JSON.parse(localStorage.getItem('persistentExtractData') || '{}');
  const _oldKey = String(_ed2.extractYear || '') + '_' + String(_ed2.extractMonth || '').trim();

  if (_oldKey !== '_' && window.saveMonthSnapshot) {
    window.saveMonthSnapshot(_oldKey);
  }
} catch(_) {}
// ─────────────────────────────────────────────────────────────

// بعد رفع المستهلكات نرجع لتتبع المستخلصات فقط.
// المستخدم هو من يفتح الفترة الجديدة من الإعدادات.
          window.location.href = '/original/settings_main.html';
        } catch (e) {
          alert('حدث خطأ: ' + e.message);
          resetBtn('رفع مستخلص المستهلكات للاعتماد');
        }
      },
    });
  };

  // ════════════════════════════════════════════════════════════
  // مراكز صحية — الحضور والانصراف  →  الانتقال للمستهلكات
  // ════════════════════════════════════════════════════════════
  window.initHealthAttendanceApproveBtn = function () {
    createApproveBtn({
      label: 'اعتماد عمالة المراكز — التالي: المستهلكات',
      onClick: () => {
        if (!confirm('هل تريد اعتماد بيانات عمالة المراكز والانتقال لمستهلكاتها؟')) return;
        localStorage.setItem('najran_health_attendance_done', '1');
        window.location.href = '/original/health_centers_consumables.html';
      },
    });
  };

  // ════════════════════════════════════════════════════════════
  // مراكز صحية — المستهلكات  →  رفع مستخلص المراكز الصحية
  // ════════════════════════════════════════════════════════════
  window.initHealthConsumablesSubmitBtn = function () {
    createApproveBtn({
      label: 'رفع مستخلص المراكز الصحية للاعتماد',
      onClick: async () => {
        if (!confirm('هل تريد رفع مستخلص المراكز الصحية كاملاً للاعتماد؟\n\nسيشمل المستخلص:\n✓ عمالة المراكز\n✓ مستهلكات المراكز')) return;
        setLoading('جاري الرفع...');
        try {
          await submitExtract('health_centers');
          localStorage.removeItem('najran_health_attendance_done');
          window.location.href = '/extracts/track';
        } catch (e) {
          alert('حدث خطأ: ' + e.message);
          resetBtn('رفع مستخلص المراكز الصحية للاعتماد');
        }
      },
    });
  };

  // ════════════════════════════════════════════════════════════
  // صفحة قطع الغيار  →  رفع مستخلص قطع الغيار
  // ════════════════════════════════════════════════════════════
  window.initSparePartsSubmitBtn = function () {
    createApproveBtn({
      label: 'رفع مستخلص قطع الغيار للاعتماد',
      onClick: async () => {
        if (!confirm('هل تريد رفع مستخلص قطع الغيار للاعتماد؟')) return;
        setLoading('جاري الرفع...');
        try {
          const total = parseFloat(localStorage.getItem('sparePartsTotalAmount') || '0') || 0;
          await submitExtract('spare_parts', { totalAmount: total });
          window.location.href = '/original/approval.html';
        } catch (e) {
          alert('حدث خطأ: ' + e.message);
          resetBtn('رفع مستخلص قطع الغيار للاعتماد');
        }
      },
    });
  };

  // ════════════════════════════════════════════════════════════
  // مكاتب إدارية — الحضور والانصراف  →  الانتقال للمستهلكات
  // ════════════════════════════════════════════════════════════
  window.initAdminOfficesAttendanceApproveBtn = function () {
    createApproveBtn({
      label: 'اعتماد عمالة المكاتب — التالي: المستهلكات',
      onClick: () => {
        if (!confirm('هل تريد اعتماد بيانات عمالة المكاتب الإدارية والانتقال لمستهلكاتها؟')) return;
        localStorage.setItem('najran_admin_offices_attendance_done', '1');
        window.location.href = '/original/admin_offices_consumables.html';
      },
    });
  };

  // ════════════════════════════════════════════════════════════
  // مكاتب إدارية — المستهلكات  →  رفع مستخلص المكاتب الإدارية
  // ════════════════════════════════════════════════════════════
  window.initAdminOfficesConsumablesSubmitBtn = function () {
    createApproveBtn({
      label: 'رفع مستخلص المكاتب الإدارية للاعتماد',
      onClick: async () => {
        if (!confirm('هل تريد رفع مستخلص المكاتب الإدارية كاملاً للاعتماد؟\n\nسيشمل المستخلص:\n✓ عمالة المكاتب الإدارية\n✓ مستهلكات المكاتب الإدارية')) return;
        setLoading('جاري الرفع...');
        try {
          await submitExtract('admin_offices');
          localStorage.removeItem('najran_admin_offices_attendance_done');
          window.location.href = '/extracts/track';
        } catch (e) {
          alert('حدث خطأ: ' + e.message);
          resetBtn('رفع مستخلص المكاتب الإدارية للاعتماد');
        }
      },
    });
  };

  // تشغيل تلقائي بحسب الصفحة الحالية
  document.addEventListener('DOMContentLoaded', function () {
    const path = window.location.pathname;
    // ── صفحات نجران الخاصة (تُعالَج قبل الشروط العامة) ─────────────
    if (path.includes('najran_general_attendance')) {
      createApproveBtn({ label: 'اعتماد الحضور والانصراف', onClick: () => {
        if (!confirm('هل تريد اعتماد بيانات الحضور والانصراف والانتقال لجداول الأداء؟')) return;
        localStorage.setItem(STEP_KEY.labor_attendance, '1');
        window.location.href = '/original/najran_general_performance.html';
      }});
    } else if (path.includes('najran_dental_attendance')) {
      createApproveBtn({ label: 'اعتماد الحضور والانصراف', onClick: () => {
        if (!confirm('هل تريد اعتماد بيانات الحضور والانصراف والانتقال لجداول الأداء؟')) return;
        localStorage.setItem(STEP_KEY.labor_attendance, '1');
        window.location.href = '/original/najran_dental_performance.html';
      }});
    } else if (path.includes('najran_general_performance')) {
      createApproveBtn({ label: 'اعتماد جداول الأداء', onClick: () => {
        if (!confirm('هل تريد اعتماد جداول الأداء والانتقال لشهادة الإنجاز؟')) return;
        localStorage.setItem(STEP_KEY.labor_performance, '1');
        window.location.href = '/original/najran_general_achievement.html';
      }});
    } else if (path.includes('najran_dental_performance')) {
      createApproveBtn({ label: 'اعتماد جداول الأداء', onClick: () => {
        if (!confirm('هل تريد اعتماد جداول الأداء والانتقال لشهادة الإنجاز؟')) return;
        localStorage.setItem(STEP_KEY.labor_performance, '1');
        window.location.href = '/original/najran_general_achievement.html';
      }});
    // ── الصفحات العامة ────────────────────────────────────────────────
    } else if (path.endsWith('attendance.html') && !path.includes('health_centers') && !path.includes('admin_offices')) {
      window.initAttendanceApproveBtn();
    } else if (path.endsWith('performance.html')) {
      window.initPerformanceApproveBtn();
    } else if (path.endsWith('achievement.html')) {
      window.initAchievementSubmitBtn();
    } else if (path.endsWith('consumables.html') && !path.includes('health_centers') && !path.includes('admin_offices')) {
      window.initConsumablesSubmitBtn();
    } else if (path.endsWith('health_centers_attendance.html')) {
      window.initHealthAttendanceApproveBtn();
    } else if (path.endsWith('health_centers_consumables.html')) {
      window.initHealthConsumablesSubmitBtn();
    } else if (path.endsWith('admin_offices_attendance.html')) {
      window.initAdminOfficesAttendanceApproveBtn();
    } else if (path.endsWith('admin_offices_consumables.html')) {
      window.initAdminOfficesConsumablesSubmitBtn();
    } else if (path.endsWith('spare_parts.html')) {
      window.initSparePartsSubmitBtn();
    }
  });
})();
