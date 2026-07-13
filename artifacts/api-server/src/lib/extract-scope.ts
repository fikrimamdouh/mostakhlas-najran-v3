/**
 * extract-scope.ts — المصدر الوحيد لمنطق صلاحيات المستخلصات المقدمة.
 *
 * يوحّد ما كان مكررًا (ومتضاربًا) بين:
 *   routes/submitted-extracts.ts  و  routes/submitted-extracts-lite.ts
 *
 * القواعد:
 *   admin               → يرى الكل ويحدّث الكل.
 *   supervisor          → يرى الكل (السلوك الحالي المقصود)، لكن تحديث الحالة
 *                         مقيّد بمستشفاه إن كان supervisedHospital محددًا.
 *   viewer              → قراءة فقط للكل (قائمة + تفاصيل)، لا تحديث حالة إطلاقًا.
 *   contract_supervisor → يرى ويفتح فقط مستخلصات مواقع شركته. لا تحديث حالة.
 *   user                → مستخلصاته فقط.
 */
import { eq, inArray } from "drizzle-orm";
import { usersTable, submittedExtractsTable } from "@workspace/db";

// ─── مواقع الشركات — نسخة واحدة (كانت مكررة، إحداها base64) ───────────────
export const COMPANY_SITES: Record<string, { sites: string[] }> = {
  "زهران": { sites: ["مستشفى يدمه العام — زهران", "مستشفى حبونا العام — زهران", "مستشفى بدر الجنوب العام — زهران"] },
  "إيمان": { sites: ["مستشفى الولادة والأطفال — إيمان", "مستشفى غرب نجران للولادة والأطفال والعيادات التخصصية — إيمان", "المكاتب الإدارية والمرافق الصحية وصيانة وإصلاح السيارات والعيادات المتنقلة — إيمان"] },
  "بيت_العرب": { sites: ["مستشفى يدمة العام", "مستشفى حبونا العام", "مستشفى بدر الجنوب العام", "مستشفى الولادة والأطفال", "مستشفى نجران العام القديم وسكن الممرضات الخارجي", "المكاتب الإدارية والمرافق الصحية", "صيانة وإصلاح السيارات والعيادات المتنقلة"] },
  "سراكو": { sites: ["مستشفى نجران العام الجديد", "مركز طب الأسنان التخصصي", "مجمع الأمل للصحة النفسية", "مستشفى ثار العام", "مستشفى خباش العام", "المراكز الصحية", "مستشفى الملك خالد", "مركز الأمير سلطان", "مستشفى شروره العام"] },
};

export function companySitesFor(user: any): string[] {
  const key = String(user?.contractCompany || "").trim();
  return key ? (COMPANY_SITES[key]?.sites ?? []) : [];
}

// ─── نطاق القوائم ──────────────────────────────────────────────────────────
export type ListScope =
  | { kind: "all" }
  | { kind: "empty" }
  | { kind: "where"; where: any };

/** where-clause موحد لقوائم المستخلصات — يستخدمه المساران (الكامل و lite). */
export function buildListScope(user: any): ListScope {
  const role = String(user?.role || "");
  if (role === "admin" || role === "supervisor" || role === "viewer") return { kind: "all" };
  if (role === "contract_supervisor") {
    const sites = companySitesFor(user);
    if (!sites.length) return { kind: "empty" };
    return { kind: "where", where: inArray(usersTable.hospital, sites) };
  }
  return { kind: "where", where: eq(submittedExtractsTable.userId, user.id) };
}

// ─── وصول قراءة لسجل واحد (GET /:id و GET /:id/revisions) ──────────────────
/**
 * نفس منطق القائمة تمامًا مطبّقًا على صف واحد.
 * submitterHospital = مستشفى صاحب المستخلص من جدول users (نفس عمود فلترة القائمة).
 */
export function canReadExtract(user: any, extractRow: { userId: number | null; hospitalName?: string | null }, submitterHospital?: string | null): boolean {
  const role = String(user?.role || "");
  if (extractRow.userId != null && extractRow.userId === user?.id) return true;
  if (role === "admin" || role === "supervisor" || role === "viewer") return true;
  if (role === "contract_supervisor") {
    const sites = companySitesFor(user);
    const hosp = String(submitterHospital ?? extractRow.hospitalName ?? "").trim();
    return !!hosp && sites.includes(hosp);
  }
  return false;
}

// ─── تحديث الحالة (PATCH /:id/status) ───────────────────────────────────────
/**
 * admin: دائمًا. supervisor: إن كان له supervisedHospital فمستشفاه فقط،
 * وإلا (غير مقيَّد في الملف الشخصي) يبقى السلوك الحالي: الكل.
 * viewer / contract_supervisor / user: ممنوع.
 */
export function canUpdateExtractStatus(user: any, extractRow: { hospitalName?: string | null }, submitterHospital?: string | null): { allowed: boolean; reason?: string } {
  const role = String(user?.role || "");
  if (role === "admin") return { allowed: true };
  if (role === "supervisor") {
    const scope = String(user?.supervisedHospital || "").trim();
    if (!scope) return { allowed: true };
    const hosp = String(submitterHospital ?? extractRow.hospitalName ?? "").trim();
    if (hosp && hosp === scope) return { allowed: true };
    return { allowed: false, reason: "لا تملك صلاحية تغيير حالة مستخلص خارج نطاق إشرافك" };
  }
  return { allowed: false, reason: "Admin or supervisor required" };
}

// ─── استخراج meta من extractData (تُحسب مرة عند الكتابة وتُخزَّن كأعمدة) ────
function parseMaybeJSON(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === "object") return raw as Record<string, any>;
  if (typeof raw !== "string") return {};
  try { const p = JSON.parse(raw); return p && typeof p === "object" ? p : {}; } catch { return {}; }
}

export function deriveAdminOfficeMeta(extractType: string, extractData: unknown): { adminOfficePart: string | null; sourceModule: string | null; reviewScope: string | null } {
  if (extractType !== "admin_offices") return { adminOfficePart: null, sourceModule: null, reviewScope: null };
  const data = parseMaybeJSON(extractData);
  const nested = parseMaybeJSON(data.najran_admin_offices_submit_meta_v1);
  const part =
    data.adminOfficePart || data.draftPart || data.submittedPart ||
    nested.submittedPart || nested.savedPart ||
    (data.adminOfficeConsumables === true ? "consumables" : null) ||
    (data.adminOfficeLabor === true ? "labor" : null) ||
    (data.reviewScope === "admin_offices_consumables_only" ? "consumables" : null) ||
    (data.reviewScope === "admin_offices_labor_only" ? "labor" : null) ||
    (data.sourceModule === "admin_offices_consumables" ? "consumables" : null) ||
    (data.sourceModule === "admin_offices_attendance" ? "labor" : null) ||
    null;
  const normalized = part === "consumables" ? "consumables" : part === "labor" ? "labor" : null;
  return {
    adminOfficePart: normalized,
    sourceModule: data.sourceModule || (normalized === "consumables" ? "admin_offices_consumables" : normalized === "labor" ? "admin_offices_attendance" : null),
    reviewScope: data.reviewScope || (normalized === "consumables" ? "admin_offices_consumables_only" : normalized === "labor" ? "admin_offices_labor_only" : null),
  };
}

export function extractPeriodMeta(body: Record<string, any>, extractData: unknown): { extractMonth: string; extractYear: string; paymentNumber: string } {
  const data = parseMaybeJSON(extractData);
  const persistent = parseMaybeJSON(data.persistentExtractData);
  const month = body.extractMonth || persistent.extractMonth || data.extractMonth || "";
  const year = body.extractYear || persistent.extractYear || data.extractYear || "";
  const payment = body.paymentNumber || body.extractNumber || persistent.paymentNumber || persistent.extractNumber || data.paymentNumber || data.extractNumber || "";
  return { extractMonth: norm(month), extractYear: norm(year), paymentNumber: norm(payment) };
}

function norm(v: unknown): string {
  return String(v ?? "").replace(/\s+/g, " ").trim();
}

// ─── مفتاح idempotency الحتمي ────────────────────────────────────────────────
export function buildIdempotencyKey(input: {
  userId: number;
  extractType: string;
  adminOfficePart?: string | null;
  hospitalName?: string | null;
  companyName?: string | null;
  contractNumber?: string | null;
  extractYear?: string | null;
  extractMonth?: string | null;
  paymentNumber?: string | null;
}): string {
  const parts = [
    "v1",
    String(input.userId),
    norm(input.extractType),
    norm(input.adminOfficePart || ""),
    norm(input.hospitalName || ""),
    norm(input.companyName || ""),
    norm(input.contractNumber || ""),
    norm(input.extractYear || ""),
    norm(input.extractMonth || ""),
    norm(input.paymentNumber || ""),
  ];
  return parts.join("|").slice(0, 700);
}

// ─── حد حجم payload ومنع base64 داخل extractData ────────────────────────────
// Vercel Functions حدها 4.5MB للطلب والرد؛ نترك هامشًا لبيانات السجل والرؤوس.
// الحزمة تُقبل كاملة أو تُرفض كاملة، ولا يُحذف منها جدول لتجاوز الحد.
export const EXTRACT_DATA_MAX_BYTES = 4 * 1024 * 1024;

const DATA_URI_RE = /data:(?:image|application|audio|video)\/[a-z0-9.+-]*;base64,/i;
const LONG_BASE64_RE = /;base64,[A-Za-z0-9+/=\s]{2000,}/;

export function validateExtractDataPayload(extractDataJson: string | null): { ok: true } | { ok: false; status: number; error: string } {
  if (extractDataJson == null) return { ok: true };
  const payloadBytes = Buffer.byteLength(extractDataJson, "utf8");
  if (payloadBytes > EXTRACT_DATA_MAX_BYTES) {
    return {
      ok: false,
      status: 413,
      error: `حجم بيانات المستخلص الكامل كبير جدًا (${Math.round(payloadBytes / 1024)}KB). الحد الآمن ${Math.round(EXTRACT_DATA_MAX_BYTES / 1024)}KB. لم يتم حفظ نسخة ناقصة.`,
    };
  }
  if (DATA_URI_RE.test(extractDataJson) || LONG_BASE64_RE.test(extractDataJson)) {
    return {
      ok: false,
      status: 400,
      error: "بيانات المستخلص تحتوي صورًا/ملفات base64 مضمّنة. لا يُسمح بتخزين الصور داخل المستخلص المرفوع — تُحفظ الترويسات والتواقيع في إعدادات المستشفى فقط.",
    };
  }
  return { ok: true };
}

// أعمدة القائمة الخفيفة — بدون extractData إطلاقًا (لا اختيار ولا حذف في الذاكرة).
export function liteListColumns() {
  return {
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
    adminOfficePart: submittedExtractsTable.adminOfficePart,
    sourceModule: submittedExtractsTable.sourceModule,
    reviewScope: submittedExtractsTable.reviewScope,
    createdAt: submittedExtractsTable.createdAt,
    updatedAt: submittedExtractsTable.updatedAt,
    userId: submittedExtractsTable.userId,
    submittedByName: usersTable.name,
    submittedByEmail: usersTable.email,
    submittedByHospital: usersTable.hospital,
  };
}
