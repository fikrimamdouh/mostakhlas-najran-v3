import { useState, useMemo } from "react";
import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { useGetMe } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart3, Search, RefreshCw, CheckCircle2,
  Clock, XCircle, FileText, Building2, Eye,
} from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  submitted:      "مقدَّم",
  under_review:   "قيد المراجعة",
  approved:       "معتمد",
  rejected:       "مرفوض",
  needs_revision: "يحتاج تعديل",
};

const STATUS_COLORS: Record<string, string> = {
  submitted:      "bg-blue-100 text-blue-800",
  under_review:   "bg-yellow-100 text-yellow-800",
  approved:       "bg-green-100 text-green-800",
  rejected:       "bg-red-100 text-red-800",
  needs_revision: "bg-orange-100 text-orange-800",
};

const TYPE_LABELS: Record<string, string> = {
  labor:          "عمالة",
  consumables:    "مستهلكات",
  spare_parts:    "قطع غيار",
  health_centers: "مراكز صحية",
  admin_offices:  "مكاتب إدارية",
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("ar-SA", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

interface Extract {
  id: number;
  extractType: string;
  companyName: string | null;
  contractNumber: string | null;
  hospitalName: string | null;
  periodMonth: string | null;
  totalAmount: string | null;
  status: string;
  revisionCount: number;
  notes: string | null;
  adminNotes: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  submittedByName: string | null;
  submittedByEmail: string | null;
  submittedByHospital: string | null;
  userId: number;
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: any; label: string; value: number | string; color: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border flex items-center gap-4" style={{ borderColor: "#e8edf7" }}>
      <div className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color + "20" }}>
        <Icon className="h-6 w-6" style={{ color }} />
      </div>
      <div>
        <p className="text-2xl font-bold" style={{ color: "#1e3c72" }}>{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}

export default function ViewerDashboard() {
  const { getToken } = useAuth();
  const { data: me } = useGetMe({ query: { queryKey: ["/api/users/me"] } });

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");

  const { data: extracts = [], isLoading, refetch, isFetching } = useQuery<Extract[]>({
    queryKey: ["/api/submitted-extracts/viewer"],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch("/api/submitted-extracts", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: !!me,
  });

  const filtered = useMemo(() => extracts.filter(e => {
    const txt = search.toLowerCase();
    const matchSearch =
      !txt ||
      (e.hospitalName || "").toLowerCase().includes(txt) ||
      (e.companyName || "").toLowerCase().includes(txt) ||
      (e.periodMonth || "").includes(txt) ||
      (e.contractNumber || "").toLowerCase().includes(txt);
    const matchStatus = filterStatus === "all" || e.status === filterStatus;
    const matchType   = filterType   === "all" || e.extractType === filterType;
    return matchSearch && matchStatus && matchType;
  }), [extracts, search, filterStatus, filterType]);

  const totalApproved  = extracts.filter(e => e.status === "approved").length;
  const totalPending   = extracts.filter(e => ["submitted", "under_review"].includes(e.status)).length;
  const totalRejected  = extracts.filter(e => e.status === "rejected").length;

  if (me?.role !== "viewer" && me?.role !== "admin" && me?.role !== "supervisor") {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        غير مصرح لك بالوصول لهذه الصفحة
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-500" dir="rtl" style={{ fontFamily: "Tajawal, sans-serif" }}>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "#1e3c72" }}>
            <Eye className="h-7 w-7" style={{ color: "#d4af37" }} />
            لوحة المراقبة — المستخلصات المقدَّمة
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">عرض فقط — لا يمكن تعديل أي بيانات</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          تحديث
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={FileText}     label="إجمالي المستخلصات" value={extracts.length}  color="#1e3c72" />
        <StatCard icon={CheckCircle2} label="معتمدة"             value={totalApproved}   color="#16a34a" />
        <StatCard icon={Clock}        label="قيد المراجعة"       value={totalPending}    color="#d97706" />
        <StatCard icon={XCircle}      label="مرفوضة"             value={totalRejected}   color="#dc2626" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="بحث بالمستشفى أو الشركة أو الشهر..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>

        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 cursor-pointer hover:border-blue-400"
        >
          <option value="all">كل الحالات</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 cursor-pointer hover:border-blue-400"
        >
          <option value="all">كل الأنواع</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        {(search || filterStatus !== "all" || filterType !== "all") && (
          <Button
            variant="ghost" size="sm"
            onClick={() => { setSearch(""); setFilterStatus("all"); setFilterType("all"); }}
            className="text-gray-500 hover:text-red-600 gap-1"
          >
            <XCircle className="h-4 w-4" /> مسح الفلاتر
          </Button>
        )}
      </div>

      {/* Summary by hospital */}
      <HospitalSummary extracts={filtered} />

      {/* Details table */}
      <div>
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={{ color: "#1e3c72" }}>
          <BarChart3 className="h-5 w-5" style={{ color: "#d4af37" }} />
          تفاصيل المستخلصات
          <span className="text-sm font-normal text-gray-400">({filtered.length})</span>
        </h2>

        <div className="rounded-xl border overflow-hidden shadow-sm" style={{ borderColor: "#e8edf7" }}>
          <Table>
            <TableHeader>
              <TableRow style={{ background: "linear-gradient(135deg,#1e3c72,#2a5298)" }}>
                <TableHead className="text-white font-bold text-right">المستشفى</TableHead>
                <TableHead className="text-white font-bold text-right">الشركة</TableHead>
                <TableHead className="text-white font-bold text-right">النوع</TableHead>
                <TableHead className="text-white font-bold text-right">الشهر</TableHead>
                <TableHead className="text-white font-bold text-right">المبلغ</TableHead>
                <TableHead className="text-white font-bold text-right">الحالة</TableHead>
                <TableHead className="text-white font-bold text-right">التاريخ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-gray-400">جاري التحميل...</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-gray-400">لا توجد مستخلصات مطابقة</TableCell>
                </TableRow>
              ) : (
                filtered.map((e, i) => (
                  <TableRow key={e.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"} style={{ borderBottom: "1px solid #f0f2f8" }}>
                    <TableCell className="font-medium text-gray-800">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        {e.hospitalName || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600 text-sm">{e.companyName || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {TYPE_LABELS[e.extractType] || e.extractType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-600 text-sm">{e.periodMonth || "—"}</TableCell>
                    <TableCell className="text-gray-700 font-medium text-sm">
                      {e.totalAmount
                        ? Number(e.totalAmount).toLocaleString("ar-SA", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " ر.س"
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${STATUS_COLORS[e.status] || ""}`}>
                        {STATUS_LABELS[e.status] || e.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-400 text-xs">{formatDate(e.createdAt)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function HospitalSummary({ extracts }: { extracts: Extract[] }) {
  const stats = useMemo(() => {
    const map = new Map<string, { total: number; approved: number; pending: number; rejected: number }>();
    for (const e of extracts) {
      const h = e.hospitalName || "غير محدد";
      if (!map.has(h)) map.set(h, { total: 0, approved: 0, pending: 0, rejected: 0 });
      const r = map.get(h)!;
      r.total++;
      if (e.status === "approved") r.approved++;
      else if (["submitted", "under_review"].includes(e.status)) r.pending++;
      else if (e.status === "rejected") r.rejected++;
    }
    return [...map.entries()]
      .map(([h, s]) => ({ hospital: h, ...s }))
      .sort((a, b) => b.total - a.total);
  }, [extracts]);

  if (stats.length === 0) return null;

  return (
    <div>
      <h2 className="text-lg font-bold mb-3 flex items-center gap-2" style={{ color: "#1e3c72" }}>
        <Building2 className="h-5 w-5" style={{ color: "#d4af37" }} />
        ملخص المستشفيات
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {stats.map(s => (
          <div key={s.hospital} className="bg-white rounded-xl p-4 border shadow-sm" style={{ borderColor: "#e8edf7" }}>
            <p className="font-bold text-sm mb-2 truncate" style={{ color: "#1e3c72" }}>{s.hospital}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">الكل: {s.total}</span>
              {s.approved > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">معتمد: {s.approved}</span>}
              {s.pending  > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">معلق: {s.pending}</span>}
              {s.rejected > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">مرفوض: {s.rejected}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
