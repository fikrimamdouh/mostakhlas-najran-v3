import { Router } from "express";
import { db, usersTable, submittedExtractsTable } from "@workspace/db";
import { requireAuth } from "../middleware/requireAuth";
import { eq, desc } from "drizzle-orm";

const router = Router();
const d = (s: string) => Buffer.from(s, "base64").toString("utf8");

const COMPANY_SITES: Record<string, { sites: string[] }> = {
  [d("2LLZh9ix2KfZhg==")]: {
    sites: [
      d("2YXYs9iq2LTZgdmJINmK2K/ZhdmHINin2YTYudin2YUg4oCUINiy2YfYsdin2YY="),
      d("2YXYs9iq2LTZgdmJINit2KjZiNmG2Kcg2KfZhNi52KfZhSDigJQg2LLZh9ix2KfZhg=="),
      d("2YXYs9iq2LTZgdmJINio2K/YsSDYp9mE2KzZhtmI2Kgg2KfZhNi52KfZhSDigJQg2LLZh9ix2KfZhg=="),
    ],
  },
  [d("2KXZitmF2KfZhg==")]: {
    sites: [
      d("2YXYs9iq2LTZgdmJINin2YTZiNmE2KfYr9ipINmI2KfZhNij2LfZgdin2YQg4oCUINil2YrZhdin2YY="),
      d("2YXYs9iq2LTZgdmJINi62LHYqCDZhtis2LHYp9mGINmE2YTZiNmE2KfYr9ipINmI2KfZhNij2LfZgdin2YQg2YjYp9mE2LnZitin2K/Yp9iqINin2YTYqtiu2LXYtdmK2Kkg4oCUINil2YrZhdin2YY="),
      d("2KfZhNmF2YPYp9iq2Kgg2KfZhNil2K/Yp9ix2YrYqSDZiNin2YTZhdix2KfZgdmCINin2YTYtdit2YrYqSDZiNi12YrYp9mG2Kkg2YjYpdi12YTYp9itINin2YTYs9mK2KfYsdin2Kog2YjYp9mE2LnZitin2K/Yp9iqINin2YTZhdiq2YbZgtmE2Kkg4oCUINil2YrZhdin2YY="),
    ],
  },
  [d("2KjZitiqX9in2YTYudix2Kg=")]: {
    sites: [
      d("2YXYs9iq2LTZgdmJINmK2K/ZhdipINin2YTYudin2YU="),
      d("2YXYs9iq2LTZgdmJINit2KjZiNmG2Kcg2KfZhNi52KfZhQ=="),
      d("2YXYs9iq2LTZgdmJINio2K/YsSDYp9mE2KzZhtmI2Kgg2KfZhNi52KfZhQ=="),
      d("2YXYs9iq2LTZgdmJINin2YTZiNmE2KfYr9ipINmI2KfZhNij2LfZgdin2YQ="),
      d("2YXYs9iq2LTZgdmJINmG2KzYsdin2YYg2KfZhNi52KfZhSDYp9mE2YLYr9mK2YUg2YjYs9mD2YYg2KfZhNmF2YXYsdi22KfYqiDYp9mE2K7Yp9ix2KzZig=="),
      d("2KfZhNmF2YPYp9iq2Kgg2KfZhNil2K/Yp9ix2YrYqSDZiNin2YTZhdix2KfZgdmCINin2YTYtdit2YrYqQ=="),
      d("2LXZitin2YbYqSDZiNil2LXZhNin2K0g2KfZhNiz2YrYp9ix2KfYqiDZiNin2YTYudmK2KfYr9in2Kog2KfZhNmF2KrZhtmC2YTYqQ=="),
    ],
  },
  [d("2LPYsdin2YPZiA==")]: {
    sites: [
      d("2YXYs9iq2LTZgdmJINmG2KzYsdin2YYg2KfZhNi52KfZhSDYp9mE2KzYr9mK2K8="),
      d("2YXYsdmD2LIg2LfYqCDYp9mE2KPYs9mG2KfZhiDYp9mE2KrYrti12LXZig=="),
      d("2YXYrNmF2Lkg2KfZhNij2YXZhCDZhNmE2LXYrdipINin2YTZhtmB2LPZitip"),
      d("2YXYs9iq2LTZgdmJINir2KfYsSDYp9mE2LnYp9mF"),
      d("2YXYs9iq2LTZgdmJINiu2KjYp9i0INin2YTYudin2YU="),
      d("2KfZhNmF2LHYp9mD2LIg2KfZhNi12K3Zitip"),
      d("2YXYs9iq2LTZgdmJINin2YTZhdmE2YMg2K7Yp9mE2K8="),
      d("2YXYsdmD2LIg2KfZhNij2YXZitixINiz2YTYt9in2YY="),
      d("2YXYs9iq2LTZgdmJINi02LHZiNix2Ycg2KfZhNi52KfZhQ=="),
    ],
  },
};

const requireApproved = async (req: any, res: any, next: any) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.clerkUserId)).limit(1);
  if (!user) return res.status(401).json({ error: "User not registered" });
  if (user.status !== "approved" && user.role !== "admin") {
    return res.status(403).json({ error: "Account pending approval" });
  }
  req.currentUser = user;
  next();
};

function parseExtractData(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === "object") return raw as Record<string, any>;
  if (typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function getAdminOfficeMeta(row: any) {
  if (row?.extractType !== "admin_offices") {
    return { adminOfficePart: null, sourceModule: null, reviewScope: null };
  }

  const data = parseExtractData(row.extractData);
  const nestedMeta = parseExtractData(data.najran_admin_offices_submit_meta_v1);
  const adminOfficePart =
    data.adminOfficePart ||
    data.draftPart ||
    data.submittedPart ||
    nestedMeta.submittedPart ||
    nestedMeta.savedPart ||
    (data.adminOfficeConsumables === true ? "consumables" : null) ||
    (data.adminOfficeLabor === true ? "labor" : null) ||
    (data.reviewScope === "admin_offices_consumables_only" ? "consumables" : null) ||
    (data.reviewScope === "admin_offices_labor_only" ? "labor" : null) ||
    (data.sourceModule === "admin_offices_consumables" ? "consumables" : null) ||
    (data.sourceModule === "admin_offices_attendance" ? "labor" : null) ||
    null;

  const normalizedPart = adminOfficePart === "consumables" ? "consumables" : adminOfficePart === "labor" ? "labor" : null;

  return {
    adminOfficePart: normalizedPart,
    sourceModule: data.sourceModule || (normalizedPart === "consumables" ? "admin_offices_consumables" : normalizedPart === "labor" ? "admin_offices_attendance" : null),
    reviewScope: data.reviewScope || (normalizedPart === "consumables" ? "admin_offices_consumables_only" : normalizedPart === "labor" ? "admin_offices_labor_only" : null),
  };
}

router.get("/", requireAuth, requireApproved, async (req: any, res) => {
  try {
    const role = req.currentUser.role;
    const isAdminOrSup = role === "admin" || role === "supervisor" || role === "viewer";
    const isContractSup = role === "contract_supervisor";

    let whereClause: any = undefined;
    if (isContractSup) {
      const companyKey = req.currentUser.contractCompany;
      const companySites = companyKey ? (COMPANY_SITES[companyKey]?.sites ?? []) : [];
      if (companySites.length === 0) return res.json({ extracts: [], total: 0, light: true });
      const { inArray } = await import("drizzle-orm");
      whereClause = inArray(usersTable.hospital, companySites);
    } else if (!isAdminOrSup) {
      whereClause = eq(submittedExtractsTable.userId, req.currentUser.id);
    }

    const rows = await db
      .select({
        id: submittedExtractsTable.id,
        extractType: submittedExtractsTable.extractType,
        companyName: submittedExtractsTable.companyName,
        contractNumber: submittedExtractsTable.contractNumber,
        hospitalName: submittedExtractsTable.hospitalName,
        periodMonth: submittedExtractsTable.periodMonth,
        totalAmount: submittedExtractsTable.totalAmount,
        status: submittedExtractsTable.status,
        revisionCount: submittedExtractsTable.revisionCount,
        revisedAt: submittedExtractsTable.revisedAt,
        notes: submittedExtractsTable.notes,
        adminNotes: submittedExtractsTable.adminNotes,
        approvedBy: submittedExtractsTable.approvedBy,
        approvedAt: submittedExtractsTable.approvedAt,
        updatedAt: submittedExtractsTable.updatedAt,
        createdAt: submittedExtractsTable.createdAt,
        userId: submittedExtractsTable.userId,
        extractData: submittedExtractsTable.extractData,
        hospitalNameFromUser: usersTable.hospital,
        submittedByName: usersTable.name,
        submittedByEmail: usersTable.email,
        submittedByHospital: usersTable.hospital,
      })
      .from(submittedExtractsTable)
      .leftJoin(usersTable, eq(submittedExtractsTable.userId, usersTable.id))
      .where(whereClause)
      .orderBy(desc(submittedExtractsTable.updatedAt));

    const liteRows = rows.map((row: any) => {
      const { extractData: _extractData, ...safeRow } = row;
      return {
        ...safeRow,
        ...getAdminOfficeMeta(row),
      };
    });

    return res.json({ extracts: liteRows, total: liteRows.length, light: true });
  } catch (err) {
    req.log.error({ err }, "Failed to list lightweight submitted extracts");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;