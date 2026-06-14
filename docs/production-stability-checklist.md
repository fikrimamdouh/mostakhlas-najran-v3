# Production Stability Test Matrix — Mostakhlas Najran

الغرض: إثبات الاستقرار قبل الإغلاق، بدون تعديل التصميم أو المعادلات أو تدفق العمل.

> الحالة الافتراضية لكل الاختبارات: **Not Run** حتى يتم تنفيذها يدويًا على الإنتاج أو staging مطابق للإنتاج.

## قواعد عامة قبل الاختبار

- افتح DevTools قبل بدء كل سيناريو.
- فعّل Preserve log في Console وNetwork.
- فلتر Network على: `hospital-storage`, `submitted-extracts`, `storage`, `sync`.
- بعد كل سيناريو احفظ الأدلة المطلوبة: Console text، Network HAR أو screenshots، ولقطة UI عند الحاجة.
- لا تنفذ إصلاحات أثناء الاختبار. سجل النتيجة فقط.

---

## جدول الاختبارات الحرجة

| Test ID | السيناريو | الخطوات | النتيجة المتوقعة | النتيجة الفعلية | Pass / Fail | ملاحظات | Evidence المطلوب |
|---|---|---|---|---|---|---|---|
| V8-01 | وصول V8 في صفحة الحضور | 1) افتح `/original/attendance.html` 2) افتح Console 3) اعمل hard refresh | يظهر `✓ V8 Local-first` ولا يظهر `✓ V7` | Not Run | Not Run |  | انسخ آخر 20 سطر من Console |
| V8-02 | وصول V8 في الإعدادات | 1) افتح `/original/settings_main.html` 2) افتح Console 3) اعمل hard refresh | يظهر `✓ V8 Local-first` ولا يظهر `✓ V7` | Not Run | Not Run |  | انسخ آخر 20 سطر من Console |
| U-01 | مستخدم عادي — حفظ إعدادات المستخلص | 1) دخول مستخدم عادي 2) افتح settings_main 3) احفظ الشهر/السنة/رقم المستخلص/البداية/النهاية | تظهر رسالة/حالة حفظ ناجحة، والقيم تبقى كما أدخلت | Not Run | Not Run |  | Screenshot من UI + Console logs الخاصة بالحفظ |
| U-02 | مستخدم عادي — فتح الحضور بعد الحفظ | 1) بعد U-01 افتح attendance 2) راجع بيانات أعلى الصفحة | اسم المستشفى والشركة والعقد صحيح، والمدة لا ترجع لقيمة قديمة | Not Run | Not Run |  | Screenshot من أعلى attendance + Console |
| U-03 | مستخدم عادي — عدم رفع تشغيل تلقائي | 1) عدّل قيمة حضور بسيطة 2) انتظر 60 ثانية 3) راقب Console/Network | لا يظهر `PUSH → [صريح]` ولا PUT تشغيلي تلقائي، ويظهر local-first إن كانت V8 فعالة | Not Run | Not Run |  | Console + Network filter `hospital-storage` |
| R-01 | Review Only — ظهور وضع القراءة | 1) دخول حساب مراجع فقط 2) افتح مستشفى مراجعة | يظهر log أو مؤشر `REVIEW ONLY` / `قراءة فقط` | Not Run | Not Run |  | Console + screenshot من الصفحة |
| R-02 | Review Only — لا يرفع | 1) في وضع مراجعة افتح صفحة بيانات 2) تنقل داخل الصفحة 3) أغلق/أعد تحميل | لا يوجد `PUT /api/hospital-storage` ولا PUSH | Not Run | Not Run |  | Network HAR أو screenshot Network filtered |
| R-03 | Review Only — البيانات من السيرفر فقط | 1) افتح مستخلص مراجعة 2) راقب GET requests | توجد GET للقراءة، ولا توجد writes تشغيلية | Not Run | Not Run |  | Network requests list |
| A-01 | أدمن — تبديل بدر الجنوب إلى حبونا | 1) دخول أدمن 2) اختر بدر الجنوب 3) ثم حبونا | اسم المستشفى والعقد والمستخلص يتغيرون، ولا تبقى بيانات بدر الجنوب | Not Run | Not Run |  | Screenshot قبل/بعد + Console |
| A-02 | أدمن — تبديل حبونا إلى يدمة | 1) اختر حبونا 2) ثم يدمة | لا تظهر بيانات حبونا داخل يدمة | Not Run | Not Run |  | Screenshot قبل/بعد + Network hospital query |
| A-03 | أدمن — لا يرفع حضور بدون صلاحية مقصودة | 1) كأدمن افتح attendance 2) لا تستخدم صلاحية تحرير حضور 3) راقب Network | لا يوجد رفع حضور من جهاز الأدمن إلا إذا `canEditAttendance` مفعلة صراحة | Not Run | Not Run |  | Console + Network PUTs |
| LS-01 | localStorage قديم — عدم ظهور مستشفى قديم | 1) استخدم جهاز/متصفح به بيانات قديمة 2) سجل دخول لمستشفى مختلفة 3) افتح settings ثم attendance | لا تظهر بيانات المستشفى القديم في المستشفى الجديدة | Not Run | Not Run |  | Screenshot UI + localStorage keys sample |
| LS-02 | localStorage قديم — عدم رفع قديم تلقائيًا | 1) بعد LS-01 راقب Network 60 ثانية | لا يوجد PUT يرفع بيانات قديمة تلقائيًا | Not Run | Not Run |  | Network filter `PUT` + Console |
| LS-03 | localStorage قديم — لا رجوع لمدة قديمة | 1) احفظ مدة مستخلص جديدة 2) reload 3) افتح attendance | المدة الجديدة ثابتة ولا ترجع للقديمة | Not Run | Not Run |  | Screenshot قبل/بعد reload |
| API-01 | submitted-extracts PUT لا يقبل hospitalName من body | 1) أرسل PUT لمستخلص مملوك في حالة needs_revision/rejected مع body فيه `hospitalName` مزيف | السيرفر لا يغير hospitalName إلى القيمة المزيفة | Not Run | Not Run |  | Request/response JSON + مقارنة المستخلص بعد PUT |
| API-02 | submitted-extracts PUT لا يقبل companyName/contractNumber من body | 1) أرسل PUT مع `companyName` و`contractNumber` مزيفة | السيرفر يستخدم بيانات المستخدم/القيمة الأصلية، لا body المزيف | Not Run | Not Run |  | Request/response JSON |
| API-03 | hospital-storage لا يكتب لمستشفى مراجعة | 1) بحساب مراجع حاول PUT `/api/hospital-storage?hospital=اسم_مستشفى` | يرجع 403 أو لا يحفظ | Not Run | Not Run |  | Status code + response JSON |
| API-04 | المستخدم العادي لا يتجاوز مستشفاه | 1) بحساب عادي اطلب بيانات مستشفى أخرى عبر query `hospital=` | يرجع 403 أو لا يرجع بيانات غير مصرح بها | Not Run | Not Run |  | Status code + response JSON |
| API-05 | مشرف العقد لا يتجاوز شركته | 1) بحساب contract_supervisor افتح قائمة مستخلصات 2) قارن المستشفيات المعروضة | تظهر مستشفيات شركته فقط | Not Run | Not Run |  | Response list + screenshot UI |
| RL-01 | reload بعد الحفظ | 1) احفظ إعدادات مستخلص 2) reload 3) افتح attendance | الشهر/السنة/الرقم/البداية/النهاية ثابتة | Not Run | Not Run |  | Screenshot settings + attendance بعد reload |
| D2-01 | جهازان لنفس المستشفى | 1) جهاز 1 يعدل محليًا 2) جهاز 2 يفتح نفس المستشفى 3) جهاز 1 يرفع صراحة 4) جهاز 2 يعيد فتح | لا خلط مستشفيات، والمراجعة تعتمد snapshot المرفوع | Not Run | Not Run |  | Console/Network من الجهازين + screenshot مراجعة |
| P-01 | الأداء — عدم طلبات API متكررة | 1) افتح settings_main 2) راقب Network لمدة 90 ثانية بدون تعديل | لا يوجد loop requests مستمر بلا سبب | Not Run | Not Run |  | Network timeline screenshot |
| P-02 | الأداء — attendance بدون PUSH متكرر | 1) افتح attendance 2) انتظر 90 ثانية بدون تعديل | لا يوجد PUSH أو PUT متكرر | Not Run | Not Run |  | Network filtered by PUT |

---

## أوامر مساعدة للاختبار اليدوي

### Console — فحص نسخة Cloud Sync

```js
Array.from(document.scripts).filter(s => /cloud-sync\.js/.test(s.src)).map(s => s.src)
```

المطلوب بعد cache bust اليدوي:

```text
/original/cloud-sync.js?v=20260614c
```

### Console — فحص سياق المستخلص

```js
window.najranGetExtractContextKey && window.najranGetExtractContextKey()
```

المطلوب: قيمة تحتوي السنة/الشهر/رقم المستخلص/البداية/النهاية إن كانت الإعدادات محفوظة.

### Console — فحص المفاتيح المتسخة

```js
window.najranGetDirtyKeys && window.najranGetDirtyKeys()
```

المطلوب: ظهور مفاتيح التشغيل بعد تعديل محلي، بدون PUSH تلقائي إلا عند رفع صريح.

### Network filters

```text
method:PUT hospital-storage
method:POST submitted-extracts
method:PUT submitted-extracts
hospital-storage
submitted-extracts
```

---

## ملخص نتيجة الاختبار

| المؤشر | النتيجة |
|---|---|
| عدد الاختبارات | 24 |
| Pass | 0 |
| Fail | 0 |
| Not Run | 24 |
| أخطر Fail | لا يوجد — لم يتم التنفيذ بعد |
| هل حدث overwrite؟ | غير مثبت |
| هل حدث خلط مستشفيات؟ | غير مثبت |
| هل المراجع رفع بيانات؟ | غير مثبت |
| هل V8 وصل فعليًا؟ | غير مثبت |
| هل المستخدم العادي بقي داخل نطاقه؟ | غير مثبت |

## قرار الإغلاق بعد الاختبار

- [ ] جاهز للإغلاق
- [ ] جاهز جزئيًا مع نقاط مراقبة
- [x] غير جاهز للإغلاق — حتى تنفيذ الاختبارات وتسجيل الأدلة الفعلية.
