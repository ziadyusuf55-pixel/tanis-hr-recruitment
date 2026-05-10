import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  bigint,
  decimal,
  boolean,
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
  slackJoined: boolean("slackJoined").default(false).notNull(),
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
  mustChangePassword: boolean("mustChangePassword").default(true).notNull(), // force password change on first login
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
  agentCode: varchar("agentCode", { length: 100 }),
  month: varchar("month", { length: 7 }).notNull(), // format: "2025-06"
  baseSalary: decimal("baseSalary", { precision: 10, scale: 2 }),
  workingHours: decimal("workingHours", { precision: 8, scale: 2 }),
  overtimeHours: decimal("overtimeHours", { precision: 8, scale: 2 }),
  commission: decimal("commission", { precision: 10, scale: 2 }).default("0"),
  deductions: decimal("deductions", { precision: 10, scale: 2 }).default("0"),
  netPay: decimal("netPay", { precision: 10, scale: 2 }),
  uploadedBy: varchar("uploadedBy", { length: 255 }),
  uploadedAt: bigint("uploadedAt", { mode: "number" }),
  // legacy fields kept for backward compat
  grossSalary: decimal("grossSalary", { precision: 10, scale: 2 }),
  paymentDate: bigint("paymentDate", { mode: "number" }),
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

/**
 * Agent requests — submitted by agents via the Request Center in their portal.
 * Admin can view, update status, and reply.
 */
export const agentRequests = mysqlTable("agent_requests", {
  id: int("id").autoincrement().primaryKey(),
  candidateId: int("candidateId").notNull(), // FK to candidates.id
  traineeCode: varchar("traineeCode", { length: 100 }).notNull(),
  type: mysqlEnum("type", ["leave", "salary", "schedule", "complaint", "resignation", "day_off", "paid_leave", "sick_note", "hr_letter", "other"]).notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  message: text("message").notNull(),
  requestedDate: bigint("requestedDate", { mode: "number" }), // UTC ms timestamp for date-based requests (leave, day_off, resignation last day)
  requestedDates: text("requestedDates"), // JSON array of date strings for multi-day requests
  attachmentUrl: varchar("attachmentUrl", { length: 1024 }), // S3 URL for sick note or supporting doc
  hrLetterPurpose: varchar("hrLetterPurpose", { length: 500 }), // purpose for hr_letter requests
  hrLetterLanguage: mysqlEnum("hrLetterLanguage", ["arabic", "english"]), // language for hr_letter requests
  status: mysqlEnum("status", ["pending", "in_progress", "resolved", "rejected"]).default("pending").notNull(),
  isAdminRead: boolean("isAdminRead").default(false).notNull(), // true once admin has viewed this request
  adminReply: text("adminReply"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AgentRequest = typeof agentRequests.$inferSelect;
export type InsertAgentRequest = typeof agentRequests.$inferInsert;

/**
 * Admin accounts — email/password admins invited by the owner.
 * The Manus OAuth owner is separate; these are additional admins.
 */
export const adminAccounts = mysqlTable("admin_accounts", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["admin", "viewer"]).default("admin").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  forcePasswordChange: boolean("forcePasswordChange").default(true).notNull(),
  invitedBy: varchar("invitedBy", { length: 255 }), // email of inviter
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AdminAccount = typeof adminAccounts.$inferSelect;
export type InsertAdminAccount = typeof adminAccounts.$inferInsert;

/**
 * Admin invites — one-time tokens sent to new admins.
 * Token expires in 48 hours; usedAt is set when accepted.
 */
export const adminInvites = mysqlTable("admin_invites", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  expiresAt: bigint("expiresAt", { mode: "number" }).notNull(), // UTC ms
  usedAt: bigint("usedAt", { mode: "number" }), // null = not yet used
  invitedBy: varchar("invitedBy", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AdminInvite = typeof adminInvites.$inferSelect;
export type InsertAdminInvite = typeof adminInvites.$inferInsert;

/**
 * Login attempts — tracks failed agent/admin logins for rate limiting.
 */
export const loginAttempts = mysqlTable("login_attempts", {
  id: int("id").autoincrement().primaryKey(),
  identifier: varchar("identifier", { length: 255 }).notNull(), // traineeCode or email
  attemptType: mysqlEnum("attemptType", ["agent", "admin"]).notNull(),
  failedAt: bigint("failedAt", { mode: "number" }).notNull(), // UTC ms
  ipAddress: varchar("ipAddress", { length: 64 }),
});
export type LoginAttempt = typeof loginAttempts.$inferSelect;

/**
 * Referrals — agents refer external candidates to join Tanis.
 * A candidate record is auto-created with source="referred" when submitted.
 */
export const referrals = mysqlTable("referrals", {
  id: int("id").autoincrement().primaryKey(),
  referrerCandidateId: int("referrerCandidateId").notNull(), // agent who referred
  refereeName: varchar("refereeName", { length: 255 }).notNull(),
  refereePhone: varchar("refereePhone", { length: 50 }).notNull(),
  refereeNote: text("refereeNote"),
  createdCandidateId: int("createdCandidateId"), // FK to candidates.id once created
  status: mysqlEnum("status", ["pending", "contacted", "hired", "rejected"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = typeof referrals.$inferInsert;

/**
 * Agent notifications — in-app alerts for agents (request replied, referral status changed).
 */
export const agentNotifications = mysqlTable("agent_notifications", {
  id: int("id").autoincrement().primaryKey(),
  candidateId: int("candidateId").notNull(), // FK to candidates.id
  message: varchar("message", { length: 500 }).notNull(),
  type: mysqlEnum("type", ["request_reply", "referral_update", "general", "campaign_assigned"]).default("general").notNull(),
  relatedId: int("relatedId"), // requestId or referralId
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AgentNotification = typeof agentNotifications.$inferSelect;
export type InsertAgentNotification = typeof agentNotifications.$inferInsert;

/**
 * Campaigns — operational client campaigns that workforce agents are assigned to.
 * minHeadcount is the minimum number of agents that must be logged in daily.
 * workDays: 'all' = 7 days, 'weekdays' = Mon-Fri only.
 */
export const campaigns = mysqlTable("campaigns", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  minHeadcount: int("minHeadcount").notNull().default(1),
  workDays: mysqlEnum("workDays", ["all", "weekdays"]).default("all").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = typeof campaigns.$inferInsert;

/**
 * Workforce agents — agents who have passed mock call and joined operations.
 * Separate from training; linked to a candidate record by traineeCode.
 * offDay1 / offDay2: day-of-week numbers (0=Sunday, 1=Monday, ... 6=Saturday).
 */
export const workforceAgents = mysqlTable("workforce_agents", {
  id: int("id").autoincrement().primaryKey(),
  traineeCode: varchar("traineeCode", { length: 100 }).notNull().unique(),
  candidateId: int("candidateId").notNull(),
  campaignId: int("campaignId"),
  fullName: varchar("fullName", { length: 255 }).notNull(),
  alias: varchar("alias", { length: 100 }),           // English alias used on campaign
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 64 }),
  shiftHours: varchar("shiftHours", { length: 100 }), // e.g. "9:00 AM - 5:00 PM"
  teamLeader: varchar("teamLeader", { length: 255 }),
  offDay1: int("offDay1"),                             // 0-6 (Sun-Sat)
  offDay2: int("offDay2"),                             // 0-6 (Sun-Sat)
  joinDate: bigint("joinDate", { mode: "number" }),   // UTC ms — date joined operations
  dialerCredentials: varchar("dialerCredentials", { length: 500 }), // dialer/hub login credentials (admin fills manually)
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type WorkforceAgent = typeof workforceAgents.$inferSelect;
export type InsertWorkforceAgent = typeof workforceAgents.$inferInsert;

/**
 * Agent payment methods — wallet or bank account for salary disbursement.
 * Agents add/edit; admin can add comments (e.g. "name mismatch").
 */
export const agentPaymentMethods = mysqlTable("agent_payment_methods", {
  id: int("id").autoincrement().primaryKey(),
  traineeCode: varchar("traineeCode", { length: 100 }).notNull(),
  type: mysqlEnum("type", ["wallet", "bank"]).notNull(),
  // Wallet fields
  walletProvider: mysqlEnum("walletProvider", ["vodafone_cash", "orange_cash"]),
  walletPhone: varchar("walletPhone", { length: 20 }),
  walletName: varchar("walletName", { length: 255 }),
  // Bank fields
  bankName: varchar("bankName", { length: 255 }),
  bankAccountOrPhone: varchar("bankAccountOrPhone", { length: 100 }),
  bankFullName: varchar("bankFullName", { length: 255 }),
  isPreferred: boolean("isPreferred").default(false).notNull(),
  adminComment: text("adminComment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AgentPaymentMethod = typeof agentPaymentMethods.$inferSelect;
export type InsertAgentPaymentMethod = typeof agentPaymentMethods.$inferInsert;

/**
 * Agent documents — required docs for contract (national ID, certificate, CV, etc.).
 * Agents upload; admin reviews and sets status per document.
 */
export const agentDocuments = mysqlTable("agent_documents", {
  id: int("id").autoincrement().primaryKey(),
  traineeCode: varchar("traineeCode", { length: 100 }).notNull(),
  docType: varchar("docType", { length: 100 }).notNull(), // e.g. 'national_id', 'certificate', 'cv', etc.
  fileUrl: varchar("fileUrl", { length: 1024 }).notNull(),
  fileName: varchar("fileName", { length: 255 }),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  adminComment: text("adminComment"),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AgentDocument = typeof agentDocuments.$inferSelect;
export type InsertAgentDocument = typeof agentDocuments.$inferInsert;

/**
 * Schedule change requests — agent requests to swap off days with another agent.
 * Flow: agent submits → target agent approves → manager approves → off days updated.
 */
export const scheduleChangeRequests = mysqlTable("schedule_change_requests", {
  id: int("id").autoincrement().primaryKey(),
  requesterCode: varchar("requesterCode", { length: 100 }).notNull(),
  targetCode: varchar("targetCode", { length: 100 }).notNull(),
  // Proposed new off days for each party (0-6)
  requesterNewOff1: int("requesterNewOff1"),
  requesterNewOff2: int("requesterNewOff2"),
  targetNewOff1: int("targetNewOff1"),
  targetNewOff2: int("targetNewOff2"),
  message: text("message"),
  status: mysqlEnum("status", ["pending_peer", "pending_manager", "approved", "rejected"]).default("pending_peer").notNull(),
  peerApprovedAt: bigint("peerApprovedAt", { mode: "number" }),
  managerApprovedAt: bigint("managerApprovedAt", { mode: "number" }),
  managerComment: text("managerComment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ScheduleChangeRequest = typeof scheduleChangeRequests.$inferSelect;
export type InsertScheduleChangeRequest = typeof scheduleChangeRequests.$inferInsert;

/**
 * Overtime availability — agents respond to overtime alerts for specific dates.
 */
export const overtimeAvailability = mysqlTable("overtime_availability", {
  id: int("id").autoincrement().primaryKey(),
  traineeCode: varchar("traineeCode", { length: 100 }).notNull(),
  campaignId: int("campaignId").notNull(),
  date: varchar("date", { length: 10 }).notNull(), // format: "2025-06-15" (YYYY-MM-DD)
  status: mysqlEnum("status", ["available", "unavailable"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type OvertimeAvailability = typeof overtimeAvailability.$inferSelect;
export type InsertOvertimeAvailability = typeof overtimeAvailability.$inferInsert;

/**
 * Agent comments — admin-written notes/issues visible to the agent in their portal.
 */
export const agentComments = mysqlTable("agent_comments", {
  id: int("id").autoincrement().primaryKey(),
  traineeCode: varchar("traineeCode", { length: 100 }).notNull(),
  adminName: varchar("adminName", { length: 255 }).notNull(),
  content: text("content").notNull(),
  tag: mysqlEnum("tag", ["note", "warning", "resolved"]).default("note").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AgentComment = typeof agentComments.$inferSelect;
export type InsertAgentComment = typeof agentComments.$inferInsert;
