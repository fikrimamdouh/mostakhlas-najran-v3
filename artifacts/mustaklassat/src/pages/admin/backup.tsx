import { useState } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import {
  Download, Database, Users, FileText, ShieldCheck, RefreshCw,
  AlertTriangle, CheckCircle, Clock, HardDrive, CloudOff, Archive,
} from "lucide-react";

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" });
}

function fmtSize(n: number) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + " MB";
  if (n >= 1000) return (n / 1000).toFixed(1) + " KB";
  return n + " B";
}

const EXTRACT_TYPE_LABELS: Record<string, string> = {
  labor: "عمالة المستشفى",
  consumables: "مستهلكات المستشفى",
  spare_parts: "قطع الغيار",
  health_centers: "المراكز الصحية",
  admin_offices: "المكاتب الإدارية",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  submitted: { label: "مُرسَل", color: "#3b82f6" },
  under_review: { label: "تحت المراجعة", color: "#f59e0b" },
  approved: { label: "معتمد", color: "#22c55e" },
  rejected: { label: "مرفوض", color: "#ef4444" },
  needs_revision: { label: "يحتاج تعديل", color: "#f97316" },
};

export default function AdminBackupPage() {
  const { data: me } = useGetMe({ query: { queryKey: ["/api/users/me"] } });
  const [, setLocation] = useLocation();
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [lastDownload, setLastDownload] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (me?.role !== "admin") {
    setLocation("/dashboard");
    return null;
  }

  async function fetchStats() {
    setLoadingStats(true);
    setError(null);
    try {
      const session = JSON.parse(localStorage.getItem("najran_session") || "{}");
      const res = await fetch("/api/admin/backup/stats", {
        headers: { Authorization: `Bearer ${session.clerkToken}` },
        credentials: "include",
      });
      if (!res.ok) throw new Error("فشل في جلب الإحصائيات");
      const data = await res.json();
      setStats(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingStats(false);
    }
  }

  async function downloadFullBackup() {
    setDownloading(true);
    setError(null);
    try {
      const session = JSON.parse(localStorage.getItem("najran_session") || "{}");
      const res = await fetch("/api/admin/backup/full", {
        headers: { Authorization: `Bearer ${session.clerkToken}` },
        credentials: "include",
      });
      if (!res.ok) throw new Error("فشل في تصدير النسخة الاحتياطية");
      const data = await res.json();

      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      a.download = `نسخة_احتياطية_شاملة_نجران_${dateStr}.json`;
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);

      const sizeStr = fmtSize(blob.size);
      setLastDownload(`${new Date().toLocaleString("ar-EG")} — ${sizeStr}`);
      setStats((s: any) => s || { counts: data.meta.counts });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDownloading(false);
    }
  }

  const cardStyle = {
    background: "#fff",
    borderRadius: "16px",
    boxShadow: "0 2px 16px rgba(30,60,114,0.08)",
    border: "1px solid #e8edf7",
    padding: "24px",
  };

  const statCard = (icon: any, label: string, value: number | string, color: string) => (
    <div style={{ ...cardStyle, padding: "20px", textAlign: "center" as const }}>
      <div className="flex justify-center mb-3">
        <div style={{ background: color + "18", borderRadius: "12px", padding: "10px" }}>
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold" style={{ color: "#1e3c72" }}>{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f4f7fc", direction: "rtl", fontFamily: "Tajawal, sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 16px" }}>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div style={{ background: "linear-gradient(135deg,#1e3c72,#2a5298)", borderRadius: "12px", padding: "10px" }}>
              <Archive className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "#1e3c72" }}>النسخ الاحتياطي الشامل</h1>
              <p className="text-gray-500 text-sm">إدارة واستيراد النسخ الاحتياطية لجميع بيانات النظام</p>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 rounded-xl p-4 mb-6"
            style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Layers Explanation */}
        <div style={{ ...cardStyle, marginBottom: 24 }}>
          <h2 className="text-lg font-bold mb-4" style={{ color: "#1e3c72" }}>
            🛡️ طبقات الحماية في النظام
          </h2>
          <div className="grid grid-cols-1 gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px,1fr))" }}>
            {[
              {
                icon: <CloudOff className="h-5 w-5" style={{ color: "#3b82f6" }} />,
                title: "المزامنة السحابية التلقائية",
                desc: "كل دقيقة يُرفع كل ما في متصفح المستخدم إلى قاعدة البيانات تلقائياً. إذا وقع الكمبيوتر، البيانات آمنة في السحابة.",
                badge: "تلقائي",
                badgeColor: "#3b82f6",
              },
              {
                icon: <HardDrive className="h-5 w-5" style={{ color: "#22c55e" }} />,
                title: "النسخ اليدوية (JSON)",
                desc: "كل مستخدم يستطيع تحميل نسخة كاملة من بياناته على جهازه من زر 'حفظ نسخة' في كل صفحة. النسخة مستقلة عن الإنترنت.",
                badge: "يدوي",
                badgeColor: "#22c55e",
              },
              {
                icon: <Database className="h-5 w-5" style={{ color: "#d4af37" }} />,
                title: "المستخلصات المرفوعة",
                desc: "كل مستخلص يُرفع يُحفظ كاملاً في قاعدة البيانات مع لقطة كاملة من جميع البيانات. لا يُمسح أبداً.",
                badge: "دائم",
                badgeColor: "#d4af37",
              },
            ].map((layer) => (
              <div key={layer.title} className="flex gap-3 p-4 rounded-xl"
                style={{ background: "#f8faff", border: "1px solid #e8edf7" }}>
                <div style={{ background: "#fff", borderRadius: "10px", padding: "8px", alignSelf: "flex-start", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
                  {layer.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm" style={{ color: "#1e3c72" }}>{layer.title}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold text-white"
                      style={{ background: layer.badgeColor }}>{layer.badge}</span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{layer.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Action */}
        <div style={{ ...cardStyle, marginBottom: 24 }}>
          <h2 className="text-lg font-bold mb-1" style={{ color: "#1e3c72" }}>📥 تصدير نسخة احتياطية شاملة</h2>
          <p className="text-sm text-gray-500 mb-5">
            يصدّر ملف JSON واحد يحتوي على <strong>كل شيء</strong>: المستخدمون، المستخلصات، بيانات السحابة، سجل المراقبة، سجل التعديلات.
            احفظه في مكان آمن (Google Drive، USB، إلخ).
          </p>

          <div className="flex flex-wrap gap-3 items-center">
            <button
              onClick={downloadFullBackup}
              disabled={downloading}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white transition-all"
              style={{
                background: downloading ? "#9ca3af" : "linear-gradient(135deg,#1e3c72,#2a5298)",
                boxShadow: downloading ? "none" : "0 4px 14px rgba(30,60,114,0.3)",
                cursor: downloading ? "not-allowed" : "pointer",
                border: "none",
                fontSize: "15px",
              }}
            >
              {downloading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
              {downloading ? "جاري التصدير..." : "تحميل النسخة الشاملة"}
            </button>

            <button
              onClick={fetchStats}
              disabled={loadingStats}
              className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold transition-all"
              style={{
                background: "#f1f5f9",
                border: "1px solid #e2e8f0",
                color: "#475569",
                cursor: loadingStats ? "not-allowed" : "pointer",
                fontSize: "14px",
              }}
            >
              {loadingStats ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              عرض الإحصائيات
            </button>
          </div>

          {lastDownload && (
            <div className="flex items-center gap-2 mt-4 text-sm" style={{ color: "#22c55e" }}>
              <CheckCircle className="h-4 w-4" />
              <span>آخر تحميل: {lastDownload}</span>
            </div>
          )}
        </div>

        {/* Stats */}
        {stats && (
          <>
            <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))" }}>
              {statCard(<Users className="h-5 w-5" style={{ color: "#3b82f6" }} />, "إجمالي المستخدمين", stats.counts.users, "#3b82f6")}
              {statCard(<ShieldCheck className="h-5 w-5" style={{ color: "#22c55e" }} />, "مستخدمون معتمدون", stats.counts.approvedUsers, "#22c55e")}
              {statCard(<FileText className="h-5 w-5" style={{ color: "#d4af37" }} />, "مستخلصات مرفوعة", stats.counts.extracts, "#d4af37")}
              {statCard(<Database className="h-5 w-5" style={{ color: "#8b5cf6" }} />, "مفاتيح بيانات سحابية", stats.counts.storageKeys, "#8b5cf6")}
              {statCard(<Archive className="h-5 w-5" style={{ color: "#f97316" }} />, "سجلات مراقبة", stats.counts.auditLogs, "#f97316")}
              {statCard(<Clock className="h-5 w-5" style={{ color: "#06b6d4" }} />, "سجلات تعديلات", stats.counts.revisions, "#06b6d4")}
            </div>

            {/* Users Sync Status */}
            {stats.users?.length > 0 && (
              <div style={{ ...cardStyle, marginBottom: 24 }}>
                <h2 className="text-base font-bold mb-4" style={{ color: "#1e3c72" }}>👥 حالة مزامنة المستخدمين</h2>
                <div className="overflow-x-auto">
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ background: "#f1f5f9" }}>
                        {["الاسم", "البريد الإلكتروني", "الموقع", "الدور", "الحالة", "مفاتيح السحابة", "آخر مزامنة"].map(h => (
                          <th key={h} style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "#475569", borderBottom: "1px solid #e2e8f0" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stats.users.map((u: any) => (
                        <tr key={u.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "10px 12px", fontWeight: 600 }}>{u.name}</td>
                          <td style={{ padding: "10px 12px", color: "#64748b", direction: "ltr", textAlign: "left" }}>{u.email}</td>
                          <td style={{ padding: "10px 12px" }}>{u.hospital || "—"}</td>
                          <td style={{ padding: "10px 12px" }}>
                            <span style={{
                              background: u.role === "admin" ? "#fef3c7" : u.role === "supervisor" ? "#dbeafe" : "#f1f5f9",
                              color: u.role === "admin" ? "#d97706" : u.role === "supervisor" ? "#2563eb" : "#64748b",
                              padding: "2px 8px", borderRadius: "9999px", fontSize: "12px", fontWeight: 600,
                            }}>
                              {u.role === "admin" ? "مدير" : u.role === "supervisor" ? "مشرف" : "مستخدم"}
                            </span>
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <span style={{
                              background: u.status === "approved" ? "#dcfce7" : u.status === "pending" ? "#fef9c3" : "#fee2e2",
                              color: u.status === "approved" ? "#16a34a" : u.status === "pending" ? "#ca8a04" : "#dc2626",
                              padding: "2px 8px", borderRadius: "9999px", fontSize: "12px", fontWeight: 600,
                            }}>
                              {u.status === "approved" ? "معتمد" : u.status === "pending" ? "معلق" : "مرفوض"}
                            </span>
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "center" }}>
                            <span style={{
                              background: u.storageCount > 0 ? "#ede9fe" : "#f1f5f9",
                              color: u.storageCount > 0 ? "#7c3aed" : "#94a3b8",
                              padding: "2px 8px", borderRadius: "9999px", fontSize: "12px", fontWeight: 700,
                            }}>
                              {u.storageCount}
                            </span>
                          </td>
                          <td style={{ padding: "10px 12px", color: "#64748b", fontSize: "12px" }}>{fmt(u.lastSync)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Recent Extracts */}
            {stats.recentExtracts?.length > 0 && (
              <div style={cardStyle}>
                <h2 className="text-base font-bold mb-4" style={{ color: "#1e3c72" }}>📋 آخر 10 مستخلصات مرفوعة</h2>
                <div className="overflow-x-auto">
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ background: "#f1f5f9" }}>
                        {["رقم", "النوع", "الجهة", "الفترة", "المبلغ", "الحالة", "تاريخ الرفع"].map(h => (
                          <th key={h} style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "#475569", borderBottom: "1px solid #e2e8f0" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentExtracts.map((e: any) => {
                        const s = STATUS_LABELS[e.status] || { label: e.status, color: "#64748b" };
                        return (
                          <tr key={e.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "10px 12px", fontWeight: 700, color: "#1e3c72" }}>#{e.id}</td>
                            <td style={{ padding: "10px 12px" }}>{EXTRACT_TYPE_LABELS[e.extractType] || e.extractType}</td>
                            <td style={{ padding: "10px 12px" }}>{e.hospitalName || "—"}</td>
                            <td style={{ padding: "10px 12px" }}>{e.periodMonth || "—"}</td>
                            <td style={{ padding: "10px 12px", fontWeight: 600 }}>
                              {e.totalAmount ? Number(e.totalAmount).toLocaleString("ar-EG") + " ﷼" : "—"}
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              <span style={{
                                background: s.color + "20", color: s.color,
                                padding: "2px 8px", borderRadius: "9999px", fontSize: "12px", fontWeight: 600,
                              }}>{s.label}</span>
                            </td>
                            <td style={{ padding: "10px 12px", color: "#64748b", fontSize: "12px" }}>{fmt(e.createdAt)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Recovery Guide */}
        <div style={{ ...cardStyle, marginTop: 24, background: "#fffbeb", border: "1px solid #fde68a" }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5" style={{ color: "#d97706" }} />
            <h2 className="font-bold" style={{ color: "#92400e" }}>خطة الطوارئ — ماذا تفعل لو وقع السيستم؟</h2>
          </div>
          <div className="space-y-2 text-sm" style={{ color: "#78350f" }}>
            <p><strong>1.</strong> ابحث عن آخر ملف نسخة احتياطية حملته (نسخة_احتياطية_شاملة_نجران_....json)</p>
            <p><strong>2.</strong> إذا لم تجد ملفاً — قاعدة البيانات (Neon) تحتفظ بنسخة تلقائية لآخر 30 يوم من لوحة Neon Console</p>
            <p><strong>3.</strong> بيانات المستخلصات المرفوعة محفوظة دائماً في قاعدة البيانات ولا تُمسح إطلاقاً</p>
            <p><strong>4.</strong> بيانات المتصفح (localStorage) تُعاد من السحابة تلقائياً عند أول دخول بعد إعادة التشغيل</p>
            <p><strong>5.</strong> في أسوأ الحالات — تواصل مع مطور النظام مع ملف JSON الاحتياطي لاستعادة كل شيء</p>
          </div>
        </div>

      </div>
    </div>
  );
}
