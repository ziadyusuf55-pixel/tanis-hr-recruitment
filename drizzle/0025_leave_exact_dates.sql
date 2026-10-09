-- 0025: leave_requests.leaveDates — the EXACT dates an agent picked (JSON array of YYYY-MM-DD).
-- Audit F12: only start/end/days were stored, so Mon+Fri was later counted as Mon–Fri in reports
-- and blocked any Tue–Thu request as "overlapping". NULL on legacy rows = contiguous span (old behaviour).
-- Additive, guarded, re-runnable. No data change.
SET @q = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leave_requests' AND COLUMN_NAME = 'leaveDates') = 0,
  'ALTER TABLE `leave_requests` ADD COLUMN `leaveDates` text NULL', 'SELECT 1');
PREPARE s FROM @q;
EXECUTE s;
DEALLOCATE PREPARE s;
