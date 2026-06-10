import { useState, useMemo, useEffect } from "react";
import { useListUsers } from "@workspace/api-client-react";
import { useAuth } from "@clerk/react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Building2, Users, AlertCircle, ArrowRightLeft, X, CheckCircle2, Clock, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type CompanyKey = "الإدارة" | "بيت_العرب" | "سراكو";

const COMPANY_SITES: Record<CompanyKey, string[]> = {
 "الإدارة": [
  "المقر الرئيسي — تجمع نجران الصحي",
],
  "بيت_العرب": [
    "مستشفى يدمه العام",
    "مستشفى حبونا العام",
    "مستشفى بدر الجنوب العام",
    "مستشفى الولادة والأطفال",
    "مستشفى نجران العام القديم وسكن الممرضات الخارجي",
    "المكاتب الإدارية والمرافق الصحية",
    "صيانة وإصلاح السيارات والعيادات المتنقلة",
  ],
  "سراكو": [
    "مستشفى نجران العام الجديد",
    "مركز طب الأسنان التخصصي",
    "مجمع الأمل للصحة النفسية",
    "مستشفى ثار العام",
    "مستشفى خباش العام",
    "المراكز الصحية",
    "مستشفى الملك خالد",
    "مركز الأمير سلطان",
    "مستشفى شروره العام",
  ],
};

const COMPANY_TABS: { key: CompanyKey; label: string; icon: string }[] = [
  { key: "الإدارة", label: "الإدارة", icon: "🏢" },
  { key: "بيت_العرب", label: "بيت العرب", icon: "🏥" },
  { key: "سراكو", label: "سراكو", icon: "🏨" },
];

const ALL_HOSPITALS = Object.values(COMPANY_SITES).flat();

const ROLE_LABELS: Record<string, string> = {
  admin: "مدير النظام",
  supervisor: "مشرف",
  contract_supervisor: "مشرف عقد",
  viewer: "مراقب",
  user: "مستخدم",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "#d97706",
  supervisor: "#7c3aed",
  contract_supervisor: "#2563eb",
  viewer: "#0891b2",
  user: "#374151",
};

type AnyUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  hospital: string | null;
  hospitals?: string | null;
  phone: string | null;
  jobTitle: string | null;
};

type ReviewMap = Record<number, string[]>;

function cleanHospitalList(input: unknown): string[] {
  const values = Array.isArray(input) ? input : [];
  return Array.from(new Set(values.map(h => String(h || "").trim()).filter(h => ALL_HOSPITALS.includes(h))));
}

function getUserHospitals(user: AnyUser): string[] {
  const out = new Set<string>();
  try {
    const parsed = JSON.parse(user.hospitals || "[]");
    if (Array.isArray(parsed)) parsed.forEach(h => { if (ALL_HOSPITALS.includes(h)) out.add(h); });
  } catch (_) {}
  if (user.hospital && ALL_HOSPITALS.includes(user.hospital)) out.add(user.hospital);
  return [...out];
}

function getReviewHospitals(reviewMap: ReviewMap, userId: number): string[] {
  return cleanHospitalList(reviewMap[userId] || []);
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") return <span style={{ color: "#16a34a", display: "flex", alignItems: "center", gap: 3, fontSize: "0.76rem" }}><CheckCircle2 size={12} /> مفعّل</span>;
  if (status === "pending") return <span style={{ color: "#d97706", display: "flex", alignItems: "center", gap: 3, fontSize: "0.76rem" }}><Clock size={12} /> بانتظار الموافقة</span>;
  return <span style={{ color: "#dc2626", display: "flex", alignItems: "center", gap: 3, fontSize: "0.76rem" }}><XCircle size={12} /> مرفوض</span>;
}

function ReassignSelect({
  userId, userName, currentHospital, onConfirm, onCancel, isPending,
}: {
  userId: number; userName: string; currentHospital: string | null;
  onConfirm: (id: number, h: string | null) => void;
  onCancel: () => void; isPending: boolean;
}) {
  const [sel, setSel] = useState("");
  const [confirming, setConfirming] = useState(false);
  const targetLabel = sel === "__none__" ? "إزالة الربط" : sel;
  const isRemove = sel === "__none__";

  if (confirming && sel) {
    return (
      <div style={{ marginTop: 10, padding: "14px 16px", background: isRemove ? "#fef2f2" : "#f0fdf4", borderRadius: 10, border: `1.5px solid ${isRemove ? "#fca5a5" : "#86efac"}` }}>
        <div style={{ fontSize: "0.82rem", fontWeight: 700, color: isRemove ? "#b91c1c" : "#15803d", marginBottom: 10 }}>
          {isRemove ? "⚠️ تأكيد إزالة الربط" : "✅ تأكيد الربط"}
        </div>
        <div style={{ fontSize: "0.83rem", color: "#374151", marginBottom: 14, lineHeight: 1.7, background: "#fff", borderRadius: 8, padding: "10px 14px", border: "1px solid #e5e7eb" }}>
          <div>👤 <strong>الموظف:</strong> {userName}</div>
          {isRemove
            ? <div style={{ color: "#dc2626" }}>🏥 <strong>الإجراء:</strong> إزالة ربطه بـ «{currentHospital}»</div>
            : <>
                {currentHospital && <div style={{ color: "#6b7280", textDecoration: "line-through", fontSize: "0.78rem" }}>من: {currentHospital}</div>}
                <div>🏥 <strong>الموقع الجديد:</strong> {targetLabel}</div>
              </>
          }
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button disabled={isPending} onClick={() => onConfirm(userId, sel === "__none__" ? null : sel)}
            style={{ flex: 1, padding: "9px 14px", borderRadius: 8, border: "none", background: isRemove ? "linear-gradient(135deg,#dc2626,#b91c1c)" : "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff", fontWeight: 700, fontSize: "0.85rem", cursor: isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            {isPending ? "⏳ جاري الحفظ..." : isRemove ? "نعم، إزالة الربط" : "✅ نعم، تأكيد الربط"}
          </button>
          <button onClick={() => setConfirming(false)} style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#374151", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}>← تعديل</button>
          <button onClick={onCancel} style={{ padding: "9px 12px", borderRadius: 8, border: "none", background: "#fee2e2", color: "#dc2626", cursor: "pointer" }}><X size={14} /></button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 10, padding: "10px 12px", background: "#f0f4ff", borderRadius: 10, border: "1px solid #c7d2e8" }}>
      <div style={{ fontSize: "0.8rem", color: "#1e3c72", fontWeight: 700, marginBottom: 8 }}>اختر الموقع الجديد:</div>
      <select value={sel} onChange={e => { setSel(e.target.value); setConfirming(false); }}
        style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #c7d2e8", fontSize: "0.82rem", direction: "rtl", outline: "none", background: "#fff", marginBottom: 8, boxSizing: "border-box" }}>
        <option value="">— اختر —</option>
        {COMPANY_TABS.map(({ key, label }) => (
          <optgroup key={key} label={label}>
            {COMPANY_SITES[key].filter(h => h !== currentHospital).map(h => <option key={h} value={h}>{h}</option>)}
          </optgroup>
        ))}
        {currentHospital && <option value="__none__">— إزالة الربط —</option>}
      </select>
      <div style={{ display: "flex", gap: 6 }}>
        <button disabled={!sel} onClick={() => setConfirming(true)}
          style={{ flex: 1, background: sel ? "linear-gradient(135deg,#1e3c72,#2a5298)" : "#d1d5db", color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", cursor: sel ? "pointer" : "not-allowed", fontSize: "0.85rem", fontWeight: 700 }}>
          {sel ? "التالي ←" : "اختر موقعاً أولاً"}
        </button>
        <button onClick={onCancel} style={{ background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 8, padding: "9px 12px", cursor: "pointer" }}><X size={14} /></button>
      </div>
    </div>
  );
}

function MultiHospitalPanel({
  user, onSave, onCancel, saving,
}: { user: AnyUser; onSave: (ids: string[]) => void; onCancel: () => void; saving: boolean }) {
  const [sel, setSel] = useState<Set<string>>(new Set(getUserHospitals(user)));
  const toggle = (h: string) => setSel(prev => { const next = new Set(prev); next.has(h) ? next.delete(h) : next.add(h); return next; });
  return (
    <div style={{ marginTop: 10, padding: "14px 16px", background: "#f8faff", borderRadius: 12, border: "1.5px solid #c7d2e8" }}>
      <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#1e3c72", marginBottom: 10 }}>🏥 مواقع متعددة — {user.name}</div>
      {COMPANY_TABS.map(({ key, label, icon }) => (
        <div key={key} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: "0.72rem", color: "#6b7280", fontWeight: 700, marginBottom: 5 }}>{icon} {label}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {COMPANY_SITES[key].map((h: string) => (
              <button key={h} onClick={() => toggle(h)}
                style={{ padding: "5px 10px", borderRadius: 8, cursor: "pointer", fontSize: "0.75rem", fontWeight: 600, border: sel.has(h) ? "2px solid #1e3c72" : "1.5px solid #d1d5db", background: sel.has(h) ? "#e0e7ff" : "#fff", color: sel.has(h) ? "#1e3c72" : "#374151" }}>
                {h}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button disabled={saving || sel.size === 0} onClick={() => onSave([...sel])}
          style={{ flex: 1, padding: "9px 14px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#1e3c72,#2a5298)", color: "#fff", fontWeight: 700, fontSize: "0.85rem", cursor: saving || sel.size === 0 ? "not-allowed" : "pointer" }}>
          {saving ? "⏳ جاري الحفظ..." : `✅ حفظ (${sel.size} موقع)`}
        </button>
        <button onClick={onCancel} style={{ padding: "9px 12px", borderRadius: 8, border: "none", background: "#fee2e2", color: "#dc2626", cursor: "pointer" }}><X size={14} /></button>
      </div>
    </div>
  );
}

function ReviewHospitalPanel({
  user, reviewHospitals, onSave, onCancel, saving,
}: { user: AnyUser; reviewHospitals: string[]; onSave: (ids: string[]) => void; onCancel: () => void; saving: boolean }) {
  const [sel, setSel] = useState<Set<string>>(new Set(reviewHospitals));
  const toggle = (h: string) => setSel(prev => { const next = new Set(prev); next.has(h) ? next.delete(h) : next.add(h); return next; });
  return (
    <div style={{ marginTop: 10, padding: "14px 16px", background: "#fff7ed", borderRadius: 12, border: "1.5px solid #fdba74" }}>
      <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "#9a3412", marginBottom: 10 }}>👁️ مواقع المراجعة فقط — {user.name}</div>
      {COMPANY_TABS.map(({ key, label, icon }) => (
        <div key={key} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: "0.72rem", color: "#9a3412", fontWeight: 800, marginBottom: 5 }}>{icon} {label}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {COMPANY_SITES[key].map((h: string) => (
              <button key={h} onClick={() => toggle(h)}
                style={{ padding: "5px 10px", borderRadius: 8, cursor: "pointer", fontSize: "0.75rem", fontWeight: 700, border: sel.has(h) ? "2px solid #9a3412" : "1.5px solid #fed7aa", background: sel.has(h) ? "#fed7aa" : "#fff", color: sel.has(h) ? "#7c2d12" : "#9a3412" }}>
                {h}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div style={{ fontSize: "0.74rem", color: "#9a3412", background: "#fff", border: "1px solid #fed7aa", borderRadius: 8, padding: "7px 10px", marginTop: 8 }}>
        صلاحية المراجعة تسمح بالمشاهدة فقط ولا تسمح بالرفع أو تعديل بيانات المستخلص.
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button disabled={saving} onClick={() => onSave([...sel])}
          style={{ flex: 1, padding: "9px 14px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#9a3412,#7c2d12)", color: "#fff", fontWeight: 800, fontSize: "0.85rem", cursor: saving ? "not-allowed" : "pointer" }}>
          {saving ? "⏳ جاري الحفظ..." : `✅ حفظ مراجعة (${sel.size} موقع)`}
        </button>
        <button onClick={() => onSave([])} disabled={saving} style={{ padding: "9px 12px", borderRadius: 8, border: "none", background: "#fee2e2", color: "#b91c1c", fontWeight: 800, cursor: saving ? "not-allowed" : "pointer" }}>إلغاء المراجعة</button>
        <button onClick={onCancel} style={{ padding: "9px 12px", borderRadius: 8, border: "none", background: "#fff", color: "#7c2d12", cursor: "pointer" }}><X size={14} /></button>
      </div>
    </div>
  );
}

function AddReviewerSelect({
  hospitalName, users, reviewMap, onAdd, saving,
}: { hospitalName: string; users: AnyUser[]; reviewMap: ReviewMap; onAdd: (userId: number, hospitals: string[]) => void; saving: boolean }) {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const candidates = users.filter(u => !getReviewHospitals(reviewMap, u.id).includes(hospitalName));
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ margin: "10px 14px 0", padding: "7px 10px", borderRadius: 9, border: "1px solid #fdba74", background: "#fff7ed", color: "#9a3412", fontSize: "0.76rem", fontWeight: 800, cursor: "pointer" }}>
        + إضافة مراجع
      </button>
    );
  }
  return (
    <div style={{ margin: "10px 14px 0", padding: "10px 12px", borderRadius: 10, background: "#fff7ed", border: "1.5px solid #fed7aa" }}>
      <div style={{ fontSize: "0.76rem", fontWeight: 800, color: "#9a3412", marginBottom: 8 }}>إضافة مستخدم كمراجع فقط:</div>
      <select value={userId} onChange={e => setUserId(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #fdba74", background: "#fff", marginBottom: 8, fontSize: "0.8rem" }}>
        <option value="">— اختر المستخدم —</option>
        {candidates.map(u => <option key={u.id} value={u.id}>{u.name} — {ROLE_LABELS[u.role] || u.role}</option>)}
      </select>
      <div style={{ display: "flex", gap: 6 }}>
        <button disabled={!userId || saving} onClick={() => {
          const id = Number(userId);
          const current = getReviewHospitals(reviewMap, id);
          onAdd(id, Array.from(new Set([...current, hospitalName])));
          setUserId("");
          setOpen(false);
        }} style={{ flex: 1, border: "none", borderRadius: 8, padding: "8px 10px", background: userId ? "#9a3412" : "#d1d5db", color: "#fff", fontWeight: 800, cursor: userId && !saving ? "pointer" : "not-allowed" }}>حفظ كمراجع</button>
        <button onClick={() => setOpen(false)} style={{ border: "none", borderRadius: 8, padding: "8px 10px", background: "#fee2e2", color: "#b91c1c", cursor: "pointer" }}><X size={14} /></button>
      </div>
    </div>
  );
}

function UserRow({ user, onReassign, onMultiAssign, onReviewAssign, mutatingId, reviewHospitals, hospitalName, reviewOnlyRow }: {
  user: AnyUser;
  onReassign: (id: number, h: string | null) => void;
  onMultiAssign: (id: number, hospitals: string[]) => void;
  onReviewAssign: (id: number, hospitals: string[]) => void;
  mutatingId: number | null;
  reviewHospitals: string[];
  hospitalName?: string;
  reviewOnlyRow?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [multiOpen, setMultiOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const userHospitals = getUserHospitals(user);
  const isMulti = userHospitals.length > 1;
  const isReviewerHere = !!hospitalName && reviewHospitals.includes(hospitalName);
  return (
    <div style={{ borderBottom: "1px solid #f1f5f9", padding: "11px 16px", background: reviewOnlyRow ? "#fff7ed" : "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 10px", marginTop: 3, alignItems: "center" }}>
            <StatusBadge status={user.status} />
            <span style={{ fontSize: "0.74rem", color: ROLE_COLORS[user.role] || "#374151", fontWeight: 600 }}>{ROLE_LABELS[user.role] || user.role}</span>
            {user.phone && <span style={{ fontSize: "0.74rem", color: "#9ca3af" }}>{user.phone}</span>}
            {isMulti && <span style={{ fontSize: "0.72rem", color: "#7c3aed", fontWeight: 700, background: "#f3e8ff", borderRadius: 6, padding: "1px 7px" }}>🏥 {userHospitals.length} مواقع</span>}
            {reviewHospitals.length > 0 && <span style={{ fontSize: "0.72rem", color: "#9a3412", fontWeight: 800, background: "#ffedd5", borderRadius: 6, padding: "1px 7px" }}>👁️ مراجع {reviewHospitals.length}</span>}
            {isReviewerHere && <span style={{ fontSize: "0.72rem", color: "#b45309", fontWeight: 800, background: "#fef3c7", borderRadius: 6, padding: "1px 7px" }}>مراجعة فقط هنا</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 5, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button onClick={() => { setReviewOpen(v => !v); setMultiOpen(false); setOpen(false); }} title="تحديد مواقع المراجعة فقط"
            style={{ background: reviewOpen ? "#fed7aa" : "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa", borderRadius: 8, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: "0.76rem", fontWeight: 800 }}>👁️ مراجعة</button>
          <button onClick={() => { setMultiOpen(v => !v); setOpen(false); setReviewOpen(false); }} title="تعيين مواقع متعددة"
            style={{ background: multiOpen ? "#ede9fe" : "#f5f3ff", color: "#7c3aed", border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: "0.76rem", fontWeight: 600 }}>🏥 متعدد</button>
          <button onClick={() => { setOpen(v => !v); setMultiOpen(false); setReviewOpen(false); }} title="نقل إلى موقع آخر"
            style={{ background: open ? "#fee2e2" : "#f0f4ff", color: open ? "#dc2626" : "#1e3c72", border: "none", borderRadius: 8, padding: "6px 11px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: "0.78rem", fontWeight: 600 }}>
            {open ? <><X size={13} /> إلغاء</> : <><ArrowRightLeft size={13} /> نقل</>}
          </button>
        </div>
      </div>
      {reviewOpen && <ReviewHospitalPanel user={user} reviewHospitals={reviewHospitals} onSave={(hs) => { onReviewAssign(user.id, hs); setReviewOpen(false); }} onCancel={() => setReviewOpen(false)} saving={mutatingId === user.id} />}
      {multiOpen && <MultiHospitalPanel user={user} onSave={(hs) => { onMultiAssign(user.id, hs); setMultiOpen(false); }} onCancel={() => setMultiOpen(false)} saving={mutatingId === user.id} />}
      {open && <ReassignSelect userId={user.id} userName={user.name} currentHospital={user.hospital} onConfirm={(id, h) => { onReassign(id, h); setOpen(false); }} onCancel={() => setOpen(false)} isPending={mutatingId === user.id} />}
    </div>
  );
}

function HospitalCard({ name, users, reviewers, allUsers, reviewMap, onReassign, onMultiAssign, onReviewAssign, mutatingId }: {
  name: string; users: AnyUser[]; reviewers: AnyUser[]; allUsers: AnyUser[]; reviewMap: ReviewMap;
  onReassign: (id: number, h: string | null) => void;
  onMultiAssign: (id: number, hospitals: string[]) => void;
  onReviewAssign: (id: number, hospitals: string[]) => void;
  mutatingId: number | null;
}) {
  const approved = users.filter(u => u.status === "approved").length;
  const reviewerOnly = reviewers.filter(r => !users.some(u => u.id === r.id));
  const reviewerCount = reviewers.length;
  const totalDistinct = new Set([...users.map(u => u.id), ...reviewers.map(u => u.id)]).size;
  return (
    <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 16px rgba(30,60,114,.08)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ background: "linear-gradient(135deg,#1e3c72,#2a5298)", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: "0.88rem", lineHeight: 1.3 }}>{name}</div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {approved > 0 && <span style={{ background: "#d4af37", color: "#1a1a1a", borderRadius: 99, padding: "2px 10px", fontSize: "0.76rem", fontWeight: 800 }}>{approved} مفعّل</span>}
          {reviewerCount > 0 && <span style={{ background: "#fed7aa", color: "#7c2d12", borderRadius: 99, padding: "2px 10px", fontSize: "0.76rem", fontWeight: 800 }}>{reviewerCount} مراجع</span>}
          <span style={{ background: "rgba(255,255,255,0.18)", color: "#fff", borderRadius: 99, padding: "2px 10px", fontSize: "0.76rem", fontWeight: 700 }}>{totalDistinct} إجمالي</span>
        </div>
      </div>
      <AddReviewerSelect hospitalName={name} users={allUsers} reviewMap={reviewMap} onAdd={onReviewAssign} saving={mutatingId !== null} />
      <div style={{ flex: 1 }}>
        {users.length === 0 && reviewerOnly.length === 0 ? (
          <div style={{ padding: "24px 18px", textAlign: "center", color: "#d1d5db" }}>
            <Users size={28} style={{ margin: "0 auto 8px", display: "block", opacity: 0.5 }} />
            <span style={{ fontSize: "0.82rem" }}>لا يوجد موظفون مرتبطون</span>
          </div>
        ) : (
          <>
            {users.map(u => <UserRow key={`linked-${u.id}`} user={u} reviewHospitals={getReviewHospitals(reviewMap, u.id)} hospitalName={name} onReassign={onReassign} onMultiAssign={onMultiAssign} onReviewAssign={onReviewAssign} mutatingId={mutatingId} />)}
            {reviewerOnly.length > 0 && <div style={{ padding: "8px 16px", background: "#fff7ed", color: "#9a3412", fontWeight: 800, fontSize: "0.74rem", borderTop: users.length ? "1px solid #fed7aa" : "none" }}>مراجعون فقط</div>}
            {reviewerOnly.map(u => <UserRow key={`review-${u.id}`} user={u} reviewHospitals={getReviewHospitals(reviewMap, u.id)} hospitalName={name} reviewOnlyRow onReassign={onReassign} onMultiAssign={onMultiAssign} onReviewAssign={onReviewAssign} mutatingId={mutatingId} />)}
          </>
        )}
      </div>
    </div>
  );
}

export default function HospitalsAdmin() {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: usersData, isLoading, refetch } = useListUsers({});
  const [activeCompany, setActiveCompany] = useState<CompanyKey>("بيت_العرب");
  const [mutatingId, setMutatingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [reviewMap, setReviewMap] = useState<ReviewMap>({});

  const users: AnyUser[] = (usersData?.users ?? []) as AnyUser[];

  useEffect(() => {
    let cancelled = false;
    async function loadReviewPermissions() {
      if (!users.length) {
        setReviewMap({});
        return;
      }
      try {
        const token = await getToken();
        const pairs = await Promise.all(users.map(async u => {
          try {
            const res = await fetch(`/api/reviewer-permissions/${u.id}`, {
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            });
            if (!res.ok) return [u.id, []] as const;
            const data = await res.json();
            return [u.id, cleanHospitalList(data.reviewHospitals || [])] as const;
          } catch {
            return [u.id, []] as const;
          }
        }));
        if (!cancelled) {
          const next: ReviewMap = {};
          pairs.forEach(([id, hospitals]) => { next[id] = hospitals; });
          setReviewMap(next);
        }
      } catch {
        if (!cancelled) setReviewMap({});
      }
    }
    loadReviewPermissions();
    return () => { cancelled = true; };
  }, [users.length, getToken]);

  const { byHospital, byReviewHospital, unassigned } = useMemo(() => {
    const byHospital: Record<string, AnyUser[]> = {};
    const byReviewHospital: Record<string, AnyUser[]> = {};
    ALL_HOSPITALS.forEach(h => { byHospital[h] = []; byReviewHospital[h] = []; });
    const unassigned: AnyUser[] = [];
    users.forEach(u => {
      const linked = getUserHospitals(u);
      const reviewed = getReviewHospitals(reviewMap, u.id);
      if (linked.length === 0 && reviewed.length === 0) {
        unassigned.push(u);
      }
      linked.forEach(h => byHospital[h]?.push(u));
      reviewed.forEach(h => byReviewHospital[h]?.push(u));
    });
    return { byHospital, byReviewHospital, unassigned };
  }, [users, reviewMap]);

  const mutation = useMutation({
    mutationFn: async ({ userId, hospital }: { userId: number; hospital: string | null }) => {
      setMutatingId(userId);
      const token = await getToken();
      const res = await fetch(`/api/users/${userId}/hospital`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ hospital }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      refetch();
      toast({ title: "✅ تم التغيير", description: vars.hospital ? `تم الربط بـ: ${vars.hospital}` : "تم إزالة الربط" });
      setMutatingId(null);
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
      setMutatingId(null);
    },
  });

  const multiMutation = useMutation({
    mutationFn: async ({ userId, hospitals }: { userId: number; hospitals: string[] }) => {
      setMutatingId(userId);
      const token = await getToken();
      const res = await fetch(`/api/users/${userId}/hospitals`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ hospitals }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      refetch();
      toast({ title: "✅ تم الحفظ", description: `تم تعيين ${vars.hospitals.length} موقع` });
      setMutatingId(null);
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
      setMutatingId(null);
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ userId, hospitals }: { userId: number; hospitals: string[] }) => {
      setMutatingId(userId);
      const token = await getToken();
      const cleaned = cleanHospitalList(hospitals);
      const res = await fetch(`/api/reviewer-permissions/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ permissions: cleaned.length ? ["review_extract"] : [], reviewHospitals: cleaned }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      return { userId, hospitals: cleanHospitalList(data.reviewHospitals || cleaned) };
    },
    onSuccess: ({ userId, hospitals }) => {
      setReviewMap(prev => ({ ...prev, [userId]: hospitals }));
      toast({ title: hospitals.length ? "✅ تم حفظ المراجعة" : "✅ تم إلغاء المراجعة", description: hospitals.length ? `تم تعيين ${hospitals.length} موقع للمراجعة فقط` : "تم حذف مواقع المراجعة لهذا المستخدم" });
      setMutatingId(null);
    },
    onError: (err: any) => {
      toast({ title: "خطأ في صلاحية المراجعة", description: err.message, variant: "destructive" });
      setMutatingId(null);
    },
  });

  const handleReassign = (userId: number, hospital: string | null) => mutation.mutate({ userId, hospital });
  const handleMultiAssign = (userId: number, hospitals: string[]) => multiMutation.mutate({ userId, hospitals });
  const handleReviewAssign = (userId: number, hospitals: string[]) => reviewMutation.mutate({ userId, hospitals });
  const currentSites = COMPANY_SITES[activeCompany];

  const filteredSearch = search.trim().toLowerCase();
  const filterUsers = (list: AnyUser[]) => filteredSearch ? list.filter(u =>
    u.name.toLowerCase().includes(filteredSearch) ||
    (u.email || "").toLowerCase().includes(filteredSearch) ||
    (u.phone || "").includes(filteredSearch)
  ) : list;

  const totalUsers = users.length;
  const assignedCount = users.filter(u => getUserHospitals(u).length > 0).length;
  const reviewerUsersCount = users.filter(u => getReviewHospitals(reviewMap, u.id).length > 0).length;
  const approvedCount = users.filter(u => u.status === "approved").length;
  const companyCount = (co: CompanyKey) => COMPANY_SITES[co].reduce((s, h) => s + (byHospital[h]?.length || 0), 0);
  const companyReviewerCount = (co: CompanyKey) => COMPANY_SITES[co].reduce((s, h) => s + (byReviewHospital[h]?.length || 0), 0);

  return (
    <div style={{ direction: "rtl", fontFamily: "'Segoe UI', Arial, sans-serif", minHeight: "100vh", background: "#f0f4f8", padding: "24px 20px" }}>
      <div style={{ background: "linear-gradient(135deg,#0f2050,#1e3c72,#2a5298)", borderRadius: 16, padding: "22px 28px", marginBottom: 22, color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ background: "rgba(255,255,255,.12)", borderRadius: 12, padding: 12 }}><Building2 size={28} /></div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0 }}>ربط المستخدمين بالمستشفيات</h1>
            <p style={{ margin: "4px 0 0", opacity: 0.7, fontSize: "0.82rem" }}>اعرض وعدّل ربط كل موظف بموقعه أو الإدارة — وأضف مواقع مراجعة فقط بدون صلاحية رفع</p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[
              { val: totalUsers, lbl: "إجمالي", color: "#fff" },
              { val: approvedCount, lbl: "مفعّلون", color: "#86efac" },
              { val: reviewerUsersCount, lbl: "مراجعون", color: "#fdba74" },
              { val: unassigned.length, lbl: "بدون ربط", color: unassigned.length ? "#fca5a5" : "#86efac" },
            ].map(s => (
              <div key={s.lbl} style={{ background: "rgba(255,255,255,.12)", borderRadius: 10, padding: "10px 18px", textAlign: "center", minWidth: 70 }}>
                <div style={{ fontSize: "1.5rem", fontWeight: 800, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: "0.7rem", opacity: 0.75, marginTop: 1 }}>{s.lbl}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 ابحث باسم الموظف أو الإيميل أو الهاتف..."
            style={{ width: "100%", padding: "10px 16px", borderRadius: 10, border: "none", fontSize: "0.9rem", direction: "rtl", outline: "none", background: "rgba(255,255,255,.92)", color: "#1e293b", boxSizing: "border-box" }} />
        </div>
      </div>

      {filterUsers(unassigned).length > 0 && (
        <div style={{ background: "#fffbeb", border: "1.5px solid #fcd34d", borderRadius: 14, padding: "16px 20px", marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, color: "#92400e", fontWeight: 800, fontSize: "0.95rem" }}>
            <AlertCircle size={18} /> {filterUsers(unassigned).length} مستخدم بدون ربط أو مراجعة
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 12 }}>
            {filterUsers(unassigned).map(u => <div key={u.id} style={{ background: "#fff", borderRadius: 10, border: "1.5px solid #fde68a", overflow: "hidden" }}><UserRow user={u} reviewHospitals={getReviewHospitals(reviewMap, u.id)} onReassign={handleReassign} onMultiAssign={handleMultiAssign} onReviewAssign={handleReviewAssign} mutatingId={mutatingId} /></div>)}
          </div>
        </div>
      )}

      {isLoading && <div style={{ textAlign: "center", padding: 60, color: "#94a3b8", fontSize: "1rem" }}>⏳ جاري تحميل البيانات...</div>}

      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        {COMPANY_TABS.map(({ key, label, icon }) => {
          const count = companyCount(key);
          const reviewCount = companyReviewerCount(key);
          const isActive = activeCompany === key;
          return (
            <button key={key} onClick={() => setActiveCompany(key)}
              style={{ padding: "10px 22px", borderRadius: 10, fontWeight: 700, fontSize: "0.92rem", border: "none", cursor: "pointer", transition: "all .15s", background: isActive ? "linear-gradient(135deg,#1e3c72,#2a5298)" : "#fff", color: isActive ? "#fff" : "#374151", boxShadow: isActive ? "0 4px 14px rgba(30,60,114,.3)" : "0 1px 4px rgba(0,0,0,.08)" }}>
              {icon} {label}
              <span style={{ marginRight: 8, opacity: 0.8, fontSize: "0.8rem" }}>({count} موظف / {reviewCount} مراجع / {COMPANY_SITES[key].length} موقع)</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 18 }}>
        {currentSites.map(hospitalName => (
          <HospitalCard key={hospitalName} name={hospitalName} users={filterUsers(byHospital[hospitalName] || [])} reviewers={filterUsers(byReviewHospital[hospitalName] || [])} allUsers={users} reviewMap={reviewMap} onReassign={handleReassign} onMultiAssign={handleMultiAssign} onReviewAssign={handleReviewAssign} mutatingId={mutatingId} />
        ))}
      </div>
    </div>
  );
}
