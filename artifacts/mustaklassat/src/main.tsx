import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import App from "./App";
import { setBaseUrl } from "@workspace/api-client-react";
import "./index.css";

const root = createRoot(document.getElementById("root")!);
const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() ?? "";
const allowExternalApiBaseUrl = import.meta.env.VITE_ALLOW_EXTERNAL_API === "true";
const apiBaseUrl = allowExternalApiBaseUrl
  ? configuredApiBaseUrl.replace(/\/+$/, "")
  : "";
setBaseUrl(apiBaseUrl || null);

function renderAuthConfigError(message: string) {
  root.render(
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Tajawal, sans-serif", padding: "24px", textAlign: "center" }}>
      <div>
        <h2 style={{ marginBottom: 8 }}>خطأ في إعدادات تسجيل الدخول</h2>
        <p>{message}</p>
      </div>
    </div>,
  );
}

if (!clerkKey) {
  renderAuthConfigError("مفتاح Clerk العام غير موجود. اضبط VITE_CLERK_PUBLISHABLE_KEY أو NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.");
} else {
  if (import.meta.env.PROD && clerkKey.startsWith("pk_test_")) {
    console.warn("Clerk is using a development publishable key in production. Replace it with pk_live when production Clerk is ready.");
  }

  root.render(
    <ClerkProvider publishableKey={clerkKey}>
      <App />
    </ClerkProvider>,
  );
}
