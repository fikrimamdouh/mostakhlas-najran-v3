import { Link, useLocation } from "wouter";
import { useUser, useClerk, useAuth } from "@clerk/react";
import { useGetMe, useListUsers } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard, Settings, Users, LogOut, ShieldAlert, ClipboardList,
  Building2, ChevronLeft, BarChart3, Eye,
  ChevronRight, PanelLeftClose, PanelLeftOpen,
  BookOpen, ContactRound, Bell, X, Check, Clock, UserCheck,
  FileCheck2, FileSearch, LayoutGrid, Archive, MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback, useRef, type CSSProperties } from "react";
import { getSiteType, parseAllowedModules, filterModules, VISIT_MODULE_KEYS } from "@/lib/modules";

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

const COLLAPSE_KEY = "sidebar_collapsed";
const READ_NOTIFS_KEY = "najran_read_notifications";

function useNotifications(isAdmin: boolean, pendingUsersCount: number) {
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(READ_NOTIFS_KEY) || "[]")); } catch { return new Set(); }
  });

  const notifications = isAdmin && pendingUsersCount > 0
    ? [{ id: "pending_users", type: "warning" as const, title: "مستخدمون بانتظار الموافقة", body: `يوجد ${pendingUsersCount} مستخدم بانتظار موافقتك`, href: "/admin/users", time: "" }]
    : [];

  const unread = notifications.filter(n => !readIds.has(n.id));

  function markRead(id: string) {
    setReadIds(prev => {
      const next = new Set(prev);
      next.add(id);
      try { localStorage.setItem(READ_NOTIFS_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  function markAllRead() {
    const ids = notifications.map(n => n.id);
    setReadIds(prev => {
      const next = new Set([...prev, ...ids]);
      try { localStorage.setItem(READ_NOTIFS_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  return { notifications, unread, markRead, markAllRead };
}

export function Sidebar() {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { data: dbUser } = useGetMe({ query: { queryKey: ["/api/users/me"], refetchInterval: 60_000 } });
  const [now, setNow] = useState(new Date());
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === "true"; } catch { return false; }
  });
  const [modulesOpen, setModulesOpen] = useState(true);
  const [visitsOpen, setVisitsOpen] = useState(true);
  const [extractsOpen, setExtractsOpen] = useState(true);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifAnim, setNotifAnim] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const bellBtnRef = useRef<HTMLButtonElement>(null);
  const hospitalBtnRef = useRef<HTMLButtonElement>(null);
  const hospitalMenuRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({});
  const [hospitalDropdownStyle, setHospitalDropdownStyle] = useState<CSSProperties>({});
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
   function handleClick(e: MouseEvent) {
  const target = e.target as Node;

  const clickedNotif =
    (notifRef.current && notifRef.current.contains(target)) ||
    (bellBtnRef.current && bellBtnRef.current.contains(target));

  const clickedHospital =
    (hospitalMenuRef.current && hospitalMenuRef.current.contains(target)) ||
    (hospitalBtnRef.current && hospitalBtnRef.current.contains(target));

  if (!clickedNotif) {
    setNotifAnim(false);
    setTimeout(() => setNotifOpen(false), 180);
  }

  if (!clickedHospital) {
    setShowHospitalMenu(false);
  }
}

  function openNotif() {
    setShowHospitalMenu(false);
    if (notifOpen) {
      setNotifAnim(false);
      setTimeout(() => setNotifOpen(false), 180);
      return;
    }
    if (bellBtnRef.current) {
      const rect = bellBtnRef.current.getBoundingClientRect();
      const dropW = 320;
      const viewW = window.innerWidth;
      const viewH = window.innerHeight;
      let left = collapsed ? rect.right + 8 : rect.left;
      if (left + dropW > viewW - 8) left = viewW - dropW - 8;
      if (left < 8) left = 8;
      let top = rect.bottom + 6;
      const maxH = 420;
      if (top + maxH > viewH - 8) top = rect.top - maxH - 6;
      setDropdownStyle({ position: "fixed", top, left, width: dropW, zIndex: 100000, direction: "rtl" });
    }
    setNotifOpen(true);
    setTimeout(() => setNotifAnim(true), 10);
  }
  function openHospitalMenu() {
    setNotifAnim(false);
    setNotifOpen(false);

    if (showHospitalMenu) {
      setShowHospitalMenu(false);
      return;
    }

    if (hospitalBtnRef.current) {
      const rect = hospitalBtnRef.current.getBoundingClientRect();
      const dropW = collapsed ? 220 : Math.max(rect.width, 220);
      const viewW = window.innerWidth;
      const viewH = window.innerHeight;

      let left = rect.left;
      if (left + dropW > viewW - 8) left = viewW - dropW - 8;
      if (left < 8) left = 8;

      let top = rect.bottom + 6;
      const maxH = 300;
      if (top + maxH > viewH - 8) top = rect.top - maxH - 6;

      setHospitalDropdownStyle({
        position: "fixed",
        top,
        left,
        width: dropW,
        zIndex: 99999,
        direction: "rtl"
      });
    }

    setShowHospitalMenu(true);
  }
  const toggleCollapse = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSE_KEY, String(next)); } catch {}
      return next;
    });
  }, []);

  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [switchingHospital, setSwitchingHospital] = useState<string | null>(null);
  const [showHospitalMenu, setShowHospitalMenu] = useState(false);

  const parsedHospitals: string[] = (() => {
    try { return JSON.parse((dbUser as any)?.hospitals || "[]"); } catch { return []; }
  })();
  const multiHospital = parsedHospitals.length > 1;

  const handleSwitchHospital = async (h: string) => {
    if (h === dbUser?.hospital || switchingHospital) return;
    setSwitchingHospital(h);
    setShowHospitalMenu(false);

    queryClient.setQueryData(["/api/users/me"], (old: any) => old ? { ...old, hospital: h } : old);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);
      const token = await getToken();
      await fetch("/api/users/me/hospital", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ hospital: h }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      try {
        const raw = localStorage.getItem("najran_session");
        if (raw) {
          const sess = JSON.parse(raw);
          sess.hospital = h;
          localStorage.setItem("najran_session", JSON.stringify(sess));
        }
        localStorage.setItem("hospitalName", h);
      } catch {}
      try { window.dispatchEvent(new CustomEvent("najranHospitalChanged", { detail: { hospital: h } })); } catch {}
      queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
    } catch {
      queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
    } finally {
      setSwitchingHospital(null);
    }
  };

  const isAdmin = dbUser?.role === "admin";
  const isSupervisor = dbUser?.role === "supervisor";
  const isContractSup = dbUser?.role === "contract_supervisor";
  const isViewer = dbUser?.role === "viewer";
  const role = dbUser?.role ?? "user";

  const siteType = getSiteType(dbUser?.hospital);
  const allowedModuleKeys = parseAllowedModules((dbUser as any)?.allowedModules);
  const userCompany = (dbUser as any)?.company as string | undefined;
  const allVisibleModules = filterModules(siteType, allowedModuleKeys, role, userCompany);
  const visitKeys = new Set(VISIT_MODULE_KEYS);
  const visibleVisits = allVisibleModules.filter(m => visitKeys.has(m.key));
  const visibleModules = allVisibleModules.filter(m => m.key !== "approval" && !visitKeys.has(m.key));

  const groupKeys = {
    settings: new Set(["settings_main", "settings_advanced"]),
    labor: new Set(["attendance", "performance", "achievement", "health_centers_attendance", "admin_offices_attendance"]),
    consumables: new Set(["consumables", "health_centers_consumables", "admin_offices_consumables"]),
    spareParts: new Set(["spare_parts"]),
    specialSites: new Set(["najran_general"]),
  };

  const groupedModules = [
    { title: "إعدادات العقد والموقع", modules: visibleModules.filter(m => groupKeys.settings.has(m.key)) },
    { title: "مستخلص العمالة", modules: visibleModules.filter(m => groupKeys.labor.has(m.key)) },
    { title: "مستخلص المستهلكات", modules: visibleModules.filter(m => groupKeys.consumables.has(m.key)) },
    { title: "مستخلص قطع الغيار", modules: visibleModules.filter(m => groupKeys.spareParts.has(m.key)) },
    { title: "مواقع خاصة", modules: visibleModules.filter(m => groupKeys.specialSites.has(m.key)) },
    {
      title: "وحدات أخرى",
      modules: visibleModules.filter(m =>
        !groupKeys.settings.has(m.key) &&
        !groupKeys.labor.has(m.key) &&
        !groupKeys.consumables.has(m.key) &&
        !groupKeys.spareParts.has(m.key) &&
        !groupKeys.specialSites.has(m.key)
      ),
    },
  ].filter(g => g.modules.length > 0);

  const { data: usersData } = useListUsers(
    { status: "pending" },
    { query: { queryKey: ["/api/users", "pending"], enabled: isAdmin, refetchInterval: 60000 } }
  );
  const pendingUsersCount = isAdmin ? (usersData?.users?.length ?? 0) : 0;
  const { notifications, unread, markRead, markAllRead } = useNotifications(isAdmin, pendingUsersCount);
  const initials = (dbUser?.name || user?.fullName || "م").charAt(0);

  const handleSignOut = async () => {
  try {
    const syncFn = (window as any).najranSyncNow;

    if (typeof syncFn === "function") {
      const syncResult = await Promise.race([
        syncFn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("SYNC_TIMEOUT")), 15000)
        ),
      ]) as any;

      if (!syncResult || syncResult.ok !== true) {
        throw new Error("SYNC_NOT_CONFIRMED");
      }

      await new Promise(resolve => setTimeout(resolve, 300));
    } else {
      console.warn(
        "[logout] najranSyncNow غير متاح في نافذة React الرئيسية؛ سيتم تسجيل الخروج اعتمادًا على الحفظ المحلي/المزامنة داخل صفحات original."
      );
    }

    localStorage.removeItem("najran_session");
    sessionStorage.removeItem("najran_prereg");
    localStorage.removeItem("hospitalName");
    localStorage.removeItem("companyName");
    localStorage.removeItem("contractNumber");
    localStorage.removeItem("contractDetails");
    localStorage.removeItem("persistentContractData");
    localStorage.removeItem("persistentExtractData");

    queryClient.clear();
    await signOut({ redirectUrl: "/sign-in" });

  } catch (error) {
    console.error("فشل رفع البيانات قبل تسجيل الخروج:", error);

    const proceed = window.confirm(
      "تعذر تأكيد الرفع السحابي الآن، لكن البيانات محفوظة محليًا داخل المتصفح.\n\nهل تريد تسجيل الخروج على أي حال؟"
    );

    if (!proceed) return;

    localStorage.removeItem("najran_session");
    sessionStorage.removeItem("najran_prereg");
    localStorage.removeItem("hospitalName");
    localStorage.removeItem("companyName");
    localStorage.removeItem("contractNumber");
    localStorage.removeItem("contractDetails");
    localStorage.removeItem("persistentContractData");
    localStorage.removeItem("persistentExtractData");

    queryClient.clear();
    await signOut({ redirectUrl: "/sign-in" });
  }
};
  const mainNav = [
    ...(!isViewer ? [{ name: "لوحة القيادة", href: "/dashboard", icon: LayoutDashboard }] : []),
    ...(isViewer ? [{ name: "لوحة المراقبة", href: "/viewer", icon: Eye }] : []),
    ...(!isViewer ? [
      { name: "سجل جهات الاتصال", href: "/contacts", icon: ContactRound },
      { name: "الإعدادات", href: "/settings", icon: Settings },
    ] : []),
  ];

  const adminNav = [
    ...(isAdmin || isSupervisor || (allowedModuleKeys !== null && allowedModuleKeys.includes("support")) ? [
      { name: "مذكرة الدعم", href: "/support", icon: MessageSquare },
    ] : []),
    ...(isAdmin ? [
      { name: "تأسيس العقد", href: "/original-viewer?page=contract-foundation-upload.html", icon: FileCheck2 },
      { name: "إدارة المستخدمين", href: "/admin/users", icon: ShieldAlert },
      { name: "ربط المستخدمين بالمستشفيات", href: "/admin/hospitals", icon: Building2 },
      { name: "النسخ الاحتياطي", href: "/admin/backup", icon: BookOpen },
      { name: "إحصائيات المستخلصات", href: "/admin/extracts-stats", icon: BarChart3 },
      { name: "سجل المراقبة", href: "/admin/audit", icon: ClipboardList },
      { name: "قائمة المستخدمين", href: "/admin/users-view", icon: Users },
      { name: "الإشعارات والبريد", href: "/admin/notifications", icon: Bell },
    ] : []),
    ...(isContractSup ? [{ name: "لوحة مشرف العقد", href: "/contract-supervisor", icon: Building2 }] : []),
  ];

  const extractsNav = [
    ...(!isViewer ? [{ name: "مراجعة المستخلص", file: "review_extract.html", icon: FileSearch }] : []),
    ...(isAdmin || isSupervisor || (allowedModuleKeys !== null && allowedModuleKeys.includes("approval")) ? [
      { name: "اعتماد المستخلص", file: "approval.html", icon: FileCheck2 },
    ] : []),
    ...(isAdmin || isSupervisor || isContractSup || isViewer ? [
      { name: "النظرة الشاملة", file: "monthly-overview.html", icon: LayoutGrid },
    ] : []),
    { name: "أرشيف المستخلص", file: "extract-archive.html", icon: Archive },
  ];

  const hasAdminNav = adminNav.length > 0;

  function isModuleActive(file: string) {
    const search = location.split("?")[1] || "";
    return location.startsWith("/original-viewer") && new URLSearchParams(search).get("page") === file;
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
            isActive ? "text-[#1a3660] font-bold shadow-md" : "text-white/70 hover:text-white hover:bg-white/10"
          )}
          style={isActive ? { background: "linear-gradient(135deg, #d4af37 0%, #e8c84a 100%)", boxShadow: "0 3px 10px rgba(212,175,55,0.3)" } : {}}
        >
          <item.icon className={cn("flex-shrink-0", collapsed ? "h-5 w-5" : "h-4 w-4")} style={isActive ? { color: "#1a3660" } : { color: "rgba(255,255,255,0.55)" }} />
          {!collapsed && <span className="flex-1 truncate">{item.name}</span>}
          {!collapsed && isActive && <ChevronLeft className="h-3 w-3 opacity-50 flex-shrink-0" style={{ color: "#1a3660" }} />}
          {collapsed && (
            <div className="absolute right-full mr-2 px-2 py-1 text-xs rounded-md bg-gray-900 text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
              {item.name}
            </div>
          )}
        </div>
      </Link>
    );
  };

  const ModuleItem = ({ m }: { m: any }) => {
    const isActive = isModuleActive(m.file);
    const href = `/original-viewer?page=${m.file}`;
    return (
      <Link key={m.key} href={href}>
        <div
          title={collapsed ? m.label : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-150 cursor-pointer group relative",
            collapsed ? "justify-center px-2" : "",
            isActive ? "text-[#1a3660] font-bold shadow-md" : "text-white/65 hover:text-white hover:bg-white/10"
          )}
          style={isActive ? { background: "linear-gradient(135deg, #d4af37 0%, #e8c84a 100%)", boxShadow: "0 2px 8px rgba(212,175,55,0.3)" } : {}}
        >
          <m.icon className={cn("flex-shrink-0", collapsed ? "h-5 w-5" : "h-4 w-4")} style={isActive ? { color: "#1a3660" } : { color: "rgba(255,255,255,0.65)" }} />
          {!collapsed && <span className="flex-1 truncate leading-tight">{m.label}</span>}
          {collapsed && (
            <div className="absolute right-full mr-2 px-2 py-1 text-xs rounded-md bg-gray-900 text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
              {m.label}
            </div>
          )}
        </div>
      </Link>
    );
  };

  return (
    <aside
      className="flex flex-col h-screen flex-shrink-0 overflow-hidden transition-all duration-300 relative"
      style={{
        width: collapsed ? 56 : 230,
        minWidth: collapsed ? 56 : 230,
        background: "linear-gradient(180deg, #0f2050 0%, #1e3c72 50%, #2a5298 100%)",
        direction: "rtl",
        boxShadow: "2px 0 20px rgba(0,0,0,0.25)",
        zIndex: 40,
      }}
    >
      <button
        onClick={toggleCollapse}
        title={collapsed ? "توسيع القائمة" : "طي القائمة"}
        className="absolute top-2 left-2 z-50 rounded-lg p-1.5 transition-all hover:bg-white/10"
        style={{ color: "rgba(255,255,255,0.5)" }}
      >
        {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
      </button>

      <div className={cn("flex items-center gap-2.5 px-3 pt-3 pb-2 border-b", collapsed ? "justify-center px-2" : "")} style={{ borderColor: "rgba(255,255,255,0.1)", minHeight: 52 }}>
        <div className="flex-shrink-0 w-8 h-8 rounded-lg overflow-hidden shadow-md" style={{ background: "#fff" }}>
          <img src="/original/najran_health_cluster_logo.png" alt="شعار" className="w-full h-full object-cover" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-xs font-bold leading-tight text-white truncate">تجمع نجران الصحي</p>
            <p className="text-[10px] leading-tight truncate" style={{ color: "rgba(212,175,55,0.8)" }}>وحدة الصيانة العامة</p>
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="px-3 py-1.5 text-center" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="text-base font-bold tabular-nums" style={{ color: "#d4af37" }}>{formatTime(now)}</div>
          <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>{formatDateShort(now)}</div>
        </div>
      )}

      {dbUser?.hospital && multiHospital && (
        <div className="px-2 py-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="relative">
            {!collapsed && <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5 px-1" style={{ color: "rgba(212,175,55,0.6)" }}>الموقع الحالي</p>}
           <button
  ref={hospitalBtnRef}
  onClick={openHospitalMenu}
  disabled={!!switchingHospital}
              title={collapsed ? dbUser.hospital : undefined}
              className={cn("w-full flex items-center gap-2 rounded-lg px-2.5 py-2 transition-all hover:bg-white/10", collapsed ? "justify-center px-2" : "")}
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
            >
              <span style={{ fontSize: 15 }}>🏥</span>
              {!collapsed && <span className="flex-1 text-right text-xs font-semibold text-white truncate">{switchingHospital ? `⏳ ${switchingHospital}` : dbUser.hospital}</span>}
              {!collapsed && <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "rgba(255,255,255,0.4)", transform: showHospitalMenu ? "rotate(270deg)" : "rotate(90deg)", transition: "transform 0.2s" }} />}
            </button>
            {showHospitalMenu && (
<div
  ref={hospitalMenuRef}
  className="rounded-xl overflow-hidden shadow-2xl"
  style={{
    ...hospitalDropdownStyle,
    background: "#0f2050",
    border: "1px solid rgba(255,255,255,0.15)"
  }}
>                <p className="text-[9px] px-3 py-2 font-bold uppercase tracking-widest" style={{ color: "rgba(212,175,55,0.7)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>اختر الموقع</p>
                {parsedHospitals.map((h) => (
                  <button key={h} onClick={() => handleSwitchHospital(h)} className="w-full text-right px-3 py-2.5 text-xs transition-all flex items-center gap-2 hover:bg-white/10" style={{ color: h === dbUser.hospital ? "#d4af37" : "rgba(255,255,255,0.8)", background: h === dbUser.hospital ? "rgba(212,175,55,0.12)" : "transparent", fontWeight: h === dbUser.hospital ? 700 : 400, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <span>{h === dbUser.hospital ? "✓" : "○"}</span>
                    <span className="flex-1 truncate">{h}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="px-2 pt-1 pb-0.5" style={{ position: "relative", zIndex: 50 }}>
          <button
            ref={bellBtnRef}
            onClick={openNotif}
            title={collapsed ? "الإشعارات" : undefined}
            className={cn("w-full flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-150 cursor-pointer group", collapsed ? "justify-center px-2" : "", notifOpen ? "bg-white/10 text-white" : "text-white/70 hover:text-white hover:bg-white/10")}
          >
            <div className="relative flex-shrink-0">
              <Bell className={cn(collapsed ? "h-5 w-5" : "h-4 w-4")} style={{ color: unread.length > 0 ? "#d4af37" : "rgba(255,255,255,0.55)" }} />
              {unread.length > 0 && <span className="absolute -top-1 -left-1 min-w-[14px] h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ background: "#ef4444", padding: "0 3px" }}>{unread.length}</span>}
            </div>
            {!collapsed && <span className="flex-1 text-right">الإشعارات</span>}
          </button>

          {notifOpen && (
            <div ref={notifRef} className="rounded-2xl shadow-2xl overflow-hidden" style={{ ...dropdownStyle, background: "#fff", border: "1px solid #e2e8f0", transformOrigin: "top right", transform: notifAnim ? "scale(1) translateY(0)" : "scale(0.92) translateY(-8px)", opacity: notifAnim ? 1 : 0, transition: "transform 0.2s cubic-bezier(.22,.68,0,1.3), opacity 0.18s ease" }}>
              <div className="flex items-center justify-between px-4 py-3.5" style={{ background: "linear-gradient(135deg,#1e3c72,#2a5298)", color: "#fff" }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)" }}><Bell className="h-3.5 w-3.5" /></div>
                  <span className="font-bold text-sm">الإشعارات</span>
                  {unread.length > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: "#ef4444" }}>{unread.length} جديد</span>}
                </div>
                <div className="flex items-center gap-2">
                  {unread.length > 0 && <button onClick={markAllRead} className="text-[11px] flex items-center gap-1 px-2 py-1 rounded-lg opacity-70 hover:opacity-100 hover:bg-white/10 transition-all"><Check className="h-3 w-3" /><span>قراءة الكل</span></button>}
                  <button onClick={() => { setNotifAnim(false); setTimeout(() => setNotifOpen(false), 180); }} className="w-6 h-6 flex items-center justify-center rounded-lg opacity-70 hover:opacity-100 hover:bg-white/10 transition-all"><X className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              {notifications.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "#f1f5f9" }}><Bell className="h-5 w-5" style={{ color: "#cbd5e1" }} /></div>
                  <p className="text-sm font-medium text-gray-400">لا توجد إشعارات</p>
                </div>
              ) : (
                <div style={{ maxHeight: 320, overflowY: "auto" }}>
                  {notifications.map((n, i) => {
                    const isRead = !unread.find(u => u.id === n.id);
                    return (
                      <Link key={n.id} href={n.href}>
                        <div onClick={() => { markRead(n.id); setNotifAnim(false); setTimeout(() => setNotifOpen(false), 180); }} className="flex gap-3 px-4 py-3.5 cursor-pointer transition-colors" style={{ borderBottom: i < notifications.length - 1 ? "1px solid #f1f5f9" : "none", background: isRead ? "transparent" : "#fefaf0", opacity: isRead ? 0.65 : 1 }}>
                          <div className="mt-0.5 flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center shadow-sm" style={{ background: "linear-gradient(135deg,#fef3c7,#fde68a)" }}><UserCheck className="h-4 w-4" style={{ color: "#d97706" }} /></div>
                          <div className="flex-1 min-w-0"><p className="text-sm font-bold text-gray-800 leading-snug">{n.title}</p><p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.body}</p></div>
                          {!isRead && <div className="mt-2 w-2 h-2 rounded-full flex-shrink-0 ring-2 ring-white" style={{ background: "#ef4444" }} />}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-2 space-y-0.5" style={{ scrollbarWidth: "none" }}>
        {mainNav.map(item => <NavItem key={item.href} item={item} />)}

        {visibleModules.length > 0 && (
          <div className="pt-1">
            {!collapsed && (
              <button onClick={() => setModulesOpen(p => !p)} className="w-full flex items-center justify-between px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all hover:bg-white/5" style={{ color: "rgba(212,175,55,0.7)" }}>
                <span>الوحدات</span>
                {modulesOpen ? <ChevronRight className="h-3 w-3 rotate-90" /> : <ChevronRight className="h-3 w-3" />}
              </button>
            )}
            {(modulesOpen || collapsed) && (
              <div className="space-y-1 mt-0.5">
                {groupedModules.map(group => (
                  <div key={group.title} className="space-y-0.5">
                    {!collapsed && (
                      <div className="px-2.5 pt-1 pb-0.5 text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.38)" }}>
                        {group.title}
                      </div>
                    )}
                    {group.modules.map(m => <ModuleItem key={m.key} m={m} />)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {visibleVisits.length > 0 && (
          <div className="pt-1">
            {!collapsed && (
              <button onClick={() => setVisitsOpen(p => !p)} className="w-full flex items-center justify-between px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all hover:bg-white/5" style={{ color: "rgba(212,175,55,0.7)" }}>
                <span>زيارات مقاولي الباطن</span>
                {visitsOpen ? <ChevronRight className="h-3 w-3 rotate-90" /> : <ChevronRight className="h-3 w-3" />}
              </button>
            )}
            {(visitsOpen || collapsed) && <div className="space-y-0.5 mt-0.5">{visibleVisits.map(m => <ModuleItem key={m.key} m={m} />)}</div>}
          </div>
        )}

        {extractsNav.length > 0 && (
          <div className="pt-1">
            {!collapsed && (
              <button onClick={() => setExtractsOpen(p => !p)} className="w-full flex items-center justify-between px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all hover:bg-white/5" style={{ color: "rgba(212,175,55,0.7)" }}>
                <span>المستخلصات</span>
                {extractsOpen ? <ChevronRight className="h-3 w-3 rotate-90" /> : <ChevronRight className="h-3 w-3" />}
              </button>
            )}
            {(extractsOpen || collapsed) && (
              <div className="space-y-0.5 mt-0.5">
                {extractsNav.map(m => {
                  const isActive = isModuleActive(m.file);
                  const href = `/original-viewer?page=${m.file}`;
                  return (
                    <Link key={m.file} href={href}>
                      <div title={collapsed ? m.name : undefined} className={cn("flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-150 cursor-pointer group relative", collapsed ? "justify-center px-2" : "", isActive ? "text-[#1a3660] font-bold shadow-md" : "text-white/65 hover:text-white hover:bg-white/10")} style={isActive ? { background: "linear-gradient(135deg, #d4af37 0%, #e8c84a 100%)", boxShadow: "0 2px 8px rgba(212,175,55,0.3)" } : {}}>
                        <m.icon className={cn("flex-shrink-0", collapsed ? "h-5 w-5" : "h-4 w-4")} style={isActive ? { color: "#1a3660" } : { color: "rgba(255,255,255,0.65)" }} />
                        {!collapsed && <span className="flex-1 truncate leading-tight">{m.name}</span>}
                        {collapsed && <div className="absolute right-full mr-2 px-2 py-1 text-xs rounded-md bg-gray-900 text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">{m.name}</div>}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {hasAdminNav && (
          <div className="pt-2">
            {!collapsed && <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(212,175,55,0.7)" }}>الإدارة</p>}
            <div className="space-y-0.5">{adminNav.map(item => <NavItem key={item.href} item={item} />)}</div>
          </div>
        )}
      </div>

      <div className="border-t px-2 py-2" style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.15)" }}>
        {!collapsed ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 px-1">
              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: "linear-gradient(135deg,#d4af37,#b8962e)", color: "#fff" }}>{initials}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate leading-tight">{dbUser?.name || user?.fullName || "—"}</p>
                <div className="flex items-center gap-1 mt-0.5"><span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: roleBg(role), color: roleColor(role) }}>{roleLabel(role)}</span></div>
              </div>
            </div>
            {(dbUser as any)?.lastLoginAt && <p className="text-[10px] px-1" style={{ color: "rgba(255,255,255,0.3)" }}>آخر دخول: {formatLastLogin((dbUser as any).lastLoginAt)}</p>}
            <button onClick={handleSignOut} className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all hover:bg-red-500/20" style={{ color: "rgba(255,100,100,0.8)" }}>
              <LogOut className="h-3.5 w-3.5 flex-shrink-0" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background: "linear-gradient(135deg,#d4af37,#b8962e)", color: "#fff" }} title={dbUser?.name || ""}>{initials}</div>
            <button onClick={handleSignOut} title="تسجيل الخروج" className="p-1.5 rounded-lg transition-all hover:bg-red-500/20" style={{ color: "rgba(255,100,100,0.7)" }}><LogOut className="h-4 w-4" /></button>
          </div>
        )}
      </div>
    </aside>
  );
}
