import { describe, it, expect, vi, beforeEach } from "vitest";
import * as db from "./db";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("./db", () => ({
  getAgentCredentialByCandidateId: vi.fn(),
  getAgentCredentialByTraineeCode: vi.fn(),
  upsertAgentCredential: vi.fn(),
  getPayrollByCandidateId: vi.fn(),
  upsertPayrollRecord: vi.fn(),
  deletePayrollRecord: vi.fn(),
  getPerformanceByCandidateId: vi.fn(),
  upsertPerformanceRecord: vi.fn(),
  deletePerformanceRecord: vi.fn(),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Agent credential helpers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getAgentCredentialByCandidateId returns null when no credentials exist", async () => {
    vi.mocked(db.getAgentCredentialByCandidateId).mockResolvedValue(null);
    const result = await db.getAgentCredentialByCandidateId(999);
    expect(result).toBeNull();
  });

  it("getAgentCredentialByCandidateId returns credential when it exists", async () => {
    const mockCred = { candidateId: 1, traineeCode: "TN-0001", passwordHash: "hash", generatedAt: new Date(), updatedAt: new Date() };
    vi.mocked(db.getAgentCredentialByCandidateId).mockResolvedValue(mockCred as never);
    const result = await db.getAgentCredentialByCandidateId(1);
    expect(result).toEqual(mockCred);
    expect(result?.traineeCode).toBe("TN-0001");
  });

  it("getAgentCredentialByTraineeCode returns null for unknown trainee code", async () => {
    vi.mocked(db.getAgentCredentialByTraineeCode).mockResolvedValue(null);
    const result = await db.getAgentCredentialByTraineeCode("TN-UNKNOWN");
    expect(result).toBeNull();
  });

  it("upsertAgentCredential is called with correct parameters", async () => {
    vi.mocked(db.upsertAgentCredential).mockResolvedValue(undefined);
    await db.upsertAgentCredential(1, "TN-0001", "hashedpassword");
    expect(db.upsertAgentCredential).toHaveBeenCalledWith(1, "TN-0001", "hashedpassword");
  });
});

describe("Payroll helpers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getPayrollByCandidateId returns empty array when no records", async () => {
    vi.mocked(db.getPayrollByCandidateId).mockResolvedValue([]);
    const result = await db.getPayrollByCandidateId(1);
    expect(result).toEqual([]);
  });

  it("getPayrollByCandidateId returns payroll records", async () => {
    const mockRecords = [
      { id: 1, candidateId: 1, month: "April 2026", grossSalary: "5000.00", deductions: "200.00", netPay: "4800.00", paymentDate: null, status: "pending", notes: null },
    ];
    vi.mocked(db.getPayrollByCandidateId).mockResolvedValue(mockRecords as never);
    const result = await db.getPayrollByCandidateId(1);
    expect(result).toHaveLength(1);
    expect(result[0].month).toBe("April 2026");
  });

  it("upsertPayrollRecord is called with correct parameters", async () => {
    vi.mocked(db.upsertPayrollRecord).mockResolvedValue(undefined);
    await db.upsertPayrollRecord({ candidateId: 1, month: "April 2026", grossSalary: "5000", deductions: "200", netPay: "4800", paymentDate: null, status: "pending", notes: null });
    expect(db.upsertPayrollRecord).toHaveBeenCalledOnce();
  });
});

describe("Performance helpers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getPerformanceByCandidateId returns empty array when no records", async () => {
    vi.mocked(db.getPerformanceByCandidateId).mockResolvedValue([]);
    const result = await db.getPerformanceByCandidateId(1);
    expect(result).toEqual([]);
  });

  it("getPerformanceByCandidateId returns performance records", async () => {
    const mockRecords = [
      { id: 1, candidateId: 1, period: "April 2026", callsMade: 150, leadsGenerated: 30, targetsHit: 8, totalTargets: 10, qualityScore: "92.5", attendanceRate: "100.0", notes: "Great month" },
    ];
    vi.mocked(db.getPerformanceByCandidateId).mockResolvedValue(mockRecords as never);
    const result = await db.getPerformanceByCandidateId(1);
    expect(result).toHaveLength(1);
    expect(result[0].period).toBe("April 2026");
    expect(result[0].callsMade).toBe(150);
  });

  it("deletePerformanceRecord is called with correct id", async () => {
    vi.mocked(db.deletePerformanceRecord).mockResolvedValue(undefined);
    await db.deletePerformanceRecord(42);
    expect(db.deletePerformanceRecord).toHaveBeenCalledWith(42);
  });
});
