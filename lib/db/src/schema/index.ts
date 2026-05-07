import { pgTable, text, serial, integer, numeric, timestamp, date, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["admin", "supervisor", "contract_supervisor", "user"] }).notNull().default("user"),
  contractCompany: text("contract_company"), // for contract_supervisor: "بيت_العرب" | "سراكو"
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  company: text("company"),
  phone: text("phone"),
  hospital: text("hospital"),
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
    enum: ["labor", "consumables", "spare_parts", "health_centers"],
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
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

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
