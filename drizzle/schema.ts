import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  bigint,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * All users are recruiters — no candidate-facing portal or admin role.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Job postings — open positions that candidates apply for.
 */
export const jobs = mysqlTable("jobs", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  department: varchar("department", { length: 128 }),
  location: varchar("location", { length: 128 }),
  description: text("description"),
  status: mysqlEnum("status", ["open", "closed", "paused"]).default("open").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Job = typeof jobs.$inferSelect;
export type InsertJob = typeof jobs.$inferInsert;

/**
 * Candidate pipeline stages in strict order:
 * applied → shortlisted → interviewed → offered → hired | rejected
 */
export const PIPELINE_STAGES = [
  "applied",
  "shortlisted",
  "interviewed",
  "offered",
  "hired",
  "rejected",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/**
 * Candidate profiles — core entity of the ATS.
 */
export const candidates = mysqlTable("candidates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 32 }),
  positionApplied: varchar("positionApplied", { length: 255 }).notNull(),
  jobId: int("jobId"),
  resumeLink: text("resumeLink"),
  notes: text("notes"),
  status: mysqlEnum("status", [
    "applied",
    "shortlisted",
    "interviewed",
    "offered",
    "hired",
    "rejected",
  ])
    .default("applied")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Candidate = typeof candidates.$inferSelect;
export type InsertCandidate = typeof candidates.$inferInsert;

/**
 * Interview scheduling — one interview record per candidate.
 * Multiple interviews can be created for the same candidate over time.
 */
export const interviews = mysqlTable("interviews", {
  id: int("id").autoincrement().primaryKey(),
  candidateId: int("candidateId").notNull(),
  scheduledAt: bigint("scheduledAt", { mode: "number" }).notNull(), // UTC ms timestamp
  location: varchar("location", { length: 255 }),
  interviewerName: varchar("interviewerName", { length: 255 }),
  notes: text("notes"),
  notificationSent: int("notificationSent").default(0).notNull(), // 0 = false, 1 = true
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Interview = typeof interviews.$inferSelect;
export type InsertInterview = typeof interviews.$inferInsert;
