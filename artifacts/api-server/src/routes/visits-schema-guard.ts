import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();
const POLICY_ADMIN_PATH = "/management/public-request-policy";
const POLICY_ADMIN_HEADER = "visit-center-v1";
let visitSchemaReady: Promise<void> | null = null;

async function applyLatestVisitSchema(): Promise<void> {
  await db.transaction(async (tx: any) => {
    // Serialise the small, additive production migration across serverless instances.
    await tx.execute(sql`select pg_advisory_xact_lock(94022, 1)`);
    await tx.execute(sql`alter table "visit_requests" add column if not exists "postponement_status" text`);
    await tx.execute(sql`alter table "visit_requests" add column if not exists "postponement_request_json" text`);
    await tx.execute(sql`create index if not exists "visit_requests_postponement_status_idx" on "visit_requests" ("postponement_status", "visit_date")`);
  });
}

async function ensureLatestVisitSchema(): Promise<void> {
  if (!visitSchemaReady) {
    visitSchemaReady = applyLatestVisitSchema().catch((error) => {
      // A transient connection/session failure must not permanently poison the process.
      visitSchemaReady = null;
      throw error;
    });
  }
  return visitSchemaReady;
}

router.use(async (req: any, res: any, next: any) => {
  try {
    await ensureLatestVisitSchema();
  } catch (err) {
    req.log.error({ err }, "Failed to apply additive visit schema update");
    return res.status(503).json({
      error: "تعذر تجهيز قاعدة بيانات الزيارات بأمان؛ لم يتم حفظ أي بيانات",
      code: "VISIT_SCHEMA_UPDATE_FAILED",
    });
  }

  // The switch belongs to the authenticated visit-management center only.
  // The public QR page deliberately sends no such header, so its hidden legacy
  // control can never be exposed even when a manager opens the public form.
  if (req.path === POLICY_ADMIN_PATH && req.get("x-visit-policy-admin") !== POLICY_ADMIN_HEADER) {
    return res.status(404).json({ error: "المسار غير متاح من الصفحة العامة" });
  }

  return next();
});

export default router;
