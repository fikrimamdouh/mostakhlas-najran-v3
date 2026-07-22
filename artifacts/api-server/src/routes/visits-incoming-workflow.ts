import { Router } from "express";
import {
  db,
  visitRequestsTable,
  visitRequestMetadataTable,
  visitSystemsTable,
  visitContractorsTable,
  visitNumberSequencesTable,
  visitPermitTokensTable,
} from "@workspace/db";
import { and, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { requireClusterVisitManagement } from "../middleware/requireClusterVisitManagement";
import { createPermitToken, isValidSaudiMobile, maskIdentity, parseIsoDate } from "../lib/visit-security";
import { logAudit } from "./audit";

const router = Router();
const DEFAULT_VISIT_PURPOSE = "زيارة دورية لأنظمة المستشفى";
const MAINTENANCE_CONTRACTORS = [
  {
    key: "بيت_العرب",
    name: "شركة مجموعة بيت العرب الحديثة المحدودة",
    sites: [
      "مستشفى يدمه العام", "مستشفى حبونا العام", "مستشفى بدر الجنوب العام",
      "مستشفى الولادة والأطفال", "مستشفى غرب نجران للولادة والأطفال والعيادات التخصصية",
      "المكاتب الإدارية والمرافق الصحية وصيانة وإصلاح السيارات والعيادات المتنقلة", "تجمع نجران الصحي",
    ],
  },
  {
    key: "سراكو",
    name: "شركة سراكو",
    sites: [
      "مستشفى نجران العام الجديد", "مركز طب الأسنان التخصصي", "مجمع الأمل للصحة النفسية",
      "مستشفى ثار العام", "مستشفى خباش العام", "المراكز الصحية", "مستشفى الملك خالد",
      "مركز الأمير سلطان", "مستشفى شروره العام",
    ],
  },
] as const;

type AnyDb = typeof db | any;

function cleanText(value: unknown, max = 500): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
}

function numberId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizedDigits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

function dayString(value: unknown): string | null {
  const parsed = parseIsoDate(value);
  return parsed ? parsed.toISOString().slice(0, 10) : null;
}

function clientIp(req: any): string {
  return req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
}

function requireApprovedManager(req: any, res: any, next: any) {
  if (req.currentUser?.status !== "approved") return res.status(403).json({ error: "حساب منفذ الإجراء غير مفعل" });
  return next();
}

function maintenanceByKey(value: unknown) {
  const key = cleanText(value, 80);
  return MAINTENANCE_CONTRACTORS.find((row) => row.key === key) || null;
}

async function getIncomingVisit(executor: AnyDb, id: number) {
  const [row] = await executor.select({ visit: visitRequestsTable, metadata: visitRequestMetadataTable })
    .from(visitRequestsTable)
    .leftJoin(visitRequestMetadataTable, eq(visitRequestMetadataTable.visitId, visitRequestsTable.id))
    .where(eq(visitRequestsTable.id, id)).limit(1);
  return row || null;
}

function pendingVisitError(context: any): string | null {
  if (!context) return "VISIT_NOT_FOUND";
  if (context.visit.archivedAt) return "VISIT_ARCHIVED";
  if (context.visit.status !== "pending") return "VISIT_NOT_PENDING";
  return null;
}

async function nextPermitNumber(executor: AnyDb): Promise<string> {
  const issuedAt = new Date();
  const year = issuedAt.getFullYear();
  const month = String(issuedAt.getMonth() + 1).padStart(2, "0");
  const scopeKey = `${year}-${month}:visits`;
  const [sequence] = await executor.insert(visitNumberSequencesTable).values({ scopeKey, lastValue: 1 })
    .onConflictDoUpdate({
      target: visitNumberSequencesTable.scopeKey,
      set: { lastValue: sql`${visitNumberSequencesTable.lastValue} + 1`, updatedAt: new Date() },
    })
    .returning({ lastValue: visitNumberSequencesTable.lastValue });
  if (!sequence) throw new Error("SERIAL_SEQUENCE_NOT_RETURNED");
  return `NHC-NJ-VIS-${year}-${month}-${String(sequence.lastValue).padStart(5, "0")}`;
}

async function ensurePermitToken(executor: AnyDb, visitId: number) {
  const [existing] = await executor.select().from(visitPermitTokensTable)
    .where(and(eq(visitPermitTokensTable.visitId, visitId), eq(visitPermitTokensTable.status, "active")))
    .orderBy(desc(visitPermitTokensTable.issuedAt)).limit(1);
  if (existing) return existing;
  const generated = createPermitToken();
  const [inserted] = await executor.insert(visitPermitTokensTable).values({
    visitId,
    tokenHash: generated.tokenHash,
    tokenCiphertext: generated.tokenCiphertext,
    status: "active",
  }).onConflictDoNothing().returning();
  if (inserted) return inserted;
  const [concurrent] = await executor.select().from(visitPermitTokensTable)
    .where(and(eq(visitPermitTokensTable.visitId, visitId), eq(visitPermitTokensTable.status, "active")))
    .orderBy(desc(visitPermitTokensTable.issuedAt)).limit(1);
  if (!concurrent) throw new Error("ACTIVE_QR_TOKEN_NOT_AVAILABLE");
  return concurrent;
}

function approvalSnapshot(visit: any, metadata: any | null) {
  return JSON.stringify({
    schemaVersion: 2,
    capturedAt: new Date().toISOString(),
    source: metadata?.linkedAt ? "incoming_linked_approval" : "incoming_unlinked_approval",
    purpose: metadata?.purpose || DEFAULT_VISIT_PURPOSE,
    visit: {
      repName: visit.repName,
      repIdMasked: maskIdentity(visit.repId),
      siteLocation: visit.siteLocation,
      visitDate: visit.visitDate,
      startsAt: metadata?.startsAt || new Date(`${visit.visitDate}T00:00:00.000Z`),
      endsAt: metadata?.endsAt || null,
      systemName: visit.systemName,
      mainContractor: visit.mainContractor,
      subContractor: visit.subContractor,
    },
    references: {
      systemId: metadata?.systemId || null,
      contractorId: metadata?.contractorId || null,
      representativeId: metadata?.representativeId || null,
      siteApprovalId: metadata?.siteApprovalId || null,
      qualificationId: metadata?.qualificationId || null,
    },
    representatives: [{
      id: metadata?.representativeId || null,
      fullName: visit.repName,
      identityNumber: visit.repId,
      mobile: visit.repMobile,
      noResidenceException: false,
      exceptionReason: null,
    }],
    verification: { centrallyLinked: !!metadata?.linkedAt, approvedWithoutLink: !metadata?.linkedAt },
  });
}

router.patch(
  "/management/incoming-visits/:id/edit",
  requireAuth,
  requireClusterVisitManagement,
  requireApprovedManager,
  async (req: any, res) => {
    const id = numberId(req.params.id);
    const maintenance = maintenanceByKey(req.body?.maintenanceContractorKey);
    const siteLocation = cleanText(req.body?.siteLocation, 250);
    const systemId = numberId(req.body?.systemId);
    const contractorId = numberId(req.body?.contractorId);
    const contractorName = contractorId ? "" : cleanText(req.body?.contractorName, 250);
    const repName = cleanText(req.body?.repName, 200);
    const repId = normalizedDigits(req.body?.identityNumber);
    const repMobile = cleanText(req.body?.mobile, 30);
    const visitDate = dayString(req.body?.visitDate);
    if (!id || !maintenance || !maintenance.sites.some((site) => site === siteLocation) || !systemId || (!contractorId && contractorName.length < 2) || !repName || !/^\d{10}$/.test(repId) || !isValidSaudiMobile(repMobile) || !visitDate) {
      return res.status(400).json({ error: "أكمل اسم الزائر والهوية والجوال والموقع والنظام والشركة والتاريخ بصورة صحيحة" });
    }

    const [[system], contractors] = await Promise.all([
      db.select().from(visitSystemsTable).where(eq(visitSystemsTable.id, systemId)).limit(1),
      contractorId ? db.select().from(visitContractorsTable).where(eq(visitContractorsTable.id, contractorId)).limit(1) : Promise.resolve([]),
    ]);
    const contractor = contractors[0];
    if (!system?.isActive) return res.status(400).json({ error: "النظام المحدد غير موجود أو معطل" });
    if (contractorId && !contractor?.isActive) return res.status(400).json({ error: "شركة مقاول الباطن المحددة غير موجودة أو معطلة" });
    const subContractor = contractor ? contractor.name : contractorName;

    const [duplicate] = await db.select({ id: visitRequestsTable.id }).from(visitRequestsTable).where(and(
      ne(visitRequestsTable.id, id),
      eq(visitRequestsTable.repId, repId),
      eq(visitRequestsTable.siteLocation, siteLocation),
      eq(visitRequestsTable.systemName, system.name),
      eq(visitRequestsTable.subContractor, subContractor),
      eq(visitRequestsTable.visitDate, visitDate),
      ne(visitRequestsTable.status, "cancelled"),
      isNull(visitRequestsTable.archivedAt),
    )).limit(1);
    if (duplicate) return res.status(409).json({ error: "يوجد طلب زيارة آخر بنفس الزائر والموقع والنظام والشركة والتاريخ" });

    try {
      const result = await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(${id}, 94023)`);
        const context = await getIncomingVisit(tx, id);
        const stateError = pendingVisitError(context);
        if (stateError) throw new Error(stateError);
        const before = {
          repName: context.visit.repName,
          repIdMasked: maskIdentity(context.visit.repId),
          siteLocation: context.visit.siteLocation,
          visitDate: context.visit.visitDate,
          systemName: context.visit.systemName,
          mainContractor: context.visit.mainContractor,
          subContractor: context.visit.subContractor,
        };
        const [visit] = await tx.update(visitRequestsTable).set({
          repName, repId, repMobile, siteLocation, visitDate,
          systemName: system.name,
          mainContractor: maintenance.name,
          subContractor,
          adminNotes: null,
          updatedAt: new Date(),
        }).where(and(eq(visitRequestsTable.id, id), eq(visitRequestsTable.status, "pending"), isNull(visitRequestsTable.archivedAt))).returning();
        if (!visit) throw new Error("VISIT_NOT_PENDING");
        const metadataValues = {
          systemId,
          contractorId: contractorId || null,
          representativeId: null,
          siteApprovalId: null,
          qualificationId: null,
          purpose: DEFAULT_VISIT_PURPOSE,
          startsAt: new Date(`${visitDate}T00:00:00.000Z`),
          endsAt: null,
          snapshotJson: JSON.stringify({ schemaVersion: 1, source: "management_edited_incoming_request", editedAt: new Date().toISOString() }),
          linkedAt: null,
          linkedByUserId: null,
          updatedAt: new Date(),
        };
        if (context.metadata) await tx.update(visitRequestMetadataTable).set(metadataValues).where(eq(visitRequestMetadataTable.visitId, id));
        else await tx.insert(visitRequestMetadataTable).values({ visitId: id, ...metadataValues });
        return { visit, before };
      });
      await logAudit(
        req.currentUser.id,
        req.currentUser.email || null,
        req.currentUser.name || null,
        "تعديل طلب زيارة وارد قبل الاعتماد",
        JSON.stringify({ visitId: id, before: result.before, after: { repName, repIdMasked: maskIdentity(repId), siteLocation, visitDate, systemName: system.name, mainContractor: maintenance.name, subContractor }, linkReset: true }),
        clientIp(req),
      );
      return res.json({ saved: true, visitId: id, status: result.visit.status });
    } catch (err: any) {
      if (err?.message === "VISIT_NOT_FOUND") return res.status(404).json({ error: "طلب الزيارة غير موجود" });
      if (err?.message === "VISIT_ARCHIVED") return res.status(409).json({ error: "طلب الزيارة محذوف من العرض" });
      if (err?.message === "VISIT_NOT_PENDING") return res.status(409).json({ error: "تم اتخاذ قرار على الطلب بالتزامن؛ حدّث الصفحة" });
      req.log?.error?.({ err, visitId: id }, "Incoming visit edit failed");
      return res.status(500).json({ error: "تعذر حفظ تعديل طلب الزيارة؛ لم يتم اعتبار العملية ناجحة" });
    }
  },
);

router.patch(
  "/management/incoming-visits/:id/approve",
  requireAuth,
  requireClusterVisitManagement,
  requireApprovedManager,
  async (req: any, res) => {
    const id = numberId(req.params.id);
    if (!id) return res.status(400).json({ error: "رقم طلب الزيارة غير صالح" });
    try {
      const result = await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(${id}, 94025)`);
        const context = await getIncomingVisit(tx, id);
        if (!context) throw new Error("VISIT_NOT_FOUND");
        if (context.visit.archivedAt) throw new Error("VISIT_ARCHIVED");
        if (context.visit.status === "approved" && context.visit.serialNumber) {
          return { visit: context.visit, metadata: context.metadata, alreadyApproved: true };
        }
        if (context.visit.status !== "pending") throw new Error("VISIT_NOT_PENDING");
        const repId = normalizedDigits(context.visit.repId);
        const visitDate = dayString(context.visit.visitDate);
        if (!cleanText(context.visit.repName, 200) || !/^\d{10}$/.test(repId) || !isValidSaudiMobile(context.visit.repMobile) || !cleanText(context.visit.siteLocation, 250) || !cleanText(context.visit.systemName, 250) || !cleanText(context.visit.mainContractor, 250) || !cleanText(context.visit.subContractor, 250) || !visitDate) {
          throw new Error("INCOMING_DATA_INCOMPLETE");
        }
        const approvedAt = new Date();
        const serialNumber = context.visit.serialNumber || await nextPermitNumber(tx);
        const startsAt = context.metadata?.startsAt || new Date(`${visitDate}T00:00:00.000Z`);
        const metadataValues = {
          systemId: context.metadata?.systemId || null,
          contractorId: context.metadata?.contractorId || null,
          representativeId: context.metadata?.representativeId || null,
          siteApprovalId: context.metadata?.siteApprovalId || null,
          qualificationId: context.metadata?.qualificationId || null,
          purpose: context.metadata?.purpose || DEFAULT_VISIT_PURPOSE,
          startsAt,
          endsAt: context.metadata?.endsAt || null,
          snapshotJson: approvalSnapshot(context.visit, { ...context.metadata, startsAt }),
          linkedAt: context.metadata?.linkedAt || null,
          linkedByUserId: context.metadata?.linkedByUserId || null,
          updatedAt: approvedAt,
        };
        if (context.metadata) await tx.update(visitRequestMetadataTable).set(metadataValues).where(eq(visitRequestMetadataTable.visitId, id));
        else await tx.insert(visitRequestMetadataTable).values({ visitId: id, ...metadataValues });
        const [visit] = await tx.update(visitRequestsTable).set({
          status: "approved",
          serialNumber,
          approvedAt,
          adminNotes: null,
          updatedAt: approvedAt,
        }).where(and(eq(visitRequestsTable.id, id), eq(visitRequestsTable.status, "pending"), isNull(visitRequestsTable.archivedAt))).returning();
        if (!visit) throw new Error("VISIT_NOT_PENDING");
        await ensurePermitToken(tx, id);
        return { visit, metadata: metadataValues, alreadyApproved: false };
      });
      await logAudit(
        req.currentUser.id,
        req.currentUser.email || null,
        req.currentUser.name || null,
        result.alreadyApproved ? "تجاهل اعتماد مكرر لطلب زيارة وارد" : "اعتماد طلب زيارة وارد وإصدار تصريح مستقل عن الربط",
        JSON.stringify({ visitId: id, serialNumber: result.visit.serialNumber, linked: !!result.metadata?.linkedAt, alreadyApproved: result.alreadyApproved }),
        clientIp(req),
      );
      return res.json({
        approved: true,
        alreadyApproved: result.alreadyApproved,
        visit: {
          id: result.visit.id,
          status: result.visit.status,
          serialNumber: result.visit.serialNumber,
          approvedAt: result.visit.approvedAt,
          linked: !!result.metadata?.linkedAt,
        },
      });
    } catch (err: any) {
      const messages: Record<string, string> = {
        VISIT_NOT_FOUND: "طلب الزيارة غير موجود",
        VISIT_ARCHIVED: "طلب الزيارة محذوف من العرض",
        VISIT_NOT_PENDING: "لا يمكن اعتماد طلب مرفوض أو ملغى؛ أعده للمراجعة أولًا",
        INCOMING_DATA_INCOMPLETE: "بيانات الطلب الحالية غير مكتملة؛ استخدم زر تعديل قبل الاعتماد",
      };
      const message = messages[String(err?.message || "")];
      if (message) return res.status(err?.message === "VISIT_NOT_FOUND" ? 404 : 409).json({ error: message, code: err.message });
      req.log?.error?.({ err, visitId: id }, "Incoming visit independent approval failed");
      return res.status(500).json({ error: "تعذر اعتماد طلب الزيارة؛ لم يتم إصدار رقم تصريح" });
    }
  },
);

export default router;
