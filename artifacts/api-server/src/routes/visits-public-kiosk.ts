import { Router } from "express";
import QRCode from "qrcode";
import { requireAuth } from "../middleware/requireAuth";
import { requireClusterVisitManagement } from "../middleware/requireClusterVisitManagement";
import { findCurrentUser } from "../lib/current-user";
import { logAudit } from "./audit";

const router = Router();

async function requireApproved(req: any, res: any, next: any) {
  const user = req.currentUser || await findCurrentUser(req);
  if (!user) return res.status(401).json({ error: "يجب تسجيل الدخول" });
  if (user.status !== "approved") return res.status(403).json({ error: "الحساب غير معتمد" });
  req.currentUser = user;
  return next();
}

function publicOrigin(req: any): string {
  const configured = String(process.env.PUBLIC_APP_URL || process.env.APP_URL || "").trim().replace(/\/$/, "");
  if (configured) return configured;
  const forwardedProto = String(req.get("x-forwarded-proto") || "").split(",")[0].trim();
  const protocol = forwardedProto || req.protocol || "https";
  const host = String(req.get("x-forwarded-host") || req.get("host") || "mostakhlas-najran.com").split(",")[0].trim();
  return `${protocol}://${host}`;
}

router.post("/management/request-form-qr", requireAuth, requireApproved, requireClusterVisitManagement, async (req: any, res) => {
  try {
    const requestUrl = `${publicOrigin(req)}/visit-request-form.html`;
    const qrDataUrl = await QRCode.toDataURL(requestUrl, { errorCorrectionLevel: "M", margin: 2, width: 520 });
    await logAudit(
      req.currentUser.id,
      req.currentUser.email,
      req.currentUser.name,
      "تجهيز باركود عام متعدد اللغات لنموذج طلب الزيارة",
      JSON.stringify({ requestUrl, scope: "all_sites_all_maintenance_contractors", languages: ["ar", "en", "ur", "hi"] }),
      req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.socket.remoteAddress || "unknown",
    );
    res.setHeader("Cache-Control", "no-store");
    return res.json({
      requestUrl,
      qrDataUrl,
      scope: "all_sites_all_maintenance_contractors",
      languages: ["ar", "en", "ur", "hi"],
      siteName: "جميع المواقع",
      maintenanceContractor: "جميع مقاولي الصيانة",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to generate public multilingual visit request QR");
    return res.status(500).json({ error: "تعذر تجهيز الباركود العام لنموذج طلب الزيارة" });
  }
});

export default router;
