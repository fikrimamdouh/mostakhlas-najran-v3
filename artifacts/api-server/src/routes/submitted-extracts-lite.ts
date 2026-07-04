import { Router } from "express";
import { db, usersTable, submittedExtractsTable } from "@workspace/db";
import { requireAuth } from "../middleware/requireAuth";
import { eq, desc } from "drizzle-orm";

const router = Router();

const COMPANY_SITES: Record<string, { sites: string[] }> = {
  "بيت_العرب": {
    sites: [
      "مستشفى يدمة العام",
      "مستشفى حبونا العام",
      "مستشفى بدر الجنوب العام",
      "مستشفى الولادة والأطفال",
      "مستشفى نجران العام القديم وسكن الممرضات الخارجي",
      "المكاتب الإدارية والمرافق الصحية",
      "صيانة وإصلاح السيارات والعيادات المتنقلة",
    ],
  },
  "سراكو": {
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

// GET /api/submitted-extracts-lite
// Lightweight list for badges, dashboards, and status tracking. It excludes full extractData snapshots,
// but returns small admin-office metadata so tracking cards can distinguish labor vs consumables.
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