import { useEffect, useRef, useState } from "react";
import { SignIn, SignUp, Show, useClerk, useUser, useAuth } from "@clerk/react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { MainLayout } from "@/components/layout/MainLayout";
import { useGetMe, setAuthTokenGetter } from "@workspace/api-client-react";
import Home from "@/pages/home";
import Dashboard from "@/pages/dashboard";
import NotFound from "@/pages/not-found";
import ExtractsList from "@/pages/extracts/index";
import NewExtract from "@/pages/extracts/new";
import ExtractDetail from "@/pages/extracts/detail";
import ProjectsList from "@/pages/projects/index";
import NewProject from "@/pages/projects/new";
import AdminUsers from "@/pages/admin/users";
import AuditLog from "@/pages/admin/audit";
import UsersView from "@/pages/admin/users-view";
import Settings from "@/pages/settings";
import { apiUrl } from "@/lib/api-base";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const PRIMARY_ADMIN_EMAIL = "rorofikri@gmail.com";

function SignInPage() {
  return <div className="flex min-h-[100dvh] items-center justify-center bg-muted/30 px-4"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div>;
}
function SignUpPage() {
  const [profile, setProfile] = useState({ fullName: "", phone: "", location: "", company: "", position: "" });

  const saveDraft = () => {
    localStorage.setItem("signup_profile_draft", JSON.stringify(profile));
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-muted/30 px-4 py-8">
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-bold text-lg mb-4">بيانات الشركة/المستخدم</h3>
          <div className="space-y-3">
            {[
              ["fullName", "الاسم الكامل"],
              ["phone", "الجوال"],
              ["location", "الموقع"],
              ["company", "الشركة"],
              ["position", "الوظيفة"],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="text-sm text-gray-600">{label}</label>
                <input
                  className="w-full border rounded-md px-3 py-2 mt-1"
                  value={(profile as any)[key]}
                  onChange={(e) => setProfile((p) => ({ ...p, [key]: e.target.value }))}
                  onBlur={saveDraft}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-center">
          <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
        </div>
      </div>
    </div>
  );
}

function ClerkTokenSyncer() {
  const { getToken } = useAuth();
  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    return () => setAuthTokenGetter(null);
  }, [getToken]);
  return null;
}


function ClerkUserSyncer() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();

  useEffect(() => {
    if (!isLoaded || !user) return;
    let cancelled = false;

    (async () => {
      try {
        const token = await getToken();
        const signedInEmail = String(user.primaryEmailAddress?.emailAddress || "").trim().toLowerCase();

        localStorage.setItem("najran_session", JSON.stringify({
          name: user.fullName || user.firstName || "مستخدم",
          role: signedInEmail === PRIMARY_ADMIN_EMAIL ? "admin" : "user",
          timestamp: Date.now(),
        }));
        if (!token || cancelled) return;
        await fetch(apiUrl("/api/users/sync"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            email: user.primaryEmailAddress?.emailAddress || "",
            company: user.unsafeMetadata?.company || JSON.parse(localStorage.getItem("signup_profile_draft") || "{}").company || null,
            hospital: user.unsafeMetadata?.hospital || JSON.parse(localStorage.getItem("signup_profile_draft") || "{}").location || null,
            position: user.unsafeMetadata?.position || JSON.parse(localStorage.getItem("signup_profile_draft") || "{}").position || null,
            phone: user.primaryPhoneNumber?.phoneNumber || JSON.parse(localStorage.getItem("signup_profile_draft") || "{}").phone || null,
            name: user.fullName || JSON.parse(localStorage.getItem("signup_profile_draft") || "{}").fullName || user.firstName || "مستخدم جديد",
          }),
        });

        await fetch(apiUrl("/api/users/me"), {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // no-op: sync is best-effort
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, user, getToken]);

  return null;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => addListener(({ user }) => {
    const userId = user?.id ?? null;
    if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) qc.clear();
    prevUserIdRef.current = userId;
  }), [addListener, qc]);
  return null;
}

function AuthGuard({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user } = useUser();
  const { isLoaded, isSignedIn } = useAuth();
  const { data: me, isLoading } = useGetMe({ query: { enabled: !!isLoaded && !!isSignedIn, queryKey: ["/api/users/me"] } });
  const [waited, setWaited] = useState(false);
  useEffect(() => { const t = setTimeout(() => setWaited(true), 2000); return () => clearTimeout(t); }, []);
  if (!isLoaded) return <div className="p-6">جاري تحميل الجلسة...</div>;
  if (isSignedIn && (isLoading || !me) && !waited) return <div className="p-6">جاري تحميل البيانات...</div>;
  const signedInEmail = String(user?.primaryEmailAddress?.emailAddress || "").trim().toLowerCase();
  const isPrimaryAdminEmail = signedInEmail === PRIMARY_ADMIN_EMAIL;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  if (!me && !isPrimaryAdminEmail) return <div className="p-6">جاري تهيئة الحساب...</div>;
  if (!isPrimaryAdminEmail && me && me.status !== "approved" && me.role !== "admin") return <Redirect to="/pending" />;
  if (adminOnly && !isPrimaryAdminEmail && (!me || me.role !== "admin")) return <Redirect to="/dashboard" />;
  return <>{children}</>;
}

function ProtectedRoute({ component: Component, adminOnly = false }: { component: any; adminOnly?: boolean }) {
  return <AuthGuard adminOnly={adminOnly}><MainLayout><Component /></MainLayout></AuthGuard>;
}

function HomePage() {
  return <Home />;
}


function PendingReviewPage() {
  const { signOut } = useClerk();
  const { user } = useUser();
  return (
    <Show when="signed-in">
      <div className="min-h-[100dvh] bg-[#f7f9fc]" style={{ direction: "rtl" }}>
        <header className="border-b bg-white/95 backdrop-blur shadow-sm">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-[#1e3c72] text-white flex items-center justify-center font-black">ن</div>
              <div>
                <div className="text-sm text-gray-500">تجمع نجران الصحي</div>
                <div className="text-lg font-bold text-[#1e3c72]">نظام إدارة المستخلصات</div>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              <span className="text-sm text-gray-600">{user?.fullName || "مستخدم"}</span>
              <span className="text-xs font-bold text-amber-700">قيد المراجعة</span>
            </div>
            <Button variant="outline" onClick={() => signOut({ redirectUrl: `${basePath}/` })}>تسجيل الخروج</Button>
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-4 py-14">
          <div className="bg-white border rounded-2xl p-8 shadow-sm text-center">
            <h2 className="text-3xl font-bold text-[#1e3c72] mb-3">حسابك قيد المراجعة</h2>
            <p className="text-gray-600 leading-8">تم تسجيل حسابك بنجاح. سيقوم مدير النظام بمراجعة الطلب واعتماده قريبًا، وبعد الموافقة ستتمكن من الدخول الكامل للنظام.</p>
          </div>
        </main>
      </div>
    </Show>
  );
}

function AppRoutes() {
  return (
    <QueryClientProvider client={queryClient}>
      <ClerkTokenSyncer />
      <ClerkUserSyncer />
      <ClerkQueryClientCacheInvalidator />
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/forgot-password/*?" component={SignInPage} />
        <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
        <Route path="/extracts" component={() => <ProtectedRoute component={ExtractsList} />} />
        <Route path="/extracts/new" component={() => <ProtectedRoute component={NewExtract} />} />
        <Route path="/extracts/:id" component={() => <ProtectedRoute component={ExtractDetail} />} />
        <Route path="/projects" component={() => <ProtectedRoute component={ProjectsList} />} />
        <Route path="/projects/new" component={() => <ProtectedRoute component={NewProject} />} />
        <Route path="/admin/users" component={() => <ProtectedRoute component={AdminUsers} adminOnly />} />
        <Route path="/admin/audit" component={() => <ProtectedRoute component={AuditLog} />} />
        <Route path="/admin/users-view" component={() => <ProtectedRoute component={UsersView} />} />
        <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
        <Route path="/pending" component={PendingReviewPage} />
        <Route component={NotFound} />
      </Switch>
    </QueryClientProvider>
  );
}

export default function App() {
  return <TooltipProvider><WouterRouter base={basePath || undefined}><Toaster /><AppRoutes /></WouterRouter></TooltipProvider>;
}
