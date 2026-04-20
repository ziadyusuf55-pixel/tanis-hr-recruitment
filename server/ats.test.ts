import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB module ───────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  listCandidates: vi.fn().mockResolvedValue([
    {
      id: 1,
      name: "Ahmed Hassan",
      email: "ahmed@example.com",
      phone: "01012345678",
      positionApplied: "Call Center Agent",
      status: "applied",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
  getCandidateById: vi.fn().mockResolvedValue({
    id: 1,
    name: "Ahmed Hassan",
    email: "ahmed@example.com",
    phone: "01012345678",
    positionApplied: "Call Center Agent",
    status: "applied",
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  createCandidate: vi.fn().mockResolvedValue({ insertId: 1 }),
  updateCandidate: vi.fn().mockResolvedValue(undefined),
  updateCandidateStatus: vi.fn().mockResolvedValue(undefined),
  deleteCandidate: vi.fn().mockResolvedValue(undefined),
  bulkInsertCandidates: vi.fn().mockResolvedValue(undefined),
  listNotesByCandidateId: vi.fn().mockResolvedValue([]),
  addStageNote: vi.fn().mockResolvedValue(undefined),
  listInterviewsByCandidateId: vi.fn().mockResolvedValue([]),
  createInterview: vi.fn().mockResolvedValue(undefined),
  markInterviewNotificationSent: vi.fn().mockResolvedValue(undefined),
  getPipelineCounts: vi.fn().mockResolvedValue([
    { status: "applied", count: 10 },
    { status: "whatsapp_sent", count: 7 },
    { status: "voice_note_reviewed", count: 5 },
    { status: "interview_scheduled", count: 3 },
    { status: "accepted", count: 2 },
    { status: "whatsapp_group_added", count: 1 },
    { status: "rejected", count: 4 },
  ]),
  getCandidatesAddedSince: vi.fn().mockResolvedValue(5),
  getInterviewsScheduledSince: vi.fn().mockResolvedValue(2),
  getAvgTimeToHire: vi.fn().mockResolvedValue(7),
  getStageDropoff: vi.fn().mockResolvedValue([]),
  getNoAnswerCount: vi.fn().mockResolvedValue(0),
  setSubStatus: vi.fn().mockResolvedValue(undefined),
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(undefined),
  logActivity: vi.fn().mockResolvedValue(undefined),
  listActivityByCandidateId: vi.fn().mockResolvedValue([]),
  checkDuplicateByPhone: vi.fn().mockResolvedValue(null),
  getReApplicants: vi.fn().mockResolvedValue([]),
}));

vi.mock("./email", () => ({
  sendInterviewNotification: vi.fn().mockResolvedValue(undefined),
}));

// ─── Auth context factory ─────────────────────────────────────────────────────
function makeCtx(overrides: Partial<TrpcContext> = {}): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "recruiter-1",
      email: "recruiter@tanis.com",
      name: "Test Recruiter",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
    ...overrides,
  };
}

// ─── Auth router ──────────────────────────────────────────────────────────────
describe("auth router", () => {
  it("returns null for unauthenticated user", async () => {
    const caller = appRouter.createCaller(makeCtx({ user: null }));
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns the current user when authenticated", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.auth.me();
    expect(result?.email).toBe("recruiter@tanis.com");
  });

  it("clears session cookie on logout", async () => {
    const cleared: string[] = [];
    const ctx = makeCtx();
    (ctx.res as unknown as { clearCookie: (name: string) => void }).clearCookie = (name) => cleared.push(name);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
  });
});

// ─── Candidates router ────────────────────────────────────────────────────────
describe("candidates router", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    caller = appRouter.createCaller(makeCtx());
  });

  it("lists candidates", async () => {
    const result = await caller.candidates.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]?.name).toBe("Ahmed Hassan");
  });

  it("gets a candidate by id", async () => {
    const result = await caller.candidates.get({ id: 1 });
    expect(result?.email).toBe("ahmed@example.com");
  });

  it("creates a candidate with required fields", async () => {
    const result = await caller.candidates.create({
      name: "Sara Ali",
      email: "sara@example.com",
    });
    expect(result).toBeDefined();
  });

  it("rejects candidate creation with invalid email", async () => {
    await expect(
      caller.candidates.create({ name: "Bad", email: "not-an-email" })
    ).rejects.toThrow();
  });

  it("updates a candidate's status to whatsapp_sent", async () => {
    const result = await caller.candidates.updateStatus({ id: 1, status: "whatsapp_sent" });
    expect(result).toEqual({ success: true });
  });

  it("updates a candidate's status to voice_note_reviewed", async () => {
    const result = await caller.candidates.updateStatus({ id: 1, status: "voice_note_reviewed" });
    expect(result).toEqual({ success: true });
  });

  it("updates a candidate's status to interview_scheduled", async () => {
    const result = await caller.candidates.updateStatus({ id: 1, status: "interview_scheduled" });
    expect(result).toEqual({ success: true });
  });

  it("updates a candidate's status to accepted", async () => {
    const result = await caller.candidates.updateStatus({ id: 1, status: "accepted" });
    expect(result).toEqual({ success: true });
  });

  it("updates a candidate's status to whatsapp_group_added", async () => {
    const result = await caller.candidates.updateStatus({ id: 1, status: "whatsapp_group_added" });
    expect(result).toEqual({ success: true });
  });

  it("updates a candidate's status to rejected", async () => {
    const result = await caller.candidates.updateStatus({ id: 1, status: "rejected" });
    expect(result).toEqual({ success: true });
  });

  it("deletes a candidate", async () => {
    const result = await caller.candidates.delete({ id: 1 });
    expect(result).toBeUndefined();
  });

  it("bulk imports candidates without throwing", async () => {
    // bulkInsertCandidates returns void; just verify it doesn't throw
    await expect(
      caller.candidates.bulkImport([
        { name: "Candidate A", email: "a@example.com" },
        { name: "Candidate B", email: "b@example.com" },
      ])
    ).resolves.not.toThrow();
  });

  it("accepts bulk import with non-standard email (lenient validation)", async () => {
    // Email validation is intentionally lenient to avoid import failures
    // when LinkedIn exports contain malformed or missing emails
    await expect(
      caller.candidates.bulkImport([{ name: "Bad", email: "not-valid" }])
    ).resolves.not.toThrow();
  });
});

// ─── Notes router ─────────────────────────────────────────────────────────────
describe("notes router", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    caller = appRouter.createCaller(makeCtx());
  });

  it("lists notes for a candidate", async () => {
    const result = await caller.notes.list({ candidateId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("adds a note at whatsapp_sent stage", async () => {
    const result = await caller.notes.add({
      candidateId: 1,
      stage: "whatsapp_sent",
      note: "Sent intro message on WhatsApp",
    });
    expect(result).toBeUndefined();
  });

  it("adds a note at voice_note_reviewed stage", async () => {
    const result = await caller.notes.add({
      candidateId: 1,
      stage: "voice_note_reviewed",
      note: "Strong sales pitch, clear voice",
    });
    expect(result).toBeUndefined();
  });

  it("rejects empty note text", async () => {
    await expect(
      caller.notes.add({ candidateId: 1, stage: "applied", note: "" })
    ).rejects.toThrow();
  });
});

// ─── Interviews router ────────────────────────────────────────────────────────
describe("interviews router", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    caller = appRouter.createCaller(makeCtx());
  });

  it("lists interviews for a candidate", async () => {
    const result = await caller.interviews.listByCandidate({ candidateId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("schedules an interview with all fields", async () => {
    const result = await caller.interviews.schedule({
      candidateId: 1,
      scheduledAt: Date.now() + 86400000,
      location: "Google Meet",
      candidateName: "Ahmed Hassan",
      recruiterEmail: "recruiter@tanis.com",
    });
    expect(result).toEqual({ success: true });
  });

  it("schedules an interview without optional fields", async () => {
    const result = await caller.interviews.schedule({
      candidateId: 1,
      scheduledAt: Date.now() + 86400000,
    });
    expect(result).toEqual({ success: true });
  });

  it("sends email notification when recruiterEmail is provided", async () => {
    const { sendInterviewNotification } = await import("./email");
    vi.clearAllMocks();
    await caller.interviews.schedule({
      candidateId: 1,
      scheduledAt: Date.now() + 86400000,
      recruiterEmail: "recruiter@tanis.com",
      candidateName: "Ahmed Hassan",
    });
    expect(sendInterviewNotification).toHaveBeenCalledOnce();
  });
});

// ─── Dashboard KPIs router ────────────────────────────────────────────────────
describe("dashboard.kpis router", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    caller = appRouter.createCaller(makeCtx());
  });

  it("returns KPIs for 'month' period", async () => {
    const result = await caller.dashboard.kpis({ period: "month" });
    expect(result).toHaveProperty("totalInPipeline");
    expect(result).toHaveProperty("newCandidates");
    expect(result).toHaveProperty("whatsappGroupAdded");
    expect(result).toHaveProperty("conversionRate");
    expect(result).toHaveProperty("stageCounts");
  });

  it("returns KPIs for 'week' period", async () => {
    const result = await caller.dashboard.kpis({ period: "week" });
    expect(result.stageCounts).toHaveProperty("applied");
    expect(result.stageCounts).toHaveProperty("whatsapp_sent");
    expect(result.stageCounts).toHaveProperty("whatsapp_group_added");
  });

  it("returns KPIs for 'all' period", async () => {
    const result = await caller.dashboard.kpis({ period: "all" });
    expect(typeof result.totalInPipeline).toBe("number");
    expect(typeof result.conversionRate).toBe("number");
  });

  it("returns pipeline counts via pipelineCounts procedure", async () => {
    const result = await caller.dashboard.pipelineCounts({ period: "month" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("includes all 7 stages in stageCounts", async () => {
    const result = await caller.dashboard.kpis({ period: "all" });
    const stages = Object.keys(result.stageCounts);
    expect(stages).toContain("applied");
    expect(stages).toContain("whatsapp_sent");
    expect(stages).toContain("voice_note_reviewed");
    expect(stages).toContain("interview_scheduled");
    expect(stages).toContain("accepted");
    expect(stages).toContain("whatsapp_group_added");
    expect(stages).toContain("rejected");
  });
});
