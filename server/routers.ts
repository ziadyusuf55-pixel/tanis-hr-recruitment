import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  addStageNote,
  bulkInsertCandidates,
  createCandidate,
  createInterview,
  deleteCandidate,
  getAvgTimeToHire,
  getCandidateById,
  getCandidatesAddedSince,
  getInterviewsScheduledSince,
  getPipelineCounts,
  listCandidates,
  listInterviewsByCandidateId,
  listNotesByCandidateId,
  markInterviewNotificationSent,
  updateCandidate,
  updateCandidateStatus,
} from "./db";
import { sendInterviewNotification } from "./email";

const PIPELINE_STAGES_ZOD = z.enum([
  "applied",
  "whatsapp_sent",
  "voice_note_reviewed",
  "interview_scheduled",
  "accepted",
  "teams_invitation_sent",
  "rejected",
]);

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Candidates ─────────────────────────────────────────────────────────────
  candidates: router({
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
        })
      )
      .mutation(({ input }) => createCandidate(input)),

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
        })
      )
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updateCandidate(id, data);
      }),

    updateStatus: protectedProcedure
      .input(z.object({ id: z.number(), status: PIPELINE_STAGES_ZOD }))
      .mutation(({ input }) => updateCandidateStatus(input.id, input.status)),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteCandidate(input.id)),

    bulkImport: protectedProcedure
      .input(
        z.array(
          z.object({
            name: z.string().min(1),
            email: z.string().email().optional(),
            phone: z.string().optional(),
            positionApplied: z.string().optional(),
            resumeLink: z.string().optional(),
            notes: z.string().optional(),
          })
        )
      )
      .mutation(({ input }) => bulkInsertCandidates(input)),
  }),

  // ─── Stage Notes ─────────────────────────────────────────────────────────────
  notes: router({
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
  }),

  // ─── Interviews ──────────────────────────────────────────────────────────────
  interviews: router({
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
  }),

  // ─── Dashboard KPIs ──────────────────────────────────────────────────────────
  dashboard: router({
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
        const teamsCount = pipelineCounts.find((p) => p.status === "teams_invitation_sent")?.count ?? 0;
        const rejectedCount = pipelineCounts.find((p) => p.status === "rejected")?.count ?? 0;

        // Conversion rate: Applied → Accepted (of all non-rejected)
        const activeTotal = totalInPipeline - rejectedCount;
        const conversionRate = activeTotal > 0 ? Math.round((acceptedCount + teamsCount) / activeTotal * 100) : 0;

        // WhatsApp response rate: whatsapp_sent+ / applied+
        const respondedToWhatsApp = whatsappCount + voiceNoteCount + interviewCount + acceptedCount + teamsCount + rejectedCount;
        const whatsappResponseRate = newCandidates > 0 ? Math.round(respondedToWhatsApp / Math.max(newCandidates, 1) * 100) : 0;

        // Voice note pass rate
        const voiceNotePassRate = whatsappCount > 0
          ? Math.round((voiceNoteCount + interviewCount + acceptedCount + teamsCount) / Math.max(whatsappCount + voiceNoteCount + interviewCount + acceptedCount + teamsCount, 1) * 100)
          : 0;

        // Interview show rate (those who reached interview stage)
        const interviewShowRate = voiceNoteCount > 0
          ? Math.round((interviewCount + acceptedCount + teamsCount) / Math.max(voiceNoteCount + interviewCount + acceptedCount + teamsCount, 1) * 100)
          : 0;

        return {
          // Top cards
          totalInPipeline,
          newCandidates,
          teamsInvitationsSent: teamsCount,
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
            voice_note_reviewed: voiceNoteCount,
            interview_scheduled: interviewCount,
            accepted: acceptedCount,
            teams_invitation_sent: teamsCount,
            rejected: rejectedCount,
          },
          // Scheduled interviews
          scheduledInterviews,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
