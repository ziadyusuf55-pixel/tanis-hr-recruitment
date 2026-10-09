/**
 * Exact leave dates — the ONE place a leave request's days are derived.
 *
 * Audit F12/F13: requests used to store only startDate/endDate/days, so a Monday+Friday
 * request was later treated as Monday–Friday (reports, overlap) and a Dec 31 + Jan 1 request
 * was debited entirely to December's balance. New rows store `leaveDates` (JSON array of
 * YYYY-MM-DD). Legacy rows (leaveDates NULL) keep their old meaning: a contiguous span whose
 * days were debited to the start year — so approving and cancelling stay symmetric.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Strictly validate + de-duplicate + sort a list of YYYY-MM-DD dates. Throws on any bad value. */
export function normalizeLeaveDates(dates: string[]): string[] {
  const out = new Set<string>();
  for (const raw of dates) {
    const d = String(raw).trim().slice(0, 10);
    if (!DATE_RE.test(d)) throw new Error(`Invalid leave date "${raw}"`);
    const ms = Date.parse(`${d}T00:00:00Z`);
    if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== d) throw new Error(`Invalid leave date "${raw}"`);
    out.add(d);
  }
  return Array.from(out).sort();
}

/** Every calendar day from start to end inclusive (YYYY-MM-DD). */
export function spanDates(start: string, end: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  let guard = 0;
  while (cur <= last && guard++ < 400) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

type LeaveRowLike = { startDate: string; endDate: string; days?: number | null; leaveDates?: string | null };

/** The exact dates a stored request covers. Legacy rows → the full calendar span. */
export function leaveDatesOf(row: LeaveRowLike): string[] {
  if (row.leaveDates) {
    try {
      const arr = JSON.parse(row.leaveDates);
      if (Array.isArray(arr) && arr.length) return normalizeLeaveDates(arr.map(String));
    } catch { /* fall through to span */ }
  }
  return spanDates(String(row.startDate).slice(0, 10), String(row.endDate).slice(0, 10));
}

/** Do two requests share at least one actual date? */
export function leaveDatesIntersect(a: string[], b: string[]): boolean {
  const set = new Set(a);
  return b.some(d => set.has(d));
}

/**
 * Balance debit per year. Exact-date rows split by the year of each date; legacy rows debit
 * all `days` to the start year (how they were always debited, so cancellations re-credit correctly).
 */
export function leaveDaysByYear(row: LeaveRowLike): Map<number, number> {
  const m = new Map<number, number>();
  if (row.leaveDates) {
    for (const d of leaveDatesOf(row)) {
      const y = parseInt(d.slice(0, 4), 10);
      m.set(y, (m.get(y) ?? 0) + 1);
    }
    if (m.size) return m;
  }
  const y = parseInt(String(row.startDate).slice(0, 4), 10) || new Date().getUTCFullYear();
  m.set(y, row.days ?? 1);
  return m;
}

/** Working days (not one of the agent's off days) of a request that fall inside [from, to]. */
export function leaveWorkingDaysInRange(row: LeaveRowLike, from: string, to: string, offDay1: number | null, offDay2: number | null): number {
  let n = 0;
  for (const d of leaveDatesOf(row)) {
    if (d < from || d > to) continue;
    const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
    if (dow !== offDay1 && dow !== offDay2) n++;
  }
  return n;
}
