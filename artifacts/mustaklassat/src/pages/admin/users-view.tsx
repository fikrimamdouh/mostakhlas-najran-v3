import { useState } from "react";
import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { Users, Search, Clock, User, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface UserRow {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  company: string | null;
  phone: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

function formatDateTime(iso: string | null) {
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

  const { data, isLoading } = useQuery<{ users: UserRow[]; total: number }>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch("/api/users?limit=100", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const users = (data?.users || []).filter(u => {
    if (!search) return true;
    const s = search.toLowerCase();
    return u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s);
  });

  const approved = users.filter(u => u.status === "approved").length;
  const pending = users.filter(u => u.status === "pending").length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500" style={{ direction: "rtl" }}>
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3" style={{ color: "#1e3c72" }}>
          <Eye className="h-8 w-8" style={{ color: "#d4af37" }} />
          قائمة المستخدمين — عرض فقط
        </h1>
        <p className="text-gray-500 mt-1">
          إجمالي: {data?.total ?? 0} مستخدم •
          <span className="text-green-600 mr-2">معتمدون: {approved}</span> •
          <span className="text-amber-600 mr-2">معلقون: {pending}</span>
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "مجموع المستخدمين", value: data?.total ?? 0, color: "#1e3c72" },
          { label: "معتمدون ونشطون", value: approved, color: "#16a34a" },
          { label: "في انتظار الموافقة", value: pending, color: "#d97706" },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4 text-center border" style={{ borderColor: "#e8edf7" }}>
            <div className="text-3xl font-black mb-1" style={{ color: s.color }}>{s.value}</div>
            <div className="text-gray-500 text-sm">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
        <Input
          placeholder="بحث بالاسم أو البريد..."
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
              <th className="text-right px-4 py-3 font-semibold">البريد</th>
              <th className="text-right px-4 py-3 font-semibold">الدور</th>
              <th className="text-right px-4 py-3 font-semibold">الحالة</th>
              <th className="text-right px-4 py-3 font-semibold">الشركة</th>
              <th className="text-right px-4 py-3 font-semibold">آخر دخول</th>
              <th className="text-right px-4 py-3 font-semibold">تاريخ التسجيل</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">جاري التحميل...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">لا توجد نتائج</td></tr>
            ) : users.map((u, i) => {
              const role = roleLabel(u.role);
              const status = statusLabel(u.status);
              return (
                <tr key={u.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"} style={{ borderBottom: "1px solid #f0f2f8" }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                        style={{ background: "#f0f2f8", color: "#1e3c72" }}>
                        {u.name.charAt(0)}
                      </div>
                      <span className="font-semibold text-gray-800">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${role.cls}`}>
                      {role.text}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={`text-xs ${status.cls}`}>{status.text}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{u.company || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-gray-400 text-xs">
                      <Clock className="h-3 w-3" />
                      {formatDateTime(u.lastLoginAt)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(u.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-center text-xs text-gray-400 mt-2">
        هذه الصفحة للعرض فقط — لا يمكن تعديل المستخدمين من هنا
      </p>
    </div>
  );
}
