import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }

const conn = await mysql.createConnection(url);

try {
  const [rows] = await conn.execute(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agent_requests'`
  );
  
  if (rows.length > 0) {
    console.log("Table agent_requests already exists — skipping.");
  } else {
    await conn.execute(`
      CREATE TABLE agent_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        candidateId INT NOT NULL,
        traineeCode VARCHAR(100) NOT NULL,
        type ENUM('leave','salary','schedule','complaint','other') NOT NULL,
        subject VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        status ENUM('pending','in_progress','resolved','rejected') NOT NULL DEFAULT 'pending',
        adminReply TEXT,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ Created agent_requests table.");
  }
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exit(1);
} finally {
  await conn.end();
}
