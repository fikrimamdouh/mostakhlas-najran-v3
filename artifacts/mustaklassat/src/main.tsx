import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// يحفظ بيانات التسجيل الأولى احتياطياً في localStorage قبل الانتقال إلى Clerk.
// ملف مستقل لا يلمس بيانات المستخلصات أو الحضور أو المعادلات.
import "../public/prereg-guard.js";

// يقلل ضغط سجل المراقبة بمنع تسجيل دخول/خروج الصفحات فقط.
// لا يمنع تسجيل التعديلات الفعلية أو الحضور أو الاعتماد أو الصلاحيات.
import "../public/audit-light-guard.js";

// عرض فقط: يضيف عمود المستشفى/المواقع في شاشة إدارة المستخدمين من بيانات المستخدمين المحمّلة.
// لا يغير التسجيل أو الربط أو الصلاحيات.
import "../public/admin-users-hospital-column.js";

// شاشة النسخ الاحتياطي فقط: يضيف استرجاع مستشفى محدد من ملف النسخة.
// لا يلمس صفحات المستخلصات أو الحضور أو الأداء أو المستهلكات.
import "../public/admin-backup-hospital-restore.js";

console.log("PRODUCTION_BUILD_MARKER_2026_05_07_V4_LIVE_KEY");

createRoot(document.getElementById("root")!).render(<App />);