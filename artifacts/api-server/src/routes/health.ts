import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

router.get("/healthz/full", async (_req, res) => {
  const dbUrl = process.env.DATABASE_URL ?? "";
  let dbHost = "NOT_SET";
  try { dbHost = dbUrl ? new URL(dbUrl).hostname : "NOT_SET"; } catch {}

  let dbOk = false;
  let dbError = "";
  try {
    await pool.query("SELECT 1");
    dbOk = true;
  } catch (err: any) {
    dbError = err?.message ?? "unknown";
  }

  res.json({
    status: dbOk ? "ok" : "degraded",
    clerk_secret_key_set: !!process.env.CLERK_SECRET_KEY,
    database_url_set: !!dbUrl,
    database_host: dbHost,
    database_ok: dbOk,
    database_error: dbError || undefined,
    node_env: process.env.NODE_ENV,
  });
});

export default router;
