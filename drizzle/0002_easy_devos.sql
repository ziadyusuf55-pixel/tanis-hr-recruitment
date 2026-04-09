-- Migration: New Tanis recruitment pipeline stages + stage_notes table
-- Replaces old pipeline (applied/shortlisted/interviewed/offered/hired/rejected)
-- with new pipeline (applied/whatsapp_sent/voice_note_reviewed/interview_scheduled/accepted/teams_invitation_sent/rejected)

-- 1. Alter candidates.status enum to new pipeline stages
ALTER TABLE `candidates` MODIFY COLUMN `status` enum(
  'applied',
  'whatsapp_sent',
  'voice_note_reviewed',
  'interview_scheduled',
  'accepted',
  'teams_invitation_sent',
  'rejected'
) NOT NULL DEFAULT 'applied';

-- 2. Extend candidates phone column to 64 chars (was 32)
ALTER TABLE `candidates` MODIFY COLUMN `phone` varchar(64);

-- 3. Add meetLink and teamsLink columns to candidates
ALTER TABLE `candidates` ADD COLUMN `meetLink` text;
ALTER TABLE `candidates` ADD COLUMN `teamsLink` text;

-- 4. Add appliedAt and acceptedAt timestamp columns for time-to-hire KPI
ALTER TABLE `candidates` ADD COLUMN `appliedAt` bigint;
ALTER TABLE `candidates` ADD COLUMN `acceptedAt` bigint;

-- 5. Migrate existing candidates: map old stages to new stages
UPDATE `candidates` SET `status` = 'voice_note_reviewed' WHERE `status` = 'shortlisted';
UPDATE `candidates` SET `status` = 'interview_scheduled' WHERE `status` = 'interviewed';
UPDATE `candidates` SET `status` = 'teams_invitation_sent' WHERE `status` = 'offered';
UPDATE `candidates` SET `status` = 'accepted' WHERE `status` = 'hired';

-- 6. Create stage_notes table
CREATE TABLE `stage_notes` (
  `id` int AUTO_INCREMENT NOT NULL,
  `candidateId` int NOT NULL,
  `stage` enum(
    'applied',
    'whatsapp_sent',
    'voice_note_reviewed',
    'interview_scheduled',
    'accepted',
    'teams_invitation_sent',
    'rejected'
  ) NOT NULL,
  `note` text NOT NULL,
  `recruiterName` varchar(255),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `stage_notes_id` PRIMARY KEY(`id`)
);

-- 7. Drop the jobs table (no longer needed)
DROP TABLE IF EXISTS `jobs`;