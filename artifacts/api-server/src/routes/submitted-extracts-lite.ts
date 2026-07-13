import { Router } from "express";
import { db, usersTable, submittedExtractsTable } from "@workspace/db";
import { requireAuth } from "../middleware/requireAuth";
import { findCurrentUser } from "../lib/current-user";
import { eq, desc } from "drizzle-orm";
import { buildListScope, liteListColumns } from "../lib/extract-scope";

/**
 * القائمة الخفيفة — لا تختار extractData من قاعدة البيانات إطلاقًا.
 *
 * البند الرابع من تثبيت الإنتاج:
 *   - adminOfficePart / sourceModule / reviewScope أعمدة صريحة تُحسب عند الكتابة
 *     (في POST/PUT بمسار submitted-extracts) وتُقرأ هنا مباشرة.
 *   - لا "اختيار ثم حذف في الذاكرة": قائمة 1000 مستخلص لا تسحب أي snapshot.
 *   - منطق الصلاحيات نفسه المستخدم في المسار الكامل (helper واحد: extract-scope).
 *
 * ملاحظة توافق: السجلات القديمة (قبل إضافة الأعمدة) سترجع adminOfficePart=null
 * حتى يُشغَّل backfill في scripts/migrate-production.sql — الواجهة تتعامل مع null
 * أصلًا (تفتح صفحة الجزأين الافتراضية).
 */
const router = Router();

const requireApproved = async (req: any, res: any, next: any) => {
  const user = await findCurrentUser(req);
  if (!user) return res.status(401).json({ error: "User not registered" });
  if (user.status !== "approved" && user.role !== "admin") {
    return res.status(403).json({ error: "Account pending approval" });
  }
  req.currentUser = user;
  next();
};

router.get("/", requireAuth, requireApproved, async (req: any, res) => {
  try {
    const scope = buildListScope(req.currentUser);
    if (scope.kind === "empty") return res.json({ extracts: [], total: 0, light: true });
    const whereClause = scope.kind === "where" ? scope.where : undefined;

    const rows = await db
      .select({ ...liteListColumns(), hospitalNameFromUser: usersTable.hospital })
      .from(submittedExtractsTable)
      .leftJoin(usersTable, eq(submittedExtractsTable.userId, usersTable.id))
      .where(whereClause)
      .orderBy(desc(submittedExtractsTable.updatedAt));

    return res.json({ extracts: rows, total: rows.length, light: true });
  } catch (err) {
    req.log.error({ err }, "Failed to list lightweight submitted extracts");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
