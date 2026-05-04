import { Resend } from "resend";
import { logger } from "./logger";

// Resend integration via Replit connectors
async function getResendClient(): Promise<{ client: Resend; fromEmail: string } | null> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken || !hostname) {
    logger.warn("Resend integration not available (missing token or hostname)");
    return null;
  }

  try {
    const data = await fetch(
      "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=resend",
      {
        headers: {
          Accept: "application/json",
          "X-Replit-Token": xReplitToken,
        },
      },
    ).then((res) => res.json()).then((d: { items?: any[] }) => d.items?.[0]);

    if (!data?.settings?.api_key) {
      logger.warn("Resend not connected or missing api_key");
      return null;
    }

    return {
      client: new Resend(data.settings.api_key),
      fromEmail: data.settings.from_email || "noreply@example.com",
    };
  } catch (err) {
    logger.error({ err }, "Failed to get Resend client");
    return null;
  }
}

export async function sendWelcomeEmail(toEmail: string, name: string): Promise<void> {
  const resend = await getResendClient();
  if (!resend) return;

  try {
    await resend.client.emails.send({
      from: resend.fromEmail,
      to: toEmail,
      subject: "تم استلام طلب التسجيل - نظام المستخلصات",
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1e40af;">مرحباً ${name}</h2>
          <p>شكراً لتسجيلك في نظام إدارة المستخلصات.</p>
          <p>تم استلام طلبك وسيتم مراجعته من قبل الإدارة في أقرب وقت ممكن.</p>
          <p>سيصلك إشعار بالبريد الإلكتروني بمجرد الموافقة على حسابك.</p>
          <br/>
          <p style="color: #6b7280; font-size: 14px;">نظام إدارة المستخلصات</p>
        </div>
      `,
    });
    logger.info({ toEmail }, "Welcome email sent");
  } catch (err) {
    logger.error({ err, toEmail }, "Failed to send welcome email");
  }
}

export async function sendApprovalEmail(toEmail: string, name: string): Promise<void> {
  const resend = await getResendClient();
  if (!resend) return;

  try {
    await resend.client.emails.send({
      from: resend.fromEmail,
      to: toEmail,
      subject: "تم قبول طلبك - نظام المستخلصات",
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #16a34a;">مبروك ${name}!</h2>
          <p>يسعدنا إخبارك بأنه تم قبول طلب تسجيلك في نظام إدارة المستخلصات.</p>
          <p>يمكنك الآن تسجيل الدخول والبدء في استخدام النظام.</p>
          <br/>
          <p style="color: #6b7280; font-size: 14px;">نظام إدارة المستخلصات</p>
        </div>
      `,
    });
    logger.info({ toEmail }, "Approval email sent");
  } catch (err) {
    logger.error({ err, toEmail }, "Failed to send approval email");
  }
}

export async function sendRejectionEmail(toEmail: string, name: string): Promise<void> {
  const resend = await getResendClient();
  if (!resend) return;

  try {
    await resend.client.emails.send({
      from: resend.fromEmail,
      to: toEmail,
      subject: "بخصوص طلب التسجيل - نظام المستخلصات",
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #dc2626;">عزيزي ${name}</h2>
          <p>نأسف لإخبارك بأنه لم يتم قبول طلب تسجيلك في نظام إدارة المستخلصات في الوقت الحالي.</p>
          <p>للاستفسار، يرجى التواصل مع الإدارة.</p>
          <br/>
          <p style="color: #6b7280; font-size: 14px;">نظام إدارة المستخلصات</p>
        </div>
      `,
    });
    logger.info({ toEmail }, "Rejection email sent");
  } catch (err) {
    logger.error({ err, toEmail }, "Failed to send rejection email");
  }
}


export async function sendAdminNewSignupEmail(adminEmail: string, payload: { name: string; email: string; company?: string | null; phone?: string | null; }): Promise<void> {
  const resend = await getResendClient();
  if (!resend) return;

  try {
    await resend.client.emails.send({
      from: resend.fromEmail,
      to: adminEmail,
      subject: "تسجيل مستخدم جديد - نظام المستخلصات",
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1e40af;">تم تسجيل مستخدم جديد</h2>
          <p><strong>الاسم:</strong> ${payload.name}</p>
          <p><strong>الإيميل:</strong> ${payload.email}</p>
          <p><strong>الشركة:</strong> ${payload.company || "-"}</p>
          <p><strong>الجوال:</strong> ${payload.phone || "-"}</p>
          <br/>
          <p style="color: #6b7280; font-size: 14px;">تم الإرسال تلقائياً إلى مدير النظام الأساسي.</p>
        </div>
      `,
    });
    logger.info({ adminEmail, userEmail: payload.email }, "Admin signup notification email sent");
  } catch (err) {
    logger.error({ err, adminEmail, userEmail: payload.email }, "Failed to send admin signup notification email");
  }
}


export async function sendAdminActionEmail(
  adminEmail: string,
  payload: { action: string; actorName: string; actorEmail: string; targetName: string; targetEmail: string; details?: string | null; },
): Promise<void> {
  const resend = await getResendClient();
  if (!resend) return;

  try {
    await resend.client.emails.send({
      from: resend.fromEmail,
      to: adminEmail,
      subject: `إشعار إداري: ${payload.action}`,
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1e40af;">${payload.action}</h2>
          <p><strong>تم بواسطة:</strong> ${payload.actorName} (${payload.actorEmail})</p>
          <p><strong>على المستخدم:</strong> ${payload.targetName} (${payload.targetEmail})</p>
          <p><strong>التفاصيل:</strong> ${payload.details || "-"}</p>
        </div>
      `,
    });
    logger.info({ adminEmail, action: payload.action, targetEmail: payload.targetEmail }, "Admin action notification email sent");
  } catch (err) {
    logger.error({ err, adminEmail, action: payload.action, targetEmail: payload.targetEmail }, "Failed to send admin action notification email");
  }
}
