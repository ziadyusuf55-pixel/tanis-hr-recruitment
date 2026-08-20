import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

// ─── In-memory rate limiters (no external dep needed) ──────────────────────
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
function rateLimit(key: string, maxPerMinute: number): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + 60_000 });
    return false; // not limited
  }
  entry.count++;
  return entry.count > maxPerMinute;
}
// Clean stale keys every 5 min
setInterval(() => { const now = Date.now(); rateLimitStore.forEach((v, k) => { if (now > v.resetAt) rateLimitStore.delete(k); }); }, 5 * 60 * 1000).unref();

// Process due separations every hour — applies scheduled resignations/terminations whose effectiveDate has passed
const runDueSeparations = async () => {
  try {
    const { processDueSeparations } = await import("../db");
    const n = await processDueSeparations();
    if (n > 0) console.log(`[separations] Applied ${n} due separation(s)`);
  } catch (e) { console.error("[separations] processDueSeparations error:", e); }
};
runDueSeparations(); // run on startup to catch any missed separations
setInterval(runDueSeparations, 60 * 60 * 1000).unref(); // then every hour

// Daily: auto-create leave balance for agents who reached 7 months of service
const checkLeaveEligibility = async () => {
  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return;
    const { sql } = await import("drizzle-orm");
    const sevenMonthsAgo = new Date();
    sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 7);
    const year = new Date().getFullYear();
    const rows = await db.execute(sql`
      SELECT wa.traineeCode, wa.fullName
      FROM workforce_agents wa
      WHERE wa.agentStatus = 'active'
        AND (wa.isDemo = false OR wa.isDemo IS NULL)
        AND wa.joinDate IS NOT NULL
        AND wa.joinDate <= ${sevenMonthsAgo.toISOString().slice(0,10)}
        AND NOT EXISTS (
          SELECT 1 FROM leave_balances lb
          WHERE lb.traineeCode = wa.traineeCode AND lb.year = ${year}
        )
    `) as unknown as { rows?: Array<Record<string,unknown>> } | Array<Record<string,unknown>>;
    const eligible = Array.isArray(rows) ? rows : ((rows as { rows?: Array<Record<string,unknown>> }).rows ?? []);
    if (eligible.length > 0) {
      console.log(`[LeaveEligibility] Creating leave balance for ${eligible.length} agent(s) who reached 7 months`);
      const { leaveBalances } = await import("../../drizzle/schema");
      for (const agent of eligible) {
        const code = String(agent.traineeCode ?? "");
        if (!code) continue;
        await db.insert(leaveBalances).values({ traineeCode: code, year, casualTotal: 6, annualTotal: 21, casualUsed: 0, annualUsed: 0, updatedAt: Date.now() }).catch(() => {});
      }
    }
  } catch (e) { console.error("[LeaveEligibility] error:", e); }
};
checkLeaveEligibility();
setInterval(checkLeaveEligibility, 24 * 60 * 60 * 1000).unref(); // daily

async function startServer() {
  const app = express();
  const server = createServer(app);

  // ── CORS — restrict to hub domain in production ──
  app.use((req, res, next) => {
    const allowedOrigin = process.env.ALLOWED_ORIGIN ?? "https://hub.tanis-eg.com";
    const origin = req.headers.origin;
    if (!origin || origin === allowedOrigin || process.env.NODE_ENV !== "production") {
      res.setHeader("Access-Control-Allow-Origin", origin || "*");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-API-Key");
    }
    if (req.method === "OPTIONS") { res.status(204).end(); return; }
    next();
  });

  // ── Security headers (no helmet needed — manual is fine for this stack) ──
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; font-src 'self' https:;"
    );
    next();
  });

  // ── Global rate limit: 300 req/min per IP (stops scrapers & brute-force) ──
  app.use((req, res, next) => {
    const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "unknown";
    if (rateLimit(`global:${ip}`, 300)) {
      res.status(429).json({ error: "Too many requests — please slow down." });
      return;
    }
    next();
  });

  // ── Strict rate limit on auth endpoints (10 attempts/min per IP) ──
  const AUTH_PATHS = ["/api/oauth", "/api/trpc/agent.login", "/api/trpc/adminAuth"];
  app.use((req, res, next) => {
    const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "unknown";
    if (AUTH_PATHS.some(p => req.path.startsWith(p)) && rateLimit(`auth:${ip}`, 10)) {
      res.status(429).json({ error: "Too many login attempts — try again in a minute." });
      return;
    }
    next();
  });

  // ── Reject oversized bodies early (before JSON parse) — blocks memory bombs ──
  app.use((req, res, next) => {
    const ct = req.headers["content-type"] ?? "";
    const isUpload = req.path.startsWith("/api/upload") || req.path.includes("upload-doc");
    const limit = isUpload ? 52_428_800 : 524_288; // 50 MB for uploads, 512 KB for everything else
    const claimed = parseInt(req.headers["content-length"] ?? "0", 10);
    if (claimed > limit) {
      res.status(413).json({ error: "Request body too large." });
      return;
    }
    next();
  });

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb", verify: (req, _res, buf) => { (req as unknown as { rawBody?: Buffer }).rawBody = buf; } }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // Legacy migration endpoints removed — use drizzle-kit migrate instead

    // File upload endpoint for agent documents
  app.post("/api/upload-doc", async (req, res) => {
    try {
      const busboy = (await import("busboy")).default;
      const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
      const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf", "image/gif"]);
      const bb = busboy({ headers: req.headers, limits: { fileSize: MAX_FILE_SIZE } });
      const chunks: Buffer[] = [];
      let mimeType = "application/octet-stream";
      let fileName = "upload";
      let fileTooLarge = false;
      let typeRejected = false;
      bb.on("file", (_field: string, file: NodeJS.ReadableStream, info: { filename: string; mimeType: string }) => {
        mimeType = info.mimeType;
        fileName = info.filename || "upload";
        if (!ALLOWED_TYPES.has(mimeType.toLowerCase())) { typeRejected = true; file.resume(); return; }
        file.on("data", (chunk: Buffer) => chunks.push(chunk));
        file.on("limit", () => { fileTooLarge = true; chunks.length = 0; });
      });
      bb.on("finish", async () => {
        try {
          if (typeRejected) { res.status(415).json({ error: "File type not allowed. Use JPEG, PNG, WebP, GIF, or PDF." }); return; }
          if (fileTooLarge) { res.status(413).json({ error: "File too large. Maximum size is 5MB." }); return; }
          const { storagePut } = await import("../storage");
          const buf = Buffer.concat(chunks);
          const ext = fileName.split(".").pop() ?? "bin";
          const key = `agent-docs/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const { url } = await storagePut(key, buf, mimeType);
          res.json({ url, key });
        } catch (err) {
          res.status(500).json({ error: String(err) });
        }
      });
      bb.on("error", (err: Error) => res.status(500).json({ error: String(err) }));
      req.pipe(bb);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Google OAuth initiate route
  app.get("/api/oauth/google", (req, res) => {
    // Get frontend origin from query param (passed by frontend)
    const origin = (req.query.origin as string) || "";
    const incomingState = req.query.state as string | undefined;
    const redirectUri = `${origin}/api/oauth/google/callback`;
    const scopes = [
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" ");
    // Preserve userId from frontend state if provided, otherwise build fresh state
    let stateObj: Record<string, string> = { origin };
    if (incomingState) {
      try { stateObj = { ...JSON.parse(Buffer.from(incomingState, "base64").toString()), origin }; } catch {}
    }
    const state = Buffer.from(JSON.stringify(stateObj)).toString("base64");
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID ?? "");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", state);
    res.redirect(authUrl.toString());
  });

  // Google OAuth callback route
  app.get("/api/oauth/google/callback", async (req, res) => {
    try {
      const code = req.query.code as string;
      const stateRaw = req.query.state as string;
      if (!code) { res.status(400).send("Missing code"); return; }
      let origin = "";
      let stateParam: Record<string, string> = {};
      try {
        stateParam = JSON.parse(Buffer.from(stateRaw, "base64").toString());
        origin = stateParam.origin ?? "";
      } catch {}
      const redirectUri = `${origin}/api/oauth/google/callback`;

      // Exchange code for tokens
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID ?? "",
          client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });
      const tokenData = await tokenRes.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string };
      if (!tokenData.access_token) {
        res.status(400).send(`Google OAuth error: ${tokenData.error || "no access_token"}`);
        return;
      }

      // Store tokens in DB — keyed per user so each admin has their own calendar connection
      const { getDb } = await import("../db");
      const db = await getDb();
      if (db) {
        const { integrationsTokens } = await import("../../drizzle/schema");
        const { sql } = await import("drizzle-orm");
        const now = Date.now();
        // Extract userId from state param (passed in OAuth initiation URL)
        const userId = stateParam?.userId ?? null;
        await db.execute(sql`
          INSERT INTO integrations_tokens (provider, userId, access_token, refresh_token, expires_at, scope, created_at, updated_at)
          VALUES ('google', ${userId}, ${tokenData.access_token}, ${tokenData.refresh_token ?? null}, ${now + (tokenData.expires_in ?? 3600) * 1000}, ${tokenData.scope ?? null}, ${now}, ${now})
          ON DUPLICATE KEY UPDATE
            access_token = VALUES(access_token),
            refresh_token = COALESCE(VALUES(refresh_token), refresh_token),
            expires_at = VALUES(expires_at),
            scope = VALUES(scope),
            updated_at = VALUES(updated_at)
        `);
      }

      // Redirect back to the integrations settings page
      res.redirect(`${origin}/settings?tab=integrations&google=connected`);
    } catch (err) {
      console.error("Google OAuth callback error:", err);
      res.status(500).send(`OAuth error: ${String(err)}`);
    }
  });

  // ─── Microsoft OAuth ──────────────────────────────────────────────────────
  app.get("/api/oauth/microsoft", (req, res) => {
    const origin = (req.query.origin as string) || "";
    const incomingState = req.query.state as string | undefined;
    const tenantId = process.env.MICROSOFT_TENANT_ID ?? "common";
    const redirectUri = `${origin}/api/oauth/microsoft/callback`;
    let stateObj: Record<string, string> = { origin };
    if (incomingState) {
      try { stateObj = { ...JSON.parse(Buffer.from(incomingState, "base64").toString()), origin }; } catch {}
    }
    const state = Buffer.from(JSON.stringify(stateObj)).toString("base64");
    const authUrl = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`);
    authUrl.searchParams.set("client_id", process.env.MICROSOFT_CLIENT_ID ?? "");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "Calendars.Read User.Read offline_access");
    authUrl.searchParams.set("response_mode", "query");
    authUrl.searchParams.set("state", state);
    res.redirect(authUrl.toString());
  });

  app.get("/api/oauth/microsoft/callback", async (req, res) => {
    try {
      const code = req.query.code as string;
      const stateRaw = req.query.state as string;
      if (!code) { res.status(400).send("Missing code"); return; }
      let origin = "";
      let stateParam: Record<string, string> = {};
      try {
        stateParam = JSON.parse(Buffer.from(stateRaw, "base64").toString());
        origin = stateParam.origin ?? "";
      } catch {}
      const tenantId = process.env.MICROSOFT_TENANT_ID ?? "common";
      const redirectUri = `${origin}/api/oauth/microsoft/callback`;

      // Exchange code for tokens
      const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: process.env.MICROSOFT_CLIENT_ID ?? "",
          client_secret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
          scope: "Calendars.Read User.Read offline_access",
        }),
      });
      const tokenData = await tokenRes.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string; error_description?: string };
      if (!tokenData.access_token) {
        res.status(400).send(`Microsoft OAuth error: ${tokenData.error_description || tokenData.error || "no access_token"}`);
        return;
      }

      // Store token per-user — same table as Google, different provider
      const { getDb } = await import("../db");
      const db = await getDb();
      if (db) {
        const { integrationsTokens } = await import("../../drizzle/schema");
        const { sql } = await import("drizzle-orm");
        const now = Date.now();
        const userId = stateParam?.userId ?? null;
        await db.execute(sql`
          INSERT INTO integrations_tokens (provider, userId, access_token, refresh_token, expires_at, scope, created_at, updated_at)
          VALUES ('microsoft', ${userId}, ${tokenData.access_token}, ${tokenData.refresh_token ?? null}, ${now + (tokenData.expires_in ?? 3600) * 1000}, ${tokenData.scope ?? null}, ${now}, ${now})
          ON DUPLICATE KEY UPDATE
            access_token = VALUES(access_token),
            refresh_token = COALESCE(VALUES(refresh_token), refresh_token),
            expires_at = VALUES(expires_at),
            scope = VALUES(scope),
            updated_at = VALUES(updated_at)
        `);
      }
      res.redirect(`${origin}/candidates?microsoft=connected`);
    } catch (err) {
      console.error("Microsoft OAuth callback error:", err);
      res.status(500).send(`OAuth error: ${String(err)}`);
    }
  });


  // Receives Adherence / OT / Coaching rows pushed from Google Sheets (Apps Script).
  //
  // IMPORTANT: this is DISPLAY-ONLY. It never touches payroll_records or payslips —
  // payroll is calculated externally in Python from the same sheets. Writing here
  // as well would double-count.
  // ─── Agent credential check (FormerAgents restore flow) ─────────────────
  app.get("/api/check-agent-creds", async (req, res) => {
    const code = req.query.code as string;
    if (!code) { res.json({ hasCredentials: false }); return; }
    try {
      const { getDb } = await import("../db");
      const { agentCredentials } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) { res.json({ hasCredentials: false }); return; }
      const [cred] = await db.select({ id: agentCredentials.id }).from(agentCredentials).where(eq(agentCredentials.traineeCode, code)).limit(1);
      res.json({ hasCredentials: !!cred });
    } catch { res.json({ hasCredentials: false }); }
  });

  // Body: { kind: "adherence" | "ot" | "quality" | "coaching", rows: [...] }
  // Duplicates are skipped (matched on crdts + date + type + category), so it's safe to
  // re-run daily.
  app.post("/api/upload/logs", async (req, res) => {
    try {
      const apiKey = req.headers["x-api-key"] as string | undefined;
      if (!apiKey) { res.status(401).json({ error: "Missing X-API-Key header" }); return; }
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) { res.status(503).json({ error: "Database unavailable" }); return; }
      const { apiKeys, agentViolations, cycleOT, coachingSessions } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      const { createHash } = await import("crypto");
      const keyHash = createHash("sha256").update(apiKey).digest("hex");
      const [keyRow] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1);
      if (!keyRow) { res.status(401).json({ error: "Invalid API key" }); return; }
      if (keyRow.revokedAt) { res.status(401).json({ error: "API key has been revoked" }); return; }
      await db.update(apiKeys).set({ lastUsedAt: Date.now() }).where(eq(apiKeys.id, keyRow.id));
      const kind = String(req.body?.kind || "");
      const rows = req.body?.rows;
      if (!["adherence", "ot", "quality", "coaching"].includes(kind)) {
        res.status(400).json({ error: 'kind must be "adherence", "ot", "quality" or "coaching"' }); return;
      }
      if (!Array.isArray(rows)) { res.status(400).json({ error: "rows must be an array" }); return; }
      const now = Date.now();
      const s = (v: unknown) => (v === undefined || v === null ? "" : String(v).trim());
      const n = (v: unknown) => { const x = Number(String(v ?? "").replace(/,/g, "")); return isNaN(x) ? 0 : x; };
      const mon = (d: string) => d.slice(0, 7);
      let inserted = 0, skipped = 0, invalid = 0;
      for (const r of rows) {
        const crdts = s(r.crdts).replace(/\.0+$/, "");
        const date = s(r.date);
        if (!crdts || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { invalid++; continue; }
        if (kind === "adherence" || kind === "quality") {
          const category = kind === "quality" ? "quality" : "attendance";
          const type = s(r.type) || "Other";
          const existing = await db.select().from(agentViolations).where(and(
            eq(agentViolations.agentCode, crdts),
            eq(agentViolations.date, date),
            eq(agentViolations.type, type),
            eq(agentViolations.category, category),
          )).limit(1);
          if (existing.length) { skipped++; continue; }
          const bits = [s(r.details)];
          // offenseNo may be "N/A" or any non-numeric string from a spreadsheet formula — guard it
          const rawOffenseNo = s(r.offenseNo);
          const safeOffenseNo = rawOffenseNo && /^\d+$/.test(rawOffenseNo) ? rawOffenseNo : null;
          if (safeOffenseNo) bits.push(`offense #${safeOffenseNo}`);
          if (s(r.penalty)) bits.push(s(r.penalty));
          if (s(r.loggedBy)) bits.push(`logged by ${s(r.loggedBy)}`);
          if (s(r.recording)) bits.push(`recording: ${s(r.recording)}`);
          const st = s(r.status).toLowerCase();
          try {
            await db.insert(agentViolations).values({
              crdts, agentCode: crdts,
              date, month: mon(date), type, category,
              hours: String(n(r.hours)), deduction: String(n(r.deduction)),
              description: bits.filter(Boolean).join(" · ") || null,
              status: st === "approved" ? "approved" : st === "rejected" ? "rejected" : "pending",
              approvedBy: s(r.approvedBy) || null,
              approvedAt: st === "approved" ? now : null,
              uploadedAt: now,
            });
            inserted++;
          } catch (insertErr: unknown) {
            // Gracefully handle duplicate key — can occur on race conditions or agentCode/crdts mismatch
            const msg = insertErr instanceof Error ? insertErr.message : String(insertErr);
            if (msg.includes("Duplicate entry") || msg.includes("ER_DUP_ENTRY")) { skipped++; }
            else throw insertErr;
          }
        } else if (kind === "ot") {
          const otType = s(r.otType) || "1.5x";
          const existing = await db.select().from(cycleOT).where(and(
            eq(cycleOT.crdts, crdts),
            eq(cycleOT.date, date),
            eq(cycleOT.otType, otType),
          )).limit(1);
          if (existing.length) { skipped++; continue; }
          await db.insert(cycleOT).values({
            crdts, agentCode: crdts, alias: s(r.alias) || null,
            date, cycleKey: mon(date), otType,
            hours: String(n(r.hours)), egpAmount: String(n(r.egp)),
            uploadedAt: now,
          });
          inserted++;
        } else {
          const topic = s(r.topic) || "Coaching";
          const existing = await db.select().from(coachingSessions).where(and(
            eq(coachingSessions.crdts, crdts),
            eq(coachingSessions.sessionDate, date),
          )).limit(1);
          if (existing.length) { skipped++; continue; }
          const st = s(r.status).toLowerCase();
          await db.insert(coachingSessions).values({
            crdts, agentCode: crdts, alias: s(r.alias) || null,
            sessionDate: date, cycleKey: mon(date),
            sessionType: topic,
            coachingHours: String(n(r.hours)), bonusAmount: String(n(r.egp)),
            notes: s(r.notes) || null,
            status: st === "approved" ? "approved" : st === "rejected" ? "rejected" : "pending",
            uploadedAt: now,
          });
          inserted++;
        }
      }
      res.json({ ok: true, kind, received: rows.length, inserted, skipped, invalid });
    } catch (err) {
      console.error("[/api/upload/logs] error:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : "Upload failed" });
    }
  });

  // Same upsert logic as the UI upload (calls upsertCycleStats from db.ts).
  // ─── REST API: POST /api/upload/cycle-stats ───────────────────────────────
  // Accepts JSON array of cycle stats records, authenticated via X-API-Key header.
  app.post("/api/upload/cycle-stats", async (req, res) => {
    try {
      const apiKey = req.headers["x-api-key"] as string | undefined;
      if (!apiKey) {
        res.status(401).json({ error: "Missing X-API-Key header" });
        return;
      }
      // Validate API key against DB
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) { res.status(503).json({ error: "Database unavailable" }); return; }
      const { apiKeys } = await import("../../drizzle/schema");
      const { eq, isNull } = await import("drizzle-orm");
      const { createHash } = await import("crypto");
      const keyHash = createHash("sha256").update(apiKey).digest("hex");
      const [keyRow] = await db.select().from(apiKeys)
        .where(eq(apiKeys.keyHash, keyHash))
        .limit(1);
      if (!keyRow) { res.status(401).json({ error: "Invalid API key" }); return; }
      if (keyRow.revokedAt) { res.status(401).json({ error: "API key has been revoked" }); return; }
      // Update last used timestamp
      await db.update(apiKeys).set({ lastUsedAt: Date.now() }).where(eq(apiKeys.id, keyRow.id));
      // Validate payload
      const body = req.body;
      if (!Array.isArray(body)) {
        res.status(400).json({ error: "Request body must be a JSON array" });
        return;
      }
      if (body.length === 0) {
        res.status(400).json({ error: "Empty array — nothing to upload" });
        return;
      }
      // Map incoming fields to the upsertCycleStats schema
      // Accepted fields: CRDTS, Date, Login Hours, Total Calls, Revenue, Cost, Profit, Rev/Hr
      const { upsertCycleStats } = await import("../db");
      // Normalize to YYYY-MM-DD, accepting ISO or DD/MM/YYYY. This avoids
      // new Date()'s US MM/DD misread, which was filing June-09 (sent as 09/06)
      // under September and inflating a phantom September cycle.
      const normDate = (raw: string): string => {
        const s = String(raw).trim();
        let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (m) return `${m[1]}-${String(+m[2]).padStart(2, "0")}-${String(+m[3]).padStart(2, "0")}`;
        m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);   // DD/MM/YYYY
        if (m) return `${m[3]}-${String(+m[2]).padStart(2, "0")}-${String(+m[1]).padStart(2, "0")}`;
        throw new Error(`Invalid date: ${raw}`);
      };
      // Cycle runs 26th→25th, named after the END month. Pure string math on ISO.
      const getCycleKey = (iso: string): string => {
        const [y, mo, da] = iso.split("-").map(Number);
        if (da >= 26) {
          const ny = mo === 12 ? y + 1 : y;
          const nm = mo === 12 ? 1 : mo + 1;
          return `${ny}-${String(nm).padStart(2, "0")}`;
        }
        return `${y}-${String(mo).padStart(2, "0")}`;
      };
      const rows = body.map((r: Record<string, unknown>, i: number) => {
        const crdts = String(r["CRDTS"] ?? r["crdts"] ?? "").trim();
        const dateRaw = String(r["Date"] ?? r["date"] ?? "").trim();
        if (!crdts || !dateRaw) throw new Error(`Row ${i + 1}: CRDTS and Date are required`);
        const date = normDate(dateRaw);
        return {
          crdts,
          agentCode: String(r["agentCode"] ?? r["Agent Code"] ?? "").trim() || undefined,
          alias: String(r["Alias"] ?? r["alias"] ?? "").trim() || undefined,
          date,
          cycleKey: getCycleKey(date),
          loginHours: parseFloat(String(r["Login Hours"] ?? r["loginHours"] ?? 0)) || 0,
          totalCalls: parseInt(String(r["Total Calls"] ?? r["totalCalls"] ?? 0), 10) || 0,
          revenue: parseFloat(String(r["Revenue"] ?? r["revenue"] ?? 0)) || 0,
          cost: parseFloat(String(r["Cost"] ?? r["cost"] ?? 0)) || 0,
          profit: parseFloat(String(r["Profit"] ?? r["profit"] ?? 0)) || 0,
          revPerHr: parseFloat(String(r["Rev/Hr"] ?? r["revPerHr"] ?? 0)) || 0,
        };
      });
      const count = await upsertCycleStats(rows);
      res.json({ ok: true, count, message: `${count} records processed` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(400).json({ error: msg });
    }
  });

  // ─── REST API: POST /api/upload/logouts ───────────────────────────────────
  // Accepts a JSON array of client-logout records from the admin sheet's Logouts
  // tab, authenticated via X-API-Key. Upserts on (crdts, date). Fields per row:
  // CRDTS, Date (YYYY-MM-DD or DD/MM/YYYY), Alias (optional).
  app.post("/api/upload/logouts", async (req, res) => {
    try {
      const apiKey = req.headers["x-api-key"] as string | undefined;
      if (!apiKey) { res.status(401).json({ error: "Missing X-API-Key header" }); return; }
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) { res.status(503).json({ error: "Database unavailable" }); return; }
      const { apiKeys } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const { createHash } = await import("crypto");
      const keyHash = createHash("sha256").update(apiKey).digest("hex");
      const [keyRow] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1);
      if (!keyRow) { res.status(401).json({ error: "Invalid API key" }); return; }
      if (keyRow.revokedAt) { res.status(401).json({ error: "API key has been revoked" }); return; }
      await db.update(apiKeys).set({ lastUsedAt: Date.now() }).where(eq(apiKeys.id, keyRow.id));

      const body = req.body;
      if (!Array.isArray(body)) { res.status(400).json({ error: "Request body must be a JSON array" }); return; }

      // Normalize a date to YYYY-MM-DD (accepts YYYY-MM-DD or DD/MM/YYYY).
      const normDate = (raw: string): string => {
        const s = String(raw).trim();
        let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (m) return `${m[1]}-${String(+m[2]).padStart(2, "0")}-${String(+m[3]).padStart(2, "0")}`;
        m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);   // DD/MM/YYYY
        if (m) return `${m[3]}-${String(+m[2]).padStart(2, "0")}-${String(+m[1]).padStart(2, "0")}`;
        throw new Error(`Unrecognized date: ${raw}`);
      };

      const seen = new Set<string>();
      const rows: Array<{ crdts: string; alias?: string; date: string; cycleKey: string }> = [];
      for (let i = 0; i < body.length; i++) {
        const r = body[i] as Record<string, unknown>;
        let crdts = String(r["CRDTS"] ?? r["crdts"] ?? "").trim();
        crdts = crdts.replace(/\.0+$/, "");   // 114084.0 -> 114084
        const dateRaw = String(r["Date"] ?? r["date"] ?? "").trim();
        if (!crdts || !dateRaw) continue;     // skip blank rows
        const date = normDate(dateRaw);
        const key = `${crdts}|${date}`;
        if (seen.has(key)) continue;          // de-dupe within the payload
        seen.add(key);
        rows.push({
          crdts,
          alias: String(r["Alias"] ?? r["alias"] ?? "").trim() || undefined,
          date,
          cycleKey: date.slice(0, 7),         // YYYY-MM (calendar month)
        });
      }
      if (rows.length === 0) { res.status(400).json({ error: "No valid logout rows" }); return; }
      const { bulkUpsertClientLogouts } = await import("../db");
      await bulkUpsertClientLogouts(rows);
      res.json({ ok: true, count: rows.length, message: `${rows.length} logout records processed` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(400).json({ error: msg });
    }
  });

  // ─── REST API: POST /api/upload/quality ───────────────────────────────────
  // Per-call QA results from the Quality sheet, for AGENT VISIBILITY ONLY (never
  // feeds payroll). Fields per row: CRDTS, Date, Violation, Score, EGP, Hours, Alias.
  app.post("/api/upload/quality", async (req, res) => {
    try {
      const apiKey = req.headers["x-api-key"] as string | undefined;
      if (!apiKey) { res.status(401).json({ error: "Missing X-API-Key header" }); return; }
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) { res.status(503).json({ error: "Database unavailable" }); return; }
      const { apiKeys } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const { createHash } = await import("crypto");
      const keyHash = createHash("sha256").update(apiKey).digest("hex");
      const [keyRow] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1);
      if (!keyRow) { res.status(401).json({ error: "Invalid API key" }); return; }
      if (keyRow.revokedAt) { res.status(401).json({ error: "API key has been revoked" }); return; }
      await db.update(apiKeys).set({ lastUsedAt: Date.now() }).where(eq(apiKeys.id, keyRow.id));

      const body = req.body;
      if (!Array.isArray(body)) { res.status(400).json({ error: "Request body must be a JSON array" }); return; }

      const normDate = (raw: string): string => {
        const s = String(raw).trim();
        let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (m) return `${m[1]}-${String(+m[2]).padStart(2, "0")}-${String(+m[3]).padStart(2, "0")}`;
        m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);   // DD/MM/YYYY
        if (m) return `${m[3]}-${String(+m[2]).padStart(2, "0")}-${String(+m[1]).padStart(2, "0")}`;
        throw new Error(`Unrecognized date: ${raw}`);
      };
      const numStr = (v: unknown): string | undefined => {
        if (v === undefined || v === null || v === "") return undefined;
        const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
        return isNaN(n) ? undefined : String(n);
      };

      const seen = new Set<string>();
      const rows: Array<{ crdts: string; alias?: string; date: string; violation?: string; score?: string; deductionEgp?: string; hours?: string; cycleKey: string }> = [];
      for (let i = 0; i < body.length; i++) {
        const r = body[i] as Record<string, unknown>;
        const crdts = String(r["CRDTS"] ?? r["crdts"] ?? "").trim().replace(/\.0+$/, "");
        const dateRaw = String(r["Date"] ?? r["date"] ?? "").trim();
        const violation = String(r["Violation"] ?? r["violation"] ?? "").trim();
        if (!crdts || !dateRaw) continue;
        const date = normDate(dateRaw);
        const key = `${crdts}|${date}|${violation}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({
          crdts,
          alias: String(r["Alias"] ?? r["alias"] ?? "").trim() || undefined,
          date,
          violation: violation || undefined,
          score: numStr(r["Score"] ?? r["score"] ?? r["TOTAL"]),
          deductionEgp: numStr(r["EGP"] ?? r["egp"] ?? r["deductionEgp"]),
          hours: numStr(r["Hours"] ?? r["hours"]),
          cycleKey: date.slice(0, 7),
        });
      }
      if (rows.length === 0) { res.status(400).json({ error: "No valid quality rows" }); return; }
      const { bulkUpsertAgentQualityFlags } = await import("../db");
      await bulkUpsertAgentQualityFlags(rows);
      res.json({ ok: true, count: rows.length, message: `${rows.length} quality records processed` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(400).json({ error: msg });
    }
  });

  // ─── REST API: GET /api/agents/status ─────────────────────────────────────
  // Returns current agent status (one entry per CRDTS) so the analysis sheet can
  // auto-exclude resigned/terminated agents from pivots & charts. Auth: X-API-Key.
  app.get("/api/agents/status", async (req, res) => {
    try {
      const apiKey = req.headers["x-api-key"] as string | undefined;
      if (!apiKey) { res.status(401).json({ error: "Missing X-API-Key header" }); return; }
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) { res.status(503).json({ error: "Database unavailable" }); return; }
      const { apiKeys } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const { createHash } = await import("crypto");
      const keyHash = createHash("sha256").update(apiKey).digest("hex");
      const [keyRow] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1);
      if (!keyRow) { res.status(401).json({ error: "Invalid API key" }); return; }
      if (keyRow.revokedAt) { res.status(401).json({ error: "API key has been revoked" }); return; }
      await db.update(apiKeys).set({ lastUsedAt: Date.now() }).where(eq(apiKeys.id, keyRow.id));

      const { listWorkforceAgents } = await import("../db");
      const agents = await listWorkforceAgents();
      const out: Array<Record<string, unknown>> = [];
      for (const a of agents as Array<Record<string, unknown>>) {
        const active = a.agentStatus === "active" && a.isActive !== false;
        const codes = String(a.crdts ?? "").split(",").map((c) => c.trim()).filter(Boolean);
        if (codes.length === 0) codes.push("");
        for (const crdts of codes) {
          out.push({
            crdts,
            agentCode: a.traineeCode,
            name: a.fullName ?? "",
            alias: a.alias ?? "",
            campaignId: a.campaignId ?? null,
            campaign: a.campaignName ?? "",
            status: a.agentStatus ?? (a.isActive ? "active" : "inactive"),
            active,
          });
        }
      }
      res.json({ ok: true, count: out.length, agents: out });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(400).json({ error: msg });
    }
  });

  // ─── REST API: GET /api/celebrations/today (birthdays + work anniversaries) ───
  app.get("/api/celebrations/today", async (req, res) => {
    try {
      const apiKey = req.headers["x-api-key"] as string | undefined;
      if (!apiKey) { res.status(401).json({ error: "Missing X-API-Key header" }); return; }
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) { res.status(503).json({ error: "Database unavailable" }); return; }
      const { apiKeys } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const { createHash } = await import("crypto");
      const keyHash = createHash("sha256").update(apiKey).digest("hex");
      const [keyRow] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1);
      if (!keyRow || keyRow.revokedAt) { res.status(401).json({ error: "Invalid or revoked API key" }); return; }
      const { listWorkforceAgents } = await import("../db");
      const agents = await listWorkforceAgents();
      const now = new Date();
      const todayMd = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const birthdays: Array<Record<string, unknown>> = [];
      const anniversaries: Array<Record<string, unknown>> = [];
      for (const a of agents as Array<Record<string, unknown>>) {
        if (!(a.agentStatus === "active" && a.isActive !== false)) continue;
        const name = (a.fullName as string) || (a.alias as string) || (a.traineeCode as string);
        const dob = a.dateOfBirth ? String(a.dateOfBirth) : "";
        if (dob.length >= 10 && dob.slice(5, 10) === todayMd) birthdays.push({ name, traineeCode: a.traineeCode });
        if (a.joinDate) {
          const jd = new Date(Number(a.joinDate));
          if (`${String(jd.getMonth() + 1).padStart(2, "0")}-${String(jd.getDate()).padStart(2, "0")}` === todayMd) {
            const years = now.getFullYear() - jd.getFullYear();
            if (years >= 1) anniversaries.push({ name, traineeCode: a.traineeCode, years });
          }
        }
      }
      res.json({ ok: true, date: `${now.getFullYear()}-${todayMd}`, birthdays, anniversaries });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // ─── REST API: GET /api/requests/pending (open requests + age in hours) ───
  app.get("/api/requests/pending", async (req, res) => {
    try {
      const apiKey = req.headers["x-api-key"] as string | undefined;
      if (!apiKey) { res.status(401).json({ error: "Missing X-API-Key header" }); return; }
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) { res.status(503).json({ error: "Database unavailable" }); return; }
      const { apiKeys } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const { createHash } = await import("crypto");
      const keyHash = createHash("sha256").update(apiKey).digest("hex");
      const [keyRow] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1);
      if (!keyRow || keyRow.revokedAt) { res.status(401).json({ error: "Invalid or revoked API key" }); return; }
      const { listAllAgentRequests } = await import("../db");
      const all = await listAllAgentRequests();
      const now = Date.now();
      const requests = (all as Array<Record<string, unknown>>)
        .filter((r) => r.status === "pending")
        .map((r) => {
          const created = r.createdAt ? new Date(r.createdAt as string | number | Date).getTime() : now;
          return { id: r.id, traineeCode: r.traineeCode, name: r.fullName ?? "", type: r.type, subject: r.subject, createdAt: created, ageHours: Math.floor((now - created) / 3600000) };
        });
      res.json({ ok: true, count: requests.length, requests });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // ─── Slack Events API: emoji-typed → canned auto-reply ────────────────────
  // When SLACK_TRIGGER_EMOJI is TYPED in a message in a channel the bot is in,
  // the bot posts SLACK_TRIGGER_MESSAGE back to that channel via an incoming webhook.
  // Env:  SLACK_SIGNING_SECRET (recommended) · SLACK_TRIGGER_EMOJI · SLACK_TRIGGER_MESSAGE
  //       SLACK_TRIGGER_WEBHOOK (falls back to SLACK_ADMIN_WEBHOOK)
  app.post("/api/slack/events", async (req, res) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const _sev = (body.event ?? {}) as Record<string, unknown>;
      console.log("[slack] in:", body.type, _sev.type ?? "", _sev.reaction ?? "");
      // 1) URL verification handshake (when you save the Request URL in Slack)
      if (body.type === "url_verification") { res.status(200).send(String(body.challenge ?? "")); return; }

      // 2) Verify the request genuinely came from Slack (only if a signing secret is set)
      const signingSecret = process.env.SLACK_SIGNING_SECRET;
      if (signingSecret) {
        const ts = req.headers["x-slack-request-timestamp"] as string | undefined;
        const sig = req.headers["x-slack-signature"] as string | undefined;
        const raw = (req as unknown as { rawBody?: Buffer }).rawBody;
        let okSig = false;
        if (ts && sig && raw && Math.abs(Date.now() / 1000 - Number(ts)) <= 300) {
          const { createHmac, timingSafeEqual } = await import("crypto");
          const base = `v0:${ts}:${raw.toString("utf8")}`;
          const mine = "v0=" + createHmac("sha256", signingSecret).update(base).digest("hex");
          try { okSig = timingSafeEqual(Buffer.from(mine), Buffer.from(sig)); } catch { okSig = false; }
        }
        if (!okSig) { console.log("[slack] signature FAILED — check SLACK_SIGNING_SECRET / rawBody"); res.status(401).send("bad signature"); return; }
      }

      // 3) Acknowledge immediately (Slack requires a fast 200, then we act)
      res.status(200).send("");

      // 4) Process the event
      if (body.type !== "event_callback") return;
      const ev = (body.event ?? {}) as Record<string, unknown>;

      // 4a) React-to-action on a request alert: ✅ resolved · 👀 in progress · ❌ rejected
      if (ev.type === "reaction_added") {
        const rxn = String(ev.reaction ?? "").toLowerCase();
        const statusMap: Record<string, "resolved" | "in_progress" | "rejected"> = {
          white_check_mark: "resolved", heavy_check_mark: "resolved",
          eyes: "in_progress",
          x: "rejected", negative_squared_cross_mark: "rejected",
        };
        const item = (ev.item ?? {}) as { ts?: string };
        if (statusMap[rxn] && item.ts) {
          const { getRequestBySlackMessageTs, updateAgentRequestStatus } = await import("../db");
          const reqRow = await getRequestBySlackMessageTs(item.ts);
          if (reqRow) {
            await updateAgentRequestStatus(reqRow.id, statusMap[rxn]);
            const cHook = process.env.SLACK_ADMIN_WEBHOOK;
            if (cHook) fetch(cHook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: `:white_check_mark: Request from *${reqRow.traineeCode}* \u2192 *${statusMap[rxn].replace("_", " ")}*` }) }).catch(() => {});
            return;
          }
        }
      }

      // 4b) Emoji typed/reacted → canned auto-reply
      const trigger = process.env.SLACK_TRIGGER_EMOJI || "";
      const reply = process.env.SLACK_TRIGGER_MESSAGE || "";
      const hook = process.env.SLACK_TRIGGER_WEBHOOK || process.env.SLACK_ADMIN_WEBHOOK;
      if (!trigger || !reply || !hook) return;
      const triggerName = trigger.replace(/:/g, "").trim().toLowerCase();
      let matched = false;
      if (ev.type === "reaction_added") {
        matched = String(ev.reaction ?? "").toLowerCase() === triggerName;
      } else if (ev.type === "message" && !ev.bot_id && !ev.subtype) {
        const text = String(ev.text ?? "");
        matched = text.includes(trigger) || text.includes(`:${triggerName}:`);
      }
      if (!matched) { console.log("[slack] reaction", String(ev.reaction ?? ""), "≠ trigger", triggerName); return; }
      console.log("[slack] trigger matched — posting reply");
      fetch(hook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: reply }) }).catch(() => {});
    } catch {
      try { if (!res.headersSent) res.status(200).send(""); } catch { /* ignore */ }
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError({ error, path }) {
        // Log full error server-side but never expose internal details to client
        if (error.code === "INTERNAL_SERVER_ERROR") {
          console.error(`[tRPC] ${path ?? "unknown"}:`, error);
        }
        // Sanitize: replace generic internal errors with a safe message
        if (error.code === "INTERNAL_SERVER_ERROR" && process.env.NODE_ENV === "production") {
          error.message = "An internal error occurred. Please try again.";
        }
      },
    })
  );

  // ── CSRF: reject cross-origin state-changing requests ──────────────────────
  // Runs after tRPC so reads/queries still work from anywhere, but mutations
  // from foreign origins are blocked.
  app.use("/api/trpc", (req, res, next) => {
    if (req.method === "GET") return next(); // queries are safe
    const origin = req.headers["origin"] as string | undefined;
    const host = req.headers["host"] as string | undefined;
    if (origin && host) {
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          res.status(403).json({ error: "Cross-origin request rejected." });
          return;
        }
      } catch {
        res.status(403).json({ error: "Invalid origin." });
        return;
      }
    }
    next();
  });
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
