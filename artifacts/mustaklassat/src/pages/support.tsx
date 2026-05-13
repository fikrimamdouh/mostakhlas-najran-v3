import { useState } from "react";
import { useUser } from "@clerk/react";
import { useGetMe } from "@workspace/api-client-react";
import { useAuth } from "@clerk/react";
import { MessageSquare, Send, CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { parseAllowedModules } from "@/lib/modules";

export default function Support() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const { data: dbUser } = useGetMe({ query: { queryKey: ["/api/users/me"] } });

  // Access control — admin/supervisor أو من لديه صلاحية support
  const role = dbUser?.role ?? "";
  const allowedModuleKeys = parseAllowedModules((dbUser as any)?.allowedModules);
  const isPrivileged = role === "admin" || role === "supervisor";
  const hasAccess = isPrivileged || allowedModuleKeys === null || allowedModuleKeys.includes("support");

  if (dbUser && !hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4" style={{ direction: "rtl" }}>
        <MessageSquare size={48} color="#7c3aed" />
        <h2 className="text-xl font-bold" style={{ color: "#1e3c72" }}>غير مصرح بالوصول</h2>
        <p className="text-gray-500">ليس لديك صلاحية لفتح صفحة مذكرة الدعم.</p>
        <Link href="/dashboard">
          <Button variant="outline">العودة للرئيسية</Button>
        </Link>
      </div>
    );
  }

  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  // Pre-fill from user data
  const displayName = form.name || dbUser?.name || user?.fullName || "";
  const displayEmail = form.email || dbUser?.email || user?.primaryEmailAddress?.emailAddress || "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.subject || !form.message) {
      setError("يرجى ملء جميع الحقول المطلوبة");
      return;
    }
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/support", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: displayName || form.name,
          email: displayEmail || form.email,
          subject: form.subject,
          message: form.message,
        }),
      });
      if (res.ok) {
        setSent(true);
      } else {
        const data = await res.json();
        setError(data.error || "فشل الإرسال، حاول مرة أخرى");
      }
    } catch {
      setError("حدث خطأ، تأكد من الاتصال بالإنترنت");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500" style={{ direction: "rtl" }}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard">
          <button className="flex items-center gap-1 text-sm hover:underline" style={{ color: "#1e3c72" }}>
            <ArrowRight className="h-4 w-4" />
            العودة للرئيسية
          </button>
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3" style={{ color: "#1e3c72" }}>
          <MessageSquare className="h-8 w-8" style={{ color: "#d4af37" }} />
          مذكرة دعم
        </h1>
        <p className="text-gray-500 mt-1">
          أرسل طلب دعم أو استفساراً وسيصلك الرد عبر البريد الإلكتروني
        </p>
      </div>

      {sent ? (
        <div className="rounded-2xl p-10 text-center border" style={{ borderColor: "#e8edf7", background: "#fff" }}>
          <CheckCircle className="h-16 w-16 mx-auto mb-4" style={{ color: "#16a34a" }} />
          <h2 className="text-2xl font-bold mb-2" style={{ color: "#16a34a" }}>تم الإرسال بنجاح!</h2>
          <p className="text-gray-500 mb-6">
            تم إرسال مذكرتك لمدير النظام. سيتم الرد عليك عبر البريد الإلكتروني في أقرب وقت.
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => { setSent(false); setForm({ ...form, subject: "", message: "" }); }}
              variant="outline">إرسال مذكرة أخرى</Button>
            <Link href="/dashboard">
              <Button style={{ background: "linear-gradient(135deg,#1e3c72,#2a5298)", color: "#fff", border: "none" }}>
                العودة للرئيسية
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit}
          className="rounded-2xl p-6 space-y-5 border shadow-sm"
          style={{ borderColor: "#e8edf7", background: "#fff" }}>

          <div className="grid grid-cols-2 gap-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: "#1e3c72" }}>
                الاسم <span className="text-red-500">*</span>
              </label>
              <Input
                value={displayName}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="الاسم الكامل"
                required
                disabled={!!dbUser?.name}
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: "#1e3c72" }}>
                البريد الإلكتروني <span className="text-red-500">*</span>
              </label>
              <Input
                type="email"
                value={displayEmail}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="your@email.com"
                required
                disabled={!!dbUser?.email}
              />
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: "#1e3c72" }}>
              موضوع المذكرة <span className="text-red-500">*</span>
            </label>
            <Input
              value={form.subject}
              onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              placeholder="مثال: مشكلة في تسجيل الدخول"
              required
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: "#1e3c72" }}>
              تفاصيل المذكرة <span className="text-red-500">*</span>
            </label>
            <textarea
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              placeholder="اشرح طلبك أو مشكلتك بالتفصيل..."
              rows={6}
              required
              className="w-full rounded-md border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2"
              style={{ borderColor: "#e2e8f0", color: "#1e3c72" }}
            />
          </div>

          {error && (
            <div className="rounded-lg p-3 bg-red-50 text-red-600 text-sm border border-red-200">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 text-base font-bold"
            style={{ background: "linear-gradient(135deg,#1e3c72,#2a5298)", color: "#fff", border: "none" }}
          >
            {loading ? (
              <span className="flex items-center gap-2"><span className="animate-spin">⏳</span> جاري الإرسال...</span>
            ) : (
              <span className="flex items-center gap-2"><Send className="h-5 w-5" /> إرسال المذكرة</span>
            )}
          </Button>

          <p className="text-center text-xs text-gray-400">
            سيصل ردّ مدير النظام على بريدك الإلكتروني: <strong>{displayEmail}</strong>
          </p>
        </form>
      )}
    </div>
  );
}
