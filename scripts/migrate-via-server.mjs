/**
 * Runs the no_answer migration by calling the running dev server's internal DB connection.
 * Uses drizzle's existing pool (which works) rather than a new connection.
 */
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { sql } from "drizzle-orm";

const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  connectionLimit: 1,
  connectTimeout: 30000,
  waitForConnections: true,
});

const db = drizzle(pool);

try {
  console.log("Altering candidates.status...");
  await db.execute(sql`ALTER TABLE \`candidates\` MODIFY COLUMN \`status\` ENUM('applied','whatsapp_sent','no_answer','voice_note_reviewed','interview_scheduled','accepted','whatsapp_group_added','rejected','blacklisted') NOT NULL DEFAULT 'applied'`);
  console.log("✓ candidates.status done");

  console.log("Altering stage_notes.stage...");
  await db.execute(sql`ALTER TABLE \`stage_notes\` MODIFY COLUMN \`stage\` ENUM('applied','whatsapp_sent','no_answer','voice_note_reviewed','interview_scheduled','accepted','whatsapp_group_added','rejected','blacklisted') NOT NULL`);
  console.log("✓ stage_notes.stage done");

  console.log("Migration complete!");
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exit(1);
} finally {
  await pool.end();
}
