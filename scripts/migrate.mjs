#!/usr/bin/env node
/**
 * Safe SQL migration runner for Tanis Hub.
 *
 * WHY THIS EXISTS
 *   drizzle-kit's ledger (`__drizzle_migrations`) only knows 0000 + 0001, and the
 *   snapshot in drizzle/meta is from 0002. `drizzle-kit generate && drizzle-kit migrate`
 *   would diff the live DB against that stale snapshot and try to CREATE ~50 tables
 *   that already exist (or worse). Do not run it against production.
 *
 *   This runner applies `drizzle/NNNN_*.sql` files in order and records each one in
 *   its own ledger table `_hub_migrations` (filename + sha256). Files already
 *   recorded are skipped. Statements run one at a time so a failure points at the
 *   exact statement.
 *
 * USAGE
 *   node scripts/migrate.mjs                 apply every pending file
 *   node scripts/migrate.mjs --dry-run       show what would run
 *   node scripts/migrate.mjs --baseline      mark ALL current files as applied WITHOUT running them
 *                                            (first run on a DB that already has 0000–0016 applied by hand)
 *   node scripts/migrate.mjs --baseline-through 0016   mark files ≤ 0016 as applied, then run the rest
 *   node scripts/migrate.mjs --only 0017     run just that file (still recorded)
 *
 * Needs DATABASE_URL (reads .env).
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const args = new Set(process.argv.slice(2));
const argVal = (k) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };
const DRY = args.has("--dry-run");
const BASELINE_ALL = args.has("--baseline");
const BASELINE_THROUGH = argVal("--baseline-through");
const ONLY = argVal("--only");

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL is not set"); process.exit(1); }

const dir = path.resolve(process.cwd(), "drizzle");
const files = fs.readdirSync(dir).filter(f => /^\d{4}_.*\.sql$/.test(f)).sort();
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

/** Split a .sql file into statements. Honours drizzle's `--> statement-breakpoint`, otherwise `;` at line end. */
function splitStatements(sqlText) {
  const noComments = sqlText.split("\n").filter(l => !/^\s*--/.test(l)).join("\n");
  if (noComments.includes("--> statement-breakpoint")) {
    return noComments.split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean);
  }
  const out = []; let buf = "";
  for (const line of noComments.split("\n")) {
    buf += line + "\n";
    if (/;\s*$/.test(line)) { out.push(buf.trim().replace(/;\s*$/, "")); buf = ""; }
  }
  if (buf.trim()) out.push(buf.trim().replace(/;\s*$/, ""));
  return out.filter(Boolean);
}

const conn = await mysql.createConnection({ uri: url, multipleStatements: false });
await conn.query(`CREATE TABLE IF NOT EXISTS _hub_migrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  filename VARCHAR(255) NOT NULL UNIQUE,
  sha256 CHAR(64) NOT NULL,
  applied_at BIGINT NOT NULL,
  baseline TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

const [rows] = await conn.query("SELECT filename, sha256 FROM _hub_migrations");
const applied = new Map(rows.map(r => [r.filename, r.sha256]));

let ran = 0, skipped = 0, baselined = 0;
for (const f of files) {
  const num = f.slice(0, 4);
  const text = fs.readFileSync(path.join(dir, f), "utf8");
  const hash = sha(text);

  if (ONLY && num !== ONLY) { skipped++; continue; }

  if (applied.has(f)) {
    if (applied.get(f) !== hash) console.warn(`⚠  ${f} was edited after it was applied (hash differs). Leaving it alone.`);
    skipped++; continue;
  }

  const shouldBaseline = BASELINE_ALL || (BASELINE_THROUGH && num <= BASELINE_THROUGH);
  if (shouldBaseline) {
    console.log(`= baseline ${f}`);
    if (!DRY) await conn.query("INSERT INTO _hub_migrations (filename, sha256, applied_at, baseline) VALUES (?, ?, ?, 1)", [f, hash, Date.now()]);
    baselined++; continue;
  }

  const stmts = splitStatements(text);
  console.log(`→ ${f}  (${stmts.length} statement${stmts.length === 1 ? "" : "s"})`);
  if (DRY) { for (const s of stmts) console.log("   " + s.split("\n")[0].slice(0, 110) + (s.length > 110 ? " …" : "")); ran++; continue; }

  for (let i = 0; i < stmts.length; i++) {
    const s = stmts[i];
    try {
      await conn.query(s);
    } catch (e) {
      console.error(`\n✖ ${f} failed at statement ${i + 1}/${stmts.length}:\n${s}\n\n${e.message}`);
      console.error("Nothing from this file was recorded. Fix and re-run; every file is written to be re-runnable.");
      await conn.end();
      process.exit(1);
    }
  }
  await conn.query("INSERT INTO _hub_migrations (filename, sha256, applied_at) VALUES (?, ?, ?)", [f, hash, Date.now()]);
  ran++;
}

await conn.end();
console.log(`\nDone. ran=${ran} baselined=${baselined} skipped=${skipped}${DRY ? "  (dry run — nothing executed)" : ""}`);
