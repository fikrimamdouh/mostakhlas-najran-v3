import { Router } from "express";
import {
  db,
  visitRequestsTable,
  visitSystemsTable,
  visitContractorsTable,
  visitQualificationsTable,
  visitSiteApprovalsTable,
  visitRepresentativesTable,
  visitRepresentativeSystemsTable,
  visitRequestMetadataTable,
  visitPermitTokensTable,
} from "@workspace/db";
import { and, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { findCurrentUser } from "../lib/current-user";
import { logAudit } from "./audit";
import { sendVisitNewRequestEmail } from "../lib/email";
import {
  createPermitToken,
  isDateWithin,
  isValidSaudiMobile,
  maskIdentity,
  parseIsoDate,
  validateVisitWindow,
} from "../lib/visit-security";

const router = Router();
const ADMIN_EMAIL = "rorofikri@gmail.com";
const DEFAULT_VISIT_PURPOSE = "زيارة دورية لأنظمة المستشفى";

type AnyDb = typeof db | any;

function cleanText(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function numberId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function dayString(value: unknown): string | null {
  const parsed = parseIsoDate(value);
  return parsed ? parsed.toISOString().slice(0, 10) : null;
}

function clientIp(req: any): string {
  return req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
}

async function requireApproved(req: any, res: any, next: any) {
  const user = await findCurrentUser(req);
  if (!user) return res.status(401).json({ error: "المستخدم غير مسجل", code: "AUTH_USER_NOT_FOUND" });
  if (user.status !== "approved") return res.status(403).json({ error: "الحساب غير معتمد" });
  req.currentUser = user;
  return next();
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

function responseVisit(visit: any, startsAt: Date, endsAt: Date | null) {
  return {
    id: visit.id,
    repName: visit.repName,
    repIdMasked: maskIdentity(visit.repId),
    siteLocation: visit.siteLocation,
    visitDate: visit.visitDate,
    systemName: visit.systemName,
    mainContractor: visit.mainContractor,
    subContractor: visit.subContractor,
    status: visit.status,
    serialNumber: visit.serialNumber,
    approvedAt: visit.approvedAt,
    purpose: DEFAULT_VISIT_PURPOSE,
    startsAt,
    endsAt,
    createdAt: visit.createdAt,
    updatedAt: visit.updatedAt,
  };
}

router.post("/", requireAuth, requireApproved, async (req: any, res, next) => {
  const body = req.body || {};
  const systemId = numberId(body.systemId);
  const contractorId = numberId(body.contractorId);
  const representativeId = numberId(body.representativeId);
  const siteApprovalId = numberId(body.siteApprovalId);
  const qualificationId = numberId(body.qualificationId);

  // Preserve compatibility with any legacy request that does not use the
  // central catalogue; the original visits router remains the fallback.
  if (!systemId && !contractorId && !representativeId && !siteApprovalId && !qualificationId) return next();
  if (!systemId || !contractorId || !representativeId || !siteApprovalId || !qualificationId) {
    return res.status(400).json({ error: "يجب اختيار النظام والشركة والمندوب واعتماد الموقع والتأهيل" });
  }

  const visitDate = dayString(body.visitDate || body.startsAt);
  if (!visitDate) return res.status(400).json({ error: "تاريخ الزيارة غير صالح" });
  const window = validateVisitWindow(body.startsAt || `${visitDate}T00:00:00.000Z`, body.endsAt);
  if ("error" in window) return res.status(400).json({ error: window.error });

  const [systems, contractors, representatives, approvals, qualifications, representativeSystems] = await Promise.all([
    db.select().from(visitSystemsTable).where(eq(visitSystemsTable.id, systemId)).limit(1),
    db.select().from(visitContractorsTable).where(eq(visitContractorsTable.id, contractorId)).limit(1),
    db.select().from(visitRepresentativesTable).where(eq(visitRepresentativesTable.id, representativeId)).limit(1),
    db.select().from(visitSiteApprovalsTable).where(eq(visitSiteApprovalsTable.id, siteApprovalId)).limit(1),
    db.select().from(visitQualificationsTable).where(eq(visitQualificationsTable.id, qualificationId)).limit(1),
    db.select({ id: visitRepresentativeSystemsTable.id }).from(visitRepresentativeSystemsTable).where(and(
      eq(visitRepresentativeSystemsTable.representativeId, representativeId),
      eq(visitRepresentativeSystemsTable.systemId, systemId),
      eq(visitRepresentativeSystemsTable.isActive, true),
    )).limit(1),
  ]);

  const system = systems[0];
  const contractor = contractors[0];
  const representative = representatives[0];
  const approval = approvals[0];
  const qualification = qualifications[0];
  const visitDay = parseIsoDate(visitDate);

  if (!system || !contractor || !representative || !approval || !qualification || !representativeSystems[0] || !visitDay) {
    return res.status(400).json({ error: "أحد مراجع الزيارة المركزية لم يعد متاحًا؛ حدّث الصفحة ثم أعد الاختيار" });
  }
  if (!system.isActive || !contractor.isActive || !representative.isActive) return res.status(409).json({ error: "النظام أو الشركة أو المندوب أصبح معطلًا؛ حدّث الصفحة" });
  if (representative.contractorId !== contractorId) return res.status(400).json({ error: "المندوب لا يتبع شركة مقاول الباطن المحددة" });
  if (!isValidSaudiMobile(representative.mobile)) return res.status(400).json({ error: "رقم جوال المندوب غير صالح" });
  if (representative.noResidenceException && !cleanText(representative.exceptionReason, 1_000)) return res.status(400).json({ error: "سبب الاستثناء بدون إقامة غير مكتمل" });
  if (approval.status !== "active" || approval.siteName !== cleanText(body.siteLocation || req.currentUser.hospital, 200) || approval.systemId !== systemId || approval.contractorId !== contractorId || !isDateWithin(visitDay, approval.validFrom, approval.validUntil)) {
    return res.status(400).json({ error: "اعتماد الموقع غير ساري لهذه الشركة والنظام في تاريخ الزيارة" });
  }
  if (qualification.status !== "active" || qualification.systemId !== systemId || qualification.contractorId !== contractorId || !isDateWithin(visitDay, qualification.validFrom, qualification.validUntil)) {
    return res.status(400).json({ error: "تأهيل الشركة غير ساري للنظام في تاريخ الزيارة" });
  }

  const repName = cleanText(representative.fullName, 200);
  const repId = cleanText(representative.identityNumber, 40);
  const repMobile = cleanText(representative.mobile, 30);
  const siteLocation = cleanText(approval.siteName, 200);
  const systemName = cleanText(system.name, 250);
  const subContractor = cleanText(contractor.name, 250);
  const mainContractor = cleanText(body.mainContractor || req.currentUser.company || "تجمع نجران الصحي", 250);
  const dedupeKey = [repId, siteLocation, systemName, subContractor, visitDate].map((value) => value.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("ar")).join("|");

  try {
    const result = await db.transaction(async (tx) => {
      // Serialises equal requests across tabs, retries and server instances.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${dedupeKey}, 0))`);
      const [existing] = await tx.select().from(visitRequestsTable).where(and(
        eq(visitRequestsTable.repId, repId),
        eq(visitRequestsTable.siteLocation, siteLocation),
        eq(visitRequestsTable.systemName, systemName),
        eq(visitRequestsTable.subContractor, subContractor),
        eq(visitRequestsTable.visitDate, visitDate),
        ne(visitRequestsTable.status, "cancelled"),
        isNull(visitRequestsTable.archivedAt),
      )).orderBy(desc(visitRequestsTable.createdAt)).limit(1);

      if (existing) return { visit: existing, duplicate: true };

      const [visit] = await tx.insert(visitRequestsTable).values({
        userId: req.currentUser.id,
        repName,
        repId,
        repMobile,
        siteLocation,
        visitDate,
        systemName,
        mainContractor,
        subContractor,
        status: "pending",
        submittedByName: req.currentUser.name,
        submittedByHospital: req.currentUser.hospital || siteLocation,
        submittedByContract: req.currentUser.contractNumber || null,
      }).returning();

      await tx.insert(visitRequestMetadataTable).values({
        visitId: visit.id,
        systemId,
        contractorId,
        representativeId,
        siteApprovalId,
        qualificationId,
        purpose: DEFAULT_VISIT_PURPOSE,
        startsAt: window.startsAt,
        endsAt: window.endsAt,
        linkedAt: new Date(),
        linkedByUserId: req.currentUser.id,
      });
      await ensurePermitToken(tx, visit.id);
      return { visit, duplicate: false };
    });

    if (result.duplicate) {
      await logAudit(req.currentUser.id, req.currentUser.email, req.currentUser.name, "منع تكرار طلب زيارة مقاول باطن", JSON.stringify({ visitId: result.visit.id, repIdMasked: maskIdentity(repId), siteLocation, systemName, visitDate }), clientIp(req));
      return res.status(200).json({ visit: responseVisit(result.visit, window.startsAt, window.endsAt), duplicate: true, code: "VISIT_ALREADY_EXISTS" });
    }

    await logAudit(req.currentUser.id, req.currentUser.email, req.currentUser.name, "إنشاء طلب زيارة مقاول باطن", JSON.stringify({ visitId: result.visit.id, centralLinked: true, siteLocation, systemName }), clientIp(req));
    sendVisitNewRequestEmail(ADMIN_EMAIL, { repName, siteLocation, systemName, mainContractor, subContractor, visitDate, submittedByName: req.currentUser.name, submittedByHospital: req.currentUser.hospital || null }).catch((err) => req.log.error({ err }, "Failed to send visit request email"));
    return res.status(201).json({ visit: responseVisit(result.visit, window.startsAt, window.endsAt), duplicate: false });
  } catch (err: any) {
    req.log.error({ err }, "Safe visit request creation failed");
    return res.status(500).json({ error: "تعذر حفظ طلب الزيارة؛ لم يتم اعتبار العملية ناجحة", code: "VISIT_SAVE_FAILED" });
  }
});

export default router;
