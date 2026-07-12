import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  date,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable, visitRequestsTable } from "./schema";

export const visitSystemsTable = pgTable("visit_systems", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  normalizedName: text("normalized_name").notNull(),
  code: text("code"),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("visit_systems_normalized_name_uq").on(t.normalizedName),
]);

export const visitContractorsTable = pgTable("visit_contractors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  normalizedName: text("normalized_name").notNull(),
  shortName: text("short_name"),
  commercialRegistration: text("commercial_registration"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  status: text("status", { enum: ["active", "suspended", "inactive"] }).notNull().default("active"),
  documentStatus: text("document_status", { enum: ["uploaded", "not_uploaded"] }).notNull().default("not_uploaded"),
  source: text("source", { enum: ["manual", "zip_import", "legacy"] }).notNull().default("manual"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("visit_contractors_normalized_name_uq").on(t.normalizedName),
]);

export const visitQualificationsTable = pgTable("visit_qualifications", {
  id: serial("id").primaryKey(),
  contractorId: integer("contractor_id").notNull().references(() => visitContractorsTable.id, { onDelete: "cascade" }),
  systemId: integer("system_id").notNull().references(() => visitSystemsTable.id, { onDelete: "cascade" }),
  certificateNumber: text("certificate_number"),
  validFrom: date("valid_from"),
  validTo: date("valid_to"),
  status: text("status", { enum: ["approved", "pending", "suspended", "expired"] }).notNull().default("approved"),
  documentStatus: text("document_status", { enum: ["uploaded", "not_uploaded"] }).notNull().default("not_uploaded"),
  source: text("source", { enum: ["manual", "zip_import", "legacy"] }).notNull().default("manual"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("visit_qualification_contractor_system_uq").on(t.contractorId, t.systemId),
]);

export const visitSiteApprovalsTable = pgTable("visit_site_approvals", {
  id: serial("id").primaryKey(),
  hospitalName: text("hospital_name").notNull(),
  mainContractor: text("main_contractor"),
  contractNumber: text("contract_number"),
  systemId: integer("system_id").notNull().references(() => visitSystemsTable.id, { onDelete: "cascade" }),
  contractorId: integer("contractor_id").notNull().references(() => visitContractorsTable.id, { onDelete: "cascade" }),
  qualificationId: integer("qualification_id").references(() => visitQualificationsTable.id, { onDelete: "set null" }),
  status: text("status", { enum: ["approved", "pending", "suspended", "expired"] }).notNull().default("approved"),
  validFrom: date("valid_from"),
  validTo: date("valid_to"),
  approvalReference: text("approval_reference"),
  documentStatus: text("document_status", { enum: ["uploaded", "not_uploaded"] }).notNull().default("not_uploaded"),
  source: text("source", { enum: ["manual", "zip_import", "legacy"] }).notNull().default("manual"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("visit_site_system_contractor_uq").on(t.hospitalName, t.systemId, t.contractorId),
]);

export const visitRepresentativesTable = pgTable("visit_representatives", {
  id: serial("id").primaryKey(),
  contractorId: integer("contractor_id").notNull().references(() => visitContractorsTable.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  nationalId: text("national_id").notNull(),
  mobile: text("mobile"),
  nationality: text("nationality"),
  jobTitle: text("job_title"),
  idExpiry: date("id_expiry"),
  status: text("status", { enum: ["active", "pending", "suspended", "expired"] }).notNull().default("active"),
  source: text("source", { enum: ["manual", "certificate_import", "site_request", "legacy"] }).notNull().default("manual"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("visit_representatives_national_id_uq").on(t.nationalId),
]);

export const visitRepresentativeSystemsTable = pgTable("visit_representative_systems", {
  id: serial("id").primaryKey(),
  representativeId: integer("representative_id").notNull().references(() => visitRepresentativesTable.id, { onDelete: "cascade" }),
  systemId: integer("system_id").notNull().references(() => visitSystemsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("visit_representative_system_uq").on(t.representativeId, t.systemId),
]);

export const visitDocumentsTable = pgTable("visit_documents", {
  id: serial("id").primaryKey(),
  ownerType: text("owner_type", { enum: ["contractor", "qualification", "site_approval", "representative", "visit"] }).notNull(),
  ownerId: integer("owner_id").notNull(),
  documentType: text("document_type", { enum: ["qualification_certificate", "approval_letter", "iqama_front", "iqama_back", "iqama_pdf", "signed_permit", "other"] }).notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  sha256: text("sha256").notNull(),
  contentBase64: text("content_base64").notNull(),
  expiresAt: date("expires_at"),
  isActive: boolean("is_active").notNull().default(true),
  uploadedByUserId: integer("uploaded_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("visit_documents_sha256_uq").on(t.sha256),
]);

export const visitRequestMetadataTable = pgTable("visit_request_metadata", {
  id: serial("id").primaryKey(),
  visitRequestId: integer("visit_request_id").notNull().references(() => visitRequestsTable.id, { onDelete: "cascade" }),
  source: text("source", { enum: ["site_request", "direct_issue", "legacy"] }).notNull().default("site_request"),
  systemId: integer("system_id").references(() => visitSystemsTable.id, { onDelete: "set null" }),
  contractorId: integer("contractor_id").references(() => visitContractorsTable.id, { onDelete: "set null" }),
  representativeId: integer("representative_id").references(() => visitRepresentativesTable.id, { onDelete: "set null" }),
  siteApprovalId: integer("site_approval_id").references(() => visitSiteApprovalsTable.id, { onDelete: "set null" }),
  issuedByUserId: integer("issued_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  issuedByName: text("issued_by_name"),
  approvalSnapshot: text("approval_snapshot"),
  overrideReason: text("override_reason"),
  cancelledAt: timestamp("cancelled_at"),
  cancelReason: text("cancel_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("visit_request_metadata_visit_uq").on(t.visitRequestId),
]);

export type VisitSystem = typeof visitSystemsTable.$inferSelect;
export type VisitContractor = typeof visitContractorsTable.$inferSelect;
export type VisitQualification = typeof visitQualificationsTable.$inferSelect;
export type VisitSiteApproval = typeof visitSiteApprovalsTable.$inferSelect;
export type VisitRepresentative = typeof visitRepresentativesTable.$inferSelect;
export type VisitDocument = typeof visitDocumentsTable.$inferSelect;
export type VisitRequestMetadata = typeof visitRequestMetadataTable.$inferSelect;
