import type { NextFunction, Request, Response } from "express";
import { findCurrentUser } from "../lib/current-user";
import { hasClusterVisitManagement } from "../lib/visit-security";

/**
 * Database-only permission gate for the visit-management center.
 * Deliberately ignores role and email: administrators also receive 403 unless
 * `allowed_modules` explicitly contains `cluster_visit_management`.
 */
export async function requireClusterVisitManagement(req: Request & { currentUser?: any }, res: Response, next: NextFunction) {
  try {
    const user = req.currentUser || await findCurrentUser(req as any);
    if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول" });
    if (!hasClusterVisitManagement(user)) {
      return res.status(403).json({ error: "صلاحية إدارة مركز الزيارات مطلوبة" });
    }
    req.currentUser = user;
    return next();
  } catch (err) {
    req.log?.error?.({ err }, "requireClusterVisitManagement failed");
    return res.status(500).json({ error: "تعذر التحقق من صلاحية مركز الزيارات" });
  }
}

export default requireClusterVisitManagement;
