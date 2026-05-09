import { useEffect } from "react";
import { useSearch } from "wouter";
import { Sidebar } from "@/components/layout/Sidebar";
import { usePageTracking } from "@/hooks/usePageTracking";
import { useGetMe } from "@workspace/api-client-react";
import { Rocket, Zap, Lock, BarChart3, Globe, Workflow, ShieldOff } from "lucide-react";
import { getModuleKey, parseAllowedModules, isModuleAllowed } from "@/lib/modules";

function ComingSoonPage() {
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
          style={{ background: "linear-gradient(135deg, #1e3c72, #2a5298)" }}
        >
          <Rocket className="h-10 w-10 text-white" />
        </div>
        <h1 className="text-2xl font-extrabold mb-2" style={{ color: "#1e3c72" }}>
          قريبًا — الإعدادات المتقدمة
        </h1>
        <p className="text-gray-500 text-sm mb-8 leading-relaxed">
          هذه الوحدة قيد التطوير وستتضمن ميزات متقدمة لتخصيص النظام بالكامل.
        </p>
        <div className="grid grid-cols-2 gap-3 mb-8">
          {[
            { icon: Workflow, label: "إدارة سير العمل" },
            { icon: BarChart3, label: "تقارير متقدمة" },
            { icon: Globe, label: "إعدادات النظام" },
            { icon: Lock, label: "صلاحيات متقدمة" },
          ].map(f => (
            <div
              key={f.label}
              className="flex items-center gap-2.5 rounded-xl p-3 text-right"
              style={{ background: "#f8f9fe", border: "1px solid #eef0f8" }}
            >
              <div className="p-2 rounded-lg flex-shrink-0" style={{ background: "rgba(30,60,114,0.07)" }}>
                <f.icon className="h-4 w-4" style={{ color: "#1e3c72" }} />
              </div>
              <span className="text-sm font-medium text-gray-700">{f.label}</span>
            </div>
          ))}
        </div>
        <div
          className="flex items-center gap-2 justify-center py-2 px-4 rounded-full text-sm font-medium"
          style={{ background: "rgba(212,175,55,0.12)", color: "#b8962e" }}
        >
          <Zap className="h-3.5 w-3.5" />
          <span>جاري العمل على هذه الميزات حاليًا</span>
        </div>
      </div>
    </div>
  );
}

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
          ليس لديك صلاحية الوصول إلى هذه الوحدة. إذا كنت تعتقد أن هذا خطأ، تواصل مع مدير النظام.
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

  const { data: dbUser } = useGetMe({ query: { queryKey: ["/api/users/me"] } });

  // Inject hospital name from user profile into localStorage so HTML print headers auto-fill
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

  // Check if this page is blocked by coming soon
  const isComingSoon = page === "settings_advanced.html";

  // Determine if user is allowed to view this page (permissions check)
  const role = dbUser?.role ?? "user";
  const allowedModuleKeys = parseAllowedModules((dbUser as any)?.allowedModules);
  const moduleKey = getModuleKey(page);
  const isAllowed = isModuleAllowed(moduleKey, allowedModuleKeys, role);

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="flex h-screen overflow-hidden" style={{ background: "#f0f4ff" }}>
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );

  if (isComingSoon) {
    return <Wrapper><ComingSoonPage /></Wrapper>;
  }

  if (!isAllowed && dbUser) {
    return <Wrapper><UnauthorizedPage /></Wrapper>;
  }

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
