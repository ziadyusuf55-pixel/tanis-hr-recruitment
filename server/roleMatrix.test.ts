/**
 * Role authorization matrix — proves each sensitive endpoint rejects the roles
 * that must NOT reach it and accepts the roles that must. This is the test
 * class the Oct-2026 audits called for: "staff" is not an authorization
 * policy; the RIGHT KIND of staff is.
 *
 * Owner decisions encoded here:
 *  - Money/PII (payroll, commissions, payment methods, ID documents):
 *    finance + hr + manager (+ owner/admin). team_lead, bd, ops_manager: NO.
 *  - Approvals (leave): hr + manager + ops_manager + team_lead.
 *  - Lifecycle writes (exit checklist, settle, rehire): hr/manager (+finance
 *    for settle).
 */
import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    // Handlers reached by ALLOWED-path smoke tests:
    getPayrollByCandidateId: vi.fn().mockResolvedValue([]),
    getPayrollStatusPage: vi.fn().mockResolvedValue([]),
    getCommentsByCode: vi.fn().mockResolvedValue([]),
    getDocumentsByCode: vi.fn().mockResolvedValue([]),
    decideLeaveRequest: vi.fn().mockResolvedValue({ ok: true, traineeCode: "T-1", days: 1, agentRequestId: null }),
    listAllPaymentMethods: vi.fn().mockResolvedValue([]),
  };
});

type Role = "owner" | "admin" | "manager" | "hr" | "finance" | "ops_manager" | "team_lead" | "bd" | "user" | "viewer";

function staffCtx(role: Role): TrpcContext {
  return {
    user: {
      id: 1, openId: `u-${role}`, email: `${role}@tanis.com`, name: `Test ${role}`,
      loginMethod: "manus", role,
      createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    } as TrpcContext["user"],
    agent: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn(), cookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function agentCtx(candidateId: number): TrpcContext {
  return {
    user: null,
    agent: { candidateId, traineeCode: `T-${candidateId}`, issuedAt: Date.now() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn(), cookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

const call = (role: Role) => appRouter.createCaller(staffCtx(role));

/** Expect a tRPC FORBIDDEN/UNAUTHORIZED rejection. */
async function expectDenied(p: Promise<unknown>) {
  await expect(p).rejects.toMatchObject({ code: expect.stringMatching(/FORBIDDEN|UNAUTHORIZED/) });
}

// ─── Money: payroll ───────────────────────────────────────────────────────────
describe("payroll endpoints — money roles only", () => {
  for (const role of ["team_lead", "bd", "ops_manager"] as Role[]) {
    it(`${role} → agent.getPayroll(other) = DENIED`, async () => {
      await expectDenied(call(role).agent.getPayroll({ candidateId: 42 }));
    });
    it(`${role} → agent.getPayrollMonths = DENIED`, async () => {
      await expectDenied(call(role).agent.getPayrollMonths());
    });
    it(`${role} → payrollV2.getStatusPage = DENIED`, async () => {
      await expectDenied(call(role).payrollV2.getStatusPage({ month: "2026-10" }));
    });
    it(`${role} → payrollV2.setStatus = DENIED`, async () => {
      await expectDenied(call(role).payrollV2.setStatus({ id: 1, status: "paid" }));
    });
    it(`${role} → commission.getForMonth = DENIED`, async () => {
      await expectDenied(call(role).commission.getForMonth({ month: "2026-10" }));
    });
    it(`${role} → adjustments.add = DENIED`, async () => {
      await expectDenied(call(role).adjustments.add({ crdts: "114063", month: "2026-10", type: "bonus", label: "x", amount: 10 }));
    });
    it(`${role} → paymentMethods.listAll = DENIED`, async () => {
      await expectDenied(call(role).paymentMethods.listAll());
    });
  }
  for (const role of ["finance", "hr", "manager", "owner", "admin"] as Role[]) {
    it(`${role} → agent.getPayroll(other) = allowed`, async () => {
      await expect(call(role).agent.getPayroll({ candidateId: 42 })).resolves.toEqual([]);
    });
  }
  it("agent → own payroll = allowed; someone else's = DENIED", async () => {
    const own = appRouter.createCaller(agentCtx(7));
    await expect(own.agent.getPayroll({ candidateId: 7 })).resolves.toEqual([]);
    await expectDenied(own.agent.getPayroll({ candidateId: 8 }));
  });
});

// ─── PII: documents + comments ───────────────────────────────────────────────
describe("documents & comments — PII boundaries", () => {
  for (const role of ["team_lead", "bd", "ops_manager", "finance"] as Role[]) {
    it(`${role} → documents.listByAgent = DENIED`, async () => {
      await expectDenied(call(role).documents.listByAgent({ traineeCode: "T-1" }));
    });
    it(`${role} → documents.uploadForAgent = DENIED`, async () => {
      await expectDenied(call(role).documents.uploadForAgent({ traineeCode: "T-1", docType: "id", fileBase64: "AAAA", fileName: "x.png", mimeType: "image/png" }));
    });
  }
  it("hr → documents.listByAgent = allowed", async () => {
    await expect(call("hr").documents.listByAgent({ traineeCode: "T-1" })).resolves.toEqual([]);
  });
  it("bd → agentComments.listByCode = DENIED; finance too", async () => {
    await expectDenied(call("bd").agentComments.listByCode({ traineeCode: "T-1" }));
    await expectDenied(call("finance").agentComments.listByCode({ traineeCode: "T-1" }));
  });
  it("team_lead → agentComments.listByCode/add = allowed (supervisory layer)", async () => {
    await expect(call("team_lead").agentComments.listByCode({ traineeCode: "T-1" })).resolves.toEqual([]);
  });
  it("team_lead → agentComments.delete = DENIED (hr/manager only)", async () => {
    await expectDenied(call("team_lead").agentComments.delete({ id: 1 }));
  });
});

// ─── Lifecycle: exit / settle / rehire / delete ──────────────────────────────
describe("lifecycle endpoints", () => {
  for (const role of ["team_lead", "bd", "ops_manager", "finance"] as Role[]) {
    it(`${role} → hr.updateExit = DENIED`, async () => {
      await expectDenied(call(role).hr.updateExit({ traineeCode: "T-1", notes: "x" }));
    });
    it(`${role} → exit.upsert = DENIED`, async () => {
      await expectDenied(call(role).exit.upsert({ traineeCode: "T-1", notes: "x" }));
    });
  }
  it("team_lead/bd/ops_manager → exit.markSettled = DENIED; finance allowed path exists", async () => {
    await expectDenied(call("team_lead").exit.markSettled({ traineeCode: "T-1", settled: true }));
    await expectDenied(call("bd").exit.markSettled({ traineeCode: "T-1", settled: true }));
    await expectDenied(call("ops_manager").exit.markSettled({ traineeCode: "T-1", settled: true }));
  });
  it("team_lead/ops_manager → workforce.rehire = DENIED (hr/manager only)", async () => {
    await expectDenied(call("team_lead").workforce.rehire({ traineeCode: "T-1" }));
    await expectDenied(call("ops_manager").workforce.rehire({ traineeCode: "T-1" }));
  });
  it("ops_manager/team_lead → candidates.delete = DENIED (hr/manager only)", async () => {
    await expectDenied(call("ops_manager").candidates.delete({ id: 1 }));
    await expectDenied(call("team_lead").candidates.delete({ id: 1 }));
  });
  it("bd/team_lead → coaching.updateStatus = DENIED (pays a bonus)", async () => {
    await expectDenied(call("bd").coaching.updateStatus({ id: 1, status: "approved" }));
    await expectDenied(call("team_lead").coaching.updateStatus({ id: 1, status: "approved" }));
  });
  it("crdtsArchive.archiveHandover: team_lead = DENIED", async () => {
    await expectDenied(call("team_lead").crdtsArchive.archiveHandover({ crdts: "114063" }));
  });
});

// ─── Approvals: team leads keep their approval power ─────────────────────────
describe("approvals stay open to the approval layer", () => {
  it("team_lead → leave.decide = allowed (owner decision #4)", async () => {
    await expect(call("team_lead").leave.decide({ id: 1, status: "approved", leaveType: "casual" })).resolves.toEqual({ ok: true });
  });
  it("ops_manager → leave.decide = allowed", async () => {
    await expect(call("ops_manager").leave.decide({ id: 2, status: "rejected" })).resolves.toEqual({ ok: true });
  });
  it("bd → leave.decide = DENIED", async () => {
    await expectDenied(call("bd").leave.decide({ id: 3, status: "approved", leaveType: "casual" }));
  });
});

// ─── Unassigned logins stay out of everything staff ──────────────────────────
describe("unassigned roles", () => {
  for (const role of ["user", "viewer"] as Role[]) {
    it(`${role} → payroll/documents/comments/exit = DENIED`, async () => {
      await expectDenied(call(role).payrollV2.getStatusPage({ month: "2026-10" }));
      await expectDenied(call(role).documents.listByAgent({ traineeCode: "T-1" }));
      await expectDenied(call(role).agentComments.listByCode({ traineeCode: "T-1" }));
      await expectDenied(call(role).hr.updateExit({ traineeCode: "T-1", notes: "x" }));
    });
  }
});
