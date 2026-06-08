/* settings-user-backup-guard.js
 * حماية النسخ المحلي داخل صفحة الإعدادات.
 * الهدف: نسخة المستخدم المحلية ترجع لنفس المستخدم فقط، ولا تستبدل جلسة مستخدم آخر.
 */
(function () {
  'use strict';
  if (!/\/original\/settings_main\.html(?:$|[?#])/.test(location.pathname + location.search)) return;

  function session() {
    try { return JSON.parse(localStorage.getItem('najran_session') || '{}') || {}; } catch (_) { return {}; }
  }

  function owner() {
    var s = session();
    return {
      userId: s.userId || null,
      email: s.email || null,
      name: s.name || null,
      hospital: s.hospital || localStorage.getItem('hospitalName') || null,
      createdAt: new Date().toISOString()
    };
  }

  function sameOwner(o) {
    var s = session();
    if (!o || typeof o !== 'object') return false;
    if (o.userId != null && s.userId != null && String(o.userId) !== String(s.userId)) return false;
    if (o.email && s.email && String(o.email).toLowerCase() !== String(s.email).toLowerCase()) return false;
    return true;
  }

  function protectedKey(k) {
    return k === 'najran_session' ||
      k === '__clerk_db_jwt' ||
      k.indexOf('__clerk') === 0 ||
      k.indexOf('clerk_') === 0 ||
      k === 'loglevel' ||
      k.indexOf('amplitude') === 0;
  }

  function keepBeforeRestore() {
    var keep = {};
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (!k) continue;
      if (protectedKey(k) || k.indexOf('contract_foundation_v2_') === 0 || k === 'contract_foundation_data') {
        keep[k] = Storage.prototype.getItem.call(localStorage, k);
      }
    }
    return keep;
  }

  function restoreKeep(keep) {
    Object.keys(keep || {}).forEach(function (k) {
      if (keep[k] != null) Storage.prototype.setItem.call(localStorage, k, keep[k]);
    });
  }

  function patchCollect() {
    if (typeof window.collectDataForBackup !== 'function' || window.collectDataForBackup.__ownerPatched) return;
    var old = window.collectDataForBackup;
    window.collectDataForBackup = function () {
      var result = old.apply(this, arguments);
      if (result && result.data) {
        result.data.owner = owner();
        result.data.scope = 'local-user-browser';
      }
      return result;
    };
    window.collectDataForBackup.__ownerPatched = true;
  }

  function patchRestore() {
    if (typeof window.confirmRestore !== 'function' || window.confirmRestore.__ownerPatched) return;
    window.confirmRestore = function () {
      var fileInput = document.getElementById('restore-file-input');
      if (!fileInput || !fileInput.files || !fileInput.files.length) {
        alert('يرجى اختيار ملف نسخة احتياطية أولاً.');
        return;
      }
      var file = fileInput.files[0];
      var reader = new FileReader();
      reader.onload = function (event) {
        try {
          var wrapper = JSON.parse(event.target.result);
          if (!wrapper || !wrapper.data || !wrapper.timestamp) throw new Error('صيغة ملف النسخة الاحتياطية غير صحيحة أو قديمة.');
          if (wrapper.owner && !sameOwner(wrapper.owner)) {
            alert('تم إيقاف الاستعادة: هذه النسخة تخص مستخدمًا آخر.');
            return;
          }
          if (!wrapper.owner) {
            var okOld = confirm('هذا ملف نسخة قديم لا يحتوي على هوية المستخدم. سيتم استعادته على مسؤوليتك لنفس المتصفح فقط. هل تريد المتابعة؟');
            if (!okOld) return;
          }
          var ok = confirm('سيتم استعادة نسخة محلية لهذا المستخدم فقط، مع الحفاظ على جلسة الدخول الحالية. هل تريد المتابعة؟');
          if (!ok) return;

          var keep = keepBeforeRestore();
          var data = wrapper.data || {};
          localStorage.clear();
          restoreKeep(keep);

          Object.keys(data).forEach(function (k) {
            if (k === 'owner' || k === 'scope') return;
            if (protectedKey(k)) return;
            var v = data[k];
            if (v !== null && v !== undefined) localStorage.setItem(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
          });
          restoreKeep(keep);

          if (typeof window.addLogEntry === 'function') window.addLogEntry('استعادة نسخة محلية', file.name, 'نجاح');
          alert('تمت استعادة بيانات هذا المستخدم محليًا. سيتم إعادة تحميل الصفحة الآن.');
          setTimeout(function () { location.reload(); }, 1000);
        } catch (e) {
          alert('فشل استعادة الملف: ' + (e && e.message ? e.message : e));
          if (typeof window.addLogEntry === 'function') window.addLogEntry('استعادة نسخة محلية', file.name, 'فشل');
        }
      };
      reader.readAsText(file);
    };
    window.confirmRestore.__ownerPatched = true;
  }

  function run() { patchCollect(); patchRestore(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
  setInterval(run, 700);
})();