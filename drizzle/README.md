# Database migrations

**Do not run `drizzle-kit migrate` or `drizzle-kit push` against production.**
drizzle-kit's ledger (`__drizzle_migrations`) only knows 0000–0001 and `drizzle/meta`
holds a snapshot from 0002, so drizzle-kit would try to recreate ~50 live tables.

Migrations are plain SQL files in this folder, applied in filename order by
`scripts/migrate.mjs`, which keeps its own ledger table `_hub_migrations`.

```bash
pnpm db:migrate:dry      # show pending files / statements
pnpm db:migrate          # apply pending files
```

## First run on the existing production DB

Production already has 0000–0016 applied by hand. Record that once, then apply the rest:

```bash
pnpm db:baseline         # marks 0000–0016 as applied WITHOUT running them
pnpm db:migrate          # runs 0017+ (0017 is the audit fix-up: flags, indexes, dedupe)
```

## Writing a new migration

* Name it `NNNN_short_name.sql` with the next number.
* Make every statement re-runnable: `CREATE TABLE IF NOT EXISTS`, and for columns/indexes
  use the INFORMATION_SCHEMA + `PREPARE` guard pattern from `0017_audit_fixes.sql`
  (stock MySQL 8 has no `ADD COLUMN IF NOT EXISTS`).
* Update `drizzle/schema.ts` in the same commit so the ORM matches the DB.
* Never seed credentials or passwords in a migration.

`pnpm db:generate` (drizzle-kit generate) is available to *draft* SQL from a schema change,
but review and guard the output before committing it, and never let it run `migrate`.
