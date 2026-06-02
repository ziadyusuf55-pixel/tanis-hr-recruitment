CREATE TABLE `payroll_adjustments` (
  `id` int AUTO_INCREMENT NOT NULL,
  `crdts` varchar(50) NOT NULL,
  `month` varchar(7) NOT NULL,
  `type` enum('bonus','deduction') NOT NULL,
  `label` varchar(255) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `createdAt` bigint NOT NULL,
  `createdBy` varchar(255),
  CONSTRAINT `payroll_adjustments_id` PRIMARY KEY(`id`)
);
