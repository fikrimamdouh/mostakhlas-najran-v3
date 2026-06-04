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
      return {
        companyName: localStorage.getItem('companyName') || c.companyName || c.company || '',
        contractNumber: c.contractNumber || localStorage.getItem('contractDetails') || '',
        hospitalName: c.hospitalName || localStorage.getItem('hospitalName') || '',
        periodMonth: (localStorage.getItem('extractMonth') || c.extractMonth || '') +
          ' ' + (localStorage.getItem('extractYear') || c.extractYear || new Date().getFullYear()),
        totalAmount: parseFloat(localStorage.getItem('finalConsumablesCost') || localStorage.getItem('finalLaborCost') || e.totalCost || '0') || 0,
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

    // Check if this is a revision of an existing extract
    const revisionId = localStorage.getItem(REVISION_KEY);
    const isRevision = !!revisionId;
let token = null;
try {
  if (window.najranGetFreshToken) {
    token = await window.najranGetFreshToken();
  }
} catch (_) {}

if (!token && session.clerkToken) {
  token = session.clerkToken;
}

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

    // إذا كان مفتاح التعديل متبقياً من جلسة قديمة والمستخلص لم يعد قابلاً للتعديل،
    // نمسح المفتاح ونرسل كمستخلص جديد تلقائياً
    if (!res.ok && isRevision) {
      const errData = await res.json().catch(() => ({}));
      if (errData.error && errData.error.includes('revise')) {
        localStorage.removeItem(REVISION_KEY);
        res = await fetch('/api/submitted-extracts', {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify(payload),
        });
      } else {
        throw new Error(errData.error || 'خطأ في الاتصال بالخادم');
      }
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'خطأ في الاتصال بالخادم');
    }

    if (isRevision) localStorage.removeItem(REVISION_KEY);
    return await res.json();
  }

  // Called from track page when user clicks "تعديل وإعادة الرفع"
  window.startExtractRevision = function (extractId, extractType) {
    localStorage.setItem(REVISION_KEY, String(extractId));
    const pageMap = {
      labor: '/original/attendance.html',
      consumables: '/original/consumables.html',
      health_centers: '/original/health_centers_attendance.html',
      admin_offices: '/original/admin_offices_attendance.html',
      spare_parts: '/original/spare_parts.html',
    };
    const page = pageMap[extractType] || '/original/attendance.html';
    window.location.href = page;
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

          // ── فتح مستخلص الشهر التالي تلقائياً ────────────────────────
          try {
            const MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
            const _ed2 = JSON.parse(localStorage.getItem('persistentExtractData') || '{}');
            const _oldKey = String(_ed2.extractYear || '') + '_' + String(_ed2.extractMonth || '').trim();

            // حفظ snapshot الشهر المنتهي أولاً
            if (_oldKey !== '_' && window.saveMonthSnapshot) window.saveMonthSnapshot(_oldKey);

            const curIdx = MONTHS.indexOf((_ed2.extractMonth || '').trim());
            const curYear = parseInt(_ed2.extractYear || new Date().getFullYear(), 10);
            const newIdx  = curIdx === -1 ? 0 : (curIdx + 1) % 12;
            const newYear = (curIdx === 11) ? curYear + 1 : curYear;
            const newMonth = MONTHS[newIdx];
            const newMonthNum = newIdx + 1;
            const newStart = `${newYear}-${String(newMonthNum).padStart(2,'0')}-01`;
            const lastDay  = new Date(newYear, newMonthNum, 0).getDate();
            const newEnd   = `${newYear}-${String(newMonthNum).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
            const prevPn   = parseInt(_ed2.paymentNumber || '0', 10);
            const newPn    = String(prevPn + 1).padStart(Math.max(3, String(prevPn + 1).length), '0');

            const newEd = Object.assign({}, _ed2, {
              extractMonth: newMonth,
              extractYear: String(newYear),
              paymentNumber: newPn,
              extractStart: newStart,
              extractEnd: newEnd,
            });
            localStorage.setItem('persistentExtractData', JSON.stringify(newEd));
            localStorage.setItem('najran_new_extract_opened', JSON.stringify({
              month: newMonth, year: String(newYear), paymentNumber: newPn
            }));
          } catch(_) {}
          // ─────────────────────────────────────────────────────────────

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
