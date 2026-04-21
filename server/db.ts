import { and, desc, eq, gte, inArray, notInArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  PipelineStage,
  activityLog,
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

export async function listCandidates(opts?: { includeAssignedToBatch?: boolean }) {
  const db = await getDb();
  if (!db) return [];

  if (opts?.includeAssignedToBatch) {
    return db.select().from(candidates).orderBy(desc(candidates.createdAt));
  }

  // Get all candidateIds that are assigned to any training batch
  const assigned = await db
    .select({ candidateId: batchCandidates.candidateId })
    .from(batchCandidates);
  const assignedIds = assigned.map((r) => r.candidateId);

  if (assignedIds.length === 0) {
    return db.select().from(candidates).orderBy(desc(candidates.createdAt));
  }

  return db
    .select()
    .from(candidates)
    .where(notInArray(candidates.id, assignedIds))
    .orderBy(desc(candidates.createdAt));
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
  // Merge traineeCode from batchCandidates into each candidate row
  return cands.map((c) => ({
    ...c,
    traineeCode: rows.find((r) => r.candidateId === c.id)?.traineeCode ?? null,
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

export async function upsertAgentCredential(candidateId: number, traineeCode: string, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { agentCredentials } = await import("../drizzle/schema");
  // Try insert first, update if exists
  const existing = await getAgentCredentialByCandidateId(candidateId);
  if (existing) {
    await db.update(agentCredentials)
      .set({ traineeCode, passwordHash })
      .where(eq(agentCredentials.candidateId, candidateId));
  } else {
    await db.insert(agentCredentials).values({ candidateId, traineeCode, passwordHash });
  }
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
