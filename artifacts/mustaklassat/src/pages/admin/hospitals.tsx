import { useState, useMemo } from "react";
import { useListUsers, getListUsersQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@clerk/react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Building2, Users, AlertCircle, ArrowRightLeft, X, CheckCircle2, Clock, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const COMPANY_SITES: Record<string, string[]> = {
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

const ALL_HOSPITALS = [...COMPANY_SITES["بيت_العرب"], ...COMPANY_SITES["سراكو"]];

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
          <button
            disabled={isPending}
            onClick={() => { onConfirm(userId, sel === "__none__" ? null : sel); }}
            style={{
              flex: 1, padding: "9px 14px", borderRadius: 8, border: "none",
              background: isRemove ? "linear-gradient(135deg,#dc2626,#b91c1c)" : "linear-gradient(135deg,#16a34a,#15803d)",
              color: "#fff", fontWeight: 700, fontSize: "0.85rem", cursor: isPending ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            {isPending ? "⏳ جاري الحفظ..." : isRemove ? "نعم، إزالة الربط" : "✅ نعم، تأكيد الربط"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#374151", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}
          >
            ← تعديل
          </button>
          <button
            onClick={onCancel}
            style={{ padding: "9px 12px", borderRadius: 8, border: "none", background: "#fee2e2", color: "#dc2626", cursor: "pointer" }}
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 10, padding: "10px 12px", background: "#f0f4ff", borderRadius: 10, border: "1px solid #c7d2e8" }}>
      <div style={{ fontSize: "0.8rem", color: "#1e3c72", fontWeight: 700, marginBottom: 8 }}>اختر المستشفى الجديد:</div>
      <select
        value={sel}
        onChange={e => { setSel(e.target.value); setConfirming(false); }}
        style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #c7d2e8", fontSize: "0.82rem", direction: "rtl", outline: "none", background: "#fff", marginBottom: 8, boxSizing: "border-box" }}
      >
        <option value="">— اختر —</option>
        <optgroup label="بيت العرب">
          {COMPANY_SITES["بيت_العرب"].filter(h => h !== currentHospital).map(h => (
            <option key={h} value={h}>{h}</option>
          ))}
        </optgroup>
        <optgroup label="سراكو">
          {COMPANY_SITES["سراكو"].filter(h => h !== currentHospital).map(h => (
            <option key={h} value={h}>{h}</option>
          ))}
        </optgroup>
        {currentHospital && <option value="__none__">— إزالة الربط —</option>}
      </select>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          disabled={!sel}
          onClick={() => setConfirming(true)}
          style={{
            flex: 1, background: sel ? "linear-gradient(135deg,#1e3c72,#2a5298)" : "#d1d5db",
            color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px",
            cursor: sel ? "pointer" : "not-allowed", fontSize: "0.85rem", fontWeight: 700,
          }}
        >
          {sel ? "التالي ←" : "اختر مستشفى أولاً"}
        </button>
        <button
          onClick={onCancel}
          style={{ background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 8, padding: "9px 12px", cursor: "pointer" }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

function MultiHospitalPanel({
  user, onSave, onCancel, saving,
}: { user: AnyUser; onSave: (ids: string[]) => void; onCancel: () => void; saving: boolean }) {
  const current: string[] = (() => { try { return JSON.parse(user.hospitals || '[]'); } catch { return user.hospital ? [user.hospital] : []; } })();
  const [sel, setSel] = useState<Set<string>>(new Set(current));
  const toggle = (h: string) => setSel(prev => { const next = new Set(prev); next.has(h) ? next.delete(h) : next.add(h); return next; });
  return (
    <div style={{ marginTop: 10, padding: "14px 16px", background: "#f8faff", borderRadius: 12, border: "1.5px solid #c7d2e8" }}>
      <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#1e3c72", marginBottom: 10 }}>🏥 مواقع متعددة — {user.name}</div>
      {[["بيت_العرب", "بيت العرب"], ["سراكو", "سراكو"]].map(([key, label]) => (
        <div key={key} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: "0.72rem", color: "#6b7280", fontWeight: 700, marginBottom: 5, textTransform: "uppercase" }}>{label}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {COMPANY_SITES[key].map((h: string) => (
              <button key={h} onClick={() => toggle(h)}
                style={{
                  padding: "5px 10px", borderRadius: 8, cursor: "pointer", fontSize: "0.75rem", fontWeight: 600,
                  border: sel.has(h) ? "2px solid #1e3c72" : "1.5px solid #d1d5db",
                  background: sel.has(h) ? "#e0e7ff" : "#fff", color: sel.has(h) ? "#1e3c72" : "#374151",
                }}
              >{h}</button>
            ))}
          </div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button disabled={saving || sel.size === 0} onClick={() => onSave([...sel])}
          style={{ flex: 1, padding: "9px 14px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#1e3c72,#2a5298)", color: "#fff", fontWeight: 700, fontSize: "0.85rem", cursor: saving || sel.size === 0 ? "not-allowed" : "pointer" }}>
          {saving ? "⏳ جاري الحفظ..." : `✅ حفظ (${sel.size} موقع)`}
        </button>
        <button onClick={onCancel} style={{ padding: "9px 12px", borderRadius: 8, border: "none", background: "#fee2e2", color: "#dc2626", cursor: "pointer" }}>
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

function UserRow({ user, onReassign, onMultiAssign, mutatingId }: {
  user: AnyUser;
  onReassign: (id: number, h: string | null) => void;
  onMultiAssign: (id: number, hospitals: string[]) => void;
  mutatingId: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [multiOpen, setMultiOpen] = useState(false);
  const userHospitals: string[] = (() => { try { return JSON.parse(user.hospitals || '[]'); } catch { return []; } })();
  const isMulti = userHospitals.length > 1;
  return (
    <div style={{ borderBottom: "1px solid #f1f5f9", padding: "11px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {user.name}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 10px", marginTop: 3, alignItems: "center" }}>
            <StatusBadge status={user.status} />
            <span style={{ fontSize: "0.74rem", color: ROLE_COLORS[user.role] || "#374151", fontWeight: 600 }}>
              {ROLE_LABELS[user.role] || user.role}
            </span>
            {user.phone && <span style={{ fontSize: "0.74rem", color: "#9ca3af" }}>{user.phone}</span>}
            {isMulti && <span style={{ fontSize: "0.72rem", color: "#7c3aed", fontWeight: 700, background: "#f3e8ff", borderRadius: 6, padding: "1px 7px" }}>🏥 {userHospitals.length} مواقع</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
          <button
            onClick={() => { setMultiOpen(v => !v); setOpen(false); }}
            title="تعيين مواقع متعددة"
            style={{ background: multiOpen ? "#ede9fe" : "#f5f3ff", color: "#7c3aed", border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: "0.76rem", fontWeight: 600 }}
          >
            🏥 متعدد
          </button>
          <button
            onClick={() => { setOpen(v => !v); setMultiOpen(false); }}
            title="نقل إلى مستشفى آخر"
            style={{ background: open ? "#fee2e2" : "#f0f4ff", color: open ? "#dc2626" : "#1e3c72", border: "none", borderRadius: 8, padding: "6px 11px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: "0.78rem", fontWeight: 600 }}
          >
            {open ? <><X size={13} /> إلغاء</> : <><ArrowRightLeft size={13} /> نقل</>}
          </button>
        </div>
      </div>
      {multiOpen && (
        <MultiHospitalPanel
          user={user}
          onSave={(hs) => { onMultiAssign(user.id, hs); setMultiOpen(false); }}
          onCancel={() => setMultiOpen(false)}
          saving={mutatingId === user.id}
        />
      )}
      {open && (
        <ReassignSelect
          userId={user.id}
          userName={user.name}
          currentHospital={user.hospital}
          onConfirm={(id, h) => { onReassign(id, h); setOpen(false); }}
          onCancel={() => setOpen(false)}
          isPending={mutatingId === user.id}
        />
      )}
    </div>
  );
}

function HospitalCard({ name, users, onReassign, onMultiAssign, mutatingId }: {
  name: string; users: AnyUser[];
  onReassign: (id: number, h: string | null) => void;
  onMultiAssign: (id: number, hospitals: string[]) => void;
  mutatingId: number | null;
}) {
  const approved = users.filter(u => u.status === "approved").length;
  return (
    <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 16px rgba(30,60,114,.08)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ background: "linear-gradient(135deg,#1e3c72,#2a5298)", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: "0.88rem", lineHeight: 1.3 }}>{name}</div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {approved > 0 && (
            <span style={{ background: "#d4af37", color: "#1a1a1a", borderRadius: 99, padding: "2px 10px", fontSize: "0.76rem", fontWeight: 800 }}>
              {approved} مفعّل
            </span>
          )}
          <span style={{ background: "rgba(255,255,255,0.18)", color: "#fff", borderRadius: 99, padding: "2px 10px", fontSize: "0.76rem", fontWeight: 700 }}>
            {users.length} إجمالي
          </span>
        </div>
      </div>
      <div style={{ flex: 1 }}>
        {users.length === 0 ? (
          <div style={{ padding: "24px 18px", textAlign: "center", color: "#d1d5db" }}>
            <Users size={28} style={{ margin: "0 auto 8px", display: "block", opacity: 0.5 }} />
            <span style={{ fontSize: "0.82rem" }}>لا يوجد موظفون مرتبطون</span>
          </div>
        ) : (
          users.map(u => (
            <UserRow key={u.id} user={u} onReassign={onReassign} onMultiAssign={onMultiAssign} mutatingId={mutatingId} />
          ))
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
  const [activeCompany, setActiveCompany] = useState<"بيت_العرب" | "سراكو">("بيت_العرب");
  const [mutatingId, setMutatingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const users: AnyUser[] = (usersData?.users ?? []) as AnyUser[];

  const { byHospital, unassigned } = useMemo(() => {
    const byHospital: Record<string, AnyUser[]> = {};
    ALL_HOSPITALS.forEach(h => { byHospital[h] = []; });
    const unassigned: AnyUser[] = [];
    users.forEach(u => {
      if (!u.hospital || !ALL_HOSPITALS.includes(u.hospital)) {
        unassigned.push(u);
      } else {
        byHospital[u.hospital].push(u);
      }
    });
    return { byHospital, unassigned };
  }, [users]);

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
      // invalidate all user queries broadly then force-refetch
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

  const handleReassign = (userId: number, hospital: string | null) => {
    mutation.mutate({ userId, hospital });
  };

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

  const handleMultiAssign = (userId: number, hospitals: string[]) => {
    multiMutation.mutate({ userId, hospitals });
  };

  const currentSites = COMPANY_SITES[activeCompany];

  const filteredSearch = search.trim().toLowerCase();
  const filterUsers = (list: AnyUser[]) =>
    filteredSearch ? list.filter(u =>
      u.name.toLowerCase().includes(filteredSearch) ||
      (u.email || "").toLowerCase().includes(filteredSearch) ||
      (u.phone || "").includes(filteredSearch)
    ) : list;

  const totalUsers = users.length;
  const assignedCount = users.filter(u => u.hospital && ALL_HOSPITALS.includes(u.hospital)).length;
  const approvedCount = users.filter(u => u.status === "approved").length;

  const beytCount = COMPANY_SITES["بيت_العرب"].reduce((s, h) => s + (byHospital[h]?.length || 0), 0);
  const sarakoCount = COMPANY_SITES["سراكو"].reduce((s, h) => s + (byHospital[h]?.length || 0), 0);

  return (
    <div style={{ direction: "rtl", fontFamily: "'Segoe UI', Arial, sans-serif", minHeight: "100vh", background: "#f0f4f8", padding: "24px 20px" }}>

      {/* ── Header ── */}
      <div style={{ background: "linear-gradient(135deg,#0f2050,#1e3c72,#2a5298)", borderRadius: 16, padding: "22px 28px", marginBottom: 22, color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ background: "rgba(255,255,255,.12)", borderRadius: 12, padding: 12 }}>
            <Building2 size={28} />
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0 }}>ربط المستخدمين بالمستشفيات</h1>
            <p style={{ margin: "4px 0 0", opacity: 0.7, fontSize: "0.82rem" }}>اعرض وعدّل ربط كل موظف بموقعه — التغييرات تسري فوراً</p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[
              { val: totalUsers, lbl: "إجمالي", color: "#fff" },
              { val: approvedCount, lbl: "مفعّلون", color: "#86efac" },
              { val: unassigned.length, lbl: "بدون ربط", color: unassigned.length ? "#fca5a5" : "#86efac" },
            ].map(s => (
              <div key={s.lbl} style={{ background: "rgba(255,255,255,.12)", borderRadius: 10, padding: "10px 18px", textAlign: "center", minWidth: 70 }}>
                <div style={{ fontSize: "1.5rem", fontWeight: 800, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: "0.7rem", opacity: 0.75, marginTop: 1 }}>{s.lbl}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Search */}
        <div style={{ marginTop: 16 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 ابحث باسم الموظف أو الإيميل أو الهاتف..."
            style={{ width: "100%", padding: "10px 16px", borderRadius: 10, border: "none", fontSize: "0.9rem", direction: "rtl", outline: "none", background: "rgba(255,255,255,.92)", color: "#1e293b", boxSizing: "border-box" }}
          />
        </div>
      </div>

      {/* ── Unassigned ── */}
      {filterUsers(unassigned).length > 0 && (
        <div style={{ background: "#fffbeb", border: "1.5px solid #fcd34d", borderRadius: 14, padding: "16px 20px", marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, color: "#92400e", fontWeight: 800, fontSize: "0.95rem" }}>
            <AlertCircle size={18} />
            {filterUsers(unassigned).length} مستخدم بدون مستشفى محدد
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 12 }}>
            {filterUsers(unassigned).map(u => (
              <div key={u.id} style={{ background: "#fff", borderRadius: 10, border: "1.5px solid #fde68a", overflow: "hidden" }}>
                <UserRow user={u} onReassign={handleReassign} onMultiAssign={handleMultiAssign} mutatingId={mutatingId} />
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading && (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8", fontSize: "1rem" }}>
          ⏳ جاري تحميل البيانات...
        </div>
      )}

      {/* ── Company Tabs ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        {(["بيت_العرب", "سراكو"] as const).map(co => {
          const count = co === "بيت_العرب" ? beytCount : sarakoCount;
          const isActive = activeCompany === co;
          return (
            <button
              key={co}
              onClick={() => setActiveCompany(co)}
              style={{
                padding: "10px 22px", borderRadius: 10, fontWeight: 700, fontSize: "0.92rem",
                border: "none", cursor: "pointer", transition: "all .15s",
                background: isActive ? "linear-gradient(135deg,#1e3c72,#2a5298)" : "#fff",
                color: isActive ? "#fff" : "#374151",
                boxShadow: isActive ? "0 4px 14px rgba(30,60,114,.3)" : "0 1px 4px rgba(0,0,0,.08)",
              }}
            >
              {co === "بيت_العرب" ? "🏥 بيت العرب" : "🏨 سراكو"}
              <span style={{ marginRight: 8, opacity: 0.8, fontSize: "0.8rem" }}>({count} موظف / {COMPANY_SITES[co].length} موقع)</span>
            </button>
          );
        })}
      </div>

      {/* ── Hospital Grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 18 }}>
        {currentSites.map(hospitalName => (
          <HospitalCard
            key={hospitalName}
            name={hospitalName}
            users={filterUsers(byHospital[hospitalName] || [])}
            onReassign={handleReassign}
            onMultiAssign={handleMultiAssign}
            mutatingId={mutatingId}
          />
        ))}
      </div>

    </div>
  );
}
