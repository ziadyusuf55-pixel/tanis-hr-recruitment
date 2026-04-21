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
  app.use(express.json({ limit: "50mb" }));
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
