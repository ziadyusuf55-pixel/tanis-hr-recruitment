-- Migration 0009: schedule swap metadata, agent request resolution, and leave requester names
-- Idempotent for deployments where one or more columns already exist.

SET @has_col = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schedule_change_requests' AND COLUMN_NAME = 'swapWeekOf'
);
SET @sql = IF(@has_col = 0,
  'ALTER TABLE schedule_change_requests ADD COLUMN swapWeekOf VARCHAR(10) NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schedule_change_requests' AND COLUMN_NAME = 'requesterOrigOff1'
);
SET @sql = IF(@has_col = 0,
  'ALTER TABLE schedule_change_requests ADD COLUMN requesterOrigOff1 INT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schedule_change_requests' AND COLUMN_NAME = 'requesterOrigOff2'
);
SET @sql = IF(@has_col = 0,
  'ALTER TABLE schedule_change_requests ADD COLUMN requesterOrigOff2 INT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schedule_change_requests' AND COLUMN_NAME = 'targetOrigOff1'
);
SET @sql = IF(@has_col = 0,
  'ALTER TABLE schedule_change_requests ADD COLUMN targetOrigOff1 INT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schedule_change_requests' AND COLUMN_NAME = 'targetOrigOff2'
);
SET @sql = IF(@has_col = 0,
  'ALTER TABLE schedule_change_requests ADD COLUMN targetOrigOff2 INT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schedule_change_requests' AND COLUMN_NAME = 'revertedAt'
);
SET @sql = IF(@has_col = 0,
  'ALTER TABLE schedule_change_requests ADD COLUMN revertedAt BIGINT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE schedule_change_requests
  MODIFY COLUMN status ENUM('pending_peer','pending_manager','approved','rejected','reverted') NOT NULL DEFAULT 'pending_peer';

SET @has_col = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agent_requests' AND COLUMN_NAME = 'resolvedBy'
);
SET @sql = IF(@has_col = 0,
  'ALTER TABLE agent_requests ADD COLUMN resolvedBy VARCHAR(255) NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agent_requests' AND COLUMN_NAME = 'resolvedAt'
);
SET @sql = IF(@has_col = 0,
  'ALTER TABLE agent_requests ADD COLUMN resolvedAt BIGINT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leave_requests' AND COLUMN_NAME = 'requesterName'
);
SET @sql = IF(@has_col = 0,
  'ALTER TABLE leave_requests ADD COLUMN requesterName VARCHAR(255) NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
