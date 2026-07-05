import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { applyThemeEarly } from "./components/layout/ThemeToggle";

applyThemeEarly();

import "../public/prereg-guard.js";
import "../public/audit-light-guard.js";
import "../public/admin-users-hospital-column.js";
import "../public/admin-backup-hospital-restore.js";
import "../public/admin-extract-select-tools.js";

console.log("PRODUCTION_BUILD_MARKER_2026_05_07_V4_LIVE_KEY");

const rootElement = document.getElementById("root")!;

if (window.self !== window.top) {
  console.warn("[FrameGuard] React SPA was loaded inside an iframe; breaking out to prevent duplicated sidebars.");
  try {
    window.top?.location.assign(window.location.href);
  } catch {
    rootElement.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;direction:rtl;font-family:Tajawal,Arial,sans-serif;background:#f0f4ff;color:#1e3c72;text-align:center;padding:24px;">
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:20px;box-shadow:0 18px 50px rgba(30,60,114,.12);padding:28px;max-width:520px;">
          <h1 style="margin:0 0 10px;font-size:22px;font-weight:900;">تم منع فتح النظام داخل إطار داخلي</h1>
          <p style="margin:0;color:#64748b;line-height:1.9;">افتح الصفحة في التبويب الرئيسي لمنع تكرار القائمة الجانبية.</p>
        </div>
      </div>
    `;
  }
} else {
  createRoot(rootElement).render(<App />);
}
