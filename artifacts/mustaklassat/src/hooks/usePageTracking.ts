import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@clerk/react";

const PAGE_LABELS: Record<string, string> = {
  "/dashboard": "لوحة التحكم",
  "/extracts": "قائمة المستخلصات",
  "/extracts/new": "إنشاء مستخلص جديد",
  "/projects": "المشاريع",
  "/projects/new": "مشروع جديد",
  "/admin/users": "إدارة المستخدمين",
  "/admin/audit": "سجل المراقبة",
  "/admin/users-view": "قائمة المستخدمين",
  "/settings": "الإعدادات",
  "/support": "مذكرة دعم",
};

export function usePageTracking() {
  const [location] = useLocation();
  const { getToken, isSignedIn } = useAuth();
  const lastSent = useRef<string>("");

  useEffect(() => {
    if (!isSignedIn) return;

    // Match dynamic routes like /extracts/:id
    let label = PAGE_LABELS[location];
    if (!label && location.startsWith("/extracts/")) label = "تفاصيل المستخلص";
    if (!label) return;

    // Debounce: don't send same page twice in a row
    if (lastSent.current === label) return;
    lastSent.current = label;

    getToken().then(token => {
      if (!token) return;
      fetch("/api/users/me/activity", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ page: label }),
      }).catch(() => {});
    });
  }, [location, isSignedIn, getToken]);
}
