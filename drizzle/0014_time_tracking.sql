CREATE TABLE agent_aux_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  traineeCode VARCHAR(100) NOT NULL,
  auxType VARCHAR(50) NOT NULL,
  startTime BIGINT NOT NULL,
  endTime BIGINT,
  durationMs INT,
  note TEXT,
  createdAt BIGINT NOT NULL
);

CREATE TABLE pto_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  traineeCode VARCHAR(100) NOT NULL,
  agentName VARCHAR(255),
  requestType VARCHAR(50) NOT NULL,
  startDate VARCHAR(10) NOT NULL,
  endDate VARCHAR(10) NOT NULL,
  halfDay TINYINT(1) DEFAULT 0,
  ptoStatus ENUM('pending','approved','rejected') DEFAULT 'pending' NOT NULL,
  reason TEXT,
  reviewedBy VARCHAR(255),
  reviewedAt BIGINT,
  createdAt BIGINT NOT NULL
);

CREATE TABLE attendance_exceptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  traineeCode VARCHAR(100) NOT NULL,
  agentName VARCHAR(255),
  date VARCHAR(10) NOT NULL,
  exceptionType VARCHAR(50) NOT NULL,
  scheduledTime VARCHAR(8),
  actualTime VARCHAR(8),
  minutesLate INT,
  note TEXT,
  exStatus ENUM('pending','reviewed') DEFAULT 'pending' NOT NULL,
  reviewedBy VARCHAR(255),
  createdAt BIGINT NOT NULL
);
