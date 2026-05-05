import { createConnection } from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const url = process.env.DATABASE_URL;
if (!url) { console.error("No DATABASE_URL"); process.exit(1); }

const conn = await createConnection(url);
try {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS \`agent_comments\` (
      \`id\` int AUTO_INCREMENT PRIMARY KEY,
      \`traineeCode\` varchar(100) NOT NULL,
      \`adminName\` varchar(255) NOT NULL,
      \`content\` text NOT NULL,
      \`tag\` ENUM('note','warning','resolved') NOT NULL DEFAULT 'note',
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("✅ agent_comments table created");
} catch (e) {
  console.error("Migration error:", e.message);
} finally {
  await conn.end();
}
