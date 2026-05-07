import { useState } from "react";
import { useListUsers, useApproveUser, useRejectUser, getListUsersQueryKey, useGetMe } from "@workspace/api-client-react";
import { useAuth } from "@clerk/react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Check, X, ShieldAlert, UserCheck, UserX, Shield, User,
  Search, RefreshCw, ClipboardList, Users, Clock, LayoutGrid, Save, Trash2, AlertTriangle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { ALL_MODULES } from "../dashboard";

// ── نافذة تأكيد تهيئة النظام ────────────────────────────────────────────────
function ResetSystemModal({ onClose, onConfirm, isPending }: {
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [typed, setTyped] = useState("");
  const PHRASE = "تهيئة النظام";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)", direction: "rtl" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="p-5 flex items-center gap-3" style={{ background: "linear-gradient(135deg,#7f1d1d,#b91c1c)", color: "#fff" }}>
          <AlertTriangle className="h-7 w-7 shrink-0" />
          <div>
            <h2 className="text-lg font-bold">تهيئة النظام الكاملة</h2>
            <p className="text-sm opacity-80">لا يمكن التراجع عن هذا الإجراء</p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {step === 1 ? (
            <>
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 space-y-2">
                <p className="font-bold">سيتم حذف الآتي نهائياً:</p>
                <ul className="list-disc list-inside space-y-1 opacity-90">
                  <li>جميع المستخلصات المرفوعة</li>
                  <li>جميع بيانات المستخدمين المحفوظة</li>
                  <li>جميع سجلات المراقبة</li>
                  <li>جميع المشاريع والمستخلصات القديمة</li>
                  <li>جميع المستخدمين (ما عداك أنت)</li>
                </ul>
              </div>
              <p className="text-gray-600 text-sm">هل أنت متأكد أنك تريد المتابعة؟ هذا الإجراء لا يمكن التراجع عنه.</p>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={onClose}>إلغاء</Button>
                <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white gap-2" onClick={() => setStep(2)}>
                  <AlertTriangle className="h-4 w-4" /> نعم، أريد المتابعة
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-gray-700 text-sm font-medium">
                للتأكيد، اكتب بالضبط: <span className="font-bold text-red-700">«{PHRASE}»</span>
              </p>
              <Input
                value={typed}
                onChange={e => setTyped(e.target.value)}
                placeholder={PHRASE}
                className="text-center text-lg border-red-300 focus:border-red-500"
                autoFocus
              />
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={onClose} disabled={isPending}>إلغاء</Button>
                <Button
                  className="flex-1 bg-red-700 hover:bg-red-800 text-white gap-2"
                  disabled={typed !== PHRASE || isPending}
                  onClick={onConfirm}
                >
                  <Trash2 className="h-4 w-4" />
                  {isPending ? "جاري التهيئة..." : "تهيئة النظام الآن"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

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

// Modal to manage which modules a user can see
function ModulePermissionsModal({ user, onClose, onSave }: {
  user: { id: number; name: string; allowedModules?: string | null };
  onClose: () => void;
  onSave: (modules: string[] | null) => void;
}) {
  let initial: string[] | null = null;
  try { initial = user.allowedModules ? JSON.parse(user.allowedModules) : null; } catch {}

  const [selected, setSelected] = useState<string[] | null>(initial);
  const allSelected = selected === null;

  const toggle = (key: string) => {
    const current = selected ?? ALL_MODULES.map(m => m.key);
    if (current.includes(key)) {
      const next = current.filter(k => k !== key);
      setSelected(next.length === 0 ? [] : next);
    } else {
      setSelected([...current, key]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)", direction: "rtl" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b flex items-center justify-between" style={{ background: "linear-gradient(135deg,#1e3c72,#2a5298)", color: "#fff" }}>
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <LayoutGrid className="h-5 w-5" style={{ color: "#d4af37" }} />
              صلاحيات الوحدات — {user.name}
            </h3>
            <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.7)" }}>
              اختر الوحدات التي يراها هذا المستخدم في الداشبورد
            </p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
        </div>

        {/* All toggle */}
        <div className="px-5 py-3 border-b flex items-center gap-3" style={{ background: "#f8faff" }}>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setSelected(allSelected ? ALL_MODULES.map(m => m.key) : null)}
              className="h-4 w-4 accent-blue-600"
            />
            <span className="font-semibold text-sm" style={{ color: "#1e3c72" }}>
              {allSelected ? "✅ جميع الوحدات مسموح بها (افتراضي)" : "السماح بجميع الوحدات"}
            </span>
          </label>
          {!allSelected && (
            <span className="text-xs text-gray-500">
              مختار: {(selected || []).length} من {ALL_MODULES.length}
            </span>
          )}
        </div>

        {/* Modules list */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-2">
          {ALL_MODULES.map(m => {
            const Icon = m.icon;
            const checked = allSelected || (selected || []).includes(m.key);
            return (
              <label
                key={m.key}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all select-none",
                  checked
                    ? "border-blue-200 bg-blue-50"
                    : "border-gray-100 bg-gray-50 opacity-50"
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={allSelected}
                  onChange={() => toggle(m.key)}
                  className="h-4 w-4 accent-blue-600 flex-shrink-0"
                />
                <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: m.color }}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-medium" style={{ color: "#1e3c72" }}>{m.label}</span>
              </label>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button
            onClick={() => onSave(selected)}
            className="gap-2"
            style={{ background: "linear-gradient(135deg,#1e3c72,#2a5298)", color: "#fff", border: "none" }}
          >
            <Save className="h-4 w-4" />
            حفظ الصلاحيات
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const { toast } = useToast();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const { data: me } = useGetMe({ query: { queryKey: ["/api/users/me"] } });

  const [tab, setTab] = useState<TabType>("pending");
  const [search, setSearch] = useState("");
  const [modulesUser, setModulesUser] = useState<any | null>(null);
  const [showReset, setShowReset] = useState(false);

  const resetSystem = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      const res = await fetch("/api/admin/reset-system", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ confirmation: "تأكيد التهيئة الكاملة" }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "فشل"); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "✅ تمت التهيئة", description: "تم مسح جميع البيانات بنجاح. النظام جاهز للإطلاق." });
      setShowReset(false);
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
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

  const [contractCompanyFor, setContractCompanyFor] = useState<Record<number, string>>({});

  const changeRole = useMutation({
    mutationFn: async ({ userId, role, contractCompany }: { userId: number; role: string; contractCompany?: string }) => {
      const token = await getToken();
      const res = await fetch(`/api/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ role, contractCompany }),
      });
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    onSuccess: (_, { role }) => {
      const label = role === "admin" ? "مدير النظام" : role === "supervisor" ? "مدير مستخلصات" : role === "contract_supervisor" ? "مشرف عقد" : "مستخدم";
      toast({ title: "✅ تم", description: `تم تغيير الصلاحية إلى ${label}` });
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ userId, activate }: { userId: number; activate: boolean }) => {
      const token = await getToken();
      const endpoint = activate ? "activate" : "deactivate";
      const res = await fetch(`/api/users/${userId}/${endpoint}`, {
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

  const saveModules = useMutation({
    mutationFn: async ({ userId, modules }: { userId: number; modules: string[] | null }) => {
      const token = await getToken();
      const res = await fetch(`/api/users/${userId}/modules`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ modules }),
      });
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "✅ تم", description: "تم حفظ صلاحيات الوحدات بنجاح" });
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      setModulesUser(null);
    },
    onError: () => toast({ title: "خطأ", description: "فشل حفظ الصلاحيات", variant: "destructive" }),
  });

  const users = (data?.users || []).filter(u => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (u.name ?? "").toLowerCase().includes(s) || u.email.toLowerCase().includes(s);
  });

  const pendingCount = (data?.users || []).filter(u => u.status === "pending").length;

  const tabs: { key: TabType; label: string; icon: any }[] = [
    { key: "pending", label: "في الانتظار", icon: Clock },
    { key: "approved", label: "معتمدون", icon: UserCheck },
    { key: "rejected", label: "مرفوضون", icon: UserX },
    { key: "all", label: "الكل", icon: Users },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500" style={{ direction: "rtl" }}>
      {/* Modules modal */}
      {modulesUser && (
        <ModulePermissionsModal
          user={modulesUser}
          onClose={() => setModulesUser(null)}
          onSave={(modules) => saveModules.mutate({ userId: modulesUser.id, modules })}
        />
      )}

      {/* Reset system modal */}
      {showReset && (
        <ResetSystemModal
          onClose={() => setShowReset(false)}
          onConfirm={() => resetSystem.mutate()}
          isPending={resetSystem.isPending}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3" style={{ color: "#1e3c72" }}>
            <ShieldAlert className="h-8 w-8" style={{ color: "#d4af37" }} />
            إدارة المستخدمين والصلاحيات
          </h1>
          <p className="text-gray-500 mt-1">
            إجمالي المستخدمين: {data?.total ?? 0}
            {pendingCount > 0 && <span className="mr-3 text-amber-600 font-medium">⚠️ {pendingCount} بانتظار الموافقة</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
          <Button
            size="sm"
            className="gap-2 bg-red-700 hover:bg-red-800 text-white border-0"
            onClick={() => setShowReset(true)}
          >
            <Trash2 className="h-4 w-4" />
            تهيئة النظام
          </Button>
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
              <TableHead className="font-bold text-right text-white">تسجيل</TableHead>
              <TableHead className="font-bold text-center text-white">الوحدات</TableHead>
              <TableHead className="font-bold text-center text-white">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="h-24 text-center text-gray-400">جاري التحميل...</TableCell></TableRow>
            ) : users.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="h-24 text-center text-gray-400">لا يوجد مستخدمون</TableCell></TableRow>
            ) : (
              users.map((user, i) => {
                let allowedCount: string;
                try {
                  const mods = (user as any).allowedModules;
                  allowedCount = mods ? `${JSON.parse(mods).length}/${ALL_MODULES.length}` : "الكل";
                } catch { allowedCount = "الكل"; }

                return (
                  <TableRow key={user.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"} style={{ borderBottom: "1px solid #f0f2f8" }}>
                    <TableCell className="font-semibold text-gray-800">{user.name}</TableCell>
                    <TableCell className="text-gray-500 text-sm">{user.email}</TableCell>

                    {/* Role */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {user.role === "admin"
                          ? <Badge className="bg-[#1e3c72] text-white gap-1"><Shield className="h-3 w-3" />مدير النظام</Badge>
                          : user.role === "supervisor"
                          ? <Badge className="bg-amber-600 text-white gap-1"><Shield className="h-3 w-3" />مدير مستخلصات</Badge>
                          : user.role === "contract_supervisor"
                          ? <Badge className="bg-teal-600 text-white gap-1"><Shield className="h-3 w-3" />مشرف عقد</Badge>
                          : <Badge variant="outline" className="gap-1"><User className="h-3 w-3" />مستخدم</Badge>
                        }
                        {me?.id !== user.id && (
                          <div className="flex items-center gap-1 flex-wrap">
                            <select
                              value={user.role}
                              disabled={changeRole.isPending}
                              onChange={e => {
                                const newRole = e.target.value;
                                if (newRole === "contract_supervisor") {
                                  setContractCompanyFor(prev => ({ ...prev, [user.id]: prev[user.id] || "بيت_العرب" }));
                                } else {
                                  changeRole.mutate({ userId: user.id, role: newRole });
                                }
                              }}
                              className="text-xs border border-gray-200 rounded px-1 py-0.5 text-gray-600 bg-white cursor-pointer hover:border-blue-400"
                            >
                              <option value="user">مستخدم</option>
                              <option value="supervisor">مدير مستخلصات</option>
                              <option value="contract_supervisor">مشرف عقد</option>
                              <option value="admin">مدير النظام</option>
                            </select>
                            {(user.role === "contract_supervisor" || contractCompanyFor[user.id]) && (
                              <div className="flex items-center gap-1">
                                <select
                                  value={contractCompanyFor[user.id] ?? (user as any).contractCompany ?? "بيت_العرب"}
                                  disabled={changeRole.isPending}
                                  onChange={e => setContractCompanyFor(prev => ({ ...prev, [user.id]: e.target.value }))}
                                  className="text-xs border border-amber-300 rounded px-1 py-0.5 text-amber-700 bg-amber-50 cursor-pointer"
                                >
                                  <option value="بيت_العرب">بيت العرب</option>
                                  <option value="سراكو">سراكو</option>
                                </select>
                                <Button
                                  size="sm"
                                  className="h-5 text-xs px-2 bg-amber-600 hover:bg-amber-700 text-white"
                                  disabled={changeRole.isPending}
                                  onClick={() => changeRole.mutate({
                                    userId: user.id,
                                    role: "contract_supervisor",
                                    contractCompany: contractCompanyFor[user.id] ?? (user as any).contractCompany ?? "بيت_العرب",
                                  })}
                                >
                                  حفظ
                                </Button>
                              </div>
                            )}
                          </div>
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

                    {/* Modules button */}
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setModulesUser(user)}
                        className="h-7 px-2 text-xs gap-1 text-blue-700 border-blue-200 hover:bg-blue-50"
                      >
                        <LayoutGrid className="h-3 w-3" />
                        {allowedCount}
                      </Button>
                    </TableCell>

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
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
