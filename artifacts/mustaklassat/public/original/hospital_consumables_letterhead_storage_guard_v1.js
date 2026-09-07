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
    s.letterheadDeleted = false;
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
    var s = readJson(KEY, {});
    if (!s || typeof s !== 'object') s = {};
    if (s.letterheadDeleted === true) {
      // الترويسة محذوفة قصدًا — لا استرجاع، ونظّف بقايا الfallback إن وجدت.
      try { localStorage.removeItem(FALLBACK_IMG_KEY); localStorage.removeItem(FALLBACK_META_KEY); } catch (_) {}
      return false;
    }
    var img = clean(localStorage.getItem(FALLBACK_IMG_KEY));
    if (!img) return false;
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
        void window.NajranDialogs.alert('تم حفظ الترويسة وضبطها كصورة A4 كاملة.');
        refreshUi();
      } catch (err) {
        void window.NajranDialogs.alert('فشل حفظ الترويسة. الصورة ما زالت كبيرة؛ صغّرها ثم ارفعها مرة أخرى.');
      }
    }).catch(function () {
      void window.NajranDialogs.alert('تعذر تجهيز صورة الترويسة. جرّب صورة JPG أصغر.');
    });
  }

  document.addEventListener('change', handleFileInput, true);
  repairSettingsFromFallback();
  window.HospitalConsumablesLetterheadStorageGuardV2 = { saveLetterhead: saveLetterhead, compressImage: compressImage, repair: repairSettingsFromFallback };
  console.info('[Hospital Consumables Letterhead Storage Guard] installed v2 fallback image key');
})();

// Consumables Negative Amount Guard V1
// Scope: normal hospital consumables page only.
// Keeps negative final totals negative in tafqeet and in all consumables letter printouts.
// Does not change the underlying VAT, penalty, deduction, or total calculation formulas.
(function () {
  'use strict';

  if (window.__HOSPITAL_CONSUMABLES_NEGATIVE_AMOUNT_GUARD_V1__) return;
  window.__HOSPITAL_CONSUMABLES_NEGATIVE_AMOUNT_GUARD_V1__ = true;

  var LETTER_KEY = 'hospitalConsumablesRaiseLettersSettings_v1';
  var NET_KEYS = [
    'finalConsumablesCost',
    'consumables_current_net',
    'hospital_consumables_current_net',
    'consumablesNet',
    'netConsumablesTotal'
  ];

  function digits(v) {
    var ar = '٠١٢٣٤٥٦٧٨٩';
    var fa = '۰۱۲۳۴۵۶۷۸۹';
    return String(v == null ? '' : v)
      .replace(/[٠-٩]/g, function (d) { return ar.indexOf(d); })
      .replace(/[۰-۹]/g, function (d) { return fa.indexOf(d); });
  }

  function parseAmount(v) {
    var raw = digits(v).replace(/[\u200e\u200f]/g, '').trim();
    if (!raw) return 0;
    var negative = /-/.test(raw) || /^\s*\(.*\)\s*$/.test(raw);
    var normalized = raw.replace(/,/g, '').replace(/[^0-9.]/g, '');
    var n = Number(normalized);
    if (!Number.isFinite(n)) return 0;
    return negative ? -Math.abs(n) : n;
  }

  function money(v) {
    var n = Number(v);
    if (!Number.isFinite(n)) n = 0;
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function moneySAR(v) {
    return money(v) + ' ريال';
  }

  function readJson(k, fallback) {
    try {
      var raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function readCell(selector) {
    var el = document.querySelector(selector);
    return el ? parseAmount(el.textContent) : 0;
  }

  function readLiveNet() {
    var summary = readCell('#summary-table tfoot tr.final-total-row td:last-child');
    if (summary !== 0) return summary;

    summary = readCell('#summary-table tfoot tr:first-child td:last-child');
    if (summary !== 0) return summary;

    var dashboard = readCell('#display-consumables-cost') + readCell('#display-subcontractors-cost');
    if (dashboard !== 0) return dashboard;

    for (var i = 0; i < NET_KEYS.length; i++) {
      var stored = parseAmount(localStorage.getItem(NET_KEYS[i]));
      if (stored !== 0) return stored;
    }

    return 0;
  }

  var ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
  var tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  var teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  var hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

  function underThousand(n) {
    n = Math.floor(Math.abs(Number(n) || 0));
    var parts = [];
    var h = Math.floor(n / 100);
    var r = n % 100;
    if (h) parts.push(hundreds[h]);
    if (r) {
      if (r < 10) parts.push(ones[r]);
      else if (r < 20) parts.push(teens[r - 10]);
      else {
        var o = r % 10;
        var t = Math.floor(r / 10);
        parts.push(o ? ones[o] + ' و' + tens[t] : tens[t]);
      }
    }
    return parts.join(' و');
  }

  function intWords(n) {
    n = Math.floor(Math.abs(Number(n) || 0));
    if (n === 0) return 'صفر';

    var scales = [
      { v: 1000000000, s: 'مليار', d: 'ملياران', p: 'مليارات' },
      { v: 1000000, s: 'مليون', d: 'مليونان', p: 'ملايين' },
      { v: 1000, s: 'ألف', d: 'ألفان', p: 'آلاف' }
    ];
    var parts = [];

    scales.forEach(function (sc) {
      var x = Math.floor(n / sc.v);
      if (!x) return;
      if (x === 1) parts.push(sc.s);
      else if (x === 2) parts.push(sc.d);
      else parts.push(underThousand(x) + ' ' + (x >= 3 && x <= 10 ? sc.p : sc.s));
      n %= sc.v;
    });

    if (n) parts.push(underThousand(n));
    return parts.join(' و');
  }

  function tafqeetSAR(amount) {
    var total = Math.round((Number(amount) || 0) * 100) / 100;
    var abs = Math.abs(total);
    var riyals = Math.floor(abs);
    var halalas = Math.round((abs - riyals) * 100);
    if (halalas === 100) {
      riyals += 1;
      halalas = 0;
    }

    var text = 'فقط وقدره ' + (total < 0 ? 'سالب ' : '') + intWords(riyals) + ' ريال سعودي';
    if (halalas > 0) text += ' و' + intWords(halalas) + ' هللة';
    return text + ' لا غير';
  }

  function fixSummaryTafqeet() {
    var tfoot = document.querySelector('#summary-table tfoot');
    if (!tfoot) return;

    var finalRow = tfoot.querySelector('tr.final-total-row') || tfoot.querySelector('tr');
    if (!finalRow || !finalRow.cells || !finalRow.cells.length) return;

    var net = parseAmount(finalRow.cells[finalRow.cells.length - 1].textContent);
    if (net >= 0) return;

    var row = tfoot.querySelector('tr.tafqeet-row');
    if (!row) {
      row = document.createElement('tr');
      row.className = 'tafqeet-row';
      var td = document.createElement('td');
      td.colSpan = Math.max(1, (document.querySelectorAll('#summary-table thead th').length || finalRow.cells.length));
      row.appendChild(td);
      tfoot.appendChild(row);
    }

    var cell = row.cells && row.cells[0];
    if (cell) cell.textContent = tafqeetSAR(net);
  }

  function patchLetterPopup(win) {
    try {
      if (!win || win.closed || !win.document) return;
      var body = win.document.body;
      if (!body) return;
      var scope = String(body.getAttribute('data-signature-scope') || '');
      if (scope.indexOf('consumables:') !== 0) return;

      var net = readLiveNet();
      if (net >= 0) return;

      var settings = readJson(LETTER_KEY, {});
      var rate = Number(settings && settings.vatRate);
      if (!Number.isFinite(rate)) rate = 15;
      var vat = net * rate / 100;
      var grand = net + vat;

      Array.prototype.forEach.call(win.document.querySelectorAll('.amount-table'), function (table) {
        var rows = table.querySelectorAll('tbody tr');
        if (rows[0] && rows[0].cells.length) rows[0].cells[rows[0].cells.length - 1].textContent = moneySAR(net);
        if (rows[1] && rows[1].cells.length) rows[1].cells[rows[1].cells.length - 1].textContent = moneySAR(vat);
        if (rows[2] && rows[2].cells.length) rows[2].cells[rows[2].cells.length - 1].textContent = moneySAR(grand);
      });

      Array.prototype.forEach.call(win.document.querySelectorAll('.tafqeet'), function (el) {
        el.textContent = tafqeetSAR(grand);
      });

      Array.prototype.forEach.call(win.document.querySelectorAll('.body-text'), function (el) {
        var text = String(el.textContent || '');
        if (/بمبلغ\s*\([^)]*ريال\)/.test(text)) {
          el.textContent = text.replace(/بمبلغ\s*\([^)]*ريال\)/, 'بمبلغ (' + money(grand) + ' ريال)');
        }
      });
    } catch (e) {
      console.warn('[ConsumablesNegativeAmountGuard] popup patch failed', e);
    }
  }

  function installPopupGuard() {
    if (window.__HOSPITAL_CONSUMABLES_NEGATIVE_OPEN_PATCHED__) return;
    window.__HOSPITAL_CONSUMABLES_NEGATIVE_OPEN_PATCHED__ = true;

    var nativeOpen = window.open;
    if (typeof nativeOpen !== 'function') return;

    window.open = function () {
      var win = nativeOpen.apply(window, arguments);
      if (!win) return win;

      [0, 30, 120, 350].forEach(function (delay) {
        setTimeout(function () { patchLetterPopup(win); }, delay);
      });

      return win;
    };
  }

  function fixDialogPreview() {
    var net = readLiveNet();
    if (net >= 0) return;

    var settings = readJson(LETTER_KEY, {});
    var rate = Number(settings && settings.vatRate);
    if (!Number.isFinite(rate)) rate = 15;
    var grand = net + (net * rate / 100);

    Array.prototype.forEach.call(document.querySelectorAll('#hospital-consumables-raise-letter-overlay .field'), function (field) {
      var label = field.querySelector('label');
      var box = field.querySelector('.readonly-box');
      if (label && box && /الإجمالي شامل الضريبة/.test(label.textContent || '')) {
        box.textContent = moneySAR(grand);
      }
    });
  }

  function exposeNegativeAwareHelpers() {
    var api = window.HospitalConsumablesRaiseLetter;
    if (!api) return;
    api.getCurrentConsumablesNet = readLiveNet;
    api.tafqeetSAR = tafqeetSAR;
  }

  function applyFixes() {
    fixSummaryTafqeet();
    fixDialogPreview();
    exposeNegativeAwareHelpers();
  }

  installPopupGuard();
  applyFixes();

  var observer = new MutationObserver(function () {
    applyFixes();
  });

  if (document.documentElement) {
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  }

  document.addEventListener('input', function () { setTimeout(applyFixes, 0); }, true);
  document.addEventListener('change', function () { setTimeout(applyFixes, 0); }, true);
  setTimeout(applyFixes, 250);
  setTimeout(applyFixes, 900);
  setTimeout(applyFixes, 2200);

  console.info('[Consumables Negative Amount Guard] installed v1');
})();