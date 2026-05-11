import {
  db, usersTable, submittedExtractsTable, userStorageTable,
  auditLogTable, extractRevisionsTable, scheduledBackupsTable, systemSettingsTable,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { logger } from "./logger";
import { sendDailyBackupEmail } from "./email";

async function isAutoBackupEmailEnabled(): Promise<boolean> {
  try {
    const [row] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, "notify_auto_backup")).limit(1);
    if (!row) return true;
    return row.value !== "false";
  } catch { return true; }
}

const ADMIN_EMAIL = "rorofikri@gmail.com";
const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function runScheduledBackup(triggeredBy: "scheduler" | "manual" = "scheduler") {
  try {
    logger.info("Auto-backup: starting...");

    const [users, extracts, storage, auditLogs, revisions] = await Promise.all([
      db.select().from(usersTable),
      db.select().from(submittedExtractsTable),
      db.select().from(userStorageTable),
      db.select().from(auditLogTable),
      db.select().from(extractRevisionsTable),
    ]);

    const counts = {
      users: users.length,
      extracts: extracts.length,
      storageKeys: storage.length,
      auditLogs: auditLogs.length,
      revisions: revisions.length,
    };

    const backup = {
      meta: {
        version: "2.0",
        exportedAt: new Date().toISOString(),
        exportedBy: "auto-scheduler",
        counts,
      },
      tables: { users, extracts, storage, auditLogs, revisions },
    };

    const backupJson = JSON.stringify(backup);

    const [saved] = await db.insert(scheduledBackupsTable).values({
      triggeredBy,
      counts,
      backupJson,
      emailSent: false,
    }).returning({ id: scheduledBackupsTable.id });

    // Keep only last 7 daily backups to save storage
    const allBackups = await db
      .select({ id: scheduledBackupsTable.id })
      .from(scheduledBackupsTable)
      .orderBy(desc(scheduledBackupsTable.createdAt));

    if (allBackups.length > 7) {
      const { inArray } = await import("drizzle-orm");
      const toDelete = allBackups.slice(7).map(b => b.id);
      await db.delete(scheduledBackupsTable)
        // @ts-ignore
        .where(inArray(scheduledBackupsTable.id, toDelete));
    }

    // Send email notification (only if enabled)
    let emailSent = false;
    try {
      const emailEnabled = await isAutoBackupEmailEnabled();
      if (emailEnabled) {
        await sendDailyBackupEmail(ADMIN_EMAIL, counts, backup.meta.exportedAt, backupJson);
        emailSent = true;
      } else {
        logger.info("Auto-backup: email notification disabled, skipping");
      }
      const { eq } = await import("drizzle-orm");
      await db.update(scheduledBackupsTable)
        .set({ emailSent: true })
        .where(eq(scheduledBackupsTable.id, saved.id));
    } catch (emailErr) {
      logger.warn({ emailErr }, "Auto-backup: email send failed (backup still saved)");
    }


    logger.info({ counts, backupId: saved.id, emailSent }, "Auto-backup: completed");
    return { ok: true, backupId: saved.id, counts, emailSent };
  } catch (err) {
    logger.error({ err }, "Auto-backup: failed");
    return { ok: false, error: String(err) };
  }
}

export function startBackupScheduler() {
  // Run once shortly after startup (10 min delay)
  setTimeout(async () => {
    await runScheduledBackup("scheduler");
  }, 10 * 60 * 1000);

  // Then every 24 hours
  setInterval(async () => {
    await runScheduledBackup("scheduler");
  }, INTERVAL_MS);

  logger.info("Auto-backup scheduler started (daily, first run in 10 min)");
}
