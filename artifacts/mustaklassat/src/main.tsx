import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import App from "./App";
import { setBaseUrl } from "@workspace/api-client-react";
import "./index.css";

const root = createRoot(document.getElementById("root")!);
const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
setBaseUrl(apiBaseUrl || null);

if (!clerkKey) {
  root.render(
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Tajawal, sans-serif", padding: "24px", textAlign: "center" }}>
      <div>
        <h2 style={{ marginBottom: 8 }}>خطأ في إعدادات تسجيل الدخول</h2>
        <p>المتغير <code>VITE_CLERK_PUBLISHABLE_KEY</code> غير موجود في إعدادات البيئة.</p>
      </div>
    </div>,
  );
} else {
  root.render(
    <ClerkProvider publishableKey={clerkKey}>
      <App />
    </ClerkProvider>,
  );
}
