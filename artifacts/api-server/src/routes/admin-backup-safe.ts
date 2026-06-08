import { Router } from "express";
import {
  db,
  usersTable,
  submittedExtractsTable,
  userStorageTable,
  hospitalStorageTable,
  auditLogTable,
  extractRevisionsTable,
  visitRequestsTable,
  systemSettingsTable,
  projectsTable,
  extractsTable,
  scheduledBackupsTable,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

type Report = Record<string, { restored: number; skipped: number; errors: string[] }>;

const requireAdmin = async (req: any, res: any, next: any) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.clerkUserId)).limit(1);
  if (!user || user.role !== "admin") return res.status(403).json({ error: "Admin only" });
  req.currentUser = user;
  next();
};

function section(report: Report, key: string) {
  if (!report[key]) report[key] = { restored: 0, skipped: 0, errors: [] };
  return report[key];
}

function sameHospital(a: any, hospitalName: string) {
  return String(a || "").trim() === String(hospitalName || "").trim();
}

function userBelongsToHospital(user: any, hospitalName: string) {
  if (!user || !hospitalName) return false;
  if (sameHospital(user.hospital, hospitalName)) return true;
  try {
    const arr = JSON.parse(user.hospitals || "[]");
    if (Array.isArray(arr) && arr.some((h) => sameHospital(h, hospitalName))) return true;
  } catch {}
  return false;
}

function makeBackup(metaBy: string, data: any, triggeredBy = "manual") {
  const counts = {
    users: data.users.length,
    extracts: data.extracts.length,
    storageKeys: data.storage.length,
    hospitalStorageKeys: data.hospitalStorage.length,
    auditLogs: data.auditLogs.length,
    revisions: data.revisions.length,
    visits: data.visitRequests.length,
    systemSettings: data.systemSettings.length,
    projects: data.projects.length,
    legacyExtracts: data.legacyExtracts.length,
  };
  return {
    meta: {
      version: "3.0",
      exportedAt: new Date().toISOString(),
      exportedBy: metaBy,
      triggeredBy,
      counts,
      includes: [
        "users",
        "extracts",
        "storage",
        "hospitalStorage",
        "auditLogs",
        "revisions",
        "visitRequests",
        "systemSettings",
        "projects",
        "legacyExtracts",
      ],
    },
    tables: data,
  };
}

async function collectAllBackupData() {
  const [users, extracts, storage, hospitalStorage, auditLogs, revisions, visitRequests, systemSettings, projects, legacyExtracts] = await Promise.all([
    db.select().from(usersTable),
    db.select().from(submittedExtractsTable),
    db.select().from(userStorageTable),
    db.select().from(hospitalStorageTable),
    db.select().from(auditLogTable),
    db.select().from(extractRevisionsTable),
    db.select().from(visitRequestsTable),
    db.select().from(systemSettingsTable),
    db.select().from(projectsTable),
    db.select().from(extractsTable),
  ]);
  return { users, extracts, storage, hospitalStorage, auditLogs, revisions, visitRequests, systemSettings, projects, legacyExtracts };
}

router.get("/full", requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    const data = await collectAllBackupData();
    const backup = makeBackup(req.currentUser.email, data, "download");
    req.log.info({ adminId: req.currentUser.id, counts: backup.meta.counts }, "Complete system backup exported");
    return res.json(backup);
  } catch (err) {
    req.log.error({ err }, "Complete backup export failed");
    return res.status(500).json({ error: "فشل في تصدير النسخة الاحتياطية الشاملة" });
  }
});

router.get("/stats", requireAuth, requireAdmin, async (_req: any, res: any) => {
  try {
    const data = await collectAllBackupData();
    const latestStorage = data.storage.reduce((acc: Record<number, string>, row: any) => {
      const existing = acc[row.userId];
      const value = row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt || "");
      if (!existing || new Date(value) > new Date(existing)) acc[row.userId] = value;
      return acc;
    }, {});
    return res.json({
      exportedAt: new Date().toISOString(),
      counts: makeBackup("stats", data).meta.counts,
      users: data.users.map((u: any) => ({
        ...u,
        storageCount: data.storage.filter((s: any) => s.userId === u.id).length,
        lastSync: latestStorage[u.id] || null,
      })),
      hospitals: Array.from(new Set(data.hospitalStorage.map((r: any) => r.hospitalName).filter(Boolean))).sort(),
      recentExtracts: data.extracts.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10),
    });
  } catch (err) {
    return res.status(500).json({ error: "فشل في جلب إحصائيات النسخ الاحتياطي" });
  }
});

async function restoreUsers(tables: any, report: Report, adminClerkId: string) {
  const r = section(report, "users");
  for (const userData of tables.users || []) {
    try {
      if (!userData.clerkId || !userData.email) { r.skipped++; continue; }
      if (userData.clerkId === adminClerkId) { r.skipped++; continue; }
      const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.clerkId, userData.clerkId)).limit(1);
      const values: any = {
        name: userData.name,
        email: userData.email,
        role: userData.role || "user",
        status: userData.status || "pending",
        phone: userData.phone,
        hospital: userData.hospital,
        hospitals: userData.hospitals,
        jobTitle: userData.jobTitle,
        contractNumber: userData.contractNumber,
        company: userData.company,
        contractCompany: userData.contractCompany,
        supervisedHospital: userData.supervisedHospital,
        allowedModules: userData.allowedModules,
      };
      if (existing) await db.update(usersTable).set(values).where(eq(usersTable.clerkId, userData.clerkId));
      else await db.insert(usersTable).values({ clerkId: userData.clerkId, ...values });
      r.restored++;
    } catch (e: any) { r.errors.push(`${userData.email || userData.id}: ${e.message}`); }
  }
}

async function restoreSubmittedExtracts(rows: any[], report: Report, key = "extracts") {
  const r = section(report, key);
  for (const extractData of rows || []) {
    try {
      if (!extractData.id) { r.skipped++; continue; }
      const [existing] = await db.select({ id: submittedExtractsTable.id }).from(submittedExtractsTable).where(eq(submittedExtractsTable.id, extractData.id)).limit(1);
      if (existing) { r.skipped++; continue; }
      await db.insert(submittedExtractsTable).values({
        id: extractData.id,
        userId: extractData.userId,
        hospitalName: extractData.hospitalName,
        companyName: extractData.companyName,
        contractNumber: extractData.contractNumber,
        extractType: extractData.extractType,
        status: extractData.status || "submitted",
        revisionCount: extractData.revisionCount || 0,
        revisedAt: extractData.revisedAt ? new Date(extractData.revisedAt) : null,
        notes: extractData.notes,
        adminNotes: extractData.adminNotes,
        approvedBy: extractData.approvedBy,
        approvedAt: extractData.approvedAt ? new Date(extractData.approvedAt) : null,
        extractData: extractData.extractData ?? extractData.payload ?? null,
        periodMonth: extractData.periodMonth,
        totalAmount: extractData.totalAmount,
        createdAt: extractData.createdAt ? new Date(extractData.createdAt) : new Date(),
        updatedAt: extractData.updatedAt ? new Date(extractData.updatedAt) : new Date(),
      } as any);
      r.restored++;
    } catch (e: any) { r.errors.push(`extract#${extractData.id}: ${e.message}`); }
  }
}

async function restoreUserStorage(rows: any[], report: Report) {
  const r = section(report, "storage");
  for (const row of rows || []) {
    try {
      if (!row.userId || !row.storageKey) { r.skipped++; continue; }
      const value = row.storageValue ?? row.value ?? "";
      const updatedAt = row.updatedAt ? new Date(row.updatedAt) : new Date();
      await db.insert(userStorageTable).values({ userId: row.userId, storageKey: row.storageKey, storageValue: value, updatedAt })
        .onConflictDoUpdate({ target: [userStorageTable.userId, userStorageTable.storageKey], set: { storageValue: value, updatedAt } });
      r.restored++;
    } catch (e: any) { r.errors.push(`storage#${row.userId}/${row.storageKey}: ${e.message}`); }
  }
}

async function restoreHospitalStorage(rows: any[], report: Report, key = "hospitalStorage") {
  const r = section(report, key);
  for (const row of rows || []) {
    try {
      if (!row.hospitalName || !row.storageKey) { r.skipped++; continue; }
      const value = row.storageValue ?? row.value ?? "";
      const updatedAt = row.updatedAt ? new Date(row.updatedAt) : new Date();
      await db.insert(hospitalStorageTable).values({ hospitalName: row.hospitalName, storageKey: row.storageKey, storageValue: value, updatedAt, updatedByUserId: row.updatedByUserId || null })
        .onConflictDoUpdate({ target: [hospitalStorageTable.hospitalName, hospitalStorageTable.storageKey], set: { storageValue: value, updatedAt, updatedByUserId: row.updatedByUserId || null } });
      r.restored++;
    } catch (e: any) { r.errors.push(`hospitalStorage#${row.hospitalName}/${row.storageKey}: ${e.message}`); }
  }
}

async function restoreSystemSettings(rows: any[], report: Report) {
  const r = section(report, "systemSettings");
  for (const row of rows || []) {
    try {
      if (!row.key) { r.skipped++; continue; }
      await db.insert(systemSettingsTable).values({ key: row.key, value: row.value ?? "", updatedAt: row.updatedAt ? new Date(row.updatedAt) : new Date(), updatedBy: row.updatedBy || null })
        .onConflictDoUpdate({ target: systemSettingsTable.key, set: { value: row.value ?? "", updatedAt: row.updatedAt ? new Date(row.updatedAt) : new Date(), updatedBy: row.updatedBy || null } });
      r.restored++;
    } catch (e: any) { r.errors.push(`setting#${row.key}: ${e.message}`); }
  }
}

async function restoreVisits(rows: any[], report: Report, key = "visitRequests") {
  const r = section(report, key);
  for (const row of rows || []) {
    try {
      if (!row.id) { r.skipped++; continue; }
      const [existing] = await db.select({ id: visitRequestsTable.id }).from(visitRequestsTable).where(eq(visitRequestsTable.id, row.id)).limit(1);
      if (existing) { r.skipped++; continue; }
      await db.insert(visitRequestsTable).values({ ...row, visitDate: row.visitDate ? new Date(row.visitDate) : new Date(), approvedAt: row.approvedAt ? new Date(row.approvedAt) : null, createdAt: row.createdAt ? new Date(row.createdAt) : new Date(), updatedAt: row.updatedAt ? new Date(row.updatedAt) : new Date() } as any);
      r.restored++;
    } catch (e: any) { r.errors.push(`visit#${row.id}: ${e.message}`); }
  }
}

async function saveScheduledBackup(triggeredBy: "manual" | "scheduler", exportedBy: string) {
  const data = await collectAllBackupData();
  const backup = makeBackup(exportedBy, data, triggeredBy);
  const [saved] = await db.insert(scheduledBackupsTable).values({ triggeredBy, counts: backup.meta.counts, backupJson: JSON.stringify(backup), emailSent: false }).returning({ id: scheduledBackupsTable.id });
  const all = await db.select({ id: scheduledBackupsTable.id }).from(scheduledBackupsTable).orderBy(desc(scheduledBackupsTable.createdAt));
  if (all.length > 7) {
    const { inArray } = await import("drizzle-orm");
    const oldIds = all.slice(7).map(b => b.id);
    await db.delete(scheduledBackupsTable).where(inArray(scheduledBackupsTable.id, oldIds) as any);
  }
  return { backup, backupId: saved.id };
}

router.post("/restore", requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    const { confirmation, backup } = req.body;
    if (confirmation !== "تأكيد الاستعادة الكاملة") return res.status(400).json({ error: "يجب تأكيد الاستعادة بكتابة العبارة المطلوبة" });
    if (!backup || typeof backup !== "object" || !backup.meta || !backup.tables) return res.status(400).json({ error: "ملف النسخة الاحتياطية غير صالح" });
    const tables = backup.tables;
    const requiredTables = ["users", "extracts", "storage"];
    const missing = requiredTables.filter((t) => !tables[t]);
    if (missing.length) return res.status(400).json({ error: `النسخة الاحتياطية ناقصة — تفتقد الجداول: ${missing.join(", ")}` });
    const report: Report = {};
    await restoreUsers(tables, report, req.clerkUserId);
    await restoreSubmittedExtracts(tables.extracts || [], report);
    await restoreUserStorage(tables.storage || [], report);
    await restoreHospitalStorage(tables.hospitalStorage || [], report);
    await restoreVisits(tables.visitRequests || [], report);
    await restoreSystemSettings(tables.systemSettings || [], report);
    return res.json({ success: true, backupInfo: { version: backup.meta.version, exportedAt: backup.meta.exportedAt, exportedBy: backup.meta.exportedBy }, report });
  } catch (err) {
    req.log.error({ err }, "Complete restore failed");
    return res.status(500).json({ error: "فشل في استعادة النسخة الاحتياطية" });
  }
});

router.post("/restore/hospital", requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    const { confirmation, backup, hospitalName } = req.body;
    if (confirmation !== "تأكيد استعادة مستشفى") return res.status(400).json({ error: "يجب كتابة عبارة التأكيد المطلوبة" });
    if (!hospitalName || typeof hospitalName !== "string") return res.status(400).json({ error: "يجب اختيار المستشفى" });
    if (!backup || typeof backup !== "object" || !backup.tables) return res.status(400).json({ error: "ملف النسخة الاحتياطية غير صالح" });
    const tables = backup.tables;
    const report: Report = {};
    await restoreHospitalStorage((tables.hospitalStorage || []).filter((r: any) => sameHospital(r.hospitalName, hospitalName)), report, "hospitalStorage");
    await restoreSubmittedExtracts((tables.extracts || []).filter((r: any) => sameHospital(r.hospitalName, hospitalName)), report, "extracts");
    await restoreVisits((tables.visitRequests || []).filter((r: any) => sameHospital(r.submittedByHospital, hospitalName) || sameHospital(r.siteLocation, hospitalName)), report, "visitRequests");
    const hospitalUsers = (tables.users || []).filter((u: any) => userBelongsToHospital(u, hospitalName));
    section(report, "users").skipped += hospitalUsers.length;
    return res.json({ success: true, mode: "hospital", hospitalName, report, note: "تمت استعادة بيانات المستشفى المشتركة والمستخلصات والزيارات فقط. لم يتم تعديل المستخدمين أو الصلاحيات." });
  } catch (err) {
    req.log.error({ err }, "Hospital restore failed");
    return res.status(500).json({ error: "فشل في استعادة بيانات المستشفى" });
  }
});

router.post("/scheduled/trigger", requireAuth, requireAdmin, async (req: any, res: any) => {
  try {
    const saved = await saveScheduledBackup("manual", req.currentUser.email);
    return res.json({ ok: true, backupId: saved.backupId, counts: saved.backup.meta.counts, emailSent: false });
  } catch (err) {
    req.log.error({ err }, "Manual complete backup failed");
    return res.status(500).json({ error: "فشل في إنشاء النسخة الاحتياطية الكاملة" });
  }
});

router.get("/scheduled/download", requireAuth, requireAdmin, async (_req: any, res: any) => {
  try {
    const [latest] = await db.select().from(scheduledBackupsTable).orderBy(desc(scheduledBackupsTable.createdAt)).limit(1);
    if (!latest) return res.status(404).json({ error: "لا توجد نسخة احتياطية بعد" });
    return res.json(JSON.parse(latest.backupJson));
  } catch {
    return res.status(500).json({ error: "فشل في تحميل النسخة الاحتياطية" });
  }
});

router.get("/scheduled/latest", requireAuth, requireAdmin, async (_req: any, res: any) => {
  try {
    const [latest] = await db.select({ id: scheduledBackupsTable.id, createdAt: scheduledBackupsTable.createdAt, triggeredBy: scheduledBackupsTable.triggeredBy, counts: scheduledBackupsTable.counts, emailSent: scheduledBackupsTable.emailSent }).from(scheduledBackupsTable).orderBy(desc(scheduledBackupsTable.createdAt)).limit(1);
    return res.json({ backup: latest || null });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/scheduled/list", requireAuth, requireAdmin, async (_req: any, res: any) => {
  try {
    const backups = await db.select({ id: scheduledBackupsTable.id, createdAt: scheduledBackupsTable.createdAt, triggeredBy: scheduledBackupsTable.triggeredBy, counts: scheduledBackupsTable.counts, emailSent: scheduledBackupsTable.emailSent }).from(scheduledBackupsTable).orderBy(desc(scheduledBackupsTable.createdAt)).limit(7);
    return res.json({ backups });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
