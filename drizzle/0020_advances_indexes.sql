-- 0020: agent_advances table + indexes.
-- The table was added to drizzle/schema.ts after db:push was disabled and no migration ever created it,
-- so production has no agent_advances table (Salary Advances tab errors / hangs). Create it idempotently
-- (same columns as schema.ts), then add the indexes. Guarded so re-runs are no-ops.
CREATE TABLE IF NOT EXISTS `agent_advances` (
  `id` int NOT NULL AUTO_INCREMENT,
  `traineeCode` varchar(100) NOT NULL,
  `amountEgp` decimal(10,2) NOT NULL,
  `issuedDate` varchar(10) NOT NULL,
  `reason` varchar(500) DEFAULT NULL,
  `status` enum('pending','deducted','cancelled') NOT NULL DEFAULT 'pending',
  `deductCycle` varchar(7) DEFAULT NULL,
  `deductedAt` bigint DEFAULT NULL,
  `notes` text,
  `createdBy` varchar(255) DEFAULT NULL,
  `createdAt` bigint NOT NULL,
  `updatedAt` bigint NOT NULL,
  PRIMARY KEY (`id`)
);
SET @q = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agent_advances' AND INDEX_NAME = 'idx_adv_trainee_created') = 0,
  'CREATE INDEX `idx_adv_trainee_created` ON `agent_advances` (`traineeCode`, `createdAt`)', 'SELECT 1');
PREPARE s FROM @q;
EXECUTE s;
DEALLOCATE PREPARE s;
SET @q = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agent_advances' AND INDEX_NAME = 'idx_adv_status_cycle') = 0,
  'CREATE INDEX `idx_adv_status_cycle` ON `agent_advances` (`status`, `deductCycle`)', 'SELECT 1');
PREPARE s FROM @q;
EXECUTE s;
DEALLOCATE PREPARE s;
SET @q = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agent_advances' AND INDEX_NAME = 'idx_adv_created') = 0,
  'CREATE INDEX `idx_adv_created` ON `agent_advances` (`createdAt`)', 'SELECT 1');
PREPARE s FROM @q;
EXECUTE s;
DEALLOCATE PREPARE s;
