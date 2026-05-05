import { useState } from "react";
import { useListUsers, useApproveUser, useRejectUser, getListUsersQueryKey, useGetMe } from "@workspace/api-client-react";
import { useAuth } from "@clerk/react";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Check, X, ShieldAlert, UserCheck, UserX, Shield, User,
  Search, RefreshCw, ClipboardList, Users, Clock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { apiUrl } from "@/lib/api-base";

type TabType = "all" | "pending" | "approved" | "rejected";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" });
  } catch { return iso; }
}

function formatLastLogin(iso: string | null) {
  if (!iso) return "لم يسجّل دخولاً بعد";
  try {
    return new Date(iso).toLocaleString("ar-SA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

export default function AdminUsers() {
  const { toast } = useToast();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const { data: me } = useGetMe({ query: { queryKey: ["/api/users/me"] } });

  const [tab, setTab] = useState<TabType>("pending");
  const [search, setSearch] = useState("");

  const { data: notificationsData } = useQuery<{ notifications: any[] }>({
    queryKey: ["/api/users/notifications"],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(apiUrl("/api/users/notifications"), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
  });

  const { data, isLoading, refetch, isFetching } = useListUsers(
    tab !== "all" ? { status: tab } : undefined,
    { query: { queryKey: [...getListUsersQueryKey(), tab] } }
  );

  const { mutate: approveUser, isPending: isApproving } = useApproveUser({
    mutation: {
      onSuccess: () => {
        toast({ title: "✅ تم", description: "تمت الموافقة على المستخدم وإرسال البريد" });
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      }
    }
  });

  const { mutate: rejectUser, isPending: isRejecting } = useRejectUser({
    mutation: {
      onSuccess: () => {
        toast({ title: "❌ تم", description: "تم رفض المستخدم وإرسال البريد" });
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      }
    }
  });

  const doUserAction = async (userId: number, action: string) => {
    const token = await getToken();
    const res = await fetch(apiUrl(`/api/users/${userId}/${action}`), {
      method: action === "role" ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: action === "role" ? undefined : undefined,
    });
    return res.ok;
  };

  const changeRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: string }) => {
      const token = await getToken();
      const res = await fetch(apiUrl(`/api/users/${userId}/role`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    onSuccess: (_, { role }) => {
      const label = role === "admin" ? "مدير النظام" : role === "supervisor" ? "مدير مستخلصات" : "مستخدم";
      toast({ title: "✅ تم", description: `تم تغيير الصلاحية إلى ${label}` });
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ userId, activate }: { userId: number; activate: boolean }) => {
      const token = await getToken();
      const endpoint = activate ? "activate" : "deactivate";
      const res = await fetch(apiUrl(`/api/users/${userId}/${endpoint}`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    onSuccess: (_, { activate }) => {
      toast({ title: "✅ تم", description: activate ? "تم تفعيل الحساب" : "تم تعطيل الحساب" });
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
    },
  });

  const users = (data?.users || []).filter(u => {
    if (!search) return true;
    const s = search.toLowerCase();
    return u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s);
  });

  const pendingCount = (data?.users || []).filter(u => u.status === "pending").length;
  const pendingNotificationsCount = notificationsData?.notifications?.length || 0;

  const tabs: { key: TabType; label: string; icon: any }[] = [
    { key: "pending", label: "في الانتظار", icon: Clock },
    { key: "approved", label: "معتمدون", icon: UserCheck },
    { key: "rejected", label: "مرفوضون", icon: UserX },
    { key: "all", label: "الكل", icon: Users },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500" style={{ direction: "rtl" }}>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3" style={{ color: "#1e3c72" }}>
            <ShieldAlert className="h-8 w-8" style={{ color: "#d4af37" }} />
            إدارة المستخدمين والصلاحيات
          </h1>
          <p className="text-gray-500 mt-1">
            إجمالي المستخدمين: {data?.total ?? 0}
            {pendingCount > 0 && <span className="mr-3 text-amber-600 font-medium">⚠️ طلبات مستخدمين بانتظار الموافقة ({Math.max(pendingCount, pendingNotificationsCount)})</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            تحديث
          </Button>
          <Link href="/admin/audit">
            <Button variant="outline" size="sm" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              سجل المراقبة
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl p-1" style={{ background: "#f0f2f8" }}>
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                tab === t.key
                  ? "bg-white shadow-sm text-[#1e3c72] font-bold"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
        <Input
          placeholder="بحث بالاسم أو البريد الإلكتروني..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pr-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden shadow-sm" style={{ borderColor: "#e8edf7" }}>
        <Table>
          <TableHeader>
            <TableRow style={{ background: "linear-gradient(135deg,#1e3c72,#2a5298)" }}>
              <TableHead className="font-bold text-right text-white">الاسم</TableHead>
              <TableHead className="font-bold text-right text-white">البريد</TableHead>
              <TableHead className="font-bold text-right text-white">الصلاحية</TableHead>
              <TableHead className="font-bold text-right text-white">الحالة</TableHead>
              <TableHead className="font-bold text-right text-white">آخر دخول</TableHead>
              <TableHead className="font-bold text-right text-white">تاريخ التسجيل</TableHead>
              <TableHead className="font-bold text-center text-white">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="h-24 text-center text-gray-400">جاري التحميل...</TableCell></TableRow>
            ) : users.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="h-24 text-center text-gray-400">لا يوجد مستخدمون</TableCell></TableRow>
            ) : (
              users.map((user, i) => (
                <TableRow key={user.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"} style={{ borderBottom: "1px solid #f0f2f8" }}>
                  <TableCell className="font-semibold text-gray-800">{user.name}</TableCell>
                  <TableCell className="text-gray-500 text-sm">{user.email}</TableCell>

                  {/* Role */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {user.role === "admin"
                        ? <Badge className="bg-[#1e3c72] text-white gap-1"><Shield className="h-3 w-3" />مدير النظام</Badge>
                        : <Badge variant="outline" className="gap-1"><User className="h-3 w-3" />مستخدم شركة</Badge>
                      }
                      {/* Change role dropdown — can't change own role */}
                      {me?.id !== user.id && (
                        <select
                          value={user.role}
                          disabled={changeRole.isPending}
                          onChange={e => changeRole.mutate({ userId: user.id, role: e.target.value })}
                          className="text-xs border border-gray-200 rounded px-1 py-0.5 text-gray-600 bg-white cursor-pointer hover:border-blue-400"
                          title="تغيير الصلاحية"
                        >
                          <option value="user">مستخدم</option>
                          <option value="supervisor">مدير مستخلصات</option>
                          <option value="admin">مدير النظام</option>
                        </select>
                      )}
                    </div>
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <Badge variant="outline" className={
                      user.status === "approved" ? "text-green-600 border-green-300 bg-green-50" :
                      user.status === "rejected" ? "text-red-600 border-red-300 bg-red-50" :
                      "text-amber-600 border-amber-300 bg-amber-50"
                    }>
                      {user.status === "approved" ? "✓ مقبول" :
                       user.status === "rejected" ? "✗ مرفوض" : "⏳ معلق"}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-gray-400 text-xs">{formatLastLogin((user as any).lastLoginAt)}</TableCell>
                  <TableCell className="text-gray-400 text-xs">{formatDate(user.createdAt)}</TableCell>

                  {/* Actions */}
                  <TableCell>
                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                      {user.status === "pending" && (
                        <>
                          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-7 px-2 text-xs gap-1"
                            onClick={() => approveUser({ userId: user.id.toString() })}
                            disabled={isApproving || isRejecting}>
                            <Check className="h-3 w-3" /> موافقة
                          </Button>
                          <Button size="sm" variant="destructive" className="h-7 px-2 text-xs gap-1"
                            onClick={() => rejectUser({ userId: user.id.toString() })}
                            disabled={isApproving || isRejecting}>
                            <X className="h-3 w-3" /> رفض
                          </Button>
                        </>
                      )}
                      {user.status === "approved" && me?.id !== user.id && (
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => toggleActive.mutate({ userId: user.id, activate: false })}
                          disabled={toggleActive.isPending}>
                          <UserX className="h-3 w-3" /> تعطيل
                        </Button>
                      )}
                      {user.status === "rejected" && (
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1 text-green-600 border-green-200 hover:bg-green-50"
                          onClick={() => toggleActive.mutate({ userId: user.id, activate: true })}
                          disabled={toggleActive.isPending}>
                          <UserCheck className="h-3 w-3" /> تفعيل
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
