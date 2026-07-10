import { useEffect, useRef, useState } from "react";
import { useSearch } from "wouter";
import { useAuth } from "@clerk/react";
import { Sidebar } from "@/components/layout/Sidebar";
import { QuranRadioFloatingPlayer } from "@/components/QuranRadioFloatingPlayer";
import { usePageTracking } from "@/hooks/usePageTracking";
import { useGetMe } from "@workspace/api-client-react";
import { Lock, ShieldOff } from "lucide-react";
import { getModuleKey, parseAllowedModules, isModuleAllowed } from "@/lib/modules";

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
  const page = params.get("page") || "index.html";
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [frameEscaped, setFrameEscaped] = useState(false);
  const { getToken } = useAuth();

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

    (window as any).najranGetFreshToken = async (options?: { skipCache?: boolean }) => {
      const token = await getToken(options?.skipCache ? ({ skipCache: true } as any) : undefined);
      saveSessionToken(token);
      return token;
    };

    return () => {
      try { delete (window as any).najranGetFreshToken; } catch {}
    };
  }, [getToken]);

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
        script.src = "/original/extract-submit-flow-control.js?v=20260709_submit_flow_v1";
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
  const moduleKey = getModuleKey(page);
  const isAllowed = isModuleAllowed(moduleKey, allowedModuleKeys, role);

  let content = (
    <iframe
      key={page}
      ref={iframeRef}
      src={`/original/${page}`}
      className="w-full h-full border-0 block"
      title={page}
      onLoad={handleIframeLoad}
    />
  );

  if (frameEscaped) {
    content = (
      <div className="flex h-full items-center justify-center text-center" style={{ direction: "rtl", color: "#1e3c72" }}>
        جاري فتح الصفحة في المسار الصحيح...
      </div>
    );
  } else if (!isAllowed && dbUser) {
    content = <UnauthorizedPage />;
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#f0f4ff" }}>
      <Sidebar dbUserOverride={dbUser} />
      <QuranRadioFloatingPlayer />
      <main className="flex-1 overflow-hidden">{content}</main>
    </div>
  );
}
