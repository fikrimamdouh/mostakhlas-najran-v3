import { Router } from "express";
import {
  db, usersTable, submittedExtractsTable, userStorageTable,
  auditLogTable, extractRevisionsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";

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

export default router;
