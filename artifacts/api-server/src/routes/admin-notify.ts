/**
 * admin-notify.ts — لوحة تحكم الإشعارات للأدمن
 * GET  /api/admin/notify/settings  — جلب إعدادات الإشعارات
 * POST /api/admin/notify/settings  — تحديث إعداد
 * POST /api/admin/notify/broadcast — إرسال بريد مخصص لكل المستخدمين أو اختيار
 * POST /api/admin/notify/test      — إرسال بريد اختبار للأدمن نفسه
 */
import { Router } from "express";
import { db, usersTable, systemSettingsTable } from "@workspace/db";
import { requireAuth } from "../middleware/requireAuth";
import { eq, inArray } from "drizzle-orm";
import { getResendClient, getAppDomain, emailLayout } from "../lib/email";
import { logger } from "../lib/logger";

const router = Router();

const requireAdmin = async (req: any, res: any, next: any) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.clerkUserId)).limit(1);
  if (!user || user.role !== "admin") return res.status(403).json({ error: "Admin only" });
  req.currentUser = user;
  next();
};

const NOTIFY_KEYS = [
  "notify_auto_inactivity",  // إرسال تنبيه التأخر تلقائياً
  "notify_auto_backup",      // إرسال إشعار النسخة الاحتياطية تلقائياً
  "notify_new_extract",      // إشعار تقديم مستخلص جديد
  "notify_new_user",         // إشعار مستخدم جديد
];

// GET /api/admin/notify/settings
router.get("/settings", requireAuth, requireAdmin, async (req, res) => {
  const rows = await db.select().from(systemSettingsTable)
    .where(inArray(systemSettingsTable.key, NOTIFY_KEYS as any));
  const settings: Record<string, string> = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  // defaults: all on
  NOTIFY_KEYS.forEach(k => { if (!(k in settings)) settings[k] = "true"; });
  return res.json({ settings });
});

// POST /api/admin/notify/settings { key, value }
router.post("/settings", requireAuth, requireAdmin, async (req: any, res) => {
  const { key, value } = req.body as { key?: string; value?: string };
  if (!key || value === undefined) return res.status(400).json({ error: "key and value required" });
  if (!NOTIFY_KEYS.includes(key)) return res.status(400).json({ error: "Unknown key" });
  await db.insert(systemSettingsTable)
    .values({ key, value, updatedBy: req.currentUser.email })
    .onConflictDoUpdate({
      target: systemSettingsTable.key,
      set: { value, updatedAt: new Date(), updatedBy: req.currentUser.email },
    });
  req.log.info({ key, value }, "Notify setting updated");
  return res.json({ ok: true });
});

// POST /api/admin/notify/broadcast
// { subject, message, recipients: "all" | "approved" | [userId, ...] }
router.post("/broadcast", requireAuth, requireAdmin, async (req: any, res) => {
  const { subject, message, recipients = "approved" } = req.body as {
    subject?: string; message?: string; recipients?: string | number[];
  };
  if (!subject?.trim() || !message?.trim()) {
    return res.status(400).json({ error: "subject and message required" });
  }

  let users;
  if (Array.isArray(recipients)) {
    users = await db.select({ email: usersTable.email, name: usersTable.name })
      .from(usersTable)
      .where(inArray(usersTable.id, recipients));
  } else {
    const whereClause = recipients === "all"
      ? undefined
      : eq(usersTable.status, "approved");
    users = await db.select({ email: usersTable.email, name: usersTable.name })
      .from(usersTable)
      .where(whereClause as any);
  }

  if (!users.length) return res.status(404).json({ error: "No recipients found", sent: 0 });

  const resend = await getResendClient();
  if (!resend) return res.status(503).json({ error: "Email service not configured" });

  const domain = getAppDomain();
  const content = `
    <p style="color:#1e3c72;font-size:20px;font-weight:800;margin:0 0 6px;">
      📢 &nbsp;إشعار من الإدارة
    </p>
    <p style="color:#64748b;font-size:13px;margin:0 0 24px;">رسالة رسمية من وحدة الصيانة العامة — تجمع نجران الصحي</p>
    <div style="height:1px;background:linear-gradient(90deg,transparent,#d4af37,transparent);margin:0 0 24px;opacity:.35;"></div>

    <div style="background:#f8fafc;border-radius:12px;border-right:4px solid #1e3c72;
                padding:20px 24px;margin-bottom:24px;">
      <p style="margin:0;color:#1e4080;font-size:14px;line-height:2;white-space:pre-wrap;">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
    </div>

    ${domain ? `
    <div style="text-align:center;margin-top:24px;">
      <a href="${domain}/dashboard"
        style="display:inline-block;background:linear-gradient(135deg,#1e3c72,#2a5298);
               color:#fff;text-decoration:none;padding:13px 36px;border-radius:10px;
               font-size:14px;font-weight:700;box-shadow:0 4px 14px rgba(30,60,114,0.3);">
        الدخول إلى النظام
      </a>
    </div>` : ""}
  `;
  const html = emailLayout(content, subject);
  const emailList = users.map(u => u.email).filter(Boolean) as string[];

  try {
    await resend.client.emails.send({
      from: resend.fromField,
      to: emailList,
      subject: `📢 ${subject} — نظام إدارة المستخلصات`,
      html,
    });
    logger.info({ count: emailList.length, sentBy: req.currentUser.email }, "Broadcast sent");
    return res.json({ ok: true, sent: emailList.length });
  } catch (err: any) {
    logger.error({ err }, "Broadcast failed");
    return res.status(500).json({ error: "Failed to send", detail: String(err) });
  }
});

// POST /api/admin/notify/test — إرسال بريد تجريبي للأدمن نفسه
router.post("/test", requireAuth, requireAdmin, async (req: any, res) => {
  const { subject = "بريد اختبار", message = "هذا بريد اختبار من نظام الإشعارات." } = req.body;
  const adminEmail = req.currentUser.email as string;

  const resend = await getResendClient();
  if (!resend) return res.status(503).json({ error: "Email service not configured" });

  const content = `
    <p style="color:#1e3c72;font-size:20px;font-weight:800;margin:0 0 6px;">🧪 بريد اختبار</p>
    <p style="color:#64748b;font-size:13px;margin:0 0 20px;">تم إرسال هذا البريد من لوحة تحكم الإشعارات</p>
    <div style="background:#f0fdf4;border-radius:10px;border-right:4px solid #16a34a;padding:16px 20px;margin-bottom:16px;">
      <p style="margin:0;color:#166534;font-size:14px;">✅ نظام الإشعارات يعمل بشكل صحيح</p>
      <p style="margin:6px 0 0;color:#374151;font-size:13px;white-space:pre-wrap;">${message}</p>
    </div>
  `;
  try {
    await resend.client.emails.send({
      from: resend.fromField,
      to: adminEmail,
      subject: `🧪 ${subject} — نظام إدارة المستخلصات`,
      html: emailLayout(content, subject),
    });
    return res.json({ ok: true, sentTo: adminEmail });
  } catch (err: any) {
    return res.status(500).json({ error: String(err) });
  }
});

export default router;
