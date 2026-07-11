import { Router } from "express";
import { runScheduledBackup } from "../lib/backup-scheduler";

const router = Router();

/**
 * GET /api/cron/daily-backup
 * يُستدعى من Vercel Cron (vercel.json → crons). محمي بـ CRON_SECRET:
 * Vercel يرسل تلقائيًا Authorization: Bearer <CRON_SECRET> إذا كان المتغير معرفًا.
 * بدون CRON_SECRET صحيح: 401 دائمًا — لا تشغيل مفتوح للعامة.
 */
router.get("/daily-backup", async (req: any, res: any) => {
  try {
    const secret = process.env.CRON_SECRET;
    const auth = String(req.headers["authorization"] || "");
    if (!secret || auth !== `Bearer ${secret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const result = await runScheduledBackup("scheduler");
    return res.status(result.ok ? 200 : 500).json(result);
  } catch (err: any) {
    req.log?.error?.({ err }, "Cron daily-backup failed");
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
