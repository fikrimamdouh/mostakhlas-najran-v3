import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

export function MainLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen" style={{ background: "linear-gradient(135deg, #f0f4ff 0%, #e8edf5 100%)" }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {/* Top bar */}
        <div
          className="sticky top-0 z-10 h-14 flex items-center px-8 border-b"
          style={{
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(10px)",
            borderColor: "rgba(42,82,152,0.12)",
          }}
        >
          <div
            className="h-1 w-8 rounded-full mr-3"
            style={{ background: "linear-gradient(90deg, #1e3c72, #2a5298)" }}
          />
          <span className="text-sm font-medium" style={{ color: "#1e3c72" }}>
            نظام إدارة المستخلصات — تجمع نجران الصحي
          </span>
        </div>

        <div className="p-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </div>
      </main>
    </div>
  );
}
