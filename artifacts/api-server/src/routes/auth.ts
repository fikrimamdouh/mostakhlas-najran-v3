import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendWelcomeEmail } from "../lib/email";

const router = Router();

// Called after Clerk sign-up to register/sync user in our DB
// Mounted at /users so this handles POST /api/users/sync
router.post("/sync", async (req, res) => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const { email, name, company, phone } = req.body;

    const existing = await db.select().from(usersTable).where(eq(usersTable.clerkId, userId)).limit(1);

    if (existing.length > 0) {
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
    }).returning();

    // Send welcome email asynchronously
    sendWelcomeEmail(user.email, user.name).catch(() => {});

    return res.status(201).json(user);
  } catch (err) {
    req.log.error({ err }, "Failed to sync user");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
