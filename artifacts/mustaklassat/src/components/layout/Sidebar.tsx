import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import { useGetMe } from "@workspace/api-client-react";
import { 
  Building2, 
  LayoutDashboard, 
  FileText, 
  Settings, 
  Users,
  LogOut,
  Menu,
  FolderKanban
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
    <div className="flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground border-l border-sidebar-border">
      <div className="flex h-16 items-center px-6 border-b border-sidebar-border">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="flex items-center justify-center rounded-lg bg-primary/20 p-2 text-primary">
            <Building2 className="h-6 w-6" />
          </div>
          <span className="font-bold text-lg tracking-tight">نظام المستخلصات</span>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto py-6">
        <nav className="space-y-1 px-4">
          {navigation.map((item) => {
            const isActive = location.startsWith(item.href);
            return (
              <Link key={item.name} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground cursor-pointer",
                    isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70"
                  )}
                >
                  <item.icon className={cn("h-5 w-5 flex-shrink-0", isActive ? "text-primary" : "text-sidebar-foreground/50")} />
                  {item.name}
                </div>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-primary font-bold">
            {user?.firstName?.charAt(0) || "U"}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{user?.fullName || dbUser?.name}</span>
            <span className="text-xs text-sidebar-foreground/50">{dbUser?.role === "admin" ? "مدير النظام" : "مستخدم"}</span>
          </div>
        </div>
        <Button 
          variant="ghost" 
          className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent mt-2"
          onClick={() => signOut()}
        >
          <LogOut className="mr-2 h-4 w-4 rotate-180" />
          تسجيل الخروج
        </Button>
      </div>
    </div>
  );
}