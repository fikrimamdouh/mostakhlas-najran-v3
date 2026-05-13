import { pgTable, text, serial, integer, numeric, timestamp, date, uniqueIndex, json, boolean } from "drizzle-orm/pg-core";
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
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
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
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

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
  userId: integer("user_id").notNull().references(() => usersTable.id),
  repName: text("rep_name").notNull(),
  siteLocation: text("site_location").notNull(),
  repId: text("rep_id").notNull(),
  visitDate: date("visit_date").notNull(),
  repMobile: text("rep_mobile").notNull(),
  systemName: text("system_name").notNull(),
  mainContractor: text("main_contractor").notNull(),
  subContractor: text("sub_contractor").notNull(),
  repIdPhoto: text("rep_id_photo"),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  adminNotes: text("admin_notes"),
  submittedByName: text("submitted_by_name"),
  submittedByHospital: text("submitted_by_hospital"),
  submittedByContract: text("submitted_by_contract"),
  serialNumber: text("serial_number"),
  approvedAt: timestamp("approved_at"),
  signedPermitFile: text("signed_permit_file"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertVisitRequestSchema = createInsertSchema(visitRequestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVisitRequest = z.infer<typeof insertVisitRequestSchema>;
export type VisitRequest = typeof visitRequestsTable.$inferSelect;

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
