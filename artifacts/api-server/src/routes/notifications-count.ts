import { Router } from "express";
import { db, usersTable, submittedExtractsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { findCurrentUser } from "../lib/current-user";
import { buildListScope } from "../lib/extract-scope";

/**
 * إشعارات — عدّاد خفيف فقط. لا يرجع أي تفاصيل مستخلصات إطلاقًا.
 *
 * بديل خفيف لاستدعاء /api/submitted-extracts-lite كل 5 دقائق من auth-check.js
 * (كان يسحب القائمة الكاملة فقط لمعرفة عدد التحديثات الجديدة). هذا الendpoint
 * يرجع فقط:
 *   { count, latestUpdatedAt }
 * والعميل يقارن latestUpdatedAt بآخر قيمة معروفة له محليًا — لو لم تتغيّر
 * فلا داعي لأي سحب إضافي، ولو تغيّرت فقط عندها يسحب القائمة الخفيفة الكاملة
 * مرة واحدة لحساب العدد الدقيق (نفس منطق "غير مقروء" الحالي بلا أي تعديل عليه).
 *
 * يعيد استخدام buildListScope من extract-scope.ts (نفس منطق الصلاحيات
 * المستخدم في submitted-extracts.ts وsubmitted-extracts-lite.ts) — بلا أي
 * تعديل على تلك الملفات.
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
    if (scope.kind === "empty") return res.json({ count: 0, latestUpdatedAt: null });
    const whereClause = scope.kind === "where" ? scope.where : undefined;

    const [row] = await db
      .select({
        count: sql<number>`count(*)::int`,
        latestUpdatedAt: sql<string | null>`max(${submittedExtractsTable.updatedAt})`,
      })
      .from(submittedExtractsTable)
      .leftJoin(usersTable, eq(submittedExtractsTable.userId, usersTable.id))
      .where(whereClause);

    return res.json({
      count: row?.count ?? 0,
      latestUpdatedAt: row?.latestUpdatedAt ? new Date(row.latestUpdatedAt).toISOString() : null,
    });
  } catch (err) {
    req.log?.error?.({ err }, "Failed to compute notifications count");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
