// Standalone Consumables Letters Settings V1
(function () {
  'use strict';
  var KEY = 'hospitalConsumablesRaiseLettersSettings_v1';

  function defaultSettings() {
    return {
      version: 'standalone-consumables-settings-v1',
      selectedDoc: 'main',
      letterheadEnabled: 'no',
      letterheadHasPlaceData: 'yes',
      letterheadDataUrl: '',
      contentTop: 52,
      vatRate: 15,
      letters: {
        main: { title: 'خطاب رفع المستهلكات', recipient: 'سعادة / مساعد المدير العام للدعم المساند', recipientSuffix: 'المحترم', body: 'نرفق لسعادتكم المستخلص الشهري لشركة {company} والخاص ببند المستهلكات ومقاولي الباطن{placePhrase}، {period}.', closing: 'وتقبلوا تحياتنا ،،،', signatures: [{ title: 'مدير المستشفى', name: '' }], showStamp: 'no' },
        noPrev: { title: 'إقرار بعدم أسبقية الصرف', body: 'لم يسبق صرف هذا المستخلص من قبلنا.', closing: 'مع أطيب تحياتي ،،،', signatures: [{ title: 'الموظف المختص', name: '' }, { title: 'مدير الإدارة', name: '' }], showStamp: 'yes' },
        electricity: { title: 'محضر حصر استهلاك الكهرباء', hoursPerDay: 8, daysCount: 31, rate: 0.05, signatures: [{ title: 'مهندس الكهرباء', name: '' }, { title: 'رئيس الصيانة العامة', name: '' }], showStamp: 'no' },
        water: { title: 'محضر استهلاك', body: 'نشهد نحن الموقعين أدناه بأنه قد تم استهلاك كميات مياه الشرب الموضحة أدناه.', signatures: [{ title: 'مهندس المقاول', name: '' }, { title: 'رئيس الصيانة العامة', name: '' }], showStamp: 'no' },
        certificate: { title: 'شهادة', body: 'تشهد إدارة {hospital} بأن شركة {company} قامت بتوريد جميع المستهلكات والمواد الهندسية داخل الموقع.', signatures: [{ title: 'مندوب المقاول', name: '' }, { title: 'محاسب المستشفى', name: '' }, { title: 'رئيس الصيانة العامة', name: '' }], showStamp: 'no' }
      }
    };
  }

  function readSettings() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : defaultSettings();
    } catch (_) {
      return defaultSettings();
    }
  }

  function saveSettings(v) {
    localStorage.setItem(KEY, JSON.stringify(v || {}, null, 2));
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]; });
  }

  function render() {
    document.body.innerHTML = '<main class="box">' +
      '<h1>إعدادات خطابات رفع المستهلكات</h1>' +
      '<p>صفحة مستقلة. تحفظ على نفس مفتاح إعدادات المستهلكات فقط ولا تفتح خطابات الرفع العادية.</p>' +
      '<div class="actions"><button id="save" class="ok">حفظ</button><button id="reset">تهيئة افتراضي</button><button id="open">فتح صفحة المستهلكات</button><button id="back" class="danger">رجوع</button></div>' +
      '<div id="msg"></div>' +
      '<textarea id="json" spellcheck="false">' + esc(JSON.stringify(readSettings(), null, 2)) + '</textarea>' +
      '</main>';

    document.getElementById('save').onclick = function () {
      try {
        saveSettings(JSON.parse(document.getElementById('json').value || '{}'));
        document.getElementById('msg').textContent = 'تم حفظ إعدادات خطابات المستهلكات.';
      } catch (e) {
        alert('JSON غير صالح. لم يتم الحفظ.');
      }
    };
    document.getElementById('reset').onclick = function () {
      var d = defaultSettings();
      saveSettings(d);
      document.getElementById('json').value = JSON.stringify(d, null, 2);
      document.getElementById('msg').textContent = 'تمت التهيئة الافتراضية.';
    };
    document.getElementById('open').onclick = function () { location.href = '/original/consumables.html?v=from_settings_' + Date.now(); };
    document.getElementById('back').onclick = function () { if (history.length > 1) history.back(); else location.href = '/'; };
  }

  render();
})();
