import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

await conn.execute(
  `ALTER TABLE candidates MODIFY COLUMN status ENUM('applied','whatsapp_sent','voice_note_reviewed','interview_scheduled','accepted','teams_invitation_sent','rejected','blacklisted') NOT NULL DEFAULT 'applied'`
);
console.log("✓ candidates.status enum updated");

await conn.execute(
  `ALTER TABLE stage_notes MODIFY COLUMN stage ENUM('applied','whatsapp_sent','voice_note_reviewed','interview_scheduled','accepted','teams_invitation_sent','rejected','blacklisted') NOT NULL`
);
console.log("✓ stage_notes.stage enum updated");

await conn.end();
console.log("Migration complete.");
