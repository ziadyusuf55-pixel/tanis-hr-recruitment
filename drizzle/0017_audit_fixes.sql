-- 0017: Code-audit fixes (Oct 2026). SAFE TO RE-RUN — every statement is guarded.
--
-- MySQL 8 / TiDB has no `ADD COLUMN IF NOT EXISTS` or `CREATE INDEX IF NOT EXISTS`,
-- so each DDL is wrapped in an INFORMATION_SCHEMA check + prepared statement.
--
-- What this does:
--   1. clients.timeTrackingEnabled  — per-client feature flag replacing the name LIKE '%quantum%' gate
--   2. workforce_agents.isDemo       — ensure the column exists (0015 inserted into it without creating it)
--   3. leave_requests.agentRequestId — links portal leave requests to their request-centre row
--   4. agent_aux_logs / agent_shifts.durationMs → BIGINT (INT overflowed after ~24.8 days → agent stuck in AUX)
--   5. agent_aux_logs indexes (every AUX query filtered unindexed columns)
--   6. cycle_stats / cycle_ot / cycle_deductions: DEDUPE then add the UNIQUE keys the upserts rely on
--   7. cycleKey indexes on the three cycle tables
--   8. Revoke the shared-password demo logins seeded by 0015

-- ── helper macro pattern ──────────────────────────────────────────────────────
-- SET @q = IF(<missing>, '<DDL>', 'SELECT 1');  then PREPARE s FROM @q;  EXECUTE s;  DEALLOCATE PREPARE s;  (one per line)

-- 1. clients.timeTrackingEnabled
SET @q = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clients' AND COLUMN_NAME = 'timeTrackingEnabled') = 0,
  'ALTER TABLE `clients` ADD COLUMN `timeTrackingEnabled` TINYINT(1) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE s FROM @q;
EXECUTE s;
DEALLOCATE PREPARE s;
-- Quantum is the only client with time tracking today.
UPDATE `clients` SET `timeTrackingEnabled` = 1 WHERE `id` = 2 OR LOWER(`name`) LIKE '%quantum%';

-- 2. workforce_agents.isDemo
SET @q = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'workforce_agents' AND COLUMN_NAME = 'isDemo') = 0,
  'ALTER TABLE `workforce_agents` ADD COLUMN `isDemo` TINYINT(1) DEFAULT 0', 'SELECT 1');
PREPARE s FROM @q;
EXECUTE s;
DEALLOCATE PREPARE s;

-- 3. leave_requests.agentRequestId
SET @q = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leave_requests' AND COLUMN_NAME = 'agentRequestId') = 0,
  'ALTER TABLE `leave_requests` ADD COLUMN `agentRequestId` INT NULL', 'SELECT 1');
PREPARE s FROM @q;
EXECUTE s;
DEALLOCATE PREPARE s;

-- 4. durationMs → BIGINT
SET @q = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agent_aux_logs' AND COLUMN_NAME = 'durationMs' AND DATA_TYPE <> 'bigint') > 0,
  'ALTER TABLE `agent_aux_logs` MODIFY COLUMN `durationMs` BIGINT NULL', 'SELECT 1');
PREPARE s FROM @q;
EXECUTE s;
DEALLOCATE PREPARE s;
SET @q = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agent_shifts' AND COLUMN_NAME = 'durationMs' AND DATA_TYPE <> 'bigint') > 0,
  'ALTER TABLE `agent_shifts` MODIFY COLUMN `durationMs` BIGINT NULL', 'SELECT 1');
PREPARE s FROM @q;
EXECUTE s;
DEALLOCATE PREPARE s;

-- 5. AUX indexes
SET @q = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agent_aux_logs' AND INDEX_NAME = 'idx_aux_trainee_start') = 0,
  'CREATE INDEX `idx_aux_trainee_start` ON `agent_aux_logs` (`traineeCode`, `startTime`)', 'SELECT 1');
PREPARE s FROM @q;
EXECUTE s;
DEALLOCATE PREPARE s;
SET @q = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agent_aux_logs' AND INDEX_NAME = 'idx_aux_trainee_end') = 0,
  'CREATE INDEX `idx_aux_trainee_end` ON `agent_aux_logs` (`traineeCode`, `endTime`)', 'SELECT 1');
PREPARE s FROM @q;
EXECUTE s;
DEALLOCATE PREPARE s;

-- 6a. DEDUPE cycle_stats on (crdts, date) — keep the newest row (highest id)
DELETE a FROM `cycle_stats` a
  JOIN `cycle_stats` b ON a.`crdts` = b.`crdts` AND a.`date` = b.`date` AND a.`id` < b.`id`;
SET @q = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cycle_stats' AND INDEX_NAME = 'uq_cycle_stats_crdts_date') = 0,
  'CREATE UNIQUE INDEX `uq_cycle_stats_crdts_date` ON `cycle_stats` (`crdts`, `date`)', 'SELECT 1');
PREPARE s FROM @q;
EXECUTE s;
DEALLOCATE PREPARE s;

-- 6b. DEDUPE cycle_ot on (crdts, date, otType) — keep the newest row
DELETE a FROM `cycle_ot` a
  JOIN `cycle_ot` b ON a.`crdts` = b.`crdts` AND a.`date` = b.`date` AND a.`otType` = b.`otType` AND a.`id` < b.`id`;
SET @q = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cycle_ot' AND INDEX_NAME = 'uq_cycle_ot_crdts_date_type') = 0,
  'CREATE UNIQUE INDEX `uq_cycle_ot_crdts_date_type` ON `cycle_ot` (`crdts`, `date`, `otType`)', 'SELECT 1');
PREPARE s FROM @q;
EXECUTE s;
DEALLOCATE PREPARE s;

-- 6c. DEDUPE cycle_deductions on (crdts, date, violationType) — keep the newest row
DELETE a FROM `cycle_deductions` a
  JOIN `cycle_deductions` b ON a.`crdts` = b.`crdts` AND a.`date` = b.`date` AND a.`violationType` = b.`violationType` AND a.`id` < b.`id`;
SET @q = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cycle_deductions' AND INDEX_NAME = 'uq_cycle_deductions_crdts_date_type') = 0,
  'CREATE UNIQUE INDEX `uq_cycle_deductions_crdts_date_type` ON `cycle_deductions` (`crdts`, `date`, `violationType`)', 'SELECT 1');
PREPARE s FROM @q;
EXECUTE s;
DEALLOCATE PREPARE s;

-- 7. cycleKey indexes
SET @q = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cycle_stats' AND INDEX_NAME = 'idx_cycle_stats_cycle') = 0,
  'CREATE INDEX `idx_cycle_stats_cycle` ON `cycle_stats` (`cycleKey`)', 'SELECT 1');
PREPARE s FROM @q;
EXECUTE s;
DEALLOCATE PREPARE s;
SET @q = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cycle_ot' AND INDEX_NAME = 'idx_cycle_ot_cycle') = 0,
  'CREATE INDEX `idx_cycle_ot_cycle` ON `cycle_ot` (`cycleKey`)', 'SELECT 1');
PREPARE s FROM @q;
EXECUTE s;
DEALLOCATE PREPARE s;
SET @q = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cycle_deductions' AND INDEX_NAME = 'idx_cycle_deductions_cycle') = 0,
  'CREATE INDEX `idx_cycle_deductions_cycle` ON `cycle_deductions` (`cycleKey`)', 'SELECT 1');
PREPARE s FROM @q;
EXECUTE s;
DEALLOCATE PREPARE s;

-- 8. Revoke the three demo logins seeded by 0015 with the shared password "Tanis2025".
--    isDemo agents cannot log in on production any more (server/_core/agentAuth.ts); removing the
--    credentials means the leaked hash is gone too. Regenerate via Operations → Generate Credentials if needed.
DELETE FROM `agent_credentials` WHERE `traineeCode` IN ('QNT-TEST1', 'QNT-TEST2', 'QNT-TEST3');
UPDATE `workforce_agents` SET `sessionRevokedAt` = (UNIX_TIMESTAMP() * 1000) WHERE `traineeCode` IN ('QNT-TEST1', 'QNT-TEST2', 'QNT-TEST3');

-- 9. Re-key rows that the sheet-push paths filed by CALENDAR month. The UI and every reader use the
--    26th→25th pay cycle, so a row dated the 26th–31st belongs to the NEXT month's cycle.
--    Only rows whose cycleKey still equals their own calendar month are touched (idempotent).
UPDATE `cycle_ot`
   SET `cycleKey` = DATE_FORMAT(DATE_ADD(STR_TO_DATE(`date`, '%Y-%m-%d'), INTERVAL 1 MONTH), '%Y-%m')
 WHERE DAY(STR_TO_DATE(`date`, '%Y-%m-%d')) >= 26 AND `cycleKey` = LEFT(`date`, 7);
UPDATE `cycle_deductions`
   SET `cycleKey` = DATE_FORMAT(DATE_ADD(STR_TO_DATE(`date`, '%Y-%m-%d'), INTERVAL 1 MONTH), '%Y-%m')
 WHERE DAY(STR_TO_DATE(`date`, '%Y-%m-%d')) >= 26 AND `cycleKey` = LEFT(`date`, 7);
UPDATE `coaching_sessions`
   SET `cycleKey` = DATE_FORMAT(DATE_ADD(STR_TO_DATE(`sessionDate`, '%Y-%m-%d'), INTERVAL 1 MONTH), '%Y-%m')
 WHERE DAY(STR_TO_DATE(`sessionDate`, '%Y-%m-%d')) >= 26 AND `cycleKey` = LEFT(`sessionDate`, 7);
UPDATE `client_logouts`
   SET `cycleKey` = DATE_FORMAT(DATE_ADD(STR_TO_DATE(`date`, '%Y-%m-%d'), INTERVAL 1 MONTH), '%Y-%m')
 WHERE DAY(STR_TO_DATE(`date`, '%Y-%m-%d')) >= 26 AND `cycleKey` = LEFT(`date`, 7);
UPDATE `agent_quality_flags`
   SET `cycleKey` = DATE_FORMAT(DATE_ADD(STR_TO_DATE(`date`, '%Y-%m-%d'), INTERVAL 1 MONTH), '%Y-%m')
 WHERE DAY(STR_TO_DATE(`date`, '%Y-%m-%d')) >= 26 AND `cycleKey` = LEFT(`date`, 7);

-- 10. Fold legacy pto_requests into leave_requests (the ONE leave system). Each copied row carries a
--     "[pto#<id>" marker in reason so re-running never duplicates. ptoStatus → status, reviewer → decidedBy.
INSERT INTO `leave_requests` (`traineeCode`, `requesterName`, `startDate`, `endDate`, `days`, `reason`, `leaveType`, `status`, `decidedBy`, `createdAt`, `decidedAt`)
SELECT p.`traineeCode`, p.`agentName`, p.`startDate`, p.`endDate`,
       GREATEST(1, DATEDIFF(STR_TO_DATE(p.`endDate`, '%Y-%m-%d'), STR_TO_DATE(p.`startDate`, '%Y-%m-%d')) + 1),
       CONCAT('[pto#', p.`id`, ' ', p.`requestType`, IF(p.`halfDay` = 1, ', half day', ''), '] ', COALESCE(p.`reason`, '')),
       CASE WHEN p.`requestType` = 'annual' THEN 'annual' ELSE NULL END,
       p.`ptoStatus`, p.`reviewedBy`, p.`createdAt`, p.`reviewedAt`
  FROM `pto_requests` p
 WHERE NOT EXISTS (SELECT 1 FROM `leave_requests` l WHERE l.`reason` LIKE CONCAT('[pto#', p.`id`, ' %'));

-- 11. BD teammates: a bd_users link is what makes someone BD. Give their Hub login the matching role so the
--     server-side staff gate admits them (the request context also does this on the fly as a fallback).
UPDATE `users` u
  JOIN `bd_users` b ON b.`openId` = u.`openId` AND b.`active` = 1
   SET u.`role` = 'bd'
 WHERE u.`role` IN ('user', 'viewer');

-- 12. Leave type gains 'unpaid' (sick / emergency / unpaid PTO approves WITHOUT touching a balance).
SET @q = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leave_requests' AND COLUMN_NAME = 'leaveType' AND COLUMN_TYPE NOT LIKE '%unpaid%') > 0,
  'ALTER TABLE `leave_requests` MODIFY COLUMN `leaveType` ENUM(''casual'',''annual'',''unpaid'') NULL', 'SELECT 1');
PREPARE s FROM @q;
EXECUTE s;
DEALLOCATE PREPARE s;
