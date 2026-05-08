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
  BarChart3, Search, RefreshCw, AlertTriangle, CheckCircle2,
  Clock, XCircle, FileText, Building2, TrendingDown, Filter,
} from "lucide-react";

const ADMIN_EMAIL = "rorofikri@gmail.com";

const STATUS_LABELS: Record<string, string> = {
  submitted: "مقدَّم",
  under_review: "قيد المراجعة",
  approved: "معتمد",
  rejected: "مرفوض",
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
  labor:         "عمالة",
  consumables:   "مستهلكات",
  spare_parts:   "قطع غيار",
  health_centers:"مراكز صحية",
  admin_offices: "مكاتب إدارية",
};

function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / 86400000);
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("ar-SA", { day: "2-digit", month: "short", year: "numeric" });
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

export default function ExtractsStats() {
  const { getToken } = useAuth();
  const { data: me } = useGetMe({ query: { queryKey: ["/api/users/me"] } });

  const [search, setSearch] = useState("");
  const [filterHospital, setFilterHospital] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [view, setView] = useState<"hospitals" | "details">("hospitals");

  const { data: extracts = [], isLoading, refetch } = useQuery<Extract[]>({
    queryKey: ["/api/submitted-extracts/all"],
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

  const hospitals = useMemo(() => [...new Set(extracts.map(e => e.hospitalName || "غير محدد"))].sort(), [extracts]);
  const types     = useMemo(() => [...new Set(extracts.map(e => e.extractType))].sort(), [extracts]);

  const filtered = useMemo(() => extracts.filter(e => {
    const hosp = e.hospitalName || "غير محدد";
    const txt  = search.toLowerCase();
    const matchSearch   = !txt || hosp.toLowerCase().includes(txt) || (e.submittedByName || "").toLowerCase().includes(txt) || (e.periodMonth || "").includes(txt);
    const matchHospital = filterHospital === "all" || hosp === filterHospital;
    const matchStatus   = filterStatus   === "all" || e.status === filterStatus;
    const matchType     = filterType     === "all" || e.extractType === filterType;
    return matchSearch && matchHospital && matchStatus && matchType;
  }), [extracts, search, filterHospital, filterStatus, filterType]);

  // Build per-hospital stats
  const hospitalStats = useMemo(() => {
    const map = new Map<string, { extracts: Extract[]; lastDate: string | null }>();
    for (const e of extracts) {
      const h = e.hospitalName || "غير محدد";
      if (!map.has(h)) map.set(h, { extracts: [], lastDate: null });
      const rec = map.get(h)!;
      rec.extracts.push(e);
      if (!rec.lastDate || e.createdAt > rec.lastDate) rec.lastDate = e.createdAt;
    }
    return [...map.entries()].map(([hospital, { extracts: hExtracts, lastDate }]) => ({
      hospital,
      total: hExtracts.length,
      approved: hExtracts.filter(e => e.status === "approved").length,
      pending:  hExtracts.filter(e => ["submitted", "under_review"].includes(e.status)).length,
      rejected: hExtracts.filter(e => e.status === "rejected").length,
      needsRevision: hExtracts.filter(e => e.status === "needs_revision").length,
      lastDate,
      daysSinceLast: daysSince(lastDate),
    })).sort((a, b) => (b.daysSinceLast ?? 999) - (a.daysSinceLast ?? 999));
  }, [extracts]);

  const totalApproved  = extracts.filter(e => e.status === "approved").length;
  const totalPending   = extracts.filter(e => ["submitted", "under_review"].includes(e.status)).length;
  const totalRejected  = extracts.filter(e => e.status === "rejected").length;
  const inactiveCount  = hospitalStats.filter(h => (h.daysSinceLast ?? 999) >= 45).length;

  const isAdmin = me?.role === "admin";
  const isSupervisor = me?.role === "supervisor";
  if (!isAdmin && !isSupervisor) {
    return <div className="flex items-center justify-center h-64 text-gray-500">غير مصرح لك بالوصول لهذه الصفحة</div>;
  }

  return (
    <div className="p-6 space-y-6" dir="rtl" style={{ fontFamily: "Tajawal, sans-serif" }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#1e3c72,#2a5298)" }}>
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold" style={{ color: "#1e3c72" }}>إحصائيات المستخلصات</h1>
            <p className="text-sm text-gray-500">{extracts.length} مستخلص إجمالي — {hospitals.length} موقع</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 text-xs">
          <RefreshCw className="h-3.5 w-3.5" /> تحديث
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "إجمالي المستخلصات", value: extracts.length, icon: FileText,       color: "#1e3c72", bg: "#eff6ff" },
          { label: "معتمدة",             value: totalApproved,  icon: CheckCircle2,    color: "#16a34a", bg: "#f0fdf4" },
          { label: "قيد المراجعة",       value: totalPending,   icon: Clock,           color: "#d97706", bg: "#fffbeb" },
          { label: "مواقع متأخرة ٤٥+ يوم", value: inactiveCount, icon: AlertTriangle,  color: "#dc2626", bg: "#fef2f2" },
        ].map(card => (
          <div key={card.label} className="rounded-2xl p-4 border" style={{ background: card.bg, borderColor: card.color + "30" }}>
            <div className="flex items-center gap-2 mb-2">
              <card.icon className="h-4 w-4" style={{ color: card.color }} />
              <span className="text-xs font-semibold" style={{ color: card.color }}>{card.label}</span>
            </div>
            <div className="text-2xl font-extrabold" style={{ color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* View toggle + filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: "#1e3c72" }}>
          {(["hospitals", "details"] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="px-4 py-2 text-xs font-bold transition-colors"
              style={{
                background: view === v ? "linear-gradient(135deg,#1e3c72,#2a5298)" : "#fff",
                color: view === v ? "#fff" : "#1e3c72",
              }}
            >
              {v === "hospitals" ? "📊 ملخص بالمواقع" : "📋 تفاصيل المستخلصات"}
            </button>
          ))}
        </div>

        <div className="flex-1 relative min-w-[180px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            placeholder="بحث..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pr-8 text-sm h-9"
          />
        </div>

        <select
          value={filterHospital}
          onChange={e => setFilterHospital(e.target.value)}
          className="text-xs border rounded-lg px-3 py-2 h-9 bg-white"
        >
          <option value="all">جميع المواقع</option>
          {hospitals.map(h => <option key={h} value={h}>{h}</option>)}
        </select>

        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="text-xs border rounded-lg px-3 py-2 h-9 bg-white"
        >
          <option value="all">جميع الحالات</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="text-xs border rounded-lg px-3 py-2 h-9 bg-white"
        >
          <option value="all">جميع الأنواع</option>
          {types.map(t => <option key={t} value={t}>{TYPE_LABELS[t] || t}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48 text-gray-400">
          <RefreshCw className="h-6 w-6 animate-spin ml-2" /> جاري التحميل...
        </div>
      ) : view === "hospitals" ? (
        /* ── Hospital summary view ── */
        <div className="rounded-2xl border overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow style={{ background: "linear-gradient(135deg,#1e3c72,#2a5298)" }}>
                {["الموقع / المستشفى", "إجمالي", "معتمد", "قيد المراجعة", "مرفوض", "آخر تقديم", "الحالة"].map(h => (
                  <TableHead key={h} className="text-white text-xs font-bold text-right py-3">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {hospitalStats.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-gray-400 py-12">لا توجد بيانات</TableCell></TableRow>
              ) : hospitalStats.map((h, idx) => {
                const isInactive = (h.daysSinceLast ?? 999) >= 45;
                const isWarning  = !isInactive && (h.daysSinceLast ?? 0) >= 30;
                return (
                  <TableRow key={h.hospital} className={idx % 2 === 0 ? "bg-gray-50/50" : ""}>
                    <TableCell className="font-bold text-sm" style={{ color: "#1e3c72" }}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 opacity-50" />
                        {h.hospital}
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-bold">{h.total}</TableCell>
                    <TableCell className="text-center">
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800">{h.approved}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      {h.pending > 0
                        ? <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800">{h.pending}</span>
                        : <span className="text-gray-400">—</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      {h.rejected > 0
                        ? <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800">{h.rejected}</span>
                        : <span className="text-gray-400">—</span>}
                    </TableCell>
                    <TableCell className="text-xs text-gray-600">
                      <div>{formatDate(h.lastDate)}</div>
                      {h.daysSinceLast !== null && (
                        <div className="text-xs" style={{ color: isInactive ? "#dc2626" : isWarning ? "#d97706" : "#16a34a" }}>
                          منذ {h.daysSinceLast} يوم
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {isInactive
                        ? <span className="flex items-center gap-1 text-xs font-bold text-red-600"><AlertTriangle className="h-3.5 w-3.5" /> متأخر</span>
                        : isWarning
                        ? <span className="flex items-center gap-1 text-xs font-bold text-yellow-600"><Clock className="h-3.5 w-3.5" /> تحذير</span>
                        : <span className="flex items-center gap-1 text-xs font-bold text-green-600"><CheckCircle2 className="h-3.5 w-3.5" /> منتظم</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        /* ── Detailed extracts view ── */
        <div className="rounded-2xl border overflow-hidden shadow-sm">
          <div className="px-4 py-2 text-xs text-gray-500 border-b bg-gray-50">
            يعرض {filtered.length} من {extracts.length} مستخلص
          </div>
          <Table>
            <TableHeader>
              <TableRow style={{ background: "linear-gradient(135deg,#1e3c72,#2a5298)" }}>
                {["الموقع", "النوع", "الفترة", "المبلغ", "المقدِّم", "الحالة", "تاريخ التقديم"].map(h => (
                  <TableHead key={h} className="text-white text-xs font-bold text-right py-3">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-gray-400 py-12">لا توجد نتائج</TableCell></TableRow>
              ) : filtered.map((e, idx) => (
                <TableRow key={e.id} className={idx % 2 === 0 ? "bg-gray-50/50" : ""}>
                  <TableCell className="font-semibold text-xs" style={{ color: "#1e3c72" }}>
                    {e.hospitalName || "—"}
                  </TableCell>
                  <TableCell className="text-xs">{TYPE_LABELS[e.extractType] || e.extractType}</TableCell>
                  <TableCell className="text-xs">{e.periodMonth || "—"}</TableCell>
                  <TableCell className="text-xs font-mono">
                    {e.totalAmount ? `${Number(e.totalAmount).toLocaleString("ar-SA")} ر` : "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div>{e.submittedByName || "—"}</div>
                    <div className="text-gray-400 text-[10px]">{e.submittedByEmail || ""}</div>
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${STATUS_COLORS[e.status] || "bg-gray-100 text-gray-700"}`}>
                      {STATUS_LABELS[e.status] || e.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">{formatDate(e.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
