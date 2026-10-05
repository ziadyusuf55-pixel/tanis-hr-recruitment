import { describe, expect, it } from "vitest";
import { toDecimalHours, normalizeOtType } from "../shared/hours";
import { calcNet, finalPay, remainingOwed, validatePayrollRow } from "../shared/pay";
import { cycleKeyFor, cycleDateRangeFor, businessDateKey, businessDayBounds } from "./_core/time";

describe("toDecimalHours — the h:mm bug family", () => {
  it("parses H:MM text exactly (8:48 → 8.8, not 8)", () => {
    expect(toDecimalHours("8:48")).toBeCloseTo(8.8, 6);
    expect(toDecimalHours("166:48")).toBeCloseTo(166.8, 6);
    expect(toDecimalHours("0:30")).toBeCloseTo(0.5, 6);
    expect(toDecimalHours("8:48:30")).toBeCloseTo(8.808333, 5);
  });
  it("uses the formatted text when the raw value is an Excel day-fraction", () => {
    expect(toDecimalHours(0.36666666, "8:48")).toBeCloseTo(8.8, 6);
    expect(toDecimalHours(6.95, "166:48")).toBeCloseTo(166.8, 6);
  });
  it("accepts plain decimals and 'Xh Ym'", () => {
    expect(toDecimalHours(8.5)).toBe(8.5);
    expect(toDecimalHours("8.5")).toBe(8.5);
    expect(toDecimalHours("1,234.5")).toBe(1234.5);
    expect(toDecimalHours("8h 48m")).toBeCloseTo(8.8, 6);
  });
  it("treats blanks as 0 and REJECTS garbage (null), never silently 0", () => {
    expect(toDecimalHours("")).toBe(0);
    expect(toDecimalHours(null)).toBe(0);
    expect(toDecimalHours("abc")).toBeNull();
    expect(toDecimalHours("8:75")).toBeNull();
    expect(toDecimalHours(-1)).toBeNull();
    expect(toDecimalHours(NaN)).toBeNull();
  });
});

describe("normalizeOtType", () => {
  it("collapses every spelling onto 1.5x / 2x / 3x", () => {
    for (const v of ["1.5x", "1.5X", " x1.5 ", "1,5x", "1.5", 1.5]) expect(normalizeOtType(v)).toBe("1.5x");
    for (const v of ["2x", "2X", "x2", "2.0x", "2", 2]) expect(normalizeOtType(v)).toBe("2x");
    for (const v of ["3x", "X3", 3]) expect(normalizeOtType(v)).toBe("3x");
  });
  it("returns null for blank or unknown multipliers (caller decides)", () => {
    expect(normalizeOtType("")).toBeNull();
    expect(normalizeOtType(null)).toBeNull();
    expect(normalizeOtType("double")).toBeNull();
    expect(normalizeOtType("4x")).toBeNull();
  });
});

describe("pay arithmetic — one formula everywhere", () => {
  const rec = { baseSalary: "10000", ot1x5Pay: "1500", ot2xPay: "0", ot3xPay: "0", coachingBonus: "200", totalDeductions: "300", netPay: "11400", commissionEgp: "800", amountPaid: "5000" };
  it("calcNet = base + OT + coaching − deductions", () => {
    expect(calcNet(rec)).toBe(11400);
  });
  it("finalPay = net + commission + adjustments", () => {
    expect(finalPay(rec)).toBe(12200);
    expect(finalPay(rec, [{ type: "bonus", amount: 100 }, { type: "deduction", amount: "50" }])).toBe(12250);
  });
  it("remainingOwed subtracts partial payments and never goes negative", () => {
    expect(remainingOwed(rec)).toBe(7200);
    expect(remainingOwed({ ...rec, amountPaid: "99999" })).toBe(0);
  });
  it("validatePayrollRow catches the audit's silent-pay cases", () => {
    expect(validatePayrollRow(rec)).toEqual([]);
    expect(validatePayrollRow({ ...rec, netPay: "9000" }).join(" ")).toMatch(/NET PAY/);
    expect(validatePayrollRow({ ...rec, qualityDeductions: "100", attendanceDeductions: "100", totalDeductions: "300" }).join(" ")).toMatch(/Total Deductions/);
    expect(validatePayrollRow({ ...rec, workingHours: 6.95 * 100 }).join(" ")).toMatch(/Working Hours/);
    expect(validatePayrollRow({ ...rec, baseSalary: "-5" }).join(" ")).toMatch(/negative/);
  });
});

describe("pay cycle — 26th → 25th, ONE definition", () => {
  it("files the 26th–31st into the NEXT month's cycle", () => {
    expect(cycleKeyFor("2026-06-25")).toBe("2026-06");
    expect(cycleKeyFor("2026-06-26")).toBe("2026-07");
    expect(cycleKeyFor("2026-12-26")).toBe("2027-01");
    expect(cycleKeyFor("2026-12-31")).toBe("2027-01");
    expect(cycleKeyFor("2027-01-01")).toBe("2027-01");
  });
  it("round-trips through cycleDateRangeFor", () => {
    expect(cycleDateRangeFor("2026-07")).toEqual({ from: "2026-06-26", to: "2026-07-25" });
    expect(cycleDateRangeFor("2027-01")).toEqual({ from: "2026-12-26", to: "2027-01-25" });
  });
});

describe("business day (Africa/Cairo) — AUX 'today' must not roll at UTC midnight", () => {
  it("23:30 UTC is already the next calendar day in Cairo", () => {
    // 2026-07-01T23:30Z = 2026-07-02 02:30 Cairo (UTC+3 in summer)
    expect(businessDateKey(Date.UTC(2026, 6, 1, 23, 30))).toBe("2026-07-02");
    expect(new Date(Date.UTC(2026, 6, 1, 23, 30)).toISOString().slice(0, 10)).toBe("2026-07-01"); // the old (wrong) answer
  });
  it("day bounds cover exactly 24h and contain the instant", () => {
    const t = Date.UTC(2026, 6, 1, 23, 30);
    const { start, end } = businessDayBounds(businessDateKey(t));
    expect(end - start).toBe(86_400_000);
    expect(t).toBeGreaterThanOrEqual(start);
    expect(t).toBeLessThan(end);
  });
});
