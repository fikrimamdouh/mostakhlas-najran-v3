/**
 * inactivity.ts — فحص المواقع المتأخرة في تقديم المستخلصات
 * يُشغَّل تلقائياً كل 24 ساعة ويرسل بريداً للمدير إن وُجد تأخير
 */
import { db, usersTable, submittedExtractsTable, systemSettingsTable } from "@workspace/db";
import { eq, and, max, isNotNull } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { sendInactivityAlertEmail } from "./email";
import { logger } from "./logger";

async function isAutoNotifyEnabled(key: string): Promise<boolean> {
  try {
    const [row] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, key)).limit(1);
    if (!row) return true; // default: enabled
    return row.value !== "false";
  } catch { return true; }
}

const ADMIN_EMAIL = "rorofikri@gmail.com";
const INACTIVITY_DAYS = 45;

export async function runInactivityCheck(): Promise<{
  inactiveHospitals: { hospital: string; daysSince: number; lastDate: string | null }[];
  emailSent: boolean;
}> {
  try {
    // Get all distinct hospitals with approved users
    const hospitalRows = await db
      .selectDistinct({ hospital: usersTable.hospital })
      .from(usersTable)
      .where(and(
        eq(usersTable.status, "approved"),
        isNotNull(usersTable.hospital),
      ));

    const hospitals = hospitalRows
      .map(r => r.hospital)
      .filter((h): h is string => !!h?.trim());

    if (hospitals.length === 0) return { inactiveHospitals: [], emailSent: false };

    const inactiveHospitals: { hospital: string; daysSince: number; lastDate: string | null }[] = [];

    for (const hospital of hospitals) {
      const [result] = await db
        .select({ lastDate: max(submittedExtractsTable.createdAt) })
        .from(submittedExtractsTable)
        .where(eq(submittedExtractsTable.hospitalName, hospital));

      const lastDate = result?.lastDate ?? null;
      const daysSince = lastDate
        ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000)
        : INACTIVITY_DAYS + 1;

      if (daysSince >= INACTIVITY_DAYS) {
        inactiveHospitals.push({
          hospital,
          daysSince,
          lastDate: lastDate ? new Date(lastDate).toLocaleDateString("ar-SA") : null,
        });
      }
    }

    let emailSent = false;
    if (inactiveHospitals.length > 0) {
      const autoEnabled = await isAutoNotifyEnabled("notify_auto_inactivity");
      if (autoEnabled) {
        await sendInactivityAlertEmail(ADMIN_EMAIL, inactiveHospitals);
        emailSent = true;
      } else {
        logger.info("Inactivity check: auto-notify disabled, skipping email");
      }
    }

    logger.info(
      { checked: hospitals.length, inactive: inactiveHospitals.length, emailSent },
      "Inactivity check completed"
    );

    return { inactiveHospitals, emailSent };
  } catch (err) {
    logger.error({ err }, "Inactivity check failed");
    return { inactiveHospitals: [], emailSent: false };
  }
}

// بدء الجدولة التلقائية كل 24 ساعة
export function startInactivityScheduler(): void {
  const RUN_EVERY_MS = 24 * 60 * 60 * 1000; // 24 ساعة

  // تشغيل أول مرة بعد 30 ثانية من بدء الخادم (لإعطاء وقت للاتصال بقاعدة البيانات)
  setTimeout(async () => {
    logger.info("Running scheduled inactivity check");
    await runInactivityCheck();
    // ثم كل 24 ساعة
    setInterval(async () => {
      logger.info("Running scheduled inactivity check");
      await runInactivityCheck();
    }, RUN_EVERY_MS);
  }, 30_000);
}
