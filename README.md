# نظام إدارة المستخلصات

واجهة Vite/React موجودة داخل `artifacts/mustaklassat` ضمن pnpm workspace.

## التشغيل المحلي

1. ثبّت الحزم باستخدام pnpm فقط:

   ```bash
   pnpm install
   ```

2. جهّز متغيرات البيئة للواجهة:

   ```bash
   cp artifacts/mustaklassat/.env.example artifacts/mustaklassat/.env
   ```

   ثم استبدل `VITE_CLERK_PUBLISHABLE_KEY` بمفتاح Clerk publishable الحقيقي. استخدم مفتاح `pk_test` محليًا فقط، واستخدم مفتاح `pk_live` عند نشر نسخة الإنتاج. بدون هذا المتغير ستظهر صفحة خطأ إعدادات تسجيل الدخول بدل التطبيق.

   اترك `VITE_API_BASE_URL` فارغًا في الواجهة ليتم استدعاء `/api` من نفس الدومين. هذا يمنع أخطاء CORS مثل استدعاء `https://api-mostakhlas.vercel.app` مباشرة من المتصفح. في التطوير يقوم Vite بتمرير `/api` إلى `API_PROXY_TARGET`. إذا كانت هناك قيمة قديمة لـ `VITE_API_BASE_URL` في Vercel فلن تُستخدم إلا عند ضبط `VITE_ALLOW_EXTERNAL_API=true`.

3. شغّل المشروع من جذر المستودع:

   ```bash
   pnpm run dev
   ```

   أو شغّل حزمة الواجهة مباشرة:

   ```bash
   pnpm --filter @workspace/mustaklassat run dev
   ```

## البناء والمعاينة

```bash
pnpm run build
pnpm run serve
```

ملفات الإنتاج للواجهة تُبنى في `artifacts/mustaklassat/dist`.

## ملاحظات رسائل المتصفح

- رسالة Clerk عن development keys تعني أن التطبيق يعمل بمفتاح `pk_test`. هذا مقبول محليًا فقط؛ في Vercel/production اضبط `VITE_CLERK_PUBLISHABLE_KEY` على مفتاح `pk_live` لتجنب حدود بيئة التطوير ومشاكل نطاقات `*.clerk.accounts.dev`.
- رسالة `content script loaded` أو `installHook.js` غالبًا من إضافات المتصفح مثل React DevTools وليست من كود المشروع.
- إذا ظهرت رسالة WebSocket إلى `localhost:8081` فتأكد أنك لا تفتح صفحة mockup/Live Server قديمة؛ تشغيل الواجهة الأساسية من الجذر يكون عبر `pnpm run dev` ويفتح Vite على المنفذ الذي يطبعه الطرفية، افتراضيًا `5173`.
- أخطاء CORS مع `api-mostakhlas.vercel.app` تعني أن المتصفح يستدعي API الخارجي مباشرة. التطبيق الآن يتجاهل `VITE_API_BASE_URL` افتراضيًا ويستخدم `/api` على نفس دومين الواجهة؛ لا تضبط `VITE_ALLOW_EXTERNAL_API=true` إلا إذا كان API الخارجي يرسل CORS headers صحيحة.
- فتح `/` لم يعد يحوّل المستخدم المسجل تلقائيًا إلى `/dashboard`؛ لوحة التحكم تفتح فقط عند الدخول إلى مسارها أو الضغط على رابطها.
