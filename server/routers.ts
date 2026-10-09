import { COOKIE_NAME, AUX_TYPES } from "@shared/const";
import { finalPay as calcFinalPay, remainingOwed, validatePayrollRow } from "@shared/pay";
import { and, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { parse as parseCookieHeader } from "cookie";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { staffProcedure, protectedProcedure, adminProcedure, roleProcedure, agentProcedure, agentOrStaffProcedure, publicProcedure, router, isStaff, isFullAccess, canSeeMoney } from "./_core/trpc";

// ─── PII / money redaction ────────────────────────────────────────────────────
// Identity and pay data leaves the server only for MONEY_ROLES (owner/admin/manager/hr/finance).
// Other staff (ops_manager, team_lead, bd) get the operational fields with these nulled.
const SENSITIVE_AGENT_FIELDS = [
  "nationalId", "nationalIdExpiry", "dateOfBirth", "address",
  "emergencyContactName", "emergencyContactPhone", "emergencyContactRelation",
  "dialerCredentials",
] as const;
function redactAgentRow<T extends Record<string, unknown>>(row: T, role?: string | null): T {
  if (canSeeMoney(role)) return row;
  const copy: Record<string, unknown> = { ...row };
  for (const k of SENSITIVE_AGENT_FIELDS) if (k in copy) copy[k] = null;
  return copy as T;
}
function redactAgentRows<T extends Record<string, unknown>>(rows: T[], role?: string | null): T[] {
  if (canSeeMoney(role)) return rows;
  return rows.map(r => redactAgentRow(r, role));
}
import { requireAgent, invalidateAgentSessionCache } from "./_core/agentAuth";
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
  getReferralById,
  // Request unread tracking
  countUnreadAgentRequests,
  markAllAgentRequestsRead,
  // Notifications
  createAgentNotification,
  getNotificationsByCandidate,
  markNotificationsRead,
  countUnreadNotifications,
  // Clients
  listClients,
  createClient,
  updateClient,
  assignCampaignToClient,
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
  // Quality
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
  getPendingDeletionAgents,
  getNextAvailableTraineeCode,
  revokeAgentSessions,
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
  listAppUsers: staffProcedure.query(async ({ ctx }) => {
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
  setUserRole: staffProcedure
    .input(z.object({ openId: z.string(), role: z.enum(["owner", "admin", "manager", "hr", "ops_manager", "team_lead", "finance", "bd", "viewer", "user"]) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin" && ctx.user?.role !== "owner") throw new TRPCError({ code: "FORBIDDEN" });
      // Only an owner may create another owner, and only an owner may change an owner's role.
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { users } = await import("../drizzle/schema");
      const [target] = await db.select({ role: users.role, email: users.email }).from(users).where(eq(users.openId, input.openId)).limit(1);
      if ((input.role === "owner" || target?.role === "owner") && ctx.user?.role !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only an owner can grant or change the owner role." });
      }
      if (input.openId === ctx.user?.openId && input.role !== "owner" && input.role !== "admin") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You can't remove your own full access. Ask another owner to change your role." });
      }
      await db.update(users).set({ role: input.role }).where(eq(users.openId, input.openId));
      await auditEntry(ctx.user, "set_user_role", "user", input.openId, JSON.stringify({ from: target?.role ?? null, to: input.role, email: target?.email ?? null }));
      return { ok: true } as const;
    }),

  removeUser: staffProcedure
    .input(z.object({ openId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "owner" && ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      if (ctx.user?.openId === input.openId) throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot remove yourself." });
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { users, bdUsers } = await import("../drizzle/schema");
      const { users: _ruUsers } = await import("../drizzle/schema");
      const [_ruTarget] = await db.select({ role: _ruUsers.role, email: _ruUsers.email }).from(_ruUsers).where(eq(_ruUsers.openId, input.openId)).limit(1);
      if (_ruTarget?.role === "owner" && ctx.user?.role !== "owner") throw new TRPCError({ code: "FORBIDDEN", message: "Only an owner can remove an owner." });
      // Set to "viewer" (no access) — preserves login history and audit trail.
      // Also deactivate any bd_users row so a re-linked openId cannot re-elevate
      // the demoted account back to "bd" role on next request.
      await db.update(users).set({ role: "viewer" }).where(eq(users.openId, input.openId));
      await db.update(bdUsers).set({ active: false }).where(eq(bdUsers.openId!, input.openId));
      await auditEntry(ctx.user, "remove_user", "user", input.openId, JSON.stringify({ hadRole: _ruTarget?.role ?? null, email: _ruTarget?.email ?? null }));
      return { ok: true } as const;
    }),
});


const batchesRouter = router({
    list: staffProcedure.query(() => listBatches()),

    get: staffProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getBatchById(input.id)),

    create: staffProcedure
      .input(z.object({
        name: z.string().min(1),
        trainerName: z.string().optional(),
        startDate: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(({ input }) => createBatch(input)),

    update: staffProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        trainerName: z.string().nullable().optional(),
        startDate: z.number().nullable().optional(),
        notes: z.string().nullable().optional(),
      }))
      .mutation(({ input: { id, ...data } }) => updateBatch(id, data)),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteBatch(input.id)),

    listCandidates: staffProcedure
      .input(z.object({ batchId: z.number() }))
      .query(({ input }) => listCandidatesInBatch(input.batchId)),

    assignCandidate: staffProcedure
      .input(z.object({ batchId: z.number(), candidateId: z.number() }))
      .mutation(({ input }) => assignCandidateToBatch(input.batchId, input.candidateId)),

    removeCandidate: staffProcedure
      .input(z.object({ batchId: z.number(), candidateId: z.number() }))
      .mutation(({ input }) => removeCandidateFromBatch(input.batchId, input.candidateId)),

    /** Clear a trainee's ID (retires it — it can never be reused). Manual codes are no longer accepted. */
    setTraineeCode: staffProcedure
      .input(z.object({ batchId: z.number(), candidateId: z.number(), code: z.string().nullable() }))
      .mutation(async ({ input }) => {
        if (input.code != null) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Agent IDs are generated, not typed — use Generate ID." });
        }
        const { getDb, releaseTraineeCode } = await import("./db");
        const { batchCandidates: bc } = await import("../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        const db = await getDb();
        if (db) {
          const [cur] = await db.select({ code: bc.traineeCode }).from(bc).where(and(eq(bc.batchId, input.batchId), eq(bc.candidateId, input.candidateId))).limit(1);
          if (cur?.code) {
            const { workforceAgents, agentCredentials } = await import("../drizzle/schema");
            const [wa] = await db.select({ x: workforceAgents.id }).from(workforceAgents).where(eq(workforceAgents.traineeCode, cur.code)).limit(1);
            const [cr] = await db.select({ x: agentCredentials.id }).from(agentCredentials).where(eq(agentCredentials.traineeCode, cur.code)).limit(1);
            if (wa || cr) throw new TRPCError({ code: "CONFLICT", message: `${cur.code} is a live agent ID and cannot be cleared here.` });
            await releaseTraineeCode(cur.code);
          }
        }
        return setTraineeCode(input.batchId, input.candidateId, null);
      }),

    /**
     * Generate (or regenerate) a trainee's agent ID. Random T-NNNNN, ledger-backed: never a duplicate,
     * never a previously used code. The old code (if any) is retired for good.
     */
    assignTraineeCode: staffProcedure
      .input(z.object({ batchId: z.number(), candidateId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const { getDb, allocateTraineeCode, releaseTraineeCode } = await import("./db");
        const { batchCandidates: bc, workforceAgents, agentCredentials } = await import("../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const [cur] = await db.select({ code: bc.traineeCode }).from(bc).where(and(eq(bc.batchId, input.batchId), eq(bc.candidateId, input.candidateId))).limit(1);
        if (!cur) throw new TRPCError({ code: "NOT_FOUND", message: "Trainee not in this batch" });
        if (cur.code) {
          // Once the ID is live (agent exists / has portal credentials) it is their identity — do not regenerate here.
          const [wa] = await db.select({ x: workforceAgents.id }).from(workforceAgents).where(eq(workforceAgents.traineeCode, cur.code)).limit(1);
          const [cr] = await db.select({ x: agentCredentials.id }).from(agentCredentials).where(eq(agentCredentials.traineeCode, cur.code)).limit(1);
          if (wa || cr) throw new TRPCError({ code: "CONFLICT", message: `${cur.code} is already a live agent ID (portal/Operations) and cannot be regenerated.` });
        }
        const code = await allocateTraineeCode(input.candidateId, "training");
        await setTraineeCode(input.batchId, input.candidateId, code);
        await releaseTraineeCode(cur.code);
        await auditEntry(ctx.user, "assign_trainee_code", "batch_candidate", String(input.candidateId), JSON.stringify({ batchId: input.batchId, from: cur.code, to: code }));
        return { code, previous: cur.code ?? null };
      }),

    getUsedCodes: staffProcedure.query(async () => {
      // Returns all T-codes currently in use (active agents + trainees)
      const { getDb } = await import("./db");
      const { workforceAgents, batchCandidates: bc } = await import("../drizzle/schema");
      const { isNotNull } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return { usedByActive: [], usedByTrainees: [] };
      const active = await db.select({ traineeCode: workforceAgents.traineeCode })
        .from(workforceAgents).where(isNotNull(workforceAgents.traineeCode));
      const trainees = await db.select({ traineeCode: bc.traineeCode })
        .from(bc).where(isNotNull(bc.traineeCode));
      return {
        usedByActive: active.map(a => a.traineeCode).filter(Boolean) as string[],
        usedByTrainees: trainees.map(t => t.traineeCode).filter(Boolean) as string[],
      };
    }),

    getCandidateBatch: staffProcedure
      .input(z.object({ candidateId: z.number() }))
      .query(({ input }) => getCandidateBatch(input.candidateId)),

    toggleSlackJoined: staffProcedure
      .input(z.object({ batchId: z.number(), candidateId: z.number(), value: z.boolean() }))
      .mutation(({ input }) => toggleSlackJoined(input.batchId, input.candidateId, input.value)),

  allAssignments: staffProcedure
    .query(() => getAllBatchAssignments()),
  // Bulk generate credentials for all agents in a batch
  /**
   * Generate portal passwords for a batch. SKIPS trainees who already have credentials —
   * regenerating them would silently lock out everyone already using the portal. Pass
   * force:true (behind a confirm dialog) to regenerate those too.
   */
  bulkGenerateCredentials: roleProcedure("hr", "manager")
    .input(z.object({ batchId: z.number(), force: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const candidates = await listCandidatesInBatch(input.batchId);
      const { getAgentCredentialByCandidateId } = await import("./db");
      const results: Array<{ candidateId: number; traineeCode: string; password: string }> = [];
      let skippedExisting = 0;
      for (const c of candidates) {
        if (!c.traineeCode) continue; // skip trainees without an agent ID
        const existing = await getAgentCredentialByCandidateId(c.id);
        if (existing && !input.force) { skippedExisting++; continue; }
        const plainPassword = generatePassword(c.traineeCode);
        const passwordHash = await bcrypt.hash(plainPassword, 10);
        await upsertAgentCredential(c.id, c.traineeCode, passwordHash);
        results.push({ candidateId: c.id, traineeCode: c.traineeCode, password: plainPassword });
      }
      await auditEntry(ctx.user, "bulk_generate_credentials", "batch", String(input.batchId), JSON.stringify({ generated: results.length, skippedExisting, force: !!input.force }));
      return { generated: results.length, skippedExisting, credentials: results };
    }),
});

const candidatesRouter = router({
  list: staffProcedure.query(() => listCandidates()),

    get: staffProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getCandidateById(input.id)),

    create: staffProcedure
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

    update: staffProcedure
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

    updateStatus: staffProcedure
      .input(z.object({
        id: z.number(),
        status: PIPELINE_STAGES_ZOD,
        fromStage: PIPELINE_STAGES_ZOD.optional(), // kept optional for backward compat — frontend always sends it
        detail: z.string().optional(), // e.g. rejection reason
      }))
      .mutation(async ({ input, ctx }) => {
        // The REAL previous stage comes from the row — the client's fromStage is
        // display-only (a stale tab used to skip or mis-log the batch cascade).
        const current = await getCandidateById(input.id);
        const fromStage = (current?.status as string | undefined) ?? input.fromStage;
        // A candidate who became a LIVE agent is managed from Operations, not the
        // pipeline. Relabeling them here (e.g. "rejected"/"blacklisted") left the
        // workforce row active — portal access, payroll, headcount — while the
        // ATS claimed they were gone, and nothing could set 'hired' back.
        if (fromStage === "hired") {
          const { getDb } = await import("./db");
          const dbg = await getDb();
          if (dbg) {
            const { workforceAgents } = await import("../drizzle/schema");
            const { eq: eqOp } = await import("drizzle-orm");
            const [wf] = await dbg.select({ traineeCode: workforceAgents.traineeCode, agentStatus: workforceAgents.agentStatus })
              .from(workforceAgents).where(eqOp(workforceAgents.candidateId, input.id)).limit(1);
            if (wf && !["resigned", "terminated", "blacklisted"].includes(wf.agentStatus ?? "")) {
              throw new TRPCError({ code: "BAD_REQUEST", message: `This candidate is a live agent (${wf.traineeCode}). Use Operations (terminate / resign / blacklist) — that updates both sides.` });
            }
          }
        }
        await updateCandidateStatus(input.id, input.status);
        // Cascade: remove from batch when moving away from whatsapp_group_added OR when rejected/blacklisted
        const removeFromBatchStages = ["whatsapp_group_added"];
        const shouldRemove = (fromStage && removeFromBatchStages.includes(fromStage) && !removeFromBatchStages.includes(input.status))
          || ["rejected", "blacklisted"].includes(input.status);
        if (shouldRemove) {
          const batch = await getCandidateBatch(input.id);
          if (batch) {
            await removeCandidateFromBatch(batch.id, input.id);
          }
        }
        await logActivity({
          candidateId: input.id,
          action: "stage_change",
          fromStage: fromStage as typeof input.fromStage,
          toStage: input.status,
          detail: input.detail,
          performedBy: ctx.user?.name ?? undefined,
        });
        return { success: true };
      }),

    /** Mark/unmark a candidate as "No Answer" (phone call not answered) */
    setSubStatus: staffProcedure
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

    delete: roleProcedure("hr", "manager")
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // A candidate promoted to Operations is deleted through the workforce
        // force-delete flow (payroll guard + full cascade), never from the pipeline.
        const { getDb } = await import("./db");
        const db = await getDb();
        if (db) {
          const { workforceAgents } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          const [wf] = await db.select({ traineeCode: workforceAgents.traineeCode })
            .from(workforceAgents).where(eq(workforceAgents.candidateId, input.id)).limit(1);
          if (wf) throw new TRPCError({ code: "BAD_REQUEST", message: `This candidate is in Operations (${wf.traineeCode}). Remove them from Workforce first.` });
        }
        await deleteCandidate(input.id);
        await auditEntry(ctx.user, "delete_candidate", "candidate", String(input.id), undefined);
        return { success: true };
      }),
    blacklist: roleProcedure("hr", "manager")
      .input(z.object({ id: z.number(), reason: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        // Same guard as updateStatus: a live agent is blacklisted from Operations
        // (full cascade: status, credentials, sessions, candidate label) — doing
        // it here would blacklist the ATS label while the agent stays active.
        {
          const { getDb } = await import("./db");
          const dbg = await getDb();
          if (dbg) {
            const { workforceAgents } = await import("../drizzle/schema");
            const { eq: eqOp } = await import("drizzle-orm");
            const [wf] = await dbg.select({ traineeCode: workforceAgents.traineeCode, agentStatus: workforceAgents.agentStatus })
              .from(workforceAgents).where(eqOp(workforceAgents.candidateId, input.id)).limit(1);
            if (wf && !["resigned", "terminated", "blacklisted"].includes(wf.agentStatus ?? "")) {
              throw new TRPCError({ code: "BAD_REQUEST", message: `This candidate is a live agent (${wf.traineeCode}). Blacklist them from Operations instead — that updates both sides.` });
            }
          }
        }
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

    bulkImport: staffProcedure
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
    checkDuplicate: staffProcedure
      .input(z.object({ phone: z.string() }))
      .query(({ input }) => checkDuplicateByPhone(input.phone)),

    /** Returns all candidates whose phone matches a previously rejected candidate */
    reApplicants: staffProcedure
      .query(() => getReApplicants()),

    /** Upload a CV file and attach it to a candidate */
    uploadCv: staffProcedure
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
        // Same validation as every other upload: MIME whitelist + magic bytes + cap.
        const { buf: buffer, ext } = validateUpload(input.fileBase64, input.mimeType, { maxBytes: 10 * 1024 * 1024 });
        const key = `cvs/${input.id}-${Date.now()}.${ext}`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        await updateCandidate(input.id, { cvUrl: url, cvFileName: input.fileName });
        return { url, fileName: input.fileName };
      }),

    /** Remove CV attachment from a candidate */
  removeCv: staffProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => updateCandidate(input.id, { cvUrl: null, cvFileName: null })),
});

const activityRouter = router({
    list: staffProcedure
      .input(z.object({ candidateId: z.number() }))
      .query(({ input }) => listActivityByCandidateId(input.candidateId)),

  listAll: staffProcedure
    .input(z.object({ limit: z.number().optional() }))
    .query(({ input }) => listAllActivity(input.limit ?? 200)),
});

const notesRouter = router({
    list: staffProcedure
      .input(z.object({ candidateId: z.number() }))
      .query(({ input }) => listNotesByCandidateId(input.candidateId)),

  add: staffProcedure
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
    listByCandidate: staffProcedure
      .input(z.object({ candidateId: z.number() }))
      .query(({ input }) => listInterviewsByCandidateId(input.candidateId)),

    schedule: staffProcedure
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

        // Scheduling an interview IS the stage change — move the candidate and
        // log it, so the pipeline and the activity feed reflect reality.
        try {
          const cand = await getCandidateById(input.candidateId);
          if (cand && !["interview_scheduled", "accepted", "whatsapp_group_added", "hired", "rejected", "blacklisted"].includes(String(cand.status))) {
            await updateCandidateStatus(input.candidateId, "interview_scheduled");
            await logActivity({
              candidateId: input.candidateId,
              action: "stage_change",
              fromStage: cand.status as Parameters<typeof logActivity>[0]["fromStage"],
              toStage: "interview_scheduled",
              detail: `Interview scheduled for ${new Date(input.scheduledAt).toLocaleString("en-GB", { timeZone: "Africa/Cairo" })} (Cairo)`,
              performedBy: ctx.user?.name ?? undefined,
            });
          } else {
            await logActivity({
              candidateId: input.candidateId,
              action: "note",
              detail: `Interview scheduled for ${new Date(input.scheduledAt).toLocaleString("en-GB", { timeZone: "Africa/Cairo" })} (Cairo)`,
              performedBy: ctx.user?.name ?? undefined,
            });
          }
        } catch (e) { console.warn("[interviews] stage/activity update failed:", e); }

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
    pipelineCounts: staffProcedure
      .input(z.object({ period: z.enum(["week", "month", "all"]).default("month") }))
      .query(({ input }) => getPipelineCounts(input.period)),

    kpis: staffProcedure
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

        // Conversion rate: Applied → Accepted among candidates still in play.
        // Sum the ACTIVE stages of the SAME period — subtracting all-time
        // rejected/blacklisted from a period total went negative, and it kept
        // hired/resigned/terminated rows in the denominator.
        const ACTIVE_STAGES = new Set(["applied", "whatsapp_sent", "no_answer", "voice_note_reviewed", "interview_scheduled", "accepted", "whatsapp_group_added"]);
        const activeTotal = pipelineCounts.filter(p => ACTIVE_STAGES.has(String(p.status))).reduce((sum, p) => sum + p.count, 0);
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
  /** Operational snapshot for the dashboard: money this cycle vs last, quality/
   *  adherence flags, OT + coaching spend, and logout repeat-offenders.
   *  Cycle runs the 26th → 25th, matching payroll. */
  opsSnapshot: staffProcedure.query(async () => {
    const { getDb } = await import("./db");
    const { and, gte, lte, eq } = await import("drizzle-orm");
    const db = await getDb();
    const empty = {
      cycleKey: "", prevCycleKey: "",
      revenue: 0, profit: 0, prevRevenue: 0, prevProfit: 0,
      violationsToday: 0, violationsCycle: 0, repeatOffenders: [] as { crdts: string; alias: string | null; n: number }[],
      otHours: 0, otEgp: 0, coachingHours: 0, coachingEgp: 0,
      logoutFlags: [] as { crdts: string; alias: string | null; n: number; level: "warn" | "danger" }[],
    };
    if (!db) return empty;
    const { cycleStats, agentViolations, cycleOT, coachingSessions, clientLogouts, workforceAgents } = await import("../drizzle/schema");

    // ONE cycle definition (server/_core/time.ts): 26th→25th, named after the END month, business-time "today".
    const { businessDateKey, cycleKeyFor, cycleDateRangeFor } = await import("./_core/time");
    const todayIso = businessDateKey();
    const cycleKey = cycleKeyFor(todayIso);
    const [cy, cm] = cycleKey.split("-").map(Number);
    const prevCycleKey = `${cm === 1 ? cy - 1 : cy}-${String(cm === 1 ? 12 : cm - 1).padStart(2, "0")}`;
    const cycleStartIso = cycleDateRangeFor(cycleKey).from;

    const [stats, prevStats, viol, ot, coaching, logouts, agents] = await Promise.all([
      db.select().from(cycleStats).where(eq(cycleStats.cycleKey, cycleKey)),
      db.select().from(cycleStats).where(eq(cycleStats.cycleKey, prevCycleKey)),
      db.select().from(agentViolations).where(and(gte(agentViolations.date, cycleStartIso), lte(agentViolations.date, todayIso))),
      db.select().from(cycleOT).where(and(eq(cycleOT.cycleKey, cycleKey), eq(cycleOT.status, "approved"))),
      db.select().from(coachingSessions).where(and(eq(coachingSessions.cycleKey, cycleKey), eq(coachingSessions.status, "approved"))),
      db.select().from(clientLogouts).where(eq(clientLogouts.cycleKey, cycleKey)),
      db.select().from(workforceAgents),
    ]);

    const n = (v: unknown) => Number(v || 0);
    const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + f(r), 0);
    const aliasOf = new Map(agents.map(a => [a.crdts ?? "", a.alias || a.fullName || a.crdts]));

    // Agents flagged 3+ times this cycle — the ones worth coaching.
    const byAgent = new Map<string, number>();
    viol.forEach(v => { if (v.crdts) byAgent.set(v.crdts, (byAgent.get(v.crdts) ?? 0) + 1); });
    const repeatOffenders = Array.from(byAgent.entries())
      .filter(([, c]) => c >= 3)
      .sort((a, b) => b[1] - a[1])
      .map(([crdts, c]) => ({ crdts, alias: aliasOf.get(crdts) ?? null, n: c }));

    // Logouts: 4+ in a cycle is the danger line, 3 is the early warning.
    const byLogout = new Map<string, number>();
    logouts.forEach(l => byLogout.set(l.crdts, (byLogout.get(l.crdts) ?? 0) + 1));
    const logoutFlags = Array.from(byLogout.entries())
      .filter(([, c]) => c >= 3)
      .sort((a, b) => b[1] - a[1])
      .map(([crdts, c]) => ({ crdts, alias: aliasOf.get(crdts) ?? null, n: c, level: (c >= 4 ? "danger" : "warn") as "warn" | "danger" }));

    return {
      cycleKey, prevCycleKey,
      revenue: sum(stats, s => n(s.revenue)), profit: sum(stats, s => n(s.profit)),
      prevRevenue: sum(prevStats, s => n(s.revenue)), prevProfit: sum(prevStats, s => n(s.profit)),
      violationsToday: viol.filter(v => v.date === todayIso).length,
      violationsCycle: viol.length,
      repeatOffenders,
      otHours: sum(ot, o => n(o.hours)), otEgp: sum(ot, o => n(o.egpAmount)),
      coachingHours: sum(coaching, c => n(c.coachingHours)), coachingEgp: sum(coaching, c => n(c.bonusAmount)),
      logoutFlags,
    };
  }),

  // Overview: pending deletion count + recent separations
  overview: staffProcedure
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
// Portal lock: ONE truth in _core/portalLock (DB-backed, 30s cache) shared with
// agentAuth session resolution and /api/portal-status.
async function isPortalLocked(): Promise<{ locked: boolean; message: string }> {
  const { getPortalLock } = await import("./_core/portalLock");
  return getPortalLock();
}

/** Validate a base64-uploaded file: size cap, MIME whitelist, magic-byte sniff.
 *  Returns the buffer + a server-chosen safe extension. Mirrors /api/upload-doc. */
const UPLOAD_MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png",
  "image/webp": "webp", "image/gif": "gif", "application/pdf": "pdf",
};
function validateUpload(fileBase64: string, mimeType: string, opts: { maxBytes: number; imagesOnly?: boolean }) {
  const mime = mimeType.toLowerCase();
  const ext = UPLOAD_MIME_EXT[mime];
  if (!ext || (opts.imagesOnly && ext === "pdf")) {
    throw new TRPCError({ code: "BAD_REQUEST", message: opts.imagesOnly ? "Only JPEG, PNG, WebP or GIF images are allowed." : "Only JPEG, PNG, WebP, GIF or PDF files are allowed." });
  }
  const buf = Buffer.from(fileBase64, "base64");
  if (buf.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Empty file." });
  if (buf.length > opts.maxBytes) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `File too large (max ${Math.round(opts.maxBytes / (1024 * 1024))}MB).` });
  }
  // Never trust the client's MIME: sniff the magic bytes.
  const hex = buf.subarray(0, 4).toString("hex");
  const magicOk =
    ext === "jpg"  ? hex.startsWith("ffd8ff") :
    ext === "png"  ? hex === "89504e47" :
    ext === "gif"  ? hex.startsWith("474946") :
    ext === "webp" ? buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP" :
    ext === "pdf"  ? buf.subarray(0, 5).toString("ascii") === "%PDF-" : false;
  if (!magicOk) throw new TRPCError({ code: "BAD_REQUEST", message: "File content does not match its type." });
  return { buf, ext };
}

/** Cryptographically random one-time password: <code>-<6 chars, no ambiguous glyphs>. */
function generatePassword(traineeCode: string): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(6);
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[bytes[i] % alphabet.length];
  return `${traineeCode}-${out}`;
}

/** Agent-facing: an agent's OWN adherence / quality / coaching / OT records.
 *  Pushed nightly from the sheets — DISPLAY ONLY, no payroll effect. */
const agentMyRecordsProcedure = agentProcedure.query(async ({ ctx }) => {
  const empty = { adherence: [], quality: [], coaching: [], ot: [] };
  const traineeCode = ctx.agent.traineeCode;

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
  generateCredentials: roleProcedure("manager", "hr")
    .input(z.object({ candidateId: z.number(), traineeCode: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const plainPassword = generatePassword(input.traineeCode);
      const passwordHash = await bcrypt.hash(plainPassword, 10);
      await upsertAgentCredential(input.candidateId, input.traineeCode, passwordHash);
      await revokeAgentSessions(input.traineeCode); // any old session dies with the old password
      await auditEntry(ctx.user, "generate_credentials", "agent", input.traineeCode, "{}");
      // Return plain password ONCE — admin must share it with agent
      return { traineeCode: input.traineeCode, password: plainPassword };
    }),

  // Check if credentials exist for a candidate
  hasCredentials: staffProcedure
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
      // Global portal lock — check env AND DB setting
      const { locked: _isLocked, message: _lockMsg } = await isPortalLocked();
      if (_isLocked) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: _lockMsg || "The agent portal is temporarily locked. Please contact your manager.",
        });
      }
      // Lockout is keyed on code+IP so a stranger hammering a code cannot lock the real agent out.
      const _loginIp = (ctx.req.ip ?? ctx.req.headers["x-forwarded-for"] ?? "?").toString().split(",")[0].trim();
      const _lockKey = `${input.traineeCode}|${_loginIp}`;
      const lockoutStatus = await isLockedOut(_lockKey, "agent");
      if (lockoutStatus.locked) {
        const remainingMins = Math.ceil(lockoutStatus.remainingMs / 60000);
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Account locked due to too many failed attempts. Try again in ${remainingMins} minute${remainingMins !== 1 ? "s" : ""}.`,
        });
      }
      const cred = await getAgentCredentialByTraineeCode(input.traineeCode);
      if (!cred) {
        await recordFailedLogin(_lockKey, "agent", _loginIp);
        const attempts = await countRecentFailedLogins(_lockKey, "agent");
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
        await recordFailedLogin(_lockKey, "agent", _loginIp);
        const attempts = await countRecentFailedLogins(_lockKey, "agent");
        const remaining = Math.max(0, 5 - attempts);
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: remaining > 0
            ? `Invalid Trainee ID or password. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`
            : "Account locked. Too many failed attempts.",
        });
      }
      // Password is right — NOW the status gate (saying "no longer active" before the password
      // check let anyone probe which codes exist). Frozen / notice-period agents keep portal
      // access (owner's decision); only the terminal statuses are blocked.
      {
        const { getDb: _lgGdb } = await import("./db");
        const { eq: _lgEq } = await import("drizzle-orm");
        const _lgDb = await _lgGdb();
        if (_lgDb) {
          const { workforceAgents: _lgWa } = await import("../drizzle/schema");
          const [_lgAgent] = await _lgDb.select({ agentStatus: _lgWa.agentStatus })
            .from(_lgWa).where(_lgEq(_lgWa.traineeCode, input.traineeCode)).limit(1);
          if (_lgAgent?.agentStatus && ["resigned", "terminated", "blacklisted"].includes(_lgAgent.agentStatus)) {
            throw new TRPCError({ code: "FORBIDDEN", message: "This account is no longer active. Please contact HR." });
          }
        }
      }
      // Successful login — clear failed attempts
      await clearLoginAttempts(_lockKey, "agent");
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
  resetPassword: roleProcedure("manager", "hr")
    .input(z.object({ candidateId: z.number().optional(), traineeCode: z.string().optional(), crdts: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
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
      await revokeAgentSessions(resolvedTraineeCode); // an HR reset must kill any live session
      await auditEntry(ctx.user, "reset_agent_password", "agent", resolvedTraineeCode, "{}");
      return { traineeCode: resolvedTraineeCode, password: newPassword };
    }),
  // Agent logout
  logout: publicProcedure.mutation(async ({ ctx }) => {
    ctx.res.clearCookie(AGENT_COOKIE, { path: "/" });
    return { success: true };
  }),
  // Change password — agent must be logged in. Requires the CURRENT password (except on the
  // forced first-login change), kills every other session, and keeps this one alive.
  changePassword: agentProcedure
    .input(z.object({ currentPassword: z.string().optional(), newPassword: z.string().min(8, "At least 8 characters") }))
    .mutation(async ({ input, ctx }) => {
      const cred = await getAgentCredentialByTraineeCode(ctx.agent.traineeCode);
      if (!cred) throw new TRPCError({ code: "UNAUTHORIZED" });
      if (!cred.mustChangePassword) {
        if (!input.currentPassword) throw new TRPCError({ code: "BAD_REQUEST", message: "Enter your current password" });
        const ok = await bcrypt.compare(input.currentPassword, cred.passwordHash);
        if (!ok) throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is incorrect" });
      }
      const newHash = await bcrypt.hash(input.newPassword, 10);
      await changeAgentPassword(ctx.agent.candidateId, newHash);
      // Revoke every session, then re-issue THIS one so the agent is not logged out mid-flow.
      await revokeAgentSessions(ctx.agent.traineeCode);
      const freshToken = jwt.sign(
        { candidateId: ctx.agent.candidateId, traineeCode: ctx.agent.traineeCode, type: "agent" },
        ENV.cookieSecret,
        { expiresIn: "30d" }
      );
      ctx.res.cookie(AGENT_COOKIE, freshToken, { ...getSessionCookieOptions(ctx.req), maxAge: 30 * 24 * 60 * 60 * 1000 });
      return { success: true };
    }),
  // Get current agent session info (from cookie))
  me: publicProcedure.query(async ({ ctx }) => {
    // Cookie verification (signature, revocation, agent status, env lock) happens once per
    // request in resolveAgentSession — any failed check strips the cookie, so ctx.agent is
    // null here and the portal treats it as logged out. DB errors inside the resolver fall
    // back to token-only trust, so infrastructure trouble never logs anyone out.
    if (!ctx.agent) {
      ctx.res.clearCookie(AGENT_COOKIE, { path: "/" });
      return null;
    }
    // DB-backed portal lock — kicks active sessions within one poll cycle
    const { locked: _meLocked, message: _meMsg } = await isPortalLocked();
    if (_meLocked) {
      throw new TRPCError({ code: "FORBIDDEN", message: _meMsg || "The agent portal is temporarily locked. Please contact your manager." });
    }
    const payload = {
      candidateId: ctx.agent.candidateId,
      traineeCode: ctx.agent.traineeCode,
      iat: ctx.agent.issuedAt ? Math.floor(ctx.agent.issuedAt / 1000) : undefined,
    };
    {
      // Sliding session: agents are never logged out for inactivity. If the token is older than a day,
      // re-issue a fresh 30-day cookie so a session that is used at least monthly lives forever.
      if (payload.iat && Date.now() - payload.iat * 1000 > 24 * 60 * 60 * 1000) {
        const fresh = jwt.sign({ candidateId: payload.candidateId, traineeCode: payload.traineeCode, type: "agent" }, ENV.cookieSecret, { expiresIn: "30d" });
        ctx.res.cookie(AGENT_COOKIE, fresh, { ...getSessionCookieOptions(ctx.req), maxAge: 30 * 24 * 60 * 60 * 1000 });
      }
      const candidate = await getCandidateById(payload.candidateId);
      if (!candidate) {
        const { getDb: _cGdb } = await import("./db");
        if (!(await _cGdb())) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable — please retry" });
        return null; // candidate really gone
      }
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
    }
  }),

  // Payroll — agent can read their own, admin can read/write any
  getPayroll: agentOrStaffProcedure
    .input(z.object({ candidateId: z.number() }))
    .query(async ({ input, ctx }) => {
      // The agent reading THEIR OWN record, or a MONEY role (finance/hr/manager/
      // owner/admin). "Any staff" was too broad: team leads and BD must not be
      // able to pull another employee's pay through the API (owner decision).
      // agentOrStaffProcedure already rejects unauthenticated callers; this guard
      // narrows further to own-record or money-role only.
      const isOwnRecord = ctx.agent?.candidateId === input.candidateId;
      if (!isOwnRecord && !canSeeMoney((ctx.user as { role?: string } | null)?.role)) throw new TRPCError({ code: "UNAUTHORIZED" });
      return getPayrollByCandidateId(input.candidateId);
    }),

  upsertPayroll: roleProcedure("finance", "hr", "manager")
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

  deletePayroll: staffProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin" && ctx.user?.role !== "owner") throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can delete payroll records." });
      await deletePayrollRecord(input.id);
      await auditEntry(ctx.user, "delete_payroll_record", "payroll", String(input.id), JSON.stringify({ deletedBy: ctx.user.name ?? ctx.user.email }));
      return { success: true };
    }),

  // Payroll Excel Upload procedures
  uploadPayroll: roleProcedure("finance", "hr", "manager")
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
      const uploadedBy = ctx.user?.name ?? ctx.user?.email ?? "Unknown Admin";
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
  getPayrollMonths: roleProcedure("finance", "hr", "manager")
    .query(async () => {
      return getPayrollMonths();
    }),
  getPayrollByMonth: roleProcedure("finance", "hr", "manager")
    .input(z.object({ month: z.string() }))
    .query(async ({ input }) => {
      return getPayrollByMonth(input.month);
    }),
  // Admin: delete all payroll rows for a specific month (undo a bad import)
  deletePayrollForMonth: staffProcedure
    .input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin" && ctx.user?.role !== "owner") throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can delete payroll sheets." });
      const { getDb } = await import("./db");
      const { eq: eqOp } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { payrollRecords } = await import("../drizzle/schema");
      const result = await db.delete(payrollRecords).where(eqOp(payrollRecords.month, input.month));
      return { deleted: (result as { rowsAffected?: number }).rowsAffected ?? 0 };
    }),
  // Agent-facing payroll procedures
  getMyPayrollMonths: agentProcedure
    .query(async ({ ctx }) => {
      const traineeCode = ctx.agent.traineeCode;
      return getPayrollMonthsByAgentCode(traineeCode);
    }),
  getMyPayrollRecord: agentProcedure
    .input(z.object({ month: z.string() }))
    .query(async ({ input, ctx }) => {
      const traineeCode = ctx.agent.traineeCode;
      const records = await getPayrollByAgentCode(traineeCode);
      return records.find(r => r.month === input.month) ?? null;
    }),
  // Performance — agent can read their own, admin can read/write any
  getPerformance: publicProcedure
    .input(z.object({ candidateId: z.number() }))
    .query(async ({ input, ctx }) => {
      // Staff with an assigned role, or the agent reading THEIR OWN record. A bare Google login
      // (role user/viewer) is NOT staff — it must not read other people's pay.
      const isOwnRecord = ctx.agent?.candidateId === input.candidateId;
      if (!isOwnRecord && !isStaff((ctx.user as { role?: string } | null)?.role)) throw new TRPCError({ code: "UNAUTHORIZED" });
      return getPerformanceByCandidateId(input.candidateId);
    }),

  upsertPerformance: roleProcedure("hr", "manager", "ops_manager")
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

  deletePerformance: roleProcedure("hr", "manager", "ops_manager")
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deletePerformanceRecord(input.id);
      return { success: true };
    }),
});

/**
 * THE one place a request-centre decision is applied. Used by requests.updateStatus and by the Slack
 * reaction handler, so leave balances / Time Tracking stay in step no matter where the click happened.
 *  - leave / paid_leave / day_off → decides the mirrored leave_requests row (balances, Time Tracking, agent view)
 *  - late_arrival / early_departure → records a reviewed attendance exception (once)
 *  - everything else → plain status update
 */
export async function applyAgentRequestDecision(opts: {
  id: number;
  status: "pending" | "in_progress" | "resolved" | "rejected";
  adminReply?: string | null;
  leaveType?: "casual" | "annual" | "unpaid";
  decidedBy: string;
  actor?: { name?: string | null; openId?: string | null } | null;
}) {
  const req = await getAgentRequestById(opts.id);
  if (!req) throw Object.assign(new Error("Request not found"), { code: "NOT_FOUND" });
  const final = opts.status === "resolved" || opts.status === "rejected";
  const alreadyFinal = req.status === "resolved" || req.status === "rejected";
  // A decided request with SIDE EFFECTS (leave balance burned, separation
  // scheduled) must not be re-decided or re-opened one-sided from here — that
  // used to flip the request to "rejected" while the approved leave and the
  // burned balance stood. Same status again (reply edit) is fine.
  const sideEffectType = ["leave", "paid_leave", "day_off", "sick_note", "resignation"].includes(req.type);
  if (alreadyFinal && sideEffectType && opts.status !== req.status) {
    throw Object.assign(
      new Error(`This ${req.type.replace(/_/g, " ")} request was already decided. To undo it, cancel the leave in Leave Management (or manage the separation in Operations) — that updates both sides.`),
      { code: "CONFLICT" },
    );
  }
  const { getDb } = await import("./db");
  const db = await getDb();

  if (db && final && !alreadyFinal && (req.type === "leave" || req.type === "paid_leave" || req.type === "day_off" || req.type === "sick_note")) {
    const { decideLeaveRequest } = await import("./db");
    const { leaveRequests } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const [lr] = await db.select().from(leaveRequests).where(eq(leaveRequests.agentRequestId, req.id)).limit(1);
    // The leave row is the source of truth. If it was already decided or
    // cancelled elsewhere, do NOT silently resolve the request and tell the
    // agent "approved" for a leave that no longer exists.
    if (lr && lr.status !== "pending") {
      throw Object.assign(
        new Error(`This leave was already ${lr.status} in Leave Management — nothing to decide here.`),
        { code: "CONFLICT" },
      );
    }
    if (lr && lr.status === "pending") {
      // day_off and sick_note never consume casual/annual balance → unpaid unless HR explicitly picks a type.
      const leaveType = opts.leaveType ?? (req.type === "day_off" || req.type === "sick_note" ? "unpaid" as const : undefined);
      if (opts.status === "resolved" && !leaveType) {
        throw Object.assign(new Error("Choose the leave type (casual / annual / unpaid) to approve this leave."), { code: "BAD_REQUEST" });
      }
      const { LEAVE_DEFAULTS } = await import("@shared/const");
      await decideLeaveRequest({ id: lr.id, decision: opts.status === "resolved" ? "approved" : "rejected", leaveType, decidedBy: opts.decidedBy, defaults: LEAVE_DEFAULTS });
      await auditEntry(opts.actor, opts.status === "resolved" ? "leave_approved" : "leave_rejected", "leave_request", String(lr.id), JSON.stringify({ via: "request_center", agentRequestId: req.id, leaveType }));
    }
  }

  if (db && opts.status === "resolved" && !alreadyFinal && (req.type === "late_arrival" || req.type === "early_departure")) {
    const { attendanceExceptions } = await import("../drizzle/schema");
    const { eq, and } = await import("drizzle-orm");
    const parsed: string[] = (() => { try { return req.requestedDates ? JSON.parse(req.requestedDates) : []; } catch { return []; } })();
    const dates = Array.from(new Set((parsed.length ? parsed : [req.requestedDate ? new Date(req.requestedDate).toISOString().slice(0, 10) : null]).filter((d): d is string => !!d)));
    const exceptionType = req.type === "late_arrival" ? "late" : "early_departure";
    const sched = req.message.match(/Scheduled (\d{2}:\d{2})/)?.[1] ?? null;
    const actual = req.message.match(/Actual (\d{2}:\d{2})/)?.[1] ?? null;
    const minutes = sched && actual ? (() => { const [sh, sm] = sched.split(":").map(Number); const [ah, am] = actual.split(":").map(Number); const d = (ah * 60 + am) - (sh * 60 + sm); return req.type === "late_arrival" ? Math.max(0, d) : Math.max(0, -d); })() : null;
    const agent = dates.length ? await getWorkforceAgentByCode(req.traineeCode) : null;
    // One attendance exception per requested date (a request may cover several days).
    for (const date of dates) {
      const [dup] = await db.select({ id: attendanceExceptions.id }).from(attendanceExceptions)
        .where(and(eq(attendanceExceptions.traineeCode, req.traineeCode), eq(attendanceExceptions.date, date), eq(attendanceExceptions.exceptionType, exceptionType))).limit(1);
      if (dup) continue;
      await db.insert(attendanceExceptions).values({
        traineeCode: req.traineeCode, agentName: agent?.fullName ?? null, date, exceptionType,
        scheduledTime: sched, actualTime: actual, minutesLate: minutes,
        note: `${req.subject}${opts.adminReply ? ` — ${opts.adminReply}` : ""}`.slice(0, 1000),
        status: "reviewed", reviewedBy: opts.decidedBy, createdAt: Date.now(),
      });
    }
  }

  // Resignation approved via the Request Center → actually schedule the separation.
  // (The Approve button used to hide after resolve with nothing ever happening.)
  if (db && opts.status === "resolved" && !alreadyFinal && req.type === "resignation") {
    const { scheduleResignation } = await import("./db");
    const effDate = (() => {
      try {
        const dates: string[] = req.requestedDates ? JSON.parse(req.requestedDates) : [];
        if (dates.length) return String(dates[dates.length - 1]).slice(0, 10);
      } catch { /* fall through */ }
      if (req.requestedDate) return new Date(req.requestedDate).toISOString().slice(0, 10);
      return new Date().toISOString().slice(0, 10);
    })();
    await scheduleResignation(req.traineeCode, effDate, `Request Center #${req.id}: ${req.subject}`.slice(0, 500), opts.decidedBy);
    await auditEntry(opts.actor, "resignation_scheduled", "agent", req.traineeCode, JSON.stringify({ via: "request_center", agentRequestId: req.id, effectiveDate: effDate }));
  }

  // Always stamp status / reply / resolvedBy / resolvedAt on the request itself.
  await updateAgentRequestStatus(opts.id, opts.status, opts.adminReply ?? undefined, opts.decidedBy);

  // Tell the agent the outcome where they will see it (portal notifications).
  if (final && !alreadyFinal && req.candidateId) {
    try {
      const outcome = opts.status === "resolved" ? "approved" : "rejected";
      await createAgentNotification({
        candidateId: req.candidateId,
        message: `Your ${req.type.replace(/_/g, " ")} request "${req.subject}" was ${outcome}${opts.adminReply ? ` — ${opts.adminReply}` : ""}`.slice(0, 500),
        type: "request_reply",
        relatedId: req.id,
      });
    } catch { /* notification failure never blocks the decision */ }
  }
}

const requestsRouter = router({
  // Agent: submit a new request
  submit: agentProcedure
    .input(z.object({
      type: z.enum(["leave", "paid_leave", "salary", "schedule", "complaint", "resignation", "day_off", "sick_note", "hr_letter", "late_arrival", "early_departure", "other"]),
      subject: z.string().min(1).max(255),
      /** late_arrival / early_departure: scheduled vs actual time, HH:MM */
      scheduledTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      actualTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      message: z.string().min(1),
      requestedDate: z.number().optional(), // UTC ms timestamp (single date)
      requestedDates: z.array(z.string()).optional(), // multiple date strings for multi-day requests
      attachmentUrl: z.string().url().optional(), // S3 URL of uploaded file
      hrLetterPurpose: z.string().optional(), // purpose for hr_letter type
      hrLetterLanguage: z.enum(["arabic", "english"]).optional(), // language for hr_letter type
    }))
    .mutation(async ({ input, ctx }) => {
      const payload = ctx.agent;
      // Late arrival / early departure: a date is required, no advance-notice rule, and the times are
      // kept in the message so the approver (and the attendance record) see them.
      if (input.type === "late_arrival" || input.type === "early_departure") {
        if (!input.requestedDate && !(input.requestedDates && input.requestedDates.length)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Please select the date" });
        }
        const bits = [input.scheduledTime ? `Scheduled ${input.scheduledTime}` : null, input.actualTime ? `Actual ${input.actualTime}` : null].filter(Boolean);
        if (bits.length) input.message = `${bits.join(" · ")}\n${input.message}`;
      }
      // Enforce 2-week minimum for date-based requests (compare calendar dates, not ms)
      const dateRequiredTypes = ["leave", "paid_leave", "day_off", "sick_note", "resignation"];
      if (dateRequiredTypes.includes(input.type)) {
        const hasDates = (input.requestedDates && input.requestedDates.length > 0) || input.requestedDate;
        if (!hasDates) throw new TRPCError({ code: "BAD_REQUEST", message: "Please select the date(s) for this request" });
        // Unpaid day off and sick notes can be for any date (no advance notice required)
        if (input.type !== "day_off" && input.type !== "sick_note") {
          // Earliest selected date must be ≥14 CAIRO calendar days from the Cairo
          // business "today" — string math, no server-TZ off-by-one after midnight.
          const { businessDateKey } = await import("./_core/time");
          const todayKey = businessDateKey();
          const t = new Date(`${todayKey}T00:00:00Z`);
          t.setUTCDate(t.getUTCDate() + 14);
          const minKey = t.toISOString().slice(0, 10);
          const rawCheck = input.requestedDates?.slice().sort()[0] ?? input.requestedDate ?? null;
          const checkKey = rawCheck && Number.isFinite(Date.parse(String(rawCheck)))
            ? new Date(Date.parse(String(rawCheck))).toISOString().slice(0, 10) : null;
          if (checkKey && checkKey < minKey) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Date must be at least 2 weeks from today" });
          }
        }
      }
      const created = await createAgentRequest({
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
      // Leave requests ALSO land in leave_requests so Leave Management + balances see them
      // (one leave system). The request-centre row stays for the agent's own view/replies.
      if (input.type === "leave" || input.type === "paid_leave" || input.type === "day_off" || input.type === "sick_note") {
        const dates = (input.requestedDates ?? []).filter(Boolean).sort();
        const single = input.requestedDate ? new Date(input.requestedDate).toISOString().slice(0, 10) : null;
        const startDate = dates[0] ?? single;
        const endDate = dates[dates.length - 1] ?? single;
        if (startDate && endDate) {
          const newId = (created as unknown as Array<{ insertId?: number }>)[0]?.insertId ?? null;
          const { createLeaveRequestRow } = await import("./db");
          const tag = input.type === "day_off" ? "[unpaid] " : input.type === "sick_note" ? "[sick] " : "";
          await createLeaveRequestRow({
            traineeCode: payload.traineeCode,
            startDate, endDate,
            // Pass the EXACT dates: days = count of picked dates (Mon+Fri = 2),
            // not the calendar span (5) — the span was over-burning balances
            // on non-contiguous selections.
            dates: dates.length ? dates : undefined,
            reason: `${tag}${input.subject}${input.message ? ` — ${input.message}` : ""}`.slice(0, 2000),
            agentRequestId: newId,
          });
        }
      }
      return { success: true };
    }),

  // Agent: list own requests
  listMine: agentProcedure.query(({ ctx }) => listAgentRequestsByCandidate(ctx.agent.candidateId)),

  // Admin: list all requests
  listAll: roleProcedure("hr", "manager", "ops_manager", "team_lead").query(() => listAllAgentRequests()),

  // Admin: update status and/or reply
  updateStatus: roleProcedure("hr", "manager", "ops_manager", "team_lead")
    .input(z.object({
      id: z.number(),
      status: z.enum(["pending", "in_progress", "resolved", "rejected"]),
      adminReply: z.string().optional(),
      /** Required when resolving a leave / paid_leave request (day_off defaults to unpaid). */
      leaveType: z.enum(["casual", "annual", "unpaid"]).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const decidedBy = ctx.user?.name ?? ctx.user?.email ?? "Admin";
      try {
        await applyAgentRequestDecision({ id: input.id, status: input.status, adminReply: input.adminReply, leaveType: input.leaveType, decidedBy, actor: ctx.user });
      } catch (e) { throw toTrpcError(e, "Failed to update request"); }
      return { ok: true };
    }),

  // Admin: count unread requests (for red dot badge)
  countUnread: protectedProcedure.query(({ ctx }) => countUnreadAgentRequests(ctx.user?.openId ?? undefined)),

  /** Open (pending/in_progress) requests — what the Dashboard tile should show. */
  countOpen: staffProcedure.query(async () => {
    const { countOpenAgentRequests } = await import("./db");
    return countOpenAgentRequests();
  }),

  // Admin: mark all requests as read (called when admin opens the Requests page)
  markAllRead: staffProcedure.mutation(({ ctx }) => markAllAgentRequestsRead(ctx.user?.openId ?? undefined)),

  // Agent: upload an attachment file (returns S3 URL)
  uploadAttachment: agentProcedure
    .input(z.object({
      fileBase64: z.string(), // base64-encoded file content
      fileName: z.string().max(255),
      mimeType: z.string().max(100),
    }))
    .mutation(async ({ input }) => {
      const { storagePut } = await import("./storage");
      const { buf, ext } = validateUpload(input.fileBase64, input.mimeType, { maxBytes: 16 * 1024 * 1024 });
      const key = `agent-attachments/${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
      const { url } = await storagePut(key, buf, input.mimeType);
      return { url };
    }),
});

// ─── Admin Auth Router ────────────────────────────────────────────────────────
const adminAuthRouter = router({
  // Invite a new admin (owner only)
  invite: adminProcedure
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
  regenerateInvite: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
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
  list: adminProcedure.query(() => listAdminAccounts()),

  // Deactivate / reactivate admin (owner only)
  setActive: adminProcedure
    .input(z.object({ id: z.number(), isActive: z.boolean() }))
    .mutation(({ input }) => setAdminActive(input.id, input.isActive)),
});

// ─── Referrals Router ─────────────────────────────────────────────────────────
const referralsRouter = router({
  // Agent submits a referral
  submit: agentProcedure
    .input(z.object({
      referrerCandidateId: z.number().optional(),
      refereeName: z.string().min(1).max(255),
      refereePhone: z.string().min(5).max(40),
      refereeNote: z.string().max(1000).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // The referrer is ALWAYS the logged-in agent — never whoever the body names.
      const referrerCandidateId = ctx.agent.candidateId;
      const insertResult = await createCandidate({
        name: input.refereeName,
        phone: input.refereePhone,
        source: "referral",
        notes: `Referred by agent ${ctx.agent.traineeCode} (candidateId: ${referrerCandidateId}). Note: ${input.refereeNote ?? ""}`,
      });
      const createdCandidateId = (insertResult as { insertId?: number })?.insertId ?? null;
      await createReferral({
        referrerCandidateId,
        refereeName: input.refereeName,
        refereePhone: input.refereePhone,
        refereeNote: input.refereeNote ?? null,
        createdCandidateId,
      });
      return { success: true };
    }),

  // Agent views own referrals
  listMine: agentProcedure
    .input(z.object({ candidateId: z.number().optional() }).optional())
    .query(({ ctx }) => getReferralsByReferrer(ctx.agent.candidateId)),

  // Admin views all referrals
  listAll: staffProcedure.query(() => listAllReferrals()),

  // Admin updates referral status
  updateStatus: staffProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["pending", "contacted", "hired", "rejected"]),
    }))
    .mutation(async ({ input }) => {
      // Notification target comes from the referral row itself — a client-supplied
      // candidateId could spoof notifications to any agent.
      const referralRow = await getReferralById(input.id);
      if (!referralRow) throw new TRPCError({ code: "NOT_FOUND", message: "Referral not found" });
      await updateReferralStatus(input.id, input.status);
      if (referralRow.referrerCandidateId) {
        const statusLabel = { pending: "Pending", contacted: "Contacted", hired: "Hired! \u{1F389}", rejected: "Not selected" }[input.status];
        await createAgentNotification({
          candidateId: referralRow.referrerCandidateId,
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
  // All three are scoped to the logged-in agent; the candidateId input is ignored (kept for client compat).
  listMine: agentProcedure
    .input(z.object({ candidateId: z.number().optional() }).optional())
    .query(({ ctx }) => getNotificationsByCandidate(ctx.agent.candidateId)),

  countUnread: agentProcedure
    .input(z.object({ candidateId: z.number().optional() }).optional())
    .query(({ ctx }) => countUnreadNotifications(ctx.agent.candidateId)),

  markRead: agentProcedure
    .input(z.object({ candidateId: z.number().optional() }).optional())
    .mutation(({ ctx }) => markNotificationsRead(ctx.agent.candidateId)),
});

// ─── Campaigns Router ────────────────────────────────────────────────────────
const campaignsRouter = router({
  list: staffProcedure.query(() => listCampaigns()),

  getById: agentOrStaffProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getCampaignById(input.id)),

  create: staffProcedure
    .input(z.object({
      name: z.string().min(1),
      clientId: z.number().int().positive().nullable().optional(),
      minHeadcount: z.number().int().min(1),
      workDays: z.enum(["all", "weekdays"]),
      notes: z.string().optional(),
    }))
    .mutation(({ input }) => createCampaign(input)),

  update: staffProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      clientId: z.number().int().positive().nullable().optional(),
      minHeadcount: z.number().int().min(1).optional(),
      workDays: z.enum(["all", "weekdays"]).optional(),
      notes: z.string().optional(),
    }))
    .mutation(({ input }) => { const { id, ...rest } = input; return updateCampaign(id, rest); }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      // Refuse to orphan agents: a campaign with active agents must be emptied first.
      const { getDb } = await import("./db");
      const { eq, and, sql: rawSql } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { workforceAgents } = await import("../drizzle/schema");
      const [{ n }] = await db.select({ n: rawSql<number>`count(*)` }).from(workforceAgents)
        .where(and(eq(workforceAgents.campaignId, input.id), eq(workforceAgents.agentStatus, "active")));
      if (Number(n) > 0) throw new TRPCError({ code: "PRECONDITION_FAILED", message: `This campaign still has ${n} active agent(s). Transfer them first.` });
      await auditEntry(ctx.user, "delete_campaign", "campaign", String(input.id));
      return deleteCampaign(input.id);
    }),

  headcountForecast: staffProcedure
    .input(z.object({ campaignId: z.number(), days: z.number().int().min(1).max(90).optional() }))
    .query(({ input }) => getHeadcountForecast(input.campaignId, input.days ?? 30)),


  // Dynamic operation plan: 7-day grid (Mon-Sun) showing each agent's work/off status
  getOperationPlanMonth: agentOrStaffProcedure
    .input(z.object({ campaignId: z.number(), year: z.number().int(), month: z.number().int().min(1).max(12) }))
    .query(async ({ input }) => {
      const allAgentsMonth = await listWorkforceAgents(input.campaignId);
      const agents = allAgentsMonth.filter((a: { agentStatus?: string | null; isActive?: boolean | null; isDemo?: boolean | null }) => {
        const st = a.agentStatus;
        return !a.isDemo && st !== "resigned" && st !== "terminated" && st !== "blacklisted" && st !== "frozen" && st !== "inactive" && a.isActive !== false;
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
  getOperationPlan: agentOrStaffProcedure
    .input(z.object({ campaignId: z.number(), weekOffset: z.number().int().optional() }))
    .query(async ({ input }) => {
      const allAgents = await listWorkforceAgents(input.campaignId);
      // The Operation Plan is a live shift schedule — anyone who has LEFT the floor
      // (resigned / terminated / blacklisted / frozen) does not belong here, even if
      // their final pay is still being settled. Settlement is tracked in the exit flow.
      const agents = allAgents.filter((a: { agentStatus?: string | null; isActive?: boolean | null; isDemo?: boolean | null }) => {
        const st = a.agentStatus;
        return !a.isDemo && st !== "resigned" && st !== "terminated" && st !== "blacklisted" && st !== "frozen" && st !== "inactive" && a.isActive !== false;
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
  /** AUDIT: Payroll reconciliation — compare payroll_records vs what agents would see */
  auditPayrollReconciliation: staffProcedure
    .input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }))
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin" && ctx.user?.role !== "owner") throw new TRPCError({ code: "FORBIDDEN" });
      const { getDb } = await import("./db");
      const { payrollRecords, payrollAdjustments, workforceAgents } = await import("../drizzle/schema");
      const { eq, and, or, isNull } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return [];
      const [records, agents] = await Promise.all([
        db.select().from(payrollRecords).where(eq(payrollRecords.month, input.month)),
        db.select({ traineeCode: workforceAgents.traineeCode, crdts: workforceAgents.crdts, alias: workforceAgents.alias, fullName: workforceAgents.fullName, agentStatus: workforceAgents.agentStatus })
          .from(workforceAgents).where(or(isNull(workforceAgents.isDemo), eq(workforceAgents.isDemo, false))),
      ]);
      const agentByCrdts = new Map(agents.map(a => [a.crdts ?? "", a]));
      const agentByCode = new Map(agents.map(a => [a.traineeCode ?? "", a]));
      return records.map(r => {
        const agent = agentByCrdts.get(r.crdts ?? "") ?? agentByCode.get(r.agentCode ?? "");
        const net = parseFloat(String(r.netPay ?? 0));
        const comm = parseFloat(String(r.commissionEgp ?? 0));
        const coaching = parseFloat(String(r.coachingBonus ?? 0));
        const ded = parseFloat(String(r.totalDeductions ?? 0));
        const expectedNet = parseFloat(String(r.baseSalary ?? 0))
          + parseFloat(String(r.ot1x5Pay ?? 0))
          + parseFloat(String(r.ot2xPay ?? 0))
          + parseFloat(String(r.ot3xPay ?? 0))
          + coaching - ded;
        const discrepancy = Math.abs(net - expectedNet) > 0.5;
        return {
          id: r.id,
          crdts: r.crdts,
          agentCode: r.agentCode,
          alias: r.alias || agent?.alias || null,
          fullName: agent?.fullName || null,
          agentStatus: agent?.agentStatus || "unknown",
          netPay: net,
          commissionEgp: comm,
          baseSalary: parseFloat(String(r.baseSalary ?? 0)),
          totalDeductions: ded,
          paymentStatus: r.paymentStatus,
          discrepancy,
          expectedNet: Math.round(expectedNet * 100) / 100,
        };
      });
    }),

  /** AUDIT: Check which agents can still log into portal despite being terminated */
  auditPortalAccess: staffProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin" && ctx.user?.role !== "owner") throw new TRPCError({ code: "FORBIDDEN" });
    const { getDb } = await import("./db");
    const { agentCredentials, workforceAgents } = await import("../drizzle/schema");
    const { eq, ne, and, or, inArray } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return [];
    // Find agents with credentials that are NOT active
    const creds = await db.select({ traineeCode: agentCredentials.traineeCode }).from(agentCredentials);
    const codes = creds.map(c => c.traineeCode ?? "").filter(Boolean);
    if (codes.length === 0) return [];
    const risks = await db.select({
      traineeCode: workforceAgents.traineeCode,
      alias: workforceAgents.alias,
      fullName: workforceAgents.fullName,
      agentStatus: workforceAgents.agentStatus,
      isActive: workforceAgents.isActive,
    }).from(workforceAgents)
      .where(and(
        inArray(workforceAgents.traineeCode, codes),
        ne(workforceAgents.agentStatus, "active")
      ));
    return risks;
  }),

  /** All agents for display purposes — includes former agents, returns name/alias/status only */
  listForDisplay: staffProcedure.query(async () => {
    const { getDb } = await import("./db");
    const { workforceAgents } = await import("../drizzle/schema");
    const { or, isNull, eq } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return [];
    return db.select({
      traineeCode: workforceAgents.traineeCode,
      crdts: workforceAgents.crdts,
      fullName: workforceAgents.fullName,
      alias: workforceAgents.alias,
      agentStatus: workforceAgents.agentStatus,
      isDemo: workforceAgents.isDemo,
    }).from(workforceAgents)
      .where(or(isNull(workforceAgents.isDemo), eq(workforceAgents.isDemo, false)));
  }),

  /** Global search — by name, alias, T-code, or CRDTS */
  globalSearch: staffProcedure
    .input(z.object({ q: z.string().min(1).max(100) }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const { workforceAgents } = await import("../drizzle/schema");
      const { or, like, eq, and, isNull } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return [];
      const q = `%${input.q.trim()}%`;
      return db.select({
        traineeCode: workforceAgents.traineeCode,
        fullName: workforceAgents.fullName,
        alias: workforceAgents.alias,
        crdts: workforceAgents.crdts,
        agentStatus: workforceAgents.agentStatus,
      }).from(workforceAgents)
        .where(and(
          or(isNull(workforceAgents.isDemo), eq(workforceAgents.isDemo, false)),
          or(like(workforceAgents.fullName, q), like(workforceAgents.alias, q), like(workforceAgents.traineeCode, q), like(workforceAgents.crdts, q))
        )).limit(15);
    }),

  // Manual "Mark as settled" — flips salarySettled; used when final pay is confirmed (exit checklist gates the full archive)
  // Unified HR profile: update address + emergency contact
  updateHrInfo: staffProcedure
    .input(z.object({ traineeCode: z.string(), address: z.string().optional(), emergencyContactName: z.string().optional(), emergencyContactPhone: z.string().optional(), emergencyContactRelation: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { workforceAgents } = await import("../drizzle/schema");
      const { traineeCode, ...rest } = input;
      await db.update(workforceAgents).set(rest).where(eq(workforceAgents.traineeCode, traineeCode));
      await auditEntry(ctx.user, "update_hr_info", "agent", traineeCode, JSON.stringify(rest));
      return { ok: true };
    }),
  markSettled: roleProcedure("finance", "hr", "manager")
    .input(z.object({ traineeCode: z.string(), settled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const { settleAgent } = await import("./db");
      await settleAgent(input.traineeCode, input.settled);
      await auditEntry(ctx.user, input.settled ? "mark_settled" : "mark_unsettled", "agent", input.traineeCode, undefined);
      return { ok: true };
    }),
  /** Bring a former agent back. The ONLY sanctioned way to reactivate a leaver. */
  rehire: roleProcedure("hr", "manager")
    .input(z.object({ traineeCode: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { workforceAgents, candidates: candT, agentSeparations } = await import("../drizzle/schema");
      const { eq, and, isNull } = await import("drizzle-orm");
      const [ag] = await db.select().from(workforceAgents).where(eq(workforceAgents.traineeCode, input.traineeCode)).limit(1);
      if (!ag) throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" });
      if (!["resigned", "terminated", "inactive", "frozen"].includes(ag.agentStatus ?? "")) {
        throw new TRPCError({ code: "BAD_REQUEST", message: ag.agentStatus === "blacklisted" ? "Blacklisted agents cannot be rehired." : `Agent is ${ag.agentStatus} — nothing to rehire.` });
      }
      if (ag.rehireEligible === false) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `This agent is marked NOT eligible for rehire${ag.rehireNote ? ` — ${ag.rehireNote}` : ""}. Clear the flag on their HR profile first.` });
      }
      await db.update(workforceAgents)
        .set({ agentStatus: "active", isActive: true, updatedAt: new Date() })
        .where(eq(workforceAgents.traineeCode, input.traineeCode));
      // Clear any still-pending scheduled separation so it can't fire later.
      await db.delete(agentSeparations)
        .where(and(eq(agentSeparations.agentCode, input.traineeCode), isNull(agentSeparations.appliedAt)));
      if (ag.candidateId) {
        try { await db.update(candT).set({ status: "hired", updatedAt: new Date() }).where(eq(candT.id, ag.candidateId)); } catch { /* label only */ }
      }
      await auditEntry(ctx.user, "rehire_agent", "agent", input.traineeCode, JSON.stringify({ previousStatus: ag.agentStatus }));
      // Credentials were deleted at separation — the UI reminds HR to regenerate.
      const { getAgentCredentialByCandidateId } = await import("./db");
      const hasCreds = ag.candidateId ? !!(await getAgentCredentialByCandidateId(ag.candidateId)) : false;
      return { ok: true, hasCredentials: hasCreds };
    }),
  list: staffProcedure
    .input(z.object({ campaignId: z.number().optional(), teamLeader: z.string().optional(), includeFormer: z.boolean().optional() }))
    .query(async ({ ctx, input }) => redactAgentRows(await listWorkforceAgents(input.campaignId, input.teamLeader, input.includeFormer), ctx.user?.role)),
  /** Active agents missing required personal info — for Slack pings. */
  incompleteProfiles: staffProcedure
    .query(async () => {
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return [];
      const { workforceAgents } = await import("../drizzle/schema");
      const agents = await db.select({
        traineeCode: workforceAgents.traineeCode,
        fullName: workforceAgents.fullName,
        alias: workforceAgents.alias,
        phone: workforceAgents.phone,
        email: workforceAgents.email,
        nationalId: workforceAgents.nationalId,
        dateOfBirth: workforceAgents.dateOfBirth,
        gender: workforceAgents.gender,
        nationality: workforceAgents.nationality,
        emergencyContactName: workforceAgents.emergencyContactName,
        emergencyContactPhone: workforceAgents.emergencyContactPhone,
      }).from(workforceAgents).where(eq(workforceAgents.agentStatus, "active"));
      // PII values stay server-side: the page only needs WHICH fields are missing.
      const REQUIRED = [
        { key: "phone", label: "Phone" },
        { key: "email", label: "Email" },
        { key: "nationalId", label: "National ID" },
        { key: "dateOfBirth", label: "Date of Birth" },
        { key: "gender", label: "Gender" },
        { key: "nationality", label: "Nationality" },
        { key: "emergencyContactName", label: "Emergency Contact" },
        { key: "emergencyContactPhone", label: "Emergency Phone" },
      ] as const;
      return agents
        .map(a => {
          const missing = REQUIRED.filter(f => !a[f.key as keyof typeof a]).map(f => f.label);
          return { traineeCode: a.traineeCode, fullName: a.fullName, alias: a.alias, missing };
        })
        .filter(a => a.missing.length > 0)
        .sort((a, b) => b.missing.length - a.missing.length);
    }),
  allInTraining: staffProcedure
    .query(() => listAllAgentsInTraining()),
  // Preview of a free random agent ID (nothing reserved — workforce.create claims it atomically)
  nextTraineeCode: staffProcedure
    .query(() => getNextAvailableTraineeCode()),

  create: staffProcedure
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
      jobTitle: z.string().max(150).optional(),
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
          alias: waTable.alias,
          campaignId: waTable.campaignId,
        }).from(waTable).where(eqGuard(waTable.traineeCode, input.traineeCode)).limit(1);
        if (existing.length > 0) {
          const ex = existing[0];
          // Only a plain INACTIVE row may be silently restored here. A leaver
          // (resigned/terminated/blacklisted) goes through workforce.rehire,
          // which checks rehire eligibility — this path used to reactivate them
          // unchecked and wipe alias/campaign.
          if (ex.agentStatus !== "inactive") {
            throw new TRPCError({
              code: "CONFLICT",
              message: ex.agentStatus === "active"
                ? `"${input.traineeCode}" is already assigned to an active agent (${ex.fullName}). Free the T-code first.`
                : `"${input.traineeCode}" belongs to a ${ex.agentStatus} agent (${ex.fullName}). Use Rehire on the Former Agents page instead.`,
            });
          }
          const { eq: eqUpd } = await import("drizzle-orm");
          await dbGuard.update(waTable).set({
            fullName: input.fullName ?? ex.fullName,
            alias: input.alias ?? ex.alias,
            agentStatus: "active",
            isActive: true,
            campaignId: input.campaignId ?? ex.campaignId,
          }).where(eqUpd(waTable.traineeCode, input.traineeCode));
          // Skip the createWorkforceAgent call below — record already updated
          return { restored: true, traineeCode: input.traineeCode };
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
      // Ledger: the code must be unowned, or already this candidate's (assigned in Training). Never a retired one.
      {
        const { reserveTraineeCode } = await import("./db");
        try { await reserveTraineeCode(input.traineeCode, input.candidateId, "operations"); }
        catch (e) { throw new TRPCError({ code: "CONFLICT", message: e instanceof Error ? e.message : "Agent ID unavailable" }); }
      }
      if (input.shiftHours && input.shiftHours.trim() !== "") {
        const { parseShiftHours, normalizeShiftHours } = await import("../shared/shiftHours");
        if (!parseShiftHours(input.shiftHours)) throw new TRPCError({ code: "BAD_REQUEST", message: `Shift hours "${input.shiftHours}" not understood — use e.g. "9:00 AM - 5:00 PM" or "4pm - 1am".` });
        input.shiftHours = normalizeShiftHours(input.shiftHours);
      }
      // Position-based client → position required and must be in the client's list; otherwise no position stored.
      if (input.campaignId != null) {
        const dbc = await getDb();
        if (dbc) {
          const { campaigns, clients, clientPositions } = await import("../drizzle/schema");
          const { eq, and, sql: sqlOp } = await import("drizzle-orm");
          const [cl] = await dbc.select({ id: clients.id, name: clients.name, positionBased: clients.positionBased }).from(campaigns).innerJoin(clients, eq(clients.id, campaigns.clientId)).where(eq(campaigns.id, input.campaignId)).limit(1);
          if (cl?.positionBased) {
            const title = (input.jobTitle ?? "").trim();
            if (!title) throw new TRPCError({ code: "BAD_REQUEST", message: `${cl.name} is position-based — pick a position.` });
            const [pos] = await dbc.select({ id: clientPositions.id }).from(clientPositions).where(and(eq(clientPositions.clientId, cl.id), eq(clientPositions.isActive, true), sqlOp`LOWER(${clientPositions.name}) = LOWER(${title})`)).limit(1);
            if (!pos) throw new TRPCError({ code: "BAD_REQUEST", message: `"${title}" is not in ${cl.name}'s position list.` });
            input.jobTitle = title; input.teamLeader = undefined;
          } else {
            input.jobTitle = undefined;
          }
        }
      }
      await createWorkforceAgent(input);
      // Auto-create leave balance for new agent (shared day-one defaults)
      try {
        const { getDb: getDbLb } = await import("./db");
        const { leaveBalances: lbTable } = await import("../drizzle/schema");
        const { eq: eqLb, and: andLb } = await import("drizzle-orm");
        const { LEAVE_DEFAULTS: lbDefaults } = await import("@shared/const");
        const dbLb = await getDbLb();
        const year = new Date().getFullYear();
        if (dbLb) {
          const existing = await dbLb.select({ id: lbTable.id }).from(lbTable).where(andLb(eqLb(lbTable.traineeCode, input.traineeCode), eqLb(lbTable.year, year))).limit(1);
          if (!existing[0]) {
            await dbLb.insert(lbTable).values({ traineeCode: input.traineeCode, year, casualTotal: lbDefaults.casualTotal, annualTotal: lbDefaults.annualTotal, casualUsed: 0, annualUsed: 0, updatedAt: Date.now() });
          }
        }
      } catch (e) { console.error("[LeaveBalance] Auto-init failed:", e); }
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
  update: staffProcedure
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
      contractEndDate: z.string().max(20).optional(),
      probationEndDate: z.string().max(20).optional(),
      isOnProbation: z.boolean().optional(),
      rehireEligible: z.boolean().optional(),
      rehireNote: z.string().max(500).optional(),
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
     .mutation(async ({ ctx, input }) => {
      // Role guard — only HR, managers, admins and owners can edit agent profiles
      const allowedRoles = ["hr", "admin", "owner", "ops_manager", "manager"];
      if (!allowedRoles.includes(ctx.user?.role ?? "")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only HR and managers can edit agent profiles." });
      }
      // Terminal statuses are NEVER plain profile writes — they need the separation
      // cascade (settlement queue, exit row, session revoke, CRDTS archive).
      if (input.agentStatus && ["resigned", "terminated", "blacklisted"].includes(input.agentStatus)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Use the Separation flow (resign/terminate) to set this status — a plain edit skips settlement and exit steps." });
      }
      // Reactivating a terminal agent is equally guarded — it must go through workforce.rehire
      // so the reinstatement is audited and a new hire-date / CRDTS suffix is applied.
      if (input.agentStatus === "active" || input.isActive === true) {
        const currentAgent = await getWorkforceAgentByCode(input.traineeCode);
        if (currentAgent && ["resigned", "terminated", "blacklisted"].includes(currentAgent.agentStatus ?? "")) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Cannot reactivate a ${currentAgent.agentStatus} agent via profile edit — use the Rehire flow instead.` });
        }
      }
      const { traineeCode, ...rest } = input;
      // Clearing a text field in the dialog sends "" — store NULL, not an empty
      // string (an "" crdts or team leader broke lookups and groupings).
      const CLEARABLE = ["alias", "phone", "teamLeader", "dialerCredentials", "crdts", "nationalId", "nationalIdExpiry", "contractEndDate", "probationEndDate", "rehireNote", "dateOfBirth", "nationality", "jobTitle", "city", "address", "emergencyContactName", "emergencyContactPhone", "emergencyContactRelation"] as const;
      for (const k of CLEARABLE) {
        if ((rest as Record<string, unknown>)[k] === "") (rest as Record<string, unknown>)[k] = null;
      }
      // Shift hours: store one canonical form ("9:00 AM - 5:00 PM") so Monthly Hours can always read it.
      if (rest.shiftHours !== undefined && rest.shiftHours.trim() !== "") {
        const { parseShiftHours, normalizeShiftHours } = await import("../shared/shiftHours");
        if (!parseShiftHours(rest.shiftHours)) throw new TRPCError({ code: "BAD_REQUEST", message: `Shift hours "${rest.shiftHours}" not understood — use e.g. "9:00 AM - 5:00 PM" or "4pm - 1am".` });
        rest.shiftHours = normalizeShiftHours(rest.shiftHours);
      }
      // Position-based client: the position must come from the client's managed list (no free-text typos).
      if (input.jobTitle !== undefined && input.jobTitle.trim() !== "") {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (db) {
          const { workforceAgents, campaigns, clients, clientPositions } = await import("../drizzle/schema");
          const { eq, and, sql: sqlOp } = await import("drizzle-orm");
          const campaignId = input.campaignId ?? (await getWorkforceAgentByCode(traineeCode))?.campaignId ?? null;
          if (campaignId != null) {
            const [cl] = await db.select({ id: clients.id, positionBased: clients.positionBased }).from(campaigns).innerJoin(clients, eq(clients.id, campaigns.clientId)).where(eq(campaigns.id, campaignId)).limit(1);
            if (cl?.positionBased) {
              const [pos] = await db.select({ id: clientPositions.id }).from(clientPositions)
                .where(and(eq(clientPositions.clientId, cl.id), eq(clientPositions.isActive, true), sqlOp`LOWER(${clientPositions.name}) = LOWER(${input.jobTitle.trim()})`)).limit(1);
              if (!pos) throw new TRPCError({ code: "BAD_REQUEST", message: `"${input.jobTitle}" is not in this client's position list. Add it under Manage positions first.` });
            }
          }
        }
      }
      // If campaignId is being set, fetch the old agent to check if it changed
      if (input.campaignId !== undefined) {
        try {
          const existing = await getWorkforceAgentByCode(traineeCode);
          if (existing && existing.campaignId !== input.campaignId) {
            const campaign = await getCampaignById(input.campaignId);
            const campaignName = campaign?.name ?? `Campaign #${input.campaignId}`;
            const { getDb: _nGdb } = await import("./db");
            const _nDb = await _nGdb();
            let positionBased = false;
            if (_nDb && campaign?.clientId) {
              const { clients: _nCl } = await import("../drizzle/schema");
              const { eq: _nEq } = await import("drizzle-orm");
              const [c] = await _nDb.select({ positionBased: _nCl.positionBased, name: _nCl.name }).from(_nCl).where(_nEq(_nCl.id, campaign.clientId)).limit(1);
              positionBased = !!c?.positionBased;
            }
            await createAgentNotification({
              candidateId: existing.candidateId,
              type: "campaign_assigned",
              message: positionBased ? `Your assignment has been updated${input.jobTitle ? ` — position: ${input.jobTitle}` : ""}.` : `You have been reassigned to the "${campaignName}" campaign.`,
              relatedId: input.campaignId,
            });
          }
        } catch (e) {
          console.error("[Notification] Failed to send campaign reassignment notification:", e);
        }
      }
      await auditEntry(ctx.user, "update_agent_profile", "agent", traineeCode, JSON.stringify(rest));
      return updateWorkforceAgent(traineeCode, rest);
    }),
  getMyProfile: agentProcedure.query(({ ctx }) => getWorkforceAgentByCode(ctx.agent.traineeCode)),
  // Agent: upload my profile picture (stores the file + saves the URL on my record)
  setMyAvatar: agentProcedure
    .input(z.object({ fileBase64: z.string(), fileName: z.string().max(255), mimeType: z.string().max(100) }))
    .mutation(async ({ input, ctx }) => {
      const traineeCode = ctx.agent.traineeCode;
      const { buf: buffer, ext } = validateUpload(input.fileBase64, input.mimeType, { maxBytes: 5 * 1024 * 1024, imagesOnly: true });
      const key = `agent-avatars/${traineeCode}-${Date.now()}.${ext}`;
      const { storagePut } = await import("./storage");
      const { url } = await storagePut(key, buffer, input.mimeType);
      await updateWorkforceAgent(traineeCode, { avatarUrl: url });
      return { url };
    }),
  // Agent: fill my personal profile ONCE. After submitting it locks; further edits go through HR.
  updateMyProfile: agentProcedure
    .input(z.object({
      // HR-only fields (contractEndDate, probationEndDate, isOnProbation, rehireEligible, rehireNote)
      // are deliberately NOT accepted here — they come from HR, never from the agent.
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
      const traineeCode = ctx.agent.traineeCode;
      const me = await getWorkforceAgentByCode(traineeCode);
      if (!me) throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" });
      if (me.profileLocked) throw new TRPCError({ code: "FORBIDDEN", message: "Your profile is already submitted. Please request an update from HR." });
      await updateWorkforceAgent(traineeCode, { ...input, profileLocked: true });
      return { success: true };
    }),

  getCampaignAgents: agentOrStaffProcedure
    .input(z.object({ campaignId: z.number() }))
    .query(async ({ input }) => {
      // agentOrStaffProcedure already guarantees a staff login or a verified agent session.
      // Return limited fields only — no national ID, DOB, salary, emergency contacts.
      // Same roster filter as the admin operation plan: no demo accounts, no one
      // who has left the floor (agents could see resigned ex-colleagues here).
      const agents = (await listWorkforceAgents(input.campaignId) as Array<Record<string,unknown>>)
        .filter(a => {
          const st = a.agentStatus as string | null;
          return !a.isDemo && st !== "resigned" && st !== "terminated" && st !== "blacklisted" && st !== "frozen" && st !== "inactive" && a.isActive !== false;
        });
      return agents.map(a => ({
        traineeCode: a.traineeCode,
        alias: a.alias,
        fullName: a.fullName,
        agentStatus: a.agentStatus,
        isActive: a.isActive,
        campaignId: a.campaignId,
        teamLeader: a.teamLeader,
        offDay1: a.offDay1,
        offDay2: a.offDay2,
        shiftHours: a.shiftHours,
        crdts: a.crdts,
        avatarUrl: a.avatarUrl,
      }));
    }),
  getEligibleCandidates: staffProcedure.query(() => getEligibleCandidatesForOps()),
  getAgentFullProfile: staffProcedure
    .input(z.object({ traineeCode: z.string() }))
    .query(async ({ ctx, input }) => {
      const lookup = decodeURIComponent(input.traineeCode).trim();
      // Try exact traineeCode match first
      let agent = await getWorkforceAgentByCode(lookup);
      if (!agent) {
        const { getDb } = await import("./db");
        const { workforceAgents } = await import("../drizzle/schema");
        const { eq, like } = await import("drizzle-orm");
        const db = await getDb();
        if (db) {
          // Try CRDTS match (agent clicked by CRDTS instead of T-code)
          const [byCrdts] = await db.select({ traineeCode: workforceAgents.traineeCode })
            .from(workforceAgents).where(eq(workforceAgents.crdts, lookup)).limit(1);
          if (byCrdts?.traineeCode) {
            agent = await getWorkforceAgentByCode(byCrdts.traineeCode);
          }
          // Try case-insensitive / trimmed match (handles encoding differences)
          if (!agent) {
            const [byLike] = await db.select({ traineeCode: workforceAgents.traineeCode })
              .from(workforceAgents).where(like(workforceAgents.traineeCode, lookup)).limit(1);
            if (byLike?.traineeCode) {
              agent = await getWorkforceAgentByCode(byLike.traineeCode);
            }
          }
        }
      }
      if (!agent) return null;
      // Use the resolved traineeCode for sub-queries
      const resolvedCode = agent.traineeCode ?? lookup;
      const [documents, paymentMethods, comments] = await Promise.all([
        getDocumentsByCode(resolvedCode),
        getPaymentMethodsByCode(resolvedCode),
        getCommentsByCode(resolvedCode),
      ]);
      // Payroll: the live v2 pipeline inserts rows with candidateId NULL and keys
      // them by CRDTS — fetching by candidateId only returned dead v1 rows, so
      // the profile's Payroll/Commission tabs said "no records" while the History
      // tab (crdts-keyed) listed every month. Union both sources, dedupe by id.
      const candidate = agent.candidateId ? await getCandidateById(agent.candidateId) : undefined;
      let payroll = agent.candidateId ? await getPayrollByCandidateId(agent.candidateId) : [];
      // Fetch manual adjustments (bonus/deduction entries) for this agent
      let adjustments: Array<{ id: number; crdts: string; month: string; type: string; amount: string; label: string; createdAt: number; createdBy: string | null }> = [];
      try {
        const { getDb, expandCrdtsIdentity, adjMatchesIdentity } = await import("./db");
        const { payrollRecords, payrollAdjustments } = await import("../drizzle/schema");
        const { inArray, desc } = await import("drizzle-orm");
        const db = await getDb();
        if (db && agent.crdts) {
          const identity = new Set(await expandCrdtsIdentity(agent.crdts));
          const ids = Array.from(identity);
          if (ids.length) {
            const v2rows = await db.select().from(payrollRecords)
              .where(inArray(payrollRecords.crdts, ids)).orderBy(desc(payrollRecords.month));
            payroll = [...payroll.filter(p => !v2rows.some(v => v.id === p.id)), ...v2rows]
              .sort((a, b) => String(b.month ?? "").localeCompare(String(a.month ?? "")));
            // Adjustments under ANY of the agent's identity forms — same widened
            // rule as the payslip and the mark-paid math (exact-string match
            // showed ZERO adjustments for every multi-CRDTS agent).
            adjustments = (await db.select().from(payrollAdjustments))
              .filter(a => adjMatchesIdentity(a.crdts, identity)) as typeof adjustments;
          }
        }
      } catch { /* non-fatal */ }
      // Identity documents, bank details and pay only leave for MONEY_ROLES.
      if (!canSeeMoney(ctx.user?.role)) {
        return {
          agent: redactAgentRow(agent as unknown as Record<string, unknown>, ctx.user?.role) as typeof agent,
          documents: [] as typeof documents, paymentMethods: [] as typeof paymentMethods, comments,
          candidate: (candidate ? redactAgentRow(candidate as unknown as Record<string, unknown>, ctx.user?.role) : null) as typeof candidate | null,
          payroll: ([] as typeof payroll), adjustments: [] as typeof adjustments,
        };
      }
      return { agent, documents, paymentMethods, comments, candidate: candidate ?? null, payroll: payroll ?? [], adjustments };
    }),

  getMyOperationPlan: agentProcedure
    .input(z.object({ weekOffset: z.number().int().optional() }))
    .query(async ({ ctx, input }) => {
      const _opCode = ctx.agent.traineeCode;
      const agent = await getWorkforceAgentByCode(_opCode);
      if (!agent || !agent.campaignId) return null;
      // Only show op plan for active agents — resigned/terminated don't appear here
      if (agent.agentStatus && !["active", "inactive", "frozen"].includes(agent.agentStatus)) return null;
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
  getFullCampaignPlan: agentProcedure
    .input(z.object({ weekOffset: z.number().int().optional() }))
    .query(async ({ ctx, input }) => {
      const _code = ctx.agent.traineeCode;
      const me = await getWorkforceAgentByCode(_code);
      if (!me || !me.campaignId) return null;
      const campaignId = me.campaignId as number;
      // Same roster filter as the admin operation plan — the agent-facing grid
      // used to include demo accounts, frozen agents and unsettled leavers.
      const agents = (await listWorkforceAgents(campaignId) as Array<Record<string, unknown>>)
        .filter(a => {
          const st = a.agentStatus as string | null;
          return !a.isDemo && st !== "resigned" && st !== "terminated" && st !== "blacklisted" && st !== "frozen" && st !== "inactive" && a.isActive !== false;
        }) as Awaited<ReturnType<typeof listWorkforceAgents>>;
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
  bulkGenerateCredentials: roleProcedure("manager", "hr")
    .input(z.object({ campaignId: z.number().optional(), force: z.boolean().optional() }))
    .mutation(async ({ input, ctx }) => {
      const agents = await listWorkforceAgents(input.campaignId);
      // One UNIQUE random password per agent (never a shared default), must be changed on first login.
      // Agents who ALREADY have credentials are skipped — regenerating silently
      // locked out everyone mid-shift. force:true (behind a confirm) resets them too.
      const { getAgentCredentialByCandidateId } = await import("./db");
      const results: Array<{ fullName: string; traineeCode: string; password: string }> = [];
      let skippedExisting = 0;
      for (const agent of agents) {
        if (!agent.traineeCode || !agent.candidateId) continue;
        const existing = await getAgentCredentialByCandidateId(agent.candidateId);
        if (existing && !input.force) { skippedExisting++; continue; }
        const pw = generatePassword(agent.traineeCode);
        const passwordHash = await bcrypt.hash(pw, 10);
        await upsertAgentCredential(agent.candidateId, agent.traineeCode, passwordHash, true);
        if (existing) { try { await revokeAgentSessions(agent.traineeCode); } catch { /* non-fatal */ } }
        results.push({ fullName: agent.fullName, traineeCode: agent.traineeCode, password: pw });
      }
      await auditEntry(ctx.user, "bulk_generate_credentials", "campaign", String(input.campaignId ?? "all"), JSON.stringify({ count: results.length, skippedExisting, force: !!input.force }));
      return { generated: results.length, skippedExisting, credentials: results };
    }),
  // Admin: force-delete an agent and their candidate record (for test/cleanup)
  forceDelete: adminProcedure
    .input(z.object({ traineeCode: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Order matters: VERIFY first — the old version released the T-code and
      // wrote the audit entry before checking the agent even existed.
      const { getDb, agentHasPayrollHistory, releaseTraineeCode } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { workforceAgents } = await import("../drizzle/schema");
      const agent = await db.select({ candidateId: workforceAgents.candidateId })
        .from(workforceAgents).where(eq(workforceAgents.traineeCode, input.traineeCode)).limit(1);
      if (!agent[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" });
      // Money history must survive: an agent with payroll/commission records is
      // archived through the separation flow, never erased.
      if (await agentHasPayrollHistory(input.traineeCode)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This agent has payroll/commission history and cannot be force-deleted. Use the separation flow (resign/terminate + settle) instead." });
      }
      await deleteCandidate(agent[0].candidateId);
      await releaseTraineeCode(input.traineeCode);
      await auditEntry(ctx.user, "force_delete_agent", "agent", input.traineeCode);
      return { success: true };
    }),

  // Generate a unique 6-digit trainee code not already in use
  generateUniqueId: staffProcedure
    .mutation(async () => {
      const { generateUniqueTraineeCode } = await import("./db");
      const code = await generateUniqueTraineeCode();
      return { code };
    }),

  /**
   * Promote an agent to a Hub role.
   * - Fully cuts agent portal access (deletes credentials, revokes sessions)
   * - Removes agent from the Operations roster (promotedAt flag)
   * - If the agent's email matches an existing Hub user, auto-assigns their Hub role
   * - Otherwise they should sign in to Hub and the role will be auto-assigned on first login
   */
  promoteToHub: staffProcedure
    .input(z.object({
      traineeCode: z.string(),
      hubRole: z.enum(["team_lead", "manager", "hr", "ops_manager", "finance", "admin"]),
      email: z.string().email().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin" && ctx.user?.role !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admins and owners can promote agents." });
      }
      const { promoteAgentToHub } = await import("./db");
      const result = await promoteAgentToHub(input.traineeCode, input.hubRole, input.email);
      return result;
    }),
});
// ─── Agent Comments Router ────────────────────────────────────────────────────
const agentCommentsRouter = router({
  // Comments/warnings are supervisory records — the approval layer reads and
  // writes them (hr/managers/ops/team leads); BD and other staff do not.
  listByCode: roleProcedure("hr", "manager", "ops_manager", "team_lead")
    .input(z.object({ traineeCode: z.string() }))
    .query(({ input }) => getCommentsByCode(input.traineeCode)),
  listMine: agentProcedure.query(({ ctx }) => getCommentsByCode(ctx.agent.traineeCode)),
  /** Agent confirms they have READ a warning. Own warnings only, stamped once. */
  acknowledge: agentProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { agentComments } = await import("../drizzle/schema");
      const { eq, and, isNull } = await import("drizzle-orm");
      const r = await db.update(agentComments)
        .set({ acknowledgedAt: Date.now() })
        .where(and(
          eq(agentComments.id, input.id),
          eq(agentComments.traineeCode, ctx.agent.traineeCode),
          eq(agentComments.tag, "warning"),
          isNull(agentComments.acknowledgedAt),
        ));
      const affected = (r as unknown as [{ affectedRows?: number }])[0]?.affectedRows ?? 0;
      if (!affected) throw new TRPCError({ code: "BAD_REQUEST", message: "Warning not found or already acknowledged." });
      return { ok: true };
    }),
  add: roleProcedure("hr", "manager", "ops_manager", "team_lead")
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
  delete: roleProcedure("hr", "manager")
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteAgentComment(input.id)),
});

// ─── Payment Methods Router ───────────────────────────────────────────────────
const paymentMethodsRouter = router({
  listMine: agentProcedure.query(({ ctx }) => getPaymentMethodsByCode(ctx.agent.traineeCode)),

  listAll: roleProcedure("hr", "finance", "manager").query(() => listAllPaymentMethods()),
  listGrouped: roleProcedure("hr", "finance", "manager").query(() => listPaymentMethodsGrouped()),

  upsert: agentProcedure
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
      const _pmUCode = ctx.agent.traineeCode;
      return upsertPaymentMethod({ ...input, traineeCode: _pmUCode });
    }),

  setPreferred: agentProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => {
      const _pmPCode = ctx.agent.traineeCode;
      return setPaymentMethodPreferred(input.id, _pmPCode);
    }),

  delete: agentProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const _pmDCode = ctx.agent.traineeCode;
      // Verify ownership — only delete if this payment method belongs to the caller
      const { getDb } = await import("./db");
      const { agentPaymentMethods } = await import("../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [pm] = await db.select({ id: agentPaymentMethods.id }).from(agentPaymentMethods)
        .where(and(eq(agentPaymentMethods.id, input.id), eq(agentPaymentMethods.traineeCode, _pmDCode))).limit(1);
      if (!pm) throw new TRPCError({ code: "FORBIDDEN", message: "You can only delete your own payment methods." });
      return deletePaymentMethod(input.id);
    }),

  addComment: staffProcedure
    .input(z.object({ id: z.number(), comment: z.string() }))
    .mutation(({ input }) => addPaymentMethodComment(input.id, input.comment)),
  adminUpsert: roleProcedure("hr", "finance", "manager")
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
  adminDelete: roleProcedure("hr", "finance", "manager")
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      // Safety check: warn if this payment method is referenced in payroll records
      const { getDb } = await import("./db");
      const { agentPaymentMethods, payrollRecords } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (db) {
        const [pm] = await db.select({ traineeCode: agentPaymentMethods.traineeCode, type: agentPaymentMethods.type }).from(agentPaymentMethods).where(eq(agentPaymentMethods.id, input.id)).limit(1);
        if (pm) {
          const [ref] = await db.select({ id: payrollRecords.id }).from(payrollRecords).where(eq(payrollRecords.crdts, pm.traineeCode)).limit(1);
          if (ref) {
            throw new TRPCError({ code: "CONFLICT", message: "This agent has payroll records. Deleting their payment method may affect future payments. Ask the agent to update their payment info instead, or confirm with the owner before proceeding." });
          }
        }
      }
      return deletePaymentMethod(input.id);
    }),
  adminSetPreferred: roleProcedure("hr", "finance", "manager")
    .input(z.object({ id: z.number(), traineeCode: z.string() }))
    .mutation(({ input }) => setPaymentMethodPreferred(input.id, input.traineeCode)),
});

// ─── Documents Router ─────────────────────────────────────────────────────────
const documentsRouter = router({
  listMine: agentProcedure.query(({ ctx }) => getDocumentsByCode(ctx.agent.traineeCode)),

  listAll: roleProcedure("hr", "manager").query(() => listAllDocuments()),

  /** Get/set agent portal lock state — admin/owner only */
  getPortalLock: staffProcedure.query(async () => {
    const { getDb } = await import("./db");
    const { appSettings } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return { locked: false, message: "" };
    const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "portal_locked")).limit(1);
    const [msgRow] = await db.select().from(appSettings).where(eq(appSettings.key, "portal_lock_message")).limit(1);
    return { locked: row?.value === "true", message: msgRow?.value ?? "" };
  }),

  setPortalLock: staffProcedure
    .input(z.object({ locked: z.boolean(), message: z.string().max(200).optional() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin" && ctx.user?.role !== "owner") throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can lock the portal." });
      const { getDb } = await import("./db");
      const { appSettings } = await import("../drizzle/schema");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const now = Date.now();
      await db.insert(appSettings).values({ key: "portal_locked", value: String(input.locked), updatedAt: now, updatedBy: ctx.user?.name ?? ctx.user?.email ?? "admin" })
        .onDuplicateKeyUpdate({ set: { value: String(input.locked), updatedAt: now, updatedBy: ctx.user?.name ?? ctx.user?.email ?? "admin" } });
      if (input.message !== undefined) {
        await db.insert(appSettings).values({ key: "portal_lock_message", value: input.message, updatedAt: now, updatedBy: ctx.user?.name ?? ctx.user?.email ?? "admin" })
          .onDuplicateKeyUpdate({ set: { value: input.message, updatedAt: now } });
      }
      // Bust the shared 30s cache so the lock takes effect on the NEXT request,
      // not up to half a minute later (and unlock doesn't keep kicking agents).
      const { invalidatePortalLockCache } = await import("./_core/portalLock");
      invalidatePortalLockCache();
      await auditEntry(ctx.user, input.locked ? "portal_locked" : "portal_unlocked", "system", "portal", JSON.stringify({ message: input.message, by: ctx.user?.name }));
      return { ok: true };
    }),

  markContractSigned: staffProcedure
    .input(z.object({
      traineeCodes: z.array(z.string().min(1)).min(1),
      contractStartDate: z.string().max(20).optional(),
      contractEndDate: z.string().max(20).optional(),
      probationEndDate: z.string().max(20).optional(),
      isOnProbation: z.boolean().optional(),
      rehireEligible: z.boolean().optional(),
      rehireNote: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const { workforceAgents } = await import("../drizzle/schema");
      const { inArray } = await import("drizzle-orm");
      const updates: { contractSigned: boolean; contractStartDate?: string | null; contractEndDate?: string | null } = { contractSigned: true };
      if (input.contractStartDate !== undefined) updates.contractStartDate = input.contractStartDate || null;
      if (input.contractEndDate !== undefined) updates.contractEndDate = input.contractEndDate || null;
      await db.update(workforceAgents).set(updates).where(inArray(workforceAgents.traineeCode, input.traineeCodes));
      await auditEntry(ctx.user, "mark_contract_signed", "workforce_agents", input.traineeCodes.join(","), JSON.stringify({ count: input.traineeCodes.length }));
      return { updated: input.traineeCodes.length };
    }),

  listByAgent: roleProcedure("hr", "manager")
    .input(z.object({ traineeCode: z.string() }))
    .query(({ input }) => getDocumentsByCode(input.traineeCode)),

  upload: agentProcedure
    .input(z.object({
      id: z.number().optional(),
      docType: z.string().min(1),
      fileUrl: z.string().url(),
      fileName: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const _docUCode = ctx.agent.traineeCode;
      return upsertAgentDocument({ ...input, traineeCode: _docUCode });
    }),

  uploadFile: agentProcedure
    .input(z.object({
      id: z.number().optional(),
      docType: z.string().min(1),
      fileBase64: z.string(),
      fileName: z.string(),
      mimeType: z.string().default("application/octet-stream"),
    }))
    .mutation(async ({ ctx, input }) => {
      const _docFCode = ctx.agent.traineeCode;
      const { storagePut } = await import("./storage");
      const { buf, ext } = validateUpload(input.fileBase64, input.mimeType, { maxBytes: 10 * 1024 * 1024 });
      const safeDocType = input.docType.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 40);
      const key = `agent-docs/${_docFCode}/${safeDocType}-${Date.now()}.${ext}`;
      const { url } = await storagePut(key, buf, input.mimeType);
      await upsertAgentDocument({ id: input.id, traineeCode: _docFCode, docType: input.docType, fileUrl: url, fileName: input.fileName });
      return { url };
    }),

  review: roleProcedure("hr", "manager")
    .input(z.object({
      id: z.number(),
      status: z.enum(["approved", "rejected"]),
      adminComment: z.string().optional(),
    }))
    .mutation(({ input }) => reviewAgentDocument(input.id, input.status, input.adminComment)),

  /** Admin uploads a document on behalf of an agent (no agent cookie required). */
  uploadForAgent: roleProcedure("hr", "manager")
    .input(z.object({
      traineeCode: z.string().min(1),
      docType: z.string().min(1),
      fileBase64: z.string(),
      fileName: z.string(),
      mimeType: z.string().default("application/octet-stream"),
    }))
    .mutation(async ({ ctx, input }) => {
      const { storagePut } = await import("./storage");
      const { buf, ext } = validateUpload(input.fileBase64, input.mimeType, { maxBytes: 10 * 1024 * 1024 });
      const safeCode = input.traineeCode.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64);
      const safeDocType = input.docType.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 40);
      const key = `agent-docs/${safeCode}/${safeDocType}-${Date.now()}.${ext}`;
      const { url } = await storagePut(key, buf, input.mimeType);
      await upsertAgentDocument({ traineeCode: input.traineeCode, docType: input.docType, fileUrl: url, fileName: input.fileName });
      await auditEntry(ctx.user, "admin_upload_document", "agent", input.traineeCode, JSON.stringify({ docType: input.docType, fileName: input.fileName }));
      return { url };
    }),
});

// ─── Schedule Change Router ───────────────────────────────────────────────────
const scheduleChangeRouter = router({
  request: agentProcedure
    .input(z.object({
      targetCode: z.string().min(1),
      requesterNewOff1: z.number().int().min(0).max(6).optional(),
      requesterNewOff2: z.number().int().min(0).max(6).optional(),
      targetNewOff1: z.number().int().min(0).max(6).optional(),
      targetNewOff2: z.number().int().min(0).max(6).optional(),
      message: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const _scCode = ctx.agent.traineeCode;
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

  listMine: agentProcedure.query(({ ctx }) => listScheduleChangeRequestsByCode(ctx.agent.traineeCode)),

  // Active colleagues an agent can pick to swap with (excludes self + resigned).
  listColleagues: agentProcedure.query(async ({ ctx }) => {
    const _me = ctx.agent.traineeCode;
    const all = await listWorkforceAgents();
    // Same client only (Quantum agents swap with Quantum agents), never demo accounts.
    const { getAgentTimeTrackingAccess } = await import("./db");
    const myAccess = await getAgentTimeTrackingAccess(_me);
    const campaignClient = new Map((await listCampaigns()).map(c => [c.id, c.clientId ?? null]));
    return (all as Array<Record<string, unknown>>)
      .filter(a => a.traineeCode && a.traineeCode !== _me && a.agentStatus === "active" && a.isActive !== false && !a.isDemo)
      .filter(a => myAccess.clientId == null || campaignClient.get(a.campaignId as number) === myAccess.clientId)
      .map(a => ({
        traineeCode: a.traineeCode as string,
        name: (a.fullName as string) || (a.alias as string) || (a.traineeCode as string),
        alias: (a.alias as string) || "",
        offDay1: (a.offDay1 as number | null) ?? null,
        offDay2: (a.offDay2 as number | null) ?? null,
      }))
      .sort((x, y) => x.name.localeCompare(y.name));
  }),

  listAll: staffProcedure.query(() => listAllScheduleChangeRequests()),

  peerApprove: agentProcedure
    .input(z.object({ id: z.number(), approve: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const _scCallerCode = ctx.agent.traineeCode;
      const reqs = await listAllScheduleChangeRequests();
      const req = reqs.find(r => r.id === input.id);
      if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "Swap request not found" });
      // Verify caller is the target of this swap request
      if (_scCallerCode !== req.targetCode) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only approve schedule swaps where you are the target agent." });
      }
      if (req.status !== "pending_peer") {
        throw new TRPCError({ code: "BAD_REQUEST", message: `This swap is already ${req.status.replace(/_/g, " ")}.` });
      }
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

  managerApprove: staffProcedure
    .input(z.object({
      id: z.number(),
      approve: z.boolean(),
      managerComment: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const requests = await listAllScheduleChangeRequests();
      const req = requests.find(r => r.id === input.id);
      if (!req) throw new TRPCError({ code: "NOT_FOUND" });
      // Double-approval would re-capture the ALREADY-SWAPPED days as "original"
      // and break the auto-revert — only a peer-approved swap can be decided.
      if (req.status !== "pending_manager") {
        throw new TRPCError({ code: "BAD_REQUEST", message: `This swap is already ${req.status.replace(/_/g, " ")}.` });
      }
      if (input.approve) {
        // Fetch current off days BEFORE swapping — needed for auto-revert after swap week
        const requesterAgent = await getWorkforceAgentByCode(req.requesterCode);
        const targetAgent = await getWorkforceAgentByCode(req.targetCode);
        const { getDb: _scDb } = await import("./db");
        const { scheduleChangeRequests: _scTable } = await import("../drizzle/schema");
        const { eq: _scEq } = await import("drizzle-orm");
        const _db = await _scDb();
        // The swap week is pinned AT APPROVAL: without a swapWeekOf the revert job
        // never fires (permanent swap), and one already in the past reverts instantly.
        // All week math on the CAIRO business date (string math, UTC-safe) —
        // the hourly revert job compares against businessDateKey too, so an
        // approval just after midnight Cairo no longer pins last week's Monday
        // and gets reverted the same morning.
        const { businessDateKey: _bdk } = await import("./_core/time");
        const _todayKey = _bdk();
        const mondayOfCurrentWeek = (() => {
          const d = new Date(`${_todayKey}T00:00:00Z`);
          const dow = d.getUTCDay();
          d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
          return d.toISOString().slice(0, 10);
        })();
        const weekStale = !req.swapWeekOf || (() => {
          const end = new Date(`${String(req.swapWeekOf).slice(0, 10)}T00:00:00Z`);
          end.setUTCDate(end.getUTCDate() + 7);
          return end.toISOString().slice(0, 10) <= _todayKey;
        })();
        // Store original off days for revert (+ repaired swap week when needed)
        if (_db) {
          await _db.update(_scTable).set({
            requesterOrigOff1: requesterAgent?.offDay1 ?? null,
            requesterOrigOff2: requesterAgent?.offDay2 ?? null,
            targetOrigOff1: targetAgent?.offDay1 ?? null,
            targetOrigOff2: targetAgent?.offDay2 ?? null,
            ...(weekStale ? { swapWeekOf: mondayOfCurrentWeek } : {}),
          }).where(_scEq(_scTable.id, input.id));
        }
        // Apply the ONE-TIME swap (temporary — will be reverted by hourly job after swap week).
        // offDay2 is written EXPLICITLY (null = single off day): `?? undefined` used to
        // keep the old second day, giving the agent one day too many or too few.
        if (req.requesterNewOff1 !== null && req.requesterNewOff1 !== undefined) {
          await updateWorkforceAgent(req.requesterCode, { offDay1: req.requesterNewOff1, offDay2: req.requesterNewOff2 ?? null });
        }
        if (req.targetNewOff1 !== null && req.targetNewOff1 !== undefined) {
          await updateWorkforceAgent(req.targetCode, { offDay1: req.targetNewOff1, offDay2: req.targetNewOff2 ?? null });
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
// ─── Break Schedule Router ────────────────────────────────────────────────────
const breakScheduleRouter = router({
  // Admin: replace all break slots for multiple agent+date combinations
  upsert: staffProcedure
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
  getByAgent: staffProcedure
    .input(z.object({
      agentCode: z.string(),
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(({ input }) => getBreakSchedulesByAgent(input.agentCode, input.startDate, input.endDate)),
  // Admin: get all breaks in a date range (for overview)
  getByDateRange: staffProcedure
    .input(z.object({ startDate: z.string(), endDate: z.string() }))
    .query(({ input }) => getBreakSchedulesByDateRange(input.startDate, input.endDate)),
  // Admin: delete a specific break entry
  delete: staffProcedure
    .input(z.object({ agentCode: z.string(), date: z.string() }))
    .mutation(({ input }) => deleteBreakSchedule(input.agentCode, input.date)),
  // Agent: get own breaks for current week
  getMyBreaks: agentProcedure
    .input(z.object({ startDate: z.string(), endDate: z.string() }))
    .query(async ({ input, ctx }) => {
      const traineeCode = ctx.agent.traineeCode;
      return getBreakSchedulesByAgent(traineeCode, input.startDate, input.endDate);
    }),
});

// ─── Separation Router ────────────────────────────────────────────
const separationRouter = router({
  // Admin: mark agent as resigned on-spot (status resigned; candidate labeled resigned)
  resignOnSpot: roleProcedure("hr", "manager")
    .input(z.object({ agentCode: z.string(), reason: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const adminName = ctx.user.name ?? ctx.user.email ?? "Unknown Admin";
      await markAgentResignedOnSpot(input.agentCode, input.reason, adminName);
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (db) {
        const { workforceAgents, exitProcess } = await import("../drizzle/schema");
        // Revoke portal session
        await db.update(workforceAgents).set({ sessionRevokedAt: Date.now() } as never).where(eq(workforceAgents.traineeCode, input.agentCode));
        invalidateAgentSessionCache(input.agentCode);
        // Auto-create exit process record if not already exists
        const existing = await db.select({ id: exitProcess.id }).from(exitProcess).where(eq(exitProcess.traineeCode, input.agentCode)).limit(1);
        if (!existing[0]) {
          await db.insert(exitProcess).values({ traineeCode: input.agentCode, exitType: "resignation", notes: input.reason, createdAt: Date.now(), updatedAt: Date.now() } as never);
        }
      }
      return { success: true };
    }),

  // Admin: terminate agent
  terminate: roleProcedure("hr", "manager")
    .input(z.object({ agentCode: z.string(), reason: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const adminName = ctx.user.name ?? ctx.user.email ?? "Unknown Admin";
      await terminateAgent(input.agentCode, input.reason, adminName);
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (db) {
        const { workforceAgents, exitProcess } = await import("../drizzle/schema");
        await db.update(workforceAgents).set({ sessionRevokedAt: Date.now() } as never).where(eq(workforceAgents.traineeCode, input.agentCode));
        invalidateAgentSessionCache(input.agentCode);
        // Auto-create exit process record
        const existing = await db.select({ id: exitProcess.id }).from(exitProcess).where(eq(exitProcess.traineeCode, input.agentCode)).limit(1);
        if (!existing[0]) {
          await db.insert(exitProcess).values({ traineeCode: input.agentCode, exitType: "termination", notes: input.reason, createdAt: Date.now(), updatedAt: Date.now() } as never);
        }
      }
      return { success: true };
    }),

  // Admin: approve a resignation request submitted by agent
  approveResignation: staffProcedure
    .input(z.object({
      agentCode: z.string(),
      requestId: z.number(),
      adminReply: z.string().optional(),
      adminLastWorkingDay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // YYYY-MM-DD set by admin
    }))
    .mutation(async ({ input, ctx }) => {
      const adminName = ctx.user?.name ?? ctx.user?.email ?? "Unknown Admin";
      // Revoke portal session as soon as resignation is approved
      {
        const { getDb: _rGdb } = await import("./db");
        const { eq: _rEq } = await import("drizzle-orm");
        const _rDb = await _rGdb();
        if (_rDb) {
          const { workforceAgents: _rWa } = await import("../drizzle/schema");
          await _rDb.update(_rWa).set({ sessionRevokedAt: Date.now() } as never).where(_rEq(_rWa.traineeCode, input.agentCode));
          invalidateAgentSessionCache(input.agentCode);
        }
      }
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
  getByAgent: staffProcedure
    .input(z.object({ agentCode: z.string() }))
    .query(({ input }) => getSeparationsByAgent(input.agentCode)),
  /** Full list of resigned + terminated + archived agents with all their data. */
  listFormerAgents: staffProcedure
    .query(async ({ ctx }) => {
      const money = canSeeMoney(ctx.user?.role);
      const { getDb } = await import("./db");
      const { eq, or, inArray, desc } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return [];
      const { workforceAgents, agentRequests, payrollRecords, cycleStats, agentViolations, coachingSessions, clientLogouts } = await import("../drizzle/schema");
      // Former = TERMINAL statuses only. Frozen/inactive/on-notice agents are still
      // on the roster — listing them here invited "Rehire" on people who never left.
      const agents = await db.select().from(workforceAgents).where(
        inArray(workforceAgents.agentStatus, ["resigned", "terminated", "blacklisted"])
      );
      if (agents.length === 0) return [];
      const codes = agents.map(a => a.traineeCode);
      // Fetch supporting data in parallel
      const crdtsList = agents.map(a => a.crdts ?? "").filter(Boolean);
      const [requests, payroll, cycles, violations, coaching, logouts] = await Promise.all([
        db.select().from(agentRequests).where(inArray(agentRequests.traineeCode, codes)).orderBy(desc(agentRequests.createdAt)),
        db.select().from(payrollRecords).where(inArray(payrollRecords.agentCode, codes)).orderBy(desc(payrollRecords.month)),
        crdtsList.length > 0 ? db.select().from(cycleStats).where(inArray(cycleStats.crdts, crdtsList)) : [],
        db.select().from(agentViolations).where(inArray(agentViolations.agentCode, codes)),
        db.select().from(coachingSessions).where(inArray(coachingSessions.agentCode, codes)),
        crdtsList.length > 0 ? db.select().from(clientLogouts).where(inArray(clientLogouts.crdts, crdtsList)) : [],
      ]);
      // Group by traineeCode
      const reqByCode = requests.reduce((m, r) => { (m[r.traineeCode] = m[r.traineeCode] ?? []).push(r); return m; }, {} as Record<string, typeof requests>);
      const payByCode = payroll.reduce((m, r) => { const k = r.agentCode ?? ""; (m[k] = m[k] ?? []).push(r); return m; }, {} as Record<string, typeof payroll>);
      const violByCode = violations.reduce((m, r) => { const k = r.agentCode ?? ""; (m[k] = m[k] ?? []).push(r); return m; }, {} as Record<string, typeof violations>);
      const coachByCode = coaching.reduce((m, r) => { const k = r.agentCode ?? ""; (m[k] = m[k] ?? []).push(r); return m; }, {} as Record<string, typeof coaching>);
      const crdtsCycles = (cycles as typeof cycleStats.$inferSelect[]).reduce((m, r) => { (m[r.crdts] = m[r.crdts] ?? []).push(r); return m; }, {} as Record<string, typeof cycleStats.$inferSelect[]>);
      const logoutsByCrdts = (logouts as typeof clientLogouts.$inferSelect[]).reduce((m, r) => { const k = r.crdts ?? ""; (m[k] = m[k] ?? []).push(r); return m; }, {} as Record<string, typeof clientLogouts.$inferSelect[]>);
      // Money + PII redaction for non-money roles (team leads/ops see the roster
      // and history, never salaries or ID fields) — same rule as the live roster.
      return agents.map(a => {
        const pay = payByCode[a.traineeCode] ?? [];
        return {
          agent: money ? a : redactAgentRow(a as unknown as Record<string, unknown>, ctx.user?.role) as typeof a,
          requests: reqByCode[a.traineeCode] ?? [],
          payroll: money ? pay : ([] as typeof pay),
          performance: crdtsCycles[a.crdts ?? ""] ?? [],
          violations: violByCode[a.traineeCode] ?? [],
          coaching: coachByCode[a.traineeCode] ?? [],
          logouts: logoutsByCrdts[a.crdts ?? ""] ?? [],
          // "Total paid" = money that actually LEFT: amountPaid when recorded
          // (full finalPay incl. commission/adjustments, and partials count),
          // falling back to net+commission for legacy paid rows with no amount.
          totalPaidEgp: money ? pay.reduce((s, p) => {
            const paid = parseFloat(String(p.amountPaid ?? 0)) || 0;
            if (paid > 0) return s + paid;
            if (p.paymentStatus === "paid") {
              return s + (parseFloat(String(p.netPay ?? 0)) || 0)
                + (parseFloat(String((p as { commissionEgp?: string | null; commission?: string | null }).commissionEgp ?? (p as { commission?: string | null }).commission ?? 0)) || 0);
            }
            return s;
          }, 0) : 0,
          totalCycles: (crdtsCycles[a.crdts ?? ""] ?? []).length,
          totalRevenue: (crdtsCycles[a.crdts ?? ""] ?? []).reduce((s, r) => s + parseFloat(String(r.revenue ?? 0)), 0),
          totalProfit: (crdtsCycles[a.crdts ?? ""] ?? []).reduce((s, r) => s + parseFloat(String(r.profit ?? 0)), 0),
        };
      });
    }),
  // Admin: get all terminated/resigned agents pending deletion
  pendingDeletion: staffProcedure
    .query(() => getPendingDeletionAgents()),
  // Get pending (scheduled, not yet applied) separation for an agent
  getPendingForAgent: staffProcedure
    .input(z.object({ agentCode: z.string() }))
    .query(({ input }) => getPendingSeparationForAgent(input.agentCode)),
  // Schedule a future resignation (stays active until effectiveDate)
  scheduleResignation: staffProcedure
    .input(z.object({
      agentCode: z.string(),
      effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      reason: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const adminName = ctx.user?.name ?? ctx.user?.email ?? "Unknown Admin";
      await scheduleResignation(input.agentCode, input.effectiveDate, input.reason, adminName);
      return { success: true };
    }),
  // Cancel a pending scheduled separation
  cancelScheduled: staffProcedure
    .input(z.object({ agentCode: z.string() }))
    .mutation(async ({ input }) => {
      await cancelScheduledSeparation(input.agentCode);
      return { success: true };
    }),
});
// ─── Payroll v2 Router ───────────────────────────────────────────────────────
const payrollV2Router = router({
  uploadPayrollV2: roleProcedure("finance", "hr", "manager")
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
      if (!/^\d{4}-\d{2}$/.test(input.month)) throw new TRPCError({ code: "BAD_REQUEST", message: "month must be YYYY-MM" });

      // Duplicate CRDTS guard — warn if same CRDTS appears more than once
      const crdtsCounts = input.rows.reduce((m, r) => { m[r.crdts] = (m[r.crdts] ?? 0) + 1; return m; }, {} as Record<string, number>);
      const dupWarnings = Object.entries(crdtsCounts)
        .filter(([, count]) => count > 1)
        .map(([crdts, count]) => ({ crdts, alias: null, type: "duplicate_crdts", message: `CRDTS ${crdts} appears ${count} times — only the last row will be saved.` }));

      // Validate EVERY row before writing ANY. A bad number must never be stored and paid silently.
      const problems: Array<{ crdts: string; problems: string[] }> = [];
      for (const row of input.rows) {
        const p = validatePayrollRow(row);
        if (p.length) problems.push({ crdts: row.crdts, problems: p });
      }
      if (problems.length) {
        const preview = problems.slice(0, 5).map(p => `${p.crdts}: ${p.problems.join("; ")}`).join(" | ");
        throw new TRPCError({ code: "BAD_REQUEST", message: `${problems.length} row(s) failed validation — nothing was saved. ${preview}${problems.length > 5 ? ` … +${problems.length - 5} more` : ""}` });
      }

      // Commission is NEVER auto-attached during payroll upload — HR enters it in the Salary tab.
      // Warn if a re-upload would silently overwrite coaching or commission that was already
      // entered manually — the uploader should be aware before proceeding.
      const uploadWarnings: Array<{ crdts: string; alias?: string | null; type: string; message: string }> = [];
      {
        const { getDb: _uwGetDb } = await import("./db");
        const _uwDb = await _uwGetDb();
        if (_uwDb) {
          const { payrollRecords: _uwPr } = await import("../drizzle/schema");
          const { inArray: _uwIn, and: _uwAnd, eq: _uwEq, sql: _uwSql } = await import("drizzle-orm");
          const uploadCrdts = input.rows.map(r => r.crdts).filter(Boolean);
          if (uploadCrdts.length > 0) {
            const existing = await _uwDb.select({
              crdts: _uwPr.crdts, alias: _uwPr.alias,
              coachingBonus: _uwPr.coachingBonus,
              commissionEgp: _uwPr.commissionEgp,
            }).from(_uwPr)
              .where(_uwAnd(_uwSql`${_uwPr.crdts} IN (${_uwSql.raw(uploadCrdts.map(() => "?").join(","))})` as ReturnType<typeof _uwEq>,
                _uwEq(_uwPr.month as Parameters<typeof _uwEq>[0], input.month)));
            for (const ex of existing) {
              const coaching = parseFloat(String(ex.coachingBonus ?? "0"));
              const commission = parseFloat(String(ex.commissionEgp ?? "0"));
              if (coaching > 0 || commission > 0) {
                const parts = [coaching > 0 ? `coaching bonus ${coaching.toFixed(2)} EGP` : null, commission > 0 ? `commission ${commission.toFixed(2)} EGP` : null].filter(Boolean).join(" and ");
                uploadWarnings.push({ crdts: ex.crdts ?? "?", alias: ex.alias, type: "overwrite_protected_fields", message: `Existing ${parts} for ${ex.alias ?? ex.crdts} in ${input.month} — re-upload will NOT overwrite these; they remain intact.` });
              }
            }
          }
        }
      }

      // One transaction: either the whole month lands or none of it does.
      const { upsertPayrollRecordsV2Batch } = await import("./db");
      const batch = await upsertPayrollRecordsV2Batch(input.rows.map(row => ({ ...row, month: input.month, uploadedBy, uploadedAt })));
      await auditEntry(ctx.user, "upload_payroll", "payroll_month", input.month, JSON.stringify({ rows: input.rows.length, ...batch }));

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
          if (!knownCrdts.has(row.crdts)) {
            warnings.push({ crdts: row.crdts, alias, type: "unknown_agent", message: `CRDTS "${row.crdts}" not found in workforce roster` });
          }
          if (row.netPay !== undefined && row.netPay < 0) {
            warnings.push({ crdts: row.crdts, alias, type: "negative_net_pay", message: `Net pay is negative (${row.netPay.toFixed(2)} EGP) — check deductions` });
          }
          if (row.totalDeductions !== undefined && row.baseSalary !== undefined && row.baseSalary > 0 && row.totalDeductions > row.baseSalary) {
            warnings.push({ crdts: row.crdts, alias, type: "deductions_exceed_salary", message: `Total deductions (${row.totalDeductions.toFixed(0)} EGP) exceed base salary (${row.baseSalary.toFixed(0)} EGP)` });
          }
        }
      }

      if ((batch as { skippedPaid?: number }).skippedPaid) {
        warnings.push({ crdts: "—", type: "skipped_paid", message: `${(batch as { skippedPaid?: number }).skippedPaid} row(s) skipped: already marked PAID. Unmark them first if a correction is intended.` });
      }
      return { success: true, count: input.rows.length, commissionCycle: "", commissionAttached: 0, warnings: [...dupWarnings, ...uploadWarnings, ...warnings] };
    }),

  getStatusPage: roleProcedure("finance", "hr", "manager")
    .input(z.object({ month: z.string() }))
    .query(({ input }) => getPayrollStatusPage(input.month)),

  setStatus: roleProcedure("finance", "hr", "manager")
    .input(z.object({ id: z.number(), status: z.enum(["pending", "paid"]) }))
    .mutation(async ({ input, ctx }) => {
      const { getDb, getPayrollRecordWithAdjustments } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { payrollRecords } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const rec = await getPayrollRecordWithAdjustments(input.id);
      if (!rec) throw new TRPCError({ code: "NOT_FOUND", message: "Record not found" });
      // "Paid" means the FULL amount owed (net + commission + adjustments) has been paid.
      const total = calcFinalPay(rec.record, rec.adjustments);
      await db.update(payrollRecords).set({
        paymentStatus: input.status,
        paidAt: input.status === "paid" ? Date.now() : null,
        paidBy: input.status === "paid" ? (ctx.user.name ?? ctx.user.email ?? "admin") : null,
        amountPaid: input.status === "paid" ? total.toFixed(2) : null,
      }).where(eq(payrollRecords.id, input.id));
      await auditEntry(ctx.user, input.status === "paid" ? "mark_paid" : "mark_unpaid", "payroll", String(input.id), JSON.stringify({ total }));
      return { ok: true };
    }),

  updateRecord: roleProcedure("finance", "hr", "manager")
    .input(z.object({
      id: z.number(),
      lastKnownPaidAt: z.number().nullable().optional(),
      lastKnownRecordUpdatedAt: z.number().nullable().optional(),
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
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("./db");
      const { payrollRecords } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      // Optimistic locking — recordUpdatedAt is stamped on every edit so it
      // protects BOTH paid and unpaid records (paidAt=null was blind to unpaid)
      if (input.lastKnownRecordUpdatedAt !== undefined && input.lastKnownRecordUpdatedAt !== null) {
        const [cur] = await db.select({ rua: payrollRecords.recordUpdatedAt } as never)
          .from(payrollRecords).where(eq(payrollRecords.id, input.id)).limit(1) as Array<{ rua: number | null }>;
        if (cur && cur.rua !== null && cur.rua !== input.lastKnownRecordUpdatedAt) {
          throw new TRPCError({ code: "CONFLICT", message: "Record was updated by someone else — please refresh and try again." });
        }
      } else if (input.lastKnownPaidAt !== undefined) {
        // Legacy fallback for clients that only send lastKnownPaidAt
        const [cur] = await db.select({ paidAt: payrollRecords.paidAt }).from(payrollRecords).where(eq(payrollRecords.id, input.id)).limit(1);
        if (cur && cur.paidAt !== null && cur.paidAt !== input.lastKnownPaidAt) {
          throw new TRPCError({ code: "CONFLICT", message: "Record was updated by someone else — please refresh and try again." });
        }
      }
      const updates: Record<string, string | null> = {};
      const NUMERIC_FIELDS = ["baseSalary","ot1x5Hours","ot1x5Pay","ot2xHours","ot2xPay","ot3xHours","ot3xPay","coachingBonus","commissionEgp","totalDeductions","netPay","workingHours"];
      for (const [k, v] of Object.entries(input.data)) {
        if (v !== undefined) {
          const val = v === "" ? null : v;
          if (val !== null && NUMERIC_FIELDS.includes(k)) {
            const clean = val.replace(/,/g, ""); // strip formatting commas
            const num = parseFloat(clean);
            if (isNaN(num)) throw new TRPCError({ code: "BAD_REQUEST", message: `${k} must be a valid number` });
            if (num < 0) throw new TRPCError({ code: "BAD_REQUEST", message: `${k} cannot be negative` });
            updates[k] = clean;
          } else {
            updates[k] = val;
          }
        }
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
      // Stamp the edit timestamp — used as optimistic lock token on next edit
      (updates as Record<string, unknown>).recordUpdatedAt = Date.now();
      await db.update(payrollRecords).set(updates).where(eq(payrollRecords.id, input.id));
      // Amounts may have changed on a record already marked paid — re-derive status.
      const { recomputePaymentStatus } = await import("./db");
      await recomputePaymentStatus(input.id);
      await auditEntry(ctx.user, "edit_payroll_record", "payroll", String(input.id), JSON.stringify({ changes: updates }));
      return { success: true };
    }),

  // Agent portal: derive CRDTS from cookie automatically
  getMyMonthsFromCookie: agentProcedure.query(async ({ ctx }) => {
    const agent = await getWorkforceAgentByCode(ctx.agent.traineeCode);
    if (!agent?.crdts) return [];
    return getMyPayrollMonthsByCrdts(agent.crdts);
  }),
  getMyRecordFromCookie: agentProcedure
    .input(z.object({ month: z.string() }))
    .query(async ({ ctx, input }) => {
      const agent = await getWorkforceAgentByCode(ctx.agent.traineeCode);
      if (!agent?.crdts) return null;
      return getMyPayrollRecordByCrdts(agent.crdts, input.month);
    }),
  // Admin: get all payroll records for a specific agent by CRDTS
  getAgentPayrollHistory: roleProcedure("finance", "hr", "manager")
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

  /** Bulk mark a selected list of payroll IDs as paid. Records who clicked it. */
  bulkMarkPaid: roleProcedure("finance", "hr", "manager")
    .input(z.object({ ids: z.array(z.number()).min(1), month: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("./db");
      const { inArray } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { payrollRecords } = await import("../drizzle/schema");
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "No authenticated user found." });
      const paidBy = ctx.user.name ?? ctx.user.email ?? "Unknown Admin";
      const paidAt = Date.now();
      const { getPayrollRecordWithAdjustments } = await import("./db");
      const { eq } = await import("drizzle-orm");
      // Prefetch OUTSIDE the transaction: helper reads open their own pool
      // connection, and doing that inside an open tx can exhaust the pool.
      const prefetched = [] as Array<{ id: number; total: number }>;
      for (const id of input.ids) {
        const rec = await getPayrollRecordWithAdjustments(id);
        if (!rec) continue;
        prefetched.push({ id, total: calcFinalPay(rec.record, rec.adjustments) });
      }
      await db.transaction(async (tx) => {
        for (const { id, total } of prefetched) {
          // Marking paid records the full amount owed so "remaining" is 0 and reports reconcile.
          await tx.update(payrollRecords)
            .set({ paymentStatus: "paid", paidAt, paidBy, amountPaid: total.toFixed(2) } as never)
            .where(eq(payrollRecords.id, id));
        }
      });
      await auditEntry(ctx.user, "bulk_mark_paid", "payroll", input.month, JSON.stringify({ ids: input.ids, count: input.ids.length, paidBy }));
      return { ok: true, count: input.ids.length, paidBy };
    }),

  /** Bulk partial pay — pay a fixed amount to each selected agent. */
  bulkPartialPay: roleProcedure("finance", "hr", "manager")
    .input(z.object({ ids: z.array(z.number()).min(1), amountEach: z.number().positive(), month: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { payrollRecords } = await import("../drizzle/schema");
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "No authenticated user." });
      const paidBy = ctx.user.name ?? ctx.user.email ?? "Unknown Admin";
      const paidAt = Date.now();
      let count = 0;
      // Prefetch OUTSIDE the transaction (see bulkMarkPaid) — and de-dupe ids so
      // a double-included row can't be paid twice in one call.
      const { getPayrollRecordWithAdjustments } = await import("./db");
      const prefetched = [] as Array<{ id: number; totalPaid: number; fullyPaid: boolean }>;
      for (const id of Array.from(new Set(input.ids))) {
        const full = await getPayrollRecordWithAdjustments(id);
        const rec = full?.record;
        if (!rec || rec.paymentStatus === "paid") continue;
        const owed = calcFinalPay(rec, full!.adjustments); // net + commission + adjustments
        const prevPaid = parseFloat(String((rec as Record<string, unknown>).amountPaid ?? "0"));
        const totalPaid = Math.min(prevPaid + input.amountEach, owed);
        prefetched.push({ id, totalPaid, fullyPaid: totalPaid >= owed - 0.005 });
      }
      await db.transaction(async (tx) => {
        for (const { id, totalPaid, fullyPaid } of prefetched) {
          await tx.update(payrollRecords).set({
            amountPaid: String(totalPaid.toFixed(2)), paidBy, paidAt,
            paymentStatus: fullyPaid ? "paid" : "pending",
          } as never).where(eq(payrollRecords.id, id));
          count++;
        }
      });
      await auditEntry(ctx.user, "bulk_partial_pay", "payroll", input.month, JSON.stringify({ ids: input.ids, amountEach: input.amountEach, count, paidBy }));
      return { ok: true, count, paidBy };
    }),

  /** Partial pay: record a partial amount paid and who paid it.
   *  Status stays "pending" until pay reaches netPay (then auto-flips to paid). */
  partialPay: roleProcedure("finance", "hr", "manager")
    .input(z.object({ id: z.number(), amountPaid: z.number().positive() }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("./db");
      const { and: andOp, eq, sql: sqlLock } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { payrollRecords, payrollAdjustments } = await import("../drizzle/schema");
      const paidBy = ctx.user.name ?? ctx.user.email ?? "Unknown Admin";
      const paidAt = Date.now();

      const result = await db.transaction(async (tx) => {
        // Lock the row first so concurrent partial-pay calls are serialised.
        const locked = await tx.select().from(payrollRecords)
          .where(eq(payrollRecords.id, input.id)).for("update").limit(1);
        const rec = locked[0];
        if (!rec) throw new TRPCError({ code: "NOT_FOUND", message: "Record not found" });
        const adjs = rec.crdts && rec.month
          ? await tx.select().from(payrollAdjustments)
              .where(andOp(eq(payrollAdjustments.crdts, rec.crdts), eq(payrollAdjustments.month, rec.month)))
          : [];
        const owed = calcFinalPay(rec, adjs);
        const prevPaid = parseFloat(String((rec as Record<string, unknown>).amountPaid ?? "0"));
        const stillOwed = Math.max(0, owed - prevPaid);
        // Cap: never record more than what is owed.
        if (input.amountPaid > stillOwed + 0.005) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Amount exceeds the remaining balance (EGP ${stillOwed.toFixed(2)}).` });
        }
        const totalPaid = prevPaid + input.amountPaid;
        const fullyPaid = totalPaid >= owed - 0.005;
        await tx.update(payrollRecords)
          .set({
            amountPaid: String(totalPaid.toFixed(2)),
            paidBy,
            paidAt,
            paymentStatus: fullyPaid ? "paid" : "pending",
          } as never)
          .where(eq(payrollRecords.id, input.id));
        return { totalPaid, owed, fullyPaid };
      });

      const remaining = Math.max(0, result.owed - result.totalPaid);
      await auditEntry(ctx.user, "partial_pay", "payroll", String(input.id), JSON.stringify({ amountPaid: input.amountPaid, totalPaid: result.totalPaid, remaining, fullyPaid: result.fullyPaid, paidBy }));
      return { ok: true, totalPaid: result.totalPaid, remaining, fullyPaid: result.fullyPaid, paidBy };
    }),

  /** Pay the remaining balance on a partially-paid record. */
  payRemaining: roleProcedure("finance", "hr", "manager")
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { payrollRecords } = await import("../drizzle/schema");
      const { getPayrollRecordWithAdjustments } = await import("./db");
      const full = await getPayrollRecordWithAdjustments(input.id);
      if (!full) throw new TRPCError({ code: "NOT_FOUND", message: "Record not found" });
      const paidBy = ctx.user.name ?? ctx.user.email ?? "Unknown Admin";
      const total = calcFinalPay(full.record, full.adjustments);
      await db.update(payrollRecords)
        .set({ amountPaid: total.toFixed(2), paidBy, paidAt: Date.now(), paymentStatus: "paid" } as never)
        .where(eq(payrollRecords.id, input.id));
      await auditEntry(ctx.user, "pay_remaining", "payroll", String(input.id), JSON.stringify({ paidBy, total }));
      return { ok: true, paidBy };
    }),

  /** Monthly payroll stats and insights. */
  statsForMonth: roleProcedure("finance", "hr", "manager")
    .input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return null;
      const { payrollRecords } = await import("../drizzle/schema");
      const rows = await db.select().from(payrollRecords).where(eq(payrollRecords.month, input.month));
      if (rows.length === 0) return null;
      const n = (v: unknown) => parseFloat(String(v ?? "0")) || 0;
      const paid = rows.filter(r => r.paymentStatus === "paid");
      const pending = rows.filter(r => r.paymentStatus !== "paid");
      const totalNetPay = rows.reduce((s, r) => s + n(r.netPay), 0);
      const totalBaseSalary = rows.reduce((s, r) => s + n(r.baseSalary), 0);
      const totalOTPay = rows.reduce((s, r) => s + n(r.ot1x5Pay) + n(r.ot2xPay) + n(r.ot3xPay), 0);
      const totalOTHours = rows.reduce((s, r) => s + n(r.ot1x5Hours) + n(r.ot2xHours) + n(r.ot3xHours), 0);
      const totalDeductions = rows.reduce((s, r) => s + n(r.totalDeductions), 0);
      const totalCommission = rows.reduce((s, r) => s + n(r.commissionEgp), 0);
      const totalCoachingBonus = rows.reduce((s, r) => s + n(r.coachingBonus), 0);
      const totalQualityDeductions = rows.reduce((s, r) => s + n(r.qualityDeductions), 0);
      const totalAttendanceDeductions = rows.reduce((s, r) => s + n(r.attendanceDeductions), 0);
      const paidByMap = paid.reduce((m, r) => { const raw = (r as Record<string, unknown>).paidBy as string | null; const k = raw && raw.trim() ? raw.trim() : "Bulk Import / Legacy"; m[k] = (m[k] ?? 0) + 1; return m; }, {} as Record<string, number>);
      // Final totals = net + commission + manual adjustments (what is actually
      // owed/paid). Adjustments join by the ONE widened-identity rule (same as
      // the payslip, the status table, and the mark-paid math).
      const { payrollAdjustments: adjT, workforceAgents: waT } = await import("../drizzle/schema");
      const { isNotNull: notNullOp } = await import("drizzle-orm");
      const allAdj = await db.select().from(adjT).where(eq(adjT.month, input.month));
      const { widenCrdtsAgainst, adjMatchesIdentity } = await import("./db");
      const rosterCrdts = (await db.select({ crdts: waT.crdts }).from(waT).where(notNullOp(waT.crdts))).map(a => a.crdts);
      const adjFor = (r: typeof rows[number]) => {
        const identity = widenCrdtsAgainst(String(r.crdts ?? ""), rosterCrdts);
        return allAdj.filter(a => adjMatchesIdentity(a.crdts, identity));
      };
      const totalFinalPay = rows.reduce((s, r) => s + calcFinalPay(r, adjFor(r)), 0);
      const totalPaidAmount = rows.reduce((s, r) => s + (r.paymentStatus === "paid" ? calcFinalPay(r, adjFor(r)) : n((r as Record<string, unknown>).amountPaid)), 0);
      const totalOutstanding = Math.max(0, totalFinalPay - totalPaidAmount);
      // Highest earner
      const sorted = [...rows].sort((a, b) => n(b.netPay) - n(a.netPay));
      return {
        month: input.month,
        headcount: rows.length,
        paidCount: paid.length,
        pendingCount: pending.length,
        totalFinalPay, totalPaidAmount, totalOutstanding,
        totalNetPay, totalBaseSalary, totalOTPay, totalOTHours,
        totalDeductions, totalCommission, totalCoachingBonus,
        totalQualityDeductions, totalAttendanceDeductions,
        avgNetPay: totalNetPay / rows.length,
        maxNetPay: n(sorted[0]?.netPay),
        minNetPay: n(sorted[sorted.length - 1]?.netPay),
        paidByBreakdown: paidByMap,
        otAgentCount: rows.filter(r => n(r.ot1x5Pay) + n(r.ot2xPay) + n(r.ot3xPay) > 0).length,
        commissionAgentCount: rows.filter(r => n(r.commissionEgp) > 0).length,
        topEarner: sorted[0] ? { crdts: sorted[0].crdts, alias: sorted[0].alias, netPay: n(sorted[0].netPay) } : null,
        partiallyPaidCount: rows.filter(r => { const a = n((r as Record<string, unknown>).amountPaid); return a > 0 && r.paymentStatus !== "paid"; }).length,
      };
    }),

  // Admin: delete all payroll V2 rows for a specific month (undo a bad import)
  deleteForMonth: adminProcedure
    .input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("./db");
      const { eq: eqOp } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { payrollRecords } = await import("../drizzle/schema");
      const result = await db.delete(payrollRecords).where(eqOp(payrollRecords.month, input.month));
      await auditEntry(ctx.user, "delete_payroll_month", "payroll", input.month, JSON.stringify({ deleted: (result as { rowsAffected?: number }).rowsAffected ?? 0 }));
      return { deleted: (result as { rowsAffected?: number }).rowsAffected ?? 0 };
    }),
});
// ─── Orientation Router ────────────────────────────────────────────────────────
const orientationRouter = router({
  getStatus: agentProcedure.query(async ({ ctx }) => {
    const shown = await getOrientationStatus(ctx.agent.traineeCode);
    return { shown };
  }),
  markShown: agentProcedure.mutation(async ({ ctx }) => {
    await markOrientationShown(ctx.agent.traineeCode);
  }),
  reset: staffProcedure
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
  list: staffProcedure
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

/* ══════════════════════════════════════════════════════════════════════════
 * TANIS ACADEMY — courses, assignments, progress, and data-driven suggestions.
 * ══════════════════════════════════════════════════════════════════════════ */
const academyRouter = router({
  // ---- Courses -----------------------------------------------------------
  listCourses: staffProcedure
    .input(z.object({ publishedOnly: z.boolean().optional() }).optional())
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq, desc } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return [];
      const { academyCourses } = await import("../drizzle/schema");
      const q = db.select().from(academyCourses).$dynamic();
      if (input?.publishedOnly) q.where(eq(academyCourses.isPublished, true));
      return q.orderBy(desc(academyCourses.createdAt));
    }),

  createCourse: roleProcedure("hr", "manager")
    .input(z.object({
      title: z.string().min(1).max(255),
      description: z.string().optional(),
      category: z.string().max(100).optional(),
      remediesViolation: z.string().max(150).optional(),
      isMandatory: z.boolean().optional(),
      passMark: z.number().int().min(0).max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { academyCourses } = await import("../drizzle/schema");
      await db.insert(academyCourses).values({
        title: input.title,
        description: input.description ?? null,
        category: input.category ?? null,
        remediesViolation: input.remediesViolation ?? null,
        isMandatory: input.isMandatory ?? false,
        passMark: input.passMark ?? 0,
        isPublished: false,
        createdBy: ctx.user?.email ?? ctx.user?.openId ?? null,
        createdAt: Date.now(),
      } as never);
      return { ok: true } as const;
    }),

  publishCourse: roleProcedure("hr", "manager")
    .input(z.object({ id: z.number(), isPublished: z.boolean() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { academyCourses } = await import("../drizzle/schema");
      await db.update(academyCourses).set({ isPublished: input.isPublished, updatedAt: Date.now() })
        .where(eq(academyCourses.id, input.id));
      return { ok: true } as const;
    }),

  // ---- Modules -----------------------------------------------------------
  listModules: staffProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq, asc } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return [];
      const { academyModules } = await import("../drizzle/schema");
      return db.select().from(academyModules)
        .where(eq(academyModules.courseId, input.courseId))
        .orderBy(asc(academyModules.sortOrder));
    }),

  addModule: roleProcedure("hr", "manager")
    .input(z.object({
      courseId: z.number(),
      title: z.string().min(1).max(255),
      contentType: z.enum(["video", "pdf", "link", "text"]),
      contentUrl: z.string().optional(),
      body: z.string().optional(),
      durationMins: z.number().int().min(0).optional(),
      sortOrder: z.number().int().optional(),
    }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { academyModules } = await import("../drizzle/schema");
      await db.insert(academyModules).values({
        courseId: input.courseId,
        title: input.title,
        contentType: input.contentType,
        contentUrl: input.contentUrl ?? null,
        body: input.body ?? null,
        durationMins: input.durationMins ?? 0,
        sortOrder: input.sortOrder ?? 0,
        createdAt: Date.now(),
      } as never);
      return { ok: true } as const;
    }),

  // ---- Assignments -------------------------------------------------------
  listAssignments: staffProcedure
    .input(z.object({ courseId: z.number().optional(), traineeCode: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq, and, desc } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return [];
      const { academyAssignments } = await import("../drizzle/schema");
      const conds = [];
      if (input?.courseId) conds.push(eq(academyAssignments.courseId, input.courseId));
      if (input?.traineeCode) conds.push(eq(academyAssignments.traineeCode, input.traineeCode));
      const q = db.select().from(academyAssignments).$dynamic();
      if (conds.length) q.where(and(...conds));
      return q.orderBy(desc(academyAssignments.assignedAt));
    }),

  assign: roleProcedure("hr", "manager")
    .input(z.object({
      courseId: z.number(),
      traineeCodes: z.array(z.string()).min(1),
      dueDate: z.string().optional(),
      reason: z.string().max(255).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("./db");
      const { and, eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { academyAssignments } = await import("../drizzle/schema");
      let created = 0;
      for (const code of input.traineeCodes) {
        // Don't double-assign the same course to the same person.
        const existing = await db.select().from(academyAssignments).where(and(
          eq(academyAssignments.courseId, input.courseId),
          eq(academyAssignments.traineeCode, code),
        )).limit(1);
        if (existing.length) continue;
        await db.insert(academyAssignments).values({
          courseId: input.courseId, traineeCode: code,
          dueDate: input.dueDate ?? null,
          assignedBy: ctx.user?.email ?? null,
          status: "assigned", reason: input.reason ?? null,
          assignedAt: Date.now(),
        } as never);
        created++;
      }
      return { ok: true, created } as const;
    }),

  /** Suggestions — driven by the Hub's own data rather than guesswork:
   *  repeat violations, repeat client logouts, and repeat coaching sessions all
   *  point at agents who need training, matched to a course where possible. */
  suggestions: staffProcedure.query(async () => {
    const { getDb } = await import("./db");
    const { gte } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return [];
    const { agentViolations, clientLogouts, coachingSessions, workforceAgents, academyCourses } = await import("../drizzle/schema");

    // Look back over the last 60 days — recent enough to be actionable.
    const since = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
    const [viol, logouts, coaching, agents, courses] = await Promise.all([
      db.select().from(agentViolations).where(gte(agentViolations.date, since)),
      db.select().from(clientLogouts).where(gte(clientLogouts.date, since)),
      db.select().from(coachingSessions).where(gte(coachingSessions.sessionDate, since)),
      db.select().from(workforceAgents),
      db.select().from(academyCourses),
    ]);

    const byCrdts = new Map(agents.filter(a => a.crdts).map(a => [a.crdts as string, a]));
    const out: { traineeCode: string; crdts: string; alias: string | null; reason: string; courseId: number | null; courseTitle: string | null; count: number }[] = [];

    // 3+ of the SAME violation type → suggest the course that remedies it.
    const vKey = new Map<string, number>();
    viol.forEach(v => { if (v.crdts) vKey.set(`${v.crdts}||${v.type}`, (vKey.get(`${v.crdts}||${v.type}`) ?? 0) + 1); });
    vKey.forEach((count, k) => {
      if (count < 3) return;
      const [crdts, type] = k.split("||");
      const a = byCrdts.get(crdts);
      if (!a) return;
      const course = courses.find(c => c.remediesViolation && c.remediesViolation.toLowerCase() === (type || "").toLowerCase());
      out.push({
        traineeCode: a.traineeCode, crdts, alias: a.alias ?? a.fullName ?? null,
        reason: `${count}× ${type}`, courseId: course?.id ?? null, courseTitle: course?.title ?? null, count,
      });
    });

    // 3+ client logouts → reliability/performance training.
    const lKey = new Map<string, number>();
    logouts.forEach(l => { if (l.crdts) lKey.set(l.crdts, (lKey.get(l.crdts) ?? 0) + 1); });
    lKey.forEach((count, crdts) => {
      if (count < 3) return;
      const a = byCrdts.get(crdts);
      if (!a) return;
      out.push({
        traineeCode: a.traineeCode, crdts, alias: a.alias ?? a.fullName ?? null,
        reason: `${count} client logouts`, courseId: null, courseTitle: null, count,
      });
    });

    // 3+ coaching sessions → the floor already flagged them; formalise it.
    const cKey = new Map<string, number>();
    coaching.forEach(c => { if (c.crdts) cKey.set(c.crdts, (cKey.get(c.crdts) ?? 0) + 1); });
    cKey.forEach((count, crdts) => {
      if (count < 3) return;
      const a = byCrdts.get(crdts);
      if (!a) return;
      out.push({
        traineeCode: a.traineeCode, crdts, alias: a.alias ?? a.fullName ?? null,
        reason: `${count} coaching sessions`, courseId: null, courseTitle: null, count,
      });
    });

    return out.sort((a, b) => b.count - a.count);
  }),

  // ---- Agent-facing ------------------------------------------------------
  /** The logged-in agent's own courses + per-module progress. */
  myCourses: agentProcedure.query(async ({ ctx }) => {
    const traineeCode = ctx.agent.traineeCode;

    const { getDb } = await import("./db");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return { assignments: [], courses: [], modules: [], progress: [] };
    const { academyAssignments, academyCourses, academyModules, academyProgress } = await import("../drizzle/schema");

    const assignments = await db.select().from(academyAssignments).where(eq(academyAssignments.traineeCode, traineeCode));
    const [courses, modules, progress] = await Promise.all([
      db.select().from(academyCourses).where(eq(academyCourses.isPublished, true)),
      db.select().from(academyModules),
      db.select().from(academyProgress).where(eq(academyProgress.traineeCode, traineeCode)),
    ]);
    return { assignments, courses, modules, progress };
  }),

  /** Agent marks one module done; the course auto-completes when all are done. */
  completeModule: agentProcedure
    .input(z.object({ courseId: z.number(), moduleId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const traineeCode = ctx.agent.traineeCode;

      const { getDb } = await import("./db");
      const { and, eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { academyProgress, academyModules, academyAssignments } = await import("../drizzle/schema");

      const already = await db.select().from(academyProgress).where(and(
        eq(academyProgress.traineeCode, traineeCode),
        eq(academyProgress.moduleId, input.moduleId),
      )).limit(1);
      if (!already.length) {
        await db.insert(academyProgress).values({
          traineeCode, courseId: input.courseId, moduleId: input.moduleId, completedAt: Date.now(),
        } as never);
      }

      const [mods, done] = await Promise.all([
        db.select().from(academyModules).where(eq(academyModules.courseId, input.courseId)),
        db.select().from(academyProgress).where(and(
          eq(academyProgress.traineeCode, traineeCode),
          eq(academyProgress.courseId, input.courseId),
        )),
      ]);
      if (mods.length > 0 && done.length >= mods.length) {
        // If the course has a quiz (passMark > 0 AND questions exist), finishing
        // modules only unlocks the assessment — completion happens in submitQuiz.
        const { academyCourses, academyQuizQuestions } = await import("../drizzle/schema");
        const [courseRow] = await db.select().from(academyCourses).where(eq(academyCourses.id, input.courseId)).limit(1);
        const questions = await db.select({ id: academyQuizQuestions.id }).from(academyQuizQuestions)
          .where(eq(academyQuizQuestions.courseId, input.courseId));
        const hasQuiz = (courseRow?.passMark ?? 0) > 0 && questions.length > 0;
        if (!hasQuiz) {
          await db.update(academyAssignments)
            .set({ status: "completed", completedAt: Date.now() })
            .where(and(
              eq(academyAssignments.traineeCode, traineeCode),
              eq(academyAssignments.courseId, input.courseId),
            ));
        }
      }
      return { ok: true } as const;
    }),

  // ---- CEFR English Assessment (admin toggle + score storage) ---------------
  /** Is the English Level assessment enabled for agents? Default: true */
  getCefrEnabled: publicProcedure.query(async () => {
    const { getDb } = await import("./db");
    const { appSettings } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return true;
    const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "cefr_enabled")).limit(1);
    return row ? row.value !== "false" : true;
  }),
  setCefrEnabled: roleProcedure("hr", "manager")
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("./db");
      const { appSettings } = await import("../drizzle/schema");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      // ORM upsert — replaces raw SQL
      await db.insert(appSettings).values({
        key: "cefr_enabled",
        value: input.enabled ? "true" : "false",
        updatedAt: Date.now(),
        updatedBy: ctx.user?.name ?? "admin",
      }).onDuplicateKeyUpdate({
        set: {
          value: input.enabled ? "true" : "false",
          updatedAt: Date.now(),
          updatedBy: ctx.user?.name ?? "admin",
        },
      });
      return { ok: true };
    }),
  /** Agent submits their CEFR result (called after they see their score). */
  submitCefrScore: agentProcedure
    .input(z.object({ level: z.string(), score: z.number().int().min(0).max(60), totalQuestions: z.number().int().default(60) }))
    .mutation(async ({ ctx, input }) => {
      const traineeCode = ctx.agent.traineeCode;
      const { getDb } = await import("./db");
      const { englishScores } = await import("../drizzle/schema");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.insert(englishScores).values({ traineeCode, level: input.level, score: input.score, totalQuestions: input.totalQuestions, takenAt: Date.now() });
      return { ok: true };
    }),
  /** Admin: all CEFR scores (latest per agent). */
  listCefrScores: staffProcedure.query(async () => {
    const { getDb } = await import("./db");
    const { englishScores, workforceAgents } = await import("../drizzle/schema");
    const { desc } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return [];
    const allScores = await db.select().from(englishScores).orderBy(desc(englishScores.takenAt));
    const agents = await db.select({ traineeCode: workforceAgents.traineeCode, fullName: workforceAgents.fullName, alias: workforceAgents.alias }).from(workforceAgents);
    const agentMap = new Map(agents.map(a => [a.traineeCode, a]));
    // Keep latest per agent
    const seen = new Set<string>();
    const latest = allScores.filter(s => { if (seen.has(s.traineeCode)) return false; seen.add(s.traineeCode); return true; });
    return latest.map(s => ({ ...s, fullName: agentMap.get(s.traineeCode)?.fullName ?? s.traineeCode, alias: agentMap.get(s.traineeCode)?.alias ?? null }));
  }),
  // ---- Quiz (assessment) -------------------------------------------------
  /** Admin: list a course's questions WITH correct answers (builder view). */
  listQuizQuestions: staffProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq, asc } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return [];
      const { academyQuizQuestions } = await import("../drizzle/schema");
      const rows = await db.select().from(academyQuizQuestions)
        .where(eq(academyQuizQuestions.courseId, input.courseId))
        .orderBy(asc(academyQuizQuestions.sortOrder), asc(academyQuizQuestions.id));
      return rows.map(r => ({ ...r, options: JSON.parse(r.options) as string[] }));
    }),

  addQuizQuestion: roleProcedure("hr", "manager")
    .input(z.object({
      courseId: z.number(),
      question: z.string().min(1).max(2000),
      options: z.array(z.string().min(1).max(500)).min(2).max(6),
      correctIndex: z.number().int().min(0),
      sortOrder: z.number().int().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.correctIndex >= input.options.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "correctIndex out of range" });
      }
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { academyQuizQuestions } = await import("../drizzle/schema");
      await db.insert(academyQuizQuestions).values({
        courseId: input.courseId,
        question: input.question,
        options: JSON.stringify(input.options),
        correctIndex: input.correctIndex,
        sortOrder: input.sortOrder ?? 0,
        createdBy: ctx.user?.email ?? ctx.user?.openId ?? null,
        createdAt: Date.now(),
      } as never);
      return { ok: true } as const;
    }),

  deleteQuizQuestion: roleProcedure("hr", "manager")
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { academyQuizQuestions } = await import("../drizzle/schema");
      await db.delete(academyQuizQuestions).where(eq(academyQuizQuestions.id, input.id));
      return { ok: true } as const;
    }),

  /** Admin: set/change a course's pass mark (0 disables the quiz gate). */
  setPassMark: roleProcedure("hr", "manager")
    .input(z.object({ courseId: z.number(), passMark: z.number().int().min(0).max(100) }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { academyCourses } = await import("../drizzle/schema");
      await db.update(academyCourses).set({ passMark: input.passMark, updatedAt: Date.now() })
        .where(eq(academyCourses.id, input.courseId));
      return { ok: true } as const;
    }),

  /** Agent: fetch quiz questions for a course — correct answers stripped. */
  getQuiz: agentProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ ctx, input }) => {

      const { getDb } = await import("./db");
      const { eq, asc } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return { passMark: 0, questions: [] as { id: number; question: string; options: string[] }[] };
      const { academyCourses, academyQuizQuestions } = await import("../drizzle/schema");
      const [courseRow] = await db.select().from(academyCourses).where(eq(academyCourses.id, input.courseId)).limit(1);
      const rows = await db.select().from(academyQuizQuestions)
        .where(eq(academyQuizQuestions.courseId, input.courseId))
        .orderBy(asc(academyQuizQuestions.sortOrder), asc(academyQuizQuestions.id));
      return {
        passMark: courseRow?.passMark ?? 0,
        questions: rows.map(r => ({ id: r.id, question: r.question, options: JSON.parse(r.options) as string[] })),
      };
    }),

  /** Agent: submit answers — graded server-side. Writes score to the assignment;
   *  marks it completed only when score >= passMark. Retakes allowed until pass. */
  submitQuiz: agentProcedure
    .input(z.object({
      courseId: z.number(),
      answers: z.array(z.object({ questionId: z.number(), answerIndex: z.number().int().min(0) })),
    }))
    .mutation(async ({ ctx, input }) => {
      const traineeCode = ctx.agent.traineeCode;

      const { getDb } = await import("./db");
      const { and, eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { academyCourses, academyQuizQuestions, academyModules, academyProgress, academyAssignments } = await import("../drizzle/schema");

      // Assessment unlocks only after all modules are done (also enforced in UI).
      const [mods, done] = await Promise.all([
        db.select({ id: academyModules.id }).from(academyModules).where(eq(academyModules.courseId, input.courseId)),
        db.select({ id: academyProgress.id }).from(academyProgress).where(and(
          eq(academyProgress.traineeCode, traineeCode),
          eq(academyProgress.courseId, input.courseId),
        )),
      ]);
      if (mods.length > 0 && done.length < mods.length) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Finish all modules before taking the assessment" });
      }

      const [courseRow] = await db.select().from(academyCourses).where(eq(academyCourses.id, input.courseId)).limit(1);
      const questions = await db.select().from(academyQuizQuestions)
        .where(eq(academyQuizQuestions.courseId, input.courseId));
      if (!questions.length) throw new TRPCError({ code: "NOT_FOUND", message: "This course has no assessment" });

      const answerMap = new Map(input.answers.map(a => [a.questionId, a.answerIndex]));
      let correct = 0;
      for (const q of questions) {
        if (answerMap.get(q.id) === q.correctIndex) correct++;
      }
      const score = Math.round((correct / questions.length) * 100);
      const passMark = courseRow?.passMark ?? 0;
      const passed = score >= passMark;

      await db.update(academyAssignments)
        .set(passed
          ? { score, status: "completed" as const, completedAt: Date.now() }
          : { score, status: "in_progress" as const })
        .where(and(
          eq(academyAssignments.traineeCode, traineeCode),
          eq(academyAssignments.courseId, input.courseId),
        ));

      return { score, passed, passMark, correctCount: correct, totalQuestions: questions.length } as const;
    }),
});

const employeesRouter = router({
  /** Complete profile bundle for one agent — everything in one call:
   *  salary history, commission history, performance, joining/training dates.
   *  Money sections are visible to all roles EXCEPT bd (checked on the client too). */
  profileFull: staffProcedure
    .input(z.object({ crdts: z.string(), traineeCode: z.string().optional() }))
    .query(async ({ ctx, input }) => {
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

      // Money and client-revenue data only for MONEY_ROLES — enforced here, not just in the client.
      if (!canSeeMoney(ctx.user?.role)) {
        const perfNoMoney = perf.map(r => ({ ...r, revenue: null, profit: null, commissionEgp: null }));
        return {
          payroll: [] as typeof payroll, commissions: [] as typeof commissionRows, leaderboard: [] as typeof leaderboard,
          performance: perfNoMoney as unknown as typeof perf,
          candidate: (candidate ? redactAgentRow(candidate as Record<string, unknown>, ctx.user?.role) : candidate) as typeof candidate,
          joinDate: wfRow?.joinDate ?? null,
        };
      }
      return {
        payroll, commissions: commissionRows, leaderboard, performance: perf,
        candidate, joinDate: wfRow?.joinDate ?? null,
      };
    }),

  /** Everyone — agents AND management. Used by the Employee Profiles tab. */
  list: staffProcedure
    .input(z.object({ type: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const { getDb } = await import("./db");
      const { eq, desc, or, isNull } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return [];
      const { workforceAgents } = await import("../drizzle/schema");
      const q = db.select().from(workforceAgents)
        .where(or(eq(workforceAgents.isDemo, false), isNull(workforceAgents.isDemo)))
        .$dynamic();
      if (input?.type) q.where(eq(workforceAgents.employeeType, input.type as "agent"));
      return redactAgentRows(await q.orderBy(desc(workforceAgents.createdAt)), ctx.user?.role);
    }),

  /** Create a management employee record (Settings → Management). */
  addManagement: staffProcedure
    .input(z.object({
      fullName: z.string().min(1).max(255),
      alias: z.string().max(100).optional(),
      email: z.union([z.string().email(), z.literal(""), z.null()]).optional().transform(v => v || null),
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
  linkLogin: staffProcedure
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
  myProfile: staffProcedure.query(async ({ ctx }) => {
    const openId = ctx.user?.openId;
    if (!openId) return null;
    const { getDb } = await import("./db");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return null;
    const { workforceAgents, users } = await import("../drizzle/schema");
    // 1. Try workforce_agents (agents, TLs, managers with employee records)
    const [agentRow] = await db.select().from(workforceAgents).where(eq(workforceAgents.openId, openId));
    if (agentRow) return { ...agentRow, _source: "workforce" as const };
    // 2. Fall back to users table (admins/owners who have no workforce record)
    const [userRow] = await db.select().from(users).where(eq(users.openId, openId));
    if (userRow) return {
      fullName: userRow.name ?? null,
      alias: null,
      email: userRow.email ?? null,
      phone: (userRow as Record<string,unknown>).phone as string ?? null,
      role: userRow.role,
      employeeType: userRow.role,
      _source: "admin" as const,
    };
    return null;
  }),

  /** Edit your OWN profile — personal details only. Can't touch salary/status/role. */
  updateMyProfile: staffProcedure
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
  bulkInsert: staffProcedure
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

  list: staffProcedure
    .input(z.object({
      agentCode: z.string().optional(),
      crdts: z.string().optional(),
      month: z.string().optional(),
      category: z.enum(["attendance", "quality"]).optional(),
    }))
    .query(({ input }) => listViolations(input)),

  // Agent: own violations only — identity comes from the session, never from input.
  myViolations: agentProcedure
    .input(z.object({ month: z.string().optional() }).optional())
    .query(({ input, ctx }) => listViolations({ agentCode: ctx.agent.traineeCode, month: input?.month })),
});

// ─── Performance v2 Router ────────────────────────────────────────────────────
const performanceV2Router = router({
  bulkUpsert: staffProcedure
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

  getByMonth: staffProcedure
    .input(z.object({ month: z.string() }))
    .query(({ input }) => getPerformanceByMonth(input.month)),

  getMonths: staffProcedure
    .query(() => getPerformanceMonths()),
});

// ─── Adherence Router ─────────────────────────────────────────────────────────

// ─── Cycle Tracker Router ────────────────────────────────────────────────────
const cycleTrackerRouter = router({
  // Admin: upload stats Excel rows
  uploadStats: staffProcedure
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
  uploadDeductions: staffProcedure
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
  uploadOT: staffProcedure
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
  getMyTracker: agentProcedure
    .query(async ({ ctx }) => {
      const traineeCode = ctx.agent.traineeCode;
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
  getCurrentCycle: staffProcedure
    .query(async () => {
      const cycleKey = getCurrentCycleKey();
      const dateRange = getCycleDateRange(cycleKey);
      return { cycleKey, dateRange };
    }),

  // Admin: get team performance summary for a cycle
  getTeamStats: staffProcedure
    .input(z.object({ cycleKey: z.union([z.string().regex(/^\d{4}-\d{2}$/), z.literal("")]).optional() }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const { cycleStats } = await import("../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return [];
      // Empty or missing cycleKey = all-time (no date filter)
      const { ne } = await import("drizzle-orm");
      const DEMO_CRDTS = "999999";
      const rows = input.cycleKey
        ? await db.select().from(cycleStats).where(and(eq(cycleStats.cycleKey, input.cycleKey), ne(cycleStats.crdts, DEMO_CRDTS)))
        : await db.select().from(cycleStats).where(ne(cycleStats.crdts, DEMO_CRDTS));
      // Pull teamLeader from workforce_agents for TL filter
      const { workforceAgents } = await import("../drizzle/schema");
      const agentRows = await db.select({ crdts: workforceAgents.crdts, teamLeader: workforceAgents.teamLeader, fullName: workforceAgents.fullName, alias: workforceAgents.alias }).from(workforceAgents);
      const tlByCrdts = new Map(agentRows.map(a => [a.crdts, a.teamLeader ?? null]));
      const nameByCrdts = new Map(agentRows.map(a => [a.crdts, { fullName: a.fullName ?? null, alias: a.alias ?? null }]));
      // Aggregate by CRDTS
      const byAgent = new Map<string, {
        crdts: string; agentCode: string | null; alias: string | null; fullName: string | null; teamLeader: string | null;
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
            alias: row.alias || nameByCrdts.get(row.crdts)?.alias || null,
            fullName: nameByCrdts.get(row.crdts)?.fullName || null,
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

  /** Calendar-month view of team stats (26th→25th cycle vs Jan 1st→31st month). */
  getMonthlyTeamStats: staffProcedure
    .input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const { cycleStats, workforceAgents } = await import("../drizzle/schema");
      const { sql, ne: neMonth } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(cycleStats).where(sql`LEFT(${cycleStats.date}, 7) = ${input.month} AND ${cycleStats.crdts} != '999999'`);
      const agentRows = await db.select({ crdts: workforceAgents.crdts, teamLeader: workforceAgents.teamLeader, fullName: workforceAgents.fullName, alias: workforceAgents.alias }).from(workforceAgents);
      const tlByCrdts = new Map(agentRows.map(a => [a.crdts, a.teamLeader ?? null]));
      const nameByCrdts = new Map(agentRows.map(a => [a.crdts, { fullName: a.fullName ?? null, alias: a.alias ?? null }]));
      const byAgent = new Map<string, {
        crdts: string; agentCode: string | null; alias: string | null; fullName: string | null; teamLeader: string | null;
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
            crdts: row.crdts, agentCode: row.agentCode ?? null, alias: row.alias || nameByCrdts.get(row.crdts)?.alias || null,
            fullName: nameByCrdts.get(row.crdts)?.fullName || null, teamLeader: tlByCrdts.get(row.crdts) ?? null,
            totalRevenue: Number(row.revenue ?? 0), totalCalls: Number(row.totalCalls ?? 0),
            totalLoginHours: Number(row.loginHours ?? 0), totalProfit: Number(row.profit ?? 0),
            totalRevPerHr: Number(row.revPerHr ?? 0), days: 1,
          });
        }
      }
      return Array.from(byAgent.values()).map(a => ({
        ...a, avgRevPerHr: a.totalLoginHours > 0 ? a.totalRevenue / a.totalLoginHours : 0,
      }));
    }),

  // Agent: get list of all cycle keys that have data for this agent
  getMyTrackerHistory: agentProcedure
    .query(async ({ ctx }) => {
      const traineeCode = ctx.agent.traineeCode;
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
  getMyTrackerByCycle: agentProcedure
    .input(z.object({ cycleKey: z.string().regex(/^\d{4}-\d{2}$/) }))
    .query(async ({ ctx, input }) => {
      const traineeCode = ctx.agent.traineeCode;
      const { workforceAgents } = await import("../drizzle/schema");
      const { getDb } = await import("./db");
      const dbConn = await getDb();
      if (!dbConn) return null;
      const { eq } = await import("drizzle-orm");
      const agent = await dbConn.select({ crdts: workforceAgents.crdts })
        .from(workforceAgents).where(eq(workforceAgents.traineeCode, traineeCode)).limit(1);
      const crdts = agent[0]?.crdts;
      if (!crdts) return null;
      const dateRange = getCycleDateRange(input.cycleKey);
      const data = await getCycleTrackerForAgent(crdts, input.cycleKey);
      // Manual payroll adjustments (admin-added) for this cycle -> shown to the
      // agent as "Other Bonuses" / "Other Deductions". Same widened-identity
      // matching rule as every other payroll↔adjustment join.
      const { payrollAdjustments } = await import("../drizzle/schema");
      const { expandCrdtsIdentity, adjMatchesIdentity } = await import("./db");
      const identity = new Set(await expandCrdtsIdentity(crdts));
      const monthAdj = await dbConn.select().from(payrollAdjustments)
        .where(eq(payrollAdjustments.month, input.cycleKey));
      const adjustments = monthAdj.filter(a => adjMatchesIdentity(a.crdts, identity));
      return { ...data, adjustments, cycleKey: input.cycleKey, dateRange };
    }),

  // Admin: get all cycle history for a specific agent by CRDTS
  getAgentHistory: staffProcedure
    .input(z.object({ crdts: z.string() }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const { cycleStats, cycleDeductions, cycleOT } = await import("../drizzle/schema");
      const { eq, asc } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return [];
      // Fetch ALL rows for this agent in 3 queries (not N+1)
      const [allStats, allDeds, allOTs] = await Promise.all([
        db.select().from(cycleStats).where(eq(cycleStats.crdts, input.crdts)).orderBy(asc(cycleStats.date)),
        db.select().from(cycleDeductions).where(eq(cycleDeductions.crdts, input.crdts)),
        db.select().from(cycleOT).where(eq(cycleOT.crdts, input.crdts)),
      ]);
      // Group by cycleKey in memory
      const cycleKeys = Array.from(new Set(allStats.map(r => r.cycleKey))).sort().reverse();
      return cycleKeys.map(cycleKey => {
        const stats = allStats.filter(r => r.cycleKey === cycleKey);
        const deds  = allDeds.filter(r => r.cycleKey === cycleKey);
        const ots   = allOTs.filter(r => r.cycleKey === cycleKey);
        const totalRevenue = stats.reduce((s, r) => s + Number(r.revenue ?? 0), 0);
        const totalCalls = stats.reduce((s, r) => s + Number(r.totalCalls ?? 0), 0);
        const totalLoginHours = stats.reduce((s, r) => s + Number(r.loginHours ?? 0), 0);
        const totalProfit = stats.reduce((s, r) => s + Number(r.profit ?? 0), 0);
        const totalDeductions = deds.reduce((s, r) => s + Number(r.deductionAmount ?? 0), 0);
        // Money/hours totals count APPROVED OT only; pending shows separately, rejected never counts.
        const approvedOts = ots.filter(r => r.status === "approved");
        const totalOTHours = approvedOts.reduce((s, r) => s + Number(r.hours ?? 0), 0);
        const totalOTEgp = approvedOts.reduce((s, r) => s + Number(r.egpAmount ?? 0), 0);
        const pendingOTHours = ots.filter(r => r.status === "pending").reduce((s, r) => s + Number(r.hours ?? 0), 0);
        const revPerHr = totalLoginHours > 0 ? totalRevenue / totalLoginHours : 0;
        const dateRange = getCycleDateRange(cycleKey);
        return { cycleKey, dateRange, totalRevenue, totalCalls, totalLoginHours, totalProfit, totalDeductions, totalOTHours, totalOTEgp, pendingOTHours, revPerHr, days: stats.length };
      });
    }),

  // Admin: delete all stats rows for a specific date (undo a bad upload)
  deleteStatsForDate: staffProcedure
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
  deleteStatsForCycle: staffProcedure
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
  uploadClientLogouts: staffProcedure
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
  getClientLogoutsByCycle: staffProcedure
    .input(z.object({ cycleKey: z.string() }))
    .query(({ input }) => getClientLogoutsByCycle(input.cycleKey)),
  getMyClientLogouts: staffProcedure
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
  getCommissionMonth: staffProcedure
    .input(z.object({ crdts: z.string(), month: z.string() }))
    .query(({ input }) => getCommissionMonthData(input.crdts, input.month)),
  getAvailableCommissionMonths: staffProcedure
    .input(z.object({ crdts: z.string() }))
    .query(({ input }) => getAvailableCommissionMonths(input.crdts)),
  getMyCommissionMonths: staffProcedure
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
  getMyCommissionMonth: staffProcedure
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
  getMyPerformanceHistory: staffProcedure
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
  getAgentPerformanceHistory: staffProcedure
    .input(z.object({ crdts: z.string() }))
    .query(({ input }) => getAgentPerformanceHistory(input.crdts)),
  // ─── Campaign Ranking ─────────────────────────────────────────────────────
  getMyCampaignRanking: staffProcedure
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
  getMyClientLogoutsAgent: agentProcedure
    .query(async ({ ctx }) => {
      const traineeCode = ctx.agent.traineeCode;
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

  getMyQualityFlagsAgent: agentProcedure
    .query(async ({ ctx }) => {
      const traineeCode = ctx.agent.traineeCode;
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
  getMyCommissionMonthsAgent: agentProcedure
    .query(async ({ ctx }) => {
      const traineeCode = ctx.agent.traineeCode;
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
  getMyCommissionMonthAgent: agentProcedure
    .input(z.object({ month: z.string() }))
    .query(async ({ ctx, input }) => {
      const traineeCode = ctx.agent.traineeCode;
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
  getMyCampaignRankingAgent: agentProcedure
    .input(z.object({ cycleKey: z.string() }))
    .query(async ({ ctx, input }) => {
      const traineeCode = ctx.agent.traineeCode;
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
  getAgentDailyStats: staffProcedure
    .input(z.object({ crdts: z.string(), cycleKey: z.string().regex(/^\d{4}-\d{2}$/), viewMode: z.enum(["cycle", "month"]).default("cycle") }))
    .query(async ({ input }) => {
      const { getDb } = await import('./db');
      const { cycleStats, clientLogouts } = await import('../drizzle/schema');
      const { eq, and, sql } = await import('drizzle-orm');
      const db = await getDb();
      if (!db) return { daily: [], logoutDates: [] };
      const dateFilter = input.viewMode === "month"
        ? and(eq(cycleStats.crdts, input.crdts), sql`LEFT(${cycleStats.date}, 7) = ${input.cycleKey}`)
        : and(eq(cycleStats.crdts, input.crdts), eq(cycleStats.cycleKey, input.cycleKey));
      const daily = await db.select({
        date: cycleStats.date, loginHours: cycleStats.loginHours,
        revenue: cycleStats.revenue, totalCalls: cycleStats.totalCalls, profit: cycleStats.profit,
      }).from(cycleStats).where(dateFilter).orderBy(cycleStats.date);
      const logoutFilter = input.viewMode === "month"
        ? and(eq(clientLogouts.crdts, input.crdts), sql`LEFT(${clientLogouts.date}, 7) = ${input.cycleKey}`)
        : and(eq(clientLogouts.crdts, input.crdts), eq(clientLogouts.cycleKey, input.cycleKey));
      const logouts = await db.select({ date: clientLogouts.date }).from(clientLogouts).where(logoutFilter);
      return {
        daily: daily.map(r => ({
          date: r.date, loginHours: Number(r.loginHours ?? 0),
          revenue: Number(r.revenue ?? 0), totalCalls: Number(r.totalCalls ?? 0), profit: Number(r.profit ?? 0),
        })),
        logoutDates: logouts.map(l => l.date),
      };
    }),

  // Agent: full performance history per cycle (uses JWT cookie)
  getMyPerformanceHistoryAgent: agentProcedure
    .query(async ({ ctx }) => {
      const traineeCode = ctx.agent.traineeCode;
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
  getMyDailyStats: agentProcedure
    .input(z.object({ cycleKey: z.string().regex(/^\d{4}-\d{2}$/), viewMode: z.enum(["cycle","month"]).default("cycle") }))
    .query(async ({ ctx, input }) => {
      const traineeCode = ctx.agent.traineeCode;
      const { workforceAgents } = await import('../drizzle/schema');
      const { getDb } = await import('./db');
      const { eq, and, sql } = await import('drizzle-orm');
      const dbConn = await getDb();
      if (!dbConn) return { daily: [], logoutDates: [] };
      const agentRow = await dbConn.select({ crdts: workforceAgents.crdts })
        .from(workforceAgents).where(eq(workforceAgents.traineeCode, traineeCode)).limit(1);
      const crdts = agentRow[0]?.crdts;
      if (!crdts) return { daily: [], logoutDates: [] };
      const { cycleStats, clientLogouts } = await import('../drizzle/schema');
      const dateFilter = input.viewMode === "month"
        ? and(eq(cycleStats.crdts, crdts), sql`LEFT(${cycleStats.date},7) = ${input.cycleKey}`)
        : and(eq(cycleStats.crdts, crdts), eq(cycleStats.cycleKey, input.cycleKey));
      const daily = await dbConn.select({
        date: cycleStats.date,
        loginHours: cycleStats.loginHours,
        revenue: cycleStats.revenue,
        totalCalls: cycleStats.totalCalls,
        profit: cycleStats.profit,
      }).from(cycleStats).where(dateFilter).orderBy(cycleStats.date);
      const logoutFilter = input.viewMode === "month"
        ? and(eq(clientLogouts.crdts, crdts), sql`LEFT(${clientLogouts.date},7) = ${input.cycleKey}`)
        : and(eq(clientLogouts.crdts, crdts), eq(clientLogouts.cycleKey, input.cycleKey));
      const logouts = await dbConn.select({ date: clientLogouts.date })
        .from(clientLogouts).where(logoutFilter);
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
  upload: staffProcedure
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
      const { getDb, resolveCrdtsForWrite } = await import("./db");
      const { cycleKeyFor } = await import("./_core/time");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { coachingSessions } = await import("../drizzle/schema");
      const { inArray } = await import("drizzle-orm");
      const now = Date.now();
      const rows = [] as Array<Record<string, unknown> & { crdts: string; sessionDate: string; cycleKey: string }>;
      for (const sIn of input.sessions) {
        // The pay cycle comes from the SESSION DATE (26th→25th rule), not the picker —
        // a late-cycle session used to land in the wrong month's bonus.
        const derivedCycle = /^\d{4}-\d{2}-\d{2}/.test(sIn.sessionDate) ? cycleKeyFor(sIn.sessionDate) : input.cycleKey;
        rows.push({
          crdts: await resolveCrdtsForWrite(sIn.crdts, sIn.agentCode),
          agentCode: sIn.agentCode ?? null,
          alias: sIn.alias ?? null,
          sessionDate: sIn.sessionDate,
          cycleKey: derivedCycle,
          coachingHours: String(sIn.coachingHours),
          bonusAmount: String(sIn.bonusAmount),
          sessionType: sIn.sessionType ?? null,
          notes: sIn.notes ?? null,
          status: "pending" as const,
          uploadedAt: now,
        });
      }
      // Re-upload safe: replace PENDING rows for the same (crdts, sessionDate); never
      // touch approved/rejected history, and skip incoming duplicates of approved rows.
      let inserted = 0, replaced = 0, skippedApproved = 0;
      await db.transaction(async (tx) => {
        const keys = rows.map(r => r.crdts);
        const existing = keys.length ? await tx.select({
          id: coachingSessions.id, crdts: coachingSessions.crdts,
          sessionDate: coachingSessions.sessionDate, status: coachingSessions.status,
        }).from(coachingSessions).where(inArray(coachingSessions.crdts, Array.from(new Set(keys)))) : [];
        const byKey = new Map<string, Array<typeof existing[number]>>();
        for (const e of existing) {
          const k = `${e.crdts}|${e.sessionDate}`;
          if (!byKey.has(k)) byKey.set(k, []);
          byKey.get(k)!.push(e);
        }
        for (const r of rows) {
          const hits = byKey.get(`${r.crdts}|${r.sessionDate}`) ?? [];
          if (hits.some(h => h.status === "approved")) { skippedApproved++; continue; }
          const pendingIds = hits.filter(h => h.status === "pending").map(h => h.id);
          if (pendingIds.length) {
            await tx.delete(coachingSessions).where(inArray(coachingSessions.id, pendingIds));
            replaced++;
          } else {
            inserted++;
          }
          await tx.insert(coachingSessions).values(r as typeof coachingSessions.$inferInsert);
        }
      });
      return { inserted, replaced, skippedApproved };
    }),

  // List coaching sessions for a cycle
  listByCycle: staffProcedure
    .input(z.object({ cycleKey: z.string().regex(/^\d{4}-\d{2}$/), viewMode: z.enum(["cycle","month"]).default("cycle") }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq: eqOp, sql } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return [];
      const { coachingSessions } = await import("../drizzle/schema");
      const filter = input.viewMode === "month"
        ? sql`LEFT(${coachingSessions.sessionDate}, 7) = ${input.cycleKey}`
        : eqOp(coachingSessions.cycleKey, input.cycleKey);
      return db.select().from(coachingSessions).where(filter);
    }),

  // List coaching sessions for a specific agent (by CRDTS)
  listByCrdts: staffProcedure
    .input(z.object({ crdts: z.string(), agentCode: z.string().optional() }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq: eqOp, desc, or: orOp } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return [];
      const { coachingSessions } = await import("../drizzle/schema");
      // Search by CRDTS first, also try agentCode as fallback for uploads with CRDTS mismatch
      const conditions = input.agentCode
        ? orOp(eqOp(coachingSessions.crdts, input.crdts), eqOp(coachingSessions.agentCode, input.agentCode))
        : eqOp(coachingSessions.crdts, input.crdts);
      return db.select().from(coachingSessions)
        .where(conditions)
        .orderBy(desc(coachingSessions.sessionDate));
    }),

  // Approve / reject a session (pays a bonus → money roles only)
  updateStatus: roleProcedure("finance", "hr", "manager")
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
  deleteForCycle: roleProcedure("finance", "hr", "manager")
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
  getBonusForAgent: staffProcedure
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
  getMyCoachingSessions: agentProcedure
    .input(z.object({ cycleKey: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      try {
        const p = { candidateId: ctx.agent.candidateId };
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
  listTeamLeaders: staffProcedure.query(async () => {
    const { getDb } = await import("./db");
    const { teamLeaders } = await import("../drizzle/schema");
    const db = await getDb();
    if (!db) return [];
    return db.select().from(teamLeaders).orderBy(teamLeaders.name);
  }),
  addTeamLeader: roleProcedure("hr", "manager")
    .input(z.object({ name: z.string().min(1), email: z.string().email().optional(), phone: z.string().optional() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { teamLeaders } = await import("../drizzle/schema");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.insert(teamLeaders).values({ name: input.name, email: input.email, phone: input.phone });
      return { success: true };
    }),
  updateTeamLeader: roleProcedure("hr", "manager")
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
  deleteTeamLeader: roleProcedure("hr", "manager")
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      // Soft delete: agents may still reference this leader by name — deactivate instead.
      const { getDb } = await import("./db");
      const { teamLeaders } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.update(teamLeaders).set({ isActive: false }).where(eq(teamLeaders.id, input.id));
      return { success: true };
    }),
});

// ─── Coaching Cases Router (admin-only, NOT visible to agents) ───────────────
const COACHING_STATUSES = ["pending", "in_progress", "improved", "no_change", "escalated", "terminated"] as const;
type CoachingStatus = typeof COACHING_STATUSES[number];

const coachingCasesRouter = router({
  // Create a new coaching case
  create: staffProcedure
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

  list: staffProcedure
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

  getById: staffProcedure
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

  update: staffProcedure
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

  updateStatus: staffProcedure
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

  delete: staffProcedure
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
  previewContacts: staffProcedure
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
  importContacts: staffProcedure
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
  getStatus: staffProcedure.query(async () => {
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

  // Disconnect Google Calendar — only the caller's own token (plus the legacy
  // shared NULL-user token for full-access roles, so admins can clear it).
  disconnectGoogle: staffProcedure.mutation(async ({ ctx }) => {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return { ok: false };
    const { integrationsTokens } = await import("../drizzle/schema");
    const { eq, and, isNull, or } = await import("drizzle-orm");
    const own = and(eq(integrationsTokens.provider, "google"), eq(integrationsTokens.userId, ctx.user.openId));
    const where = isFullAccess((ctx.user as { role?: string }).role)
      ? and(eq(integrationsTokens.provider, "google"), or(eq(integrationsTokens.userId, ctx.user.openId), isNull(integrationsTokens.userId)))
      : own;
    await db.delete(integrationsTokens).where(where);
    return { ok: true };
  }),

  // Debug: inspect raw Google Calendar data
  /** Import candidates from Microsoft/Outlook calendar events */
  importMicrosoftCalendarEvents: staffProcedure
    .input(z.object({
      startDate: z.string(),
      endDate: z.string(),
      keywords: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { integrationsTokens } = await import("../drizzle/schema");
      const { eq, and: andMs, or: orMs, isNull: isNullMs } = await import("drizzle-orm");
      const userId = ctx.user?.openId ?? null;
      const [tokenRow] = await db.select().from(integrationsTokens).where(
        userId
          ? andMs(eq(integrationsTokens.provider, "microsoft"), orMs(eq(integrationsTokens.userId, userId), isNullMs(integrationsTokens.userId)))
          : andMs(eq(integrationsTokens.provider, "microsoft"), isNullMs(integrationsTokens.userId))
      ).orderBy(integrationsTokens.updatedAt).limit(1);
      if (!tokenRow) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Microsoft Calendar not connected. Please connect your Outlook account in the Recruitment page." });

      // Refresh token if expired
      let accessToken = tokenRow.accessToken;
      if (tokenRow.expiresAt && tokenRow.expiresAt < Date.now() + 60000) {
        const refreshRes = await fetch(`https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID ?? "common"}/oauth2/v2.0/token`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.MICROSOFT_CLIENT_ID ?? "",
            client_secret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
            refresh_token: tokenRow.refreshToken || "",
            grant_type: "refresh_token",
            scope: "Calendars.Read User.Read offline_access",
          }),
        });
        const refreshData = await refreshRes.json() as { access_token?: string; expires_in?: number };
        if (refreshData.access_token) {
          accessToken = refreshData.access_token;
          await db.update(integrationsTokens).set({
            accessToken: refreshData.access_token,
            expiresAt: Date.now() + (refreshData.expires_in ?? 3600) * 1000,
            updatedAt: Date.now(),
          } as never).where(eq(integrationsTokens.id, tokenRow.id));
        }
      }

      // Fetch events from Microsoft Graph API
      const graphUrl = new URL("https://graph.microsoft.com/v1.0/me/calendarView");
      graphUrl.searchParams.set("startDateTime", new Date(input.startDate).toISOString());
      graphUrl.searchParams.set("endDateTime", new Date(input.endDate + "T23:59:59").toISOString());
      graphUrl.searchParams.set("$select", "subject,attendees,body,start,end,organizer");
      graphUrl.searchParams.set("$top", "50");
      const eventsRes = await fetch(graphUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const eventsData = await eventsRes.json() as { value?: Array<Record<string,unknown>> };
      const events = eventsData.value ?? [];

      // Extract candidates from attendees — filter by keyword
      const keywords = (input.keywords ?? "interview,tanis,hiring,candidate").toLowerCase().split(",").map(k => k.trim());
      const { candidates: candidatesTable } = await import("../drizzle/schema");
      const { eq: eqC } = await import("drizzle-orm");
      let imported = 0;
      for (const event of events) {
        const subject = String(event.subject ?? "").toLowerCase();
        if (keywords.length > 0 && !keywords.some(k => subject.includes(k))) continue;
        const attendees = (event.attendees as Array<Record<string,unknown>>) ?? [];
        for (const att of attendees) {
          const emailAddress = (att.emailAddress as Record<string,unknown>) ?? {};
          const email = String(emailAddress.address ?? "");
          const name = String(emailAddress.name ?? "");
          if (!email) continue;
          const existing = await db.select({ id: candidatesTable.id }).from(candidatesTable).where(eqC(candidatesTable.email, email)).limit(1);
          if (existing.length === 0) {
            await db.insert(candidatesTable).values({
              name: name || email.split("@")[0],
              email,
              phone: null,
              status: "new_lead",
              source: "microsoft_calendar",
              notes: `Imported from Outlook: ${event.subject}`,
              createdAt: new Date(),
              updatedAt: new Date(),
            } as never);
            imported++;
          }
        }
      }
      return { imported, total: events.length };
    }),

  debugCalendar: staffProcedure.mutation(async () => {
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
  previewCalendarEvents: staffProcedure
    .input(z.object({
      dateFrom: z.string().optional(), // ISO date string, e.g. "2026-05-19"
      dateTo: z.string().optional(),   // ISO date string, e.g. "2026-05-21"
    }).optional())
    .mutation(async ({ input, ctx }) => {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { integrationsTokens, candidates: candidatesTable } = await import("../drizzle/schema");
    const { eq, or: orLCE, isNull: isNullLCE, and: andLCE } = await import("drizzle-orm");

    // Get stored Google token — per-user first, fall back to legacy shared token
    const userId6 = ctx.user?.openId ?? null;
    const [tokenRow] = await db.select().from(integrationsTokens).where(
      userId6
        ? andLCE(eq(integrationsTokens.provider, "google"), orLCE(eq(integrationsTokens.userId, userId6), isNullLCE(integrationsTokens.userId)))
        : andLCE(eq(integrationsTokens.provider, "google"), isNullLCE(integrationsTokens.userId))
    ).orderBy(integrationsTokens.updatedAt).limit(1);
    if (!tokenRow) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Google Calendar not connected. Please connect your own Google account in Settings > Integrations." });

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
  importCalendarEvents: staffProcedure
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
  getForAgent: agentProcedure
    .input(z.object({ month: z.string() }))
    .query(async ({ input, ctx }) => {
      const { getDb } = await import("./db");
      const { trainerSalaries } = await import("../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return null;
      const agent = await getWorkforceAgentByCode(ctx.agent.traineeCode);
      const crdts = agent?.crdts || ctx.agent.traineeCode;
      const rows = await db.select().from(trainerSalaries)
        .where(and(eq(trainerSalaries.crdts, crdts), eq(trainerSalaries.month, input.month)))
        .limit(1);
      return rows[0] ?? null;
    }),
  getForMonth: roleProcedure("finance", "hr", "manager")
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

  upsert: roleProcedure("finance", "hr", "manager")
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
      const crdts = input.crdts?.trim() || null;
      if (input.id) {
        await db.update(trainerSalaries).set({
          crdts,
          trainerName: input.trainerName,
          salaryEgp: String(input.salaryEgp),
          notes: input.notes ?? null,
          updatedAt: now,
        }).where(eq(trainerSalaries.id, input.id));
        return { id: input.id };
      }
      // One row per (crdts, month) when a CRDTS is given; per (name, month) otherwise. Never a silent duplicate.
      const { and: andOp } = await import("drizzle-orm");
      const [dup] = await db.select({ id: trainerSalaries.id }).from(trainerSalaries)
        .where(crdts
          ? andOp(eq(trainerSalaries.crdts, crdts), eq(trainerSalaries.month, input.month))
          : andOp(eq(trainerSalaries.trainerName, input.trainerName), eq(trainerSalaries.month, input.month)))
        .limit(1);
      if (dup) {
        await db.update(trainerSalaries).set({ crdts, trainerName: input.trainerName, salaryEgp: String(input.salaryEgp), notes: input.notes ?? null, updatedAt: now })
          .where(eq(trainerSalaries.id, dup.id));
        return { id: dup.id };
      }
      const [result] = await db.insert(trainerSalaries).values({
        crdts,
        trainerName: input.trainerName,
        month: input.month,
        salaryEgp: String(input.salaryEgp),
        notes: input.notes ?? null,
        createdAt: now,
        updatedAt: now,
      });
      return { id: (result as { insertId: number }).insertId };
    }),

  delete: roleProcedure("finance", "hr", "manager")
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
  getForAgent: agentProcedure
    .input(z.object({ month: z.string() }))
    .query(async ({ input, ctx }) => {
      const { getDb } = await import("./db");
      const { payrollAdjustments } = await import("../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return [];
      const agent = await getWorkforceAgentByCode(ctx.agent.traineeCode);
      const crdts = agent?.crdts || ctx.agent.traineeCode;
      return db.select().from(payrollAdjustments)
        .where(and(eq(payrollAdjustments.crdts, crdts), eq(payrollAdjustments.month, input.month)));
    }),
  getForMonth: staffProcedure
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

  add: roleProcedure("finance", "hr", "manager")
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
      const { resolveCrdtsForWrite } = await import("./db");
      const crdts = await resolveCrdtsForWrite(input.crdts);
      const result = await db.insert(payrollAdjustments).values({
        crdts,
        month: input.month,
        type: input.type,
        label: input.label,
        amount: String(input.amount),
        createdAt: Date.now(),
        createdBy: (ctx as { user?: { name?: string } }).user?.name ?? "Admin",
      });
      // The owed total changed — a record already marked paid may now owe more.
      const { recomputePaymentStatusByCrdtsMonth } = await import("./db");
      await recomputePaymentStatusByCrdtsMonth(crdts, input.month);
      return { id: (result as { insertId?: number }).insertId ?? 0 };
    }),

  update: roleProcedure("finance", "hr", "manager")
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
      const [row] = await db.select().from(payrollAdjustments).where(eq(payrollAdjustments.id, input.id)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      await db.update(payrollAdjustments).set(updates).where(eq(payrollAdjustments.id, input.id));
      const { recomputePaymentStatusByCrdtsMonth } = await import("./db");
      await recomputePaymentStatusByCrdtsMonth(row.crdts, row.month);
      return { success: true };
    }),

  delete: roleProcedure("finance", "hr", "manager")
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { payrollAdjustments } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const [row] = await db.select().from(payrollAdjustments).where(eq(payrollAdjustments.id, input.id)).limit(1);
      await db.delete(payrollAdjustments).where(eq(payrollAdjustments.id, input.id));
      if (row) {
        const { recomputePaymentStatusByCrdtsMonth } = await import("./db");
        await recomputePaymentStatusByCrdtsMonth(row.crdts, row.month);
      }
      return { success: true };
    }),
});

const commissionRouter = router({
  // Get all commission records for a given payment cycle (YYYY-MM)
  getForMonth: roleProcedure("finance", "hr", "manager")
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
  upload: roleProcedure("finance", "hr", "manager")
    .input(z.object({
      paymentCycle: z.string().regex(/^\d{4}-\d{2}$/, "Payment cycle must be YYYY-MM"),
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
      // Validate: warn if performanceMonth is missing or looks wrong
      const warnings: { crdts: string; type: string; message: string }[] = [];
      const hasPerformanceMonth = input.rows.some(r => r.performanceMonth && r.performanceMonth.trim());
      if (!hasPerformanceMonth) {
        warnings.push({ crdts: "—", type: "missing_performance_month", message: "No performance month provided — commission rows will store paymentCycle as reference only. Upload the Manus tab from the commission file to include performance months." });
      }
      const { commissions } = await import("../drizzle/schema");
      const { sql } = await import("drizzle-orm");
      const now = Date.now();
      const uploader = input.uploadedBy || (ctx as { user?: { name?: string } }).user?.name || "admin";
      let count = 0;
      const { resolveCrdtsForWrite } = await import("./db");
      for (const row of input.rows) {
        if (!row.crdts || row.commissionEgp <= 0) continue;
        try {
          const rowCrdts = await resolveCrdtsForWrite(row.crdts);
          await db.insert(commissions).values({
            crdts: rowCrdts,
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
              .where(sqlFn`${payrollRecords.crdts} = ${rowCrdts} AND ${payrollRecords.month} = ${input.paymentCycle}`);
            const { recomputePaymentStatusByCrdtsMonth } = await import("./db");
            await recomputePaymentStatusByCrdtsMonth(rowCrdts, input.paymentCycle);
          } catch { /* non-fatal: payroll record may not exist yet */ }
          count++;
        } catch (err) {
          warnings.push({ crdts: row.crdts, type: "insert_error", message: String(err) });
        }
      }
      await auditEntry(ctx.user, "commission_upload", "commission", "commission", JSON.stringify({ count, warnings: warnings.length, uploadedBy: ctx.user?.name ?? ctx.user?.email }));
      return { count, warnings };
    }),

  // Update a single commission record amount (manual adjustment)
  updateCommission: roleProcedure("finance", "hr", "manager")
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
          // Recompute payment status now that commissionEgp changed — the total owed
          // may have changed, potentially flipping a "paid" record back to "pending".
          const { recomputePaymentStatusByCrdtsMonth } = await import("./db");
          await recomputePaymentStatusByCrdtsMonth(crdts, paymentCycle);
        }
      }
      return { ok: true };
    }),

  // Change the payment cycle (and performance month) on an existing commission record
  changeCycle: roleProcedure("finance", "hr", "manager")
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
  reassignCycle: roleProcedure("finance", "hr", "manager")
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
      // Wrap all 5 writes in a transaction — if any step fails, all roll back atomically
      await db.transaction(async (tx) => {
        // 2. Clear commission off the OLD cycle's payroll records
        for (const rec of recs) {
          await tx.update(payrollRecords).set({ commissionEgp: "0" })
            .where(and(eq(payrollRecords.crdts, rec.crdts), eq(payrollRecords.month, input.fromCycle)));
        }
        // 3. Move the commission records to the new pay cycle
        await tx.update(commissions).set({
          paymentCycle: input.toCycle,
          ...(input.newPerformanceMonth ? { performanceMonth: input.newPerformanceMonth } : {}),
        }).where(eq(commissions.paymentCycle, input.fromCycle));
        // 4. Move the leaderboard rows too
        await tx.update(commissionLeaderboard).set({ cycleKey: input.toCycle })
          .where(eq(commissionLeaderboard.cycleKey, input.fromCycle));
        // 5. Apply commission onto the NEW cycle's payroll records (if that payroll exists yet)
        for (const rec of recs) {
          await tx.update(payrollRecords).set({ commissionEgp: rec.commissionEgp ?? "0" })
            .where(and(eq(payrollRecords.crdts, rec.crdts), eq(payrollRecords.month, input.toCycle)));
        }
      });
      return { ok: true, moved: recs.length, from: input.fromCycle, to: input.toCycle };
    }),

  // Get full leaderboard for a cycle (all campaigns)
  getFullLeaderboard: roleProcedure("finance", "hr", "manager")
    .input(z.object({ cycleKey: z.string() }))
    .query(async ({ input }) => {
      const { getFullLeaderboard } = await import("./db");
      return getFullLeaderboard(input.cycleKey);
    }),

  // Agent-facing: get full leaderboard for a cycle (login required — this is client revenue data)
  getFullLeaderboardAgent: agentOrStaffProcedure
    .input(z.object({ cycleKey: z.string() }))
    .query(async ({ input }) => {
      const { getFullLeaderboard } = await import("./db");
      return getFullLeaderboard(input.cycleKey);
    }),

  // Upload leaderboard rows from Campaign tabs of the commission file
  uploadLeaderboard: roleProcedure("finance", "hr", "manager")
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
  getMyUpcomingCommission: agentProcedure
    .query(async ({ ctx }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return [];
      const { commissions } = await import("../drizzle/schema");
      const { eq, or } = await import("drizzle-orm");
      const agent = await getWorkforceAgentByCode(ctx.agent.traineeCode);
      const crdts = agent?.crdts || ctx.agent.traineeCode;
      return db.select().from(commissions)
        .where(or(eq(commissions.crdts, crdts), eq(commissions.crdts, ctx.agent.traineeCode)))
        .orderBy(commissions.paymentCycle);
    }),

  // Get available cycle keys that have leaderboard data (login required)
  getLeaderboardCycles: agentOrStaffProcedure
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
      // The dropdown shows the performance-month LABEL. When the same month was uploaded under two cycle
      // keys (e.g. "2026-09" then re-uploaded as "2026-10"), keep only the newest key per label so the
      // agent never sees "SEPTEMBER 2026" twice.
      const seen = new Set<string>();
      const out: { cycleKey: string; performanceMonth: string | null }[] = [];
      for (const r of rows) {
        const label = (r.performanceMonth ?? r.cycleKey).trim().toLowerCase().replace(/\s+/g, " ");
        if (seen.has(label)) continue;
        seen.add(label);
        out.push({ cycleKey: r.cycleKey, performanceMonth: (r.performanceMonth ?? null) as string | null });
      }
      return out;
    }),

  // Delete a single commission record by id (also clears commissionEgp from matching payroll record)
  deleteCommissionRecord: roleProcedure("finance", "hr", "manager")
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
  clearCommissionCycle: roleProcedure("finance", "hr", "manager")
    .input(z.object({ cycleKey: z.string().regex(/^\d{4}-\d{2}$/) }))
    .mutation(async ({ input, ctx }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { commissions, commissionLeaderboard, payrollRecords } = await import("../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      const recs = await db.select().from(commissions).where(eq(commissions.paymentCycle, input.cycleKey));
      await db.transaction(async (tx) => {
        // Clear commission ONLY on this cycle's payroll month — never across every month the agent has.
        for (const rec of recs) {
          await tx.update(payrollRecords)
            .set({ commissionEgp: "0" })
            .where(and(eq(payrollRecords.crdts, rec.crdts), eq(payrollRecords.month, input.cycleKey)));
        }
        await tx.delete(commissions).where(eq(commissions.paymentCycle, input.cycleKey));
        await tx.delete(commissionLeaderboard).where(eq(commissionLeaderboard.cycleKey, input.cycleKey));
      });
      await auditEntry(ctx.user, "clear_commission_cycle", "commission_cycle", input.cycleKey, JSON.stringify({ records: recs.length }));
      return { ok: true, cleared: recs.length };
    }),
});

// ─── Admin Invites Router ───────────────────────────────────────────────────
// (Removed) the unused `invites` router: the client uses adminAuth.* for the
// whole invite flow, and the dead router's `use` endpoint was a second,
// unmonitored path to the admin role.

// ─── API Keys Router ─────────────────────────────────────────────────────────
const apiKeysRouter = router({
  // Generate a new API key (admin only)
  generate: adminProcedure
    .input(z.object({ name: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
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
  list: adminProcedure
    .query(async ({ ctx }) => {
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
  revoke: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { apiKeys } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db.update(apiKeys).set({ revokedAt: Date.now() }).where(eq(apiKeys.id, input.id));
      return { ok: true };
    }),

  // Delete an API key permanently (admin only)
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
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
  markSettled: roleProcedure("finance", "hr", "manager")
    .input(z.object({ traineeCode: z.string(), settled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const { settleAgent } = await import("./db");
      await settleAgent(input.traineeCode, input.settled);
      await auditEntry(ctx.user, input.settled ? "mark_settled" : "mark_unsettled", "agent", input.traineeCode, undefined);
      return { ok: true };
    }),
  // Exit checklist — read (auto-creates a blank one)
  getExit: staffProcedure
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
  updateExit: roleProcedure("hr", "manager")
    .input(z.object({
      traineeCode: z.string(),
      exitType: z.enum(["resignation", "termination", "contract_end"]).optional(),
      exitInterview: z.boolean().optional(), clearance: z.boolean().optional(),
      assetsReturned: z.boolean().optional(), lastWorkingDay: z.string().optional(),
      settlementDone: z.boolean().optional(), notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await auditEntry(ctx.user, "exit_process_update", "agent", input.traineeCode, JSON.stringify({ exitType: input.exitType, settlementDone: input.settlementDone }));
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { exitProcess } = await import("../drizzle/schema");
      const { traineeCode, settlementDone: _ignoreSettle, ...rest } = input;
      // settlementDone is written ONLY through settleAgent (markSettled) so the
      // checklist can never drift from workforce_agents.salarySettled.
      void _ignoreSettle;
      const now = Date.now();
      const existing = await db.select().from(exitProcess).where(eq(exitProcess.traineeCode, traineeCode)).limit(1);
      if (existing[0]) await db.update(exitProcess).set({ ...rest, updatedAt: now }).where(eq(exitProcess.traineeCode, traineeCode));
      else await db.insert(exitProcess).values({ traineeCode, ...rest, updatedAt: now });
      // If lastWorkingDay is being set, sync effectiveAt in agentSeparations so auto-separation fires on the right date
      if (input.lastWorkingDay) {
        const { agentSeparations } = await import("../drizzle/schema");
        const { isNull: _isNull2 } = await import("drizzle-orm");
        const lwdMs = (() => { const d = new Date(input.lastWorkingDay); d.setHours(23,59,59,999); return d.getTime(); })();
        await db.update(agentSeparations)
          .set({ effectiveAt: lwdMs, lastWorkingDay: input.lastWorkingDay })
          .where(and(eq(agentSeparations.agentCode, traineeCode), _isNull2(agentSeparations.appliedAt)));
      }
      return { ok: true };
    }),
  // Archive: exit checklist must be complete → labels the linked candidate + closes out the agent.
  archiveAgent: roleProcedure("hr", "manager")
    .input(z.object({ traineeCode: z.string(), status: z.enum(["resigned", "terminated", "blacklisted"]) }))
    .mutation(async ({ ctx, input }) => {
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
      await auditEntry(ctx.user, "archive_agent", "agent", input.traineeCode, JSON.stringify({ status: input.status }));
      return { ok: true };
    }),
  // ── Leave ──
  listBalances: staffProcedure.query(async () => {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return [];
    const { leaveBalances } = await import("../drizzle/schema");
    return db.select().from(leaveBalances);
  }),
  // Mass-add: set/increment balances for ALL active agents for a year.
  massSetBalances: adminProcedure
    .input(z.object({ year: z.number().int().min(2020).max(2100), casualTotal: z.number().min(0).max(365), annualTotal: z.number().min(0).max(365) }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("./db");
      const { eq, and } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { leaveBalances, workforceAgents } = await import("../drizzle/schema");
      // SAME set as leave.massAdd: non-terminal employees (frozen/on-notice
      // included), demo excluded — active-only used to skip frozen agents that
      // massAdd credited, so the two endpoints disagreed on who exists.
      const { notInArray: nin3, or: or3, isNull: isNull3 } = await import("drizzle-orm");
      const agents = await db.select({ traineeCode: workforceAgents.traineeCode }).from(workforceAgents)
        .where(and(
          nin3(workforceAgents.agentStatus, ["resigned", "terminated", "blacklisted"]),
          or3(isNull3(workforceAgents.isDemo), eq(workforceAgents.isDemo, false)),
        ));
      const now = Date.now();
      let updated = 0;
      const skipped: string[] = [];
      for (const a of agents) {
        const ex = (await db.select().from(leaveBalances).where(and(eq(leaveBalances.traineeCode, a.traineeCode), eq(leaveBalances.year, input.year))).limit(1))[0];
        // Merge, never clobber: used days survive, and an agent whose used days
        // already exceed the new totals is skipped and reported instead of going negative.
        if (ex && (ex.casualUsed > input.casualTotal || ex.annualUsed > input.annualTotal)) {
          skipped.push(a.traineeCode);
          continue;
        }
        if (ex) await db.update(leaveBalances).set({ casualTotal: input.casualTotal, annualTotal: input.annualTotal, updatedAt: now }).where(eq(leaveBalances.id, ex.id));
        else await db.insert(leaveBalances).values({ traineeCode: a.traineeCode, year: input.year, casualTotal: input.casualTotal, annualTotal: input.annualTotal, updatedAt: now });
        updated++;
      }
      await auditEntry(ctx.user, "mass_set_leave_balances", "leave", String(input.year), JSON.stringify({ ...input, agents: updated, skipped: skipped.length }));
      return { ok: true, agents: updated, skipped };
    }),
  setBalance: roleProcedure("hr", "manager")
    .input(z.object({ traineeCode: z.string(), year: z.number().int().min(2020).max(2100), casualTotal: z.number().min(0).max(365).optional(), annualTotal: z.number().min(0).max(365).optional(), casualUsed: z.number().min(0).max(365).optional(), annualUsed: z.number().min(0).max(365).optional() }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("./db");
      const { eq, and } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { leaveBalances } = await import("../drizzle/schema");
      const { traineeCode, year, ...rest } = input;
      const now = Date.now();
      const ex = (await db.select().from(leaveBalances).where(and(eq(leaveBalances.traineeCode, traineeCode), eq(leaveBalances.year, year))).limit(1))[0];
      // used may never exceed total (check the merged result, not just the patch)
      const merged = {
        casualTotal: rest.casualTotal ?? ex?.casualTotal ?? 0,
        annualTotal: rest.annualTotal ?? ex?.annualTotal ?? 0,
        casualUsed: rest.casualUsed ?? ex?.casualUsed ?? 0,
        annualUsed: rest.annualUsed ?? ex?.annualUsed ?? 0,
      };
      if (merged.casualUsed > merged.casualTotal || merged.annualUsed > merged.annualTotal) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Used days cannot exceed the total allowance." });
      }
      if (ex) await db.update(leaveBalances).set({ ...rest, updatedAt: now }).where(eq(leaveBalances.id, ex.id));
      else await db.insert(leaveBalances).values({ traineeCode, year, ...merged, updatedAt: now });
      await auditEntry(ctx.user, "set_leave_balance", "agent", traineeCode, JSON.stringify({ year, ...rest }));
      return { ok: true };
    }),
  listLeaveRequests: staffProcedure
    .input(z.object({ status: z.enum(["pending", "approved", "rejected", "cancelled"]).optional() }).optional())
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return [];
      const { leaveRequests } = await import("../drizzle/schema");
      const { eq, desc } = await import("drizzle-orm");
      if (input?.status) return db.select().from(leaveRequests).where(eq(leaveRequests.status, input.status)).orderBy(desc(leaveRequests.createdAt));
      return db.select().from(leaveRequests).orderBy(desc(leaveRequests.createdAt));
    }),
  // Agent submits a request (no type — HR classifies). Identity from session.
  requestLeave: agentProcedure
    .input(z.object({ traineeCode: z.string().optional(), startDate: z.string(), endDate: z.string(), days: z.number().min(1).optional(), reason: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      // days is computed server-side from the dates (createLeaveRequestRow) — the client's value is ignored.
      const { createLeaveRequestRow } = await import("./db");
      await createLeaveRequestRow({ traineeCode: ctx.agent.traineeCode, startDate: input.startDate, endDate: input.endDate, reason: input.reason ?? null });
      return { ok: true };
    }),

  /** Staff/admin submits their OWN leave request */
  requestMyLeave: staffProcedure
    .input(z.object({ startDate: z.string(), endDate: z.string(), days: z.number().int().min(1).optional(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      // days is computed server-side from the dates — the client's value is ignored.
      const { createLeaveRequestRow } = await import("./db");
      const staffId = `STAFF-${ctx.user?.openId ?? "unknown"}`;
      await createLeaveRequestRow({ traineeCode: staffId, requesterName: ctx.user?.name ?? null, startDate: input.startDate, endDate: input.endDate, reason: input.reason ?? null });
      return { ok: true };
    }),

  /** Get own leave requests + balance (staff/admin) */
  getMyLeaves: staffProcedure.query(async ({ ctx }) => {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return { requests: [], balance: null };
    const { leaveRequests, leaveBalances } = await import("../drizzle/schema");
    const { eq, desc } = await import("drizzle-orm");
    const staffId = `STAFF-${ctx.user?.openId ?? "unknown"}`;
    const [requests, balRows] = await Promise.all([
      db.select().from(leaveRequests).where(eq(leaveRequests.traineeCode, staffId)).orderBy(desc(leaveRequests.createdAt)),
      db.select().from(leaveBalances).where(eq(leaveBalances.traineeCode, staffId)).limit(1),
    ]);
    return { requests, balance: balRows[0] ?? null };
  }),

  /** Decide on staff leave — only admin/owner can approve */
  decideMyLeave: adminProcedure
    .input(z.object({ id: z.number(), decision: z.enum(["approved", "rejected"]), leaveType: z.enum(["casual", "annual", "unpaid"]).optional() }))
    .mutation(async ({ ctx, input }) => {
      const { decideLeaveRequest } = await import("./db");
      const { LEAVE_DEFAULTS } = await import("@shared/const");
      try {
        // Same day-one defaults as every other decide path — passing none made
        // this path fail with "No casual leave balance on file" where the others
        // auto-create the 6/21 balance.
        await decideLeaveRequest({ id: input.id, decision: input.decision, leaveType: input.leaveType, decidedBy: ctx.user.name ?? ctx.user.email ?? "admin", defaults: LEAVE_DEFAULTS });
      } catch (e) {
        throw toTrpcError(e, "Failed to decide leave");
      }
      await auditEntry(ctx.user, `staff_leave_${input.decision}`, "leave_request", String(input.id), JSON.stringify({ role: ctx.user?.role }));
      return { ok: true };
    }),
  myLeaveRequests: staffProcedure
    .input(z.object({ traineeCode: z.string() }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return [];
      const { leaveRequests } = await import("../drizzle/schema");
      const { eq, desc } = await import("drizzle-orm");
      return db.select().from(leaveRequests).where(eq(leaveRequests.traineeCode, input.traineeCode)).orderBy(desc(leaveRequests.createdAt));
    }),
  // HR decides: classify type + approve (deducts balance) or reject. Same transactional path as leave.decide.
  decideLeave: roleProcedure("hr", "manager", "ops_manager", "team_lead")
    .input(z.object({ id: z.number(), decision: z.enum(["approved", "rejected"]), leaveType: z.enum(["casual", "annual", "unpaid"]).optional(), decidedBy: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const { decideLeaveRequest } = await import("./db");
      const { LEAVE_DEFAULTS } = await import("@shared/const");
      try {
        const r = await decideLeaveRequest({ id: input.id, decision: input.decision, leaveType: input.leaveType, decidedBy: ctx.user.name ?? input.decidedBy ?? ctx.user.email ?? "admin", defaults: LEAVE_DEFAULTS });
        await auditEntry(ctx.user, input.decision === "approved" ? "leave_approved" : "leave_rejected", "leave_request", String(input.id), JSON.stringify({ decidedBy: ctx.user?.name, leaveType: input.leaveType, traineeCode: r.traineeCode }));
        return { ok: true };
      } catch (e) {
        throw toTrpcError(e, "Failed to decide leave");
      }
    }),
});

/** BD view-only enforcement: Hub users with role "bd" may VIEW every pipeline
 *  but can only modify deals they own. Admin/owner/other roles are unaffected.
 *  Throws FORBIDDEN when a bd-role user touches someone else's deal. */
async function assertBdDealOwnership(ctx: { user?: { role?: string; openId?: string } | null }, dealId: number) {
  const hubRole = ctx.user?.role;
  if (hubRole !== "bd") return; // admins & staff roles keep full control
  const openId = ctx.user?.openId;
  if (!openId) throw new TRPCError({ code: "UNAUTHORIZED", message: "No authenticated user" });
  const { getDb } = await import("./db");
  const { eq, sql: rawSql } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
  const { bdUsers, bdDeals } = await import("../drizzle/schema");
  // Single atomic join query — eliminates the read/check race condition
  // where deal ownership could change between the two separate reads
  const [result] = await db.select({
    dealOwnerId: bdDeals.ownerId,
    requesterId: bdUsers.id,
    ownerName: rawSql<string>`(SELECT name FROM bd_users WHERE id = ${bdDeals.ownerId})`,
  }).from(bdDeals)
    .leftJoin(bdUsers, eq(bdUsers.openId, openId))
    .where(eq(bdDeals.id, dealId))
    .limit(1);
  if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Deal not found" });
  if (!result.requesterId) throw new TRPCError({ code: "FORBIDDEN", message: "Link your BD profile first" });
  if (result.dealOwnerId !== result.requesterId) {
    throw new TRPCError({ code: "FORBIDDEN", message: `View-only: this deal belongs to ${result.ownerName ?? "another BD user"}` });
  }
}

/** Map a thrown db-layer error ({code, message}) onto a VALID TRPC code; anything unknown becomes 500. */
function toTrpcError(e: unknown, fallback = "Request failed"): TRPCError {
  const err = e as { code?: string; message?: string };
  const ok = new Set(["BAD_REQUEST", "NOT_FOUND", "FORBIDDEN", "UNAUTHORIZED", "CONFLICT", "PRECONDITION_FAILED"]);
  const isKnown = !!err.code && ok.has(err.code);
  const code = (isKnown ? err.code : "INTERNAL_SERVER_ERROR") as "BAD_REQUEST";
  return new TRPCError({ code, message: isKnown ? (err.message ?? fallback) : fallback });
}

// ─── Audit log helper ─────────────────────────────────────────────────────────
async function auditEntry(actor: { name?: string | null; openId?: string | null } | null | undefined, action: string, targetType: string, targetId: string, detail?: string) {
  try {
    const { getDb } = await import("./db");
    const { auditLog } = await import("../drizzle/schema");
    const db = await getDb();
    if (!db) return;
    await db.insert(auditLog).values({ actorName: actor?.name ?? "system", actorOpenId: actor?.openId ?? null, action, targetType, targetId, detail: detail ?? null, createdAt: Date.now() });
  } catch { /* non-blocking */ }
}

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
  linkLogin: staffProcedure
    .input(z.object({ bdUserId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const openId = (ctx.user as { openId?: string })?.openId;
      {
        // Same rule as linkMyLogin: self-link needs a matching email unless you are a Hub admin.
        const { getDb: _g } = await import("./db"); const { eq: _e } = await import("drizzle-orm");
        const _db = await _g(); const { bdUsers: _bu } = await import("../drizzle/schema");
        const _t = _db ? (await _db.select().from(_bu).where(_e(_bu.id, input.bdUserId)).limit(1))[0] : null;
        const _isAdmin = ctx.user.role === "admin" || ctx.user.role === "owner";
        const _match = !!_t?.email && !!ctx.user.email && _t.email.trim().toLowerCase() === ctx.user.email.trim().toLowerCase();
        if (_t && !_isAdmin && (!_match || _t.role === "admin")) throw new TRPCError({ code: "FORBIDDEN", message: "This BD profile can only be linked to your login by an admin." });
      }
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
      if (ctx.user.role === "user" || ctx.user.role === "viewer") {
        const { users } = await import("../drizzle/schema");
        await db.update(users).set({ role: "bd" }).where(eq(users.openId, openId));
      }
      return { ok: true };
    }),
  unlinkLogin: adminProcedure
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
  dueReminders: staffProcedure.query(async ({ ctx }) => {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return [];
    const { bdDeals, bdUsers } = await import("../drizzle/schema");
    const { eq, and, lte, notInArray, isNotNull } = await import("drizzle-orm");
    const { businessDateKey: _bdkBd } = await import("./_core/time");
    const today = _bdkBd(); // Cairo — same "today" the BD page uses
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
  listTasks: staffProcedure
    .input(z.object({ dealId: z.number() }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return [];
      const { bdDealTasks } = await import("../drizzle/schema");
      const { eq, asc } = await import("drizzle-orm");
      return db.select().from(bdDealTasks).where(eq(bdDealTasks.dealId, input.dealId)).orderBy(asc(bdDealTasks.done), asc(bdDealTasks.dueDate));
    }),
  addTask: staffProcedure
    .input(z.object({ dealId: z.number(), title: z.string().min(1), dueDate: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertBdDealOwnership(ctx, input.dealId);
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { bdDealTasks } = await import("../drizzle/schema");
      await db.insert(bdDealTasks).values({ ...input, done: false, createdAt: Date.now() });
      return { ok: true };
    }),
  toggleTask: staffProcedure
    .input(z.object({ id: z.number(), done: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { bdDealTasks } = await import("../drizzle/schema");
      const [task] = await db.select().from(bdDealTasks).where(eq(bdDealTasks.id, input.id)).limit(1);
      if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      await assertBdDealOwnership(ctx, task.dealId);
      await db.update(bdDealTasks).set({ done: input.done, doneAt: input.done ? Date.now() : null }).where(eq(bdDealTasks.id, input.id));
      return { ok: true };
    }),
  deleteTask: staffProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { bdDealTasks } = await import("../drizzle/schema");
      const [task] = await db.select().from(bdDealTasks).where(eq(bdDealTasks.id, input.id)).limit(1);
      if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      await assertBdDealOwnership(ctx, task.dealId);
      await db.delete(bdDealTasks).where(eq(bdDealTasks.id, input.id));
      return { ok: true };
    }),
  // Seed the BD team (Ziad / Malak / Ali). Safe to run repeatedly.
  seedUsers: staffProcedure.mutation(async () => {
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
  listUsers: staffProcedure.query(async () => {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return [];
    const { bdUsers } = await import("../drizzle/schema");
    return db.select().from(bdUsers);
  }),
  // ── Companies (top of the BD tree: company → contacts → deals) ──
  /** Lists companies. First call auto-backfills from legacy free-text company
   *  names on contacts, then links contacts + deals to their new companyId. */
  listCompanies: staffProcedure.query(async () => {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return [];
    const { bdCompanies, bdContacts, bdDeals } = await import("../drizzle/schema");
    const { eq, desc, isNull } = await import("drizzle-orm");

    let companies = await db.select().from(bdCompanies);
    const orphanContacts = await db.select().from(bdContacts).where(isNull(bdContacts.companyId));
    if (orphanContacts.length > 0) {
      const now = Date.now();
      // Create any missing companies from distinct legacy names (case-insensitive)
      const byName = new Map(companies.map(c => [c.name.trim().toLowerCase(), c.id]));
      for (const ct of orphanContacts) {
        const key = (ct.company ?? "").trim().toLowerCase();
        if (!key) continue;
        if (!byName.has(key)) {
          const res = await db.insert(bdCompanies).values({
            name: ct.company.trim(), website: ct.website ?? null, source: ct.source ?? null,
            createdAt: now, updatedAt: now,
          });
          const newId = (res as unknown as { insertId: number }).insertId ?? 0;
          byName.set(key, newId);
        }
        const companyId = byName.get(key)!;
        await db.update(bdContacts).set({ companyId }).where(eq(bdContacts.id, ct.id));
      }
      // Link deals to their contact's company
      const allContacts = await db.select().from(bdContacts);
      const contactCompany = new Map(allContacts.map(c => [c.id, c.companyId]));
      const orphanDeals = await db.select().from(bdDeals).where(isNull(bdDeals.companyId));
      for (const d of orphanDeals) {
        const cid = d.contactId ? contactCompany.get(d.contactId) : null;
        if (cid) await db.update(bdDeals).set({ companyId: cid }).where(eq(bdDeals.id, d.id));
      }
      companies = await db.select().from(bdCompanies);
    }
    return companies.sort((a, b) => b.updatedAt - a.updatedAt);
  }),
  addCompany: staffProcedure
    .input(z.object({ name: z.string().min(1).max(255), website: z.string().optional(), industry: z.string().optional(), country: z.string().optional(), source: z.string().optional(), notes: z.string().optional() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { bdCompanies } = await import("../drizzle/schema");
      const now = Date.now();
      const res = await db.insert(bdCompanies).values({ ...input, createdAt: now, updatedAt: now });
      return { ok: true, id: (res as unknown as { insertId: number }).insertId ?? 0 };
    }),
  updateCompany: staffProcedure
    .input(z.object({ id: z.number(), name: z.string().min(1).max(255).optional(), website: z.string().optional(), industry: z.string().optional(), country: z.string().optional(), source: z.string().optional(), notes: z.string().optional() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { bdCompanies, bdContacts } = await import("../drizzle/schema");
      const { id, ...rest } = input;
      await db.update(bdCompanies).set({ ...rest, updatedAt: Date.now() }).where(eq(bdCompanies.id, id));
      // Keep legacy free-text in sync when a company is renamed
      if (rest.name) await db.update(bdContacts).set({ company: rest.name }).where(eq(bdContacts.companyId, id));
      return { ok: true };
    }),
  /** Deleting a company is blocked while it still has contacts or open deals. */
  deleteCompany: staffProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { bdCompanies, bdContacts, bdDeals } = await import("../drizzle/schema");
      const [contacts, deals] = await Promise.all([
        db.select({ id: bdContacts.id }).from(bdContacts).where(eq(bdContacts.companyId, input.id)),
        db.select({ id: bdDeals.id }).from(bdDeals).where(eq(bdDeals.companyId, input.id)),
      ]);
      if (contacts.length || deals.length) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Company still has ${contacts.length} contact(s) and ${deals.length} deal(s) — move or delete them first` });
      }
      await db.delete(bdCompanies).where(eq(bdCompanies.id, input.id));
      return { ok: true };
    }),
  /** Open deals with no logged activity for 14+ days — the "going cold" list. */
  staleDeals: staffProcedure.query(async () => {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return [];
    const { bdDeals } = await import("../drizzle/schema");
    const { and, notInArray, isNull, or, sql } = await import("drizzle-orm");
    // Exclude ignored deals. An ignore is "active" when coldIgnoredAt is set AND
    // no newer activity has been logged since (lastContactedAt > coldIgnoredAt resets it).
    const deals = await db.select().from(bdDeals).where(
      and(
        notInArray(bdDeals.stage, ["closed_won", "closed_lost"]),
        or(
          isNull(bdDeals.coldIgnoredAt),
          // New activity logged after the ignore → deal can go cold again
          sql`${bdDeals.lastContactedAt} > ${bdDeals.coldIgnoredAt}`
        )
      )
    );
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    return deals
      .map(d => {
        const last = d.lastContactedAt ?? d.createdAt;
        return { ...d, lastTouch: last, daysStale: Math.floor((Date.now() - last) / (24 * 60 * 60 * 1000)) };
      })
      .filter(d => d.lastTouch < cutoff)
      .sort((a, b) => a.lastTouch - b.lastTouch);
  }),

  /** Permanently ignore a deal's "going cold" alert. Resets automatically if new activity is logged. */
  ignoreStale: staffProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { bdDeals } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db.update(bdDeals)
        .set({ coldIgnoredAt: Date.now(), updatedAt: Date.now() })
        .where(eq(bdDeals.id, input.id));
      return { ok: true } as const;
    }),
  /** One-shot backfill: create bd_companies rows from legacy free-text contact
   *  company names and link contacts to them. Idempotent — safe to re-run. */
  backfillCompanies: adminProcedure.mutation(async ({ ctx }) => {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const { bdCompanies, bdContacts } = await import("../drizzle/schema");
    const { eq, isNull, and, sql: sqlOp } = await import("drizzle-orm");
    const unlinked = await db.select().from(bdContacts).where(and(isNull(bdContacts.companyId), sqlOp`TRIM(${bdContacts.company}) <> ''`));
    const existing = await db.select({ id: bdCompanies.id, name: bdCompanies.name }).from(bdCompanies);
    const byName = new Map(existing.map(c => [c.name.trim().toLowerCase(), c.id]));
    let created = 0, linked = 0;
    for (const c of unlinked) {
      const key = c.company.trim().toLowerCase();
      let companyId = byName.get(key);
      if (!companyId) {
        const now = Date.now();
        const [ins] = await db.insert(bdCompanies).values({ name: c.company.trim(), createdAt: now, updatedAt: now } as typeof bdCompanies.$inferInsert).$returningId();
        companyId = ins?.id;
        if (companyId) byName.set(key, companyId);
        created++;
      }
      if (companyId) {
        await db.update(bdContacts).set({ companyId, updatedAt: Date.now() }).where(eq(bdContacts.id, c.id));
        linked++;
      }
    }
    await auditEntry(ctx.user, "bd_backfill_companies", "bd", "all", JSON.stringify({ created, linked }));
    return { created, linked };
  }),
  /** Full company timeline: its own notes + every activity on its deals. */
  listCompanyActivity: staffProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return [];
      const { bdDealActivity, bdDeals } = await import("../drizzle/schema");
      const { eq, inArray } = await import("drizzle-orm");
      const companyDeals = await db.select().from(bdDeals).where(eq(bdDeals.companyId, input.companyId));
      const dealIds = companyDeals.map(d => d.id);
      const dealTitle = new Map(companyDeals.map(d => [d.id, d.title]));
      const [companyNotes, dealNotes] = await Promise.all([
        db.select().from(bdDealActivity).where(eq(bdDealActivity.companyId, input.companyId)),
        dealIds.length ? db.select().from(bdDealActivity).where(inArray(bdDealActivity.dealId, dealIds)) : Promise.resolve([]),
      ]);
      return [...companyNotes, ...dealNotes]
        .map(a => ({ ...a, dealTitle: a.dealId ? (dealTitle.get(a.dealId) ?? null) : null }))
        .sort((a, b) => b.createdAt - a.createdAt);
    }),
  addCompanyActivity: staffProcedure
    .input(z.object({ companyId: z.number(), note: z.string().min(1), createdBy: z.number().optional() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { bdDealActivity } = await import("../drizzle/schema");
      await db.insert(bdDealActivity).values({ companyId: input.companyId, note: input.note, createdBy: input.createdBy, createdAt: Date.now() } as never);
      return { ok: true };
    }),
  // ── Contacts (shared across the team) ──
  listContacts: staffProcedure.query(async () => {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return [];
    const { bdContacts } = await import("../drizzle/schema");
    const { desc } = await import("drizzle-orm");
    return db.select().from(bdContacts).orderBy(desc(bdContacts.updatedAt));
  }),
  addContact: staffProcedure
    .input(z.object({ companyId: z.number().optional(), company: z.string().optional(), contactName: z.string().optional(), jobTitle: z.string().optional(), email: z.string().optional(), phone: z.string().optional(), website: z.string().optional(), source: z.string().optional(), notes: z.string().optional(), createdBy: z.number().optional() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { bdContacts, bdCompanies } = await import("../drizzle/schema");
      // Keep the legacy free-text company column in sync with the linked company
      let companyName = input.company ?? "";
      if (input.companyId) {
        const [c] = await db.select().from(bdCompanies).where(eq(bdCompanies.id, input.companyId)).limit(1);
        if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });
        companyName = c.name;
      }
      if (!companyName) throw new TRPCError({ code: "BAD_REQUEST", message: "companyId or company name is required" });
      const now = Date.now();
      const result = await db.insert(bdContacts).values({ ...input, company: companyName, createdAt: now, updatedAt: now });
      const insertId = (result as unknown as { insertId: number }).insertId;
      return { ok: true, id: insertId ?? 0 };
    }),
  updateContact: staffProcedure
    .input(z.object({ id: z.number(), companyId: z.number().optional(), company: z.string().optional(), contactName: z.string().optional(), jobTitle: z.string().optional(), email: z.string().optional(), phone: z.string().optional(), website: z.string().optional(), source: z.string().optional(), notes: z.string().optional() }))
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
  deleteContact: staffProcedure
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
  listDeals: staffProcedure
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
  addDeal: staffProcedure
    .input(z.object({ title: z.string().min(1), ownerId: z.number(), companyId: z.number().optional(), contactId: z.number().optional(), stage: z.enum(["follow_up", "negotiations", "review", "partners_consultants", "closed_won", "closed_lost"]).optional(), serviceType: z.string().optional(), seats: z.number().optional(), value: z.string().optional(), notes: z.string().optional(), expectedCloseDate: z.string().optional() }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { bdDeals } = await import("../drizzle/schema");
      const now = Date.now();
      await db.insert(bdDeals).values({ ...input, stage: input.stage ?? "follow_up", createdAt: now, updatedAt: now });
      return { ok: true };
    }),
  updateDeal: staffProcedure
    .input(z.object({ id: z.number(), title: z.string().optional(), ownerId: z.number().optional(), companyId: z.number().optional(), contactId: z.number().optional(), serviceType: z.string().optional(), seats: z.number().optional(), value: z.string().optional(), notes: z.string().optional(), expectedCloseDate: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertBdDealOwnership(ctx, input.id);
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { bdDeals } = await import("../drizzle/schema");
      const { id, ...rest } = input;
      await db.update(bdDeals).set({ ...rest, updatedAt: Date.now() }).where(eq(bdDeals.id, id));
      return { ok: true };
    }),
  moveStage: staffProcedure
    .input(z.object({ id: z.number(), stage: z.enum(["follow_up", "negotiations", "review", "partners_consultants", "closed_won", "closed_lost"]), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertBdDealOwnership(ctx, input.id);
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { bdDeals } = await import("../drizzle/schema");
      const closed = input.stage === "closed_won" || input.stage === "closed_lost";
      await db.update(bdDeals).set({
        stage: input.stage, updatedAt: Date.now(), stageChangedAt: Date.now(),
        // Closing stamps the outcome; REOPENING clears it, so a revived deal
        // doesn't keep a stale closedAt/outcomeReason from its previous life.
        ...(closed ? { closedAt: Date.now(), outcomeReason: input.reason ?? null } : { closedAt: null, outcomeReason: null }),
      }).where(eq(bdDeals.id, input.id));
      return { ok: true };
    }),
  // Activity log — a timestamped note; also refreshes the deal's last-contacted date
  addActivity: staffProcedure
    .input(z.object({ dealId: z.number(), note: z.string().min(1), createdBy: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertBdDealOwnership(ctx, input.dealId);
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
  listActivity: staffProcedure
    .input(z.object({ dealId: z.number() }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return [];
      const { bdDealActivity } = await import("../drizzle/schema");
      const { eq, desc } = await import("drizzle-orm");
      return db.select().from(bdDealActivity).where(eq(bdDealActivity.dealId, input.dealId)).orderBy(desc(bdDealActivity.createdAt));
    }),
  setReminder: staffProcedure
    .input(z.object({ id: z.number(), reminderDate: z.string().optional(), reminderNote: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertBdDealOwnership(ctx, input.id);
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { bdDeals } = await import("../drizzle/schema");
      await db.update(bdDeals).set({ reminderDate: input.reminderDate ?? null, reminderNote: input.reminderNote ?? null, updatedAt: Date.now() }).where(eq(bdDeals.id, input.id));
      return { ok: true };
    }),
  deleteDeal: staffProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertBdDealOwnership(ctx, input.id);
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
  linkMyLogin: staffProcedure
    .input(z.object({ bdUserId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const openId = ctx.user.openId;
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { bdUsers } = await import("../drizzle/schema");
      const target = (await db.select().from(bdUsers).where(eq(bdUsers.id, input.bdUserId)).limit(1))[0];
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "BD user not found" });
      if (target.openId && target.openId !== openId) throw new TRPCError({ code: "BAD_REQUEST", message: target.name + " is already linked to another login." });
      // Self-service linking is only allowed when the BD profile's email matches the login's email.
      // Anything else (no email on file, mismatch, or claiming a BD admin) must be done by a Hub admin via bd.linkLogin.
      const isHubAdmin = ctx.user.role === "admin" || ctx.user.role === "owner";
      const emailsMatch = !!target.email && !!ctx.user.email && target.email.trim().toLowerCase() === ctx.user.email.trim().toLowerCase();
      if (!isHubAdmin && (!emailsMatch || target.role === "admin")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "This BD profile can only be linked to your login by an admin." });
      }
      await db.update(bdUsers).set({ openId }).where(eq(bdUsers.id, input.bdUserId));
      // Give the Hub login the matching role so the server-side staff gate admits them.
      if (ctx.user.role === "user" || ctx.user.role === "viewer") {
        const { users } = await import("../drizzle/schema");
        await db.update(users).set({ role: "bd" }).where(eq(users.openId, openId));
      }
      await auditEntry(ctx.user, "bd_link_login", "bd_user", String(input.bdUserId), JSON.stringify({ self: !isHubAdmin }));
      return { ok: true, name: target.name };
    }),
  // Bell: count + list of due/overdue reminders and tasks for an owner (or all)
  dueItems: staffProcedure
    .input(z.object({ ownerId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return { count: 0, items: [] as { kind: string; dealId: number; title: string; due: string }[] };
      const { bdDeals, bdDealTasks: bdTasks } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const { businessDateKey: _bdkBd2 } = await import("./_core/time");
      const today = _bdkBd2(); // Cairo — the bell and the BD page now agree on "due today"
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
// ─── Presence Router ─────────────────────────────────────────────────────────
/**
 * Presence rows seen within `windowMs`. Demo/test agents never appear. An AGENT only sees colleagues of
 * their own client (Quantum agents don't see Apello and vice-versa); staff see everyone.
 */
async function presenceRows(ctx: { agent: { traineeCode: string } | null; user: unknown }, windowMs: number) {
  const { getDb } = await import("./db");
  const { agentPresence, workforceAgents, campaigns } = await import("../drizzle/schema");
  const { gte, eq, and, or, isNull, inArray } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) return [];
  const since = Date.now() - windowMs;
  const rows = await db.select({ p: agentPresence, isDemo: workforceAgents.isDemo, clientId: campaigns.clientId })
    .from(agentPresence)
    .leftJoin(workforceAgents, eq(workforceAgents.traineeCode, agentPresence.traineeCode))
    .leftJoin(campaigns, eq(campaigns.id, agentPresence.campaignId))
    .where(and(gte(agentPresence.lastSeen, since), or(isNull(workforceAgents.isDemo), eq(workforceAgents.isDemo, false))));
  void inArray;
  const staffRole = (ctx.user as { role?: string } | null | undefined)?.role;
  if (ctx.agent && !(ctx.user && isStaff(staffRole))) {
    const me = rows.find(r => r.p.traineeCode === ctx.agent!.traineeCode);
    let myClient: number | null = me?.clientId ?? null;
    if (myClient == null) {
      const [w] = await db.select({ clientId: campaigns.clientId }).from(workforceAgents).innerJoin(campaigns, eq(campaigns.id, workforceAgents.campaignId)).where(eq(workforceAgents.traineeCode, ctx.agent.traineeCode)).limit(1);
      myClient = w?.clientId ?? null;
    }
    return rows.filter(r => myClient == null ? r.p.traineeCode === ctx.agent!.traineeCode : r.clientId === myClient).map(r => r.p);
  }
  return rows.map(r => r.p);
}

const presenceRouter = router({
  /** Agent calls this every 60s to mark themselves online. Identity comes from the session cookie. */
  heartbeat: agentProcedure
    .input(z.object({ traineeCode: z.string().optional(), status: z.enum(["available","on_break","on_call","away"]).optional(), customNote: z.string().max(30).optional() }))
    .mutation(async ({ input, ctx }) => {
      const traineeCode = ctx.agent.traineeCode;
      const { getDb } = await import("./db");
      const { agentPresence, workforceAgents, agentAuxLogs } = await import("../drizzle/schema");
      const { eq, and, isNull: isNullOp, desc } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return { ok: false };
      const [agent] = await db.select({ alias: workforceAgents.alias, fullName: workforceAgents.fullName, campaignId: workforceAgents.campaignId, avatarUrl: workforceAgents.avatarUrl })
        .from(workforceAgents).where(eq(workforceAgents.traineeCode, traineeCode)).limit(1);
      // Presence mirrors AUX: an open AUX row always wins over the self-reported status.
      const [openAux] = await db.select({ auxType: agentAuxLogs.auxType }).from(agentAuxLogs)
        .where(and(eq(agentAuxLogs.traineeCode, traineeCode), isNullOp(agentAuxLogs.endTime)))
        .orderBy(desc(agentAuxLogs.startTime)).limit(1);
      const status = openAux ? (openAux.auxType === "break" || openAux.auxType === "lunch" || openAux.auxType === "bathroom" ? "on_break" : "away") : (input.status ?? "available");
      await db.insert(agentPresence).values({
        traineeCode,
        alias: agent?.alias ?? null,
        fullName: agent?.fullName ?? null,
        avatarUrl: agent?.avatarUrl ?? null,
        status,
        customNote: input.customNote ?? null,
        lastSeen: Date.now(),
        campaignId: agent?.campaignId ?? null,
      }).onDuplicateKeyUpdate({
        set: {
          status,
          customNote: input.customNote ?? null,
          lastSeen: Date.now(),
          alias: agent?.alias ?? null,
          fullName: agent?.fullName ?? null,
          avatarUrl: agent?.avatarUrl ?? null,
          campaignId: agent?.campaignId ?? null, // follows transferCampaign
        }
      });
      return { ok: true };
    }),

  /** Currently online agents (seen within last 5 minutes). Agents and staff only. */
  list: agentOrStaffProcedure.query(async ({ ctx }) => presenceRows(ctx, 5 * 60 * 1000)),

  /** All agents presence (online + recent offline) for the directory. Agents and staff only. */
  listAll: agentOrStaffProcedure.query(async ({ ctx }) => presenceRows(ctx, 60 * 60 * 1000)),

  /** Agent sets their own status */
  setStatus: agentProcedure
    .input(z.object({ traineeCode: z.string().optional(), status: z.enum(["available","on_break","on_call","away"]), customNote: z.string().max(30).optional() }))
    .mutation(async ({ input, ctx }) => {
      const { getDb } = await import("./db");
      const { agentPresence } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return { ok: false };
      await db.update(agentPresence).set({ status: input.status, customNote: input.customNote ?? null, lastSeen: Date.now() }).where(eq(agentPresence.traineeCode, ctx.agent.traineeCode));
      return { ok: true };
    }),

  /** Agent goes offline */
  offline: agentProcedure
    .input(z.object({ traineeCode: z.string().optional() }).optional())
    .mutation(async ({ ctx }) => {
      const { getDb } = await import("./db");
      const { agentPresence } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return { ok: false };
      await db.update(agentPresence).set({ lastSeen: 0 }).where(eq(agentPresence.traineeCode, ctx.agent.traineeCode));
      return { ok: true };
    }),
});

// ─── Warnings Router ─────────────────────────────────────────────────────────
const warningsRouter = router({
  /** List all warnings for an agent */
  list: staffProcedure
    .input(z.object({ traineeCode: z.string() }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const { agentWarnings } = await import("../drizzle/schema");
      const { eq, desc } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return [];
      return db.select().from(agentWarnings).where(eq(agentWarnings.traineeCode, input.traineeCode)).orderBy(desc(agentWarnings.issuedAt));
    }),

  /** Issue a warning — HR/manager only */
  issue: staffProcedure
    .input(z.object({
      traineeCode: z.string(),
      warningType: z.enum(["verbal", "written", "final"]),
      reason: z.string().min(10),
      note: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const allowed = ["hr", "admin", "owner", "ops_manager", "manager"];
      if (!allowed.includes(ctx.user?.role ?? "")) throw new TRPCError({ code: "FORBIDDEN", message: "Only HR and managers can issue warnings." });
      const { getDb } = await import("./db");
      const { agentWarnings } = await import("../drizzle/schema");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.insert(agentWarnings).values({
        traineeCode: input.traineeCode,
        warningType: input.warningType,
        reason: input.reason,
        issuedBy: ctx.user?.name ?? ctx.user?.email ?? "HR",
        issuedAt: Date.now(),
        note: input.note ?? null,
      });
      await auditEntry(ctx.user, `warning_issued_${input.warningType}`, "agent", input.traineeCode, JSON.stringify({ reason: input.reason, issuedBy: ctx.user?.name }));
      return { ok: true };
    }),

  /** Delete a warning — admin/owner only */
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin" && ctx.user?.role !== "owner") throw new TRPCError({ code: "FORBIDDEN" });
      const { getDb } = await import("./db");
      const { agentWarnings } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(agentWarnings).where(eq(agentWarnings.id, input.id));
      return { ok: true };
    }),
});

const crdtsArchiveRouter = router({
  // Is this CRDTS already held by another agent? Flags if that agent is resigned/terminated.
  checkReuse: staffProcedure
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
      const inactive = ["resigned", "terminated", "blacklisted"].includes(holder.agentStatus ?? "");
      return { conflict: true as const, inactive, holder };
    }),
  listArchive: staffProcedure.query(async () => {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return [];
    const { crdtsArchive } = await import("../drizzle/schema");
    const { desc } = await import("drizzle-orm");
    return db.select().from(crdtsArchive).orderBy(desc(crdtsArchive.archivedAt));
  }),
  // Record a handover on override, then clear CRDTS off the previous holder so it
  // points to the new agent going forward. Previous agent's records are untouched.
  archiveHandover: roleProcedure("hr", "manager")
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
        // Relabel instead of NULLing: archiveAgentCrdts renames the number to
        // "N (k)" across the previous holder's row AND every history table, so
        // the new holder does not inherit the old agent's payroll/performance
        // rows (which stayed keyed to the bare number when we just cleared it).
        const { archiveAgentCrdts } = await import("./db");
        await archiveAgentCrdts(prev.traineeCode);
      }
      return { ok: true };
    }),
});


// ═══ LEAVE MANAGEMENT — casual (عارضة) / annual (اعتيادية) ═══
const leaveRouter = router({
  mine: agentProcedure.query(async ({ ctx }) => {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return [];
    const { leaveRequests } = await import("../drizzle/schema");
    const { eq, desc } = await import("drizzle-orm");
    return db.select().from(leaveRequests).where(eq(leaveRequests.traineeCode, ctx.agent.traineeCode)).orderBy(desc(leaveRequests.createdAt));
  }),
  // Staff: one agent's requests (used by the HR profile page).
  myRequests: staffProcedure
    .input(z.object({ traineeCode: z.string() }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return [];
      const { leaveRequests } = await import("../drizzle/schema");
      const { eq, desc } = await import("drizzle-orm");
      return db.select().from(leaveRequests).where(eq(leaveRequests.traineeCode, input.traineeCode)).orderBy(desc(leaveRequests.createdAt));
    }),
  listRequests: staffProcedure
    .input(z.object({ status: z.enum(["pending", "approved", "rejected", "cancelled"]).optional() }).optional())
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return [];
      const { leaveRequests } = await import("../drizzle/schema");
      const { eq, desc } = await import("drizzle-orm");
      if (input?.status) return db.select().from(leaveRequests).where(eq(leaveRequests.status, input.status)).orderBy(desc(leaveRequests.createdAt));
      return db.select().from(leaveRequests).orderBy(desc(leaveRequests.createdAt));
    }),
  // HR decides: classify the type + approve/reject. ONE transactional path (see db.decideLeaveRequest).
  decide: roleProcedure("hr", "manager", "ops_manager", "team_lead")
    .input(z.object({ id: z.number(), status: z.enum(["approved", "rejected"]), leaveType: z.enum(["casual", "annual", "unpaid"]).optional() }))
    .mutation(async ({ input, ctx }) => {
      const { decideLeaveRequest } = await import("./db");
      const { LEAVE_DEFAULTS } = await import("@shared/const");
      try {
        const r = await decideLeaveRequest({ id: input.id, decision: input.status, leaveType: input.leaveType, decidedBy: ctx.user.name ?? ctx.user.email ?? "admin", defaults: LEAVE_DEFAULTS });
        await auditEntry(ctx.user, input.status === "approved" ? "leave_approved" : "leave_rejected", "leave_request", String(input.id), JSON.stringify({ leaveType: input.leaveType, traineeCode: r.traineeCode, days: r.days }));
        return { ok: true };
      } catch (e) {
        throw toTrpcError(e, "Failed to decide leave");
      }
    }),
  /** HR cancels a request. Cancelling an APPROVED casual/annual leave re-credits the days. */
  cancel: roleProcedure("hr", "manager", "ops_manager", "team_lead")
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { cancelLeaveRequest } = await import("./db");
      try {
        const r = await cancelLeaveRequest({ id: input.id, cancelledBy: ctx.user.name ?? ctx.user.email ?? "admin" });
        await auditEntry(ctx.user, "leave_cancelled", "leave_request", String(input.id), JSON.stringify({ traineeCode: r.traineeCode, days: r.days, reCredited: r.wasApproved }));
        return { ok: true };
      } catch (e) {
        throw toTrpcError(e, "Failed to cancel leave");
      }
    }),
  /** Agent withdraws their OWN still-pending request. */
  cancelMine: agentProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { cancelLeaveRequest } = await import("./db");
      try {
        await cancelLeaveRequest({ id: input.id, cancelledBy: ctx.agent.traineeCode, byAgent: ctx.agent.traineeCode });
        return { ok: true };
      } catch (e) {
        throw toTrpcError(e, "Failed to cancel leave");
      }
    }),
  listBalances: staffProcedure
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
  massAdd: roleProcedure("manager", "hr")
    .input(z.object({ casual: z.number().min(0), annual: z.number().min(0) }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const { eq, and, sql, notInArray } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { leaveBalances, workforceAgents } = await import("../drizzle/schema");
      const year = new Date().getFullYear();
      // SAME set as leave.massSetBalances: every non-terminal employee (frozen /
      // on-notice agents are still employees and keep accruing), demo accounts
      // excluded — the two mass endpoints used to disagree on who exists.
      const { or: orOp2, isNull: isNull2, eq: eq2 } = await import("drizzle-orm");
      const agents = await db.select({ traineeCode: workforceAgents.traineeCode }).from(workforceAgents)
        .where(and(
          notInArray(workforceAgents.agentStatus, ["resigned", "terminated", "blacklisted"]),
          orOp2(isNull2(workforceAgents.isDemo), eq2(workforceAgents.isDemo, false)),
        ));
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
  get: staffProcedure
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
  pendingChecklist: staffProcedure.query(async () => {
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
      // Blacklisted leavers can be owed money too — all three terminal statuses
      // go through the same Settle & Exit flow (matches Operations' banner).
      .where(inArray(workforceAgents.agentStatus, ["resigned", "terminated", "blacklisted"]));
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
  pendingSettlement: staffProcedure.query(async () => {
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
      // Same three terminal statuses as pendingChecklist / the Dashboard count.
      .where(inArray(workforceAgents.agentStatus, ["resigned", "terminated", "blacklisted"]));
    if (!agents.length) return [];
    const codes = agents.map(a => a.traineeCode);
    const eps = await db.select().from(exitProcess).where(inArray(exitProcess.traineeCode, codes));
    const epMap = new Map(eps.map(e => [e.traineeCode, e]));
    return agents
      .filter(a => !a.salarySettled)
      .map(a => ({ ...a, exitProcess: epMap.get(a.traineeCode) ?? null }));
  }),
  // Mark salary settled (BEFORE checklist — step 2 in lifecycle)
  markSettled: roleProcedure("finance", "hr", "manager")
    .input(z.object({ traineeCode: z.string(), settled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const { settleAgent } = await import("./db");
      await settleAgent(input.traineeCode, input.settled);
      await auditEntry(ctx.user, input.settled ? "mark_settled" : "mark_unsettled", "agent", input.traineeCode, undefined);
      return { ok: true };
    }),
  upsert: roleProcedure("hr", "manager")
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
      const { traineeCode, settlementDone: _ignoreSettle2, ...rest } = input;
      // settlementDone is written ONLY through settleAgent (markSettled).
      void _ignoreSettle2;
      const now = Date.now();
      const ex = await db.select().from(exitProcess).where(eq(exitProcess.traineeCode, traineeCode)).limit(1);
      if (ex[0]) await db.update(exitProcess).set({ ...rest, updatedAt: now }).where(eq(exitProcess.traineeCode, traineeCode));
      else await db.insert(exitProcess).values({ traineeCode, ...rest, updatedAt: now });
      return { ok: true };
    }),
  // Archive: requires salary settled AND checklist complete (interview, clearance, assets, last day)
  archive: roleProcedure("hr", "manager")
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
        try { await db.update(candidates).set({ status: ag.agentStatus as "resigned" | "terminated" }).where(eq(candidates.id, ag.candidateId)); } catch (e) { console.warn("[Separation] Failed to update candidates table:", e instanceof Error ? e.message : e); }
      }
      return { ok: true };
    }),
  /** Transfer an agent to a different campaign (and thus potentially a different client) */
  transferCampaign: staffProcedure
    .input(z.object({
      traineeCode: z.string().min(1),
      campaignId: z.number().int().positive(),
      /** For position-based clients (e.g. Quantum) — also update the agent's jobTitle */
      jobTitle: z.string().min(1).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin" && ctx.user?.role !== "owner" && ctx.user?.role !== "hr") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admins and HR can transfer agents between campaigns." });
      }
      const { updateWorkforceAgent, getDb } = await import("./db");
      // The target campaign must exist — otherwise the agent is orphaned and loses AUX/time-tracking access.
      const target = await getCampaignById(input.campaignId);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Target campaign not found" });
      // Position-based target client: a position from its managed list is REQUIRED; moving to a campaign-based
      // client clears any old position.
      let targetPositionBased = false;
      {
        const dbp = await getDb();
        if (dbp && target.clientId) {
          const { clients, clientPositions } = await import("../drizzle/schema");
          const { eq, and, sql: sqlOp } = await import("drizzle-orm");
          const [cl] = await dbp.select({ positionBased: clients.positionBased, name: clients.name }).from(clients).where(eq(clients.id, target.clientId)).limit(1);
          targetPositionBased = !!cl?.positionBased;
          if (targetPositionBased) {
            if (!input.jobTitle?.trim()) throw new TRPCError({ code: "BAD_REQUEST", message: `${cl?.name} is position-based — pick a position.` });
            const [pos] = await dbp.select({ id: clientPositions.id }).from(clientPositions)
              .where(and(eq(clientPositions.clientId, target.clientId), eq(clientPositions.isActive, true), sqlOp`LOWER(${clientPositions.name}) = LOWER(${input.jobTitle.trim()})`)).limit(1);
            if (!pos) throw new TRPCError({ code: "BAD_REQUEST", message: `"${input.jobTitle}" is not in ${cl?.name}'s position list.` });
          }
        }
      }
      await updateWorkforceAgent(input.traineeCode, {
        campaignId: input.campaignId,
        jobTitle: targetPositionBased ? input.jobTitle!.trim() : "",
      });
      // Keep presence in step so the directory shows the new campaign immediately.
      const db = await getDb();
      if (db) {
        const { agentPresence } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await db.update(agentPresence).set({ campaignId: input.campaignId }).where(eq(agentPresence.traineeCode, input.traineeCode));
      }
      invalidateAgentSessionCache(input.traineeCode);
      await auditEntry(ctx.user, "transfer_campaign", "agent", input.traineeCode, JSON.stringify({ campaignId: input.campaignId, jobTitle: input.jobTitle }));
      return { ok: true };
    }),
});

const sessionRouter = router({
  list: staffProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin" && ctx.user?.role !== "owner") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const { listSessionLogs } = await import("./sessionLog");
    return listSessionLogs();
  }),
  revoke: staffProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin" && ctx.user?.role !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const { revokeSessionLog, getSessionLogById } = await import("./sessionLog");
      const row = await getSessionLogById(input.id);
      await revokeSessionLog(input.id, ctx.user.name || ctx.user.openId);
      // Actually enforce it: every Hub token that user holds dies now.
      if (row?.userId) {
        const { getDb } = await import("./db");
        const db = await getDb();
        if (db) {
          const { users } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          await db.update(users).set({ sessionsRevokedAt: Date.now() }).where(eq(users.openId, row.userId));
        }
      }
      await auditEntry(ctx.user, "revoke_session", "user", row?.userId ?? String(input.id), "{}");
      return { ok: true } as const;
    }),
});

// ─── Clients Router ───────────────────────────────────────────────────────────
const clientsRouter = router({
  list: staffProcedure.query(() => listClients()),

  create: roleProcedure("manager")
    .input(z.object({
      name: z.string().min(1),
      shortCode: z.string().min(1).max(20),
      colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    }))
    .mutation(({ input }) => createClient(input)),

  update: roleProcedure("manager")
    .input(z.object({
      id: z.number().int().positive(),
      name: z.string().min(1).optional(),
      shortCode: z.string().min(1).max(20).optional(),
      colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      isActive: z.boolean().optional(),
      timeTrackingEnabled: z.boolean().optional(),
      positionBased: z.boolean().optional(),
    }))
    .mutation(({ input }) => { const { id, ...rest } = input; return updateClient(id, rest); }),

  assignCampaign: roleProcedure("manager", "ops_manager", "hr")
    .input(z.object({
      campaignId: z.number().int().positive(),
      clientId: z.number().int().positive().nullable(),
    }))
    .mutation(({ input }) => assignCampaignToClient(input.campaignId, input.clientId)),

  // ─── Positions / roles per client (Quantum) ────────────────────────────────
  /** Positions of one client, with live headcount per position (demo agents excluded). */
  positions: staffProcedure
    .input(z.object({ clientId: z.number().int().positive(), includeInactive: z.boolean().optional() }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return [];
      const { clientPositions, workforceAgents, campaigns } = await import("../drizzle/schema");
      const { eq, and, or, isNull, asc } = await import("drizzle-orm");
      const rows = await db.select().from(clientPositions)
        .where(input.includeInactive ? eq(clientPositions.clientId, input.clientId) : and(eq(clientPositions.clientId, input.clientId), eq(clientPositions.isActive, true)))
        .orderBy(asc(clientPositions.sortOrder), asc(clientPositions.name));
      const agents = await db.select({ jobTitle: workforceAgents.jobTitle, isActive: workforceAgents.isActive, agentStatus: workforceAgents.agentStatus })
        .from(workforceAgents).innerJoin(campaigns, eq(campaigns.id, workforceAgents.campaignId))
        .where(and(eq(campaigns.clientId, input.clientId), or(isNull(workforceAgents.isDemo), eq(workforceAgents.isDemo, false))));
      const count = new Map<string, number>();
      for (const a of agents) {
        if (!a.isActive || (a.agentStatus && a.agentStatus !== "active")) continue;
        const k = (a.jobTitle ?? "").trim().toLowerCase();
        count.set(k, (count.get(k) ?? 0) + 1);
      }
      return rows.map(r => ({ ...r, headcount: count.get(r.name.trim().toLowerCase()) ?? 0 }));
    }),

  createPosition: roleProcedure("manager", "ops_manager", "hr")
    .input(z.object({ clientId: z.number().int().positive(), name: z.string().trim().min(1).max(150), targetHeadcount: z.number().int().min(0).nullable().optional() }))
    .mutation(async ({ input, ctx }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { clientPositions } = await import("../drizzle/schema");
      const { eq, and, sql: sqlOp } = await import("drizzle-orm");
      const [dup] = await db.select({ id: clientPositions.id, isActive: clientPositions.isActive }).from(clientPositions)
        .where(and(eq(clientPositions.clientId, input.clientId), sqlOp`LOWER(${clientPositions.name}) = LOWER(${input.name})`)).limit(1);
      if (dup) {
        if (!dup.isActive) { await db.update(clientPositions).set({ isActive: true, name: input.name }).where(eq(clientPositions.id, dup.id)); return { id: dup.id, reactivated: true }; }
        throw new TRPCError({ code: "CONFLICT", message: `Position "${input.name}" already exists for this client.` });
      }
      const [ins] = await db.insert(clientPositions).values({ clientId: input.clientId, name: input.name, targetHeadcount: input.targetHeadcount ?? null, createdAt: Date.now() }).$returningId();
      await auditEntry(ctx.user, "create_position", "client_position", String(ins.id), JSON.stringify(input));
      return { id: ins.id, reactivated: false };
    }),

  /** Rename / retarget / deactivate. Renaming cascades to every agent of that client holding the old title. */
  updatePosition: roleProcedure("manager", "ops_manager", "hr")
    .input(z.object({ id: z.number().int().positive(), name: z.string().trim().min(1).max(150).optional(), targetHeadcount: z.number().int().min(0).nullable().optional(), isActive: z.boolean().optional(), sortOrder: z.number().int().optional() }))
    .mutation(async ({ input, ctx }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const { clientPositions, workforceAgents, campaigns } = await import("../drizzle/schema");
      const { eq, and, inArray, sql: sqlOp } = await import("drizzle-orm");
      const [row] = await db.select().from(clientPositions).where(eq(clientPositions.id, input.id)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Position not found" });
      const patch: Partial<typeof row> = {};
      if (input.name !== undefined && input.name !== row.name) {
        const [dup] = await db.select({ id: clientPositions.id }).from(clientPositions)
          .where(and(eq(clientPositions.clientId, row.clientId), sqlOp`LOWER(${clientPositions.name}) = LOWER(${input.name})`)).limit(1);
        if (dup && dup.id !== row.id) throw new TRPCError({ code: "CONFLICT", message: `Position "${input.name}" already exists.` });
        patch.name = input.name;
        // cascade to agents of this client
        const camps = await db.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.clientId, row.clientId));
        if (camps.length) {
          await db.update(workforceAgents).set({ jobTitle: input.name })
            .where(and(inArray(workforceAgents.campaignId, camps.map(c => c.id)), sqlOp`LOWER(TRIM(${workforceAgents.jobTitle})) = LOWER(${row.name})`));
        }
      }
      if (input.targetHeadcount !== undefined) patch.targetHeadcount = input.targetHeadcount;
      if (input.isActive === false && row.isActive) {
        const camps = await db.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.clientId, row.clientId));
        if (camps.length) {
          // Same predicate as the positions headcount column (isActive AND
          // agentStatus active) — isActive alone let a frozen agent block
          // retiring a position whose displayed headcount was already 0.
          const [held] = await db.select({ id: workforceAgents.id }).from(workforceAgents)
            .where(and(inArray(workforceAgents.campaignId, camps.map(c => c.id)), eq(workforceAgents.isActive, true), eq(workforceAgents.agentStatus, "active"), sqlOp`LOWER(TRIM(${workforceAgents.jobTitle})) = LOWER(${row.name})`)).limit(1);
          if (held) throw new TRPCError({ code: "CONFLICT", message: `"${row.name}" still has active agents — move them to another position first.` });
        }
      }
      if (input.isActive !== undefined) patch.isActive = input.isActive;
      if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;
      if (Object.keys(patch).length) await db.update(clientPositions).set(patch).where(eq(clientPositions.id, input.id));
      await auditEntry(ctx.user, "update_position", "client_position", String(input.id), JSON.stringify({ before: row, patch }));
      return { ok: true };
    }),

  getDashboard: staffProcedure
    .input(z.object({
      clientId: z.number().int().positive(),
      month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Default to the CURRENT PAY CYCLE (26th→25th Cairo) — payroll rows are
      // keyed by cycle, so a UTC calendar-month default showed last cycle's
      // payroll as "current" from the 26th to month-end.
      const { cycleKeyFor: ckf, businessDateKey: bdk, businessDayBounds: bdb } = await import("./_core/time");
      const month = input.month || ckf(bdk());
      const { clients, campaigns, payrollRecords, adherenceLog } = await import("../drizzle/schema");
      const { eq, and, inArray } = await import("drizzle-orm");

      // Get client
      const [client] = await db.select().from(clients).where(eq(clients.id, input.clientId)).limit(1);
      if (!client) throw new Error("Client not found");

      // Get campaigns for this client
      const clientCampaigns = await db.select().from(campaigns).where(eq(campaigns.clientId, input.clientId));

      // Get agents via db helper
      const { listWorkforceAgentsByClient } = await import("./db");
      const activeAgents = await listWorkforceAgentsByClient(input.clientId);
      const allAgents = await listWorkforceAgentsByClient(input.clientId, true);

      // Payroll for this month. V2 rows are keyed by CRDTS and agentCode is often
      // NULL, so match on EITHER key (comma-split crdts included) — matching on
      // agentCode alone silently dropped most of the month.
      const agentCodes = allAgents.map(a => a.traineeCode).filter((c): c is string => Boolean(c));
      const payrollCrdts = Array.from(new Set(allAgents.flatMap(a =>
        String((a as { crdts?: string | null }).crdts ?? "").split(",").map(x => x.trim()).filter(Boolean)
      )));
      let payroll: typeof payrollRecords.$inferSelect[] = [];
      if (canSeeMoney(ctx.user?.role) && (agentCodes.length > 0 || payrollCrdts.length > 0)) {
        const { or: orOp } = await import("drizzle-orm");
        const keyMatch = agentCodes.length && payrollCrdts.length
          ? orOp(inArray(payrollRecords.agentCode, agentCodes), inArray(payrollRecords.crdts, payrollCrdts))
          : agentCodes.length ? inArray(payrollRecords.agentCode, agentCodes)
          : inArray(payrollRecords.crdts, payrollCrdts);
        payroll = await db.select().from(payrollRecords)
          .where(and(eq(payrollRecords.month, month), keyMatch));
      }
      // Per-row FINAL total (net + commission + adjustments) computed with the
      // shared formula — the client renders these instead of re-deriving money.
      let payrollWithTotals: Array<typeof payrollRecords.$inferSelect & { finalTotal: number }> = [];
      if (payroll.length) {
        const { payrollAdjustments: adjT2, workforceAgents: waT2 } = await import("../drizzle/schema");
        const { isNotNull: nn2 } = await import("drizzle-orm");
        const { widenCrdtsAgainst, adjMatchesIdentity } = await import("./db");
        const allAdj2 = await db.select().from(adjT2).where(eq(adjT2.month, month));
        const roster2 = (await db.select({ crdts: waT2.crdts }).from(waT2).where(nn2(waT2.crdts))).map(a => a.crdts);
        payrollWithTotals = payroll.map(r => {
          const identity = widenCrdtsAgainst(String(r.crdts ?? ""), roster2);
          return { ...r, finalTotal: calcFinalPay(r, allAdj2.filter(a => adjMatchesIdentity(a.crdts, identity))) };
        });
      }

      // Adherence for this month. adherence_log has no live writer any more, so the dashboard reads the
      // two tables that ARE written: self-logged attendance exceptions (late / early_departure) and the
      // nightly attendance violations from the sheets. Shape is normalised to { agentCode, date, type }.
      const agentCodesList = allAgents.map(a => a.traineeCode).filter((c): c is string => Boolean(c));
      const crdtsList = allAgents.map(a => (a as { crdts?: string | null }).crdts).filter((c): c is string => Boolean(c));
      let adherence: Array<{ id: number; agentCode: string; date: string; type: string; source: "exception" | "violation" }> = [];
      if (agentCodesList.length > 0) {
        const { attendanceExceptions, agentViolations } = await import("../drizzle/schema");
        const { like, or } = await import("drizzle-orm");
        const [exc, viol] = await Promise.all([
          db.select().from(attendanceExceptions).where(and(inArray(attendanceExceptions.traineeCode, agentCodesList), like(attendanceExceptions.date, `${month}-%`))),
          db.select().from(agentViolations).where(and(
            eq(agentViolations.category, "attendance"),
            like(agentViolations.date, `${month}-%`),
            crdtsList.length ? or(inArray(agentViolations.agentCode, agentCodesList), inArray(agentViolations.crdts, crdtsList)) : inArray(agentViolations.agentCode, agentCodesList),
          )),
        ]);
        const crdtsToCode = new Map(allAgents.map(a => [(a as { crdts?: string | null }).crdts ?? "", a.traineeCode]));
        adherence = [
          ...exc.map(e => ({ id: e.id, agentCode: e.traineeCode, date: e.date, type: e.exceptionType, source: "exception" as const })),
          ...viol.map(v => ({ id: v.id, agentCode: crdtsToCode.get(v.crdts ?? "") ?? v.agentCode, date: v.date, type: /late|tardi/i.test(v.type) ? "late" : /early/i.test(v.type) ? "early_departure" : v.type, source: "violation" as const })),
        ];
      }
      void adherenceLog;

      // Monthly attrition = separations whose last working day falls in the month ÷ headcount at the start of
      // the month (active then = active now + those who left during the month).
      let separationsThisMonth = 0;
      if (agentCodesList.length > 0) {
        const { agentSeparations } = await import("../drizzle/schema");
        const { like, or, isNull, gte, lt } = await import("drizzle-orm");
        // Cairo month bounds — same clock as getTurnoverRate, so the two
        // attrition numbers bucket a midnight-boundary separation identically.
        const [y, m] = month.split("-").map(Number);
        const nextKey = m === 12 ? `${y! + 1}-01` : `${y}-${String(m! + 1).padStart(2, "0")}`;
        const monthStartMs = bdb(`${month}-01`).start;
        const monthEndMs = bdb(`${nextKey}-01`).start;
        const seps = await db.select({ agentCode: agentSeparations.agentCode }).from(agentSeparations)
          .where(and(inArray(agentSeparations.agentCode, agentCodesList),
            or(like(agentSeparations.lastWorkingDay, `${month}-%`), and(isNull(agentSeparations.lastWorkingDay), gte(agentSeparations.effectiveAt, monthStartMs), lt(agentSeparations.effectiveAt, monthEndMs)))));
        separationsThisMonth = new Set(seps.map(x => x.agentCode)).size;
      }
      const activeNow = activeAgents.filter(a => a.agentStatus === "active").length;
      const monthlyAttritionPct = activeNow + separationsThisMonth > 0 ? Math.round((separationsThisMonth / (activeNow + separationsThisMonth)) * 1000) / 10 : 0;

      return {
        client,
        campaigns: clientCampaigns,
        activeAgents,
        allAgents,
        payroll: payrollWithTotals.length ? payrollWithTotals : payroll,
        adherence,
        month,
        separationsThisMonth,
        monthlyAttritionPct,
      };
    }),
});

// ─── Salary Advances (سلفة) ───────────────────────────────────────────────────
const advancesRouter = router({
  /** HR: list all advances (optional filter by traineeCode). */
  list: roleProcedure("hr", "finance", "manager")
    .input(z.object({ traineeCode: z.string().optional() }))
    .query(async ({ input }) => {
      const { listAdvances } = await import("./db");
      return listAdvances(input.traineeCode);
    }),

  /** Agent portal: list own advances (reads agent JWT cookie). */
  listMine: agentProcedure
    .query(async ({ ctx }) => {
      const traineeCode = ctx.agent.traineeCode;
      const { listAdvances } = await import("./db");
      return listAdvances(traineeCode);
    }),

  /** HR: create a new salary advance. */
  create: roleProcedure("hr", "finance", "manager")
    .input(z.object({
      traineeCode: z.string().min(1),
      amountEgp:   z.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a valid amount"),
      issuedDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
      reason:      z.string().max(500).nullable().optional(),
      deductCycle: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional(),
      notes:       z.string().max(2000).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { createAdvance } = await import("./db");
      await createAdvance({ ...input, createdBy: ctx.user?.name ?? ctx.user?.email ?? "unknown" });
      await auditEntry(ctx.user, "advance_create", "agent", input.traineeCode, JSON.stringify({ amountEgp: input.amountEgp, issuedDate: input.issuedDate }));
      return { ok: true } as const;
    }),

  /** HR: mark an advance as deducted — creates the payroll deduction for that cycle in the same transaction. */
  deduct: roleProcedure("hr", "finance", "manager")
    .input(z.object({
      id:          z.number().int().positive(),
      deductCycle: z.string().regex(/^\d{4}-\d{2}$/),
    }))
    .mutation(async ({ ctx, input }) => {
      const { deductAdvance } = await import("./db");
      try {
        await deductAdvance(input.id, input.deductCycle, ctx.user?.name ?? ctx.user?.email ?? "unknown");
      } catch (e) {
        const err = e as { code?: string; message?: string };
        throw new TRPCError({ code: err.code === "CONFLICT" ? "CONFLICT" : err.code === "NOT_FOUND" ? "NOT_FOUND" : "INTERNAL_SERVER_ERROR", message: err.message ?? "Failed" });
      }
      await auditEntry(ctx.user, "advance_deduct", "advance", String(input.id), JSON.stringify({ deductCycle: input.deductCycle }));
      return { ok: true } as const;
    }),

  /** HR: cancel / write off a pending advance. */
  cancel: roleProcedure("hr", "finance", "manager")
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const { cancelAdvance } = await import("./db");
      try {
        await cancelAdvance(input.id);
      } catch (e) {
        throw new TRPCError({ code: "CONFLICT", message: (e as Error).message });
      }
      await auditEntry(ctx.user, "advance_cancel", "advance", String(input.id), "{}");
      return { ok: true } as const;
    }),
});

// ─── Contracts ────────────────────────────────────────────────────────────────
const contractsRouter = router({
  /** Create or update a contract for an agent. */
  upsert: roleProcedure("hr", "manager")
    .input(z.object({
      traineeCode:        z.string().min(1),
      contractType:       z.enum(["permanent", "fixed_term", "freelance"]),
      startDate:          z.string().nullable().optional(),
      endDate:            z.string().nullable().optional(),
      probationEndDate:   z.string().nullable().optional(),
      isMedicallyInsured: z.boolean(),
      isSociallyInsured:  z.boolean(),
      notes:              z.string().max(2000).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { upsertAgentContract, getWorkforceAgentByCode: getWa } = await import("./db");
      // Validation the table never had: the agent must exist, dates must be ordered,
      // and a fixed-term contract needs an end date.
      if (!(await getWa(input.traineeCode))) throw new TRPCError({ code: "NOT_FOUND", message: `No agent with code ${input.traineeCode}` });
      for (const [label, v] of [["Start date", input.startDate], ["End date", input.endDate], ["Probation end", input.probationEndDate]] as const) {
        if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new TRPCError({ code: "BAD_REQUEST", message: `${label} must be YYYY-MM-DD` });
      }
      if (input.startDate && input.endDate && input.endDate < input.startDate) throw new TRPCError({ code: "BAD_REQUEST", message: "End date is before start date" });
      if (input.contractType === "fixed_term" && !input.endDate) throw new TRPCError({ code: "BAD_REQUEST", message: "A fixed-term contract needs an end date" });
      const actorName = ctx.user?.name ?? ctx.user?.email ?? "unknown";
      await upsertAgentContract({ ...input, actorName });
      await auditEntry(ctx.user, "contract_upsert", "agent", input.traineeCode, JSON.stringify({ contractType: input.contractType }));
      return { ok: true } as const;
    }),

  /** Get contract for a specific agent (by traineeCode). */
  getByCode: staffProcedure
    .input(z.object({ traineeCode: z.string() }))
    .query(async ({ input }) => {
      const { getContractByCode } = await import("./db");
      return getContractByCode(input.traineeCode);
    }),

  /** List all contracts with agent info joined. */
  listAll: staffProcedure
    .query(async () => {
      const { listAllContracts } = await import("./db");
      return listAllContracts();
    }),

  /** List active agents who have no contract yet. */
  listMissing: staffProcedure
    .query(async () => {
      const { listAgentsWithoutContracts } = await import("./db");
      return listAgentsWithoutContracts();
    }),

  /** Agent portal: get own contract (reads agent JWT cookie). */
  getMine: agentProcedure
    .query(async ({ ctx }) => {
      const traineeCode = ctx.agent.traineeCode;
      const { getContractByCode } = await import("./db");
      return getContractByCode(traineeCode);
    }),
});

// ─── Time Tracking Router ──────────────────────────────────────────────────────
// Clock-in/out, AUX, PTO and attendance exceptions for clients with the
// `timeTrackingEnabled` flag. Identity ALWAYS comes from ctx.agent (session), the
// feature gate is enforced on every agent write, and "today" is the business
// (Cairo) calendar day — see server/_core/time.ts.

/** Safety net: an AUX row left open this long is auto-closed (an agent forgot to end a break). */
const AUX_MAX_OPEN_MS = 12 * 60 * 60 * 1000;
/** Shifts are NEVER auto-closed — an agent who leaves the portal open stays clocked in until they
 *  (or an admin) clock out. Supervisors see long-open shifts in Time Tracking → Open shifts. */

async function assertTimeTrackingAccess(traineeCode: string) {
  const { getAgentTimeTrackingAccess } = await import("./db");
  const access = await getAgentTimeTrackingAccess(traineeCode);
  if (!access.allowed) throw new TRPCError({ code: "FORBIDDEN", message: "Time tracking is not enabled for your client." });
  return access;
}

/** Auto-close only AUX rows left open past the safety cap. Shifts are left alone (see above). */
async function closeStaleOpenRows(traineeCode: string) {
  const { getDb } = await import("./db");
  const db = await getDb();
  if (!db) return;
  const { agentAuxLogs } = await import("../drizzle/schema");
  const { eq, and, isNull, lt, sql } = await import("drizzle-orm");
  const now = Date.now();
  await db.update(agentAuxLogs)
    .set({ endTime: sql`${agentAuxLogs.startTime} + ${AUX_MAX_OPEN_MS}`, durationMs: AUX_MAX_OPEN_MS, note: sql`CONCAT(COALESCE(${agentAuxLogs.note}, ''), ' [auto-closed]')` })
    .where(and(eq(agentAuxLogs.traineeCode, traineeCode), isNull(agentAuxLogs.endTime), lt(agentAuxLogs.startTime, now - AUX_MAX_OPEN_MS)));
}

/** Set the agent_presence status to mirror the current AUX state. */
async function syncPresenceFromState(traineeCode: string, auxType: string | null) {
  const { getDb } = await import("./db");
  const db = await getDb();
  if (!db) return;
  const { agentPresence } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const status = !auxType ? "available" : (auxType === "break" || auxType === "lunch" || auxType === "bathroom") ? "on_break" : "away";
  await db.update(agentPresence).set({ status, lastSeen: Date.now() }).where(eq(agentPresence.traineeCode, traineeCode));
}

// Time-tracking data is operational: HR / managers / ops / team leads read it; finance and BD do not.
const opsReadProcedure = roleProcedure("hr", "manager", "ops_manager", "team_lead");
// Mutating shifts / AUX is reserved for HR, managers and ops managers (team leads read only).
const opsWriteProcedure = roleProcedure("hr", "manager", "ops_manager");
const timeTrackingRouter = router({
  /** Whether the current agent's client has time tracking enabled. */
  checkAccess: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.agent) return { allowed: false, clientName: null as string | null, clientId: null as number | null, positionBased: false };
    const { getAgentTimeTrackingAccess } = await import("./db");
    return getAgentTimeTrackingAccess(ctx.agent.traineeCode);
  }),

  startAux: agentProcedure
    .input(z.object({ auxType: z.enum(AUX_TYPES), note: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const traineeCode = ctx.agent.traineeCode;
      await assertTimeTrackingAccess(traineeCode);
      await closeStaleOpenRows(traineeCode);
      const { agentAuxLogs, agentShifts } = await import("../drizzle/schema");
      const { getDb } = await import("./db");
      const { eq, and, isNull } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      // Must be clocked in.
      const [shift] = await db.select({ id: agentShifts.id }).from(agentShifts)
        .where(and(eq(agentShifts.traineeCode, traineeCode), isNull(agentShifts.clockOut))).limit(1);
      if (!shift) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Clock in before starting AUX." });
      // Exactly one open AUX at a time — a double-click or second tab must not create a second row.
      const [open] = await db.select({ id: agentAuxLogs.id, auxType: agentAuxLogs.auxType }).from(agentAuxLogs)
        .where(and(eq(agentAuxLogs.traineeCode, traineeCode), isNull(agentAuxLogs.endTime))).limit(1);
      if (open) throw new TRPCError({ code: "CONFLICT", message: `You are already in ${open.auxType}. End it first.` });
      const now = Date.now();
      const [row] = await db.insert(agentAuxLogs).values({ traineeCode, auxType: input.auxType, startTime: now, note: input.note ?? null, createdAt: now }).$returningId();
      await syncPresenceFromState(traineeCode, input.auxType);
      return { ok: true, id: row?.id ?? null };
    }),

  /**
   * ONE call to change state while clocked in: "available" ends any open AUX; any AUX type ends the
   * current AUX (if different) and starts the new one. This is what the unified My Shift card uses.
   */
  setState: agentProcedure
    .input(z.object({ state: z.enum(["available", ...AUX_TYPES]) }))
    .mutation(async ({ ctx, input }) => {
      const traineeCode = ctx.agent.traineeCode;
      await assertTimeTrackingAccess(traineeCode);
      await closeStaleOpenRows(traineeCode);
      const { agentAuxLogs, agentShifts } = await import("../drizzle/schema");
      const { getDb } = await import("./db");
      const { eq, and, isNull, desc } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [shift] = await db.select({ id: agentShifts.id }).from(agentShifts)
        .where(and(eq(agentShifts.traineeCode, traineeCode), isNull(agentShifts.clockOut))).limit(1);
      if (!shift) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Clock in first." });
      const now = Date.now();
      // Transaction + row lock: two quick taps must never leave two open AUX rows.
      const changed = await db.transaction(async (tx) => {
        const open = await tx.select().from(agentAuxLogs)
          .where(and(eq(agentAuxLogs.traineeCode, traineeCode), isNull(agentAuxLogs.endTime))).orderBy(desc(agentAuxLogs.startTime)).for("update");
        const current = open[0];
        if (current && current.auxType === input.state && open.length === 1) return false;
        for (const row of open) {
          await tx.update(agentAuxLogs).set({ endTime: now, durationMs: Math.max(0, Math.min(now - row.startTime, AUX_MAX_OPEN_MS)) }).where(eq(agentAuxLogs.id, row.id));
        }
        if (input.state !== "available") {
          await tx.insert(agentAuxLogs).values({ traineeCode, auxType: input.state, startTime: now, createdAt: now });
        }
        return true;
      });
      await syncPresenceFromState(traineeCode, input.state === "available" ? null : input.state);
      return { ok: true, state: input.state, changed };
    }),

  endAux: agentProcedure
    .input(z.object({ id: z.number().int().positive().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const traineeCode = ctx.agent.traineeCode;
      const { agentAuxLogs } = await import("../drizzle/schema");
      const { getDb } = await import("./db");
      const { eq, and, isNull, desc } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      // Close the row the client named, else the NEWEST open row (never the oldest).
      const where = input?.id
        ? and(eq(agentAuxLogs.id, input.id), eq(agentAuxLogs.traineeCode, traineeCode), isNull(agentAuxLogs.endTime))
        : and(eq(agentAuxLogs.traineeCode, traineeCode), isNull(agentAuxLogs.endTime));
      const [active] = await db.select().from(agentAuxLogs).where(where).orderBy(desc(agentAuxLogs.startTime)).limit(1);
      if (!active) return { ok: true, durationMs: 0 };
      const endTime = Date.now();
      const durationMs = Math.max(0, Math.min(endTime - active.startTime, AUX_MAX_OPEN_MS));
      await db.update(agentAuxLogs).set({ endTime, durationMs }).where(and(eq(agentAuxLogs.id, active.id), isNull(agentAuxLogs.endTime)));
      await syncPresenceFromState(traineeCode, null);
      return { ok: true, durationMs };
    }),

  /** Today's AUX rows (business-day window). `date` lets the client pass its own local day. */
  myAuxLogs: agentProcedure
    .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const { agentAuxLogs } = await import("../drizzle/schema");
      const { getDb } = await import("./db");
      const { eq, and, gte, lt, or, isNull } = await import("drizzle-orm");
      const { ttDateKey, ttDayBounds } = await import("./_core/time");
      const db = await getDb();
      if (!db) return [];
      // The agent's browser is in Cairo; the time-tracking day is US Eastern → ignore the client's date.
      void input;
      const { start, end } = ttDayBounds(ttDateKey());
      // Include any still-open row even if it started yesterday (overnight shifts).
      return db.select().from(agentAuxLogs)
        .where(and(eq(agentAuxLogs.traineeCode, ctx.agent.traineeCode),
          or(and(gte(agentAuxLogs.startTime, start), lt(agentAuxLogs.startTime, end)), isNull(agentAuxLogs.endTime))))
        .orderBy(agentAuxLogs.startTime);
    }),

  /** Full AUX history for this agent. */
  myAuxLogsAll: agentProcedure.query(async ({ ctx }) => {
    const { agentAuxLogs } = await import("../drizzle/schema");
    const { getDb } = await import("./db");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return [];
    return db.select().from(agentAuxLogs).where(eq(agentAuxLogs.traineeCode, ctx.agent.traineeCode)).orderBy(agentAuxLogs.startTime);
  }),

  myPtoRequests: agentProcedure.query(async ({ ctx }) => {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return [];
    const { leaveRequests } = await import("../drizzle/schema");
    const { eq, desc } = await import("drizzle-orm");
    const rows = await db.select().from(leaveRequests).where(eq(leaveRequests.traineeCode, ctx.agent.traineeCode)).orderBy(desc(leaveRequests.createdAt));
    // Shape compatible with the old pto_requests rows the page renders.
    return rows.map(r => ({
      id: r.id, traineeCode: r.traineeCode, agentName: r.requesterName,
      requestType: r.leaveType ?? (r.reason?.match(/^\[(\w+)/)?.[1] ?? "leave"),
      startDate: r.startDate, endDate: r.endDate,
      status: r.status, reason: r.reason, reviewedBy: r.decidedBy, reviewedAt: r.decidedAt, createdAt: r.createdAt,
    }));
  }),

  /** PTO LOG for time-tracking clients: decided (approved / rejected) leave. Pending requests live in the Request Center. */
  allPtoRequests: opsReadProcedure
    .input(z.object({ status: z.enum(["pending", "approved", "rejected", "all", "decided"]).optional() }))
    .query(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) return [];
      const { leaveRequests, workforceAgents, campaigns, clients } = await import("../drizzle/schema");
      const { eq, desc, and, inArray, or, isNull } = await import("drizzle-orm");
      // Only agents of time-tracking clients
      const codesRows = await db.select({ code: workforceAgents.traineeCode }).from(workforceAgents)
        .innerJoin(campaigns, eq(campaigns.id, workforceAgents.campaignId))
        .innerJoin(clients, eq(clients.id, campaigns.clientId))
        .where(and(eq(clients.timeTrackingEnabled, true), or(isNull(workforceAgents.isDemo), eq(workforceAgents.isDemo, false))));
      const codes = codesRows.map(r => r.code);
      if (!codes.length) return [];
      const statusCond = !input.status || input.status === "decided"
        ? inArray(leaveRequests.status, ["approved", "rejected"])
        : input.status === "all" ? undefined : eq(leaveRequests.status, input.status);
      const rows = await db.select().from(leaveRequests)
        .where(statusCond ? and(inArray(leaveRequests.traineeCode, codes), statusCond) : inArray(leaveRequests.traineeCode, codes))
        .orderBy(desc(leaveRequests.createdAt));
      return rows.map(r => ({
        id: r.id, traineeCode: r.traineeCode, agentName: r.requesterName,
        requestType: r.leaveType ?? (r.reason?.match(/^\[(\w+)/)?.[1] ?? "leave"),
        startDate: r.startDate, endDate: r.endDate,
        status: r.status, reason: r.reason, reviewedBy: r.decidedBy, reviewedAt: r.decidedAt, createdAt: r.createdAt,
        days: r.days, leaveType: r.leaveType,
      }));
    }),

  allExceptions: opsReadProcedure
    .input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional(), status: z.enum(["pending", "reviewed"]).optional() }))
    .query(async ({ input }) => {
      const { attendanceExceptions } = await import("../drizzle/schema");
      const { getDb } = await import("./db");
      const { and, like, eq, or, isNull } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return [];
      const conds = [];
      if (input.month) conds.push(like(attendanceExceptions.date, `${input.month}-%`));
      if (input.status) conds.push(eq(attendanceExceptions.status, input.status));
      const q = db.select().from(attendanceExceptions);
      const all = conds.length ? await q.where(and(...conds)).orderBy(attendanceExceptions.date) : await q.orderBy(attendanceExceptions.date);
      // Only agents of time-tracking clients
      const { workforceAgents, campaigns, clients } = await import("../drizzle/schema");
      const codesRows = await db.select({ code: workforceAgents.traineeCode }).from(workforceAgents)
        .innerJoin(campaigns, eq(campaigns.id, workforceAgents.campaignId))
        .innerJoin(clients, eq(clients.id, campaigns.clientId))
        .where(and(eq(clients.timeTrackingEnabled, true), or(isNull(workforceAgents.isDemo), eq(workforceAgents.isDemo, false))));
      const codes = new Set(codesRows.map(r => r.code));
      return all.filter(e => codes.has(e.traineeCode));
    }),

  /** Staff marks an exception as reviewed (closes the loop that was never closed). */
  reviewException: roleProcedure("hr", "manager", "ops_manager", "team_lead")
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const { attendanceExceptions } = await import("../drizzle/schema");
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.update(attendanceExceptions).set({ status: "reviewed", reviewedBy: ctx.user.name ?? ctx.user.email ?? "staff" }).where(eq(attendanceExceptions.id, input.id));
      return { ok: true };
    }),

  /** Admin: delete an AUX entry (test rows, mis-clicks). Audited. */
  deleteAux: opsWriteProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const { agentAuxLogs } = await import("../drizzle/schema");
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [row] = await db.select().from(agentAuxLogs).where(eq(agentAuxLogs.id, input.id)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "AUX entry not found" });
      await db.delete(agentAuxLogs).where(eq(agentAuxLogs.id, input.id));
      if (!row.endTime) await syncPresenceFromState(row.traineeCode, null);
      await auditEntry(ctx.user, "delete_aux", "agent_aux_log", String(input.id), JSON.stringify({ traineeCode: row.traineeCode, auxType: row.auxType, startTime: row.startTime, endTime: row.endTime }));
      return { ok: true };
    }),

  /** Admin: adjust an AUX entry (type / start / end). Audited. */
  updateAux: opsWriteProcedure
    .input(z.object({ id: z.number().int().positive(), auxType: z.enum(AUX_TYPES).optional(), startTime: z.number().optional(), endTime: z.number().nullable().optional(), note: z.string().max(500).nullable().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { agentAuxLogs } = await import("../drizzle/schema");
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [row] = await db.select().from(agentAuxLogs).where(eq(agentAuxLogs.id, input.id)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "AUX entry not found" });
      const startTime = input.startTime ?? row.startTime;
      const endTime = input.endTime === undefined ? row.endTime : input.endTime;
      if (endTime != null && endTime <= startTime) throw new TRPCError({ code: "BAD_REQUEST", message: "End must be after start" });
      // A closed AUX can never be re-opened from here: an open row (endTime NULL) drives the agent's live state.
      if (endTime == null && row.endTime != null) throw new TRPCError({ code: "BAD_REQUEST", message: "Enter an end time — a closed AUX cannot be re-opened" });
      await db.update(agentAuxLogs).set({
        auxType: input.auxType ?? row.auxType,
        startTime, endTime,
        durationMs: endTime != null ? endTime - startTime : null,
        note: input.note === undefined ? row.note : input.note,
      }).where(eq(agentAuxLogs.id, input.id));
      await auditEntry(ctx.user, "update_aux", "agent_aux_log", String(input.id), JSON.stringify({ before: row, after: input }));
      return { ok: true };
    }),

  /** Admin: delete a shift (test rows). Audited. */
  deleteShift: opsWriteProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const { agentShifts } = await import("../drizzle/schema");
      const { getDb } = await import("./db");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [row] = await db.select().from(agentShifts).where(eq(agentShifts.id, input.id)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Shift not found" });
      await db.delete(agentShifts).where(eq(agentShifts.id, input.id));
      if (!row.clockOut) {
        // Deleting an OPEN shift must not strand the agent inside an AUX (setState would then refuse "Clock in first").
        const { agentAuxLogs } = await import("../drizzle/schema");
        const { and, isNull } = await import("drizzle-orm");
        const now = Date.now();
        const open = await db.select().from(agentAuxLogs).where(and(eq(agentAuxLogs.traineeCode, row.traineeCode), isNull(agentAuxLogs.endTime)));
        for (const a of open) await db.update(agentAuxLogs).set({ endTime: now, durationMs: Math.max(0, now - a.startTime) }).where(eq(agentAuxLogs.id, a.id));
        await syncPresenceFromState(row.traineeCode, null);
      }
      await auditEntry(ctx.user, "delete_shift", "agent_shift", String(input.id), JSON.stringify(row));
      return { ok: true };
    }),

  /** Admin: everyone currently clocked in (and for how long), with their current AUX state. */
  openShifts: opsReadProcedure.query(async () => {
    const { agentShifts, agentAuxLogs, workforceAgents } = await import("../drizzle/schema");
    const { getDb } = await import("./db");
    const { eq, isNull, inArray, and, or } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return [];
    const shifts = await db.select({ id: agentShifts.id, traineeCode: agentShifts.traineeCode, clockIn: agentShifts.clockIn, date: agentShifts.date, fullName: workforceAgents.fullName, jobTitle: workforceAgents.jobTitle })
      .from(agentShifts).leftJoin(workforceAgents, eq(workforceAgents.traineeCode, agentShifts.traineeCode))
      .where(and(isNull(agentShifts.clockOut), or(isNull(workforceAgents.isDemo), eq(workforceAgents.isDemo, false)))).orderBy(agentShifts.clockIn);
    if (!shifts.length) return [];
    const codes = shifts.map(s => s.traineeCode);
    const openAux = await db.select().from(agentAuxLogs).where(and(inArray(agentAuxLogs.traineeCode, codes), isNull(agentAuxLogs.endTime)));
    const auxBy = new Map(openAux.map(a => [a.traineeCode, a]));
    return shifts.map(s => ({ ...s, state: auxBy.get(s.traineeCode)?.auxType ?? "available", auxSince: auxBy.get(s.traineeCode)?.startTime ?? null }));
  }),

  /** Admin: clock an agent out (forgot to clock out). Ends any open AUX too. Audited. */
  adminClockOut: opsWriteProcedure
    .input(z.object({ shiftId: z.number().int().positive(), at: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { agentShifts, agentAuxLogs } = await import("../drizzle/schema");
      const { getDb } = await import("./db");
      const { eq, and, isNull } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [shift] = await db.select().from(agentShifts).where(and(eq(agentShifts.id, input.shiftId), isNull(agentShifts.clockOut))).limit(1);
      if (!shift) throw new TRPCError({ code: "NOT_FOUND", message: "No open shift with that id" });
      const at = Math.max(shift.clockIn, Math.min(input.at ?? Date.now(), Date.now()));
      const open = await db.select().from(agentAuxLogs).where(and(eq(agentAuxLogs.traineeCode, shift.traineeCode), isNull(agentAuxLogs.endTime)));
      for (const a of open) await db.update(agentAuxLogs).set({ endTime: at, durationMs: Math.max(0, at - a.startTime) }).where(eq(agentAuxLogs.id, a.id));
      await db.update(agentShifts).set({ clockOut: at, durationMs: Math.max(0, at - shift.clockIn) }).where(eq(agentShifts.id, shift.id));
      await syncPresenceFromState(shift.traineeCode, null);
      await auditEntry(ctx.user, "admin_clock_out", "agent_shift", String(shift.id), JSON.stringify({ traineeCode: shift.traineeCode, at }));
      return { ok: true };
    }),

  /** Admin AUX log. The date filter applies with OR without a traineeCode; a date is required when no agent is named. */
  auxLogs: opsReadProcedure
    .input(z.object({
      traineeCode: z.string().optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      /** Optional range (inclusive) — used by the export; overrides `date`. */
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }).refine(i => (!!i.from === !!i.to) && (!i.from || !i.to || i.from <= i.to), { message: "from/to must both be set and from <= to" }))
    .query(async ({ input }) => {
      const { agentAuxLogs, workforceAgents, campaigns, clients } = await import("../drizzle/schema");
      const { getDb } = await import("./db");
      const { eq, and, gte, lt, or, isNull } = await import("drizzle-orm");
      const { ttDateKey, ttDayBounds } = await import("./_core/time");
      const db = await getDb();
      if (!db) return [];
      const conds = [];
      if (input.traineeCode) conds.push(eq(agentAuxLogs.traineeCode, input.traineeCode));
      // Days are US-Eastern calendar days (Quantum works US hours) so an overnight shift's AUX stays on one day.
      if (input.from && input.to) {
        conds.push(gte(agentAuxLogs.startTime, ttDayBounds(input.from).start), lt(agentAuxLogs.startTime, ttDayBounds(input.to).end));
      } else {
        const date = input.date ?? (input.traineeCode ? null : ttDateKey());
        if (date) { const { start, end } = ttDayBounds(date); conds.push(gte(agentAuxLogs.startTime, start), lt(agentAuxLogs.startTime, end)); }
      }
      return db.select({
        id: agentAuxLogs.id, traineeCode: agentAuxLogs.traineeCode, auxType: agentAuxLogs.auxType,
        startTime: agentAuxLogs.startTime, endTime: agentAuxLogs.endTime, durationMs: agentAuxLogs.durationMs, note: agentAuxLogs.note,
        fullName: workforceAgents.fullName, jobTitle: workforceAgents.jobTitle, clientName: clients.name,
      }).from(agentAuxLogs)
        .leftJoin(workforceAgents, eq(workforceAgents.traineeCode, agentAuxLogs.traineeCode))
        .leftJoin(campaigns, eq(campaigns.id, workforceAgents.campaignId))
        .leftJoin(clients, eq(clients.id, campaigns.clientId))
        // AUX is a time-tracking (Quantum) feature: only agents of time-tracking clients, never demo rows.
        // Rows whose agent no longer exists are kept (left join) so nothing is silently hidden from the admin.
        .where(and(...conds,
          or(isNull(workforceAgents.traineeCode), eq(clients.timeTrackingEnabled, true)),
          or(isNull(workforceAgents.isDemo), eq(workforceAgents.isDemo, false))))
        .orderBy(agentAuxLogs.startTime)
        .limit(20000);
    }),

  // ─── Clock In / Clock Out ────────────────────────────────────────────────────
  clockIn: agentProcedure.mutation(async ({ ctx }) => {
    const traineeCode = ctx.agent.traineeCode;
    await assertTimeTrackingAccess(traineeCode);
    await closeStaleOpenRows(traineeCode);
    const { agentShifts } = await import("../drizzle/schema");
    const { getDb } = await import("./db");
    const { eq, and, isNull } = await import("drizzle-orm");
    const { ttDateKey } = await import("./_core/time");
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    // Race-proof double clock-in: serialize per agent by locking their
    // workforce row (TiDB pessimistic FOR UPDATE) around the check + insert.
    const { sql: sqlLock } = await import("drizzle-orm");
    const now = Date.now();
    const shiftId = await db.transaction(async (tx) => {
      await tx.execute(sqlLock`SELECT id FROM workforce_agents WHERE traineeCode = ${traineeCode} FOR UPDATE`);
      const [open] = await tx.select({ id: agentShifts.id }).from(agentShifts)
        .where(and(eq(agentShifts.traineeCode, traineeCode), isNull(agentShifts.clockOut))).limit(1);
      if (open) throw new TRPCError({ code: "CONFLICT", message: "Already clocked in" });
      const [inserted] = await tx.insert(agentShifts).values({ traineeCode, clockIn: now, date: ttDateKey(now), createdAt: now }).$returningId();
      return inserted?.id ?? null;
    });
    await syncPresenceFromState(traineeCode, null);
    return { ok: true, shiftId };
  }),

  clockOut: agentProcedure.mutation(async ({ ctx }) => {
    const traineeCode = ctx.agent.traineeCode;
    const { agentShifts, agentAuxLogs } = await import("../drizzle/schema");
    const { getDb } = await import("./db");
    const { eq, and, isNull, desc } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const [active] = await db.select().from(agentShifts)
      .where(and(eq(agentShifts.traineeCode, traineeCode), isNull(agentShifts.clockOut)))
      .orderBy(desc(agentShifts.clockIn)).limit(1);
    if (!active) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Not clocked in" });
    const clockOut = Date.now();
    // Clocking out also ends any open AUX so nothing dangles overnight.
    const [openAux] = await db.select().from(agentAuxLogs)
      .where(and(eq(agentAuxLogs.traineeCode, traineeCode), isNull(agentAuxLogs.endTime))).orderBy(desc(agentAuxLogs.startTime)).limit(1);
    if (openAux) await db.update(agentAuxLogs).set({ endTime: clockOut, durationMs: Math.max(0, clockOut - openAux.startTime) }).where(eq(agentAuxLogs.id, openAux.id));
    const durationMs = Math.max(0, clockOut - active.clockIn);
    await db.update(agentShifts).set({ clockOut, durationMs }).where(eq(agentShifts.id, active.id));
    await syncPresenceFromState(traineeCode, null);
    return { ok: true, durationMs };
  }),

  /** The agent's open shift, else today's most recent shift, else null. */
  myShiftToday: agentProcedure
    .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const traineeCode = ctx.agent.traineeCode;
      await closeStaleOpenRows(traineeCode);
      const { agentShifts } = await import("../drizzle/schema");
      const { getDb } = await import("./db");
      const { eq, and, isNull, desc } = await import("drizzle-orm");
      const { ttDateKey } = await import("./_core/time");
      const db = await getDb();
      if (!db) return null;
      void input; // time-tracking day is US Eastern, not the agent's browser day
      const [open] = await db.select().from(agentShifts)
        .where(and(eq(agentShifts.traineeCode, traineeCode), isNull(agentShifts.clockOut))).orderBy(desc(agentShifts.clockIn)).limit(1);
      if (open) return open;
      const [shift] = await db.select().from(agentShifts)
        .where(and(eq(agentShifts.traineeCode, traineeCode), eq(agentShifts.date, ttDateKey())))
        .orderBy(desc(agentShifts.clockIn)).limit(1);
      return shift ?? null;
    }),

  /**
   * Admin summary of productive (worked) hours per agent for a date range.
   * Productive = shift time − all AUX time. Open records are capped at now.
   */
  workedSummary: opsReadProcedure
    .input(z.object({
      clientId: z.number().int().positive().optional(),
      traineeCode: z.string().optional(),
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }))
    .query(async ({ input }) => {
      const { agentShifts, agentAuxLogs, workforceAgents } = await import("../drizzle/schema");
      const { getDb, listWorkforceAgentsByClient } = await import("./db");
      const { eq, and, gte, lt, inArray, or, isNull } = await import("drizzle-orm");
      const { ttDayBounds, ttDateKey: ttDateKeyFn } = await import("./_core/time");
      const db = await getDb();
      if (!db) return [];

      // Range is in US-Eastern calendar days (Quantum works US hours).
      const fromMs = ttDayBounds(input.from).start;
      const toMs = ttDayBounds(input.to).end;

      type AgentRow = { traineeCode: string; fullName: string; shiftHours: string | null; offDay1: number | null; offDay2: number | null; jobTitle: string | null; joinDate: number | null; agentStatus: string | null; nestingStatus: string | null; campaignId: number | null };
      const cols = { traineeCode: workforceAgents.traineeCode, fullName: workforceAgents.fullName, shiftHours: workforceAgents.shiftHours, offDay1: workforceAgents.offDay1, offDay2: workforceAgents.offDay2, jobTitle: workforceAgents.jobTitle, joinDate: workforceAgents.joinDate, agentStatus: workforceAgents.agentStatus, nestingStatus: workforceAgents.nestingStatus, campaignId: workforceAgents.campaignId };
      const notDemo = or(isNull(workforceAgents.isDemo), eq(workforceAgents.isDemo, false));
      let agents: AgentRow[];
      if (input.traineeCode) {
        const [wa] = await db.select(cols).from(workforceAgents).where(eq(workforceAgents.traineeCode, input.traineeCode)).limit(1);
        agents = wa ? [wa] : [];
      } else if (input.clientId) {
        const rows = await listWorkforceAgentsByClient(input.clientId, true); // former agents too — the drop rules below decide
        agents = rows.map(r => ({ traineeCode: r.traineeCode, fullName: r.fullName, shiftHours: r.shiftHours ?? null, offDay1: r.offDay1 ?? null, offDay2: r.offDay2 ?? null, jobTitle: (r as { jobTitle?: string | null }).jobTitle ?? null, joinDate: r.joinDate ?? null, agentStatus: r.agentStatus ?? null, nestingStatus: (r as { nestingStatus?: string | null }).nestingStatus ?? null, campaignId: r.campaignId ?? null }));
      } else {
        // Time tracking is a per-client feature: the monthly report only ever covers agents of clients that
        // have it enabled (Quantum). Apello agents are never listed here.
        const { campaigns: campT, clients: clT } = await import("../drizzle/schema");
        const rows = await db.select(cols).from(workforceAgents)
          .innerJoin(campT, eq(campT.id, workforceAgents.campaignId))
          .innerJoin(clT, eq(clT.id, campT.clientId))
          .where(and(notDemo, eq(clT.timeTrackingEnabled, true)));
        agents = rows;
      }
      if (agents.length === 0) return [];
      const traineeCodes = agents.map(a => a.traineeCode);

      // Client name per campaign (for the "Quantum Client" column)
      const { campaigns, clients, leaveRequests, attendanceExceptions } = await import("../drizzle/schema");
      const campRows = await db.select({ id: campaigns.id, clientName: clients.name }).from(campaigns).leftJoin(clients, eq(campaigns.clientId, clients.id));
      const clientByCampaign = new Map(campRows.map(c => [c.id, c.clientName ?? null]));

      // Shifts in range own the hours. Shifts that started up to 20h BEFORE the range are fetched too, only so
      // their AUX can be attributed to them (and therefore excluded here) — they are never counted.
      const AUX_WINDOW_MS = 20 * 3600000;
      const shiftsWide = await db.select().from(agentShifts).where(and(inArray(agentShifts.traineeCode, traineeCodes), gte(agentShifts.clockIn, fromMs - AUX_WINDOW_MS), lt(agentShifts.clockIn, toMs)));
      const shifts = shiftsWide.filter(s => s.clockIn >= fromMs);
      const shiftsByCode = new Map<string, typeof shiftsWide>();
      for (const sh of shiftsWide) { const arr = shiftsByCode.get(sh.traineeCode) ?? []; arr.push(sh); shiftsByCode.set(sh.traineeCode, arr); }
      // AUX belongs to the SHIFT it falls inside: an overnight shift's late AUX counts against that shift's day,
      // not the next day. Fetch a wider window, keep rows inside one of the range's shifts, plus orphan rows
      // (no shift at all) that start inside the range.
      const auxRaw = await db.select().from(agentAuxLogs).where(and(inArray(agentAuxLogs.traineeCode, traineeCodes), gte(agentAuxLogs.startTime, fromMs), lt(agentAuxLogs.startTime, toMs + AUX_WINDOW_MS)));
      const nowForAttr = Date.now();
      // Exclusive ownership: an AUX belongs to the (single) shift it falls inside; it is counted here iff that
      // shift is in range. An orphan AUX (no shift) counts iff it starts inside the range. Never double-counted
      // across adjacent months.
      const auxLogs = auxRaw.filter(l => {
        const owner = (shiftsByCode.get(l.traineeCode) ?? []).find(s => l.startTime >= s.clockIn && l.startTime < (s.clockOut ?? Math.min(nowForAttr, s.clockIn + AUX_WINDOW_MS)));
        if (owner) return owner.clockIn >= fromMs && owner.clockIn < toMs;
        return l.startTime >= fromMs && l.startTime < toMs;
      });
      // Approved leave overlapping the range → PTO hours; reviewed/pending late-early exceptions → count
      const { lte: lteOp, like } = await import("drizzle-orm");
      const leaves = await db.select().from(leaveRequests).where(and(inArray(leaveRequests.traineeCode, traineeCodes), eq(leaveRequests.status, "approved"), lteOp(leaveRequests.startDate, input.to), gte(leaveRequests.endDate, input.from)));
      const excs = await db.select({ traineeCode: attendanceExceptions.traineeCode, date: attendanceExceptions.date }).from(attendanceExceptions).where(and(inArray(attendanceExceptions.traineeCode, traineeCodes), gte(attendanceExceptions.date, input.from), lteOp(attendanceExceptions.date, input.to)));
      // Last working day of former agents (resigned / terminated) so their scheduled hours stop there.
      const { agentSeparations } = await import("../drizzle/schema");
      const seps = await db.select({ agentCode: agentSeparations.agentCode, lastWorkingDay: agentSeparations.lastWorkingDay, effectiveAt: agentSeparations.effectiveAt }).from(agentSeparations).where(inArray(agentSeparations.agentCode, traineeCodes));
      const lastDayByCode = new Map<string, string>();
      for (const sp of seps) {
        const d = sp.lastWorkingDay ?? (sp.effectiveAt ? new Date(sp.effectiveAt).toISOString().slice(0, 10) : null);
        if (!d) continue;
        const prev = lastDayByCode.get(sp.agentCode);
        if (!prev || d > prev) lastDayByCode.set(sp.agentCode, d);
      }
      const FORMER = new Set(["resigned", "terminated", "blacklisted"]);

      const { shiftHoursPerDay } = await import("../shared/shiftHours");
      const parseDailyHours = (shiftHours: string | null): number => shiftHoursPerDay(shiftHours);
      function countWorkingDays(from: string, to: string, offDay1: number | null, offDay2: number | null): number {
        let count = 0;
        const cur = new Date(from + "T00:00:00Z"); const end = new Date(to + "T00:00:00Z");
        while (cur <= end) { const dow = cur.getUTCDay(); if (dow !== offDay1 && dow !== offDay2) count++; cur.setUTCDate(cur.getUTCDate() + 1); }
        return count;
      }

      /** Working days (excluding the agent's off days) of an approved leave that fall inside [from, to]. */
      function leaveDaysInRange(startDate: string, endDate: string, offDay1: number | null, offDay2: number | null): number {
        const from = startDate > input.from ? startDate : input.from;
        const to = endDate < input.to ? endDate : input.to;
        if (to < from) return 0;
        return countWorkingDays(from, to, offDay1, offDay2);
      }

      const now = Date.now();
      const rowsOut = agents.map(agent => {
        const myShifts = shifts.filter(s => s.traineeCode === agent.traineeCode);
        const myAux = auxLogs.filter(l => l.traineeCode === agent.traineeCode);
        // Scheduled window = report range clipped to [join date, last working day]. A mid-month joiner or
        // leaver is only scheduled for the days they were actually employed.
        const joinKey = agent.joinDate ? ttDateKeyFn(agent.joinDate) : null;
        const isFormer = FORMER.has(agent.agentStatus ?? "");
        const lastKey = isFormer ? (lastDayByCode.get(agent.traineeCode) ?? null) : null;
        const schedFrom = joinKey && joinKey > input.from ? joinKey : input.from;
        const schedTo = lastKey && lastKey < input.to ? lastKey : input.to;
        const schedDays = schedTo < schedFrom ? 0 : countWorkingDays(schedFrom, schedTo, agent.offDay1, agent.offDay2);
        const hadActivity = myShifts.length > 0 || myAux.length > 0;
        // Former agents with no scheduled days AND no activity in the range do not belong in this month's report.
        if (isFormer && schedDays === 0 && !hadActivity) return null;
        // A former agent whose last day is unknown and who has no activity this month: also drop (they left earlier).
        if (isFormer && !lastKey && !hadActivity) return null;
        const dailyHrsForPto = parseDailyHours(agent.shiftHours);
        const ptoDays = leaves.filter(l => l.traineeCode === agent.traineeCode).reduce((s, l) => s + leaveDaysInRange(l.startDate, l.endDate, agent.offDay1, agent.offDay2), 0);
        const ptoHrs = Math.round(ptoDays * dailyHrsForPto * 100) / 100;
        const lateEarly = excs.filter(e => e.traineeCode === agent.traineeCode).length;
        // Open (forgotten) shifts count at most one scheduled day, never days of phantom hours.
        const openCapMs = Math.max(1, dailyHrsForPto || 9) * 3600000;
        const shiftMs = myShifts.reduce((acc, s) => acc + (s.clockOut ? Math.max(0, s.clockOut - s.clockIn) : Math.min(Math.max(0, now - s.clockIn), openCapMs)), 0);
        const auxByType: Record<string, number> = {};
        for (const log of myAux) {
          // An abandoned open AUX never counts more than one scheduled day (same cap as an open shift).
          const durMs = log.durationMs ?? (log.endTime != null ? Math.max(0, log.endTime - log.startTime) : Math.min(Math.max(0, now - log.startTime), openCapMs));
          auxByType[log.auxType] = (auxByType[log.auxType] ?? 0) + durMs;
        }
        const totalAuxMs = Object.values(auxByType).reduce((a, b) => a + b, 0);
        const productiveMs = Math.max(0, shiftMs - totalAuxMs);
        const scheduledHrs = Math.round(parseDailyHours(agent.shiftHours) * schedDays * 100) / 100;
        const auxMinutes: Record<string, number> = {};
        for (const [type, ms] of Object.entries(auxByType)) auxMinutes[type] = Math.round((ms / 60000) * 100) / 100;
        const workedHrs = Math.round((productiveMs / 3600000) * 100) / 100;
        // Unplanned = scheduled time not covered by work or approved leave (never negative).
        const unplannedHrs = Math.max(0, Math.round((scheduledHrs - workedHrs - ptoHrs) * 100) / 100);
        const statusLabel = (() => {
          const base = agent.agentStatus ? agent.agentStatus.charAt(0).toUpperCase() + agent.agentStatus.slice(1) : "—";
          if (agent.agentStatus === "active" && agent.nestingStatus === "nesting") return "Active (training)";
          return base;
        })();
        return {
          traineeCode: agent.traineeCode, name: agent.fullName, scheduledHrs,
          workedHrs,
          shiftHrs: Math.round((shiftMs / 3600000) * 100) / 100,
          auxMinutes,
          // Roster / client-report columns
          clientName: agent.campaignId != null ? (clientByCampaign.get(agent.campaignId) ?? null) : null,
          role: agent.jobTitle ?? null,
          startDate: agent.joinDate ? new Date(agent.joinDate).toISOString().slice(0, 10) : null,
          ptoHrs,
          unplannedHrs,
          lateEarly,
          status: statusLabel,
          agentStatus: agent.agentStatus,
        };
      });
      return rowsOut.filter((r): r is NonNullable<typeof r> => r !== null);
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
  // overtimeRouter removed
  breakSchedule: breakScheduleRouter,
  separation: separationRouter,
  auditLog: router({
    list: adminProcedure
      .input(z.object({ limit: z.number().int().min(1).max(200).default(100), action: z.string().optional() }))
      .query(async ({ input }) => {
        const { getDb } = await import("./db");
        const { auditLog } = await import("../drizzle/schema");
        const { desc, eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) return [];
        if (input.action) return db.select().from(auditLog).where(eq(auditLog.action, input.action)).orderBy(desc(auditLog.createdAt)).limit(input.limit);
        return db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(input.limit);
      }),
  }),
  slack: router({
    sendReminders: staffProcedure
      .input(z.object({ type: z.enum(["incomplete_profile", "missing_payment_prefs"]) }))
      .mutation(async ({ ctx, input }) => {
        const { ENV } = await import("./_core/env");
        if (!ENV.slackBotToken) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Set SLACK_BOT_TOKEN in environment variables first." });
        const { getDb } = await import("./db");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { workforceAgents, slackPingLog, agentCredentials } = await import("../drizzle/schema");
        const FIVE_DAYS = 5 * 24 * 60 * 60 * 1000;
        const cutoff = Date.now() - FIVE_DAYS;

        const activeAgents = await db.select({
          traineeCode: workforceAgents.traineeCode, fullName: workforceAgents.fullName, email: workforceAgents.email,
          phone: workforceAgents.phone, nationalId: workforceAgents.nationalId, dateOfBirth: workforceAgents.dateOfBirth,
          gender: workforceAgents.gender, nationality: workforceAgents.nationality, emergencyContactName: workforceAgents.emergencyContactName,
        }).from(workforceAgents).where(eq(workforceAgents.agentStatus, "active"));

        const creds = await db.select({ traineeCode: agentCredentials.traineeCode, firstLoginAt: agentCredentials.firstLoginAt }).from(agentCredentials);
        const credMap = new Map(creds.map(c => [c.traineeCode, c.firstLoginAt ?? 0]));
        const recentPings = await db.select({ traineeCode: slackPingLog.traineeCode, sentAt: slackPingLog.sentAt, reason: slackPingLog.reason }).from(slackPingLog);
        const lastPing = new Map<string, number>();
        recentPings.filter(p => p.reason === input.type).forEach(p => {
          const existing = lastPing.get(p.traineeCode) ?? 0;
          if (p.sentAt > existing) lastPing.set(p.traineeCode, p.sentAt);
        });

        let targets: { traineeCode: string; fullName: string; email: string | null }[] = [];
        if (input.type === "incomplete_profile") {
          const REQUIRED = ["phone","email","nationalId","dateOfBirth","gender","nationality","emergencyContactName"] as const;
          targets = activeAgents
            .filter(a => (credMap.get(a.traineeCode) ?? 0) < cutoff)
            .filter(a => REQUIRED.some(f => !a[f as keyof typeof a]))
            .filter(a => (lastPing.get(a.traineeCode) ?? 0) < cutoff)
            .map(a => ({ traineeCode: a.traineeCode, fullName: a.fullName, email: a.email }));
        } else {
          // Only agents who have NOT saved any payment method get the nag.
          const { agentPaymentMethods } = await import("../drizzle/schema");
          const pmRows = await db.select({ traineeCode: agentPaymentMethods.traineeCode }).from(agentPaymentMethods);
          const withSet = new Set(pmRows.map(r => r.traineeCode));
          targets = activeAgents
            .filter(a => !withSet.has(a.traineeCode) && (credMap.get(a.traineeCode) ?? 0) < cutoff)
            .filter(a => (lastPing.get(a.traineeCode) ?? 0) < cutoff)
            .map(a => ({ traineeCode: a.traineeCode, fullName: a.fullName, email: a.email }));
        }

        if (targets.length === 0) return { ok: true, sent: 0, skipped: 0, targets: 0 };
        const msgText = input.type === "incomplete_profile"
          ? "👋 Hi! Your personal info on *Tanis Hub* is incomplete. Please log in and complete your profile — it helps HR and payroll run smoothly. Thank you! 🙏"
          : "👋 Hi! You haven't added your payment preferences on *Tanis Hub* yet. Please log in and add your wallet or bank details so your salary can be processed on time. Thank you! 🙏";

        let sent = 0; let skipped = 0;
        for (const t of targets) {
          try {
            let channelId: string | null = null;
            if (t.email) {
              const lu = await fetch(`https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(t.email)}`, { headers: { Authorization: `Bearer ${ENV.slackBotToken}` } });
              const luData = await lu.json() as { ok: boolean; user?: { id: string } };
              if (luData.ok && luData.user?.id) {
                const open = await fetch("https://slack.com/api/conversations.open", { method: "POST", headers: { Authorization: `Bearer ${ENV.slackBotToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ users: luData.user.id }) });
                const openData = await open.json() as { ok: boolean; channel?: { id: string } };
                if (openData.ok && openData.channel?.id) channelId = openData.channel.id;
              }
            }
            const targetChannel = channelId ?? ENV.slackChannelId;
            if (!targetChannel) { skipped++; continue; }
            const finalMsg = channelId ? msgText : `📌 *${t.fullName}* (${t.traineeCode}): ${msgText}`;
            const msg = await fetch("https://slack.com/api/chat.postMessage", { method: "POST", headers: { Authorization: `Bearer ${ENV.slackBotToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ channel: targetChannel, text: finalMsg }) });
            const msgData = await msg.json() as { ok: boolean; error?: string; ts?: string };
            if (!msgData.ok) {
              // A failed send must NOT be logged as sent — that started a 5-day
              // suppression window for a message nobody ever received.
              console.warn("[slack] reminder send failed for", t.traineeCode, msgData.error);
              skipped++;
              continue;
            }
            await db.insert(slackPingLog).values({ traineeCode: t.traineeCode, reason: input.type, sentAt: Date.now(), messageTs: msgData.ts ?? null });
            sent++;
          } catch { skipped++; }
        }
        await auditEntry(ctx.user, "slack_reminder", input.type, "batch", JSON.stringify({ sent, skipped, targets: targets.length }));
        return { ok: true, sent, skipped, targets: targets.length };
      }),
  }),
  payrollV2: payrollV2Router,
  orientation: orientationRouter,
  violations: violationsRouter,
  ot: otRouter,
  employees: employeesRouter,
  academy: academyRouter,
  performanceV2: performanceV2Router,
  // adherenceRouter + qualityRouter removed
  cycleTracker: cycleTrackerRouter,
  coaching: coachingRouter,
  coachingCases: coachingCasesRouter,
  settings: settingsRouter,
  hubspot: hubspotRouter,
  integrations: integrationsRouter,
  commission: commissionRouter,
  adjustments: adjustmentsRouter,
  trainerSalaries: trainerSalariesRouter,
  apiKeys: apiKeysRouter,
  bd: bdRouter,
  warnings: warningsRouter,
  presence: presenceRouter,
  crdtsArchive: crdtsArchiveRouter,
  hr: hrRouter,
  leave: leaveRouter,
  exit: exitRouter,
  session: sessionRouter,
  contracts: contractsRouter,
  advances: advancesRouter,
  clients: clientsRouter,
  timeTracking: timeTrackingRouter,
});
export type AppRouter = typeof appRouter;
