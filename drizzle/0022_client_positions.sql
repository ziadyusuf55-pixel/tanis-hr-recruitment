-- 0022: managed list of positions / roles per client (Quantum). Positions are picked from this list instead of
-- being free text per agent, so a typo can no longer create a second "position". Seeded from the jobTitles
-- already in use by each position-based client's agents (idempotent).
CREATE TABLE IF NOT EXISTS `client_positions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `clientId` int NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_general_ci NOT NULL,
  `sortOrder` int NOT NULL DEFAULT 0,
  `isActive` tinyint(1) NOT NULL DEFAULT 1,
  `targetHeadcount` int DEFAULT NULL,
  `createdAt` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_client_position` (`clientId`, `name`)
);
INSERT IGNORE INTO `client_positions` (`clientId`, `name`, `sortOrder`, `isActive`, `createdAt`) SELECT c.`clientId`, MIN(TRIM(w.`jobTitle`)), 0, 1, UNIX_TIMESTAMP() * 1000 FROM `workforce_agents` w JOIN `campaigns` c ON c.`id` = w.`campaignId` JOIN `clients` cl ON cl.`id` = c.`clientId` WHERE cl.`positionBased` = 1 AND w.`jobTitle` IS NOT NULL AND TRIM(w.`jobTitle`) <> '' AND (w.`isDemo` IS NULL OR w.`isDemo` = 0) AND w.`isActive` = 1 AND (w.`agentStatus` IS NULL OR w.`agentStatus` = 'active') GROUP BY c.`clientId`, LOWER(TRIM(w.`jobTitle`));
