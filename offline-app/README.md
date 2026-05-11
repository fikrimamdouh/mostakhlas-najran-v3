# نظام المستخلصات — نسخة الديسكتوب

نسخة أوفلاين كاملة تعمل بدون انترنت على Windows وAndroid.

## البناء — Windows

```bash
cd offline-app
npm install
npm run dist:win      # يبني 32-bit + 64-bit installer
```

الملفات الناتجة في `dist/`:
- `نظام المستخلصات Setup X.X.X.exe` — مثبّت Windows

## البناء — Android (APK)

### المتطلبات
- Node.js 22+
- Android Studio + Android SDK
- Java 17

### الخطوات

```bash
cd offline-app
npm install
npx cap add android
npx cap sync android
npx cap open android
# في Android Studio: Build → Generate Signed APK
```

## تسجيل الدخول الافتراضي

| المستخدم | كلمة المرور |
|---------|------------|
| admin   | admin123   |

**غيّر كلمة المرور بعد أول دخول.**

## بيانات المستخدمين

محفوظة في:
- Windows: `%APPDATA%\najran-offline\najran-data\users.json`
- كل بيانات المستخدمين مشفّرة (bcrypt)

## إضافة مستخدمين

ادخل بحساب admin ← لوحة إدارة المستخدمين في الصفحة الرئيسية.
