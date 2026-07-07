// Hospital Consumables Signature Style Controls V1
// Scope: standalone consumables letters settings page only.
(function () {
  'use strict';

  var SETTINGS_KEY = 'hospitalConsumablesRaiseLettersSettings_v1';
  var STYLE_ID = 'hospital-consumables-signature-style-controls';

  function isSettingsPage() {
    return /hospital_consumables_letters_settings\.html(?:$|[?#])/.test(location.pathname + location.search);
  }

  if (!isSettingsPage()) return;
  if (window.__HOSPITAL_CONSUMABLES_SIGNATURE_STYLE_CONTROLS_V1__) return;
  window.__HOSPITAL_CONSUMABLES_SIGNATURE_STYLE_CONTROLS_V1__ = true;

  function readSettings() {
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  function saveSettings(s) {
    try {
      s = s || {};
      s.version = s.version || 'hospital-consumables-letters-signature-style-controls-v1';
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
      localStorage.setItem(SETTINGS_KEY + '_autosave_ts', String(Date.now()));
    } catch (_) {}
  }

  function clamp(v, min, max, fallback) {
    var n = Number(v);
    if (!Number.isFinite(n)) n = fallback;
    return Math.min(max, Math.max(min, n));
  }

  function styleValues() {
    var s = readSettings();
    return {
      signatureFontSize: clamp(s.signatureFontSize, 10, 26, 15),
      signatureFontWeight: clamp(s.signatureFontWeight, 400, 900, 900),
      signatureTitleNameGap: clamp(s.signatureTitleNameGap, 0, 40, 14),
      signatureLineHeight: clamp(s.signatureLineHeight, 1, 2.4, 1.7)
    };
  }

  function fieldHtml(key, label, value, min, max, step) {
    return '<label class="field"><span>' + label + '</span><input type="number" data-signature-style="' + key + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '"></label>';
  }

  function updatePreview(box, v) {
    var preview = box && box.querySelector('.sig-style-preview');
    if (!preview) return;
    preview.style.fontSize = v.signatureFontSize + 'px';
    preview.style.fontWeight = String(v.signatureFontWeight);
    preview.style.lineHeight = String(v.signatureLineHeight);
    var name = preview.querySelector('.sig-style-preview-name');
    if (name) name.style.marginTop = v.signatureTitleNameGap + 'px';
  }

  function persistFromBox(box) {
    var s = readSettings();
    box.querySelectorAll('[data-signature-style]').forEach(function (el) {
      s[el.getAttribute('data-signature-style')] = el.value;
    });
    saveSettings(s);
    updatePreview(box, styleValues());
    var msg = document.getElementById('msg');
    if (msg) msg.textContent = 'تم حفظ تنسيق التوقيع تلقائيًا.';
  }

  function ensureControls() {
    if (document.getElementById(STYLE_ID)) return;
    var anchor = document.querySelector('.sign-only') || document.querySelector('.section');
    if (!anchor || !anchor.parentNode) return;

    var v = styleValues();
    var section = document.createElement('section');
    section.id = STYLE_ID;
    section.className = 'section sign-style-controls';
    section.innerHTML =
      '<h2>تنسيق التوقيع العام</h2>' +
      '<p class="section-note">هذه العدادات تطبق على توقيعات خطابات المستهلكات عند الطباعة: حجم الخط، سماكته، والمسافة بين الصفة والاسم.</p>' +
      '<div class="grid">' +
        fieldHtml('signatureFontSize', 'حجم خط التوقيع', v.signatureFontSize, 10, 26, 1) +
        fieldHtml('signatureFontWeight', 'سماكة الخط', v.signatureFontWeight, 400, 900, 100) +
        fieldHtml('signatureTitleNameGap', 'المسافة بين الصفة والاسم px', v.signatureTitleNameGap, 0, 40, 1) +
        fieldHtml('signatureLineHeight', 'تباعد أسطر الاسم', v.signatureLineHeight, 1, 2.4, 0.1) +
      '</div>' +
      '<div class="sig-style-preview" style="margin-top:12px;background:#fff;border:1px dashed #cbd5e1;border-radius:12px;padding:12px;text-align:center">' +
        '<div>مدير المستشفى</div>' +
        '<div class="sig-style-preview-name">أ / مثال الاسم</div>' +
      '</div>';

    anchor.parentNode.insertBefore(section, anchor);
    updatePreview(section, v);
    section.addEventListener('input', function () { persistFromBox(section); }, true);
    section.addEventListener('change', function () { persistFromBox(section); }, true);
  }

  ensureControls();

  try {
    var mo = new MutationObserver(function () { ensureControls(); });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } catch (_) {
    setInterval(ensureControls, 1000);
  }
})();