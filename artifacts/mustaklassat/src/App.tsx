import { Component, useEffect, useRef, useState } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useUser, useAuth } from '@clerk/react';
import { shadcn } from '@clerk/themes';
import { arSA } from '@clerk/localizations';
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MainLayout } from "@/components/layout/MainLayout";
import { useGetMe, setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";

// إذا كان VITE_API_URL محدداً استخدمه كقاعدة للـ API — وإلا تُستخدم المسارات النسبية (/api/...)
const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
if (apiUrl) setBaseUrl(apiUrl);


import Home from "@/pages/home";
import Dashboard from "@/pages/dashboard";
import NotFound from "@/pages/not-found";
import Support from "@/pages/support";

import ExtractsList from "@/pages/extracts/index";
import NewExtract from "@/pages/extracts/new";
import ExtractDetail from "@/pages/extracts/detail";

import ProjectsList from "@/pages/projects/index";
import NewProject from "@/pages/projects/new";

import AdminUsers from "@/pages/admin/users";
import AuditLog from "@/pages/admin/audit";
import UsersView from "@/pages/admin/users-view";
import ContractSupervisorPage from "@/pages/admin/contract-supervisor";
import AdminBackup from "@/pages/admin/backup";
import ExtractsStats from "@/pages/admin/stats";
import HospitalsAdmin from "@/pages/admin/hospitals";
import AdminNotifications from "@/pages/admin/notifications";
import ViewerDashboard from "@/pages/viewer/dashboard";
import Settings from "@/pages/settings";
import OriginalViewer from "@/pages/OriginalViewer";
import ExtractsTrack from "@/pages/extracts/track";
import ContactsRegistry from "@/pages/contacts";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

// Use VITE_CLERK_PUBLISHABLE_KEY directly so Vercel can override it with
// a live key (pk_live_...) while Replit dev continues to use pk_test_...
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  baseTheme: shadcn,
  variables: { colorPrimary: "#1e3c72", colorBackground: "#fff", borderRadius: "12px" },
  elements: {
    card: { boxShadow: "0 20px 60px rgba(30,60,114,0.15)", border: "1px solid rgba(30,60,114,0.1)" },
    headerTitle: { color: "#1e3c72", fontWeight: "800", fontSize: "1.5rem" },
    headerSubtitle: { color: "#6b7280" },
    formButtonPrimary: { background: "linear-gradient(135deg,#1e3c72,#2a5298)", color: "#fff" },
    footerActionLink: { color: "#1e3c72", fontWeight: "600" },
    formFieldInput: { borderColor: "#d1d5db" },
    logoBox: { display: "none" },
    footer: { display: "none" },
  },
};

function useHideClerkBadge() {
  useEffect(() => {
    // فقط عناصر تحتوي على هذا النص بالضبط (قصيرة لا تحوي محتوى النموذج)
    const BADGE_TEXTS = ["Development mode", "Secured by Clerk"];
    const hideIfBadge = (el: Element) => {
      // نحصل على النص المباشر (بدون نصوص العناصر الفرعية)
      const ownText = Array.from(el.childNodes)
        .filter(n => n.nodeType === Node.TEXT_NODE)
        .map(n => n.textContent ?? "")
        .join("")
        .trim();
      // نتحقق من النص الكامل مع تضييق الحد ليكون 22 حرف فقط
      const fullText = (el.textContent ?? "").trim();
      if (fullText.length > 22) return;
      if (BADGE_TEXTS.some(t => fullText === t || ownText === t)) {
        // نخفي أكبر عنصر أب له كلاس cl-internal ولكن ليس البطاقة كلها
        let target: Element = el;
        let parent = el.parentElement;
        while (parent && parent.className?.includes?.("cl-internal") && (parent.textContent ?? "").trim().length <= 22) {
          target = parent;
          parent = parent.parentElement;
        }
        (target as HTMLElement).style.setProperty("display", "none", "important");
      }
    };
    const sweep = () => {
      document.querySelectorAll("[class*='cl-internal']").forEach(hideIfBadge);
      document.querySelectorAll(".cl-poweredByClerk,[class*='cl-poweredBy']").forEach(el => {
        (el as HTMLElement).style.setProperty("display", "none", "important");
      });
    };
    sweep();
    const observer = new MutationObserver(sweep);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
}

function SignInPage() {
  useHideClerkBadge();
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center p-4" style={{ background: "linear-gradient(135deg,#1e3c72 0%,#2a5298 100%)" }}>
      <div className="mb-6 flex flex-col items-center">
        <img src="/logo.png" alt="شعار تجمع نجران الصحي" className="h-16 w-auto drop-shadow-lg mb-3" onError={e => (e.target as HTMLImageElement).style.display = "none"} />
        <span className="text-white font-bold text-xl">تجمع نجران الصحي</span>
        <span className="text-sm" style={{ color: "#d4af37" }}>وحدة الصيانة العامة</span>
      </div>
      <SignIn routing="path" path={`${basePath}/sign-in`} />
    </div>
  );
}

const PRE_REG_KEY = "najran_prereg";

// ======= بيانات الشركات والمواقع =======
const COMPANY_SITES = {
  "تجمع_نجران": {
    label: "تجمع نجران الصحي — وحدة الصيانة العامة",
    sites: [
      { name: "المقر الرئيسي — تجمع نجران الصحي", contract: "" },
    ],
  },
  "بيت_العرب": {
    label: "شركة مجموعة بيت العرب الحديثة المحدودة",
    sites: [
      { name: "مستشفى يدمه العام",                                         contract: "250811180425" },
      { name: "مستشفى حبونا العام",                                        contract: "250811180425" },
      { name: "مستشفى بدر الجنوب العام",                                   contract: "250811180425" },
      { name: "مستشفى الولادة والأطفال",                                   contract: "250701156483" },
      { name: "مستشفى نجران العام القديم وسكن الممرضات الخارجي",           contract: "250701156483" },
      { name: "المكاتب الإدارية والمرافق الصحية",                         contract: "250701156483" },
      { name: "صيانة وإصلاح السيارات والعيادات المتنقلة",                  contract: "250701156483" },
    ],
  },
  "سراكو": {
    label: "شركة سراكو",
    sites: [
      { name: "مستشفى نجران العام الجديد",          contract: "" },
      { name: "مركز طب الأسنان التخصصي",           contract: "" },
      { name: "مجمع الأمل للصحة النفسية",           contract: "" },
      { name: "مستشفى ثار العام",                   contract: "" },
      { name: "مستشفى خباش العام",                  contract: "" },
      { name: "المراكز الصحية",                    contract: "" },
      { name: "مستشفى الملك خالد",                  contract: "" },
      { name: "مركز الأمير سلطان",                  contract: "" },
      { name: "مستشفى شروره العام",                 contract: "" },
    ],
  },
} as const;

type CompanyKey = keyof typeof COMPANY_SITES;

const selectStyle = (hasError: boolean): React.CSSProperties => ({
  borderColor: hasError ? "#f87171" : "#d1d5db",
  background: "#fff",
  width: "100%",
  borderRadius: "8px",
  border: `1px solid ${hasError ? "#f87171" : "#d1d5db"}`,
  padding: "10px 16px",
  fontSize: "14px",
  outline: "none",
  appearance: "auto" as const,
  direction: "rtl",
});

function PreRegistrationForm({ onNext }: { onNext: () => void }) {
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    company: "" as CompanyKey | "",
    hospital: "",
    jobTitle: "",
    contractNumber: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});

  type SiteEntry = { readonly name: string; readonly contract: string };
  const companySites: readonly SiteEntry[] = form.company ? COMPANY_SITES[form.company].sites : [];

  const handleCompanyChange = (val: string) => {
    setForm(f => ({ ...f, company: val as CompanyKey | "", hospital: "", contractNumber: "" }));
    setErrors(er => ({ ...er, company: "", hospital: "" }));
  };

  const handleSiteChange = (siteName: string) => {
    const site = companySites.find(s => s.name === siteName);
    const contract = site?.contract || "";
    setForm(f => ({ ...f, hospital: siteName, contractNumber: contract }));
    setErrors(er => ({ ...er, hospital: "" }));
  };

  const validate = () => {
    const e: Partial<Record<keyof typeof form, string>> = {};
    if (!form.fullName.trim()) e.fullName = "الاسم الكامل مطلوب";
    if (!form.phone.trim()) e.phone = "رقم الهاتف مطلوب";
    else if (!/^05\d{8}$/.test(form.phone.replace(/\s/g, ""))) e.phone = "رقم هاتف غير صحيح (يبدأ بـ 05)";
    if (!form.company) e.company = "يرجى اختيار الشركة";
    if (!form.hospital.trim()) e.hospital = "يرجى اختيار الموقع";
    if (!form.jobTitle.trim()) e.jobTitle = "الوظيفة مطلوبة";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    sessionStorage.setItem(PRE_REG_KEY, JSON.stringify(form));
    onNext();
  };

  const inputClass = (key: keyof typeof form) =>
    `w-full rounded-lg border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors[key] ? "border-red-400 bg-red-50" : ""}`;

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center p-4" style={{ background: "linear-gradient(135deg,#1e3c72 0%,#2a5298 100%)", direction: "rtl" }}>
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg">
        <div className="text-center mb-6">
          <img src="/logo.png" alt="" className="h-14 w-auto mx-auto mb-3 drop-shadow" onError={e => (e.target as HTMLImageElement).style.display = "none"} />
          <h2 className="text-2xl font-extrabold" style={{ color: "#1e3c72" }}>إنشاء حساب جديد</h2>
          <p className="text-gray-500 text-sm mt-1">يرجى إدخال بياناتك الكاملة أولاً قبل التسجيل</p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: "#1e3c72" }}>١</div>
            <span className="text-sm font-semibold" style={{ color: "#1e3c72" }}>بيانات التسجيل</span>
          </div>
          <div className="flex-1 h-0.5 bg-gray-200 mx-2 max-w-[60px]" />
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold bg-gray-300">٢</div>
            <span className="text-sm text-gray-400">إنشاء الحساب</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* الاسم الكامل */}
          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: "#1e3c72" }}>
              الاسم الكامل <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.fullName}
              onChange={e => { setForm(f => ({ ...f, fullName: e.target.value })); setErrors(er => ({ ...er, fullName: "" })); }}
              placeholder="محمد بن عبدالله الشهري"
              className={inputClass("fullName")}
              style={{ borderColor: errors.fullName ? "#f87171" : "#d1d5db" }}
            />
            {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName}</p>}
          </div>

          {/* رقم الهاتف */}
          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: "#1e3c72" }}>
              رقم الهاتف <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={e => { setForm(f => ({ ...f, phone: e.target.value })); setErrors(er => ({ ...er, phone: "" })); }}
              placeholder="05XXXXXXXX"
              className={inputClass("phone")}
              style={{ borderColor: errors.phone ? "#f87171" : "#d1d5db" }}
            />
            {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
          </div>

          {/* اختيار الشركة */}
          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: "#1e3c72" }}>
              الشركة المقاولة <span className="text-red-500">*</span>
            </label>
            <select
              value={form.company}
              onChange={e => handleCompanyChange(e.target.value)}
              style={selectStyle(!!errors.company)}
            >
              <option value="">— اختر الشركة —</option>
              {(Object.keys(COMPANY_SITES) as CompanyKey[]).map(key => (
                <option key={key} value={key}>{COMPANY_SITES[key].label}</option>
              ))}
            </select>
            {errors.company && <p className="text-red-500 text-xs mt-1">{errors.company}</p>}
          </div>

          {/* اختيار الموقع — يظهر فقط بعد اختيار الشركة */}
          {form.company && (
            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: "#1e3c72" }}>
                الموقع / المستشفى <span className="text-red-500">*</span>
              </label>
              <select
                value={form.hospital}
                onChange={e => handleSiteChange(e.target.value)}
                style={selectStyle(!!errors.hospital)}
              >
                <option value="">— اختر الموقع —</option>
                {companySites.map(site => (
                  <option key={site.name} value={site.name}>{site.name}</option>
                ))}
              </select>
              {errors.hospital && <p className="text-red-500 text-xs mt-1">{errors.hospital}</p>}
            </div>
          )}

          {/* المسمى الوظيفي */}
          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: "#1e3c72" }}>
              المسمى الوظيفي <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.jobTitle}
              onChange={e => { setForm(f => ({ ...f, jobTitle: e.target.value })); setErrors(er => ({ ...er, jobTitle: "" })); }}
              placeholder="مهندس صيانة / محاسب / مشرف..."
              className={inputClass("jobTitle")}
              style={{ borderColor: errors.jobTitle ? "#f87171" : "#d1d5db" }}
            />
            {errors.jobTitle && <p className="text-red-500 text-xs mt-1">{errors.jobTitle}</p>}
          </div>

          <button
            type="submit"
            className="w-full h-12 rounded-xl font-bold text-base text-white mt-2 transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#d4af37,#b8962e)", color: "#1e3c72" }}
          >
            التالي — إنشاء الحساب ←
          </button>

          <p className="text-center text-xs text-gray-400 mt-2">
            لديك حساب بالفعل؟{" "}
            <a href="/sign-in" className="font-semibold" style={{ color: "#1e3c72" }}>تسجيل الدخول</a>
          </p>
        </form>
      </div>
    </div>
  );
}

function SignUpPage() {
  const [step, setStep] = useState<"pre-reg" | "clerk">(() =>
    sessionStorage.getItem(PRE_REG_KEY) ? "clerk" : "pre-reg"
  );

  if (step === "pre-reg") {
    return <PreRegistrationForm onNext={() => setStep("clerk")} />;
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center p-4" style={{ background: "linear-gradient(135deg,#1e3c72 0%,#2a5298 100%)" }}>
      <div className="mb-4 flex flex-col items-center">
        <img src="/logo.png" alt="شعار تجمع نجران الصحي" className="h-14 w-auto drop-shadow-lg mb-2" onError={e => (e.target as HTMLImageElement).style.display = "none"} />
        <span className="text-white font-bold text-xl">تجمع نجران الصحي</span>
        <span className="text-sm" style={{ color: "#d4af37" }}>وحدة الصيانة العامة</span>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2 mb-4">
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold bg-green-500">✓</div>
          <span className="text-sm text-green-300 font-medium">بيانات التسجيل</span>
        </div>
        <div className="flex-1 h-0.5 bg-white/30 mx-2 max-w-[60px]" />
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: "#d4af37" }}>٢</div>
          <span className="text-sm font-semibold" style={{ color: "#d4af37" }}>إنشاء الحساب</span>
        </div>
      </div>

      <SignUp routing="path" path={`${basePath}/sign-up`} />

      <button
        onClick={() => { sessionStorage.removeItem(PRE_REG_KEY); setStep("pre-reg"); }}
        className="mt-3 text-white/60 text-xs hover:text-white/90 underline"
      >
        ← العودة وتعديل البيانات
      </button>
    </div>
  );
}

function ClerkTokenSyncer() {
  const { getToken } = useAuth();
  // Set during render (not in useEffect) so the token getter is available
  // before React Query fires its first request as a microtask.
  setAuthTokenGetter(getToken);
  return null;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);
  return null;
}


function RejectedPage() {
  const { signOut } = useClerk();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center" style={{ background: "linear-gradient(135deg,#1e3c72 0%,#2a5298 100%)" }}>
      <div className="bg-white rounded-2xl p-10 shadow-xl max-w-md w-full">
        <h2 className="text-2xl font-bold mb-3 text-red-600">تم رفض حسابك</h2>
        <p className="text-gray-600 mb-6">للاستفسار، تواصل مع مدير النظام.</p>
        <button onClick={() => signOut()} className="w-full py-3 rounded-xl font-bold border-2 border-red-200 text-red-600 hover:bg-red-50">تسجيل الخروج</button>
      </div>
    </div>
  );
}

// Pending page with sign-out button
function PendingPage() {
  const { signOut } = useClerk();
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center p-4 text-center" style={{ background: "linear-gradient(135deg,#1e3c72 0%,#2a5298 100%)", direction: "rtl" }}>
      <div className="bg-white rounded-2xl p-10 shadow-2xl max-w-md w-full">
        <img src="/logo.png" alt="" className="h-14 w-auto mx-auto mb-4 drop-shadow" onError={e => (e.target as HTMLImageElement).style.display = "none"} />
        <div className="text-5xl mb-4">⏳</div>
        <h2 className="text-2xl font-bold mb-3" style={{ color: "#1e3c72" }}>حسابك قيد المراجعة</h2>
        <p className="text-gray-600 mb-2">تم تسجيل طلبك بنجاح وإبلاغ مدير النظام.</p>
        <p className="text-gray-500 text-sm mb-8">سيصلك إشعار على بريدك الإلكتروني عند الموافقة على حسابك.</p>
        <button
          onClick={() => signOut()}
          className="w-full py-3 rounded-xl font-bold text-sm border-2 hover:bg-gray-50 transition-colors"
          style={{ borderColor: "#1e3c72", color: "#1e3c72" }}
        >
          تسجيل الخروج
        </button>
      </div>
    </div>
  );
}

// ======= شاشة اختيار الموقع =======
function HospitalPickerScreen({
  hospitals, currentHospital, onPick,
}: { hospitals: string[]; currentHospital: string | null; onPick: (h: string) => Promise<void> }) {
  const [loading, setLoading] = useState(false);
  return (
    <div style={{ display: "flex", minHeight: "100dvh", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16, background: "linear-gradient(135deg,#1e3c72 0%,#2a5298 100%)", direction: "rtl" }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: "36px 28px", maxWidth: 480, width: "100%", boxShadow: "0 20px 60px rgba(30,60,114,0.2)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <img src="/logo.png" alt="" style={{ height: 52, margin: "0 auto 12px", display: "block" }} onError={e => (e.target as HTMLImageElement).style.display = "none"} />
          <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#1e3c72", marginBottom: 4 }}>اختر الموقع</h2>
          <p style={{ color: "#6b7280", fontSize: "0.88rem" }}>اختر الموقع الذي ستعمل عليه في هذه الجلسة</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {hospitals.map(h => (
            <button
              key={h}
              disabled={loading}
              onClick={async () => { setLoading(true); await onPick(h); setLoading(false); }}
              style={{
                padding: "14px 18px", borderRadius: 12,
                border: h === currentHospital ? "2.5px solid #1e3c72" : "1.5px solid #e2e8f0",
                background: h === currentHospital ? "#f0f4ff" : "#fafafa",
                textAlign: "right", cursor: loading ? "not-allowed" : "pointer",
                fontWeight: 700, fontSize: "0.93rem", color: "#1e293b",
                display: "flex", alignItems: "center", gap: 10, width: "100%",
              }}
            >
              <span style={{ fontSize: "1.2rem" }}>🏥</span>
              <span style={{ flex: 1 }}>{h}</span>
              {h === currentHospital && <span style={{ fontSize: "0.75rem", color: "#1e3c72", background: "#e0e7ff", borderRadius: 6, padding: "2px 8px" }}>الحالي</span>}
            </button>
          ))}
        </div>
        {loading && <p style={{ textAlign: "center", color: "#6b7280", fontSize: "0.82rem", marginTop: 14 }}>⏳ جاري الحفظ...</p>}
      </div>
    </div>
  );
}

// Ensure user is synced with DB
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoaded: isClerkLoaded } = useUser();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle');
  const [hasToken, setHasToken] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  // Wait until getToken() returns a real JWT before firing any API call.
  // Clerk may return null on the first call even when isLoaded+user are ready
  // because the access token hasn't been fetched from Clerk's servers yet.
  useEffect(() => {
    if (!isClerkLoaded || !user?.id || hasToken) return;
    let cancelled = false;
    const tryGetToken = async () => {
      for (let i = 0; i < 8; i++) {
        const token = await getToken();
        if (cancelled) return;
        if (token) { setHasToken(true); return; }
        await new Promise(r => setTimeout(r, 400));
      }
    };
    tryGetToken();
    return () => { cancelled = true; };
  }, [isClerkLoaded, user?.id, getToken, hasToken]);

  const { data: dbUser, isLoading: isDbLoading, error } = useGetMe({
    query: {
      queryKey: ["/api/users/me"],
      enabled: !!user?.id && isClerkLoaded && hasToken,
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    }
  });

  const isNotFound = (error as any)?.status === 404;

  // تفعيل منتقي الموقع إذا كان للمستخدم أكثر من موقع مسموح
  const parsedHospitals: string[] = (() => {
    try { return JSON.parse((dbUser as any)?.hospitals || '[]'); } catch { return []; }
  })();
  const effectiveHospitals = parsedHospitals.length > 0 ? parsedHospitals : (dbUser?.hospital ? [dbUser.hospital] : []);

  useEffect(() => {
    if (!dbUser || dbUser.status !== "approved") return;
    if (effectiveHospitals.length <= 1) return;
    const sessionKey = `h_s_${dbUser.id}`;
    if (!sessionStorage.getItem(sessionKey)) setShowPicker(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbUser?.id, dbUser?.status, effectiveHospitals.length]);

  const handleHospitalPick = async (hosp: string) => {
    const token = await getToken();
    await fetch('/api/users/me/hospital', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ hospital: hosp }),
    });
    if (dbUser?.id) sessionStorage.setItem(`h_s_${dbUser.id}`, hosp);
    // انتظر اكتمال الـ refetch حتى يظهر dbUser المحدَّث قبل إخفاء الشاشة
    await queryClient.refetchQueries({ queryKey: ['/api/users/me'] });
    setShowPicker(false);
  };

  // Sync user data in two cases:
  // 1. Brand-new user (404) — create record with pre-reg data
  // 2. Existing user whose profile is incomplete AND sessionStorage has pre-reg data
  //    (happens when old account was deleted then re-registered with same email)
  useEffect(() => {
    if (!isClerkLoaded || !user || syncState !== 'idle') return;

    const preReg = (() => {
      try { return JSON.parse(sessionStorage.getItem(PRE_REG_KEY) || 'null'); } catch { return null; }
    })();

    const isNewUser = isNotFound;
    const isIncompleteProfile =
      !isNotFound &&
      dbUser &&
      !dbUser.hospital &&
      !(dbUser as any).phone &&
      preReg?.hospital;

    if (!isNewUser && !isIncompleteProfile) return;

    setSyncState('syncing');
    getToken().then(async token => {
      try {
        const res = await fetch('/api/users/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            email: user?.primaryEmailAddress?.emailAddress,
            name: preReg?.fullName || user?.fullName || user?.firstName || 'مستخدم',
            phone: preReg?.phone || '',
            company: preReg?.company || '',
            hospital: preReg?.hospital || '',
            jobTitle: preReg?.jobTitle || '',
            contractNumber: preReg?.contractNumber || '',
          }),
        });
        if (res.ok) {
          sessionStorage.removeItem(PRE_REG_KEY);
          queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
          setSyncState('done');
        } else {
          setSyncState('error');
        }
      } catch { setSyncState('error'); }
    });
  }, [isClerkLoaded, user, isNotFound, dbUser, syncState, getToken, queryClient]);

  // حفظ الجلسة + Clerk token
  useEffect(() => {
    if (!dbUser || dbUser.status !== "approved") return;

    const saveSession = (token: string | null) => {
      if (!token) return;
      // إذا كان المستخدم اختار مستشفى من المنتقي (switchHospital)، احتفظ بخياره
      let existingHospital: string | null = null;
      try {
        const raw = Storage.prototype.getItem.call(localStorage, 'najran_session');
        if (raw) existingHospital = JSON.parse(raw).hospital || null;
      } catch { /* ignore */ }
      localStorage.setItem('najran_session', JSON.stringify({
        userId: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role,
        hospital: dbUser.hospital || existingHospital,
        hospitals: (dbUser as any).hospitals || null,
        company: dbUser.company,
        phone: (dbUser as any).phone || null,
        jobTitle: (dbUser as any).jobTitle || null,
        contractNumber: (dbUser as any).contractNumber || null,
        allowedModules: (dbUser as any).allowedModules || null,
        clerkToken: token,
        timestamp: Date.now(),
      }));
    };

    getToken().then(token => {
      saveSession(token);
      if (token) {
        fetch('/api/users/me/login', {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${token}` },
        }).catch(() => {});
      }
    });

    // تحديث التوكن كل 50 ثانية لأن JWT ينتهي بعد 60 ثانية
    const interval = setInterval(() => {
      getToken().then(saveSession);
    }, 50_000);

    return () => clearInterval(interval);
  }, [dbUser, getToken]);

  if (!isClerkLoaded || (!!user?.id && !hasToken) || isDbLoading || syncState === 'syncing') {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-3" style={{ background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)' }}>
        <img src="/logo.png" alt="" className="h-16 w-auto opacity-80" onError={e => (e.target as HTMLImageElement).style.display = 'none'} />
        <p className="text-white text-lg font-medium">جاري التحميل...</p>
      </div>
    );
  }

  if (dbUser?.status === "pending") {
    return <PendingPage />;
  }

  if (dbUser?.status === "rejected") {
    return <RejectedPage />;
  }

  if (showPicker && effectiveHospitals.length > 1) {
    return (
      <HospitalPickerScreen
        hospitals={effectiveHospitals}
        currentHospital={dbUser?.hospital ?? null}
        onPick={handleHospitalPick}
      />
    );
  }

  return <>{children}</>;
}

function ProtectedRoute({ component: Component, adminOnly = false }: { component: any, adminOnly?: boolean }) {
  return (
    <Show when="signed-in" fallback={<Redirect to="/sign-in" />}>
      <AuthGuard>
        <MainLayout>
          <Component />
        </MainLayout>
      </AuthGuard>
    </Show>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <Home />
      </Show>
    </>
  );
}

function GlobalClerkBadgeHider() {
  useHideClerkBadge();
  return null;
}

// ===== صفحة فشل تحميل Clerk =====
function ClerkFailPage() {
  return (
    <div dir="rtl" style={{
      minHeight: "100dvh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: "20px",
      background: "linear-gradient(135deg,#1e3c72 0%,#2a5298 100%)",
      fontFamily: "inherit", padding: "24px", textAlign: "center"
    }}>
      <img src="/logo.png" alt="شعار تجمع نجران الصحي" style={{ height: 64, marginBottom: 8 }}
        onError={e => (e.target as HTMLImageElement).style.display = "none"} />
      <div style={{
        background: "#fff", borderRadius: 16, padding: "32px 40px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)", maxWidth: 420, width: "100%"
      }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
        <h2 style={{ color: "#1e3c72", fontSize: "1.3rem", fontWeight: 800, marginBottom: 8 }}>
          تعذّر تحميل نظام الدخول
        </h2>
        <p style={{ color: "#6b7280", fontSize: "0.95rem", marginBottom: 24, lineHeight: 1.7 }}>
          لم يتمكن النظام من الاتصال بخدمة المصادقة.<br />
          تحقق من اتصالك بالإنترنت ثم أعد المحاولة.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: "linear-gradient(135deg,#1e3c72,#2a5298)",
            color: "#fff", border: "none", borderRadius: 10,
            padding: "12px 32px", fontSize: "1rem", fontWeight: 700,
            cursor: "pointer", width: "100%"
          }}
        >
          🔄 إعادة المحاولة
        </button>
      </div>
    </div>
  );
}

// ErrorBoundary يلتقط أي خطأ رمي من Clerk
class ClerkErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return <ClerkFailPage />;
    return this.props.children;
  }
}

// حارس داخل ClerkProvider — يكشف لو isLoaded ما اكتمل خلال 10 ثوانٍ
function ClerkLoadingGuard({ children }: { children: React.ReactNode }) {
  const { isLoaded } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (isLoaded) return;
    const t = setTimeout(() => setTimedOut(true), 10000);
    return () => clearTimeout(t);
  }, [isLoaded]);

  if (timedOut && !isLoaded) return <ClerkFailPage />;
  return <>{children}</>;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        ...arSA,
        formFieldInputPlaceholder__emailAddress: "أدخل بريدك الإلكتروني",
        formFieldInputPlaceholder__password: "أدخل كلمة المرور",
        signIn: {
          ...arSA.signIn,
          start: {
            title: "مرحباً بك",
            subtitle: "سجل دخولك للوصول إلى حسابك",
            actionText: "ليس لديك حساب؟",
            actionLink: "إنشاء حساب",
          },
        },
        signUp: {
          ...arSA.signUp,
          start: {
            title: "إنشاء حساب جديد",
            subtitle: "أدخل بياناتك للتسجيل في برنامج المستخلصات",
            actionText: "لديك حساب بالفعل؟",
            actionLink: "تسجيل الدخول",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkLoadingGuard>
        <GlobalClerkBadgeHider />
        <ClerkTokenSyncer />
        <ClerkQueryClientCacheInvalidator />
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
          <Route path="/support" component={() => <ProtectedRoute component={Support} />} />
          <Route path="/extracts" component={() => <ProtectedRoute component={ExtractsList} />} />
          <Route path="/extracts/new" component={() => <ProtectedRoute component={NewExtract} />} />
          <Route path="/extracts/track" component={() => <ProtectedRoute component={ExtractsTrack} />} />
          <Route path="/extracts/:id" component={() => <ProtectedRoute component={ExtractDetail} />} />
          <Route path="/projects" component={() => <ProtectedRoute component={ProjectsList} />} />
          <Route path="/projects/new" component={() => <ProtectedRoute component={NewProject} />} />
          <Route path="/admin/users" component={() => <ProtectedRoute component={AdminUsers} adminOnly />} />
          <Route path="/admin/audit" component={() => <ProtectedRoute component={AuditLog} />} />
          <Route path="/admin/users-view" component={() => <ProtectedRoute component={UsersView} />} />
          <Route path="/admin/backup" component={() => <ProtectedRoute component={AdminBackup} adminOnly />} />
          <Route path="/admin/hospitals" component={() => <ProtectedRoute component={HospitalsAdmin} adminOnly />} />
          <Route path="/admin/extracts-stats" component={() => <ProtectedRoute component={ExtractsStats} />} />
          <Route path="/admin/notifications" component={() => <ProtectedRoute component={AdminNotifications} adminOnly />} />
          <Route path="/contract-supervisor" component={() => <ProtectedRoute component={ContractSupervisorPage} />} />
          <Route path="/viewer" component={() => <ProtectedRoute component={ViewerDashboard} />} />
          <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
          <Route path="/contacts" component={() => <ProtectedRoute component={ContactsRegistry} />} />
          <Route path="/original-viewer" component={() => (
            <Show when="signed-in" fallback={<Redirect to="/sign-in" />}>
              <AuthGuard>
                <OriginalViewer />
              </AuthGuard>
            </Show>
          )} />
          <Route component={NotFound} />
        </Switch>
        </ClerkLoadingGuard>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <TooltipProvider>
      <WouterRouter base={basePath}>
        <ClerkErrorBoundary>
          <ClerkProviderWithRoutes />
        </ClerkErrorBoundary>
      </WouterRouter>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
