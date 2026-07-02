// Hospital Consumables Letterhead Storage Guard V2
// Scope: normal consumables letter settings only.
// Compresses A4 letterhead images before saving and keeps a fallback image key so later default-settings saves cannot wipe it.
(function () {
  'use strict';

  var KEY = 'hospitalConsumablesRaiseLettersSettings_v1';
  var TS_KEY = KEY + '_autosave_ts';
  var FALLBACK_IMG_KEY = 'hospitalConsumablesLetterheadDataUrl_v1';
  var FALLBACK_META_KEY = 'hospitalConsumablesLetterheadMeta_v1';
  var INPUT_IDS = ['headFile', 'hc-cons-head-file', 'hospital-cons-letterhead-file'];
  var MAX_DATA_URL_LENGTH = 850000;

  if (window.__HOSPITAL_CONSUMABLES_LETTERHEAD_STORAGE_GUARD_V2__) return;
  window.__HOSPITAL_CONSUMABLES_LETTERHEAD_STORAGE_GUARD_V2__ = true;

  function clean(v) { return String(v == null ? '' : v).replace(/[\u200e\u200f]/g, '').replace(/\s+/g, ' ').trim(); }
  function readJson(k, f) { try { var r = localStorage.getItem(k); return r ? JSON.parse(r) : f; } catch (_) { return f; } }
  function writeJson(k, v) { localStorage.setItem(k, JSON.stringify(v || {})); }
  function isTargetInput(el) { return el && el.id && INPUT_IDS.indexOf(el.id) >= 0 && el.type === 'file'; }

  function canvasToJpeg(canvas, q) {
    try { return canvas.toDataURL('image/jpeg', q); } catch (_) { return canvas.toDataURL('image/png'); }
  }

  function compressImage(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('تعذر قراءة صورة الترويسة.')); };
      reader.onload = function () {
        var original = String(reader.result || '');
        var img = new Image();
        img.onerror = function () { resolve(original); };
        img.onload = function () {
          var w = img.naturalWidth || img.width || 1;
          var h = img.naturalHeight || img.height || 1;
          var maxW = 1300;
          var maxH = 1840;
          var ratio = Math.min(1, maxW / w, maxH / h);
          var canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(w * ratio));
          canvas.height = Math.max(1, Math.round(h * ratio));
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          var q = 0.80;
          var out = canvasToJpeg(canvas, q);
          while (out.length > MAX_DATA_URL_LENGTH && q > 0.44) {
            q -= 0.08;
            out = canvasToJpeg(canvas, q);
          }
          while (out.length > MAX_DATA_URL_LENGTH && canvas.width > 820) {
            var c2 = document.createElement('canvas');
            c2.width = Math.round(canvas.width * 0.84);
            c2.height = Math.round(canvas.height * 0.84);
            var x2 = c2.getContext('2d');
            x2.fillStyle = '#ffffff';
            x2.fillRect(0, 0, c2.width, c2.height);
            x2.drawImage(canvas, 0, 0, c2.width, c2.height);
            canvas = c2;
            out = canvasToJpeg(canvas, 0.58);
          }
          resolve(out.length < original.length ? out : original);
        };
        img.src = original;
      };
      reader.readAsDataURL(file);
    });
  }

  function saveFallback(dataUrl) {
    localStorage.setItem(FALLBACK_IMG_KEY, dataUrl);
    localStorage.setItem(FALLBACK_META_KEY, JSON.stringify({
      savedAt: new Date().toISOString(),
      length: dataUrl.length,
      mode: 'full'
    }));
  }

  function saveLetterhead(dataUrl) {
    var s = readJson(KEY, {});
    if (!s || typeof s !== 'object') s = {};

    // احفظ الصورة في مفتاح مستقل أولًا حتى لا تضيع لو إعدادات الخطابات رجعت default لاحقًا.
    saveFallback(dataUrl);

    s.version = 'hospital-consumables-letterhead-guard-v2';
    s.letterheadDataUrl = dataUrl;
    s.letterheadEnabled = 'yes';
    s.letterheadMode = 'full';
    if (!clean(s.letterheadHasPlaceData)) s.letterheadHasPlaceData = 'yes';
    if (!s.contentTop) s.contentTop = 52;
    if (!s.letterheadHeight) s.letterheadHeight = 45;
    writeJson(KEY, s);
    localStorage.setItem(TS_KEY, String(Date.now()));
    return s;
  }

  function repairSettingsFromFallback() {
    var img = clean(localStorage.getItem(FALLBACK_IMG_KEY));
    if (!img) return false;
    var s = readJson(KEY, {});
    if (!s || typeof s !== 'object') s = {};
    if (clean(s.letterheadDataUrl) === img && s.letterheadMode === 'full' && s.letterheadEnabled === 'yes') return false;
    s.letterheadDataUrl = img;
    s.letterheadEnabled = 'yes';
    s.letterheadMode = 'full';
    if (!clean(s.letterheadHasPlaceData)) s.letterheadHasPlaceData = 'yes';
    if (!s.contentTop) s.contentTop = 52;
    if (!s.letterheadHeight) s.letterheadHeight = 45;
    writeJson(KEY, s);
    localStorage.setItem(TS_KEY, String(Date.now()));
    return true;
  }

  function refreshUi() {
    try {
      if (window.HospitalConsumablesRaiseLetter && typeof window.HospitalConsumablesRaiseLetter.closeDialog === 'function' && typeof window.HospitalConsumablesRaiseLetter.openDialog === 'function') {
        window.HospitalConsumablesRaiseLetter.closeDialog();
        repairSettingsFromFallback();
        window.HospitalConsumablesRaiseLetter.openDialog();
        return;
      }
    } catch (_) {}
    try { location.reload(); } catch (_) {}
  }

  function handleFileInput(e) {
    var input = e.target;
    if (!isTargetInput(input)) return;
    var file = input.files && input.files[0];
    if (!file) return;

    try { e.preventDefault(); } catch (_) {}
    try { e.stopPropagation(); } catch (_) {}
    try { e.stopImmediatePropagation(); } catch (_) {}

    compressImage(file).then(function (dataUrl) {
      try {
        saveLetterhead(dataUrl);
        alert('تم حفظ الترويسة وضبطها كصورة A4 كاملة.');
        refreshUi();
      } catch (err) {
        alert('فشل حفظ الترويسة. الصورة ما زالت كبيرة؛ صغّرها ثم ارفعها مرة أخرى.');
      }
    }).catch(function () {
      alert('تعذر تجهيز صورة الترويسة. جرّب صورة JPG أصغر.');
    });
  }

  document.addEventListener('change', handleFileInput, true);
  repairSettingsFromFallback();
  window.HospitalConsumablesLetterheadStorageGuardV2 = { saveLetterhead: saveLetterhead, compressImage: compressImage, repair: repairSettingsFromFallback };
  console.info('[Hospital Consumables Letterhead Storage Guard] installed v2 fallback image key');
})();
