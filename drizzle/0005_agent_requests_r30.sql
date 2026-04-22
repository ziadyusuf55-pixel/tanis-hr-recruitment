-- Round 30: Add sick_note type, requestedDates, attachmentUrl, isAdminRead to agent_requests
ALTER TABLE `agent_requests`
  MODIFY COLUMN `type` ENUM('leave','salary','schedule','complaint','resignation','day_off','sick_note','other') NOT NULL,
  ADD COLUMN `requestedDates` TEXT NULL AFTER `requestedDate`,
  ADD COLUMN `attachmentUrl` VARCHAR(1024) NULL AFTER `requestedDates`,
  ADD COLUMN `isAdminRead` BOOLEAN NOT NULL DEFAULT FALSE AFTER `status`;
