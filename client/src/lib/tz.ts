/**
 * Time-tracking timezone helpers (client side).
 * Quantum works US hours: every shift / AUX time in the Hub is shown in US Eastern (EST/EDT),
 * and the "day" of a shift is the Eastern calendar day. Mirrors server/_core/time.ts (ttDateKey/ttDayBounds).
 */
export const TT_TZ = "America/New_York";
export const TT_TZ_LABEL = "ET";

const parts = (ms: number) => {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: TT_TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(new Date(ms))) o[p.type] = p.value;
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute, s: +o.second };
};

/** YYYY-MM-DD of an instant in Eastern time. */
export function etDateKey(ms: number = Date.now()): string {
  const p = parts(ms); const z = (n: number) => String(n).padStart(2, "0");
  return `${p.y}-${z(p.m)}-${z(p.d)}`;
}
/** YYYY-MM of an instant in Eastern time. */
export const etMonthKey = (ms: number = Date.now()) => etDateKey(ms).slice(0, 7);

/** "YYYY-MM-DDTHH:MM" in Eastern time, for <input type="datetime-local">. */
export function etToInput(ms: number | null): string {
  if (ms == null) return "";
  const p = parts(ms); const z = (n: number) => String(n).padStart(2, "0");
  return `${p.y}-${z(p.m)}-${z(p.d)}T${z(p.h)}:${z(p.mi)}`;
}

/** Parse "YYYY-MM-DDTHH:MM" (or with a space) given in Eastern time → epoch ms. NaN if malformed. */
export function etFromInput(v: string): number {
  const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return NaN;
  if (+m[2] < 1 || +m[2] > 12 || +m[3] < 1 || +m[3] > 31 || +m[4] > 23 || +m[5] > 59) return NaN;
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
  const offAt = (ms: number) => { const p = parts(ms); return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000; };
  let ms = wall - offAt(wall);
  ms = wall - offAt(ms); // second pass for DST edges
  return ms;
}

export const fmtEtTime = (ms: number, withSeconds = false) =>
  new Date(ms).toLocaleTimeString("en-US", { timeZone: TT_TZ, hour: "2-digit", minute: "2-digit", ...(withSeconds ? { second: "2-digit" } : {}) });
export const fmtEtDateTime = (ms: number) =>
  new Date(ms).toLocaleString("en-US", { timeZone: TT_TZ, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
export const fmtEtDate = (ms: number) => new Date(ms).toLocaleDateString("en-US", { timeZone: TT_TZ });
export const fmtEtFull = (ms: number) => new Date(ms).toLocaleString("en-US", { timeZone: TT_TZ, month: "numeric", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
