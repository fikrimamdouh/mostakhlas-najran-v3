import { useEffect, useRef, useState } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MainLayout } from "@/components/layout/MainLayout";
import { useGetMe } from "@workspace/api-client-react";

import Home from "@/pages/home";
import Dashboard from "@/pages/dashboard";
import NotFound from "@/pages/not-found";

import ExtractsList from "@/pages/extracts/index";
import NewExtract from "@/pages/extracts/new";
import ExtractDetail from "@/pages/extracts/detail";

import ProjectsList from "@/pages/projects/index";
import NewProject from "@/pages/projects/new";

import AdminUsers from "@/pages/admin/users";
import Settings from "@/pages/settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.png`,
  },
  variables: {
    colorPrimary: "#2a5298",
    colorForeground: "#1e3c72",
    colorMutedForeground: "#5a6a8a",
    colorDanger: "hsl(0 84% 60%)",
    colorBackground: "hsl(0 0% 100%)",
    colorInput: "#dce6f5",
    colorInputForeground: "#1e3c72",
    colorNeutral: "#dce6f5",
    fontFamily: "'Tajawal', sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-lg border border-border",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-2xl font-bold text-foreground",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButtonText: "text-foreground font-medium",
    formFieldLabel: "text-foreground font-medium",
    footerActionLink: "text-primary hover:text-primary/90 font-medium",
    footerActionText: "text-muted-foreground",
    dividerText: "text-muted-foreground bg-white px-2",
    identityPreviewEditButton: "text-primary hover:text-primary/90",
    formFieldSuccessText: "text-green-600",
    alertText: "text-destructive",
    formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90 transition-colors",
    formFieldInput: "bg-background border-input text-foreground rounded-md",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-muted/30 px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-muted/30 px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

// Ensure user is synced with DB
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoaded: isClerkLoaded } = useUser();
  const [, setLocation] = useLocation();
  const { data: dbUser, isLoading: isDbLoading, isError } = useGetMe({
    query: { 
      queryKey: ["/api/users/me"],
      enabled: !!user?.id,
      retry: 1
    }
  });

  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (isClerkLoaded && user && isError && !isSyncing) {
      // Need to sync user to DB
      setIsSyncing(true);
      fetch('/api/users/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clerkId: user.id,
          email: user.primaryEmailAddress?.emailAddress,
          name: user.fullName || user.firstName || 'مستخدم',
        })
      }).then(res => {
        if (res.ok) {
          queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
        }
        setIsSyncing(false);
      }).catch(() => {
        setIsSyncing(false);
      });
    }
  }, [isClerkLoaded, user, isError, isSyncing]);

  if (!isClerkLoaded || isDbLoading || isSyncing) {
    return <div className="flex h-screen items-center justify-center">جاري التحميل...</div>;
  }

  if (dbUser?.status === "pending") {
    return <Redirect to="/pending" />;
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
        signIn: {
          start: {
            title: "مرحباً بك",
            subtitle: "سجل دخولك للوصول إلى حسابك",
          },
        },
        signUp: {
          start: {
            title: "إنشاء حساب جديد",
            subtitle: "ابدأ معنا اليوم",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
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
          <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
          <Route path="/pending" component={() => (
             <Show when="signed-in" fallback={<Redirect to="/sign-in" />}>
               <div className="flex min-h-[100dvh] flex-col items-center justify-center p-4 text-center">
                 <div className="bg-card border border-border p-8 rounded-xl shadow-sm max-w-md w-full">
                   <h2 className="text-2xl font-bold mb-2 text-primary">حسابك قيد المراجعة</h2>
                   <p className="text-muted-foreground mb-6">لقد تم تسجيل حسابك بنجاح. يرجى الانتظار حتى يقوم مدير النظام بالموافقة على حسابك.</p>
                 </div>
               </div>
             </Show>
          )} />
          <Route component={NotFound} />
        </Switch>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <TooltipProvider>
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;