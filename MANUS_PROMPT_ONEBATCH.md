# Deploy: One-batch audit fixes (security · money · lifecycle · modules · client)

This zip contains **49 changed files at their repo-relative paths** (7 deletions listed below). It is one coherent batch fixing all 21 audit blockers plus ~90 further issues. Apply it to the repo as-is, then follow the steps **in this exact order**.

## 0. BACKUP FIRST (required)

Before anything else, snapshot these tables (CREATE TABLE … AS SELECT or mysqldump):

```
payroll_records, payroll_adjustments, commissions, workforce_agents, agent_separations
```

This batch touches payroll keying and separation cascades. The snapshot is the rollback.

## 1. Replace files

Copy every file in the zip over the repo at the same path. **Delete these 7 files** (dead code, no longer referenced):

```
client/src/pages/Home.tsx
client/src/pages/Jobs.tsx
client/src/pages/PayrollStatus.tsx
client/src/pages/ComponentShowcase.tsx
client/src/components/AIChatBox.tsx
client/src/components/ManusDialog.tsx
client/src/components/Map.tsx
```

Note: `scripts/sqlSplit.mjs` and `scripts/dev/gen-reconcile.mjs` are NEW files inside the gitignored `scripts/` folder — make sure they land on disk (`scripts/migrate.mjs` imports `./sqlSplit.mjs` and will crash without it).

## 2. Run migrations BEFORE deploying code

```
node scripts/migrate.mjs
```

Expected: **ran=2, skipped=21** (0023_schema_reconcile + 0024_hot_indexes; 0000–0022 already applied).

- **0023 is large (~3,100 guarded statements) and takes a few minutes** — do not interrupt it. Every statement is guarded (CREATE TABLE IF NOT EXISTS / information_schema-checked ADD COLUMN / MODIFY), so it is a no-op wherever prod already matches and safe to re-run if the connection drops.
- 0024 dedupes three tables then adds ~58 guarded indexes/uniques.
- NEVER run drizzle-kit push/generate against prod. `db:push` stays disabled.

## 3. Build + deploy

```
pnpm install            # no new runtime deps, but safe
pnpm exec tsc --noEmit -p tsconfig.json   # should be clean
pnpm exec vitest run    # 69 passed / 3 skipped
pnpm run build
```

Then deploy as usual and reply here with the checkpoint SHA.

## 4. Optional env vars (new, all have safe defaults)

- `DB_POOL_SIZE` — mysql2 pool size (default 10)
- `RUN_JOBS=false` — set ONLY on extra replicas to disable the hourly job scheduler there
- See the new `.env.example` for the full documented list.

## 5. Post-deploy smoke checks (2 minutes)

1. Admin Hub loads; Dashboard tiles render (counts may differ — tiles are now role-gated and correctly bounded).
2. Agent portal: log in as the demo agent → portal loads; change password → stays logged in (session-revocation fix).
3. Payroll page: open current cycle → rows + "Total Owed" column show; "paid" rows unchanged.
4. `GET /healthz` returns ok.

## What changed (one line each)

- **Security:** 46 agent endpoints moved to central session verification (signature + revocation + status + portal lock); upload validation (MIME whitelist + magic bytes); role gates across money/HR/academy endpoints; dead `invites` router (a second path to admin role) deleted; Slack event replay guard.
- **Money:** a leaver's final payroll/commission now lands on THEIR archived CRDTS (write-time resolver); payment status re-derived whenever the owed total changes; re-uploads skip rows already marked PAID; one transactional settleAgent() writer; leave days computed server-side + cancellation re-credits; pay-cycle (26th→25th) defaults everywhere; setMonth-overflow bucketing fixed.
- **Lifecycle:** scheduled separations run the FULL cascade exactly once (settlement queue, exit row, session revoke, CRDTS archive); notice periods keep portal access; Request-Center resignations actually schedule the separation; workforce.rehire with blacklist/eligibility checks replaces the raw Restore write; frozen/inactive agents keep portal logins.
- **Modules:** candidate delete is one transaction with a full cascade and a payroll-history guard; nightly ingest resolves trainee codes + archived CRDTS; Slack nags only ping agents actually missing payment prefs and never log failed sends as sent; clock-in double-shift race fixed with a row lock; hourly jobs are Cairo-dated, gated by RUN_JOBS, and alert Slack on failure.
- **Client:** Break Schedule can no longer wipe breaks while loading; "Generate All Credentials" skips existing logins + confirms; failed loads show an error banner instead of a happy empty state; money pages/sections restricted to Finance+HR+Managers; dead pages deleted.

Full commit-by-commit detail is in the git history of this batch (7 commits, "One-batch fixes 1/6 … 6/6" + review fixes).
