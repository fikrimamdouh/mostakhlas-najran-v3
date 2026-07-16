(function () {
  'use strict';

  var params = new URLSearchParams(location.search);
  var language = params.get('lang') || 'ar';
  var dictionaries = {
    ar: { dir:'rtl', title:'نموذج طلب زيارة', intro:'سجّل بيانات الزيارة وسيصل الطلب مباشرة إلى إدارة الزيارات.', steps:['اختر الموقع والنظام والشركة','أدخل الاسم والهوية والجوال','أرسل الطلب للمراجعة'], maintenance:'مقاول الصيانة', site:'الموقع / المستشفى', date:'تاريخ الزيارة المطلوب', system:'النظام المراد زيارته', contractor:'شركة مقاول الباطن', name:'اسم الزائر الكامل', identity:'رقم الهوية / الإقامة', mobile:'رقم الجوال السعودي', submit:'إرسال طلب الزيارة', privacy:'تُستخدم البيانات لمراجعة طلب الزيارة وإصدار التصريح فقط.', choose:'اختر' },
    en: { dir:'ltr', title:'Visit Request Form', intro:'Enter the visit details. The request will be sent directly to the visit management team.', steps:['Choose the site, system and company','Enter name, ID and mobile number','Submit the request for review'], maintenance:'Maintenance contractor', site:'Site / Hospital', date:'Requested visit date', system:'System to be visited', contractor:'Subcontractor company', name:'Visitor full name', identity:'National ID / Iqama number', mobile:'Saudi mobile number', submit:'Submit visit request', privacy:'The data is used only to review the visit request and issue the permit.', choose:'Select' },
    ur: { dir:'rtl', title:'وزٹ درخواست فارم', intro:'وزٹ کی معلومات درج کریں۔ درخواست براہِ راست وزٹ انتظامیہ کو بھیجی جائے گی۔', steps:['مقام، نظام اور کمپنی منتخب کریں','نام، شناختی نمبر اور موبائل درج کریں','جائزے کے لیے درخواست بھیجیں'], maintenance:'مینٹیننس کنٹریکٹر', site:'مقام / ہسپتال', date:'مطلوبہ وزٹ کی تاریخ', system:'وزٹ کا نظام', contractor:'ذیلی ٹھیکیدار کمپنی', name:'وزیٹر کا مکمل نام', identity:'شناختی کارڈ / اقامہ نمبر', mobile:'سعودی موبائل نمبر', submit:'وزٹ درخواست بھیجیں', privacy:'یہ معلومات صرف درخواست کے جائزے اور اجازت نامہ جاری کرنے کے لیے استعمال ہوتی ہیں۔', choose:'منتخب کریں' },
    hi: { dir:'ltr', title:'विज़िट अनुरोध फ़ॉर्म', intro:'विज़िट की जानकारी दर्ज करें। अनुरोध सीधे विज़िट प्रबंधन टीम को भेजा जाएगा।', steps:['स्थान, सिस्टम और कंपनी चुनें','नाम, पहचान संख्या और मोबाइल दर्ज करें','समीक्षा के लिए अनुरोध भेजें'], maintenance:'रखरखाव ठेकेदार', site:'स्थान / अस्पताल', date:'अनुरोधित विज़िट तिथि', system:'विज़िट किया जाने वाला सिस्टम', contractor:'उप-ठेकेदार कंपनी', name:'आगंतुक का पूरा नाम', identity:'राष्ट्रीय पहचान / इकामा नंबर', mobile:'सऊदी मोबाइल नंबर', submit:'विज़िट अनुरोध भेजें', privacy:'डेटा का उपयोग केवल अनुरोध की समीक्षा और परमिट जारी करने के लिए किया जाता है।', choose:'चुनें' }
  };
  var t = dictionaries[language] || dictionaries.ar;

  document.documentElement.lang = language;
  document.documentElement.dir = t.dir;
  document.body.dir = t.dir;
  document.body.style.background = 'transparent';
  var shell = document.querySelector('.shell');
  if (shell) { shell.style.width = '100%'; shell.style.padding = '0'; }
  var hero = document.querySelector('.hero');
  if (hero) hero.style.display = 'none';
  var admin = document.getElementById('admin-policy-card');
  if (admin) admin.remove();

  function setLabel(forId, text) {
    var label = document.querySelector('label[for="' + forId + '"]');
    if (label) label.textContent = text;
  }

  function translatePlaceholders() {
    document.querySelectorAll('select option').forEach(function (option) {
      var text = String(option.textContent || '').trim();
      if (!text || option.value) return;
      if (/جارٍ|اختر|أولًا|الموقع|النظام/.test(text)) option.textContent = t.choose;
    });
    var name = document.getElementById('full-name'); if (name) name.placeholder = t.name;
    var identity = document.getElementById('identity'); if (identity) identity.placeholder = '10 digits';
    var mobile = document.getElementById('mobile'); if (mobile) mobile.placeholder = '05xxxxxxxx';
  }

  function apply() {
    document.title = t.title;
    setLabel('maintenance', t.maintenance);
    setLabel('site', t.site);
    setLabel('visit-date', t.date);
    setLabel('system', t.system);
    setLabel('contractor', t.contractor);
    setLabel('full-name', t.name);
    setLabel('identity', t.identity);
    setLabel('mobile', t.mobile);
    var submit = document.getElementById('submit'); if (submit && !submit.disabled) submit.textContent = t.submit;
    var privacy = document.querySelector('.privacy'); if (privacy) privacy.textContent = t.privacy;
    var notice = document.getElementById('mode-notice');
    if (notice) notice.textContent = t.intro;
    translatePlaceholders();
  }

  var card = document.querySelector('.card');
  if (card && !document.getElementById('translated-steps')) {
    var steps = document.createElement('div');
    steps.id = 'translated-steps';
    steps.style.cssText = 'margin-bottom:16px;border:1px solid #bfdbfe;border-radius:12px;padding:12px 14px;background:#eff6ff;color:#1e40af;line-height:1.8;font-size:12px';
    steps.innerHTML = '<strong style="display:block;margin-bottom:4px">' + t.title + '</strong>' + t.steps.map(function (step, index) { return '<div><b>' + (index + 1) + '.</b> ' + step + '</div>'; }).join('');
    card.insertBefore(steps, card.firstChild);
  }

  apply();
  var applying = false;
  new MutationObserver(function () {
    if (applying) return;
    applying = true;
    apply();
    applying = false;
  }).observe(document.body, { childList: true, subtree: true, characterData: true });

  function reportHeight() {
    try { parent.postMessage({ type: 'visit-form-height', height: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) }, location.origin); } catch (_) {}
  }
  reportHeight();
  new ResizeObserver(reportHeight).observe(document.body);
})();
