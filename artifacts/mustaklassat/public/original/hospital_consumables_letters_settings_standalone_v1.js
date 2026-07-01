// Standalone Consumables Letters Settings V3
(function () {
  'use strict';

  var KEY = 'hospitalConsumablesRaiseLettersSettings_v1';
  var TS_KEY = KEY + '_autosave_ts';
  var VIEW_KEY = 'hospitalConsumablesSettingsView_v1';
  var DOCS = [
    ['main', 'خطاب المستهلكات للمستشفى'],
    ['noPrev', 'عدم أسبقية صرف - مقاولين'],
    ['electricity', 'محضر استهلاك كهرباء'],
    ['water', 'محضر استهلاك مياه'],
    ['certificate', 'مشهد مستهلكات']
  ];
  var LABEL = DOCS.reduce(function (m, x) { m[x[0]] = x[1]; return m; }, {});

  function defaults() {
    return {
      version: 'standalone-consumables-settings-v3',
      selectedDoc: 'main',
      letterheadEnabled: 'no',
      letterheadHasPlaceData: 'yes',
      letterheadDataUrl: '',
      contentTop: 52,
      vatRate: 15,
      letters: {
        main: { title: 'خطاب رفع المستهلكات', recipient: 'سعادة / مساعد المدير العام للدعم المساند', recipientSuffix: 'المحترم', body: 'نرفق لسعادتكم المستخلص الشهري لشركة {company} والخاص ببند المستهلكات ومقاولي الباطن{placePhrase}، {period}.', closing: 'لذا نأمل بعد الاطلاع إحالته إلى جهة الاختصاص لتدقيقه واستكمال إجراءات صرف مستحقات المقاول / {company}.\nوتقبلوا تحياتنا ،،،', signatures: [{ title: 'مدير المستشفى', name: '' }], showStamp: 'no' },
        noPrev: { title: 'إقرار بعدم أسبقية الصرف', body: 'تشهد إدارة / {hospital} بأن استحقاق شركة / {company} لمستخلص المستهلكات ومقاولي الباطن دفعة رقم ({paymentNo}) بمبلغ ({grand} ريال).\n\nلم يسبق صرف هذا المستخلص من قبلنا.', closing: 'مع أطيب تحياتي ،،،', signatures: [{ title: 'الموظف المختص', name: '' }, { title: 'مدير الإدارة', name: '' }], showDate: 'yes', showStamp: 'yes' },
        electricity: { title: 'محضر حصر استهلاك الكهرباء للفترة من {start} إلى {end}', hoursPerDay: 8, daysCount: 31, rate: 0.05, rows: [{ place: 'مكتب مدير الصيانة', load: 'مكيف شباك', power: 2.2 }], signatures: [{ title: 'مهندس الكهرباء', name: 'م / ارسولو بالموريا أوريستيلا محمد آل سنان' }, { title: 'رئيس الصيانة العامة', name: 'م / علي' }], showStamp: 'no' },
        water: { title: 'محضر استهلاك', body: 'نشهد نحن الموقعين أدناه بأنه قد تم استهلاك كميات مياه الشرب الموضحة أدناه{placePhrase} عن الفترة من {start} وحتى {end}.', rows: [{ item: 'توريد مياه', unit: 'م³', qty: '', notes: '' }], signatures: [{ title: 'مهندس المقاول', name: 'م / جابر محمد الهمامي' }, { title: 'رئيس الصيانة العامة', name: 'م / علي محمد آل سنان' }], showStamp: 'no' },
        certificate: { title: 'شهادة', body: 'تشهد إدارة {hospital} بأن شركة {company} قامت بتوريد جميع المستهلكات والمواد الهندسية داخل الموقع وذلك عن الفترة من {start} وحتى {end}.\n\nوهذا مشهد منا بذلك.', signatures: [{ title: 'مندوب المقاول', name: 'م / جابر محمد الهمامي محمد آل سنان' }, { title: 'محاسب المستشفى', name: 'أ / صالح حسين آل شرمه' }, { title: 'رئيس الصيانة العامة', name: 'م / علي' }], showStamp: 'no' }
      }
    };
  }

  function merge(a, b) {
    a = a || {}; b = b || {};
    Object.keys(b).forEach(function (k) {
      if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k])) a[k] = merge(a[k] || {}, b[k]);
      else a[k] = b[k];
    });
    return a;
  }
  function read() { try { return merge(defaults(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (_) { return defaults(); } }
  function save(s) { s.version = 'standalone-consumables-settings-v3'; localStorage.setItem(KEY, JSON.stringify(s)); localStorage.setItem(TS_KEY, String(Date.now())); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c]; }); }
  function setPath(o, p, v) { p = p.split('.'); for (var i = 0; i < p.length - 1; i++) { o[p[i]] = o[p[i]] || {}; o = o[p[i]]; } o[p[p.length - 1]] = v; }
  function field(p, l, v, t) { return '<label class="field"><span>' + esc(l) + '</span><input data-p="' + esc(p) + '" type="' + (t || 'text') + '" value="' + esc(v) + '"></label>'; }
  function area(p, l, v) { return '<label class="field wide"><span>' + esc(l) + '</span><textarea data-p="' + esc(p) + '">' + esc(v) + '</textarea></label>'; }
  function yn(p, l, v) { return '<label class="field"><span>' + esc(l) + '</span><select data-p="' + esc(p) + '"><option value="yes" ' + (v === 'yes' ? 'selected' : '') + '>نعم</option><option value="no" ' + (v === 'no' ? 'selected' : '') + '>لا</option></select></label>'; }
  function viewMode() { return localStorage.getItem(VIEW_KEY) || 'full'; }
  function setViewMode(v) { localStorage.setItem(VIEW_KEY, v); }

  function readForm() {
    var s = read();
    document.querySelectorAll('[data-p]').forEach(function (el) { setPath(s, el.dataset.p, el.value); });
    save(s);
    return s;
  }

  function note(t) {
    var n = document.getElementById('msg');
    if (n) n.textContent = t || '';
    if (t) setTimeout(function () { if (n && n.textContent === t) n.textContent = ''; }, 1800);
  }

  function signatures(s, k) {
    var arr = s.letters[k].signatures || [];
    return '<section class="section sign-only"><h2>تعديل التواقيع فقط — ' + esc(LABEL[k]) + '</h2><p class="section-note">أي تعديل في الصفة أو الاسم يتم حفظه فورًا لهذا الخطاب فقط.</p><div class="grid">' + arr.map(function (x, i) {
      return field('letters.' + k + '.signatures.' + i + '.title', 'صفة التوقيع ' + (i + 1), x.title || '') + field('letters.' + k + '.signatures.' + i + '.name', 'اسم التوقيع ' + (i + 1), x.name || '');
    }).join('') + '</div><div class="actions"><button type="button" id="addSig">إضافة توقيع</button><button type="button" id="removeSig">حذف آخر توقيع</button></div></section>';
  }

  function letterFields(s, k) {
    var l = s.letters[k] || {};
    var h = '<section class="section"><h2>إعدادات: ' + esc(LABEL[k]) + '</h2><div class="grid">' + field('letters.' + k + '.title', 'عنوان الخطاب', l.title || '');
    if (k === 'main') h += field('letters.main.recipient', 'المخاطب', l.recipient || '') + field('letters.main.recipientSuffix', 'المحترم / الصفة', l.recipientSuffix || '') + area('letters.main.body', 'نص الخطاب', l.body || '') + area('letters.main.closing', 'الخاتمة', l.closing || '') + yn('letters.main.showStamp', 'إظهار الختم', l.showStamp || 'no');
    if (k === 'noPrev') h += yn('letters.noPrev.showDate', 'إظهار التاريخ', l.showDate || 'yes') + area('letters.noPrev.body', 'نص الإقرار', l.body || '') + area('letters.noPrev.closing', 'الخاتمة', l.closing || '') + yn('letters.noPrev.showStamp', 'إظهار الختم', l.showStamp || 'yes');
    if (k === 'electricity') h += field('letters.electricity.hoursPerDay', 'ساعات التشغيل اليومية', l.hoursPerDay || 8, 'number') + field('letters.electricity.daysCount', 'عدد الأيام', l.daysCount || 31, 'number') + field('letters.electricity.rate', 'سعر الكيلو وات / ساعة', l.rate || 0.05, 'number') + yn('letters.electricity.showStamp', 'إظهار الختم', l.showStamp || 'no');
    if (k === 'water') h += area('letters.water.body', 'نص محضر المياه', l.body || '') + yn('letters.water.showStamp', 'إظهار الختم', l.showStamp || 'no');
    if (k === 'certificate') h += area('letters.certificate.body', 'نص الشهادة', l.body || '') + yn('letters.certificate.showStamp', 'إظهار الختم', l.showStamp || 'no');
    h += '</div></section>';
    return h;
  }

  function letterhead(s) {
    return '<section class="section"><h2>الترويسة المشتركة</h2><div class="grid">' + yn('letterheadEnabled', 'تفعيل الترويسة', s.letterheadEnabled || 'no') + yn('letterheadHasPlaceData', 'الترويسة تحتوي بيانات الجهة والمكان', s.letterheadHasPlaceData || 'yes') + field('contentTop', 'بداية المحتوى بعد الترويسة mm', s.contentTop || 52, 'number') + field('vatRate', 'نسبة الضريبة', s.vatRate || 15, 'number') + '<label class="field wide"><span>رفع صورة الترويسة A4</span><input id="headFile" type="file" accept="image/*">' + (s.letterheadDataUrl ? '<img class="preview" src="' + esc(s.letterheadDataUrl) + '">' : '') + '</label></div><div class="actions"><button type="button" id="deleteHead">حذف الترويسة</button></div></section>';
  }

  function render() {
    var s = read(), k = s.selectedDoc || 'main', mode = viewMode();
    var body = mode === 'sign' ? signatures(s, k) : (letterhead(s) + letterFields(s, k) + signatures(s, k));
    document.body.innerHTML = '<main class="box"><h1>إعدادات خطابات رفع المستهلكات</h1><p>صفحة مستقلة تحفظ إعدادات المستهلكات فقط، ولا تفتح خطابات الرفع العادية.</p><div id="msg"></div><div class="actions top"><button id="save" class="ok">حفظ</button><button id="open">فتح صفحة المستهلكات</button><button id="back" class="danger">رجوع</button></div><div class="actions view"><button type="button" data-view="full" class="viewbtn ' + (mode === 'full' ? 'active' : '') + '">الإعدادات كاملة</button><button type="button" data-view="sign" class="viewbtn ' + (mode === 'sign' ? 'active' : '') + '">تعديل التواقيع فقط</button></div><div class="actions docs">' + DOCS.map(function (d) { return '<button type="button" data-doc="' + d[0] + '" class="doc ' + (k === d[0] ? 'active' : '') + '">' + d[1] + '</button>'; }).join('') + '</div>' + body + '</main>';
    bind();
  }

  function bind() {
    document.querySelectorAll('[data-p]').forEach(function (el) { el.oninput = function () { readForm(); note('تم الحفظ تلقائيًا.'); }; el.onchange = function () { readForm(); note('تم الحفظ تلقائيًا.'); }; });
    document.querySelectorAll('[data-doc]').forEach(function (btn) { btn.onclick = function () { var s = readForm(); s.selectedDoc = btn.dataset.doc; save(s); render(); }; });
    document.querySelectorAll('[data-view]').forEach(function (btn) { btn.onclick = function () { readForm(); setViewMode(btn.dataset.view); render(); }; });
    document.getElementById('save').onclick = function () { readForm(); note('تم حفظ إعدادات خطابات المستهلكات.'); };
    document.getElementById('open').onclick = function () { location.href = '/original/consumables.html?v=from_settings_' + Date.now(); };
    document.getElementById('back').onclick = function () { history.length > 1 ? history.back() : location.href = '/'; };
    var del = document.getElementById('deleteHead');
    if (del) del.onclick = function () { var s = readForm(); s.letterheadDataUrl = ''; s.letterheadEnabled = 'no'; save(s); render(); };
    document.getElementById('addSig').onclick = function () { var s = readForm(), k = s.selectedDoc; s.letters[k].signatures = s.letters[k].signatures || []; s.letters[k].signatures.push({ title: '', name: '' }); save(s); render(); };
    document.getElementById('removeSig').onclick = function () { var s = readForm(), k = s.selectedDoc; if ((s.letters[k].signatures || []).length > 1) s.letters[k].signatures.pop(); save(s); render(); };
    var head = document.getElementById('headFile');
    if (head) head.onchange = function () { var f = this.files && this.files[0]; if (!f) return; var r = new FileReader(); r.onload = function () { var s = readForm(); s.letterheadDataUrl = String(r.result || ''); s.letterheadEnabled = 'yes'; save(s); render(); }; r.readAsDataURL(f); };
    window.onbeforeunload = function () { try { readForm(); } catch (_) {} };
  }

  render();
})();
