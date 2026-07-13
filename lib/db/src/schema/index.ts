import { pgTable, text, serial, integer, numeric, timestamp, date, uniqueIndex, index, json, boolean, customType } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["admin", "supervisor", "contract_supervisor", "viewer", "user"] }).notNull().default("user"),
  contractCompany: text("contract_company"), // for contract_supervisor: "بيت_العرب" | "سراكو"
  supervisedHospital: text("supervised_hospital"), // for supervisor: specific hospital they monitor
  status: text("status", { enum: ["pending", "approved", "rejected", "deleted"] }).notNull().default("pending"),
  company: text("company"),
  phone: text("phone"),
  hospital: text("hospital"),
  hospitals: text("hospitals"),
  jobTitle: text("job_title"),
  contractNumber: text("contract_number"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at"),
  allowedModules: text("allowed_modules"), // JSON array of module keys; null = all allowed
  lastPage: text("last_page"),             // last page/module the user was on
  lastPageAt: timestamp("last_page_at"),   // when they last navigated
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  location: text("location"),
  contractValue: numeric("contract_value", { precision: 18, scale: 2 }),
  startDate: date("start_date"),
  endDate: date("end_date"),
  status: text("status", { enum: ["active", "completed", "on_hold"] }).notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, createdAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;

export const extractsTable = pgTable("extracts", {
  id: serial("id").primaryKey(),
  extractNumber: text("extract_number").notNull(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id),
  status: text("status", { enum: ["current", "completed", "previous"] }).notNull().default("current"),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  description: text("description"),
  submittedBy: text("submitted_by"),
  submittedAt: timestamp("submitted_at"),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertExtractSchema = createInsertSchema(extractsTable).omit({ id: true, createdAt: true });
export type InsertExtract = z.infer<typeof insertExtractSchema>;
export type Extract = typeof extractsTable.$inferSelect;

// Submitted extracts from the HTML-based workflow (attendance, consumables, etc.)
export const submittedExtractsTable = pgTable("submitted_extracts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  extractType: text("extract_type", {
    enum: ["labor", "consumables", "spare_parts", "health_centers", "admin_offices"],
  }).notNull(),
  companyName: text("company_name"),
  contractNumber: text("contract_number"),
  hospitalName: text("hospital_name"),
  periodMonth: text("period_month"),
  totalAmount: numeric("total_amount", { precision: 18, scale: 2 }),
  status: text("status", {
    enum: ["submitted", "under_review", "approved", "rejected", "needs_revision"],
  }).notNull().default("submitted"),
  revisionCount: integer("revision_count").notNull().default(0),
  revisedAt: timestamp("revised_at"),
  notes: text("notes"),
  adminNotes: text("admin_notes"),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at"),
  extractData: text("extract_data"),
  // Server-side idempotency: deterministic key derived from
  // userId|extractType|adminOfficePart|hospital|company|contract|year|month|payment.
  // Nullable so legacy rows (pre-idempotency) don't block the unique index —
  // Postgres unique indexes allow multiple NULLs.
  idempotencyKey: text("idempotency_key"),
  // Explicit columns so list endpoints never need to read extractData.
  adminOfficePart: text("admin_office_part"),   // "consumables" | "labor" | null
  sourceModule: text("source_module"),
  reviewScope: text("review_scope"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("submitted_extracts_idempotency_key").on(t.idempotencyKey),
]);

export const extractRevisionsTable = pgTable("extract_revisions", {
  id: serial("id").primaryKey(),
  extractId: integer("extract_id").notNull().references(() => submittedExtractsTable.id),
  changedBy: text("changed_by").notNull(),
  changedByRole: text("changed_by_role"),
  previousStatus: text("previous_status"),
  newStatus: text("new_status"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export type ExtractRevision = typeof extractRevisionsTable.$inferSelect;

export const insertSubmittedExtractSchema = createInsertSchema(submittedExtractsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSubmittedExtract = z.infer<typeof insertSubmittedExtractSchema>;
export type SubmittedExtract = typeof submittedExtractsTable.$inferSelect;

// Cloud storage for syncing original HTML app localStorage data per user
export const userStorageTable = pgTable("user_storage", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  storageKey: text("storage_key").notNull(),
  storageValue: text("storage_value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("user_storage_user_key").on(t.userId, t.storageKey),
]);

export type UserStorage = typeof userStorageTable.$inferSelect;

// Hospital-level shared storage — all users of the same hospital share this data
// Used for: performance tables, attendance, consumables, contract settings, names, etc.
export const hospitalStorageTable = pgTable("hospital_storage", {
  id: serial("id").primaryKey(),
  hospitalName: text("hospital_name").notNull(),
  storageKey: text("storage_key").notNull(),
  storageValue: text("storage_value").notNull(),
  // Optimistic-concurrency version. Incremented on every write.
  // PUT with expectedVersion mismatch → 409 (no silent last-writer-wins overwrite).
  version: integer("version").notNull().default(1),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedByUserId: integer("updated_by_user_id").references(() => usersTable.id),
}, (t) => [
  uniqueIndex("hospital_storage_hospital_key").on(t.hospitalName, t.storageKey),
]);

export type HospitalStorage = typeof hospitalStorageTable.$inferSelect;

// Audit log for monitoring all user actions
export const auditLogTable = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id),
  userEmail: text("user_email"),
  userName: text("user_name"),
  action: text("action").notNull(),
  details: text("details"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AuditLog = typeof auditLogTable.$inferSelect;

// Visit requests — submitted by users, reviewed by admin
export const visitRequestsTable = pgTable("visit_requests", {
  id: serial("id").primaryKey(),
  // Nullable so a visit remains an immutable operational record if its creator
  // is later deactivated or purged. Existing rows remain fully compatible.
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  repName: text("rep_name").notNull(),
  siteLocation: text("site_location").notNull(),
  repId: text("rep_id").notNull(),
  visitDate: date("visit_date").notNull(),
  repMobile: text("rep_mobile").notNull(),
  systemName: text("system_name").notNull(),
  mainContractor: text("main_contractor").notNull(),
  subContractor: text("sub_contractor").notNull(),
  repIdPhoto: text("rep_id_photo"),
  status: text("status", { enum: ["pending", "approved", "rejected", "cancelled"] }).notNull().default("pending"),
  adminNotes: text("admin_notes"),
  submittedByName: text("submitted_by_name"),
  submittedByHospital: text("submitted_by_hospital"),
  submittedByContract: text("submitted_by_contract"),
  serialNumber: text("serial_number"),
  approvedAt: timestamp("approved_at"),
  signedPermitFile: text("signed_permit_file"),
  cancelledAt: timestamp("cancelled_at"),
  cancelledReason: text("cancelled_reason"),
  reissuedFromVisitId: integer("reissued_from_visit_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  // Legacy rows may already contain duplicate four-digit numbers. New permits
  // use the global atomic sequence below; a normal lookup index preserves a
  // safe schema push without rewriting historical records.
  index("visit_requests_serial_number_idx").on(t.serialNumber),
  // New numbers have a distinct year-sequence shape, so they can receive a
  // database uniqueness backstop without rejecting duplicate legacy 4-digit
  // permit numbers that may already exist.
  uniqueIndex("visit_requests_atomic_serial_unique").on(t.serialNumber).where(sql`${t.serialNumber} ~ '^[0-9]{4}-[0-9]{6}$'`),
  index("visit_requests_status_date_idx").on(t.status, t.visitDate),
]);

export const insertVisitRequestSchema = createInsertSchema(visitRequestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVisitRequest = z.infer<typeof insertVisitRequestSchema>;
export type VisitRequest = typeof visitRequestsTable.$inferSelect;

// ── Central subcontractor visit-management catalogue ────────────────────────
// All catalogue rows are soft-disabled. Operational visits and document
// history are never hard-deleted by the visit APIs.
export const visitSystemsTable = pgTable("visit_systems", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code"),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdByUserId: integer("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
}, (t) => [uniqueIndex("visit_systems_name_unique").on(t.name)]);

export const visitContractorsTable = pgTable("visit_contractors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  registrationNumber: text("registration_number"),
  contactName: text("contact_name"),
  contactMobile: text("contact_mobile"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdByUserId: integer("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
}, (t) => [uniqueIndex("visit_contractors_name_unique").on(t.name)]);

export const visitQualificationsTable = pgTable("visit_qualifications", {
  id: serial("id").primaryKey(),
  contractorId: integer("contractor_id").notNull().references(() => visitContractorsTable.id),
  systemId: integer("system_id").notNull().references(() => visitSystemsTable.id),
  validFrom: date("valid_from").notNull(),
  validUntil: date("valid_until").notNull(),
  status: text("status", { enum: ["active", "disabled", "expired"] }).notNull().default("active"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("visit_qualifications_contractor_system_unique").on(t.contractorId, t.systemId),
  index("visit_qualifications_validity_idx").on(t.status, t.validUntil),
]);

export const visitSiteApprovalsTable = pgTable("visit_site_approvals", {
  id: serial("id").primaryKey(),
  siteName: text("site_name").notNull(),
  systemId: integer("system_id").notNull().references(() => visitSystemsTable.id),
  contractorId: integer("contractor_id").notNull().references(() => visitContractorsTable.id),
  validFrom: date("valid_from").notNull(),
  validUntil: date("valid_until").notNull(),
  status: text("status", { enum: ["active", "disabled", "expired"] }).notNull().default("active"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("visit_site_approvals_scope_unique").on(t.siteName, t.systemId, t.contractorId),
  index("visit_site_approvals_validity_idx").on(t.siteName, t.status, t.validUntil),
]);

export const visitRepresentativesTable = pgTable("visit_representatives", {
  id: serial("id").primaryKey(),
  contractorId: integer("contractor_id").notNull().references(() => visitContractorsTable.id),
  fullName: text("full_name").notNull(),
  identityNumber: text("identity_number").notNull(),
  mobile: text("mobile").notNull(),
  residenceExpiresAt: date("residence_expires_at"),
  noResidenceException: boolean("no_residence_exception").notNull().default(false),
  exceptionReason: text("exception_reason"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("visit_representatives_identity_unique").on(t.identityNumber),
  index("visit_representatives_contractor_idx").on(t.contractorId, t.isActive),
]);

export const visitRepresentativeSystemsTable = pgTable("visit_representative_systems", {
  id: serial("id").primaryKey(),
  representativeId: integer("representative_id").notNull().references(() => visitRepresentativesTable.id),
  systemId: integer("system_id").notNull().references(() => visitSystemsTable.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("visit_representative_systems_unique").on(t.representativeId, t.systemId),
]);

export const visitRequestMetadataTable = pgTable("visit_request_metadata", {
  id: serial("id").primaryKey(),
  visitId: integer("visit_id").notNull().references(() => visitRequestsTable.id).unique(),
  systemId: integer("system_id").references(() => visitSystemsTable.id),
  contractorId: integer("contractor_id").references(() => visitContractorsTable.id),
  representativeId: integer("representative_id").references(() => visitRepresentativesTable.id),
  siteApprovalId: integer("site_approval_id").references(() => visitSiteApprovalsTable.id),
  qualificationId: integer("qualification_id").references(() => visitQualificationsTable.id),
  purpose: text("purpose"),
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  snapshotJson: text("snapshot_json"),
  linkedAt: timestamp("linked_at"),
  linkedByUserId: integer("linked_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const visitDocumentsTable = pgTable("visit_documents", {
  id: serial("id").primaryKey(),
  ownerType: text("owner_type", { enum: ["visit", "representative", "contractor", "qualification", "site_approval"] }).notNull(),
  ownerId: integer("owner_id").notNull(),
  documentType: text("document_type").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  sha256: text("sha256").notNull(),
  status: text("status", { enum: ["active", "disabled", "replaced"] }).notNull().default("active"),
  replacedByDocumentId: integer("replaced_by_document_id"),
  uploadedByUserId: integer("uploaded_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  disabledAt: timestamp("disabled_at"),
}, (t) => [
  uniqueIndex("visit_documents_content_unique").on(t.ownerType, t.ownerId, t.documentType, t.sha256),
  index("visit_documents_owner_idx").on(t.ownerType, t.ownerId, t.status),
]);

const bytea = customType<{ data: Buffer }>({ dataType() { return "bytea"; } });

export const visitDocumentContentsTable = pgTable("visit_document_contents", {
  documentId: integer("document_id").primaryKey().references(() => visitDocumentsTable.id),
  content: bytea("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const visitNumberSequencesTable = pgTable("visit_number_sequences", {
  id: serial("id").primaryKey(),
  scopeKey: text("scope_key").notNull().unique(),
  lastValue: integer("last_value").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const visitPermitTokensTable = pgTable("visit_permit_tokens", {
  id: serial("id").primaryKey(),
  visitId: integer("visit_id").notNull().references(() => visitRequestsTable.id),
  tokenHash: text("token_hash").notNull().unique(),
  tokenCiphertext: text("token_ciphertext").notNull(),
  status: text("status", { enum: ["active", "disabled"] }).notNull().default("active"),
  issuedAt: timestamp("issued_at").notNull().defaultNow(),
  disabledAt: timestamp("disabled_at"),
  lastScannedAt: timestamp("last_scanned_at"),
  scanCount: integer("scan_count").notNull().default(0),
}, (t) => [
  uniqueIndex("visit_permit_tokens_one_active_per_visit").on(t.visitId).where(sql`${t.status} = 'active'`),
  index("visit_permit_tokens_visit_idx").on(t.visitId, t.status),
]);

export type VisitSystem = typeof visitSystemsTable.$inferSelect;
export type VisitContractor = typeof visitContractorsTable.$inferSelect;
export type VisitRepresentative = typeof visitRepresentativesTable.$inferSelect;
export type VisitRequestMetadata = typeof visitRequestMetadataTable.$inferSelect;

// Scheduled automatic backups — saved daily by the server scheduler
export const scheduledBackupsTable = pgTable("scheduled_backups", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  triggeredBy: text("triggered_by").notNull().default("scheduler"),
  counts: json("counts"),
  backupJson: text("backup_json").notNull(),
  emailSent: boolean("email_sent").notNull().default(false),
});

export type ScheduledBackup = typeof scheduledBackupsTable.$inferSelect;

// System-level key-value settings (admin_email, etc.)
export const systemSettingsTable = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: text("updated_by"),
});

export type SystemSetting = typeof systemSettingsTable.$inferSelect;

// إشعارات المستخدمين داخل النظام (طلب تعديل / اعتماد / رفض / تنبيه إداري)
export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: text("type").notNull().default("system"), // system | revision_requested | extract_approved | extract_rejected | admin_message | warning
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  href: text("href"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: text("created_by"),
});

export type NotificationRow = typeof notificationsTable.$inferSelect;
