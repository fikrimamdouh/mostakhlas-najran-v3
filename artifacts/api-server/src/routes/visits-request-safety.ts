import { Router } from "express";
import {
  db,
  systemSettingsTable,
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
import { requireClusterVisitManagement } from "../middleware/requireClusterVisitManagement";
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
const DEFERRED_VISIT_REASONS = [
  { code: "site_not_ready", label: "الموقع غير جاهز لاستقبال الزيارة" },
  { code: "operational_conflict", label: "تعارض مع أعمال أو تشغيل داخل الموقع" },
  { code: "access_unavailable", label: "تعذر توفير الدخول أو التصاريح اللازمة" },
  { code: "safety_emergency", label: "حالة طارئة أو متطلبات سلامة بالموقع" },
  { code: "coordination_incomplete", label: "عدم اكتمال التنسيق مع الجهة المختصة" },
  { code: "site_request", label: "طلب إدارة الموقع تغيير الموعد" },
  { code: "other", label: "سبب آخر" },
] as const;
const PUBLIC_REQUEST_POLICY_KEY = "visit_public_require_approved_representative_v1";
const PUBLIC_REQUEST_RATE_LIMIT = 6;
const publicVisitRequestRate = new Map<string, number[]>();
const MAINTENANCE_CONTRACTORS = [
  {
    key: "بيت_العرب",
    name: "شركة مجموعة بيت العرب الحديثة المحدودة",
    sites: [
      "مستشفى يدمه العام",
      "مستشفى حبونا العام",
      "مستشفى بدر الجنوب العام",
      "مستشفى الولادة والأطفال",
      "مستشفى غرب نجران للولادة والأطفال والعيادات التخصصية",
      "المكاتب الإدارية والمرافق الصحية وصيانة وإصلاح السيارات والعيادات المتنقلة",
      "تجمع نجران الصحي",
    ],
  },
  {
    key: "سراكو",
    name: "شركة سراكو",
    sites: [
      "مستشفى نجران العام الجديد",
      "مركز طب الأسنان التخصصي",
      "مجمع الأمل للصحة النفسية",
      "مستشفى ثار العام",
      "مستشفى خباش العام",
      "المراكز الصحية",
      "مستشفى الملك خالد",
      "مركز الأمير سلطان",
      "مستشفى شروره العام",
    ],
  },
] as const;

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

function normalizedDigits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

function clientIp(req: any): string {
  return req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
}

function maintenanceContractor(value: unknown) {
  const key = cleanText(value, 80);
  return MAINTENANCE_CONTRACTORS.find((row) => row.key === key) || null;
}

function assertPublicVisitRequestRate(req: any, res: any): boolean {
  const key = clientIp(req);
  const now = Date.now();
  const recent = (publicVisitRequestRate.get(key) || []).filter((at) => now - at < 60_000);
  if (recent.length >= PUBLIC_REQUEST_RATE_LIMIT) {
    res.setHeader("Retry-After", "60");
    res.status(429).json({ error: "تم تجاوز عدد طلبات الزيارة المسموح؛ حاول بعد دقيقة" });
    return false;
  }
  recent.push(now);
  publicVisitRequestRate.set(key, recent);
  if (publicVisitRequestRate.size > 2_000) {
    for (const [candidate, times] of publicVisitRequestRate) {
      if (!times.some((at) => now - at < 60_000)) publicVisitRequestRate.delete(candidate);
    }
  }
  return true;
}

async function requireApproved(req: any, res: any, next: any) {
  const user = await findCurrentUser(req);
  if (!user) return res.status(401).json({ error: "المستخدم غير مسجل", code: "AUTH_USER_NOT_FOUND" });
  if (user.status !== "approved") return res.status(403).json({ error: "الحساب غير معتمد" });
  req.currentUser = user;
  return next();
}

async function publicRequestRequiresApprovedRepresentative(): Promise<boolean> {
  const [setting] = await db.select({ value: systemSettingsTable.value })
    .from(systemSettingsTable)
    .where(eq(systemSettingsTable.key, PUBLIC_REQUEST_POLICY_KEY))
    .limit(1);
  return setting?.value === "1";
}

async function savePublicRequestPolicy(enabled: boolean, updatedBy: string): Promise<void> {
  await db.insert(systemSettingsTable).values({
    key: PUBLIC_REQUEST_POLICY_KEY,
    value: enabled ? "1" : "0",
    updatedBy,
  }).onConflictDoUpdate({
    target: systemSettingsTable.key,
    set: { value: enabled ? "1" : "0", updatedBy, updatedAt: new Date() },
  });
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

router.get("/public/request-policy", async (_req, res) => {
  try {
    const requireApprovedRepresentative = await publicRequestRequiresApprovedRepresentative();
    res.setHeader("Cache-Control", "no-store");
    return res.json({ requireApprovedRepresentative });
  } catch (err) {
    return res.status(503).json({ error: "تعذر تحميل سياسة التحقق من طلب الزيارة" });
  }
});

router.get("/management/public-request-policy", requireAuth, requireApproved, requireClusterVisitManagement, async (_req: any, res) => {
  try {
    const requireApprovedRepresentative = await publicRequestRequiresApprovedRepresentative();
    res.setHeader("Cache-Control", "no-store");
    return res.json({ requireApprovedRepresentative });
  } catch (err) {
    return res.status(503).json({ error: "تعذر تحميل إعداد التحقق من طلبات الزيارة" });
  }
});

router.post("/management/public-request-policy", requireAuth, requireApproved, requireClusterVisitManagement, async (req: any, res) => {
  const requireApprovedRepresentative = req.body?.requireApprovedRepresentative;
  if (typeof requireApprovedRepresentative !== "boolean") {
    return res.status(400).json({ error: "قيمة إعداد التحقق غير صالحة" });
  }
  try {
    await savePublicRequestPolicy(requireApprovedRepresentative, req.currentUser.email || req.currentUser.name || "visit-center");
    await logAudit(
      req.currentUser.id,
      req.currentUser.email,
      req.currentUser.name,
      requireApprovedRepresentative ? "تفعيل المطابقة الإلزامية لطلبات الزيارة العامة" : "إيقاف المطابقة الإلزامية لطلبات الزيارة العامة",
      JSON.stringify({ requireApprovedRepresentative }),
      clientIp(req),
    );
    return res.json({ success: true, requireApprovedRepresentative });
  } catch (err) {
    req.log.error({ err }, "Failed to update public visit request policy");
    return res.status(500).json({ error: "تعذر حفظ إعداد التحقق من طلبات الزيارة" });
  }
});

// This route is mounted before the legacy visits router. When strict matching is
// enabled it deliberately yields to the existing approved-representative flow.
// When disabled it accepts the visitor's typed identity details while still
// validating the site, system, subcontractor and qualification on the server.
router.post("/public/requests", async (req: any, res, next) => {
  let requireApprovedRepresentative: boolean;
  try {
    requireApprovedRepresentative = await publicRequestRequiresApprovedRepresentative();
  } catch (err) {
    req.log.error({ err }, "Failed to read public visit request policy");
    return res.status(503).json({ error: "تعذر التحقق من إعداد طلب الزيارة؛ لم يتم حفظ الطلب" });
  }
  if (requireApprovedRepresentative) return next();
  if (!assertPublicVisitRequestRate(req, res)) return;

  const body = req.body || {};
  if (cleanText(body.website, 200)) return res.status(400).json({ error: "تعذر قبول الطلب" });

  const maintenance = maintenanceContractor(body.maintenanceContractorKey);
  const siteLocation = cleanText(body.siteLocation, 200);
  const systemId = numberId(body.systemId);
  const contractorId = numberId(body.contractorId);
  const unlistedContractorName = contractorId ? "" : cleanText(body.contractorName, 250);
  const repId = normalizedDigits(body.identityNumber);
  const repMobile = cleanText(body.mobile, 30);
  const repName = cleanText(body.fullName, 200);
  const visitDate = dayString(body.visitDate);
  if (!maintenance || !maintenance.sites.some((site) => site === siteLocation) || !systemId || (!contractorId && unlistedContractorName.length < 2) || !/^\d{10}$/.test(repId) || !isValidSaudiMobile(repMobile) || !repName || !visitDate) {
    return res.status(400).json({ error: "أكمل بيانات الموقع والنظام والشركة والاسم والهوية والجوال وتاريخ الزيارة بصورة صحيحة" });
  }
  const visitDay = parseIsoDate(visitDate);
  if (!visitDay) return res.status(400).json({ error: "تاريخ الزيارة غير صالح" });

  try {
    const [systems, contractors, approvals, qualifications] = await Promise.all([
      db.select().from(visitSystemsTable).where(eq(visitSystemsTable.id, systemId)).limit(1),
      contractorId ? db.select().from(visitContractorsTable).where(eq(visitContractorsTable.id, contractorId)).limit(1) : Promise.resolve([]),
      contractorId ? db.select().from(visitSiteApprovalsTable).where(and(
        eq(visitSiteApprovalsTable.siteName, siteLocation),
        eq(visitSiteApprovalsTable.systemId, systemId),
        eq(visitSiteApprovalsTable.contractorId, contractorId),
        eq(visitSiteApprovalsTable.status, "active"),
      )).limit(1) : Promise.resolve([]),
      contractorId ? db.select().from(visitQualificationsTable).where(and(
        eq(visitQualificationsTable.systemId, systemId),
        eq(visitQualificationsTable.contractorId, contractorId),
        eq(visitQualificationsTable.status, "active"),
      )).limit(1) : Promise.resolve([]),
    ]);
    const system = systems[0];
    const contractor = contractors[0];
    const approval = approvals[0];
    const qualification = qualifications[0];
    if (!system || !system.isActive) {
      return res.status(400).json({ error: "النظام المحدد غير متاح" });
    }
    if (contractorId && (!contractor || !approval || !qualification || !contractor.isActive
      || !isDateWithin(visitDay, approval.validFrom, approval.validUntil)
      || !isDateWithin(visitDay, qualification.validFrom, qualification.validUntil))) {
      return res.status(400).json({ error: "الموقع أو النظام أو شركة مقاول الباطن غير معتمدة في التاريخ المحدد" });
    }

    const systemName = cleanText(system.name, 250);
    const subContractor = contractorId ? cleanText(contractor.name, 250) : unlistedContractorName;
    const mainContractor = maintenance.name;
    const dedupeKey = [repId, siteLocation, systemName, subContractor, visitDate]
      .map((value) => value.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("ar"))
      .join("|");
    const result = await db.transaction(async (tx) => {
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
        userId: null,
        repName,
        repId,
        repMobile,
        siteLocation,
        visitDate,
        systemName,
        mainContractor,
        subContractor,
        status: "pending",
        submittedByName: "نموذج طلب زيارة العام — إدخال يدوي",
        submittedByHospital: siteLocation,
        submittedByContract: contractorId ? "PUBLIC_SITE_QR_MANUAL" : "PUBLIC_SITE_QR_MANUAL_UNLISTED",
      }).returning();
      await tx.insert(visitRequestMetadataTable).values({
        visitId: visit.id,
        systemId,
        contractorId: contractorId || null,
        siteApprovalId: approval ? approval.id : null,
        qualificationId: qualification ? qualification.id : null,
        purpose: DEFAULT_VISIT_PURPOSE,
        startsAt: new Date(`${visitDate}T00:00:00.000Z`),
        endsAt: null,
        snapshotJson: JSON.stringify({ schemaVersion: 1, source: contractorId ? "public_manual_request" : "public_manual_request_unlisted_contractor", verificationMode: "manual_review", unlistedContractorName: contractorId ? undefined : unlistedContractorName }),
        linkedAt: null,
      });
      await ensurePermitToken(tx, visit.id);
      return { visit, duplicate: false };
    });

    await logAudit(
      null,
      null,
      "نموذج طلب زيارة العام",
      result.duplicate ? "منع تكرار طلب زيارة عام بإدخال يدوي" : "إنشاء طلب زيارة عام بإدخال يدوي",
      JSON.stringify({ visitId: result.visit.id, siteLocation, systemName, subContractor, duplicate: result.duplicate, verificationMode: "manual_review" }),
      clientIp(req),
    );
    if (!result.duplicate) {
      sendVisitNewRequestEmail(ADMIN_EMAIL, {
        repName,
        siteLocation,
        systemName,
        mainContractor,
        subContractor,
        visitDate,
        submittedByName: "نموذج طلب زيارة العام — إدخال يدوي",
        submittedByHospital: siteLocation,
      }).catch((err) => req.log.error({ err }, "Failed to send manual public visit request email"));
    }
    return res.status(result.duplicate ? 200 : 201).json({
      success: true,
      duplicate: result.duplicate,
      requestNumber: `VIS-${result.visit.id}`,
      status: result.visit.status,
      verificationMode: "manual_review",
    });
  } catch (err) {
    req.log.error({ err }, "Manual public visit request failed");
    return res.status(500).json({ error: "تعذر حفظ طلب الزيارة؛ لم يتم اعتبار العملية ناجحة" });
  }
});

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

  const requestType = body.requestType === "deferred" ? "deferred" : "new";
  const postponementReasonCode = cleanText(body.postponementReasonCode, 80);
  const postponementReasonDetails = cleanText(body.postponementReasonDetails, 1_000);
  const postponementReason = DEFERRED_VISIT_REASONS.find(
    (reason) => reason.code === postponementReasonCode,
  );

  if (requestType === "deferred" && !postponementReason) {
    return res.status(400).json({ error: "اختر سببًا صحيحًا للزيارة المؤجلة" });
  }
  if (requestType === "deferred" && postponementReasonCode === "other" && !postponementReasonDetails) {
    return res.status(400).json({ error: "تفاصيل سبب التأجيل مطلوبة عند اختيار سبب آخر" });
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
  const dedupeKey = [requestType, repId, siteLocation, systemName, subContractor, visitDate]
    .map((value) => value.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("ar"))
    .join("|");

  try {
    const result = await db.transaction(async (tx) => {
      // Serialises equal requests across tabs, retries and server instances.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${dedupeKey}, 0))`);
      const existingRows = await tx
        .select({
          visit: visitRequestsTable,
          metadata: visitRequestMetadataTable,
        })
        .from(visitRequestsTable)
        .innerJoin(
          visitRequestMetadataTable,
          eq(visitRequestMetadataTable.visitId, visitRequestsTable.id),
        )
        .where(and(
          eq(visitRequestsTable.repId, repId),
          eq(visitRequestsTable.siteLocation, siteLocation),
          eq(visitRequestsTable.systemName, systemName),
          eq(visitRequestsTable.subContractor, subContractor),
          eq(visitRequestsTable.visitDate, visitDate),
          ne(visitRequestsTable.status, "cancelled"),
          isNull(visitRequestsTable.archivedAt),
        ))
        .orderBy(desc(visitRequestsTable.createdAt))
        .limit(10);

      const existing = existingRows.find((row) => {
        try {
          const snapshot = JSON.parse(String(row.metadata.snapshotJson || "null"));
          const existingRequestType = snapshot?.requestType === "deferred" ? "deferred" : "new";
          return existingRequestType === requestType;
        } catch {
          return requestType === "new";
        }
      });

      if (existing) return { visit: existing.visit, duplicate: true };

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
        submittedByName: requestType === "deferred"
          ? `${req.currentUser.name} — طلب زيارة مؤجلة`
          : req.currentUser.name,
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
        snapshotJson: JSON.stringify({
          schemaVersion: 1,
          requestType,
          deferredVisit: requestType === "deferred"
            ? {
                reasonCode: postponementReason!.code,
                reasonLabel: postponementReason!.label,
                reasonDetails: postponementReasonDetails || null,
              }
            : null,
        }),
        linkedAt: new Date(),
        linkedByUserId: req.currentUser.id,
      });
      await ensurePermitToken(tx, visit.id);
      return { visit, duplicate: false };
    });

    if (result.duplicate) {
      await logAudit(
        req.currentUser.id,
        req.currentUser.email,
        req.currentUser.name,
        requestType === "deferred" ? "منع تكرار طلب زيارة مؤجلة" : "منع تكرار طلب زيارة مقاول باطن",
        JSON.stringify({ visitId: result.visit.id, requestType, repIdMasked: maskIdentity(repId), siteLocation, systemName, visitDate }),
        clientIp(req),
      );
      return res.status(200).json({
        visit: responseVisit(result.visit, window.startsAt, window.endsAt),
        duplicate: true,
        code: "VISIT_ALREADY_EXISTS",
        requestType,
      });
    }

    await logAudit(
      req.currentUser.id,
      req.currentUser.email,
      req.currentUser.name,
      requestType === "deferred" ? "إنشاء طلب زيارة مؤجلة" : "إنشاء طلب زيارة مقاول باطن",
      JSON.stringify({ visitId: result.visit.id, requestType, centralLinked: true, siteLocation, systemName }),
      clientIp(req),
    );
    sendVisitNewRequestEmail(ADMIN_EMAIL, {
      repName,
      siteLocation,
      systemName,
      mainContractor,
      subContractor,
      visitDate,
      submittedByName: requestType === "deferred"
        ? `${req.currentUser.name} — طلب زيارة مؤجلة`
        : req.currentUser.name,
      submittedByHospital: req.currentUser.hospital || null,
    }).catch((err) => req.log.error({ err }, "Failed to send visit request email"));
    return res.status(201).json({
      visit: responseVisit(result.visit, window.startsAt, window.endsAt),
      duplicate: false,
      requestType,
    });
  } catch (err: any) {
    req.log.error({ err }, "Safe visit request creation failed");
    return res.status(500).json({ error: "تعذر حفظ طلب الزيارة؛ لم يتم اعتبار العملية ناجحة", code: "VISIT_SAVE_FAILED" });
  }
});

export default router;
