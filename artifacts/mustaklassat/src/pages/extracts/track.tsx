import { useState } from "react";
import { useUser, useAuth } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, CheckCircle, XCircle, Eye, ChevronDown, ChevronUp, Building2, CalendarDays, FileText, Banknote, Pencil, RotateCcw, RefreshCw } from "lucide-react";

type ExtractType = "labor" | "consumables" | "spare_parts" | "health_centers" | "admin_offices";
type ExtractStatus = "submitted" | "under_review" | "approved" | "rejected" | "needs_revision";
type AdminOfficePart = "labor" | "consumables" | null;
type RevisionDecision = "save" | "skip" | "cancel";

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
  adminOfficePart?: AdminOfficePart;
  sourceModule?: string | null;
  reviewScope?: string | null;
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

const REVISION_KEYS = {
  mode: "najran_revision_mode",
  extractId: "najran_revision_extract_id",
  extractType: "najran_revision_extract_type",
  startedAt: "najran_revision_started_at",
  bootLock: "najran_revision_boot_lock",
  source: "najran_revision_source",
  snapshot: "najran_revision_snapshot",
};

const LOCAL_WORK_KEYS = [
  "attendanceData",
  "adminOfficesAttendanceData_v1",
  "centersAttendanceData_v2",
  "consumablesTableData",
  "spare_partsData",
  "persistentExtractData",
];

const STATUS_CONFIG: Record<ExtractStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  submitted: { label: "بانتظار المراجعة", color: "#2a5298", bg: "#eff6ff", icon: <Clock className="h-4 w-4" /> },
  under_review: { label: "قيد المراجعة", color: "#b45309", bg: "#fffbeb", icon: <Eye className="h-4 w-4" /> },
  approved: { label: "معتمد ✓", color: "#16a34a", bg: "#f0fdf4", icon: <CheckCircle className="h-4 w-4" /> },
  rejected: { label: "مرفوض", color: "#dc2626", bg: "#fef2f2", icon: <XCircle className="h-4 w-4" /> },
  needs_revision: { label: "يحتاج تعديل", color: "#ea580c", bg: "#fff7ed", icon: <Pencil className="h-4 w-4" /> },
};

function adminPart(extract: Pick<SubmittedExtract, "adminOfficePart" | "sourceModule" | "reviewScope">): AdminOfficePart {
  if (extract.adminOfficePart === "labor" || extract.adminOfficePart === "consumables") return extract.adminOfficePart;
  if (extract.reviewScope === "admin_offices_labor_only" || extract.sourceModule === "admin_offices_attendance") return "labor";
  if (extract.reviewScope === "admin_offices_consumables_only" || extract.sourceModule === "admin_offices_consumables") return "consumables";
  return null;
}

function labelFor(extract: SubmittedExtract) {
  if (extract.extractType !== "admin_offices") return TYPE_LABELS[extract.extractType] || "مستخلص";
  const part = adminPart(extract);
  if (part === "labor") return "مستخلص عمالة المكاتب";
  if (part === "consumables") return "مستخلص مستهلكات المكاتب";
  return TYPE_LABELS.admin_offices;
}

function partsFor(extract: SubmittedExtract) {
  if (extract.extractType !== "admin_offices") return TYPE_PARTS[extract.extractType] || [];
  const part = adminPart(extract);
  if (part === "labor") return ["عمالة المكاتب"];
  if (part === "consumables") return ["مستهلكات المكاتب"];
  return TYPE_PARTS.admin_offices;
}

function pageFor(extract: SubmittedExtract) {
  if (extract.extractType === "admin_offices") {
    return adminPart(extract) === "consumables" ? "/original/admin_offices_consumables.html" : "/original/admin_offices_attendance.html";
  }
  return TYPE_PAGES[extract.extractType] || "/original/attendance.html";
}

function parseData(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object") return value as Record<string, unknown>;
  if (typeof value === "string") { try { return JSON.parse(value || "{}"); } catch { return {}; } }
  return {};
}

function unwrapSnapshot(raw: Record<string, unknown>) {
  const candidates = [(raw as any).localStorageSnapshot, (raw as any).storageSnapshot, (raw as any).snapshot, (raw as any).submittedData, (raw as any).extractData];
  for (const candidate of candidates) {
    const parsed = parseData(candidate);
    if (Object.keys(parsed).length) return parsed;
  }
  return raw;
}

function localValueHasWork(raw: string | null): boolean {
  if (!raw) return false;
  const s = String(raw).trim();
  if (!s || s === "{}" || s === "[]" || s === "null" || s === "0") return false;
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) return parsed.length > 0;
    if (parsed && typeof parsed === "object") return Object.keys(parsed).some((key) => {
      const value = (parsed as Record<string, unknown>)[key];
      if (Array.isArray(value)) return value.length > 0;
      if (value && typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
      return String(value ?? "").trim() !== "";
    });
  } catch {
    return true;
  }
  return true;
}

function hasOpenLocalWork(): boolean {
  try {
    return LOCAL_WORK_KEYS.some((key) => localValueHasWork(localStorage.getItem(key)));
  } catch {
    return false;
  }
}

function collectLocalWorkSnapshot() {
  const data: Record<string, unknown> = {};
  try {
    LOCAL_WORK_KEYS.forEach((key) => {
      const raw = localStorage.getItem(key);
      if (localValueHasWork(raw)) data[key] = parseData(raw || "{}");
    });
  } catch {}
  return data;
}

function trySaveCurrentLocalWork(): boolean {
  const saveCandidates = [
    (window as any).saveCurrentSnapshot,
    (window as any).saveMonthSnapshot,
    (window as any).saveExtractSnapshot,
  ];

  for (const saveFn of saveCandidates) {
    if (typeof saveFn !== "function") continue;
    try {
      const result = saveFn("before-open-revision");
      if (result !== false) return true;
    } catch (err) {
      console.warn("[RevisionOpen] local save function failed", err);
    }
  }

  try {
    const extractData = collectLocalWorkSnapshot();
    if (!Object.keys(extractData).length) return true;
    const persistent = parseData(localStorage.getItem("persistentExtractData") || "{}");
    const archiveRaw = localStorage.getItem("extractArchive") || "[]";
    const archive = Array.isArray(JSON.parse(archiveRaw)) ? JSON.parse(archiveRaw) : [];
    archive.unshift({
      id: String(Date.now()),
      source: "track-before-open-revision",
      savedAt: new Date().toISOString(),
      canResume: true,
      compact: true,
      extractType: "local_work_before_revision",
      currentPage: location.pathname + location.search,
      paymentNumber: (persistent as any).paymentNumber || (persistent as any).extractNumber || localStorage.getItem("paymentNumber") || localStorage.getItem("extractNumber") || "",
      extractMonth: (persistent as any).extractMonth || localStorage.getItem("extractMonth") || "",
      extractYear: (persistent as any).extractYear || localStorage.getItem("extractYear") || "",
      hospitalName: localStorage.getItem("hospitalName") || "",
      companyName: localStorage.getItem("companyName") || "",
      label: "حفظ تلقائي قبل فتح التعديل",
      extractData,
    });
    localStorage.setItem("extractArchive", JSON.stringify(archive.slice(0, 20)));
    return true;
  } catch (err) {
    console.error("[RevisionOpen] fallback local save failed", err);
    return false;
  }
}

function askRevisionOpenDecision(): Promise<RevisionDecision> {
  return new Promise((resolve) => {
    const old = document.getElementById("revision-local-work-modal");
    if (old) old.remove();
    const overlay = document.createElement("div");
    overlay.id = "revision-local-work-modal";
    overlay.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;direction:rtl;font-family:Tajawal,Arial,sans-serif";
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:20px;box-shadow:0 22px 70px rgba(0,0,0,.28);max-width:520px;width:calc(100% - 34px);padding:26px;border-top:7px solid #1e3c72;text-align:right">
        <h3 style="margin:0 0 12px;color:#1e3c72;font-size:20px;font-weight:950">يوجد مستخلص مفتوح حاليًا</h3>
        <p style="margin:0 0 18px;color:#334155;font-weight:800;line-height:1.8">قبل فتح التعديل اختر:</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button data-decision="save" style="background:linear-gradient(135deg,#166534,#16a34a);color:#fff;border:0;border-radius:12px;padding:11px 16px;font-weight:900;cursor:pointer;font-family:inherit">حفظ الحالي وفتح التعديل</button>
          <button data-decision="skip" style="background:linear-gradient(135deg,#b45309,#ea580c);color:#fff;border:0;border-radius:12px;padding:11px 16px;font-weight:900;cursor:pointer;font-family:inherit">فتح التعديل بدون حفظ</button>
          <button data-decision="cancel" style="background:#e5e7eb;color:#334155;border:0;border-radius:12px;padding:11px 16px;font-weight:900;cursor:pointer;font-family:inherit">إلغاء</button>
        </div>
      </div>`;
    const finish = (decision: RevisionDecision) => {
      overlay.remove();
      resolve(decision);
    };
    overlay.addEventListener("click", (event) => {
      const btn = (event.target as HTMLElement)?.closest?.("button[data-decision]") as HTMLButtonElement | null;
      if (!btn) return;
      finish(btn.dataset.decision as RevisionDecision);
    });
    document.body.appendChild(overlay);
  });
}

function setRev(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch {}
  try { sessionStorage.setItem(key, value); } catch {}
  try {
    const real = (window as any)._najranRealStorage;
    if (real && typeof real.setItem === "function") real.setItem(key, value);
  } catch {}
}

function writeLocal(key: string, value: unknown) {
  try { localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value)); } catch {}
}

function useSubmittedExtracts() {
  const { getToken } = useAuth();
  return useQuery<{ extracts: SubmittedExtract[]; total: number }>({
    queryKey: ["/api/submitted-extracts-lite"],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch("/api/submitted-extracts-lite", { headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: "include" });
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
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/submitted-extracts-lite"] }),
  });
}

function StatusBadge({ status, revisionCount }: { status: ExtractStatus; revisionCount?: number }) {
  const cfg = STATUS_CONFIG[status];
  return <div className="flex items-center gap-2 flex-wrap"><span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold" style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30` }}>{cfg.icon}{cfg.label}</span>{revisionCount > 0 && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: "#f3f4f6", color: "#6b7280", border: "1px solid #e5e7eb" }}><RotateCcw className="h-3 w-3" />مراجعة {revisionCount}</span>}</div>;
}

function ExtractCard({ extract, isAdmin, currentUserId }: { extract: SubmittedExtract; isAdmin: boolean; currentUserId?: number }) {
  const { getToken } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [adminNotes, setAdminNotes] = useState(extract.adminNotes || "");
  const [showNotes, setShowNotes] = useState(false);
  const [isPreparingRevision, setIsPreparingRevision] = useState(false);
  const updateStatus = useUpdateStatus();
  const targetPage = pageFor(extract);
  const part = adminPart(extract);
  const isOwner = extract.userId === currentUserId;

  const handleStatus = (status: ExtractStatus) => { updateStatus.mutate({ id: extract.id, status, adminNotes: adminNotes || undefined }); setShowNotes(false); };

  const handleRevise = async () => {
    if (isPreparingRevision) return;
    setIsPreparingRevision(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/submitted-extracts/${extract.id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: "include" });
      if (!res.ok) { alert("تعذر تحميل بيانات المستخلص للتعديل"); return; }
      const full = await res.json();
      const data = unwrapSnapshot(parseData(full.extractData));
      if (!Object.keys(data).length) { alert("لا توجد بيانات محفوظة داخل هذا المستخلص للتعديل"); return; }

      if (hasOpenLocalWork()) {
        const decision = await askRevisionOpenDecision();
        if (decision === "cancel") return;
        if (decision === "save") {
          const saved = trySaveCurrentLocalWork();
          if (!saved) {
            alert("تعذر حفظ المستخلص الحالي بسبب امتلاء التخزين أو خطأ في الحفظ. لم يتم فتح التعديل. يمكنك اختيار فتح التعديل بدون حفظ إذا أردت المتابعة على مسؤوليتك.");
            return;
          }
        }
      }

      const startedAt = new Date().toISOString();
      const snapshot = JSON.stringify(data);
      setRev(REVISION_KEYS.mode, "true");
      setRev(REVISION_KEYS.extractId, String(extract.id));
      setRev(REVISION_KEYS.extractType, String(full.extractType || extract.extractType));
      setRev(REVISION_KEYS.startedAt, startedAt);
      setRev(REVISION_KEYS.bootLock, "true");
      setRev(REVISION_KEYS.source, "submitted_extract_snapshot");
      setRev(REVISION_KEYS.snapshot, snapshot);
      if (part) setRev("najran_revision_admin_office_part", part);
      Object.entries(data).forEach(([key, value]) => writeLocal(key, value));
      if (full.companyName) localStorage.setItem("companyName", String(full.companyName));
      if (full.contractNumber) localStorage.setItem("contractNumber", String(full.contractNumber));
      if (full.hospitalName) localStorage.setItem("hospitalName", String(full.hospitalName));
      if (full.periodMonth) localStorage.setItem("periodMonth", String(full.periodMonth));
      if (full.totalAmount != null) setRev("najran_revision_previous_total_amount", String(full.totalAmount));
      if (part) localStorage.setItem("najran_last_submitted_admin_office_part", part);
      window.location.href = targetPage;
    } catch (err) {
      console.error("Failed to start extract revision", err);
      alert("حدث خطأ أثناء تجهيز المستخلص للتعديل");
    } finally {
      setIsPreparingRevision(false);
    }
  };

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" }) : "—";
  const canEdit = isOwner && (extract.status === "submitted" || extract.status === "needs_revision" || extract.status === "rejected");

  return <div className="bg-white rounded-2xl shadow-sm border overflow-hidden transition-all" style={{ borderColor: extract.status === "needs_revision" ? "#fed7aa" : extract.status === "rejected" ? "#fecaca" : "#e5e7eb", direction: "rtl" }}>
    <div className="flex items-center justify-between p-5 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setExpanded(!expanded)}>
      <div className="flex items-center gap-4"><div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: extract.status === "needs_revision" ? "linear-gradient(135deg,#ea580c,#c2410c)" : "linear-gradient(135deg,#1e3c72,#2a5298)" }}><FileText className="h-5 w-5 text-white" /></div><div><p className="font-bold text-base" style={{ color: "#1e3c72" }}>{labelFor(extract)}</p><p className="text-sm text-gray-500 mt-0.5">{extract.companyName || "—"} {extract.periodMonth ? `· ${extract.periodMonth}` : ""}</p>{extract.extractType === "admin_offices" && part && <p className="text-xs mt-0.5 font-bold" style={{ color: part === "labor" ? "#2563eb" : "#7c3aed" }}>{part === "labor" ? "عمالة المكاتب" : "مستهلكات المكاتب"}</p>}{isAdmin && extract.submittedByName && <p className="text-xs text-gray-400 mt-0.5">رُفع بواسطة: {extract.submittedByName}</p>}</div></div>
      <div className="flex items-center gap-3"><StatusBadge status={extract.status} revisionCount={extract.revisionCount} />{expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}</div>
    </div>
    {expanded && <div className="border-t px-5 pb-5 pt-4 space-y-4" style={{ borderColor: "#f3f4f6" }}>
      {canEdit && <div className="rounded-xl p-4 border-2 flex flex-col gap-3" style={{ background: extract.status === "submitted" ? "#eff6ff" : "#fff7ed", borderColor: extract.status === "submitted" ? "#bfdbfe" : "#fed7aa" }}><p className="font-bold text-sm" style={{ color: extract.status === "submitted" ? "#1d4ed8" : "#c2410c" }}>{extract.status === "submitted" ? "يمكنك تعديل المستخلص قبل بدء المراجعة" : "مطلوب تعديل هذا المستخلص"}</p><p className="text-xs" style={{ color: "#475569" }}>سيتم فتح صفحة: {targetPage}</p><button onClick={handleRevise} className="self-start flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90" style={{ background: "linear-gradient(135deg,#2563eb,#1d4ed8)" }}><Pencil className="h-4 w-4" />{extract.status === "submitted" ? "تعديل المستخلص قبل المراجعة" : "تعديل وإعادة الرفع"}</button></div>}
      {isPreparingRevision && <div className="rounded-xl p-3 text-sm font-semibold" style={{ background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" }}>جاري تحميل بيانات المستخلص القديمة للتعديل...</div>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[{ icon: <Building2 className="h-4 w-4" />, label: "الشركة", value: extract.companyName }, { icon: <FileText className="h-4 w-4" />, label: "رقم العقد", value: extract.contractNumber }, { icon: <CalendarDays className="h-4 w-4" />, label: "الفترة", value: extract.periodMonth }, { icon: <Banknote className="h-4 w-4" />, label: "القيمة", value: extract.totalAmount ? `${Number(extract.totalAmount).toLocaleString()} ر.س` : null }].map(({ icon, label, value }) => <div key={label} className="rounded-xl p-3" style={{ background: "#f9fafb" }}><div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">{icon}{label}</div><p className="text-sm font-semibold text-gray-700">{value || "—"}</p></div>)}</div>
      <div><p className="text-xs font-semibold text-gray-400 mb-2">مكونات المستخلص</p><div className="flex flex-wrap gap-2">{partsFor(extract).map(p => <span key={p} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium" style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}><CheckCircle className="h-3.5 w-3.5" />{p}</span>)}</div></div>
      <div className="text-xs space-y-1" style={{ color: "#9ca3af" }}><p>تاريخ الرفع: {fmt(extract.createdAt)}</p>{extract.revisionCount > 0 && extract.revisedAt && <p className="font-medium" style={{ color: "#ea580c" }}>آخر تعديل: {fmt(extract.revisedAt)} (مراجعة رقم {extract.revisionCount})</p>}{extract.approvedAt && <p>تاريخ الاعتماد: {fmt(extract.approvedAt)}{extract.approvedBy ? ` · بواسطة: ${extract.approvedBy}` : ""}</p>}</div>
      {extract.adminNotes && <div className="rounded-xl p-3 text-sm" style={{ background: "#fffbeb", border: "1px solid #fde68a" }}><p className="font-semibold text-amber-700 mb-1">ملاحظات المراجع:</p><p className="text-amber-800">{extract.adminNotes}</p></div>}
      {isAdmin && extract.status !== "approved" && <div className="space-y-3 pt-1 border-t" style={{ borderColor: "#f3f4f6" }}><p className="text-xs font-semibold text-gray-400 pt-1">إجراءات المراجع</p>{showNotes && <textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} placeholder="ملاحظات للمستخدم (ستظهر له)..." rows={2} className="w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" style={{ direction: "rtl" }} />}<div className="flex items-center gap-2 flex-wrap">{extract.status === "submitted" && <button onClick={() => handleStatus("under_review")} disabled={updateStatus.isPending} className="px-4 py-2 rounded-xl text-sm font-bold transition-opacity hover:opacity-80" style={{ background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a" }}><Eye className="h-4 w-4 inline ml-1.5" />بدء المراجعة</button>}<button onClick={() => setShowNotes(!showNotes)} className="px-4 py-2 rounded-xl text-sm font-bold transition-opacity hover:opacity-80" style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb" }}>{showNotes ? "إخفاء" : "إضافة ملاحظة"}</button>{extract.status !== "needs_revision" && <button onClick={() => handleStatus("needs_revision")} disabled={updateStatus.isPending} className="px-4 py-2 rounded-xl text-sm font-bold transition-opacity hover:opacity-80" style={{ background: "#fff7ed", color: "#ea580c", border: "1px solid #fed7aa" }}><Pencil className="h-4 w-4 inline ml-1.5" />طلب تعديل</button>}<button onClick={() => handleStatus("approved")} disabled={updateStatus.isPending} className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-80" style={{ background: "linear-gradient(135deg,#16a34a,#15803d)" }}><CheckCircle className="h-4 w-4 inline ml-1.5" />اعتماد</button>{extract.status !== "rejected" && <button onClick={() => handleStatus("rejected")} disabled={updateStatus.isPending} className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-80" style={{ background: "linear-gradient(135deg,#dc2626,#b91c1c)" }}><XCircle className="h-4 w-4 inline ml-1.5" />رفض</button>}</div></div>}
    </div>}
  </div>;
}

export default function ExtractsTrack() {
  const { user } = useUser();
  const { data, isLoading, refetch, isRefetching } = useSubmittedExtracts();
  const [filter, setFilter] = useState<ExtractStatus | "all">("all");
  const dbUserId = Number(user?.publicMetadata?.dbUserId || 0);
  const role = String(user?.publicMetadata?.role || "");
  const isAdmin = role === "admin" || role === "supervisor";
  const extracts = data?.extracts || [];
  const filtered = filter === "all" ? extracts : extracts.filter(e => e.status === filter);
  const counts = { all: extracts.length, submitted: extracts.filter(e => e.status === "submitted").length, under_review: extracts.filter(e => e.status === "under_review").length, needs_revision: extracts.filter(e => e.status === "needs_revision").length, approved: extracts.filter(e => e.status === "approved").length, rejected: extracts.filter(e => e.status === "rejected").length };
  const needsActionCount = isAdmin ? counts.submitted : (counts.needs_revision + counts.rejected);
  return <div className="max-w-4xl mx-auto px-4 py-8 space-y-6" style={{ direction: "rtl" }}><div className="flex items-center justify-between"><div><h1 className="text-2xl font-extrabold" style={{ color: "#1e3c72" }}>متابعة المستخلصات</h1><p className="text-sm text-gray-500 mt-1">تابع حالة المستخلصات المرفوعة للاعتماد</p></div><button onClick={() => refetch()} disabled={isRefetching} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all" style={{ background: "#eff6ff", color: "#1e3c72", border: "1px solid #bfdbfe" }}><RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />تحديث</button></div>{needsActionCount > 0 && <div className="rounded-2xl p-4 border" style={{ background: isAdmin ? "#eff6ff" : "#fff7ed", borderColor: isAdmin ? "#bfdbfe" : "#fed7aa" }}><p className="font-bold" style={{ color: isAdmin ? "#1d4ed8" : "#c2410c" }}>{isAdmin ? `${needsActionCount} مستخلص بانتظار المراجعة` : `${needsActionCount} مستخلص يحتاج إجراء منك`}</p></div>}<div className="flex gap-2 overflow-x-auto pb-2">{([["all", "الكل", counts.all], ["submitted", "بانتظار", counts.submitted], ["under_review", "قيد المراجعة", counts.under_review], ["needs_revision", "تعديل", counts.needs_revision], ["approved", "معتمد", counts.approved], ["rejected", "مرفوض", counts.rejected]] as [ExtractStatus | "all", string, number][]).map(([key, label, count]) => <button key={key} onClick={() => setFilter(key)} className="px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all" style={{ background: filter === key ? "#1e3c72" : "#ffffff", color: filter === key ? "#ffffff" : "#374151", border: "1px solid #e5e7eb" }}>{label} ({count})</button>)}</div>{isLoading ? <div className="text-center py-12 text-gray-500">جاري التحميل...</div> : filtered.length === 0 ? <div className="text-center py-12 bg-white rounded-2xl border" style={{ borderColor: "#e5e7eb" }}><FileText className="h-12 w-12 mx-auto text-gray-300 mb-3" /><p className="text-gray-500">لا توجد مستخلصات</p></div> : <div className="space-y-3">{filtered.map(extract => <ExtractCard key={extract.id} extract={extract} isAdmin={isAdmin} currentUserId={dbUserId} />)}</div>}</div>;
}
