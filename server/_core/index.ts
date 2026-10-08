import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { resolveAgentSession } from "./agentAuth";
import { sdk } from "./sdk";
import { ENV } from "./env";
import { createHmac, timingSafeEqual, randomBytes } from "crypto";
import { cycleKeyFor } from "./time";
import { toDecimalHours, normalizeOtType, round2 } from "../../shared/hours";

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

// Slack event replay guard: event_id → expiry ms (10-minute memory).
const _slackSeenEvents = new Map<string, number>();

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

// ─── Hourly scheduled jobs ────────────────────────────────────────────────────

// 1. Apply scheduled resignations/terminations whose effectiveDate has passed
const runDueSeparations = async () => {
  try {
    const { processDueSeparations } = await import("../db");
    const n = await processDueSeparations();
    if (n > 0) console.log(`[separations] Applied ${n} due separation(s)`);
  } catch (e) { console.error("[separations] processDueSeparations error:", e); }
};

// 2. Auto-clear probation when probationEndDate has passed
const runProbationCheck = async () => {
  try {
    const { getDb } = await import("../db");
    const { workforceAgents } = await import("../../drizzle/schema");
    const { and, eq, lte, isNotNull } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return;
    const { businessDateKey } = await import("./time");
    const today = businessDateKey(Date.now()); // Cairo calendar day, not server UTC
    // Find agents still flagged as on probation but whose probation end date has passed
    const expired = await db.select({ traineeCode: workforceAgents.traineeCode, alias: workforceAgents.alias })
      .from(workforceAgents)
      .where(and(
        eq(workforceAgents.isOnProbation, true),
        isNotNull(workforceAgents.probationEndDate),
        lte(workforceAgents.probationEndDate, today)
      ));
    if (expired.length > 0) {
      for (const ag of expired) {
        await db.update(workforceAgents)
          .set({ isOnProbation: false, updatedAt: new Date() })
          .where(eq(workforceAgents.traineeCode, ag.traineeCode));
        console.log(`[probation] Cleared probation for ${ag.alias ?? ag.traineeCode}`);
      }
      console.log(`[probation] Auto-cleared ${expired.length} agent(s) from probation`);
    }
  } catch (e) { console.error("[probation] probation check error:", e); }
};

// 3. Flag agents with expired contracts (mark contractSigned as needing renewal)
const runContractExpiryCheck = async () => {
  try {
    const { getDb } = await import("../db");
    const { workforceAgents, appSettings } = await import("../../drizzle/schema");
    const { and, eq, lte, isNotNull, ne } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return;
    const { businessDateKey } = await import("./time");
    const today = businessDateKey(Date.now()); // Cairo calendar day
    // Find active agents whose contract has expired
    const expired = await db.select({ traineeCode: workforceAgents.traineeCode, alias: workforceAgents.alias, contractEndDate: workforceAgents.contractEndDate })
      .from(workforceAgents)
      .where(and(
        eq(workforceAgents.agentStatus, "active"),
        isNotNull(workforceAgents.contractEndDate),
        lte(workforceAgents.contractEndDate, today)
      ));
    if (expired.length > 0) {
      console.log(`[contracts] ${expired.length} agent(s) with expired contracts: ${expired.map(a => a.alias ?? a.traineeCode).join(", ")}`);
      // Store in app_settings as a JSON list so dashboard can surface it
      await db.insert(appSettings).values({ key: "expired_contracts", value: JSON.stringify(expired.map(a => a.traineeCode)), updatedAt: Date.now(), updatedBy: "system" })
        .onDuplicateKeyUpdate({ set: { value: JSON.stringify(expired.map(a => a.traineeCode)), updatedAt: Date.now() } });
    } else {
      await db.insert(appSettings).values({ key: "expired_contracts", value: "[]", updatedAt: Date.now(), updatedBy: "system" })
        .onDuplicateKeyUpdate({ set: { value: "[]", updatedAt: Date.now() } });
    }
  } catch (e) { console.error("[contracts] contract expiry check error:", e); }
};

// 4. Auto-revert one-time schedule swaps after the swap week ends
const runScheduleSwapRevert = async () => {
  try {
    const { getDb } = await import("../db");
    const { scheduleChangeRequests, workforceAgents } = await import("../../drizzle/schema");
    const { and, eq, isNull, lte, isNotNull } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return;
    const { businessDateKey } = await import("./time");
    const today = businessDateKey(Date.now()); // Cairo calendar day
    // Find approved swaps whose swapWeekOf + 7 days has passed and haven't been reverted yet
    const dueReverts = await db.select().from(scheduleChangeRequests)
      .where(and(
        eq(scheduleChangeRequests.status, "approved"),
        isNull(scheduleChangeRequests.revertedAt),
        isNotNull(scheduleChangeRequests.swapWeekOf),
      ));
    for (const swap of dueReverts) {
      if (!swap.swapWeekOf) continue;
      // Revert after the swap week ends (swapWeekOf + 7 days)
      const revertDate = new Date(swap.swapWeekOf);
      revertDate.setDate(revertDate.getDate() + 7);
      if (revertDate.toISOString().slice(0, 10) > today) continue; // not yet
      // Restore original off days
      if (swap.requesterOrigOff1 !== null && swap.requesterOrigOff1 !== undefined) {
        await db.update(workforceAgents)
          .set({ offDay1: swap.requesterOrigOff1, offDay2: swap.requesterOrigOff2 ?? null, updatedAt: new Date() })
          .where(eq(workforceAgents.traineeCode, swap.requesterCode));
      }
      if (swap.targetOrigOff1 !== null && swap.targetOrigOff1 !== undefined) {
        await db.update(workforceAgents)
          .set({ offDay1: swap.targetOrigOff1, offDay2: swap.targetOrigOff2 ?? null, updatedAt: new Date() })
          .where(eq(workforceAgents.traineeCode, swap.targetCode));
      }
      await db.update(scheduleChangeRequests)
        .set({ status: "reverted", revertedAt: Date.now() })
        .where(eq(scheduleChangeRequests.id, swap.id));
      console.log(`[schedule] Reverted swap #${swap.id} (${swap.requesterCode} ↔ ${swap.targetCode}) — swap week ended`);
    }
  } catch (e) { console.error("[schedule] swap revert error:", e); }
};

// Run all hourly jobs on startup then every hour.
// RUN_JOBS=false turns the scheduler off on extra replicas, so only one
// instance runs the background work (each job is also idempotent on its own).
let _jobsRunning = false;
const runHourlyJobs = async () => {
  if (_jobsRunning) { console.warn("[jobs] previous run still in progress — skipping this tick"); return; }
  _jobsRunning = true;
  const failures: string[] = [];
  const step = async (name: string, fn: () => Promise<void>) => {
    try { await fn(); } catch (e) { failures.push(name); console.error(`[jobs] ${name} failed:`, e); }
  };
  try {
    await step("dueSeparations", runDueSeparations);
    await step("probationCheck", runProbationCheck);
    await step("contractExpiryCheck", runContractExpiryCheck);
    await step("scheduleSwapRevert", runScheduleSwapRevert);
  } finally {
    _jobsRunning = false;
  }
  // Surface repeated silent failures where someone will see them.
  if (failures.length) {
    const hook = process.env.SLACK_MANAGEMENT_WEBHOOK || process.env.SLACK_ADMIN_WEBHOOK;
    if (hook) {
      fetch(hook, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `:rotating_light: Hub background job(s) failed this hour: ${failures.join(", ")}. Check the server logs.` }),
      }).catch(() => {});
    }
  }
};

if (process.env.RUN_JOBS !== "false") {
  runHourlyJobs();
  setInterval(runHourlyJobs, 60 * 60 * 1000).unref(); // every hour
} else {
  console.log("[jobs] RUN_JOBS=false — background scheduler disabled on this instance");
}

// (Removed) the 7-month leave-eligibility job: by owner decision every agent gets
// their 6 casual / 21 annual days from day one — decideLeaveRequest seeds the
// balance row with those defaults on first approval, so no job is needed.

/**
 * Are we behind a reverse proxy we trust to set X-Forwarded-*?
 * Production always runs behind the host's proxy, so default ON there (every request would
 * otherwise share the proxy's IP and the 300 req/min limit would throttle the whole company).
 * Set TRUST_PROXY=false to disable, or TRUST_PROXY=true to force it on in dev.
 */
const TRUST_PROXY = process.env.TRUST_PROXY
  ? ["true", "1", "yes"].includes(process.env.TRUST_PROXY.toLowerCase())
  : process.env.NODE_ENV === "production";

/** Client IP for rate limiting — Express's req.ip honours `trust proxy` (first hop only, not any spoofed header). */
function clientIp(req: express.Request): string {
  if (TRUST_PROXY) return req.ip ?? req.socket.remoteAddress ?? "unknown";
  return req.socket.remoteAddress ?? "unknown";
}

/** Sign/verify OAuth `state` so the callback can't be driven by a forged state. */
function signState(obj: Record<string, string>): string {
  const payload = Buffer.from(JSON.stringify(obj)).toString("base64url");
  const sig = createHmac("sha256", ENV.cookieSecret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}
function verifyState(raw: string | undefined): Record<string, string> | null {
  if (!raw || !raw.includes(".")) return null;
  const [payload, sig] = raw.split(".", 2);
  const mine = createHmac("sha256", ENV.cookieSecret).update(payload!).digest("base64url");
  try { if (!timingSafeEqual(Buffer.from(mine), Buffer.from(sig!))) return null; } catch { return null; }
  try { return JSON.parse(Buffer.from(payload!, "base64url").toString()) as Record<string, string>; } catch { return null; }
}
function isAllowedOrigin(origin: string): boolean {
  const allowed = (process.env.ALLOWED_ORIGIN ?? "https://hub.tanis-eg.com").split(",").map(o => o.trim()).filter(Boolean);
  if (process.env.NODE_ENV !== "production") return true;
  return allowed.includes(origin);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  if (TRUST_PROXY) app.set("trust proxy", 1);

  // ── CORS — same-origin app; echo only allow-listed Origins, never "*" with credentials ──
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && isAllowedOrigin(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
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
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; font-src 'self' https:;"
    );
    if (process.env.NODE_ENV === "production") {
      res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
    }
    next();
  });

  // ── Health check for the load balancer / uptime monitor: no auth, touches the DB.
  // Registered at BOTH paths: the hosting edge only forwards /api/* to Node, so
  // bare /healthz 404s at the edge in production — use /api/healthz there. ──
  app.get(["/healthz", "/api/healthz"], async (_req, res) => {
    try {
      const { getDb } = await import("../db");
      const { sql: sqlTag } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new Error("no db");
      await Promise.race([
        db.execute(sqlTag`SELECT 1`),
        new Promise((_, rej) => setTimeout(() => rej(new Error("db timeout")), 1500)),
      ]);
      res.status(200).json({ ok: true });
    } catch (e) {
      res.status(503).json({ ok: false, error: (e as Error).message });
    }
  });

  // ── Global rate limit: 300 req/min per IP (stops scrapers & brute-force) ──
  app.use((req, res, next) => {
    const ip = clientIp(req);
    if (rateLimit(`global:${ip}`, 300)) {
      res.status(429).json({ error: "Too many requests — please slow down." });
      return;
    }
    next();
  });

  // ── Strict rate limit on auth endpoints (10 attempts/min per IP) ──
  // Matched against the full path INCLUDING batched procedure lists ("/api/trpc/a.b,agent.login").
  const AUTH_PROCS = ["agent.login", "adminAuth.login", "adminAuth.acceptInvite", "invites.use", "agent.resetPassword"];
  app.use((req, res, next) => {
    const ip = clientIp(req);
    const isAuth = req.path.startsWith("/api/oauth") || req.path === "/api/check-agent-creds" ||
      (req.path.startsWith("/api/trpc/") && req.path.slice("/api/trpc/".length).split(",").some(p => AUTH_PROCS.includes(p)));
    if (isAuth && rateLimit(`auth:${ip}`, 10)) {
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

  // Body parser limits are per-route (the Content-Length pre-check above is advisory only —
  // a chunked request carries none). Upload routes get 50 MB; everything else 512 KB.
  const bigJson = express.json({ limit: "50mb", verify: (req, _res, buf) => { (req as unknown as { rawBody?: Buffer }).rawBody = buf; } });
  const smallJson = express.json({ limit: "512kb", verify: (req, _res, buf) => { (req as unknown as { rawBody?: Buffer }).rawBody = buf; } });
  app.use((req, res, next) => {
    const isUpload = req.path.startsWith("/api/upload") || req.path.includes("upload-doc") || req.path.startsWith("/api/trpc");
    // tRPC keeps 50 MB only for its three upload-ish procedures; everything else there is small too.
    if (req.path.startsWith("/api/trpc")) {
      const BIG = ["candidates.uploadCv", "candidates.bulkImport", "requests.uploadAttachment", "documents.uploadFile", "documents.uploadForAgent", "workforce.setMyAvatar", "payrollV2.uploadPayrollV2", "commission.upload", "commission.uploadLeaderboard", "coaching.upload", "cycleTracker.upload", "academy"];
      const procs = req.path.slice("/api/trpc/".length).split(",");
      const needsBig = procs.some(p => BIG.some(b => p.startsWith(b)));
      return (needsBig ? bigJson : smallJson)(req, res, next);
    }
    return (isUpload ? bigJson : smallJson)(req, res, next);
  });
  app.use(express.urlencoded({ limit: "512kb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // Legacy migration endpoints removed — use drizzle-kit migrate instead

    // File upload endpoint for agent documents
  app.post("/api/upload-doc", async (req, res) => {
    try {
      // Auth: a live agent session OR a staff login. Anonymous uploads are refused.
      const agent = await resolveAgentSession(req);
      let staff = null;
      if (!agent) { try { staff = await sdk.authenticateRequest(req); } catch { staff = null; } }
      if (!agent && !staff) { res.status(401).json({ error: "Login required" }); return; }
      const ownerKey = agent ? agent.traineeCode : `staff-${staff?.openId ?? "unknown"}`;
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
          // Never trust the client's MIME: sniff the magic bytes.
          const sniffed = buf.subarray(0, 4).toString("hex");
          const magicOk =
            (mimeType.startsWith("image/jpeg") || mimeType === "image/jpg") ? sniffed.startsWith("ffd8ff") :
            mimeType === "image/png"  ? sniffed === "89504e47" :
            mimeType === "image/gif"  ? sniffed.startsWith("474946") :
            mimeType === "image/webp" ? buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP" :
            mimeType === "application/pdf" ? buf.subarray(0, 5).toString("ascii") === "%PDF-" : false;
          if (!magicOk) { res.status(415).json({ error: "File content does not match its type." }); return; }
          const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "application/pdf": "pdf" };
          const ext = EXT[mimeType.toLowerCase()] ?? "bin";
          const safeOwner = ownerKey.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64);
          const key = `agent-docs/${safeOwner}/${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;
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
  app.get("/api/oauth/google", async (req, res) => {
    // Get frontend origin from query param (passed by frontend)
    const origin = (req.query.origin as string) || "";
    const incomingState = req.query.state as string | undefined;
    const redirectUri = `${origin}/api/oauth/google/callback`;
    const scopes = [
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" ");
    // Preserve userId from frontend state if provided, otherwise build fresh state
    if (!origin || !isAllowedOrigin(origin)) { res.status(400).send("Origin not allowed"); return; }
    // The connecting user must be logged in; the token is bound to THEIR id, never one from the URL.
    let me: { openId?: string } | null = null;
    try { me = await sdk.authenticateRequest(req); } catch { me = null; }
    if (!me?.openId) { res.status(401).send("Login required"); return; }
    let stateObj: Record<string, string> = { origin, userId: me.openId, nonce: randomBytes(8).toString("hex") };
    if (incomingState) {
      try { const extra = JSON.parse(Buffer.from(incomingState, "base64").toString()) as Record<string, string>; delete extra.userId; stateObj = { ...extra, ...stateObj }; } catch { /* ignore client extras */ }
    }
    const state = signState(stateObj);
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
      const stateParam = verifyState(stateRaw);
      if (!stateParam || !stateParam.origin || !isAllowedOrigin(stateParam.origin) || !stateParam.userId) { res.status(400).send("Invalid or expired OAuth state"); return; }
      const origin = stateParam.origin;
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
        const userId = stateParam.userId;
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
  app.get("/api/oauth/microsoft", async (req, res) => {
    const origin = (req.query.origin as string) || "";
    const incomingState = req.query.state as string | undefined;
    const tenantId = process.env.MICROSOFT_TENANT_ID ?? "common";
    const redirectUri = `${origin}/api/oauth/microsoft/callback`;
    if (!origin || !isAllowedOrigin(origin)) { res.status(400).send("Origin not allowed"); return; }
    // The connecting user must be logged in; the token is bound to THEIR id, never one from the URL.
    let me: { openId?: string } | null = null;
    try { me = await sdk.authenticateRequest(req); } catch { me = null; }
    if (!me?.openId) { res.status(401).send("Login required"); return; }
    let stateObj: Record<string, string> = { origin, userId: me.openId, nonce: randomBytes(8).toString("hex") };
    if (incomingState) {
      try { const extra = JSON.parse(Buffer.from(incomingState, "base64").toString()) as Record<string, string>; delete extra.userId; stateObj = { ...extra, ...stateObj }; } catch { /* ignore client extras */ }
    }
    const state = signState(stateObj);
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
      const stateParam = verifyState(stateRaw);
      if (!stateParam || !stateParam.origin || !isAllowedOrigin(stateParam.origin) || !stateParam.userId) { res.status(400).send("Invalid or expired OAuth state"); return; }
      const origin = stateParam.origin;
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
        const userId = stateParam.userId;
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
  // ─── Public portal lock status — no auth needed, polled by agent portal ────
  app.get("/api/portal-status", async (_req, res) => {
    try {
      const { getDb } = await import("../db");
      const { appSettings } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) { res.json({ locked: false, message: "" }); return; }
      const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "portal_locked")).limit(1);
      const [msgRow] = await db.select().from(appSettings).where(eq(appSettings.key, "portal_lock_message")).limit(1);
      res.json({ locked: row?.value === "true", message: msgRow?.value ?? "" });
    } catch { res.json({ locked: false, message: "" }); }
  });

  // ─── Agent credential check (FormerAgents restore flow) ─────────────────
  app.get("/api/check-agent-creds", async (req, res) => {
    // Staff only — otherwise this enumerates valid trainee codes.
    let me: { role?: string } | null = null;
    try { me = await sdk.authenticateRequest(req); } catch { me = null; }
    if (!me || me.role === "user" || me.role === "viewer") { res.status(401).json({ hasCredentials: false, error: "Login required" }); return; }
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
      // Hours: "8:48" / 8.8 / "8h 48m" all accepted; anything else REJECTS the row (never 0).
      const hrs = (v: unknown): number | null => { const h = toDecimalHours(v); return h == null ? null : round2(h); };
      // Pay cycle = 26th→25th (same rule as the UI). OT on the 26th–31st lands in the NEXT cycle, not the calendar month.
      const mon = (d: string) => cycleKeyFor(d);
      let inserted = 0, skipped = 0, invalid = 0;
      const rejected: Array<{ row: number; reason: string }> = [];
      // Resolve each sheet CRDTS once per batch: the real trainee code for the
      // agentCode column, and the archived label when the holder already left
      // (the sheets always carry the bare number).
      const { workforceAgents: waIngest } = await import("../../drizzle/schema");
      const waRows = await db.select({ traineeCode: waIngest.traineeCode, crdts: waIngest.crdts, agentStatus: waIngest.agentStatus }).from(waIngest);
      const TERMINAL_ST = ["resigned", "terminated", "blacklisted"];
      const activeByEntry = new Map<string, string>();
      const anyByEntry = new Map<string, string>();
      const allEntries: Array<{ entry: string; code: string }> = [];
      for (const a of waRows) {
        for (const entry of String(a.crdts ?? "").split(",").map(x => x.trim()).filter(Boolean)) {
          allEntries.push({ entry, code: a.traineeCode });
          if (!anyByEntry.has(entry)) anyByEntry.set(entry, a.traineeCode);
          if (!TERMINAL_ST.includes(a.agentStatus ?? "")) activeByEntry.set(entry, a.traineeCode);
        }
      }
      const escRe = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const resolveIngest = (num: string): { crdts: string; traineeCode: string | null } => {
        const active = activeByEntry.get(num);
        if (active) return { crdts: num, traineeCode: active };
        const re = new RegExp(`^${escRe(num)} \\((\\d+)\\)$`);
        let best: { entry: string; k: number; code: string } | null = null;
        for (const e of allEntries) {
          const m = re.exec(e.entry);
          if (m && (!best || Number(m[1]) > best.k)) best = { entry: e.entry, k: Number(m[1]), code: e.code };
        }
        if (best) return { crdts: best.entry, traineeCode: best.code };
        return { crdts: num, traineeCode: anyByEntry.get(num) ?? null };
      };
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const crdtsRaw = s(r.crdts).replace(/\.0+$/, "");
        const date = s(r.date);
        if (!crdtsRaw || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { invalid++; rejected.push({ row: i + 1, reason: "missing CRDTS or bad date" }); continue; }
        const { crdts, traineeCode: resolvedCode } = resolveIngest(crdtsRaw);
        const agentCodeVal = resolvedCode ?? crdts;
        if (kind === "adherence" || kind === "quality") {
          const category = kind === "quality" ? "quality" : "attendance";
          const type = s(r.type) || "Other";
          const existing = await db.select().from(agentViolations).where(and(
            eq(agentViolations.crdts, crdts),
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
          const vHours = hrs(r.hours);
          if (vHours == null) { invalid++; rejected.push({ row: i + 1, reason: `unreadable hours "${s(r.hours)}"` }); continue; }
          try {
            await db.insert(agentViolations).values({
              crdts, agentCode: agentCodeVal,
              date, month: mon(date), type, category,
              hours: String(vHours), deduction: String(n(r.deduction)),
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
          const otType = normalizeOtType(r.otType);
          if (!otType) { invalid++; rejected.push({ row: i + 1, reason: `OT type "${s(r.otType)}" must be 1.5x, 2x or 3x` }); continue; }
          const otHours = hrs(r.hours);
          if (otHours == null || otHours <= 0 || otHours > 16) { invalid++; rejected.push({ row: i + 1, reason: `unreadable or out-of-range OT hours "${s(r.hours)}"` }); continue; }
          const existing = await db.select().from(cycleOT).where(and(
            eq(cycleOT.crdts, crdts),
            eq(cycleOT.date, date),
            eq(cycleOT.otType, otType),
          )).limit(1);
          if (existing.length) { skipped++; continue; }
          await db.insert(cycleOT).values({
            crdts, agentCode: agentCodeVal, alias: s(r.alias) || null,
            date, cycleKey: mon(date), otType,
            hours: String(otHours), egpAmount: String(n(r.egp)),
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
          const cHours = hrs(r.hours);
          if (cHours == null) { invalid++; rejected.push({ row: i + 1, reason: `unreadable coaching hours "${s(r.hours)}"` }); continue; }
          await db.insert(coachingSessions).values({
            crdts, agentCode: agentCodeVal, alias: s(r.alias) || null,
            sessionDate: date, cycleKey: mon(date),
            sessionType: topic,
            coachingHours: String(cHours), bonusAmount: String(n(r.egp)),
            notes: s(r.notes) || null,
            status: st === "approved" ? "approved" : st === "rejected" ? "rejected" : "pending",
            uploadedAt: now,
          });
          inserted++;
        }
      }
      res.json({ ok: true, kind, received: rows.length, inserted, skipped, invalid, rejected: rejected.slice(0, 50) });
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
      const getCycleKey = (iso: string): string => cycleKeyFor(iso);
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
          loginHours: (() => {
            const h = toDecimalHours(r["Login Hours"] ?? r["loginHours"] ?? 0);
            if (h == null || h > 24) throw new Error(`Row ${i + 1}: unreadable Login Hours "${String(r["Login Hours"] ?? r["loginHours"])}"`);
            return round2(h);
          })(),
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
          cycleKey: cycleKeyFor(date),        // 26th→25th pay cycle (same rule everywhere)
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
          cycleKey: cycleKeyFor(date),
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
      if (!signingSecret) {
        // Fail closed: without a signing secret anyone could POST fake reaction events and flip request statuses.
        console.warn("[slack] SLACK_SIGNING_SECRET is not set — rejecting event");
        res.status(503).send("slack signing secret not configured");
        return;
      }
      {
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

      // 4) Process the event — once. Slack retries and a captured request can be replayed
      // inside the 5-minute signature window, so every event_id is remembered for 10 minutes.
      if (body.type !== "event_callback") return;
      {
        const evId = String((body as Record<string, unknown>).event_id ?? "");
        if (evId) {
          const now = Date.now();
          _slackSeenEvents.forEach((exp, k) => { if (exp < now) _slackSeenEvents.delete(k); });
          if (_slackSeenEvents.has(evId)) { console.log("[slack] duplicate event", evId, "— ignored"); return; }
          _slackSeenEvents.set(evId, now + 10 * 60_000);
        }
      }
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
          const { getRequestBySlackMessageTs } = await import("../db");
          const reqRow = await getRequestBySlackMessageTs(item.ts);
          if (reqRow) {
            const cHook = process.env.SLACK_ADMIN_WEBHOOK;
            const target = statusMap[rxn];
            // Only approvers may decide by reaction. SLACK_APPROVER_USER_IDS = comma-separated Slack user IDs
            // (U0123…). When set, reactions from anyone else are ignored (and noted in the channel).
            const approvers = (process.env.SLACK_APPROVER_USER_IDS ?? "").split(",").map(x => x.trim()).filter(Boolean);
            const reactor = String(ev.user ?? "");
            if (approvers.length && !approvers.includes(reactor)) {
              if (cHook) fetch(cHook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: `:no_entry: <@${reactor}> is not an approver — reaction on *${reqRow.traineeCode}*'s request ignored.` }) }).catch(() => {});
              return;
            }
            const decidedBy = approvers.length ? `Slack <@${reactor}>` : "Slack reaction";
            // Leave needs a casual/annual/unpaid classification, which a reaction can't carry — those must be
            // decided in the Hub. Everything else goes through the SAME decision helper as the Hub button,
            // so attendance exceptions and request status stay in step.
            const needsHub = target === "resolved" && (reqRow.type === "leave" || reqRow.type === "paid_leave"); // sick_note / day_off default to unpaid
            if (needsHub) {
              if (cHook) fetch(cHook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: `:warning: *${reqRow.traineeCode}*'s ${reqRow.type.replace("_", " ")} request needs the leave type (casual / annual / unpaid) \u2014 approve it in the Hub \u2192 Requests.` }) }).catch(() => {});
              return;
            }
            const { applyAgentRequestDecision } = await import("../routers");
            await applyAgentRequestDecision({ id: reqRow.id, status: target, decidedBy });
            if (cHook) fetch(cHook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: `:white_check_mark: Request from *${reqRow.traineeCode}* \u2192 *${target.replace("_", " ")}*` }) }).catch(() => {});
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

  // ── CSRF: reject cross-origin state-changing requests ──────────────────────
  // Mounted BEFORE the tRPC handler so it actually runs. GET (queries) pass;
  // POST (mutations) must come from our own origin.
  app.use("/api/trpc", (req, res, next) => {
    if (req.method === "GET") return next(); // queries are safe
    const origin = req.headers["origin"] as string | undefined;
    if (!origin) return next(); // same-origin fetches may omit Origin; cookies are SameSite anyway
    // Behind the proxy the Host header is the upstream (e.g. localhost:3000) — compare against the
    // host the browser actually used, and always accept the configured public origin(s).
    const fwdHost = TRUST_PROXY ? (req.headers["x-forwarded-host"] as string | undefined)?.split(",")[0]?.trim() : undefined;
    const host = fwdHost || (req.headers["host"] as string | undefined);
    try {
      const originHost = new URL(origin).host;
      if (originHost === host || isAllowedOrigin(origin)) return next();
    } catch {
      res.status(403).json({ error: "Invalid origin." });
      return;
    }
    res.status(403).json({ error: "Cross-origin request rejected." });
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError({ error, path }) {
        // Log message + path ONLY. The raw error object can carry the failed query's
        // parameters (bank numbers, national IDs) — those must never reach the logs.
        if (error.code === "INTERNAL_SERVER_ERROR") {
          console.error(`[tRPC] ${path ?? "unknown"}: ${error.message}`);
        }
        // Sanitize: replace generic internal errors with a safe message
        if (error.code === "INTERNAL_SERVER_ERROR" && process.env.NODE_ENV === "production") {
          error.message = "An internal error occurred. Please try again.";
        }
      },
    })
  );

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  // In production the reverse proxy points at ONE port — silently moving to another
  // is an outage that looks healthy. Fail fast instead; dev keeps the convenience.
  let port = preferredPort;
  if (process.env.NODE_ENV === "production") {
    if (!(await isPortAvailable(preferredPort))) {
      console.error(`FATAL: port ${preferredPort} is already in use.`);
      process.exit(1);
    }
  } else {
    port = await findAvailablePort(preferredPort);
    if (port !== preferredPort) console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  // ── Graceful shutdown: stop accepting, finish in-flight requests, close the DB pool ──
  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received — shutting down gracefully…`);
    const hardExit = setTimeout(() => { console.error("Forced exit after 15s."); process.exit(1); }, 15_000);
    hardExit.unref();
    server.close(async () => {
      try {
        const { closeDbPool } = await import("../db");
        await closeDbPool();
      } catch { /* pool may not be open */ }
      process.exit(0);
    });
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer().catch(console.error);
