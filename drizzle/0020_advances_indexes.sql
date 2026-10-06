-- 0020: indexes for agent_advances (Salary Advances tab / payroll tag lookups).
-- listAdvances orders by createdAt and the payroll page filters by status + deductCycle;
-- the table had no secondary index at all. Guarded so re-runs are no-ops.
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
