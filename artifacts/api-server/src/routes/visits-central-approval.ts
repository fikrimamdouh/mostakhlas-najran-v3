import { Router } from "express";
import { db, visitFacilityApprovalsTable, visitRequestsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { requireClusterVisitManagement } from "../middleware/requireClusterVisitManagement";
import { logAudit } from "./audit";

const router = Router();

function numberId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

router.patch(
  "/management/visits/:id/facility-approve",
  requireAuth,
  requireClusterVisitManagement,
  async (req: any, res) => {
    const id = numberId(req.params.id);
    if (!id) return res.status(400).json({ error: "رقم الزيارة غير صالح" });
    if (req.currentUser?.status !== "approved") {
      return res.status(403).json({ error: "حساب منفذ الاعتماد غير مفعل" });
    }

    const [visit] = await db
      .select({
        id: visitRequestsTable.id,
        status: visitRequestsTable.status,
        siteLocation: visitRequestsTable.siteLocation,
        serialNumber: visitRequestsTable.serialNumber,
        archivedAt: visitRequestsTable.archivedAt,
      })
      .from(visitRequestsTable)
      .where(eq(visitRequestsTable.id, id))
      .limit(1);

    if (!visit) return res.status(404).json({ error: "الزيارة غير موجودة" });
    if (visit.archivedAt) return res.status(409).json({ error: "لا يمكن اعتماد زيارة محذوفة من العرض" });
    if (visit.status !== "approved") {
      return res.status(409).json({ error: "اعتمد تصريح الزيارة من المركز أولًا قبل اعتمادها تشغيليًا" });
    }

    const approverName =
      cleanText(req.currentUser?.name, 200) ||
      cleanText(req.currentUser?.email, 200) ||
      "إدارة مركز الزيارات";
    const approverTitle =
      cleanText(req.currentUser?.jobTitle, 200) ||
      "إدارة مركز الزيارات بتجمع نجران الصحي";
    const notes = "اعتماد مركزي من إدارة الزيارات عند عدم دخول المنشأة إلى النظام.";
    const decidedAt = new Date();

    const [approval] = await db
      .insert(visitFacilityApprovalsTable)
      .values({
        visitId: id,
        siteName: visit.siteLocation,
        status: "approved",
        decidedByUserId: req.currentUser.id,
        approverName,
        approverTitle,
        notes,
        decidedAt,
        updatedAt: decidedAt,
      })
      .onConflictDoUpdate({
        target: visitFacilityApprovalsTable.visitId,
        set: {
          siteName: visit.siteLocation,
          status: "approved",
          decidedByUserId: req.currentUser.id,
          approverName,
          approverTitle,
          notes,
          decidedAt,
          updatedAt: decidedAt,
        },
      })
      .returning();

    if (!approval?.id || approval.status !== "approved") {
      req.log?.error?.({ visitId: id, approval }, "Central facility approval was not confirmed");
      return res.status(500).json({ error: "تعذر تأكيد اعتماد الزيارة؛ لم تُعتبر العملية ناجحة" });
    }

    await logAudit(
      req.currentUser.id,
      req.currentUser.email || null,
      req.currentUser.name || null,
      "اعتماد مركزي لزيارة مقاول باطن بدل انتظار دخول المنشأة",
      JSON.stringify({
        visitId: id,
        serialNumber: visit.serialNumber || null,
        siteName: visit.siteLocation,
        facilityApprovalId: approval.id,
        status: approval.status,
      }),
      req.headers["x-forwarded-for"]?.toString() || req.socket?.remoteAddress || null,
    );

    return res.json({
      approved: true,
      visitId: id,
      facilityApproval: {
        id: approval.id,
        status: approval.status,
        siteName: approval.siteName,
        approverName: approval.approverName,
        approverTitle: approval.approverTitle,
        notes: approval.notes,
        decidedAt: approval.decidedAt,
      },
    });
  },
);

export default router;
