import { Router } from "express";
import {
  db,
  visitSystemsTable,
  visitContractorsTable,
  visitQualificationsTable,
  visitSiteApprovalsTable,
  visitRepresentativesTable,
  visitRepresentativeSystemsTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { isDateWithin, maskIdentity, parseIsoDate } from "../lib/visit-security";

const router = Router();

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

router.get("/public/representatives", async (req: any, res) => {
  const siteLocation = cleanText(req.query?.siteLocation, 200);
  const systemId = numberId(req.query?.systemId);
  const contractorId = numberId(req.query?.contractorId);
  const visitDate = dayString(req.query?.visitDate);
  const visitDay = visitDate ? parseIsoDate(visitDate) : null;

  if (!siteLocation || !systemId || !contractorId || !visitDate || !visitDay) {
    return res.status(400).json({ error: "اختر الموقع والتاريخ والنظام والشركة أولًا" });
  }

  try {
    const [systems, contractors, approvals, qualifications, representatives, links] = await Promise.all([
      db.select().from(visitSystemsTable).where(eq(visitSystemsTable.id, systemId)).limit(1),
      db.select().from(visitContractorsTable).where(eq(visitContractorsTable.id, contractorId)).limit(1),
      db.select().from(visitSiteApprovalsTable).where(and(
        eq(visitSiteApprovalsTable.siteName, siteLocation),
        eq(visitSiteApprovalsTable.systemId, systemId),
        eq(visitSiteApprovalsTable.contractorId, contractorId),
        eq(visitSiteApprovalsTable.status, "active"),
      )).limit(1),
      db.select().from(visitQualificationsTable).where(and(
        eq(visitQualificationsTable.systemId, systemId),
        eq(visitQualificationsTable.contractorId, contractorId),
        eq(visitQualificationsTable.status, "active"),
      )).limit(1),
      db.select({
        id: visitRepresentativesTable.id,
        fullName: visitRepresentativesTable.fullName,
        identityNumber: visitRepresentativesTable.identityNumber,
        isActive: visitRepresentativesTable.isActive,
      }).from(visitRepresentativesTable).where(and(
        eq(visitRepresentativesTable.contractorId, contractorId),
        eq(visitRepresentativesTable.isActive, true),
      )),
      db.select({ representativeId: visitRepresentativeSystemsTable.representativeId })
        .from(visitRepresentativeSystemsTable)
        .where(and(
          eq(visitRepresentativeSystemsTable.systemId, systemId),
          eq(visitRepresentativeSystemsTable.isActive, true),
        )),
    ]);

    const system = systems[0];
    const contractor = contractors[0];
    const approval = approvals[0];
    const qualification = qualifications[0];

    if (!system?.isActive || !contractor?.isActive || !approval || !qualification
      || !isDateWithin(visitDay, approval.validFrom, approval.validUntil)
      || !isDateWithin(visitDay, qualification.validFrom, qualification.validUntil)) {
      res.setHeader("Cache-Control", "no-store");
      return res.json({ representatives: [] });
    }

    const linkedIds = new Set(links.map((row) => row.representativeId));
    const rows = representatives
      .filter((row) => row.isActive && linkedIds.has(row.id))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, "ar"))
      .map((row) => ({
        id: row.id,
        fullName: row.fullName,
        identityMasked: maskIdentity(row.identityNumber),
      }));

    res.setHeader("Cache-Control", "no-store");
    return res.json({ representatives: rows });
  } catch (err) {
    req.log.error({ err }, "Failed to load public approved representatives");
    return res.status(500).json({ error: "تعذر تحميل المندوبين المعتمدين" });
  }
});

export default router;
