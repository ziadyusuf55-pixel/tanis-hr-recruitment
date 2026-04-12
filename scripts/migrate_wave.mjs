import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);
try {
  await conn.execute("ALTER TABLE `candidates` ADD COLUMN `wave` int");
  console.log("✅ wave column added to candidates");
} catch (e) {
  if (e.code === "ER_DUP_FIELDNAME") {
    console.log("ℹ️  wave column already exists — skipping");
  } else {
    throw e;
  }
} finally {
  await conn.end();
}
