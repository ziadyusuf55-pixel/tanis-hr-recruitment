import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB module ────────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  listJobs: vi.fn().mockResolvedValue([]),
  getJobById: vi.fn().mockResolvedValue({ id: 1, title: "Test Job", status: "open", department: null, location: null, description: null, createdAt: new Date(), updatedAt: new Date() }),
  createJob: vi.fn().mockResolvedValue({ id: 1, title: "Test Job", status: "open", department: null, location: null, description: null, createdAt: new Date(), updatedAt: new Date() }),
  updateJob: vi.fn().mockResolvedValue({ id: 1, title: "Updated Job", status: "open", department: null, location: null, description: null, createdAt: new Date(), updatedAt: new Date() }),
  deleteJob: vi.fn().mockResolvedValue({ success: true }),
  listCandidates: vi.fn().mockResolvedValue([]),
  getCandidateById: vi.fn().mockResolvedValue({ id: 1, name: "Jane Doe", email: "jane@example.com", positionApplied: "Engineer", status: "applied", phone: null, jobId: null, resumeLink: null, notes: null, createdAt: new Date(), updatedAt: new Date() }),
  createCandidate: vi.fn().mockResolvedValue({ id: 1, name: "Jane Doe", email: "jane@example.com", positionApplied: "Engineer", status: "applied", phone: null, jobId: null, resumeLink: null, notes: null, createdAt: new Date(), updatedAt: new Date() }),
  updateCandidate: vi.fn().mockResolvedValue({ id: 1, name: "Jane Doe", email: "jane@example.com", positionApplied: "Engineer", status: "shortlisted", phone: null, jobId: null, resumeLink: null, notes: null, createdAt: new Date(), updatedAt: new Date() }),
  deleteCandidate: vi.fn().mockResolvedValue({ success: true }),
  bulkCreateCandidates: vi.fn().mockResolvedValue({ count: 2 }),
  getPipelineCounts: vi.fn().mockResolvedValue([{ status: "applied", count: 3 }, { status: "hired", count: 1 }]),
  listInterviewsByCandidateId: vi.fn().mockResolvedValue([]),
  createInterview: vi.fn().mockResolvedValue({ id: 1, candidateId: 1, scheduledAt: Date.now() + 86400000, location: "Office", interviewerName: "HR", notes: null, notificationSent: 0, createdAt: new Date(), updatedAt: new Date() }),
  updateInterview: vi.fn().mockResolvedValue({ id: 1, notificationSent: 1 }),
  deleteInterview: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("./email", () => ({
  sendInterviewNotification: vi.fn().mockResolvedValue(undefined),
}));

// ─── Auth context helper ───────────────────────────────────────────────────────
function createAuthContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
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
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("auth.logout", () => {
  it("clears session cookie and returns success", async () => {
    const ctx = createAuthContext();
    const cleared: string[] = [];
    (ctx.res as unknown as { clearCookie: (name: string) => void }).clearCookie = (name: string) => cleared.push(name);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
  });
});

describe("dashboard.pipelineCounts", () => {
  it("returns counts for all pipeline stages", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.dashboard.pipelineCounts();
    expect(result).toHaveLength(6);
    const stages = result.map((r) => r.stage);
    expect(stages).toContain("applied");
    expect(stages).toContain("hired");
    expect(stages).toContain("rejected");
  });

  it("fills missing stages with count 0", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.dashboard.pipelineCounts();
    const rejected = result.find((r) => r.stage === "rejected");
    expect(rejected?.count).toBe(0);
  });
});

describe("jobs router", () => {
  it("lists jobs", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.jobs.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("creates a job with required fields", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.jobs.create({ title: "Test Job" });
    expect(result).toBeDefined();
    expect(result?.title).toBe("Test Job");
  });

  it("updates a job", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.jobs.update({ id: 1, data: { title: "Updated Job" } });
    expect(result?.title).toBe("Updated Job");
  });

  it("deletes a job", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.jobs.delete({ id: 1 });
    expect(result.success).toBe(true);
  });

  it("rejects job creation without a title", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(caller.jobs.create({ title: "" })).rejects.toThrow();
  });
});

describe("candidates router", () => {
  it("lists candidates", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.candidates.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("creates a candidate with required fields", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.candidates.create({
      name: "Jane Doe",
      email: "jane@example.com",
      positionApplied: "Engineer",
    });
    expect(result?.name).toBe("Jane Doe");
    expect(result?.status).toBe("applied");
  });

  it("rejects candidate creation with invalid email", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(
      caller.candidates.create({ name: "Jane", email: "not-an-email", positionApplied: "Engineer" })
    ).rejects.toThrow();
  });

  it("updates candidate status", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.candidates.updateStatus({ id: 1, status: "shortlisted" });
    expect(result).toBeDefined();
  });

  it("bulk imports candidates", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.candidates.bulkImport([
      { name: "Alice", email: "alice@example.com", positionApplied: "Manager" },
      { name: "Bob", email: "bob@example.com", positionApplied: "Engineer" },
    ]);
    expect(result.count).toBe(2);
  });

  it("rejects bulk import with invalid email", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(
      caller.candidates.bulkImport([{ name: "Alice", email: "bad", positionApplied: "Manager" }])
    ).rejects.toThrow();
  });

  it("deletes a candidate", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.candidates.delete({ id: 1 });
    expect(result.success).toBe(true);
  });
});

describe("interviews router", () => {
  it("lists interviews by candidate", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.interviews.byCandidateId({ candidateId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("schedules an interview and sends email notification", async () => {
    const { sendInterviewNotification } = await import("./email");
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.interviews.schedule({
      candidateId: 1,
      scheduledAt: Date.now() + 86400000,
      recruiterEmail: "recruiter@tanis.com",
      recruiterName: "Test Recruiter",
      candidateName: "Jane Doe",
      location: "Office",
    });
    expect(result).toBeDefined();
    expect(sendInterviewNotification).toHaveBeenCalledOnce();
  });

  it("deletes an interview", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.interviews.delete({ id: 1 });
    expect(result.success).toBe(true);
  });
});
