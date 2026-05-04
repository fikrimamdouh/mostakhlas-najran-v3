import { Link, useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import { useGetMe } from "@workspace/api-client-react";
import {
  LayoutDashboard,
  FileText,
  Settings,
  Users,
  LogOut,
  FolderKanban,
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
    { name: "المستخلصات", href: "/extracts", icon: FileText },
    { name: "المشاريع", href: "/projects", icon: FolderKanban },
    ...(isAdmin ? [{ name: "إدارة المستخدمين", href: "/admin/users", icon: Users }] : []),
    { name: "الإعدادات", href: "/settings", icon: Settings },
  ];

  return (
    <div
      className="flex h-full w-64 flex-col text-white"
      style={{
        background: "linear-gradient(180deg, #1e3c72 0%, #2a5298 100%)",
        borderLeft: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      {/* Logo / Header */}
      <div
        className="flex flex-col items-center py-6 px-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}
      >
        <Link href="/dashboard" className="flex flex-col items-center gap-3 w-full">
          <img
            src="/logo.png"
            alt="تجمع نجران الصحي"
            className="h-16 w-auto drop-shadow-lg"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <div className="text-center">
            <div className="font-bold text-base text-white leading-tight">
              تجمع نجران الصحي
            </div>
            <div className="text-xs font-medium mt-0.5" style={{ color: "#d4af37" }}>
              نظام المستخلصات
            </div>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-5">
        <nav className="space-y-1 px-3">
          {navigation.map((item) => {
            const isActive = location.startsWith(item.href);
            return (
              <Link key={item.name} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer",
                    isActive
                      ? "text-[#1e3c72] font-bold"
                      : "text-white/80 hover:text-white hover:bg-white/10"
                  )}
                  style={
                    isActive
                      ? {
                          background: "linear-gradient(135deg, #d4af37, #b8962e)",
                          boxShadow: "0 4px 12px rgba(212,175,55,0.3)",
                        }
                      : {}
                  }
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
      </div>

      {/* User / Sign out */}
      <div
        className="p-4"
        style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}
      >
        <div className="flex items-center gap-3 px-2 py-2 mb-2">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full font-bold text-sm flex-shrink-0"
            style={{ background: "rgba(212,175,55,0.25)", color: "#d4af37" }}
          >
            {user?.firstName?.charAt(0) || "م"}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium text-white truncate">
              {user?.fullName || dbUser?.name}
            </span>
            <span className="text-xs" style={{ color: "#d4af37" }}>
              {dbUser?.role === "admin" ? "مدير النظام" : "مستخدم"}
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10 text-sm"
          onClick={() => signOut()}
        >
          <LogOut className="ml-2 h-4 w-4 rotate-180" />
          تسجيل الخروج
        </Button>
      </div>
    </div>
  );
}
