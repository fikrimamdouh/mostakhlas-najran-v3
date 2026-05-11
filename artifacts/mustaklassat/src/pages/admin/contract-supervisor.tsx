import { useState } from "react";
import { useAuth } from "@clerk/react";
import { useGetMe } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Building2, Users, FileText, Search, RefreshCw,
  CheckCircle, XCircle, Clock, AlertCircle, Eye,
  History, ChevronDown, ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import ExtractDataViewer from "@/components/extracts/ExtractDataViewer";

const COMPANY_LABELS: Record<string, string> = {
  "تجمع_نجران": "تجمع نجران الصحي",
  "بيت_العرب": "بيت العرب",
  "سراكو": "سراكو",
};

const EXTRACT_TYPE_LABELS: Record<string, string> = {
  labor: "مستخلص العمالة",
  consumables: "مستخلص المستهلكات",
  spare_parts: "مستخلص قطع الغيار",
  health_centers: "مستخلص المراكز الصحية",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  submitted:      { label: "مُقدَّم",        color: "text-blue-600 border-blue-300 bg-blue-50",       icon: Clock },
  under_review:   { label: "قيد المراجعة",   color: "text-amber-600 border-amber-300 bg-amber-50",    icon: AlertCircle },
  approved:       { label: "معتمد",           color: "text-green-600 border-green-300 bg-green-50",    icon: CheckCircle },
  rejected:       { label: "مرفوض",           color: "text-red-600 border-red-300 bg-red-50",          icon: XCircle },
  needs_revision: { label: "يحتاج تعديل",    color: "text-orange-600 border-orange-300 bg-orange-50", icon: AlertCircle },
};

const ROLE_LABELS: Record<string, string> = {
  admin: "مدير النظام",
  supervisor: "مدير مستخلصات",
  contract_supervisor: "مشرف عقد",
  user: "مستخدم",
};

const STATUS_AR: Record<string, string> = {
  submitted: "تقديم",
  under_review: "قيد المراجعة",
  approved: "اعتماد",
  rejected: "رفض",
  needs_revision: "طلب تعديل",
};

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return iso; }
}

function formatAmount(v: string | number | null) {
  if (!v) return "—";
  return Number(v).toLocaleString("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 });
}

type TabType = "users" | "extracts";

export default function ContractSupervisorPage() {
  const { getToken } = useAuth();
  const { data: me } = useGetMe({ query: { queryKey: ["/api/users/me"] } });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabType>("extracts");
  const [search, setSearch] = useState("");
  const [selectedExtract, setSelectedExtract] = useState<any | null>(null);

  const company = (me as any)?.contractCompany ?? "";
  const companyLabel = COMPANY_LABELS[company] ?? company;

  const { data: usersData, isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ["/api/users/company", company],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(`/api/users/company/${encodeURIComponent(company)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("failed");
      return res.json() as Promise<{ users: any[]; total: number }>;
    },
    enabled: !!company,
  });

  const { data: extractsData, isLoading: extractsLoading, refetch: refetchExtracts } = useQuery({
    queryKey: ["/api/submitted-extracts", "company", company],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(`/api/submitted-extracts`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("failed");
      return res.json() as Promise<{ extracts: any[]; total: number }>;
    },
    enabled: !!company,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, adminNotes }: { id: number; status: string; adminNotes?: string }) => {
      const token = await getToken();
      const res = await fetch(`/api/submitted-extracts/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ status, adminNotes }),
      });
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    onSuccess: (_, { id, status }) => {
      const label = STATUS_CONFIG[status]?.label ?? status;
      toast({ title: "✅ تم", description: `تم تغيير حالة المستخلص إلى: ${label}` });
      queryClient.invalidateQueries({ queryKey: ["/api/submitted-extracts", "company", company] });
      // Refresh selected extract
      if (selectedExtract) {
        const updated = extractsData?.extracts.find((e: any) => e.id === selectedExtract.id);
        if (updated) setSelectedExtract({ ...updated, status });
      }
      // عند الاعتماد — ضع إشارة في localStorage حتى تقدّم صفحة الإعدادات للفترة التالية
      if (status === "approved") {
        try {
          localStorage.setItem('najran_advance_period', JSON.stringify({
            approvedAt: new Date().toISOString(),
            extractId: id,
          }));
        } catch (_) {}
      }
    },
    onError: () => toast({ title: "خطأ", description: "فشل تحديث الحالة", variant: "destructive" }),
  });

  const users = (usersData?.users ?? []).filter(u => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (u.name ?? "").toLowerCase().includes(s) || u.email.toLowerCase().includes(s) || (u.hospital ?? "").toLowerCase().includes(s);
  });

  const extracts = (extractsData?.extracts ?? []).filter(e => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (e.submittedByName ?? "").toLowerCase().includes(s) ||
           (e.hospitalName ?? "").toLowerCase().includes(s) ||
           (e.submittedByHospital ?? "").toLowerCase().includes(s);
  });

  const pendingCount = extracts.filter((e: any) => e.status === "submitted" || e.status === "under_review").length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500" style={{ direction: "rtl" }}>
      {selectedExtract && (
        <ExtractDetailModal
          extract={selectedExtract}
          getToken={getToken}
          onClose={() => setSelectedExtract(null)}
          onUpdateStatus={(status, notes) => updateStatus.mutate({ id: selectedExtract.id, status, adminNotes: notes })}
          isPending={updateStatus.isPending}
        />
      )}

      {/* Header */}
      <div className="rounded-2xl p-6" style={{ background: "linear-gradient(135deg,#1e3c72,#2a5298)", color: "#fff" }}>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-extrabold flex items-center gap-3">
              <Building2 className="h-7 w-7" style={{ color: "#d4af37" }} />
              لوحة مشرف العقد
            </h1>
            <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>
              الشركة: <span className="font-bold text-white">{companyLabel || "—"}</span>
            </p>
          </div>
          <div className="flex gap-3 text-center">
            <div className="rounded-xl px-4 py-2" style={{ background: "rgba(255,255,255,0.12)" }}>
              <div className="text-2xl font-bold" style={{ color: "#d4af37" }}>{usersData?.total ?? "—"}</div>
              <div className="text-xs mt-0.5 opacity-75">مستخدم</div>
            </div>
            <div className="rounded-xl px-4 py-2" style={{ background: "rgba(255,255,255,0.12)" }}>
              <div className="text-2xl font-bold" style={{ color: "#d4af37" }}>{extractsData?.total ?? "—"}</div>
              <div className="text-xs mt-0.5 opacity-75">مستخلص</div>
            </div>
            {pendingCount > 0 && (
              <div className="rounded-xl px-4 py-2" style={{ background: "rgba(212,175,55,0.25)", border: "1px solid #d4af37" }}>
                <div className="text-2xl font-bold text-yellow-300">{pendingCount}</div>
                <div className="text-xs mt-0.5 opacity-75">بانتظار المراجعة</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl p-1" style={{ background: "#f0f2f8" }}>
        {([
          { key: "extracts" as TabType, label: "المستخلصات", icon: FileText },
          { key: "users" as TabType, label: "المستخدمون", icon: Users },
        ]).map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSearch(""); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                tab === t.key ? "bg-white shadow-sm text-[#1e3c72] font-bold" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Search + refresh */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder={tab === "extracts" ? "بحث بالاسم أو الموقع..." : "بحث بالاسم أو البريد أو الموقع..."}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>
        <Button variant="outline" size="sm" className="gap-2"
          onClick={() => tab === "extracts" ? refetchExtracts() : refetchUsers()}>
          <RefreshCw className="h-4 w-4" />
          تحديث
        </Button>
      </div>

      {/* ──── EXTRACTS TABLE ──── */}
      {tab === "extracts" && (
        <div className="rounded-xl border overflow-hidden shadow-sm" style={{ borderColor: "#e8edf7" }}>
          <Table>
            <TableHeader>
              <TableRow style={{ background: "linear-gradient(135deg,#1e3c72,#2a5298)" }}>
                <TableHead className="font-bold text-right text-white">مقدّم المستخلص</TableHead>
                <TableHead className="font-bold text-right text-white">الموقع</TableHead>
                <TableHead className="font-bold text-right text-white">النوع</TableHead>
                <TableHead className="font-bold text-right text-white">الفترة</TableHead>
                <TableHead className="font-bold text-right text-white">المبلغ</TableHead>
                <TableHead className="font-bold text-right text-white">الحالة</TableHead>
                <TableHead className="font-bold text-center text-white">مراجعة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {extractsLoading ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center text-gray-400">جاري التحميل...</TableCell></TableRow>
              ) : extracts.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center text-gray-400">لا توجد مستخلصات</TableCell></TableRow>
              ) : extracts.map((e: any, i: number) => {
                const sc = STATUS_CONFIG[e.status] ?? { label: e.status, color: "", icon: Clock };
                const Icon = sc.icon;
                const isPending = e.status === "submitted" || e.status === "under_review";
                return (
                  <TableRow key={e.id}
                    className={cn(i % 2 === 0 ? "bg-white" : "bg-gray-50/50", isPending && "border-r-4 border-r-amber-400")}>
                    <TableCell className="font-medium text-gray-800">
                      {e.submittedByName ?? "—"}
                      {e.revisionCount > 0 && (
                        <span className="mr-2 text-xs px-1.5 py-0.5 rounded-full" style={{ background: "#fff7ed", color: "#ea580c" }}>
                          تعديل {e.revisionCount}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm">{e.submittedByHospital ?? e.hospitalName ?? "—"}</TableCell>
                    <TableCell className="text-gray-600 text-sm">{EXTRACT_TYPE_LABELS[e.extractType] ?? e.extractType}</TableCell>
                    <TableCell className="text-gray-500 text-sm">{e.periodMonth ?? "—"}</TableCell>
                    <TableCell className="font-semibold text-sm" style={{ color: "#1e3c72" }}>{formatAmount(e.totalAmount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("gap-1 text-xs", sc.color)}>
                        <Icon className="h-3 w-3" />
                        {sc.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button size="sm" variant="outline"
                        className={cn("h-7 px-3 gap-1 text-xs font-bold",
                          isPending
                            ? "text-amber-700 border-amber-300 hover:bg-amber-50"
                            : "text-blue-700 border-blue-200 hover:bg-blue-50"
                        )}
                        onClick={() => setSelectedExtract(e)}>
                        <Eye className="h-3 w-3" />
                        {isPending ? "مراجعة" : "عرض"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ──── USERS TABLE ──── */}
      {tab === "users" && (
        <div className="rounded-xl border overflow-hidden shadow-sm" style={{ borderColor: "#e8edf7" }}>
          <Table>
            <TableHeader>
              <TableRow style={{ background: "linear-gradient(135deg,#1e3c72,#2a5298)" }}>
                <TableHead className="font-bold text-right text-white">الاسم</TableHead>
                <TableHead className="font-bold text-right text-white">البريد</TableHead>
                <TableHead className="font-bold text-right text-white">الموقع</TableHead>
                <TableHead className="font-bold text-right text-white">الوظيفة</TableHead>
                <TableHead className="font-bold text-right text-white">الحالة</TableHead>
                <TableHead className="font-bold text-right text-white">آخر دخول</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersLoading ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center text-gray-400">جاري التحميل...</TableCell></TableRow>
              ) : users.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center text-gray-400">لا يوجد مستخدمون</TableCell></TableRow>
              ) : users.map((u: any, i: number) => (
                <TableRow key={u.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                  <TableCell className="font-semibold text-gray-800">{u.name}</TableCell>
                  <TableCell className="text-gray-500 text-sm">{u.email}</TableCell>
                  <TableCell className="text-gray-600 text-sm">{u.hospital ?? "—"}</TableCell>
                  <TableCell className="text-gray-500 text-sm">{u.jobTitle ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      u.status === "approved" ? "text-green-600 border-green-300 bg-green-50" :
                      u.status === "rejected" ? "text-red-600 border-red-300 bg-red-50" :
                      "text-amber-600 border-amber-300 bg-amber-50"
                    }>
                      {u.status === "approved" ? "✓ مقبول" : u.status === "rejected" ? "✗ مرفوض" : "⏳ معلق"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-400 text-xs">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString("ar-SA") : "لم يسجّل دخولاً"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// مودال تفاصيل المستخلص — مع البيانات الكاملة وسجل التعديلات
// ────────────────────────────────────────────────────────────────────────
function ExtractDetailModal({ extract, getToken, onClose, onUpdateStatus, isPending }: {
  extract: any;
  getToken: () => Promise<string | null>;
  onClose: () => void;
  onUpdateStatus: (status: string, notes?: string) => void;
  isPending: boolean;
}) {
  const [notes, setNotes] = useState(extract.adminNotes ?? "");
  const [activeTab, setActiveTab] = useState<"summary" | "data" | "history">("summary");
  const [showNotes, setShowNotes] = useState(false);

  const sc = STATUS_CONFIG[extract.status] ?? { label: extract.status, color: "", icon: Clock };
  const StatusIcon = sc.icon;

  // Parse extractData
  const extractData: Record<string, any> | null = (() => {
    if (!extract.extractData) return null;
    try { return JSON.parse(extract.extractData); } catch { return null; }
  })();

  // Revision history
  const { data: revisionsData } = useQuery({
    queryKey: ["/api/submitted-extracts", extract.id, "revisions"],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch(`/api/submitted-extracts/${extract.id}/revisions`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return { revisions: [] };
      return res.json() as Promise<{ revisions: any[] }>;
    },
  });
  const revisions = revisionsData?.revisions ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)", direction: "rtl" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 flex items-center justify-between flex-shrink-0" style={{ background: "linear-gradient(135deg,#1e3c72,#2a5298)", color: "#fff" }}>
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <FileText className="h-5 w-5" style={{ color: "#d4af37" }} />
              {EXTRACT_TYPE_LABELS[extract.extractType] ?? extract.extractType}
            </h3>
            <p className="text-sm mt-0.5 text-white/70">{extract.submittedByName} · {extract.submittedByHospital ?? extract.hospitalName}</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className={cn("gap-1 border-white/30 text-white bg-white/10", )}>
              <StatusIcon className="h-3 w-3" />
              {sc.label}
            </Badge>
            <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b flex-shrink-0" style={{ borderColor: "#e8edf7" }}>
          {([
            { key: "summary" as const, label: "الملخص", badge: null as string | null },
            { key: "data" as const, label: "البيانات الكاملة", badge: extractData ? "✓" : null as string | null },
            { key: "history" as const, label: "سجل التعديلات", badge: revisions.length > 0 ? String(revisions.length) : null as string | null },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={cn(
                "flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2",
                activeTab === t.key
                  ? "border-[#1e3c72] text-[#1e3c72] bg-blue-50/50"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              {t.label}
              {t.badge && (
                <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                  style={{ background: activeTab === t.key ? "#1e3c72" : "#e5e7eb", color: activeTab === t.key ? "#fff" : "#6b7280" }}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === "summary" && (
            <div className="space-y-4">
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "مقدّم المستخلص", value: extract.submittedByName },
                  { label: "الموقع", value: extract.submittedByHospital ?? extract.hospitalName },
                  { label: "نوع المستخلص", value: EXTRACT_TYPE_LABELS[extract.extractType] ?? extract.extractType },
                  { label: "الفترة", value: extract.periodMonth },
                  { label: "المبلغ الإجمالي", value: formatAmount(extract.totalAmount) },
                  { label: "رقم العقد", value: extract.contractNumber },
                  { label: "تاريخ التقديم", value: formatDate(extract.createdAt) },
                  { label: "عدد التعديلات", value: extract.revisionCount > 0 ? `${extract.revisionCount} تعديل` : "لا توجد تعديلات" },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl p-3" style={{ background: "#f8f9fe", border: "1px solid #e8edf7" }}>
                    <p className="text-xs text-gray-400 mb-1">{label}</p>
                    <p className="font-semibold text-sm text-gray-800">{value ?? "—"}</p>
                  </div>
                ))}
              </div>
              {extract.notes && (
                <div className="rounded-xl p-3" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                  <p className="text-xs font-semibold text-green-700 mb-1">ملاحظات المستخدم</p>
                  <p className="text-sm text-green-800">{extract.notes}</p>
                </div>
              )}
              {extract.adminNotes && (
                <div className="rounded-xl p-3" style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
                  <p className="text-xs font-semibold text-amber-700 mb-1">ملاحظات المشرف الأخيرة</p>
                  <p className="text-sm text-amber-800">{extract.adminNotes}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "data" && (
            <ExtractDataViewer
              extractType={extract.extractType}
              extractData={extractData}
            />
          )}

          {activeTab === "history" && (
            <div className="space-y-3">
              {revisions.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <History className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p>لا يوجد سجل تعديلات بعد</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute right-5 top-0 bottom-0 w-0.5" style={{ background: "#e8edf7" }} />
                  <div className="space-y-4">
                    {revisions.map((r: any, i: number) => {
                      const isApproval = r.newStatus === "approved";
                      const isRevision = r.newStatus === "needs_revision" || r.newStatus === "rejected";
                      const isSubmit = r.newStatus === "submitted";
                      return (
                        <div key={r.id} className="flex gap-4 relative">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10 text-white text-xs font-bold shadow",
                            isApproval ? "bg-green-500" : isRevision ? "bg-orange-500" : "bg-blue-500"
                          )}>
                            {isApproval ? "✓" : isRevision ? "!" : i + 1}
                          </div>
                          <div className="flex-1 rounded-xl p-3 mb-1" style={{ background: "#f8f9fe", border: "1px solid #e8edf7" }}>
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div>
                                <span className="font-bold text-sm" style={{ color: "#1e3c72" }}>{r.changedBy}</span>
                                <span className="text-xs text-gray-400 mr-2">{ROLE_LABELS[r.changedByRole] ?? r.changedByRole}</span>
                              </div>
                              <span className="text-xs text-gray-400">{formatDate(r.createdAt)}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              {r.previousStatus && (
                                <>
                                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#e5e7eb", color: "#6b7280" }}>
                                    {STATUS_AR[r.previousStatus] ?? r.previousStatus}
                                  </span>
                                  <ChevronRight className="h-3 w-3 text-gray-300" />
                                </>
                              )}
                              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                                isApproval ? "bg-green-100 text-green-700" :
                                isRevision ? "bg-orange-100 text-orange-700" :
                                "bg-blue-100 text-blue-700"
                              )}>
                                {STATUS_AR[r.newStatus] ?? r.newStatus}
                              </span>
                            </div>
                            {r.notes && (
                              <p className="text-sm mt-2 text-gray-600 bg-white rounded-lg p-2" style={{ border: "1px solid #e8edf7" }}>
                                {r.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions footer */}
        {extract.status !== "approved" && (
          <div className="p-4 border-t flex-shrink-0" style={{ borderColor: "#e8edf7" }}>
            {showNotes && (
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none mb-3"
                style={{ direction: "rtl", borderColor: "#d1d5db" }}
                placeholder="أضف ملاحظة للمستخدم (ستظهر له عند الإشعار)..."
              />
            )}
            <div className="flex flex-wrap gap-2 justify-between items-center">
              <button
                onClick={() => setShowNotes(!showNotes)}
                className="text-sm text-gray-500 underline hover:text-gray-700"
              >
                {showNotes ? "إخفاء الملاحظات" : "إضافة ملاحظة"}
              </button>
              <div className="flex gap-2 flex-wrap">
                {extract.status !== "under_review" && (
                  <Button size="sm" variant="outline" className="gap-1 text-amber-700 border-amber-300 hover:bg-amber-50"
                    onClick={() => onUpdateStatus("under_review", notes)} disabled={isPending}>
                    <AlertCircle className="h-3.5 w-3.5" /> بدء المراجعة
                  </Button>
                )}
                {extract.status !== "needs_revision" && (
                  <Button size="sm" variant="outline" className="gap-1 text-orange-700 border-orange-300 hover:bg-orange-50"
                    onClick={() => onUpdateStatus("needs_revision", notes)} disabled={isPending}>
                    <AlertCircle className="h-3.5 w-3.5" /> طلب تعديل
                  </Button>
                )}
                {extract.status !== "rejected" && (
                  <Button size="sm" variant="destructive" className="gap-1"
                    onClick={() => onUpdateStatus("rejected", notes)} disabled={isPending}>
                    <XCircle className="h-3.5 w-3.5" /> رفض
                  </Button>
                )}
                <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => onUpdateStatus("approved", notes)} disabled={isPending}>
                  <CheckCircle className="h-3.5 w-3.5" /> اعتماد ✓
                </Button>
              </div>
            </div>
          </div>
        )}

        {extract.status === "approved" && (
          <div className="p-4 border-t text-center flex-shrink-0" style={{ borderColor: "#e8edf7", background: "#f0fdf4" }}>
            <p className="text-green-700 font-bold text-sm">
              ✓ تم اعتماد هذا المستخلص بواسطة {extract.approvedBy ?? "المشرف"}
            </p>
            {extract.approvedAt && <p className="text-green-600 text-xs mt-0.5">{formatDate(extract.approvedAt)}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
