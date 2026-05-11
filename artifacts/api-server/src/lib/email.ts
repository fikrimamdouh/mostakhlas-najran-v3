import { Resend } from "resend";
import { logger } from "./logger";

const SENDER_NAME = "نظام إدارة المستخلصات — تجمع نجران الصحي";

export async function getResendClient(): Promise<{ client: Resend; fromField: string } | null> {
  // 1. Try RESEND_API_KEY env secret first (direct, no connector overhead)
  const envApiKey = process.env.RESEND_API_KEY;
  if (envApiKey) {
    const fromField = `${SENDER_NAME} <onboarding@resend.dev>`;
    return { client: new Resend(envApiKey), fromField };
  }

  // 2. Fallback: Replit Resend connector
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;
  if (!xReplitToken || !hostname) { logger.warn("Resend: no env key and no connector token"); return null; }
  try {
    const data = await fetch(
      "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=resend",
      { headers: { Accept: "application/json", "X-Replit-Token": xReplitToken } },
    ).then((res) => res.json()).then((d: { items?: any[] }) => d.items?.[0]);
    if (!data?.settings?.api_key) { logger.warn("Resend not connected or missing api_key"); return null; }
    const rawFrom: string = data.settings.from_email || "";
    const personalDomains = ["gmail.com", "hotmail.com", "yahoo.com", "outlook.com", "live.com"];
    const isPersonal = personalDomains.some(d => rawFrom.toLowerCase().endsWith("@" + d));
    const emailAddr = isPersonal ? "onboarding@resend.dev" : (rawFrom || "onboarding@resend.dev");
    if (isPersonal) logger.warn({ rawFrom }, "from_email is a personal domain — using onboarding@resend.dev instead");
    const fromField = `${SENDER_NAME} <${emailAddr}>`;
    return { client: new Resend(data.settings.api_key), fromField };
  } catch (err) { logger.error({ err }, "Failed to get Resend client"); return null; }
}

export function getAppDomain(): string {
  const domains = process.env.REPLIT_DOMAINS || "";
  const first = domains.split(",")[0]?.trim();
  return first ? `https://${first}` : "";
}

// ── Shared layout ─────────────────────────────────────────────────────────────
export function emailLayout(content: string, subject: string, accentColor = "#1e3c72"): string {
  const domain = getAppDomain();
  const logoUrl = domain ? `${domain}/original/najran_health_cluster_logo.png` : "";

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#edf2f7;font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#edf2f7;padding:40px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- ── Header ── -->
  <tr><td>
    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:linear-gradient(150deg,#0d1f3c 0%,#1a3562 45%,#1e4080 75%,#2a5298 100%);
             border-radius:20px 20px 0 0;overflow:hidden;">
      <tr><td style="padding:0;">
        <!-- Gold top stripe -->
        <div style="height:4px;background:linear-gradient(90deg,#b8962e,#d4af37,#f0d060,#d4af37,#b8962e);"></div>
      </td></tr>
      <tr><td style="padding:36px 44px;text-align:center;">
        ${logoUrl ? `
        <div style="margin-bottom:18px;">
          <img src="${logoUrl}" alt="تجمع نجران الصحي" width="78" height="78"
            style="border-radius:16px;border:3px solid rgba(212,175,55,0.5);
                   box-shadow:0 0 24px rgba(212,175,55,0.25);display:inline-block;">
        </div>` : ""}
        <div style="color:#d4af37;font-size:24px;font-weight:800;letter-spacing:.5px;margin-bottom:6px;">
          تجمع نجران الصحي
        </div>
        <div style="color:rgba(255,255,255,0.65);font-size:13px;margin-bottom:14px;">
          وحدة الصيانة العامة
        </div>
        <div style="display:inline-block;background:rgba(212,175,55,0.12);
          border:1px solid rgba(212,175,55,0.35);border-radius:24px;padding:5px 20px;">
          <span style="color:rgba(255,255,255,0.9);font-size:12px;font-weight:600;letter-spacing:.3px;">
            ✦ &nbsp;نظام إدارة المستخلصات&nbsp; ✦
          </span>
        </div>
      </td></tr>
    </table>
  </td></tr>

  <!-- ── Body ── -->
  <tr><td>
    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#ffffff;padding:40px 44px;
             border-right:1px solid #e0e7ef;border-left:1px solid #e0e7ef;">
      <tr><td>${content}</td></tr>
    </table>
  </td></tr>

  <!-- ── Footer ── -->
  <tr><td>
    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:linear-gradient(135deg,#0d1f3c,#1a3562);
             border-radius:0 0 20px 20px;overflow:hidden;">
      <tr><td style="padding:0;">
        <div style="height:2px;background:linear-gradient(90deg,transparent,rgba(212,175,55,0.5),transparent);"></div>
      </td></tr>
      <tr><td style="padding:22px 44px;text-align:center;">
        <p style="margin:0 0 6px;color:rgba(212,175,55,0.7);font-size:12px;font-weight:600;">
          تجمع نجران الصحي — وحدة الصيانة العامة
        </p>
        <p style="margin:0;color:rgba(255,255,255,0.35);font-size:11px;line-height:1.7;">
          هذه رسالة آلية من نظام إدارة المستخلصات، يُرجى عدم الرد عليها مباشرةً.<br>
          &copy; ${new Date().getFullYear()} جميع الحقوق محفوظة — تجمع نجران الصحي
        </p>
      </td></tr>
    </table>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function infoRow(label: string, value: string, shade = false): string {
  const bg = shade ? "background:#f7fafd;" : "background:#ffffff;";
  return `<tr>
    <td style="${bg}padding:12px 18px;font-weight:700;color:#1e3c72;font-size:13px;
               width:150px;border-bottom:1px solid #eef2f7;white-space:nowrap;">${label}</td>
    <td style="${bg}padding:12px 18px;color:#374151;font-size:13px;
               border-bottom:1px solid #eef2f7;">${value}</td>
  </tr>`;
}

function actionButton(label: string, url: string, color = "#1e3c72"): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:28px auto 0;">
    <tr><td align="center">
      <a href="${url}"
        style="display:inline-block;
               background:linear-gradient(135deg,${color} 0%,${color}dd 100%);
               color:#ffffff;text-decoration:none;padding:15px 42px;
               border-radius:12px;font-size:15px;font-weight:700;
               letter-spacing:.4px;
               box-shadow:0 6px 20px ${color}50;">
        ${label}
      </a>
    </td></tr>
  </table>`;
}

function divider(): string {
  return `<div style="height:1px;background:linear-gradient(90deg,transparent,#d4af37,transparent);
                      margin:28px 0;opacity:0.35;"></div>`;
}

function sectionTitle(text: string): string {
  return `<p style="color:#1e3c72;font-size:15px;font-weight:700;margin:0 0 14px;
                    border-right:3px solid #d4af37;padding-right:10px;">${text}</p>`;
}

function greeting(name: string): string {
  return `<p style="color:#1e3c72;font-size:21px;font-weight:800;margin:0 0 6px;">
            أهلاً وسهلاً، ${name}
          </p>`;
}

function subheading(text: string): string {
  return `<p style="color:#64748b;font-size:13px;margin:0 0 24px;">${text}</p>`;
}

// ── 1. Welcome email ──────────────────────────────────────────────────────────
export async function sendWelcomeEmail(toEmail: string, name: string): Promise<void> {
  const resend = await getResendClient();
  if (!resend) return;
  const domain = getAppDomain();
  try {
    const content = `
      ${greeting(name)}
      ${subheading("يسعدنا استلام طلب تسجيلك في نظام إدارة المستخلصات")}
      ${divider()}
      <p style="color:#374151;font-size:14px;line-height:2;margin:0 0 20px;">
        تم استلام طلبك بنجاح وهو الآن <strong style="color:#1e3c72;">قيد المراجعة</strong>
        من قِبل الإدارة المختصة في وحدة الصيانة العامة.
        سيصلك بريد إلكتروني آخر فور اتخاذ القرار بشأن طلبك.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:linear-gradient(135deg,#f0f6ff,#e8f0fe);
               border-radius:12px;border-right:4px solid #2a5298;
               padding:18px 20px;margin-bottom:28px;">
        <tr><td>
          <p style="margin:0 0 8px;color:#1e3c72;font-size:14px;font-weight:700;">📋 ماذا يحدث بعد ذلك؟</p>
          <ul style="margin:0;padding-right:20px;color:#374151;font-size:13px;line-height:2.2;">
            <li>يراجع المختص بياناتك خلال فترة وجيزة</li>
            <li>ستتلقى إشعار بريدي بالموافقة أو طلب تصحيح البيانات</li>
            <li>بعد الموافقة يمكنك الوصول الكامل لجميع وحدات النظام</li>
          </ul>
        </td></tr>
      </table>

      ${domain ? actionButton("الدخول إلى النظام", `${domain}/dashboard`) : ""}
    `;
    await resend.client.emails.send({
      from: resend.fromField,
      to: toEmail,
      subject: "تم استلام طلب تسجيلك — نظام إدارة المستخلصات",
      html: emailLayout(content, "تم استلام طلب تسجيلك"),
    });
    logger.info({ toEmail }, "Welcome email sent");
  } catch (err) { logger.error({ err, toEmail }, "Failed to send welcome email"); }
}

// ── 2. Admin notification ─────────────────────────────────────────────────────
export async function sendAdminNewUserEmail(adminEmail: string, newUser: {
  name: string; email: string; phone?: string | null;
  hospital?: string | null; jobTitle?: string | null; contractNumber?: string | null;
}): Promise<void> {
  const resend = await getResendClient();
  if (!resend) return;
  const domain = getAppDomain();
  try {
    const content = `
      <p style="color:#1e3c72;font-size:21px;font-weight:800;margin:0 0 6px;">
        🔔 &nbsp;طلب انضمام جديد
      </p>
      ${subheading("سجّل مستخدم جديد في النظام ويحتاج إلى موافقتك")}
      ${divider()}

      ${sectionTitle("بيانات المستخدم")}
      <table width="100%" cellpadding="0" cellspacing="0"
        style="border-radius:12px;overflow:hidden;border:1px solid #e0e7ef;margin-bottom:24px;">
        ${infoRow("الاسم الكامل", newUser.name, true)}
        ${infoRow("البريد الإلكتروني", newUser.email)}
        ${infoRow("رقم الجوال", newUser.phone || "—", true)}
        ${infoRow("المستشفى / الجهة", newUser.hospital || "—")}
        ${infoRow("المسمى الوظيفي", newUser.jobTitle || "—", true)}
        ${infoRow("رقم العقد", newUser.contractNumber || "—")}
      </table>

      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:linear-gradient(135deg,#fffbeb,#fef3c7);
               border-radius:12px;border:1px solid #fcd34d;padding:16px 20px;margin-bottom:8px;">
        <tr><td>
          <p style="margin:0;color:#92400e;font-size:13px;font-weight:600;">⚠️ &nbsp;إجراء مطلوب</p>
          <p style="margin:6px 0 0;color:#78350f;font-size:13px;line-height:1.8;">
            يرجى مراجعة بيانات المستخدم والموافقة عليه أو رفضه من لوحة إدارة المستخدمين.
          </p>
        </td></tr>
      </table>

      ${domain ? actionButton("إدارة المستخدمين", `${domain}/admin/users`, "#1e3c72") : ""}
    `;
    await resend.client.emails.send({
      from: resend.fromField,
      to: adminEmail,
      subject: `طلب انضمام جديد: ${newUser.name} — نظام إدارة المستخلصات`,
      html: emailLayout(content, "طلب انضمام جديد"),
    });
    logger.info({ adminEmail, newUserEmail: newUser.email }, "Admin new-user notification sent");
  } catch (err) { logger.error({ err }, "Failed to send admin new user email"); }
}

// ── 3. Approval email ─────────────────────────────────────────────────────────
export async function sendApprovalEmail(toEmail: string, name: string): Promise<void> {
  const resend = await getResendClient();
  if (!resend) return;
  const domain = getAppDomain();
  try {
    const content = `
      <div style="text-align:center;margin-bottom:24px;">
        <div style="display:inline-flex;align-items:center;justify-content:center;
                    width:64px;height:64px;border-radius:50%;
                    background:linear-gradient(135deg,#dcfce7,#bbf7d0);
                    border:2px solid #4ade80;margin-bottom:16px;">
          <span style="font-size:28px;">✅</span>
        </div>
        <h2 style="color:#15803d;font-size:22px;font-weight:800;margin:0 0 6px;">
          تمت الموافقة على حسابك
        </h2>
        <p style="color:#64748b;font-size:13px;margin:0;">نرحب بك رسمياً في نظام إدارة المستخلصات</p>
      </div>

      ${divider()}

      <p style="color:#374151;font-size:14px;line-height:2;margin:0 0 20px;">
        عزيزي <strong style="color:#1e3c72;">${name}</strong>،<br><br>
        يسرّنا إبلاغك بأن طلب انضمامك إلى <strong>نظام إدارة المستخلصات</strong>
        قد تمت <strong style="color:#15803d;">الموافقة عليه</strong>.
        يمكنك الآن تسجيل الدخول والبدء في استخدام جميع ميزات النظام.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);
               border-radius:12px;border-right:4px solid #16a34a;
               padding:18px 20px;margin-bottom:28px;">
        <tr><td>
          <p style="margin:0 0 10px;color:#15803d;font-size:14px;font-weight:700;">
            🚀 ما يمكنك فعله الآن
          </p>
          <ul style="margin:0;padding-right:20px;color:#374151;font-size:13px;line-height:2.3;">
            <li>تقديم المستخلصات الشهرية وتتبع حالاتها في الوقت الفعلي</li>
            <li>الاطلاع على سجل العمليات والموافقات</li>
            <li>إعداد تقارير الحضور والإنجاز والمستهلكات</li>
            <li>التواصل مع الإدارة عبر مذكرات الدعم</li>
          </ul>
        </td></tr>
      </table>

      ${domain ? actionButton("الدخول إلى النظام الآن", `${domain}/dashboard`, "#16a34a") : ""}
    `;
    await resend.client.emails.send({
      from: resend.fromField,
      to: toEmail,
      subject: "✅ تمت الموافقة على حسابك — نظام إدارة المستخلصات",
      html: emailLayout(content, "تمت الموافقة على حسابك", "#16a34a"),
    });
    logger.info({ toEmail }, "Approval email sent");
  } catch (err) { logger.error({ err, toEmail }, "Failed to send approval email"); }
}

// ── 4. Rejection email ────────────────────────────────────────────────────────
export async function sendRejectionEmail(toEmail: string, name: string): Promise<void> {
  const resend = await getResendClient();
  if (!resend) return;
  try {
    const content = `
      <div style="text-align:center;margin-bottom:24px;">
        <div style="display:inline-flex;align-items:center;justify-content:center;
                    width:64px;height:64px;border-radius:50%;
                    background:linear-gradient(135deg,#fef2f2,#fee2e2);
                    border:2px solid #f87171;margin-bottom:16px;">
          <span style="font-size:28px;">📋</span>
        </div>
        <h2 style="color:#b91c1c;font-size:22px;font-weight:800;margin:0 0 6px;">
          بخصوص طلب تسجيلك
        </h2>
        <p style="color:#64748b;font-size:13px;margin:0;">نظام إدارة المستخلصات — تجمع نجران الصحي</p>
      </div>

      ${divider()}

      <p style="color:#374151;font-size:14px;line-height:2;margin:0 0 20px;">
        عزيزي <strong style="color:#1e3c72;">${name}</strong>،<br><br>
        شكراً لتقديمك طلب الانضمام إلى نظام إدارة المستخلصات.
        نأسف لإبلاغك بأنه <strong style="color:#b91c1c;">لم يتمكن من قبول طلبك</strong> في الوقت الحالي.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:linear-gradient(135deg,#fef2f2,#fee2e2);
               border-radius:12px;border-right:4px solid #dc2626;
               padding:18px 20px;margin-bottom:20px;">
        <tr><td>
          <p style="margin:0 0 8px;color:#b91c1c;font-size:14px;font-weight:700;">
            📞 للاستفسار والتواصل
          </p>
          <p style="margin:0;color:#7f1d1d;font-size:13px;line-height:1.9;">
            يرجى التواصل مع وحدة الصيانة العامة في تجمع نجران الصحي
            للحصول على مزيد من التوضيح أو تصحيح بياناتك وإعادة التقديم.
          </p>
        </td></tr>
      </table>
    `;
    await resend.client.emails.send({
      from: resend.fromField,
      to: toEmail,
      subject: "بخصوص طلب تسجيلك — نظام إدارة المستخلصات",
      html: emailLayout(content, "بخصوص طلب التسجيل", "#b91c1c"),
    });
    logger.info({ toEmail }, "Rejection email sent");
  } catch (err) { logger.error({ err, toEmail }, "Failed to send rejection email"); }
}

// ── 5. New extract submitted — notify admin + hospital supervisors ────────────
export async function sendNewExtractEmail(
  recipientEmails: string[],
  extract: {
    submitterName: string;
    submitterEmail: string;
    hospitalName: string;
    extractType: string;
    periodMonth?: string | null;
    totalAmount?: string | null;
    extractId: number;
  }
): Promise<void> {
  const resend = await getResendClient();
  if (!resend || recipientEmails.length === 0) return;
  const domain = getAppDomain();

  const typeLabels: Record<string, string> = {
    labor: "مستخلص عمالة",
    consumables: "مستخلص مستهلكات",
    spare_parts: "مستخلص قطع غيار",
    health_centers: "مستخلص مراكز صحية",
    admin_offices: "مستخلص مكاتب إدارية",
  };
  const typeLabel = typeLabels[extract.extractType] || extract.extractType;

  try {
    const content = `
      <p style="color:#1e3c72;font-size:21px;font-weight:800;margin:0 0 6px;">
        📋 &nbsp;مستخلص جديد مقدم
      </p>
      ${subheading("تم تقديم مستخلص جديد ويحتاج إلى مراجعة واعتماد")}
      ${divider()}

      ${sectionTitle("تفاصيل المستخلص")}
      <table width="100%" cellpadding="0" cellspacing="0"
        style="border-radius:12px;overflow:hidden;border:1px solid #e0e7ef;margin-bottom:24px;">
        ${infoRow("نوع المستخلص", typeLabel, true)}
        ${infoRow("الموقع / المستشفى", extract.hospitalName)}
        ${infoRow("الفترة", extract.periodMonth || "—", true)}
        ${infoRow("المبلغ الإجمالي", extract.totalAmount ? `${Number(extract.totalAmount).toLocaleString("ar-SA")} ريال` : "—")}
      </table>

      ${sectionTitle("المقدِّم")}
      <table width="100%" cellpadding="0" cellspacing="0"
        style="border-radius:12px;overflow:hidden;border:1px solid #e0e7ef;margin-bottom:24px;">
        ${infoRow("الاسم", extract.submitterName, true)}
        ${infoRow("البريد الإلكتروني", extract.submitterEmail)}
      </table>

      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:linear-gradient(135deg,#fffbeb,#fef3c7);
               border-radius:12px;border:1px solid #fcd34d;padding:16px 20px;margin-bottom:8px;">
        <tr><td>
          <p style="margin:0;color:#92400e;font-size:13px;font-weight:600;">⚡ &nbsp;إجراء مطلوب</p>
          <p style="margin:6px 0 0;color:#78350f;font-size:13px;line-height:1.8;">
            يرجى مراجعة المستخلص واتخاذ القرار المناسب (موافقة / رفض / طلب تعديل).
          </p>
        </td></tr>
      </table>

      ${domain ? actionButton("مراجعة المستخلص", `${domain}/submitted-extracts/${extract.extractId}`, "#1e3c72") : ""}
    `;
    await resend.client.emails.send({
      from: resend.fromField,
      to: recipientEmails,
      subject: `📋 مستخلص جديد: ${typeLabel} — ${extract.hospitalName || "—"}`,
      html: emailLayout(content, "مستخلص جديد مقدم"),
    });
    logger.info({ recipientEmails, extractId: extract.extractId }, "New extract notification sent");
  } catch (err) { logger.error({ err }, "Failed to send new extract email"); }
}

// ── 6. Inactivity alert — hospitals with no extract for 45+ days ──────────────
export async function sendInactivityAlertEmail(
  adminEmail: string,
  inactiveHospitals: { hospital: string; daysSince: number; lastDate: string | null }[]
): Promise<void> {
  const resend = await getResendClient();
  if (!resend || inactiveHospitals.length === 0) return;
  const domain = getAppDomain();

  try {
    const rows = inactiveHospitals.map((h, i) =>
      infoRow(h.hospital, h.lastDate ? `آخر تقديم: ${h.lastDate} (منذ ${h.daysSince} يوم)` : "لم يُقدَّم مستخلص بعد", i % 2 === 0)
    ).join("");

    const content = `
      <div style="text-align:center;margin-bottom:24px;">
        <div style="display:inline-flex;align-items:center;justify-content:center;
                    width:64px;height:64px;border-radius:50%;
                    background:linear-gradient(135deg,#fef3c7,#fde68a);
                    border:2px solid #f59e0b;margin-bottom:16px;">
          <span style="font-size:28px;">⏰</span>
        </div>
        <h2 style="color:#92400e;font-size:22px;font-weight:800;margin:0 0 6px;">
          تنبيه: مواقع متأخرة في تقديم المستخلصات
        </h2>
        <p style="color:#64748b;font-size:13px;margin:0;">
          المواقع التالية لم تقدم مستخلصات منذ أكثر من 45 يوماً
        </p>
      </div>

      ${divider()}

      ${sectionTitle(`المواقع المتأخرة (${inactiveHospitals.length})`)}
      <table width="100%" cellpadding="0" cellspacing="0"
        style="border-radius:12px;overflow:hidden;border:1px solid #e0e7ef;margin-bottom:24px;">
        ${rows}
      </table>

      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:linear-gradient(135deg,#fef2f2,#fee2e2);
               border-radius:12px;border-right:4px solid #dc2626;padding:18px 20px;margin-bottom:8px;">
        <tr><td>
          <p style="margin:0 0 8px;color:#b91c1c;font-size:14px;font-weight:700;">📌 تذكير</p>
          <p style="margin:0;color:#7f1d1d;font-size:13px;line-height:1.9;">
            يرجى التواصل مع المشرفين المسؤولين عن هذه المواقع وحثهم على تقديم المستخلصات المتأخرة.
          </p>
        </td></tr>
      </table>

      ${domain ? actionButton("عرض إحصائيات المستخلصات", `${domain}/admin/extracts-stats`, "#92400e") : ""}
    `;
    await resend.client.emails.send({
      from: resend.fromField,
      to: adminEmail,
      subject: `⏰ تنبيه: ${inactiveHospitals.length} موقع متأخر في تقديم المستخلصات`,
      html: emailLayout(content, "تنبيه مواقع متأخرة", "#92400e"),
    });
    logger.info({ adminEmail, count: inactiveHospitals.length }, "Inactivity alert sent");
  } catch (err) { logger.error({ err }, "Failed to send inactivity alert email"); }
}

// ── 7. Support ticket email ───────────────────────────────────────────────────
export async function sendSupportEmail(adminEmail: string, ticket: {
  name: string; email: string; subject: string; message: string;
}): Promise<void> {
  const resend = await getResendClient();
  if (!resend) return;
  try {
    const content = `
      <p style="color:#1e3c72;font-size:21px;font-weight:800;margin:0 0 6px;">
        📩 &nbsp;مذكرة دعم جديدة
      </p>
      ${subheading("وردت مذكرة دعم جديدة من أحد مستخدمي النظام")}
      ${divider()}

      ${sectionTitle("بيانات المُرسِل")}
      <table width="100%" cellpadding="0" cellspacing="0"
        style="border-radius:12px;overflow:hidden;border:1px solid #e0e7ef;margin-bottom:24px;">
        ${infoRow("الاسم", ticket.name, true)}
        ${infoRow("البريد الإلكتروني", ticket.email)}
        ${infoRow("الموضوع", ticket.subject, true)}
      </table>

      ${sectionTitle("نص الرسالة")}
      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:#f8fafc;border-radius:12px;border:1px solid #e0e7ef;
               padding:20px;margin-bottom:20px;">
        <tr><td>
          <p style="margin:0;color:#374151;font-size:14px;line-height:2;
                    white-space:pre-wrap;">${ticket.message}</p>
        </td></tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0"
        style="background:linear-gradient(135deg,#f0f6ff,#e8f0fe);
               border-radius:12px;border-right:4px solid #2a5298;padding:16px 20px;">
        <tr><td>
          <p style="margin:0;color:#1e3c72;font-size:13px;">
            💬 &nbsp;يمكنك الرد مباشرةً على هذا البريد للتواصل مع:
            <strong>${ticket.name}</strong> — <strong>${ticket.email}</strong>
          </p>
        </td></tr>
      </table>
    `;
    await resend.client.emails.send({
      from: resend.fromField,
      to: adminEmail,
      replyTo: ticket.email,
      subject: `📩 مذكرة دعم: ${ticket.subject} — نظام إدارة المستخلصات`,
      html: emailLayout(content, "مذكرة دعم جديدة"),
    });
    logger.info({ adminEmail }, "Support ticket email sent");
  } catch (err) { logger.error({ err }, "Failed to send support email"); }
}

// ── Daily auto-backup notification ────────────────────────────────────────────
export async function sendDailyBackupEmail(
  adminEmail: string,
  counts: { users: number; extracts: number; storageKeys: number; auditLogs: number; revisions: number },
  exportedAt: string,
) {
  try {
    const resend = await getResendClient();
    if (!resend) { logger.warn("sendDailyBackupEmail: no Resend client"); return; }
    const domain = getAppDomain();
    const backupUrl = domain ? `${domain}/admin/backup` : "";
    const dateStr = new Date(exportedAt).toLocaleDateString("ar-SA", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

    const content = `
      <tr><td style="padding:32px 40px;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="display:inline-block;background:linear-gradient(135deg,#1e3c72,#2a5298);
               border-radius:50%;padding:14px;margin-bottom:12px;">
            <span style="font-size:28px;">🛡️</span>
          </div>
          <h2 style="margin:0;color:#1e3c72;font-size:20px;font-weight:700;">نسخة احتياطية تلقائية — تمت بنجاح</h2>
          <p style="margin:6px 0 0;color:#64748b;font-size:14px;">${dateStr}</p>
        </div>

        <div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border-radius:12px;
             border:1px solid #bbf7d0;padding:20px;margin-bottom:20px;text-align:center;">
          <p style="margin:0 0 8px;color:#15803d;font-size:13px;font-weight:700;">✅ تم حفظ النسخة الاحتياطية على السيرفر تلقائياً</p>
          <p style="margin:0;color:#166534;font-size:12px;">البيانات محفوظة ويمكن تحميلها في أي وقت</p>
        </div>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
          <tr>
            <td style="padding:4px;">
              <div style="background:#eff6ff;border-radius:10px;padding:14px;text-align:center;">
                <div style="font-size:24px;font-weight:800;color:#1e3c72;">${counts.users}</div>
                <div style="font-size:12px;color:#64748b;margin-top:2px;">مستخدم</div>
              </div>
            </td>
            <td style="padding:4px;">
              <div style="background:#fefce8;border-radius:10px;padding:14px;text-align:center;">
                <div style="font-size:24px;font-weight:800;color:#854d0e;">${counts.extracts}</div>
                <div style="font-size:12px;color:#64748b;margin-top:2px;">مستخلص</div>
              </div>
            </td>
            <td style="padding:4px;">
              <div style="background:#fdf4ff;border-radius:10px;padding:14px;text-align:center;">
                <div style="font-size:24px;font-weight:800;color:#6b21a8;">${counts.storageKeys}</div>
                <div style="font-size:12px;color:#64748b;margin-top:2px;">مفتاح بيانات</div>
              </div>
            </td>
            <td style="padding:4px;">
              <div style="background:#fff7ed;border-radius:10px;padding:14px;text-align:center;">
                <div style="font-size:24px;font-weight:800;color:#c2410c;">${counts.auditLogs}</div>
                <div style="font-size:12px;color:#64748b;margin-top:2px;">سجل مراقبة</div>
              </div>
            </td>
          </tr>
        </table>

        <div style="background:#fffbeb;border-radius:10px;border:1px solid #fde68a;padding:16px;margin-bottom:20px;">
          <p style="margin:0;color:#92400e;font-size:13px;font-weight:700;">⚠️ تذكير مهم</p>
          <p style="margin:6px 0 0;color:#78350f;font-size:13px;">
            النسخة الاحتياطية محفوظة على السيرفر لمدة 7 أيام فقط. يُنصح بتحميل نسخة يدوية وحفظها على جهازك أو Google Drive بشكل دوري.
          </p>
        </div>

        ${backupUrl ? `
        <div style="text-align:center;">
          <a href="${backupUrl}" style="display:inline-block;background:linear-gradient(135deg,#1e3c72,#2a5298);
               color:#fff;text-decoration:none;padding:12px 32px;border-radius:10px;
               font-size:14px;font-weight:700;box-shadow:0 4px 12px rgba(30,60,114,0.3);">
            📥 تحميل النسخة الاحتياطية الآن
          </a>
        </div>` : ""}
      </td></tr>
    `;

    await resend.client.emails.send({
      from: resend.fromField,
      to: adminEmail,
      subject: `🛡️ نسخة احتياطية تلقائية — ${dateStr}`,
      html: emailLayout(content, "نسخة احتياطية تلقائية يومية"),
    });
    logger.info({ adminEmail, counts }, "Daily backup email sent");
  } catch (err) { logger.error({ err }, "Failed to send daily backup email"); }
}
