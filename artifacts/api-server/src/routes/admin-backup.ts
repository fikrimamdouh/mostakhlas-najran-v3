import { Router } from "express";
import {
  db, usersTable, submittedExtractsTable, userStorageTable,
  auditLogTable, extractRevisionsTable, scheduledBackupsTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { runScheduledBackup } from "../lib/backup-scheduler";

const router = Router();

const requireAdmin = async (req: any, res: any, next: any) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.clerkUserId)).limit(1);
  if (!user || user.role !== "admin") return res.status(403).json({ error: "Admin only" });
  req.currentUser = user;
  next();
};

/**
 * GET /api/admin/backup/full
 * Full system export — all tables, all users, all data.
 * Admin only.
 */
router.get("/full", requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    const [users, extracts, storage, auditLogs, revisions] = await Promise.all([
      db.select().from(usersTable),
      db.select().from(submittedExtractsTable),
      db.select().from(userStorageTable),
      db.select().from(auditLogTable),
      db.select().from(extractRevisionsTable),
    ]);

    const now = new Date();
    const backup = {
      meta: {
        version: "2.0",
        exportedAt: now.toISOString(),
        exportedBy: req.currentUser.email,
        counts: {
          users: users.length,
          extracts: extracts.length,
          storageKeys: storage.length,
          auditLogs: auditLogs.length,
          revisions: revisions.length,
        },
      },
      tables: { users, extracts, storage, auditLogs, revisions },
    };

    req.log.info({ adminId: req.currentUser.id, counts: backup.meta.counts }, "Full system backup exported");
    return res.json(backup);
  } catch (err) {
    req.log.error({ err }, "Backup export failed");
    return res.status(500).json({ error: "فشل في تصدير النسخة الاحتياطية" });
  }
});

/**
 * GET /api/admin/backup/stats
 * Quick stats for backup status page — no heavy data.
 */
router.get("/stats", requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    const [users, extracts, storage, auditLogs, revisions] = await Promise.all([
      db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email,
        status: usersTable.status, role: usersTable.role, hospital: usersTable.hospital,
        company: usersTable.company, createdAt: usersTable.createdAt })
        .from(usersTable),
      db.select({ id: submittedExtractsTable.id, extractType: submittedExtractsTable.extractType,
        status: submittedExtractsTable.status, createdAt: submittedExtractsTable.createdAt,
        hospitalName: submittedExtractsTable.hospitalName, periodMonth: submittedExtractsTable.periodMonth,
        totalAmount: submittedExtractsTable.totalAmount })
        .from(submittedExtractsTable),
      db.select({ id: userStorageTable.id, userId: userStorageTable.userId,
        storageKey: userStorageTable.storageKey, updatedAt: userStorageTable.updatedAt })
        .from(userStorageTable),
      db.select({ id: auditLogTable.id }).from(auditLogTable),
      db.select({ id: extractRevisionsTable.id }).from(extractRevisionsTable),
    ]);

    const latestStorage = storage.reduce((acc, row) => {
      const existing = acc[row.userId];
      if (!existing || new Date(row.updatedAt) > new Date(existing)) {
        acc[row.userId] = row.updatedAt.toISOString();
      }
      return acc;
    }, {} as Record<number, string>);

    const usersWithSync = users.map(u => ({
      ...u,
      storageCount: storage.filter(s => s.userId === u.id).length,
      lastSync: latestStorage[u.id] || null,
    }));

    const stats = {
      exportedAt: new Date().toISOString(),
      counts: {
        users: users.length,
        approvedUsers: users.filter(u => u.status === "approved").length,
        extracts: extracts.length,
        storageKeys: storage.length,
        auditLogs: auditLogs.length,
        revisions: revisions.length,
      },
      users: usersWithSync,
      recentExtracts: extracts
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10),
    };

    return res.json(stats);
  } catch (err) {
    req.log.error({ err }, "Backup stats failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/admin/backup/restore
 * Restore system from a full backup JSON file.
 * Admin only. Requires explicit confirmation string in body.
 */
router.post("/restore", requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    const { confirmation, backup } = req.body;

    if (confirmation !== "تأكيد الاستعادة الكاملة") {
      return res.status(400).json({ error: "يجب تأكيد الاستعادة بكتابة العبارة المطلوبة" });
    }

    if (!backup || typeof backup !== "object") {
      return res.status(400).json({ error: "ملف النسخة الاحتياطية غير صالح" });
    }

    const meta = backup.meta;
    const tables = backup.tables;

    if (!meta || !tables) {
      return res.status(400).json({ error: "هيكل النسخة الاحتياطية غير مكتمل — يجب أن يحتوي على meta وtables" });
    }

    if (!meta.version || !["1.0", "2.0"].includes(meta.version)) {
      return res.status(400).json({ error: `إصدار النسخة غير متوافق: ${meta.version}. الإصدارات المدعومة: 1.0, 2.0` });
    }

    const requiredTables = ["users", "extracts", "storage"];
    const missingTables = requiredTables.filter(t => !tables[t]);
    if (missingTables.length > 0) {
      return res.status(400).json({ error: `النسخة الاحتياطية ناقصة — تفتقد الجداول: ${missingTables.join(", ")}` });
    }

    const report: Record<string, { restored: number; skipped: number; errors: string[] }> = {
      users: { restored: 0, skipped: 0, errors: [] },
      extracts: { restored: 0, skipped: 0, errors: [] },
      storage: { restored: 0, skipped: 0, errors: [] },
    };

    const adminClerkId = req.clerkUserId;

    for (const userData of (tables.users || [])) {
      try {
        if (!userData.clerkId || !userData.email) { report.users.skipped++; continue; }
        if (userData.clerkId === adminClerkId) { report.users.skipped++; continue; }
        const existing = await db.select({ id: usersTable.id })
          .from(usersTable)
          .where(eq(usersTable.clerkId, userData.clerkId))
          .limit(1);
        if (existing.length > 0) {
          await db.update(usersTable)
            .set({
              name: userData.name,
              email: userData.email,
              role: userData.role,
              status: userData.status,
              phone: userData.phone,
              hospital: userData.hospital,
              jobTitle: userData.jobTitle,
              contractNumber: userData.contractNumber,
              company: userData.company,
              allowedModules: userData.allowedModules,
            })
            .where(eq(usersTable.clerkId, userData.clerkId));
        } else {
          await db.insert(usersTable).values({
            clerkId: userData.clerkId,
            name: userData.name,
            email: userData.email,
            role: userData.role || "user",
            status: userData.status || "pending",
            phone: userData.phone,
            hospital: userData.hospital,
            jobTitle: userData.jobTitle,
            contractNumber: userData.contractNumber,
            company: userData.company,
            allowedModules: userData.allowedModules,
          });
        }
        report.users.restored++;
      } catch (e: any) {
        report.users.errors.push(`${userData.email}: ${e.message}`);
      }
    }

    for (const extractData of (tables.extracts || [])) {
      try {
        if (!extractData.id) { report.extracts.skipped++; continue; }
        const existing = await db.select({ id: submittedExtractsTable.id })
          .from(submittedExtractsTable)
          .where(eq(submittedExtractsTable.id, extractData.id))
          .limit(1);
        if (existing.length > 0) {
          report.extracts.skipped++;
        } else {
          await db.insert(submittedExtractsTable).values({
            userId: extractData.userId,
            hospitalName: extractData.hospitalName,
            extractType: extractData.extractType,
            status: extractData.status || "submitted",
            extractData: extractData.extractData ?? extractData.payload ?? null,
            periodMonth: extractData.periodMonth,
            totalAmount: extractData.totalAmount,
          });
          report.extracts.restored++;
        }
      } catch (e: any) {
        report.extracts.errors.push(`extract#${extractData.id}: ${e.message}`);
      }
    }

    for (const storageData of (tables.storage || [])) {
      try {
        if (!storageData.userId || !storageData.storageKey) { report.storage.skipped++; continue; }
        const existing = await db.select({ id: userStorageTable.id })
          .from(userStorageTable)
          .where(eq(userStorageTable.userId, storageData.userId))
          .limit(1);
        if (existing.length > 0) {
          report.storage.skipped++;
        } else {
          await db.insert(userStorageTable).values({
            userId: storageData.userId,
            storageKey: storageData.storageKey,
            storageValue: storageData.storageValue ?? storageData.value ?? "",
          });
          report.storage.restored++;
        }
      } catch (e: any) {
        report.storage.errors.push(`storage#${storageData.userId}/${storageData.storageKey}: ${e.message}`);
      }
    }

    req.log.info(
      { adminId: req.currentUser.id, backupVersion: meta.version, backupDate: meta.exportedAt, report },
      "System restore completed"
    );

    return res.json({
      success: true,
      backupInfo: {
        version: meta.version,
        exportedAt: meta.exportedAt,
        exportedBy: meta.exportedBy,
      },
      report,
    });
  } catch (err) {
    req.log.error({ err }, "Backup restore failed");
    return res.status(500).json({ error: "فشل في استعادة النسخة الاحتياطية — تحقق من صحة الملف" });
  }
});

/**
 * GET /api/admin/backup/scheduled/latest
 * Returns the latest auto-backup metadata (without full JSON for speed).
 */
router.get("/scheduled/latest", requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    const [latest] = await db
      .select({
        id: scheduledBackupsTable.id,
        createdAt: scheduledBackupsTable.createdAt,
        triggeredBy: scheduledBackupsTable.triggeredBy,
        counts: scheduledBackupsTable.counts,
        emailSent: scheduledBackupsTable.emailSent,
      })
      .from(scheduledBackupsTable)
      .orderBy(desc(scheduledBackupsTable.createdAt))
      .limit(1);

    return res.json({ backup: latest || null });
  } catch (err) {
    req.log.error({ err }, "Failed to get latest scheduled backup");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/admin/backup/scheduled/download
 * Downloads the full JSON of the latest auto-backup.
 */
router.get("/scheduled/download", requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    const [latest] = await db
      .select()
      .from(scheduledBackupsTable)
      .orderBy(desc(scheduledBackupsTable.createdAt))
      .limit(1);

    if (!latest) return res.status(404).json({ error: "لا توجد نسخة احتياطية تلقائية بعد" });

    const parsed = JSON.parse(latest.backupJson);
    return res.json(parsed);
  } catch (err) {
    req.log.error({ err }, "Failed to download scheduled backup");
    return res.status(500).json({ error: "فشل في تحميل النسخة الاحتياطية التلقائية" });
  }
});

/**
 * POST /api/admin/backup/scheduled/trigger
 * Manually trigger a backup now (admin only).
 */
router.post("/scheduled/trigger", requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    const result = await runScheduledBackup("manual");
    req.log.info({ adminId: req.currentUser.id, result }, "Manual backup triggered");
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to trigger manual backup");
    return res.status(500).json({ error: "فشل في إنشاء النسخة الاحتياطية" });
  }
});

/**
 * GET /api/admin/backup/scheduled/list
 * Returns list of last 7 auto-backups (metadata only).
 */
router.get("/scheduled/list", requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    const backups = await db
      .select({
        id: scheduledBackupsTable.id,
        createdAt: scheduledBackupsTable.createdAt,
        triggeredBy: scheduledBackupsTable.triggeredBy,
        counts: scheduledBackupsTable.counts,
        emailSent: scheduledBackupsTable.emailSent,
      })
      .from(scheduledBackupsTable)
      .orderBy(desc(scheduledBackupsTable.createdAt))
      .limit(7);

    return res.json({ backups });
  } catch (err) {
    req.log.error({ err }, "Failed to list scheduled backups");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

