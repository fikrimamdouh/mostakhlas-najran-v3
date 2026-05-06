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

   ثم استبدل `VITE_CLERK_PUBLISHABLE_KEY` بمفتاح Clerk publishable الحقيقي. استخدم مفتاح `pk_test` محليًا فقط، واستخدم `pk_live` عند نشر نسخة الإنتاج. يدعم التطبيق أيضًا alias باسم `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` إذا كانت متغيرات Vercel لديك بهذا الاسم.

   في Vercel/production اضبط كذلك `CLERK_SECRET_KEY=sk_live...` و`CLERK_PUBLISHABLE_KEY=pk_live...` في إعدادات السيرفر/الـ API، ولا تضع `CLERK_SECRET_KEY` داخل كود الواجهة.

   اترك `VITE_API_BASE_URL` فارغًا في الواجهة ليتم استدعاء `/api` من نفس الدومين. هذا يمنع أخطاء CORS مثل استدعاء `https://api-mostakhlas.vercel.app` مباشرة من المتصفح. في التطوير يقوم Vite بتمرير `/api` إلى `API_PROXY_TARGET`. إذا كانت هناك قيمة قديمة لـ `VITE_API_BASE_URL` في Vercel فلن تُستخدم إلا عند ضبط `VITE_ALLOW_EXTERNAL_API=true`.

   اضبط `APP_ORIGIN` أو `ALLOWED_ORIGINS` على الدومين المخصص في Vercel مثل `https://app.your-domain.com` حتى يقبل API الطلبات من الدومين الصحيح.

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

- رسالة Clerk عن development keys تعني أن التطبيق يعمل بمفتاح `pk_test`. لن نمنع فتح التطبيق بسببها، لكنها تعني أن بيئة Clerk ما زالت تطويرية؛ عند تجهيز production اضبط `VITE_CLERK_PUBLISHABLE_KEY` أو `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` على مفتاح `pk_live`.
- رسالة `content script loaded` أو `installHook.js` غالبًا من إضافات المتصفح مثل React DevTools وليست من كود المشروع.
- لا توجد حاجة لأي WebSocket محلي في production؛ إن ظهرت رسالة WebSocket من المتصفح فهي من أداة خارجية/إضافة أو جلسة dev قديمة وليست من build الإنتاج.
- أخطاء CORS مع `api-mostakhlas.vercel.app` تعني أن المتصفح يستدعي API الخارجي مباشرة. التطبيق الآن يتجاهل `VITE_API_BASE_URL` افتراضيًا ويستخدم `/api` على نفس دومين الواجهة؛ لا تضبط `VITE_ALLOW_EXTERNAL_API=true` إلا إذا كان API الخارجي يرسل CORS headers صحيحة.
- فتح `/` لم يعد يحوّل المستخدم المسجل تلقائيًا إلى `/dashboard`؛ لوحة التحكم تفتح فقط عند الدخول إلى مسارها أو الضغط على رابطها.

## نشر Vercel وClerk

- المشروع الحالي Vite/React وليس Next.js، لذلك المتغيرات التي تصل إلى المتصفح يجب أن تبدأ بـ `VITE_`. أضفنا دعم `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` كـ alias لتسهيل النقل من إعدادات Next/Vercel.
- في Clerk production أضف الدومين المخصص من لوحة Clerk، ثم أضف DNS records التي يطلبها Clerk قبل الاعتماد على جلسات الإنتاج.
- في Vercel اضبط الدومين المخصص نفسه، ثم اضبط `APP_ORIGIN` أو `ALLOWED_ORIGINS` في API على هذا الدومين.
- مسارات `/api/users/me` و`/api/users/sync` موجودة في API server وتُستدعى من الواجهة عبر `/api` same-origin.
