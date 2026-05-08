import { Router } from "express";
import { db, usersTable, submittedExtractsTable } from "@workspace/db";
import { requireAuth } from "../middleware/requireAuth";
import { eq, desc, and, inArray } from "drizzle-orm";

const router = Router();

const requireApproved = async (req: any, res: any, next: any) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.clerkUserId)).limit(1);
  if (!user) return res.status(401).json({ error: "User not registered" });
  if (user.status !== "approved" && user.role !== "admin") return res.status(403).json({ error: "Account pending" });
  req.currentUser = user;
  next();
};

const TYPE_LABELS: Record<string, string> = {
  labor: "مستخلص عمالة",
  consumables: "مستخلص مستهلكات",
  spare_parts: "مستخلص قطع غيار",
  health_centers: "مستخلص مراكز صحية",
  admin_offices: "مستخلص مكاتب إدارية",
};

const STATUS_LABELS: Record<string, string> = {
  submitted: "بانتظار المراجعة",
  under_review: "قيد المراجعة",
  approved: "معتمد",
  rejected: "مرفوض",
  needs_revision: "يحتاج تعديل",
};

function escapeCsv(val: any): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// GET /api/export/submitted-extracts?format=csv  (default: csv)
router.get("/submitted-extracts", requireAuth, requireApproved, async (req: any, res) => {
  try {
    const role = req.currentUser.role;
    const isAdminOrSup = role === "admin" || role === "supervisor";

    const COMPANY_SITES: Record<string, string[]> = {
      "بيت_العرب": ["مستشفى يدمة العام","مستشفى حبونا العام","مستشفى بدر الجنوب العام","مستشفى الولادة والأطفال","مستشفى نجران العام القديم وسكن الممرضات الخارجي","المكاتب الإدارية والمرافق الصحية","صيانة وإصلاح السيارات والعيادات المتنقلة"],
      "سراكو": ["مستشفى نجران العام الجديد","مركز طب الأسنان التخصصي","مجمع الأمل للصحة النفسية","مستشفى ثار العام","مستشفى خباش العام","المراكز الصحية","مستشفى الملك خالد","مركز الأمير سلطان","مستشفى شروره العام"],
    };

    let whereClause: any = undefined;
    if (role === "contract_supervisor") {
      const companySites = req.currentUser.contractCompany ? (COMPANY_SITES[req.currentUser.contractCompany] ?? []) : [];
      if (companySites.length === 0) {
        const rows: any[] = [];
        return sendCsv(res, rows);
      }
      whereClause = inArray(usersTable.hospital, companySites);
    } else if (!isAdminOrSup) {
      whereClause = eq(submittedExtractsTable.userId, req.currentUser.id);
    }

    const rows = await db.select({
      id: submittedExtractsTable.id,
      extractType: submittedExtractsTable.extractType,
      companyName: submittedExtractsTable.companyName,
      contractNumber: submittedExtractsTable.contractNumber,
      hospitalName: submittedExtractsTable.hospitalName,
      periodMonth: submittedExtractsTable.periodMonth,
      totalAmount: submittedExtractsTable.totalAmount,
      status: submittedExtractsTable.status,
      adminNotes: submittedExtractsTable.adminNotes,
      approvedBy: submittedExtractsTable.approvedBy,
      approvedAt: submittedExtractsTable.approvedAt,
      createdAt: submittedExtractsTable.createdAt,
      updatedAt: submittedExtractsTable.updatedAt,
      submittedByName: usersTable.name,
      submittedByEmail: usersTable.email,
    })
      .from(submittedExtractsTable)
      .leftJoin(usersTable, eq(submittedExtractsTable.userId, usersTable.id))
      .where(whereClause)
      .orderBy(desc(submittedExtractsTable.createdAt));

    return sendCsv(res, rows);
  } catch (err) {
    req.log.error({ err }, "Export failed");
    return res.status(500).json({ error: "Export failed" });
  }
});

function sendCsv(res: any, rows: any[]) {
  const headers = [
    "رقم المستخلص",
    "نوع المستخلص",
    "الشركة",
    "رقم العقد",
    "المستشفى / الموقع",
    "الفترة",
    "المبلغ الإجمالي",
    "الحالة",
    "مقدَّم بواسطة",
    "البريد الإلكتروني",
    "اعتمد بواسطة",
    "تاريخ الاعتماد",
    "ملاحظات المدير",
    "تاريخ التقديم",
    "آخر تحديث",
  ];

  const lines = ["\uFEFF" + headers.join(",")]; // BOM for Arabic Excel support

  for (const r of rows) {
    lines.push([
      escapeCsv(r.id),
      escapeCsv(TYPE_LABELS[r.extractType] || r.extractType),
      escapeCsv(r.companyName),
      escapeCsv(r.contractNumber),
      escapeCsv(r.hospitalName),
      escapeCsv(r.periodMonth),
      escapeCsv(r.totalAmount),
      escapeCsv(STATUS_LABELS[r.status] || r.status),
      escapeCsv(r.submittedByName),
      escapeCsv(r.submittedByEmail),
      escapeCsv(r.approvedBy),
      escapeCsv(r.approvedAt ? new Date(r.approvedAt).toLocaleDateString("ar-SA") : ""),
      escapeCsv(r.adminNotes),
      escapeCsv(r.createdAt ? new Date(r.createdAt).toLocaleDateString("ar-SA") : ""),
      escapeCsv(r.updatedAt ? new Date(r.updatedAt).toLocaleDateString("ar-SA") : ""),
    ].join(","));
  }

  const filename = `مستخلصات_${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  return res.send(lines.join("\r\n"));
}

export default router;
