import { pgTable, text, serial, integer, numeric, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["admin", "user"] }).notNull().default("user"),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  company: text("company"),
  phone: text("phone"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
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
