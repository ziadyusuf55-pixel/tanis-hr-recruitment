-- 0018: bd_deals columns that exist in drizzle/schema.ts but were never created in production.
-- Symptom: every SELECT on bd_deals fails with "Unknown column 'coldignoredat'", so the BD page shows no
-- records. Guarded + re-runnable (see 0017 for the pattern). Covers every nullable bd_deals column the ORM
-- selects, so any other drifted column is healed by the same file.

SET @q = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bd_deals' AND COLUMN_NAME = 'coldIgnoredAt') = 0,
  'ALTER TABLE `bd_deals` ADD COLUMN `coldIgnoredAt` BIGINT NULL', 'SELECT 1');
PREPARE s FROM @q;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @q = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bd_deals' AND COLUMN_NAME = 'stageChangedAt') = 0,
  'ALTER TABLE `bd_deals` ADD COLUMN `stageChangedAt` BIGINT NULL', 'SELECT 1');
PREPARE s FROM @q;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @q = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bd_deals' AND COLUMN_NAME = 'outcomeReason') = 0,
  'ALTER TABLE `bd_deals` ADD COLUMN `outcomeReason` VARCHAR(255) NULL', 'SELECT 1');
PREPARE s FROM @q;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @q = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bd_deals' AND COLUMN_NAME = 'reminderNote') = 0,
  'ALTER TABLE `bd_deals` ADD COLUMN `reminderNote` VARCHAR(255) NULL', 'SELECT 1');
PREPARE s FROM @q;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @q = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bd_deals' AND COLUMN_NAME = 'reminderDate') = 0,
  'ALTER TABLE `bd_deals` ADD COLUMN `reminderDate` VARCHAR(20) NULL', 'SELECT 1');
PREPARE s FROM @q;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @q = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bd_deals' AND COLUMN_NAME = 'lastContactedAt') = 0,
  'ALTER TABLE `bd_deals` ADD COLUMN `lastContactedAt` BIGINT NULL', 'SELECT 1');
PREPARE s FROM @q;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @q = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bd_deals' AND COLUMN_NAME = 'companyId') = 0,
  'ALTER TABLE `bd_deals` ADD COLUMN `companyId` INT NULL', 'SELECT 1');
PREPARE s FROM @q;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @q = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bd_deals' AND COLUMN_NAME = 'closedAt') = 0,
  'ALTER TABLE `bd_deals` ADD COLUMN `closedAt` BIGINT NULL', 'SELECT 1');
PREPARE s FROM @q;
EXECUTE s;
DEALLOCATE PREPARE s;
