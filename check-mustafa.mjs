import { createConnection } from 'mysql2/promise';
import * as dotenv from 'dotenv';
dotenv.config();

const conn = await createConnection(process.env.DATABASE_URL);

const [accounts] = await conn.execute(
  "SELECT * FROM admin_accounts WHERE email LIKE '%mustafa%' LIMIT 5"
);
console.log('admin_accounts:', JSON.stringify(accounts, null, 2));

const [invites] = await conn.execute(
  "SELECT * FROM admin_invites WHERE email LIKE '%mustafa%' LIMIT 5"
);
console.log('admin_invites:', JSON.stringify(invites, null, 2));

await conn.end();
