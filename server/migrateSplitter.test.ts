import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
// @ts-expect-error — plain .mjs module shared with scripts/migrate.mjs
import { splitStatements } from "../scripts/sqlSplit.mjs";

/** True when the statement contains a semicolon outside of quotes — i.e. it was not fully split. */
function hasUnquotedSemicolon(s: string): boolean {
  let q: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === "\\" && q !== "`") { i++; continue; }
      if (c === q) { if (s[i + 1] === q) { i++; continue; } q = null; }
      continue;
    }
    if (c === "'" || c === '"' || c === "`") { q = c; continue; }
    if (c === ";") return true;
  }
  return false;
}

describe("migration statement splitter", () => {
  it("splits multiple statements on one line (the 0009 failure mode)", () => {
    const out = splitStatements("PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;");
    expect(out).toEqual(["PREPARE stmt FROM @sql", "EXECUTE stmt", "DEALLOCATE PREPARE stmt"]);
  });

  it("never splits inside string literals, with '' and \\' escapes", () => {
    const out = splitStatements(
      "INSERT INTO t (a) VALUES ('x;y');\nSET @q = 'It''s a; test';\nSET @r = 'back\\\\slash; still one';"
    );
    expect(out).toHaveLength(3);
    expect(out[0]).toContain("x;y");
    expect(out[1]).toContain("It''s a; test");
  });

  it("strips -- line comments and /* block */ comments outside strings", () => {
    const out = splitStatements("SELECT 1; -- trailing; note\n/* block; comment */ SELECT 2;");
    expect(out).toEqual(["SELECT 1", "SELECT 2"]);
  });

  it("keeps the drizzle statement-breakpoint branch", () => {
    const out = splitStatements("CREATE TABLE a (x int);\n--> statement-breakpoint\nCREATE TABLE b (y int);");
    expect(out).toHaveLength(2);
  });

  it("every statement of every real migration file is a single statement", () => {
    const dir = path.resolve(__dirname, "../drizzle");
    const files = fs.readdirSync(dir).filter(f => /^\d{4}_.*\.sql$/.test(f)).sort();
    expect(files.length).toBeGreaterThanOrEqual(21);
    for (const f of files) {
      const stmts = splitStatements(fs.readFileSync(path.join(dir, f), "utf8"));
      expect(stmts.length, f).toBeGreaterThan(0);
      for (const s of stmts) {
        expect(hasUnquotedSemicolon(s), `${f}: ${s.slice(0, 80)}`).toBe(false);
        expect(s.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("0009 splits into individual PREPARE / EXECUTE / DEALLOCATE statements", () => {
    const text = fs.readFileSync(path.resolve(__dirname, "../drizzle/0009_schedule_swap_request_metadata.sql"), "utf8");
    const stmts = splitStatements(text);
    expect(stmts.length).toBe(46);
    for (const s of stmts) expect(/^(SET|PREPARE|EXECUTE|DEALLOCATE|ALTER|UPDATE|CREATE|INSERT|SELECT)/i.test(s), s.slice(0, 60)).toBe(true);
  });
});
