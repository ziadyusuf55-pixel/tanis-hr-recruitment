/**
 * Pay arithmetic — the ONE place net pay and the final amount owed are defined.
 * Used by: payroll upload validation, the admin table, the agent portal, the
 * printable payslip, exports, and the paid / partial-pay status logic.
 */

export type PayParts = {
  baseSalary?: string | number | null;
  ot1x5Pay?: string | number | null;
  ot2xPay?: string | number | null;
  ot3xPay?: string | number | null;
  coachingBonus?: string | number | null;
  commissionEgp?: string | number | null;
  qualityDeductions?: string | number | null;
  attendanceDeductions?: string | number | null;
  totalDeductions?: string | number | null;
  netPay?: string | number | null;
  amountPaid?: string | number | null;
};

export type PayAdjustment = { type: "bonus" | "deduction" | string; amount: string | number | null };

export const num = (v: unknown): number => {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};
export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Gross earnings before deductions, EXCLUDING commission and manual adjustments. */
export function calcGross(r: PayParts): number {
  return round2(num(r.baseSalary) + num(r.ot1x5Pay) + num(r.ot2xPay) + num(r.ot3xPay) + num(r.coachingBonus));
}

/** Net pay = gross − total deductions. (Same formula as the server edit dialog.) */
export function calcNet(r: PayParts): number {
  return round2(calcGross(r) - num(r.totalDeductions));
}

/** Sum of manual adjustments: bonuses add, deductions subtract. */
export function sumAdjustments(adjs: PayAdjustment[] | null | undefined): number {
  if (!adjs?.length) return 0;
  return round2(adjs.reduce((s, a) => s + (a.type === "deduction" ? -num(a.amount) : num(a.amount)), 0));
}

/**
 * FINAL amount owed to the agent for the month:
 *   stored netPay (or recomputed if missing) + commission + manual adjustments.
 * Every screen that shows "total" and every paid-status check MUST use this.
 */
export function finalPay(r: PayParts, adjs?: PayAdjustment[] | null): number {
  const net = r.netPay == null || r.netPay === "" ? calcNet(r) : num(r.netPay);
  return round2(net + num(r.commissionEgp) + sumAdjustments(adjs));
}

/** What is still owed after partial payments. */
export function remainingOwed(r: PayParts, adjs?: PayAdjustment[] | null): number {
  return round2(Math.max(0, finalPay(r, adjs) - num(r.amountPaid)));
}

/**
 * Validate an uploaded payroll row against its own parts. Returns a list of
 * human-readable problems (empty = OK). Tolerances absorb rounding in the sheet.
 */
export function validatePayrollRow(r: PayParts & { workingHours?: number | null; ot1x5Hours?: number | null; ot2xHours?: number | null; ot3xHours?: number | null }): string[] {
  const problems: string[] = [];
  const nonNeg: Array<[string, unknown]> = [
    ["Base Salary", r.baseSalary], ["Working Hours", r.workingHours],
    ["OT 1.5x Hours", r.ot1x5Hours], ["OT 2x Hours", r.ot2xHours], ["OT 3x Hours", r.ot3xHours],
    ["OT 1.5x Pay", r.ot1x5Pay], ["OT 2x Pay", r.ot2xPay], ["OT 3x Pay", r.ot3xPay],
    ["Coaching Bonus", r.coachingBonus], ["Total Deductions", r.totalDeductions],
  ];
  for (const [label, v] of nonNeg) {
    if (v != null && v !== "" && num(v) < 0) problems.push(`${label} is negative`);
  }
  if (r.workingHours != null && num(r.workingHours) > 400) problems.push(`Working Hours ${num(r.workingHours)} exceeds 400 — looks like a mis-parsed time value`);
  const otHrs = num(r.ot1x5Hours) + num(r.ot2xHours) + num(r.ot3xHours);
  if (otHrs > 200) problems.push(`OT hours total ${otHrs} exceeds 200`);
  if (r.qualityDeductions != null && r.attendanceDeductions != null && r.totalDeductions != null) {
    const parts = num(r.qualityDeductions) + num(r.attendanceDeductions);
    if (Math.abs(parts - num(r.totalDeductions)) > 0.5) {
      problems.push(`Total Deductions ${num(r.totalDeductions)} ≠ quality ${num(r.qualityDeductions)} + attendance ${num(r.attendanceDeductions)}`);
    }
  }
  if (r.netPay != null && r.netPay !== "" && r.baseSalary != null) {
    const expected = calcNet(r);
    if (Math.abs(expected - num(r.netPay)) > 1) {
      problems.push(`NET PAY ${num(r.netPay)} ≠ base + OT + coaching − deductions = ${expected}`);
    }
  }
  return problems;
}
