import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

try {
  // 1. Modify the type enum to add resignation and day_off
  await conn.execute(`
    ALTER TABLE agent_requests 
    MODIFY COLUMN type ENUM('leave','salary','schedule','complaint','resignation','day_off','other') NOT NULL
  `);
  console.log("✅ Updated agent_requests.type enum");

  // 2. Add requestedDate column
  await conn.execute(`
    ALTER TABLE agent_requests 
    ADD COLUMN IF NOT EXISTS requestedDate BIGINT NULL COMMENT 'UTC ms timestamp for date-based requests'
  `);
  console.log("✅ Added agent_requests.requestedDate column");

} catch (err) {
  console.error("Migration error:", err.message);
  process.exit(1);
} finally {
  await conn.end();
}
console.log("✅ Round 27b migration complete");
