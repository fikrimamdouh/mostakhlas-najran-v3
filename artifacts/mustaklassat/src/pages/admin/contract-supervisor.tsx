import { useState } from "react";
import { useAuth } from "@clerk/react";
import { useGetMe } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, Users, FileText, Search, RefreshCw, CheckCircle, XCircle, Clock, AlertCircle, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const COMPANY_LABELS: Record<string, string> = {
  "بيت_العرب": "بيت العرب",
  "سراكو": "سراكو",
};

const EXTRACT_TYPE_LABELS: Record<string, string> = {
  labor: "عمالة (حضور وانصراف)",
  consumables: "مستهلكات",
  spare_parts: "قطع غيار",
  health_centers: "مراكز صحية",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  submitted:      { label: "مُقدَّم",          color: "text-blue-600 border-blue-300 bg-blue-50",    icon: Clock },
  under_review:   { label: "قيد المراجعة",    color: "text-amber-600 border-amber-300 bg-amber-50", icon: AlertCircle },
  approved:       { label: "معتمد",            color: "text-green-600 border-green-300 bg-green-50", icon: CheckCircle },
  rejected:       { label: "مرفوض",            color: "text-red-600 border-red-300 bg-red-50",       icon: XCircle },
  needs_revision: { label: "يحتاج تعديل",     color: "text-orange-600 border-orange-300 bg-orange-50", icon: AlertCircle },
};

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" }); }
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

  // Fetch company users
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

  // Fetch company extracts (uses submitted-extracts endpoint which filters by company for contract_supervisor)
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

  // Update extract status
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
    onSuccess: (_, { status }) => {
      const label = STATUS_CONFIG[status]?.label ?? status;
      toast({ title: "✅ تم", description: `تم تغيير حالة المستخلص إلى: ${label}` });
      queryClient.invalidateQueries({ queryKey: ["/api/submitted-extracts", "company", company] });
      setSelectedExtract(null);
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500" style={{ direction: "rtl" }}>
      {/* Extract detail modal */}
      {selectedExtract && (
        <ExtractDetailModal
          extract={selectedExtract}
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
                <TableHead className="font-bold text-center text-white">تفاصيل</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {extractsLoading ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center text-gray-400">جاري التحميل...</TableCell></TableRow>
              ) : extracts.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center text-gray-400">لا توجد مستخلصات</TableCell></TableRow>
              ) : extracts.map((e, i) => {
                const sc = STATUS_CONFIG[e.status] ?? { label: e.status, color: "", icon: Clock };
                const Icon = sc.icon;
                return (
                  <TableRow key={e.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                    <TableCell className="font-medium text-gray-800">{e.submittedByName ?? "—"}</TableCell>
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
                      <Button size="sm" variant="outline" className="h-7 px-2 gap-1 text-xs text-blue-700 border-blue-200 hover:bg-blue-50"
                        onClick={() => setSelectedExtract(e)}>
                        <Eye className="h-3 w-3" />
                        عرض
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
              ) : users.map((u, i) => (
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

function ExtractDetailModal({ extract, onClose, onUpdateStatus, isPending }: {
  extract: any;
  onClose: () => void;
  onUpdateStatus: (status: string, notes?: string) => void;
  isPending: boolean;
}) {
  const [notes, setNotes] = useState(extract.adminNotes ?? "");
  const sc = STATUS_CONFIG[extract.status] ?? { label: extract.status, color: "", icon: Clock };
  const StatusIcon = sc.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)", direction: "rtl" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-5 border-b flex items-center justify-between" style={{ background: "linear-gradient(135deg,#1e3c72,#2a5298)", color: "#fff" }}>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <FileText className="h-5 w-5" style={{ color: "#d4af37" }} />
            تفاصيل المستخلص
          </h3>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <Row label="مقدّم المستخلص" value={extract.submittedByName} />
          <Row label="الموقع" value={extract.submittedByHospital ?? extract.hospitalName} />
          <Row label="النوع" value={EXTRACT_TYPE_LABELS[extract.extractType] ?? extract.extractType} />
          <Row label="الفترة" value={extract.periodMonth} />
          <Row label="المبلغ" value={formatAmount(extract.totalAmount)} />
          <Row label="تاريخ التقديم" value={formatDate(extract.createdAt)} />
          {extract.notes && <Row label="ملاحظات المستخدم" value={extract.notes} />}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 font-medium">الحالة:</span>
            <Badge variant="outline" className={cn("gap-1", sc.color)}>
              <StatusIcon className="h-3 w-3" />
              {sc.label}
            </Badge>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: "#1e3c72" }}>ملاحظات المشرف</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              style={{ borderColor: "#d1d5db" }}
              placeholder="أضف ملاحظة للمستخدم..."
            />
          </div>
        </div>
        <div className="p-4 border-t flex flex-wrap gap-2 justify-end">
          {extract.status !== "under_review" && (
            <Button size="sm" variant="outline" className="gap-1 text-amber-700 border-amber-300 hover:bg-amber-50"
              onClick={() => onUpdateStatus("under_review", notes)} disabled={isPending}>
              <AlertCircle className="h-3.5 w-3.5" /> قيد المراجعة
            </Button>
          )}
          {extract.status !== "needs_revision" && (
            <Button size="sm" variant="outline" className="gap-1 text-orange-700 border-orange-300 hover:bg-orange-50"
              onClick={() => onUpdateStatus("needs_revision", notes)} disabled={isPending}>
              <AlertCircle className="h-3.5 w-3.5" /> يحتاج تعديل
            </Button>
          )}
          {extract.status !== "approved" && (
            <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700 text-white"
              onClick={() => onUpdateStatus("approved", notes)} disabled={isPending}>
              <CheckCircle className="h-3.5 w-3.5" /> اعتماد
            </Button>
          )}
          {extract.status !== "rejected" && (
            <Button size="sm" variant="destructive" className="gap-1"
              onClick={() => onUpdateStatus("rejected", notes)} disabled={isPending}>
              <XCircle className="h-3.5 w-3.5" /> رفض
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-sm text-gray-500 font-medium min-w-[120px]">{label}:</span>
      <span className="text-sm text-gray-800">{value ?? "—"}</span>
    </div>
  );
}
