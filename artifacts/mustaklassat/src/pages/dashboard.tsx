import { useGetMe } from "@workspace/api-client-react";
import { useUser } from "@clerk/react";
import {
  Clock, BarChart2, Trophy, Package, Wrench, CheckSquare,
  Building2, Settings, SlidersHorizontal, ClipboardList, Eye, UserPlus
} from "lucide-react";

const modules = [
  { href: "/original/settings_main.html",          icon: Settings,         label: "الإعدادات الرئيسية",        color: "#2a5298" },
  { href: "/original/settings_advanced.html",       icon: SlidersHorizontal,label: "الإعدادات المتقدمة",         color: "#1e3c72" },
  { href: "/original/attendance.html",              icon: Clock,            label: "الحضور والانصراف",           color: "#0077b6" },
  { href: "/original/performance.html",             icon: BarChart2,        label: "جداول الأداء",              color: "#023e8a" },
  { href: "/original/achievement.html",             icon: Trophy,           label: "شهادة الإنجاز",             color: "#0096c7" },
  { href: "/original/consumables.html",             icon: Package,          label: "مستخلص المستهلكات",         color: "#0077b6" },
  { href: "/original/spare_parts.html",             icon: Wrench,           label: "مستخلص قطع الغيار",         color: "#023e8a" },
  { href: "/original/approval.html",               icon: CheckSquare,      label: "اعتماد المستخلص",           color: "#0096c7" },
  { href: "/original/health_centers.html",          icon: Building2,        label: "المراكز الصحية",            color: "#2a5298" },
  { href: "/original/health_centers_attendance.html",icon: ClipboardList,   label: "حضور المراكز الصحية",       color: "#1e3c72" },
  { href: "/original/health_centers_consumables.html",icon: Package,        label: "مستهلكات المراكز الصحية",   color: "#0077b6" },
  { href: "/original/review_extract.html",          icon: Eye,              label: "مراجعة المستخلص",           color: "#023e8a" },
];

export default function Dashboard() {
  const { user } = useUser();
  const { data: dbUser } = useGetMe({ query: { queryKey: ["/api/users/me"] } });

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <video
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
      >
        <source src="/original/pattern-1.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px]" />

      <div className="relative space-y-8 animate-in fade-in duration-500 p-2" style={{ direction: "rtl" }}>
      {/* Welcome */}
      <div
        className="rounded-2xl p-6 flex items-center gap-5"
        style={{ background: "linear-gradient(135deg,#1e3c72 0%,#2a5298 100%)", color: "#fff" }}
      >
        <img
          src="/logo.png"
          alt="شعار تجمع نجران الصحي"
          className="h-16 w-auto drop-shadow-lg"
          onError={e => (e.target as HTMLImageElement).style.display = "none"}
        />
        <div>
          <h1 className="text-2xl font-extrabold mb-1">
            أهلاً، {user?.fullName || dbUser?.name || "مستخدم"} 👋
          </h1>
          <p style={{ color: "rgba(255,255,255,0.8)" }}>
            برنامج المستخلصات الشهرية — إدارة الهندسة والصيانة
          </p>
          <p style={{ color: "#d4af37", fontSize: 13, marginTop: 4 }}>
            {dbUser?.role === "admin" ? "🔑 مدير النظام" : "مستخدم معتمد"}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { n: "٤٩٥٬٠٠٠", label: "مستفيد من خدمات الرعاية الصحية" },
          { n: "٦٩", label: "مركزاً للرعاية الأولية و١٢ مستشفى" },
          { n: "١٣٠٠", label: "سرير بسعة إجمالية" },
        ].map(s => (
          <div
            key={s.label}
            className="rounded-xl p-5 text-center"
            style={{ background: "linear-gradient(135deg,#1e3c72,#2a5298)", color: "#fff" }}
          >
            <div className="text-3xl font-black mb-1" style={{ color: "#d4af37" }}>{s.n}</div>
            <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 13 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Modules grid */}
      <div>
        <h2 className="text-xl font-bold mb-4" style={{ color: "#1e3c72" }}>وحدات النظام</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {modules.map(m => {
            const Icon = m.icon;
            return (
              <a
                key={m.href}
                href={m.href}
                className="group rounded-xl p-5 text-center transition-all duration-200 hover:-translate-y-1 no-underline flex flex-col items-center gap-3"
                style={{
                  background: "#fff",
                  border: "2px solid #e8edf7",
                  boxShadow: "0 2px 8px rgba(30,60,114,0.07)",
                  color: "#1e3c72",
                }}
              >
                <div
                  className="h-14 w-14 rounded-xl flex items-center justify-center transition-all group-hover:scale-110"
                  style={{ background: m.color }}
                >
                  <Icon className="h-7 w-7 text-white" />
                </div>
                <span className="font-bold text-sm leading-tight" style={{ color: "#1e3c72" }}>
                  {m.label}
                </span>
              </a>
            );
          })}

          {/* Admin-only: user management */}
          {dbUser?.role === "admin" && (
            <a
              href="/admin/users"
              className="group rounded-xl p-5 text-center transition-all duration-200 hover:-translate-y-1 no-underline flex flex-col items-center gap-3"
              style={{
                background: "linear-gradient(135deg,#d4af37,#b8962e)",
                border: "2px solid #b8962e",
                boxShadow: "0 2px 8px rgba(212,175,55,0.2)",
                color: "#1e3c72",
              }}
            >
              <div className="h-14 w-14 rounded-xl flex items-center justify-center bg-white/20">
                <UserPlus className="h-7 w-7 text-white" />
              </div>
              <span className="font-bold text-sm text-white">إدارة المستخدمين</span>
            </a>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
