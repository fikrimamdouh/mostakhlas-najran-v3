import { Router } from "express";
import multer from "multer";
import AdmZip from "adm-zip";
import { createHash } from "crypto";
import {
  db,
  usersTable,
  visitRequestsTable,
  systemSettingsTable,
  auditLogTable,
  visitSystemsTable,
  visitContractorsTable,
  visitQualificationsTable,
  visitSiteApprovalsTable,
  visitRepresentativesTable,
  visitRepresentativeSystemsTable,
  visitDocumentsTable,
  visitRequestMetadataTable,
} from "@workspace/db";
import { requireAuth } from "../middleware/requireAuth";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

const router = Router();
const VISIT_MANAGER_EMAIL = "rorofikri@gmail.com";

const uploadDocument = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

const uploadZip = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 90 * 1024 * 1024 },
});

const requireApproved = async (req: any, res: any, next: any) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, req.clerkUserId)).limit(1);
  if (!user) return res.status(401).json({ error: "User not registered" });
  if (user.status !== "approved" && user.role !== "admin") {
    return res.status(403).json({ error: "Account pending approval" });
  }
  req.currentUser = user;
  next();
};

const requireVisitManager = (req: any, res: any, next: any) => {
  const email = String(req.currentUser?.email || "").trim().toLowerCase();
  if (email !== VISIT_MANAGER_EMAIL) {
    return res.status(403).json({ error: "هذه الوحدة مخصصة لمدير إدارة التجمع" });
  }
  next();
};

function normalizeArabic(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateIsActive(validFrom: string | null, validTo: string | null): boolean {
  const today = todayIso();
  if (validFrom && validFrom > today) return false;
  if (validTo && validTo < today) return false;
  return true;
}

async function audit(req: any, action: string, details: Record<string, unknown>) {
  const user = req.currentUser;
  await db.insert(auditLogTable).values({
    userId: user?.id || null,
    userEmail: user?.email || null,
    userName: user?.name || null,
    action,
    details: JSON.stringify(details),
    ipAddress: req.ip || null,
  });
}

async function getSetting(key: string): Promise<string | null> {
  const [row] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, key)).limit(1);
  return row?.value ?? null;
}

async function setSetting(key: string, value: string, updatedBy: string) {
  const [existing] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, key)).limit(1);
  if (existing) {
    await db.update(systemSettingsTable)
      .set({ value, updatedAt: new Date(), updatedBy })
      .where(eq(systemSettingsTable.key, key));
  } else {
    await db.insert(systemSettingsTable).values({ key, value, updatedBy });
  }
}

async function nextSerial(site: string, contract: string | null, updatedBy: string): Promise<string> {
  const year = new Date().getFullYear();
  const safeSite = normalizeArabic(site).replace(/\s+/g, "_") || "unknown";
  const safeContract = normalizeArabic(contract).replace(/\s+/g, "_") || "unknown";
  const key = `visit_serial_${year}_${safeSite}_${safeContract}`;
  const current = parseInt((await getSetting(key)) || "0", 10) || 0;
  const next = current + 1;
  await setSetting(key, String(next), updatedBy);
  return String(next).padStart(4, "0");
}

function safeText(value: unknown, max = 500): string {
  return String(value || "").trim().slice(0, max);
}

function parseId(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function decodeUnicodeFilename(value: string): string {
  return value.replace(/#U([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function extractImportNames(entryName: string): { systemName: string; contractorName: string; certificateNumber: string | null } | null {
  const decoded = decodeUnicodeFilename(entryName).replace(/\\/g, "/");
  const parts = decoded.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const fileName = parts[parts.length - 1].replace(/\.pdf$/i, "").trim();
  let systemName = parts[parts.length - 2].trim();
  if (normalizeArabic(systemName).includes("مقاولي الباطن المؤهلين")) return null;
  systemName = systemName.replace(/\s+/g, " ");
  const certMatch = fileName.match(/^\s*(\d+)\s*/);
  const certificateNumber = certMatch ? certMatch[1] : null;
  let candidate = fileName.replace(/^\s*\d+\s*/, "").trim();
  const systemTokens = new Set(normalizeArabic(systemName).split(" ").filter(Boolean));
  const originalWords = candidate.split(/\s+/).filter(Boolean);
  const filtered = originalWords.filter((word) => !systemTokens.has(normalizeArabic(word)));
  candidate = filtered.join(" ")
    .replace(/\b(معدل|نسخه|نسخة|شهاده|شهادة)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (candidate.length < 3) candidate = fileName.replace(/^\s*\d+\s*/, "").trim();
  return { systemName, contractorName: candidate, certificateNumber };
}

router.use(requireAuth, requireApproved, requireVisitManager);

router.get("/bootstrap", async (req: any, res) => {
  const [users, systems, contractors, qualifications, approvals, representatives, representativeSystems, documents, visits, metadata] = await Promise.all([
    db.select({ hospital: usersTable.hospital, company: usersTable.company, contractNumber: usersTable.contractNumber })
      .from(usersTable)
      .orderBy(asc(usersTable.hospital)),
    db.select().from(visitSystemsTable).orderBy(asc(visitSystemsTable.name)),
    db.select().from(visitContractorsTable).orderBy(asc(visitContractorsTable.name)),
    db.select().from(visitQualificationsTable).orderBy(desc(visitQualificationsTable.updatedAt)),
    db.select().from(visitSiteApprovalsTable).orderBy(asc(visitSiteApprovalsTable.hospitalName)),
    db.select().from(visitRepresentativesTable).orderBy(asc(visitRepresentativesTable.fullName)),
    db.select().from(visitRepresentativeSystemsTable),
    db.select({
      id: visitDocumentsTable.id,
      ownerType: visitDocumentsTable.ownerType,
      ownerId: visitDocumentsTable.ownerId,
      documentType: visitDocumentsTable.documentType,
      fileName: visitDocumentsTable.fileName,
      mimeType: visitDocumentsTable.mimeType,
      sizeBytes: visitDocumentsTable.sizeBytes,
      sha256: visitDocumentsTable.sha256,
      expiresAt: visitDocumentsTable.expiresAt,
      isActive: visitDocumentsTable.isActive,
      createdAt: visitDocumentsTable.createdAt,
    }).from(visitDocumentsTable).where(eq(visitDocumentsTable.isActive, true)).orderBy(desc(visitDocumentsTable.createdAt)),
    db.select().from(visitRequestsTable).orderBy(desc(visitRequestsTable.createdAt)).limit(1000),
    db.select().from(visitRequestMetadataTable),
  ]);

  const siteMap = new Map<string, { hospitalName: string; mainContractor: string | null; contractNumber: string | null }>();
  for (const row of users) {
    const hospitalName = safeText(row.hospital, 250);
    if (!hospitalName) continue;
    const key = normalizeArabic(hospitalName);
    if (!siteMap.has(key)) {
      siteMap.set(key, {
        hospitalName,
        mainContractor: row.company || null,
        contractNumber: row.contractNumber || null,
      });
    }
  }
  for (const row of approvals) {
    const key = normalizeArabic(row.hospitalName);
    if (!siteMap.has(key)) {
      siteMap.set(key, {
        hospitalName: row.hospitalName,
        mainContractor: row.mainContractor || null,
        contractNumber: row.contractNumber || null,
      });
    }
  }

  return res.json({
    manager: { id: req.currentUser.id, name: req.currentUser.name, email: req.currentUser.email },
    sites: Array.from(siteMap.values()).sort((a, b) => a.hospitalName.localeCompare(b.hospitalName, "ar")),
    systems,
    contractors,
    qualifications,
    approvals,
    representatives,
    representativeSystems,
    documents,
    visits,
    metadata,
  });
});

router.post("/systems", async (req: any, res) => {
  const name = safeText(req.body?.name, 250);
  if (!name) return res.status(400).json({ error: "اسم النظام مطلوب" });
  const normalizedName = normalizeArabic(name);
  const [existing] = await db.select().from(visitSystemsTable).where(eq(visitSystemsTable.normalizedName, normalizedName)).limit(1);
  if (existing) return res.json({ system: existing, existed: true });
  const [system] = await db.insert(visitSystemsTable).values({
    name,
    normalizedName,
    code: safeText(req.body?.code, 80) || null,
    notes: safeText(req.body?.notes, 1000) || null,
  }).returning();
  await audit(req, "visit_system_created", { id: system.id, name });
  return res.status(201).json({ system });
});

router.patch("/systems/:id", async (req: any, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid id" });
  const data: any = { updatedAt: new Date() };
  if (req.body?.name !== undefined) {
    const name = safeText(req.body.name, 250);
    if (!name) return res.status(400).json({ error: "اسم النظام مطلوب" });
    data.name = name;
    data.normalizedName = normalizeArabic(name);
  }
  if (req.body?.code !== undefined) data.code = safeText(req.body.code, 80) || null;
  if (req.body?.notes !== undefined) data.notes = safeText(req.body.notes, 1000) || null;
  if (req.body?.isActive !== undefined) data.isActive = Boolean(req.body.isActive);
  const [system] = await db.update(visitSystemsTable).set(data).where(eq(visitSystemsTable.id, id)).returning();
  if (!system) return res.status(404).json({ error: "النظام غير موجود" });
  await audit(req, "visit_system_updated", { id, data });
  return res.json({ system });
});

router.post("/contractors", async (req: any, res) => {
  const name = safeText(req.body?.name, 300);
  if (!name) return res.status(400).json({ error: "اسم الشركة مطلوب" });
  const normalizedName = normalizeArabic(name);
  const [existing] = await db.select().from(visitContractorsTable).where(eq(visitContractorsTable.normalizedName, normalizedName)).limit(1);
  if (existing) return res.json({ contractor: existing, existed: true });
  const [contractor] = await db.insert(visitContractorsTable).values({
    name,
    normalizedName,
    shortName: safeText(req.body?.shortName, 120) || null,
    commercialRegistration: safeText(req.body?.commercialRegistration, 80) || null,
    contactPhone: safeText(req.body?.contactPhone, 40) || null,
    contactEmail: safeText(req.body?.contactEmail, 200) || null,
    status: req.body?.status === "suspended" || req.body?.status === "inactive" ? req.body.status : "active",
    documentStatus: req.body?.documentStatus === "uploaded" ? "uploaded" : "not_uploaded",
    source: "manual",
    notes: safeText(req.body?.notes, 1500) || null,
  }).returning();
  await audit(req, "visit_contractor_created", { id: contractor.id, name });
  return res.status(201).json({ contractor });
});

router.patch("/contractors/:id", async (req: any, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid id" });
  const data: any = { updatedAt: new Date() };
  const fields = ["shortName", "commercialRegistration", "contactPhone", "contactEmail", "notes"];
  if (req.body?.name !== undefined) {
    const name = safeText(req.body.name, 300);
    if (!name) return res.status(400).json({ error: "اسم الشركة مطلوب" });
    data.name = name;
    data.normalizedName = normalizeArabic(name);
  }
  for (const field of fields) if (req.body?.[field] !== undefined) data[field] = safeText(req.body[field], field === "notes" ? 1500 : 250) || null;
  if (["active", "suspended", "inactive"].includes(req.body?.status)) data.status = req.body.status;
  if (["uploaded", "not_uploaded"].includes(req.body?.documentStatus)) data.documentStatus = req.body.documentStatus;
  const [contractor] = await db.update(visitContractorsTable).set(data).where(eq(visitContractorsTable.id, id)).returning();
  if (!contractor) return res.status(404).json({ error: "الشركة غير موجودة" });
  await audit(req, "visit_contractor_updated", { id, data });
  return res.json({ contractor });
});

router.post("/qualifications", async (req: any, res) => {
  const contractorId = parseId(req.body?.contractorId);
  const systemId = parseId(req.body?.systemId);
  if (!contractorId || !systemId) return res.status(400).json({ error: "الشركة والنظام مطلوبان" });
  const [existing] = await db.select().from(visitQualificationsTable).where(and(
    eq(visitQualificationsTable.contractorId, contractorId),
    eq(visitQualificationsTable.systemId, systemId),
  )).limit(1);
  const values: any = {
    contractorId,
    systemId,
    certificateNumber: safeText(req.body?.certificateNumber, 120) || null,
    validFrom: safeText(req.body?.validFrom, 10) || null,
    validTo: safeText(req.body?.validTo, 10) || null,
    status: ["approved", "pending", "suspended", "expired"].includes(req.body?.status) ? req.body.status : "approved",
    documentStatus: req.body?.documentStatus === "uploaded" ? "uploaded" : "not_uploaded",
    source: "manual",
    notes: safeText(req.body?.notes, 1500) || null,
    updatedAt: new Date(),
  };
  let qualification;
  if (existing) {
    [qualification] = await db.update(visitQualificationsTable).set(values).where(eq(visitQualificationsTable.id, existing.id)).returning();
  } else {
    [qualification] = await db.insert(visitQualificationsTable).values(values).returning();
  }
  await audit(req, "visit_qualification_saved", { id: qualification.id, contractorId, systemId });
  return res.status(existing ? 200 : 201).json({ qualification });
});

router.post("/approvals", async (req: any, res) => {
  const hospitalName = safeText(req.body?.hospitalName, 300);
  const systemId = parseId(req.body?.systemId);
  const contractorId = parseId(req.body?.contractorId);
  if (!hospitalName || !systemId || !contractorId) return res.status(400).json({ error: "الموقع والنظام والشركة مطلوبة" });
  const [existing] = await db.select().from(visitSiteApprovalsTable).where(and(
    eq(visitSiteApprovalsTable.hospitalName, hospitalName),
    eq(visitSiteApprovalsTable.systemId, systemId),
    eq(visitSiteApprovalsTable.contractorId, contractorId),
  )).limit(1);
  const qualificationId = parseId(req.body?.qualificationId);
  const values: any = {
    hospitalName,
    mainContractor: safeText(req.body?.mainContractor, 300) || null,
    contractNumber: safeText(req.body?.contractNumber, 120) || null,
    systemId,
    contractorId,
    qualificationId,
    status: ["approved", "pending", "suspended", "expired"].includes(req.body?.status) ? req.body.status : "approved",
    validFrom: safeText(req.body?.validFrom, 10) || null,
    validTo: safeText(req.body?.validTo, 10) || null,
    approvalReference: safeText(req.body?.approvalReference, 180) || null,
    documentStatus: req.body?.documentStatus === "uploaded" ? "uploaded" : "not_uploaded",
    source: "manual",
    notes: safeText(req.body?.notes, 1500) || null,
    updatedAt: new Date(),
  };
  let approval;
  if (existing) {
    [approval] = await db.update(visitSiteApprovalsTable).set(values).where(eq(visitSiteApprovalsTable.id, existing.id)).returning();
  } else {
    [approval] = await db.insert(visitSiteApprovalsTable).values(values).returning();
  }
  await audit(req, "visit_site_approval_saved", { id: approval.id, hospitalName, systemId, contractorId });
  return res.status(existing ? 200 : 201).json({ approval });
});

router.patch("/approvals/:id", async (req: any, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid id" });
  const data: any = { updatedAt: new Date() };
  for (const field of ["hospitalName", "mainContractor", "contractNumber", "validFrom", "validTo", "approvalReference", "notes"]) {
    if (req.body?.[field] !== undefined) data[field] = safeText(req.body[field], field === "notes" ? 1500 : 300) || null;
  }
  if (["approved", "pending", "suspended", "expired"].includes(req.body?.status)) data.status = req.body.status;
  if (["uploaded", "not_uploaded"].includes(req.body?.documentStatus)) data.documentStatus = req.body.documentStatus;
  const [approval] = await db.update(visitSiteApprovalsTable).set(data).where(eq(visitSiteApprovalsTable.id, id)).returning();
  if (!approval) return res.status(404).json({ error: "الاعتماد غير موجود" });
  await audit(req, "visit_site_approval_updated", { id, data });
  return res.json({ approval });
});

router.post("/representatives", async (req: any, res) => {
  const contractorId = parseId(req.body?.contractorId);
  const fullName = safeText(req.body?.fullName, 300);
  const nationalId = safeText(req.body?.nationalId, 30).replace(/\s+/g, "");
  if (!contractorId || !fullName || !nationalId) return res.status(400).json({ error: "الشركة والاسم ورقم الهوية/الإقامة مطلوبة" });
  if (!/^\d{10}$/.test(nationalId)) return res.status(400).json({ error: "رقم الهوية/الإقامة يجب أن يكون 10 أرقام" });
  const [existing] = await db.select().from(visitRepresentativesTable).where(eq(visitRepresentativesTable.nationalId, nationalId)).limit(1);
  const values: any = {
    contractorId,
    fullName,
    nationalId,
    mobile: safeText(req.body?.mobile, 30) || null,
    nationality: safeText(req.body?.nationality, 100) || null,
    jobTitle: safeText(req.body?.jobTitle, 150) || null,
    idExpiry: safeText(req.body?.idExpiry, 10) || null,
    status: ["active", "pending", "suspended", "expired"].includes(req.body?.status) ? req.body.status : "active",
    source: existing?.source || "manual",
    notes: safeText(req.body?.notes, 1500) || null,
    updatedAt: new Date(),
  };
  let representative;
  if (existing) {
    [representative] = await db.update(visitRepresentativesTable).set(values).where(eq(visitRepresentativesTable.id, existing.id)).returning();
  } else {
    [representative] = await db.insert(visitRepresentativesTable).values(values).returning();
  }
  await audit(req, "visit_representative_saved", { id: representative.id, contractorId, nationalId });
  return res.status(existing ? 200 : 201).json({ representative });
});

router.patch("/representatives/:id", async (req: any, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid id" });
  const data: any = { updatedAt: new Date() };
  for (const field of ["fullName", "nationalId", "mobile", "nationality", "jobTitle", "idExpiry", "notes"]) {
    if (req.body?.[field] !== undefined) data[field] = safeText(req.body[field], field === "notes" ? 1500 : 300) || null;
  }
  if (data.nationalId && !/^\d{10}$/.test(data.nationalId)) return res.status(400).json({ error: "رقم الهوية/الإقامة يجب أن يكون 10 أرقام" });
  if (["active", "pending", "suspended", "expired"].includes(req.body?.status)) data.status = req.body.status;
  if (parseId(req.body?.contractorId)) data.contractorId = parseId(req.body.contractorId);
  const [representative] = await db.update(visitRepresentativesTable).set(data).where(eq(visitRepresentativesTable.id, id)).returning();
  if (!representative) return res.status(404).json({ error: "المندوب غير موجود" });
  await audit(req, "visit_representative_updated", { id, data });
  return res.json({ representative });
});

router.put("/representatives/:id/systems", async (req: any, res) => {
  const representativeId = parseId(req.params.id);
  const systemIds = Array.isArray(req.body?.systemIds) ? req.body.systemIds.map(parseId).filter(Boolean) as number[] : [];
  if (!representativeId) return res.status(400).json({ error: "Invalid id" });
  await db.delete(visitRepresentativeSystemsTable).where(eq(visitRepresentativeSystemsTable.representativeId, representativeId));
  if (systemIds.length) {
    await db.insert(visitRepresentativeSystemsTable).values(systemIds.map((systemId) => ({ representativeId, systemId })));
  }
  await audit(req, "visit_representative_systems_updated", { representativeId, systemIds });
  return res.json({ ok: true, systemIds });
});

router.post("/documents/:ownerType/:ownerId", uploadDocument.single("file"), async (req: any, res) => {
  const ownerType = safeText(req.params.ownerType, 40);
  const ownerId = parseId(req.params.ownerId);
  const allowedOwnerTypes = ["contractor", "qualification", "site_approval", "representative", "visit"];
  const allowedDocumentTypes = ["qualification_certificate", "approval_letter", "iqama_front", "iqama_back", "iqama_pdf", "signed_permit", "other"];
  const documentType = safeText(req.body?.documentType, 60);
  if (!ownerId || !allowedOwnerTypes.includes(ownerType)) return res.status(400).json({ error: "مالك المستند غير صحيح" });
  if (!allowedDocumentTypes.includes(documentType)) return res.status(400).json({ error: "نوع المستند غير صحيح" });
  if (!req.file) return res.status(400).json({ error: "لم يتم اختيار ملف" });
  const mime = req.file.mimetype || "application/octet-stream";
  if (!mime.startsWith("image/") && mime !== "application/pdf") return res.status(400).json({ error: "المسموح صورة أو PDF فقط" });
  const sha256 = createHash("sha256").update(req.file.buffer).digest("hex");
  const [duplicate] = await db.select().from(visitDocumentsTable).where(eq(visitDocumentsTable.sha256, sha256)).limit(1);
  if (duplicate) return res.json({ document: { ...duplicate, contentBase64: undefined }, duplicate: true });
  const [document] = await db.insert(visitDocumentsTable).values({
    ownerType: ownerType as any,
    ownerId,
    documentType: documentType as any,
    fileName: safeText(req.file.originalname, 300) || "document",
    mimeType: mime,
    sizeBytes: req.file.size,
    sha256,
    contentBase64: req.file.buffer.toString("base64"),
    expiresAt: safeText(req.body?.expiresAt, 10) || null,
    uploadedByUserId: req.currentUser.id,
  }).returning();
  if (ownerType === "contractor") {
    await db.update(visitContractorsTable).set({ documentStatus: "uploaded", updatedAt: new Date() }).where(eq(visitContractorsTable.id, ownerId));
  } else if (ownerType === "qualification") {
    await db.update(visitQualificationsTable).set({ documentStatus: "uploaded", updatedAt: new Date() }).where(eq(visitQualificationsTable.id, ownerId));
  } else if (ownerType === "site_approval") {
    await db.update(visitSiteApprovalsTable).set({ documentStatus: "uploaded", updatedAt: new Date() }).where(eq(visitSiteApprovalsTable.id, ownerId));
  }
  await audit(req, "visit_document_uploaded", { id: document.id, ownerType, ownerId, documentType, fileName: document.fileName });
  return res.status(201).json({ document: { ...document, contentBase64: undefined } });
});

router.get("/documents/:id", async (req: any, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid id" });
  const [document] = await db.select().from(visitDocumentsTable).where(and(eq(visitDocumentsTable.id, id), eq(visitDocumentsTable.isActive, true))).limit(1);
  if (!document) return res.status(404).json({ error: "المستند غير موجود" });
  await audit(req, "visit_document_viewed", { id, ownerType: document.ownerType, ownerId: document.ownerId });
  const buffer = Buffer.from(document.contentBase64, "base64");
  res.setHeader("Content-Type", document.mimeType);
  res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(document.fileName)}`);
  res.setHeader("Cache-Control", "private, no-store");
  return res.send(buffer);
});

router.delete("/documents/:id", async (req: any, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid id" });
  const [document] = await db.update(visitDocumentsTable).set({ isActive: false }).where(eq(visitDocumentsTable.id, id)).returning();
  if (!document) return res.status(404).json({ error: "المستند غير موجود" });
  await audit(req, "visit_document_disabled", { id });
  return res.json({ ok: true });
});

router.post("/direct", async (req: any, res) => {
  const siteLocation = safeText(req.body?.siteLocation, 300);
  const systemId = parseId(req.body?.systemId);
  const contractorId = parseId(req.body?.contractorId);
  const representativeId = parseId(req.body?.representativeId);
  const visitDate = safeText(req.body?.visitDate, 10);
  if (!siteLocation || !systemId || !contractorId || !representativeId || !/^\d{4}-\d{2}-\d{2}$/.test(visitDate)) {
    return res.status(400).json({ error: "بيانات الموقع والنظام والشركة والمندوب وتاريخ الزيارة مطلوبة" });
  }

  const [[system], [contractor], [representative], [approval], iqamaDocs] = await Promise.all([
    db.select().from(visitSystemsTable).where(eq(visitSystemsTable.id, systemId)).limit(1),
    db.select().from(visitContractorsTable).where(eq(visitContractorsTable.id, contractorId)).limit(1),
    db.select().from(visitRepresentativesTable).where(eq(visitRepresentativesTable.id, representativeId)).limit(1),
    db.select().from(visitSiteApprovalsTable).where(and(
      eq(visitSiteApprovalsTable.hospitalName, siteLocation),
      eq(visitSiteApprovalsTable.systemId, systemId),
      eq(visitSiteApprovalsTable.contractorId, contractorId),
    )).limit(1),
    db.select({ id: visitDocumentsTable.id }).from(visitDocumentsTable).where(and(
      eq(visitDocumentsTable.ownerType, "representative"),
      eq(visitDocumentsTable.ownerId, representativeId),
      eq(visitDocumentsTable.isActive, true),
      inArray(visitDocumentsTable.documentType, ["iqama_front", "iqama_back", "iqama_pdf"]),
    )),
  ]);

  if (!system || !system.isActive) return res.status(400).json({ error: "النظام غير فعال" });
  if (!contractor || contractor.status !== "active") return res.status(400).json({ error: "الشركة غير فعالة" });
  if (!approval || approval.status !== "approved" || !dateIsActive(approval.validFrom, approval.validTo)) {
    return res.status(400).json({ error: "الشركة غير معتمدة لهذا النظام في الموقع أو انتهت مدة الاعتماد" });
  }
  if (!representative || representative.contractorId !== contractorId || representative.status !== "active") {
    return res.status(400).json({ error: "المندوب غير فعال أو لا يتبع الشركة المختارة" });
  }
  if (!representative.mobile) return res.status(400).json({ error: "رقم جوال المندوب غير مسجل" });
  if (representative.idExpiry && representative.idExpiry < todayIso()) return res.status(400).json({ error: "هوية/إقامة المندوب منتهية" });
  const allowWithoutIqama = Boolean(req.body?.allowWithoutIqama);
  const overrideReason = safeText(req.body?.overrideReason, 1000);
  if (!iqamaDocs.length && !allowWithoutIqama) return res.status(400).json({ error: "يجب إرفاق الإقامة قبل إصدار الزيارة" });
  if (!iqamaDocs.length && allowWithoutIqama && !overrideReason) return res.status(400).json({ error: "سبب الإصدار الاستثنائي مطلوب" });

  const serialNumber = await nextSerial(siteLocation, approval.contractNumber, req.currentUser.email);
  const approvedAt = new Date();
  const [visit] = await db.insert(visitRequestsTable).values({
    userId: req.currentUser.id,
    repName: representative.fullName,
    siteLocation,
    repId: representative.nationalId,
    visitDate,
    repMobile: representative.mobile,
    systemName: system.name,
    mainContractor: approval.mainContractor || safeText(req.body?.mainContractor, 300) || "إدارة التجمع",
    subContractor: contractor.name,
    repIdPhoto: null,
    status: "approved",
    adminNotes: safeText(req.body?.notes, 1500) || null,
    submittedByName: req.currentUser.name,
    submittedByHospital: siteLocation,
    submittedByContract: approval.contractNumber || null,
    serialNumber,
    approvedAt,
  }).returning();

  const approvalSnapshot = JSON.stringify({
    siteApprovalId: approval.id,
    hospitalName: approval.hospitalName,
    system: { id: system.id, name: system.name },
    contractor: { id: contractor.id, name: contractor.name, documentStatus: contractor.documentStatus },
    representative: { id: representative.id, fullName: representative.fullName, nationalId: representative.nationalId, idExpiry: representative.idExpiry },
    approval: { status: approval.status, validFrom: approval.validFrom, validTo: approval.validTo, documentStatus: approval.documentStatus },
    iqamaDocumentIds: iqamaDocs.map((d) => d.id),
    issuedAt: approvedAt.toISOString(),
  });

  const [metadata] = await db.insert(visitRequestMetadataTable).values({
    visitRequestId: visit.id,
    source: "direct_issue",
    systemId,
    contractorId,
    representativeId,
    siteApprovalId: approval.id,
    issuedByUserId: req.currentUser.id,
    issuedByName: req.currentUser.name,
    approvalSnapshot,
    overrideReason: !iqamaDocs.length ? overrideReason : null,
  }).returning();

  await audit(req, "visit_direct_issued", { visitId: visit.id, serialNumber, siteLocation, systemId, contractorId, representativeId, overrideReason: metadata.overrideReason });
  return res.status(201).json({ visit, metadata });
});

router.patch("/visits/:id/cancel", async (req: any, res) => {
  const visitId = parseId(req.params.id);
  const reason = safeText(req.body?.reason, 1000);
  if (!visitId || !reason) return res.status(400).json({ error: "سبب الإلغاء مطلوب" });
  const [visit] = await db.update(visitRequestsTable).set({
    status: "rejected",
    adminNotes: `ملغاة: ${reason}`,
    updatedAt: new Date(),
  }).where(eq(visitRequestsTable.id, visitId)).returning();
  if (!visit) return res.status(404).json({ error: "الزيارة غير موجودة" });
  const [existing] = await db.select().from(visitRequestMetadataTable).where(eq(visitRequestMetadataTable.visitRequestId, visitId)).limit(1);
  if (existing) {
    await db.update(visitRequestMetadataTable).set({ cancelledAt: new Date(), cancelReason: reason, updatedAt: new Date() })
      .where(eq(visitRequestMetadataTable.id, existing.id));
  } else {
    await db.insert(visitRequestMetadataTable).values({ visitRequestId: visitId, source: "legacy", cancelledAt: new Date(), cancelReason: reason });
  }
  await audit(req, "visit_cancelled", { visitId, reason });
  return res.json({ visit });
});

router.post("/import-zip", uploadZip.single("file"), async (req: any, res) => {
  if (!req.file) return res.status(400).json({ error: "ملف ZIP مطلوب" });
  if (!/\.zip$/i.test(req.file.originalname) && req.file.mimetype !== "application/zip" && req.file.mimetype !== "application/x-zip-compressed") {
    return res.status(400).json({ error: "الملف يجب أن يكون ZIP" });
  }

  let zip: AdmZip;
  try {
    zip = new AdmZip(req.file.buffer);
  } catch {
    return res.status(400).json({ error: "تعذر قراءة ملف ZIP" });
  }

  const summary = {
    filesFound: 0,
    systemsCreated: 0,
    contractorsCreated: 0,
    qualificationsCreated: 0,
    documentsCreated: 0,
    duplicatesSkipped: 0,
    warnings: [] as string[],
  };

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory || !/\.pdf$/i.test(entry.entryName)) continue;
    summary.filesFound++;
    const parsed = extractImportNames(entry.entryName);
    if (!parsed || !parsed.systemName || !parsed.contractorName) {
      summary.warnings.push(`تعذر تفسير: ${decodeUnicodeFilename(entry.entryName)}`);
      continue;
    }

    const systemNormalized = normalizeArabic(parsed.systemName);
    let [system] = await db.select().from(visitSystemsTable).where(eq(visitSystemsTable.normalizedName, systemNormalized)).limit(1);
    if (!system) {
      [system] = await db.insert(visitSystemsTable).values({ name: parsed.systemName, normalizedName: systemNormalized, notes: "مستورد من أرشيف شهادات التأهيل" }).returning();
      summary.systemsCreated++;
    }

    const contractorNormalized = normalizeArabic(parsed.contractorName);
    let [contractor] = await db.select().from(visitContractorsTable).where(eq(visitContractorsTable.normalizedName, contractorNormalized)).limit(1);
    if (!contractor) {
      [contractor] = await db.insert(visitContractorsTable).values({
        name: parsed.contractorName,
        normalizedName: contractorNormalized,
        status: "active",
        documentStatus: "uploaded",
        source: "zip_import",
        notes: "تم إنشاؤها من أرشيف شهادات مقاولي الباطن",
      }).returning();
      summary.contractorsCreated++;
    }

    let [qualification] = await db.select().from(visitQualificationsTable).where(and(
      eq(visitQualificationsTable.contractorId, contractor.id),
      eq(visitQualificationsTable.systemId, system.id),
    )).limit(1);
    if (!qualification) {
      [qualification] = await db.insert(visitQualificationsTable).values({
        contractorId: contractor.id,
        systemId: system.id,
        certificateNumber: parsed.certificateNumber,
        status: "approved",
        documentStatus: "uploaded",
        source: "zip_import",
        notes: "تاريخ الصلاحية يحتاج مراجعة من الشهادة",
      }).returning();
      summary.qualificationsCreated++;
    }

    const fileBuffer = entry.getData();
    const sha256 = createHash("sha256").update(fileBuffer).digest("hex");
    const [duplicate] = await db.select({ id: visitDocumentsTable.id }).from(visitDocumentsTable).where(eq(visitDocumentsTable.sha256, sha256)).limit(1);
    if (duplicate) {
      summary.duplicatesSkipped++;
      continue;
    }
    await db.insert(visitDocumentsTable).values({
      ownerType: "qualification",
      ownerId: qualification.id,
      documentType: "qualification_certificate",
      fileName: decodeUnicodeFilename(entry.entryName.split(/[\\/]/).pop() || "certificate.pdf"),
      mimeType: "application/pdf",
      sizeBytes: fileBuffer.length,
      sha256,
      contentBase64: fileBuffer.toString("base64"),
      uploadedByUserId: req.currentUser.id,
    });
    summary.documentsCreated++;
    await db.update(visitQualificationsTable).set({ documentStatus: "uploaded", updatedAt: new Date() }).where(eq(visitQualificationsTable.id, qualification.id));
    await db.update(visitContractorsTable).set({ documentStatus: "uploaded", updatedAt: new Date() }).where(eq(visitContractorsTable.id, contractor.id));
  }

  await audit(req, "visit_qualification_zip_imported", { fileName: req.file.originalname, ...summary });
  return res.json(summary);
});

export default router;
