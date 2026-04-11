-- Migration: Rich Candidate Profile + Activity Log
-- Adds age, location, source, voiceNoteRating, screeningNotes to candidates
-- Creates activity_log table for full audit trail

ALTER TABLE `candidates`
  ADD COLUMN `age` int,
  ADD COLUMN `location` varchar(255),
  ADD COLUMN `source` enum('linkedin','email','referral','walk_in','other'),
  ADD COLUMN `voiceNoteRating` int,
  ADD COLUMN `screeningNotes` text;

CREATE TABLE `activity_log` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `candidateId` int NOT NULL,
  `action` varchar(128) NOT NULL,
  `fromStage` varchar(64),
  `toStage` varchar(64),
  `detail` text,
  `performedBy` varchar(255),
  `createdAt` timestamp NOT NULL DEFAULT (now())
);
