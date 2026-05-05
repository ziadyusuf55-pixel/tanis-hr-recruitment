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
  getCandidateById,
  getCandidatesAddedSince,
  getInterviewsScheduledSince,
  getPipelineCounts,
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
  getPayrollByCandidateId,
  upsertPayrollRecord,
  deletePayrollRecord,
  getPerformanceByCandidateId,
  upsertPerformanceRecord,
  deletePerformanceRecord,
  createAgentRequest,
  listAgentRequestsByCandidate,
  listAllAgentRequests,
  updateAgentRequestStatus,
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
]);

const authRouter = router({
  me: publicProcedure.query((opts) => opts.ctx.user),
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
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

        const [newCandidates, scheduledInterviews, pipelineCounts, avgTimeToHire] =
          await Promise.all([
            getCandidatesAddedSince(sinceMs),
            getInterviewsScheduledSince(sinceMs),
            getPipelineCounts(period),
            getAvgTimeToHire(sinceMs),
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
        };
      }),
});

/// ─── Agent Portal Router ─────────────────────────────────────────────────────
const AGENT_COOKIE = "tanis_agent_session";
// Helper: parse a named cookie from req.headers.cookie (no cookie-parser needed)
function getAgentCookieFromReq(req: { headers: { cookie?: string } }): string | undefined {
  if (!req.headers.cookie) return undefined;
  const parsed = parseCookieHeader(req.headers.cookie);
  return parsed[AGENT_COOKIE];
}
function generatePassword(traineeCode: string): string {
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `${traineeCode}-${digits}`;
}

const agentRouter = router({
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
      return { exists: !!cred, traineeCode: cred?.traineeCode ?? null };
    }),

  // Agent login — public procedure (no admin auth needed)
  login: publicProcedure
    .input(z.object({ traineeCode: z.string().min(1), password: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
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
      return { success: true, traineeCode: cred.traineeCode, candidateId: cred.candidateId };
    }),

  // Reset agent password — admin only, generates a new random password
  resetPassword: protectedProcedure
    .input(z.object({ candidateId: z.number() }))
    .mutation(async ({ input }) => {
      const cred = await getAgentCredentialByCandidateId(input.candidateId);
      if (!cred) throw new TRPCError({ code: "NOT_FOUND", message: "No credentials found for this agent" });
      const newPassword = generatePassword(cred.traineeCode);
      const passwordHash = await bcrypt.hash(newPassword, 10);
      await upsertAgentCredential(input.candidateId, cred.traineeCode, passwordHash);
      return { traineeCode: cred.traineeCode, password: newPassword };
    }),
  // Agent logout
  logout: publicProcedure.mutation(async ({ ctx }) => {
    ctx.res.clearCookie(AGENT_COOKIE, { path: "/" });
    return { success: true };
  }),

  // Get current agent session info (from cookie)
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
      await upsertPayrollRecord(input);
      return { success: true };
    }),

  deletePayroll: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deletePayrollRecord(input.id);
      return { success: true };
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
      type: z.enum(["leave", "salary", "schedule", "complaint", "resignation", "day_off", "sick_note", "hr_letter", "other"]),
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
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Account already exists" });
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
      // For each agent, find their candidateId and send a notification
      for (const agent of agents) {
        await createAgentNotification({
          candidateId: agent.candidateId,
          message: input.message ?? `Overtime needed on ${input.date}. Are you available? Please respond in the portal.`,
          type: "general",
          relatedId: null,
        });
      }
      return { sent: agents.length };
    }),

  getOvertimeResponses: protectedProcedure
    .input(z.object({ campaignId: z.number(), date: z.string() }))
    .query(({ input }) => getOvertimeAvailabilityForDate(input.campaignId, input.date)),
  // Dynamic operation plan: 7-day grid (Mon-Sun) showing each agent's work/off status
  getOperationPlan: publicProcedure
    .input(z.object({ campaignId: z.number(), weekOffset: z.number().int().optional() }))
    .query(async ({ input }) => {
      const agents = await listWorkforceAgents(input.campaignId);
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
  list: protectedProcedure
    .input(z.object({ campaignId: z.number().optional() }))
    .query(({ input }) => listWorkforceAgents(input.campaignId)),

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
    }))
    .mutation(async ({ input }) => {
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
    const code = getAgentCookieFromReq(ctx.req);
    if (!code) return null;
    return getWorkforceAgentByCode(code);
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
      return { agent, documents, paymentMethods, comments };
    }),
});
// ─── Agent Comments Router ────────────────────────────────────────────────────
const agentCommentsRouter = router({
  listByCode: protectedProcedure
    .input(z.object({ traineeCode: z.string() }))
    .query(({ input }) => getCommentsByCode(input.traineeCode)),
  listMine: publicProcedure.query(({ ctx }) => {
    const code = getAgentCookieFromReq(ctx.req);
    if (!code) return [];
    return getCommentsByCode(code);
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
    const code = getAgentCookieFromReq(ctx.req);
    if (!code) return [];
    return getPaymentMethodsByCode(code);
  }),

  listAll: protectedProcedure.query(() => listAllPaymentMethods()),

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
      const code = getAgentCookieFromReq(ctx.req);
      if (!code) throw new TRPCError({ code: "UNAUTHORIZED" });
      return upsertPaymentMethod({ ...input, traineeCode: code });
    }),

  setPreferred: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => {
      const code = getAgentCookieFromReq(ctx.req);
      if (!code) throw new TRPCError({ code: "UNAUTHORIZED" });
      return setPaymentMethodPreferred(input.id, code);
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => {
      const code = getAgentCookieFromReq(ctx.req);
      if (!code) throw new TRPCError({ code: "UNAUTHORIZED" });
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
    const code = getAgentCookieFromReq(ctx.req);
    if (!code) return [];
    return getDocumentsByCode(code);
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
      const code = getAgentCookieFromReq(ctx.req);
      if (!code) throw new TRPCError({ code: "UNAUTHORIZED" });
      return upsertAgentDocument({ ...input, traineeCode: code });
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
      const code = getAgentCookieFromReq(ctx.req);
      if (!code) throw new TRPCError({ code: "UNAUTHORIZED" });
      const { storagePut } = await import("./storage");
      const buf = Buffer.from(input.fileBase64, "base64");
      const ext = input.fileName.split(".").pop() ?? "bin";
      const key = `agent-docs/${code}/${input.docType}-${Date.now()}.${ext}`;
      const { url } = await storagePut(key, buf, input.mimeType);
      await upsertAgentDocument({ id: input.id, traineeCode: code, docType: input.docType, fileUrl: url, fileName: input.fileName });
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
      const code = getAgentCookieFromReq(ctx.req);
      if (!code) throw new TRPCError({ code: "UNAUTHORIZED" });
      await createScheduleChangeRequest({ ...input, requesterCode: code });
      // Notify target agent
      const target = await getWorkforceAgentByCode(input.targetCode);
      if (target) {
        await createAgentNotification({
          candidateId: target.candidateId,
          message: `${code} has requested a schedule swap with you. Please review in the portal.`,
          type: "general",
          relatedId: null,
        });
      }
      return { success: true };
    }),

  listMine: publicProcedure.query(({ ctx }) => {
    const code = getAgentCookieFromReq(ctx.req);
    if (!code) return [];
    return listScheduleChangeRequestsByCode(code);
  }),

  listAll: protectedProcedure.query(() => listAllScheduleChangeRequests()),

  peerApprove: publicProcedure
    .input(z.object({ id: z.number(), approve: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const code = getAgentCookieFromReq(ctx.req);
      if (!code) throw new TRPCError({ code: "UNAUTHORIZED" });
      if (input.approve) {
        await updateScheduleChangeRequest(input.id, {
          status: "pending_manager",
          peerApprovedAt: Date.now(),
        });
      } else {
        await updateScheduleChangeRequest(input.id, { status: "rejected" });
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
      const code = getAgentCookieFromReq(ctx.req);
      if (!code) throw new TRPCError({ code: "UNAUTHORIZED" });
      return upsertOvertimeAvailability({ ...input, traineeCode: code });
    }),

  getResponses: protectedProcedure
    .input(z.object({ campaignId: z.number(), date: z.string() }))
    .query(({ input }) => getOvertimeAvailabilityForDate(input.campaignId, input.date)),
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
});
export type AppRouter = typeof appRouter;;

