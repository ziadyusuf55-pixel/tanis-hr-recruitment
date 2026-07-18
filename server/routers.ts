import { COOKIE_NAME } from "@shared/const";
import bcrypt from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { parse as parseCookieHeader } from "cookie";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  addStageNote,
  assignCandidateToBatch,
  bulkInsertCandidates,
  checkDuplicateByPhone,
  createBatch,
  createCandidate,
  createInterview,
  deleteBatch,
  deleteCandidate,
  getAvgTimeToHire,
  getBatchById,
  getCandidateBatch,
  getCandidatesAddedSince,
  getInterviewsScheduledSince,
  getPipelineCounts,
  getTurnoverRate,
  getCandidateById,
  getReApplicants,
  listActivityByCandidateId,
  listAllActivity,
  listBatches,
  listCandidatesInBatch,
  listInterviewsByCandidateId,
  listNotesByCandidateId,
  logActivity,
  markInterviewNotificationSent,
  getAllBatchAssignments,
  removeCandidateFromBatch,
  setTraineeCode,
  toggleSlackJoined,
  updateBatch,
  updateCandidate,
  updateCandidateStatus,
  getNoAnswerCount,
  setSubStatus,
  listCandidates,
  getAgentCredentialByCandidateId,
  getAgentCredentialByTraineeCode,
  upsertAgentCredential,
  changeAgentPassword,
  getPayrollByCandidateId,
  upsertPayrollRecordLegacy,
  deletePayrollRecord,
  upsertPayrollFromExcel,
  getPayrollMonths,
  getPayrollByMonth,
  getPayrollByAgentCode,
  getPayrollMonthsByAgentCode,
  getPerformanceByCandidateId,
  upsertPerformanceRecord,
  deletePerformanceRecord,
  createAgentRequest,
  listAgentRequestsByCandidate,
  listAllAgentRequests,
  updateAgentRequestStatus,
  getAgentRequestById,
  // Admin accounts
  getAdminByEmail,
  getAdminById,
  createAdminAccount,
  listAdminAccounts,
  setAdminActive,
  updateAdminPassword,
  // Admin invites
  createAdminInvite,
  getAdminInviteByToken,
  markAdminInviteUsed,
  // Rate limiting
  isLockedOut,
  recordFailedLogin,
  countRecentFailedLogins,
  clearLoginAttempts,
  // Referrals
  createReferral,
  getReferralsByReferrer,
  listAllReferrals,
  updateReferralStatus,
  // Request unread tracking
  countUnreadAgentRequests,
  markAllAgentRequestsRead,
  // Notifications
  createAgentNotification,
  getNotificationsByCandidate,
  markNotificationsRead,
  countUnreadNotifications,
  // Campaigns
  listCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  // Workforce agents
  listWorkforceAgents,
  getWorkforceAgentByCode,
  getEligibleCandidatesForOps,
  createWorkforceAgent,
  updateWorkforceAgent,
  // Payment methods
  getPaymentMethodsByCode,
  listAllPaymentMethods,
  upsertPaymentMethod,
  setPaymentMethodPreferred,
  addPaymentMethodComment,
  deletePaymentMethod,
  // Documents
  getDocumentsByCode,
  listAllDocuments,
  upsertAgentDocument,
  reviewAgentDocument,
  // Schedule change requests
  createScheduleChangeRequest,
  listScheduleChangeRequestsByCode,
  listAllScheduleChangeRequests,
  updateScheduleChangeRequest,
  // Overtime
  upsertOvertimeAvailability,
  getOvertimeAvailabilityForDate,
  getHeadcountForecast,
  // Agent comments
  getCommentsByCode,
  addAgentComment,
  deleteAgentComment,
  bulkReplaceBreaks,
  getBreakSchedulesByAgent,
  getBreakSchedulesByDateRange,
  deleteBreakSchedule,
  // Separations
  markAgentResignedOnSpot,
  terminateAgent,
  approveResignationRequest,
  getSeparationsByAgent,
  scheduleResignation,
  cancelScheduledSeparation,
  getPendingSeparationForAgent,
  // Payroll v2
  upsertPayrollRecordV2,
  getPayrollStatusPage,
  setPayrollStatus,
  getMyPayrollMonthsByCrdts,
  getMyPayrollRecordByCrdts,
  // Orientation
  markOrientationShown,
  resetOrientation,
  getOrientationStatus,
  // Violations
  bulkInsertViolations,
  listViolations,
  // Performance v2
  bulkUpsertPerformance,
  getPerformanceByMonth,
  getPerformanceMonths,
  // Adherence
  bulkInsertAdherence,
  listAdherence,
  getAdherenceMonths,
  // Quality
  bulkInsertQuality,
  listQuality,
  getQualityMonths,
  // Cycle Tracker
  getCurrentCycleKey,
  getCycleKeyForDate,
  getCycleDateRange,
  upsertCycleStats,
  upsertCycleDeductions,
  upsertCycleOT,
  getCycleTrackerForAgent,
  // New Round 61
  listAllAgentsInTraining,
  blacklistCandidate,
  listPaymentMethodsGrouped,
  // New Round 62
  bulkUpsertClientLogouts,
  getClientLogoutsByCycle,
  getClientLogoutsByAgent,
  getAgentQualityFlagsByAgent,
  getCommissionMonthData,
  getAvailableCommissionMonths,
  getAgentPerformanceHistory,
  getCampaignRanking,
  adminDeleteAgent,
  getPendingDeletionAgents,
  getNextAvailableTraineeCode,
} from "./db";
import { notifyOwner } from "./_core/notification";
import { sendInterviewNotification } from "./email";
import { ENV } from "./_core/env";
import crypto from "crypto";
import jwt from "jsonwebtoken";

const ADMIN_COOKIE = "tanis_admin_session";
const ADMIN_LOCKOUT_MAX = 5;

const PIPELINE_STAGES_ZOD = z.enum([
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
]);

const authRouter = router({
  me: publicProcedure.query((opts) => opts.ctx.user),
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),

  // ── Central permissions (tab-level roles on the Google-login users) ──
  // List everyone who has signed in, with their current role — for the Settings role manager.
  listAppUsers: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin" && ctx.user?.role !== "owner") throw new TRPCError({ code: "FORBIDDEN" });
    const { getDb } = await import("./db");
    const { desc } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return [];
    const { users } = await import("../drizzle/schema");
    const rows = await db.select({
      openId: users.openId, name: users.name, email: users.email,
      role: users.role, lastSignedIn: users.lastSignedIn,
    }).from(users).orderBy(desc(users.lastSignedIn));
    return rows;
  }),

  // Owner/admin sets another user's role. Can't demote yourself out of full access by accident.
  setUserRole: protectedProcedure
    .input(z.object({ openId: z.string(), role: z.enum(["owner", "admin", "manager", "hr", "ops_manager", "team_lead", "finance", "bd", "viewer", "user"]) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin" && ctx.user?.role !== "owner") throw new TRPCError({ code: "FORBIDDEN" });
      if (input.openId === ctx.user?.openId && input.role !== "owner" && input.role !== "admin") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You can't remove your own full access. Ask another owner to change your role." });
      }
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { users } = await import("../drizzle/schema");
      await db.update(users).set({ role: input.role }).where(eq(users.openId, input.openId));
      return { ok: true } as const;
    }),
});


const batchesRouter = router({
    list: protectedProcedure.query(() => listBatches()),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getBatchById(input.id)),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        trainerName: z.string().optional(),
        startDate: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(({ input }) => createBatch(input)),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        trainerName: z.string().nullable().optional(),
        startDate: z.number().nullable().optional(),
        notes: z.string().nullable().optional(),
      }))
      .mutation(({ input: { id, ...data } }) => updateBatch(id, data)),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteBatch(input.id)),

    listCandidates: protectedProcedure
      .input(z.object({ batchId: z.number() }))
      .query(({ input }) => listCandidatesInBatch(input.batchId)),

    assignCandidate: protectedProcedure
      .input(z.object({ batchId: z.number(), candidateId: z.number() }))
      .mutation(({ input }) => assignCandidateToBatch(input.batchId, input.candidateId)),

    removeCandidate: protectedProcedure
      .input(z.object({ batchId: z.number(), candidateId: z.number() }))
      .mutation(({ input }) => removeCandidateFromBatch(input.batchId, input.candidateId)),

    setTraineeCode: protectedProcedure
      .input(z.object({ batchId: z.number(), candidateId: z.number(), code: z.string().nullable() }))
      .mutation(({ input }) => setTraineeCode(input.batchId, input.candidateId, input.code)),

    getCandidateBatch: protectedProcedure
      .input(z.object({ candidateId: z.number() }))
      .query(({ input }) => getCandidateBatch(input.candidateId)),

    toggleSlackJoined: protectedProcedure
      .input(z.object({ batchId: z.number(), candidateId: z.number(), value: z.boolean() }))
      .mutation(({ input }) => toggleSlackJoined(input.batchId, input.candidateId, input.value)),

  allAssignments: protectedProcedure
    .query(() => getAllBatchAssignments()),
  // Bulk generate credentials for all agents in a batch
  bulkGenerateCredentials: protectedProcedure
    .input(z.object({ batchId: z.number() }))
    .mutation(async ({ input }) => {
      const candidates = await listCandidatesInBatch(input.batchId);
      const results: Array<{ candidateId: number; traineeCode: string; password: string }> = [];
      for (const c of candidates) {
        if (!c.traineeCode) continue; // skip agents without trainee code
        const plainPassword = generatePassword(c.traineeCode);
        const passwordHash = await bcrypt.hash(plainPassword, 10);
        await upsertAgentCredential(c.id, c.traineeCode, passwordHash);
        results.push({ candidateId: c.id, traineeCode: c.traineeCode, password: plainPassword });
      }
      return { generated: results.length, credentials: results };
    }),
});

const candidatesRouter = router({
  list: protectedProcedure.query(() => listCandidates()),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getCandidateById(input.id)),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          email: z.string().email().optional(),
          phone: z.string().optional(),
          positionApplied: z.string().optional(),
          resumeLink: z.string().optional(),
          notes: z.string().optional(),
          status: PIPELINE_STAGES_ZOD.optional(),
          age: z.number().int().min(16).max(80).optional(),
          location: z.string().optional(),
          source: z.enum(["linkedin", "email", "referral", "walk_in", "other"]).optional(),
          wave: z.number().int().min(1).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const result = await createCandidate(input);
        const insertId = (result as unknown as { insertId: number }).insertId;
        if (insertId) {
          await logActivity({
            candidateId: insertId,
            action: "candidate_created",
            toStage: input.status ?? "applied",
            performedBy: ctx.user?.name ?? undefined,
          });
        }
        return result;
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).optional(),
          email: z.string().email().optional(),
          phone: z.string().nullable().optional(),
          positionApplied: z.string().optional(),
          resumeLink: z.string().nullable().optional(),
          notes: z.string().nullable().optional(),
          meetLink: z.string().nullable().optional(),
          teamsLink: z.string().nullable().optional(),
          age: z.number().int().min(16).max(80).nullable().optional(),
          location: z.string().nullable().optional(),
          source: z.enum(["linkedin", "email", "referral", "walk_in", "other"]).nullable().optional(),
          voiceNoteRating: z.number().int().min(1).max(5).nullable().optional(),
          screeningNotes: z.string().nullable().optional(),
          wave: z.number().int().min(1).nullable().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updateCandidate(id, data);
      }),

    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: PIPELINE_STAGES_ZOD,
        fromStage: PIPELINE_STAGES_ZOD.optional(),
        detail: z.string().optional(), // e.g. rejection reason
      }))
      .mutation(async ({ input, ctx }) => {
        await updateCandidateStatus(input.id, input.status);
        // WhatsApp group cascade: if moving away from whatsapp_group_added, remove from batch
        if (input.fromStage === "whatsapp_group_added" && input.status !== "whatsapp_group_added") {
          const batch = await getCandidateBatch(input.id);
          if (batch) {
            await removeCandidateFromBatch(batch.id, input.id);
          }
        }
        await logActivity({
          candidateId: input.id,
          action: "stage_change",
          fromStage: input.fromStage,
          toStage: input.status,
          detail: input.detail,
          performedBy: ctx.user?.name ?? undefined,
        });
        return { success: true };
      }),

    /** Mark/unmark a candidate as "No Answer" (phone call not answered) */
    setSubStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        subStatus: z.enum(["no_answer"]).nullable(),
      }))
      .mutation(async ({ input, ctx }) => {
        await setSubStatus(input.id, input.subStatus);
        await logActivity({
          candidateId: input.id,
          action: "stage_change",
          detail: input.subStatus === "no_answer" ? "Marked as No Answer" : "No Answer cleared",
          performedBy: ctx.user?.name ?? undefined,
        });
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteCandidate(input.id)),
    blacklist: protectedProcedure
      .input(z.object({ id: z.number(), reason: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        await blacklistCandidate(input.id, input.reason);
        await logActivity({
          candidateId: input.id,
          action: "stage_change",
          toStage: "blacklisted",
          detail: input.reason,
          performedBy: ctx.user?.name ?? undefined,
        });
        return { success: true };
      }),

    bulkImport: protectedProcedure
      .input(
        z.array(
          z.object({
            name: z.string().min(1),
            email: z.string().optional(),
            phone: z.string().optional(),
            positionApplied: z.string().optional(),
            resumeLink: z.string().optional(),
            notes: z.string().optional(),
            age: z.number().int().min(16).max(80).optional(),
            location: z.string().optional(),
            source: z.enum(["linkedin", "email", "referral", "walk_in", "other"]).optional(),
            wave: z.number().int().min(1).optional(),
          })
        )
      )
      .mutation(({ input }) => bulkInsertCandidates(input)),

    /** Check if a phone number already exists — used for duplicate prevention */
    checkDuplicate: protectedProcedure
      .input(z.object({ phone: z.string() }))
      .query(({ input }) => checkDuplicateByPhone(input.phone)),

    /** Returns all candidates whose phone matches a previously rejected candidate */
    reApplicants: protectedProcedure
      .query(() => getReApplicants()),

    /** Upload a CV file and attach it to a candidate */
    uploadCv: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          fileBase64: z.string(),   // base64-encoded file content
          fileName: z.string(),
          mimeType: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const { storagePut } = await import("./storage");
        const buffer = Buffer.from(input.fileBase64, "base64");
        const ext = input.fileName.split(".").pop() ?? "pdf";
        const key = `cvs/${input.id}-${Date.now()}.${ext}`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        await updateCandidate(input.id, { cvUrl: url, cvFileName: input.fileName });
        return { url, fileName: input.fileName };
      }),

    /** Remove CV attachment from a candidate */
  removeCv: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => updateCandidate(input.id, { cvUrl: null, cvFileName: null })),
});

const activityRouter = router({
    list: protectedProcedure
      .input(z.object({ candidateId: z.number() }))
      .query(({ input }) => listActivityByCandidateId(input.candidateId)),

  listAll: protectedProcedure
    .input(z.object({ limit: z.number().optional() }))
    .query(({ input }) => listAllActivity(input.limit ?? 200)),
});

const notesRouter = router({
    list: protectedProcedure
      .input(z.object({ candidateId: z.number() }))
      .query(({ input }) => listNotesByCandidateId(input.candidateId)),

  add: protectedProcedure
    .input(
      z.object({
        candidateId: z.number(),
        stage: PIPELINE_STAGES_ZOD,
        note: z.string().min(1),
        recruiterName: z.string().optional(),
      })
    )
    .mutation(({ input, ctx }) =>
      addStageNote({
        ...input,
        recruiterName: input.recruiterName ?? ctx.user?.name ?? undefined,
      })
    ),
});

const interviewsRouter = router({
    listByCandidate: protectedProcedure
      .input(z.object({ candidateId: z.number() }))
      .query(({ input }) => listInterviewsByCandidateId(input.candidateId)),

    schedule: protectedProcedure
      .input(
        z.object({
          candidateId: z.number(),
          scheduledAt: z.number(), // UTC ms
          location: z.string().optional(),
          interviewerName: z.string().optional(),
          notes: z.string().optional(),
          recruiterEmail: z.string().email().optional(),
          candidateName: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await createInterview({
          candidateId: input.candidateId,
          scheduledAt: input.scheduledAt,
          location: input.location,
          interviewerName: input.interviewerName,
          notes: input.notes,
        });

        // Send email notification to recruiter
        const recruiterEmail = input.recruiterEmail ?? ctx.user?.email ?? undefined;
        if (recruiterEmail) {
          try {
            await sendInterviewNotification({
              recruiterEmail,
              candidateName: input.candidateName ?? "Candidate",
              scheduledAt: input.scheduledAt,
              location: input.location,
              notes: input.notes,
            });
          } catch (err) {
            console.error("[Email] Failed to send interview notification:", err);
          }
        }

        return { success: true };
      }),
});

const dashboardRouter = router({
    pipelineCounts: protectedProcedure
      .input(z.object({ period: z.enum(["week", "month", "all"]).default("month") }))
      .query(({ input }) => getPipelineCounts(input.period)),

    kpis: protectedProcedure
      .input(z.object({ period: z.enum(["week", "month", "all"]).default("month") }))
      .query(async ({ input }) => {
        const { period } = input;
        const now = Date.now();
        let sinceMs = 0;
        if (period === "week") sinceMs = now - 7 * 24 * 60 * 60 * 1000;
        else if (period === "month") sinceMs = now - 30 * 24 * 60 * 60 * 1000;

        // Turnover rate: always computed for the current calendar month
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const monthStartMs = monthStart.getTime();
        const [newCandidates, scheduledInterviews, pipelineCounts, avgTimeToHire, turnoverData] =
          await Promise.all([
            getCandidatesAddedSince(sinceMs),
            getInterviewsScheduledSince(sinceMs),
            getPipelineCounts(period),
            getAvgTimeToHire(sinceMs),
            getTurnoverRate(),
          ]);

        const totalInPipeline = pipelineCounts.reduce((sum, p) => sum + p.count, 0);
        const appliedCount = pipelineCounts.find((p) => p.status === "applied")?.count ?? 0;
        const whatsappCount = pipelineCounts.find((p) => p.status === "whatsapp_sent")?.count ?? 0;
        const voiceNoteCount = pipelineCounts.find((p) => p.status === "voice_note_reviewed")?.count ?? 0;
        const interviewCount = pipelineCounts.find((p) => p.status === "interview_scheduled")?.count ?? 0;
        const acceptedCount = pipelineCounts.find((p) => p.status === "accepted")?.count ?? 0;
        const whatsappGroupCount = pipelineCounts.find((p) => p.status === "whatsapp_group_added")?.count ?? 0;
        // no_answer is now a real pipeline stage — count from pipelineCounts like all other stages
        const noAnswerCount = pipelineCounts.find((p) => p.status === "no_answer")?.count ?? 0;
        // Rejected/blacklisted: always fetch all-time counts (not period-filtered)
        const allTimeCounts = period !== "all" ? await getPipelineCounts("all") : pipelineCounts;
        const rejectedCount = allTimeCounts.find((p) => p.status === "rejected")?.count ?? 0;
        const blacklistedCount = allTimeCounts.find((p) => p.status === "blacklisted")?.count ?? 0;

        // Conversion rate: Applied → Accepted (of all non-rejected/blacklisted)
        const activeTotal = totalInPipeline - rejectedCount - blacklistedCount;
        const conversionRate = activeTotal > 0 ? Math.round((acceptedCount + whatsappGroupCount) / activeTotal * 100) : 0;

        // WhatsApp response rate: whatsapp_sent+ / applied+
        const respondedToWhatsApp = whatsappCount + noAnswerCount + voiceNoteCount + interviewCount + acceptedCount + whatsappGroupCount + rejectedCount;
        const whatsappResponseRate = newCandidates > 0 ? Math.round(respondedToWhatsApp / Math.max(newCandidates, 1) * 100) : 0;

        // Voice note pass rate
        const voiceNotePassRate = whatsappCount > 0
          ? Math.round((voiceNoteCount + interviewCount + acceptedCount + whatsappGroupCount) / Math.max(whatsappCount + voiceNoteCount + interviewCount + acceptedCount + whatsappGroupCount, 1) * 100)
          : 0;

        // Interview show rate (those who reached interview stage)
        const interviewShowRate = voiceNoteCount > 0
          ? Math.round((interviewCount + acceptedCount + whatsappGroupCount) / Math.max(voiceNoteCount + interviewCount + acceptedCount + whatsappGroupCount, 1) * 100)
          : 0;

        return {
          // Top cards
          totalInPipeline,
          newCandidates,
          whatsappGroupAdded: whatsappGroupCount,
          avgTimeToHireDays: avgTimeToHire,
          // Rates
          conversionRate,
          whatsappResponseRate,
          voiceNotePassRate,
          interviewShowRate,
          // Stage counts for funnel
          stageCounts: {
            applied: appliedCount,
            whatsapp_sent: whatsappCount,
            no_answer: noAnswerCount,
            voice_note_reviewed: voiceNoteCount,
            interview_scheduled: interviewCount,
            accepted: acceptedCount,
            whatsapp_group_added: whatsappGroupCount,
            rejected: rejectedCount,
            blacklisted: blacklistedCount,
          },
          // Scheduled interviews
          scheduledInterviews,
          // Turnover rate: (separations this month / avg headcount) * 100
          turnoverRate: turnoverData.rate,
          turnoverSeparations: turnoverData.separationsThisMonth,
          turnoverHeadcount: turnoverData.currentHeadcount,
        };
      }),
  // Overview: pending deletion count + recent separations
  overview: protectedProcedure
    .query(async () => {
      const pending = await getPendingDeletionAgents();
      return {
        pendingDeletionCount: pending.length,
        pendingDeletionAgents: pending,
      };
    }),
});

/// ─── Agent Portal Router ─────────────────────────────────────────────────────
const AGENT_COOKIE = "tanis_agent_session";
// Helper: parse a named cookie from req.headers.cookie (no cookie-parser needed)
function getAgentCookieFromReq(req: { headers: { cookie?: string } }): string | undefined {
  // Global lock — when set, no agent request resolves (kicks active sessions, not just new logins)
  if (process.env.AGENT_PORTAL_LOCKED === "true") return undefined;
  if (!req.headers.cookie) return undefined;
  const parsed = parseCookieHeader(req.headers.cookie);
  return parsed[AGENT_COOKIE];
}
function generatePassword(traineeCode: string): string {
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `${traineeCode}-${digits}`;
}

/** Agent-facing: an agent's OWN adherence / quality / coaching / OT records.
 *  Pushed nightly from the sheets — DISPLAY ONLY, no payroll effect. */
const agentMyRecordsProcedure = publicProcedure.query(async ({ ctx }) => {
  const empty = { adherence: [], quality: [], coaching: [], ot: [] };
  const token = getAgentCookieFromReq(ctx.req);
  if (!token) return empty;
  let traineeCode = "";
  try {
    const payload = jwt.verify(token, ENV.cookieSecret) as { traineeCode: string; type: string };
    if (payload.type !== "agent") return empty;
    traineeCode = payload.traineeCode;
  } catch { return empty; }

  const { getDb } = await import("./db");
  const { eq, or, desc } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) return empty;
  const { workforceAgents, agentViolations, cycleOT, coachingSessions } = await import("../drizzle/schema");

  const [wf] = await db.select().from(workforceAgents).where(eq(workforceAgents.traineeCode, traineeCode));
  const crdts = wf?.crdts || traineeCode;

  const [viol, ot, coaching] = await Promise.all([
    db.select().from(agentViolations)
      .where(or(eq(agentViolations.crdts, crdts), eq(agentViolations.agentCode, traineeCode)))
      .orderBy(desc(agentViolations.date)),
    db.select().from(cycleOT).where(eq(cycleOT.crdts, crdts)).orderBy(desc(cycleOT.date)),
    db.select().from(coachingSessions).where(eq(coachingSessions.crdts, crdts)).orderBy(desc(coachingSessions.sessionDate)),
  ]);

  return {
    adherence: viol.filter(v => v.category === "attendance"),
    quality: viol.filter(v => v.category === "quality"),
    coaching,
    ot,
  };
});

const agentRouter = router({
  // The agent's own adherence / quality / coaching / OT (synced from the sheets)
  myRecords: agentMyRecordsProcedure,
  // Generate credentials for a candidate — called by admin from CandidateDetail
  generateCredentials: protectedProcedure
    .input(z.object({ candidateId: z.number(), traineeCode: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const plainPassword = generatePassword(input.traineeCode);
      const passwordHash = await bcrypt.hash(plainPassword, 10);
      await upsertAgentCredential(input.candidateId, input.traineeCode, passwordHash);
      // Return plain password ONCE — admin must share it with agent
      return { traineeCode: input.traineeCode, password: plainPassword };
    }),

  // Check if credentials exist for a candidate
  hasCredentials: protectedProcedure
    .input(z.object({ candidateId: z.number() }))
    .query(async ({ input }) => {
      const cred = await getAgentCredentialByCandidateId(input.candidateId);
      return {
        exists: !!cred,
        traineeCode: cred?.traineeCode ?? null,
        mustChangePassword: cred?.mustChangePassword ?? null,
        firstLoginAt: cred?.firstLoginAt ?? null,
        lastLoginAt: cred?.lastLoginAt ?? null,
        passwordResetAt: cred?.passwordResetAt ?? null,
      };
    }),

  // Agent login — public procedure (no admin auth needed)
  login: publicProcedure
    .input(z.object({ traineeCode: z.string().min(1), password: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      // Global portal lock — set env AGENT_PORTAL_LOCKED=true to block ALL agent logins
      if (process.env.AGENT_PORTAL_LOCKED === "true") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "The agent portal is temporarily locked. Please contact your manager.",
        });
      }
      // Check lockout before any credential lookup
      const lockoutStatus = await isLockedOut(input.traineeCode, "agent");
      if (lockoutStatus.locked) {
        const remainingMins = Math.ceil(lockoutStatus.remainingMs / 60000);
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Account locked due to too many failed attempts. Try again in ${remainingMins} minute${remainingMins !== 1 ? "s" : ""}.`,
        });
      }
      const cred = await getAgentCredentialByTraineeCode(input.traineeCode);
      if (!cred) {
        await recordFailedLogin(input.traineeCode, "agent");
        const attempts = await countRecentFailedLogins(input.traineeCode, "agent");
        const remaining = Math.max(0, 5 - attempts);
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: remaining > 0
            ? `Invalid Trainee ID or password. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`
            : "Invalid Trainee ID or password.",
        });
      }
      const valid = await bcrypt.compare(input.password, cred.passwordHash);
      if (!valid) {
        await recordFailedLogin(input.traineeCode, "agent");
        const attempts = await countRecentFailedLogins(input.traineeCode, "agent");
        const remaining = Math.max(0, 5 - attempts);
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: remaining > 0
            ? `Invalid Trainee ID or password. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`
            : "Account locked. Too many failed attempts.",
        });
      }
      // Successful login — clear failed attempts
      await clearLoginAttempts(input.traineeCode, "agent");
      // Track first login and last login timestamps
      {
        const { getDb } = await import("./db");
        const { eq: eqOp } = await import("drizzle-orm");
        const db = await getDb();
        if (db) {
          const { agentCredentials } = await import("../drizzle/schema");
          const now = Date.now();
          await db.update(agentCredentials)
            .set({
              lastLoginAt: now,
              ...(cred.firstLoginAt == null ? { firstLoginAt: now } : {}),
            })
            .where(eqOp(agentCredentials.candidateId, cred.candidateId));
        }
      }
      // Create a signed JWT for the agent session
      const token = jwt.sign(
        { candidateId: cred.candidateId, traineeCode: cred.traineeCode, type: "agent" },
        ENV.cookieSecret,
        { expiresIn: "30d" }
      );
      const agentCookieOpts = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(AGENT_COOKIE, token, {
        ...agentCookieOpts,
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
      return { success: true, traineeCode: cred.traineeCode, candidateId: cred.candidateId, mustChangePassword: cred.mustChangePassword };
    }),

  // Reset agent password — admin only, generates a new random password
  resetPassword: protectedProcedure
    .input(z.object({ candidateId: z.number().optional(), traineeCode: z.string().optional(), crdts: z.string().optional() }))
    .mutation(async ({ input }) => {
      // Look up credentials by traineeCode first (more reliable for Operations agents),
      // fall back to candidateId for legacy Training-flow agents
      let cred = input.traineeCode
        ? await getAgentCredentialByTraineeCode(input.traineeCode)
        : input.candidateId
          ? await getAgentCredentialByCandidateId(input.candidateId)
          : null;

      let resolvedTraineeCode = input.traineeCode ?? cred?.traineeCode;
      let resolvedCandidateId = input.candidateId ?? cred?.candidateId ?? 0;

      // If still no traineeCode, try to look up from workforce table by crdts
      if (!resolvedTraineeCode && input.crdts) {
        const { getDb } = await import("./db");
        const { eq: eqOp } = await import("drizzle-orm");
        const db = await getDb();
        if (db) {
          const { workforceAgents } = await import("../drizzle/schema");
          const wa = await db.select({ traineeCode: workforceAgents.traineeCode, candidateId: workforceAgents.candidateId })
            .from(workforceAgents)
            .where(eqOp(workforceAgents.crdts, input.crdts))
            .limit(1);
          if (wa[0]?.traineeCode) {
            resolvedTraineeCode = wa[0].traineeCode;
            resolvedCandidateId = wa[0].candidateId ?? resolvedCandidateId;
          }
        }
      }

      // Last resort: use crdts itself as the traineeCode identifier
      if (!resolvedTraineeCode && input.crdts) {
        resolvedTraineeCode = input.crdts;
      }

      if (!resolvedTraineeCode) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "traineeCode is required" });
      }

      const newPassword = generatePassword(resolvedTraineeCode);
      const passwordHash = await bcrypt.hash(newPassword, 10);

      // Upsert — creates credentials if they don't exist yet
      await upsertAgentCredential(resolvedCandidateId, resolvedTraineeCode, passwordHash);

      // Track reset timestamp
      {
        const { getDb } = await import("./db");
        const { eq: eqOp } = await import("drizzle-orm");
        const db = await getDb();
        if (db) {
          const { agentCredentials } = await import("../drizzle/schema");
          await db.update(agentCredentials)
            .set({ passwordResetAt: Date.now() })
            .where(eqOp(agentCredentials.traineeCode, resolvedTraineeCode));
        }
      }
      return { traineeCode: resolvedTraineeCode, password: newPassword };
    }),
  // Agent logout
  logout: publicProcedure.mutation(async ({ ctx }) => {
    ctx.res.clearCookie(AGENT_COOKIE, { path: "/" });
    return { success: true };
  }),
  // Change password — agent must be logged in (verified via cookie)
  changePassword: publicProcedure
    .input(z.object({ newPassword: z.string().min(6) }))
    .mutation(async ({ input, ctx }) => {
      const token = getAgentCookieFromReq(ctx.req);
      if (!token) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
      let payload: { candidateId: number; traineeCode: string; type: string };
      try {
        payload = jwt.verify(token, ENV.cookieSecret) as { candidateId: number; traineeCode: string; type: string };
      } catch {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid session" });
      }
      if (payload.type !== "agent") throw new TRPCError({ code: "UNAUTHORIZED" });
      const newHash = await bcrypt.hash(input.newPassword, 10);
      await changeAgentPassword(payload.candidateId, newHash);
      return { success: true };
    }),
  // Get current agent session info (from cookie))
  me: publicProcedure.query(async ({ ctx }) => {
    const token = getAgentCookieFromReq(ctx.req);
    if (!token) return null;
    try {
      const payload = jwt.verify(token, ENV.cookieSecret) as { candidateId: number; traineeCode: string; type: string };
      if (payload.type !== "agent") return null;
      const candidate = await getCandidateById(payload.candidateId);
      if (!candidate) return null;
      // Get batch info
      const batch = await getCandidateBatch(payload.candidateId);
      let batchDetail = null;
      if (batch) {
        const batchCands = await listCandidatesInBatch(batch.id);
        const myEntry = batchCands.find((c) => (c as Record<string, unknown>).candidateId === payload.candidateId);
        batchDetail = {
          id: batch.id,
          name: batch.name,
          trainerName: batch.trainerName,
          startDate: batch.startDate,
          notes: batch.notes,
          traineeCode: myEntry?.traineeCode ?? payload.traineeCode,
          assignedAt: ((myEntry as Record<string, unknown>)?.assignedAt as Date | null) ?? null, // join date = when assigned to batch
          attendedSessions: ((myEntry as Record<string, unknown>)?.attendedSessions as number | null) ?? null,
          totalSessions: ((myEntry as Record<string, unknown>)?.totalSessions as number | null) ?? null,
          trainerNotes: ((myEntry as Record<string, unknown>)?.trainerNotes as string | null) ?? null,
        };
      }
      return {
        candidateId: payload.candidateId,
        traineeCode: payload.traineeCode,
        name: candidate.name,
        phone: candidate.phone,
        email: candidate.email,
        positionApplied: candidate.positionApplied,
        location: candidate.location,
        age: candidate.age,
        createdAt: candidate.createdAt,
        batch: batchDetail,
      };
    } catch {
      return null;
    }
  }),

  // Payroll — agent can read their own, admin can read/write any
  getPayroll: publicProcedure
    .input(z.object({ candidateId: z.number() }))
    .query(async ({ input, ctx }) => {
      // Allow if admin OR if agent session matches candidateId
      const agentToken = getAgentCookieFromReq(ctx.req);
      let isAgent = false;
      if (agentToken) {
        try {
          const p = jwt.verify(agentToken, ENV.cookieSecret) as { candidateId: number; type: string };
          isAgent = p.type === "agent" && p.candidateId === input.candidateId;
        } catch { /* invalid token */ }
      }
      if (!ctx.user && !isAgent) throw new TRPCError({ code: "UNAUTHORIZED" });
      return getPayrollByCandidateId(input.candidateId);
    }),

  upsertPayroll: protectedProcedure
    .input(z.object({
      candidateId: z.number(),
      month: z.string().regex(/^\d{4}-\d{2}$/),
      grossSalary: z.number().nullable().optional(),
      deductions: z.number().nullable().optional(),
      netPay: z.number().nullable().optional(),
      paymentDate: z.number().nullable().optional(),
      status: z.enum(["pending", "paid", "on_hold"]).optional(),
      notes: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      await upsertPayrollRecordLegacy(input);
      return { success: true };
    }),

  deletePayroll: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deletePayrollRecord(input.id);
      return { success: true };
    }),

  // Payroll Excel Upload procedures
  uploadPayroll: protectedProcedure
    .input(z.object({
      month: z.string().regex(/^\d{4}-\d{2}$/),
      rows: z.array(z.object({
        agentCode: z.string(),
        agentName: z.string().optional().default(""),
        baseSalary: z.number().nullable().optional(),
        workingHours: z.number().nullable().optional(),
        overtimeHours: z.number().nullable().optional(),
        commission: z.number().nullable().optional(),
        deductions: z.number().nullable().optional(),
        netPay: z.number().nullable().optional(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const uploadedBy = ctx.user?.name ?? ctx.user?.email ?? "Admin";
      const results = await upsertPayrollFromExcel(
        input.rows.map(r => ({
          agentCode: r.agentCode,
          agentName: r.agentName ?? "",
          month: input.month,
          uploadedBy,
          baseSalary: r.baseSalary ?? null,
          workingHours: r.workingHours ?? null,
          overtimeHours: r.overtimeHours ?? null,
          commission: r.commission ?? null,
          deductions: r.deductions ?? null,
          netPay: r.netPay ?? null,
        }))
      );
      return { success: true, count: results.length };
    }),
  getPayrollMonths: protectedProcedure
    .query(async () => {
      return getPayrollMonths();
    }),
  getPayrollByMonth: protectedProcedure
    .input(z.object({ month: z.string() }))
    .query(async ({ input }) => {
      return getPayrollByMonth(input.month);
    }),
  // Admin: delete all payroll rows for a specific month (undo a bad import)
  deletePayrollForMonth: protectedProcedure
    .input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq: eqOp } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { payrollRecords } = await import("../drizzle/schema");
      const result = await db.delete(payrollRecords).where(eqOp(payrollRecords.month, input.month));
      return { deleted: (result as { rowsAffected?: number }).rowsAffected ?? 0 };
    }),
  // Agent-facing payroll procedures
  getMyPayrollMonths: publicProcedure
    .query(async ({ ctx }) => {
      const agentToken = getAgentCookieFromReq(ctx.req);
      if (!agentToken) throw new TRPCError({ code: "UNAUTHORIZED" });
      let traineeCode: string | null = null;
      try {
        const p = jwt.verify(agentToken, ENV.cookieSecret) as { traineeCode?: string; type: string };
        if (p.type === "agent" && p.traineeCode) traineeCode = p.traineeCode;
      } catch { throw new TRPCError({ code: "UNAUTHORIZED" }); }
      if (!traineeCode) throw new TRPCError({ code: "UNAUTHORIZED" });
      return getPayrollMonthsByAgentCode(traineeCode);
    }),
  getMyPayrollRecord: publicProcedure
    .input(z.object({ month: z.string() }))
    .query(async ({ input, ctx }) => {
      const agentToken = getAgentCookieFromReq(ctx.req);
      if (!agentToken) throw new TRPCError({ code: "UNAUTHORIZED" });
      let traineeCode: string | null = null;
      try {
        const p = jwt.verify(agentToken, ENV.cookieSecret) as { traineeCode?: string; type: string };
        if (p.type === "agent" && p.traineeCode) traineeCode = p.traineeCode;
      } catch { throw new TRPCError({ code: "UNAUTHORIZED" }); }
      if (!traineeCode) throw new TRPCError({ code: "UNAUTHORIZED" });
      const records = await getPayrollByAgentCode(traineeCode);
      return records.find(r => r.month === input.month) ?? null;
    }),
  // Performance — agent can read their own, admin can read/write any
  getPerformance: publicProcedure
    .input(z.object({ candidateId: z.number() }))
    .query(async ({ input, ctx }) => {
      const agentToken = getAgentCookieFromReq(ctx.req);
      let isAgent = false;
      if (agentToken) {
        try {
          const p = jwt.verify(agentToken, ENV.cookieSecret) as { candidateId: number; type: string };
          isAgent = p.type === "agent" && p.candidateId === input.candidateId;
        } catch { /* invalid token */ }
      }
      if (!ctx.user && !isAgent) throw new TRPCError({ code: "UNAUTHORIZED" });
      return getPerformanceByCandidateId(input.candidateId);
    }),

  upsertPerformance: protectedProcedure
    .input(z.object({
      candidateId: z.number(),
      period: z.string().regex(/^\d{4}-\d{2}$/),
      callsMade: z.number().nullable().optional(),
      leadsGenerated: z.number().nullable().optional(),
      targetsHit: z.number().nullable().optional(),
      totalTargets: z.number().nullable().optional(),
      qualityScore: z.number().nullable().optional(),
      attendanceRate: z.number().nullable().optional(),
      notes: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      await upsertPerformanceRecord(input);
      return { success: true };
    }),

  deletePerformance: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deletePerformanceRecord(input.id);
      return { success: true };
    }),
});

const requestsRouter = router({
  // Agent: submit a new request
  submit: publicProcedure
    .input(z.object({
      type: z.enum(["leave", "paid_leave", "salary", "schedule", "complaint", "resignation", "day_off", "sick_note", "hr_letter", "other"]),
      subject: z.string().min(1).max(255),
      message: z.string().min(1),
      requestedDate: z.number().optional(), // UTC ms timestamp (single date)
      requestedDates: z.array(z.string()).optional(), // multiple date strings for multi-day requests
      attachmentUrl: z.string().url().optional(), // S3 URL of uploaded file
      hrLetterPurpose: z.string().optional(), // purpose for hr_letter type
      hrLetterLanguage: z.enum(["arabic", "english"]).optional(), // language for hr_letter type
    }))
    .mutation(async ({ input, ctx }) => {
      // Must be authenticated as agent
      const agentToken = getAgentCookieFromReq(ctx.req);
      if (!agentToken) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated as agent" });
      let payload: { candidateId: number; traineeCode: string; type: string };
      try {
        payload = jwt.verify(agentToken, ENV.cookieSecret) as typeof payload;
      } catch {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid agent session" });
      }
      if (payload.type !== "agent") throw new TRPCError({ code: "UNAUTHORIZED", message: "Not an agent session" });
      // Enforce 2-week minimum for date-based requests (compare calendar dates, not ms)
      const dateRequiredTypes = ["leave", "day_off", "resignation"];
      if (dateRequiredTypes.includes(input.type)) {
        const hasDates = (input.requestedDates && input.requestedDates.length > 0) || input.requestedDate;
        if (!hasDates) throw new TRPCError({ code: "BAD_REQUEST", message: "Please select a date for this request" });
        // Unpaid day off can be requested for any date (no advance notice required)
        if (input.type !== "day_off") {
          // Check the earliest selected date is at least 14 calendar days from today
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const minDate = new Date(today);
          minDate.setDate(minDate.getDate() + 14);
          const checkDate = input.requestedDates?.[0]
            ? new Date(input.requestedDates[0])
            : input.requestedDate ? new Date(input.requestedDate) : null;
          if (checkDate && checkDate < minDate) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Date must be at least 2 weeks from today" });
          }
        }
      }
      await createAgentRequest({
        candidateId: payload.candidateId,
        traineeCode: payload.traineeCode,
        type: input.type,
        subject: input.subject,
        message: input.message,
        requestedDate: input.requestedDate ?? null,
        requestedDates: input.requestedDates ? JSON.stringify(input.requestedDates) : null,
        attachmentUrl: input.attachmentUrl ?? null,
        hrLetterPurpose: input.hrLetterPurpose ?? null,
        hrLetterLanguage: input.hrLetterLanguage ?? null,
      });
      // Request goes to the request center — no email notification
      return { success: true };
    }),

  // Agent: list own requests
  listMine: publicProcedure.query(async ({ ctx }) => {
    const agentToken = getAgentCookieFromReq(ctx.req);
    if (!agentToken) return [];
    try {
      const payload = jwt.verify(agentToken, ENV.cookieSecret) as { candidateId: number; type: string };
      if (payload.type !== "agent") return [];
      return listAgentRequestsByCandidate(payload.candidateId);
    } catch {
      return [];
    }
  }),

  // Admin: list all requests
  listAll: protectedProcedure.query(() => listAllAgentRequests()),

  // Admin: update status and/or reply
  updateStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["pending", "in_progress", "resolved", "rejected"]),
      adminReply: z.string().optional(),
    }))
    .mutation(({ input }) => updateAgentRequestStatus(input.id, input.status, input.adminReply ?? null)),

  // Admin: count unread requests (for red dot badge)
  countUnread: protectedProcedure.query(() => countUnreadAgentRequests()),

  // Admin: mark all requests as read (called when admin opens the Requests page)
  markAllRead: protectedProcedure.mutation(() => markAllAgentRequestsRead()),

  // Agent: upload an attachment file (returns S3 URL)
  uploadAttachment: publicProcedure
    .input(z.object({
      fileBase64: z.string(), // base64-encoded file content
      fileName: z.string().max(255),
      mimeType: z.string().max(100),
    }))
    .mutation(async ({ input, ctx }) => {
      // Must be authenticated as agent
      const agentToken = getAgentCookieFromReq(ctx.req);
      if (!agentToken) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated as agent" });
      try {
        jwt.verify(agentToken, ENV.cookieSecret);
      } catch {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid agent session" });
      }
      const { storagePut } = await import("./storage");
      const buffer = Buffer.from(input.fileBase64, "base64");
      if (buffer.length > 16 * 1024 * 1024) throw new TRPCError({ code: "BAD_REQUEST", message: "File too large (max 16MB)" });
      const ext = input.fileName.split(".").pop() ?? "bin";
      const key = `agent-attachments/${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      return { url };
    }),
});

// ─── Admin Auth Router ────────────────────────────────────────────────────────
const adminAuthRouter = router({
  // Invite a new admin (owner only)
  invite: protectedProcedure
    .input(z.object({ email: z.string().email(), name: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const existing = await getAdminByEmail(input.email);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "An admin with this email already exists" });
      const token = crypto.randomBytes(48).toString("hex");
      const expiresAt = Date.now() + 48 * 60 * 60 * 1000;
      await createAdminInvite({
        email: input.email, name: input.name, token, expiresAt,
        invitedBy: ctx.user?.name ?? ctx.user?.email ?? "owner",
      });
      // Return the invite link (frontend will display it)
      const inviteUrl = `${input.email}|||${token}`; // frontend constructs URL
      return { token, expiresAt, inviteUrl: token };
    }),

  // Regenerate an existing invite — resets token + expiry + clears usedAt
  regenerateInvite: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { regenerateAdminInviteById } = await import("./db");
      const result = await regenerateAdminInviteById(input.id);
      return { token: result.token, expiresAt: result.expiresAt };
    }),

  // Validate invite token (public)
  validateInvite: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const invite = await getAdminInviteByToken(input.token);
      if (!invite) throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found" });
      if (invite.usedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Invite already used" });
      if (Date.now() > invite.expiresAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Invite has expired" });
      return { email: invite.email, name: invite.name };
    }),

  // Accept invite and set password (public)
  acceptInvite: publicProcedure
    .input(z.object({ token: z.string(), password: z.string().min(8) }))
    .mutation(async ({ input }) => {
      const invite = await getAdminInviteByToken(input.token);
      if (!invite || invite.usedAt || Date.now() > invite.expiresAt)
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired invite" });
      const existing = await getAdminByEmail(invite.email);
      if (existing) {
        // Account already exists — mark invite as used and tell frontend to redirect to login
        await markAdminInviteUsed(input.token);
        return { success: true, email: invite.email, accountAlreadyExists: true };
      }
      const passwordHash = await bcrypt.hash(input.password, 12);
      await createAdminAccount({ email: invite.email, name: invite.name, passwordHash, invitedBy: invite.invitedBy });
      await markAdminInviteUsed(input.token);
      return { success: true, email: invite.email };
    }),

  // Admin email/password login (public)
  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const ip = ctx.req.ip ?? ctx.req.headers["x-forwarded-for"]?.toString() ?? "unknown";
      // Rate limit check
      const attempts = await countRecentFailedLogins(input.email, "admin");
      if (attempts >= ADMIN_LOCKOUT_MAX)
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many failed attempts. Please wait 15 minutes." });
      const admin = await getAdminByEmail(input.email);
      if (!admin || !admin.isActive) {
        await recordFailedLogin(input.email, "admin", ip);
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
      }
      const valid = await bcrypt.compare(input.password, admin.passwordHash);
      if (!valid) {
        await recordFailedLogin(input.email, "admin", ip);
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
      }
      await clearLoginAttempts(input.email, "admin");
      const token = jwt.sign(
        { adminId: admin.id, email: admin.email, name: admin.name, type: "admin_account" },
        ENV.cookieSecret,
        { expiresIn: "7d" }
      );
      ctx.res.cookie(ADMIN_COOKIE, token, {
        httpOnly: true, secure: process.env.NODE_ENV === "production",
        sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000, path: "/",
      });
      return { success: true, name: admin.name, email: admin.email };
    }),

  // Admin logout
  logout: publicProcedure.mutation(async ({ ctx }) => {
    ctx.res.clearCookie(ADMIN_COOKIE, { path: "/" });
    return { success: true };
  }),

  // List all admins (owner only)
  list: protectedProcedure.query(() => listAdminAccounts()),

  // Deactivate / reactivate admin (owner only)
  setActive: protectedProcedure
    .input(z.object({ id: z.number(), isActive: z.boolean() }))
    .mutation(({ input }) => setAdminActive(input.id, input.isActive)),
});

// ─── Referrals Router ─────────────────────────────────────────────────────────
const referralsRouter = router({
  // Agent submits a referral
  submit: publicProcedure
    .input(z.object({
      referrerCandidateId: z.number(),
      refereeName: z.string().min(1),
      refereePhone: z.string().min(5),
      refereeNote: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // Auto-create candidate with source="referral"
      const insertResult = await createCandidate({
        name: input.refereeName,
        phone: input.refereePhone,
        source: "referral",
        notes: `Referred by agent (candidateId: ${input.referrerCandidateId}). Note: ${input.refereeNote ?? ""}`,
      });
      // insertResult is MySqlRawQueryResult — extract insertId
      const createdCandidateId = (insertResult as { insertId?: number })?.insertId ?? null;
      await createReferral({
        referrerCandidateId: input.referrerCandidateId,
        refereeName: input.refereeName,
        refereePhone: input.refereePhone,
        refereeNote: input.refereeNote ?? null,
        createdCandidateId,
      });
      return { success: true };
    }),

  // Agent views own referrals
  listMine: publicProcedure
    .input(z.object({ candidateId: z.number() }))
    .query(({ input }) => getReferralsByReferrer(input.candidateId)),

  // Admin views all referrals
  listAll: protectedProcedure.query(() => listAllReferrals()),

  // Admin updates referral status
  updateStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["pending", "contacted", "hired", "rejected"]),
      referrerCandidateId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      await updateReferralStatus(input.id, input.status);
      // Notify the referring agent
      if (input.referrerCandidateId) {
        const statusLabel = { pending: "Pending", contacted: "Contacted", hired: "Hired! 🎉", rejected: "Not selected" }[input.status];
        await createAgentNotification({
          candidateId: input.referrerCandidateId,
          message: `Your referral status has been updated: ${statusLabel}`,
          type: "referral_update",
          relatedId: input.id,
        });
      }
      return { success: true };
    }),
});

// ─── Notifications Router ─────────────────────────────────────────────────────
const notificationsRouter = router({
  listMine: publicProcedure
    .input(z.object({ candidateId: z.number() }))
    .query(({ input }) => getNotificationsByCandidate(input.candidateId)),

  countUnread: publicProcedure
    .input(z.object({ candidateId: z.number() }))
    .query(({ input }) => countUnreadNotifications(input.candidateId)),

  markRead: publicProcedure
    .input(z.object({ candidateId: z.number() }))
    .mutation(({ input }) => markNotificationsRead(input.candidateId)),
});

// ─── Campaigns Router ────────────────────────────────────────────────────────
const campaignsRouter = router({
  list: publicProcedure.query(() => listCampaigns()),

  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getCampaignById(input.id)),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      minHeadcount: z.number().int().min(1),
      workDays: z.enum(["all", "weekdays"]),
      notes: z.string().optional(),
    }))
    .mutation(({ input }) => createCampaign(input)),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      minHeadcount: z.number().int().min(1).optional(),
      workDays: z.enum(["all", "weekdays"]).optional(),
      notes: z.string().optional(),
    }))
    .mutation(({ input }) => { const { id, ...rest } = input; return updateCampaign(id, rest); }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteCampaign(input.id)),

  headcountForecast: protectedProcedure
    .input(z.object({ campaignId: z.number(), days: z.number().int().min(1).max(90).optional() }))
    .query(({ input }) => getHeadcountForecast(input.campaignId, input.days ?? 30)),

  sendOvertimeAlert: protectedProcedure
    .input(z.object({ campaignId: z.number(), date: z.string(), message: z.string().optional() }))
    .mutation(async ({ input }) => {
      // Get all active agents in this campaign
      const agents = await listWorkforceAgents(input.campaignId);
      const campaign = await getCampaignById(input.campaignId);
      // For each agent, find their candidateId and send a notification
      for (const agent of agents) {
        await createAgentNotification({
          candidateId: agent.candidateId,
          message: input.message ?? `Overtime needed on ${input.date}. Are you available? Please respond in the portal.`,
          type: "general",
          relatedId: null,
        });
      }
      // Also notify the owner
      await notifyOwner({
        title: `⚠️ Headcount Alert — ${campaign?.name ?? `Campaign #${input.campaignId}`}`,
        content: `Overtime alert sent to ${agents.length} agent(s) for ${input.date}. ${input.message ?? `We are short on headcount for this date.`}`,
      });
      return { sent: agents.length };
    }),

  getOvertimeResponses: protectedProcedure
    .input(z.object({ campaignId: z.number(), date: z.string() }))
    .query(({ input }) => getOvertimeAvailabilityForDate(input.campaignId, input.date)),
  // Dynamic operation plan: 7-day grid (Mon-Sun) showing each agent's work/off status
  getOperationPlanMonth: publicProcedure
    .input(z.object({ campaignId: z.number(), year: z.number().int(), month: z.number().int().min(1).max(12) }))
    .query(async ({ input }) => {
      const allAgentsMonth = await listWorkforceAgents(input.campaignId);
      const agents = allAgentsMonth.filter((a: { agentStatus?: string | null; isActive?: boolean | null }) => {
        const st = a.agentStatus;
        return st !== "resigned" && st !== "terminated" && st !== "blacklisted" && st !== "frozen" && st !== "inactive" && a.isActive !== false;
      });
      const campaign = await getCampaignById(input.campaignId);
      const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      // Build all days in the month
      const daysInMonth = new Date(input.year, input.month, 0).getDate();
      const days = Array.from({ length: daysInMonth }, (_, i) => {
        const d = new Date(input.year, input.month - 1, i + 1);
        return { date: d.toISOString().split("T")[0], dayOfWeek: d.getDay(), label: DAY_NAMES[d.getDay()], dayNum: i + 1 };
      });
      // For each agent, determine work/off status per day
      const grid = agents.map(agent => ({
        traineeCode: agent.traineeCode,
        fullName: agent.fullName,
        alias: agent.alias,
        teamLeader: agent.teamLeader,
        days: days.map(day => {
          const isOff = agent.offDay1 === day.dayOfWeek || agent.offDay2 === day.dayOfWeek;
          const isCampaignOff = campaign?.workDays === "weekdays" && (day.dayOfWeek === 0 || day.dayOfWeek === 6);
          return { date: day.date, label: day.label, dayNum: day.dayNum, status: (isOff || isCampaignOff) ? "off" : "work" as "off" | "work" };
        }),
      }));
      return { campaign, year: input.year, month: input.month, days, grid };
    }),
  getOperationPlan: publicProcedure
    .input(z.object({ campaignId: z.number(), weekOffset: z.number().int().optional() }))
    .query(async ({ input }) => {
      const allAgents = await listWorkforceAgents(input.campaignId);
      // The Operation Plan is a live shift schedule — anyone who has LEFT the floor
      // (resigned / terminated / blacklisted / frozen) does not belong here, even if
      // their final pay is still being settled. Settlement is tracked in the exit flow.
      const agents = allAgents.filter((a: { agentStatus?: string | null; isActive?: boolean | null }) => {
        const st = a.agentStatus;
        return st !== "resigned" && st !== "terminated" && st !== "blacklisted" && st !== "frozen" && st !== "inactive" && a.isActive !== false;
      });
      const campaign = await getCampaignById(input.campaignId);
      // Build the Mon-Sun week starting from weekOffset weeks from current Monday
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
      const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + daysToMonday + (input.weekOffset ?? 0) * 7);
      monday.setHours(0, 0, 0, 0);
      const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const FULL_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      // Build 7-day array Mon(1) through Sun(0)
      const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return { date: d, dayOfWeek: d.getDay(), label: DAY_NAMES[d.getDay()], fullLabel: FULL_DAY_NAMES[d.getDay()] };
      });
      // For each agent, determine work/off status per day
      const grid = agents.map(agent => ({
        traineeCode: agent.traineeCode,
        fullName: agent.fullName,
        alias: agent.alias,
        teamLeader: agent.teamLeader,
        shiftHours: agent.shiftHours,
        days: weekDays.map(day => {
          const isOff = agent.offDay1 === day.dayOfWeek || agent.offDay2 === day.dayOfWeek;
          // Also check campaign workDays — if weekdays only, Sat(6) and Sun(0) are off
          const isCampaignOff = campaign?.workDays === "weekdays" && (day.dayOfWeek === 0 || day.dayOfWeek === 6);
          return { date: day.date.toISOString().split("T")[0], label: day.label, fullLabel: day.fullLabel, status: (isOff || isCampaignOff) ? "off" : "work" as "off" | "work" };
        }),
      }));
      return {
        campaign,
        weekStart: monday.toISOString().split("T")[0],
        weekDays: weekDays.map(d => ({ date: d.date.toISOString().split("T")[0], label: d.label, fullLabel: d.fullLabel })),
        grid,
      };
    }),
});

// ─── Workforce Router ─────────────────────────────────────────────────────────
const workforceRouter = router({
  // Manual "Mark as settled" — flips salarySettled; used when final pay is confirmed (exit checklist gates the full archive)
  // Unified HR profile: update address + emergency contact
  updateHrInfo: protectedProcedure
    .input(z.object({ traineeCode: z.string(), address: z.string().optional(), emergencyContactName: z.string().optional(), emergencyContactPhone: z.string().optional(), emergencyContactRelation: z.string().optional() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { workforceAgents } = await import("../drizzle/schema");
      const { traineeCode, ...rest } = input;
      await db.update(workforceAgents).set(rest).where(eq(workforceAgents.traineeCode, traineeCode));
      return { ok: true };
    }),
  markSettled: protectedProcedure
    .input(z.object({ traineeCode: z.string(), settled: z.boolean() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { workforceAgents } = await import("../drizzle/schema");
      await db.update(workforceAgents).set({ salarySettled: input.settled, settledAt: input.settled ? Date.now() : null }).where(eq(workforceAgents.traineeCode, input.traineeCode));
      return { ok: true };
    }),
  list: protectedProcedure
    .input(z.object({ campaignId: z.number().optional(), teamLeader: z.string().optional(), includeFormer: z.boolean().optional() }))
    .query(({ input }) => listWorkforceAgents(input.campaignId, input.teamLeader, input.includeFormer)),
  allInTraining: protectedProcedure
    .query(() => listAllAgentsInTraining()),
  // Returns the next available T-{N} code (lowest unused sequential number)
  nextTraineeCode: protectedProcedure
    .query(() => getNextAvailableTraineeCode()),

  create: protectedProcedure
    .input(z.object({
      traineeCode: z.string().min(1),
      candidateId: z.number(),
      fullName: z.string().min(1),
      alias: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      campaignId: z.number().optional(),
      shiftHours: z.string().optional(),
      teamLeader: z.string().optional(),
      offDay1: z.number().int().min(0).max(6).optional(),
      offDay2: z.number().int().min(0).max(6).optional(),
      joinDate: z.number().optional(),
      dialerCredentials: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // ── Trainee Code Reuse Guard ──────────────────────────────────────────
      // Block reuse of any traineeCode that was ever assigned — regardless of
      // current status (active, resigned, terminated, inactive).
      const { getDb } = await import("./db");
      const { eq: eqGuard } = await import("drizzle-orm");
      const dbGuard = await getDb();
      if (dbGuard) {
        const { workforceAgents: waTable } = await import("../drizzle/schema");
        const existing = await dbGuard.select({
          fullName: waTable.fullName,
          agentStatus: waTable.agentStatus,
          isActive: waTable.isActive,
        }).from(waTable).where(eqGuard(waTable.traineeCode, input.traineeCode)).limit(1);
        if (existing.length > 0) {
          const ex = existing[0];
          const statusLabel = ex.agentStatus === "resigned" ? "resigned" : ex.agentStatus === "terminated" ? "terminated" : ex.isActive ? "active" : "inactive";
          throw new TRPCError({
            code: "CONFLICT",
            message: `"${input.traineeCode}" is already assigned to ${ex.fullName} (${statusLabel}). This ID cannot be reused — agent IDs are permanently retired.`,
          });
        }
        // Also check agentCredentials to catch soft-deleted agents
        const { agentCredentials: acTable } = await import("../drizzle/schema");
        const existingCred = await dbGuard.select({ traineeCode: acTable.traineeCode })
          .from(acTable).where(eqGuard(acTable.traineeCode, input.traineeCode)).limit(1);
        if (existingCred.length > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `"${input.traineeCode}" has existing credentials in the system and cannot be reassigned. Agent IDs are permanently retired.`,
          });
        }
      }
      // ─────────────────────────────────────────────────────────────────────
      await createWorkforceAgent(input);
      // Send campaign assignment notification if a campaign was specified
      if (input.campaignId) {
        try {
          const campaign = await getCampaignById(input.campaignId);
          const campaignName = campaign?.name ?? `Campaign #${input.campaignId}`;
          await createAgentNotification({
            candidateId: input.candidateId,
            type: "campaign_assigned",
            message: `You have been assigned to the "${campaignName}" campaign. Welcome to the operations team!`,
            relatedId: input.campaignId,
          });
        } catch (e) {
          console.error("[Notification] Failed to send campaign assignment notification:", e);
        }
      }
    }),
  update: protectedProcedure
    .input(z.object({
      traineeCode: z.string(),
      fullName: z.string().optional(),
      alias: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      campaignId: z.number().optional(),
      shiftHours: z.string().optional(),
      teamLeader: z.string().optional(),
      offDay1: z.number().int().min(0).max(6).optional(),
      offDay2: z.number().int().min(0).max(6).optional(),
      joinDate: z.number().optional(),
      isActive: z.boolean().optional(),
      dialerCredentials: z.string().optional(),
      crdts: z.string().optional(),
      nestingStatus: z.enum(["nesting", "active", "senior"]).optional(),
      workLocation: z.enum(["office", "wfh"]).optional(),
      nationalId: z.string().max(50).optional(),
      nationalIdExpiry: z.string().max(20).optional(),
      dateOfBirth: z.string().max(20).optional(),
      gender: z.enum(["male", "female"]).optional(),
      nationality: z.string().max(100).optional(),
      maritalStatus: z.enum(["single", "married", "divorced", "widowed"]).optional(),
      militaryStatus: z.enum(["completed", "exempt", "postponed", "not_applicable"]).optional(),
      jobTitle: z.string().max(150).optional(),
      city: z.string().max(120).optional(),
      address: z.string().max(500).optional(),
      emergencyContactName: z.string().max(255).optional(),
      emergencyContactPhone: z.string().max(64).optional(),
      emergencyContactRelation: z.string().max(100).optional(),
      profileLocked: z.boolean().optional(),
      agentStatus: z.enum(["active", "inactive", "frozen", "resigned", "terminated", "blacklisted"]).optional(),
    }))
     .mutation(async ({ input }) => {
      const { traineeCode, ...rest } = input;
      // If campaignId is being set, fetch the old agent to check if it changed
      if (input.campaignId !== undefined) {
        try {
          const existing = await getWorkforceAgentByCode(traineeCode);
          if (existing && existing.campaignId !== input.campaignId) {
            const campaign = await getCampaignById(input.campaignId);
            const campaignName = campaign?.name ?? `Campaign #${input.campaignId}`;
            await createAgentNotification({
              candidateId: existing.candidateId,
              type: "campaign_assigned",
              message: `You have been reassigned to the "${campaignName}" campaign.`,
              relatedId: input.campaignId,
            });
          }
        } catch (e) {
          console.error("[Notification] Failed to send campaign reassignment notification:", e);
        }
      }
      return updateWorkforceAgent(traineeCode, rest);
    }),
  getMyProfile: publicProcedure.query(({ ctx }) => {
    const token = getAgentCookieFromReq(ctx.req);
    if (!token) return null;
    try {
      const { traineeCode } = jwt.verify(token, ENV.cookieSecret) as { traineeCode: string };
      return getWorkforceAgentByCode(traineeCode);
    } catch { return null; }
  }),
  // Agent: upload my profile picture (stores the file + saves the URL on my record)
  setMyAvatar: publicProcedure
    .input(z.object({ fileBase64: z.string(), fileName: z.string().max(255), mimeType: z.string().max(100) }))
    .mutation(async ({ input, ctx }) => {
      const token = getAgentCookieFromReq(ctx.req);
      if (!token) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated as agent" });
      let traineeCode: string;
      try { ({ traineeCode } = jwt.verify(token, ENV.cookieSecret) as { traineeCode: string }); }
      catch { throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid agent session" }); }
      const buffer = Buffer.from(input.fileBase64, "base64");
      if (buffer.length > 5 * 1024 * 1024) throw new TRPCError({ code: "BAD_REQUEST", message: "Image too large (max 5MB)" });
      const ext = (input.fileName.split(".").pop() ?? "jpg").toLowerCase();
      const key = `agent-avatars/${traineeCode}-${Date.now()}.${ext}`;
      const { storagePut } = await import("./storage");
      const { url } = await storagePut(key, buffer, input.mimeType);
      await updateWorkforceAgent(traineeCode, { avatarUrl: url });
      return { url };
    }),
  // Agent: fill my personal profile ONCE. After submitting it locks; further edits go through HR.
  updateMyProfile: publicProcedure
    .input(z.object({
      nationalId: z.string().max(50).optional(),
      nationalIdExpiry: z.string().max(20).optional(),
      dateOfBirth: z.string().max(20).optional(),
      gender: z.enum(["male", "female"]).optional(),
      nationality: z.string().max(100).optional(),
      maritalStatus: z.enum(["single", "married", "divorced", "widowed"]).optional(),
      militaryStatus: z.enum(["completed", "exempt", "postponed", "not_applicable"]).optional(),
      city: z.string().max(120).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const token = getAgentCookieFromReq(ctx.req);
      if (!token) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated as agent" });
      let traineeCode: string;
      try { ({ traineeCode } = jwt.verify(token, ENV.cookieSecret) as { traineeCode: string }); }
      catch { throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid agent session" }); }
      const me = await getWorkforceAgentByCode(traineeCode);
      if (!me) throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" });
      if (me.profileLocked) throw new TRPCError({ code: "FORBIDDEN", message: "Your profile is already submitted. Please request an update from HR." });
      await updateWorkforceAgent(traineeCode, { ...input, profileLocked: true });
      return { success: true };
    }),

  getCampaignAgents: publicProcedure
    .input(z.object({ campaignId: z.number() }))
    .query(({ input }) => listWorkforceAgents(input.campaignId)),
  getEligibleCandidates: protectedProcedure.query(() => getEligibleCandidatesForOps()),
  getAgentFullProfile: protectedProcedure
    .input(z.object({ traineeCode: z.string() }))
    .query(async ({ input }) => {
      const agent = await getWorkforceAgentByCode(input.traineeCode);
      if (!agent) return null;
      const [documents, paymentMethods, comments] = await Promise.all([
        getDocumentsByCode(input.traineeCode),
        getPaymentMethodsByCode(input.traineeCode),
        getCommentsByCode(input.traineeCode),
      ]);
      const [candidate, payroll] = await Promise.all([
        agent.candidateId ? getCandidateById(agent.candidateId) : Promise.resolve(undefined),
        agent.candidateId ? getPayrollByCandidateId(agent.candidateId) : Promise.resolve([]),
      ]);
      return { agent, documents, paymentMethods, comments, candidate: candidate ?? null, payroll: payroll ?? [] };
    }),

  getMyOperationPlan: publicProcedure
    .input(z.object({ weekOffset: z.number().int().optional() }))
    .query(async ({ ctx, input }) => {
      const _opTok = getAgentCookieFromReq(ctx.req);
      if (!_opTok) return null;
      let _opCode: string;
      try { _opCode = (jwt.verify(_opTok, ENV.cookieSecret) as { traineeCode: string }).traineeCode; } catch { return null; }
      const agent = await getWorkforceAgentByCode(_opCode);
      if (!agent || !agent.campaignId) return null;
      const campaign = await getCampaignById(agent.campaignId as number);
      const now = new Date();
      const dayOfWeek = now.getDay();
      const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + daysToMonday + (input.weekOffset ?? 0) * 7);
      monday.setHours(0, 0, 0, 0);
      const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const FULL_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return { date: d, dayOfWeek: d.getDay(), label: DAY_NAMES[d.getDay()], fullLabel: FULL_DAY_NAMES[d.getDay()] };
      });
      const days = weekDays.map(day => {
        const isOff = agent.offDay1 === day.dayOfWeek || agent.offDay2 === day.dayOfWeek;
        const isCampaignOff = campaign?.workDays === "weekdays" && (day.dayOfWeek === 0 || day.dayOfWeek === 6);
        return { date: day.date.toISOString().split("T")[0], label: day.label, fullLabel: day.fullLabel, status: (isOff || isCampaignOff) ? "off" : "work" as "off" | "work" };
      });
      return {
        weekStart: monday.toISOString().split("T")[0],
        weekDays: weekDays.map(d => ({ date: d.date.toISOString().split("T")[0], label: d.label, fullLabel: d.fullLabel })),
        days,
        shiftHours: agent.shiftHours,
      };
    }),
  getFullCampaignPlan: publicProcedure
    .input(z.object({ weekOffset: z.number().int().optional() }))
    .query(async ({ ctx, input }) => {
      const _tok = getAgentCookieFromReq(ctx.req);
      if (!_tok) return null;
      let _code: string;
      try { _code = (jwt.verify(_tok, ENV.cookieSecret) as { traineeCode: string }).traineeCode; } catch { return null; }
      const me = await getWorkforceAgentByCode(_code);
      if (!me || !me.campaignId) return null;
      const campaignId = me.campaignId as number;
      const agents = await listWorkforceAgents(campaignId);
      const campaign = await getCampaignById(campaignId);
      const now = new Date();
      const dayOfWeek = now.getDay();
      const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + daysToMonday + (input.weekOffset ?? 0) * 7);
      monday.setHours(0, 0, 0, 0);
      const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return { date: d.toISOString().split("T")[0], dayOfWeek: d.getDay(), label: DAY_NAMES[d.getDay()] };
      });
      const grid = agents.map(agent => ({
        traineeCode: agent.traineeCode,
        fullName: agent.fullName,
        alias: agent.alias,
        teamLeader: agent.teamLeader,
        isMe: agent.traineeCode === _code,
        days: weekDays.map(day => {
          const isOff = agent.offDay1 === day.dayOfWeek || agent.offDay2 === day.dayOfWeek;
          const isCampaignOff = campaign?.workDays === "weekdays" && (day.dayOfWeek === 0 || day.dayOfWeek === 6);
          return { date: day.date, label: day.label, status: (isOff || isCampaignOff) ? "off" : "work" as "off" | "work" };
        }),
      }));
      return {
        campaignName: campaign?.name ?? "",
        weekStart: monday.toISOString().split("T")[0],
        weekDays: weekDays.map(d => ({ date: d.date, label: d.label })),
        grid,
        myCode: _code,
      };
    }),
  bulkGenerateCredentials: protectedProcedure
    .input(z.object({ campaignId: z.number().optional() }))
    .mutation(async ({ input }) => {
      const agents = await listWorkforceAgents(input.campaignId);
      const DEFAULT_PASSWORD = "Tanis2025";
      const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
      const results: Array<{ fullName: string; traineeCode: string; password: string }> = [];
      for (const agent of agents) {
        if (!agent.traineeCode || !agent.candidateId) continue;
        await upsertAgentCredential(agent.candidateId, agent.traineeCode, passwordHash, true);
        results.push({ fullName: agent.fullName, traineeCode: agent.traineeCode, password: DEFAULT_PASSWORD });
      }
      return { generated: results.length, credentials: results };
    }),
  // Admin: force-delete an agent and their candidate record (for test/cleanup)
  forceDelete: protectedProcedure
    .input(z.object({ traineeCode: z.string() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { workforceAgents } = await import("../drizzle/schema");
      const agent = await db.select({ candidateId: workforceAgents.candidateId })
        .from(workforceAgents).where(eq(workforceAgents.traineeCode, input.traineeCode)).limit(1);
      if (!agent[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" });
      await deleteCandidate(agent[0].candidateId);
      return { success: true };
    }),

  // Generate a unique 6-digit trainee code not already in use
  generateUniqueId: protectedProcedure
    .mutation(async () => {
      const { generateUniqueTraineeCode } = await import("./db");
      const code = await generateUniqueTraineeCode();
      return { code };
    }),
});
// ─── Agent Comments Router ────────────────────────────────────────────────────
const agentCommentsRouter = router({
  listByCode: protectedProcedure
    .input(z.object({ traineeCode: z.string() }))
    .query(({ input }) => getCommentsByCode(input.traineeCode)),
  listMine: publicProcedure.query(({ ctx }) => {
    const _cmtTok = getAgentCookieFromReq(ctx.req);
    if (!_cmtTok) return [];
    try {
      const { traineeCode: _cmtCode } = jwt.verify(_cmtTok, ENV.cookieSecret) as { traineeCode: string };
      return getCommentsByCode(_cmtCode);
    } catch { return []; }
  }),
  add: protectedProcedure
    .input(z.object({
      traineeCode: z.string(),
      content: z.string().min(1),
      tag: z.enum(["note", "warning", "resolved"]).default("note"),
    }))
    .mutation(({ input, ctx }) => addAgentComment({
      traineeCode: input.traineeCode,
      adminName: ctx.user.name ?? ctx.user.email ?? "Admin",
      content: input.content,
      tag: input.tag,
    })),
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteAgentComment(input.id)),
});

// ─── Payment Methods Router ───────────────────────────────────────────────────
const paymentMethodsRouter = router({
  listMine: publicProcedure.query(({ ctx }) => {
    const _pmTok = getAgentCookieFromReq(ctx.req);
    if (!_pmTok) return [];
    try {
      const { traineeCode: _pmCode } = jwt.verify(_pmTok, ENV.cookieSecret) as { traineeCode: string };
      return getPaymentMethodsByCode(_pmCode);
    } catch { return []; }
  }),

  listAll: protectedProcedure.query(() => listAllPaymentMethods()),
  listGrouped: protectedProcedure.query(() => listPaymentMethodsGrouped()),

  upsert: publicProcedure
    .input(z.object({
      id: z.number().optional(),
      type: z.enum(["wallet", "bank"]),
      walletProvider: z.enum(["vodafone_cash", "orange_cash"]).optional(),
      walletPhone: z.string().optional(),
      walletName: z.string().optional(),
      bankName: z.string().optional(),
      bankAccountOrPhone: z.string().optional(),
      bankFullName: z.string().optional(),
      isPreferred: z.boolean().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const _pmUTok = getAgentCookieFromReq(ctx.req);
      if (!_pmUTok) throw new TRPCError({ code: "UNAUTHORIZED" });
      let _pmUCode: string;
      try { _pmUCode = (jwt.verify(_pmUTok, ENV.cookieSecret) as { traineeCode: string }).traineeCode; } catch { throw new TRPCError({ code: "UNAUTHORIZED" }); }
      return upsertPaymentMethod({ ...input, traineeCode: _pmUCode });
    }),

  setPreferred: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => {
      const _pmPTok = getAgentCookieFromReq(ctx.req);
      if (!_pmPTok) throw new TRPCError({ code: "UNAUTHORIZED" });
      let _pmPCode: string;
      try { _pmPCode = (jwt.verify(_pmPTok, ENV.cookieSecret) as { traineeCode: string }).traineeCode; } catch { throw new TRPCError({ code: "UNAUTHORIZED" }); }
      return setPaymentMethodPreferred(input.id, _pmPCode);
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => {
      const _pmDTok = getAgentCookieFromReq(ctx.req);
      if (!_pmDTok) throw new TRPCError({ code: "UNAUTHORIZED" });
      try { jwt.verify(_pmDTok, ENV.cookieSecret); } catch { throw new TRPCError({ code: "UNAUTHORIZED" }); }
      return deletePaymentMethod(input.id);
    }),

  addComment: protectedProcedure
    .input(z.object({ id: z.number(), comment: z.string() }))
    .mutation(({ input }) => addPaymentMethodComment(input.id, input.comment)),
  adminUpsert: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      traineeCode: z.string(),
      type: z.enum(["wallet", "bank"]),
      walletProvider: z.enum(["vodafone_cash", "orange_cash"]).optional(),
      walletPhone: z.string().optional(),
      walletName: z.string().optional(),
      bankName: z.string().optional(),
      bankAccountOrPhone: z.string().optional(),
      bankFullName: z.string().optional(),
      isPreferred: z.boolean().optional(),
    }))
    .mutation(({ input }) => upsertPaymentMethod(input)),
  adminDelete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deletePaymentMethod(input.id)),
  adminSetPreferred: protectedProcedure
    .input(z.object({ id: z.number(), traineeCode: z.string() }))
    .mutation(({ input }) => setPaymentMethodPreferred(input.id, input.traineeCode)),
});

// ─── Documents Router ─────────────────────────────────────────────────────────
const documentsRouter = router({
  listMine: publicProcedure.query(({ ctx }) => {
    const _docTok = getAgentCookieFromReq(ctx.req);
    if (!_docTok) return [];
    try {
      const { traineeCode: _docCode } = jwt.verify(_docTok, ENV.cookieSecret) as { traineeCode: string };
      return getDocumentsByCode(_docCode);
    } catch { return []; }
  }),

  listAll: protectedProcedure.query(() => listAllDocuments()),

  listByAgent: protectedProcedure
    .input(z.object({ traineeCode: z.string() }))
    .query(({ input }) => getDocumentsByCode(input.traineeCode)),

  upload: publicProcedure
    .input(z.object({
      id: z.number().optional(),
      docType: z.string().min(1),
      fileUrl: z.string().url(),
      fileName: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const _docUTok = getAgentCookieFromReq(ctx.req);
      if (!_docUTok) throw new TRPCError({ code: "UNAUTHORIZED" });
      let _docUCode: string;
      try { _docUCode = (jwt.verify(_docUTok, ENV.cookieSecret) as { traineeCode: string }).traineeCode; } catch { throw new TRPCError({ code: "UNAUTHORIZED" }); }
      return upsertAgentDocument({ ...input, traineeCode: _docUCode });
    }),

  uploadFile: publicProcedure
    .input(z.object({
      id: z.number().optional(),
      docType: z.string().min(1),
      fileBase64: z.string(),
      fileName: z.string(),
      mimeType: z.string().default("application/octet-stream"),
    }))
    .mutation(async ({ ctx, input }) => {
      const _docFTok = getAgentCookieFromReq(ctx.req);
      if (!_docFTok) throw new TRPCError({ code: "UNAUTHORIZED" });
      let _docFCode: string;
      try { _docFCode = (jwt.verify(_docFTok, ENV.cookieSecret) as { traineeCode: string }).traineeCode; } catch { throw new TRPCError({ code: "UNAUTHORIZED" }); }
      const { storagePut } = await import("./storage");
      const buf = Buffer.from(input.fileBase64, "base64");
      const ext = input.fileName.split(".").pop() ?? "bin";
      const key = `agent-docs/${_docFCode}/${input.docType}-${Date.now()}.${ext}`;
      const { url } = await storagePut(key, buf, input.mimeType);
      await upsertAgentDocument({ id: input.id, traineeCode: _docFCode, docType: input.docType, fileUrl: url, fileName: input.fileName });
      return { url };
    }),

  review: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["approved", "rejected"]),
      adminComment: z.string().optional(),
    }))
    .mutation(({ input }) => reviewAgentDocument(input.id, input.status, input.adminComment)),
});

// ─── Schedule Change Router ───────────────────────────────────────────────────
const scheduleChangeRouter = router({
  request: publicProcedure
    .input(z.object({
      targetCode: z.string().min(1),
      requesterNewOff1: z.number().int().min(0).max(6).optional(),
      requesterNewOff2: z.number().int().min(0).max(6).optional(),
      targetNewOff1: z.number().int().min(0).max(6).optional(),
      targetNewOff2: z.number().int().min(0).max(6).optional(),
      message: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const _scTok = getAgentCookieFromReq(ctx.req);
      if (!_scTok) throw new TRPCError({ code: "UNAUTHORIZED" });
      let _scCode: string;
      try { _scCode = (jwt.verify(_scTok, ENV.cookieSecret) as { traineeCode: string }).traineeCode; } catch { throw new TRPCError({ code: "UNAUTHORIZED" }); }
      await createScheduleChangeRequest({ ...input, requesterCode: _scCode });
      // Notify target agent
      const target = await getWorkforceAgentByCode(input.targetCode);
      if (target) {
        await createAgentNotification({
          candidateId: target.candidateId,
          message: `${_scCode} has requested a schedule swap with you. Please review in the portal.`,
          type: "general",
          relatedId: null,
        });
      }
      return { success: true };
    }),

  listMine: publicProcedure.query(({ ctx }) => {
    const _scLTok = getAgentCookieFromReq(ctx.req);
    if (!_scLTok) return [];
    try {
      const { traineeCode: _scLCode } = jwt.verify(_scLTok, ENV.cookieSecret) as { traineeCode: string };
      return listScheduleChangeRequestsByCode(_scLCode);
    } catch { return []; }
  }),

  // Active colleagues an agent can pick to swap with (excludes self + resigned).
  listColleagues: publicProcedure.query(async ({ ctx }) => {
    const _scCTok = getAgentCookieFromReq(ctx.req);
    if (!_scCTok) return [];
    let _me: string;
    try { _me = (jwt.verify(_scCTok, ENV.cookieSecret) as { traineeCode: string }).traineeCode; }
    catch { return []; }
    const all = await listWorkforceAgents();
    return (all as Array<Record<string, unknown>>)
      .filter(a => a.traineeCode && a.traineeCode !== _me && a.agentStatus === "active" && a.isActive !== false)
      .map(a => ({
        traineeCode: a.traineeCode as string,
        name: (a.fullName as string) || (a.alias as string) || (a.traineeCode as string),
        alias: (a.alias as string) || "",
        offDay1: (a.offDay1 as number | null) ?? null,
        offDay2: (a.offDay2 as number | null) ?? null,
      }))
      .sort((x, y) => x.name.localeCompare(y.name));
  }),

  listAll: protectedProcedure.query(() => listAllScheduleChangeRequests()),

  peerApprove: publicProcedure
    .input(z.object({ id: z.number(), approve: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const _scRTok = getAgentCookieFromReq(ctx.req);
      if (!_scRTok) throw new TRPCError({ code: "UNAUTHORIZED" });
      try { jwt.verify(_scRTok, ENV.cookieSecret); } catch { throw new TRPCError({ code: "UNAUTHORIZED" }); }
      const reqs = await listAllScheduleChangeRequests();
      const req = reqs.find(r => r.id === input.id);
      if (input.approve) {
        await updateScheduleChangeRequest(input.id, {
          status: "pending_manager",
          peerApprovedAt: Date.now(),
        });
        // Notify admin that peer has approved and manager review is needed
        if (req) {
          await notifyOwner({
            title: "Schedule Change Needs Your Approval",
            content: `${req.requesterCode} and ${req.targetCode} have agreed to swap schedules. Peer approval complete — please review and approve or reject in the Request Center.`,
          }).catch(() => {});
          // Also ping the management Slack channel so it surfaces in real time.
          const _mgmtHook = process.env.SLACK_MANAGEMENT_WEBHOOK || process.env.SLACK_ADMIN_WEBHOOK;
          if (_mgmtHook) {
            fetch(_mgmtHook, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: `:calendar: *Schedule Change Needs Approval*\n${req.requesterCode} and ${req.targetCode} have agreed to swap schedules. Peer approval is complete — review and approve/reject in the Request Center.`,
              }),
            }).catch(() => {});
          }
        }
      } else {
        await updateScheduleChangeRequest(input.id, { status: "rejected" });
        // Peer declined → close it and tell the requester (A). It never reaches admin.
        if (req) {
          const requester = await getWorkforceAgentByCode(req.requesterCode);
          if (requester) {
            await createAgentNotification({
              candidateId: requester.candidateId,
              message: `${req.targetCode} declined your schedule swap request. It has been closed and was not sent to the admin.`,
              type: "general",
              relatedId: null,
            }).catch(() => {});
          }
        }
      }
      return { success: true };
    }),

  managerApprove: protectedProcedure
    .input(z.object({
      id: z.number(),
      approve: z.boolean(),
      managerComment: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const requests = await listAllScheduleChangeRequests();
      const req = requests.find(r => r.id === input.id);
      if (!req) throw new TRPCError({ code: "NOT_FOUND" });
      if (input.approve) {
        // Update off days for both agents
        if (req.requesterNewOff1 !== null && req.requesterNewOff1 !== undefined) {
          await updateWorkforceAgent(req.requesterCode, { offDay1: req.requesterNewOff1, offDay2: req.requesterNewOff2 ?? undefined });
        }
        if (req.targetNewOff1 !== null && req.targetNewOff1 !== undefined) {
          await updateWorkforceAgent(req.targetCode, { offDay1: req.targetNewOff1, offDay2: req.targetNewOff2 ?? undefined });
        }
        await updateScheduleChangeRequest(input.id, {
          status: "approved",
          managerApprovedAt: Date.now(),
          managerComment: input.managerComment,
        });
        // Notify both agents
        const requester = await getWorkforceAgentByCode(req.requesterCode);
        const target = await getWorkforceAgentByCode(req.targetCode);
        if (requester) await createAgentNotification({ candidateId: requester.candidateId, message: "Your schedule change request has been approved.", type: "general", relatedId: input.id });
        if (target) await createAgentNotification({ candidateId: target.candidateId, message: "A schedule change request involving you has been approved.", type: "general", relatedId: input.id });
      } else {
        await updateScheduleChangeRequest(input.id, { status: "rejected", managerComment: input.managerComment });
        const requester = await getWorkforceAgentByCode(req.requesterCode);
        if (requester) await createAgentNotification({ candidateId: requester.candidateId, message: "Your schedule change request was rejected.", type: "general", relatedId: input.id });
      }
      return { success: true };
    }),
});

// ─── Overtime Router ──────────────────────────────────────────────────────────
const overtimeRouter = router({
  respond: publicProcedure
    .input(z.object({
      campaignId: z.number(),
      date: z.string(),
      status: z.enum(["available", "unavailable"]),
    }))
    .mutation(({ ctx, input }) => {
      const _otTok = getAgentCookieFromReq(ctx.req);
      if (!_otTok) throw new TRPCError({ code: "UNAUTHORIZED" });
      let _otCode: string;
      try { _otCode = (jwt.verify(_otTok, ENV.cookieSecret) as { traineeCode: string }).traineeCode; } catch { throw new TRPCError({ code: "UNAUTHORIZED" }); }
      return upsertOvertimeAvailability({ ...input, traineeCode: _otCode });
    }),

    getResponses: protectedProcedure
    .input(z.object({ campaignId: z.number(), date: z.string() }))
    .query(({ input }) => getOvertimeAvailabilityForDate(input.campaignId, input.date)),
});

// ─── Break Schedule Router ────────────────────────────────────────────────────
const breakScheduleRouter = router({
  // Admin: replace all break slots for multiple agent+date combinations
  upsert: protectedProcedure
    .input(z.object({
      entries: z.array(z.object({
        agentCode: z.string(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        slots: z.array(z.object({
          breakStart: z.string().regex(/^\d{2}:\d{2}$/),
          breakEnd: z.string().regex(/^\d{2}:\d{2}$/),
        })),
      })),
    }))
    .mutation(({ input }) => bulkReplaceBreaks(input.entries)),
  // Admin: get breaks for a specific agent in a date range
  getByAgent: protectedProcedure
    .input(z.object({
      agentCode: z.string(),
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(({ input }) => getBreakSchedulesByAgent(input.agentCode, input.startDate, input.endDate)),
  // Admin: get all breaks in a date range (for overview)
  getByDateRange: protectedProcedure
    .input(z.object({ startDate: z.string(), endDate: z.string() }))
    .query(({ input }) => getBreakSchedulesByDateRange(input.startDate, input.endDate)),
  // Admin: delete a specific break entry
  delete: protectedProcedure
    .input(z.object({ agentCode: z.string(), date: z.string() }))
    .mutation(({ input }) => deleteBreakSchedule(input.agentCode, input.date)),
  // Agent: get own breaks for current week
  getMyBreaks: publicProcedure
    .input(z.object({ startDate: z.string(), endDate: z.string() }))
    .query(async ({ input, ctx }) => {
      const agentToken = getAgentCookieFromReq(ctx.req);
      if (!agentToken) throw new TRPCError({ code: "UNAUTHORIZED" });
      let traineeCode: string | null = null;
      try {
        const p = jwt.verify(agentToken, ENV.cookieSecret) as { traineeCode?: string; type: string };
        if (p.type === "agent" && p.traineeCode) traineeCode = p.traineeCode;
      } catch { throw new TRPCError({ code: "UNAUTHORIZED" }); }
      if (!traineeCode) throw new TRPCError({ code: "UNAUTHORIZED" });
      return getBreakSchedulesByAgent(traineeCode, input.startDate, input.endDate);
    }),
});

// ─── Separation Router ────────────────────────────────────────────
const separationRouter = router({
  // Admin: mark agent as resigned on-spot (also blacklists candidate)
  resignOnSpot: protectedProcedure
    .input(z.object({ agentCode: z.string(), reason: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const adminName = ctx.user?.name ?? "Admin";
      await markAgentResignedOnSpot(input.agentCode, input.reason, adminName);
      return { success: true };
    }),

  // Admin: terminate agent
  terminate: protectedProcedure
    .input(z.object({ agentCode: z.string(), reason: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const adminName = ctx.user?.name ?? "Admin";
      await terminateAgent(input.agentCode, input.reason, adminName);
      return { success: true };
    }),

  // Admin: approve a resignation request submitted by agent
  approveResignation: protectedProcedure
    .input(z.object({
      agentCode: z.string(),
      requestId: z.number(),
      adminReply: z.string().optional(),
      adminLastWorkingDay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // YYYY-MM-DD set by admin
    }))
    .mutation(async ({ input, ctx }) => {
      const adminName = ctx.user?.name ?? "Admin";
      // Look up the request to get the reason
      const req = await getAgentRequestById(input.requestId);
      if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "Request not found" });
      // Admin-set last working day takes priority; fallback to agent's requested date
      const lastWorkingDay = input.adminLastWorkingDay
        ?? (req.requestedDate ? new Date(req.requestedDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
      const reason = req.message ?? "Resignation request approved";
      // Save admin's chosen last working day on the request record
      const { getDb } = await import("./db");
      const { agentRequests: arTable } = await import("../drizzle/schema");
      const { eq: eqOp } = await import("drizzle-orm");
      const dbConn = await getDb();
      if (dbConn && input.adminLastWorkingDay) {
        await dbConn.update(arTable).set({ adminLastWorkingDay: input.adminLastWorkingDay }).where(eqOp(arTable.id, input.requestId));
      }
      await approveResignationRequest(input.agentCode, lastWorkingDay, reason, adminName, req.requestedDate ?? Date.now());
      // Also update the request status to resolved
      await updateAgentRequestStatus(input.requestId, "resolved", input.adminReply ?? "Your resignation has been approved.");
      return { success: true };
    }),

  // Admin/Agent: get separation history for an agent
  getByAgent: protectedProcedure
    .input(z.object({ agentCode: z.string() }))
    .query(({ input }) => getSeparationsByAgent(input.agentCode)),
  // Admin: hard delete agent after final pay confirmed
  adminDelete: protectedProcedure
    .input(z.object({ agentCode: z.string() }))
    .mutation(async ({ input }) => {
      await adminDeleteAgent(input.agentCode);
      return { success: true };
    }),
    // Admin: get all terminated/resigned agents pending deletion
  pendingDeletion: protectedProcedure
    .query(() => getPendingDeletionAgents()),
  // Get pending (scheduled, not yet applied) separation for an agent
  getPendingForAgent: protectedProcedure
    .input(z.object({ agentCode: z.string() }))
    .query(({ input }) => getPendingSeparationForAgent(input.agentCode)),
  // Schedule a future resignation (stays active until effectiveDate)
  scheduleResignation: protectedProcedure
    .input(z.object({
      agentCode: z.string(),
      effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      reason: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const adminName = ctx.user?.name ?? "Admin";
      await scheduleResignation(input.agentCode, input.effectiveDate, input.reason, adminName);
      return { success: true };
    }),
  // Cancel a pending scheduled separation
  cancelScheduled: protectedProcedure
    .input(z.object({ agentCode: z.string() }))
    .mutation(async ({ input }) => {
      await cancelScheduledSeparation(input.agentCode);
      return { success: true };
    }),
});
// ─── Payroll v2 Router ───────────────────────────────────────────────────────
const payrollV2Router = router({
  uploadPayrollV2: protectedProcedure
    .input(z.object({
      month: z.string(), // YYYY-MM
      rows: z.array(z.object({
        crdts: z.string(),
        alias: z.string().optional(),
        agentCode: z.string().optional(),
        baseSalary: z.number().optional(),
        workingHours: z.number().optional(),
        ot1x5Hours: z.number().optional(),
        ot1x5Pay: z.number().optional(),
        ot2xHours: z.number().optional(),
        ot2xPay: z.number().optional(),
        ot3xHours: z.number().optional(),
        ot3xPay: z.number().optional(),
        coachingBonus: z.number().optional(),
        commissionEgp: z.number().optional(),
        qualityDeductions: z.number().optional(),
        attendanceDeductions: z.number().optional(),
        totalDeductions: z.number().optional(),
        netPay: z.number().optional(),
        qualityDetail: z.string().optional(),
        attendanceDetail: z.string().optional(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const uploadedBy = ctx.user?.name ?? "admin";
      const uploadedAt = Date.now();

      // Auto-attach commission: the payroll for month M is paid together with the
      // commission earned the PREVIOUS calendar month (June payroll / July 1 salary
      // carries May's commission). Pull it from commission_leaderboard by CRDTS.
      const { getDb: _getDbComm } = await import("./db");
      const _dbComm = await _getDbComm();
      const commissionMap = new Map<string, number>();
      let commissionCycle = "";
      if (_dbComm) {
        const [py, pm] = input.month.split("-").map(Number);
        const prev = new Date(py, pm - 1, 1);   // the payroll month itself = the commission's pay cycle
        commissionCycle = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
        const { commissionLeaderboard } = await import("../drizzle/schema");
        const { eq: _eqComm } = await import("drizzle-orm");
        const comms = await _dbComm.select({ crdts: commissionLeaderboard.crdts, amt: commissionLeaderboard.commissionEgp })
          .from(commissionLeaderboard).where(_eqComm(commissionLeaderboard.cycleKey, commissionCycle));
        for (const c of comms) if (c.crdts) commissionMap.set(c.crdts, Number(c.amt || 0));
      }

      for (const row of input.rows) {
        const commissionEgp = commissionMap.get(row.crdts) ?? row.commissionEgp;
        await upsertPayrollRecordV2({ ...row, commissionEgp, month: input.month, uploadedBy, uploadedAt });
      }

      // Anomaly detection
      const { getDb } = await import("./db");
      const { workforceAgents } = await import("../drizzle/schema");
      const db = await getDb();
      const warnings: Array<{ crdts: string; alias?: string; type: string; message: string }> = [];

      if (db) {
        const agents = await db.select({ crdts: workforceAgents.crdts, alias: workforceAgents.alias }).from(workforceAgents);
        const knownCrdts = new Set(agents.map(a => a.crdts).filter(Boolean) as string[]);
        const crdtsToAlias = new Map(agents.filter(a => a.crdts).map(a => [a.crdts!, a.alias ?? a.crdts!]));

        for (const row of input.rows) {
          const alias = crdtsToAlias.get(row.crdts) ?? row.crdts;
          // Agent not in workforce
          if (!knownCrdts.has(row.crdts)) {
            warnings.push({ crdts: row.crdts, alias, type: "unknown_agent", message: `CRDTS "${row.crdts}" not found in workforce roster` });
          }
          // Negative net pay
          if (row.netPay !== undefined && row.netPay < 0) {
            warnings.push({ crdts: row.crdts, alias, type: "negative_net_pay", message: `Net pay is negative (${row.netPay.toFixed(2)} EGP) — check deductions` });
          }
          // Total deductions exceed base salary
          if (row.totalDeductions !== undefined && row.baseSalary !== undefined && row.baseSalary > 0 && row.totalDeductions > row.baseSalary) {
            warnings.push({ crdts: row.crdts, alias, type: "deductions_exceed_salary", message: `Total deductions (${row.totalDeductions.toFixed(0)} EGP) exceed base salary (${row.baseSalary.toFixed(0)} EGP)` });
          }
        }
      }

      if (commissionCycle && commissionMap.size === 0) {
        warnings.push({ crdts: "—", type: "no_commission", message: `No commission found for ${commissionCycle} — upload that month's commission file first, then re-upload payroll to attach it.` });
      }

      return { success: true, count: input.rows.length, commissionCycle, commissionAttached: commissionMap.size, warnings };
    }),

  getStatusPage: protectedProcedure
    .input(z.object({ month: z.string() }))
    .query(({ input }) => getPayrollStatusPage(input.month)),

  setStatus: protectedProcedure
    .input(z.object({ id: z.number(), status: z.enum(["pending", "paid"]) }))
    .mutation(({ input }) => setPayrollStatus(input.id, input.status)),

  updateRecord: protectedProcedure
    .input(z.object({
      id: z.number(),
      data: z.object({
        baseSalary: z.string().optional(),
        workingHours: z.string().optional(),
        ot1x5Hours: z.string().optional(),
        ot1x5Pay: z.string().optional(),
        ot2xHours: z.string().optional(),
        ot2xPay: z.string().optional(),
        ot3xHours: z.string().optional(),
        ot3xPay: z.string().optional(),
        coachingBonus: z.string().optional(),
        commissionEgp: z.string().optional(),
        totalDeductions: z.string().optional(),
        netPay: z.string().optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { payrollRecords } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const updates: Record<string, string | null> = {};
      for (const [k, v] of Object.entries(input.data)) {
        if (v !== undefined) updates[k] = v === "" ? null : v;
      }
      // Auto-recalculate netPay if not explicitly set but other fields changed
      if (!updates.netPay) {
        const existing = await db.select().from(payrollRecords).where(eq(payrollRecords.id, input.id)).limit(1);
        if (existing[0]) {
          const r = { ...existing[0], ...updates };
          const n = (v: string | null) => parseFloat(String(v || "0")) || 0;
          const calcNet = n(r.baseSalary) + n(r.ot1x5Pay) + n(r.ot2xPay) + n(r.ot3xPay) + n(r.coachingBonus) - n(r.totalDeductions);
          updates.netPay = calcNet.toFixed(2);
        }
      }
      await db.update(payrollRecords).set(updates).where(eq(payrollRecords.id, input.id));
      return { success: true };
    }),

  getMyMonths: publicProcedure
    .input(z.object({ crdts: z.string() }))
    .query(({ input }) => getMyPayrollMonthsByCrdts(input.crdts)),
  getMyRecord: publicProcedure
    .input(z.object({ crdts: z.string(), month: z.string() }))
    .query(({ input }) => getMyPayrollRecordByCrdts(input.crdts, input.month)),
  // Agent portal: derive CRDTS from cookie automatically
  getMyMonthsFromCookie: publicProcedure.query(async ({ ctx }) => {
    const _pr1Tok = getAgentCookieFromReq(ctx.req);
    if (!_pr1Tok) return [];
    try {
      const { traineeCode: _pr1Code } = jwt.verify(_pr1Tok, ENV.cookieSecret) as { traineeCode: string };
      const agent = await getWorkforceAgentByCode(_pr1Code);
      if (!agent?.crdts) return [];
      return getMyPayrollMonthsByCrdts(agent.crdts);
    } catch { return []; }
  }),
  getMyRecordFromCookie: publicProcedure
    .input(z.object({ month: z.string() }))
    .query(async ({ ctx, input }) => {
      const _pr2Tok = getAgentCookieFromReq(ctx.req);
      if (!_pr2Tok) return null;
      try {
        const { traineeCode: _pr2Code } = jwt.verify(_pr2Tok, ENV.cookieSecret) as { traineeCode: string };
        const agent = await getWorkforceAgentByCode(_pr2Code);
        if (!agent?.crdts) return null;
        return getMyPayrollRecordByCrdts(agent.crdts, input.month);
      } catch { return null; }
    }),
  // Admin: get all payroll records for a specific agent by CRDTS
  getAgentPayrollHistory: protectedProcedure
    .input(z.object({ crdts: z.string() }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const { payrollRecords } = await import("../drizzle/schema");
      const { eq, asc } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(payrollRecords)
        .where(eq(payrollRecords.crdts, input.crdts))
        .orderBy(asc(payrollRecords.month));
      return rows.reverse(); // newest first
    }),

  // Admin: delete all payroll V2 rows for a specific month (undo a bad import)
  deleteForMonth: protectedProcedure
    .input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq: eqOp } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { payrollRecords } = await import("../drizzle/schema");
      const result = await db.delete(payrollRecords).where(eqOp(payrollRecords.month, input.month));
      return { deleted: (result as { rowsAffected?: number }).rowsAffected ?? 0 };
    }),
});
// ─── Orientation Router ────────────────────────────────────────────────────────
const orientationRouter = router({
  getStatus: publicProcedure.query(async ({ ctx }) => {
    const token = getAgentCookieFromReq(ctx.req);
    if (!token) return { shown: true }; // not an agent session, skip
    try {
      const payload = jwt.verify(token, ENV.cookieSecret) as { traineeCode: string; type: string };
      if (payload.type !== "agent") return { shown: true };
      const shown = await getOrientationStatus(payload.traineeCode);
      return { shown };
    } catch { return { shown: true }; }
  }),
  markShown: publicProcedure.mutation(async ({ ctx }) => {
    const token = getAgentCookieFromReq(ctx.req);
    if (!token) return;
    try {
      const payload = jwt.verify(token, ENV.cookieSecret) as { traineeCode: string; type: string };
      if (payload.type !== "agent") return;
      await markOrientationShown(payload.traineeCode);
    } catch { return; }
  }),
  reset: protectedProcedure
    .input(z.object({ traineeCode: z.string() }))
    .mutation(({ input }) => resetOrientation(input.traineeCode)),
});

// ─── Violations Router ────────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════
// OT (read-only) — data is pushed nightly from the sheets. DISPLAY ONLY:
// payroll is calculated in Python from the same sheets, so the Hub never
// writes any of this to a payslip.
// ════════════════════════════════════════════════════════════════════════════
const otRouter = router({
  list: protectedProcedure
    .input(z.object({ crdts: z.string().optional(), month: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const { and, eq, desc } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return [];
      const { cycleOT } = await import("../drizzle/schema");
      const conds = [];
      if (input?.crdts) conds.push(eq(cycleOT.crdts, input.crdts));
      if (input?.month) conds.push(eq(cycleOT.cycleKey, input.month));
      const q = db.select().from(cycleOT).$dynamic();
      if (conds.length) q.where(and(...conds));
      return q.orderBy(desc(cycleOT.date));
    }),
});

// ════════════════════════════════════════════════════════════════════════════
// EMPLOYEES — managers/admins as people, not just logins.
// Managers get an employee record, link their Hub login to it, and can edit
// their own profile ("My Profile").
// ════════════════════════════════════════════════════════════════════════════
const NON_AGENT_TYPES = ["team_lead", "manager", "hr", "ops_manager", "finance", "admin"] as const;

const employeesRouter = router({
  /** Complete profile bundle for one agent — everything in one call:
   *  salary history, commission history, performance, joining/training dates.
   *  Money sections are visible to all roles EXCEPT bd (checked on the client too). */
  profileFull: protectedProcedure
    .input(z.object({ crdts: z.string(), traineeCode: z.string().optional() }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq, or, desc, asc } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return null;
      const { payrollRecords, commissions, commissionLeaderboard, cycleStats, candidates, workforceAgents } = await import("../drizzle/schema");
      const crdts = input.crdts;

      const [payroll, commissionRows, leaderboard, perf, wf] = await Promise.all([
        db.select().from(payrollRecords).where(eq(payrollRecords.crdts, crdts)).orderBy(desc(payrollRecords.month)),
        db.select().from(commissions).where(eq(commissions.crdts, crdts)).orderBy(desc(commissions.performanceMonth)),
        db.select().from(commissionLeaderboard).where(eq(commissionLeaderboard.crdts, crdts)).orderBy(desc(commissionLeaderboard.cycleKey)),
        db.select().from(cycleStats).where(eq(cycleStats.crdts, crdts)).orderBy(asc(cycleStats.cycleKey)),
        db.select().from(workforceAgents).where(eq(workforceAgents.crdts, crdts)).limit(1),
      ]);

      // Recruitment dates: joined-training (candidate.createdAt) + joined-ops (workforce.joinDate)
      let candidate = null as unknown;
      const wfRow = wf[0];
      if (wfRow?.candidateId) {
        const cand = await db.select().from(candidates).where(eq(candidates.id, wfRow.candidateId)).limit(1);
        candidate = cand[0] ?? null;
      }

      return {
        payroll, commissions: commissionRows, leaderboard, performance: perf,
        candidate, joinDate: wfRow?.joinDate ?? null,
      };
    }),

  /** Everyone — agents AND management. Used by the Employee Profiles tab. */
  list: protectedProcedure
    .input(z.object({ type: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq, desc } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return [];
      const { workforceAgents } = await import("../drizzle/schema");
      const q = db.select().from(workforceAgents).$dynamic();
      if (input?.type) q.where(eq(workforceAgents.employeeType, input.type as "agent"));
      return q.orderBy(desc(workforceAgents.createdAt));
    }),

  /** Create a management employee record (Settings → Management). */
  addManagement: protectedProcedure
    .input(z.object({
      fullName: z.string().min(1).max(255),
      alias: z.string().max(100).optional(),
      email: z.string().email().optional(),
      phone: z.string().max(50).optional(),
      jobTitle: z.string().max(100).optional(),
      employeeType: z.enum(NON_AGENT_TYPES),
      joinDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "owner" && ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { workforceAgents } = await import("../drizzle/schema");
      // Management records get a synthetic staff code — they have no dialer CRDTS.
      const code = "MGMT-" + Date.now().toString().slice(-6);
      await db.insert(workforceAgents).values({
        traineeCode: code,
        fullName: input.fullName,
        alias: input.alias ?? input.fullName,
        email: input.email ?? null,
        phone: input.phone ?? null,
        jobTitle: input.jobTitle ?? null,
        employeeType: input.employeeType,
        joinDate: input.joinDate ?? null,
        agentStatus: "active",
      } as never);
      return { ok: true, traineeCode: code } as const;
    }),

  /** Link a Hub login to an employee record, so they can edit their own profile. */
  linkLogin: protectedProcedure
    .input(z.object({ traineeCode: z.string(), openId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "owner" && ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { workforceAgents } = await import("../drizzle/schema");
      await db.update(workforceAgents).set({ openId: input.openId })
        .where(eq(workforceAgents.traineeCode, input.traineeCode));
      return { ok: true } as const;
    }),

  /** The logged-in person's OWN employee record (null if their login isn't linked). */
  myProfile: protectedProcedure.query(async ({ ctx }) => {
    const openId = ctx.user?.openId;
    if (!openId) return null;
    const { getDb } = await import("./db");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return null;
    const { workforceAgents } = await import("../drizzle/schema");
    const [row] = await db.select().from(workforceAgents).where(eq(workforceAgents.openId, openId));
    return row ?? null;
  }),

  /** Edit your OWN profile — personal details only. Can't touch salary/status/role. */
  updateMyProfile: protectedProcedure
    .input(z.object({
      phone: z.string().max(50).optional(),
      address: z.string().max(500).optional(),
      emergencyContactName: z.string().max(255).optional(),
      emergencyContactPhone: z.string().max(64).optional(),
      emergencyContactRelation: z.string().max(100).optional(),
      dateOfBirth: z.string().optional(),
      city: z.string().max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const openId = ctx.user?.openId;
      if (!openId) throw new TRPCError({ code: "FORBIDDEN", message: "Your login isn't linked to an employee record yet." });
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { workforceAgents } = await import("../drizzle/schema");
      await db.update(workforceAgents).set(input).where(eq(workforceAgents.openId, openId));
      return { ok: true } as const;
    }),
});

const violationsRouter = router({
  bulkInsert: protectedProcedure
    .input(z.array(z.object({
      agentCode: z.string(),
      crdts: z.string().optional(),
      date: z.string(),
      type: z.string(),
      category: z.enum(["attendance", "quality"]),
      hours: z.number().optional(),
      deduction: z.number().optional(),
      description: z.string().optional(),
      month: z.string().optional(),
    })))
    .mutation(async ({ input, ctx }) => {
      const uploadedBy = ctx.user?.name ?? "admin";
      const uploadedAt = Date.now();
      await bulkInsertViolations(input.map(r => ({ ...r, uploadedBy, uploadedAt })));
      return { success: true };
    }),

  list: protectedProcedure
    .input(z.object({
      agentCode: z.string().optional(),
      crdts: z.string().optional(),
      month: z.string().optional(),
      category: z.enum(["attendance", "quality"]).optional(),
    }))
    .query(({ input }) => listViolations(input)),

  myViolations: publicProcedure
    .input(z.object({ agentCode: z.string(), month: z.string().optional() }))
    .query(({ input }) => listViolations({ agentCode: input.agentCode, month: input.month })),
});

// ─── Performance v2 Router ────────────────────────────────────────────────────
const performanceV2Router = router({
  bulkUpsert: protectedProcedure
    .input(z.object({
      month: z.string(),
      rows: z.array(z.object({
        crdts: z.string(),
        alias: z.string().optional(),
        agentCode: z.string().optional(),
        loginHours: z.number().optional(),
        revenue: z.number().optional(),
        cost: z.number().optional(),
        profit: z.number().optional(),
        revPerHour: z.number().optional(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const uploadedBy = ctx.user?.name ?? "admin";
      const uploadedAt = Date.now();
      await bulkUpsertPerformance(input.rows.map(r => ({ ...r, month: input.month, uploadedBy, uploadedAt })));
      return { success: true };
    }),

  getByMonth: protectedProcedure
    .input(z.object({ month: z.string() }))
    .query(({ input }) => getPerformanceByMonth(input.month)),

  getMonths: protectedProcedure
    .query(() => getPerformanceMonths()),
});

// ─── Adherence Router ─────────────────────────────────────────────────────────
const adherenceRouter = router({
  bulkInsert: protectedProcedure
    .input(z.array(z.object({
      agentCode: z.string().optional(),
      crdts: z.string().optional(),
      alias: z.string().optional(),
      date: z.string(),
      month: z.string().optional(),
      type: z.string(),
      hours: z.number().optional(),
      deduction: z.number().optional(),
      notes: z.string().optional(),
    })))
    .mutation(async ({ input, ctx }) => {
      const uploadedBy = ctx.user?.name ?? "admin";
      const uploadedAt = Date.now();
      await bulkInsertAdherence(input.map(r => ({ ...r, uploadedBy, uploadedAt })));
      return { success: true };
    }),

  list: protectedProcedure
    .input(z.object({ agentCode: z.string().optional(), month: z.string().optional() }))
    .query(({ input }) => listAdherence(input)),

  getMonths: protectedProcedure
    .query(() => getAdherenceMonths()),
});

// ─── Quality Router ───────────────────────────────────────────────────────────
const qualityRouter = router({
  bulkInsert: protectedProcedure
    .input(z.array(z.object({
      agentCode: z.string().optional(),
      crdts: z.string().optional(),
      alias: z.string().optional(),
      date: z.string(),
      month: z.string().optional(),
      type: z.string(),
      score: z.number().optional(),
      penalty: z.number().optional(),
      notes: z.string().optional(),
    })))
    .mutation(async ({ input, ctx }) => {
      const uploadedBy = ctx.user?.name ?? "admin";
      const uploadedAt = Date.now();
      await bulkInsertQuality(input.map(r => ({ ...r, uploadedBy, uploadedAt })));
      return { success: true };
    }),

  list: protectedProcedure
    .input(z.object({ agentCode: z.string().optional(), month: z.string().optional() }))
    .query(({ input }) => listQuality(input)),

  getMonths: protectedProcedure
    .query(() => getQualityMonths()),
});


// ─── Cycle Tracker Router ────────────────────────────────────────────────────
const cycleTrackerRouter = router({
  // Admin: upload stats Excel rows
  uploadStats: protectedProcedure
    .input(z.object({
      rows: z.array(z.object({
        crdts: z.string(),
        agentCode: z.string().optional(),
        alias: z.string().optional(),
        date: z.string(),          // YYYY-MM-DD
        loginHours: z.number().default(0),
        totalCalls: z.number().default(0),
        revenue: z.number().default(0),
        cost: z.number().default(0),
        profit: z.number().default(0),
        revPerHr: z.number().default(0),
      }))
    }))
    .mutation(async ({ input }) => {
      const cycleKey = getCurrentCycleKey();
      const rows = input.rows.map(r => ({ ...r, cycleKey: getCycleKeyForDate(r.date) }));
      await upsertCycleStats(rows);

      // Anomaly detection
      const { getDb } = await import("./db");
      const { workforceAgents } = await import("../drizzle/schema");
      const { cycleStats: cycleStatsTable } = await import("../drizzle/schema");
      const db = await getDb();
      const warnings: Array<{ crdts: string; alias?: string; type: string; message: string }> = [];

      if (db) {
        // Load known CRDTS from workforce
        const agents = await db.select({ crdts: workforceAgents.crdts, alias: workforceAgents.alias }).from(workforceAgents);
        const knownCrdts = new Set(agents.map(a => a.crdts).filter(Boolean) as string[]);
        const crdtsToAlias = new Map(agents.filter(a => a.crdts).map(a => [a.crdts!, a.alias ?? a.crdts!]));

        // Load historical averages for revenue spike detection
        const { avg } = await import("drizzle-orm");
        const allStats = await db.select({ crdts: cycleStatsTable.crdts, revenue: cycleStatsTable.revenue }).from(cycleStatsTable);
        const avgByAgent = new Map<string, number>();
        const grouped = new Map<string, number[]>();
        for (const s of allStats) {
          if (!s.crdts) continue;
          if (!grouped.has(s.crdts)) grouped.set(s.crdts, []);
          const rev = parseFloat(s.revenue ?? "0");
          if (rev > 0) grouped.get(s.crdts)!.push(rev);
        }
        Array.from(grouped.entries()).forEach(([crdts, revs]) => {
          if (revs.length > 0) avgByAgent.set(crdts, revs.reduce((a: number, b: number) => a + b, 0) / revs.length);
        });

        for (const row of rows) {
          const alias = crdtsToAlias.get(row.crdts) ?? row.alias ?? row.crdts;
          // Unknown CRDTS
          if (!knownCrdts.has(row.crdts)) {
            warnings.push({ crdts: row.crdts, alias, type: "unknown_agent", message: `CRDTS "${row.crdts}" not found in workforce roster` });
          }
          // Zero login hours with revenue
          if (row.loginHours === 0 && row.revenue > 0) {
            warnings.push({ crdts: row.crdts, alias, type: "zero_hours_revenue", message: `Revenue $${row.revenue} recorded with 0 login hours` });
          }
          // Revenue spike: > 3x historical average
          const histAvg = avgByAgent.get(row.crdts);
          if (histAvg && row.revenue > histAvg * 3) {
            warnings.push({ crdts: row.crdts, alias, type: "revenue_spike", message: `Revenue $${row.revenue} is ${(row.revenue / histAvg).toFixed(1)}x above historical average ($${histAvg.toFixed(0)})` });
          }
        }
      }

      return { count: rows.length, cycleKey, warnings };
    }),

  // Admin: upload deductions Excel rows
  uploadDeductions: protectedProcedure
    .input(z.object({
      rows: z.array(z.object({
        crdts: z.string(),
        agentCode: z.string().optional(),
        alias: z.string().optional(),
        date: z.string(),
        violationType: z.string(),
        hours: z.number().default(0),
        deductionAmount: z.number().default(0),
        status: z.enum(["approved", "rejected"]).default("approved"),
      }))
    }))
    .mutation(async ({ input }) => {
      const cycleKey = getCurrentCycleKey();
      const rows = input.rows.map(r => ({ ...r, cycleKey: getCycleKeyForDate(r.date) }));
      await upsertCycleDeductions(rows);
      return { count: rows.length, cycleKey };
    }),

  // Admin: upload OT Excel rows
  uploadOT: protectedProcedure
    .input(z.object({
      rows: z.array(z.object({
        crdts: z.string(),
        agentCode: z.string().optional(),
        alias: z.string().optional(),
        date: z.string(),
        otType: z.string(),        // "1.5x" | "2x" | "3x"
        hours: z.number().default(0),
        egpAmount: z.number().default(0),
      }))
    }))
    .mutation(async ({ input }) => {
      const cycleKey = getCurrentCycleKey();
      const rows = input.rows.map(r => ({ ...r, cycleKey: getCycleKeyForDate(r.date) }));
      await upsertCycleOT(rows);
      return { count: rows.length, cycleKey };
    }),

  // Agent: get their own cycle tracker data
  getMyTracker: publicProcedure
    .query(async ({ ctx }) => {
      const token = getAgentCookieFromReq(ctx.req);
      if (!token) return null;
      let traineeCode: string;
      try {
        const decoded = jwt.verify(token, ENV.cookieSecret) as { traineeCode: string };
        traineeCode = decoded.traineeCode;
      } catch { return null; }
      // Get CRDTS from workforce profile
      const { workforceAgents } = await import("../drizzle/schema");
      const { getDb } = await import("./db");
      const dbConn = await getDb();
      if (!dbConn) return null;
      const { eq } = await import("drizzle-orm");
      const agent = await dbConn.select({ crdts: workforceAgents.crdts })
        .from(workforceAgents)
        .where(eq(workforceAgents.traineeCode, traineeCode))
        .limit(1);
      const crdts = agent[0]?.crdts;
      if (!crdts) return null;
      const cycleKey = getCurrentCycleKey();
      const dateRange = getCycleDateRange(cycleKey);
      const data = await getCycleTrackerForAgent(crdts, cycleKey);
      return { ...data, cycleKey, dateRange };
    }),

  // Admin: get current cycle key
  getCurrentCycle: protectedProcedure
    .query(async () => {
      const cycleKey = getCurrentCycleKey();
      const dateRange = getCycleDateRange(cycleKey);
      return { cycleKey, dateRange };
    }),

  // Admin: get team performance summary for a cycle
  getTeamStats: protectedProcedure
    .input(z.object({ cycleKey: z.string().regex(/^\d{4}-\d{2}$/) }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const { cycleStats } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(cycleStats).where(eq(cycleStats.cycleKey, input.cycleKey));
      // Pull teamLeader from workforce_agents for TL filter
      const { workforceAgents } = await import("../drizzle/schema");
      const agentRows = await db.select({ crdts: workforceAgents.crdts, teamLeader: workforceAgents.teamLeader }).from(workforceAgents);
      const tlByCrdts = new Map(agentRows.map(a => [a.crdts, a.teamLeader ?? null]));
      // Aggregate by CRDTS
      const byAgent = new Map<string, {
        crdts: string; agentCode: string | null; alias: string | null; teamLeader: string | null;
        totalRevenue: number; totalCalls: number; totalLoginHours: number;
        totalProfit: number; totalRevPerHr: number; days: number;
      }>();
      for (const row of rows) {
        const existing = byAgent.get(row.crdts);
        if (existing) {
          existing.totalRevenue += Number(row.revenue ?? 0);
          existing.totalCalls += Number(row.totalCalls ?? 0);
          existing.totalLoginHours += Number(row.loginHours ?? 0);
          existing.totalProfit += Number(row.profit ?? 0);
          existing.totalRevPerHr += Number(row.revPerHr ?? 0);
          existing.days += 1;
          if (!existing.alias && row.alias) existing.alias = row.alias;
          if (!existing.agentCode && row.agentCode) existing.agentCode = row.agentCode;
        } else {
          byAgent.set(row.crdts, {
            crdts: row.crdts,
            agentCode: row.agentCode ?? null,
            alias: row.alias ?? null,
            teamLeader: tlByCrdts.get(row.crdts) ?? null,
            totalRevenue: Number(row.revenue ?? 0),
            totalCalls: Number(row.totalCalls ?? 0),
            totalLoginHours: Number(row.loginHours ?? 0),
            totalProfit: Number(row.profit ?? 0),
            totalRevPerHr: Number(row.revPerHr ?? 0),
            days: 1,
          });
        }
      }
      return Array.from(byAgent.values()).map(a => ({
        ...a,
        avgRevPerHr: a.totalLoginHours > 0 ? a.totalRevenue / a.totalLoginHours : 0,
      }));
    }),
  // Agent: get list of all cycle keys that have data for this agent
  getMyTrackerHistory: publicProcedure
    .query(async ({ ctx }) => {
      const token = getAgentCookieFromReq(ctx.req);
      if (!token) return [];
      let traineeCode: string;
      try {
        const decoded = jwt.verify(token, ENV.cookieSecret) as { traineeCode: string };
        traineeCode = decoded.traineeCode;
      } catch { return []; }
      const { workforceAgents, cycleStats } = await import("../drizzle/schema");
      const { getDb } = await import("./db");
      const dbConn = await getDb();
      if (!dbConn) return [];
      const { eq, asc } = await import("drizzle-orm");
      const agent = await dbConn.select({ crdts: workforceAgents.crdts })
        .from(workforceAgents).where(eq(workforceAgents.traineeCode, traineeCode)).limit(1);
      const crdts = agent[0]?.crdts;
      if (!crdts) return [];
      const rows = await dbConn.selectDistinct({ cycleKey: cycleStats.cycleKey })
        .from(cycleStats).where(eq(cycleStats.crdts, crdts)).orderBy(asc(cycleStats.cycleKey));
      return rows.map(r => r.cycleKey).reverse(); // newest first
    }),

  // Agent: get cycle tracker data for a specific cycle (by cookie)
  getMyTrackerByCycle: publicProcedure
    .input(z.object({ cycleKey: z.string().regex(/^\d{4}-\d{2}$/) }))
    .query(async ({ ctx, input }) => {
      const token = getAgentCookieFromReq(ctx.req);
      if (!token) return null;
      let traineeCode: string;
      try {
        const decoded = jwt.verify(token, ENV.cookieSecret) as { traineeCode: string };
        traineeCode = decoded.traineeCode;
      } catch { return null; }
      const { workforceAgents } = await import("../drizzle/schema");
      const { getDb } = await import("./db");
      const dbConn = await getDb();
      if (!dbConn) return null;
      const { eq, and, inArray } = await import("drizzle-orm");
      const agent = await dbConn.select({ crdts: workforceAgents.crdts })
        .from(workforceAgents).where(eq(workforceAgents.traineeCode, traineeCode)).limit(1);
      const crdts = agent[0]?.crdts;
      if (!crdts) return null;
      const dateRange = getCycleDateRange(input.cycleKey);
      const data = await getCycleTrackerForAgent(crdts, input.cycleKey);
      // Manual payroll adjustments (admin-added) for this cycle -> shown to the
      // agent as "Other Bonuses" / "Other Deductions". Split CRDTS on commas so an
      // agent with more than one dialer ID picks up all of them.
      const { payrollAdjustments } = await import("../drizzle/schema");
      const crdtsList = String(crdts).split(",").map(x => x.trim()).filter(Boolean);
      const adjustments = crdtsList.length
        ? await dbConn.select().from(payrollAdjustments)
            .where(and(inArray(payrollAdjustments.crdts, crdtsList), eq(payrollAdjustments.month, input.cycleKey)))
        : [];
      return { ...data, adjustments, cycleKey: input.cycleKey, dateRange };
    }),

  // Admin: get all cycle history for a specific agent by CRDTS
  getAgentHistory: protectedProcedure
    .input(z.object({ crdts: z.string() }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const { cycleStats, cycleDeductions, cycleOT } = await import("../drizzle/schema");
      const { eq, asc } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return [];
      // Get all distinct cycle keys for this agent
      const cycleRows = await db.selectDistinct({ cycleKey: cycleStats.cycleKey })
        .from(cycleStats).where(eq(cycleStats.crdts, input.crdts)).orderBy(asc(cycleStats.cycleKey));
      const cycleKeys = cycleRows.map(r => r.cycleKey).reverse();
      // For each cycle, aggregate stats
      const result = await Promise.all(cycleKeys.map(async (cycleKey) => {
        const [stats, deds, ots] = await Promise.all([
          db.select().from(cycleStats).where(eq(cycleStats.crdts, input.crdts)).then(rows => rows.filter(r => r.cycleKey === cycleKey)),
          db.select().from(cycleDeductions).where(eq(cycleDeductions.crdts, input.crdts)).then(rows => rows.filter(r => r.cycleKey === cycleKey)),
          db.select().from(cycleOT).where(eq(cycleOT.crdts, input.crdts)).then(rows => rows.filter(r => r.cycleKey === cycleKey)),
        ]);
        const totalRevenue = stats.reduce((s, r) => s + Number(r.revenue ?? 0), 0);
        const totalCalls = stats.reduce((s, r) => s + Number(r.totalCalls ?? 0), 0);
        const totalLoginHours = stats.reduce((s, r) => s + Number(r.loginHours ?? 0), 0);
        const totalProfit = stats.reduce((s, r) => s + Number(r.profit ?? 0), 0);
        const totalDeductions = deds.reduce((s, r) => s + Number(r.deductionAmount ?? 0), 0);
        const totalOTHours = ots.reduce((s, r) => s + Number(r.hours ?? 0), 0);
        const totalOTEgp = ots.reduce((s, r) => s + Number(r.egpAmount ?? 0), 0);
        const revPerHr = totalLoginHours > 0 ? totalRevenue / totalLoginHours : 0;
        const dateRange = getCycleDateRange(cycleKey);
        return { cycleKey, dateRange, totalRevenue, totalCalls, totalLoginHours, totalProfit, totalDeductions, totalOTHours, totalOTEgp, revPerHr, days: stats.length };
      }));
      return result;
    }),

  // Admin: delete all stats rows for a specific date (undo a bad upload)
  deleteStatsForDate: protectedProcedure
    .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq: eqOp } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { cycleStats, cycleDeductions, cycleOT, coachingSessions } = await import("../drizzle/schema");
      const [statsRes, dedRes, otRes, coachRes] = await Promise.all([
        db.delete(cycleStats).where(eqOp(cycleStats.date, input.date)),
        db.delete(cycleDeductions).where(eqOp(cycleDeductions.date, input.date)),
        db.delete(cycleOT).where(eqOp(cycleOT.date, input.date)),
        db.delete(coachingSessions).where(eqOp(coachingSessions.sessionDate, input.date)),
      ]);
      const total = (
        ((statsRes as { rowsAffected?: number }).rowsAffected ?? 0) +
        ((dedRes as { rowsAffected?: number }).rowsAffected ?? 0) +
        ((otRes as { rowsAffected?: number }).rowsAffected ?? 0) +
        ((coachRes as { rowsAffected?: number }).rowsAffected ?? 0)
      );
      return { deleted: total };
    }),
  // Admin: delete all stats for a specific cycle month (e.g. "2026-05")
  deleteStatsForCycle: protectedProcedure
    .input(z.object({ cycleKey: z.string().regex(/^\d{4}-\d{2}$/) }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq: eqOp } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { cycleStats, cycleDeductions, cycleOT, coachingSessions } = await import("../drizzle/schema");
      const [statsRes, dedRes, otRes, coachRes] = await Promise.all([
        db.delete(cycleStats).where(eqOp(cycleStats.cycleKey, input.cycleKey)),
        db.delete(cycleDeductions).where(eqOp(cycleDeductions.cycleKey, input.cycleKey)),
        db.delete(cycleOT).where(eqOp(cycleOT.cycleKey, input.cycleKey)),
        db.delete(coachingSessions).where(eqOp(coachingSessions.cycleKey, input.cycleKey)),
      ]);
      const total = (
        ((statsRes as { rowsAffected?: number }).rowsAffected ?? 0) +
        ((dedRes as { rowsAffected?: number }).rowsAffected ?? 0) +
        ((otRes as { rowsAffected?: number }).rowsAffected ?? 0) +
        ((coachRes as { rowsAffected?: number }).rowsAffected ?? 0)
      );
            return { deleted: total };
    }),
  // ─── Client Logouts ───────────────────────────────────────────────────────
  uploadClientLogouts: protectedProcedure
    .input(z.object({
      rows: z.array(z.object({
        crdts: z.string(),
        agentCode: z.string().optional(),
        alias: z.string().optional(),
        date: z.string(), // YYYY-MM-DD
        cycleKey: z.string(),
      }))
    }))
    .mutation(({ input }) => bulkUpsertClientLogouts(input.rows)),
  getClientLogoutsByCycle: protectedProcedure
    .input(z.object({ cycleKey: z.string() }))
    .query(({ input }) => getClientLogoutsByCycle(input.cycleKey)),
  getMyClientLogouts: protectedProcedure
    .query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const { getDb } = await import('./db');
      const { workforceAgents } = await import('../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      const db = await getDb();
      if (!db) return [];
      const traineeCode = ctx.user.openId; // agent uses their code
      const agent = await db.select({ crdts: workforceAgents.crdts })
        .from(workforceAgents).where(eq(workforceAgents.traineeCode, traineeCode)).limit(1);
      const crdts = agent[0]?.crdts;
      if (!crdts) return [];
      return getClientLogoutsByAgent(crdts);
    }),
  // ─── Commission Month ──────────────────────────────────────────────────────
  getCommissionMonth: protectedProcedure
    .input(z.object({ crdts: z.string(), month: z.string() }))
    .query(({ input }) => getCommissionMonthData(input.crdts, input.month)),
  getAvailableCommissionMonths: protectedProcedure
    .input(z.object({ crdts: z.string() }))
    .query(({ input }) => getAvailableCommissionMonths(input.crdts)),
  getMyCommissionMonths: protectedProcedure
    .query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const { getDb } = await import('./db');
      const { workforceAgents } = await import('../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      const db = await getDb();
      if (!db) return [];
      const agent = await db.select({ crdts: workforceAgents.crdts })
        .from(workforceAgents).where(eq(workforceAgents.traineeCode, ctx.user.openId)).limit(1);
      const crdts = agent[0]?.crdts;
      if (!crdts) return [];
      return getAvailableCommissionMonths(crdts);
    }),
  getMyCommissionMonth: protectedProcedure
    .input(z.object({ month: z.string() }))
    .query(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const { getDb } = await import('./db');
      const { workforceAgents } = await import('../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      const db = await getDb();
      if (!db) return null;
      const agent = await db.select({ crdts: workforceAgents.crdts })
        .from(workforceAgents).where(eq(workforceAgents.traineeCode, ctx.user.openId)).limit(1);
      const crdts = agent[0]?.crdts;
      if (!crdts) return null;
      return getCommissionMonthData(crdts, input.month);
    }),
  // ─── Performance History ──────────────────────────────────────────────────
  getMyPerformanceHistory: protectedProcedure
    .query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const { getDb } = await import('./db');
      const { workforceAgents } = await import('../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      const db = await getDb();
      if (!db) return [];
      const agent = await db.select({ crdts: workforceAgents.crdts })
        .from(workforceAgents).where(eq(workforceAgents.traineeCode, ctx.user.openId)).limit(1);
      const crdts = agent[0]?.crdts;
      if (!crdts) return [];
      return getAgentPerformanceHistory(crdts);
    }),
  getAgentPerformanceHistory: protectedProcedure
    .input(z.object({ crdts: z.string() }))
    .query(({ input }) => getAgentPerformanceHistory(input.crdts)),
  // ─── Campaign Ranking ─────────────────────────────────────────────────────
  getMyCampaignRanking: protectedProcedure
    .input(z.object({ cycleKey: z.string() }))
    .query(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const { getDb } = await import('./db');
      const { workforceAgents } = await import('../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      const db = await getDb();
      if (!db) return null;
      const agent = await db.select({ crdts: workforceAgents.crdts })
        .from(workforceAgents).where(eq(workforceAgents.traineeCode, ctx.user.openId)).limit(1);
      const crdts = agent[0]?.crdts;
      if (!crdts) return null;
      return getCampaignRanking(crdts, input.cycleKey);
    }),
  // ─── Agent (cookie-based) versions ─────────────────────────────────────────
  getMyClientLogoutsAgent: publicProcedure
    .query(async ({ ctx }) => {
      const token = getAgentCookieFromReq(ctx.req);
      if (!token) return [];
      let traineeCode: string;
      try {
        const decoded = jwt.verify(token, ENV.cookieSecret) as { traineeCode: string };
        traineeCode = decoded.traineeCode;
      } catch { return []; }
      const { workforceAgents } = await import('../drizzle/schema');
      const { getDb } = await import('./db');
      const dbConn = await getDb();
      if (!dbConn) return [];
      const { eq } = await import('drizzle-orm');
      const agent = await dbConn.select({ crdts: workforceAgents.crdts })
        .from(workforceAgents).where(eq(workforceAgents.traineeCode, traineeCode)).limit(1);
      const crdts = agent[0]?.crdts;
      if (!crdts) return [];
      return getClientLogoutsByAgent(crdts);
    }),

  getMyQualityFlagsAgent: publicProcedure
    .query(async ({ ctx }) => {
      const token = getAgentCookieFromReq(ctx.req);
      if (!token) return [];
      let traineeCode: string;
      try {
        const decoded = jwt.verify(token, ENV.cookieSecret) as { traineeCode: string };
        traineeCode = decoded.traineeCode;
      } catch { return []; }
      const { workforceAgents } = await import('../drizzle/schema');
      const { getDb } = await import('./db');
      const dbConn = await getDb();
      if (!dbConn) return [];
      const { eq } = await import('drizzle-orm');
      const agent = await dbConn.select({ crdts: workforceAgents.crdts })
        .from(workforceAgents).where(eq(workforceAgents.traineeCode, traineeCode)).limit(1);
      const crdts = agent[0]?.crdts;
      if (!crdts) return [];
      return getAgentQualityFlagsByAgent(crdts);
    }),
  getMyCommissionMonthsAgent: publicProcedure
    .query(async ({ ctx }) => {
      const token = getAgentCookieFromReq(ctx.req);
      if (!token) return [] as string[];
      let traineeCode: string;
      try {
        const decoded = jwt.verify(token, ENV.cookieSecret) as { traineeCode: string };
        traineeCode = decoded.traineeCode;
      } catch { return [] as string[]; }
      const { workforceAgents } = await import('../drizzle/schema');
      const { getDb } = await import('./db');
      const dbConn = await getDb();
      if (!dbConn) return [] as string[];
      const { eq } = await import('drizzle-orm');
      const agent = await dbConn.select({ crdts: workforceAgents.crdts })
        .from(workforceAgents).where(eq(workforceAgents.traineeCode, traineeCode)).limit(1);
      const crdts = agent[0]?.crdts;
      if (!crdts) return [] as string[];
      return getAvailableCommissionMonths(crdts);
    }),
  getMyCommissionMonthAgent: publicProcedure
    .input(z.object({ month: z.string() }))
    .query(async ({ ctx, input }) => {
      const token = getAgentCookieFromReq(ctx.req);
      if (!token) return null;
      let traineeCode: string;
      try {
        const decoded = jwt.verify(token, ENV.cookieSecret) as { traineeCode: string };
        traineeCode = decoded.traineeCode;
      } catch { return null; }
      const { workforceAgents } = await import('../drizzle/schema');
      const { getDb } = await import('./db');
      const dbConn = await getDb();
      if (!dbConn) return null;
      const { eq } = await import('drizzle-orm');
      const agent = await dbConn.select({ crdts: workforceAgents.crdts })
        .from(workforceAgents).where(eq(workforceAgents.traineeCode, traineeCode)).limit(1);
      const crdts = agent[0]?.crdts;
      if (!crdts) return null;
      return getCommissionMonthData(crdts, input.month);
    }),
  getMyCampaignRankingAgent: publicProcedure
    .input(z.object({ cycleKey: z.string() }))
    .query(async ({ ctx, input }) => {
      const token = getAgentCookieFromReq(ctx.req);
      if (!token) return null;
      let traineeCode: string;
      try {
        const decoded = jwt.verify(token, ENV.cookieSecret) as { traineeCode: string };
        traineeCode = decoded.traineeCode;
      } catch { return null; }
      const { workforceAgents } = await import('../drizzle/schema');
      const { getDb } = await import('./db');
      const dbConn = await getDb();
      if (!dbConn) return null;
      const { eq } = await import('drizzle-orm');
      const agent = await dbConn.select({ crdts: workforceAgents.crdts })
        .from(workforceAgents).where(eq(workforceAgents.traineeCode, traineeCode)).limit(1);
      const crdts = agent[0]?.crdts;
      if (!crdts) return null;
      return getCampaignRanking(crdts, input.cycleKey);
    }),

  // Admin: per-day stats for a specific agent + cycle (for line charts with logout markers)
  getAgentDailyStats: protectedProcedure
    .input(z.object({ crdts: z.string(), cycleKey: z.string().regex(/^\d{4}-\d{2}$/) }))
    .query(async ({ input }) => {
      const { getDb } = await import('./db');
      const { cycleStats, clientLogouts } = await import('../drizzle/schema');
      const { eq, and } = await import('drizzle-orm');
      const db = await getDb();
      if (!db) return { daily: [], logoutDates: [] };
      const daily = await db.select({
        date: cycleStats.date,
        loginHours: cycleStats.loginHours,
        revenue: cycleStats.revenue,
        totalCalls: cycleStats.totalCalls,
        profit: cycleStats.profit,
      }).from(cycleStats)
        .where(and(eq(cycleStats.crdts, input.crdts), eq(cycleStats.cycleKey, input.cycleKey)))
        .orderBy(cycleStats.date);
      const logouts = await db.select({ date: clientLogouts.date })
        .from(clientLogouts)
        .where(and(eq(clientLogouts.crdts, input.crdts), eq(clientLogouts.cycleKey, input.cycleKey)));
      return {
        daily: daily.map(r => ({
          date: r.date,
          loginHours: Number(r.loginHours ?? 0),
          revenue: Number(r.revenue ?? 0),
          totalCalls: Number(r.totalCalls ?? 0),
          profit: Number(r.profit ?? 0),
        })),
        logoutDates: logouts.map(l => l.date),
      };
    }),

  // Agent: full performance history per cycle (uses JWT cookie)
  getMyPerformanceHistoryAgent: publicProcedure
    .query(async ({ ctx }) => {
      const token = getAgentCookieFromReq(ctx.req);
      if (!token) return [];
      let traineeCode: string;
      try {
        const decoded = jwt.verify(token, ENV.cookieSecret) as { traineeCode: string };
        traineeCode = decoded.traineeCode;
      } catch { return []; }
      const { workforceAgents } = await import('../drizzle/schema');
      const { getDb } = await import('./db');
      const { eq } = await import('drizzle-orm');
      const dbConn = await getDb();
      if (!dbConn) return [];
      const agentRow = await dbConn.select({ crdts: workforceAgents.crdts })
        .from(workforceAgents).where(eq(workforceAgents.traineeCode, traineeCode)).limit(1);
      const crdts = agentRow[0]?.crdts;
      if (!crdts) return [];
      return getAgentPerformanceHistory(crdts);
    }),

  // Agent: per-day stats for own data (uses JWT cookie)
  getMyDailyStats: publicProcedure
    .input(z.object({ cycleKey: z.string().regex(/^\d{4}-\d{2}$/) }))
    .query(async ({ ctx, input }) => {
      const token = getAgentCookieFromReq(ctx.req);
      if (!token) return { daily: [], logoutDates: [] };
      let traineeCode: string;
      try {
        const decoded = jwt.verify(token, ENV.cookieSecret) as { traineeCode: string };
        traineeCode = decoded.traineeCode;
      } catch { return { daily: [], logoutDates: [] }; }
      const { workforceAgents } = await import('../drizzle/schema');
      const { getDb } = await import('./db');
      const { eq, and } = await import('drizzle-orm');
      const dbConn = await getDb();
      if (!dbConn) return { daily: [], logoutDates: [] };
      const agentRow = await dbConn.select({ crdts: workforceAgents.crdts })
        .from(workforceAgents).where(eq(workforceAgents.traineeCode, traineeCode)).limit(1);
      const crdts = agentRow[0]?.crdts;
      if (!crdts) return { daily: [], logoutDates: [] };
      const { cycleStats, clientLogouts } = await import('../drizzle/schema');
      const daily = await dbConn.select({
        date: cycleStats.date,
        loginHours: cycleStats.loginHours,
        revenue: cycleStats.revenue,
        totalCalls: cycleStats.totalCalls,
        profit: cycleStats.profit,
      }).from(cycleStats)
        .where(and(eq(cycleStats.crdts, crdts), eq(cycleStats.cycleKey, input.cycleKey)))
        .orderBy(cycleStats.date);
      const logouts = await dbConn.select({ date: clientLogouts.date })
        .from(clientLogouts)
        .where(and(eq(clientLogouts.crdts, crdts), eq(clientLogouts.cycleKey, input.cycleKey)));
      return {
        daily: daily.map(r => ({
          date: r.date,
          loginHours: Number(r.loginHours ?? 0),
          revenue: Number(r.revenue ?? 0),
          totalCalls: Number(r.totalCalls ?? 0),
          profit: Number(r.profit ?? 0),
        })),
        logoutDates: logouts.map(l => l.date),
      };
    }),
});
// ─── Coaching Router ────────────────────────────────────────────────────────
const coachingRouter = router({
  // Upload coaching sessions from sheet
  upload: protectedProcedure
    .input(z.object({
      cycleKey: z.string().regex(/^\d{4}-\d{2}$/),
      sessions: z.array(z.object({
        crdts: z.string(),
        agentCode: z.string().optional(),
        alias: z.string().optional(),
        sessionDate: z.string(),
        coachingHours: z.number().default(0),
        bonusAmount: z.number().default(0),
        sessionType: z.string().optional(),
        notes: z.string().optional(),
      }))
    }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { coachingSessions } = await import("../drizzle/schema");
      const now = Date.now();
      const rows = input.sessions.map(s => ({
        crdts: s.crdts,
        agentCode: s.agentCode ?? null,
        alias: s.alias ?? null,
        sessionDate: s.sessionDate,
        cycleKey: input.cycleKey,
        coachingHours: String(s.coachingHours),
        bonusAmount: String(s.bonusAmount),
        sessionType: s.sessionType ?? null,
        notes: s.notes ?? null,
        status: "pending" as const,
        uploadedAt: now,
      }));
      await db.insert(coachingSessions).values(rows);
      return { inserted: rows.length };
    }),

  // List coaching sessions for a cycle
  listByCycle: protectedProcedure
    .input(z.object({ cycleKey: z.string().regex(/^\d{4}-\d{2}$/) }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq: eqOp } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return [];
      const { coachingSessions } = await import("../drizzle/schema");
      return db.select().from(coachingSessions).where(eqOp(coachingSessions.cycleKey, input.cycleKey));
    }),

  // List coaching sessions for a specific agent (by CRDTS)
  listByCrdts: protectedProcedure
    .input(z.object({ crdts: z.string() }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq: eqOp, desc } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return [];
      const { coachingSessions } = await import("../drizzle/schema");
      return db.select().from(coachingSessions)
        .where(eqOp(coachingSessions.crdts, input.crdts))
        .orderBy(desc(coachingSessions.sessionDate));
    }),

  // Approve / reject a session
  updateStatus: protectedProcedure
    .input(z.object({ id: z.number(), status: z.enum(["pending", "approved", "rejected"]) }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq: eqOp } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { coachingSessions } = await import("../drizzle/schema");
      await db.update(coachingSessions).set({ status: input.status }).where(eqOp(coachingSessions.id, input.id));
      return { ok: true };
    }),

  // Delete all sessions for a cycle (undo upload)
  deleteForCycle: protectedProcedure
    .input(z.object({ cycleKey: z.string().regex(/^\d{4}-\d{2}$/) }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq: eqOp } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { coachingSessions } = await import("../drizzle/schema");
      const result = await db.delete(coachingSessions).where(eqOp(coachingSessions.cycleKey, input.cycleKey));
      return { deleted: (result as { rowsAffected?: number }).rowsAffected ?? 0 };
    }),

  // Get coaching bonus total for an agent in a cycle (for payslip)
  getBonusForAgent: protectedProcedure
    .input(z.object({ crdts: z.string(), cycleKey: z.string() }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const { and, eq: eqOp } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return { total: 0, sessions: [] };
      const { coachingSessions } = await import("../drizzle/schema");
      const sessions = await db.select().from(coachingSessions)
        .where(and(
          eqOp(coachingSessions.crdts, input.crdts),
          eqOp(coachingSessions.cycleKey, input.cycleKey),
          eqOp(coachingSessions.status, "approved")
        ));
      const total = sessions.reduce((sum, s) => sum + parseFloat(String(s.bonusAmount ?? 0)), 0);
      return { total, sessions };
    }),

  // Agent: get my coaching sessions
  getMyCoachingSessions: publicProcedure
    .input(z.object({ cycleKey: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      try {
        const token = getAgentCookieFromReq(ctx.req);
        if (!token) return [];
        const p = jwt.verify(token, ENV.cookieSecret) as { candidateId?: number; type?: string };
        if (!p.candidateId) return [];
        const { getDb } = await import("./db");
        const { and, eq: eqOp } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) return [];
        const { coachingSessions, workforceAgents } = await import("../drizzle/schema");
        const wf = await db.select({ crdts: workforceAgents.crdts })
          .from(workforceAgents)
          .where(eqOp(workforceAgents.candidateId, p.candidateId))
          .limit(1);
        if (!wf.length || !wf[0].crdts) return [];
        const crdts = wf[0].crdts;
        const conditions = [eqOp(coachingSessions.crdts, crdts)];
        if (input.cycleKey) conditions.push(eqOp(coachingSessions.cycleKey, input.cycleKey));
        return db.select().from(coachingSessions).where(and(...conditions));
      } catch { return []; }
    }),
});

// ─── Settings Router ────────────────────────────────────────────────────────
const settingsRouter = router({
  // Team Leaders
  listTeamLeaders: protectedProcedure.query(async () => {
    const { getDb } = await import("./db");
    const { teamLeaders } = await import("../drizzle/schema");
    const db = await getDb();
    if (!db) return [];
    return db.select().from(teamLeaders).orderBy(teamLeaders.name);
  }),
  addTeamLeader: protectedProcedure
    .input(z.object({ name: z.string().min(1), email: z.string().email().optional(), phone: z.string().optional() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { teamLeaders } = await import("../drizzle/schema");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.insert(teamLeaders).values({ name: input.name, email: input.email, phone: input.phone });
      return { success: true };
    }),
  updateTeamLeader: protectedProcedure
    .input(z.object({ id: z.number(), name: z.string().min(1).optional(), email: z.string().email().optional(), phone: z.string().optional(), isActive: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { teamLeaders } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { id, ...rest } = input;
      await db.update(teamLeaders).set(rest).where(eq(teamLeaders.id, id));
      return { success: true };
    }),
  deleteTeamLeader: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { teamLeaders } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.delete(teamLeaders).where(eq(teamLeaders.id, input.id));
      return { success: true };
    }),
});

// ─── Coaching Cases Router (admin-only, NOT visible to agents) ───────────────
const COACHING_STATUSES = ["pending", "in_progress", "improved", "no_change", "escalated", "terminated"] as const;
type CoachingStatus = typeof COACHING_STATUSES[number];

const coachingCasesRouter = router({
  // Create a new coaching case
  create: protectedProcedure
    .input(z.object({
      agentId: z.number(),
      agentCrdts: z.string(),
      agentAlias: z.string().optional(),
      nestingLabel: z.string().optional(),
      assignedBy: z.string().min(1),
      cycleKey: z.string().regex(/^\d{4}-\d{2}$/),
      followUpDate: z.string().optional(),
      coachingReason: z.string().min(1),
      whatHappened: z.string().optional(),
      afterCoaching: z.string().optional(),
      nextSteps: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { coachingCases, coachingCaseStatusLog } = await import("../drizzle/schema");
      const result = await db.insert(coachingCases).values({
        agentId: input.agentId,
        agentCrdts: input.agentCrdts,
        agentAlias: input.agentAlias ?? null,
        nestingLabel: input.nestingLabel ?? null,
        assignedBy: input.assignedBy,
        cycleKey: input.cycleKey,
        followUpDate: input.followUpDate ?? null,
        coachingReason: input.coachingReason,
        whatHappened: input.whatHappened ?? null,
        afterCoaching: input.afterCoaching ?? null,
        nextSteps: input.nextSteps ?? null,
        status: "pending",
      });
      const caseId = (result as { insertId?: number }).insertId ?? 0;
      await db.insert(coachingCaseStatusLog).values({
        caseId,
        fromStatus: null,
        toStatus: "pending",
        note: "Case created",
        changedBy: input.assignedBy,
      });
      return { id: caseId };
    }),

  list: protectedProcedure
    .input(z.object({
      cycleKey: z.string().optional(),
      status: z.string().optional(),
      nestingLabel: z.string().optional(),
      agentId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const { and, eq: eqOp, desc } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return [];
      const { coachingCases } = await import("../drizzle/schema");
      const conditions = [];
      if (input.cycleKey) conditions.push(eqOp(coachingCases.cycleKey, input.cycleKey));
      if (input.status) conditions.push(eqOp(coachingCases.status, input.status as CoachingStatus));
      if (input.nestingLabel) conditions.push(eqOp(coachingCases.nestingLabel, input.nestingLabel));
      if (input.agentId) conditions.push(eqOp(coachingCases.agentId, input.agentId));
      return db.select().from(coachingCases)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(coachingCases.createdAt));
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq: eqOp, desc, and } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "NOT_FOUND", message: "DB unavailable" });
      const { coachingCases, coachingCaseStatusLog, cycleStats, qualityLog } = await import("../drizzle/schema");
      const [caseRow] = await db.select().from(coachingCases).where(eqOp(coachingCases.id, input.id)).limit(1);
      if (!caseRow) throw new TRPCError({ code: "NOT_FOUND", message: "Case not found" });
      const statusLog = await db.select().from(coachingCaseStatusLog)
        .where(eqOp(coachingCaseStatusLog.caseId, input.id))
        .orderBy(desc(coachingCaseStatusLog.createdAt));
      const stats = await db.select().from(cycleStats)
        .where(and(eqOp(cycleStats.crdts, caseRow.agentCrdts), eqOp(cycleStats.cycleKey, caseRow.cycleKey)))
        .orderBy(desc(cycleStats.date)).limit(30);
      const totalRevenue = stats.reduce((s, r) => s + parseFloat(String(r.revenue ?? 0)), 0);
      const totalCalls = stats.reduce((s, r) => s + Number(r.totalCalls ?? 0), 0);
      const totalLoginHours = stats.reduce((s, r) => s + parseFloat(String(r.loginHours ?? 0)), 0);
      const avgRevPerHr = totalLoginHours > 0 ? totalRevenue / totalLoginHours : 0;
      let qualityScore: number | null = null;
      try {
        const qRows = await db.select({ score: qualityLog.score }).from(qualityLog)
          .where(eqOp(qualityLog.crdts, caseRow.agentCrdts))
          .orderBy(desc(qualityLog.createdAt)).limit(1);
        if (qRows.length) qualityScore = parseFloat(String(qRows[0].score ?? 0));
      } catch { /* ignore */ }
      return { ...caseRow, statusLog, performanceSnapshot: { totalRevenue, totalCalls, totalLoginHours, avgRevPerHr, days: stats.length }, qualityScore };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      followUpDate: z.string().optional(),
      coachingReason: z.string().optional(),
      whatHappened: z.string().optional(),
      afterCoaching: z.string().optional(),
      nextSteps: z.string().optional(),
      nestingLabel: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq: eqOp } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { coachingCases } = await import("../drizzle/schema");
      const { id, ...fields } = input;
      await db.update(coachingCases).set(fields).where(eqOp(coachingCases.id, id));
      return { ok: true };
    }),

  updateStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(COACHING_STATUSES),
      note: z.string().optional(),
      changedBy: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq: eqOp } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { coachingCases, coachingCaseStatusLog } = await import("../drizzle/schema");
      const [existing] = await db.select({ status: coachingCases.status }).from(coachingCases).where(eqOp(coachingCases.id, input.id)).limit(1);
      await db.update(coachingCases).set({ status: input.status, statusNote: input.note ?? null }).where(eqOp(coachingCases.id, input.id));
      await db.insert(coachingCaseStatusLog).values({ caseId: input.id, fromStatus: existing?.status ?? null, toStatus: input.status, note: input.note ?? null, changedBy: input.changedBy ?? null });
      return { ok: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq: eqOp } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { coachingCases, coachingCaseStatusLog } = await import("../drizzle/schema");
      await db.delete(coachingCaseStatusLog).where(eqOp(coachingCaseStatusLog.caseId, input.id));
      await db.delete(coachingCases).where(eqOp(coachingCases.id, input.id));
      return { ok: true };
    }),
});

// ─── HubSpot Router ──────────────────────────────────────────────────────────
const hubspotRouter = router({
  // Preview contacts from HubSpot — returns new/duplicate/conflict lists
  previewContacts: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(200).default(100),
      after: z.string().optional(), // pagination cursor
    }))
    .query(async () => {
      const token = ENV.hubspotApiToken;
      if (!token) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "HubSpot token not configured" });

      // Fetch contacts from HubSpot v3 API
      const url = `https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=firstname,lastname,email,phone,lifecyclestage,hs_lead_status,createdate,jobtitle`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const err = await res.text();
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `HubSpot API error: ${err}` });
      }
      const data = await res.json() as { results: Array<{ id: string; properties: Record<string, string> }>; paging?: { next?: { after: string } } };

      // Load existing candidates for dedup check
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { candidates: candidatesTable } = await import("../drizzle/schema");
      const existing = await db.select({
        id: candidatesTable.id,
        email: candidatesTable.email,
        phone: candidatesTable.phone,
        name: candidatesTable.name,
      }).from(candidatesTable);

      const emailSet = new Map(existing.filter(c => c.email).map(c => [c.email!.toLowerCase(), c]));
      const phoneSet = new Map(existing.filter(c => c.phone).map(c => [c.phone!.replace(/\D/g, ""), c]));

      // Stage mapping: HubSpot lifecycle → Tanis pipeline
      const STAGE_MAP: Record<string, string> = {
        subscriber: "applied",
        lead: "applied",
        marketingqualifiedlead: "applied",
        salesqualifiedlead: "whatsapp_sent",
        opportunity: "interview_scheduled",
        customer: "accepted",
        other: "applied",
      };

      const contacts = data.results.map(c => {
        const p = c.properties;
        const name = [p.firstname, p.lastname].filter(Boolean).join(" ") || "Unknown";
        const email = p.email?.toLowerCase() || "";
        const phone = p.phone?.replace(/\D/g, "") || "";
        const stage = STAGE_MAP[p.lifecyclestage?.toLowerCase() ?? ""] ?? "applied";

        let status: "new" | "duplicate" | "conflict" = "new";
        let matchedId: number | undefined;
        if (email && emailSet.has(email)) {
          status = "duplicate";
          matchedId = emailSet.get(email)!.id;
        } else if (phone && phoneSet.has(phone)) {
          status = "duplicate";
          matchedId = phoneSet.get(phone)!.id;
        }

        return {
          hubspotId: c.id,
          name,
          email: p.email || "",
          phone: p.phone || "",
          stage,
          lifecycleStage: p.lifecyclestage || "",
          createdAt: p.createdate || "",
          status,
          matchedId,
        };
      });

      return {
        contacts,
        hasMore: !!data.paging?.next?.after,
        nextCursor: data.paging?.next?.after,
        total: contacts.length,
        newCount: contacts.filter(c => c.status === "new").length,
        duplicateCount: contacts.filter(c => c.status === "duplicate").length,
      };
    }),

  // Import selected HubSpot contacts as candidates
  importContacts: protectedProcedure
    .input(z.object({
      contacts: z.array(z.object({
        hubspotId: z.string(),
        name: z.string(),
        email: z.string(),
        phone: z.string(),
        stage: z.string(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { candidates: candidatesTable } = await import("../drizzle/schema");
      const now = Date.now();
      let imported = 0;

      // Load existing phones/emails for final dedup guard
      const existing = await db.select({ email: candidatesTable.email, phone: candidatesTable.phone }).from(candidatesTable);
      const existingEmails = new Set(existing.filter(c => c.email).map(c => c.email!.toLowerCase()));
      const existingPhones = new Set(existing.filter(c => c.phone).map(c => c.phone!.replace(/\D/g, "").slice(-9)));

      for (const c of input.contacts) {
        // Normalize phone to Egyptian format (01XXXXXXXXX)
        const rawPhone = c.phone?.replace(/\D/g, "") || "";
        let normalizedPhone: string | null = null;
        if (rawPhone) {
          // Strip country code: +20 or 0020 → 0
          const local = rawPhone.startsWith("20") ? "0" + rawPhone.slice(2) : rawPhone;
          normalizedPhone = local.startsWith("0") ? local : "0" + local;
          // Validate: Egyptian mobile is 11 digits starting with 01
          if (!/^01[0-9]{9}$/.test(normalizedPhone)) normalizedPhone = rawPhone || null;
        }

        // Final dedup guard
        const emailKey = c.email?.toLowerCase() || "";
        const phoneKey = normalizedPhone?.replace(/\D/g, "").slice(-9) || "";
        if ((emailKey && existingEmails.has(emailKey)) || (phoneKey && existingPhones.has(phoneKey))) continue;

        await db.insert(candidatesTable).values({
          name: c.name,
          email: c.email || null,
          phone: normalizedPhone,
          status: (c.stage as any) || "applied",
          positionApplied: "Call Center Agent",
          source: "other" as const,
          appliedAt: now,
          notes: `Imported from HubSpot`,
        });
        if (emailKey) existingEmails.add(emailKey);
        if (phoneKey) existingPhones.add(phoneKey);
        imported++;
      }
      return { imported };
    }),
});

// ─── Integrations Router ──────────────────────────────────────────────────────
const integrationsRouter = router({
  // Get connection status for all integrations
  getStatus: protectedProcedure.query(async () => {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return { google: false, hubspot: false };
    const { integrationsTokens } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const googleToken = await db.select().from(integrationsTokens).where(eq(integrationsTokens.provider, "google")).limit(1);
    return {
      google: googleToken.length > 0,
      hubspot: !!ENV.hubspotApiToken,
    };
  }),

  // Disconnect Google Calendar
  disconnectGoogle: protectedProcedure.mutation(async () => {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return { ok: false };
    const { integrationsTokens } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    await db.delete(integrationsTokens).where(eq(integrationsTokens.provider, "google"));
    return { ok: true };
  }),

  // Debug: inspect raw Google Calendar data
  debugCalendar: protectedProcedure.mutation(async () => {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { integrationsTokens } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const [tokenRow] = await db.select().from(integrationsTokens).where(eq(integrationsTokens.provider, "google")).limit(1);
    if (!tokenRow) return { error: "No Google token stored. Please connect in Settings > Integrations.", calendars: [], sampleEvents: [] };
    let accessToken = tokenRow.accessToken;
    // Refresh if needed
    if (tokenRow.expiresAt && tokenRow.expiresAt < Date.now() + 60_000) {
      const { ENV } = await import("./_core/env");
      const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: ENV.googleClientId, client_secret: ENV.googleClientSecret, refresh_token: tokenRow.refreshToken || "", grant_type: "refresh_token" }),
      });
      const rd = await refreshRes.json() as { access_token?: string; error?: string };
      if (rd.access_token) accessToken = rd.access_token;
      else return { error: `Token refresh failed: ${rd.error}`, calendars: [], sampleEvents: [] };
    }
    // List calendars
    const listRes = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=50", { headers: { Authorization: `Bearer ${accessToken}` } });
    const listText = await listRes.text();
    if (!listRes.ok) return { error: `calendarList failed (${listRes.status}): ${listText}`, calendars: [], sampleEvents: [] };
    const listData = JSON.parse(listText) as { items: Array<{ id: string; summary: string; accessRole: string }> };
    const calendars = (listData.items || []).map(c => ({ id: c.id, summary: c.summary, accessRole: c.accessRole }));
    // Fetch today's events from each calendar
    const today = new Date();
    const timeMin = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0).toISOString();
    const timeMax = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();
    const sampleEvents: Array<{ calendarId: string; calendarName: string; eventId: string; summary: string; start: string; attendeeCount: number; hasPhone: boolean }> = [];
    for (const cal of calendars) {
      try {
        const evRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&maxResults=50&singleEvents=true`, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!evRes.ok) continue;
        const evData = await evRes.json() as { items: Array<{ id: string; summary?: string; start?: { dateTime?: string }; attendees?: unknown[]; description?: string }> };
        for (const ev of (evData.items || [])) {
          sampleEvents.push({ calendarId: cal.id, calendarName: cal.summary, eventId: ev.id, summary: ev.summary || "(no title)", start: ev.start?.dateTime || "", attendeeCount: (ev.attendees || []).length, hasPhone: !!(ev.description && /[Pp]hone|\d{10,}/.test(ev.description)) });
        }
      } catch { /* skip */ }
    }
    return { error: null, tokenExpiresAt: tokenRow.expiresAt, calendars, sampleEvents, timeMin, timeMax };
  }),

  // Preview Google Calendar events as candidate imports
  previewCalendarEvents: protectedProcedure
    .input(z.object({
      dateFrom: z.string().optional(), // ISO date string, e.g. "2026-05-19"
      dateTo: z.string().optional(),   // ISO date string, e.g. "2026-05-21"
    }).optional())
    .mutation(async ({ input }) => {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { integrationsTokens, candidates: candidatesTable } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");

    // Get stored Google token
    const [tokenRow] = await db.select().from(integrationsTokens).where(eq(integrationsTokens.provider, "google")).limit(1);
    if (!tokenRow) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Google Calendar not connected. Please connect in Settings > Integrations." });

    // Refresh token if needed
    let accessToken = tokenRow.accessToken;
    if (tokenRow.expiresAt && tokenRow.expiresAt < Date.now() + 60_000) {
      if (!tokenRow.refreshToken) throw new TRPCError({ code: "UNAUTHORIZED", message: "Google token expired. Please reconnect in Settings > Integrations." });
      const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: ENV.googleClientId,
          client_secret: ENV.googleClientSecret,
          refresh_token: tokenRow.refreshToken,
          grant_type: "refresh_token",
        }),
      });
      const refreshData = await refreshRes.json() as { access_token?: string; expires_in?: number };
      if (!refreshData.access_token) throw new TRPCError({ code: "UNAUTHORIZED", message: "Failed to refresh Google token. Please reconnect." });
      accessToken = refreshData.access_token;
      await db.update(integrationsTokens).set({
        accessToken,
        expiresAt: Date.now() + (refreshData.expires_in ?? 3600) * 1000,
        updatedAt: Date.now(),
      }).where(eq(integrationsTokens.provider, "google"));
    }

    // Fetch calendar events — use provided date range or default to last 90 days + next 30 days
    // Use explicit +03:00 offset (Cairo/GMT+3) so date boundaries are correct for the user's timezone
    const TZ_OFFSET = "+03:00";
    const timeMin = input?.dateFrom
      ? new Date(input.dateFrom + "T00:00:00" + TZ_OFFSET).toISOString()
      : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = input?.dateTo
      ? new Date(input.dateTo + "T23:59:59" + TZ_OFFSET).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    // Step 1: List all calendars the user has access to
    const calListRes = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=50", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!calListRes.ok) {
      const errText = await calListRes.text();
      let errMsg = `Google Calendar API error (${calListRes.status}): ${errText}`;
      if (calListRes.status === 401) errMsg = "Google token expired or revoked. Please disconnect and reconnect Google Calendar in Settings > Integrations.";
      if (calListRes.status === 403) errMsg = "Google Calendar access denied. Make sure the app has calendar read permission.";
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: errMsg });
    }
    const calListData = await calListRes.json() as { items: Array<{ id: string; summary: string; accessRole: string }> };
    // Use all calendars where user has at least reader access
    const calendarIds = (calListData.items || []).map(c => c.id);
    if (calendarIds.length === 0) calendarIds.push("primary"); // fallback

    // Step 2: Fetch events from all calendars in parallel
    type CalEvent = {
      id: string;
      summary?: string;
      description?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
      attendees?: Array<{ email: string; displayName?: string; self?: boolean; responseStatus?: string }>;
      hangoutLink?: string;
    };
    const allItems: CalEvent[] = [];
    const seenEventIds = new Set<string>();
    await Promise.all(calendarIds.map(async (calId) => {
      try {
        const calUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&maxResults=250&singleEvents=true&orderBy=startTime`;
        const calRes = await fetch(calUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!calRes.ok) return; // skip calendars we can't read
        const calData = await calRes.json() as { items: CalEvent[] };
        for (const ev of (calData.items || [])) {
          if (!seenEventIds.has(ev.id)) {
            seenEventIds.add(ev.id);
            allItems.push(ev);
          }
        }
      } catch { /* skip individual calendar errors */ }
    }));
    const calData = { items: allItems };

    // Load existing candidates for dedup
    const existing = await db.select({ id: candidatesTable.id, email: candidatesTable.email, phone: candidatesTable.phone }).from(candidatesTable);
    const emailSet = new Map(existing.filter(c => c.email).map(c => [c.email!.toLowerCase(), c.id]));
    const phoneSet = new Map(existing.filter(c => c.phone).map(c => [c.phone!.replace(/\D/g, ""), c.id]));

    // Parse events — extract candidate from attendees (non-self) and phone from description
    const events: Array<{
      eventId: string;
      candidateName: string;
      candidateEmail: string;
      candidatePhone: string;
      interviewDate: string;
      meetLink: string;
      status: "new" | "duplicate";
      matchedId?: number;
    }> = [];

    for (const ev of calData.items) {
      // Extract phone from description first (HubSpot-created events may have phone but no attendees)
      let phone = "";
      if (ev.description) {
        // Match "Phone number: 00201026616750" or "Phone: +201026616750" or standalone long numbers
        const phoneMatch = ev.description.match(/[Pp]hone\s*(?:number)?\s*[:\-]?\s*([+\d][\d\s\-]{8,20})/)
          || ev.description.match(/(00\d{11,13}|\+\d{10,14}|0\d{10})/);
        if (phoneMatch) phone = phoneMatch[1].trim();
      }

      // Find candidate from attendees (non-self) — may be absent for HubSpot events
      const candidate = ev.attendees?.find(a => !a.self);

      // Skip events with no useful data: need either a candidate attendee OR a phone in description
      if (!candidate && !phone) continue;

      const email = candidate?.email?.toLowerCase() || "";
      const cleanPhone = phone.replace(/\D/g, "");
      let status: "new" | "duplicate" = "new";
      let matchedId: number | undefined;

      if (email && emailSet.has(email)) { status = "duplicate"; matchedId = emailSet.get(email); }
      else if (cleanPhone && phoneSet.has(cleanPhone)) { status = "duplicate"; matchedId = phoneSet.get(cleanPhone); }

      // Build candidate name: prefer attendee display name, then event title, then email prefix
      const candidateName = candidate?.displayName || ev.summary || email.split("@")[0] || "Unknown";

      events.push({
        eventId: ev.id,
        candidateName,
        candidateEmail: candidate?.email || "",
        candidatePhone: phone,
        interviewDate: ev.start?.dateTime || ev.start?.date || "",
        meetLink: ev.hangoutLink || "",
        status,
        matchedId,
      });
    }

    return {
      events,
      total: events.length,
      newCount: events.filter(e => e.status === "new").length,
      duplicateCount: events.filter(e => e.status === "duplicate").length,
    };
  }),

  // Import selected calendar events as candidates
  importCalendarEvents: protectedProcedure
    .input(z.object({
      events: z.array(z.object({
        eventId: z.string(),
        candidateName: z.string(),
        candidateEmail: z.string(),
        candidatePhone: z.string(),
        interviewDate: z.string(),
        meetLink: z.string(),
      })),
    }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { candidates: candidatesTable } = await import("../drizzle/schema");
      const now = Date.now();
      let imported = 0;

      // Load existing phones/emails for final dedup guard
      const existing = await db.select({ email: candidatesTable.email, phone: candidatesTable.phone }).from(candidatesTable);
      const existingEmails = new Set(existing.filter(c => c.email).map(c => c.email!.toLowerCase()));
      const existingPhones = new Set(existing.filter(c => c.phone).map(c => c.phone!.replace(/\D/g, "").slice(-9)));

      for (const e of input.events) {
        // Normalize phone to Egyptian format (01XXXXXXXXX)
        const rawPhone = e.candidatePhone?.replace(/\D/g, "") || "";
        let normalizedPhone: string | null = null;
        if (rawPhone) {
          const local = rawPhone.startsWith("20") ? "0" + rawPhone.slice(2) : rawPhone;
          normalizedPhone = local.startsWith("0") ? local : "0" + local;
          if (!/^01[0-9]{9}$/.test(normalizedPhone)) normalizedPhone = rawPhone || null;
        }

        // Final dedup guard
        const emailKey = e.candidateEmail?.toLowerCase() || "";
        const phoneKey = normalizedPhone?.replace(/\D/g, "").slice(-9) || "";
        if ((emailKey && existingEmails.has(emailKey)) || (phoneKey && existingPhones.has(phoneKey))) continue;

        const interviewTs = e.interviewDate ? new Date(e.interviewDate).getTime() : null;
        await db.insert(candidatesTable).values({
          name: e.candidateName,
          email: e.candidateEmail || null,
          phone: normalizedPhone,
          status: "interview_scheduled" as const,
          positionApplied: "Call Center Agent",
          source: "other" as const,
          meetLink: e.meetLink || null,
          appliedAt: interviewTs ?? now,
          notes: `Imported from Google Calendar. Interview: ${e.interviewDate}`,
        });
        if (emailKey) existingEmails.add(emailKey);
        if (phoneKey) existingPhones.add(phoneKey);
        imported++;
      }
      return { imported };
    }),
});

// ─── Trainer Salaries Router ─────────────────────────────────────────────────
const trainerSalariesRouter = router({
  // Agent: get own trainer salary
  getForAgent: publicProcedure
    .input(z.object({ crdts: z.string(), month: z.string() }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const { trainerSalaries } = await import("../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(trainerSalaries)
        .where(and(eq(trainerSalaries.crdts, input.crdts), eq(trainerSalaries.month, input.month)))
        .limit(1);
      return rows[0] ?? null;
    }),
  getForMonth: protectedProcedure
    .input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return [];
      const { trainerSalaries } = await import("../drizzle/schema");
      const { eq, asc } = await import("drizzle-orm");
      return db.select().from(trainerSalaries)
        .where(eq(trainerSalaries.month, input.month))
        .orderBy(asc(trainerSalaries.trainerName));
    }),

  upsert: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      crdts: z.string().optional(),
      trainerName: z.string().min(1),
      month: z.string().regex(/^\d{4}-\d{2}$/),
      salaryEgp: z.number().min(0),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { trainerSalaries } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const now = Date.now();
      if (input.id) {
        await db.update(trainerSalaries).set({
          trainerName: input.trainerName,
          salaryEgp: String(input.salaryEgp),
          notes: input.notes ?? null,
          updatedAt: now,
        }).where(eq(trainerSalaries.id, input.id));
        return { id: input.id };
      } else {
        const [result] = await db.insert(trainerSalaries).values({
          trainerName: input.trainerName,
          month: input.month,
          salaryEgp: String(input.salaryEgp),
          notes: input.notes ?? null,
          createdAt: now,
          updatedAt: now,
        });
        return { id: (result as { insertId: number }).insertId };
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { trainerSalaries } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db.delete(trainerSalaries).where(eq(trainerSalaries.id, input.id));
      return { ok: true };
    }),
});

// ─── Commission Router ────────────────────────────────────────────────────────
// ─── Payroll Adjustments Router ──────────────────────────────────────────────
const adjustmentsRouter = router({
  // Agent: get own adjustments for a pay cycle
  getForAgent: publicProcedure
    .input(z.object({ crdts: z.string(), month: z.string() }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const { payrollAdjustments } = await import("../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return [];
      return db.select().from(payrollAdjustments)
        .where(and(eq(payrollAdjustments.crdts, input.crdts), eq(payrollAdjustments.month, input.month)));
    }),
  getForMonth: protectedProcedure
    .input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return [];
      const { payrollAdjustments } = await import("../drizzle/schema");
      const { eq, asc } = await import("drizzle-orm");
      return db.select().from(payrollAdjustments)
        .where(eq(payrollAdjustments.month, input.month))
        .orderBy(asc(payrollAdjustments.createdAt));
    }),

  add: protectedProcedure
    .input(z.object({
      crdts: z.string().min(1),
      month: z.string().regex(/^\d{4}-\d{2}$/),
      type: z.enum(["bonus", "deduction"]),
      label: z.string().min(1).max(255),
      amount: z.number().positive(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { payrollAdjustments } = await import("../drizzle/schema");
      const result = await db.insert(payrollAdjustments).values({
        crdts: input.crdts,
        month: input.month,
        type: input.type,
        label: input.label,
        amount: String(input.amount),
        createdAt: Date.now(),
        createdBy: (ctx as { user?: { name?: string } }).user?.name ?? "Admin",
      });
      return { id: (result as { insertId?: number }).insertId ?? 0 };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      type: z.enum(["bonus", "deduction"]).optional(),
      label: z.string().min(1).max(255).optional(),
      amount: z.number().positive().optional(),
    }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { payrollAdjustments } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const updates: Record<string, unknown> = {};
      if (input.type !== undefined) updates.type = input.type;
      if (input.label !== undefined) updates.label = input.label;
      if (input.amount !== undefined) updates.amount = String(input.amount);
      await db.update(payrollAdjustments).set(updates).where(eq(payrollAdjustments.id, input.id));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { payrollAdjustments } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db.delete(payrollAdjustments).where(eq(payrollAdjustments.id, input.id));
      return { success: true };
    }),
});

const commissionRouter = router({
  // Get all commission records for a given payment cycle (YYYY-MM)
  getForMonth: protectedProcedure
    .input(z.object({ month: z.string() }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { commissions } = await import("../drizzle/schema");
      return db.select().from(commissions).where(eq(commissions.paymentCycle, input.month)).orderBy(commissions.crdts);
    }),

  // Upload commission records from parsed Excel rows
  upload: protectedProcedure
    .input(z.object({
      paymentCycle: z.string(),
      rows: z.array(z.object({
        crdts: z.string(),
        alias: z.string().optional(),
        commissionEgp: z.number(),
        performanceMonth: z.string().optional(),
      })),
      uploadedBy: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { commissions } = await import("../drizzle/schema");
      const { sql } = await import("drizzle-orm");
      const now = Date.now();
      const uploader = input.uploadedBy || (ctx as { user?: { name?: string } }).user?.name || "admin";
      const warnings: { crdts: string; type: string; message: string }[] = [];
      let count = 0;
      for (const row of input.rows) {
        if (!row.crdts || row.commissionEgp <= 0) continue;
        try {
          await db.insert(commissions).values({
            crdts: row.crdts,
            alias: row.alias ?? null,
            commissionEgp: String(row.commissionEgp),
            performanceMonth: row.performanceMonth ?? null,
            paymentCycle: input.paymentCycle,
            paymentStatus: "pending",
            uploadedBy: uploader,
            uploadedAt: now,
          }).onDuplicateKeyUpdate({
            set: {
              alias: sql`VALUES(alias)`,
              commissionEgp: sql`VALUES(commissionEgp)`,
              performanceMonth: sql`VALUES(performanceMonth)`,
              uploadedBy: sql`VALUES(uploadedBy)`,
              uploadedAt: sql`VALUES(uploadedAt)`,
            },
          });
          // Auto-sync commission into matching payroll record (same crdts + paymentCycle = month)
          try {
            const { payrollRecords } = await import("../drizzle/schema");
            const { sql: sqlFn } = await import("drizzle-orm");
            await db.update(payrollRecords)
              .set({ commissionEgp: String(row.commissionEgp) })
              .where(sqlFn`${payrollRecords.crdts} = ${row.crdts} AND ${payrollRecords.month} = ${input.paymentCycle}`);
          } catch { /* non-fatal: payroll record may not exist yet */ }
          count++;
        } catch (err) {
          warnings.push({ crdts: row.crdts, type: "insert_error", message: String(err) });
        }
      }
      return { count, warnings };
    }),

  // Update a single commission record amount (manual adjustment)
  updateCommission: protectedProcedure
    .input(z.object({
      id: z.number(),
      commissionEgp: z.number().min(0),
    }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { commissions, payrollRecords } = await import("../drizzle/schema");
      // Update commission record
      await db.update(commissions).set({ commissionEgp: String(input.commissionEgp) }).where(eq(commissions.id, input.id));
      // Sync to matching payroll record if exists (match by crdts + paymentCycle)
      const comm = await db.select().from(commissions).where(eq(commissions.id, input.id)).limit(1);
      if (comm[0]) {
        const { crdts, paymentCycle } = comm[0];
        if (crdts && paymentCycle) {
          const { sql: sqlFn } = await import("drizzle-orm");
          await db.update(payrollRecords)
            .set({ commissionEgp: String(input.commissionEgp) })
            .where(sqlFn`${payrollRecords.crdts} = ${crdts} AND ${payrollRecords.month} = ${paymentCycle}`);
        }
      }
      return { ok: true };
    }),

  // Change the payment cycle (and performance month) on an existing commission record
  changeCycle: protectedProcedure
    .input(z.object({
      id: z.number(),
      newPaymentCycle: z.string().regex(/^\d{4}-\d{2}$/),
      newPerformanceMonth: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { commissions, payrollRecords } = await import("../drizzle/schema");
      // Fetch old record to clean up old payroll sync
      const old = await db.select().from(commissions).where(eq(commissions.id, input.id)).limit(1);
      if (!old[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Commission record not found" });
      const { crdts, paymentCycle: oldCycle, commissionEgp } = old[0];
      // Remove commission from OLD payroll record
      if (crdts && oldCycle) {
        const { sql: sqlFn } = await import("drizzle-orm");
        await db.update(payrollRecords)
          .set({ commissionEgp: "0" })
          .where(sqlFn`${payrollRecords.crdts} = ${crdts} AND ${payrollRecords.month} = ${oldCycle}`);
      }
      // Update commission record to new cycle
      await db.update(commissions).set({
        paymentCycle: input.newPaymentCycle,
        ...(input.newPerformanceMonth ? { performanceMonth: input.newPerformanceMonth } : {}),
      }).where(eq(commissions.id, input.id));
      // Sync to NEW payroll record
      if (crdts) {
        const { sql: sqlFn } = await import("drizzle-orm");
        await db.update(payrollRecords)
          .set({ commissionEgp: commissionEgp ?? "0" })
          .where(sqlFn`${payrollRecords.crdts} = ${crdts} AND ${payrollRecords.month} = ${input.newPaymentCycle}`);
      }
      return { ok: true };
    }),

  // #8 — BULK move an ENTIRE commission cycle (all records + leaderboard rows) to a
  // different pay cycle in one action. Also re-syncs payroll: clears commissionEgp on
  // the old cycle's payroll records and applies it to the new cycle's records.
  reassignCycle: protectedProcedure
    .input(z.object({
      fromCycle: z.string().regex(/^\d{4}-\d{2}$/),
      toCycle: z.string().regex(/^\d{4}-\d{2}$/),
      newPerformanceMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq, and } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      if (input.fromCycle === input.toCycle) throw new TRPCError({ code: "BAD_REQUEST", message: "From and To cycles are the same." });
      const { commissions, commissionLeaderboard, payrollRecords } = await import("../drizzle/schema");
      // 1. Records being moved
      const recs = await db.select().from(commissions).where(eq(commissions.paymentCycle, input.fromCycle));
      // 2. Clear commission off the OLD cycle's payroll records
      for (const rec of recs) {
        await db.update(payrollRecords).set({ commissionEgp: "0" })
          .where(and(eq(payrollRecords.crdts, rec.crdts), eq(payrollRecords.month, input.fromCycle)));
      }
      // 3. Move the commission records to the new pay cycle
      await db.update(commissions).set({
        paymentCycle: input.toCycle,
        ...(input.newPerformanceMonth ? { performanceMonth: input.newPerformanceMonth } : {}),
      }).where(eq(commissions.paymentCycle, input.fromCycle));
      // 4. Move the leaderboard rows too
      await db.update(commissionLeaderboard).set({ cycleKey: input.toCycle })
        .where(eq(commissionLeaderboard.cycleKey, input.fromCycle));
      // 5. Apply commission onto the NEW cycle's payroll records (if that payroll exists yet)
      for (const rec of recs) {
        await db.update(payrollRecords).set({ commissionEgp: rec.commissionEgp ?? "0" })
          .where(and(eq(payrollRecords.crdts, rec.crdts), eq(payrollRecords.month, input.toCycle)));
      }
      return { ok: true, moved: recs.length, from: input.fromCycle, to: input.toCycle };
    }),

  // Get full leaderboard for a cycle (all campaigns)
  getFullLeaderboard: protectedProcedure
    .input(z.object({ cycleKey: z.string() }))
    .query(async ({ input }) => {
      const { getFullLeaderboard } = await import("./db");
      return getFullLeaderboard(input.cycleKey);
    }),

  // Agent-facing: get full leaderboard for a cycle
  getFullLeaderboardAgent: publicProcedure
    .input(z.object({ cycleKey: z.string() }))
    .query(async ({ input }) => {
      const { getFullLeaderboard } = await import("./db");
      return getFullLeaderboard(input.cycleKey);
    }),

  // Upload leaderboard rows from Campaign tabs of the commission file
  uploadLeaderboard: protectedProcedure
    .input(z.object({
      cycleKey: z.string(),
      rows: z.array(z.object({
        campaignName: z.string(),
        crdts: z.string(),
        alias: z.string().optional(),
        rank: z.number(),
        loginHours: z.number().optional(),
        revenue: z.number().optional(),
        profit: z.number().optional(),
        commissionEgp: z.number().optional(),
        performanceMonth: z.string().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      const { upsertCommissionLeaderboard } = await import("./db");
      const count = await upsertCommissionLeaderboard(input.cycleKey, input.rows);
      return { count };
    }),

  // Agent-facing: get upcoming commission for the logged-in agent (by traineeCode)
  getMyUpcomingCommission: publicProcedure
    .input(z.object({ traineeCode: z.string() }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return [];
      const { commissions } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      return db.select().from(commissions)
        .where(eq(commissions.crdts, input.traineeCode))
        .orderBy(commissions.paymentCycle);
    }),

  // Get available cycle keys that have leaderboard data
  getLeaderboardCycles: publicProcedure
    .query(async () => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return [] as { cycleKey: string; performanceMonth: string | null }[];
      const { commissionLeaderboard } = await import("../drizzle/schema");
      const { sql } = await import("drizzle-orm");
      const rows = await db.select({
        cycleKey: commissionLeaderboard.cycleKey,
        performanceMonth: sql<string | null>`MAX(${commissionLeaderboard.performanceMonth})`,
      })
        .from(commissionLeaderboard)
        .groupBy(commissionLeaderboard.cycleKey)
        .orderBy(sql`${commissionLeaderboard.cycleKey} DESC`);
      return rows.map(r => ({ cycleKey: r.cycleKey, performanceMonth: (r.performanceMonth ?? null) as string | null }));
    }),

  // Delete a single commission record by id (also clears commissionEgp from matching payroll record)
  deleteCommissionRecord: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { commissions, payrollRecords } = await import("../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      // Fetch the record first so we can clear the payroll commission
      const [rec] = await db.select().from(commissions).where(eq(commissions.id, input.id)).limit(1);
      if (rec) {
        // Clear commission from matching payroll record
        await db.update(payrollRecords)
          .set({ commissionEgp: "0" })
          .where(and(
            eq(payrollRecords.crdts, rec.crdts),
            eq(payrollRecords.month, rec.paymentCycle)
          ));
        await db.delete(commissions).where(eq(commissions.id, input.id));
      }
      return { success: true };
    }),

  // Clear all commission records AND leaderboard rows for a given pay cycle
  clearCommissionCycle: protectedProcedure
    .input(z.object({ cycleKey: z.string() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { commissions, commissionLeaderboard, payrollRecords } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      // Get all commission records for this cycle to clear payroll commission fields
      const recs = await db.select().from(commissions).where(eq(commissions.paymentCycle, input.cycleKey));
      for (const rec of recs) {
        await db.update(payrollRecords)
          .set({ commissionEgp: "0" })
          .where(eq(payrollRecords.crdts, rec.crdts));
      }
      // Delete all commission records for this cycle
      await db.delete(commissions).where(eq(commissions.paymentCycle, input.cycleKey));
      // Delete all leaderboard rows for this cycle
      await db.delete(commissionLeaderboard).where(eq(commissionLeaderboard.cycleKey, input.cycleKey));
      return { success: true };
    }),
});

// ─── Admin Invites Router ───────────────────────────────────────────────────
const invitesRouter = router({
  generate: protectedProcedure
    .input(z.object({ origin: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { adminInvites } = await import("../drizzle/schema");
      const { randomBytes } = await import("crypto");
      const token = randomBytes(32).toString("hex");
      const now = new Date();
      const expiresAt = Date.now() + 48 * 60 * 60 * 1000; // 48 hours
      await db.insert(adminInvites).values({
        token,
        name: ctx.user.name ?? "Admin",
        email: ctx.user.email ?? "",
        invitedBy: ctx.user.name ?? ctx.user.openId,
        expiresAt,
      });
      const inviteUrl = `${input.origin}/admin-invite?token=${token}`;
      return { token, inviteUrl, expiresAt };
    }),

  list: protectedProcedure
    .query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return [];
      const { adminInvites } = await import("../drizzle/schema");
      const { desc } = await import("drizzle-orm");
      return db.select().from(adminInvites).orderBy(desc(adminInvites.createdAt));
    }),

  revoke: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { adminInvites } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db.delete(adminInvites).where(eq(adminInvites.id, input.id));
      return { ok: true };
    }),

  use: publicProcedure
    .input(z.object({ token: z.string(), openId: z.string() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { adminInvites, users } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const [invite] = await db.select().from(adminInvites).where(eq(adminInvites.token, input.token)).limit(1);
      if (!invite) throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found or already used" });
      if (invite.usedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "This invite link has already been used" });
      if (Date.now() > invite.expiresAt) throw new TRPCError({ code: "BAD_REQUEST", message: "This invite link has expired" });
      // Promote user to admin
      await db.update(users).set({ role: "admin" }).where(eq(users.openId, input.openId));
      // Mark invite as used
      await db.update(adminInvites).set({ usedAt: Date.now() }).where(eq(adminInvites.id, invite.id));
      return { ok: true };
    }),
});

// ─── API Keys Router ─────────────────────────────────────────────────────────
const apiKeysRouter = router({
  // Generate a new API key (admin only)
  generate: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { apiKeys } = await import("../drizzle/schema");
      const { randomBytes, createHash } = await import("crypto");
      const rawKey = `tanis_${randomBytes(32).toString("hex")}`;
      const keyHash = createHash("sha256").update(rawKey).digest("hex");
      const keyPrefix = rawKey.slice(0, 12);
      await db.insert(apiKeys).values({
        name: input.name,
        keyHash,
        keyPrefix,
        createdBy: ctx.user.name ?? ctx.user.openId,
        createdAt: Date.now(),
      });
      // Return the raw key ONCE — it will never be shown again
      return { rawKey, keyPrefix, name: input.name };
    }),

  // List all API keys (admin only) — never returns raw key, only prefix
  list: protectedProcedure
    .query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return [];
      const { apiKeys } = await import("../drizzle/schema");
      const { desc } = await import("drizzle-orm");
      const rows = await db.select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        createdBy: apiKeys.createdBy,
        lastUsedAt: apiKeys.lastUsedAt,
        revokedAt: apiKeys.revokedAt,
        createdAt: apiKeys.createdAt,
      }).from(apiKeys).orderBy(desc(apiKeys.createdAt));
      return rows;
    }),

  // Revoke an API key (admin only)
  revoke: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { apiKeys } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db.update(apiKeys).set({ revokedAt: Date.now() }).where(eq(apiKeys.id, input.id));
      return { ok: true };
    }),

  // Delete an API key permanently (admin only)
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { apiKeys } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db.delete(apiKeys).where(eq(apiKeys.id, input.id));
      return { ok: true };
    }),
});

// ─── #2 Business Development CRM Router ──────────────────────────────────────
// ─── HR Router: lifecycle (settle/archive) + exit process + leave management ──
const hrRouter = router({
  // Mark a former agent's salary as fully paid → they drop out of Operations.
  markSettled: protectedProcedure
    .input(z.object({ traineeCode: z.string(), settled: z.boolean() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { workforceAgents } = await import("../drizzle/schema");
      await db.update(workforceAgents).set({ salarySettled: input.settled }).where(eq(workforceAgents.traineeCode, input.traineeCode));
      return { ok: true };
    }),
  // Exit checklist — read (auto-creates a blank one)
  getExit: protectedProcedure
    .input(z.object({ traineeCode: z.string() }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return null;
      const { exitProcess } = await import("../drizzle/schema");
      const rows = await db.select().from(exitProcess).where(eq(exitProcess.traineeCode, input.traineeCode)).limit(1);
      return rows[0] ?? null;
    }),
  updateExit: protectedProcedure
    .input(z.object({
      traineeCode: z.string(),
      exitType: z.enum(["resignation", "termination", "contract_end"]).optional(),
      exitInterview: z.boolean().optional(), clearance: z.boolean().optional(),
      assetsReturned: z.boolean().optional(), lastWorkingDay: z.string().optional(),
      settlementDone: z.boolean().optional(), notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { exitProcess } = await import("../drizzle/schema");
      const { traineeCode, ...rest } = input;
      const now = Date.now();
      const existing = await db.select().from(exitProcess).where(eq(exitProcess.traineeCode, traineeCode)).limit(1);
      if (existing[0]) await db.update(exitProcess).set({ ...rest, updatedAt: now }).where(eq(exitProcess.traineeCode, traineeCode));
      else await db.insert(exitProcess).values({ traineeCode, ...rest, updatedAt: now });
      return { ok: true };
    }),
  // Archive: exit checklist must be complete → labels the linked candidate + closes out the agent.
  archiveAgent: protectedProcedure
    .input(z.object({ traineeCode: z.string(), status: z.enum(["resigned", "terminated", "blacklisted"]) }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { workforceAgents, exitProcess, candidates } = await import("../drizzle/schema");
      const ex = (await db.select().from(exitProcess).where(eq(exitProcess.traineeCode, input.traineeCode)).limit(1))[0];
      const complete = ex && ex.exitType && ex.exitInterview && ex.clearance && ex.assetsReturned && !!ex.lastWorkingDay && ex.settlementDone;
      if (!complete) throw new TRPCError({ code: "BAD_REQUEST", message: "Exit checklist incomplete — finish all items (type, interview, clearance, assets, last day, settlement) before archiving." });
      const ag = (await db.select().from(workforceAgents).where(eq(workforceAgents.traineeCode, input.traineeCode)).limit(1))[0];
      if (!ag) throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" });
      await db.update(workforceAgents).set({ agentStatus: input.status, salarySettled: true }).where(eq(workforceAgents.traineeCode, input.traineeCode));
      await db.update(exitProcess).set({ completedAt: Date.now(), updatedAt: Date.now() }).where(eq(exitProcess.traineeCode, input.traineeCode));
      if (ag.candidateId) {
        try { await db.update(candidates).set({ status: input.status }).where(eq(candidates.id, ag.candidateId)); } catch (_) { /* candidate table label optional */ }
      }
      return { ok: true };
    }),
  // ── Leave ──
  listBalances: protectedProcedure.query(async () => {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return [];
    const { leaveBalances } = await import("../drizzle/schema");
    return db.select().from(leaveBalances);
  }),
  // Mass-add: set/increment balances for ALL active agents for a year.
  massSetBalances: protectedProcedure
    .input(z.object({ year: z.number(), casualTotal: z.number(), annualTotal: z.number() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq, and } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { leaveBalances, workforceAgents } = await import("../drizzle/schema");
      const agents = await db.select({ traineeCode: workforceAgents.traineeCode }).from(workforceAgents).where(eq(workforceAgents.agentStatus, "active"));
      const now = Date.now();
      let updated = 0;
      for (const a of agents) {
        const ex = (await db.select().from(leaveBalances).where(and(eq(leaveBalances.traineeCode, a.traineeCode), eq(leaveBalances.year, input.year))).limit(1))[0];
        if (ex) await db.update(leaveBalances).set({ casualTotal: input.casualTotal, annualTotal: input.annualTotal, updatedAt: now }).where(eq(leaveBalances.id, ex.id));
        else await db.insert(leaveBalances).values({ traineeCode: a.traineeCode, year: input.year, casualTotal: input.casualTotal, annualTotal: input.annualTotal, updatedAt: now });
        updated++;
      }
      return { ok: true, agents: updated };
    }),
  setBalance: protectedProcedure
    .input(z.object({ traineeCode: z.string(), year: z.number(), casualTotal: z.number().optional(), annualTotal: z.number().optional(), casualUsed: z.number().optional(), annualUsed: z.number().optional() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq, and } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { leaveBalances } = await import("../drizzle/schema");
      const { traineeCode, year, ...rest } = input;
      const now = Date.now();
      const ex = (await db.select().from(leaveBalances).where(and(eq(leaveBalances.traineeCode, traineeCode), eq(leaveBalances.year, year))).limit(1))[0];
      if (ex) await db.update(leaveBalances).set({ ...rest, updatedAt: now }).where(eq(leaveBalances.id, ex.id));
      else await db.insert(leaveBalances).values({ traineeCode, year, casualTotal: rest.casualTotal ?? 0, annualTotal: rest.annualTotal ?? 0, casualUsed: rest.casualUsed ?? 0, annualUsed: rest.annualUsed ?? 0, updatedAt: now });
      return { ok: true };
    }),
  listLeaveRequests: protectedProcedure
    .input(z.object({ status: z.enum(["pending", "approved", "rejected"]).optional() }).optional())
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return [];
      const { leaveRequests } = await import("../drizzle/schema");
      const { eq, desc } = await import("drizzle-orm");
      if (input?.status) return db.select().from(leaveRequests).where(eq(leaveRequests.status, input.status)).orderBy(desc(leaveRequests.createdAt));
      return db.select().from(leaveRequests).orderBy(desc(leaveRequests.createdAt));
    }),
  // Agent submits a request (no type — HR classifies)
  requestLeave: publicProcedure
    .input(z.object({ traineeCode: z.string(), startDate: z.string(), endDate: z.string(), days: z.number().min(1), reason: z.string().optional() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { leaveRequests } = await import("../drizzle/schema");
      await db.insert(leaveRequests).values({ ...input, createdAt: Date.now() });
      return { ok: true };
    }),
  myLeaveRequests: publicProcedure
    .input(z.object({ traineeCode: z.string() }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return [];
      const { leaveRequests } = await import("../drizzle/schema");
      const { eq, desc } = await import("drizzle-orm");
      return db.select().from(leaveRequests).where(eq(leaveRequests.traineeCode, input.traineeCode)).orderBy(desc(leaveRequests.createdAt));
    }),
  // HR decides: classify type + approve (deducts balance) or reject.
  decideLeave: protectedProcedure
    .input(z.object({ id: z.number(), decision: z.enum(["approved", "rejected"]), leaveType: z.enum(["casual", "annual"]).optional(), decidedBy: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const { getDb } = await import("./db");
      const { eq, and } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { leaveRequests, leaveBalances } = await import("../drizzle/schema");
      const req = (await db.select().from(leaveRequests).where(eq(leaveRequests.id, input.id)).limit(1))[0];
      if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "Request not found" });
      if (input.decision === "approved" && !input.leaveType) throw new TRPCError({ code: "BAD_REQUEST", message: "Pick the leave type (عارضة / اعتيادية) before approving." });
      await db.update(leaveRequests).set({ status: input.decision, leaveType: input.leaveType ?? null, decidedBy: input.decidedBy ?? ctx.user?.name ?? null, decidedAt: Date.now() }).where(eq(leaveRequests.id, input.id));
      if (input.decision === "approved" && input.leaveType) {
        const year = parseInt(String(req.startDate).slice(0, 4)) || new Date().getFullYear();
        const bal = (await db.select().from(leaveBalances).where(and(eq(leaveBalances.traineeCode, req.traineeCode), eq(leaveBalances.year, year))).limit(1))[0];
        if (bal) {
          const upd = input.leaveType === "casual" ? { casualUsed: bal.casualUsed + req.days } : { annualUsed: bal.annualUsed + req.days };
          await db.update(leaveBalances).set({ ...upd, updatedAt: Date.now() }).where(eq(leaveBalances.id, bal.id));
        } else {
          await db.insert(leaveBalances).values({ traineeCode: req.traineeCode, year, casualTotal: 0, annualTotal: 0, casualUsed: input.leaveType === "casual" ? req.days : 0, annualUsed: input.leaveType === "annual" ? req.days : 0, updatedAt: Date.now() });
        }
      }
      return { ok: true };
    }),
});

const bdRouter = router({
  // ── Role & login linking ──
  me: protectedProcedure.query(async ({ ctx }) => {
    const role = (ctx.user as { role?: string })?.role;
    const openId = (ctx.user as { openId?: string })?.openId ?? "";
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return { kind: "admin" as const };
    const { bdUsers } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    if (openId) {
      const linked = await db.select().from(bdUsers).where(eq(bdUsers.openId, openId)).limit(1);
      if (linked[0]) return { kind: "bd" as const, bdUser: linked[0] };
    }
    if (role === "admin" || role === "owner") return { kind: "admin" as const };
    // Only users whose Hub role is explicitly "bd" should see the link-login screen.
    // All other roles (manager, hr, ops_manager, team_lead, finance, viewer, user)
    // get read-only admin-style access so they can view the BD pipeline without
    // being prompted to claim a BD identity.
    if (role !== "bd") return { kind: "admin" as const };
    const unlinked = await db.select().from(bdUsers);
    return { kind: "unlinked" as const, candidates: unlinked.filter(u => !u.openId) };
  }),
  linkLogin: protectedProcedure
    .input(z.object({ bdUserId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const openId = (ctx.user as { openId?: string })?.openId;
      if (!openId) throw new TRPCError({ code: "BAD_REQUEST", message: "No login id on session" });
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { bdUsers } = await import("../drizzle/schema");
      const target = await db.select().from(bdUsers).where(eq(bdUsers.id, input.bdUserId)).limit(1);
      if (!target[0]) throw new TRPCError({ code: "NOT_FOUND", message: "BD user not found" });
      if (target[0].openId && target[0].openId !== openId) throw new TRPCError({ code: "BAD_REQUEST", message: "That BD user is already linked to another login" });
      await db.update(bdUsers).set({ openId }).where(eq(bdUsers.id, input.bdUserId));
      return { ok: true };
    }),
  unlinkLogin: protectedProcedure
    .input(z.object({ bdUserId: z.number() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { bdUsers } = await import("../drizzle/schema");
      await db.update(bdUsers).set({ openId: null }).where(eq(bdUsers.id, input.bdUserId));
      return { ok: true };
    }),
  // ── In-Hub bell: reminders due today/overdue (bd users see their own; admin sees all) ──
  dueReminders: protectedProcedure.query(async ({ ctx }) => {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return [];
    const { bdDeals, bdUsers } = await import("../drizzle/schema");
    const { eq, and, lte, notInArray, isNotNull } = await import("drizzle-orm");
    const today = new Date().toISOString().slice(0, 10);
    const openId = (ctx.user as { openId?: string })?.openId ?? "";
    let ownerFilter: number | null = null;
    if (openId) {
      const linked = await db.select().from(bdUsers).where(eq(bdUsers.openId, openId)).limit(1);
      if (linked[0]) ownerFilter = linked[0].id;
    }
    const base = and(isNotNull(bdDeals.reminderDate), lte(bdDeals.reminderDate, today), notInArray(bdDeals.stage, ["closed_won", "closed_lost"]));
    const rows = ownerFilter
      ? await db.select().from(bdDeals).where(and(base, eq(bdDeals.ownerId, ownerFilter)))
      : await db.select().from(bdDeals).where(base);
    return rows.map(d => ({ id: d.id, title: d.title, reminderDate: d.reminderDate, reminderNote: d.reminderNote, ownerId: d.ownerId }));
  }),
  // ── Tasks per deal ──
  listTasks: publicProcedure
    .input(z.object({ dealId: z.number() }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return [];
      const { bdDealTasks } = await import("../drizzle/schema");
      const { eq, asc } = await import("drizzle-orm");
      return db.select().from(bdDealTasks).where(eq(bdDealTasks.dealId, input.dealId)).orderBy(asc(bdDealTasks.done), asc(bdDealTasks.dueDate));
    }),
  addTask: protectedProcedure
    .input(z.object({ dealId: z.number(), title: z.string().min(1), dueDate: z.string().optional() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { bdDealTasks } = await import("../drizzle/schema");
      await db.insert(bdDealTasks).values({ ...input, done: false, createdAt: Date.now() });
      return { ok: true };
    }),
  toggleTask: protectedProcedure
    .input(z.object({ id: z.number(), done: z.boolean() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { bdDealTasks } = await import("../drizzle/schema");
      await db.update(bdDealTasks).set({ done: input.done, doneAt: input.done ? Date.now() : null }).where(eq(bdDealTasks.id, input.id));
      return { ok: true };
    }),
  deleteTask: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { bdDealTasks } = await import("../drizzle/schema");
      await db.delete(bdDealTasks).where(eq(bdDealTasks.id, input.id));
      return { ok: true };
    }),
  // Seed the BD team (Ziad / Malak / Ali). Safe to run repeatedly.
  seedUsers: protectedProcedure.mutation(async () => {
    const { getDb } = await import("./db");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { bdUsers } = await import("../drizzle/schema");
    const now = Date.now();
    const seed: { name: string; role: "lead" | "bd" }[] = [
      { name: "Ziad", role: "lead" }, { name: "Malak", role: "bd" }, { name: "Ali", role: "bd" },
    ];
    for (const s of seed) {
      const ex = await db.select().from(bdUsers).where(eq(bdUsers.name, s.name)).limit(1);
      if (!ex[0]) await db.insert(bdUsers).values({ name: s.name, role: s.role, active: true, createdAt: now });
    }
    return { ok: true };
  }),
  listUsers: publicProcedure.query(async () => {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return [];
    const { bdUsers } = await import("../drizzle/schema");
    return db.select().from(bdUsers);
  }),
  // ── Contacts (shared across the team) ──
  listContacts: publicProcedure.query(async () => {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return [];
    const { bdContacts } = await import("../drizzle/schema");
    const { desc } = await import("drizzle-orm");
    return db.select().from(bdContacts).orderBy(desc(bdContacts.updatedAt));
  }),
  addContact: protectedProcedure
    .input(z.object({ company: z.string().min(1), contactName: z.string().optional(), jobTitle: z.string().optional(), email: z.string().optional(), phone: z.string().optional(), website: z.string().optional(), source: z.string().optional(), notes: z.string().optional(), createdBy: z.number().optional() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { bdContacts } = await import("../drizzle/schema");
      const now = Date.now();
      const result = await db.insert(bdContacts).values({ ...input, createdAt: now, updatedAt: now });
      const insertId = (result as unknown as { insertId: number }).insertId;
      return { ok: true, id: insertId ?? 0 };
    }),
  updateContact: protectedProcedure
    .input(z.object({ id: z.number(), company: z.string().optional(), contactName: z.string().optional(), jobTitle: z.string().optional(), email: z.string().optional(), phone: z.string().optional(), website: z.string().optional(), source: z.string().optional(), notes: z.string().optional() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { bdContacts } = await import("../drizzle/schema");
      const { id, ...rest } = input;
      await db.update(bdContacts).set({ ...rest, updatedAt: Date.now() }).where(eq(bdContacts.id, id));
      return { ok: true };
    }),
  deleteContact: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { bdContacts } = await import("../drizzle/schema");
      await db.delete(bdContacts).where(eq(bdContacts.id, input.id));
      return { ok: true };
    }),
  // ── Deals (per-owner pipeline) ──
  listDeals: publicProcedure
    .input(z.object({ ownerId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return [];
      const { bdDeals } = await import("../drizzle/schema");
      const { eq, desc } = await import("drizzle-orm");
      if (input?.ownerId) return db.select().from(bdDeals).where(eq(bdDeals.ownerId, input.ownerId)).orderBy(desc(bdDeals.updatedAt));
      return db.select().from(bdDeals).orderBy(desc(bdDeals.updatedAt));
    }),
  addDeal: protectedProcedure
    .input(z.object({ title: z.string().min(1), ownerId: z.number(), contactId: z.number().optional(), stage: z.enum(["follow_up", "negotiations", "review", "partners_consultants", "closed_won", "closed_lost"]).optional(), serviceType: z.string().optional(), seats: z.number().optional(), value: z.string().optional(), notes: z.string().optional(), expectedCloseDate: z.string().optional() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { bdDeals } = await import("../drizzle/schema");
      const now = Date.now();
      await db.insert(bdDeals).values({ ...input, stage: input.stage ?? "follow_up", createdAt: now, updatedAt: now });
      return { ok: true };
    }),
  updateDeal: protectedProcedure
    .input(z.object({ id: z.number(), title: z.string().optional(), ownerId: z.number().optional(), contactId: z.number().optional(), serviceType: z.string().optional(), seats: z.number().optional(), value: z.string().optional(), notes: z.string().optional(), expectedCloseDate: z.string().optional() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { bdDeals } = await import("../drizzle/schema");
      const { id, ...rest } = input;
      await db.update(bdDeals).set({ ...rest, updatedAt: Date.now() }).where(eq(bdDeals.id, id));
      return { ok: true };
    }),
  moveStage: protectedProcedure
    .input(z.object({ id: z.number(), stage: z.enum(["follow_up", "negotiations", "review", "partners_consultants", "closed_won", "closed_lost"]), reason: z.string().optional() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { bdDeals } = await import("../drizzle/schema");
      const closed = input.stage === "closed_won" || input.stage === "closed_lost";
      await db.update(bdDeals).set({
        stage: input.stage, updatedAt: Date.now(), stageChangedAt: Date.now(),
        ...(closed ? { closedAt: Date.now(), outcomeReason: input.reason ?? null } : {}),
      }).where(eq(bdDeals.id, input.id));
      return { ok: true };
    }),
  // Activity log — a timestamped note; also refreshes the deal's last-contacted date
  addActivity: protectedProcedure
    .input(z.object({ dealId: z.number(), note: z.string().min(1), createdBy: z.number().optional() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { bdDealActivity, bdDeals } = await import("../drizzle/schema");
      const now = Date.now();
      await db.insert(bdDealActivity).values({ dealId: input.dealId, note: input.note, createdBy: input.createdBy, createdAt: now });
      await db.update(bdDeals).set({ lastContactedAt: now, updatedAt: now }).where(eq(bdDeals.id, input.dealId));
      return { ok: true };
    }),
  listActivity: publicProcedure
    .input(z.object({ dealId: z.number() }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return [];
      const { bdDealActivity } = await import("../drizzle/schema");
      const { eq, desc } = await import("drizzle-orm");
      return db.select().from(bdDealActivity).where(eq(bdDealActivity.dealId, input.dealId)).orderBy(desc(bdDealActivity.createdAt));
    }),
  setReminder: protectedProcedure
    .input(z.object({ id: z.number(), reminderDate: z.string().optional(), reminderNote: z.string().optional() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { bdDeals } = await import("../drizzle/schema");
      await db.update(bdDeals).set({ reminderDate: input.reminderDate ?? null, reminderNote: input.reminderNote ?? null, updatedAt: Date.now() }).where(eq(bdDeals.id, input.id));
      return { ok: true };
    }),
  deleteDeal: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { bdDeals } = await import("../drizzle/schema");
      await db.delete(bdDeals).where(eq(bdDeals.id, input.id));
      return { ok: true };
    }),
  // ── Login linking + role (route gate reads this) ──
  myRole: publicProcedure.query(async ({ ctx }) => {
    const openId = ctx.user?.openId;
    if (!openId) return { linked: false as const, role: null, bdUserId: null, name: null };
    const { getDb } = await import("./db");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return { linked: false as const, role: null, bdUserId: null, name: null };
    const { bdUsers } = await import("../drizzle/schema");
    const rows = await db.select().from(bdUsers).where(eq(bdUsers.openId, openId)).limit(1);
    if (!rows[0]) return { linked: false as const, role: null, bdUserId: null, name: null };
    return { linked: true as const, role: rows[0].role, bdUserId: rows[0].id, name: rows[0].name };
  }),
  linkMyLogin: publicProcedure
    .input(z.object({ bdUserId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const openId = ctx.user?.openId;
      if (!openId) throw new TRPCError({ code: "UNAUTHORIZED", message: "Log in first" });
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { bdUsers } = await import("../drizzle/schema");
      const target = (await db.select().from(bdUsers).where(eq(bdUsers.id, input.bdUserId)).limit(1))[0];
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "BD user not found" });
      if (target.openId && target.openId !== openId) throw new TRPCError({ code: "BAD_REQUEST", message: target.name + " is already linked to another login." });
      await db.update(bdUsers).set({ openId }).where(eq(bdUsers.id, input.bdUserId));
      return { ok: true, name: target.name };
    }),
  // Bell: count + list of due/overdue reminders and tasks for an owner (or all)
  dueItems: publicProcedure
    .input(z.object({ ownerId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return { count: 0, items: [] as { kind: string; dealId: number; title: string; due: string }[] };
      const { bdDeals, bdTasks } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const today = new Date().toISOString().slice(0, 10);
      const deals = input?.ownerId ? await db.select().from(bdDeals).where(eq(bdDeals.ownerId, input.ownerId)) : await db.select().from(bdDeals);
      const dealIds = new Set(deals.map(d => d.id));
      const open = deals.filter(d => d.stage !== "closed_won" && d.stage !== "closed_lost");
      const items: { kind: string; dealId: number; title: string; due: string }[] = [];
      open.forEach(d => { if (d.reminderDate && d.reminderDate <= today) items.push({ kind: "reminder", dealId: d.id, title: d.title + (d.reminderNote ? " — " + d.reminderNote : ""), due: d.reminderDate }); });
      const tasks = await db.select().from(bdTasks).where(eq(bdTasks.done, false));
      tasks.forEach(t => { if (dealIds.has(t.dealId) && t.dueDate && t.dueDate <= today) items.push({ kind: "task", dealId: t.dealId, title: t.title, due: t.dueDate }); });
      items.sort((a, b) => (a.due < b.due ? -1 : 1));
      return { count: items.length, items };
    }),
});

// ─── #5 CRDTS reuse check + archive Router ───────────────────────────────────
const crdtsArchiveRouter = router({
  // Is this CRDTS already held by another agent? Flags if that agent is resigned/terminated.
  checkReuse: protectedProcedure
    .input(z.object({ crdts: z.string(), excludeCode: z.string().optional() }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db || !input.crdts.trim()) return { conflict: false as const };
      const { workforceAgents } = await import("../drizzle/schema");
      const { sql } = await import("drizzle-orm");
      const rows = await db.select({ id: workforceAgents.id, traineeCode: workforceAgents.traineeCode, fullName: workforceAgents.fullName, alias: workforceAgents.alias, agentStatus: workforceAgents.agentStatus }).from(workforceAgents).where(sql`${workforceAgents.crdts} = ${input.crdts.trim()}`);
      const holder = rows.find(r => r.traineeCode !== input.excludeCode);
      if (!holder) return { conflict: false as const };
      const inactive = holder.agentStatus === "resigned" || holder.agentStatus === "terminated";
      return { conflict: true as const, inactive, holder };
    }),
  listArchive: protectedProcedure.query(async () => {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return [];
    const { crdtsArchive } = await import("../drizzle/schema");
    const { desc } = await import("drizzle-orm");
    return db.select().from(crdtsArchive).orderBy(desc(crdtsArchive.archivedAt));
  }),
  // Record a handover on override, then clear CRDTS off the previous holder so it
  // points to the new agent going forward. Previous agent's records are untouched.
  archiveHandover: protectedProcedure
    .input(z.object({ crdts: z.string(), previousCode: z.string().optional(), newCode: z.string().optional(), archivedBy: z.string().optional() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { sql, eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { workforceAgents, crdtsArchive } = await import("../drizzle/schema");
      const prevRows = input.previousCode
        ? await db.select().from(workforceAgents).where(eq(workforceAgents.traineeCode, input.previousCode)).limit(1)
        : await db.select().from(workforceAgents).where(sql`${workforceAgents.crdts} = ${input.crdts}`).limit(1);
      const prev = prevRows[0] || null;
      const nextRows = input.newCode ? await db.select().from(workforceAgents).where(eq(workforceAgents.traineeCode, input.newCode)).limit(1) : [];
      const next = nextRows[0] || null;
      await db.insert(crdtsArchive).values({
        crdts: input.crdts,
        previousAgentId: prev?.id ?? null,
        previousAgentCode: prev?.traineeCode ?? input.previousCode ?? null,
        previousAgentName: prev?.fullName ?? null,
        previousAgentAlias: prev?.alias ?? null,
        previousStatus: prev?.agentStatus ?? null,
        newAgentId: next?.id ?? null,
        newAgentCode: next?.traineeCode ?? input.newCode ?? null,
        newAgentName: next?.fullName ?? null,
        archivedBy: input.archivedBy ?? null,
        archivedAt: Date.now(),
      });
      if (prev?.traineeCode) {
        await db.update(workforceAgents).set({ crdts: null }).where(eq(workforceAgents.traineeCode, prev.traineeCode));
      }
      return { ok: true };
    }),
});


// ═══ LEAVE MANAGEMENT — casual (عارضة) / annual (اعتيادية) ═══
const leaveRouter = router({
  // Agent: submit a request (no type — HR classifies on decision). Balances are hidden from agents.
  request: publicProcedure
    .input(z.object({ traineeCode: z.string(), startDate: z.string(), endDate: z.string(), days: z.number().min(1), reason: z.string().optional() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { leaveRequests } = await import("../drizzle/schema");
      await db.insert(leaveRequests).values({ ...input, status: "pending", createdAt: Date.now() });
      return { ok: true };
    }),
  myRequests: publicProcedure
    .input(z.object({ traineeCode: z.string() }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return [];
      const { leaveRequests } = await import("../drizzle/schema");
      const { eq, desc } = await import("drizzle-orm");
      return db.select().from(leaveRequests).where(eq(leaveRequests.traineeCode, input.traineeCode)).orderBy(desc(leaveRequests.createdAt));
    }),
  listRequests: protectedProcedure
    .input(z.object({ status: z.enum(["pending", "approved", "rejected"]).optional() }).optional())
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return [];
      const { leaveRequests } = await import("../drizzle/schema");
      const { eq, desc } = await import("drizzle-orm");
      if (input?.status) return db.select().from(leaveRequests).where(eq(leaveRequests.status, input.status)).orderBy(desc(leaveRequests.createdAt));
      return db.select().from(leaveRequests).orderBy(desc(leaveRequests.createdAt));
    }),
  // HR decides: classify the type + approve/reject. Approval increments the used counter.
  decide: protectedProcedure
    .input(z.object({ id: z.number(), status: z.enum(["approved", "rejected"]), leaveType: z.enum(["casual", "annual"]).optional() }))
    .mutation(async ({ input, ctx }) => {
      const { getDb } = await import("./db");
      const { eq, and, sql } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { leaveRequests, leaveBalances } = await import("../drizzle/schema");
      if (input.status === "approved" && !input.leaveType) throw new TRPCError({ code: "BAD_REQUEST", message: "Pick the leave type (casual/annual) before approving" });
      const rows = await db.select().from(leaveRequests).where(eq(leaveRequests.id, input.id)).limit(1);
      const req = rows[0];
      if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "Request not found" });
      await db.update(leaveRequests).set({ status: input.status, leaveType: input.leaveType ?? null, decidedBy: ctx.user?.name ?? "admin", decidedAt: Date.now() }).where(eq(leaveRequests.id, input.id));
      if (input.status === "approved" && input.leaveType) {
        const year = String(new Date().getFullYear());
        const bal = await db.select().from(leaveBalances).where(and(eq(leaveBalances.traineeCode, req.traineeCode), eq(leaveBalances.year, Number(year)))).limit(1);
        if (bal[0]) {
          const field = input.leaveType === "casual" ? { casualUsed: sql`${leaveBalances.casualUsed} + ${req.days}` } : { annualUsed: sql`${leaveBalances.annualUsed} + ${req.days}` };
          await db.update(leaveBalances).set({ ...field, updatedAt: Date.now() }).where(eq(leaveBalances.id, bal[0].id));
        } else {
          await db.insert(leaveBalances).values({ traineeCode: req.traineeCode, year: Number(year), casualTotal: 0, annualTotal: 0, casualUsed: input.leaveType === "casual" ? req.days : 0, annualUsed: input.leaveType === "annual" ? req.days : 0, updatedAt: Date.now() });
        }
      }
      return { ok: true };
    }),
  listBalances: protectedProcedure
    .input(z.object({ year: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return [];
      const { leaveBalances } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const y = input?.year ?? new Date().getFullYear();
      return db.select().from(leaveBalances).where(eq(leaveBalances.year, y));
    }),
  // Admin: mass-add balances to ALL active agents (adds on top of existing totals)
  massAdd: protectedProcedure
    .input(z.object({ casual: z.number().min(0), annual: z.number().min(0) }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq, and, sql, notInArray } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { leaveBalances, workforceAgents } = await import("../drizzle/schema");
      const year = new Date().getFullYear();
      const agents = await db.select({ traineeCode: workforceAgents.traineeCode }).from(workforceAgents)
        .where(notInArray(workforceAgents.agentStatus, ["resigned", "terminated", "blacklisted"]));
      let created = 0, updated = 0;
      for (const a of agents) {
        if (!a.traineeCode) continue;
        const ex = await db.select().from(leaveBalances).where(and(eq(leaveBalances.traineeCode, a.traineeCode), eq(leaveBalances.year, year))).limit(1);
        if (ex[0]) { await db.update(leaveBalances).set({ casualTotal: sql`${leaveBalances.casualTotal} + ${input.casual}`, annualTotal: sql`${leaveBalances.annualTotal} + ${input.annual}`, updatedAt: Date.now() }).where(eq(leaveBalances.id, ex[0].id)); updated++; }
        else { await db.insert(leaveBalances).values({ traineeCode: a.traineeCode, year, casualTotal: input.casual, annualTotal: input.annual, casualUsed: 0, annualUsed: 0, updatedAt: Date.now() }); created++; }
      }
      return { ok: true, created, updated };
    }),
});

// ═══ EXIT PROCESS — required checklist before an agent is archived ═══
const exitRouter = router({
  get: protectedProcedure
    .input(z.object({ traineeCode: z.string() }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return null;
      const { exitProcess } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const rows = await db.select().from(exitProcess).where(eq(exitProcess.traineeCode, input.traineeCode)).limit(1);
      return rows[0] ?? null;
    }),
  // List all agents settled but not yet archived (exit checklist pending)
  pendingChecklist: protectedProcedure.query(async () => {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return [];
    const { workforceAgents, exitProcess } = await import("../drizzle/schema");
    const { inArray } = await import("drizzle-orm");
    const agents = await db.select({
      traineeCode: workforceAgents.traineeCode,
      fullName: workforceAgents.fullName,
      agentStatus: workforceAgents.agentStatus,
      salarySettled: workforceAgents.salarySettled,
      crdts: workforceAgents.crdts,
    }).from(workforceAgents)
      .where(inArray(workforceAgents.agentStatus, ["resigned", "terminated"]));
    if (!agents.length) return [];
    const settled = agents.filter(a => a.salarySettled);
    if (!settled.length) return [];
    const codes = settled.map(a => a.traineeCode);
    const eps = await db.select().from(exitProcess).where(inArray(exitProcess.traineeCode, codes));
    const epMap = new Map(eps.map(e => [e.traineeCode, e]));
    return settled
      .filter(a => {
        const ep = epMap.get(a.traineeCode);
        return !ep || !ep.completedAt;
      })
      .map(a => ({ ...a, exitProcess: epMap.get(a.traineeCode) ?? null }));
  }),
  // List all agents pending settlement (separated but not yet salary-settled)
  pendingSettlement: protectedProcedure.query(async () => {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return [];
    const { workforceAgents, exitProcess } = await import("../drizzle/schema");
    const { eq, inArray, or, isNull } = await import("drizzle-orm");
    const agents = await db.select({
      traineeCode: workforceAgents.traineeCode,
      fullName: workforceAgents.fullName,
      agentStatus: workforceAgents.agentStatus,
      salarySettled: workforceAgents.salarySettled,
    }).from(workforceAgents)
      .where(inArray(workforceAgents.agentStatus, ["resigned", "terminated"]));
    if (!agents.length) return [];
    const codes = agents.map(a => a.traineeCode);
    const eps = await db.select().from(exitProcess).where(inArray(exitProcess.traineeCode, codes));
    const epMap = new Map(eps.map(e => [e.traineeCode, e]));
    return agents
      .filter(a => !a.salarySettled)
      .map(a => ({ ...a, exitProcess: epMap.get(a.traineeCode) ?? null }));
  }),
  // Mark salary settled (BEFORE checklist — step 2 in lifecycle)
  markSettled: protectedProcedure
    .input(z.object({ traineeCode: z.string(), settled: z.boolean() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { workforceAgents, exitProcess } = await import("../drizzle/schema");
      await db.update(workforceAgents).set({ salarySettled: input.settled }).where(eq(workforceAgents.traineeCode, input.traineeCode));
      // Mirror into exit_process.settlementDone for the checklist display
      await db.update(exitProcess).set({ settlementDone: input.settled, updatedAt: Date.now() }).where(eq(exitProcess.traineeCode, input.traineeCode));
      return { ok: true };
    }),
  upsert: protectedProcedure
    .input(z.object({
      traineeCode: z.string(),
      exitType: z.enum(["resignation", "termination", "contract_end"]).optional(),
      exitInterview: z.boolean().optional(), clearance: z.boolean().optional(),
      assetsReturned: z.boolean().optional(), lastWorkingDay: z.string().optional(),
      settlementDone: z.boolean().optional(), notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { exitProcess } = await import("../drizzle/schema");
      const { traineeCode, ...rest } = input;
      const now = Date.now();
      const ex = await db.select().from(exitProcess).where(eq(exitProcess.traineeCode, traineeCode)).limit(1);
      if (ex[0]) await db.update(exitProcess).set({ ...rest, updatedAt: now }).where(eq(exitProcess.traineeCode, traineeCode));
      else await db.insert(exitProcess).values({ traineeCode, ...rest, updatedAt: now });
      return { ok: true };
    }),
  // Archive: requires salary settled AND checklist complete (interview, clearance, assets, last day)
  archive: protectedProcedure
    .input(z.object({ traineeCode: z.string() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { exitProcess, workforceAgents, candidates } = await import("../drizzle/schema");
      const rows = await db.select().from(exitProcess).where(eq(exitProcess.traineeCode, input.traineeCode)).limit(1);
      const ep = rows[0];
      if (!ep?.settlementDone) throw new TRPCError({ code: "BAD_REQUEST", message: "Salary must be settled before archiving." });
      const checklistComplete = ep.exitType && ep.exitInterview && ep.clearance && ep.assetsReturned && ep.lastWorkingDay;
      if (!checklistComplete) throw new TRPCError({ code: "BAD_REQUEST", message: "Exit checklist incomplete — finish all items (type, interview, clearance, assets, last day) before archiving." });
      await db.update(exitProcess).set({ completedAt: Date.now(), updatedAt: Date.now() }).where(eq(exitProcess.traineeCode, input.traineeCode));
      // Mark agent as archived in workforce (keep row, just mark completedAt)
      const ag = (await db.select().from(workforceAgents).where(eq(workforceAgents.traineeCode, input.traineeCode)).limit(1))[0];
      if (ag?.candidateId) {
        try { await db.update(candidates).set({ status: ag.agentStatus as "resigned" | "terminated" }).where(eq(candidates.id, ag.candidateId)); } catch (_) {}
      }
      return { ok: true };
    }),
  // Legacy alias kept for backward compat with any existing UI calls
  settleAndArchive: protectedProcedure
    .input(z.object({ traineeCode: z.string() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { exitProcess, workforceAgents } = await import("../drizzle/schema");
      // Mark settled first
      await db.update(workforceAgents).set({ salarySettled: true }).where(eq(workforceAgents.traineeCode, input.traineeCode));
      await db.update(exitProcess).set({ settlementDone: true, updatedAt: Date.now() }).where(eq(exitProcess.traineeCode, input.traineeCode));
      // Then archive if checklist complete
      const rows = await db.select().from(exitProcess).where(eq(exitProcess.traineeCode, input.traineeCode)).limit(1);
      const ep = rows[0];
      const checklistComplete = ep && ep.exitType && ep.exitInterview && ep.clearance && ep.assetsReturned && ep.lastWorkingDay;
      if (checklistComplete) {
        await db.update(exitProcess).set({ completedAt: Date.now(), updatedAt: Date.now() }).where(eq(exitProcess.traineeCode, input.traineeCode));
      }
      return { ok: true };
    }),
});

export const appRouter = router({
  auth: authRouter,
  candidates: candidatesRouter,
  notes: notesRouter,
  interviews: interviewsRouter,
  activity: activityRouter,
  dashboard: dashboardRouter,
  batches: batchesRouter,
  system: systemRouter,
  agent: agentRouter,
  requests: requestsRouter,
  adminAuth: adminAuthRouter,
  referrals: referralsRouter,
  notifications: notificationsRouter,
  campaigns: campaignsRouter,
  workforce: workforceRouter,
  paymentMethods: paymentMethodsRouter,
  agentComments: agentCommentsRouter,
  documents: documentsRouter,
  scheduleChange: scheduleChangeRouter,
  overtime: overtimeRouter,
  breakSchedule: breakScheduleRouter,
  separation: separationRouter,
  payrollV2: payrollV2Router,
  orientation: orientationRouter,
  violations: violationsRouter,
  ot: otRouter,
  employees: employeesRouter,
  performanceV2: performanceV2Router,
  adherence: adherenceRouter,
  quality: qualityRouter,
  cycleTracker: cycleTrackerRouter,
  coaching: coachingRouter,
  coachingCases: coachingCasesRouter,
  settings: settingsRouter,
  hubspot: hubspotRouter,
  integrations: integrationsRouter,
  commission: commissionRouter,
  adjustments: adjustmentsRouter,
  trainerSalaries: trainerSalariesRouter,
  invites: invitesRouter,
  apiKeys: apiKeysRouter,
  bd: bdRouter,
  crdtsArchive: crdtsArchiveRouter,
  hr: hrRouter,
  leave: leaveRouter,
  exit: exitRouter,
});
export type AppRouter = typeof appRouter;

