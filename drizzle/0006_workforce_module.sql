-- Round 33: Workforce Operations Module
-- Creates 6 new tables: campaigns, workforce_agents, agent_payment_methods,
-- agent_documents, schedule_change_requests, overtime_availability

CREATE TABLE `campaigns` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `name` varchar(255) NOT NULL,
  `minHeadcount` int NOT NULL DEFAULT 1,
  `workDays` enum('all','weekdays') NOT NULL DEFAULT 'all',
  `notes` text,
  `createdAt` timestamp NOT NULL DEFAULT NOW(),
  `updatedAt` timestamp NOT NULL DEFAULT NOW() ON UPDATE NOW()
);

CREATE TABLE `workforce_agents` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `traineeCode` varchar(100) NOT NULL UNIQUE,
  `candidateId` int NOT NULL,
  `campaignId` int,
  `fullName` varchar(255) NOT NULL,
  `alias` varchar(100),
  `email` varchar(320),
  `phone` varchar(64),
  `shiftHours` varchar(100),
  `teamLeader` varchar(255),
  `offDay1` int,
  `offDay2` int,
  `joinDate` bigint,
  `isActive` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT NOW(),
  `updatedAt` timestamp NOT NULL DEFAULT NOW() ON UPDATE NOW()
);

CREATE TABLE `agent_payment_methods` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `traineeCode` varchar(100) NOT NULL,
  `type` enum('wallet','bank') NOT NULL,
  `walletProvider` enum('vodafone_cash','orange_cash'),
  `walletPhone` varchar(20),
  `walletName` varchar(255),
  `bankName` varchar(255),
  `bankAccountOrPhone` varchar(100),
  `bankFullName` varchar(255),
  `isPreferred` boolean NOT NULL DEFAULT false,
  `adminComment` text,
  `createdAt` timestamp NOT NULL DEFAULT NOW(),
  `updatedAt` timestamp NOT NULL DEFAULT NOW() ON UPDATE NOW()
);

CREATE TABLE `agent_documents` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `traineeCode` varchar(100) NOT NULL,
  `docType` varchar(100) NOT NULL,
  `fileUrl` varchar(1024) NOT NULL,
  `fileName` varchar(255),
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `adminComment` text,
  `uploadedAt` timestamp NOT NULL DEFAULT NOW(),
  `updatedAt` timestamp NOT NULL DEFAULT NOW() ON UPDATE NOW()
);

CREATE TABLE `schedule_change_requests` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `requesterCode` varchar(100) NOT NULL,
  `targetCode` varchar(100) NOT NULL,
  `requesterNewOff1` int,
  `requesterNewOff2` int,
  `targetNewOff1` int,
  `targetNewOff2` int,
  `message` text,
  `status` enum('pending_peer','pending_manager','approved','rejected') NOT NULL DEFAULT 'pending_peer',
  `peerApprovedAt` bigint,
  `managerApprovedAt` bigint,
  `managerComment` text,
  `createdAt` timestamp NOT NULL DEFAULT NOW(),
  `updatedAt` timestamp NOT NULL DEFAULT NOW() ON UPDATE NOW()
);

CREATE TABLE `overtime_availability` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `traineeCode` varchar(100) NOT NULL,
  `campaignId` int NOT NULL,
  `date` varchar(10) NOT NULL,
  `status` enum('available','unavailable') NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT NOW()
);
