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

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function SignInPage() {
  return <div className="flex min-h-[100dvh] items-center justify-center bg-muted/30 px-4"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div>;
}
function SignUpPage() {
  return <div className="flex min-h-[100dvh] items-center justify-center bg-muted/30 px-4"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div>;
}

function ClerkTokenSyncer() {
  const { getToken } = useAuth();
  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    return () => setAuthTokenGetter(null);
  }, [getToken]);
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
  const { data: me, isLoading } = useGetMe({ query: { enabled: !!user } });
  const [waited, setWaited] = useState(false);
  useEffect(() => { const t = setTimeout(() => setWaited(true), 2000); return () => clearTimeout(t); }, []);
  if (isLoading && !waited) return <div className="p-6">جاري التحميل...</div>;
  if (!me) return <Redirect to="/sign-in" />;
  if (me.status !== "approved" && me.role !== "admin") return <Redirect to="/pending" />;
  if (adminOnly && me.role !== "admin") return <Redirect to="/dashboard" />;
  return <>{children}</>;
}

function ProtectedRoute({ component: Component, adminOnly = false }: { component: any; adminOnly?: boolean }) {
  return <Show when="signed-in"><AuthGuard adminOnly={adminOnly}><MainLayout><Component /></MainLayout></AuthGuard></Show>;
}

function HomeRedirect() {
  return <><Show when="signed-in"><Redirect to="/dashboard" /></Show><Show when="signed-out"><Home /></Show></>;
}


function PendingReviewPage() {
  const { signOut } = useClerk();
  return (
    <Show when="signed-in">
      <div className="flex min-h-[100dvh] flex-col items-center justify-center p-4 text-center">
        <div className="bg-card border border-border p-8 rounded-xl shadow-sm max-w-md w-full">
          <h2 className="text-2xl font-bold mb-2 text-primary">حسابك قيد المراجعة</h2>
          <p className="text-muted-foreground mb-6">لقد تم تسجيل حسابك بنجاح. يرجى الانتظار حتى يقوم مدير النظام بالموافقة على حسابك.</p>
          <Button variant="outline" className="w-full" onClick={() => signOut({ redirectUrl: `${basePath}/sign-in` })}>
            تسجيل الخروج
          </Button>
        </div>
      </div>
    </Show>
  );
}

function AppRoutes() {
  return (
    <QueryClientProvider client={queryClient}>
      <ClerkTokenSyncer />
      <ClerkQueryClientCacheInvalidator />
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
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
