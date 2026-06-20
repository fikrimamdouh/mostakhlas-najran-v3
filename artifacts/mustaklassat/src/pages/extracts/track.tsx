import { useState } from "react";
import { useUser } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import {
  Clock, CheckCircle, XCircle, Eye, ChevronDown, ChevronUp,
  Building2, CalendarDays, FileText, Banknote, RefreshCw, Pencil, RotateCcw,
} from "lucide-react";

type ExtractType = "labor" | "consumables" | "spare_parts" | "health_centers" | "admin_offices";
type ExtractStatus = "submitted" | "under_review" | "approved" | "rejected" | "needs_revision";

interface SubmittedExtract {
  id: number;
  extractType: ExtractType;
  companyName: string | null;
  contractNumber: string | null;
  hospitalName: string | null;
  periodMonth: string | null;
  totalAmount: string | null;
  status: ExtractStatus;
  revisionCount: number;
  revisedAt: string | null;
  notes: string | null;
  adminNotes: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  submittedByName?: string;
  submittedByEmail?: string;
  userId?: number;
}

const TYPE_LABELS: Record<ExtractType, string> = {
  labor: "مستخلص العمالة",
  consumables: "مستخلص المستهلكات",
  spare_parts: "مستخلص قطع الغيار",
  health_centers: "مستخلص المراكز الصحية",
  admin_offices: "مستخلص المكاتب الإدارية",
};

const TYPE_PARTS: Record<ExtractType, string[]> = {
  labor: ["الحضور والانصراف", "جداول الأداء", "شهادة الإنجاز"],
  consumables: ["المستهلكات والمواد الهندسية"],
  spare_parts: ["قطع الغيار"],
  health_centers: ["عمالة المراكز", "مستهلكات المراكز"],
  admin_offices: ["عمالة المكاتب الإدارية", "مستهلكات المكاتب الإدارية"],
};

const TYPE_PAGES: Record<ExtractType, string> = {
  labor: "/original/attendance.html",
  consumables: "/original/consumables.html",
  health_centers: "/original/health_centers_attendance.html",
  spare_parts: "/original/spare_parts.html",
  admin_offices: "/original/admin_offices_attendance.html",
};

const STATUS_CONFIG: Record<ExtractStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  submitted: { label: "بانتظار المراجعة", color: "#2a5298", bg: "#eff6ff", icon: <Clock className="h-4 w-4" /> },
  under_review: { label: "قيد المراجعة", color: "#b45309", bg: "#fffbeb", icon: <Eye className="h-4 w-4" /> },
  approved: { label: "معتمد ✓", color: "#16a34a", bg: "#f0fdf4", icon: <CheckCircle className="h-4 w-4" /> },
  rejected: { label: "مرفوض", color: "#dc2626", bg: "#fef2f2", icon: <XCircle className="h-4 w-4" /> },
  needs_revision: { label: "يحتاج تعديل", color: "#ea580c", bg: "#fff7ed", icon: <Pencil className="h-4 w-4" /> },
};

function useSubmittedExtracts() {
  const { getToken } = useAuth();
  return useQuery<{ extracts: SubmittedExtract[]; total: number }>({
    queryKey: ["/api/submitted-extracts-lite"],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch("/api/submitted-extracts-lite", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    refetchInterval: 300000,
  });
}

function useUpdateStatus() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, adminNotes }: { id: number; status: ExtractStatus; adminNotes?: string }) => {
      const token = await getToken();
      const res = await fetch(`/api/submitted-extracts/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ status, adminNotes }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/submitted-extracts-lite"] }),
  });
}

function parseExtractData(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try { return JSON.parse(value || "{}"); }
    catch { return {}; }
  }
  if (typeof value === "object") return value as Record<string, unknown>;
  return {};
}

function writeLocalStorageValue(key: string, value: unknown) {
  if (value == null) return;
  localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
}

function backupCurrentLocalStorageBeforeRevision(extractId: number) {
  try {
    const backup: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const value = localStorage.getItem(key);
      if (value != null) backup[key] = value;
    }
    localStorage.setItem("najran_revision_previous_local_backup", JSON.stringify({
      extractId,
      createdAt: new Date().toISOString(),
      data: backup,
    }));
  } catch (_) {}
}

function clearOperationalKeysBeforeRevision() {
  const exactKeys = [
    "attendanceData", "ng_attendanceData", "nd_attendanceData",
    "centersAttendanceData_v2", "healthCentersAttendanceData", "adminOfficesAttendanceData_v1",
    "persistentExtractData", "extractMonth", "extractYear", "extractStart", "extractEnd",
    "extractFromDate", "extractToDate", "paymentNumber", "extractNumber", "periodMonth",
    "performanceData", "performanceData_v4", "performanceDeductions", "performanceTotalDeduction", "performanceTotalDue",
    "achievementData", "achievementTitles_v1", "achievementItemNames",
    "consumablesTableData", "healthCentersConsumables", "mainHospitalConsumables", "admin_offices_consumables_v1.0",
    "spare_partsData", "sparePartsTotalAmount", "approvalData", "displayApprovalData",
    "finalLaborCost", "finalConsumablesCost", "grand-net-total", "grand-net-total-centers", "grand-net-total-admin",
    "najran_labor_attendance_done", "najran_labor_performance_done", "najran_health_attendance_done", "najran_admin_offices_attendance_done",
  ];

  const prefixes = [
    "deptCalculatedCost_", "dept_", "tableData_", "achievement_", "consumables_", "spare_",
    "water_", "sewage_", "subcontractors_", "najran_labor_", "najran_health_", "najran_admin_", "monthSnapshot_",
  ];

  exactKeys.forEach(key => localStorage.removeItem(key));
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (prefixes.some(prefix => key.startsWith(prefix))) localStorage.removeItem(key);
  }
}

function StatusBadge({ status, revisionCount }: { status: ExtractStatus; revisionCount?: number }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
        style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30` }}
      >
        {cfg.icon}
        {cfg.label}
      </span>
      {revisionCount != null && revisionCount > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
          style={{ background: "#f3f4f6", color: "#6b7280", border: "1px solid #e5e7eb" }}>
          <RotateCcw className="h-3 w-3" />
          مراجعة {revisionCount}
        </span>
      )}
    </div>
  );
}

function PreReviewEditBanner({ onEdit }: { extract: SubmittedExtract; onEdit: () => void | Promise<void> }) {
  return (
    <div className="rounded-xl p-4 border-2 flex flex-col gap-3" style={{ background: "#eff6ff", borderColor: "#bfdbfe" }}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#2563eb" }}>
          <Pencil className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="font-bold text-sm" style={{ color: "#1d4ed8" }}>يمكنك تعديل المستخلص قبل بدء المراجعة</p>
          <p className="text-xs mt-1" style={{ color: "#1e40af" }}>التعديل سيحمل نفس البيانات المرفوعة، ثم يعيد رفع نفس المستخلص بدون إنشاء مستخلص جديد.</p>
        </div>
      </div>
      <button
        onClick={onEdit}
        className="self-start flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
        style={{ background: "linear-gradient(135deg,#2563eb,#1d4ed8)" }}
      >
        <Pencil className="h-4 w-4" />
        تعديل المستخلص قبل المراجعة
      </button>
    </div>
  );
}

function RevisionBanner({ extract, onRevise }: { extract: SubmittedExtract; onRevise: () => void | Promise<void> }) {
  return (
    <div className="rounded-xl p-4 border-2 flex flex-col gap-3" style={{ background: "#fff7ed", borderColor: "#fed7aa" }}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "#ea580c" }}>
          <Pencil className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="font-bold text-sm" style={{ color: "#c2410c" }}>طُلب منك تعديل هذا المستخلص</p>
          {extract.adminNotes && (
            <p className="text-sm mt-1" style={{ color: "#7c2d12" }}>{extract.adminNotes}</p>
          )}
        </div>
      </div>
      <button
        onClick={onRevise}
        className="self-start flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
        style={{ background: "linear-gradient(135deg,#ea580c,#c2410c)" }}
      >
        <Pencil className="h-4 w-4" />
        تعديل وإعادة الرفع
      </button>
    </div>
  );
}

function RejectedBanner({ extract, onRevise }: { extract: SubmittedExtract; onRevise: () => void | Promise<void> }) {
  return (
    <div className="rounded-xl p-4 border-2 flex flex-col gap-3" style={{ background: "#fef2f2", borderColor: "#fecaca" }}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "#dc2626" }}>
          <XCircle className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="font-bold text-sm" style={{ color: "#b91c1c" }}>تم رفض هذا المستخلص</p>
          {extract.adminNotes && (
            <p className="text-sm mt-1" style={{ color: "#7f1d1d" }}>{extract.adminNotes}</p>
          )}
          <p className="text-xs mt-2" style={{ color: "#b91c1c" }}>يمكنك تعديل البيانات وإعادة الرفع</p>
        </div>
      </div>
      <button
        onClick={onRevise}
        className="self-start flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
        style={{ background: "linear-gradient(135deg,#dc2626,#b91c1c)" }}
      >
        <Pencil className="h-4 w-4" />
        تعديل وإعادة الرفع
      </button>
    </div>
  );
}

function ExtractCard({ extract, isAdmin, currentUserId }: {
  extract: SubmittedExtract; isAdmin: boolean; currentUserId?: number
}) {
  const { getToken } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [adminNotes, setAdminNotes] = useState(extract.adminNotes || "");
  const [showNotes, setShowNotes] = useState(false);
  const [isPreparingRevision, setIsPreparingRevision] = useState(false);
  const updateStatus = useUpdateStatus();

  const isOwner = extract.userId === currentUserId;

  const handleStatus = (status: ExtractStatus) => {
    updateStatus.mutate({ id: extract.id, status, adminNotes: adminNotes || undefined });
    setShowNotes(false);
  };
  function parseLocalValue(key: string): any {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return localStorage.getItem(key);
    }
  }

  function hasMeaningfulObject(value: any): boolean {
    if (!value) return false;

    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed !== "" && trimmed !== "{}" && trimmed !== "[]" && trimmed !== "0";
    }

    if (Array.isArray(value)) return value.length > 0;

    if (typeof value === "object") {
      return Object.keys(value).length > 0;
    }

    return !!value;
  }

  function hasActiveLocalWork(): boolean {
    if (localStorage.getItem("najran_revision_extract_id")) return false;
    if (localStorage.getItem("najran_revision_mode") === "true") return false;

    const exactKeys = [
      "attendanceData",
      "ng_attendanceData",
      "nd_attendanceData",
      "healthCentersAttendanceData",
      "centersAttendanceData_v2",
      "adminOfficesAttendanceData_v1",
      "achievementData",
      "consumablesTableData",
      "healthCentersConsumables",
      "mainHospitalConsumables",
      "admin_offices_consumables_v1.0",
      "spare_partsData",
      "sparePartsTotalAmount"
    ];

    for (const key of exactKeys) {
      if (hasMeaningfulObject(parseLocalValue(key))) return true;
    }

   
    const stepKeys = [
      "najran_labor_attendance_done",
      "najran_labor_performance_done",
      "najran_health_attendance_done",
      "najran_admin_offices_attendance_done"
    ];

    for (const key of stepKeys) {
      if (localStorage.getItem(key) === "1") return true;
    }

    return false;
  }

  function blockRevisionBecauseLocalWorkExists(): boolean {
    if (!hasActiveLocalWork()) return false;

    alert(
      "يوجد شغل محلي حالي على هذا الجهاز لمستخلص آخر.\n\n" +
      "قبل فتح مستخلص قديم للتعديل، يجب إنهاء المستخلص الحالي ورفعه بالطريقة المعتادة:\n\n" +
      "الحضور والانصراف → جداول الأداء → شهادة الإنجاز → رفع المستخلص.\n\n" +
      "بعد رفع المستخلص الحالي، ارجع إلى متابعة المستخلصات وافتح طلب التعديل مرة أخرى."
    );

    return true;
  }
  const handleRevise = async () => {
    if (isPreparingRevision) return;
   if (blockRevisionBecauseLocalWorkExists()) return;
    setIsPreparingRevision(true);

    try {
      const token = await getToken();
      const res = await fetch(`/api/submitted-extracts/${extract.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });

      if (!res.ok) {
        alert("تعذر تحميل بيانات المستخلص للتعديل");
        return;
      }

      const full = await res.json();
      const data = parseExtractData(full.extractData);

      if (!data || Object.keys(data).length === 0) {
        alert("لا توجد بيانات محفوظة داخل هذا المستخلص للتعديل");
        return;
      }

      backupCurrentLocalStorageBeforeRevision(extract.id);
      clearOperationalKeysBeforeRevision();

      Object.entries(data).forEach(([key, value]) => writeLocalStorageValue(key, value));

      localStorage.setItem("najran_revision_extract_id", String(extract.id));
      localStorage.setItem("najran_revision_mode", "true");
      localStorage.setItem("najran_revision_extract_type", String(full.extractType || extract.extractType));
      localStorage.setItem("najran_revision_started_at", new Date().toISOString());

      if (full.companyName) localStorage.setItem("companyName", String(full.companyName));
      if (full.contractNumber) localStorage.setItem("contractNumber", String(full.contractNumber));
      if (full.hospitalName) localStorage.setItem("hospitalName", String(full.hospitalName));
      if (full.periodMonth) localStorage.setItem("periodMonth", String(full.periodMonth));
      if (full.totalAmount != null) localStorage.setItem("najran_revision_previous_total_amount", String(full.totalAmount));

      window.location.href = TYPE_PAGES[extract.extractType] || "/original/attendance.html";
    } catch (err) {
      console.error("Failed to start extract revision", err);
      alert("حدث خطأ أثناء تجهيز المستخلص للتعديل");
    } finally {
      setIsPreparingRevision(false);
    }
  };

  const fmt = (d: string | null) => d
    ? new Date(d).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" })
    : "—";

  const parts = TYPE_PARTS[extract.extractType] || [];
  const canEditBeforeReview = isOwner && extract.status === "submitted";
  const canRevise = isOwner && (extract.status === "needs_revision" || extract.status === "rejected");

  return (
    <div className="bg-white rounded-2xl shadow-sm border overflow-hidden transition-all"
      style={{ borderColor: extract.status === "needs_revision" ? "#fed7aa" : extract.status === "rejected" ? "#fecaca" : "#e5e7eb", direction: "rtl" }}>
      <div
        className="flex items-center justify-between p-5 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: extract.status === "needs_revision" ? "linear-gradient(135deg,#ea580c,#c2410c)" : "linear-gradient(135deg,#1e3c72,#2a5298)" }}>
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-base" style={{ color: "#1e3c72" }}>
              {TYPE_LABELS[extract.extractType] || "مستخلص"}
            </p>
            <p className="text-sm text-gray-500 mt-0.5">
              {extract.companyName || "—"} {extract.periodMonth ? `· ${extract.periodMonth}` : ""}
            </p>
            {isAdmin && extract.submittedByName && (
              <p className="text-xs text-gray-400 mt-0.5">رُفع بواسطة: {extract.submittedByName}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge status={extract.status} revisionCount={extract.revisionCount} />
          {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t px-5 pb-5 pt-4 space-y-4" style={{ borderColor: "#f3f4f6" }}>
          {canEditBeforeReview && (
            <PreReviewEditBanner extract={extract} onEdit={handleRevise} />
          )}
          {canRevise && extract.status === "needs_revision" && (
            <RevisionBanner extract={extract} onRevise={handleRevise} />
          )}
          {canRevise && extract.status === "rejected" && (
            <RejectedBanner extract={extract} onRevise={handleRevise} />
          )}
          {isPreparingRevision && (
            <div className="rounded-xl p-3 text-sm font-semibold" style={{ background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" }}>
              جاري تحميل بيانات المستخلص القديمة للتعديل...
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: <Building2 className="h-4 w-4" />, label: "الشركة", value: extract.companyName },
              { icon: <FileText className="h-4 w-4" />, label: "رقم العقد", value: extract.contractNumber },
              { icon: <CalendarDays className="h-4 w-4" />, label: "الفترة", value: extract.periodMonth },
              { icon: <Banknote className="h-4 w-4" />, label: "القيمة", value: extract.totalAmount ? `${Number(extract.totalAmount).toLocaleString()} ر.س` : null },
            ].map(({ icon, label, value }) => (
              <div key={label} className="rounded-xl p-3" style={{ background: "#f9fafb" }}>
                <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">{icon}{label}</div>
                <p className="text-sm font-semibold text-gray-700">{value || "—"}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 mb-2">مكونات المستخلص</p>
            <div className="flex flex-wrap gap-2">
              {parts.map(p => (
                <span key={p} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium"
                  style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}>
                  <CheckCircle className="h-3.5 w-3.5" />
                  {p}
                </span>
              ))}
            </div>
          </div>

          <div className="text-xs space-y-1" style={{ color: "#9ca3af" }}>
            <p>تاريخ الرفع: {fmt(extract.createdAt)}</p>
            {extract.revisionCount > 0 && extract.revisedAt && (
              <p className="font-medium" style={{ color: "#ea580c" }}>
                آخر تعديل: {fmt(extract.revisedAt)} (مراجعة رقم {extract.revisionCount})
              </p>
            )}
            {extract.approvedAt && <p>تاريخ الاعتماد: {fmt(extract.approvedAt)}{extract.approvedBy ? ` · بواسطة: ${extract.approvedBy}` : ""}</p>}
          </div>

          {extract.adminNotes && extract.status !== "needs_revision" && extract.status !== "rejected" && (
            <div className="rounded-xl p-3 text-sm" style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
              <p className="font-semibold text-amber-700 mb-1">ملاحظات المراجع:</p>
              <p className="text-amber-800">{extract.adminNotes}</p>
            </div>
          )}

          {isAdmin && extract.status !== "approved" && (
            <div className="space-y-3 pt-1 border-t" style={{ borderColor: "#f3f4f6" }}>
              <p className="text-xs font-semibold text-gray-400 pt-1">إجراءات المراجع</p>
              {showNotes && (
                <textarea
                  value={adminNotes}
                  onChange={e => setAdminNotes(e.target.value)}
                  placeholder="ملاحظات للمستخدم (ستظهر له)..."
                  rows={2}
                  className="w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                  style={{ direction: "rtl" }}
                />
              )}
              <div className="flex items-center gap-2 flex-wrap">
                {extract.status === "submitted" && (
                  <button onClick={() => handleStatus("under_review")} disabled={updateStatus.isPending}
                    className="px-4 py-2 rounded-xl text-sm font-bold transition-opacity hover:opacity-80"
                    style={{ background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a" }}>
                    <Eye className="h-4 w-4 inline ml-1.5" />بدء المراجعة
                  </button>
                )}
                <button onClick={() => setShowNotes(!showNotes)}
                  className="px-4 py-2 rounded-xl text-sm font-bold transition-opacity hover:opacity-80"
                  style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb" }}>
                  {showNotes ? "إخفاء" : "إضافة ملاحظة"}
                </button>
                {extract.status !== "needs_revision" && (
                  <button onClick={() => handleStatus("needs_revision")} disabled={updateStatus.isPending}
                    className="px-4 py-2 rounded-xl text-sm font-bold transition-opacity hover:opacity-80"
                    style={{ background: "#fff7ed", color: "#ea580c", border: "1px solid #fed7aa" }}>
                    <Pencil className="h-4 w-4 inline ml-1.5" />طلب تعديل
                  </button>
                )}
                <button onClick={() => handleStatus("approved")} disabled={updateStatus.isPending}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-80"
                  style={{ background: "linear-gradient(135deg,#16a34a,#15803d)" }}>
                  <CheckCircle className="h-4 w-4 inline ml-1.5" />اعتماد
                </button>
                {extract.status !== "rejected" && (
                  <button onClick={() => handleStatus("rejected")} disabled={updateStatus.isPending}
                    className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-80"
                    style={{ background: "linear-gradient(135deg,#dc2626,#b91c1c)" }}>
                    <XCircle className="h-4 w-4 inline ml-1.5" />رفض
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ExtractsTrack() {
  const { user } = useUser();
  const { data, isLoading, refetch, isRefetching } = useSubmittedExtracts();
  const [filter, setFilter] = useState<ExtractStatus | "all">("all");

  const dbUserId = (user?.publicMetadata?.dbUserId as number) | 0;
  const isAdmin = (user?.publicMetadata?.role as string) === "admin"
    || (user?.publicMetadata?.role as string) === "supervisor";

  const extracts = data?.extracts || [];
  const filtered = filter === "all" ? extracts : extracts.filter(e => e.status === filter);

  const counts = {
    all: extracts.length,
    submitted: extracts.filter(e => e.status === "submitted").length,
    under_review: extracts.filter(e => e.status === "under_review").length,
    needs_revision: extracts.filter(e => e.status === "needs_revision").length,
    approved: extracts.filter(e => e.status === "approved").length,
    rejected: extracts.filter(e => e.status === "rejected").length,
  };

  const needsActionCount = isAdmin
    ? counts.submitted
    : (counts.needs_revision + counts.rejected);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6" style={{ direction: "rtl" }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: "#1e3c72" }}>متابعة المستخلصات</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isAdmin ? "جميع المستخلصات المرفوعة من المستخدمين" : "مستخلصاتي المرفوعة للاعتماد"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {needsActionCount > 0 && (
            <span className="px-3 py-1.5 rounded-xl text-xs font-bold text-white"
              style={{ background: isAdmin ? "#2a5298" : "#ea580c" }}>
              {needsActionCount} {isAdmin ? "بانتظار مراجعتك" : "يحتاج تعديل"}
            </span>
          )}
          <button onClick={() => refetch()} disabled={isRefetching}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-opacity hover:opacity-80"
            style={{ background: "#eff6ff", color: "#2a5298", border: "1px solid #bfdbfe" }}>
            <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
            تحديث
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {([
          { key: "submitted", label: "بانتظار المراجعة", color: "#2a5298", bg: "#eff6ff" },
          { key: "under_review", label: "قيد المراجعة", color: "#b45309", bg: "#fffbeb" },
          { key: "needs_revision", label: "يحتاج تعديل", color: "#ea580c", bg: "#fff7ed" },
          { key: "approved", label: "معتمدة", color: "#16a34a", bg: "#f0fdf4" },
          { key: "rejected", label: "مرفوضة", color: "#dc2626", bg: "#fef2f2" },
        ] as const).map(({ key, label, color, bg }) => (
          <div key={key} className="rounded-xl p-3 text-center cursor-pointer transition-all hover:scale-105"
            style={{ background: bg, border: `1px solid ${color}20` }}
            onClick={() => setFilter(key)}>
            <p className="text-xl font-extrabold" style={{ color }}>{counts[key]}</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-tight">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {([
          { key: "all", label: `الكل (${counts.all})` },
          { key: "submitted", label: `بانتظار المراجعة (${counts.submitted})` },
          { key: "needs_revision", label: `يحتاج تعديل (${counts.needs_revision})` },
          { key: "approved", label: `معتمدة (${counts.approved})` },
          { key: "rejected", label: `مرفوضة (${counts.rejected})` },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => setFilter(key)}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={filter === key ? { background: "#1e3c72", color: "#fff" } : { background: "#f3f4f6", color: "#6b7280" }}>
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 opacity-40" />
          <p>جاري التحميل...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 rounded-2xl" style={{ background: "#f9fafb" }}>
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-20 text-gray-400" />
          <p className="font-semibold text-gray-400">لا توجد مستخلصات</p>
          <p className="text-sm text-gray-400 mt-1">
            {filter === "all" ? "لم يتم رفع أي مستخلصات بعد" : `لا يوجد مستخلصات بهذه الحالة`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(extract => (
            <ExtractCard key={extract.id} extract={extract} isAdmin={isAdmin} currentUserId={dbUserId} />
          ))}
        </div>
      )}
    </div>
  );
}
