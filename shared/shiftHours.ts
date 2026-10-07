/**
 * Shift-hours string parsing — ONE implementation for the roster, Monthly Hours and validation.
 * Accepts the formats people actually type: "9:00 AM - 5:00 PM", "9AM–5PM", "9 am to 5 pm", "16:00-01:00",
 * "4pm - 1am". Overnight ranges (end before start) wrap past midnight.
 */
export type ShiftRange = { startMin: number; endMin: number; hours: number };

function toMinutes(h: string, m: string | undefined, ampm: string | undefined): number | null {
  let hh = Number(h); const mm = Number(m ?? 0);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || mm > 59) return null;
  if (ampm) {
    if (hh < 1 || hh > 12) return null;
    hh = (hh % 12) + (/p/i.test(ampm) ? 12 : 0);
  } else if (hh > 23) return null;
  return hh * 60 + mm;
}

/** Parse a shift string. Returns null when it cannot be read unambiguously. */
export function parseShiftHours(raw: string | null | undefined): ShiftRange | null {
  if (!raw) return null;
  const s = raw.trim().replace(/–|—|−/g, "-").replace(/\s+/g, " ");
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?\s*(?:-|to)\s*(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?$/i);
  if (!m) return null;
  const [, h1, m1, ap1, h2, m2, ap2] = m;
  // "9-5pm": a lone suffix applies to the end only; the start is read as AM (a resulting >16h span is rejected below).
  const start = toMinutes(h1!, m1, ap1 ?? (ap2 && Number(h1) <= 12 ? "am" : undefined));
  const end = toMinutes(h2!, m2, ap2);
  if (start == null || end == null) return null;
  let diff = end - start;
  if (diff <= 0) diff += 24 * 60;
  if (diff > 16 * 60) return null; // nobody is scheduled 17h+ — almost certainly a typo
  return { startMin: start, endMin: end, hours: diff / 60 };
}

/** Daily scheduled hours, 0 when unreadable. */
export function shiftHoursPerDay(raw: string | null | undefined): number {
  return parseShiftHours(raw)?.hours ?? 0;
}

/** Canonical display form, e.g. "9:00 AM - 5:00 PM"; returns the input trimmed when unparseable. */
export function normalizeShiftHours(raw: string | null | undefined): string {
  const r = parseShiftHours(raw);
  if (!r) return (raw ?? "").trim();
  const fmt = (min: number) => { const h24 = Math.floor(min / 60) % 24, mm = min % 60; const h12 = h24 % 12 === 0 ? 12 : h24 % 12; return `${h12}:${String(mm).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`; };
  return `${fmt(r.startMin)} - ${fmt(r.endMin)}`;
}
