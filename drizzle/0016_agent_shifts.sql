-- 0016: Agent clock-in / clock-out work shifts
-- Additive and idempotent; safe to run when the table already exists.
CREATE TABLE IF NOT EXISTS `agent_shifts` (
  `id` int AUTO_INCREMENT NOT NULL,
  `traineeCode` varchar(100) NOT NULL,
  `clockIn` bigint NOT NULL,
  `clockOut` bigint,
  `date` varchar(10) NOT NULL,
  `durationMs` int,
  `createdAt` bigint NOT NULL,
  CONSTRAINT `agent_shifts_id` PRIMARY KEY(`id`),
  INDEX `idx_agent_shifts_trainee_date` (`traineeCode`, `date`)
);
