// Hospital Consumables Letters Settings Fix V6
// Scope: normal consumables.html only.
// Provides a safe independent settings modal for consumables letters, using the same storage key.
(function () {
  'use strict';

  var sig = location.pathname + location.search;
  var pageFile = '';
  try {
    pageFile = new URLSearchParams(location.search || '').get('page') || '';
    pageFile = pageFile ? pageFile.split('/').pop() : (location.pathname || '').split('/').pop();
  } catch (_) {
    pageFile = (location.pathname || '').split('/').pop();
  }
  if (pageFile !== 'consumables.html' && !/\/original\/consumables\.html(?:$|[?#])/.test(sig)) return;
  if (/admin_offices_consumables\.html|health_centers_consumables\.html|najran_general_consumables\.html/.test(pageFile)) return;
  if (window.__HOSPITAL_CONSUMABLES_SETTINGS_FIX_V6__) return;
  window.__HOSPITAL_CONSUMABLES_SETTINGS_FIX_V6__ = true;

  var KEY = 'hospitalConsumablesRaiseLettersSettings_v1';
  var DOCS = [
    ['main', 'خطاب المستهلكات للمستشفى'],
    ['noPrev', 'عدم أسبقية صرف - مقاولين'],
    ['electricity', 'محضر استهلاك كهرباء'],
    ['water', 'محضر استهلاك مياه'],
    ['certificate', 'مشهد مستهلكات']
  ];
  var LABELS = DOCS.reduce(function (m, x) { m[x[0]] = x[1]; return m; }, {});

  function clean(v) { return String(v == null ? '' : v).replace(/[\u200e\u200f]/g, '').replace(/\s+/g, ' ').trim(); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c]; }); }
  function readJson(k, f) { try { var r = localStorage.getItem(k); return r ? JSON.parse(r) : f; } catch (_) { return f; } }
  function writeJson(k, v) { try { localStorage.setItem(k, JSON.stringify(v || {})); } catch (_) { alert('تعذر حفظ إعدادات خطابات المستهلكات. صغّر صورة الترويسة إذا كانت كبيرة.'); } }
  function setPath(obj, path, value) { var p = path.split('.'); for (var i = 0; i < p.length - 1; i++) { obj[p[i]] = obj[p[i]] || {}; obj = obj[p[i]]; } obj[p[p.length - 1]] = value; }
  function field(path, label, value, type) { return '<div class="hc-field"><label>' + esc(label) + '</label><input type="' + (type || 'text') + '" data-hc-path="' + esc(path) + '" value="' + esc(value) + '"></div>'; }
  function area(path, label, value) { return '<div class="hc-field wide"><label>' + esc(label) + '</label><textarea data-hc-path="' + esc(path) + '">' + esc(value) + '</textarea></div>'; }
  function selectField(path, label, value, opts) { return '<div class="hc-field"><label>' + esc(label) + '</label><select data-hc-path="' + esc(path) + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '" ' + (String(value) === String(o[0]) ? 'selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></div>'; }

  function defaults() {
    return {
      version: 'hospital-consumables-letters-v6-settings-fixed',
      selectedDoc: 'main',
      letterheadEnabled: 'no',
      letterheadDataUrl: '',
      letterheadHasPlaceData: 'yes',
      contentTop: 52,
      vatRate: 15,
      entityTitle: 'تجمع نجران الصحي',
      departmentTitle: 'وحدة الصيانة العامة',
      phoneFaxAr: '',
      phoneFaxEn: '',
      letters: {
        main: { title: 'خطاب رفع المستهلكات', recipient: 'سعادة / مساعد المدير العام للدعم المساند', recipientSuffix: 'المحترم', body: 'نرفق لسعادتكم المستخلص الشهري لشركة {company} والخاص ببند المستهلكات ومقاولي الباطن{placePhrase}، {period}.', closing: 'لذا نأمل بعد الاطلاع إحالته إلى جهة الاختصاص لتدقيقه واستكمال إجراءات صرف مستحقات المقاول / {company}.\nوتقبلوا تحياتنا ،،،', signatures: [{ title: 'مدير المستشفى', name: '' }], showStamp: 'no' },
        noPrev: { title: 'إقرار بعدم أسبقية الصرف', body: 'تشهد إدارة / {hospital} بأن استحقاق شركة / {company} لمستخلص المستهلكات ومقاولي الباطن دفعة رقم ({paymentNo}) بمبلغ ({grand} ريال).\n\nلم يسبق صرف هذا المستخلص من قبلنا.', closing: 'مع أطيب تحياتي ،،،', signatures: [{ title: 'الموظف المختص', name: '' }, { title: 'مدير الإدارة', name: '' }], showDate: 'yes', showStamp: 'yes' },
        electricity: { title: 'محضر حصر استهلاك الكهرباء للفترة من {start} إلى {end}', hoursPerDay: 8, daysCount: 31, rate: 0.05, rows: [{ place: 'مكتب مدير الصيانة', load: 'مكيف شباك', power: 2.2 }], signatures: [{ title: 'مهندس الكهرباء', name: 'م / ارسولو بالموريا أوريستيلا محمد آل سنان' }, { title: 'رئيس الصيانة العامة', name: 'م / علي' }], showStamp: 'no' },
        water: { title: 'محضر استهلاك', body: 'نشهد نحن الموقعين أدناه بأنه قد تم استهلاك كميات مياه الشرب الموضحة أدناه{placePhrase} عن الفترة من {start} وحتى {end}.', rows: [{ item: 'توريد مياه', unit: 'م³', qty: '', notes: '' }], signatures: [{ title: 'مهندس المقاول', name: 'م / جابر محمد الهمامي' }, { title: 'رئيس الصيانة العامة', name: 'م / علي محمد آل سنان' }], showStamp: 'no' },
        certificate: { title: 'شهادة', body: 'تشهد إدارة {hospital} بأن شركة {company} قامت بتوريد جميع المستهلكات والمواد الهندسية داخل الموقع وذلك عن الفترة من {start} وحتى {end}.\n\nوهذا مشهد منا بذلك.', signatures: [{ title: 'مندوب المقاول', name: 'م / جابر محمد الهمامي محمد آل سنان' }, { title: 'محاسب المستشفى', name: 'أ / صالح حسين آل شرمه' }, { title: 'رئيس الصيانة العامة', name: 'م / علي' }], showStamp: 'no' }
      }
    };
  }
  function merge(a, b) { a = a || {}; b = b || {}; Object.keys(b).forEach(function (k) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k])) a[k] = merge(a[k] || {}, b[k]); else a[k] = b[k]; }); return a; }
  function settings() { return merge(defaults(), readJson(KEY, {})); }
  function saveSettings(s) { s.version = 'hospital-consumables-letters-v6-settings-fixed'; writeJson(KEY, s); }

  function currentMetaHtml() {
    var cd = readJson('persistentContractData', {});
    var ex = readJson('persistentExtractData', {});
    var hospital = clean(cd.hospitalName || cd.siteName || cd.centerName || localStorage.getItem('hospitalName') || localStorage.getItem('currentHospital') || 'الموقع الحالي');
    var company = clean(cd.contractorName || cd.companyName || cd.company || ex.companyName || 'الشركة الحالية');
    var start = clean(ex.extractStart || ex.periodStart || ex.startDate || localStorage.getItem('extractStart') || 'غير محدد');
    var end = clean(ex.extractEnd || ex.periodEnd || ex.endDate || localStorage.getItem('extractEnd') || 'غير محدد');
    return '<div class="hc-live"><b>الموقع:</b> ' + esc(hospital) + ' &nbsp; <b>الشركة:</b> ' + esc(company) + ' &nbsp; <b>الفترة:</b> ' + esc(start) + ' إلى ' + esc(end) + '</div>';
  }

  function signatureEditor(s, key) {
    var sigs = s.letters[key].signatures || [];
    return '<div class="hc-section"><h3>توقيعات مستقلة لهذا الخطاب فقط</h3><div class="hc-grid">' + sigs.map(function (x, i) {
      return field('letters.' + key + '.signatures.' + i + '.title', 'صفة التوقيع ' + (i + 1), x.title || '') + field('letters.' + key + '.signatures.' + i + '.name', 'اسم التوقيع ' + (i + 1), x.name || '');
    }).join('') + '</div><div class="hc-row"><button type="button" data-hc-add-sign>إضافة توقيع</button><button type="button" data-hc-remove-sign>حذف آخر توقيع</button></div></div>';
  }

  function letterFields(s, key) {
    var l = s.letters[key] || {};
    var html = '<div class="hc-section"><h3>إعدادات: ' + esc(LABELS[key]) + '</h3><div class="hc-grid">' + field('letters.' + key + '.title', 'العنوان', l.title || '');
    if (key === 'main') html += field('letters.main.recipient', 'المخاطب', l.recipient || '') + field('letters.main.recipientSuffix', 'المحترم / الصفة', l.recipientSuffix || '') + area('letters.main.body', 'نص الخطاب', l.body || '') + area('letters.main.closing', 'الخاتمة', l.closing || '');
    if (key === 'noPrev') html += selectField('letters.noPrev.showDate', 'إظهار التاريخ', l.showDate || 'yes', [['yes', 'نعم'], ['no', 'لا']]) + area('letters.noPrev.body', 'نص الإقرار', l.body || '') + area('letters.noPrev.closing', 'الخاتمة', l.closing || '') + selectField('letters.noPrev.showStamp', 'إظهار الختم', l.showStamp || 'yes', [['yes', 'نعم'], ['no', 'لا']]);
    if (key === 'certificate') html += area('letters.certificate.body', 'نص الشهادة', l.body || '') + selectField('letters.certificate.showStamp', 'إظهار الختم', l.showStamp || 'no', [['yes', 'نعم'], ['no', 'لا']]);
    if (key === 'water') html += area('letters.water.body', 'نص محضر المياه', l.body || '') + selectField('letters.water.showStamp', 'إظهار الختم', l.showStamp || 'no', [['yes', 'نعم'], ['no', 'لا']]);
    if (key === 'electricity') html += field('letters.electricity.hoursPerDay', 'عدد ساعات التشغيل اليومية', l.hoursPerDay || 8, 'number') + field('letters.electricity.daysCount', 'عدد أيام الفترة', l.daysCount || 31, 'number') + field('letters.electricity.rate', 'سعر الكيلو وات / ساعة', l.rate || 0.05, 'number') + selectField('letters.electricity.showStamp', 'إظهار الختم', l.showStamp || 'no', [['yes', 'نعم'], ['no', 'لا']]);
    html += '</div></div>';
    return html + signatureEditor(s, key);
  }

  function css() {
    if (document.getElementById('hc-cons-settings-fix-css')) return;
    var st = document.createElement('style');
    st.id = 'hc-cons-settings-fix-css';
    st.textContent = '.hc-cons-modal{position:fixed;inset:0;background:rgba(15,23,42,.76);z-index:2147483200;display:flex;align-items:center;justify-content:center;padding:16px;direction:rtl;font-family:Tajawal,Arial,sans-serif}.hc-cons-dialog{width:min(1120px,96vw);max-height:90vh;overflow:auto;background:#fff;border-radius:22px;padding:18px;box-shadow:0 28px 80px rgba(0,0,0,.35);color:#0f172a}.hc-cons-dialog h2{text-align:center;color:#003087;margin:0 0 12px}.hc-row{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:10px 0}.hc-row button{border:0;border-radius:10px;padding:10px 14px;font-weight:900;cursor:pointer;background:#f1f5f9}.hc-row .primary{background:#003087;color:#fff}.hc-row .gold{background:#d4af37;color:#111}.hc-section{border:1px solid #e2e8f0;border-radius:14px;padding:12px;margin-top:12px;background:#f8fafc}.hc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px}.hc-field{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:10px}.hc-field.wide{grid-column:1/-1}.hc-field label{display:block;font-size:12px;font-weight:900;margin-bottom:6px;color:#334155}.hc-field input,.hc-field select,.hc-field textarea{width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:9px;font-family:inherit}.hc-field textarea{min-height:92px}.hc-live{background:#ecfdf5;border:1px solid #99f6e4;border-radius:12px;padding:10px;text-align:center;font-weight:800}.hc-note{color:#047857;text-align:center;font-weight:900;min-height:24px}.hc-head-preview{display:block;max-width:180px;max-height:250px;margin:8px auto;border:1px solid #cbd5e1;border-radius:10px}';
    document.head.appendChild(st);
  }

  function readModalIntoSettings() {
    var s = settings();
    document.querySelectorAll('#hc-cons-settings-modal [data-hc-path]').forEach(function (el) { setPath(s, el.dataset.hcPath, el.value); });
    saveSettings(s);
    return s;
  }

  function renderModal() {
    css();
    var s = settings();
    var key = s.selectedDoc || 'main';
    var img = clean(s.letterheadDataUrl || '');
    var old = document.getElementById('hc-cons-settings-modal');
    if (old) old.remove();
    var html = '<div class="hc-cons-modal" id="hc-cons-settings-modal"><div class="hc-cons-dialog"><h2>إعدادات خطابات رفع المستهلكات</h2><div class="hc-note" id="hc-cons-note"></div>' + currentMetaHtml() + '<div class="hc-row">' + DOCS.map(function (d) { return '<button type="button" data-hc-doc="' + d[0] + '" class="' + (key === d[0] ? 'primary' : '') + '">' + esc(d[1]) + '</button>'; }).join('') + '</div><div class="hc-row"><button type="button" class="primary" data-hc-save>حفظ</button><button type="button" class="gold" data-hc-print>طباعة المختار</button><button type="button" class="gold" data-hc-full>طباعة مستخلص المستهلكات كامل</button><button type="button" data-hc-close>إغلاق</button></div><div class="hc-section"><h3>الترويسة المشتركة لكل خطابات المستهلكات</h3><div class="hc-grid">' + selectField('letterheadEnabled', 'تفعيل الترويسة', s.letterheadEnabled || 'no', [['no', 'لا'], ['yes', 'نعم']]) + selectField('letterheadHasPlaceData', 'الترويسة تحتوي بيانات الجهة والمكان', s.letterheadHasPlaceData || 'yes', [['yes', 'نعم — لا تكرر الموقع'], ['no', 'لا — اطبع الهيدر الداخلي']]) + field('contentTop', 'بداية المحتوى بعد الترويسة mm', s.contentTop || 52, 'number') + field('vatRate', 'نسبة الضريبة', s.vatRate || 15, 'number') + '<div class="hc-field wide"><label>رفع صورة الترويسة A4</label><input type="file" id="hc-cons-head-file" accept="image/*">' + (img ? '<img class="hc-head-preview" src="' + esc(img) + '">' : '') + '</div></div><div class="hc-row"><button type="button" data-hc-delete-head>حذف الترويسة</button></div></div>' + letterFields(s, key) + '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    bindModal();
  }

  function bindModal() {
    var modal = document.getElementById('hc-cons-settings-modal');
    if (!modal) return;
    modal.addEventListener('click', function (e) {
      if (e.target === modal || e.target.closest('[data-hc-close]')) { readModalIntoSettings(); modal.remove(); return; }
      var doc = e.target.closest('[data-hc-doc]');
      if (doc) { var s = readModalIntoSettings(); s.selectedDoc = doc.dataset.hcDoc; saveSettings(s); renderModal(); return; }
      if (e.target.closest('[data-hc-save]')) { readModalIntoSettings(); var n = document.getElementById('hc-cons-note'); if (n) n.textContent = 'تم الحفظ.'; return; }
      if (e.target.closest('[data-hc-print]')) { readModalIntoSettings(); if (window.HospitalConsumablesRaiseLetter && window.HospitalConsumablesRaiseLetter.printSelected) window.HospitalConsumablesRaiseLetter.printSelected(); return; }
      if (e.target.closest('[data-hc-full]')) { readModalIntoSettings(); if (window.HospitalConsumablesRaiseLetter && window.HospitalConsumablesRaiseLetter.printFullExtract) window.HospitalConsumablesRaiseLetter.printFullExtract(); return; }
      if (e.target.closest('[data-hc-delete-head]')) { var s2 = readModalIntoSettings(); s2.letterheadDataUrl = ''; s2.letterheadEnabled = 'no'; saveSettings(s2); renderModal(); return; }
      if (e.target.closest('[data-hc-add-sign]')) { var s3 = readModalIntoSettings(); var k = s3.selectedDoc || 'main'; s3.letters[k].signatures = s3.letters[k].signatures || []; s3.letters[k].signatures.push({ title: '', name: '' }); saveSettings(s3); renderModal(); return; }
      if (e.target.closest('[data-hc-remove-sign]')) { var s4 = readModalIntoSettings(); var k2 = s4.selectedDoc || 'main'; if ((s4.letters[k2].signatures || []).length > 1) s4.letters[k2].signatures.pop(); saveSettings(s4); renderModal(); }
    }, true);
    modal.addEventListener('input', function (e) { if (e.target && e.target.matches('[data-hc-path]')) readModalIntoSettings(); }, true);
    var file = document.getElementById('hc-cons-head-file');
    if (file) file.onchange = function () { var f = this.files && this.files[0]; if (!f) return; var r = new FileReader(); r.onload = function () { var s = readModalIntoSettings(); s.letterheadDataUrl = String(r.result || ''); s.letterheadEnabled = 'yes'; saveSettings(s); renderModal(); }; r.readAsDataURL(f); };
  }

  function interceptSettingsButtons() {
    document.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest && e.target.closest('[data-hc-action="settings"],#hospital-consumables-raise-letter-settings-btn');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      renderModal();
    }, true);
  }

  function patchGlobal() {
    window.HospitalConsumablesRaiseLetter = window.HospitalConsumablesRaiseLetter || {};
    window.HospitalConsumablesRaiseLetter.openDialog = renderModal;
    window.HospitalConsumablesRaiseLetter.closeDialog = function () { var m = document.getElementById('hc-cons-settings-modal'); if (m) { readModalIntoSettings(); m.remove(); } };
    window.HospitalConsumablesRaiseLetter.saveDialog = function () { readModalIntoSettings(); };
  }

  interceptSettingsButtons();
  patchGlobal();
  setTimeout(patchGlobal, 700);
  setTimeout(patchGlobal, 1600);
  console.info('[Hospital Consumables Settings Fix] installed v6');
})();
