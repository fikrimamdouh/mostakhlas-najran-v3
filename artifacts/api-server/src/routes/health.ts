import { Router, type IRouter } from "express";
import { db, pool, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { findCurrentUser } from "../lib/current-user";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

async function requireAdmin(req: any, res: any, next: any) {
  try {
    const user = await findCurrentUser(req);
    if (!user || user.role !== "admin") return res.status(403).json({ error: "Admin only" });
    req.currentUser = user;
    next();
  } catch (err) {
    req.log.error({ err }, "Health admin check failed");
    return res.status(500).json({ error: "Internal server error" });
  }
}

router.get("/healthz/full", requireAuth, requireAdmin, async (_req, res) => {
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
