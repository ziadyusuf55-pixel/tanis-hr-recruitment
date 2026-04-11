import mysql from "mysql2/promise";
import { readFileSync } from "fs";

const sql = readFileSync(
  new URL("../drizzle/0003_rich_profile.sql", import.meta.url),
  "utf8"
);

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const statements = sql
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.startsWith("--"));

for (const stmt of statements) {
  try {
    await conn.execute(stmt);
    console.log("✓", stmt.slice(0, 60));
  } catch (err) {
    if (err.code === "ER_DUP_FIELDNAME" || err.code === "ER_TABLE_EXISTS_ERROR") {
      console.log("⚠ already exists, skipping:", stmt.slice(0, 60));
    } else {
      console.error("✗ Error:", err.message, "\n  Statement:", stmt.slice(0, 80));
      process.exit(1);
    }
  }
}

await conn.end();
console.log("Migration complete.");
