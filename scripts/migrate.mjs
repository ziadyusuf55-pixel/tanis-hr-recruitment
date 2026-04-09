import mysql from "mysql2/promise";

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error("DATABASE_URL not set");

const connection = await mysql.createConnection(DB_URL);

const statements = [
  // 1. Alter candidates.status enum
  `ALTER TABLE \`candidates\` MODIFY COLUMN \`status\` enum(
    'applied','whatsapp_sent','voice_note_reviewed','interview_scheduled',
    'accepted','teams_invitation_sent','rejected'
  ) NOT NULL DEFAULT 'applied'`,

  // 2. Extend phone column
  `ALTER TABLE \`candidates\` MODIFY COLUMN \`phone\` varchar(64)`,

  // 3. Add meetLink (ignore if already exists)
  `ALTER TABLE \`candidates\` ADD COLUMN \`meetLink\` text`,

  // 4. Add teamsLink
  `ALTER TABLE \`candidates\` ADD COLUMN \`teamsLink\` text`,

  // 5. Add appliedAt
  `ALTER TABLE \`candidates\` ADD COLUMN \`appliedAt\` bigint`,

  // 6. Add acceptedAt
  `ALTER TABLE \`candidates\` ADD COLUMN \`acceptedAt\` bigint`,

  // 7. Migrate old stage values
  `UPDATE \`candidates\` SET \`status\` = 'voice_note_reviewed' WHERE \`status\` = 'shortlisted'`,
  `UPDATE \`candidates\` SET \`status\` = 'interview_scheduled' WHERE \`status\` = 'interviewed'`,
  `UPDATE \`candidates\` SET \`status\` = 'teams_invitation_sent' WHERE \`status\` = 'offered'`,
  `UPDATE \`candidates\` SET \`status\` = 'accepted' WHERE \`status\` = 'hired'`,

  // 8. Create stage_notes table
  `CREATE TABLE IF NOT EXISTS \`stage_notes\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`candidateId\` int NOT NULL,
    \`stage\` enum(
      'applied','whatsapp_sent','voice_note_reviewed','interview_scheduled',
      'accepted','teams_invitation_sent','rejected'
    ) NOT NULL,
    \`note\` text NOT NULL,
    \`recruiterName\` varchar(255),
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`stage_notes_id\` PRIMARY KEY(\`id\`)
  )`,

  // 9. Drop jobs table
  `DROP TABLE IF EXISTS \`jobs\``,
];

for (const sql of statements) {
  try {
    await connection.execute(sql);
    console.log("✓", sql.trim().split("\n")[0].slice(0, 80));
  } catch (err) {
    if (err.code === "ER_DUP_FIELDNAME" || err.code === "ER_TABLE_EXISTS_ERROR") {
      console.log("⚠ Already exists, skipping:", sql.trim().split("\n")[0].slice(0, 60));
    } else {
      console.error("✗ FAILED:", sql.trim().slice(0, 80));
      console.error("  Error:", err.message);
    }
  }
}

await connection.end();
console.log("\nMigration complete.");
