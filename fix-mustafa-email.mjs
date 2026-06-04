import { createConnection } from 'mysql2/promise';
import * as dotenv from 'dotenv';
dotenv.config();

const conn = await createConnection(process.env.DATABASE_URL);

// Normalize all admin_accounts emails to lowercase
const [result] = await conn.execute(
  "UPDATE admin_accounts SET email = LOWER(email)"
);
console.log('Updated rows:', result.affectedRows);

// Verify Mustafa's record
const [rows] = await conn.execute(
  "SELECT id, email, name, isActive FROM admin_accounts WHERE email LIKE '%mustafa%'"
);
console.log('Mustafa record:', JSON.stringify(rows, null, 2));

await conn.end();
