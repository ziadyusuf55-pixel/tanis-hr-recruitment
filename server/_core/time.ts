/**
 * Business-time helpers. Agents work from Egypt, so "today" for AUX, shifts and
 * cycles is the Africa/Cairo calendar day — never the server's UTC day (which
 * rolls over at 02:00/03:00 Cairo and used to split US-shift AUX across two days).
 */
export const BUSINESS_TZ = process.env.BUSINESS_TZ || "Africa/Cairo";

const _fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TZ,
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
});

/** YYYY-MM-DD of the given instant in business time. */
export function businessDateKey(ms: number = Date.now()): string {
  const parts = _fmt.formatToParts(new Date(ms));
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Offset (ms) of the business TZ from UTC at the given instant. */
function tzOffsetMs(ms: number): number {
  const parts = _fmt.formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** [startMs, endMs) of the business-time calendar day `YYYY-MM-DD`. */
export function businessDayBounds(dateKey: string): { start: number; end: number } {
  const [y, m, d] = dateKey.split("-").map(Number);
  const guess = Date.UTC(y!, m! - 1, d!, 0, 0, 0);
  // Two passes handle DST transitions on the day itself.
  let start = guess - tzOffsetMs(guess);
  start = guess - tzOffsetMs(start);
  return { start, end: start + 86_400_000 };
}

// ─── Time-tracking day (Quantum shifts / AUX) ────────────────────────────────
// Quantum agents work US hours. Their "day" for shifts, AUX and productivity is the
// US Eastern calendar day (EST/EDT), so an overnight Cairo shift is one day, not two.
export const TIME_TRACKING_TZ = "America/New_York"; // mirrored in client/src/lib/tz.ts — change both together

const _ttFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_TRACKING_TZ,
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
});

/** YYYY-MM-DD of the given instant in the time-tracking timezone (US Eastern). */
export function ttDateKey(ms: number = Date.now()): string {
  const parts = _ttFmt.formatToParts(new Date(ms));
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function ttOffsetMs(ms: number): number {
  const parts = _ttFmt.formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** [startMs, endMs) of the US-Eastern calendar day `YYYY-MM-DD`. */
export function ttDayBounds(dateKey: string): { start: number; end: number } {
  const [y, m, d] = dateKey.split("-").map(Number);
  const guess = Date.UTC(y!, m! - 1, d!, 0, 0, 0);
  let start = guess - ttOffsetMs(guess);
  start = guess - ttOffsetMs(start);
  // DST days are 23h/25h: compute the end as the start of the next calendar day.
  const next = Date.UTC(y!, m! - 1, d! + 1, 0, 0, 0);
  let end = next - ttOffsetMs(next);
  end = next - ttOffsetMs(end);
  return { start, end };
}

/** Is `dateKey` a well-formed YYYY-MM-DD? */
export function isDateKey(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/**
 * Pay-cycle key for a calendar date. Tanis pays on a 26th→25th cycle: the 26th
 * of month M through the 25th of M+1 belongs to cycle M+1 (YYYY-MM).
 * This is THE definition — every other copy must call this.
 */
export function cycleKeyFor(dateKey: string, cycleStartDay = 26): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey.slice(0, 7);
  let yy = y, mm = m;
  if (d >= cycleStartDay) { mm += 1; if (mm > 12) { mm = 1; yy += 1; } }
  return `${yy}-${String(mm).padStart(2, "0")}`;
}

/** Inclusive [from, to] date keys covered by cycle `YYYY-MM`. */
export function cycleDateRangeFor(cycleKey: string, cycleStartDay = 26): { from: string; to: string } {
  const [y, m] = cycleKey.split("-").map(Number);
  const prevM = m === 1 ? 12 : m! - 1;
  const prevY = m === 1 ? y! - 1 : y!;
  const from = `${prevY}-${String(prevM).padStart(2, "0")}-${String(cycleStartDay).padStart(2, "0")}`;
  const to = `${y}-${String(m).padStart(2, "0")}-${String(cycleStartDay - 1).padStart(2, "0")}`;
  return { from, to };
}
