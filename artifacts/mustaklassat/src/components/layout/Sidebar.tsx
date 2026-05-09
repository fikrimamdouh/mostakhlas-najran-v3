import { Link, useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import { useGetMe } from "@workspace/api-client-react";
import {
  LayoutDashboard, Settings, Users, LogOut, ShieldAlert, ClipboardList,
  Clock, Building2, ChevronLeft, BarChart3, Eye,
  ChevronRight, CalendarDays, PanelLeftClose, PanelLeftOpen,
  BookOpen, ContactRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";

const ARABIC_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
];

function formatDateShort(d: Date) {
  return `${ARABIC_DAYS[d.getDay()]} ${d.getDate()} ${ARABIC_MONTHS[d.getMonth()]}`;
}

function formatTime(d: Date) {
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "م" : "ص";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function formatLastLogin(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "م" : "ص";
  const h12 = h % 12 || 12;
  return `${d.getDate()} ${ARABIC_MONTHS[d.getMonth()]} — ${h12}:${m} ${ampm}`;
}

const roleLabel = (role: string) => {
  if (role === "admin") return "مدير النظام";
  if (role === "supervisor") return "مشرف";
  if (role === "contract_supervisor") return "مشرف عقد";
  if (role === "viewer") return "مراقب";
  return "مستخدم";
};

const roleColor = (role: string) => {
  if (role === "admin") return "#f59e0b";
  if (role === "supervisor") return "#60a5fa";
  if (role === "viewer") return "#c084fc";
  if (role === "contract_supervisor") return "#34d399";
  return "#d4af37";
};

const roleBg = (role: string) => {
  if (role === "admin") return "rgba(245,158,11,0.15)";
  if (role === "supervisor") return "rgba(96,165,250,0.15)";
  if (role === "viewer") return "rgba(192,132,252,0.15)";
  return "rgba(212,175,55,0.12)";
};

function getSiteType(hospital: string | null | undefined): "hospital" | "health_centers" | "admin_offices" {
  if (!hospital) return "hospital";
  if (hospital === "المراكز الصحية") return "health_centers";
  if (hospital === "المكاتب الإدارية") return "admin_offices";
  return "hospital";
}

const ALL_MODULES = [
  { page: "settings_main.html",               label: "الإعدادات الرئيسية",              icon: "⚙️", types: ["hospital", "health_centers", "admin_offices"] },
  { page: "settings_advanced.html",           label: "الإعدادات المتقدمة",              icon: "🔧", types: ["hospital", "health_centers", "admin_offices"] },
  { page: "attendance.html",                  label: "الحضور والانصراف",                icon: "📋", types: ["hospital"] },
  { page: "performance.html",                 label: "جداول الأداء",                    icon: "📊", types: ["hospital"] },
  { page: "achievement.html",                 label: "شهادة الإنجاز",                   icon: "🏆", types: ["hospital"] },
  { page: "consumables.html",                 label: "مستخلص المستهلكات",               icon: "🧪", types: ["hospital"] },
  { page: "spare_parts.html",                 label: "مستخلص قطع الغيار",               icon: "🔩", types: ["hospital"] },
  { page: "approval.html",                    label: "اعتماد المستخلص",                 icon: "✅", types: ["hospital"] },
  { page: "monthly-overview.html",            label: "النظرة الشاملة",                  icon: "📈", types: ["hospital"] },
  { page: "request-visit.html",               label: "تسجيل الزيارات",                  icon: "🏥", types: ["hospital"] },
  { page: "health_centers_attendance.html",   label: "المراكز — العمالة",               icon: "👷", types: ["health_centers"] },
  { page: "health_centers_consumables.html",  label: "المراكز — المستهلكات",            icon: "🧪", types: ["health_centers"] },
  { page: "admin_offices_attendance.html",    label: "المكاتب — العمالة",               icon: "👷", types: ["admin_offices"] },
  { page: "admin_offices_consumables.html",   label: "المكاتب — المستهلكات",            icon: "🧪", types: ["admin_offices"] },
  { page: "review_extract.html",              label: "مراجعة المستخلص",                 icon: "🔍", types: ["hospital", "health_centers", "admin_offices"] },
  { page: "extract-archive.html",             label: "أرشيف المستخلصات",                icon: "🗂️", types: ["hospital", "health_centers", "admin_offices"] },
] as const;

const COLLAPSE_KEY = "sidebar_collapsed";

export function Sidebar() {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { data: dbUser } = useGetMe({ query: { queryKey: ["/api/users/me"] } });
  const [now, setNow] = useState(new Date());
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === "true"; } catch { return false; }
  });
  const [modulesOpen, setModulesOpen] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const toggleCollapse = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSE_KEY, String(next)); } catch {}
      return next;
    });
  }, []);

  const isAdmin = dbUser?.role === "admin";
  const isSupervisor = dbUser?.role === "supervisor";
  const isContractSup = dbUser?.role === "contract_supervisor";
  const isViewer = dbUser?.role === "viewer";
  const canViewAudit = isAdmin || isSupervisor;

  const siteType = getSiteType(dbUser?.hospital);

  // Parse allowedModules: null → all permitted, array → only listed keys
  let allowedModuleKeys: string[] | null = null;
  try {
    const raw = (dbUser as any)?.allowedModules;
    allowedModuleKeys = raw ? JSON.parse(raw) : null;
  } catch { allowedModuleKeys = null; }

  const mainNav = [
    ...(!isViewer ? [
      { name: "لوحة القيادة", href: "/dashboard", icon: LayoutDashboard },
    ] : []),
    ...(isViewer ? [
      { name: "لوحة المراقبة", href: "/viewer", icon: Eye },
    ] : []),
    ...(!isViewer ? [
      { name: "سجل جهات الاتصال", href: "/contacts", icon: ContactRound },
      { name: "الإعدادات", href: "/settings", icon: Settings },
    ] : []),
  ];

  const adminNav = [
    ...(isAdmin ? [
      { name: "إدارة المستخدمين", href: "/admin/users", icon: ShieldAlert },
      { name: "النسخ الاحتياطي", href: "/admin/backup", icon: BookOpen },
    ] : []),
    ...(canViewAudit ? [
      { name: "إحصائيات المستخلصات", href: "/admin/extracts-stats", icon: BarChart3 },
      { name: "سجل المراقبة", href: "/admin/audit", icon: ClipboardList },
      { name: "قائمة المستخدمين", href: "/admin/users-view", icon: Users },
    ] : []),
    ...(isContractSup ? [
      { name: "لوحة مشرف العقد", href: "/contract-supervisor", icon: Building2 },
    ] : []),
  ];

  const hasAdminNav = adminNav.length > 0;

  const visibleModules = (() => {
    // Step 1: filter by site type (unless admin/supervisor/contract_sup who sees all)
    const byType = (isAdmin || isSupervisor || isContractSup)
      ? ALL_MODULES
      : ALL_MODULES.filter(m => (m.types as readonly string[]).includes(siteType));

    // Step 2: filter by allowedModules if set (null = all allowed)
    // Admins and supervisors bypass module restrictions
    if (allowedModuleKeys !== null && !isAdmin && !isSupervisor) {
      const keySet = new Set(allowedModuleKeys);
      return byType.filter(m => {
        const key = m.page.replace(".html", "");
        return keySet.has(key);
      });
    }
    return byType;
  })();

  const initials = (dbUser?.name || user?.fullName || "م").charAt(0);
  const role = dbUser?.role ?? "user";

  function isModuleActive(page: string) {
    const search = location.split("?")[1] || "";
    return location.startsWith("/original-viewer") && new URLSearchParams(search).get("page") === page;
  }

  const NavItem = ({ item }: { item: { name: string; href: string; icon: any } }) => {
    const isActive = location.startsWith(item.href);
    return (
      <Link href={item.href}>
        <div
          title={collapsed ? item.name : undefined}
          className={cn(
            "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-150 cursor-pointer group relative",
            collapsed ? "justify-center px-2" : "",
            isActive
              ? "text-[#1a3660] font-bold shadow-md"
              : "text-white/70 hover:text-white hover:bg-white/10"
          )}
          style={isActive ? {
            background: "linear-gradient(135deg, #d4af37 0%, #e8c84a 100%)",
            boxShadow: "0 3px 10px rgba(212,175,55,0.3)",
          } : {}}
        >
          <item.icon
            className={cn("flex-shrink-0", collapsed ? "h-5 w-5" : "h-4 w-4")}
            style={isActive ? { color: "#1a3660" } : { color: "rgba(255,255,255,0.55)" }}
          />
          {!collapsed && <span className="flex-1 truncate">{item.name}</span>}
          {!collapsed && isActive && (
            <ChevronLeft className="h-3 w-3 opacity-50 flex-shrink-0" style={{ color: "#1a3660" }} />
          )}
          {collapsed && (
            <div className="absolute right-full mr-2 px-2 py-1 text-xs rounded-md bg-gray-900 text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
              {item.name}
            </div>
          )}
        </div>
      </Link>
    );
  };

  return (
    <div
      className="flex flex-col h-full text-white relative overflow-hidden flex-shrink-0 transition-all duration-300"
      style={{
        width: collapsed ? "64px" : "256px",
        minWidth: collapsed ? "64px" : "256px",
        background: "linear-gradient(175deg, #0d1e3d 0%, #162f58 35%, #1e3c72 70%, #243d6e 100%)",
        borderLeft: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "4px 0 20px rgba(0,0,0,0.2)",
      }}
    >

      {/* ───── Header: Logo + System Name ───── */}
      <div
        className="flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        {/* Logo row */}
        <div className={cn(
          "flex items-center gap-2.5 px-3 pt-4 pb-3",
          collapsed ? "justify-center" : ""
        )}>
          <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
            <div className="relative flex-shrink-0">
              <div
                className="absolute inset-0 rounded-full opacity-25 blur-sm"
                style={{ background: "#d4af37" }}
              />
              <img
                src="/logo.png"
                alt="تجمع نجران الصحي"
                className="relative h-8 w-8 object-contain drop-shadow-md"
                onError={e => (e.target as HTMLImageElement).style.display = "none"}
              />
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-white leading-tight truncate">
                  تجمع نجران الصحي
                </span>
                <span className="text-[10px] font-medium leading-tight truncate" style={{ color: "#d4af37" }}>
                  نظام إدارة المستخلصات
                </span>
              </div>
            )}
          </Link>
        </div>

        {/* Clock / Date compact row */}
        {!collapsed && (
          <div
            className="mx-3 mb-3 px-3 py-1.5 rounded-lg flex items-center justify-between"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3 flex-shrink-0" style={{ color: "#d4af37" }} />
              <span className="text-xs font-mono font-semibold" style={{ color: "#d4af37" }}>
                {formatTime(now)}
              </span>
            </div>
            <div className="flex items-center gap-1 text-white/45">
              <CalendarDays className="h-3 w-3 flex-shrink-0" />
              <span className="text-[10px]">{formatDateShort(now)}</span>
            </div>
          </div>
        )}
      </div>

      {/* ───── Navigation ───── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2">

        {/* Main nav */}
        <nav className={cn("space-y-0.5", collapsed ? "px-1.5" : "px-2")}>
          {mainNav.map(item => <NavItem key={item.href} item={item} />)}
        </nav>

        {/* Admin / supervisor section */}
        {hasAdminNav && (
          <div className={cn("mt-3", collapsed ? "px-1.5" : "px-2")}>
            {!collapsed && (
              <div className="flex items-center gap-2 mb-1.5 px-1">
                <div className="h-px flex-1 opacity-15" style={{ background: "#d4af37" }} />
                <span className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: "rgba(212,175,55,0.6)" }}>
                  إداري
                </span>
                <div className="h-px flex-1 opacity-15" style={{ background: "#d4af37" }} />
              </div>
            )}
            {collapsed && <div className="h-px mx-1.5 my-2 opacity-15" style={{ background: "#d4af37" }} />}
            <nav className="space-y-0.5">
              {adminNav.map(item => <NavItem key={item.href} item={item} />)}
            </nav>
          </div>
        )}

        {/* System modules */}
        {visibleModules.length > 0 && (
          <div className={cn("mt-3", collapsed ? "px-1.5" : "px-2")}>
            {!collapsed ? (
              <button
                onClick={() => setModulesOpen(p => !p)}
                className="w-full flex items-center gap-2 mb-1.5 px-1 group"
              >
                <div className="h-px flex-1 opacity-15" style={{ background: "#d4af37" }} />
                <span className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: "rgba(212,175,55,0.6)" }}>
                  وحدات النظام
                </span>
                <ChevronRight
                  className="h-3 w-3 transition-transform duration-200 opacity-40"
                  style={{
                    color: "#d4af37",
                    transform: modulesOpen ? "rotate(90deg)" : "rotate(0deg)",
                  }}
                />
                <div className="h-px flex-1 opacity-15" style={{ background: "#d4af37" }} />
              </button>
            ) : (
              <div className="h-px mx-1.5 my-2 opacity-15" style={{ background: "#d4af37" }} />
            )}

            {(modulesOpen || collapsed) && (
              <nav className="space-y-0.5">
                {visibleModules.map(item => {
                  const href = `/original-viewer?page=${item.page}`;
                  const isActive = isModuleActive(item.page);
                  return (
                    <Link key={item.page} href={href}>
                      <div
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          "flex items-center gap-2 rounded-lg py-1.5 text-xs font-medium transition-all duration-150 cursor-pointer group relative",
                          collapsed ? "justify-center px-2" : "px-2.5",
                          isActive
                            ? "text-[#1a3660] font-bold shadow-sm"
                            : "text-white/55 hover:text-white hover:bg-white/10"
                        )}
                        style={isActive ? {
                          background: "linear-gradient(135deg,#d4af37,#e8c84a)",
                          boxShadow: "0 2px 6px rgba(212,175,55,0.25)",
                        } : {}}
                      >
                        {collapsed ? (
                          <span className="text-sm leading-none">{item.icon}</span>
                        ) : (
                          <>
                            <span
                              className="h-1 w-1 rounded-full flex-shrink-0"
                              style={{ background: isActive ? "#1a3660" : "rgba(212,175,55,0.4)" }}
                            />
                            <span className="flex-1 truncate">{item.label}</span>
                          </>
                        )}
                        {collapsed && (
                          <div className="absolute right-full mr-2 px-2 py-1 text-xs rounded-md bg-gray-900 text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                            {item.label}
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>
        )}
      </div>

      {/* ───── User info + collapse toggle ───── */}
      <div
        className="flex-shrink-0"
        style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
      >
        {/* Collapse toggle */}
        <div className={cn(
          "flex items-center px-2 pt-2",
          collapsed ? "justify-center" : "justify-end"
        )}>
          <button
            onClick={toggleCollapse}
            title={collapsed ? "توسيع القائمة" : "تصغير القائمة"}
            className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/10 transition-all duration-150"
          >
            {collapsed
              ? <PanelLeftClose className="h-3.5 w-3.5" />
              : <PanelLeftOpen className="h-3.5 w-3.5" />
            }
          </button>
        </div>

        {/* User card */}
        <div className={cn("p-2", collapsed ? "flex justify-center" : "")}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full font-bold text-sm flex-shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${roleColor(role)}33, ${roleColor(role)}11)`,
                  color: roleColor(role),
                  outline: `1.5px solid ${roleColor(role)}44`,
                  outlineOffset: "1px",
                }}
              >
                {initials}
              </div>
              <button
                onClick={() => { localStorage.removeItem("najran_session"); signOut(); }}
                title="تسجيل الخروج"
                className="p-1 rounded-md text-white/30 hover:text-red-400 hover:bg-white/10 transition-all"
              >
                <LogOut className="h-3.5 w-3.5 rotate-180" />
              </button>
            </div>
          ) : (
            <div
              className="rounded-xl p-2.5"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              {/* Avatar + name */}
              <div className="flex items-center gap-2.5 mb-2">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full font-bold text-sm flex-shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${roleColor(role)}33, ${roleColor(role)}11)`,
                    color: roleColor(role),
                    outline: `1.5px solid ${roleColor(role)}44`,
                    outlineOffset: "1px",
                  }}
                >
                  {initials}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-xs font-semibold text-white truncate leading-tight">
                    {dbUser?.name || user?.fullName}
                  </span>
                  <span
                    className="text-[10px] font-medium mt-0.5 px-1.5 py-0.5 rounded-full inline-block w-fit"
                    style={{ color: roleColor(role), background: roleBg(role) }}
                  >
                    {roleLabel(role)}
                  </span>
                </div>
              </div>

              {/* Compact details */}
              <div className="space-y-1">
                {dbUser?.hospital && (
                  <div className="flex items-center gap-1.5 text-white/45">
                    <Building2 className="h-2.5 w-2.5 flex-shrink-0" style={{ color: "#60a5fa" }} />
                    <span className="text-[10px] truncate">{dbUser.hospital}</span>
                  </div>
                )}
                {dbUser?.lastLoginAt && (
                  <div className="flex items-center gap-1.5 text-white/35">
                    <Clock className="h-2.5 w-2.5 flex-shrink-0" style={{ color: "#d4af37" }} />
                    <span className="text-[10px] truncate">{formatLastLogin(dbUser.lastLoginAt)}</span>
                  </div>
                )}
              </div>

              {/* Sign out */}
              <button
                onClick={() => { localStorage.removeItem("najran_session"); signOut(); }}
                className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-white/8 transition-all duration-150 text-[11px] font-medium"
              >
                <LogOut className="h-3 w-3 rotate-180" style={{ color: "inherit" }} />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
