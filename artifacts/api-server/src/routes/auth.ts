import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendAdminNewSignupEmail, sendWelcomeEmail } from "../lib/email";

const router = Router();

const PRIMARY_ADMIN_EMAIL = (process.env.PRIMARY_ADMIN_EMAIL || "rorofikri@gmail.com").trim().toLowerCase();
const PRIMARY_ADMIN_CLERK_ID = (process.env.PRIMARY_ADMIN_CLERK_ID || "user_3DIFbR0YQyLX8xxPdBCeLl2CcTX").trim();

// Called after Clerk sign-up to register/sync user in our DB
// Mounted at /users so this handles POST /api/users/sync
router.post("/sync", async (req, res) => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const { email, name, company, hospital, position, phone } = req.body;

    const existing = await db.select().from(usersTable).where(eq(usersTable.clerkId, userId)).limit(1);

    const normalizedEmail = String(email || "").trim().toLowerCase();
    const existingEmail = String(existing[0]?.email || "").trim().toLowerCase();
    const isPrimaryAdmin = normalizedEmail === PRIMARY_ADMIN_EMAIL || existingEmail === PRIMARY_ADMIN_EMAIL || (PRIMARY_ADMIN_CLERK_ID && userId === PRIMARY_ADMIN_CLERK_ID);

    if (existing.length > 0) {
      if (isPrimaryAdmin && (existing[0].role !== "admin" || existing[0].status !== "approved")) {
        const [upgraded] = await db.update(usersTable)
          .set({ role: "admin", status: "approved" })
          .where(eq(usersTable.id, existing[0].id))
          .returning();
        return res.json(upgraded);
      }
      return res.json(existing[0]);
    }

    const [user] = await db.insert(usersTable).values({
      clerkId: userId,
      email: email || existing[0]?.email || "",
      name: name || "مستخدم جديد",
      role: isPrimaryAdmin ? "admin" : "company",
      status: isPrimaryAdmin ? "approved" : "pending",
      company: company || null,
      phone: phone || null,
    }).returning();

    // Send notifications asynchronously
    sendWelcomeEmail(user.email, user.name).catch(() => {});
    sendAdminNewSignupEmail(PRIMARY_ADMIN_EMAIL, {
      name: user.name,
      email: user.email,
      company: user.company,
      hospital: hospital || null,
      position: position || null,
      phone: user.phone,
    }).catch(() => {});

    return res.status(201).json(user);
  } catch (err) {
    req.log.error({ err }, "Failed to sync user");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
