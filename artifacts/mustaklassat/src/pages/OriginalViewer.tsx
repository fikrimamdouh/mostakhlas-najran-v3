import { useSearch } from "wouter";
import { Sidebar } from "@/components/layout/Sidebar";
import { usePageTracking } from "@/hooks/usePageTracking";

export default function OriginalViewer() {
  usePageTracking();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const page = params.get("page") || "index.html";

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#f0f4ff" }}>
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <iframe
          key={page}
          src={`/original/${page}`}
          className="w-full h-full border-0 block"
          title={page}
        />
      </main>
    </div>
  );
}
