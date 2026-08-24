import { Router } from "express";
import { and, eq } from "drizzle-orm";
import {
  db,
  visitSystemsTable,
  visitContractorsTable,
  visitQualificationsTable,
  visitSiteApprovalsTable,
} from "@workspace/db";
import { requireAuth } from "../middleware/requireAuth";
import { requireClusterVisitManagement } from "../middleware/requireClusterVisitManagement";
import { findCurrentUser } from "../lib/current-user";
import { isValidSaudiMobile } from "../lib/visit-security";
import { logAudit } from "./audit";

const router = Router();

const MAINTENANCE_SITES: Record<string, readonly string[]> = {
  "بيت_العرب": [
    "مستشفى يدمه العام",
    "مستشفى حبونا العام",
    "مستشفى بدر الجنوب العام",
    "مستشفى الولادة والأطفال",
    "مستشفى غرب نجران للولادة والأطفال والعيادات التخصصية",
    "المكاتب الإدارية والمرافق الصحية وصيانة وإصلاح السيارات والعيادات المتنقلة",
    "تجمع نجران الصحي",
  ],
  "سراكو": [
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
};

function cleanText(value: unknown, max = 500): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function numberId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function dayString(value: unknown): string | null {
  const text = cleanText(value, 20);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) return null;
  return text;
}

async function requireApproved(req: any, res: any, next: any) {
  const user = await findCurrentUser(req);
  if (!user) return res.status(401).json({ error: "المستخدم غير مسجل" });
  if (user.status !== "approved") return res.status(403).json({ error: "الحساب غير معتمد" });
  req.currentUser = user;
  return next();
}

async function upsertQualification(tx: any, values: {
  contractorId: number;
  systemId: number;
  validFrom: string;
  validUntil: string;
  notes: string | null;
}) {
  const [existing] = await tx.select().from(visitQualificationsTable).where(and(
    eq(visitQualificationsTable.contractorId, values.contractorId),
    eq(visitQualificationsTable.systemId, values.systemId),
  )).limit(1);

  if (existing) {
    const [updated] = await tx.update(visitQualificationsTable).set({
      validFrom: values.validFrom,
      validUntil: values.validUntil,
      status: "active",
      notes: values.notes,
      updatedAt: new Date(),
    }).where(eq(visitQualificationsTable.id, existing.id)).returning();
    return updated;
  }

  const [created] = await tx.insert(visitQualificationsTable).values({
    contractorId: values.contractorId,
    systemId: values.systemId,
    validFrom: values.validFrom,
    validUntil: values.validUntil,
    status: "active",
    notes: values.notes,
  }).returning();
  return created;
}

async function upsertSiteApproval(tx: any, values: {
  siteName: string;
  contractorId: number;
  systemId: number;
  validFrom: string;
  validUntil: string;
  notes: string | null;
}) {
  const [existing] = await tx.select().from(visitSiteApprovalsTable).where(and(
    eq(visitSiteApprovalsTable.siteName, values.siteName),
    eq(visitSiteApprovalsTable.contractorId, values.contractorId),
    eq(visitSiteApprovalsTable.systemId, values.systemId),
  )).limit(1);

  if (existing) {
    const [updated] = await tx.update(visitSiteApprovalsTable).set({
      validFrom: values.validFrom,
      validUntil: values.validUntil,
      status: "active",
      notes: values.notes,
      updatedAt: new Date(),
    }).where(eq(visitSiteApprovalsTable.id, existing.id)).returning();
    return updated;
  }

  const [created] = await tx.insert(visitSiteApprovalsTable).values({
    siteName: values.siteName,
    contractorId: values.contractorId,
    systemId: values.systemId,
    validFrom: values.validFrom,
    validUntil: values.validUntil,
    status: "active",
    notes: values.notes,
  }).returning();
  return created;
}

// Registered before the legacy visits router. This endpoint intentionally does
// not require company names to start with شركة/مؤسسة/مصنع, and it avoids
// PostgreSQL ON CONFLICT so an older production index cannot turn setup into 500.
router.post("/management/direct-setup", requireAuth, requireApproved, requireClusterVisitManagement, async (req: any, res) => {
  const systemId = numberId(req.body?.systemId);
  const requestedContractorId = numberId(req.body?.contractorId);
  const maintenanceKey = cleanText(req.body?.maintenanceContractorKey, 80);
  const siteName = cleanText(req.body?.siteName, 200);
  const validFrom = dayString(req.body?.validFrom);
  const validUntil = dayString(req.body?.validUntil);
  const companyName = cleanText(req.body?.companyName, 200);
  const contactMobile = cleanText(req.body?.contactMobile, 30);
  const includeQualification = req.body?.includeQualification === true;
  const notes = cleanText(req.body?.notes, 1_000) || null;

  const allowedSites = MAINTENANCE_SITES[maintenanceKey];
  if (!allowedSites || !siteName || !allowedSites.includes(siteName)) {
    return res.status(400).json({ error: "اختر مقاول الصيانة والموقع الصحيحين أولًا" });
  }
  if (!systemId || !validFrom || !validUntil || validUntil < validFrom) {
    return res.status(400).json({ error: "النظام وبداية ونهاية اعتماد الموقع الصحيحة مطلوبة" });
  }
  if (!requestedContractorId && !companyName) {
    return res.status(400).json({ error: "اسم الشركة مطلوب" });
  }
  if (contactMobile && !isValidSaudiMobile(contactMobile)) {
    return res.status(400).json({ error: "رقم جوال الشركة غير صالح" });
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [system] = await tx.select().from(visitSystemsTable).where(and(
        eq(visitSystemsTable.id, systemId),
        eq(visitSystemsTable.isActive, true),
      )).limit(1);
      if (!system) throw new Error("SYSTEM_NOT_FOUND");

      let contractor: any;
      let createdCompany = false;
      if (requestedContractorId) {
        [contractor] = await tx.select().from(visitContractorsTable).where(and(
          eq(visitContractorsTable.id, requestedContractorId),
          eq(visitContractorsTable.isActive, true),
        )).limit(1);
        if (!contractor) throw new Error("CONTRACTOR_NOT_FOUND");
      } else {
        [contractor] = await tx.select().from(visitContractorsTable)
          .where(eq(visitContractorsTable.name, companyName)).limit(1);

        if (contractor) {
          [contractor] = await tx.update(visitContractorsTable).set({
            registrationNumber: cleanText(req.body?.registrationNumber, 100) || contractor.registrationNumber,
            contactName: cleanText(req.body?.contactName, 200) || contractor.contactName,
            contactMobile: contactMobile || contractor.contactMobile,
            isActive: true,
            updatedAt: new Date(),
          }).where(eq(visitContractorsTable.id, contractor.id)).returning();
        } else {
          [contractor] = await tx.insert(visitContractorsTable).values({
            name: companyName,
            registrationNumber: cleanText(req.body?.registrationNumber, 100) || null,
            contactName: cleanText(req.body?.contactName, 200) || null,
            contactMobile: contactMobile || null,
            isActive: true,
            createdByUserId: req.currentUser.id,
          }).returning();
          createdCompany = true;
        }
      }

      const qualification = includeQualification
        ? await upsertQualification(tx, {
            contractorId: contractor.id,
            systemId,
            validFrom,
            validUntil,
            notes: notes || "استكمال يدوي اختياري من الإصدار المباشر",
          })
        : null;

      const siteApproval = await upsertSiteApproval(tx, {
        siteName,
        contractorId: contractor.id,
        systemId,
        validFrom,
        validUntil,
        notes: notes || "اعتماد موقع من الإصدار المباشر",
      });

      return { contractor, qualification, siteApproval, createdCompany };
    });

    // Audit logging is secondary. A logging outage must not make a committed
    // company/site setup look like a failed operation and invite duplicates.
    try {
      await logAudit(
        req.currentUser?.id ?? null,
        req.currentUser?.email ?? null,
        req.currentUser?.name ?? null,
        result.createdCompany ? "إضافة شركة واعتماد موقعها من الإصدار المباشر" : "استكمال اعتماد موقع من الإصدار المباشر",
        JSON.stringify({
          contractorId: result.contractor.id,
          systemId,
          siteName,
          qualificationIncluded: includeQualification,
          validFrom,
          validUntil,
          reusedExistingCompany: !requestedContractorId && !result.createdCompany,
        }),
        req.ip || null,
      );
    } catch (auditError) {
      req.log?.error?.({ err: auditError, contractorId: result.contractor.id }, "Direct setup committed but audit logging failed");
    }

    return res.status(result.createdCompany ? 201 : 200).json({
      contractor: { id: result.contractor.id, name: result.contractor.name },
      qualification: result.qualification,
      siteApproval: result.siteApproval,
      reusedExistingCompany: !requestedContractorId && !result.createdCompany,
    });
  } catch (err: any) {
    if (err?.message === "SYSTEM_NOT_FOUND") return res.status(404).json({ error: "النظام غير موجود أو معطل" });
    if (err?.message === "CONTRACTOR_NOT_FOUND") return res.status(404).json({ error: "الشركة غير موجودة أو معطلة" });
    if (err?.code === "23505") return res.status(409).json({ error: "حدث تعارض أثناء الحفظ؛ حدّث الصفحة وأعد المحاولة" });
    req.log?.error?.({ err }, "Direct company/site setup hotfix failed");
    return res.status(500).json({ error: "تعذر استكمال الشركة واعتماد الموقع" });
  }
});

export default router;
