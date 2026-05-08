import { Router } from "express";
import { sendSupportEmail } from "../lib/email";
import { db, systemSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const ADMIN_EMAIL_FALLBACK = "rorofikri@gmail.com";
const router = Router();

async function getAdminEmail(): Promise<string> {
  try {
    const [row] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, "admin_email")).limit(1);
    return row?.value || ADMIN_EMAIL_FALLBACK;
  } catch {
    return ADMIN_EMAIL_FALLBACK;
  }
}

// POST /api/support — send a support ticket to admin
router.post("/", async (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: "جميع الحقول مطلوبة" });
  }

  try {
    const adminEmail = await getAdminEmail();
    await sendSupportEmail(adminEmail, { name, email, subject, message });
    return res.json({ sent: true });
  } catch (err) {
    req.log.error({ err }, "Failed to send support ticket");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
