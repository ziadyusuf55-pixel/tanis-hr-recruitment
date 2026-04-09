import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  listJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  listCandidates,
  getCandidateById,
  createCandidate,
  updateCandidate,
  deleteCandidate,
  bulkCreateCandidates,
  getPipelineCounts,
  listInterviewsByCandidateId,
  createInterview,
  updateInterview,
  deleteInterview,
} from "./db";
import { PIPELINE_STAGES } from "../drizzle/schema";
import { sendInterviewNotification } from "./email";

// ─── Shared Validators ────────────────────────────────────────────────────────

const pipelineStageSchema = z.enum(PIPELINE_STAGES);

const jobInputSchema = z.object({
  title: z.string().min(1),
  department: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["open", "closed", "paused"]).optional(),
});

const candidateInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  positionApplied: z.string().min(1),
  jobId: z.number().optional(),
  resumeLink: z.string().optional(),
  notes: z.string().optional(),
  status: pipelineStageSchema.optional(),
});

const interviewInputSchema = z.object({
  candidateId: z.number(),
  scheduledAt: z.number(), // UTC ms
  location: z.string().optional(),
  interviewerName: z.string().optional(),
  notes: z.string().optional(),
});

// ─── App Router ───────────────────────────────────────────────────────────────

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

  // ─── Dashboard ──────────────────────────────────────────────────────────────
  dashboard: router({
    pipelineCounts: protectedProcedure.query(async () => {
      const counts = await getPipelineCounts();
      // Ensure all stages are represented even if count is 0
      const map: Record<string, number> = {};
      for (const row of counts) {
        map[row.status] = row.count;
      }
      return PIPELINE_STAGES.map((stage) => ({
        stage,
        count: map[stage] ?? 0,
      }));
    }),
  }),

  // ─── Jobs ────────────────────────────────────────────────────────────────────
  jobs: router({
    list: protectedProcedure.query(() => listJobs()),

    byId: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getJobById(input.id)),

    create: protectedProcedure
      .input(jobInputSchema)
      .mutation(({ input }) => createJob(input)),

    update: protectedProcedure
      .input(z.object({ id: z.number(), data: jobInputSchema.partial() }))
      .mutation(({ input }) => updateJob(input.id, input.data)),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteJob(input.id)),
  }),

  // ─── Candidates ──────────────────────────────────────────────────────────────
  candidates: router({
    list: protectedProcedure
      .input(
        z
          .object({
            status: pipelineStageSchema.optional(),
            jobId: z.number().optional(),
          })
          .optional()
      )
      .query(({ input }) => listCandidates(input)),

    byId: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getCandidateById(input.id)),

    create: protectedProcedure
      .input(candidateInputSchema)
      .mutation(({ input }) => createCandidate(input)),

    update: protectedProcedure
      .input(z.object({ id: z.number(), data: candidateInputSchema.partial() }))
      .mutation(({ input }) => updateCandidate(input.id, input.data)),

    updateStatus: protectedProcedure
      .input(z.object({ id: z.number(), status: pipelineStageSchema }))
      .mutation(({ input }) => updateCandidate(input.id, { status: input.status })),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteCandidate(input.id)),

    bulkImport: protectedProcedure
      .input(
        z.array(
          z.object({
            name: z.string().min(1),
            email: z.string().email(),
            phone: z.string().optional(),
            positionApplied: z.string().min(1),
            resumeLink: z.string().optional(),
            notes: z.string().optional(),
          })
        )
      )
      .mutation(({ input }) => bulkCreateCandidates(input)),
  }),

  // ─── Interviews ───────────────────────────────────────────────────────────────
  interviews: router({
    byCandidateId: protectedProcedure
      .input(z.object({ candidateId: z.number() }))
      .query(({ input }) => listInterviewsByCandidateId(input.candidateId)),

    schedule: protectedProcedure
      .input(
        interviewInputSchema.extend({
          recruiterEmail: z.string().email(),
          recruiterName: z.string().optional(),
          candidateName: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const { recruiterEmail, recruiterName, candidateName, ...interviewData } = input;
        const interview = await createInterview({ ...interviewData, notificationSent: 0 });

        // Send email notification to recruiter
        if (interview) {
          try {
            await sendInterviewNotification({
              recruiterEmail,
              recruiterName: recruiterName ?? "Recruiter",
              candidateName,
              scheduledAt: input.scheduledAt,
              location: input.location,
              interviewerName: input.interviewerName,
              notes: input.notes,
            });
            await updateInterview(interview.id, { notificationSent: 1 });
          } catch (err) {
            console.error("[Email] Failed to send interview notification:", err);
          }
        }

        return interview;
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          data: interviewInputSchema.partial(),
        })
      )
      .mutation(({ input }) => updateInterview(input.id, input.data)),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteInterview(input.id)),
  }),
});

export type AppRouter = typeof appRouter;
