import { Router } from "express";
import { sendSupportEmail, sendSupportConfirmationEmail } from "../lib/email";
import { db, systemSettingsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";

const ADMIN_EMAIL_FALLBACK = "rorofikri@gmail.com";
const SUPPORT_RATE_WINDOW_MS = 15 * 60 * 1000;
const SUPPORT_RATE_MAX = 5;
const supportRateCache = new Map<string, number[]>();
const router = Router();

async function requireSupportAccess(req: any, res: any, next: any) {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.clerkUserId)).limit(1);
    if (!user) return res.status(401).json({ error: "User not registered" });
    if (user.status !== "approved" && user.role !== "admin") {
      return res.status(403).json({ error: "Account pending approval" });
    }

    let modules: string[] | null = null;
    if (user.allowedModules) {
      try {
        const parsed = JSON.parse(user.allowedModules);
        modules = Array.isArray(parsed) ? parsed : [];
      } catch {
        modules = [];
      }
    }
    const privileged = user.role === "admin" || user.role === "supervisor";
    if (!privileged && modules !== null && !modules.includes("support")) {
      return res.status(403).json({ error: "Support permission required" });
    }

    req.currentUser = user;
    next();
  } catch (err) {
    req.log.error({ err }, "Support access check failed");
    return res.status(500).json({ error: "Internal server error" });
  }
}

function supportRateLimit(req: any, res: any, next: any) {
  const now = Date.now();
  const cutoff = now - SUPPORT_RATE_WINDOW_MS;
  const key = String(req.currentUser?.id || req.clerkUserId || req.ip || "unknown");
  const recent = (supportRateCache.get(key) || []).filter((timestamp) => timestamp > cutoff);
  if (recent.length >= SUPPORT_RATE_MAX) {
    supportRateCache.set(key, recent);
    res.setHeader("Retry-After", String(Math.max(1, Math.ceil((recent[0] + SUPPORT_RATE_WINDOW_MS - now) / 1000))));
    return res.status(429).json({ error: "تم الوصول إلى الحد المؤقت لرسائل الدعم. حاول مرة أخرى لاحقًا." });
  }
  recent.push(now);
  supportRateCache.set(key, recent);
  next();
}

async function getAdminEmail(): Promise<string> {
  try {
    const [row] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, "admin_email")).limit(1);
    return row?.value || ADMIN_EMAIL_FALLBACK;
  } catch {
    return ADMIN_EMAIL_FALLBACK;
  }
}

// POST /api/support — authenticated, approved users with support access only.
router.post("/", requireAuth, requireSupportAccess, supportRateLimit, async (req: any, res) => {
  const user = req.currentUser;
  const subject = String(req.body?.subject || "").trim();
  const message = String(req.body?.message || "").trim();
  if (!subject || !message) return res.status(400).json({ error: "الموضوع والتفاصيل مطلوبان" });
  if (subject.length > 200) return res.status(400).json({ error: "موضوع المذكرة أطول من الحد المسموح" });
  if (message.length > 5000) return res.status(400).json({ error: "تفاصيل المذكرة أطول من الحد المسموح" });

  const ticket = {
    name: String(user.name || "مستخدم النظام"),
    email: String(user.email || ""),
    subject,
    message,
  };
  if (!ticket.email) return res.status(400).json({ error: "لا يوجد بريد إلكتروني صالح بالحساب" });

  try {
    const adminEmail = await getAdminEmail();
    await sendSupportEmail(adminEmail, ticket);
    sendSupportConfirmationEmail(ticket).catch(() => {});
    req.log.info({ userId: user.id, subjectLength: subject.length, messageLength: message.length }, "Support ticket sent");
    return res.json({ sent: true });
  } catch (err) {
    req.log.error({ err }, "Failed to send support ticket");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
