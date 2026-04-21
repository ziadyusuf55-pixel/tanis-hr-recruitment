import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }

// Parse the URL
const conn = await mysql.createConnection(url);

try {
  // Check if column already exists
  const [rows] = await conn.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'batch_candidates' 
     AND COLUMN_NAME = 'slackJoined'`
  );
  
  if (rows.length > 0) {
    console.log("Column slackJoined already exists — skipping migration.");
  } else {
    await conn.execute(
      `ALTER TABLE batch_candidates ADD COLUMN slackJoined BOOLEAN NOT NULL DEFAULT FALSE`
    );
    console.log("✅ Added slackJoined column to batch_candidates table.");
  }
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exit(1);
} finally {
  await conn.end();
}
