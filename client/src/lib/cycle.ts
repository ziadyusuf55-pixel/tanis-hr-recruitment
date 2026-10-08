/**
 * Pay-cycle helpers (client side). Cycles run 26th → 25th on the Cairo calendar:
 * a date on the 26th or later belongs to the NEXT month's cycle key.
 * Pure y/m arithmetic — never Date.setMonth, which overflows on the 29th–31st
 * (Jan 29 + 1 month = Mar 1) and used to bucket late-cycle rows a month ahead.
 * Mirrors server/_core/time.ts (cycleKeyFor).
 */

const z = (n: number) => String(n).padStart(2, "0");

/** Cycle key (YYYY-MM) for a YYYY-MM-DD date string. */
export function cycleOfDate(dateStr: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr));
  if (!m) return null;
  let y = +m[1], mo = +m[2];
  if (+m[3] >= 26) { mo += 1; if (mo === 13) { mo = 1; y += 1; } }
  return `${y}-${z(mo)}`;
}

/** The pay cycle "now" falls in, per the Cairo calendar day. */
export function currentCycleMonth(now: Date = new Date()): string {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" });
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(now)) o[p.type] = p.value;
  let y = +o.year, mo = +o.month;
  if (+o.day >= 26) { mo += 1; if (mo === 13) { mo = 1; y += 1; } }
  return `${y}-${z(mo)}`;
}

/** The n most recent cycle keys, newest first, starting at `from` (default: current cycle). */
export function recentCycles(n: number, from: string = currentCycleMonth()): string[] {
  const [fy, fm] = from.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const t = fy * 12 + (fm - 1) - i;
    const y = Math.floor(t / 12), m = (t % 12) + 1;
    return `${y}-${z(m)}`;
  });
}

/** The cycle key before `key`. */
export function prevCycle(key: string): string {
  return recentCycles(2, key)[1];
}

/** The current CALENDAR month key (local clock), YYYY-MM. */
export function currentLocalMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${z(now.getMonth() + 1)}`;
}

/** The n most recent CALENDAR month keys, newest first — pure y/m math, no
 * Date.setMonth (which overflows on the 29th–31st and duplicated/skipped
 * months in dropdowns on month-end days). */
export function recentMonths(n: number, from: string = currentLocalMonth()): string[] {
  return recentCycles(n, from);
}

/** YYYY-MM-DD of "now" on the user's own clock (toISOString gives UTC —
 *  between midnight and 2-3am Cairo that is still YESTERDAY). */
export function localDateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
