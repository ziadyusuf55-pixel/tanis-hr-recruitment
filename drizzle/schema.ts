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
  uniqueIndex,
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
  // Separation statuses — ID permanently retired, never reusable
  "resigned",
  "terminated",
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
    // Separation statuses — ID permanently retired, never reusable
    "resigned",
    "terminated",
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
  blacklistReason: text("blacklistReason"),   // reason for blacklisting (set when status → blacklisted from resigned/terminated)
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
    "resigned",
    "terminated",
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
  firstLoginAt: bigint("firstLoginAt", { mode: "number" }), // null = never logged in
  lastLoginAt: bigint("lastLoginAt", { mode: "number" }), // last successful login timestamp
  passwordResetAt: bigint("passwordResetAt", { mode: "number" }), // when password was last reset by admin
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
  // Unique constraint: uq_payroll_crdts_month on (crdts, month)
  id: int("id").autoincrement().primaryKey(),
  candidateId: int("candidateId"),                              // optional legacy link — nullable
  agentCode: varchar("agentCode", { length: 100 }),             // traineeCode (company ID)
  crdts: varchar("crdts", { length: 100 }),                     // dialer ID — primary matching key
  alias: varchar("alias", { length: 100 }),
  month: varchar("month", { length: 7 }).notNull(),             // format: "2025-06"
  baseSalary: decimal("baseSalary", { precision: 10, scale: 2 }),
  workingHours: decimal("workingHours", { precision: 8, scale: 2 }),
  ot1x5Hours: decimal("ot1x5Hours", { precision: 8, scale: 2 }).default("0"),  // OT 1.5x hours
  ot1x5Pay: decimal("ot1x5Pay", { precision: 10, scale: 2 }).default("0"),     // OT 1.5x pay (EGP)
  ot2xHours: decimal("ot2xHours", { precision: 8, scale: 2 }).default("0"),    // OT 2x hours
  ot2xPay: decimal("ot2xPay", { precision: 10, scale: 2 }).default("0"),       // OT 2x pay (EGP)
  ot3xHours: decimal("ot3xHours", { precision: 8, scale: 2 }).default("0"),    // OT 3x hours
  ot3xPay: decimal("ot3xPay", { precision: 10, scale: 2 }).default("0"),       // OT 3x pay (EGP)
  coachingBonus: decimal("coachingBonus", { precision: 10, scale: 2 }).default("0"), // Coaching bonus (EGP)
  commissionEgp: decimal("commissionEgp", { precision: 10, scale: 2 }).default("0"),
  qualityDeductions: decimal("qualityDeductions", { precision: 10, scale: 2 }).default("0"),
  attendanceDeductions: decimal("attendanceDeductions", { precision: 10, scale: 2 }).default("0"),
  totalDeductions: decimal("totalDeductions", { precision: 10, scale: 2 }).default("0"),
  netPay: decimal("netPay", { precision: 10, scale: 2 }),
  qualityDetail: text("qualityDetail"),                         // itemized quality violations
  attendanceDetail: text("attendanceDetail"),                   // itemized attendance incidents
  paymentStatus: mysqlEnum("paymentStatus", ["pending", "paid"]).default("pending").notNull(),
  paidAt: bigint("paidAt", { mode: "number" }),                 // UTC ms — when admin marked as paid
  uploadedBy: varchar("uploadedBy", { length: 255 }),
  uploadedAt: bigint("uploadedAt", { mode: "number" }),
  // legacy fields kept for backward compat
  overtimeHours: decimal("overtimeHours", { precision: 8, scale: 2 }),
  commission: decimal("commission", { precision: 10, scale: 2 }).default("0"),
  deductions: decimal("deductions", { precision: 10, scale: 2 }).default("0"),
  grossSalary: decimal("grossSalary", { precision: 10, scale: 2 }),
  paymentDate: bigint("paymentDate", { mode: "number" }),
  status: mysqlEnum("status", ["pending", "paid", "on_hold"]).default("pending").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PayrollRecord = typeof payrollRecords.$inferSelect;
export type InsertPayrollRecord = typeof payrollRecords.$inferInsert;

// ─── Coaching Sessions ────────────────────────────────────────────────────────
export const coachingSessions = mysqlTable("coaching_sessions", {
  id: int("id").autoincrement().primaryKey(),
  crdts: varchar("crdts", { length: 100 }).notNull(),           // agent dialer ID
  agentCode: varchar("agentCode", { length: 100 }),             // traineeCode
  alias: varchar("alias", { length: 100 }),
  sessionDate: varchar("sessionDate", { length: 10 }).notNull(), // YYYY-MM-DD
  cycleKey: varchar("cycleKey", { length: 7 }).notNull(),       // YYYY-MM
  coachingHours: decimal("coachingHours", { precision: 8, scale: 2 }).default("0"),
  bonusAmount: decimal("bonusAmount", { precision: 10, scale: 2 }).default("0"), // EGP
  sessionType: varchar("sessionType", { length: 100 }),         // e.g. "Quality Coaching"
  notes: text("notes"),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  uploadedAt: bigint("uploadedAt", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CoachingSession = typeof coachingSessions.$inferSelect;
export type InsertCoachingSession = typeof coachingSessions.$inferInsert;

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
  slackMessageTs: varchar("slackMessageTs", { length: 50 }),   // Slack message ts of the request alert (for react-to-action)
  adminLastWorkingDay: varchar("adminLastWorkingDay", { length: 10 }), // YYYY-MM-DD — admin sets this when approving resignation
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
  crdts: varchar("crdts", { length: 500 }),                         // CRDTS field — admin fills manually
  agentStatus: mysqlEnum("agentStatus", ["active", "inactive", "resigned", "terminated", "blacklisted"]).default("active").notNull(),
  salarySettled: boolean("salarySettled").default(true).notNull(),   // false = former agent still owed pay → stays visible in Operations
  address: varchar("address", { length: 500 }),
  emergencyContactName: varchar("emergencyContactName", { length: 255 }),
  emergencyContactPhone: varchar("emergencyContactPhone", { length: 64 }),
  emergencyContactRelation: varchar("emergencyContactRelation", { length: 100 }),
  settledAt: bigint("settledAt", { mode: "number" }),   // when salary was marked settled
  nestingStatus: mysqlEnum("nestingStatus", ["nesting", "active", "senior"]).default("nesting").notNull(),
  workLocation: mysqlEnum("workLocation", ["office", "wfh"]).default("office").notNull(),  // office vs work-from-home
  avatarUrl: varchar("avatarUrl", { length: 1024 }),                                        // agent profile picture (uploaded via portal)
  // ── Personal profile (agent self-fills once; then locked, edits go through HR) ──
  nationalId: varchar("nationalId", { length: 50 }),
  nationalIdExpiry: varchar("nationalIdExpiry", { length: 20 }),       // YYYY-MM-DD
  dateOfBirth: varchar("dateOfBirth", { length: 20 }),                 // YYYY-MM-DD
  gender: mysqlEnum("gender", ["male", "female"]),
  nationality: varchar("nationality", { length: 100 }),
  maritalStatus: mysqlEnum("maritalStatus", ["single", "married", "divorced", "widowed"]),
  militaryStatus: mysqlEnum("militaryStatus", ["completed", "exempt", "postponed", "not_applicable"]),
  jobTitle: varchar("jobTitle", { length: 150 }),
  city: varchar("city", { length: 120 }),
  profileLocked: boolean("profileLocked").default(false).notNull(),    // true after the agent's one-time self-edit
  isActive: boolean("isActive").default(true).notNull(),
  orientationShown: boolean("orientationShown").default(false).notNull(), // true after agent completes orientation tour
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  address: text("address"),
  emergencyName: varchar("emergencyName", { length: 255 }),
  emergencyPhone: varchar("emergencyPhone", { length: 64 }),
  emergencyRelation: varchar("emergencyRelation", { length: 100 }),
  salarySettled: boolean("salarySettled").default(false),
  settledAt: bigint("settledAt", { mode: "number" }),
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

/**
 * Break schedules — admin assigns daily break times per agent.
 * Times stored in HH:MM 24-hour format; displayed as 12-hour in UI.
 */
export const breakSchedules = mysqlTable("break_schedules", {
  id: int("id").autoincrement().primaryKey(),
  agentCode: varchar("agentCode", { length: 100 }).notNull(),
  breakIndex: int("breakIndex").notNull().default(0), // 0-based index per agent per day
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  breakStart: varchar("breakStart", { length: 5 }).notNull(), // HH:MM (24h)
  breakEnd: varchar("breakEnd", { length: 5 }).notNull(),     // HH:MM (24h)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  uniqueAgentDateIdx: uniqueIndex("break_schedules_agent_date_idx_unique").on(t.agentCode, t.date, t.breakIndex),
}));
export type BreakSchedule = typeof breakSchedules.$inferSelect;
export type InsertBreakSchedule = typeof breakSchedules.$inferInsert;

/**
 * Agent separations — records of resignations (on-spot or request) and terminations.
 */
export const agentSeparations = mysqlTable("agent_separations", {
  id: int("id").autoincrement().primaryKey(),
  agentCode: varchar("agentCode", { length: 100 }).notNull(),
  type: mysqlEnum("type", ["resignation_request", "on_spot", "termination"]).notNull(),
  reason: text("reason"),
  lastWorkingDay: varchar("lastWorkingDay", { length: 10 }),  // YYYY-MM-DD
  requestedAt: bigint("requestedAt", { mode: "number" }),     // UTC ms — when agent submitted request
  effectiveAt: bigint("effectiveAt", { mode: "number" }),     // UTC ms — when separation took effect
  approvedBy: varchar("approvedBy", { length: 255 }),         // admin name who approved/processed
  approvedAt: bigint("approvedAt", { mode: "number" }),       // UTC ms
  appliedAt: bigint("appliedAt", { mode: "number" }),        // UTC ms — when the deactivation actually executed (null = scheduled, pending)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AgentSeparation = typeof agentSeparations.$inferSelect;
export type InsertAgentSeparation = typeof agentSeparations.$inferInsert;

/**
 * Agent violations — deductions logged by TL or QA, approved by manager.
 * Feeds into payroll automatically via Python script.
 */
export const agentViolations = mysqlTable("agent_violations", {
  id: int("id").autoincrement().primaryKey(),
  agentCode: varchar("agentCode", { length: 100 }).notNull(),   // traineeCode
  crdts: varchar("crdts", { length: 100 }),                     // dialer ID
  date: varchar("date", { length: 10 }).notNull(),              // YYYY-MM-DD
  type: varchar("type", { length: 100 }).notNull(),             // e.g. 'lateness', 'wrong_disposition'
  category: mysqlEnum("category", ["attendance", "quality"]).notNull(),
  hours: decimal("hours", { precision: 6, scale: 2 }),          // for attendance violations
  deduction: decimal("deduction", { precision: 10, scale: 2 }), // EGP amount
  description: text("description"),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  approvedBy: varchar("approvedBy", { length: 255 }),
  approvedAt: bigint("approvedAt", { mode: "number" }),
  month: varchar("month", { length: 7 }),                       // YYYY-MM — derived from date
  uploadedAt: bigint("uploadedAt", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  uqViolationAgentDateType: uniqueIndex("uq_violation_agent_date_type").on(t.agentCode, t.date, t.type),
}));
export type AgentViolation = typeof agentViolations.$inferSelect;
export type InsertAgentViolation = typeof agentViolations.$inferInsert;

/**
 * Agent performance — monthly KPIs from Vicidial export (Python-generated).
 * Matched by CRDTS. Admin uploads Excel monthly.
 */
export const agentPerformance = mysqlTable("agent_performance", {
  id: int("id").autoincrement().primaryKey(),
  agentCode: varchar("agentCode", { length: 100 }),             // traineeCode (resolved from CRDTS)
  crdts: varchar("crdts", { length: 100 }).notNull(),           // primary matching key
  alias: varchar("alias", { length: 100 }),
  month: varchar("month", { length: 7 }).notNull(),             // YYYY-MM
  loginHours: decimal("loginHours", { precision: 8, scale: 2 }),
  revenue: decimal("revenue", { precision: 12, scale: 2 }),
  cost: decimal("cost", { precision: 12, scale: 2 }),
  profit: decimal("profit", { precision: 12, scale: 2 }),
  revPerHour: decimal("revPerHour", { precision: 10, scale: 2 }),
  uploadedBy: varchar("uploadedBy", { length: 255 }),
  uploadedAt: bigint("uploadedAt", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AgentPerformance = typeof agentPerformance.$inferSelect;
export type InsertAgentPerformance = typeof agentPerformance.$inferInsert;

/**
 * Adherence log — attendance violations logged by TL in real time.
 * Downloaded from Google Sheets as Excel at month end, uploaded to Hub.
 */
export const adherenceLog = mysqlTable("adherence_log", {
  id: int("id").autoincrement().primaryKey(),
  agentCode: varchar("agentCode", { length: 100 }),
  crdts: varchar("crdts", { length: 100 }),
  alias: varchar("alias", { length: 100 }),
  date: varchar("date", { length: 10 }).notNull(),              // YYYY-MM-DD
  month: varchar("month", { length: 7 }),                       // YYYY-MM
  type: varchar("type", { length: 100 }).notNull(),             // lateness, NSNC, early_exit, etc.
  hours: decimal("hours", { precision: 6, scale: 2 }),
  deduction: decimal("deduction", { precision: 10, scale: 2 }),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("approved").notNull(),
  notes: text("notes"),
  uploadedBy: varchar("uploadedBy", { length: 255 }),
  uploadedAt: bigint("uploadedAt", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  uqAdherenceAgentDateType: uniqueIndex("uq_adherence_agent_date_type").on(t.agentCode, t.date, t.type),
}));
export type AdherenceLog = typeof adherenceLog.$inferSelect;
export type InsertAdherenceLog = typeof adherenceLog.$inferInsert;

/**
 * Quality log — QA evaluations logged weekly.
 * Downloaded from Google Sheets as Excel at month end, uploaded to Hub.
 */
export const qualityLog = mysqlTable("quality_log", {
  id: int("id").autoincrement().primaryKey(),
  agentCode: varchar("agentCode", { length: 100 }),
  crdts: varchar("crdts", { length: 100 }),
  alias: varchar("alias", { length: 100 }),
  date: varchar("date", { length: 10 }).notNull(),              // YYYY-MM-DD
  month: varchar("month", { length: 7 }),                       // YYYY-MM
  type: varchar("type", { length: 100 }).notNull(),             // wrong_disposition, misleading_customer, etc.
  score: decimal("score", { precision: 5, scale: 2 }),
  penalty: decimal("penalty", { precision: 10, scale: 2 }),
  notes: text("notes"),
  uploadedBy: varchar("uploadedBy", { length: 255 }),
  uploadedAt: bigint("uploadedAt", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  uqQualityAgentDateType: uniqueIndex("uq_quality_agent_date_type").on(t.agentCode, t.date, t.type),
}));
export type QualityLog = typeof qualityLog.$inferSelect;
export type InsertQualityLog = typeof qualityLog.$inferInsert;

// ─── Live Cycle Tracker ───────────────────────────────────────────────────────
/**
 * cycle_stats — agent performance stats uploaded every ~2 hours.
 * One row per agent per date. Upserted on each upload by (crdts, date).
 */
export const cycleStats = mysqlTable("cycle_stats", {
  id: int("id").autoincrement().primaryKey(),
  crdts: varchar("crdts", { length: 100 }).notNull(),           // agent CRDTS
  agentCode: varchar("agentCode", { length: 100 }),             // T-XXXX
  alias: varchar("alias", { length: 100 }),
  date: varchar("date", { length: 10 }).notNull(),              // YYYY-MM-DD
  cycleKey: varchar("cycleKey", { length: 7 }).notNull(),       // YYYY-MM (cycle month, 26th prev → 25th this)
  loginHours: decimal("loginHours", { precision: 8, scale: 2 }).default("0"),
  totalCalls: int("totalCalls").default(0),
  revenue: decimal("revenue", { precision: 12, scale: 2 }).default("0"),
  cost: decimal("cost", { precision: 12, scale: 2 }).default("0"),
  profit: decimal("profit", { precision: 12, scale: 2 }).default("0"),
  revPerHr: decimal("revPerHr", { precision: 10, scale: 2 }).default("0"),
  uploadedAt: bigint("uploadedAt", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CycleStats = typeof cycleStats.$inferSelect;
export type InsertCycleStats = typeof cycleStats.$inferInsert;

/**
 * cycle_deductions — approved adherence violations for the current cycle.
 * Upserted on each adherence upload by (crdts, date, violationType).
 * status: approved → shown; rejected → hidden from agent view.
 */
export const cycleDeductions = mysqlTable("cycle_deductions", {
  id: int("id").autoincrement().primaryKey(),
  crdts: varchar("crdts", { length: 100 }).notNull(),
  agentCode: varchar("agentCode", { length: 100 }),
  alias: varchar("alias", { length: 100 }),
  date: varchar("date", { length: 10 }).notNull(),              // YYYY-MM-DD
  cycleKey: varchar("cycleKey", { length: 7 }).notNull(),
  violationType: varchar("violationType", { length: 200 }).notNull(),
  hours: decimal("hours", { precision: 8, scale: 2 }).default("0"),
  deductionAmount: decimal("deductionAmount", { precision: 10, scale: 2 }).default("0"),
  status: mysqlEnum("status", ["approved", "rejected"]).default("approved").notNull(),
  uploadedAt: bigint("uploadedAt", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CycleDeductions = typeof cycleDeductions.$inferSelect;
export type InsertCycleDeductions = typeof cycleDeductions.$inferInsert;

/**
 * cycle_ot — overtime events for the current cycle.
 * Upserted on each OT upload by (crdts, date, otType).
 */
export const cycleOT = mysqlTable("cycle_ot", {
  id: int("id").autoincrement().primaryKey(),
  crdts: varchar("crdts", { length: 100 }).notNull(),
  agentCode: varchar("agentCode", { length: 100 }),
  alias: varchar("alias", { length: 100 }),
  date: varchar("date", { length: 10 }).notNull(),              // YYYY-MM-DD
  cycleKey: varchar("cycleKey", { length: 7 }).notNull(),
  otType: varchar("otType", { length: 20 }).notNull(),          // "1.5x" | "2x" | "3x"
  hours: decimal("hours", { precision: 8, scale: 2 }).default("0"),
  egpAmount: decimal("egpAmount", { precision: 10, scale: 2 }).default("0"),
  uploadedAt: bigint("uploadedAt", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CycleOT = typeof cycleOT.$inferSelect;
export type InsertCycleOT = typeof cycleOT.$inferInsert;

/**
 * team_leaders — fixed list of TL names managed in Settings.
 * Used to populate the TL dropdown when editing agents in Operations.
 */
export const teamLeaders = mysqlTable("team_leaders", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 64 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type TeamLeader = typeof teamLeaders.$inferSelect;
export type InsertTeamLeader = typeof teamLeaders.$inferInsert;

/**
 * coaching_cases — admin-only coaching records linked to Operations agents.
 * NOT visible to agents on their portal.
 * Each case tracks one coaching engagement from trigger to resolution.
 */
export const coachingCases = mysqlTable("coaching_cases", {
  id: int("id").autoincrement().primaryKey(),
  // Agent identity (from Operations workforce)
  agentId: int("agentId").notNull(),                              // workforce.id
  agentCrdts: varchar("agentCrdts", { length: 100 }).notNull(),
  agentAlias: varchar("agentAlias", { length: 100 }),
  nestingLabel: varchar("nestingLabel", { length: 50 }),          // Nesting | Active | Senior
  // Coaching metadata
  assignedBy: varchar("assignedBy", { length: 255 }).notNull(),   // manager / TL name
  cycleKey: varchar("cycleKey", { length: 7 }).notNull(),         // YYYY-MM
  followUpDate: varchar("followUpDate", { length: 10 }),          // YYYY-MM-DD
  // Coaching content
  coachingReason: text("coachingReason").notNull(),               // what triggered this session
  whatHappened: text("whatHappened"),                             // notes from the session
  afterCoaching: text("afterCoaching"),                           // observed improvement / response
  nextSteps: text("nextSteps"),                                   // action items
  // Status
  status: mysqlEnum("status", ["pending", "in_progress", "improved", "no_change", "escalated", "terminated"])
    .default("pending").notNull(),
  statusNote: text("statusNote"),                                 // note attached to latest status change
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CoachingCase = typeof coachingCases.$inferSelect;
export type InsertCoachingCase = typeof coachingCases.$inferInsert;

/**
 * client_logouts — dates when a client logged out an agent due to poor performance.
 * Uploaded by admin (CRDTS + Date). Upserted on (crdts, date).
 */
export const clientLogouts = mysqlTable("client_logouts", {
  id: int("id").autoincrement().primaryKey(),
  crdts: varchar("crdts", { length: 100 }).notNull(),
  agentCode: varchar("agentCode", { length: 100 }),
  alias: varchar("alias", { length: 100 }),
  date: varchar("date", { length: 10 }).notNull(),              // YYYY-MM-DD
  cycleKey: varchar("cycleKey", { length: 7 }).notNull(),       // YYYY-MM
  uploadedAt: bigint("uploadedAt", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ClientLogout = typeof clientLogouts.$inferSelect;
export type InsertClientLogout = typeof clientLogouts.$inferInsert;

/**
 * agent_quality_flags — per-call QA results pushed from the Quality sheet for
 * AGENT VISIBILITY ONLY. This is intentionally separate from agent_violations and
 * is NEVER read by payroll. deductionEgp/hours are shown for the agent's awareness.
 */
export const agentQualityFlags = mysqlTable("agent_quality_flags", {
  id: int("id").autoincrement().primaryKey(),
  crdts: varchar("crdts", { length: 100 }).notNull(),
  agentCode: varchar("agentCode", { length: 100 }),
  alias: varchar("alias", { length: 100 }),
  date: varchar("date", { length: 10 }).notNull(),              // YYYY-MM-DD
  violation: varchar("violation", { length: 255 }),
  score: decimal("score", { precision: 5, scale: 1 }),          // TOTAL /100
  deductionEgp: decimal("deductionEgp", { precision: 10, scale: 2 }).default("0"), // informational only
  hours: decimal("hours", { precision: 6, scale: 2 }).default("0"),                // informational only
  cycleKey: varchar("cycleKey", { length: 7 }).notNull(),       // YYYY-MM
  uploadedAt: bigint("uploadedAt", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AgentQualityFlag = typeof agentQualityFlags.$inferSelect;
export type InsertAgentQualityFlag = typeof agentQualityFlags.$inferInsert;

/**
 * coaching_case_status_log — audit trail of status changes on a coaching case.
 */
export const coachingCaseStatusLog = mysqlTable("coaching_case_status_log", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("caseId").notNull(),                               // coachingCases.id
  fromStatus: varchar("fromStatus", { length: 50 }),
  toStatus: varchar("toStatus", { length: 50 }).notNull(),
  note: text("note"),
  changedBy: varchar("changedBy", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CoachingCaseStatusLog = typeof coachingCaseStatusLog.$inferSelect;
export type InsertCoachingCaseStatusLog = typeof coachingCaseStatusLog.$inferInsert;

/**
 * integrations_tokens — stores OAuth tokens for third-party integrations (Google Calendar, etc.)
 */
export const integrationsTokens = mysqlTable("integrations_tokens", {
  id:           int("id").autoincrement().primaryKey(),
  provider:     varchar("provider", { length: 50 }).notNull().unique(),
  accessToken:  text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt:    bigint("expires_at", { mode: "number" }),
  scope:        text("scope"),
  createdAt:    bigint("created_at", { mode: "number" }).notNull(),
  updatedAt:    bigint("updated_at", { mode: "number" }).notNull(),
});
export type IntegrationsToken = typeof integrationsTokens.$inferSelect;

/**
 * commissions — standalone commission records uploaded by admin, separate from payroll.
 * paymentCycle: YYYY-MM of the pay cycle (when it's paid)
 * performanceMonth: human-readable label of the performance period (e.g. "March 2026")
 */
export const commissions = mysqlTable("commissions", {
  id:               int("id").autoincrement().primaryKey(),
  crdts:            varchar("crdts", { length: 50 }).notNull(),
  alias:            varchar("alias", { length: 255 }),
  commissionEgp:    decimal("commissionEgp", { precision: 10, scale: 2 }).notNull().default("0"),
  performanceMonth: varchar("performanceMonth", { length: 100 }),
  paymentCycle:     varchar("paymentCycle", { length: 7 }).notNull(),   // YYYY-MM
  paymentStatus:    varchar("paymentStatus", { length: 50 }).default("pending"),
  uploadedBy:       varchar("uploadedBy", { length: 255 }),
  uploadedAt:       bigint("uploadedAt", { mode: "number" }).notNull(),
  createdAt:        timestamp("createdAt").defaultNow().notNull(),
  updatedAt:        timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  uqCrdtsCycle: uniqueIndex("uq_commissions_crdts_cycle").on(t.crdts, t.paymentCycle),
}));
export type Commission = typeof commissions.$inferSelect;
export type InsertCommission = typeof commissions.$inferInsert;

/**
 * commissionLeaderboard — leaderboard rows parsed from Campaign tabs of the commission file.
 * Stored separately from cycleStats (Vicidial data) so the official curated rankings
 * from the commission file are the source of truth for the agent portal leaderboard.
 * cycleKey: YYYY-MM matching the paymentCycle of the commission upload.
 */
export const commissionLeaderboard = mysqlTable("commission_leaderboard", {
  id:              int("id").autoincrement().primaryKey(),
  cycleKey:        varchar("cycleKey", { length: 7 }).notNull(),   // YYYY-MM
  campaignName:    varchar("campaignName", { length: 100 }).notNull(),
  crdts:           varchar("crdts", { length: 50 }).notNull(),
  alias:           varchar("alias", { length: 255 }),
  rank:            int("rank").notNull(),
  loginHours:      decimal("loginHours", { precision: 10, scale: 2 }).default("0"),
  revenue:         decimal("revenue", { precision: 14, scale: 2 }).default("0"),
  profit:          decimal("profit", { precision: 14, scale: 2 }).default("0"),
  commissionEgp:   decimal("commissionEgp", { precision: 10, scale: 2 }).default("0"),
  performanceMonth: varchar("performanceMonth", { length: 100 }),
  uploadedAt:      bigint("uploadedAt", { mode: "number" }).notNull(),
}, (t) => ({
  uqLeaderboard: uniqueIndex("uq_commission_leaderboard_cycle_crdts").on(t.cycleKey, t.crdts),
}));
export type CommissionLeaderboard = typeof commissionLeaderboard.$inferSelect;
export type InsertCommissionLeaderboard = typeof commissionLeaderboard.$inferInsert;

/**
 * payrollAdjustments — manual bonus or deduction entries per agent per pay cycle.
 * Added by admin from the Payroll tab. Included in net pay calculation.
 * type: 'bonus' | 'deduction'
 * month: YYYY-MM (pay cycle)
 */
export const payrollAdjustments = mysqlTable("payroll_adjustments", {
  id:          int("id").autoincrement().primaryKey(),
  crdts:       varchar("crdts", { length: 50 }).notNull(),
  month:       varchar("month", { length: 7 }).notNull(),   // YYYY-MM pay cycle
  type:        mysqlEnum("type", ["bonus", "deduction"]).notNull(),
  label:       varchar("label", { length: 255 }).notNull(), // e.g. "Overtime bonus", "Equipment deduction"
  amount:      decimal("amount", { precision: 10, scale: 2 }).notNull(),
  createdAt:   bigint("createdAt", { mode: "number" }).notNull(),
  createdBy:   varchar("createdBy", { length: 255 }),       // admin name
});
export type PayrollAdjustment = typeof payrollAdjustments.$inferSelect;
export type InsertPayrollAdjustment = typeof payrollAdjustments.$inferInsert;

/**
 * trainerSalaries — manually entered salary records for trainers.
 * Managed from the Payroll tab and Commission tab.
 * month: YYYY-MM (pay cycle)
 */
export const trainerSalaries = mysqlTable("trainer_salaries", {
  id:          int("id").autoincrement().primaryKey(),
  crdts:       varchar("crdts", { length: 50 }),             // linked agent CRDTS
  trainerName: varchar("trainerName", { length: 255 }).notNull(),
  month:       varchar("month", { length: 7 }).notNull(),   // YYYY-MM pay cycle
  salaryEgp:   decimal("salaryEgp", { precision: 10, scale: 2 }).notNull().default("0"),
  notes:       varchar("notes", { length: 500 }),
  createdAt:   bigint("createdAt", { mode: "number" }).notNull(),
  updatedAt:   bigint("updatedAt", { mode: "number" }).notNull(),
});
export type TrainerSalary = typeof trainerSalaries.$inferSelect;
export type InsertTrainerSalary = typeof trainerSalaries.$inferInsert;

/**
 * API keys — for programmatic REST API access.
 * Admin generates keys; each key is hashed before storage.
 */
export const apiKeys = mysqlTable("api_keys", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  keyHash: varchar("key_hash", { length: 255 }).notNull().unique(),
  keyPrefix: varchar("key_prefix", { length: 16 }).notNull(),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  lastUsedAt: bigint("last_used_at", { mode: "number" }),
  revokedAt: bigint("revoked_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════
// #5 — CRDTS REUSE ARCHIVE
// When a CRDTS that belonged to a resigned/terminated agent is reassigned to a
// NEW agent, the handover is recorded here. Nothing is ever deleted — the
// previous agent keeps all of their payroll/performance records; this table just
// documents who held the CRDTS before and when it changed hands.
// ═══════════════════════════════════════════════════════════════════════════
export const crdtsArchive = mysqlTable("crdts_archive", {
  id: int("id").autoincrement().primaryKey(),
  crdts: varchar("crdts", { length: 100 }).notNull(),
  previousAgentId: int("previousAgentId"),
  previousAgentCode: varchar("previousAgentCode", { length: 100 }),
  previousAgentName: varchar("previousAgentName", { length: 255 }),
  previousAgentAlias: varchar("previousAgentAlias", { length: 100 }),
  previousStatus: varchar("previousStatus", { length: 30 }),   // resigned / terminated
  newAgentId: int("newAgentId"),
  newAgentCode: varchar("newAgentCode", { length: 100 }),
  newAgentName: varchar("newAgentName", { length: 255 }),
  archivedBy: varchar("archivedBy", { length: 255 }),
  archivedAt: bigint("archivedAt", { mode: "number" }).notNull(),
});
export type CrdtsArchive = typeof crdtsArchive.$inferSelect;
export type InsertCrdtsArchive = typeof crdtsArchive.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════
// #2 — BUSINESS DEVELOPMENT CRM
// Contacts are SHARED across the BD team; each deal has an owner (You / Malak /
// Ali) so each person sees their own pipeline while the contact database is common.
// ═══════════════════════════════════════════════════════════════════════════
export const bdUsers = mysqlTable("bd_users", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  role: mysqlEnum("role", ["lead", "bd", "admin"]).default("bd").notNull(),
  openId: varchar("openId", { length: 64 }),   // linked Hub login once they sign in
  active: boolean("active").default(true).notNull(),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
});
export type BdUser = typeof bdUsers.$inferSelect;
export type InsertBdUser = typeof bdUsers.$inferInsert;

export const bdContacts = mysqlTable("bd_contacts", {
  id: int("id").autoincrement().primaryKey(),
  company: varchar("company", { length: 255 }).notNull(),
  contactName: varchar("contactName", { length: 255 }),
  jobTitle: varchar("jobTitle", { length: 150 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 64 }),
  website: varchar("website", { length: 320 }),
  source: varchar("source", { length: 120 }),          // where the lead came from
  notes: text("notes"),
  createdBy: int("createdBy"),                          // bdUsers.id
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
});
export type BdContact = typeof bdContacts.$inferSelect;
export type InsertBdContact = typeof bdContacts.$inferInsert;

export const bdDeals = mysqlTable("bd_deals", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),  // deal name
  contactId: int("contactId"),                         // bdContacts.id (shared)
  ownerId: int("ownerId").notNull(),                   // bdUsers.id — whose pipeline
  stage: mysqlEnum("stage", ["follow_up", "negotiations", "review", "partners_consultants", "closed_won", "closed_lost"]).default("follow_up").notNull(),
  serviceType: varchar("serviceType", { length: 150 }), // call-center service being sold
  seats: int("seats"),                                  // e.g. number of agents/seats
  value: varchar("value", { length: 60 }),              // monetary value (free text — currency varies)
  notes: text("notes"),
  expectedCloseDate: varchar("expectedCloseDate", { length: 20 }), // YYYY-MM-DD
  lastContactedAt: bigint("lastContactedAt", { mode: "number" }),  // updated whenever an activity is logged
  reminderDate: varchar("reminderDate", { length: 20 }),           // YYYY-MM-DD follow-up
  reminderNote: varchar("reminderNote", { length: 255 }),
  outcomeReason: varchar("outcomeReason", { length: 255 }),        // why won / lost
  stageChangedAt: bigint("stageChangedAt", { mode: "number" }),    // for time-in-stage
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
  closedAt: bigint("closedAt", { mode: "number" }),
});
export type BdDeal = typeof bdDeals.$inferSelect;
export type InsertBdDeal = typeof bdDeals.$inferInsert;

// Activity log — timestamped notes per deal ("left VM", "sent proposal", …)
export const bdDealActivity = mysqlTable("bd_deal_activity", {
  id: int("id").autoincrement().primaryKey(),
  dealId: int("dealId").notNull(),
  note: text("note").notNull(),
  createdBy: int("createdBy"),          // bdUsers.id (optional)
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
});
export type BdDealActivity = typeof bdDealActivity.$inferSelect;
export type InsertBdDealActivity = typeof bdDealActivity.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════
// LEAVE MANAGEMENT — casual (عارضة) + annual (اعتيادية) only.
// Agents never see balances; HR classifies each request on approval.
// ═══════════════════════════════════════════════════════════════════════════
export const leaveBalances = mysqlTable("leave_balances", {
  id: int("id").autoincrement().primaryKey(),
  traineeCode: varchar("traineeCode", { length: 100 }).notNull(),
  year: int("year").notNull(),
  casualTotal: int("casualTotal").default(0).notNull(),   // إجازة عارضة
  annualTotal: int("annualTotal").default(0).notNull(),   // إجازة اعتيادية
  casualUsed: int("casualUsed").default(0).notNull(),
  annualUsed: int("annualUsed").default(0).notNull(),
  updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
});
export type LeaveBalance = typeof leaveBalances.$inferSelect;

export const leaveRequests = mysqlTable("leave_requests", {
  id: int("id").autoincrement().primaryKey(),
  traineeCode: varchar("traineeCode", { length: 100 }).notNull(),
  startDate: varchar("startDate", { length: 20 }).notNull(),  // YYYY-MM-DD
  endDate: varchar("endDate", { length: 20 }).notNull(),
  days: int("days").default(1).notNull(),
  reason: text("reason"),
  leaveType: mysqlEnum("leaveType", ["casual", "annual"]),    // NULL until HR classifies
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  decidedBy: varchar("decidedBy", { length: 255 }),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  decidedAt: bigint("decidedAt", { mode: "number" }),
});
export type LeaveRequest = typeof leaveRequests.$inferSelect;

// ═══════════════════════════════════════════════════════════════════════════
// EXIT PROCESS — required checklist before a former agent can be archived.
// ═══════════════════════════════════════════════════════════════════════════
export const exitProcess = mysqlTable("exit_process", {
  id: int("id").autoincrement().primaryKey(),
  traineeCode: varchar("traineeCode", { length: 100 }).notNull().unique(),
  exitType: mysqlEnum("exitType", ["resignation", "termination", "contract_end"]),  // استقالة / فصل / انتهاء عقد
  exitInterview: boolean("exitInterview").default(false).notNull(),
  clearance: boolean("clearance").default(false).notNull(),
  assetsReturned: boolean("assetsReturned").default(false).notNull(),   // استلام العهد
  lastWorkingDay: varchar("lastWorkingDay", { length: 20 }),            // آخر يوم عمل
  settlementDone: boolean("settlementDone").default(false).notNull(),
  notes: text("notes"),
  completedAt: bigint("completedAt", { mode: "number" }),
  updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
});
export type ExitProcess = typeof exitProcess.$inferSelect;

// ═══════════════════════════════════════════════════════════════════════════
// BD TASKS — per-deal to-dos with due dates (HubSpot-style).
// ═══════════════════════════════════════════════════════════════════════════
export const bdTasks = mysqlTable("bd_tasks", {
  id: int("id").autoincrement().primaryKey(),
  dealId: int("dealId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  dueDate: varchar("dueDate", { length: 20 }),               // YYYY-MM-DD
  done: boolean("done").default(false).notNull(),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  doneAt: bigint("doneAt", { mode: "number" }),
});
export type BdTask = typeof bdTasks.$inferSelect;


// ═══ BD deal tasks ("send proposal by Thu") ═══
export const bdDealTasks = mysqlTable("bd_deal_tasks", {
  id: int("id").autoincrement().primaryKey(),
  dealId: int("dealId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  dueDate: varchar("dueDate", { length: 20 }),
  done: boolean("done").default(false).notNull(),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  doneAt: bigint("doneAt", { mode: "number" }),
});
export type BdDealTask = typeof bdDealTasks.$inferSelect;
