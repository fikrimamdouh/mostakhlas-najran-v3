import { Router } from "express";
import { db, usersTable, submittedExtractsTable, systemSettingsTable } from "@workspace/db";
import { requireAuth } from "../middleware/requireAuth";
import { eq, and, inArray } from "drizzle-orm";
import { Resend } from "resend";
import { logger } from "../lib/logger";

const router = Router();

const ADMIN_EMAIL_FALLBACK = "rorofikri@gmail.com";

const requireAdmin = async (req: any, res: any, next: any) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.clerkUserId)).limit(1);
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) return res.status(403).json({ error: "Admin only" });
  req.currentUser = user;
  next();
};

async function getResendClient(): Promise<{ client: Resend; fromField: string } | null> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL ? "depl " + process.env.WEB_REPL_RENEWAL : null;
  if (!xReplitToken || !hostname) return null;
  try {
    const data = await fetch("https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=resend", {
      headers: { Accept: "application/json", "X-Replit-Token": xReplitToken },
    }).then(r => r.json()).then((d: { items?: any[] }) => d.items?.[0]);
    if (!data?.settings?.api_key) return null;
    const rawFrom: string = data.settings.from_email || "";
    const isPersonal = ["gmail.com","hotmail.com","yahoo.com","outlook.com","live.com"].some(d => rawFrom.toLowerCase().endsWith("@" + d));
    const emailAddr = isPersonal ? "onboarding@resend.dev" : (rawFrom || "onboarding@resend.dev");
    return { client: new Resend(data.settings.api_key), fromField: `نظام إدارة المستخلصات — تجمع نجران الصحي <${emailAddr}>` };
  } catch { return null; }
}

function getAppDomain(): string {
  const first = (process.env.REPLIT_DOMAINS || "").split(",")[0]?.trim();
  return first ? `https://${first}` : "";
}

// POST /api/remind — send reminder email to admin about pending/stale extracts
router.post("/", requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const { type = "pending" } = req.body; // type: "pending" | "needs_revision"

    const validTypes = ["pending", "needs_revision", "both"];
    if (!validTypes.includes(type)) return res.status(400).json({ error: "Invalid type" });

    const statuses = type === "both"
      ? ["submitted", "needs_revision"]
      : type === "needs_revision" ? ["needs_revision"] : ["submitted"];

    const { inArray: inArr } = await import("drizzle-orm");
    const pendingExtracts = await db
      .select({
        id: submittedExtractsTable.id,
        extractType: submittedExtractsTable.extractType,
        hospitalName: submittedExtractsTable.hospitalName,
        periodMonth: submittedExtractsTable.periodMonth,
        totalAmount: submittedExtractsTable.totalAmount,
        status: submittedExtractsTable.status,
        createdAt: submittedExtractsTable.createdAt,
        submitterName: usersTable.name,
        submitterEmail: usersTable.email,
      })
      .from(submittedExtractsTable)
      .leftJoin(usersTable, eq(submittedExtractsTable.userId, usersTable.id))
      .where(inArr(submittedExtractsTable.status, statuses as any))
      .orderBy(submittedExtractsTable.createdAt);

    if (pendingExtracts.length === 0) {
      return res.json({ sent: false, message: "لا توجد مستخلصات تحتاج تذكيراً", count: 0 });
    }

    const TYPE_LABELS: Record<string, string> = {
      labor: "مستخلص عمالة",
      consumables: "مستخلص مستهلكات",
      spare_parts: "مستخلص قطع غيار",
      health_centers: "مستخلص مراكز صحية",
      admin_offices: "مستخلص مكاتب إدارية",
    };

    const STATUS_LABELS: Record<string, string> = {
      submitted: "⏳ بانتظار المراجعة",
      needs_revision: "⚠️ يحتاج تعديل",
    };

    const domain = getAppDomain();
    const resend = await getResendClient();

    // Get admin email from settings
    const [settingRow] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, "admin_email")).limit(1);
    const adminEmail = settingRow?.value || ADMIN_EMAIL_FALLBACK;

    // Build email rows
    const tableRows = pendingExtracts.map((e, i) => {
      const bg = i % 2 === 0 ? "#f8fafc" : "#ffffff";
      const days = e.createdAt ? Math.floor((Date.now() - new Date(e.createdAt).getTime()) / 86_400_000) : "—";
      return `<tr style="background:${bg}">
        <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#374151">${TYPE_LABELS[e.extractType] || e.extractType}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#374151">${e.hospitalName || "—"}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#374151">${e.periodMonth || "—"}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#374151">${e.submitterName || "—"}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#374151;font-weight:700">${STATUS_LABELS[e.status] || e.status}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b">${days} يوم</td>
      </tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html lang="ar" dir="rtl">
<head><meta charset="UTF-8"><title>تذكير بالمستخلصات المعلقة</title></head>
<body style="font-family:Tajawal,Arial,sans-serif;background:#edf2f7;margin:0;padding:32px 16px;direction:rtl">
<div style="max-width:680px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.1)">
  <div style="background:linear-gradient(135deg,#0d1f3c,#1a3562);padding:32px;text-align:center">
    <div style="color:#d4af37;font-size:22px;font-weight:800">تجمع نجران الصحي</div>
    <div style="color:rgba(255,255,255,.7);font-size:13px;margin-top:4px">وحدة الصيانة العامة</div>
    <div style="background:rgba(212,175,55,.15);border:1px solid rgba(212,175,55,.4);border-radius:20px;display:inline-block;padding:4px 18px;margin-top:10px">
      <span style="color:#fff;font-size:12px">⏰ تذكير بالمستخلصات المعلقة</span>
    </div>
  </div>
  <div style="padding:32px">
    <p style="color:#1e3c72;font-size:18px;font-weight:800;margin:0 0 8px">يوجد <strong>${pendingExtracts.length}</strong> مستخلص يحتاج إلى مراجعتك</p>
    <p style="color:#64748b;font-size:13px;margin:0 0 24px">تم إرسال هذا التذكير بتاريخ ${new Date().toLocaleDateString("ar-SA")} على الساعة ${new Date().toLocaleTimeString("ar-SA")}</p>
    <div style="border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        <thead><tr style="background:linear-gradient(135deg,#1e3c72,#2a5298)">
          <th style="padding:12px 14px;color:#fff;font-size:12px;font-weight:700;text-align:right">نوع المستخلص</th>
          <th style="padding:12px 14px;color:#fff;font-size:12px;font-weight:700;text-align:right">الموقع</th>
          <th style="padding:12px 14px;color:#fff;font-size:12px;font-weight:700;text-align:right">الفترة</th>
          <th style="padding:12px 14px;color:#fff;font-size:12px;font-weight:700;text-align:right">المقدِّم</th>
          <th style="padding:12px 14px;color:#fff;font-size:12px;font-weight:700;text-align:right">الحالة</th>
          <th style="padding:12px 14px;color:#fff;font-size:12px;font-weight:700;text-align:right">منذ</th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
    ${domain ? `<div style="text-align:center;margin-top:24px">
      <a href="${domain}/original/approval.html" style="background:linear-gradient(135deg,#1e3c72,#2a5298);color:#fff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:14px;font-weight:700;display:inline-block">مراجعة المستخلصات المعلقة</a>
    </div>` : ""}
  </div>
  <div style="background:#0d1f3c;padding:18px;text-align:center;color:rgba(255,255,255,.4);font-size:11px">
    هذه رسالة آلية من نظام إدارة المستخلصات — تجمع نجران الصحي &copy; ${new Date().getFullYear()}
  </div>
</div>
</body></html>`;

    if (resend) {
      await resend.client.emails.send({
        from: resend.fromField,
        to: adminEmail,
        subject: `⏰ تذكير: ${pendingExtracts.length} مستخلص يحتاج مراجعة — نظام إدارة المستخلصات`,
        html,
      });
      logger.info({ adminEmail, count: pendingExtracts.length }, "Reminder email sent");
    }

    return res.json({ sent: !!resend, count: pendingExtracts.length, adminEmail });
  } catch (err: any) {
    req.log.error({ err }, "Remind failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
