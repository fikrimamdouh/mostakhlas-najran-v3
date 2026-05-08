import { Link, useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import { useGetMe } from "@workspace/api-client-react";
import {
  LayoutDashboard, Settings, Users, LogOut, ShieldAlert, ClipboardList,
  Clock, CalendarDays, Building2, Briefcase, ChevronLeft, MapPin
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

const ARABIC_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

function formatArabicDate(d: Date) {
  return `${ARABIC_DAYS[d.getDay()]}، ${d.getDate()} ${ARABIC_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function formatTime(d: Date) {
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  const ampm = h >= 12 ? "م" : "ص";
  const h12 = h % 12 || 12;
  return `${h12}:${m}:${s} ${ampm}`;
}

function formatLastLogin(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  const day = ARABIC_DAYS[d.getDay()];
  const date = `${d.getDate()} ${ARABIC_MONTHS[d.getMonth()]}`;
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "م" : "ص";
  const h12 = h % 12 || 12;
  return `${day} ${date} — ${h12}:${m} ${ampm}`;
}

const roleLabel = (role: string) => {
  if (role === "admin") return "مدير النظام";
  if (role === "supervisor") return "مشرف";
  return "مستخدم";
};

const roleColor = (role: string) => {
  if (role === "admin") return "#f59e0b";
  if (role === "supervisor") return "#60a5fa";
  return "#d4af37";
};

export function Sidebar() {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { data: dbUser } = useGetMe({ query: { queryKey: ["/api/users/me"] } });
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const isAdmin = dbUser?.role === "admin";
  const isSupervisor = dbUser?.role === "supervisor";
  const isContractSup = dbUser?.role === "contract_supervisor";
  const canViewAudit = isAdmin || isSupervisor;

  function getSiteType(hospital: string | null | undefined): "hospital" | "health_centers" | "admin_offices" {
    if (!hospital) return "hospital";
    if (hospital === "المراكز الصحية") return "health_centers";
    if (hospital === "المكاتب الإدارية") return "admin_offices";
    return "hospital";
  }
  const siteType = getSiteType(dbUser?.hospital);

  const navigation = [
    { name: "لوحة القيادة", href: "/dashboard", icon: LayoutDashboard },
    { name: "الإعدادات", href: "/settings", icon: Settings },
    ...(isAdmin ? [
      { name: "إدارة المستخدمين", href: "/admin/users", icon: ShieldAlert },
      { name: "النسخ الاحتياطي", href: "/admin/backup", icon: Briefcase },
    ] : []),
    ...(canViewAudit ? [
      { name: "سجل المراقبة", href: "/admin/audit", icon: ClipboardList },
      { name: "قائمة المستخدمين", href: "/admin/users-view", icon: Users },
    ] : []),
    ...(isContractSup ? [
      { name: "لوحة مشرف العقد", href: "/contract-supervisor", icon: Building2 },
    ] : []),
  ];

  const initials = (dbUser?.name || user?.fullName || "م").charAt(0);

  return (
    <div
      className="flex h-full w-64 flex-col text-white relative overflow-hidden"
      style={{
        background: "linear-gradient(170deg, #0f2444 0%, #1a3660 40%, #1e3c72 70%, #2a5298 100%)",
        borderLeft: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "4px 0 24px rgba(0,0,0,0.25)",
      }}
    >
      {/* Decorative background circles */}
      <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full opacity-10"
        style={{ background: "radial-gradient(circle, #d4af37, transparent)" }} />
      <div className="pointer-events-none absolute top-1/2 -left-12 h-36 w-36 rounded-full opacity-5"
        style={{ background: "radial-gradient(circle, #60a5fa, transparent)" }} />

      {/* ───── Logo ───── */}
      <div className="relative flex flex-col items-center pt-7 pb-5 px-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <Link href="/dashboard" className="flex flex-col items-center gap-2 w-full">
          <div className="relative">
            <div className="absolute inset-0 rounded-full opacity-20 blur-md"
              style={{ background: "#d4af37" }} />
            <img
              src="/logo.png"
              alt="تجمع نجران الصحي"
              className="relative h-16 w-auto drop-shadow-xl"
              onError={e => (e.target as HTMLImageElement).style.display = "none"}
            />
          </div>
          <div className="text-center mt-1">
            <div className="font-extrabold text-sm text-white leading-tight tracking-wide">تجمع نجران الصحي</div>
            <div className="text-xs mt-0.5 font-medium" style={{ color: "#d4af37" }}>وحدة الصيانة العامة</div>
          </div>
        </Link>

        {/* Live clock under logo */}
        <div className="mt-4 w-full rounded-xl px-3 py-2.5 text-center"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Clock className="h-3.5 w-3.5" style={{ color: "#d4af37" }} />
            <span className="font-mono text-lg font-bold tracking-widest" style={{ color: "#d4af37" }}>
              {formatTime(now)}
            </span>
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <CalendarDays className="h-3 w-3 opacity-60" />
            <span className="text-xs opacity-70">{formatArabicDate(now)}</span>
          </div>
        </div>
      </div>

      {/* ───── Navigation ───── */}
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-0.5 px-3">
          {navigation.map(item => {
            const isActive = location.startsWith(item.href);
            return (
              <Link key={item.name} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer",
                    isActive
                      ? "text-[#1a3660] font-bold shadow-lg"
                      : "text-white/75 hover:text-white hover:bg-white/10"
                  )}
                  style={isActive ? {
                    background: "linear-gradient(135deg, #d4af37 0%, #e8c84a 100%)",
                    boxShadow: "0 4px 14px rgba(212,175,55,0.35)",
                  } : {}}
                >
                  <item.icon
                    className="h-4.5 w-4.5 flex-shrink-0"
                    style={isActive ? { color: "#1a3660" } : { color: "rgba(255,255,255,0.6)" }}
                  />
                  <span className="flex-1">{item.name}</span>
                  {isActive && <ChevronLeft className="h-3.5 w-3.5 opacity-60" />}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* ───── Original system modules ───── */}
        <div className="px-3 mt-5">
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="h-px flex-1 opacity-20" style={{ background: "#d4af37" }} />
            <span className="text-xs font-semibold" style={{ color: "rgba(212,175,55,0.8)", letterSpacing: "0.06em" }}>
              وحدات النظام
            </span>
            <div className="h-px flex-1 opacity-20" style={{ background: "#d4af37" }} />
          </div>
          <div className="space-y-0.5">
            {(() => {
              const allModules = [
                { page: "settings_main.html",               label: "الإعدادات الرئيسية",                   types: ["hospital", "health_centers", "admin_offices"] },
                { page: "settings_advanced.html",           label: "الإعدادات المتقدمة",                   types: ["hospital", "health_centers", "admin_offices"] },
                { page: "attendance.html",                  label: "الحضور والانصراف",                     types: ["hospital"] },
                { page: "performance.html",                 label: "جداول الأداء",                         types: ["hospital"] },
                { page: "achievement.html",                 label: "شهادة الإنجاز",                        types: ["hospital"] },
                { page: "consumables.html",                 label: "مستخلص المستهلكات",                    types: ["hospital"] },
                { page: "spare_parts.html",                 label: "مستخلص قطع الغيار",                    types: ["hospital"] },
                { page: "approval.html",                    label: "اعتماد المستخلص",                      types: ["hospital"] },
                { page: "monthly-overview.html",            label: "النظرة الشاملة للمستخلصات",            types: ["hospital"] },
                { page: "request-visit.html",               label: "تسجيل ومتابعة الزيارات",               types: ["hospital"] },
                { page: "health_centers_attendance.html",   label: "المراكز الصحية — العمالة",             types: ["health_centers"] },
                { page: "health_centers_consumables.html",  label: "المراكز الصحية — المستهلكات",          types: ["health_centers"] },
                { page: "admin_offices_attendance.html",    label: "المكاتب الإدارية — العمالة",           types: ["admin_offices"] },
                { page: "admin_offices_consumables.html",   label: "المكاتب الإدارية — المستهلكات",        types: ["admin_offices"] },
                { page: "review_extract.html",              label: "مراجعة المستخلص",                      types: ["hospital", "health_centers", "admin_offices"] },
                { page: "extract-archive.html",             label: "أرشيف المستخلصات",                     types: ["hospital", "health_centers", "admin_offices"] },
              ];
              const visibleModules = (isAdmin || isSupervisor || isContractSup)
                ? allModules
                : allModules.filter(m => m.types.includes(siteType));
              return visibleModules;
            })().map(item => {
              const href = `/original-viewer?page=${item.page}`;
              const isActive = location === href || location.startsWith(`/original-viewer`) && new URLSearchParams(location.split("?")[1] || "").get("page") === item.page;
              return (
                <Link key={item.page} href={href}>
                  <div
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150 cursor-pointer group ${isActive ? "text-[#1a3660] font-bold" : "text-white/65 hover:text-white hover:bg-white/10"}`}
                    style={isActive ? { background: "linear-gradient(135deg,#d4af37,#e8c84a)", boxShadow: "0 2px 8px rgba(212,175,55,0.3)" } : {}}
                  >
                    <span className="h-1.5 w-1.5 rounded-full flex-shrink-0 transition-all group-hover:scale-125"
                      style={{ background: isActive ? "#1a3660" : "rgba(212,175,55,0.5)" }} />
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* ───── User info panel ───── */}
      <div className="relative p-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        {/* User card */}
        <div className="rounded-xl p-3 mb-2"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>

          {/* Avatar + name */}
          <div className="flex items-center gap-3 mb-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full font-bold text-base flex-shrink-0 ring-2"
              style={{
                background: "linear-gradient(135deg, rgba(212,175,55,0.3), rgba(212,175,55,0.1))",
                color: "#d4af37",
                outline: "2px solid rgba(212,175,55,0.4)",
                outlineOffset: "1px",
              }}
            >
              {initials}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-semibold text-white truncate leading-tight">
                {dbUser?.name || user?.fullName}
              </span>
              <span className="text-xs font-medium mt-0.5" style={{ color: roleColor(dbUser?.role ?? "") }}>
                {roleLabel(dbUser?.role ?? "user")}
              </span>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-1.5">
            {dbUser?.hospital && (
              <div className="flex items-center gap-2 text-xs text-white/60">
                <Building2 className="h-3 w-3 flex-shrink-0" style={{ color: "#60a5fa" }} />
                <span className="truncate">{dbUser.hospital}</span>
              </div>
            )}
            {dbUser?.jobTitle && (
              <div className="flex items-center gap-2 text-xs text-white/60">
                <Briefcase className="h-3 w-3 flex-shrink-0" style={{ color: "#34d399" }} />
                <span className="truncate">{dbUser.jobTitle}</span>
              </div>
            )}
            {(dbUser as any)?.lastPage && (
              <div className="flex items-center gap-2 text-xs text-white/55">
                <MapPin className="h-3 w-3 flex-shrink-0" style={{ color: "#f472b6" }} />
                <span className="truncate">{(dbUser as any).lastPage}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-white/55 pt-1"
              style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              <Clock className="h-3 w-3 flex-shrink-0" style={{ color: "#d4af37" }} />
              <div className="flex flex-col leading-tight">
                <span className="opacity-70">آخر تسجيل دخول</span>
                <span className="text-white/80 text-xs mt-0.5">{formatLastLogin(dbUser?.lastLoginAt)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sign out */}
        <Button
          variant="ghost"
          className="w-full justify-start text-white/60 hover:text-white hover:bg-white/10 text-xs font-medium rounded-xl transition-all duration-200"
          onClick={() => { localStorage.removeItem("najran_session"); signOut(); }}
        >
          <LogOut className="ml-2 h-3.5 w-3.5 rotate-180" style={{ color: "#f87171" }} />
          <span>تسجيل الخروج</span>
        </Button>
      </div>
    </div>
  );
}
