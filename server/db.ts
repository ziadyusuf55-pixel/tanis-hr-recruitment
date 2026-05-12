import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  PipelineStage,
  activityLog,
  agentRequests,
  batchCandidates,
  candidates,
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
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = Date.now();
  await db.insert(candidates).values(
    rows.map((r) => ({
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
    sql`\`acceptedAt\` IS NOT NULL`,
    sql`\`appliedAt\` IS NOT NULL`,
  ];
  if (sinceMs > 0) {
    conditions.push(gte(candidates.createdAt, new Date(sinceMs)));
  }
  const result = await db
    .select({
      avgMs: sql<number>`AVG(\`acceptedAt\` - \`appliedAt\`)`.mapWith(Number),
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

export async function upsertPayrollRecord(data: {
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
  return db
    .select()
    .from(agentRequests)
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
  const rows = await db.select().from(adminAccounts).where(eq(adminAccounts.email, email)).limit(1);
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
    email: data.email, name: data.name, passwordHash: data.passwordHash,
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
  const { referrals } = await import("../drizzle/schema");
  return db.select().from(referrals).orderBy(desc(referrals.createdAt));
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

export async function listWorkforceAgents(campaignId?: number) {
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
  }).from(workforceAgents)
    .leftJoin(campaigns, eq(workforceAgents.campaignId, campaigns.id))
    .orderBy(workforceAgents.fullName);
  if (campaignId) {
    return base.where(eq(workforceAgents.campaignId, campaignId));
  }
  return base;
}

/**
 * Returns candidates eligible to be added to Operations:
 * 1. Candidates currently in training batches (in_training stage)
 * 2. Existing workforce agents (for re-assignment)
 */
export async function getEligibleCandidatesForOps() {
  const db = await getDb();
  if (!db) return [];
  const { batchCandidates, candidates: candidatesTable, workforceAgents } = await import("../drizzle/schema");
  // Get all candidates who are in a batch (in training) — use raw SQL for status filter
  const inTraining = await db.select({
    candidateId: batchCandidates.candidateId,
    traineeCode: batchCandidates.traineeCode,
    name: candidatesTable.name,
    phone: candidatesTable.phone,
    source: sql<string>`'training'`,
  }).from(batchCandidates)
    .innerJoin(candidatesTable, eq(batchCandidates.candidateId, candidatesTable.id));
  // Get all existing workforce agents
  const existingOps = await db.select({
    candidateId: workforceAgents.candidateId,
    traineeCode: workforceAgents.traineeCode,
    name: workforceAgents.fullName,
    phone: workforceAgents.phone,
    source: sql<string>`'ops'`,
  }).from(workforceAgents);
  // Merge, deduplicate by candidateId (prefer ops if already there)
  const merged = new Map<number, { candidateId: number; traineeCode: string | null; name: string; phone: string | null; source: string }>();
  for (const r of inTraining) merged.set(r.candidateId, r);
  for (const r of existingOps) merged.set(r.candidateId, r); // ops overrides training
  return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name));
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
  }).from(workforceAgents)
    .leftJoin(campaigns, eq(workforceAgents.campaignId, campaigns.id))
    .where(eq(workforceAgents.traineeCode, traineeCode))
    .limit(1);
  return rows[0] ?? null;
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
 * 1. Sets agentStatus = 'resigned', isActive = false
 * 2. Blacklists the linked candidate
 * 3. Stores separation record
 */
export async function markAgentResignedOnSpot(agentCode: string, reason: string, adminName: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { workforceAgents, candidates, agentSeparations } = await import("../drizzle/schema");
  // Get agent to find candidateId
  const agent = await db.select({ candidateId: workforceAgents.candidateId })
    .from(workforceAgents).where(eq(workforceAgents.traineeCode, agentCode)).limit(1);
  if (!agent[0]) throw new Error("Agent not found");
  const now = Date.now();
  // Update agent status
  await db.update(workforceAgents)
    .set({ agentStatus: "resigned", isActive: false })
    .where(eq(workforceAgents.traineeCode, agentCode));
  // Blacklist candidate
  await db.update(candidates)
    .set({ status: "blacklisted" })
    .where(eq(candidates.id, agent[0].candidateId));
  // Store separation record
  await db.insert(agentSeparations).values({
    agentCode, type: "on_spot", reason,
    effectiveAt: now, approvedBy: adminName, approvedAt: now,
  });
}

/**
 * Terminate agent:
 * 1. Sets agentStatus = 'terminated', isActive = false
 * 2. Stores separation record
 */
export async function terminateAgent(agentCode: string, reason: string, adminName: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { workforceAgents, agentSeparations } = await import("../drizzle/schema");
  const now = Date.now();
  await db.update(workforceAgents)
    .set({ agentStatus: "terminated", isActive: false })
    .where(eq(workforceAgents.traineeCode, agentCode));
  await db.insert(agentSeparations).values({
    agentCode, type: "termination", reason,
    effectiveAt: now, approvedBy: adminName, approvedAt: now,
  });
}

/**
 * Approve resignation request:
 * 1. Sets agentStatus = 'resigned', isActive = false
 * 2. Stores separation record with lastWorkingDay
 */
export async function approveResignationRequest(agentCode: string, lastWorkingDay: string, reason: string, adminName: string, requestedAt: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { workforceAgents, agentSeparations } = await import("../drizzle/schema");
  const now = Date.now();
  await db.update(workforceAgents)
    .set({ agentStatus: "resigned", isActive: false })
    .where(eq(workforceAgents.traineeCode, agentCode));
  await db.insert(agentSeparations).values({
    agentCode, type: "resignation_request", reason, lastWorkingDay,
    requestedAt, effectiveAt: now, approvedBy: adminName, approvedAt: now,
  });
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
  const { scheduleChangeRequests } = await import("../drizzle/schema");
  return db.select().from(scheduleChangeRequests).orderBy(desc(scheduleChangeRequests.createdAt));
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
      await db.insert(payrollRecords).values({ ...values, status: "pending" });
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
