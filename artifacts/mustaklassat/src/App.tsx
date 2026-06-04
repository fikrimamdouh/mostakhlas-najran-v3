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
    const BADGE_TEXTS = ["Development mode", "Secured by Clerk"];
    const hideIfBadge = (el: Element) => {
      const ownText = Array.from(el.childNodes)
        .filter(n => n.nodeType === Node.TEXT_NODE)
        .map(n => n.textContent ?? "")
        .join("")
        .trim();
      const fullText = (el.textContent ?? "").trim();
      if (fullText.length > 22) return;
      if (BADGE_TEXTS.some(t => fullText === t || ownText === t)) {
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
      { name: "مستشفى نجران العام الجديد ومركز طب الأسنان التخصصي", contract: "" },
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

// APP_ORIGINAL_RESTORED_BELOW
