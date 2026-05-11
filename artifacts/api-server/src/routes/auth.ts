import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendWelcomeEmail, sendAdminNewUserEmail } from "../lib/email";
import { requireAuth } from "../middleware/requireAuth";

const ADMIN_EMAIL = "rorofikri@gmail.com";

const router = Router();

// Called after Clerk sign-up to register/sync user in our DB
// Mounted at /users so this handles POST /api/users/sync
router.post("/sync", requireAuth, async (req: any, res) => {
  const userId = req.clerkUserId;

  try {
    const { email, name, company, phone, hospital, jobTitle, contractNumber } = req.body;

    const existing = await db.select().from(usersTable).where(eq(usersTable.clerkId, userId)).limit(1);

    if (existing.length > 0) {
      // If returning user, update profile fields if provided
      if (phone || company || hospital || jobTitle || contractNumber) {
        const updates: Record<string, any> = {};
        if (phone) updates.phone = phone;
        if (company) updates.company = company;
        if (hospital) updates.hospital = hospital;
        if (jobTitle) updates.jobTitle = jobTitle;
        if (contractNumber) updates.contractNumber = contractNumber;
        // إذا لم تكن قائمة المواقع محددة بعد — ابدأها من الموقع الحالي
        if (hospital && !existing[0].hospitals) {
          updates.hospitals = JSON.stringify([hospital]);
        }
        const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, existing[0].id)).returning();
        return res.json(updated);
      }
      return res.json(existing[0]);
    }

    const [user] = await db.insert(usersTable).values({
      clerkId: userId,
      email: email || "",
      name: name || "مستخدم جديد",
      role: "user",
      status: "pending",
      company: company || null,
      phone: phone || null,
      hospital: hospital || null,
      hospitals: hospital ? JSON.stringify([hospital]) : null,
      jobTitle: jobTitle || null,
      contractNumber: contractNumber || null,
    }).returning();

    // Send welcome email to user
    sendWelcomeEmail(user.email, user.name).catch((err) => {
      req.log.error({ err }, "Failed to send welcome email");
    });

    // Notify admin of new user registration
    sendAdminNewUserEmail(ADMIN_EMAIL, {
      name: user.name,
      email: user.email,
      phone: user.phone,
      hospital: user.hospital,
      jobTitle: user.jobTitle,
      contractNumber: user.contractNumber,
    }).catch((err) => {
      req.log.error({ err }, "Failed to send admin new user email");
    });

    return res.status(201).json(user);
  } catch (err) {
    req.log.error({ err }, "Failed to sync user");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
