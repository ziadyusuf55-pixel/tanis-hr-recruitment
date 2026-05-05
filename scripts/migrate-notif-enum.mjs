import { createConnection } from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const url = process.env.DATABASE_URL;
if (!url) { console.error("No DATABASE_URL"); process.exit(1); }

const conn = await createConnection(url);
try {
  await conn.execute(
    "ALTER TABLE `agent_notifications` MODIFY COLUMN `type` ENUM('request_reply','referral_update','general','campaign_assigned') NOT NULL DEFAULT 'general'"
  );
  console.log("✅ Enum updated: campaign_assigned added to agent_notifications.type");
} catch (e) {
  console.error("Migration error:", e.message);
} finally {
  await conn.end();
}
