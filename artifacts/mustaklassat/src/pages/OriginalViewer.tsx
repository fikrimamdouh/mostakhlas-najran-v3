import { useEffect, useRef, useState } from "react";
import { useSearch } from "wouter";
import { useAuth, useSession } from "@clerk/react";
import { Sidebar } from "@/components/layout/Sidebar";
import { QuranRadioFloatingPlayer } from "@/components/QuranRadioFloatingPlayer";
import { usePageTracking } from "@/hooks/usePageTracking";
import { useGetMe } from "@workspace/api-client-react";
import { Lock, ShieldOff } from "lucide-react";
import { ALL_MODULES, parseAllowedModules, isModuleAllowed } from "@/lib/modules";
import originalPages from "@/config/original-pages.json";

const KNOWN_ORIGINAL_PAGES = new Set([
  ...originalPages.modulePages,
  ...originalPages.auxiliaryPages,
  ...originalPages.adminOnlyPages,
]);
const ADMIN_ONLY_ORIGINAL_PAGES = new Set(originalPages.adminOnlyPages);
const FRAME_POLICY_CACHE_VERSION = "20260714_token_bridge_v3";

function UnauthorizedPage() {
  return (
    <div
      className="flex flex-col items-center justify-center h-full p-8 text-center"
      style={{ direction: "rtl", background: "linear-gradient(135deg, #f0f4ff 0%, #e8edf5 100%)" }}
    >
      <div
        className="rounded-3xl p-10 max-w-lg w-full shadow-xl"
        style={{ background: "#fff", border: "1px solid #e8edf7" }}
      >
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg"
          style={{ background: "linear-gradient(135deg, #dc2626, #b91c1c)" }}
        >
          <ShieldOff className="h-10 w-10 text-white" />
        </div>
        <h1 className="text-2xl font-extrabold mb-2 text-red-700">
          غير مصرح بالوصول
        </h1>
        <p className="text-gray-500 text-sm mb-6 leading-relaxed">
          ليست لديك صلاحية الوصول إلى هذه الوحدة. إذا كنت تعتقد أن هذا خطأ، تواصل مع مدير النظام.
        </p>
        <div
          className="flex items-center gap-2 justify-center py-2 px-4 rounded-full text-sm font-medium"
          style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626" }}
        >
          <Lock className="h-3.5 w-3.5" />
          <span>هذه الوحدة غير مضمّنة في صلاحياتك الحالية</span>
        </div>
      </div>
    </div>
  );
}

export default function OriginalViewer() {
  usePageTracking();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const requestedPage = params.get("page") || "index.html";
  const page = KNOWN_ORIGINAL_PAGES.has(requestedPage) ? requestedPage : null;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [frameEscaped, setFrameEscaped] = useState(false);
  const { getToken, isLoaded: authLoaded, sessionId } = useAuth();
  const { session } = useSession();

  const { data: dbUser } = useGetMe({ query: { queryKey: ["/api/users/me"] } });

  useEffect(() => {
    const saveSessionToken = (token: string | null) => {
      if (!token) return;
      try {
        const raw = localStorage.getItem("najran_session");
        const session = raw ? JSON.parse(raw) : {};
        session.clerkToken = token;
        session.timestamp = Date.now();
        localStorage.setItem("najran_session", JSON.stringify(session));
      } catch {}
    };

    const getFreshViewerToken = async (options?: { skipCache?: boolean }) => {
      if (!authLoaded || !sessionId) return null;
      if (options?.skipCache) {
        try { await (session as any)?.reload?.(); } catch {}
      }
      let token = await getToken(options?.skipCache ? ({ skipCache: true } as any) : undefined);
      if (!token && options?.skipCache) {
        await new Promise(resolve => setTimeout(resolve, 250));
        token = await getToken({ skipCache: true } as any);
      }
      saveSessionToken(token);
      return token;
    };

    (window as any).najranGetFreshToken = getFreshViewerToken;

    const tokenRequestHandler = async (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow || event.data?.type !== "NAJRAN_TOKEN_REQUEST") return;
      const requestId = String(event.data?.requestId || "");
      if (!requestId) return;
      try {
        const token = await getFreshViewerToken({ skipCache: event.data?.skipCache !== false });
        iframeRef.current?.contentWindow?.postMessage({ type: "NAJRAN_TOKEN_RESPONSE", requestId, token: token || null }, window.location.origin);
      } catch (error: any) {
        iframeRef.current?.contentWindow?.postMessage({ type: "NAJRAN_TOKEN_RESPONSE", requestId, token: null, error: error?.message || "TOKEN_REFRESH_FAILED" }, window.location.origin);
      }
    };
    window.addEventListener("message", tokenRequestHandler);

    return () => {
      window.removeEventListener("message", tokenRequestHandler);
      try { delete (window as any).najranGetFreshToken; } catch {}
    };
  }, [getToken, authLoaded, sessionId, session]);

  useEffect(() => {
    const handler = (e: Event) => {
      const hospital = (e as CustomEvent<{ hospital: string }>).detail?.hospital;
      if (!hospital) return;
      try {
        const iwin = iframeRef.current?.contentWindow;
        if (iwin) {
          iwin.dispatchEvent(new CustomEvent('najranHospitalChanged', { detail: { hospital } }));
        }
      } catch {}
    };
    window.addEventListener('najranHospitalChanged', handler);
    return () => window.removeEventListener('najranHospitalChanged', handler);
  }, []);

  useEffect(() => {
    const hospital = (dbUser as any)?.hospital as string | undefined;
    if (!hospital) return;
    try {
      const existing = localStorage.getItem("hospitalName");
      if (!existing || existing === "غير محدد" || existing === "اسم المستشفى الافتراضي") {
        localStorage.setItem("hospitalName", hospital);
      }
    } catch {}
    try {
      const contractData = JSON.parse(localStorage.getItem("persistentContractData") || "{}");
      if (!contractData.hospitalName || contractData.hospitalName === "—" || contractData.hospitalName === "غير محدد") {
        contractData.hospitalName = hospital;
        localStorage.setItem("persistentContractData", JSON.stringify(contractData));
      }
    } catch {}
  }, [dbUser]);

  const injectOriginalHelpers = () => {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) return;

      if (!doc.getElementById("najran-submit-flow-control-loader")) {
        const script = doc.createElement("script");
        script.id = "najran-submit-flow-control-loader";
        script.defer = true;
        script.src = "/original/extract-submit-flow-control.js?v=20260713_all_native_dialogs_v1";
        doc.head.appendChild(script);
      }

      if (page === "achievement.html" && !doc.getElementById("najran-achievement-print-signature-once-loader")) {
        const achievementGuard = doc.createElement("script");
        achievementGuard.id = "najran-achievement-print-signature-once-loader";
        achievementGuard.defer = true;
        achievementGuard.src = "/original/achievement_print_signature_once_guard.js?v=20260710_v1";
        doc.head.appendChild(achievementGuard);
      }
    } catch {}
  };

  const handleIframeLoad = () => {
    try {
      const win = iframeRef.current?.contentWindow;
      const loc = win?.location;
      if (!loc) return;
      const path = loc.pathname || "";
      if (path.startsWith("/original/")) {
        injectOriginalHelpers();
        return;
      }
      const next = path + (loc.search || "") + (loc.hash || "");
      console.warn("[OriginalViewer] iframe tried to load SPA/non-original route; breaking out:", next);
      setFrameEscaped(true);
      window.location.assign(next || "/dashboard");
    } catch {}
  };

  const role = dbUser?.role ?? "user";
  const allowedModuleKeys = parseAllowedModules((dbUser as any)?.allowedModules);
  const module = page ? ALL_MODULES.find((candidate) => candidate.file === page || (page === "visit-admin-review.html" && candidate.key === "cluster_visit_management")) : null;
  const moduleAllowed = module ? isModuleAllowed(module.key, allowedModuleKeys, role) : true;
  const isAllowed = !!page
    && moduleAllowed
    && (!ADMIN_ONLY_ORIGINAL_PAGES.has(page) || role === "admin");
  const frameSrc = page
    ? `/original/${page}?framePolicy=${FRAME_POLICY_CACHE_VERSION}`
    : undefined;

  let content = isAllowed ? (
    <iframe
      key={page}
      ref={iframeRef}
      src={frameSrc}
      className="w-full h-full border-0 block"
      title={page}
      onLoad={handleIframeLoad}
    />
  ) : <UnauthorizedPage />;

  if (frameEscaped) {
    content = (
      <div className="flex h-full items-center justify-center text-center" style={{ direction: "rtl", color: "#1e3c72" }}>
        جاري فتح الصفحة في المسار الصحيح...
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#f0f4ff" }}>
      <Sidebar dbUserOverride={dbUser} />
      <QuranRadioFloatingPlayer />
      <main className="flex-1 overflow-hidden">{content}</main>
    </div>
  );
}
