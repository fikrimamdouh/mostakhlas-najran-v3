import { useState } from "react";
import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { Search, Clock, Eye, RefreshCw, Wifi, WifiOff, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface UserRow {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  company: string | null;
  hospital: string | null;
  phone: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  lastPage: string | null;
  lastPageAt: string | null;
}

function isOnline(lastPageAt: string | null, lastLoginAt: string | null): boolean {
  const ts = lastPageAt || lastLoginAt;
  if (!ts) return false;
  return Date.now() - new Date(ts).getTime() < 5 * 60 * 1000;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  const hr = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);
  if (diff < 60000) return "الآن";
  if (min < 60) return `منذ ${min} دقيقة`;
  if (hr < 24) return `منذ ${hr} ساعة`;
  if (day < 7) return `منذ ${day} يوم`;
  return new Date(iso).toLocaleDateString("ar-SA", { month: "short", day: "numeric" });
}

function formatLastLogin(iso: string | null) {
  if (!iso) return "لم يسجّل بعد";
  try {
    return new Date(iso).toLocaleString("ar-SA", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" });
  } catch { return iso; }
}

function roleLabel(role: string) {
  if (role === "admin") return { text: "مدير النظام", cls: "bg-[#1e3c72] text-white" };
  if (role === "supervisor") return { text: "مدير مستخلصات", cls: "bg-amber-600 text-white" };
  return { text: "مستخدم", cls: "bg-gray-100 text-gray-700" };
}

function statusLabel(status: string) {
  if (status === "approved") return { text: "✓ معتمد", cls: "text-green-600 border-green-300 bg-green-50" };
  if (status === "rejected") return { text: "✗ مرفوض", cls: "text-red-600 border-red-300 bg-red-50" };
  return { text: "⏳ معلق", cls: "text-amber-600 border-amber-300 bg-amber-50" };
}

export default function UsersView() {
  const { getToken } = useAuth();
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch, isFetching } = useQuery<{ users: UserRow[]; total: number }>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch("/api/users?limit=100", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 0,
    refetchInterval: 30 * 1000, // auto-refresh every 30 seconds
  });

  const allUsers = (data?.users || []).slice().sort((a, b) => {
    // Online users first
    const aOnline = isOnline(a.lastPageAt, a.lastLoginAt) ? 1 : 0;
    const bOnline = isOnline(b.lastPageAt, b.lastLoginAt) ? 1 : 0;
    if (bOnline !== aOnline) return bOnline - aOnline;
    // Then sort by last activity
    const at = new Date(a.lastPageAt || a.lastLoginAt || 0).getTime();
    const bt = new Date(b.lastPageAt || b.lastLoginAt || 0).getTime();
    return bt - at;
  });

  const users = allUsers.filter(u => {
    if (!search) return true;
    const s = search.toLowerCase();
    return u.name.toLowerCase().includes(s) ||
      u.email.toLowerCase().includes(s) ||
      (u.hospital || "").toLowerCase().includes(s) ||
      (u.lastPage || "").includes(search);
  });

  const onlineUsers = users.filter(u => isOnline(u.lastPageAt, u.lastLoginAt));
  const approved = users.filter(u => u.status === "approved").length;
  const pending = users.filter(u => u.status === "pending").length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500" style={{ direction: "rtl" }}>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3" style={{ color: "#1e3c72" }}>
            <Eye className="h-8 w-8" style={{ color: "#d4af37" }} />
            مراقبة المستخدمين
          </h1>
          <p className="text-gray-500 mt-1 flex items-center gap-3 flex-wrap text-sm">
            <span>إجمالي: {data?.total ?? 0}</span>
            <span className="text-green-600">• معتمدون: {approved}</span>
            <span className="text-amber-600">• معلقون: {pending}</span>
            <span className="inline-flex items-center gap-1 text-green-600 font-semibold">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              متصلون الآن: {onlineUsers.length}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse inline-block" />
            تحديث تلقائي كل 30 ث
          </span>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            الآن
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "مجموع المستخدمين", value: data?.total ?? 0, color: "#1e3c72" },
          { label: "معتمدون ونشطون", value: approved, color: "#16a34a" },
          { label: "في انتظار الموافقة", value: pending, color: "#d97706" },
          { label: "متصلون الآن (< 5 دق)", value: onlineUsers.length, color: "#0096c7" },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4 text-center border" style={{ borderColor: "#e8edf7" }}>
            <div className="text-3xl font-black mb-1" style={{ color: s.color }}>{s.value}</div>
            <div className="text-gray-500 text-sm">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Online users highlight */}
      {onlineUsers.length > 0 && (
        <div className="rounded-xl p-4 border" style={{ background: "#f0fff4", borderColor: "#a7f3d0" }}>
          <p className="font-semibold text-green-700 text-sm mb-2 flex items-center gap-2">
            <Wifi className="h-4 w-4" /> المستخدمون المتصلون الآن
          </p>
          <div className="flex flex-wrap gap-2">
            {onlineUsers.map(u => (
              <div key={u.id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 border border-green-200 text-sm">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                <span className="font-medium" style={{ color: "#1e3c72" }}>{u.name}</span>
                {u.lastPage && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <MapPin className="h-3 w-3" />
                    {u.lastPage}
                  </span>
                )}
                <span className="text-xs text-green-600">{relativeTime(u.lastPageAt || u.lastLoginAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
        <Input
          placeholder="بحث بالاسم أو البريد أو المستشفى أو الصفحة..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pr-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden shadow-sm" style={{ borderColor: "#e8edf7" }}>
        <table className="w-full text-sm">
          <thead style={{ background: "linear-gradient(135deg,#1e3c72,#2a5298)", color: "#fff" }}>
            <tr>
              <th className="text-right px-4 py-3 font-semibold">الاسم</th>
              <th className="text-right px-4 py-3 font-semibold">المستشفى</th>
              <th className="text-right px-4 py-3 font-semibold">الدور</th>
              <th className="text-right px-4 py-3 font-semibold">الحالة</th>
              <th className="text-right px-4 py-3 font-semibold">📍 الموقع الحالي</th>
              <th className="text-right px-4 py-3 font-semibold">آخر نشاط</th>
              <th className="text-right px-4 py-3 font-semibold">آخر دخول</th>
              <th className="text-right px-4 py-3 font-semibold">تسجيل</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">جاري التحميل...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">لا توجد نتائج</td></tr>
            ) : users.map((u, i) => {
              const role = roleLabel(u.role);
              const status = statusLabel(u.status);
              const online = isOnline(u.lastPageAt, u.lastLoginAt);
              return (
                <tr key={u.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"} style={{ borderBottom: "1px solid #f0f2f8" }}>
                  {/* Name + online dot */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-shrink-0">
                        <div className="h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm"
                          style={{ background: "#f0f2f8", color: "#1e3c72" }}>
                          {(u.name || "م").charAt(0)}
                        </div>
                        <span className={`absolute -bottom-0.5 -left-0.5 w-3 h-3 rounded-full border-2 border-white ${online ? "bg-green-500" : "bg-gray-300"}`} />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-800">{u.name}</div>
                        <div className="text-gray-400 text-xs">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{u.hospital || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${role.cls}`}>
                      {role.text}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={`text-xs ${status.cls}`}>{status.text}</Badge>
                  </td>

                  {/* Current location */}
                  <td className="px-4 py-3">
                    {u.lastPage ? (
                      <div className="flex items-center gap-1.5">
                        <MapPin className={`h-3.5 w-3.5 flex-shrink-0 ${online ? "text-green-500" : "text-gray-300"}`} />
                        <span className={`text-xs font-medium ${online ? "text-green-700" : "text-gray-400"}`}>
                          {u.lastPage}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>

                  {/* Last activity (relative) */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {online
                        ? <Wifi className="h-3.5 w-3.5 text-green-500" />
                        : <WifiOff className="h-3.5 w-3.5 text-gray-300" />}
                      <span className={`text-xs ${online ? "text-green-600 font-medium" : "text-gray-400"}`}>
                        {relativeTime(u.lastPageAt || u.lastLoginAt)}
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-gray-400 text-xs">
                      <Clock className="h-3 w-3" />
                      {formatLastLogin(u.lastLoginAt)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(u.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-center text-xs text-gray-400">
        📍 الموقع الحالي يتحدث تلقائياً عند تنقل المستخدم بين الصفحات • متصل = آخر نشاط أقل من 5 دقائق
      </p>
    </div>
  );
}
