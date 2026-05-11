import { useState, useEffect } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import {
  Bell, BellOff, Send, TestTube2, Users, RefreshCw,
  CheckCircle, AlertCircle, ToggleLeft, ToggleRight, Mail,
} from "lucide-react";

interface NotifySettings {
  notify_auto_inactivity: string;
  notify_auto_backup: string;
  notify_new_extract: string;
  notify_new_user: string;
}

const SETTING_LABELS: Record<string, { label: string; desc: string }> = {
  notify_auto_inactivity: {
    label: "تنبيه المواقع المتأخرة",
    desc: "يرسل بريداً للمدير تلقائياً إذا كان موقع لم يُقدّم مستخلصاً منذ 45+ يوم",
  },
  notify_auto_backup: {
    label: "إشعار النسخة الاحتياطية",
    desc: "يرسل بريداً يومياً للمدير عند اكتمال النسخ الاحتياطي التلقائي",
  },
  notify_new_extract: {
    label: "إشعار تقديم مستخلص جديد",
    desc: "يُرسَل إلى المدير والمشرفين عند تقديم مستخلص جديد من أي موقع",
  },
  notify_new_user: {
    label: "إشعار تسجيل مستخدم جديد",
    desc: "يُرسَل للمدير عند انضمام مستخدم جديد وينتظر الموافقة",
  },
};

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className="transition-all duration-200 flex-shrink-0"
      style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
    >
      {enabled
        ? <ToggleRight className="h-8 w-8" style={{ color: "#16a34a" }} />
        : <ToggleLeft className="h-8 w-8" style={{ color: "#94a3b8" }} />}
    </button>
  );
}

export default function AdminNotificationsPage() {
  const { data: me } = useGetMe({ query: { queryKey: ["/api/users/me"] } });
  const [, setLocation] = useLocation();

  const [settings, setSettings] = useState<NotifySettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const [broadcastSubject, setBroadcastSubject] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastTo, setBroadcastTo] = useState<"approved" | "all">("approved");
  const [sending, setSending] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{ ok: boolean; sent?: number; error?: string } | null>(null);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; sentTo?: string; error?: string } | null>(null);

  const isAdmin = me?.role === "admin";

  useEffect(() => {
    if (me && !isAdmin) setLocation("/dashboard");
  }, [me, isAdmin]);

  async function loadSettings() {
    setLoadingSettings(true);
    try {
      const token = localStorage.getItem("najran_session")
        ? JSON.parse(localStorage.getItem("najran_session")!).clerkToken
        : null;
      const res = await fetch("/api/admin/notify/settings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSettings(data.settings);
    } catch { } finally { setLoadingSettings(false); }
  }

  useEffect(() => { if (isAdmin) loadSettings(); }, [isAdmin]);

  async function toggleSetting(key: string) {
    if (!settings) return;
    const current = settings[key as keyof NotifySettings];
    const newVal = current === "false" ? "true" : "false";
    setSavingKey(key);
    try {
      const token = JSON.parse(localStorage.getItem("najran_session") || "{}").clerkToken;
      await fetch("/api/admin/notify/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ key, value: newVal }),
      });
      setSettings(prev => prev ? { ...prev, [key]: newVal } : prev);
    } catch { } finally { setSavingKey(null); }
  }

  async function sendBroadcast() {
    if (!broadcastSubject.trim() || !broadcastMessage.trim()) return;
    setSending(true);
    setBroadcastResult(null);
    try {
      const token = JSON.parse(localStorage.getItem("najran_session") || "{}").clerkToken;
      const res = await fetch("/api/admin/notify/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subject: broadcastSubject, message: broadcastMessage, recipients: broadcastTo }),
      });
      const data = await res.json();
      if (res.ok) {
        setBroadcastResult({ ok: true, sent: data.sent });
        setBroadcastSubject("");
        setBroadcastMessage("");
      } else {
        setBroadcastResult({ ok: false, error: data.error || "حدث خطأ" });
      }
    } catch (e: any) {
      setBroadcastResult({ ok: false, error: String(e) });
    } finally { setSending(false); }
  }

  async function sendTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const token = JSON.parse(localStorage.getItem("najran_session") || "{}").clerkToken;
      const res = await fetch("/api/admin/notify/test", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subject: "اختبار نظام الإشعارات", message: "هذا بريد اختبار — نظام الإشعارات يعمل بشكل صحيح ✅" }),
      });
      const data = await res.json();
      setTestResult(res.ok ? { ok: true, sentTo: data.sentTo } : { ok: false, error: data.error });
    } catch (e: any) {
      setTestResult({ ok: false, error: String(e) });
    } finally { setTesting(false); }
  }

  if (!isAdmin) return null;

  const card = "background:#fff;border-radius:16px;border:1px solid #e2e8f0;padding:28px 28px;margin-bottom:20px;";
  const sectionTitle = (t: string) => (
    <p style={{ color: "#1e3c72", fontSize: 16, fontWeight: 800, margin: "0 0 18px", borderRight: "4px solid #d4af37", paddingRight: 10 }}>{t}</p>
  );

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: "24px 20px", direction: "rtl" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#0d1f3c,#1a3562)", borderRadius: 18, padding: "28px 32px", marginBottom: 24, color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ background: "rgba(212,175,55,0.15)", border: "1px solid rgba(212,175,55,0.35)", borderRadius: 12, padding: "10px 12px" }}>
            <Bell className="h-6 w-6" style={{ color: "#d4af37" }} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#d4af37" }}>لوحة تحكم الإشعارات</p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "rgba(255,255,255,0.6)" }}>تحكم كامل في الإشعارات البريدية — أوقف التلقائية أو أرسل للكل يدوياً</p>
          </div>
        </div>
      </div>

      {/* Settings toggles */}
      <div style={{ ...Object.fromEntries(card.split(";").filter(Boolean).map(s => { const [k, ...v] = s.split(":"); return [k.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v.join(":").trim()]; })) }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          {sectionTitle("⚙️ إعدادات الإشعارات التلقائية")}
          <button onClick={loadSettings} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
            <RefreshCw className="h-3.5 w-3.5" />
            <span>تحديث</span>
          </button>
        </div>
        {loadingSettings ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: "#94a3b8" }}>
            <RefreshCw className="h-5 w-5 inline animate-spin" />
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {Object.entries(SETTING_LABELS).map(([key, meta]) => {
              const enabled = settings ? settings[key as keyof NotifySettings] !== "false" : true;
              const isSaving = savingKey === key;
              return (
                <div key={key} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: enabled ? "#f0fdf4" : "#f8fafc",
                  borderRadius: 12, padding: "14px 18px",
                  border: `1px solid ${enabled ? "#bbf7d0" : "#e2e8f0"}`,
                  transition: "all 0.2s",
                  opacity: isSaving ? 0.6 : 1,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      {enabled
                        ? <Bell className="h-4 w-4" style={{ color: "#16a34a" }} />
                        : <BellOff className="h-4 w-4" style={{ color: "#94a3b8" }} />}
                      <span style={{ fontSize: 14, fontWeight: 700, color: enabled ? "#15803d" : "#475569" }}>{meta.label}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
                        background: enabled ? "#dcfce7" : "#f1f5f9",
                        color: enabled ? "#166534" : "#64748b",
                      }}>{enabled ? "مُفعَّل" : "مُعطَّل"}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>{meta.desc}</p>
                  </div>
                  <Toggle enabled={enabled} onChange={() => !isSaving && toggleSetting(key)} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Broadcast */}
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "28px 28px", marginBottom: 20 }}>
        {sectionTitle("📢 إرسال إشعار لجميع المستخدمين")}
        <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
          {(["approved", "all"] as const).map(v => (
            <button key={v} onClick={() => setBroadcastTo(v)} style={{
              padding: "8px 18px", borderRadius: 20, border: "1px solid",
              borderColor: broadcastTo === v ? "#1e3c72" : "#e2e8f0",
              background: broadcastTo === v ? "#1e3c72" : "#fff",
              color: broadcastTo === v ? "#fff" : "#64748b",
              fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            }}>
              <Users className="h-3.5 w-3.5" />
              {v === "approved" ? "المستخدمون المعتمدون فقط" : "جميع المستخدمين"}
            </button>
          ))}
        </div>
        <input
          value={broadcastSubject}
          onChange={e => setBroadcastSubject(e.target.value)}
          placeholder="موضوع الرسالة..."
          style={{
            width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #e2e8f0",
            fontSize: 14, marginBottom: 10, direction: "rtl", outline: "none", boxSizing: "border-box",
            fontFamily: "inherit",
          }}
        />
        <textarea
          value={broadcastMessage}
          onChange={e => setBroadcastMessage(e.target.value)}
          placeholder="نص الرسالة... (يمكنك كتابة رسالة متعددة الأسطر)"
          rows={5}
          style={{
            width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #e2e8f0",
            fontSize: 14, marginBottom: 14, direction: "rtl", outline: "none", resize: "vertical",
            boxSizing: "border-box", fontFamily: "inherit",
          }}
        />
        {broadcastResult && (
          <div style={{
            padding: "10px 14px", borderRadius: 10, marginBottom: 14,
            background: broadcastResult.ok ? "#f0fdf4" : "#fef2f2",
            border: `1px solid ${broadcastResult.ok ? "#bbf7d0" : "#fecaca"}`,
            display: "flex", alignItems: "center", gap: 8, fontSize: 13,
            color: broadcastResult.ok ? "#166534" : "#b91c1c",
          }}>
            {broadcastResult.ok
              ? <><CheckCircle className="h-4 w-4" /> تم إرسال الرسالة إلى {broadcastResult.sent} مستخدم بنجاح ✅</>
              : <><AlertCircle className="h-4 w-4" /> خطأ: {broadcastResult.error}</>}
          </div>
        )}
        <button
          onClick={sendBroadcast}
          disabled={sending || !broadcastSubject.trim() || !broadcastMessage.trim()}
          style={{
            display: "flex", alignItems: "center", gap: 8, padding: "12px 24px",
            borderRadius: 10, border: "none", cursor: sending || !broadcastSubject.trim() || !broadcastMessage.trim() ? "not-allowed" : "pointer",
            background: "linear-gradient(135deg,#1e3c72,#2a5298)", color: "#fff",
            fontSize: 14, fontWeight: 700, opacity: sending || !broadcastSubject.trim() || !broadcastMessage.trim() ? 0.6 : 1,
          }}
        >
          {sending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {sending ? "جاري الإرسال..." : "إرسال للجميع"}
        </button>
      </div>

      {/* Test email */}
      <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "28px 28px" }}>
        {sectionTitle("🧪 اختبار نظام الإشعارات")}
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "#64748b" }}>
          أرسل بريداً تجريبياً لنفسك ({me?.email}) للتأكد من أن نظام البريد الإلكتروني يعمل بشكل صحيح.
        </p>
        {testResult && (
          <div style={{
            padding: "10px 14px", borderRadius: 10, marginBottom: 14,
            background: testResult.ok ? "#f0fdf4" : "#fef2f2",
            border: `1px solid ${testResult.ok ? "#bbf7d0" : "#fecaca"}`,
            display: "flex", alignItems: "center", gap: 8, fontSize: 13,
            color: testResult.ok ? "#166534" : "#b91c1c",
          }}>
            {testResult.ok
              ? <><CheckCircle className="h-4 w-4" /> تم إرسال البريد التجريبي إلى {testResult.sentTo} ✅</>
              : <><AlertCircle className="h-4 w-4" /> فشل الإرسال: {testResult.error}</>}
          </div>
        )}
        <button
          onClick={sendTest}
          disabled={testing}
          style={{
            display: "flex", alignItems: "center", gap: 8, padding: "11px 22px",
            borderRadius: 10, border: "1px solid #e2e8f0", cursor: testing ? "not-allowed" : "pointer",
            background: testing ? "#f8fafc" : "#fff", color: "#1e3c72",
            fontSize: 14, fontWeight: 700, opacity: testing ? 0.6 : 1,
          }}
        >
          {testing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <TestTube2 className="h-4 w-4" />}
          {testing ? "جاري الإرسال..." : "إرسال بريد اختبار لي"}
        </button>
      </div>
    </div>
  );
}
