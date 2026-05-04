import { Link, useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import { useGetMe } from "@workspace/api-client-react";
import {
  LayoutDashboard, Settings, Users, LogOut, ShieldAlert
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function Sidebar() {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { data: dbUser } = useGetMe({ query: { queryKey: ["/api/users/me"] } });

  const isAdmin = dbUser?.role === "admin";

  const navigation = [
    { name: "لوحة القيادة", href: "/dashboard", icon: LayoutDashboard },
    { name: "الإعدادات", href: "/settings", icon: Settings },
    ...(isAdmin ? [{ name: "إدارة المستخدمين", href: "/admin/users", icon: ShieldAlert }] : []),
  ];

  return (
    <div
      className="flex h-full w-64 flex-col text-white"
      style={{
        background: "linear-gradient(180deg, #1e3c72 0%, #2a5298 100%)",
        borderLeft: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      {/* Logo */}
      <div className="flex flex-col items-center py-6 px-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <Link href="/dashboard" className="flex flex-col items-center gap-3 w-full">
          <img
            src="/logo.png"
            alt="تجمع نجران الصحي"
            className="h-16 w-auto drop-shadow-lg"
            onError={e => (e.target as HTMLImageElement).style.display = "none"}
          />
          <div className="text-center">
            <div className="font-bold text-base text-white leading-tight">تجمع نجران الصحي</div>
            <div className="text-xs font-medium mt-0.5" style={{ color: "#d4af37" }}>نظام المستخلصات</div>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-5">
        <nav className="space-y-1 px-3">
          {navigation.map(item => {
            const isActive = location.startsWith(item.href);
            return (
              <Link key={item.name} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer",
                    isActive ? "text-[#1e3c72] font-bold" : "text-white/80 hover:text-white hover:bg-white/10"
                  )}
                  style={isActive ? { background: "linear-gradient(135deg, #d4af37, #b8962e)", boxShadow: "0 4px 12px rgba(212,175,55,0.3)" } : {}}
                >
                  <item.icon
                    className="h-5 w-5 flex-shrink-0"
                    style={isActive ? { color: "#1e3c72" } : { color: "rgba(255,255,255,0.7)" }}
                  />
                  {item.name}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Original system links */}
        <div className="px-3 mt-6">
          <div className="text-xs font-semibold mb-2 px-1" style={{ color: "rgba(212,175,55,0.8)", letterSpacing: "0.05em" }}>
            وحدات النظام
          </div>
          <div className="space-y-1">
            {[
              { href: "/original/settings_main.html",           label: "الإعدادات الرئيسية" },
              { href: "/original/attendance.html",              label: "الحضور والانصراف" },
              { href: "/original/performance.html",             label: "جداول الأداء" },
              { href: "/original/achievement.html",             label: "شهادة الإنجاز" },
              { href: "/original/consumables.html",             label: "مستخلص المستهلكات" },
              { href: "/original/spare_parts.html",             label: "مستخلص قطع الغيار" },
              { href: "/original/approval.html",               label: "اعتماد المستخلص" },
              { href: "/original/health_centers.html",          label: "المراكز الصحية" },
              { href: "/original/review_extract.html",          label: "مراجعة المستخلص" },
            ].map(item => (
              <a
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200 cursor-pointer"
                style={{ textDecoration: "none" }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60 flex-shrink-0" />
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* User */}
      <div className="p-4" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="flex items-center gap-3 px-2 py-2 mb-2">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full font-bold text-sm flex-shrink-0"
            style={{ background: "rgba(212,175,55,0.25)", color: "#d4af37" }}
          >
            {user?.firstName?.charAt(0) || "م"}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium text-white truncate">{user?.fullName || dbUser?.name}</span>
            <span className="text-xs" style={{ color: "#d4af37" }}>
              {dbUser?.role === "admin" ? "مدير النظام" : "مستخدم"}
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10 text-sm"
          onClick={() => { localStorage.removeItem('najran_session'); signOut(); }}
        >
          <LogOut className="ml-2 h-4 w-4 rotate-180" />
          تسجيل الخروج
        </Button>
      </div>
    </div>
  );
}
