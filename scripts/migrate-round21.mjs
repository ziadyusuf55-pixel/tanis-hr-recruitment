/**
 * Round 21 migration:
 * 1. Add 'no_answer' to candidates.status enum
 * 2. Add 'no_answer' to stage_notes.stage enum
 */
import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

try {
  console.log("Starting Round 21 migration...");

  // 1. Alter candidates.status enum to include no_answer
  await conn.execute(`
    ALTER TABLE \`candidates\`
    MODIFY COLUMN \`status\` ENUM(
      'applied',
      'whatsapp_sent',
      'no_answer',
      'voice_note_reviewed',
      'interview_scheduled',
      'accepted',
      'whatsapp_group_added',
      'rejected',
      'blacklisted'
    ) NOT NULL DEFAULT 'applied'
  `);
  console.log("✓ candidates.status enum updated with no_answer");

  // 2. Alter stage_notes.stage enum to include no_answer
  await conn.execute(`
    ALTER TABLE \`stage_notes\`
    MODIFY COLUMN \`stage\` ENUM(
      'applied',
      'whatsapp_sent',
      'no_answer',
      'voice_note_reviewed',
      'interview_scheduled',
      'accepted',
      'whatsapp_group_added',
      'rejected',
      'blacklisted'
    ) NOT NULL
  `);
  console.log("✓ stage_notes.stage enum updated with no_answer");

  console.log("Round 21 migration complete!");
} catch (err) {
  console.error("Migration failed:", err);
  process.exit(1);
} finally {
  await conn.end();
}
