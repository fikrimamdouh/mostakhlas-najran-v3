import { Component, useEffect, useRef, useState } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useUser, useAuth } from "@clerk/react";
import { shadcn } from "@clerk/themes";
import { arSA } from "@clerk/localizations";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MainLayout } from "@/components/layout/MainLayout";
import { useGetMe, setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";

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

const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
if (apiUrl) setBaseUrl(apiUrl);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const PRE_REG_KEY = "najran_prereg";

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path;
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

const COMPANY_SITES = {
  "تجمع_نجران": {
    label: "تجمع نجران الصحي — وحدة الصيانة العامة",
    sites: [{ name: "المقر الرئيسي — تجمع نجران الصحي", contract: "" }],
  },
  "بيت_العرب": {
    label: "شركة مجموعة بيت العرب الحديثة المحدودة",
    sites: [
      { name: "مستشفى يدمه العام", contract: "250811180425" },
      { name: "مستشفى حبونا العام", contract: "250811180425" },
      { name: "مستشفى بدر الجنوب العام", contract: "250811180425" },
      { name: "مستشفى الولادة والأطفال", contract: "250701156483" },
      { name: "مستشفى نجران العام القديم وسكن الممرضات الخارجي", contract: "250701156483" },
    { name: "المكاتب الإدارية والمرافق الصحية وصيانة وإصلاح السيارات والعيادات المتنقلة", contract: "250701156483" },
    ],
  },
  "سراكو": {
    label: "شركة سراكو",
    sites: [
      { name: "مستشفى نجران العام الجديد ومركز طب الأسنان التخصصي", contract: "" },
      { name: "مجمع الأمل للصحة النفسية", contract: "" },
      { name: "مستشفى ثار العام", contract: "" },
      { name: "مستشفى خباش العام", contract: "" },
      { name: "المراكز الصحية", contract: "" },
      { name: "مستشفى الملك خالد", contract: "" },
      { name: "مركز الأمير سلطان", contract: "" },
      { name: "مستشفى شروره العام", contract: "" },
    ],
  },
} as const;

type CompanyKey = keyof typeof COMPANY_SITES;
type SiteEntry = { readonly name: string; readonly contract: string };

const selectStyle = (hasError: boolean): React.CSSProperties => ({
  width: "100%",
  borderRadius: "8px",
  border: `1px solid ${hasError ? "#f87171" : "#d1d5db"}`,
  background: "#fff",
  padding: "10px 16px",
  fontSize: "14px",
  outline: "none",
  appearance: "auto" as const,
  direction: "rtl",
});

function useHideClerkBadge() {
  useEffect(() => {
    const badTexts = ["Development mode", "Secured by Clerk"];
    const sweep = () => {
      document.querySelectorAll("[class*='cl-internal']").forEach(el => {
        const text = (el.textContent || "").trim();
        if (text.length <= 22 && badTexts.some(t => text === t)) {
          (el as HTMLElement).style.setProperty("display", "none", "important");
        }
      });
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
        <img src="/logo.png" alt="شعار تجمع نجران الصحي" className="h-16 w-auto drop-shadow-lg mb-3" onError={e => ((e.target as HTMLImageElement).style.display = "none")} />
        <span className="text-white font-bold text-xl">تجمع نجران الصحي</span>
        <span className="text-sm" style={{ color: "#d4af37" }}>وحدة الصيانة العامة</span>
      </div>
      <SignIn routing="path" path={`${basePath}/sign-in`} />
    </div>
  );
}

function PreRegistrationForm({ onNext }: { onNext: () => void }) {
  const [form, setForm] = useState({ fullName: "", phone: "", company: "" as CompanyKey | "", hospital: "", jobTitle: "", contractNumber: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});
  const companySites: readonly SiteEntry[] = form.company ? COMPANY_SITES[form.company].sites : [];

  const handleCompanyChange = (val: string) => {
    setForm(f => ({ ...f, company: val as CompanyKey | "", hospital: "", contractNumber: "" }));
    setErrors(er => ({ ...er, company: "", hospital: "" }));
  };

  const handleSiteChange = (siteName: string) => {
    const site = companySites.find(s => s.name === siteName);
    setForm(f => ({ ...f, hospital: siteName, contractNumber: site?.contract || "" }));
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
    try { localStorage.setItem(PRE_REG_KEY, JSON.stringify(form)); } catch {}
    onNext();
  };

  const inputClass = (key: keyof typeof form) => `w-full rounded-lg border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors[key] ? "border-red-400 bg-red-50" : ""}`;

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center p-4" style={{ background: "linear-gradient(135deg,#1e3c72 0%,#2a5298 100%)", direction: "rtl" }}>
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg">
        <div className="text-center mb-6">
          <img src="/logo.png" alt="" className="h-14 w-auto mx-auto mb-3 drop-shadow" onError={e => ((e.target as HTMLImageElement).style.display = "none")} />
          <h2 className="text-2xl font-extrabold" style={{ color: "#1e3c72" }}>إنشاء حساب جديد</h2>
          <p className="text-gray-500 text-sm mt-1">يرجى إدخال بياناتك الكاملة أولاً قبل التسجيل</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: "#1e3c72" }}>الاسم الكامل <span className="text-red-500">*</span></label>
            <input type="text" value={form.fullName} onChange={e => { setForm(f => ({ ...f, fullName: e.target.value })); setErrors(er => ({ ...er, fullName: "" })); }} placeholder="محمد بن عبدالله الشهري" className={inputClass("fullName")} />
            {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: "#1e3c72" }}>رقم الهاتف <span className="text-red-500">*</span></label>
            <input type="tel" value={form.phone} onChange={e => { setForm(f => ({ ...f, phone: e.target.value })); setErrors(er => ({ ...er, phone: "" })); }} placeholder="05XXXXXXXX" className={inputClass("phone")} />
            {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: "#1e3c72" }}>الشركة المقاولة <span className="text-red-500">*</span></label>
            <select value={form.company} onChange={e => handleCompanyChange(e.target.value)} style={selectStyle(!!errors.company)}>
              <option value="">— اختر الشركة —</option>
              {(Object.keys(COMPANY_SITES) as CompanyKey[]).map(key => <option key={key} value={key}>{COMPANY_SITES[key].label}</option>)}
            </select>
            {errors.company && <p className="text-red-500 text-xs mt-1">{errors.company}</p>}
          </div>
          {form.company && (
            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: "#1e3c72" }}>الموقع / المستشفى <span className="text-red-500">*</span></label>
              <select value={form.hospital} onChange={e => handleSiteChange(e.target.value)} style={selectStyle(!!errors.hospital)}>
                <option value="">— اختر الموقع —</option>
                {companySites.map(site => <option key={site.name} value={site.name}>{site.name}</option>)}
              </select>
              {errors.hospital && <p className="text-red-500 text-xs mt-1">{errors.hospital}</p>}
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: "#1e3c72" }}>المسمى الوظيفي <span className="text-red-500">*</span></label>
            <input type="text" value={form.jobTitle} onChange={e => { setForm(f => ({ ...f, jobTitle: e.target.value })); setErrors(er => ({ ...er, jobTitle: "" })); }} placeholder="مهندس صيانة / محاسب / مشرف..." className={inputClass("jobTitle")} />
            {errors.jobTitle && <p className="text-red-500 text-xs mt-1">{errors.jobTitle}</p>}
          </div>
          <button type="submit" className="w-full h-12 rounded-xl font-bold text-base text-white mt-2 transition-opacity hover:opacity-90" style={{ background: "linear-gradient(135deg,#d4af37,#b8962e)", color: "#1e3c72" }}>التالي — إنشاء الحساب ←</button>
          <p className="text-center text-xs text-gray-400 mt-2">لديك حساب بالفعل؟ <a href="/sign-in" className="font-semibold" style={{ color: "#1e3c72" }}>تسجيل الدخول</a></p>
        </form>
      </div>
    </div>
  );
}

function SignUpPage() {
  const [step, setStep] = useState<"pre-reg" | "clerk">(() => (sessionStorage.getItem(PRE_REG_KEY) || localStorage.getItem(PRE_REG_KEY)) ? "clerk" : "pre-reg");
  if (step === "pre-reg") return <PreRegistrationForm onNext={() => setStep("clerk")} />;
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center p-4" style={{ background: "linear-gradient(135deg,#1e3c72 0%,#2a5298 100%)" }}>
      <div className="mb-4 flex flex-col items-center">
        <img src="/logo.png" alt="شعار تجمع نجران الصحي" className="h-14 w-auto drop-shadow-lg mb-2" onError={e => ((e.target as HTMLImageElement).style.display = "none")} />
        <span className="text-white font-bold text-xl">تجمع نجران الصحي</span>
        <span className="text-sm" style={{ color: "#d4af37" }}>وحدة الصيانة العامة</span>
      </div>
      <SignUp routing="path" path={`${basePath}/sign-up`} />
      <button onClick={() => { sessionStorage.removeItem(PRE_REG_KEY); localStorage.removeItem(PRE_REG_KEY); setStep("pre-reg"); }} className="mt-3 text-white/60 text-xs hover:text-white/90 underline">← العودة وتعديل البيانات</button>
    </div>
  );
}

function ClerkTokenSyncer() {
  const { getToken } = useAuth();
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
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) queryClient.clear();
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);
  return null;
}

function RejectedPage() {
  const { signOut } = useClerk();
  return <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center" style={{ background: "linear-gradient(135deg,#1e3c72 0%,#2a5298 100%)" }}><div className="bg-white rounded-2xl p-10 shadow-xl max-w-md w-full"><h2 className="text-2xl font-bold mb-3 text-red-600">تم رفض حسابك</h2><p className="text-gray-600 mb-6">للاستفسار، تواصل مع مدير النظام.</p><button onClick={() => signOut()} className="w-full py-3 rounded-xl font-bold border-2 border-red-200 text-red-600 hover:bg-red-50">تسجيل الخروج</button></div></div>;
}

function PendingPage() {
  const { signOut } = useClerk();
  return <div className="flex min-h-[100dvh] flex-col items-center justify-center p-4 text-center" style={{ background: "linear-gradient(135deg,#1e3c72 0%,#2a5298 100%)", direction: "rtl" }}><div className="bg-white rounded-2xl p-10 shadow-2xl max-w-md w-full"><img src="/logo.png" alt="" className="h-14 w-auto mx-auto mb-4 drop-shadow" onError={e => ((e.target as HTMLImageElement).style.display = "none")} /><div className="text-5xl mb-4">⏳</div><h2 className="text-2xl font-bold mb-3" style={{ color: "#1e3c72" }}>حسابك قيد المراجعة</h2><p className="text-gray-600 mb-2">تم تسجيل طلبك بنجاح وإبلاغ مدير النظام.</p><p className="text-gray-500 text-sm mb-8">سيصلك إشعار على بريدك الإلكتروني عند الموافقة على حسابك.</p><button onClick={() => signOut()} className="w-full py-3 rounded-xl font-bold text-sm border-2 hover:bg-gray-50 transition-colors" style={{ borderColor: "#1e3c72", color: "#1e3c72" }}>تسجيل الخروج</button></div></div>;
}

function HospitalPickerScreen({ hospitals, currentHospital, onPick }: { hospitals: string[]; currentHospital: string | null; onPick: (h: string) => Promise<void> }) {
  const [loading, setLoading] = useState(false);
  return <div style={{ display: "flex", minHeight: "100dvh", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16, background: "linear-gradient(135deg,#1e3c72 0%,#2a5298 100%)", direction: "rtl" }}><div style={{ background: "#fff", borderRadius: 20, padding: "36px 28px", maxWidth: 480, width: "100%", boxShadow: "0 20px 60px rgba(30,60,114,0.2)" }}><h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#1e3c72", marginBottom: 4 }}>اختر الموقع</h2><p style={{ color: "#6b7280", fontSize: "0.88rem", marginBottom: 20 }}>اختر الموقع الذي ستعمل عليه في هذه الجلسة</p><div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{hospitals.map(h => <button key={h} disabled={loading} onClick={async () => { setLoading(true); await onPick(h); setLoading(false); }} style={{ padding: "14px 18px", borderRadius: 12, border: h === currentHospital ? "2.5px solid #1e3c72" : "1.5px solid #e2e8f0", background: h === currentHospital ? "#f0f4ff" : "#fafafa", textAlign: "right", cursor: loading ? "not-allowed" : "pointer", fontWeight: 700, fontSize: "0.93rem", color: "#1e293b", display: "flex", alignItems: "center", gap: 10, width: "100%" }}><span style={{ flex: 1 }}>{h}</span>{h === currentHospital && <span style={{ fontSize: "0.75rem", color: "#1e3c72", background: "#e0e7ff", borderRadius: 6, padding: "2px 8px" }}>الحالي</span>}</button>)}</div>{loading && <p style={{ textAlign: "center", color: "#6b7280", fontSize: "0.82rem", marginTop: 14 }}>جاري الحفظ...</p>}</div></div>;
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoaded: isClerkLoaded } = useUser();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [hasToken, setHasToken] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

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

  const { data: dbUser, isLoading: isDbLoading, error } = useGetMe({ query: { queryKey: ["/api/users/me"], enabled: !!user?.id && isClerkLoaded && hasToken, retry: 3, retryDelay: attempt => Math.min(1000 * 2 ** attempt, 10000) } });
  const isNotFound = (error as any)?.status === 404;
  const parsedHospitals: string[] = (() => { try { return JSON.parse((dbUser as any)?.hospitals || "[]"); } catch { return []; } })();
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
    await fetch("/api/users/me/hospital", { method: "PATCH", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ hospital: hosp }) });
    if (dbUser?.id) sessionStorage.setItem(`h_s_${dbUser.id}`, hosp);
    await queryClient.refetchQueries({ queryKey: ["/api/users/me"] });
    setShowPicker(false);
  };

  useEffect(() => {
    if (!isClerkLoaded || !user || syncState !== "idle") return;
    const preReg = (() => { try { return JSON.parse(sessionStorage.getItem(PRE_REG_KEY) || localStorage.getItem(PRE_REG_KEY) || "null"); } catch { return null; } })();
    const isIncompleteProfile = !isNotFound && dbUser && !dbUser.hospital && !(dbUser as any).phone && preReg?.hospital;
    if (!isNotFound && !isIncompleteProfile) return;
    setSyncState("syncing");
    getToken().then(async token => {
      try {
        const res = await fetch("/api/users/sync", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ email: user?.primaryEmailAddress?.emailAddress, name: preReg?.fullName || user?.fullName || user?.firstName || "مستخدم", phone: preReg?.phone || "", company: preReg?.company || "", hospital: preReg?.hospital || "", jobTitle: preReg?.jobTitle || "", contractNumber: preReg?.contractNumber || "" }) });
        if (res.ok) { sessionStorage.removeItem(PRE_REG_KEY); localStorage.removeItem(PRE_REG_KEY); queryClient.invalidateQueries({ queryKey: ["/api/users/me"] }); setSyncState("done"); }
        else setSyncState("error");
      } catch { setSyncState("error"); }
    });
  }, [isClerkLoaded, user, isNotFound, dbUser, syncState, getToken, queryClient]);

  useEffect(() => {
    if (!dbUser || dbUser.status !== "approved") return;
    const saveSession = (token: string | null) => {
      if (!token) return;
     let existingHospital: string | null = null;
let existingStoredHospital: string | null = null;
let existingStoredCompanyName: string | null = null;

try {
  const raw = Storage.prototype.getItem.call(localStorage, "najran_session");
  if (raw) {
    const oldSession = JSON.parse(raw);
    if (oldSession?.userId === dbUser.id) {
      existingHospital = oldSession.hospital || null;
    }
  }
} catch {}

try {
  existingStoredHospital =
    Storage.prototype.getItem.call(localStorage, "hospitalName") ||
    localStorage.getItem("hospitalName") ||
    null;

  existingStoredCompanyName =
    Storage.prototype.getItem.call(localStorage, "companyName") ||
    localStorage.getItem("companyName") ||
    null;
} catch {}

const companyLabelMap: Record<string, string> = {
  "بيت_العرب": "شركة مجموعة بيت العرب الحديثة المحدودة",
  "سراكو": "شركة سراكو",
  "تجمع_نجران": "تجمع نجران الصحي — وحدة الصيانة العامة"
};

let parsedSessionHospitals: string[] = [];
try {
  parsedSessionHospitals = JSON.parse((dbUser as any).hospitals || "[]");
} catch {
  parsedSessionHospitals = [];
}

const roleText = String(dbUser.role || "").toLowerCase();
const isAdminLike =
  roleText === "admin" ||
  roleText === "supervisor" ||
  roleText.includes("admin") ||
  roleText.includes("supervisor") ||
  roleText.includes("مدير") ||
  roleText.includes("مشرف");

const fallbackHospital =
  parsedSessionHospitals[0] ||
  existingStoredHospital ||
  (isAdminLike ? "المقر الرئيسي — تجمع نجران الصحي" : null);

const activeHospital =
  existingHospital ||
  dbUser.hospital ||
  fallbackHospital;

let companyCode =
  (dbUser as any).company ||
  null;

if (!companyCode && existingStoredCompanyName) {
  if (existingStoredCompanyName === "تجمع نجران الصحي — وحدة الصيانة العامة") companyCode = "تجمع_نجران";
  else if (existingStoredCompanyName === "شركة سراكو") companyCode = "سراكو";
  else if (existingStoredCompanyName === "شركة مجموعة بيت العرب الحديثة المحدودة") companyCode = "بيت_العرب";
}

if (!companyCode && activeHospital === "المقر الرئيسي — تجمع نجران الصحي") {
  companyCode = "تجمع_نجران";
}

const companyName = companyCode ? companyLabelMap[companyCode] || companyCode : null;

      localStorage.setItem("najran_session", JSON.stringify({ userId: dbUser.id, name: dbUser.name, email: dbUser.email, role: dbUser.role, hospital: activeHospital, hospitals: (dbUser as any).hospitals || null, company: companyCode, companyName, phone: (dbUser as any).phone || null, jobTitle: (dbUser as any).jobTitle || null, contractNumber: (dbUser as any).contractNumber || null, allowedModules: (dbUser as any).allowedModules || null, clerkToken: token, timestamp: Date.now() }));
      if (activeHospital) localStorage.setItem("hospitalName", activeHospital);
      if (companyName) localStorage.setItem("companyName", companyName);
      if ((dbUser as any).contractNumber) localStorage.setItem("contractNumber", (dbUser as any).contractNumber);
    };
    getToken().then(token => { saveSession(token); if (token) fetch("/api/users/me/login", { method: "PATCH", headers: { Authorization: `Bearer ${token}` } }).catch(() => {}); });
    (window as any).najranGetFreshToken = async () => { const token = await getToken(); saveSession(token); return token; };
    const interval = setInterval(() => { getToken().then(saveSession); }, 50_000);
    return () => { clearInterval(interval); try { delete (window as any).najranGetFreshToken; } catch {} };
  }, [dbUser, getToken]);

  if (!isClerkLoaded || (!!user?.id && !hasToken) || isDbLoading || syncState === "syncing") return <div className="flex h-screen items-center justify-center flex-col gap-3" style={{ background: "linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)" }}><img src="/logo.png" alt="" className="h-16 w-auto opacity-80" onError={e => ((e.target as HTMLImageElement).style.display = "none")} /><p className="text-white text-lg font-medium">جاري التحميل...</p></div>;
  if (dbUser?.status === "pending") return <PendingPage />;
  if (dbUser?.status === "rejected") return <RejectedPage />;
  if (showPicker && effectiveHospitals.length > 1) return <HospitalPickerScreen hospitals={effectiveHospitals} currentHospital={dbUser?.hospital ?? null} onPick={handleHospitalPick} />;
  return <>{children}</>;
}

function ProtectedRoute({ component: ComponentToRender }: { component: any; adminOnly?: boolean }) {
  return <Show when="signed-in" fallback={<Redirect to="/sign-in" />}><AuthGuard><MainLayout><ComponentToRender /></MainLayout></AuthGuard></Show>;
}

function HomeRedirect() {
  return <><Show when="signed-in"><Redirect to="/dashboard" /></Show><Show when="signed-out"><Home /></Show></>;
}

function GlobalClerkBadgeHider() { useHideClerkBadge(); return null; }

function ClerkFailPage() {
  return <div dir="rtl" style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "20px", background: "linear-gradient(135deg,#1e3c72 0%,#2a5298 100%)", fontFamily: "inherit", padding: "24px", textAlign: "center" }}><div style={{ background: "#fff", borderRadius: 16, padding: "32px 40px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", maxWidth: 420, width: "100%" }}><div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div><h2 style={{ color: "#1e3c72", fontSize: "1.3rem", fontWeight: 800, marginBottom: 8 }}>تعذّر تحميل نظام الدخول</h2><p style={{ color: "#6b7280", fontSize: "0.95rem", marginBottom: 24, lineHeight: 1.7 }}>لم يتمكن النظام من الاتصال بخدمة المصادقة.<br />تحقق من اتصالك بالإنترنت ثم أعد المحاولة.</p><button onClick={() => window.location.reload()} style={{ background: "linear-gradient(135deg,#1e3c72,#2a5298)", color: "#fff", border: "none", borderRadius: 10, padding: "12px 32px", fontSize: "1rem", fontWeight: 700, cursor: "pointer", width: "100%" }}>إعادة المحاولة</button></div></div>;
}

class ClerkErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() { return this.state.hasError ? <ClerkFailPage /> : this.props.children; }
}

function ClerkLoadingGuard({ children }: { children: React.ReactNode }) {
  const { isLoaded } = useAuth();
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => { if (isLoaded) return; const t = setTimeout(() => setTimedOut(true), 10000); return () => clearTimeout(t); }, [isLoaded]);
  if (timedOut && !isLoaded) return <ClerkFailPage />;
  return <>{children}</>;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} localization={arSA} routerPush={to => setLocation(stripBase(to))} routerReplace={to => setLocation(stripBase(to), { replace: true })}>
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
            <Route path="/admin/users" component={() => <ProtectedRoute component={AdminUsers} />} />
            <Route path="/admin/audit" component={() => <ProtectedRoute component={AuditLog} />} />
            <Route path="/admin/users-view" component={() => <ProtectedRoute component={UsersView} />} />
            <Route path="/admin/backup" component={() => <ProtectedRoute component={AdminBackup} />} />
            <Route path="/admin/hospitals" component={() => <ProtectedRoute component={HospitalsAdmin} />} />
            <Route path="/admin/extracts-stats" component={() => <ProtectedRoute component={ExtractsStats} />} />
            <Route path="/admin/notifications" component={() => <ProtectedRoute component={AdminNotifications} />} />
            <Route path="/contract-supervisor" component={() => <ProtectedRoute component={ContractSupervisorPage} />} />
            <Route path="/viewer" component={() => <ProtectedRoute component={ViewerDashboard} />} />
            <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
            <Route path="/contacts" component={() => <ProtectedRoute component={ContactsRegistry} />} />
            <Route path="/original-viewer" component={() => <Show when="signed-in" fallback={<Redirect to="/sign-in" />}><AuthGuard><OriginalViewer /></AuthGuard></Show>} />
            <Route component={NotFound} />
          </Switch>
        </ClerkLoadingGuard>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return <TooltipProvider><WouterRouter base={basePath}><ClerkErrorBoundary><ClerkProviderWithRoutes /></ClerkErrorBoundary></WouterRouter><Toaster /></TooltipProvider>;
}

export default App;
