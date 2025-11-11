import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const chatSessions = pgTable("chat_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentEmail: text("student_email").notNull(),
  studentName: text("student_name"),
  characterName: text("character_name").notNull(),
  situation: text("situation").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),
  role: text("role").notNull(), // 'user' or 'assistant'
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const usageStats = pgTable("usage_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),
  studentEmail: text("student_email").notNull(),
  studentName: text("student_name"),
  tokensUsed: integer("tokens_used").notNull(),
  cost: text("cost"), // storing as text to handle decimals precisely
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Admin dashboard models
export const students = pgTable("students", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  name: text("name"),
  isActive: boolean("is_active").default(true).notNull(),
  dailyTokenLimit: integer("daily_token_limit"), // null = no limit
  monthlyCostLimit: text("monthly_cost_limit"), // null = no limit, text for precise decimals
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const settings = pgTable("settings", {
  id: text("id").primaryKey().default("global"), // single global settings record
  globalDailyTokenLimit: integer("global_daily_token_limit"), // null = no limit
  globalMonthlyCostLimit: text("global_monthly_cost_limit"), // null = no limit
  contentFilterMode: text("content_filter_mode").default("normal").notNull(), // 'strict' | 'normal'
  alertEmail: text("alert_email"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const violationEvents = pgTable("violation_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentEmail: text("student_email").notNull(),
  sessionId: varchar("session_id"),
  category: text("category").notNull(), // 'non-english' | 'rate-limit' | 'auth'
  detail: text("detail").notNull(),
  status: text("status").notNull().default('flagged'), // 'flagged' | 'proceeded' | 'blocked'
  bypassedAt: timestamp("bypassed_at"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const adminTokens = pgTable("admin_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  token: varchar("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertChatSessionSchema = createInsertSchema(chatSessions).pick({
  studentEmail: true,
  studentName: true,
  characterName: true,
  situation: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).pick({
  sessionId: true,
  role: true,
  content: true,
});

export const insertUsageStatsSchema = createInsertSchema(usageStats).pick({
  sessionId: true,
  studentEmail: true,
  studentName: true,
  tokensUsed: true,
  cost: true,
});

// Admin dashboard schemas
export const insertStudentSchema = createInsertSchema(students).pick({
  email: true,
  name: true,
  isActive: true,
  dailyTokenLimit: true,
  monthlyCostLimit: true,
  notes: true,
});

export const insertSettingsSchema = createInsertSchema(settings).pick({
  globalDailyTokenLimit: true,
  globalMonthlyCostLimit: true,
  contentFilterMode: true,
  alertEmail: true,
}).extend({
  contentFilterMode: z.enum(['strict', 'normal']),
});

export const insertViolationEventSchema = createInsertSchema(violationEvents).pick({
  studentEmail: true,
  sessionId: true,
  category: true,
  detail: true,
  status: true,
}).extend({
  category: z.enum(['non-english', 'rate-limit', 'auth']),
  status: z.enum(['flagged', 'proceeded', 'blocked']).default('flagged'),
});

export const insertAdminTokenSchema = createInsertSchema(adminTokens).pick({
  token: true,
  expiresAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type UsageStats = typeof usageStats.$inferSelect;
export type InsertUsageStats = z.infer<typeof insertUsageStatsSchema>;

// Admin dashboard types
export type Student = typeof students.$inferSelect;
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Settings = typeof settings.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type ViolationEvent = typeof violationEvents.$inferSelect;
export type InsertViolationEvent = z.infer<typeof insertViolationEventSchema>;
export type AdminToken = typeof adminTokens.$inferSelect;
export type InsertAdminToken = z.infer<typeof insertAdminTokenSchema>;
