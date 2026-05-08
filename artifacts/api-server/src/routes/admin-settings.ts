import { Router } from "express";
import { db, usersTable, systemSettingsTable } from "@workspace/db";
import { requireAuth } from "../middleware/requireAuth";
import { eq } from "drizzle-orm";

const router = Router();

const requireAdmin = async (req: any, res: any, next: any) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.clerkUserId)).limit(1);
  if (!user || user.role !== "admin") return res.status(403).json({ error: "Admin only" });
  (req as any).currentUser = user;
  next();
};

// GET /api/admin/settings?key=<key>
router.get("/", requireAuth, requireAdmin, async (req, res) => {
  const key = req.query["key"] as string | undefined;
  if (!key) return res.status(400).json({ error: "key required" });
  const [row] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, key)).limit(1);
  if (!row) return res.status(404).json({ value: null });
  return res.json({ key: row.key, value: row.value });
});

// POST /api/admin/settings  { key, value }
router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const { key, value } = req.body as { key?: string; value?: string };
  if (!key || value === undefined) return res.status(400).json({ error: "key and value required" });

  const ALLOWED_KEYS = ["admin_email", "admin_email_cc", "monthly_reminder_day", "system_name"];
  if (!ALLOWED_KEYS.includes(key)) return res.status(400).json({ error: "Unknown setting key" });

  const currentUser = (req as any).currentUser;

  await db.insert(systemSettingsTable)
    .values({ key, value, updatedBy: currentUser.email })
    .onConflictDoUpdate({
      target: systemSettingsTable.key,
      set: { value, updatedAt: new Date(), updatedBy: currentUser.email },
    });

  req.log.info({ key, updatedBy: currentUser.email }, "System setting updated");
  return res.json({ ok: true, key, value });
});

export default router;
