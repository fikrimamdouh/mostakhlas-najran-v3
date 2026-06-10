/* admin-users-page-polish.js
 * تم تعطيل هذا الملف لأنه استخدم selectors عامة أثرت على السايدبار.
 * تحسين صفحة المستخدمين سيتم لاحقًا من داخل مكوّن React نفسه أو بملف scoped بالكامل.
 */
(function () {
  'use strict';
  try {
    var st = document.getElementById('najran-admin-users-polish-style');
    if (st) st.remove();
    document.body && document.body.classList.remove('najran-admin-polished');
  } catch (_) {}
})();
