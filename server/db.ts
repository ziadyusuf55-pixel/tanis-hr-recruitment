import { eq, desc, sql, gte, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  jobs,
  candidates,
  interviews,
  InsertJob,
  InsertCandidate,
  InsertInterview,
  PipelineStage,
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
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

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
  return result.length > 0 ? result[0] : undefined;
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export async function listJobs() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(jobs).orderBy(desc(jobs.createdAt));
}

export async function getJobById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  return result[0];
}

export async function createJob(data: Omit<InsertJob, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(jobs).values(data);
  const result = await db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(1);
  return result[0];
}

export async function updateJob(id: number, data: Partial<Omit<InsertJob, "id" | "createdAt" | "updatedAt">>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(jobs).set(data).where(eq(jobs.id, id));
  return getJobById(id);
}

export async function deleteJob(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(jobs).where(eq(jobs.id, id));
  return { success: true };
}

// ─── Candidates ───────────────────────────────────────────────────────────────

export async function listCandidates(filters?: { status?: PipelineStage; jobId?: number }) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(candidates).$dynamic();
  if (filters?.status) {
    query = query.where(eq(candidates.status, filters.status));
  }
  return query.orderBy(desc(candidates.createdAt));
}

export async function getCandidateById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(candidates).where(eq(candidates.id, id)).limit(1);
  return result[0];
}

export async function createCandidate(data: Omit<InsertCandidate, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(candidates).values(data);
  const result = await db.select().from(candidates).orderBy(desc(candidates.createdAt)).limit(1);
  return result[0];
}

export async function updateCandidate(id: number, data: Partial<Omit<InsertCandidate, "id" | "createdAt" | "updatedAt">>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(candidates).set(data).where(eq(candidates.id, id));
  return getCandidateById(id);
}

export async function deleteCandidate(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(candidates).where(eq(candidates.id, id));
  return { success: true };
}

export async function bulkCreateCandidates(
  data: Array<Omit<InsertCandidate, "id" | "createdAt" | "updatedAt">>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (data.length === 0) return { count: 0 };
  await db.insert(candidates).values(data);
  return { count: data.length };
}

export async function getPipelineCounts(period?: "week" | "month" | "all") {
  const db = await getDb();
  if (!db) return [];

  let sinceMs: number | null = null;
  const now = Date.now();
  if (period === "week") sinceMs = now - 7 * 24 * 60 * 60 * 1000;
  else if (period === "month") sinceMs = now - 30 * 24 * 60 * 60 * 1000;

  const result = await db
    .select({
      status: candidates.status,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(candidates)
    .where(sinceMs !== null ? gte(candidates.createdAt, new Date(sinceMs)) : undefined)
    .groupBy(candidates.status);
  return result;
}

export async function getCandidatesAddedSince(sinceMs: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(candidates)
    .where(gte(candidates.createdAt, new Date(sinceMs)));
  return result[0]?.count ?? 0;
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

export async function getInterviewById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(interviews).where(eq(interviews.id, id)).limit(1);
  return result[0];
}

export async function createInterview(data: Omit<InsertInterview, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(interviews).values(data);
  const result = await db
    .select()
    .from(interviews)
    .where(eq(interviews.candidateId, data.candidateId))
    .orderBy(desc(interviews.createdAt))
    .limit(1);
  return result[0];
}

export async function updateInterview(id: number, data: Partial<Omit<InsertInterview, "id" | "createdAt" | "updatedAt">>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(interviews).set(data).where(eq(interviews.id, id));
  return getInterviewById(id);
}

export async function deleteInterview(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(interviews).where(eq(interviews.id, id));
  return { success: true };
}
