import { Router } from "express";

const router = Router();

const COMPANY_NAME = "شركة العالمية للصناعات الحديثة";
const FIRE_SYSTEMS = new Set([
  "صيانة وإصلاح نظام إطفاء الحريق",
  "صيانة وإصلاح نظام إنذار الحريق",
]);

// The company is created through the normal visit-management UI. This response
// overlay only links that existing active company to both fire-system catalogue
// entries; it never creates a second contractor row or mutates historical data.
router.get("/management/bootstrap", (req: any, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = ((body: any) => {
    try {
      if (body && Array.isArray(body.contractors) && Array.isArray(body.approvedSubcontractors)) {
        const contractor = body.contractors.find((row: any) =>
          row?.isActive !== false && String(row?.displayName || row?.name || "").trim() === COMPANY_NAME,
        );

        if (contractor) {
          body.approvedSubcontractors = body.approvedSubcontractors.map((catalog: any) => {
            if (!FIRE_SYSTEMS.has(String(catalog?.systemName || ""))) return catalog;
            const contractors = Array.isArray(catalog.contractors) ? catalog.contractors : [];
            const alreadyLinked = contractors.some((row: any) =>
              Number(row?.id) === Number(contractor.id) || String(row?.name || "").trim() === COMPANY_NAME,
            );
            if (alreadyLinked) return catalog;
            return {
              ...catalog,
              contractors: [...contractors, { id: contractor.id, name: COMPANY_NAME }],
            };
          });
        }
      }
    } catch (err) {
      req.log?.warn?.({ err }, "Failed to overlay fire-system company catalogue link");
    }
    return originalJson(body);
  }) as any;
  return next();
});

export default router;
