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

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb", verify: (req, _res, buf) => { (req as unknown as { rawBody?: Buffer }).rawBody = buf; } }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // Temporary migration endpoint — adds subStatus column for No Answer feature
  app.post("/api/run-migration-substatus", async (_req, res) => {
    res.setTimeout(300000); // 5 min timeout for this endpoint
    try {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) { res.status(500).json({ error: "DB not available" }); return; }
      const { sql } = await import("drizzle-orm");
      // Check if subStatus column already exists
      const result = await db.execute(sql`SHOW COLUMNS FROM \`candidates\` LIKE 'subStatus'`);
      const cols = (result as unknown as Array<Array<{Field: string}>>)[0] ?? [];
      if (cols.length > 0) {
        res.json({ ok: true, message: "Already migrated - subStatus column exists" });
        return;
      }
      await db.execute(sql`ALTER TABLE \`candidates\` ADD COLUMN \`subStatus\` VARCHAR(50) NULL DEFAULT NULL`);
      res.json({ ok: true, message: "subStatus column added" });
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });
  // Round 22 migration — create agent portal tables
  app.post("/api/run-migration-round22", async (_req, res) => {
    res.setTimeout(120000);
    try {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) { res.status(500).json({ error: "DB not available" }); return; }
      const { sql } = await import("drizzle-orm");
      const results: string[] = [];

      // agent_credentials
      const ac = (await db.execute(sql`SHOW TABLES LIKE 'agent_credentials'`) as unknown as Array<unknown[]>)[0] ?? [];
      if (ac.length === 0) {
        await db.execute(sql`CREATE TABLE agent_credentials (
          id INT AUTO_INCREMENT PRIMARY KEY,
          candidateId INT NOT NULL UNIQUE,
          traineeCode VARCHAR(100) NOT NULL UNIQUE,
          passwordHash VARCHAR(255) NOT NULL,
          generatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
        )`);
        results.push("agent_credentials created");
      } else { results.push("agent_credentials already exists"); }

      // payroll_records
      const pr = (await db.execute(sql`SHOW TABLES LIKE 'payroll_records'`) as unknown as Array<unknown[]>)[0] ?? [];
      if (pr.length === 0) {
        await db.execute(sql`CREATE TABLE payroll_records (
          id INT AUTO_INCREMENT PRIMARY KEY,
          candidateId INT NOT NULL,
          month VARCHAR(7) NOT NULL,
          grossSalary DECIMAL(10,2),
          deductions DECIMAL(10,2) DEFAULT 0,
          netPay DECIMAL(10,2),
          paymentDate BIGINT,
          status ENUM('pending','paid','on_hold') DEFAULT 'pending' NOT NULL,
          notes TEXT,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
          UNIQUE KEY uq_payroll_candidate_month (candidateId, month)
        )`);
        results.push("payroll_records created");
      } else { results.push("payroll_records already exists"); }

      // performance_records
      const perf = (await db.execute(sql`SHOW TABLES LIKE 'performance_records'`) as unknown as Array<unknown[]>)[0] ?? [];
      if (perf.length === 0) {
        await db.execute(sql`CREATE TABLE performance_records (
          id INT AUTO_INCREMENT PRIMARY KEY,
          candidateId INT NOT NULL,
          period VARCHAR(7) NOT NULL,
          callsMade INT,
          leadsGenerated INT,
          targetsHit INT,
          totalTargets INT,
          qualityScore DECIMAL(4,1),
          attendanceRate DECIMAL(5,2),
          notes TEXT,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
          UNIQUE KEY uq_perf_candidate_period (candidateId, period)
        )`);
        results.push("performance_records created");
      } else { results.push("performance_records already exists"); }

      res.json({ ok: true, results });
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  // File upload endpoint for agent documents
  app.post("/api/upload-doc", async (req, res) => {
    try {
      const busboy = (await import("busboy")).default;
      const bb = busboy({ headers: req.headers, limits: { fileSize: 16 * 1024 * 1024 } });
      const chunks: Buffer[] = [];
      let mimeType = "application/octet-stream";
      let fileName = "upload";
      bb.on("file", (_field: string, file: NodeJS.ReadableStream, info: { filename: string; mimeType: string }) => {
        mimeType = info.mimeType;
        fileName = info.filename || "upload";
        file.on("data", (chunk: Buffer) => chunks.push(chunk));
      });
      bb.on("finish", async () => {
        try {
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
    const redirectUri = `${origin}/api/oauth/google/callback`;
    const scopes = [
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" ");
    const state = Buffer.from(JSON.stringify({ origin })).toString("base64");
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
      try { origin = JSON.parse(Buffer.from(stateRaw, "base64").toString()).origin; } catch {}
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

      // Store tokens in DB
      const { getDb } = await import("../db");
      const db = await getDb();
      if (db) {
        const { integrationsTokens } = await import("../../drizzle/schema");
        const { sql } = await import("drizzle-orm");
        const now = Date.now();
        await db.execute(sql`
          INSERT INTO integrations_tokens (provider, access_token, refresh_token, expires_at, scope, created_at, updated_at)
          VALUES ('google', ${tokenData.access_token}, ${tokenData.refresh_token ?? null}, ${now + (tokenData.expires_in ?? 3600) * 1000}, ${tokenData.scope ?? null}, ${now}, ${now})
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

  // ─── REST API: POST /api/upload/logs ──────────────────────────────────────
  // Receives Adherence / OT / Coaching rows pushed from Google Sheets (Apps Script).
  //
  // IMPORTANT: this is DISPLAY-ONLY. It never touches payroll_records or payslips —
  // payroll is calculated externally in Python from the same sheets. Writing here
  // as well would double-count.
  //
  // Body: { kind: "adherence" | "ot" | "coaching", rows: [...] }
  // Duplicates are skipped (matched on crdts + date + type), so it's safe to
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
      if (!["adherence", "ot", "coaching"].includes(kind)) {
        res.status(400).json({ error: 'kind must be "adherence", "ot" or "coaching"' }); return;
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
        if (kind === "adherence") {
          const type = s(r.type) || "Other";
          const existing = await db.select().from(agentViolations).where(and(
            eq(agentViolations.crdts, crdts),
            eq(agentViolations.date, date),
            eq(agentViolations.type, type),
          )).limit(1);
          if (existing.length) { skipped++; continue; }
          const bits = [s(r.details)];
          if (s(r.offenseNo)) bits.push(`offense #${s(r.offenseNo)}`);
          if (s(r.penalty)) bits.push(s(r.penalty));
          if (s(r.loggedBy)) bits.push(`logged by ${s(r.loggedBy)}`);
          const st = s(r.status).toLowerCase();
          await db.insert(agentViolations).values({
            crdts, agentCode: crdts,
            date, month: mon(date), type, category: "attendance",
            hours: String(n(r.hours)), deduction: String(n(r.deduction)),
            description: bits.filter(Boolean).join(" · ") || null,
            status: st === "approved" ? "approved" : st === "rejected" ? "rejected" : "pending",
            approvedBy: s(r.approvedBy) || null,
            approvedAt: st === "approved" ? now : null,
            uploadedAt: now,
          });
          inserted++;
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
    })
  );
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
