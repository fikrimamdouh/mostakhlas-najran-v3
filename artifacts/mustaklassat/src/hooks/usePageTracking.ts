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
  const enteredAt = useRef<number>(Date.now());
  const currentLabel = useRef<string>("");

  useEffect(() => {
    if (!isSignedIn) return;

    let label = PAGE_LABELS[location];
    if (!label && location.startsWith("/extracts/track")) label = "متابعة المستخلصات";
    if (!label && location.startsWith("/extracts/")) label = "تفاصيل المستخلص";
    if (!label) return;

    if (lastSent.current === label) return;

    const previousLabel = currentLabel.current;
    const previousDuration = Math.max(1, Math.round((Date.now() - enteredAt.current) / 1000));
    enteredAt.current = Date.now();
    currentLabel.current = label;
    lastSent.current = label;

    getToken().then(token => {
      if (!token) return;

      fetch("/api/users/me/activity", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ page: label }),
      }).catch(() => {});

      if (previousLabel) {
        fetch("/api/audit", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            action: "خروج صفحة",
            details: `غادر صفحة ${previousLabel} بعد ${previousDuration} ثانية`,
            entityType: "navigation",
            entityId: previousLabel,
            page: previousLabel,
          }),
        }).catch(() => {});
      }

      fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: "دخول صفحة",
          details: `فتح صفحة ${label}`,
          entityType: "navigation",
          entityId: label,
          page: location,
        }),
      }).catch(() => {});
    });
  }, [location, isSignedIn, getToken]);

  useEffect(() => {
    if (!isSignedIn) return;
    return () => {
      const label = currentLabel.current;
      if (!label) return;
      const duration = Math.max(1, Math.round((Date.now() - enteredAt.current) / 1000));
      getToken().then(token => {
        if (!token) return;
        fetch("/api/audit", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            action: "خروج صفحة",
            details: `غادر صفحة ${label} بعد ${duration} ثانية`,
            entityType: "navigation",
            entityId: label,
            page: label,
          }),
        }).catch(() => {});
      });
    };
  }, [isSignedIn, getToken]);
}
