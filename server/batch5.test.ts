/**
 * Batch 5 regression tests — one per audit finding that can be proven without a live database.
 * Mirrors the Oct-9 audit probes, but asserts the FIXED behaviour.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";

const state = vi.hoisted(() => ({ rows: [] as unknown[], updated: false, throwOnSelect: false }));

vi.mock("./_core/portalLock", () => ({ getPortalLock: vi.fn(async () => ({ locked: false })), invalidatePortalLockCache: vi.fn() }));
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: vi.fn() } }));
vi.mock("./db", async (original) => {
  const actual = await original<typeof import("./db")>();
  const chain = () => {
    const c: Record<string, unknown> = {};
    for (const k of ["from", "where", "orderBy", "limit", "set", "for"]) c[k] = () => c;
    c.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      (state.throwOnSelect ? Promise.reject(new Error("db down")) : Promise.resolve(state.rows)).then(resolve, reject);
    return c;
  };
  return {
    ...actual,
    getDb: vi.fn(async () => ({ select: chain, update: () => { state.updated = true; return chain(); } })),
    getContractByCode: vi.fn(async () => ({ traineeCode: "T-1", contractType: "permanent", startDate: "2026-01-01", notes: "Private notes", isMedicallyInsured: true, isSociallyInsured: false })),
    listAllContracts: vi.fn(async () => [{ traineeCode: "T-1", notes: "Private", isMedicallyInsured: true, isSociallyInsured: true }]),
    auditEntry: vi.fn(async () => undefined),
  };
});

import { appRouter } from "./routers";
import { ENV } from "./_core/env";
import { resolveAgentSession, invalidateAgentSessionCache } from "./_core/agentAuth";
import { createContext } from "./_core/context";
import { sdk } from "./_core/sdk";
import { businessDayBounds, businessDayEndMs } from "./_core/time";
import { leaveDatesOf, leaveDaysByYear, leaveWorkingDaysInRange, normalizeLeaveDates, leaveDatesIntersect } from "./leaveDates";

const ctx = (role: string) => ({
  user: { id: 1, openId: "u1", role, name: "Staff", email: "staff@example.com" },
  agent: null, req: { headers: {}, protocol: "https" }, res: { cookie: vi.fn(), clearCookie: vi.fn() },
} as never);

beforeEach(() => { state.rows = []; state.updated = false; state.throwOnSelect = false; invalidateAgentSessionCache(); });

describe("F01 — removed users stay removed", () => {
  it("a viewer with an active BD link is NOT promoted to bd", async () => {
    vi.mocked(sdk.authenticateRequest).mockResolvedValue({ id: 1, openId: "u1", role: "viewer" } as never);
    state.rows = [{ id: 55 }];
    const c = await createContext({ req: { headers: {} }, res: {} } as never);
    expect(c.user?.role).toBe("viewer");
  });
  it("an unassigned 'user' with an active BD link is still promoted", async () => {
    vi.mocked(sdk.authenticateRequest).mockResolvedValue({ id: 1, openId: "u1", role: "user" } as never);
    state.rows = [{ id: 55 }];
    const c = await createContext({ req: { headers: {} }, res: {} } as never);
    expect(c.user?.role).toBe("bd");
  });
});

describe("F02 — money and contract reads are role-guarded", () => {
  it("BD cannot read payroll adjustments", async () => {
    await expect(appRouter.createCaller(ctx("bd")).adjustments.getForMonth({ month: "2026-10" })).rejects.toThrow();
  });
  it("finance can read payroll adjustments", async () => {
    state.rows = [];
    await expect(appRouter.createCaller(ctx("finance")).adjustments.getForMonth({ month: "2026-10" })).resolves.toEqual([]);
  });
  it("BD cannot read contracts", async () => {
    await expect(appRouter.createCaller(ctx("bd")).contracts.getByCode({ traineeCode: "T-1" })).rejects.toThrow();
  });
  it("team lead gets contract dates but no notes or insurance flags", async () => {
    const c = await appRouter.createCaller(ctx("team_lead")).contracts.getByCode({ traineeCode: "T-1" }) as Record<string, unknown>;
    expect(c.startDate).toBe("2026-01-01");
    expect(c.notes).toBeNull();
    expect(c.isMedicallyInsured).toBeNull();
  });
  it("HR gets the full contract", async () => {
    const c = await appRouter.createCaller(ctx("hr")).contracts.getByCode({ traineeCode: "T-1" }) as Record<string, unknown>;
    expect(c.notes).toBe("Private notes");
  });
});

describe("F03 — HR info writes use the profile-write policy", () => {
  for (const role of ["finance", "bd", "team_lead"]) {
    it(`${role} cannot update emergency contacts`, async () => {
      await expect(appRouter.createCaller(ctx(role)).workforce.updateHrInfo({ traineeCode: "T-1", emergencyContactPhone: "1" })).rejects.toThrow();
      expect(state.updated).toBe(false);
    });
  }
});

describe("F04 — agent auth fails closed", () => {
  const token = () => jwt.sign({ type: "agent", candidateId: 1, traineeCode: "T-x" }, ENV.cookieSecret, { expiresIn: "1h" });
  it("rejects a valid token whose workforce row is gone", async () => {
    state.rows = [];
    expect(await resolveAgentSession({ headers: { cookie: `tanis_agent_session=${token()}` } } as never)).toBeNull();
  });
  it("rejects during a database failure", async () => {
    state.throwOnSelect = true;
    expect(await resolveAgentSession({ headers: { cookie: `tanis_agent_session=${token()}` } } as never)).toBeNull();
  });
  it("accepts an active agent", async () => {
    state.rows = [{ sessionRevokedAt: null, agentStatus: "active", isDemo: false, candidateId: 1 }];
    expect(await resolveAgentSession({ headers: { cookie: `tanis_agent_session=${token()}` } } as never)).toMatchObject({ traineeCode: "T-x" });
  });
});

describe("F08 — malformed money is rejected", () => {
  it("updateRecord refuses '100abc'", async () => {
    await expect(appRouter.createCaller(ctx("finance")).payrollV2.updateRecord({ id: 1, data: { baseSalary: "100abc" } }))
      .rejects.toThrow(/plain number/);
  });
  it("upload refuses a row with no Base Salary", async () => {
    await expect(appRouter.createCaller(ctx("finance")).payrollV2.uploadPayrollV2({ month: "2026-10", rows: [{ crdts: "1", netPay: 100 }] }))
      .rejects.toThrow();
  });
});

describe("F12/F13 — exact leave dates", () => {
  const monFri = { startDate: "2026-11-02", endDate: "2026-11-06", days: 2, leaveDates: JSON.stringify(["2026-11-02", "2026-11-06"]) };
  it("Mon+Fri covers two dates, not five", () => {
    expect(leaveDatesOf(monFri)).toEqual(["2026-11-02", "2026-11-06"]);
    expect(leaveWorkingDaysInRange(monFri, "2026-11-01", "2026-11-30", 5, 6)).toBe(1); // Fri is an off day here
  });
  it("a Wednesday request does not overlap Mon+Fri", () => {
    expect(leaveDatesIntersect(leaveDatesOf(monFri), ["2026-11-04"])).toBe(false);
  });
  it("Dec 31 + Jan 1 debits one day to each year", () => {
    const m = leaveDaysByYear({ startDate: "2026-12-31", endDate: "2027-01-01", days: 2, leaveDates: JSON.stringify(["2026-12-31", "2027-01-01"]) });
    expect(Object.fromEntries(m)).toEqual({ 2026: 1, 2027: 1 });
  });
  it("legacy rows keep debiting the start year (symmetric with how they were approved)", () => {
    expect(Object.fromEntries(leaveDaysByYear({ startDate: "2026-12-31", endDate: "2027-01-01", days: 2, leaveDates: null }))).toEqual({ 2026: 2 });
  });
  it("invalid dates are rejected", () => {
    expect(() => normalizeLeaveDates(["2026-02-30"])).toThrow();
  });
});

describe("F14 — notice rule applies to timestamp submissions", () => {
  it("a same-day resignation sent as a timestamp is refused", async () => {
    const agentCtx = { user: null, agent: { candidateId: 1, traineeCode: "T-1", issuedAt: Date.now() }, req: { headers: {} }, res: {} } as never;
    await expect(appRouter.createCaller(agentCtx).requests.submit({ type: "resignation", subject: "Today", message: "Leaving", requestedDate: Date.now() }))
      .rejects.toThrow(/2 weeks/);
  });
});

describe("F18 — Cairo day bounds follow DST", () => {
  it("separation on July 1 ends at 23:59:59 Cairo (UTC+3), not 00:59:59 next day", () => {
    expect(new Date(businessDayEndMs("2026-07-01")).toISOString()).toBe("2026-07-01T20:59:59.999Z");
  });
  it("Oct 29 2026 (DST end) is a 25-hour day", () => {
    const b = businessDayBounds("2026-10-29");
    expect((b.end - b.start) / 3600000).toBe(25);
  });
});
