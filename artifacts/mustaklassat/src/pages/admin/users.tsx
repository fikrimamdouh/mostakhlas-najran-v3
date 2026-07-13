import { useState } from "react";
import { useListUsers, useApproveUser, useRejectUser, getListUsersQueryKey, useGetMe, useDeleteUser } from "@workspace/api-client-react";
import type { UserProfile } from "@workspace/api-client-react";
import { useAuth } from "@clerk/react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Check, X, ShieldAlert, UserCheck, UserX, Shield, User, Eye,
  Search, RefreshCw, ClipboardList, Users, Clock, LayoutGrid, Save, Trash2, AlertTriangle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { ALL_MODULES, ASSIGNABLE_MODULES } from "@/lib/modules";

type TokenGetter = ReturnType<typeof useAuth>["getToken"];
type AdminUserProfile = Omit<UserProfile, "name" | "email" | "status"> & {
  name: string;
  email: string;
  status: UserProfile["status"] | "deleted";
  allowedModules?: string | null;
};

async function fetchWithFreshToken(getToken: TokenGetter, input: RequestInfo | URL, init: RequestInit = {}) {
  const build = (token: string | null) => ({
    ...init,
    headers: {
      ...(init.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  let token = await getToken();
  let res = await fetch(input, build(token));

  if (res.status === 401) {
    try {
      token = await getToken({ skipCache: true } as any);
      res = await fetch(input, build(token));
    } catch {
      // keep original 401 response
    }
  }

  return res;
}

// ── نافذة تأكيد حذف مستخدم واحد ─────────────────────────────────────────────
function DeleteUserModal({ user, onClose, onConfirm, isPending }: {
  user: { name: string; email: string };
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)", direction: "rtl" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="p-5 flex items-center gap-3" style={{ background: "linear-gradient(135deg,#7f1d1d,#b91c1c)", color: "#fff" }}>
          <AlertTriangle className="h-6 w-6 shrink-0" />
          <div>
            <h2 className="text-base font-bold">حذف مستخدم نهائياً</h2>
            <p className="text-xs opacity-80">لا يمكن التراجع عن هذا الإجراء</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 space-y-1">
            <p className="font-bold">{user.name}</p>
            <p className="opacity-80 text-xs">{user.email}</p>
            <p className="mt-2">سيتم حذف هذا المستخدم نهائياً من النظام ومن نظام تسجيل الدخول. لن يتمكن من الدخول مرة أخرى.</p>
          </div>
          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={isPending}>إلغاء</Button>
            <Button
              className="flex-1 bg-red-700 hover:bg-red-800 text-white gap-2"
              onClick={onConfirm}
              disabled={isPending}
            >
              <Trash2 className="h-4 w-4" />
              {isPending ? "جاري الحذف..." : "حذف نهائي"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── نافذة تأكيد مسح المستخلصات والزيارات ────────────────────────────────────
function ResetExtractsModal({ onClose, onConfirm, isPending }: {
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  const [typed, setTyped] = useState("");
  const PHRASE = "حذف المستخلصات";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)", direction: "rtl" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-5 flex items-center gap-3" style={{ background: "linear-gradient(135deg,#92400e,#d97706)", color: "#fff" }}>
          <AlertTriangle className="h-7 w-7 shrink-0" />
          <div>
            <h2 className="text-lg font-bold">مسح المستخلصات والزيارات</h2>
            <p className="text-sm opacity-80">المستخدمون وبيانات الموظفين والتامبلت تبقى كما هي</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 space-y-2">
            <p className="font-bold">سيتم حذف الآتي نهائياً:</p>
            <ul className="list-disc list-inside space-y-1 opacity-90">
              <li>جميع المستخلصات والمشاريع</li>
              <li>جميع المستخلصات المرفوعة</li>
              <li>جميع طلبات زيارة مقاولي الباطن</li>
            </ul>
            <p className="font-bold text-green-700 mt-2">يبقى محفوظاً:</p>
            <ul className="list-disc list-inside space-y-1 text-green-800 opacity-90">
              <li>جميع المستخدمين وصلاحياتهم</li>
              <li>بيانات الموظفين المحفوظة</li>
              <li>التامبلت المرفوعة</li>
            </ul>
          </div>
          <p className="text-gray-700 text-sm font-medium">
            للتأكيد، اكتب بالضبط: <span className="font-bold text-amber-700">«{PHRASE}»</span>
          </p>
          <Input
            value={typed}
            onChange={e => setTyped(e.target.value)}
            placeholder={PHRASE}
            className="text-center text-lg border-amber-300 focus:border-amber-500"
            autoFocus
          />
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={isPending}>إلغاء</Button>
            <Button
              className="flex-1 text-white gap-2"
              style={{ background: typed === PHRASE && !isPending ? "#d97706" : undefined }}
              disabled={typed !== PHRASE || isPending}
              onClick={onConfirm}
            >
              <Trash2 className="h-4 w-4" />
              {isPending ? "جاري المسح..." : "مسح المستخلصات والزيارات"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
    const current = selected ?? ASSIGNABLE_MODULES.map(m => m.key);
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
              <LayoutGrid className="h-5 w-5" />
              صلاحيات الوحدات
            </h3>
            <p className="text-sm opacity-80 mt-1">المستخدم: {user.name}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* All modules toggle */}
        <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e) => setSelected(e.target.checked ? null : ASSIGNABLE_MODULES.map(m => m.key))}
              className="h-5 w-5 accent-blue-600"
            />
            <div>
              <div className="font-bold" style={{ color: "#1e3c72" }}>جميع الوحدات</div>
              <div className="text-xs text-gray-500">السماح للمستخدم بالوصول لكل الصفحات المتاحة</div>
            </div>
          </label>
          {!allSelected && (
            <span className="text-xs text-gray-500">
              مختار: {(selected || []).length} من {ASSIGNABLE_MODULES.length}
            </span>
          )}
        </div>

        {/* Modules list */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-2">
          {ASSIGNABLE_MODULES.map(m => {
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
  const [showResetExtracts, setShowResetExtracts] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string; email: string } | null>(null);

  const resetExtracts = useMutation({
    mutationFn: async () => {
      const res = await fetchWithFreshToken(getToken, "/api/admin/reset-extracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "حذف المستخلصات" }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "فشل"); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "✅ تم المسح", description: "تم حذف جميع المستخلصات والمشاريع وطلبات الزيارة. المستخدمون والبيانات الأخرى بخير." });
      setShowResetExtracts(false);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const resetSystem = useMutation({
    mutationFn: async () => {
      const res = await fetchWithFreshToken(getToken, "/api/admin/reset-system", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "تأكيد التهيئة الكاملة" }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "فشل"); }
      return res.json();
    },
    onSuccess: () => {
      try { localStorage.clear(); } catch {}
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
      const res = await fetchWithFreshToken(getToken, `/api/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, contractCompany }),
      });
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    onSuccess: (_, { role }) => {
      const label = role === "admin" ? "مدير النظام" : role === "supervisor" ? "مدير مستخلصات" : role === "contract_supervisor" ? "مشرف عقد" : role === "viewer" ? "مراقب" : "مستخدم";
      toast({ title: "✅ تم", description: `تم تغيير الصلاحية إلى ${label}` });
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ userId, activate }: { userId: number; activate: boolean }) => {
      const endpoint = activate ? "activate" : "deactivate";
      const res = await fetchWithFreshToken(getToken, `/api/users/${userId}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    onSuccess: (_, { activate }) => {
      toast({ title: "✅ تم", description: activate ? "تم تفعيل الحساب" : "تم تعطيل الحساب" });
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
    },
  });

  const { mutate: deleteUser, isPending: isDeleting } = useDeleteUser({
    mutation: {
      onSuccess: () => {
        toast({ title: "✅ تم الحذف", description: "تم حذف المستخدم نهائياً من النظام" });
        setDeleteTarget(null);
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      },
      onError: (e: any) => {
        const msg = e?.response?.data?.error || "فشل حذف المستخدم";
        toast({ title: "خطأ", description: msg, variant: "destructive" });
        setDeleteTarget(null);
      },
    },
  });

  const saveModules = useMutation({
    mutationFn: async ({ userId, modules }: { userId: number; modules: string[] | null }) => {
      const res = await fetchWithFreshToken(getToken, `/api/users/${userId}/modules`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modules }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || "failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "✅ تم", description: "تم حفظ صلاحيات الوحدات بنجاح" });
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      setModulesUser(null);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message || "فشل حفظ الصلاحيات", variant: "destructive" }),
  });

  const allUsers = (data?.users || []) as AdminUserProfile[];
  const users = allUsers.filter(u => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (u.name ?? "").toLowerCase().includes(s) || u.email.toLowerCase().includes(s);
  });

  const pendingCount = allUsers.filter(u => u.status === "pending").length;

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

      {/* Reset extracts modal */}
      {showResetExtracts && (
        <ResetExtractsModal
          onClose={() => setShowResetExtracts(false)}
          onConfirm={() => resetExtracts.mutate()}
          isPending={resetExtracts.isPending}
        />
      )}

      {/* Delete user modal */}
      {deleteTarget && (
        <DeleteUserModal
          user={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => deleteUser({ userId: deleteTarget.id.toString() })}
          isPending={isDeleting}
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
            className="gap-2 text-white border-0"
            style={{ background: "#d97706" }}
            onClick={() => setShowResetExtracts(true)}
          >
            <Trash2 className="h-4 w-4" />
            مسح المستخلصات والزيارات
          </Button>
          <Button
            size="sm"
            className="gap-2 bg-red-700 hover:bg-red-800 text-white border-0"
            onClick={() => setShowReset(true)}
          >
            <AlertTriangle className="h-4 w-4" />
            تهيئة النظام
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="بحث بالاسم أو البريد..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pr-10 bg-white"
        />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map(t => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <Button
              key={t.key}
              variant={active ? "default" : "outline"}
              onClick={() => setTab(t.key)}
              className="gap-2"
              style={active ? { background: "linear-gradient(135deg,#1e3c72,#2a5298)", color: "#fff" } : {}}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </Button>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-lg border overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-500">جاري التحميل...</div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-gray-500">لا يوجد مستخدمون</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="text-right">المستخدم</TableHead>
                <TableHead className="text-right">الشركة/المستشفى</TableHead>
                <TableHead className="text-right">الصلاحية</TableHead>
                <TableHead className="text-right">الوحدات</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">آخر دخول</TableHead>
                <TableHead className="text-right">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(user => (
                <TableRow key={user.id} className="hover:bg-gray-50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg,#1e3c72,#2a5298)" }}>
                        <User className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <div className="font-bold" style={{ color: "#1e3c72" }}>{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                        {user.phone && <div className="text-xs text-gray-400">{user.phone}</div>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {user.company && <div className="font-medium">{user.company}</div>}
                      {user.hospital && <div className="text-gray-500 text-xs">{user.hospital}</div>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <select
                        className="text-sm border rounded-lg px-2 py-1 bg-white min-w-[130px]"
                        value={user.role}
                        disabled={changeRole.isPending || user.id === me?.id}
                        onChange={(e) => {
                          const role = e.target.value;
                          changeRole.mutate({ userId: user.id, role, contractCompany: role === "contract_supervisor" ? contractCompanyFor[user.id] : undefined });
                        }}
                      >
                        <option value="user">مستخدم</option>
                        <option value="viewer">مراقب</option>
                        <option value="contract_supervisor">مشرف عقد</option>
                        <option value="supervisor">مدير مستخلصات</option>
                        <option value="admin">مدير النظام</option>
                      </select>
                      {user.role === "contract_supervisor" && (
                        <select
                          className="text-xs border rounded-lg px-2 py-1 bg-white block min-w-[130px]"
                          value={contractCompanyFor[user.id] ?? user.contractCompany ?? "بيت_العرب"}
                          onChange={(e) => {
                            const company = e.target.value;
                            setContractCompanyFor(prev => ({ ...prev, [user.id]: company }));
                            changeRole.mutate({ userId: user.id, role: "contract_supervisor", contractCompany: company });
                          }}
                        >
                          <option value="بيت_العرب">بيت العرب</option>
                          <option value="سراكو">سراكو</option>
                        </select>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs"
                      onClick={() => setModulesUser(user)}
                    >
                      <LayoutGrid className="h-3 w-3" />
                      {user.allowedModules ? "مخصصة" : "الكل"}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-2">
                      <Badge className={cn(
                        "w-fit",
                        user.status === "approved" && "bg-green-100 text-green-700 hover:bg-green-100",
                        user.status === "pending" && "bg-amber-100 text-amber-700 hover:bg-amber-100",
                        user.status === "rejected" && "bg-red-100 text-red-700 hover:bg-red-100",
                        user.status === "deleted" && "bg-gray-100 text-gray-500 hover:bg-gray-100"
                      )}>
                        {user.status === "approved" ? "معتمد" : user.status === "pending" ? "في الانتظار" : user.status === "rejected" ? "مرفوض" : "محذوف"}
                      </Badge>
                      {user.status === "approved" && (
                        <Button
                          size="sm"
                          variant={user.status === "approved" ? "outline" : "default"}
                          className="text-xs h-7"
                          onClick={() => toggleActive.mutate({ userId: user.id, activate: false })}
                        >
                          تعطيل
                        </Button>
                      )}
                      {user.status === "rejected" && (
                        <Button
                          size="sm"
                          className="text-xs h-7 bg-green-600 hover:bg-green-700"
                          onClick={() => toggleActive.mutate({ userId: user.id, activate: true })}
                        >
                          تفعيل
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {formatLastLogin(user.lastLoginAt ?? null)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2 flex-wrap">
                      {user.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => approveUser({ userId: user.id.toString() })}
                            disabled={isApproving}
                            className="bg-green-600 hover:bg-green-700 text-white gap-1"
                          >
                            <Check className="h-4 w-4" /> موافقة
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => rejectUser({ userId: user.id.toString() })}
                            disabled={isRejecting}
                            className="gap-1"
                          >
                            <X className="h-4 w-4" /> رفض
                          </Button>
                        </>
                      )}
                      <Link href={`/admin/users/${user.id}`}>
                        <Button size="sm" variant="outline" className="gap-1">
                          <Eye className="h-4 w-4" /> عرض
                        </Button>
                      </Link>
                      {user.id !== me?.id && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 border-red-200 text-red-700 hover:bg-red-50"
                          onClick={() => setDeleteTarget({ id: user.id, name: user.name, email: user.email })}
                        >
                          <Trash2 className="h-4 w-4" /> حذف
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
