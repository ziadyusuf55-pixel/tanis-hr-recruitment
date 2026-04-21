import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  bigint,
  decimal,
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
 * Tanis recruitment pipeline stages (in order):
 * applied → whatsapp_sent → voice_note_reviewed → interview_scheduled → accepted → teams_invitation_sent
 * rejected is a universal exit at any stage
 */
export const PIPELINE_STAGES = [
  "applied",
  "whatsapp_sent",
  "no_answer",
  "voice_note_reviewed",
  "interview_scheduled",
  "accepted",
  "whatsapp_group_added",
  "rejected",
  "blacklisted",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/**
 * Candidate profiles — core entity of the ATS.
 */
export const candidates = mysqlTable("candidates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 64 }),
  positionApplied: varchar("positionApplied", { length: 255 }).notNull().default("Call Center Agent"),
  resumeLink: text("resumeLink"),
  notes: text("notes"),
  meetLink: text("meetLink"),       // Google Meet link for interview
  teamsLink: text("teamsLink"),     // Microsoft Teams training link
  status: mysqlEnum("status", [
    "applied",
    "whatsapp_sent",
    "no_answer",
    "voice_note_reviewed",
    "interview_scheduled",
    "accepted",
    "whatsapp_group_added",
    "rejected",
    "blacklisted",
  ])
    .default("applied")
    .notNull(),
  // subStatus column pending DB migration — do not add here until ALTER TABLE succeeds
  // subStatus: varchar("subStatus", { length: 50 }),
  // Extended profile fields
  age: int("age"),
  location: varchar("location", { length: 255 }),
  source: mysqlEnum("source", ["linkedin", "email", "referral", "walk_in", "other"]),
  voiceNoteRating: int("voiceNoteRating"),   // 1-5 stars
  screeningNotes: text("screeningNotes"),
  cvUrl: varchar("cvUrl", { length: 1024 }),
  cvFileName: varchar("cvFileName", { length: 255 }),
  wave: int("wave"),                         // recruitment wave number (1, 2, 3...)
  // Track when candidate reached each key stage (UTC ms) for time-to-hire KPI
  appliedAt: bigint("appliedAt", { mode: "number" }),
  acceptedAt: bigint("acceptedAt", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Candidate = typeof candidates.$inferSelect;
export type InsertCandidate = typeof candidates.$inferInsert;

/**
 * Per-stage notes — recruiters can log notes at any pipeline stage.
 * Multiple notes per candidate per stage are supported.
 */
export const stageNotes = mysqlTable("stage_notes", {
  id: int("id").autoincrement().primaryKey(),
  candidateId: int("candidateId").notNull(),
  stage: mysqlEnum("stage", [
    "applied",
    "whatsapp_sent",
    "no_answer",
    "voice_note_reviewed",
    "interview_scheduled",
    "accepted",
    "whatsapp_group_added",
    "rejected",
    "blacklisted",
  ]).notNull(),
  note: text("note").notNull(),
  recruiterName: varchar("recruiterName", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type StageNote = typeof stageNotes.$inferSelect;
export type InsertStageNote = typeof stageNotes.$inferInsert;

/**
 * Interview scheduling — kept for email notification history.
 */
export const interviews = mysqlTable("interviews", {
  id: int("id").autoincrement().primaryKey(),
  candidateId: int("candidateId").notNull(),
  scheduledAt: bigint("scheduledAt", { mode: "number" }).notNull(),
  location: varchar("location", { length: 255 }),
  interviewerName: varchar("interviewerName", { length: 255 }),
  notes: text("notes"),
  notificationSent: int("notificationSent").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Interview = typeof interviews.$inferSelect;
export type InsertInterview = typeof interviews.$inferInsert;

/**
 * Activity log — records every stage change and key action on a candidate.
 * Provides the full audit trail shown in the candidate's Activity Timeline.
 */
export const activityLog = mysqlTable("activity_log", {
  id: int("id").autoincrement().primaryKey(),
  candidateId: int("candidateId").notNull(),
  action: varchar("action", { length: 128 }).notNull(), // e.g. 'stage_change', 'note_added', 'interview_scheduled'
  fromStage: varchar("fromStage", { length: 64 }),
  toStage: varchar("toStage", { length: 64 }),
  detail: text("detail"),          // optional extra context (e.g. rejection reason)
  performedBy: varchar("performedBy", { length: 255 }), // recruiter name
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActivityLog = typeof activityLog.$inferSelect;
export type InsertActivityLog = typeof activityLog.$inferInsert;

/**
 * Training batches — groups of accepted candidates assigned to a training cohort.
 * Trainers create batches; recruiters assign candidates to them.
 */
export const trainingBatches = mysqlTable("training_batches", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),          // e.g. "Batch 1", "Wave 2 - June"
  trainerName: varchar("trainerName", { length: 255 }),      // name of the trainer running the batch
  startDate: bigint("startDate", { mode: "number" }),        // UTC ms timestamp of training start
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TrainingBatch = typeof trainingBatches.$inferSelect;
export type InsertTrainingBatch = typeof trainingBatches.$inferInsert;

/**
 * Junction table linking candidates to training batches.
 * A candidate can only be in one batch at a time (enforced at app level).
 */
export const batchCandidates = mysqlTable("batch_candidates", {
  // traineeCode is assigned by the trainer after the agent joins the batch
  id: int("id").autoincrement().primaryKey(),
  batchId: int("batchId").notNull(),
  candidateId: int("candidateId").notNull(),
  traineeCode: varchar("traineeCode", { length: 100 }),
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
});

export type BatchCandidate = typeof batchCandidates.$inferSelect;
export type InsertBatchCandidate = typeof batchCandidates.$inferInsert;

/**
 * Agent credentials — stores hashed password for agent portal login.
 * Trainee code is the username; password is auto-generated and shown once.
 */
export const agentCredentials = mysqlTable("agent_credentials", {
  id: int("id").autoincrement().primaryKey(),
  candidateId: int("candidateId").notNull().unique(), // FK to candidates.id
  traineeCode: varchar("traineeCode", { length: 100 }).notNull().unique(), // login username
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AgentCredential = typeof agentCredentials.$inferSelect;
export type InsertAgentCredential = typeof agentCredentials.$inferInsert;

/**
 * Payroll records — monthly payroll entries per agent.
 * Admin fills these in; agents can view their own records in the portal.
 */
export const payrollRecords = mysqlTable("payroll_records", {
  id: int("id").autoincrement().primaryKey(),
  candidateId: int("candidateId").notNull(),
  month: varchar("month", { length: 7 }).notNull(), // format: "2025-06"
  grossSalary: decimal("grossSalary", { precision: 10, scale: 2 }),
  deductions: decimal("deductions", { precision: 10, scale: 2 }).default("0"),
  netPay: decimal("netPay", { precision: 10, scale: 2 }),
  paymentDate: bigint("paymentDate", { mode: "number" }), // UTC ms
  status: mysqlEnum("status", ["pending", "paid", "on_hold"]).default("pending").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PayrollRecord = typeof payrollRecords.$inferSelect;
export type InsertPayrollRecord = typeof payrollRecords.$inferInsert;

/**
 * Performance records — monthly operational KPIs per agent (post-training).
 * Admin fills these in; agents can view their own records in the portal.
 */
export const performanceRecords = mysqlTable("performance_records", {
  id: int("id").autoincrement().primaryKey(),
  candidateId: int("candidateId").notNull(),
  period: varchar("period", { length: 7 }).notNull(), // format: "2025-06"
  callsMade: int("callsMade"),
  leadsGenerated: int("leadsGenerated"),
  targetsHit: int("targetsHit"),
  totalTargets: int("totalTargets"),
  qualityScore: decimal("qualityScore", { precision: 4, scale: 1 }), // e.g. 8.5 out of 10
  attendanceRate: decimal("attendanceRate", { precision: 5, scale: 2 }), // e.g. 95.50 (%)
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PerformanceRecord = typeof performanceRecords.$inferSelect;
export type InsertPerformanceRecord = typeof performanceRecords.$inferInsert;
