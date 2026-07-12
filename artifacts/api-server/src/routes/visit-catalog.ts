import { Router } from "express";
import {
  db,
  usersTable,
  visitSystemsTable,
  visitContractorsTable,
  visitSiteApprovalsTable,
  visitRepresentativesTable,
  visitRepresentativeSystemsTable,
  visitDocumentsTable,
} from "@workspace/db";
import { requireAuth } from "../middleware/requireAuth";
import { and, eq, inArray } from "drizzle-orm";

const router = Router();
const VISIT_MANAGER_EMAIL = "rorofikri@gmail.com";

const requireApproved = async (req: any, res: any, next: any) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.clerkUserId)).limit(1);
  if (!user) return res.status(401).json({ error: "User not registered" });
  if (user.status !== "approved" && user.role !== "admin") return res.status(403).json({ error: "Account pending approval" });
  req.currentUser = user;
  next();
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

router.get("/", requireAuth, requireApproved, async (req: any, res) => {
  const isManager = String(req.currentUser.email || "").toLowerCase() === VISIT_MANAGER_EMAIL;
  const requestedSite = String(req.query.site || "").trim();
  const site = isManager ? requestedSite : String(req.currentUser.hospital || requestedSite || "").trim();
  if (!site) return res.json({ site: "", systems: [], contractors: [], approvals: [], representatives: [], representativeSystems: [] });

  const rawApprovals = await db.select().from(visitSiteApprovalsTable).where(and(
    eq(visitSiteApprovalsTable.hospitalName, site),
    eq(visitSiteApprovalsTable.status, "approved"),
  ));
  const today = todayIso();
  const approvals = rawApprovals.filter((a) => (!a.validFrom || a.validFrom <= today) && (!a.validTo || a.validTo >= today));
  const systemIds = Array.from(new Set(approvals.map((a) => a.systemId)));
  const contractorIds = Array.from(new Set(approvals.map((a) => a.contractorId)));

  if (!systemIds.length || !contractorIds.length) {
    return res.json({ site, systems: [], contractors: [], approvals: [], representatives: [], representativeSystems: [] });
  }

  const [systems, contractors, representatives, representativeSystems, iqamaDocs] = await Promise.all([
    db.select().from(visitSystemsTable).where(and(inArray(visitSystemsTable.id, systemIds), eq(visitSystemsTable.isActive, true))),
    db.select().from(visitContractorsTable).where(and(inArray(visitContractorsTable.id, contractorIds), eq(visitContractorsTable.status, "active"))),
    db.select({
      id: visitRepresentativesTable.id,
      contractorId: visitRepresentativesTable.contractorId,
      fullName: visitRepresentativesTable.fullName,
      nationalId: visitRepresentativesTable.nationalId,
      mobile: visitRepresentativesTable.mobile,
      jobTitle: visitRepresentativesTable.jobTitle,
      idExpiry: visitRepresentativesTable.idExpiry,
      status: visitRepresentativesTable.status,
    }).from(visitRepresentativesTable).where(and(
      inArray(visitRepresentativesTable.contractorId, contractorIds),
      eq(visitRepresentativesTable.status, "active"),
    )),
    db.select().from(visitRepresentativeSystemsTable),
    db.select({ ownerId: visitDocumentsTable.ownerId }).from(visitDocumentsTable).where(and(
      eq(visitDocumentsTable.ownerType, "representative"),
      eq(visitDocumentsTable.isActive, true),
      inArray(visitDocumentsTable.documentType, ["iqama_front", "iqama_back", "iqama_pdf"]),
    )),
  ]);

  const iqamaSet = new Set(iqamaDocs.map((d) => d.ownerId));
  return res.json({
    site,
    systems,
    contractors,
    approvals,
    representatives: representatives.map((r) => ({ ...r, hasIqama: iqamaSet.has(r.id) })),
    representativeSystems: representativeSystems.filter((x) => systemIds.includes(x.systemId)),
  });
});

export default router;
