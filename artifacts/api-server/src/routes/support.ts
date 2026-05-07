import { Router } from "express";
import { getAuth } from "@clerk/express";
import { sendSupportEmail } from "../lib/email";

const ADMIN_EMAIL = "rorofikri@gmail.com";
const router = Router();

// POST /api/support — send a support ticket to admin
router.post("/", async (req, res) => {
  // Allow unauthenticated (for users who can't log in yet)
  const auth = getAuth(req);

  const { name, email, subject, message } = req.body;
  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: "جميع الحقول مطلوبة" });
  }

  try {
    await sendSupportEmail(ADMIN_EMAIL, { name, email, subject, message });
    return res.json({ sent: true });
  } catch (err) {
    req.log.error({ err }, "Failed to send support ticket");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
