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
