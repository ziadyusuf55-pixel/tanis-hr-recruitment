-- 0019: Request Center handles attendance exceptions; clients can be position-based (Quantum).
-- Guarded + re-runnable.

-- 1. agent_requests.type gains late_arrival / early_departure (approval creates the attendance exception).
SET @q = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agent_requests' AND COLUMN_NAME = 'type' AND COLUMN_TYPE NOT LIKE '%late_arrival%') > 0,
  'ALTER TABLE `agent_requests` MODIFY COLUMN `type` ENUM(''leave'',''salary'',''schedule'',''complaint'',''resignation'',''day_off'',''paid_leave'',''sick_note'',''hr_letter'',''late_arrival'',''early_departure'',''other'') NOT NULL', 'SELECT 1');
PREPARE s FROM @q;
EXECUTE s;
DEALLOCATE PREPARE s;

-- 2. clients.positionBased — group agents by job title (position) instead of campaign everywhere.
SET @q = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clients' AND COLUMN_NAME = 'positionBased') = 0,
  'ALTER TABLE `clients` ADD COLUMN `positionBased` TINYINT(1) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE s FROM @q;
EXECUTE s;
DEALLOCATE PREPARE s;
UPDATE `clients` SET `positionBased` = 1 WHERE LOWER(`name`) LIKE '%quantum%';
