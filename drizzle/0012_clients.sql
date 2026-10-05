-- 0012_clients.sql
-- Create clients table, seed Apello + Quantum, add clientId to campaigns

CREATE TABLE IF NOT EXISTS `clients` (
  `id`        INT AUTO_INCREMENT PRIMARY KEY,
  `name`      VARCHAR(255) NOT NULL,
  `shortCode` VARCHAR(20)  NOT NULL,
  `colorHex`  VARCHAR(7)   NOT NULL DEFAULT '#6366f1',
  `isActive`  TINYINT(1)   NOT NULL DEFAULT 1,
  `createdAt` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed known clients
INSERT INTO `clients` (`id`, `name`, `shortCode`, `colorHex`, `isActive`)
VALUES
  (1, 'Apello', 'APL', '#FF6A13', 1),
  (2, 'Quantum', 'QNT', '#6366f1', 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- Add clientId FK to campaigns (guarded — stock MySQL 8 rejects ADD COLUMN IF NOT EXISTS)
SET @q = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'clientId') = 0,
  'ALTER TABLE `campaigns` ADD COLUMN `clientId` INT NULL DEFAULT NULL', 'SELECT 1');
PREPARE s FROM @q;
EXECUTE s;
DEALLOCATE PREPARE s;

-- All existing campaigns belong to Apello
UPDATE `campaigns` SET `clientId` = 1 WHERE `clientId` IS NULL;
