import { Router } from "express";
import { db, usersTable, submittedExtractsTable, userStorageTable, extractRevisionsTable } from "@workspace/db";
import { requireAuth } from "../middleware/requireAuth";
import { createNotificationSafe } from "./notifications";
import { eq, desc, and } from "drizzle-orm";
import { sendNewExtractEmail } from "../lib/email";
import {
  buildListScope, canReadExtract, canUpdateExtractStatus,
  deriveAdminOfficeMeta, extractPeriodMeta, buildIdempotencyKey,
  validateExtractDataPayload, liteListColumns,
} from "../lib/extract-scope";

const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const NOT_FOUND_OR_FORBIDDEN = "EXTRACT_NOT_FOUND_OR_FORBIDDEN";

function savedExtractMutationResponse(row: any) {
  if (!row || typeof row !== "object") return row;
  const { extractData: _extractData, ...withoutLargeSnapshot } = row;
  return withoutLargeSnapshot;
}

function storedExtractDataForResponse(raw: unknown) {
  if (typeof raw !== "string") return raw;
  try { return JSON.parse(raw); } catch { return raw; }
}

function advanceMonthInExtractData(jsonStr: string): string {
  try {
    const data = JSON.parse(jsonStr);
    const curIdx = MONTHS_AR.indexOf(data.extractMonth || '');
    if (curIdx < 0) return jsonStr;
    const nextIdx = (curIdx + 1) % 12;
    const curYear = parseInt(data.extractYear || String(new Date().getFullYear()), 10);
    const nextYear = curIdx === 11 ? curYear + 1 : curYear;
    const nextMonth1 = nextIdx + 1;
    const pad = (n: number) => String(n).padStart(2, '0');
    const lastDay = new Date(nextYear, nextMonth1, 0).getDate();
    const nextStart = `${nextYear}-${pad(nextMonth1)}-01`;
    const nextEnd = `${nextYear}-${pad(nextMonth1)}-${pad(lastDay)}`;
    const curPayment = parseInt(data.paymentNumber || data.extractNumber || '0', 10);
    const nextPayment = isNaN(curPayment) ? 1 : curPayment + 1;
    return JSON.stringify({ ...data, extractMonth: MONTHS_AR[nextIdx], extractYear: String(nextYear), extractStart: nextStart, extractEnd: nextEnd, paymentNumber: String(nextPayment), extractNumber: String(nextPayment) });
  } catch { return jsonStr; }
}

const router = Router();

const COMPANY_LABELS: Record<string, string> = {
  "بيت_العرب": "شركة مجموعة بيت العرب الحديثة المحدودة",
  "سراكو": "شركة سراكو",
};

function resolveCompanyName(user: any, fallback: string | null = null): string | null { return user.company ? (COMPANY_LABELS[user.company] || user.company) : fallback; }
function resolveHospitalName(user: any, fallback: string | null = null): string | null { return user.hospital || fallback; }
function resolveContractNumber(user: any, fallback: string | null = null): string | null { return user.contractNumber || fallback; }
function staleRevisionResponse(res: any) { return res.status(404).json({ error: NOT_FOUND_OR_FORBIDDEN }); }

const requireApproved = async (req: any, res: any, next: any) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.clerkUserId)).limit(1);
  if (!user) return res.status(401).json({ error: "User not registered" });
  if (user.status !== "approved" && user.role !== "admin") return res.status(403).json({ error: "Account pending approval" });
  req.currentUser = user;
  next();
};

const requireAdmin = async (req: any, res: any, next: any) => {
  if (req.currentUser?.role !== "admin" && req.currentUser?.role !== "supervisor") return res.status(403).json({ error: "Admin or supervisor required" });
  next();
};

const requireStrictAdmin = async (req: any, res: any, next: any) => {
  if (req.currentUser?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
};

router.get("/", requireAuth, requireApproved, async (req: any, res) => {
  try {
    // نطاق موحد من الhelper — نفس المنطق في المسار الكامل و lite.
    const scope = buildListScope(req.currentUser);
    if (scope.kind === "empty") return res.json({ extracts: [], total: 0 });
    const whereClause = scope.kind === "where" ? scope.where : undefined;
    // القائمة لا تسحب extractData إطلاقًا — التفاصيل الكاملة عبر GET /:id فقط.
    const rows = await db.select(liteListColumns()).from(submittedExtractsTable).leftJoin(usersTable, eq(submittedExtractsTable.userId, usersTable.id)).where(whereClause).orderBy(desc(submittedExtractsTable.createdAt));
    return res.json({ extracts: rows, total: rows.length });
  } catch (err) {
    req.log.error({ err }, "Failed to list submitted extracts");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", requireAuth, requireApproved, requireStrictAdmin, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid ID" });
    const [existing] = await db.select({ id: submittedExtractsTable.id, hospitalName: submittedExtractsTable.hospitalName, extractType: submittedExtractsTable.extractType, periodMonth: submittedExtractsTable.periodMonth }).from(submittedExtractsTable).where(eq(submittedExtractsTable.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: "Not found" });
    await db.delete(extractRevisionsTable).where(eq(extractRevisionsTable.extractId, id)).catch(() => {});
    await db.delete(submittedExtractsTable).where(eq(submittedExtractsTable.id, id));
    req.log.info({ adminId: req.currentUser.id, extractId: id }, "Submitted extract deleted by admin");
    return res.json({ ok: true, deleted: existing });
  } catch (err) {
    req.log.error({ err }, "Failed to delete submitted extract");
    return res.status(500).json({ error: "فشل حذف المستخلص" });
  }
});

router.post("/", requireAuth, requireApproved, async (req: any, res) => {
  try {
    const { extractType, periodMonth, totalAmount, notes, contractNumber, extractData } = req.body;
    if (!extractType) return res.status(400).json({ error: "extractType is required" });
    const user = req.currentUser;
    const companyName = resolveCompanyName(user, req.body.companyName || null);
    const hospitalName = resolveHospitalName(user, req.body.hospitalName || null);
    const resolvedContractNumber = contractNumber || user.contractNumber || null;
    const extractDataJson = extractData ? JSON.stringify(extractData) : null;

    // البند الثامن: الحماية النهائية لحجم البيانات في السيرفر (guards الواجهة تبقى كطبقة أولى فقط).
    const payloadCheck = validateExtractDataPayload(extractDataJson);
    if (!payloadCheck.ok) return res.status(payloadCheck.status).json({ error: payloadCheck.error, payloadRejected: true });

    // أعمدة صريحة تُحسب مرة واحدة عند الكتابة — القوائم لا تقرأ extractData بعد الآن.
    const officeMeta = deriveAdminOfficeMeta(extractType, extractDataJson);
    const period = extractPeriodMeta(req.body, extractDataJson);

    // البند الثاني: idempotency server-side. مفتاح حتمي + unique index في القاعدة.
    const idempotencyKey = buildIdempotencyKey({
      userId: user.id, extractType, adminOfficePart: officeMeta.adminOfficePart,
      hospitalName, companyName, contractNumber: resolvedContractNumber,
      extractYear: period.extractYear, extractMonth: period.extractMonth, paymentNumber: period.paymentNumber,
    });

    const duplicate409 = (existingRow: any) => res.status(409).json({
      error: "تم رفع نفس المستخلص مسبقًا (نفس النوع/المستشفى/الشهر/السنة/رقم الدفعة). لم يتم إنشاء سجل مكرر. لرفع مستخلص جديد غيّر رقم الدفعة أو الشهر من الإعدادات، أو استخدم «تعديل» على المستخلص الموجود.",
      duplicate: true,
      existingId: existingRow?.id ?? null,
      existingStatus: existingRow?.status ?? null,
    });

    // فحص مسبق (يوفر رسالة أوضح)، ثم قيد القاعدة يحسم أي سباق بين جهازين.
    const [preExisting] = await db.select({ id: submittedExtractsTable.id, status: submittedExtractsTable.status }).from(submittedExtractsTable).where(eq(submittedExtractsTable.idempotencyKey, idempotencyKey)).limit(1);
    if (preExisting) return duplicate409(preExisting);

    let row: any;
    try {
      const inserted = await db.insert(submittedExtractsTable).values({
        userId: user.id, extractType, companyName, contractNumber: resolvedContractNumber, hospitalName,
        periodMonth: periodMonth || null, totalAmount: totalAmount != null ? String(totalAmount) : null,
        notes: notes || null, status: "submitted", extractData: extractDataJson,
        idempotencyKey,
        adminOfficePart: officeMeta.adminOfficePart, sourceModule: officeMeta.sourceModule, reviewScope: officeMeta.reviewScope,
      }).returning();
      row = inserted[0];
    } catch (insertErr: any) {
      // 23505 = unique_violation → جهاز آخر أنشأ نفس المستخلص في نفس اللحظة.
      if (insertErr?.code === "23505" || /duplicate key|unique/i.test(String(insertErr?.message || ""))) {
        const [racedExisting] = await db.select({ id: submittedExtractsTable.id, status: submittedExtractsTable.status }).from(submittedExtractsTable).where(eq(submittedExtractsTable.idempotencyKey, idempotencyKey)).limit(1);
        req.log.warn({ idempotencyKey }, "Duplicate extract submit blocked by unique index (race)");
        return duplicate409(racedExisting);
      }
      throw insertErr;
    }
    await db.insert(extractRevisionsTable).values({ extractId: row.id, changedBy: user.name, changedByRole: user.role, previousStatus: null, newStatus: "submitted", notes: "تقديم مستخلص جديد" });
    void (async () => { try { const admins = await db.select({ email: usersTable.email }).from(usersTable).where(and(eq(usersTable.role, "admin"), eq(usersTable.status, "approved"))); const hospitalSupervisors = hospitalName ? await db.select({ email: usersTable.email }).from(usersTable).where(and(eq(usersTable.role, "supervisor"), eq(usersTable.supervisedHospital, hospitalName), eq(usersTable.status, "approved"))) : []; const recipients = [...admins.map(a => a.email), ...hospitalSupervisors.map(s => s.email)].filter((e): e is string => !!e); if (recipients.length > 0) await sendNewExtractEmail(recipients, { submitterName: user.name, submitterEmail: user.email, hospitalName: hospitalName || "—", extractType, periodMonth, totalAmount: totalAmount != null ? String(totalAmount) : null, extractId: row.id }); } catch (_) {} })();
    return res.status(201).json(savedExtractMutationResponse(row));
  } catch (err) {
    req.log.error({ err }, "Failed to submit extract");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", requireAuth, requireApproved, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid ID" });
    const [existing] = await db.select().from(submittedExtractsTable).where(eq(submittedExtractsTable.id, id)).limit(1);
    if (!existing) return staleRevisionResponse(res);
    if (existing.userId !== req.currentUser.id) return staleRevisionResponse(res);
    const isPreReviewEdit = existing.status === "submitted";
    const isReviewerRequestedRevision = existing.status === "needs_revision" || existing.status === "rejected";
    if (!isPreReviewEdit && !isReviewerRequestedRevision) return res.status(400).json({ error: "لا يمكن تعديل المستخلص بعد بدء المراجعة أو بعد الاعتماد" });
    const { periodMonth, totalAmount, notes, extractData } = req.body;
    const user = req.currentUser;
    const extractDataJson = extractData ? JSON.stringify(extractData) : existing.extractData;

    // البند الثامن: نفس حماية الحجم/base64 على التعديل.
    const payloadCheck = validateExtractDataPayload(extractData ? extractDataJson : null);
    if (!payloadCheck.ok) return res.status(payloadCheck.status).json({ error: payloadCheck.error, payloadRejected: true });

    const resolvedCompany = resolveCompanyName(user, existing.companyName);
    const resolvedContract = resolveContractNumber(user, existing.contractNumber);
    const resolvedHospital = resolveHospitalName(user, existing.hospitalName);
    const officeMeta = deriveAdminOfficeMeta(existing.extractType, extractDataJson);
    const period = extractPeriodMeta(req.body, extractDataJson);
    const nextIdempotencyKey = buildIdempotencyKey({
      userId: existing.userId, extractType: existing.extractType, adminOfficePart: officeMeta.adminOfficePart,
      hospitalName: resolvedHospital, companyName: resolvedCompany, contractNumber: resolvedContract,
      extractYear: period.extractYear, extractMonth: period.extractMonth, paymentNumber: period.paymentNumber,
    });

    const nextRevisionCount = isReviewerRequestedRevision ? (existing.revisionCount ?? 0) + 1 : (existing.revisionCount ?? 0);
    let row: any;
    try {
      const updated = await db.update(submittedExtractsTable).set({ companyName: resolvedCompany, contractNumber: resolvedContract, hospitalName: resolvedHospital, periodMonth: periodMonth ?? existing.periodMonth, totalAmount: totalAmount != null ? String(totalAmount) : existing.totalAmount, extractData: extractDataJson, notes: notes ?? existing.notes, status: "submitted", revisionCount: nextRevisionCount, revisedAt: new Date(), adminNotes: isReviewerRequestedRevision ? null : existing.adminNotes, idempotencyKey: nextIdempotencyKey, adminOfficePart: officeMeta.adminOfficePart, sourceModule: officeMeta.sourceModule, reviewScope: officeMeta.reviewScope, updatedAt: new Date() }).where(eq(submittedExtractsTable.id, id)).returning();
      row = updated[0];
    } catch (updateErr: any) {
      // PUT لا ينشئ سجلًا أبدًا؛ وإن تصادم المفتاح مع مستخلص آخر قائم نرجع 409 واضحًا.
      if (updateErr?.code === "23505" || /duplicate key|unique/i.test(String(updateErr?.message || ""))) {
        return res.status(409).json({ error: "توجد بيانات مستخلص آخر بنفس الشهر/السنة/رقم الدفعة. لا يمكن حفظ هذا التعديل على نفس القيم. غيّر رقم الدفعة أو الشهر.", duplicate: true });
      }
      throw updateErr;
    }
    await db.insert(extractRevisionsTable).values({ extractId: row.id, changedBy: req.currentUser.name, changedByRole: req.currentUser.role, previousStatus: existing.status, newStatus: "submitted", notes: isReviewerRequestedRevision ? `تعديل رقم ${row.revisionCount}` : "تعديل قبل بدء المراجعة" });
    return res.json(savedExtractMutationResponse(row));
  } catch (err) {
    req.log.error({ err }, "Failed to resubmit extract");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", requireAuth, requireApproved, async (req: any, res) => {
  try {
    const [row] = await db.select().from(submittedExtractsTable).leftJoin(usersTable, eq(submittedExtractsTable.userId, usersTable.id)).where(eq(submittedExtractsTable.id, Number(req.params.id))).limit(1);
    if (!row) return res.status(404).json({ error: "Not found" });
    // نفس منطق القائمة تمامًا (helper واحد): مالك / admin / supervisor / viewer / contract_supervisor ضمن مواقع شركته.
    if (!canReadExtract(req.currentUser, row.submitted_extracts, row.users?.hospital)) return res.status(403).json({ error: "Forbidden" });
    return res.json({
      ...row.submitted_extracts,
      extractData: storedExtractDataForResponse(row.submitted_extracts.extractData),
      submittedByName: row.users?.name,
      submittedByEmail: row.users?.email,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get submitted extract");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id/status", requireAuth, requireApproved, requireAdmin, async (req: any, res) => {
  try {
    const { status, adminNotes } = req.body;
    const validStatuses = ["submitted", "under_review", "approved", "rejected", "needs_revision"];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: "Invalid status" });
    const updates: any = { status, updatedAt: new Date() };
    if (adminNotes !== undefined) updates.adminNotes = adminNotes;
    if (status === "approved") { updates.approvedBy = req.currentUser.name; updates.approvedAt = new Date(); }
    const [existing] = await db.select().from(submittedExtractsTable).where(eq(submittedExtractsTable.id, Number(req.params.id))).limit(1);
    if (!existing) return res.status(404).json({ error: "Not found" });
    // البند الثالث: مراجع خارج نطاقه لا يغيّر حالة مستخلص.
    let submitterHospital: string | null = null;
    if (existing.userId != null) {
      const [submitter] = await db.select({ hospital: usersTable.hospital }).from(usersTable).where(eq(usersTable.id, existing.userId)).limit(1);
      submitterHospital = submitter?.hospital ?? null;
    }
    const statusPermission = canUpdateExtractStatus(req.currentUser, existing, submitterHospital);
    if (!statusPermission.allowed) return res.status(403).json({ error: statusPermission.reason || "Forbidden" });
    const [row] = await db.update(submittedExtractsTable).set(updates).where(eq(submittedExtractsTable.id, Number(req.params.id))).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    await db.insert(extractRevisionsTable).values({ extractId: row.id, changedBy: req.currentUser.name, changedByRole: req.currentUser.role, previousStatus: existing?.status ?? null, newStatus: status, notes: adminNotes || null }).catch(() => {});
    if (status === "approved" && row.userId) {
      try {
        const [storageRow] = await db.select().from(userStorageTable).where(and(eq(userStorageTable.userId, row.userId), eq(userStorageTable.storageKey, 'persistentExtractData'))).limit(1);
        if (storageRow?.storageValue) {
          const advanced = advanceMonthInExtractData(storageRow.storageValue);
          await db.update(userStorageTable).set({ storageValue: advanced, updatedAt: new Date() }).where(and(eq(userStorageTable.userId, row.userId), eq(userStorageTable.storageKey, 'persistentExtractData')));
        }
      } catch (advErr) { req.log.warn({ advErr }, "Month advance failed (non-fatal)"); }
    }
    try {
      if (!row.userId) req.log?.warn?.({ extractId: row.id }, "notification skipped: extract has no userId");
      else if (["needs_revision", "approved", "rejected"].includes(status)) {
        // كانت تُقرأ من أعمدة غير موجودة (undefined دائمًا) — الآن من extractData الفعلي.
        const rowPeriod = extractPeriodMeta({}, row.extractData);
        const period = [rowPeriod.extractMonth, rowPeriod.extractYear].filter(Boolean).join(" ") || row.periodMonth || "";
        const pay = rowPeriod.paymentNumber || "";
        const label = period + (pay ? " — دفعة " + pay : "");
        const map: Record<string, { type: string; title: string; body: string }> = {
          needs_revision: { type: "revision_requested", title: "مستخلص مطلوب تعديله", body: "تم طلب تعديل على مستخلص شهر " + label + (adminNotes ? " — ملاحظة المراجع: " + adminNotes : "") },
          approved: { type: "extract_approved", title: "تم اعتماد مستخلصك", body: "تم اعتماد مستخلص شهر " + label },
          rejected: { type: "extract_rejected", title: "تم رفض المستخلص", body: "تم رفض مستخلص شهر " + label + (adminNotes ? " — ملاحظة المراجع: " + adminNotes : "") },
        };
        const n = map[status];
        if (n) { await createNotificationSafe({ userId: row.userId, ...n, href: "/extracts/track", createdBy: req.currentUser?.name || "reviewer" }); req.log?.info?.({ extractId: row.id, userId: row.userId, status }, "notification created for extract owner"); }
      }
    } catch (notifErr) { req.log?.warn?.({ notifErr }, "notification create skipped (non-fatal)"); }
    return res.json({ ...row, monthAdvanced: status === "approved" });
  } catch (err) {
    req.log.error({ err }, "Failed to update extract status");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id/revisions", requireAuth, requireApproved, async (req: any, res) => {
  try {
    const extractId = Number(req.params.id);
    if (!Number.isFinite(extractId)) return res.status(400).json({ error: "Invalid ID" });
    const [extract] = await db
      .select({ userId: submittedExtractsTable.userId, hospitalName: submittedExtractsTable.hospitalName, submitterHospital: usersTable.hospital })
      .from(submittedExtractsTable)
      .leftJoin(usersTable, eq(submittedExtractsTable.userId, usersTable.id))
      .where(eq(submittedExtractsTable.id, extractId)).limit(1);
    if (!extract) return res.status(404).json({ error: "Not found" });
    // نفس منطق القائمة: المالك، admin/supervisor/viewer، وcontract_supervisor لمواقع شركته فقط.
    if (!canReadExtract(req.currentUser, extract, extract.submitterHospital)) return res.status(403).json({ error: "Forbidden" });
    const rows = await db.select().from(extractRevisionsTable).where(eq(extractRevisionsTable.extractId, extractId)).orderBy(desc(extractRevisionsTable.createdAt));
    return res.json({ revisions: rows });
  } catch (err) {
    req.log.error({ err }, "Failed to get revisions");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
