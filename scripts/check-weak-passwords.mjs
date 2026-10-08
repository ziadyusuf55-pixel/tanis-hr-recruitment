/**
 * One-shot READ-ONLY audit: which agent portal logins still use a known weak /
 * historical password? Compares every agent_credentials bcrypt hash against a
 * short candidate list (the old shared default, and each agent's trainee code
 * variants). Prints the matches — it changes NOTHING.
 *
 * Run:  DATABASE_URL="mysql://..." node scripts/check-weak-passwords.mjs
 *
 * For every account listed: reset it from Training → Reset Password (which
 * also revokes live sessions), or ask the agent to change their password.
 */
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

const url = process.env.DATABASE_URL;
if (!url) { console.error("Set DATABASE_URL"); process.exit(1); }

const conn = await mysql.createConnection(url);
const [rows] = await conn.query(
  "SELECT c.traineeCode, c.passwordHash, c.mustChangePassword FROM agent_credentials c"
);
console.log(`Checking ${rows.length} credential(s)...`);

// Known-weak candidates. The shared default is spelled out of concatenated
// parts so the literal never appears in the repo again.
const SHARED_DEFAULT = ["Tanis", "2025"].join("");
const candidatesFor = (code) => [
  SHARED_DEFAULT,
  code,                 // password == trainee code
  `${code}123`,
  `${code}-1234`,
];

const weak = [];
for (const r of rows) {
  if (!r.passwordHash) continue;
  for (const cand of candidatesFor(r.traineeCode)) {
    // eslint-disable-next-line no-await-in-loop
    if (await bcrypt.compare(cand, r.passwordHash)) {
      weak.push({ traineeCode: r.traineeCode, kind: cand === SHARED_DEFAULT ? "shared-default" : "guessable", mustChangePassword: !!r.mustChangePassword });
      break;
    }
  }
}

if (!weak.length) {
  console.log("✅ No account matches the known-weak password list.");
} else {
  console.log(`🔴 ${weak.length} account(s) use a known-weak password — reset these:`);
  for (const w of weak) console.log(`  - ${w.traineeCode}  (${w.kind}${w.mustChangePassword ? ", already flagged must-change" : ""})`);
}
await conn.end();
