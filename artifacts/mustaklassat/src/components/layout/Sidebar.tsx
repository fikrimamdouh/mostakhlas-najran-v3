import { Link, useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import { useGetMe, useListUsers } from "@workspace/api-client-react";
import {
  LayoutDashboard, Settings, Users, LogOut, ShieldAlert, ClipboardList,
  Building2, ChevronLeft, BarChart3, Eye,
  ChevronRight, PanelLeftClose, PanelLeftOpen,
  BookOpen, ContactRound, Bell, X, Check, Clock, UserCheck,
  FileCheck2, FileSearch, LayoutGrid, Archive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback, useRef, type CSSProperties } from "react";
import { ALL_MODULES, getSiteType, parseAllowedModules, filterModules } from "@/lib/modules";

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
  const { data: dbUser } = useGetMe({ query: { queryKey: ["/api/users/me"] } });
  const [now, setNow] = useState(new Date());
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === "true"; } catch { return false; }
  });
  const [modulesOpen, setModulesOpen] = useState(true);
  const [extractsOpen, setExtractsOpen] = useState(true);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifAnim, setNotifAnim] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const bellBtnRef = useRef<HTMLButtonElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({});

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        notifRef.current && !notifRef.current.contains(e.target as Node) &&
        bellBtnRef.current && !bellBtnRef.current.contains(e.target as Node)
      ) {
        setNotifAnim(false);
        setTimeout(() => setNotifOpen(false), 180);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function openNotif() {
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
      setDropdownStyle({ position: "fixed", top, left, width: dropW, zIndex: 9999, direction: "rtl" });
    }
    setNotifOpen(true);
    setTimeout(() => setNotifAnim(true), 10);
  }

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
  const role = dbUser?.role ?? "user";

  const siteType = getSiteType(dbUser?.hospital);
  const allowedModuleKeys = parseAllowedModules((dbUser as any)?.allowedModules);
  const userCompany = (dbUser as any)?.company as string | undefined;
  const allVisibleModules = filterModules(siteType, allowedModuleKeys, role, userCompany);
  const visibleModules = allVisibleModules;

  const { data: usersData } = useListUsers(
    { status: "pending" },
    {
      query: {
        queryKey: ["/api/users", "pending"],
        enabled: isAdmin,
        refetchInterval: 60000,
      },
    }
  );
  const pendingUsersCount = isAdmin ? (usersData?.users?.length ?? 0) : 0;
  const { notifications, unread, markRead, markAllRead } = useNotifications(isAdmin, pendingUsersCount);

  const initials = (dbUser?.name || user?.fullName || "م").charAt(0);

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
      { name: "ربط المستخدمين بالمستشفيات", href: "/admin/hospitals", icon: Building2 },
      { name: "النسخ الاحتياطي", href: "/admin/backup", icon: BookOpen },
      { name: "إحصائيات المستخلصات", href: "/admin/extracts-stats", icon: BarChart3 },
      { name: "سجل المراقبة", href: "/admin/audit", icon: ClipboardList },
      { name: "قائمة المستخدمين", href: "/admin/users-view", icon: Users },
      { name: "الإشعارات والبريد", href: "/admin/notifications", icon: Bell },
    ] : []),
    ...(isContractSup ? [
      { name: "لوحة مشرف العقد", href: "/contract-supervisor", icon: Building2 },
    ] : []),
  ];

  // قسم المستخلصات — مرتّب حسب سير العمل الوظيفي
  const extractsNav = [
    // 1. مراجعة المستخلص — أول خطوة: المستخدم يراجع ويرفع
    ...(!isViewer ? [
      { name: "مراجعة المستخلص", file: "review_extract.html", icon: FileSearch },
    ] : []),
    // 2. اعتماد المستخلص — ثاني خطوة: المشرف / المدير يعتمد
    ...(isAdmin || isSupervisor ? [
      { name: "اعتماد المستخلص", file: "approval.html", icon: FileCheck2 },
    ] : []),
    // 3. النظرة الشاملة — لمن يحتاج متابعة كلية
    ...(isAdmin || isSupervisor || isContractSup || isViewer ? [
      { name: "النظرة الشاملة", file: "monthly-overview.html", icon: LayoutGrid },
    ] : []),
    // 4. أرشيف المستخلص — متاح للجميع
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
      {/* Collapse toggle */}
      <button
        onClick={toggleCollapse}
        title={collapsed ? "توسيع القائمة" : "طي القائمة"}
        className="absolute top-2 left-2 z-50 rounded-lg p-1.5 transition-all hover:bg-white/10"
        style={{ color: "rgba(255,255,255,0.5)" }}
      >
        {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
      </button>

      {/* Header: Logo + Title */}
      <div className={cn(
        "flex items-center gap-2.5 px-3 pt-3 pb-2 border-b",
        collapsed ? "justify-center px-2" : ""
      )}
        style={{ borderColor: "rgba(255,255,255,0.1)", minHeight: 52 }}
      >
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

      {/* Clock + Date */}
      {!collapsed && (
        <div className="px-3 py-1.5 text-center" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="text-base font-bold tabular-nums" style={{ color: "#d4af37" }}>{formatTime(now)}</div>
          <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>{formatDateShort(now)}</div>
        </div>
      )}

      {/* Notifications bell — outside scroll container to avoid overflow clipping */}
      {isAdmin && (
        <div className="px-2 pt-1 pb-0.5" style={{ position: "relative", zIndex: 50 }}>
          <button
            ref={bellBtnRef}
            onClick={openNotif}
            title={collapsed ? "الإشعارات" : undefined}
            className={cn(
              "w-full flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-150 cursor-pointer group",
              collapsed ? "justify-center px-2" : "",
              notifOpen ? "bg-white/10 text-white" : "text-white/70 hover:text-white hover:bg-white/10"
            )}
          >
            <div className="relative flex-shrink-0">
              <Bell className={cn(collapsed ? "h-5 w-5" : "h-4 w-4")} style={{ color: unread.length > 0 ? "#d4af37" : "rgba(255,255,255,0.55)" }} />
              {unread.length > 0 && (
                <span className="absolute -top-1 -left-1 min-w-[14px] h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                  style={{ background: "#ef4444", padding: "0 3px" }}>
                  {unread.length}
                </span>
              )}
            </div>
            {!collapsed && <span className="flex-1 text-right">الإشعارات</span>}
            {collapsed && (
              <div className="absolute right-full mr-2 px-2 py-1 text-xs rounded-md bg-gray-900 text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg" style={{ zIndex: 200 }}>
                الإشعارات {unread.length > 0 ? `(${unread.length})` : ""}
              </div>
            )}
          </button>

          {/* Notifications Dropdown — position:fixed to never get clipped */}
          {notifOpen && (
            <div
              ref={notifRef}
              className="rounded-2xl shadow-2xl overflow-hidden"
              style={{
                ...dropdownStyle,
                background: "#fff",
                border: "1px solid #e2e8f0",
                transformOrigin: "top right",
                transform: notifAnim ? "scale(1) translateY(0)" : "scale(0.92) translateY(-8px)",
                opacity: notifAnim ? 1 : 0,
                transition: "transform 0.2s cubic-bezier(.22,.68,0,1.3), opacity 0.18s ease",
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3.5"
                style={{ background: "linear-gradient(135deg,#1e3c72,#2a5298)", color: "#fff" }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)" }}>
                    <Bell className="h-3.5 w-3.5" />
                  </div>
                  <span className="font-bold text-sm">الإشعارات</span>
                  {unread.length > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: "#ef4444" }}>
                      {unread.length} جديد
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {unread.length > 0 && (
                    <button onClick={markAllRead}
                      className="text-[11px] flex items-center gap-1 px-2 py-1 rounded-lg opacity-70 hover:opacity-100 hover:bg-white/10 transition-all"
                      title="تحديد الكل كمقروء">
                      <Check className="h-3 w-3" />
                      <span>قراءة الكل</span>
                    </button>
                  )}
                  <button onClick={() => { setNotifAnim(false); setTimeout(() => setNotifOpen(false), 180); }}
                    className="w-6 h-6 flex items-center justify-center rounded-lg opacity-70 hover:opacity-100 hover:bg-white/10 transition-all">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Body */}
              {notifications.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "#f1f5f9" }}>
                    <Bell className="h-5 w-5" style={{ color: "#cbd5e1" }} />
                  </div>
                  <p className="text-sm font-medium text-gray-400">لا توجد إشعارات</p>
                  <p className="text-xs text-gray-300 mt-1">كل شيء على ما يرام ✓</p>
                </div>
              ) : (
                <div style={{ maxHeight: 320, overflowY: "auto" }}>
                  {notifications.map((n, i) => {
                    const isRead = !unread.find(u => u.id === n.id);
                    return (
                      <Link key={n.id} href={n.href}>
                        <div
                          onClick={() => { markRead(n.id); setNotifAnim(false); setTimeout(() => setNotifOpen(false), 180); }}
                          className="flex gap-3 px-4 py-3.5 cursor-pointer transition-colors"
                          style={{
                            borderBottom: i < notifications.length - 1 ? "1px solid #f1f5f9" : "none",
                            background: isRead ? "transparent" : "#fefaf0",
                            opacity: isRead ? 0.65 : 1,
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                          onMouseLeave={e => (e.currentTarget.style.background = isRead ? "transparent" : "#fefaf0")}
                        >
                          <div className="mt-0.5 flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center shadow-sm"
                            style={{ background: n.type === "warning" ? "linear-gradient(135deg,#fef3c7,#fde68a)" : "linear-gradient(135deg,#dbeafe,#bfdbfe)" }}>
                            {n.type === "warning"
                              ? <UserCheck className="h-4 w-4" style={{ color: "#d97706" }} />
                              : <Clock className="h-4 w-4" style={{ color: "#2563eb" }} />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-800 leading-snug">{n.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.body}</p>
                          </div>
                          {!isRead && (
                            <div className="mt-2 w-2 h-2 rounded-full flex-shrink-0 ring-2 ring-white" style={{ background: "#ef4444" }} />
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* Footer */}
              <div className="px-4 py-2.5 text-center" style={{ borderTop: "1px solid #f1f5f9", background: "#fafbff" }}>
                <Link href="/admin/users">
                  <span className="text-xs font-semibold cursor-pointer hover:underline" style={{ color: "#2a5298" }}
                    onClick={() => { setNotifAnim(false); setTimeout(() => setNotifOpen(false), 180); }}>
                    عرض إدارة المستخدمين ←
                  </span>
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Scrollable nav */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-2 space-y-0.5" style={{ scrollbarWidth: "none" }}>

        {/* Main nav */}
        {mainNav.map(item => <NavItem key={item.href} item={item} />)}

        {/* Modules section */}
        {visibleModules.length > 0 && (
          <div className="pt-1">
            {!collapsed && (
              <button
                onClick={() => setModulesOpen(p => !p)}
                className="w-full flex items-center justify-between px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all hover:bg-white/5"
                style={{ color: "rgba(212,175,55,0.7)" }}
              >
                <span>الوحدات</span>
                {modulesOpen ? <ChevronRight className="h-3 w-3 rotate-90" /> : <ChevronRight className="h-3 w-3" />}
              </button>
            )}
            {(modulesOpen || collapsed) && (
              <div className="space-y-0.5 mt-0.5">
                {visibleModules.map(m => {
                  const isActive = isModuleActive(m.file);
                  const href = `/original-viewer?page=${m.file}`;
                  return (
                    <Link key={m.key} href={href}>
                      <div
                        title={collapsed ? m.label : undefined}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-150 cursor-pointer group relative",
                          collapsed ? "justify-center px-2" : "",
                          isActive
                            ? "text-[#1a3660] font-bold shadow-md"
                            : "text-white/65 hover:text-white hover:bg-white/10"
                        )}
                        style={isActive ? {
                          background: "linear-gradient(135deg, #d4af37 0%, #e8c84a 100%)",
                          boxShadow: "0 2px 8px rgba(212,175,55,0.3)",
                        } : {}}
                      >
                        <m.icon
                          className={cn("flex-shrink-0", collapsed ? "h-5 w-5" : "h-4 w-4")}
                          style={isActive ? { color: "#1a3660" } : { color: "rgba(255,255,255,0.65)" }}
                        />
                        {!collapsed && (
                          <span className="flex-1 truncate leading-tight">{m.label}</span>
                        )}
                        {collapsed && (
                          <div className="absolute right-full mr-2 px-2 py-1 text-xs rounded-md bg-gray-900 text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                            {m.label}
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Extracts section */}
        {extractsNav.length > 0 && (
          <div className="pt-1">
            {!collapsed && (
              <button
                onClick={() => setExtractsOpen(p => !p)}
                className="w-full flex items-center justify-between px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all hover:bg-white/5"
                style={{ color: "rgba(212,175,55,0.7)" }}
              >
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
                      <div
                        title={collapsed ? m.name : undefined}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-150 cursor-pointer group relative",
                          collapsed ? "justify-center px-2" : "",
                          isActive
                            ? "text-[#1a3660] font-bold shadow-md"
                            : "text-white/65 hover:text-white hover:bg-white/10"
                        )}
                        style={isActive ? {
                          background: "linear-gradient(135deg, #d4af37 0%, #e8c84a 100%)",
                          boxShadow: "0 2px 8px rgba(212,175,55,0.3)",
                        } : {}}
                      >
                        <m.icon
                          className={cn("flex-shrink-0", collapsed ? "h-5 w-5" : "h-4 w-4")}
                          style={isActive ? { color: "#1a3660" } : { color: "rgba(255,255,255,0.65)" }}
                        />
                        {!collapsed && (
                          <span className="flex-1 truncate leading-tight">{m.name}</span>
                        )}
                        {collapsed && (
                          <div className="absolute right-full mr-2 px-2 py-1 text-xs rounded-md bg-gray-900 text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                            {m.name}
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Admin section */}
        {hasAdminNav && (
          <div className="pt-2">
            {!collapsed && (
              <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(212,175,55,0.7)" }}>
                الإدارة
              </p>
            )}
            <div className="space-y-0.5">
              {adminNav.map(item => <NavItem key={item.href} item={item} />)}
            </div>
          </div>
        )}
      </div>

      {/* User panel */}
      <div
        className="border-t px-2 py-2"
        style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.15)" }}
      >
        {!collapsed ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 px-1">
              <div
                className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                style={{ background: "linear-gradient(135deg,#d4af37,#b8962e)", color: "#fff" }}
              >
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate leading-tight">
                  {dbUser?.name || user?.fullName || "—"}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                    style={{ background: roleBg(role), color: roleColor(role) }}
                  >
                    {roleLabel(role)}
                  </span>
                </div>
              </div>
            </div>
            {dbUser?.hospital && (
              <p className="text-[10px] px-1 truncate" style={{ color: "rgba(255,255,255,0.4)" }}>
                🏥 {dbUser.hospital}
              </p>
            )}
            {(dbUser as any)?.lastLoginAt && (
              <p className="text-[10px] px-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                آخر دخول: {formatLastLogin((dbUser as any).lastLoginAt)}
              </p>
            )}
            <button
              onClick={() => signOut()}
              className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all hover:bg-red-500/20"
              style={{ color: "rgba(255,100,100,0.8)" }}
            >
              <LogOut className="h-3.5 w-3.5 flex-shrink-0" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#d4af37,#b8962e)", color: "#fff" }}
              title={dbUser?.name || ""}
            >
              {initials}
            </div>
            <button
              onClick={() => signOut()}
              title="تسجيل الخروج"
              className="p-1.5 rounded-lg transition-all hover:bg-red-500/20"
              style={{ color: "rgba(255,100,100,0.7)" }}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
