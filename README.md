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

   ثم استبدل `VITE_CLERK_PUBLISHABLE_KEY` بمفتاح Clerk publishable الحقيقي. بدون هذا المتغير ستظهر صفحة خطأ إعدادات تسجيل الدخول بدل التطبيق.

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
