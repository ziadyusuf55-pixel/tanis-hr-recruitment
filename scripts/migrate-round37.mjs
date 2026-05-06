import { createConnection } from "mysql2/promise";

const conn = await createConnection(process.env.DATABASE_URL);

try {
  // 1. Add dialerCredentials to workforce_agents
  await conn.execute(`
    ALTER TABLE workforce_agents
    ADD COLUMN IF NOT EXISTS dialerCredentials VARCHAR(500) NULL
  `);
  console.log("✓ workforce_agents.dialerCredentials added");

  // 2. Add mustChangePassword to agent_credentials
  await conn.execute(`
    ALTER TABLE agent_credentials
    ADD COLUMN IF NOT EXISTS mustChangePassword TINYINT(1) NOT NULL DEFAULT 1
  `);
  console.log("✓ agent_credentials.mustChangePassword added");

  // 3. Add paid_leave to agent_requests.type enum
  // MySQL requires redefining the full enum
  await conn.execute(`
    ALTER TABLE agent_requests
    MODIFY COLUMN type ENUM(
      'leave','salary','schedule','complaint','resignation',
      'day_off','paid_leave','sick_note','hr_letter','other'
    ) NOT NULL
  `);
  console.log("✓ agent_requests.type enum updated with paid_leave");

} catch (err) {
  console.error("Migration error:", err.message);
} finally {
  await conn.end();
  console.log("Migration complete.");
}
