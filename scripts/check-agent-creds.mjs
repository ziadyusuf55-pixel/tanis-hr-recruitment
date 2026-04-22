import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load env from .env file if present
try {
  dotenv.config({ path: resolve(process.cwd(), ".env") });
} catch {}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const conn = await createConnection(url);

console.log("=== agent_credentials ===");
// First check actual column names
const [cols] = await conn.execute("DESCRIBE agent_credentials");
console.log("Columns:", cols.map(c => c.Field));
const [creds] = await conn.execute("SELECT * FROM agent_credentials LIMIT 20");
console.log(JSON.stringify(creds, null, 2));

console.log("\n=== login_attempts (last 20) ===");
const [attCols] = await conn.execute("DESCRIBE login_attempts");
console.log("login_attempts columns:", attCols.map(c => c.Field));
const [attempts] = await conn.execute("SELECT * FROM login_attempts ORDER BY id DESC LIMIT 20");
console.log(JSON.stringify(attempts, null, 2));

await conn.end();
