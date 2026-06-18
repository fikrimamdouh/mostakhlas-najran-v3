import { useEffect, useState } from "react";
import { ClerkProvider, SignIn, SignUp } from "@clerk/react";
import { shadcn } from "@clerk/themes";
import { arSA } from "@clerk/localizations";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setBaseUrl } from "@workspace/api-client-react";

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
      <SignIn routing="hash" forceRedirectUrl="/dashboard" />
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
            <input type="text" value={form.jobTitle} onChange={e => { setForm(f => ({ ...f, jobTitle: e.target.value })); setErrors(er => ({ ...er, jobTitle: "" })); }} placeholder="مثال: مدير موقع / محاسب / مشرف" className={inputClass("jobTitle")} />
            {errors.jobTitle && <p className="text-red-500 text-xs mt-1">{errors.jobTitle}</p>}
          </div>
          <button type="submit" className="w-full text-white font-bold py-3 rounded-lg mt-6 shadow-lg transition hover:opacity-95" style={{ background: "linear-gradient(135deg,#1e3c72,#2a5298)" }}>
            متابعة التسجيل
          </button>
        </form>
      </div>
    </div>
  );
}

function SignUpPage() {
  useHideClerkBadge();
  const [ready, setReady] = useState(false);
  return ready ? (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center p-4" style={{ background: "linear-gradient(135deg,#1e3c72 0%,#2a5298 100%)" }}>
      <SignUp routing="hash" forceRedirectUrl="/dashboard" />
    </div>
  ) : <PreRegistrationForm onNext={() => setReady(true)} />;
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/sign-in" component={SignInPage} />
      <Route path="/sign-up" component={SignUpPage} />
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/support" component={Support} />
      <Route path="/extracts" component={ExtractsList} />
      <Route path="/extracts/new" component={NewExtract} />
      <Route path="/extracts/:id" component={ExtractDetail} />
      <Route path="/projects" component={ProjectsList} />
      <Route path="/projects/new" component={NewProject} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/admin/audit" component={AuditLog} />
      <Route path="/admin/users-view" component={UsersView} />
      <Route path="/admin/contract-supervisor" component={ContractSupervisorPage} />
      <Route path="/admin/backup" component={AdminBackup} />
      <Route path="/admin/stats" component={ExtractsStats} />
      <Route path="/admin/hospitals" component={HospitalsAdmin} />
      <Route path="/admin/notifications" component={AdminNotifications} />
      <Route path="/viewer/dashboard" component={ViewerDashboard} />
      <Route path="/settings" component={Settings} />
      <Route path="/original/:path*" component={OriginalViewer} />
      <Route path="/extracts/track" component={ExtractsTrack} />
      <Route path="/contacts" component={ContactsRegistry} />
      <Route><NotFound /></Route>
    </Switch>
  );
}

function App() {
  return (
    <ClerkProvider publishableKey={clerkPubKey} localization={arSA} appearance={clerkAppearance} proxyUrl={clerkProxyUrl}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={basePath}>
            <AppRoutes />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;
