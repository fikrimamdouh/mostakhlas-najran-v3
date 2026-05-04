import { Link } from "wouter";
import { Building2, ArrowLeft, ShieldCheck, FileSpreadsheet, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <header className="border-b border-border bg-white/50 backdrop-blur-sm fixed top-0 left-0 right-0 z-50">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-xl text-primary">
              <Building2 className="h-7 w-7" />
            </div>
            <span className="font-bold text-2xl tracking-tight text-foreground">نظام المستخلصات</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/sign-in">
              <Button variant="ghost" className="font-bold text-base hover:bg-primary/5">تسجيل الدخول</Button>
            </Link>
            <Link href="/sign-up">
              <Button className="font-bold text-base px-6 shadow-sm">حساب جديد</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center pt-32 pb-16">
        <section className="w-full max-w-5xl mx-auto px-6 py-20 text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary font-medium text-sm mb-8 border border-primary/20">
            <ShieldCheck className="h-4 w-4" />
            <span>نظام معتمد لإدارة المشاريع الإنشائية</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold text-foreground leading-[1.2] mb-8 max-w-4xl">
            إدارة <span className="text-primary">المستخلصات المالية</span> بثقة ودقة متناهية
          </h1>
          <p className="text-xl text-muted-foreground mb-12 max-w-2xl leading-relaxed">
            منصة متكاملة لمهندسي ومحاسبي قطاع المقاولات. تتبع المستخلصات الجارية والسابقة، راقب ميزانيات المشاريع، وأدر عمليات الاعتماد في مكان واحد.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Link href="/sign-up">
              <Button size="lg" className="h-14 px-8 text-lg font-bold shadow-lg shadow-primary/20">
                ابدأ الاستخدام الآن
                <ArrowLeft className="mr-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </section>

        <section className="w-full max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-8">
          <div className="bg-card border border-border p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <div className="h-12 w-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-6">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-3">دورة حياة المستخلصات</h3>
            <p className="text-muted-foreground leading-relaxed">
              تتبع المستخلصات من الإنشاء وحتى الاعتماد، مع سجل كامل للتعديلات والملاحظات.
            </p>
          </div>
          <div className="bg-card border border-border p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <div className="h-12 w-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-6">
              <FolderKanban className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-3">إدارة المشاريع</h3>
            <p className="text-muted-foreground leading-relaxed">
              تنظيم المشاريع وإدارة قيم العقود ومراقبة الإنجاز المالي بوضوح.
            </p>
          </div>
          <div className="bg-card border border-border p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <div className="h-12 w-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-6">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-3">صلاحيات واعتمادات</h3>
            <p className="text-muted-foreground leading-relaxed">
              نظام محكم للموافقات يفصل بين صلاحيات المنفذين والمعتمدين لضمان الشفافية.
            </p>
          </div>
        </section>
      </main>

      <footer className="bg-sidebar text-sidebar-foreground border-t border-sidebar-border py-12">
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center gap-3 mb-4 md:mb-0">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">نظام المستخلصات</span>
          </div>
          <p className="text-sidebar-foreground/60 text-sm">
            جميع الحقوق محفوظة &copy; {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}