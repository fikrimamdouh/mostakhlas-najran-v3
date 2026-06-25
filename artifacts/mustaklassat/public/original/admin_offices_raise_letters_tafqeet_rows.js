// ===================================================================
// Admin Offices Final Print Polish — Passive Mode
// Scope: admin_offices_attendance.html only
//
// تم تعطيل لفّ printSelected / preparePrint هنا حتى لا يركب طبقة فوق
// admin_offices_print_all_complete_patch.js.
// المصدر المعتمد الآن للطباعة:
// - الزر الرئيسي: اختيار المكاتب + حضور/تقييم/إنجاز/خطابات.
// - الزر الداخلي للحضور: حضور المكتب فقط + تواقيع الحضور.
// ===================================================================
(function () {
  'use strict';
  if (!/admin_offices_attendance\.html(?:$|[?#])/.test(location.pathname + location.search)) return;
  window.__ADMIN_OFFICES_FINAL_PRINT_POLISH_PASSIVE__ = true;
  console.info('[Admin Offices Final Print Polish] passive mode — no printSelected/preparePrint wrapping');
})();