import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { logAudit } from "./audit";

const router = Router();

const requireAdmin = async (req: any, res: any, next: any) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.clerkUserId)).limit(1);
    if (!user || user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    req.currentUser = user;
    next();
  } catch (err) {
    req.log.error({ err }, "requireAdmin failed");
    res.status(500).json({ error: "Internal server error" });
  }
};

router.patch("/:userId/profile", requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId)) return res.status(400).json({ error: "Invalid user ID" });

    const { name, phone, jobTitle, hospital, company, contractNumber } = req.body || {};
    const updates: Record<string, any> = {};

    if (typeof name === "string" && name.trim()) updates.name = name.trim();
    if (phone !== undefined) updates.phone = String(phone || "").trim() || null;
    if (jobTitle !== undefined) updates.jobTitle = String(jobTitle || "").trim() || null;
    if (hospital !== undefined) updates.hospital = String(hospital || "").trim() || null;
    if (company !== undefined) updates.company = String(company || "").trim() || null;
    if (contractNumber !== undefined) updates.contractNumber = String(contractNumber || "").trim() || null;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid updates" });
    }

    const [oldUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!oldUser) return res.status(404).json({ error: "User not found" });

    const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, userId)).returning();

    const ip = req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress;
    logAudit(
      req.currentUser.id,
      req.currentUser.email,
      req.currentUser.name,
      "تعديل بيانات مستخدم",
      `تم تعديل بيانات ${oldUser.name} (${oldUser.email})`,
      ip
    );

    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update user profile by admin");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
