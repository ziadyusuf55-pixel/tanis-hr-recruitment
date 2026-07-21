import type { Request } from "express";
import { db as drizzleDb } from "./_core/db";
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
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  if (Array.isArray(forwarded)) return forwarded[0].trim();
  return req.socket?.remoteAddress ?? "unknown";
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
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,city,lat,lon`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return blank;
    const data = (await res.json()) as { status: string; country?: string; city?: string; lat?: number; lon?: number };
    if (data.status !== "success") return blank;
    return {
      country: data.country ?? null,
      city: data.city ?? null,
      lat: data.lat ?? null,
      lng: data.lon ?? null,
    };
  } catch {
    return blank;
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function logSession(req: Request, userId: string, userName: string | null): Promise<void> {
  const ua = req.headers["user-agent"] ?? "";
  const ip = extractIp(req);
  const { browser, os, deviceType } = parseUA(ua);
  const geo = await geolocate(ip);

  await drizzleDb.insert(sessionLogs).values({
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

export async function listSessionLogs(userId?: string) {
  const rows = await drizzleDb
    .select()
    .from(sessionLogs)
    .orderBy(sessionLogs.loggedInAt)
    .limit(200);
  // Sort newest first (drizzle desc import not always available)
  return rows.reverse();
}

export async function revokeSessionLog(id: number, revokedBy: string) {
  await drizzleDb
    .update(sessionLogs)
    .set({ revokedAt: Date.now(), revokedBy })
    .where(eq(sessionLogs.id, id));
}
