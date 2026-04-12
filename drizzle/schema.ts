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
 * Tanis recruitment pipeline stages (in order):
 * applied → whatsapp_sent → voice_note_reviewed → interview_scheduled → accepted → teams_invitation_sent
 * rejected is a universal exit at any stage
 */
export const PIPELINE_STAGES = [
  "applied",
  "whatsapp_sent",
  "voice_note_reviewed",
  "interview_scheduled",
  "accepted",
  "teams_invitation_sent",
  "rejected",
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
    "voice_note_reviewed",
    "interview_scheduled",
    "accepted",
    "teams_invitation_sent",
    "rejected",
  ])
    .default("applied")
    .notNull(),
  // Extended profile fields
  age: int("age"),
  location: varchar("location", { length: 255 }),
  source: mysqlEnum("source", ["linkedin", "email", "referral", "walk_in", "other"]),
  voiceNoteRating: int("voiceNoteRating"),   // 1-5 stars
  screeningNotes: text("screeningNotes"),    // recruiter screening comments
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
    "voice_note_reviewed",
    "interview_scheduled",
    "accepted",
    "teams_invitation_sent",
    "rejected",
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
