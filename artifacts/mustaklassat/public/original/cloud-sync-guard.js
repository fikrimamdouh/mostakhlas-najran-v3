// Cloud sync guard
// إصلاح خفيف قبل cloud-sync.js لتقليل التهنيج ومنع خطأ الرفع المتكرر.
// لا يغير مفاتيح التخزين، ولا المعادلات، ولا بيانات المستخلصات.
(function () {
  try {
    if (window.__najranCloudSyncGuard) return;
    window.__najranCloudSyncGuard = true;

    // cloud-sync.js يعمل في strict mode وبه سطر قديم يستخدم mustSaveHospital بدون تعريف.
    // تعريفه هنا يمنع ReferenceError بدون تغيير منطق الحفظ.
    window.mustSaveHospital = false;

    var nativeSetInterval = window.setInterval.bind(window);
    window.setInterval = function (callback, delay) {
      try {
        var txt = String(callback || '');
        if (Number(delay) === 5000 && txt.indexOf('syncNow') !== -1) {
          delay = 60000;
        }
      } catch (_) {}
      var args = Array.prototype.slice.call(arguments, 2);
      return nativeSetInterval.apply(window, [callback, delay].concat(args));
    };
  } catch (_) {}
})();
