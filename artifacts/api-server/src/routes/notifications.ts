import { Router } from "express";
import { db, usersTable, notificationsTable } from "@workspace/db";
import { and, eq, desc, inArray, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";

const requireApproved = async (req: any, res: any, next: any) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.clerkUserId)).limit(1);
  if (!user) return res.status(401).json({ error: "User not registered" });
  if (user.status !== "approved" && user.role !== "admin") {
    return res.status(403).json({ error: "Account pending approval" });
  }
  req.currentUser = user;
  next();
};

const requireAdmin = async (req: any, res: any, next: any) => {
  if (req.currentUser?.role !== "admin" && req.currentUser?.role !== "supervisor") {
    return res.status(403).json({ error: "Admin or supervisor required" });
  }
  next();
};

const router = Router();

// إشعاراتي: آخر 10 + عدد غير المقروء — استهلاك خفيف (يُستدعى عند الفتح/الـfocus/كل 5 دقائق كحد أقصى من الواجهة)
router.get("/", requireAuth, requireApproved, async (req: any, res) => {
  try {
    const userId = req.currentUser.id as number;
    const rows = await db.select().from(notificationsTable)
      .where(eq(notificationsTable.userId, userId))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(10);
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(notificationsTable)
      .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.isRead, false)));
    return res.json({ notifications: rows, unreadCount: count || 0 });
  } catch (e) {
    console.error("[notifications] list failed", e);
    return res.status(500).json({ error: "فشل تحميل الإشعارات" });
  }
});

// إرسال تنبيه إداري: كل المستخدمين / شركة / موقع / مستخدم محدد / دور
router.post("/", requireAuth, requireApproved, requireAdmin, async (req: any, res) => {
  try {
    const { title, body, type, href, target } = req.body || {};
    if (!title || !String(title).trim()) return res.status(400).json({ error: "العنوان مطلوب" });
    const t = target || { kind: "all" };
    const conds: any[] = [eq(usersTable.status, "approved")];
    if (t.kind === "company" && t.company) conds.push(eq(usersTable.company, String(t.company)));
    else if (t.kind === "hospital" && t.hospital) conds.push(eq(usersTable.hospital, String(t.hospital)));
    else if (t.kind === "user" && t.userId) conds.push(eq(usersTable.id, Number(t.userId)));
    else if (t.kind === "role" && t.role) conds.push(eq(usersTable.role, String(t.role) as any));
    const targets = await db.select({ id: usersTable.id }).from(usersTable).where(and(...conds));
    if (!targets.length) return res.status(400).json({ error: "لا يوجد مستخدمون مطابقون للهدف" });
    const values = targets.map(u => ({
      userId: u.id,
      type: String(type || "admin_message"),
      title: String(title).trim(),
      body: String(body || "").trim(),
      href: href ? String(href) : null,
      createdBy: String(req.currentUser?.name || req.currentUser?.email || "admin"),
    }));
    await db.insert(notificationsTable).values(values);
    return res.json({ ok: true, sent: values.length });
  } catch (e) {
    console.error("[notifications] send failed", e);
    return res.status(500).json({ error: "فشل إرسال التنبيه" });
  }
});

router.patch("/:id/read", requireAuth, requireApproved, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    await db.update(notificationsTable).set({ isRead: true })
      .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, req.currentUser.id)));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "فشل" }); }
});

router.patch("/read-all", requireAuth, requireApproved, async (req: any, res) => {
  try {
    await db.update(notificationsTable).set({ isRead: true })
      .where(and(eq(notificationsTable.userId, req.currentUser.id), eq(notificationsTable.isRead, false)));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "فشل" }); }
});

/** إنشاء إشعار داخلي من مسارات أخرى (تغيير حالة مستخلص) — لا يرمي أخطاء أبدًا */
export async function createNotificationSafe(n: { userId: number; type: string; title: string; body?: string; href?: string; createdBy?: string }) {
  try {
    if (!n || !n.userId) return;
    await db.insert(notificationsTable).values({
      userId: n.userId, type: n.type, title: n.title,
      body: n.body || "", href: n.href || null, createdBy: n.createdBy || "system",
    });
  } catch (e) {
    console.warn("[notifications] createNotificationSafe skipped:", (e as Error)?.message);
  }
}

export default router;
