import mysql from "mysql2/promise";
const conn = await mysql.createConnection(process.env.DATABASE_URL);
await conn.execute("ALTER TABLE candidates MODIFY COLUMN email VARCHAR(320) NULL");
console.log("Migration complete: email is now nullable");
await conn.end();
