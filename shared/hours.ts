/**
 * Hours & OT-type normalisation — the ONE implementation used by every upload
 * path (Excel in the browser, Apps Script sheet-push on the server, manual entry).
 *
 * Background: payroll sheets mix "8:48" text, Excel time cells (which arrive as a
 * fraction of a day, 8:48 → 0.3667, or as "166:48" when formatted [h]:mm) and
 * plain decimals. parseFloat("8:48") silently gives 8 and Number("8:48") gives
 * NaN → 0, which under-pays. These helpers never guess: anything that can't be
 * read unambiguously returns null so the caller can REJECT the row.
 */

/**
 * Convert a cell value to decimal hours.
 *
 * @param raw        the value as read from the sheet / request (number or string)
 * @param formatted  optional display text of the same cell (xlsx `raw:false` output).
 *                   When it contains ":" the cell was a time/duration cell and is
 *                   parsed as H:MM[:SS] regardless of `raw`.
 * @returns hours as a number (>= 0), or null when the value is not a valid duration.
 */
export function toDecimalHours(raw: unknown, formatted?: unknown): number | null {
  const fmtStr = typeof formatted === "string" ? formatted.trim() : "";
  if (fmtStr.includes(":")) return parseClock(fmtStr);

  if (raw == null) return 0;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw < 0) return null;
    return raw;
  }
  const s = String(raw).trim().replace(/,/g, "");
  if (s === "" || s === "-" || s === "—") return 0;
  if (s.includes(":")) return parseClock(s);
  // "8h 48m", "8h", "48m"
  const hm = s.match(/^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+)\s*m)?$/i);
  if (hm && (hm[1] || hm[2])) return (Number(hm[1] ?? 0)) + (Number(hm[2] ?? 0)) / 60;
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  return null;
}

/** "H:MM", "H:MM:SS", "166:48" → decimal hours; null if malformed or minutes >= 60. */
function parseClock(s: string): number | null {
  const m = s.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]), se = Number(m[3] ?? 0);
  if (mi >= 60 || se >= 60) return null;
  return h + mi / 60 + se / 3600;
}

/** Excel stores a time-of-day/duration cell as a fraction of a day. Use ONLY when you know the cell is a time cell. */
export function excelDayFractionToHours(frac: number): number {
  return Math.round(frac * 24 * 3600) / 3600;
}

export const OT_TYPES = ["1.5x", "2x", "3x"] as const;
export type OtType = (typeof OT_TYPES)[number];

/**
 * Normalise free-text OT multipliers: "2X", "x2", "2.0", "2.0x", " 1,5x " → "2x" / "1.5x".
 * Returns null for blank or unrecognised values — callers decide whether to default or reject.
 */
export function normalizeOtType(v: unknown): OtType | null {
  if (v == null) return null;
  let s = String(v).trim().toLowerCase().replace(/\s+/g, "").replace(",", ".");
  if (!s) return null;
  s = s.replace(/^x/, "").replace(/x$/, "").replace(/×/g, "");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (Math.abs(n - 1.5) < 1e-9) return "1.5x";
  if (Math.abs(n - 2) < 1e-9) return "2x";
  if (Math.abs(n - 3) < 1e-9) return "3x";
  return null;
}

/** Round to 2 dp for storage in DECIMAL(…,2) columns. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
