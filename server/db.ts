import { and, desc, eq, getTableColumns, gte, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  PipelineStage,
  activityLog,
  agentRequests,
  batchCandidates,
  candidates,
  cycleDeductions,
  cycleOT,
  cycleStats,
  interviews,
  stageNotes,
  trainingBatches,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;

  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0] ?? undefined;
}

// ─── Candidates ───────────────────────────────────────────────────────────────

export async function listCandidates() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(candidates).orderBy(desc(candidates.createdAt));
}

export async function getCandidateById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(candidates).where(eq(candidates.id, id)).limit(1);
  return result[0] ?? undefined;
}

export async function createCandidate(data: {
  name: string;
  email?: string;
  phone?: string;
  positionApplied?: string;
  resumeLink?: string;
  notes?: string;
  status?: PipelineStage;
  age?: number;
  location?: string;
  source?: "linkedin" | "email" | "referral" | "walk_in" | "other";
  wave?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = Date.now();
  const result = await db.insert(candidates).values({
    name: data.name,
    email: data.email,
    phone: data.phone ?? null,
    positionApplied: data.positionApplied ?? "Call Center Agent",
    resumeLink: data.resumeLink ?? null,
    notes: data.notes ?? null,
    status: data.status ?? "applied",
    appliedAt: now,
    age: data.age ?? null,
    location: data.location ?? null,
    source: data.source ?? null,
    wave: data.wave ?? null,
  });
  return result;
}

export async function updateCandidate(
  id: number,
  data: {
    name?: string;
    email?: string;
    phone?: string | null;
    positionApplied?: string;
    resumeLink?: string | null;
    notes?: string | null;
    meetLink?: string | null;
    teamsLink?: string | null;
    age?: number | null;
    location?: string | null;
    source?: "linkedin" | "email" | "referral" | "walk_in" | "other" | null;
    voiceNoteRating?: number | null;
    screeningNotes?: string | null;
    wave?: number | null;
    cvUrl?: string | null;
    cvFileName?: string | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(candidates).set(data).where(eq(candidates.id, id));
}

export async function updateCandidateStatus(id: number, status: PipelineStage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const extra: Record<string, unknown> = { status };
  if (status === "accepted") extra.acceptedAt = Date.now();
  await db.update(candidates).set(extra).where(eq(candidates.id, id));
}

export async function deleteCandidate(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { stageNotes, interviews, activityLog, batchCandidates, agentNotifications, referrals, workforceAgents, agentCredentials, breakSchedules, scheduleChangeRequests, overtimeAvailability } = await import("../drizzle/schema");
  // If this candidate was promoted to Operations, delete the workforce row and all linked data first
  const wfRows = await db.select({ traineeCode: workforceAgents.traineeCode })
    .from(workforceAgents).where(eq(workforceAgents.candidateId, id));
  for (const wf of wfRows) {
    const code = wf.traineeCode;
    await db.delete(agentCredentials).where(eq(agentCredentials.traineeCode, code));
    await db.delete(breakSchedules).where(eq(breakSchedules.agentCode, code));
    await db.delete(scheduleChangeRequests).where(eq(scheduleChangeRequests.requesterCode, code));
    await db.delete(overtimeAvailability).where(eq(overtimeAvailability.traineeCode, code));
    await db.delete(workforceAgents).where(eq(workforceAgents.traineeCode, code));
  }
  // Delete all child records before the candidate row
  await db.delete(stageNotes).where(eq(stageNotes.candidateId, id));
  await db.delete(interviews).where(eq(interviews.candidateId, id));
  await db.delete(activityLog).where(eq(activityLog.candidateId, id));
  await db.delete(batchCandidates).where(eq(batchCandidates.candidateId, id));
  await db.delete(agentNotifications).where(eq(agentNotifications.candidateId, id));
  // Delete referrals where this candidate is the referrer OR the created candidate
  await db.delete(referrals).where(eq(referrals.referrerCandidateId, id));
  await db.delete(referrals).where(eq(referrals.createdCandidateId, id));
  // Finally delete the candidate
  await db.delete(candidates).where(eq(candidates.id, id));
}

/**
 * Check if a phone number already exists in the candidates table.
 * Returns the existing candidate record (with their latest stage notes) or null.
 */
export async function checkDuplicateByPhone(phone: string) {
  const db = await getDb();
  if (!db) return null;
  const normalized = phone.replace(/[^\d]/g, "");
  if (!normalized) return null;
  // Match on last 9 digits to handle country code variations
  const suffix = normalized.slice(-9);
  const all = await db.select().from(candidates);
  const match = all.find((c) => {
    if (!c.phone) return false;
    const cp = c.phone.replace(/[^\d]/g, "");
    return cp.endsWith(suffix);
  });
  if (!match) return null;
  // Fetch rejection notes if rejected
  const notes = match.status === "rejected"
    ? await db.select().from(stageNotes)
        .where(and(eq(stageNotes.candidateId, match.id), eq(stageNotes.stage, "rejected")))
        .orderBy(desc(stageNotes.createdAt))
        .limit(3)
    : [];
  return { candidate: match, rejectionNotes: notes };
}

/**
 * Returns all candidates whose phone number matches a previously rejected candidate.
 * Used for the Re-applicants tab.
 */
export async function getReApplicants() {
  const db = await getDb();
  if (!db) return [];
  // Find all rejected candidates
  const rejected = await db.select().from(candidates).where(eq(candidates.status, "rejected"));
  if (rejected.length === 0) return [];
  // Normalize phones
  const rejectedPhones = rejected
    .filter((c) => c.phone)
    .map((c) => c.phone!.replace(/[^\d]/g, "").slice(-9));
  if (rejectedPhones.length === 0) return [];
  // Find active candidates whose phone suffix matches a rejected one
  const all = await db.select().from(candidates).orderBy(desc(candidates.createdAt));
  return all.filter((c) => {
    if (!c.phone) return false;
    const suffix = c.phone.replace(/[^\d]/g, "").slice(-9);
    return rejectedPhones.includes(suffix);
  });
}

export async function bulkInsertCandidates(
  rows: Array<{
    name: string;
    email?: string;
    phone?: string;
    positionApplied?: string;
    resumeLink?: string;
    notes?: string;
    age?: number;
    location?: string;
    source?: "linkedin" | "email" | "referral" | "walk_in" | "other";
    wave?: number;
  }>
): Promise<{ inserted: number; skipped: number; skippedNames: string[] }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = Date.now();

  // Load existing candidates for dedup
  const existing = await db.select({ id: candidates.id, email: candidates.email, phone: candidates.phone }).from(candidates);
  const emailSet = new Set(existing.filter(c => c.email).map(c => c.email!.toLowerCase()));
  const phoneSet = new Set(existing.filter(c => c.phone).map(c => c.phone!.replace(/\D/g, "").slice(-9)));

  const toInsert: typeof rows = [];
  const skippedNames: string[] = [];

  for (const r of rows) {
    const emailMatch = r.email && emailSet.has(r.email.toLowerCase());
    const phoneMatch = r.phone && phoneSet.has(r.phone.replace(/\D/g, "").slice(-9));
    if (emailMatch || phoneMatch) {
      skippedNames.push(r.name);
      continue;
    }
    toInsert.push(r);
    // Add to sets to catch duplicates within the same file
    if (r.email) emailSet.add(r.email.toLowerCase());
    if (r.phone) phoneSet.add(r.phone.replace(/\D/g, "").slice(-9));
  }

  if (toInsert.length > 0) {
    await db.insert(candidates).values(
      toInsert.map((r) => ({
        name: r.name,
        email: r.email ?? undefined,
        phone: r.phone ?? null,
        positionApplied: r.positionApplied ?? "Call Center Agent",
        resumeLink: r.resumeLink ?? null,
        notes: r.notes ?? null,
        age: r.age ?? null,
        location: r.location ?? null,
        source: r.source ?? null,
        wave: r.wave ?? null,
        status: "applied" as PipelineStage,
        appliedAt: now,
      }))
    );
  }

  return { inserted: toInsert.length, skipped: skippedNames.length, skippedNames };
}

// ─── Activity Log ─────────────────────────────────────────────────────────────

export async function logActivity(data: {
  candidateId: number;
  action: string;
  fromStage?: string;
  toStage?: string;
  detail?: string;
  performedBy?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(activityLog).values({
    candidateId: data.candidateId,
    action: data.action,
    fromStage: data.fromStage ?? null,
    toStage: data.toStage ?? null,
    detail: data.detail ?? null,
    performedBy: data.performedBy ?? null,
  });
}

export async function listActivityByCandidateId(candidateId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(activityLog)
    .where(eq(activityLog.candidateId, candidateId))
    .orderBy(desc(activityLog.createdAt));
}

export async function listAllActivity(limit = 200) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: activityLog.id,
      candidateId: activityLog.candidateId,
      action: activityLog.action,
      fromStage: activityLog.fromStage,
      toStage: activityLog.toStage,
      detail: activityLog.detail,
      performedBy: activityLog.performedBy,
      createdAt: activityLog.createdAt,
      candidateName: candidates.name,
    })
    .from(activityLog)
    .leftJoin(candidates, eq(activityLog.candidateId, candidates.id))
    .orderBy(desc(activityLog.createdAt))
    .limit(limit);
  return rows;
}

// ─── Stage Notes ──────────────────────────────────────────────────────────────

export async function listNotesByCandidateId(candidateId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(stageNotes)
    .where(eq(stageNotes.candidateId, candidateId))
    .orderBy(desc(stageNotes.createdAt));
}

export async function addStageNote(data: {
  candidateId: number;
  stage: PipelineStage;
  note: string;
  recruiterName?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(stageNotes).values({
    candidateId: data.candidateId,
    stage: data.stage,
    note: data.note,
    recruiterName: data.recruiterName ?? null,
  });
}

// ─── Interviews ───────────────────────────────────────────────────────────────

export async function listInterviewsByCandidateId(candidateId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(interviews)
    .where(eq(interviews.candidateId, candidateId))
    .orderBy(desc(interviews.scheduledAt));
}

export async function createInterview(data: {
  candidateId: number;
  scheduledAt: number;
  location?: string;
  interviewerName?: string;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(interviews).values({
    candidateId: data.candidateId,
    scheduledAt: data.scheduledAt,
    location: data.location ?? null,
    interviewerName: data.interviewerName ?? null,
    notes: data.notes ?? null,
    notificationSent: 0,
  });
}

export async function markInterviewNotificationSent(interviewId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(interviews)
    .set({ notificationSent: 1 })
    .where(eq(interviews.id, interviewId));
}

export async function getInterviewsScheduledSince(sinceMs: number) {
  const db = await getDb();
  if (!db) return 0;
  const query = db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(interviews);
  const result = sinceMs > 0
    ? await query.where(gte(interviews.createdAt, new Date(sinceMs)))
    : await query;
  return result[0]?.count ?? 0;
}

// ─── Dashboard KPIs ───────────────────────────────────────────────────────────

export async function getPipelineCounts(period: "week" | "month" | "all") {
  const db = await getDb();
  if (!db) return [];
  const now = Date.now();
  let sinceMs: number | null = null;
  if (period === "week") sinceMs = now - 7 * 24 * 60 * 60 * 1000;
  else if (period === "month") sinceMs = now - 30 * 24 * 60 * 60 * 1000;

  const query = db
    .select({
      status: candidates.status,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(candidates)
    .groupBy(candidates.status);

  const result = sinceMs !== null
    ? await query.where(gte(candidates.createdAt, new Date(sinceMs)))
    : await query;

  return result;
}

export async function getNoAnswerCount() {
  const db = await getDb();
  if (!db) return 0;
  try {
    // Use raw SQL since subStatus column may not exist yet in DB
    const result = await db.execute(
      sql`SELECT COUNT(*) as count FROM candidates WHERE subStatus = 'no_answer'`
    );
    const rows = (result as unknown as Array<Array<{ count: number }>>)[0] ?? [];
    return Number(rows[0]?.count ?? 0);
  } catch {
    return 0; // Column doesn't exist yet
  }
}

export async function setSubStatus(id: number, subStatus: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  try {
    // Use raw SQL since subStatus column may not exist yet in DB
    if (subStatus === null) {
      await db.execute(sql`UPDATE candidates SET subStatus = NULL WHERE id = ${id}`);
    } else {
      await db.execute(sql`UPDATE candidates SET subStatus = ${subStatus} WHERE id = ${id}`);
    }
  } catch (err) {
    throw new Error("No Answer feature requires DB migration. Please contact support.");
  }
}

export async function getCandidatesAddedSince(sinceMs: number) {
  const db = await getDb();
  if (!db) return 0;
  const query = db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(candidates);
  const result = sinceMs > 0
    ? await query.where(gte(candidates.createdAt, new Date(sinceMs)))
    : await query;
  return result[0]?.count ?? 0;
}

export async function getAvgTimeToHire(sinceMs: number) {
  // Average days from appliedAt to acceptedAt for accepted/teams_invitation_sent candidates
  const db = await getDb();
  if (!db) return null;
  const conditions = [
    isNotNull(candidates.acceptedAt),
    isNotNull(candidates.appliedAt),
  ];
  if (sinceMs > 0) {
    conditions.push(gte(candidates.createdAt, new Date(sinceMs)));
  }
  const result = await db
    .select({
      avgMs: sql<number>`AVG(UNIX_TIMESTAMP(${candidates.acceptedAt}) - UNIX_TIMESTAMP(${candidates.appliedAt})) * 1000`.mapWith(Number),
    })
    .from(candidates)
    .where(and(...conditions));
  const avgMs = result[0]?.avgMs ?? null;
  if (!avgMs) return null;
  return Math.round(avgMs / (1000 * 60 * 60 * 24)); // convert to days
}

export async function getStageDropoff(period: "week" | "month" | "all") {
  // Returns count per stage for funnel visualization
  return getPipelineCounts(period);
}

// ─── Training Batches ─────────────────────────────────────────────────────────

export async function listBatches() {
  const db = await getDb();
  if (!db) return [];
  const batches = await db.select().from(trainingBatches).orderBy(desc(trainingBatches.createdAt));
  // Get candidate counts per batch
  const counts = await db
    .select({
      batchId: batchCandidates.batchId,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(batchCandidates)
    .groupBy(batchCandidates.batchId);
  const countMap = Object.fromEntries(counts.map((c) => [c.batchId, c.count]));
  return batches.map((b) => ({ ...b, candidateCount: countMap[b.id] ?? 0 }));
}

export async function getBatchById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(trainingBatches).where(eq(trainingBatches.id, id)).limit(1);
  return result[0] ?? undefined;
}

export async function createBatch(data: {
  name: string;
  trainerName?: string;
  startDate?: number;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(trainingBatches).values({
    name: data.name,
    trainerName: data.trainerName ?? null,
    startDate: data.startDate ?? null,
    notes: data.notes ?? null,
  });
  return result;
}

export async function updateBatch(id: number, data: {
  name?: string;
  trainerName?: string | null;
  startDate?: number | null;
  notes?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(trainingBatches).set(data).where(eq(trainingBatches.id, id));
}

export async function deleteBatch(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Remove all candidate assignments first
  await db.delete(batchCandidates).where(eq(batchCandidates.batchId, id));
  await db.delete(trainingBatches).where(eq(trainingBatches.id, id));
}

export async function listCandidatesInBatch(batchId: number) {
  const db = await getDb();
  if (!db) return [];
  // Join batch_candidates with candidates to get full candidate info
  const rows = await db
    .select()
    .from(batchCandidates)
    .where(eq(batchCandidates.batchId, batchId));
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.candidateId);
  const cands = await db.select().from(candidates).where(inArray(candidates.id, ids));
  // Merge traineeCode and slackJoined from batchCandidates into each candidate row
  return cands.map((c) => ({
    ...c,
    traineeCode: rows.find((r) => r.candidateId === c.id)?.traineeCode ?? null,
    slackJoined: rows.find((r) => r.candidateId === c.id)?.slackJoined ?? false,
  }));
}

export async function setTraineeCode(batchId: number, candidateId: number, code: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(batchCandidates)
    .set({ traineeCode: code })
    .where(and(eq(batchCandidates.batchId, batchId), eq(batchCandidates.candidateId, candidateId)));
}

export async function toggleSlackJoined(batchId: number, candidateId: number, value: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(batchCandidates)
    .set({ slackJoined: value })
    .where(and(eq(batchCandidates.batchId, batchId), eq(batchCandidates.candidateId, candidateId)));
}

export async function assignCandidateToBatch(batchId: number, candidateId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Remove from any existing batch first (one batch per candidate)
  await db.delete(batchCandidates).where(eq(batchCandidates.candidateId, candidateId));
  await db.insert(batchCandidates).values({ batchId, candidateId });
}

export async function removeCandidateFromBatch(batchId: number, candidateId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(batchCandidates)
    .where(and(eq(batchCandidates.batchId, batchId), eq(batchCandidates.candidateId, candidateId)));
}

export async function getCandidateBatch(candidateId: number) {
  const db = await getDb();
  if (!db) return null;
  const row = await db
    .select()
    .from(batchCandidates)
    .where(eq(batchCandidates.candidateId, candidateId))
    .limit(1);
  if (!row[0]) return null;
  const batch = await db
    .select()
    .from(trainingBatches)
    .where(eq(trainingBatches.id, row[0].batchId))
    .limit(1);
  return batch[0] ?? null;
}

export async function getAllBatchAssignments(): Promise<Record<number, string>> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db
    .select({
      candidateId: batchCandidates.candidateId,
      batchName: trainingBatches.name,
    })
    .from(batchCandidates)
    .innerJoin(trainingBatches, eq(batchCandidates.batchId, trainingBatches.id));
  const map: Record<number, string> = {};
  for (const row of rows) {
    map[row.candidateId] = row.batchName;
  }
  return map;
}

// ─── Agent Credentials ────────────────────────────────────────────────────────

export async function getAgentCredentialByCandidateId(candidateId: number) {
  const db = await getDb();
  if (!db) return null;
  const { agentCredentials } = await import("../drizzle/schema");
  const result = await db.select().from(agentCredentials).where(eq(agentCredentials.candidateId, candidateId)).limit(1);
  return result[0] ?? null;
}

export async function getAgentCredentialByTraineeCode(traineeCode: string) {
  const db = await getDb();
  if (!db) return null;
  const { agentCredentials } = await import("../drizzle/schema");
  const result = await db.select().from(agentCredentials).where(eq(agentCredentials.traineeCode, traineeCode)).limit(1);
  return result[0] ?? null;
}

export async function upsertAgentCredential(candidateId: number, traineeCode: string, passwordHash: string, mustChangePassword = true) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { agentCredentials } = await import("../drizzle/schema");
  // Try insert first, update if exists
  const existing = await getAgentCredentialByCandidateId(candidateId);
  if (existing) {
    await db.update(agentCredentials)
      .set({ traineeCode, passwordHash, mustChangePassword })
      .where(eq(agentCredentials.candidateId, candidateId));
  } else {
    await db.insert(agentCredentials).values({ candidateId, traineeCode, passwordHash, mustChangePassword });
  }
}
export async function changeAgentPassword(candidateId: number, newPasswordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { agentCredentials } = await import("../drizzle/schema");
  await db.update(agentCredentials)
    .set({ passwordHash: newPasswordHash, mustChangePassword: false })
    .where(eq(agentCredentials.candidateId, candidateId));
}

// ─── Payroll Records ──────────────────────────────────────────────────────────

export async function getPayrollByCandidateId(candidateId: number) {
  const db = await getDb();
  if (!db) return [];
  const { payrollRecords } = await import("../drizzle/schema");
  return db.select().from(payrollRecords)
    .where(eq(payrollRecords.candidateId, candidateId))
    .orderBy(desc(payrollRecords.month));
}

export async function upsertPayrollRecordLegacy(data: {
  candidateId: number;
  month: string;
  grossSalary?: number | null;
  deductions?: number | null;
  netPay?: number | null;
  paymentDate?: number | null;
  status?: "pending" | "paid" | "on_hold";
  notes?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { payrollRecords } = await import("../drizzle/schema");
  const existing = await db.select({ id: payrollRecords.id })
    .from(payrollRecords)
    .where(and(eq(payrollRecords.candidateId, data.candidateId), eq(payrollRecords.month, data.month)))
    .limit(1);
  if (existing[0]) {
    await db.update(payrollRecords).set({
      grossSalary: data.grossSalary != null ? String(data.grossSalary) : null,
      deductions: data.deductions != null ? String(data.deductions) : null,
      netPay: data.netPay != null ? String(data.netPay) : null,
      paymentDate: data.paymentDate ?? null,
      status: data.status ?? "pending",
      notes: data.notes ?? null,
    }).where(eq(payrollRecords.id, existing[0].id));
  } else {
    await db.insert(payrollRecords).values({
      candidateId: data.candidateId,
      month: data.month,
      grossSalary: data.grossSalary != null ? String(data.grossSalary) : null,
      deductions: data.deductions != null ? String(data.deductions) : null,
      netPay: data.netPay != null ? String(data.netPay) : null,
      paymentDate: data.paymentDate ?? null,
      status: data.status ?? "pending",
      notes: data.notes ?? null,
    });
  }
}

export async function deletePayrollRecord(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { payrollRecords } = await import("../drizzle/schema");
  await db.delete(payrollRecords).where(eq(payrollRecords.id, id));
}

// ─── Performance Records ──────────────────────────────────────────────────────

export async function getPerformanceByCandidateId(candidateId: number) {
  const db = await getDb();
  if (!db) return [];
  const { performanceRecords } = await import("../drizzle/schema");
  return db.select().from(performanceRecords)
    .where(eq(performanceRecords.candidateId, candidateId))
    .orderBy(desc(performanceRecords.period));
}

export async function upsertPerformanceRecord(data: {
  candidateId: number;
  period: string;
  callsMade?: number | null;
  leadsGenerated?: number | null;
  targetsHit?: number | null;
  totalTargets?: number | null;
  qualityScore?: number | null;
  attendanceRate?: number | null;
  notes?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { performanceRecords } = await import("../drizzle/schema");
  const existing = await db.select({ id: performanceRecords.id })
    .from(performanceRecords)
    .where(and(eq(performanceRecords.candidateId, data.candidateId), eq(performanceRecords.period, data.period)))
    .limit(1);
  const values = {
    callsMade: data.callsMade ?? null,
    leadsGenerated: data.leadsGenerated ?? null,
    targetsHit: data.targetsHit ?? null,
    totalTargets: data.totalTargets ?? null,
    qualityScore: data.qualityScore != null ? String(data.qualityScore) : null,
    attendanceRate: data.attendanceRate != null ? String(data.attendanceRate) : null,
    notes: data.notes ?? null,
  };
  if (existing[0]) {
    await db.update(performanceRecords).set(values).where(eq(performanceRecords.id, existing[0].id));
  } else {
    await db.insert(performanceRecords).values({ candidateId: data.candidateId, period: data.period, ...values });
  }
}

export async function deletePerformanceRecord(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { performanceRecords } = await import("../drizzle/schema");
  await db.delete(performanceRecords).where(eq(performanceRecords.id, id));
}

// ─── Agent Requests ────────────────────────────────────────────────────────

export async function createAgentRequest(data: {
  candidateId: number;
  traineeCode: string;
  type: "leave" | "paid_leave" | "salary" | "schedule" | "complaint" | "resignation" | "day_off" | "sick_note" | "hr_letter" | "other";
  subject: string;
  message: string;
  requestedDate?: number | null;
  requestedDates?: string | null; // JSON array of date strings
  attachmentUrl?: string | null;
  hrLetterPurpose?: string | null;
  hrLetterLanguage?: "arabic" | "english" | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(agentRequests).values({
    candidateId: data.candidateId,
    traineeCode: data.traineeCode,
    type: data.type,
    subject: data.subject,
    message: data.message,
    requestedDate: data.requestedDate ?? null,
    requestedDates: data.requestedDates ?? null,
    attachmentUrl: data.attachmentUrl ?? null,
    hrLetterPurpose: data.hrLetterPurpose ?? null,
    hrLetterLanguage: data.hrLetterLanguage ?? null,
    status: "pending",
  });
  // Notify the admin Slack channel (fire-and-forget). With a bot token + channel we post via
  // chat.postMessage so we can capture the message ts and enable react-to-action on the alert.
  const newId = (result as unknown as Array<{ insertId?: number }>)[0]?.insertId;
  const botToken = process.env.SLACK_BOT_TOKEN;
  const channelId = process.env.SLACK_ADMIN_CHANNEL_ID;
  const hook = process.env.SLACK_ADMIN_WEBHOOK;
  if (botToken || hook) {
    const typeLabel = data.type.replace(/_/g, " ");
    getWorkforceAgentByCode(data.traineeCode).then(async (wf) => {
      const nm = String(wf?.fullName ?? "").trim();
      const al = String(wf?.alias ?? "").trim();
      const cr = String(wf?.crdts ?? "").trim();
      const who =
        `*Name:* ${nm || "—"}${al ? `   *Alias:* ${al}` : ""}\n` +
        `*Code:* ${data.traineeCode}${cr ? `   *CRDTS:* ${cr}` : ""}`;
      const text = `:bell: *New ${typeLabel} request*\n${who}\n*${data.subject}*\n${data.message}\n_React :white_check_mark: resolved · :eyes: in progress · :x: rejected_`;
      if (botToken && channelId) {
        const resp = await fetch("https://slack.com/api/chat.postMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${botToken}` },
          body: JSON.stringify({ channel: channelId, text }),
        });
        const j = (await resp.json()) as { ok?: boolean; ts?: string };
        if (j.ok && j.ts && newId) await setRequestSlackMessageTs(newId, j.ts);
      } else if (hook) {
        await fetch(hook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      }
    }).catch(() => {});
  }
  return result;
}

export async function listAgentRequestsByCandidate(candidateId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(agentRequests)
    .where(eq(agentRequests.candidateId, candidateId))
    .orderBy(desc(agentRequests.createdAt));
}

export async function listAllAgentRequests() {
  const db = await getDb();
  if (!db) return [];
  const { workforceAgents } = await import("../drizzle/schema");
  return db
    .select({ ...getTableColumns(agentRequests), fullName: workforceAgents.fullName, alias: workforceAgents.alias })
    .from(agentRequests)
    .leftJoin(workforceAgents, eq(agentRequests.traineeCode, workforceAgents.traineeCode))
    .orderBy(desc(agentRequests.createdAt));
}

export async function updateAgentRequestStatus(
  id: number,
  status: "pending" | "in_progress" | "resolved" | "rejected",
  adminReply?: string | null
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(agentRequests)
    .set({ status, ...(adminReply !== undefined ? { adminReply } : {}) })
    .where(eq(agentRequests.id, id));
}

export async function setRequestSlackMessageTs(id: number, ts: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(agentRequests).set({ slackMessageTs: ts }).where(eq(agentRequests.id, id));
}

export async function getRequestBySlackMessageTs(ts: string) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(agentRequests).where(eq(agentRequests.slackMessageTs, ts)).limit(1);
  return row ?? null;
}

export async function countUnreadAgentRequests() {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(agentRequests)
    .where(eq(agentRequests.isAdminRead, false));
  return Number(rows[0]?.count ?? 0);
}

export async function markAllAgentRequestsRead() {
  const db = await getDb();
  if (!db) return;
  await db.update(agentRequests).set({ isAdminRead: true }).where(eq(agentRequests.isAdminRead, false));
}

// ─── Admin Accounts ───────────────────────────────────────────────────────────
export async function getAdminByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;
  const { adminAccounts } = await import("../drizzle/schema");
  // Case-insensitive lookup — normalize both sides to lowercase
  const { sql: rawSql } = await import("drizzle-orm");
  const rows = await db.select().from(adminAccounts)
    .where(rawSql`LOWER(${adminAccounts.email}) = LOWER(${email})`)
    .limit(1);
  return rows[0] ?? null;
}
export async function getAdminById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const { adminAccounts } = await import("../drizzle/schema");
  const rows = await db.select().from(adminAccounts).where(eq(adminAccounts.id, id)).limit(1);
  return rows[0] ?? null;
}
export async function createAdminAccount(data: {
  email: string; name: string; passwordHash: string; invitedBy: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { adminAccounts } = await import("../drizzle/schema");
  await db.insert(adminAccounts).values({
    email: data.email.toLowerCase(), name: data.name, passwordHash: data.passwordHash,
    invitedBy: data.invitedBy, forcePasswordChange: false, isActive: true,
  });
}
export async function listAdminAccounts() {
  const db = await getDb();
  if (!db) return [];
  const { adminAccounts } = await import("../drizzle/schema");
  return db.select({
    id: adminAccounts.id, email: adminAccounts.email, name: adminAccounts.name,
    role: adminAccounts.role, isActive: adminAccounts.isActive,
    invitedBy: adminAccounts.invitedBy, createdAt: adminAccounts.createdAt,
  }).from(adminAccounts).orderBy(desc(adminAccounts.createdAt));
}
export async function setAdminActive(id: number, isActive: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { adminAccounts } = await import("../drizzle/schema");
  await db.update(adminAccounts).set({ isActive }).where(eq(adminAccounts.id, id));
}
export async function updateAdminPassword(id: number, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { adminAccounts } = await import("../drizzle/schema");
  await db.update(adminAccounts).set({ passwordHash, forcePasswordChange: false }).where(eq(adminAccounts.id, id));
}

// ─── Admin Invites ────────────────────────────────────────────────────────────
export async function createAdminInvite(data: { email: string; name: string; token: string; expiresAt: number; invitedBy: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { adminInvites } = await import("../drizzle/schema");
  await db.insert(adminInvites).values(data);
}
export async function getAdminInviteByToken(token: string) {
  const db = await getDb();
  if (!db) return null;
  const { adminInvites } = await import("../drizzle/schema");
  const rows = await db.select().from(adminInvites).where(eq(adminInvites.token, token)).limit(1);
  return rows[0] ?? null;
}
export async function markAdminInviteUsed(token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { adminInvites } = await import("../drizzle/schema");
  await db.update(adminInvites).set({ usedAt: Date.now() }).where(eq(adminInvites.token, token));
}
export async function regenerateAdminInviteById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { adminInvites } = await import("../drizzle/schema");
  const { randomBytes } = await import("crypto");
  const newToken = randomBytes(48).toString("hex");
  const newExpiresAt = Date.now() + 48 * 60 * 60 * 1000;
  await db.update(adminInvites)
    .set({ token: newToken, expiresAt: newExpiresAt, usedAt: null })
    .where(eq(adminInvites.id, id));
  return { token: newToken, expiresAt: newExpiresAt };
}

// ─── Login Rate Limiting ──────────────────────────────────────────────────────
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;
export async function recordFailedLogin(identifier: string, attemptType: "agent" | "admin", ipAddress?: string) {
  const db = await getDb();
  if (!db) return;
  const { loginAttempts } = await import("../drizzle/schema");
  await db.insert(loginAttempts).values({ identifier, attemptType, failedAt: Date.now(), ipAddress: ipAddress ?? null });
}
export async function isLockedOut(identifier: string, attemptType: "agent" | "admin"): Promise<{ locked: boolean; remainingMs: number }> {
  const db = await getDb();
  if (!db) return { locked: false, remainingMs: 0 };
  const { loginAttempts } = await import("../drizzle/schema");
  const since = Date.now() - LOCKOUT_WINDOW_MS;
  const rows = await db.select({ id: loginAttempts.id, failedAt: loginAttempts.failedAt })
    .from(loginAttempts)
    .where(and(
      eq(loginAttempts.identifier, identifier),
      eq(loginAttempts.attemptType, attemptType),
      gte(loginAttempts.failedAt, since)
    ))
    .orderBy(loginAttempts.failedAt)
    .limit(MAX_ATTEMPTS + 1);
  if (rows.length >= MAX_ATTEMPTS) {
    // Find the oldest attempt in the window — lockout expires LOCKOUT_WINDOW_MS after it
    const oldestAttempt = rows[0].failedAt;
    const lockoutExpiry = (oldestAttempt as number) + LOCKOUT_WINDOW_MS;
    const remainingMs = Math.max(0, lockoutExpiry - Date.now());
    return { locked: true, remainingMs };
  }
  return { locked: false, remainingMs: 0 };
}
export async function countRecentFailedLogins(identifier: string, attemptType: "agent" | "admin"): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const { loginAttempts } = await import("../drizzle/schema");
  const since = Date.now() - LOCKOUT_WINDOW_MS;
  const rows = await db.select({ failedAt: loginAttempts.failedAt })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.identifier, identifier), eq(loginAttempts.attemptType, attemptType)));
  return rows.filter(r => r.failedAt >= since).length;
}
export async function clearLoginAttempts(identifier: string, attemptType: "agent" | "admin") {
  const db = await getDb();
  if (!db) return;
  const { loginAttempts } = await import("../drizzle/schema");
  await db.delete(loginAttempts).where(and(eq(loginAttempts.identifier, identifier), eq(loginAttempts.attemptType, attemptType)));
}

// ─── Referrals ────────────────────────────────────────────────────────────────
export async function createReferral(data: {
  referrerCandidateId: number; refereeName: string; refereePhone: string;
  refereeNote?: string | null; createdCandidateId?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { referrals } = await import("../drizzle/schema");
  const result = await db.insert(referrals).values({
    referrerCandidateId: data.referrerCandidateId,
    refereeName: data.refereeName,
    refereePhone: data.refereePhone,
    refereeNote: data.refereeNote ?? null,
    createdCandidateId: data.createdCandidateId ?? null,
  });
  return result;
}
export async function getReferralsByReferrer(referrerCandidateId: number) {
  const db = await getDb();
  if (!db) return [];
  const { referrals } = await import("../drizzle/schema");
  return db.select().from(referrals)
    .where(eq(referrals.referrerCandidateId, referrerCandidateId))
    .orderBy(desc(referrals.createdAt));
}
export async function listAllReferrals() {
  const db = await getDb();
  if (!db) return [];
  const { referrals, candidates } = await import("../drizzle/schema");
  const rows = await db
    .select({
      id: referrals.id,
      refereeName: referrals.refereeName,
      refereePhone: referrals.refereePhone,
      refereeNote: referrals.refereeNote,
      status: referrals.status,
      createdAt: referrals.createdAt,
      createdCandidateId: referrals.createdCandidateId,
      referrerCandidateId: referrals.referrerCandidateId,
      referrerName: candidates.name,
    })
    .from(referrals)
    .leftJoin(candidates, eq(referrals.referrerCandidateId, candidates.id))
    .orderBy(desc(referrals.createdAt));
  return rows.map(r => ({ ...r, referrerAlias: null as string | null }));
}
export async function updateReferralStatus(id: number, status: "pending" | "contacted" | "hired" | "rejected") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { referrals } = await import("../drizzle/schema");
  await db.update(referrals).set({ status }).where(eq(referrals.id, id));
}

// ─── Agent Notifications ──────────────────────────────────────────────────────
export async function createAgentNotification(data: {
  candidateId: number; message: string;
  type: "request_reply" | "referral_update" | "general" | "campaign_assigned"; relatedId?: number | null;
}) {
  const db = await getDb();
  if (!db) return;
  const { agentNotifications } = await import("../drizzle/schema");
  await db.insert(agentNotifications).values({
    candidateId: data.candidateId, message: data.message,
    type: data.type, relatedId: data.relatedId ?? null,
  });
}
export async function getNotificationsByCandidate(candidateId: number) {
  const db = await getDb();
  if (!db) return [];
  const { agentNotifications } = await import("../drizzle/schema");
  return db.select().from(agentNotifications)
    .where(eq(agentNotifications.candidateId, candidateId))
    .orderBy(desc(agentNotifications.createdAt))
    .limit(50);
}
export async function markNotificationsRead(candidateId: number) {
  const db = await getDb();
  if (!db) return;
  const { agentNotifications } = await import("../drizzle/schema");
  await db.update(agentNotifications).set({ isRead: true })
    .where(eq(agentNotifications.candidateId, candidateId));
}
export async function countUnreadNotifications(candidateId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const { agentNotifications } = await import("../drizzle/schema");
  const rows = await db.select({ id: agentNotifications.id })
    .from(agentNotifications)
    .where(and(eq(agentNotifications.candidateId, candidateId), eq(agentNotifications.isRead, false)));
  return rows.length;
}


// ─── Campaigns ────────────────────────────────────────────────────────────────

export async function listCampaigns() {
  const db = await getDb();
  if (!db) return [];
  const { campaigns } = await import("../drizzle/schema");
  return db.select().from(campaigns).orderBy(campaigns.name);
}

export async function getCampaignById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const { campaigns } = await import("../drizzle/schema");
  const rows = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createCampaign(data: { name: string; minHeadcount: number; workDays: "all" | "weekdays"; notes?: string }) {
  const db = await getDb();
  if (!db) return;
  const { campaigns } = await import("../drizzle/schema");
  await db.insert(campaigns).values(data);
}

export async function updateCampaign(id: number, data: Partial<{ name: string; minHeadcount: number; workDays: "all" | "weekdays"; notes: string }>) {
  const db = await getDb();
  if (!db) return;
  const { campaigns } = await import("../drizzle/schema");
  await db.update(campaigns).set(data).where(eq(campaigns.id, id));
}

export async function deleteCampaign(id: number) {
  const db = await getDb();
  if (!db) return;
  const { campaigns } = await import("../drizzle/schema");
  await db.delete(campaigns).where(eq(campaigns.id, id));
}

// ─── Workforce Agents ─────────────────────────────────────────────────────────

export async function listWorkforceAgents(campaignId?: number, teamLeader?: string, includeFormer?: boolean) {
  const db = await getDb();
  if (!db) return [];
  const { workforceAgents, campaigns } = await import("../drizzle/schema");
  const base = db.select({
    id: workforceAgents.id,
    traineeCode: workforceAgents.traineeCode,
    candidateId: workforceAgents.candidateId,
    campaignId: workforceAgents.campaignId,
    campaignName: campaigns.name,
    fullName: workforceAgents.fullName,
    alias: workforceAgents.alias,
    email: workforceAgents.email,
    phone: workforceAgents.phone,
    shiftHours: workforceAgents.shiftHours,
    teamLeader: workforceAgents.teamLeader,
    offDay1: workforceAgents.offDay1,
    offDay2: workforceAgents.offDay2,
    joinDate: workforceAgents.joinDate,
    isActive: workforceAgents.isActive,
    createdAt: workforceAgents.createdAt,
    dialerCredentials: workforceAgents.dialerCredentials,
    crdts: workforceAgents.crdts,
    agentStatus: workforceAgents.agentStatus,
    salarySettled: workforceAgents.salarySettled,
    address: workforceAgents.address,
    emergencyContactName: workforceAgents.emergencyContactName,
    emergencyContactPhone: workforceAgents.emergencyContactPhone,
    emergencyContactRelation: workforceAgents.emergencyContactRelation,
    nestingStatus: workforceAgents.nestingStatus,
    workLocation: workforceAgents.workLocation,
    avatarUrl: workforceAgents.avatarUrl,
    nationalId: workforceAgents.nationalId,
    nationalIdExpiry: workforceAgents.nationalIdExpiry,
    dateOfBirth: workforceAgents.dateOfBirth,
    gender: workforceAgents.gender,
    nationality: workforceAgents.nationality,
    maritalStatus: workforceAgents.maritalStatus,
    militaryStatus: workforceAgents.militaryStatus,
    jobTitle: workforceAgents.jobTitle,
    city: workforceAgents.city,
    profileLocked: workforceAgents.profileLocked,
  }).from(workforceAgents)
    .leftJoin(campaigns, eq(workforceAgents.campaignId, campaigns.id))
    .orderBy(workforceAgents.fullName);
  if (campaignId && teamLeader) {
    return _wfFilterFormer(await base.where(and(eq(workforceAgents.campaignId, campaignId), eq(workforceAgents.teamLeader, teamLeader))), includeFormer);
  }
  if (campaignId) return _wfFilterFormer(await base.where(eq(workforceAgents.campaignId, campaignId)), includeFormer);
  if (teamLeader) return _wfFilterFormer(await base.where(eq(workforceAgents.teamLeader, teamLeader)), includeFormer);
  return _wfFilterFormer(await base, includeFormer);
}

// Lifecycle rule: resigned/terminated/blacklisted agents leave Operations and all
// counts/plans — UNLESS their salary hasn't been settled yet (they stay visible,
// flagged, until "Mark as settled"). Pass includeFormer=true to get everyone (HR views).
function _wfFilterFormer<T extends { agentStatus?: string | null; salarySettled?: boolean | null }>(rows: T[], includeFormer?: boolean): T[] {
  if (includeFormer) return rows;
  return rows.filter(r => {
    const former = r.agentStatus === "resigned" || r.agentStatus === "terminated" || r.agentStatus === "blacklisted";
    if (!former) return true;
    return r.salarySettled === false;   // unpaid former agent stays until settled
  });
}

/**
 * Returns all candidates currently in any training batch with their batch info.
 */
export async function listAllAgentsInTraining() {
  const db = await getDb();
  if (!db) return [];
  const { batchCandidates: bc, trainingBatches, candidates: cands } = await import("../drizzle/schema");
  return db
    .select({
      candidateId: bc.candidateId,
      traineeCode: bc.traineeCode,
      slackJoined: bc.slackJoined,
      assignedAt: bc.assignedAt,
      batchId: trainingBatches.id,
      batchName: trainingBatches.name,
      trainerName: trainingBatches.trainerName,
      batchStartDate: trainingBatches.startDate,
      candidateName: cands.name,
      candidatePhone: cands.phone,
      candidateStatus: cands.status,
    })
    .from(bc)
    .innerJoin(trainingBatches, eq(bc.batchId, trainingBatches.id))
    .innerJoin(cands, eq(bc.candidateId, cands.id))
    .orderBy(trainingBatches.name, cands.name);
}

/**
 * Blacklist a candidate — sets status to 'blacklisted' and stores the reason.
 */
export async function blacklistCandidate(id: number, reason: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(candidates).set({ status: "blacklisted", blacklistReason: reason, updatedAt: new Date() }).where(eq(candidates.id, id));
}

/**
 * Returns payment methods grouped by agent (traineeCode).
 * Each group includes the agent's name (from workforce_agents if available) and all their methods.
 */
export async function listPaymentMethodsGrouped() {
  const db = await getDb();
  if (!db) return [];
  const { agentPaymentMethods, workforceAgents } = await import("../drizzle/schema");
  const rows = await db
    .select({
      id: agentPaymentMethods.id,
      traineeCode: agentPaymentMethods.traineeCode,
      type: agentPaymentMethods.type,
      walletProvider: agentPaymentMethods.walletProvider,
      walletPhone: agentPaymentMethods.walletPhone,
      walletName: agentPaymentMethods.walletName,
      bankName: agentPaymentMethods.bankName,
      bankAccountOrPhone: agentPaymentMethods.bankAccountOrPhone,
      bankFullName: agentPaymentMethods.bankFullName,
      isPreferred: agentPaymentMethods.isPreferred,
      adminComment: agentPaymentMethods.adminComment,
      createdAt: agentPaymentMethods.createdAt,
      agentFullName: workforceAgents.fullName,
      agentAlias: workforceAgents.alias,
    })
    .from(agentPaymentMethods)
    .leftJoin(workforceAgents, eq(agentPaymentMethods.traineeCode, workforceAgents.traineeCode))
    .orderBy(agentPaymentMethods.traineeCode, agentPaymentMethods.isPreferred);
  // Group by traineeCode
  const grouped = new Map<string, {
    traineeCode: string;
    agentFullName: string | null;
    agentAlias: string | null;
    methods: typeof rows;
  }>();
  for (const row of rows) {
    const existing = grouped.get(row.traineeCode);
    if (existing) {
      existing.methods.push(row);
    } else {
      grouped.set(row.traineeCode, {
        traineeCode: row.traineeCode,
        agentFullName: row.agentFullName ?? null,
        agentAlias: row.agentAlias ?? null,
        methods: [row],
      });
    }
  }
  return Array.from(grouped.values());
}

/**
 * Returns candidates eligible to be added to Operations:
 * 1. Candidates currently in training batches (in_training stage)
 * 2. Existing workforce agents (for re-assignment)
 */
export async function getEligibleCandidatesForOps() {
  const db = await getDb();
  if (!db) return [];
  const { candidates: candidatesTable, workforceAgents, batchCandidates } = await import("../drizzle/schema");
  // Get all agents already in Operations
  const existingOpsIds = await db.select({ candidateId: workforceAgents.candidateId }).from(workforceAgents);
  const opsIdSet = new Set(existingOpsIds.map(r => r.candidateId));
  // Get candidates who passed mock call (slackJoined = true in batchCandidates)
  const passedMock = await db.select({
    candidateId: batchCandidates.candidateId,
    traineeCode: batchCandidates.traineeCode,
  }).from(batchCandidates)
    .where(eq(batchCandidates.slackJoined, true));
  const passedIds = Array.from(new Set(passedMock.map(r => r.candidateId)));
  if (!passedIds.length) return [];
  // Get candidate details for passed mock call candidates
  const eligible = await db.select({
    candidateId: candidatesTable.id,
    traineeCode: batchCandidates.traineeCode,
    name: candidatesTable.name,
    phone: candidatesTable.phone,
    source: sql<string>`'accepted'`,
  }).from(candidatesTable)
    .innerJoin(batchCandidates, eq(batchCandidates.candidateId, candidatesTable.id))
    .where(and(
      inArray(candidatesTable.id, passedIds),
      eq(batchCandidates.slackJoined, true)
    ));
  // Filter out those already in Operations
  return eligible
    .filter(r => !opsIdSet.has(r.candidateId))
    .sort((a, b) => a.name.localeCompare(b.name));
}
export async function getWorkforceAgentByCode(traineeCode: string) {
  const db = await getDb();
  if (!db) return null;
  const { workforceAgents, campaigns } = await import("../drizzle/schema");
  const rows = await db.select({
    id: workforceAgents.id,
    traineeCode: workforceAgents.traineeCode,
    candidateId: workforceAgents.candidateId,
    campaignId: workforceAgents.campaignId,
    campaignName: campaigns.name,
    campaignMinHeadcount: campaigns.minHeadcount,
    campaignWorkDays: campaigns.workDays,
    candEmail: candidates.email,
    candPhone: candidates.phone,
    fullName: workforceAgents.fullName,
    alias: workforceAgents.alias,
    email: workforceAgents.email,
    phone: workforceAgents.phone,
    shiftHours: workforceAgents.shiftHours,
    teamLeader: workforceAgents.teamLeader,
    offDay1: workforceAgents.offDay1,
    offDay2: workforceAgents.offDay2,
    joinDate: workforceAgents.joinDate,
    isActive: workforceAgents.isActive,
    dialerCredentials: workforceAgents.dialerCredentials,
    crdts: workforceAgents.crdts,
    agentStatus: workforceAgents.agentStatus,
    nestingStatus: workforceAgents.nestingStatus,
    workLocation: workforceAgents.workLocation,
    avatarUrl: workforceAgents.avatarUrl,
    nationalId: workforceAgents.nationalId,
    nationalIdExpiry: workforceAgents.nationalIdExpiry,
    dateOfBirth: workforceAgents.dateOfBirth,
    gender: workforceAgents.gender,
    nationality: workforceAgents.nationality,
    maritalStatus: workforceAgents.maritalStatus,
    militaryStatus: workforceAgents.militaryStatus,
    jobTitle: workforceAgents.jobTitle,
    city: workforceAgents.city,
    profileLocked: workforceAgents.profileLocked,
  }).from(workforceAgents)
    .leftJoin(campaigns, eq(workforceAgents.campaignId, campaigns.id))
    .leftJoin(candidates, eq(workforceAgents.candidateId, candidates.id))
    .where(eq(workforceAgents.traineeCode, traineeCode))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  // Fall back to the candidate's hiring email/phone when the workforce record's
  // own fields are blank, so agents always see their contact info in the portal.
  const { candEmail, candPhone, ...rest } = r;
  return { ...rest, email: rest.email ?? candEmail ?? null, phone: rest.phone ?? candPhone ?? null };
}

export async function createWorkforceAgent(data: {
  traineeCode: string; candidateId: number; fullName: string;
  alias?: string; email?: string; phone?: string; campaignId?: number;
  shiftHours?: string; teamLeader?: string; offDay1?: number; offDay2?: number; joinDate?: number;
  dialerCredentials?: string; crdts?: string;
}) {
  const db = await getDb();
  if (!db) return;
  const { workforceAgents } = await import("../drizzle/schema");
  await db.insert(workforceAgents).values(data);
}

export async function updateWorkforceAgent(traineeCode: string, data: Partial<{
  fullName: string; alias: string; email: string; phone: string; campaignId: number;
  shiftHours: string; teamLeader: string; offDay1: number; offDay2: number; joinDate: number; isActive: boolean;
  dialerCredentials: string; crdts: string; agentStatus: "active" | "inactive" | "resigned" | "terminated";
  workLocation: "office" | "wfh"; avatarUrl: string;
  nationalId: string; nationalIdExpiry: string; dateOfBirth: string; gender: "male" | "female";
  nationality: string; maritalStatus: "single" | "married" | "divorced" | "widowed";
  militaryStatus: "completed" | "exempt" | "postponed" | "not_applicable"; city: string; jobTitle: string;
  profileLocked: boolean;
}>) {
  const db = await getDb();
  if (!db) return;
  const { workforceAgents } = await import("../drizzle/schema");
  await db.update(workforceAgents).set(data).where(eq(workforceAgents.traineeCode, traineeCode));
}

// ─── Agent Separations ────────────────────────────────────────────
export async function createSeparationRecord(data: {
  agentCode: string;
  type: "resignation_request" | "on_spot" | "termination";
  reason?: string;
  lastWorkingDay?: string;
  requestedAt?: number;
  effectiveAt?: number;
  approvedBy?: string;
  approvedAt?: number;
}) {
  const db = await getDb();
  if (!db) return;
  const { agentSeparations } = await import("../drizzle/schema");
  await db.insert(agentSeparations).values(data);
}

export async function getSeparationsByAgent(agentCode: string) {
  const db = await getDb();
  if (!db) return [];
  const { agentSeparations } = await import("../drizzle/schema");
  return db.select().from(agentSeparations)
    .where(eq(agentSeparations.agentCode, agentCode))
    .orderBy(desc(agentSeparations.createdAt));
}

/**
 * Mark agent as resigned on-spot:
 * 1. Stores separation record
 * 2. Deletes candidate record (cascades to workforce row, credentials, breaks, etc.)
 */
export async function markAgentResignedOnSpot(agentCode: string, reason: string, adminName: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { workforceAgents, agentSeparations, agentCredentials, exitProcess } = await import("../drizzle/schema");
  // Get agent to find candidateId
  const agent = await db.select({ candidateId: workforceAgents.candidateId })
    .from(workforceAgents).where(eq(workforceAgents.traineeCode, agentCode)).limit(1);
  if (!agent[0]) throw new Error("Agent not found");
  const now = Date.now();
  // Store separation record
  await db.insert(agentSeparations).values({
    agentCode, type: "on_spot", reason,
    effectiveAt: now, approvedBy: adminName, approvedAt: now, appliedAt: now,
  });
  // Mark agent as resigned — keep in workforceAgents for historical records
  await db.update(workforceAgents).set({ agentStatus: "resigned", salarySettled: false, isActive: false, updatedAt: new Date() })
    .where(eq(workforceAgents.traineeCode, agentCode));
  // Remove only portal credentials — agent stays in DB indefinitely
  await db.delete(agentCredentials).where(eq(agentCredentials.traineeCode, agentCode));
  // Mark candidate as resigned — ID permanently retired, never reusable
  await db.update(candidates).set({ status: "resigned", updatedAt: new Date() }).where(eq(candidates.id, agent[0].candidateId));
  // Auto-create exit_process row so agent appears in Settle & Exit flow
  const epExist1 = await db.select({ id: exitProcess.id }).from(exitProcess).where(eq(exitProcess.traineeCode, agentCode)).limit(1);
  if (!epExist1[0]) {
    await db.insert(exitProcess).values({ traineeCode: agentCode, exitType: "resignation", settlementDone: false, updatedAt: now });
  }
}

/**
 * Terminate agent:
 * 1. Sets agentStatus = 'terminated', isActive = false
 * 2. Stores separation record
 */
export async function terminateAgent(agentCode: string, reason: string, adminName: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { workforceAgents, agentSeparations, agentCredentials, exitProcess } = await import("../drizzle/schema");
  const now = Date.now();
  // Fetch candidateId
  const agent = await db.select({ candidateId: workforceAgents.candidateId })
    .from(workforceAgents).where(eq(workforceAgents.traineeCode, agentCode)).limit(1);
  if (!agent[0]) throw new Error("Agent not found");
  // Store separation record
  await db.insert(agentSeparations).values({
    agentCode, type: "termination", reason,
    effectiveAt: now, approvedBy: adminName, approvedAt: now, appliedAt: now,
  });
  // Mark agent as terminated — keep in workforceAgents for historical records
  await db.update(workforceAgents).set({ agentStatus: "terminated", salarySettled: false, isActive: false, updatedAt: new Date() })
    .where(eq(workforceAgents.traineeCode, agentCode));
  // Remove only portal credentials — agent stays in DB indefinitely
  await db.delete(agentCredentials).where(eq(agentCredentials.traineeCode, agentCode));
  // Mark candidate as terminated — ID permanently retired, never reusable
  await db.update(candidates).set({ status: "terminated", updatedAt: new Date() }).where(eq(candidates.id, agent[0].candidateId));
  // Auto-create exit_process row so agent appears in Settle & Exit flow
  const epExist2 = await db.select({ id: exitProcess.id }).from(exitProcess).where(eq(exitProcess.traineeCode, agentCode)).limit(1);
  if (!epExist2[0]) {
    await db.insert(exitProcess).values({ traineeCode: agentCode, exitType: "termination", settlementDone: false, updatedAt: now });
  }
}

/**
 * Approve resignation request:
 * 1. Sets agentStatus = 'resigned', isActive = false
 * 2. Stores separation record with lastWorkingDay
 */
export async function approveResignationRequest(agentCode: string, lastWorkingDay: string, reason: string, adminName: string, requestedAt: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { workforceAgents, agentSeparations, agentCredentials, exitProcess } = await import("../drizzle/schema");
  const now = Date.now();
  // Fetch candidateId
  const agent = await db.select({ candidateId: workforceAgents.candidateId })
    .from(workforceAgents).where(eq(workforceAgents.traineeCode, agentCode)).limit(1);
  if (!agent[0]) throw new Error("Agent not found");
  // Store separation record
  await db.insert(agentSeparations).values({
    agentCode, type: "resignation_request", reason, lastWorkingDay,
    requestedAt, effectiveAt: now, approvedBy: adminName, approvedAt: now, appliedAt: now,
  });
  // Mark agent as resigned — keep in workforceAgents for historical records
  await db.update(workforceAgents).set({ agentStatus: "resigned", salarySettled: false, isActive: false, updatedAt: new Date() })
    .where(eq(workforceAgents.traineeCode, agentCode));
  // Remove only portal credentials — agent stays in DB indefinitely
  await db.delete(agentCredentials).where(eq(agentCredentials.traineeCode, agentCode));
  // Mark candidate as resigned — ID permanently retired, never reusable
  await db.update(candidates).set({ status: "resigned", updatedAt: new Date() }).where(eq(candidates.id, agent[0].candidateId));
  // Auto-create exit_process row so agent appears in Settle & Exit flow
  const epExist3 = await db.select({ id: exitProcess.id }).from(exitProcess).where(eq(exitProcess.traineeCode, agentCode)).limit(1);
  if (!epExist3[0]) {
    await db.insert(exitProcess).values({ traineeCode: agentCode, exitType: "resignation", lastWorkingDay, settlementDone: false, updatedAt: now });
  } else {
    // Update lastWorkingDay if admin set one
    await db.update(exitProcess).set({ lastWorkingDay, updatedAt: now }).where(eq(exitProcess.traineeCode, agentCode));
  }
}

// ─── Agent Payment Methods ────────────────────────────────────────────────────

export async function getPaymentMethodsByCode(traineeCode: string) {
  const db = await getDb();
  if (!db) return [];
  const { agentPaymentMethods } = await import("../drizzle/schema");
  return db.select().from(agentPaymentMethods)
    .where(eq(agentPaymentMethods.traineeCode, traineeCode))
    .orderBy(desc(agentPaymentMethods.isPreferred), agentPaymentMethods.createdAt);
}

export async function listAllPaymentMethods() {
  const db = await getDb();
  if (!db) return [];
  const { agentPaymentMethods } = await import("../drizzle/schema");
  return db.select().from(agentPaymentMethods).orderBy(agentPaymentMethods.traineeCode);
}

export async function upsertPaymentMethod(data: {
  id?: number; traineeCode: string; type: "wallet" | "bank";
  walletProvider?: "vodafone_cash" | "orange_cash"; walletPhone?: string; walletName?: string;
  bankName?: string; bankAccountOrPhone?: string; bankFullName?: string; isPreferred?: boolean;
}) {
  const db = await getDb();
  if (!db) return;
  const { agentPaymentMethods } = await import("../drizzle/schema");
  if (data.id) {
    const { id, ...rest } = data;
    await db.update(agentPaymentMethods).set(rest).where(eq(agentPaymentMethods.id, id));
  } else {
    await db.insert(agentPaymentMethods).values(data);
  }
}

export async function setPaymentMethodPreferred(id: number, traineeCode: string) {
  const db = await getDb();
  if (!db) return;
  const { agentPaymentMethods } = await import("../drizzle/schema");
  // Unset all preferred for this agent, then set the chosen one
  await db.update(agentPaymentMethods).set({ isPreferred: false })
    .where(eq(agentPaymentMethods.traineeCode, traineeCode));
  await db.update(agentPaymentMethods).set({ isPreferred: true })
    .where(eq(agentPaymentMethods.id, id));
}

export async function addPaymentMethodComment(id: number, comment: string) {
  const db = await getDb();
  if (!db) return;
  const { agentPaymentMethods } = await import("../drizzle/schema");
  await db.update(agentPaymentMethods).set({ adminComment: comment }).where(eq(agentPaymentMethods.id, id));
}

export async function deletePaymentMethod(id: number) {
  const db = await getDb();
  if (!db) return;
  const { agentPaymentMethods } = await import("../drizzle/schema");
  await db.delete(agentPaymentMethods).where(eq(agentPaymentMethods.id, id));
}

// ─── Agent Documents ──────────────────────────────────────────────────────────

export async function getDocumentsByCode(traineeCode: string) {
  const db = await getDb();
  if (!db) return [];
  const { agentDocuments } = await import("../drizzle/schema");
  return db.select().from(agentDocuments)
    .where(eq(agentDocuments.traineeCode, traineeCode))
    .orderBy(agentDocuments.docType);
}

export async function listAllDocuments() {
  const db = await getDb();
  if (!db) return [];
  const { agentDocuments } = await import("../drizzle/schema");
  return db.select().from(agentDocuments).orderBy(agentDocuments.traineeCode, agentDocuments.docType);
}

export async function upsertAgentDocument(data: {
  id?: number; traineeCode: string; docType: string; fileUrl: string; fileName?: string;
}) {
  const db = await getDb();
  if (!db) return;
  const { agentDocuments } = await import("../drizzle/schema");
  if (data.id) {
    await db.update(agentDocuments).set({ fileUrl: data.fileUrl, fileName: data.fileName ?? null, status: "pending", adminComment: null })
      .where(eq(agentDocuments.id, data.id));
  } else {
    await db.insert(agentDocuments).values({ ...data, status: "pending" });
  }
}

export async function reviewAgentDocument(id: number, status: "approved" | "rejected", adminComment?: string) {
  const db = await getDb();
  if (!db) return;
  const { agentDocuments } = await import("../drizzle/schema");
  await db.update(agentDocuments).set({ status, adminComment: adminComment ?? null }).where(eq(agentDocuments.id, id));
}

// ─── Schedule Change Requests ─────────────────────────────────────────────────

export async function createScheduleChangeRequest(data: {
  requesterCode: string; targetCode: string;
  requesterNewOff1?: number; requesterNewOff2?: number;
  targetNewOff1?: number; targetNewOff2?: number; message?: string;
}) {
  const db = await getDb();
  if (!db) return;
  const { scheduleChangeRequests } = await import("../drizzle/schema");
  await db.insert(scheduleChangeRequests).values({ ...data, status: "pending_peer" });
}

export async function listScheduleChangeRequestsByCode(traineeCode: string) {
  const db = await getDb();
  if (!db) return [];
  const { scheduleChangeRequests } = await import("../drizzle/schema");
  return db.select().from(scheduleChangeRequests)
    .where(sql`${scheduleChangeRequests.requesterCode} = ${traineeCode} OR ${scheduleChangeRequests.targetCode} = ${traineeCode}`)
    .orderBy(desc(scheduleChangeRequests.createdAt));
}

export async function listAllScheduleChangeRequests() {
  const db = await getDb();
  if (!db) return [];
  const { scheduleChangeRequests, workforceAgents } = await import("../drizzle/schema");
  const reqs = await db.select().from(scheduleChangeRequests).orderBy(desc(scheduleChangeRequests.createdAt));
  if (!reqs.length) return reqs;
  // Attach requester/target name, alias and CRDTS (matched by code = traineeCode)
  const agents = await db.select({
    traineeCode: workforceAgents.traineeCode,
    fullName: workforceAgents.fullName,
    alias: workforceAgents.alias,
    crdts: workforceAgents.crdts,
  }).from(workforceAgents);
  const byCode: Record<string, { fullName: string | null; alias: string | null; crdts: string | null }> = {};
  for (const a of agents) { if (a.traineeCode) byCode[a.traineeCode] = { fullName: a.fullName, alias: a.alias, crdts: a.crdts }; }
  return reqs.map((r) => ({
    ...r,
    requesterName: byCode[r.requesterCode]?.fullName ?? null,
    requesterAlias: byCode[r.requesterCode]?.alias ?? null,
    requesterCrdts: byCode[r.requesterCode]?.crdts ?? null,
    targetName: byCode[r.targetCode]?.fullName ?? null,
    targetAlias: byCode[r.targetCode]?.alias ?? null,
    targetCrdts: byCode[r.targetCode]?.crdts ?? null,
  }));
}

export async function updateScheduleChangeRequest(id: number, data: Partial<{
  status: "pending_peer" | "pending_manager" | "approved" | "rejected";
  peerApprovedAt: number; managerApprovedAt: number; managerComment: string;
}>) {
  const db = await getDb();
  if (!db) return;
  const { scheduleChangeRequests } = await import("../drizzle/schema");
  await db.update(scheduleChangeRequests).set(data).where(eq(scheduleChangeRequests.id, id));
}

// ─── Overtime Availability ────────────────────────────────────────────────────

export async function upsertOvertimeAvailability(data: {
  traineeCode: string; campaignId: number; date: string; status: "available" | "unavailable";
}) {
  const db = await getDb();
  if (!db) return;
  const { overtimeAvailability } = await import("../drizzle/schema");
  // Delete existing entry for same agent+date, then insert
  await db.delete(overtimeAvailability)
    .where(and(eq(overtimeAvailability.traineeCode, data.traineeCode), eq(overtimeAvailability.date, data.date)));
  await db.insert(overtimeAvailability).values(data);
}

export async function getOvertimeAvailabilityForDate(campaignId: number, date: string) {
  const db = await getDb();
  if (!db) return [];
  const { overtimeAvailability } = await import("../drizzle/schema");
  return db.select().from(overtimeAvailability)
    .where(and(eq(overtimeAvailability.campaignId, campaignId), eq(overtimeAvailability.date, date)));
}

// ─── Headcount Forecast ───────────────────────────────────────────────────────
// Returns projected logged-in count for each day in the next 30 days for a campaign.
// Logic: total active agents - agents with approved leave/sick_note/day_off on that date.

export async function getHeadcountForecast(campaignId: number, days = 30) {
  const db = await getDb();
  if (!db) return [];
  const { workforceAgents, agentRequests } = await import("../drizzle/schema");

  // Get all active agents in this campaign
  const agents = await db.select({
    traineeCode: workforceAgents.traineeCode,
    offDay1: workforceAgents.offDay1,
    offDay2: workforceAgents.offDay2,
  }).from(workforceAgents)
    .where(and(eq(workforceAgents.campaignId, campaignId), eq(workforceAgents.isActive, true)));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const forecast: { date: string; dayOfWeek: number; scheduled: number; approvedLeaves: number; projected: number }[] = [];

  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dow = d.getDay(); // 0=Sun, 6=Sat
    const dateStr = d.toISOString().slice(0, 10);

    // Agents scheduled to work this day (not their fixed off day)
    const scheduled = agents.filter(a => a.offDay1 !== dow && a.offDay2 !== dow).length;

    // Count approved leave/sick_note/day_off requests for this date
    const approvedRequests = await db.select({ id: agentRequests.id })
      .from(agentRequests)
      .where(and(
        eq(agentRequests.status, "resolved"),
        sql`${agentRequests.requestedDates} LIKE ${`%${dateStr}%`}`
      ));

    const approvedLeaves = approvedRequests.length;
    forecast.push({ date: dateStr, dayOfWeek: dow, scheduled, approvedLeaves, projected: Math.max(0, scheduled - approvedLeaves) });
  }
  return forecast;
}


// ─── Agent Comments ───────────────────────────────────────────────────────────
export async function getCommentsByCode(traineeCode: string) {
  const db = await getDb();
  if (!db) return [];
  const { agentComments } = await import("../drizzle/schema");
  return db.select().from(agentComments)
    .where(eq(agentComments.traineeCode, traineeCode))
    .orderBy(desc(agentComments.createdAt));
}

export async function addAgentComment(data: {
  traineeCode: string;
  adminName: string;
  content: string;
  tag: "note" | "warning" | "resolved";
}) {
  const db = await getDb();
  if (!db) return null;
  const { agentComments } = await import("../drizzle/schema");
  const [result] = await db.insert(agentComments).values(data);
  return result;
}

export async function deleteAgentComment(id: number) {
  const db = await getDb();
  if (!db) return;
  const { agentComments } = await import("../drizzle/schema");
  await db.delete(agentComments).where(eq(agentComments.id, id));
}

// ─── Payroll (Excel Upload) ───────────────────────────────────────────────────
export async function upsertPayrollFromExcel(rows: Array<{
  agentCode: string;
  agentName: string;
  baseSalary: number | null;
  workingHours: number | null;
  overtimeHours: number | null;
  commission: number | null;
  deductions: number | null;
  netPay: number | null;
  month: string; // YYYY-MM
  uploadedBy: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { payrollRecords, workforceAgents } = await import("../drizzle/schema");
  const uploadedAt = Date.now();
  const results: Array<{ agentCode: string; status: "ok" | "not_found" }> = [];

  for (const row of rows) {
    // Resolve candidateId from workforceAgents by traineeCode
    const [wa] = await db.select({ candidateId: workforceAgents.candidateId })
      .from(workforceAgents)
      .where(eq(workforceAgents.traineeCode, row.agentCode))
      .limit(1);

    const candidateId = wa?.candidateId ?? 0;

    const existing = await db.select({ id: payrollRecords.id })
      .from(payrollRecords)
      .where(and(eq(payrollRecords.agentCode, row.agentCode), eq(payrollRecords.month, row.month)))
      .limit(1);

    const values = {
      agentCode: row.agentCode,
      month: row.month,
      candidateId,
      baseSalary: row.baseSalary != null ? String(row.baseSalary) : null,
      workingHours: row.workingHours != null ? String(row.workingHours) : null,
      overtimeHours: row.overtimeHours != null ? String(row.overtimeHours) : null,
      commission: row.commission != null ? String(row.commission) : "0",
      deductions: row.deductions != null ? String(row.deductions) : "0",
      netPay: row.netPay != null ? String(row.netPay) : null,
      uploadedBy: row.uploadedBy,
      uploadedAt,
    };

    if (existing[0]) {
      await db.update(payrollRecords).set(values).where(eq(payrollRecords.id, existing[0].id));
    } else {
      await db.insert(payrollRecords).values({ ...values });
    }
    results.push({ agentCode: row.agentCode, status: "ok" });
  }
  return results;
}

export async function getPayrollMonths(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const { payrollRecords } = await import("../drizzle/schema");
  const rows = await db.selectDistinct({ month: payrollRecords.month })
    .from(payrollRecords)
    .where(sql`agentCode IS NOT NULL`)
    .orderBy(desc(payrollRecords.month));
  return rows.map(r => r.month);
}

export async function getPayrollByMonth(month: string) {
  const db = await getDb();
  if (!db) return [];
  const { payrollRecords } = await import("../drizzle/schema");
  return db.select().from(payrollRecords)
    .where(and(eq(payrollRecords.month, month), sql`agentCode IS NOT NULL`))
    .orderBy(payrollRecords.agentCode);
}

export async function getPayrollByAgentCode(agentCode: string) {
  const db = await getDb();
  if (!db) return [];
  const { payrollRecords } = await import("../drizzle/schema");
  return db.select().from(payrollRecords)
    .where(and(eq(payrollRecords.agentCode, agentCode), sql`agentCode IS NOT NULL`))
    .orderBy(desc(payrollRecords.month));
}

export async function getPayrollMonthsByAgentCode(agentCode: string): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const { payrollRecords } = await import("../drizzle/schema");
  const rows = await db.selectDistinct({ month: payrollRecords.month })
    .from(payrollRecords)
    .where(and(eq(payrollRecords.agentCode, agentCode), sql`agentCode IS NOT NULL`))
    .orderBy(desc(payrollRecords.month));
  return rows.map(r => r.month);
}

// ─── Break Schedules ──────────────────────────────────────────────────────────
/**
 * Replace all break slots for a given agent+date.
 * Deletes existing entries for that date, then inserts the new set.
 */
export async function replaceBreaksForDate(
  agentCode: string,
  date: string,
  slots: Array<{ breakStart: string; breakEnd: string }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { breakSchedules } = await import("../drizzle/schema");
  await db.delete(breakSchedules)
    .where(and(eq(breakSchedules.agentCode, agentCode), eq(breakSchedules.date, date)));
  if (slots.length > 0) {
    await db.insert(breakSchedules).values(
      slots.map((s, i) => ({ agentCode, date, breakIndex: i, breakStart: s.breakStart, breakEnd: s.breakEnd }))
    );
  }
}

/**
 * Bulk replace breaks for multiple agent+date combinations.
 */
export async function bulkReplaceBreaks(entries: Array<{
  agentCode: string;
  date: string;
  slots: Array<{ breakStart: string; breakEnd: string }>;
}>) {
  for (const entry of entries) {
    await replaceBreaksForDate(entry.agentCode, entry.date, entry.slots);
  }
  return { count: entries.length };
}

export async function getBreakSchedulesByAgent(agentCode: string, startDate: string, endDate: string) {
  const db = await getDb();
  if (!db) return [];
  const { breakSchedules } = await import("../drizzle/schema");
  return db.select().from(breakSchedules)
    .where(and(
      eq(breakSchedules.agentCode, agentCode),
      sql`date >= ${startDate}`,
      sql`date <= ${endDate}`
    ))
    .orderBy(breakSchedules.date);
}

export async function getBreakSchedulesByDateRange(startDate: string, endDate: string) {
  const db = await getDb();
  if (!db) return [];
  const { breakSchedules } = await import("../drizzle/schema");
  return db.select().from(breakSchedules)
    .where(and(sql`date >= ${startDate}`, sql`date <= ${endDate}`))
    .orderBy(breakSchedules.agentCode, breakSchedules.date);
}

export async function deleteBreakSchedule(agentCode: string, date: string) {
  const db = await getDb();
  if (!db) return;
  const { breakSchedules } = await import("../drizzle/schema");
  await db.delete(breakSchedules)
    .where(and(eq(breakSchedules.agentCode, agentCode), eq(breakSchedules.date, date)));
}

export async function getAgentRequestById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(agentRequests).where(eq(agentRequests.id, id)).limit(1);
  return rows[0] ?? null;
}

// ─── Payroll v2 Helpers (Python-output, CRDTS-matched) ────────────────────────
export async function upsertPayrollRecordV2(data: {
  crdts: string; alias?: string; agentCode?: string; month: string;
  baseSalary?: number; workingHours?: number;
  ot1x5Hours?: number; ot1x5Pay?: number;
  ot2xHours?: number; ot2xPay?: number;
  ot3xHours?: number; ot3xPay?: number;
  coachingBonus?: number;
  commissionEgp?: number; qualityDeductions?: number; attendanceDeductions?: number;
  totalDeductions?: number; netPay?: number;
  qualityDetail?: string; attendanceDetail?: string;
  uploadedBy?: string; uploadedAt?: number;
}) {
  const db = await getDb();
  if (!db) return;
  const { payrollRecords } = await import("../drizzle/schema");
  // Try to find existing record by crdts + month
  const existing = await db.select({ id: payrollRecords.id })
    .from(payrollRecords)
    .where(and(eq(payrollRecords.crdts, data.crdts), eq(payrollRecords.month, data.month)))
    .limit(1);
  const toStr = (v?: number) => v != null ? String(v) : null;
  const vals = {
    crdts: data.crdts,
    alias: data.alias,
    agentCode: data.agentCode,
    month: data.month,
    baseSalary: toStr(data.baseSalary),
    workingHours: toStr(data.workingHours),
    ot1x5Hours: toStr(data.ot1x5Hours),
    ot1x5Pay: toStr(data.ot1x5Pay),
    ot2xHours: toStr(data.ot2xHours),
    ot2xPay: toStr(data.ot2xPay),
    ot3xHours: toStr(data.ot3xHours),
    ot3xPay: toStr(data.ot3xPay),
    coachingBonus: toStr(data.coachingBonus),
    commissionEgp: toStr(data.commissionEgp),
    qualityDeductions: toStr(data.qualityDeductions),
    attendanceDeductions: toStr(data.attendanceDeductions),
    totalDeductions: toStr(data.totalDeductions),
    netPay: toStr(data.netPay),
    qualityDetail: data.qualityDetail,
    attendanceDetail: data.attendanceDetail,
    uploadedBy: data.uploadedBy,
    uploadedAt: data.uploadedAt,
  };
  if (existing.length > 0) {
    await db.update(payrollRecords).set(vals)
      .where(and(eq(payrollRecords.crdts, data.crdts), eq(payrollRecords.month, data.month)));
  } else {
    await db.insert(payrollRecords).values({ ...vals, candidateId: null });
  }
}

export async function getPayrollStatusPage(month: string) {
  const db = await getDb();
  if (!db) return [];
  const { payrollRecords, workforceAgents } = await import("../drizzle/schema");
  const rows = await db.select({
    id: payrollRecords.id,
    crdts: payrollRecords.crdts,
    alias: payrollRecords.alias,
    agentCode: payrollRecords.agentCode,
    baseSalary: payrollRecords.baseSalary,
    workingHours: payrollRecords.workingHours,
    ot1x5Hours: payrollRecords.ot1x5Hours,
    ot1x5Pay: payrollRecords.ot1x5Pay,
    ot2xHours: payrollRecords.ot2xHours,
    ot2xPay: payrollRecords.ot2xPay,
    ot3xHours: payrollRecords.ot3xHours,
    ot3xPay: payrollRecords.ot3xPay,
    coachingBonus: payrollRecords.coachingBonus,
    qualityDeductions: payrollRecords.qualityDeductions,
    attendanceDeductions: payrollRecords.attendanceDeductions,
    totalDeductions: payrollRecords.totalDeductions,
    netPay: payrollRecords.netPay,
    commissionEgp: payrollRecords.commissionEgp,
    qualityDetail: payrollRecords.qualityDetail,
    attendanceDetail: payrollRecords.attendanceDetail,
    paymentStatus: payrollRecords.paymentStatus,
    paidAt: payrollRecords.paidAt,
    month: payrollRecords.month,
    uploadedBy: payrollRecords.uploadedBy,
    uploadedAt: payrollRecords.uploadedAt,
    traineeCode: workforceAgents.traineeCode,
    agentStatus: workforceAgents.agentStatus,
    fullName: workforceAgents.fullName,
  })
  .from(payrollRecords)
  .leftJoin(workforceAgents, eq(payrollRecords.crdts, workforceAgents.crdts))
  .where(eq(payrollRecords.month, month));
  // attach any pending (scheduled, not-yet-effective) separation so Payroll can
  // label leavers — useful because money may still be owed after they go.
  const { agentSeparations: sepT } = await import("../drizzle/schema");
  const pend = await db.select({ agentCode: sepT.agentCode, effectiveAt: sepT.effectiveAt, lastWorkingDay: sepT.lastWorkingDay })
    .from(sepT).where(isNull(sepT.appliedAt));
  const pendMap = new Map(pend.map(p => [p.agentCode, p]));
  // Attach manual adjustments (bonuses / deductions) so the admin status view can
  // fold them into each agent's adjusted total. Keyed by primary CRDTS.
  const { payrollAdjustments: adjT } = await import("../drizzle/schema");
  const allAdj = await db.select().from(adjT).where(eq(adjT.month, month));
  const adjByCrdts = new Map<string, Array<typeof allAdj[number]>>();
  for (const a of allAdj) {
    const k = String(a.crdts).split(",")[0].trim();
    if (!adjByCrdts.has(k)) adjByCrdts.set(k, []);
    adjByCrdts.get(k)!.push(a);
  }
  return rows.map(r => {
    const primary = String(r.crdts ?? "").split(",")[0].trim();
    return {
      ...r,
      pendingLeave: r.traineeCode ? (pendMap.get(r.traineeCode) ?? null) : null,
      adjustments: adjByCrdts.get(primary) ?? [],
    };
  });
}

export async function setPayrollStatus(id: number, status: "pending" | "paid") {
  const db = await getDb();
  if (!db) return;
  const { payrollRecords } = await import("../drizzle/schema");
  await db.update(payrollRecords).set({
    paymentStatus: status,
    paidAt: status === "paid" ? Date.now() : null,
  }).where(eq(payrollRecords.id, id));
}

export async function getMyPayrollRecordByCrdts(crdts: string, month: string) {
  const db = await getDb();
  if (!db) return null;
  const { payrollRecords, payrollAdjustments } = await import("../drizzle/schema");
  const rows = await db.select().from(payrollRecords)
    .where(and(eq(payrollRecords.crdts, crdts), eq(payrollRecords.month, month)))
    .limit(1);
  const record = rows[0] ?? null;
  if (!record) return null;
  // Attach this agent's manual adjustments (bonuses / deductions) for the pay cycle.
  // Match on the full CRDTS string OR its primary part, so a record stored as
  // "114071,114032" still picks up an adjustment saved under "114071".
  const crdtsCandidates = Array.from(new Set([crdts, String(crdts).split(",")[0].trim()].filter(Boolean)));
  const { inArray: inArrayOp } = await import("drizzle-orm");
  const adjustments = await db.select().from(payrollAdjustments)
    .where(and(inArrayOp(payrollAdjustments.crdts, crdtsCandidates), eq(payrollAdjustments.month, month)));
  return { ...record, adjustments };
}

export async function getMyPayrollMonthsByCrdts(crdts: string) {
  const db = await getDb();
  if (!db) return [];
  const { payrollRecords } = await import("../drizzle/schema");
  const rows = await db.selectDistinct({ month: payrollRecords.month })
    .from(payrollRecords)
    .where(eq(payrollRecords.crdts, crdts))
    .orderBy(desc(payrollRecords.month));
  return rows.map(r => r.month);
}

// ─── Orientation Helpers ──────────────────────────────────────────────────────
export async function markOrientationShown(traineeCode: string) {
  const db = await getDb();
  if (!db) return;
  const { workforceAgents } = await import("../drizzle/schema");
  await db.update(workforceAgents).set({ orientationShown: true })
    .where(eq(workforceAgents.traineeCode, traineeCode));
}

export async function resetOrientation(traineeCode: string) {
  const db = await getDb();
  if (!db) return;
  const { workforceAgents } = await import("../drizzle/schema");
  await db.update(workforceAgents).set({ orientationShown: false })
    .where(eq(workforceAgents.traineeCode, traineeCode));
}

// ─── Violations Helpers ───────────────────────────────────────────────────────
export async function bulkInsertViolations(rows: Array<{
  agentCode: string; crdts?: string; date: string; type: string;
  category: "attendance" | "quality"; hours?: number; deduction?: number;
  description?: string; month?: string; uploadedAt?: number; uploadedBy?: string;
}>) {
  const db = await getDb();
  if (!db) return;
  const { agentViolations } = await import("../drizzle/schema");
  if (rows.length === 0) return;
  const now = Date.now();
  for (const r of rows) {
    const vals = {
      agentCode: r.agentCode,
      crdts: r.crdts,
      date: r.date,
      type: r.type,
      category: r.category,
      status: "approved" as const,
      hours: r.hours != null ? String(r.hours) : null,
      deduction: r.deduction != null ? String(r.deduction) : null,
      description: r.description,
      month: r.month,
      uploadedAt: r.uploadedAt ?? now,
      uploadedBy: r.uploadedBy,
    };
    await db.insert(agentViolations).values(vals).onDuplicateKeyUpdate({
      set: {
        crdts: vals.crdts,
        category: vals.category,
        hours: vals.hours,
        deduction: vals.deduction,
        description: vals.description,
        month: vals.month,
        uploadedAt: vals.uploadedAt,
      }
    });
  }
}

export async function listViolations(filters: { agentCode?: string; crdts?: string; month?: string; category?: "attendance" | "quality" }) {
  const db = await getDb();
  if (!db) return [];
  const { agentViolations } = await import("../drizzle/schema");
  let q = db.select().from(agentViolations).$dynamic();
  const conditions = [];
  // Identity match: violations may be keyed under CRDTS or traineeCode inconsistently,
  // so match ANY provided id against EITHER column.
  const ids = [filters.crdts, filters.agentCode].filter((x): x is string => !!x);
  if (ids.length) {
    conditions.push(or(inArray(agentViolations.crdts, ids), inArray(agentViolations.agentCode, ids)));
  }
  if (filters.month) conditions.push(eq(agentViolations.month, filters.month));
  if (filters.category) conditions.push(eq(agentViolations.category, filters.category));
  if (conditions.length > 0) q = q.where(and(...conditions));
  return q.orderBy(desc(agentViolations.createdAt));
}

export async function getMyViolations(agentCode: string, month?: string) {
  const db = await getDb();
  if (!db) return [];
  const { agentViolations } = await import("../drizzle/schema");
  const conditions = [eq(agentViolations.agentCode, agentCode)];
  if (month) conditions.push(eq(agentViolations.month, month));
  return db.select().from(agentViolations)
    .where(and(...conditions))
    .orderBy(desc(agentViolations.createdAt));
}

// ─── Agent Performance Helpers ────────────────────────────────────────────────
export async function bulkUpsertPerformance(rows: Array<{
  crdts: string; alias?: string; agentCode?: string; month: string;
  loginHours?: number; revenue?: number; cost?: number; profit?: number; revPerHour?: number;
  uploadedBy?: string; uploadedAt?: number;
}>) {
  const db = await getDb();
  if (!db) return;
  const { agentPerformance } = await import("../drizzle/schema");
  for (const row of rows) {
    const existing = await db.select({ id: agentPerformance.id })
      .from(agentPerformance)
      .where(and(eq(agentPerformance.crdts, row.crdts), eq(agentPerformance.month, row.month)))
      .limit(1);
    const rowStr = {
        ...row,
        loginHours: row.loginHours != null ? String(row.loginHours) : null,
        revenue: row.revenue != null ? String(row.revenue) : null,
        cost: row.cost != null ? String(row.cost) : null,
        profit: row.profit != null ? String(row.profit) : null,
        revPerHour: row.revPerHour != null ? String(row.revPerHour) : null,
      };
      if (existing.length > 0) {
        await db.update(agentPerformance).set(rowStr)
          .where(and(eq(agentPerformance.crdts, row.crdts), eq(agentPerformance.month, row.month)));
      } else {
        await db.insert(agentPerformance).values(rowStr);
      }
  }
}

export async function getPerformanceByMonth(month: string) {
  const db = await getDb();
  if (!db) return [];
  const { agentPerformance } = await import("../drizzle/schema");
  return db.select().from(agentPerformance)
    .where(eq(agentPerformance.month, month))
    .orderBy(agentPerformance.alias);
}

export async function getPerformanceMonths() {
  const db = await getDb();
  if (!db) return [];
  const { agentPerformance } = await import("../drizzle/schema");
  const rows = await db.selectDistinct({ month: agentPerformance.month })
    .from(agentPerformance).orderBy(desc(agentPerformance.month));
  return rows.map(r => r.month);
}

// ─── Adherence Log Helpers ────────────────────────────────────────────────────
export async function bulkInsertAdherence(rows: Array<{
  agentCode?: string; crdts?: string; alias?: string; date: string; month?: string;
  type: string; hours?: number; deduction?: number; notes?: string;
  uploadedBy?: string; uploadedAt?: number;
}>) {
  const db = await getDb();
  if (!db) return;
  const { adherenceLog } = await import("../drizzle/schema");
  if (rows.length === 0) return;
  const now = Date.now();
  for (const r of rows) {
    const vals = {
      agentCode: r.agentCode,
      crdts: r.crdts,
      alias: r.alias,
      date: r.date,
      month: r.month,
      type: r.type,
      status: "approved" as const,
      hours: r.hours != null ? String(r.hours) : null,
      deduction: r.deduction != null ? String(r.deduction) : null,
      notes: r.notes,
      uploadedBy: r.uploadedBy,
      uploadedAt: r.uploadedAt ?? now,
    };
    await db.insert(adherenceLog).values(vals).onDuplicateKeyUpdate({
      set: {
        crdts: vals.crdts,
        alias: vals.alias,
        month: vals.month,
        hours: vals.hours,
        deduction: vals.deduction,
        notes: vals.notes,
        uploadedAt: vals.uploadedAt,
      }
    });
  }
}

export async function listAdherence(filters: { agentCode?: string; month?: string }) {
  const db = await getDb();
  if (!db) return [];
  const { adherenceLog } = await import("../drizzle/schema");
  let q = db.select().from(adherenceLog).$dynamic();
  const conditions = [];
  if (filters.agentCode) conditions.push(eq(adherenceLog.agentCode, filters.agentCode));
  if (filters.month) conditions.push(eq(adherenceLog.month, filters.month));
  if (conditions.length > 0) q = q.where(and(...conditions));
  return q.orderBy(desc(adherenceLog.createdAt));
}

export async function getAdherenceMonths() {
  const db = await getDb();
  if (!db) return [];
  const { adherenceLog } = await import("../drizzle/schema");
  const rows = await db.selectDistinct({ month: adherenceLog.month })
    .from(adherenceLog).orderBy(desc(adherenceLog.month));
  return rows.map(r => r.month).filter(Boolean) as string[];
}

// ─── Quality Log Helpers ──────────────────────────────────────────────────────
export async function bulkInsertQuality(rows: Array<{
  agentCode?: string; crdts?: string; alias?: string; date: string; month?: string;
  type: string; score?: number; penalty?: number; notes?: string;
  uploadedBy?: string; uploadedAt?: number;
}>) {
  const db = await getDb();
  if (!db) return;
  const { qualityLog } = await import("../drizzle/schema");
  if (rows.length === 0) return;
  const now = Date.now();
  for (const r of rows) {
    const vals = {
      agentCode: r.agentCode,
      crdts: r.crdts,
      alias: r.alias,
      date: r.date,
      month: r.month,
      type: r.type,
      score: r.score != null ? String(r.score) : null,
      penalty: r.penalty != null ? String(r.penalty) : null,
      notes: r.notes,
      uploadedBy: r.uploadedBy,
      uploadedAt: r.uploadedAt ?? now,
    };
    await db.insert(qualityLog).values(vals).onDuplicateKeyUpdate({
      set: {
        crdts: vals.crdts,
        alias: vals.alias,
        month: vals.month,
        score: vals.score,
        penalty: vals.penalty,
        notes: vals.notes,
        uploadedAt: vals.uploadedAt,
      }
    });
  }
}

export async function listQuality(filters: { agentCode?: string; month?: string }) {
  const db = await getDb();
  if (!db) return [];
  const { qualityLog } = await import("../drizzle/schema");
  let q = db.select().from(qualityLog).$dynamic();
  const conditions = [];
  if (filters.agentCode) conditions.push(eq(qualityLog.agentCode, filters.agentCode));
  if (filters.month) conditions.push(eq(qualityLog.month, filters.month));
  if (conditions.length > 0) q = q.where(and(...conditions));
  return q.orderBy(desc(qualityLog.createdAt));
}

export async function getQualityMonths() {
  const db = await getDb();
  if (!db) return [];
  const { qualityLog } = await import("../drizzle/schema");
  const rows = await db.selectDistinct({ month: qualityLog.month })
    .from(qualityLog).orderBy(desc(qualityLog.month));
  return rows.map(r => r.month).filter(Boolean) as string[];
}

export async function getOrientationStatus(traineeCode: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return true;
  const { workforceAgents } = await import("../drizzle/schema");
  const agent = await db
    .select({ orientationShown: workforceAgents.orientationShown })
    .from(workforceAgents)
    .where(eq(workforceAgents.traineeCode, traineeCode))
    .limit(1);
  return !!(agent[0]?.orientationShown);
}

// ─── Cycle Tracker Helpers ────────────────────────────────────────────────────
/** Returns the current cycle key (YYYY-MM) based on today's date.
 *  Cycle runs from 26th of previous month to 25th of current month.
 *  If today >= 26, cycle key = current month. If today <= 25, cycle key = current month.
 *  e.g. May 13 → cycle key "2026-05" (26 Apr – 25 May)
 *       May 26 → cycle key "2026-06" (26 May – 25 Jun)
 */
export function getCurrentCycleKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  const day = now.getDate();
  // If today is 26th or later, the cycle belongs to next month
  if (day >= 26) {
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

// Compute the cycle key (YYYY-MM) a given DATE belongs to, using the 26th→25th
// rule. A date on the 26th or later belongs to the NEXT month's cycle.
// This files each record into the cycle its own date falls in — unlike
// getCurrentCycleKey(), which is based on "now" and is only correct for
// same-day uploads.
export function getCycleKeyForDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) throw new Error(`Invalid date: ${dateStr}`);
  const base = d.getDate() >= 26 ? new Date(d.getFullYear(), d.getMonth() + 1, 1) : d;
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}`;
}

export function getCycleDateRange(cycleKey: string): { start: string; end: string } {
  const [yearStr, monthStr] = cycleKey.split("-");
  const year = parseInt(yearStr);
  const month = parseInt(monthStr); // 1-12
  // Cycle starts on 26th of previous month
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const start = `${prevYear}-${String(prevMonth).padStart(2, "0")}-26`;
  const end = `${year}-${String(month).padStart(2, "0")}-25`;
  return { start, end };
}

export async function upsertCycleStats(rows: Array<{
  crdts: string; agentCode?: string; alias?: string;
  date: string; cycleKey: string;
  loginHours: number; totalCalls: number; revenue: number; cost: number; profit: number; revPerHr?: number;
}>) {
  const db = await getDb();
  if (!db || rows.length === 0) return;
  const now = Date.now();
  for (const row of rows) {
    await db.insert(cycleStats).values({
      crdts: row.crdts,
      agentCode: row.agentCode,
      alias: row.alias,
      date: row.date,
      cycleKey: row.cycleKey,
      loginHours: String(row.loginHours),
      totalCalls: row.totalCalls,
      revenue: String(row.revenue),
      cost: String(row.cost),
      profit: String(row.profit),
      revPerHr: String(row.revPerHr ?? 0),
      uploadedAt: now,
    }).onDuplicateKeyUpdate({
      set: {
        agentCode: row.agentCode,
        alias: row.alias,
        loginHours: String(row.loginHours),
        totalCalls: row.totalCalls,
        revenue: String(row.revenue),
        cost: String(row.cost),
        profit: String(row.profit),
        revPerHr: String(row.revPerHr ?? 0),
        uploadedAt: now,
      }
    });
  }
}

export async function upsertCycleDeductions(rows: Array<{
  crdts: string; agentCode?: string; alias?: string;
  date: string; cycleKey: string;
  violationType: string; hours: number; deductionAmount: number;
  status: "approved" | "rejected";
}>) {
  const db = await getDb();
  if (!db || rows.length === 0) return;
  const now = Date.now();
  for (const row of rows) {
    await db.insert(cycleDeductions).values({
      crdts: row.crdts,
      agentCode: row.agentCode,
      alias: row.alias,
      date: row.date,
      cycleKey: row.cycleKey,
      violationType: row.violationType,
      hours: String(row.hours),
      deductionAmount: String(row.deductionAmount),
      status: row.status,
      uploadedAt: now,
    }).onDuplicateKeyUpdate({
      set: {
        agentCode: row.agentCode,
        alias: row.alias,
        hours: String(row.hours),
        deductionAmount: String(row.deductionAmount),
        status: row.status,
        uploadedAt: now,
      }
    });
  }
}

export async function upsertCycleOT(rows: Array<{
  crdts: string; agentCode?: string; alias?: string;
  date: string; cycleKey: string;
  otType: string; hours: number; egpAmount: number;
}>) {
  const db = await getDb();
  if (!db || rows.length === 0) return;
  const now = Date.now();
  for (const row of rows) {
    await db.insert(cycleOT).values({
      crdts: row.crdts,
      agentCode: row.agentCode,
      alias: row.alias,
      date: row.date,
      cycleKey: row.cycleKey,
      otType: row.otType,
      hours: String(row.hours),
      egpAmount: String(row.egpAmount),
      uploadedAt: now,
    }).onDuplicateKeyUpdate({
      set: {
        agentCode: row.agentCode,
        alias: row.alias,
        hours: String(row.hours),
        egpAmount: String(row.egpAmount),
        uploadedAt: now,
      }
    });
  }
}

export async function getCycleTrackerForAgent(crdts: string, cycleKey: string) {
  const db = await getDb();
  if (!db) return { stats: [], deductions: [], ot: [] };
  const crdtsList = String(crdts).split(",").map(x => x.trim()).filter(Boolean);
  if (!crdtsList.length) return { stats: [], todayStats: [], deductions: [], ot: [] };
  const today = new Date().toISOString().slice(0, 10);
  const [stats, deductions, ot] = await Promise.all([
    db.select().from(cycleStats)
      .where(and(inArray(cycleStats.crdts, crdtsList), eq(cycleStats.cycleKey, cycleKey)))
      .orderBy(cycleStats.date),
    db.select().from(cycleDeductions)
      .where(and(
        inArray(cycleDeductions.crdts, crdtsList),
        eq(cycleDeductions.cycleKey, cycleKey),
        eq(cycleDeductions.status, "approved")
      ))
      .orderBy(cycleDeductions.date),
    db.select().from(cycleOT)
      .where(and(inArray(cycleOT.crdts, crdtsList), eq(cycleOT.cycleKey, cycleKey)))
      .orderBy(cycleOT.date),
  ]);
  // Today's stats (latest row for today)
  const todayStats = stats.filter(s => s.date === today);
  return { stats, todayStats, deductions, ot };
}

export async function getTurnoverRate(): Promise<{ rate: number; separationsThisMonth: number; currentHeadcount: number }> {
  const db = await getDb();
  const { agentSeparations, workforceAgents } = await import("../drizzle/schema");
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  if (!db) return { rate: 0, separationsThisMonth: 0, currentHeadcount: 0 };
  const [separationsResult, headcountResult] = await Promise.all([
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(agentSeparations).where(gte(agentSeparations.effectiveAt, monthStart)),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(workforceAgents).where(eq(workforceAgents.agentStatus, "active")),
  ]);

  const separationsThisMonth = Number(separationsResult[0]?.count ?? 0);
  const currentHeadcount = Number(headcountResult[0]?.count ?? 0);
  const avgHeadcount = currentHeadcount + separationsThisMonth / 2;
  const rate = avgHeadcount > 0 ? Math.round((separationsThisMonth / avgHeadcount) * 100 * 10) / 10 : 0;

  return { rate, separationsThisMonth, currentHeadcount };
}

// ─── Client Logouts ───────────────────────────────────────────────────────────
export async function bulkUpsertClientLogouts(rows: Array<{ crdts: string; agentCode?: string; alias?: string; date: string; cycleKey: string }>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { clientLogouts } = await import("../drizzle/schema");
  const now = Date.now();
  let inserted = 0; let updated = 0;
  for (const row of rows) {
    const existing = await db.select({ id: clientLogouts.id }).from(clientLogouts)
      .where(and(eq(clientLogouts.crdts, row.crdts), eq(clientLogouts.date, row.date))).limit(1);
    if (existing[0]) {
      await db.update(clientLogouts).set({ ...row, uploadedAt: now }).where(eq(clientLogouts.id, existing[0].id));
      updated++;
    } else {
      await db.insert(clientLogouts).values({ ...row, uploadedAt: now });
      inserted++;
    }
  }
  return { inserted, updated };
}

export async function getClientLogoutsByCycle(cycleKey: string) {
  const db = await getDb();
  if (!db) return [];
  const { clientLogouts } = await import("../drizzle/schema");
  return db.select().from(clientLogouts).where(eq(clientLogouts.cycleKey, cycleKey)).orderBy(clientLogouts.date);
}

export async function getClientLogoutsByAgent(crdts: string) {
  const db = await getDb();
  if (!db) return [];
  const { clientLogouts } = await import("../drizzle/schema");
  return db.select().from(clientLogouts).where(eq(clientLogouts.crdts, crdts)).orderBy(desc(clientLogouts.date));
}

export async function bulkUpsertAgentQualityFlags(rows: Array<{ crdts: string; agentCode?: string; alias?: string; date: string; violation?: string; score?: string; deductionEgp?: string; hours?: string; cycleKey: string }>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { agentQualityFlags } = await import("../drizzle/schema");
  const now = Date.now();
  let inserted = 0; let updated = 0;
  for (const row of rows) {
    const existing = await db.select({ id: agentQualityFlags.id }).from(agentQualityFlags)
      .where(and(eq(agentQualityFlags.crdts, row.crdts), eq(agentQualityFlags.date, row.date), eq(agentQualityFlags.violation, row.violation ?? ""))).limit(1);
    if (existing[0]) {
      await db.update(agentQualityFlags).set({ ...row, uploadedAt: now }).where(eq(agentQualityFlags.id, existing[0].id));
      updated++;
    } else {
      await db.insert(agentQualityFlags).values({ ...row, uploadedAt: now });
      inserted++;
    }
  }
  return { inserted, updated };
}
export async function getAgentQualityFlagsByAgent(crdts: string) {
  const db = await getDb();
  if (!db) return [];
  const { agentQualityFlags } = await import("../drizzle/schema");
  return db.select().from(agentQualityFlags).where(eq(agentQualityFlags.crdts, crdts)).orderBy(desc(agentQualityFlags.date));
}

// ─── Commission Month (calendar-month grouping of cycle_stats) ────────────────
export async function getCommissionMonthData(crdts: string, month: string) {
  const db = await getDb();
  if (!db) return { rows: [] as Array<Record<string, unknown>>, totals: { loginHours: 0, totalCalls: 0, revenue: 0, cost: 0, profit: 0 } };
  const { cycleStats } = await import("../drizzle/schema");
  const rows = await db.select().from(cycleStats)
    .where(and(eq(cycleStats.crdts, crdts), sql`LEFT(${cycleStats.date}, 7) = ${month}`))
    .orderBy(cycleStats.date);
  const totals = rows.reduce((acc, r) => ({
    loginHours: acc.loginHours + Number(r.loginHours ?? 0),
    totalCalls: acc.totalCalls + Number(r.totalCalls ?? 0),
    revenue: acc.revenue + Number(r.revenue ?? 0),
    cost: acc.cost + Number(r.cost ?? 0),
    profit: acc.profit + Number(r.profit ?? 0),
  }), { loginHours: 0, totalCalls: 0, revenue: 0, cost: 0, profit: 0 });
  return { rows, totals };
}

export async function getAvailableCommissionMonths(crdts: string): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const { cycleStats } = await import("../drizzle/schema");
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  // Exclude impossible future months (e.g. a mis-parsed date landing in a month that hasn't happened yet)
  const result = await db.selectDistinct({ month: sql<string>`LEFT(${cycleStats.date}, 7)` })
    .from(cycleStats)
    .where(and(eq(cycleStats.crdts, crdts), sql`LEFT(${cycleStats.date}, 7) <= ${currentMonth}`))
    .orderBy(sql`LEFT(${cycleStats.date}, 7) DESC`);
  return result.map(r => r.month);
}

// ─── Performance History (per-cycle summary for an agent) ────────────────────
export async function getAgentPerformanceHistory(crdts: string) {
  const db = await getDb();
  if (!db) return [];
  const { cycleStats } = await import("../drizzle/schema");
  const rows = await db.select({
    cycleKey: cycleStats.cycleKey,
    loginHours: sql<number>`SUM(${cycleStats.loginHours})`.mapWith(Number),
    totalCalls: sql<number>`SUM(${cycleStats.totalCalls})`.mapWith(Number),
    revenue: sql<number>`SUM(${cycleStats.revenue})`.mapWith(Number),
    cost: sql<number>`SUM(${cycleStats.cost})`.mapWith(Number),
    profit: sql<number>`SUM(${cycleStats.profit})`.mapWith(Number),
    days: sql<number>`COUNT(DISTINCT ${cycleStats.date})`.mapWith(Number),
  }).from(cycleStats).where(eq(cycleStats.crdts, crdts))
    .groupBy(cycleStats.cycleKey).orderBy(sql`${cycleStats.cycleKey} DESC`);
  return rows.map(r => ({
    ...r,
    revPerHr: r.loginHours > 0 ? Math.round((r.revenue / r.loginHours) * 100) / 100 : 0,
  }));
}

// ─── Campaign Ranking ─────────────────────────────────────────────────────────
export async function getCampaignRanking(crdts: string, cycleKey: string) {
  const db = await getDb();
  if (!db) return { rank: null as number | null, total: 0, profit: 0, revPerHr: 0, top3: [] as Array<{ rank: number; profit: number; revPerHr: number }> };
  const { cycleStats, workforceAgents, campaigns } = await import("../drizzle/schema");
  const agentRow = await db.select({ campaignId: workforceAgents.campaignId, crdts: workforceAgents.crdts })
    .from(workforceAgents).where(eq(workforceAgents.crdts, crdts)).limit(1);
  if (!agentRow[0]) return { rank: null, total: 0, profit: 0, revPerHr: 0, top3: [], campaignName: null as string | null };
  const campaignId = agentRow[0].campaignId;
  let campaignName: string | null = null;
  if (campaignId) {
    const campRow = await db.select({ name: campaigns.name }).from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);
    campaignName = campRow[0]?.name ?? null;
  }
  const campaignAgents = await db.select({ crdts: workforceAgents.crdts })
    .from(workforceAgents).where(campaignId ? eq(workforceAgents.campaignId, campaignId) : sql`1=1`);
  const campaignCrdts = campaignAgents.map(a => a.crdts).filter(Boolean) as string[];
  if (campaignCrdts.length === 0) return { rank: null, total: 0, profit: 0, revPerHr: 0, top3: [] };
  const stats = await db.select({
    crdts: cycleStats.crdts,
    profit: sql<number>`SUM(${cycleStats.profit})`.mapWith(Number),
    loginHours: sql<number>`SUM(${cycleStats.loginHours})`.mapWith(Number),
    revenue: sql<number>`SUM(${cycleStats.revenue})`.mapWith(Number),
  }).from(cycleStats)
    .where(and(eq(cycleStats.cycleKey, cycleKey), inArray(cycleStats.crdts, campaignCrdts)))
    .groupBy(cycleStats.crdts);
  const sorted = stats.map(s => ({
    crdts: s.crdts,
    profit: s.profit,
    revPerHr: s.loginHours > 0 ? Math.round((s.revenue / s.loginHours) * 100) / 100 : 0,
  })).sort((a, b) => b.profit - a.profit);
  const myIdx = sorted.findIndex(s => s.crdts === crdts);
  const myStats = sorted[myIdx] ?? { profit: 0, revPerHr: 0 };
  const top3 = sorted.slice(0, 3).map((s, i) => ({ rank: i + 1, profit: s.profit, revPerHr: s.revPerHr }));
  return {
    rank: myIdx >= 0 ? myIdx + 1 : null,
    total: sorted.length,
    profit: myStats.profit,
    revPerHr: myStats.revPerHr,
    top3,
    campaignName,
  };
}

// ─── Admin Hard Delete Agent (only after final pay confirmed) ─────────────────
export async function adminDeleteAgent(agentCode: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { workforceAgents, agentCredentials, breakSchedules, scheduleChangeRequests, overtimeAvailability } = await import("../drizzle/schema");
  await db.delete(agentCredentials).where(eq(agentCredentials.traineeCode, agentCode));
  await db.delete(breakSchedules).where(eq(breakSchedules.agentCode, agentCode));
  await db.delete(scheduleChangeRequests).where(eq(scheduleChangeRequests.requesterCode, agentCode));
  await db.delete(overtimeAvailability).where(eq(overtimeAvailability.traineeCode, agentCode));
  await db.delete(workforceAgents).where(eq(workforceAgents.traineeCode, agentCode));
}

export async function getPendingDeletionAgents() {
  const db = await getDb();
  if (!db) return [];
  const { workforceAgents } = await import("../drizzle/schema");
  const { and, eq, isNull, or } = await import("drizzle-orm");
  // Only count agents who have left AND salary is not yet settled
  return db.select({
    traineeCode: workforceAgents.traineeCode,
    fullName: workforceAgents.fullName,
    alias: workforceAgents.alias,
    agentStatus: workforceAgents.agentStatus,
    updatedAt: workforceAgents.updatedAt,
  }).from(workforceAgents)
    .where(and(
      sql`${workforceAgents.agentStatus} IN ('resigned', 'terminated')`,
      or(eq(workforceAgents.salarySettled, false), isNull(workforceAgents.salarySettled))
    ));
}

// ─── Full Leaderboard (all campaigns) ─────────────────────────────────────────
export async function getFullLeaderboard(cycleKey: string) {
  const db = await getDb();
  if (!db) return [];
  const { commissionLeaderboard } = await import("../drizzle/schema");
  const { eq, asc } = await import("drizzle-orm");

  // Read from the commission leaderboard table (uploaded from commission file Campaign tabs)
  const rows = await db.select({
    id: commissionLeaderboard.id,
    cycleKey: commissionLeaderboard.cycleKey,
    campaignName: commissionLeaderboard.campaignName,
    crdts: commissionLeaderboard.crdts,
    alias: commissionLeaderboard.alias,
    rank: commissionLeaderboard.rank,
    loginHours: commissionLeaderboard.loginHours,
    revenue: commissionLeaderboard.revenue,
    profit: commissionLeaderboard.profit,
    commissionEgp: commissionLeaderboard.commissionEgp,
    performanceMonth: commissionLeaderboard.performanceMonth,
  }).from(commissionLeaderboard)
    .where(eq(commissionLeaderboard.cycleKey, cycleKey))
    .orderBy(asc(commissionLeaderboard.rank));

  return rows.map(r => ({
    crdts: r.crdts,
    alias: r.alias ?? r.crdts,
    campaignName: r.campaignName,
    rank: r.rank,
    loginHours: parseFloat(r.loginHours ?? "0"),
    revenue: parseFloat(r.revenue ?? "0"),
    profit: parseFloat(r.profit ?? "0"),
    commissionEgp: parseFloat(r.commissionEgp ?? "0"),
    performanceMonth: r.performanceMonth ?? "",
    revPerHr: parseFloat(r.loginHours ?? "0") > 0
      ? Math.round((parseFloat(r.revenue ?? "0") / parseFloat(r.loginHours ?? "0")) * 100) / 100
      : 0,
  }));
}

export async function upsertCommissionLeaderboard(
  cycleKey: string,
  rows: Array<{
    campaignName: string;
    crdts: string;
    alias?: string;
    rank: number;
    loginHours?: number;
    revenue?: number;
    profit?: number;
    commissionEgp?: number;
    performanceMonth?: string;
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { commissionLeaderboard } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");

  // Delete existing rows for this cycle first, then insert fresh
  await db.delete(commissionLeaderboard).where(eq(commissionLeaderboard.cycleKey, cycleKey));

  if (rows.length === 0) return 0;

  const now = Date.now();
  await db.insert(commissionLeaderboard).values(
    rows.map(r => ({
      cycleKey,
      campaignName: r.campaignName,
      crdts: r.crdts,
      alias: r.alias ?? null,
      rank: r.rank,
      loginHours: String(r.loginHours ?? 0),
      revenue: String(r.revenue ?? 0),
      profit: String(r.profit ?? 0),
      commissionEgp: String(r.commissionEgp ?? 0),
      performanceMonth: r.performanceMonth ?? null,
      uploadedAt: now,
    }))
  );
  return rows.length;
}

// ─── Get next available T- trainee code ─────────────────────────────────────
// Finds the lowest T-{N} not already used across workforce_agents AND agent_credentials.
// Starts at T-1 and increments until a free slot is found.
export async function getNextAvailableTraineeCode(): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { workforceAgents, agentCredentials } = await import("../drizzle/schema");

  // Collect all used T- codes from both tables
  const existing = await db.select({ code: workforceAgents.traineeCode }).from(workforceAgents);
  const existingCreds = await db.select({ code: agentCredentials.traineeCode }).from(agentCredentials);
  const usedNums = new Set<number>();
  for (const { code } of [...existing, ...existingCreds]) {
    if (typeof code === "string" && /^T-\d+$/.test(code)) {
      usedNums.add(parseInt(code.slice(2), 10));
    }
  }

  // Find the next sequential number not in use
  let n = 1;
  while (usedNums.has(n)) n++;
  return `T-${n}`;
}

// ─── Generate unique trainee code (6-digit, not already in use) ───────────────
export async function generateUniqueTraineeCode(): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { workforceAgents, agentCredentials } = await import("../drizzle/schema");

  // Get all existing trainee codes from workforce and credentials tables
  const existing = await db.select({ code: workforceAgents.traineeCode }).from(workforceAgents);
  const existingCreds = await db.select({ code: agentCredentials.traineeCode }).from(agentCredentials);
  const usedCodes = new Set([
    ...existing.map(r => r.code as string),
    ...existingCreds.map(r => r.code as string),
  ].filter(Boolean) as string[]);

  // Generate a random 6-digit code not in use (range 100000–999999)
  let attempts = 0;
  while (attempts < 1000) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    if (!usedCodes.has(code)) return code;
    attempts++;
  }
  throw new Error("Could not generate a unique trainee code after 1000 attempts");
}

// ─── CRDTS archive + effective-dated separations ────────────────────────────
// Tables keyed by CRDTS whose history must be relabeled when a number is freed.
const CRDTS_DATA_TABLES = [
  "payrollRecords", "coachingSessions", "agentViolations", "agentPerformance",
  "adherenceLog", "qualityLog", "cycleStats", "cycleDeductions", "cycleOT",
  "clientLogouts", "commissions", "commissionLeaderboard", "payrollAdjustments",
  "trainerSalaries",
];

/**
 * Auto-archive an agent's CRDTS. Each of the agent's numbers (comma-split) is
 * renamed "114063" -> "114063 (1)" across workforce_agents AND every history
 * table, freeing the bare number for whoever the client assigns it to next.
 * Idempotent: numbers already suffixed "(n)" are left as-is.
 */
export async function archiveAgentCrdts(traineeCode: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const schema = await import("../drizzle/schema");
  const { workforceAgents } = schema;
  const row = await db.select({ crdts: workforceAgents.crdts })
    .from(workforceAgents).where(eq(workforceAgents.traineeCode, traineeCode)).limit(1);
  const raw = row[0]?.crdts;
  if (!raw) return;
  const nums = String(raw).split(",").map(x => x.trim()).filter(Boolean);
  const newNums: string[] = [];
  for (const num of nums) {
    if (/\(\d+\)\s*$/.test(num)) { newNums.push(num); continue; } // already archived
    let k = 1, label = `${num} (1)`;
    // find a free suffix (avoid clashing with an existing archived label)
    // eslint-disable-next-line no-constant-condition
    while (true) {
      label = `${num} (${k})`;
      const hit = await db.select({ id: workforceAgents.id })
        .from(workforceAgents).where(eq(workforceAgents.crdts, label)).limit(1);
      if (!hit[0]) break;
      k++;
    }
    for (const t of CRDTS_DATA_TABLES) {
      const tbl: any = (schema as any)[t];
      if (!tbl || !tbl.crdts) continue;
      await db.update(tbl).set({ crdts: label }).where(eq(tbl.crdts, num));
    }
    newNums.push(label);
  }
  await db.update(workforceAgents).set({ crdts: newNums.join(", "), updatedAt: new Date() })
    .where(eq(workforceAgents.traineeCode, traineeCode));
}

/** Schedule a resignation for a future effective date. The agent stays fully
 *  active (login + headcount) until that date; processDueSeparations applies it. */
export async function scheduleResignation(agentCode: string, effectiveDate: string, reason: string, adminName: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { agentSeparations, workforceAgents } = await import("../drizzle/schema");
  const ag = await db.select({ id: workforceAgents.id })
    .from(workforceAgents).where(eq(workforceAgents.traineeCode, agentCode)).limit(1);
  if (!ag[0]) throw new Error("Agent not found");
  const now = Date.now();
  const effectiveAt = new Date(effectiveDate + "T23:59:59Z").getTime();
  // replace any existing pending schedule for this agent
  await db.delete(agentSeparations)
    .where(and(eq(agentSeparations.agentCode, agentCode), isNull(agentSeparations.appliedAt)));
  await db.insert(agentSeparations).values({
    agentCode, type: "resignation_request", reason, lastWorkingDay: effectiveDate,
    requestedAt: now, effectiveAt, approvedBy: adminName, approvedAt: now, appliedAt: null,
  });
  if (effectiveAt <= now) await processDueSeparations(); // date already passed → apply now
  return { effectiveAt };
}

/** Cancel a pending (not-yet-effective) scheduled separation. */
export async function cancelScheduledSeparation(agentCode: string) {
  const db = await getDb();
  if (!db) return;
  const { agentSeparations } = await import("../drizzle/schema");
  await db.delete(agentSeparations)
    .where(and(eq(agentSeparations.agentCode, agentCode), isNull(agentSeparations.appliedAt)));
}

/** The pending scheduled separation for an agent (if any), else null. */
export async function getPendingSeparationForAgent(agentCode: string) {
  const db = await getDb();
  if (!db) return null;
  const { agentSeparations } = await import("../drizzle/schema");
  const rows = await db.select().from(agentSeparations)
    .where(and(eq(agentSeparations.agentCode, agentCode), isNull(agentSeparations.appliedAt)))
    .orderBy(desc(agentSeparations.effectiveAt)).limit(1);
  return rows[0] ?? null;
}

/** Apply every scheduled separation whose effective date has arrived. Called
 *  lazily from admin reads, so leavers drop out exactly on their effective day. */
export async function processDueSeparations(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const { agentSeparations, workforceAgents, agentCredentials } = await import("../drizzle/schema");
  const now = Date.now();
  const due = await db.select().from(agentSeparations).where(and(
    isNull(agentSeparations.appliedAt),
    isNotNull(agentSeparations.effectiveAt),
    lte(agentSeparations.effectiveAt, now),
  ));
  let count = 0;
  for (const sep of due) {
    const status = sep.type === "termination" ? "terminated" : "resigned";
    const ag = await db.select({ candidateId: workforceAgents.candidateId })
      .from(workforceAgents).where(eq(workforceAgents.traineeCode, sep.agentCode)).limit(1);
    await db.update(workforceAgents).set({ agentStatus: status, isActive: false, updatedAt: new Date() })
      .where(eq(workforceAgents.traineeCode, sep.agentCode));
    await db.delete(agentCredentials).where(eq(agentCredentials.traineeCode, sep.agentCode));
    if (ag[0]?.candidateId) {
      await db.update(candidates).set({ status, updatedAt: new Date() }).where(eq(candidates.id, ag[0].candidateId));
    }
    await archiveAgentCrdts(sep.agentCode);
    await db.update(agentSeparations).set({ appliedAt: now }).where(eq(agentSeparations.id, sep.id));
    count++;
  }
  return count;
}
