import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import App from "./App";
import "./index.css";

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!clerkKey) throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
console.log("NEW BUILD FORCE 2026");

createRoot(document.getElementById("root")!).render(
  <ClerkProvider publishableKey={clerkKey}>
    <App />
  </ClerkProvider>,
);
