import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");

const conn = await createConnection(url);

const statements = [
  // Admin accounts
  `CREATE TABLE IF NOT EXISTS admin_accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    passwordHash VARCHAR(255) NOT NULL,
    role ENUM('admin','viewer') NOT NULL DEFAULT 'admin',
    isActive BOOLEAN NOT NULL DEFAULT TRUE,
    forcePasswordChange BOOLEAN NOT NULL DEFAULT TRUE,
    invitedBy VARCHAR(255),
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,

  // Admin invites
  `CREATE TABLE IF NOT EXISTS admin_invites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    token VARCHAR(128) NOT NULL UNIQUE,
    expiresAt BIGINT NOT NULL,
    usedAt BIGINT,
    invitedBy VARCHAR(255) NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  // Login attempts (rate limiting)
  `CREATE TABLE IF NOT EXISTS login_attempts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    identifier VARCHAR(255) NOT NULL,
    attemptType ENUM('agent','admin') NOT NULL,
    failedAt BIGINT NOT NULL,
    ipAddress VARCHAR(64)
  )`,

  // Index for fast rate-limit lookups
  `CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier ON login_attempts(identifier, attemptType, failedAt)`,

  // Referrals
  `CREATE TABLE IF NOT EXISTS referrals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    referrerCandidateId INT NOT NULL,
    refereeName VARCHAR(255) NOT NULL,
    refereePhone VARCHAR(50) NOT NULL,
    refereeNote TEXT,
    createdCandidateId INT,
    status ENUM('pending','contacted','hired','rejected') NOT NULL DEFAULT 'pending',
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,

  // Agent notifications
  `CREATE TABLE IF NOT EXISTS agent_notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidateId INT NOT NULL,
    message VARCHAR(500) NOT NULL,
    type ENUM('request_reply','referral_update','general') NOT NULL DEFAULT 'general',
    relatedId INT,
    isRead BOOLEAN NOT NULL DEFAULT FALSE,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  // Add requestedDate to agent_requests (for leave/day-off/resignation)
  `ALTER TABLE agent_requests ADD COLUMN IF NOT EXISTS requestedDate BIGINT AFTER message`,

  // Add resignation to agent_requests type enum
  // MySQL requires full ENUM redefinition
  `ALTER TABLE agent_requests MODIFY COLUMN type ENUM('leave','salary','schedule','complaint','other','resignation','day_off') NOT NULL`,
];

for (const sql of statements) {
  try {
    await conn.execute(sql);
    console.log("✓", sql.slice(0, 60).replace(/\n/g, " "));
  } catch (err) {
    if (err.code === "ER_DUP_KEYNAME" || err.message?.includes("Duplicate key")) {
      console.log("⚠ index already exists, skipping");
    } else {
      console.error("✗", err.message);
    }
  }
}

await conn.end();
console.log("Migration complete.");
