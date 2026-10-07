-- 0021: permanent ledger of every agent ID (trainee code) ever issued.
-- Agent IDs are generated (T-NNNNN, random) and NEVER reused: the ledger's primary key is what makes
-- allocation atomic (two admins clicking Generate at once cannot get the same code), and a released
-- code (trainee regenerated / agent deleted) stays in the ledger forever so it can never come back.
CREATE TABLE IF NOT EXISTS `trainee_code_ledger` (
  `code` varchar(100) NOT NULL,
  `candidateId` int DEFAULT NULL,
  `source` varchar(40) NOT NULL DEFAULT 'backfill',
  `assignedAt` bigint NOT NULL,
  `releasedAt` bigint DEFAULT NULL,
  PRIMARY KEY (`code`)
);
-- Backfill every code already in use anywhere (idempotent).
INSERT IGNORE INTO `trainee_code_ledger` (`code`, `candidateId`, `source`, `assignedAt`) SELECT `traineeCode`, `candidateId`, 'backfill', UNIX_TIMESTAMP() * 1000 FROM `workforce_agents` WHERE `traineeCode` IS NOT NULL AND `traineeCode` <> '';
INSERT IGNORE INTO `trainee_code_ledger` (`code`, `candidateId`, `source`, `assignedAt`) SELECT `traineeCode`, `candidateId`, 'backfill', UNIX_TIMESTAMP() * 1000 FROM `agent_credentials` WHERE `traineeCode` IS NOT NULL AND `traineeCode` <> '';
INSERT IGNORE INTO `trainee_code_ledger` (`code`, `candidateId`, `source`, `assignedAt`) SELECT `traineeCode`, `candidateId`, 'backfill', UNIX_TIMESTAMP() * 1000 FROM `batch_candidates` WHERE `traineeCode` IS NOT NULL AND `traineeCode` <> '';
-- Unique index on batch_candidates.traineeCode — only when no duplicates exist today (otherwise skip; the ledger still protects new codes).
SET @q = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'batch_candidates' AND INDEX_NAME = 'uq_bc_trainee_code') = 0
         AND (SELECT COUNT(*) FROM (SELECT `traineeCode` FROM `batch_candidates` WHERE `traineeCode` IS NOT NULL GROUP BY `traineeCode` HAVING COUNT(*) > 1) d) = 0,
  'CREATE UNIQUE INDEX `uq_bc_trainee_code` ON `batch_candidates` (`traineeCode`)', 'SELECT 1');
PREPARE s FROM @q;
EXECUTE s;
DEALLOCATE PREPARE s;
