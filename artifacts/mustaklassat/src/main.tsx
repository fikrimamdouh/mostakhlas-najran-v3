import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

import "../public/prereg-guard.js";
import "../public/audit-light-guard.js";
import "../public/admin-users-hospital-column.js";
import "../public/admin-backup-hospital-restore.js";
import "../public/admin-extract-select-tools.js";

console.log("PRODUCTION_BUILD_MARKER_2026_05_07_V4_LIVE_KEY");

createRoot(document.getElementById("root")!).render(<App />);
