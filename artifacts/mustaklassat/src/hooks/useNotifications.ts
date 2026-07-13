import { useEffect, useRef, useState } from "react";

const READ_NOTIFS_KEY = "najran_read_notifications";

type ServerNotification = {
  id: number;
  type: string;
  title: string;
  body: string;
  href: string | null;
  isRead: boolean;
  createdAt: string;
};

export function useNotifications(isAdmin: boolean, pendingUsersCount: number, getToken: () => Promise<string | null>) {
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(READ_NOTIFS_KEY) || "[]")); } catch { return new Set(); }
  });
  const [serverNotifs, setServerNotifs] = useState<ServerNotification[]>([]);
  const lastFetchRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    async function load(force?: boolean) {
      const now = Date.now();
      if (!force && now - lastFetchRef.current < 10 * 60_000) return;
      lastFetchRef.current = now;
      try {
        const token = await getToken();
        const res = await fetch("/api/notifications", { headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.notifications)) setServerNotifs(data.notifications);
      } catch { /* notification polling must not break navigation */ }
    }
    load(true);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    const timer = setInterval(() => load(), 10 * 60_000);
    return () => { cancelled = true; window.removeEventListener("focus", onFocus); clearInterval(timer); };
  }, [getToken]);

  const localNotifs = isAdmin && pendingUsersCount > 0
    ? [{ id: "pending_users", type: "warning" as const, title: "مستخدمون بانتظار الموافقة", body: `يوجد ${pendingUsersCount} مستخدم بانتظار موافقتك`, href: "/admin/users", time: "" }]
    : [];

  const notifications = [
    ...serverNotifs.map(notification => ({
      id: `srv_${notification.id}`,
      type: (notification.type === "extract_approved" ? "success" : notification.type === "extract_rejected" || notification.type === "warning" ? "warning" : "info") as any,
      title: notification.title,
      body: notification.body,
      href: notification.href || "",
      time: notification.createdAt ? new Date(notification.createdAt).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" }) : "",
      _srvId: notification.id,
      _srvRead: notification.isRead,
    })),
    ...localNotifs,
  ];

  const unread = notifications.filter(notification => (notification as any)._srvId ? !(notification as any)._srvRead : !readIds.has(notification.id));

  function markLocal(id: string) {
    setReadIds(previous => {
      const next = new Set(previous);
      next.add(id);
      try { localStorage.setItem(READ_NOTIFS_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  async function patchRead(path: string) {
    try {
      const token = await getToken();
      await fetch(path, { method: "PATCH", headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: "include" });
    } catch { /* notification acknowledgement is best effort */ }
  }

  function markRead(id: string) {
    const serverNotification = notifications.find(notification => notification.id === id) as any;
    if (serverNotification?._srvId) {
      setServerNotifs(previous => previous.map(notification => notification.id === serverNotification._srvId ? { ...notification, isRead: true } : notification));
      patchRead(`/api/notifications/${serverNotification._srvId}/read`);
    } else {
      markLocal(id);
    }
  }

  function markAllRead() {
    setServerNotifs(previous => previous.map(notification => ({ ...notification, isRead: true })));
    patchRead("/api/notifications/read-all");
    notifications.forEach(notification => { if (!(notification as any)._srvId) markLocal(notification.id); });
  }

  return { notifications, unread, markRead, markAllRead };
}
