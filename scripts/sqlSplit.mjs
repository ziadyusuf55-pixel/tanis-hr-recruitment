/**
 * SQL statement splitter for the migration runner — quote- and comment-aware.
 *
 * The old splitter only recognised `;` at END OF LINE, so a line like
 *   `PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;`
 * (migration 0009) was sent to MySQL as ONE query and rejected, because the
 * runner connects with multipleStatements:false. This version splits on `;`
 * anywhere, while respecting:
 *   - '…' / "…" / `…` strings, with both '' doubling and \' backslash escapes
 *   - `-- …` line comments and /* … *​/ block comments (stripped)
 *   - drizzle's `--> statement-breakpoint` markers (used by 0000/0001)
 */
export function splitStatements(sqlText) {
  // drizzle-kit output: explicit breakpoints win (the marker lives in a -- comment).
  if (sqlText.includes("--> statement-breakpoint")) {
    return sqlText
      .split("--> statement-breakpoint")
      .map(s => s.replace(/^\s*--.*$/gm, "").trim().replace(/;\s*$/, ""))
      .filter(Boolean);
  }

  const out = [];
  let buf = "";
  let quote = null; // ' " or `

  for (let i = 0; i < sqlText.length; i++) {
    const c = sqlText[i];
    const next = sqlText[i + 1];

    if (quote) {
      buf += c;
      if (c === "\\" && quote !== "`") { // backslash escape inside ' or "
        if (next !== undefined) { buf += next; i++; }
        continue;
      }
      if (c === quote) {
        if (next === quote) { buf += next; i++; continue; } // '' / "" / `` doubling
        quote = null;
      }
      continue;
    }

    if (c === "'" || c === '"' || c === "`") { quote = c; buf += c; continue; }

    if (c === "-" && next === "-") { // line comment
      while (i < sqlText.length && sqlText[i] !== "\n") i++;
      buf += "\n";
      continue;
    }
    if (c === "/" && next === "*") { // block comment
      i += 2;
      while (i < sqlText.length && !(sqlText[i] === "*" && sqlText[i + 1] === "/")) i++;
      i++; // skip the '/'
      continue;
    }

    if (c === ";") {
      const s = buf.trim();
      if (s) out.push(s);
      buf = "";
      continue;
    }

    buf += c;
  }

  const tail = buf.trim();
  if (tail) out.push(tail);
  return out;
}
