import type { Request } from "express";
import { getDb } from "./db";
import { sessionLogs } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// ─── UA parsing ──────────────────────────────────────────────────────────────

function parseUA(ua: string): { browser: string; os: string; deviceType: "desktop" | "mobile" | "tablet" | "unknown" } {
  const s = ua.toLowerCase();

  // Device type
  let deviceType: "desktop" | "mobile" | "tablet" | "unknown" = "unknown";
  if (/tablet|ipad|playbook|silk/.test(s)) deviceType = "tablet";
  else if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile|wpdesktop/.test(s)) deviceType = "mobile";
  else if (/windows|macintosh|linux|x11/.test(s)) deviceType = "desktop";

  // Browser
  let browser = "Unknown";
  if (s.includes("edg/") || s.includes("edge/")) browser = "Edge";
  else if (s.includes("opr/") || s.includes("opera")) browser = "Opera";
  else if (s.includes("chrome") && !s.includes("chromium")) browser = "Chrome";
  else if (s.includes("firefox")) browser = "Firefox";
  else if (s.includes("safari") && !s.includes("chrome")) browser = "Safari";
  else if (s.includes("trident") || s.includes("msie")) browser = "IE";

  // OS
  let os = "Unknown";
  if (s.includes("windows nt 10")) os = "Windows 10/11";
  else if (s.includes("windows nt 6.3")) os = "Windows 8.1";
  else if (s.includes("windows nt 6.1")) os = "Windows 7";
  else if (s.includes("windows")) os = "Windows";
  else if (s.includes("iphone os")) os = "iOS";
  else if (s.includes("ipad")) os = "iPadOS";
  else if (s.includes("mac os x")) os = "macOS";
  else if (s.includes("android")) os = "Android";
  else if (s.includes("linux")) os = "Linux";

  return { browser, os, deviceType };
}

// ─── IP extraction ────────────────────────────────────────────────────────────

function extractIp(req: Request): string {
  // req.ip respects Express "trust proxy" (1 hop) — unlike raw X-Forwarded-For,
  // a client cannot spoof it past the real proxy.
  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
}

// ─── Geolocation via ip-api.com (free, no key) ───────────────────────────────

interface GeoResult {
  country: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
}

async function geolocate(ip: string): Promise<GeoResult> {
  const blank: GeoResult = { country: null, city: null, lat: null, lng: null };
  // Skip private/loopback IPs
  if (!ip || ip === "unknown" || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|localhost)/.test(ip)) {
    return blank;
  }
  try {
    // HTTPS endpoint — staff IPs must not transit in cleartext.
    const res = await fetch(`https://ipwho.is/${ip}?fields=success,country,city,latitude,longitude`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return blank;
    const data = (await res.json()) as { success?: boolean; country?: string; city?: string; latitude?: number; longitude?: number };
    if (!data.success) return blank;
    return {
      country: data.country ?? null,
      city: data.city ?? null,
      lat: data.latitude ?? null,
      lng: data.longitude ?? null,
    };
  } catch {
    return blank;
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function logSession(req: Request, userId: string, userName: string | null): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const ua = req.headers["user-agent"] ?? "";
  const ip = extractIp(req);
  const { browser, os, deviceType } = parseUA(ua);
  const geo = await geolocate(ip);

  await db.insert(sessionLogs).values({
    userId,
    userName,
    ip,
    country: geo.country,
    city: geo.city,
    lat: geo.lat !== null ? String(geo.lat) : null,
    lng: geo.lng !== null ? String(geo.lng) : null,
    deviceType,
    browser,
    os,
    userAgent: ua.slice(0, 1000),
    loggedInAt: Date.now(),
    lastSeenAt: Date.now(),
  });
}

// ─── DB helpers for the router ───────────────────────────────────────────────

export async function listSessionLogs() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(sessionLogs)
    .limit(200);
  // Sort newest first
  return rows.sort((a, b) => (b.loggedInAt ?? 0) - (a.loggedInAt ?? 0));
}

export async function getSessionLogById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(sessionLogs).where(eq(sessionLogs.id, id)).limit(1);
  return row ?? null;
}

export async function revokeSessionLog(id: number, revokedBy: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(sessionLogs)
    .set({ revokedAt: Date.now(), revokedBy })
    .where(eq(sessionLogs.id, id));
}
