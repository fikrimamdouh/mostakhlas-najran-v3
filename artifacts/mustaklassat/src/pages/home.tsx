import { Link } from "wouter";
import { ArrowLeft, ShieldCheck, FileSpreadsheet, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div
      className="min-h-screen flex flex-col font-sans relative overflow-hidden"
      style={{ direction: "rtl" }}
    >
      <video className="absolute inset-0 h-full w-full object-cover" autoPlay muted loop playsInline>
        <source src="/original/pattern-1.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(30,60,114,0.86) 0%, rgba(42,82,152,0.86) 100%)" }} />
      <div className="relative z-10 min-h-screen flex flex-col">
      {/* Header */}
      <header
        className="fixed top-0 left-0 right-0 z-50 border-b"
        style={{
          background: "rgba(30, 60, 114, 0.85)",
          backdropFilter: "blur(12px)",
          borderColor: "rgba(255,255,255,0.15)",
        }}
      >
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="تجمع نجران الصحي"
              className="h-12 w-auto drop-shadow-md"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <div className="flex flex-col">
              <span className="font-bold text-xl text-white leading-tight">
                تجمع نجران الصحي
              </span>
              <span className="text-xs font-medium" style={{ color: "#d4af37" }}>
                وحدة الصيانة العامة
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/sign-in">
              <Button
                variant="ghost"
                className="font-bold text-base text-white hover:text-white"
                style={{ background: "rgba(255,255,255,0.1)" }}
              >
                تسجيل الدخول
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button
                className="font-bold text-base px-6"
                style={{
                  background: "linear-gradient(135deg, #d4af37, #b8962e)",
                  color: "#1e3c72",
                  border: "none",
                  boxShadow: "0 5px 15px rgba(212,175,55,0.3)",
                }}
              >
                حساب جديد
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center pt-24 pb-16 px-6">
        <section className="w-full max-w-4xl mx-auto py-16 text-center flex flex-col items-center">
          {/* Logo */}
          <div
            className="mb-8 animate-bounce"
            style={{ animation: "float 3s ease-in-out infinite" }}
          >
            <img
              src="/logo.png"
              alt="شعار تجمع نجران الصحي"
              className="h-28 w-auto mx-auto drop-shadow-2xl"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>

          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 border text-sm font-medium"
            style={{
              background: "rgba(255,255,255,0.12)",
              borderColor: "rgba(212,175,55,0.4)",
              color: "#d4af37",
              backdropFilter: "blur(8px)",
            }}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>نظام إدارة المستخلصات الشهرية للمشاريع التشغيلية والإنشائية</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold text-white leading-tight mb-6 max-w-4xl">
            نظام إدارة المستخلصات الشهرية للمشاريع التشغيلية والإنشائية
          </h1>
          <h2 className="text-xl md:text-2xl font-semibold mb-8" style={{ color: "rgba(255,255,255,0.9)" }}>
            برنامج المستخلصات الشهرية
          </h2>
          <p className="text-lg mb-10 max-w-2xl leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
            تمكّن الشركات من تسجيل بيانات المستخلصات، رفع المستندات، متابعة حالات الاعتماد، ومراجعة المستخلصات السابقة، مع ضمان دقة الإجراءات وسرعة دورة الاعتماد.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Link href="/sign-up">
              <Button
                size="lg"
                className="h-14 px-10 text-lg font-bold"
                style={{
                  background: "linear-gradient(135deg, #d4af37, #b8962e)",
                  color: "#1e3c72",
                  border: "none",
                  boxShadow: "0 10px 30px rgba(212,175,55,0.35)",
                }}
              >
                ابدأ الاستخدام الآن
                <ArrowLeft className="mr-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/sign-in">
              <Button
                size="lg"
                variant="outline"
                className="h-14 px-10 text-lg font-bold text-white"
                style={{
                  background: "rgba(255,255,255,0.1)",
                  borderColor: "rgba(255,255,255,0.3)",
                  backdropFilter: "blur(8px)",
                }}
              >
                تسجيل الدخول
              </Button>
            </Link>
          </div>
        </section>

        {/* Feature Cards */}
        <section className="w-full max-w-5xl mx-auto px-4 pb-8 grid md:grid-cols-3 gap-6">
          {[
            {
              icon: <FileSpreadsheet className="h-7 w-7" />,
              title: "دورة حياة المستخلصات",
              desc: "تتبع المستخلصات من الإنشاء وحتى الاعتماد، مع سجل كامل للتعديلات والملاحظات.",
            },
            {
              icon: <FolderKanban className="h-7 w-7" />,
              title: "إدارة المشاريع",
              desc: "تنظيم المشاريع وإدارة قيم العقود ومراقبة الإنجاز المالي بوضوح.",
            },
            {
              icon: <ShieldCheck className="h-7 w-7" />,
              title: "صلاحيات واعتمادات",
              desc: "نظام محكم للموافقات يفصل بين صلاحيات المنفذين والمعتمدين لضمان الشفافية.",
            },
          ].map((card) => (
            <div
              key={card.title}
              className="rounded-2xl p-6 text-center transition-all duration-300 hover:-translate-y-1"
              style={{
                background: "rgba(255,255,255,0.95)",
                backdropFilter: "blur(10px)",
                boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
              }}
            >
              <div
                className="h-14 w-14 rounded-xl flex items-center justify-center mx-auto mb-4"
                style={{
                  background: "linear-gradient(135deg, #2a5298, #1e3c72)",
                  color: "#ffffff",
                }}
              >
                {card.icon}
              </div>
              <h3 className="text-xl font-bold mb-3" style={{ color: "#1e3c72" }}>
                {card.title}
              </h3>
              <p className="leading-relaxed text-sm" style={{ color: "#5a6a8a" }}>
                {card.desc}
              </p>
            </div>
          ))}
        </section>
      </main>

      {/* Footer */}
      <footer
        className="py-6 text-center"
        style={{
          background: "rgba(0,0,0,0.25)",
          backdropFilter: "blur(10px)",
          borderTop: "1px solid rgba(255,255,255,0.15)",
        }}
      >
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
          جميع الحقوق محفوظة &copy; {new Date().getFullYear()} تجمع نجران الصحي
        </p>
        <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
          وحدة الصيانة العامة بتجمع نجران الصحي - رؤية المملكة 2030
        </p>
      </footer>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
      </div>
    </div>
  );
}
