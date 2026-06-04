import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// يحفظ بيانات التسجيل الأولى احتياطياً في localStorage قبل الانتقال إلى Clerk.
// ملف مستقل لا يلمس بيانات المستخلصات أو الحضور أو المعادلات.
import "../public/prereg-guard.js";

console.log("PRODUCTION_BUILD_MARKER_2026_05_07_V4_LIVE_KEY");

createRoot(document.getElementById("root")!).render(<App />);
