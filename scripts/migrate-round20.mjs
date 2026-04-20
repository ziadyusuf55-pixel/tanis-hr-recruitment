/**
 * Round 20 Migration Script
 * 1. Rename pipeline stage teams_invitation_sent → whatsapp_group_added
 *    - Update candidates.status enum
 *    - Update stage_notes.stage enum
 *    - Update existing rows
 * 2. Add endDate and batchNotes to training_batches
 * 3. Add trainerNotes, attendedSessions, totalSessions to batch_candidates
 */

import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

try {
  console.log("Starting Round 20 migration...");

  // 1. First update existing rows BEFORE altering enum (to avoid data truncation)
  console.log("Migrating existing candidates with teams_invitation_sent...");
  // Temporarily add whatsapp_group_added to the enum while keeping teams_invitation_sent
  await conn.execute(`
    ALTER TABLE candidates
    MODIFY COLUMN status ENUM(
      'applied',
      'whatsapp_sent',
      'voice_note_reviewed',
      'interview_scheduled',
      'accepted',
      'teams_invitation_sent',
      'whatsapp_group_added',
      'rejected',
      'blacklisted'
    ) NOT NULL DEFAULT 'applied'
  `);
  const [result] = await conn.execute(`
    UPDATE candidates SET status = 'whatsapp_group_added' WHERE status = 'teams_invitation_sent'
  `);
  console.log(`  Updated ${result.affectedRows} candidate(s)`);

  // 2. Now remove teams_invitation_sent from candidates.status enum
  console.log("Finalizing candidates.status enum...");
  await conn.execute(`
    ALTER TABLE candidates
    MODIFY COLUMN status ENUM(
      'applied',
      'whatsapp_sent',
      'voice_note_reviewed',
      'interview_scheduled',
      'accepted',
      'whatsapp_group_added',
      'rejected',
      'blacklisted'
    ) NOT NULL DEFAULT 'applied'
  `);

  // 3. Update stage_notes rows BEFORE altering enum
  console.log("Migrating existing stage_notes with teams_invitation_sent...");
  await conn.execute(`
    ALTER TABLE stage_notes
    MODIFY COLUMN stage ENUM(
      'applied',
      'whatsapp_sent',
      'voice_note_reviewed',
      'interview_scheduled',
      'accepted',
      'teams_invitation_sent',
      'whatsapp_group_added',
      'rejected',
      'blacklisted'
    ) NOT NULL
  `);
  const [snResult] = await conn.execute(`
    UPDATE stage_notes SET stage = 'whatsapp_group_added' WHERE stage = 'teams_invitation_sent'
  `);
  console.log(`  Updated ${snResult.affectedRows} stage note(s)`);

  // 4. Finalize stage_notes.stage enum
  console.log("Finalizing stage_notes.stage enum...");
  await conn.execute(`
    ALTER TABLE stage_notes
    MODIFY COLUMN stage ENUM(
      'applied',
      'whatsapp_sent',
      'voice_note_reviewed',
      'interview_scheduled',
      'accepted',
      'whatsapp_group_added',
      'rejected',
      'blacklisted'
    ) NOT NULL
  `);

  // 5. Add endDate and batchNotes to training_batches
  console.log("Adding endDate and batchNotes to training_batches...");
  // Check if columns already exist first
  const [cols] = await conn.execute(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'training_batches'
    AND COLUMN_NAME IN ('endDate', 'batchNotes')
  `);
  const existingCols = cols.map(c => c.COLUMN_NAME);

  if (!existingCols.includes('endDate')) {
    await conn.execute(`ALTER TABLE training_batches ADD COLUMN endDate BIGINT NULL`);
    console.log("  Added endDate column");
  } else {
    console.log("  endDate already exists, skipping");
  }

  if (!existingCols.includes('batchNotes')) {
    await conn.execute(`ALTER TABLE training_batches ADD COLUMN batchNotes TEXT NULL`);
    console.log("  Added batchNotes column");
  } else {
    console.log("  batchNotes already exists, skipping");
  }

  // 6. Add trainerNotes, attendedSessions, totalSessions to batch_candidates
  console.log("Adding trainer fields to batch_candidates...");
  const [bcCols] = await conn.execute(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'batch_candidates'
    AND COLUMN_NAME IN ('trainerNotes', 'attendedSessions', 'totalSessions')
  `);
  const existingBcCols = bcCols.map(c => c.COLUMN_NAME);

  if (!existingBcCols.includes('trainerNotes')) {
    await conn.execute(`ALTER TABLE batch_candidates ADD COLUMN trainerNotes TEXT NULL`);
    console.log("  Added trainerNotes column");
  } else {
    console.log("  trainerNotes already exists, skipping");
  }

  if (!existingBcCols.includes('attendedSessions')) {
    await conn.execute(`ALTER TABLE batch_candidates ADD COLUMN attendedSessions INT NOT NULL DEFAULT 0`);
    console.log("  Added attendedSessions column");
  } else {
    console.log("  attendedSessions already exists, skipping");
  }

  if (!existingBcCols.includes('totalSessions')) {
    await conn.execute(`ALTER TABLE batch_candidates ADD COLUMN totalSessions INT NOT NULL DEFAULT 0`);
    console.log("  Added totalSessions column");
  } else {
    console.log("  totalSessions already exists, skipping");
  }

  console.log("✅ Round 20 migration complete!");
} catch (err) {
  console.error("Migration failed:", err);
  process.exit(1);
} finally {
  await conn.end();
}
