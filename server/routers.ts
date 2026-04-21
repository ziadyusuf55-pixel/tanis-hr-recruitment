import { COOKIE_NAME } from "@shared/const";
import bcrypt from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
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
} from "./db";
import { sendInterviewNotification } from "./email";
import { ENV } from "./_core/env";
import jwt from "jsonwebtoken";

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

  allAssignments: protectedProcedure
    .query(() => getAllBatchAssignments()),
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
        // no_answer is tracked via subStatus field, count separately
        const noAnswerCount = await getNoAnswerCount();
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

// ─── Agent Portal Router ─────────────────────────────────────────────────────

const AGENT_COOKIE = "tanis_agent_session";

function generatePassword(traineeCode: string): string {
  // Auto-generate: traineeCode + 4 random digits, e.g. TN0042-2847
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
      const cred = await getAgentCredentialByTraineeCode(input.traineeCode);
      if (!cred) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid Trainee ID or password" });
      const valid = await bcrypt.compare(input.password, cred.passwordHash);
      if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid Trainee ID or password" });
      // Create a signed JWT for the agent session
      const token = jwt.sign(
        { candidateId: cred.candidateId, traineeCode: cred.traineeCode, type: "agent" },
        ENV.cookieSecret,
        { expiresIn: "30d" }
      );
      ctx.res.cookie(AGENT_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: "/",
      });
      return { success: true, traineeCode: cred.traineeCode, candidateId: cred.candidateId };
    }),

  // Agent logout
  logout: publicProcedure.mutation(async ({ ctx }) => {
    ctx.res.clearCookie(AGENT_COOKIE, { path: "/" });
    return { success: true };
  }),

  // Get current agent session info (from cookie)
  me: publicProcedure.query(async ({ ctx }) => {
    const token = ctx.req.cookies?.[AGENT_COOKIE];
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
          attendedSessions: (myEntry as Record<string, unknown>)?.attendedSessions ?? null,
          totalSessions: (myEntry as Record<string, unknown>)?.totalSessions ?? null,
          trainerNotes: (myEntry as Record<string, unknown>)?.trainerNotes ?? null,
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
      const agentToken = ctx.req.cookies?.[AGENT_COOKIE];
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
      const agentToken = ctx.req.cookies?.[AGENT_COOKIE];
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
});

export type AppRouter = typeof appRouter;

