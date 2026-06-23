// ===================================================================
// Admin Offices Raise Letters Extra Documents — SAFE RESTORE
// Scope: admin_offices_attendance.html only
// تم تعطيل منطق طباعة المستخلص كامل مؤقتاً لأنه أوقف الصفحة.
// لا ينشئ ملفات ولا يغيّر دوال الصفحة الأساسية.
// ===================================================================
(function () {
  'use strict';

  if (!/admin_offices_attendance\.html|original-viewer\?page=admin_offices_attendance\.html/.test(location.pathname + location.search)) return;

  function safeLog() {
    console.info('[Admin Offices Extra Docs] safe restore loaded — full extract print disabled');
  }

  function ensureSafeNotice() {
    try {
      const overlay = document.getElementById('raise-letters-overlay');
      if (!overlay) return;
      const dialog = overlay.querySelector('.settings-dialog');
      if (!dialog || dialog.querySelector('#admin-extra-docs-safe-section')) return;

      const section = document.createElement('div');
      section.id = 'admin-extra-docs-safe-section';
      section.className = 'section-box';
      section.style.cssText = 'border:2px solid #d4af37;background:#fffbeb;';
      section.innerHTML = '<h3>خطابات وبيانات إضافية</h3><div style="font-weight:900;text-align:center;color:#92400e;line-height:1.9">تم إيقاف زر طباعة المستخلص كامل مؤقتًا لحماية الصفحة. باقي أزرار خطابات الرفع الأساسية تعمل من نفس الصفحة.</div>';

      const firstDataBox = Array.from(dialog.querySelectorAll('.section-box')).find(function (box) {
        return !box.id && ((box.querySelector('h3') || {}).textContent || '').includes('بيانات المستخلص');
      });
      if (firstDataBox) dialog.insertBefore(section, firstDataBox);
      else dialog.appendChild(section);
    } catch (err) {
      console.warn('[Admin Offices Extra Docs] safe notice skipped:', err);
    }
  }

  if (!window.AdminOfficesExtraDocs) window.AdminOfficesExtraDocs = {};
  window.AdminOfficesExtraDocs.generateFullExtractPrint = function () {
    alert('تم إيقاف طباعة المستخلص كامل مؤقتًا حتى يتم تركيبها داخل الدوال الموجودة بدون تعطيل الصفحة.');
  };

  if (!window.__adminExtraDocsSafeObserver) {
    window.__adminExtraDocsSafeObserver = new MutationObserver(ensureSafeNotice);
    window.__adminExtraDocsSafeObserver.observe(document.body, { childList: true, subtree: true });
  }

  ensureSafeNotice();
  setTimeout(ensureSafeNotice, 700);
  setTimeout(ensureSafeNotice, 1800);
  setTimeout(ensureSafeNotice, 3200);
  safeLog();
})();